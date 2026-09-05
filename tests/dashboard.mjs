import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:8894';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[],errors=[],external=[];let inspected;
await fs.mkdir('visual-review',{recursive:true});
function watch(p){inspected=p;p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base))external.push(r.url());});}
async function ready(p,url='/?lang=en'){await p.goto(base+url);await p.waitForFunction(()=>window.__tideMap?.ready()&&document.getElementById('liveMap').dataset.geography==='ready',null,{timeout:30000});}
const now=Date.now();let visitors=[{id:'long-internal-visitor-one',maskedIp:'203.*.*.42',city:'London',country:'GB',lat:51.5,lng:-.13,firstTs:now-60000,lastTs:now,paths:[{path:'/zh',ts:now-60000},{path:'/zh/work',ts:now-30000},{path:'/zh/writing/example',ts:now-1000}]},{id:'legacy-visitor',city:'Tokyo',country:'JP',lat:35.7,lng:139.7,firstTs:now-10000,lastTs:now,paths:[]}];
async function mock(p){await p.route('**/api/live',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({onlineMs:90000,visitors})}));}
try{
 const page=await browser.newPage({locale:'en-US',viewport:{width:1440,height:1000},reducedMotion:'reduce',colorScheme:'dark'});watch(page);await mock(page);await ready(page,'/');
 assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.equal(await page.locator('#tab-map').textContent(),'Live visitors');
 await page.locator('.online-visitor').filter({hasText:'London'}).click();await page.locator('.visitor-popup').waitFor();
 assert.match(await page.locator('.visitor-popup-head').textContent(),/203\.\*\.\*\.42/);
 assert.doesNotMatch(await page.locator('.visitor-popup-head').textContent(),/long-internal/);
 const svg=await page.locator('.visitor-popup svg').evaluate(e=>e.outerHTML);
 const camera=await page.evaluate(()=>window.__tideMap.camera());
 await page.locator('#languageSelect').selectOption('zh');await page.waitForTimeout(400);
 assert.equal(await page.locator('html').getAttribute('lang'),'zh-CN');assert.equal(await page.locator('#tab-map').textContent(),'实时访问人数');
 assert.equal(await page.locator('.visitor-popup svg').evaluate(e=>e.outerHTML),svg);assert.deepEqual(await page.evaluate(()=>window.__tideMap.camera()),camera);
 await page.getByRole('button',{name:'查看访问时间线 →',exact:true}).click();
 await page.locator('#timelineDialog[open]').waitFor();assert.equal(await page.locator('#timelineDialog #vdTimeline li').count(),3);
 assert.match(await page.locator('#timelineDialog').textContent(),/\/zh\/writing\/example/);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'vdClose');
 await page.screenshot({path:'visual-review/timeline-zh-desktop.png'});
 // Native modal keyboard trap and Escape restore the same sidebar panel.
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.getElementById('timelineDialog').contains(document.activeElement)),true);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.__tide.timelineOpen);assert.equal(await page.locator('#visitorDetail').count(),1);
 assert.equal(await page.evaluate(()=>document.activeElement.textContent),'查看访问时间线 →');
 await page.locator('#mapExpand').click();await page.locator('.online-visitor').filter({hasText:'London'}).evaluate(e=>e.click());
 await page.getByRole('button',{name:'查看访问时间线 →',exact:true}).click();await page.locator('#timelineDialog[open]').waitFor();assert.equal(await page.locator('.map-expanded').count(),0);
 // A visitor departing while the timeline is open must not close it or retain an online count.
 visitors=visitors.slice(1);await page.evaluate(()=>window.__tide.refresh());await page.waitForTimeout(700);
 assert.equal(await page.locator('#realtimeCount').textContent(),'1');assert.equal(await page.locator('#timelineDialog[open]').count(),1);assert.match(await page.locator('#vdMeta').textContent(),/已离线/);
 await page.locator('#vdClose').click();
 await page.locator('.online-visitor').click();assert.match(await page.locator('.visitor-popup-head').textContent(),/IP 暂不可用/);
 await page.locator('#languageSelect').selectOption('en');assert.match(await page.locator('.visitor-popup-head').textContent(),/IP unavailable/);
 await page.reload();await page.waitForFunction(()=>window.__tideMap?.ready());assert.equal(await page.locator('html').getAttribute('lang'),'en');
 results.push('Timeline explicitly opens in normal/expanded mode, traps focus, handles Escape and keeps history after departure; masked/unknown IP labels; English/Chinese preserves camera, avatar and persisted preference');
 await page.locator('#tab-park').click();await page.waitForFunction(()=>window.__tide3d?.ready());await page.waitForTimeout(350);
 assert.equal(await page.locator('.footprint-heading h1').textContent(),'Site journeys');
 assert.equal(await page.locator('.footprint-node[data-node-id="home"] span').textContent(),'Home');
 await page.locator('.footprint-person').click();await page.getByRole('button',{name:'View visit timeline →',exact:true}).click();await page.locator('#timelineDialog[open]').waitFor();
 assert.match(await page.locator('#vdTimeline').textContent(),/No recorded pages yet/);
 await page.locator('#vdClose').click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'visual-review/journeys-en-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#languageSelect').selectOption('zh');assert.equal(await page.locator('.footprint-heading h1').textContent(),'网站足迹');
 await page.close();
 // No real collect/live calls, dense realistic demo, complete per-visitor history.
 const demo=await browser.newPage({locale:'en-US',viewport:{width:1440,height:1000},reducedMotion:'reduce'});watch(demo);const api=[];demo.on('request',r=>{if(r.url().includes('/api/'))api.push(r.url());});
 await ready(demo,'/?demo=1');const counts=[];for(let i=0;i<8;i++){counts.push(await demo.evaluate(()=>window.__tide.visitors.size));await demo.waitForTimeout(600);}
 assert.ok(counts.every(n=>n>=100&&n<=150),JSON.stringify(counts));assert.equal(api.length,0);
 await demo.locator('.online-visitor[data-visitor-id="v0050"]').click();await demo.getByRole('button',{name:'View visit timeline →',exact:true}).click();await demo.locator('#timelineDialog[open]').waitFor();
 assert.ok(await demo.locator('#vdTimeline li').count()>=3);assert.match(await demo.locator('#vdId').textContent(),/203\.\*\.\*\./);assert.match(await demo.locator('#vdMeta').textContent(),/Simulated IP/);
 await demo.screenshot({path:'visual-review/timeline-demo-en.png'});await demo.locator('#vdClose').click();
 await demo.screenshot({path:'visual-review/demo-120-en-desktop.png'});
 await demo.setViewportSize({width:390,height:844});await demo.locator('.online-visitor').first().click();await demo.getByRole('button',{name:'View visit timeline →',exact:true}).click();
 assert.ok(await demo.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await demo.screenshot({path:'visual-review/timeline-en-mobile.png'});
 results.push('120-person warm start and bounded 100–150 sampled demo population; simulated IP and multi-step timeline; English mobile; no demo API calls');await demo.close();
 // Idle spin is slow, cancellable, and independent from data updates. Real waiting validates the browser clock.
 const motion=await browser.newPage({locale:'en-US',viewport:{width:1200,height:850},reducedMotion:'no-preference'});watch(motion);await mock(motion);await ready(motion);await motion.bringToFront();
 await motion.mouse.move(10,10);const before=await motion.evaluate(()=>window.__tideMap.camera());
 await motion.waitForFunction(()=>document.getElementById('liveMap').dataset.rotating==='true',null,{timeout:20000});await motion.waitForTimeout(1000);
 const after=await motion.evaluate(()=>window.__tideMap.camera());assert.ok(Math.abs(after.center[0]-before.center[0])>.1);assert.ok(Math.abs(after.center[0]-before.center[0])<6);
 await motion.mouse.move(30,30);await motion.waitForTimeout(80);assert.equal(await motion.locator('#liveMap').getAttribute('data-rotating'),'false');
 const paused=await motion.evaluate(()=>window.__tideMap.camera());await motion.waitForTimeout(700);assert.deepEqual(await motion.evaluate(()=>window.__tideMap.camera()),paused);
 await motion.locator('#mapRotate').click();assert.equal(await motion.locator('#mapRotate').getAttribute('aria-pressed'),'false');
 await motion.locator('#mapRotate').click();await motion.emulateMedia({reducedMotion:'reduce'});await motion.waitForTimeout(100);assert.equal(await motion.locator('#mapRotate').isDisabled(),true);
 await motion.emulateMedia({reducedMotion:'no-preference'});
 await motion.locator('#tab-park').click();await motion.waitForFunction(()=>window.__tide3d?.ready());
 const journeyCamera=await motion.evaluate(()=>window.__tide3d.viewState());
 await motion.waitForFunction(()=>document.querySelector('.stage').dataset.footprintRotating==='true',null,{timeout:20000});await motion.waitForTimeout(800);
 assert.notDeepEqual(await motion.evaluate(()=>window.__tide3d.viewState()),journeyCamera);
 await motion.mouse.move(50,50);await motion.waitForFunction(()=>document.querySelector('.stage').dataset.footprintRotating==='false');
 await motion.close();results.push('Idle globe rotation starts after delay, is slow, immediately pauses on input, supports manual stop and respects reduced-motion');
 // WebGL-less timeline, localization and masked display remain usable.
 const flat=await browser.newPage({locale:'en-US',viewport:{width:390,height:844},reducedMotion:'reduce'});watch(flat);await mock(flat);
 await flat.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:old.call(this,type,...args);};});
 await ready(flat);await flat.locator('.online-visitor').first().click();await flat.getByRole('button',{name:'View visit timeline →',exact:true}).click();await flat.locator('#timelineDialog[open]').waitFor();await flat.locator('#vdClose').click();
 assert.equal(await flat.locator('#globeMode').textContent(),'2D compatibility mode');await flat.close();
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await fs.writeFile('visual-review/dashboard-results.json',JSON.stringify({passed:true,results,counts,errors,external},null,2));console.log(results.join('\n'));
}catch(error){await inspected?.screenshot({path:'visual-review/dashboard-failure.png',fullPage:true}).catch(()=>{});await fs.writeFile('visual-review/dashboard-results.json',JSON.stringify({passed:false,results,errors,external,failure:String(error),stack:error.stack},null,2));throw error;}finally{await browser.close();}
