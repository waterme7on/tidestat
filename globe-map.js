/* Native MapLibre globe + local Natural Earth geography. No custom sphere or remote tiles. */
import { avatarSVG } from './visitor-avatar.js';
import { idleMotion } from './idle-motion.js';
const {t,cityName,identity}=window.__tideI18n;

const root = document.getElementById('liveMap');
const stage = root.parentElement;
const el = id => document.getElementById(id);
const bridge = () => window.__tide || {};
const liveVisitors = () => [...(bridge().visitors || new Map())].filter(([, v]) => v.state !== 'leaving');
const selected = () => bridge().selectedId || null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const EMPTY = { type: 'FeatureCollection', features: [] };
const HOME = [-87.23708467228778, 8.74123124869058];
const regions = [['美洲', HOME], ['欧洲 / 非洲', [15, 25]], ['亚太', [115, 22]]];
const rows = new Map(), images = new Map(), flatMarkers = new Map();
let map, flat, flatLand, popup, groups = new Map(), engine = 'loading';
let active = true, ready = false, disposed = false, fitted = true, selection = null;
let timer, observer, geography, geoLoading = false, imageSerial = 0, rendering = false;
let lightStatus = '';
let applied = '', currentImages = new Set(), requestedCenter = HOME, popupState = null;

// Update paint only: never setStyle, rebuild the map, change the camera or regenerate B faces.
const THEMES = {
  dark: { ocean: '#1e1f20', land: '#0c0d0e', border: '#303134', ring: '#c2d5c2', stroke: '#d3e1d2' },
  light: { ocean: '#e3eced', land: '#fafbf7', border: '#c6d2c0', ring: '#819d68', stroke: '#5f7b4d' },
};
const scheme = () => window.__tideTheme?.resolved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const palette = () => THEMES[scheme()];
const flatStyle = () => ({ fillColor: palette().land, fillOpacity: 1, color: palette().border, weight: .55 });
function applyMapTheme() {
  const colors = palette(), dark = scheme() === 'dark';
  const signal = Boolean(bridge().demo || bridge().status === 'ready');
  if (disposed) return;
  root.dataset.theme = scheme();
  if (map && ready && engine === 'globe') {
    for (const [id, prop, value] of [
      ['ocean', 'background-color', colors.ocean], ['land', 'fill-color', colors.land],
      ['borders', 'line-color', colors.border], ['selected-person', 'circle-color', colors.ring],
      ['selected-person', 'circle-stroke-color', colors.stroke],
      ['visitor-light-haze', 'circle-opacity', dark && signal ? .34 : 0],
      ['visitor-light-warmth', 'circle-opacity', dark && signal ? .22 : 0],
    ]) {
      if (!map.getLayer(id)) continue;
      map.setPaintProperty(id, `${prop}-transition`, { duration: reduced.matches ? 0 : 220, delay: 0 });
      map.setPaintProperty(id, prop, value);
    }
  }
  flatLand?.setStyle(flatStyle());
  const key = el('activityKey');
  if (key) key.textContent = !signal ? t('等候访客数据 · 暂停点灯') : dark ? t('柔光 = 此处有在线访客') : t('圆形头像 = 在线访客');
  const select = el('mapTheme'); if (select) select.value = window.__tideTheme?.preference || 'system';
}
window.addEventListener('tide:themechange', applyMapTheme);
reduced.addEventListener('change', applyMapTheme);

function asset(path) { return new URL(path, import.meta.url).href; }
function css(path) {
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = asset(path); document.head.append(link);
}
function script(path, name) {
  if (window[name]) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const tag = document.createElement('script'); tag.src = asset(path);
    tag.onload = resolve; tag.onerror = () => reject(new Error(`Unable to load ${name}`)); document.head.append(tag);
  });
}
function txt(tag, value, className) {
  const node = document.createElement(tag); node.textContent = t(String(value ?? '')); if(value)node.dataset.i18n=String(value);
  if (className) node.className = className; return node;
}
function face(id) {
  const node = document.createElement('span'); node.className = 'visitor-face'; node.innerHTML = avatarSVG(id); return node;
}
export function locationOf(v) {
  const lat = v.city?.[2], lng = v.city?.[3];
  if (lat == null || lng == null || lat === '' || lng === '') return null;
  const a = Number(lat), b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 85.051129 && Math.abs(b) <= 180 ? [b, a] : null;
}
function pageOf(v) {
  return v.currentPath || t(window.__tideSite?.nodes.find(n => n.id === (v.state === 'walking' ? v.target : v.node))?.label || '浏览中');
}
function locationName(v) {
  let country = v.city?.[1] || '';
  if (/^[A-Z]{2}$/.test(country)) {
    try { country = new Intl.DisplayNames([window.__tideI18n.locale], { type: 'region' }).of(country); } catch { /* use code */ }
  }
  return [cityName(v.city?.[0]), country].filter(Boolean).join(' · ');
}
// Only co-located people share a marker; distinct cities remain individual faces, not a heatmap.
export function groupVisitors(list) {
  const result = new Map();
  for (const [id, v] of list) {
    const loc = locationOf(v); if (!loc) continue;
    const key = JSON.stringify(loc.map(n => Math.round(n * 10000) / 10000));
    if (!result.has(key)) result.set(key, { key, loc, ids: [] });
    result.get(key).ids.push(id);
  }
  for (const group of result.values()) group.ids.sort();
  return result;
}
function clearPopup() { popup?.remove(); popup = null; popupState = null; }
function visitorCard(v, id) {
  const card = txt('div', '', 'visitor-popup');
  const head = txt('div', '', 'visitor-popup-head');
  const copy = txt('div', ''); copy.append(txt('strong', locationName(v)), txt('span', `${t('匿名访客')} · ${identity(v)}${bridge().demo ? ' · '+t('模拟 IP') : ''}`));
  head.append(face(id), copy); card.append(head);
  const details = txt('div', '', 'visitor-popup-page'); details.append(txt('span', '正在浏览'), txt('b', pageOf(v))); card.append(details);
  card.append(txt('p', '城市级近似位置 · 头像不代表本人外貌', 'visitor-privacy'));
  const button = txt('button', '查看访问时间线 →'); button.type = 'button';
  button.onclick = () => bridge().openTimeline?.(id);
  card.append(button); return card;
}
function showPopup(loc, content) {
  clearPopup();
  if (engine === 'globe') popup = new maplibregl.Popup({ offset: 30, maxWidth: '300px', className: 'live-visitor-popup', closeOnClick: false }).setLngLat(loc).setDOMContent(content).addTo(map);
  else if (flat) popup = L.popup({ className: 'live-visitor-popup', maxWidth: 280, minWidth: 230, offset: [0, -25] }).setLatLng([loc[1], loc[0]]).setContent(content).openOn(flat);
  // Native close controls must release our pause state, not just remove the map's DOM.
  const opened = popup;
  opened?.once(engine === 'globe' ? 'close' : 'remove', () => {
    if (popup !== opened) return; // An old popup must not clear a newer selection.
    popup = null; popupState = null; idleMotion.reset();
  });
}
function groupCard(group) {
  const v = bridge().visitors?.get(group.ids[0]);
  const card = txt('div', '', 'group-popup');
  card.append(txt('strong', t('{location} · {count} 位访客',{location:cityName(v?.city?.[0] || '同一位置'),count:group.ids.length})), txt('p', '选择头像查看正在浏览的页面'));
  const list = txt('div', '', 'group-people');
  for (const id of group.ids) {
    const visitor = bridge().visitors?.get(id); if (!visitor) continue;
    const button = txt('button', ''); button.type = 'button'; button.append(face(id), txt('span', pageOf(visitor)));
    button.setAttribute('aria-label', t('{location}，{identity}，查看访客详情',{location:locationName(visitor),identity:identity(visitor)}));
    button.onclick = () => bridge().selectVisitor?.(id); list.append(button);
  }
  card.append(list); return card;
}
function clickGroup(key) {
  const group = groups.get(key); if (!group) return;
  if (group.ids.length === 1) { bridge().selectVisitor?.(group.ids[0]); return; }
  showPopup(group.loc, groupCard(group)); popupState = { type: 'group', key, signature: group.ids.join('|') };
}
function applySelection() {
  for (const [id, row] of rows) { row.classList.toggle('is-selected', id === selected()); row.setAttribute('aria-pressed', String(id === selected())); }
}
function focusVisitor(id) {
  selection = id; applySelection();
  const v = bridge().visitors?.get(id), loc = v && locationOf(v);
  if (!ready || !active || !loc) { clearPopup(); return; }
  fitted = false;
  if (engine === 'globe') {
    // Rotate to the real location, including people on the far side. Do not orbit by itself.
    map.jumpTo({ center: loc, zoom: Math.max(map.getZoom(), homeZoom()), bearing: 0, pitch: 0 });
  } else flat.setView([loc[1], loc[0]], Math.max(flat.getZoom(), 3), { animate: false });
  showPopup(loc, visitorCard(v, id)); popupState = { type: 'visitor', id }; applied = '';
}
function renderList(list) {
  const container = el('mapVisitors'), ids = new Set(list.map(([id]) => id));
  for (const [id, row] of rows) if (!ids.has(id)) { row.remove(); rows.delete(id); }
  const ordered = [...list].sort((a, b) => (b[1].enterTs || 0) - (a[1].enterTs || 0) || a[0].localeCompare(b[0]));
  ordered.forEach(([id, v], i) => {
    let row = rows.get(id);
    if (!row) {
      row = txt('button', '', 'online-visitor'); row.type = 'button'; row.dataset.visitorId = id;
      const copy = txt('span', '', 'online-visitor-copy'); copy.append(txt('strong', ''), txt('span', ''));
      row.append(face(id), copy, txt('i', '↗', 'visitor-arrow')); row.onclick = () => bridge().selectVisitor?.(id); rows.set(id, row);
    }
    row.querySelector('strong').textContent = cityName(v.city?.[0]);
    row.querySelector('.online-visitor-copy > span').textContent = pageOf(v);
    row.setAttribute('aria-label', t('{location}，正在浏览 {page}，查看访客详情',{location:locationName(v),page:pageOf(v)}));
    // Preserve focus and DOM identity; reorder only when the actual arrival order changes.
    if (container.children[i] !== row) container.insertBefore(row, container.children[i] || null);
  });
  el('onlineListEmpty').hidden = list.length > 0; el('onlineListCount').textContent = list.length; applySelection();
}
function sync() {
  if (disposed || document.hidden) return;
  const list = liveVisitors(), data = bridge(), failed = data.status === 'error';
  const statusKey = `${data.demo}:${data.status}`;
  if (lightStatus !== statusKey) { lightStatus = statusKey; applyMapTheme(); }
  const unavailable = !data.demo && (data.status === 'loading' || (failed && !data.updatedAt));
  const countries = new Set(list.map(([, v]) => v.city?.[1]).filter(c => /^[A-Z]{2}$/.test(c || '')));
  const cities = new Set(list.filter(([, v]) => v.city?.[0] && v.city[0] !== '未知位置').map(([, v]) => JSON.stringify([v.city[0], v.city[1]])));
  el('realtimeCount').textContent = unavailable ? '—' : list.length;
  el('countryCount').textContent = unavailable ? '—' : countries.size; el('cityCount').textContent = unavailable ? '—' : cities.size;
  el('mapSource').textContent = data.demo ? t('演示数据') : t('实时数据'); el('mapSource').classList.toggle('is-demo', Boolean(data.demo));
  el('liveStatus').textContent = data.demo ? t('模拟访客演示，不计入真实统计') : failed ? (data.updatedAt ? t('连接中断 · 显示最近一次数据') : t('暂时无法读取访客数据')) : unavailable ? t('正在连接访客数据…') : t('最近 {seconds} 秒内有活动',{seconds:Math.round((data.onlineMs||90000)/1000)});
  if (!data.demo && !failed && !unavailable && data.truncated) el('liveStatus').textContent += ' · ' + t('仅展示最近 2,000 条事件 · 人数与足迹可能不完整');
  el('dataRetry').hidden = !failed; document.body.classList.toggle('data-stale', failed);
  el('mapEmpty').hidden = list.length > 0 || unavailable || failed;
  const missing = list.filter(([, v]) => !locationOf(v)).length;
  el('unknownLocations').textContent = missing ? t('{count} 位访客暂未定位',{count:missing}) : '';
  renderList(list); groups = groupVisitors(list);
  if (active && ready) {
    if (selection !== selected()) { selection = selected(); if (selection) focusVisitor(selection); else clearPopup(); }
    const signature = JSON.stringify([[...groups].map(([k, g]) => [k, g.ids]), selected()]);
    if (signature !== applied && !rendering) {
      if (engine === 'globe') renderGlobe(signature); else { renderFlat(); applied = signature; }
    }
    if (popupState?.type === 'visitor') {
      const v = data.visitors?.get(popupState.id);
      if (!v || v.state === 'leaving') clearPopup();
      else {
        const content = engine === 'globe' ? popup?.getElement() : popup?.getElement();
        const page = content?.querySelector('.visitor-popup-page b'); if (page) page.textContent = pageOf(v);
      }
    } else if (popupState?.type === 'group') {
      const g = groups.get(popupState.key);
      if (!g) clearPopup();
      else if (g.ids.join('|') !== popupState.signature) clickGroup(g.key);
    }
  }
}
function imageFromSVG(svg) {
  return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
}
async function groupImage(group) {
  const ids = group.ids.slice(0, 3), signature = JSON.stringify([ids, group.ids.length]);
  const existing = images.get(signature); if (existing) return existing.name;
  const faces = await Promise.all(ids.map(id => imageFromSVG(avatarSVG(id))));
  const canvas = document.createElement('canvas'), multi = group.ids.length > 1;
  canvas.width = multi ? 188 : 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  faces.forEach((img, i) => {
    const x = multi ? 48 + i * 35 : 64, r = multi ? 45 : 53;
    ctx.save(); ctx.shadowColor = '#0009'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 3;
    ctx.beginPath(); ctx.arc(x, 62, r + 3, 0, Math.PI * 2); ctx.fillStyle = '#101113'; ctx.fill(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(x, 62, r, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(img, x - r, 62 - r, r * 2, r * 2); ctx.restore();
    ctx.beginPath(); ctx.arc(x, 62, r, 0, Math.PI * 2); ctx.strokeStyle = '#ffffff50'; ctx.lineWidth = 2; ctx.stroke();
  });
  if (multi) {
    const label = group.ids.length > 99 ? '99+' : String(group.ids.length), w = label.length * 14 + 14;
    ctx.fillStyle = '#e7e9e8'; ctx.beginPath(); ctx.roundRect(canvas.width - w - 3, 86, w, 30, 15); ctx.fill();
    ctx.fillStyle = '#202523'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, canvas.width - w / 2 - 3, 102);
  }
  if (disposed || engine !== 'globe') return null;
  const name = `people-${imageSerial++}`;
  map.addImage(name, ctx.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: 2 });
  images.set(signature, { name }); return name;
}
async function renderGlobe(signature) {
  rendering = true;
  try {
    const snapshot = [...groups.values()], focus = selected();
    const features = await Promise.all(snapshot.map(async group => ({ type: 'Feature', geometry: { type: 'Point', coordinates: group.loc }, properties: { key: group.key, count: group.ids.length, image: await groupImage(group), selected: group.ids.includes(focus) ? 1 : 0 } })));
    if (disposed || engine !== 'globe') return;
    currentImages = new Set(features.map(f => f.properties.image));
    map.getSource('people').setData({ type: 'FeatureCollection', features: features.filter(f => f.properties.image) });
    applied = signature;
    map.once('idle', () => {
      // Removed visitors must not grow the texture atlas forever. Wait for the source update to render.
      if (disposed || engine !== 'globe' || rendering) return;
      for (const [key, entry] of images) if (!currentImages.has(entry.name)) { if (map.hasImage(entry.name)) map.removeImage(entry.name); images.delete(key); }
    });
  } catch (error) { console.warn('TideStat: unable to update globe avatars.', error); }
  finally { rendering = false; }
}
function homeZoom() {
  const size = Math.max(250, Math.min(root.clientWidth - 56, root.clientHeight - 64));
  return Math.log2(size / 130);
}
function showWorld(center = requestedCenter) {
  requestedCenter = center; clearPopup();
  if (engine === 'globe') map.jumpTo({ center, zoom: homeZoom(), bearing: 0, pitch: 0 });
  else if (flat) flat.fitBounds([[-55, -172], [78, 180]], { padding: [28, 28], animate: false });
  fitted = true;
}
function setNotice(message, retry = true) { el('tileNotice').hidden = !message; el('tileNoticeText').dataset.i18n=message; el('tileNoticeText').textContent=t(message); el('tileRetry').hidden = !retry; }
async function loadGeography() {
  if (geoLoading || disposed) return;
  geoLoading = true; const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
  root.dataset.geography = 'loading';
  try {
    const response = await fetch(asset('./assets/countries-50m.geojson'), { signal: controller.signal });
    if (!response.ok) throw new Error(`Geography ${response.status}`);
    const data = await response.json();
    if (data.type !== 'FeatureCollection' || !data.features?.length) throw new Error('Invalid geography');
    if (disposed) return; geography = data;
    if (engine === 'globe') map.getSource('countries').setData(data);
    else if (flat) { if (flatLand) flat.removeLayer(flatLand); flatLand = L.geoJSON(data, { interactive: false, style: flatStyle() }).addTo(flat); }
    root.dataset.geography = 'ready'; setNotice('');
  } catch {
    root.dataset.geography = 'error'; setNotice('地图边界暂未载入，访客人数与头像仍可查看。');
  } finally { clearTimeout(timeout); geoLoading = false; }
}
function renderFlat() {
  for (const m of flatMarkers.values()) m.remove(); flatMarkers.clear();
  for (const group of groups.values()) {
    const node = txt('button', '', 'flat-avatar'); node.type = 'button';
    group.ids.slice(0, 3).forEach(id => node.append(face(id)));
    if (group.ids.length > 1) node.append(txt('b', group.ids.length));
    node.setAttribute('aria-label', t('{count} 位访客，查看详情',{count:group.ids.length}));
    node.onclick = () => clickGroup(group.key);
    const marker = L.marker([group.loc[1], group.loc[0]], { icon: L.divIcon({ html: node, className: 'flat-avatar-marker', iconSize: [48, 48], iconAnchor: [24, 24] }) }).addTo(flat);
    flatMarkers.set(group.key, marker);
  }
}
async function fallback() {
  if (engine === 'flat' || disposed) return;
  ready = false; clearPopup(); map?.remove(); map = null; root.replaceChildren();
  engine = 'flat'; rotationButton.disabled=true; images.clear(); currentImages.clear(); applied = '';
  try {
    css('./vendor/leaflet/leaflet.css'); await script('./vendor/leaflet/leaflet.js', 'L');
    flat = L.map(root, { zoomControl: false, maxZoom: 6, minZoom: 0, zoomAnimation: !reduced.matches });
    flat.attributionControl.setPrefix('Leaflet'); flat.attributionControl.addAttribution('Natural Earth');
    root.dataset.engine = 'flat'; root.dataset.ready = 'true'; ready = true;
    el('globeMode').dataset.i18n='平面兼容模式'; el('globeMode').textContent=t('平面兼容模式'); showWorld(); applyMapTheme();
    if (geography) flatLand = L.geoJSON(geography, { interactive: false, style: flatStyle() }).addTo(flat);
    else loadGeography();
    sync();
  } catch { root.dataset.ready = 'false'; setNotice('地图暂不可用，请通过右侧列表查看在线访客。', false); }
}
function collapse() {
  if (!stage.classList.contains('map-expanded')) return;
  stage.classList.remove('map-expanded'); document.body.classList.remove('map-is-expanded');
  el('mapExpand').setAttribute('aria-pressed', 'false'); el('mapExpand').dataset.i18nAriaLabel='展开地图';el('mapExpand').setAttribute('aria-label', t('展开地图')); resize();
}
function resize() {
  if (!ready || !active) return;
  if (map) map.resize(); if (flat) flat.invalidateSize({ animate: false, pan: false });
  if (fitted) showWorld();
}
function activate(view) {
  active = view === 'map'; root.setAttribute('aria-hidden', String(!active));
  if (!active) { collapse(); clearPopup(); return; }
  requestAnimationFrame(() => { resize(); sync(); });
}
function controls() {
  el('mapZoomIn').onclick = () => { fitted = false; if (map) map.zoomIn({ duration: reduced.matches ? 0 : 240 }); else flat?.zoomIn(); };
  el('mapZoomOut').onclick = () => { fitted = false; if (map) map.zoomOut({ duration: reduced.matches ? 0 : 240 }); else flat?.zoomOut(); };
  el('mapReset').onclick = () => showWorld();
  el('tileRetry').onclick = loadGeography; el('dataRetry').onclick = () => bridge().refresh?.();
  const expand = txt('button', '⛶'); expand.id = 'mapExpand'; expand.type = 'button'; expand.setAttribute('aria-label', t('展开地图')); expand.setAttribute('aria-pressed', 'false');
  expand.onclick = () => {
    if (stage.classList.contains('map-expanded')) { collapse(); return; }
    stage.classList.add('map-expanded'); document.body.classList.add('map-is-expanded'); expand.setAttribute('aria-pressed', 'true'); expand.dataset.i18nAriaLabel='收起地图';expand.setAttribute('aria-label', t('收起地图')); resize();
  };
  el('mapControls').prepend(expand);
  const presets = txt('div', '', 'globe-regions map-only'); presets.setAttribute('role', 'group'); presets.setAttribute('aria-label', t('快速查看地区'));
  for (const [label, center] of regions) { const b = txt('button', label); b.type = 'button'; b.onclick = () => showWorld(center); presets.append(b); }
  stage.append(presets);
  const picker = txt('label', '', 'theme-picker map-only');
  const icon = txt('span', '◐'); icon.setAttribute('aria-hidden', 'true');
  const select = document.createElement('select'); select.id = 'mapTheme'; select.setAttribute('aria-label', t('地图主题'));
  for (const [value, label] of [['system','跟随系统'], ['light','浅色 · 白天'], ['dark','深色 · 夜间']]) {
    const option = txt('option', label); option.value = value; select.append(option);
  }
  select.value = window.__tideTheme?.preference || 'system';
  select.onchange = () => window.__tideTheme?.setPreference(select.value);
  picker.append(icon, select); stage.append(picker);
  const key = txt('span', '', 'activity-key map-only'); key.id = 'activityKey'; stage.append(key);
  applyMapTheme();
  const mode = txt('span', '地球视图', 'globe-mode map-only'); mode.id = 'globeMode'; stage.append(mode);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && active && !bridge().timelineOpen) { collapse(); clearPopup(); bridge().deselect?.(); } });
}
let rotationFrame=0,rotationTime=0,inViewport=true;
const viewportObserver=new IntersectionObserver(entries=>{inViewport=entries[0].isIntersecting;if(!inViewport)idleMotion.reset();});viewportObserver.observe(root);
function rotateIdle(now){
  rotationFrame=requestAnimationFrame(rotateIdle);
  const dt=Math.min((now-rotationTime)/1000 || 0,.05);rotationTime=now;
  const moving=inViewport&&active&&ready&&engine==='globe'&&idleMotion.canRotate()&&!popupState&&!map.isMoving()&&map.getZoom()<=homeZoom()+1;
  root.dataset.rotating=String(Boolean(moving));
  if(moving){fitted=false;const center=map.getCenter();map.jumpTo({center:[center.lng-dt*.45,center.lat]});}
}
const rotationButton=txt('button','↻','idle-rotation');rotationButton.id='mapRotate';rotationButton.type='button';
rotationButton.dataset.i18nAriaLabel='空闲时自动旋转';rotationButton.setAttribute('aria-label',t('空闲时自动旋转'));
rotationButton.onclick=()=>idleMotion.toggle();el('mapControls').append(rotationButton);
const unsubscribeMotion=idleMotion.subscribe(()=>{rotationButton.disabled=idleMotion.reduced||engine==='flat';rotationButton.setAttribute('aria-pressed',String(idleMotion.enabled&&!idleMotion.reduced));});
window.addEventListener('tide:languagechange',()=>{
  window.__tideI18n.applyDOM(stage);applyMapTheme();sync();
  if(popupState?.type==='visitor'){
    const v=bridge().visitors?.get(popupState.id);
    if(v){if(engine==='globe')popup?.setDOMContent(visitorCard(v,popupState.id));else popup?.setContent(visitorCard(v,popupState.id));}
  }else if(popupState?.type==='group'){
    const g=groups.get(popupState.key);if(g){if(engine==='globe')popup?.setDOMContent(groupCard(g));else popup?.setContent(groupCard(g));}
  }
});
async function init() {
  css('./vendor/maplibre/maplibre-gl.css'); controls();
  stage.querySelector('.map-caption').dataset.i18n='拖拽探索世界 · 点击头像查看访客';stage.querySelector('.map-caption').textContent=t('拖拽探索世界 · 点击头像查看访客');
  el('liveMap').setAttribute('aria-label', t('实时访客地球地图，可拖拽旋转、缩放；所有访客也可在右侧列表访问。'));
  stage.dataset.renderer = 'maplibre';
  const params = new URLSearchParams(location.search);
  if (params.has('longitude') && params.has('latitude')) {
    const lng = Number(params.get('longitude')), lat = Number(params.get('latitude'));
    if (Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 85) requestedCenter = [lng, lat];
  }
  try {
    await script('./vendor/maplibre/maplibre-gl.js', 'maplibregl');
    maplibregl.setWorkerCount(2);
    map = new maplibregl.Map({
      container: root, center: requestedCenter, zoom: homeZoom(), minZoom: -.7, maxZoom: 5.5,
      pitchWithRotate: false, dragRotate: false, renderWorldCopies: false,
      canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true },
      style: { version: 8, projection: { type: 'globe' }, sources: { countries: { type: 'geojson', data: EMPTY, tolerance: .45, maxzoom: 7, attribution: '<a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener">Natural Earth</a>' }, people: { type: 'geojson', data: EMPTY } }, layers: [
        { id: 'ocean', type: 'background', paint: { 'background-color': palette().ocean } },
        { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': palette().land } },
        { id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': palette().border, 'line-width': .5, 'line-opacity': .65 } },
        // Gentle light under actual online locations. No fabricated cities or always-on animation.
        { id: 'visitor-light-haze', type: 'circle', source: 'people', paint: {
          'circle-radius': ['interpolate', ['linear'], ['min', ['get', 'count'], 8], 1, 37, 8, 53],
          'circle-color': '#e6a75d', 'circle-blur': .9, 'circle-opacity': scheme() === 'dark' ? .34 : 0,
          'circle-pitch-alignment': 'map', 'circle-pitch-scale': 'viewport'
        } },
        { id: 'visitor-light-warmth', type: 'circle', source: 'people', paint: {
          'circle-radius': 27, 'circle-color': '#f4cb85', 'circle-blur': .75,
          'circle-opacity': scheme() === 'dark' ? .22 : 0, 'circle-pitch-alignment': 'map', 'circle-pitch-scale': 'viewport'
        } },
        { id: 'selected-person', type: 'circle', source: 'people', filter: ['==', ['get', 'selected'], 1], paint: { 'circle-radius': 25, 'circle-color': palette().ring, 'circle-opacity': .4, 'circle-stroke-width': 1.5, 'circle-stroke-color': palette().stroke } },
        { id: 'avatars', type: 'symbol', source: 'people', layout: { 'icon-image': ['get', 'image'], 'icon-size': .82, 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport', 'symbol-sort-key': ['get', 'selected'] } }
      ] }
    });
    engine = 'globe'; root.dataset.engine = 'globe';
    map.touchZoomRotate.disableRotation();
    map.on('dragstart', () => { fitted = false; clearPopup(); });
    map.on('zoomstart', event => { if (event.originalEvent) fitted = false; });
    map.on('mouseenter', 'avatars', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'avatars', () => { map.getCanvas().style.cursor = ''; });
    map.on('click', 'avatars', event => {
      // Query order is not a reliable proxy for which overlapping circular face was clicked.
      const hits = [...(event.features || [])];
      const distance = f => {
        const group = groups.get(f.properties?.key); if (!group) return Infinity;
        const point = map.project(group.loc); return Math.hypot(point.x - event.point.x, point.y - event.point.y);
      };
      hits.sort((a, b) => distance(a) - distance(b));
      const key = hits[0]?.properties?.key; if (key) clickGroup(key);
    });
    map.on('load', () => {
      ready = true; root.dataset.ready = 'true'; applyMapTheme();
      map.getCanvas().setAttribute('aria-label', t('访客地球地图：拖拽旋转，滚轮缩放，点击圆形头像查看详情'));
      loadGeography(); sync();
    });
    map.on('webglcontextlost', () => { fallback(); });
    map.on('error', event => { console.warn('TideStat map:', event.error?.message || event.error); });
  } catch { await fallback(); }
  observer = new ResizeObserver(resize); observer.observe(root);
}
window.__tideMap = { collapse, activate, focusVisitor, showWorld, ready: () => ready,
  // Public coordinates are also used by accessible navigation and regression tests.
  appearance: () => ({ scheme: scheme(), locations: groups.size,
    lightOpacity: map && ready ? map.getPaintProperty('visitor-light-haze', 'circle-opacity') : null,
    land: map && ready ? map.getPaintProperty('land', 'fill-color') : flatLand?.options.style?.fillColor }),
  camera: () => map ? { center: map.getCenter().toArray(), zoom: map.getZoom(), projection: map.getProjection().type } : { projection: 'mercator' },
  projectVisitor: id => { const v = bridge().visitors?.get(id), loc = v && locationOf(v); if (!loc || !map) return null; const p = map.project(loc); return { x: p.x, y: p.y }; }
};
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  disposed = true; cancelAnimationFrame(rotationFrame);viewportObserver.disconnect();unsubscribeMotion(); window.removeEventListener('tide:themechange', applyMapTheme); reduced.removeEventListener('change', applyMapTheme); clearInterval(timer); observer?.disconnect(); clearPopup(); map?.remove(); flat?.remove();
});
init(); sync(); timer = setInterval(sync, 350);rotationFrame=requestAnimationFrame(rotateIdle);
