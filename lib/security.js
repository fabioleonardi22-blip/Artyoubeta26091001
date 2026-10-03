const crypto = require("crypto");

const store = globalThis.__ARTYOU_RATE_LIMITS || (globalThis.__ARTYOU_RATE_LIMITS = new Map());

function clientIp(req) {
  const h = (req && req.headers) || {};
  const forwarded = String(h["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(h["x-real-ip"] || h["cf-connecting-ip"] || "unknown").trim();
}

function rateLimit(req, options) {
  const now = Date.now();
  const windowMs = Math.max(1000, Number(options.windowMs || 60000));
  const limit = Math.max(1, Number(options.limit || 60));
  const bucket = String(options.key || "default") + ":" + clientIp(req);
  let item = store.get(bucket);

  if (!item || item.resetAt <= now) {
    item = { count: 0, resetAt: now + windowMs };
    store.set(bucket, item);
  }
  item.count += 1;

  // Pulizia opportunistica per evitare crescita illimitata della Map.
  if (store.size > 5000) {
    for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
  }

  return {
    ok: item.count <= limit,
    limit,
    remaining: Math.max(0, limit - item.count),
    retryAfter: Math.max(1, Math.ceil((item.resetAt - now) / 1000)),
    resetAt: item.resetAt
  };
}

function applyRateLimitHeaders(res, result) {
  res.setHeader("X-RateLimit-Limit", String(result.limit));
  res.setHeader("X-RateLimit-Remaining", String(result.remaining));
  if (!result.ok) res.setHeader("Retry-After", String(result.retryAfter));
}

function rejectRateLimited(res, result) {
  applyRateLimitHeaders(res, result);
  res.setHeader("Cache-Control", "no-store");
  return res.status(429).json({ ok: false, errore: "troppi_tentativi", retryAfter: result.retryAfter });
}

function constantTimeEqual(a, b) {
  const aa = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (aa.length !== bb.length) {
    // Esegui comunque un confronto per ridurre differenze temporali grossolane.
    const dummy = Buffer.alloc(Math.max(aa.length, bb.length, 1));
    crypto.timingSafeEqual(dummy, dummy);
    return false;
  }
  return crypto.timingSafeEqual(aa, bb);
}

function sameOrigin(req) {
  const h = (req && req.headers) || {};
  const origin = String(h.origin || "").trim();
  if (!origin) return true; // consente chiamate server-to-server.
  let originHost = "";
  try { originHost = new URL(origin).host.toLowerCase(); } catch (_) { return false; }
  const host = String(h["x-forwarded-host"] || h.host || "").split(",")[0].trim().toLowerCase();
  return !!host && originHost === host;
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
}

module.exports = {
  clientIp,
  rateLimit,
  applyRateLimitHeaders,
  rejectRateLimited,
  constantTimeEqual,
  sameOrigin,
  setSecurityHeaders
};
