const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseDateLabel,startsAtFromLabel,romeIso,isPast}=require('../lib/event-dates');
test('Italian labels become Rome instants, summer and winter time included',()=>{
  assert.deepEqual(parseDateLabel('29/11/2026 · 19:30'),{date:'2026-11-29',start:'19:30'});
  assert.equal(startsAtFromLabel('29/11/2026 · 19:30').toISOString(),'2026-11-29T18:30:00.000Z');
  assert.equal(startsAtFromLabel('4 ottobre 2026 ore 21:00').toISOString(),'2026-10-04T19:00:00.000Z');
  assert.equal(startsAtFromLabel('Data da definire'),null);
});
test('schema.org dates carry the Rome offset; midnight means date only',()=>{
  assert.equal(romeIso(new Date('2026-10-04T19:30:00Z')),'2026-10-04T21:30:00+02:00');
  assert.equal(romeIso(startsAtFromLabel('12/03/2027')),'2027-03-12');
});
test('A date-only event stays current until the end of its day in Rome',()=>{
  const day=startsAtFromLabel('10/10/2026');
  assert.equal(isPast(day,new Date('2026-10-10T21:00:00Z')),false);
  assert.equal(isPast(day,new Date('2026-10-10T22:01:00Z')),true);
});
