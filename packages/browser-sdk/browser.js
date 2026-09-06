import { createTideStat } from './index.js';
// Use a module script; this wrapper selects its own resolved src rather than currentScript.
const script = [...document.querySelectorAll('script[type="module"][data-site]')]
  .find(element => element.src === import.meta.url || new URL(element.src).pathname === '/t.js');
if (script) {
  const collector = new URL(script.dataset.endpoint || '/api/collect', import.meta.url).href;
  window.tidestat = createTideStat({
    siteId: script.dataset.site,
    endpoint: collector,
    consent: script.dataset.consent === 'true',
    trackClicks: script.dataset.trackClicks === 'true'
  });
}
