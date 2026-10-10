// ATTENZIONE: copia storica, NON coincide con lo script in produzione.
// Non incollarla nell'editor Apps Script: cancellerebbe scanner, piano operativo,
// gestionale e scheda Capienza. L'azione "registra" per lo script reale è in
// google-apps-script/RegistraMysql.gs.

const CFG = {
  SHEET_PRENOTAZIONI: "Prenotazioni",
  SHEET_EVENTI: "Eventi",
  EMAIL_ADMIN: "prenotazioni@artyouroma.it",
  EMAIL_BACKUP: "artyouroma@gmail.com",
  INVIA_EMAIL_UTENTE: true,
  HOLD_MINUTES: 15
};

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const pren = ensureSheet_(ss, CFG.SHEET_PRENOTAZIONI);
  ensureHeaders_(pren, [
    "ID","Timestamp","Stato","Modulo","Nome","Cognome","Telefono","Email",
    "Corso","Evento","Scelte","Posti","Pagamento","Importo","ScadenzaHold","Note"
  ]);

  const eventi = ensureSheet_(ss, CFG.SHEET_EVENTI);
  ensureHeaders_(eventi, [
    "Evento","Titolo","Data","Capienza","Prezzo","Attivo"
  ]);
}

function bookingLegacyDoGet_(e) {
  try {
    cleanupExpiredHolds_();

    const params = e && e.parameter ? e.parameter : {};

    if (params.disponibilita === "1") {
      return jsonResponse_({
        ok: true,
        disponibilita: getDisponibilita_()
      });
    }

    if (params.eventi === "1") {
      return jsonResponse_({
        ok: true,
        eventi: getEventiPubblici_()
      });
    }

    if (params.evento) {
      const evento = String(params.evento || "").trim();
      return jsonResponse_({
        ok: true,
        evento: evento,
        liberi: getAvailableSeats_(evento)
      });
    }

    return jsonResponse_({
      ok: true,
      message: "Artyou booking endpoint attivo"
    });

  } catch (err) {
    return jsonResponse_({
      ok: false,
      errore: String(err && err.message || err)
    });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    cleanupExpiredHolds_();

    let data = parseRequest_(e);

    if (data._hp && String(data._hp).trim() !== "") {
      return jsonResponse_({ ok: true });
    }

    const action = String(data.action || data.Azione || "prenota").toLowerCase();

    if (action === "confermapagamento" || action === "pagato") {
      requireAdminSecret_(data.adminSecret);
      return confirmPayment_(data);
    }

    if (action === "annulla") {
      requireAdminSecret_(data.adminSecret);
      return cancelBooking_(data);
    }

    // MySQL archivio principale (ARTYOU_BOOKING_PRIMARY=mysql su Vercel): la
    // prenotazione è già decisa, qui si scrive solo la copia e si mandano le email.
    if (action === "registra") {
      requireAdminSecret_(data.adminSecret);
      return registerMysqlBooking_(data);
    }

    if (action !== "prenota") {
      return jsonResponse_({ ok: false, errore: "azione_non_valida" });
    }

    data = sanitizeRequest_(data);
    validateRequiredFields_(data);

    const isEvento = !!String(data.Evento || "").trim();

    if (isEvento) {
      return createEventBooking_(data);
    }

    return createGenericRequest_(data);

  } catch (err) {
    return jsonResponse_({
      ok: false,
      errore: String(err && err.message || err)
    });

  } finally {
    lock.releaseLock();
  }
}

function createGenericRequest_(data) {
  const id = makeId_();
  const rowData = Object.assign({}, data, {
    ID: id,
    Timestamp: new Date(),
    Stato: "Nuova"
  });

  delete rowData._hp;
  delete rowData.action;
  delete rowData.Azione;

  saveDynamicRow_(rowData);

  const emailAdmin = sendAdminEmail_(rowData, id);

  let emailUtente = { ok: false, errore: "email_utente_non_inviata" };
  if (CFG.INVIA_EMAIL_UTENTE && isValidEmail_(data.Email)) {
    emailUtente = sendUserEmail_(rowData, id);
  }

  return jsonResponse_({
    ok: true,
    id: id,
    stato: "Nuova",
    emailAdmin: emailAdmin,
    emailUtente: emailUtente
  });
}

function createEventBooking_(data) {
  const evento = String(data.Evento || "").trim();
  const posti = Math.max(1, parseInt(data.Posti || "1", 10) || 1);
  const pagamento = String(data.Pagamento || "In cassa").trim();
  const ev = getEvent_(evento);
  const importo = serverAmount_(ev, posti, data);

  // Se l'evento non è ancora configurato nel foglio Eventi,
  // la prenotazione viene comunque accettata e salvata.
  // La gestione della capienza si attiva automaticamente
  // appena aggiungi l'evento nel foglio Eventi.
  let liberi = null;

  if (ev) {
    if (!ev.attivo) {
      return jsonResponse_({
        ok: false,
        errore: "evento_non_attivo"
      });
    }

    liberi = getAvailableSeats_(evento);

    if (posti > liberi) {
      return jsonResponse_({
        ok: false,
        errore: "esaurito",
        liberi: liberi
      });
    }
  }

  const online = /paypal|online|carta|stripe/i.test(pagamento);
  const stato = online ? "HOLD" : "RISERVATO";
  const scadenza = online
    ? new Date(Date.now() + CFG.HOLD_MINUTES * 60 * 1000)
    : "";

  const id = makeId_();

  const rowData = Object.assign({}, data, {
    ID: id,
    Timestamp: new Date(),
    Stato: stato,
    Posti: posti,
    Pagamento: pagamento,
    Importo: importo,
    ScadenzaHold: scadenza
  });

  delete rowData._hp;
  delete rowData.action;
  delete rowData.Azione;

  saveDynamicRow_(rowData);

  const emailAdmin = sendAdminEmail_(rowData, id, typeof liberi === "number" ? liberi - posti : null);

  let emailUtente = { ok: false, errore: "email_utente_non_inviata" };
  if (CFG.INVIA_EMAIL_UTENTE && isValidEmail_(data.Email)) {
    emailUtente = sendUserEmail_(rowData, id);
  }

  return jsonResponse_({
    ok: true,
    id: id,
    stato: stato,
    liberi: typeof liberi === "number" ? liberi - posti : null,
    holdMinutes: online ? CFG.HOLD_MINUTES : 0,
    emailAdmin: emailAdmin,
    emailUtente: emailUtente
  });
}

// Copia di una prenotazione decisa da MySQL. Non controlla la capienza (l'ha già fatto
// MySQL) e non duplica: se il codice è già nel foglio risponde ok senza riscrivere
// né rimandare le email, così il riallineamento può ripetere l'invio senza rischi.
function registerMysqlBooking_(raw) {
  const id = String(raw.ID || "").trim();
  if (!/^ART-[0-9A-Z-]{6,60}$/i.test(id)) {
    return jsonResponse_({ ok: false, errore: "codice_non_valido" });
  }
  const stato = String(raw.Stato || "RISERVATO").toUpperCase();
  if (["HOLD", "RISERVATO", "PAGATO", "SCADUTO", "ANNULLATO"].indexOf(stato) === -1) {
    return jsonResponse_({ ok: false, errore: "stato_non_valido" });
  }

  const sheet = ensureSheet_(SpreadsheetApp.getActiveSpreadsheet(), CFG.SHEET_PRENOTAZIONI);
  if (sheet.getLastRow() >= 2) {
    // Riga di intestazione senza filtri, così l'indice coincide con la colonna.
    const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
    const idxID = headers.indexOf("ID");
    if (idxID !== -1) {
      const ids = sheet.getRange(2, idxID + 1, sheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]).trim() === id) {
          return jsonResponse_({ ok: true, id: id, gia_presente: true });
        }
      }
    }
  }

  const liberi = raw.liberi === "" || raw.liberi == null ? null : Number(raw.liberi);
  const scadenza = raw.ScadenzaHold ? new Date(raw.ScadenzaHold) : "";
  const data = sanitizeRequest_(raw);
  delete data.liberi;
  delete data.action;
  delete data._hp;

  const rowData = Object.assign({}, data, {
    ID: id,
    Timestamp: new Date(),
    Stato: stato,
    ScadenzaHold: scadenza && !isNaN(scadenza.getTime()) ? scadenza : ""
  });
  saveDynamicRow_(rowData);

  const emailAdmin = sendAdminEmail_(rowData, id, typeof liberi === "number" && isFinite(liberi) ? liberi : null);
  let emailUtente = { ok: false, errore: "email_utente_non_inviata" };
  if (CFG.INVIA_EMAIL_UTENTE && isValidEmail_(data.Email)) {
    emailUtente = sendUserEmail_(rowData, id);
  }

  return jsonResponse_({ ok: true, id: id, emailAdmin: emailAdmin, emailUtente: emailUtente });
}

function confirmPayment_(data) {
  const id = String(data.ID || data.id || "").trim();

  if (!id) {
    return jsonResponse_({
      ok: false,
      errore: "id_mancante"
    });
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CFG.SHEET_PRENOTAZIONI);

  if (!sheet || sheet.getLastRow() < 2) {
    return jsonResponse_({
      ok: false,
      errore: "prenotazione_non_trovata"
    });
  }

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idxID = headers.indexOf("ID");
  const idxStato = headers.indexOf("Stato");
  const idxScadenza = headers.indexOf("ScadenzaHold");

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idxID]) !== id) continue;

    const stato = String(rows[i][idxStato] || "").toUpperCase();

    if (stato === "ANNULLATO") {
      return jsonResponse_({
        ok: false,
        errore: "prenotazione_annullata"
      });
    }

    if (stato === "PAGATO") {
      return jsonResponse_({
        ok: true,
        id: id,
        stato: "PAGATO"
      });
    }

    sheet.getRange(i + 1, idxStato + 1).setValue("PAGATO");

    if (idxScadenza !== -1) {
      sheet.getRange(i + 1, idxScadenza + 1).setValue("");
    }

    return jsonResponse_({
      ok: true,
      id: id,
      stato: "PAGATO"
    });
  }

  return jsonResponse_({
    ok: false,
    errore: "prenotazione_non_trovata"
  });
}

function cancelBooking_(data) {
  const id = String(data.ID || data.id || "").trim();

  if (!id) {
    return jsonResponse_({
      ok: false,
      errore: "id_mancante"
    });
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CFG.SHEET_PRENOTAZIONI);

  if (!sheet || sheet.getLastRow() < 2) {
    return jsonResponse_({
      ok: false,
      errore: "prenotazione_non_trovata"
    });
  }

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idxID = headers.indexOf("ID");
  const idxStato = headers.indexOf("Stato");
  const idxScadenza = headers.indexOf("ScadenzaHold");

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idxID]) !== id) continue;

    sheet.getRange(i + 1, idxStato + 1).setValue("ANNULLATO");

    if (idxScadenza !== -1) {
      sheet.getRange(i + 1, idxScadenza + 1).setValue("");
    }

    return jsonResponse_({
      ok: true,
      id: id,
      stato: "ANNULLATO"
    });
  }

  return jsonResponse_({
    ok: false,
    errore: "prenotazione_non_trovata"
  });
}

function getEventiPubblici_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CFG.SHEET_EVENTI);
  if (!sh || sh.getLastRow() < 2) return {};

  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const idxEvento = headers.indexOf("Evento");
  const idxTitolo = headers.indexOf("Titolo");
  const idxData = headers.indexOf("Data");
  const idxCapienza = headers.indexOf("Capienza");
  const idxPrezzo = headers.indexOf("Prezzo");
  const idxAttivo = headers.indexOf("Attivo");

  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const id = String(rows[i][idxEvento] || "").trim();
    if (!id) continue;
    const attivo = idxAttivo === -1 ? true : parseBool_(rows[i][idxAttivo]);
    if (!attivo) continue;
    out[id] = {
      titolo: idxTitolo === -1 ? "" : String(rows[i][idxTitolo] || ""),
      data: idxData === -1 ? "" : String(rows[i][idxData] || ""),
      capienza: idxCapienza === -1 ? "" : rows[i][idxCapienza],
      prezzo: idxPrezzo === -1 ? "" : rows[i][idxPrezzo],
      attivo: true
    };
  }
  return out;
}

function getDisponibilita_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventiSheet = ss.getSheetByName(CFG.SHEET_EVENTI);

  if (!eventiSheet || eventiSheet.getLastRow() < 2) {
    return {};
  }

  const rows = eventiSheet.getDataRange().getValues();
  const headers = rows[0];
  const idxEvento = headers.indexOf("Evento");
  const idxAttivo = headers.indexOf("Attivo");

  if (idxEvento === -1) return {};

  const result = {};

  for (let i = 1; i < rows.length; i++) {
    const evento = String(rows[i][idxEvento] || "").trim();
    if (!evento) continue;

    const attivo = idxAttivo === -1
      ? true
      : parseBool_(rows[i][idxAttivo]);

    if (!attivo) continue;

    result[evento] = getAvailableSeats_(evento);
  }

  return result;
}

function getAvailableSeats_(evento) {
  const ev = getEvent_(evento);
  if (!ev) return 0;

  return Math.max(
    0,
    ev.capienza - countActiveSeats_(evento)
  );
}

function getEvent_(evento) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CFG.SHEET_EVENTI);

  if (!sheet || sheet.getLastRow() < 2) {
    return null;
  }

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  const idxEvento = headers.indexOf("Evento");
  const idxTitolo = headers.indexOf("Titolo");
  const idxData = headers.indexOf("Data");
  const idxCapienza = headers.indexOf("Capienza");
  const idxPrezzo = headers.indexOf("Prezzo");
  const idxAttivo = headers.indexOf("Attivo");

  if (idxEvento === -1 || idxCapienza === -1) {
    return null;
  }

  for (let i = 1; i < rows.length; i++) {
    if (
      String(rows[i][idxEvento] || "").trim() !==
      String(evento).trim()
    ) {
      continue;
    }

    return {
      evento: evento,
      titolo: idxTitolo === -1 ? evento : String(rows[i][idxTitolo] || evento),
      data: idxData === -1 ? "" : rows[i][idxData],
      capienza: Math.max(0, parseInt(rows[i][idxCapienza], 10) || 0),
      prezzo: idxPrezzo === -1 ? "" : rows[i][idxPrezzo],
      attivo: idxAttivo === -1 ? true : parseBool_(rows[i][idxAttivo])
    };
  }

  return null;
}

function countActiveSeats_(evento) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CFG.SHEET_PRENOTAZIONI);

  if (!sheet || sheet.getLastRow() < 2) {
    return 0;
  }

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  const idxEvento = headers.indexOf("Evento");
  const idxPosti = headers.indexOf("Posti");
  const idxStato = headers.indexOf("Stato");
  const idxScadenza = headers.indexOf("ScadenzaHold");

  if (idxEvento === -1) return 0;

  let used = 0;
  const now = new Date();

  for (let i = 1; i < rows.length; i++) {
    if (
      String(rows[i][idxEvento] || "").trim() !==
      String(evento).trim()
    ) {
      continue;
    }

    const stato = idxStato === -1
      ? ""
      : String(rows[i][idxStato] || "").toUpperCase();

    const posti = idxPosti === -1
      ? 1
      : Math.max(1, parseInt(rows[i][idxPosti], 10) || 1);

    if (
      stato === "PAGATO" ||
      stato === "RISERVATO" ||
      stato === "NUOVA"
    ) {
      used += posti;
      continue;
    }

    if (stato === "HOLD") {
      if (idxScadenza === -1) {
        used += posti;
        continue;
      }

      const exp = rows[i][idxScadenza];
      const expiry = exp instanceof Date ? exp : new Date(exp);

      if (
        expiry &&
        !isNaN(expiry.getTime()) &&
        expiry > now
      ) {
        used += posti;
      }
    }
  }

  return used;
}

function cleanupExpiredHolds_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CFG.SHEET_PRENOTAZIONI);

  if (!sheet || sheet.getLastRow() < 2) {
    return;
  }

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  const idxStato = headers.indexOf("Stato");
  const idxScadenza = headers.indexOf("ScadenzaHold");

  if (idxStato === -1 || idxScadenza === -1) {
    return;
  }

  const now = new Date();

  for (let i = 1; i < rows.length; i++) {
    const stato = String(rows[i][idxStato] || "").toUpperCase();

    if (stato !== "HOLD") continue;

    const exp = rows[i][idxScadenza];
    const expiry = exp instanceof Date ? exp : new Date(exp);

    if (
      expiry &&
      !isNaN(expiry.getTime()) &&
      expiry <= now
    ) {
      sheet
        .getRange(i + 1, idxStato + 1)
        .setValue("SCADUTO");
    }
  }
}

function saveDynamicRow_(rowData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureSheet_(ss, CFG.SHEET_PRENOTAZIONI);

  const baseHeaders = [
    "ID","Timestamp","Stato","Modulo","Nome","Cognome","Telefono","Email",
    "Corso","Evento","Scelte","Posti","Pagamento","Importo","ScadenzaHold","Note"
  ];

  const headers = baseHeaders.slice();

  Object.keys(rowData || {}).forEach(function(key) {
    if (
      key !== "_hp" &&
      key !== "action" &&
      key !== "Azione" &&
      headers.indexOf(key) === -1
    ) {
      headers.push(key);
    }
  });

  ensureHeaders_(sheet, headers);

  const currentHeaders = getSheetHeaders_(sheet);

  const row = currentHeaders.map(function(header) {
    return Object.prototype.hasOwnProperty.call(rowData, header)
      ? normalizeValue_(rowData[header])
      : "";
  });

  sheet.appendRow(row);
}

function validateRequiredFields_(data) {
  if (!data.Nome) {
    throw new Error("Nome mancante");
  }

  if (!data.Email) {
    throw new Error("Email mancante");
  }

  if (!isValidEmail_(data.Email)) {
    throw new Error("Email non valida");
  }

  if (!data.Telefono) {
    throw new Error("Telefono mancante");
  }
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function sendAdminEmail_(data, id, liberiDopo) {
  try {
    const subject =
      "Nuova prenotazione Artyou · " +
      (data.Evento || data.Corso || data.Scelte || data.Modulo || "Sito");

    let body =
      "Nuova richiesta Artyou\n\n" +
      "ID: " + id + "\n" +
      formatDataText_(data);

    if (typeof liberiDopo === "number") {
      body += "\nPosti liberi rimanenti: " + liberiDopo;
    }

    let html =
      "<h2>Nuova richiesta Artyou</h2>" +
      "<p><strong>ID:</strong> " + escapeHtml_(id) + "</p>" +
      formatDataHtml_(data);

    if (typeof liberiDopo === "number") {
      html +=
        "<p><strong>Posti liberi rimanenti:</strong> " +
        liberiDopo +
        "</p>";
    }

    html += "<p>Apri il Google Sheet per gestire la prenotazione.</p>";

    MailApp.sendEmail({
      to: CFG.EMAIL_ADMIN,
      cc: CFG.EMAIL_BACKUP || "",
      subject: subject,
      body: body,
      htmlBody: html,
      name: "Artyou Roma"
    });
    return { ok: true };

  } catch (err) {
    console.log("Errore email admin: " + err.message);
    return { ok: false, errore: String(err && err.message || err) };
  }
}

function sendUserEmail_(data, id) {
  try {
    const nome = data.Nome || "";

    const oggetto =
      data.Evento ||
      data.Corso ||
      data.Scelte ||
      data.Modulo ||
      "la tua richiesta";

    const stato = String(data.Stato || "");

    let messaggio = "Abbiamo ricevuto correttamente la tua richiesta.";

    if (stato === "HOLD") {
      messaggio =
        "Abbiamo ricevuto la tua richiesta. I posti sono bloccati per " +
        CFG.HOLD_MINUTES +
        " minuti in attesa del pagamento.";
    } else if (stato === "RISERVATO") {
      messaggio = "La tua prenotazione è stata registrata e i posti sono riservati.";
    } else if (stato === "PAGATO") {
      messaggio = "La tua prenotazione e il pagamento risultano confermati.";
    }

    const subject = "Artyou Roma · richiesta ricevuta";

    const body =
      "Ciao " + nome + ",\n\n" +
      messaggio + "\n\n" +
      "Richiesta: " + oggetto + "\n" +
      (data.Posti ? "Posti: " + data.Posti + "\n" : "") +
      (data.Pagamento ? "Pagamento: " + data.Pagamento + "\n" : "") +
      (data.Importo ? "Importo: " + data.Importo + "\n" : "") +
      "Codice richiesta: " + id + "\n\n" +
      "Grazie,\nArtyou Roma";

    const html =
      "<p>Ciao " + escapeHtml_(nome) + ",</p>" +
      "<p>" + escapeHtml_(messaggio) + "</p>" +
      "<p><strong>" + escapeHtml_(oggetto) + "</strong></p>" +
      (data.Posti ? "<p><strong>Posti:</strong> " + escapeHtml_(data.Posti) + "</p>" : "") +
      (data.Pagamento ? "<p><strong>Pagamento:</strong> " + escapeHtml_(data.Pagamento) + "</p>" : "") +
      (data.Importo ? "<p><strong>Importo:</strong> " + escapeHtml_(data.Importo) + "</p>" : "") +
      "<p><strong>Codice richiesta:</strong> " + escapeHtml_(id) + "</p>" +
      "<p>Grazie,<br><strong>Artyou Roma</strong></p>" +
      '<p><a href="https://www.artyouroma.it">www.artyouroma.it</a></p>';

    MailApp.sendEmail({
      to: data.Email,
      subject: subject,
      body: body,
      htmlBody: html,
      name: "Artyou Roma",
      replyTo: CFG.EMAIL_ADMIN
    });
    return { ok: true };

  } catch (err) {
    console.log("Errore email utente: " + err.message);
    return { ok: false, errore: String(err && err.message || err) };
  }
}

function testEmail() {
  MailApp.sendEmail({
    to: CFG.EMAIL_ADMIN,
    cc: CFG.EMAIL_BACKUP || "",
    subject: "Test Artyou",
    body: "Se ricevi questa mail, Apps Script funziona.",
    htmlBody: "<b>Se ricevi questa mail, Apps Script funziona.</b>"
  });
}

function parseRequest_(e) {
  if (!e) {
    throw new Error("Richiesta vuota");
  }

  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {}
  }

  return e.parameter || {};
}

// Campi che solo il server può valorizzare: il client non può impostarli.
const SERVER_FIELDS_ = ["ID", "Timestamp", "Stato", "ScadenzaHold", "adminSecret", "scannerSecret", "pin", "token"];
const MAX_REQUEST_FIELDS_ = 40;
const MAX_FIELD_LENGTH_ = 4000;

function sanitizeRequest_(data) {
  const out = {};
  let count = 0;
  Object.keys(data || {}).forEach(function(key) {
    if (SERVER_FIELDS_.indexOf(key) !== -1) return;
    if (!/^[A-Za-z_][A-Za-z0-9_ ]{0,39}$/.test(key)) return;
    if (count >= MAX_REQUEST_FIELDS_) return;
    let value = data[key];
    if (value !== null && typeof value === "object") value = JSON.stringify(value);
    if (typeof value === "string" && value.length > MAX_FIELD_LENGTH_) value = value.slice(0, MAX_FIELD_LENGTH_);
    out[key] = value;
    count++;
  });
  return out;
}

function requireAdminSecret_(secret) {
  const expected = PropertiesService.getScriptProperties().getProperty("ARTYOU_ADMIN_SECRET");
  if (!expected || String(secret || "") !== expected) {
    throw new Error("non_autorizzato");
  }
}

// Importo calcolato dal prezzo del foglio Eventi quando l'evento ha un prezzo unico.
// Per pacchetti a scelta (RIF, YEP) resta l'importo dichiarato, da verificare sul pagamento reale.
function serverAmount_(ev, posti, data) {
  const prezzo = ev ? parseFloat(String(ev.prezzo || "").replace(",", ".").replace(/[^0-9.]/g, "")) : NaN;
  if (Number.isFinite(prezzo) && prezzo > 0 && !String(data.Scelte || "").trim()) {
    return (prezzo * posti).toFixed(2);
  }
  return String(data.Importo || "").trim().slice(0, 40);
}

function makeId_() {
  return (
    "ART-" +
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyyMMdd-HHmmss"
    ) +
    "-" +
    Math.floor(Math.random() * 900 + 100)
  );
}

function ensureSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  return sheet;
}

function ensureHeaders_(sheet, requiredHeaders) {
  const currentHeaders = getSheetHeaders_(sheet);

  if (currentHeaders.length === 0) {
    sheet.appendRow(requiredHeaders);
    sheet
      .getRange(1, 1, 1, requiredHeaders.length)
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
    return;
  }

  let changed = false;

  requiredHeaders.forEach(function(header) {
    if (currentHeaders.indexOf(header) === -1) {
      currentHeaders.push(header);
      changed = true;
    }
  });

  if (changed) {
    sheet
      .getRange(1, 1, 1, currentHeaders.length)
      .setValues([currentHeaders])
      .setFontWeight("bold");
  }
}

function getSheetHeaders_(sheet) {
  if (sheet.getLastColumn() === 0) {
    return [];
  }

  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .filter(String);
}

function normalizeValue_(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object" && !(value instanceof Date)) {
    value = JSON.stringify(value);
  }

  // Un testo che inizia con = + - @ verrebbe interpretato come formula dal foglio.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(value)) {
    return "'" + value;
  }

  return value;
}

function parseBool_(v) {
  if (v === true) return true;

  const s = String(v || "").trim().toLowerCase();

  return ![
    "0","false","no","off","inattivo"
  ].includes(s);
}

function formatDataText_(data) {
  return Object.keys(data || {})
    .filter(function(key) {
      return key !== "_hp" && key !== "action" && key !== "Azione";
    })
    .map(function(key) {
      return key + ": " + String(data[key] == null ? "" : data[key]);
    })
    .join("\n");
}

function formatDataHtml_(data) {
  let html = "<table cellpadding='6' cellspacing='0'>";

  Object.keys(data || {}).forEach(function(key) {
    if (
      key === "_hp" ||
      key === "action" ||
      key === "Azione"
    ) {
      return;
    }

    html +=
      "<tr>" +
      "<td><strong>" +
      escapeHtml_(key) +
      "</strong></td>" +
      "<td>" +
      escapeHtml_(String(data[key] == null ? "" : data[key])) +
      "</td>" +
      "</tr>";
  });

  html += "</table>";
  return html;
}

function escapeHtml_(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}