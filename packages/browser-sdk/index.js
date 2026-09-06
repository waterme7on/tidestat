const navigation = new WeakMap();
const SESSION_TTL = 30 * 60 * 1000;
const canonicalTypes = new Set(['page_view', 'outbound_click', 'click', 'custom', 'signup', 'checkout', 'purchase', 'identify', 'heartbeat']);
const reserved = new Set(['revenue', 'payment', 'refund']);
const id = (runtime) => runtime.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

function listenNavigation(runtime, callback) {
  let entry = navigation.get(runtime);
  if (!entry) {
    const callbacks = new Set();
    const notify = () => callbacks.forEach(fn => fn());
    const originals = {};
    const wrappers = {};
    for (const method of ['pushState', 'replaceState']) {
      originals[method] = runtime.history[method];
      wrappers[method] = function (...args) {
        const result = originals[method].apply(this, args);
        notify();
        return result;
      };
      runtime.history[method] = wrappers[method];
    }
    runtime.addEventListener('popstate', notify);
    entry = { callbacks, notify, originals, wrappers };
    navigation.set(runtime, entry);
  }
  entry.callbacks.add(callback);
  return () => {
    entry.callbacks.delete(callback);
    if (entry.callbacks.size) return;
    runtime.removeEventListener('popstate', entry.notify);
    for (const method of ['pushState', 'replaceState']) {
      if (runtime.history[method] === entry.wrappers[method]) runtime.history[method] = entry.originals[method];
    }
    navigation.delete(runtime);
  };
}

/** Zero-dependency browser collector. Consent defaults to off; never sends trusted revenue. */
export function createTideStat(options, runtime = globalThis.window) {
  if (!options?.siteId || !options?.endpoint) throw new Error('siteId and endpoint are required');
  const endpoint = new URL(options.endpoint, runtime?.location?.href);
  if (!['https:', 'http:'].includes(endpoint.protocol)) throw new Error('Invalid collector URL');
  const key = `tidestat:${options.siteId}:identity`;
  let consent = options.consent === true;
  let destroyed = false;
  let state;
  let lastPath;
  let removeNavigation;
  let heartbeat;
  const read = () => { try { return JSON.parse(runtime.localStorage.getItem(key)); } catch { return null; } };
  const save = () => { try { runtime.localStorage.setItem(key, JSON.stringify(state)); } catch { /* Memory-only when storage is unavailable. */ } };
  const acquisition = () => {
    const url = new URL(runtime.location.href);
    let host = '';
    try { host = new URL(runtime.document.referrer).hostname; } catch { /* Direct visit. */ }
    return {
      source: url.searchParams.get('utm_source') || (host && host !== url.hostname ? host : 'direct'),
      medium: url.searchParams.get('utm_medium') || (host && host !== url.hostname ? (/google\.|bing\.|duckduckgo\./i.test(host) ? 'organic' : 'referral') : 'none'),
      campaign: url.searchParams.get('utm_campaign') || '',
      term: url.searchParams.get('utm_term') || ''
    };
  };
  const identity = () => {
    const now = Date.now();
    if (!state) {
      const stored = read();
      state = stored && typeof stored.visitor_id === 'string' ? stored : { visitor_id: id(runtime) };
    }
    if (!state.session_id || !Number.isFinite(state.last_seen) || now - state.last_seen >= SESSION_TTL) {
      state = { visitor_id: state.visitor_id, session_id: id(runtime), last_seen: now, acquisition: acquisition() };
    }
    state.last_seen = now;
    save();
    return state;
  };
  const track = async (type, properties = {}) => {
    if (!consent || destroyed || !runtime) return false;
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(type) || reserved.has(type)) throw new Error('Use a behavioral event; revenue is accepted only from verified connectors');
    if (!canonicalTypes.has(type)) { properties = { ...properties, name: type }; type = 'custom'; }
    const current = identity();
    const event = {
      schema_version: 1, event_id: id(runtime), site_id: options.siteId,
      visitor_id: current.visitor_id, session_id: current.session_id,
      type, path: runtime.location.pathname, referrer: '', occurred_at: Date.now(),
      acquisition: current.acquisition, properties,
      context: { viewport_width: runtime.innerWidth, viewport_height: runtime.innerHeight }
    };
    // Never collect query strings, fragments, element text, form values, or referrer query parameters.
    try { const ref = new URL(runtime.document.referrer); event.referrer = ref.origin + ref.pathname; } catch { /* No referrer. */ }
    try {
      const body = JSON.stringify(event);
      if (body.length > 16000) throw new Error('Event exceeds 16 KB');
      const response = await runtime.fetch(endpoint.href, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true, credentials: 'omit' });
      return response.ok;
    } catch { return false; }
  };
  const page = () => { lastPath = runtime?.location?.pathname; return track('page_view'); };
  const click = (event) => {
    if (!consent || destroyed) return;
    const target = options.trackClicks === true && event.target?.closest?.('[data-tidestat-event]');
    if (target) void track('click', { name: String(target.getAttribute('data-tidestat-event')).slice(0, 128) });
    if(options.trackOutbound !== false) {
      const anchor=event.target?.closest?.('a[href]');
      try {const destination=new URL(anchor?.href || anchor?.getAttribute?.('href'),runtime.location.href);if(anchor && ['http:','https:'].includes(destination.protocol) && destination.origin!==runtime.location.origin)void track('outbound_click',{outbound_url:destination.origin+destination.pathname});}catch{/* Not a navigable external link. */}
    }
  };
  if (runtime) {
    heartbeat = runtime.setInterval?.(() => {
      if (consent && runtime.document.visibilityState !== 'hidden') void track('heartbeat');
    }, 30000);
    if (options.autoPageview !== false) {
      removeNavigation = listenNavigation(runtime, () => { if (runtime.location.pathname !== lastPath) void page(); });
      if (consent) void page();
    }
    if (options.trackClicks === true || options.trackOutbound !== false) runtime.document.addEventListener('click', click);
  }
  return {
    track, page,
    signup: properties => track('signup', properties),
    checkout: properties => track('checkout', properties),
    purchase: properties => track('purchase', properties),
    attribution() {
      if (!consent || destroyed || !runtime) return {};
      const current = identity();
      return { tidestat_site_id: options.siteId, tidestat_visitor_id: current.visitor_id, tidestat_session_id: current.session_id };
    },
    setConsent(granted) {
      if (destroyed) return;
      const wasGranted = consent;
      consent = granted === true;
      if (!consent) {
        state = undefined;
        lastPath = undefined;
        try { runtime?.localStorage.removeItem(key); } catch { /* Storage blocked. */ }
      } else if (!wasGranted && options.autoPageview !== false) void page();
    },
    destroy() {
      destroyed = true;
      removeNavigation?.();
      runtime?.clearInterval?.(heartbeat);
      runtime?.document.removeEventListener('click', click);
    }
  };
}
