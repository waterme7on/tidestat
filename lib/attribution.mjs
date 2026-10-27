/**
 * Optional last-non-direct attribution helpers inspired by Minilytics.
 * This module NEVER links a payment to a visitor. Callers must first establish
 * a verified site-scoped visitor/session association.
 */
const DIRECT = new Set(['', 'direct', '(direct)', 'none', '(none)']);
const AI_HOSTS = new Map([
  ['chatgpt.com', 'ChatGPT'], ['chat.openai.com', 'ChatGPT'],
  ['perplexity.ai', 'Perplexity'], ['claude.ai', 'Claude'],
  ['gemini.google.com', 'Gemini'], ['copilot.microsoft.com', 'Copilot']
]);
function hostOf(referrer) {
  try { return new URL(referrer).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
}
export function classifyTraffic({ referrer = '', utm_source = '', utm_medium = '' } = {}) {
  const source = String(utm_source || '').trim().toLowerCase();
  const medium = String(utm_medium || '').trim().toLowerCase();
  const host = hostOf(referrer);
  const ai = [...AI_HOSTS].find(([domain]) => host === domain || host.endsWith('.' + domain));
  if (source) return { channel: /^(chatgpt|perplexity|claude|gemini|copilot)$/.test(source) ? 'ai' : (medium || 'campaign'), source, evidence: 'utm' };
  if (ai) return { channel: 'ai', source: ai[1], evidence: 'referrer' };
  if (host) return { channel: 'referral', source: host, evidence: 'referrer' };
  return { channel: 'direct', source: 'direct', evidence: 'none' };
}
/**
 * @param {Array<{site_id:string, occurred_at:string, referrer?:string, utm_source?:string, utm_medium?:string}>} sessions
 * @param {{site_id:string, paid_at:string, lookback_days?:number}} payment
 * @returns {null|{session:object, traffic:object, method:string}}
 */
export function lastNonDirectTouch(sessions, payment) {
  if (!payment?.site_id || !payment?.paid_at) return null;
  const paidAt = Date.parse(payment.paid_at);
  if (!Number.isFinite(paidAt)) return null;
  const days = Math.min(365, Math.max(0, Number(payment.lookback_days ?? 30)));
  const candidates = (sessions || []).filter(s => {
    const time = Date.parse(s.occurred_at);
    return s.site_id === payment.site_id && Number.isFinite(time) &&
      time <= paidAt && time >= paidAt - days * 86400000;
  }).map(s => ({ session: s, traffic: classifyTraffic(s) }))
    .filter(x => !DIRECT.has(x.traffic.source.toLowerCase()) && x.traffic.channel !== 'direct')
    .sort((a, b) => Date.parse(b.session.occurred_at) - Date.parse(a.session.occurred_at));
  return candidates.length ? { ...candidates[0], method: 'last_non_direct_touch' } : null;
}
