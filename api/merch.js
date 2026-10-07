const {
  rateLimit, applyRateLimitHeaders, rejectRateLimited, sameOrigin, setSecurityHeaders
} = require("../lib/security");
const { persistentRateLimit } = require("../lib/persistent-rate-limit");

const RAILWAY_MERCH_API=process.env.ARTYOU_MERCH_API_URL||"https://artyou-merch-api-production.up.railway.app";
const PROXY_SECRET=String(process.env.ARTYOU_MERCH_PROXY_SECRET||"").trim();

module.exports=async function handler(req,res){
  setSecurityHeaders(res);
  const method=String(req.method||"GET").toUpperCase();
  if(method!=="GET"&&method!=="POST"){res.setHeader("Allow","GET, POST");return res.status(405).json({ok:false,errore:"metodo_non_consentito"});}

  let limit;
  if(method==="POST"){
    try{limit=await persistentRateLimit(req,{key:"merch-order",limit:8,windowMs:60*1000})}
    catch(_){limit=rateLimit(req,{key:"merch-order-fallback",limit:8,windowMs:60*1000})}
  }else limit=rateLimit(req,{key:"merch-stock",limit:120,windowMs:60*1000});
  applyRateLimitHeaders(res,limit);if(!limit.ok)return rejectRateLimited(res,limit);
  if(method==="POST"&&!sameOrigin(req))return res.status(403).json({ok:false,errore:"origin_non_consentita"});

  try{
    const rawUrl=String(req.url||""),q=rawUrl.indexOf("?"),query=q>=0?rawUrl.slice(q):"";
    const target=RAILWAY_MERCH_API.replace(/\/$/,"")+"/merch"+query;
    const options={method,redirect:"follow",headers:{"Accept":"application/json"}};
    if(PROXY_SECRET)options.headers["X-Artyou-Proxy-Secret"]=PROXY_SECRET;

    if(method==="POST"){
      let body=req.body;if(body==null)body={};if(typeof body!=="string")body=JSON.stringify(body);
      if(Buffer.byteLength(body,"utf8")>20000)return res.status(413).json({ok:false,errore:"richiesta_troppo_grande"});
      let parsed;try{parsed=JSON.parse(body||"{}");}catch(_){return res.status(400).json({ok:false,errore:"richiesta_non_valida"});}
      if(String(parsed._hp||"").trim())return res.status(200).json({ok:true});
      options.headers["Content-Type"]="application/json; charset=utf-8";options.body=JSON.stringify(parsed);
    }

    const upstream=await fetch(target,options),text=await upstream.text();
    res.status(upstream.status);res.setHeader("Content-Type",upstream.headers.get("content-type")||"application/json; charset=utf-8");return res.send(text);
  }catch(err){console.error("merch railway proxy error");return res.status(502).json({ok:false,errore:"proxy_error"});}
};
