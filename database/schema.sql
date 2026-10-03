-- Artyou Roma - schema MySQL 8+
-- Prima fase: eventi, prenotazioni, pagamenti, check-in.
-- Le colonne metadata permettono di conservare campi specifici di RIF/YEP/WorkshoW
-- durante la migrazione senza perdere informazioni.

CREATE TABLE IF NOT EXISTS events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(190) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NULL,
  event_type VARCHAR(100) NULL,
  description TEXT NULL,
  poster_url TEXT NULL,
  venue VARCHAR(255) NULL,
  address VARCHAR(500) NULL,
  maps_query VARCHAR(500) NULL,
  price DECIMAL(10,2) NULL,
  capacity INT UNSIGNED NOT NULL DEFAULT 0,
  online_payment TINYINT(1) NOT NULL DEFAULT 0,
  tbd TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 100,
  metadata JSON NULL,
  source_updated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_events_slug (slug),
  KEY idx_events_active_order (active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_dates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  starts_at DATETIME NULL,
  date_label VARCHAR(255) NULL,
  capacity_override INT UNSIGNED NULL,
  price_override DECIMAL(10,2) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_event_dates_event (event_id),
  KEY idx_event_dates_start (starts_at),
  CONSTRAINT fk_event_dates_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(190) NOT NULL,
  event_id BIGINT UNSIGNED NOT NULL,
  event_date_id BIGINT UNSIGNED NULL,
  first_name VARCHAR(190) NULL,
  last_name VARCHAR(190) NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(100) NULL,
  seats INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('HOLD','RISERVATO','PAGATO','SCADUTO','ANNULLATO') NOT NULL DEFAULT 'RISERVATO',
  hold_expires_at DATETIME NULL,
  checkin_code VARCHAR(190) NULL,
  checked_in_at DATETIME NULL,
  privacy_accepted TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_public_id (public_id),
  UNIQUE KEY uq_bookings_checkin_code (checkin_code),
  KEY idx_bookings_event_status (event_id, status),
  KEY idx_bookings_hold (status, hold_expires_at),
  KEY idx_bookings_email (email),
  CONSTRAINT fk_bookings_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_event_date FOREIGN KEY (event_date_id) REFERENCES event_dates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(50) NOT NULL,
  provider_reference VARCHAR(255) NULL,
  amount DECIMAL(10,2) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  status VARCHAR(50) NOT NULL,
  payload JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_booking (booking_id),
  KEY idx_payments_provider_ref (provider, provider_reference),
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(254) NOT NULL,
  display_name VARCHAR(255) NULL,
  role ENUM('admin','staff','teacher') NOT NULL DEFAULT 'teacher',
  active TINYINT(1) NOT NULL DEFAULT 1,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operational_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NULL,
  area VARCHAR(120) NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  owner_user_id BIGINT UNSIGNED NULL,
  due_at DATETIME NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'DA_FARE',
  google_calendar_event_id VARCHAR(255) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tasks_due (due_at, status),
  CONSTRAINT fk_tasks_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
