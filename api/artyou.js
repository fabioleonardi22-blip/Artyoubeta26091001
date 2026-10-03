const {
  rateLimit,
  applyRateLimitHeaders,
  rejectRateLimited,
  sameOrigin,
  setSecurityHeaders
} = require("../lib/security");

const APPS_SCRIPT_URL = String(process.env.ARTYOU_APPS_SCRIPT_URL || "").trim();

function reject(res, status, errore) {
  setSecurityHeaders(res);
  return res.status(status).json({ ok: false, errore });
}

function validText(value, max) {
  return String(value == null ? "" : value).trim().length <= max;
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);
  if (!APPS_SCRIPT_URL) return res.status(503).json({ ok:false, errore:"backend_non_configurato" });

  try {
    const method = String(req.method || "GET").toUpperCase();
    if (!["GET", "HEAD", "POST"].includes(method)) {
      res.setHeader("Allow", "GET, HEAD, POST");
      return reject(res, 405, "method_not_allowed");
    }

    const rawUrl = String(req.url || "");
    const qIndex = rawUrl.indexOf("?");
    const query = qIndex >= 0 ? rawUrl.slice(qIndex + 1) : "";
    const params = new URLSearchParams(query);
    const queryAction = String(params.get("action") || "").toLowerCase();

    if (method === "GET" || method === "HEAD") {
      const limit = rateLimit(req, { key:"booking-read", limit:180, windowMs:60 * 1000 });
      applyRateLimitHeaders(res, limit);
      if (!limit.ok) return rejectRateLimited(res, limit);

      if (queryAction && queryAction !== "public") {
        return reject(res, 403, "azione_non_consentita");
      }
    }

    let url = APPS_SCRIPT_URL;
    if (query) url += "?" + query;
    const options = { method, redirect: "follow", headers: {} };

    if (method === "POST") {
      if (!sameOrigin(req)) {
        return reject(res, 403, "origin_non_consentita");
      }

      const limit = rateLimit(req, { key:"booking-write", limit:15, windowMs:10 * 60 * 1000 });
      applyRateLimitHeaders(res, limit);
      if (!limit.ok) return rejectRateLimited(res, limit);

      const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      if (Buffer.byteLength(raw, "utf8") > 32 * 1024) {
        return reject(res, 413, "payload_too_large");
      }

      let parsed = {};
      try { parsed = JSON.parse(raw || "{}"); }
      catch (_) { return reject(res, 400, "json_non_valido"); }

      if (String(parsed.action || "").toLowerCase() !== "prenota") {
        return reject(res, 403, "azione_non_consentita");
      }

      const posti = Number(parsed.Posti || 1);
      if (!Number.isInteger(posti) || posti < 1 || posti > 10) {
        return reject(res, 400, "posti_non_validi");
      }

      if (!validText(parsed.Evento, 180) ||
          !validText(parsed.Nome, 100) ||
          !validText(parsed.Cognome, 100) ||
          !validText(parsed.Telefono, 40) ||
          !validText(parsed.Email, 180) ||
          !validText(parsed.Note, 2000) ||
          !validText(parsed.Scelte, 1000) ||
          !validText(parsed.Risorse, 1000)) {
        return reject(res, 400, "dati_non_validi");
      }

      if (!String(parsed.Evento || "").trim() ||
          !String(parsed.Nome || "").trim() ||
          !String(parsed.Cognome || "").trim()) {
        return reject(res, 400, "campi_obbligatori_mancanti");
      }

      const email = String(parsed.Email || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reject(res, 400, "email_non_valida");
      }

      options.headers["Content-Type"] = "text/plain;charset=utf-8";
      options.body = JSON.stringify(parsed);
    }

    const upstream = await fetch(url, options);
    const body = await upstream.text();

    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.send(body);
  } catch (_) {
    return reject(res, 502, "proxy_error");
  }
};
