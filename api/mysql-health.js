const { query } = require("../lib/db");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, errore: "method_not_allowed" });
  }

  try {
    const rows = await query("SELECT NOW() AS now, DATABASE() AS db");
    return res.status(200).json({
      ok: true,
      mysql: true,
      database: rows[0] && rows[0].db,
      now: rows[0] && rows[0].now
    });
  } catch (err) {
    return res.status(503).json({
      ok: false,
      mysql: false,
      errore: "database_unavailable",
      dettaglio: String(err && err.message || err)
    });
  }
};
