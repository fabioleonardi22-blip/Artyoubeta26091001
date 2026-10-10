// Conferma pagamento e annullamento delle prenotazioni, riservati allo staff.
// Sostituisce le vecchie azioni pubbliche dell'Apps Script, che ora richiedono
// il segreto ARTYOU_ADMIN_SECRET (stesso valore nelle Script Properties e su Vercel).
const { rateLimit, applyRateLimitHeaders, rejectRateLimited, sameOrigin, setSecurityHeaders } = require("../lib/security");
const { requireUser, authErrorStatus } = require("../lib/authorization");
const { query } = require("../lib/db");
const { audit } = require("../lib/audit");
const { primaryMode, setBookingStatus } = require("../lib/booking-store");

const ACTIONS = { conferma: { upstream:"confermapagamento", status:"PAGATO" }, annulla: { upstream:"annulla", status:"ANNULLATO" } };

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok:false, errore:"method_not_allowed" }); }
  if (!sameOrigin(req)) return res.status(403).json({ ok:false, errore:"origin_non_consentita" });

  const limit = rateLimit(req, { key:"booking-admin", limit:60, windowMs:60 * 1000 });
  applyRateLimitHeaders(res, limit);
  if (!limit.ok) return rejectRateLimited(res, limit);

  let auth;
  try { auth = await requireUser(req, ["admin", "staff"]); }
  catch (e) { const code = String(e && e.message || "auth_error"); return res.status(authErrorStatus(code)).json({ ok:false, errore:code }); }

  let body = req.body || {};
  if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf8") > 8 * 1024) return res.status(413).json({ ok:false, errore:"payload_too_large" });
    try { body = JSON.parse(body); } catch (_) { return res.status(400).json({ ok:false, errore:"json_non_valido" }); }
  }

  const action = ACTIONS[String(body.action || "")];
  if (!action) return res.status(400).json({ ok:false, errore:"azione_non_valida" });
  const id = String(body.id || "").trim();
  if (!/^ART-[A-Z0-9-]{6,60}$/i.test(id)) return res.status(400).json({ ok:false, errore:"codice_non_valido" });

  const url = String(process.env.ARTYOU_APPS_SCRIPT_URL || "").trim();
  const secret = String(process.env.ARTYOU_ADMIN_SECRET || "").trim();

  // MySQL archivio principale: lo stato cambia prima in MySQL, il foglio segue.
  // Un codice che MySQL non conosce (prenotazione mai copiata) passa al vecchio percorso.
  if (primaryMode() === "mysql") {
    let found;
    try { found = await setBookingStatus(id, action.status); }
    catch (err) {
      const code = String(err && err.message || err);
      if (/^prenotazione_non_confermabile$|^operazione_non_riuscita$/.test(code)) return res.status(409).json({ ok:false, errore:code });
      console.error("BOOKING_ADMIN_MYSQL_ERROR", code);
      return res.status(503).json({ ok:false, errore:"mysql_unavailable" });
    }
    if (found) {
      let sheet = false;
      if (url && secret) {
        try {
          const upstream = await fetch(url, {
            method:"POST", redirect:"follow", signal:AbortSignal.timeout(15000),
            headers:{ "Content-Type":"text/plain;charset=utf-8" },
            body:JSON.stringify({ action:action.upstream, ID:id, adminSecret:secret })
          });
          const data = JSON.parse(await upstream.text());
          sheet = !!(data && data.ok);
        } catch (_) {}
        if (!sheet) console.warn("BOOKING_ADMIN_SHEET_NOT_UPDATED", id);
      }
      await audit({ email:auth.identity.email, role:auth.user.role }, "booking_" + String(body.action), id, { sheet });
      return res.status(200).json({ ok:true, id, stato:action.status, foglioAggiornato:sheet });
    }
  }

  if (!url || !secret) return res.status(503).json({ ok:false, errore:"non_configurato" });

  try {
    const upstream = await fetch(url, {
      method:"POST", redirect:"follow", signal:AbortSignal.timeout(15000),
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body:JSON.stringify({ action:action.upstream, ID:id, adminSecret:secret })
    });
    const data = JSON.parse(await upstream.text());
    if (!data || !data.ok) return res.status(409).json({ ok:false, errore:(data && data.errore) || "operazione_non_riuscita" });

    try {
      await query("UPDATE bookings SET status=?, hold_expires_at=NULL WHERE public_id=?", [action.status, id]);
    } catch (dbErr) {
      console.error("BOOKING_ADMIN_MYSQL_ERROR", String(dbErr && dbErr.message || dbErr));
    }
    await audit({ email:auth.identity.email, role:auth.user.role }, "booking_" + String(body.action), id, {});
    return res.status(200).json({ ok:true, id, stato:action.status });
  } catch (err) {
    if (err && err.name === "TimeoutError") return res.status(504).json({ ok:false, errore:"backend_timeout" });
    return res.status(502).json({ ok:false, errore:"apps_script_non_raggiungibile" });
  }
};
