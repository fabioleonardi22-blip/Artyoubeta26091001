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
const bookingStore = require("../lib/booking-store");
const { copyAfterResponse } = require("../lib/sheet-copy");

// Letture di posti e disponibilità quando MySQL è l'archivio principale.
// Stesso formato di risposta dello Script Google.
async function mysqlRead(req, res, params) {
  try {
    if (params.get("eventi") === "1") return require("./mysql-events")(req, res);
    if (params.get("disponibilita") === "1") {
      return res.status(200).json({ ok:true, disponibilita: await bookingStore.availabilityMap() });
    }
    const evento = String(params.get("evento") || "").trim().slice(0, 180);
    if (evento) {
      const liberi = await bookingStore.seatsLeft(evento);
      return res.status(200).json({ ok:true, evento, liberi: liberi == null ? 0 : liberi });
    }
    return res.status(200).json({ ok:true, message:"Artyou booking endpoint attivo" });
  } catch (err) {
    console.error("ARTYOU_MYSQL_READ_ERROR", String(err && err.message || err));
    return reject(res, 503, "disponibilita_non_disponibile");
  }
}

// Prenotazione decisa da MySQL; il foglio riceve una copia dopo la risposta.
async function mysqlBooking(res, data) {
  let booking;
  try { booking = await bookingStore.createBooking(data); }
  catch (err) {
    console.error("ARTYOU_MYSQL_BOOKING_ERROR", String(err && err.message || err));
    return reject(res, 503, "prenotazioni_temporaneamente_non_disponibili");
  }
  if (!booking.ok) return res.status(200).json(booking);
  const pending = copyAfterResponse(data, booking);
  if (pending) await pending;
  return res.status(200).json({
    ok:true, id:booking.id, codice:booking.codice, stato:booking.stato, liberi:booking.liberi,
    holdMinutes:booking.holdMinutes, storage:"mysql", persistenceConfirmed:true
  });
}

const UPSTREAM_TIMEOUT_MS = 15000;

// Parametri di lettura che il sito può legittimamente chiedere all'Apps Script.
const ALLOWED_GET_PARAMS = new Set(["action", "eventi", "disponibilita", "evento", "_"]);

// Campi che solo il server può decidere: il browser non deve poterli impostare.
const SERVER_FIELDS = new Set(["ID", "id", "Timestamp", "Stato", "stato", "ScadenzaHold", "Azione", "adminSecret", "scannerSecret", "pin", "token"]);
const MAX_FIELDS = 40;
const MAX_FIELD_LENGTH = 4000;

function reject(res, status, errore) {
  setSecurityHeaders(res);
  return res.status(status).json({ ok: false, errore });
}

function validText(value, max) {
  return String(value == null ? "" : value).trim().length <= max;
}

// Consenso esplicito: checkbox #f-privacy (Privacy=true) o modulo iscrizioni ("Privacy accettata": "Sì").
function privacyAccepted(parsed) {
  if (parsed.Privacy === true) return true;
  return /^s[iì]$/i.test(String(parsed["Privacy accettata"] || "").trim());
}

function sanitizeBooking(parsed) {
  const out = {};
  let count = 0;
  for (const key of Object.keys(parsed || {})) {
    if (SERVER_FIELDS.has(key)) continue;
    if (!/^[A-Za-z_][A-Za-z0-9_ ]{0,39}$/.test(key)) continue;
    if (count >= MAX_FIELDS) break;
    let value = parsed[key];
    if (value !== null && typeof value === "object") value = JSON.stringify(value);
    if (typeof value === "string" && value.length > MAX_FIELD_LENGTH) value = value.slice(0, MAX_FIELD_LENGTH);
    out[key] = value;
    count++;
  }
  out.action = "prenota";
  return out;
}

function upstreamQuery(raw) {
  const params = new URLSearchParams(raw);
  const out = new URLSearchParams();
  for (const [key, value] of params) {
    if (ALLOWED_GET_PARAMS.has(key) && !out.has(key)) out.set(key, String(value).slice(0, 200));
  }
  return out.toString();
}

// Trova l'evento MySQL corrispondente alla prenotazione: prima per slug, poi per
// chiave storica dell'Apps Script salvata in metadata.legacyKey, infine per titolo.
async function findEventId(evento) {
  const key = String(evento || "").trim();
  if (!key) return null;
  let rows = await query("SELECT id FROM events WHERE slug=? AND active=1 LIMIT 1", [key.toLowerCase()]);
  if (rows.length) return rows[0].id;
  rows = await query(
    "SELECT id FROM events WHERE active=1 AND JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.legacyKey'))=? LIMIT 1",
    [key]
  );
  if (rows.length) return rows[0].id;
  rows = await query("SELECT id FROM events WHERE LOWER(title)=LOWER(?) AND active=1 LIMIT 2", [key]);
  if (rows.length === 1) return rows[0].id;
  // Le pagine spettacolo con più date inviano "<slug>-<indice data>" (js/spettacolo-logic.js, slugId).
  const indexed = key.toLowerCase().match(/^([a-z0-9]+(?:-[a-z0-9]+)*)-(\d{1,2})$/);
  if (indexed) {
    rows = await query("SELECT id FROM events WHERE slug=? AND active=1 LIMIT 1", [indexed[1]]);
    if (rows.length) return rows[0].id;
  }
  return null;
}

async function mirrorBookingToMysql(requestData, upstreamData) {
  if (!(process.env.DATABASE_URL || process.env.MYSQL_URL)) {
    return { ok:false, skipped:true, reason:"mysql_not_configured" };
  }

  const code = String(
    (upstreamData && (upstreamData.codice || upstreamData.id)) || ""
  ).trim();
  if (!code) return { ok:false, skipped:true, reason:"booking_code_missing" };

  const eventId = await findEventId(requestData.Evento);
  if (!eventId) {
    return { ok:false, skipped:true, reason:"event_not_found" };
  }

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
    evento_richiesto: String(requestData.Evento || ""),
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
    const rawQuery = qIndex >= 0 ? rawUrl.slice(qIndex + 1) : "";
    const params = new URLSearchParams(rawQuery);
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
    const mysqlPrimary = bookingStore.primaryMode() === "mysql";
    if ((method === "GET" || method === "HEAD") && mysqlPrimary) return mysqlRead(req, res, params);
    if (!APPS_SCRIPT_URL) return reject(res,503,"backend_non_configurato");
    let url = APPS_SCRIPT_URL;
    const forwarded = method === "POST" ? "" : upstreamQuery(rawQuery);
    if (forwarded) url += "?" + forwarded;
    const options = { method, redirect: "follow", headers: {}, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) };
    let isGenericRequest = false;

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
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return reject(res, 400, "json_non_valido");
      }

      if (String(parsed._hp || "").trim()) {
        return res.status(200).json({ ok:true });
      }

      // "prenota" = posti per un evento; "richiesta" = iscrizione a un corso o altra richiesta senza evento.
      const postAction = String(parsed.action || "").toLowerCase();
      if (postAction !== "prenota" && postAction !== "richiesta") {
        return reject(res, 403, "azione_non_consentita");
      }
      isGenericRequest = postAction === "richiesta";

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

      if ((!isGenericRequest && !String(parsed.Evento || "").trim()) ||
          (isGenericRequest && !String(parsed.Corso || parsed.Modulo || "").trim()) ||
          !String(parsed.Nome || "").trim() ||
          !String(parsed.Cognome || "").trim()) {
        return reject(res, 400, "campi_obbligatori_mancanti");
      }

      const email = String(parsed.Email || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reject(res, 400, "email_non_valida");
      }

      if(!privacyAccepted(parsed))return reject(res,400,"privacy_obbligatoria");
      // The old PayPal URL trusted a client amount and had no verified callback.
      if(/^PayPal/i.test(String(parsed.Pagamento||"")))return reject(res,503,"pagamento_online_non_disponibile");
      if(!isGenericRequest&&!(await findEventId(parsed.Evento)))return reject(res,400,"evento_non_trovato");
      // Le iscrizioni ai corsi ("richiesta") restano sul foglio in entrambe le modalità.
      if (mysqlPrimary && !isGenericRequest) return mysqlBooking(res, sanitizeBooking(parsed));
      options.headers["Content-Type"] = "text/plain;charset=utf-8";
      options.body = JSON.stringify(sanitizeBooking(parsed));
    }

    const upstream = await fetch(url, options);
    const body = await upstream.text();

    if (method === "POST" && upstream.ok) {
      let data;try{data=JSON.parse(body);}catch(_){return reject(res,502,"booking_response_invalid");}
      // Le richieste generiche (iscrizioni ai corsi) non sono prenotazioni di posti: niente copia in MySQL.
      if(data&&data.ok&&isGenericRequest)return res.status(200).json(data);
      if(data&&data.ok){
        let persisted;try{persisted=await mirrorBookingToMysql(JSON.parse(options.body||"{}"),data);}catch(err){console.error("ARTYOU_MYSQL_MIRROR_ERROR",String(err&&err.message||err));persisted={ok:false};}
        if(persisted&&persisted.skipped)console.warn("ARTYOU_MYSQL_MIRROR_SKIPPED",persisted.reason);
        return res.status(persisted.ok?200:202).json({...data,storage:persisted.ok?"mysql":"reconciliation_pending",persistenceConfirmed:!!persisted.ok,
          ...(!persisted.ok?{avviso:"Prenotazione ricevuta dalla fonte originale; persistenza MySQL da verificare. Non ripetere l’invio.",paymentUrl:null}:{} )});
      }
    }

    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.send(body);
  } catch (err) {
    if (err && (err.name === "TimeoutError" || err.name === "AbortError")) return reject(res, 504, "backend_timeout");
    return reject(res, 502, "proxy_error");
  }
};
