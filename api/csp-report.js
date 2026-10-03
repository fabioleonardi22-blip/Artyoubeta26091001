const {
  rateLimit,
  rejectRateLimited,
  sameOrigin,
  setSecurityHeaders
} = require("../lib/security");

function clean(value, max) {
  return String(value == null ? "" : value).replace(/[\r\n]/g, " ").slice(0, max);
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);

  if (String(req.method || "").toUpperCase() !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok:false, errore:"method_not_allowed" });
  }

  if (!sameOrigin(req)) {
    return res.status(403).json({ ok:false, errore:"origin_non_consentita" });
  }

  const limit = rateLimit(req, { key:"csp-report", limit:60, windowMs:60 * 1000 });
  if (!limit.ok) return rejectRateLimited(res, limit);

  let body = req.body || {};
  if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf8") > 32 * 1024) {
      return res.status(413).json({ ok:false, errore:"payload_too_large" });
    }
    try { body = JSON.parse(body); }
    catch (_) { return res.status(400).json({ ok:false, errore:"json_non_valido" }); }
  }

  const report = body["csp-report"] || body.body || body;
  const safe = {
    documentUri: clean(report["document-uri"] || report.documentURL, 500),
    violatedDirective: clean(report["violated-directive"] || report.effectiveDirective, 160),
    blockedUri: clean(report["blocked-uri"] || report.blockedURL, 500),
    sourceFile: clean(report["source-file"] || report.sourceFile, 500),
    lineNumber: Number(report["line-number"] || report.lineNumber || 0) || 0
  };

  console.warn("ARTYOU_CSP_REPORT", JSON.stringify(safe));
  return res.status(204).end();
};
