import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:8901';
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:390,height:844},locale:'en-US'}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
let release,reply={pageviewReceived:false},requests=0;
await page.route('**/api/**',async route=>{
 const url=new URL(route.request().url());let body={};
 if(url.pathname==='/api/auth/me')body={user:{id:'owner',name:'Owner'},billing:{plan:'free',limits:{sites:2},usage:{}},capabilities:{google:true}};
 if(url.pathname==='/api/sites')body={sites:[{id:'one',name:'First',origin:'https://one.example'}]};
 if(url.pathname==='/api/revenue')body={overview:{visitors:0,sessions:0,customers:0,currencies:[]},stories:[],sources:[],journeys:[],daily:[]};
 if(url.pathname==='/api/setup'){requests++;await new Promise(resolve=>release=resolve);body={site:'one',originAllowed:true,...reply};}
 await route.fulfill({status:reply.fail&&url.pathname==='/api/setup'?503:200,contentType:'application/json',body:JSON.stringify(body)});
});
const settle=()=>page.evaluate(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
const openSheet=async()=>{await page.locator('.workspace-settings summary').click();await page.locator('#settingsSheet').waitFor({state:'visible'});await settle();};
const closed=async()=>{await page.locator('#settingsSheet').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>document.body.style.overflow),'');assert.equal(await page.locator('.workspace-settings .settings-panel').count(),1);};
const respond=async data=>{reply=data;await page.waitForFunction(()=>document.querySelector('#connectForm [type=submit][aria-busy=true],#verifyVisit[aria-busy=true]'));await release();};
await mkdir('visual-review/ui-motion',{recursive:true});
try{
 await page.goto(base+'/revenue.html?demo=1');await page.locator('.workspace-settings').waitFor();
 await openSheet();const box=await page.locator('#settingsSheet').boundingBox();assert.ok(Math.abs(box.y+box.height-844)<2);assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
 await page.locator('[data-product-theme]').click();assert.equal(await page.locator('[data-product-theme]').getAttribute('aria-checked'),'true');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('#settingsSheet').contains(document.activeElement)),true);
 await settle();await page.screenshot({path:'visual-review/ui-motion/settings-sheet-mobile.png'});
 await page.keyboard.press('Escape');await closed();assert.equal(await page.locator('.workspace-settings summary').evaluate(el=>el===document.activeElement),true);
 await openSheet();await page.mouse.click(10,50);await closed();
 await openSheet();const grip=await page.locator('.sheet-grip').boundingBox();await page.mouse.move(grip.x+grip.width/2,grip.y+10);await page.mouse.down();await page.mouse.move(grip.x+grip.width/2,grip.y+130,{steps:8});await page.mouse.up();await closed();
 await openSheet();await page.setViewportSize({width:1440,height:900});await closed();assert.equal(await page.locator('.workspace-settings').getAttribute('open'),'');await page.setViewportSize({width:390,height:844});await page.locator('#settingsSheet').waitFor({state:'visible'});await page.locator('.sheet-close').click();await closed();
 await page.locator('.top-tabs [data-tab=stories]').click();await settle();await page.waitForFunction(()=>document.querySelector('.top-tabs [data-tab=stories]').classList.contains('active'));
 const aligned=()=>page.evaluate(()=>{const a=document.querySelector('.top-tabs .active').getBoundingClientRect(),b=document.querySelector('.top-tabs .sliding-tab-indicator').getBoundingClientRect();return Math.abs(a.x-b.x)<2&&Math.abs(a.width-b.width)<2;});await settle();assert.ok(await aligned());
 await page.locator('.top-tabs [data-tab=stories]').press('ArrowRight');await page.waitForFunction(()=>location.hash.includes('insights'));await settle();assert.ok(await aligned());
 await page.emulateMedia({reducedMotion:'reduce'});await openSheet();assert.equal(await page.locator('#settingsSheet').evaluate(el=>el.getAnimations().length),0);await page.keyboard.press('Escape');await closed();
 await openSheet();await page.locator('#manageConnection').click();await page.locator('#connectDialog').waitFor({state:'visible'});await closed();await page.locator('[data-close=connectDialog]').click();
 await page.goto(base+'/account.html');await page.locator('#startWebsiteSetup').click();
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}}));await page.locator('#copyAgent').click();await page.waitForFunction(()=>document.querySelector('#copyAgent').dataset.actionState==='error');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}}));await page.locator('#copyAgent').click();await page.waitForFunction(()=>document.querySelector('#copyAgent').dataset.actionState==='success');
 await page.locator('#connectForm [type=submit]').click();assert.equal(await page.locator('#connectForm [type=submit]').isDisabled(),true);await page.waitForFunction(()=>document.querySelector('#connectForm [type=submit]').dataset.actionState==='pending');await respond({fail:true});await page.waitForFunction(()=>document.querySelector('#connectForm [type=submit]').dataset.actionState==='error');
 await page.locator('#connectForm [type=submit]').click();await respond({pageviewReceived:false});await page.locator('#verifyStep').waitFor({state:'visible'});
 await page.locator('#verifyVisit').click();await respond({pageviewReceived:false});await page.waitForFunction(()=>document.querySelector('#verifyVisit').dataset.actionState==='waiting');assert.equal(await page.locator('#finishSetup').isVisible(),false);
 await page.locator('#verifyVisit').click();await respond({pageviewReceived:true,lastPageviewAt:Date.now()});await page.locator('#finishSetup').waitFor({state:'visible'});assert.equal(await page.locator('#verifyResult time').count(),1);await settle();await page.screenshot({path:'visual-review/ui-motion/verification-success-mobile.png'});
 // Closing during a request invalidates its result; reopening remains usable.
 await page.locator('#backInstall').click();await page.locator('#connectForm [type=submit]').click();await page.locator('[data-close=connectDialog]').click();await page.locator('#startWebsiteSetup').click();assert.equal(await page.locator('#connectForm [type=submit]').isDisabled(),false);await release();await page.waitForFunction(()=>document.querySelector('#connectForm [type=submit]').dataset.actionState==='idle');assert.equal(await page.locator('#installStep').isVisible(),true);
 assert.equal(requests,5);assert.deepEqual(errors,[]);console.log('UI motion passed: sheet focus/backdrop/swipe/resize, tabs and keyboard, reduced motion, copy retry, verification states and stale request recovery.');
}finally{await browser.close();}
