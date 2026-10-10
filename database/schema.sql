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


-- Merchandising Artyou
CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_code VARCHAR(190) NOT NULL,
  name VARCHAR(255) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_code (product_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  color VARCHAR(120) NOT NULL DEFAULT '',
  size VARCHAR(120) NOT NULL DEFAULT '',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_qty INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_variant (product_id,color,size),
  KEY idx_variants_active_stock (active,stock_qty),
  CONSTRAINT fk_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Colonne order_number, customer_id, total_amount (merch_orders) e variant_id (merch_order_items):
-- scritte da railway-merch-server.js ma assenti dalla versione precedente di questo file.
-- Tipi ricavati dal codice: confrontarli con SHOW CREATE TABLE sul database di produzione.
CREATE TABLE IF NOT EXISTS merch_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(190) NULL,
  customer_id BIGINT UNSIGNED NULL,
  total_amount DECIMAL(10,2) NULL,
  order_code VARCHAR(190) NOT NULL,
  ordered_at DATETIME NULL,
  status VARCHAR(80) NOT NULL DEFAULT 'Riservato',
  customer_name VARCHAR(255) NULL,
  phone VARCHAR(100) NULL,
  email VARCHAR(254) NULL,
  venue VARCHAR(190) NULL,
  pieces INT UNSIGNED NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  returned_pieces INT UNSIGNED NOT NULL DEFAULT 0,
  payment_method VARCHAR(120) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_merch_orders_code (order_code),
  KEY idx_merch_orders_status_date (status,ordered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS merch_order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  variant_id BIGINT UNSIGNED NULL,
  product_variant_id BIGINT UNSIGNED NULL,
  item_key VARCHAR(500) NULL,
  description VARCHAR(500) NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_variant (product_variant_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES merch_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_variant FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_variant_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  movement_type ENUM('IMPORT','SALE','RESERVE','RELEASE','RETURN','ADJUSTMENT') NOT NULL,
  quantity_delta INT NOT NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_variant_date (product_variant_id,created_at),
  KEY idx_inventory_order (order_id),
  CONSTRAINT fk_inventory_variant FOREIGN KEY (product_variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_order FOREIGN KEY (order_id) REFERENCES merch_orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Audit delle operazioni sensibili nelle aree interne
CREATE TABLE IF NOT EXISTS security_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_email VARCHAR(254) NULL,
  actor_role VARCHAR(32) NULL,
  action VARCHAR(120) NOT NULL,
  resource VARCHAR(190) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_security_audit_date (created_at),
  KEY idx_security_audit_actor (actor_email, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS security_rate_limits (
  bucket_key CHAR(64) NOT NULL,
  request_count INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (bucket_key),
  KEY idx_security_rate_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Identità esterne: l'autorizzazione usa il subject Google immutabile, non l'email.
CREATE TABLE IF NOT EXISTS auth_identities (
  provider VARCHAR(32) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  user_id BIGINT NOT NULL,
  email_at_link VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (provider,subject),
  UNIQUE KEY uq_auth_identity_user (provider,user_id),
  KEY idx_auth_identity_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sessioni opache lato server. Nel browser non viene conservato il Google ID token.
CREATE TABLE IF NOT EXISTS auth_sessions (
  session_hash CHAR(64) NOT NULL,
  user_id BIGINT NOT NULL,
  google_subject VARCHAR(255) NOT NULL,
  google_email VARCHAR(255) NOT NULL,
  google_name VARCHAR(255) NULL,
  google_picture TEXT NULL,
  google_credential TEXT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_hash),
  KEY idx_auth_sessions_user (user_id),
  KEY idx_auth_sessions_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
