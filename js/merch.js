(function(){
"use strict";
/* ===== Catalogo: modifica qui prodotti, prezzi, colori e foto =====
   images: una foto per colore (se un colore non ha foto, usa "default").
   noPhoto: colori senza foto propria (la scheda mostra una nota).
   Un prodotto senza nessuna foto mostra un segnaposto "Foto in arrivo".
   gallery (facoltativo): altre foto del prodotto (retro, dettagli...), es.
   gallery:["/img/merch/tee-actor-retro.webp"]: diventano miniature nella
   pagina prodotto. Per legare una foto extra a un colore:
   gallery:[{src:"/img/merch/foto.webp",color:"Bordeaux"}]. */
const WHATSAPP="393271881956";
const CATS=[
  {id:"all",label:"Tutti"},
  {id:"tshirt",label:"T-shirt"},
  {id:"felpe",label:"Felpe"},
  {id:"pantaloni",label:"Pantaloni"},
  {id:"calzini",label:"Calzini"}
];
const SWATCH={Nero:"#111",Bianco:"#F6F3EC",Bordeaux:"#8E2941",Grigio:"#8B8F92","Grigio antracite":"#3B3D40",Arancio:"#F09000",Verde:"#174F39",Blu:"#1F3F9A","Blu notte":"#1D2640",Viola:"#5E4A8C",Cyan:"#12B9D6","Verde petrolio":"#15524F",Azzurro:"#6FA8DC",Rosso:"#C8102E"};
const M="/img/merch/";
/* Guida taglie: misure del capo in cm. VALORI INDICATIVI da sostituire
   con la scheda misure del fornitore. Le colonne si possono cambiare. */
const SIZE_GUIDE={
  tshirt:{note:"Misure del capo steso, in centimetri.",cols:["Larghezza petto","Lunghezza"],rows:{S:[47,70],M:[52,73],L:[56,76],XL:[61,79]},
    how:"Larghezza: da ascella ad ascella, con la maglia stesa. Lunghezza: dal punto più alto della spalla all'orlo."},
  felpe:{note:"Misure del capo steso, in centimetri.",cols:["Larghezza petto","Lunghezza","Manica"],rows:{S:[53,68,61],M:[56,70,62],L:[59,72,63],XL:[62,74,64]},
    how:"Larghezza: da ascella ad ascella, con la zip chiusa. Lunghezza: dalla spalla all'orlo. Manica: dalla spalla al polsino."},
  pantaloni:{note:"Misure del capo steso, in centimetri.",cols:["Vita (rilassata)","Lunghezza esterna"],rows:{S:[34,100],M:[37,102],L:[40,104],XL:[43,106]},
    how:"Vita: metà circonferenza dell'elastico, a riposo. Lunghezza: lungo la cucitura esterna, dalla vita all'orlo."},
  calzini:{note:"Le taglie dei calzini corrispondono al numero di scarpa.",cols:["Numero di scarpa"],rows:{"35-38":["35 – 38"],"39-42":["39 – 42"],"43-46":["43 – 46"]},how:""}
};
const PRODUCTS=[
 {id:"tee-trust-the-play",nuovo:true,family:"T-shirt Artyou",cat:"tshirt",name:"Trust the Play",price:14,
  desc:"Per chi improvvisa: “I’m an improviser · Trust the play” sul petto e il cervello Artyou sulla manica.",
  colors:["Nero","Bordeaux"],sizes:["S","M","L","XL"],images:{Nero:M+"tee-trust-the-play-nero.webp",Bordeaux:M+"tee-trust-the-play-bordeaux.webp",default:M+"tee-trust-the-play-nero.webp"}},
 {id:"tee-learn-to-play",nuovo:true,family:"T-shirt Artyou",cat:"tshirt",name:"Learn to Play",price:14,
  desc:"Per chi improvvisa e non smette di imparare: “I’m an improviser · Learn to play” sul petto e il cervello Artyou sulla manica.",
  colors:["Verde petrolio"],sizes:["S","M","L","XL"],images:{"Verde petrolio":M+"tee-learn-to-play-petrolio.webp",default:M+"tee-learn-to-play-petrolio.webp"}},
 {id:"tee-inspire-the-other",nuovo:true,family:"T-shirt Artyou",cat:"tshirt",name:"Inspire the Other",price:14,
  desc:"Per chi insegna: “I’m a teacher · Inspire the other” sul petto e il vortice Artyou sul fianco.",
  colors:["Blu notte"],sizes:["S","M","L","XL"],images:{"Blu notte":M+"tee-inspire-the-other-blunotte.webp",default:M+"tee-inspire-the-other-blunotte.webp"}},
 {id:"tee-yep-2024",family:"T-shirt Artyou",cat:"tshirt",name:"YEP 2024",price:14,
  desc:"La maglietta di YEP 2024: “Shine a light on someone to make them glow, use your extra power” sul petto, firmata Artyou Roma.",
  colors:["Rosso","Azzurro"],sizes:["S","M","L","XL"],images:{Rosso:M+"tee-yep-2024-rosso.webp",Azzurro:M+"tee-yep-2024-azzurro.webp",default:M+"tee-yep-2024-rosso.webp"}},
 {id:"tee-act-believe",nuovo:true,family:"T-shirt Artyou",cat:"tshirt",name:"Act Believe Improv",price:14,
  desc:"La grafica Artyou · Act · Believe · Improv stampata sul petto, per chi in scena ci crede davvero.",
  colors:["Verde","Blu notte"],sizes:["S","M","L","XL"],
  images:{Verde:M+"tee-act-believe-verde.webp","Blu notte":M+"tee-act-believe-blu.webp",default:M+"tee-act-believe-verde.webp"},gallery:[M+"tee-act-believe-verde-2.webp"]},
 {id:"tee-standup999",nuovo:true,family:"T-shirt Artyou",cat:"tshirt",name:"Standup999",price:14,
  desc:"Per chi sale sul palco con un microfono in mano: scritta Standup999 sul petto e vortice Artyou multicolore sul fianco.",
  colors:["Viola"],sizes:["S","M","L","XL"],images:{Viola:M+"tee-standup999-viola.webp",default:M+"tee-standup999-viola.webp"}},
 {id:"tee-wordcloud",family:"T-shirt Artyou",cat:"tshirt",name:"Improv Wordcloud",price:14,
  desc:"La nuvola di parole dell’improvvisazione (ascolto, status, emozioni, gioco…) stampata sul petto e il vortice Artyou sul fianco.",
  colors:["Verde"],sizes:["S","M","L","XL"],images:{Verde:M+"tee-wordcloud-verde-2.webp",default:M+"tee-wordcloud-verde-2.webp"},gallery:[M+"tee-wordcloud-verde-flat.webp"]},
 {id:"tee-actor",family:"T-shirt Artyou",cat:"tshirt",name:"I’m an Actor",price:14,
  desc:"Per chi in scena c’è, e lo dice. Scritta frontale e vortice Artyou sul fianco.",
  colors:["Nero"],sizes:["S","M","L","XL"],images:{Nero:M+"tee-actor-donna.webp",default:M+"tee-actor-donna.webp"},gallery:[M+"tee-actor-uomo.webp"]},
 {id:"tee-memory",family:"T-shirt Artyou",cat:"tshirt",name:"Improvviso",price:14,
  desc:"“Improvviso perché odio fare la memoria”: la scusa perfetta, stampata sul petto, con il vortice Artyou sul fianco.",
  colors:["Blu","Blu notte"],sizes:["S","M","L","XL"],
  images:{Blu:M+"tee-improvviso-blu.webp","Blu notte":M+"tee-improvviso-blunotte.webp",default:M+"tee-improvviso-blu.webp"}},
 {id:"tee-arte",family:"T-shirt Artyou",cat:"tshirt",name:"Io sono Arte",price:14,
  desc:"Essenziale e diretta: “Io sono Arte” sul petto, vortice Artyou sul fianco.",
  colors:["Nero"],sizes:["S","M","L","XL"],images:{Nero:M+"tee-arte-nero.webp",default:M+"tee-arte-nero.webp"},gallery:[M+"tee-arte-nero-flat.webp"]},
 {id:"tee-its-all-theater",nuovo:true,family:"T-shirt Artyou",cat:"tshirt",name:"It’s All Theater",price:14,
  desc:"Perché alla fine è tutto teatro: “It’s all theater” sul petto e il vortice Artyou sul fianco. Sulla versione bianca la stampa è nera.",
  colors:["Blu notte","Nero","Bianco"],sizes:["S","M","L","XL"],images:{"Blu notte":M+"tee-its-all-theater-blunotte.webp",Nero:M+"tee-its-all-theater-nero.webp",Bianco:M+"tee-its-all-theater-bianco.webp",default:M+"tee-its-all-theater-blunotte.webp"}},
 {id:"tee-im-theatre",nuovo:true,family:"T-shirt Artyou",cat:"tshirt",name:"I’m Theatre",price:14,
  desc:"Corta e chiara: “I’m Theatre” sul petto, il vortice Artyou sul fianco e il cervello Artyou sulla manica.",
  colors:["Nero"],sizes:["S","M","L","XL"],images:{Nero:M+"tee-im-theatre-nero-foto.webp",default:M+"tee-im-theatre-nero-foto.webp"},gallery:[M+"tee-im-theatre-nero.webp"]},
 {id:"hoodie-thinkbig",family:"Felpa Artyou",cat:"felpe",name:"Think Big",price:30,
  desc:"Felpa con zip e cappuccio, logo Artyou sul petto e il manifesto “Think big, believe big, act big” scritto a mano sulla tasca.",
  colors:["Cyan","Nero","Verde","Bordeaux"],sizes:["S","M","L","XL"],
  images:{Cyan:M+"felpa-thinkbig-cyan.webp",Nero:M+"felpa-thinkbig-nero.webp",default:M+"felpa-thinkbig-cyan.webp"},
  noPhoto:["Verde","Bordeaux"]},
 {id:"hoodie-ithink",nuovo:true,family:"Felpa Artyou",cat:"felpe",name:"I Think",price:30,
  desc:"Felpa con zip e cappuccio, logo Artyou sul petto e la frase “I think therefore I am, and I act because I think” sulla tasca.",
  colors:["Nero","Grigio antracite","Verde"],sizes:["S","M","L","XL"],
  images:{Nero:M+"felpa-ithink-nero.webp","Grigio antracite":M+"felpa-ithink-antracite.webp",Verde:M+"felpa-ithink-verde.webp",default:M+"felpa-ithink-nero.webp"}},
 {id:"hoodie-ithink-variant",nuovo:true,family:"Felpa Artyou",cat:"felpe",name:"I Think - Variant Ed.",price:30,
  desc:"L’edizione variant della felpa I Think: logo Artyou a colori sul petto e la frase “I think therefore I am, and I act because I think” sulla tasca.",
  colors:["Bianco","Bordeaux"],sizes:["S","M","L","XL"],
  images:{Bianco:M+"felpa-ithink-variant-bianco.webp",Bordeaux:M+"felpa-ithink-variant-bordeaux.webp",default:M+"felpa-ithink-variant-bianco.webp"},
  gallery:[{src:M+"felpa-ithink-variant-bordeaux-2.webp",color:"Bordeaux"}]},
 {id:"jogger",family:"Pantaloni Artyou",cat:"pantaloni",name:"Jogger",price:20,
  desc:"Pantaloni jogger comodi per le lezioni e per tutto il resto, con il logo Artyou multicolore lungo la gamba.",
  colors:["Nero","Grigio"],sizes:["S","M","L","XL"],images:{Nero:M+"jogger-nero.webp",default:M+"jogger-nero.webp"},noPhoto:["Grigio"]},
 {id:"socks",family:"Calzini antiscivolo",cat:"calzini",name:"Calzini Grip",price:5,
  desc:"Calzini antiscivolo per lavorare in sala in sicurezza, senza scarpe.",
  colors:["Nero","Arancio"],sizes:["35-38","39-42","43-46"],
  images:{Nero:M+"calzini-grip-nero.webp",default:M+"calzini-grip-nero.webp"},noPhoto:["Arancio"]}
];

/* ===== Magazzino (Google Sheet tramite /api/merch) =====
   Se il magazzino non risponde, il sito resta usabile: niente
   disponibilità mostrate e l'ordine parte solo via WhatsApp. */
const API="/api/merch",K_CART="artyou_merch_cart",SHOP_URL="/merchandising.html";
const productUrl=(p,color)=>"/merchandising-prodotto.html?id="+encodeURIComponent(p.id)+(color?"&colore="+encodeURIComponent(color):"");
let STOCK=null;
const store={
  get(k,f){try{const v=JSON.parse(localStorage.getItem(k));return v==null?f:v}catch(e){return f}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
const vKey=(id,c,z)=>id+"|"+c+"|"+z;
const live=()=>STOCK!==null;
function qtyOf(p,c,z){if(!live())return null;const v=STOCK[vKey(p.id,c,z)];return v?v.qty:0}
function colorsOf(p){return live()?p.colors.filter(c=>p.sizes.some(z=>STOCK[vKey(p.id,c,z)])):p.colors}
function totalOf(p){return live()?p.colors.reduce((n,c)=>n+p.sizes.reduce((m,z)=>m+(qtyOf(p,c,z)||0),0),0):null}
function isActive(p){return !live()||colorsOf(p).length>0}
function priceOf(p,c,z){
  if(!live())return p.price;
  if(c&&z&&STOCK[vKey(p.id,c,z)])return STOCK[vKey(p.id,c,z)].prezzo||p.price;
  const ps=Object.keys(STOCK).filter(k=>k.indexOf(p.id+"|")===0).map(k=>STOCK[k].prezzo).filter(x=>x>0);
  return ps.length?Math.min.apply(null,ps):p.price;
}
let cart=store.get(K_CART,[]).filter(l=>PRODUCTS.some(p=>p.id===l.id));
function inCart(p,c,z){return cart.filter(l=>l.id===p.id&&l.color===c&&l.size===z).reduce((n,l)=>n+l.qty,0)}
function maxAddable(p,c,z){const q=qtyOf(p,c,z);return q===null?10:Math.max(0,Math.min(10,q-inCart(p,c,z)))}
function fixSel(p,s){
  const cs=colorsOf(p);if(cs.length&&cs.indexOf(s.color)<0)s.color=cs[0];
  if(live()&&!qtyOf(p,s.color,s.size)){const ok=p.sizes.find(z=>qtyOf(p,s.color,z)>0);if(ok)s.size=ok}
}
const sel={};
PRODUCTS.forEach(p=>sel[p.id]={color:p.colors[0],size:p.sizes[Math.min(1,p.sizes.length-1)]});
const onStock=[];
function loadStock(){
  return fetch(API+"?stock=1",{cache:"no-store"}).then(r=>r.json()).then(j=>{
    if(j&&j.ok&&j.varianti){STOCK=j.varianti;PRODUCTS.forEach(p=>fixSel(p,sel[p.id]))}
  }).catch(()=>{}).then(()=>{onStock.forEach(f=>f());renderCart()});
}

/* ===== Utilità ===== */
const $=s=>document.querySelector(s);
const euro=v=>new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(v);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const catLabel=id=>(CATS.find(c=>c.id===id)||{}).label||"";
const imgFor=(p,color)=>p.images[color]||p.images.default||"";
const SOCK_SVG='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" aria-hidden="true"><path d="M24 6h18v26l-14 18a9 9 0 0 1-14-11l10-12V6Z"/><path d="M24 14h18"/></svg>';
function imgHTML(src,alt,eager){
  if(!src)return '<div class="placeholder">'+SOCK_SVG+'<span>Foto in arrivo</span></div>';
  return '<img src="'+src+'" alt="'+esc(alt)+'"'+(eager?'':' loading="lazy"')+' width="320" height="400">';
}
const mediaHTML=(p,color,eager)=>imgHTML(imgFor(p,color),p.family+" "+p.name+" – "+color,eager);
function badgeHTML(p){
  const t=totalOf(p);
  if(t===0)return '<span class="badge out">Esaurito</span>';
  if(t!==null&&t<=5)return '<span class="badge low">Ultimi pezzi</span>';
  const n=colorsOf(p).length;
  return n>2?'<span class="badge">'+n+' colori</span>':"";
}
const swatchesHTML=(p,cur)=>colorsOf(p).map(c=>'<button type="button" class="swatch" data-color="'+c+'" aria-pressed="'+(c===cur)+'" aria-label="'+c+'" title="'+c+'" style="background:'+SWATCH[c]+'"></button>').join("");
function sizesHTML(p,color,cur){
  return p.sizes.map(z=>{
    const q=qtyOf(p,color,z),out=q===0;
    return '<button type="button" class="size'+(out?' soldout':'')+'" data-size="'+z+'" aria-pressed="'+(z===cur)+'"'+(out?' disabled aria-label="'+z+' esaurita"':'')+'>'+z+'</button>';
  }).join("");
}
function addLabel(p,c,z,qty){
  if(totalOf(p)===0)return "Esaurito";
  if(qtyOf(p,c,z)===0)return "Taglia esaurita";
  if(maxAddable(p,c,z)===0)return "Già tutto nel carrello";
  return qty?"Aggiungi al carrello · "+euro(priceOf(p,c,z)*qty):"Aggiungi";
}
let tt;function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");clearTimeout(tt);tt=setTimeout(()=>el.classList.remove("show"),2600)}

/* ===== Overlay ===== */
let lastFocus=null;
function openOverlay(el){lastFocus=document.activeElement;el.classList.add("open");el.setAttribute("aria-hidden","false");document.body.classList.add("locked");setTimeout(()=>{const f=el.querySelector("[data-close]");f&&f.focus()},30)}
function closeOverlay(el){el.classList.remove("open");el.setAttribute("aria-hidden","true");if(!document.querySelector(".overlay.open"))document.body.classList.remove("locked");lastFocus&&lastFocus.focus&&lastFocus.focus()}
document.addEventListener("keydown",e=>{if(e.key==="Escape"){const o=document.querySelector(".overlay.open");o&&closeOverlay(o)}});

/* ===== Carrello (pannello laterale, uguale su tutte le pagine merch) ===== */
document.body.insertAdjacentHTML("beforeend",`
<div class="overlay" id="drawer" aria-hidden="true">
  <aside class="panel" role="dialog" aria-modal="true" aria-labelledby="cartTitle">
    <div class="panel-head"><h2 id="cartTitle">Il tuo ordine</h2><button class="close" data-close aria-label="Chiudi il carrello">×</button></div>
    <div class="panel-scroll" id="cartItems"></div>
    <form class="checkout" id="checkout" novalidate>
      <div class="total"><span>Totale</span><strong id="cartTotal">€ 0,00</strong></div>
      <div class="fields">
        <label>Nome e cognome<input name="nome" autocomplete="name" required></label>
        <label>Telefono<input name="tel" type="tel" autocomplete="tel" required></label>
        <label class="full">Sede di ritiro
          <select name="sede" required>
            <option value="">Scegli la sede</option>
            <option>San Giovanni</option><option>Eroi</option><option>Ionio</option>
            <option>Valle Aurelia</option><option>Africano</option><option>Boccea</option>
          </select>
        </label>
        <label class="full">Note (facoltative)<textarea name="note" rows="2" placeholder="Es. corso del martedì, ritiro dopo lezione"></textarea></label>
      </div>
      <div class="err" id="formErr" role="alert"></div>
      <input type="text" name="_hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px">
      <button type="submit" class="btn btn-orange send">Invia l’ordine</button>
      <p class="fine">Ti mettiamo da parte i capi e li paghi al ritiro in sede. I dati servono solo a gestire l’ordine (<a href="/privacy-policy/" target="_blank" rel="noopener">privacy</a>).</p>
    </form>
    <div class="done" id="done" hidden>
      <div class="done-icon" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h3>Ordine ricevuto!</h3>
      <p>Il tuo ordine <strong id="doneId"></strong> è registrato e i capi sono messi da parte per te.</p>
      <p>Ritiro nella sede <strong id="doneSede"></strong> · totale <strong id="doneTot"></strong>, da pagare al ritiro. Ti scriviamo quando è pronto.</p>
      <a class="btn-wa" id="doneWa" href="#" target="_blank" rel="noopener">Scrivici su WhatsApp</a>
      <button class="btn more" data-close>Continua lo shopping</button>
    </div>
  </aside>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`);
const drawer=$("#drawer");
drawer.addEventListener("click",e=>{if(e.target===drawer||e.target.closest("[data-close]"))closeOverlay(drawer)});

function saveCart(){store.set(K_CART,cart)}
function addToCart(p,color,size,qty){
  qty=Math.min(qty,maxAddable(p,color,size));if(qty<1)return false;
  const line=cart.find(l=>l.id===p.id&&l.color===color&&l.size===size);
  if(line)line.qty+=qty;else cart.push({id:p.id,color,size,qty});
  saveCart();renderCart();
  document.querySelectorAll("[data-cart-open]").forEach(b=>{b.classList.remove("bump");void b.offsetWidth;b.classList.add("bump")});
  toast(p.name+" ("+color+", "+size+") aggiunto al carrello");
  return true;
}
const lineP=l=>PRODUCTS.find(p=>p.id===l.id);
const cartTotal=()=>cart.reduce((a,l)=>a+l.qty*priceOf(lineP(l),l.color,l.size),0);
let step="cart";
function showStep(st){
  step=st;
  $("#cartItems").hidden=st!=="cart";$("#checkout").hidden=st!=="cart"||!cart.length;$("#done").hidden=st!=="done";
}
function renderCart(){
  const n=cart.reduce((a,l)=>a+l.qty,0);
  document.querySelectorAll("[data-cart-count]").forEach(el=>{el.textContent=n;el.hidden=!n});
  document.querySelectorAll("[data-cart-open]").forEach(b=>b.setAttribute("aria-label","Apri il carrello ("+n+" articoli)"));
  $("#cartTotal").textContent=euro(cartTotal());
  showStep(step==="done"&&!cart.length?"done":"cart");
  $("#cartItems").innerHTML=cart.length?cart.map((l,i)=>{
    const p=lineP(l),src=imgFor(p,l.color),q=qtyOf(p,l.color,l.size),warn=q!==null&&q<l.qty;
    return '<div class="line'+(warn?' warn':'')+'"><a class="thumb" href="'+productUrl(p,l.color)+'">'+(src?'<img src="'+src+'" alt="">':'<div class="placeholder" style="gap:0">'+SOCK_SVG+'</div>')+'</a>'+
      '<div><strong>'+esc(p.family+" · "+p.name)+'</strong><small>'+l.color+' · Taglia '+l.size+'</small><br><small>'+euro(priceOf(p,l.color,l.size))+' cad.</small>'+
      (warn?'<br><small class="warn-txt">'+(q===0?'Non più disponibile':'Disponibili solo '+q)+'</small>':'')+'</div>'+
      '<div class="right"><div class="qty"><button type="button" data-i="'+i+'" data-d="-1" aria-label="Diminuisci">−</button><output>'+l.qty+'</output><button type="button" data-i="'+i+'" data-d="1" aria-label="Aumenta"'+(maxAddable(p,l.color,l.size)<1?' disabled':'')+'>+</button></div>'+
      '<button class="remove" data-rm="'+i+'">Rimuovi</button></div></div>';
  }).join(""):'<div class="cart-empty"><p>Il carrello è vuoto.</p><a class="btn btn-orange" href="'+SHOP_URL+'#shop">Guarda la collezione</a></div>';
}
$("#cartItems").addEventListener("click",e=>{
  const d=e.target.closest("[data-d]"),r=e.target.closest("[data-rm]");
  if(d){const l=cart[+d.dataset.i],p=lineP(l);
    if(+d.dataset.d>0){if(maxAddable(p,l.color,l.size)>0)l.qty++}else{l.qty--;if(l.qty<1)cart.splice(+d.dataset.i,1)}}
  else if(r)cart.splice(+r.dataset.rm,1);
  else return;
  saveCart();renderCart();onStock.forEach(f=>f());
});
document.addEventListener("click",e=>{
  if(e.target.closest("[data-cart-open]")){step="cart";renderCart();openOverlay(drawer)}
  if(e.target.closest("header nav a")){const t=$("#menu-toggle");t&&(t.checked=false)}
});

/* ===== Invio ordine ===== */
function waText(lines,extra){return ["Ciao Artyou! Vorrei ordinare dal merchandising:",""].concat(lines,[""],extra).join("\n")}
function waUrl(t){return "https://wa.me/"+WHATSAPP+"?text="+encodeURIComponent(t)}
const ERRORI={campi_mancanti:"Compila nome, telefono e sede di ritiro.",telefono_non_valido:"Controlla il numero di telefono.",
  sede_non_valida:"Scegli una sede dall’elenco.",quantita_eccessiva:"Puoi ordinare al massimo 10 pezzi per articolo e 20 in tutto.",
  carrello_vuoto:"Il carrello è vuoto.",server_occupato:"Troppe richieste in questo momento: riprova tra qualche secondo."};
$("#checkout").addEventListener("submit",e=>{
  e.preventDefault();
  const f=e.target,err=$("#formErr"),send=f.querySelector(".send");
  const nome=f.nome.value.trim(),tel=f.tel.value.trim(),sede=f.sede.value,note=f.note.value.trim();
  err.innerHTML="";
  if(!cart.length){err.textContent=ERRORI.carrello_vuoto;return}
  if(!nome||!tel||!sede){err.textContent=ERRORI.campi_mancanti;(!nome?f.nome:!tel?f.tel:f.sede).focus();return}
  if(tel.replace(/\D/g,"").length<8){err.textContent=ERRORI.telefono_non_valido;f.tel.focus();return}
  const righe=cart.map(l=>{const p=lineP(l);return "• "+l.qty+"× "+p.family+" "+p.name+" – "+l.color+", taglia "+l.size+" ("+euro(priceOf(p,l.color,l.size)*l.qty)+")"});
  const dati=["Totale: "+euro(cartTotal()),"Nome: "+nome,"Telefono: "+tel,"Ritiro: sede "+sede].concat(note?["Note: "+note]:[]);
  if(!live()){
    window.open(waUrl(waText(righe,dati)),"_blank","noopener");
    cart=[];saveCart();renderCart();f.reset();closeOverlay(drawer);
    toast("Ordine pronto su WhatsApp: premi invio per mandarlo!");return;
  }
  send.disabled=true;send.textContent="Invio in corso…";
  fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({
    action:"ordine",nome,telefono:tel,sede,note,_hp:f._hp.value,
    items:cart.map(l=>({id:l.id,colore:l.color,taglia:l.size,qty:l.qty}))
  })}).then(r=>r.json()).then(j=>{
    if(j&&j.ok){
      const tot=typeof j.totale==="number"?j.totale:cartTotal();
      $("#doneId").textContent=j.id;$("#doneSede").textContent=sede;$("#doneTot").textContent=euro(tot);
      $("#doneWa").href=waUrl("Ciao Artyou! Ho appena fatto l’ordine "+j.id+" dal sito ("+euro(tot)+"), ritiro nella sede "+sede+". Nome: "+nome+".");
      cart=[];saveCart();f.reset();renderCart();showStep("done");loadStock();return;
    }
    if(j&&j.errore==="non_disponibile"){
      if(j.varianti)STOCK=j.varianti;
      renderCart();onStock.forEach(fn=>fn());
      err.textContent="Nel frattempo alcuni capi sono finiti: li trovi segnati in rosso. Riduci le quantità o rimuovili e invia di nuovo.";
      return;
    }
    throw new Error((j&&j.errore)||"errore");
  }).catch(x=>{
    const m=ERRORI[x&&x.message];
    if(m){err.textContent=m;return}
    err.innerHTML='Non riusciamo a registrare l’ordine in questo momento. <a href="'+waUrl(waText(righe,dati))+'" target="_blank" rel="noopener">Invialo su WhatsApp</a> e lo registriamo noi.';
  }).finally(()=>{send.disabled=false;send.textContent="Invia l’ordine"});
});
addEventListener("storage",e=>{if(e.key===K_CART){cart=store.get(K_CART,[]);renderCart();onStock.forEach(f=>f())}});

/* ===== Mini-card usata nei caroselli ===== */
function miniHTML(p){
  return '<a class="mini" href="'+productUrl(p)+'"><span class="mini-img">'+mediaHTML(p,colorsOf(p)[0]||p.colors[0])+'</span>'+
    '<span class="mini-name">'+esc(p.name)+'</span><span class="mini-price">'+euro(priceOf(p))+(totalOf(p)===0?' · <em>esaurito</em>':'')+'</span></a>';
}
function railHTML(title,list,id){
  return '<section class="rail" aria-labelledby="'+id+'"><div class="rail-head"><h2 id="'+id+'">'+esc(title)+'</h2>'+
    '<div class="rail-nav"><button type="button" class="arrow" data-dir="-1" aria-label="Indietro">‹</button><button type="button" class="arrow" data-dir="1" aria-label="Avanti">›</button></div></div>'+
    '<div class="track">'+list.map(miniHTML).join("")+'</div></section>';
}
function wireRails(root){
  root.querySelectorAll(".rail").forEach(r=>{
    const t=r.querySelector(".track"),nav=r.querySelector(".rail-nav"),[prev,next]=r.querySelectorAll(".arrow");
    const upd=()=>{const over=t.scrollWidth>t.clientWidth+4;nav.hidden=!over;prev.disabled=t.scrollLeft<4;next.disabled=t.scrollLeft+t.clientWidth>=t.scrollWidth-4};
    r.addEventListener("click",e=>{const a=e.target.closest(".arrow");if(a)t.scrollBy({left:Number(a.dataset.dir)*t.clientWidth*.85,behavior:"smooth"})});
    t.addEventListener("scroll",upd,{passive:true});addEventListener("resize",upd);upd();
  });
}

/* ======================================================
   PAGINA NEGOZIO (merchandising.html)
   ====================================================== */
const grid=$("#grid");
if(grid){
  let filter="all";
  const tabs=$("#tabs");
  const renderTabs=()=>{
    const vis=PRODUCTS.filter(isActive);
    tabs.innerHTML=CATS.filter(c=>c.id==="all"||vis.some(p=>p.cat===c.id)).map(c=>{
      const n=c.id==="all"?vis.length:vis.filter(p=>p.cat===c.id).length;
      return '<button class="tab" role="tab" data-cat="'+c.id+'" aria-selected="'+(c.id===filter)+'">'+c.label+'<small>'+n+'</small></button>';
    }).join("");
  };
  tabs.addEventListener("click",e=>{
    const b=e.target.closest("[data-cat]");if(!b)return;
    filter=b.dataset.cat;
    tabs.querySelectorAll(".tab").forEach(t=>t.setAttribute("aria-selected",t===b));
    $("#shopTitle").textContent=filter==="all"?"Tutta la collezione":catLabel(filter);
    renderGrid();
    const top=$("#shop").getBoundingClientRect().top+scrollY-170;
    if(scrollY>top)scrollTo({top,behavior:"smooth"});
  });
  // seconda foto mostrata al passaggio del mouse: foto extra o altro colore
  const hoverImg=(p,color)=>{
    const main=imgFor(p,color);
    const alts=(p.gallery||[]).map(g=>typeof g==="string"?g:g.src).concat(colorsOf(p).map(c=>p.images[c]).filter(Boolean)).filter(x=>x&&x!==main);
    return alts[0]||"";
  };
  const cardHTML=p=>{
    const s=sel[p.id],url=productUrl(p,s.color),t=totalOf(p),alt=hoverImg(p,s.color),cols=colorsOf(p);
    const badges=(t===0?'<span class="badge out">Esaurito</span>':t!==null&&t<=5?'<span class="badge low">Ultimi pezzi</span>':p.nuovo?'<span class="badge new">Nuovo</span>':'');
    const quick=t===0?'':'<div class="quick-add" aria-label="Aggiunta veloce, colore '+s.color+'"><span>Aggiungi in taglia</span><div class="qa-sizes">'+
      p.sizes.map(z=>{const out=qtyOf(p,s.color,z)===0||maxAddable(p,s.color,z)===0;return '<button type="button" data-quick="'+z+'"'+(out?' disabled':'')+'>'+z+'</button>'}).join("")+'</div></div>';
    return '<article class="card'+(alt?' has-alt':'')+(t===0?' is-out':'')+'" data-id="'+p.id+'">'+
      '<div class="media">'+
        '<a class="media-link" href="'+url+'" aria-label="'+esc(p.family+" "+p.name)+': vedi il prodotto">'+
          '<span class="img-a">'+mediaHTML(p,s.color)+'</span>'+(alt?'<span class="img-b"><img src="'+alt+'" alt="" loading="lazy"></span>':'')+
        '</a>'+badges+quick+
      '</div>'+
      '<div class="card-info">'+
        '<div class="card-line"><h3><a href="'+url+'">'+esc(p.name)+'</a></h3><span class="price">'+euro(priceOf(p))+'</span></div>'+
        '<div class="card-line sub"><span class="cat">'+esc(p.family)+'</span>'+
          (cols.length>1?'<span class="dots">'+cols.map(c=>'<button type="button" class="dot" data-color="'+c+'" aria-pressed="'+(c===s.color)+'" aria-label="Colore '+c+'" title="'+c+'" style="background:'+SWATCH[c]+'"></button>').join("")+'</span>':'<span class="one-color">'+esc(cols[0]||"")+'</span>')+
        '</div>'+
      '</div></article>';
  };
  function renderGrid(){
    const list=PRODUCTS.filter(p=>isActive(p)&&(filter==="all"||p.cat===filter));
    grid.innerHTML=list.length?list.map(cardHTML).join(""):'<p class="empty">Nessun prodotto in questa categoria.</p>';
  }
  grid.addEventListener("click",e=>{
    const card=e.target.closest(".card");if(!card)return;
    const p=PRODUCTS.find(x=>x.id===card.dataset.id),s=sel[p.id];
    const c=e.target.closest("[data-color]"),q=e.target.closest("[data-quick]");
    if(c){e.preventDefault();s.color=c.dataset.color;fixSel(p,s);card.outerHTML=cardHTML(p);return}
    if(q){e.preventDefault();if(addToCart(p,s.color,q.dataset.quick,1)){const n=grid.querySelector('[data-id="'+p.id+'"]');n.outerHTML=cardHTML(p)}}
  });
  onStock.push(()=>{renderTabs();renderGrid()});
  renderTabs();renderGrid();
}

/* ======================================================
   PAGINA PRODOTTO (merchandising-prodotto.html?id=...)
   ====================================================== */
const pdp=$("#pdp");
if(pdp){
  const qs=new URLSearchParams(location.search);
  const p=PRODUCTS.find(x=>x.id===qs.get("id"));
  if(!p){
    pdp.innerHTML='<div class="notfound"><h1>Prodotto non trovato</h1><p>Forse il link è vecchio o il prodotto non è più disponibile.</p><a class="btn btn-orange" href="'+SHOP_URL+'">Torna al merchandising</a></div>';
    $("#pdpMore")&&($("#pdpMore").hidden=true);
  }else{
    const s={...sel[p.id]};
    if(p.colors.indexOf(qs.get("colore"))>=0)s.color=qs.get("colore");
    let qty=1,mainSrc=imgFor(p,s.color);
    // galleria: foto dei colori + foto extra
    const gal=[];
    p.colors.forEach(c=>{const src=p.images[c];if(src&&!gal.some(g=>g.src===src))gal.push({src,color:c})});
    if(p.images.default&&!gal.some(g=>g.src===p.images.default))gal.unshift({src:p.images.default});
    (p.gallery||[]).forEach(g=>gal.push(typeof g==="string"?{src:g,color:p.galleryColor||p.colors[0]}:g));

    document.title=p.family+" "+p.name+" | Merchandising Artyou Roma";
    const md=document.querySelector('meta[name="description"]');if(md)md.content=p.desc;
    const cn=document.querySelector('link[rel="canonical"]');if(cn)cn.href="https://artyouroma.it"+productUrl(p);
    const og=document.querySelector('meta[property="og:image"]');if(og&&mainSrc)og.content="https://artyouroma.it"+mainSrc;

    const crumbs=$("#pdpCrumbs");
    crumbs.innerHTML='<a href="/">Home</a><span>/</span><a href="'+SHOP_URL+'">Merchandising</a><span>/</span><span>'+esc(p.name)+'</span>';

    pdp.innerHTML=
      '<div class="gallery'+(gal.length>1?'':' single')+'">'+
        '<div class="main-img"></div>'+
      '</div>'+
      '<div class="buy">'+
        '<div class="cat">'+esc(p.family)+'</div>'+
        '<h1>'+esc(p.name)+'</h1>'+
        '<div class="pdp-price" id="pPrice"></div>'+
        '<p class="pdp-desc">'+esc(p.desc)+'</p>'+
        '<div class="opt"><div class="opt-label">Colore: <strong id="pColor"></strong></div><div class="swatches" id="pColors"></div></div>'+
        '<div class="opt"><div class="opt-label opt-row"><span>Taglia: <strong id="pSize"></strong></span>'+(SIZE_GUIDE[p.cat]?'<button type="button" class="guide-link" data-guide><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 15 15 3l6 6L9 21l-6-6Z"/><path d="m7 11 2 2M10 8l2 2M13 5l2 2M11 15l-1 1M14 12l-1 1"/></svg>Guida alle taglie</button>':'')+'</div><div class="sizes" id="pSizes"></div></div>'+
        (gal.length>1?'<div class="opt"><div class="opt-label">Foto</div><div class="thumbs" aria-label="Foto del prodotto"></div></div>':'')+
        '<div class="note" id="pNote" hidden></div>'+
        '<div class="buy-box">'+
          '<div class="buy-row"><span class="opt-label">Quantità</span>'+
            '<div class="qty" aria-label="Quantità"><button type="button" data-q="-1" aria-label="Diminuisci">−</button><output id="pQty">1</output><button type="button" data-q="1" aria-label="Aumenta">+</button></div></div>'+
          '<button class="btn btn-orange add-big" id="pAdd" type="button"></button>'+
        '</div>'+
        '<ul class="perks"><li>Ritiro gratuito in tutte le sedi Artyou</li><li>Paghi al ritiro, niente pagamenti online</li><li>Dubbi sulla taglia? <a href="https://wa.me/'+WHATSAPP+'?text='+encodeURIComponent("Ciao Artyou! Ho una domanda sulla taglia di "+p.family+" "+p.name+".")+'" target="_blank" rel="noopener">Scrivici su WhatsApp</a></li></ul>'+
      '</div>';

    function render(){
      fixSel(p,s);
      const max=maxAddable(p,s.color,s.size);
      qty=Math.max(1,Math.min(qty,max||1));
      
      pdp.querySelector(".main-img").innerHTML=imgHTML(mainSrc,p.family+" "+p.name+" – "+s.color,true)+badgeHTML(p);
      const th=pdp.querySelector(".thumbs");if(th)th.innerHTML=gal.length>1?gal.map((g,i)=>'<button type="button" class="thumb'+(g.src===mainSrc?' on':'')+'" data-g="'+i+'" aria-label="Foto '+(i+1)+(g.color?" – "+g.color:"")+'" aria-pressed="'+(g.src===mainSrc)+'"><img src="'+g.src+'" alt=""></button>').join(""):"";
      $("#pPrice").textContent=euro(priceOf(p,s.color,s.size));
      $("#pColor").textContent=s.color;$("#pSize").textContent=s.size;
      $("#pColors").innerHTML=swatchesHTML(p,s.color);
      $("#pSizes").innerHTML=sizesHTML(p,s.color,s.size);
      $("#pQty").textContent=qty;
      pdp.querySelector('[data-q="1"]').disabled=qty>=max;pdp.querySelector('[data-q="-1"]').disabled=qty<=1;
      const q=qtyOf(p,s.color,s.size),msgs=[];
      if(Object.keys(p.images).length&&(p.noPhoto||[]).includes(s.color))msgs.push("La foto del colore "+s.color+" è in arrivo: il capo è lo stesso, cambia solo il colore.");
      if(q!==null&&q>0&&q<=3)msgs.push("Ne restano solo "+q+" in questa taglia.");
      const note=$("#pNote");note.hidden=!msgs.length;note.textContent=msgs.join(" ");
      const b=$("#pAdd"),narrow=false;b.disabled=max===0;b.innerHTML=(max>0?'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>':'')+esc(addLabel(p,s.color,s.size,qty).replace(narrow?"Aggiungi al carrello":"\u0000","Aggiungi"));
      history.replaceState(null,"",productUrl(p,s.color));
      setLd();
    }
    pdp.addEventListener("click",e=>{
      const c=e.target.closest("#pColors [data-color]"),z=e.target.closest("#pSizes [data-size]"),q=e.target.closest("[data-q]"),g=e.target.closest("[data-g]");
      if(c){s.color=c.dataset.color;mainSrc=p.images[s.color]||mainSrc;render()}
      else if(z){s.size=z.dataset.size;render()}
      else if(q){qty+=Number(q.dataset.q);render()}
      else if(g){const it=gal[+g.dataset.g];mainSrc=it.src;if(it.color&&colorsOf(p).indexOf(it.color)>=0)s.color=it.color;render()}
      else if(e.target.closest("[data-guide]"))openGuide();
      else if(e.target.closest("#pAdd")){if(addToCart(p,s.color,s.size,qty)){sel[p.id]={...s};qty=1;render()}}
    });

    // guida alle taglie
    const G=SIZE_GUIDE[p.cat];
    if(G){
      document.body.insertAdjacentHTML("beforeend",'<div class="overlay" id="guide" aria-hidden="true"><div class="guide" role="dialog" aria-modal="true" aria-labelledby="guideTitle">'+
        '<div class="guide-head"><h2 id="guideTitle">Guida alle taglie</h2><button class="close" data-close aria-label="Chiudi">×</button></div>'+
        '<p class="guide-sub">'+esc(p.family+" · "+p.name)+' — '+esc(G.note)+'</p>'+
        '<div class="guide-table"><table><thead><tr><th>Taglia</th>'+G.cols.map(c=>'<th>'+esc(c)+'</th>').join("")+'</tr></thead><tbody id="guideRows"></tbody></table></div>'+
        (G.how?'<p class="guide-how"><strong>Come misurare.</strong> '+esc(G.how)+'</p>':'')+
        '<p class="guide-help">Sei tra due taglie? <a href="https://wa.me/'+WHATSAPP+'?text='+encodeURIComponent("Ciao Artyou! Sono indeciso sulla taglia di "+p.family+" "+p.name+".")+'" target="_blank" rel="noopener">Scrivici su WhatsApp</a>: ti aiutiamo a scegliere.</p>'+
        '</div></div>');
      const gEl=$("#guide");
      gEl.addEventListener("click",e=>{
        const r=e.target.closest("[data-pick]");
        if(r){s.size=r.dataset.pick;render();closeOverlay(gEl);return}
        if(e.target===gEl||e.target.closest("[data-close]"))closeOverlay(gEl);
      });
      window.openGuide=function(){
        $("#guideRows").innerHTML=Object.keys(G.rows).map(z=>'<tr class="'+(z===s.size?'on':'')+'"><th><button type="button" data-pick="'+z+'" aria-label="Scegli la taglia '+z+'">'+z+'</button></th>'+G.rows[z].map(v=>'<td>'+v+'</td>').join("")+'</tr>').join("");
        openOverlay(gEl);
      };
    }
    function openGuide(){window.openGuide&&window.openGuide()}

    // dati strutturati per Google
    function setLd(){
      let el=$("#pdpLd");if(!el){el=document.createElement("script");el.type="application/ld+json";el.id="pdpLd";document.head.appendChild(el)}
      const t=totalOf(p);
      el.textContent=JSON.stringify({"@context":"https://schema.org","@type":"Product",name:p.family+" "+p.name,description:p.desc,
        image:gal.map(g=>"https://artyouroma.it"+g.src),brand:{"@type":"Brand",name:"Artyou Roma"},
        offers:{"@type":"Offer",priceCurrency:"EUR",price:priceOf(p).toFixed(2),url:"https://artyouroma.it"+productUrl(p),
          availability:"https://schema.org/"+(t===0?"OutOfStock":"InStock")}});
    }

    // caroselli in fondo: le altre categorie (quella del prodotto è già sopra in "Altri modelli simili")
    const more=$("#pdpMore");
    function renderMore(){
      // 1) stessa categoria  2) "Completa il look": tutto il resto in un solo carosello
      const same=PRODUCTS.filter(x=>x.cat===p.cat&&x.id!==p.id&&isActive(x));
      const rest=CATS.filter(c=>c.id!=="all"&&c.id!==p.cat).reduce((a,c)=>a.concat(PRODUCTS.filter(x=>x.cat===c.id&&isActive(x))),[]);
      const groups=[];
      if(same.length)groups.push({c:{label:p.cat==="tshirt"?"Altre t-shirt":p.cat==="felpe"?"Altre felpe":"Altri modelli"},list:same});
      if(rest.length)groups.push({c:{label:"Completa il look"},list:rest});
      more.hidden=!groups.length;
      more.querySelector(".rails").innerHTML=groups.map((g,i)=>railHTML(g.c.label,g.list,"rMore"+i)).join("");
      wireRails(more);
    }
    onStock.push(()=>{render();renderMore()});
    render();renderMore();wireRails(pdp);
  }
}

renderCart();loadStock();
})();
