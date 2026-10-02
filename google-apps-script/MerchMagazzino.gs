/**
 * ARTYOU – Magazzino e ordini del merchandising
 * ------------------------------------------------------------
 * Va incollato in un Google Sheet DEDICATO (non in quello delle
 * prenotazioni spettacoli). Istruzioni complete: README-MERCH.md
 *
 * Fogli creati da setup():
 *  - Magazzino : una riga per variante (prodotto + colore + taglia).
 *                Qui si modificano QUANTITÀ, PREZZO e ATTIVO.
 *  - Ordini    : un ordine per riga, con stato modificabile dal menu
 *                a tendina: Riservato → Pronto → Ritirato / Annullato.
 *                Mettendo "Annullato" i pezzi tornano in magazzino.
 */

const MERCH = {
  SHEET_MAGAZZINO: "Magazzino",
  SHEET_ORDINI: "Ordini",
  EMAIL_ADMIN: "info@artyouroma.it",
  EMAIL_BACKUP: "artyouroma@gmail.com",
  SOGLIA_AVVISO: 2,          // nell'email segnala le varianti rimaste con ≤ 2 pezzi
  MAX_PEZZI_RIGA: 10,
  MAX_PEZZI_ORDINE: 20,
  SEDI: ["San Giovanni", "Eroi", "Ionio", "Valle Aurelia", "Africano", "Boccea"],
  STATI: ["Riservato", "Pronto", "Ritirato", "Annullato"]
};

const MAG_HEADERS = ["ProdottoID", "Prodotto", "Colore", "Taglia", "Disponibili", "Prezzo", "Attivo"];
const ORD_HEADERS = ["ID", "Data", "Stato", "Nome", "Telefono", "Sede", "Articoli", "Pezzi", "Totale",
                     "Note", "Pezzi restituiti", "Dettaglio (non modificare)"];

/* Catalogo iniziale: usato SOLO da setup() per riempire il Magazzino la
   prima volta. Gli ID devono coincidere con quelli di merchandising.html. */
const CATALOGO_INIZIALE = [
  { id: "tee-wordcloud",  nome: "T-shirt Improv Wordcloud", prezzo: 14, colori: ["Verde", "Nero"], taglie: ["S", "M", "L", "XL"] },
  { id: "tee-actor",      nome: "T-shirt I'm an Actor",     prezzo: 14, colori: ["Nero"],          taglie: ["S", "M", "L", "XL"] },
  { id: "tee-memory",     nome: "T-shirt Improvviso",       prezzo: 14, colori: ["Blu", "Nero"],   taglie: ["S", "M", "L", "XL"] },
  { id: "tee-arte",       nome: "T-shirt Io sono Arte",     prezzo: 14, colori: ["Nero"],          taglie: ["S", "M", "L", "XL"] },
  { id: "hoodie-thinkbig",nome: "Felpa Think Big",          prezzo: 30, colori: ["Cyan", "Nero", "Verde", "Bordeaux"], taglie: ["S", "M", "L", "XL"] },
  { id: "jogger",         nome: "Pantaloni Jogger",         prezzo: 20, colori: ["Nero", "Grigio"], taglie: ["S", "M", "L", "XL"] },
  { id: "socks",          nome: "Calzini Grip",             prezzo: 5,  colori: ["Nero", "Arancio"], taglie: ["35-38", "39-42", "43-46"] }
];

/* ============================================================
   SETUP – da eseguire una volta dall'editor (▶ setup)
   ============================================================ */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Magazzino
  let mag = ss.getSheetByName(MERCH.SHEET_MAGAZZINO);
  if (!mag) mag = ss.insertSheet(MERCH.SHEET_MAGAZZINO);
  if (mag.getLastRow() === 0) {
    const rows = [MAG_HEADERS];
    CATALOGO_INIZIALE.forEach(p => p.colori.forEach(c => p.taglie.forEach(t =>
      rows.push([p.id, p.nome, c, t, 0, p.prezzo, true]))));
    mag.getRange(1, 1, rows.length, MAG_HEADERS.length).setValues(rows);
    mag.getRange(2, 7, rows.length - 1, 1).insertCheckboxes();
    mag.getRange(2, 6, rows.length - 1, 1).setNumberFormat("€ #,##0.00");
  }
  styleHeader_(mag, MAG_HEADERS.length);
  mag.setColumnWidth(1, 130); mag.setColumnWidth(2, 210);

  // Ordini
  let ord = ss.getSheetByName(MERCH.SHEET_ORDINI);
  if (!ord) ord = ss.insertSheet(MERCH.SHEET_ORDINI);
  if (ord.getLastRow() === 0) ord.getRange(1, 1, 1, ORD_HEADERS.length).setValues([ORD_HEADERS]);
  styleHeader_(ord, ORD_HEADERS.length);
  ord.setColumnWidth(7, 380);
  ord.hideColumns(12);
  const statoRule = SpreadsheetApp.newDataValidation().requireValueInList(MERCH.STATI, true).build();
  ord.getRange(2, 3, ord.getMaxRows() - 1, 1).setDataValidation(statoRule);

  // Trigger: quando un ordine passa ad "Annullato" i pezzi tornano in magazzino
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "onOrdineModificato")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("onOrdineModificato").forSpreadsheet(ss).onEdit().create();

  const def = ss.getSheetByName("Foglio1") || ss.getSheetByName("Sheet1");
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(def);
}

function styleHeader_(sh, n) {
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, n).setFontWeight("bold").setBackground("#13181D").setFontColor("#F6F3EC");
}

/* ============================================================
   GET – disponibilità per il sito
   /exec?stock=1  →  { ok, varianti: { "id|colore|taglia": { qty, prezzo } } }
   ============================================================ */
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.stock === "1") return json_({ ok: true, varianti: leggiVarianti_(true) });
    return json_({ ok: true, message: "Artyou merch endpoint attivo" });
  } catch (err) {
    return json_({ ok: false, errore: String(err && err.message || err) });
  }
}

/* ============================================================
   POST – nuovo ordine
   body JSON: { action:"ordine", nome, telefono, sede, note,
                items:[{ id, colore, taglia, qty }], _hp }
   ============================================================ */
function doPost(e) {
  let data;
  try { data = JSON.parse((e && e.postData && e.postData.contents) || "{}"); }
  catch (err) { return json_({ ok: false, errore: "richiesta_non_valida" }); }

  if (data._hp) return json_({ ok: true, id: "OK" });                 // bot: risposta finta
  if (String(data.action || "") !== "ordine") return json_({ ok: false, errore: "azione_sconosciuta" });

  // --- Validazione campi ---
  const nome = clean_(data.nome, 80), tel = clean_(data.telefono, 30);
  const sede = clean_(data.sede, 40), note = clean_(data.note, 400);
  if (!nome || !tel || !sede) return json_({ ok: false, errore: "campi_mancanti" });
  if (tel.replace(/\D/g, "").length < 8) return json_({ ok: false, errore: "telefono_non_valido" });
  if (MERCH.SEDI.indexOf(sede) < 0) return json_({ ok: false, errore: "sede_non_valida" });

  // unisce eventuali righe uguali
  const richiesti = {};
  (Array.isArray(data.items) ? data.items : []).forEach(it => {
    const k = key_(it.id, it.colore, it.taglia);
    const q = Math.floor(Number(it.qty));
    if (!(q > 0)) return;
    richiesti[k] = (richiesti[k] || 0) + q;
  });
  const chiavi = Object.keys(richiesti);
  if (!chiavi.length) return json_({ ok: false, errore: "carrello_vuoto" });
  const totPezzi = chiavi.reduce((n, k) => n + richiesti[k], 0);
  if (totPezzi > MERCH.MAX_PEZZI_ORDINE || chiavi.some(k => richiesti[k] > MERCH.MAX_PEZZI_RIGA))
    return json_({ ok: false, errore: "quantita_eccessiva" });

  // --- Sezione critica: controllo e scalo del magazzino ---
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_({ ok: false, errore: "server_occupato" });
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const mag = ss.getSheetByName(MERCH.SHEET_MAGAZZINO);
    const values = mag.getDataRange().getValues();
    const idx = {};
    for (let r = 1; r < values.length; r++) idx[key_(values[r][0], values[r][2], values[r][3])] = r;

    const mancanti = [];
    chiavi.forEach(k => {
      const r = idx[k];
      const disp = r === undefined || values[r][6] !== true ? 0 : Math.max(0, Number(values[r][4]) || 0);
      if (disp < richiesti[k]) mancanti.push({ variante: k, disponibili: disp, richiesti: richiesti[k] });
    });
    if (mancanti.length)
      return json_({ ok: false, errore: "non_disponibile", mancanti: mancanti, varianti: leggiVarianti_(true, values) });

    // scala le quantità e calcola il totale con i prezzi del foglio
    let totale = 0;
    const righe = [], dettaglio = [], scorte = [];
    chiavi.forEach(k => {
      const r = idx[k], q = richiesti[k];
      const nuovo = Number(values[r][4]) - q;
      mag.getRange(r + 1, 5).setValue(nuovo);
      const prezzo = Number(values[r][5]) || 0;
      totale += prezzo * q;
      righe.push(q + "× " + values[r][1] + " – " + values[r][2] + ", " + values[r][3]);
      dettaglio.push({ k: k, q: q });
      if (nuovo <= MERCH.SOGLIA_AVVISO) scorte.push(values[r][1] + " " + values[r][2] + " " + values[r][3] + ": " + nuovo);
    });

    const ord = ss.getSheetByName(MERCH.SHEET_ORDINI);
    const id = nuovoId_(ord);
    ord.appendRow([id, new Date(), "Riservato", nome, "'" + tel, sede, righe.join("\n"), totPezzi,
                   totale, note, "", JSON.stringify(dettaglio)]);
    ord.getRange(ord.getLastRow(), 9).setNumberFormat("€ #,##0.00");
    SpreadsheetApp.flush();

    lock.releaseLock();
    avvisaAdmin_({ id: id, nome: nome, tel: tel, sede: sede, note: note, righe: righe, totale: totale, scorte: scorte });
    return json_({ ok: true, id: id, totale: totale, righe: righe });
  } catch (err) {
    return json_({ ok: false, errore: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/* ============================================================
   Trigger: stato ordine → "Annullato" restituisce i pezzi
   ============================================================ */
function onOrdineModificato(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== MERCH.SHEET_ORDINI || e.range.getColumn() !== 3 || e.range.getRow() < 2) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    for (let i = 0; i < e.range.getNumRows(); i++) {
      const row = e.range.getRow() + i;
      const vals = sh.getRange(row, 1, 1, ORD_HEADERS.length).getValues()[0];
      if (vals[2] !== "Annullato" || vals[10] === "Sì") continue;
      let det = [];
      try { det = JSON.parse(vals[11] || "[]"); } catch (err) {}
      restituisci_(det);
      sh.getRange(row, 11).setValue("Sì");
    }
  } finally {
    lock.releaseLock();
  }
}

function restituisci_(dettaglio) {
  const mag = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MERCH.SHEET_MAGAZZINO);
  const values = mag.getDataRange().getValues();
  dettaglio.forEach(d => {
    for (let r = 1; r < values.length; r++) {
      if (key_(values[r][0], values[r][2], values[r][3]) === d.k) {
        mag.getRange(r + 1, 5).setValue((Number(values[r][4]) || 0) + d.q);
        values[r][4] = (Number(values[r][4]) || 0) + d.q;
        break;
      }
    }
  });
}

/* ============================================================
   Utilità
   ============================================================ */
function leggiVarianti_(soloAttive, valuesOpt) {
  const values = valuesOpt ||
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MERCH.SHEET_MAGAZZINO).getDataRange().getValues();
  const out = {};
  for (let r = 1; r < values.length; r++) {
    const v = values[r];
    if (!v[0]) continue;
    const attivo = v[6] === true;
    if (soloAttive && !attivo) continue;
    out[key_(v[0], v[2], v[3])] = { qty: Math.max(0, Number(v[4]) || 0), prezzo: Number(v[5]) || 0 };
  }
  return out;
}

function avvisaAdmin_(o) {
  try {
    const euro = n => "€ " + Number(n).toFixed(2).replace(".", ",");
    const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const html =
      "<h2 style='font-family:sans-serif'>Nuovo ordine merchandising " + o.id + "</h2>" +
      "<p style='font-family:sans-serif'><b>" + esc(o.nome) + "</b> · " + esc(o.tel) + "<br>Ritiro: sede " + esc(o.sede) + "</p>" +
      "<ul style='font-family:sans-serif'>" + o.righe.map(r => "<li>" + esc(r) + "</li>").join("") + "</ul>" +
      "<p style='font-family:sans-serif'><b>Totale: " + euro(o.totale) + "</b> (pagamento al ritiro)</p>" +
      (o.note ? "<p style='font-family:sans-serif'>Note: " + esc(o.note) + "</p>" : "") +
      (o.scorte.length ? "<p style='font-family:sans-serif;color:#A3242F'><b>Scorte basse:</b><br>" + o.scorte.map(esc).join("<br>") + "</p>" : "") +
      "<p style='font-family:sans-serif'><a href='" + SpreadsheetApp.getActiveSpreadsheet().getUrl() + "'>Apri il foglio ordini</a></p>";
    const opts = { htmlBody: html, name: "Artyou Merch" };
    if (MERCH.EMAIL_BACKUP) opts.cc = MERCH.EMAIL_BACKUP;
    MailApp.sendEmail(MERCH.EMAIL_ADMIN, "Ordine merch " + o.id + " – " + o.nome + " (" + o.sede + ")",
      "Nuovo ordine " + o.id + "\n" + o.righe.join("\n") + "\nTotale: " + euro(o.totale), opts);
  } catch (err) {
    console.error("Email non inviata: " + err);
  }
}

function nuovoId_(ord) {
  const last = ord.getLastRow();
  let n = 0;
  if (last > 1) {
    const m = String(ord.getRange(last, 1).getValue()).match(/(\d+)$/);
    n = m ? Number(m[1]) : last - 1;
  }
  return "MERCH-" + String(n + 1).padStart(4, "0");
}

function key_(id, colore, taglia) {
  return [id, colore, taglia].map(x => String(x == null ? "" : x).trim()).join("|");
}
function clean_(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u001F]+/g, " ").trim().slice(0, max); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }