// Origine del deploy che sta rispondendo (produzione o beta su vercel.app).
// Serve a leggere template e API dallo stesso deploy invece che dal dominio
// principale, che finché la migrazione non è completa serve ancora WordPress.
const CANONICAL_ORIGIN = "https://artyouroma.it";

function selfOrigin(req) {
  const h = (req && req.headers) || {};
  const host = String(h["x-forwarded-host"] || h.host || "").split(",")[0].trim().toLowerCase();
  if (/^(www\.)?artyouroma\.it$/.test(host) || /^[a-z0-9-]+\.vercel\.app$/.test(host)) return "https://" + host;
  return CANONICAL_ORIGIN;
}

module.exports = { selfOrigin, CANONICAL_ORIGIN };
