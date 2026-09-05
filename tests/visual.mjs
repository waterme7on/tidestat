import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.BASE_URL || 'http://127.0.0.1:8894';
const out = 'visual-review';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
const errors = [];
function recordErrors(page) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
}
async function ready(page, path = '/?demo=1') {
  await page.goto(base + path);
  await page.waitForFunction(() => window.__tide3d?.ready(), null, { timeout: 30000 });
  await page.waitForTimeout(500);
}
async function visiblePixels(page) {
  const count = await page.evaluate(() => {
    const c = document.getElementById('stage3d'), gl = c.getContext('webgl2');
    const colors = new Set(); const pixel = new Uint8Array(4);
    for (let x = .2; x < .85; x += .08) for (let y = .2; y < .85; y += .08) {
      gl.readPixels(Math.floor(x * c.width), Math.floor(y * c.height), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      colors.add(Array.from(pixel).join(','));
    }
    return colors.size;
  });
  assert.ok(count > 8, `Expected a rendered 3D object, got only ${count} colors`);
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  recordErrors(page);
  await page.addInitScript(() => {
    let seed = 52;
    Math.random = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
  });
  await ready(page);
  assert.equal(await page.locator('[aria-label="自动旋转"]').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('#stageHint').isVisible(), false);
  await visiblePixels(page);
  await page.screenshot({ path: `${out}/desktop-map.png` });
  await page.locator('#tab-park').click();
  await page.waitForTimeout(600);
  await visiblePixels(page);
  await page.screenshot({ path: `${out}/desktop-park.png` });
  await page.locator('.ev').first().press('Enter');
  await page.waitForTimeout(250);
  assert.ok(await page.locator('#visitorDetail').evaluate(el => el.classList.contains('open')));
  assert.ok(await page.locator('#vdTimeline li').count());
  await page.screenshot({ path: `${out}/desktop-selected.png` });
  await page.locator('#vdClose').click();
  for (let i = 0; i < 4; i++) {
    await page.locator('#tab-map').click(); await page.waitForTimeout(80);
    await page.locator('#tab-park').click(); await page.waitForTimeout(80);
  }
  const bounds = await page.locator('#stage3d').boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 85, bounds.y + bounds.height / 2 + 30, { steps: 8 }); await page.mouse.up();
  await page.mouse.wheel(0, -180);
  await page.getByRole('button', { name: '重置视角' }).click();
  await visiblePixels(page);
  results.push('desktop: globe, park, pixels, keyboard selection, drag, zoom, reset, repeated view switching');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#tab-map').click(); await page.waitForTimeout(500);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await visiblePixels(page); await page.screenshot({ path: `${out}/mobile-map.png`, fullPage: true });
  await page.locator('#tab-park').click(); await page.waitForTimeout(500);
  await visiblePixels(page); await page.screenshot({ path: `${out}/mobile-park.png`, fullPage: true });
  results.push('mobile: 390px resize in both views, no horizontal overflow, reduced-motion default');
  await page.close();
  const live = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  recordErrors(live);
  const now = Date.now();
  await live.route('**/api/live', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ now, visitors: [
    { id: 'samehead-first-visitor', city: 'Tokyo', country: 'JP', lat: 35.7, lng: 139.7, firstTs: now - 5000, lastTs: now, paths: [{ path: '/zh', ts: now - 5000 }, { path: '/zh/work', ts: now }] },
    { id: `samehead-second'visitor"`, city: 'London <img src=x onerror=window.__xss=1>', country: 'GB', lat: 51.5, lng: -.1, firstTs: now - 4000, lastTs: now, paths: [{ path: '/zh/writing', ts: now }] }
  ] }) }));
  await ready(live, '/');
  await live.waitForFunction(() => window.__tide.visitors.size === 2);
  await live.locator('.ev[data-id="samehead-first-visitor"]').click();
  await live.waitForTimeout(250);
  assert.ok((await live.locator('#vdId').textContent()).includes('Tokyo'));
  assert.equal(await live.evaluate(() => window.__tide.selectedId), 'samehead-first-visitor');
  assert.equal(await live.locator('#onlineCount').textContent(), '2');
  await live.locator('.ev').filter({ hasText: 'London' }).click();
  assert.ok((await live.locator('#vdId').textContent()).includes('London'));
  assert.equal(await live.locator('#events img').count(), 0);
  assert.equal(await live.evaluate(() => window.__xss), undefined);
  await live.waitForFunction(() => window.__tide.selectedId === `samehead-second'visitor"`);
  results.push('mocked live API: no demo mixing, full visitor IDs with identical prefixes, working timelines');
  await live.close();
  const motion = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
  recordErrors(motion);
  await ready(motion);
  assert.equal(await motion.locator('[aria-label="自动旋转"]').getAttribute('aria-pressed'), 'true');
  await motion.locator('[aria-label="自动旋转"]').click();
  assert.equal(await motion.locator('[aria-label="自动旋转"]').getAttribute('aria-pressed'), 'false');
  await motion.close();
  results.push('motion controls: normal preference can pause auto rotation; visitor markup is escaped');
  assert.deepEqual(errors, [], 'No browser runtime, shader, or asset-loading errors');
  const fallback = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/.test(type) ? null : original.call(this, type, ...args); };
  });
  const fallbackErrors = [];
  fallback.on('pageerror', e => fallbackErrors.push(e.message));
  await fallback.goto(base + '/?demo=1'); await fallback.waitForTimeout(500);
  assert.equal(await fallback.locator('#stage').isVisible(), true);
  await fallback.locator('#tab-park').click();
  assert.equal(await fallback.locator('#stage').isVisible(), true);
  assert.equal(await fallback.locator('#stage3d').isVisible(), false);
  await fallback.screenshot({ path: `${out}/webgl-fallback.png`, fullPage: true });
  await fallback.locator('#tab-map').click();
  assert.equal(await fallback.locator('#stage').isVisible(), true);
  assert.deepEqual(fallbackErrors, []);
  await fallback.close();
  results.push('WebGL disabled: existing 2D fallback remains visible through both tabs without uncaught errors');
  console.log(results.join('\n'));
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: true, results, errors }, null, 2));
} catch (error) {
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: false, results, errors, failure: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
