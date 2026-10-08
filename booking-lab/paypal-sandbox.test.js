"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {verifyWebhook,validateCapture}=require("./paypal-sandbox");
test("rejects unsigned webhook before network call",async()=>{
  const old=Object.fromEntries(["BOOKING_LAB_ENABLED","NODE_ENV","VERCEL_ENV","LAB_PAYPAL_CLIENT_ID","LAB_PAYPAL_CLIENT_SECRET","LAB_PAYPAL_WEBHOOK_ID"].map(k=>[k,process.env[k]]));
  try {
    Object.assign(process.env,{BOOKING_LAB_ENABLED:"true",NODE_ENV:"test",LAB_PAYPAL_CLIENT_ID:"sandbox-test",LAB_PAYPAL_CLIENT_SECRET:"sandbox-test",LAB_PAYPAL_WEBHOOK_ID:"sandbox-test"});
    delete process.env.VERCEL_ENV;
    await assert.rejects(()=>verifyWebhook({}, {},()=>{throw Error("Unexpected network")}),/Missing PayPal signature/);
  } finally {for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test("rejects mismatched capture amounts",()=>{
  const event={id:"WH-1",event_type:"PAYMENT.CAPTURE.COMPLETED",resource:{id:"CAP-1",status:"COMPLETED",amount:{currency_code:"EUR",value:"25.00"}}};
  const expected={captureId:"CAP-1",currency:"EUR",amount:"30.00",amountCents:3000,bookingId:"booking-1"};
  assert.throws(()=>validateCapture(event,expected),/Amount mismatch/);
  assert.deepEqual(validateCapture(event,{...expected,amount:"25.00",amountCents:2500}),{webhookId:"WH-1",bookingId:"booking-1",outcome:"paid",amountCents:2500});
});
