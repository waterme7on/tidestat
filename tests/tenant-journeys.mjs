import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:8894';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const now=Date.now();
const payload=site=>({site,onlineMs:90000,visitors:[{id:'identical-visitor',city:site==='one'?'London':'Tokyo',country:site==='one'?'GB':'JP',lat:35,lng:139,firstTs:now-10000,lastTs:now,paths:[{path:`/${site}/entry`,sessionId:'same-session',ts:now-10000},{path:`/${site}/detail`,sessionId:'same-session',ts:now}]}]});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
let failTwo=false,emptyTwo=false,newPage=false,wrongSite=false,unauthorized=false;
await page.route('**/api/auth/me',r=>r.fulfill({json:{user:{id:'owner'},capabilities:{}}}));
await page.route('**/api/sites',r=>r.fulfill({json:{sites:[{id:'one'},{id:'two'}]}}));
await page.route('**/api/live?*',r=>{
 if(unauthorized)return r.fulfill({status:401,json:{error:"expired session"}});
 const site=new URL(r.request().url()).searchParams.get('site'),data=payload(site);
 if(wrongSite)return r.fulfill({json:payload('one')});
 if(site==='two'&&failTwo)return r.fulfill({status:503,json:{error:'offline'}});
 if(site==='two'&&emptyTwo)data.visitors=[];
 if(site==='two'&&newPage)data.visitors[0].paths.push({path:'/two/new-page',sessionId:'same-session',ts:now+1});
 return r.fulfill({json:data});
});
await page.addInitScript(()=>{
 const original=window.fetch;
 window.fetch=(input,options)=>{
  if(window.holdOne&&String(input).includes('/api/live?site=one')){
   window.oldRequested=true;
   return new Promise(resolve=>{window.releaseOld=()=>resolve(Response.json(window.oldPayload));});
  }
  return original(input,options);
 };
});
try{
 await page.goto(base+'/live.html?view=park');
 await page.waitForFunction(()=>window.__tide?.status==='ready'&&window.__tide3d?.ready());
 await page.locator('.footprint-node[data-node-id="/one/detail"]').waitFor();
 assert.equal(await page.locator('.footprint-node').count(),2);
 await page.evaluate(()=>window.__tide.openTimeline('identical-visitor'));
 await page.locator('#timelineDialog').waitFor({state:'visible'});
 await page.evaluate(data=>{window.oldPayload=data;window.holdOne=true;window.__tide.refresh();},payload('one'));
 await page.waitForFunction(()=>window.oldRequested);
 failTwo=true;
 await page.evaluate(()=>window.tideConnection.select('two'));
 assert.equal(await page.locator('#timelineDialog').isVisible(),false);
 assert.equal(await page.locator('#vdTimeline').textContent(),'');
 assert.equal(await page.locator('.footprint-node').count(),0);
 assert.equal(await page.locator('.footprint-person').count(),0);
 assert.equal(await page.locator('#events').textContent(),'');
 await page.waitForFunction(()=>window.__tide.status==='error');
 await page.evaluate(()=>window.releaseOld());
 await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>window.__tide.visitors.size),0);
 assert.equal(await page.locator('.footprint-node').count(),0);
 assert.equal(await page.locator('#vdMeta').textContent(),'');
 assert.equal(await page.locator('.stage').getAttribute('data-footprint-route'),'[]');
 failTwo=false;wrongSite=true;await page.evaluate(()=>window.__tide.refresh());
 assert.equal(await page.evaluate(()=>window.__tide.status),'error');
 assert.equal(await page.evaluate(()=>window.__tide.visitors.size),0);
 wrongSite=false;emptyTwo=true;await page.evaluate(()=>window.__tide.refresh());
 await page.waitForFunction(()=>window.__tide.status==='ready');
 assert.equal(await page.locator('.footprint-node').count(),0);
 emptyTwo=false;await page.evaluate(()=>window.__tide.refresh());
 await page.locator('.footprint-node[data-node-id="/two/detail"]').waitFor();
 assert.equal(await page.locator('.footprint-node').count(),2);
 newPage=true;await page.evaluate(()=>window.__tide.refresh());
 await page.locator('.footprint-node[data-node-id="/two/new-page"]').waitFor();
 assert.equal(await page.locator('.footprint-node').count(),3);
 await page.evaluate(()=>window.__tide.selectVisitor('identical-visitor'));
 await page.waitForFunction(()=>document.querySelector('.stage').dataset.footprintRoute.includes('/two/new-page'));
 assert.deepEqual(await page.evaluate(()=>JSON.parse(document.querySelector('.stage').dataset.footprintRoute)),[['/two/entry','/two/detail'],['/two/detail','/two/new-page']]);
 await page.screenshot({path:'visual-review/tenant-journeys.png'});
 unauthorized=true;await page.evaluate(()=>window.__tide.refresh());
 assert.equal(await page.evaluate(()=>window.__tide.status),'error');
 assert.equal(await page.locator('.footprint-person').count(),0);
 await page.evaluate(()=>window.tideConnection.clear());
 assert.equal(await page.evaluate(()=>window.__tide.visitors.size),0);
 assert.equal(await page.locator('.footprint-node').count(),0);
 assert.equal(await page.locator('#vdTimeline').textContent(),'');
 assert.deepEqual(errors,[]);
 console.log('Tenant switching, failed/empty site, ignored late response, dynamic pages and logout isolation passed');
}finally{await browser.close();}
