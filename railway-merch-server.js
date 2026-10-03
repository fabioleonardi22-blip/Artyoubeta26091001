const http = require("http");
const crypto = require("crypto");
const mysql = require("mysql2/promise");

const PORT = Number(process.env.PORT || 3000);
const SEDI = new Set(["San Giovanni", "Eroi", "Ionio", "Valle Aurelia", "Africano", "Boccea"]);
const PAGAMENTI = new Set(["In sede", "PayPal"]);
const PAYPAL_EMAIL = "info@artyouroma.it";
const MAX_PEZZI_RIGA = 10;
const MAX_PEZZI_ORDINE = 20;

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
    const id=orderCode(),stato=pagamento==="PayPal"?"In attesa PayPal":"Riservato",metadata=JSON.stringify({source:"web",backend:"mysql"});
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
    }
    await conn.commit();
    return {status:200,body:{ok:true,id,totale:Number(totale.toFixed(2)),righe,pagamento,paypal:pagamento==="PayPal"?paypalUrl(id,totale):""}};
  }catch(e){try{await conn.rollback()}catch(_){}throw e}finally{conn.release()}
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");
    if(req.method==="GET"&&url.pathname==="/health")return send(res,200,{ok:true,service:"artyou-merch"});
    if(req.method==="GET"&&url.pathname==="/merch"&&url.searchParams.get("stock")==="1")return send(res,200,{ok:true,varianti:await stockPayload()});
    if(req.method==="POST"&&url.pathname==="/merch"){
      const data=await readBody(req);
      const out=await createOrder(data);
      return send(res,out.status,out.body);
    }
    return send(res,404,{ok:false,errore:"not_found"});
  }catch(e){
    const msg=e&&e.message||"server_error";
    const known=["azione_sconosciuta","campi_mancanti","telefono_non_valido","email_non_valida","sede_non_valida","carrello_vuoto","quantita_eccessiva","bad_json","too_large"];
    return send(res,e&&e.status||500,{ok:false,errore:known.includes(msg)?msg:"server_error"});
  }
});
server.listen(PORT,"0.0.0.0",()=>console.log("ARTYOU_MERCH_API_READY"));
