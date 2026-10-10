const crypto = require("crypto");

let jwksCache = { expires: 0, keys: [] };

function b64urlToBuffer(input) {
  const s = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return Buffer.from(s + pad, "base64");
}

async function getGoogleJwks() {
  const now = Date.now();
  if (jwksCache.keys.length && jwksCache.expires > now) return jwksCache.keys;
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs",{signal:AbortSignal.timeout(8000)});
  if (!r.ok) throw new Error("google_keys_unavailable");
  const body = await r.json();
  const cacheControl = r.headers.get("cache-control") || "";
  const m = cacheControl.match(/max-age=(\d+)/i);
  const ttl = m ? Number(m[1]) * 1000 : 3600 * 1000;
  jwksCache = { expires: now + ttl, keys: Array.isArray(body.keys) ? body.keys : [] };
  return jwksCache.keys;
}

async function verifyGoogleIdToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("google_token_invalid");
  let header, payload;
  try {
    header = JSON.parse(b64urlToBuffer(parts[0]).toString("utf8"));
    payload = JSON.parse(b64urlToBuffer(parts[1]).toString("utf8"));
  } catch (e) {
    throw new Error("google_token_invalid");
  }

  if (header.alg !== "RS256" || !header.kid) throw new Error("google_token_invalid");
  const keys = await getGoogleJwks();
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error("google_key_not_found");

  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(parts[0] + "." + parts[1]);
  verifier.end();
  if (!verifier.verify(publicKey, b64urlToBuffer(parts[2]))) throw new Error("google_signature_invalid");

  const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) throw new Error("google_client_id_missing");
  if (payload.aud !== clientId) throw new Error("google_audience_invalid");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) throw new Error("google_issuer_invalid");
  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || Number(payload.exp) <= nowSec) throw new Error("google_token_expired");
  if (payload.nbf && Number(payload.nbf) > nowSec + 60) throw new Error("google_token_not_yet_valid");
  if (!payload.email || payload.email_verified !== true) throw new Error("google_email_not_verified");

  return {
    email: String(payload.email).trim().toLowerCase(),
    name: String(payload.name || ""),
    picture: String(payload.picture || ""),
    sub: String(payload.sub || ""),
    exp: Number(payload.exp || 0)
  };
}

function bearerToken(req) {
  const h = String((req.headers && req.headers.authorization) || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function cookieValue(req, name) {
  const raw = String((req.headers && req.headers.cookie) || "");
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    if (key !== name) continue;
    try { return decodeURIComponent(part.slice(i + 1).trim()); }
    catch (_) { return ""; }
  }
  return "";
}

function authToken(req) {
  return bearerToken(req) || cookieValue(req, "artyou_id_token");
}

module.exports = { verifyGoogleIdToken, bearerToken, authToken };
