import {chromium} from 'playwright';import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:8894';const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'en-US'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 let mark;
 for(const route of ['/','/revenue.html?demo=1','/live.html?demo=1','/docs/index.html']){
  await page.goto(base+route);await page.locator('[data-product-theme]').waitFor({state:'attached'});if(await page.locator('.workspace-settings:not([open])>summary').count())await page.locator('.workspace-settings>summary').click();
  await page.locator('[data-product-language]').selectOption('zh');if(await page.locator('[data-product-theme]').getAttribute('aria-checked')!=='true')await page.locator('[data-product-theme]').click();
  await page.waitForFunction(()=>document.documentElement.lang==='zh-CN'&&document.documentElement.dataset.theme==='dark');
  const path=await page.locator('.brand .tide-brand-mark path').first().getAttribute('d');if(mark)assert.equal(path,mark);else mark=path;
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--tide-accent').trim()),'#ed916f');
  assert.match(await page.locator('h1').first().textContent(),/[\u4e00-\u9fff]/,route+' heading translated');
  const codes=await page.locator('pre').allTextContents();
  await page.locator('[data-product-language]').selectOption('en');if(await page.locator('[data-product-theme]').getAttribute('aria-checked')!=='false')await page.locator('[data-product-theme]').click();
  await page.waitForFunction(()=>document.documentElement.lang==='en'&&document.documentElement.dataset.theme==='light');
  assert.deepEqual(await page.locator('pre').allTextContents(),codes,'code does not change with locale');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--tide-accent').trim()),'#b64d2a');
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' mobile');
  await page.locator('[data-product-language]').selectOption('zh');if(await page.locator('[data-product-theme]').getAttribute('aria-checked')!=='true')await page.locator('[data-product-theme]').click();
  await page.reload();await page.waitForFunction(()=>document.documentElement.lang==='zh-CN'&&document.documentElement.dataset.theme==='dark');
  await page.setViewportSize({width:1440,height:1000});
 }
 await page.goto(base+'/');await page.locator('#demo').scrollIntoViewIfNeeded();const demo=page.frameLocator('iframe');
 // The demo shell opens on the live map; preference sync is a revenue product-ui concern, so flip to that tab (locale-proof selector).
 await page.locator('.demo-tab[data-demo="revenue"]').click();await demo.locator('.dimension-grid').waitFor();
 await page.locator('[data-product-language]').selectOption('en');if(await page.locator('[data-product-theme]').getAttribute('aria-checked')!=='false')await page.locator('[data-product-theme]').click();
 await page.waitForFunction(()=>{const root=document.querySelector('iframe').contentDocument.documentElement;return root.lang==='en'&&root.dataset.theme==='light';});
 assert.deepEqual(errors,[]);console.log('Product consistency passed: identical logos, shared palettes, Chinese/English, code invariance, mobile, persisted preferences and embedded demo sync.');
}finally{await browser.close();}
