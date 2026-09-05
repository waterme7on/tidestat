/* Apply before first paint. The viewer's preference is not a city's solar time. */
(() => {
  'use strict';
  const KEY = 'tidestat:theme';
  const allowed = new Set(['system', 'light', 'dark']);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const root = document.documentElement;
  let preference = 'system';
  let resolved;
  function readPreference() {
    try { const saved = localStorage.getItem(KEY); return allowed.has(saved) ? saved : 'system'; }
    catch { return 'system'; }
  }
  function apply() {
    const next = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    const changed = next !== resolved;
    resolved = next;
    root.dataset.theme = resolved;
    root.dataset.themePreference = preference;
    root.style.colorScheme = resolved;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta); }
    meta.content = resolved === 'dark' ? '#101112' : '#f8f9f6';
    const select = document.getElementById('mapTheme');
    if (select) select.value = preference;
    window.dispatchEvent(new CustomEvent('tide:themechange', { detail: { preference, resolved, changed } }));
  }
  function setPreference(value) {
    if (!allowed.has(value)) return;
    preference = value;
    try { localStorage.setItem(KEY, value); } catch { /* A session override still works without storage. */ }
    apply();
  }
  preference = readPreference();
  window.__tideTheme = Object.freeze({
    get preference() { return preference; },
    get resolved() { return resolved; },
    setPreference,
  });
  media.addEventListener('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    preference = readPreference(); apply();
  });
  apply();
})();
