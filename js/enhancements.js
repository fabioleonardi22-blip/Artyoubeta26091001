
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
  if(saved()){
    var obs=new MutationObserver(function(){
      hide();
      if(document.querySelector('[role="dialog"][aria-labelledby="cookie-title"]')) setTimeout(function(){try{obs.disconnect()}catch(e){}},50);
    });
    obs.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(function(){try{obs.disconnect()}catch(e){}},4000);
  }
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


/* Site-wide multilingual selector */
(function(){if(document.getElementById('artyou-language-loader'))return;var s=document.createElement('script');s.id='artyou-language-loader';s.src='/js/artyou-language.js';s.defer=true;document.head.appendChild(s);})();


/* artyou-global-ux-v1: shared usability + responsive hardening */
(function(){
  function installStyles(){
    if(document.getElementById('artyou-global-ux-v1')) return;
    var s=document.createElement('style');
    s.id='artyou-global-ux-v1'; /* artyou-menu-teachers-fix */
    s.textContent=`
      html{scroll-behavior:smooth;-webkit-text-size-adjust:100%;text-size-adjust:100%}
      body{overflow-x:hidden;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
      *,*::before,*::after{box-sizing:border-box}
      img,video,iframe,canvas,svg{max-width:100%}
      img{height:auto}
      button,input,select,textarea{font:inherit}
      button,[role="button"],a,input,select,textarea{outline-offset:3px}
      :focus-visible{outline:3px solid #2CA8E0!important;outline-offset:3px!important}
      [id]{scroll-margin-top:92px}
      main,section,article,header,footer,nav,form{min-width:0}
      table{max-width:100%}
      iframe[loading="lazy"]{content-visibility:auto}
      /* One shared trial CTA, overriding per-page header rules. */
      header a#artyou-trial-header-cta{
        display:inline-flex!important;align-items:center!important;justify-content:center!important;
        flex:0 0 auto!important;width:auto!important;max-width:none!important;min-width:0!important;
        height:38px!important;min-height:38px!important;max-height:38px!important;
        padding:0 15px!important;margin:0!important;box-sizing:border-box!important;
        background:#25D366!important;color:#0B2E1A!important;border:1px solid #79FF9C!important;
        border-radius:999px!important;box-shadow:0 0 0 1px rgba(121,255,156,.18),0 4px 12px rgba(37,211,102,.18)!important;
        font-family:Inter,Arial,sans-serif!important;font-size:13px!important;font-weight:700!important;
        line-height:1!important;letter-spacing:normal!important;text-decoration:none!important;
        text-align:center!important;white-space:nowrap!important;overflow:visible!important;
      }
      header a#artyou-trial-header-cta :is(span,font){
        font:inherit!important;color:inherit!important;white-space:nowrap!important;
        overflow-wrap:normal!important;word-break:normal!important;
      }
      header a#artyou-trial-header-cta .am-long{display:inline!important;}
      header a#artyou-trial-header-cta .am-short{display:none!important;}
      @media(max-width:820px){
        header a#artyou-trial-header-cta{
          width:112px!important;height:34px!important;min-height:34px!important;max-height:34px!important;
          padding:0 11px!important;font-size:15px!important;
        }
        header a#artyou-trial-header-cta .am-long{display:none!important;}
        header a#artyou-trial-header-cta .am-short{display:inline!important;}
      }
      @media(max-width:380px){
        header a#artyou-trial-header-cta{
          width:104px!important;height:32px!important;min-height:32px!important;max-height:32px!important;
          padding:0 9px!important;font-size:11px!important;
        }
      }

      /* Course navigation remains a single horizontal strip at every viewport. */
      nav[aria-label="Corsi"]{
        display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;
        align-items:center!important;justify-content:flex-start!important;
        height:56px!important;min-height:56px!important;max-height:56px!important;
        padding-top:0!important;padding-bottom:0!important;
        overflow-x:auto!important;overflow-y:hidden!important;
        touch-action:pan-x!important;overscroll-behavior:none!important;
        scrollbar-width:none!important;
      }
      nav[aria-label="Corsi"]>*{
        flex:0 0 auto!important;max-height:56px!important;
        white-space:nowrap!important;overflow-wrap:normal!important;word-break:normal!important;
      }
      nav[aria-label="Corsi"] a{
        height:56px!important;min-height:0!important;
        padding-top:0!important;padding-bottom:0!important;
        display:flex!important;align-items:center!important;box-sizing:border-box!important;
      }
      nav[aria-label="Corsi"]::-webkit-scrollbar{display:none!important;width:0;height:0}

      .artyou-scroll-x{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
      @media(max-width:820px){
        #artyou-menu-toggle:checked~nav{
          display:flex!important;
          flex-direction:column!important;
          flex-wrap:nowrap!important;
          grid-template-columns:minmax(0,1fr)!important;
          grid-auto-flow:row!important;
          align-items:stretch!important;
          justify-content:flex-start!important;
          width:auto!important;
          max-width:calc(100vw - 24px)!important;
          min-width:0!important;
          box-sizing:border-box!important;
          overflow-x:hidden!important;
          overflow-y:auto!important;
        }
        #artyou-menu-toggle:checked~nav>*{
          grid-column:1!important;
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
          box-sizing:border-box!important;
        }
        #artyou-menu-toggle:checked~nav a,
        #artyou-menu-toggle:checked~nav a.artyou-menu-extra,
        #artyou-menu-toggle:checked~nav .artyou-lang-trigger{
          width:100%!important;
          display:block!important;
          padding:14px 0!important;
          padding-left:0!important;
          font-size:18px!important;
          line-height:1.25!important;
          font-weight:500!important;
          color:#F6F3EC!important;
          border-bottom:1px solid #2A333B!important;
        }
        #artyou-menu-toggle:checked~nav a[href*="/insegnanti/"]{
          font-size:18px!important;
          font-weight:500!important;
          color:#F6F3EC!important;
        }
        html,body{width:100%;max-width:100%;overflow-x:hidden!important}
        /* Keep the sticky header in the same scroll container when the menu opens. */
        html.artyou-menu-open body{overflow-x:hidden!important}
        html body .artyou-menu-btn{display:flex!important;position:fixed!important;opacity:1!important;visibility:visible!important;pointer-events:auto!important;transform:none!important;z-index:10000!important;}
        body{padding-bottom:env(safe-area-inset-bottom,0px)}
        header{max-width:100vw!important}
        header>a:first-of-type{min-width:0!important}
        header>a:first-of-type img{max-width:min(170px,44vw)!important;height:auto!important;object-fit:contain!important}
        [style*="position: sticky"][style*="top: 96px"],
        [style*="position:sticky"][style*="top:96px"]{top:64px!important}
        /* Course strip: one horizontal row, with no vertical scroll or bounce. */
        nav[aria-label="Corsi"]{
          display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;
          align-items:center!important;justify-content:flex-start!important;
          height:56px!important;min-height:56px!important;max-height:56px!important;
          padding-top:0!important;padding-bottom:0!important;
          overflow-x:auto!important;overflow-y:hidden!important;
          touch-action:pan-x!important;overscroll-behavior:none!important;
          -webkit-overflow-scrolling:touch;scrollbar-width:none;
        }
        nav[aria-label="Corsi"]>*{
          flex:0 0 auto!important;max-height:56px!important;
          white-space:nowrap!important;overflow-wrap:normal!important;word-break:normal!important;
        }
        nav[aria-label="Corsi"] a{
          height:56px!important;padding-top:0!important;padding-bottom:0!important;
          align-items:center!important;box-sizing:border-box!important;
        }
        nav[aria-label="Corsi"]::-webkit-scrollbar{display:none;}
        nav[aria-label="Chi siamo"],nav[aria-label="Festival"]{
          scrollbar-width:none;-webkit-overflow-scrolling:touch
        }
        nav[aria-label="Chi siamo"]::-webkit-scrollbar,nav[aria-label="Festival"]::-webkit-scrollbar{display:none}
        .artyou-menu-btn{touch-action:manipulation}
        button,
        input[type="button"],
        input[type="submit"],
        input[type="reset"],
        [role="button"],
        a[style*="border-radius: 999px"],
        a[style*="border-radius:999px"]{min-height:44px}
        input,select,textarea{font-size:16px!important}
        textarea{min-height:120px}
        form input:not([type="checkbox"]):not([type="radio"]),
        form select,
        form textarea{width:100%;max-width:100%}
        p,li,h1,h2,h3,h4,a,button,label,span{overflow-wrap:anywhere}
        table{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}
        [style*="min-width: 600px"],[style*="min-width:600px"],
        [style*="min-width: 700px"],[style*="min-width:700px"],
        [style*="min-width: 800px"],[style*="min-width:800px"]{min-width:0!important}
        [style*="width: 1440px"],[style*="width:1440px"],
        [style*="width: 1200px"],[style*="width:1200px"],
        [style*="width: 1100px"],[style*="width:1100px"],
        [style*="width: 1000px"],[style*="width:1000px"],
        [style*="width: 900px"],[style*="width:900px"],
        [style*="width: 800px"],[style*="width:800px"]{max-width:100%!important}
        .artyou-menu-btn{right:max(14px,env(safe-area-inset-right,14px))!important;
          bottom:calc(16px + env(safe-area-inset-bottom,0px))!important}
      }
      @media(prefers-reduced-motion:reduce){
        html{scroll-behavior:auto!important}
        *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
      }
    `;
    document.head.appendChild(s);
  }

  function improveMedia(){
    var imgs=Array.prototype.slice.call(document.images||[]);
    imgs.forEach(function(img,i){
      if(i<2 || img.getAttribute('fetchpriority')==='high' || img.closest('#am-hero')) return;
      if(!img.hasAttribute('loading')) img.loading='lazy';
      if(!img.hasAttribute('decoding')) img.decoding='async';
    });
    document.querySelectorAll('iframe').forEach(function(el){
      if(!el.hasAttribute('loading')) el.loading='lazy';
    });
  }

  function improveMenu(){
    var toggle=document.getElementById('artyou-menu-toggle');
    var btn=document.querySelector('.artyou-menu-btn');
    if(!toggle||!btn) return;
    var nav=document.querySelector('header nav');
    if(nav && !nav.id) nav.id='artyou-mobile-nav';
    if(nav){
      var links=Array.from(nav.querySelectorAll('a'));
      var chi=links.find(function(a){return /chi\s*siamo/i.test((a.textContent||'').trim())});
      var doc=links.find(function(a){return /docenti/i.test((a.textContent||'').trim())});
      if(chi&&doc&&doc!==chi.nextElementSibling) chi.insertAdjacentElement('afterend',doc);
      if(doc){
        doc.classList.remove('artyou-menu-extra');
        doc.style.display='';
        doc.style.color='#E6EBEE';
        doc.style.fontSize='16px';
        doc.style.fontWeight='500';
      }
    }
    btn.setAttribute('role','button');
    btn.setAttribute('tabindex','0');
    btn.setAttribute('aria-controls',btn.getAttribute('aria-controls')||(nav&&nav.id)||'artyou-mobile-nav');
    function sync(){
      btn.setAttribute('aria-expanded',toggle.checked?'true':'false');
      document.documentElement.classList.toggle('artyou-menu-open',!!toggle.checked);
    }
    btn.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle.checked=!toggle.checked;sync();}
      if(e.key==='Escape'){toggle.checked=false;sync();}
    });
    toggle.addEventListener('change',sync);
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&toggle.checked){toggle.checked=false;sync();}
    });
    document.addEventListener('click',function(e){
      if(!toggle.checked) return;
      if(e.target.closest && (e.target.closest('.artyou-menu-btn')||e.target.closest('header nav'))) return;
      toggle.checked=false;sync();
    });
    sync();
  }

  function improveForms(){
    var map=[
      ['f-nome','given-name',null],
      ['p-nome','given-name',null],
      ['f-cognome','family-name',null],
      ['p-cognome','family-name',null],
      ['f-mail','email','email'],
      ['p-mail','email','email'],
      ['f-email','email','email'],
      ['f-tel','tel','tel'],
      ['p-tel','tel','tel'],
      ['f-telefono','tel','tel']
    ];
    map.forEach(function(row){
      var el=document.getElementById(row[0]);
      if(!el) return;
      if(!el.getAttribute('autocomplete')) el.setAttribute('autocomplete',row[1]);
      if(row[2] && !el.getAttribute('inputmode')) el.setAttribute('inputmode',row[2]);
      if(row[2] && (!el.getAttribute('type') || el.getAttribute('type')==='text')) el.setAttribute('type',row[2]);
    });
    document.documentElement.classList.remove('artyou-form-focus');
    var obs=new MutationObserver(function(muts){
      muts.forEach(function(m){
        (m.addedNodes||[]).forEach(function(n){
          if(!n || n.nodeType!==1) return;
          var els=[];
          if(n.matches && n.matches('.artyou-booking-msg,.artyou-form-msg')) els.push(n);
          if(n.querySelectorAll) els=els.concat(Array.from(n.querySelectorAll('.artyou-booking-msg,.artyou-form-msg')));
          els.forEach(function(el){
            el.setAttribute('role','status');
            el.setAttribute('aria-live','polite');
          });
        });
      });
    });
    obs.observe(document.body,{childList:true,subtree:true});
  }

  function improveExternalLinks(){
    document.querySelectorAll('a[target="_blank"]').forEach(function(a){
      var rel=(a.getAttribute('rel')||'').split(/\s+/).filter(Boolean);
      if(rel.indexOf('noopener')<0) rel.push('noopener');
      if(rel.indexOf('noreferrer')<0) rel.push('noreferrer');
      a.setAttribute('rel',rel.join(' '));
    });
  }

  // Apply shared rules before the first paint, including before the page renderer boots.
  installStyles();

  function boot(){
    installStyles();
    improveMedia();
    improveMenu();
    improveForms();
    improveExternalLinks();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();


/* artyou-global-companies-menu-v1: replace teachers entry with Companies in every main header */
(function(){
  function updateCompaniesMenu(){
    document.querySelectorAll('header nav').forEach(function(nav){
      nav.querySelectorAll('a[href*="/insegnanti/"], a.artyou-menu-extra').forEach(function(a){
        if(/docenti/i.test(a.textContent||'') || a.getAttribute('href')==='/insegnanti/' || (a.getAttribute('href')||'').includes('/insegnanti/')) a.remove();
      });
      if(nav.querySelector('a[href="/formazione-aziende/"]')) return;
      var company=document.createElement('a');
      company.href='/formazione-aziende/';
      company.textContent='Aziende';
      company.style.cssText='color:#E6EBEE;text-decoration:none;font-size:16px;font-weight:500;white-space:nowrap;';
      var merch=Array.from(nav.querySelectorAll('a')).find(function(a){return /merchandising/i.test(a.textContent||'');});
      var blog=Array.from(nav.querySelectorAll('a')).find(function(a){return /^\s*blog\s*$/i.test(a.textContent||'');});
      if(merch) nav.insertBefore(company,merch);
      else if(blog) nav.insertBefore(company,blog);
      else nav.appendChild(company);

      /* Logical desktop/mobile order:
         Chi Siamo → Corsi → Spettacoli → WorkshoW → Festival → Aziende → Blog → Merchandising → Contatti.
         Keep any non-primary links after the main navigation items. */
      var desiredOrder=[
        {label:/^\s*chi siamo\s*$/i, href:'/chi-siamo/'},
        {label:/^\s*corsi\s*$/i, href:'/improvvisazione-teatrale/'},
        {label:/^\s*spettacoli\s*$/i},
        {label:/^\s*workshow(?:™)?\s*$/i, href:'/workshow/'},
        {label:/^\s*festival\s*$/i, href:'/rome-improv-festival/'},
        {label:/^\s*aziende\s*$/i, href:'/formazione-aziende/'},
        {label:/^\s*blog\s*$/i, href:'/la-finestra-sul-cortile/'},
        {label:/^\s*merchandising\s*$/i, href:'/merchandising/'},
        {label:/^\s*contatti\s*$/i}
      ];
      var links=Array.from(nav.querySelectorAll(':scope > a'));
      var used=new Set();
      desiredOrder.forEach(function(rule){
        var a=links.find(function(link){
          if(used.has(link)) return false;
          var txt=(link.textContent||'').trim();
          var href=(link.getAttribute('href')||'').replace(location.origin,'');
          return rule.label.test(txt) || (rule.href && href===rule.href);
        });
        if(a){ nav.appendChild(a); used.add(a); }
      });
      links.forEach(function(a){ if(!used.has(a)) nav.appendChild(a); });
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',updateCompaniesMenu);
  else updateCompaniesMenu();
  window.addEventListener('pageshow',updateCompaniesMenu);
})();

/* Stable header navigation: same-document links must not reload the renderer. */
(function(){
  var style=document.createElement('style');
  style.id='artyou-stable-header';
  style.textContent=`
    header>a:first-of-type{flex-shrink:0!important}
    header>a:first-of-type img{object-fit:contain;animation:none!important;transition:none!important}
    header nav a{animation:none!important;transition:color .15s ease!important}
    @media(min-width:821px){
      header.am-wrap{gap:18px!important;padding-left:clamp(28px,5vw,80px)!important;padding-right:clamp(28px,5vw,80px)!important}
      header nav.am-wrap{gap:clamp(12px,1.4vw,22px)!important;min-width:0!important;flex:1 1 auto!important;justify-content:center!important}
      header nav.am-wrap>a{font-size:clamp(12px,1.05vw,15px)!important;white-space:nowrap!important}
      header>div:last-child{gap:8px!important;flex:0 0 auto!important}
    }
    @media(min-width:821px) and (max-width:1320px){
      header.am-wrap{gap:10px!important;padding-left:18px!important;padding-right:18px!important}
      header>a:first-of-type img{height:44px!important;width:auto!important;max-width:150px!important}
      header nav.am-wrap{gap:8px!important}
      header nav.am-wrap>a{font-size:12px!important}
      header>div:last-child{gap:6px!important}
      header a#artyou-trial-header-cta{height:32px!important;min-height:32px!important;max-height:32px!important;padding:0 10px!important;font-size:11px!important}
      #artyou-language .artyou-lang-trigger{height:26px!important;min-height:26px!important;padding:0 4px!important}
    }
  `;
  document.head.appendChild(style);
  var logo=document.createElement('link');
  logo.rel='preload';logo.as='image';logo.href='/img/logo-orizzontale-bianco.png';
  logo.setAttribute('fetchpriority','high');
  document.head.appendChild(logo);

  function path(url){return url.pathname.replace(/\/index\.html$/,'/').replace(/\/$/,'')||'/';}
  document.addEventListener('click',function(e){
    if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    var a=e.target.closest&&e.target.closest('header a,nav a');
    if(!a||a.hasAttribute('download')||(a.target&&a.target!=='_self'))return;
    var url;try{url=new URL(a.href,location.href);}catch(err){return;}
    var current=new URL(location.href);
    if(url.origin!==current.origin||path(url)!==path(current)||url.search!==current.search)return;
    var target=null;
    if(url.hash){
      var id;try{id=decodeURIComponent(url.hash.slice(1));}catch(err){return;}
      target=document.getElementById(id);
      if(!target)return;
    }
    e.preventDefault();
    var toggle=document.getElementById('artyou-menu-toggle');
    if(toggle){toggle.checked=false;toggle.dispatchEvent(new Event('change',{bubbles:true}));}
    document.documentElement.classList.remove('artyou-menu-open');
    if(url.hash!==current.hash)history.pushState(null,'',url.pathname+url.search+url.hash);
    if(target)target.scrollIntoView({block:'start',behavior:'smooth'});
    else window.scrollTo({top:0,behavior:'smooth'});
  },true);
})();

/* One header geometry across static and rendered pages, including the blog. */
(function(){
  var s=document.createElement('style');s.id='artyou-header-alignment-v3';
  s.textContent=`
    @media(min-width:821px){
      html body header.am-wrap{
        display:grid!important;
        grid-template-columns:auto minmax(0,1fr) auto!important;
        align-items:center!important;
        column-gap:24px!important;
        min-height:88px!important;
        padding:14px 34px!important;
        box-sizing:border-box!important;
      }
      html body header.am-wrap>a:first-of-type{
        display:flex!important;
        align-items:center!important;
        justify-content:flex-start!important;
        width:auto!important;
        min-width:0!important;
        margin:0!important;
        flex:none!important;
      }
      html body header.am-wrap>a:first-of-type img{
        display:block!important;
        height:52px!important;
        width:auto!important;
        max-width:165px!important;
        object-fit:contain!important;
        margin:0!important;
      }
      html body header.am-wrap nav.am-wrap{
        display:flex!important;
        align-items:center!important;
        justify-content:center!important;
        flex-wrap:nowrap!important;
        gap:18px!important;
        width:100%!important;
        min-width:0!important;
        margin:0!important;
      }
      html body header.am-wrap nav.am-wrap>a{
        flex:0 0 auto!important;
        font-size:17px!important;
        line-height:1!important;
        white-space:nowrap!important;
      }
      html body header.am-wrap>div:last-child{
        display:flex!important;
        align-items:center!important;
        justify-content:flex-end!important;
        gap:8px!important;
        min-width:max-content!important;
        margin:0!important;
        flex:none!important;
      }
      html body header.am-wrap a#artyou-trial-header-cta{
        height:34px!important;
        min-height:34px!important;
        max-height:34px!important;
        padding:0 13px!important;
        font-size:12px!important;
        margin:0!important;
      }
      html body header.am-wrap #artyou-language{
        margin:0!important;
        flex:0 0 auto!important;
      }
      html body header.am-wrap #artyou-language .artyou-lang-trigger{
        height:28px!important;
        min-height:28px!important;
        padding:0 6px!important;
        margin:0!important;
      }
    }
    @media(min-width:821px) and (max-width:1180px){
      html body header.am-wrap{
        column-gap:14px!important;
        padding-left:20px!important;
        padding-right:20px!important;
      }
      html body header.am-wrap>a:first-of-type img{
        height:44px!important;
        max-width:145px!important;
      }
      html body header.am-wrap nav.am-wrap{gap:10px!important}
      html body header.am-wrap nav.am-wrap>a{font-size:12px!important}
      html body header.am-wrap a#artyou-trial-header-cta{
        height:31px!important;
        min-height:31px!important;
        max-height:31px!important;
        padding:0 10px!important;
        font-size:11px!important;
      }
      html body header.am-wrap #artyou-language .artyou-lang-trigger{
        height:26px!important;
        min-height:26px!important;
        padding:0 4px!important;
      }
    }
    @media(max-width:820px){
      html body header.am-wrap{
        display:flex!important;
        padding:10px 14px!important;
        gap:10px!important;
        min-height:64px!important;
      }
      html body header.am-wrap>a:first-of-type img{
        height:38px!important;
        width:auto!important;
        max-width:min(170px,44vw)!important;
      }
    }
  `;
  document.head.appendChild(s);
})();


/* WorkshoW trademark: keep the ™ discreet and typographically superscripted. */
(function(){
  function styleWorkshowTrademark(){
    if(!document.getElementById('artyou-workshow-tm-style')){
      var s=document.createElement('style');
      s.id='artyou-workshow-tm-style';
      s.textContent='.artyou-tm{display:inline-block!important;font-size:.38em!important;line-height:1!important;vertical-align:top!important;position:relative!important;top:.39em!important;margin-left:.05em!important;font-weight:600!important;} header nav .artyou-tm{top:.52em!important;} h1 .artyou-tm{top:0!important;} h2 .artyou-tm,h3 .artyou-tm{top:.52em!important;} nav[aria-label="Percorso"] .artyou-tm{top:.82em!important;font-size:.34em!important;}';
      document.head.appendChild(s);
    }
    var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    var nodes=[],n;
    while((n=walker.nextNode())){
      var p=n.parentElement;
      if(!p||/^(SCRIPT|STYLE|TEXTAREA|OPTION)$/i.test(p.tagName)||p.closest('.artyou-tm')) continue;
      if(n.nodeValue&&n.nodeValue.indexOf('WorkshoW™')!==-1) nodes.push(n);
    }
    nodes.forEach(function(node){
      var parts=node.nodeValue.split('WorkshoW™'),frag=document.createDocumentFragment();
      parts.forEach(function(part,i){
        if(i){
          frag.appendChild(document.createTextNode('WorkshoW'));
          var sup=document.createElement('sup');
          sup.className='artyou-tm';
          sup.textContent='™';
          frag.appendChild(sup);
        }
        if(part) frag.appendChild(document.createTextNode(part));
      });
      node.parentNode.replaceChild(frag,node);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',styleWorkshowTrademark);
  else styleWorkshowTrademark();
  window.addEventListener('pageshow',styleWorkshowTrademark);
})();

/* Festival submenu: restore the burgundy band and readable active links. */
(function(){
  var style=document.createElement('style');
  style.id='artyou-festival-subnav';
  style.textContent=`
    html body nav[aria-label="Festival"]{
      background:#7A1631!important;
      border-bottom:1px solid #7A1631!important;
      box-sizing:border-box!important;
      flex-wrap:nowrap!important;
      overflow-x:auto!important;
      scrollbar-width:none;
    }
    html body nav[aria-label="Festival"]::-webkit-scrollbar{display:none}
    html body nav[aria-label="Festival"]>span,
    html body nav[aria-label="Festival"]>a{
      color:#FFFFFF!important;
      flex-shrink:0!important;
      white-space:nowrap!important;
    }
    html body nav[aria-label="Festival"]>a[aria-current="page"]{
      border-bottom:3px solid #F09000!important;
      font-weight:700!important;
    }
    html body nav[aria-label="Festival"]>a:hover,
    html body nav[aria-label="Festival"]>a:focus-visible{
      color:#FFFFFF!important;
      text-decoration:underline!important;
      text-underline-offset:4px;
    }
  `;
  document.head.appendChild(style);
})();
