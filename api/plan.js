const { verifyGoogleIdToken, bearerToken } = require("../lib/google-auth");
const { query, transaction } = require("../lib/db");
const {
  rateLimit,
  applyRateLimitHeaders,
  rejectRateLimited,
  sameOrigin,
  setSecurityHeaders
} = require("../lib/security");

const APPS_SCRIPT_URL = String(process.env.ARTYOU_APPS_SCRIPT_URL || "").trim();

function parseMeta(v) {
  if (!v) return {};
  if (typeof v === "object") return v;
  try { return JSON.parse(String(v)); } catch (_) { return {}; }
}

function bool(v) {
  return v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";
}

function pad(n) { return String(n).padStart(2, "0"); }

function isoDate(v) {
  if (!v) return "";
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.getUTCFullYear() + "-" + pad(v.getUTCMonth() + 1) + "-" + pad(v.getUTCDate());
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + "-" + m[2] + "-" + m[3] : "";
}

function hhmm(v) {
  if (!v) return "";
  if (v instanceof Date && !isNaN(v.getTime())) return pad(v.getUTCHours()) + ":" + pad(v.getUTCMinutes());
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? pad(Number(m[1])) + ":" + m[2] : "";
}

function parseDateLabel(label) {
  const s = String(label || "").trim();
  if (!s) return { date:"", start:"" };
  let m = s.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  const tm = s.match(/(?:^|[^0-9])(\d{1,2}):(\d{2})(?:[^0-9]|$)/);
  if (m) return { date:m[1] + "-" + pad(Number(m[2])) + "-" + pad(Number(m[3])), start:tm ? pad(Number(tm[1])) + ":" + tm[2] : "" };
  m = s.match(/(?:^|[^0-9])(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})(?:[^0-9]|$)/);
  if (m) return { date:m[3] + "-" + pad(Number(m[2])) + "-" + pad(Number(m[1])), start:tm ? pad(Number(tm[1])) + ":" + tm[2] : "" };
  const months = {gennaio:1,febbraio:2,marzo:3,aprile:4,maggio:5,giugno:6,luglio:7,agosto:8,settembre:9,ottobre:10,novembre:11,dicembre:12};
  m = s.toLowerCase().match(/(?:^|\s)(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(20\d{2}))?/i);
  if (!m) return { date:"", start:tm ? pad(Number(tm[1])) + ":" + tm[2] : "" };
  const now = new Date();
  let year = m[3] ? Number(m[3]) : now.getUTCFullYear();
  const month = months[m[2].toLowerCase()];
  if (!m[3]) {
    const candidate = new Date(Date.UTC(year, month - 1, Number(m[1])));
    if ((candidate - now) / 86400000 < -180) year++;
  }
  return { date:year + "-" + pad(month) + "-" + pad(Number(m[1])), start:tm ? pad(Number(tm[1])) + ":" + tm[2] : "" };
}

function dbDateTime(date, time) {
  if (!date) return null;
  const t = /^\d{2}:\d{2}$/.test(String(time || "")) ? String(time) : "09:00";
  return String(date) + " " + t + ":00";
}

function accessLevel(role) {
  if (role === "admin") return "Amministratore";
  if (role === "staff") return "Staff";
  return "Docente";
}

async function authorizedUser(identity) {
  const rows = await query(
    "SELECT id,email,display_name,role,active,metadata FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1",
    [identity.email]
  );
  const u = rows && rows[0];
  if (!u || !u.active) throw new Error("accesso_non_autorizzato");
  return u;
}

function requireEditor(user) {
  if (!user || (user.role !== "admin" && user.role !== "staff")) throw new Error("permesso_modifica_richiesto");
}

async function parseBody(req) {
  let body = req.body;
  if (body === undefined || body === null) body = {};
  if (typeof body === "string") {
    if (Buffer.byteLength(body, "utf8") > 128 * 1024) throw new Error("payload_too_large");
    try { body = JSON.parse(body); } catch (_) { throw new Error("json_non_valido"); }
  }
  return body || {};
}

async function legacyCall(action, credential, payload) {
  if (!APPS_SCRIPT_URL || !credential) return null;
  try {
    let url = APPS_SCRIPT_URL + "?action=" + encodeURIComponent("po_" + action) + "&token=" + encodeURIComponent(credential) + "&_=" + Date.now();
    const options = { method:payload ? "POST" : "GET", redirect:"follow", headers:{} };
    if (payload) {
      const body = Object.assign({}, payload, { action:"po_" + action, token:credential });
      options.headers["Content-Type"] = "text/plain;charset=utf-8";
      options.body = JSON.stringify(body);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let upstream;
    try { upstream = await fetch(url, Object.assign({}, options, { signal:controller.signal })); }
    finally { clearTimeout(timer); }
    const text = await upstream.text();
    try { return JSON.parse(text); } catch (_) { return null; }
  } catch (e) {
    console.error("PLAN_LEGACY_MIRROR_ERROR", action, String(e && e.message || e));
    return null;
  }
}

function taskRowToEvent(row) {
  const m = parseMeta(row.metadata);
  const date = m.date || isoDate(row.due_at);
  const start = m.start || hhmm(row.due_at);
  return {
    id:"task_" + row.id,
    title:String(row.title || ""),
    type:String(m.type || row.area || "Altro"),
    phase:String(m.phase || ""),
    responsibleContactId:m.responsibleContactId ? String(m.responsibleContactId) : (row.owner_user_id ? String(row.owner_user_id) : ""),
    teacher:String(m.teacher || row.owner_name || ""),
    team:String(m.team || m.teacher || row.owner_name || ""),
    date:date,
    start:start,
    end:String(m.end || ""),
    venue:String(m.venue || ""),
    visibility:String(m.visibility || "internal"),
    taskStatus:String(m.taskStatus || row.status || "todo").toLowerCase(),
    repeat:String(m.repeat || "none"),
    notes:String(m.notes || row.description || ""),
    publicTitle:String(m.publicTitle || ""),
    price:m.price == null ? null : Number(m.price),
    capacity:m.capacity == null ? null : Number(m.capacity),
    slug:String(m.slug || ""),
    publishSite:bool(m.publishSite),
    courseStart:String(m.courseStart || ""),
    coursePreset:String(m.coursePreset || ""),
    yepDate:String(m.yepDate || ""),
    yepPreset:String(m.yepPreset || ""),
    reminderDays:Number(m.reminderDays || 0),
    reminderChannel:String(m.reminderChannel || "email"),
    googleEventId:String(row.google_calendar_event_id || ""),
    source:String(m.source || "plan"),
    parentEventId:String(m.parentEventId || ""),
    templateKey:String(m.templateKey || ""),
    attendeeIds:Array.isArray(m.attendeeIds) ? m.attendeeIds.map(String) : [],
    meetingChannel:String(m.meetingChannel || "calendar"),
    meetingReminderDays:Number(m.meetingReminderDays || 0)
  };
}

async function listStoredTasks(from, to) {
  const params = [];
  let where = "1=1";
  if (from) { where += " AND (ot.due_at IS NULL OR ot.due_at>=?)"; params.push(from + " 00:00:00"); }
  if (to) { where += " AND (ot.due_at IS NULL OR ot.due_at<=?)"; params.push(to + " 23:59:59"); }
  const rows = await query(
    "SELECT ot.*,u.display_name AS owner_name FROM operational_tasks ot LEFT JOIN users u ON u.id=ot.owner_user_id WHERE " + where + " ORDER BY ot.due_at,ot.id",
    params
  );
  return rows.map(taskRowToEvent);
}

async function listPeople() {
  const rows = await query("SELECT id,email,display_name,role,active,metadata FROM users ORDER BY active DESC,display_name,email");
  return rows.map(function(u) {
    const m = parseMeta(u.metadata);
    return {
      id:String(u.id),
      name:String(u.display_name || u.email || ""),
      kind:String(m.kind || (u.role === "teacher" ? "Docente" : "Staff")),
      role:String(m.role || ""),
      accessLevel:accessLevel(u.role),
      skills:Array.isArray(m.skills) ? m.skills : [],
      email:String(u.email || ""),
      phone:String(m.phone || ""),
      emailOn:m.emailOn !== false,
      whatsappOn:!!m.whatsappOn,
      active:!!u.active,
      notes:String(m.notes || "")
    };
  });
}

async function listSiteEvents(from, to) {
  const params = [];
  let where = "e.active=1 AND (ed.id IS NULL OR ed.active=1)";
  if (from) { where += " AND (ed.starts_at IS NULL OR ed.starts_at>=?)"; params.push(from + " 00:00:00"); }
  if (to) { where += " AND (ed.starts_at IS NULL OR ed.starts_at<=?)"; params.push(to + " 23:59:59"); }
  const rows = await query(
    "SELECT e.id AS event_id,e.slug,e.title,e.category,e.event_type,e.description,e.venue,e.price,e.capacity,e.metadata AS event_metadata," +
    " ed.id AS date_id,ed.starts_at,ed.date_label,ed.capacity_override,ed.price_override,ed.metadata AS date_metadata" +
    " FROM events e LEFT JOIN event_dates ed ON ed.event_id=e.id WHERE " + where + " ORDER BY e.sort_order,e.id,ed.starts_at,ed.id",
    params
  );
  return rows.map(function(r, index) {
    const em = parseMeta(r.event_metadata);
    const parsed = r.starts_at ? {date:isoDate(r.starts_at),start:hhmm(r.starts_at)} : parseDateLabel(r.date_label);
    const typeRaw = String(r.event_type || r.category || "").toLowerCase();
    let type = "Spettacolo";
    if (typeRaw.includes("yep")) type = "YEP";
    else if (typeRaw.includes("festival") || String(r.slug || "").toLowerCase().includes("rif")) type = "Festival";
    else if (typeRaw.includes("workshop") || typeRaw.includes("workshow")) type = "Workshop";
    return {
      id:"site_" + r.event_id + "_" + (r.date_id || index),
      siteEventId:String(r.event_id),
      siteDateIndex:0,
      title:String(r.title || r.slug || "Evento"),
      type:type,
      phase:"Evento dal Gestionale",
      teacher:"",
      team:"",
      date:parsed.date,
      start:parsed.start || String(em.ora || ""),
      end:"",
      venue:String(r.venue || ""),
      visibility:"public",
      taskStatus:"todo",
      repeat:"none",
      notes:"Evento già presente nel Gestionale Eventi MySQL.",
      publicTitle:String(r.title || ""),
      price:r.price_override == null ? (r.price == null ? null : Number(r.price)) : Number(r.price_override),
      capacity:r.capacity_override == null ? Number(r.capacity || 0) : Number(r.capacity_override),
      slug:String(r.slug || ""),
      publishSite:true,
      reminderDays:0,
      reminderChannel:"email",
      googleEventId:"",
      source:"site",
      siteDateLabel:String(r.date_label || "")
    };
  });
}

async function migrateLegacyIfNeeded(credential) {
  if (!APPS_SCRIPT_URL) return { migrated:false, reason:"legacy_backend_unavailable" };

  // One-time, idempotent migration. MySQL remains the primary store after this marker is written.
  await query(
    "CREATE TABLE IF NOT EXISTS system_migrations (" +
    "migration_key VARCHAR(190) NOT NULL PRIMARY KEY," +
    "completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP," +
    "details JSON NULL" +
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
  );

  const migrationKey = "plan_legacy_tasks_v2";
  const done = await query("SELECT migration_key FROM system_migrations WHERE migration_key=? LIMIT 1", [migrationKey]);
  if (done.length) return { migrated:false, reason:"already_done" };

  const legacy = await legacyCall("list", credential, null);
  if (!legacy || !legacy.ok || !Array.isArray(legacy.events)) {
    throw new Error("migrazione_piano_legacy_non_disponibile");
  }

  // Import only real Piano Operativo tasks. Site events already come from MySQL events/event_dates.
  // Google-only calendar entries stay an external integration and are not treated as database rows.
  const items = legacy.events.filter(function(e) {
    return e && e.id && e.source !== "site" && e.source !== "google";
  });

  let imported = 0, skipped = 0;
  for (const e of items) {
    const legacyId = String(e.id);
    const existing = await query(
      "SELECT id FROM operational_tasks WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.legacyId'))=? LIMIT 1",
      [legacyId]
    );
    if (existing.length) { skipped++; continue; }

    const meta = Object.assign({}, e, { legacyId:legacyId });
    delete meta.id;

    let ownerId = null;
    if (/^\d+$/.test(String(e.responsibleContactId || ""))) {
      const owner = await query("SELECT id FROM users WHERE id=? AND active=1 LIMIT 1", [Number(e.responsibleContactId)]);
      if (owner.length) ownerId = Number(owner[0].id);
    }

    try {
      await query(
        "INSERT INTO operational_tasks (event_id,area,title,description,owner_user_id,due_at,status,google_calendar_event_id,metadata) VALUES (NULL,?,?,?,?,?,?,?,?)",
        [
          String(e.type || "Altro"),
          String(e.title || ""),
          String(e.notes || ""),
          ownerId,
          dbDateTime(e.date, e.start),
          String(e.taskStatus || "todo"),
          String(e.googleEventId || ""),
          JSON.stringify(meta)
        ]
      );
      imported++;
    } catch (err) {
      console.error("PLAN_LEGACY_IMPORT_ITEM_ERROR", legacyId, String(err && err.message || err));
    }
  }

  await query(
    "INSERT INTO system_migrations (migration_key,details) VALUES (?,?)",
    [migrationKey, JSON.stringify({ imported:imported, skipped:skipped, legacyCount:items.length })]
  );
  return { migrated:true, imported:imported, skipped:skipped };
}

async function loadTaskById(id) {
  const rows = await query(
    "SELECT ot.*,u.display_name AS owner_name FROM operational_tasks ot LEFT JOIN users u ON u.id=ot.owner_user_id WHERE ot.id=? LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

function numericTaskId(raw) {
  const m = String(raw || "").match(/^task_(\d+)$/);
  return m ? Number(m[1]) : 0;
}

async function saveTask(user, credential, e) {
  requireEditor(user);
  e = e || {};
  if (!String(e.title || "").trim()) throw new Error("titolo_mancante");
  if (!String(e.date || "").trim()) throw new Error("data_mancante");

  let ownerId = null;
  if (/^\d+$/.test(String(e.responsibleContactId || ""))) {
    const rows = await query("SELECT id FROM users WHERE id=? AND active=1 LIMIT 1", [Number(e.responsibleContactId)]);
    if (rows.length) ownerId = Number(rows[0].id);
  }

  const meta = {
    type:String(e.type || "Altro"),
    phase:String(e.phase || ""),
    responsibleContactId:ownerId ? String(ownerId) : "",
    teacher:String(e.teacher || e.team || ""),
    team:String(e.team || e.teacher || ""),
    date:String(e.date || ""),
    start:String(e.start || ""),
    end:String(e.end || ""),
    venue:String(e.venue || ""),
    visibility:String(e.visibility || "internal"),
    taskStatus:String(e.taskStatus || "todo"),
    repeat:String(e.repeat || "none"),
    notes:String(e.notes || ""),
    publicTitle:String(e.publicTitle || ""),
    price:e.price == null ? null : Number(e.price),
    capacity:e.capacity == null ? null : Number(e.capacity),
    slug:String(e.slug || ""),
    publishSite:!!e.publishSite,
    courseStart:String(e.courseStart || ""),
    coursePreset:String(e.coursePreset || ""),
    yepDate:String(e.yepDate || ""),
    yepPreset:String(e.yepPreset || ""),
    reminderDays:Number(e.reminderDays || 0),
    reminderChannel:String(e.reminderChannel || "email"),
    source:String(e.source || "plan"),
    parentEventId:String(e.parentEventId || ""),
    templateKey:String(e.templateKey || ""),
    attendeeIds:Array.isArray(e.attendeeIds) ? e.attendeeIds.map(String) : [],
    meetingChannel:String(e.meetingChannel || "calendar"),
    meetingReminderDays:Number(e.meetingReminderDays || 0)
  };

  let id = numericTaskId(e.id);
  if (id) {
    const current = await loadTaskById(id);
    if (!current) throw new Error("attivita_non_trovata");
    const oldMeta = parseMeta(current.metadata);
    if (oldMeta.legacyId) meta.legacyId = oldMeta.legacyId;
    await query(
      "UPDATE operational_tasks SET area=?,title=?,description=?,owner_user_id=?,due_at=?,status=?,metadata=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [
        meta.type, String(e.title).trim(), meta.notes, ownerId, dbDateTime(meta.date, meta.start),
        meta.taskStatus, JSON.stringify(meta), id
      ]
    );
  } else {
    const result = await query(
      "INSERT INTO operational_tasks (event_id,area,title,description,owner_user_id,due_at,status,google_calendar_event_id,metadata) VALUES (NULL,?,?,?,?,?,?,?,?)",
      [meta.type, String(e.title).trim(), meta.notes, ownerId, dbDateTime(meta.date, meta.start), meta.taskStatus, "", JSON.stringify(meta)]
    );
    id = Number(result.insertId);
  }

  const legacyId = meta.legacyId || ("mysql_" + id);
  meta.legacyId = legacyId;
  await query("UPDATE operational_tasks SET metadata=? WHERE id=?", [JSON.stringify(meta), id]);

  const mirrorEvent = Object.assign({}, e, { id:legacyId, responsibleContactId:ownerId ? String(ownerId) : "" });
  const mirrored = await legacyCall("save", credential, {event:mirrorEvent});
  if (mirrored && mirrored.ok && mirrored.event && mirrored.event.googleEventId) {
    await query(
      "UPDATE operational_tasks SET google_calendar_event_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [String(mirrored.event.googleEventId), id]
    );
  }

  const row = await loadTaskById(id);
  return taskRowToEvent(row);
}

async function deleteTask(user, credential, rawId) {
  requireEditor(user);
  const id = numericTaskId(rawId);
  if (!id) throw new Error("attivita_non_trovata");
  const row = await loadTaskById(id);
  if (!row) return true;
  const meta = parseMeta(row.metadata);
  await query("DELETE FROM operational_tasks WHERE id=?", [id]);
  if (meta.legacyId) await legacyCall("delete", credential, {id:String(meta.legacyId)});
  return true;
}

function planTemplates(type) {
  const commonShow = [
    ["format","Scelta format, cast e regia","Direzione","Direzione artistica",45],
    ["venue","Conferma teatro / venue e accordo economico","Produzione","Staff Eventi",40],
    ["communication_launch","Lancio evento: social, newsletter e comunicazione","Comunicazione","Comunicazione",28],
    ["rehearsals","Definizione calendario prove","Prove","Compagnia / Docenti",21],
    ["siae","SIAE, permessi e adempimenti","Amministrazione","Segreteria",14],
    ["tech","Scheda tecnica luci / audio","Tecnica","Staff Eventi",10],
    ["reminder","Reminder comunicazione spettacolo","Comunicazione","Comunicazione",7],
    ["logistics","Check logistica, pagamenti e materiali","Logistica","Staff Eventi",5],
    ["general_rehearsal","Prova generale","Prove","Cast / Responsabile compagnia",2],
    ["final_check","Check finale venue, tecnica e accoglienza","Evento","Staff Eventi",1],
    ["event_day","Coordinamento spettacolo","Evento","Staff Eventi",0],
    ["post","Recap, foto/video e chiusura post-evento","Post evento","Comunicazione",-2]
  ];
  const workshop = [
    ["teacher","Conferma docente e contenuti workshop","Programmazione","Direzione didattica",35],
    ["venue","Conferma sala, orari e capienza","Logistica","Staff Eventi",30],
    ["page","Pubblicazione pagina e apertura iscrizioni","Iscrizioni","Comunicazione",28],
    ["graphics","Grafiche e locandina workshop","Comunicazione","Grafica",25],
    ["launch","Lancio social e newsletter","Comunicazione","Comunicazione",21],
    ["check_sales","Controllo iscritti e andamento vendite","Iscrizioni","Segreteria",10],
    ["reminder","Reminder partecipanti e comunicazione finale","Comunicazione","Comunicazione",5],
    ["materials","Check materiali, sala e necessità docente","Logistica","Staff Eventi",2],
    ["event_day","Accoglienza e coordinamento workshop","Evento","Staff Eventi",0],
    ["feedback","Feedback, foto e follow-up","Post evento","Comunicazione",-2]
  ];
  const yep = [
    ["concept","Definire concept, titolo e linea artistica","Concept","Direzione",90],
    ["budget","Budget preventivo, sponsor e bandi","Budget","Amministrazione",85],
    ["patrocini","Richiesta patrocini e contributi","Istituzioni","Presidenza",80],
    ["venue","Conferma location, sale e permessi","Location","Staff Eventi",75],
    ["call_open","Apertura call artisti / compagnie","Programma","Direzione artistica",70],
    ["call_close","Chiusura call e selezione artisti","Programma","Direzione artistica",55],
    ["program","Programma definitivo","Programma","Direzione",50],
    ["contracts","Accordi artisti, ospitalità e viaggi","Programma","Staff Eventi",45],
    ["identity","Immagine coordinata e materiali grafici","Comunicazione","Grafica",42],
    ["tickets","Apertura biglietteria / iscrizioni","Biglietteria","Segreteria",40],
    ["comms","Piano comunicazione, social e newsletter","Comunicazione","Comunicazione",35],
    ["press","Comunicato stampa e ufficio stampa","Comunicazione","Comunicazione",28],
    ["volunteers","Reclutamento e formazione volontari","Persone","Staff Eventi",21],
    ["safety","SIAE, assicurazioni e piano sicurezza","Sicurezza","Segreteria",18],
    ["tech","Raccolta schede tecniche per giornata","Tecnica","Staff Eventi",14],
    ["runshow","Riunione operativa e run of show","Coordinamento","Direttivo",7],
    ["participant_info","Invio informazioni pratiche ai partecipanti","Comunicazione","Comunicazione",5],
    ["brief","Brief finale staff e docenti","Coordinamento","Direzione",2],
    ["setup","Allestimento, segnaletica e check spazi","Allestimento","Staff Eventi",1],
    ["event_day","Coordinamento giornata / festival","Evento","Staff Eventi",0],
    ["teardown","Smontaggio e riconsegna spazi","Post evento","Staff Eventi",-1],
    ["thanks","Ringraziamenti e questionario feedback","Post evento","Comunicazione",-2],
    ["payments","Pagamenti artisti e fornitori","Post evento","Amministrazione",-5],
    ["recap","Carosello foto e Reel Recap","Post evento","Comunicazione",-7],
    ["report","Rendicontazione, debrief e report finale","Report","Direttivo",-10]
  ];
  const source = (type === "YEP" || type === "Festival") ? yep : (type === "Workshop" ? workshop : commonShow);
  return source.map(function(x) { return {key:x[0],title:x[1],phase:x[2],owner:x[3],days:x[4]}; });
}

async function generatePlan(user, eventId, dateIndex) {
  requireEditor(user);
  const evRows = await query("SELECT id,slug,title,event_type,category,venue FROM events WHERE id=? AND active=1 LIMIT 1", [Number(eventId)]);
  if (!evRows.length) throw new Error("evento_gestionale_non_trovato");
  const ev = evRows[0];
  const dates = await query("SELECT id,starts_at,date_label FROM event_dates WHERE event_id=? AND active=1 ORDER BY starts_at,id", [ev.id]);
  const ix = Math.max(0, Number(dateIndex || 0));
  const drow = dates[ix] || dates[0];
  if (!drow) throw new Error("data_evento_non_trovata");
  const parsed = drow.starts_at ? {date:isoDate(drow.starts_at)} : parseDateLabel(drow.date_label);
  if (!parsed.date) throw new Error("data_evento_non_definita");

  const raw = (String(ev.event_type || "") + " " + String(ev.category || "") + " " + String(ev.slug || "")).toLowerCase();
  let type = "Spettacolo";
  if (raw.includes("yep")) type = "YEP";
  else if (raw.includes("festival") || raw.includes("rif")) type = "Festival";
  else if (raw.includes("workshop") || raw.includes("workshow")) type = "Workshop";

  const parentEventId = String(ev.id) + "#" + ix;
  const templates = planTemplates(type);
  let created = 0, skipped = 0;

  for (const t of templates) {
    const existing = await query(
      "SELECT id FROM operational_tasks WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.parentEventId'))=? AND JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.templateKey'))=? LIMIT 1",
      [parentEventId, t.key]
    );
    if (existing.length) { skipped++; continue; }

    const due = new Date(parsed.date + "T12:00:00Z");
    due.setUTCDate(due.getUTCDate() - Number(t.days || 0));
    const date = isoDate(due);
    const meta = {
      type:type, phase:t.phase, responsibleContactId:"", teacher:t.owner, team:t.owner,
      date:date, start:"09:00", end:"10:00", venue:String(ev.venue || ""),
      visibility:"internal", taskStatus:"todo", repeat:"none",
      notes:"Generato automaticamente dal Gestionale Eventi MySQL: " + String(ev.title || "") + ".",
      publicTitle:"", price:null, capacity:null, slug:"", publishSite:false,
      courseStart:"", coursePreset:"", yepDate:"", yepPreset:"",
      reminderDays:6, reminderChannel:"email", source:"generated",
      parentEventId:parentEventId, templateKey:t.key, attendeeIds:[],
      meetingChannel:"calendar", meetingReminderDays:0
    };
    const result = await query(
      "INSERT INTO operational_tasks (event_id,area,title,description,owner_user_id,due_at,status,google_calendar_event_id,metadata) VALUES (?,?,?,?,NULL,?,?,?,?)",
      [
        ev.id, type, t.title + " · " + String(ev.title || ""),
        meta.notes, dbDateTime(date, "09:00"), "todo", "", JSON.stringify(meta)
      ]
    );
    meta.legacyId = "mysql_" + Number(result.insertId);
    await query("UPDATE operational_tasks SET metadata=? WHERE id=?", [JSON.stringify(meta), Number(result.insertId)]);
    created++;
  }
  return {ok:true,created:created,skipped:skipped,total:templates.length,eventTitle:String(ev.title || ""),eventDate:parsed.date,type:type};
}

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);
  const method = String(req.method || "GET").toUpperCase();
  if (!["GET","HEAD","POST"].includes(method)) {
    res.setHeader("Allow","GET, HEAD, POST");
    return res.status(405).json({ok:false,errore:"method_not_allowed"});
  }
  if (!sameOrigin(req)) return res.status(403).json({ok:false,errore:"origin_non_consentita"});

  const limit = rateLimit(req, {key:"plan-mysql",limit:180,windowMs:60*1000});
  applyRateLimitHeaders(res, limit);
  if (!limit.ok) return rejectRateLimited(res, limit);

  try {
    const credential = bearerToken(req);
    if (!credential || credential.length > 8192) return res.status(401).json({ok:false,errore:"google_login_required"});
    const identity = await verifyGoogleIdToken(credential);
    const user = await authorizedUser(identity);

    const rawUrl = String(req.url || "");
    const qIndex = rawUrl.indexOf("?");
    const params = new URLSearchParams(qIndex >= 0 ? rawUrl.slice(qIndex + 1) : "");
    const body = method === "POST" ? await parseBody(req) : {};
    const action = String(body.action || params.get("action") || "").replace(/^po_/,"");

    if (action === "people") return res.status(200).json({ok:true,people:await listPeople()});

    if (action === "list") {
      await migrateLegacyIfNeeded(credential);
      const from = String(body.from || params.get("from") || "");
      const to = String(body.to || params.get("to") || "");
      const stored = await listStoredTasks(from,to);
      const site = await listSiteEvents(from,to);
      return res.status(200).json({ok:true,events:stored.concat(site),storage:"mysql",calendarMirror:!!APPS_SCRIPT_URL});
    }

    if (action === "save") {
      const event = await saveTask(user, credential, body.event || {});
      return res.status(200).json({ok:true,event:event,storage:"mysql"});
    }

    if (action === "delete") {
      await deleteTask(user, credential, body.id);
      return res.status(200).json({ok:true,storage:"mysql"});
    }

    if (action === "generate_plan") {
      const out = await generatePlan(user, body.siteEventId, body.siteDateIndex);
      out.storage = "mysql";
      return res.status(200).json(out);
    }

    return res.status(400).json({ok:false,errore:"azione_non_valida"});
  } catch (err) {
    const code = String(err && err.message || "errore");
    console.error("PLAN_MYSQL_ERROR", code);
    if (code === "accesso_non_autorizzato") return res.status(403).json({ok:false,errore:code});
    if (code === "permesso_modifica_richiesto") return res.status(403).json({ok:false,errore:code});
    if (code === "payload_too_large") return res.status(413).json({ok:false,errore:code});
    if (code === "json_non_valido" || /_mancante$/.test(code) || /_non_trov/.test(code)) return res.status(400).json({ok:false,errore:code});
    if (/google_/.test(code)) return res.status(401).json({ok:false,errore:"autenticazione_non_valida"});
    return res.status(503).json({ok:false,errore:"mysql_unavailable"});
  }
};
