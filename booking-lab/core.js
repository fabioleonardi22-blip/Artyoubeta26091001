"use strict";

/**
 * In-memory booking lab. No network, production DB, PayPal or mail integration.
 * Repository is intentionally disposable and suitable for deterministic tests.
 */
class BookingLab {
  constructor(events) {
    this.events = new Map(events.map(({id, capacity}) => {
      if (!id || !Number.isSafeInteger(capacity) || capacity < 0) throw Error("Invalid event");
      return [id, {capacity, reserved: 0}];
    }));
    this.bookings = new Map();
    this.requests = new Map();
    this.webhooks = new Set();
    this.sequence = 0;
  }

  reserve({eventId, requestId, customerId}) {
    if (!requestId || !customerId) throw Error("Missing request/customer ID");
    const fingerprint = JSON.stringify([eventId, customerId]);
    const existing = this.requests.get(requestId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw Error("Idempotency key reused for another request");
      return {...existing.result};
    }
    const event = this.events.get(eventId);
    if (!event) throw Error("Unknown event");
    const result = event.reserved >= event.capacity
      ? {status: "sold_out", eventId}
      : {status: "pending_payment", eventId, bookingId: "lab-" + (++this.sequence)};
    if (result.bookingId) {
      event.reserved++;
      this.bookings.set(result.bookingId, {...result, customerId, paidCents: 0});
    }
    this.requests.set(requestId, {fingerprint, result});
    return {...result};
  }

  paymentWebhook({webhookId, bookingId, outcome, amountCents}) {
    if (!webhookId) throw Error("Missing webhook ID");
    if (this.webhooks.has(webhookId)) return {status: "duplicate"};
    const booking = this.bookings.get(bookingId);
    if (!booking) throw Error("Unknown booking");
    if (!["paid", "failed"].includes(outcome)) throw Error("Invalid outcome");
    if (booking.status !== "pending_payment") throw Error("Booking not pending");
    if (outcome === "paid" && (!Number.isSafeInteger(amountCents) || amountCents <= 0)) throw Error("Invalid amount");
    this.webhooks.add(webhookId);
    booking.status = outcome;
    if (outcome === "paid") booking.paidCents = amountCents;
    else this.events.get(booking.eventId).reserved--;
    return {status: booking.status};
  }

  refund({bookingId, amountCents}) {
    const booking = this.bookings.get(bookingId);
    if (!booking || !["paid", "partially_refunded"].includes(booking.status)) throw Error("Not refundable");
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > booking.paidCents) throw Error("Invalid refund");
    booking.paidCents -= amountCents;
    booking.status = booking.paidCents === 0 ? "refunded" : "partially_refunded";
    if (booking.status === "refunded") this.events.get(booking.eventId).reserved--;
    return {status: booking.status, remainingCents: booking.paidCents};
  }

  report(eventId) {
    const event = this.events.get(eventId);
    if (!event) throw Error("Unknown event");
    return {capacity: event.capacity, reserved: event.reserved, available: event.capacity - event.reserved,
      bookings: [...this.bookings.values()].filter(b => b.eventId === eventId).map(b => ({...b}))};
  }
}

module.exports = {BookingLab};
