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

function isRifMaster(row) {
  const text = String((row && row.slug) || "") + " " + String((row && row.title) || "");
  return /\b(roma|rome)[-_ ]improv[-_ ]festival\b/i.test(text) &&
         !/workshop|spettacolo|show|all[-_ ]in/i.test(text);
}

function defaultRifConfig() {
  return {
    year: 2027,
    language: "inglese",
    audience: "Improvvisatori e improvvisatrici di ogni scuola dal secondo anno di formazione",
    calendar: {
      start: "2027-03-12",
      end: "2027-03-15",
      label: "12–13–14 marzo 2027",
      location: "Via La Spezia 73, Roma",
      description: "Roma Improv Festival 2027 – tre giorni di workshop e spettacoli di improvvisazione teatrale a Roma."
    },
    pricing: [
      {key:"double", label:"Doppio workshop", price:165, note:"2 workshop da 6 ore a scelta", included:"Spettacolo + T-Shirt inclusi"},
      {key:"single", label:"Workshop", price:95, note:"1 workshop da 6 ore a scelta", included:"Spettacolo + T-Shirt inclusi"},
      {key:"special", label:"Workshop Special", price:40, note:"1 workshop da 3 ore", included:"Spettacolo e T-Shirt non inclusi"},
      {key:"show", label:"Spettacolo ALL IN", price:15, note:"Sabato 13 marzo · ore 22:00", included:"Improvvisazione teatrale multi-lingua"},
      {key:"shirt", label:"T-Shirt Festival", price:10, note:"T-Shirt ufficiale del Festival", included:"Gadget ufficiale RIF"},
      {key:"full", label:"Full Festival", price:200, note:"2 workshop da 6 ore + Workshop Special da 3 ore", included:"Eventi e gadget inclusi"}
    ],
    faq: [
      {n:"01", q:"Serve esperienza?", a:"Il festival è pensato per improvvisatori e improvvisatrici di ogni scuola dal secondo anno di formazione. Ogni workshop indica inoltre il livello richiesto e le competenze consigliate."},
      {n:"02", q:"Il festival è in inglese?", a:"Sì. I workshop e gli spettacoli internazionali sono pensati per improvvisatori provenienti da Paesi diversi e si svolgono in inglese."},
      {n:"03", q:"Posso vedere solo gli spettacoli?", a:"Sì. ALL IN è prenotabile anche separatamente per il sabato sera, senza acquistare un workshop."},
      {n:"04", q:"Posso partecipare da fuori Roma?", a:"Sì. Il Roma Improv Festival nasce come punto d'incontro tra la scena romana e improvvisatori e docenti provenienti da altre città e Paesi."}
    ]
  };
}

async function ensureRifConfig(row, meta) {
  if (!isRifMaster(row)) return meta;
  if (meta && meta.rif && typeof meta.rif === "object") return meta;
  // Endpoint pubblico: mai modificare il database durante una lettura GET.
  return Object.assign({}, meta || {}, {rif: defaultRifConfig()});
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
      meta = await ensureRifConfig(r, meta);
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
          rif:meta.rif && typeof meta.rif==="object" ? meta.rif : null,
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
      `SELECT e.id,e.slug,e.title,e.category,e.event_type,e.description,e.poster_url,e.venue,e.address,e.maps_query,e.price,e.capacity,e.active,e.metadata,
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
      meta = await ensureRifConfig(r, meta);
      eventi[r.slug] = {
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
        data:r.date_label || "",
        ora:meta.ora || "",
        ordine:meta.ordine == null ? null : Number(meta.ordine),
        stato:meta.stato || "",
        saggi:meta.saggi || null,
        yepPricing:meta.yepPricing || null,
        rif:meta.rif && typeof meta.rif==="object" ? meta.rif : null,
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
