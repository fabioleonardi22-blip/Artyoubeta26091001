"use strict";
// Deliberately closed until a dedicated test DB and PayPal Sandbox secrets are configured.
// This endpoint never updates production bookings.
module.exports = async function handler(req,res) {
  res.setHeader("Cache-Control","no-store");
  if (req.method!=="POST") { res.setHeader("Allow","POST"); return res.status(405).json({error:"method_not_allowed"}); }
  if (process.env.BOOKING_LAB_ENABLED!=="true" || process.env.VERCEL_ENV==="production" || process.env.NODE_ENV==="production") {
    return res.status(503).json({error:"booking_lab_disabled"});
  }
  // Acknowledging a webhook without persisting it would lose payment events.
  // Until signed verification, expected-order lookup, and atomic settlement are wired,
  // reject delivery so PayPal can retry instead of falsely returning HTTP 200.
  return res.status(503).json({error:"webhook_not_ready"});
};
