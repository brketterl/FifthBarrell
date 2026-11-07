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
 assert.equal((await request('auth/login','POST',{email:'taster@example.com',password:'wrong password'})).status,401);
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
