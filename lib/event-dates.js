// Interpretazione delle date degli eventi scritte come testo libero nel gestionale
// ("04/10/2026 · 21:00", "2026-10-04", "4 ottobre 2026 ore 21:00").
// Le etichette sono orari di Roma; vedi sotto la convenzione di `starts_at`.

function pad(n) { return String(n).padStart(2, "0"); }

const MONTHS = {
  gennaio:1, febbraio:2, marzo:3, aprile:4, maggio:5, giugno:6,
  luglio:7, agosto:8, settembre:9, ottobre:10, novembre:11, dicembre:12
};

function parseDateLabel(label, now) {
  const s = String(label || "").trim();
  if (!s) return { date:"", start:"" };
  const tm = s.match(/(?:^|[^0-9])(\d{1,2})[:.](\d{2})(?:[^0-9]|$)/);
  const start = tm && Number(tm[1]) < 24 ? pad(Number(tm[1])) + ":" + tm[2] : "";
  let m = s.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (m) return { date:m[1] + "-" + pad(Number(m[2])) + "-" + pad(Number(m[3])), start };
  m = s.match(/(?:^|[^0-9])(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})(?:[^0-9]|$)/);
  if (m) return { date:m[3] + "-" + pad(Number(m[2])) + "-" + pad(Number(m[1])), start };
  m = s.toLowerCase().match(/(?:^|\s)(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(20\d{2}))?/);
  if (!m) return { date:"", start };
  const ref = now instanceof Date ? now : new Date();
  let year = m[3] ? Number(m[3]) : ref.getUTCFullYear();
  const month = MONTHS[m[2]];
  if (!m[3]) {
    const candidate = new Date(Date.UTC(year, month - 1, Number(m[1])));
    if ((candidate - ref) / 86400000 < -180) year++;
  }
  return { date:year + "-" + pad(month) + "-" + pad(Number(m[1])), start };
}

// Convenzione del database: `starts_at` contiene l'ora di Roma "da parete" salvata con
// componenti UTC (pool con timezone "Z"). Così la leggono api/plan.js (getUTCHours) e il
// gestionale; per schema.org va quindi aggiunto l'offset di Roma, non trattata come UTC.
function romeOffset(dateStr, timeStr) {
  const guess = new Date(dateStr + "T" + (timeStr || "12:00") + ":00Z");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone:"Europe/Rome", hour12:false, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit"
  }).formatToParts(guess);
  const get = t => Number((parts.find(p => p.type === t) || {}).value);
  const minutes = Math.round((Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute")) - guess.getTime()) / 60000);
  const abs = Math.abs(minutes);
  return (minutes >= 0 ? "+" : "-") + pad(Math.floor(abs / 60)) + ":" + pad(abs % 60);
}

// Valore per `starts_at` ("YYYY-MM-DD HH:MM:00", ora di Roma), o null se l'etichetta non ha una data.
function startsAtFromLabel(label) {
  const p = parseDateLabel(label);
  if (!p.date) return null;
  return p.date + " " + (p.start || "00:00") + ":00";
}

function wallClock(value) {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return { date:value.getUTCFullYear() + "-" + pad(value.getUTCMonth() + 1) + "-" + pad(value.getUTCDate()),
             time:pad(value.getUTCHours()) + ":" + pad(value.getUTCMinutes()) };
  }
  const m = String(value || "").match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  return m ? { date:m[1], time:m[2] } : null;
}

// Data ISO 8601 con l'offset di Roma, adatta a schema.org (startDate). Mezzanotte = solo data.
function romeIso(value) {
  const w = wallClock(value);
  if (!w) return "";
  return w.time === "00:00" ? w.date : w.date + "T" + w.time + ":00" + romeOffset(w.date, w.time);
}

// true se la data è già passata; le date senza ora valgono fino a fine giornata (ora di Roma).
function isPast(value, now) {
  const iso = romeIso(value);
  if (!iso) return false;
  const end = iso.length === 10 ? Date.parse(iso + "T23:59:59" + romeOffset(iso, "23:59")) : Date.parse(iso);
  return Number.isFinite(end) && end < (now instanceof Date ? now.getTime() : Date.now());
}

// Preserve date IDs, timestamps and booking references on every event edit.
async function reconcileDates(conn,eventId,inputs){
  const [existing]=await conn.execute("SELECT id,date_label,starts_at,metadata FROM event_dates WHERE event_id=? FOR UPDATE",[eventId]);
  const used=new Set();
  for(const input of inputs){
    const label=String(input&&input.label||"").trim().slice(0,255);
    if(!label)continue;
    const requested=String(input.id||"");
    const old=requested?existing.find(d=>String(d.id)===requested):existing.find(d=>!used.has(String(d.id))&&d.date_label===label);
    if(requested&&!old)throw new Error("data_non_valido");
    if(old&&used.has(String(old.id)))throw new Error("data_duplicata_non_valido");
    const explicit=Object.hasOwn(input,"start")&&input.start!=="";
    // Senza orario esplicito si conserva quello salvato, altrimenti si ricava dall'etichetta.
    const start=explicit?new Date(input.start):old&&old.starts_at||startsAtFromLabel(label);
    if(explicit&&!Number.isFinite(start.getTime()))throw new Error("data_non_valido");
    let previous={};try{previous=typeof old?.metadata==="string"?JSON.parse(old.metadata):old?.metadata||{};}catch(_){}
    const metadata=JSON.stringify({...previous,...input.metadata});
    if(old){used.add(String(old.id));await conn.execute("UPDATE event_dates SET date_label=?,starts_at=?,active=1,metadata=? WHERE id=? AND event_id=?",[label,start,metadata,old.id,eventId]);}
    else{const [result]=await conn.execute("INSERT INTO event_dates (event_id,starts_at,date_label,active,metadata) VALUES (?,?,?,1,?)",[eventId,start,label,metadata]);used.add(String(result.insertId));}
  }
  // Retire omitted dates; never delete rows referenced by bookings.
  for(const old of existing)if(!used.has(String(old.id)))await conn.execute("UPDATE event_dates SET active=0 WHERE id=? AND event_id=?",[old.id,eventId]);
}

module.exports = { parseDateLabel, startsAtFromLabel, romeIso, isPast, reconcileDates };
