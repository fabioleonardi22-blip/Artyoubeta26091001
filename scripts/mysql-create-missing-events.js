/* Crea in MySQL gli eventi che il sito prenota ma che non esistono ancora
   (dopo il controllo del proxy, le prenotazioni verso eventi assenti vengono rifiutate).

   Uso (senza --apply mostra soltanto cosa farebbe):
     DATABASE_URL="mysql://..." node scripts/mysql-create-missing-events.js
     DATABASE_URL="mysql://..." node scripts/mysql-create-missing-events.js --apply

   Legge scripts/missing-events.json. Non tocca eventi già esistenti e salta quelli
   senza capienza indicata. Non legge né scrive prenotazioni.
*/
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { startsAtFromLabel } = require("../lib/event-dates");

const APPLY = process.argv.includes("--apply");

function plan(definitions, existingSlugs) {
  const out = [];
  for (const e of definitions) {
    const slug = String(e.slug || "").trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { out.push({ slug, action:"skip", reason:"slug non valido" }); continue; }
    if (existingSlugs.has(slug)) { out.push({ slug, action:"skip", reason:"esiste già" }); continue; }
    const cap = e.capienza == null ? NaN : Number(e.capienza);
    if (!Number.isInteger(cap) || cap < 0) { out.push({ slug, action:"skip", reason:"capienza da compilare in scripts/missing-events.json" }); continue; }
    const price = e.prezzo == null || e.prezzo === "" ? null : Number(e.prezzo);
    out.push({ slug, action:"create", title:String(e.titolo || slug), category:String(e.categoria || ""), type:String(e.tipo || ""),
      venue:String(e.luogo || ""), capacity:cap, price:Number.isFinite(price) ? price : null,
      dateLabel:String(e.data || ""), startsAt:startsAtFromLabel(e.data || "") });
  }
  return out;
}

async function main() {
  const defs = JSON.parse(fs.readFileSync(path.join(__dirname, "missing-events.json"), "utf8")).eventi || [];
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL mancante");
  const u = new URL(process.env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host:u.hostname, port:Number(u.port || 3306), user:decodeURIComponent(u.username), password:decodeURIComponent(u.password),
    database:decodeURIComponent(u.pathname.slice(1)), timezone:"Z",
    ssl:process.env.MYSQL_SSL === "true" ? (process.env.MYSQL_SSL_CA ? { ca:process.env.MYSQL_SSL_CA.replace(/\\n/g, "\n") } : { rejectUnauthorized:false }) : undefined
  });
  try {
    const [rows] = await conn.execute("SELECT slug FROM events");
    const steps = plan(defs, new Set(rows.map(r => r.slug)));
    for (const s of steps) console.log((s.action === "create" ? "CREA  " : "SALTA ") + s.slug + (s.reason ? " · " + s.reason : " · " + s.title + " · " + s.dateLabel + " · " + s.capacity + " posti"));
    if (!APPLY) { console.log("\nSimulazione: nulla scritto. Rilancia con --apply."); return; }
    await conn.beginTransaction();
    for (const s of steps.filter(x => x.action === "create")) {
      const [ins] = await conn.execute(
        "INSERT INTO events (slug,title,category,event_type,venue,price,capacity,online_payment,tbd,active,sort_order,metadata,source_updated_at) VALUES (?,?,?,?,?,?,?,0,0,1,100,?,UTC_TIMESTAMP())",
        [s.slug, s.title, s.category, s.type, s.venue, s.price, s.capacity, JSON.stringify({ source:"missing-events.json" })]);
      if (s.dateLabel) await conn.execute("INSERT INTO event_dates (event_id,starts_at,date_label,active,metadata) VALUES (?,?,?,1,'{}')", [ins.insertId, s.startsAt, s.dateLabel]);
    }
    await conn.commit();
    console.log("Creati:", steps.filter(x => x.action === "create").length);
  } catch (err) { try { await conn.rollback(); } catch (_) {} throw err; }
  finally { await conn.end(); }
}

if (require.main === module) main().catch(err => { console.error(err.message || err); process.exitCode = 1; });
module.exports = { plan };
