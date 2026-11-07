import {catalog} from './catalog.js';
const tokens=value=>String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]+/g)||[];
const generic=new Set(['the','and','of','bourbon','whiskey','whisky','straight','kentucky','proof','bottled','bottle','distillery','distilling','company','years','year','old','aged','alcohol']);
export function searchLabel(text){
  if(typeof text!=='string'||!text.trim()||text.length>4000)throw Error('Enter label text up to 4,000 characters.');
  const words=new Set(tokens(text));
  return catalog.map(b=>{
    const name=[...new Set(tokens(b.name))],distinct=name.filter(w=>!generic.has(w)&&w.length>1),hits=distinct.filter(w=>words.has(w));
    if(!distinct.length||!hits.length||hits.length/distinct.length<0.5)return null;
    const score=hits.length*3+hits.length/distinct.length+name.filter(w=>words.has(w)).length/Math.max(1,name.length);
    return {b,score};
  }).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,8).map(({b})=>({id:b.id,name:b.name,distillery:b.distillery||'',proof:b.proof??null,release:b.release||'',label:b.label||'',expression:b.expression||'',age_years:b.age_years??null,size_ml:b.size_ml??null,source:b.source||'Society catalog'}));
}
