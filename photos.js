import {randomBytes,randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import sharp from 'sharp';
const maxBytes=6*1024*1024;
const agent='FifthBarrelSociety/1.0 (https://github.com/brketterl/FifthBarrell)';
const text=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|quot|lt|gt|#39);/g,s=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&lt;':'<','&gt;':'>','&#39;':"'"}[s])).replace(/\s+/g,' ').trim().slice(0,500);
const trusted=(value,hosts)=>{try{const url=new URL(value);return url.protocol==='https:'&&hosts.includes(url.hostname)&&!url.username&&!url.password&&!url.port?url.href:null;}catch{return null;}};
export async function readPhotoBytes(stream,limit=maxBytes){
 let size=0;const chunks=[];for await(const chunk of stream){size+=chunk.length;if(size>limit)throw Error('Choose a photo smaller than 6 MB.');chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks);
}
async function encodePhoto(input){
 if(!input.length||input.length>maxBytes)throw Error('Choose a photo smaller than 6 MB.');
 try{const image=sharp(input,{limitInputPixels:25000000,animated:false});const meta=await image.metadata();if(!['jpeg','png','webp','avif','heif'].includes(meta.format))throw Error();return await image.rotate().resize(1200,1200,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();}
 catch{throw Error('This image could not be read. Try a JPG, PNG, or WebP photo.');}
}
export function setupPhotos(db,fetcher=fetch){
 db.exec(`CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY,member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,data BLOB NOT NULL,title TEXT NOT NULL,artist TEXT NOT NULL,source_url TEXT NOT NULL,license TEXT NOT NULL,license_url TEXT NOT NULL,kind TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
 const secret=randomBytes(32),cache=new Map(),pending=new Map();
 const sign=data=>{const value=Buffer.from(JSON.stringify({...data,expires:Date.now()+1200000})).toString('base64url');return value+'.'+createHmac('sha256',secret).update(value).digest('base64url');};
 function verify(token){
  if(typeof token!=='string'||token.length>10000)throw Error('Select a photo from a fresh search.');
  const [value,signature,...extra]=token.split('.');const expected=createHmac('sha256',secret).update(value||'').digest('base64url');
  if(extra.length||!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw Error('Select a photo from a fresh search.');
  let data;try{data=JSON.parse(Buffer.from(value,'base64url'));}catch{throw Error('Select a photo from a fresh search.');}
  if(data.expires<Date.now())throw Error('Photo search expired. Search again to select this photo.');return data;
 }
 async function remote(url,limit){
  const response=await fetcher(url,{headers:{'User-Agent':agent,Accept:'application/json,image/*'},signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok)throw Error(response.status===429?'Image search is busy. Try again shortly, or upload your own photo.':'The image source is unavailable. Try again or upload your own photo.');
  if(Number(response.headers.get('content-length'))>limit)throw Error('The image source returned too much data. Try another photo.');
  return readPhotoBytes(response.body,limit);
 }
 function info(row){return row?{id:row.id,url:'/api/photos/'+row.id,title:row.title,artist:row.artist,source_url:row.source_url,license:row.license,license_url:row.license_url,kind:row.kind,changes:'Resized and converted to WebP'}:null;}
 async function save(data,memberId,metadata){
  const encoded=await encodePhoto(data),id=randomUUID();
  db.prepare("DELETE FROM photos WHERE created_at<datetime('now','-1 day') AND NOT EXISTS (SELECT 1 FROM bottles WHERE photo_id=photos.id)").run();
  db.prepare('INSERT INTO photos(id,member_id,data,title,artist,source_url,license,license_url,kind) VALUES(?,?,?,?,?,?,?,?,?)').run(id,memberId,encoded,metadata.title,metadata.artist,metadata.source_url,metadata.license,metadata.license_url,metadata.kind);
  return info(db.prepare('SELECT * FROM photos WHERE id=?').get(id));
 }
 return {
  info:id=>id?info(db.prepare('SELECT id,title,artist,source_url,license,license_url,kind FROM photos WHERE id=?').get(id)):null,
  get:id=>db.prepare('SELECT data FROM photos WHERE id=?').get(id),
  owner:id=>db.prepare('SELECT member_id FROM photos WHERE id=?').get(id)?.member_id,
  async upload(input,member){return save(input,member,{title:'Member bottle photo',artist:'Member-provided photo',source_url:'',license:'',license_url:'',kind:'upload'});},
  async search(query){
   if(typeof query!=='string'||query.trim().length<2||query.length>200)throw Error('Enter a bottle name between 2 and 200 characters.');
   const q=query.trim(),hit=cache.get(q);if(hit&&hit.expires>Date.now())return {results:hit.results,source:'Wikimedia Commons'};
   if(pending.has(q))return pending.get(q);
   const task=(async()=>{
    try{
     const url=new URL('https://commons.wikimedia.org/w/api.php');const terms=q.replace(/[^\p{L}\p{N}\s'-]/gu,' ').replace(/\s+/g,' ').trim();
     url.search=new URLSearchParams({action:'query',format:'json',generator:'search',gsrsearch:terms+' bottle filetype:bitmap',gsrnamespace:'6',gsrlimit:'12',prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'600',maxlag:'5'}).toString();
     const data=JSON.parse((await remote(url.href,2000000)).toString());if(data.error)throw Error('Image search is busy. Try again or upload your own photo.');
     const results=Object.values(data.query?.pages||{}).sort((a,b)=>(a.index??0)-(b.index??0)).flatMap(page=>{
      const item=page.imageinfo?.[0],meta=item?.extmetadata;if(!item||!meta||!['image/jpeg','image/png','image/webp'].includes(item.mime))return [];
      const image=trusted(item.thumburl||item.url,['upload.wikimedia.org','thumb.wikimedia.org']);const source=trusted(item.descriptionurl,['commons.wikimedia.org']);
      const license=text(meta.LicenseShortName?.value),licenseUrl=trusted(typeof meta.LicenseUrl?.value==='string'?meta.LicenseUrl.value.replace(/^http:/,'https:'):'',['creativecommons.org']);const artist=text(meta.Artist?.value);
      const publicDomain=/^(?:Public domain|CC0)$/i.test(license),cc=/^CC BY(?:-SA)? (?:1\.0|2\.0|2\.5|3\.0|4\.0)$/i.test(license)&&licenseUrl&&/^https:\/\/creativecommons\.org\/licenses\/by(?:-sa)?\/[\d.]+\/?$/.test(licenseUrl);
      if(!image||!source||(!publicDomain&&!cc)||(!publicDomain&&!artist))return [];
      const record={image,title:text(page.title).replace(/^File:/,''),artist:artist||'Creator listed on source page',source_url:source,license,license_url:licenseUrl||'',kind:'commons'};
      return [{...record,token:sign(record)}];
     });
     if(cache.size>=50)cache.delete(cache.keys().next().value);cache.set(q,{results,expires:Date.now()+300000});return {results,source:'Wikimedia Commons'};
    }catch(e){if(e.name==='TimeoutError'||e.name==='AbortError')throw Error('Image search timed out. Try again or upload your own photo.');if(e instanceof TypeError||e instanceof SyntaxError)throw Error('Image search could not connect. Upload your own photo or try again later.');throw e;}
    finally{pending.delete(q);}
   })();pending.set(q,task);return task;
  },
  async import(token,member){const record=verify(token);const url=trusted(record.image,['upload.wikimedia.org','thumb.wikimedia.org']);if(!url)throw Error('Select a photo from a fresh search.');let bytes;try{bytes=await remote(url,maxBytes);}catch{throw Error('This photo could not be downloaded. Try another photo or upload your own.');}return save(bytes,member,record);}
 };
}
