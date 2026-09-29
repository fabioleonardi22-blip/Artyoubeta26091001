(function(){
"use strict";
var ENDPOINT=window.ARTYOU_BOOKING_ENDPOINT||"";
var WA="https://wa.me/393271881956?text="+encodeURIComponent("Ciao! Ho bisogno di aiuto con una prenotazione Artyou.");
function q(id){return document.getElementById("f-"+id)||document.getElementById("p-"+id);}
function txt(el){return (el&&(el.innerText||el.textContent)||"").replace(/\s+/g," ").trim();}
function msg(b,k,h){document.querySelectorAll(".artyou-booking-msg").forEach(x=>x.remove());var d=document.createElement("div");d.className="artyou-booking-msg "+k;d.style.cssText="margin-top:12px;padding:12px 14px;border-radius:10px;font-size:14px;line-height:1.45;"+(k==="err"?"background:#fff1f0;border:1px solid #ffccc7;color:#8c1d18;":k==="ok"?"background:#f6ffed;border:1px solid #b7eb8f;color:#275c14;":"background:#fffbe6;border:1px solid #ffe58f;color:#6b4e00;");d.innerHTML=h;b.insertAdjacentElement("afterend",d);}
function submitBtn(t){var b=t.closest&&t.closest("button");if(!b)return null;var l=txt(b),a=b.getAttribute("onclick")||b.getAttribute("onClick")||"";if(!/\b(invia|prenota|conferma|avvisami|paga)\b/i.test(l)&&!/\b(send|submit|confirm)\b/i.test(a))return null;if(!q("nome"))return null;return b;}
function evento(){var h=document.getElementById("f-evento-id");if(h&&h.value)return h.value;var h1=document.querySelector("h1");return h1?txt(h1):"";}
function posti(b){var h=document.getElementById("f-posti");if(h&&h.value)return parseInt(h.value,10)||1;var m=txt(b).match(/(\d+)\s+post/i);if(m)return parseInt(m[1],10)||1;var s=document.querySelector('select[id*="posti"],select[name*="posti"]');return s?(parseInt(s.value,10)||1):1;}
function collect(b){
var pe=document.getElementById("f-paga-online"),pr=document.getElementById("f-prezzo"),n=posti(b),p=pr?parseFloat(pr.value):NaN,on=!!(pe&&pe.value==="true");
var d={action:"prenota",Modulo:window.ARTYOU_BOOKING_MODULE||"Prenotazione",Evento:evento(),Nome:q("nome")?q("nome").value.trim():"",Cognome:q("cognome")?q("cognome").value.trim():"",Telefono:q("tel")?q("tel").value.trim():"",Email:q("mail")?q("mail").value.trim():"",Posti:n,Pagamento:on?"PayPal (online)":"In cassa",Importo:(!isNaN(p)&&p>0)?(p*n).toFixed(2):""};
if(window.ARTYOU_BOOKING_DEFAULT_DATE)d["Data evento"]=window.ARTYOU_BOOKING_DEFAULT_DATE;
if(window.ARTYOU_BOOKING_DEFAULT_TIME)d["Ora evento"]=window.ARTYOU_BOOKING_DEFAULT_TIME;
var rs=document.getElementById("f-risorse"),sr=document.getElementById("f-scelta-rif"),sy=document.getElementById("f-scelta-yep");
if(rs&&rs.value)d.Risorse=rs.value;
if(sr&&sr.value)d.Scelte=sr.value;else if(sy&&sy.value)d.Scelte=sy.value;
var ny=document.getElementById("f-note-yep");if(ny&&ny.value)d.Note=ny.value;
document.querySelectorAll("#f-camera,#f-cibo,#f-scuola").forEach(function(el){if(el&&el.value&&el.value.trim())d[el.id.replace(/^f-/,"")]=el.value.trim();});
return d;
}
function validate(d){
if(!d.Evento)return"Seleziona lo spettacolo.";
if(!d.Nome)return"Inserisci il nome.";
if(!d.Cognome)return"Inserisci il cognome.";
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.Email))return"Inserisci un'email valida.";
if((d.Telefono||"").replace(/\D/g,"").length<8)return"Inserisci un numero di telefono valido.";
var p=document.getElementById("f-privacy");
if(p&&!p.checked)return"Devi accettare la privacy policy.";
return"";
}
function post(d){return fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(d)}).then(function(r){return r.text().then(function(t){var j;try{j=JSON.parse(t);}catch(e){throw new Error("HTTP "+r.status+" · risposta non JSON: "+t.slice(0,160));}j.__http=r.status;return j;});});}
function avail(){
if(!ENDPOINT)return;
var candidates=[];
if(Array.isArray(window.ARTYOU_BOOKING_EVENT_IDS)){
  candidates=window.ARTYOU_BOOKING_EVENT_IDS.map(function(v){return String(v||"").trim();}).filter(Boolean);
}else{
  var exact=String(window.ARTYOU_BOOKING_EVENT_ID||"").trim();
  if(exact)candidates=[exact];
}

if(candidates.length){
  (function tryCandidate(i){
    if(i>=candidates.length){
      window.dispatchEvent(new CustomEvent("artyou:capacity-error",{detail:{endpoint:ENDPOINT,eventi:candidates}}));
      return;
    }
    var exact=candidates[i];
    fetch(ENDPOINT+"?evento="+encodeURIComponent(exact),{cache:"no-store"})
      .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
      .then(function(res){
        if(!res||res.ok===false||typeof res.liberi!=="number"){
          tryCandidate(i+1);
          return;
        }
        window.ARTYOU_BOOKING_EVENT_ID=exact;
        window.ARTYOU_BOOKING_RESOLVED_EVENT_ID=exact;
        var hidden=document.getElementById("f-evento-id");
        if(hidden)hidden.value=exact;
        window.ARTYOU_CAP=window.ARTYOU_CAP||{};
        window.ARTYOU_CAP[exact]=Math.max(0,Number(res.liberi)||0);
        if(res.info){
          window.ARTYOU_EVENT_INFO=window.ARTYOU_EVENT_INFO||{};
          window.ARTYOU_EVENT_INFO[exact]=res.info;
        }
        window.dispatchEvent(new CustomEvent("artyou:capacity-updated",{detail:{
          disponibilita:window.ARTYOU_CAP,
          eventi:window.ARTYOU_EVENT_INFO||{},
          evento:exact
        }}));
      })
      .catch(function(){tryCandidate(i+1);});
  })(0);
  return;
}

var fast=!!window.ARTYOU_BOOKING_CAPACITY_ONLY;
var reqs=[
  fetch(ENDPOINT+"?disponibilita=1",{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).catch(function(){return null;})
];
if(!fast){
  reqs.push(fetch(ENDPOINT+"?eventi=1",{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).catch(function(){return null;}));
}
Promise.all(reqs).then(function(all){
  var cap=all[0], ev=fast?null:all[1], changed=false;
  if(cap&&cap.disponibilita&&typeof cap.disponibilita==="object"){
    window.ARTYOU_CAP=Object.assign({},window.ARTYOU_CAP||{},cap.disponibilita);
    changed=true;
  }
  if(ev&&ev.eventi&&typeof ev.eventi==="object"){
    window.ARTYOU_EVENT_INFO=Object.assign({},window.ARTYOU_EVENT_INFO||{},ev.eventi);
    changed=true;
  }
  if(changed){
    window.dispatchEvent(new Event("hashchange"));
    window.dispatchEvent(new CustomEvent("artyou:capacity-updated",{detail:{
      disponibilita:window.ARTYOU_CAP||{},
      eventi:window.ARTYOU_EVENT_INFO||{}
    }}));
  }else{
    window.dispatchEvent(new CustomEvent("artyou:capacity-error",{detail:{endpoint:ENDPOINT}}));
  }
});
}
document.addEventListener("click",function(e){var b=submitBtn(e.target);if(!b)return;if(b.dataset.artyouBookingBypass==="1"){delete b.dataset.artyouBookingBypass;return;}e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(!ENDPOINT){msg(b,"err",'Sistema prenotazioni non configurato. <a href="'+WA+'" target="_blank" rel="noopener">Scrivici su WhatsApp</a>.');return;}var d=collect(b),er=validate(d);if(er){msg(b,"err",er);return;}if(b.dataset.artyouBusy==="1")return;b.dataset.artyouBusy="1";b.style.opacity=".6";msg(b,"wait","Verifica disponibilità e invio in corso…");post(d).then(res=>{if(!res||!res.ok){
if(res&&(res.errore==="esaurito"||res.errore==="posti_insufficienti"))throw new Error("Sono rimasti "+(res.liberi||0)+" posti disponibili.");
if(res&&res.errore==="prenotazioni_chiuse")throw new Error("Le prenotazioni per questo evento sono chiuse.");
if(res&&res.errore==="prenotazioni_non_aperte")throw new Error("Le prenotazioni per questo evento non sono ancora aperte.");
var base=(res&&res.errore)||"Invio non riuscito.";
if(window.ARTYOU_BOOKING_DEBUG)base+=" [Evento: "+(d.Evento||"-")+" · HTTP: "+(res&&res.__http||"-")+"]";
throw new Error(base);
}if(window.ARTYOU_CAP&&d.Evento&&typeof res.liberi==="number"){window.ARTYOU_CAP[d.Evento]=res.liberi;window.dispatchEvent(new Event("hashchange"));}var codice=res.codice||res.id||"";var h=codice?'Prenotazione registrata. Codice: <b>'+codice+'</b>.':"Prenotazione registrata.";if(res.stato==="HOLD")h+=" I posti sono bloccati per <b>"+res.holdMinutes+" minuti</b> in attesa del pagamento.";else h+=" I posti sono stati riservati.";msg(b,"ok",h);if(codice){window.dispatchEvent(new CustomEvent("artyou-booking-code",{detail:codice}));}
window.dispatchEvent(new CustomEvent("artyou:booking-success",{detail:res}));
avail();
b.dataset.artyouBookingBypass="1";
setTimeout(()=>{try{b.click();}catch(_){ }},100);}).catch(err=>{var em=(err&&err.message?err.message:"Invio non riuscito.");if(window.ARTYOU_BOOKING_DEBUG)em+=" [Evento: "+(d.Evento||"-")+" · Risorse: "+(d.Risorse||"-")+"]";msg(b,"err",em+' <a href="'+WA+'" target="_blank" rel="noopener">Contattaci su WhatsApp</a>.');}).finally(()=>{delete b.dataset.artyouBusy;b.style.opacity="";});},true);
avail();
})();