const { query } = require("./db");

let schemaReady=false;

async function ensureSchema(){
  if(schemaReady)return;
  // Schema is provisioned by an administrator; application logins must not require DDL privileges.
  await query("SELECT 1 FROM auth_identities LIMIT 0");
  schemaReady=true;
}

async function userByGoogleSubject(subject){
  await ensureSchema();
  const rows=await query(
    `SELECT u.id,u.email,u.display_name,u.role,u.active,u.metadata
     FROM auth_identities ai
     JOIN users u ON u.id=ai.user_id
     WHERE ai.provider='google' AND ai.subject=?
     LIMIT 1`,
    [String(subject||"")]
  );
  return rows&&rows[0]?rows[0]:null;
}

async function bootstrapGoogleIdentity(identity){
  if(!identity||!identity.sub||!identity.email)return null;
  await ensureSchema();
  let user=await userByGoogleSubject(identity.sub);
  if(user)return user;

  const rows=await query(
    "SELECT id,email,display_name,role,active,metadata FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1",
    [identity.email]
  );
  user=rows&&rows[0]?rows[0]:null;
  if(!user||!user.active)return null;

  await query(
    `INSERT INTO auth_identities (provider,subject,user_id,email_at_link)
     VALUES ('google',?,?,?)
     ON DUPLICATE KEY UPDATE email_at_link=VALUES(email_at_link),last_seen_at=CURRENT_TIMESTAMP`,
    [identity.sub,user.id,identity.email]
  );
  return userByGoogleSubject(identity.sub);
}

module.exports={ensureSchema,userByGoogleSubject,bootstrapGoogleIdentity};
