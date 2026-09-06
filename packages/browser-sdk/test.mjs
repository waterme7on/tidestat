import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createTideStat } from './index.js';
import { attachTideStatCart, clearTideStatCart } from '../../integrations/shopify/cart-attribution.mjs';

function browser() {
  const storage = new Map(), sent = [], listeners = new Map();
  let nextId = 0;
  const runtime = {
    location: new URL('https://shop.test/pricing?utm_source=google&utm_medium=organic&email=private#secret'),
    crypto: { randomUUID: () => `uuid-${++nextId}` },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    document: { referrer: 'https://google.com/search?q=private', addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) },
    addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key),
    fetch: async (url, request) => { sent.push({ url, ...request, event: JSON.parse(request.body) }); return { ok: true }; }
  };
  runtime.history = { pushState: (_a, _b, path) => { runtime.location = new URL(path, runtime.location); }, replaceState: (_a, _b, path) => { runtime.location = new URL(path, runtime.location); } };
  return { runtime, sent, storage, listeners };
}
const options = { siteId: 'site-a', endpoint: 'https://collector.test/api/collect' };
test('consent blocks reads/writes, revocation clears identity and suppresses delivery', async () => {
  const b = browser(), sdk = createTideStat(options, b.runtime);
  assert.equal(await sdk.signup(), false); assert.equal(b.storage.size, 0); assert.equal(b.sent.length, 0);
  sdk.setConsent(true); assert.equal(b.sent.length, 1);
  const before = sdk.attribution(); sdk.setConsent(false);
  assert.deepEqual(sdk.attribution(), {}); assert.equal(b.storage.size, 0);
  assert.equal(await sdk.checkout(), false);
  sdk.setConsent(true); assert.notEqual(sdk.attribution().tidestat_visitor_id, before.tidestat_visitor_id);
  sdk.destroy();
});
test('canonical events sanitize automatic URL fields; revenue cannot be emitted', async () => {
  const b = browser(), sdk = createTideStat({ ...options, consent: true }, b.runtime);
  await sdk.purchase({ order_id: 'order-1' });
  const event = b.sent[1].event;
  assert.equal(event.schema_version, 1); assert.equal(event.type, 'purchase');
  assert.equal(event.path, '/pricing'); assert.equal(event.referrer, 'https://google.com/search');
  assert.equal(event.acquisition.source, 'google');
  assert.equal(JSON.stringify(event).includes('private'), false);
  await assert.rejects(sdk.track('revenue')); sdk.destroy();
});
test('persistent visitors survive reload and new sessions rotate after inactivity', () => {
  const b = browser(); let sdk = createTideStat({ ...options, consent: true }, b.runtime);
  const first = sdk.attribution(); sdk.destroy();
  const key = 'tidestat:site-a:identity', state = JSON.parse(b.storage.get(key));
  state.last_seen = Date.now() - 1800001; b.storage.set(key, JSON.stringify(state));
  sdk = createTideStat({ ...options, consent: true }, b.runtime);
  assert.equal(sdk.attribution().tidestat_visitor_id, first.tidestat_visitor_id);
  assert.notEqual(sdk.attribution().tidestat_session_id, first.tidestat_session_id);
  const other = createTideStat({ ...options, siteId: 'site-b', consent: true }, b.runtime);
  assert.notEqual(other.attribution().tidestat_visitor_id, first.tidestat_visitor_id);
  sdk.destroy(); other.destroy();
});
test('SPA listeners support multiple instances and restore original history', () => {
  const b = browser(), original = b.runtime.history.pushState;
  const one = createTideStat({ ...options, consent: true }, b.runtime);
  const two = createTideStat({ ...options, siteId: 'site-b', consent: true }, b.runtime);
  b.runtime.history.pushState(null, '', '/checkout'); assert.equal(b.sent.length, 4);
  one.destroy(); b.runtime.history.pushState(null, '', '/thanks'); assert.equal(b.sent.length, 5);
  two.destroy(); assert.equal(b.runtime.history.pushState, original); assert.equal(b.listeners.size, 0);
});
test('blocked storage and network do not interrupt customer flow', async () => {
  const b = browser(); Object.defineProperty(b.runtime, 'localStorage', { get() { throw Error('blocked'); } });
  const sdk = createTideStat({ ...options, consent: true }, b.runtime);
  assert.ok(sdk.attribution().tidestat_visitor_id);
  b.runtime.fetch = async () => { throw Error('offline'); };
  assert.equal(await sdk.signup(), false); sdk.setConsent(false); sdk.destroy();
});
test('Shopify cart carries only attribution with locale routing and clears on withdrawal', async () => {
  const b = browser(); b.runtime.Shopify = { routes: { root: '/fr/' } };
  const sdk = createTideStat({ ...options, consent: true, autoPageview: false }, b.runtime);
  assert.equal(await attachTideStatCart(sdk, b.runtime), true);
  assert.equal(b.sent[0].url, '/fr/cart/update.js');
  assert.deepEqual(b.sent[0].event.attributes, sdk.attribution());
  sdk.setConsent(false); assert.equal(await attachTideStatCart(sdk, b.runtime), false);
  await clearTideStatCart(b.runtime); assert.equal(b.sent[1].event.attributes.tidestat_visitor_id, ''); sdk.destroy();
});
test('Shopify sandbox adapter shares schema and identity, respects privacy', async () => {
  const callbacks = {}, sent = [], store = new Map(); let onPrivacy;
  const context = vm.createContext({ URL, Date, Promise, JSON, Object,
    init: { customerPrivacy: { analyticsProcessingAllowed: false } },
    api: { customerPrivacy: { subscribe: (_name, fn) => { onPrivacy = fn; } } },
    browser: { localStorage: { getItem: async key => store.get(key), setItem: async (key, value) => store.set(key, value), removeItem: async key => store.delete(key) } },
    analytics: { subscribe: (name, fn) => { callbacks[name] = fn; } },
    fetch: async (_url, request) => { sent.push(JSON.parse(request.body)); return { ok: true }; }
  });
  const script = readFileSync(new URL('../../integrations/shopify/customer-pixel.js', import.meta.url), 'utf8').replace("const TIDESTAT_SITE_ID = 'REPLACE_WITH_SITE_ID'", "const TIDESTAT_SITE_ID = 'site-a'");
  vm.runInContext(script, context);
  const event = { id: '1', clientId: 'client-1', timestamp: new Date().toISOString(), context: { window: { location: { href: 'https://shop.test/products/a' } }, document: { referrer: '' } }, data: {} };
  callbacks.page_viewed(event); await vm.runInContext('tidestatQueue', context); assert.equal(sent.length, 0);
  store.set('tidestat:site-a:identity', JSON.stringify({ visitor_id: 'sdk-visitor', session_id: 'sdk-session', last_seen: Date.now(), acquisition: { source: 'google', medium: 'organic', campaign: '' } }));
  onPrivacy({ customerPrivacy: { analyticsProcessingAllowed: true } });
  callbacks.checkout_completed({ ...event, data: { checkout: { order: { id: 'order-1' } } } });
  await vm.runInContext('tidestatQueue', context);
  const source = readFileSync(new URL('../../revenue.js', import.meta.url), 'utf8');
  const { normalizeEvent } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  for (const event of sent) assert.doesNotThrow(() => normalizeEvent(event));
  assert.equal(sent[0].visitor_id, 'sdk-visitor'); assert.equal(sent[0].type, 'purchase'); assert.equal(sent[0].schema_version, 1);
  assert.equal(sent[0].properties.order_id, 'order-1'); assert.equal(sent[0].properties.revenue, undefined);
  onPrivacy({ customerPrivacy: { analyticsProcessingAllowed: false } });
  callbacks.page_viewed(event); await vm.runInContext('tidestatQueue', context);
  assert.equal(sent.length, 1); assert.equal(store.size, 0);
});

test('SDK and Shopify events pass actual backend canonical normalization', async () => {
  const source = readFileSync(new URL('../../revenue.js', import.meta.url), 'utf8');
  const { normalizeEvent } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const b = browser(), sdk = createTideStat({ ...options, consent: true }, b.runtime);
  await sdk.track('product_viewed', { product_id: 'product-1' });
  await sdk.signup(); await sdk.checkout(); await sdk.purchase({ order_id: 'order-1' });
  for (const { event } of b.sent) assert.doesNotThrow(() => normalizeEvent(event));
  assert.equal(b.sent[0].event.type, 'page_view');
  assert.equal(b.sent[1].event.type, 'custom'); assert.equal(b.sent[1].event.properties.name, 'product_viewed');
  sdk.destroy();
});
test('heartbeats keep visible visitors live, stop on consent withdrawal and teardown', () => {
  const b = browser(); let tick, cleared = false;
  b.runtime.setInterval = (fn, delay) => { assert.equal(delay, 30000); tick = fn; return 1; };
  b.runtime.clearInterval = () => { cleared = true; };
  const sdk = createTideStat({ ...options, consent: true }, b.runtime);
  tick(); assert.equal(b.sent.at(-1).event.type, 'heartbeat');
  b.runtime.document.visibilityState = 'hidden'; tick(); assert.equal(b.sent.length, 2);
  b.runtime.document.visibilityState = 'visible'; sdk.setConsent(false); tick(); assert.equal(b.sent.length, 2);
  sdk.destroy(); assert.equal(cleared, true);
});
