import {readFileSync,mkdirSync,existsSync,writeFileSync,renameSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReviewCatalog} from '../review-catalog.js';
try{
  const args=process.argv.slice(2),source=args.find(a=>a!=='--replace');
  if(!source)throw new Error('Usage: npm run import:reviews -- /path/to/reviews.csv [--replace]');
  const bytes=readFileSync(source);if(bytes.length>50*1024*1024)throw new Error('CSV exceeds 50 MB.');
  const result=buildReviewCatalog(bytes.toString('utf8'));
  const target=fileURLToPath(new URL('../data/catalog/reviews.json',import.meta.url));
  if(existsSync(target)&&!args.includes('--replace'))throw new Error('Review catalog already installed. Back it up before using --replace.');
  mkdirSync(dirname(target),{recursive:true});const temporary=target+'.'+process.pid+'.tmp';writeFileSync(temporary,JSON.stringify(result));renameSync(temporary,target);
  console.log(`Created ${result.bottles.length} bottle/release candidates from ${result.source_rows} review rows (${result.skipped_rows} skipped). No scores or reviewer names imported. Restart the app.`);
}catch(error){console.error(error.message);process.exitCode=1;}
