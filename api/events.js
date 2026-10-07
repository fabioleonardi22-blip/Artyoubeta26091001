const { rateLimit,applyRateLimitHeaders,rejectRateLimited,sameOrigin,setSecurityHeaders }=require("../lib/security");
const { requireUser,authErrorStatus }=require("../lib/authorization");
const { query,transaction }=require("../lib/db");
const { audit }=require("../lib/audit");

const APPS_SCRIPT_URL=String(process.env.ARTYOU_APPS_SCRIPT_URL||"").trim();
const UPLOAD_PIN=String(process.env.ARTYOU_GESTIONALE_PIN||"").trim();

function paramsOf(req){const raw=String(req.url||""),i=raw.indexOf("?");return new URLSearchParams(i>=0?raw.slice(i+1):"")}
function meta(v){if(!v)return{};if(typeof v==="object")return v;try{return JSON.parse(String(v))}catch(_){return{}}}
function clean(v,n){return String(v==null?"":v).trim().slice(0,n)}
function bool(v){return v===true||v===1||v==="1"||String(v||"").toLowerCase()==="true"}

async function eventDates(eventId,conn){
  const [rows]=conn?await conn.execute("SELECT id,date_label,starts_at,metadata FROM event_dates WHERE event_id=? AND active=1 ORDER BY starts_at,id",[eventId]):[await query("SELECT id,date_label,starts_at,metadata FROM event_dates WHERE event_id=? AND active=1 ORDER BY starts_at,id",[eventId])];
  return rows.map(d=>({label:String(d.date_label||""),sold:0,metadata:meta(d.metadata)}));
}
async function eventObject(row,conn){
  const m=meta(row.metadata);
  return {
    id:String(row.id),slug:String(row.slug||""),title:String(row.title||""),cat:String(row.category||""),
    eventType:String(row.event_type||"Spettacolo"),tipo:String(row.event_type||"Spettacolo"),
    ordine:Number(row.sort_order==null?100:row.sort_order),desc:String(row.description||""),venue:String(row.venue||""),
    addr:String(row.address||""),maps:String(row.maps_query||""),price:row.price==null?"":Number(row.price),
    capienza:Number(row.capacity||0),pagaOnline:!!row.online_payment,tbd:!!row.tbd,attivo:!!row.active,
    poster:String(row.poster_url||""),dates:await eventDates(row.id,conn),cast:Array.isArray(m.cast)?m.cast:[],
    yepPricing:m.yepPricing||null,saggi:m.saggi||null
  };
}
async function listAdminEvents(){
  const rows=await query("SELECT * FROM events ORDER BY sort_order,title,id");
  const out=[];for(const r of rows)out.push(await eventObject(r));return out;
}
async function saveEvent(input){
  const e=input||{},title=clean(e.title,255),slug=clean(e.slug,190).toLowerCase();
  if(!title)throw new Error("titolo_mancante");
  if(!slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error("slug_non_valido");
  const cap=Math.max(0,Math.min(100000,Math.floor(Number(e.capienza||0))));
  const price=e.price===""||e.price==null?null:Number(e.price);
  if(price!=null&&(!Number.isFinite(price)||price<0||price>100000))throw new Error("prezzo_non_valido");
  const dates=Array.isArray(e.dates)?e.dates.slice(0,100):[];
  const metadata=JSON.stringify({cast:Array.isArray(e.cast)?e.cast.slice(0,100):[],yepPricing:e.yepPricing||null,saggi:e.saggi||null});
  return transaction(async conn=>{
    let id=/^\d+$/.test(String(e.id||""))?Number(e.id):0;
    if(id){
      const [r]=await conn.execute(`UPDATE events SET slug=?,title=?,category=?,event_type=?,description=?,poster_url=?,venue=?,address=?,maps_query=?,
        price=?,capacity=?,online_payment=?,tbd=?,active=?,sort_order=?,metadata=?,source_updated_at=NOW() WHERE id=?`,
        [slug,title,clean(e.cat,100),clean(e.eventType||e.tipo||"Spettacolo",100),clean(e.desc,20000),clean(e.poster,2000),clean(e.venue,255),clean(e.addr,500),clean(e.maps,500),price,cap,bool(e.pagaOnline)?1:0,bool(e.tbd)?1:0,e.attivo===false?0:1,Number(e.ordine)||100,metadata,id]);
      if(!r.affectedRows)id=0;
    }
    if(!id){
      const [existing]=await conn.execute("SELECT id FROM events WHERE slug=? LIMIT 1",[slug]);
      if(existing.length){
        id=Number(existing[0].id);
        await conn.execute(`UPDATE events SET title=?,category=?,event_type=?,description=?,poster_url=?,venue=?,address=?,maps_query=?,
          price=?,capacity=?,online_payment=?,tbd=?,active=?,sort_order=?,metadata=?,source_updated_at=NOW() WHERE id=?`,
          [title,clean(e.cat,100),clean(e.eventType||e.tipo||"Spettacolo",100),clean(e.desc,20000),clean(e.poster,2000),clean(e.venue,255),clean(e.addr,500),clean(e.maps,500),price,cap,bool(e.pagaOnline)?1:0,bool(e.tbd)?1:0,e.attivo===false?0:1,Number(e.ordine)||100,metadata,id]);
      }else{
        const [ins]=await conn.execute(`INSERT INTO events (slug,title,category,event_type,description,poster_url,venue,address,maps_query,price,capacity,online_payment,tbd,active,sort_order,metadata,source_updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
          [slug,title,clean(e.cat,100),clean(e.eventType||e.tipo||"Spettacolo",100),clean(e.desc,20000),clean(e.poster,2000),clean(e.venue,255),clean(e.addr,500),clean(e.maps,500),price,cap,bool(e.pagaOnline)?1:0,bool(e.tbd)?1:0,e.attivo===false?0:1,Number(e.ordine)||100,metadata]);
        id=Number(ins.insertId);
      }
    }
    await conn.execute("DELETE FROM event_dates WHERE event_id=?",[id]);
    for(const d of dates){
      const label=clean(d&&d.label,255);if(!label)continue;
      await conn.execute("INSERT INTO event_dates (event_id,starts_at,date_label,active,metadata) VALUES (?,NULL,?,1,?)",[id,label,JSON.stringify((d&&d.metadata)||{})]);
    }
    const [rows]=await conn.execute("SELECT * FROM events WHERE id=? LIMIT 1",[id]);
    return eventObject(rows[0],conn);
  });
}
async function deleteEvent(id){
  const n=Number(id);if(!Number.isInteger(n)||n<=0)throw new Error("evento_non_trovato");
  const r=await query("UPDATE events SET active=0,source_updated_at=NOW() WHERE id=?",[n]);
  if(!r||!r.affectedRows)throw new Error("evento_non_trovato");
}
async function uploadImage(body){
  if(!APPS_SCRIPT_URL||!UPLOAD_PIN)throw new Error("upload_non_configurato");
  const payload={action:"uploadimage",pin:UPLOAD_PIN,name:clean(body.name,255),mime:clean(body.mime,100),base64:String(body.base64||"")};
  if(Buffer.byteLength(payload.base64,"utf8")>8*1024*1024)throw new Error("payload_too_large");
  const r=await fetch(APPS_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload),redirect:"follow"});
  const text=await r.text();let data;try{data=JSON.parse(text)}catch(_){throw new Error("upload_response_invalid")}
  if(!r.ok||!data||!data.ok)throw new Error((data&&data.errore)||"upload_failed");return data;
}

module.exports=async function handler(req,res){
  setSecurityHeaders(res);
  const method=String(req.method||"GET").toUpperCase();
  if(!["GET","HEAD","POST"].includes(method)){res.setHeader("Allow","GET, HEAD, POST");return res.status(405).json({ok:false,errore:"method_not_allowed"});}
  const params=paramsOf(req),action=String(params.get("action")||"").toLowerCase();
  const publicRead=(method==="GET"||method==="HEAD")&&action==="public";
  if(publicRead){
    const limit=rateLimit(req,{key:"events-public",limit:120,windowMs:60*1000});applyRateLimitHeaders(res,limit);if(!limit.ok)return rejectRateLimited(res,limit);
    if(!APPS_SCRIPT_URL)return res.status(503).json({ok:false,errore:"backend_non_configurato"});
    try{const upstream=await fetch(APPS_SCRIPT_URL+"?action=public&_="+Date.now(),{redirect:"follow"}),text=await upstream.text();res.status(upstream.status);res.setHeader("Content-Type",upstream.headers.get("content-type")||"application/json; charset=utf-8");return res.send(text)}
    catch(_){return res.status(502).json({ok:false,errore:"proxy_error"})}
  }
  if(!sameOrigin(req))return res.status(403).json({ok:false,errore:"origin_non_consentita"});
  const limit=rateLimit(req,{key:"events-admin",limit:60,windowMs:60*1000});applyRateLimitHeaders(res,limit);if(!limit.ok)return rejectRateLimited(res,limit);
  let auth;try{auth=await requireUser(req,["admin","staff"])}catch(e){const code=String(e&&e.message||"auth_error");return res.status(authErrorStatus(code)).json({ok:false,errore:code})}
  try{
    if((method==="GET"||method==="HEAD")&&action==="list")return res.status(200).json({ok:true,events:await listAdminEvents(),storage:"mysql"});
    if(method!=="POST")return res.status(403).json({ok:false,errore:"azione_non_consentita"});
    let body=req.body||{};if(typeof body==="string"){if(Buffer.byteLength(body,"utf8")>8*1024*1024)return res.status(413).json({ok:false,errore:"payload_too_large"});try{body=JSON.parse(body)}catch(_){return res.status(400).json({ok:false,errore:"json_non_valido"})}}
    const postAction=String(body.action||"").toLowerCase();
    if(postAction==="save"){
      if(Buffer.byteLength(JSON.stringify(body),"utf8")>256*1024)return res.status(413).json({ok:false,errore:"payload_too_large"});
      const event=await saveEvent(body.event||{});await audit({email:auth.identity.email,role:auth.user.role},"event_save",event.slug,{id:event.id});return res.status(200).json({ok:true,event,storage:"mysql"});
    }
    if(postAction==="delete"){
      await deleteEvent(body.id);await audit({email:auth.identity.email,role:auth.user.role},"event_delete",String(body.id||""),{});return res.status(200).json({ok:true,storage:"mysql"});
    }
    if(postAction==="uploadimage"){
      const out=await uploadImage(body);await audit({email:auth.identity.email,role:auth.user.role},"event_upload",clean(body.name,190),{});return res.status(200).json(out);
    }
    return res.status(403).json({ok:false,errore:"azione_non_consentita"});
  }catch(err){
    const code=String(err&&err.message||"errore");
    console.error("EVENTS_API_ERROR",code);
    if(code==="payload_too_large")return res.status(413).json({ok:false,errore:code});
    if(/(_mancante|_non_valido|_non_trovato)$/.test(code))return res.status(400).json({ok:false,errore:code});
    if(code.startsWith("upload_"))return res.status(503).json({ok:false,errore:code});
    return res.status(503).json({ok:false,errore:"mysql_unavailable"});
  }
};
