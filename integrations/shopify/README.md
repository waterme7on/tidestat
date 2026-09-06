# Shopify integration (manual setup)

This is a theme helper plus custom customer-events pixel, not an installed/public Shopify app. Store setup and a real test order still need merchant access.

1. Register the storefront domain in TideStat, configure the Shopify shop and webhook secret on the server, and register the `orders/paid` webhook with the connector endpoint documented in `/docs/index.html#shopify`.
2. Load the browser SDK in the theme with `autoPageview: false`. Use the same site ID for theme and pixel. Connect SDK consent to your consent manager.
3. Before normal cart checkout, `await attachTideStatCart(tide)` from `cart-attribution.mjs`. This uses Shopify's locale-aware Ajax Cart API and writes `tidestat_site_id`, `tidestat_visitor_id`, `tidestat_session_id` to cart attributes. Ensure the cart request completes before proceeding. Do not block checkout if analytics fails.
4. In Shopify **Settings → Customer events**, create a custom pixel and paste `customer-pixel.js`, replacing its site ID and HTTPS collector URL. Require **Analytics** consent in Customer privacy settings, test it, then connect it. The adapter also checks Shopify's current analytics permission and handles withdrawal.
5. On consent withdrawal, call `tide.setConsent(false)` and `await clearTideStatCart()`. Clear attributes retained in the cart as well as local identity.
6. Make a consented test visit → cart → checkout → paid order. Verify the signed webhook produces one payment, exact amount/currency, and the original visitor story. Replay the webhook to verify deduplication. Repeat without consent and with accelerated checkout: missing identity must remain unattributed.

The pixel emits canonical `page_view`, `custom` (named `product_viewed` or `product_added_to_cart`), `checkout` and `purchase`. `checkout_completed` is not trusted payment evidence. It intentionally omits customer email, address and line-item personal data. The theme SDK and pixel share a site-scoped first-party identity where Shopify's storage context permits; cross-domain checkout, accelerated checkout, blocked storage or missing cart attributes can break the join. Never infer identity from email or an approximate time match.

Official API references verified during implementation:

- [Ajax Cart update API](https://shopify.dev/docs/api/ajax/reference/cart)
- [Customer events](https://shopify.dev/docs/api/web-pixels-api/standard-events/page_viewed)
- [Asynchronous top-frame browser storage](https://shopify.dev/docs/api/web-pixels-api/standard-api/browser)
- [Custom-pixel consent status](https://shopify.dev/docs/api/web-pixels-api/standard-api/customerprivacy)
