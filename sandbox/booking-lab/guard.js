"use strict";
const crypto = require("node:crypto");
function ensureLabEnv(env = process.env) {
  if (env.ARTYOU_BOOKING_LAB_MODE !== "sandbox") throw new Error("lab_disabled");
  const labUrl = String(env.ARTYOU_BOOKING_LAB_DATABASE_URL || "").trim();
  if (!labUrl || !/^mysql:\/\//i.test(labUrl)) throw new Error("lab_database_not_configured");
  const prodUrls = [env.DATABASE_URL, env.MYSQL_URL].filter(Boolean).map(String);
  if (prodUrls.includes(labUrl)) throw new Error("lab_database_matches_production");
  const u = new URL(labUrl);
  if (!u.pathname || u.pathname === "/") throw new Error("lab_database_name_required");
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
