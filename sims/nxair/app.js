// NXAIR Teardown page: 3D stage + reference rail (steps, parts, torques, specs, sources).
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {
  BASIS, BUSBAR, CABLES, COMPS, DEPTHS, DIMENSIONS, DOCS, INTERLOCKS, JOINTS, LUBES, MAINT, PARTS, RATINGS, STEPS,
  TOOLS, TORQUE_TABLE, WIDTHS, jointById, partById,
} from './data.js';
import {boltGeometry, buildPanel, makeMaterials} from './model.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const store = {
  get(k, d) { try { const v = localStorage.getItem('nxair.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('nxair.' + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------------------------------------- state
const state = {
  W: 800, D: 1500, bus: 2500, ur: 12,
  step: 0, ex: 0, truck: 'service', row: true, cut: false, glass: true, bolts: 'step', labels: true,
  focus: [], joints: [], selJoint: null, selPart: null, crane: false,
  ...store.get('variant', {}),
};
state.step = Math.min(store.get('step', 0), STEPS.length - 1);

// -------------------------------------------------------------------------------------------- scene setup
const stage = $('#stage');
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.localClippingEnabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f8c, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(3, 6, 4);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.minDistance = 0.6;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI * 0.62;

const cutPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e5);
const mats = makeMaterials([cutPlane]);
const lineMat = new THREE.LineBasicMaterial({color: 0x1f2427, transparent: true, opacity: 0.32, clippingPlanes: [cutPlane]});
const ghostMat = new THREE.MeshStandardMaterial({color: 0xb7bdb9, transparent: true, opacity: 0.1, depthWrite: false, roughness: 0.7, side: THREE.DoubleSide});
const ghostLine = new THREE.LineBasicMaterial({color: 0x1f2427, transparent: true, opacity: 0.09});
const floorGrid = new THREE.GridHelper(12, 60, 0x9aa09c, 0xc4c8c4);
floorGrid.material.transparent = true;
floorGrid.material.opacity = 0.5;
floorGrid.position.y = -0.0005;
scene.add(floorGrid);

const SIZE_KEYS = ['M8', 'M10', 'M12', 'M16'];
const boltMat = {};
const boltDim = new THREE.MeshStandardMaterial({color: 0x9aa0a4, transparent: true, opacity: 0.35, roughness: 0.5, metalness: 0.4, clippingPlanes: [cutPlane]});
const boltHot = new THREE.MeshStandardMaterial({color: 0xd9741c, emissive: 0xd9741c, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.3, clippingPlanes: [cutPlane]});
for (const k of SIZE_KEYS) boltMat[k] = new THREE.MeshStandardMaterial({color: 0x888888, roughness: 0.38, metalness: 0.55, clippingPlanes: [cutPlane]});
const accentColor = new THREE.Color();

function applyThemeColors() {
  for (const k of SIZE_KEYS) boltMat[k].color.set(css('--' + k.toLowerCase()));
  accentColor.set(css('--accent'));
  boltHot.color.copy(accentColor);
  boltHot.emissive.copy(accentColor);
  const ink = new THREE.Color(css('--ink'));
  lineMat.color.copy(ink);
  ghostLine.color.copy(ink);
  const dark = new THREE.Color(css('--bg')).getHSL({}).l < 0.4;
  floorGrid.material.color.set(dark ? 0x2c3236 : 0xc3c8c3);
  floorGrid.material.vertexColors = false;
  ghostMat.color.set(dark ? 0x5b6468 : 0xb7bdb9);
  applyFocus();
}

// -------------------------------------------------------------------------------------------- build world
let world = null; // {row, subject, neighbors[], bolts:{jid:[InstancedMesh]}, partMats:{id:[mat]}}
const VIS = 2.2; // bolt heads drawn larger than life so they read at switchgear scale

function disposeTree(o) {
  o.traverse((c) => {
    if (c.geometry && !c.geometry.userData?.shared) c.geometry.dispose();
  });
}

function build() {
  if (world) {
    scene.remove(world.row);
    disposeTree(world.row);
  }
  const row = new THREE.Group();
  row.scale.setScalar(0.001);
  scene.add(row);
  const opts = {W: state.W, D: state.D, bus: state.bus, ur: state.ur};
  const subject = buildPanel(mats, opts);
  subject.root.position.z = -state.D / 2;
  row.add(subject.root);

  // per-part material clones so focus tinting is per part
  const partMats = {};
  for (const [id, groups] of Object.entries(subject.parts)) {
    const cache = new Map();
    for (const g of groups) {
      g.traverse((c) => {
        if (!c.isMesh) return;
        const pid = c.userData.part || id;
        const key = pid + '|' + c.material.uuid;
        if (!cache.has(key)) {
          const m = c.material.clone();
          m.userData.base = {opacity: m.opacity, transparent: m.transparent};
          cache.set(key, m);
          (partMats[pid] ||= []).push(m);
        }
        c.material = cache.get(key);
        c.userData.part = pid;
        const e = new THREE.LineSegments(new THREE.EdgesGeometry(c.geometry, 25), lineMat);
        e.raycast = () => {};
        c.add(e);
      });
    }
  }

  // bolts
  const bolts = {};
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const m4 = new THREE.Matrix4();
  for (const [jid, list] of Object.entries(subject.anchors)) {
    const j = jointById[jid];
    const size = SIZE_KEYS.includes(j?.size) ? j.size : 'M8';
    for (const {group, list: pts} of list) {
      const geo = boltGeometry(size);
      geo.userData.shared = true;
      const im = new THREE.InstancedMesh(geo, boltMat[size], pts.length);
      pts.forEach(({p, n}, i) => {
        q.setFromUnitVectors(up, n.clone().normalize());
        m4.compose(p, q, new THREE.Vector3(VIS, VIS, VIS));
        im.setMatrixAt(i, m4);
      });
      im.userData = {joint: jid, size, pts};
      group.add(im);
      (bolts[jid] ||= []).push(im);
    }
  }

  // neighbours: same panel, ghosted
  const neighbors = [];
  for (const s of [-1, 1]) {
    const n = buildPanel(mats, opts);
    n.root.position.set(s * state.W, 0, -state.D / 2);
    n.root.traverse((c) => {
      if (c.isMesh) {
        c.material = ghostMat;
        c.raycast = () => {};
        if (n.shellIds.has(c.parent?.userData?.part)) {
          const e = new THREE.LineSegments(new THREE.EdgesGeometry(c.geometry, 25), ghostLine);
          c.add(e);
        }
      }
    });
    for (const id of ['crane', 'serviceTruck', 'rails']) for (const g of n.parts[id] || []) g.visible = false;
    row.add(n.root);
    neighbors.push(n);
  }
  // one continuous pair of foundation rails under the row
  for (const g of subject.parts.rails) g.scale.x = 3;

  world = {row, subject, neighbors, bolts, partMats};
  anim.ex = state.ex;
  anim.truck = truckZ(state.truck);
  applyFocus();
  applyGlass();
  applyCut();
  applyPose(true);
}

// ------------------------------------------------------------------------------------------- pose + looks
const anim = {ex: 0, truck: 0};
const truckZ = (t) => (t === 'service' ? 0 : t === 'test' ? 230 : 1150);

function applyPose(force) {
  if (!world) return;
  const {subject, neighbors} = world;
  for (const [id, groups] of Object.entries(subject.parts)) {
    for (const g of groups) {
      if (g.userData.truck) {
        g.position.set(0, 0, anim.truck);
        continue;
      }
      if (g.userData.service) {
        g.visible = anim.truck > 700;
        continue;
      }
      if (g.userData.crane) {
        g.visible = state.crane;
        continue;
      }
      g.position.copy(g.userData.dir).multiplyScalar(anim.ex);
    }
  }
  // shutters follow the truck, earthing switch closed unless in service
  const open = THREE.MathUtils.clamp(1 - anim.truck / 160, 0, 1);
  const eswClosed = state.truck !== 'service';
  for (const p of [subject, ...neighbors]) {
    for (const g of p.parts.shutters || []) {
      for (const c of g.children) {
        if (!c.userData.shut) continue;
        c.userData.y0 ??= c.position.y;
        c.position.y = c.userData.y0 + c.userData.shut * 250 * (p === subject ? open : 1);
      }
    }
    for (const g of p.parts.esw || []) g.children.forEach((c) => { if (c.userData.blade) c.rotation.x = eswClosed ? 0 : 1.15; });
    if (p !== subject) for (const g of p.parts.breaker || []) g.position.z = 0;
  }
  for (const n of neighbors) n.root.visible = state.row;
}

function applyFocus() {
  if (!world) return;
  const focus = new Set(state.selPart ? [state.selPart] : state.focus);
  for (const [pid, list] of Object.entries(world.partMats)) {
    const on = focus.has(pid);
    for (const m of list) {
      if (!m.emissive) continue;
      m.emissive.copy(on ? accentColor : new THREE.Color(0));
      m.emissiveIntensity = on ? 0.26 : 0;
    }
  }
  const active = new Set(state.selJoint ? [state.selJoint] : state.joints);
  for (const [jid, ims] of Object.entries(world.bolts)) {
    for (const im of ims) {
      const hot = active.has(jid);
      im.visible = hot || state.bolts === 'all' || (jid === 'crane' && state.crane);
      im.material = hot ? boltHot : state.bolts === 'all' ? boltMat[im.userData.size] : boltDim;
      if (state.bolts === 'none' && !hot) im.visible = false;
    }
  }
  renderLabels();
}

function applyGlass() {
  if (!world) return;
  for (const id of world.subject.shellIds) {
    for (const m of world.partMats[id] || []) {
      if (state.glass) {
        m.transparent = true;
        m.opacity = 0.13;
        m.depthWrite = false;
      } else {
        m.transparent = m.userData.base.transparent;
        m.opacity = m.userData.base.opacity;
        m.depthWrite = true;
      }
      m.needsUpdate = true;
    }
  }
}

function applyCut() {
  cutPlane.constant = state.cut ? 0 : 1e5;
}

// -------------------------------------------------------------------------------------------------- views
const VIEWS = {
  iso: {p: [3.7, 2.9, 4.7], t: [0, 1.1, 0]},
  front: {p: [0.25, 1.4, 6.0], t: [0, 1.15, 0]},
  rear: {p: [-2.6, 1.9, -5.0], t: [0, 1.05, -0.2]},
  side: {p: [5.6, 1.4, 0.15], t: [0, 1.15, 0]},
  top: {p: [0.4, 6.8, 1.6], t: [0, 0.8, 0]},
  low: {p: [2.4, 0.9, 2.7], t: [0, 0.2, 0.1]},
  bus: {p: [3.3, 3.2, 2.0], t: [0, 1.65, -0.3]},
  cable: {p: [3.0, 1.15, -2.1], t: [0, 0.6, -0.45]},
};
const VIEW_BUTTONS = [['iso', '3/4'], ['front', 'Front'], ['side', 'Side'], ['rear', 'Rear'], ['top', 'Top']];
let camTween = null;
function goView(name, instant) {
  const v = VIEWS[name] || VIEWS.iso;
  const k = state.W / 800;
  const to = new THREE.Vector3(...v.p).multiplyScalar(name === 'top' ? 1 : 0.85 + 0.15 * k);
  const tt = new THREE.Vector3(...v.t);
  if (state.crane && name === 'iso') to.multiplyScalar(1.15);
  if (instant || reduced) {
    camera.position.copy(to);
    controls.target.copy(tt);
    camTween = null;
  } else {
    camTween = {t0: performance.now(), dur: 850, p0: camera.position.clone(), t0v: controls.target.clone(), p1: to, t1: tt};
  }
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === name));
}

// ------------------------------------------------------------------------------------------------- labels
const labelLayer = $('#labels');
const tmpV = new THREE.Vector3();
function jointLabel(j, n) {
  let bolt = j.size;
  if (j.id === 'busbar') bolt = BUSBAR[state.bus].bolt;
  const t = j.t != null ? `${j.t} Nm` : j.ref_t ? j.ref_t : BASIS[j.basis].label;
  return `${n}× ${esc(bolt)} · <i>${esc(t)}</i>`;
}
function renderLabels() {
  if (!world) return;
  const active = state.selJoint ? [state.selJoint] : state.joints;
  const html = [];
  if (state.labels) {
    for (const jid of active) {
      const ims = world.bolts[jid];
      if (!ims) continue;
      const n = ims.reduce((a, im) => a + im.count, 0);
      html.push(`<div class="tag" data-j="${jid}">${jointLabel(jointById[jid], n)}</div>`);
    }
  }
  labelLayer.innerHTML = html.join('');
}
function placeLabels() {
  if (!world || !state.labels) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  for (const el of labelLayer.children) {
    const ims = world.bolts[el.dataset.j];
    if (!ims || !ims[0].visible) { el.hidden = true; continue; }
    // anchor: the instance nearest the centroid of the first mesh's points
    const im = ims[0];
    const pts = im.userData.pts;
    const c = pts.reduce((a, {p}) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    let best = pts[0].p, bd = Infinity;
    for (const {p} of pts) { const d = p.distanceToSquared(c); if (d < bd) { bd = d; best = p; } }
    tmpV.copy(best);
    im.parent.localToWorld(tmpV);
    const hiddenByCut = state.cut && tmpV.x > 0.0005;
    tmpV.project(camera);
    const vis = tmpV.z < 1 && !hiddenByCut && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05;
    el.hidden = !vis;
    if (vis) {
      el.style.left = `${((tmpV.x + 1) / 2) * w}px`;
      el.style.top = `${((1 - tmpV.y) / 2) * h}px`;
    }
  }
}

// ------------------------------------------------------------------------------------------------- picking
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(ev) {
  if (!world) return null;
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObject(world.subject.root, true);
  for (const h of hits) {
    if (state.cut && h.point.x > 0.0005) continue;
    let o = h.object;
    if (!o.visible || o.isLineSegments) continue;
    let hidden = false;
    for (let p = o; p; p = p.parent) if (p.visible === false) hidden = true;
    if (hidden) continue;
    if (o.isInstancedMesh) return {joint: o.userData.joint};
    const pid = o.userData.part;
    if (state.glass && world.subject.shellIds.has(pid)) continue;
    if (pid) return {part: pid};
  }
  return null;
}
const tip = $('#tip');
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = {x: e.clientX, y: e.clientY}; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
  const hit = pick(e);
  if (hit?.joint) selectJoint(hit.joint, true);
  else if (hit?.part && partById[hit.part]) selectPart(hit.part, true);
  else { state.selPart = null; state.selJoint = null; applyFocus(); syncSelection(); }
});
let hoverT = 0;
canvas.addEventListener('pointermove', (e) => {
  const now = performance.now();
  if (now - hoverT < 60 || e.buttons) { if (e.buttons) tip.hidden = true; return; }
  hoverT = now;
  const hit = pick(e);
  const r = stage.getBoundingClientRect();
  let txt = '';
  if (hit?.joint) { const j = jointById[hit.joint]; txt = `${j.where} · ${j.t != null ? j.t + ' Nm' : BASIS[j.basis].label}`; }
  else if (hit?.part && partById[hit.part]) txt = partById[hit.part].name;
  tip.hidden = !txt;
  if (txt) { tip.textContent = txt; tip.style.left = `${e.clientX - r.left}px`; tip.style.top = `${e.clientY - r.top}px`; }
});
canvas.addEventListener('pointerleave', () => { tip.hidden = true; });

// ---------------------------------------------------------------------------------------------- render loop
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const kEx = reduced ? 1 : 1 - Math.exp(-dt * 6);
  const tz = truckZ(state.truck);
  if (Math.abs(anim.ex - state.ex) > 1e-4 || Math.abs(anim.truck - tz) > 0.5) {
    anim.ex += (state.ex - anim.ex) * kEx;
    anim.truck += (tz - anim.truck) * (reduced ? 1 : 1 - Math.exp(-dt * 3.5));
    applyPose();
  }
  if (camTween) {
    const u = Math.min(1, (now - camTween.t0) / camTween.dur);
    const e = ease(u);
    camera.position.lerpVectors(camTween.p0, camTween.p1, e);
    controls.target.lerpVectors(camTween.t0v, camTween.t1, e);
    if (u >= 1) camTween = null;
  }
  controls.update();
  renderer.render(scene, camera);
  placeLabels();
  requestAnimationFrame(frame);
}

// ================================================================================================ the rail
const sizeOf = (j) => (SIZE_KEYS.includes(j.size) ? j.size : 'MX');
function jointRow(j, {sel} = {}) {
  let bolt = j.bolt;
  if (j.id === 'busbar') bolt = `${BUSBAR[state.bus].bolt} (busbar ${BUSBAR[state.bus].label}, bag ${BUSBAR[state.bus].bag})`;
  const tq = j.t != null
    ? `<div class="n">${j.t}<small>Nm</small></div>${j.c != null ? `<div class="c">check ${j.c} Nm</div>` : ''}`
    : `<div class="n" style="font-size:15px">${j.ref_t ? esc(j.ref_t) : '—'}</div>`;
  const has3d = !!(world?.bolts[j.id]);
  return `<button class="jrow${sel ? ' sel' : ''}" data-joint="${j.id}" type="button" title="${has3d ? 'Show in 3D' : 'No 3D position for this joint'}">
    <span class="bar ${sizeOf(j)}"></span>
    <span style="min-width:0">
      <span class="w">${esc(j.where)}</span>
      <span class="spec" style="display:block"><b>${esc(j.qty)}</b> · ${esc(bolt)}${j.wash && j.wash !== '—' ? ` · ${esc(j.wash)}` : ''}</span>
      ${j.note ? `<span class="note" style="display:block">${esc(j.note)}</span>` : ''}
      <span class="ref" style="display:block;margin-top:3px">${esc(j.ref)}${has3d ? ' · <span style="color:var(--accent-ink)">shown in 3D</span>' : ''}</span>
    </span>
    <span class="tq">${tq}<span class="badge ${j.basis}" title="${esc(BASIS[j.basis].tip)}">${esc(BASIS[j.basis].label)}</span></span>
  </button>`;
}

// ---------------------------------------------------------------- tabs + hash routing
const TABS = ['steps', 'parts', 'torques', 'specs', 'sources'];
function showTab(name) {
  if (!TABS.includes(name)) name = 'steps';
  for (const t of TABS) {
    $('#pane-' + t).hidden = t !== name;
    $(`[data-tab="${t}"]`).setAttribute('aria-current', t === name ? 'page' : 'false');
  }
}
addEventListener('hashchange', () => showTab(location.hash.slice(1)));

// ---------------------------------------------------------------- steps
function renderStep() {
  const s = STEPS[state.step];
  const ticks = STEPS.map((x, i) => `<button type="button" data-goto="${i}" class="${i === state.step ? 'on' : i < state.step ? 'done' : ''}" aria-label="Step ${i + 1}: ${esc(x.title)}" title="${i + 1}. ${esc(x.title)}"></button>`).join('');
  const joints = (s.joints || []).map((id) => jointById[id]).filter(Boolean);
  const extra = s.id === 'busbar' ? `<div class="note-box small" style="margin-top:10px"><b>${BUSBAR[state.bus].label} busbar:</b> ${esc(BUSBAR[state.bus].bolt)} · bag ${esc(BUSBAR[state.bus].bag)} · ${esc(BUSBAR[state.bus].fig)}. ${esc(BUSBAR[state.bus].note)}${state.ur === 17.5 ? ' <b>Ur 17.5 kV:</b> insulating half-shells on every joint.' : ''}</div>` : '';
  $('#pane-steps').innerHTML = `
    <div class="steps-nav">
      <button class="btn" type="button" id="prev" ${state.step === 0 ? 'disabled' : ''}>◀ Prev</button>
      <span class="count">${String(state.step + 1).padStart(2, '0')} / ${STEPS.length}</span>
      <div class="ticks">${ticks}</div>
      <button class="btn primary" type="button" id="next" ${state.step === STEPS.length - 1 ? 'disabled' : ''}>Next ▶</button>
    </div>
    <span class="eyebrow">${esc(s.phase)}</span>
    <h2>${esc(s.title)}</h2>
    <ul class="body">${s.body.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
    ${s.warn ? `<div class="warn">${esc(s.warn)}</div>` : ''}
    ${extra}
    ${joints.length ? `<h3>Fasteners in this step</h3><div class="joints">${joints.map((j) => jointRow(j, {sel: state.selJoint === j.id})).join('')}</div>` : ''}
    <h3>All steps</h3>
    <ol class="plain small" style="padding-left:22px">${STEPS.map((x, i) => `<li><a href="#steps" data-goto="${i}" style="color:${i === state.step ? 'var(--accent-ink)' : 'inherit'};${i === state.step ? 'font-weight:600' : ''}">${esc(x.title)}</a> <span class="muted">· ${esc(x.phase)}</span></li>`).join('')}</ol>`;
}
function setStep(i, {view = true} = {}) {
  state.step = Math.max(0, Math.min(STEPS.length - 1, i));
  store.set('step', state.step);
  const s = STEPS[state.step];
  state.ex = s.ex ?? 0;
  state.truck = s.truck || 'service';
  state.row = s.row ?? true;
  state.cut = !!s.cut;
  state.crane = !!s.crane;
  state.focus = s.focus || [];
  state.joints = s.joints || [];
  state.selJoint = null;
  state.selPart = null;
  syncTools();
  applyCut();
  applyPose();
  applyFocus();
  if (view) goView(s.view || 'iso');
  renderStep();
  syncSelection();
}

// ---------------------------------------------------------------- parts
function renderParts() {
  const sel = state.selPart && partById[state.selPart];
  const card = sel
    ? `<div class="pcard"><span class="eyebrow">${esc(COMPS[sel.comp].name)}</span><h2>${esc(sel.name)}</h2><p>${esc(sel.desc)}</p>
       ${sel.joints.length ? `<h3>How it is fixed</h3><div class="joints">${sel.joints.map((id) => jointRow(jointById[id], {sel: state.selJoint === id})).join('')}</div>` : '<p class="muted small">No bolted joints to make on site.</p>'}</div>`
    : `<div class="pcard"><span class="eyebrow">Parts</span><h2>Pick a part</h2><p class="small muted">Click any part in the 3D view or in the list. The part lights up, the camera stays put, and its fixings appear here with size, washers and torque.</p></div>`;
  const groups = Object.entries(COMPS).map(([k, c]) => {
    const ps = PARTS.filter((p) => p.comp === k);
    if (!ps.length) return '';
    return `<div class="group-h">${esc(c.name)}</div><div class="plist">${ps.map((p) => {
      const n = p.joints.length;
      return `<button type="button" data-part="${p.id}" class="${state.selPart === p.id ? 'sel' : ''}"><span class="sw" style="background:${c.color}"></span>${esc(p.name)}<span class="cnt">${n ? n + ' joint' + (n > 1 ? 's' : '') : ''}</span></button>`;
    }).join('')}</div>`;
  }).join('');
  $('#pane-parts').innerHTML = card + groups;
}
function selectPart(id, fromStage) {
  state.selPart = id;
  state.selJoint = null;
  if (id === 'crane') { state.crane = true; applyPose(); }
  applyFocus();
  renderParts();
  if (fromStage) { location.hash = 'parts'; $('#pane-parts').scrollTop = 0; }
  syncSelection();
}
function selectJoint(id, fromStage) {
  state.selJoint = state.selJoint === id && !fromStage ? null : id;
  state.selPart = null;
  if (id === 'crane') { state.crane = true; applyPose(); }
  if (fromStage) {
    location.hash = 'torques';
    torqueFilter = {size: 'all', group: 'all'};
    renderTorques();
    requestAnimationFrame(() => document.querySelector(`#pane-torques [data-joint="${id}"]`)?.scrollIntoView({block: 'center'}));
  }
  applyFocus();
  syncSelection();
}
function syncSelection() {
  for (const el of document.querySelectorAll('.jrow')) el.classList.toggle('sel', el.dataset.joint === state.selJoint);
  for (const el of document.querySelectorAll('.plist button')) el.classList.toggle('sel', el.dataset.part === state.selPart);
}

// ---------------------------------------------------------------- torques
let torqueFilter = {size: 'all', group: 'all'};
function renderTorques() {
  const groups = [...new Set(JOINTS.map((j) => j.group))];
  const list = JOINTS.filter((j) => (torqueFilter.size === 'all' || j.size === torqueFilter.size) && (torqueFilter.group === 'all' || j.group === torqueFilter.group));
  const chip = (k, v, label) => `<button type="button" class="chip" data-f="${k}" data-v="${esc(v)}" aria-pressed="${torqueFilter[k] === v}">${esc(label)}</button>`;
  const byGroup = groups.map((g) => {
    const rows = list.filter((j) => j.group === g);
    return rows.length ? `<div class="group-h">${esc(g)}</div><div class="joints">${rows.map((j) => jointRow(j, {sel: state.selJoint === j.id})).join('')}</div>` : '';
  }).join('');
  $('#pane-torques').innerHTML = `
    <span class="eyebrow">I §7.1 · §12.2 · applies wherever a step names no torque</span>
    <h2>General tightening torques</h2>
    <div class="gt">${TORQUE_TABLE.map((r) => `<div><div class="s"><span class="dot ${r.size.toLowerCase()}"></span>${r.size}</div><div class="v">${r.t} <small>Nm</small></div><div class="k">control ${r.c} Nm<br>spanner ${r.key} mm</div></div>`).join('')}</div>
    <p class="small muted" style="margin:8px 0 0">Covers, partitions, rear-wall ledges and floor plates fixed with M8 inside the panel: <b style="color:var(--ink)">25 Nm</b>, stated in each step. Busbar and earth joints: threads dry, contact faces with a thin film of Vaseline. Torque wrenches 8–20 and 20–70 Nm, driver 110 Nm for M16.</p>
    <div class="chips">${chip('size', 'all', 'All sizes')}${['M8', 'M10', 'M12', 'M16'].map((s) => chip('size', s, s)).join('')}</div>
    <div class="chips" style="margin-top:0">${chip('group', 'all', 'All groups')}${groups.map((g) => chip('group', g, g)).join('')}</div>
    <p class="small muted" style="margin:0">${list.length} of ${JOINTS.length} joints. Click a row to light those bolts in the 3D view.</p>
    ${byGroup}
    <h3>Torque basis badges</h3>
    <table class="kv small">${Object.entries(BASIS).map(([k, b]) => `<tr><th><span class="badge ${k}">${esc(b.label)}</span></th><td>${esc(b.tip)}</td></tr>`).join('')}</table>`;
}

// ---------------------------------------------------------------- specs + sources
function kv(rows) { return `<table class="kv">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`; }
function renderSpecs() {
  const w = WIDTHS[state.W];
  $('#pane-specs').innerHTML = `
    <span class="eyebrow">NXAIR ≤ 17.5 kV · ≤ 40 kA · ≤ 4000 A</span>
    <h2>Ratings</h2>${kv(RATINGS)}
    <h3>Panel dimensions</h3>${kv(DIMENSIONS)}
    <h3>Your configuration</h3>${kv([
      ['Panel', `${state.W} x ${state.D} x 2300 mm (W x D x H), circuit-breaker panel, feeder ${w.feeder}`],
      ['Transport weight', `≈ ${w.kg} kg (≤ 31.5 kA, without rear duct)`],
      ['Bushing fixed contact', w.contact ? `Ø ${w.contact} mm` : 'see order documents'],
      ['Busbar joint', `${BUSBAR[state.bus].bolt}, ${BUSBAR[state.bus].bars} bar${BUSBAR[state.bus].bars > 1 ? 's' : ''} per phase drawn, bag ${BUSBAR[state.bus].bag}`],
      ['Transverse partition', state.D >= 1400 ? 'Compulsory (depth ≥ 1400 mm)' : 'Optional (depth 1350 mm)'],
      ['Insulating shells', state.ur === 17.5 ? 'Yes, Ur = 17.5 kV' : 'Only with insulated busbar option'],
    ])}
    <h3>Room and foundation</h3>${kv([
      ['Room height', '≥ 2500 mm with evacuation duct; ≥ 2800 / 3000 / 3500 mm with duct or absorber depending on kV and kA (see step 2)'],
      ['Aisles', 'Operating aisle ≥ 1250 mm for panel replacement · rear ≥ 500 mm for rear access · walls ≥ 150 mm from end panels'],
      ['Rail tolerance', 'DIN 43661: 1 mm/m and 2 mm total straightness, 1 mm per 1 m evenness; shims 0.5–1.0 mm'],
      ['Floor fixing', '2 points per panel, elongated holes 60 x 20 mm; M16 hook-head on C-rail 110 Nm'],
      ['Centre of gravity', '800 mm CB panel: 630 mm from front, 400 mm from side, 980 mm high · 435 mm contactor: 390 / 145 / 560 mm'],
      ['Crane rods', 'S355JR Ø 25 mm, 1200 / 1600 mm (front-rear) or 1900 mm (lateral), protrusion > 300 mm, hook height > 2000 mm above rod'],
    ])}
    <h3>Cable limits</h3><div class="scroll-x"><table class="grid4"><thead><tr>${CABLES[0].map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${CABLES.slice(1).map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="small muted">Min. 74 mm lug to lug between phases. VT connecting cables ≥ 100 mm (≤ 12 kV) / ≥ 160 mm (17.5 kV) from screen earths. Shielding cover distance to lug bottom: 180 / 180 / 195 mm (≤ 12 kV) and 300 / 300 / 312 mm (17.5 kV) for 600 / 800 / 1000 mm panels, three-core.</p>
    <h3>Lubricants and sealant</h3><div class="scroll-x"><table class="grid4"><thead><tr><th>Where</th><th>What</th><th>How</th></tr></thead><tbody>${LUBES.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <h3>Interlocks to verify</h3>${kv(INTERLOCKS)}
    <h3>Tools</h3><ul class="plain">${TOOLS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <h3>Maintenance</h3><div class="scroll-x"><table class="grid4"><thead><tr><th>Measure</th><th>When</th><th>What</th></tr></thead><tbody>${MAINT.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <h3>Other NXAIR versions</h3>
    <p class="small">NXAIR 50 kA (172-2014.9) and NXAIR M 24 kV (139-2019.9) use the same general table: M8 30 / M12 70 / M16 110 Nm, control 25 / 60 / 90 Nm. NXAIR M differs in detail: cup-head M12 bolts on some busbar joints, M16x45 with conical spring washer 16 on VT and busbar-earthing-switch connections, and on double-busbar panels insulating plates at 16 Nm (lateral) and 8 Nm with plastic M8 bolts (central). Use the manual of your exact version for those.</p>`;
}
function renderSources() {
  $('#pane-sources').innerHTML = `
    <span class="eyebrow">Where every number comes from</span>
    <h2>Sources</h2>
    <div class="src">${DOCS.map((d) => `<div><b>${esc(d.k)}</b> · ${esc(d.t)}<br><span class="ref">${esc(d.no)} · ${esc(d.rev)}</span><br><a href="${d.url}" target="_blank" rel="noopener">Siemens PDF</a></div>`).join('')}</div>
    <h3>How to read this page</h3>
    <ul class="plain">
      <li>Counts, sizes, washers and torques are copied from the manuals; the section reference sits on every row.</li>
      <li>Bolt positions in 3D are representative. The counts per joint match the manual. Bolt heads are drawn ${VIS}× life size so they can be seen.</li>
      <li>The panel geometry follows the sectional view (O §6.2) at the real outer dimensions. Internal shapes such as breaker poles, bars and bushings are simplified.</li>
      <li>A badge marks how each torque is known. "Maker of part" and "Not stated" rows need the part supplier's figure.</li>
      <li>The order documents, dimension drawings 110-2300.9 and the circuit diagrams of your switchgear take precedence over this page.</li>
    </ul>
    <p class="small muted">Independent study aid built from Siemens' publicly available documentation. Not a Siemens publication. Work on medium-voltage switchgear only as qualified personnel under the five safety rules.</p>`;
}

// -------------------------------------------------------------------------------------------- tools wiring
function syncTools() {
  for (const b of document.querySelectorAll('[data-truck]')) b.setAttribute('aria-pressed', String(b.dataset.truck === state.truck));
  $('#ex').value = String(Math.round(state.ex * 100));
  $('#t-cut').setAttribute('aria-pressed', String(state.cut));
  $('#t-row').setAttribute('aria-pressed', String(state.row));
  $('#t-glass').setAttribute('aria-pressed', String(state.glass));
  $('#t-lab').setAttribute('aria-pressed', String(state.labels));
  for (const b of document.querySelectorAll('[data-bolts]')) b.setAttribute('aria-pressed', String(b.dataset.bolts === state.bolts));
}
function variantNote() {
  const notes = [];
  if (state.D === 1350 && state.bus === 4000) notes.push('3150/4000 A busbar needs depth ≥ 1500 mm.');
  $('#vnote').textContent = notes.join(' ');
}

function wire() {
  $('#views').innerHTML = VIEW_BUTTONS.map(([k, l]) => `<button type="button" data-view="${k}" aria-pressed="false">${l}</button>`).join('');
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.view) goView(t.dataset.view);
    else if (t.dataset.truck) { state.truck = t.dataset.truck; syncTools(); applyPose(); }
    else if (t.dataset.bolts) { state.bolts = t.dataset.bolts; syncTools(); applyFocus(); }
    else if (t.id === 't-cut') { state.cut = !state.cut; applyCut(); syncTools(); }
    else if (t.id === 't-row') { state.row = !state.row; applyPose(); syncTools(); }
    else if (t.id === 't-glass') { state.glass = !state.glass; applyGlass(); syncTools(); }
    else if (t.id === 't-lab') { state.labels = !state.labels; renderLabels(); syncTools(); }
    else if (t.id === 'prev') setStep(state.step - 1);
    else if (t.id === 'next') setStep(state.step + 1);
    else if (t.dataset.goto) { e.preventDefault(); setStep(+t.dataset.goto); $('#pane-steps').scrollTop = 0; }
    else if (t.dataset.part) selectPart(t.dataset.part);
    else if (t.dataset.joint) selectJoint(t.dataset.joint);
    else if (t.dataset.f) { torqueFilter[t.dataset.f] = t.dataset.v; renderTorques(); }
  });
  $('#ex').addEventListener('input', (e) => { state.ex = +e.target.value / 100; });
  for (const [id, key, parse] of [['v-w', 'W', Number], ['v-d', 'D', Number], ['v-bus', 'bus', Number], ['v-ur', 'ur', Number]]) {
    const el = $('#' + id);
    el.value = String(state[key]);
    el.addEventListener('change', () => {
      state[key] = parse(el.value);
      store.set('variant', {W: state.W, D: state.D, bus: state.bus, ur: state.ur});
      variantNote();
      build();
      renderStep();
      renderSpecs();
      renderTorques();
      if (state.selPart) renderParts();
    });
  }
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') setStep(state.step + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') setStep(state.step - 1);
  });
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener?.('change', applyThemeColors);
  new MutationObserver(applyThemeColors).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
}

// -------------------------------------------------------------------------------------------------- boot
$('#v-w').innerHTML = Object.keys(WIDTHS).map((w) => `<option value="${w}">${w} mm</option>`).join('');
$('#v-d').innerHTML = DEPTHS.map((d) => `<option value="${d}">${d} mm</option>`).join('');
$('#v-bus').innerHTML = Object.entries(BUSBAR).map(([k, b]) => `<option value="${k}">${b.label}</option>`).join('');
wire();
variantNote();
resize();
build();
renderParts();
renderTorques();
renderSpecs();
renderSources();
applyThemeColors();
setStep(state.step, {view: false});
goView(STEPS[state.step].view || 'iso', true);
showTab(location.hash.slice(1));
requestAnimationFrame(frame);
