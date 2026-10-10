// Estratto da scanner.html (audit 10/10/2026): niente script inline, così la CSP delle aree riservate può escludere unsafe-inline.
let qr=null, active=false, busy=false, current=null;
let deferredInstallPrompt=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function isIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
}
function isStandalone(){
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone===true;
}
function updateInstallUI(){
  const btn=$("installBtn"),help=$("iosHelp");
  if(!btn||!help)return;
  if(isStandalone()){
    btn.textContent="Installata";
    btn.disabled=true;
    btn.style.opacity=".55";
    help.classList.remove("show");
    return;
  }
  if(isIOS()){
    btn.textContent="Come installare";
  }else if(deferredInstallPrompt){
    btn.textContent="Installa";
  }else{
    btn.textContent="Aggiungi alla Home";
  }
}
window.addEventListener("beforeinstallprompt",function(e){
  e.preventDefault();
  deferredInstallPrompt=e;
  updateInstallUI();
});
window.addEventListener("appinstalled",function(){
  deferredInstallPrompt=null;
  updateInstallUI();
  flash("Artyou Scanner installato sulla schermata Home.");
});
async function installScannerApp(){
  const help=$("iosHelp");
  if(isStandalone())return;
  if(isIOS()){
    help.classList.toggle("show");
    return;
  }
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    try{await deferredInstallPrompt.userChoice}catch(e){}
    deferredInstallPrompt=null;
    updateInstallUI();
    return;
  }
  help.innerHTML='Su Android: apri il menu di Chrome <strong>⋮</strong> e scegli <strong>Installa app</strong> oppure <strong>Aggiungi a schermata Home</strong>.';
  help.classList.toggle("show");
}
$("installBtn").addEventListener("click",installScannerApp);
updateInstallUI();
if("serviceWorker" in navigator){
  window.addEventListener("load",function(){
    navigator.serviceWorker.register("/scanner-sw.js").catch(function(){});
  });
}
function flash(t){$('flash').textContent=t;$('flash').classList.add('show');setTimeout(()=>$('flash').classList.remove('show'),3500)}
async function api(action,code,event){
  const r=await fetch('/api/checkin',{method:'POST',credentials:'same-origin',headers:ArtyouGoogleAuth.authHeaders({'content-type':'application/json'}),body:JSON.stringify({action,code,event})});
  const data=await r.json().catch(()=>({ok:false,errore:'risposta_non_valida'}));
  if(r.status===401||r.status===403){ArtyouGoogleAuth.clear();$('loginOverlay').classList.add('show');throw new Error('Accesso non autorizzato')}
  if(!r.ok&&!data.ok) throw new Error(data.errore||'Errore server');
  return data;
}
async function loadStats(event){
  try{
    const r=await api('stats','',event||'');
    if(r&&r.ok&&r.stats){
      $('statsEvent').textContent=r.stats.titolo||r.stats.evento||'Evento';
      $('statsCount').textContent=String(r.stats.presenti)+' / '+String(r.stats.capienza);
    }
  }catch(e){}
}

async function startScanner(){
  if(active||busy)return;
  if(typeof Html5Qrcode==='undefined'){flash('Lettore QR non caricato. Controlla la connessione.');return}
  try{
    qr=new Html5Qrcode('reader');
    await qr.start(
      {facingMode:'environment'},
      {
        fps:12,
        qrbox:(w,h)=>{
          const d=Math.floor(Math.min(w,h)*.72);
          return {width:d,height:d};
        },
        disableFlip:true
      },
      onScan,
      ()=>{}
    );
    active=true;$('status').textContent='Fotocamera attiva · inquadra il QR';
  }catch(e){flash('Fotocamera non disponibile. Controlla i permessi di Safari/Chrome.');$('status').textContent='Fotocamera non disponibile'}
}
async function stopScanner(){
  try{if(qr&&active)await qr.stop()}catch(e){}
  try{if(qr)qr.clear()}catch(e){}
  qr=null;active=false;$('status').textContent='Scanner fermo';
}
async function onScan(text){
  if(busy)return;
  const code=(text||'').trim(); if(!code)return;
  busy=true;if(navigator.vibrate)navigator.vibrate(80);
  pauseScannerForResult();
  await lookup(code);
}
function manualLookup(){
  const c=$('manualCode').value.trim();
  if(!c)return flash('Inserisci il codice prenotazione.');
  busy=true;
  pauseScannerForResult();
  lookup(c);
}

function pauseScannerForResult(){
  try{
    if(qr && active){
      qr.pause(true);
      $('status').textContent='Scansione in pausa';
    }
  }catch(e){}
}
async function lookup(code){
  $('status').textContent='Verifica prenotazione…';
  try{
    const r=await api('lookup',code);
    if(!r.trovato){
      renderBad('❌ PRENOTAZIONE NON TROVATA',code);
      $('nextBtn').style.display='block';
      $('status').textContent='Biglietto non trovato';
      busy=false;
      return;
    }
    current=r.prenotazione;
    renderBooking(current);
    loadStats(current.evento);
    $('nextBtn').style.display='block';
    $('status').textContent='Prenotazione trovata';
    busy=false;
  }catch(e){
    renderBad('❌ ERRORE',e.message);
    $('nextBtn').style.display='block';
    $('status').textContent='Errore verifica';
    busy=false;
  }
}
function renderBooking(p){
  let cls='ok',state='✅ PRENOTAZIONE VALIDA';
  const btn=$('checkinBtn');
  if(p.stato==='ANNULLATA'){
    cls='bad';state='❌ PRENOTAZIONE ANNULLATA';btn.style.display='none';
  }
  else if(p.stato==='PRESENTE'){
    cls='warn';state='⚠️ GIÀ ENTRATO';btn.style.display='none';
  }
  else{
    btn.style.display='block';
    btn.textContent='✓ REGISTRA INGRESSO · '+esc(p.posti)+' '+(Number(p.posti)===1?'posto':'posti');
  }
  const el=$('result');el.className='result show '+cls;
  el.innerHTML='<div class="state">'+state+'</div><div class="name">'+esc(p.nome)+' '+esc(p.cognome)+'</div><div class="event"><strong>'+esc(p.titolo)+'</strong><br>'+esc(p.dataEvento)+(p.oraEvento?' · '+esc(p.oraEvento):'')+'</div><div class="meta"><div>Posti: <strong>'+esc(p.posti)+'</strong></div><div>Stato: <strong>'+esc(p.stato)+'</strong></div>'+(p.checkin?'<div>Check-in: <strong>'+esc(p.checkin)+'</strong></div>':'')+'</div><div class="code">'+esc(p.codice)+'</div>';
}
function renderBad(title,text){const el=$('result');el.className='result show bad';el.innerHTML='<div class="state">'+esc(title)+'</div><div class="event">'+esc(text||'')+'</div>'}
async function checkin(){
  if(!current||!current.codice||busy)return;
  busy=true;$('status').textContent='Registro ingresso…';
  try{
    const r=await api('checkin',current.codice);
    if(!r.ok){
      if(r.prenotazione){current=r.prenotazione;renderBooking(current)}
      else renderBad('❌ CHECK-IN NON RIUSCITO',r.errore||'');
      $('nextBtn').style.display='block';
      $('status').textContent='Check-in non riuscito';
      busy=false;
      return;
    }
    current=r.prenotazione;
    $('checkinBtn').style.display='none';
    $('nextBtn').style.display='block';
    const el=$('result');el.className='result show ok';
    el.innerHTML='<div class="state">✅ INGRESSO REGISTRATO</div><div class="name">'+esc(current.nome)+' '+esc(current.cognome)+'</div><div class="event"><strong>'+esc(current.titolo)+'</strong><br>'+esc(current.dataEvento)+(current.oraEvento?' · '+esc(current.oraEvento):'')+'</div><div class="meta"><div>Ingressi: <strong>'+esc(current.posti)+'</strong></div><div>Check-in: <strong>'+esc(current.checkin)+'</strong></div></div><div class="code">'+esc(current.codice)+'</div>';
    $('status').textContent='Ingresso registrato';
    loadStats(current.evento);
    if(navigator.vibrate)navigator.vibrate([100,60,100]);
    busy=false;
  }catch(e){
    renderBad('❌ ERRORE CHECK-IN',e.message);
    $('nextBtn').style.display='block';
    $('status').textContent='Errore check-in';
    busy=false;
  }
}
async function scanAnother(){
  current=null;
  busy=false;
  $('manualCode').value='';
  $('checkinBtn').style.display='none';
  $('nextBtn').style.display='none';
  $('result').className='result';
  $('result').innerHTML='';
  try{
    if(qr && active){
      qr.resume();
      $('status').textContent='Fotocamera attiva · inquadra il QR';
      return;
    }
  }catch(e){}
  $('status').textContent='Avvio nuova scansione…';
  await startScanner();
}
window.addEventListener('beforeunload',stopScanner);
ArtyouGoogleAuth.init({
  buttonId:'googleLoginButton',
  statusId:'loginStatus',
  roles:['admin','staff'],
  onAuthorized:function(){
    $('loginOverlay').classList.remove('show');
    setTimeout(async()=>{await loadStats();await startScanner();},250);
  }
});

// Pulsanti collegati qui invece che con onclick="" (consentito dalla CSP senza unsafe-inline).
document.addEventListener("click",function(e){var b=e.target.closest("[data-action]");if(!b)return;var fn={startScanner:startScanner,stopScanner:stopScanner,checkin:checkin,scanAnother:scanAnother,manualLookup:manualLookup}[b.dataset.action];if(fn)fn();});
