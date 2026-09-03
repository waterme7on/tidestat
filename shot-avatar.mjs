import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:8890'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('https://tidestat.yololab.cc/?demo=1', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(4000);
await page.click('#tab-park');
await page.waitForTimeout(6000);
const shot = await page.evaluate(() => document.getElementById('stage').toDataURL('image/png'));
const { writeFileSync } = await import("node:fs"); writeFileSync("/root/design-review-shots/tidestat-avatars.png", Buffer.from(shot.split(",")[1], "base64"));
console.log('captured');
