function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function safeJson(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
module.exports = async function handler(req, res) {
  try {
    const slug = String((req.query && req.query.slug) || "").trim();
    const origin = "https://artyouroma.it";

    const templateResp = await fetch(origin + "/insegnante.html", { redirect: "follow" });
    let html = await templateResp.text();

    const m = html.match(/var TEACH = (\[[\s\S]*?\]);\s*var META/);
    let teachers = [];
    if (m && m[1]) {
      try { teachers = JSON.parse(m[1]); } catch (_) {}
    }
    const teacher = teachers.find(t => String(t && t.slug || "") === slug) || null;

    if (!teacher) {
      html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i, '<meta name="robots" content="noindex,follow">');
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(404).send(html);
    }

    const canonical = "https://artyouroma.it/insegnanti/" + encodeURIComponent(slug) + "/";
    const title = teacher.name + " | Insegnante Artyou Roma";
    const description = (teacher.role
      ? teacher.name + " è " + teacher.role + " in Artyou Roma. Scopri profilo, formazione, corsi e attività."
      : "Scopri il profilo di " + teacher.name + ", insegnante di Artyou Roma."
    ).slice(0, 160);

    html = html.replace(/<title>[\s\S]*?<\/title>/i, "<title>" + escHtml(title) + "</title>");
    html = html.replace(/<meta\s+name=["']description["'][^>]*>/i,
      '<meta name="description" content="' + escHtml(description) + '">');
    html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i,
      '<meta name="robots" content="index,follow">');

    if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
      html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i,
        '<link rel="canonical" href="' + escHtml(canonical) + '">');
    } else {
      html = html.replace("</head>", '<link rel="canonical" href="' + escHtml(canonical) + '">\n</head>');
    }

    const image = teacher.photo
      ? (String(teacher.photo).startsWith("http") ? String(teacher.photo) : "https://artyouroma.it/" + String(teacher.photo).replace(/^\//, ""))
      : undefined;
    const schema = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: String(teacher.name || ""),
      jobTitle: String(teacher.role || "Insegnante"),
      url: canonical,
      worksFor: {
        "@type": "Organization",
        name: "Artyou Roma",
        url: "https://artyouroma.it/"
      }
    };
    if (image) schema.image = image;
    if (teacher.ig && !String(teacher.ig).includes("[username]")) schema.sameAs = [String(teacher.ig)];

    const seoBlock =
      '\n<meta property="og:title" content="' + escHtml(title) + '">' +
      '\n<meta property="og:description" content="' + escHtml(description) + '">' +
      '\n<meta property="og:type" content="profile">' +
      '\n<meta property="og:url" content="' + escHtml(canonical) + '">' +
      (image ? '\n<meta property="og:image" content="' + escHtml(image) + '">' : "") +
      '\n<script type="application/ld+json">' + safeJson(schema) + '<\\/script>\n';

    html = html.replace("</head>", seoBlock + "</head>");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send("Errore caricamento profilo insegnante");
  }
};
