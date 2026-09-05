import { chromium } from 'playwright';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import worker from '../worker.js';

const base = process.env.BASE_URL || 'http://127.0.0.1:8894';
const results = [], failures = [], errors = [];
await fs.mkdir('visual-review', { recursive: true });
async function check(name, fn) {
  try { await fn(); results.push(name); console.log('PASS', name); }
  catch (error) { failures.push({ name, error: String(error) }); console.error('FAIL', name, String(error)); }
}

await check('Latest events survive the 2000-row window; ties are deterministic and overflow is explicit', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(await fs.readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
    const statement = db.prepare('INSERT INTO events (visitor_id, ts, path) VALUES (?, ?, ?)');
    const now = Date.now();
    db.exec('BEGIN');
    for (let i = 0; i < 2100; i++) statement.run('old-reader', now - 200000 + i, '/old/' + i);
    statement.run('new-reader', now - 2000, '/zh/writing/first');
    statement.run('new-reader', now - 1000, '/zh/writing/second');
    statement.run('new-reader', now - 1000, '/zh/writing/third');
    db.exec('COMMIT');
    const env = { DB: { prepare(sql) { return { bind(...args) { return { all: async () => ({ results: db.prepare(sql).all(...args) }) }; } }; } } };
    const response = await worker.fetch(new Request('https://example.test/api/live'), env);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.visitors.map(v => v.id), ['new-reader']);
    assert.deepEqual(data.visitors[0].paths.map(p => p.path), ['/zh/writing/first', '/zh/writing/second', '/zh/writing/third']);
    assert.equal(data.truncated, true);
    assert.equal(data.onlineMs, 90000);
    db.prepare("DELETE FROM events WHERE visitor_id = 'old-reader'").run();
    assert.equal((await (await worker.fetch(new Request('https://example.test/api/live'), env)).json()).truncated, false);
  } finally { db.close(); }
});

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
function visitor(id, path = '/zh/writing/first') {
  const now = Date.now();
  return { id, city: 'London', country: 'GB', lat: 51.5, lng: -.13, firstTs: now - 5000, lastTs: now, paths: [{ path, ts: now - 5000 }] };
}
async function pageFor(getData, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, locale: 'en-US', reducedMotion: 'reduce', ...options });
  page.on('pageerror', error => errors.push(error.message));
  if (getData) await page.route('**/api/live', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(getData()) }));
  return page;
}
async function ready(page, query = '') {
  await page.goto(base + '/' + query);
  await page.waitForFunction(() => window.__tideMap?.ready() && document.getElementById('liveMap').dataset.geography === 'ready', null, { timeout: 30000 });
}
try {
  await check('Same-category URL changes create one event each and retain literal timeline paths', async () => {
    const reader = visitor('same-category-reader');
    let data = { visitors: [reader], onlineMs: 90000, truncated: false };
    const page = await pageFor(() => data);
    try {
      await ready(page);
      reader.paths.push({ path: '/zh/writing/second', ts: Date.now() });
      await page.evaluate(() => window.__tide.refresh());
      await page.waitForFunction(() => document.querySelectorAll('#events i.pageview').length === 1, null, { timeout: 3000 });
      await page.evaluate(() => window.__tide.refresh());
      await page.waitForTimeout(200);
      assert.equal(await page.locator('#events i.pageview').count(), 1);
      reader.paths.push({ path: '/zh/writing/first', ts: Date.now() });
      await page.evaluate(() => window.__tide.refresh());
      await page.waitForFunction(() => document.querySelectorAll('#events i.pageview').length === 2);
      await page.locator('.online-visitor').click();
      await page.getByRole('button', { name: 'View visit timeline →', exact: true }).click();
      assert.deepEqual(await page.locator('#vdTimeline small').allTextContents(), ['/zh/writing/first', '/zh/writing/second', '/zh/writing/first']);
      await page.screenshot({ path: 'visual-review/hardening-timeline-en.png' });
      await page.locator('#vdClose').click();
      data = { ...data, truncated: true };
      await page.evaluate(() => window.__tide.refresh());
      await page.waitForFunction(() => document.getElementById('liveStatus').textContent.includes('Latest 2,000 events'));
      await page.locator('#languageSelect').selectOption('zh');
      await page.waitForFunction(() => document.getElementById('liveStatus').textContent.includes('最近 2,000 条'));
      await page.locator('#tab-park').click();
      await page.waitForFunction(() => window.__tide3d?.ready());
      assert.match(await page.locator('#footprintStatus').textContent(), /最近 2,000 条/);
      data = { ...data, truncated: false };
      await page.evaluate(() => window.__tide.refresh());
      await page.waitForFunction(() => !document.querySelector('#footprintStatus').textContent.includes('最近 2,000 条'));
    } finally { await page.close(); }
  });

  await check('Every warm-start demo reader has a different next destination; demo stays separate from APIs', async () => {
    const page = await pageFor();
    const calls = [];
    page.on('request', request => { if (request.url().includes('/api/')) calls.push(request.url()); });
    try {
      await ready(page, '?demo=1');
      const state = await page.evaluate(() => {
        const visitors = [...window.__tide.visitors.values()];
        return { count: visitors.length, selfRoutes: visitors.filter(v => v.state === 'reading' && v.target === v.node).map(v => v.id) };
      });
      assert.ok(state.count >= 100 && state.count <= 150, String(state.count));
      assert.deepEqual(state.selfRoutes, []);
      assert.deepEqual(calls, []);
    } finally { await page.close(); }
  });

  await check('Closing a co-located avatar group releases idle pause without reopening a closed popup on locale change', async () => {
    const data = { visitors: [visitor('group-one'), visitor('group-two'), visitor('group-three')], onlineMs: 90000 };
    const page = await pageFor(() => data, { reducedMotion: 'no-preference' });
    try {
      await ready(page, '?longitude=-0.13&latitude=51.5');
      await page.bringToFront();
      await page.waitForTimeout(800);
      const box = await page.locator('#liveMap').boundingBox();
      const point = await page.evaluate(() => window.__tideMap.projectVisitor('group-one'));
      await page.mouse.click(box.x + point.x, box.y + point.y);
      await page.locator('.group-popup').waitFor();
      assert.equal(await page.locator('.group-people button').count(), 3);
      assert.equal(await page.evaluate(() => window.__tide.selectedId), null);
      await page.locator('.maplibregl-popup-close-button').click();
      await page.locator('#languageSelect').selectOption('zh');
      await page.locator('#mapReset').focus();
      await page.mouse.move(10, 10);
      assert.equal(await page.locator('.maplibregl-popup').count(), 0);
      const camera = await page.evaluate(() => window.__tideMap.camera());
      await page.waitForFunction(() => document.getElementById('liveMap').dataset.rotating === 'true', null, { timeout: 17000 });
      await page.waitForTimeout(650);
      assert.notDeepEqual(await page.evaluate(() => window.__tideMap.camera()), camera);
      assert.equal(await page.locator('.maplibregl-popup').count(), 0);
      await page.mouse.move(20, 10);
      await page.waitForFunction(() => document.getElementById('liveMap').dataset.rotating === 'false');
    } finally { await page.close(); }
  });
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await fs.writeFile('visual-review/hardening-results.json', JSON.stringify({ passed: failures.length === 0 && errors.length === 0, results, failures, errors }, null, 2));
}
assert.deepEqual(failures, [], 'Hardening regressions must all pass');
