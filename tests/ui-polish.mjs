import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:8901';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage(),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;const payload=path==='/api/auth/me'?{user:{id:'ui-test',name:'Website owner',email:'owner@example.com'},billing:{plan:'free',status:'free',limits:{sites:1,monthlyEvents:10000},usage:{events:4321,month:'2026-09'}},capabilities:{google:true,billing:false}}:path==='/api/sites'?{sites:[{id:'ui-site',name:'Yololab',origin:'https://yololab.cc'}]}:path==='/api/revenue'?{overview:{visitors:0,sessions:0,customers:0,currencies:[]},stories:[],sources:[],journeys:[],daily:[]}:{};return route.fulfill({contentType:'application/json',body:JSON.stringify(payload)});});
await mkdir('visual-review/ui-polish',{recursive:true});
try{
 for(const [name,route] of [['dashboard','/revenue.html?demo=1'],['landing','/landing.html'],['pricing','/pricing.html'],['account','/account.html'],['docs','/docs/index.html'],['live','/live.html?demo=1']]){
  for(const [width,language,theme] of [[390,'en','light'],[390,'zh','dark'],[1440,'en','dark'],[1440,'zh','light']]){
   await page.setViewportSize({width,height:900});await page.goto(base+route);await page.locator('.tide-brand-mark').first().waitFor();
   if(name==='account')await page.locator('#startWebsiteSetup').waitFor();
   await page.evaluate(({language,theme})=>{window.__tideI18n.setLanguage(language);window.__tideTheme.setPreference(theme);},{language,theme});
   if(name==='live')await page.waitForFunction(()=>window.__tideMap?.ready());
   await page.waitForFunction(()=>document.querySelector('[data-ui-icon]'));
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   const brokenIcons=await page.locator('svg[data-ui-icon]').evaluateAll(els=>els.filter(e=>!e.querySelector('path')).length);
   const result={name,width,language,theme,overflow,brokenIcons,icons:await page.locator('[data-ui-icon]').count()};results.push(result);
   if(width===390||name==='dashboard')await page.screenshot({path:`visual-review/ui-polish/${name}-${width}-${language}-${theme}.png`,fullPage:name!=='live'});
   assert.equal(overflow,false,JSON.stringify(result));assert.equal(brokenIcons,0,JSON.stringify(result));
  }
 }
 await page.goto(base+'/revenue.html?demo=1');await page.setViewportSize({width:390,height:900});
 assert.equal(await page.locator('#refresh [data-ui-icon=refresh]').count(),1);
 const refresh=await page.locator('#refresh').boundingBox();assert.ok(refresh.width>=36&&refresh.height>=36);
 await page.locator('.workspace-settings summary').click();assert.equal(await page.locator('[data-product-theme]').isVisible(),true);
 if(await page.locator('[data-product-theme]').getAttribute('aria-checked')!=='false')await page.locator('[data-product-theme]').click();await page.locator('[data-product-theme]').click();assert.equal(await page.locator('[data-product-theme]').getAttribute('aria-checked'),'true');
 await page.locator('#settingsSheet .sheet-close').click();await page.locator('#settingsSheet').waitFor({state:'hidden'});await page.locator('#moreMetrics').click();assert.equal(await page.locator('.metric').nth(3).isVisible(),true);
 assert.deepEqual(errors,[]);console.log(`UI polish passed: ${results.length} page / viewport / locale / theme combinations.`);
}finally{await writeFile('visual-review/ui-polish/results.json',JSON.stringify({results,errors},null,2));await browser.close();}
