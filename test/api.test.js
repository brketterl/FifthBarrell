import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.js';

test('society lifecycle, bottle validation, persistence, lookup, and member removal', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'fifth-barrel-test-')); const path=join(dir,'test.sqlite');
  let app=createApp(path); let server=http.createServer(app.handler);
  async function start(){ await new Promise(r=>server.listen(0,'127.0.0.1',r)); }
  async function stop(){ await new Promise(r=>server.close(r)); app.close(); }
  const request=async(route,method='GET',data)=>{
    const res=await fetch(`http://127.0.0.1:${server.address().port}/api/${route}`,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
    return {status:res.status,data:await res.json()};
  };
  try {
    await start(); const empty=(await request('state')).data; assert.deepEqual(empty.members,[]); assert.deepEqual(empty.bottles,[]); assert.deepEqual(empty.tastings,[]); assert.deepEqual(empty.events,[]);
    assert.equal((await request('members','POST',{name:'  '})).status,400);
    const first=(await request('members','POST',{name:'Alex'})).data;
    const second=(await request('members','POST',{name:'Jordan'})).data;
    const bottle={name:'Eagle Rare 10 Year',member_id:first.id,distillery:'Buffalo Trace',proof:90,year:2026,rating:'Favorite',remaining:75,price:49.95,bourbon_notes:'Oak & vanilla',member_notes:'Shared with friends.'};
    const saved=await request('bottles','POST',bottle); assert.equal(saved.status,201);
    assert.equal((await request('bottles','POST',{...bottle,remaining:101})).status,400);
    assert.equal((await request('bottles','POST',{...bottle,member_id:999})).status,400);
    assert.equal((await request('bottles','POST',{...bottle,proof:-1})).status,400);
    assert.equal((await request('bottles','POST',{...bottle,rating:'Unknown'})).status,400);
    assert.equal((await request('bottles','POST',{...bottle,year:2026.5})).status,400);
    const another=(await request('bottles','POST',{...bottle,member_id:second.id,price:'',year:'',proof:''})).data;
    assert.equal(another.price,null);
    assert.equal((await request('bottles/'+saved.data.id,'PUT',{...bottle,remaining:25,member_notes:'Updated notes.'})).status,200);
    let state=(await request('state')).data; assert.equal(state.bottles.length,2);
    assert.equal(state.bottles.find(b=>b.id===saved.data.id).remaining,25);
    await stop(); app=createApp(path); server=http.createServer(app.handler); await start();
    state=(await request('state')).data; assert.equal(state.bottles.length,2); assert.equal(state.members.length,2);
    assert.equal(state.bottles.find(b=>b.id===saved.data.id).member_notes,'Updated notes.');
    const lookup=(await request('catalog?q=eagle')).data; assert.match(lookup.results[0].name,/^Eagle Rare 10/); assert.ok(lookup.total>=12);assert.ok(lookup.results[0].id);
    assert.equal((await request('members/'+first.id,'DELETE')).status,200);
    state=(await request('state')).data; assert.equal(state.bottles.length,1); assert.equal(state.bottles[0].member_id,second.id);
    assert.equal((await request('bottles/'+another.id,'DELETE')).status,200);
    assert.equal((await request('bottles/'+another.id,'DELETE')).status,404);
    assert.equal((await request('state')).data.bottles.length,0);
    const home=await fetch(`http://127.0.0.1:${server.address().port}/`); assert.equal(home.status,200); assert.match(await home.text(),/Fifth Barrel Society/);
    assert.match(home.headers.get('content-security-policy'),/default-src 'self'/);
  } finally { await stop(); rmSync(dir,{recursive:true,force:true}); }
});

test('shared flights preserve independent tastings, validate scores, and survive inventory removal',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'fifth-barrel-events-')),path=join(dir,'society.sqlite');
  let app=createApp(path),server=http.createServer(app.handler);
  const start=()=>new Promise(r=>server.listen(0,'127.0.0.1',r));
  const stop=async()=>{await new Promise(r=>server.close(r));app.close();};
  const request=async(route,method='GET',data)=>{
    const res=await fetch(`http://127.0.0.1:${server.address().port}/api/${route}`,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
    return {status:res.status,data:await res.json()};
  };
  try{
    await start();
    const alex=(await request('members','POST',{name:'Alex'})).data,jordan=(await request('members','POST',{name:'Jordan'})).data;
    const b=(await request('bottles','POST',{name:'Shared bourbon',label:'Single Barrel',expression:'Rye',distillery:'Society Distillery',member_id:alex.id,proof:100,year:2026,rating:'Favorite',remaining:80})).data;
    assert.equal((await request('events','POST',{name:'Invalid date',event_date:'2026-02-30'})).status,400);
    const event=(await request('events','POST',{name:'Friday flight',event_date:'2026-10-27',location:'The table'})).data;
    const pour=(await request('events/'+event.id+'/pours','POST',{whiskey_name:'Ignored in favor of bottle label',bottle_id:b.id})).data;
    const manual=(await request('events/'+event.id+'/pours','POST',{whiskey_name:'Outside the cabinet',release:'C923',proof:133})).data;
    assert.equal((await request('events/'+event.id+'/pours','POST',{whiskey_name:'Bad proof',proof:201})).status,400);
    const tasting={member_id:alex.id,bottle_id:b.id,event_pour_id:pour.id,whiskey_name:'Shared bourbon',tasted_on:'2026-10-27',score:8.5,nose_notes:'Vanilla',flavors:{nose:{Vanilla:4},palate:{Sweetness:0}}};
    const first=await request('tastings','POST',tasting);assert.equal(first.status,201);
    assert.equal((await request('tastings','POST',tasting)).status,400);
    const second=await request('tastings','POST',{...tasting,member_id:jordan.id,score:7,flavors:{nose:{Vanilla:2}}});assert.equal(second.status,201);
    assert.equal((await request('tastings','POST',{...tasting,event_pour_id:manual.id,score:11})).status,400);
    assert.equal((await request('tastings','POST',{...tasting,event_pour_id:manual.id,flavors:{nose:{Vanilla:6}}})).status,400);
    assert.equal((await request('tastings','POST',{...tasting,event_pour_id:manual.id,flavors:{nose:{Fake:2}}})).status,400);
    assert.equal((await request('tastings','POST',{...tasting,event_pour_id:manual.id,tasted_on:'2026-02-30'})).status,400);
    assert.equal((await request('tastings/'+first.data.id,'PUT',{...tasting,score:9})).status,200);
    let state=(await request('state')).data;assert.equal(state.bottles[0].remaining,80);assert.equal(state.tastings.length,2);
    assert.equal(state.tastings.find(t=>t.id===first.data.id).flavors.palate.Sweetness,0);
    assert.equal(state.tastings.find(t=>t.id===second.data.id).flavors.palate,undefined);
    await stop();app=createApp(path);server=http.createServer(app.handler);await start();
    state=(await request('state')).data;assert.equal(state.events.length,1);assert.equal(state.pours.length,2);assert.equal(state.tastings.length,2);assert.equal(state.pours[0].label,'Single Barrel');assert.equal(state.pours[0].expression,'Rye');
    await request('bottles/'+b.id,'DELETE');state=(await request('state')).data;
    assert.equal(state.tastings.length,2);assert.equal(state.tastings[0].bottle_id,null);assert.equal(state.pours[0].whiskey_name,'Shared bourbon');
    await request('events/'+event.id,'DELETE');state=(await request('state')).data;
    assert.equal(state.pours.length,0);assert.equal(state.tastings.length,2);assert.equal(state.tastings[0].event_pour_id,null);
    assert.equal((await request('tastings/'+first.data.id,'PUT',{...tasting,bottle_id:null,event_pour_id:null,score:9.5})).status,200);
    await request('members/'+alex.id,'DELETE');state=(await request('state')).data;assert.equal(state.tastings.length,1);assert.equal(state.tastings[0].member_id,jordan.id);
    assert.equal((await request('tastings/'+second.data.id,'DELETE')).status,200);
    assert.equal((await request('tastings/'+second.data.id,'DELETE')).status,404);
  }finally{await stop();rmSync(dir,{recursive:true,force:true});}
});
