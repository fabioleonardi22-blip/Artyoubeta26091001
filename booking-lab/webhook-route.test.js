"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const handler=require("../api/booking-lab/paypal-webhook");
function response(){
  return {headers:{},code:200,body:null,setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
}
test("webhook rejects GET",async()=>{
  const res=response();
  await handler({method:"GET"},res);
  assert.equal(res.code,405);
  assert.equal(res.headers.Allow,"POST");
});
test("webhook rejects POST while lab disabled",async()=>{
  const previous=process.env.BOOKING_LAB_ENABLED;
  try {
    process.env.BOOKING_LAB_ENABLED="false";
    const res=response();
    await handler({method:"POST"},res);
    assert.equal(res.code,503);
    assert.equal(res.body.error,"booking_lab_disabled");
  } finally {
    if(previous===undefined) delete process.env.BOOKING_LAB_ENABLED;
    else process.env.BOOKING_LAB_ENABLED=previous;
  }
});
