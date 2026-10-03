const { verifyGoogleIdToken, bearerToken } = require("../lib/google-auth");
const {
  rateLimit,
  applyRateLimitHeaders,
  rejectRateLimited,
  sameOrigin,
  setSecurityHeaders
} = require("../lib/security");

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgqQguCWRt7yCTroh2qi4az1rCTZ7kgw0IxNRNDb9LZLOGPUD5Jy3K56NTi6FxAfKx/exec";

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);

  try {
    const method = String(req.method || "GET").toUpperCase();
    if (!["GET", "HEAD", "POST"].includes(method)) {
      res.setHeader("Allow", "GET, HEAD, POST");
      return res.status(405).json({ok:false, errore:"method_not_allowed"});
    }
    if (!sameOrigin(req)) {
      return res.status(403).json({ok:false, errore:"origin_non_consentita"});
    }

    const limit = rateLimit(req, { key:"plan", limit:120, windowMs:60 * 1000 });
    applyRateLimitHeaders(res, limit);
    if (!limit.ok) return rejectRateLimited(res, limit);

    const credential = bearerToken(req);
    if (!credential || credential.length > 8192) {
      return res.status(401).json({ok:false, errore:"google_login_required"});
    }
    await verifyGoogleIdToken(credential);

    const rawUrl = String(req.url || "");
    const qIndex = rawUrl.indexOf("?");
    const query = qIndex >= 0 ? rawUrl.slice(qIndex + 1) : "";
    const params = new URLSearchParams(query);
    params.delete("email");
    params.delete("token");

    const action = String(params.get("action") || "");
    if (action && !/^[a-z0-9_-]{1,60}$/i.test(action)) {
      return res.status(400).json({ok:false, errore:"azione_non_valida"});
    }
    if (action) params.set("action", "po_" + action);
    params.set("token", credential);

    let url = APPS_SCRIPT_URL;
    const qs = params.toString();
    if (qs) url += "?" + qs;

    const options = { method, redirect:"follow", headers:{} };

    if (method === "POST") {
      let body = req.body;
      if (body === undefined || body === null) body = {};
      if (typeof body === "string") {
        if (Buffer.byteLength(body, "utf8") > 128 * 1024) {
          return res.status(413).json({ok:false, errore:"payload_too_large"});
        }
        try { body = JSON.parse(body); }
        catch (_) { return res.status(400).json({ok:false, errore:"json_non_valido"}); }
      }

      const bodyAction = String(body.action || action || "");
      if (!/^[a-z0-9_-]{1,60}$/i.test(bodyAction)) {
        return res.status(400).json({ok:false, errore:"azione_non_valida"});
      }

      body.action = "po_" + bodyAction;
      delete body.email;
      delete body.token;
      body.token = credential;
      options.headers["Content-Type"] = "text/plain;charset=utf-8";
      options.body = JSON.stringify(body);
    }

    const upstream = await fetch(url, options);
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.send(text);
  } catch (err) {
    const code = String(err && err.message || "auth_error");
    if (/missing/.test(code)) return res.status(503).json({ok:false, errore:"auth_non_configurata"});
    return res.status(401).json({ok:false, errore:"autenticazione_non_valida"});
  }
};
