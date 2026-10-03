const { query } = require("../lib/db");

function asNumber(v) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

async function publicEvents() {
  const rows = await query(`
    SELECT e.slug, e.title, e.capacity, e.price,
           COALESCE(
             DATE_FORMAT(
               (SELECT d.starts_at
                  FROM event_dates d
                 WHERE d.event_id = e.id AND d.active = 1
                 ORDER BY d.starts_at IS NULL, d.starts_at
                 LIMIT 1),
               '%d/%m/%Y %H:%i'
             ),
             (SELECT d.date_label
                FROM event_dates d
               WHERE d.event_id = e.id AND d.active = 1
               ORDER BY d.id
               LIMIT 1),
             ''
           ) AS date_label
      FROM events e
     WHERE e.active = 1
     ORDER BY e.sort_order, e.id
  `);

  const out = {};
  for (const r of rows) {
    out[r.slug] = {
      titolo: r.title || "",
      data: r.date_label || "",
      capienza: asNumber(r.capacity),
      prezzo: asNumber(r.price),
      attivo: true
    };
  }
  return out;
}

async function availability() {
  const rows = await query(`
    SELECT
      e.slug,
      e.capacity,
      COALESCE(SUM(
        CASE
          WHEN b.status IN ('RISERVATO','PAGATO') THEN b.seats
          WHEN b.status = 'HOLD' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > UTC_TIMESTAMP()) THEN b.seats
          ELSE 0
        END
      ),0) AS occupied
    FROM events e
    LEFT JOIN bookings b ON b.event_id = e.id
    WHERE e.active = 1
    GROUP BY e.id, e.slug, e.capacity
    ORDER BY e.sort_order, e.id
  `);

  const out = {};
  for (const r of rows) {
    out[r.slug] = Math.max(0, Number(r.capacity || 0) - Number(r.occupied || 0));
  }
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, errore: "method_not_allowed" });
  }

  try {
    const wantsAvailability = String(req.query && req.query.disponibilita || "") === "1";
    const wantsEvents = String(req.query && req.query.eventi || "") === "1";

    if (wantsAvailability) {
      return res.status(200).json({ ok: true, disponibilita: await availability(), source: "mysql" });
    }
    if (wantsEvents) {
      return res.status(200).json({ ok: true, eventi: await publicEvents(), source: "mysql" });
    }

    return res.status(200).json({
      ok: true,
      source: "mysql",
      eventi: await publicEvents(),
      disponibilita: await availability()
    });
  } catch (err) {
    return res.status(503).json({
      ok: false,
      errore: "database_unavailable",
      dettaglio: String(err && err.message || err)
    });
  }
};
