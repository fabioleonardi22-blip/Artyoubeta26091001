const {test}=require('node:test');
const assert=require('node:assert/strict');
test('Editorial sections select technique, person and school sources separately',async()=>{
 const {sourcesForCategory}=await import('../scripts/blog-editorial.mjs');
 const sources=[{type:'school'},{type:'person'},{type:'technique'},{type:'festival-directory'}];
 assert.deepEqual(sourcesForCategory(sources,"Dentro l'improv"),[{type:'technique'}]);
 assert.deepEqual(sourcesForCategory(sources,'Impro People'),[{type:'person'}]);
 assert.deepEqual(sourcesForCategory(sources,'Improv around the world'),[{type:'school'}]);
});
test('Rejected duplicate subjects receive feedback and a fresh proposal is validated',async()=>{
 const {proposeUnique}=await import('../scripts/blog-editorial.mjs');let calls=0;const prompts=[];
 const result=await proposeUnique({prompt:'Fonti',generate:async prompt=>{prompts.push(prompt);return {title:++calls===1?'Scuole già trattate':'Nuovo tema'};},validate:async article=>{if(article.title==='Scuole già trattate')throw Error('Argomento già pubblicato: scuole');}});
 assert.equal(result.title,'Nuovo tema');assert.equal(calls,2);assert.match(prompts[1],/Scuole già trattate/);
});
test('Repeated subjects remain blocked after the bounded attempts',async()=>{
 const {proposeUnique}=await import('../scripts/blog-editorial.mjs');let calls=0;
 await assert.rejects(proposeUnique({prompt:'Fonti',generate:async()=>{calls++;return {title:'Duplicato'};},validate:async()=>{throw Error('Articolo ripetuto: Duplicato');}}),/Articolo ripetuto/);
 assert.equal(calls,3);
});
test('Provider or verification failures do not bypass editorial validation',async()=>{
 const {proposeUnique}=await import('../scripts/blog-editorial.mjs');let calls=0;
 await assert.rejects(proposeUnique({prompt:'Fonti',generate:async()=>{calls++;return {};},validate:async()=>{throw Error('Verifica duplicati non valida: pubblicazione bloccata');}}),/Verifica duplicati non valida/);
 assert.equal(calls,1);
});
