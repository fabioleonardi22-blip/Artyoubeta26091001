
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


(function(){
  var id='artyou-fixed-top-accent';
  if(document.getElementById(id)) return;
  var style=document.createElement('style');
  style.id=id;
  style.textContent='body::before{content:"";position:fixed;top:0;left:0;width:100%;height:6px;background:#7A1631;z-index:2147483646;pointer-events:none;}';
  (document.head||document.documentElement).appendChild(style);
})();
