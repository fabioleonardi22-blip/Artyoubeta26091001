const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgqQguCWRt7yCTroh2qi4az1rCTZ7kgw0IxNRNDb9LZLOGPUD5Jy3K56NTi6FxAfKx/exec";

function reject(res, status, errore) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).json({ ok: false, errore });
}

module.exports = async function handler(req, res) {
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

    // Il proxy pubblico espone solo letture e creazione prenotazioni.
    // Le azioni amministrative devono passare dagli endpoint riservati.
    if ((method === "GET" || method === "HEAD") && queryAction && queryAction !== "public") {
      return reject(res, 403, "azione_non_consentita");
    }

    let url = APPS_SCRIPT_URL;
    if (query) url += "?" + query;

    const options = { method, redirect: "follow", headers: {} };

    if (method === "POST") {
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

      options.headers["Content-Type"] = "text/plain;charset=utf-8";
      options.body = JSON.stringify(parsed);
    }

    const upstream = await fetch(url, options);
    const body = await upstream.text();

    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(body);
  } catch (err) {
    return reject(res, 502, "proxy_error");
  }
};
