// Copia di una prenotazione già decisa da MySQL nel foglio Google, con le email.
// Usa l'azione "registra" dello Script Google: non ricalcola i posti, non può
// rifiutare la prenotazione, e se il codice è già nel foglio non lo duplica.

const { markSheetSync } = require("./booking-store");

const TIMEOUT_MS = 20000;

function sheetRow(data, booking) {
  const row = { ...data };
  delete row.action; delete row._hp;
  return Object.assign(row, {
    action: "registra",
    ID: booking.id,
    Stato: booking.stato,
    Posti: booking.posti,
    Pagamento: booking.pagamento,
    Importo: booking.importo,
    ScadenzaHold: booking.scadenzaHold || "",
    liberi: booking.liberi
  });
}

async function copyToSheet(data, booking) {
  const url = String(process.env.ARTYOU_APPS_SCRIPT_URL || "").trim();
  const secret = String(process.env.ARTYOU_ADMIN_SECRET || "").trim();
  let ok = false, detail = "";
  try {
    if (!url || !secret) throw new Error("apps_script_non_configurato");
    const res = await fetch(url, {
      method: "POST", redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...sheetRow(data, booking), adminSecret: secret })
    });
    const out = JSON.parse(await res.text());
    ok = !!(out && out.ok);
    if (!ok) detail = (out && out.errore) || "risposta_non_ok";
  } catch (err) {
    detail = String(err && err.message || err);
  }
  if (!ok) console.error("ARTYOU_SHEET_COPY_FAILED", booking.id, detail);
  try { await markSheetSync(booking.id, ok, detail); }
  catch (err) { console.error("ARTYOU_SHEET_COPY_MARK_FAILED", booking.id, String(err && err.message || err)); }
  return { ok, detail };
}

// Su Vercel la copia prosegue dopo la risposta al cliente: chi prenota non aspetta
// lo Script Google. Fuori da Vercel (test, script) si attende normalmente.
function copyAfterResponse(data, booking) {
  const job = copyToSheet(data, booking);
  try {
    const { waitUntil } = require("@vercel/functions");
    waitUntil(job);
    return null;
  } catch (_) {
    return job;
  }
}

module.exports = { copyToSheet, copyAfterResponse, sheetRow };
