const {
  rateLimit,
  applyRateLimitHeaders,
  rejectRateLimited,
  constantTimeEqual,
  sameOrigin,
  setSecurityHeaders
} = require("../lib/security");

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, errore: "method_not_allowed" });
  }

  if (!sameOrigin(req)) {
    return res.status(403).json({ ok: false, errore: "origin_non_consentita" });
  }

  const general = rateLimit(req, { key: "checkin-general", limit: 90, windowMs: 60 * 1000 });
  applyRateLimitHeaders(res, general);
  if (!general.ok) return rejectRateLimited(res, general);

  let body = req.body || {};
  if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf8") > 16 * 1024) {
      return res.status(413).json({ ok: false, errore: "payload_too_large" });
    }
    try { body = JSON.parse(body); }
    catch (_) { return res.status(400).json({ ok: false, errore: "json_non_valido" }); }
  }

  const { action, code, event, pin } = body;
  const expectedPin = process.env.ARTYOU_SCANNER_PIN;
  const appsScriptUrl = process.env.ARTYOU_APPS_SCRIPT_URL;
  const scannerSecret = process.env.ARTYOU_SCANNER_SECRET;

  if (!expectedPin || !appsScriptUrl || !scannerSecret) {
    return res.status(500).json({ ok: false, errore: "scanner_not_configured" });
  }

  if (!constantTimeEqual(pin, expectedPin)) {
    const failed = rateLimit(req, { key: "checkin-pin-fail", limit: 5, windowMs: 10 * 60 * 1000 });
    applyRateLimitHeaders(res, failed);
    if (!failed.ok) return rejectRateLimited(res, failed);
    return res.status(401).json({ ok: false, errore: "pin_non_valido" });
  }

  const allowed = ["lookup", "checkin", "stats"];
  if (!allowed.includes(String(action || ""))) {
    return res.status(400).json({ ok: false, errore: "azione_non_valida" });
  }

  const normalizedCode = String(code || "").trim().toUpperCase();
  if (action !== "stats" && !/^ART-\d{8}-[A-Z0-9]{3,32}$/.test(normalizedCode)) {
    return res.status(400).json({ ok: false, errore: "codice_non_valido" });
  }

  const normalizedEvent = String(event || "").trim();
  if (normalizedEvent.length > 160) {
    return res.status(400).json({ ok: false, errore: "evento_non_valido" });
  }

  try {
    const upstream = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: action === "lookup" ? "scanner_lookup" : action === "checkin" ? "scanner_checkin" : "scanner_stats",
        codice: normalizedCode,
        evento: normalizedEvent,
        scannerSecret
      }),
      redirect: "follow"
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); }
    catch { return res.status(502).json({ ok: false, errore: "risposta_apps_script_non_valida" }); }

    return res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (_) {
    return res.status(502).json({ ok: false, errore: "apps_script_non_raggiungibile" });
  }
};
