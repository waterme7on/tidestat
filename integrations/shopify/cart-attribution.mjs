/** Call and await immediately before normal cart checkout, after analytics consent.
 * Cart attributes become order note_attributes for the verified webhook join.
 * Accelerated checkout can bypass cart hooks: that revenue must remain unattributed.
 */
export async function attachTideStatCart(tidestat, runtime = window) {
  const attributes = tidestat.attribution();
  if (!attributes.tidestat_visitor_id) return false;
  const root = runtime.Shopify?.routes?.root || '/';
  const response = await runtime.fetch(`${root}cart/update.js`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin', body: JSON.stringify({ attributes })
  });
  return response.ok;
}

/** Call when consent is withdrawn to clear attribution still held by the cart. */
export async function clearTideStatCart(runtime = window) {
  const root = runtime.Shopify?.routes?.root || '/';
  const response = await runtime.fetch(`${root}cart/update.js`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify({ attributes: { tidestat_site_id: '', tidestat_visitor_id: '', tidestat_session_id: '' } })
  });
  return response.ok;
}
