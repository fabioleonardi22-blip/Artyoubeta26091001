
(function(){
  var KEY='artyou_cookie_consent_v1';
  function saved(){try{return !!localStorage.getItem(KEY)}catch(e){return false}}
  function hide(){
    var dlg=document.querySelector('[role="dialog"][aria-labelledby="cookie-title"]');
    if(dlg && dlg.parentElement) dlg.parentElement.style.display='none';
  }
  if(saved()) document.documentElement.classList.add('artyou-consent-saved');
  document.addEventListener('DOMContentLoaded', function(){ if(saved()) hide(); });
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('button'); if(!b)return;
    var t=(b.textContent||'').trim().toLowerCase();
    if(t==='accetta'||t==='nega'||t==='salva preferenze'){
      try{localStorage.setItem(KEY,t)}catch(err){}
      document.documentElement.classList.add('artyou-consent-saved'); hide();
    }
  },true);
  new MutationObserver(function(){if(saved())hide()}).observe(document.documentElement,{childList:true,subtree:true});
})();


/* Header WhatsApp: uniform neutral icon on every page */
(function(){
  function apply(){
    if(document.getElementById('artyou-header-wa-style')) return;
    var s=document.createElement('style');
    s.id='artyou-header-wa-style';
    s.textContent=
      'header a[aria-label="Scrivici su WhatsApp"],header .artyou-header-wa{'+
      'background:transparent!important;color:#F6F3EC!important;'+
      'border:1px solid #3A444D!important;box-shadow:none!important;'+
      'width:48px!important;height:48px!important;border-radius:50%!important;'+
      'display:flex!important;align-items:center!important;justify-content:center!important;'+
      'padding:0!important;flex:0 0 48px!important}'+
      '@media(max-width:820px){header a[aria-label="Scrivici su WhatsApp"],header .artyou-header-wa{'+
      'width:44px!important;height:44px!important;flex-basis:44px!important}}';
    document.head.appendChild(s);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply);
  else apply();
})();

/* artyou-remove-header-whatsapp: remove WhatsApp icon from every site header */
(function(){
  function apply(){
    if(document.getElementById('artyou-remove-header-whatsapp')) return;
    var s=document.createElement('style');
    s.id='artyou-remove-header-whatsapp';
    s.textContent=
      'header a[aria-label="Scrivici su WhatsApp"],'+
      'header .artyou-header-wa,'+
      'header > div > div[aria-hidden="true"]{display:none!important;}';
    document.head.appendChild(s);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply);
  else apply();
})();