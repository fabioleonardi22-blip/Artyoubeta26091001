const { verifyGoogleIdToken, authToken } = require("./google-auth");
const { query } = require("./db");

function normalizeRole(role) {
  const r = String(role || "").trim().toLowerCase();
  return ["admin","staff","teacher"].includes(r) ? r : "teacher";
}

async function requireUser(req, allowedRoles) {
  const token = authToken(req);
  if (!token || token.length > 8192) throw new Error("google_login_required");
  const identity = await verifyGoogleIdToken(token);
  const rows = await query(
    "SELECT id,email,display_name,role,active,metadata FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1",
    [identity.email]
  );
  const user = rows && rows[0];
  if (!user || !user.active) throw new Error("accesso_non_autorizzato");
  user.role = normalizeRole(user.role);
  if (Array.isArray(allowedRoles) && allowedRoles.length && !allowedRoles.includes(user.role)) {
    throw new Error("permesso_insufficiente");
  }
  return { identity, user, token };
}

function authErrorStatus(code) {
  if (code === "google_login_required" || /^google_/.test(code)) return 401;
  if (code === "accesso_non_autorizzato" || code === "permesso_insufficiente") return 403;
  return 500;
}

module.exports = { requireUser, authErrorStatus, normalizeRole };
