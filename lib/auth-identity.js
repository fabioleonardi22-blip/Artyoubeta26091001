const { query } = require("./db");

let schemaReady=false;

async function ensureSchema(){
  if(schemaReady)return;
  await query(`CREATE TABLE IF NOT EXISTS auth_identities (
    provider VARCHAR(32) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    user_id BIGINT NOT NULL,
    email_at_link VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (provider,subject),
    UNIQUE KEY uq_auth_identity_user (provider,user_id),
    KEY idx_auth_identity_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
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
