/**
 * ARTYOU · Piano Operativo
 * Backend Google Apps Script per Bacheca, Google Calendar e promemoria.
 * Tutte le funzioni sono prefissate PO_ per convivere con il Gestionale Eventi.
 */

const PO_SHEET_TASKS = 'PianoOperativo';
const PO_SHEET_PEOPLE = 'Responsabili';
const PO_SHEET_AUDIT = 'PianoOperativoAudit';
const PO_PROP_CALENDAR_ID = 'PO_CALENDAR_ID';
const PO_PROP_ADMIN_EMAILS = 'PO_ADMIN_EMAILS';
const PO_PROP_WHATSAPP_TOKEN = 'PO_WHATSAPP_TOKEN';
const PO_PROP_WHATSAPP_PHONE_ID = 'PO_WHATSAPP_PHONE_ID';

const PO_TASK_HEADERS = [
  'id','titolo','tipo','fase','responsabileId','responsabileNome','data','oraInizio','oraFine',
  'luogo','visibilita','stato','ripeti','note','publicTitle','price','capacity','slug','publishSite',
  'courseStart','coursePreset','yepDate','yepPreset','reminderDays','reminderChannel',
  'reminderKeyInviati','googleEventId','source','parentEventId','templateKey','attendeeIdsJSON','meetingChannel','meetingReminderDays','updatedAt'
];

const PO_PEOPLE_HEADERS = [
  'id','nome','tipo','ruolo','livelloAccesso','competenzeJSON','email','whatsapp','emailAttiva','whatsappAttivo','attivo','note','updatedAt'
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
function PO_getAuditSheet_() { return PO_getOrCreateSheet_(PO_SHEET_AUDIT,['timestamp','email','azione','entita','id','dettaglio']); }
function PO_audit_(email,azione,entita,id,dettaglio){try{PO_getAuditSheet_().appendRow([new Date(),PO_normalizeEmail_(email),String(azione||''),String(entita||''),String(id||''),String(dettaglio||'')]);}catch(e){}}

function PO_setup(adminEmail) {
  PO_getPeopleSheet_();
  PO_getTasksSheet_();
  PO_getAuditSheet_();
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
      id:String(o.id||''), name:String(o.nome||''), kind:String(o.tipo||'Docente'), role:String(o.ruolo||''),
      accessLevel:String(o.livelloAccesso||'Docente'), skills:(typeof gestParseJson_==='function'?gestParseJson_(o.competenzeJSON,[]):PO_parseJson_(o.competenzeJSON,[])),
      email:String(o.email||''), phone:String(o.whatsapp||''),
      emailOn:PO_bool_(o.emailAttiva,true), whatsappOn:PO_bool_(o.whatsappAttivo,false),
      active:PO_bool_(o.attivo,true), notes:String(o.note||''), updatedAt:o.updatedAt||''
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
  if (PO_isAdmin_(email)) return {email:email,admin:true,accessLevel:'Amministratore'};
  const person=PO_findPersonByEmail_(email);
  if (!person) throw new Error('accesso_non_autorizzato');
  const accessLevel=String(person.accessLevel||'Docente');
  if (accessLevel === 'Amministratore') return {email:email,admin:true,accessLevel:'Amministratore',person:person};
  return {email:email,admin:false,accessLevel:accessLevel,person:person};
}

function PO_requireAdmin_(email) {
  const u=PO_requireUser_(email);
  if (!u.admin) throw new Error('permesso_admin_richiesto');
  return u;
}

function PO_requireEditor_(email) {
  const u=PO_requireUser_(email);
  if (u.admin || String(u.accessLevel||'') === 'Staff') return u;
  throw new Error('permesso_modifica_richiesto');
}

function PO_session(email) {
  const u=PO_requireUser_(email);
  return {ok:true, admin:!!u.admin, accessLevel:u.admin?'Amministratore':String(u.accessLevel||'Docente'), person:u.person||null};
}

function PO_savePerson(email, p) {
  PO_requireAdmin_(email);
  p=p||{};
  const sh=PO_getPeopleSheet_(), values=sh.getDataRange().getValues(), h=values[0].map(String);
  const id=String(p.id||Utilities.getUuid());
  const obj={
    id:id,nome:String(p.name||p.nome||'').trim(),tipo:String(p.kind||p.tipo||'Docente').trim(),ruolo:String(p.role||p.ruolo||'').trim(),
    livelloAccesso:String(p.accessLevel||p.livelloAccesso||'Docente').trim(),competenzeJSON:JSON.stringify(Array.isArray(p.skills)?p.skills:[]),
    email:PO_normalizeEmail_(p.email),whatsapp:String(p.phone||p.whatsapp||'').trim(),
    emailAttiva:p.emailOn!==false,whatsappAttivo:!!p.whatsappOn,attivo:p.active!==false,
    note:String(p.notes||p.note||'').trim(),updatedAt:new Date()
  };
  if(!obj.nome) throw new Error('nome_mancante');
  if(!obj.email) throw new Error('email_mancante');
  if(['Amministratore','Staff','Docente'].indexOf(obj.livelloAccesso)===-1) obj.livelloAccesso='Docente';
  const dup=PO_listPeople().find(x=>PO_normalizeEmail_(x.email)===obj.email&&String(x.id)!==id);
  if(dup) throw new Error('email_gia_autorizzata');
  let row=-1, idIx=h.indexOf('id');
  for(let i=1;i<values.length;i++) if(String(values[i][idIx])===id){row=i+1;break;}
  const arr=h.map(k=>Object.prototype.hasOwnProperty.call(obj,k)?obj[k]:'');
  if(row>0) sh.getRange(row,1,1,h.length).setValues([arr]); else sh.appendRow(arr);
  PO_audit_(email,row>0?'modifica':'crea','persona',id,obj.nome+' · '+obj.livelloAccesso);
  return PO_listPeople().find(x=>x.id===id);
}

function PO_deletePerson(email,id) {
  PO_requireAdmin_(email);
  const sh=PO_getPeopleSheet_(), values=sh.getDataRange().getValues(), h=values[0].map(String), ix=h.indexOf('id');
  for(let i=1;i<values.length;i++) if(String(values[i][ix])===String(id)){PO_audit_(email,'elimina','persona',id,String(values[i][h.indexOf('nome')]||''));sh.deleteRow(i+1);return true;}
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
    source:String(o.source||'plan'), parentEventId:String(o.parentEventId||''), templateKey:String(o.templateKey||''),
    attendeeIds:(typeof gestParseJson_==='function'?gestParseJson_(o.attendeeIdsJSON,[]):PO_parseJson_(o.attendeeIdsJSON,[])),
    meetingChannel:String(o.meetingChannel||'calendar'), meetingReminderDays:Number(o.meetingReminderDays||0)
  };
}

function PO_parseJson_(s,f){try{return JSON.parse(String(s||""))}catch(e){return f}}
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

function PO_inferSiteType_(e) {
  const raw=(String(e.eventType||e.tipo||'')+' '+String(e.title||'')+' '+String(e.cat||'')).toLowerCase();
  if(raw.indexOf('yep')!==-1) return 'YEP';
  if(raw.indexOf('festival')!==-1) return 'Festival';
  if(raw.indexOf('workshop')!==-1 || raw.indexOf('workshow')!==-1) return 'Workshop';
  return 'Spettacolo';
}

function PO_parseSiteDate_(label) {
  label=String(label||'').trim();
  if(!label || /definire/i.test(label)) return {date:'',start:''};

  const iso=label.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  const time=label.match(/(?:^|[^0-9])(\d{1,2}):(\d{2})(?:[^0-9]|$)/);
  if(iso) {
    return {
      date:iso[1]+'-'+String(Number(iso[2])).padStart(2,'0')+'-'+String(Number(iso[3])).padStart(2,'0'),
      start:time?String(Number(time[1])).padStart(2,'0')+':'+time[2]:''
    };
  }

  const numeric=label.match(/(?:^|[^0-9])(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})(?:[^0-9]|$)/);
  if(numeric){
    return {date:numeric[3]+'-'+String(Number(numeric[2])).padStart(2,'0')+'-'+String(Number(numeric[1])).padStart(2,'0'),start:time?String(Number(time[1])).padStart(2,'0')+':'+time[2]:''};
  }
  const months={gennaio:1,febbraio:2,marzo:3,aprile:4,maggio:5,giugno:6,luglio:7,agosto:8,settembre:9,ottobre:10,novembre:11,dicembre:12};
  const m=label.toLowerCase().match(/(?:^|\s)(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(20\d{2}))?/i);
  if(!m) return {date:'',start:time?String(Number(time[1])).padStart(2,'0')+':'+time[2]:''};

  const now=new Date(), day=Number(m[1]), month=months[m[2].toLowerCase()];
  let year=m[3]?Number(m[3]):now.getFullYear();
  if(!m[3]) {
    const candidate=new Date(year,month-1,day);
    const delta=(candidate-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/86400000;
    if(delta < -180) year++;
  }
  return {
    date:year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'),
    start:time?String(Number(time[1])).padStart(2,'0')+':'+time[2]:''
  };
}

function PO_siteEvents_() {
  if(typeof gestAdminEvents_!=='function') return [];
  let site=[];
  try { site=gestAdminEvents_().filter(e=>e.attivo); } catch(err) { return []; }

  const out=[];
  site.forEach(function(e){
    const dates=Array.isArray(e.dates)&&e.dates.length?e.dates:[{label:'Data da definire'}];
    dates.forEach(function(d,i){
      const parsed=PO_parseSiteDate_(d&&d.label);
      out.push({
        id:'site_'+String(e.id||e.slug||'evento')+'_'+i,
        title:String(e.title||e.slug||'Evento sito'),
        type:PO_inferSiteType_(e),
        phase:'Evento dal Gestionale',
        teacher:'',team:'',
        date:parsed.date,start:parsed.start,end:'',
        venue:String(e.venue||''),visibility:'public',
        taskStatus:'todo',repeat:'none',
        notes:'Evento già presente nel Gestionale Eventi. Modificalo dal Gestionale, non dal Piano Operativo.',
        publicTitle:String(e.title||''),price:e.price===''?null:Number(e.price),
        capacity:e.capienza==null?null:Number(e.capienza),slug:String(e.slug||''),
        publishSite:true,reminderDays:0,reminderChannel:'email',
        googleEventId:'',source:'site',siteEventId:String(e.id||''),siteDateIndex:i,siteDateLabel:String((d&&d.label)||'')
      });
    });
  });
  return out;
}

function PO_listEvents(email,from,to) {
  PO_requireUser_(email);
  const stored=PO_listTasks();
  const linked={}; stored.forEach(e=>{if(e.googleEventId) linked[e.googleEventId]=true;});
  const googleOnly=PO_calendarEvents_(from,to).filter(e=>!linked[e.googleEventId]);
  const siteEvents=PO_siteEvents_();
  const all=stored.concat(siteEvents,googleOnly);
  return all.filter(e=>(!from||!e.date||e.date>=from)&&(!to||!e.date||e.date<=to));
}


function PO_planTemplates_(type) {
  const commonShow = [
    {key:'format',title:'Scelta format, cast e regia',phase:'Direzione',owner:'Direzione artistica',days:45},
    {key:'venue',title:'Conferma teatro / venue e accordo economico',phase:'Produzione',owner:'Staff Eventi',days:40},
    {key:'communication_launch',title:'Lancio evento: social, newsletter e comunicazione',phase:'Comunicazione',owner:'Comunicazione',days:28},
    {key:'rehearsals',title:'Definizione calendario prove',phase:'Prove',owner:'Compagnia / Docenti',days:21},
    {key:'siae',title:'SIAE, permessi e adempimenti',phase:'Amministrazione',owner:'Segreteria',days:14},
    {key:'tech',title:'Scheda tecnica luci / audio',phase:'Tecnica',owner:'Staff Eventi',days:10},
    {key:'reminder',title:'Reminder comunicazione spettacolo',phase:'Comunicazione',owner:'Comunicazione',days:7},
    {key:'logistics',title:'Check logistica, pagamenti e materiali',phase:'Logistica',owner:'Staff Eventi',days:5},
    {key:'general_rehearsal',title:'Prova generale',phase:'Prove',owner:'Cast / Responsabile compagnia',days:2},
    {key:'final_check',title:'Check finale venue, tecnica e accoglienza',phase:'Evento',owner:'Staff Eventi',days:1},
    {key:'event_day',title:'Coordinamento spettacolo',phase:'Evento',owner:'Staff Eventi',days:0},
    {key:'post',title:'Recap, foto/video e chiusura post-evento',phase:'Post evento',owner:'Comunicazione',days:-2}
  ];

  const workshop = [
    {key:'teacher',title:'Conferma docente e contenuti workshop',phase:'Programmazione',owner:'Direzione didattica',days:35},
    {key:'venue',title:'Conferma sala, orari e capienza',phase:'Logistica',owner:'Staff Eventi',days:30},
    {key:'page',title:'Pubblicazione pagina e apertura iscrizioni',phase:'Iscrizioni',owner:'Comunicazione',days:28},
    {key:'graphics',title:'Grafiche e locandina workshop',phase:'Comunicazione',owner:'Grafica',days:25},
    {key:'launch',title:'Lancio social e newsletter',phase:'Comunicazione',owner:'Comunicazione',days:21},
    {key:'check_sales',title:'Controllo iscritti e andamento vendite',phase:'Iscrizioni',owner:'Segreteria',days:10},
    {key:'reminder',title:'Reminder partecipanti e comunicazione finale',phase:'Comunicazione',owner:'Comunicazione',days:5},
    {key:'materials',title:'Check materiali, sala e necessità docente',phase:'Logistica',owner:'Staff Eventi',days:2},
    {key:'event_day',title:'Accoglienza e coordinamento workshop',phase:'Evento',owner:'Staff Eventi',days:0},
    {key:'feedback',title:'Feedback, foto e follow-up',phase:'Post evento',owner:'Comunicazione',days:-2}
  ];

  const yep = [
    {key:'concept',title:'Definire concept, titolo e linea artistica',phase:'Concept',owner:'Direzione',days:90},
    {key:'budget',title:'Budget preventivo, sponsor e bandi',phase:'Budget',owner:'Amministrazione',days:85},
    {key:'patrocini',title:'Richiesta patrocini e contributi',phase:'Istituzioni',owner:'Presidenza',days:80},
    {key:'venue',title:'Conferma location, sale e permessi',phase:'Location',owner:'Staff Eventi',days:75},
    {key:'call_open',title:'Apertura call artisti / compagnie',phase:'Programma',owner:'Direzione artistica',days:70},
    {key:'call_close',title:'Chiusura call e selezione artisti',phase:'Programma',owner:'Direzione artistica',days:55},
    {key:'program',title:'Programma definitivo',phase:'Programma',owner:'Direzione',days:50},
    {key:'contracts',title:'Accordi artisti, ospitalità e viaggi',phase:'Programma',owner:'Staff Eventi',days:45},
    {key:'identity',title:'Immagine coordinata e materiali grafici',phase:'Comunicazione',owner:'Grafica',days:42},
    {key:'tickets',title:'Apertura biglietteria / iscrizioni',phase:'Biglietteria',owner:'Segreteria',days:40},
    {key:'comms',title:'Piano comunicazione, social e newsletter',phase:'Comunicazione',owner:'Comunicazione',days:35},
    {key:'press',title:'Comunicato stampa e ufficio stampa',phase:'Comunicazione',owner:'Comunicazione',days:28},
    {key:'volunteers',title:'Reclutamento e formazione volontari',phase:'Persone',owner:'Staff Eventi',days:21},
    {key:'safety',title:'SIAE, assicurazioni e piano sicurezza',phase:'Sicurezza',owner:'Segreteria',days:18},
    {key:'tech',title:'Raccolta schede tecniche per giornata',phase:'Tecnica',owner:'Staff Eventi',days:14},
    {key:'runshow',title:'Riunione operativa e run of show',phase:'Coordinamento',owner:'Direttivo',days:7},
    {key:'participant_info',title:'Invio informazioni pratiche ai partecipanti',phase:'Comunicazione',owner:'Comunicazione',days:5},
    {key:'brief',title:'Brief finale staff e docenti',phase:'Coordinamento',owner:'Direzione',days:2},
    {key:'setup',title:'Allestimento, segnaletica e check spazi',phase:'Allestimento',owner:'Staff Eventi',days:1},
    {key:'event_day',title:'Coordinamento giornata / festival',phase:'Evento',owner:'Staff Eventi',days:0},
    {key:'teardown',title:'Smontaggio e riconsegna spazi',phase:'Post evento',owner:'Staff Eventi',days:-1},
    {key:'thanks',title:'Ringraziamenti e questionario feedback',phase:'Post evento',owner:'Comunicazione',days:-2},
    {key:'payments',title:'Pagamenti artisti e fornitori',phase:'Post evento',owner:'Amministrazione',days:-5},
    {key:'recap',title:'Carosello foto e Reel Recap',phase:'Post evento',owner:'Comunicazione',days:-7},
    {key:'report',title:'Rendicontazione, debrief e report finale',phase:'Report',owner:'Direttivo',days:-10}
  ];

  if(type==='YEP' || type==='Festival') return yep;
  if(type==='Workshop') return workshop;
  return commonShow;
}

function PO_getSiteEvent_(siteEventId) {
  if(typeof gestAdminEvents_!=='function') throw new Error('gestionale_non_disponibile');
  const ev=gestAdminEvents_().find(e=>String(e.id||'')===String(siteEventId||''));
  if(!ev) throw new Error('evento_gestionale_non_trovato');
  return ev;
}

function PO_generatePlanForSiteEvent(email, siteEventId, dateIndex) {
  PO_requireEditor_(email);
  const ev=PO_getSiteEvent_(siteEventId);
  const dates=Array.isArray(ev.dates)&&ev.dates.length?ev.dates:[];
  const ix=Math.max(0,Number(dateIndex)||0);
  if(!dates[ix]) throw new Error('data_evento_non_trovata');

  const parsed=PO_parseSiteDate_(dates[ix].label);
  if(!parsed.date) throw new Error('data_evento_non_definita');

  const type=PO_inferSiteType_(ev);
  const parentEventId=String(ev.id||'')+'#'+ix;
  const templates=PO_planTemplates_(type);
  const existing=PO_listTasks().filter(t=>t.parentEventId===parentEventId);
  const existingKeys={}; existing.forEach(t=>existingKeys[t.templateKey]=true);

  let created=0, skipped=0;
  templates.forEach(function(t){
    if(existingKeys[t.key]) { skipped++; return; }
    const d=new Date(parsed.date+'T12:00:00');
    d.setDate(d.getDate()-Number(t.days||0));
    PO_saveTask(email,{
      title:t.title+' · '+String(ev.title||''),
      type:type==='Festival'?'YEP':type,
      phase:t.phase||'',
      teacher:t.owner||'',
      team:t.owner||'',
      date:PO_dateISO_(d),
      start:'09:00',
      end:'10:00',
      venue:String(ev.venue||''),
      visibility:'internal',
      taskStatus:'todo',
      repeat:'none',
      notes:'Generato automaticamente dal Gestionale Eventi: '+String(ev.title||'')+'.',
      reminderDays:6,
      reminderChannel:'email',
      source:'generated',
      parentEventId:parentEventId,
      templateKey:t.key
    });
    created++;
  });

  return {ok:true, created:created, skipped:skipped, total:templates.length, eventTitle:String(ev.title||''), eventDate:parsed.date, type:type};
}

function PO_saveTask(email,e) {
  PO_requireEditor_(email);
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
    googleEventId:String(e.googleEventId||''),source:String(e.source||'plan'),parentEventId:String(e.parentEventId||''),templateKey:String(e.templateKey||''),
    attendeeIdsJSON:JSON.stringify(Array.isArray(e.attendeeIds)?e.attendeeIds:[]),meetingChannel:String(e.meetingChannel||'calendar'),
    meetingReminderDays:Number(e.meetingReminderDays||0),updatedAt:new Date()
  };

  // Preserve reminder history and existing Google ID on update.
  const idIx=h.indexOf('id'); let row=-1, old=null;
  for(let i=1;i<values.length;i++) if(String(values[i][idIx])===id){row=i+1;old={};h.forEach((k,j)=>old[k]=values[i][j]);break;}
  if(old){
    obj.reminderKeyInviati=String(old.reminderKeyInviati||'');
    if(!obj.googleEventId) obj.googleEventId=String(old.googleEventId||'');
  }

  obj.googleEventId=PO_syncTaskToCalendar_(obj);
  if(String(obj.tipo)==='Riunione' && e.notifyAttendees) PO_notifyMeetingAttendees_(obj);
  const arr=h.map(k=>Object.prototype.hasOwnProperty.call(obj,k)?obj[k]:'');
  if(row>0) sh.getRange(row,1,1,h.length).setValues([arr]); else sh.appendRow(arr);
  PO_audit_(email,row>0?'modifica':'crea','attivita',id,obj.titolo);
  return PO_listTasks().find(x=>x.id===id);
}

function PO_deleteTask(email,id) {
  PO_requireEditor_(email);
  const sh=PO_getTasksSheet_(), values=sh.getDataRange().getValues(), h=values[0].map(String);
  const idIx=h.indexOf('id'), gIx=h.indexOf('googleEventId');
  for(let i=1;i<values.length;i++){
    if(String(values[i][idIx])!==String(id)) continue;
    const gid=String(values[i][gIx]||'');
    if(gid){try{const ev=PO_calendar_().getEventById(gid);if(ev)ev.deleteEvent();}catch(e){}}
    PO_audit_(email,'elimina','attivita',id,String(values[i][h.indexOf('titolo')]||''));sh.deleteRow(i+1); return true;
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

  const attendeeIds=PO_parseJson_(task.attendeeIdsJSON||'[]',[]);
  const guests=attendeeIds.map(PO_findPersonById_).filter(Boolean).map(p=>p.email).filter(Boolean);

  if(ev){
    ev.setTitle(task.titolo||'Attività Artyou');ev.setTime(start,end);ev.setLocation(task.luogo||'');ev.setDescription(desc);
    if(String(task.tipo||'')==='Riunione'){
      try{
        const current=(ev.getGuestList?ev.getGuestList():[]).map(g=>String(g.getEmail?g.getEmail():'').toLowerCase()).filter(Boolean);
        current.forEach(mail=>{if(guests.map(x=>x.toLowerCase()).indexOf(mail)===-1&&ev.removeGuest)ev.removeGuest(mail)});
        guests.forEach(mail=>{if(current.indexOf(mail.toLowerCase())===-1&&ev.addGuest)ev.addGuest(mail)});
      }catch(e){}
    }
  } else {
    const opts={description:desc,location:task.luogo||''};
    if(String(task.tipo||'')==='Riunione'&&guests.length){opts.guests=guests.join(',');opts.sendInvites=true;}
    ev=cal.createEvent(task.titolo||'Attività Artyou',start,end,opts);
  }
  return ev.getId();
}


function PO_notifyMeetingAttendees_(task){
  const ids=PO_parseJson_(task.attendeeIdsJSON||'[]',[]);
  const people=ids.map(PO_findPersonById_).filter(Boolean);
  const channel=String(task.meetingChannel||'calendar').toLowerCase();
  const when=Utilities.formatDate(new Date(String(task.data)+'T'+(task.oraInizio||'09:00')+':00'),Session.getScriptTimeZone(),'dd/MM/yyyy HH:mm');
  const body=['Riunione Artyou','',task.titolo||'Riunione','Quando: '+when,'Dove: '+(task.luogo||'-'),'',task.note||''].join('\n');
  people.forEach(function(p){
    if((channel==='email'||channel==='both')&&p.email&&p.emailOn){
      MailApp.sendEmail({to:p.email,subject:'Artyou · Riunione: '+(task.titolo||''),body:body,name:'Artyou Roma'});
    }
    if((channel==='whatsapp'||channel==='both')&&p.phone&&p.whatsappOn){
      PO_sendWhatsAppReminder_(p,{titolo:task.titolo||'Riunione'},body);
    }
  });
}
function PO_sendMeetingReminder_(task,daysLeft){
  const ids=PO_parseJson_(task.attendeeIdsJSON||'[]',[]);
  if(!ids.length)return false;
  const people=ids.map(PO_findPersonById_).filter(p=>p&&p.active);
  const channel=String(task.meetingChannel||'calendar').toLowerCase();
  const when=Utilities.formatDate(new Date(String(task.data)+'T'+(task.oraInizio||'09:00')+':00'),Session.getScriptTimeZone(),'dd/MM/yyyy HH:mm');
  const timing=daysLeft===0?'oggi':(daysLeft===1?'domani':'tra '+daysLeft+' giorni');
  const body=['Promemoria riunione Artyou','',task.titolo||'Riunione','Quando: '+when+' ('+timing+')','Dove: '+(task.luogo||'-'),'',task.note||''].join('\n');
  let sent=false;
  people.forEach(function(p){
    if((channel==='calendar'||channel==='email'||channel==='both')&&p.email&&p.emailOn){
      MailApp.sendEmail({to:p.email,subject:'Artyou · Promemoria riunione: '+(task.titolo||''),body:body,name:'Artyou Roma'});sent=true;
    }
    if((channel==='whatsapp'||channel==='both')&&p.phone&&p.whatsappOn){
      sent=PO_sendWhatsAppReminder_(p,{titolo:task.titolo||'Riunione'},body)||sent;
    }
  });
  return sent;
}

function PO_runDailyReminders() {
  const sh=PO_getTasksSheet_(), values=sh.getDataRange().getValues();
  if(values.length<2)return;
  const headers=values[0].map(String), ix=Object.fromEntries(headers.map((h,i)=>[h,i])), today=new Date();
  for(let r=1;r<values.length;r++){
    const row=values[r]; if(!row[ix.id]||!row[ix.data])continue;
    const state=String(row[ix.stato]||'').toLowerCase(); if(state==='fatto'||state==='done')continue;
    const due=new Date(row[ix.data]), daysLeft=PO_daysBetween_(today,due), configuredDays=Number(row[ix.reminderDays]||6);
    const sentKeys=String(row[ix.reminderKeyInviati]||'').split(',').filter(Boolean);
    const task={};headers.forEach((h,i)=>task[h]=row[i]);
    const meetingKey='meeting_'+String(daysLeft), meetingDays=Number(task.meetingReminderDays||0);
    if(String(task.tipo||'')==='Riunione' && meetingDays>0 && daysLeft===meetingDays && sentKeys.indexOf(meetingKey)===-1){
      if(PO_sendMeetingReminder_(task,daysLeft)){sentKeys.push(meetingKey);sh.getRange(r+1,ix.reminderKeyInviati+1).setValue(sentKeys.join(','));}
    }
    const schedule=[...new Set([configuredDays,3,1,0,-1])]; if(!schedule.includes(daysLeft))continue;
    const key='task_'+String(daysLeft); if(sentKeys.includes(key))continue;
    const person=PO_findPersonById_(task.responsabileId); if(!person)continue;
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
