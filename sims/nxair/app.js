// NXAIR Teardown page: 3D stage + reference rail (steps, parts, torques, specs, sources).
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {
  BASIS, BUSBAR, CABLES, FOUNDATION, ROOM, COMPS, DEPTHS, DIMENSIONS, DOCS, INTERLOCKS, JOINTS, LUBES, MAINT, PARTS, RATINGS, STEPS,
  TOOLS, TORQUE_TABLE, WIDTHS, jointById, partById,
} from './data.js';
import {CB_DATA, PANEL_TYPES, TROUBLE} from './ops.js';
import {boltGeometry, buildPanel, makeMaterials, nutGeometry} from './model.js';
import {BK_PARTS, buildBreaker} from './breaker.js';
import {CB_JOINTS} from './ops.js';
const bkById = Object.fromEntries(BK_PARTS.map((p) => [p.id, p]));
const partInfo = (id) => partById[id] || bkById[id];

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
  mode: 'panel', bkFocus: [], bkEx: 0, bkCut: false, bk: {c: 0, s: 0, count: 0, aux: true}, eswT: 0, slide: 0, lever: 0,
  step: 0, ex: 0, truck: 'service', row: true, cut: false, glass: true, isolate: false, bolts: 'step', labels: true,
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

const cutPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 1e5); // keeps x ≥ 0; look from -x so the front is on the right
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
  cloneMats(subject.parts, partMats);
  function cloneMats(partsMap, partMats) {
  for (const [id, groups0] of Object.entries(partsMap)) {
    const groups = Array.isArray(groups0) ? groups0 : [groups0];
    const cache = new Map();
    for (const g of groups) {
      g.traverse((c) => {
        if (!c.isMesh) return;
        const pid = c.userData.part || id;
        const key = pid + '|' + c.material.uuid;
        if (!cache.has(key)) {
          const m = c.material.clone();
          m.clippingPlanes = [cutPlane]; // clone() copies planes; share the live one
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
  }

  // bolts
  const bolts = {};
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const m4 = new THREE.Matrix4();
  for (const [jid, list] of Object.entries(subject.anchors)) {
    const j = jointById[jid];
    const size = SIZE_KEYS.includes(j?.size) ? j.size : 'M8';
    for (const {group, list: pts, nut} of list) {
      const im = new THREE.InstancedMesh(boltGeometry(size), boltMat[size], pts.length);
      const nm = nut ? new THREE.InstancedMesh(nutGeometry(size), boltMat[size], pts.length) : null;
      pts.forEach(({p, n}, i) => {
        const nn = n.clone().normalize();
        q.setFromUnitVectors(up, nn);
        m4.compose(p, q, new THREE.Vector3(VIS, VIS, VIS));
        im.setMatrixAt(i, m4);
        if (nm) {
          q.setFromUnitVectors(up, nn.clone().negate());
          m4.compose(p.clone().addScaledVector(nn, -nut), q, new THREE.Vector3(VIS, VIS, VIS));
          nm.setMatrixAt(i, m4);
        }
      });
      im.userData = {joint: jid, size, pts};
      group.add(im);
      (bolts[jid] ||= []).push(im);
      if (nm) {
        nm.userData = {joint: jid, size, pts, nut: true};
        group.add(nm);
        (bolts[jid] ||= []).push(nm);
      }
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

  // the stand-alone breaker for the teardown tab
  if (world?.bkHolder) { scene.remove(world.bkHolder); disposeTree(world.bkHolder); }
  const wd = WIDTHS[state.W];
  const bk = buildBreaker(mats, {P: wd.pitch, TD: state.W === 1000 ? 310 : 275, armD: wd.contact === 40 ? 40 : 60, fingers: wd.contact === 40 ? 13 : 26});
  const bkHolder = new THREE.Group();
  bkHolder.scale.setScalar(0.001);
  bk.root.position.z = 90;
  bkHolder.add(bk.root);
  scene.add(bkHolder);
  cloneMats(bk.parts, partMats);

  world = {row, subject, neighbors, bolts, partMats, bk, bkHolder};
  applyMode();
  anim.ex = state.ex;
  anim.truck = truckZ(state.truck);
  applyFocus();
  applyGlass();
  applyCut();
  applyPose(true);
}

// ------------------------------------------------------------------------------------------- pose + looks
const anim = {ex: 0, truck: 0, bkEx: 0, esw: 0, slide: 0, lever: 0};
const truckZ = (t) => (t === 'service' ? 0 : t === 'test' ? 220 : 1150); // 3AE racking travel 220 mm (CB p.57)

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
  // shutters follow the truck; earthing switch, door slide, indicators and lever follow the drill state
  const open = THREE.MathUtils.clamp(1 - anim.truck / 160, 0, 1);
  for (const g of subject.parts.hvdoor || []) for (const c of g.children) {
    if (c.userData.eswSlide) { c.userData.y0 ??= c.position.y; c.position.y = c.userData.y0 + 75 * anim.slide; }
    if (c.userData.eswInd) c.rotation.z = (1 - anim.esw) * Math.PI / 2;
    if (c.userData.truckInd) c.rotation.z = anim.truck > 110 ? Math.PI / 2 : 0;
    if (c.userData.eswLever) { c.visible = anim.lever > 0.02; c.userData.z0 ??= c.position.z; c.position.z = c.userData.z0 + 120 * (1 - anim.lever); c.rotation.z = -Math.PI * anim.esw; }
  }
  if (world.bk) for (const g of Object.values(world.bk.parts)) g.position.copy(g.userData.dir).multiplyScalar(anim.bkEx);
  for (const p of [subject, ...neighbors]) {
    for (const g of p.parts.shutters || []) {
      for (const c of g.children) {
        if (!c.userData.shut) continue;
        c.userData.y0 ??= c.position.y;
        c.position.y = c.userData.y0 + c.userData.shut * 250 * (p === subject ? open : 1);
      }
    }
    for (const g of p.parts.esw || []) g.children.forEach((c) => { if (c.userData.blade) c.rotation.x = -c.userData.closedAngle + 1.25 * (1 - (p === subject ? anim.esw : 0)); });
    if (p !== subject) for (const g of p.parts.breaker || []) g.position.z = 0;
  }
  neighbors.forEach((n, i) => { n.root.visible = state.row && !state.isolate && !(state.cut && i === 0); });
}

function applyFocus() {
  if (!world) return;
  const focus = new Set(state.selPart ? [state.selPart] : state.mode === 'breaker' ? state.bkFocus : state.focus);
  for (const [pid, list] of Object.entries(world.partMats)) {
    const on = focus.has(pid);
    for (const m of list) {
      if (!m.emissive) continue;
      m.emissive.copy(on ? accentColor : new THREE.Color(0));
      m.emissiveIntensity = on ? 0.18 : 0;
    }
  }
  const active = new Set(activeJoints());
  for (const [jid, ims] of Object.entries(world.bolts)) {
    for (const im of ims) {
      const hot = active.has(jid);
      im.visible = hot || state.bolts === 'all' || (jid === 'crane' && state.crane);
      im.material = hot ? boltHot : state.bolts === 'all' ? boltMat[im.userData.size] : boltDim;
      if (state.bolts === 'none' && !hot) im.visible = false;
    }
  }
  renderLabels();
  if (world) applyGlassLite();
}
function applyGlassLite() { if (state.isolate) applyGlass(); }

function applyGlass() {
  if (!world) return;
  const focus = new Set(state.selPart ? [state.selPart] : state.mode === 'breaker' ? state.bkFocus : state.focus);
  const iso = state.isolate && focus.size > 0;
  for (const [pid, list] of Object.entries(world.partMats)) {
    const ghost = iso && !focus.has(pid);
    const glass = !ghost && state.glass && world.subject.shellIds.has(pid) && !(iso && focus.has(pid));
    for (const m of list) {
      if (ghost) { m.transparent = true; m.opacity = 0.045; m.depthWrite = false; }
      else if (glass) { m.transparent = true; m.opacity = 0.13; m.depthWrite = false; }
      else { m.transparent = m.userData.base.transparent; m.opacity = m.userData.base.opacity; m.depthWrite = true; }
      m.needsUpdate = true;
    }
  }
  lineMat.opacity = iso ? 0.16 : 0.32;
  applyPose();
}

function applyCut() {
  cutPlane.constant = (state.mode === 'breaker' ? state.bkCut : state.cut) ? 0 : 1e5;
  applyPose();
}

// -------------------------------------------------------------------------------------------------- views
const VIEWS = {
  iso: {p: [3.7, 2.9, 4.7], t: [0, 1.1, 0]},
  front: {p: [0.25, 1.4, 6.0], t: [0, 1.15, 0]},
  rear: {p: [-2.6, 1.9, -5.0], t: [0, 1.05, -0.2]},
  side: {p: [-5.2, 1.35, 0.1], t: [0, 1.15, 0]},
  top: {p: [0.4, 6.8, 1.6], t: [0, 0.8, 0]},
  low: {p: [2.4, 0.9, 2.7], t: [0, 0.2, 0.1]},
  bus: {p: [-3.3, 3.2, 2.0], t: [0, 1.5, -0.3]},
  cable: {p: [-3.0, 1.15, -2.1], t: [0, 0.6, -0.45]},
};
const BK_VIEWS = {
  iso: {p: [1.55, 1.05, 1.75], t: [0, 0.36, 0]},
  front: {p: [0.15, 0.5, 2.3], t: [0, 0.38, 0]},
  side: {p: [-2.1, 0.5, 0.05], t: [0, 0.38, 0]},
  rear: {p: [-1.3, 1.0, -1.7], t: [0, 0.38, -0.1]},
  top: {p: [0.2, 2.4, 0.5], t: [0, 0.3, 0]},
  vi: {p: [-0.62, 0.43, -0.05], t: [0, 0.39, -0.04]},
};
VIEWS.door = {p: [0.75, 0.85, 2.15], t: [0.07, 0.6, 0.6]};
VIEWS.eswCut = {p: [-3.0, 0.95, -0.2], t: [0, 0.6, -0.25]};
const VIEW_BUTTONS = [['iso', '3/4'], ['front', 'Front'], ['side', 'Side'], ['rear', 'Rear'], ['top', 'Top']];
let camTween = null;
function goView(name, instant) {
  const bkMode = state.mode === 'breaker';
  const v = (bkMode ? BK_VIEWS[name] : VIEWS[name]) || (bkMode ? BK_VIEWS.iso : VIEWS.iso);
  const k = state.W / 800;
  const to = new THREE.Vector3(...v.p).multiplyScalar(name === 'top' || bkMode || name === 'door' ? 1 : 0.85 + 0.15 * k);
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
// Tags: bolt-joint tags ("11× M8 · 25 Nm") for the active joints, part-name tags for the focused / selected parts.
// Each tag anchors to the visible instance (or part centre) nearest its centroid; tags are nudged apart on screen.
function activeJoints() {
  if (state.mode === 'breaker') return [];
  if (state.selJoint) return [state.selJoint];
  if (state.selPart) return partInfo(state.selPart)?.joints || [];
  return state.joints;
}
function activeTagParts() {
  if (state.mode === 'breaker') {
    if (state.selPart) return [state.selPart];
    if (state.bkFocus.length) return state.bkFocus;
    return state.bkEx > 0.3 ? BK_PARTS.map((p) => p.id) : [];
  }
  if (state.selPart) return [state.selPart];
  return state.joints.length ? [] : state.focus.filter((id) => partById[id]);
}
function renderLabels() {
  if (!world) return;
  const html = [];
  if (state.labels) {
    for (const jid of activeJoints()) {
      const ims = world.bolts[jid];
      if (!ims) continue;
      const n = ims.filter((im) => !im.userData.nut).reduce((a, im) => a + im.count, 0);
      html.push(`<div class="tag" data-j="${jid}">${jointLabel(jointById[jid], n)}</div>`);
    }
    for (const pid of activeTagParts()) html.push(`<div class="tag part" data-p="${pid}">${esc(partInfo(pid)?.name || pid)}</div>`);
  }
  labelLayer.innerHTML = html.join('');
  labelFrame = 0;
}
let labelFrame = 0;
const partCentre = new Map();
const tmpBox = new THREE.Box3();
function partAnchor(pid) {
  const groups = bkById[pid] ? [world.bk.parts[pid]] : world.subject.parts[pid] || [];
  tmpBox.makeEmpty();
  for (const g of groups) if (g && g.visible !== false) tmpBox.expandByObject(g);
  if (tmpBox.isEmpty()) return null;
  const c = tmpBox.getCenter(new THREE.Vector3());
  const cutOn = state.mode === 'breaker' ? state.bkCut : state.cut;
  if (cutOn && c.x < 0) c.x = Math.min(tmpBox.max.x, 0.002);
  return c;
}
function toScreen(v, w, h) {
  const p = v.clone().project(camera);
  if (p.z > 1 || Math.abs(p.x) > 1.02 || Math.abs(p.y) > 1.02) return null;
  return {x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h};
}
function placeLabels() {
  if (!world || !state.labels || !labelLayer.children.length) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  const cutOn = state.mode === 'breaker' ? state.bkCut : state.cut;
  // part centres are costly: refresh every 8th frame
  if (labelFrame++ % 8 === 0) for (const el of labelLayer.children) if (el.dataset.p) partCentre.set(el.dataset.p, partAnchor(el.dataset.p));
  const placed = [];
  for (const el of labelLayer.children) {
    let at = null;
    if (el.dataset.j) {
      const ims = (world.bolts[el.dataset.j] || []).filter((im) => !im.userData.nut && im.visible);
      // candidates: every instance that is not cut away and is on screen; keep the one nearest the centroid
      const cands = [];
      for (const im of ims) {
        if (!im.parent?.visible) continue;
        for (const {p} of im.userData.pts) {
          const v = im.parent.localToWorld(p.clone());
          if (cutOn && v.x < -0.0005) continue;
          const sp = toScreen(v, w, h);
          if (sp) cands.push(sp);
        }
      }
      if (cands.length) {
        const cx = cands.reduce((a, c) => a + c.x, 0) / cands.length, cy = cands.reduce((a, c) => a + c.y, 0) / cands.length;
        at = cands.reduce((b, c) => ((c.x - cx) ** 2 + (c.y - cy) ** 2 < (b.x - cx) ** 2 + (b.y - cy) ** 2 ? c : b));
      }
    } else if (el.dataset.p) {
      const c = partCentre.get(el.dataset.p);
      if (c) at = toScreen(c, w, h);
    }
    el.hidden = !at;
    if (!at) continue;
    // nudge up until it does not overlap an already placed tag
    const tw = el.offsetWidth || 120, th = (el.offsetHeight || 20) + 4;
    let y = at.y;
    for (let k = 0; k < 12; k++) {
      const hit = placed.find((r) => Math.abs(r.x - at.x) < (r.w + tw) / 2 && Math.abs(r.y - y) < th);
      if (!hit) break;
      y = hit.y - th;
    }
    placed.push({x: at.x, y, w: tw});
    el.style.left = `${Math.min(w - tw / 2 - 6, Math.max(tw / 2 + 6, at.x))}px`;
    el.style.top = `${Math.max(th + 4, y)}px`;
    el.style.setProperty('--lead', `${Math.max(10, at.y - Math.max(th + 4, y) + 10)}px`);
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
  const hits = ray.intersectObject(state.mode === 'breaker' ? world.bk.root : world.subject.root, true);
  for (const h of hits) {
    if ((state.mode === 'breaker' ? state.bkCut : state.cut) && h.point.x < -0.0005) continue;
    let o = h.object;
    if (!o.visible || o.isLineSegments) continue;
    let hidden = false;
    for (let p = o; p; p = p.parent) if (p.visible === false) hidden = true;
    if (hidden) continue;
    if (o.isInstancedMesh) return {joint: o.userData.joint};
    const pid = o.userData.part;
    if (state.glass && world.subject.shellIds.has(pid)) continue;
    if (pid) return {part: pid, label: o.userData.label || o.parent?.userData?.label};
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
  else if (hit?.part && bkById[hit.part]) { state.selLabel = hit.label || null; selectBk(hit.part); }
  else if (hit?.part && partById[hit.part]) { state.selLabel = hit.label || null; selectPart(hit.part, true); }
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
  else if (hit?.part && partInfo(hit.part)) txt = hit.label && hit.label !== partInfo(hit.part).name ? `${hit.label} · ${partInfo(hit.part).name}` : partInfo(hit.part).name;
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
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  const kEx = reduced ? 1 : 1 - Math.exp(-dt * 6);
  const tz = truckZ(state.truck);
  if (Math.abs(anim.ex - state.ex) > 1e-4 || Math.abs(anim.truck - tz) > 0.5) {
    anim.ex += (state.ex - anim.ex) * kEx;
    anim.truck += (tz - anim.truck) * (reduced ? 1 : 1 - Math.exp(-dt * 3.5));
    applyPose();
  }
  // drill + breaker animations
  const kd = reduced ? 1 : 1 - Math.exp(-dt * 4);
  let moved = false;
  for (const [a, b] of [['bkEx', 'bkEx'], ['esw', 'eswT'], ['slide', 'slide'], ['lever', 'lever']]) {
    if (Math.abs(anim[a] - state[b]) > 1e-3) { anim[a] += (state[b] - anim[a]) * (a === 'esw' ? (reduced ? 1 : 1 - Math.exp(-dt * 2.2)) : kd); moved = true; }
  }
  if (moved) applyPose();
  bkTick(now, dt);
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
// across-flats per ISO 4017 / ISO 4032, wrench ranges from the manual's tool list (I §5.10)
const TOOL = {
  M8: '13 mm socket / ring spanner · torque wrench 20–70 Nm (8–20 Nm for small values)',
  M10: '16 mm socket / ring spanner · torque wrench 8–20 Nm',
  M12: '18 mm socket / ring spanner, counter-hold the nut · torque wrench 20–70 Nm',
  M16: '24 mm socket · driver or wrench for 110 Nm',
};
const sizeOf = (j) => (SIZE_KEYS.includes(j.size) ? j.size : 'MX');
function jointRow(j, {sel} = {}) {
  let bolt = j.bolt;
  if (j.id === 'busbar') bolt = `${BUSBAR[state.bus].bolt} (busbar ${BUSBAR[state.bus].label}, bag ${BUSBAR[state.bus].bag})`;
  const tq = j.t != null
    ? `<div class="n">${j.t}<small>Nm</small></div>${j.tol ? `<div class="c">${esc(j.tol)}</div>` : ''}${j.c != null ? `<div class="c">check ${j.c} Nm</div>` : ''}`
    : `<div class="n" style="font-size:15px">${j.ref_t ? esc(j.ref_t) : '—'}</div>`;
  const has3d = !!(world?.bolts[j.id]);
  return `<button class="jrow${sel ? ' sel' : ''}" data-joint="${j.id}" type="button" title="${has3d ? 'Show in 3D' : 'No 3D position for this joint'}">
    <span class="bar ${sizeOf(j)}"></span>
    <span style="min-width:0">
      <span class="w">${esc(j.where)}</span>
      <span class="spec" style="display:block"><b>${esc(j.qty)}</b> · ${esc(bolt)}${j.wash && j.wash !== '—' ? ` · ${esc(j.wash)}` : ''}</span>
      ${j.note ? `<span class="note" style="display:block">${esc(j.note)}</span>` : ''}
      ${TOOL[j.size] ? `<span class="spec" style="display:block">Tool: ${esc(TOOL[j.size])}</span>` : ''}
      <span class="ref" style="display:block;margin-top:3px">${esc(j.ref)}${has3d ? ' · <span style="color:var(--accent-ink)">shown in 3D</span>' : ''}</span>
    </span>
    <span class="tq">${tq}<span class="badge ${j.basis}" title="${esc(BASIS[j.basis].tip)}">${esc(BASIS[j.basis].label)}</span></span>
  </button>`;
}

// ---------------------------------------------------------------- tabs + hash routing
const TABS = ['steps', 'breaker', 'parts', 'torques', 'specs', 'sources'];
function showTab(name) {
  if (!TABS.includes(name)) name = 'steps';
  const mode = name === 'breaker' ? 'breaker' : 'panel';
  if (mode !== state.mode) { state.mode = mode; applyMode(); goView(mode === 'breaker' ? 'iso' : STEPS[state.step].view || 'iso'); }
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
    ${s.drill ? drillHtml(s.drill) : ''}
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
  state.eswT = s.esw ?? (state.truck === 'service' ? 0 : 1);
  state.slide = 0;
  state.lever = 0;
  drill = null;
  state.row = s.row ?? true;
  state.cut = !!s.cut;
  state.crane = !!s.crane;
  state.focus = s.focus || [];
  state.joints = s.joints || [];
  state.selJoint = null;
  state.selPart = null;
  state.isolate = false;
  applyGlass();
  syncTools();
  applyCut();
  applyPose();
  applyFocus();
  if (view) goView(s.view || 'iso');
  renderStep();
  syncSelection();
}

// ---------------------------------------------------------------- parts
function componentsOf(id) {
  const set = new Set();
  for (const g of world?.subject.parts[id] || []) g.traverse((c) => { if (c.isMesh && !c.isInstancedMesh && c.userData.label) set.add(c.userData.label); });
  return [...set];
}
function renderParts() {
  const sel = state.selPart && partById[state.selPart];
  const card = sel
    ? `<div class="pcard"><span class="eyebrow">${esc(COMPS[sel.comp].name)}</span><h2>${esc(sel.name)}</h2>${state.selLabel && state.selLabel !== sel.name ? `<p class="small"><b>Clicked:</b> ${esc(state.selLabel)}</p>` : ''}<p>${esc(sel.desc)}</p>
       ${sel.facts ? `<table class="kv small" style="margin-top:8px">${sel.facts.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}
       ${componentsOf(sel.id).length ? `<h3>Components in this assembly</h3><ul class="plain small comps">${componentsOf(sel.id).map((l) => `<li${l === state.selLabel ? ' style="color:var(--accent-ink);font-weight:600"' : ''}>${esc(l)}</li>`).join('')}</ul>` : ''}
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
function framePart(id) {
  const box = new THREE.Box3();
  const gs = bkById[id] ? [world?.bk.parts[id]] : world?.subject.parts[id] || [];
  for (const g of gs) if (g && g.visible !== false) box.expandByObject(g);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(0.25, box.getSize(new THREE.Vector3()).length() * 0.5);
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = r / Math.sin((camera.fov * Math.PI) / 360) * 0.95;
  camTween = {t0: performance.now(), dur: 800, p0: camera.position.clone(), t0v: controls.target.clone(), p1: c.clone().addScaledVector(dir, dist), t1: c};
}
function selectPart(id, fromStage) {
  if (!fromStage) state.selLabel = null;
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
    <h3>Foundation drawing (110-2300.9)</h3><div class="scroll-x"><table class="grid4"><thead><tr>${FOUNDATION[0].map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${FOUNDATION.slice(1).map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="small muted">All mm. The model's floor shows the 40 kA / 1500 mm cut-outs for the chosen width.</p>
    <h3>Room</h3>${kv(ROOM)}
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
    <h3>Circuit-breaker 3AE</h3>${kv(CB_DATA)}
    <h3>Troubleshooting</h3>${kv(TROUBLE)}
    <h3>Other panel types</h3>${kv(PANEL_TYPES)}
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
      <li>The panel geometry follows the dimension drawing 110-2300.9 (internal split, compartment heights, LV box, floor cut-outs) and the catalog section. Breaker geometry uses the 3AE manual (pole centres, terminal distance, contact arm Ø, 13 / 26 tulip fingers, 220 mm racking travel). Shapes of poles, CTs, VTs and mechanisms are simplified.</li>
      <li>Two torque regimes exist: panel joints with dry threads (M8 30 / 25, M12 70, M16 110 Nm) and breaker contact-arm joints with greased threads (M12 40 ±4, M16 100 ±10 Nm). Each row says which.</li>
      <li>A badge marks how each torque is known. "Maker of part" and "Not stated" rows need the part supplier's figure.</li>
      <li>The order documents, dimension drawings 110-2300.9 and the circuit diagrams of your switchgear take precedence over this page.</li>
    </ul>
    <p class="small muted">Independent study aid built from Siemens' publicly available documentation. Not a Siemens publication. Work on medium-voltage switchgear only as qualified personnel under the five safety rules.</p>`;
}


// ================================================================================ mode, interlocks, toast
function applyMode() {
  if (!world) return;
  world.row.visible = state.mode === 'panel';
  world.bkHolder.visible = state.mode === 'breaker';
  for (const id of ['truckSeg', 'boltSeg', 'eswSeg']) { const el = $('#' + id); if (el) el.hidden = state.mode === 'breaker'; }
  $('#t-row').hidden = state.mode === 'breaker';
  applyCut();
  applyFocus();
  applyGlass();
  syncTools();
}
let toastT = 0;
function toast(msg, kind = 'warn') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast ' + kind;
  el.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { el.hidden = true; }, 4200);
}
function rackTo(pos) {
  if (pos === state.truck) return true;
  if (pos === 'service' && state.eswT > 0.5) { toast('Interlocked: the feeder earthing switch is CLOSED. De-earth it before racking to service (O §7.1).'); return false; }
  if (state.lever > 0.5) { toast('Interlocked: remove the earthing-switch lever first.'); return false; }
  if (state.bk.s > 0.5 && state.mode === 'panel') { /* the panel breaker is shown OPEN in the panel view */ }
  state.truck = pos;
  syncTools();
  applyPose();
  return true;
}

// quick earthing-switch operation from the toolbar: the same interlocks and the same lever sequence, played in one go
let eswBusy = false;
function setEsw(cmd) {
  if (cmd === 'howto') {
    const i = STEPS.findIndex((x) => x.id === 'earthing');
    location.hash = 'steps';
    setStep(i);
    drill = {dir: state.eswT > 0.5 ? 'deearth' : 'earth', i: 0};
    renderStep();
    requestAnimationFrame(() => document.querySelector('.drill')?.scrollIntoView({block: 'start'}));
    return;
  }
  const want = cmd === 'closed' ? 1 : 0;
  if (eswBusy) return toast('The earthing switch is being operated.');
  if (Math.abs(state.eswT - want) < 0.5) return toast(want ? 'The feeder is already earthed (indicator vertical I).' : 'The earthing switch is already open (indicator horizontal).', 'ok');
  if (state.truck === 'service') return toast('Interlocked: the earthing switch can only be operated with the breaker in TEST position. Click Test first (racking needs the breaker OPEN).');
  eswBusy = true;
  toast(want ? 'Earthing: slide up, lever in (pins horizontal), 180° clockwise, lever out, slide down. Indicator turns vertical I.' : 'De-earthing: slide up, lever in (pins horizontal), 180° counter-clockwise, lever out, slide down. Indicator turns horizontal.', 'ok');
  const seq = [[0, () => { state.slide = 1; }], [500, () => { state.lever = 1; }], [1100, () => { state.eswT = want; }], [2900, () => { state.lever = 0; }], [3400, () => { state.slide = 0; eswBusy = false; syncTools(); }]];
  for (const [ms, f] of seq) setTimeout(() => { f(); applyPose(); }, reduced ? 0 : ms);
  syncTools();
}

// ================================================================================ earthing-switch drill
let drill = null; // {dir, i}
const DRILL = {
  earth: [
    {t: 'Check: breaker in TEST position, HV door closed, feeder isolated at the far end too.', view: 'door', act() { if (state.truck === 'service') { rackTo('test'); return 'The breaker was in service, where the earthing switch is interlocked. Racked to test first.'; } }},
    {t: 'Lift the operating slide (15) and hold it. The actuating opening (14) is uncovered.', view: 'door', act() { state.slide = 1; }},
    {t: 'Insert the operating lever slightly with its pins horizontal, then push it fully in.', view: 'door', act() { state.lever = 1; }},
    {t: 'Hold it straight and turn 180° clockwise in one movement. The drive rod turns the shaft in the connection compartment and the knife blades snap onto the fixed contacts.', view: 'eswCut', cut: true, act() { state.eswT = 1; }},
    {t: 'Pull the lever out (never mid-turn).', view: 'door', act() { state.lever = 0; }},
    {t: 'Push the slide down and fit the padlock. Indicator (16) shows a vertical I: the feeder is earthed. Racking to service is now interlocked.', view: 'door', act() { state.slide = 0; }},
  ],
  deearth: [
    {t: 'Check: breaker in TEST position, HV door closed, work finished and people clear.', view: 'door', act() { if (state.truck === 'service') return 'Breaker is in service position: the earthing switch cannot be operated.'; }},
    {t: 'Remove the padlock, lift the operating slide and hold it.', view: 'door', act() { state.slide = 1; }},
    {t: 'Insert the operating lever with its pins horizontal and push it fully in.', view: 'door', act() { state.lever = 1; }},
    {t: 'Turn 180° counter-clockwise in one movement. The blades swing away from the fixed contacts.', view: 'eswCut', cut: true, act() { state.eswT = 0; }},
    {t: 'Pull the lever out.', view: 'door', act() { state.lever = 0; }},
    {t: 'Push the slide down, padlock. Indicator horizontal: feeder not earthed. The breaker may now be racked to service.', view: 'door', act() { state.slide = 0; }},
  ],
};
function drillHtml() {
  const dir = drill?.dir || (state.eswT > 0.5 ? 'deearth' : 'earth');
  const list = DRILL[dir];
  const i = drill?.i ?? 0;
  return `<div class="drill">
    <h3>Do it on the model</h3>
    <div class="seg" role="group" aria-label="Operation">
      <button type="button" data-drilldir="earth" aria-pressed="${dir === 'earth'}">Earth</button>
      <button type="button" data-drilldir="deearth" aria-pressed="${dir === 'deearth'}">De-earth</button>
    </div>
    <ol class="dsteps">${list.map((d, k) => `<li class="${k < i ? 'done' : k === i ? 'on' : ''}">${esc(d.t)}</li>`).join('')}</ol>
    <div class="row">
      <button type="button" class="btn primary" data-drill="next" ${i >= list.length ? 'disabled' : ''}>${i >= list.length ? 'Done' : `Do step ${i + 1}`}</button>
      <button type="button" class="btn" data-drill="reset">Restart</button>
      <button type="button" class="btn" data-drill="try">Try racking to service</button>
    </div>
    <p class="small muted" id="drillNote">${esc(drill?.note || 'The 3D view follows each action: slide, lever, 180° turn, blades, indicator.')}</p>
  </div>`;
}
function drillAct(cmd) {
  if (cmd === 'reset') { drill = {dir: drill?.dir || (state.eswT > 0.5 ? 'deearth' : 'earth'), i: 0}; state.slide = 0; state.lever = 0; renderStep(); goView('door'); return; }
  if (cmd === 'try') { if (rackTo('service')) { toast('Racked to service: possible because the earthing switch is OPEN.', 'ok'); } renderStep(); return; }
  drill ||= {dir: state.eswT > 0.5 ? 'deearth' : 'earth', i: 0};
  const list = DRILL[drill.dir];
  const d = list[drill.i];
  if (!d) return;
  if (drill.dir === 'deearth' && drill.i === 0 && state.truck === 'service') { toast('Earthing switch not operable in service position.'); }
  drill.note = d.act() || `Step ${drill.i + 1} done.`;
  state.cut = !!d.cut;
  state.isolate = false;
  applyCut();
  syncTools();
  goView(d.view);
  drill.i++;
  if (drill.i >= list.length) drill.note = drill.dir === 'earth' ? 'Feeder earthed. Try racking to service: the interlock blocks it.' : 'Feeder de-earthed. Racking to service is possible again.';
  renderStep();
}

// ================================================================================ breaker tab
const BK_TEAR = [
  {t: 'Make it safe and take it out', field: true, ex: 0, focus: ['bkTruck'], view: 'iso', text: 'Breaker OPEN, test position, auxiliary voltage off. Discharge the closing spring: OPEN – CLOSE – OPEN with the push rod. Unplug the LV connector, take the breaker out with the service truck (2 locking levers out, pull to the end stop, levers in, unlocking levers up).'},
  {t: 'Contact systems (tulips) off', field: true, ex: 0.35, focus: ['bkTulips'], view: 'rear', text: 'Unscrew each contact system from its threaded rod (6 per breaker). Reassembly: fingers greased both sides with Molykote Longterm 2, round outer edge towards the arm, 40 ±4 Nm (M12) / 100 ±10 Nm (M16), greased threads.'},
  {t: 'Contact arms off', field: true, ex: 0.45, focus: ['bkArms'], view: 'rear', text: 'Unscrew the arms and threaded rods from the pole terminals. Reassembly: threaded rod greased with Vaseline, screw-in depth upper 20 ±1 mm, lower 28 ±1 mm (38 ±1 mm at 40 kA), 40 ±4 / 100 ±10 Nm. Copper end faces roughened, cleaned, Vaseline; silver-plated faces cleaned, Vaseline.'},
  {t: 'Covers off: see the mechanism', field: true, ex: 0.5, focus: ['bkCover', 'bkLV'], view: 'iso', text: '3AE1: cover and side panels each held by 4 Phillips pan-head screws ISO 7045 (driver size 3), 4 ±0.4 Nm. PG-fitting plate: Torx 20 self-tapping, 3 ±0.3 Nm, single use. Only with the closing spring discharged.'},
  {t: 'Operating mechanism', field: false, ex: 0.75, focus: ['bkMotor', 'bkClosingSpring', 'bkShaft', 'bkOpeningSpring', 'bkReleases', 'bkAux'], view: 'iso', text: 'Shown for understanding. The mechanism is maintenance-free up to 10 000 cycles; adjustment and parts replacement (motor, releases, switches) follow the 3AE instructions and Siemens service.'},
  {t: 'Poles', field: false, ex: 0.85, focus: ['bkShell', 'bkUpper', 'bkLower', 'bkRods'], view: 'rear', text: 'Pole shell, pole heads, lower connections with flexible conductor, insulating operating rods with contact-pressure springs. Factory-assembled and set; not dismantled in the field.'},
  {t: 'Inside the vacuum interrupter', field: false, ex: 0, iso: true, focus: ['bkVI', 'bkVIin', 'bkRods', 'bkUpper', 'bkLower'], view: 'vi', cut: true, text: 'Section through the middle pole. Sealed for life: the interrupter is replaced, never opened. Internals drawn generically: ceramic body, vapour shield, fixed and moving contact discs, bellows.'},
];
let bkSel = null;
function renderBreaker() {
  const wd = WIDTHS[state.W];
  const P = wd.pitch, TD = state.W === 1000 ? 310 : 275, arm = wd.contact === 40 ? 40 : 60, fingers = wd.contact === 40 ? 13 : 26;
  const sel = bkSel && bkById[bkSel];
  const groups = [...new Set(BK_PARTS.map((p) => p.grp))];
  const comps = sel ? componentsOfBk(sel.id) : [];
  $('#pane-breaker').innerHTML = `
    <span class="eyebrow">SION 3AE5 · withdrawable · ${P} mm pole centres · ${TD} mm terminal distance · arms Ø ${arm} · ${fingers}-finger tulips</span>
    <h2>How the breaker works</h2>
    <ol class="body how">
      <li><b>Charge.</b> The motor (or ≈ 50 turns of the hand crank) winds the closing spring through the gear unit until it latches. The motor switches off; the indicator shows CHARGED. Takes < 15 s.</li>
      <li><b>Close.</b> The closing solenoid -Y9 (or the CLOSE button) frees the latch. The spring turns the main shaft; one lever per pole pushes an insulating rod up and the moving contact meets the fixed contact inside the vacuum. The last bit of travel compresses the contact-pressure springs, and the same movement charges the opening spring. Closing < 75 ms. The motor at once recharges the closing spring, so the breaker now stores OPEN – CLOSE – OPEN.</li>
      <li><b>Open.</b> The shunt release -Y1 (protection trip, OPEN button, undervoltage release) frees the opening latch. The opening spring snaps the shaft back and pulls the contacts apart: opening < 65 ms, break time < 80 ms. Trip-free: an OPEN command always wins.</li>
      <li><b>Interrupt.</b> The arc burns in metal vapour from the contacts. At the next current zero it goes out; the vapour condenses on the shield and the vacuum gap withstands the returning voltage within microseconds. Arcing < 15 ms.</li>
    </ol>
    <div class="cycle">
      <div class="row">
        <button type="button" class="btn" data-bk="charge">Charge spring</button>
        <button type="button" class="btn ok" data-bk="close">CLOSE</button>
        <button type="button" class="btn bad" data-bk="open">OPEN</button>
        <button type="button" class="btn primary" data-bk="play">Play O – 0.3 s – CO</button>
      </div>
      <label class="small check"><input type="checkbox" id="bkAux" ${state.bk.aux ? 'checked' : ''}> Auxiliary voltage on (motor recharges after closing)</label>
      <div class="readout" id="bkRead"></div>
    </div>
    <p class="small muted">Slow motion. Readouts show the real times from the 3AE manual. Contact travel is drawn larger than life; Siemens publishes no stroke. Use Cut for a section through the middle pole.</p>
    <h3>Teardown</h3>
    <ol class="tear">${BK_TEAR.map((x, k) => `<li><button type="button" class="tearbtn" data-tear="${k}"><span class="tt">${esc(x.t)}</span><span class="badge ${x.field ? 'step' : 'none'}">${x.field ? 'Field work' : 'Siemens only'}</span></button><div class="small">${esc(x.text)}</div></li>`).join('')}</ol>
    ${sel ? `<div class="pcard" style="margin-top:14px"><span class="eyebrow">${esc(sel.grp)}</span><h2>${esc(sel.name)}</h2>${state.selLabel && state.selLabel !== sel.name ? `<p class="small"><b>Clicked:</b> ${esc(state.selLabel)}</p>` : ''}<p>${esc(sel.desc)}</p>${comps.length ? `<h3>Components</h3><ul class="plain small">${comps.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}</div>` : ''}
    <h3>Parts</h3>
    ${groups.map((g) => `<div class="group-h">${esc(g)}</div><div class="plist">${BK_PARTS.filter((p) => p.grp === g).map((p) => `<button type="button" data-bkpart="${p.id}" class="${bkSel === p.id ? 'sel' : ''}"><span class="sw" style="background:var(--copper)"></span>${esc(p.name)}</button>`).join('')}</div>`).join('')}
    <h3>Fasteners on the breaker</h3><div class="joints">${CB_JOINTS.map((j) => jointRow(j)).join('')}</div>
    <h3>Breaker data</h3>${kv(CB_DATA)}`;
  renderBreakerReadout();
}
function componentsOfBk(id) {
  const set = new Set();
  world?.bk.parts[id]?.traverse((c) => { if (c.isMesh && c.userData.label) set.add(c.userData.label); });
  return [...set];
}
function selectBk(id) {
  bkSel = id;
  state.selPart = id;
  state.isolate = true;
  applyFocus();
  applyGlass();
  syncTools();
  location.hash = 'breaker';
  renderBreaker();
}

// ---------------------------------------------------------------- breaker cycle engine
const bkQueue = [];
let bkCur = null;
let bkLast = 'Closing spring discharged, breaker open. Press Charge spring.';
const BK_ACT = {
  charge: {dur: 2.6, real: 15, unit: 's', max: '< 15 s', label: 'Charging the closing spring'},
  close: {dur: 1.5, real: 75, unit: 'ms', max: '< 75 ms', label: 'Closing', pulse: 'close'},
  open: {dur: 1.2, real: 65, unit: 'ms', max: '< 65 ms', label: 'Opening', pulse: 'open'},
  dead: {dur: 0.9, real: 300, unit: 'ms', max: '0.3 s dead time', label: 'Dead time'},
};
function bkPredict() {
  // state after everything queued
  let {c, s} = state.bk;
  for (const a of [bkCur, ...bkQueue].filter(Boolean)) {
    if (a.kind === 'charge') c = 1;
    if (a.kind === 'close') { c = 0; s = 1; }
    if (a.kind === 'open') s = 0;
  }
  return {c, s};
}
function bkDo(kind) {
  if (kind === 'play') {
    if (bkCur || bkQueue.length) return toast('Wait for the running operation.');
    const {c, s} = state.bk;
    if (c < 0.99) bkQueue.push({kind: 'charge'});
    if (s < 0.5) { bkQueue.push({kind: 'close'}); bkQueue.push({kind: 'charge'}); }
    else if (c < 0.99 || bkQueue.length) bkQueue.push({kind: 'charge'});
    bkQueue.push({kind: 'open'}, {kind: 'dead'}, {kind: 'close', noAuto: true}, {kind: 'open'});
    return;
  }
  if (bkCur || bkQueue.length) return toast('Wait for the running operation.');
  const {c, s} = bkPredict();
  if (kind === 'charge' && c > 0.99) return toast('The closing spring is already charged.', 'ok');
  if (kind === 'close' && s > 0.5) return toast('The breaker is already closed.', 'ok');
  if (kind === 'close' && c < 0.99) return toast('Closing blocked: the closing spring is not charged. Charge it first.');
  if (kind === 'open' && s < 0.5) return toast('The breaker is already open.', 'ok');
  bkQueue.push({kind});
}
let bkReadT = 0;
function bkTick(now, dt) {
  if (!world?.bk) return;
  if (!bkCur && bkQueue.length) {
    bkCur = {...bkQueue.shift(), t0: now, from: {...state.bk}, motor: 0};
    if (bkCur.kind === 'close' && state.bk.c < 0.99) { toast('Closing blocked: spring not charged.'); bkCur = null; return; }
  }
  if (!bkCur) return;
  const A = BK_ACT[bkCur.kind];
  const u = Math.min(1, (now - bkCur.t0) / 1000 / (reduced ? 0.2 : A.dur));
  const m = THREE.MathUtils.clamp((u - 0.2) / 0.8, 0, 1); // movement after the release pulse
  let c = state.bk.c, sv = state.bk.s, pClose = 0, pOpen = 0;
  if (bkCur.kind === 'charge') { c = bkCur.from.c + (1 - bkCur.from.c) * u; bkCur.motor += dt * 40; }
  if (bkCur.kind === 'close') { pClose = Math.sin(Math.min(1, u / 0.2) * Math.PI); const e = m * m; sv = e; c = 1 - e; }
  if (bkCur.kind === 'open') { pOpen = Math.sin(Math.min(1, u / 0.2) * Math.PI); const e = 1 - (1 - m) * (1 - m); sv = 1 - e; }
  world.bk.pose({c, s: sv, motor: bkCur.motor, pClose, pOpen});
  const realT = bkCur.kind === 'charge' ? u * A.real : bkCur.kind === 'dead' ? u * A.real : m * A.real;
  bkCur.live = `${A.label} … ${A.unit === 's' ? realT.toFixed(1) : Math.round(realT)} ${A.unit} (${A.max})`;
  if (u >= 1) {
    state.bk.c = c; state.bk.s = sv;
    if (bkCur.kind === 'close') { state.bk.count++; bkLast = 'Closed. Contacts pressed by the contact-pressure springs; opening spring charged.'; if (state.bk.aux && !bkCur.noAuto && !bkQueue.length) bkQueue.unshift({kind: 'charge'}); }
    if (bkCur.kind === 'open') bkLast = 'Opened. Arc extinguished at current zero (arcing < 15 ms, break time < 80 ms).';
    if (bkCur.kind === 'charge') bkLast = 'Closing spring charged and latched; motor switched off by -S21/-S22.';
    bkCur = null;
    renderBreakerReadout();
    return;
  }
  if (now - bkReadT > 90) { bkReadT = now; renderBreakerReadout(); }
}
function renderBreakerReadout() {
  const el = $('#bkRead');
  if (!el) return;
  const {c, s, count} = state.bk;
  const live = bkCur?.live;
  const springTxt = bkCur?.kind === 'charge' ? 'charging' : c > 0.99 ? 'CHARGED' : 'DISCHARGED';
  const contactTxt = bkCur && (bkCur.kind === 'close' || bkCur.kind === 'open') ? 'moving' : s > 0.5 ? 'CLOSED (I)' : 'OPEN (O)';
  el.innerHTML = `
    <div><span>Closing spring</span><b class="${c > 0.99 ? 'okc' : ''}">${springTxt}</b></div>
    <div><span>Contacts</span><b class="${s > 0.5 ? 'badc' : 'okc'}">${contactTxt}</b></div>
    <div><span>Opening spring</span><b>${s > 0.5 ? 'charged' : 'released'}</b></div>
    <div><span>Operations counter</span><b>${count}</b></div>
    <div class="wide"><span>Now</span><b>${esc(live || bkLast)}</b></div>`;
}

// -------------------------------------------------------------------------------------------- tools wiring
function syncTools() {
  for (const b of document.querySelectorAll('[data-truck]')) b.setAttribute('aria-pressed', String(b.dataset.truck === state.truck));
  for (const b of document.querySelectorAll('[data-esw]')) b.setAttribute('aria-pressed', String(b.dataset.esw === (state.eswT > 0.5 ? 'closed' : 'open')));
  $('#ex').value = String(Math.round((state.mode === 'breaker' ? state.bkEx : state.ex) * 100));
  $('#t-cut').setAttribute('aria-pressed', String(state.mode === 'breaker' ? state.bkCut : state.cut));
  $('#t-row').setAttribute('aria-pressed', String(state.row));
  $('#t-glass').setAttribute('aria-pressed', String(state.glass));
  $('#t-iso').setAttribute('aria-pressed', String(state.isolate));
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
  document.addEventListener('change', (e) => { if (e.target.id === 'bkAux') state.bk.aux = e.target.checked; });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.view) goView(t.dataset.view);
    else if (t.dataset.truck) rackTo(t.dataset.truck);
    else if (t.dataset.esw) setEsw(t.dataset.esw);
    else if (t.dataset.bolts) { state.bolts = t.dataset.bolts; syncTools(); applyFocus(); }
    else if (t.id === 't-cut') { if (state.mode === 'breaker') state.bkCut = !state.bkCut; else state.cut = !state.cut; applyCut(); syncTools(); }
    else if (t.id === 't-row') { state.row = !state.row; applyPose(); syncTools(); }
    else if (t.id === 't-glass') { state.glass = !state.glass; applyGlass(); syncTools(); }
    else if (t.id === 't-iso') { state.isolate = !state.isolate; applyGlass(); syncTools(); }
    else if (t.id === 't-lab') { state.labels = !state.labels; renderLabels(); syncTools(); }
    else if (t.dataset.drill) drillAct(t.dataset.drill);
    else if (t.dataset.drilldir) { drill = {dir: t.dataset.drilldir, i: 0}; renderStep(); }
    else if (t.dataset.bk) bkDo(t.dataset.bk);
    else if (t.dataset.bkpart) { selectBk(t.dataset.bkpart); framePart(t.dataset.bkpart); }
    else if (t.dataset.tear) {
      const x = BK_TEAR[+t.dataset.tear];
      bkSel = null; state.selPart = null; state.bkFocus = x.focus; state.bkEx = x.ex; state.bkCut = !!x.cut; state.isolate = !!x.iso;
      applyCut(); applyFocus(); applyGlass(); syncTools(); goView(x.view); renderBreaker();
      for (const b of document.querySelectorAll('.tearbtn')) b.classList.toggle('on', b.dataset.tear === t.dataset.tear);
    }
    else if (t.id === 'prev') setStep(state.step - 1);
    else if (t.id === 'next') setStep(state.step + 1);
    else if (t.dataset.goto) { e.preventDefault(); setStep(+t.dataset.goto); $('#pane-steps').scrollTop = 0; }
    else if (t.dataset.part) { state.isolate = true; selectPart(t.dataset.part); applyGlass(); syncTools(); framePart(t.dataset.part); }
    else if (t.dataset.joint) selectJoint(t.dataset.joint);
    else if (t.dataset.f) { torqueFilter[t.dataset.f] = t.dataset.v; renderTorques(); }
  });
  $('#ex').addEventListener('input', (e) => { if (state.mode === 'breaker') { state.bkEx = +e.target.value / 100; renderLabels(); } else state.ex = +e.target.value / 100; });
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
renderBreaker();
applyThemeColors();
setStep(state.step, {view: false});
goView(STEPS[state.step].view || 'iso', true);
showTab(location.hash.slice(1));
requestAnimationFrame(frame);
