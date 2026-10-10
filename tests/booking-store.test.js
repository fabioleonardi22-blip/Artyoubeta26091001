// Prenotazioni con MySQL archivio principale (lib/booking-store.js).
// I test sul database girano solo con MYSQL_TEST_URL verso un database di prova
// VUOTO con database/schema.sql caricato: le tabelle vengono svuotate.
//   MYSQL_TEST_URL=<URL MySQL del database di prova, es. 127.0.0.1:3306/artyou_test> npm test
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const TEST_URL = process.env.MYSQL_TEST_URL || "";
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const store = require("../lib/booking-store");
const { query, getPool } = require("../lib/db");

// --- Regole pure, sempre eseguite -----------------------------------------------

test("booking code keeps the Apps Script format, in Rome time", () => {
  const code = store.bookingCode(new Date("2026-10-10T16:31:05Z"), 123);
  assert.equal(code, "ART-20261010-183105-123");
});

test("server amount uses price × seats unless the booking has package choices", () => {
  assert.equal(store.serverAmount("15", 3, {}), "45.00");
  assert.equal(store.serverAmount("12,50", 2, { Importo: "1" }), "25.00");
  assert.equal(store.serverAmount("15", 2, { Scelte: "Pacchetto", Importo: "80" }), "80");
  assert.equal(store.serverAmount(null, 2, { Importo: "30" }), "30");
});

test("online payments place a hold, desk payments reserve", () => {
  assert.equal(store.isOnlinePayment("PayPal"), true);
  assert.equal(store.isOnlinePayment("Carta online"), true);
  assert.equal(store.isOnlinePayment("In cassa"), false);
});

test("the switch defaults to the Google sheet", () => {
  const saved = process.env.ARTYOU_BOOKING_PRIMARY;
  delete process.env.ARTYOU_BOOKING_PRIMARY;
  assert.equal(store.primaryMode(), "sheet");
  process.env.ARTYOU_BOOKING_PRIMARY = "MySQL";
  assert.equal(store.primaryMode(), "mysql");
  process.env.ARTYOU_BOOKING_PRIMARY = "qualcosa";
  assert.equal(store.primaryMode(), "sheet");
  if (saved === undefined) delete process.env.ARTYOU_BOOKING_PRIMARY; else process.env.ARTYOU_BOOKING_PRIMARY = saved;
});

test("indexed keys from multi-date pages are split into slug and date index", () => {
  assert.deepEqual(store.splitIndexedKey("vortice-2"), { slug: "vortice", index: 2 });
  assert.equal(store.splitIndexedKey("vortice"), null);
});

// --- Database reale -----------------------------------------------------------

const db = { skip: TEST_URL ? false : "MYSQL_TEST_URL non impostato" };
const person = (i) => ({ Nome: "Test", Cognome: "N" + i, Email: `t${i}@example.test`, Telefono: "1", Privacy: true, Pagamento: "In cassa" });

async function reset() {
  for (const t of ["payments", "bookings", "event_dates", "events"]) await query(`DELETE FROM ${t}`);
}

async function addEvent(slug, capacity, extra) {
  const r = await query("INSERT INTO events (slug,title,capacity,price,active,metadata) VALUES (?,?,?,?,1,?)",
    [slug, "Titolo " + slug, capacity, (extra && extra.price) ?? 15, JSON.stringify((extra && extra.metadata) || {})]);
  return r.insertId;
}

async function addDate(eventId, startsAt, capacityOverride) {
  const r = await query("INSERT INTO event_dates (event_id,starts_at,date_label,capacity_override,active) VALUES (?,?,?,?,1)",
    [eventId, startsAt, startsAt, capacityOverride ?? null]);
  return r.insertId;
}

before(async () => { if (TEST_URL) await reset(); });
after(async () => { if (TEST_URL) await getPool().end(); });

test("30 simultaneous bookings for 10 seats: exactly 10 succeed, never more", db, async () => {
  await reset();
  await addEvent("shortyou", 10);
  const results = await Promise.all(Array.from({ length: 30 }, (_, i) => store.createBooking({ Evento: "shortyou", Posti: 1, ...person(i) })));
  const ok = results.filter((r) => r.ok);
  assert.equal(ok.length, 10);
  assert(results.filter((r) => !r.ok).every((r) => r.errore === "esaurito" && r.liberi === 0));
  const [{ n }] = await query("SELECT SUM(seats) AS n FROM bookings");
  assert.equal(Number(n), 10);
  assert.equal(new Set(ok.map((r) => r.id)).size, 10);
  assert.equal(await store.seatsLeft("shortyou"), 0);
});

test("multi-seat requests larger than what is left are refused with the seats left", db, async () => {
  await reset();
  await addEvent("yep", 5);
  assert.equal((await store.createBooking({ Evento: "yep", Posti: 4, ...person(1) })).ok, true);
  const r = await store.createBooking({ Evento: "yep", Posti: 2, ...person(2) });
  assert.deepEqual([r.ok, r.errore, r.liberi], [false, "esaurito", 1]);
});

test("each date of a multi-date page has its own seats, counting bookings copied from the sheet", db, async () => {
  await reset();
  const id = await addEvent("vortice", 4);
  const d0 = await addDate(id, "2026-11-01 21:00:00");
  await addDate(id, "2026-11-02 21:00:00", 2);
  // prenotazione storica arrivata dal foglio: nessun event_date_id, solo la chiave
  await query("INSERT INTO bookings (public_id,event_id,seats,status,metadata) VALUES ('ART-OLD-1',?,3,'RISERVATO',?)",
    [id, JSON.stringify({ migration_source: "dual_write", evento_richiesto: "vortice-0" })]);
  assert.equal(await store.seatsLeft("vortice-0"), 1);
  assert.equal(await store.seatsLeft("vortice-1"), 2);
  const r = await store.createBooking({ Evento: "vortice-1", Posti: 2, ...person(1) });
  assert.equal(r.ok, true);
  const [row] = await query("SELECT event_date_id FROM bookings WHERE public_id=?", [r.id]);
  assert.notEqual(Number(row.event_date_id), d0);
  assert.equal((await store.createBooking({ Evento: "vortice-1", Posti: 1, ...person(2) })).errore, "esaurito");
  assert.equal((await store.createBooking({ Evento: "vortice-0", Posti: 1, ...person(3) })).ok, true);
  const map = await store.availabilityMap();
  assert.equal(map["vortice-0"], 0);
  assert.equal(map["vortice-1"], 0);
  assert.equal((await store.createBooking({ Evento: "vortice-7", Posti: 1, ...person(4) })).errore, "evento_non_trovato");
});

test("legacy sheet keys resolve to the event and are listed in availability", db, async () => {
  await reset();
  await addEvent("rome-improv-festival", 3, { metadata: { legacyKey: "RIF2027" } });
  assert.equal((await store.createBooking({ Evento: "RIF2027", Posti: 1, ...person(1) })).ok, true);
  const map = await store.availabilityMap();
  assert.equal(map["rome-improv-festival"], 2);
  assert.equal(map.RIF2027, 2);
});

test("expired holds free their seats; cancelling frees seats; paid cannot be re-confirmed after cancel", db, async () => {
  await reset();
  const id = await addEvent("standup", 2);
  await query("INSERT INTO bookings (public_id,event_id,seats,status,hold_expires_at) VALUES ('ART-HOLD',?,2,'HOLD',UTC_TIMESTAMP() - INTERVAL 1 MINUTE)", [id]);
  const a = await store.createBooking({ Evento: "standup", Posti: 2, ...person(1) });
  assert.equal(a.ok, true);
  const [old] = await query("SELECT status FROM bookings WHERE public_id='ART-HOLD'");
  assert.equal(old.status, "SCADUTO");
  assert.equal(await store.seatsLeft("standup"), 0);
  assert.equal(await store.setBookingStatus(a.id, "ANNULLATO"), true);
  assert.equal(await store.seatsLeft("standup"), 2);
  await assert.rejects(store.setBookingStatus(a.id, "PAGATO"), /prenotazione_non_confermabile/);
  assert.equal(await store.setBookingStatus("ART-NON-ESISTE", "ANNULLATO"), false);
});

test("online payment holds seats for 15 minutes and the amount is computed by the server", db, async () => {
  await reset();
  await addEvent("workshow", 10, { price: 20 });
  const r = await store.createBooking({ Evento: "workshow", Posti: 2, ...person(1), Pagamento: "Carta online", Importo: "0.01" });
  assert.deepEqual([r.stato, r.holdMinutes, r.importo], ["HOLD", 15, "40.00"]);
  const [row] = await query("SELECT TIMESTAMPDIFF(MINUTE,UTC_TIMESTAMP(),hold_expires_at) AS m, JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.sheet_sync')) AS s FROM bookings WHERE public_id=?", [r.id]);
  assert(Number(row.m) >= 14 && Number(row.m) <= 15);
  assert.equal(row.s, "pending");
  await store.markSheetSync(r.id, true);
  const [row2] = await query("SELECT JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.sheet_sync')) AS s FROM bookings WHERE public_id=?", [r.id]);
  assert.equal(row2.s, "ok");
});
