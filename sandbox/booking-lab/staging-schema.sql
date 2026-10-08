-- DESIGN ONLY. NON ESEGUIRE SUL DATABASE DI PRODUZIONE.
-- Eseguire solo su un MySQL 8+ di staging con credenziali e account separati.
-- Nome tabelle prefissato lab_ per rendere visibile la destinazione.

CREATE TABLE IF NOT EXISTS lab_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(190) NOT NULL UNIQUE,
  capacity INT UNSIGNED NOT NULL,
  price_cents INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lab_bookings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id CHAR(36) NOT NULL UNIQUE,
  event_id BIGINT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(190) NOT NULL UNIQUE,
  request_fingerprint CHAR(64) NOT NULL,
  seats INT UNSIGNED NOT NULL,
  amount_cents INT UNSIGNED NOT NULL,
  booking_status ENUM('HELD','CAPTURING','CONFIRMED','EXPIRED','CANCELLED') NOT NULL,
  payment_status ENUM('NOT_REQUIRED','PENDING','PAID','FAILED','REFUNDING','REFUNDED','PARTIALLY_REFUNDED') NOT NULL DEFAULT 'PENDING',
  hold_expires_at DATETIME NULL,
  provider_order_id VARCHAR(255) NULL UNIQUE,
  provider_capture_id VARCHAR(255) NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_lab_bookings_inventory (event_id,booking_status,hold_expires_at),
  CONSTRAINT fk_lab_bookings_event FOREIGN KEY (event_id) REFERENCES lab_events(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lab_provider_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  provider_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  booking_id BIGINT UNSIGNED NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload JSON NULL,
  UNIQUE KEY uq_lab_provider_event (provider,provider_event_id),
  CONSTRAINT fk_lab_provider_event_booking FOREIGN KEY (booking_id) REFERENCES lab_bookings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lab_refunds (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL,
  provider_refund_id VARCHAR(255) NOT NULL UNIQUE,
  amount_cents INT UNSIGNED NOT NULL,
  status ENUM('PENDING','COMPLETED','FAILED') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lab_refunds_booking FOREIGN KEY (booking_id) REFERENCES lab_bookings(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Algoritmo da implementare nell'API staging:
-- 1. BEGIN
-- 2. SELECT id,capacity,price_cents FROM lab_events WHERE id=? AND active=1 FOR UPDATE
--    (serializza le prenotazioni dello stesso evento su tutte le istanze Vercel)
-- 3. Cerca idempotency_key e confronta request_fingerprint: stessa richiesta -> stesso esito;
--    diversa richiesta con stessa chiave -> 409.
-- 4. SELECT SUM(seats) FROM lab_bookings WHERE event_id=? AND
--    (booking_status IN ('CONFIRMED','CAPTURING') OR
--     (booking_status='HELD' AND hold_expires_at>UTC_TIMESTAMP()))
-- 5. Se somma + nuovi posti > capacity: ROLLBACK, 409 SOLD_OUT.
-- 6. Calcola importo SOLO dal listino MySQL e crea HELD con scadenza.
-- 7. COMMIT, poi chiama PayPal Sandbox Orders API FUORI dalla transazione.
-- 8. Verifica la capture PayPal server-side (amount/currency/order/status),
--    poi applica la transizione di stato in una nuova transazione idempotente.
-- 9. Riconcilia order/capture in caso di timeout o crash tra PayPal e MySQL.
-- 10. Rimborsi verificati dal provider, mai fidarsi di eventi browser o URL di ritorno.
-- Attenzione: per RIF/YEP con risorse multiple serve anche lock e inventario per singola
-- risorsa/workshop/data; il lock evento qui è solo un prototipo per evento singolo.
