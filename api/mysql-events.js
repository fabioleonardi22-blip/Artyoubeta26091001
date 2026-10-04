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
    const slug = String(params.get("evento") || "").trim();

    if (slug) {
      const rows = await query(
        `SELECT e.slug,e.title,e.category,e.event_type,e.price,e.capacity,e.active,
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
      return res.status(200).json({
        ok:true,
        evento:{
          slug:r.slug,
          titolo:r.title,
          categoria:r.category || "",
          tipo:r.event_type || "",
          prezzo:r.price == null ? null : Number(r.price),
          capienza:cap,
          prenotati:booked,
          liberi:Math.max(0, cap-booked),
          attivo:!!r.active
        }
      });
    }

    const rows = await query(
      `SELECT e.slug,e.title,e.category,e.event_type,e.price,e.capacity,e.active,
              COALESCE(SUM(CASE WHEN ${activeBookingWhere()} THEN b.seats ELSE 0 END),0) AS prenotati
       FROM events e
       LEFT JOIN bookings b ON b.event_id=e.id
       WHERE e.active=1
       GROUP BY e.id
       ORDER BY e.sort_order,e.title`
    );

    if (params.get("disponibilita") === "1") {
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
      eventi[r.slug] = {
        slug:r.slug,
        titolo:r.title,
        categoria:r.category || "",
        tipo:r.event_type || "",
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
