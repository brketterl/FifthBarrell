import { mkdirSync, readFileSync, writeFileSync, renameSync, copyFileSync, existsSync, openSync, closeSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateCatalog } from './catalog-import.js';

export const catalogUrl='https://barreldex.com/data/bottles.json';
const maxBytes=10*1024*1024;

export async function updateCatalog({target,fetchImpl=fetch,timeoutMs=30000}={}) {
  if(!target)throw new Error('A catalog destination is required.');
  mkdirSync(dirname(target),{recursive:true});
  const lock=target+'.update.lock';
  let handle;
  try{handle=openSync(lock,'wx');}catch(error){if(error.code==='EEXIST')throw new Error('A catalog update is already running.');throw error;}
  const temporary=target+'.'+randomUUID()+'.tmp';
  try{
    const response=await fetchImpl(catalogUrl,{
      headers:{Accept:'application/json','User-Agent':'FifthBarrelSociety/0.1 (catalog download)'},
      redirect:'error',signal:AbortSignal.timeout(timeoutMs)
    });
    if(!response.ok)throw new Error(`BarrelDex returned HTTP ${response.status}.`);
    const type=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if(type && type!=='application/json'&&!type.endsWith('+json'))throw new Error('BarrelDex did not return JSON.');
    if(Number(response.headers.get('content-length'))>maxBytes)throw new Error('The download exceeds the 10 MB limit.');
    if(!response.body)throw new Error('BarrelDex returned an empty response.');
    const chunks=[];let bytes=0;
    for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>maxBytes)throw new Error('The download exceeds the 10 MB limit.');chunks.push(Buffer.from(chunk));}
    const records=validateCatalog(JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/,'')));
    const contents=JSON.stringify(records,null,2)+'\n';
    if(existsSync(target)&&readFileSync(target,'utf8')===contents)return {count:records.length,changed:false,source:catalogUrl};
    writeFileSync(temporary,contents,{flag:'wx'});
    let backup=null;
    if(existsSync(target)) {
      const backups=join(dirname(target),'backups');mkdirSync(backups,{recursive:true});
      backup=join(backups,'barreldex-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.json');
      copyFileSync(target,backup);
    }
    renameSync(temporary,target);
    return {count:records.length,changed:true,backup,source:catalogUrl};
  }finally{
    rmSync(temporary,{force:true});closeSync(handle);rmSync(lock,{force:true});
  }
}
