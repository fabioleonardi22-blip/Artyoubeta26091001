"use strict";
// Sandbox-only PayPal verification helper. Never expose credentials to browsers.
const BASE = "https://api-m.sandbox.paypal.com";
function assertSandbox() {
  if (process.env.BOOKING_LAB_ENABLED !== "true" || process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") throw Error("Sandbox disabled");
  if (!process.env.LAB_PAYPAL_CLIENT_ID || !process.env.LAB_PAYPAL_CLIENT_SECRET || !process.env.LAB_PAYPAL_WEBHOOK_ID) throw Error("Missing sandbox credentials");
}
async function accessToken(fetchImpl=fetch) {
  assertSandbox();
  const basic=Buffer.from(process.env.LAB_PAYPAL_CLIENT_ID+":"+process.env.LAB_PAYPAL_CLIENT_SECRET).toString("base64");
  const response=await fetchImpl(BASE+"/v1/oauth2/token",{method:"POST",headers:{Authorization:"Basic "+basic,"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});
  if (!response.ok) throw Error("Sandbox token request failed");
  const data=await response.json();
  if (!data.access_token) throw Error("Missing access token");
  return data.access_token;
}
async function verifyWebhook(headers, event, fetchImpl=fetch) {
  assertSandbox();
  const required=["paypal-auth-algo","paypal-cert-url","paypal-transmission-id","paypal-transmission-sig","paypal-transmission-time"];
  const normalized=Object.fromEntries(Object.entries(headers).map(([k,v])=>[k.toLowerCase(),v]));
  if (required.some(k=>typeof normalized[k]!=="string" || !normalized[k])) throw Error("Missing PayPal signature headers");
  const cert=new URL(normalized["paypal-cert-url"]);
  if (cert.protocol!=="https:" || !/(^|\.)paypal\.com$/.test(cert.hostname)) throw Error("Invalid PayPal certificate host");
  const token=await accessToken(fetchImpl);
  const response=await fetchImpl(BASE+"/v1/notifications/verify-webhook-signature",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({
    auth_algo:normalized["paypal-auth-algo"],cert_url:normalized["paypal-cert-url"],
    transmission_id:normalized["paypal-transmission-id"],transmission_sig:normalized["paypal-transmission-sig"],
    transmission_time:normalized["paypal-transmission-time"],webhook_id:process.env.LAB_PAYPAL_WEBHOOK_ID,webhook_event:event
  })});
  if (!response.ok) throw Error("PayPal verification unavailable");
  const result=await response.json();
  return result.verification_status==="SUCCESS";
}
// Explicitly restrict settlement to a completed sandbox capture whose reference
// and amount match a server-side expected booking. Do not trust client amounts.
function validateCapture(event, expected) {
  if (!event || event.event_type!=="PAYMENT.CAPTURE.COMPLETED") throw Error("Unexpected webhook type");
  const capture=event.resource;
  if (!capture || capture.status!=="COMPLETED" || capture.id!==expected.captureId) throw Error("Capture mismatch");
  if (capture.amount?.currency_code!==expected.currency || capture.amount?.value!==expected.amount) throw Error("Amount mismatch");
  if (!Number.isSafeInteger(expected.amountCents)||expected.amountCents<=0) throw Error("Invalid expected amount");
  return {webhookId:event.id,bookingId:expected.bookingId,outcome:"paid",amountCents:expected.amountCents};
}
module.exports={assertSandbox,accessToken,verifyWebhook,validateCapture};
