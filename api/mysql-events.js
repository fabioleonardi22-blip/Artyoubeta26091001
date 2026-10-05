const { query } = require("../lib/db");
const {
  rateLimit,
  applyRateLimitHeaders,
  rejectRateLimited,
  setSecurityHeaders
} = require("../lib/security");

function activeBookingWhere() {
  return "(b.status IN ('RISERVATO','PAGATO') OR (b.status='HOLD' AND (b.hold_expires_at IS NULL OR b.hold_expires_at>UTC_TIMESTAMP())))";
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);

  const method = String(req.method || "GET").toUpperCase();
  if (!["GET","HEAD"].includes(method)) {
    res.setHeader("Allow","GET, HEAD");
    return res.status(405).json({ok:false, errore:"method_not_allowed"});
  }

  const limit = rateLimit(req, {key:"mysql-events-read", limit:180, windowMs:60*1000});
  applyRateLimitHeaders(res, limit);
  if (!limit.ok) return rejectRateLimited(res, limit);

  try {
    const rawUrl = String(req.url || "");
    const qIndex = rawUrl.indexOf("?");
    const params = new URLSearchParams(qIndex >= 0 ? rawUrl.slice(qIndex+1) : "");
    const qs = req.query || {};
    const slug = String(qs.evento || params.get("evento") || "").trim();
    const wantsDisponibilita = String(qs.disponibilita || params.get("disponibilita") || "") === "1";

    if (slug) {
      const rows = await query(
        `SELECT e.id,e.slug,e.title,e.category,e.event_type,e.description,e.poster_url,e.venue,e.address,e.maps_query,
                e.price,e.capacity,e.online_payment,e.tbd,e.active,e.sort_order,e.metadata,
                COALESCE(SUM(CASE WHEN ${activeBookingWhere()} THEN b.seats ELSE 0 END),0) AS prenotati
         FROM events e
         LEFT JOIN bookings b ON b.event_id=e.id
         WHERE e.slug=?
         GROUP BY e.id
         LIMIT 1`, [slug]
      );
      if (!rows.length) return res.status(404).json({ok:false, errore:"evento_non_trovato"});
      const r = rows[0];
      const cap = Number(r.capacity || 0);
      const booked = Number(r.prenotati || 0);
      let meta = {};
      try { meta = typeof r.metadata === "string" ? JSON.parse(r.metadata || "{}") : (r.metadata || {}); } catch (_) {}
      const dateRows = await query(
        "SELECT id,starts_at,date_label,capacity_override,price_override,active,metadata FROM event_dates WHERE event_id=? AND active=1 ORDER BY starts_at,id",
        [r.id]
      );
      const dates = dateRows.map(function(d){
        let dm={}; try{dm=typeof d.metadata==="string"?JSON.parse(d.metadata||"{}"):(d.metadata||{});}catch(_){}
        let label=String(d.date_label||"");
        if(!label && d.starts_at){
          const x=new Date(d.starts_at);
          if(!isNaN(x.getTime())){
            label=String(x.getUTCDate()).padStart(2,"0")+"/"+String(x.getUTCMonth()+1).padStart(2,"0")+"/"+x.getUTCFullYear();
            const hh=String(x.getUTCHours()).padStart(2,"0"), mm=String(x.getUTCMinutes()).padStart(2,"0");
            if(hh!=="00"||mm!=="00") label+=" · "+hh+":"+mm;
          }
        }
        return {label:label,sold:0,metadata:dm};
      });
      return res.status(200).json({
        ok:true,
        evento:{
          id:String(r.id),
          slug:r.slug,
          titolo:r.title,
          categoria:r.category || "",
          tipo:r.event_type || "",
          descrizione:r.description || "",
          poster:r.poster_url || "",
          luogo:r.venue || "",
          indirizzo:r.address || "",
          maps:r.maps_query || "",
          data:(dates[0]&&dates[0].label)||"",
          dates:dates,
          ora:meta.ora || "",
          ordine:r.sort_order == null ? (meta.ordine == null ? null : Number(meta.ordine)) : Number(r.sort_order),
          stato:meta.stato || "",
          saggi:meta.saggi || null,
          yepPricing:meta.yepPricing || null,
          cast:Array.isArray(meta.cast)?meta.cast:[],
          pagaOnline:!!r.online_payment,
          tbd:!!r.tbd,
          prezzo:r.price == null ? null : Number(r.price),
          capienza:cap,
          prenotati:booked,
          liberi:Math.max(0, cap-booked),
          attivo:!!r.active
        }
      });
    }

    const rows = await query(
      `SELECT e.slug,e.title,e.category,e.event_type,e.description,e.price,e.capacity,e.active,e.metadata,
                (SELECT ed.date_label FROM event_dates ed WHERE ed.event_id=e.id AND ed.active=1 ORDER BY ed.starts_at,ed.id LIMIT 1) AS date_label,
              COALESCE(SUM(CASE WHEN ${activeBookingWhere()} THEN b.seats ELSE 0 END),0) AS prenotati
       FROM events e
       LEFT JOIN bookings b ON b.event_id=e.id
       WHERE e.active=1
       GROUP BY e.id
       ORDER BY e.sort_order,e.title`
    );

    if (wantsDisponibilita) {
      const disponibilita = {};
      for (const r of rows) {
        disponibilita[r.slug] = Math.max(0, Number(r.capacity||0)-Number(r.prenotati||0));
      }
      return res.status(200).json({ok:true, disponibilita});
    }

    const eventi = {};
    for (const r of rows) {
      const cap = Number(r.capacity || 0);
      const booked = Number(r.prenotati || 0);
      let meta = {};
      try { meta = typeof r.metadata === "string" ? JSON.parse(r.metadata || "{}") : (r.metadata || {}); } catch (_) {}
      eventi[r.slug] = {
        slug:r.slug,
        titolo:r.title,
        categoria:r.category || "",
        tipo:r.event_type || "",
        descrizione:r.description || "",
        data:r.date_label || "",
        ora:meta.ora || "",
        ordine:meta.ordine == null ? null : Number(meta.ordine),
        stato:meta.stato || "",
        saggi:meta.saggi || null,
        yepPricing:meta.yepPricing || null,
        prezzo:r.price == null ? null : Number(r.price),
        capienza:cap,
        prenotati:booked,
        liberi:Math.max(0,cap-booked),
        attivo:true
      };
    }
    return res.status(200).json({ok:true,eventi});
  } catch (err) {
    console.error("MYSQL_EVENTS_ERROR", String(err && err.message || err));
    return res.status(503).json({ok:false, errore:"mysql_unavailable"});
  }
};
