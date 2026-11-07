import {test,expect} from '@playwright/test';
test('member onboarding and gathering workflow',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.locator('#auth-dialog')).toBeVisible();
 const session=await page.request.get('/api/auth/session');const setup=(await session.json()).setup;
 if(setup){await page.locator('#auth-form [name=name]').fill('Society Host');await page.locator('#auth-form [name=email]').fill('host@example.com');await page.locator('#auth-form [name=password]').fill('my long society password');}else{await page.locator('#auth-form [name=email]').fill('host@example.com');await page.locator('#auth-form [name=password]').fill('my long society password');}
 await page.locator('#auth-form [type=submit]').click();await expect(page.locator('#home-view')).toBeVisible();await expect(page.locator('#auth-dialog')).not.toBeVisible();
 await page.locator('#home-bottle').click();await expect(page.locator('#bottle-dialog')).toBeVisible();await page.locator('#bottle-form [name=name]').fill('Our first bourbon');await page.locator('#bottle-form [type=submit]').click();await expect(page.locator('#bottle-dialog')).not.toBeVisible();
 await page.locator('#home-host').click();await page.locator('#event-form [name=name]').fill('Society flight');await page.locator('#event-form [type=submit]').click();await expect(page.locator('#add-pour')).toBeVisible();await page.locator('#add-pour').click();await page.locator('#pour-form [name=whiskey_name]').fill('First pour');await page.locator('#pour-form [type=submit]').click();await page.getByRole('button',{name:'Taste this pour'}).first().click();await expect(page.locator('#guided-stages details').first()).not.toHaveAttribute('open','');await page.locator('#tasting-form [name=score]').fill('8');await page.locator('#tasting-form [type=submit]').click();await expect(page.locator('#tasting-dialog')).not.toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();expect(errors).toEqual([]);await page.screenshot({path:`/tmp/fifth-barrel-${test.info().project.name}.png`,fullPage:true});
});
