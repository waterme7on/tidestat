/* Dashboard credentials stay in this tab; never add read tokens to URLs. */
window.tideConnection = {
  get() { try { return JSON.parse(sessionStorage.getItem('tidestat.connection') || '{}'); } catch { return {}; } },
  set(site, token) { sessionStorage.setItem('tidestat.connection', JSON.stringify({ site, token })); },
  clear() { sessionStorage.removeItem('tidestat.connection'); },
  request(path, params = {}) {
    const { site, token } = this.get();
    const url = new URL(path, location.href);
    if (site) url.searchParams.set('site', site);
    for (const [key, value] of Object.entries(params)) if (value !== '' && value != null) url.searchParams.set(key, value);
    return { url: url.pathname + url.search, headers: token ? { Authorization: `Bearer ${token}` } : {} };
  }
};
