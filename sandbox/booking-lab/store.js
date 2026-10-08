"use strict";
const {randomUUID,createHash}=require("node:crypto");
class LabError extends Error {
  constructor(code,status=409){super(code);this.code=code;this.status=status;}
}
const fail=(code,status)=>{throw new LabError(code,status);};
function fingerprint(eventSlug,seats){return createHash("sha256").update(JSON.stringify({eventSlug,seats})).digest("hex");}
function format(b){
  if(!b)return null;
  return {id:b.public_id,eventId:Number(b.event_id),seats:Number(b.seats),
    amountCents:Number(b.amount_cents),currency:"EUR",status:b.booking_status,
    paymentStatus:b.payment_status,expiresAt:b.hold_expires_at,
    orderId:b.provider_order_id||null,captureId:b.provider_capture_id||null};
}
function createStore(pool) {
  async function transaction(fn) {
    const conn=await pool.getConnection();
    try {await conn.beginTransaction();const result=await fn(conn);await conn.commit();return result;}
    catch(e){try{await conn.rollback();}catch(_){}throw e;}
    finally{conn.release();}
  }
  async function lockedBooking(conn,id) {
    const [ids]=await conn.execute("SELECT event_id FROM lab_bookings WHERE public_id=?",[id]);
    if(!ids.length)fail("booking_not_found",404);
    await conn.execute("SELECT id FROM lab_events WHERE id=? FOR UPDATE",[ids[0].event_id]);
    const [rows]=await conn.execute("SELECT * FROM lab_bookings WHERE public_id=? FOR UPDATE",[id]);
    if(!rows.length)fail("booking_not_found",404);
    return rows[0];
  }
  async function reserve(input) {
    const slug=String(input.eventSlug||"").trim();
    const key=String(input.requestKey||"").trim();
    const seats=input.seats;
    if(!/^[a-z0-9][a-z0-9-]{0,180}$/i.test(slug) || key.length<8 || key.length>190 ||
      !Number.isInteger(seats)||seats<1||seats>10)fail("invalid_reservation",400);
    const hash=fingerprint(slug,seats);
    return transaction(async conn=>{
      const [events]=await conn.execute("SELECT * FROM lab_events WHERE slug=? AND active=1 FOR UPDATE",[slug]);
      if(!events.length)fail("event_not_found",404);
      const e=events[0];
      const [prior]=await conn.execute("SELECT * FROM lab_bookings WHERE idempotency_key=?",[key]);
      if(prior.length){
        if(prior[0].request_fingerprint!==hash)fail("idempotency_conflict");
        return {booking:format(prior[0]),replay:true};
      }
      const [sum]=await conn.execute(
        "SELECT COALESCE(SUM(seats),0) AS taken FROM lab_bookings WHERE event_id=? AND (booking_status IN ('CONFIRMED','CAPTURING') OR (booking_status='HELD' AND hold_expires_at>UTC_TIMESTAMP()))",
        [e.id]);
      if(Number(sum[0].taken)+seats>Number(e.capacity))fail("sold_out");
      const id=randomUUID();
      await conn.execute(
        "INSERT INTO lab_bookings (public_id,event_id,idempotency_key,request_fingerprint,seats,amount_cents,booking_status,payment_status,hold_expires_at) VALUES (?,?,?,?,?,?,'HELD','PENDING',DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))",
        [id,e.id,key,hash,seats,Number(e.price_cents)*seats]);
      const [rows]=await conn.execute("SELECT * FROM lab_bookings WHERE public_id=?",[id]);
      return {booking:format(rows[0]),replay:false};
    });
  }
  async function availability(slug){
    const [rows]=await pool.execute(
      "SELECT e.slug,e.capacity,e.price_cents,COALESCE(SUM(CASE WHEN b.booking_status IN ('CONFIRMED','CAPTURING') OR (b.booking_status='HELD' AND b.hold_expires_at>UTC_TIMESTAMP()) THEN b.seats ELSE 0 END),0) AS booked FROM lab_events e LEFT JOIN lab_bookings b ON b.event_id=e.id WHERE e.slug=? AND e.active=1 GROUP BY e.id",
      [slug]);
    if(!rows.length)fail("event_not_found",404);
    return {slug:rows[0].slug,capacity:Number(rows[0].capacity),
      booked:Number(rows[0].booked),remaining:Number(rows[0].capacity)-Number(rows[0].booked),
      priceCents:Number(rows[0].price_cents)};
  }
  async function booking(id){
    const [rows]=await pool.execute("SELECT * FROM lab_bookings WHERE public_id=?",[id]);
    if(!rows.length)fail("booking_not_found",404);
    return format(rows[0]);
  }
  async function setOrder(id,orderId){
    if(!orderId||orderId.length>255)fail("invalid_order",400);
    return transaction(async conn=>{
      const b=await lockedBooking(conn,id);
      if(b.provider_order_id && b.provider_order_id!==orderId)fail("order_conflict");
      if(b.booking_status!=="HELD" || new Date(b.hold_expires_at).getTime()<=Date.now())fail("hold_expired");
      await conn.execute("UPDATE lab_bookings SET provider_order_id=? WHERE public_id=?",[orderId,id]);
      return format(Object.assign({},b,{provider_order_id:orderId}));
    });
  }
  async function startCapture(id){
    return transaction(async conn=>{
      const b=await lockedBooking(conn,id);
      if(b.booking_status==="CONFIRMED" && b.payment_status==="PAID")return {booking:format(b),replay:true};
      if(b.booking_status==="CAPTURING")return {booking:format(b),pending:true};
      if(b.booking_status!=="HELD"||new Date(b.hold_expires_at).getTime()<=Date.now()||!b.provider_order_id)fail("capture_not_allowed");
      await conn.execute("UPDATE lab_bookings SET booking_status='CAPTURING' WHERE public_id=?",[id]);
      return {booking:format(Object.assign({},b,{booking_status:"CAPTURING"}))};
    });
  }
  async function confirmCapture(id,capture){
    return transaction(async conn=>{
      const b=await lockedBooking(conn,id);
      if(b.booking_status==="CONFIRMED" && b.provider_capture_id===capture.id)return format(b);
      if(b.booking_status!=="CAPTURING")fail("capture_not_started");
      if(capture.status!=="COMPLETED"||capture.currency!=="EUR"||capture.amountCents!==Number(b.amount_cents))
        fail("capture_verification_failed");
      await conn.execute(
        "UPDATE lab_bookings SET booking_status='CONFIRMED',payment_status='PAID',provider_capture_id=? WHERE public_id=?",
        [capture.id,id]);
      return format(Object.assign({},b,{booking_status:"CONFIRMED",payment_status:"PAID",provider_capture_id:capture.id}));
    });
  }
  async function failCapture(id){
    return transaction(async conn=>{
      const b=await lockedBooking(conn,id);
      if(b.booking_status!=="CAPTURING")fail("capture_not_pending");
      await conn.execute("UPDATE lab_bookings SET booking_status='CANCELLED',payment_status='FAILED' WHERE public_id=?",[id]);
      return {cancelled:true};
    });
  }
  async function startRefund(id){
    return transaction(async conn=>{
      const b=await lockedBooking(conn,id);
      if(b.payment_status==="REFUNDED")return {booking:format(b),replay:true};
      if(b.payment_status==="REFUNDING")return {booking:format(b),pending:true};
      if(b.booking_status!=="CONFIRMED"||b.payment_status!=="PAID"||!b.provider_capture_id)fail("refund_not_allowed");
      await conn.execute("UPDATE lab_bookings SET payment_status='REFUNDING' WHERE public_id=?",[id]);
      return {booking:format(Object.assign({},b,{payment_status:"REFUNDING"}))};
    });
  }
  async function pendingRefund(id){
    const [rows]=await pool.execute(
      "SELECT r.provider_refund_id,r.status FROM lab_refunds r JOIN lab_bookings b ON b.id=r.booking_id WHERE b.public_id=? ORDER BY r.id DESC LIMIT 1",[id]);
    return rows[0]||null;
  }
  async function recordRefund(id,refund){
    if(!refund?.id||!["PENDING","COMPLETED"].includes(refund.status))fail("invalid_provider_refund");
    return transaction(async conn=>{
      const b=await lockedBooking(conn,id);
      if(!["REFUNDING","REFUNDED"].includes(b.payment_status))fail("refund_not_started");
      if(refund.amountCents!==Number(b.amount_cents)||refund.currency!=="EUR")fail("refund_amount_mismatch");
      await conn.execute(
        "INSERT INTO lab_refunds (booking_id,provider_refund_id,amount_cents,status) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status)",
        [b.id,refund.id,refund.amountCents,refund.status]);
      return {recorded:true};
    });
  }
  async function confirmRefund(id,refund){
    return transaction(async conn=>{
      const b=await lockedBooking(conn,id);
      if(b.payment_status==="REFUNDED"){
        const [prior]=await conn.execute("SELECT provider_refund_id FROM lab_refunds WHERE booking_id=?",[b.id]);
        if(prior.some(x=>x.provider_refund_id===refund.id))return format(b);
        fail("refund_conflict");
      }
      if(b.payment_status!=="REFUNDING"||refund.status!=="COMPLETED"||refund.amountCents!==Number(b.amount_cents)||refund.currency!=="EUR")
        fail("refund_verification_failed");
      await conn.execute(
        "INSERT INTO lab_refunds (booking_id,provider_refund_id,amount_cents,status) VALUES (?,?,?,'COMPLETED') ON DUPLICATE KEY UPDATE status='COMPLETED'",
        [b.id,refund.id,refund.amountCents]);
      await conn.execute("UPDATE lab_bookings SET payment_status='REFUNDED' WHERE public_id=?",[id]);
      return format(Object.assign({},b,{payment_status:"REFUNDED"}));
    });
  }
  async function cancel(id){
    return transaction(async conn=>{
      const b=await lockedBooking(conn,id);
      if(b.booking_status==="CANCELLED")return format(b);
      if(b.payment_status==="PAID"||b.payment_status==="REFUNDING"||b.booking_status==="CAPTURING")fail("cancel_requires_settlement");
      if(!["HELD","CONFIRMED"].includes(b.booking_status))fail("cannot_cancel");
      await conn.execute("UPDATE lab_bookings SET booking_status='CANCELLED' WHERE public_id=?",[id]);
      return format(Object.assign({},b,{booking_status:"CANCELLED"}));
    });
  }
  return {reserve,availability,booking,setOrder,startCapture,confirmCapture,failCapture,startRefund,pendingRefund,recordRefund,confirmRefund,cancel};
}
module.exports={createStore,LabError};
