const http = require("http");
const crypto = require("crypto");
const mysql = require("mysql2/promise");

const PORT = Number(process.env.PORT || 3000);
const SEDI = new Set(["San Giovanni", "Eroi", "Ionio", "Valle Aurelia", "Africano", "Boccea"]);
const PAGAMENTI = new Set(["In sede", "PayPal"]);
const PAYPAL_EMAIL = "info@artyouroma.it";
const MAX_PEZZI_RIGA = 10;
const MAX_PEZZI_ORDINE = 20;
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const MERCH_FROM_EMAIL = process.env.MERCH_FROM_EMAIL || "Artyou Roma <ordini@artyouroma.it>";
const MERCH_ADMIN_EMAIL = process.env.MERCH_ADMIN_EMAIL || "info@artyouroma.it";
const MERCH_BACKUP_EMAIL = process.env.MERCH_BACKUP_EMAIL || "artyouroma@gmail.com";
const PROXY_SECRET = String(process.env.ARTYOU_MERCH_PROXY_SECRET || "").trim();
// Ordini PayPal non pagati: dopo queste ore i pezzi tornano disponibili (0 = mai).
const PAYPAL_HOLD_HOURS = Math.max(0, Math.min(24 * 30, Number(process.env.MERCH_PAYPAL_HOLD_HOURS || 48)));
const rateBuckets = new Map();

const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  port: Number(process.env.MYSQLPORT || 3306),
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

const clean=(v,n)=>String(v==null?"":v).replace(/[\u0000-\u001F]+/g," ").trim().slice(0,n);
const keyOf=(a,b,c)=>[a,b,c].map(v=>String(v==null?"":v).trim()).join("|");
const send=(res,status,obj)=>{const body=JSON.stringify(obj);res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(body)};
const paypalUrl=(id,total)=>"https://www.paypal.com/cgi-bin/webscr?"+new URLSearchParams({cmd:"_xclick",business:PAYPAL_EMAIL,item_name:"Artyou Merch "+id,invoice:id,amount:Number(total).toFixed(2),currency_code:"EUR"}).toString();
function sameSecret(a,b){
  const aa=Buffer.from(String(a||"")),bb=Buffer.from(String(b||""));
  if(!aa.length||aa.length!==bb.length)return false;
  return crypto.timingSafeEqual(aa,bb);
}
// L'ultimo valore di X-Forwarded-For è quello aggiunto dal proxy di Railway: i precedenti li sceglie il client.
function clientIp(req){const list=String(req.headers["x-forwarded-for"]||"").split(",").map(v=>v.trim()).filter(Boolean);return list.length?list[list.length-1]:String(req.socket.remoteAddress||"unknown")}
function allowRequest(req,limit,windowMs){
  const now=Date.now(),key=clientIp(req),old=rateBuckets.get(key);
  const item=!old||old.resetAt<=now?{count:0,resetAt:now+windowMs}:old;
  item.count++;rateBuckets.set(key,item);
  if(rateBuckets.size>5000)for(const [k,v] of rateBuckets)if(v.resetAt<=now)rateBuckets.delete(k);
  return item.count<=limit;
}
const orderCode=()=>{const d=new Date(),p=n=>String(n).padStart(2,"0");return "MERCH-"+d.getUTCFullYear()+p(d.getUTCMonth()+1)+p(d.getUTCDate())+"-"+p(d.getUTCHours())+p(d.getUTCMinutes())+p(d.getUTCSeconds())+"-"+crypto.randomBytes(3).toString("hex").toUpperCase()};

async function stockPayload(conn){
  const sql=`SELECT p.product_code,pv.color,pv.size,pv.stock_qty,pv.price
               FROM products p JOIN product_variants pv ON pv.product_id=p.id
               WHERE p.active=1 AND pv.active=1
               ORDER BY p.product_code,pv.color,pv.size`;
  const [rows]=conn?await conn.execute(sql):await pool.execute(sql);
  const varianti={};
  for(const r of rows) varianti[keyOf(r.product_code,r.color,r.size)]={qty:Math.max(0,Number(r.stock_qty)||0),prezzo:Number(r.price)||0};
  return varianti;
}

async function readBody(req){
  let raw="";
  for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw Object.assign(new Error("too_large"),{status:413});}
  try{return JSON.parse(raw||"{}")}catch(_){throw Object.assign(new Error("bad_json"),{status:400});}
}


function escHtml(s){
  return String(s==null?"":s).replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
}
const euro=n=>"€ "+Number(n||0).toFixed(2).replace(".",",");

async function sendMail({to,subject,html,text,replyTo,bcc}){
  if(!RESEND_API_KEY) return {ok:false,skipped:true};
  const payload={from:MERCH_FROM_EMAIL,to:Array.isArray(to)?to:[to],subject,html,text};
  if(replyTo) payload.reply_to=replyTo;
  if(bcc) payload.bcc=Array.isArray(bcc)?bcc:[bcc];
  const r=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"Authorization":"Bearer "+RESEND_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  if(!r.ok) throw new Error("mail_provider_error");
  return {ok:true};
}

async function sendOrderEmails(o){
  if(!RESEND_API_KEY) return;
  const itemsHtml=o.righe.map(r=>"<li>"+escHtml(r)+"</li>").join("");
  const adminHtml=
    "<h2>Nuovo ordine merchandising "+escHtml(o.id)+"</h2>"+
    "<p><b>"+escHtml(o.nome)+"</b> · "+escHtml(o.telefono)+" · "+escHtml(o.email)+"<br>Ritiro: sede "+escHtml(o.sede)+"</p>"+
    "<ul>"+itemsHtml+"</ul>"+
    "<p><b>Totale: "+euro(o.totale)+"</b> · Pagamento: "+escHtml(o.pagamento)+"</p>"+
    (o.note?"<p>Note: "+escHtml(o.note)+"</p>":"");
  await sendMail({
    to:MERCH_ADMIN_EMAIL,
    bcc:MERCH_BACKUP_EMAIL||undefined,
    replyTo:o.email,
    subject:"Ordine merch "+o.id+" – "+o.nome,
    html:adminHtml,
    text:"Nuovo ordine "+o.id+"\n"+o.righe.join("\n")+"\nTotale: "+euro(o.totale)
  });

  const pay=o.pagamento==="PayPal"
    ? "<p>Hai scelto PayPal. Puoi completare il pagamento qui: <a href=\""+o.paypal+"\">"+euro(o.totale)+"</a>.</p>"
    : "<p>Pagherai direttamente al ritiro in sede.</p>";
  const customerHtml=
    "<h2>Grazie "+escHtml(o.nome.split(" ")[0])+", abbiamo ricevuto il tuo ordine!</h2>"+
    "<p>Numero d’ordine: <b>"+escHtml(o.id)+"</b></p>"+
    "<ul>"+itemsHtml+"</ul>"+
    "<p><b>Totale: "+euro(o.totale)+"</b><br>Ritiro: sede <b>"+escHtml(o.sede)+"</b></p>"+
    pay+
    "<p>Ti avvisiamo quando è pronto. Per qualsiasi domanda scrivici a "+escHtml(MERCH_ADMIN_EMAIL)+".</p>";
  await sendMail({
    to:o.email,
    replyTo:MERCH_ADMIN_EMAIL,
    subject:"Il tuo ordine Artyou "+o.id,
    html:customerHtml,
    text:"Grazie! Ordine "+o.id+"\n"+o.righe.join("\n")+"\nTotale: "+euro(o.totale)+"\nRitiro: sede "+o.sede
  });
}

async function createOrder(data){
  if(String(data.action||"")!=="ordine") throw Object.assign(new Error("azione_sconosciuta"),{status:400});
  const nome=clean(data.nome,80),telefono=clean(data.telefono,30),email=clean(data.email,120).toLowerCase(),sede=clean(data.sede,40),note=clean(data.note,400);
  const pagamento=PAGAMENTI.has(String(data.pagamento||""))?String(data.pagamento):"In sede";
  if(!nome||!telefono||!email||!sede) throw Object.assign(new Error("campi_mancanti"),{status:400});
  if(telefono.replace(/\D/g,"").length<8) throw Object.assign(new Error("telefono_non_valido"),{status:400});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw Object.assign(new Error("email_non_valida"),{status:400});
  if(!SEDI.has(sede)) throw Object.assign(new Error("sede_non_valida"),{status:400});

  const m=new Map();
  for(const it of Array.isArray(data.items)?data.items:[]){
    const id=clean(it&&it.id,190),colore=clean(it&&it.colore,120),taglia=clean(it&&it.taglia,120),qty=Math.floor(Number(it&&it.qty));
    if(!id||!colore||!taglia||!(qty>0))continue;
    const k=keyOf(id,colore,taglia),cur=m.get(k)||{id,colore,taglia,qty:0};cur.qty+=qty;m.set(k,cur);
  }
  const items=[...m.values()];
  if(!items.length)throw Object.assign(new Error("carrello_vuoto"),{status:400});
  const pieces=items.reduce((a,x)=>a+x.qty,0);
  if(pieces>MAX_PEZZI_ORDINE||items.some(x=>x.qty>MAX_PEZZI_RIGA))throw Object.assign(new Error("quantita_eccessiva"),{status:400});

  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const locked=[],mancanti=[];
    for(const it of items){
      const [rows]=await conn.execute(`SELECT pv.id,pv.stock_qty,pv.price,p.name
        FROM products p JOIN product_variants pv ON pv.product_id=p.id
        WHERE p.product_code=? AND pv.color=? AND pv.size=? AND p.active=1 AND pv.active=1 FOR UPDATE`,
        [it.id,it.colore,it.taglia]);
      if(!rows.length||Number(rows[0].stock_qty)<it.qty){mancanti.push({variante:keyOf(it.id,it.colore,it.taglia),disponibili:rows.length?Math.max(0,Number(rows[0].stock_qty)||0):0,richiesti:it.qty});continue}
      locked.push({...it,variant:rows[0]});
    }
    if(mancanti.length){
      await conn.rollback();
      const varianti=await stockPayload(conn);
      return {status:409,body:{ok:false,errore:"non_disponibile",mancanti,varianti}};
    }
    let totale=0;const righe=[];
    for(const it of locked){const p=Number(it.variant.price)||0;totale+=p*it.qty;righe.push(it.qty+"× "+it.variant.name+" – "+it.colore+", "+it.taglia)}
    const id=orderCode(),stato=pagamento==="PayPal"?"In attesa PayPal":"Riservato";
    const reservedUntil=pagamento==="PayPal"&&PAYPAL_HOLD_HOURS>0?new Date(Date.now()+PAYPAL_HOLD_HOURS*3600*1000).toISOString():null;
    const metadata=JSON.stringify({source:"web",backend:"mysql",...(reservedUntil?{reservedUntil}:{})});
    const [ins]=await conn.execute(`INSERT INTO merch_orders
      (order_number,customer_id,total_amount,status,order_code,ordered_at,customer_name,phone,email,venue,pieces,total,notes,returned_pieces,payment_method,metadata)
      VALUES (?,NULL,?,?,?,NOW(),?,?,?,?,?,?,?,0,?,?)`,
      [id,totale,stato,id,nome,telefono,email,sede,pieces,totale,note||null,pagamento,metadata]);
    for(const it of locked){
      const price=Number(it.variant.price)||0;
      await conn.execute(`INSERT INTO merch_order_items
        (order_id,variant_id,product_variant_id,item_key,description,quantity,unit_price)
        VALUES (?,?,?,?,?,?,?)`,
        [ins.insertId,it.variant.id,it.variant.id,keyOf(it.id,it.colore,it.taglia),it.qty+"× "+it.variant.name+" – "+it.colore+", "+it.taglia,it.qty,price]);
      await conn.execute("UPDATE product_variants SET stock_qty=stock_qty-? WHERE id=?",[it.qty,it.variant.id]);
      // Storico movimenti: facoltativo, un errore qui non deve bloccare l'ordine.
      try{await conn.execute("INSERT INTO inventory_movements (product_variant_id,order_id,movement_type,quantity_delta,note) VALUES (?,?,?,?,?)",
        [it.variant.id,ins.insertId,pagamento==="PayPal"?"RESERVE":"SALE",-it.qty,"Ordine "+id]);}catch(e){console.warn("MERCH_MOVEMENT_SKIPPED",e&&e.code)}
    }
    await conn.commit();
    const paypal=pagamento==="PayPal"?paypalUrl(id,totale):"";
    return {status:200,body:{ok:true,id,totale:Number(totale.toFixed(2)),righe,pagamento,paypal},
      mail:{id,nome,telefono,email,sede,note,totale:Number(totale.toFixed(2)),righe,pagamento,paypal}};
  }catch(e){try{await conn.rollback()}catch(_){}throw e}finally{conn.release()}
}

// Rilascia i pezzi degli ordini PayPal rimasti senza pagamento oltre PAYPAL_HOLD_HOURS.
// Ogni ordine è gestito in una transazione con lock: lo stato passa a "Scaduto" una sola volta.
async function releaseExpiredPaypalOrders(db,hours,now){
  if(!(hours>0))return {released:0};
  const cutoff=new Date((now?now.getTime():Date.now())-hours*3600*1000);
  const [orders]=await db.execute("SELECT id FROM merch_orders WHERE status='In attesa PayPal' AND ordered_at < ? ORDER BY id LIMIT 50",[cutoff]);
  let released=0;
  for(const o of orders){
    const conn=await db.getConnection();
    try{
      await conn.beginTransaction();
      const [[row]]=await conn.execute("SELECT id,order_code,status FROM merch_orders WHERE id=? FOR UPDATE",[o.id]);
      if(!row||row.status!=="In attesa PayPal"){await conn.rollback();continue;}
      const [items]=await conn.execute("SELECT product_variant_id,quantity FROM merch_order_items WHERE order_id=? AND product_variant_id IS NOT NULL",[o.id]);
      for(const it of items){
        await conn.execute("UPDATE product_variants SET stock_qty=stock_qty+? WHERE id=?",[it.quantity,it.product_variant_id]);
        try{await conn.execute("INSERT INTO inventory_movements (product_variant_id,order_id,movement_type,quantity_delta,note) VALUES (?,?,'RELEASE',?,?)",[it.product_variant_id,o.id,it.quantity,"Scaduto senza pagamento PayPal"]);}catch(e){console.warn("MERCH_MOVEMENT_SKIPPED",e&&e.code)}
      }
      await conn.execute("UPDATE merch_orders SET status='Scaduto' WHERE id=?",[o.id]);
      await conn.commit();released++;
      console.log("MERCH_PAYPAL_HOLD_RELEASED",row.order_code);
    }catch(e){try{await conn.rollback()}catch(_){}console.error("MERCH_RELEASE_ERROR",String(e&&e.message||e));}
    finally{conn.release();}
  }
  return {released};
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");
    if(req.method==="GET"&&url.pathname==="/health")return send(res,200,{ok:true,service:"artyou-merch"});
    if(req.method==="GET"&&url.pathname==="/merch"&&url.searchParams.get("stock")==="1"){
      if(!allowRequest(req,180,60*1000))return send(res,429,{ok:false,errore:"troppi_tentativi"});
      return send(res,200,{ok:true,varianti:await stockPayload()});
    }
    if(req.method==="POST"&&url.pathname==="/merch"){
      if(PROXY_SECRET&&!sameSecret(req.headers["x-artyou-proxy-secret"],PROXY_SECRET))return send(res,403,{ok:false,errore:"forbidden"});
      if(!allowRequest(req,12,60*1000))return send(res,429,{ok:false,errore:"troppi_tentativi"});
      const data=await readBody(req);
      if(String(data._hp||"").trim())return send(res,200,{ok:true});
      const out=await createOrder(data);
      if(out.status===200&&out.mail){
        try{await sendOrderEmails(out.mail);console.log("MERCH_EMAIL_SUCCESS")}
        catch(_){console.log("MERCH_EMAIL_FAILURE")}
      }
      return send(res,out.status,out.body);
    }
    return send(res,404,{ok:false,errore:"not_found"});
  }catch(e){
    const msg=e&&e.message||"server_error";
    const known=["azione_sconosciuta","campi_mancanti","telefono_non_valido","email_non_valida","sede_non_valida","carrello_vuoto","quantita_eccessiva","bad_json","too_large"];
    return send(res,e&&e.status||500,{ok:false,errore:known.includes(msg)?msg:"server_error"});
  }
});
if(require.main===module){
  server.listen(PORT,"0.0.0.0",()=>console.log("ARTYOU_MERCH_API_READY"));
  if(PAYPAL_HOLD_HOURS>0){
    const sweep=()=>releaseExpiredPaypalOrders(pool,PAYPAL_HOLD_HOURS).catch(e=>console.error("MERCH_RELEASE_ERROR",String(e&&e.message||e)));
    setTimeout(sweep,60*1000);setInterval(sweep,15*60*1000).unref();
  }
}
module.exports={releaseExpiredPaypalOrders,createOrder};
