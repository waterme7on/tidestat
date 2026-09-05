import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.BASE_URL || 'http://127.0.0.1:8894';
const output = 'visual-review';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [], errors = [], remote = [];
let page;
const cities = [
  ['San Francisco','US',37.77,-122.42],['Los Angeles','US',34.05,-118.24],['Seattle','US',47.61,-122.33],['Vancouver','CA',49.28,-123.12],
  ['Portland','US',45.52,-122.68],['San Diego','US',32.72,-117.16],['Las Vegas','US',36.17,-115.14],['Denver','US',39.74,-104.99],
  ['Austin','US',30.27,-97.74],['Chicago','US',41.88,-87.63],['Toronto','CA',43.65,-79.38],['Montreal','CA',45.5,-73.57],
  ['New York','US',40.71,-74.01],['Boston','US',42.36,-71.06],['Miami','US',25.76,-80.19],['Atlanta','US',33.75,-84.39],
  ['Mexico City','MX',19.43,-99.13],['Guadalajara','MX',20.67,-103.35],['Cancun','MX',21.16,-86.85],['Oaxaca','MX',17.07,-96.72],
  ['San Jose','CR',9.93,-84.08],['Panama City','PA',8.98,-79.52],['Medellin','CO',6.24,-75.58],['Bogota','CO',4.71,-74.07],
  ['Quito','EC',-.18,-78.47],['Lima','PE',-12.05,-77.04],['Cusco','PE',-13.53,-71.97],['Santiago','CL',-33.45,-70.67],
  ['Buenos Aires','AR',-34.6,-58.38],['Montevideo','UY',-34.9,-56.16],['Sao Paulo','BR',-23.55,-46.63],['Rio de Janeiro','BR',-22.91,-43.17],
  ['Florianopolis','BR',-27.59,-48.55],['Brasilia','BR',-15.79,-47.88],['Recife','BR',-8.05,-34.88],['Fortaleza','BR',-3.73,-38.53],
  ['London','GB',51.51,-.13],['Lisbon','PT',38.72,-9.14],['Paris','FR',48.86,2.35],['Berlin','DE',52.52,13.41],
  ['Cape Town','ZA',-33.92,18.42],['Dubai','AE',25.2,55.27],['Singapore','SG',1.35,103.82],['Tokyo','JP',35.68,139.69],
  ['Shanghai','CN',31.23,121.47],['Shenzhen','CN',22.54,114.06],['Seoul','KR',37.57,126.98],['Sydney','AU',-33.87,151.21]
];
const now = Date.now();
function visitor(id, c, index = 0) {
  return { id, city:c[0],country:c[1],lat:c[2],lng:c[3],device:'desktop',firstTs:now-60000-index*1000,lastTs:now,
    paths:[{path:'/zh',ts:now-60000},{path: index % 2 ? '/zh/writing' : '/zh/work',ts:now-5000}] };
}
const fixture = cities.map((c, i) => visitor(`guest-${String(i).padStart(3,'0')}`, c, i));
fixture.push(visitor('samecity-one', cities[0]), visitor('samecity-two', cities[0]));
fixture.push(visitor('missing-location', ['未知位置','',null,null]));
const unsafeVisitor = visitor(`unsafe'"<id>`, ['Tokyo <img src=x onerror=window.pwned=1>','JP',35.68,139.69]);
let payload = { now, onlineMs:90000, visitors: fixture }, status = 200;
function watch(p) {
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
  p.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith(base)) remote.push(r.url()); });
}
async function mock(p) {
  await p.route('**/api/live', route => route.fulfill({ status, contentType:'application/json', body:JSON.stringify(payload) }));
}
async function settled(p, engine = 'globe') {
  await p.waitForFunction(() => window.__tideMap?.ready(), null, { timeout:30000 });
  await p.waitForFunction(() => document.getElementById('liveMap').dataset.geography === 'ready');
  assert.equal(await p.locator('#liveMap').getAttribute('data-engine'), engine);
  await p.waitForTimeout(1400);
}
async function colors(p) {
  return p.locator('#liveMap canvas').evaluate(c => {
    const gl = c.getContext('webgl2'), found = new Set(), pixel = new Uint8Array(4);
    for (let x=.1;x<.91;x+=.03) for (let y=.1;y<.91;y+=.03) {
      gl.readPixels(Math.floor(c.width*x),Math.floor(c.height*y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);found.add([...pixel].join(','));
    }
    return found.size;
  });
}
try {
  page = await browser.newPage({locale:'zh-CN', viewport:{width:1440,height:1000}, reducedMotion:'reduce' }); watch(page); await mock(page);
  await page.goto(base); await settled(page);
  assert.equal(await page.locator('#realtimeCount').textContent(), String(fixture.length));
  assert.equal(await page.locator('#tab-map').textContent(), '实时访问人数');
  assert.equal(await page.evaluate(() => window.__tideMap.camera().projection), 'globe');
  assert.ok(await colors(page) > 15, 'Actual native globe, geography and colored avatars must render');
  assert.equal(await page.locator('#tileNotice').isVisible(), false);
  assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').some(e => /three\.module|OrbitControls|leaflet\.js/.test(e.name))), false);
  await page.screenshot({path:`${output}/globe-desktop.png`});
  await page.getByRole('button',{name:'展开地图',exact:true}).click(); await page.waitForTimeout(900);
  await page.screenshot({path:`${output}/globe-expanded.png`});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.map-expanded').count(),0);
  results.push('Native globe and 50m geography render with avatars; no Three.js or Leaflet loaded by default; expand/Escape');

  const chosen = page.locator('.online-visitor[data-visitor-id="guest-020"]');
  await chosen.press('Enter');
  await page.waitForSelector('.maplibregl-popup');
  assert.ok((await page.locator('#vdId').textContent()).includes('San Jose'));
  assert.equal(await page.evaluate(() => window.__tide.selectedId),'guest-020');
  await page.waitForTimeout(550);
  const b = await page.locator('#liveMap').boundingBox();
  await page.locator('.maplibregl-popup-close-button').click();
  const pt = await page.evaluate(() => window.__tideMap.projectVisitor('guest-020'));
  await page.mouse.click(b.x+pt.x,b.y+pt.y); await page.waitForSelector('.maplibregl-popup');
  results.push('Keyboard list and actual canvas-avatar click open the same full-ID visitor timeline');
  await page.locator('#vdClose').click();
  await page.locator('.online-visitor[data-visitor-id="samecity-one"]').click(); await page.waitForTimeout(600);
  await page.locator('.maplibregl-popup-close-button').click();
  const gp = await page.evaluate(() => window.__tideMap.projectVisitor('samecity-one'));
  await page.mouse.click(b.x+gp.x,b.y+gp.y); await page.waitForSelector('.group-people button');
  assert.equal(await page.locator('.group-people button').count(),3);
  await page.locator('.group-people button').last().click();
  assert.ok(await page.locator('.visitor-popup-page').isVisible());
  payload = {...payload, visitors:[...fixture, unsafeVisitor]};
  await page.evaluate(() => window.__tide.refresh());
  await page.locator('.online-visitor').filter({hasText:'<img src=x'}).click();
  assert.equal(await page.locator('#mapVisitors img, .maplibregl-popup img').count(),0);
  assert.equal(await page.evaluate(() => window.pwned),undefined);
  assert.equal(await page.evaluate(() => window.__tide.selectedId), `unsafe'"<id>`);
  results.push('Same-coordinate groups expand into individual choices; unsafe IDs/city strings remain text');

  await page.getByRole('button',{name:'美洲',exact:true}).click();
  const initial = await page.evaluate(() => window.__tideMap.camera());
  await page.waitForTimeout(750);
  assert.deepEqual(await page.evaluate(() => window.__tideMap.camera()),initial,'No decorative auto-rotation');
  await page.getByRole('button',{name:'放大地图',exact:true}).click(); await page.waitForTimeout(350);
  assert.ok((await page.evaluate(() => window.__tideMap.camera().zoom)) > initial.zoom);
  await page.mouse.move(b.x+b.width*.55,b.y+b.height*.45); await page.mouse.down();
  await page.mouse.move(b.x+b.width*.7,b.y+b.height*.5,{steps:10}); await page.mouse.up(); await page.waitForTimeout(600);
  assert.notDeepEqual((await page.evaluate(() => window.__tideMap.camera().center)),initial.center);
  await page.getByRole('button',{name:'亚太',exact:true}).click(); await page.waitForTimeout(400);
  assert.ok(Math.abs((await page.evaluate(() => window.__tideMap.camera().center))[0]-115)<.1);
  results.push('Manual globe drag, zoom, regional presets and no auto-rotation');
  await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(600);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({path:`${output}/globe-mobile.png`,fullPage:true});
  await page.getByRole('button',{name:'展开地图',exact:true}).click(); await page.waitForTimeout(600);
  await page.screenshot({path:`${output}/globe-mobile-expanded.png`}); await page.keyboard.press('Escape');
  results.push('390px mobile viewport, adaptive globe fit and expanded mobile view without overflow');

  payload = {...payload,visitors:fixture.slice(0,2)}; await page.evaluate(() => window.__tide.refresh());
  await page.waitForFunction(() => document.getElementById('realtimeCount').textContent==='2');
  assert.equal(await page.locator('.online-visitor').count(),2);
  payload = {...payload,visitors:[]}; await page.evaluate(() => window.__tide.refresh());
  await page.waitForFunction(() => document.getElementById('realtimeCount').textContent==='0');
  assert.ok(await page.locator('#mapEmpty').isVisible());
  status = 503; await page.evaluate(() => window.__tide.refresh()); await page.waitForTimeout(400);
  assert.ok((await page.locator('#liveStatus').textContent()).includes('连接中断'));
  status = 200; payload = {...payload,visitors:fixture}; await page.evaluate(() => window.__tide.refresh());
  await page.waitForFunction(n => document.getElementById('realtimeCount').textContent===String(n),fixture.length);
  results.push('Live departure removal, genuine zero/empty state, stale error disclosure and recovery');
  await page.close();

  page = await browser.newPage({locale:'zh-CN',viewport:{width:900,height:720},reducedMotion:'reduce'}); watch(page); await mock(page);
  let failGeo = true;
  await page.route('**/assets/countries-50m.geojson',route => failGeo ? route.fulfill({status:503,body:'unavailable'}) : route.continue());
  await page.goto(base); await page.waitForFunction(() => document.getElementById('liveMap').dataset.geography==='error');
  assert.ok(await page.locator('#tileNotice').isVisible());
  failGeo = false; await page.getByRole('button',{name:'重新加载地图',exact:true}).click(); await settled(page);
  assert.equal(await page.locator('#tileNotice').isVisible(),false); await page.close();
  results.push('Real local geography failure is visible; successful retry clears the notice');

  page = await browser.newPage({locale:'zh-CN',viewport:{width:390,height:844}}); await mock(page);
  const fallbackErrors = []; page.on('pageerror',e=>fallbackErrors.push(e.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type,...args) { return /webgl/.test(type) ? null : original.call(this,type,...args); };
  });
  await page.goto(base); await settled(page,'flat');
  assert.equal(await page.locator('#globeMode').textContent(),'平面兼容模式');
  assert.equal(await page.locator('#realtimeCount').textContent(),String(fixture.length));
  await page.locator('.online-visitor[data-visitor-id="guest-020"]').click(); assert.ok(await page.locator('#visitorDetail').isVisible());
  await page.screenshot({path:`${output}/globe-webgl-fallback.png`,fullPage:true});
  assert.deepEqual(fallbackErrors,[]); await page.close();
  results.push('WebGL unavailable: local-data flat fallback with unchanged online counts and selection');
  assert.deepEqual(errors,[],'No uncaught script or WebGL shader errors');
  assert.deepEqual(remote,[],'Default globe must not request external map tiles, avatar services or fonts');
  await fs.writeFile(`${output}/results.json`,JSON.stringify({passed:true,results,errors,remote,fixtureVisitors:fixture.length},null,2));
  console.log(results.join('\n'));
} catch(error) {
  if (page && !page.isClosed()) await page.screenshot({path:`${output}/failure.png`,fullPage:true}).catch(()=>{});
  await fs.writeFile(`${output}/results.json`,JSON.stringify({passed:false,results,errors,remote,failure:String(error)},null,2));
  throw error;
} finally { await browser.close(); }
