/* Source-message catalogs: application text only, never translate user URLs or identifiers. */
(() => {
  'use strict';
  const EN = {
  "TideStat — 实时访问人数与网站足迹": "TideStat — Live visitors & journeys",
  "实时访问人数": "Live visitors",
  "网站足迹": "Site journeys",
  "视图切换": "Views",
  "语言": "Language",
  "跟随浏览器": "Browser language",
  "实时": "Live",
  "演示": "Demo",
  "位访客在线": "visitors online",
  "位访客正在浏览": "visitors browsing",
  "国家 / 地区": "Countries / regions",
  "城市": "Cities",
  "此刻，世界各地的访客都在这里。": "See who is here, from around the world.",
  "实时数据": "Live data",
  "演示数据": "Demo data",
  "重试": "Retry",
  "实时访客统计": "Live visitor statistics",
  "正在连接访客数据…": "Connecting to live visitors…",
  "正在访问": "Browsing now",
  "新的来访者会显示在这里。": "New visitors will appear here.",
  "目前没有在线访客": "No visitors online right now",
  "有人来访时，头像会自动出现在这里。": "Avatars will appear as visitors arrive.",
  "每个头像，都是一位来访者": "Every face is a visitor",
  "拖拽探索世界 · 点击头像查看访客": "Drag to explore · Select a face to see a visitor",
  "位置为城市级近似 · 头像为匿名生成，不代表本人外貌": "Approximate city location · Generated avatars do not represent real appearances",
  "地图控制": "Map controls",
  "查看全球": "View the world",
  "放大地图": "Zoom in",
  "缩小地图": "Zoom out",
  "展开地图": "Expand map",
  "收起地图": "Collapse map",
  "重新加载地图": "Reload map",
  "底图暂时未能加载，访客人数与列表仍可查看。": "The map could not load. Visitor counts and the list remain available.",
  "实时访客二维备用视图": "Live visitors: 2D fallback",
  "实时访客三维场景，可拖拽旋转和滚轮缩放。详细信息见右侧事件与访客时间线。": "3D visitor scene. Drag to rotate and scroll to zoom. Details are in the event list and timeline.",
  "LIVE · 实时访客 · 点击右侧事件可追踪访客": "LIVE · Select an event to follow a visitor",
  "实时事件 · 时间为本机时区": "Live events · Local time",
  "访客时间线": "Visitor timeline",
  "关闭访客时间线": "Close visitor timeline",
  "匿名访客": "Anonymous visitor",
  "未知位置": "Unknown location",
  "未知": "Unknown location",
  "匿名": "Anonymous",
  "IP 暂不可用": "IP unavailable",
  "模拟 IP": "Simulated IP",
  "脱敏 IP": "Masked IP",
  "浏览中": "Browsing",
  "进入网站": "Arrived",
  "离开（{page}）": "Left ({page})",
  "浏览 {page}": "Viewed {page}",
  "进入于 {time} · 在线 {seconds}s": "Arrived {time} · Online for {seconds}s",
  "进入于 {time} · 已离线": "Arrived {time} · No longer online",
  "尚无已记录路径": "No recorded pages yet",
  "查看访问时间线 →": "View visit timeline →",
  "正在浏览": "Browsing",
  "城市级近似位置 · 头像不代表本人外貌": "Approximate city location · Generated avatar",
  "{location} · {count} 位访客": "{location} · {count} visitors",
  "同一位置": "Same location",
  "选择头像查看正在浏览的页面": "Select a face to see the current page",
  "{location}，正在浏览 {page}，查看访客详情": "{location}, browsing {page}. View visitor details",
  "{location}，{identity}，查看访客详情": "{location}, {identity}. View visitor details",
  "{count} 位访客暂未定位": "{count} visitors without a location",
  "模拟访客演示，不计入真实统计": "Simulated visitors · Not included in real statistics",
  "连接中断 · 显示最近一次数据": "Disconnected · Showing the last update",
  "暂时无法读取访客数据": "Visitor data is currently unavailable",
  "最近 {seconds} 秒内有活动": "Active within the last {seconds} seconds",
  "美洲": "Americas",
  "欧洲 / 非洲": "Europe / Africa",
  "亚太": "Asia Pacific",
  "快速查看地区": "Jump to a region",
  "地图主题": "Map appearance",
  "跟随系统": "System",
  "浅色 · 白天": "Light · Day",
  "深色 · 夜间": "Dark · Night",
  "浅色": "Light",
  "深色": "Dark",
  "地球视图": "Globe view",
  "平面兼容模式": "2D compatibility mode",
  "地图边界暂未载入，访客人数与头像仍可查看。": "Borders could not load. Visitor counts and avatars remain available.",
  "地图暂不可用，请通过右侧列表查看在线访客。": "Map unavailable. Browse visitors in the sidebar.",
  "实时访客地球地图，可拖拽旋转、缩放；所有访客也可在右侧列表访问。": "Live visitor globe. Drag and zoom; all visitors are also accessible in the sidebar.",
  "访客地球地图：拖拽旋转，滚轮缩放，点击圆形头像查看详情": "Visitor globe: drag to rotate, scroll to zoom, select a circular avatar for details",
  "实时访客地图，可拖拽、缩放；所有访客也可在右侧列表访问。": "Live visitor map. Drag and zoom; the sidebar lists every visitor.",
  "入口": "Entrance",
  "首页": "Home",
  "作品馆": "Work",
  "文章林": "Writing",
  "研究实验室": "Research lab",
  "关于屋": "About",
  "订阅角": "Subscribe",
  "未分类页面": "Other pages",
  "把网站变成一个小街区，看看访客正在逛哪里。": "Your website as a small neighborhood. See where visitors go.",
  "网站足迹统计": "Site journey statistics",
  "位访客正在逛": "visitors exploring",
  "活跃分区": "Active areas",
  "正在切换页面": "Navigating",
  "正在读取数据…": "Loading data…",
  "页面是站点，头像是访客。": "Pages are places. Faces are visitors.",
  "足迹外观": "Journey appearance",
  "足迹视图控制": "Journey controls",
  "重置足迹视角": "Reset journey view",
  "切换俯瞰视角": "Toggle overhead view",
  "俯瞰": "Overhead",
  "漫游": "Explore",
  "自动旋转足迹": "Rotate when idle",
  "自转": "Auto",
  "展开足迹": "Expand journeys",
  "展开": "Expand",
  "收起足迹": "Collapse journeys",
  "收起": "Collapse",
  "立体漫游": "3D explore",
  "取消访客追踪": "Stop following visitor",
  "取消追踪": "Stop following",
  "节点为页面分类 · 虚线为站点结构，亮线为选中访客的访问顺序 · 并非鼠标轨迹": "Nodes group pages · Dashed lines show site structure, highlighted lines show the selected journey · Not cursor tracking",
  "正在逛哪里": "Exploring now",
  "显示全部分区": "Show all areas",
  "全部": "All",
  "重新读取访客数据": "Retry visitor data",
  "{location}，{page}，查看访问足迹": "{location}, {page}. View journey",
  "{area} · {count} 人": "{area} · {count} visitors",
  "正在逛哪里 · {count}": "Exploring now · {count}",
  "等待访客数据…": "Waiting for visitor data…",
  "这个分区暂时没有访客。": "No visitors in this area.",
  "有人来访时，头像会出现在这里。": "Faces will appear when visitors arrive.",
  "连接中断 · 暂停活动亮灯": "Disconnected · Activity lights paused",
  "正在读取访客数据…": "Loading visitors…",
  "连接中断，显示最近数据。": "Disconnected. Showing the last update.",
  "暂时无法读取访客数据。": "Visitor data is currently unavailable.",
  "目前没有在线访客，新的足迹会自动出现在这里。": "No visitors online. New journeys will appear automatically.",
  "{area}，{count} 位访客，筛选这个分区": "{area}, {count} visitors. Filter this area",
  "{location}访客的足迹": "Journey from {location}",
  "{location} · {page}": "{location} · {page}",
  "{title}，查看足迹": "{title}. View journey",
  "空闲时自动旋转": "Rotate when idle",
  "空闲旋转已暂停": "Idle rotation paused",
  "空闲旋转已开启": "Idle rotation enabled",
  "自动": "Auto",
  "在线位置柔光": "Live location glow",
  "活动亮灯已暂停": "Activity lights paused",
  "暖光表示在线访客位置": "Warm lights mark online visitors",
  "上海": "Shanghai",
  "北京": "Beijing",
  "深圳": "Shenzhen",
  "杭州": "Hangzhou",
  "成都": "Chengdu",
  "广州": "Guangzhou",
  "香港": "Hong Kong",
  "台北": "Taipei",
  "新加坡": "Singapore",
  "东京": "Tokyo",
  "大阪": "Osaka",
  "首尔": "Seoul",
  "孟买": "Mumbai",
  "班加罗尔": "Bengaluru",
  "悉尼": "Sydney",
  "墨尔本": "Melbourne",
  "伦敦": "London",
  "巴黎": "Paris",
  "柏林": "Berlin",
  "阿姆斯特丹": "Amsterdam",
  "苏黎世": "Zurich",
  "斯德哥尔摩": "Stockholm",
  "华沙": "Warsaw",
  "里斯本": "Lisbon",
  "马德里": "Madrid",
  "米兰": "Milan",
  "伊斯坦布尔": "Istanbul",
  "迪拜": "Dubai",
  "特拉维夫": "Tel Aviv",
  "纽约": "New York",
  "旧金山": "San Francisco",
  "洛杉矶": "Los Angeles",
  "西雅图": "Seattle",
  "芝加哥": "Chicago",
  "奥斯汀": "Austin",
  "丹佛": "Denver",
  "多伦多": "Toronto",
  "温哥华": "Vancouver",
  "墨西哥城": "Mexico City",
  "圣保罗": "São Paulo",
  "布宜诺斯艾利斯": "Buenos Aires",
  "波哥大": "Bogotá",
  "开普敦": "Cape Town",
  "拉各斯": "Lagos",
  "内罗毕": "Nairobi",
  "开罗": "Cairo",
  "利雅得": "Riyadh"
};
  Object.assign(EN, {"研究室":"Research lab","关于 / 其他":"About / Other","未分类":"Other","等候访客数据 · 暂停点灯":"Waiting for data · Lights paused","柔光 = 此处有在线访客":"Glow = Visitors online here","圆形头像 = 在线访客":"Circular faces = Online visitors"});
  EN['{count} 位访客，查看详情']='{count} visitors. View details';
  const REVERSE=Object.fromEntries(Object.entries(EN).map(([key,value])=>[value,key]));
  const KEY = 'tidestat:language';
  const valid = new Set(['system', 'zh', 'en']);
  const read = () => { try { const value = localStorage.getItem(KEY); return valid.has(value) ? value : 'system'; } catch { return 'system'; } };
  let preference = read(), language = 'zh';
  const normalize = value => /^zh(?:-|$)/i.test(value) ? 'zh' : /^en(?:-|$)/i.test(value) ? 'en' : null;
  const query = normalize(new URLSearchParams(location.search).get('lang') || '');
  if (query) preference = query;
  function resolve() { return preference === 'system' ? (navigator.languages || [navigator.language]).map(normalize).find(Boolean) || 'en' : preference; }
  function t(message, values = {}) {
    const template = language === 'en' ? EN[message] ?? message : message;
    return String(template ?? '').replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? `{${name}}`));
  }
  function time(epoch) { return Number.isFinite(epoch) ? new Date(epoch).toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {hour12:false}) : '—'; }
  function nodeLabel(id) { return t(window.__tideSite?.nodes.find(n => n.id === id)?.label || '未分类页面'); }
  function cityName(value) { return t(value || '未知位置'); }
  function identity(visitor) {
    const value = visitor?.maskedIp;
    // Rendering accepts only a masked shape. Never accidentally expose an upstream full address.
    const ok = typeof value === 'string' && (/^(?:25[0-5]|2[0-4]\d|1?\d?\d)\.\*\.\*\.(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(value) || /^[a-f0-9]{1,4}:\*:\*:[a-f0-9]{1,4}$/i.test(value));
    return ok ? value : t('IP 暂不可用');
  }
  function applyDOM(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(e => e.textContent = t(e.dataset.i18n));
    for (const attr of ['aria-label', 'title']) {
      root.querySelectorAll(`[${attr}]`).forEach(e=>{
        const raw=e.getAttribute(attr), key=e.getAttribute(`data-i18n-${attr}`) || (EN[raw] ? raw : REVERSE[raw]);
        if(key){e.setAttribute(`data-i18n-${attr}`,key);e.setAttribute(attr,t(key));}
      });
    }
    const select = document.getElementById('languageSelect'); if (select) select.value = preference;
  }
  function apply() {
    language = resolve(); document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.language = language;
    document.title = t('TideStat — 实时访问人数与网站足迹');
    applyDOM(); window.dispatchEvent(new CustomEvent('tide:languagechange', {detail:{language,preference}}));
  }
  function setLanguage(value) {
    if (!valid.has(value)) return; preference = value;
    // A one-shot ?lang= must not override an explicit choice after reload.
    try { const u = new URL(location.href); u.searchParams.delete('lang'); history.replaceState(history.state, '', u); } catch {}
    try { localStorage.setItem(KEY, value); } catch {}
    apply();
  }
  window.__tideI18n = Object.freeze({t, time, nodeLabel, cityName, identity, applyDOM, setLanguage,
    get language(){return language;}, get preference(){return preference;}, get locale(){return language === 'zh' ? 'zh-CN' : 'en-US';}});
  window.addEventListener('languagechange', () => {if(preference === 'system') apply();});
  window.addEventListener('storage', e => {if(e.key === KEY || e.key === null){preference=read();apply();}});
  document.addEventListener('DOMContentLoaded', () => {apply(); document.getElementById('languageSelect')?.addEventListener('change',e=>setLanguage(e.target.value));});
  apply();
})();
