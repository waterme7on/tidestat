import {selectLanguage} from './language-helper.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:8897';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/live.html?demo=1&lang=en');
 await page.waitForFunction(()=>window.__tideMap?.ready());
 for(const width of [320,390,430]) {
  await page.setViewportSize({width,height:844});
  await page.locator('.online-visitor').first().click();
  await page.locator('.mobile-visitor-detail').waitFor();
  assert.equal(await page.locator('.mobile-visitor-detail .visitor-popup').evaluate(e=>getComputedStyle(e).maxHeight),'none');
  for(const language of ['zh','en']) {
   await selectLanguage(page,language);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.ok(await page.evaluate(()=>document.querySelector('.mobile-visitor-detail').getBoundingClientRect().top>=document.querySelector('.stage').getBoundingClientRect().bottom));
  }
  await page.locator('#liveSignals summary').click();
  assert.equal(await page.locator('#liveSignals').evaluate(e=>getComputedStyle(e).position),'static');
  await page.locator('#liveSignals summary').click();
  await page.locator('.mobile-visitor-close').click();
  assert.equal(await page.locator('.mobile-visitor-detail').count(),0);
 }
 await page.locator('.online-visitor').first().click();
 await page.setViewportSize({width:1440,height:1000});
 await page.waitForFunction(()=>!document.querySelector('.mobile-visitor-detail'));
 await page.locator('.online-visitor').first().click();await page.locator('.maplibregl-popup').waitFor();
 assert.deepEqual(errors,[]);
 console.log('Live mobile passed: EN/ZH at 320/390/430px, details outside map, signals expand, close and desktop transition.');
} finally {await browser.close();}
