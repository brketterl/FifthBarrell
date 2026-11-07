import {test,expect} from '@playwright/test';
test('member onboarding and gathering workflow',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.locator('#auth-dialog')).toBeVisible();
 const session=await page.request.get('/api/auth/session');const setup=(await session.json()).setup;
 if(setup){await page.locator('#auth-form [name=name]').fill('Society Host');await page.locator('#auth-form [name=email]').fill('host@example.com');await page.locator('#auth-form [name=password]').fill('pour');}else{await page.locator('#auth-form [name=email]').fill('host@example.com');await page.locator('#auth-form [name=password]').fill('pour');}
 await page.locator('#auth-form [type=submit]').click();await expect(page.locator('#home-view')).toBeVisible();await expect(page.locator('#auth-dialog')).not.toBeVisible();
 await page.locator('#home-bottle').click();await expect(page.locator('#bottle-dialog')).toBeVisible();await page.locator('#bottle-form [name=name]').fill('Our first bourbon');await page.locator('#bottle-form [type=submit]').click();await expect(page.locator('#bottle-dialog')).not.toBeVisible();
 await page.locator('#home-host').click();await page.locator('#event-form [name=name]').fill('Society flight');await page.locator('#event-form [type=submit]').click();await expect(page.locator('#add-pour')).toBeVisible();await page.locator('#add-pour').click();await page.locator('#pour-form [name=whiskey_name]').fill('First pour');await page.locator('#pour-form [type=submit]').click();await page.getByRole('button',{name:'Taste this pour'}).first().click();await expect(page.locator('#guided-stages details').first()).not.toHaveAttribute('open','');await page.locator('#tasting-form [name=score]').fill('8');await page.locator('#tasting-form [type=submit]').click();await expect(page.locator('#tasting-dialog')).not.toBeVisible();
 await page.locator('#sign-out').click();await expect(page.locator('#auth-dialog')).toBeVisible();
 await page.locator('#auth-form [name=email]').fill('host@example.com');await page.locator('#auth-form [name=password]').fill('incorrect password');
 const failure=page.waitForResponse(r=>r.url().endsWith('/api/auth/login'));await page.locator('#auth-form [type=submit]').click();
 const failed=await failure;expect(failed.status()).toBe(422);expect(failed.headers()['www-authenticate']).toBeUndefined();
 await expect(page.locator('#auth-error')).toHaveText('Email or password is incorrect.');await expect(page.locator('#auth-form [type=submit]')).toBeEnabled();
 await page.locator('#auth-form [name=password]').fill('pour');await page.locator('#auth-form [type=submit]').click();await expect(page.locator('#auth-dialog')).not.toBeVisible();await expect(page.locator('#home-view')).toBeVisible();
 await page.locator('#my-profile').click();await expect(page.locator('#profile-dialog')).toBeVisible();
 await page.locator('#profile-form [name=name]').fill('Society Host Updated');await page.locator('#profile-form [type=submit]').click();
 await expect(page.locator('#profile-dialog')).not.toBeVisible();await expect(page.locator('#account-label')).toContainText('Society Host Updated');
 await page.locator('#my-profile').click();await page.locator('#profile-form [name=email]').fill('updated-host@example.com');
 await page.locator('#profile-form [name=new_password]').fill('sip');await page.locator('#profile-form [name=confirm_password]').fill('different');await page.locator('#profile-form [type=submit]').click();await expect(page.locator('#profile-error')).toHaveText('New passwords do not match.');
 await page.locator('#profile-form [name=confirm_password]').fill('sip');await page.locator('#profile-form [name=current_password]').fill('pour');await page.locator('#profile-form [type=submit]').click();await expect(page.locator('#profile-dialog')).not.toBeVisible();
 await page.locator('#sign-out').click();await expect(page.locator('#auth-dialog')).toBeVisible();await page.locator('#auth-form [name=email]').fill('updated-host@example.com');await page.locator('#auth-form [name=password]').fill('sip');await page.locator('#auth-form [type=submit]').click();await expect(page.locator('#auth-dialog')).not.toBeVisible();
 // Restore shared test account credentials for the next viewport run.
 await page.locator('#my-profile').click();await page.locator('#profile-form [name=name]').fill('Society Host');await page.locator('#profile-form [name=email]').fill('host@example.com');await page.locator('#profile-form [name=current_password]').fill('sip');await page.locator('#profile-form [name=new_password]').fill('pour');await page.locator('#profile-form [name=confirm_password]').fill('pour');await page.locator('#profile-form [type=submit]').click();await expect(page.locator('#profile-dialog')).not.toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();expect(errors).toEqual([]);await page.screenshot({path:`/tmp/fifth-barrel-${test.info().project.name}.png`,fullPage:true});
});
