const { verifyGoogleIdToken } = require("../lib/google-auth");
const { query } = require("../lib/db");
const { userByGoogleSubject, bootstrapGoogleIdentity } = require("../lib/auth-identity");
const { createSession, readSession, destroySession, setSessionCookie, clearSessionCookie } = require("../lib/session");
const { rateLimit, applyRateLimitHeaders, rejectRateLimited, sameOrigin, setSecurityHeaders } = require("../lib/security");
const { persistentRateLimit } = require("../lib/persistent-rate-limit");
const { audit } = require("../lib/audit");
const { normalizeRole } = require("../lib/authorization");

const APPS_SCRIPT_URL = String(process.env.ARTYOU_APPS_SCRIPT_URL || "").trim();
const ALLOW_LEGACY_AUTH = String(process.env.ARTYOU_ALLOW_LEGACY_AUTH || "").toLowerCase() === "true";

function roleToAccessLevel(role) {
  if (role === "admin") return "Amministratore";
  if (role === "staff") return "Staff";
  return "Docente";
}

function sessionFromUser(identity, user) {
  let metadata = {};
  try { metadata = typeof user.metadata === "string" ? JSON.parse(user.metadata || "{}") : (user.metadata || {}); } catch (_) {}
  return {
    ok:true,
    email:identity.email,
    name:user.display_name || identity.name || "",
    picture:identity.picture || "",
    admin:user.role === "admin",
    role:user.role,
    accessLevel:roleToAccessLevel(user.role),
    person:{
      id:String(user.id),
      name:user.display_name || identity.name || "",
      email:identity.email,
      role:metadata.role || "",
      kind:metadata.kind || (user.role === "teacher" ? "Docente" : "Staff"),
      skills:Array.isArray(metadata.skills) ? metadata.skills : [],
      phone:metadata.phone || "",
      active:!!user.active
    },
    authSource:"mysql-session"
  };
}

async function authorizeViaAppsScript(credential) {
  if (!ALLOW_LEGACY_AUTH || !APPS_SCRIPT_URL) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetch(APPS_SCRIPT_URL,{
      method:"POST",
      redirect:"follow",
      signal:controller.signal,
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"po_session",token:credential})
    });
    const text = await upstream.text();
    let session; try { session=JSON.parse(text); } catch (_) { throw new Error("backend_response_invalid"); }
    return session && session.ok ? session : null;
  } finally { clearTimeout(timer); }
}

function appsScriptRole(session) {
  if (session && session.admin) return "admin";
  const level=String((session&&session.accessLevel)||"").toLowerCase();
  if(level==="amministratore")return "admin";
  if(level==="staff")return "staff";
  return "teacher";
}

async function migrateLegacyUser(identity, session) {
  const role=appsScriptRole(session), person=(session&&session.person)||{};
  const metadata={source:"apps-script-migration",kind:person.kind||(role==="teacher"?"Docente":"Staff"),role:person.role||"",phone:person.phone||"",skills:Array.isArray(person.skills)?person.skills:[],migratedAt:new Date().toISOString()};
  await query(
    `INSERT INTO users (email,display_name,role,active,metadata)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE display_name=VALUES(display_name),active=VALUES(active),metadata=VALUES(metadata),updated_at=CURRENT_TIMESTAMP`,
    [identity.email,person.name||identity.name||"",role,person.active===false?0:1,JSON.stringify(metadata)]
  );
  return bootstrapGoogleIdentity(identity);
}

module.exports = async function handler(req,res) {
  setSecurityHeaders(res);
  const method=String(req.method||"GET").toUpperCase();
  if(!["GET","POST","DELETE"].includes(method)){
    res.setHeader("Allow","GET, POST, DELETE");
    return res.status(405).json({ok:false,errore:"method_not_allowed"});
  }
  if(!sameOrigin(req)) return res.status(403).json({ok:false,errore:"origin_non_consentita"});

  let limit;
  try{limit=await persistentRateLimit(req,{key:"google-auth",limit:30,windowMs:60*1000});}
  catch(_){limit=rateLimit(req,{key:"google-auth-fallback",limit:30,windowMs:60*1000});}
  applyRateLimitHeaders(res,limit);
  if(!limit.ok)return rejectRateLimited(res,limit);

  if(method==="DELETE"){
    try{await destroySession(req);}catch(_){}
    clearSessionCookie(res);
    return res.status(200).json({ok:true});
  }

  try{
    if(method==="GET"){
      const current=await readSession(req);
      if(!current)return res.status(401).json({ok:false,errore:"google_login_required"});
      const user=current.user;
      user.role=normalizeRole(user.role);
      if(!user.role)return res.status(403).json({ok:false,errore:"ruolo_non_valido"});
      return res.status(200).json(sessionFromUser(current.identity,user));
    }

    let body=req.body||{};
    if(typeof body==="string"){
      if(Buffer.byteLength(body,"utf8")>32*1024)return res.status(413).json({ok:false,errore:"payload_too_large"});
      try{body=JSON.parse(body);}catch(_){return res.status(400).json({ok:false,errore:"json_non_valido"});}
    }
    const credential=String(body.credential||"");
    if(!credential||credential.length>8192)return res.status(401).json({ok:false,errore:"google_login_required"});

    const identity=await verifyGoogleIdToken(credential);
    let user=null;
    try{user=await bootstrapGoogleIdentity(identity);}
    catch(dbErr){console.error("MYSQL_AUTH_LOOKUP_ERROR",String(dbErr&&dbErr.message||dbErr));throw new Error("mysql_unavailable");}

    if(!user && ALLOW_LEGACY_AUTH){
      const legacy=await authorizeViaAppsScript(credential);
      if(legacy) user=await migrateLegacyUser(identity,legacy);
    }
    if(!user||!user.active){
      clearSessionCookie(res);
      return res.status(403).json({ok:false,errore:"accesso_non_autorizzato"});
    }

    user.role=normalizeRole(user.role);
    if(!user.role){
      clearSessionCookie(res);
      return res.status(403).json({ok:false,errore:"ruolo_non_valido"});
    }

    try{await destroySession(req);}catch(_){}
    const session=await createSession(user,identity,credential);
    setSessionCookie(res,session);
    await audit({email:identity.email,role:user.role},"login","google",{session:"opaque"});
    return res.status(200).json(sessionFromUser(identity,user));
  }catch(err){
    const code=String(err&&err.message||"autenticazione_non_valida");
    if(method==="POST")clearSessionCookie(res);
    if(code==="mysql_unavailable")return res.status(503).json({ok:false,errore:code});
    if(/^google_/.test(code))return res.status(401).json({ok:false,errore:"autenticazione_non_valida"});
    console.error("AUTH_SESSION_ERROR",code);
    return res.status(500).json({ok:false,errore:"auth_error"});
  }
};
