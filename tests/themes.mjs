import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.BASE_URL || 'http://127.0.0.1:8894';
const out = 'visual-review';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const results = [], errors = [], external = [];
const now = Date.now();
const places = [
  ['旧金山', 'US', 37.77, -122.42], ['洛杉矶', 'US', 34.05, -118.24],
  ['西雅图', 'US', 47.61, -122.33], ['纽约', 'US', 40.71, -74.01],
  ['丹佛', 'US', 39.74, -104.99], ['多伦多', 'CA', 43.65, -79.38],
  ['奥斯汀', 'US', 30.27, -97.74], ['迈阿密', 'US', 25.76, -80.19],
  ['墨西哥城', 'MX', 19.43, -99.13], ['圣何塞', 'CR', 9.93, -84.08],
  ['波哥大', 'CO', 4.71, -74.07], ['利马', 'PE', -12.05, -77.04],
  ['圣保罗', 'BR', -23.55, -46.63], ['圣地亚哥', 'CL', -33.45, -70.67],
  ['布宜诺斯艾利斯', 'AR', -34.6, -58.38], ['伦敦', 'GB', 51.51, -.13],
  ['东京', 'JP', 35.68, 139.69], ['上海', 'CN', 31.23, 121.47],
];
function visitor(id, place) {
  return { id, city: place[0], country: place[1], lat: place[2], lng: place[3],
    firstTs: now - 12000, lastTs: now,
    paths: [{ path: '/zh', ts: now - 12000 }, { path: '/zh/work', ts: now }] };
}
const fixture = places.map((p, i) => visitor(`guest-${String(i).padStart(3,'0')}`, p));
fixture.push(visitor('same-city', places[0]), visitor('unknown-location', ['未知位置', '', null, null]));
let payload = { now, onlineMs: 90000, visitors: fixture }, status = 200;
async function watch(page) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(base + '/')) external.push(request.url()); });
  await page.route('**/api/live', route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) }));
}
async function ready(page) {
  await page.waitForFunction(() => window.__tideMap?.ready() && document.getElementById('liveMap').dataset.geography === 'ready');
  await page.waitForFunction(() => document.getElementById('realtimeCount').textContent === '20');
  await page.waitForTimeout(800);
}
let page;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  page = await context.newPage(); await watch(page); await page.goto(base); await ready(page);
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.equal(await page.locator('#mapTheme').inputValue(), 'system');
  assert.equal(await page.evaluate(() => window.__tideMap.appearance().lightOpacity), .34);
  assert.equal(await page.evaluate(() => window.__tideMap.appearance().locations), 18, 'No invented lights for unlocated visitors');
  await page.screenshot({ path: `${out}/theme-dark-desktop.png` });
  await page.getByRole('button', { name: '展开地图', exact: true }).click(); await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/theme-dark-expanded.png` });
  await page.keyboard.press('Escape');
  await page.locator('.online-visitor[data-visitor-id="guest-009"]').press('Enter');
  await page.waitForSelector('.visitor-popup');
  const before = await page.evaluate(() => {
    window.__themeCanvas = document.querySelector('#liveMap canvas');
    return { camera: window.__tideMap.camera(), selected: window.__tide.selectedId,
      avatar: document.querySelector('.visitor-popup svg').outerHTML,
      geography: performance.getEntriesByType('resource').filter(e => e.name.includes('countries-50m')).length };
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__tideMap.appearance().lightOpacity), 0);
  assert.equal(await page.evaluate(() => window.__tideMap.appearance().land), '#fafbf7');
  const after = await page.evaluate(() => ({ camera: window.__tideMap.camera(), selected: window.__tide.selectedId,
    avatar: document.querySelector('.visitor-popup svg').outerHTML,
    geography: performance.getEntriesByType('resource').filter(e => e.name.includes('countries-50m')).length }));
  assert.deepEqual(after, before, 'Changing system theme must keep camera, selection, popup, B avatar and loaded geography');
  assert.equal(await page.evaluate(() => document.querySelector('#liveMap canvas') === window.__themeCanvas), true);
  assert.equal(await page.locator('#liveMap').evaluate(el => getComputedStyle(el).backgroundImage), 'none');
  assert.equal(await page.locator('#liveMap').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  results.push('System dark/light changes paint without map recreation, refetch, camera reset, selection loss or B-avatar changes; reduced motion is respected');
  await page.locator('#vdClose').click(); await page.getByRole('button', { name: '查看全球', exact: true }).click();
  await page.waitForTimeout(400); await page.screenshot({ path: `${out}/theme-light-desktop.png` });
  await page.getByRole('button', { name: '展开地图', exact: true }).click(); await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/theme-light-expanded.png` }); await page.keyboard.press('Escape');

  await page.locator('#mapTheme').selectOption('dark');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.reload(); await ready(page);
  assert.equal(await page.locator('#mapTheme').inputValue(), 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  const other = await context.newPage(); await watch(other); await other.goto(base); await ready(other);
  await other.locator('#mapTheme').selectOption('light');
  await page.waitForFunction(() => window.__tideTheme.preference === 'light');
  await other.close();
  await page.locator('#mapTheme').selectOption('system');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  assert.equal(await page.evaluate(() => document.querySelector('meta[name="theme-color"]').content), '#101112');
  results.push('Manual override persists across reload and ignores system changes; other tabs synchronize; system mode resumes correctly');

  status = 503; await page.evaluate(() => window.__tide.refresh());
  await page.waitForFunction(() => window.__tideMap.appearance().lightOpacity === 0);
  assert.equal(await page.locator('#realtimeCount').textContent(), '20');
  assert.match(await page.locator('#activityKey').textContent(), /暂停点灯/);
  status = 200; payload = { ...payload, visitors: [] }; await page.evaluate(() => window.__tide.refresh());
  await page.waitForFunction(() => window.__tideMap.appearance().locations === 0);
  assert.equal(await page.locator('#realtimeCount').textContent(), '0');
  payload = { ...payload, visitors: fixture }; await page.evaluate(() => window.__tide.refresh()); await ready(page);
  assert.equal(await page.evaluate(() => window.__tideMap.appearance().lightOpacity), .34);
  results.push('Dark lights follow actual located visitors; failed live updates extinguish lights while marking stale data, zero visitors remove all light points, recovery restores them');

  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(600);
  for (const theme of ['dark', 'light']) {
    await page.locator('#mapTheme').selectOption(theme);
    await page.waitForTimeout(350);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const picker = await page.locator('.theme-picker').boundingBox(), caption = await page.locator('.map-caption').boundingBox();
    assert.ok(picker.x >= caption.x + caption.width, 'Theme control does not cover the map hint on mobile');
    await page.getByRole('button', { name: '展开地图', exact: true }).click(); await page.waitForTimeout(350);
    assert.ok(await page.locator('#mapTheme').isVisible());
    await page.screenshot({ path: `${out}/theme-${theme}-mobile.png` }); await page.keyboard.press('Escape');
  }
  results.push('Light/dark mobile layouts and expanded theme picker remain usable without overflow or overlapping hints');
  await context.close();

  // Storage and WebGL may both be unavailable. Existing local-data flat fallback still follows the theme.
  const safeContext = await browser.newContext({ viewport: { width: 900, height: 750 }, colorScheme: 'light', reducedMotion: 'reduce' });
  await safeContext.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Unavailable', 'SecurityError'); } });
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/.test(type) ? null : getContext.call(this, type, ...args); };
  });
  page = await safeContext.newPage(); await watch(page); await page.goto(base); await ready(page);
  assert.equal(await page.locator('#liveMap').getAttribute('data-engine'), 'flat');
  await page.locator('#mapTheme').selectOption('dark');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.locator('#mapTheme').selectOption('light');
  const fill = await page.locator('#liveMap path.leaflet-interactive, #liveMap .leaflet-overlay-pane path').first().getAttribute('fill');
  assert.equal(fill, '#fafbf7');
  await page.locator('.online-visitor[data-visitor-id="guest-009"]').click(); await page.waitForSelector('.visitor-popup');
  assert.equal(await page.locator('#realtimeCount').textContent(), '20');
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  results.push('Blocked storage and unavailable WebGL fall back safely; flat geographic layers recolor and keep visitor selection without external requests');
  await safeContext.close();
  await fs.writeFile(`${out}/theme-results.json`, JSON.stringify({ passed: true, results, errors, external, fixtureVisitors: fixture.length }, null, 2));
  console.log(results.join('\n'));
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: `${out}/theme-failure.png`, fullPage: true }).catch(() => {});
  await fs.writeFile(`${out}/theme-results.json`, JSON.stringify({ passed: false, results, errors, external, failure: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
