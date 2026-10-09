import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const skipDirs = new Set([".git","node_modules",".vercel"]);
const patterns = [
  { name:"OpenAI-style key", re:/\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name:"GitHub token", re:/\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name:"Google API key", re:/\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { name:"Private key", re:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name:"Database URL", re:/\bmysql:\/\/[^\s"'<>]+/i },
  { name:"Likely hardcoded secret", re:/\b(?:client_secret|access_token|refresh_token|password|scanner_secret)\b\s*[:=]\s*["'][^"'\n]{8,}["']/i }
];

const allow = [
  /process\.env\./,
  /\$\{\{\s*secrets\./,
  /DATABASE_URL non configurato/,
  /DATABASE_URL deve iniziare/,
  /mysql:\/\/USER:PASSWORD@HOST/,
  /mysql:\/\/\.\.\.(?:["\s]|$)/i
];

function walk(dir, out=[]) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const files = walk(root);
const findings = [];
for (const file of files) {
  let text;
  try {
    const stat = fs.statSync(file);
    if (stat.size > 2 * 1024 * 1024) continue;
    text = fs.readFileSync(file, "utf8");
  } catch { continue; }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (allow.some(re => re.test(line))) return;
    for (const p of patterns) {
      if (p.name === "Database URL") {
        const matches = line.match(/\bmysql:\/\/[^\s"\x27<>]+/gi) || [];
        const fixtureUrls = new Set(["mysql://a:b@db/lab","mysql://a:b@db/prod","mysql://a:b@db/other","mysql://other:password@db/prod","mysql://a:b@db/artyou_booking_staging","mysql://a:b@db/"]);
        const isFixture = path.relative(root,file).replace(/\\/g,"/") === "sandbox/booking-lab/staging.test.js";
        const relativePath = path.relative(root,file).replace(/\\/g,"/");
        const isDoc = relativePath === "sandbox/booking-lab/README.md";
        const isScanner = relativePath === "scripts/security-scan.mjs";
        if (matches.some(url => !(isFixture && fixtureUrls.has(url)) && !(isDoc && url.startsWith("mysql://.../DB_DI_STAGING")) && !isScanner)) findings.push({file:path.relative(root,file), line:idx+1, type:p.name});
      } else if (p.re.test(line)) findings.push({file:path.relative(root,file), line:idx+1, type:p.name});
    }
  });
}

if (findings.length) {
  console.error("Potential secrets detected:");
  for (const f of findings) console.error(`- ${f.file}:${f.line} · ${f.type}`);
  process.exit(1);
}
console.log("Security scan passed: no obvious hardcoded secrets detected.");
