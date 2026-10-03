const SOURCE = "https://improvfestivals.org/";

const FALLBACK = [
  {name:"Improv Fest Ireland", date:"30 SET – 3 OTT", place:"Dublin, Irlanda", url:"https://improvfestivals.org/festivals/improv-fest-ireland/"},
  {name:"New Zealand Improv Festival", date:"2–11 OTT", place:"Wellington, Nuova Zelanda", url:"https://improvfestivals.org/festivals/new-zealand-improv-festival/"},
  {name:"Imperdible. Festival Internacional de Impro de Galicia", date:"8–18 OTT", place:"Santiago de Compostela, Spagna", url:"https://improvfestivals.org/festivals/imperdible-festival-internacional-de-impro-de-galicia/"},
  {name:"Secret City Improv Comedy Festival", date:"8–10 OTT", place:"Oak Ridge, USA", url:"https://improvfestivals.org/"},
  {name:"IF Cincy", date:"15–17 OTT", place:"Cincinnati, USA", url:"https://improvfestivals.org/"}
];

function clean(s){
  return String(s||"")
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#39;|&apos;/g,"'")
    .replace(/&quot;/g,'"').replace(/&ndash;|&#8211;/g,"–").replace(/&mdash;|&#8212;/g,"—")
    .replace(/\s+/g," ").trim();
}
function shortDate(s){
  const m={Jan:"GEN",Feb:"FEB",Mar:"MAR",Apr:"APR",May:"MAG",Jun:"GIU",Jul:"LUG",Aug:"AGO",Sep:"SET",Oct:"OTT",Nov:"NOV",Dec:"DIC"};
  return String(s||"").replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*/g,x=>m[x.slice(0,3)]||x).replace(/,?\s+20\d{2}\b/g,"").toUpperCase();
}
function parse(html){
  const start=html.search(/Upcoming Improv Festivals/i);
  const area=start>=0?html.slice(start):html;
  const rx=/<a\b[^>]*href=["'](\/festivals\/[^"'?#]+\/?)(?:["'][^>]*)>([\s\S]*?)<\/a>([\s\S]{0,650}?)(?=<a\b[^>]*href=["']\/festivals\/|<h[1-6]\b|$)/gi;
  const seen=new Set(), out=[];
  let m;
  const dateRx=/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:\s*[-–]\s*(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+)?\d{1,2})?,\s*20\d{2}/i;
  while((m=rx.exec(area)) && out.length<5){
    const url=new URL(m[1],SOURCE).href;
    if(seen.has(url)) continue;
    const name=clean(m[2]), tail=clean(m[3]), dm=tail.match(dateRx);
    if(!name || !dm) continue;
    let place=tail.slice((dm.index||0)+dm[0].length).replace(/^(?:\s*[|·•-]\s*)+/,"").trim();
    place=place.split(/(?:Accepting Submissions|Submissions)/i)[0].trim();
    if(place.length>90) place=place.slice(0,90).replace(/\s+\S*$/,"")+"…";
    seen.add(url);
    out.push({name,date:shortDate(dm[0]),place,url});
  }
  return out;
}
module.exports = async function handler(req,res){
  res.setHeader("Cache-Control","s-maxage=21600, stale-while-revalidate=86400");
  try{
    const r=await fetch(SOURCE,{headers:{"user-agent":"ArtyouRoma-FestivalRadar/1.0"}});
    if(!r.ok) throw new Error("source "+r.status);
    const items=parse(await r.text());
    res.status(200).json({ok:true,source:SOURCE,items:items.length>=3?items:FALLBACK});
  }catch(e){
    res.status(200).json({ok:true,source:SOURCE,fallback:true,items:FALLBACK});
  }
};