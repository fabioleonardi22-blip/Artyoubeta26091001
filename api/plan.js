const { verifyGoogleIdToken, bearerToken } = require("../lib/google-auth");

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgqQguCWRt7yCTroh2qi4az1rCTZ7kgw0IxNRNDb9LZLOGPUD5Jy3K56NTi6FxAfKx/exec";

module.exports = async function handler(req, res) {
  try {
    const credential = bearerToken(req);
    if (!credential) return res.status(401).json({ok:false, errore:"google_login_required"});
    const identity = await verifyGoogleIdToken(credential);

    const method = String(req.method || "GET").toUpperCase();
    const rawUrl = String(req.url || "");
    const qIndex = rawUrl.indexOf("?");
    const query = qIndex >= 0 ? rawUrl.slice(qIndex + 1) : "";
    const params = new URLSearchParams(query);
    params.delete("email");
    params.delete("token");
    const action = params.get("action");
    if (action) params.set("action", "po_" + action);
    params.set("token", credential);

    let url = APPS_SCRIPT_URL;
    const qs = params.toString();
    if (qs) url += "?" + qs;

    const options = { method, redirect: "follow", headers: {} };

    if (method !== "GET" && method !== "HEAD") {
      let body = req.body;
      if (body === undefined || body === null) body = {};
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
      body.action = "po_" + String(body.action || action || "");
      delete body.email;
      body.token = credential;
      options.headers["Content-Type"] = "text/plain;charset=utf-8";
      options.body = JSON.stringify(body);
    }

    const upstream = await fetch(url, options);
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(text);
  } catch (err) {
    const code = String(err && err.message || "auth_error");
    const status = /missing/.test(code) ? 503 : 401;
    res.status(status).json({ok:false, errore:code});
  }
};
