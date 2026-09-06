import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:8894';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],api=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
try{
 await page.goto(base+'/');await page.getByRole('heading',{name:'See the story behind every dollar.'}).waitFor();
 await page.locator('#demo').scrollIntoViewIfNeeded();const frame=page.frameLocator('iframe');
 await frame.locator('#metrics').getByText('$97.00',{exact:true}).waitFor();
 await frame.getByRole('tab',{name:'Countries',exact:true}).waitFor();
 await frame.getByRole('tab',{name:'Cities',exact:true}).click();assert.match(await frame.locator('#rows-geography').textContent(),/San Francisco/);
 await frame.locator('[data-tab=stories]').click();await frame.locator('[data-story]').first().click();await frame.locator('#storyDialog[open]').waitFor();
 await frame.getByRole('button',{name:'Close story',exact:true}).click();
 assert.deepEqual(api.filter(url=>new URL(url).pathname!=='/api/plans'),[],'public demo may request the public price catalog, never private analytics');
 await mkdir('visual-review',{recursive:true});await page.screenshot({path:'visual-review/landing-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'visual-review/landing-mobile.png',fullPage:true});
 assert.match(await readFile('dist/index.html','utf8'),/id="hero-title"/);assert.match(await readFile('dist/live.html','utf8'),/liveSignals/);assert.deepEqual(errors,[]);
 console.log('Landing passed: built homepage, embedded interactive demo, visitor story, mobile layout and no private API calls.');
}finally{await browser.close();}
