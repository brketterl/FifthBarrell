export function validateCatalog(data) {
  if (!Array.isArray(data)||!data.length||data.length>10000) throw new Error('Expected a JSON array of 1–10,000 bottle records.');
  const ids=new Set();
  for (const [index,bottle] of data.entries()) {
    if (!bottle||typeof bottle!=='object'||Array.isArray(bottle)) throw new Error(`Invalid bottle at row ${index+1}.`);
    for (const key of ['slug','name']) if(typeof bottle[key]!=='string'||!bottle[key].trim()||bottle[key].length>250) throw new Error(`Missing or invalid ${key} at row ${index+1}.`);
    if(ids.has(bottle.slug))throw new Error(`Duplicate catalog ID: ${bottle.slug}`);
    ids.add(bottle.slug);
    for(const [key,min,max] of [['proof',0,200],['age_years',0,200],['size_ml',1,100000]]) {
      if(bottle[key]!=null&&(typeof bottle[key]!=='number'||!Number.isFinite(bottle[key])||bottle[key]<min||bottle[key]>max)) throw new Error(`Invalid ${key} at row ${index+1}.`);
    }
    for(const key of ['distillery','supplier','category','last_verified'])if(bottle[key]!=null&&typeof bottle[key]!=='string')throw new Error(`Invalid ${key} at row ${index+1}.`);
    for(const key of ['prices','sources','flags'])if(bottle[key]!=null&&!Array.isArray(bottle[key]))throw new Error(`Invalid ${key} at row ${index+1}.`);
    for(const p of bottle.prices??[])if(!p||typeof p!=='object'||typeof p.amount_usd!=='number'||!Number.isFinite(p.amount_usd)||p.amount_usd<0)throw new Error(`Invalid retail price at row ${index+1}.`);
  }
  return data;
}
