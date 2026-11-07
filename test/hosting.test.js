import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server.js';

test('hosted access protects pages and mutations while health checks remain available', async () => {
  assert.throws(() => createApp(':memory:', {requireAuth:true, accessPassword:''}), /ACCESS_PASSWORD/);
  const app = createApp(':memory:', {requireAuth:true, accessPassword:'test-password'});
  const server = http.createServer(app.handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/', '/app.js', '/api/state']) {
      const response = await fetch(url + path);
      assert.equal(response.status, 401);
      assert.match(response.headers.get('www-authenticate'), /Basic/);
    }
    assert.equal((await fetch(url + '/api/members', {method:'POST', body:JSON.stringify({name:'Intruder'})})).status, 401);
    assert.equal((await fetch(url + '/api/state', {headers:{Authorization:'Basic ' + Buffer.from('society:wrong').toString('base64')}})).status, 401);
    assert.equal((await fetch(url + '/health')).status, 200);
    const response = await fetch(url + '/api/state', {headers:{Authorization:'Basic ' + Buffer.from('society:test-password').toString('base64')}});
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).members, []);
  } finally {
    await new Promise(resolve => server.close(resolve));
    app.close();
  }
});

test('shared setup gate retires after onboarding; login failures never trigger a browser challenge',async()=>{
 const app=createApp(':memory:',{requireAuth:true,accessPassword:'setup-only-password'});
 const server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const credentials={name:'Host',email:'host@example.com',password:'my member password'};
 const basic='Basic '+Buffer.from('society:setup-only-password').toString('base64');
 const post=(path,data,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 try{
  const blocked=await post('/api/auth/setup',credentials);assert.equal(blocked.status,401);assert.match(blocked.headers.get('www-authenticate'),/Basic/);
  const setup=await post('/api/auth/setup',credentials,{Authorization:basic});assert.equal(setup.status,201);
  const cookie=setup.headers.get('set-cookie').split(';')[0];
  for(const path of ['/','/app.js','/api/auth/session']){const response=await fetch(base+path);assert.equal(response.status,200);assert.equal(response.headers.get('www-authenticate'),null);}
  const logout=await post('/api/auth/logout',{}, {cookie});assert.equal(logout.status,200);
  const denied=await fetch(base+'/api/state',{headers:{cookie}});assert.equal(denied.status,401);assert.equal(denied.headers.get('www-authenticate'),null);
  for(const headers of [{},{Authorization:basic},{Authorization:'Basic '+Buffer.from('society:outdated-password').toString('base64')}]){
   const failed=await post('/api/auth/login',{...credentials,password:'incorrect password'},headers);assert.equal(failed.status,422);assert.equal(failed.headers.get('www-authenticate'),null);assert.equal((await failed.json()).error,'Email or password is incorrect.');
   const login=await post('/api/auth/login',credentials,headers);assert.equal(login.status,200);assert.equal(login.headers.get('www-authenticate'),null);
   const state=await fetch(base+'/api/state',{headers:{cookie:login.headers.get('set-cookie').split(';')[0]}});assert.equal(state.status,200);
  }
 }finally{await new Promise(r=>server.close(r));app.close();}
});
