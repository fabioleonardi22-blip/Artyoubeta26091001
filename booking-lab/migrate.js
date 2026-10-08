"use strict";
const fs=require("node:fs");
const path=require("node:path");
const {createConnection}=require("mysql2/promise");
const dbName=process.env.LAB_MYSQL_DATABASE;
if(process.env.BOOKING_LAB_MIGRATIONS!=="true" || process.env.NODE_ENV==="production" || process.env.VERCEL_ENV==="production" || !/^artyou_booking_lab(?:_[a-z0-9_]+)?$/.test(dbName||"")) {
  console.error("Refusing migrations: explicit lab-only configuration required");
  process.exit(1);
}
const required=["LAB_MYSQL_HOST","LAB_MYSQL_USER","LAB_MYSQL_PASSWORD"];
if(required.some(k=>!process.env[k])) {console.error("Missing dedicated lab migration credentials");process.exit(1);}
(async()=>{
  const db=await createConnection({
    host:process.env.LAB_MYSQL_HOST,
    port:Number(process.env.LAB_MYSQL_PORT||3306),
    user:process.env.LAB_MYSQL_USER,
    password:process.env.LAB_MYSQL_PASSWORD,
    database:dbName,
    multipleStatements:false,
    ssl:process.env.LAB_MYSQL_SSL==="true"?{rejectUnauthorized:true}:undefined
  });
  try {
    const [[identity]]=await db.query("SELECT DATABASE() AS name");
    if(identity.name!==dbName) throw Error("Connected to unexpected schema");
    for(const file of ["schema.sql","refunds-schema.sql","payment-intents-schema.sql"]){
      const sql=fs.readFileSync(path.join(__dirname,file),"utf8");
      const statements=sql.split(";").map(s=>s.trim()).filter(s=>s&&!s.startsWith("--") || s.includes("CREATE TABLE"));
      for(const statement of statements) {
        const cleaned=statement.replace(/^(?:\s*--[^\n]*\n)*/gm,"").trim();
        if(!cleaned) continue;
        if(!/^CREATE TABLE IF NOT EXISTS lab_(?:events|bookings|webhooks|refunds|payment_intents)\s*\(/i.test(cleaned)) throw Error("Unexpected migration statement in "+file);
        await db.query(cleaned);
      }
      console.log("Applied lab migration: "+file);
    }
  }finally{await db.end();}
})().catch(e=>{console.error("Lab migration failed:",e.message);process.exitCode=1;});
