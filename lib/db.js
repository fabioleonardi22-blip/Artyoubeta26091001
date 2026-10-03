const mysql = require("mysql2/promise");

let pool;

function mysqlConfig() {
  const raw = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (!raw) throw new Error("DATABASE_URL non configurato");

  const u = new URL(raw);
  if (!/^mysql:$/i.test(u.protocol)) {
    throw new Error("DATABASE_URL deve iniziare con mysql://");
  }

  const cfg = {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 5),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: "Z"
  };

  if (String(process.env.MYSQL_SSL || "").toLowerCase() === "true") {
    cfg.ssl = {};
  }
  return cfg;
}

function getPool() {
  if (!pool) pool = mysql.createPool(mysqlConfig());
  return pool;
}

async function query(sql, params) {
  const [rows] = await getPool().execute(sql, params || []);
  return rows;
}

async function transaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { getPool, query, transaction };
