# TideStat Browser SDK

Zero dependencies, ESM and TypeScript declarations. This package is local and **not published to npm**.

```sh
npm install ./packages/browser-sdk
```

```js
import { createTideStat } from '@tidestat/browser-sdk';
const tide = createTideStat({
  siteId: 'YOUR_SITE_ID',
  endpoint: 'https://YOUR_TIDESTAT_HOST/api/collect',
  consent: false,
  trackClicks: true
});
// Connect this to your consent manager. No IDs are read/written before consent.
tide.setConsent(true);
await tide.signup({ plan: 'pro' });
await tide.checkout({ plan: 'pro' });
await tide.track('trial_started', { plan: 'pro' });
// Purchase is a behavioral signal. Only verified payment webhooks recognize revenue.
await tide.purchase({ order_id: 'your-order-id' });
// On SPA teardown:
tide.destroy();
```

Visible pages emit a heartbeat every 30 seconds to preserve the realtime visitor view. Heartbeats stop after withdrawal or teardown.

Pageviews run initially and on pathname changes via pushState, replaceState and popstate. For hash routers or custom navigation, disable `autoPageview` and call `page()` yourself. Click tracking requires `trackClicks: true` and an explicit `<button data-tidestat-event="upgrade">` marker; no text or input values are captured. Query strings and fragments are excluded from page/referrer fields; only UTM source/medium/campaign are collected. Do not put personal or sensitive data in paths or custom properties. Arbitrary event names become canonical `custom` events with `properties.name`. The server keeps only string properties `name`, `label`, `target`, `product_id`, `plan`, and `order_id`; other properties are discarded.

Visitor identity is site-scoped in first-party localStorage, with a 30-minute inactivity session expiry. Blocked storage falls back to memory and loses cross-page continuity. Revoking consent stops tracking and clears this SDK's identity; it does not erase already collected server data. Delivery returns `false` on network/server failure; there is no offline retry guarantee.

## Payment attribution

Send `tide.attribution()` to **your own server** when requesting checkout. Validate the supplied site against your server's configured TideStat site and carry the metadata into Stripe Checkout `metadata` and (for subscriptions) `subscription_data.metadata`. Browser-supplied IDs are correlation hints, not authentication or proof of payment. Never ship Stripe or connector secrets to the browser. Cross-device or missing metadata payments remain unattributed.

Metadata keys: `tidestat_site_id`, `tidestat_visitor_id`, `tidestat_session_id`.

## Verification

```sh
npm test --prefix packages/browser-sdk
npm pack --dry-run ./packages/browser-sdk
```
