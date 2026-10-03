const { verifyGoogleIdToken } = require("../lib/google-auth");
const {
  rateLimit,
  applyRateLimitHeaders,
  rejectRateLimited,
  sameOrigin,
  setSecurityHeaders
} = require("../lib/security");

const APPS_SCRIPT_URL = String(process.env.ARTYOU_APPS_SCRIPT_URL || "").trim();

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);
  if (!APPS_SCRIPT_URL) return res.status(503).json({ ok:false, errore:"backend_non_configurato" });

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

    const url = APPS_SCRIPT_URL + "?action=po_session&token=" + encodeURIComponent(credential) + "&_=" + Date.now();
    const upstream = await fetch(url, { method:"GET", redirect:"follow" });
    const text = await upstream.text();
    let session;
    try { session = JSON.parse(text); } catch (_) { throw new Error("backend_response_invalid"); }

    if (!session || !session.ok) {
      return res.status(403).json({ ok:false, errore:"accesso_non_autorizzato" });
    }

    return res.status(200).json({
      ok:true,
      email:identity.email,
      name:identity.name,
      picture:identity.picture,
      admin:!!session.admin,
      accessLevel:String(session.accessLevel || (session.admin ? "Amministratore" : "Docente")),
      person:session.person || null
    });
  } catch (err) {
    const code = String(err && err.message || "auth_error");
    if (/missing/.test(code)) return res.status(503).json({ ok:false, errore:"auth_non_configurata" });
    return res.status(401).json({ ok:false, errore:"autenticazione_non_valida" });
  }
};
