const { verifyGoogleIdToken } = require("../lib/google-auth");
const { query } = require("../lib/db");
const {
  rateLimit,
  applyRateLimitHeaders,
  rejectRateLimited,
  sameOrigin,
  setSecurityHeaders
} = require("../lib/security");

const APPS_SCRIPT_URL = String(process.env.ARTYOU_APPS_SCRIPT_URL || "").trim();

function roleToAccessLevel(role) {
  if (role === "admin") return "Amministratore";
  if (role === "staff") return "Staff";
  return "Docente";
}

function sessionFromUser(identity, user) {
  let metadata = {};
  try {
    metadata = typeof user.metadata === "string" ? JSON.parse(user.metadata || "{}") : (user.metadata || {});
  } catch (_) {}

  return {
    ok: true,
    email: identity.email,
    name: user.display_name || identity.name || "",
    picture: identity.picture,
    admin: user.role === "admin",
    accessLevel: roleToAccessLevel(user.role),
    person: {
      id: String(user.id),
      name: user.display_name || identity.name || "",
      email: identity.email,
      role: metadata.role || "",
      kind: metadata.kind || (user.role === "teacher" ? "Docente" : "Staff"),
      skills: Array.isArray(metadata.skills) ? metadata.skills : [],
      phone: metadata.phone || "",
      active: !!user.active
    },
    authSource: "mysql"
  };
}

async function findMysqlUser(email) {
  const rows = await query(
    "SELECT id,email,display_name,role,active,metadata FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1",
    [email]
  );
  return rows && rows[0] ? rows[0] : null;
}

async function authorizeViaAppsScript(credential) {
  if (!APPS_SCRIPT_URL) return null;

  const url = APPS_SCRIPT_URL + "?action=po_session&token=" + encodeURIComponent(credential) + "&_=" + Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  let upstream;
  try {
    upstream = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("backend_timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const text = await upstream.text();
  let session;
  try { session = JSON.parse(text); } catch (_) { throw new Error("backend_response_invalid"); }
  if (!session || !session.ok) return null;
  return session;
}

function appsScriptRole(session) {
  if (session && session.admin) return "admin";
  const level = String((session && session.accessLevel) || "").toLowerCase();
  if (level === "amministratore") return "admin";
  if (level === "staff") return "staff";
  return "teacher";
}

async function upsertMysqlUser(identity, session) {
  const role = appsScriptRole(session);
  const person = (session && session.person) || {};
  const metadata = {
    source: "apps-script-migration",
    kind: person.kind || (role === "teacher" ? "Docente" : "Staff"),
    role: person.role || "",
    phone: person.phone || "",
    skills: Array.isArray(person.skills) ? person.skills : [],
    migratedAt: new Date().toISOString()
  };

  await query(
    `INSERT INTO users (email,display_name,role,active,metadata)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       display_name=VALUES(display_name),
       role=VALUES(role),
       active=VALUES(active),
       metadata=VALUES(metadata),
       updated_at=CURRENT_TIMESTAMP`,
    [
      identity.email,
      person.name || identity.name || "",
      role,
      person.active === false ? 0 : 1,
      JSON.stringify(metadata)
    ]
  );

  return findMysqlUser(identity.email);
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);

  if (String(req.method || "POST").toUpperCase() !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok:false, errore:"method_not_allowed" });
  }
  if (!sameOrigin(req)) {
    return res.status(403).json({ ok:false, errore:"origin_non_consentita" });
  }

  const limit = rateLimit(req, { key:"google-auth", limit:20, windowMs:60 * 1000 });
  applyRateLimitHeaders(res, limit);
  if (!limit.ok) return rejectRateLimited(res, limit);

  try {
    let body = req.body || {};
    if (typeof body === "string") {
      if (Buffer.byteLength(body, "utf8") > 32 * 1024) {
        return res.status(413).json({ ok:false, errore:"payload_too_large" });
      }
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }

    const credential = String(body.credential || "");
    if (!credential || credential.length > 8192) {
      return res.status(400).json({ ok:false, errore:"credential_non_valida" });
    }

    const identity = await verifyGoogleIdToken(credential);

    // 1) MySQL è ora la fonte primaria per autorizzazioni.
    try {
      const user = await findMysqlUser(identity.email);
      if (user) {
        if (!user.active) {
          return res.status(403).json({ ok:false, errore:"accesso_non_autorizzato" });
        }
        return res.status(200).json(sessionFromUser(identity, user));
      }
    } catch (dbErr) {
      console.error("MYSQL_AUTH_LOOKUP_ERROR", String(dbErr && dbErr.message || dbErr));
      // Durante la migrazione non blocchiamo gli utenti già autorizzati nel vecchio sistema.
    }

    // 2) Fallback temporaneo: Apps Script autorizza gli utenti non ancora migrati.
    //    Al primo accesso valido vengono copiati automaticamente nella tabella users.
    const legacySession = await authorizeViaAppsScript(credential);
    if (!legacySession) {
      return res.status(403).json({ ok:false, errore:"accesso_non_autorizzato" });
    }

    try {
      const migratedUser = await upsertMysqlUser(identity, legacySession);
      if (migratedUser && migratedUser.active) {
        return res.status(200).json(sessionFromUser(identity, migratedUser));
      }
    } catch (dbErr) {
      console.error("MYSQL_AUTH_MIGRATION_ERROR", String(dbErr && dbErr.message || dbErr));
    }

    // Se MySQL è momentaneamente indisponibile, manteniamo il login legacy operativo.
    return res.status(200).json({
      ok:true,
      email:identity.email,
      name:identity.name,
      picture:identity.picture,
      admin:!!legacySession.admin,
      accessLevel:String(legacySession.accessLevel || (legacySession.admin ? "Amministratore" : "Docente")),
      person:legacySession.person || null,
      authSource:"apps-script-fallback"
    });
  } catch (err) {
    const code = String(err && err.message || "auth_error");
    if (/missing/.test(code)) return res.status(503).json({ ok:false, errore:"auth_non_configurata" });
    if (code === "backend_timeout") return res.status(504).json({ ok:false, errore:"backend_timeout" });
    return res.status(401).json({ ok:false, errore:"autenticazione_non_valida" });
  }
};
