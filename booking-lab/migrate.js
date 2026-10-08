"use strict";
const fs=require("node:fs");
const path=require("node:path");
const TABLES=["lab_events","lab_bookings","lab_webhooks","lab_refunds","lab_payment_intents"];
function statements(sql){
  return sql.split(";").map(part=>part.replace(/^\s*(?:--[^\n]*(?:\n|$)\s*)*/g,"").trim()).filter(Boolean);
}
function verifyStatement(statement){
  const match=/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(lab_[a-z_]+)\s*\(/i.exec(statement);
  if(!match || !TABLES.includes(match[1].toLowerCase())) throw Error("Unexpected SQL statement");
  return match[1].toLowerCase();
}
function readMigrations(){
  const files=["schema.sql","refunds-schema.sql","payment-intents-schema.sql"];
  const sql=files.flatMap(file=>statements(fs.readFileSync(path.join(__dirname,file),"utf8")));
  const names=sql.map(verifyStatement);
  if(names.length!==TABLES.length || new Set(names).size!==TABLES.length || TABLES.some(name=>!names.includes(name))) throw Error("Unexpected lab schema inventory");
  return sql;
}
function assertLabEnvironment(env){
  if(env.BOOKING_LAB_MIGRATIONS!=="true" || env.NODE_ENV==="production" || env.VERCEL_ENV==="production" || env.LAB_MYSQL_DATABASE!=="artyou_booking_lab") throw Error("Lab-only migration guard refused");
  for(const key of ["LAB_MYSQL_HOST","LAB_MYSQL_USER","LAB_MYSQL_PASSWORD"]) if(!env[key]) throw Error("Missing dedicated migration configuration");
}
async function migrate({env=process.env,connect}={}){
  assertLabEnvironment(env);
  const sql=readMigrations();
  const connection=await connect({
    host:env.LAB_MYSQL_HOST,port:Number(env.LAB_MYSQL_PORT||3306),user:env.LAB_MYSQL_USER,password:env.LAB_MYSQL_PASSWORD,
    database:env.LAB_MYSQL_DATABASE,multipleStatements:false,
    ssl:env.LAB_MYSQL_SSL==="true"?{rejectUnauthorized:true}:undefined
  });
  try {
    const [[identity]]=await connection.query("SELECT DATABASE() AS name");
    if(identity.name!=="artyou_booking_lab") throw Error("Wrong database");
    for(const statement of sql) await connection.query(statement);
    const [rows]=await connection.query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name LIKE 'lab_%'");
    const found=new Set(rows.map(row=>String(row.TABLE_NAME||row.table_name).toLowerCase()));
    if(TABLES.some(table=>!found.has(table))) throw Error("Missing lab tables after migration");
    return TABLES;
  } finally {await connection.end();}
}
module.exports={TABLES,statements,verifyStatement,readMigrations,assertLabEnvironment,migrate};
if(require.main===module){
  const {createConnection}=require("mysql2/promise");
  migrate({connect:createConnection}).then(tables=>console.log("Verified lab tables:",tables.join(", "))).catch(e=>{console.error("Migration refused or failed:",e.message);process.exitCode=1;});
}
