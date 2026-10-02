import fs from "node:fs";
import path from "node:path";

const key=process.env.OPENAI_API_KEY;
if(!key){console.log("OPENAI_API_KEY assente: nessun articolo generato.");process.exit(0)}
const root=process.cwd(), dataPath=path.join(root,"blog","articles.json");
const data=JSON.parse(fs.readFileSync(dataPath,"utf8"));
const previous=(data.articles||[]).slice(0,20).map(x=>({title:x.title,category:x.category,date:x.date}));
const categories=["Improv around the world","Festival Radar","Impro People","Dentro l'improv"];
const week=Math.floor(Date.now()/604800000);
const category=categories[week%categories.length];

const prompt=`Sei la redazione di "La finestra sul cortile – Lo sconfinato mondo dell’improvvisazione", blog di Artyou Roma.
Crea UN articolo in italiano, circa 1000-1500 caratteri spazi inclusi, categoria: ${category}.
Prima fai ricerca web. Privilegia fonti ufficiali: siti di festival, scuole, teatri, docenti/compagnie. Per eventi futuri verifica date e luogo su fonte ufficiale.
Non inventare mai festival, date, biografie, ruoli o citazioni. Se le fonti non bastano, scegli un altro argomento nella stessa categoria.
Tono: curioso, giornalistico, colto ma accessibile; niente stile promozionale AI, niente frasi generiche.
Evita argomenti già usati: ${JSON.stringify(previous)}.
Restituisci SOLO JSON valido con:
{"title":"","slug":"","category":"${category}","excerpt":"","body":["paragrafo 1","paragrafo 2","paragrafo 3"],"sources":[{"name":"","url":""}],"radar":[]}
slug minuscolo con trattini. excerpt massimo 180 caratteri. body totale circa 1000-1500 caratteri.
Per Festival Radar, radar può contenere fino a 3 eventi verificati con {"name":"","place":"","date":"","url":""}; negli altri casi lascialo vuoto.`;

const res=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-6-luna",tools:[{type:"web_search"}],input:prompt})});
if(!res.ok)throw new Error("OpenAI API "+res.status+" "+await res.text());
const out=await res.json();
let text=out.output_text || (out.output||[]).flatMap(i=>i.content||[]).map(c=>c.text||"").join("");
text=text.trim().replace(/^\`\`\`json\s*/i,"").replace(/\`\`\`$/,"").trim();
const a=JSON.parse(text);
if(!a.title||!a.slug||!Array.isArray(a.body)||!Array.isArray(a.sources)||!a.sources.length)throw new Error("Articolo incompleto");
if(!/^[a-z0-9-]+$/.test(a.slug))throw new Error("Slug non valido");
const safe=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const validUrl=u=>{try{const x=new URL(u);return x.protocol==="https:"||x.protocol==="http:"}catch{return false}};
const today=new Date().toISOString().slice(0,10);
const dir=path.join(root,"la-finestra-sul-cortile",a.slug);fs.mkdirSync(dir,{recursive:true});
const src=a.sources.filter(x=>validUrl(x.url));
if(!src.length)throw new Error("Nessuna fonte URL valida");
const html=`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(a.title)} | La finestra sul cortile</title><meta name="description" content="${safe(a.excerpt)}"><link rel="stylesheet" href="/blog/blog.css"></head><body><div class="site"><div class="top"></div><header><a class="brand" href="/">ARTYOU ROMA</a><a class="back" href="/la-finestra-sul-cortile/">← La finestra sul cortile</a></header><article class="article"><div class="eyebrow">${safe(a.category)}</div><h1>${safe(a.title)}</h1><p class="deck">${safe(a.excerpt)}</p><div class="meta">${today} · Redazione Artyou Roma</div>${a.body.map(p=>`<p>${safe(p)}</p>`).join("")}<div class="sources"><strong>Fonti</strong><ul>${src.map(x=>`<li><a href="${safe(x.url)}" target="_blank" rel="noopener noreferrer">${safe(x.name||x.url)}</a></li>`).join("")}</ul></div></article><footer><strong>La finestra sul cortile</strong> · A cura della redazione Artyou Roma</footer></div></body></html>`;
fs.writeFileSync(path.join(dir,"index.html"),html);
data.articles=data.articles||[];
if(data.articles.some(x=>x.slug===a.slug))throw new Error("Slug già esistente");
data.articles.unshift({slug:a.slug,title:a.title,category:a.category,date:today,excerpt:a.excerpt,url:`/la-finestra-sul-cortile/${a.slug}/`});
if(Array.isArray(a.radar)&&a.radar.length)data.radar=a.radar.filter(x=>validUrl(x.url)).slice(0,4);
data.updated=today;
fs.writeFileSync(dataPath,JSON.stringify(data,null,2)+"\n");
console.log("Creato:",a.title);