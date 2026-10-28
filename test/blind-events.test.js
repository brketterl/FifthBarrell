import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createApp} from '../server.js';
test('blind events accept anonymous samples, reveal identities transactionally and preserve tasting scores',async()=>{
  const app=createApp(':memory:'),server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const call=async(path,method='GET',data)=>{const res=await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});return{status:res.status,data:await res.json()};};
  try{
    const member=(await call('members','POST',{name:'Blind taster'})).data;
    const event=(await call('events','POST',{name:'Blind society night',event_date:'2026-10-28',tasting_mode:'blind'})).data;
    assert.equal((await call('events/'+event.id+'/pours','POST',{whiskey_name:'Sample A',distillery:'Secret distillery'})).status,400);
    const pour=(await call('events/'+event.id+'/pours','POST',{whiskey_name:'Sample A'})).data;
    assert.equal((await call('events/'+event.id+'/pours','POST',{whiskey_name:'sample a'})).status,400);
    const result=await call('tastings','POST',{member_id:member.id,event_pour_id:pour.id,whiskey_name:'Injected identity',distillery:'Injected distillery',tasted_on:'2026-10-28',score:8.5,notes:'Sweet and spicy',flavors:{nose:{Vanilla:4}}});assert.equal(result.status,201);
    let state=(await call('state')).data;
    assert.equal(state.events[0].blind_mode,1);assert.equal(state.pours[0].whiskey_name,'Sample A');assert.equal(state.pours[0].revealed,0);assert.equal(state.pours[0].bottle_id,null);assert.equal(state.pours[0].catalog_id,null);assert.equal(state.tastings[0].whiskey_name,'Sample A');assert.equal(state.tastings[0].distillery,'');assert.equal(state.tastings[0].proof,null);
    assert.equal((await call('pours/'+pour.id+'/reveal','PUT',{whiskey_name:'Bourbon',proof:300})).status,400);state=(await call('state')).data;assert.equal(state.pours[0].revealed,0);
    const reveal=await call('pours/'+pour.id+'/reveal','PUT',{whiskey_name:'Revealed Bourbon',label:'Barrel Proof',proof:125,release:'C923'});assert.equal(reveal.status,200);
    state=(await call('state')).data;assert.equal(state.pours[0].revealed,1);assert.equal(state.pours[0].blind_label,'Sample A');assert.equal(state.pours[0].label,'Barrel Proof');assert.equal(state.tastings[0].whiskey_name,'Revealed Bourbon');assert.equal(state.tastings[0].score,8.5);assert.equal(state.tastings[0].notes,'Sweet and spicy');assert.equal(state.tastings[0].flavors.nose.Vanilla,4);assert.equal(state.tastings[0].release,'C923');
    assert.equal((await call('pours/'+pour.id+'/reveal','PUT',{whiskey_name:'Another identity'})).status,400);
    await call('events/'+event.id,'DELETE');state=(await call('state')).data;assert.equal(state.tastings[0].whiskey_name,'Revealed Bourbon');assert.equal(state.tastings[0].score,8.5);
  }finally{await new Promise(r=>server.close(r));app.close();}
});
