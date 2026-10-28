import {test,expect} from '@playwright/test';
test('catalog fills cabinet and flight details without inventing distillery, year or purchase price',async({page,request},info)=>{
  const catalog=await (await request.get('/api/catalog?q=eagle')).json(),record=catalog.results[0];
  const member=await (await request.post('/api/members',{data:{name:'Catalog '+info.project.name}})).json();
  try{
    await page.goto('/');await page.locator('#add-bottle').click();const f=page.locator('#bottle-dialog');
    await f.getByRole('combobox',{name:/^Member/}).selectOption(String(member.id));
    await f.getByRole('spinbutton',{name:/^Year/}).fill('2025');await f.getByLabel('Purchase price').fill('61.25');
    await f.getByLabel('Look up a whiskey').fill('eagle');await f.locator('.lookup-result').first().click();
    await expect(f.locator('[name=distillery]')).toHaveValue(record.distillery);await expect(f.locator('[name=proof]')).toHaveValue(String(record.proof));
    await expect(f.locator('[name=year]')).toHaveValue('2025');await expect(f.locator('[name=price]')).toHaveValue('61.25');
    await expect(f.locator('[name=age_years]')).toHaveValue(record.age_years==null?'':String(record.age_years));
    await expect(page.locator('#catalog-reference')).toContainText(record.source);
    await f.getByRole('button',{name:'Save bottle'}).click();
    let state=await (await request.get('/api/state')).json();const b=state.bottles.find(b=>b.member_id===member.id);expect(b.catalog_id).toBe(record.id);expect(b.price).toBe(61.25);expect(b.year).toBe(2025);expect(b.age_years).toBe(record.age_years??null);
    await page.locator('#events-nav').click();await page.locator('#add-event').click();const ef=page.locator('#event-dialog');await ef.getByLabel('Event name').fill('Catalog flight '+info.project.name);await ef.getByRole('button',{name:'Create event',exact:true}).click();await page.locator('#add-pour').click();
    const pf=page.locator('#pour-dialog');await pf.getByLabel('Batch / release').fill('My batch');await pf.getByLabel('Look up a whiskey').fill('eagle');await pf.locator('.lookup-result').first().click();
    await expect(pf.getByLabel('Whiskey name')).toHaveValue(record.name);await expect(pf.getByLabel('Distillery')).toHaveValue(record.distillery);await expect(pf.getByLabel('Batch / release')).toHaveValue('My batch');await pf.getByRole('button',{name:'Add pour',exact:true}).click();
    await expect(page.locator('.flight-card')).toContainText(record.name);state=await(await request.get('/api/state')).json();const p=state.pours.find(p=>p.catalog_id===record.id);expect(p).toBeTruthy();expect(p.release).toBe('My batch');
    await request.delete('/api/events/'+p.event_id);
  }finally{await request.delete('/api/members/'+member.id);}
});
