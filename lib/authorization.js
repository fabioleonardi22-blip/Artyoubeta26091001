const { readSession } = require("./session");

function normalizeRole(role) {
  const r = String(role || "").trim().toLowerCase();
  return ["admin","staff","teacher"].includes(r) ? r : "";
}

async function requireUser(req, allowedRoles) {
  const session = await readSession(req);
  if (!session) throw new Error("google_login_required");
  const user = session.user;
  user.role = normalizeRole(user.role);
  if (!user.role) throw new Error("ruolo_non_valido");
  if (Array.isArray(allowedRoles) && allowedRoles.length && !allowedRoles.includes(user.role)) {
    throw new Error("permesso_insufficiente");
  }
  return { identity:session.identity, user, token:session.googleCredential, session };
}

function authErrorStatus(code) {
  if (code === "google_login_required" || /^google_/.test(code)) return 401;
  if (code === "accesso_non_autorizzato" || code === "permesso_insufficiente" || code === "ruolo_non_valido") return 403;
  return 500;
}

module.exports = { requireUser, authErrorStatus, normalizeRole };
