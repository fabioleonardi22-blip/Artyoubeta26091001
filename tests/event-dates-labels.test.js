const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseDateLabel,startsAtFromLabel,romeIso,isPast}=require('../lib/event-dates');
test('Italian labels become Rome wall-clock values for starts_at',()=>{
  assert.deepEqual(parseDateLabel('29/11/2026 · 19:30'),{date:'2026-11-29',start:'19:30'});
  assert.equal(startsAtFromLabel('29/11/2026 · 19:30'),'2026-11-29 19:30:00');
  assert.equal(startsAtFromLabel('4 ottobre 2026 ore 21:00'),'2026-10-04 21:00:00');
  assert.equal(startsAtFromLabel('Data da definire'),null);
});
test('schema.org dates add the Rome offset to the stored wall clock (summer and winter)',()=>{
  // mysql2 con timezone "Z" restituisce 19:30 Roma come Date con ore UTC = 19:30
  assert.equal(romeIso(new Date('2026-11-29T19:30:00Z')),'2026-11-29T19:30:00+01:00');
  assert.equal(romeIso(new Date('2026-10-04T21:00:00Z')),'2026-10-04T21:00:00+02:00');
  assert.equal(romeIso('2027-03-12 00:00:00'),'2027-03-12');
});
test('A date-only event stays current until the end of its day in Rome',()=>{
  assert.equal(isPast('2026-10-10 00:00:00',new Date('2026-10-10T21:00:00Z')),false);
  assert.equal(isPast('2026-10-10 00:00:00',new Date('2026-10-10T22:01:00Z')),true);
  assert.equal(isPast(new Date('2026-10-04T19:30:00Z'),new Date('2026-10-10T08:00:00Z')),true);
});
