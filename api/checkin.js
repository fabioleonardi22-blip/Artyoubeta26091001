const {
  rateLimit, applyRateLimitHeaders, rejectRateLimited, sameOrigin, setSecurityHeaders
} = require("../lib/security");
const { requireUser, authErrorStatus } = require("../lib/authorization");
const { audit } = require("../lib/audit");

module.exports=async function handler(req,res){
  setSecurityHeaders(res);
  if(req.method!=="POST"){res.setHeader("Allow","POST");return res.status(405).json({ok:false,errore:"method_not_allowed"});}
  if(!sameOrigin(req))return res.status(403).json({ok:false,errore:"origin_non_consentita"});

  const general=rateLimit(req,{key:"checkin-general",limit:90,windowMs:60*1000});
  applyRateLimitHeaders(res,general);if(!general.ok)return rejectRateLimited(res,general);

  let auth;
  try{auth=await requireUser(req,["admin","staff"]);}
  catch(authErr){const code=String(authErr&&authErr.message||"auth_error");return res.status(authErrorStatus(code)).json({ok:false,errore:code});}

  let body=req.body||{};
  if(typeof body==="string"){
    if(Buffer.byteLength(body,"utf8")>16*1024)return res.status(413).json({ok:false,errore:"payload_too_large"});
    try{body=JSON.parse(body);}catch(_){return res.status(400).json({ok:false,errore:"json_non_valido"});}
  }

  const {action,code,event}=body;
  const appsScriptUrl=process.env.ARTYOU_APPS_SCRIPT_URL;
  const scannerSecret=process.env.ARTYOU_SCANNER_SECRET;
  if(!appsScriptUrl||!scannerSecret)return res.status(500).json({ok:false,errore:"scanner_not_configured"});

  const allowed=["lookup","checkin","stats"];
  if(!allowed.includes(String(action||"")))return res.status(400).json({ok:false,errore:"azione_non_valida"});

  const normalizedCode=String(code||"").trim().toUpperCase();
  if(action!=="stats"&&!/^ART-\d{8}-[A-Z0-9]{3,32}$/.test(normalizedCode))return res.status(400).json({ok:false,errore:"codice_non_valido"});
  const normalizedEvent=String(event||"").trim();
  if(normalizedEvent.length>160)return res.status(400).json({ok:false,errore:"evento_non_valido"});

  try{
    const upstream=await fetch(appsScriptUrl,{
      method:"POST",headers:{"content-type":"application/json"},signal:AbortSignal.timeout(15000),
      body:JSON.stringify({action:action==="lookup"?"scanner_lookup":action==="checkin"?"scanner_checkin":"scanner_stats",codice:normalizedCode,evento:normalizedEvent,scannerSecret}),
      redirect:"follow"
    });
    const text=await upstream.text();let data;
    try{data=JSON.parse(text);}catch(_){return res.status(502).json({ok:false,errore:"risposta_apps_script_non_valida"});}
    if(upstream.ok&&data&&data.ok&&action==="checkin")await audit({email:auth.identity.email,role:auth.user.role},"checkin",normalizedCode,{evento:normalizedEvent});
    return res.status(upstream.ok?200:upstream.status).json(data);
  }catch(_){return res.status(502).json({ok:false,errore:"apps_script_non_raggiungibile"});}
};
