/**
 * Proxy verso lo script Google del magazzino merchandising.
 * Dopo aver pubblicato lo script (README-MERCH.md), incolla qui
 * l'URL che finisce con /exec, oppure imposta su Vercel la variabile
 * d'ambiente MERCH_APPS_SCRIPT_URL.
 */
const APPS_SCRIPT_URL = process.env.MERCH_APPS_SCRIPT_URL || "INCOLLA_QUI_URL_EXEC";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!/^https:\/\/script\.google\.com\//.test(APPS_SCRIPT_URL)) {
    return res.status(503).json({ ok: false, errore: "magazzino_non_configurato" });
  }
  try {
    const rawUrl = String(req.url || "");
    const q = rawUrl.indexOf("?");
    const url = APPS_SCRIPT_URL + (q >= 0 ? rawUrl.slice(q) : "");
    const method = String(req.method || "GET").toUpperCase();
    const options = { method, redirect: "follow", headers: {} };

    if (method === "POST") {
      let body = req.body;
      if (body == null) body = {};
      if (typeof body !== "string") body = JSON.stringify(body);
      if (body.length > 20000) return res.status(413).json({ ok: false, errore: "richiesta_troppo_grande" });
      options.headers["Content-Type"] = "text/plain;charset=utf-8";
      options.body = body;
    } else if (method !== "GET") {
      return res.status(405).json({ ok: false, errore: "metodo_non_consentito" });
    }

    const upstream = await fetch(url, options);
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.send(text);
  } catch (err) {
    res.status(502).json({ ok: false, errore: "proxy_error", dettaglio: String(err && err.message || err) });
  }
};
