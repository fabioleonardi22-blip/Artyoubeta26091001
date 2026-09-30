/**
 * ARTYOU · Piano Operativo
 * Backend Google Apps Script per Bacheca, Google Calendar e promemoria.
 * Tutte le funzioni sono prefissate PO_ per convivere con il Gestionale Eventi.
 */

const PO_SHEET_TASKS = 'PianoOperativo';
const PO_SHEET_PEOPLE = 'Responsabili';
const PO_PROP_CALENDAR_ID = 'PO_CALENDAR_ID';
const PO_PROP_ADMIN_EMAILS = 'PO_ADMIN_EMAILS';
const PO_PROP_WHATSAPP_TOKEN = 'PO_WHATSAPP_TOKEN';
const PO_PROP_WHATSAPP_PHONE_ID = 'PO_WHATSAPP_PHONE_ID';

const PO_TASK_HEADERS = [
  'id','titolo','tipo','fase','responsabileId','responsabileNome','data','oraInizio','oraFine',
  'luogo','visibilita','stato','ripeti','note','publicTitle','price','capacity','slug','publishSite',
  'courseStart','coursePreset','yepDate','yepPreset','reminderDays','reminderChannel',
  'reminderKeyInviati','googleEventId','source','updatedAt'
];

const PO_PEOPLE_HEADERS = [
  'id','nome','ruolo','email','whatsapp','emailAttiva','whatsappAttivo','attivo','updatedAt'
];

function PO_getSpreadsheet_() {
  try {
    if (typeof gestSpreadsheet_ === 'function') return gestSpreadsheet_();
  } catch (e) {}
  return SpreadsheetApp.getActiveSpreadsheet();
}

function PO_getOrCreateSheet_(name, headers) {
  const ss = PO_getSpreadsheet_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    return sh;
  }
  const current = sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getValues()[0].map(String);
  const missing = headers.filter(h => current.indexOf(h) === -1);
  if (missing.length) sh.getRange(1,current.length+1,1,missing.length).setValues([missing]);
  return sh;
}

function PO_getPeopleSheet_() { return PO_getOrCreateSheet_(PO_SHEET_PEOPLE, PO_PEOPLE_HEADERS); }
function PO_getTasksSheet_() { return PO_getOrCreateSheet_(PO_SHEET_TASKS, PO_TASK_HEADERS); }

function PO_setup(adminEmail) {
  PO_getPeopleSheet_();
  PO_getTasksSheet_();
  const props = PropertiesService.getScriptProperties();
  if (adminEmail) props.setProperty(PO_PROP_ADMIN_EMAILS, String(adminEmail).trim().toLowerCase());
  if (!props.getProperty(PO_PROP_CALENDAR_ID)) {
    const cal = CalendarApp.createCalendar('Artyou · Piano Operativo');
    props.setProperty(PO_PROP_CALENDAR_ID, cal.getId());
  }
  PO_installDailyReminderTrigger();
  return {ok:true, calendarId:props.getProperty(PO_PROP_CALENDAR_ID)};
}

function PO_json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function PO_bool_(v, def) {
  if (v === true || v === false) return v;
  if (v === '' || v === null || v === undefined) return !!def;
  return /^(1|true|si|sì|yes)$/i.test(String(v).trim());
}

function PO_normalizeEmail_(s) { return String(s||'').trim().toLowerCase(); }

function PO_adminEmails_() {
  return String(PropertiesService.getScriptProperties().getProperty(PO_PROP_ADMIN_EMAILS)||'')
    .split(',').map(PO_normalizeEmail_).filter(Boolean);
}

function PO_listPeople() {
  const sh = PO_getPeopleSheet_();
  if (sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues(), h = values[0].map(String);
  return values.slice(1).filter(r=>r[0]).map(r=>{
    const o={}; h.forEach((k,i)=>o[k]=r[i]);
    return {
      id:String(o.id||''), name:String(o.nome||''), role:String(o.ruolo||''),
      email:String(o.email||''), phone:String(o.whatsapp||''),
      emailOn:PO_bool_(o.emailAttiva,true), whatsappOn:PO_bool_(o.whatsappAttivo,false),
      active:PO_bool_(o.attivo,true), updatedAt:o.updatedAt||''
    };
  });
}

function PO_findPersonById_(id) {
  return PO_listPeople().find(p => String(p.id) === String(id)) || null;
}

function PO_findPersonByEmail_(email) {
  email=PO_normalizeEmail_(email);
  return PO_listPeople().find(p => PO_normalizeEmail_(p.email) === email && p.active) || null;
}

function PO_isAdmin_(email) {
  return PO_adminEmails_().indexOf(PO_normalizeEmail_(email)) !== -1;
}

function PO_requireUser_(email) {
  email=PO_normalizeEmail_(email);
  if (!email) throw new Error('email_mancante');
  if (PO_isAdmin_(email)) return {email:email,admin:true};
  const person=PO_findPersonByEmail_(email);
  if (!person) throw new Error('accesso_non_autorizzato');
  return {email:email,admin:false,person:person};
}

function PO_requireAdmin_(email) {
  const u=PO_requireUser_(email);
  if (!u.admin) throw new Error('permesso_admin_richiesto');
  return u;
}

function PO_session(email) {
  const u=PO_requireUser_(email);
  return {ok:true, admin:!!u.admin, person:u.person||null};
}

function PO_savePerson(email, p) {
  PO_requireAdmin_(email);
  p=p||{};
  const sh=PO_getPeopleSheet_(), values=sh.getDataRange().getValues(), h=values[0].map(String);
  const id=String(p.id||Utilities.getUuid());
  const obj={
    id:id,nome:String(p.name||p.nome||'').trim(),ruolo:String(p.role||p.ruolo||'').trim(),
    email:PO_normalizeEmail_(p.email),whatsapp:String(p.phone||p.whatsapp||'').trim(),
    emailAttiva:p.emailOn!==false,whatsappAttivo:!!p.whatsappOn,attivo:p.active!==false,updatedAt:new Date()
  };
  if(!obj.nome) throw new Error('nome_mancante');
  let row=-1, idIx=h.indexOf('id');
  for(let i=1;i<values.length;i++) if(String(values[i][idIx])===id){row=i+1;break;}
  const arr=h.map(k=>Object.prototype.hasOwnProperty.call(obj,k)?obj[k]:'');
  if(row>0) sh.getRange(row,1,1,h.length).setValues([arr]); else sh.appendRow(arr);
  return PO_listPeople().find(x=>x.id===id);
}

function PO_deletePerson(email,id) {
  PO_requireAdmin_(email);
  const sh=PO_getPeopleSheet_(), values=sh.getDataRange().getValues(), h=values[0].map(String), ix=h.indexOf('id');
  for(let i=1;i<values.length;i++) if(String(values[i][ix])===String(id)){sh.deleteRow(i+1);return true;}
  return true;
}

function PO_taskRowToEvent_(h,r) {
  const o={}; h.forEach((k,i)=>o[k]=r[i]);
  return {
    id:String(o.id||''), title:String(o.titolo||''), type:String(o.tipo||'Altro'),
    phase:String(o.fase||''), responsibleContactId:String(o.responsabileId||''),
    teacher:String(o.responsabileNome||''), team:String(o.responsabileNome||''),
    date:PO_dateISO_(o.data), start:String(o.oraInizio||''), end:String(o.oraFine||''),
    venue:String(o.luogo||''), visibility:String(o.visibilita||'internal'),
    taskStatus:String(o.stato||'todo'), repeat:String(o.ripeti||'none'), notes:String(o.note||''),
    publicTitle:String(o.publicTitle||''), price:o.price===''?null:Number(o.price),
    capacity:o.capacity===''?null:Number(o.capacity), slug:String(o.slug||''),
    publishSite:PO_bool_(o.publishSite,false), courseStart:PO_dateISO_(o.courseStart),
    coursePreset:String(o.coursePreset||''), yepDate:PO_dateISO_(o.yepDate),
    yepPreset:String(o.yepPreset||''), reminderDays:Number(o.reminderDays||0),
    reminderChannel:String(o.reminderChannel||'email'), googleEventId:String(o.googleEventId||''),
    source:String(o.source||'plan')
  };
}

function PO_dateISO_(v) {
  if (!v) return '';
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const s=String(v).trim();
  const m=s.match(/^\d{4}-\d{2}-\d{2}/);
  if(m) return m[0];
  const d=new Date(v);
  return isNaN(d.getTime())?'':Utilities.formatDate(d,Session.getScriptTimeZone(),'yyyy-MM-dd');
}

function PO_listTasks() {
  const sh=PO_getTasksSheet_();
  if(sh.getLastRow()<2) return [];
  const values=sh.getDataRange().getValues(), h=values[0].map(String);
  return values.slice(1).filter(r=>r[0]).map(r=>PO_taskRowToEvent_(h,r));
}

function PO_calendar_() {
  const id=PropertiesService.getScriptProperties().getProperty(PO_PROP_CALENDAR_ID);
  return id ? CalendarApp.getCalendarById(id) : null;
}

function PO_calendarEvents_(from,to) {
  const cal=PO_calendar_();
  if(!cal) return [];
  const a=from?new Date(from+'T00:00:00'):new Date(new Date().getFullYear(),new Date().getMonth()-1,1);
  const b=to?new Date(to+'T23:59:59'):new Date(new Date().getFullYear(),new Date().getMonth()+2,0,23,59,59);
  return cal.getEvents(a,b).map(ev=>({
    id:'gcal_'+ev.getId(), title:ev.getTitle()||'Evento Google Calendar', type:'Altro', phase:'Google Calendar',
    teacher:'',team:'',date:Utilities.formatDate(ev.getStartTime(),Session.getScriptTimeZone(),'yyyy-MM-dd'),
    start:Utilities.formatDate(ev.getStartTime(),Session.getScriptTimeZone(),'HH:mm'),
    end:Utilities.formatDate(ev.getEndTime(),Session.getScriptTimeZone(),'HH:mm'),
    venue:ev.getLocation()||'',visibility:'internal',taskStatus:'todo',repeat:'none',
    notes:ev.getDescription()||'',reminderDays:0,reminderChannel:'email',
    googleEventId:ev.getId(),source:'google'
  }));
}

function PO_listEvents(email,from,to) {
  PO_requireUser_(email);
  const stored=PO_listTasks();
  const linked={}; stored.forEach(e=>{if(e.googleEventId) linked[e.googleEventId]=true;});
  const googleOnly=PO_calendarEvents_(from,to).filter(e=>!linked[e.googleEventId]);
  const all=stored.concat(googleOnly);
  return all.filter(e=>(!from||!e.date||e.date>=from)&&(!to||!e.date||e.date<=to));
}

function PO_saveTask(email,e) {
  PO_requireUser_(email);
  e=e||{};
  if(!String(e.title||'').trim()) throw new Error('titolo_mancante');
  if(!String(e.date||'').trim()) throw new Error('data_mancante');

  const sh=PO_getTasksSheet_(), values=sh.getDataRange().getValues(), h=values[0].map(String);
  let id=String(e.id||Utilities.getUuid());
  if(id.indexOf('gcal_')===0) id=Utilities.getUuid();

  const person=e.responsibleContactId?PO_findPersonById_(e.responsibleContactId):null;
  const obj={
    id:id,titolo:String(e.title||'').trim(),tipo:String(e.type||'Altro'),fase:String(e.phase||''),
    responsabileId:String(e.responsibleContactId||''),responsabileNome:String((person&&person.name)||e.teacher||e.team||''),
    data:String(e.date||''),oraInizio:String(e.start||''),oraFine:String(e.end||''),luogo:String(e.venue||''),
    visibilita:String(e.visibility||'internal'),stato:String(e.taskStatus||'todo'),ripeti:String(e.repeat||'none'),
    note:String(e.notes||''),publicTitle:String(e.publicTitle||''),price:e.price==null?'':Number(e.price),
    capacity:e.capacity==null?'':Number(e.capacity),slug:String(e.slug||''),publishSite:!!e.publishSite,
    courseStart:String(e.courseStart||''),coursePreset:String(e.coursePreset||''),yepDate:String(e.yepDate||''),
    yepPreset:String(e.yepPreset||''),reminderDays:Number(e.reminderDays||0),
    reminderChannel:String(e.reminderChannel||'email'),reminderKeyInviati:'',
    googleEventId:String(e.googleEventId||''),source:'plan',updatedAt:new Date()
  };

  // Preserve reminder history and existing Google ID on update.
  const idIx=h.indexOf('id'); let row=-1, old=null;
  for(let i=1;i<values.length;i++) if(String(values[i][idIx])===id){row=i+1;old={};h.forEach((k,j)=>old[k]=values[i][j]);break;}
  if(old){
    obj.reminderKeyInviati=String(old.reminderKeyInviati||'');
    if(!obj.googleEventId) obj.googleEventId=String(old.googleEventId||'');
  }

  obj.googleEventId=PO_syncTaskToCalendar_(obj);
  const arr=h.map(k=>Object.prototype.hasOwnProperty.call(obj,k)?obj[k]:'');
  if(row>0) sh.getRange(row,1,1,h.length).setValues([arr]); else sh.appendRow(arr);

  return PO_listTasks().find(x=>x.id===id);
}

function PO_deleteTask(email,id) {
  PO_requireUser_(email);
  const sh=PO_getTasksSheet_(), values=sh.getDataRange().getValues(), h=values[0].map(String);
  const idIx=h.indexOf('id'), gIx=h.indexOf('googleEventId');
  for(let i=1;i<values.length;i++){
    if(String(values[i][idIx])!==String(id)) continue;
    const gid=String(values[i][gIx]||'');
    if(gid){try{const ev=PO_calendar_().getEventById(gid);if(ev)ev.deleteEvent();}catch(e){}}
    sh.deleteRow(i+1); return true;
  }
  if(String(id).indexOf('gcal_')===0){
    const gid=String(id).slice(5);try{const ev=PO_calendar_().getEventById(gid);if(ev)ev.deleteEvent();}catch(e){}
  }
  return true;
}

function PO_daysBetween_(fromDate, toDate) {
  const a=new Date(fromDate.getFullYear(),fromDate.getMonth(),fromDate.getDate());
  const b=new Date(toDate.getFullYear(),toDate.getMonth(),toDate.getDate());
  return Math.round((b-a)/86400000);
}

function PO_buildReminderMessage_(task,person,daysLeft) {
  const timing=daysLeft===0?'scade oggi':(daysLeft>0?'mancano '+daysLeft+' giorni':'è scaduta da '+Math.abs(daysLeft)+' giorni');
  return [
    'Ciao '+(person.name||task.responsabileNome||'')+',','',
    'promemoria Piano Operativo Artyou.',
    'Attività: '+task.titolo,'Area: '+(task.tipo||'-'),'Fase: '+(task.fase||'-'),
    'Scadenza: '+Utilities.formatDate(new Date(task.data),Session.getScriptTimeZone(),'dd/MM/yyyy'),
    'Stato: '+(task.stato||'Da fare'),'Tempistica: '+timing+'.','',
    'Apri il Piano Operativo per aggiornare lo stato.'
  ].join('\n');
}

function PO_sendEmailReminder_(person,task,message) {
  if(!person||!person.email||!person.emailOn) return false;
  MailApp.sendEmail({to:person.email,subject:'Artyou · Promemoria: '+task.titolo,body:message,name:'Artyou Roma'});
  return true;
}

function PO_sendWhatsAppReminder_(person,task,message) {
  if(!person||!person.phone||!person.whatsappOn) return false;
  const props=PropertiesService.getScriptProperties(), token=props.getProperty(PO_PROP_WHATSAPP_TOKEN), phoneId=props.getProperty(PO_PROP_WHATSAPP_PHONE_ID);
  if(!token||!phoneId) return false;
  const url='https://graph.facebook.com/v21.0/'+phoneId+'/messages';
  const res=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+token},
    payload:JSON.stringify({messaging_product:'whatsapp',to:String(person.phone).replace(/[^0-9]/g,''),type:'text',text:{body:message,preview_url:false}}),muteHttpExceptions:true});
  return res.getResponseCode()>=200&&res.getResponseCode()<300;
}

function PO_syncTaskToCalendar_(task) {
  const cal=PO_calendar_();
  if(!cal||!task.data) return String(task.googleEventId||'');
  const start=new Date(String(task.data)+'T'+(task.oraInizio||'09:00')+':00');
  const end=new Date(String(task.data)+'T'+(task.oraFine||'10:00')+':00');
  let ev=null;
  if(task.googleEventId){try{ev=cal.getEventById(task.googleEventId);}catch(e){}}
  const desc=['Piano Operativo Artyou','Area: '+(task.tipo||''),'Fase: '+(task.fase||''),'Responsabile: '+(task.responsabileNome||''),'Stato: '+(task.stato||''),'',task.note||''].join('\n');
  if(ev){ev.setTitle(task.titolo||'Attività Artyou');ev.setTime(start,end);ev.setLocation(task.luogo||'');ev.setDescription(desc);}
  else ev=cal.createEvent(task.titolo||'Attività Artyou',start,end,{description:desc,location:task.luogo||''});
  return ev.getId();
}

function PO_runDailyReminders() {
  const sh=PO_getTasksSheet_(), values=sh.getDataRange().getValues();
  if(values.length<2)return;
  const headers=values[0].map(String), ix=Object.fromEntries(headers.map((h,i)=>[h,i])), today=new Date();
  for(let r=1;r<values.length;r++){
    const row=values[r]; if(!row[ix.id]||!row[ix.data])continue;
    const state=String(row[ix.stato]||'').toLowerCase(); if(state==='fatto'||state==='done')continue;
    const due=new Date(row[ix.data]), daysLeft=PO_daysBetween_(today,due), configuredDays=Number(row[ix.reminderDays]||6);
    const schedule=[...new Set([configuredDays,3,1,0,-1])]; if(!schedule.includes(daysLeft))continue;
    const sentKeys=String(row[ix.reminderKeyInviati]||'').split(',').filter(Boolean), key=String(daysLeft); if(sentKeys.includes(key))continue;
    const task={};headers.forEach((h,i)=>task[h]=row[i]); const person=PO_findPersonById_(task.responsabileId); if(!person)continue;
    const msg=PO_buildReminderMessage_(task,person,daysLeft), channel=String(task.reminderChannel||'email').toLowerCase();
    let sent=false;
    if(channel==='email'||channel==='both')sent=PO_sendEmailReminder_(person,task,msg)||sent;
    if(channel==='whatsapp'||channel==='both')sent=PO_sendWhatsAppReminder_(person,task,msg)||sent;
    if(sent){sentKeys.push(key);sh.getRange(r+1,ix.reminderKeyInviati+1).setValue(sentKeys.join(','));}
  }
}

function PO_installDailyReminderTrigger() {
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='PO_runDailyReminders').forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('PO_runDailyReminders').timeBased().everyDays(1).atHour(9).create();
}
