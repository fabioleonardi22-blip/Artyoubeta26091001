#!/usr/bin/env node
// Controlli in sola lettura prima di impostare ARTYOU_BOOKING_PRIMARY=mysql.
// Esce con codice 1 se trova qualcosa che bloccherebbe il passaggio.
//
//   DATABASE_URL=... node scripts/booking-switch-check.js

const { query, getPool } = require("../lib/db");
const { resolveTarget, availabilityMap } = require("../lib/booking-store");

(async () => {
  let blocking = 0;

  // 1. Eventi prenotabili senza capienza: con MySQL principale risulterebbero esauriti.
  const zero = await query("SELECT slug,title FROM events WHERE active=1 AND capacity=0 ORDER BY slug");
  console.log(`\n1) Eventi attivi con capienza 0: ${zero.length}`);
  for (const e of zero) console.log(`   - ${e.slug} · ${e.title}`);
  if (zero.length) { blocking++; console.log("   → impostare la capienza giusta (o disattivarli) prima del passaggio"); }

  // 2. Prenotazioni attive copiate dal foglio la cui chiave non trova più l'evento.
  const legacy = await query(
    `SELECT public_id, JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.evento_richiesto')) AS chiave
       FROM bookings
      WHERE (status IN ('RISERVATO','PAGATO') OR (status='HOLD' AND hold_expires_at>UTC_TIMESTAMP()))
        AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.source')),'')<>'mysql_primary'`);
  const unresolved = [];
  for (const b of legacy) if (b.chiave && !(await resolveTarget(null, b.chiave))) unresolved.push(b);
  console.log(`\n2) Prenotazioni attive dal foglio: ${legacy.length}, con chiave non riconosciuta: ${unresolved.length}`);
  for (const b of unresolved) console.log(`   - ${b.public_id} · ${b.chiave}`);
  if (unresolved.length) { blocking++; console.log("   → i loro posti non verrebbero contati per la data giusta"); }

  // 3. Copie nel foglio in sospeso (solo se il passaggio è già stato provato).
  const pending = await query(
    `SELECT COUNT(*) AS n FROM bookings WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.sheet_sync')) IN ('pending','failed')`);
  console.log(`\n3) Copie nel foglio da riallineare: ${Number(pending[0].n)}`);

  // 4. Disponibilità che MySQL mostrerebbe: da confrontare a mano con /api/artyou?disponibilita=1 di oggi.
  const map = await availabilityMap();
  console.log("\n4) Posti liberi secondo MySQL (confrontare con il foglio):");
  for (const k of Object.keys(map).sort()) console.log(`   ${k}: ${map[k]}`);

  console.log(blocking ? `\n${blocking} problemi da risolvere prima del passaggio.` : "\nNessun problema bloccante.");
  await getPool().end();
  process.exit(blocking ? 1 : 0);
})().catch(async (err) => { console.error(String(err && err.message || err)); try { await getPool().end(); } catch (_) {} process.exit(1); });
