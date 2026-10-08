/* ARYOU BOOKING LAB - SIMULAZIONE PURA: nessun accesso a database, PayPal o rete. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ArtyouBookingLab = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  class BookingLab {
    constructor(options) {
      const cfg = options || {};
      this.capacity = Number.isInteger(cfg.capacity) && cfg.capacity >= 0 ? cfg.capacity : 5;
      this.priceCents = Number.isInteger(cfg.priceCents) && cfg.priceCents >= 0 ? cfg.priceCents : 1500;
      this.holdMinutes = 10;
      this.clock = 0;
      this.bookings = new Map();
      this.keys = new Map();
      this.providerCaptures = new Map();
      this.providerRefunds = new Map();
      this.serialQueue = Promise.resolve();
      this.counter = 0;
    }
    serialize(fn) {
      const pending = this.serialQueue.then(fn, fn);
      this.serialQueue = pending.catch(function () {});
      return pending;
    }
    now() { return this.clock; }
    advance(minutes) {
      if (!Number.isFinite(minutes) || minutes < 0) throw new Error("invalid_time");
      this.clock += minutes * 60000;
      return this.snapshot();
    }
    counted(booking) {
      return booking.status === "PAID" || booking.status === "REFUNDED" ||
        (booking.status === "HELD" && booking.expiresAt > this.now());
    }
    remaining() {
      let used = 0;
      for (const booking of this.bookings.values()) if (this.counted(booking)) used += booking.seats;
      return this.capacity - used;
    }
    copy(booking) { return booking ? Object.assign({}, booking) : null; }
    snapshot() {
      const bookings = Array.from(this.bookings.values()).map(this.copy.bind(this));
      return { capacity: this.capacity, remaining: this.remaining(), booked: this.capacity - this.remaining(),
        bookings: bookings, now: this.now(), provider: "SIMULATED_ONLY" };
    }
    async reserve(data) {
      return this.serialize(() => {
        const input = data || {};
        const seats = input.seats;
        const key = String(input.requestKey || "").trim();
        if (!key || key.length > 100 || !Number.isInteger(seats) || seats < 1 || seats > 10)
          throw new Error("invalid_booking");
        const signature = String(seats);
        if (this.keys.has(key)) {
          const old = this.keys.get(key);
          if (old.signature !== signature) throw new Error("idempotency_conflict");
          return { ok: true, booking: this.copy(this.bookings.get(old.id)), replay: true };
        }
        if (this.remaining() < seats) return { ok: false, reason: "sold_out", remaining: this.remaining() };
        const booking = { id: "LAB-" + (++this.counter), seats: seats, amountCents: this.priceCents * seats,
          status: "HELD", expiresAt: this.now() + this.holdMinutes * 60000,
          captureId: null, refundId: null, requestKey: key };
        this.bookings.set(booking.id, booking);
        this.keys.set(key, { id: booking.id, signature: signature });
        return { ok: true, booking: this.copy(booking), replay: false };
      });
    }
    async capture(id, providerCaptureId, amountCents) {
      return this.serialize(() => {
        const b = this.bookings.get(id);
        if (!b) throw new Error("booking_not_found");
        const capture = String(providerCaptureId || "").trim();
        if (!capture) throw new Error("missing_provider_capture");
        if (b.status === "PAID" && b.captureId === capture) return { ok: true, booking: this.copy(b), replay: true };
        if (this.providerCaptures.has(capture)) throw new Error("capture_replay_forbidden");
        if (b.status !== "HELD" || b.expiresAt <= this.now()) throw new Error("hold_not_active");
        if (amountCents !== b.amountCents) throw new Error("amount_mismatch");
        b.status = "PAID";
        b.captureId = capture;
        this.providerCaptures.set(capture, id);
        return { ok: true, booking: this.copy(b), replay: false };
      });
    }
    async fail(id) {
      return this.serialize(() => {
        const b = this.bookings.get(id);
        if (!b || b.status !== "HELD") throw new Error("cannot_fail_booking");
        b.status = "FAILED";
        return this.copy(b);
      });
    }
    async refund(id, providerRefundId) {
      return this.serialize(() => {
        const b = this.bookings.get(id);
        if (!b) throw new Error("booking_not_found");
        const refund = String(providerRefundId || "").trim();
        if (!refund) throw new Error("missing_refund_reference");
        if (b.status === "REFUNDED" && b.refundId === refund) return { ok: true, booking: this.copy(b), replay: true };
        if (this.providerRefunds.has(refund)) throw new Error("refund_replay_forbidden");
        if (b.status !== "PAID") throw new Error("cannot_refund_unpaid");
        b.status = "REFUNDED";
        b.refundId = refund;
        this.providerRefunds.set(refund, id);
        return { ok: true, booking: this.copy(b), replay: false };
      });
    }
    async cancel(id) {
      return this.serialize(() => {
        const b = this.bookings.get(id);
        if (!b || (b.status !== "HELD" && b.status !== "REFUNDED")) throw new Error("cannot_cancel");
        b.status = "CANCELLED";
        return this.copy(b);
      });
    }
    managerComparison(manager) {
      const expected = this.snapshot();
      const actual = manager || {};
      const diffs = [];
      for (const field of ["capacity", "booked", "remaining"]) {
        if (actual[field] !== expected[field])
          diffs.push({ field: field, expected: expected[field], actual: actual[field] });
      }
      return { match: diffs.length === 0, diffs: diffs, expected: {
        capacity: expected.capacity, booked: expected.booked, remaining: expected.remaining
      } };
    }
  }
  return { BookingLab: BookingLab };
});
