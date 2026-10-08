"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {TABLES,readMigrations,assertLabEnvironment,migrate}=require("./migrate");
const env={BOOKING_LAB_MIGRATIONS:"true",LAB_MYSQL_DATABASE:"artyou_booking_lab",LAB_MYSQL_HOST:"isolated",LAB_MYSQL_USER:"migration",LAB_MYSQL_PASSWORD:"test-only"};
test("all five lab DDL statements are explicitly allowed",()=>{
 const sql=readMigrations();
 assert.equal(sql.length,5);
 assert.equal(TABLES.length,5);
});
test("production environment is rejected",()=>{
 assert.throws(()=>assertLabEnvironment({...env,NODE_ENV:"production"}));
 assert.throws(()=>assertLabEnvironment({...env,VERCEL_ENV:"production"}));
 assert.throws(()=>assertLabEnvironment({...env,LAB_MYSQL_DATABASE:"artyou_production"}));
});
test("migration uses only expected schema and verifies five tables",async()=>{
 const queries=[];let ended=false;
 const result=await migrate({env,connect:async options=>{
   assert.equal(options.database,"artyou_booking_lab");
   assert.equal(options.multipleStatements,false);
   return {query:async sql=>{
     queries.push(sql);
     if(sql.startsWith("SELECT DATABASE()")) return [[{name:"artyou_booking_lab"}]];
     if(sql.startsWith("SELECT table_name")) return [TABLES.map(table_name=>({table_name}))];
     return [];
   },end:async()=>{ended=true;}};
 }});
 assert.deepEqual(result,TABLES);
 assert.equal(queries.length,7);
 assert.equal(ended,true);
});
test("unexpected database aborts before schema changes",async()=>{
 const queries=[];
 await assert.rejects(migrate({env,connect:async()=>({
   query:async sql=>{queries.push(sql);return [[{name:"wrong_database"}]];},
   end:async()=>{}
 })}));
 assert.equal(queries.length,1);
});
