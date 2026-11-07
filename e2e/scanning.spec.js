import {test,expect} from '@playwright/test';
const code='088004005542';
function barcodeSvg(){
 const L=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
 const R=L.map(s=>[...s].map(c=>c==='0'?'1':'0').join(''));
 const ean='0'+code,bits='101'+[...ean.slice(1,7)].map(n=>L[Number(n)]).join('')+'01010'+[...ean.slice(7)].map(n=>R[Number(n)]).join('')+'101';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="690" height="300"><rect width="690" height="300" fill="white"/>${[...bits].map((b,i)=>b==='1'?`<rect x="${60+i*6}" y="30" width="6" height="230" fill="black"/>`:'').join('')}</svg>`;
}
test('barcode photos, camera cleanup, local label OCR, and review before saving',async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');const session=await (await page.request.get('/api/auth/session')).json();
 if(session.setup)await page.request.post('/api/auth/setup',{data:{name:'Society Host',email:'host@example.com',password:'pour'}});else await page.request.post('/api/auth/login',{data:{email:'host@example.com',password:'pour'}});
 await page.reload();await expect(page.locator('#auth-dialog')).not.toBeVisible();await page.locator('#home-bottle').click();await page.locator('#open-scan').click();
 let lookups=0;await page.route('**/api/barcode',route=>{lookups++;return route.fulfill({json:{barcode:'00088004005542',source:'UPCitemdb',items:[{title:'Buffalo Trace',brand:'Buffalo Trace'}]}});});
 await page.locator('#barcode-photo').setInputFiles({name:'barcode.svg',mimeType:'image/svg+xml',buffer:Buffer.from(barcodeSvg())});
 await expect(page.locator('#scan-results')).toContainText('Buffalo Trace');await expect(page.locator('#bottle-form [name=name]')).toHaveValue('');
 await page.locator('#scan-results button').click();await expect(page.locator('#bottle-form [name=name]')).toHaveValue('Buffalo Trace');await expect(page.locator('#bottle-form [name=barcode]')).toHaveValue('00088004005542');await expect(page.locator('#bottle-form [name=proof]')).toHaveValue('');
 await page.locator('#bottle-form [name=price]').fill('42');await page.locator('#open-scan').click();
 // A canvas stream exercises the real scanner and track cleanup without physical hardware.
 await page.evaluate(async svg=>{
  const image=new Image();image.src='data:image/svg+xml;base64,'+btoa(svg);await image.decode();const canvas=document.createElement('canvas');canvas.width=690;canvas.height=300;canvas.getContext('2d').drawImage(image,0,0);window.testScanCanvas=canvas;
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{const stream=canvas.captureStream(10);window.testScanStream=stream;const timer=setInterval(()=>canvas.getContext('2d').drawImage(image,0,0),80);const track=stream.getVideoTracks()[0],stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};return stream;}});
 },barcodeSvg());
 await page.locator('#start-camera').click();await expect(page.locator('#scan-results')).toContainText('Buffalo Trace');expect(lookups).toBe(2);
 expect(await page.evaluate(()=>window.testScanStream.getTracks().every(t=>t.readyState==='ended'))).toBe(true);await expect(page.locator('#scan-video')).toBeHidden();
 await page.locator('#close-scan').click();await page.locator('#open-scan').click();
 const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1300;c.height=430;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='bold 80px Arial';x.fillText('WILD TURKEY 101',60,130);x.font='40px Arial';x.fillText('KENTUCKY STRAIGHT BOURBON',60,230);x.fillText('101 PROOF',60,320);return c.toDataURL('image/png').split(',')[1];});
 const external=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:3107')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
 await page.locator('#label-photo').setInputFiles({name:'label.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});await expect(page.locator('#label-review')).toBeVisible({timeout:60000});await expect(page.locator('#label-text')).toHaveValue(/WILD TURKEY/i);
 await expect(page.locator('#scan-results')).toContainText('Wild Turkey 101',{timeout:15000});await page.locator('#scan-results button').filter({hasText:'Wild Turkey 101'}).first().click();await expect(page.locator('#bottle-form [name=name]')).toHaveValue(/Wild Turkey 101/i);await expect(page.locator('#bottle-form [name=barcode]')).toHaveValue('');await expect(page.locator('#bottle-form [name=price]')).toHaveValue('42');expect(external).toEqual([]);
 await page.locator('#open-scan').click();await page.evaluate(()=>Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{throw new DOMException('denied','NotAllowedError');}}));await page.locator('#start-camera').click();await expect(page.locator('#scan-status')).toContainText('permission was denied');
 await page.unroute('**/api/barcode');await page.route('**/api/barcode',route=>route.fulfill({json:{barcode:'00088004005542',source:'UPCitemdb',items:[]}}));
 await page.locator('#scan-code').fill(code);await page.locator('#lookup-barcode').click();await expect(page.locator('#scan-status')).toContainText('No match found');await page.getByRole('button',{name:'Keep barcode and enter bottle details'}).click();await expect(page.locator('#bottle-form [name=name]')).toHaveValue(/Wild Turkey 101/i);await expect(page.locator('#bottle-form [name=barcode]')).toHaveValue('00088004005542');
 await page.locator('#open-scan').click();await page.unroute('**/api/barcode');await page.route('**/api/barcode',route=>route.fulfill({status:400,json:{error:'Provider limit reached. Use label search.'}}));await page.locator('#scan-code').fill(code);await page.locator('#lookup-barcode').click();await expect(page.locator('#scan-status')).toContainText('Provider limit reached');
 await page.locator('#close-scan').click();
 expect(errors).toEqual([]);await page.locator('#bottle-dialog').screenshot({path:`/tmp/fifth-barrel-scanner-${test.info().project.name}.png`});
});
