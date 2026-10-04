const { query } = require("../lib/db");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, errore: "method_not_allowed" });
  }

  try {
    await query("SELECT COUNT(*) AS c FROM events");
    return res.status(200).json({
      ok: true,
      mysql: true
    });
  } catch (err) {
    return res.status(503).json({
      ok: false,
      mysql: false,
      errore: "database_unavailable"
    });
  }
};
