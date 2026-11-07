import {test,expect} from '@playwright/test';
import http from 'node:http';
import sharp from 'sharp';
import {createApp} from '../server.js';
import {labelFields} from '../label-ai.js';
test('AI label fields are reviewed and selected before populating the bottle form',async({page})=>{
 let calls=0;const fields=Object.fromEntries(Object.keys(labelFields).map(key=>[key,{value:null,evidence:null}]));fields.name={value:'Detected bourbon',evidence:'DETECTED BOURBON'};fields.proof={value:101,evidence:'101 PROOF'};fields.release={value:'Batch B',evidence:'BATCH B'};
 const app=createApp(':memory:',{openaiLabel:{apiKey:'test-secret',fetcher:async(url,options)=>{calls++;const request=JSON.parse(options.body);expect(request.input[0].content.filter(c=>c.type==='input_image')).toHaveLength(2);return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({readable:true,fields,warnings:['Distillery is not visible. Check the back label.']})}]}]});}}}),server=http.createServer(app.handler);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base);await page.request.post(base+'/api/auth/setup',{data:{name:'AI Member',email:'ai@example.com',password:'p'}});await page.reload();await page.locator('#home-bottle').click();
  await page.locator('#bottle-form [name=name]').fill('Existing bottle');await page.locator('#bottle-form [name=distillery]').fill('Existing distillery');await page.locator('#bottle-form [name=proof]').fill('90');await page.locator('#bottle-form [name=price]').fill('45');
  await page.locator('#open-scan').click();await expect(page.locator('#ai-label-photo')).toBeEnabled();
  const image=await sharp({create:{width:80,height:120,channels:3,background:'#fff'}}).png().toBuffer();const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Read label with OpenAI',exact:true}).click();await (await chooser).setFiles([{name:'front.png',mimeType:'image/png',buffer:image},{name:'back.png',mimeType:'image/png',buffer:image}]);
  await expect(page.locator('#ai-label-review')).toBeVisible();await expect(page.locator('#ai-label-fields')).toContainText('DETECTED BOURBON');await expect(page.locator('#ai-label-warnings')).toContainText('Distillery is not visible');
  await expect(page.locator('#bottle-form [name=name]')).toHaveValue('Existing bottle');await expect(page.locator('#bottle-form [name=proof]')).toHaveValue('90');
  await page.getByRole('textbox',{name:'AI Bottle name',exact:true}).fill('Reviewed bourbon');await page.getByRole('checkbox',{name:'Use Proof',exact:true}).uncheck();
  await page.locator('#use-ai-label').click();await expect(page.locator('#scan-panel')).toBeHidden();
  await expect(page.locator('#bottle-form [name=name]')).toHaveValue('Reviewed bourbon');await expect(page.locator('#bottle-form [name=proof]')).toHaveValue('90');await expect(page.locator('#bottle-form [name=release]')).toHaveValue('Batch B');await expect(page.locator('#bottle-form [name=distillery]')).toHaveValue('Existing distillery');await expect(page.locator('#bottle-form [name=price]')).toHaveValue('45');
  expect((await (await page.request.get(base+'/api/state')).json()).bottles).toHaveLength(0);
  await page.locator('#bottle-form [type=submit]').click();await expect(page.locator('#bottle-dialog')).not.toBeVisible();const state=await (await page.request.get(base+'/api/state')).json();expect(state.bottles[0].name).toBe('Reviewed bourbon');expect(state.bottles[0].proof).toBe(90);expect(calls).toBe(1);expect(errors).toEqual([]);
 }finally{await new Promise(r=>server.close(r));app.close();}
});


test('missing AI configuration gives useful setup feedback without a dead control',async({page})=>{
 const app=createApp(':memory:'),server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  await page.goto(base);await page.request.post(base+'/api/auth/setup',{data:{name:'Member',email:'member@example.com',password:'m'}});await page.reload();await page.locator('#home-bottle').click();await page.locator('#open-scan').click();
  await expect(page.locator('#ai-label-availability')).toContainText('server cannot find an OpenAI API key');await expect(page.getByRole('button',{name:'Read label with OpenAI',exact:true})).toBeEnabled();
  const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Read label with OpenAI',exact:true}).click();const image=await sharp({create:{width:40,height:60,channels:3,background:'#fff'}}).png().toBuffer();await (await chooser).setFiles({name:'label.png',mimeType:'image/png',buffer:image});
  await expect(page.locator('#ai-label-status')).toContainText('Environment variable or Secret File');await expect(page.locator('#bottle-form [name=name]')).toHaveValue('');await page.getByRole('button',{name:'Check AI setup'}).click();await expect(page.locator('#ai-label-availability')).toContainText('OPENAI_API_KEY');
 }finally{await new Promise(r=>server.close(r));app.close();}
});
