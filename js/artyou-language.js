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
}
function choose(lang){if(!L[lang])lang=SOURCE;save(lang);cookie(lang);location.reload()}
var first=saved();if(!first){first=detect();save(first);if(first!==SOURCE){cookie(first);location.reload();return}}else if(!L[first]){save(SOURCE);first=SOURCE}
function css(){
 if(document.getElementById('artyou-language-style'))return;
 var s=document.createElement('style');s.id='artyou-language-style';
 s.textContent='#artyou-language{position:relative;display:inline-flex;flex:0 0 auto;z-index:1105;font-family:inherit}'+
 '.artyou-lang-trigger{height:32px!important;min-height:32px!important;min-width:42px!important;padding:0 7px!important;border:1px solid #3A444D;border-radius:22px;background:#13181D;color:#F6F3EC;display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;font:800 10px/1 inherit;white-space:nowrap;box-sizing:border-box!important}'+
 '.artyou-lang-menu{position:absolute;right:0;top:calc(100% + 9px);width:210px;padding:8px;background:#13181D;border:1px solid #34404A;border-radius:14px;box-shadow:0 18px 42px rgba(0,0,0,.34);display:none;z-index:99999}'+
 '#artyou-language[data-open="1"] .artyou-lang-menu{display:block}.artyou-lang-option{width:100%;min-height:40px;padding:9px 11px;border:0;border-radius:9px;background:transparent;color:#F6F3EC;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;text-align:left;font:14px/1.2 inherit}'+
 '.artyou-lang-option:hover,.artyou-lang-option:focus-visible{background:#232C33;outline:none}.artyou-lang-option[aria-current="true"]{background:#2A343C;color:#FFD45A}.artyou-lang-code{opacity:.64;font-size:11px;font-weight:800}'+
 '#artyou-google-translate-element{position:fixed!important;left:-9999px!important;top:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important}.goog-te-banner-frame,.goog-te-banner-frame.skiptranslate,.VIpgJd-ZVi9od-ORHb-OEVmcd{display:none!important}html,body{top:0!important;margin-top:0!important}'+
 '@media(max-width:820px){#artyou-language{display:block!important;width:100%!important;max-width:100%!important;position:relative!important;z-index:auto!important}#artyou-language .artyou-lang-trigger{width:100%!important;height:auto!important;min-height:48px!important;padding:14px 2px!important;border:0!important;border-radius:0!important;border-bottom:1px solid #2A333B!important;background:transparent!important;color:#F6F3EC!important;justify-content:flex-start!important;font-size:18px!important;font-weight:500!important;line-height:1.2!important}.artyou-lang-menu{position:static!important;right:auto!important;top:auto!important;width:100%!important;max-width:100%!important;max-height:260px!important;overflow:auto!important;margin:4px 0 6px!important;padding:6px!important;box-sizing:border-box!important;box-shadow:none!important;border-radius:12px!important;background:#192128!important}.artyou-lang-option{min-height:44px!important;font-size:15px!important;padding:10px 12px!important}}';
 document.head.appendChild(s);var cta=document.createElement('style');cta.id='artyou-global-trial-cta';cta.textContent='header a[href*="lezione-gratuita"]{min-height:34px!important;height:34px!important;padding:0 12px!important;border-radius:999px!important;background:#25D366!important;color:#0B2E1A!important;border:1px solid #79FF9C!important;box-shadow:0 0 0 1px rgba(121,255,156,.16),0 4px 12px rgba(37,211,102,.18)!important;font-size:12px!important;font-weight:700!important;line-height:1!important;white-space:nowrap!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;max-width:none!important;box-sizing:border-box!important;text-decoration:none!important}header a[href*="lezione-gratuita"] span{white-space:nowrap!important}@media(max-width:820px){header a[href*="lezione-gratuita"]{min-height:30px!important;height:30px!important;padding:0 9px!important;font-size:11px!important}header a[href*="lezione-gratuita"] .am-long{display:none!important}header a[href*="lezione-gratuita"] .am-short{display:inline!important}}@media(max-width:380px){header a[href*="lezione-gratuita"]{min-height:28px!important;height:28px!important;padding:0 8px!important;font-size:10px!important}}';document.head.appendChild(cta)
}
function build(){
 if(document.getElementById('artyou-language'))return;css();
 var h=document.querySelector('header');if(!h)return;
 var w=document.createElement('div');w.id='artyou-language';w.className='notranslate';w.setAttribute('translate','no');
 w.innerHTML='<button type="button" class="artyou-lang-trigger" aria-haspopup="true" aria-expanded="false" aria-label="Cambia lingua"><span aria-hidden="true">🌐</span><span class="artyou-lang-current"></span><span aria-hidden="true">▾</span></button><div class="artyou-lang-menu" role="menu" aria-label="Lingua del sito"></div>';
 var m=w.querySelector('.artyou-lang-menu'), cur=saved()&&L[saved()]?saved():SOURCE;
 Object.keys(L).forEach(function(c){var b=document.createElement('button');b.type='button';b.className='artyou-lang-option';b.dataset.lang=c;b.setAttribute('aria-current',c===cur?'true':'false');b.innerHTML='<span>'+L[c][0]+'</span><span class="artyou-lang-code">'+L[c][1]+'</span>';b.onclick=function(){choose(c)};m.appendChild(b)});
 w.querySelector('.artyou-lang-current').textContent=L[cur][1];
 var mb=h.querySelector('.artyou-menu-btn'), actions=mb&&mb.parentElement, nav=h.querySelector('nav');
 var desktopHome=null;
 if(actions&&actions.parentElement===h) desktopHome=actions;
 else desktopHome=h.querySelector(':scope > div:last-child');

 function placeLanguage(){
   var mobile=window.matchMedia&&window.matchMedia('(max-width:820px)').matches;
   if(mobile&&nav){
     if(w.parentElement!==nav) nav.appendChild(w);
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
   }
 }
 placeLanguage();
 window.addEventListener('resize',placeLanguage,{passive:true});
 var t=w.querySelector('.artyou-lang-trigger');t.onclick=function(e){e.stopPropagation();var o=w.getAttribute('data-open')==='1';w.setAttribute('data-open',o?'0':'1');t.setAttribute('aria-expanded',o?'false':'true')};
 document.addEventListener('click',function(e){if(!w.contains(e.target)){w.setAttribute('data-open','0');t.setAttribute('aria-expanded','false')}});
}
window.artyouGoogleTranslateInit=function(){try{new google.translate.TranslateElement({pageLanguage:SOURCE,includedLanguages:'it,en,es,fr,de,pt,pl,ru,zh-CN',autoDisplay:false},'artyou-google-translate-element')}catch(e){}};
function load(){
 if(!document.getElementById('artyou-google-translate-element')){var d=document.createElement('div');d.id='artyou-google-translate-element';document.body.appendChild(d)}
 if(!document.getElementById('artyou-google-translate-script')){var s=document.createElement('script');s.id='artyou-google-translate-script';s.src='https://translate.google.com/translate_a/element.js?cb=artyouGoogleTranslateInit';s.async=true;document.head.appendChild(s)}
}
function hideGoogleChrome(){try{var q=document.querySelectorAll('.goog-te-banner-frame,.goog-te-banner-frame.skiptranslate,.VIpgJd-ZVi9od-ORHb-OEVmcd');for(var i=0;i<q.length;i++){q[i].style.setProperty('display','none','important')}document.documentElement.style.setProperty('margin-top','0px','important');if(document.body){document.body.style.setProperty('top','0px','important');document.body.style.setProperty('margin-top','0px','important')}}catch(e){}}\nfunction init(){
 build();
 var current=saved()&&L[saved()]?saved():SOURCE;
 if(current!==SOURCE){
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