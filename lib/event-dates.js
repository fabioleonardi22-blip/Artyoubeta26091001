// Interpretazione delle date degli eventi scritte come testo libero nel gestionale
// ("04/10/2026 · 21:00", "2026-10-04", "4 ottobre 2026 ore 21:00").
// Le date sono orari di Roma: in MySQL `starts_at` conserva l'orario "da parete".

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

// Valore per la colonna DATETIME `starts_at` (orario di Roma "da parete"), o null.
function startsAtFromLabel(label) {
  const p = parseDateLabel(label);
  if (!p.date) return null;
  return p.date + " " + (p.start || "00:00") + ":00";
}

// Offset di Europe/Rome per una data/ora locale, es. "+02:00".
function romeOffset(dateStr, timeStr) {
  const guess = new Date(dateStr + "T" + (timeStr || "12:00") + ":00Z");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone:"Europe/Rome", hour12:false, year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit"
  }).formatToParts(guess);
  const get = t => Number((parts.find(p => p.type === t) || {}).value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  const minutes = Math.round((asUtc - guess.getTime()) / 60000);
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return sign + pad(Math.floor(abs / 60)) + ":" + pad(abs % 60);
}

// Data ISO 8601 con fuso di Roma, adatta a schema.org (startDate).
// `wallClock` è un Date letto da MySQL (componenti UTC = orario di Roma) o una stringa "YYYY-MM-DD HH:MM:SS".
function romeIso(wallClock) {
  let date, time;
  if (wallClock instanceof Date) {
    if (isNaN(wallClock.getTime())) return "";
    date = wallClock.getUTCFullYear() + "-" + pad(wallClock.getUTCMonth() + 1) + "-" + pad(wallClock.getUTCDate());
    time = pad(wallClock.getUTCHours()) + ":" + pad(wallClock.getUTCMinutes());
  } else {
    const m = String(wallClock || "").match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
    if (!m) return "";
    date = m[1]; time = m[2];
  }
  const hasTime = time !== "00:00";
  return hasTime ? date + "T" + time + ":00" + romeOffset(date, time) : date;
}

// true se la data (orario di Roma) è già passata; le date senza ora valgono fino a fine giornata.
function isPast(wallClock, now) {
  const iso = romeIso(wallClock);
  if (!iso) return false;
  const end = iso.length === 10 ? Date.parse(iso + "T23:59:59" + romeOffset(iso, "23:59")) : Date.parse(iso);
  return Number.isFinite(end) && end < (now instanceof Date ? now.getTime() : Date.now());
}

module.exports = { parseDateLabel, startsAtFromLabel, romeIso, isPast };
