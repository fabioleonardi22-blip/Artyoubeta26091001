/* La finestra sul cortile: archivio articoli e "Continua a leggere" */
(function(){
"use strict";
var CAT={"Improv around the world":"world","Festival Radar":"radar","Impro People":"people","Dentro l'improv":"inside"};
var FALLBACK_POOL=[
  "/img/rome-improv-festival.jpg",
  "/img/shortyou-4-ottobre.jpg",
  "/img/amatori-il-gioco-della-scena.jpg",
  "/img/teatro-prova-gratuita.jpg",
  "/img/hero-3.jpg",
  "https://images.unsplash.com/photo-1581611055683-d7b2b2f92077?auto=format&fit=crop&w=1600&q=82",
  "https://images.unsplash.com/photo-1629276300845-fcae346b4c6d?auto=format&fit=crop&w=1600&q=82"
];
function baseImageUrl(u){return String(u||"").split("?")[0]}
function fallbackFor(a,index,thumb){
  var seed=0,s=String((a&&a.slug)||"article");
  for(var i=0;i<s.length;i++)seed=(seed*31+s.charCodeAt(i))>>>0;
  var src=FALLBACK_POOL[(seed+(index||0))%FALLBACK_POOL.length]||FALLBACK_POOL[0];
  if(thumb&&/^https:\/\/images\.unsplash\.com\//.test(src))return src.replace(/w=1600/,"w=700").replace(/q=82/,"q=78");
  return src;
}
function normalizeImages(list){
  var used={};
  return (list||[]).map(function(a,index){
    var x=Object.assign({},a);
    var main=x.image||"";
    var key=baseImageUrl(main);
    if(!main||used[key]){
      main=fallbackFor(x,index,false);
      key=baseImageUrl(main);
      var guard=0;
      while(used[key]&&guard<FALLBACK_POOL.length){
        main=FALLBACK_POOL[(index+guard+1)%FALLBACK_POOL.length];
        key=baseImageUrl(main);guard++;
      }
      x.image=main;
    }
    used[key]=true;
    if(!x.imageThumb){
      x.imageThumb=/^https:\/\/images\.unsplash\.com\//.test(x.image)
        ? x.image.replace(/w=1600/,"w=700").replace(/q=82/,"q=78")
        : x.image;
    }
    return x;
  });
}
function imageFor(a,thumb){return (thumb&&a.imageThumb)||a.image||fallbackFor(a,0,thumb);}
var MESI=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(m){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]})}
function data(iso){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(iso||"");return m?Number(m[3])+" "+MESI[Number(m[2])-1]+" "+m[1]:esc(iso)}
function cc(c){return "cat-"+(CAT[c]||"world")}
function card(a){
  return '<article class="card has-img"><a class="card-link" href="'+esc(a.url)+'">'+
    '<span class="card-img"><img src="'+esc(imageFor(a,true))+'" alt="" loading="lazy"></span>'+
    '<div class="card-top"><span class="chip '+cc(a.category)+'">'+esc(a.category)+'</span><span class="date">'+data(a.date)+'</span></div>'+
    '<h3>'+esc(a.title)+'</h3><p>'+esc(a.excerpt)+'</p><span class="read">Leggi l’articolo <span aria-hidden="true">→</span></span></a></article>';
}
function load(){return fetch("/blog/articles.json",{cache:"no-store"}).then(function(r){return r.json()}).then(function(d){
  d.articles=normalizeImages((d.articles||[]).slice().sort(function(a,b){return String(b.date).localeCompare(String(a.date))}));return d})}
function festivalRadarItem(x){
  return '<a class="radar-item" href="'+esc(x.url||"https://improvfestivals.org/")+'" target="_blank" rel="noopener noreferrer">'+
    '<span class="radar-date">'+esc(x.date||"")+'</span>'+
    '<span class="radar-copy"><strong>'+esc(x.name||"Festival")+'</strong><small>'+esc(x.place||"")+'</small></span>'+
    '<span class="radar-arrow" aria-hidden="true">↗</span></a>';
}
function loadFestivalRadar(){
  var box=document.getElementById("radar");if(!box)return;
  fetch("/api/improv-festivals",{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error("radar");return r.json()}).then(function(d){
    var list=(d.items||[]).slice(0,5);
    box.innerHTML=list.length?list.map(festivalRadarItem).join(""):'<p class="radar-empty">Nessun festival in arrivo al momento.</p>';
  }).catch(function(){
    box.innerHTML='<p class="radar-empty">Calendario momentaneamente non disponibile. Usa il link qui sotto per vedere tutti i festival.</p>';
  });
}

/* Archivio */
var grid=document.getElementById("grid");
if(grid){
  var all=[],filter="all";
  var render=function(){
    var list=filter==="all"?all.slice(1):all.filter(function(a){return a.category===filter});
    if(filter==="all"&&!all.length)list=[];
    document.getElementById("count").textContent=(filter==="all"?all.length:list.length)+(((filter==="all"?all.length:list.length)===1)?" articolo":" articoli");
    grid.innerHTML=list.length?list.map(card).join(""):'<div class="empty">'+(filter==="all"&&all.length?"Gli altri articoli arriveranno presto: ne pubblichiamo uno nuovo ogni settimana.":"Nessun articolo in questa rubrica, per ora.")+'</div>';
  };
  load().then(function(d){
    all=d.articles;var f=all[0];
    var fe=document.getElementById("feature");
    if(f){var fi=imageFor(f,false);fe.classList.add("has-img");fe.style.setProperty("--feat-img",'url("'+String(fi).replace(/["\\]/g,"")+'")')}
    if(f)document.getElementById("feature").innerHTML='<a class="feature-link" href="'+esc(f.url)+'"><p class="kicker">Ultimo articolo · '+data(f.date)+'</p><span class="chip '+cc(f.category)+'">'+esc(f.category)+'</span><h2>'+esc(f.title)+'</h2><p>'+esc(f.excerpt)+'</p><span class="read">Leggi l’articolo <span aria-hidden="true">→</span></span></a>';
    else document.getElementById("feature").innerHTML='<p class="kicker">In arrivo</p><h2>Il primo articolo sta per uscire.</h2>';
    loadFestivalRadar();
    render();
  }).catch(function(){grid.innerHTML='<div class="empty">Archivio momentaneamente non disponibile.</div>'});
  document.querySelector(".tabs").addEventListener("click",function(e){
    var b=e.target.closest(".tab");if(!b)return;filter=b.dataset.filter;
    document.querySelectorAll(".tab").forEach(function(t){t.setAttribute("aria-pressed",String(t===b))});
    render();
  });
}

/* Articolo: altri articoli */
var more=document.getElementById("more");
if(more){
  load().then(function(d){
    var cur=more.dataset.current,me=d.articles.filter(function(a){return a.slug===cur})[0],cv=document.getElementById("cover");
    if(me&&cv&&!cv.dataset.ready){
      var mi=imageFor(me,false);
      cv.innerHTML='<img src="'+esc(mi)+'" alt="'+esc(me.imageAlt||me.title)+'" width="1600" height="900">'+(me.imageCredit?'<figcaption>Foto di <a href="'+esc(me.imageCredit.url)+'" target="_blank" rel="noopener">'+esc(me.imageCredit.name)+'</a> su <a href="'+esc(me.imageSourceUrl||"https://unsplash.com/")+'" target="_blank" rel="noopener">Unsplash</a></figcaption>':'');
      cv.hidden=false;cv.dataset.ready="1";
    }
    var list=d.articles.filter(function(a){return a.slug!==cur}).slice(0,3);
    if(!list.length)return;
    document.getElementById("moreGrid").innerHTML=list.map(card).join("");more.hidden=false;
  }).catch(function(){});
}
})();
