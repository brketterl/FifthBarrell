import { readFileSync, mkdirSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalog } from '../catalog-import.js';

try {
  const args=process.argv.slice(2),force=args.includes('--replace'),source=args.find(a=>a!=='--replace');
  if(!source)throw new Error('Usage: npm run import:catalog -- /path/to/bottles.json [--replace]');
  const input=readFileSync(resolve(source));
  if(input.length>10*1024*1024)throw new Error('Catalog must be smaller than 10 MB.');
  const records=validateCatalog(JSON.parse(input.toString('utf8').replace(/^\uFEFF/,'')));
  const target=fileURLToPath(new URL('../data/catalog/barreldex.json',import.meta.url));
  if(existsSync(target)&&!force)throw new Error('A catalog is already installed. Back it up, then use --replace to update it.');
  mkdirSync(dirname(target),{recursive:true});
  const temporary=target+'.'+process.pid+'.tmp';writeFileSync(temporary,JSON.stringify(records,null,2)+'\n');renameSync(temporary,target);
  console.log(`Imported ${records.length} BarrelDex records. Restart the server to use the catalog. Cabinet and tasting data were not changed.`);
}catch(error){console.error(error.message);process.exitCode=1;}
