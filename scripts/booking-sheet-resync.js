#!/usr/bin/env node
// Ricopia nel foglio Google le prenotazioni MySQL la cui copia non è riuscita
// (metadata.sheet_sync = "failed", oppure "pending" da più di 10 minuti).
// Lo Script Google non duplica i codici già presenti, quindi ripetere è sicuro.
//
//   DATABASE_URL=... ARTYOU_APPS_SCRIPT_URL=... ARTYOU_ADMIN_SECRET=... node scripts/booking-sheet-resync.js
//   ... node scripts/booking-sheet-resync.js --apply

const { query, getPool } = require("../lib/db");
const { copyToSheet } = require("../lib/sheet-copy");

const apply = process.argv.includes("--apply");

function meta(v) { if (!v) return {}; if (typeof v === "object") return v; try { return JSON.parse(v); } catch (_) { return {}; } }

(async () => {
  const rows = await query(
    `SELECT public_id,first_name,last_name,email,phone,seats,status,hold_expires_at,notes,privacy_accepted,metadata,created_at
       FROM bookings
      WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.source'))='mysql_primary'
        AND (JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.sheet_sync'))='failed'
             OR (JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.sheet_sync'))='pending' AND created_at < UTC_TIMESTAMP() - INTERVAL 10 MINUTE))
      ORDER BY created_at`);
  console.log(`${rows.length} prenotazioni da ricopiare nel foglio${apply ? "" : " (simulazione: aggiungere --apply)"}`);
  let ok = 0;
  for (const r of rows) {
    const m = meta(r.metadata);
    console.log(`- ${r.public_id} · ${m.evento_richiesto || "?"} · ${r.seats} posti · ${r.status} · ${m.sheet_sync}`);
    if (!apply) continue;
    const data = {
      Evento: m.evento_richiesto || "", Nome: r.first_name || "", Cognome: r.last_name || "",
      Email: r.email || "", Telefono: r.phone || "", Note: r.notes || "",
      Scelte: m.scelte || "", Risorse: m.risorse || "", camera: m.camera || "", cibo: m.cibo || "", scuola: m.scuola || "",
      Privacy: !!Number(r.privacy_accepted)
    };
    const booking = {
      id: r.public_id, stato: r.status, posti: r.seats, pagamento: m.pagamento || "", importo: m.importo || "",
      scadenzaHold: r.hold_expires_at ? new Date(r.hold_expires_at).toISOString() : "", liberi: ""
    };
    const out = await copyToSheet(data, booking);
    console.log(out.ok ? "  copiata" : `  NON copiata: ${out.detail}`);
    if (out.ok) ok++;
  }
  if (apply) console.log(`Copiate: ${ok}/${rows.length}`);
  await getPool().end();
  process.exit(apply && ok < rows.length ? 1 : 0);
})().catch(async (err) => { console.error(String(err && err.message || err)); try { await getPool().end(); } catch (_) {} process.exit(1); });
