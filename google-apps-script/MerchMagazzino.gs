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
  STATI: ["Riservato", "In attesa PayPal", "Pagato", "Pronto", "Ritirato", "Annullato"],
  PAYPAL_EMAIL: "info@artyouroma.it",   // conto PayPal che riceve i pagamenti (come per le prenotazioni)
  PAGAMENTI: ["In sede", "PayPal"]
};

const MAG_HEADERS = ["ProdottoID", "Prodotto", "Colore", "Taglia", "Disponibili", "Prezzo", "Attivo"];
const ORD_HEADERS = ["ID", "Data", "Stato", "Nome", "Telefono", "Sede", "Articoli", "Pezzi", "Totale",
                     "Note", "Pezzi restituiti", "Dettaglio (non modificare)", "Email", "Pagamento"];

/* Catalogo iniziale: usato SOLO da setup() per riempire il Magazzino la
   prima volta. Gli ID devono coincidere con quelli di js/merch.js. */
const CATALOGO_INIZIALE = [
  { id: "tee-trust-the-play", nome: "T-shirt Trust the Play",  prezzo: 14, colori: ["Nero", "Bordeaux"], taglie: ["S", "M", "L", "XL"] },
  { id: "tee-learn-to-play", nome: "T-shirt Learn to Play",    prezzo: 14, colori: ["Verde petrolio"], taglie: ["S", "M", "L", "XL"] },
  { id: "tee-inspire-the-other", nome: "T-shirt Inspire the Other", prezzo: 14, colori: ["Blu notte"], taglie: ["S", "M", "L", "XL"] },
  { id: "tee-yep-2024",    nome: "T-shirt YEP 2024",           prezzo: 14, colori: ["Rosso", "Azzurro"], taglie: ["S", "M", "L", "XL"] },
  { id: "tee-act-believe", nome: "T-shirt Act Believe Improv", prezzo: 14, colori: ["Verde", "Blu notte"], taglie: ["S", "M", "L", "XL"] },
  { id: "tee-standup999",  nome: "T-shirt Standup999",         prezzo: 14, colori: ["Viola"], taglie: ["S", "M", "L", "XL"] },
  { id: "tee-wordcloud",   nome: "T-shirt Improv Wordcloud",   prezzo: 14, colori: ["Verde"], taglie: ["S", "M", "L", "XL"] },
  { id: "tee-actor",       nome: "T-shirt I'm an Actor",       prezzo: 14, colori: ["Nero"], taglie: ["S", "M", "L", "XL"] },
  { id: "tee-memory",      nome: "T-shirt Improvviso",         prezzo: 14, colori: ["Blu", "Blu notte"], taglie: ["S", "M", "L", "XL"] },
  { id: "tee-arte",        nome: "T-shirt Io sono Arte",       prezzo: 14, colori: ["Nero"], taglie: ["S", "M", "L", "XL"] },
  { id: "tee-its-all-theater", nome: "T-shirt It's All Theater", prezzo: 14, colori: ["Blu notte", "Nero", "Bianco"], taglie: ["S", "M", "L", "XL"] },
  { id: "tee-im-theatre",  nome: "T-shirt I'm Theatre",        prezzo: 14, colori: ["Nero"], taglie: ["S", "M", "L", "XL"] },
  { id: "hoodie-thinkbig", nome: "Felpa Think Big",            prezzo: 30, colori: ["Cyan", "Nero", "Verde", "Bordeaux"], taglie: ["S", "M", "L", "XL"] },
  { id: "hoodie-ithink",   nome: "Felpa I Think",              prezzo: 30, colori: ["Nero", "Grigio antracite", "Verde"], taglie: ["S", "M", "L", "XL"] },
  { id: "hoodie-ithink-variant", nome: "Felpa I Think - Variant Ed.", prezzo: 30, colori: ["Bianco", "Bordeaux"], taglie: ["S", "M", "L", "XL"] },
  { id: "jogger",          nome: "Pantaloni Jogger",           prezzo: 20, colori: ["Nero", "Grigio"], taglie: ["S", "M", "L", "XL"] },
  { id: "socks",           nome: "Calzini Grip",               prezzo: 5,  colori: ["Nero", "Arancio"], taglie: ["35-38", "39-42", "43-46"] }
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

  if (String(data.action || "") !== "ordine") return json_({ ok: false, errore: "azione_sconosciuta" });

  // --- Validazione campi ---
  const nome = clean_(data.nome, 80), tel = clean_(data.telefono, 30);
  const sede = clean_(data.sede, 40), note = clean_(data.note, 400);
  if (!nome || !tel || !sede) return json_({ ok: false, errore: "campi_mancanti" });
  if (tel.replace(/\D/g, "").length < 8) return json_({ ok: false, errore: "telefono_non_valido" });
  if (MERCH.SEDI.indexOf(sede) < 0) return json_({ ok: false, errore: "sede_non_valida" });
  const email = clean_(data.email, 120).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json_({ ok: false, errore: "email_non_valida" });
  const pagamento = MERCH.PAGAMENTI.indexOf(String(data.pagamento || "")) >= 0 ? String(data.pagamento) : "In sede";
  if (pagamento === "PayPal" && !email) return json_({ ok: false, errore: "email_mancante" });

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
    aggiornaFoglioOrdini_(ord);
    const id = nuovoId_(ord);
    const stato = pagamento === "PayPal" ? "In attesa PayPal" : "Riservato";
    ord.appendRow([id, new Date(), stato, nome, "'" + tel, sede, righe.join("\n"), totPezzi,
                   totale, note, "", JSON.stringify(dettaglio), email, pagamento]);
    ord.getRange(ord.getLastRow(), 9).setNumberFormat("€ #,##0.00");
    SpreadsheetApp.flush();

    lock.releaseLock();
    const paypal = pagamento === "PayPal" ? paypalUrl_(id, totale) : "";
    const o = { id: id, nome: nome, tel: tel, email: email, sede: sede, note: note, righe: righe, totale: totale,
                scorte: scorte, pagamento: pagamento, paypal: paypal };
    avvisaAdmin_(o);
    confermaCliente_(o);
    return json_({ ok: true, id: id, totale: totale, righe: righe, pagamento: pagamento, paypal: paypal });
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
      "<p style='font-family:sans-serif'><b>" + esc(o.nome) + "</b> · " + esc(o.tel) + (o.email ? " · " + esc(o.email) : "") + "<br>Ritiro: sede " + esc(o.sede) + "</p>" +
      "<ul style='font-family:sans-serif'>" + o.righe.map(r => "<li>" + esc(r) + "</li>").join("") + "</ul>" +
      "<p style='font-family:sans-serif'><b>Totale: " + euro(o.totale) + "</b> · " +
        (o.pagamento === "PayPal" ? "pagamento con <b>PayPal</b>: verifica l'incasso su PayPal e poi metti lo stato su Pagato" : "pagamento al ritiro in sede") + "</p>" +
      (o.note ? "<p style='font-family:sans-serif'>Note: " + esc(o.note) + "</p>" : "") +
      (o.scorte.length ? "<p style='font-family:sans-serif;color:#A3242F'><b>Scorte basse:</b><br>" + o.scorte.map(esc).join("<br>") + "</p>" : "") +
      "<p style='font-family:sans-serif'><a href='" + SpreadsheetApp.getActiveSpreadsheet().getUrl() + "'>Apri il foglio ordini</a></p>";
    const opts = { htmlBody: html, name: "Artyou Merch" };
    if (MERCH.EMAIL_BACKUP) opts.cc = MERCH.EMAIL_BACKUP;
    if (o.email) opts.replyTo = o.email;
    MailApp.sendEmail(MERCH.EMAIL_ADMIN, "Ordine merch " + o.id + " – " + o.nome + " (" + o.sede + ", " + o.pagamento + ")",
      "Nuovo ordine " + o.id + "\n" + o.righe.join("\n") + "\nTotale: " + euro(o.totale), opts);
  } catch (err) {
    console.error("Email non inviata: " + err);
  }
}

/* Email di conferma al cliente (solo se ha lasciato l'indirizzo) */
function confermaCliente_(o) {
  if (!o.email) return;
  try {
    const euro = n => "€ " + Number(n).toFixed(2).replace(".", ",");
    const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const f = "font-family:Helvetica,Arial,sans-serif;color:#13181D";
    const pay = o.pagamento === "PayPal"
      ? "<p style='" + f + "'>Hai scelto di pagare con <b>PayPal</b>. Se non hai completato il pagamento puoi farlo da qui: " +
        "<a href='" + o.paypal + "' style='color:#C97800;font-weight:bold'>paga " + euro(o.totale) + " con PayPal</a>. " +
        "L'ordine viene preparato quando riceviamo il pagamento.</p>"
      : "<p style='" + f + "'>Paghi direttamente al ritiro in sede.</p>";
    const html =
      "<div style='max-width:560px'>" +
      "<h2 style='" + f + "'>Grazie " + esc(o.nome.split(" ")[0]) + ", abbiamo ricevuto il tuo ordine!</h2>" +
      "<p style='" + f + "'>Numero d'ordine: <b>" + o.id + "</b></p>" +
      "<ul style='" + f + "'>" + o.righe.map(r => "<li>" + esc(r) + "</li>").join("") + "</ul>" +
      "<p style='" + f + "'><b>Totale: " + euro(o.totale) + "</b><br>Ritiro: sede <b>" + esc(o.sede) + "</b></p>" + pay +
      "<p style='" + f + "'>Ti avvisiamo quando è pronto. Per qualsiasi domanda rispondi a questa email o scrivici su WhatsApp al +39 327 188 1956.</p>" +
      "<p style='" + f + "'>A presto,<br>Artyou Roma</p></div>";
    MailApp.sendEmail(o.email, "Il tuo ordine Artyou " + o.id,
      "Grazie! Ordine " + o.id + "\n" + o.righe.join("\n") + "\nTotale: " + euro(o.totale) + "\nRitiro: sede " + o.sede +
      (o.pagamento === "PayPal" ? "\nPaga con PayPal: " + o.paypal : "\nPaghi al ritiro."),
      { htmlBody: html, name: "Artyou Roma", replyTo: MERCH.EMAIL_ADMIN });
  } catch (err) {
    console.error("Conferma cliente non inviata: " + err);
  }
}

function paypalUrl_(id, totale) {
  return "https://www.paypal.com/cgi-bin/webscr?cmd=_xclick" +
    "&business=" + encodeURIComponent(MERCH.PAYPAL_EMAIL) +
    "&item_name=" + encodeURIComponent("Artyou Merch " + id) +
    "&invoice=" + encodeURIComponent(id) +
    "&amount=" + encodeURIComponent(Number(totale).toFixed(2)) +
    "&currency_code=EUR";
}

/* Aggiunge le colonne Email e Pagamento e i nuovi stati ai fogli creati prima di questa versione */
function aggiornaFoglioOrdini_(ord) {
  const h = ord.getRange(1, 1, 1, ORD_HEADERS.length).getValues()[0];
  if (h[12] === ORD_HEADERS[12] && h[13] === ORD_HEADERS[13]) return;
  ord.getRange(1, 1, 1, ORD_HEADERS.length).setValues([ORD_HEADERS]);
  styleHeader_(ord, ORD_HEADERS.length);
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(MERCH.STATI, true).build();
  ord.getRange(2, 3, ord.getMaxRows() - 1, 1).setDataValidation(rule);
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
