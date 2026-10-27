import { fileURLToPath } from 'node:url';
import { updateCatalog } from '../catalog-update.js';

try{
  const target=fileURLToPath(new URL('../data/catalog/barreldex.json',import.meta.url));
  const result=await updateCatalog({target});
  console.log(result.changed?`Downloaded and validated ${result.count} BarrelDex records. Restart the app to use the updated catalog.`:`Catalog is unchanged (${result.count} records).`);
  if(result.backup)console.log('Previous local catalog backed up to: '+result.backup);
  console.log('Cabinet bottles, purchase prices, and tasting records were not changed.');
}catch(error){
  console.error('Catalog update failed: '+error.message+(error.cause?.message?' ('+error.cause.message+')':''));
  console.error('The existing catalog is unchanged. Check Internet access and try again later.');
  process.exitCode=1;
}
