"use strict";
const assert = require("node:assert/strict");
const { BookingLab } = require("./booking-lab.js");
async function run() {
  let passed = 0;
  async function test(name, fn) {
    await fn();
    passed += 1;
    console.log("PASS " + name);
  }
  await test("sold out and server-controlled price", async () => {
    const lab = new BookingLab({ capacity: 2, priceCents: 9500 });
    const first = await lab.reserve({ requestKey: "A", seats: 2, amountCents: 1 });
    assert.equal(first.booking.amountCents, 19000);
    assert.equal((await lab.reserve({ requestKey: "B", seats: 1 })).reason, "sold_out");
    assert.equal(lab.remaining(), 0);
  });
  await test("simultaneous requests never oversell", async () => {
    const lab = new BookingLab({ capacity: 5 });
    const results = await Promise.all(Array.from({ length: 40 }, (_, i) =>
      lab.reserve({ requestKey: "race-" + i, seats: 1 })));
    assert.equal(results.filter(x => x.ok).length, 5);
    assert.equal(lab.remaining(), 0);
  });
  await test("payment failure releases seats", async () => {
    const lab = new BookingLab({ capacity: 1 });
    const id = (await lab.reserve({ requestKey: "A", seats: 1 })).booking.id;
    await lab.fail(id);
    assert.equal(lab.remaining(), 1);
  });
  await test("expired hold releases seats and cannot capture", async () => {
    const lab = new BookingLab({ capacity: 1 });
    const id = (await lab.reserve({ requestKey: "A", seats: 1 })).booking.id;
    lab.advance(11);
    assert.equal(lab.remaining(), 1);
    await assert.rejects(lab.capture(id, "CAP-1", 1500), /hold_not_active/);
  });
  await test("capture amount validated; webhook replay idempotent", async () => {
    const lab = new BookingLab({ capacity: 2 });
    const id = (await lab.reserve({ requestKey: "A", seats: 1 })).booking.id;
    await assert.rejects(lab.capture(id, "CAP-1", 1), /amount_mismatch/);
    assert.equal((await lab.capture(id, "CAP-1", 1500)).booking.status, "PAID");
    assert.equal((await lab.capture(id, "CAP-1", 1500)).replay, true);
    const other = (await lab.reserve({ requestKey: "B", seats: 1 })).booking.id;
    await assert.rejects(lab.capture(other, "CAP-1", 1500), /capture_replay_forbidden/);
  });
  await test("refund does not silently release ticket; cancellation does", async () => {
    const lab = new BookingLab({ capacity: 1 });
    const id = (await lab.reserve({ requestKey: "A", seats: 1 })).booking.id;
    await lab.capture(id, "CAP-1", 1500);
    await lab.refund(id, "REF-1");
    assert.equal(lab.remaining(), 0);
    assert.equal((await lab.refund(id, "REF-1")).replay, true);
    await lab.cancel(id);
    assert.equal(lab.remaining(), 1);
  });
  await test("idempotent request key and conflict rejection", async () => {
    const lab = new BookingLab({ capacity: 3 });
    const first = await lab.reserve({ requestKey: "retry", seats: 1 });
    const retry = await lab.reserve({ requestKey: "retry", seats: 1 });
    assert.equal(first.booking.id, retry.booking.id);
    assert.equal(retry.replay, true);
    await assert.rejects(lab.reserve({ requestKey: "retry", seats: 2 }), /idempotency_conflict/);
  });
  await test("manager comparison detects divergence", async () => {
    const lab = new BookingLab({ capacity: 2 });
    await lab.reserve({ requestKey: "A", seats: 1 });
    assert.equal(lab.managerComparison({ capacity: 2, booked: 1, remaining: 1 }).match, true);
    const mismatch = lab.managerComparison({ capacity: 2, booked: 0, remaining: 2 });
    assert.equal(mismatch.match, false);
    assert.equal(mismatch.diffs.length, 2);
  });
  console.log("TOTAL " + passed + " / " + passed + " simulated tests passed");
}
run().catch(e => { console.error(e); process.exitCode = 1; });
