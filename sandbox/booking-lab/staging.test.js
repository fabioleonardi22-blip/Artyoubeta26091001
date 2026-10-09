"use strict";
const assert=require("node:assert/strict");
const {ensureLabEnv,authorized}=require("./guard");
const {createPayPal}=require("./paypal-sandbox");
const {createStore}=require("./store");
async function run(){
  let passed=0;
  async function check(name,fn){await fn();console.log("PASS "+name);passed++;}
  await check("disabled without sandbox mode",()=>{
    assert.throws(()=>ensureLabEnv({ARTYOU_BOOKING_LAB_DATABASE_URL:"mysql://a:b@db/lab",ARTYOU_BOOKING_LAB_TOKEN:"x".repeat(32)}),/lab_disabled/);
  });
  await check("production environment always forbidden",()=>{
    assert.throws(()=>ensureLabEnv({
      VERCEL_ENV:"production",ARTYOU_BOOKING_LAB_MODE:"sandbox",
      ARTYOU_BOOKING_LAB_DATABASE_URL:"mysql://a:b@db/lab",
      ARTYOU_BOOKING_LAB_TOKEN:"x".repeat(32)
    }),/lab_production_forbidden/);
  });
  await check("rejects production DB and missing token",()=>{
    const env={ARTYOU_BOOKING_LAB_MODE:"sandbox",ARTYOU_BOOKING_LAB_DATABASE_URL:"mysql://a:b@db/prod",
      DATABASE_URL:"mysql://a:b@db/prod",ARTYOU_BOOKING_LAB_TOKEN:"x".repeat(32)};
    assert.throws(()=>ensureLabEnv(env),/matches_production/);
    assert.throws(()=>ensureLabEnv({...env,ARTYOU_BOOKING_LAB_DATABASE_URL:"mysql://a:b@db/artyou_booking_staging",DATABASE_URL:"mysql://a:b@db/other",ARTYOU_BOOKING_LAB_TOKEN:"weak"}),/token_missing/);
    assert.throws(()=>ensureLabEnv({...env,DATABASE_URL:"mysql://other:password@db/prod"}),/matches_production/);
  });
  await check("requires compatible isolated staging schema",()=>{
    const env={ARTYOU_BOOKING_LAB_MODE:"sandbox",ARTYOU_BOOKING_LAB_TOKEN:"x".repeat(32)};
    for(const schema of ["prod","lab","artyou_booking_lab"])
      assert.throws(()=>ensureLabEnv({...env,ARTYOU_BOOKING_LAB_DATABASE_URL:"mysql://a:b@db/"+schema}),/lab_staging_schema_required/);
    for(const schema of ["artyou_booking_staging","artyou_booking_staging_e2e"])
      assert.equal(ensureLabEnv({...env,ARTYOU_BOOKING_LAB_DATABASE_URL:"mysql://a:b@db/"+schema}),"mysql://a:b@db/"+schema);
  });
  await check("constant time token matching",()=>{
    const env={ARTYOU_BOOKING_LAB_TOKEN:"a".repeat(32)};
    assert.equal(authorized({headers:{"x-booking-lab-token":"a".repeat(32)}},env),true);
    assert.equal(authorized({headers:{"x-booking-lab-token":"b".repeat(32)}},env),false);
    assert.equal(authorized({headers:{"x-booking-lab-token":"a"}},env),false);
  });
  await check("PayPal requests go exclusively to sandbox API",async()=>{
    const urls=[],requests=[];
    const fetcher=async(url,opts)=>{
      urls.push(url);requests.push(opts);
      let data={};
      if(url.endsWith("/v1/oauth2/token"))data={access_token:"FAKE",expires_in:3600};
      else if(url.endsWith("/v2/checkout/orders")&&opts.method==="POST")data={id:"ORDER-1",status:"CREATED"};
      else if(url.endsWith("/capture"))data={id:"ORDER-1",purchase_units:[{payments:{captures:[{id:"CAP-1",status:"COMPLETED",amount:{currency_code:"EUR",value:"15.00"}}]}}]};
      else if(url.endsWith("/refund"))data={id:"REF-1",status:"COMPLETED",amount:{currency_code:"EUR",value:"15.00"}};
      else if(url.endsWith("/v2/checkout/orders/ORDER-1"))data={id:"ORDER-1"};
      return {ok:true,json:async()=>data};
    };
    const provider=createPayPal({ARTYOU_BOOKING_LAB_PAYPAL_CLIENT_ID:"FAKE",ARTYOU_BOOKING_LAB_PAYPAL_SECRET:"FAKE"},fetcher);
    const booking={id:"LAB-1",amountCents:1500,captureId:"CAP-1"};
    assert.equal((await provider.createOrder(booking)).id,"ORDER-1");
    assert.throws(()=>provider.assertOrder({id:"ORDER-1",purchase_units:[{custom_id:"WRONG"}]},
      {...booking,orderId:"ORDER-1"}),/identity_mismatch/);
    provider.assertOrder({id:"ORDER-1",purchase_units:[{custom_id:"LAB-1"}]},
      {...booking,orderId:"ORDER-1"});
    assert.equal((await provider.captureOrder("ORDER-1",booking.id)).capture.amountCents,1500);
    assert.equal((await provider.refund(booking)).id,"REF-1");
    assert.ok(urls.every(u=>u.startsWith("https://api-m.sandbox.paypal.com/")));
    assert.ok(requests.some(r=>r.headers["PayPal-Request-Id"]==="lab-capture-LAB-1"));
  });
  await check("atomic SQL booking uses FOR UPDATE and server price",async()=>{
    const statements=[];
    const bookings=new Map();
    let pending=Promise.resolve();
    const pool={getConnection:async()=>{
      let unlock;
      const prior=pending;
      pending=new Promise(resolve=>{unlock=resolve;});
      await prior;
      return {
        beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},
        release:()=>unlock(),
        execute:async(sql,args=[])=>{
          statements.push(sql);
          if(sql.includes("FROM lab_events WHERE slug="))return [[{id:1,slug:"shortyou-demo",capacity:3,price_cents:1500}]];
          if(sql.includes("FROM lab_bookings WHERE idempotency_key=")){
            return [[...bookings.values()].filter(b=>b.idempotency_key===args[0])];
          }
          if(sql.includes("COALESCE(SUM(seats)"))return [[{taken:[...bookings.values()].reduce((a,b)=>a+b.seats,0)}]];
          if(sql.startsWith("INSERT INTO lab_bookings")){
            const [id,eventId,key,hash,seats,amount]=args;
            bookings.set(id,{public_id:id,event_id:eventId,idempotency_key:key,request_fingerprint:hash,seats,amount_cents:amount,booking_status:"HELD",payment_status:"PENDING",hold_expires_at:new Date(Date.now()+600000)});
            return [{affectedRows:1}];
          }
          if(sql.includes("FROM lab_bookings WHERE public_id="))return [[bookings.get(args[0])].filter(Boolean)];
          throw Error("unhandled SQL: "+sql);
        }
      };
    }};
    const store=createStore(pool);
    const results=await Promise.all(Array.from({length:25},(_,i)=>
      store.reserve({eventSlug:"shortyou-demo",requestKey:"idempotent-"+i,seats:1}).then(()=>true,e=>e.code)));
    assert.equal(results.filter(x=>x===true).length,3);
    assert.equal(results.filter(x=>x==="sold_out").length,22);
    assert.equal([...bookings.values()].reduce((a,b)=>a+b.seats,0),3);
    assert.ok([...bookings.values()].every(b=>b.amount_cents===1500));
    assert.ok(statements.some(s=>s.includes("FOR UPDATE")));
  });
  console.log("TOTAL "+passed+" / "+passed+" staging module tests passed");
}
run().catch(e=>{console.error(e);process.exitCode=1;});
