import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { avatarSVG } from '../visitor-avatar.js';

const output = 'visual-review';
await fs.mkdir(output, { recursive: true });
const base = process.env.BASE_URL || 'http://127.0.0.1:8894';
const ids = ['guest-000', 'guest-001', 'guest-002', 'guest-003', 'guest-004', 'guest-005', 'guest-006', 'guest-007'];
const dangerous = `doodle'"<script>window.pwned=1</script>&`;
const results = [], errors = [], external = [];
// Only fixed, anonymous test IDs are used. Never request the production live API.
for (const id of [...ids, dangerous, '用户🍉', '', undefined, null, 'a'.repeat(1024)]) {
  const svg = avatarSVG(id);
  assert.equal(svg, avatarSVG(id));
  assert.ok(svg.includes('data-avatar-style="notionists-neutral-b"'));
  assert.match(svg, /viewBox="0 0 560 560"/);
  assert.equal(/<script|<image|foreignObject|onload=|onerror=|\bhref=|<filter|<animate|\bid=/i.test(svg), false);
  assert.ok(svg.length < 5000);
}
assert.equal(avatarSVG(dangerous).includes('window.pwned'), false);
assert.notEqual(avatarSVG('samehead-visitor-one'), avatarSVG('samehead-visitor-two'));
assert.ok(new Set(Array.from({ length: 160 }, (_, i) => avatarSVG('guest-' + i))).size > 80);
// Changing this fixture intentionally signals a new avatar mapping, not random refresh drift.
assert.equal(createHash('sha256').update(avatarSVG('guest-000')).digest('hex'), '289901d71884dde1d365907e4a53ecbdbc99d38fc0c6f88f866106057c9bee13');
results.push('Deterministic full-ID mapping, distinct-prefix fixtures, pinned snapshot, bounded self-contained SVG and safe input');

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({locale:'zh-CN', viewport: { width: 1180, height: 640 }, reducedMotion: 'reduce' });
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith(base + '/')) external.push(r.url()); });
try {
  await page.goto(base + '/tests/fixtures/avatar-preview.html');
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  assert.equal(await page.locator('svg[data-avatar-style="notionists-neutral-b"]').count(), 24);
  await page.screenshot({ path: `${output}/doodle-avatars-b.png`, fullPage: true });
  const raster = await page.evaluate(async () => {
    const { avatarSVG } = await import('/visitor-avatar.js');
    const samples = Array.from({ length: 160 }, (_, i) => avatarSVG('guest-' + i));
    for (const svg of samples) {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      if (doc.querySelector('parsererror')) throw new Error('Malformed SVG');
      if (doc.querySelector('script,image,foreignObject,filter,animate,[id]')) throw new Error('Unexpected SVG content');
    }
    const measurements = [];
    for (const size of [32, 48, 96]) for (const svg of samples.slice(0, 12)) {
      const image = new Image();
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, size, size);
      const bytes = ctx.getImageData(0, 0, size, size).data;
      const paper = svg.match(/<circle[^>]+fill="#([0-9a-f]{6})"/i)[1];
      const paperRGB = [0, 2, 4].map(i => parseInt(paper.slice(i, i + 2), 16));
      const luminance = paperRGB.reduce((sum, value) => sum + value, 0);
      let ink = 0, coverage = 0;
      for (let i = 0; i < bytes.length; i += 4) {
        if (bytes[i + 3] <= 220) continue;
        const darkness = Math.max(0, 1 - (bytes[i] + bytes[i+1] + bytes[i+2]) / luminance);
        coverage += darkness;
        if (darkness > .55) ink++;
      }
      // At 32px, original hand-drawn edges are mostly antialiased gray. Test
      // integrated contrast against the actual paper color rather than requiring
      // an arbitrary number of nearly pure-black pixels; blank/solid disks fail.
      if (coverage < size * size * .01 || coverage > size * size * .3) {
        throw new Error(`Missing or overfilled ${size}px facial ink: ${coverage.toFixed(2)}`);
      }
      // Circular clipping is self-contained, not a CSS-only effect lost in canvas textures.
      if (bytes[3] !== 0) throw new Error('The SVG corner is not transparent');
      measurements.push({ size, ink, coverage: Number(coverage.toFixed(2)) });
    }
    return measurements;
  });
  const before = await page.locator('.faces').first().innerHTML();
  await page.reload(); await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
  assert.equal(await page.locator('.faces').first().innerHTML(), before);
  results.push('160 valid SVGs; 36 successful 32/48/96px raster checks; transparent circle corners; refresh stability');

  const now = Date.now();
  await page.route('**/api/live', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ now, onlineMs: 90000, visitors: [
    { id: dangerous, city: 'London', country: 'GB', lat: 51.51, lng: -.13, firstTs: now-12000, lastTs: now, paths: [{path:'/zh/work',ts:now}] },
    { id: 'second-doodle', city: 'London', country: 'GB', lat: 51.51, lng: -.13, firstTs: now-15000, lastTs: now, paths: [{path:'/zh/writing',ts:now}] },
  ] }) }));
  await page.goto(base);
  await page.waitForFunction(() => window.__tideMap?.ready() && document.getElementById('liveMap').dataset.geography === 'ready');
  const chosen = page.locator('.online-visitor').filter({hasText: '/zh/work'});
  await chosen.press('Enter'); await page.waitForSelector('.visitor-popup');
  const sidebar = await chosen.locator('svg').evaluate(node => node.outerHTML);
  const popup = await page.locator('.visitor-popup svg').evaluate(node => node.outerHTML);
  assert.equal(sidebar, popup);
  assert.equal(await page.evaluate(() => window.__tide.selectedId), dangerous);
  assert.equal(await page.locator('#realtimeCount').textContent(), '2');
  assert.equal(await page.evaluate(() => window.pwned), undefined);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  results.push('Live sidebar and selected popup share exact B artwork; full-ID selection, count and privacy unchanged; no external asset requests');
  await fs.writeFile(`${output}/avatar-results.json`, JSON.stringify({ passed: true, results, raster, errors, external }, null, 2));
  console.log(results.join('\n'));
} catch (error) {
  await page.screenshot({ path: `${output}/avatar-failure.png` }).catch(() => {});
  await fs.writeFile(`${output}/avatar-results.json`, JSON.stringify({ passed: false, results, errors, external, failure: String(error) }, null, 2));
  throw error;
} finally { await browser.close(); }
