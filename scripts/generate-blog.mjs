import fs from "node:fs";
import path from "node:path";
import { renderArticle, bodyFromParagraphs, sourcesFromList } from "./blog-template.mjs";

const geminiKey=process.env.GEMINI_API_KEY;
const openrouterKey=process.env.OPENROUTER_API_KEY;
if(!geminiKey&&!openrouterKey){
  console.log("Nessuna chiave AI configurata: nessun articolo generato.");
  process.exit(0);
}

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

async function callGemini(){
  if(!geminiKey) return null;
  const models=["gemini-3.8-flash","gemini-3.5-flash-lite","gemini-2.5-flash"];
  for(const model of models){
    try{
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),45000);
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
        method:"POST",
        headers:{
          "x-goog-api-key":geminiKey,
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          contents:[{role:"user",parts:[{text:prompt}]}],
          generationConfig:{
            temperature:0.4,
            responseMimeType:"application/json"
          }
        }),
        signal:ctrl.signal
      });
      clearTimeout(timer);
      if(!res.ok){
        console.log(`Gemini ${model} ${res.status}: ${await res.text()}`);
        continue;
      }
      const out=await res.json();
      const text=(out.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("").trim();
      if(text){
        console.log("Provider usato: Gemini "+model);
        return text;
      }
    }catch(e){
      console.log("Gemini errore:",String(e));
    }
  }
  console.log("Gemini non disponibile, passo a OpenRouter.");
  return null;
}

async function callOpenRouter(){
  if(!openrouterKey) return null;
  const models=["openrouter/free","meta-llama/llama-3.3-70b-instruct:free","google/gemma-3-27b-it:free"];
  for(const model of models){
    try{
      const ctrl=new AbortController();
      const timer=setTimeout(()=>ctrl.abort(),45000);
      const res=await fetch("https://openrouter.ai/api/v1/chat/completions",{
        method:"POST",
        headers:{
          "Authorization":`Bearer ${openrouterKey}`,
          "Content-Type":"application/json",
          "HTTP-Referer":"https://artyouroma.it/",
          "X-Title":"Artyou Blog"
        },
        body:JSON.stringify({
          model,
          messages:[
            {role:"system",content:"Rispondi esclusivamente con JSON valido e senza markdown."},
            {role:"user",content:prompt}
          ],
          temperature:0.4
        }),
        signal:ctrl.signal
      });
      clearTimeout(timer);
      if(!res.ok){
        console.log(`OpenRouter ${model} ${res.status}: ${await res.text()}`);
        continue;
      }
      const out=await res.json();
      const text=out.choices?.[0]?.message?.content?.trim();
      if(text){
        console.log("Provider usato: OpenRouter "+model);
        return text;
      }
    }catch(e){
      console.log("OpenRouter errore:",String(e));
    }
  }
  return null;
}

let text=await callGemini();
if(!text) text=await callOpenRouter();
if(!text) throw new Error("Nessun provider gratuito disponibile.");
text=text.trim().replace(/^```json\s*/i,"").replace(/```$/,"").trim();
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

const html=renderArticle({slug:a.slug,title:a.title,category:a.category,date:today,excerpt:a.excerpt,
  bodyHtml:bodyFromParagraphs(a.body),sourcesHtml:sourcesFromList(a.sources)});

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
