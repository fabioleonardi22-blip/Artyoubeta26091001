const { query } = require("../lib/db");

const SITE = "https://artyouroma.it";
const STATIC_URLS = [
  "/",
  "/improvvisazione-teatrale/",
  "/teatro/",
  "/stand-up/",
  "/lezione-gratuita/",
  "/chi-siamo/",
  "/formazione-aziende/",
  "/insegnanti/",
  "/contatti/",
  "/workshow/",
  "/rome-improv-festival/",
  "/yep/",
  "/spettacoli/",
  "/un-vortice-di-emozioni/",
  "/la-finestra-sul-cortile/",
  "/la-finestra-sul-cortile/improv-around-the-world-da-chicago-a-londra-e-barcellona/",
  "/la-finestra-sul-cortile/perche-guardare-oltre-il-proprio-palco/",
  "/merchandising/",
  "/privacy-policy/",
  "/countdown/",
  "/improv-generator/",
  "/improv-generator/luoghi/",
];

function escXml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function ymd(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0,10);
  return d.toISOString().slice(0,10);
}

function isPublicShow(row) {
  const slug = String(row.slug || "").toLowerCase();
  const hay = [
    row.category,
    row.event_type,
    row.title,
    row.description
  ].map(v => String(v || "").toLowerCase()).join(" ");
  if (/workshop|workshow|rif|yep|corso|lezione|camera|soggiorno/.test(hay)) return false;
  return /spettacol|show|saggi|shortyou|stand.?up|evento/.test(hay) ||
    /^shortyou(?:-|$)/.test(slug);
}

async function teacherUrls(origin) {
  try {
    const r = await fetch(origin + "/insegnante.html", { redirect:"follow" });
    const html = await r.text();
    const m = html.match(/var TEACH = (\[[\s\S]*?\]);\s*var META/);
    if (!m || !m[1]) return [];
    const list = JSON.parse(m[1]);
    return list
      .map(t => String(t && t.slug || "").trim())
      .filter(Boolean)
      .map(slug => "/insegnanti/" + encodeURIComponent(slug) + "/");
  } catch (_) {
    return [];
  }
}

module.exports = async function handler(req, res) {
  const method = String(req.method || "GET").toUpperCase();
  if (!["GET","HEAD"].includes(method)) {
    res.setHeader("Allow","GET, HEAD");
    return res.status(405).end();
  }

  const today = new Date().toISOString().slice(0,10);
  const origin = "https://artyouroma.it";

  const urls = new Map();
  STATIC_URLS.forEach(path => urls.set(SITE + path, null));

  const teachers = await teacherUrls(origin);
  teachers.forEach(path => urls.set(SITE + path, null));

  try {
    const rows = await query(
      `SELECT slug,title,category,event_type,description,active,updated_at
       FROM events
       WHERE active=1
       ORDER BY updated_at DESC, id DESC`
    );
    for (const row of rows) {
      if (!isPublicShow(row)) continue;
      const slug = String(row.slug || "").trim();
      if (!slug) continue;
      urls.set(SITE + "/spettacoli/" + encodeURIComponent(slug) + "/", ymd(row.updated_at));
    }
  } catch (err) {
    console.error("SITEMAP_MYSQL_FALLBACK", String(err && err.message || err));
  }

  // Transitional safety net: merge any public show that is still only in the
  // legacy event service. MySQL remains primary; duplicates are overwritten.
  try {
    const r = await fetch(origin + "/api/artyou?eventi=1&sitemap=1", { redirect:"follow" });
    if (r.ok) {
      const data = await r.json();
      const events = data && data.eventi && typeof data.eventi === "object" ? data.eventi : {};
      for (const [slug, ev] of Object.entries(events)) {
        const row = {
          slug,
          title: ev && (ev.titolo || ev.title),
          category: ev && (ev.categoria || ev.category),
          event_type: ev && (ev.tipo || ev.event_type),
          description: ev && (ev.descrizione || ev.description || ev.desc)
        };
        if (!isPublicShow(row)) continue;
        if (!String(slug || "").trim()) continue;
        const loc = SITE + "/spettacoli/" + encodeURIComponent(slug) + "/";
        if (!urls.has(loc)) urls.set(loc, null);
      }
    }
  } catch (_) {}

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    Array.from(urls.entries()).map(([loc,lastmod]) =>
      '  <url><loc>' + escXml(loc) + '</loc>' + (lastmod ? '<lastmod>' + escXml(lastmod) + '</lastmod>' : '') + '</url>'
    ).join("\n") +
    '\n</urlset>\n';

  res.setHeader("Content-Type","application/xml; charset=utf-8");
  res.setHeader("Cache-Control","public, s-maxage=1800, stale-while-revalidate=86400");
  return res.status(200).send(method === "HEAD" ? "" : xml);
};
