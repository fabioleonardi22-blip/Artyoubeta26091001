"use strict";
// Read-only lookup of server-owned expected order details.
// Call only after signature verification and before any payment settlement.
async function expectedPayment(pool,{orderId}) {
  if(typeof orderId!=="string" || !/^[A-Za-z0-9_-]{5,100}$/.test(orderId)) throw Error("Invalid order ID");
  const [rows]=await pool.execute(
    "SELECT p.booking_id,p.paypal_order_id,p.currency,p.expected_amount_cents,b.status FROM lab_payment_intents p JOIN lab_bookings b ON b.id=p.booking_id WHERE p.paypal_order_id=?",
    [orderId]
  );
  if(rows.length!==1) throw Error("Unknown sandbox order");
  const row=rows[0];
  if(row.status!=="pending_payment") throw Error("Booking is not pending");
  const cents=Number(row.expected_amount_cents);
  if(!Number.isSafeInteger(cents)||cents<=0||row.currency!=="EUR") throw Error("Invalid expected payment");
  return {bookingId:row.booking_id,orderId:row.paypal_order_id,currency:row.currency,amountCents:cents};
}
module.exports={expectedPayment};
