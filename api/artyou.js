const {
  rateLimit,
  applyRateLimitHeaders,
  rejectRateLimited,
  sameOrigin,
  setSecurityHeaders
} = require("../lib/security");

const APPS_SCRIPT_URL = String(process.env.ARTYOU_APPS_SCRIPT_URL || "").trim();
const { query } = require("../lib/db");
const { persistentRateLimit } = require("../lib/persistent-rate-limit");

function reject(res, status, errore) {
  setSecurityHeaders(res);
  return res.status(status).json({ ok: false, errore });
}

function validText(value, max) {
  return String(value == null ? "" : value).trim().length <= max;
}

async function mirrorBookingToMysql(requestData, upstreamData) {
  if (!(process.env.DATABASE_URL || process.env.MYSQL_URL)) {
    return { ok:false, skipped:true, reason:"mysql_not_configured" };
  }

  const code = String(
    (upstreamData && (upstreamData.codice || upstreamData.id)) || ""
  ).trim();
  if (!code) return { ok:false, skipped:true, reason:"booking_code_missing" };

  const slug = String(requestData.Evento || "").trim();
  const rows = await query("SELECT id FROM events WHERE slug=? LIMIT 1", [slug]);
  if (!rows.length) {
    return { ok:false, skipped:true, reason:"event_not_found" };
  }

  const eventId = rows[0].id;
  const seats = Math.max(1, Math.min(10, Number(requestData.Posti || 1)));
  const status = String(upstreamData.stato || "RISERVATO").toUpperCase();
  const safeStatus = ["HOLD","RISERVATO","PAGATO","SCADUTO","ANNULLATO"].includes(status)
    ? status : "RISERVATO";

  const holdMinutes = Math.max(0, Number(upstreamData.holdMinutes || 0));
  const holdExpiresAt = safeStatus === "HOLD" && holdMinutes > 0
    ? new Date(Date.now() + holdMinutes * 60000)
    : null;

  const metadata = JSON.stringify({
    migration_source: "dual_write",
    pagamento: String(requestData.Pagamento || ""),
    importo: String(requestData.Importo || ""),
    scelte: String(requestData.Scelte || ""),
    risorse: String(requestData.Risorse || ""),
    camera: String(requestData.camera || ""),
    cibo: String(requestData.cibo || ""),
    scuola: String(requestData.scuola || "")
  });

  await query(
    `INSERT INTO bookings
      (public_id,event_id,first_name,last_name,email,phone,seats,status,hold_expires_at,checkin_code,privacy_accepted,notes,metadata)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       status=IF(status='PAGATO',status,VALUES(status)),
       hold_expires_at=IF(status='PAGATO',NULL,VALUES(hold_expires_at)),
       updated_at=CURRENT_TIMESTAMP`,
    [
      code,
      eventId,
      String(requestData.Nome || "").trim(),
      String(requestData.Cognome || "").trim(),
      String(requestData.Email || "").trim().toLowerCase(),
      String(requestData.Telefono || "").trim(),
      seats,
      safeStatus,
      holdExpiresAt,
      code,
      requestData.Privacy === true ? 1 : 0,
      String(requestData.Note || "").trim(),
      metadata
    ]
  );
  return { ok:true, code };
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);


  try {
    const method = String(req.method || "GET").toUpperCase();
    if (!["GET", "HEAD", "POST"].includes(method)) {
      res.setHeader("Allow", "GET, HEAD, POST");
      return reject(res, 405, "method_not_allowed");
    }

    const rawUrl = String(req.url || "");
    const qIndex = rawUrl.indexOf("?");
    const query = qIndex >= 0 ? rawUrl.slice(qIndex + 1) : "";
    const params = new URLSearchParams(query);
    const queryAction = String(params.get("action") || "").toLowerCase();

    if (method === "GET" || method === "HEAD") {
      const limit = rateLimit(req, { key:"booking-read", limit:180, windowMs:60 * 1000 });
      applyRateLimitHeaders(res, limit);
      if (!limit.ok) return rejectRateLimited(res, limit);

      if (queryAction && queryAction !== "public") {
        return reject(res, 403, "azione_non_consentita");
      }
    }

    if ((method === "GET" || method === "HEAD") && queryAction === "public") return require("./events")(req,res);
    if (!APPS_SCRIPT_URL) return reject(res,503,"backend_non_configurato");
    let url = APPS_SCRIPT_URL;
    if (query) url += "?" + query;
    const options = { method, redirect: "follow", headers: {} };

    if (method === "POST") {
      if (!sameOrigin(req)) {
        return reject(res, 403, "origin_non_consentita");
      }

      let limit;
      try { limit = await persistentRateLimit(req,{key:"booking-write",limit:15,windowMs:10*60*1000}); }
      catch (_) { limit = rateLimit(req,{key:"booking-write-fallback",limit:15,windowMs:10*60*1000}); }
      applyRateLimitHeaders(res,limit);
      if(!limit.ok)return rejectRateLimited(res,limit);

      const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      if (Buffer.byteLength(raw, "utf8") > 32 * 1024) {
        return reject(res, 413, "payload_too_large");
      }

      let parsed = {};
      try { parsed = JSON.parse(raw || "{}"); }
      catch (_) { return reject(res, 400, "json_non_valido"); }

      if (String(parsed._hp || "").trim()) {
        return res.status(200).json({ ok:true });
      }

      if (String(parsed.action || "").toLowerCase() !== "prenota") {
        return reject(res, 403, "azione_non_consentita");
      }

      const posti = Number(parsed.Posti || 1);
      if (!Number.isInteger(posti) || posti < 1 || posti > 10) {
        return reject(res, 400, "posti_non_validi");
      }

      if (!validText(parsed.Evento, 180) ||
          !validText(parsed.Nome, 100) ||
          !validText(parsed.Cognome, 100) ||
          !validText(parsed.Telefono, 40) ||
          !validText(parsed.Email, 180) ||
          !validText(parsed.Note, 2000) ||
          !validText(parsed.Scelte, 1000) ||
          !validText(parsed.Risorse, 1000)) {
        return reject(res, 400, "dati_non_validi");
      }

      if (!String(parsed.Evento || "").trim() ||
          !String(parsed.Nome || "").trim() ||
          !String(parsed.Cognome || "").trim()) {
        return reject(res, 400, "campi_obbligatori_mancanti");
      }

      const email = String(parsed.Email || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reject(res, 400, "email_non_valida");
      }

      if(parsed.Privacy!==true)return reject(res,400,"privacy_obbligatoria");
      // The old PayPal URL trusted a client amount and had no verified callback.
      if(/^PayPal/i.test(String(parsed.Pagamento||"")))return reject(res,503,"pagamento_online_non_disponibile");
      const events=await require("../lib/db").query("SELECT id FROM events WHERE slug=? AND active=1 LIMIT 1",[String(parsed.Evento).trim()]);
      if(!events.length)return reject(res,400,"evento_non_trovato");
      options.headers["Content-Type"] = "text/plain;charset=utf-8";
      options.body = JSON.stringify(parsed);
    }

    const upstream = await fetch(url, options);
    const body = await upstream.text();

    if (method === "POST" && upstream.ok) {
      let data;try{data=JSON.parse(body);}catch(_){return reject(res,502,"booking_response_invalid");}
      if(data&&data.ok){
        let persisted;try{persisted=await mirrorBookingToMysql(JSON.parse(options.body||"{}"),data);}catch(_){persisted={ok:false};}
        return res.status(persisted.ok?200:202).json({...data,storage:persisted.ok?"mysql":"reconciliation_pending",persistenceConfirmed:!!persisted.ok,
          ...(!persisted.ok?{avviso:"Prenotazione ricevuta dalla fonte originale; persistenza MySQL da verificare. Non ripetere l’invio.",paymentUrl:null}:{} )});
      }
    }

    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.send(body);
  } catch (_) {
    return reject(res, 502, "proxy_error");
  }
};
