// Run: node --test tests/booking-sync.test.js
// No external requests, payments or database writes: all dependencies are mocked.
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

function buildHandler({mirror="ok", legacyOk=true, eventExists=true}={}) {
  const originalLoad = Module._load;
  const calls=[];
  Module._load=function(name,parent,isMain){
    if(parent && parent.filename.endsWith("/api/artyou.js")){
      if(name==="../lib/security") return {
        rateLimit:()=>({ok:true}), applyRateLimitHeaders:()=>{}, rejectRateLimited:()=>{},
        sameOrigin:()=>true, setSecurityHeaders:()=>{}
      };
      if(name==="../lib/persistent-rate-limit") return {persistentRateLimit:async()=>({ok:true})};
      if(name==="../lib/db") return {query:async(sql)=>{
        calls.push(sql);
        if(sql.startsWith("SELECT"))return eventExists?[{id:1}]:[];
        if(mirror==="throw")throw new Error("simulated database failure");
        return {affectedRows:1};
      }};
    }
    return originalLoad.apply(this,arguments);
  };
  const path=require.resolve("../api/artyou");
  delete require.cache[path];
  let handler;
  try { handler=require(path); } finally {Module._load=originalLoad;}
  return {handler,calls,legacyOk};
}
async function invoke(scenario) {
  process.env.ARTYOU_APPS_SCRIPT_URL="https://mock.invalid/never-called";
  process.env.DATABASE_URL="mysql://mock:mock@localhost/mock";
  const built=buildHandler(scenario),oldFetch=global.fetch;
  let fetches=0;
  global.fetch=async()=>{fetches++;return {
    ok:true,status:200,headers:{get:()=>"application/json"},
    text:async()=>JSON.stringify({ok:scenario.legacyOk!==false,codice:"MOCK-BOOKING-1",stato:"RISERVATO"})
  }};
  const headers={};
  const res={statusCode:200,setHeader(k,v){headers[k]=v;return this},
    status(n){this.statusCode=n;return this},json(obj){this.payload=obj;return this},
    send(v){this.payload=JSON.parse(v);return this}};
  try {
    await built.handler({method:"POST",url:"/api/artyou",body:{
      action:"prenota",Evento:"mock-event",Nome:"Test",Cognome:"Isolato",
      Email:"test@example.invalid",Posti:1
    }},res);
    return {res,headers,fetches,calls:built.calls};
  } finally {global.fetch=oldFetch; delete process.env.ARTYOU_APPS_SCRIPT_URL; delete process.env.DATABASE_URL;}
}
test("successful booking mirrors to MySQL once and reports synced",async()=>{
  const r=await invoke({});assert.equal(r.res.statusCode,200);
  assert.equal(r.headers["X-Artyou-Mysql-Sync"],"synced");
  assert.equal(r.calls.filter(x=>x.includes("INSERT INTO bookings")).length,1);
});
test("MySQL error leaves legacy receipt confirmed and marks reconciliation",async()=>{
  const r=await invoke({mirror:"throw"});assert.equal(r.res.statusCode,200);
  assert.equal(r.res.payload.ok,true);
  assert.equal(r.res.payload.mysqlSync.status,"pending_reconciliation");
  assert.equal(r.headers["X-Artyou-Mysql-Sync"],"pending");
});
test("missing local event triggers reconciliation rather than false success",async()=>{
  const r=await invoke({eventExists:false});
  assert.equal(r.headers["X-Artyou-Mysql-Sync"],"pending");
  assert.equal(r.calls.filter(x=>x.includes("INSERT INTO bookings")).length,0);
});
test("upstream rejection cannot create a local booking",async()=>{
  const r=await invoke({legacyOk:false});
  assert.equal(r.res.payload.ok,false);
  assert.equal(r.calls.length,0);
});
