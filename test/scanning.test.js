import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import http from 'node:http';
import {normalizeBarcode,setupBarcodeLookup} from '../barcode.js';
import {searchLabel} from '../label-search.js';
import {createApp} from '../server.js';
const code='088004005542';
function fixture(){const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE bottles(id INTEGER PRIMARY KEY,name TEXT,barcode TEXT)');return db;}
test('validates GTIN checksums and preserves leading zeros',()=>{
 assert.equal(normalizeBarcode(code),'00088004005542');assert.equal(normalizeBarcode('0 88004-00554 2'),'00088004005542');
 assert.equal(normalizeBarcode('96385074'),'00000096385074');
 for(const bad of ['088004005541','123','https://example.com',123456789012,null])assert.throws(()=>normalizeBarcode(bad));
});
test('barcode lookup limits requests, sanitizes results, reuses saved society identities',async()=>{
 const db=fixture();let calls=0;
 const lookup=setupBarcodeLookup(db,async(url,options)=>{calls++;assert.equal(url,'https://api.upcitemdb.com/prod/trial/lookup?upc=00088004005542');assert.equal(options.redirect,'error');return Response.json({code:'OK',items:[{title:'Buffalo Trace',brand:'Buffalo Trace',images:['https://untrusted.example/image'],offers:[{price:99}]}]});});
 try{const found=await lookup(code);assert.equal(found.items[0].title,'Buffalo Trace');assert.equal(found.items[0].images,undefined);assert.equal(found.items[0].price,undefined);
 await assert.rejects(lookup(code),/wait a few seconds/);assert.equal(calls,1);
 db.prepare('INSERT INTO bottles VALUES (1,?,?)').run('Saved bourbon',normalizeBarcode(code));assert.equal((await lookup(code)).source,'Society cabinet');assert.equal(calls,1);
 db.exec('DELETE FROM bottles;UPDATE barcode_usage SET count=90');await assert.rejects(lookup(code),/allowance/);
 }finally{db.close();}
});
test('barcode provider failure and no-match paths remain usable',async()=>{
 for(const [response,expected] of [[Response.json({code:'OK',items:[]}),null],[new Response('',{status:429}),/limit/],[new Response('',{status:500}),/unavailable/],[new Response('not json'),/could not connect/],[Response.json({unexpected:true}),/unexpected/]]){
  const db=fixture();try{const lookup=setupBarcodeLookup(db,async()=>response);if(expected)await assert.rejects(lookup(code),expected);else assert.deepEqual((await lookup(code)).items,[]);}finally{db.close();}
 }
 const db=fixture();try{await assert.rejects(setupBarcodeLookup(db,async()=>{throw new DOMException('timeout','TimeoutError');})(code),/timed out/);}finally{db.close();}
});
test('label search ranks catalog candidates without inventing label details',()=>{
 assert.ok(searchLabel('WILD TURKEY 101\nKENTUCKY STRAIGHT BOURBON\n101 PROOF').some(b=>/Wild Turkey 101/i.test(b.name)));
 assert.deepEqual(searchLabel('bourbon whiskey kentucky straight proof'),[]);
 assert.deepEqual(searchLabel('zzzznotawhiskeyzzzz'),[]);assert.throws(()=>searchLabel('a'.repeat(4001)));
});
test('scan endpoints require sign-in, respect origins and preserve barcode on saved bottles',async()=>{
 let calls=0;const app=createApp(':memory:',{barcodeFetch:async()=>{calls++;return Response.json({code:'OK',items:[{title:'Buffalo Trace'}]});}}),server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const post=(path,data,cookie='',origin)=>fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',cookie,...(origin?{origin}:{})},body:JSON.stringify(data)});
 try{const admin=await post('auth/setup',{name:'Host',email:'host@example.com',password:'h'});const cookie=admin.headers.get('set-cookie').split(';')[0];
 assert.equal((await post('barcode',{barcode:code})).status,401);assert.equal((await post('barcode',{barcode:code},cookie,'https://other.example')).status,403);assert.equal(calls,0);
 const result=await post('barcode',{barcode:code},cookie);assert.equal(result.status,200);assert.equal((await result.json()).items[0].title,'Buffalo Trace');
 const save=await post('bottles',{name:'Buffalo Trace',member_id:1,rating:'Favorite',remaining:100,barcode:code},cookie);assert.equal(save.status,201);assert.equal((await save.json()).barcode,normalizeBarcode(code));
 assert.equal((await post('barcode',{barcode:code},cookie)).status,200);assert.equal(calls,1);
 assert.equal((await post('catalog/label',{text:'Wild Turkey 101'},cookie)).status,200);
 assert.equal((await fetch(base+'/vendor/core/tesseract-core-simd-lstm.wasm')).headers.get('content-type'),'application/wasm');
 assert.equal((await fetch(base+'/node_modules/tesseract.js/package.json')).status,404);
 }finally{await new Promise(r=>server.close(r));app.close();}
});
