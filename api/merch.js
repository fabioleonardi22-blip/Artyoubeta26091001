const { query, transaction } = require("../lib/db");
const crypto = require("crypto");

const SEDI = new Set(["San Giovanni", "Eroi", "Ionio", "Valle Aurelia", "Africano", "Boccea"]);
const PAGAMENTI = new Set(["In sede", "PayPal"]);
const MAX_PEZZI_RIGA = 10;
const MAX_PEZZI_ORDINE = 20;
const PAYPAL_EMAIL = "info@artyouroma.it";

function clean(value, max) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001F]+/g, " ")
    .trim()
    .slice(0, max);
}

function keyOf(id, colore, taglia) {
  return [id, colore, taglia].map(v => String(v == null ? "" : v).trim()).join("|");
}

function paypalUrl(id, totale) {
  const p = new URLSearchParams({
    cmd: "_xclick",
    business: PAYPAL_EMAIL,
    item_name: "Artyou Merch " + id,
    invoice: id,
    amount: Number(totale).toFixed(2),
    currency_code: "EUR"
  });
  return "https://www.paypal.com/cgi-bin/webscr?" + p.toString();
}

function orderCode() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  const stamp = d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
    "-" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds());
  return "MERCH-" + stamp + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

async function stockPayload(conn) {
  const sql = `
    SELECT p.product_code, pv.color, pv.size, pv.stock_qty, pv.price
    FROM products p
    JOIN product_variants pv ON pv.product_id = p.id
    WHERE p.active = 1 AND pv.active = 1
    ORDER BY p.product_code, pv.color, pv.size
  `;
  const [rows] = conn
    ? await conn.execute(sql)
    : [await query(sql)];

  const varianti = {};
  for (const r of rows) {
    varianti[keyOf(r.product_code, r.color, r.size)] = {
      qty: Math.max(0, Number(r.stock_qty) || 0),
      prezzo: Number(r.price) || 0
    };
  }
  return varianti;
}

async function handleGet(req, res) {
  const raw = String(req.url || "");
  const url = new URL(raw, "https://artyou.local");
  if (url.searchParams.get("stock") === "1") {
    return res.status(200).json({ ok: true, varianti: await stockPayload() });
  }
  return res.status(200).json({ ok: true, message: "Artyou merch MySQL endpoint attivo" });
}

async function handlePost(req, res) {
  let data = req.body;
  if (typeof data === "string") {
    if (data.length > 20000) return res.status(413).json({ ok: false, errore: "richiesta_troppo_grande" });
    try { data = JSON.parse(data || "{}"); }
    catch (_) { return res.status(400).json({ ok: false, errore: "richiesta_non_valida" }); }
  }
  if (!data || typeof data !== "object") data = {};

  if (String(data._hp || "").trim()) return res.status(200).json({ ok: true });
  if (String(data.action || "") !== "ordine") {
    return res.status(400).json({ ok: false, errore: "azione_sconosciuta" });
  }

  const nome = clean(data.nome, 80);
  const telefono = clean(data.telefono, 30);
  const email = clean(data.email, 120).toLowerCase();
  const sede = clean(data.sede, 40);
  const note = clean(data.note, 400);
  const pagamento = PAGAMENTI.has(String(data.pagamento || "")) ? String(data.pagamento) : "In sede";

  if (!nome || !telefono || !email || !sede) {
    return res.status(400).json({ ok: false, errore: "campi_mancanti" });
  }
  if (telefono.replace(/\D/g, "").length < 8) {
    return res.status(400).json({ ok: false, errore: "telefono_non_valido" });
  }
  if (!/^([^\s@]+)@([^\s@]+)\.([^\s@]{2,})$/.test(email)) {
    return res.status(400).json({ ok: false, errore: "email_non_valida" });
  }
  if (!SEDI.has(sede)) {
    return res.status(400).json({ ok: false, errore: "sede_non_valida" });
  }

  const richiesti = new Map();
  for (const it of Array.isArray(data.items) ? data.items : []) {
    const id = clean(it && it.id, 190);
    const colore = clean(it && it.colore, 120);
    const taglia = clean(it && it.taglia, 120);
    const qty = Math.floor(Number(it && it.qty));
    if (!id || !colore || !taglia || !(qty > 0)) continue;
    const k = keyOf(id, colore, taglia);
    const cur = richiesti.get(k) || { id, colore, taglia, qty: 0 };
    cur.qty += qty;
    richiesti.set(k, cur);
  }

  const items = Array.from(richiesti.values());
  if (!items.length) return res.status(400).json({ ok: false, errore: "carrello_vuoto" });

  const totPezzi = items.reduce((n, it) => n + it.qty, 0);
  if (totPezzi > MAX_PEZZI_ORDINE || items.some(it => it.qty > MAX_PEZZI_RIGA)) {
    return res.status(400).json({ ok: false, errore: "quantita_eccessiva" });
  }

  try {
    const result = await transaction(async conn => {
      const locked = [];
      const mancanti = [];

      for (const it of items) {
        const [rows] = await conn.execute(
          `SELECT pv.id, pv.stock_qty, pv.price, p.name
             FROM products p
             JOIN product_variants pv ON pv.product_id = p.id
            WHERE p.product_code = ? AND pv.color = ? AND pv.size = ?
              AND p.active = 1 AND pv.active = 1
            FOR UPDATE`,
          [it.id, it.colore, it.taglia]
        );

        if (!rows.length || Number(rows[0].stock_qty) < it.qty) {
          mancanti.push({
            variante: keyOf(it.id, it.colore, it.taglia),
            disponibili: rows.length ? Math.max(0, Number(rows[0].stock_qty) || 0) : 0,
            richiesti: it.qty
          });
          continue;
        }
        locked.push({ ...it, variant: rows[0] });
      }

      if (mancanti.length) {
        const err = new Error("non_disponibile");
        err.code = "NON_DISPONIBILE";
        err.mancanti = mancanti;
        throw err;
      }

      let totale = 0;
      const righe = [];
      for (const it of locked) {
        const prezzo = Number(it.variant.price) || 0;
        totale += prezzo * it.qty;
        righe.push(it.qty + "× " + it.variant.name + " – " + it.colore + ", " + it.taglia);
      }

      let id;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = orderCode();
        const [dupe] = await conn.execute(
          "SELECT id FROM merch_orders WHERE order_code = ? OR order_number = ? LIMIT 1",
          [candidate, candidate]
        );
        if (!dupe.length) { id = candidate; break; }
      }
      if (!id) throw new Error("id_ordine_non_disponibile");

      const stato = pagamento === "PayPal" ? "In attesa PayPal" : "Riservato";
      const metadata = JSON.stringify({ source: "web", migrated_backend: "mysql" });

      const [insert] = await conn.execute(
        `INSERT INTO merch_orders
          (order_number, customer_id, total_amount, status, order_code, ordered_at,
           customer_name, phone, email, venue, pieces, total, notes, returned_pieces,
           payment_method, metadata)
         VALUES (?, NULL, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [id, totale, stato, id, nome, telefono, email, sede, totPezzi, totale, note || null, pagamento, metadata]
      );
      const orderId = insert.insertId;

      for (const it of locked) {
        const prezzo = Number(it.variant.price) || 0;
        await conn.execute(
          `INSERT INTO merch_order_items
            (order_id, variant_id, product_variant_id, item_key, description, quantity, unit_price)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            it.variant.id,
            it.variant.id,
            keyOf(it.id, it.colore, it.taglia),
            it.qty + "× " + it.variant.name + " – " + it.colore + ", " + it.taglia,
            it.qty,
            prezzo
          ]
        );

        await conn.execute(
          "UPDATE product_variants SET stock_qty = stock_qty - ? WHERE id = ?",
          [it.qty, it.variant.id]
        );

        await conn.execute(
          `INSERT INTO inventory_movements
             (product_variant_id, order_id, movement_type, quantity_delta, note)
           VALUES (?, ?, 'RESERVE', ?, ?)`,
          [it.variant.id, orderId, -it.qty, "Ordine web " + id]
        );
      }

      return {
        ok: true,
        id,
        totale: Number(totale.toFixed(2)),
        righe,
        pagamento,
        paypal: pagamento === "PayPal" ? paypalUrl(id, totale) : ""
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err && err.code === "NON_DISPONIBILE") {
      let varianti = {};
      try { varianti = await stockPayload(); } catch (_) {}
      return res.status(409).json({
        ok: false,
        errore: "non_disponibile",
        mancanti: err.mancanti || [],
        varianti
      });
    }
    console.error("merch mysql error", err && err.code ? err.code : "ERR");
    return res.status(500).json({ ok: false, errore: "server_error" });
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const method = String(req.method || "GET").toUpperCase();
    if (method === "GET") return await handleGet(req, res);
    if (method === "POST") return await handlePost(req, res);
    return res.status(405).json({ ok: false, errore: "metodo_non_consentito" });
  } catch (err) {
    console.error("merch endpoint error", err && err.code ? err.code : "ERR");
    return res.status(500).json({ ok: false, errore: "server_error" });
  }
};
