const SEO = {
  luoghi: {
    title: "Generatore di Luoghi per Improvvisazione | Artyou Roma",
    description: "Generatore casuale di luoghi per improvvisazione teatrale: stazioni, aeroporti, ristoranti, teatri e decine di ambientazioni per iniziare una scena.",
    h1: "Generatore di luoghi per improvvisazione"
  },
  status: {
    title: "Generatore di Status per Improvvisazione | Artyou Roma",
    description: "Generatore di status per improvvisazione teatrale: alto, basso, autorità, rivalità e dinamiche di potere per creare scene e personaggi.",
    h1: "Generatore di status per improvvisazione"
  },
  emozioni: {
    title: "Generatore di Emozioni per Improvvisazione | Artyou Roma",
    description: "Generatore casuale di emozioni per improvvisazione teatrale: gioia, paura, rabbia, gelosia, nostalgia e molti altri spunti per le scene.",
    h1: "Generatore di emozioni per improvvisazione"
  },
  personaggi: {
    title: "Generatore di Personaggi per Improvvisazione | Artyou Roma",
    description: "Generatore casuale di personaggi per improvvisazione teatrale: mestieri, ruoli e identità da usare per esercizi, scene e jam.",
    h1: "Generatore di personaggi per improvvisazione"
  },
  relazioni: {
    title: "Generatore di Relazioni per Improvvisazione | Artyou Roma",
    description: "Generatore di relazioni tra personaggi per improvvisazione teatrale: fratelli, colleghi, rivali, ex, amici e molte altre dinamiche.",
    h1: "Generatore di relazioni per improvvisazione"
  },
  obiettivi: {
    title: "Generatore di Obiettivi per Improvvisazione | Artyou Roma",
    description: "Generatore di obiettivi scenici per improvvisazione teatrale: convincere, nascondere, ottenere, proteggere, scoprire e molto altro.",
    h1: "Generatore di obiettivi per improvvisazione"
  },
  generi: {
    title: "Generatore di Generi Teatrali per Improvvisazione | Artyou Roma",
    description: "Generatore di generi per improvvisazione: noir, horror, commedia romantica, Shakespeare, musical, western, fantasy e altri stili.",
    h1: "Generatore di generi per improvvisazione"
  },
  oggetti: {
    title: "Generatore di Oggetti per Improvvisazione | Artyou Roma",
    description: "Generatore casuale di oggetti per improvvisazione teatrale: chiavi, lettere, valigie, fotografie e tanti elementi per ispirare una scena.",
    h1: "Generatore di oggetti per improvvisazione"
  }
};

function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}

module.exports=async function handler(req,res){
  try{
    const slug=String(req.query&&req.query.slug||"").toLowerCase();
    const seo=SEO[slug];
    if(!seo)return res.status(404).send("Pagina non trovata");
    const proto=String(req.headers["x-forwarded-proto"]||"https");
    const host=String(req.headers.host||"");
    const origin=proto+"://"+host;
    const r=await fetch(origin+"/improv-generator/index.html",{redirect:"follow"});
    let html=await r.text();
    const canonical="https://artyouroma.it/improv-generator/"+slug+"/";
    html=html.replace(/<title>[\s\S]*?<\/title>/i,"<title>"+esc(seo.title)+"</title>");
    html=html.replace(/<meta name="description"[^>]*>/i,'<meta name="description" content="'+esc(seo.description)+'">');
    html=html.replace(/<link rel="canonical"[^>]*>/i,'<link rel="canonical" href="'+canonical+'">');
    html=html.replace(/<h1>Generatore Improv<\/h1>/i,"<h1>"+esc(seo.h1)+"</h1>");
    html=html.replace("</head>",
      '<meta property="og:title" content="'+esc(seo.title)+'">'+
      '<meta property="og:description" content="'+esc(seo.description)+'">'+
      '<meta property="og:url" content="'+canonical+'">'+
      '<meta property="og:type" content="website">'+
      '<script type="application/ld+json">'+JSON.stringify({
        "@context":"https://schema.org",
        "@type":"WebApplication",
        name:seo.h1,
        applicationCategory:"EntertainmentApplication",
        operatingSystem:"Any",
        url:canonical,
        description:seo.description,
        publisher:{"@type":"Organization","name":"Artyou Roma","url":"https://artyouroma.it/"}
      }).replace(/</g,"\\u003c")+'</script></head>');
    res.setHeader("Content-Type","text/html; charset=utf-8");
    res.setHeader("Cache-Control","public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).send(html);
  }catch(err){
    return res.status(500).send("Errore caricamento generatore");
  }
};