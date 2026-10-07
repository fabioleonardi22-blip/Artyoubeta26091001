const crypto = require("crypto");
const { query } = require("./db");

const COOKIE = "__Host-artyou_session";
let schemaReady = false;

async function ensureSessionSchema() {
  if (schemaReady) return;
  await query(`CREATE TABLE IF NOT EXISTS auth_sessions (
    session_hash CHAR(64) NOT NULL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    google_subject VARCHAR(255) NOT NULL,
    google_email VARCHAR(255) NOT NULL,
    google_name VARCHAR(255) NULL,
    google_picture TEXT NULL,
    google_credential TEXT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_auth_sessions_user (user_id),
    KEY idx_auth_sessions_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  schemaReady = true;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function cookieValue(req, name) {
  const raw = String((req.headers && req.headers.cookie) || "");
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() !== name) continue;
    try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { return ""; }
  }
  return "";
}

function sessionToken(req) {
  return cookieValue(req, COOKIE);
}

async function createSession(user, identity, googleCredential) {
  await ensureSessionSchema();
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = hashToken(raw);
  const now = Math.floor(Date.now() / 1000);
  const tokenExp = Number(identity && identity.exp || 0);
  const expSec = tokenExp > now ? Math.min(tokenExp, now + 3600) : now + 3300;
  const expires = new Date(expSec * 1000);
  await query(
    `INSERT INTO auth_sessions
      (session_hash,user_id,google_subject,google_email,google_name,google_picture,google_credential,expires_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [hash,user.id,String(identity.sub||""),String(identity.email||""),String(identity.name||""),String(identity.picture||""),String(googleCredential||""),expires]
  );
  try { await query("DELETE FROM auth_sessions WHERE expires_at<UTC_TIMESTAMP()"); } catch (_) {}
  return { token: raw, expiresAt: expires, maxAge: Math.max(60, expSec-now) };
}

async function readSession(req) {
  const raw = sessionToken(req);
  if (!raw || raw.length > 256) return null;
  await ensureSessionSchema();
  const rows = await query(
    `SELECT s.session_hash,s.user_id,s.google_subject,s.google_email,s.google_name,s.google_picture,
            s.google_credential,s.expires_at,u.email,u.display_name,u.role,u.active,u.metadata
       FROM auth_sessions s
       JOIN users u ON u.id=s.user_id
      WHERE s.session_hash=? AND s.expires_at>UTC_TIMESTAMP()
      LIMIT 1`,
    [hashToken(raw)]
  );
  const row = rows && rows[0];
  if (!row || !row.active) return null;
  try { await query("UPDATE auth_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE session_hash=?", [row.session_hash]); } catch (_) {}
  return {
    user: {id:row.user_id,email:row.email,display_name:row.display_name,role:row.role,active:row.active,metadata:row.metadata},
    identity: {sub:String(row.google_subject||""),email:String(row.google_email||"").toLowerCase(),name:String(row.google_name||""),picture:String(row.google_picture||"")},
    googleCredential: String(row.google_credential||"")
  };
}

async function destroySession(req) {
  const raw = sessionToken(req);
  if (!raw) return;
  await ensureSessionSchema();
  await query("DELETE FROM auth_sessions WHERE session_hash=?", [hashToken(raw)]);
}

function setSessionCookie(res, session) {
  res.setHeader("Set-Cookie", [
    COOKIE+"="+encodeURIComponent(session.token)+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+String(session.maxAge),
    "artyou_id_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
  ]);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", [
    COOKIE+"=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0",
    "artyou_id_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
  ]);
}

module.exports = { COOKIE, ensureSessionSchema, createSession, readSession, destroySession, setSessionCookie, clearSessionCookie };
