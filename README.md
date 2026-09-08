# TideStat

**See the story behind every dollar.**

TideStat connects acquisition → visitor → session → behavior → conversion → verified payment → revenue. The real-time map, anonymous visitor characters, Website Footprints, movement and live event stream remain part of the experience: they provide the observed website journey behind a payment. The stream distinguishes unverified signup/checkout/purchase signals from verified payment/refund events and links to the same visitor’s Revenue Story. Journeys shows both a guest-compatible commerce funnel (`page_view → checkout → payment`) and a separate signup funnel (`page_view → signup → checkout → payment`).

## Documentation

Open **[the documentation website](docs/index.html)** for searchable navigation, installation guides, event reference and operational instructions. In a running deployment, visit `/docs/index.html`.

- [NPM / Browser SDK](docs/index.html#npm)
- [Shopify installation](docs/index.html#shopify)
- [Stripe payment linking](docs/index.html#stripe)
- [Canonical event schema](docs/index.html#events)
- [Revenue attribution and evidence boundaries](docs/index.html#attribution)
- [Aggregate Search Console imports](docs/index.html#search-console)
- [Multiple websites](docs/index.html#sites)
- [Deployment and migration](docs/index.html#deployment)

## Run locally

```sh
node server.cjs
```

Open `http://127.0.0.1:8893/docs/index.html` for documentation or `http://127.0.0.1:8893/live.html?demo=1` for the visual demo. This static server does not run the Worker APIs. Use Wrangler for D1, collection and payment verification:

```sh
npm install
npm run build
npx wrangler d1 execute tidestat --local --file=schema.sql
npx wrangler dev
```

Before production deployment, replace the account-specific database identifier and domain in `wrangler.toml`, back up the target D1 database, apply `schema.sql` remotely and configure `SITES_JSON` using `wrangler secret put SITES_JSON`. Each site has a collection origin, private read token and optional payment signing secrets. Do not commit those secrets.

## Architecture

The existing Cloudflare Worker and D1 remain the core. The revenue schema is additive; it does not reconstruct old sessions or payments from legacy page views. Browser and Shopify events share a canonical event schema. Provider-signed webhooks establish monetary revenue, with explicit site/visitor/session metadata required for attribution.

| Surface | Responsibility |
| --- | --- |
| `landing.html` | Public product page with an embedded interactive demo |
| `revenue.html` and revenue UI modules | Revenue dashboard and stories |
| `live.html` and scene modules | Real-time map, visitor characters and Website Footprints |
| `worker.js` and revenue modules | Collection, site-scoped reads, signed payment ingestion, revenue aggregation |
| `schema.sql` | Legacy realtime tables plus canonical event and revenue storage |
| `packages/browser-sdk` | Local ESM SDK with TypeScript declarations; page views and explicit business events |
| `integrations/shopify` | Manual theme/cart attribution helper and customer-events pixel |
| `docs/index.html` | Navigable product and developer documentation |

## Evidence boundaries

- The npm package is **not published**. Install it by local path: `npm install /absolute/path/to/tidestat/packages/browser-sdk`.
- Stripe currently recognizes paid Checkout Sessions, and Shopify recognizes signed `orders/paid` events. Paid Stripe invoices and successful observed Stripe/Shopify refunds are also supported. MRR and subscription-state reconciliation are not implemented.
- Browser `purchase` or `revenue` events are behavior signals, not verified money. Replayed provider payments deduplicate by provider payment identity.
- Missing or cross-site identity produces unattributed payments. TideStat does not guess a visitor from email, IP or timing.
- Revenue is net observed receipts (gross minus observed refunds), in provider currency and minor units. Fees/disputes are excluded; there is no FX or accounting reconciliation.
- Dashboard dimensions retain their evidence boundaries: first captured context for source/device/geography, overlapping assisted page/link revenue, observed session entry/exit, and UTC time buckets. Explicit UTM keywords are separate from organic queries; unknown historical context is not backfilled.
- Search Console is an authenticated aggregate-import API, without OAuth or automatic sync. Search queries must never be assigned to individual visitors.
- Revenue data has a separate lifetime from legacy realtime records. Operate an explicit retention/deletion policy; do not assume all data expires after 24 hours.
- A complete-looking demo does not prove a live integration. Merchant credentials and end-to-end test payments are required before production reliance.

## Accounts and pricing

Google sign-in and user-owned websites use the account workflow at `/account.html`; legacy operator-managed sites remain separate. The shared plan catalog is served by `/api/plans`: Free ($0, 1 website, 10,000 monthly events), Starter ($9/month or $90/year, 3 websites, 100,000 events), and Growth ($29/month or $290/year, 10 websites, 1,000,000 events). All analytics features are included; annual prices are annual totals in USD.

Apply `migrations/0003_accounts.sql`. Configure `APP_ORIGIN`, Google OAuth credentials, the Stripe billing secret and recurring Price IDs described in [deployment documentation](docs/index.html#deployment). Google sign-in and billing are not considered activated until those settings and their end-to-end flows are verified. Checkout return URLs never grant entitlements; the server verifies subscription state. TideStat plan billing is separate from website revenue payment connectors.

## Verification

```sh
npm test --prefix packages/browser-sdk
node --test tests/revenue-backend.mjs
```

Existing scene and privacy checks remain under `tests/`. Browser checks require their browser dependencies and a running local server. The canonical `/t.js` module flow has also passed a cross-origin browser check. Local tests cannot establish successful deployment, live webhook registration or merchant checkout behavior.

Earlier implementation notes remain in [docs/realtime-map.md](docs/realtime-map.md), [docs/footprints.md](docs/footprints.md), [docs/avatars.md](docs/avatars.md) and [docs/themes.md](docs/themes.md). They describe their individual surfaces; the Revenue Story documentation above governs the new integration and attribution contract.

All product pages share one waveform mark and palette, English/Chinese catalogs, and persisted system/light/dark preferences. The landing demo follows the same preferences. Exported Insights are local SVG/PNG files containing aggregate data only. Run `node tests/product-ui.mjs` and `node tests/landing.mjs` against the preview server for cross-page checks.
