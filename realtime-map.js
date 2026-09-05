/* Conventional Leaflet map. No globe, fabricated geography, GPS inference or avatar service. */
const L = window.L;
const root = document.getElementById('liveMap');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const markers = new Map(), rows = new Map();
const el = id => document.getElementById(id);
const bridge = () => window.__tide || {};
const activeVisitors = () => [...(bridge().visitors || new Map())].filter(([, v]) => v.state !== 'leaving');
const selected = () => bridge().selectedId;
const world = [[-55, -170], [76, 180]];
let map, cluster, tiles, timer, selectedPopup, active = true, fitted = true, selection = null, tileFailures = 0;

// Stable, intentionally fictional identities. Appearance depends only on the anonymous ID.
export function avatarSVG(id) {
  let h = 2166136261;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const backgrounds = ['#e1efe6', '#f6e4dc', '#e3eaf9', '#f5edcf', '#ece3f5', '#dceff2'];
  const skins = ['#f5c9a5', '#e9ae83', '#d7956d', '#a96d50', '#f7d9bf'];
  const hairs = ['#322b30', '#654332', '#b77b40', '#3c384b'];
  const shirts = ['#638c78', '#d98168', '#728fc4', '#ae8bc3', '#c49d49', '#519ba0'];
  const bg = backgrounds[h % 6], skin = skins[(h >>> 4) % 5], hair = hairs[(h >>> 8) % 4], shirt = shirts[(h >>> 12) % 6];
  const style = (h >>> 16) % 4;
  const back = style === 1 ? `<path d="M12 36C9 9 52 9 52 36V51H12Z" fill="${hair}"/>` : '';
  const fringe = [
    '<path d="M16 30V24C16 7 49 7 49 26V31L43 23C36 25 27 22 24 19L19 30Z"/>',
    '<path d="M15 30V25C15 7 49 7 49 26V32L43 21C35 28 25 21 23 19L20 29Z"/>',
    '<path d="M16 29V23C17 8 47 6 49 25L47 32L43 21L19 27Z"/>',
    '<path d="M16 30V24C16 8 48 8 49 26V30L43 22C31 24 24 23 19 26Z"/>'
  ][style];
  const cap = style === 3 ? `<path d="M14 24C15 8 46 8 49 24Z" fill="${shirt}"/><path d="M13 24H51" stroke="${shirt}" stroke-width="5" stroke-linecap="round"/>` : '';
  const glasses = ((h >>> 20) % 4 === 0) ? '<g fill="none" stroke="#39333b" stroke-width="1.5"><rect x="21" y="30" width="9" height="8" rx="3"/><rect x="34" y="30" width="9" height="8" rx="3"/><path d="M30 33h4"/></g>' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="${bg}"/>${back}<path d="M10 57Q13 44 32 44Q51 44 54 57Q32 70 10 57" fill="${shirt}"/><rect x="27" y="43" width="10" height="9" rx="4" fill="${skin}"/><circle cx="16" cy="34" r="4" fill="${skin}"/><circle cx="48" cy="34" r="4" fill="${skin}"/><rect x="16" y="15" width="32" height="33" rx="15" fill="${skin}"/><g fill="${hair}">${fringe}</g>${cap}<g fill="#332b31"><ellipse cx="25.5" cy="33.5" rx="2.2" ry="2.9"/><ellipse cx="38.5" cy="33.5" rx="2.2" ry="2.9"/></g><g fill="#fff"><circle cx="26" cy="32.5" r=".8"/><circle cx="39" cy="32.5" r=".8"/></g><g fill="#e78e8d" opacity=".55"><ellipse cx="21" cy="39" rx="3.5" ry="2"/><ellipse cx="43" cy="39" rx="3.5" ry="2"/></g><path d="M29 40Q32 44 35 40" fill="none" stroke="#854b45" stroke-width="1.5" stroke-linecap="round"/>${glasses}</svg>`;
}
function locationOf(v) {
  const lat = v.city?.[2], lng = v.city?.[3];
  if (lat == null || lng == null || lat === '' || lng === '') return null;
  const a = Number(lat), b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 85.051129 && Math.abs(b) <= 180 ? [a, b] : null;
}
function currentPage(v) {
  if (v.currentPath) return v.currentPath;
  const node = v.state === 'walking' ? v.target : v.node;
  return (window.__tideSite?.nodes || []).find(n => n.id === node)?.label || '浏览中';
}
function countryName(code) {
  if (!/^[A-Z]{2}$/.test(code || '')) return '';
  try { return new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(code) || code; } catch { return code; }
}
function locationName(v) { return [v.city?.[0] || '未知位置', countryName(v.city?.[1])].filter(Boolean).join(' · '); }
function text(tag, value, className) {
  const node = document.createElement(tag); node.textContent = value;
  if (className) node.className = className;
  return node;
}
function popup(v, id) {
  const card = document.createElement('div'); card.className = 'visitor-popup';
  const top = document.createElement('div'); top.className = 'visitor-popup-head';
  const face = document.createElement('span'); face.className = 'visitor-face'; face.innerHTML = avatarSVG(id);
  const title = document.createElement('div'); title.append(text('strong', locationName(v)), text('span', '匿名访客 · ' + String(v.id).slice(0, 8)));
  top.append(face, title); card.append(top);
  const details = document.createElement('div'); details.className = 'visitor-popup-page';
  details.append(text('span', '正在浏览'), text('b', currentPage(v))); card.append(details);
  card.append(text('p', '城市级近似位置，头像为随机生成。', 'visitor-privacy'));
  const button = text('button', '查看访问足迹 →'); button.type = 'button';
  button.addEventListener('click', () => { el('visitorDetail').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'nearest' }); });
  card.append(button); return card;
}
function markerIcon(id) {
  return L.divIcon({ className: 'visitor-marker', html: `<span class="visitor-pin"><span class="visitor-face">${avatarSVG(id)}</span><i class="visitor-online" aria-hidden="true"></i></span>`, iconSize: [46, 52], iconAnchor: [23, 51], popupAnchor: [0, -48] });
}
function clusterIcon(group) {
  const children = group.getAllChildMarkers().sort((a, b) => a.options.visitorId.localeCompare(b.options.visitorId));
  const count = children.length;
  const faces = children.slice(0, 3).map(m => `<span class="visitor-face">${avatarSVG(m.options.visitorId)}</span>`).join('');
  return L.divIcon({ className: 'visitor-cluster', html: `<span class="visitor-stack" aria-label="${count} 位访客，点击放大或展开头像">${faces}<b>${count}</b></span>`, iconSize: [76, 48], iconAnchor: [38, 44] });
}
function applySelection() {
  for (const [id, m] of markers) {
    m.getElement()?.classList.toggle('is-selected', selected() === id);
    m.setZIndexOffset(selected() === id ? 1000 : 0);
  }
  for (const [id, row] of rows) row.classList.toggle('is-selected', selected() === id);
}
function focusVisitor(id) {
  selection = id;
  const v = bridge().visitors?.get(id), loc = v && locationOf(v);
  if (!map || !loc || !active) { map?.closePopup(); applySelection(); return; }
  // Selection belongs to the visitor, not to an ephemeral clustered marker.
  // A map-owned popup survives cluster regrouping and live data synchronization.
  map.setView(loc, Math.max(map.getZoom(), 3), { animate: false });
  selectedPopup = L.popup({ className: 'live-visitor-popup', maxWidth: 280, minWidth: 210, autoPanPadding: [30, 60], offset: [0, -32], closeButton: true })
    .setLatLng(loc).setContent(popup(v, id)).openOn(map);
  applySelection();
}
function showWorld() {
  if (!map) return;
  map.stop(); map.closePopup();
  map.fitBounds(world, { padding: [24, 28], animate: false }); fitted = true;
}
function renderList(list) {
  const container = el('mapVisitors'), ids = new Set(list.map(([id]) => id));
  for (const [id, row] of rows) if (!ids.has(id)) { row.remove(); rows.delete(id); }
  const ordered = [...list].sort((a, b) => (b[1].enterTs || 0) - (a[1].enterTs || 0) || a[0].localeCompare(b[0]));
  for (const [id, v] of ordered) {
    let row = rows.get(id);
    if (!row) {
      row = document.createElement('button'); row.type = 'button'; row.className = 'online-visitor'; row.dataset.visitorId = id;
      const face = document.createElement('span'); face.className = 'visitor-face'; face.innerHTML = avatarSVG(id);
      const copy = document.createElement('span'); copy.className = 'online-visitor-copy'; copy.append(text('strong', ''), text('span', ''));
      row.append(face, copy, text('i', '↗', 'visitor-arrow'));
      row.addEventListener('click', () => bridge().selectVisitor?.(id));
      container.append(row); rows.set(id, row);
    }
    row.querySelector('strong').textContent = v.city?.[0] || '未知位置';
    row.querySelector('.online-visitor-copy > span').textContent = currentPage(v);
    row.setAttribute('aria-label', `${locationName(v)}，正在浏览 ${currentPage(v)}，查看访客详情`);
    row.classList.toggle('is-selected', id === selected());
  }
  el('onlineListEmpty').hidden = list.length !== 0;
  el('onlineListCount').textContent = list.length;
}
function sync() {
  if (document.hidden) return;
  const list = activeVisitors(), data = bridge(), demo = data.demo;
  const valid = list.filter(([, v]) => locationOf(v)), ids = new Set(valid.map(([id]) => id));
  const countries = new Set(list.map(([, v]) => v.city?.[1]).filter(c => /^[A-Z]{2}$/.test(c || '')));
  const cities = new Set(list.filter(([, v]) => v.city?.[0] && v.city[0] !== '未知位置').map(([, v]) => JSON.stringify([v.city[0], v.city[1]])));
  const failed = data.status === 'error', unavailable = !demo && (data.status === 'loading' || (failed && !data.updatedAt));
  el('realtimeCount').textContent = unavailable ? '—' : list.length;
  el('countryCount').textContent = unavailable ? '—' : countries.size;
  el('cityCount').textContent = unavailable ? '—' : cities.size;
  el('mapSource').textContent = demo ? '演示数据' : '实时数据';
  el('mapSource').classList.toggle('is-demo', demo);
  el('liveStatus').textContent = demo ? '模拟访客演示，不计入真实统计' : failed ? (data.updatedAt ? '连接中断 · 显示最近一次数据' : '暂时无法读取访客数据') : data.status === 'loading' ? '正在连接访客数据…' : `最近 ${Math.round((data.onlineMs || 90000) / 1000)} 秒内有活动`;
  el('dataRetry').hidden = !failed;
  document.body.classList.toggle('data-stale', failed);
  el('mapEmpty').hidden = list.length > 0 || data.status === 'loading' || failed;
  el('unknownLocations').textContent = list.length - valid.length ? `${list.length - valid.length} 位访客暂未定位` : '';
  renderList(list);
  if (map && active) {
    const removed = [], added = [];
    for (const [id, marker] of markers) if (!ids.has(id)) { removed.push(marker); markers.delete(id); }
    if (removed.length) cluster.removeLayers(removed);
    for (const [id, v] of valid) {
      let marker = markers.get(id);
      const loc = locationOf(v);
      if (!marker) {
        marker = L.marker(loc, { icon: markerIcon(id), title: locationName(v), alt: '匿名访客头像', keyboard: true, riseOnHover: true, visitorId: id, visitorLocation: loc });
        marker.on('click', () => bridge().selectVisitor?.(id));
        markers.set(id, marker); added.push(marker);
      } else if (marker.options.visitorLocation[0] !== loc[0] || marker.options.visitorLocation[1] !== loc[1]) {
        // Spiderfied marker coordinates are display-only. Compare the actual source instead.
        cluster.removeLayer(marker); marker.setLatLng(loc); marker.options.visitorLocation = loc; cluster.addLayer(marker);
      }
      marker.getElement()?.setAttribute('aria-label', `${locationName(v)}，${currentPage(v)}，查看访客详情`);
    }
    if (added.length) cluster.addLayers(added);
    if (selection !== selected()) {
      selection = selected(); applySelection();
      if (selection) focusVisitor(selection); else map.closePopup();
    }
    const chosen = data.visitors?.get(selection);
    if (chosen && selectedPopup && map.hasLayer(selectedPopup)) {
      selectedPopup.getContent().querySelector('.visitor-popup-page b').textContent = currentPage(chosen);
    }
  }
}
function activate(view) {
  active = view === 'map'; root.setAttribute('aria-hidden', String(!active));
  if (!active) { map?.closePopup(); return; }
  requestAnimationFrame(() => {
    map?.invalidateSize({ animate: false, pan: false });
    if (fitted) showWorld();
    sync(); applySelection();
  });
}
try {
  if (!L?.markerClusterGroup) throw new Error('Local map library is unavailable');
  map = L.map(root, { zoomControl: false, attributionControl: true, minZoom: 0, maxZoom: 12, zoomSnap: .25, zoomDelta: 1, worldCopyJump: true, scrollWheelZoom: true, zoomAnimation: !reducedMotion.matches, fadeAnimation: !reducedMotion.matches, markerZoomAnimation: !reducedMotion.matches });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');
  // Visible tiles only; no prefetch, proxy, offline cache or Google key.
  tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, noWrap: true, keepBuffer: 1, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' });
  tiles.on('tileerror', () => { tileFailures++; if (tileFailures >= 2) el('tileNotice').hidden = false; });
  tiles.on('tileload', () => { tileFailures = 0; el('tileNotice').hidden = true; });
  tiles.addTo(map);
  cluster = L.markerClusterGroup({ maxClusterRadius: 46, showCoverageOnHover: false, spiderfyOnMaxZoom: true, zoomToBoundsOnClick: true, animate: !reducedMotion.matches, animateAddingMarkers: false, iconCreateFunction: clusterIcon, spiderfyDistanceMultiplier: 1.7, spiderLegPolylineOptions: { weight: 1, color: '#83958c', opacity: .5 } });
  map.addLayer(cluster);
  cluster.on('animationend spiderfied unspiderfied', applySelection);
  map.on('dragstart zoomstart', () => { fitted = false; });
  showWorld(); fitted = true;
  el('mapZoomIn').addEventListener('click', () => map.zoomIn());
  el('mapZoomOut').addEventListener('click', () => map.zoomOut());
  el('mapReset').addEventListener('click', showWorld);
  el('tileRetry').addEventListener('click', () => { tileFailures = 0; el('tileNotice').hidden = true; tiles.redraw(); });
  const observer = new ResizeObserver(() => { if (!active) return; map.invalidateSize({ animate: false, pan: false }); if (fitted) showWorld(); });
  observer.observe(root);
  window.addEventListener('pagehide', event => { if (!event.persisted) { clearInterval(timer); observer.disconnect(); map.remove(); } });
  root.dataset.ready = 'true';
} catch (error) {
  root.dataset.ready = 'false'; el('tileNotice').hidden = false;
  el('tileNoticeText').textContent = '地图暂不可用，仍可在右侧查看在线访客。';
  el('mapControls').hidden = true; el('tileRetry').hidden = true;
  map?.remove(); map = null;
  console.warn('TideStat: visitor list remains available.', error);
}
el('dataRetry').addEventListener('click', () => bridge().refresh?.());
window.__tideMap = { activate, focusVisitor, ready: () => Boolean(map), showWorld };
sync(); timer = setInterval(sync, 350);
activate(bridge().view || 'map');
