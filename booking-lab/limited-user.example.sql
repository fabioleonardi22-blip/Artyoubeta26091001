-- Run only against a fresh MySQL 8.4 instance for the booking laboratory.
-- Generate the password in Railway's protected variable editor; never commit it.
-- The MySQL server must have already created artyou_booking_lab via MYSQL_DATABASE.
-- Replace LAB_USER_PASSWORD_PLACEHOLDER locally before executing; never commit a real secret.
-- Replace the placeholder with a strong password before running; do not execute unchanged.
CREATE USER IF NOT EXISTS 'artyou_lab_app'@'%' IDENTIFIED BY 'LAB_USER_PASSWORD_PLACEHOLDER';
GRANT SELECT, INSERT, UPDATE, DELETE ON artyou_booking_lab.* TO 'artyou_lab_app'@'%';
-- Migrations must be run by a separate administrator, not this application user.
-- Run schema.sql and refunds-schema.sql as the migration administrator.
