(function(){
'use strict';
var KEY='artyou_language_v1', SOURCE='it';
var L={
'it':['Italiano','IT'],'en':['English','EN'],'es':['Español','ES'],'fr':['Français','FR'],
'de':['Deutsch','DE'],'pt':['Português','PT'],'pl':['Polski','PL'],'ru':['Русский','RU'],'zh-CN':['中文（简体）','中文']
};
function saved(){try{return localStorage.getItem(KEY)||''}catch(e){return''}}
function save(v){try{localStorage.setItem(KEY,v)}catch(e){}}
function norm(v){v=(v||'').toLowerCase();if(v.indexOf('zh')===0)return'zh-CN';v=v.split('-')[0];return L[v]?v:SOURCE}
function detect(){var a=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||SOURCE];for(var i=0;i<a.length;i++){var n=norm(a[i]);if(n!==SOURCE||String(a[i]).toLowerCase().indexOf('it')===0)return n}return SOURCE}
function cookie(lang){
 var val=lang===SOURCE?'':'/'+SOURCE+'/'+lang, exp=lang===SOURCE?'; expires=Thu, 01 Jan 1970 00:00:00 GMT':'';
 document.cookie='googtrans='+val+'; path=/; SameSite=Lax'+exp;
 // Google may also create a domain cookie: keep both copies consistent.
 document.cookie='googtrans='+val+'; path=/; SameSite=Lax; domain='+location.hostname+exp;
}
function choose(lang){if(!L[lang])lang=SOURCE;save(lang);cookie(lang);location.reload()}
var first=saved();if(!first){first=detect();save(first)}else if(!L[first]){save(SOURCE);first=SOURCE}
// Restore the translation cookie on every page, even if the browser cleared it.
cookie(first);
var translationTimer=null;
function normalizeHeaderUi(){
  try{
    var h=document.querySelector('header');
    if(!h)return;
    var cta=h.querySelector('a[href*="lezione-gratuita"]');
    if(cta){
      var long=cta.querySelector('.am-long'), short=cta.querySelector('.am-short');
      if(long && long.textContent!=='PROVA GRATUITA') long.textContent='PROVA GRATUITA';
      if(short && short.textContent!=='PROVA GRATUITA') short.textContent='PROVA GRATUITA';
      if(!long&&!short && cta.textContent!=='PROVA GRATUITA') cta.textContent='PROVA GRATUITA';
      if(cta.getAttribute('aria-label')!=='Prova Gratuita') cta.setAttribute('aria-label','Prova Gratuita');
    }
  }catch(e){}
}
function css(){
 if(document.getElementById('artyou-language-style'))return;
 var s=document.createElement('style');s.id='artyou-language-style';
 s.textContent='#artyou-language{position:relative;display:inline-flex;flex:0 0 auto;z-index:1105;font-family:inherit}'+
 '.artyou-lang-trigger{height:32px!important;min-height:32px!important;min-width:0!important;padding:0 5px!important;border:1px solid #3A444D;border-radius:18px;background:#13181D;color:#F6F3EC;display:inline-flex;align-items:center;justify-content:center;gap:4px;cursor:pointer;font:800 10px/1 inherit;white-space:nowrap;box-sizing:border-box!important}@media(min-width:821px){.artyou-lang-trigger{height:28px!important;min-height:28px!important;padding:0 5px!important;gap:3px!important;font-size:12px!important;font-weight:800!important;border-radius:15px!important}.artyou-lang-trigger>span:first-child{font-size:13px!important}.artyou-lang-trigger>span:last-child{font-size:9px!important;margin-left:1px!important}}'+
 '.artyou-lang-menu{position:absolute;right:0;top:calc(100% + 9px);width:210px;padding:8px;background:#13181D;border:1px solid #34404A;border-radius:14px;box-shadow:0 18px 42px rgba(0,0,0,.34);display:none;z-index:99999}'+
 '#artyou-language[data-open="1"] .artyou-lang-menu{display:block}.artyou-lang-option{width:100%;min-height:40px;padding:9px 11px;border:0;border-radius:9px;background:transparent;color:#F6F3EC;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;text-align:left;font:14px/1.2 inherit}'+
 '.artyou-lang-option:hover,.artyou-lang-option:focus-visible{background:#232C33;outline:none}.artyou-lang-option[aria-current="true"]{background:#2A343C;color:#FFD45A}.artyou-lang-code{opacity:.64;font-size:11px;font-weight:800}'+
 '#artyou-google-translate-element{position:fixed!important;left:-9999px!important;top:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important}.goog-te-banner-frame,.goog-te-banner-frame.skiptranslate,.VIpgJd-ZVi9od-ORHb-OEVmcd{display:none!important}html,body{top:0!important;margin-top:0!important}'+
 '@media(max-width:820px){#artyou-language{display:block!important;width:100%!important;max-width:100%!important;position:relative!important;z-index:auto!important}#artyou-language .artyou-lang-trigger{width:100%!important;height:auto!important;min-height:48px!important;padding:14px 2px!important;border:0!important;border-radius:0!important;border-bottom:1px solid #2A333B!important;background:transparent!important;color:#F6F3EC!important;justify-content:flex-start!important;font-size:18px!important;font-weight:500!important;line-height:1.2!important}.artyou-lang-menu{position:static!important;right:auto!important;top:auto!important;width:100%!important;max-width:100%!important;max-height:260px!important;overflow:auto!important;margin:4px 0 6px!important;padding:6px!important;box-sizing:border-box!important;box-shadow:none!important;border-radius:12px!important;background:#192128!important}.artyou-lang-option{min-height:44px!important;font-size:15px!important;padding:10px 12px!important}}';
 s.textContent+='.artyou-lang-row{display:none}'+
 '@media(max-width:820px){#artyou-language{padding:4px 0 12px!important;border-bottom:1px solid #34404A!important;margin-bottom:10px!important}#artyou-language .artyou-lang-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;width:100%!important;min-width:0!important}#artyou-language .artyou-lang-heading{margin:0!important;padding:8px 0!important;color:#F6F3EC!important;font-size:18px!important;font-weight:500!important;line-height:1.3!important;white-space:nowrap!important}#artyou-language .artyou-lang-select{display:block!important;flex:1 1 auto!important;min-width:0!important;max-width:180px!important;min-height:44px!important;padding:8px 10px!important;border:1px solid #3A444D!important;border-radius:9px!important;background:#192128!important;color:#F6F3EC!important;font:16px/1.2 inherit!important;box-sizing:border-box!important;color-scheme:dark}header #artyou-language button.artyou-lang-trigger[aria-expanded],header #artyou-language .artyou-lang-menu{display:none!important}}';
 s.textContent+='@media(max-width:820px){header nav #artyou-language{position:sticky!important;bottom:-16px!important;flex:0 0 auto!important;background:#13181D!important;padding:10px 0!important;margin:0!important;border-top:1px solid #34404A!important;z-index:2!important}#artyou-menu-toggle:checked~nav #artyou-language .artyou-lang-trigger{display:none!important}}';
 document.head.appendChild(s);var cta=document.createElement('style');cta.id='artyou-global-trial-cta';cta.textContent='header a[href*="lezione-gratuita"]{min-height:34px!important;height:34px!important;padding:0 11px!important;border-radius:999px!important;background:#25D366!important;color:#0B2E1A!important;border:1px solid #79FF9C!important;box-shadow:0 0 0 1px rgba(121,255,156,.16),0 4px 12px rgba(37,211,102,.18)!important;font-size:12px!important;font-weight:800!important;line-height:1!important;white-space:nowrap!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;max-width:none!important;box-sizing:border-box!important;text-decoration:none!important;text-transform:uppercase!important}header a[href*="lezione-gratuita"] span{white-space:nowrap!important}@media(min-width:821px){header.am-wrap{gap:18px!important;padding-left:clamp(28px,5vw,80px)!important;padding-right:clamp(28px,5vw,80px)!important}header nav.am-wrap{gap:clamp(12px,1.4vw,22px)!important;min-width:0!important;flex:1 1 auto!important;justify-content:center!important}header nav.am-wrap>a{font-size:clamp(12px,1.05vw,15px)!important;white-space:nowrap!important}header>div:last-child{gap:8px!important;flex:0 0 auto!important}}@media(min-width:821px) and (max-width:1120px){header.am-wrap{gap:12px!important;padding-left:22px!important;padding-right:22px!important}header nav.am-wrap{gap:10px!important}header nav.am-wrap>a{font-size:12px!important}header a[href*="lezione-gratuita"]{height:30px!important;min-height:30px!important;padding:0 9px!important;font-size:11px!important}}@media(max-width:820px){header a[href*="lezione-gratuita"]{min-height:30px!important;height:30px!important;padding:0 9px!important;font-size:11px!important;text-transform:uppercase!important}header a[href*="lezione-gratuita"] .am-long{display:none!important}header a[href*="lezione-gratuita"] .am-short{display:inline!important}}@media(max-width:380px){header a[href*="lezione-gratuita"]{min-height:28px!important;height:28px!important;padding:0 8px!important;font-size:10px!important}}';document.head.appendChild(cta)
}
function build(){
 if(document.getElementById('artyou-language')){normalizeHeaderUi();return;}css();normalizeHeaderUi();
 var h=document.querySelector('header');if(!h)return;
 var w=document.createElement('div');w.id='artyou-language';w.className='notranslate';w.setAttribute('translate','no');
 w.innerHTML='<div class="artyou-lang-row"><label class="artyou-lang-heading" for="artyou-lang-select">🌐 Lingue</label><select id="artyou-lang-select" class="artyou-lang-select" aria-label="Scegli la lingua"></select></div><button type="button" class="artyou-lang-trigger" aria-haspopup="true" aria-expanded="false" aria-label="Cambia lingua"><span aria-hidden="true">🌐</span><span class="artyou-lang-current"></span><span aria-hidden="true">▾</span></button><div class="artyou-lang-menu" role="menu" aria-label="Lingua del sito"></div>';
 var m=w.querySelector('.artyou-lang-menu'), cur=saved()&&L[saved()]?saved():SOURCE;
 Object.keys(L).forEach(function(c){var b=document.createElement('button');b.type='button';b.className='artyou-lang-option';b.dataset.lang=c;b.setAttribute('aria-current',c===cur?'true':'false');b.innerHTML='<span>'+L[c][0]+'</span><span class="artyou-lang-code">'+L[c][1]+'</span>';b.onclick=function(){choose(c)};m.appendChild(b)});
 var select=w.querySelector('.artyou-lang-select');
 Object.keys(L).forEach(function(c){var option=document.createElement('option');option.value=c;option.textContent=L[c][0];option.selected=c===cur;select.appendChild(option)});
 select.onchange=function(){choose(select.value)};
 w.querySelector('.artyou-lang-current').textContent=L[cur][1];
 var mb=h.querySelector('.artyou-menu-btn'), actions=mb&&mb.parentElement, nav=h.querySelector('nav');
 var desktopHome=null;
 if(actions&&actions.parentElement===h) desktopHome=actions;
 else desktopHome=h.querySelector(':scope > div:last-child');

 function placeLanguage(){
   // The page renderer may replace the header after DOMContentLoaded.
   h=document.querySelector('header');
   if(!h)return;
   normalizeHeaderUi();
   nav=h.querySelector('nav');
   mb=h.querySelector('.artyou-menu-btn');
   actions=mb&&mb.parentElement;
   desktopHome=actions||h.querySelector(':scope > div:last-child');
   var mobile=window.matchMedia&&window.matchMedia('(max-width:820px)').matches;
   // Inline visibility wins over generic mobile navigation button rules.
   var legacyTrigger=w.querySelector('.artyou-lang-trigger');
   var legacyMenu=w.querySelector('.artyou-lang-menu');
   legacyTrigger.hidden=!!mobile;
   legacyMenu.hidden=!!mobile;
   if(mobile){
     legacyTrigger.style.setProperty('display','none','important');
     legacyMenu.style.setProperty('display','none','important');
     w.setAttribute('data-open','0');
   }else{
     legacyTrigger.style.removeProperty('display');
     legacyMenu.style.removeProperty('display');
   }
   if(mobile&&nav){
     if(w.parentElement!==nav) nav.appendChild(w);
     w.querySelector('.artyou-lang-trigger').setAttribute('aria-expanded','true');
     w.classList.add('artyou-language-mobile');
     var label=w.querySelector('.artyou-lang-current');
     if(label) label.textContent='Lingue · '+L[cur][1];
   }else{
     if(desktopHome){
       if(mb&&mb.parentElement===desktopHome) desktopHome.insertBefore(w,mb);
       else desktopHome.appendChild(w);
     }else if(w.parentElement!==h) h.appendChild(w);
     w.classList.remove('artyou-language-mobile');
     var label2=w.querySelector('.artyou-lang-current');
     if(label2) label2.textContent=L[cur][1];
     w.querySelector('.artyou-lang-trigger').setAttribute('aria-expanded',w.getAttribute('data-open')==='1'?'true':'false');
   }
 }
 placeLanguage();
 window.addEventListener('resize',placeLanguage,{passive:true});
 // Keep the existing selector and its handlers when a rendered header is replaced.
 var headerObserver=new MutationObserver(function(){
   var liveHeader=document.querySelector('header');
   normalizeHeaderUi();
   if(liveHeader&&(!w.isConnected||!liveHeader.contains(w)))placeLanguage();
 });
 headerObserver.observe(document.body,{childList:true,subtree:true});
 var t=w.querySelector('.artyou-lang-trigger');t.onclick=function(e){e.stopPropagation();var o=w.getAttribute('data-open')==='1';w.setAttribute('data-open',o?'0':'1');t.setAttribute('aria-expanded',o?'false':'true')};
 document.addEventListener('click',function(e){if(!w.contains(e.target)){w.setAttribute('data-open','0');t.setAttribute('aria-expanded','false')}});
}
function translationStatus(message,failed){
 var s=document.getElementById('artyou-language-status');
 if(!message){if(s)s.remove();return}
 if(!s){s=document.createElement('div');s.id='artyou-language-status';s.className='notranslate';s.setAttribute('translate','no');s.setAttribute('role','status');s.setAttribute('aria-live','polite');s.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:100000;max-width:calc(100vw - 32px);box-sizing:border-box;padding:12px 16px;border:1px solid #3A444D;border-radius:12px;background:#13181D;color:#F6F3EC;font:14px/1.4 sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3)';document.body.appendChild(s)}
 s.textContent=message;
 if(failed){var b=document.createElement('button');b.type='button';b.textContent='Riprova';b.style.cssText='margin-left:10px;padding:6px 10px;border:0;border-radius:6px;cursor:pointer';b.onclick=function(){location.reload()};s.appendChild(b)}
}
function applyTranslation(){
 var lang=saved()&&L[saved()]?saved():SOURCE, attempts=0, dispatched=false;
 if(lang===SOURCE)return;
 if(translationTimer)clearInterval(translationTimer);
 translationTimer=setInterval(function(){
   attempts++;
   var combo=document.querySelector('#artyou-google-translate-element .goog-te-combo');
   // Apply the actual widget selection; the cookie alone is not a reliable trigger.
   if(combo&&!dispatched){
     var available=Array.prototype.some.call(combo.options,function(o){return o.value===lang});
     if(available){dispatched=true;combo.value=lang;combo.dispatchEvent(new Event('change',{bubbles:true}))}
   }
   var root=document.documentElement;
   if(root.classList.contains('translated-ltr')||root.classList.contains('translated-rtl')){
     clearInterval(translationTimer);translationTimer=null;translationStatus('');hideGoogleChrome();
   }else if(attempts>=100){
     clearInterval(translationTimer);translationTimer=null;
     translationStatus('Traduzione non disponibile. Controlla la connessione e riprova.',true);
   }
 },300);
}
window.artyouGoogleTranslateInit=function(){
 try{new google.translate.TranslateElement({pageLanguage:SOURCE,includedLanguages:'it,en,es,fr,de,pt,pl,ru,zh-CN',autoDisplay:false},'artyou-google-translate-element')}
 catch(e){translationStatus('Impossibile avviare la traduzione.',true)}
};
function load(){
 if(!document.getElementById('artyou-google-translate-element')){var d=document.createElement('div');d.id='artyou-google-translate-element';document.body.appendChild(d)}
 if(!document.getElementById('artyou-google-translate-script')){var s=document.createElement('script');s.id='artyou-google-translate-script';s.src='https://translate.google.com/translate_a/element.js?cb=artyouGoogleTranslateInit';s.async=true;s.onerror=function(){if(translationTimer)clearInterval(translationTimer);translationTimer=null;translationStatus('Impossibile caricare la traduzione. Controlla la connessione e riprova.',true)};document.head.appendChild(s)}
}
function hideGoogleChrome(){try{var q=document.querySelectorAll('.goog-te-banner-frame,.goog-te-banner-frame.skiptranslate,.VIpgJd-ZVi9od-ORHb-OEVmcd');for(var i=0;i<q.length;i++){q[i].style.setProperty('display','none','important')}document.documentElement.style.setProperty('margin-top','0px','important');if(document.body){document.body.style.setProperty('top','0px','important');document.body.style.setProperty('margin-top','0px','important')}}catch(e){}}
function init(){
 normalizeHeaderUi();
 build();
 var current=saved()&&L[saved()]?saved():SOURCE;
 if(current!==SOURCE){
   translationStatus('Traduzione in corso…');
   applyTranslation();
   load();
   hideGoogleChrome();
   setTimeout(hideGoogleChrome,250);
   setTimeout(hideGoogleChrome,900);
   setTimeout(hideGoogleChrome,1800);
   var obs=new MutationObserver(function(){hideGoogleChrome()});
   obs.observe(document.documentElement,{childList:true,subtree:true});
   setTimeout(function(){try{obs.disconnect()}catch(e){}},6000);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();