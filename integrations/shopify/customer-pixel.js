/* Paste into Shopify Settings > Customer events > Add custom pixel.
 * Set Customer privacy to require Analytics consent. Replace both values below.
 * Configure the verified orders/paid webhook separately; checkout_completed is NOT revenue.
 */
const TIDESTAT_SITE_ID = 'REPLACE_WITH_SITE_ID';
const TIDESTAT_ENDPOINT = 'https://REPLACE_WITH_TIDESTAT_HOST/api/collect';
let tidestatPrivacy = init.customerPrivacy;
let tidestatMemory;
let tidestatPageContext=init.context;
let tidestatQueue = Promise.resolve();
const tidestatStorageKey = `tidestat:${TIDESTAT_SITE_ID}:identity`;
api.customerPrivacy.subscribe('visitorConsentCollected', event => {
  tidestatPrivacy = event.customerPrivacy;
  if (!tidestatPrivacy.analyticsProcessingAllowed) {
    tidestatMemory = undefined;
    void browser.localStorage.removeItem(tidestatStorageKey).catch(() => {});
  }
});
const tidestatEvents = { page_viewed: 'page_view', product_viewed: 'custom', product_added_to_cart: 'custom', checkout_started: 'checkout', checkout_completed: 'purchase', clicked: 'outbound_click' };
for (const [shopifyEvent, type] of Object.entries(tidestatEvents)) {
  analytics.subscribe(shopifyEvent, event => {
    tidestatQueue = tidestatQueue.then(async () => {
      if (!tidestatPrivacy?.analyticsProcessingAllowed || TIDESTAT_SITE_ID === 'REPLACE_WITH_SITE_ID') return;
      if(event.context)tidestatPageContext=event.context;
      const context=event.context||tidestatPageContext;if(!context?.window?.location?.href)return;
      const location = new URL(context.window.location.href);
      let outboundUrl='';
      if(type==='outbound_click'){try{const destination=new URL(event.data?.element?.href,location);if(!event.data?.element?.href||!['http:','https:'].includes(destination.protocol)||destination.origin===location.origin)return;outboundUrl=destination.origin+destination.pathname;}catch{return;}}
      let referrer='';try{const ref=new URL(context.document.referrer);referrer=ref.origin+ref.pathname;}catch{/* No external referrer. */}
      const occurredAt = Date.parse(event.timestamp);
      let state = tidestatMemory;
      try { state = JSON.parse(await browser.localStorage.getItem(tidestatStorageKey)) || state; } catch { /* Memory-only fallback. */ }
      if (!tidestatPrivacy?.analyticsProcessingAllowed) return;
      if (!state?.visitor_id) state = { visitor_id: `shopify-${event.clientId}` };
      if (!state.session_id || !Number.isFinite(state.last_seen) || occurredAt - state.last_seen >= 1800000) {
        let source = 'direct';
        try { const referrer = new URL(context.document.referrer); if (referrer.hostname !== location.hostname) source = referrer.hostname; } catch { /* Direct. */ }
        state.session_id = `shopify-${event.id}`;
        state.acquisition = { source: location.searchParams.get('utm_source') || source, medium: location.searchParams.get('utm_medium') || (source === 'direct' ? 'none' : /google\.|bing\.|duckduckgo\./i.test(source) ? 'organic' : 'referral'), campaign: location.searchParams.get('utm_campaign') || '', term: location.searchParams.get('utm_term') || '' };
      }
      state.last_seen = occurredAt;
      tidestatMemory = state;
      try { await browser.localStorage.setItem(tidestatStorageKey, JSON.stringify(state)); } catch { /* Storage unavailable. */ }
      if (!tidestatPrivacy?.analyticsProcessingAllowed) {
        try { await browser.localStorage.removeItem(tidestatStorageKey); } catch { /* Storage unavailable. */ }
        return;
      }
      const checkout = event.data?.checkout;
      await fetch(TIDESTAT_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, credentials: 'omit', body: JSON.stringify({
        schema_version: 1, event_id: `shopify-${event.id}`, site_id: TIDESTAT_SITE_ID,
        visitor_id: state.visitor_id, session_id: state.session_id, type,
        path: location.pathname, referrer, context:{viewport_width:context.window.innerWidth,viewport_height:context.window.innerHeight}, occurred_at: occurredAt, acquisition: state.acquisition,
        properties: { ...(outboundUrl ? {outbound_url:outboundUrl} : {}), ...(type === 'custom' ? { name: shopifyEvent } : {}), ...(checkout?.order?.id ? { order_id: checkout.order.id } : {}) }
      }) });
    }).catch(() => { /* Analytics must never interrupt checkout; failures are not revenue. */ });
  });
}
