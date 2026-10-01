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
    const proto = String(req.headers["x-forwarded-proto"] || "https");
    const host = String(req.headers.host || "");
    const origin = proto + "://" + host;

    const templateResp = await fetch(origin + "/spettacolo.html", { redirect: "follow" });
    let html = await templateResp.text();

    let event = null;
    try {
      const upstream = await fetch(APPS_SCRIPT_URL + "?action=public", { redirect: "follow" });
      const data = await upstream.json();
      if (data && data.ok && Array.isArray(data.events)) {
        event = data.events.find(e => String(e && e.slug || "") === slug) || null;
      }
    } catch (_) {}

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
      const dateLabel = event.dates && event.dates[0] && event.dates[0].label ? String(event.dates[0].label) : "";
      const image = event.poster
        ? (String(event.poster).startsWith("http") ? String(event.poster) : "https://artyouroma.it/" + String(event.poster).replace(/^\//, ""))
        : undefined;

      const schema = {
        "@context": "https://schema.org",
        "@type": "Event",
        name: String(event.title || ""),
        description: String(event.desc || ""),
        url: canonical,
        location: {
          "@type": "Place",
          name: String(event.venue || "Roma"),
          address: String(event.addr || "Roma")
        }
      };
      if (image) schema.image = [image];
      if (dateLabel) schema.eventSchedule = {
        "@type": "Schedule",
        description: dateLabel
      };

      const seoBlock =
        '\n<meta property="og:title" content="' + escHtml(title) + '">' +
        '\n<meta property="og:description" content="' + escHtml(description) + '">' +
        '\n<meta property="og:type" content="website">' +
        '\n<meta property="og:url" content="' + escHtml(canonical) + '">' +
        (image ? '\n<meta property="og:image" content="' + escHtml(image) + '">' : "") +
        '\n<script type="application/ld+json">' + safeJson(schema) + '<\\/script>\n';

      html = html.replace("</head>", seoBlock + "</head>");
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    res.status(placeholder ? 404 : 200).send(html);
  } catch (err) {
    res.status(500).send("Errore caricamento spettacolo");
  }
};
