const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { query } = require("../lib/db");
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgqQguCWRt7yCTroh2qi4az1rCTZ7kgw0IxNRNDb9LZLOGPUD5Jy3K56NTi6FxAfKx/exec";

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function safeJson(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function fallback(slug) {
  const shows = {
    "shortyou": {
      slug: "shortyou",
      title: "ShortYou · show & aperitivo",
      desc: "Scene brevi, giochi e tanta complicità con il pubblico: lo show di improvvisazione di Artyou, con aperitivo, al The Spot Improv.",
      venue: "The Spot Improv",
      addr: "Via Giuseppe Bonaccorsi, 28 – Roma (Valle Aurelia)",
      dates: [{ label: "Domenica 4 ottobre · dalle 19:30" }],
      poster: "/img/shortyou-4-ottobre.jpg"
    },
    "shortyou-29-novembre": {
      slug: "shortyou-29-novembre",
      title: "ShortYou · show & aperitivo",
      desc: "Scene brevi, giochi e tanta complicità con il pubblico: lo show di improvvisazione di Artyou, con aperitivo, al The Spot Improv.",
      venue: "The Spot Improv",
      addr: "Via Giuseppe Bonaccorsi, 28 – Roma (Valle Aurelia)",
      dates: [{ label: "Domenica 29 novembre · dalle 19:30" }]
    }
  };
  return shows[slug] || null;
}

module.exports = async function handler(req, res) {
  try {
    const slug = String((req.query && req.query.slug) || "").trim();
    const origin = "https://artyouroma.it";

    let html = readFileSync(join(__dirname, "..", "spettacolo.html"), "utf8");

    let event = null;

    // MySQL is the primary source for public event SEO pages.
    try {
      const rows = await query(
        `SELECT e.slug,e.title,e.description,e.poster_url,e.venue,e.address,e.category,e.event_type,e.metadata,
                ed.starts_at,ed.date_label
         FROM events e
         LEFT JOIN event_dates ed
           ON ed.id=(SELECT ed2.id FROM event_dates ed2
                     WHERE ed2.event_id=e.id AND ed2.active=1
                     ORDER BY COALESCE(ed2.starts_at,'9999-12-31'),ed2.id LIMIT 1)
         WHERE e.slug=? AND e.active=1
         LIMIT 1`,
        [slug]
      );
      if (rows.length) {
        const r = rows[0];
        let meta = {};
        try { meta = typeof r.metadata === "string" ? JSON.parse(r.metadata || "{}") : (r.metadata || {}); } catch (_) {}
        event = {
          slug: r.slug,
          title: r.title,
          desc: r.description || "",
          venue: r.venue || "",
          addr: r.address || "",
          poster: r.poster_url || "",
          category: r.category || "",
          event_type: r.event_type || "",
          dates: [{
            label: r.date_label || "",
            start: r.starts_at ? new Date(r.starts_at).toISOString() : "",
            ora: meta.ora || ""
          }]
        };
      }
    } catch (_) {}

    // Transitional fallback while all public-event fields finish migrating.
    if (!event) {
      try {
        const upstream = await fetch(APPS_SCRIPT_URL + "?action=public", { redirect: "follow" });
        const data = await upstream.json();
        if (data && data.ok && Array.isArray(data.events)) {
          event = data.events.find(e => String(e && e.slug || "") === slug) || null;
        }
      } catch (_) {}
    }

    if (!event) event = fallback(slug);

    const placeholder = !event || /^\s*\[/.test(String(event.title || ""));
    const title = event && event.title ? event.title + " a Roma | Artyou" : "Spettacolo a Roma | Artyou";
    const description = event && event.desc
      ? String(event.desc).slice(0, 160)
      : "Scopri gli spettacoli Artyou Roma: date, sedi, informazioni e prenotazioni.";
    const canonical = "https://artyouroma.it/spettacoli/" + encodeURIComponent(slug) + "/";

    html = html.replace(/<title>[\s\S]*?<\/title>/i, "<title>" + escHtml(title) + "</title>");
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/i,
      '<meta name="description" content="' + escHtml(description) + '">');
    html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i,
      '<meta name="robots" content="' + (placeholder ? "noindex,follow" : "index,follow") + '">');
    html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i,
      '<link rel="canonical" href="' + escHtml(canonical) + '">');

    if (!placeholder) {
      const firstDate = event.dates && event.dates[0] ? event.dates[0] : {};
      const dateLabel = firstDate && firstDate.label ? String(firstDate.label) : "";
      const startDate = firstDate && firstDate.start ? String(firstDate.start) : "";
      const image = event.poster
        ? (String(event.poster).startsWith("http") ? String(event.poster) : "https://artyouroma.it/" + String(event.poster).replace(/^\//, ""))
        : undefined;

      const schema = {
        "@context": "https://schema.org",
        "@type": "Event",
        name: String(event.title || ""),
        description: String(event.desc || ""),
        url: canonical,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        organizer: {
          "@type": "Organization",
          name: "Artyou Roma",
          url: "https://artyouroma.it/"
        },
        location: {
          "@type": "Place",
          name: String(event.venue || "Roma"),
          address: String(event.addr || "Roma")
        }
      };
      if (image) schema.image = [image];
      if (startDate) schema.startDate = startDate;
      else if (dateLabel) schema.eventSchedule = {
        "@type": "Schedule",
        description: dateLabel
      };

      const seoBlock =
        '\n<meta property="og:title" content="' + escHtml(title) + '">' +
        '\n<meta property="og:description" content="' + escHtml(description) + '">' +
        '\n<meta property="og:type" content="website">' +
        '\n<meta property="og:url" content="' + escHtml(canonical) + '">' +
        (image ? '\n<meta property="og:image" content="' + escHtml(image) + '">' : "") +
        '\n<script type="application/ld+json">' + safeJson(schema) + '</script>\n';

      html = html.replace("</head>", seoBlock + "</head>");
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    res.status(placeholder ? 404 : 200).send(html);
  } catch (err) {
    res.status(500).send("Errore caricamento spettacolo");
  }
};
