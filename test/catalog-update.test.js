import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {updateCatalog,catalogUrl} from '../catalog-update.js';

test('download updates atomically, backs up, skips unchanged data, and preserves catalog on failures',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'fifth-barrel-download-')),target=join(dir,'barreldex.json');
  const old=[{slug:'old',name:'Old Whiskey',proof:90}],latest=[{slug:'new',name:'New Whiskey',proof:100}];
  const fetchJSON=data=>async(url,options)=>{
    assert.equal(url,catalogUrl);assert.equal(options.redirect,'error');assert.equal(options.headers.Accept,'application/json');assert.ok(options.signal);
    return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
  };
  try{
    writeFileSync(target,JSON.stringify(old));
    const updated=await updateCatalog({target,fetchImpl:fetchJSON(latest)});
    assert.equal(updated.changed,true);assert.deepEqual(JSON.parse(readFileSync(target,'utf8')),latest);assert.deepEqual(JSON.parse(readFileSync(updated.backup,'utf8')),old);
    const unchanged=await updateCatalog({target,fetchImpl:fetchJSON(latest)});assert.equal(unchanged.changed,false);assert.equal(readdirSync(join(dir,'backups')).length,1);
    const before=readFileSync(target,'utf8');
    for(const fetchImpl of [async()=>new Response('Denied',{status:403}),fetchJSON([]),fetchJSON([{slug:'bad',name:'Bad',proof:300}]),async()=>new Response('<html>error</html>',{headers:{'Content-Type':'text/html'}}),async()=>new Response('{',{headers:{'Content-Type':'application/json'}}),async()=>{throw new Error('Network unavailable');},async()=>new Response('{}',{headers:{'Content-Type':'application/json','Content-Length':String(11*1024*1024)}})]){
      await assert.rejects(updateCatalog({target,fetchImpl}));assert.equal(readFileSync(target,'utf8'),before);assert.equal(existsSync(target+'.update.lock'),false);
    }
    writeFileSync(target+'.update.lock','');await assert.rejects(updateCatalog({target,fetchImpl:fetchJSON(latest)}),/already running/);rmSync(target+'.update.lock');
    const fresh=join(dir,'fresh','barreldex.json');const installed=await updateCatalog({target:fresh,fetchImpl:fetchJSON(latest)});assert.equal(installed.backup,null);assert.deepEqual(JSON.parse(readFileSync(fresh,'utf8')),latest);
    assert.ok(!readdirSync(dir).some(name=>name.endsWith('.tmp')));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
