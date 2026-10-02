// Foto per "La finestra sul cortile" da Unsplash (gratuite, con citazione dell'autore).
// Regole Unsplash rispettate: l'immagine resta ospitata su Unsplash (hotlink),
// si segnala il download e si cita il fotografo con il link a Unsplash.
//
// Uso:
//   import { findImage } from "./blog-images.mjs"  → usato da generate-blog.mjs
//   node scripts/blog-images.mjs                    → aggiunge la foto agli articoli che non ce l'hanno
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UTM = "utm_source=artyou_roma&utm_medium=referral";

// ricerca di riserva per rubrica, se l'articolo non suggerisce parole chiave
export const QUERY_RUBRICA = {
  "Improv around the world": "theatre stage city night",
  "Festival Radar": "theatre festival audience",
  "Impro People": "actor on stage spotlight",
  "Dentro l'improv": "theatre rehearsal actors"
};

function scegli(results, seed) {
  if (!results.length) return null;
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return results[h % Math.min(results.length, 6)];
}

export async function findImage(query, { key = process.env.UNSPLASH_ACCESS_KEY, seed = query } = {}) {
  if (!key || !query) return null;
  const url = "https://api.unsplash.com/search/photos?" + new URLSearchParams({
    query, orientation: "landscape", per_page: "10", content_filter: "high"
  });
  const r = await fetch(url, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } });
  if (!r.ok) { console.log("Unsplash:", r.status, await r.text()); return null; }
  const data = await r.json();
  const p = scegli(data.results || [], seed);
  if (!p) { console.log("Unsplash: nessuna foto per", query); return null; }
  // segnalazione di download richiesta dalle linee guida Unsplash
  try { await fetch(p.links.download_location, { headers: { Authorization: `Client-ID ${key}` } }); } catch (e) {}
  const base = p.urls.raw + (p.urls.raw.includes("?") ? "&" : "?");
  return {
    image: base + "w=1600&q=75&fm=jpg&fit=crop&ar=16:9",
    imageThumb: base + "w=720&q=70&fm=jpg&fit=crop&ar=16:9",
    imageAlt: p.alt_description || p.description || "",
    imageCredit: { name: p.user?.name || "Unsplash", url: `${p.user?.links?.html || "https://unsplash.com"}?${UTM}` },
    imageSourceUrl: `https://unsplash.com/?${UTM}`
  };
}

// Esecuzione diretta: completa gli articoli senza foto
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  if (!process.env.UNSPLASH_ACCESS_KEY) { console.log("UNSPLASH_ACCESS_KEY mancante: nessuna foto aggiunta."); process.exit(0); }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dataPath = path.join(root, "blog", "articles.json");
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  let n = 0;
  for (const a of data.articles || []) {
    if (a.image) continue;
    const q = a.imageQuery || QUERY_RUBRICA[a.category] || "improv theatre stage";
    const img = await findImage(q, { seed: a.slug });
    if (img) { Object.assign(a, img); n++; console.log("Foto aggiunta:", a.slug, "→", img.imageCredit.name); }
  }
  if (n) fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n");
  console.log(n ? `${n} foto aggiunte.` : "Nessuna foto da aggiungere.");
}
