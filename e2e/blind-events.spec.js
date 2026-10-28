import {test,expect} from '@playwright/test';
test('blind flight records anonymous impressions then reveals the selected bourbon',async({page,request},info)=>{
  const member=await(await request.post('/api/members',{data:{name:'Blind member '+info.project.name}})).json();
  const record=(await(await request.get('/api/catalog?q=eagle&source=barreldex')).json()).results[0];
  let eventId;
  try{
    await page.goto('/');await page.locator('#events-nav').click();await page.locator('#add-event').click();const ef=page.locator('#event-dialog');await ef.getByLabel('Event name').fill('Blind night '+info.project.name);await ef.getByLabel('Tasting style').selectOption('blind');await ef.getByRole('button',{name:'Create event',exact:true}).click();
    await page.locator('#add-pour').click();const pf=page.locator('#pour-dialog');await expect(page.locator('#pour-identity-lookup')).toBeHidden();await pf.getByLabel('Sample name').fill('Glass A');await pf.getByRole('button',{name:'Add sample',exact:true}).click();await expect(page.locator('.flight-card')).toContainText('Glass A');await expect(page.locator('.flight-card')).not.toContainText(record.name);
    await page.getByRole('button',{name:'Taste this pour',exact:true}).click();const tf=page.locator('#tasting-dialog');await tf.getByLabel('Member',{exact:false}).selectOption(String(member.id));await tf.getByLabel('Overall enjoyment').fill('8.5');await tf.locator('[name=notes]').fill('Blind impressions stay intact');await tf.getByRole('button',{name:'Save tasting'}).click();
    await page.reload();await page.locator('#events-nav').click();await expect(page.locator('.tasting-card').filter({hasText:'Blind impressions'})).toContainText('Glass A');
    await page.getByRole('button',{name:'Enter bourbon & reveal',exact:true}).click();await pf.getByLabel('Look up a whiskey').fill('eagle');await pf.locator('.lookup-result').first().click();page.once('dialog',d=>d.accept());await pf.getByRole('button',{name:'Reveal bourbon',exact:true}).click();await expect(page.locator('.flight-card')).toContainText(record.name);await expect(page.locator('.flight-card')).toContainText('Glass A · Revealed');await expect(page.locator('.tasting-card').filter({hasText:'Blind impressions'})).toContainText(record.name);await expect(page.locator('.flight-score')).toContainText('8.5');
    const state=await(await request.get('/api/state')).json();const event=state.events.find(e=>e.name==='Blind night '+info.project.name);eventId=event.id;const t=state.tastings.find(t=>t.member_id===member.id);expect(t.notes).toBe('Blind impressions stay intact');expect(t.score).toBe(8.5);
  }finally{if(eventId)await request.delete('/api/events/'+eventId);await request.delete('/api/members/'+member.id);}
});
