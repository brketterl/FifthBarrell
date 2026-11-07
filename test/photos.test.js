import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import sharp from 'sharp';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createApp} from '../server.js';
const png=()=>sharp({create:{width:40,height:90,channels:3,background:'#987032'}}).png().toBuffer();
const metadata=(overrides={})=>({title:'File:Wild Turkey 101.jpg',index:1,imageinfo:[{mime:'image/jpeg',thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Bottle.jpg/600px-Bottle.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Bottle.jpg',extmetadata:{Artist:{value:'<a href="https://example.com">Bottle Photographer</a>'},LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'http://creativecommons.org/licenses/by-sa/4.0/'}}}],...overrides});
test('photo search filters sources/licenses, imports only signed candidates, and preserves credits',async()=>{
 const image=await png(),calls=[];const dir=mkdtempSync(join(tmpdir(),'fifth-barrel-photos-')),path=join(dir,'db.sqlite');
 const fetcher=async url=>{calls.push(String(url));return String(url).startsWith('https://commons.wikimedia.org/w/api.php?')?Response.json({query:{pages:{1:metadata(),2:metadata({imageinfo:[{mime:'image/svg+xml'}]})}}}):new Response(image);};
 let app=createApp(path,{photoFetch:fetcher}),server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let base=`http://127.0.0.1:${server.address().port}/api/`;
 const request=async(path,method='GET',data,cookie='',extra={})=>{const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',cookie,...extra},body:data?JSON.stringify(data):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};};
 const stop=async()=>{await new Promise(r=>server.close(r));app.close();};
 try{
  const admin=await request('auth/setup','POST',{name:'Host',email:'host@example.com',password:'h'});const cookie=admin.cookie;
  assert.equal((await request('photos/search','POST',{query:'Wild Turkey 101'})).status,401);
  assert.equal((await request('photos/search','POST',{query:'Wild Turkey 101'},cookie,{origin:'https://foreign.example'})).status,403);
  const results=(await request('photos/search','POST',{query:'Wild Turkey 101'},cookie)).data.results;assert.equal(results.length,1);assert.equal(results[0].artist,'Bottle Photographer');assert.equal(results[0].license_url,'https://creativecommons.org/licenses/by-sa/4.0/');
  await request('photos/search','POST',{query:'Wild Turkey 101'},cookie);assert.equal(calls.length,1);
  assert.equal((await request('photos/import','POST',{token:results[0].token+'x'},cookie)).status,400);assert.equal(calls.length,1);
  assert.equal((await request('photos/import','POST',{token:'http://127.0.0.1/private'},cookie)).status,400);
  const imported=await request('photos/import','POST',{token:results[0].token},cookie);assert.equal(imported.status,201);assert.equal(imported.data.license,'CC BY-SA 4.0');assert.equal(imported.data.kind,'commons');assert.equal(calls.length,2);
  const bottle={member_id:1,name:'Wild Turkey 101',rating:'Favorite',remaining:100,photo_id:imported.data.id};const saved=await request('bottles','POST',bottle,cookie);assert.equal(saved.status,201);
  const state=(await request('state','GET',null,cookie)).data;assert.equal(state.bottles[0].photo.id,imported.data.id);assert.equal(state.bottles[0].photo.artist,'Bottle Photographer');assert.equal(state.bottles[0].photo.data,undefined);
  const photo=await fetch(base+'photos/'+imported.data.id,{headers:{cookie}});assert.equal(photo.headers.get('content-type'),'image/webp');assert.equal((await sharp(Buffer.from(await photo.arrayBuffer())).metadata()).format,'webp');
  assert.equal((await fetch(base+'photos/'+imported.data.id)).status,401);
  await stop();app=createApp(path);server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/api/`;
  assert.equal((await request('state','GET',null,cookie)).data.bottles[0].photo.id,imported.data.id);
  const {photo_id,...keep}=bottle;assert.equal((await request('bottles/'+saved.data.id,'PUT',{...keep,name:'Updated'},cookie)).status,200);assert.equal((await request('state','GET',null,cookie)).data.bottles[0].photo.id,photo_id);
  await request('bottles/'+saved.data.id,'PUT',{...bottle,photo_id:''},cookie);assert.equal((await request('state','GET',null,cookie)).data.bottles[0].photo,null);
 }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});
test('uploads validate actual images and members cannot assign another member’s draft photo',async()=>{
 const app=createApp(':memory:'),server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/`;
 const post=async(path,data,cookie='')=>{const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(data)});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};};
 try{
  const admin=await post('auth/setup',{name:'Host',email:'host@example.com',password:'h'});
  const member=(await post('members',{name:'Member'},admin.cookie)).data;const invite=(await post('auth/invite',{member_id:member.id},admin.cookie)).data;
  const joined=await post('auth/join',{token:invite.url.split('=')[1],email:'member@example.com',password:'m'});
  const uploaded=await fetch(base+'photos/upload',{method:'POST',headers:{cookie:admin.cookie,'Content-Type':'image/png'},body:await png()});assert.equal(uploaded.status,201);const photo=await uploaded.json();assert.equal(photo.kind,'upload');
  const invalid=await fetch(base+'photos/upload',{method:'POST',headers:{cookie:admin.cookie,'Content-Type':'image/png'},body:'<svg xmlns="http://www.w3.org/2000/svg"/>'});assert.equal(invalid.status,400);
  const ownBottle={name:'Bottle',member_id:member.id,rating:'Favorite',remaining:100,photo_id:photo.id};assert.equal((await post('bottles',ownBottle,joined.cookie)).status,400);
  const ownUpload=await fetch(base+'photos/upload',{method:'POST',headers:{cookie:joined.cookie},body:await png()});const own=await ownUpload.json();assert.equal((await post('bottles',{...ownBottle,photo_id:own.id},joined.cookie)).status,201);
  assert.equal((await post('bottles',{...ownBottle,photo_id:'nonexistent'},admin.cookie)).status,400);
 }finally{await new Promise(r=>server.close(r));app.close();}
});
test('photo search gracefully handles no results and provider failures',async()=>{
 for(const response of [Response.json({query:{pages:{}}}),new Response('',{status:429}),new Response('invalid')]){
  const app=createApp(':memory:',{photoFetch:async()=>response}),server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/`;
  try{const admin=await fetch(base+'auth/setup',{method:'POST',body:JSON.stringify({name:'Host',email:'host@example.com',password:'h'})});const cookie=admin.headers.get('set-cookie').split(';')[0];const res=await fetch(base+'photos/search',{method:'POST',headers:{cookie},body:JSON.stringify({query:'Bourbon'})});if(response.status===200&&response.headers.get('content-type')?.includes('json')){assert.equal(res.status,200);assert.deepEqual((await res.json()).results,[]);}else assert.equal(res.status,400);
  }finally{await new Promise(r=>server.close(r));app.close();}
 }
});
