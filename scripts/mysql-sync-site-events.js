/* Completa in MySQL i dati degli eventi partendo dall'Apps Script.

   Uso (prima senza --apply: mostra soltanto cosa cambierebbe):
     DATABASE_URL="mysql://..." node scripts/mysql-sync-site-events.js
     DATABASE_URL="mysql://..." node scripts/mysql-sync-site-events.js --apply
     DATABASE_URL="mysql://..." node scripts/mysql-sync-site-events.js --apply --archive-past

   Cosa fa:
   - legge ?action=public (foglio EventiSito: descrizione, locandina, luogo, indirizzo, date, cast)
     e riempie in MySQL SOLO i campi vuoti, senza toccare ciò che è già stato modificato dal gestionale;
   - legge ?eventi=1 (foglio Eventi delle prenotazioni) e salva la chiave storica in metadata.legacyKey,
     abbinandola per slug o per titolo, così la copia delle prenotazioni trova l'evento giusto;
   - calcola starts_at per le date che hanno solo l'etichetta testuale;
   - con --archive-past disattiva gli eventi le cui date sono tutte passate.
   Non legge né scrive prenotazioni o dati personali.
*/
const mysql = require("mysql2/promise");
const { startsAtFromLabel, isPast } = require("../lib/event-dates");

const SOURCE = process.env.ARTYOU_APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbwgqQguCWRt7yCTroh2qi4az1rCTZ7kgw0IxNRNDb9LZLOGPUD5Jy3K56NTi6FxAfKx/exec";
const APPLY = process.argv.includes("--apply");
const ARCHIVE_PAST = process.argv.includes("--archive-past");

const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

async function getJson(url) {
  const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error("Apps Script HTTP " + r.status);
  return r.json();
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL mancante");
  const site = await getJson(SOURCE + "?action=public");
  const booking = await getJson(SOURCE + "?eventi=1");
  const siteEvents = site && site.ok && Array.isArray(site.events) ? site.events : [];
  const bookingEvents = booking && booking.ok && booking.eventi ? booking.eventi : {};

  const u = new URL(process.env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: u.hostname, port: Number(u.port || 3306), user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password), database: decodeURIComponent(u.pathname.slice(1)),
    timezone: "Z", ssl: process.env.MYSQL_SSL === "true" ? (process.env.MYSQL_CA ? { ca: process.env.MYSQL_CA } : { rejectUnauthorized: false }) : undefined
  });
  const changes = [];
  const run = async (sql, params, what) => { changes.push(what); if (APPLY) await conn.execute(sql, params); };

  try {
    if (APPLY) await conn.beginTransaction();
    const [rows] = await conn.execute("SELECT id,slug,title,description,poster_url,venue,address,maps_query,metadata FROM events");
    const bySlug = new Map(rows.map(r => [r.slug, r]));
    const byTitle = new Map();
    for (const r of rows) { const k = norm(r.title); byTitle.set(k, byTitle.has(k) ? null : r); }

    // 1. campi descrittivi mancanti
    for (const ev of siteEvents) {
      const row = bySlug.get(String(ev.slug || ""));
      if (!row) { changes.push("non in MySQL (nessuna modifica): " + ev.slug); continue; }
      const fields = { description: ev.desc, poster_url: ev.poster, venue: ev.venue, address: ev.addr, maps_query: ev.maps };
      for (const [col, value] of Object.entries(fields)) {
        if (!String(row[col] || "").trim() && String(value || "").trim()) {
          await run(`UPDATE events SET ${col}=? WHERE id=?`, [String(value), row.id], `${row.slug}: ${col} completato`);
        }
      }
      const [dates] = await conn.execute("SELECT id FROM event_dates WHERE event_id=? AND active=1", [row.id]);
      if (!dates.length && Array.isArray(ev.dates)) {
        for (const d of ev.dates) {
          const label = String(d && d.label || "").trim();
          if (label) await run("INSERT INTO event_dates (event_id,starts_at,date_label,active,metadata) VALUES (?,?,?,1,?)",
            [row.id, startsAtFromLabel(label), label, JSON.stringify(d.metadata || {})], `${row.slug}: data aggiunta "${label}"`);
        }
      }
    }

    // 2. chiave storica delle prenotazioni
    for (const [key, ev] of Object.entries(bookingEvents)) {
      const row = bySlug.get(key) || byTitle.get(norm(ev.titolo));
      if (!row) { changes.push("chiave prenotazioni senza evento MySQL: " + key + " (" + (ev.titolo || "") + ")"); continue; }
      let meta = {};
      try { meta = typeof row.metadata === "string" ? JSON.parse(row.metadata || "{}") : (row.metadata || {}); } catch (_) {}
      if (row.slug !== key && meta.legacyKey !== key) {
        meta.legacyKey = key;
        await run("UPDATE events SET metadata=? WHERE id=?", [JSON.stringify(meta), row.id], `${row.slug}: legacyKey=${key}`);
      }
    }

    // 3. starts_at mancanti
    const [noStart] = await conn.execute("SELECT ed.id,ed.date_label,e.slug FROM event_dates ed JOIN events e ON e.id=ed.event_id WHERE ed.starts_at IS NULL AND ed.date_label<>''");
    for (const d of noStart) {
      const startsAt = startsAtFromLabel(d.date_label);
      if (startsAt) await run("UPDATE event_dates SET starts_at=? WHERE id=?", [startsAt, d.id], `${d.slug}: starts_at ${startsAt}`);
      else changes.push(`${d.slug}: data non interpretabile "${d.date_label}"`);
    }

    // 4. eventi con sole date passate
    if (ARCHIVE_PAST) {
      const [act] = await conn.execute("SELECT e.id,e.slug,MAX(ed.starts_at) AS last_start,SUM(ed.starts_at IS NULL) AS undated FROM events e JOIN event_dates ed ON ed.event_id=e.id AND ed.active=1 WHERE e.active=1 AND e.tbd=0 GROUP BY e.id");
      for (const e of act) {
        if (!Number(e.undated) && e.last_start && isPast(e.last_start)) {
          await run("UPDATE events SET active=0 WHERE id=?", [e.id], `${e.slug}: archiviato (ultima data passata)`);
        }
      }
    }

    if (APPLY) await conn.commit();
    console.log((APPLY ? "Applicato" : "Simulazione, nulla scritto") + " · " + changes.length + " voci");
    for (const c of changes) console.log(" - " + c);
    if (!APPLY) console.log("\nRilancia con --apply per scrivere.");
  } catch (err) {
    if (APPLY) await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
