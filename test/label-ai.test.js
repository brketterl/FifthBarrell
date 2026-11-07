import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import sharp from 'sharp';
import {setupLabelAI,labelFields,validateRecognition} from '../label-ai.js';
import {createApp} from '../server.js';
const image=async()=> 'data:image/png;base64,'+(await sharp({create:{width:80,height:120,channels:3,background:'#fff'}}).png().toBuffer()).toString('base64');
function result(){return {readable:true,fields:Object.fromEntries(Object.keys(labelFields).map(key=>[key,{value:null,evidence:null}])),warnings:[]};}
const response=value=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
test('AI uses image input and strict structured output without storing responses or exposing the key',async()=>{
 const data=result();data.fields.name={value:'Wild Turkey 101',evidence:'WILD TURKEY 101'};data.fields.proof={value:101,evidence:'101 PROOF'};let calls=0;
 const ai=setupLabelAI({apiKey:'test-secret',fetcher:async(url,options)=>{
  calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer test-secret');assert.equal(options.redirect,'error');const payload=JSON.parse(options.body);assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert.equal(payload.text.format.schema.additionalProperties,false);assert.equal(payload.model,'gpt-5.4-mini');assert.equal(payload.tools,undefined);assert.ok(payload.instructions.includes('untrusted data'));assert.ok(payload.instructions.includes('bottled-by'));assert.equal(payload.input[0].content.filter(c=>c.type==='input_image').length,2);assert.ok(payload.input[0].content[1].image_url.startsWith('data:image/jpeg;base64,'));return response(data);
 }});
 const photo=await image(),read=await ai.recognize({images:[photo,photo]},1);assert.equal(read.fields.name.value,'Wild Turkey 101');assert.equal(read.fields.proof.value,101);assert.equal(read.fields.distillery.value,null);assert.equal(JSON.stringify(read).includes('test-secret'),false);assert.equal(calls,1);
});
test('image validation occurs before paid calls and unavailable configuration keeps a fallback',async()=>{
 let calls=0;const ai=setupLabelAI({apiKey:'test-secret',fetcher:async()=>{calls++;return response(result());}});
 for(const input of [{images:[]},{images:['https://example.com/image.jpg']},{images:['data:image/png;base64,PHN2Zy8+']},{images:[await image(),await image(),await image()]}])await assert.rejects(ai.recognize(input,1));
 assert.equal(calls,0);assert.equal(setupLabelAI().available(),false);await assert.rejects(setupLabelAI().recognize({images:[await image()]},1),/not enabled/);
});
test('AI results require evidence, valid values, and legible labels',()=>{
 let data=result();data.fields.name={value:'Unsupported guess',evidence:null};assert.equal(validateRecognition(data).fields.name.value,null);
 data=result();data.fields.proof={value:250,evidence:'250 PROOF'};assert.throws(()=>validateRecognition(data),/invalid number/);
 data=result();data.fields.year={value:2026.5,evidence:'2026'};assert.throws(()=>validateRecognition(data));
 data=result();data.readable=false;data.fields.name={value:'Not a bottle',evidence:'Not a bottle'};assert.equal(validateRecognition(data).fields.name.value,null);
 assert.throws(()=>validateRecognition({readable:true,fields:{},warnings:[]}));
});
test('AI failures stay actionable and duplicate requests do not duplicate paid calls',async()=>{
 const photo=await image();
 for(const [fetcher,pattern] of [[async()=>new Response('private provider details',{status:401}),/access is not configured/],[async()=>new Response('private provider details',{status:429}),/usage limit/],[async()=>Response.json({status:'incomplete'}),/could not finish/],[async()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}),/could not read/],[async()=>new Response('invalid'),/invalid response/],[async()=>{throw new DOMException('timeout','TimeoutError');},/timed out/]]){
  await assert.rejects(setupLabelAI({apiKey:'test',fetcher}).recognize({images:[photo]},1),pattern);
 }
 let release,started;const began=new Promise(r=>started=r);let calls=0;
 const ai=setupLabelAI({apiKey:'test',fetcher:async()=>{calls++;started();await new Promise(r=>release=r);return response(result());}});
 const first=ai.recognize({images:[photo]},1);await began;await assert.rejects(ai.recognize({images:[photo]},1),/already being read/);release();await first;assert.equal(calls,1);
});
test('AI endpoints enforce sign-in and origin checks while capability status never exposes credentials',async()=>{
 let calls=0;const data=result();data.fields.name={value:'Label bottle',evidence:'Label bottle'};
 const app=createApp(':memory:',{openaiLabel:{apiKey:'test-secret',fetcher:async()=>{calls++;return response(data);}}}),server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/`;
 async function post(path,data,cookie='',origin){return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',cookie,...(origin?{origin}:{})},body:JSON.stringify(data)});}
 try{
  const admin=await post('auth/setup',{name:'Host',email:'host@example.com',password:'h'});const cookie=admin.headers.get('set-cookie').split(';')[0];assert.equal((await fetch(base+'label-recognition/status')).status,401);
  const status=await (await fetch(base+'label-recognition/status',{headers:{cookie}})).json();assert.deepEqual(status,{available:true});
  const payload={images:[await image()]};assert.equal((await post('label-recognition',payload)).status,401);assert.equal((await post('label-recognition',payload,cookie,'https://other.example')).status,403);assert.equal(calls,0);
  const read=await post('label-recognition',payload,cookie);assert.equal(read.status,200);assert.equal((await read.json()).fields.name.value,'Label bottle');assert.equal(calls,1);
  const state=await (await fetch(base+'state',{headers:{cookie}})).json();assert.deepEqual(state.bottles,[]);
 }finally{await new Promise(r=>server.close(r));app.close();}
});

test('printed tasting notes retain label evidence and suggested profiles retain their AI provenance',()=>{
 let data=result();data.fields.bourbon_notes={value:'Vanilla, caramel, and oak.',evidence:'Vanilla, caramel, and oak.',source:'label'};
 const printed=validateRecognition(data).fields.bourbon_notes;assert.equal(printed.source,'label');assert.match(printed.value,/^Label tasting notes:/);assert.equal(printed.evidence,'Vanilla, caramel, and oak.');
 data=result();data.fields.name={value:'Wild Turkey 101',evidence:'WILD TURKEY 101'};data.fields.bourbon_notes={value:'Nose: caramel.\nPalate: oak and baking spice.\nFinish: warming.',evidence:'invented citation',source:'suggested'};
 const suggested=validateRecognition(data).fields.bourbon_notes;assert.equal(suggested.source,'suggested');assert.equal(suggested.evidence,null);assert.match(suggested.value,/^AI-suggested tasting profile \(not verified for this bottle or batch\):/);
});
test('tasting notes require a valid source and suggestions require a label-backed bottle identity',()=>{
 let data=result();data.fields.bourbon_notes={value:'Nose: vanilla.',evidence:null,source:'suggested'};assert.equal(validateRecognition(data).fields.bourbon_notes.value,null);
 data.fields.name={value:'Unverified identity',evidence:null};assert.equal(validateRecognition(data).fields.bourbon_notes.value,null);
 data=result();data.fields.bourbon_notes={value:'Vanilla',evidence:null,source:'label'};assert.equal(validateRecognition(data).fields.bourbon_notes.value,null);
 data.fields.bourbon_notes={value:'Vanilla',evidence:'VANILLA',source:'producer verified'};assert.equal(validateRecognition(data).fields.bourbon_notes.value,null);
 data.fields.bourbon_notes={value:'x'.repeat(2001),evidence:'x',source:'label'};assert.throws(()=>validateRecognition(data),/invalid bottle text/);
 data=result();data.readable=false;data.fields.name={value:'Wild Turkey',evidence:'WILD TURKEY'};data.fields.bourbon_notes={value:'Nose: vanilla.',evidence:null,source:'suggested'};assert.equal(validateRecognition(data).fields.bourbon_notes.value,null);
});
