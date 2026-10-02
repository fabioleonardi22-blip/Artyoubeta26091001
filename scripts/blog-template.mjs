// Modello grafico condiviso del blog "La finestra sul cortile".
import { } from "node:fs";

export const safe = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));

const MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
export function dataLunga(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${Number(m[3])} ${MESI[Number(m[2]) - 1]} ${m[1]}` : safe(iso);
}

export const CATEGORIE = {
  "Improv around the world": "world",
  "Festival Radar": "radar",
  "Impro People": "people",
  "Dentro l'improv": "inside"
};
export const catClass = c => "cat-" + (CATEGORIE[c] || "world");

export function header() {
  return `<header>
  <a href="/" aria-label="Artyou Roma – Home"><img src="/img/logo-orizzontale-bianco.png" alt="Artyou Roma" width="170" height="56"></a>
  <input type="checkbox" id="menu-toggle" aria-hidden="true" tabindex="-1">
  <nav aria-label="Menu principale">
    <a href="/#spettacoli">Spettacoli</a>
    <a href="/improvvisazione-teatrale/">Corsi</a>
    <a href="/workshow/">WorkshoW</a>
    <a href="/rome-improv-festival/">Festival</a>
    <a href="/chi-siamo/">Chi Siamo</a>
    <a href="/merchandising.html">Merchandising</a>
    <a href="/insegnanti/" class="menu-extra">I docenti</a>
    <a href="/#contatti">Contatti</a>
  </nav>
  <div class="head-actions">
    <a href="/lezione-gratuita/" class="btn-wa"><span class="long">Lezione di Prova Gratuita</span><span class="short">Prova Gratuita</span></a>
    <label for="menu-toggle" class="menu-btn" role="button" aria-label="Apri il menu">
      <svg class="bars" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      <svg class="x" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </label>
  </div>
</header>
<div class="band" aria-hidden="true"></div>`;
}

export function outro() {
  return `<section class="outro">
  <div>
    <p class="kicker">Dal cortile al palco</p>
    <h2>Vuoi provare l’improvvisazione dal vivo?</h2>
    <p>Leggere è bello, giocare in scena è meglio. La prima lezione nelle nostre sedi di Roma è gratuita.</p>
  </div>
  <a href="/lezione-gratuita/" class="btn-wa">Prenota la lezione di prova</a>
</section>`;
}

export function footer() {
  return `<footer id="contatti">
  <span>© 2026 Artyou Roma · Via La Spezia, 73 – Roma</span>
  <span><strong>La finestra sul cortile</strong> · a cura della redazione Artyou Roma</span>
  <a href="mailto:info@artyouroma.it">info@artyouroma.it</a>
  <a href="/privacy-policy/" target="_blank" rel="noopener">Privacy Policy</a>
</footer>`;
}

export function page({ title, description, canonical, body, ogType = "website", jsonLd = "" }) {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${safe(title)}</title>
<meta name="description" content="${safe(description)}">
<link rel="canonical" href="${safe(canonical)}">
<meta property="og:title" content="${safe(title)}">
<meta property="og:description" content="${safe(description)}">
<meta property="og:type" content="${ogType}">
<meta property="og:url" content="${safe(canonical)}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap">
<link rel="stylesheet" href="/blog/blog.css">
${jsonLd}
</head>
<body>
<div class="site">
${header()}
<main>
${body}
</main>
${footer()}
</div>
<script>document.addEventListener("click",function(e){if(e.target.closest("header nav a")){var t=document.getElementById("menu-toggle");if(t)t.checked=false}});</script>
</body>
</html>
`;
}

export function renderArticle({ slug, title, category, date, excerpt, bodyHtml, sourcesHtml }) {
  const url = `https://artyouroma.it/la-finestra-sul-cortile/${slug}/`;
  const parole = String(bodyHtml).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const minuti = Math.max(1, Math.round(parole / 220));
  const ld = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "BlogPosting", headline: title, description: excerpt,
    datePublished: date, author: { "@type": "Organization", name: "Artyou Roma" },
    publisher: { "@type": "Organization", name: "Artyou Roma" }, mainEntityOfPage: url
  }).replace(/</g, "\\u003c")}</script>`;
  const body = `<section class="art-hero">
  <div class="art-head">
    <nav class="crumbs" aria-label="Percorso"><a href="/">Home</a><span>/</span><a href="/la-finestra-sul-cortile/">La finestra sul cortile</a></nav>
    <span class="chip ${catClass(category)}">${safe(category)}</span>
    <h1>${safe(title)}</h1>
    <p class="deck">${safe(excerpt)}</p>
    <div class="meta"><span>${dataLunga(date)}</span><span>Redazione Artyou Roma</span><span>${minuti} min di lettura</span></div>
  </div>
</section>
<article class="article">
  <div class="prose">
${bodyHtml}
  </div>
  ${sourcesHtml ? `<aside class="sources">${sourcesHtml}</aside>` : ""}
  <a class="back-link" href="/la-finestra-sul-cortile/">← Tutti gli articoli</a>
</article>
<section class="more" id="more" data-current="${safe(slug)}" hidden>
  <div class="section-title"><h2>Continua a leggere</h2><a href="/la-finestra-sul-cortile/">Vedi tutti</a></div>
  <div class="grid" id="moreGrid"></div>
</section>
${outro()}
<script src="/blog/blog.js" defer></script>`;
  return page({ title: `${title} | La finestra sul cortile`, description: excerpt, canonical: url, body, ogType: "article", jsonLd: ld });
}

export function bodyFromParagraphs(paragraphs) { return paragraphs.map(p => `    <p>${safe(p)}</p>`).join("\n"); }
export function sourcesFromList(list) {
  return `<h2>Fonti</h2><ul>${list.map(x => `<li><a href="${safe(x.url)}" target="_blank" rel="noopener noreferrer">${safe(x.name || x.url)}</a></li>`).join("")}</ul>`;
}

export function renderIndex() {
  const body = `<section class="hero">
  <div class="hero-text">
    <nav class="crumbs" aria-label="Percorso"><a href="/">Home</a><span>/</span><span>La finestra sul cortile</span></nav>
    <p class="kicker">Il blog internazionale di Artyou Roma</p>
    <h1>La finestra <span>sul cortile</span></h1>
    <p class="subtitle">Lo sconfinato mondo dell’improvvisazione</p>
    <p class="lead">Uno sguardo oltre Roma: festival, artisti, scuole, format, tecniche e idee che attraversano il mondo dell’improvvisazione teatrale. Ogni settimana un nuovo articolo.</p>
  </div>
  <div class="window" aria-hidden="true">
    <span></span><span></span><span></span><span></span>
  </div>
</section>
<nav class="tabs" aria-label="Rubriche">
  <div class="tabs-inner">
    <button class="tab" data-filter="all" aria-pressed="true">Tutto</button>
    <button class="tab" data-filter="Improv around the world" aria-pressed="false"><i class="dot cat-world"></i>Around the world</button>
    <button class="tab" data-filter="Festival Radar" aria-pressed="false"><i class="dot cat-radar"></i>Festival Radar</button>
    <button class="tab" data-filter="Impro People" aria-pressed="false"><i class="dot cat-people"></i>Impro People</button>
    <button class="tab" data-filter="Dentro l'improv" aria-pressed="false"><i class="dot cat-inside"></i>Dentro l’improv</button>
  </div>
</nav>
<div class="wrap" id="blog">
  <section class="lead-grid">
    <article class="feature" id="feature"><p class="kicker">Ultimo articolo</p><h2>Caricamento…</h2></article>
    <aside class="radar">
      <p class="kicker">Segnalazioni</p>
      <h3>Festival Radar</h3>
      <div id="radar"><p class="radar-empty">Qui segnaleremo festival e appuntamenti internazionali, sempre con il link alla fonte ufficiale.</p></div>
    </aside>
  </section>
  <div class="section-title"><h2>Dal cortile al mondo</h2><span id="count"></span></div>
  <section class="grid" id="grid" aria-live="polite"></section>
</div>
${outro()}
<script src="/blog/blog.js" defer></script>`;
  return page({
    title: "La finestra sul cortile | Il blog di Artyou Roma",
    description: "Festival, insegnanti, scuole, format e tendenze dal mondo internazionale dell'improvvisazione teatrale, raccontati da Artyou Roma.",
    canonical: "https://artyouroma.it/la-finestra-sul-cortile/",
    body
  });
}