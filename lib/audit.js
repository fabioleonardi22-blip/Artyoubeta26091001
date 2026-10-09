const { query } = require("./db");
// La tabella security_audit è creata da database/schema.sql: l'utente dell'app non ha permessi DDL.

async function audit(actor,action,resource,metadata){
  try{
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
