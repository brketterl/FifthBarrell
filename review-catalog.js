import {createHash} from 'node:crypto';

// CSV parser with quoted commas/newlines and escaped quotes; no external packages.
export function parseCSV(text) {
  const rows=[];let row=[],field='',quoted=false,closed=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
    if(c==='"'){if(field||closed)throw new Error('Unexpected quote in CSV.');quoted=true;continue;}
    if(c===','||c==='\n'||c==='\r'){
      row.push(field);field='';closed=false;
      if(c!==','){if(row.some(v=>v!==''))rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}
    }else{if(closed)throw new Error('Unexpected text after a quoted CSV field.');field+=c;}
  }
  if(quoted)throw new Error('Unclosed quoted CSV field.');
  if(field||row.length||closed){row.push(field);if(row.some(v=>v!==''))rows.push(row);}
  const headers=rows.shift();if(!headers||new Set(headers).size!==headers.length)throw new Error('Missing or duplicate CSV headers.');
  for(const key of ['BRAND','LABEL','EXPRESSION','RELEASE/BATCH','RELEASE YEAR','PROOF','AGE'])if(!headers.includes(key))throw new Error('Missing CSV column: '+key);
  return rows.map((values,i)=>{if(values.length!==headers.length)throw new Error('Wrong column count on CSV record '+(i+2));return Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()]));});
}
const identityFields=['BRAND','LABEL','EXPRESSION','RELEASE/BATCH','RELEASE YEAR','CLASS','RELEASE TYPE','SELECTED BY/FOR','BARREL','WAREHOUSE','FLOOR','RICK'];
const clean=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ');
export function buildReviewCatalog(text){
  const rows=parseCSV(text),groups=new Map();let missingIdentity=0;
  for(const row of rows){
    if(!row.BRAND||!row.LABEL){missingIdentity++;continue;}
    const identity=identityFields.map(k=>clean(row[k]).toUpperCase());
    const key=JSON.stringify(identity);
    if(!groups.has(key))groups.set(key,{row,proofs:new Set(),ages:new Set(),finished:new Set()});
    const group=groups.get(key);
    for(const [column,set,min,max] of [['PROOF',group.proofs,0,200],['AGE',group.ages,0,200]]){
      if(row[column]!==''&&row[column]!=null){const value=Number(row[column]);if(!Number.isFinite(value)||value<min||value>max)throw new Error('Invalid '+column+' for '+row.BRAND+' '+row.LABEL);set.add(value);}
    }
    if(row.FINISHED)group.finished.add(row.FINISHED);
  }
  if(!groups.size)throw new Error('No usable bottle identities were found.');
  const bottles=[...groups.entries()].map(([key,{row,proofs,ages}])=>{
    const parts=[row.BRAND];
    for(const value of [row.LABEL,row.EXPRESSION])if(value&&value.toUpperCase()!=='STANDARD'&&!parts.some(p=>p.toUpperCase()===value.toUpperCase()))parts.push(value);
    const proofValues=[...proofs].sort((a,b)=>a-b),ageValues=[...ages].sort((a,b)=>a-b);
    const releaseYear=/^\d{4}$/.test(row['RELEASE YEAR'])?Number(row['RELEASE YEAR']):null;
    return {id:'reviews:'+createHash('sha256').update(key).digest('hex').slice(0,24),
      name:parts.join(' '),brand:row.BRAND,label:row.LABEL,expression:row.EXPRESSION,distillery:'',supplier:'',
      release:row['RELEASE/BATCH'],release_year:releaseYear,release_year_text:row['RELEASE YEAR'],
      selection:row['SELECTED BY/FOR']??'',barrel:row.BARREL??'',warehouse:row.WAREHOUSE??'',floor:row.FLOOR??'',rick:row.RICK??'',
      proof:proofValues.length===1?proofValues[0]:null,proof_values:proofValues,
      age_years:ageValues.length===1?ageValues[0]:null,age_values:ageValues,size_ml:null,category:row.CLASS??'',
      source_key:'reviews',source:'American Whiskey Review Database · uploaded CSV',url:'https://american-whiskey-review-database.streamlit.app/Review_Explorer',license:null,
      prices:[],sources:[],flags:['Bottle metadata derived from review records; verify against your label.',...(proofValues.length>1?['Review records disagree on proof. Enter the proof printed on your bottle.']:[]),...(ageValues.length>1?['Review records disagree on age. Enter the age printed on your bottle.']:[])]};
  }).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  return {version:1,source_rows:rows.length,skipped_rows:missingIdentity,bottles};
}
