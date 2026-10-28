import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildReviewCatalog,parseCSV} from '../review-catalog.js';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const header='BRAND,LABEL,EXPRESSION,RELEASE/BATCH,RELEASE YEAR,PROOF,AGE,SELECTED BY/FOR,BARREL,CLASS';
test('CSV import preserves batches and selections, stable IDs and ambiguous values without importing reviews',()=>{
  const rows=['Example,Barrel Proof,,C923,2023,133,12,,,BW-S','Example,Barrel Proof,,C923,2023,133,12,,,BW-S','Example,Barrel Proof,,B520,2020,127.2,12,,,BW-S','Example,Single Barrel,,1,2022-2024,100,6,"Shop, A",7,BW-S','Example,Single Barrel,,1,2022-2024,110,7,"Shop, A",7,BW-S','Example,Single Barrel,,01,2022-2024,100,6,"Shop, A",7,BW-S'];
  const result=buildReviewCatalog(header+'\r\n'+rows.join('\r\n'));
  assert.equal(result.source_rows,6);assert.equal(result.bottles.length,4);
  assert.equal(result.bottles.find(b=>b.release==='C923').label,'Barrel Proof');
  assert.equal(result.bottles.find(b=>b.release==='C923').expression,'');
  const ambiguous=result.bottles.find(b=>b.release==='1');assert.equal(ambiguous.proof,null);assert.equal(ambiguous.age_years,null);assert.deepEqual(ambiguous.proof_values,[100,110]);assert.equal(ambiguous.selection,'Shop, A');assert.equal(ambiguous.release_year,null);assert.equal(ambiguous.release_year_text,'2022-2024');
  const reverse=buildReviewCatalog(header+'\n'+[...rows].reverse().join('\n'));assert.deepEqual(result.bottles.map(b=>b.id).sort(),reverse.bottles.map(b=>b.id).sort());
  assert.ok(result.bottles.every(b=>!('REVIEWER' in b)&&!('score' in b)&&b.distillery===''));
  assert.equal(parseCSV(header+'\n"Example\nBrand",Standard,,,,90,4,"A ""Quoted"" Shop",,BW-S')[0].BRAND,'Example\nBrand');
  assert.throws(()=>parseCSV(header+'\n"Broken'),/Unclosed/);assert.throws(()=>buildReviewCatalog(header+'\nExample,Standard,,,,500,4,,,BW-S'),/Invalid PROOF/);
});
test('combined search keeps BarrelDex, filters sources, pages results, and matches release identifiers',()=>{
  const dir=mkdtempSync(join(tmpdir(),'society-review-search-'));
  try{
    for(const name of ['catalog.js','catalog-import.js'])copyFileSync(new URL('../'+name,import.meta.url),join(dir,name));
    writeFileSync(join(dir,'package.json'),'{"type":"module"}');mkdirSync(join(dir,'catalog-data'));copyFileSync(new URL('../catalog-data/barreldex.json',import.meta.url),join(dir,'catalog-data/barreldex.json'));mkdirSync(join(dir,'data/catalog'),{recursive:true});
    const csv=header+'\n'+Array.from({length:30},(_,i)=>`Example,Flight Bourbon,,C${i},2023,100,8,,,BW-S`).join('\n');writeFileSync(join(dir,'data/catalog/reviews.json'),JSON.stringify(buildReviewCatalog(csv)));
    const result=spawnSync(process.execPath,['--input-type=module','-e',`import{searchCatalog}from'./catalog.js';console.log(JSON.stringify([searchCatalog('1792',{source:'barreldex'}),searchCatalog('Example',{source:'reviews'}),searchCatalog('Example',{source:'reviews',offset:25}),searchCatalog('Example C29')]))`],{cwd:dir,encoding:'utf8',env:{...process.env,REVIEW_CATALOG_PATH:''}});
    assert.equal(result.status,0,result.stderr);const [base,first,last,batch]=JSON.parse(result.stdout);assert.equal(base.counts.barreldex,254);assert.ok(base.results.length);assert.equal(first.matched,30);assert.equal(first.results.length,25);assert.equal(first.next_offset,25);assert.equal(last.results.length,5);assert.equal(last.next_offset,null);assert.equal(batch.results[0].release,'C29');assert.equal(first.results[0].license,null);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('fresh checkout can search bundled review releases without a local CSV import',()=>{
  const dir=mkdtempSync(join(tmpdir(),'society-bundled-reviews-'));
  try{
    for(const name of ['catalog.js','catalog-import.js'])copyFileSync(new URL('../'+name,import.meta.url),join(dir,name));
    writeFileSync(join(dir,'package.json'),'{"type":"module"}');mkdirSync(join(dir,'catalog-data'));
    for(const name of ['barreldex.json','reviews.json'])copyFileSync(new URL('../catalog-data/'+name,import.meta.url),join(dir,'catalog-data',name));
    const result=spawnSync(process.execPath,['--input-type=module','-e',`import{searchCatalog}from'./catalog.js';console.log(JSON.stringify(searchCatalog('Elijah Craig C923',{source:'reviews'})))`],{cwd:dir,encoding:'utf8',env:{...process.env,REVIEW_CATALOG_PATH:''}});
    assert.equal(result.status,0,result.stderr);const data=JSON.parse(result.stdout);assert.equal(data.counts.barreldex,254);assert.equal(data.counts.reviews,17485);assert.equal(data.total,17739);assert.equal(data.matched,1);assert.equal(data.results[0].proof,133);assert.equal(data.results[0].release,'BATCH: C923');assert.equal(data.results[0].license,null);
    const saved=JSON.parse(readFileSync(new URL('../catalog-data/reviews.json',import.meta.url),'utf8'));
    assert.ok(saved.bottles.every(b=>!('score' in b)&&!('REVIEWER' in b)&&!('LINK' in b)));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
