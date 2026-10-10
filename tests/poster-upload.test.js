const {test}=require('node:test');const assert=require('node:assert/strict');
const {uploadImageToBlob,imageKind}=require('../api/events');
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(32)]);
test('Posters go to Vercel Blob as public images with a sanitized name and detected type',async()=>{
  let call;const put=async(name,bytes,opt)=>{call={name,bytes,opt};return {url:'https://blob.example/'+name};};
  const out=await uploadImageToBlob({name:'Locandina ShortYou!.JPG',mime:'image/jpeg',base64:png.toString('base64')},put);
  assert.equal(out.ok,true);assert.equal(call.opt.contentType,'image/png');assert.equal(call.opt.access,'public');assert.equal(call.opt.addRandomSuffix,true);
  assert.equal(call.name,'locandine/locandina-shortyou.png');
});
test('Non-image or forged files are refused before upload',async()=>{
  const put=async()=>{throw Error('must not upload')};
  await assert.rejects(uploadImageToBlob({name:'x.png',base64:Buffer.from('<svg onload=alert(1)>').toString('base64')},put),/formato_immagine_non_valido/);
  await assert.rejects(uploadImageToBlob({name:'x.png',base64:'not base64!'},put),/immagine_non_valido/);
  assert.equal(imageKind(Buffer.from('RIFF0000WEBPVP8 ')).mime,'image/webp');
});
