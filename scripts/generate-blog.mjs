import fs from "node:fs";
import path from "node:path";

const key=process.env.OPENROUTER_API_KEY;
if(!key){console.log("OPENROUTER_API_KEY assente: nessun articolo generato.");process.exit(0)}

const root=process.cwd();
const dataPath=path.join(root,"blog","articles.json");
const sourcePath=path.join(root,"blog","sources.json");
const data=JSON.parse(fs.readFileSync(dataPath,"utf8"));
const sourceList=JSON.parse(fs.readFileSync(sourcePath,"utf8"));
const previous=(data.articles||[]).slice(0,20).map(x=>({title:x.title,category:x.category,date:x.date}));
const categories=["Improv around the world","Festival Radar","Impro People","Dentro l'improv"];
const week=Math.floor(Date.now()/604800000);
const category=categories[week%categories.length];

async function fetchText(url){
  const r=await fetch(url,{headers:{"User-Agent":"ArtyouBlogBot/1.0 (+https://artyouroma.it)"}});
  if(!r.ok) throw new Error("Fonte non raggiungibile: "+url+" ("+r.status+")");
  const html=await r.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/g," ")
    .replace(/&amp;/g,"&")
    .replace(/\s+/g," ")
    .trim()
    .slice(0,12000);
}

const picked=sourceList.slice(0,5);
const docs=[];
for(const s of picked){
  try{docs.push({source:s,text:await fetchText(s.url)});}catch(e){console.log(String(e));}
}
if(docs.length<2) throw new Error("Fonti ufficiali insufficienti per generare in sicurezza.");

const sourceBundle=docs.map((d,i)=>`FONTE ${i+1}: ${d.source.name}\nURL: ${d.source.url}\nTESTO: ${d.text}`).join("\n\n");

const prompt=`Sei la redazione di "La finestra sul cortile – Lo sconfinato mondo dell’improvvisazione", blog di Artyou Roma.
Scrivi UN articolo in italiano, circa 1000-1500 caratteri spazi inclusi, categoria: ${category}.

REGOLE:
- Usa SOLO le fonti fornite qui sotto.
- Non inventare festival, date, biografie, ruoli, citazioni o eventi.
- Se non ci sono abbastanza dati per la categoria assegnata, scrivi un articolo "Improv around the world" basato sulle scuole presenti.
- Tono curioso, giornalistico, concreto, niente stile promozionale AI.
- Evita argomenti già usati: ${JSON.stringify(previous)}.
- Niente claim non supportati.
- Inserisci nel JSON solo fonti effettivamente usate.

FONTI:
${sourceBundle}

Restituisci SOLO JSON valido:
{"title":"","slug":"","category":"","excerpt":"","body":["paragrafo 1","paragrafo 2","paragrafo 3"],"sources":[{"name":"","url":""}],"radar":[]}

Requisiti:
- slug minuscolo con trattini
- excerpt massimo 180 caratteri
- body totale circa 1000-1500 caratteri
- se la categoria finale non è Festival Radar, radar deve essere []`;

const payload={
  model:"openrouter/free",
  messages:[
    {role:"system",content:"Rispondi esclusivamente con JSON valido e senza markdown."},
    {role:"user",content:prompt}
  ],
  temperature:0.4
};

const res=await fetch("https://openrouter.ai/api/v1/chat/completions",{
  method:"POST",
  headers:{
    "Authorization":`Bearer ${key}`,
    "Content-Type":"application/json",
    "HTTP-Referer":"https://artyouroma.it/",
    "X-Title":"Artyou Blog"
  },
  body:JSON.stringify(payload)
});
if(!res.ok) throw new Error("OpenRouter API "+res.status+" "+await res.text());
const out=await res.json();
let text=out.choices?.[0]?.message?.content||"";
text=text.trim().replace(/^\`\`\`json\s*/i,"").replace(/\`\`\`$/,"").trim();
const a=JSON.parse(text);

if(!a.title||!a.slug||!Array.isArray(a.body)||!Array.isArray(a.sources)||!a.sources.length) throw new Error("Articolo incompleto");
if(!/^[a-z0-9-]+$/.test(a.slug)) throw new Error("Slug non valido");

const allowed=new Set(docs.map(d=>d.source.url));
a.sources=a.sources.filter(x=>allowed.has(x.url));
if(!a.sources.length) throw new Error("Nessuna fonte valida usata dal modello");

const safe=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const today=new Date().toISOString().slice(0,10);
const dir=path.join(root,"la-finestra-sul-cortile",a.slug);
fs.mkdirSync(dir,{recursive:true});

const html=`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(a.title)} | La finestra sul cortile</title><meta name="description" content="${safe(a.excerpt)}"><link rel="stylesheet" href="/blog/blog.css"></head><body><div class="site"><div class="top"></div><header><a class="brand" href="/">ARTYOU ROMA</a><a class="back" href="/la-finestra-sul-cortile/">← La finestra sul cortile</a></header><article class="article"><div class="eyebrow">${safe(a.category)}</div><h1>${safe(a.title)}</h1><p class="deck">${safe(a.excerpt)}</p><div class="meta">${today} · Redazione Artyou Roma</div>${a.body.map(p=>`<p>${safe(p)}</p>`).join("")}<div class="sources"><strong>Fonti</strong><ul>${a.sources.map(x=>`<li><a href="${safe(x.url)}" target="_blank" rel="noopener noreferrer">${safe(x.name||x.url)}</a></li>`).join("")}</ul></div></article><footer><strong>La finestra sul cortile</strong> · A cura della redazione Artyou Roma</footer></div></body></html>`;

fs.writeFileSync(path.join(dir,"index.html"),html);
data.articles=data.articles||[];
if(data.articles.some(x=>x.slug===a.slug)) throw new Error("Slug già esistente");
data.articles.unshift({
  slug:a.slug,
  title:a.title,
  category:a.category,
  date:today,
  excerpt:a.excerpt,
  url:`/la-finestra-sul-cortile/${a.slug}/`
});
data.updated=today;
fs.writeFileSync(dataPath,JSON.stringify(data,null,2)+"\n");
console.log("Creato:",a.title);
