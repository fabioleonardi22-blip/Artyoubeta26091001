/* La finestra sul cortile: archivio articoli e "Continua a leggere" */
(function(){
"use strict";
var CAT={"Improv around the world":"world","Festival Radar":"radar","Impro People":"people","Dentro l'improv":"inside"};
var MESI=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(m){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]})}
function data(iso){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(iso||"");return m?Number(m[3])+" "+MESI[Number(m[2])-1]+" "+m[1]:esc(iso)}
function cc(c){return "cat-"+(CAT[c]||"world")}
function card(a){
  return '<article class="card'+(a.image?' has-img':'')+'"><a class="card-link" href="'+esc(a.url)+'">'+
    (a.image?'<span class="card-img"><img src="'+esc(a.imageThumb||a.image)+'" alt="" loading="lazy"></span>':'')+
    '<div class="card-top"><span class="chip '+cc(a.category)+'">'+esc(a.category)+'</span><span class="date">'+data(a.date)+'</span></div>'+
    '<h3>'+esc(a.title)+'</h3><p>'+esc(a.excerpt)+'</p><span class="read">Leggi l’articolo <span aria-hidden="true">→</span></span></a></article>';
}
function load(){return fetch("/blog/articles.json",{cache:"no-store"}).then(function(r){return r.json()}).then(function(d){
  d.articles=(d.articles||[]).slice().sort(function(a,b){return String(b.date).localeCompare(String(a.date))});return d})}

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
    if(f&&f.image){fe.classList.add("has-img");fe.style.setProperty("--feat-img",'url("'+String(f.image).replace(/["\\]/g,"")+'")')}
    if(f)document.getElementById("feature").innerHTML='<a class="feature-link" href="'+esc(f.url)+'"><p class="kicker">Ultimo articolo · '+data(f.date)+'</p><span class="chip '+cc(f.category)+'">'+esc(f.category)+'</span><h2>'+esc(f.title)+'</h2><p>'+esc(f.excerpt)+'</p><span class="read">Leggi l’articolo <span aria-hidden="true">→</span></span></a>';
    else document.getElementById("feature").innerHTML='<p class="kicker">In arrivo</p><h2>Il primo articolo sta per uscire.</h2>';
    var radar=d.radar||[];
    if(radar.length)document.getElementById("radar").innerHTML=radar.slice(0,5).map(function(x){
      return '<div class="radar-item">'+(x.url?'<a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">':'')+'<strong>'+esc(x.name)+'</strong>'+(x.url?'</a>':'')+'<span>'+esc(x.place)+(x.place&&x.date?' · ':'')+esc(x.date)+'</span>'+(x.verified?'<em class="ok">Verificato sul sito ufficiale</em>':'')+'</div>'}).join("")+(d.radarUpdated?'<p class="radar-upd">Aggiornato il '+data(d.radarUpdated)+'</p>':'');
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
    if(me&&me.image&&cv&&!cv.dataset.ready){
      cv.innerHTML='<img src="'+esc(me.image)+'" alt="'+esc(me.imageAlt||me.title)+'" width="1600" height="900">'+(me.imageCredit?'<figcaption>Foto di <a href="'+esc(me.imageCredit.url)+'" target="_blank" rel="noopener">'+esc(me.imageCredit.name)+'</a> su <a href="'+esc(me.imageSourceUrl||"https://unsplash.com/")+'" target="_blank" rel="noopener">Unsplash</a></figcaption>':'');
      cv.hidden=false;cv.dataset.ready="1";
    }
    var list=d.articles.filter(function(a){return a.slug!==cur}).slice(0,3);
    if(!list.length)return;
    document.getElementById("moreGrid").innerHTML=list.map(card).join("");more.hidden=false;
  }).catch(function(){});
}
})();
