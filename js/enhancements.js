
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

/* Google Maps buttons: brighter, calm turquoise treatment site-wide */
(function(){
  function apply(){
    if(document.getElementById('artyou-google-maps-style')) return;
    var s=document.createElement('style');
    s.id='artyou-google-maps-style';
    s.textContent=
      'a[href*="google.com/maps"],a[href*="maps.google"],a[href*="maps.app.goo.gl"]{'+
      'background:#DDF7F1!important;color:#0E5F58!important;'+
      'border:1px solid #8ED8CA!important;'+
      'box-shadow:0 10px 24px rgba(14,95,88,.12)!important;'+
      'transition:background .2s ease,border-color .2s ease,box-shadow .2s ease,transform .2s ease!important}'+
      'a[href*="google.com/maps"]:hover,a[href*="maps.google"]:hover,a[href*="maps.app.goo.gl"]:hover{'+
      'background:#CEF1E9!important;border-color:#69C9B8!important;'+
      'box-shadow:0 12px 28px rgba(14,95,88,.18)!important;transform:translateY(-1px)!important}'+
      'a[href*="google.com/maps"] span,a[href*="maps.google"] span,a[href*="maps.app.goo.gl"] span{color:#0E5F58!important}'+
      'a[href*="google.com/maps"] span[style*="border-radius"],a[href*="maps.google"] span[style*="border-radius"],a[href*="maps.app.goo.gl"] span[style*="border-radius"]{'+
      'background:#7CE3D0!important;color:#0A4E49!important}';
    document.head.appendChild(s);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply);
  else apply();
})();
