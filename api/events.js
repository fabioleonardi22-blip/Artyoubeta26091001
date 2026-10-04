const {
  rateLimit,
  applyRateLimitHeaders,
  rejectRateLimited,
  sameOrigin,
  setSecurityHeaders
} = require("../lib/security");

const APPS_SCRIPT_URL = String(process.env.ARTYOU_APPS_SCRIPT_URL || "").trim();
const { transaction } = require("../lib/db");

function getQuery(req) {
  const rawUrl = String(req.url || "");
  const qIndex = rawUrl.indexOf("?");
  return new URLSearchParams(qIndex >= 0 ? rawUrl.slice(qIndex + 1) : "");
}

async function syncPublicEventsToMysql() {
  if (!(process.env.DATABASE_URL || process.env.MYSQL_URL)) return;
  const r = await fetch(APPS_SCRIPT_URL + "?eventi=1&_=" + Date.now(), { redirect:"follow" });
  if (!r.ok) throw new Error("events_sync_source_unavailable");
  const data = await r.json();
  if (!data || !data.ok || !data.eventi) throw new Error("events_sync_payload_invalid");

  await transaction(async (conn) => {
    await conn.execute("UPDATE events SET active=0");
    for (const [slug, ev] of Object.entries(data.eventi)) {
      const e = ev || {};
      await conn.execute(
        `INSERT INTO events (slug,title,category,event_type,price,capacity,active,source_updated_at)
         VALUES (?,?,?,?,?,?,1,NOW())
         ON DUPLICATE KEY UPDATE
           title=VALUES(title),
           category=VALUES(category),
           event_type=VALUES(event_type),
           price=VALUES(price),
           capacity=VALUES(capacity),
           active=1,
           source_updated_at=NOW()`,
        [
          String(slug),
          String(e.titolo || e.descrizione || slug),
          String(e.categoria || ""),
          String(e.tipo || ""),
          e.prezzo === "" || e.prezzo == null ? null : Number(e.prezzo || 0),
          Math.max(0, Number(e.capienza || 0))
        ]
      );
    }
  });
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);
  if (!APPS_SCRIPT_URL) return res.status(503).json({ ok:false, errore:"backend_non_configurato" });

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
    let requestBody = null;
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

      requestBody = body;
      options.headers["Content-Type"] = "text/plain;charset=utf-8";
      options.body = JSON.stringify(body);
    } else {
      const qs = params.toString();
      if (qs) url += "?" + qs;
    }

    const upstream = await fetch(url, options);
    const bodyText = await upstream.text();

    if (method === "POST" && upstream.ok && requestBody &&
        ["save","delete"].includes(String(requestBody.action || "").toLowerCase())) {
      try {
        const result = JSON.parse(bodyText);
        if (result && result.ok) await syncPublicEventsToMysql();
      } catch (syncErr) {
        console.error("ARTYOU_MYSQL_EVENT_SYNC_ERROR", String(syncErr && syncErr.message || syncErr));
      }
    }

    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.send(bodyText);
  } catch (_) {
    return res.status(502).json({ ok:false, errore:"proxy_error" });
  }
};
