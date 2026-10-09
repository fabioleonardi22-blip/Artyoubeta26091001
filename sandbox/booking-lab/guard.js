"use strict";
const crypto = require("node:crypto");
function ensureLabEnv(env = process.env) {
  if (env.VERCEL_ENV === "production") throw new Error("lab_production_forbidden");
  if (env.ARTYOU_BOOKING_LAB_MODE !== "sandbox") throw new Error("lab_disabled");
  const labUrl = String(env.ARTYOU_BOOKING_LAB_DATABASE_URL || "").trim();
  if (!labUrl || !/^mysql:\/\//i.test(labUrl)) throw new Error("lab_database_not_configured");
  const prodUrls = [env.DATABASE_URL, env.MYSQL_URL].filter(Boolean).map(String);
  if (prodUrls.includes(labUrl)) throw new Error("lab_database_matches_production");
  for (const rawProd of prodUrls) {
    try {
      const prod = new URL(rawProd);
      const lab = new URL(labUrl);
      if (prod.hostname === lab.hostname && (prod.port || "3306") === (lab.port || "3306") &&
          prod.pathname === lab.pathname) throw new Error("lab_database_matches_production");
    } catch (e) { if (e.message === "lab_database_matches_production") throw e; }
  }
  const u = new URL(labUrl);
  if (!u.pathname || u.pathname === "/") throw new Error("lab_database_name_required");
  // The Railway booking-lab migrator uses a DIFFERENT schema with the same lab_ table names.
  // Never point this legacy staging API at artyou_booking_lab or a production schema.
  const schema = decodeURIComponent(u.pathname.slice(1));
  if (!/^artyou_booking_staging(?:_[a-z0-9_]+)?$/i.test(schema))
    throw new Error("lab_staging_schema_required");
  if (!String(env.ARTYOU_BOOKING_LAB_TOKEN || "").trim() || String(env.ARTYOU_BOOKING_LAB_TOKEN).length < 32)
    throw new Error("lab_token_missing");
  return labUrl;
}
function authorized(req, env = process.env) {
  const expected = String(env.ARTYOU_BOOKING_LAB_TOKEN || "");
  const actual = String(req.headers["x-booking-lab-token"] || "");
  if (!expected || !actual || expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
function createLabPool(env = process.env) {
  const u = new URL(ensureLabEnv(env));
  const mysql = require("mysql2/promise");
  return mysql.createPool({
    host:u.hostname,port:Number(u.port||3306),user:decodeURIComponent(u.username),
    password:decodeURIComponent(u.password),database:decodeURIComponent(u.pathname.slice(1)),
    waitForConnections:true,connectionLimit:Math.min(5,Math.max(1,Number(env.ARTYOU_BOOKING_LAB_POOL_SIZE||2))),
    queueLimit:25,enableKeepAlive:true,timezone:"Z",
    ssl:String(env.ARTYOU_BOOKING_LAB_SSL||"").toLowerCase()==="true"
      ? {rejectUnauthorized:true} : undefined
  });
}
module.exports={ensureLabEnv,authorized,createLabPool};
