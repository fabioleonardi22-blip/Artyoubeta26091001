-- Run ONLY against a dedicated, disposable MySQL test database.
-- Do not execute this script against the Artyou production schema.
CREATE TABLE IF NOT EXISTS lab_events (
 id VARCHAR(100) PRIMARY KEY,
 capacity INT NOT NULL,
 reserved INT NOT NULL DEFAULT 0,
 CHECK (capacity >= 0),
 CHECK (reserved >= 0 AND reserved <= capacity)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lab_bookings (
 id CHAR(36) PRIMARY KEY,
 event_id VARCHAR(100) NOT NULL,
 request_id VARCHAR(100) NOT NULL UNIQUE,
 customer_id VARCHAR(100) NOT NULL,
 status ENUM('pending_payment','paid','failed','partially_refunded','refunded') NOT NULL,
 original_amount_cents BIGINT NOT NULL DEFAULT 0,
 remaining_amount_cents BIGINT NOT NULL DEFAULT 0,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (event_id) REFERENCES lab_events(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS lab_webhooks (
 id VARCHAR(150) PRIMARY KEY,
 booking_id CHAR(36) NOT NULL,
 received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (booking_id) REFERENCES lab_bookings(id)
) ENGINE=InnoDB;
