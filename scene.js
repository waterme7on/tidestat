import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { avatarSVG } from './visitor-avatar.js';
import { snapshot, journey, steps, currentNode, edgeKey, pageName } from './footprint-model.js';

// Website footprints only. The native globe, avatar identities and data bridge are unchanged.
const sheet = document.createElement('link'); sheet.rel = 'stylesheet'; sheet.href = new URL('./footprints.css', import.meta.url).href; document.head.append(sheet);
const el = id => document.getElementById(id), canvas = el('stage3d'), stage = canvas.parentElement;
const bridge = () => window.__tide || {}, site = window.__tideSite;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const palettes = {
  dark: { bg: '#101112', base: '#242927', rim: '#414a43', wall: '#aaa99f', roof: '#454e47', pane: '#242d29', line: '#556253', lit: '#f4ca87' },
  light: { bg: '#f6f8f3', base: '#e5eadd', rim: '#c2cdb8', wall: '#f4f0e5', roof: '#8c9c85', pane: '#b9c9bf', line: '#bac8af', lit: '#678357' },
};
const LABELS = { gate: '入口', home: '首页', work: '作品馆', writing: '文章林', dyor: '研究室', about: '关于 / 其他', subscribe: '订阅角' };
const label = id => LABELS[id] || site.nodes.find(n => n.id === id)?.label || id;
const objects = new Set(), nodeViews = new Map(), avatars = new Map(), listRows = new Map(), routes = new Map();
const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-15, 15, 12, -12, .1, 200);
const target = new THREE.Vector3(0, .5, 0), home = new THREE.Vector3(4, 27, 29);
let renderer, controls, ready = false, disposed = false, active = true, flat = false, overview = false;
let autoRotate = false, frame = 0, last = 0, synced = -Infinity, dirty = true, filter = null, signature = '', stepSignature = '';
let width = 0, height = 0, snapshotValue, theme = 'dark', savedOverflow = '', flatSVG;
const own = object => (objects.add(object), object);
const mat = color => own(new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0 }));
const materials = { base: mat('#242927'), rim: mat('#414a43'), wall: mat('#aaa99f'), roof: mat('#454e47'), pane: mat('#242d29') };
const hemi = new THREE.HemisphereLight('#fff8ec', '#29322b', 2.1);
const sun = new THREE.DirectionalLight('#fff7e8', 2.5); sun.position.set(-10, 18, 10);
scene.add(hemi, sun);
function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const result = new THREE.Mesh(own(geometry), material); result.position.set(x, y, z); parent.add(result); return result;
}
function box(parent, w, h, d, material, x = 0, y = h / 2, z = 0) {
  const r = Math.min(.08, w / 4, h / 4, d / 4), shape = new THREE.Shape();
  shape.moveTo(-w/2+r, -h/2+r); shape.lineTo(w/2-r,-h/2+r); shape.lineTo(w/2-r,h/2-r); shape.lineTo(-w/2+r,h/2-r); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: d-2*r, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: r, bevelThickness: r });
  g.center(); return mesh(parent, g, material, x, y, z);
}
function disk(parent, r, h, material, y) { return mesh(parent, new THREE.CylinderGeometry(r,r,h,48),material,0,y); }
function buildNode(n) {
  const point = new THREE.Vector3((n.x-.5)*27, 0, (n.y-.48)*20);
  const group = new THREE.Group(); group.position.copy(point); scene.add(group);
  disk(group, 1.64, .18, materials.base, .02); disk(group, 1.60, .025, materials.rim, .12);
  disk(group, 1.53, .055, materials.base, .155);
  const windows = own(new THREE.MeshStandardMaterial({ color: '#555c4d', emissive: '#f4ca87', emissiveIntensity: 0, roughness: .8 }));
  if (n.kind === 'gate') {
    box(group,.22,1.4,.5,materials.wall,-.8,.9); box(group,.22,1.4,.5,materials.wall,.8,.9);
    box(group,1.94,.2,.66,materials.roof,0,1.62); box(group,1.5,.04,.5,windows,0,1.5);
  } else if (n.kind === 'core') {
    box(group,1.7,1.8,1.38,materials.wall,0,1.12);
    box(group,1.9,.15,1.55,materials.roof,0,2.1);
    for (const x of [-.5, .1, .55]) for(const y of [.83,1.48]) box(group,.24,.29,.05,windows,x,y,.72);
    box(group,.35,.58,.06,materials.roof,-.15,.51,.74);
  } else if (n.kind === 'lab') {
    disk(group,1,.72,materials.wall,.59); disk(group,1.04,.1,materials.roof,1);
    mesh(group,new THREE.SphereGeometry(.96,32,20,0,Math.PI*2,0,Math.PI/2),materials.pane,0,1.04);
    box(group,.26,.29,.05,windows,-.4,.65,.96); box(group,.26,.29,.05,windows,.4,.65,.96);
    mesh(group,new THREE.CylinderGeometry(.028,.028,.8,8),materials.roof,.28,2.01,0);
  } else if (n.kind === 'house') {
    box(group,1.7,1.05,1.3,materials.wall,0,.77);
    const roof = mesh(group,new THREE.CylinderGeometry(0,1.35,.6,4,1),materials.roof,0,1.55); roof.rotation.y=Math.PI/4;
    box(group,.43,.4,.05,windows,-.38,.85,.68); box(group,.3,.65,.04,materials.roof,.39,.55,.68);
  } else {
    box(group,2,1.15,1.3,materials.wall,0,.83);
    box(group,2.2,.12,1.5,materials.roof,0,1.46);
    if(n.id==='writing') for(let i=0;i<3;i++) box(group,.3,.56,1,materials.wall,-.6+i*.6,1.73,0);
    else box(group,.86,.52,1.2,materials.wall,-.45,1.74);
    for(const x of [-.64,0,.64]) box(group,.4,.43,.06,windows,x,.88,.68);
  }
  // A location lamp shares the real occupancy state, not a fabricated activity signal.
  const lampMat = own(new THREE.MeshBasicMaterial({ color:'#f4ca87',transparent:true,opacity:0,depthWrite:false }));
  const lamp = mesh(group,new THREE.RingGeometry(1.58,1.78,64),lampMat,0,.19); lamp.rotation.x=-Math.PI/2;
  const button = text('button','', 'footprint-node'); button.type='button'; button.dataset.nodeId=n.id;
  const dot = text('i',''); dot.setAttribute('aria-hidden','true'); button.append(dot,text('span',label(n.id)),text('b','0'));
  button.onclick=()=>setFilter(filter===n.id?null:n.id); overlay.append(button);
  nodeViews.set(n.id,{point, group, button, windows, lamp:lampMat, count:0});
}
function curve(a,b) {
  const v1=nodeViews.get(a)?.point.clone(), v2=nodeViews.get(b)?.point.clone();
  if(!v1||!v2) return null;
  v1.y=v2.y=.23;
  const m=v1.clone().add(v2).multiplyScalar(.5), d=v2.clone().sub(v1);
  // Canonical control point: reverse traversal uses precisely the same physical trail.
  const sign=a.localeCompare(b)<0?1:-1; m.x-=d.z*.09*sign; m.z+=d.x*.09*sign;
  return new THREE.QuadraticBezierCurve3(v1,m,v2);
}
function addRoute(a,b, permanent=false) {
  const key=edgeKey(a,b); if(routes.has(key)) return routes.get(key);
  const c=curve(a,b); if(!c)return null;
  const geometry=own(new THREE.BufferGeometry().setFromPoints(c.getPoints(48)));
  const material=own(new THREE.LineDashedMaterial({ color:palettes[theme].line, dashSize:.12,gapSize:.18,transparent:true,opacity:.5 }));
  const line=new THREE.Line(geometry,material); line.computeLineDistances(); scene.add(line);
  const r={key,a,b,c,line,permanent}; routes.set(key,r); return r;
}
function text(tag,value,className) {
  const e=document.createElement(tag); e.textContent=String(value??''); if(className)e.className=className; return e;
}
function button(title, value, action) { const b=text('button',value); b.type='button'; b.setAttribute('aria-label',title); b.title=title; b.onclick=action; return b; }
function face(id) { const f=text('span','','visitor-face'); f.innerHTML=avatarSVG(id); return f; }
// All UI stays in the document for keyboard access, readable text and shared avatar SVGs.
const heading=text('div','','footprint-heading park-only');
const intro=text('div',''); intro.append(text('h1','网站足迹'),text('p','把网站变成一个小街区，看看访客正在逛哪里。'));
const badge=text('span','', 'source-badge'); badge.id='footprintSource'; heading.append(intro,badge);
const metrics=text('section','','footprint-metrics park-only'); metrics.setAttribute('aria-label','网站足迹统计');
metrics.innerHTML='<div><strong id="footprintCount">—</strong><span>位访客正在逛</span><small id="footprintStatus">正在读取数据…</small></div><div><strong id="footprintActive">—</strong><span>活跃分区</span></div><div><strong id="footprintMoving">—</strong><span>正在切换页面</span></div>';
stage.before(heading,metrics);
const overlay=text('div','','footprint-overlay park-only'); stage.append(overlay);
const note=text('div','页面是站点，头像是访客。','footprint-caption park-only'); stage.append(note);
const toolbar=text('div','','footprint-toolbar park-only');
const select=document.createElement('select'); select.id='footprintTheme'; select.setAttribute('aria-label','足迹外观');
for(const [value,name] of [['system','跟随系统'],['light','浅色'],['dark','深色']]){const o=text('option',name);o.value=value;select.append(o);}
select.onchange=()=>window.__tideTheme?.setPreference(select.value); toolbar.append(select); stage.append(toolbar);
const tools=text('div','','footprint-controls park-only'); tools.setAttribute('role','group');tools.setAttribute('aria-label','足迹视图控制');
const resetButton=button('重置足迹视角','↺',()=>reset()); resetButton.id='footprintReset';
const planButton=button('切换俯瞰视角','俯瞰',()=>{overview=!overview;reset();}); planButton.id='footprintPlan';
const rotateButton=button('自动旋转足迹','自转',()=>{autoRotate=!autoRotate;rotateButton.setAttribute('aria-pressed',String(autoRotate));dirty=true;});rotateButton.id='footprintRotate';rotateButton.setAttribute('aria-pressed','false');
const expandButton=button('展开足迹','展开',()=>stage.classList.contains('footprint-expanded')?collapse():expand());expandButton.id='footprintExpand';
tools.append(resetButton,planButton,rotateButton,expandButton); stage.append(tools);
const mode=text('span','立体漫游', 'footprint-mode park-only'); stage.append(mode);
const footer=text('div','','footprint-journey park-only'); footer.hidden=true;
const routeTitle=text('span','', 'footprint-route-title'), chips=text('div','', 'footprint-route-steps');
const stop=button('取消访客追踪','取消追踪',()=>bridge().deselect?.());footer.append(routeTitle,chips,stop);stage.append(footer);
const explain=text('div','节点为页面分类 · 虚线为站点结构，亮线为选中访客的访问顺序 · 并非鼠标轨迹','footprint-explain park-only');stage.after(explain);
const panel=text('section','','panel park-only footprint-panel');panel.id='footprintPanel';
const panelHead=text('h2','');const panelTitle=text('span','正在逛哪里');const clearFilter=button('显示全部分区','全部',()=>setFilter(null));clearFilter.hidden=true;
panelHead.append(panelTitle,clearFilter); const roster=text('div','','footprint-roster');const rosterEmpty=text('p','', 'footprint-roster-empty');panel.append(panelHead,roster,rosterEmpty);
document.querySelector('aside').prepend(panel);
const statusBox=text('div','','footprint-notice park-only');statusBox.hidden=true;
const statusText=text('span',''),retry=button('重新读取访客数据','重试',()=>bridge().refresh?.());statusBox.append(statusText,retry);stage.append(statusBox);
function setFilter(id){filter=id;stepSignature='';dirty=true;sync();}
function syncList(s) {
  const entries=filter?s.occupants.get(filter)||[]:s.visitors;
  const ordered=[...entries].sort((a,b)=> (b[1].enterTs||0)-(a[1].enterTs||0)||a[0].localeCompare(b[0]));
  const ids=new Set(ordered.map(([id])=>id));
  for(const [id,row] of listRows)if(!ids.has(id)){row.remove();listRows.delete(id);}
  ordered.forEach(([id,v],i)=>{
    let row=listRows.get(id);
    if(!row){ row=button('','',()=>bridge().selectVisitor?.(id));row.className='footprint-person';row.dataset.visitorId=id;
      const copy=text('span','','footprint-person-copy');copy.append(text('strong',''),text('small',''));
      row.append(face(id),copy,text('span','', 'footprint-person-node'));listRows.set(id,row); }
    row.querySelector('strong').textContent=v.city?.[0]||'未知位置';row.querySelector('small').textContent=pageName(v,site);
    row.querySelector('.footprint-person-node').textContent=label(currentNode(v,site));
    row.setAttribute('aria-label',`${v.city?.[0]||'未知位置'}，${pageName(v,site)}，查看访问足迹`);
    row.setAttribute('aria-pressed',String(id===bridge().selectedId));
    if(roster.children[i]!==row)roster.insertBefore(row,roster.children[i]||null);
  });
  panelTitle.textContent=filter?`${label(filter)} · ${entries.length} 人`:`正在逛哪里 · ${entries.length}`;clearFilter.hidden=!filter;
  rosterEmpty.hidden=entries.length>0;rosterEmpty.textContent=s.unavailable?'等待访客数据…':filter?'这个分区暂时没有访客。':'有人来访时，头像会出现在这里。';
}
function sync() {
  if(disposed||!active)return;
  const data=bridge(),s=snapshot(data,site);snapshotValue=s;
  el('footprintCount').textContent=s.unavailable?'—':s.visitors.length;
  el('footprintActive').textContent=s.unavailable?'—':s.activeNodes;
  el('footprintMoving').textContent=s.unavailable?'—':s.moving;
  badge.textContent=data.demo?'演示数据':'实时数据';badge.classList.toggle('is-demo',!!data.demo);
  el('footprintStatus').textContent=data.demo?'模拟访客演示，不计入真实统计':data.status==='error'?'连接中断 · 暂停活动亮灯':s.unavailable?'正在读取访客数据…':`最近 ${Math.round((data.onlineMs||90000)/1000)} 秒内有活动`;
  statusBox.hidden=!(data.status==='error'||(!s.unavailable&&!s.visitors.length));retry.hidden=data.status!=='error';
  statusText.textContent=data.status==='error'?(data.updatedAt?'连接中断，显示最近数据。':'暂时无法读取访客数据。'):'目前没有在线访客，新的足迹会自动出现在这里。';
  for(const [id,n]of nodeViews){n.count=s.occupants.get(id)?.length||0;n.button.querySelector('b').textContent=n.count;
    n.button.classList.toggle('is-active',n.count>0&&s.fresh);n.button.setAttribute('aria-pressed',String(filter===id));
    n.button.setAttribute('aria-label',`${label(id)}，${n.count} 位访客，筛选这个分区`);
    n.windows.color.set(n.count&&s.fresh?palettes[theme].lit:palettes[theme].pane);
    n.windows.emissiveIntensity=theme==='dark'&&n.count>0&&s.fresh ? .65 : 0;
    n.lamp.color.set(palettes[theme].lit);n.lamp.opacity=n.count&&s.fresh?(theme==='dark'?.5:.12):0;
  }
  syncList(s);
  const ids=new Set(s.visitors.map(([id])=>id));
  for(const[id,a]of avatars)if(!ids.has(id)){a.node.remove();avatars.delete(id);}
  for(const[id,v]of s.visitors)if(!avatars.has(id)){
    const b=button('','',()=>bridge().selectVisitor?.(id));b.className='footprint-avatar';b.dataset.visitorId=id;b.append(face(id));
    overlay.append(b);avatars.set(id,{node:b,point:new THREE.Vector3()});
  }
  const chosen=data.visitors?.get(data.selectedId), history=steps(chosen,site), trail=journey(chosen,site);
  const sig=JSON.stringify([trail,filter,theme,s.fresh]);
  if(sig!==signature){
    const lit=new Set(trail.map(([a,b])=>edgeKey(a,b)));trail.forEach(([a,b])=>addRoute(a,b));
    for(const[k,r]of routes){
      if(!r.permanent&&!lit.has(k)){scene.remove(r.line);r.line.geometry.dispose();r.line.material.dispose();objects.delete(r.line.geometry);objects.delete(r.line.material);routes.delete(k);continue;}
      const on=lit.has(k);r.line.material.color.set(on?palettes[theme].lit:palettes[theme].line);
      r.line.material.opacity=on?.95:filter&&(r.a!==filter&&r.b!==filter)?.12:.42;
      r.line.material.dashSize=on?100:.12;r.line.material.gapSize=on?0:.18;
    }signature=sig;
  }
  const chipSig=JSON.stringify([data.selectedId,history,chosen?.currentPath]);
  if(chipSig!==stepSignature){
    chips.replaceChildren();footer.hidden=!chosen;
    if(chosen){routeTitle.textContent=`${chosen.city?.[0]||'匿名'}访客的足迹`;
      history.forEach((s,i)=>{if(i)chips.append(text('span','→','footprint-step-arrow'));const chip=text('span',label(s.node),'footprint-step');
        chip.title=s.path||label(s.node);chips.append(chip);});
      if(!history.length)chips.append(text('span','尚无已记录路径'));
    }stepSignature=chipSig;
  }
  stage.dataset.footprintLights=String(s.fresh?[...s.occupants].filter(([,v])=>v.length).length:0);
  stage.dataset.footprintRoute=JSON.stringify(trail);dirty=true;
}
const projection=new THREE.Vector3();
function project(p){projection.copy(p).project(camera);return {x:(projection.x+1)*width/2,y:(1-projection.y)*height/2,visible:projection.z>-1&&projection.z<1};}
function place(node,p){const s=project(p);node.style.transform=`translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0) translate(-50%,-50%)`;node.style.visibility=s.visible?'visible':'hidden';}
function layout() {
  camera.updateMatrixWorld(true);
  const s=snapshotValue;if(!s)return;
  for(const n of nodeViews.values())place(n.button,n.point.clone().add(new THREE.Vector3(0,2.9,-.18)));
  const crowd=new Map();
  for(const[id,v]of s.visitors){const a=avatars.get(id);if(!a)continue;
    const node=currentNode(v,site),p=nodeViews.get(node)?.point;if(!p){a.node.hidden=true;continue;}
    const i=crowd.get(node)||0;crowd.set(node,i+1);
    const chosen=id===bridge().selectedId,walking=v.state==='walking'&&!reduced.matches&&s.fresh;
    // Keep clusters bounded; every visitor remains selectable in the full native sidebar list.
    const show=i<3||chosen||walking;a.node.hidden=!show||!!(filter&&node!==filter&&!chosen);if(a.node.hidden)continue;
    if(walking){const c=curve(v.node,v.target);if(c)c.getPoint(THREE.MathUtils.clamp(v.t||0,0,1),a.point);else a.point.copy(p);a.point.y=.75;}
    else a.point.copy(p).add(new THREE.Vector3((Math.min(i,2)-1)*.75,.8,2));
    place(a.node,a.point);a.node.classList.toggle('is-selected',chosen);
    a.node.classList.toggle('is-dimmed',!!bridge().selectedId&&!chosen);
    a.node.title=`${v.city?.[0]||'匿名访客'} · ${pageName(v,site)}`;a.node.setAttribute('aria-label',a.node.title+'，查看足迹');
  }
  if(flat)drawFlat();
}
function drawFlat(){
  const ns='http://www.w3.org/2000/svg';flatSVG.replaceChildren();
  for(const r of routes.values()){
    const pts=r.c.getPoints(32).map(p=>project(p));const path=document.createElementNS(ns,'path');
    path.setAttribute('d',pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
    path.setAttribute('fill','none');path.setAttribute('stroke','#'+r.line.material.color.getHexString());path.setAttribute('stroke-width','1.4');
    path.setAttribute('stroke-dasharray',r.line.material.gapSize?'3 6':'none');flatSVG.append(path);
  }
  for(const[id,n]of nodeViews){const p=project(n.point);const rect=document.createElementNS(ns,'rect');
    for(const[k,v]of Object.entries({x:p.x-35,y:p.y-15,width:70,height:42,rx:12,fill:palettes[theme].base,stroke:palettes[theme].rim}))rect.setAttribute(k,String(v));flatSVG.append(rect);
    const t=document.createElementNS(ns,'text');t.setAttribute('x',p.x);t.setAttribute('y',p.y+13);t.setAttribute('text-anchor','middle');t.setAttribute('fill',palettes[theme].lit);t.textContent=String(n.count);flatSVG.append(t);
  }
}
function applyTheme(){
  theme=window.__tideTheme?.resolved==='light'?'light':'dark';const p=palettes[theme];
  scene.background=new THREE.Color(p.bg);for(const[k,m]of Object.entries(materials))m.color.set(p[k]);
  hemi.intensity=theme==='light'?2.5:1.25;sun.intensity=theme==='light'?2.2:1.6;
  select.value=window.__tideTheme?.preference||'system';signature='';dirty=true;if(ready)sync();
}
function resize(){
  if(disposed)return;const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);if(w===width&&h===height)return;
  width=w;height=h;const aspect=w/h,half=Math.max(12.2,14.9/aspect);camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
  renderer?.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer?.setSize(w,h,false);
  if(flatSVG)flatSVG.setAttribute('viewBox',`0 0 ${w} ${h}`);dirty=true;layout();
}
function reset(){
  if(controls){const damping=controls.enableDamping;controls.enableDamping=false;controls.autoRotate=false;controls.update();controls.enableDamping=damping;controls.target.copy(target);}
  camera.position.copy(overview||flat?new THREE.Vector3(0,40,.01):home);camera.zoom=1;camera.lookAt(target);camera.updateProjectionMatrix();controls?.update();
  planButton.setAttribute('aria-pressed',String(overview));planButton.textContent=overview?'漫游':'俯瞰';dirty=true;
}
function expand(){savedOverflow=document.body.style.overflow;stage.classList.add('footprint-expanded');document.body.style.overflow='hidden';expandButton.textContent='收起';expandButton.setAttribute('aria-label','收起足迹');resize();}
function collapse(){if(!stage.classList.contains('footprint-expanded'))return;stage.classList.remove('footprint-expanded');document.body.style.overflow=savedOverflow;expandButton.textContent='展开';expandButton.setAttribute('aria-label','展开足迹');resize();expandButton.focus({preventScroll:true});}
function activate(view){active=view==='park';if(controls)controls.enabled=active&&!flat;if(!active){collapse();cancelAnimationFrame(frame);frame=0;return;}resize();sync();start();}
function tick(time){frame=0;if(disposed||!active||document.hidden)return;
  const dt=Math.min((time-last)/1000,.1);if(time-last<1000/30){start();return;}last=time;
  if(time-synced>200){sync();synced=time;}
  if(controls){controls.autoRotate=autoRotate&&!reduced.matches;controls.update(dt);}
  layout();if(renderer&&!flat)renderer.render(scene,camera);dirty=false;start();
}
function start(){if(!frame&&active&&!disposed&&!document.hidden)frame=requestAnimationFrame(tick);}
function useFlat(){
  flat=true;stage.dataset.footprintEngine='flat';controls&&(controls.enabled=false);
  canvas.style.display='none';el('stage').style.display='none';mode.textContent='平面兼容模式';
  planButton.disabled=rotateButton.disabled=true;autoRotate=false;rotateButton.setAttribute('aria-pressed','false');
  if(!flatSVG){flatSVG=document.createElementNS('http://www.w3.org/2000/svg','svg');flatSVG.classList.add('footprint-flat','park-only');flatSVG.setAttribute('aria-hidden','true');stage.prepend(flatSVG);}
  reset();width=0;resize();
}
function destroy(event){if(event.persisted)return;disposed=true;cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();window.removeEventListener('tide:themechange',applyTheme);for(const o of objects)o.dispose();renderer?.dispose();}
function motionChange(){if(reduced.matches){autoRotate=false;rotateButton.setAttribute('aria-pressed','false');}rotateButton.disabled=flat||reduced.matches;dirty=true;}
window.__tide3d={ready:()=>ready,activate,reset,viewState:()=>({mode:flat?'flat':'3d',position:camera.position.toArray(),zoom:camera.zoom})};
for(const n of site.nodes)buildNode(n);for(const[a,b]of site.edges)addRoute(a,b,true);
applyTheme();reset();
try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:true});renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  controls=new OrbitControls(camera,canvas);controls.target.copy(target);controls.enableDamping=true;controls.enablePan=false;controls.minZoom=.65;controls.maxZoom=2;
  controls.minPolarAngle=.001;controls.maxPolarAngle=Math.PI*.42;controls.autoRotateSpeed=.35;controls.update();
  stage.dataset.footprintEngine='3d';canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();useFlat();});
}catch(error){console.warn('TideStat footprints: using local flat view.',error);useFlat();}
observer=new ResizeObserver(resize);observer.observe(stage);
window.addEventListener('tide:themechange',applyTheme);window.addEventListener('pagehide',destroy);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&active)collapse();});
reduced.addEventListener('change',motionChange);motionChange();
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else start();});
ready=true;activate(bridge().view||'park');
