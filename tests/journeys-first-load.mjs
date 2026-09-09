import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:8893';
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
    let release;
    const held = new Promise(resolve => { release = resolve; });
    let requested;
    const request = new Promise(resolve => { requested = resolve; });
    await page.route('**/footprints.css', async route => { requested(); await held; await route.continue(); });
    const navigation = page.goto(base + '/live.html?demo=1&embed=1&view=park');
    await request;
    try {
      assert.equal(await page.locator('.footprint-heading').count(), 0, 'Scene must not render before its stylesheet');
      assert.equal(await page.locator('head link[rel="stylesheet"]').last().getAttribute('href'), './footprints.css');
    } finally { release(); }
    await navigation;
    await page.locator('.footprint-avatar').first().waitFor();
    assert.equal(await page.locator('.footprint-metrics').evaluate(el => getComputedStyle(el).display), 'flex');
    assert.equal(await page.locator('.footprint-avatar').first().evaluate(el => getComputedStyle(el).position), 'absolute');
    assert.equal(await page.locator('link[href$="footprints.css"]').count(), 1);
    await page.screenshot({ path: `visual-review/journeys-first-load-${engine.name()}.png`, fullPage: true });
    console.log(`${engine.name()}: delayed stylesheet + mobile first load passed`);
  } finally { await browser.close(); }
}
