import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
const errors = [], results = [];
page.on('pageerror', e=>errors.push(e.message));
try {
  const now=Date.now();
  await page.route('**/api/live',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({now,onlineMs:90000,visitors:[{id:'lifecycle-visitor',city:'London',country:'GB',lat:51.5,lng:0,firstTs:now-10000,lastTs:now,paths:[{path:'/zh',ts:now-10000},{path:'/zh/work',ts:now}]}]})}));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8894');
  await page.waitForFunction(()=>window.__tideMap?.ready() && document.getElementById('liveMap').dataset.geography==='ready');
  await page.locator('#tab-park').click();
  await page.waitForFunction(()=>window.__tide3d?.ready());
  assert.equal(await page.locator('#stage3d').isVisible(),true);
  for(let i=0;i<3;i++) {
    await page.locator('#tab-map').click(); await page.waitForTimeout(100);
    assert.equal(await page.locator('#liveMap').isVisible(),true);
    assert.equal(await page.locator('#stage3d').isVisible(),false);
    await page.locator('#tab-park').click(); await page.waitForTimeout(100);
  }
  await page.locator('#tab-map').click();
  assert.equal(await page.locator('#liveMap canvas').count(),1);
  results.push('Existing footprint remains accessible; repeated view switching keeps exactly one native globe canvas');
  await page.locator('#liveMap canvas').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForFunction(()=>document.getElementById('liveMap').dataset.engine==='flat' && window.__tideMap.ready());
  assert.equal(await page.locator('#realtimeCount').textContent(),'1');
  assert.equal(await page.locator('#globeMode').textContent(),'平面兼容模式');
  await page.locator('.online-visitor').click();
  assert.ok((await page.locator('#vdId').textContent()).includes('London'));
  assert.deepEqual(errors,[]);
  results.push('Losing an existing WebGL context switches to local flat map without losing counts or selection');
  await fs.writeFile('visual-review/lifecycle-results.json',JSON.stringify({passed:true,results,errors},null,2));
  console.log(results.join('\n'));
} catch(error) {
  await fs.writeFile('visual-review/lifecycle-results.json',JSON.stringify({passed:false,results,errors,failure:String(error)},null,2));
  await page.screenshot({path:'visual-review/lifecycle-failure.png'}).catch(()=>{}); throw error;
} finally { await browser.close(); }
