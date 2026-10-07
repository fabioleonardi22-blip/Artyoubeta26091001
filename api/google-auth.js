const { verifyGoogleIdToken, authToken } = require("../lib/google-auth");
const { query } = require("../lib/db");
const {
  rateLimit,
  applyRateLimitHeaders,
  rejectRateLimited,
  sameOrigin,
  setSecurityHeaders
} = require("../lib/security");

const APPS_SCRIPT_URL = String(process.env.ARTYOU_APPS_SCRIPT_URL || "").trim();
const ALLOW_LEGACY_AUTH = String(process.env.ARTYOU_ALLOW_LEGACY_AUTH || "").toLowerCase() === "true";
const COOKIE = "artyou_id_token";

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
    picture:identity.picture,
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
    authSource:"mysql"
  };
}

async function findMysqlUser(email) {
  const rows = await query(
    "SELECT id,email,display_name,role,active,metadata FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1",
    [email]
  );
  return rows && rows[0] ? rows[0] : null;
}

async function authorizeViaAppsScript(credential) {
  if (!ALLOW_LEGACY_AUTH || !APPS_SCRIPT_URL) return null;
  const url = APPS_SCRIPT_URL + "?action=po_session&token=" + encodeURIComponent(credential) + "&_=" + Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetch(url,{method:"GET",redirect:"follow",signal:controller.signal});
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
  return findMysqlUser(identity.email);
}

function setAuthCookie(res, token) {
  const value = encodeURIComponent(token);
  res.setHeader("Set-Cookie", COOKIE+"="+value+"; Path=/; HttpOnly; Secure; SameSite=Strict");
}

function clearAuthCookie(res) {
  res.setHeader("Set-Cookie", COOKIE+"=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
}

module.exports = async function handler(req,res) {
  setSecurityHeaders(res);
  const method=String(req.method||"GET").toUpperCase();
  if(!["GET","POST","DELETE"].includes(method)){
    res.setHeader("Allow","GET, POST, DELETE");
    return res.status(405).json({ok:false,errore:"method_not_allowed"});
  }
  if(!sameOrigin(req)) return res.status(403).json({ok:false,errore:"origin_non_consentita"});

  const limit=rateLimit(req,{key:"google-auth",limit:30,windowMs:60*1000});
  applyRateLimitHeaders(res,limit);
  if(!limit.ok)return rejectRateLimited(res,limit);

  if(method==="DELETE"){
    clearAuthCookie(res);
    return res.status(200).json({ok:true});
  }

  try{
    let credential="";
    if(method==="POST"){
      let body=req.body||{};
      if(typeof body==="string"){
        if(Buffer.byteLength(body,"utf8")>32*1024)return res.status(413).json({ok:false,errore:"payload_too_large"});
        try{body=JSON.parse(body);}catch(_){return res.status(400).json({ok:false,errore:"json_non_valido"});}
      }
      credential=String(body.credential||"");
    }else{
      credential=authToken(req);
    }
    if(!credential||credential.length>8192)return res.status(401).json({ok:false,errore:"google_login_required"});

    const identity=await verifyGoogleIdToken(credential);
    let user=null;
    try{user=await findMysqlUser(identity.email);}
    catch(dbErr){console.error("MYSQL_AUTH_LOOKUP_ERROR",String(dbErr&&dbErr.message||dbErr));throw new Error("mysql_unavailable");}

    if(!user && method==="POST" && ALLOW_LEGACY_AUTH){
      const legacy=await authorizeViaAppsScript(credential);
      if(legacy) user=await migrateLegacyUser(identity,legacy);
    }
    if(!user||!user.active){
      if(method==="POST")clearAuthCookie(res);
      return res.status(403).json({ok:false,errore:"accesso_non_autorizzato"});
    }

    if(method==="POST")setAuthCookie(res,credential);
    return res.status(200).json(sessionFromUser(identity,user));
  }catch(err){
    const code=String(err&&err.message||"autenticazione_non_valida");
    if(method==="POST")clearAuthCookie(res);
    if(code==="mysql_unavailable")return res.status(503).json({ok:false,errore:code});
    if(/^google_/.test(code))return res.status(401).json({ok:false,errore:"autenticazione_non_valida"});
    return res.status(500).json({ok:false,errore:"auth_error"});
  }
};
