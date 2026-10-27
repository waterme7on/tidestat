import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyTraffic, lastNonDirectTouch } from '../lib/attribution.mjs';
test('AI referrals and explicit campaigns', () => {
  assert.equal(classifyTraffic({referrer:'https://chatgpt.com/'}).channel, 'ai');
  assert.equal(classifyTraffic({referrer:'https://perplexity.ai/search'}).source, 'Perplexity');
  assert.equal(classifyTraffic({utm_source:'x',utm_medium:'social'}).source, 'x');
});
test('last non-direct touch ignores subsequent direct sessions', () => {
  const sessions = [
    {site_id:'a',occurred_at:'2026-10-01T00:00:00Z',utm_source:'x'},
    {site_id:'a',occurred_at:'2026-10-16T00:00:00Z'},
    {site_id:'b',occurred_at:'2026-10-17T00:00:00Z',utm_source:'google'}
  ];
  const match = lastNonDirectTouch(sessions,{site_id:'a',paid_at:'2026-10-18T00:00:00Z'});
  assert.equal(match.traffic.source,'x');
  assert.equal(lastNonDirectTouch(sessions,{site_id:'a',paid_at:'2026-12-18T00:00:00Z'}),null);
  assert.equal(lastNonDirectTouch(sessions,{site_id:'b',paid_at:'2026-10-16T00:00:00Z'}),null);
});
