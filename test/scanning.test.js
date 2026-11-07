import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {searchLabel} from '../label-search.js';
import {createApp} from '../server.js';
test('label search ranks catalog candidates without inventing label details',()=>{
 assert.ok(searchLabel('WILD TURKEY 101\nKENTUCKY STRAIGHT BOURBON\n101 PROOF').some(b=>/Wild Turkey 101/i.test(b.name)));
 assert.deepEqual(searchLabel('bourbon whiskey kentucky straight proof'),[]);
 assert.deepEqual(searchLabel('zzzznotawhiskeyzzzz'),[]);assert.throws(()=>searchLabel('a'.repeat(4001)));
});
test('label lookup requires sign-in, respects origins, and retired barcode routes are unavailable',async()=>{
 const app=createApp(':memory:'),server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const post=(path,data,cookie='',origin)=>fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json',cookie,...(origin?{origin}:{})},body:JSON.stringify(data)});
 try{const admin=await post('auth/setup',{name:'Host',email:'host@example.com',password:'h'});const cookie=admin.headers.get('set-cookie').split(';')[0];
 assert.equal((await post('catalog/label',{text:'Wild Turkey 101'})).status,401);
 assert.equal((await post('catalog/label',{text:'Wild Turkey 101'},cookie,'https://other.example')).status,403);
 const found=await post('catalog/label',{text:'Wild Turkey 101'},cookie);assert.equal(found.status,200);assert.ok((await found.json()).results.some(b=>/Wild Turkey 101/i.test(b.name)));
 assert.equal((await post('catalog/label',{text:'a'.repeat(4001)},cookie)).status,400);
 assert.equal((await post('barcode',{barcode:'088004005542'},cookie)).status,404);
 assert.equal((await fetch(base+'/vendor/zxing.js')).status,404);
 assert.equal((await fetch(base+'/vendor/core/tesseract-core-simd-lstm.wasm')).headers.get('content-type'),'application/wasm');
 assert.equal((await fetch(base+'/node_modules/tesseract.js/package.json')).status,404);
 }finally{await new Promise(r=>server.close(r));app.close();}
});
test('editing a bottle retains barcode data saved during the earlier trial',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'fifth-barrel-legacy-barcode-')),path=join(dir,'society.sqlite');
 const initial=createApp(path);initial.close();
 const db=new DatabaseSync(path);db.exec("ALTER TABLE bottles ADD COLUMN barcode TEXT; INSERT INTO members(id,name) VALUES(1,'Host'); INSERT INTO bottles(id,member_id,name,rating,remaining,barcode) VALUES(1,1,'Original','Favorite',100,'00088004005542')");db.close();
 const app=createApp(path),server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const setup=await fetch(base+'/api/auth/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Host',member_id:1,email:'host@example.com',password:'h'})});assert.equal(setup.status,201);const cookie=setup.headers.get('set-cookie').split(';')[0];
  const edited=await fetch(base+'/api/bottles/1',{method:'PUT',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify({name:'Updated bourbon',member_id:1,rating:'Favorite',remaining:75})});assert.equal(edited.status,200);
  const state=await (await fetch(base+'/api/state',{headers:{cookie}})).json();assert.equal(state.bottles[0].barcode,'00088004005542');assert.equal(state.bottles[0].name,'Updated bourbon');
 }finally{await new Promise(r=>server.close(r));app.close();rmSync(dir,{recursive:true,force:true});}
});
