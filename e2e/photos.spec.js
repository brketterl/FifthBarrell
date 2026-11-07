import {test,expect} from '@playwright/test';
import http from 'node:http';
import sharp from 'sharp';
import {createApp} from '../server.js';
async function expectContainedPhoto(container){
 const image=container.locator('.cabinet-photo');await expect(image).toBeVisible();
 const frame=await container.boundingBox(),photo=await image.boundingBox();
 expect(photo.x).toBeGreaterThanOrEqual(frame.x);expect(photo.y).toBeGreaterThanOrEqual(frame.y);
 expect(photo.x+photo.width).toBeLessThanOrEqual(frame.x+frame.width+1);
 expect(photo.y+photo.height).toBeLessThanOrEqual(frame.y+frame.height+1);
}
test('members preview, save, replace and remove cabinet photos',async({page})=>{
 const fixture=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="420"><rect width="240" height="420" fill="#f4eee1"/><rect x="95" y="20" width="50" height="80" fill="#253c30"/><rect x="60" y="90" width="120" height="300" rx="20" fill="#9e6128"/><rect x="70" y="190" width="100" height="95" fill="#fff9e9"/></svg>')).png().toBuffer();
 const candidate={title:'File:Wild Turkey bottle.jpg',imageinfo:[{mime:'image/jpeg',thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Bottle.jpg/600px-Bottle.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Bottle.jpg',extmetadata:{Artist:{value:'Test Photographer'},LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'}}}]};
 const app=createApp(':memory:',{photoFetch:async url=>String(url).startsWith('https://commons.wikimedia.org/w/api.php?')?Response.json({query:{pages:{1:candidate}}}):new Response(fixture)}),server=http.createServer(app.handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('https://upload.wikimedia.org/**',r=>r.fulfill({body:fixture,contentType:'image/png'}));
  await page.goto(base);await page.request.post(base+'/api/auth/setup',{data:{name:'Photo Member',email:'photos@example.com',password:'p'}});await page.reload();
  await page.locator('#home-bottle').click();await page.locator('#bottle-form [name=name]').fill('Wild Turkey 101');
  await page.locator('#photo-upload').setInputFiles({name:'my-bottle.png',mimeType:'image/png',buffer:fixture});await expect(page.locator('#photo-preview img')).toBeVisible();await expect(page.locator('#photo-status')).toHaveText('Photo selected. Save the bottle to keep it.');
  expect((await (await page.request.get(base+'/api/state')).json()).bottles).toHaveLength(0);
  await page.locator('#bottle-form [type=submit]').click();await expect(page.locator('#bottle-dialog')).not.toBeVisible();await page.locator('#cabinet-nav').click();
  await expect(page.locator('.cabinet-photo')).toHaveCount(1);expect(await page.locator('.cabinet-photo').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await expectContainedPhoto(page.locator('#bottles .bottle-art'));
  const photoBox=await page.locator('#bottles .cabinet-photo').boundingBox(),bodyBox=await page.locator('#bottles .card-body').boundingBox();expect(photoBox.y+photoBox.height).toBeLessThanOrEqual(bodyBox.y);
  await page.locator('#bottles').screenshot({path:`/tmp/fifth-barrel-cabinet-${test.info().project.name}.png`});
  await page.locator('[data-bottle]').click();await expectContainedPhoto(page.locator('#detail .bottle-art'));await page.locator('#edit-bottle').click();
  await page.locator('#remove-photo').click();await page.locator('#bottle-form .close').last().click();
  await page.reload();await page.locator('#cabinet-nav').click();await expect(page.locator('.cabinet-photo')).toHaveCount(1);
  await page.locator('[data-bottle]').click();await page.locator('#edit-bottle').click();await page.locator('#find-photo').click();
  await expect(page.locator('.photo-result')).toHaveCount(1);await expect(page.locator('.photo-result')).toContainText('Test Photographer');await page.getByRole('button',{name:'Use this photo',exact:true}).click();await expect(page.locator('#photo-credit')).toContainText('CC BY-SA 4.0');await expect(page.locator('#photo-status')).toContainText('Photo selected.');
  await page.locator('#bottle-form [type=submit]').click();await expect(page.locator('#bottle-dialog')).not.toBeVisible();await expect(page.locator('#bottles .cabinet-photo-credit')).toContainText('Test Photographer');
  await page.locator('[data-bottle]').click();await page.locator('#edit-bottle').click();await page.locator('#bottle-dialog').screenshot({path:`/tmp/fifth-barrel-photos-${test.info().project.name}.png`});
  await page.locator('#remove-photo').click();await page.locator('#bottle-form [type=submit]').click();await expect(page.locator('#bottle-dialog')).not.toBeVisible();await expect(page.locator('#bottles .cabinet-photo')).toHaveCount(0);await expect(page.locator('#bottles .bottle-art svg')).toBeVisible();
  expect(errors).toEqual([]);
 }finally{await new Promise(r=>server.close(r));app.close();}
});
