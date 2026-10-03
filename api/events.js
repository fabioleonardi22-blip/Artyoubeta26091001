const {
  rateLimit,
  applyRateLimitHeaders,
  rejectRateLimited,
  sameOrigin,
  setSecurityHeaders
} = require("../lib/security");

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgqQguCWRt7yCTroh2qi4az1rCTZ7kgw0IxNRNDb9LZLOGPUD5Jy3K56NTi6FxAfKx/exec";

function getQuery(req) {
  const rawUrl = String(req.url || "");
  const qIndex = rawUrl.indexOf("?");
  return new URLSearchParams(qIndex >= 0 ? rawUrl.slice(qIndex + 1) : "");
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);

  try {
    const method = String(req.method || "GET").toUpperCase();
    if (!["GET", "HEAD", "POST"].includes(method)) {
      res.setHeader("Allow", "GET, HEAD, POST");
      return res.status(405).json({ ok:false, errore:"method_not_allowed" });
    }

    const params = getQuery(req);
    const queryAction = String(params.get("action") || "").toLowerCase();
    const publicRead = (method === "GET" || method === "HEAD") && queryAction === "public";

    if (publicRead) {
      const limit = rateLimit(req, { key:"events-public", limit:120, windowMs:60 * 1000 });
      applyRateLimitHeaders(res, limit);
      if (!limit.ok) return rejectRateLimited(res, limit);
    } else {
      if (!sameOrigin(req)) {
        return res.status(403).json({ ok:false, errore:"origin_non_consentita" });
      }
      const limit = rateLimit(req, { key:"events-admin", limit:40, windowMs:60 * 1000 });
      applyRateLimitHeaders(res, limit);
      if (!limit.ok) return rejectRateLimited(res, limit);
    }

    if (method === "GET" || method === "HEAD") {
      if (!["public", "list"].includes(queryAction)) {
        return res.status(403).json({ ok:false, errore:"azione_non_consentita" });
      }
      if (queryAction === "list" && !params.get("pin")) {
        return res.status(401).json({ ok:false, errore:"pin_richiesto" });
      }
    }

    let options = { method, redirect:"follow", headers:{} };
    let url = APPS_SCRIPT_URL;

    if (method === "POST") {
      let body = req.body || {};
      if (typeof body === "string") {
        if (Buffer.byteLength(body, "utf8") > 8 * 1024 * 1024) {
          return res.status(413).json({ ok:false, errore:"payload_too_large" });
        }
        try { body = JSON.parse(body); }
        catch (_) { return res.status(400).json({ ok:false, errore:"json_non_valido" }); }
      }

      const action = String(body.action || queryAction || "").toLowerCase();
      if (!["save", "delete", "uploadimage"].includes(action)) {
        return res.status(403).json({ ok:false, errore:"azione_non_consentita" });
      }
      if (!body.pin) {
        return res.status(401).json({ ok:false, errore:"pin_richiesto" });
      }
      if (action !== "uploadimage") {
        const raw = JSON.stringify(body);
        if (Buffer.byteLength(raw, "utf8") > 128 * 1024) {
          return res.status(413).json({ ok:false, errore:"payload_too_large" });
        }
      }

      options.headers["Content-Type"] = "text/plain;charset=utf-8";
      options.body = JSON.stringify(body);
    } else {
      const qs = params.toString();
      if (qs) url += "?" + qs;
    }

    const upstream = await fetch(url, options);
    const bodyText = await upstream.text();

    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.send(bodyText);
  } catch (_) {
    return res.status(502).json({ ok:false, errore:"proxy_error" });
  }
};
