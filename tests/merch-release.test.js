const {test}=require('node:test');const assert=require('node:assert/strict');
process.env.MYSQLHOST='localhost';
const {releaseExpiredPaypalOrders}=require('../railway-merch-server');
function fakeDb(orders){const log=[];const conn={async beginTransaction(){log.push('BEGIN')},async commit(){log.push('COMMIT')},async rollback(){log.push('ROLLBACK')},release(){},
 async execute(sql,p){log.push(sql.split(' ').slice(0,3).join(' ')+' '+JSON.stringify(p));
  if(sql.startsWith('SELECT id,order_code,status'))return [[orders.find(o=>o.id===p[0])]];
  if(sql.startsWith('SELECT product_variant_id'))return [[{product_variant_id:5,quantity:2}]];
  if(sql.startsWith('UPDATE merch_orders')){orders.find(o=>o.id===p[0]).status='Scaduto';}
  return [{affectedRows:1}];}};
 return {log,async execute(sql,p){log.push('LIST '+p[0].toISOString());return [orders.filter(o=>o.status==='In attesa PayPal').map(o=>({id:o.id}))]},async getConnection(){return conn}};}
test('Unpaid PayPal orders older than the hold release their stock once',async()=>{
  const orders=[{id:1,order_code:'MERCH-1',status:'In attesa PayPal'}];const db=fakeDb(orders);
  const r=await releaseExpiredPaypalOrders(db,48,new Date('2026-10-10T12:00:00Z'));
  assert.equal(r.released,1);assert.equal(orders[0].status,'Scaduto');
  assert(db.log.some(l=>l.startsWith('LIST 2026-10-08T12:00:00')));
  assert(db.log.some(l=>/^UPDATE product_variants SET \[2,5\]/.test(l)));
  assert.equal((await releaseExpiredPaypalOrders(db,48,new Date('2026-10-10T12:00:00Z'))).released,0);
});
test('An order paid in the meantime is left untouched',async()=>{
  const orders=[{id:2,order_code:'MERCH-2',status:'In attesa PayPal'}];const db=fakeDb(orders);
  const orig=db.getConnection;db.getConnection=async()=>{const c=await orig();orders[0].status='Pagato';return c;};
  assert.equal((await releaseExpiredPaypalOrders(db,48)).released,0);assert(!db.log.some(l=>l.startsWith('UPDATE product_variants')));
});
test('Hold disabled with 0 hours',async()=>{assert.equal((await releaseExpiredPaypalOrders(null,0)).released,0);});
