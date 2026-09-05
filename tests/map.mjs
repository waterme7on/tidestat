import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.BASE_URL || 'http://127.0.0.1:8894';
const out = 'visual-review';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [], errors = [], requests = [];
// Synthetic test tiles intentionally contain no geographic shapes; never present these as the basemap.
const tile = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e4eeeb"/><path d="M0 128h256M128 0v256" stroke="#dae5df"/></svg>';
const now = Date.now();
const fixture = [
  ['samehead-tokyo-one', '东京', 'JP', 35.68, 139.69, '/zh/writing'],
  ['samehead-tokyo-two', '东京', 'JP', 35.68, 139.69, '/zh/work'],
  ['visitor-paris', '巴黎', 'FR', 48.86, 2.35, '/en/work'],
  ['visitor-sanfrancisco', '旧金山', 'US', 37.77, -122.42, '/en'],
  ['visitor-saopaulo', '圣保罗', 'BR', -23.55, -46.63, '/zh/writing/dyor'],
  ['visitor-sydney', '悉尼', 'AU', -33.87, 151.21, '/zh'],
  ['visitor-unknown', '未知位置', '', null, null, '/en/writing']
].map(([id, city, country, lat, lng, path]) => ({ id, city, country, lat, lng, firstTs: now - 15000, lastTs: now, device: 'desktop', paths: [{ path: '/', ts: now - 15000 }, { path, ts: now }] }));
let data = fixture, status = 200;
async function setup(page, { mockTiles = true } = {}) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => requests.push(r.url()));
  await page.route('**/api/live', route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ now: Date.now(), onlineMs: 90000, visitors: data }) }));
  if (mockTiles) await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: tile }));
}
async function ready(page, path = '/') {
  await page.goto(base + path);
  await page.waitForFunction(() => document.getElementById('liveMap')?.dataset.ready === 'true');
  await page.waitForFunction(() => window.__tide.status === 'ready');
  await page.waitForTimeout(550);
}
async function count(page, expected) {
  await page.waitForFunction(n => document.getElementById('realtimeCount').textContent === String(n), expected);
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await setup(page); await ready(page); await count(page, 7);
  assert.equal(await page.locator('h1').textContent(), '实时访问人数');
  assert.equal(await page.locator('#mapVisitors button').count(), 7);
  assert.equal(await page.locator('#countryCount').textContent(), '5');
  assert.equal(await page.locator('#cityCount').textContent(), '5');
  assert.ok((await page.locator('#unknownLocations').textContent()).includes('1 位'));
  assert.ok(await page.locator('#liveMap .visitor-face svg').count());
  assert.ok(await page.locator('.visitor-cluster').count());
  assert.equal(requests.some(url => /three.module|OrbitControls|\/scene.js/.test(url)), false, 'Default map must not load WebGL/Three');
  assert.ok(await page.locator('.leaflet-control-attribution').isVisible());
  const a = page.locator('[data-visitor-id="samehead-tokyo-one"]');
  await a.press('Enter');
  await page.waitForFunction(() => window.__tide.selectedId === 'samehead-tokyo-one');
  await page.waitForSelector('.visitor-popup');
  assert.ok((await page.locator('#vdId').textContent()).includes('东京'));
  assert.ok((await page.locator('.visitor-popup-page b').textContent()).includes('/zh/writing'));
  const faceOne = await a.locator('svg').evaluate(el => el.outerHTML);
  await page.locator('[data-visitor-id="samehead-tokyo-two"]').click();
  await page.waitForFunction(() => window.__tide.selectedId === 'samehead-tokyo-two');
  await page.waitForTimeout(450);
  assert.equal(await page.locator('.visitor-popup-page b').textContent(), '/zh/work');
  assert.equal(await a.locator('svg').evaluate(el => el.outerHTML), faceOne);
  assert.notEqual(await page.locator('[data-visitor-id="samehead-tokyo-two"] svg').evaluate(el => el.outerHTML), faceOne);
  results.push('exact online/country/city counts; unknown location not plotted; clustered cute stable avatars; shared-ID-prefix keyboard selection; no default WebGL');
  await page.locator('#vdClose').click();
  await page.locator('#mapReset').click();
  await page.waitForTimeout(250);
  const positionBefore = await page.locator('.leaflet-map-pane').getAttribute('style');
  const box = await page.locator('#liveMap').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 20, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(300);
  assert.notEqual(await page.locator('.leaflet-map-pane').getAttribute('style'), positionBefore);
  await page.locator('#mapZoomIn').click(); await page.locator('#mapZoomOut').click(); await page.locator('#mapReset').click();
  await page.screenshot({ path: `${out}/test-layout-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok((await page.locator('#mapZoomIn').boundingBox()).width >= 44);
  await page.screenshot({ path: `${out}/test-layout-mobile.png`, fullPage: true });
  results.push('map drag, zoom, reset; 390px mobile layout without overflow; 44px touch targets');
  data = [];
  await page.evaluate(() => window.__tide.refresh()); await count(page, 0);
  assert.equal(await page.locator('#mapVisitors button').count(), 0);
  assert.equal(await page.locator('.visitor-marker,.visitor-cluster').count(), 0);
  assert.equal(await page.locator('#mapEmpty').isVisible(), true);
  data = fixture;
  await page.evaluate(() => window.__tide.refresh()); await count(page, 7);
  status = 503;
  await page.evaluate(() => window.__tide.refresh());
  await page.waitForFunction(() => window.__tide.status === 'error');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#realtimeCount').textContent(), '7');
  assert.ok(await page.locator('#dataRetry').isVisible());
  assert.ok((await page.locator('#liveStatus').textContent()).includes('连接中断'));
  status = 200;
  await page.locator('#dataRetry').click(); await page.waitForFunction(() => window.__tide.status === 'ready');
  data = [{ ...fixture[0], id: `samehead-'\"-hostile`, city: '<img src=x onerror=window.__xss=1>', paths: [{ path: '<svg onload=window.__xss=1>', ts: now }] }];
  await page.evaluate(() => window.__tide.refresh()); await count(page, 1);
  await page.locator('#mapVisitors button').first().click(); await page.waitForTimeout(400);
  assert.equal(await page.locator('#mapVisitors img, #events img, .visitor-popup img').count(), 0);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.ok((await page.locator('#vdId').textContent()).includes('<img'));
  results.push('departed visitors removed; zero state; failed API keeps clearly marked stale counts; retry; hostile city/ID/path escaped');
  data = fixture;
  await page.close();
  const noGPU = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await setup(noGPU);
  await noGPU.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/.test(type) ? null : original.call(this, type, ...args); };
  });
  await ready(noGPU); await count(noGPU, 7);
  await noGPU.locator('#tab-park').click(); await noGPU.waitForTimeout(1200);
  assert.equal(await noGPU.locator('#stage').isVisible(), true);
  await noGPU.locator('#tab-map').click();
  assert.equal(await noGPU.locator('#liveMap').isVisible(), true);
  await noGPU.close();
  results.push('standard map works without WebGL; existing park 2D fallback and return to map');
  const offline = await browser.newPage();
  await setup(offline, { mockTiles: false });
  await offline.route('https://tile.openstreetmap.org/**', route => route.abort());
  await ready(offline); await count(offline, 7);
  assert.equal(await offline.locator('#tileNotice').isVisible(), true);
  assert.equal(await offline.locator('#mapVisitors button').count(), 7);
  await offline.close();
  const demo = await browser.newPage();
  await setup(demo); await ready(demo, '/?demo=1');
  assert.equal(await demo.locator('#mapSource').textContent(), '演示数据');
  await demo.close();
  results.push('tile failure leaves online list available; explicit demo data badge');
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  // A single user-requested preview viewport with the real basemap, no automated pan/zoom.
  const preview = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await setup(preview, { mockTiles: false }); await ready(preview);
  await preview.waitForTimeout(3500);
  const realTiles = await preview.locator('.leaflet-tile-loaded').count();
  await preview.screenshot({ path: `${out}/realtime-map-desktop.png` });
  results.push(`actual initial basemap preview: ${realTiles} loaded tiles (no pan/zoom scan)`);
  await preview.close();
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: true, results, errors, realTiles }, null, 2));
  console.log(results.join('\n'));
} catch (error) {
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: false, results, errors, failure: String(error) }, null, 2));
  for (const c of browser.contexts()) for (const p of c.pages()) { await p.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {}); }
  throw error;
} finally { await browser.close(); }
