import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:8901';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:390,height:844},locale:'en-US'});
let received=false,denied=false,lastRequest,errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',r=>{const request=r.request(),path=new URL(request.url()).pathname;let data={};let status=200;
 if(path==='/api/auth/me')data={user:{id:'owner',name:'Owner'},billing:{plan:'free',status:'free',limits:{sites:2,monthlyEvents:10000},usage:{month:'2026-09',events:0}},capabilities:{google:true,billing:false}};
 if(path==='/api/sites')data={sites:[{id:'one',name:'First',origin:'https://one.example'},{id:'two',name:'Second',origin:'https://two.example'}]};
 if(path==='/api/setup'){lastRequest=request;status=denied?401:200;data={site:new URL(request.url()).searchParams.get('site'),originAllowed:true,pageviewReceived:received,lastPageviewAt:received?Date.now():null};}
 if(path==='/api/revenue')data={overview:{visitors:0,sessions:0,customers:0,currencies:[]},stories:[],sources:[],journeys:[],daily:[]};
 return r.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
});
try{
 await page.goto(base+'/account.html');await page.locator('#startWebsiteSetup').click();
 assert.equal(await page.locator('#agentGuide').isVisible(),true);assert.equal(await page.locator('#connectForm [name=token]').isVisible(),false);
 assert.match(await page.locator('#agentTask').inputValue(),/already registered/);
 assert.match(await page.locator('#agentTask').inputValue(),/unpublished: do not run npm install/);
 await page.locator('#skillInstall summary').click();const downloadPromise=page.waitForEvent('download');await page.locator('#downloadSkill').click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'SKILL.md');const skill=await (await import('node:fs/promises')).readFile(await download.path(),'utf8');assert.match(skill,/name: tidestat-connect/);assert.match(skill,/npm install "\/absolute\/path/);
 await page.locator('#skillInstall summary').click();
 await page.locator('#switchMethod').click();assert.equal(await page.locator('#manualGuide').isVisible(),true);await page.locator('#localSdkGuide summary').click();assert.match(await page.locator('#localSdkGuide pre').textContent(),/npm install "\/absolute\/path/);assert.equal(await page.locator('#manualGuide a[href*=sites]').isVisible(),false);
 await page.locator('#switchMethod').click();denied=true;await page.locator('#connectForm [type=submit]').click();await page.waitForFunction(()=>document.querySelector('#setupError').textContent.includes('Sign in'));
 assert.equal(await page.locator('#installStep').isVisible(),true);denied=false;await page.locator('#connectForm [type=submit]').click();await page.locator('#verifyStep').waitFor({state:'visible'});
 assert.equal(lastRequest.headers().authorization,undefined);await page.locator('#verifyVisit').click();await page.waitForFunction(()=>document.querySelector('#verifyResult').textContent.includes('Waiting'));assert.equal(await page.locator('#finishSetup').isVisible(),false);
 received=true;await page.locator('#verifyVisit').click();await page.locator('#finishSetup').waitFor({state:'visible'});
 await page.screenshot({path:'visual-review/ui-polish/setup-verified-mobile.png'});
 await page.locator('[data-close=connectDialog]').click();await page.locator('[data-site-choice=two]').click();await page.locator('#startWebsiteSetup').click();
 assert.match(await page.locator('#agentTask').inputValue(),/https:\/\/two.example/);assert.equal(await page.locator('#finishSetup').isVisible(),false,'verification cannot leak to another website');
 await page.locator('[data-close=connectDialog]').click();await page.locator('[data-site-choice=one]').click();await page.locator('#startWebsiteSetup').click();assert.equal(await page.locator('#finishSetup').isVisible(),true);
 await page.locator('[data-close=connectDialog]').click();await page.goto(base+'/revenue.html');await page.locator('#setupProgress').click();await page.locator('#finishSetup').waitFor({state:'visible'});
 await page.screenshot({path:'visual-review/ui-polish/setup-dashboard-receipt-mobile.png'});
 await page.locator('[data-close=connectDialog]').click();await page.locator('.workspace-settings summary').click();await page.locator('#manageConnection').click();
 await page.locator('#websiteForm [name=url]').fill('https://legacy.example');await page.locator('#websiteForm [name=site]').fill('legacy');await page.locator('#websiteForm button').click();
 assert.equal(await page.locator('#connectForm [name=token]').isVisible(),true);denied=true;await page.locator('#connectForm [name=token]').fill('private-test-token');await page.locator('#connectForm [type=submit]').click();await page.waitForFunction(()=>document.querySelector('#setupError').textContent.includes('read token'));assert.ok(!lastRequest.url().includes('private-test-token'));assert.ok(!(await page.locator('#agentTask').inputValue()).includes('private-test-token'));
 await page.screenshot({path:'visual-review/ui-polish/setup-agent-mobile.png'});
 assert.deepEqual(errors,[]);console.log('Setup UI passed: account cookie, both methods, auth failure, fresh event, per-site resume and private legacy credentials.');
}finally{await browser.close();}
