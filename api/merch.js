const RAILWAY_MERCH_API = process.env.ARTYOU_MERCH_API_URL ||
  "https://artyou-merch-api-production.up.railway.app";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const method = String(req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "POST") {
    return res.status(405).json({ ok: false, errore: "metodo_non_consentito" });
  }

  try {
    const rawUrl = String(req.url || "");
    const q = rawUrl.indexOf("?");
    const query = q >= 0 ? rawUrl.slice(q) : "";
    const target = RAILWAY_MERCH_API.replace(/\/$/, "") + "/merch" + query;

    const options = {
      method,
      redirect: "follow",
      headers: { "Accept": "application/json" }
    };

    if (method === "POST") {
      let body = req.body;
      if (body == null) body = {};
      if (typeof body !== "string") body = JSON.stringify(body);
      if (body.length > 20000) {
        return res.status(413).json({ ok: false, errore: "richiesta_troppo_grande" });
      }
      options.headers["Content-Type"] = "application/json; charset=utf-8";
      options.body = body;
    }

    const upstream = await fetch(target, options);
    const text = await upstream.text();

    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    return res.send(text);
  } catch (err) {
    console.error("merch railway proxy error");
    return res.status(502).json({ ok: false, errore: "proxy_error" });
  }
};
