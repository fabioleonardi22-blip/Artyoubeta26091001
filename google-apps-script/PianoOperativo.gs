/**
 * ARTYOU · Piano Operativo
 * Modulo separato e prefissato PO_ per evitare conflitti con il gestionale esistente.
 * Da collegare al router Apps Script quando il Piano Operativo passerà dalla demo al backend reale.
 */

const PO_SHEET_TASKS = 'PianoOperativo';
const PO_SHEET_PEOPLE = 'Responsabili';
const PO_PROP_CALENDAR_ID = 'PO_CALENDAR_ID';
const PO_PROP_WHATSAPP_TOKEN = 'PO_WHATSAPP_TOKEN';
const PO_PROP_WHATSAPP_PHONE_ID = 'PO_WHATSAPP_PHONE_ID';

function PO_getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function PO_getOrCreateSheet_(name, headers) {
  const ss = PO_getSpreadsheet_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers]);
  }
  return sh;
}

function PO_getPeopleSheet_() {
  return PO_getOrCreateSheet_(PO_SHEET_PEOPLE, [
    'id','nome','ruolo','email','whatsapp','emailAttiva','whatsappAttivo','attivo'
  ]);
}

function PO_getTasksSheet_() {
  return PO_getOrCreateSheet_(PO_SHEET_TASKS, [
    'id','titolo','tipo','fase','responsabileId','responsabileNome','data','oraInizio','oraFine',
    'stato','note','reminderDays','reminderChannel','reminderKeyInviati','googleEventId','updatedAt'
  ]);
}

function PO_listPeople() {
  const sh = PO_getPeopleSheet_();
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  const h = v[0];
  return v.slice(1).filter(r => r[0]).map(r => Object.fromEntries(h.map((k,i)=>[k,r[i]])));
}

function PO_findPersonById_(id) {
  return PO_listPeople().find(p => String(p.id) === String(id)) || null;
}

function PO_listTasks() {
  const sh = PO_getTasksSheet_();
  const v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  const h = v[0];
  return v.slice(1).filter(r => r[0]).map(r => Object.fromEntries(h.map((k,i)=>[k,r[i]])));
}

function PO_daysBetween_(fromDate, toDate) {
  const a = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const b = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((b - a) / 86400000);
}

function PO_buildReminderMessage_(task, person, daysLeft) {
  let timing = daysLeft === 0 ? 'scade oggi' : (daysLeft > 0 ? 'mancano ' + daysLeft + ' giorni' : 'è scaduta da ' + Math.abs(daysLeft) + ' giorni');
  return [
    'Ciao ' + (person.nome || task.responsabileNome || '') + ',',
    '',
    'promemoria Piano Operativo Artyou.',
    'Attività: ' + task.titolo,
    'Area: ' + (task.tipo || '-'),
    'Fase: ' + (task.fase || '-'),
    'Scadenza: ' + Utilities.formatDate(new Date(task.data), Session.getScriptTimeZone(), 'dd/MM/yyyy'),
    'Stato: ' + (task.stato || 'Da fare'),
    'Tempistica: ' + timing + '.',
    '',
    'Apri il Piano Operativo per aggiornare lo stato.'
  ].join('\n');
}

function PO_sendEmailReminder_(person, task, message) {
  if (!person || !person.email || String(person.emailAttiva).toLowerCase() === 'false') return false;
  MailApp.sendEmail({
    to: person.email,
    subject: 'Artyou · Promemoria: ' + task.titolo,
    body: message,
    name: 'Artyou Roma'
  });
  return true;
}

function PO_sendWhatsAppReminder_(person, task, message) {
  if (!person || !person.whatsapp || String(person.whatsappAttivo).toLowerCase() !== 'true') return false;

  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty(PO_PROP_WHATSAPP_TOKEN);
  const phoneId = props.getProperty(PO_PROP_WHATSAPP_PHONE_ID);
  if (!token || !phoneId) return false;

  const to = String(person.whatsapp).replace(/[^0-9]/g,'');
  const url = 'https://graph.facebook.com/v21.0/' + phoneId + '/messages';
  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: { body: message, preview_url: false }
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  return res.getResponseCode() >= 200 && res.getResponseCode() < 300;
}

function PO_syncTaskToCalendar_(task) {
  const calendarId = PropertiesService.getScriptProperties().getProperty(PO_PROP_CALENDAR_ID);
  if (!calendarId || !task.data) return '';

  const cal = CalendarApp.getCalendarById(calendarId);
  if (!cal) return '';

  const start = new Date(task.data);
  if (task.oraInizio) {
    const p = String(task.oraInizio).split(':');
    start.setHours(Number(p[0]||0), Number(p[1]||0), 0, 0);
  } else {
    start.setHours(9,0,0,0);
  }

  const end = new Date(start);
  if (task.oraFine) {
    const p = String(task.oraFine).split(':');
    end.setHours(Number(p[0]||0), Number(p[1]||0), 0, 0);
  } else {
    end.setHours(start.getHours()+1);
  }

  let ev = null;
  if (task.googleEventId) {
    try { ev = cal.getEventById(task.googleEventId); } catch(e) {}
  }

  const desc = [
    'Piano Operativo Artyou',
    'Area: ' + (task.tipo || ''),
    'Fase: ' + (task.fase || ''),
    'Responsabile: ' + (task.responsabileNome || ''),
    'Stato: ' + (task.stato || ''),
    '',
    task.note || ''
  ].join('\n');

  if (ev) {
    ev.setTitle(task.titolo || 'Attività Artyou');
    ev.setTime(start,end);
    ev.setDescription(desc);
  } else {
    ev = cal.createEvent(task.titolo || 'Attività Artyou', start, end, {description: desc});
  }
  return ev.getId();
}

/**
 * Trigger giornaliero.
 * Invia i promemoria solo per attività non completate.
 * reminderKeyInviati evita doppi invii.
 */
function PO_runDailyReminders() {
  const sh = PO_getTasksSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return;

  const headers = values[0];
  const ix = Object.fromEntries(headers.map((h,i)=>[h,i]));
  const today = new Date();

  for (let r=1; r<values.length; r++) {
    const row = values[r];
    if (!row[ix.id] || !row[ix.data]) continue;
    if (String(row[ix.stato]||'').toLowerCase() === 'fatto' || String(row[ix.stato]||'').toLowerCase() === 'done') continue;

    const due = new Date(row[ix.data]);
    const daysLeft = PO_daysBetween_(today, due);
    const configuredDays = Number(row[ix.reminderDays] || 6);

    // Primo reminder configurabile + escalation fissa 3,1,0,-1
    const schedule = [...new Set([configuredDays,3,1,0,-1])];
    if (!schedule.includes(daysLeft)) continue;

    const sentKeys = String(row[ix.reminderKeyInviati] || '').split(',').filter(Boolean);
    const key = String(daysLeft);
    if (sentKeys.includes(key)) continue;

    const task = Object.fromEntries(headers.map((h,i)=>[h,row[i]]));
    const person = PO_findPersonById_(task.responsabileId);
    if (!person) continue;

    const message = PO_buildReminderMessage_(task, person, daysLeft);
    const channel = String(task.reminderChannel || 'email').toLowerCase();

    let sent = false;
    if (channel === 'email' || channel === 'both') sent = PO_sendEmailReminder_(person, task, message) || sent;
    if (channel === 'whatsapp' || channel === 'both') sent = PO_sendWhatsAppReminder_(person, task, message) || sent;

    if (sent) {
      sentKeys.push(key);
      sh.getRange(r+1, ix.reminderKeyInviati+1).setValue(sentKeys.join(','));
    }
  }
}

function PO_installDailyReminderTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'PO_runDailyReminders')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('PO_runDailyReminders')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
}
