const { verifyGoogleIdToken } = require("../lib/google-auth");

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgqQguCWRt7yCTroh2qi4az1rCTZ7kgw0IxNRNDb9LZLOGPUD5Jy3K56NTi6FxAfKx/exec";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (String(req.method || "POST").toUpperCase() !== "POST") {
    return res.status(405).json({ok:false, errore:"method_not_allowed"});
  }
  try {
    let body = req.body || {};
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    const credential = String(body.credential || "");
    const identity = await verifyGoogleIdToken(credential);

    const url = APPS_SCRIPT_URL + "?action=po_session&email=" + encodeURIComponent(identity.email) + "&_=" + Date.now();
    const upstream = await fetch(url, { method:"GET", redirect:"follow" });
    const text = await upstream.text();
    let session;
    try { session = JSON.parse(text); } catch (e) { throw new Error("backend_response_invalid"); }
    if (!session || !session.ok) {
      return res.status(403).json({ok:false, errore:(session && session.errore) || "accesso_non_autorizzato"});
    }
    return res.status(200).json({
      ok:true,
      email:identity.email,
      name:identity.name,
      picture:identity.picture,
      admin:!!session.admin,
      person:session.person || null
    });
  } catch (err) {
    const code = String(err && err.message || "auth_error");
    const status = /missing/.test(code) ? 503 : 401;
    return res.status(status).json({ok:false, errore:code});
  }
};
