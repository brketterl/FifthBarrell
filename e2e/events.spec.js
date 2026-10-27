import { test,expect } from '@playwright/test';
test('society can create a flight and compare separate member observations',async({page,request},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const names=['Alex '+info.project.name,'Jordan '+info.project.name];
  const members=[];for(const name of names){const res=await request.post('/api/members',{data:{name}});members.push(await res.json());}
  await page.goto('/');await page.locator('#events-nav').click();await page.locator('#add-event').click();
  const eventForm=page.locator('#event-dialog');await eventForm.getByLabel('Event name').fill('Society flight '+info.project.name);await eventForm.getByLabel('Location').fill('The tasting table');await eventForm.getByRole('button',{name:'Create event',exact:true}).click();
  for(const whiskey of ['Society Bourbon','Society Rye']){
    await page.locator('#add-pour').click();const f=page.locator('#pour-dialog');await f.getByLabel('Whiskey name').fill(whiskey);await f.getByLabel('Distillery').fill('Test distillery');await f.getByLabel('Proof').fill('100');await f.getByRole('button',{name:'Add pour',exact:true}).click();
  }
  await expect(page.locator('.flight-card')).toHaveCount(2);
  const f=page.locator('#tasting-dialog');
  for(let i=0;i<2;i++){
    await page.locator('.flight-card').first().getByRole('button',{name:'Taste this pour'}).click();
    await f.getByLabel('Member', {exact:false}).selectOption(String(members[i].id));
    await f.locator('[data-stage=nose][data-descriptor=Vanilla]').selectOption(i===0?'4':'2');
    if(i===0)await f.locator('[data-stage=palate][data-descriptor=Sweetness]').selectOption('0');
    await f.locator('[name=nose_notes]').fill(i===0?'Caramel and vanilla':'More oak than vanilla');
    await f.getByLabel('Overall enjoyment').fill(i===0?'9':'7');await f.getByRole('button',{name:'Save tasting'}).click();
  }
  await expect(page.locator('.flight-score').first()).toContainText('8.0');
  const vanilla=page.locator('.comparison tr').filter({has:page.getByRole('rowheader',{name:'Nose · Vanilla',exact:true})});
  await expect(vanilla).toContainText('3.0/5 (n=2)');
  const sweet=page.locator('.comparison tr').filter({has:page.getByRole('rowheader',{name:'Palate · Sweetness',exact:true})});
  await expect(sweet).toContainText('0.0/5 (n=1)');
  await page.locator('.flight-card').first().getByRole('button',{name:'Taste this pour'}).click();await f.getByLabel('Member',{exact:false}).selectOption(String(members[0].id));await f.getByLabel('Overall enjoyment').fill('8');await f.getByRole('button',{name:'Save tasting'}).click();await expect(page.locator('#tasting-error')).toContainText('already rated');await f.getByRole('button',{name:'Cancel'}).click();
  const journal=page.locator('.tasting-card').filter({hasText:names[0]});await journal.getByRole('button',{name:'Edit tasting'}).click();await expect(f.locator('[name=nose_notes]')).toHaveValue('Caramel and vanilla');await f.getByLabel('Overall enjoyment').fill('8');await f.getByRole('button',{name:'Save tasting'}).click();await expect(page.locator('.flight-score').first()).toContainText('7.5');
  await page.reload();await page.locator('#events-nav').click();await expect(page.locator('.flight-score').first()).toContainText('7.5');
  await page.screenshot({path:`/tmp/fifth-barrel-events-${info.project.name}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const download=page.waitForEvent('download');await page.locator('#export-data').click();expect((await download).suggestedFilename()).toMatch(/fifth-barrel-society/);
  page.once('dialog',d=>d.accept());await page.locator('#remove-event').click();await expect(page.locator('.flight-card')).toHaveCount(0);await expect(page.locator('#tasting-history')).toContainText('Society Bourbon');
  for(const m of members)await request.delete('/api/members/'+m.id);
  expect(errors).toEqual([]);
});
