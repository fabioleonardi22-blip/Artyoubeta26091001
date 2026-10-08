# Booking Lab — integration boundaries

This branch is isolated from the Artyou public site and the operational dashboard.

## Verified infrastructure
- Railway service: `artyou-booking-lab-mysql` in project `talented-radiance`.
- Schema: `artyou_booking_lab`.
- Existing tables: `lab_events`, `lab_bookings`, `lab_webhooks`, `lab_refunds`, `lab_payment_intents`.
- The production MySQL service and the existing dashboard must remain unchanged.

## Integration order
1. Diagnose `mysql_unavailable` on the existing dashboard using the **existing** production connection; never replace its database URL with the lab database.
2. Inventory actual source-of-truth records and APIs for shows, events, WorkshoW, RIF, YEP and “Un vortice di emozioni”.
3. Create a **read-only, sanitized copy** of selected events into the lab, with a mapping of source identifiers and explicit capacity checks. Do not copy customer personal data or payment credentials.
4. Add isolated store schema and tests for products, variants, stock reservations, carts and orders; do not attach real payment providers until Sandbox verification is complete.
5. Exercise concurrent reservations, sold-out behavior, webhook signature validation, refunds and stock reconciliation.
6. Only after tests pass, plan a reviewed production migration with backup and rollback.

## Safety requirements
- Never connect the public dashboard or production APIs to `artyou_booking_lab`.
- Do not use live PayPal or Stripe credentials in the lab.
- No direct browser-to-MySQL connection.
- No real event edits, inventory updates, bookings or payment actions from this branch.
- Migrations must reject production environments and schemas.
