import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Observatory: all assets are procedural. Keep the live/demo data bridge in index.html.
const P = {
  background: '#0b131d', deck: '#1a2a36', edge: '#405762', metal: '#a9bac1',
  ceramic: '#c4ced0', glass: '#709ea8', ink: '#132936', cyan: '#86d7dd',
  amber: '#efb572', sea: '#143746', land: '#8cbebd', path: '#4e8291'
};
const canvas = document.getElementById('stage3d');
const stage = canvas.parentElement;
const media = matchMedia('(prefers-reduced-motion: reduce)');
const Y = new THREE.Vector3(0, 1, 0);
const tilt = new THREE.Matrix4().makeRotationZ(-23 * Math.PI / 180);
const visitors = () => window.__tide?.visitors || new Map();
const selected = () => window.__tide?.selectedId || null;
const walkers = new Map(), beacons = new Map(), nodes = new Map(), curves = new Map();
const paths = [], nodeRings = [], disposables = new Set();
let renderer, environment, globe, park, current = 'map', ready = false;
let lastFrame = 0, lastSync = -Infinity, sceneTime = 0, raf = 0;
let autoRotate = !media.matches, fitWidth = 0, fitHeight = 0;
const own = resource => (disposables.add(resource), resource);
const material = (color, options = {}) => own(new THREE.MeshStandardMaterial({ color, roughness: .38, metalness: .25, ...options }));
const basic = (color, options = {}) => own(new THREE.MeshBasicMaterial({ color, ...options }));
const metal = material(P.metal, { metalness: .8, roughness: .3 });
const ceramic = material(P.ceramic, { metalness: .1, roughness: .32 });
const dark = material(P.deck, { metalness: .65, roughness: .4 });
const ink = material(P.ink, { metalness: .45, roughness: .25 });
const signal = material(P.cyan, { emissive: P.cyan, emissiveIntensity: .65 });
const amber = material(P.amber, { emissive: P.amber, emissiveIntensity: .35 });

function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(own(geometry), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function cylinder(parent, radius, height, mat, y = 0) {
  return mesh(parent, new THREE.CylinderGeometry(radius, radius, height, 80), mat, 0, y);
}
function ring(parent, radius, width, mat, y = 0, arc = Math.PI * 2) {
  const m = mesh(parent, new THREE.TorusGeometry(radius, width, 8, 128, arc), mat, 0, y);
  m.rotation.x = -Math.PI / 2;
  m.castShadow = false;
  return m;
}
function roundedGeometry(w, h, d, radius = .12) {
  const r = Math.min(radius, w / 3, h / 3, d / 3);
  const shape = new THREE.Shape();
  const x = -w / 2 + r, y = -h / 2 + r, rw = w - 2 * r, rh = h - 2 * r;
  shape.moveTo(x, y); shape.lineTo(x + rw, y); shape.lineTo(x + rw, y + rh);
  shape.lineTo(x, y + rh); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - r * 2, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: r, bevelThickness: r });
  g.center();
  return g;
}
function box(parent, w, h, d, mat, x = 0, y = h / 2, z = 0, radius = .09) {
  return mesh(parent, roundedGeometry(w, h, d, radius), mat, x, y, z);
}
function contactTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d'), grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,.65)'); grad.addColorStop(.55, 'rgba(0,0,0,.3)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
  return own(new THREE.CanvasTexture(c));
}
function shadow(parent, w, d, y) {
  const m = mesh(parent, new THREE.PlaneGeometry(w, d), basic('#ffffff', { map: contactTexture(), transparent: true, depthWrite: false }), 0, y);
  m.rotation.x = -Math.PI / 2; m.castShadow = false; m.receiveShadow = false;
}
function studioEnvironment() {
  const s = new THREE.Scene(); s.background = new THREE.Color('#172936');
  for (const [x, y, z, w, h, color, intensity] of [
    [-5, 5, 4, 5, 7, '#d9edff', 3], [5, 3, -4, 3, 8, '#81c8d9', 3], [0, 8, 0, 7, 4, '#ffffff', 2], [1, 0, 7, 2, 4, '#f3d1a8', 1.5]
  ]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    panel.position.set(x, y, z); panel.lookAt(0, 0, 0); s.add(panel);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = own(pmrem.fromScene(s, .06, .1, 40));
  s.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  pmrem.dispose();
  return target.texture;
}
function newScene(radius, target, position) {
  const s = new THREE.Scene(); s.background = new THREE.Color(P.background); s.environment = environment;
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 180);
  camera.position.copy(position);
  const control = new OrbitControls(camera, canvas);
  control.target.copy(target); control.enableDamping = true; control.dampingFactor = .065;
  control.enablePan = false; control.minPolarAngle = Math.PI * .12; control.maxPolarAngle = Math.PI * .48;
  control.autoRotateSpeed = .25; control.enabled = false; control.update();
  const hemisphere = new THREE.HemisphereLight('#d6e9f3', '#152430', 1.4); s.add(hemisphere);
  const key = new THREE.DirectionalLight('#edf6ff', 3.1); key.position.set(-8, 14, 9);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .035; key.shadow.bias = -.0003;
  Object.assign(key.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, far: 60 }); s.add(key);
  const rim = new THREE.DirectionalLight('#72b6cf', 2.4); rim.position.set(7, 5, -9); s.add(rim);
  const fill = new THREE.DirectionalLight('#efd3b3', .65); fill.position.set(-4, 2, -3); s.add(fill);
  return { scene: s, camera, controls: control, radius, target, home: position.clone().sub(target).normalize(), fit: 1 };
}
function geoPosition(lat, lng, radius = 2.13) {
  const phi = THREE.MathUtils.degToRad(lat), theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(-Math.cos(phi) * Math.cos(theta), Math.sin(phi), Math.cos(phi) * Math.sin(theta)).multiplyScalar(radius).applyMatrix4(tilt);
}
function createGlobe() {
  const state = newScene(4.0, new THREE.Vector3(0, -.9, 0), new THREE.Vector3(-7, 3.35, -9));
  const s = state.scene;
  // A grounded instrument, not an isolated toy sphere.
  shadow(s, 10, 10, -2.91);
  cylinder(s, 3.02, .20, dark, -2.70);
  cylinder(s, 2.96, .05, metal, -2.57);
  cylinder(s, 2.83, .13, ink, -2.49);
  ring(s, 2.77, .014, signal, -2.41);
  cylinder(s, .7, .3, dark, -2.28);
  cylinder(s, .56, .08, metal, -2.10);
  for (let i = 0; i < 64; i++) {
    const angle = i * Math.PI / 32;
    const tick = mesh(s, new THREE.BoxGeometry(i % 4 ? .014 : .025, .008, i % 4 ? .06 : .13), metal, Math.cos(angle) * 2.63, -2.413, Math.sin(angle) * 2.63);
    tick.rotation.y = -angle + Math.PI / 2; tick.castShadow = false;
  }
  const sphere = mesh(s, new THREE.SphereGeometry(2.1, 80, 56), own(new THREE.MeshPhysicalMaterial({ color: P.sea, roughness: .24, metalness: .48, clearcoat: 1, clearcoatRoughness: .18, envMapIntensity: 1.15 })));
  sphere.castShadow = false;
  const land = atob(window.__tideLandB64), positions = [];
  for (let i = 0; i < 96 * 48; i++) {
    if (land.charCodeAt(i >> 3) & (1 << (i & 7))) positions.push(geoPosition(90 - Math.floor(i / 96) / 47 * 180, (i % 96) / 95 * 360 - 180));
  }
  const dots = new THREE.InstancedMesh(own(new THREE.CylinderGeometry(.028, .033, .018, 6)), material(P.land, { roughness: .4, metalness: .25 }), positions.length);
  const transform = new THREE.Object3D();
  positions.forEach((p, i) => { transform.position.copy(p); transform.quaternion.setFromUnitVectors(Y, p.clone().normalize()); transform.updateMatrix(); dots.setMatrixAt(i, transform.matrix); });
  dots.instanceMatrix.needsUpdate = true; s.add(dots);
  // Fine etched meridians stay subordinate to land and live signals.
  const grid = own(new THREE.LineBasicMaterial({ color: '#477382', transparent: true, opacity: .18 }));
  for (const lat of [-60, -30, 0, 30, 60]) {
    const pts = Array.from({ length: 161 }, (_, i) => geoPosition(lat, i / 160 * 360 - 180, 2.106));
    s.add(new THREE.Line(own(new THREE.BufferGeometry().setFromPoints(pts)), grid));
  }
  for (let lng = -180; lng < 180; lng += 30) {
    const pts = Array.from({ length: 81 }, (_, i) => geoPosition(i / 80 * 180 - 90, lng, 2.106));
    s.add(new THREE.Line(own(new THREE.BufferGeometry().setFromPoints(pts)), grid));
  }
  const gimbal = new THREE.Group(); gimbal.rotation.set(.20, .18, -.30); s.add(gimbal);
  const arc = mesh(gimbal, new THREE.TorusGeometry(2.38, .027, 10, 160), metal); arc.castShadow = false;
  const arcIn = mesh(gimbal, new THREE.TorusGeometry(2.32, .007, 6, 160), signal); arcIn.castShadow = false;
  const atmosphere = mesh(s, new THREE.SphereGeometry(2.16, 48, 40), own(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 n; varying vec3 v; void main(){ vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p; }',
    fragmentShader: 'varying vec3 n; varying vec3 v; void main(){ float f=pow(clamp(1.-abs(dot(normalize(n),normalize(v))),0.,1.),3.); gl_FragColor=vec4(.23,.62,.72,f*.19); }'
  })));
  atmosphere.castShadow = false;
  return state;
}
function curveBetween(a, b) {
  const mid = a.clone().add(b).multiplyScalar(.5), delta = b.clone().sub(a);
  mid.x -= delta.z * .10; mid.z += delta.x * .10; mid.y = .25;
  return new THREE.QuadraticBezierCurve3(a.clone().setY(.25), mid, b.clone().setY(.25));
}
function createPark() {
  const state = newScene(14.6, new THREE.Vector3(0, -2.65, 0), new THREE.Vector3(19, 19.1, 29));
  const s = state.scene;
  shadow(s, 36, 27, -.6);
  box(s, 26, .44, 18, dark, 0, -.24, 0, .20);
  box(s, 25.6, .065, 17.6, metal, 0, .015, 0, .025);
  box(s, 25.4, .14, 17.4, ink, 0, .10, 0, .06);
  // Inlaid perimeter and corner fasteners define scale without decorative clutter.
  for (const x of [-11.8, 11.8]) for (const z of [-7.8, 7.8]) {
    const bolt = mesh(s, new THREE.CylinderGeometry(.08, .08, .025, 12), metal, x, .19, z); bolt.castShadow = false;
  }
  for (const n of window.__tideSite.nodes) {
    const p = new THREE.Vector3((n.x - .5) * 27, .20, (n.y - .48) * 17);
    nodes.set(n.id, p);
    const g = new THREE.Group(); g.position.copy(p); s.add(g);
    cylinder(g, n.kind === 'core' ? 1.75 : 1.48, .13, dark, .05);
    cylinder(g, n.kind === 'core' ? 1.63 : 1.38, .035, metal, .13);
    const glowMat = basic(P.cyan, { transparent: true, opacity: .3 });
    const glow = ring(g, n.kind === 'core' ? 1.65 : 1.4, .022, glowMat, .16);
    nodeRings.push({ id: n.id, ring: glow });
    if (n.kind === 'gate') {
      box(g, .28, 1.8, .6, metal, -1, 1.05); box(g, .28, 1.8, .6, metal, 1, 1.05);
      box(g, 2.3, .24, .65, ceramic, 0, 2.05); box(g, 1.74, .045, .48, signal, 0, 1.90, 0, .018);
    } else if (n.kind === 'core') {
      box(g, 1.45, 2.6, 1.3, ceramic, -.28, 1.48);
      box(g, .85, 1.85, 1.25, metal, .78, 1.10, .10);
      box(g, 1.55, .14, 1.4, dark, -.28, 2.82);
      box(g, 1.28, .07, 1.18, amber, -.28, 2.91, 0, .03);
      for (const y of [.70, 1.13, 1.56, 1.99, 2.42]) box(g, 1.23, .07, .03, ink, -.28, y, .665, .01);
    } else if (n.kind === 'lab') {
      cylinder(g, 1.03, .72, ceramic, .55); cylinder(g, 1.07, .10, metal, .94);
      const glass = own(new THREE.MeshPhysicalMaterial({ color: P.glass, transmission: .93, thickness: .35, ior: 1.46, roughness: .12, metalness: 0, clearcoat: 1, envMapIntensity: 1.3 }));
      mesh(g, new THREE.SphereGeometry(.98, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 1.01);
      cylinder(g, .24, .40, signal, 1.12); ring(g, .7, .025, metal, 1.08);
    } else if (n.kind === 'house') {
      box(g, 1.65, 1.1, 1.3, ceramic, 0, .75);
      const roof = mesh(g, new THREE.CylinderGeometry(0, 1.32, .66, 4, 1), dark, 0, 1.60); roof.rotation.y = Math.PI / 4;
      box(g, .65, .42, .04, ink, -.23, .82, .675, .015);
      box(g, .65, .035, .045, signal, -.23, .60, .7, .008);
      box(g, .24, .64, .04, metal, .49, .56, .675, .015);
    } else {
      box(g, 2.04, 1.15, 1.38, ceramic, 0, .79);
      box(g, 1.10, .8, 1.3, metal, -.45, 1.70);
      box(g, 2.17, .12, 1.5, dark, 0, 1.42);
      box(g, 1.2, .1, 1.42, dark, -.45, 2.17);
      for (const x of [-.64, 0, .64]) box(g, .38, .45, .04, ink, x, .9, .72, .015);
      box(g, 1.76, .035, .045, signal, 0, .58, .735, .012);
    }
  }
  for (const [aId, bId] of window.__tideSite.edges) {
    const curve = curveBetween(nodes.get(aId), nodes.get(bId));
    // Directed curves prevent reverse journeys from starting at the wrong building.
    curves.set(`${aId}>${bId}`, curve);
    curves.set(`${bId}>${aId}`, new THREE.QuadraticBezierCurve3(curve.v2.clone(), curve.v1.clone(), curve.v0.clone()));
    mesh(s, new THREE.TubeGeometry(curve, 40, .068, 6, false), ink).castShadow = false;
    const mat = basic(P.path, { transparent: true, opacity: .5 });
    const line = mesh(s, new THREE.TubeGeometry(curve, 40, .022, 6, false), mat); line.position.y = .075; line.castShadow = false;
    paths.push({ a: aId, b: bId, material: mat });
  }
  return state;
}
function syncData() {
  const live = visitors(), focus = selected(), seen = new Set(), byCity = new Map();
  for (const [id, v] of live) {
    seen.add(id);
    if (!walkers.has(id)) {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat); sprite.scale.setScalar(.95); park.scene.add(sprite);
      walkers.set(id, { sprite, tex, canvas: c, lastState: null, fresh: true });
    }
    const w = walkers.get(id);
    if (w.lastState !== v.state) {
      const ctx = w.canvas.getContext('2d'); ctx.clearRect(0, 0, 128, 128);
      window.__tidePaintAvatar(ctx, 64, 64, 44, window.__tideAvatarTraits(v.fullId || v.id), v.state);
      w.tex.needsUpdate = true; w.lastState = v.state;
    }
    const key = JSON.stringify([v.city[1], Number(v.city[2]), Number(v.city[3]), v.city[0]]);
    if (!byCity.has(key)) byCity.set(key, { city: v.city, count: 0, focused: false });
    const c = byCity.get(key); c.count++; c.focused ||= focus === id;
  }
  for (const [id, w] of walkers) if (!seen.has(id)) {
    park.scene.remove(w.sprite); w.tex.dispose(); w.sprite.material.dispose(); walkers.delete(id);
  }
  for (const [key, data] of byCity) {
    if (!Number.isFinite(Number(data.city[2])) || !Number.isFinite(Number(data.city[3]))) continue;
    let b = beacons.get(key);
    if (!b) {
      const g = new THREE.Group(); const p = geoPosition(Number(data.city[2]), Number(data.city[3]), 2.145);
      g.position.copy(p); g.quaternion.setFromUnitVectors(Y, p.clone().normalize());
      // Per-city geometry/materials are explicitly disposed when the last visitor leaves.
      const mat = new THREE.MeshBasicMaterial({ color: P.amber });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.012, .018, 1, 8), mat); stem.geometry.translate(0, .5, 0);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), mat);
      const pulse = new THREE.Mesh(new THREE.RingGeometry(.055, .069, 32), new THREE.MeshBasicMaterial({ color: P.amber, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      pulse.rotation.x = -Math.PI / 2; pulse.position.y = .006;
      g.add(stem, cap, pulse); globe.scene.add(g); b = { group: g, stem, cap, pulse, normal: p.clone().normalize() }; beacons.set(key, b);
    }
    b.height = .20 + Math.min(data.count, 8) * .09;
    b.focused = data.focused; b.stem.scale.y = b.height; b.cap.position.y = b.height;
    b.stem.material.color.set(data.focused ? '#ffffff' : P.amber);
  }
  for (const [key, b] of beacons) if (!byCity.has(key)) { disposeBeacon(b); beacons.delete(key); }
  const v = live.get(focus), visited = new Set();
  if (v) for (let i = 1; i < v.visited.length; i++) visited.add([v.visited[i - 1].node, v.visited[i].node].sort().join('|'));
  for (const p of paths) {
    const active = visited.has([p.a, p.b].sort().join('|'));
    p.material.color.set(active ? P.amber : P.path); p.material.opacity = active ? 1 : focus ? .18 : .5;
  }
  for (const n of nodeRings) {
    const active = [...live.values()].some(v => v.node === n.id);
    n.ring.material.opacity = active ? .8 : .22;
  }
}
function disposeBeacon(b) {
  globe.scene.remove(b.group);
  b.stem.geometry.dispose(); b.cap.geometry.dispose(); b.pulse.geometry.dispose(); b.stem.material.dispose(); b.pulse.material.dispose();
}
const pos = new THREE.Vector3();
function animateData(now, delta) {
  const live = visitors(), crowd = new Map(), focus = selected();
  for (const [id, v] of live) {
    const w = walkers.get(id); if (!w) continue;
    const base = nodes.get(v.node) || nodes.get('home');
    if (v.state === 'reading' || v.state === 'leaving') {
      const i = crowd.get(v.node) || 0; crowd.set(v.node, i + 1);
      const angle = i * 2.39996 + .5, radius = 1.7 + Math.floor(i / 7) * .5;
      pos.set(base.x + Math.cos(angle) * radius, 1.05, base.z + Math.sin(angle) * radius);
    } else {
      const t = THREE.MathUtils.clamp(v.t || 0, 0, 1), eased = t * t * (3 - 2 * t);
      const curve = curves.get(`${v.node}>${v.target}`);
      if (curve) curve.getPoint(eased, pos);
      else pos.copy(base).lerp(nodes.get(v.target) || base, eased);
      pos.y = 1.1;
    }
    if (!media.matches) pos.y += Math.sin(now * (v.state === 'walking' ? 9 : 2) + (v.bob || 0)) * .055;
    if (w.fresh) { w.sprite.position.copy(pos); w.fresh = false; }
    else w.sprite.position.lerp(pos, 1 - Math.exp(-delta * 14));
    w.sprite.material.opacity = (v.state === 'leaving' ? Math.max(0, 1 - (v.t || 0)) : 1) * (focus && focus !== id ? .25 : 1);
    w.sprite.scale.setScalar(focus === id ? 1.25 : .95);
  }
  const camera = globe.camera.position;
  for (const b of beacons.values()) {
    // Perspective-correct horizon test: a far-side beacon must never bleed through the globe.
    b.group.visible = b.normal.dot(pos.copy(camera).sub(b.group.position).normalize()) > .03;
    const pulse = media.matches ? .3 : ((now * .55 + b.group.position.x * .37) % 1 + 1) % 1;
    b.pulse.scale.setScalar(1 + pulse * 1.5); b.pulse.material.opacity = (1 - pulse) * (b.focused ? .95 : .6);
  }
}
function resize() {
  if (!renderer || !globe || !park) return;
  const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
  if (w === fitWidth && h === fitHeight) return;
  fitWidth = w; fitHeight = h;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, w < 600 ? 1.5 : 1.75)); renderer.setSize(w, h, false);
  for (const state of [globe, park]) {
    const { camera, controls, radius, target } = state;
    const previousFit = state.fit, oldDistance = camera.position.distanceTo(target);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const vertical = THREE.MathUtils.degToRad(camera.fov / 2), horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
    state.fit = radius / Math.sin(Math.min(vertical, horizontal)) * (w < 600 ? 1.08 : 1.02);
    const distance = previousFit === 1 ? state.fit : state.fit * THREE.MathUtils.clamp(oldDistance / previousFit, .65, 1.8);
    camera.position.sub(target).normalize().multiplyScalar(distance).add(target);
    controls.minDistance = state.fit * .65; controls.maxDistance = state.fit * 1.8;
    camera.far = Math.max(180, state.fit * 4); camera.updateProjectionMatrix(); controls.update();
  }
}
function activate(view) {
  if (!ready) return;
  current = view === 'park' ? 'park' : 'map';
  park.controls.enabled = current === 'park'; globe.controls.enabled = current === 'map';
  stage.dataset.view = current;
  lastSync = -Infinity; resize();
}
function reset() {
  const state = current === 'park' ? park : globe; if (!state) return;
  const control = state.controls, damping = control.enableDamping, rotating = control.autoRotate;
  // Flush OrbitControls inertia before restoring the fitted camera; do not access private fields.
  control.autoRotate = false; control.enableDamping = false; control.update();
  state.camera.position.copy(state.home).multiplyScalar(state.fit).add(state.target);
  control.target.copy(state.target); control.update();
  control.enableDamping = damping; control.autoRotate = rotating;
}
function controlsUI() {
  const group = document.createElement('div'); group.className = 'scene-controls'; group.setAttribute('role', 'group'); group.setAttribute('aria-label', '3D 视图控制');
  const button = (label, path, callback) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', label);
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    b.addEventListener('click', callback); group.append(b); return b;
  };
  button('重置视角', '<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>', reset);
  const rotation = button('自动旋转', '<path d="M7 5a8 8 0 0 1 13 6m-3 8A8 8 0 0 1 4 13M20 5v6h-6M4 19v-6h6"/>', () => {
    if (media.matches) return;
    autoRotate = !autoRotate; rotation.setAttribute('aria-pressed', String(autoRotate));
  });
  rotation.setAttribute('aria-pressed', String(autoRotate));
  rotation.disabled = media.matches;
  media.addEventListener('change', () => { autoRotate = !media.matches; rotation.disabled = media.matches; rotation.setAttribute('aria-pressed', String(autoRotate)); });
  stage.append(group);
}
function tick(now) {
  raf = requestAnimationFrame(tick);
  if (!ready || document.hidden || now - lastFrame < 1000 / 30) return;
  const delta = Math.min((now - lastFrame) / 1000 || 0, .08); lastFrame = now;
  sceneTime += delta;
  if (now - lastSync >= 200) { syncData(); lastSync = now; }
  animateData(sceneTime, delta);
  const state = current === 'park' ? park : globe;
  state.controls.autoRotate = autoRotate && !media.matches; state.controls.update(delta);
  renderer.render(state.scene, state.camera);
}
function fallback(error) {
  ready = false; canvas.style.display = 'none'; document.getElementById('stage').style.display = 'block';
  stage.dataset.renderer = '2d'; stage.querySelector('.scene-controls')?.setAttribute('hidden', '');
  if (error) console.warn('TideStat: using 2D fallback.', error);
}
window.__tide3d = { ready: () => ready, activate, reset };
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.03;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  environment = studioEnvironment(); globe = createGlobe(); park = createPark();
  resize(); ready = true; stage.dataset.renderer = '3d'; controlsUI(); activate(window.__tide?.view || 'map');
  const observer = new ResizeObserver(resize); observer.observe(stage);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); fallback(); });
  canvas.addEventListener('webglcontextrestored', () => {
    ready = true; stage.dataset.renderer = '3d'; canvas.style.display = 'block'; document.getElementById('stage').style.display = 'none';
    stage.querySelector('.scene-controls')?.removeAttribute('hidden'); activate(window.__tide?.view || 'map');
  });
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    cancelAnimationFrame(raf); observer.disconnect(); park.controls.dispose(); globe.controls.dispose();
    for (const w of walkers.values()) { w.tex.dispose(); w.sprite.material.dispose(); }
    for (const b of beacons.values()) disposeBeacon(b);
    for (const resource of disposables) resource.dispose(); renderer.dispose();
  }, { once: true });
  raf = requestAnimationFrame(tick);
} catch (error) { fallback(error); }
