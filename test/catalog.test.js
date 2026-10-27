import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('offline import validates before replacing data; lookup preserves unknowns, ages and dated prices',()=>{
  const dir=mkdtempSync(join(tmpdir(),'fifth-barrel-import-'));
  const run=(...args)=>spawnSync(process.execPath,args,{cwd:dir,encoding:'utf8'});
  try{
    mkdirSync(join(dir,'scripts'));
    for(const file of ['catalog.js','catalog-import.js','scripts/import-catalog.js'])copyFileSync(new URL('../'+file,import.meta.url),join(dir,file));
    writeFileSync(join(dir,'package.json'),' {"type":"module"}');
    let result=run('--input-type=module','-e',"import {searchCatalog} from './catalog.js'; console.log(JSON.stringify(searchCatalog('eagle')))");
    assert.equal(result.status,0);assert.equal(JSON.parse(result.stdout).total,12);
    mkdirSync(join(dir,'catalog-data'));copyFileSync(new URL('../catalog-data/barreldex.json',import.meta.url),join(dir,'catalog-data/barreldex.json'));
    result=run('--input-type=module','-e',"import {searchCatalog} from './catalog.js'; console.log(JSON.stringify(searchCatalog('1792 full proof')))");
    assert.equal(result.status,0,result.stderr);const bundled=JSON.parse(result.stdout);assert.equal(bundled.total,254);assert.equal(bundled.results[0].name,'1792 Full Proof');assert.equal(bundled.results[0].proof,125);assert.equal(bundled.license,'https://creativecommons.org/licenses/by/4.0/');
    const records=[{slug:'test-whiskey',name:'Test Whiskey',supplier:'Test Supplier',distillery:null,proof:100,age_years:12,size_ml:750,prices:[{amount_usd:49.95,source:'Example retail',state:'NC',retrieved:'2026-10-21',note:'Not MSRP'}],flags:['Distillery unverified'],sources:[],custom_field:'Retain source fields'}];
    writeFileSync(join(dir,'input.json'),JSON.stringify(records));
    result=run('scripts/import-catalog.js','input.json');assert.equal(result.status,0,result.stderr);
    const installed=join(dir,'data/catalog/barreldex.json'),before=readFileSync(installed,'utf8');assert.equal(JSON.parse(before)[0].custom_field,'Retain source fields');
    result=run('--input-type=module','-e',"import {searchCatalog} from './catalog.js'; console.log(JSON.stringify(searchCatalog('test supplier')))");
    assert.equal(result.status,0,result.stderr);const data=JSON.parse(result.stdout);assert.equal(data.total,1);assert.equal(data.matched,1);
    const b=data.results[0];assert.equal(b.id,'barreldex:test-whiskey');assert.equal(b.distillery,'');assert.equal(b.age_years,12);assert.equal(b.year,undefined);assert.equal(b.price,undefined);assert.equal(b.prices[0].retrieved,'2026-10-21');
    assert.equal(run('scripts/import-catalog.js','input.json').status,1);
    writeFileSync(join(dir,'bad.json'),JSON.stringify([...records,...records]));assert.equal(run('scripts/import-catalog.js','bad.json','--replace').status,1);assert.equal(readFileSync(installed,'utf8'),before);
    writeFileSync(join(dir,'bad.json'),JSON.stringify([{...records[0],proof:201}]));assert.equal(run('scripts/import-catalog.js','bad.json','--replace').status,1);assert.equal(readFileSync(installed,'utf8'),before);
    result=run('scripts/import-catalog.js','input.json','--replace');assert.equal(result.status,0,result.stderr);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
