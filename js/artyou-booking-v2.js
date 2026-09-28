(function(){
"use strict";
var ENDPOINT=window.ARTYOU_BOOKING_ENDPOINT||"";
var WA="https://wa.me/393271881956?text="+encodeURIComponent("Ciao! Ho bisogno di aiuto con una prenotazione Artyou.");
function q(id){return document.getElementById("f-"+id)||document.getElementById("p-"+id);}
function txt(el){return (el&&(el.innerText||el.textContent)||"").replace(/\s+/g," ").trim();}
function msg(b,k,h){document.querySelectorAll(".artyou-booking-msg").forEach(x=>x.remove());var d=document.createElement("div");d.className="artyou-booking-msg "+k;d.style.cssText="margin-top:12px;padding:12px 14px;border-radius:10px;font-size:14px;line-height:1.45;"+(k==="err"?"background:#fff1f0;border:1px solid #ffccc7;color:#8c1d18;":k==="ok"?"background:#f6ffed;border:1px solid #b7eb8f;color:#275c14;":"background:#fffbe6;border:1px solid #ffe58f;color:#6b4e00;");d.innerHTML=h;b.insertAdjacentElement("afterend",d);}
function submitBtn(t){var b=t.closest&&t.closest("button");if(!b)return null;var l=txt(b),a=b.getAttribute("onclick")||b.getAttribute("onClick")||"";if(!/invia|prenota|conferma|avvisami|paga/i.test(l)&&!/send|submit|confirm/i.test(a))return null;if(!q("nome"))return null;return b;}
function evento(){var h=document.getElementById("f-evento-id");if(h&&h.value)return h.value;var h1=document.querySelector("h1");return h1?txt(h1):"";}
function posti(b){var m=txt(b).match(/(\d+)\s+post/i);if(m)return parseInt(m[1],10)||1;var s=document.querySelector('select[id*="posti"],select[name*="posti"]');return s?(parseInt(s.value,10)||1):1;}
function collect(b){var pe=document.getElementById("f-paga-online"),pr=document.getElementById("f-prezzo"),n=posti(b),p=pr?parseFloat(pr.value):NaN,on=!!(pe&&pe.value==="true");return{action:"prenota",Evento:evento(),Nome:q("nome")?q("nome").value.trim():"",Cognome:q("cognome")?q("cognome").value.trim():"",Telefono:q("tel")?q("tel").value.trim():"",Email:q("mail")?q("mail").value.trim():"",Posti:n,Pagamento:on?"PayPal (online)":"In cassa",Importo:(!isNaN(p)&&p>0)?(p*n).toFixed(2):""};}
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
function post(d){return fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(d)}).then(r=>r.json());}
function avail(){if(!ENDPOINT)return;fetch(ENDPOINT+"?disponibilita=1").then(r=>r.json()).then(res=>{if(res&&res.disponibilita){window.ARTYOU_CAP=Object.assign({},window.ARTYOU_CAP||{},res.disponibilita);window.dispatchEvent(new Event("hashchange"));}}).catch(()=>{});}
document.addEventListener("click",function(e){var b=submitBtn(e.target);if(!b)return;if(b.dataset.artyouBookingBypass==="1"){delete b.dataset.artyouBookingBypass;return;}e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(!ENDPOINT){msg(b,"err",'Sistema prenotazioni non configurato. <a href="'+WA+'" target="_blank" rel="noopener">Scrivici su WhatsApp</a>.');return;}var d=collect(b),er=validate(d);if(er){msg(b,"err",er);return;}if(b.dataset.artyouBusy==="1")return;b.dataset.artyouBusy="1";b.style.opacity=".6";msg(b,"wait","Verifica disponibilità e invio in corso…");post(d).then(res=>{if(!res||!res.ok){if(res&&(res.errore==="esaurito"||res.errore==="posti_insufficienti"))throw new Error("Sono rimasti "+(res.liberi||0)+" posti disponibili.");if(res&&res.errore==="prenotazioni_chiuse")throw new Error("Le prenotazioni per questo evento sono chiuse.");if(res&&res.errore==="prenotazioni_non_aperte")throw new Error("Le prenotazioni per questo evento non sono ancora aperte.");throw new Error((res&&res.errore)||"Invio non riuscito.");}if(window.ARTYOU_CAP&&d.Evento&&typeof res.liberi==="number"){window.ARTYOU_CAP[d.Evento]=res.liberi;window.dispatchEvent(new Event("hashchange"));}var codice=res.codice||res.id||"";var h=codice?'Prenotazione registrata. Codice: <b>'+codice+'</b>.':"Prenotazione registrata.";if(res.stato==="HOLD")h+=" I posti sono bloccati per <b>"+res.holdMinutes+" minuti</b> in attesa del pagamento.";else h+=" I posti sono stati riservati.";msg(b,"ok",h);if(codice){window.dispatchEvent(new CustomEvent("artyou-booking-code",{detail:codice}));}avail();b.dataset.artyouBookingBypass="1";setTimeout(()=>{try{b.click();}catch(_){ }},100);}).catch(err=>{msg(b,"err",(err&&err.message?err.message:"Invio non riuscito.")+' <a href="'+WA+'" target="_blank" rel="noopener">Contattaci su WhatsApp</a>.');}).finally(()=>{delete b.dataset.artyouBusy;b.style.opacity="";});},true);
avail();
})();