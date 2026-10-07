(function(){
"use strict";
var endpoint="/api/admin-dashboard";
var data=[],filtered=[];
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function getJSON(url){return fetch(url,{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json()})}
function statusFor(free,cap){if(free<=0)return{label:"Sold out",cls:"full"};if(cap>0&&free/cap<=.2)return{label:"Quasi pieno",cls:"warn"};return{label:"Aperto",cls:"ok"}}
var WORKSHOW_CATALOG=[
 {ids:["tra-fiaba-horror-un-confine-sottile-con-niko-di-felice"],words:["tra fiaba","horror","niko di felice"]},
 {ids:["from-text-to-next-con-federica-forbicioni","from-text-to-next"],words:["from text to next","federica forbicioni"]},
 {ids:["thriller-con-cinzia-zadro","thriller"],words:["thriller","cinzia zadro"]},
 {ids:["laboratorio-avanzati-con-antonio-vulpio","laboratorio-avanzati"],words:["laboratorio avanzati","antonio vulpio","vulpio"]},
 {ids:["human-comedy-con-fabio-mangolini","human-comedy"],words:["human comedy","fabio mangolini","maschera"]},
 {ids:["improv-di-una-notte-di-mezza-primavera-con-pierpaolo-buzza","improv-di-una-notte-di-mezza-primavera"],words:["mezza primavera","shakespeare","pierpaolo buzza"]}
];
function isWorkshow(title,id){var iid=String(id||"").toLowerCase(),hay=(String(id||"")+" "+String(title||"")).toLowerCase();if(hay.indexOf("workshow")>=0)return true;for(var i=0;i<WORKSHOW_CATALOG.length;i++){var w=WORKSHOW_CATALOG[i];if(w.ids.indexOf(iid)>=0)return true;for(var j=0;j<w.words.length;j++)if(hay.indexOf(w.words[j])>=0)return true}return false}
function categoryOf(title,id,tipo){var t=(String(id||"")+" "+String(title||"")).toLowerCase(),bt=String(tipo||"").trim().toLowerCase();if(isWorkshow(title,id)||bt==="workshow")return"WorkshoW";if(t.indexOf("yep")>=0)return"YEP";if(t.indexOf("festival")>=0||t.indexOf("rif")>=0)return"Festival";if(bt==="workshop")return"Workshop";return"Spettacoli"}
function normDate(v){var s=String(v||"").trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;var m=s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);if(m)return m[3]+"-"+String(m[2]).padStart(2,"0")+"-"+String(m[1]).padStart(2,"0");return""}
function populateEvents(){var sel=$("eventFilter"),keep=sel.value;sel.innerHTML='<option value="all">Tutti gli eventi</option>';data.forEach(function(x){var o=document.createElement("option");o.value=x.id;o.textContent=x.title;sel.appendChild(o)});if([].slice.call(sel.options).some(function(o){return o.value===keep}))sel.value=keep}
function applyFilters(){
 var event=$("eventFilter").value,type=$("typeFilter").value,status=$("statusFilter").value,q=$("search").value.trim().toLowerCase(),from=$("fromDate").value,to=$("toDate").value;
 filtered=data.filter(function(x){
   var st=statusFor(x.free,x.cap).label,d=x.sortDate||normDate(x.date);
   if(event!=="all"&&x.id!==event)return false;
   if(type!=="all"&&x.category!==type)return false;
   if(status!=="all"&&st!==status)return false;
   if(q&&(x.title+" "+x.category+" "+x.date).toLowerCase().indexOf(q)<0)return false;
   if(from&&d&&d<from)return false;if(to&&d&&d>to)return false;
   return true;
 });
 render();
}
function render(){
 var tb=$("rows"),cards=$("cards");tb.innerHTML="";cards.innerHTML="";
 if(!filtered.length){tb.innerHTML='<tr><td colspan="9" class="empty">Nessun evento corrisponde ai filtri.</td></tr>';cards.innerHTML='<div class="empty">Nessun evento corrisponde ai filtri.</div>';return}
 filtered.forEach(function(x){
   var pct=x.cap>0?Math.round((x.booked/x.cap)*100):0,st=statusFor(x.free,x.cap),tr=document.createElement("tr");
   tr.innerHTML='<td>'+esc(x.date||"—")+'</td><td><b>'+esc(x.title)+'</b></td><td>'+esc(x.category)+'</td><td class="center">'+x.cap+'</td><td class="center"><b>'+x.booked+'</b></td><td class="center">'+x.free+'</td><td>'+pct+'%</td><td><span class="badge '+st.cls+'">'+st.label+'</span></td><td class="no-print"><div class="action-set"><button class="icon-btn" title="Apri">◉</button><a class="icon-btn edit" title="Modifica" href="/gestionale.html" style="display:grid;place-items:center">✎</a></div></td>';
   tb.appendChild(tr);
   var c=document.createElement("div");c.className="mcard";c.innerHTML='<div class="mhead"><div><b>'+esc(x.title)+'</b><div class="muted">'+esc(x.date)+'</div></div><span class="badge '+st.cls+'">'+st.label+'</span></div><div class="mgrid"><div class="mini"><b>'+x.booked+'</b><span>Prenotati</span></div><div class="mini"><b>'+x.free+'</b><span>Liberi</span></div><div class="mini"><b>'+x.cap+'</b><span>Capienza</span></div></div>';cards.appendChild(c)
 });
}
function updateStats(){
 var booked=data.reduce(function(s,x){return s+x.booked},0),available=data.reduce(function(s,x){return s+x.free},0),sold=data.filter(function(x){return x.free<=0}).length;
 $("sBooked").textContent=booked;$("sFree").textContent=available;$("sEvents").textContent=data.length;$("sSold").textContent=sold
}
function refresh(){
 $("rows").innerHTML='<tr><td colspan="9" class="empty">Caricamento…</td></tr>';
 getJSON(endpoint+"?_="+Date.now()).then(function(r){
   if(!r.ok)throw new Error(r.errore||"Errore dati");
   var events=r.eventi||{},free=r.disponibilita||{};
   data=Object.keys(events).map(function(id){var e=events[id]||{},cap=Math.max(0,parseInt(e.capienza||0,10)||0),f=Math.max(0,parseInt(free[id]||0,10)||0),sortDate=String(e.dataInput||normDate(e.data)||""),sortTime=String(e.oraInput||e.ora||"");return{id:id,title:e.titolo||id,date:e.data||"",cap:cap,free:f,booked:Math.max(0,cap-f),category:categoryOf(e.titolo||id,id,e.tipo),sortDate:sortDate,sortTime:sortTime}}).sort(function(a,b){var da=a.sortDate||"9999-12-31",db=b.sortDate||"9999-12-31";if(da!==db)return da.localeCompare(db);return(a.sortTime||"").localeCompare(b.sortTime||"")});
   updateStats();populateEvents();$("updated").value="Aggiornato "+new Date().toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit",second:"2-digit"});applyFilters()
 }).catch(function(err){$("rows").innerHTML='<tr><td colspan="9" class="error">Impossibile caricare i dati: '+esc(err.message)+'</td></tr>'})
}
function xlsEsc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function exportExcel(){
 var rows=[["Data","Evento","Tipo","Capienza","Prenotati","Disponibili","Riempimento","Stato"]];
 filtered.forEach(function(x){var pct=x.cap>0?Math.round(x.booked/x.cap*100):0,st=statusFor(x.free,x.cap).label;rows.push([x.date,x.title,x.category,x.cap,x.booked,x.free,pct+"%",st])});
 var xml='<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Prenotazioni"><Table>'+rows.map(function(r){return"<Row>"+r.map(function(v){return'<Cell><Data ss:Type="String">'+xlsEsc(v)+'</Data></Cell>'}).join("")+"</Row>"}).join("")+'</Table></Worksheet></Workbook>';
 var blob=new Blob([xml],{type:"application/vnd.ms-excel;charset=utf-8"}),a=document.createElement("a"),d=new Date().toISOString().slice(0,10);a.href=URL.createObjectURL(blob);a.download="Prenotazioni_ArtyouRoma_"+d+".xls";document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},100)
}
$("refresh").onclick=refresh;$("printBtn").onclick=function(){window.print()};$("exportBtn").onclick=exportExcel;
["eventFilter","typeFilter","statusFilter","fromDate","toDate"].forEach(function(id){$(id).addEventListener("change",applyFilters)});$("search").addEventListener("input",applyFilters);
$("clearFilters").onclick=function(){$("eventFilter").value="all";$("typeFilter").value="all";$("statusFilter").value="all";$("fromDate").value="";$("toDate").value="";$("search").value="";applyFilters()};
ArtyouGoogleAuth.init({
  buttonId:"googleLoginButton",
  statusId:"loginStatus",
  roles:["admin","staff"],
  onAuthorized:function(){
    $("authGate").classList.add("hidden");
    refresh();
    setInterval(refresh,10000);
  }
});
})();
