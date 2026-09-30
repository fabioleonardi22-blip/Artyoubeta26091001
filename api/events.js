const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwOCClsZtJkn1_79kQKgqshd99_Dr3LLrJqOiFRUDw/exec";

module.exports = async function handler(req, res) {
  try {
    const rawUrl = String(req.url || "");
    const qIndex = rawUrl.indexOf("?");
    const query = qIndex >= 0 ? rawUrl.slice(qIndex + 1) : "";

    let url = APPS_SCRIPT_URL;
    if (query) url += "?" + query;

    const method = String(req.method || "GET").toUpperCase();
    const options = { method, redirect: "follow", headers: {} };

    if (method !== "GET" && method !== "HEAD") {
      let body = req.body;
      if (body === undefined || body === null) body = {};
      if (typeof body !== "string") body = JSON.stringify(body);
      options.headers["Content-Type"] = "text/plain;charset=utf-8";
      options.body = body;
    }

    const upstream = await fetch(url, options);
    const body = await upstream.text();

    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(body);
  } catch (err) {
    res.status(502).json({
      ok: false,
      errore: "proxy_error",
      dettaglio: String(err && err.message || err)
    });
  }
};
