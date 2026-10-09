"use strict";
const {randomUUID} = require("node:crypto");
function assertLabConfig(config) {
  if (process.env.BOOKING_LAB_ENABLED !== "true") throw Error("Booking lab disabled");
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") throw Error("Production environment forbidden");
  if (!config || !/^artyou_booking_lab(?:_[a-z0-9_]+)?$/i.test(config.database || "")) throw Error("Dedicated lab database name required");
}
function createLabPool() {
  const mysql = require("mysql2/promise");
  const config = {host:process.env.LAB_MYSQL_HOST,port:Number(process.env.LAB_MYSQL_PORT || 3306),user:process.env.LAB_MYSQL_USER,password:process.env.LAB_MYSQL_PASSWORD,database:process.env.LAB_MYSQL_DATABASE,waitForConnections:true,connectionLimit:3};
  assertLabConfig(config);
  if (!config.host || !config.user || !config.password) throw Error("Missing isolated lab credentials");
  return mysql.createPool(config);
}
const validId = x => typeof x === "string" && x.length > 0 && x.length <= 100;
async function inTransaction(pool, fn) {
  const db = await pool.getConnection();
  try { await db.beginTransaction(); const result = await fn(db); await db.commit(); return result; }
  catch (e) { await db.rollback(); throw e; }
  finally { db.release(); }
}
async function reserve(pool,{eventId,requestId,customerId}) {
  if (![eventId,requestId,customerId].every(validId)) throw Error("Invalid request");
  return inTransaction(pool,async db=>{
    const [events] = await db.execute("SELECT capacity,reserved FROM lab_events WHERE id=? FOR UPDATE",[eventId]);
    if (!events.length) throw Error("Unknown event");
    const [prior] = await db.execute("SELECT id,event_id,customer_id,status FROM lab_bookings WHERE request_id=?",[requestId]);
    if (prior.length) {
      if (prior[0].event_id!==eventId || prior[0].customer_id!==customerId) throw Error("Idempotency conflict");
      return {status:prior[0].status,bookingId:prior[0].id};
    }
    if (events[0].reserved>=events[0].capacity) return {status:"sold_out"};
    const bookingId=randomUUID();
    await db.execute("UPDATE lab_events SET reserved=reserved+1 WHERE id=?",[eventId]);
    await db.execute("INSERT INTO lab_bookings (id,event_id,request_id,customer_id,status) VALUES (?,?,?,?, 'pending_payment')",[bookingId,eventId,requestId,customerId]);
    return {status:"pending_payment",bookingId};
  });
}
// Call only after verifying PayPal's webhook signature, environment, resource and amount.
async function settlePayment(pool,{bookingId,webhookId,outcome,amountCents}) {
  if (![bookingId,webhookId].every(validId) || !["paid","failed"].includes(outcome)) throw Error("Invalid settlement");
  if (outcome==="paid" && (!Number.isSafeInteger(amountCents)||amountCents<=0)) throw Error("Invalid amount");
  return inTransaction(pool,async db=>{
    const [rows]=await db.execute("SELECT event_id,status FROM lab_bookings WHERE id=? FOR UPDATE",[bookingId]);
    if (!rows.length) throw Error("Unknown booking");
    const [duplicate]=await db.execute("SELECT id FROM lab_webhooks WHERE id=?",[webhookId]);
    if (duplicate.length) return {status:"duplicate"};
    if (rows[0].status!=="pending_payment") throw Error("Booking not pending");
    await db.execute("INSERT INTO lab_webhooks (id,booking_id) VALUES (?,?)",[webhookId,bookingId]);
    if (outcome==="failed") {
      await db.execute("UPDATE lab_bookings SET status='failed' WHERE id=?",[bookingId]);
      await db.execute("UPDATE lab_events SET reserved=reserved-1 WHERE id=?",[rows[0].event_id]);
    } else {
      await db.execute("UPDATE lab_bookings SET status='paid',original_amount_cents=?,remaining_amount_cents=? WHERE id=?",[amountCents,amountCents,bookingId]);
    }
    return {status:outcome};
  });
}
// Only after a confirmed PayPal refund; refundId must be the provider's stable ID.
async function recordRefund(pool,{bookingId,refundId,amountCents}) {
  if (![bookingId,refundId].every(validId)||!Number.isSafeInteger(amountCents)||amountCents<=0) throw Error("Invalid refund");
  return inTransaction(pool,async db=>{
    const [rows]=await db.execute("SELECT event_id,status,remaining_amount_cents FROM lab_bookings WHERE id=? FOR UPDATE",[bookingId]);
    if (!rows.length) throw Error("Unknown booking");
    const [prior]=await db.execute("SELECT booking_id,amount_cents FROM lab_refunds WHERE id=?",[refundId]);
    if (prior.length) {
      if (prior[0].booking_id!==bookingId || Number(prior[0].amount_cents)!==amountCents) throw Error("Refund idempotency conflict");
      return {status:"duplicate"};
    }
    const b=rows[0],remaining=Number(b.remaining_amount_cents);
    if (!["paid","partially_refunded"].includes(b.status)||amountCents>remaining) throw Error("Not refundable");
    const next=remaining-amountCents;
    await db.execute("INSERT INTO lab_refunds (id,booking_id,amount_cents) VALUES (?,?,?)",[refundId,bookingId,amountCents]);
    await db.execute("UPDATE lab_bookings SET status=?,remaining_amount_cents=? WHERE id=?",[next===0?"refunded":"partially_refunded",next,bookingId]);
    if (next===0) await db.execute("UPDATE lab_events SET reserved=reserved-1 WHERE id=?",[b.event_id]);
    return {status:next===0?"refunded":"partially_refunded",remainingCents:next};
  });
}
module.exports={assertLabConfig,createLabPool,reserve,settlePayment,recordRefund};
