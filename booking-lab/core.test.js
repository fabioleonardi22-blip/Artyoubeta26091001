"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {BookingLab} = require("./core");

test("capacity and last seat never overbook", async () => {
  const lab = new BookingLab([{id: "show", capacity: 1}]);
  const results = await Promise.all(Array.from({length: 100}, (_, i) =>
    Promise.resolve().then(() => lab.reserve({eventId: "show", requestId: "r" + i, customerId: "c" + i}))));
  assert.equal(results.filter(x => x.status === "pending_payment").length, 1);
  assert.equal(lab.report("show").available, 0);
});

test("idempotent reservation and request-key conflict", () => {
  const lab = new BookingLab([{id: "show", capacity: 2}]);
  const request = {eventId: "show", requestId: "one", customerId: "alice"};
  assert.deepEqual(lab.reserve(request), lab.reserve(request));
  assert.equal(lab.report("show").reserved, 1);
  assert.throws(() => lab.reserve({...request, customerId: "bob"}));
});

test("failed payment releases capacity and duplicate webhook ignored", () => {
  const lab = new BookingLab([{id: "show", capacity: 1}]);
  const b = lab.reserve({eventId: "show", requestId: "a", customerId: "alice"});
  assert.equal(lab.paymentWebhook({webhookId: "w1", bookingId: b.bookingId, outcome: "failed"}).status, "failed");
  assert.equal(lab.paymentWebhook({webhookId: "w1", bookingId: b.bookingId, outcome: "failed"}).status, "duplicate");
  assert.equal(lab.report("show").available, 1);
});

test("paid booking, partial and full refund reconcile", () => {
  const lab = new BookingLab([{id: "show", capacity: 1}]);
  const b = lab.reserve({eventId: "show", requestId: "a", customerId: "alice"});
  assert.equal(lab.paymentWebhook({webhookId: "w1", bookingId: b.bookingId, outcome: "paid", amountCents: 5000}).status, "paid");
  assert.equal(lab.refund({bookingId: b.bookingId, amountCents: 1000}).remainingCents, 4000);
  assert.equal(lab.report("show").reserved, 1);
  assert.equal(lab.refund({bookingId: b.bookingId, amountCents: 4000}).status, "refunded");
  assert.equal(lab.report("show").available, 1);
  assert.throws(() => lab.refund({bookingId: b.bookingId, amountCents: 1}));
});

test("invalid webhook cannot change booking", () => {
  const lab = new BookingLab([{id: "show", capacity: 1}]);
  const b = lab.reserve({eventId: "show", requestId: "a", customerId: "alice"});
  assert.throws(() => lab.paymentWebhook({webhookId: "w1", bookingId: b.bookingId, outcome: "paid", amountCents: -1}));
  assert.equal(lab.report("show").bookings[0].status, "pending_payment");
});
