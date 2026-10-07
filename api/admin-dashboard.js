const { query } = require("../lib/db");
const { requireUser, authErrorStatus } = require("../lib/authorization");
const { rateLimit, applyRateLimitHeaders, rejectRateLimited, sameOrigin, setSecurityHeaders } = require("../lib/security");

function activeBookingWhere() {
  return "(b.status IN ('RISERVATO','PAGATO') OR (b.status='HOLD' AND (b.hold_expires_at IS NULL OR b.hold_expires_at>UTC_TIMESTAMP())))";
}

module.exports = async function handler(req,res) {
  setSecurityHeaders(res);
  const method=String(req.method||"GET").toUpperCase();
  if(!["GET","HEAD"].includes(method)){res.setHeader("Allow","GET, HEAD");return res.status(405).json({ok:false,errore:"method_not_allowed"});}
  if(!sameOrigin(req))return res.status(403).json({ok:false,errore:"origin_non_consentita"});

  const limit=rateLimit(req,{key:"admin-dashboard",limit:90,windowMs:60*1000});
  applyRateLimitHeaders(res,limit);
  if(!limit.ok)return rejectRateLimited(res,limit);

  try {
    await requireUser(req,["admin","staff"]);
    const rows=await query(
      `SELECT e.id,e.slug,e.title,e.category,e.event_type,e.capacity,e.metadata,
              (SELECT ed.date_label FROM event_dates ed WHERE ed.event_id=e.id AND ed.active=1 ORDER BY ed.starts_at,ed.id LIMIT 1) AS date_label,
              COALESCE(SUM(CASE WHEN ${activeBookingWhere()} THEN b.seats ELSE 0 END),0) AS prenotati
       FROM events e
       LEFT JOIN bookings b ON b.event_id=e.id
       WHERE e.active=1
       GROUP BY e.id
       ORDER BY e.sort_order,e.title`
    );

    const eventi={},disponibilita={};
    for(const r of rows){
      let meta={};try{meta=typeof r.metadata==="string"?JSON.parse(r.metadata||"{}"):(r.metadata||{});}catch(_){}
      const cap=Math.max(0,Number(r.capacity||0)),booked=Math.max(0,Number(r.prenotati||0));
      eventi[r.slug]={
        id:String(r.id),slug:String(r.slug||""),titolo:String(r.title||""),
        categoria:String(r.category||""),tipo:String(r.event_type||""),
        data:String(r.date_label||""),ora:String(meta.ora||""),capienza:cap,
        prenotati:booked,liberi:Math.max(0,cap-booked),attivo:true
      };
      disponibilita[r.slug]=Math.max(0,cap-booked);
    }
    return res.status(200).json({ok:true,eventi,disponibilita});
  } catch(err) {
    const code=String(err&&err.message||"errore");
    if(/^google_/.test(code)||code==="google_login_required")return res.status(401).json({ok:false,errore:"google_login_required"});
    if(code==="accesso_non_autorizzato"||code==="permesso_insufficiente"||code==="ruolo_non_valido")return res.status(authErrorStatus(code)).json({ok:false,errore:code});
    console.error("ADMIN_DASHBOARD_ERROR",code);
    return res.status(503).json({ok:false,errore:"mysql_unavailable"});
  }
};
