// Prenotazioni con MySQL come archivio principale.
//
// Attivo solo con ARTYOU_BOOKING_PRIMARY=mysql (vedi api/artyou.js). Con il valore
// predefinito "sheet" il foglio Google resta la fonte che decide posti e conferme.
//
// Regole riprese dallo Script Google (google-apps-script/Code.gs) per non cambiare
// il comportamento visto dal pubblico:
// - i posti si contano per "chiave evento" come la invia il sito: lo slug per gli
//   eventi a data unica, "<slug>-<indice>" per le pagine con più date (indice della
//   data attiva, ordinate per starts_at,id come in /api/events);
// - occupano posti RISERVATO, PAGATO e HOLD non scaduti;
// - HOLD dura 15 minuti, solo per pagamenti online;
// - importo = prezzo × posti quando l'evento ha un prezzo unico e non ci sono Scelte;
// - codice "ART-aaaammgg-XXXXXX" (data di Roma), leggibile dallo scanner.
//
// La sovravendita è impedita da un lock sulla riga dell'evento (SELECT … FOR UPDATE):
// due prenotazioni per lo stesso evento vengono servite una dopo l'altra, quella
// arrivata seconda vede i posti già presi dalla prima.

const { getPool, query } = require("./db");

const HOLD_MINUTES = 15;
const ACTIVE_STATUSES = ["HOLD", "RISERVATO", "PAGATO", "SCADUTO", "ANNULLATO"];
const MAX_CODE_ATTEMPTS = 6;

function primaryMode() {
  return String(process.env.ARTYOU_BOOKING_PRIMARY || "sheet").trim().toLowerCase() === "mysql" ? "mysql" : "sheet";
}

function activeWhere(alias) {
  const b = alias ? alias + "." : "";
  return `(${b}status IN ('RISERVATO','PAGATO') OR (${b}status='HOLD' AND (${b}hold_expires_at IS NULL OR ${b}hold_expires_at>UTC_TIMESTAMP())))`;
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch (_) { return {}; }
}

function toNumber(value) {
  if (value == null || value === "") return NaN;
  return parseFloat(String(value).replace(",", ".").replace(/[^0-9.]/g, ""));
}

// "slug-2" → { slug:"slug", index:2 }
function splitIndexedKey(key) {
  const m = String(key || "").toLowerCase().match(/^([a-z0-9]+(?:-[a-z0-9]+)*)-(\d{1,2})$/);
  return m ? { slug: m[1], index: Number(m[2]) } : null;
}

// Stesso formato dello Script Google reale ("ART-aaaammgg-XXXX"): lo scanner
// riconosce solo /ART-\d{8}-[A-Z0-9]+/. Qui 6 caratteri invece di 4 per ridurre
// le collisioni; l'unicità è comunque garantita dalla chiave univoca in MySQL.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function bookingCode(now, suffix) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now || new Date())) parts[p.type] = p.value;
  let tail = suffix;
  if (tail == null) {
    const bytes = require("crypto").randomBytes(6);
    tail = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  }
  return `ART-${parts.year}${parts.month}${parts.day}-${tail}`;
}

function serverAmount(price, seats, data) {
  const p = toNumber(price);
  if (Number.isFinite(p) && p > 0 && !String(data.Scelte || "").trim()) return (p * seats).toFixed(2);
  return String(data.Importo || "").trim().slice(0, 40);
}

function isOnlinePayment(pagamento) {
  return /paypal|online|carta|stripe/i.test(String(pagamento || ""));
}

async function rowsOf(conn, sql, params) {
  if (conn) { const [rows] = await conn.execute(sql, params || []); return rows; }
  return query(sql, params);
}

async function activeDates(conn, eventId) {
  return rowsOf(conn,
    "SELECT id,capacity_override,price_override FROM event_dates WHERE event_id=? AND active=1 ORDER BY starts_at,id",
    [eventId]);
}

// Trova evento (ed eventuale data) per la chiave inviata dal sito.
// Stesso ordine di ricerca di findEventId in api/artyou.js.
async function resolveTarget(conn, rawKey) {
  const key = String(rawKey || "").trim();
  if (!key) return null;
  const cols = "id,slug,title,price,capacity,active,metadata";
  let rows = await rowsOf(conn, `SELECT ${cols} FROM events WHERE slug=? AND active=1 LIMIT 1`, [key.toLowerCase()]);
  if (!rows.length) rows = await rowsOf(conn,
    `SELECT ${cols} FROM events WHERE active=1 AND JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.legacyKey'))=? LIMIT 1`, [key]);
  if (!rows.length) {
    const byTitle = await rowsOf(conn, `SELECT ${cols} FROM events WHERE LOWER(title)=LOWER(?) AND active=1 LIMIT 2`, [key]);
    if (byTitle.length === 1) rows = byTitle;
  }
  if (rows.length) return { key, event: rows[0], date: null };

  const indexed = splitIndexedKey(key);
  if (!indexed) return null;
  rows = await rowsOf(conn, `SELECT ${cols} FROM events WHERE slug=? AND active=1 LIMIT 1`, [indexed.slug]);
  if (!rows.length) return null;
  const dates = await activeDates(conn, rows[0].id);
  const date = dates[indexed.index];
  if (!date) return null;
  return { key, event: rows[0], date };
}

function capacityOf(target) {
  if (target.date && target.date.capacity_override != null) return Math.max(0, Number(target.date.capacity_override));
  return Math.max(0, Number(target.event.capacity || 0));
}

function priceOf(target) {
  if (target.date && target.date.price_override != null) return target.date.price_override;
  return target.event.price;
}

// Posti occupati per la chiave. Per una data specifica contano le prenotazioni di
// quella data e quelle copiate dal foglio prima del passaggio (senza event_date_id)
// che riportano la stessa chiave.
async function usedSeats(conn, target) {
  if (target.date) {
    const rows = await rowsOf(conn,
      `SELECT COALESCE(SUM(seats),0) AS used FROM bookings
        WHERE event_id=? AND ${activeWhere("")}
          AND (event_date_id=? OR (event_date_id IS NULL
               AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.evento_richiesto')))=LOWER(?)))`,
      [target.event.id, target.date.id, target.key]);
    return Number(rows[0].used || 0);
  }
  const rows = await rowsOf(conn,
    `SELECT COALESCE(SUM(seats),0) AS used FROM bookings WHERE event_id=? AND ${activeWhere("")}`,
    [target.event.id]);
  return Number(rows[0].used || 0);
}

async function seatsLeft(rawKey) {
  const target = await resolveTarget(null, rawKey);
  if (!target) return null;
  return Math.max(0, capacityOf(target) - await usedSeats(null, target));
}

// Mappa compatibile con ?disponibilita=1 dello Script Google: slug, chiave storica
// e, per gli eventi con più date, "<slug>-<indice>".
async function availabilityMap() {
  const events = await query("SELECT id,slug,title,price,capacity,active,metadata FROM events WHERE active=1");
  const out = {};
  for (const event of events) {
    const legacyKey = String(parseJson(event.metadata).legacyKey || "").trim();
    const whole = { key: event.slug, event, date: null };
    const left = Math.max(0, capacityOf(whole) - await usedSeats(null, whole));
    out[event.slug] = left;
    if (legacyKey && !(legacyKey in out)) out[legacyKey] = left;
    const dates = await activeDates(null, event.id);
    if (dates.length > 1) {
      for (let i = 0; i < dates.length; i++) {
        const t = { key: `${event.slug}-${i}`, event, date: dates[i] };
        out[t.key] = Math.max(0, capacityOf(t) - await usedSeats(null, t));
      }
    }
  }
  return out;
}

// Crea la prenotazione in una transazione. Restituisce lo stesso formato di risposta
// dello Script Google (ok, id, stato, liberi, holdMinutes) più codice e importo.
async function createBooking(data, opts) {
  const now = (opts && opts.now) || new Date();
  const seats = Math.max(1, Math.min(10, parseInt(data.Posti || "1", 10) || 1));
  const pagamento = String(data.Pagamento || "In cassa").trim() || "In cassa";

  // Ricerca dell'evento fuori dalla transazione: una lettura fatta dentro, prima del
  // lock, fisserebbe la "fotografia" REPEATABLE READ e il conteggio dei posti non
  // vedrebbe le prenotazioni confermate nel frattempo da altri (sovravendita).
  const found = await resolveTarget(null, data.Evento);
  if (!found) return { ok: false, errore: "evento_non_trovato" };

  const conn = await getPool().getConnection();
  try {
    // READ COMMITTED: ogni lettura dopo il lock vede le prenotazioni già confermate.
    await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await conn.beginTransaction();

    // Lock sulla riga dell'evento: serializza le prenotazioni concorrenti dello stesso evento.
    // È la prima istruzione della transazione.
    const [locked] = await conn.execute("SELECT id,active,capacity,price FROM events WHERE id=? FOR UPDATE", [found.event.id]);
    if (!locked.length || !Number(locked[0].active)) { await conn.rollback(); return { ok: false, errore: "evento_non_attivo" }; }
    const target = { ...found, event: { ...found.event, ...locked[0] } };
    if (target.date) {
      const [d] = await conn.execute("SELECT id,capacity_override,price_override,active FROM event_dates WHERE id=?", [target.date.id]);
      if (!d.length || !Number(d[0].active)) { await conn.rollback(); return { ok: false, errore: "evento_non_attivo" }; }
      target.date = d[0];
    }

    await conn.execute(
      "UPDATE bookings SET status='SCADUTO' WHERE event_id=? AND status='HOLD' AND hold_expires_at IS NOT NULL AND hold_expires_at<=UTC_TIMESTAMP()",
      [target.event.id]);

    const liberi = Math.max(0, capacityOf(target) - await usedSeats(conn, target));
    if (seats > liberi) { await conn.rollback(); return { ok: false, errore: "esaurito", liberi }; }

    const online = isOnlinePayment(pagamento);
    const stato = online ? "HOLD" : "RISERVATO";
    const holdExpiresAt = online ? new Date(now.getTime() + HOLD_MINUTES * 60000) : null;
    const importo = serverAmount(priceOf(target), seats, data);
    const metadata = JSON.stringify({
      source: "mysql_primary",
      evento_richiesto: String(data.Evento || "").trim(),
      pagamento, importo,
      scelte: String(data.Scelte || ""), risorse: String(data.Risorse || ""),
      camera: String(data.camera || ""), cibo: String(data.cibo || ""), scuola: String(data.scuola || ""),
      sheet_sync: "pending"
    });

    let code = null;
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !code; attempt++) {
      const candidate = bookingCode(now, opts && opts.random != null && attempt === 0 ? opts.random : null);
      try {
        await conn.execute(
          `INSERT INTO bookings
            (public_id,event_id,event_date_id,first_name,last_name,email,phone,seats,status,hold_expires_at,checkin_code,privacy_accepted,notes,metadata)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [candidate, target.event.id, target.date ? target.date.id : null,
            String(data.Nome || "").trim(), String(data.Cognome || "").trim(),
            String(data.Email || "").trim().toLowerCase(), String(data.Telefono || "").trim(),
            seats, stato, holdExpiresAt, candidate, data.Privacy === true || /^s[iì]$/i.test(String(data["Privacy accettata"] || "")) ? 1 : 0,
            String(data.Note || "").trim(), metadata]);
        code = candidate;
      } catch (err) {
        if (!(err && (err.code === "ER_DUP_ENTRY" || err.errno === 1062))) throw err;
      }
    }
    if (!code) throw new Error("codice_prenotazione_non_generato");

    await conn.commit();
    return {
      ok: true, id: code, codice: code, stato,
      liberi: liberi - seats,
      holdMinutes: online ? HOLD_MINUTES : 0,
      importo, posti: seats, pagamento,
      scadenzaHold: holdExpiresAt ? holdExpiresAt.toISOString() : ""
    };
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

// Conferma pagamento / annullamento sull'archivio principale.
// Restituisce false se il codice non esiste in MySQL.
async function setBookingStatus(code, status) {
  if (!ACTIVE_STATUSES.includes(status)) throw new Error("stato_non_valido");
  const guard = status === "PAGATO" ? " AND status IN ('HOLD','RISERVATO','PAGATO')" : "";
  const result = await query(`UPDATE bookings SET status=?, hold_expires_at=NULL WHERE public_id=?${guard}`, [status, code]);
  if (Number(result.affectedRows || 0) > 0) return true;
  const exists = await query("SELECT status FROM bookings WHERE public_id=? LIMIT 1", [code]);
  if (exists.length) throw new Error(status === "PAGATO" ? "prenotazione_non_confermabile" : "operazione_non_riuscita");
  return false;
}

async function markSheetSync(code, ok, detail) {
  await query(
    "UPDATE bookings SET metadata=JSON_SET(COALESCE(metadata,JSON_OBJECT()),'$.sheet_sync',?,'$.sheet_sync_at',?,'$.sheet_sync_error',?) WHERE public_id=?",
    [ok ? "ok" : "failed", new Date().toISOString(), ok ? "" : String(detail || "").slice(0, 300), code]);
}

module.exports = {
  HOLD_MINUTES, primaryMode, bookingCode, serverAmount, isOnlinePayment, splitIndexedKey,
  resolveTarget, seatsLeft, availabilityMap, createBooking, setBookingStatus, markSheetSync, activeWhere
};
