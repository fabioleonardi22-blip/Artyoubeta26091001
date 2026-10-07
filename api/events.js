const {
  rateLimit, applyRateLimitHeaders, rejectRateLimited, sameOrigin, setSecurityHeaders
} = require("../lib/security");
const { requireUser, authErrorStatus } = require("../lib/authorization");
const { transaction } = require("../lib/db");
const { audit } = require("../lib/audit");

const APPS_SCRIPT_URL=String(process.env.ARTYOU_APPS_SCRIPT_URL||"").trim();
const ADMIN_PIN=String(process.env.ARTYOU_GESTIONALE_PIN||"").trim();

function getQuery(req){
  const raw=String(req.url||""),i=raw.indexOf("?");
  return new URLSearchParams(i>=0?raw.slice(i+1):"");
}

async function syncPublicEventsToMysql(){
  if(!(process.env.DATABASE_URL||process.env.MYSQL_URL))return;
  const r=await fetch(APPS_SCRIPT_URL+"?eventi=1&_="+Date.now(),{redirect:"follow"});
  if(!r.ok)throw new Error("events_sync_source_unavailable");
  const data=await r.json();
  if(!data||!data.ok||!data.eventi)throw new Error("events_sync_payload_invalid");
  await transaction(async conn=>{
    await conn.execute("UPDATE events SET active=0");
    for(const [slug,ev] of Object.entries(data.eventi)){
      const e=ev||{};
      await conn.execute(
        `INSERT INTO events (slug,title,category,event_type,price,capacity,active,source_updated_at)
         VALUES (?,?,?,?,?,?,1,NOW())
         ON DUPLICATE KEY UPDATE title=VALUES(title),category=VALUES(category),event_type=VALUES(event_type),
         price=VALUES(price),capacity=VALUES(capacity),active=1,source_updated_at=NOW()`,
        [String(slug),String(e.titolo||e.descrizione||slug),String(e.categoria||""),String(e.tipo||""),
         e.prezzo===""||e.prezzo==null?null:Number(e.prezzo||0),Math.max(0,Number(e.capienza||0))]
      );
    }
  });
}

module.exports=async function handler(req,res){
  setSecurityHeaders(res);
  if(!APPS_SCRIPT_URL)return res.status(503).json({ok:false,errore:"backend_non_configurato"});
  try{
    let auth=null;
    const method=String(req.method||"GET").toUpperCase();
    if(!["GET","HEAD","POST"].includes(method)){res.setHeader("Allow","GET, HEAD, POST");return res.status(405).json({ok:false,errore:"method_not_allowed"});}
    const params=getQuery(req), queryAction=String(params.get("action")||"").toLowerCase();
    const publicRead=(method==="GET"||method==="HEAD")&&queryAction==="public";

    if(publicRead){
      const limit=rateLimit(req,{key:"events-public",limit:120,windowMs:60*1000});applyRateLimitHeaders(res,limit);
      if(!limit.ok)return rejectRateLimited(res,limit);
    }else{
      if(!sameOrigin(req))return res.status(403).json({ok:false,errore:"origin_non_consentita"});
      const limit=rateLimit(req,{key:"events-admin",limit:60,windowMs:60*1000});applyRateLimitHeaders(res,limit);
      if(!limit.ok)return rejectRateLimited(res,limit);
      try{auth=await requireUser(req,["admin","staff"]);}catch(e){const code=String(e&&e.message||"auth_error");return res.status(authErrorStatus(code)).json({ok:false,errore:code});}
      if(!ADMIN_PIN)return res.status(503).json({ok:false,errore:"gestionale_secret_non_configurato"});
    }

    if(method==="GET"||method==="HEAD"){
      if(!["public","list"].includes(queryAction))return res.status(403).json({ok:false,errore:"azione_non_consentita"});
    }

    let options={method,redirect:"follow",headers:{}},requestBody=null,url=APPS_SCRIPT_URL;
    if(method==="POST"){
      let body=req.body||{};
      if(typeof body==="string"){
        if(Buffer.byteLength(body,"utf8")>8*1024*1024)return res.status(413).json({ok:false,errore:"payload_too_large"});
        try{body=JSON.parse(body);}catch(_){return res.status(400).json({ok:false,errore:"json_non_valido"});}
      }
      const action=String(body.action||queryAction||"").toLowerCase();
      if(!["save","delete","uploadimage"].includes(action))return res.status(403).json({ok:false,errore:"azione_non_consentita"});
      if(action!=="uploadimage"&&Buffer.byteLength(JSON.stringify(body),"utf8")>128*1024)return res.status(413).json({ok:false,errore:"payload_too_large"});
      delete body.pin;
      body.pin=ADMIN_PIN;
      requestBody=body;
      options.headers["Content-Type"]="text/plain;charset=utf-8";
      options.body=JSON.stringify(body);
    }else{
      const safe=new URLSearchParams(params);
      safe.delete("pin");
      if(queryAction==="list")safe.set("pin",ADMIN_PIN);
      const qs=safe.toString();if(qs)url+="?"+qs;
    }

    const upstream=await fetch(url,options),bodyText=await upstream.text();
    if(method==="POST"&&upstream.ok&&requestBody&&["save","delete"].includes(String(requestBody.action||"").toLowerCase())){
      try{const result=JSON.parse(bodyText);if(result&&result.ok)await syncPublicEventsToMysql();}
      catch(syncErr){console.error("ARTYOU_MYSQL_EVENT_SYNC_ERROR",String(syncErr&&syncErr.message||syncErr));}
    }
    res.status(upstream.status);res.setHeader("Content-Type",upstream.headers.get("content-type")||"application/json; charset=utf-8");res.send(bodyText);
  }catch(err){
    console.error("EVENTS_PROXY_ERROR",String(err&&err.message||err));
    return res.status(502).json({ok:false,errore:"proxy_error"});
  }
};
