// Estratto da calendario-docenti.html (audit 10/10/2026): niente script inline, così la CSP delle aree riservate può escludere unsafe-inline.
(function(){
"use strict";
var endpoint=window.ARTYOU_CALENDAR_ENDPOINT||"";
var current=new Date();current.setDate(1);
var events=[];
var email="",currentSession=null,currentAccess="Docente",canEdit=false;
var LS="artyouCalendarDemoEvents_v1";var PEOPLE_LS="artyouCalendarPeople_v1";var boardFilter="all";var people=[];var linkedDraft=[];var meetingSelected=[];var planSelectionMode=false;var selectedPlanIds=new Set();

function $(id){return document.getElementById(id)}
function isoDate(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function escapeHtml(s){return String(s||"").replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function slugify(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}
function enabledTypes(){return [].slice.call(document.querySelectorAll(".type-filter:checked")).map(function(x){return x.value})}
function visibleEvents(){var ok=enabledTypes();return events.filter(function(e){return ok.indexOf(e.type||"Altro")!==-1})}
function loadDemo(){try{events=JSON.parse(localStorage.getItem(LS)||"[]")}catch(e){events=[]}}
function saveDemo(){localStorage.setItem(LS,JSON.stringify(events))}
function loadPeople(){
  if(endpoint&&ArtyouGoogleAuth.getSession()){
    return api("people").then(function(r){
      if(!r||!r.ok)throw new Error((r&&r.errore)||"Errore anagrafiche");
      people=(r.people||[]).filter(function(p){return p.active!==false});
      try{sessionStorage.setItem(PEOPLE_LS,JSON.stringify(people))}catch(e){}
      renderPeople();refreshPeopleSelect();renderMeetingPeople();
      return people;
    }).catch(function(err){
      try{people=JSON.parse(sessionStorage.getItem(PEOPLE_LS)||"[]")}catch(e){people=[]}
      people=(people||[]).filter(function(p){return p.active!==false});
      renderPeople();refreshPeopleSelect();renderMeetingPeople();
      setSync("Anagrafica non aggiornata: "+String(err&&err.message||err),"warn");
      return people
    })
  }
  try{people=JSON.parse(sessionStorage.getItem(PEOPLE_LS)||"[]")}catch(e){people=[]}
  renderPeople();refreshPeopleSelect();renderMeetingPeople();return Promise.resolve(people)
}
function savePeople(){sessionStorage.setItem(PEOPLE_LS,JSON.stringify(people));renderPeople();refreshPeopleSelect()}function renderPeople(){var box=$("peopleList");if(!box)return;box.innerHTML="";if(!people.length){box.innerHTML='<div class="mini">Nessun responsabile registrato.</div>';return}people.forEach(function(p){var row=document.createElement("div");row.className="person-row";row.innerHTML='<div><strong>'+escapeHtml(p.name)+'</strong><div class="mini">'+escapeHtml(p.role||"")+'</div></div><div><div class="mini">'+escapeHtml(p.email||"")+'</div><div class="mini">'+escapeHtml(p.phone||"")+'</div></div><button class="btn danger">Elimina</button>';row.querySelector("button").onclick=function(){people=people.filter(function(x){return x.id!==p.id});savePeople()};box.appendChild(row)})}function refreshPeopleSelect(){var sel=$("teacher");if(!sel)return;var current=sel.value;sel.innerHTML='<option value="">Da assegnare</option>';people.filter(function(p){return p.active!==false}).forEach(function(p){var o=document.createElement("option");o.value=p.id;o.textContent=p.name+(p.role?" · "+p.role:"");sel.appendChild(o)});if(current&&people.some(function(p){return String(p.id)===String(current)}))sel.value=current}function findPersonById(id){return people.find(function(p){return String(p.id)===String(id||"")})||null}function findPersonByName(name){name=String(name||"").trim().toLowerCase();return people.find(function(p){return String(p.name||"").trim().toLowerCase()===name})||null}
function renderMeetingPeople(){
  var box=$("meetingPeople");if(!box)return;box.innerHTML="";
  var active=people.filter(function(p){return p.active!==false});
  if(!active.length){box.innerHTML='<div class="mini">Prima registra i partecipanti dal pulsante Responsabili.</div>';return}
  active.forEach(function(p){
    var lab=document.createElement("label");lab.className="meeting-person";
    lab.innerHTML='<input type="checkbox" value="'+escapeHtml(p.id)+'" '+(meetingSelected.indexOf(p.id)!==-1?'checked':'')+'> <span><strong>'+escapeHtml(p.name)+'</strong>'+(p.role?'<br><span class="mini">'+escapeHtml(p.role)+'</span>':'')+'</span>';
    lab.querySelector("input").onchange=function(){if(this.checked){if(meetingSelected.indexOf(p.id)===-1)meetingSelected.push(p.id)}else meetingSelected=meetingSelected.filter(function(id){return id!==p.id})};
    box.appendChild(lab)
  })
}
function setMeetingSelection(ids){meetingSelected=Array.isArray(ids)?ids.slice():[];renderMeetingPeople()}
function linkedTaskTypes(){return ["Spettacolo","Workshop","Festival","YEP"]}
function linkedTemplates(type){
  if(type==="YEP"||type==="Festival")return[
    ["Immagine coordinata / locandina",-42],["Piano comunicazione social",-35],["Comunicato stampa",-28],["SIAE, assicurazioni e sicurezza",-18],["Schede tecniche",-14],["Riunione operativa / run of show",-7],["Brief staff e docenti",-2],["Check allestimento e segnaletica",-1],["Coordinamento giornata",0],["Carosello foto / Reel Recap",7]
  ];
  if(type==="Workshop")return[
    ["Conferma docente e contenuti",-35],["Pagina e apertura iscrizioni",-28],["Locandina / grafiche",-25],["Lancio social e newsletter",-21],["Controllo iscritti",-10],["Reminder partecipanti",-5],["Check materiali e sala",-2],["Accoglienza e coordinamento",0],["Feedback e recap",2]
  ];
  return[
    ["Conferma venue / accordo economico",-40],["Locandina spettacolo",-30],["Lancio social e newsletter",-28],["Calendario prove",-21],["SIAE e permessi",-14],["Check tecnico luci / audio",-10],["Reminder comunicazione",-7],["Check logistica",-5],["Prova generale",-2],["Check finale",-1],["Coordinamento spettacolo",0],["Recap foto / video",2]
  ]
}
function addLinkedTask(data){data=data||{};linkedDraft.push({id:data.id||("sub_"+Date.now()+"_"+Math.random().toString(36).slice(2,6)),title:data.title||"",responsibleContactId:data.responsibleContactId||"",date:data.date||"",reminderChannel:data.reminderChannel||"email"});renderLinkedTasks()}
function renderLinkedTasks(){
  var box=$("linkedTasksList");if(!box)return;box.innerHTML="";
  if(!linkedDraft.length){box.innerHTML='<div class="mini">Nessun compito collegato. Puoi aggiungerne uno oppure generare quelli standard.</div>';return}
  linkedDraft.forEach(function(t,idx){
    var row=document.createElement("div");row.className="linked-row";
    var opts='<option value="">Da assegnare</option>'+people.filter(function(p){return p.active!==false}).map(function(p){return '<option value="'+escapeHtml(p.id)+'" '+(p.id===t.responsibleContactId?'selected':'')+'>'+escapeHtml(p.name)+(p.role?' · '+escapeHtml(p.role):'')+'</option>'}).join("");
    row.innerHTML='<label class="task-name">Cosa fare<input class="lt-title" value="'+escapeHtml(t.title)+'" placeholder="Es. Locandina spettacolo"></label><label>Responsabile<select class="lt-owner">'+opts+'</select></label><label>Entro quando<input class="lt-date" type="date" value="'+escapeHtml(t.date)+'"></label><label>Promemoria<select class="lt-channel"><option value="email" '+(t.reminderChannel==="email"?"selected":"")+'>Email</option><option value="whatsapp" '+(t.reminderChannel==="whatsapp"?"selected":"")+'>WhatsApp</option><option value="both" '+(t.reminderChannel==="both"?"selected":"")+'>Email + WhatsApp</option></select></label><button type="button" class="btn danger remove-linked">×</button>';
    row.querySelector(".lt-title").oninput=function(){t.title=this.value};
    row.querySelector(".lt-owner").onchange=function(){t.responsibleContactId=this.value};
    row.querySelector(".lt-date").onchange=function(){t.date=this.value};
    row.querySelector(".lt-channel").onchange=function(){t.reminderChannel=this.value};
    row.querySelector(".remove-linked").onclick=function(){linkedDraft.splice(idx,1);renderLinkedTasks()};
    box.appendChild(row)
  })
}
function generateStandardLinkedTasks(){
  var eventDate=$("date").value,type=$("type").value;if(!eventDate){alert("Inserisci prima la data dell'evento.");return}
  var templates=linkedTemplates(type);linkedDraft=[];
  templates.forEach(function(x){var d=new Date(eventDate+"T12:00:00");d.setDate(d.getDate()+Number(x[1]));linkedDraft.push({id:"sub_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),title:x[0],responsibleContactId:"",date:isoDate(d),reminderChannel:"email"})});
  renderLinkedTasks()
}
function loadLinkedForEvent(e){
  linkedDraft=[];
  if(e&&e.id&&e.source!=="site"){
    events.filter(function(x){return x.parentEventId===e.id}).forEach(function(x){linkedDraft.push({id:x.id,title:x.title,responsibleContactId:x.responsibleContactId||"",date:x.date||"",reminderChannel:x.reminderChannel||"email"})})
  }
  renderLinkedTasks()
}
function api(action,payload){
  if(!endpoint)return Promise.reject(new Error("backend_non_configurato"));
  var opts={method:payload?"POST":"GET",headers:ArtyouGoogleAuth.authHeaders({"Content-Type":"text/plain;charset=utf-8"})};
  var url=endpoint+"?action="+encodeURIComponent(action)+"&_="+Date.now();
  if(payload){payload.action=action;opts.body=JSON.stringify(payload)}
  return fetch(url,opts).then(function(r){return r.json().then(function(j){if(r.status===401){ArtyouGoogleAuth.clear()}return j})});
}
function setSync(msg,type){$("syncStatus").className="status "+(type||"warn");$("syncStatus").textContent=msg}
function googleAuthorized(session){
  currentSession=session||{};
  email=String(currentSession.email||"").toLowerCase();
  currentAccess=currentSession.admin?"Amministratore":String(currentSession.accessLevel||(currentSession.person&&currentSession.person.accessLevel)||"Docente");
  canEdit=currentAccess==="Amministratore"||currentAccess==="Staff";
  sessionStorage.setItem("artyouCalendarEmail",email);
  openApp();
  $("newBtn").classList.toggle("hidden",!canEdit);
  Promise.all([loadPeople(),refresh()]).catch(function(){});
}
function openApp(){$("accessScreen").classList.add("hidden");$("app").classList.remove("hidden");$("logoutBtn").classList.remove("hidden");render()}
function logout(){ArtyouGoogleAuth.clear();sessionStorage.removeItem("artyouCalendarEmail");location.reload()}
function refresh(){
  if(!endpoint){loadDemo();render();return Promise.resolve(events)}
  setSync("Sincronizzazione Piano Operativo con MySQL…","warn");
  var start=new Date(current.getFullYear(),current.getMonth()-1,1),end=new Date(current.getFullYear(),current.getMonth()+2,0);
  return api("list",{from:isoDate(start),to:isoDate(end)}).then(function(r){
    if(!r||!r.ok)throw new Error((r&&r.errore)||"Errore sincronizzazione");
    events=r.events||[];render();setSync("Piano Operativo MySQL sincronizzato · "+events.length+" elementi","ok");return events;
  }).catch(function(e){setSync(e.message,"err");throw e});
}
function render(){
  $("monthTitle").textContent=current.toLocaleDateString("it-IT",{month:"long",year:"numeric"});
  renderMonth();renderAgenda();renderBoard();renderPlan();renderUndatedSiteEvents();
}
function renderUndatedSiteEvents(){
  var box=$("undatedSiteEvents");if(!box)return;
  var items=events.filter(function(e){return e.source==="site"&&!e.date});
  box.innerHTML="";
  if(!items.length)return;
  var header=document.createElement("strong");
  header.textContent="Spettacoli da pianificare ("+items.length+")";
  box.appendChild(header);
  var note=document.createElement("p");note.className="mini";
  note.textContent="Date non riconosciute dal calendario: verifica la data nel Gestionale Eventi.";
  box.appendChild(note);
  items.forEach(function(e){
    var item=document.createElement("button");item.type="button";item.className="btn soft";
    item.style.cssText="display:block;width:100%;margin:6px 0;text-align:left;white-space:normal";
    item.textContent=e.title+(e.siteDateLabel?" — "+e.siteDateLabel:" — data da definire");
    item.onclick=function(){openModal(e)};
    box.appendChild(item);
  });
}
function renderBoard(){
  var box=$("boardGrid");box.innerHTML="";
  var groups=["Comunicazione","Avvio corsi","Spettacolo","Workshop","Festival","YEP"];
  var labels={"Comunicazione":"Comunicazione","Avvio corsi":"Corsi","Spettacolo":"Spettacoli","Workshop":"Workshop","Festival":"Festival","YEP":"YEP"};
  var statusLabels={"todo":"Da fare","progress":"In corso","done":"Fatto","blocked":"Bloccato"};
  var today=isoDate(new Date());
  var me=(email||"").toLowerCase();
  var now=new Date(today+"T12:00:00"),weekEnd=new Date(now);weekEnd.setDate(weekEnd.getDate()+7);var weekEndIso=isoDate(weekEnd);
  groups.forEach(function(type){
    var items=events.filter(function(e){
      if(e.type!==type)return false;
      if(boardFilter==="done")return e.taskStatus==="done";
      if(boardFilter==="late")return e.taskStatus!=="done"&&e.date&&e.date<today;
      if(boardFilter==="week")return e.taskStatus!=="done"&&e.date&&e.date>=today&&e.date<=weekEndIso;
      if(boardFilter==="mine"){
        var myPerson=(currentSession&&currentSession.person)||{};
        if(myPerson.id&&String(e.responsibleContactId||"")===String(myPerson.id))return true;
        var who=((e.team||"")+" "+(e.teacher||"")).toLowerCase();
        var name=String(myPerson.name||"").toLowerCase();
        if(name&&who.indexOf(name)!==-1)return true;
        var local=me.split("@")[0].replace(/[._-]+/g," ");
        return !!local&&who.indexOf(local)!==-1;
      }
      return true;
    }).sort(function(a,b){return (a.date||"9999").localeCompare(b.date||"9999")});
    var col=document.createElement("section");col.className="board-col";
    col.innerHTML='<div class="board-head"><span>'+labels[type]+'</span><small>'+items.length+' attività</small></div><div class="board-list"></div>';
    var list=col.querySelector(".board-list");
    if(!items.length){list.innerHTML='<div class="mini">Nessuna attività.</div>'}
    items.forEach(function(e){
      var card=document.createElement("div");card.className="board-card";
      if(e.taskStatus==="done")card.classList.add("done");
      if(e.taskStatus!=="done"&&e.date){if(e.date<today)card.classList.add("overdue");else{var diff=(new Date(e.date+"T12:00:00")-new Date(today+"T12:00:00"))/86400000;if(diff<=7)card.classList.add("soon")}}
      card.innerHTML='<strong>'+escapeHtml(e.title||"Attività")+'</strong><div class="board-meta">'+escapeHtml((e.phase?e.phase+" · ":"")+(e.team||e.teacher||(e.source==="site"?"Evento già sul sito":"Senza responsabile")))+'</div><div class="board-meta">'+(e.source==="site"?"Data evento: ":"Scadenza: ")+escapeHtml(e.date||e.siteDateLabel||"da definire")+'</div><span class="board-status">'+escapeHtml(e.source==="site"?"Dal gestionale":(statusLabels[e.taskStatus]||"Da fare"))+'</span>'+(e.source==="site"?'<div class="board-meta" style="margin-top:8px;font-weight:800">✎ Clicca per modificare l\'evento</div>':'');
      card.onclick=function(){
        if(e.source==="site"){
          var key=String(e.slug||e.siteEventId||"").trim();
          var back="/calendario-docenti/?view=board";
          if(key) location.href="/gestionale.html?edit="+encodeURIComponent(key)+"&return="+encodeURIComponent(back);
          else location.href="/gestionale.html?return="+encodeURIComponent(back);
          return;
        }
        openModal(e);
      };
      list.appendChild(card)
    });
    box.appendChild(col)
  })
}
function renderPlan(){
  var wrap=$("planTableWrap");if(!wrap)return;
  var statusLabels={"todo":"Da fare","progress":"In corso","done":"Fatto","blocked":"Bloccato"};
  var areaLabel=function(e){return e.type==="Avvio corsi"?"Corsi":(e.type||"Altro")};
  var list=events.filter(function(e){return e.source!=="google"&&(e.source==="site"||["Comunicazione","Avvio corsi","Spettacolo","Workshop","Festival","YEP"].indexOf(e.type)!==-1)}).slice().sort(function(a,b){return (a.date||"9999-99-99").localeCompare(b.date||"9999-99-99")||(a.title||"").localeCompare(b.title||"")});
  if(!list.length){wrap.innerHTML='<div class="mini" style="padding:22px">Nessuna attività nel Piano Operativo.</div>';return}
  var deletable=list.filter(function(e){return e.source!=="site"&&e.source!=="google"&&e.id});
  var validIds={};deletable.forEach(function(e){validIds[String(e.id)]=true});
  selectedPlanIds.forEach(function(id){if(!validIds[String(id)])selectedPlanIds.delete(id)});
  var html='';
  if(canEdit){
    html+='<div class="plan-toolbar"><button type="button" class="btn '+(planSelectionMode?'soft':'dark')+'" id="planSelectModeBtn">'+(planSelectionMode?'Chiudi selezione':'Seleziona eventi')+'</button>';
    if(planSelectionMode){
      html+='<button type="button" class="btn soft" id="planSelectAllBtn">Seleziona tutti</button><button type="button" class="btn soft" id="planClearSelectionBtn">Deseleziona</button><button type="button" class="btn danger" id="planDeleteSelectedBtn"'+(selectedPlanIds.size?'':' disabled')+'>Elimina selezionati ('+selectedPlanIds.size+')</button><span class="selection-count">'+selectedPlanIds.size+' selezionati</span>';
    }
    html+='</div>';
  }
  html+='<table class="plan-table"><thead><tr>'+(planSelectionMode&&canEdit?'<th class="plan-select-cell">✓</th>':'')+'<th>Area</th><th>Cosa fare</th><th>Chi deve farlo</th><th>Entro quando</th><th>Stato</th><th>Note</th></tr></thead><tbody>';
  list.forEach(function(e){
    var selectable=canEdit&&planSelectionMode&&e.source!=="site"&&e.source!=="google"&&e.id;
    var selected=selectable&&selectedPlanIds.has(String(e.id));
    html+='<tr data-id="'+escapeHtml(e.id||"")+'" data-source="'+escapeHtml(e.source||"")+'" class="'+(selected?'plan-selected ':'')+(e.source==="site"?'plan-source':'')+'">';
    if(planSelectionMode&&canEdit){
      html+='<td class="plan-select-cell" data-label="Seleziona">'+(selectable?'<input class="plan-select" type="checkbox" data-select-id="'+escapeHtml(e.id||"")+'" '+(selected?'checked':'')+' aria-label="Seleziona '+escapeHtml(e.title||"attività")+'">':'—')+'</td>';
    }
    html+='<td data-label="Area">'+escapeHtml(areaLabel(e))+'</td><td data-label="Cosa fare"><strong>'+escapeHtml(e.title||"")+'</strong>'+(e.phase?'<div class="mini">'+escapeHtml(e.phase)+'</div>':'')+'</td><td data-label="Chi deve farlo">'+escapeHtml(e.team||e.teacher||(e.source==="site"?"Gestionale":"Da assegnare"))+'</td><td data-label="Entro quando">'+escapeHtml(e.date||e.siteDateLabel||"Da definire")+'</td><td data-label="Stato" class="plan-status">'+escapeHtml(e.source==="site"?"Evento":(statusLabels[e.taskStatus]||"Da fare"))+'</td><td data-label="Note">'+escapeHtml(e.notes||"")+'</td></tr>';
  });
  html+='</tbody></table>';wrap.innerHTML=html;

  var modeBtn=$("planSelectModeBtn");if(modeBtn)modeBtn.onclick=function(){planSelectionMode=!planSelectionMode;if(!planSelectionMode)selectedPlanIds.clear();renderPlan()};
  var allBtn=$("planSelectAllBtn");if(allBtn)allBtn.onclick=function(){deletable.forEach(function(e){selectedPlanIds.add(String(e.id))});renderPlan()};
  var clearBtn=$("planClearSelectionBtn");if(clearBtn)clearBtn.onclick=function(){selectedPlanIds.clear();renderPlan()};
  var delBtn=$("planDeleteSelectedBtn");if(delBtn)delBtn.onclick=deleteSelectedPlanEvents;

  wrap.querySelectorAll(".plan-select").forEach(function(cb){
    cb.onclick=function(ev){ev.stopPropagation()};
    cb.onchange=function(){var id=String(cb.getAttribute("data-select-id")||"");if(cb.checked)selectedPlanIds.add(id);else selectedPlanIds.delete(id);renderPlan()};
  });
  wrap.querySelectorAll("tbody tr").forEach(function(row){
    row.onclick=function(){
      var id=row.getAttribute("data-id"),source=row.getAttribute("data-source");
      if(planSelectionMode&&canEdit){
        if(source==="site")return;
        var cb=row.querySelector(".plan-select");if(cb){cb.checked=!cb.checked;cb.onchange()}return;
      }
      var e=events.find(function(x){return String(x.id)===String(id)});if(e)openModal(e)
    }
  });
}
function deleteSelectedPlanEvents(){
  if(!canEdit){alert("Il tuo profilo è in sola lettura.");return}
  var ids=Array.from(selectedPlanIds);
  if(!ids.length)return;
  var chosen=ids.map(function(id){return events.find(function(e){return String(e.id)===String(id)})}).filter(Boolean);
  if(!confirm("Eliminare definitivamente "+chosen.length+" attività selezionate dal Piano Operativo?\n\nGli eventuali eventi Google Calendar collegati verranno eliminati insieme."))return;
  var button=$("planDeleteSelectedBtn");if(button){button.disabled=true;button.textContent="Eliminazione…"}
  if(!endpoint){
    events=events.filter(function(e){return ids.indexOf(String(e.id))===-1});saveDemo();selectedPlanIds.clear();planSelectionMode=false;render();return
  }
  var chain=Promise.resolve();
  var failures=[];
  ids.forEach(function(id){
    chain=chain.then(function(){return api("delete",{id:id}).then(function(r){if(!r||!r.ok)failures.push(id)}).catch(function(){failures.push(id)})})
  });
  chain.then(function(){
    selectedPlanIds.clear();planSelectionMode=false;
    return refresh().then(function(){
      if(failures.length)alert("Eliminazione completata, ma "+failures.length+" attività non sono state eliminate.");
      else setSync(chosen.length+" attività eliminate dal Piano Operativo","ok")
    })
  }).catch(function(err){alert(err.message||"Eliminazione non riuscita");renderPlan()})
}
function renderMonth(){
  var box=$("calendar");box.innerHTML="";
  var y=current.getFullYear(),m=current.getMonth(),first=new Date(y,m,1),offset=(first.getDay()+6)%7;
  var start=new Date(y,m,1-offset);
  for(var i=0;i<42;i++){
    var d=new Date(start);d.setDate(start.getDate()+i);
    var cell=document.createElement("div");cell.className="day"+(d.getMonth()!==m?" muted":"")+(isoDate(d)===isoDate(new Date())?" today":"");
    cell.innerHTML='<div class="day-head"><span class="day-num">'+d.getDate()+'</span><button class="add-mini" title="Aggiungi"'+(canEdit?'':' style="display:none"')+'>＋</button></div>';
    (visibleEvents().filter(function(e){return e.date===isoDate(d)})).sort(function(a,b){return (a.start||"").localeCompare(b.start||"")}).forEach(function(e){
      var el=document.createElement("div");el.className="event";el.dataset.type=e.type||"Altro";if(e.taskStatus==="done")el.classList.add("done");var today=isoDate(new Date());if((e.type==="Comunicazione"||e.type==="Avvio corsi"||e.type==="Spettacolo"||e.type==="YEP")&&e.taskStatus!=="done"){if(e.date<today)el.classList.add("overdue");else{var diff=(new Date(e.date+"T12:00:00")-new Date(today+"T12:00:00"))/86400000;if(diff<=7)el.classList.add("soon")}}el.innerHTML=escapeHtml((e.start?e.start+" ":"")+e.title)+(e.team?'<small>'+escapeHtml(e.team)+'</small>':(e.venue?'<small>'+escapeHtml(e.venue)+'</small>':""));el.onclick=function(ev){ev.stopPropagation();openModal(e)};cell.appendChild(el)
    });
    (function(date){cell.querySelector(".add-mini").onclick=function(ev){ev.stopPropagation();openModal({date:isoDate(date)})}})(d);
    box.appendChild(cell)
  }
}
function renderAgenda(){
  var box=$("agendaView");box.innerHTML="";
  var filtered=visibleEvents().slice().sort(function(a,b){return (a.date+" "+(a.start||"")).localeCompare(b.date+" "+(b.start||""))});
  var by={};filtered.forEach(function(e){(by[e.date]||(by[e.date]=[])).push(e)});
  Object.keys(by).forEach(function(date){
    var wrap=document.createElement("div");wrap.className="agenda-day";
    var dd=date?new Date(date+"T12:00:00"):null;wrap.innerHTML='<div class="agenda-date">'+(dd&&!isNaN(dd.getTime())?dd.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"}):"Data da definire")+'</div>';
    by[date].forEach(function(e){var row=document.createElement("div");row.className="agenda-event";row.innerHTML='<div><strong>'+escapeHtml(e.title)+'</strong><small>'+escapeHtml((e.start||"")+" "+(e.end?"– "+e.end:"")+" · "+(e.type||"Altro")+(e.source==="site"?" · Dal gestionale":(e.taskStatus?" · "+({"todo":"Da fare","progress":"In corso","done":"Fatto","blocked":"Bloccato"}[e.taskStatus]||e.taskStatus):""))+(e.team?" · "+e.team:(e.venue?" · "+e.venue:"")))+'</small></div><button class="btn soft">Apri</button>';row.querySelector("button").onclick=function(){openModal(e)};wrap.appendChild(row)});
    box.appendChild(wrap)
  });
  if(!filtered.length)box.innerHTML='<div class="mini" style="padding:22px">Nessun appuntamento da mostrare.</div>'
}
function openModal(e){
  e=e||{};var fromSite=e.source==="site";var editable=canEdit&&!fromSite;
  $("modalWrap").dataset.source=e.source||"";
  $("modalWrap").dataset.parentEventId=e.parentEventId||"";
  $("modalWrap").dataset.templateKey=e.templateKey||"";
  $("modalTitle").textContent=fromSite?"Evento dal Gestionale":(e.id?(editable?"Modifica appuntamento":"Dettaglio appuntamento"):"Nuovo appuntamento");$("eventId").value=e.id||"";$("siteEventId").value=e.siteEventId||"";$("siteDateIndex").value=e.siteDateIndex==null?"":String(e.siteDateIndex);$("title").value=e.title||"";$("type").value=e.type||"Lezione";$("date").value=e.date||"";$("start").value=e.start||"20:00";$("end").value=e.end||"22:00";$("venue").value=e.venue||"";refreshPeopleSelect();$("teacher").value=e.responsibleContactId||"";$("visibility").value=e.visibility||"internal";$("notes").value=e.notes||"";$("publicTitle").value=e.publicTitle||"";$("price").value=e.price==null?"":e.price;$("capacity").value=e.capacity==null?"":e.capacity;$("slug").value=e.slug||"";$("publishSite").checked=!!e.publishSite;$("taskStatus").value=e.taskStatus||"todo";$("repeat").value=e.repeat||"none";$("team").value=e.team||"";$("phase").value=e.phase||"";$("courseStart").value=e.courseStart||"";$("coursePreset").value=e.coursePreset||"";$("yepDate").value=e.yepDate||"";$("yepPreset").value=e.yepPreset||"";$("reminderDays").value=String(e.reminderDays==null?6:e.reminderDays);$("reminderChannel").value=e.reminderChannel||"email";
  $("deleteBtn").classList.toggle("hidden",!editable||!e.id);$("saveBtn").classList.toggle("hidden",!editable);$("generatePlanBtn").classList.toggle("hidden",!canEdit||!fromSite);
  setMeetingSelection(e.attendeeIds||[]);$("meetingChannel").value=e.meetingChannel||"calendar";$("meetingReminder").value=String(e.meetingReminderDays||0);$("notifyMeetingNow").checked=!e.id;loadLinkedForEvent(e);togglePublic();toggleTaskBox();
  document.querySelectorAll("#modalWrap input,#modalWrap select,#modalWrap textarea").forEach(function(x){x.disabled=!editable});
  ["addLinkedTaskBtn","generateStandardTasksBtn","selectAllMeetingBtn","clearMeetingBtn","applyPresetBtn","applyYepPresetBtn"].forEach(function(id){var el=$(id);if(el)el.classList.toggle("hidden",!editable)});
  $("modalWrap").classList.add("open")
}
function closeModal(){$("modalWrap").classList.remove("open")}
function togglePublic(){$("publicBox").classList.toggle("show",$("visibility").value==="public")}function toggleTaskBox(){var t=$("type").value;var on=t==="Comunicazione"||t==="Avvio corsi"||linkedTaskTypes().indexOf(t)!==-1;$("taskBox").classList.toggle("show",on);$("coursePresetWrap").style.display=t==="Avvio corsi"?"block":"none";$("yepPresetWrap").style.display=t==="YEP"?"block":"none";var site=!!$("siteEventId").value;var generated=$("modalWrap").dataset.source==="generated"||!!$("modalWrap").dataset.parentEventId||/Generato automaticamente dal Gestionale Eventi/i.test($("notes").value||"");$("linkedTasksBox").classList.toggle("show",linkedTaskTypes().indexOf(t)!==-1&&!site&&!generated);$("meetingBox").classList.toggle("show",t==="Riunione"&&!site);if(t==="Riunione")renderMeetingPeople()}
function collect(){
  var title=$("title").value.trim();
  var responsible=findPersonById($("teacher").value);
  var teamText=$("team").value.trim();
  var responsibleName=responsible?responsible.name:teamText;
  return{id:$("eventId").value||("evt_"+Date.now()),title:title,type:$("type").value,date:$("date").value,start:$("start").value,end:$("end").value,venue:$("venue").value.trim(),teacher:responsibleName,visibility:$("visibility").value,notes:$("notes").value.trim(),publicTitle:$("publicTitle").value.trim(),price:$("price").value===""?null:Number($("price").value),capacity:$("capacity").value===""?null:Number($("capacity").value),slug:$("slug").value.trim()||slugify($("publicTitle").value||title),publishSite:$("publishSite").checked,taskStatus:$("taskStatus").value,repeat:$("repeat").value,team:responsibleName||teamText,phase:$("phase").value.trim(),courseStart:$("courseStart").value,coursePreset:$("coursePreset").value,yepDate:$("yepDate").value,yepPreset:$("yepPreset").value,reminderDays:Number($("reminderDays").value)||0,reminderChannel:$("reminderChannel").value,responsibleContactId:responsible?responsible.id:"",source:$("modalWrap").dataset.source||"plan",parentEventId:$("modalWrap").dataset.parentEventId||"",templateKey:$("modalWrap").dataset.templateKey||"",attendeeIds:meetingSelected.slice(),meetingChannel:$("meetingChannel").value,meetingReminderDays:Number($("meetingReminder").value)||0,notifyAttendees:$("notifyMeetingNow").checked}
}
function save(){
  if(!canEdit){alert("Il tuo profilo è in sola lettura.");return}
  var e=collect();if(!e.title||!e.date){alert("Inserisci almeno titolo e data.");return}
  var validLinked=linkedDraft.filter(function(t){return String(t.title||"").trim()&&t.date});
  function childEvent(t){
    var p=people.find(function(x){return x.id===t.responsibleContactId})||{};
    return{id:t.id,title:t.title,type:e.type,date:t.date,start:"09:00",end:"10:00",venue:e.venue,teacher:p.name||"",visibility:"internal",notes:"Compito collegato a: "+e.title,taskStatus:"todo",repeat:"none",team:p.name||"",phase:"Piano evento",reminderDays:6,reminderChannel:t.reminderChannel,responsibleContactId:t.responsibleContactId,parentEventId:e.id,source:"linked"}
  }
  if(!endpoint){
    var i=events.findIndex(function(x){return x.id===e.id});if(i>=0)events[i]=e;else events.push(e);
    events=events.filter(function(x){return x.parentEventId!==e.id||validLinked.some(function(t){return t.id===x.id})});
    validLinked.forEach(function(t){var ce=childEvent(t),j=events.findIndex(function(x){return x.id===ce.id});if(j>=0)events[j]=ce;else events.push(ce)});
    saveDemo();closeModal();render();return
  }
  var oldChildIds=events.filter(function(x){return x.parentEventId===e.id}).map(function(x){return x.id});
  var keptIds=validLinked.map(function(t){return t.id});
  var removedIds=oldChildIds.filter(function(id){return keptIds.indexOf(id)===-1});
  var savedEvent=null;
  api("save",{event:e}).then(function(r){
    if(!r||!r.ok)throw new Error((r&&r.errore)||"Salvataggio non riuscito");
    savedEvent=r.event||e;
    var ops=removedIds.map(function(id){return api("delete",{id:id})}).concat(validLinked.map(function(t){return api("save",{event:childEvent(t)})}));
    if(!ops.length)return [];
    return Promise.all(ops)
  }).then(function(results){
    var bad=(results||[]).find(function(x){return x&&x.ok===false});if(bad)throw new Error(bad.errore||"Aggiornamento compiti non riuscito");
    if(!removedIds.length&&!validLinked.length&&savedEvent){
      var ix=events.findIndex(function(x){return String(x.id)===String(savedEvent.id)});
      if(ix>=0)events[ix]=savedEvent;else events.push(savedEvent);
      closeModal();render();setSync("Attività salvata e sincronizzata","ok");return
    }
    closeModal();return refresh()
  }).catch(function(err){alert(err.message)})
}
function generatePlan(){
  if(!canEdit){alert("Il tuo profilo è in sola lettura.");return}
  var siteEventId=$("siteEventId").value,siteDateIndex=Number($("siteDateIndex").value||0);
  if(!siteEventId){alert("Evento del Gestionale non riconosciuto.");return}
  if(!endpoint){alert("La generazione automatica sarà disponibile appena colleghiamo il backend Apps Script.");return}
  if(!confirm("Creare automaticamente tutte le attività operative collegate a questo evento?"))return;
  $("generatePlanBtn").disabled=true;$("generatePlanBtn").textContent="Generazione…";
  api("generate_plan",{siteEventId:siteEventId,siteDateIndex:siteDateIndex}).then(function(r){
    if(!r||!r.ok)throw new Error((r&&r.errore)||"Generazione non riuscita");
    closeModal();
    alert("Piano creato: "+r.created+" attività. "+(r.skipped? r.skipped+" già esistenti non duplicate.":""));
    refresh();
  }).catch(function(err){
    var m=err.message==="data_evento_non_definita"?"Prima definisci la data dell'evento nel Gestionale.":err.message;
    alert(m);
  }).finally(function(){$("generatePlanBtn").disabled=false;$("generatePlanBtn").textContent="Crea Piano Operativo"})
}
function remove(){
  if(!canEdit){alert("Il tuo profilo è in sola lettura.");return}
  var id=$("eventId").value;if(!id)return;var ev=events.find(function(x){return String(x.id)===String(id)});var name=(ev&&ev.title)||$("title").value||"questo appuntamento";if(!confirm("Eliminare definitivamente \""+name+"\"?\n\nSe è sincronizzato con Google Calendar, verrà eliminato anche lì."))return;
  if(!endpoint){events=events.filter(function(x){return x.id!==id});saveDemo();closeModal();render();return}
  api("delete",{id:id}).then(function(r){if(!r||!r.ok)throw new Error((r&&r.errore)||"Eliminazione non riuscita");closeModal();refresh()}).catch(function(err){alert(err.message)})
}
$("logoutBtn").onclick=logout;$("newBtn").onclick=function(){if(canEdit)openModal({date:isoDate(new Date())})};$("closeBtn").onclick=closeModal;$("cancelBtn").onclick=closeModal;$("saveBtn").onclick=save;$("deleteBtn").onclick=remove;$("generatePlanBtn").onclick=generatePlan;$("addLinkedTaskBtn").onclick=function(){addLinkedTask({date:$("date").value})};$("generateStandardTasksBtn").onclick=generateStandardLinkedTasks;$("selectAllMeetingBtn").onclick=function(){meetingSelected=people.filter(function(p){return p.active!==false}).map(function(p){return p.id});renderMeetingPeople()};$("clearMeetingBtn").onclick=function(){meetingSelected=[];renderMeetingPeople()};$("visibility").onchange=togglePublic;$("type").onchange=toggleTaskBox;$("applyPresetBtn").onclick=function(){var start=$("courseStart").value,p=$("coursePreset").value;if(!start||!p){alert("Scegli attività e data di partenza del corso.");return}var parts=p.split("|"),days=Number(parts[1]);var d=new Date(start+"T12:00:00");d.setDate(d.getDate()-days);$("title").value=parts[0];$("date").value=isoDate(d);$("phase").value="Avvio corsi";$("taskStatus").value="todo";};$("applyYepPresetBtn").onclick=function(){var start=$("yepDate").value,p=$("yepPreset").value;if(!start||!p){alert("Scegli attività e data YEP.");return}var parts=p.split("|"),days=Number(parts[1]);var d=new Date(start+"T12:00:00");d.setDate(d.getDate()-days);$("title").value=parts[0];$("date").value=isoDate(d);$("phase").value=parts[2]||"YEP";$("taskStatus").value="todo";};$("refreshBtn").onclick=refresh;
$("prevBtn").onclick=function(){current.setMonth(current.getMonth()-1);render();if(endpoint)refresh()};$("nextBtn").onclick=function(){current.setMonth(current.getMonth()+1);render();if(endpoint)refresh()};$("todayBtn").onclick=function(){current=new Date();current.setDate(1);render();if(endpoint)refresh()};
document.querySelectorAll(".type-filter").forEach(function(x){x.onchange=render});document.querySelectorAll(".view-switch button").forEach(function(b){b.onclick=function(){document.querySelectorAll(".view-switch button").forEach(function(x){x.classList.remove("active")});b.classList.add("active");var v=b.dataset.view;$("monthView").classList.toggle("hidden",v!=="month");$("agendaView").classList.toggle("active",v==="agenda");$("boardView").classList.toggle("active",v==="board");$("planView").classList.toggle("active",v==="plan")}});$("modalWrap").onclick=function(e){if(e.target===$("modalWrap"))closeModal()};
document.querySelectorAll("[data-board-filter]").forEach(function(b){b.onclick=function(){boardFilter=b.dataset.boardFilter;document.querySelectorAll("[data-board-filter]").forEach(function(x){x.classList.remove("active")});b.classList.add("active");renderBoard()}});ArtyouGoogleAuth.init({buttonId:"googleLoginButton",statusId:"loginStatus",onAuthorized:googleAuthorized});
})();
