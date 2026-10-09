"use strict";
/*
 * Staging-only Vercel function. Never call /api/artyou or lib/db.
 * Requires a dedicated MySQL database and PayPal Sandbox credentials.
 */
const {ensureLabEnv,authorized,createLabPool}=require("../sandbox/booking-lab/guard");
const {createStore,LabError}=require("../sandbox/booking-lab/store");
const {createPayPal}=require("../sandbox/booking-lab/paypal-sandbox");
let pool;
function getStore(){if(!pool)pool=createLabPool();return createStore(pool);}
function send(res,status,payload){res.status(status).json(payload);}
function allowed(value,max){return typeof value==="string"&&value.length>0&&value.length<=max;}
module.exports=async function(req,res){
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("X-Robots-Tag","noindex, nofollow");
  res.setHeader("Access-Control-Allow-Origin","null");
  try{ensureLabEnv();}catch(_){return send(res,503,{ok:false,error:"lab_disabled"});}
  if(!authorized(req))return send(res,401,{ok:false,error:"unauthorized"});
  if(!["GET","POST"].includes(req.method))return send(res,405,{ok:false,error:"method_not_allowed"});
  const data=typeof req.body==="object"&&req.body!==null?req.body:{};
  const action=String(req.method==="GET"?"availability":data.action||"");
  if(req.method==="POST"){
    const length=Number(req.headers["content-length"]||0);
    if(length>4096)return send(res,413,{ok:false,error:"payload_too_large"});
    if(!["reserve","order","capture","refund","cancel","availability","booking","compare"].includes(action))
      return send(res,400,{ok:false,error:"invalid_action"});
  }
  try{
    const store=getStore();
    let result;
    switch(action){
      case "reserve":
        result=await store.reserve(data);break;
      case "availability":{
        const slug=String(req.method==="GET"?req.query?.eventSlug||"":data.eventSlug||"");
        if(!allowed(slug,190))throw new LabError("invalid_event",400);
        result=await store.availability(slug);break;
      }
      case "booking":
        if(!allowed(data.bookingId,36))throw new LabError("invalid_booking",400);
        result=await store.booking(data.bookingId);break;
      case "compare":{
        if(!allowed(data.eventSlug,190))throw new LabError("invalid_event",400);
        const expected=await store.availability(data.eventSlug);
        const actual=data.manager||{};
        const fields=["capacity","booked","remaining"];
        const diffs=fields.filter(f=>expected[f]!==actual[f]).map(f=>({field:f,expected:expected[f],actual:actual[f]}));
        result={match:diffs.length===0,diffs,expected,source:"STAGING_ONLY"};break;
      }
      case "order":{
        if(!allowed(data.bookingId,36))throw new LabError("invalid_booking",400);
        const b=await store.booking(data.bookingId);
        if(b.orderId){result={booking:b,orderId:b.orderId,replay:true};break;}
        if(b.status!=="HELD"||new Date(b.expiresAt).getTime()<=Date.now())throw new LabError("hold_expired");
        const provider=createPayPal();
        const order=await provider.createOrder(b);
        if(!order.id||order.status==="COMPLETED")throw new LabError("unexpected_paypal_order");
        const updated=await store.setOrder(b.id,order.id);
        result={booking:updated,orderId:order.id,links:(order.links||[]).filter(l=>l.rel==="payer-action"||l.rel==="approve")};break;
      }
      case "capture":{
        if(!allowed(data.bookingId,36))throw new LabError("invalid_booking",400);
        const started=await store.startCapture(data.bookingId);
        if(started.replay){result=started;break;}
        const b=started.booking;
        const provider=createPayPal();
        // Always query PayPal first: covers retry after a serverless crash/timeout.
        const existing=await provider.getOrder(b.orderId);
        provider.assertOrder(existing,b);
        let capture=provider.captureDetails(existing);
        if(!capture||capture.status!=="COMPLETED"){
          const captured=await provider.captureOrder(b.orderId,b.id);
          if(captured.orderId!==b.orderId)throw new LabError("provider_order_mismatch");
          capture=captured.capture;
        }
        if(!capture)throw new LabError("provider_capture_missing");
        result={booking:await store.confirmCapture(b.id,capture)};break;
      }
      case "refund":{
        if(!allowed(data.bookingId,36))throw new LabError("invalid_booking",400);
        const started=await store.startRefund(data.bookingId);
        if(started.replay){result=started;break;}
        const provider=createPayPal();
        const pending=started.pending?await store.pendingRefund(started.booking.id):null;
        // Reconcile a known provider refund before attempting a stable idempotent retry.
        const refund=pending
          ? await provider.getRefund(pending.provider_refund_id)
          : await provider.refund(started.booking);
        await store.recordRefund(started.booking.id,refund);
        if(refund.status!=="COMPLETED"){
          result={pending:true,booking:started.booking,needsReconciliation:true,providerStatus:refund.status};break;
        }
        result={booking:await store.confirmRefund(started.booking.id,refund)};break;
      }
      case "cancel":
        if(!allowed(data.bookingId,36))throw new LabError("invalid_booking",400);
        result={booking:await store.cancel(data.bookingId)};break;
      default:throw new LabError("invalid_action",400);
    }
    return send(res,200,{ok:true,...result});
  }catch(err){
    if(err instanceof LabError)return send(res,err.status,{ok:false,error:err.code});
    console.error("BOOKING_LAB_STAGING_ERROR",String(err?.message||err));
    return send(res,503,{ok:false,error:"staging_unavailable"});
  }
};
