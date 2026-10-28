import {test,expect} from '@playwright/test';
test('combined lookup filters and pages review candidates, saving exact batch and year',async({page,request})=>{
  const member=await(await request.post('/api/members',{data:{name:'Review lookup member'}})).json();
  try{
    await page.goto('/');await page.locator('#add-bottle').click();const f=page.locator('#bottle-dialog');await f.locator('[name=member_id]').selectOption(String(member.id));
    await page.locator('#lookup-source').selectOption('reviews');await page.locator('#lookup').fill('TEST SOCIETY');await expect(page.locator('#lookup-results .lookup-result')).toHaveCount(25);
    await page.getByRole('button',{name:'Next results',exact:true}).click();await expect(page.locator('#lookup-results .lookup-result')).toHaveCount(5);
    await page.locator('#lookup').fill('TEST SOCIETY C029');await expect(page.locator('#lookup-results .lookup-result')).toHaveCount(1);await page.locator('#lookup-results .lookup-result').click();
    await expect(f.locator('[name=release]')).toHaveValue('C029');await expect(f.locator('[name=year]')).toHaveValue('2023');await expect(f.locator('[name=proof]')).toHaveValue('100');await expect(f.locator('[name=distillery]')).toHaveValue('');await expect(f.locator('[name=price]')).toHaveValue('');await expect(page.locator('#catalog-reference')).not.toContainText('CC BY');
    await expect(f.getByLabel('Label name',{exact:true})).toHaveValue('TEST FLIGHT');
    await expect(page.locator('#catalog-reference')).toContainText('Label: TEST FLIGHT');
    await f.getByRole('button',{name:'Save bottle'}).click();const state=await(await request.get('/api/state')).json(),b=state.bottles.find(b=>b.member_id===member.id);expect(b.release).toBe('C029');expect(b.year).toBe(2023);expect(b.catalog_id).toMatch(/^reviews:/);expect(b.price).toBeNull();
    await page.locator('.bottle-card').filter({hasText:'TEST SOCIETY'}).click();await page.getByRole('button',{name:'Edit bottle',exact:true}).click();await expect(f.locator('[name=release]')).toHaveValue('C029');await f.getByRole('button',{name:'Cancel'}).click();
    expect(b.label).toBe('TEST FLIGHT');
  }finally{await request.delete('/api/members/'+member.id);}
});
