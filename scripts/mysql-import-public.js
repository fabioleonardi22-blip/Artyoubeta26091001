/* Importa nel MySQL gli eventi pubblici esposti dall'Apps Script attuale.
   Uso:
   DATABASE_URL="mysql://..." node scripts/mysql-import-public.js

   Importa SOLO eventi/capienze/prezzi pubblici.
   Le prenotazioni vanno migrate separatamente dal foglio privato per non esporre dati personali.
*/
const mysql = require("mysql2/promise");

const SOURCE = process.env.ARTYOU_APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbwgqQguCWRt7yCTroh2qi4az1rCTZ7kgw0IxNRNDb9LZLOGPUD5Jy3K56NTi6FxAfKx/exec";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL mancante");

  const resp = await fetch(SOURCE + "?eventi=1");
  if (!resp.ok) throw new Error("Apps Script HTTP " + resp.status);
  const payload = await resp.json();
  if (!payload || payload.ok !== true || !payload.eventi) throw new Error("Risposta eventi non valida");

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await conn.beginTransaction();
    let count = 0;

    for (const [slug, ev] of Object.entries(payload.eventi)) {
      await conn.execute(`
        INSERT INTO events (slug,title,price,capacity,active,metadata)
        VALUES (?,?,?,?,1,JSON_OBJECT('migration_source','google_apps_script'))
        ON DUPLICATE KEY UPDATE
          title=VALUES(title),
          price=VALUES(price),
          capacity=VALUES(capacity),
          active=1,
          updated_at=CURRENT_TIMESTAMP
      `, [
        slug,
        String(ev.titolo || slug),
        ev.prezzo === "" ? null : Number(ev.prezzo || 0),
        Number(ev.capienza || 0)
      ]);

      const [[row]] = await conn.execute("SELECT id FROM events WHERE slug=?", [slug]);
      const label = String(ev.data || "").trim();
      if (label) {
        const [[exists]] = await conn.execute(
          "SELECT id FROM event_dates WHERE event_id=? AND date_label=? LIMIT 1",
          [row.id, label]
        );
        if (!exists) {
          await conn.execute(
            "INSERT INTO event_dates (event_id,date_label,active) VALUES (?,?,1)",
            [row.id, label]
          );
        }
      }
      count++;
    }

    await conn.commit();
    console.log("Eventi importati/aggiornati:", count);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
