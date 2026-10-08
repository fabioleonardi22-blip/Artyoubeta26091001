"use strict";
/*
 * Opt-in HTTP smoke test against a dedicated Vercel PREVIEW deployment.
 * NEVER uses production alias, PayPal, Apps Script or customer data.
 */
const crypto=require("node:crypto");
async function main(){
  const raw=process.env.ARTYOU_BOOKING_LAB_PREVIEW_URL;
  const token=process.env.ARTYOU_BOOKING_LAB_TOKEN;
  if(!raw||!token||token.length<32)throw Error("preview_url_and_token_required");
  const base=new URL(raw);
  if(base.protocol!=="https:"||!base.hostname.endsWith(".vercel.app")||
     !base.hostname.includes("booking-lab-isolated-20261008"))
    throw Error("only_isolated_branch_preview_allowed");
  const endpoint=new URL("/api/booking-lab",base);
  const headers={"Content-Type":"application/json","X-Booking-Lab-Token":token};
  async function call(body){
    const r=await fetch(endpoint,{method:"POST",headers,body:JSON.stringify(body),
      signal:AbortSignal.timeout(15000)});
    const d=await r.json();
    return {status:r.status,...d};
  }
  const slug="shortyou-demo";
  const before=await call({action:"availability",eventSlug:slug});
  if(!before.ok||!Number.isInteger(before.remaining))throw Error("staging_availability_unavailable");
  const requested=Math.min(30,before.remaining+5);
  const batch=crypto.randomUUID();
  const results=await Promise.all(Array.from({length:requested},(_,i)=>
    call({action:"reserve",eventSlug:slug,seats:1,requestKey:batch+"-"+i})));
  const accepted=results.filter(x=>x.ok).length;
  const soldOut=results.filter(x=>x.error==="sold_out").length;
  const unexpected=results.filter(x=>!x.ok&&x.error!=="sold_out");
  const after=await call({action:"availability",eventSlug:slug});
  const report={slug,capacity:after.capacity,before:before.remaining,after:after.remaining,
    accepted,soldOut,unexpected:unexpected.map(x=>({status:x.status,error:x.error})),
    invariant:accepted<=before.remaining&&after.remaining===before.remaining-accepted};
  console.log(JSON.stringify(report,null,2));
  if(!report.invariant||unexpected.length)process.exitCode=1;
}
main().catch(e=>{console.error("SMOKE_FAILED",e.message);process.exitCode=2;});
