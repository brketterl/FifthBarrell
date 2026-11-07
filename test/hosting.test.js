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
