// api/artyou.js e api/booking-admin.js con l'interruttore ARTYOU_BOOKING_PRIMARY.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

function load(file, { store, copy, upstream, db, env }) {
  const base = path.join(__dirname, "..", "api");
  const secure = { setSecurityHeaders() {}, rateLimit() { return { ok: true }; }, applyRateLimitHeaders() {}, rejectRateLimited() {}, sameOrigin() { return true; } };
  const stubs = {
    "../lib/db": db || { query: async () => [{ id: 1 }] },
    "../lib/security": secure,
    "../lib/persistent-rate-limit": { persistentRateLimit: async () => ({ ok: true }) },
    "../lib/booking-store": store,
    "../lib/sheet-copy": copy || { copyAfterResponse: () => null },
    "../lib/authorization": { requireUser: async () => ({ identity: { email: "staff@example.test" }, user: { role: "staff" } }), authErrorStatus: () => 401 },
    "../lib/audit": { audit: async () => {} }
  };
  const box = {
    module: { exports: {} }, __dirname: base,
    require(name) { if (name in stubs) return stubs[name]; return require(path.isAbsolute(name) || name.startsWith("node:") ? name : path.resolve(base, name)); },
    URLSearchParams, Buffer, Date, console, AbortSignal, Intl,
    process: { env: { ARTYOU_APPS_SCRIPT_URL: "https://source.example.test", ARTYOU_ADMIN_SECRET: "s", ...(env || {}) } },
    fetch: upstream || (async () => { throw Error("Network must not be used"); })
  };
  vm.runInNewContext(fs.readFileSync(path.join(base, file), "utf8"), box);
  return box.module.exports;
}
function response() { return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(v) { this.code = v; return this; }, send(v) { this.body = v; return this; }, json(v) { this.body = v; return this; } }; }
const booking = { method: "POST", url: "/api/artyou", body: { action: "prenota", Evento: "shortyou", Nome: "T", Cognome: "S", Email: "t@example.test", Telefono: "1", Posti: 2, Privacy: true, Pagamento: "In cassa", Stato: "PAGATO" } };
const fakeStore = (mode, over) => ({ primaryMode: () => mode, ...over });

test("sheet mode (default): bookings still go to the Google sheet and MySQL is not asked to decide", async () => {
  let forwarded = false;
  const h = load("artyou.js", {
    store: fakeStore("sheet", { createBooking: async () => { throw Error("must not be called"); } }),
    db: { query: async (sql) => sql.startsWith("INSERT") ? { affectedRows: 1 } : [{ id: 1 }] },
    upstream: async () => { forwarded = true; return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, codice: "ART-1", stato: "RISERVATO" }) }; }
  });
  const r = response(); await h(booking, r);
  assert.equal(forwarded, true); assert.equal(r.body.codice, "ART-1");
});

test("mysql mode: MySQL decides, the browser cannot set server fields, the sheet copy is queued", async () => {
  let created, copied;
  const h = load("artyou.js", {
    store: fakeStore("mysql", { createBooking: async (d) => { created = d; return { ok: true, id: "ART-20261010-183105-123", codice: "ART-20261010-183105-123", stato: "RISERVATO", liberi: 8, holdMinutes: 0, posti: 2 }; } }),
    copy: { copyAfterResponse: (d, b) => { copied = [d, b]; return null; } }
  });
  const r = response(); await h(booking, r);
  assert.equal(r.code, 200);
  assert.deepEqual([r.body.ok, r.body.codice, r.body.liberi, r.body.storage, r.body.persistenceConfirmed], [true, "ART-20261010-183105-123", 8, "mysql", true]);
  assert(!("Stato" in created)); assert.equal(created.action, "prenota");
  assert.equal(copied[1].id, "ART-20261010-183105-123");
});

test("mysql mode: sold out answers like the Apps Script so the page shows the seats left", async () => {
  const h = load("artyou.js", { store: fakeStore("mysql", { createBooking: async () => ({ ok: false, errore: "esaurito", liberi: 1 }) }) });
  const r = response(); await h(booking, r);
  assert.deepEqual([r.code, r.body.errore, r.body.liberi], [200, "esaurito", 1]);
});

test("mysql mode: if MySQL is down the booking is refused, never silently sent to the sheet", async () => {
  const h = load("artyou.js", {
    store: fakeStore("mysql", { createBooking: async () => { throw Error("ECONNREFUSED"); } }),
    upstream: async () => { throw Error("sheet must not be used"); }
  });
  const r = response(); await h(booking, r);
  assert.deepEqual([r.code, r.body.errore], [503, "prenotazioni_temporaneamente_non_disponibili"]);
});

test("mysql mode: availability reads come from MySQL in the Apps Script format", async () => {
  const h = load("artyou.js", { store: fakeStore("mysql", { availabilityMap: async () => ({ shortyou: 5, "vortice-0": 2 }), seatsLeft: async (k) => (k === "shortyou" ? 5 : null) }) });
  let r = response(); await h({ method: "GET", url: "/api/artyou?disponibilita=1" }, r);
  assert.deepEqual(JSON.parse(JSON.stringify(r.body)), { ok: true, disponibilita: { shortyou: 5, "vortice-0": 2 } });
  r = response(); await h({ method: "GET", url: "/api/artyou?evento=shortyou" }, r);
  assert.deepEqual(JSON.parse(JSON.stringify(r.body)), { ok: true, evento: "shortyou", liberi: 5 });
  r = response(); await h({ method: "GET", url: "/api/artyou?evento=sconosciuto" }, r);
  assert.equal(r.body.liberi, 0);
});

test("mysql mode: course requests keep going to the sheet", async () => {
  let sent;
  const h = load("artyou.js", {
    store: fakeStore("mysql", { createBooking: async () => { throw Error("must not be called"); } }),
    upstream: async (u, o) => { sent = JSON.parse(o.body); return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, id: "ART-2", stato: "Nuova" }) }; }
  });
  const r = response();
  await h({ method: "POST", url: "/api/artyou", body: { action: "richiesta", Corso: "Impro 1", Nome: "T", Cognome: "S", Email: "t@example.test", "Privacy accettata": "Sì" } }, r);
  assert.equal(r.code, 200); assert.equal(sent.Corso, "Impro 1");
});

test("mysql mode: staff cancel updates MySQL first and reports when the sheet did not follow", async () => {
  const calls = [];
  const h = load("booking-admin.js", {
    store: fakeStore("mysql", { setBookingStatus: async (id, s) => { calls.push([id, s]); return true; } }),
    upstream: async () => { throw Error("sheet down"); }
  });
  const r = response();
  await h({ method: "POST", body: { action: "annulla", id: "ART-20261010-183105-123" } }, r);
  assert.deepEqual(calls, [["ART-20261010-183105-123", "ANNULLATO"]]);
  assert.deepEqual([r.code, r.body.ok, r.body.foglioAggiornato], [200, true, false]);
});
