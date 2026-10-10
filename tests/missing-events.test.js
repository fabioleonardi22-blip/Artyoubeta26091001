const {test}=require('node:test');const assert=require('node:assert/strict');
const {plan}=require('../scripts/mysql-create-missing-events');
test('Missing events: existing slugs and events without capacity are never created',()=>{
  const steps=plan([{slug:'shortyou',capienza:10},{slug:'yep-2027-solo-soggiorno',capienza:null},{slug:'rif-2027-spettacolo-all-in',titolo:'ALL IN',capienza:80,prezzo:15,data:'13/03/2027 · 22:00'},{slug:'Bad Slug',capienza:1}],new Set(['shortyou']));
  assert.deepEqual(steps.map(s=>s.action),['skip','skip','create','skip']);
  const c=steps[2];assert.equal(c.capacity,80);assert.equal(c.price,15);assert.equal(c.startsAt,'2027-03-13 22:00:00');
});
