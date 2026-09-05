import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { snapshot, journey, edgeKey, currentNode } from '../footprint-model.js';
const site={nodes:['home','work','writing','dyor','about','subscribe','gate'].map(id=>({id}))};
const traveler={node:'work',target:'home',state:'walking',visited:[{node:'home'},{node:'work'},{node:'home'}]};
assert.deepEqual(journey(traveler,site),[['home','work'],['work','home']]);
assert.equal(currentNode(traveler,site),'home');
assert.equal(edgeKey('home','work'),edgeKey('work','home'));
assert.deepEqual(journey({visited:[{node:'work'},{node:'work'},{node:'writing'}]},site),[['work','writing']]);
const sample=snapshot({visitors:new Map([['a',traveler],['b',{node:'dyor',state:'leaving'}],['c',{node:'unknown',state:'reading'}]]),status:'ready'},site);
assert.equal(sample.visitors.length,2);assert.equal(sample.activeNodes,1);assert.equal(sample.occupants.get('home').length,1);
assert.equal(snapshot({status:'error'},site).unavailable,true);
assert.equal(snapshot({status:'error',updatedAt:1},site).fresh,false);
const base=process.env.BASE_URL||'http://127.0.0.1:8894';
await fs.mkdir('visual-review',{recursive:true});
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],results=['pure model: occupancy, leaving/unknown visitors, reverse paths and repeated visits'];
const data=(()=>{const now=Date.now();const points=[['上海','CN',31,121],['伦敦','GB',51,0],['纽约','US',40,-74],['东京','JP',35,139]];
 return Array.from({length:16},(_,i)=>{const [city,country,lat,lng]=points[i%4];return{id:`footprint-full-${i}`,city,country,lat,lng,firstTs:now-i*3000-20000,lastTs:now,
 paths:[{path:'/zh',ts:now-20000},{path:'/zh/work',ts:now-10000},{path:['/zh/writing','/zh/work','/zh/writing/dyor','/contact'][i%4],ts:now}]};});})();
let visitors=data,status=200;
const page=await browser.newPage({locale:'zh-CN',viewport:{width:1440,height:1000},colorScheme:'dark',reducedMotion:'reduce'});
let inspected=page;
function watch(p){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='warn'||m.type()==='error')console.log('[browser]',m.text());});}
watch(page);
async function mock(p){await p.route('**/api/live',r=>r.fulfill({status,contentType:'application/json',body:JSON.stringify({onlineMs:90000,visitors})}));}
async function open(p){await mock(p);await p.goto(base);await p.waitForFunction(()=>window.__tideMap?.ready());await p.locator('#tab-park').click();await p.waitForFunction(()=>window.__tide3d?.ready(),null,{timeout:15000});await p.waitForTimeout(700);}
async function refresh(p){
 await p.evaluate(()=>window.__tide.refresh());
 // Wait for the data bridge AND its rendered state, not a fixed GPU-dependent delay.
 await p.waitForFunction(({ok,count})=>window.__tide.status===(ok?'ready':'error')&&document.getElementById('footprintCount').textContent===String(count)&&(ok||document.querySelector('.stage').dataset.footprintLights==='0'),{ok:status===200,count:visitors.length},{timeout:10000});
}
async function selected(p,id){
 await p.waitForFunction(id=>window.__tide.selectedId===id,id);
 await p.locator('.footprint-journey').waitFor({state:'visible',timeout:5000});
 assert.equal(await p.locator('.footprint-journey').getAttribute('hidden'),null);
}
try{
 await open(page);assert.equal(await page.locator('.stage').getAttribute('data-footprint-engine'),'3d');
 assert.equal(await page.locator('#footprintCount').textContent(),'16');assert.equal(await page.locator('#footprintActive').textContent(),'4');
 assert.equal(await page.locator('.footprint-node').count(),7);assert.equal(await page.locator('.footprint-person').count(),16);
 const view=await page.evaluate(()=>window.__tide3d.viewState());await page.waitForTimeout(500);assert.deepEqual(await page.evaluate(()=>window.__tide3d.viewState()),view,'no unsolicited rotation');
 const pixels=await page.locator('#stage3d').evaluate(c=>{const gl=c.getContext('webgl2'),p=new Uint8Array(4),colors=new Set();for(let x=.15;x<.9;x+=.05)for(let y=.15;y<.9;y+=.05){gl.readPixels(Math.floor(x*c.width),Math.floor(y*c.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);colors.add([...p].join(','));}return colors.size;});
 assert.ok(pixels>8,'actual rendered buildings, not an empty canvas');
 await page.screenshot({path:'visual-review/footprints-dark-desktop.png'});
 await page.locator('.footprint-node[data-node-id="writing"]').click();assert.equal(await page.locator('.footprint-person').count(),4);
 await page.getByRole('button',{name:'显示全部分区'}).click();assert.equal(await page.locator('.footprint-person').count(),16);
 const person=page.locator('.footprint-person[data-visitor-id="footprint-full-0"]');await person.press('Enter');await selected(page,'footprint-full-0');
 assert.deepEqual(JSON.parse(await page.locator('.stage').getAttribute('data-footprint-route')),[['home','work'],['work','writing']]);
 const svg=await person.locator('svg').evaluate(e=>e.outerHTML);
 assert.equal(await page.locator('.footprint-avatar[data-visitor-id="footprint-full-0"] svg').evaluate(e=>e.outerHTML),svg);
 await page.screenshot({path:'visual-review/footprints-tracked.png'});
 const before=await page.evaluate(()=>window.__tide3d.viewState());await page.locator('#footprintTheme').selectOption('light');await page.waitForTimeout(350);
 assert.deepEqual(await page.evaluate(()=>window.__tide3d.viewState()),before);assert.equal(await person.locator('svg').evaluate(e=>e.outerHTML),svg);
 assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.getByRole('button',{name:'取消访客追踪'}).click();
 await page.locator('.footprint-journey').waitFor({state:'hidden'});
 await page.locator('.footprint-avatar[data-visitor-id="footprint-full-1"]').click();await selected(page,'footprint-full-1');
 await page.getByRole('button',{name:'取消访客追踪'}).click();await page.locator('.footprint-journey').waitFor({state:'hidden'});
 await page.screenshot({path:'visual-review/footprints-light-desktop.png'});
 results.push('desktop: native 3D, correct counts, seven labeled sections, node filter, keyboard and actual avatar selection, actual route and matching B avatars');
 const bounds=await page.locator('#stage3d').boundingBox();await page.mouse.move(bounds.x+bounds.width*.4,bounds.y+bounds.height*.7);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.4+70,bounds.y+bounds.height*.7+15,{steps:8});await page.mouse.up();await page.waitForTimeout(900);
 await page.locator('#footprintReset').click();await page.locator('#footprintPlan').click();assert.equal(await page.locator('#footprintPlan').getAttribute('aria-pressed'),'true');
 await page.locator('#footprintPlan').click();await page.locator('#footprintExpand').click();assert.ok(await page.locator('.footprint-expanded').count());
 await page.screenshot({path:'visual-review/footprints-expanded.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('.footprint-expanded').count(),0);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'visual-review/footprints-light-mobile.png',fullPage:true});
 await page.locator('#footprintTheme').selectOption('dark');await page.locator('#footprintExpand').click();await page.waitForTimeout(300);
 await page.screenshot({path:'visual-review/footprints-dark-mobile-expanded.png'});await page.keyboard.press('Escape');
 results.push('interaction: drag, reset, top-down view, expand/Escape, system theme integration, 390px layout without page overflow');
 await page.setViewportSize({width:1440,height:1000});
 for(let i=0;i<3;i++){await page.locator('#tab-map').click();await page.waitForTimeout(100);await page.locator('#tab-park').click();await page.waitForTimeout(100);}
 assert.equal(await page.locator('#footprintPanel').count(),1);assert.equal(await page.locator('#liveMap canvas').count(),1);assert.equal(await page.locator('#stage3d').count(),1);
 await page.locator('#tab-map').click();assert.equal(await page.locator('#mapTheme').inputValue(),'dark');await page.locator('#tab-park').click();
 status=503;await refresh(page);assert.equal(await page.locator('#footprintCount').textContent(),'16');assert.equal(await page.locator('.stage').getAttribute('data-footprint-lights'),'0');
 status=200;visitors=[];await refresh(page);assert.equal(await page.locator('#footprintCount').textContent(),'0');assert.equal(await page.locator('.footprint-avatar').count(),0);
 assert.ok((await page.locator('.footprint-notice').textContent()).includes('目前没有在线访客'));
 visitors=[{...data[0],id:`full'\"<id>`,city:'<img src=x onerror=window.injected=1>'}];await refresh(page);
 assert.equal(await page.locator('.footprint-roster img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
 results.push('live data: departures and zero state, stale-data lamps off, recovery and text escaping; repeated tabs preserve a single instance');
 await page.locator('#stage3d').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
 await page.waitForFunction(()=>document.querySelector('.stage').dataset.footprintEngine==='flat');
 assert.ok(await page.locator('.footprint-flat').isVisible());await page.locator('.footprint-person').click();await selected(page,visitors[0].id);
 const flat=await browser.newPage({locale:'zh-CN',viewport:{width:390,height:844},colorScheme:'light',reducedMotion:'reduce'});watch(flat);inspected=flat;
 await flat.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:original.call(this,type,...args);};});
 await flat.bringToFront();await open(flat);assert.equal(await flat.locator('.stage').getAttribute('data-footprint-engine'),'flat');assert.equal(await flat.locator('#stage3d').isVisible(),false);
 await flat.locator('#footprintTheme').selectOption('dark');assert.equal(await flat.locator('html').getAttribute('data-theme'),'dark');
 await flat.locator('.footprint-person').click();await selected(flat,visitors[0].id);
 await flat.screenshot({path:'visual-review/footprints-flat-mobile.png',fullPage:true});inspected=page;await flat.close();
 results.push('compatibility: unavailable/lost WebGL uses themed local flat footprint with working visitor selection');
 assert.deepEqual(errors,[]);
 await fs.writeFile('visual-review/footprint-results.json',JSON.stringify({passed:true,results,errors},null,2));console.log(results.join('\n'));
}catch(error){
 await inspected.screenshot({path:'visual-review/footprint-failure.png',fullPage:true}).catch(()=>{});
 const state=await inspected.evaluate(()=>({visibility:document.visibilityState,view:document.body.dataset.view,ready:window.__tide3d?.ready(),engine:document.querySelector('.stage')?.dataset.footprintEngine,id:window.__tide?.selectedId,visitors:[...(window.__tide?.visitors?.keys()||[])],journey:document.querySelector('.footprint-journey')?.outerHTML})).catch(()=>null);
 await fs.writeFile('visual-review/footprint-results.json',JSON.stringify({passed:false,results,errors,state,failure:String(error)},null,2));throw error;
}finally{await browser.close();}
