
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
