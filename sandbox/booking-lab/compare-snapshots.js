"use strict";
/* Compare aggregated, anonymized snapshots only; no names, emails or payment tokens. */
const FIELDS=["capacity","confirmedSeats","heldSeats","paidCents","refundCents","checkedInSeats"];
function validate(snapshot,label){
  if(!snapshot||typeof snapshot!=="object"||!Array.isArray(snapshot.events))
    throw new Error(label+":invalid_snapshot");
  if(!snapshot.asOf||typeof snapshot.asOf!=="string")throw new Error(label+":missing_asOf");
  const map=new Map();
  for(const row of snapshot.events){
    if(!row||typeof row.slug!=="string"||!/^[a-z0-9][a-z0-9_-]{0,189}$/i.test(row.slug))
      throw new Error(label+":invalid_slug");
    if(map.has(row.slug))throw new Error(label+":duplicate_event");
    for(const f of FIELDS)if(!Number.isSafeInteger(row[f])||row[f]<0)
      throw new Error(label+":invalid_"+f);
    if(row.confirmedSeats+row.heldSeats>row.capacity)
      throw new Error(label+":overbooked_"+row.slug);
    if(row.checkedInSeats>row.confirmedSeats)
      throw new Error(label+":invalid_checkin_"+row.slug);
    map.set(row.slug,row);
  }
  return map;
}
function compare(source,target){
  const a=validate(source,"legacy");
  const b=validate(target,"staging");
  const diffs=[];
  if(source.asOf!==target.asOf)diffs.push({type:"snapshot_time_mismatch",legacy:source.asOf,staging:target.asOf});
  for(const slug of new Set([...a.keys(),...b.keys()])){
    if(!a.has(slug)||!b.has(slug)){diffs.push({type:"event_missing",slug,missingIn:a.has(slug)?"staging":"legacy"});continue;}
    for(const f of FIELDS)if(a.get(slug)[f]!==b.get(slug)[f])
      diffs.push({type:"value_mismatch",slug,field:f,legacy:a.get(slug)[f],staging:b.get(slug)[f]});
  }
  return {match:diffs.length===0,eventCount:a.size,differences:diffs};
}
if(require.main===module){
  const fs=require("node:fs");
  try{
    const [legacy,staging]=process.argv.slice(2);
    if(!legacy||!staging)throw new Error("usage: node compare-snapshots.js legacy.json staging.json");
    const result=compare(JSON.parse(fs.readFileSync(legacy,"utf8")),JSON.parse(fs.readFileSync(staging,"utf8")));
    console.log(JSON.stringify(result,null,2));
    if(!result.match)process.exitCode=1;
  }catch(e){console.error(String(e.message||e));process.exitCode=2;}
}
module.exports={compare,validate};
