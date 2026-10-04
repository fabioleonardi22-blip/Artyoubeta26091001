
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
    s.id='artyou-global-ux-v1';
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
      .artyou-scroll-x{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
      @media(max-width:820px){
        html,body{width:100%;max-width:100%;overflow-x:hidden!important}
        html.artyou-menu-open body{overflow:hidden!important}
        html.artyou-form-focus .artyou-menu-btn{opacity:0!important;pointer-events:none!important;transform:translateY(12px)!important}
        body{padding-bottom:env(safe-area-inset-bottom,0px)}
        header{max-width:100vw!important}
        header>a:first-of-type{min-width:0!important}
        header>a:first-of-type img{max-width:min(170px,44vw)!important;height:auto!important;object-fit:contain!important}
        [style*="position: sticky"][style*="top: 96px"],
        [style*="position:sticky"][style*="top:96px"]{top:64px!important}
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
    document.addEventListener('focusin',function(e){
      if(e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) document.documentElement.classList.add('artyou-form-focus');
    });
    document.addEventListener('focusout',function(){
      setTimeout(function(){
        var a=document.activeElement;
        if(!a || !/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) document.documentElement.classList.remove('artyou-form-focus');
      },30);
    });
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
