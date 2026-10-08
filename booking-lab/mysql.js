"use strict";
const {randomUUID} = require("node:crypto");

/**
 * Use a pool created with LAB_MYSQL_* credentials scoped to a disposable schema.
 * The caller MUST NOT pass a production connection pool.
 */
function assertLabConfig(config) {
  if (process.env.BOOKING_LAB_ENABLED !== "true") throw Error("Booking lab disabled");
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") throw Error("Production environment forbidden");
  if (!config || !config.database || !/^artyou_booking_lab(?:_[a-z0-9_]+)?$/i.test(config.database)) {
    throw Error("Dedicated lab database name required");
  }
}
function createLabPool() {
  const mysql = require("mysql2/promise");
  const config = {
    host: process.env.LAB_MYSQL_HOST,
    port: Number(process.env.LAB_MYSQL_PORT || 3306),
    user: process.env.LAB_MYSQL_USER,
    password: process.env.LAB_MYSQL_PASSWORD,
    database: process.env.LAB_MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 3
  };
  assertLabConfig(config);
  if (!config.host || !config.user || !config.password) throw Error("Missing isolated lab credentials");
  return mysql.createPool(config);
}

async function reserve(pool, {eventId, requestId, customerId}) {
  if (![eventId, requestId, customerId].every(x => typeof x === "string" && x.length > 0 && x.length <= 100)) throw Error("Invalid request");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Serialize by event row to prevent simultaneous reservations exceeding capacity.
    const [events] = await connection.execute("SELECT capacity, reserved FROM lab_events WHERE id=? FOR UPDATE", [eventId]);
    if (!events.length) throw Error("Unknown event");
    const [existing] = await connection.execute("SELECT id, event_id, customer_id, status FROM lab_bookings WHERE request_id=?", [requestId]);
    if (existing.length) {
      if (existing[0].event_id !== eventId || existing[0].customer_id !== customerId) throw Error("Idempotency conflict");
      await connection.commit();
      return {status: existing[0].status, bookingId: existing[0].id};
    }
    if (events[0].reserved >= events[0].capacity) {
      await connection.commit();
      return {status: "sold_out"};
    }
    const bookingId = randomUUID();
    await connection.execute("UPDATE lab_events SET reserved=reserved+1 WHERE id=?", [eventId]);
    await connection.execute("INSERT INTO lab_bookings (id,event_id,request_id,customer_id,status) VALUES (?,?,?,?, 'pending_payment')", [bookingId,eventId,requestId,customerId]);
    await connection.commit();
    return {status: "pending_payment", bookingId};
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {assertLabConfig, createLabPool, reserve};
