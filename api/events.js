const { rateLimit,applyRateLimitHeaders,rejectRateLimited,sameOrigin,setSecurityHeaders }=require("../lib/security");
const { requireUser,authErrorStatus }=require("../lib/authorization");
const { query,transaction }=require("../lib/db");
const { audit }=require("../lib/audit");
const { reconcileDates }=require("../lib/event-dates");

const APPS_SCRIPT_URL=String(process.env.ARTYOU_APPS_SCRIPT_URL||"").trim();
const UPLOAD_PIN=String(process.env.ARTYOU_GESTIONALE_PIN||"").trim();

function paramsOf(req){const raw=String(req.url||""),i=raw.indexOf("?");return new URLSearchParams(i>=0?raw.slice(i+1):"")}
function meta(v){if(!v)return{};if(typeof v==="object")return v;try{return JSON.parse(String(v))}catch(_){return{}}}
function clean(v,n){return String(v==null?"":v).trim().slice(0,n)}
function bool(v){return v===true||v===1||v==="1"||String(v||"").toLowerCase()==="true"}

async function eventDates(eventId,conn){
  const [rows]=conn?await conn.execute("SELECT id,date_label,starts_at,metadata FROM event_dates WHERE event_id=? AND active=1 ORDER BY starts_at,id",[eventId]):[await query("SELECT id,date_label,starts_at,metadata FROM event_dates WHERE event_id=? AND active=1 ORDER BY starts_at,id",[eventId])];
  return mapDates(rows);
}
function mapDates(rows){return rows.map(d=>({id:String(d.id),label:String(d.date_label||""),start:d.starts_at?new Date(d.starts_at).toISOString():"",sold:0,metadata:meta(d.metadata)}));}
async function eventObject(row,conn,prefetched){
  const m=meta(row.metadata);
  return {
    id:String(row.id),slug:String(row.slug||""),title:String(row.title||""),cat:String(row.category||""),
    eventType:String(row.event_type||"Spettacolo"),tipo:String(row.event_type||"Spettacolo"),
    ordine:Number(row.sort_order==null?100:row.sort_order),desc:String(row.description||""),venue:String(row.venue||""),
    addr:String(row.address||""),maps:String(row.maps_query||""),price:row.price==null?"":Number(row.price),
    capienza:Number(row.capacity||0),pagaOnline:!!row.online_payment,tbd:!!row.tbd,attivo:!!row.active,
    poster:String(row.poster_url||""),dates:prefetched===undefined?await eventDates(row.id,conn):mapDates(prefetched),cast:Array.isArray(m.cast)?m.cast:[],
    yepPricing:m.yepPricing||null,saggi:m.saggi||null
  };
}
async function listAdminEvents(publicOnly=false){
  const rows=await query("SELECT * FROM events "+(publicOnly?"WHERE active=1 ":"")+"ORDER BY sort_order,title,id");
  if(!rows.length)return [];
  const dates=await query("SELECT event_id,id,date_label,starts_at,metadata FROM event_dates WHERE active=1 AND event_id IN ("+rows.map(()=>"?").join(",")+") ORDER BY starts_at,id",rows.map(r=>r.id));
  const grouped=new Map();for(const d of dates){const key=String(d.event_id);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(d);}
  return Promise.all(rows.map(r=>eventObject(r,null,grouped.get(String(r.id))||[])));
}
async function saveEvent(input){
  const e=input||{},title=clean(e.title,255),slug=clean(e.slug,190).toLowerCase();
  if(!title)throw new Error("titolo_mancante");
  if(!slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new Error("slug_non_valido");
  const cap=Math.max(0,Math.min(100000,Math.floor(Number(e.capienza||0))));
  if(!Number.isFinite(cap))throw new Error("capienza_non_valido");
  const price=e.price===""||e.price==null?null:Number(e.price);
  if(price!=null&&(!Number.isFinite(price)||price<0||price>100000))throw new Error("prezzo_non_valido");
  const dates=Array.isArray(e.dates)?e.dates.slice(0,100):[];
  let metadata=JSON.stringify({cast:Array.isArray(e.cast)?e.cast.slice(0,100):[],yepPricing:e.yepPricing||null,saggi:e.saggi||null});
  return transaction(async conn=>{
    let id=/^\d+$/.test(String(e.id||""))?Number(e.id):0;
    if(id&&!Number.isSafeInteger(id))throw new Error("id_non_valido");
    const [original]=await conn.execute(id?"SELECT id,metadata FROM events WHERE id=? FOR UPDATE":"SELECT id,metadata FROM events WHERE slug=? FOR UPDATE",[id||slug]);
    if(id&&!original.length)throw new Error("evento_non_trovato");
    if(original.length){id=Number(original[0].id);metadata=JSON.stringify({...meta(original[0].metadata),...JSON.parse(metadata)});}
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
    await reconcileDates(conn,id,dates);
    const [rows]=await conn.execute("SELECT * FROM events WHERE id=? LIMIT 1",[id]);
    return eventObject(rows[0],conn);
  });
}
async function deleteEvent(id){
  const n=Number(id);if(!Number.isInteger(n)||n<=0)throw new Error("evento_non_trovato");
  const r=await query("UPDATE events SET active=0,source_updated_at=NOW() WHERE id=?",[n]);
  if(!r||!r.affectedRows)throw new Error("evento_non_trovato");
}
// Locandine: riconosce il formato dai primi byte, non dal nome o dal tipo dichiarato.
function imageKind(buf){
  if(buf.length>3&&buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff)return {mime:"image/jpeg",ext:"jpg"};
  if(buf.length>8&&buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:"image/png",ext:"png"};
  if(buf.length>12&&buf.subarray(0,4).toString("latin1")==="RIFF"&&buf.subarray(8,12).toString("latin1")==="WEBP")return {mime:"image/webp",ext:"webp"};
  return null;
}
// Con BLOB_READ_WRITE_TOKEN le locandine vanno su Vercel Blob (pubbliche: sono immagini del sito)
// e non serve più il PIN del vecchio Apps Script, che resta come ripiego.
async function uploadImageToBlob(body,put){
  const b64=String(body.base64||"");
  if(!b64||b64.length>11*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(b64))throw new Error("immagine_non_valido");
  const bytes=Buffer.from(b64,"base64");
  if(bytes.length>8*1024*1024)throw new Error("payload_too_large");
  const kind=imageKind(bytes);if(!kind)throw new Error("formato_immagine_non_valido");
  const base=clean(body.name,120).toLowerCase().replace(/\.[a-z0-9]+$/,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"locandina";
  const blob=await put("locandine/"+base+"."+kind.ext,bytes,{access:"public",addRandomSuffix:true,contentType:kind.mime,token:process.env.BLOB_READ_WRITE_TOKEN});
  return {ok:true,url:blob.url,storage:"vercel-blob"};
}
async function uploadImage(body){
  if(process.env.BLOB_READ_WRITE_TOKEN){const {put}=require("@vercel/blob");return uploadImageToBlob(body,put);}
  if(!APPS_SCRIPT_URL||!UPLOAD_PIN)throw new Error("upload_non_configurato");
  const payload={action:"uploadimage",pin:UPLOAD_PIN,name:clean(body.name,255),mime:clean(body.mime,100),base64:String(body.base64||"")};
  if(Buffer.byteLength(payload.base64,"utf8")>8*1024*1024)throw new Error("payload_too_large");
  const r=await fetch(APPS_SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload),redirect:"follow",signal:AbortSignal.timeout(30000)});
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
    try{return res.status(200).json({ok:true,events:await listAdminEvents(true),storage:"mysql"});}
    catch(_){return res.status(503).json({ok:false,errore:"mysql_unavailable"});}
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

module.exports.uploadImageToBlob=uploadImageToBlob;module.exports.imageKind=imageKind;
