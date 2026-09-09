import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
const pages = [...html.matchAll(/<article data-page="([^"]+)"/g)].map(m => m[1]);
test('documentation navigation and local asset links resolve', () => {
  assert.equal(new Set(pages).size, 13);
  for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (href.startsWith('data:') || /^https?:/.test(href)) continue;
    if (href.startsWith('#')) assert.ok(pages.includes(href.slice(1)) || href === '#content', href);
    else assert.ok(fs.existsSync(path.resolve(root, 'docs', href.split('#')[0])), href);
  }
});
test('documentation distinguishes payments, aggregate search and unpublished installation', () => {
  for (const text of ['not a published npm release', 'aggregate imports', 'refund.created', 'refund.updated', 'timelineTruncated', 'Sign in and add your website', 'No matching pages']) assert.ok(html.toLowerCase().includes(text.toLowerCase()), text);
  assert.ok(!html.includes('/packages/browser-sdk/src/'));
  assert.ok(!html.includes('refund deduction'));
});

test('public onboarding describes the hosted service, not customer infrastructure',()=>{
 for(const command of ['wrangler secret','wrangler deploy','wrangler d1','Prepare your own deployment','Deploy the Worker'])assert.ok(!html.includes(command),command);
 assert.ok(html.includes('https://tidestat.yololab.cc/sdk/index.js'));
 assert.ok(html.includes('we run the analytics service'));
});
