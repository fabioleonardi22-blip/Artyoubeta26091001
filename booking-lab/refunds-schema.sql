-- Lab-only migration. Execute ONLY on the dedicated ar you_booking_lab schema.
-- Refund idempotency ledger; settlement logic to be added in a subsequent commit.
CREATE TABLE IF NOT EXISTS lab_refunds (
 id VARCHAR(100) PRIMARY KEY,
 booking_id CHAR(36) NOT NULL,
 amount_cents BIGINT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (booking_id) REFERENCES lab_bookings(id),
 CHECK (amount_cents > 0)
) ENGINE=InnoDB;
