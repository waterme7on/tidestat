import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:8894';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await mkdir('visual-review',{recursive:true});
try {
 await page.goto(base+'/revenue.html');
 await page.getByRole('heading',{name:'Your first revenue story starts here.'}).waitFor();
 await page.getByRole('button',{name:'Explore sample stories'}).click();
 assert.match(await page.locator('#dataBadge').textContent(),/Sample data/);
 assert.match(await page.locator('#metrics').textContent(),/\$97\.00/);
 assert.equal(await page.locator('#storyList [data-story]').count(),3);
 await page.locator('#storyList [data-story]').first().click();
 await page.locator('#storyDialog[open]').waitFor();
 assert.match(await page.locator('#storyBody').textContent(),/sample_payment_0/);
 await page.getByRole('button',{name:'Close story',exact:true}).click();
 await page.locator('#statusFilter').selectOption('returning');
 assert.equal(await page.locator('#storyList [data-story]').count(),1);
 await page.locator('#statusFilter').selectOption('');
 await page.locator('#visitorSearch').fill('sample_payment_1');
 await page.waitForFunction(()=>document.querySelectorAll('#storyList [data-story]').length===1);
 assert.equal(await page.locator('#storyList [data-story]').count(),1);
 await page.locator('#visitorSearch').fill('');
 await page.waitForFunction(()=>document.querySelectorAll('#storyList [data-story]').length===3);
 await page.screenshot({path:'visual-review/revenue-stories-desktop.png',fullPage:true});
 for(const id of ['journeys','sources','leaks','integrations']) {await page.locator(`nav [data-view="${id}"]`).click();assert.ok(await page.locator('#content').textContent());}
 await page.screenshot({path:'visual-review/revenue-integrations.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.locator('nav [data-view="stories"]').click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile no horizontal overflow');
 await page.screenshot({path:'visual-review/revenue-stories-mobile.png',fullPage:true});
 // Fail-closed connection and escaping check: token travels only in the auth header.
 let observed;
 await page.route('**/api/revenue?*',r=>{observed=r.request();return r.fulfill({status:401,contentType:'application/json',body:'{"error":"unauthorized"}'});});
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#connectionButton').click();
 await page.locator('input[name=site]').fill('site-a');await page.locator('input[name=token]').fill('private-test-token');
 await page.getByRole('button',{name:'Open workspace →'}).click();
 await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('not accepted'));
 assert.equal(new URL(observed.url()).searchParams.get('site'),'site-a');assert.equal(observed.headers().authorization,'Bearer private-test-token');assert.ok(!observed.url().includes('private-test-token'));
 assert.equal(await page.locator('#storyList').count(),0,'previous site data must clear on auth failure');
 assert.deepEqual(errors,[]);
 console.log('Revenue UI passed: sample disclosure, payment timeline, search, returning filter, navigation, mobile, auth isolation.');
} finally {await browser.close();}
