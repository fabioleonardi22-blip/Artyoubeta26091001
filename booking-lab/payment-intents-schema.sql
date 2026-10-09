-- Lab-only: associate a server-created PayPal capture with the expected booking and amount.
-- Apply only after schema.sql, only on the dedicated artyou_booking_lab database.
CREATE TABLE IF NOT EXISTS lab_payment_intents (
  booking_id CHAR(36) PRIMARY KEY,
  paypal_order_id VARCHAR(100) NOT NULL UNIQUE,
  paypal_capture_id VARCHAR(100) NULL UNIQUE,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  expected_amount_cents BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT lab_payment_intents_booking_fk FOREIGN KEY (booking_id) REFERENCES lab_bookings(id),
  CONSTRAINT lab_payment_intents_amount_positive CHECK (expected_amount_cents > 0),
  CONSTRAINT lab_payment_intents_currency_eur CHECK (currency = 'EUR')
) ENGINE=InnoDB;
