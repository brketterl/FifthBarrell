export function normalizeBarcode(value) {
  if(typeof value!=='string')throw Error('Enter a UPC-A, EAN-8, EAN-13, or GTIN-14 barcode.');
  const code=value.replace(/[\s-]/g,'');
  if(!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code))throw Error('Use the 8, 12, 13, or 14 digits printed below the barcode.');
  let sum=0;for(let i=code.length-2,weight=3;i>=0;i--,weight=weight===3?1:3)sum+=Number(code[i])*weight;
  if((10-sum%10)%10!==Number(code.at(-1)))throw Error('That barcode has an invalid check digit. Check the digits or scan again.');
  return code.padStart(14,'0');
}
export function setupBarcodeLookup(db,fetcher=fetch){
  db.exec('CREATE TABLE IF NOT EXISTS barcode_usage(day TEXT PRIMARY KEY,count INTEGER NOT NULL,last_request INTEGER NOT NULL)');
  let busy=false;
  return async value=>{
    const barcode=normalizeBarcode(value);
    const known=db.prepare('SELECT name FROM bottles WHERE barcode=? ORDER BY id DESC LIMIT 1').get(barcode);
    if(known)return {barcode,source:'Society cabinet',items:[{title:known.name,brand:''}]};
    if(busy)throw Error('Another barcode lookup is running. Try again in a few seconds.');
    const now=Date.now(),day=new Date(now).toISOString().slice(0,10),usage=db.prepare('SELECT * FROM barcode_usage WHERE day=?').get(day);
    if(usage?.count>=90)throw Error('Today’s shared barcode lookup allowance is used. Try label search or enter the bottle manually.');
    if(usage&&now-usage.last_request<11000)throw Error('Please wait a few seconds between barcode lookups, or use label search.');
    db.prepare('INSERT INTO barcode_usage VALUES (?,1,?) ON CONFLICT(day) DO UPDATE SET count=count+1,last_request=excluded.last_request').run(day,now);
    busy=true;
    try{
      const response=await fetcher('https://api.upcitemdb.com/prod/trial/lookup?upc='+barcode,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});
      if(response.status===429)throw Error('The barcode provider’s limit has been reached. Try label search or enter the bottle manually.');
      if(!response.ok)throw Error('Barcode lookup is unavailable. Try label search or enter the bottle manually.');
      if(Number(response.headers.get('content-length'))>1000000)throw Error('The barcode provider returned an oversized response.');
      const reader=response.body.getReader();let size=0;const chunks=[];
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000){await reader.cancel();throw Error('The barcode provider returned an oversized response.');}chunks.push(Buffer.from(value));}
      const data=JSON.parse(Buffer.concat(chunks).toString());
      if(data.code&&data.code!=='OK')throw Error('Barcode lookup is unavailable. Try label search or enter the bottle manually.');
      if(!Array.isArray(data.items))throw Error('The barcode provider returned an unexpected response.');
      const items=data.items.filter(i=>typeof i.title==='string'&&i.title.trim()).slice(0,5).map(i=>({title:i.title.trim().slice(0,250),brand:typeof i.brand==='string'?i.brand.trim().slice(0,250):''}));
      return {barcode,source:'UPCitemdb',url:'https://www.upcitemdb.com',items};
    }catch(e){if(e.name==='TimeoutError'||e.name==='AbortError')throw Error('Barcode lookup timed out. Try again or use label search.');if(e instanceof SyntaxError||e instanceof TypeError)throw Error('Barcode lookup could not connect. Try label search or enter the bottle manually.');throw e;}
    finally{busy=false;}
  };
}
