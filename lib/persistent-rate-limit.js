const crypto = require("crypto");
const { query } = require("./db");
const { clientIp } = require("./security");
let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  await query("CREATE TABLE IF NOT EXISTS security_rate_limits (bucket_key CHAR(64) NOT NULL PRIMARY KEY, request_count INT UNSIGNED NOT NULL DEFAULT 0, expires_at DATETIME NOT NULL, KEY idx_security_rate_expiry (expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  tableReady = true;
}

async function persistentRateLimit(req, options) {
  await ensureTable();
  const windowMs = Math.max(1000, Number(options.windowMs || 60000));
  const limit = Math.max(1, Number(options.limit || 60));
  const bucket = Math.floor(Date.now() / windowMs);
  const raw = String(options.key || "default") + "|" + clientIp(req) + "|" + bucket;
  const key = crypto.createHash("sha256").update(raw).digest("hex");
  const expires = new Date((bucket + 1) * windowMs);
  await query("INSERT INTO security_rate_limits (bucket_key,request_count,expires_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE request_count=request_count+1", [key, expires]);
  const rows = await query("SELECT request_count FROM security_rate_limits WHERE bucket_key=? LIMIT 1", [key]);
  const count = Number(rows && rows[0] && rows[0].request_count || 0);
  if (bucket % 100 === 0) { try { await query("DELETE FROM security_rate_limits WHERE expires_at < UTC_TIMESTAMP()"); } catch (_) {} }
  return { ok: count <= limit, limit, remaining: Math.max(0, limit-count), retryAfter: Math.max(1, Math.ceil((expires.getTime()-Date.now())/1000)), resetAt: expires.getTime() };
}

module.exports = { persistentRateLimit };
