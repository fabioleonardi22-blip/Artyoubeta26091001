// Estratto da gestionale.html (audit 10/10/2026): niente script inline, così la CSP delle aree riservate può escludere unsafe-inline.
(function(){
"use strict";
var endpoint=window.ARTYOU_EVENTS_ENDPOINT||"";
var events=[],currentId="";
var returnTo="/calendario-docenti/";


function $(id){return document.getElementById(id)}
function setStatus(msg,type){var s=$("status");s.className="status "+(type||"info");s.textContent=msg}
function slugify(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}
function toggleSaggiFields(){var on=$("eventType")&&$("eventType").value==="SAGGI";var box=$("saggiFields");if(box)box.style.display=on?"block":"none";var y=$("yepPricingFields");if(y)y.style.display=$("eventType")&&$("eventType").value==="YEP"?"block":"none"}
function apiGet(action){if(!endpoint)return Promise.reject(new Error("Endpoint Gestionale non configurato"));return fetch(endpoint+"?action="+encodeURIComponent(action)+"&_="+Date.now(),{credentials:"same-origin",headers:ArtyouGoogleAuth.authHeaders()}).then(r=>r.json())}
function apiPost(body){if(!endpoint)return Promise.reject(new Error("Endpoint Gestionale non configurato"));return fetch(endpoint,{method:"POST",credentials:"same-origin",headers:ArtyouGoogleAuth.authHeaders({"Content-Type":"application/json"}),body:JSON.stringify(body)}).then(r=>r.json())}
function assert(res){if(!res||!res.ok)throw new Error((res&&res.errore)||"Operazione non riuscita");return res}
function mysqlEventForEditor(slug){
  if(!slug)return Promise.resolve(null);
  return fetch("/api/mysql-events?evento="+encodeURIComponent(slug)+"&_="+Date.now())
    .then(function(r){return r.json()})
    .then(function(x){
      if(!x||!x.ok||!x.evento)return null;
      var e=x.evento;
      return {
        id:"",
        slug:e.slug||slug,
        title:e.titolo||"",
        cat:e.categoria||"Improvvisazione",
        eventType:e.tipo||"Spettacolo",
        tipo:e.tipo||"Spettacolo",
        ordine:e.ordine||100,
        desc:e.descrizione||"",
        venue:e.luogo||"",
        addr:e.indirizzo||"",
        maps:e.maps||"",
        price:e.prezzo==null?"":Number(e.prezzo),
        capienza:Number(e.capienza||0),
        pagaOnline:!!e.pagaOnline,
        tbd:!!e.tbd,
        attivo:e.attivo!==false,
        poster:e.poster||"",
        dates:Array.isArray(e.dates)&&e.dates.length?e.dates:[{label:e.data||"",sold:0}],
        cast:Array.isArray(e.cast)?e.cast:[],
        yepPricing:e.yepPricing||null,
        saggi:e.saggi||null,
        _mysqlOnly:true
      };
    });
}

function dateRow(v){
  var row=document.createElement("div");row.className="repeat-row";
  row.innerHTML='<input class="date-label" placeholder="Es. Venerdì 17 aprile · 21:00"><button type="button" class="btn danger">Rimuovi</button>';
  row.querySelector("input").value=(v&&v.label)||"";
  row.querySelector("input").artyouDate = v || {};
  row.querySelector("button").onclick=function(){row.remove();if(!$("dates").children.length)addDate()};
  $("dates").appendChild(row);
}
function addDate(v){dateRow(v||{label:"",sold:0})}
function castRow(v){
  var row=document.createElement("div");row.className="repeat-row cast-row";
  row.innerHTML='<input class="cast-name" placeholder="Nome e cognome"><input class="cast-slug" placeholder="slug-docente"><button type="button" class="btn danger">Rimuovi</button>';
  row.querySelector(".cast-name").value=(v&&v.name)||"";
  row.querySelector(".cast-slug").value=(v&&v.slug)||"";
  row.querySelector("button").onclick=function(){row.remove()};
  $("cast").appendChild(row);
}
function addCast(v){castRow(v||{name:"",slug:""})}

function clearForm(){
  currentId=""; $("id").value=""; $("title").value=""; $("slug").value=""; $("cat").value="Improvvisazione";$("eventType").value="Spettacolo";
  $("ordine").value=100;$("desc").value="";$("venue").value="";$("addr").value="";$("maps").value="";
  $("price").value="";$("capienza").value=60;$("pagaOnline").checked=false;$("tbd").checked=false;$("attivo").checked=true;
  $("poster").value="";$("posterFile").value="";$("posterPreview").style.backgroundImage="";$("posterPreview").textContent="Anteprima locandina";
  ["yepAwEarlyQuad","yepAwEarlyTriple","yepAwEarlyDouble","yepAwLateQuad","yepAwLateTriple","yepAwLateDouble","yepHolidayEarlyQuad","yepHolidayEarlyTriple","yepHolidayEarlyDouble","yepHolidayLateQuad","yepHolidayLateTriple","yepHolidayLateDouble","yepWorkshopEarly","yepWorkshopLate"].forEach(function(id){var defaults={yepAwEarlyQuad:320,yepAwEarlyTriple:330,yepAwEarlyDouble:350,yepAwLateQuad:350,yepAwLateTriple:360,yepAwLateDouble:380,yepHolidayEarlyQuad:200,yepHolidayEarlyTriple:210,yepHolidayEarlyDouble:230,yepHolidayLateQuad:230,yepHolidayLateTriple:240,yepHolidayLateDouble:260,yepWorkshopEarly:250,yepWorkshopLate:280};$(id).value=defaults[id]});
  $("saggiStart").value="21:00";$("saggio1Title").value="";$("saggio1Teacher").value="";$("saggio1Poster").value="";$("saggio2Title").value="";$("saggio2Teacher").value="";$("saggio2Poster").value="";toggleSaggiFields();
  $("dates").innerHTML="";addDate();$("cast").innerHTML="";$("deleteBtn").style.display="none";$("formTitle").textContent="Nuovo evento";
  document.querySelectorAll(".event").forEach(x=>x.classList.remove("active"));updatePreviewLink();
}
function loadForm(e){
  currentId=e.id||"";$("id").value=currentId;$("title").value=e.title||"";$("slug").value=e.slug||"";$("cat").value=e.cat||"Improvvisazione";$("eventType").value=e.eventType||e.tipo||"Spettacolo";
  $("ordine").value=e.ordine||100;$("desc").value=e.desc||"";$("venue").value=e.venue||"";$("addr").value=e.addr||"";$("maps").value=e.maps||"";
  $("price").value=e.price===""?"":e.price;$("capienza").value=e.capienza||0;$("pagaOnline").checked=!!e.pagaOnline;$("tbd").checked=!!e.tbd;$("attivo").checked=!!e.attivo;
  $("poster").value=e.poster||"";
  var yp=e.yepPricing||{};
  var ep=yp.early||{}, lp=yp.late||{}, awE=ep.alloggioWorkshop||{}, awL=lp.alloggioWorkshop||{}, hvE=ep.soloVacanza||{}, hvL=lp.soloVacanza||{};
  $("yepAwEarlyQuad").value=awE.quadrupla!=null?awE.quadrupla:320;$("yepAwEarlyTriple").value=awE.tripla!=null?awE.tripla:330;$("yepAwEarlyDouble").value=awE.doppia!=null?awE.doppia:350;
  $("yepAwLateQuad").value=awL.quadrupla!=null?awL.quadrupla:350;$("yepAwLateTriple").value=awL.tripla!=null?awL.tripla:360;$("yepAwLateDouble").value=awL.doppia!=null?awL.doppia:380;
  $("yepHolidayEarlyQuad").value=hvE.quadrupla!=null?hvE.quadrupla:200;$("yepHolidayEarlyTriple").value=hvE.tripla!=null?hvE.tripla:210;$("yepHolidayEarlyDouble").value=hvE.doppia!=null?hvE.doppia:230;
  $("yepHolidayLateQuad").value=hvL.quadrupla!=null?hvL.quadrupla:230;$("yepHolidayLateTriple").value=hvL.tripla!=null?hvL.tripla:240;$("yepHolidayLateDouble").value=hvL.doppia!=null?hvL.doppia:260;
  $("yepWorkshopEarly").value=ep.soloWorkshop!=null?ep.soloWorkshop:250;$("yepWorkshopLate").value=lp.soloWorkshop!=null?lp.soloWorkshop:280;
  var sg=e.saggi||{};
  $("saggiStart").value=sg.start||"21:00";$("saggio1Title").value=(sg.show1&&sg.show1.title)||"";$("saggio1Teacher").value=(sg.show1&&sg.show1.teacher)||"";$("saggio1Poster").value=(sg.show1&&sg.show1.poster)||"";
  $("saggio2Title").value=(sg.show2&&sg.show2.title)||"";$("saggio2Teacher").value=(sg.show2&&sg.show2.teacher)||"";$("saggio2Poster").value=(sg.show2&&sg.show2.poster)||"";toggleSaggiFields();
  $("dates").innerHTML="";(e.dates||[]).forEach(addDate);if(!$("dates").children.length)addDate();
  $("cast").innerHTML="";(e.cast||[]).forEach(addCast);$("deleteBtn").style.display="inline-block";$("formTitle").textContent=e.title||"Modifica evento";
  updatePoster();updatePreviewLink();renderList();
}
function collect(){
  var dates=[].slice.call(document.querySelectorAll(".date-label")).map(x=>({...x.artyouDate,label:x.value.trim(),sold:0})).filter(x=>x.label);
  var cast=[].slice.call(document.querySelectorAll(".cast-row")).map(row=>({name:row.querySelector(".cast-name").value.trim(),slug:row.querySelector(".cast-slug").value.trim()})).filter(x=>x.name);
  return {id:currentId,slug:$("slug").value.trim()||slugify($("title").value),title:$("title").value.trim(),cat:$("cat").value,eventType:$("eventType").value,tipo:$("eventType").value,ordine:Number($("ordine").value)||100,
    desc:$("desc").value.trim(),venue:$("venue").value.trim(),addr:$("addr").value.trim(),maps:$("maps").value.trim(),price:$("price").value===""?"":Number($("price").value),
    capienza:Number($("capienza").value)||0,pagaOnline:$("pagaOnline").checked,tbd:$("tbd").checked,attivo:$("attivo").checked,poster:$("poster").value.trim(),dates:dates,cast:cast,
    yepPricing:$("eventType").value==="YEP"?{cutoff:"2027-06-30",early:{alloggioWorkshop:{quadrupla:Number($("yepAwEarlyQuad").value)||0,tripla:Number($("yepAwEarlyTriple").value)||0,doppia:Number($("yepAwEarlyDouble").value)||0},soloVacanza:{quadrupla:Number($("yepHolidayEarlyQuad").value)||0,tripla:Number($("yepHolidayEarlyTriple").value)||0,doppia:Number($("yepHolidayEarlyDouble").value)||0},soloWorkshop:Number($("yepWorkshopEarly").value)||0},late:{alloggioWorkshop:{quadrupla:Number($("yepAwLateQuad").value)||0,tripla:Number($("yepAwLateTriple").value)||0,doppia:Number($("yepAwLateDouble").value)||0},soloVacanza:{quadrupla:Number($("yepHolidayLateQuad").value)||0,tripla:Number($("yepHolidayLateTriple").value)||0,doppia:Number($("yepHolidayLateDouble").value)||0},soloWorkshop:Number($("yepWorkshopLate").value)||0}}:null,
    saggi:$("eventType").value==="SAGGI"?{start:$("saggiStart").value||"",show1:{title:$("saggio1Title").value.trim(),teacher:$("saggio1Teacher").value.trim(),poster:$("saggio1Poster").value.trim()},show2:{title:$("saggio2Title").value.trim(),teacher:$("saggio2Teacher").value.trim(),poster:$("saggio2Poster").value.trim()}}:null};
}
function renderList(){
  var box=$("eventList");box.innerHTML="";
  var q=String(($("eventSearch")&&$("eventSearch").value)||"").trim().toLowerCase();
  var status=String(($("eventStatusFilter")&&$("eventStatusFilter").value)||"all");
  var list=(events||[]).filter(function(e){
    if(status==="published"&&!e.attivo)return false;
    if(status==="draft"&&e.attivo)return false;
    if(!q)return true;
    return ((e.title||"")+" "+(e.slug||"")+" "+(e.eventType||e.tipo||e.cat||"")).toLowerCase().indexOf(q)!==-1;
  });
  if(!list.length){box.innerHTML='<div class="empty">Nessun evento corrispondente.</div>';return}
  list.forEach(function(e){
    var d=document.createElement("div");d.className="event"+(e.id===currentId?" active":"");
    d.innerHTML="<div class='event-row-head'><strong>"+escapeHtml(e.title||e.slug)+"</strong><button type='button' class='event-edit-btn'>Modifica</button></div><div class='meta'>"+escapeHtml(e.eventType||e.tipo||e.cat||"")+" · "+(e.attivo?"Pubblicato":"Bozza")+" · "+escapeHtml((e.dates&&e.dates[0]&&e.dates[0].label)||"")+"</div>";
    d.onclick=function(){loadForm(e)};
    d.querySelector(".event-edit-btn").onclick=function(ev){ev.stopPropagation();loadForm(e)};
    box.appendChild(d);
  });
}
function escapeHtml(s){return String(s||"").replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function refresh(){
  setStatus("Caricamento eventi…","info");
  apiGet("list").then(assert).then(function(r){
    events=r.events||[];
    $("logoutBtn").style.display="inline-block";
    renderList();
    var editKey="";
    try{editKey=new URLSearchParams(location.search).get("edit")||""}catch(_){}
    if(editKey){
      var target=events.find(function(e){return String(e.slug||"")===editKey||String(e.id||"")===editKey});
      if(target){
        loadForm(target);
        setStatus("Evento aperto in modifica: "+(target.title||target.slug)+".","ok");
      }else{
        setStatus("Apro l'evento dal database MySQL…","info");
        mysqlEventForEditor(editKey).then(function(mysqlEvent){
          if(!mysqlEvent)throw new Error("evento_non_trovato");
          loadForm(mysqlEvent);
          $("formTitle").textContent="Modifica evento · "+(mysqlEvent.title||mysqlEvent.slug);
          setStatus("Evento aperto dal database. Le modifiche verranno salvate sullo stesso evento.","ok");
        }).catch(function(){
          setStatus("Evento richiesto non trovato nel Gestionale né in MySQL.","err");
        });
      }
    }else{
      setStatus("Gestionale collegato. "+events.length+" eventi trovati.","ok");
    }
  }).catch(function(e){
    if(String(e.message||"").indexOf("google_login_required")!==-1||String(e.message||"").indexOf("permesso_insufficiente")!==-1){
      ArtyouGoogleAuth.clear();$("logoutBtn").style.display="none";
    }
    setStatus(e.message,"err");
  });
}

var july2027Seed=[
  {date:"01/07/2027",teacher:"Zadro",title:"Xanax"},
  {date:"02/07/2027",teacher:"Parisi",title:"Show don't tell e altri trucchetti"},
  {date:"06/07/2027",teacher:"Masi",title:"Rime"},
  {date:"07/07/2027",teacher:"Forbicioni",title:"Dancing in the dark 1"},
  {date:"08/07/2027",teacher:"Spadoni",title:"Street's games 1"},
  {date:"08/07/2027",teacher:"Zadro",title:"So quello che pensi"},
  {date:"09/07/2027",teacher:"Guerrera",title:"Baci e abbracci"},
  {date:"13/07/2027",teacher:"Spadoni",title:"I primi 60 secondi"},
  {date:"14/07/2027",teacher:"Zadro",title:"Undici"},
  {date:"15/07/2027",teacher:"Forbicioni",title:"Lie to me"},
  {date:"31/07/2027",teacher:"Forbicioni",title:"From text to next"},
  {date:"20/07/2027",teacher:"Spadoni",title:"Molla la mente"},
  {date:"21/07/2027",teacher:"Masi",title:"Gioca con l'ovvio"},
  {date:"22/07/2027",teacher:"Zadro",title:"Thriller"},
  {date:"27/07/2027",teacher:"Guerrera",title:"Transizioni - a kind of magic"},
  {date:"29/07/2027",teacher:"Forbicioni",title:"This must to be the place"}
];
function july2027Event(x,index){
  var slug="luglio-2027-"+String(x.date).slice(0,2)+"-"+slugify(x.title);
  return {
    id:"",
    slug:slug,
    title:x.title,
    cat:"Improvvisazione",
    eventType:"Workshop",
    tipo:"Workshop",
    ordine:700+index,
    desc:"Workshop di luglio 2027 · Docente: "+x.teacher+".",
    venue:"",
    addr:"",
    maps:"",
    price:"",
    capienza:0,
    pagaOnline:false,
    tbd:false,
    attivo:false,
    poster:"",
    dates:[{label:x.date,sold:0}],
    cast:[{name:x.teacher,slug:""}],
    yepPricing:null,
    saggi:null
  };
}
function renderJulyImportList(){
  var box=$("julyImportList");if(!box)return;
  var existing={};(events||[]).forEach(function(e){existing[String(e.slug||"")]=true});
  box.innerHTML="";
  july2027Seed.forEach(function(x,index){
    var ev=july2027Event(x,index),exists=!!existing[ev.slug];
    var row=document.createElement("label");row.className="import-item";
    row.innerHTML='<input type="checkbox" class="july-import-check" data-index="'+index+'" '+(exists?'disabled':'checked')+'>'+
      '<span class="date">'+escapeHtml(x.date.slice(0,5))+'</span>'+
      '<span><strong>'+escapeHtml(x.title)+'</strong>'+(exists?'<div class="meta">Già presente</div>':'')+'</span>'+
      '<span class="teacher">'+escapeHtml(x.teacher)+'</span>';
    box.appendChild(row);
  });
  box.querySelectorAll(".july-import-check").forEach(function(cb){cb.onchange=updateJulyImportCount});
  updateJulyImportCount();
}
function updateJulyImportCount(){
  var selected=[].slice.call(document.querySelectorAll(".july-import-check:checked")).length;
  var count=$("julyImportCount");if(count)count.textContent=selected+" selezionati";
  var btn=$("confirmJulyImportBtn");if(btn)btn.disabled=!selected;
}
function openJulyImport(){
  if(!ArtyouGoogleAuth.getSession()){setStatus("Accedi con Google prima di continuare.","err");return}
  renderJulyImportList();
  $("julyImportModal").classList.add("open");
}
function closeJulyImport(){$("julyImportModal").classList.remove("open")}
function selectAllJuly(){
  document.querySelectorAll(".july-import-check:not(:disabled)").forEach(function(cb){cb.checked=true});
  updateJulyImportCount();
}
function clearAllJuly(){
  document.querySelectorAll(".july-import-check:not(:disabled)").forEach(function(cb){cb.checked=false});
  updateJulyImportCount();
}
function importJuly2027(){
  var indexes=[].slice.call(document.querySelectorAll(".july-import-check:checked")).map(function(cb){return Number(cb.getAttribute("data-index"))});
  if(!indexes.length){setStatus("Seleziona almeno un evento da importare.","err");return}
  var pending=indexes.map(function(i){return july2027Event(july2027Seed[i],i)});
  if(!confirm("Creare "+pending.length+" workshop selezionati come BOZZE?\\n\\nPrezzo, capienza, sede e locandina resteranno da compilare."))return;

  $("confirmJulyImportBtn").disabled=true;
  var created=0,failed=[];
  var chain=Promise.resolve();
  pending.forEach(function(ev,i){
    chain=chain.then(function(){
      setStatus("Importazione luglio 2027: "+(i+1)+"/"+pending.length+" · "+ev.title,"info");
      return apiPost({action:"save",event:ev}).then(assert).then(function(){created++}).catch(function(err){failed.push(ev.title+": "+err.message)});
    });
  });
  chain.then(function(){
    return apiGet("list").then(assert);
  }).then(function(r){
    events=r.events||[];renderList();closeJulyImport();
    if(failed.length){
      setStatus("Creati "+created+" eventi. "+failed.length+" non importati.","err");
      alert("Importazione parziale.\\n\\n"+failed.join("\\n"));
    }else{
      setStatus("Creati "+created+" workshop di luglio 2027 come bozze.","ok");
    }
  }).catch(function(err){
    setStatus("Importazione non riuscita: "+err.message,"err");
  }).finally(function(){
    $("confirmJulyImportBtn").disabled=false;
  });
}

function save(){
  var e=collect();if(!e.title){setStatus("Inserisci il titolo.","err");return}if(!e.dates.length){setStatus("Inserisci almeno una data.","err");return}
  if(e.eventType==="SAGGI"&&(!e.saggi.show1.title||!e.saggi.show2.title)){setStatus("Per SAGGI inserisci entrambi i titoli degli spettacoli.","err");return}
  setStatus("Salvataggio in corso…","info");
  apiPost({action:"save",event:e}).then(assert).then(function(r){
    currentId=r.event.id;
    try{
      var u=new URL(location.href);u.searchParams.set("edit",r.event.slug||e.slug||"");if(returnTo)u.searchParams.set("return",returnTo);history.replaceState(null,"",u.toString());
    }catch(_){}
    setStatus("Evento aggiornato e sincronizzato con le prenotazioni.","ok");
    location.href="/calendario-docenti/";
    return new Promise(function(){});
  }).catch(function(e){setStatus(e.message,"err")});
}
function del(){
  if(!currentId)return;if(!confirm("Eliminare questo evento? Verrà disattivato anche nel foglio prenotazioni."))return;
  apiPost({action:"delete",id:currentId}).then(assert).then(function(){setStatus("Evento eliminato.","ok");clearForm();refresh()}).catch(function(e){setStatus(e.message,"err")});
}
function updatePoster(){var u=$("poster").value.trim();if(u){$("posterPreview").style.backgroundImage='url("'+u.replace(/"/g,"%22")+'")';$("posterPreview").textContent=""}else{$("posterPreview").style.backgroundImage="";$("posterPreview").textContent="Anteprima locandina"}}
function updatePreviewLink(){var s=$("slug").value.trim()||slugify($("title").value);$("previewBtn").href="/spettacolo.html"+(s?"#"+encodeURIComponent(s):"")}
function prepareInstagram(){
  var e=collect();
  if(!e.title){setStatus("Inserisci almeno il titolo prima di preparare il post Instagram.","err");return}
  var date=(e.dates&&e.dates[0]&&e.dates[0].label)||"";
  var lines=[];
  lines.push("🎭 "+e.title);
  if(date) lines.push("📅 "+date);
  if(e.venue) lines.push("📍 "+e.venue+(e.addr?" · "+e.addr:""));
  if(e.price!==""&&e.price!=null) lines.push("🎟️ "+(Number(e.price)===0?"Ingresso gratuito":"€"+Number(e.price).toFixed(2).replace(".00","")));
  lines.push("");
  if(e.desc) lines.push(e.desc);
  lines.push("");
  lines.push("Prenota dal sito Artyou Roma.");
  var slug=e.slug||slugify(e.title);
  if(slug) lines.push("artyouroma.it/spettacolo.html#"+slug);
  lines.push("");
  lines.push("#artyour​oma #improvvisazione #teatro #roma".replace("\u200b",""));
  $("instagramCaption").value=lines.join("\n");
  var u=e.poster||"";
  if(u){$("instagramPreview").style.backgroundImage='url("'+u.replace(/"/g,"%22")+'")';$("instagramPreview").textContent=""}
  else{$("instagramPreview").style.backgroundImage="";$("instagramPreview").textContent="Nessuna locandina impostata"}
  $("instagramPreviewMeta").className="status ok";
  $("instagramPreviewMeta").textContent="Post pronto in anteprima. Nessuna pubblicazione è stata effettuata.";
}
function copyInstagram(){
  var t=$("instagramCaption").value.trim();
  if(!t){prepareInstagram();t=$("instagramCaption").value.trim()}
  if(!t)return;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(function(){setStatus("Testo Instagram copiato negli appunti.","ok")}).catch(function(){fallbackCopyInstagram(t)});
  }else fallbackCopyInstagram(t);
}
function fallbackCopyInstagram(t){
  var ta=document.createElement("textarea");ta.value=t;document.body.appendChild(ta);ta.select();
  try{document.execCommand("copy");setStatus("Testo Instagram copiato negli appunti.","ok")}catch(e){setStatus("Copia non riuscita: seleziona il testo manualmente.","err")}
  ta.remove();
}
function publishInstagram(){
  var e=collect();
  if(!e.title){setStatus("Inserisci il titolo prima di pubblicare su Instagram.","err");return}
  if(!$("instagramCaption").value.trim())prepareInstagram();
  var caption=$("instagramCaption").value.trim();
  var image=e.poster||"";
  if(!image){setStatus("Per pubblicare su Instagram serve una locandina.","err");return}
  try{image=new URL(image,window.location.origin).href}catch(err){}
  if(!/^https:\/\//i.test(image)){setStatus("La locandina deve avere un URL pubblico HTTPS.","err");return}
  if(!confirm("Pubblicare davvero questo contenuto su Instagram @artyouroma?"))return;
  $("publishInstagramBtn").disabled=true;
  setStatus("Pubblicazione su Instagram in corso…","info");
  fetch("/api/instagram-publish",{
    method:"POST",
    credentials:"same-origin",
    headers:ArtyouGoogleAuth.authHeaders({"Content-Type":"application/json"}),
    body:JSON.stringify({caption:caption,imageUrl:image})
  }).then(function(r){return r.json().then(function(j){return {ok:r.ok,data:j}})})
    .then(function(x){
      if(!x.ok||!x.data||!x.data.ok)throw new Error((x.data&&x.data.errore)||"Pubblicazione non riuscita");
      $("instagramPreviewMeta").className="status ok";
      $("instagramPreviewMeta").textContent="Pubblicato su Instagram. Media ID: "+x.data.media_id;
      setStatus("Post pubblicato su Instagram.","ok");
    })
    .catch(function(err){
      $("instagramPreviewMeta").className="status err";
      $("instagramPreviewMeta").textContent="Errore Instagram: "+err.message;
      setStatus("Errore Instagram: "+err.message,"err");
    })
    .finally(function(){$("publishInstagramBtn").disabled=false});
}
function upload(){
  var file=$("posterFile").files[0];if(!file){setStatus("Scegli prima un'immagine.","err");return}
  if(file.size>5*1024*1024){setStatus("Immagine troppo grande: massimo 5 MB.","err");return}
  var reader=new FileReader();setStatus("Caricamento immagine…","info");
  reader.onload=function(){var b64=String(reader.result).split(",")[1]||"";apiPost({action:"uploadimage",name:file.name,mime:file.type,base64:b64}).then(assert).then(function(r){$("poster").value=r.url;updatePoster();setStatus("Immagine caricata.","ok")}).catch(function(e){setStatus(e.message,"err")})};reader.readAsDataURL(file);
}
$("refreshBtn").onclick=refresh;$("eventSearch").oninput=renderList;$("eventStatusFilter").onchange=renderList;$("newBtn").onclick=clearForm;$("saveBtn").onclick=save;$("importJuly2027Btn").onclick=openJulyImport;$("closeJulyImportBtn").onclick=closeJulyImport;$("selectAllJulyBtn").onclick=selectAllJuly;$("clearAllJulyBtn").onclick=clearAllJuly;$("confirmJulyImportBtn").onclick=importJuly2027;$("julyImportModal").onclick=function(e){if(e.target===$("julyImportModal"))closeJulyImport()};$("deleteBtn").onclick=del;
$("logoutBtn").onclick=function(){
  ArtyouGoogleAuth.clear();
  location.reload();
};
$("addDateBtn").onclick=function(){addDate()};$("addCastBtn").onclick=function(){addCast()};$("poster").oninput=updatePoster;$("uploadBtn").onclick=upload;
$("prepareInstagramBtn").onclick=prepareInstagram;$("copyInstagramBtn").onclick=copyInstagram;$("publishInstagramBtn").onclick=publishInstagram;
$("title").oninput=function(){if(!currentId&&!$("slug").value.trim())$("slug").value=slugify(this.value);updatePreviewLink()};$("slug").oninput=updatePreviewLink;$("eventType").onchange=toggleSaggiFields;
clearForm();
if(!endpoint){
  setStatus("Endpoint Gestionale non configurato.","err");
}else{
  ArtyouGoogleAuth.init({
    buttonId:"googleLoginButton",
    statusId:"status",
    roles:["admin","staff"],
    onAuthorized:function(session){
      $("logoutBtn").style.display="inline-block";
      setStatus("Accesso autorizzato · "+(session.name||session.email||""),"ok");
      refresh();
    }
  });
}
})();
