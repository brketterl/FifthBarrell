import { readFileSync, existsSync } from 'node:fs';
import { validateCatalog } from './catalog-import.js';
// Fallback when no user-supplied BarrelDex snapshot is installed.
const starter = [
  {name:'Buffalo Trace',distillery:'Buffalo Trace Distillery',proof:90},
  {name:'Eagle Rare 10 Year',distillery:'Buffalo Trace Distillery',proof:90},
  {name:'Woodford Reserve',distillery:'Woodford Reserve Distillery',proof:90.4},
  {name:'Wild Turkey 101',distillery:'Wild Turkey Distilling Co.',proof:101},
  {name:'Rare Breed',distillery:'Wild Turkey Distilling Co.',proof:116.8},
  {name:"Maker’s Mark",distillery:"Maker’s Mark Distillery",proof:90},
  {name:'Four Roses Single Barrel',distillery:'Four Roses Distillery',proof:100},
  {name:'Knob Creek 9 Year',distillery:'James B. Beam Distilling Co.',proof:100},
  {name:'Old Forester 1920',distillery:'Old Forester Distilling Co.',proof:115},
  {name:'Bulleit Bourbon',distillery:'Bulleit Distilling Co.',proof:90},
  {name:'Redbreast 12 Year',distillery:'Midleton Distillery',proof:80},
  {name:'The Balvenie DoubleWood 12',distillery:'The Balvenie Distillery',proof:86}
];

const localPath=new URL('./data/catalog/barreldex.json',import.meta.url);
const path=existsSync(localPath)?localPath:new URL('./catalog-data/barreldex.json',import.meta.url);
const baseCatalog = existsSync(path)
  ? validateCatalog(JSON.parse(readFileSync(path,'utf8'))).map(b=>({
    id:'barreldex:'+b.slug,name:b.name,distillery:b.distillery??'',supplier:b.supplier??'',
    proof:b.proof??null,age_years:b.age_years??null,size_ml:b.size_ml??null,
    category:b.category??'',allocated:b.allocated===true,prices:b.prices??[],sources:b.sources??[],
    flags:b.flags??[],last_verified:b.last_verified??null
  }))
  : starter.map((b,i)=>({...b,id:'starter:'+i,prices:[],sources:[],flags:[]}));
for(const b of baseCatalog)Object.assign(b,{source_key:existsSync(path)?'barreldex':'starter',source:existsSync(path)?'BarrelDex (barreldex.com) · offline snapshot':'Curated starter catalog',url:existsSync(path)?'https://barreldex.com':null,license:existsSync(path)?'https://creativecommons.org/licenses/by/4.0/':null});
const reviewsPath=process.env.REVIEW_CATALOG_PATH||new URL('./data/catalog/reviews.json',import.meta.url);
const reviewData=existsSync(reviewsPath)?JSON.parse(readFileSync(reviewsPath,'utf8')):{version:1,bottles:[]};
if(reviewData.version!==1||!Array.isArray(reviewData.bottles)||reviewData.bottles.some(b=>typeof b.id!=='string'||!b.id.startsWith('reviews:')||typeof b.name!=='string'))throw new Error('Invalid review catalog; re-import the source CSV.');
export const catalog=[...baseCatalog,...reviewData.bottles];
export const catalogInfo={
  source:existsSync(path)?'BarrelDex (barreldex.com) · offline snapshot':'Curated starter catalog',
  url:existsSync(path)?'https://barreldex.com':null,
  data_url:existsSync(path)?'https://barreldex.com/data/bottles.json':null,
  license:existsSync(path)?'https://creativecommons.org/licenses/by/4.0/':null,
  total:catalog.length,
  counts:{barreldex:baseCatalog.filter(b=>b.source_key==='barreldex').length,reviews:reviewData.bottles.length},
  note:'Verify proof and release against your label. Retail observations are dated reference prices, not MSRP, market value, or your purchase cost.'
};
const normalize=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function searchCatalog(query='',{source='',offset=0}={}) {
  const words=normalize(query).split(' ').filter(Boolean);
  const results=catalog.filter(b=>{if(source&&b.source_key!==source)return false;const text=normalize([b.name,b.distillery,b.supplier,b.category,b.release,b.release_year_text,b.selection,b.barrel,b.warehouse,b.floor,b.rick].join(' '));return words.every(word=>text.includes(word));});
  const start=Math.max(0,Math.floor(Number(offset)||0));
  return {...catalogInfo,source:reviewData.bottles.length?'Combined bottle catalog':catalogInfo.source,matched:results.length,offset:start,next_offset:start+25<results.length?start+25:null,results:results.slice(start,start+25)};
}
