const { query } = require("./db");
let ready=false;

async function ensureAuditTable(){
  if(ready)return;
  await query(`CREATE TABLE IF NOT EXISTS security_audit (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_email VARCHAR(254) NULL,
    actor_role VARCHAR(32) NULL,
    action VARCHAR(120) NOT NULL,
    resource VARCHAR(190) NULL,
    metadata JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_security_audit_date (created_at),
    KEY idx_security_audit_actor (actor_email,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  ready=true;
}

async function audit(actor,action,resource,metadata){
  try{
    await ensureAuditTable();
    await query("INSERT INTO security_audit (actor_email,actor_role,action,resource,metadata) VALUES (?,?,?,?,?)",[
      actor&&actor.email?String(actor.email):null,
      actor&&actor.role?String(actor.role):null,
      String(action||"unknown").slice(0,120),
      resource?String(resource).slice(0,190):null,
      JSON.stringify(metadata||{})
    ]);
  }catch(e){console.error("SECURITY_AUDIT_WRITE_ERROR",String(e&&e.message||e));}
}

module.exports={audit};
