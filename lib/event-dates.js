// Preserve date IDs, timestamps and booking references on every event edit.
async function reconcileDates(conn,eventId,inputs){
  const [existing]=await conn.execute("SELECT id,date_label,starts_at,metadata FROM event_dates WHERE event_id=? FOR UPDATE",[eventId]);
  const used=new Set();
  for(const input of inputs){
    const label=String(input&&input.label||"").trim().slice(0,255);
    if(!label)continue;
    const requested=String(input.id||"");
    const old=requested?existing.find(d=>String(d.id)===requested):existing.find(d=>!used.has(String(d.id))&&d.date_label===label);
    if(requested&&!old)throw new Error("data_non_valido");
    if(old&&used.has(String(old.id)))throw new Error("data_duplicata_non_valido");
    const explicit=Object.hasOwn(input,"start")&&input.start!=="";
    const start=explicit?new Date(input.start):old&&old.starts_at||null;
    if(explicit&&!Number.isFinite(start.getTime()))throw new Error("data_non_valido");
    let previous={};try{previous=typeof old?.metadata==="string"?JSON.parse(old.metadata):old?.metadata||{};}catch(_){}
    const metadata=JSON.stringify({...previous,...input.metadata});
    if(old){used.add(String(old.id));await conn.execute("UPDATE event_dates SET date_label=?,starts_at=?,active=1,metadata=? WHERE id=? AND event_id=?",[label,start,metadata,old.id,eventId]);}
    else{const [result]=await conn.execute("INSERT INTO event_dates (event_id,starts_at,date_label,active,metadata) VALUES (?,?,?,1,?)",[eventId,start,label,metadata]);used.add(String(result.insertId));}
  }
  // Retire omitted dates; never delete rows referenced by bookings.
  for(const old of existing)if(!used.has(String(old.id)))await conn.execute("UPDATE event_dates SET active=0 WHERE id=? AND event_id=?",[old.id,eventId]);
}
module.exports={reconcileDates};
