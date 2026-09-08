import './pricing-locale.js';
import { locale, tr } from './product-ui.js';

// Static preview uses the same public catalog as the server. Live catalog wins.
const fallbackPlans = [
  { id: 'free', monthlyUsd: 0, yearlyUsd: 0, sites: 1, monthlyEvents: 10000 },
  { id: 'starter', monthlyUsd: 9, yearlyUsd: 90, sites: 3, monthlyEvents: 100000 },
  { id: 'growth', monthlyUsd: 29, yearlyUsd: 290, sites: 10, monthlyEvents: 1000000 }
];
let plans = fallbackPlans;
const isPricingPage = document.body.classList.contains('pricing-page');
let interval = new URLSearchParams(location.search).get('interval') === 'year' ? 'year' : 'month';
const cards = [...document.querySelectorAll('[data-pricing-card]')];
const money = amount => new Intl.NumberFormat(locale(), { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 }).format(amount);
function render() {
  for (const card of cards) {
    const plan = plans.find(item => item.id === card.dataset.plan);
    if (!plan) continue;
    const yearly = interval === 'year' && plan.id !== 'free';
    const amount = yearly ? plan.yearlyUsd : plan.monthlyUsd;
    card.querySelector('[data-price]').textContent = money(amount);
    card.querySelector('[data-price-unit]').textContent = tr(yearly ? '/ year' : '/ month');
    card.querySelector('[data-billing-note]').textContent = tr(plan.id === 'free' ? 'No subscription required.' : yearly ? '{amount} billed annually in USD.' : 'Billed monthly in USD.', { amount: money(amount) });
    const count = new Intl.NumberFormat(locale()).format(plan.sites);
    card.querySelector('[data-sites]').textContent = tr(plan.sites === 1 ? '{count} website' : '{count} websites', { count });
    card.querySelector('[data-events]').textContent = tr('{count} events / month', { count: new Intl.NumberFormat(locale()).format(plan.monthlyEvents) });
    card.querySelector('[data-plan-cta]').href = `./account.html?plan=${plan.id}&interval=${interval}`;
  }
  document.querySelectorAll('[data-billing-interval]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.billingInterval === interval)));
  const context = document.querySelector('[data-billing-context]');
  if (context) context.textContent = tr(interval === 'year' ? 'Yearly billing · full annual prices in USD' : 'Monthly billing · prices in USD');
  if (isPricingPage) document.title = tr('Pricing · TideStat');
}
document.querySelectorAll('[data-billing-interval]').forEach(button => button.addEventListener('click', () => {
  interval = button.dataset.billingInterval;
  const url = new URL(location.href);
  url.searchParams.set('interval', interval);
  history.replaceState(null, '', url);
  render();
}));
window.addEventListener('tide:languagechange', render);
render();
// A missing API on an asset-only preview leaves the explicitly listed prices intact.
async function loadCatalog() {
  try {
    const response = await fetch('./api/plans', { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const data = await response.json();
    // Normalize the public API only after validating the entire catalog.
    if (!Array.isArray(data.plans) || data.plans.some(plan => plan.currency !== 'USD')) return;
    const candidate = data.plans.map(plan => ({ id: plan.id, monthlyUsd: plan.monthlyPrice, yearlyUsd: plan.yearlyPrice, sites: plan.limits?.sites, monthlyEvents: plan.limits?.monthlyEvents }));
    if (candidate.length !== 3 || !fallbackPlans.every(base => candidate.some(plan => plan.id === base.id)) || candidate.some(plan => [plan.monthlyUsd, plan.yearlyUsd, plan.sites, plan.monthlyEvents].some(value => !Number.isFinite(value) || value < 0))) return;
    plans = candidate;
    render();
  } catch { /* The account page verifies availability before checkout. */ }
}
if (cards.length) void loadCatalog();
