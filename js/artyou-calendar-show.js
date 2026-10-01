(function(){
"use strict";

var STYLE_ID="artyou-show-calendar-style";
var CARD_ID="artyou-show-calendar-card";

function ensureStyle(){
  if(document.getElementById(STYLE_ID)) return;
  var s=document.createElement("style");
  s.id=STYLE_ID;
  s.textContent=
    "#"+CARD_ID+"{background:#fff;border:1px solid #E4DED2;border-radius:20px;padding:24px 26px;display:flex;flex-direction:column;gap:16px}"+
    "#"+CARD_ID+" .ac-title{margin:0;font-family:'Bricolage Grotesque',Georgia,sans-serif;font-weight:800;font-size:28px;line-height:1.1;color:#13181D}"+
    "#"+CARD_ID+" .ac-sub{margin:4px 0 0;font-size:15px;line-height:1.45;color:#555D64}"+
    "#"+CARD_ID+" .ac-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}"+
    "#"+CARD_ID+" .ac-btn{min-height:52px;border-radius:999px;border:1px solid #CFC8BA;background:#fff;color:#13181D;display:flex;align-items:center;justify-content:center;gap:9px;padding:0 16px;font-family:inherit;font-size:14px;font-weight:800;text-decoration:none;cursor:pointer;text-align:center}"+
    "#"+CARD_ID+" .ac-btn.primary{background:#123E73;border-color:#123E73;color:#fff}"+
    "@media(max-width:820px){#"+CARD_ID+"{padding:20px}#"+CARD_ID+" .ac-title{font-size:25px}#"+CARD_ID+" .ac-actions{grid-template-columns:1fr}#"+CARD_ID+" .ac-btn{width:100%}}";
  document.head.appendChild(s);
}

function currentSlug(){
  try{
    var m=location.pathname.match(/^\/spettacoli\/([^\/]+)\/?$/);
    if(m&&m[1]) return decodeURIComponent(m[1]);
    return decodeURIComponent((location.hash||"").replace(/^#/,""));
  }catch(e){ return ""; }
}

function selectedShow(){
  var slug=currentSlug();
  var list=window.ARTYOU_DYNAMIC_SHOWS||[];
  var show=list.filter(function(x){return x&&x.slug===slug;})[0];
  if(show) return show;

  // Fallback robusto: ricava i dati direttamente dalla pagina già renderizzata.
  var h1=document.querySelector("main h1");
  var title=h1 ? (h1.textContent||"").trim() : "Evento Artyou";

  var when="";
  var venue="";
  var addr="";
  var dts=Array.from(document.querySelectorAll("main dt"));
  dts.forEach(function(dt){
    var key=(dt.textContent||"").trim().toLowerCase();
    var dd=dt.parentElement&&dt.parentElement.querySelector("dd");
    var val=dd ? (dd.textContent||"").trim() : "";
    if(key==="quando") when=val;
    if(key==="dove"){
      venue=val;
      var strong=dd&&dd.querySelector("strong");
      if(strong){
        venue=(strong.textContent||"").trim();
        addr=val.replace(venue,"").replace(/^\s*[·-]\s*/,"").trim();
      }
    }
  });

  if(!venue){
    var mapLink=Array.from(document.querySelectorAll('a[target="_blank"]')).find(function(a){
      return /Apri in Google Maps/i.test(a.textContent||"");
    });
    if(mapLink){
      var spans=mapLink.querySelectorAll("span");
      if(spans.length){
        var texts=Array.from(spans).map(function(s){return (s.textContent||"").trim();}).filter(Boolean);
        if(texts.length) venue=texts[0];
        if(texts.length>1) addr=texts[1];
      }
    }
  }

  if(!when) return null;

  return {
    slug: slug||"evento",
    title: title||"Evento Artyou",
    desc: "",
    venue: venue||"Roma",
    addr: addr||"",
    dates:[{label:when}]
  };
}

function selectedDateIndex(){
  var hidden=document.getElementById("f-evento-id");
  if(!hidden||!hidden.value) return 0;
  var show=selectedShow();
  if(!show||!Array.isArray(show.dates)||show.dates.length<2) return 0;
  var prefix=(show.slug||"")+"-";
  if(hidden.value.indexOf(prefix)===0){
    var n=parseInt(hidden.value.slice(prefix.length),10);
    if(Number.isFinite(n)&&n>=0&&n<show.dates.length) return n;
  }
  return 0;
}

function pad(n){return String(n).padStart(2,"0");}
function stamp(d){return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+"T"+pad(d.getHours())+pad(d.getMinutes())+"00";}

function parseDate(label,timeHint){
  var raw=String(label||"").trim();
  var timeRaw=String(timeHint||"").trim();
  var low=(raw+" "+timeRaw).toLowerCase();
  if(!low||/definire|arrivo|tbd/.test(low)) return null;

  var months={gennaio:0,febbraio:1,marzo:2,aprile:3,maggio:4,giugno:5,luglio:6,agosto:7,settembre:8,ottobre:9,novembre:10,dicembre:11};
  var weekdays={domenica:0,lunedì:1,lunedi:1,martedì:2,martedi:2,mercoledì:3,mercoledi:3,giovedì:4,giovedi:4,venerdì:5,venerdi:5,sabato:6};
  var day=null,month=null,year=null,m;

  if((m=low.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))){
    year=parseInt(m[1],10); month=parseInt(m[2],10)-1; day=parseInt(m[3],10);
  } else if((m=low.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))){
    day=parseInt(m[1],10); month=parseInt(m[2],10)-1; year=parseInt(m[3],10); if(year<100)year+=2000;
  } else if((m=low.match(/(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?/i))){
    day=parseInt(m[1],10); month=months[m[2].toLowerCase()]; year=m[3]?parseInt(m[3],10):null;
  } else {
    return null;
  }

  var tm=low.match(/(?:dalle|alle|ore)?\s*(\d{1,2})[:.]([0-5]\d)/i);
  var hour=tm?parseInt(tm[1],10):20;
  var minute=tm?parseInt(tm[2],10):30;
  var now=new Date();

  if(!year){
    var wd=null;
    Object.keys(weekdays).some(function(k){if(low.indexOf(k)>=0){wd=weekdays[k];return true;}return false;});
    for(var y=now.getFullYear();y<=now.getFullYear()+3;y++){
      var cand=new Date(y,month,day,hour,minute,0,0);
      if((wd===null||cand.getDay()===wd)&&cand.getTime()>=now.getTime()-7*86400000){year=y;break;}
    }
    if(!year) year=now.getFullYear();
  }
  return new Date(year,month,day,hour,minute,0,0);
}

function escIcs(v){
  return String(v||"").replace(/\\/g,"\\\\").replace(/\n/g,"\\n").replace(/,/g,"\\,").replace(/;/g,"\\;");
}

function findInsertPoint(){
  var links=Array.from(document.querySelectorAll('a[target="_blank"]'));
  return links.find(function(a){return /Apri in Google Maps/i.test(a.textContent||"");})||null;
}

function build(){
  var show=selectedShow();
  if(!show||!Array.isArray(show.dates)||!show.dates.length) return false;
  var idx=selectedDateIndex();
  var date=show.dates[idx]||show.dates[0]||{};
  var dateText=[date.label,date.data,date.date,show.data].filter(Boolean).join(" ");
  var timeText=[date.ora,date.time,show.ora].filter(Boolean).join(" ");
  var start=parseDate(dateText,timeText);
  var anchor=findInsertPoint();
  if(!anchor||!anchor.parentNode) return false;

  ensureStyle();

  var card=document.getElementById(CARD_ID);
  if(!card){
    card=document.createElement("div");
    card.id=CARD_ID;
    anchor.parentNode.insertBefore(card,anchor.nextSibling);
  }

  if(!start){
    card.innerHTML=
      '<div><h2 class="ac-title">Aggiungi al calendario</h2><p class="ac-sub">Data e orario in aggiornamento dal gestionale.</p></div>'+
      '<div class="ac-actions">'+
      '<button type="button" class="ac-btn primary" disabled style="opacity:.45;cursor:not-allowed">APPLE / CALENDARIO</button>'+
      '<span class="ac-btn" style="opacity:.45;cursor:not-allowed">GOOGLE CALENDAR</span>'+
      '<button type="button" class="ac-btn" disabled style="opacity:.45;cursor:not-allowed">SCARICA .ICS</button>'+
      '</div>';
    return true;
  }
  var end=new Date(start.getTime()+2*60*60*1000);

  var title=show.title||"Evento Artyou";
  var venue=[show.venue||"",show.addr||""].filter(Boolean).join(" · ");
  var pageUrl=location.href.split("#")[0]+(location.hash||"");
  var details=(show.desc||"")+"\n\nInformazioni e prenotazioni: "+pageUrl;
  var google="https://calendar.google.com/calendar/render?action=TEMPLATE"
    +"&text="+encodeURIComponent(title)
    +"&dates="+stamp(start)+"%2F"+stamp(end)
    +"&details="+encodeURIComponent(details)
    +"&location="+encodeURIComponent(venue)
    +"&ctz=Europe%2FRome";

  card.innerHTML=
    '<div><h2 class="ac-title">Aggiungi al calendario</h2><p class="ac-sub">Salva l’evento e ricevi un promemoria.</p></div>'+
    '<div class="ac-actions">'+
    '<button type="button" class="ac-btn primary" data-ac-download>APPLE / CALENDARIO</button>'+
    '<a class="ac-btn" target="_blank" rel="noopener" href="'+google+'">GOOGLE CALENDAR</a>'+
    '<button type="button" class="ac-btn" data-ac-download>SCARICA .ICS</button>'+
    '</div>';

  function download(){
    var uid=(show.slug||"evento")+"-"+stamp(start)+"@artyouroma.it";
    var ics=[
      "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Artyou Roma//Eventi//IT","CALSCALE:GREGORIAN","METHOD:PUBLISH",
      "BEGIN:VEVENT","UID:"+uid,"DTSTAMP:"+stamp(new Date())+"Z",
      "DTSTART;TZID=Europe/Rome:"+stamp(start),
      "DTEND;TZID=Europe/Rome:"+stamp(end),
      "SUMMARY:"+escIcs(title),
      "DESCRIPTION:"+escIcs(details),
      "LOCATION:"+escIcs(venue),
      "URL:"+pageUrl,
      "END:VEVENT","END:VCALENDAR"
    ].join("\r\n");
    var blob=new Blob([ics],{type:"text/calendar;charset=utf-8"});
    var u=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=u;a.download=(show.slug||"evento-artyou")+".ics";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(u);},1200);
  }

  card.querySelectorAll("[data-ac-download]").forEach(function(b){b.onclick=download;});
  return true;
}

function refresh(){
  var tries=0;
  var t=setInterval(function(){
    tries++;
    if(build()||tries>30) clearInterval(t);
  },150);
}

window.addEventListener("artyou-events-loaded",refresh);
window.addEventListener("hashchange",function(){
  var old=document.getElementById(CARD_ID);if(old)old.remove();
  refresh();
});
document.addEventListener("click",function(e){
  if(e.target&&e.target.closest&&e.target.closest('button[onClick*="pick"],button')) setTimeout(build,80);
});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",refresh);else refresh();
})();