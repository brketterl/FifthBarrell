import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createApp} from '../server.js';
test('accounts, invitations, sessions, and member/host permissions',async()=>{
 const app=createApp(':memory:'),server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/`;
 async function request(route,method='GET',body,cookie=''){const res=await fetch(base+route,{method,headers:{'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
 try{
 const admin=await request('auth/setup','POST',{name:'Host',email:'host@example.com',password:'a secure host password'});assert.equal(admin.status,201);assert.match(admin.cookie,/fb_session=/);
 assert.equal((await request('state')).status,401);assert.equal((await request('auth/setup','POST',{email:'x@example.com',password:'another password'})).status,403);
 const member=(await request('members','POST',{name:'Taster'},admin.cookie)).data;
 const invite=(await request('auth/invite','POST',{member_id:member.id},admin.cookie)).data;
 const taster=await request('auth/join','POST',{email:'taster@example.com',password:'a secure member password',token:invite.url.split('=')[1]});assert.equal(taster.status,201);
 assert.equal((await request('auth/join','POST',{email:'again@example.com',password:'a secure member password',token:invite.url.split('=')[1]})).status,400);
 assert.equal((await request('members','POST',{name:'Intruder'},taster.cookie)).status,403);
 const b={name:'Bourbon',member_id:member.id,rating:'Favorite',remaining:100};
 assert.equal((await request('bottles','POST',{...b,member_id:1},taster.cookie)).status,403);assert.equal((await request('bottles','POST',b,taster.cookie)).status,201);
 const event=(await request('events','POST',{name:'Flight',event_date:'2026-11-08',tasting_mode:'blind'},admin.cookie)).data;
 assert.equal((await request(`events/${event.id}/pours`,'POST',{whiskey_name:'Sample A'},taster.cookie)).status,403);
 const pour=(await request(`events/${event.id}/pours`,'POST',{whiskey_name:'Sample A'},admin.cookie)).data;
 assert.equal((await request(`pours/${pour.id}/reveal`,'PUT',{whiskey_name:'Secret'},taster.cookie)).status,403);
 assert.equal((await request('auth/login','POST',{email:'taster@example.com',password:'wrong password'})).status,422);
 await request('auth/logout','POST',{},taster.cookie);assert.equal((await request('state','GET',null,taster.cookie)).status,401);
 }finally{await new Promise(r=>server.close(r));app.close();}
});

test('HTTPS proxy origin supports setup, login, invitations and writes while rejecting foreign origins',async()=>{
 const publicOrigin='https://society.example.com';
 const app=createApp(':memory:',{publicOrigin}),server=http.createServer(app.handler);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api/`;
 async function post(route,data,cookie='',origin=publicOrigin,extraHeaders={}){
  const res=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',origin,cookie,...extraHeaders},body:JSON.stringify(data)});
  return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')};
 }
 const account={name:'Host',email:'host@example.com',password:'a secure host password'};
 try{
  const spoofed=await post('auth/setup',account,'','https://foreign.example.com',{'X-Forwarded-Proto':'https','X-Forwarded-Host':'foreign.example.com'});
  assert.equal(spoofed.status,403);
  assert.equal((await post('auth/setup',account,'','null')).status,403);
  const admin=await post('auth/setup',account);assert.equal(admin.status,201);assert.match(admin.cookie,/; Secure/);
  const cookie=admin.cookie.split(';')[0];
  assert.equal((await post('members',{name:'Blocked'},cookie,'https://foreign.example.com')).status,403);
  assert.equal((await post('members',{name:'Wrong scheme'},cookie,'http://society.example.com')).status,403);
  const member=await post('members',{name:'Member'},cookie);assert.equal(member.status,201);
  const invitation=await post('auth/invite',{member_id:member.data.id},cookie);assert.equal(invitation.status,201);
  const joined=await post('auth/join',{email:'member@example.com',password:'another secure password',token:invitation.data.url.split('=')[1]});assert.equal(joined.status,201);assert.match(joined.cookie,/; Secure/);
  assert.equal((await post('bottles',{name:'My bourbon',member_id:member.data.id,rating:'Favorite',remaining:100},joined.cookie.split(';')[0])).status,201);
  assert.equal((await post('auth/login',account,'','https://foreign.example.com')).status,403);
  const login=await post('auth/login',account);assert.equal(login.status,200);assert.match(login.cookie,/; Secure/);
  assert.equal((await post('auth/logout',{},cookie)).status,200);
 }finally{await new Promise(r=>server.close(r));app.close();}
});


test('members choose password length; empty passwords are rejected and long passwords are not truncated',async()=>{
 const app=createApp(':memory:'),server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api/`;
 async function post(path,data,cookie=''){const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(data)});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
 try{
  const account={name:'Host',email:'host@example.com',password:'x'};
  assert.equal((await post('auth/setup',{...account,password:''})).status,400);
  const admin=await post('auth/setup',account);assert.equal(admin.status,201);
  assert.equal((await post('auth/login',account)).status,200);
  const member=await post('members',{name:'Member'},admin.cookie);
  const invitation=await post('auth/invite',{member_id:member.data.id},admin.cookie);
  const token=invitation.data.url.split('=')[1],password='a'.repeat(300)+'end';
  assert.equal((await post('auth/join',{token,email:'member@example.com',password:''})).status,400);
  assert.equal((await post('auth/join',{token,email:'member@example.com',password})).status,201);
  assert.equal((await post('auth/login',{email:'member@example.com',password})).status,200);
  assert.equal((await post('auth/login',{email:'member@example.com',password:'a'.repeat(300)+'wrong'})).status,422);
 }finally{await new Promise(r=>server.close(r));app.close();}
});

test('profile edits stay with the signed-in member and safely update credentials',async()=>{
 const app=createApp(':memory:'),server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api/`;
 async function request(path,data,cookie='',origin){const res=await fetch(base+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',cookie,...(origin?{origin}:{})},body:data?JSON.stringify(data):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
 try{
  assert.equal((await request('auth/profile',{name:'Nobody',email:'nobody@example.com'})).status,401);
  const admin=await request('auth/setup',{name:'Host',email:'host@example.com',password:'host'});
  const member=await request('members',{name:'Member'},admin.cookie);
  const invitation=await request('auth/invite',{member_id:member.data.id},admin.cookie);
  const joined=await request('auth/join',{token:invitation.data.url.split('=')[1],email:'member@example.com',password:'m'});
  const otherDevice=await request('auth/login',{email:'member@example.com',password:'m'});
  const bottle=await request('bottles',{name:'Keepsake',member_id:member.data.id,rating:'Favorite',remaining:100},joined.cookie);assert.equal(bottle.status,201);
  const own={name:'New Name',email:'member@example.com',member_id:1,id:1,role:'admin'};
  assert.equal((await request('auth/profile',own,joined.cookie,'https://foreign.example.com')).status,403);
  const renamed=await request('auth/profile',own,joined.cookie);assert.equal(renamed.status,200);assert.equal(renamed.data.user.role,'member');assert.equal(renamed.data.user.member_id,member.data.id);
  let state=(await request('state',null,joined.cookie)).data;assert.equal(state.members.find(m=>m.id===1).name,'Host');assert.equal(state.members.find(m=>m.id===member.data.id).name,'New Name');assert.equal(state.bottles.find(b=>b.id===bottle.data.id).member_id,member.data.id);
  const change={name:'Updated',email:'updated@example.com',new_password:'z'};
  assert.equal((await request('auth/profile',change,joined.cookie)).status,422);
  assert.equal((await request('auth/profile',{...change,current_password:'wrong'},joined.cookie)).status,422);
  assert.equal((await request('auth/profile',{...change,email:'bad',current_password:'m'},joined.cookie)).status,400);
  assert.equal((await request('auth/profile',{...change,email:'host@example.com',current_password:'m'},joined.cookie)).status,400);
  const unchanged=(await request('auth/session',null,joined.cookie)).data.user;assert.equal(unchanged.name,'New Name');assert.equal(unchanged.email,'member@example.com');
  const updated=await request('auth/profile',{...change,current_password:'m'},joined.cookie);assert.equal(updated.status,200);assert.equal(updated.data.user.email,'updated@example.com');assert.ok(updated.cookie);
  assert.equal((await request('state',null,joined.cookie)).status,401);assert.equal((await request('state',null,otherDevice.cookie)).status,401);assert.equal((await request('state',null,updated.cookie)).status,200);
  assert.equal((await request('auth/login',{email:'member@example.com',password:'m'})).status,422);
  assert.equal((await request('auth/login',{email:'updated@example.com',password:'m'})).status,422);
  assert.equal((await request('auth/login',{email:'updated@example.com',password:'z'})).status,200);
  const emailOnly=await request('auth/profile',{name:'Updated',email:'final@example.com',current_password:'z',new_password:''},updated.cookie);assert.equal(emailOnly.status,200);
  assert.equal((await request('auth/login',{email:'final@example.com',password:'z'})).status,200);
 }finally{await new Promise(r=>server.close(r));app.close();}
});
