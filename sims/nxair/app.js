// NXAIR Teardown page: 3D stage + reference rail (steps, parts, torques, specs, sources).
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {
  BASIS, BUSBAR, CABLES, FOUNDATION, ROOM, COMPS, DEPTHS, DIMENSIONS, DOCS, INTERLOCKS, JOINTS, LUBES, MAINT, PARTS, RATINGS, STEPS,
  TOOLS, TORQUE_TABLE, WIDTHS, jointById, partById,
} from './data.js';
import {CB_DATA, PANEL_TYPES, TROUBLE} from './ops.js';
import {TRAVEL, boltGeometry, buildPanel, lvCableGeometry, makeMaterials, nutGeometry} from './model.js';
import {BK_PARTS, BK_SPEC, buildBreaker} from './breaker.js';
import {DEVICE_INFO, DEVICE_PARTS, EQUIP_DEFAULT, SLOT_TYPES} from './bkdevices.js';
import {chartSvg, makeProfiles} from './bkcycle.js';
import {CB_JOINTS, CB_ACCESSORIES, CB_AUX, CB_CHECKS, CB_DEPTHS, CB_MOTOR, CB_TIMES} from './ops.js';
import {LV_PARTS, LV_SHELLS, buildLV} from './lv.js';
import {FKEYS, FRONT_ELEMENTS, LEDS, TERMINALS} from './siprotec.js';
import {CHECKS, IO, LV_JOINTS, LV_TOUR, X0, FUNCS, SETTINGS, analogSvg, controlSvg} from './lvpane.js';
const bkById = Object.fromEntries(BK_PARTS.map((p) => [p.id, p]));
const lvById = Object.fromEntries(LV_PARTS.map((p) => [p.id, p]));
const partInfo = (id) => partById[id] || bkById[id] || lvById[id];

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
  mode: 'panel', gas: false, door: 0, busEs: 0, busSlide: 0, busLever: 0, earthDev: null, lvStowed: 0, svcTruck: 0, shutU: 0, shutL: 0, slip: null, shutPad: null, protOff: 0, partOff: 0, lrm: null,
  peq: {vds: 'lrm', busES: false, fan: false, keys: false, padlock: false, motor: false, arresters: false, endWalls: true}, bkFocus: [], bkEx: 0, bkCut: false, lvFocus: [], lvEx: 0, lvCut: false, lvDoor: 1, bk: {c: 0, s: 0, count: 0, aux: true, mcb: true, equip: {...EQUIP_DEFAULT}, chart: 'close', keyLocked: false, scene: {tool: 0, cover: 0, key: 0, keyOut: false, y7: 1, offHeld: 0}}, eswT: 0, slide: 0, lever: 0,
  step: 0, ex: 0, truck: 'service', row: true, cut: false, glass: true, isolate: false, bolts: 'step', labels: true,
  focus: [], joints: [], selJoint: null, selPart: null, crane: false,
  ...store.get('variant', {}),
};
state.step = Math.min(store.get('step', 0), STEPS.length - 1);
// per-mode state keys: the panel, the stand-alone breaker (Breaker tab) and the stand-alone LV compartment (LV tab)
const MK = {panel: {f: 'focus', e: 'ex', c: 'cut'}, breaker: {f: 'bkFocus', e: 'bkEx', c: 'bkCut'}, lv: {f: 'lvFocus', e: 'lvEx', c: 'lvCut'}};
const mk = () => MK[state.mode];
const solo = () => state.mode !== 'panel';

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
const VIS = 1.6; // bolt heads drawn 1.6x life size so they read at switchgear scale (check.mjs verifies them at this size)

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
  const opts = {W: state.W, D: state.D, bus: state.bus, ur: state.ur, eq: state.peq};
  const subject = buildPanel(mats, opts);
  subject.root.position.z = -state.D / 2;
  row.add(subject.root);
  subject.gas = buildGas(subject);

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
        if (c.userData.noEdges) return;
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
    for (const g of n.parts.endWall || []) g.visible = g.userData.side === s; // end walls at the ends of the row
    for (const g of n.parts.earthDev || []) g.visible = false;
    row.add(n.root);
    neighbors.push(n);
  }
  // one continuous pair of foundation rails under the row
  for (const g of subject.parts.rails) g.scale.x = 3;

  // the stand-alone breaker for the teardown tab
  if (world?.bkHolder) { scene.remove(world.bkHolder); disposeTree(world.bkHolder); }
  const bk = buildBreaker(mats, BK_SPEC); // SION 3AE5 12 kV 1250 A 31.5 kA, independent of the panel width
  bk.setEquip(state.bk.equip);
  BK_PROF = makeProfiles(bk);
  const bkHolder = new THREE.Group();
  bkHolder.scale.setScalar(0.001);
  bk.root.position.z = 75;
  bkHolder.add(bk.root);
  scene.add(bkHolder);
  cloneMats(bk.parts, partMats);

  // the stand-alone low-voltage compartment with the protection device for the LV tab
  if (world?.lvHolder) { scene.remove(world.lvHolder); disposeTree(world.lvHolder); }
  const lv = buildLV(mats, {W: state.W});
  const lvHolder = new THREE.Group();
  lvHolder.scale.setScalar(0.001);
  lvHolder.add(lv.root);
  scene.add(lvHolder);
  cloneMats(lv.parts, partMats);

  world = {row, subject, neighbors, bolts, partMats, bk, bkHolder, lv, lvHolder};
  applyMode();
  anim.ex = state.ex;
  anim.truck = truckZ(state.truck);
  applyFocus();
  applyGlass();
  applyCut();
  syncPanelCb();
  applyPose(true);
}
// the 3AE5 in the panel shows the state and equipment of the Breaker tab
function syncPanelCb() {
  renderSld();
  for (const p of [world?.subject, ...(world?.neighbors || [])]) {
    if (!p?.cb) continue;
    p.cb.setEquip(state.bk.equip);
    p.cb.pose({c: state.bk.c, s: state.bk.s, count: state.bk.count});
  }
}

// ------------------------------------------------------------------------------------------- pose + looks
const anim = {door: 0, busEs: 0, busSlide: 0, busLever: 0, shutU: 0, shutL: 0, ex: 0, truck: 0, bkEx: 0, lvEx: 0, lvDoor: 1, esw: 0, slide: 0, lever: 0, bkScene: {tool: 0, cover: 0, key: 0, keyOut: false, y7: 1, offHeld: 0}};
const truckZ = (t) => (t === 'service' ? 0 : t === 'test' ? TRAVEL : 1150); // racking travel drawn 200 mm (3AE options 180/200/220, CB p.57)

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
        g.visible = anim.truck > 700 || !!state.svcTruck;
        continue;
      }
      if (g.userData.crane) {
        g.visible = state.crane;
        continue;
      }
      g.position.copy(g.userData.dir).multiplyScalar(anim.ex);
    }
  }
  // LV plug cable follows the truck while the plug stays in its socket (rebuilt when the truck has moved > 2 mm)
  const dzc = Math.min(anim.truck, TRAVEL + 40);
  for (const g of subject.parts.lvPlug || []) for (const c of g.children) if (c.userData.lvCable && Math.abs((c.userData.dz ?? -99) - dzc) > 2) {
    c.geometry.dispose();
    c.geometry = lvCableGeometry(subject.lvCable, dzc);
    c.userData.dz = dzc;
    c.visible = anim.truck < TRAVEL + 40;
  }
  // LV connector stowed in its support under the LV compartment (O §10.18)
  for (const g of subject.parts.lvPlug || []) {
    g.position.set(0, -60 * state.lvStowed, 110 * state.lvStowed);
    for (const c of g.children) if (c.userData.lvCable) c.visible = !state.lvStowed && anim.truck < TRAVEL + 40;
  }
  // shutters follow the truck; earthing switch, door slide, indicators and lever follow the drill state
  const open = THREE.MathUtils.clamp(1 - anim.truck / 160, 0, 1);
  for (const g of subject.parts.hvdoor || []) for (const c of g.children) {
    if (c.userData.eswSlide) { c.userData.y0 ??= c.position.y; c.position.y = c.userData.y0 + 75 * anim.slide; }
    if (c.userData.eswInd) c.rotation.z = (1 - anim.esw) * Math.PI / 2;
    if (c.userData.truckInd) c.rotation.z = anim.truck > 110 ? Math.PI / 2 : 0;
    if (c.userData.eswLever) { c.visible = anim.lever > 0.02; c.userData.z0 ??= c.position.z; c.position.z = c.userData.z0 + 120 * (1 - anim.lever); c.rotation.z = -Math.PI * anim.esw; }
  }
  // HV door: swings outward about its hinges on the left edge (x = -W/2, z = D)
  {
    const hx = -state.W / 2, hz = state.D, a = -1.65 * anim.door, c = Math.cos(a), sn = Math.sin(a);
    for (const g of subject.parts.hvdoor || []) {
      g.rotation.y = a;
      g.position.set(hx - (hx * c + hz * sn), 0, hz - (-hx * sn + hz * c)).addScaledVector(g.userData.dir, anim.ex);
    }
  }
  for (const g of subject.parts.busES || []) for (const c of g.children) if (c.userData.busBlade) c.rotation.x = c.userData.open + (c.userData.closed - c.userData.open) * anim.busEs;
  for (const g of subject.parts.lv || []) for (const c of g.children) {
    if (c.userData.busSlide) { c.userData.y0 ??= c.position.y; c.position.y = c.userData.y0 + 70 * anim.busSlide; }
    if (c.userData.busInd) c.rotation.z = (1 - anim.busEs) * Math.PI / 2;
  }
  for (const g of subject.parts.endWall || []) g.visible = !state.row;
  for (const g of subject.parts.shutterMech || []) for (const c of g.children) {
    if (c.userData.slipLever) { c.visible = state.slip === c.userData.slipLever; c.rotation.x = -0.3 * (c.userData.slipLever === 'L' ? anim.shutU : anim.shutL); }
    if (c.userData.shutPad) c.visible = state.shutPad === c.userData.shutPad;
  }
  for (const g of subject.parts.protPlate || []) g.visible = !state.protOff;
  for (const g of subject.parts.partition || []) g.visible = !state.partOff;
  for (const g of subject.parts.lv || []) for (const c of g.children) {
    if (c.userData.busLever) { c.visible = anim.busLever > 0.02; c.userData.z0 ??= c.position.z; c.position.z = c.userData.z0 + 120 * (1 - anim.busLever); c.rotation.z = -2.0 * anim.busEs; }
    if (c.userData.lrmSt) { c.visible = state.lrm != null; if (state.lrm != null) c.position.copy(c.userData.sockets[state.lrm]); }
  }
  for (const g of subject.parts.earthDev || []) g.visible = state.earthDev === g.userData.earthDev && anim.truck > 700;
  if (world.bk) for (const g of Object.values(world.bk.parts)) { g.position.copy(g.userData.dir).multiplyScalar(anim.bkEx); if (g.userData.extra) g.position.add(g.userData.extra); }
  if (world.lv) world.lv.pose({ex: anim.lvEx, door: anim.lvDoor});
  for (const p of [subject, ...neighbors]) {
    for (const g of p.parts.shutters || []) {
      for (const c of g.children) {
        if (!c.userData.shut) continue;
        c.userData.y0 ??= c.position.y;
        c.position.y = c.userData.y0 + c.userData.shut * c.userData.travel * (p === subject ? Math.max(open, c.userData.shut > 0 ? anim.shutU : anim.shutL) : 1);
      }
    }
    for (const g of p.parts.esw || []) g.children.forEach((c) => { if (c.userData.blade) c.rotation.x = -c.userData.closedAngle + c.userData.openDelta * (1 - (p === subject ? anim.esw : 0)); });
    if (p !== subject) for (const g of p.parts.breaker || []) g.position.z = 0;
  }
  neighbors.forEach((n, i) => { n.root.visible = state.row && !state.isolate && !(state.cut && i === 0); });
}

function applyFocus() {
  if (!world) return;
  const focus = new Set(state.selPart ? [state.selPart] : state[mk().f]);
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

// parts drawn see-through in X-ray: the panel enclosure, or on the Breaker tab the mechanism cover, housing and pole shells
const BK_SHELLS = new Set(['bkCover', 'bkFrame', 'bkShell', 'bkSep', 'bkSleeves']);
const shellSet = () => (state.mode === 'breaker' ? BK_SHELLS : state.mode === 'lv' ? LV_SHELLS : world.subject.shellIds);
function applyGlass() {
  if (!world) return;
  const focus = new Set(state.selPart ? [state.selPart] : state[mk().f]);
  const iso = state.isolate && focus.size > 0;
  for (const [pid, list] of Object.entries(world.partMats)) {
    const ghost = iso && !focus.has(pid);
    const glass = !ghost && state.glass && shellSet().has(pid) && !(iso && focus.has(pid));
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
  cutPlane.constant = state[mk().c] ? 0 : 1e5;
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
  vi: {p: [-0.78, 0.5, -0.06], t: [0, 0.459, -0.039]},
  drive: {p: [0.98, 0.31, 0.16], t: [0.06, 0.27, 0.06]},
  crank: {p: [0.5, 0.78, 1.35], t: [0.05, 0.42, 0.2]},
  panel: {p: [0.2, 0.5, 1.4], t: [0, 0.34, 0.2]},
  y7: {p: [0.25, 0.6, 0.95], t: [-0.07, 0.357, 0.19]},
  key: {p: [0.15, 0.55, 0.85], t: [-0.025, 0.412, 0.22]},
};
// LV compartment (stand-alone, origin at the floor of the compartment, front = door plane at z = 0)
VIEWS.door = {p: [0.8, 0.85, 2.15], t: [0.1, 0.6, 0.6]};
VIEWS.sdcOpen = {p: [1.05, 1.25, 2.35], t: [0, 0.85, 0.15]};
VIEWS.shutters = {p: [0.75, 1.15, 1.95], t: [0, 1.0, 0.0]};
VIEWS.lvTop = {p: [0.2, 2.2, 1.75], t: [-0.28, 2.06, 0.75]};
VIEWS.lrm = {p: [-0.1, 1.45, 1.55], t: [-0.2, 1.41, 0.75]};
VIEWS.connFront = {p: [0.9, 1.0, 1.9], t: [0, 0.7, -0.15]};
VIEWS.gas = {p: [-4.4, 3.5, 3.9], t: [-0.55, 1.45, -0.1]};
VIEWS.eswCut = {p: [-2.3, 1.0, -0.55], t: [0, 0.72, -0.42]};
const VIEW_BUTTONS = [['iso', '3/4'], ['front', 'Front'], ['side', 'Side'], ['rear', 'Rear'], ['top', 'Top']];
let camTween = null;
function goView(name, instant) {
  const VS = state.mode === 'breaker' ? BK_VIEWS : state.mode === 'lv' ? world.lv.views : VIEWS; // LV views are computed for the width
  const v = VS[name] || VS.iso;
  const k = state.W / 800;
  const to = new THREE.Vector3(...v.p).multiplyScalar(state.mode !== 'panel' || name === 'top' || name === 'door' ? 1 : 0.85 + 0.15 * k);
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
  if (solo()) return [];
  if (state.selJoint) return [state.selJoint];
  if (state.selPart) return partInfo(state.selPart)?.joints || [];
  return state.joints;
}
function activeTagParts() {
  if (solo()) {
    if (state.selPart) return [state.selPart];
    if (state[mk().f].length) return state[mk().f];
    return state[mk().e] > 0.3 ? (state.mode === 'lv' ? LV_PARTS : BK_PARTS).map((p) => p.id) : [];
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
// box of the visible meshes only (parts can hold hidden equipment variants)
function visibleBox(groups, box) {
  box.makeEmpty();
  for (const g of groups) g?.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (p.visible === false) return;
    box.expandByObject(o);
  });
  return box;
}
function partAnchor(pid) {
  const groups = bkById[pid] ? [world.bk.parts[pid]] : lvById[pid] ? world.lv.parts[pid] || [] : world.subject.parts[pid] || [];
  visibleBox(groups, tmpBox);
  if (tmpBox.isEmpty()) return null;
  const c = tmpBox.getCenter(new THREE.Vector3());
  const cutOn = state[mk().c];
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
  const cutOn = state[mk().c];
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
  const hits = ray.intersectObject(state.mode === 'breaker' ? world.bk.root : state.mode === 'lv' ? world.lv.root : world.subject.root, true);
  for (const h of hits) {
    if (state[mk().c] && h.point.x < -0.0005) continue;
    let o = h.object;
    if (!o.visible || o.isLineSegments) continue;
    let hidden = false;
    for (let p = o; p; p = p.parent) if (p.visible === false) hidden = true;
    if (hidden) continue;
    if (o.isInstancedMesh) return {joint: o.userData.joint};
    const pid = o.userData.part;
    if (state.glass && shellSet().has(pid)) continue;
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
  else if (hit?.part && lvById[hit.part]) { state.selLabel = hit.label || null; selectLv(hit.part); }
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
  const doorT = state.truck === 'out' ? 1 : state.door;
  if (Math.abs(anim.door - doorT) > 1e-3) { anim.door += (doorT - anim.door) * (reduced ? 1 : 1 - Math.exp(-dt * 3)); moved = true; }
  for (const [a, b] of [['busEs', 'busEs'], ['busSlide', 'busSlide'], ['busLever', 'busLever'], ['shutU', 'shutU'], ['shutL', 'shutL'], ['bkEx', 'bkEx'], ['lvEx', 'lvEx'], ['lvDoor', 'lvDoor'], ['esw', 'eswT'], ['slide', 'slide'], ['lever', 'lever']]) {
    if (Math.abs(anim[a] - state[b]) > 1e-3) { anim[a] += (state[b] - anim[a]) * (a === 'esw' ? (reduced ? 1 : 1 - Math.exp(-dt * 2.2)) : kd); moved = true; }
  }
  if (moved) applyPose();
  if (world?.bk) {
    const T = state.bk.scene, A = anim.bkScene;
    let sm = false;
    for (const k of ['tool', 'cover', 'key', 'y7', 'offHeld']) if (Math.abs(A[k] - T[k]) > 1e-3) { A[k] += (T[k] - A[k]) * (reduced ? 1 : 1 - Math.exp(-dt * 3)); if (Math.abs(A[k] - T[k]) < 2e-3) A[k] = T[k]; sm = true; }
    if (A.keyOut !== T.keyOut) { A.keyOut = T.keyOut; sm = true; }
    if (sm) { world.bk.setScene(A); applyPose(); }
  }
  bkTick(now, dt);
  if (world?.subject?.gas?.visible) for (const f of world.subject.gas.userData.flows) f.puffs.forEach((m, k) => m.position.copy(f.curve.getPointAt((now / 1000 * f.speed + k / f.puffs.length) % 1)));
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
const TABS = ['steps', 'breaker', 'lv', 'parts', 'torques', 'specs', 'sources'];
function showTab(name) {
  if (!TABS.includes(name)) name = 'steps';
  const mode = name === 'breaker' || name === 'lv' ? name : 'panel';
  if (mode !== state.mode) { state.mode = mode; state.selPart = null; applyMode(); goView(mode !== 'panel' ? 'iso' : STEPS[state.step].view || 'iso'); }
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
    ${s.drills ? pdrillHtml(s.drills) : ''}
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
  Object.assign(state, {door: 0, lvStowed: 0, svcTruck: 0, shutU: 0, shutL: 0, slip: null, shutPad: null, protOff: 0, partOff: 0, earthDev: null, busSlide: 0, busLever: 0, lrm: null});
  pdrill = null;
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
  const gs = bkById[id] ? [world?.bk.parts[id]] : lvById[id] ? world?.lv.parts[id] || [] : world?.subject.parts[id] || [];
  visibleBox(gs, box);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(state.mode === 'panel' ? 0.25 : 0.07, box.getSize(new THREE.Vector3()).length() * 0.5); // small devices on the breaker / LV models
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

// ---------------------------------------------------------------- arc-gas routes (3D, panel coordinates in mm)
function buildGas(panel) {
  const d = panel.dims, hw = d.W / 2;
  const g = new THREE.Group();
  g.visible = false;
  const mat = new THREE.MeshBasicMaterial({color: 0xe8692a, transparent: true, opacity: 0.5, depthTest: false});
  const puffMat = new THREE.MeshBasicMaterial({color: 0xffb070, transparent: true, opacity: 0.9, depthTest: false});
  const yD = (d.yPRC + d.H) / 2 + 60, zD = d.zP * 0.55; // collecting level in the pressure relief duct
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const paths = [
    ['A', [V3(40, 1150, d.zP + 300), V3(40, 1450, d.zP + 140), V3(40, d.yPRC - 60, d.zP + 120), V3(40, d.yPRC + 60, d.zP + 120), V3(20, yD, zD + 60)], 0.22],
    ['B', [V3(-40, 1450, d.zP * 0.55), V3(-40, d.yPRC - 60, d.zP * 0.5), V3(-40, d.yPRC + 60, d.zP * 0.5), V3(-20, yD, zD)], 0.26],
    ['C', [V3(0, 760, d.zC - 40), V3(0, d.yBC - 60, 60), V3(0, d.yBC + 40, 27), V3(0, d.yPRC - 40, 27), V3(0, d.yPRC + 60, 60), V3(0, yD, zD - 60)], 0.18],
    ['D', [V3(0, yD, zD), V3(-hw, yD + 10, zD), V3(-2 * d.W, yD + 20, zD), V3(-1.5 * d.W - 380, yD + 20, zD)], 0.14],
  ];
  g.userData.flows = paths.map(([name, pts, speed]) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, name === 'D' ? 26 : 14, 10), mat);
    tube.renderOrder = 10;
    tube.userData.label = `Arc gas route ${name}`;
    g.add(tube);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(name === 'D' ? 55 : 34, 90, 16), mat);
    const end = curve.getPointAt(1), dir = curve.getTangentAt(1);
    tip.position.copy(end);
    tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    tip.renderOrder = 10;
    g.add(tip);
    const puffs = Array.from({length: 7}, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(name === 'D' ? 34 : 22, 12, 8), puffMat); m.renderOrder = 11; g.add(m); return m; });
    return {curve, puffs, speed};
  });
  panel.root.add(g);
  return g;
}
function applyGas() { if (world?.subject?.gas) world.subject.gas.visible = state.gas && state.mode === 'panel'; }

// ---------------------------------------------------------------- single-line diagram of the panel, live (follows the door mimic)
function renderSld() {
  const el = $('#sld');
  if (!el) return;
  const conn = state.truck === 'service', out = state.truck === 'out';
  const closed = state.bk.s > 0.5, earthed = state.eswT > 0.5;
  const x = 58, dx = conn ? 0 : out ? 44 : 20; // the breaker block slides out of the fixed contacts in test / out
  const chev = (cx, y, down) => `<path d="M${cx - 7},${y - (down ? 4 : -4)} L${cx},${y + (down ? 3 : -3)} L${cx + 7},${y - (down ? 4 : -4)}" class="sl"/>`;
  const bx = x + dx;
  el.innerHTML = `<svg viewBox="0 0 150 250" role="img" aria-label="Single-line diagram: breaker ${closed ? 'closed' : 'open'}, ${state.truck} position, feeder ${earthed ? 'earthed' : 'not earthed'}">
    <text x="4" y="11" class="st">Single-line diagram</text>
    <line x1="8" y1="24" x2="142" y2="24" stroke="#c47a4a" stroke-width="4"/><text x="108" y="19" class="sm">Busbar</text>
    <line x1="${x}" y1="24" x2="${x}" y2="44" class="sl"/>${chev(x, 47, true)}
    ${chev(x, 186, false)}<line x1="${x}" y1="189" x2="${x}" y2="232" class="sl"/>
    <g>
      <rect x="${bx - 16}" y="52" width="32" height="128" rx="3" class="sl dash" fill="none"/>
      ${chev(bx, 56, true)}<line x1="${bx}" y1="59" x2="${bx}" y2="98" class="sl"/>
      <line x1="${bx - 5}" y1="93" x2="${bx + 5}" y2="103" class="sl"/><line x1="${bx + 5}" y1="93" x2="${bx - 5}" y2="103" class="sl"/>
      <line x1="${bx}" y1="132" x2="${closed ? bx : bx + 14}" y2="${closed ? 98 : 102}" class="sl blade"/>
      <line x1="${bx}" y1="132" x2="${bx}" y2="174" class="sl"/>${chev(bx, 177, false)}
    </g>
    <text x="${bx + 19}" y="112" class="sm">-Q0</text><text x="${bx + 19}" y="122" class="sm">${closed ? 'CLOSED' : 'OPEN'}</text>
    <text x="4" y="112" class="sm">${conn ? 'service' : out ? 'removed' : 'test'}</text>
    <circle cx="${x}" cy="200" r="6.5" class="sl"/><text x="${x - 30}" y="203" class="sm">-T1</text>
    <line x1="${x}" y1="214" x2="${x + 36}" y2="214" class="sl"/>
    <line x1="${x + 36}" y1="214" x2="${earthed ? x + 36 : x + 49}" y2="${earthed ? 230 : 227}" class="sl blade"/>
    <line x1="${x + 28}" y1="233" x2="${x + 44}" y2="233" class="sl"/><line x1="${x + 31}" y1="237" x2="${x + 41}" y2="237" class="sl"/><line x1="${x + 34}" y1="241" x2="${x + 38}" y2="241" class="sl"/>
    <text x="${x + 52}" y="222" class="sm">-Q8</text><text x="${x + 52}" y="232" class="sm">${earthed ? 'EARTHED' : 'open'}</text>
    <path d="M${x - 6},232 L${x + 6},232 L${x},242 Z" class="sl"/><text x="${x - 40}" y="244" class="sm">Cable</text>
  </svg>`;
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
      ['Panel', `${state.W} x ${state.D} x ${world?.subject?.dims.H === 2350 ? 2350 : 2300}${world?.subject?.eq.fan ? ' (2450 with the fan box)' : ''} mm (W x D x H), circuit-breaker panel, feeder ${w.feeder}`],
      ['Transport weight', `≈ ${w.kg} kg (≤ 31.5 kA, without rear duct)`],
      ['Bushing fixed contact', w.contact ? `Ø ${w.contact} mm` : 'see order documents'],
      ['Busbar joint', `${BUSBAR[state.bus].bolt}, ${BUSBAR[state.bus].bars} bar${BUSBAR[state.bus].bars > 1 ? 's' : ''} per phase drawn, bag ${BUSBAR[state.bus].bag}`],
      ['Transverse partition', state.D >= 1400 ? 'Compulsory (depth ≥ 1400 mm)' : 'Optional (depth 1350 mm)'],
      ['Insulating shells', state.ur === 17.5 ? 'Yes, Ur = 17.5 kV' : 'Only with insulated busbar option'],
    ])}
    <h3>Panel options</h3>
    <div class="equip">
      <label>Voltage detection <select data-peq="vds"><option value="lrm">LRM test sockets (feeder + busbar)</option><option value="capdis">CAPDIS-S2+ in the LV door</option><option value="vois">VOIS+ in the LV door</option></select></label>
      <label class="check"><input type="checkbox" data-peq="busES" ${state.W > 800 ? 'disabled' : ''}> Busbar earthing switch (600 / 800 mm; panel 2350)</label>
      <label class="check"><input type="checkbox" data-peq="fan" ${state.W < 800 ? 'disabled' : ''}> Forced ventilation (800 / 1000 mm; 2450)</label>
      <label class="check"><input type="checkbox" data-peq="keys"> Key interlocks</label>
      <label class="check"><input type="checkbox" data-peq="padlock"> Padlocks</label>
      <label class="check"><input type="checkbox" data-peq="motor"> Motor-operated racking (control door)</label>
      <label class="check"><input type="checkbox" data-peq="arresters"> Surge arresters</label>
      <label class="check"><input type="checkbox" data-peq="endWalls"> End walls at the row ends</label>
    </div>
    <ul class="plain small">
      <li><b>Voltage detection</b> (O §20, IEC 61243-5): LRM = two socket strips at the bottom of the LV door, for the feeder and the busbar, checked with the plug-in indicator LRM-ST 8DX1620 (flashing or lit = not isolated). CAPDIS-S1+ / S2+ (Kries) and VOIS+ are integrated units in the LV door with their own display (A0 = no operational voltage).</li>
      <li><b>Busbar earthing switch</b> (O §21, catalog p. 14): make-proof, M0 / E1, in a box over the busbar compartment inside the pressure relief duct; operated from a plate in the high LV door (operating point 2094 mm, 110-2300.9) with the operating lever: pins at "10 past 8" and ≈ 115° clockwise to earth, pins vertical and ≈ 115° counter-clockwise to de-earth. No internal interlock: padlock, electromagnetic interlock or keys. Not with forced ventilation.</li>
      <li><b>Forced ventilation</b> (O §6.3, §10.6, §29.7; I §7.12): fan box on the front of the duct roof behind the LV compartment, ventilation slots in the HV door and a flap on its inside that must be set to its operational position before the door is closed. Fan ebm-papst R2E270-AA01-05 (O) / R3G250-RO06-71 (I), replace before 40 000 h. The catalog needs it for 2500 / 3150 A in 800 mm panels at 40 kA and 4000 A in 1000 mm panels; the installation instructions say 4000 A only.</li>
      <li><b>Interlocks</b> (O §7.4–7.6, §25): key locks under a hinged cover on the HV door free their key only with the feeder earthing switch CLOSED, OPEN, or with the breaker in test; padlocks hang in the operating slides and on the door handle.</li>
      <li><b>Motor-operated racking</b> (O §27): a control door on the HV door covers the racking, key, earthing-switch, CLOSE and charging openings; with it open, electrical racking is blocked. Access mode with the double-bit key: M motor, H hand, T interlocked (needed to open the HV door). Racking motor run time &lt; 65 s.</li>
      <li><b>Surge arresters / limiters</b> (catalog p. 14): beside the sealing ends; disconnect them for the HV test. Type and size are not given: drawn.</li>
      <li><b>End walls</b>: epoxy powder-coated, 35 mm (110-2300.9); the crane rod goes through them, the hole is closed by a sealing stopper.</li>
    </ul>
    <p class="small muted">Sizes of the indicator units, the fan box, the control door, the key-lock cover, the busbar earthing box and the arresters are not in the documents: drawn.</p>
    <h3>Foundation drawing (110-2300.9)</h3><div class="scroll-x"><table class="grid4"><thead><tr>${FOUNDATION[0].map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${FOUNDATION.slice(1).map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="small muted">All mm. The model's floor shows the 40 kA / 1500 mm cut-outs for the chosen width.</p>
    <h2>Internal arc and pressure relief</h2>
    <p class="small">IEC 62271-200 type-tested: <b>IAC A FLR</b> up to 40 kA, 1 s (O §4.5, catalog HA 25.71). The rating plate of each panel states its own classification.</p>
    ${kv([
      ['IAC', 'Internal arc classification: in an arc test the panel protects people standing round it'],
      ['A', 'Accessibility type A: for authorised personnel only (indicators 300 mm from the panel in the test, closed electrical service location)'],
      ['F · L · R', 'Classified at the front, the lateral sides and the rear: free-standing or wall-mounted installation'],
      ['Isc, t', '≤ 40 kA, 1 s for NXAIR ≤ 17.5 kV (≤ 50 kA for NXAIR 50 kA)'],
      ['LSC 2B · PM', 'Loss of service continuity 2B: busbar and cables stay live while the switching-device compartment is opened · partition class PM: metal partitions and shutters'],
      ['Access', 'Busbar compartment tool-based · switching-device compartment interlock-controlled · connection compartment interlock-controlled or tool-based'],
    ])}
    <h3>Where the gas goes</h3>
    <ul class="plain small">
      <li><b>Switching-device compartment A:</b> upwards behind the LV compartment, through its relief flap into the pressure relief duct. The pressure-resistant HV door keeps the front closed.</li>
      <li><b>Busbar compartment B:</b> through the relief flaps on its roof into the duct.</li>
      <li><b>Connection compartment C:</b> upwards through the rear pressure relief duct (flaps at its foot and top), past the busbar compartment, into the duct.</li>
      <li><b>Pressure relief duct D:</b> collects the gas of all compartments of the row and leads it sideways or to the rear into the evacuation duct, out of the building through a 537 × 249 mm wall opening 2000 mm above the floor, or into a top-mounted absorber (room height then 2800 – 3500 mm).</li>
      <li>Relief flaps must lie flush (installation report 2.6); nothing may be stored on the duct. SIQuench (option) detects the arc optically and earths it in under 5 ms.</li>
    </ul>
    <button type="button" class="btn" data-gas="toggle">${state.gas ? 'Hide' : 'Show'} the gas routes in 3D</button>
    <p class="small muted">The flaps and the routes are drawn from the catalog description and the dimension drawings; the depth of the rear duct is not dimensioned there.</p>
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
  for (const el of document.querySelectorAll('[data-peq]')) { const v = state.peq[el.dataset.peq]; if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v); }
}
function renderSources() {
  $('#pane-sources').innerHTML = `
    <span class="eyebrow">Where every number comes from</span>
    <h2>Sources</h2>
    <div class="src">${DOCS.map((d) => `<div><b>${esc(d.k)}</b> · ${esc(d.t)}<br><span class="ref">${esc(d.no)} · ${esc(d.rev)}</span><br>${d.url ? `<a href="${d.url}" target="_blank" rel="noopener">Siemens PDF</a>` : '<span class="ref">copy supplied by the user; download from support.industry.siemens.com</span>'}</div>`).join('')}</div>
    <h3>How to read this page</h3>
    <ul class="plain">
      <li>Counts, sizes, washers and torques are copied from the manuals; the section reference sits on every row.</li>
      <li>Bolt positions in 3D are representative. The counts per joint match the manual. Bolt heads are drawn ${VIS}× life size so they can be seen.</li>
      <li>Geometry is checked by <code>node sims/nxair/check.mjs --all --bolts</code>: no part or bolt penetrates another in any width, depth, busbar rating, truck position or earthing-switch state, except listed real contacts (conductors through bushings and CTs, cables through sleeves, coaxial fits verified radially).</li>
      <li>The panel geometry follows the dimension drawing 110-2300.9 (internal split, compartment heights, LV box, floor cut-outs) and the catalog section. The breaker in the panel is the SION 3AE5 of the Breaker tab, built for the panel width (pole centres, terminal distance, contact arm Ø, 13 / 26 contact fingers, truck per the SION truck table) and placed from the CBP section of the dimension drawing: front just behind the door in test position, contact systems just in front of the shutters, so the fixed contacts sit inside recessed bushings. Racking travel drawn 200 mm (3AE offers 180 / 200 / 220 mm, the NXAIR value is not published). The circuit-breaker panel is 1500 mm deep (1350 mm is for the other panel types). Open point: the panel follows the 40 kA dimension drawing (front part 738 mm); the ≤ 31.5 kA drawing shows 688 mm, in which the 3AE5 with its catalog dimensions and 200 mm travel would not fit, so the NXAIR version of the breaker must differ (shorter arms or travel) in a way Siemens does not publish. Shapes of CTs and VTs are simplified.</li>
      <li>Two torque regimes exist: panel joints with dry threads (M8 30 / 25, M12 70, M16 110 Nm) and breaker contact-arm joints with greased threads (M12 40 ±4, M16 100 ±10 Nm). Each row says which.</li>
      <li>A badge marks how each torque is known. "Maker of part" and "Not stated" rows need the part supplier's figure.</li>
      <li>LV tab: the SIPROTEC 5 7SJ82 is drawn and described from the SIPROTEC 5 hardware and operation manuals and catalog; the 3AE plug pins from the 3AE sample circuit diagrams. The equipment of the LV compartment, the device tags, the I/O allocation and the settings are a typical cable-feeder example, not a Siemens drawing. Trip-circuit supervision and breaker-control rules are quoted from the SIPROTEC 5 7SY82 manual, which shares the SIPROTEC 5 function text (the 7SJ82 device manual could not be retrieved).</li>
      <li>The order documents, dimension drawings 110-2300.9 and the circuit diagrams of your switchgear take precedence over this page.</li>
    </ul>
    <p class="small muted">Independent study aid built from Siemens' publicly available documentation. Not a Siemens publication. Work on medium-voltage switchgear only as qualified personnel under the five safety rules.</p>`;
}


// ================================================================================ mode, interlocks, toast
function applyMode() {
  if (!world) return;
  world.row.visible = state.mode === 'panel';
  world.bkHolder.visible = state.mode === 'breaker';
  world.lvHolder.visible = state.mode === 'lv';
  controls.minDistance = state.mode === 'lv' ? 0.12 : state.mode === 'breaker' ? 0.25 : 0.6; // LV close-ups of keys and terminals
  for (const id of ['truckSeg', 'boltSeg', 'eswSeg']) { const el = $('#' + id); if (el) el.hidden = solo(); }
  $('#t-row').hidden = solo();
  $('#t-gas').hidden = solo();
  $('#sld').hidden = solo();
  applyGas();
  $('#lvDoorSeg').hidden = state.mode !== 'lv';
  document.querySelector('.legend').hidden = solo();
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
  if (pos === 'service' && state.door > 0.5) { toast('Interlocked: racking to service needs the HV door closed (O §7.1).'); return false; }
  if (pos === 'service' && state.lvStowed) { toast('Interlocked: racking to service needs the LV connector plugged on (O §7.1).'); return false; }
  if (pos !== 'out' && state.truck === 'out' && (state.shutPad || state.slip || state.earthDev)) { toast('Remove the earthing device, the slip-on lever and every padlock from the shutter mechanisms before the breaker goes back in.'); return false; }
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

// ================================================================================ panel drills (O 110-0134.9)
// Each step acts on the 3D model; act() returns a note, or {block: why} when an interlock of O §7.1 stops it.
const pd = (patch) => Object.assign(state, patch);
const P_DRILL = {
  door: {name: 'HV door', steps: [
    {t: 'Preconditions: breaker in TEST position, closing spring discharged, padlock taken off the door handle.', view: 'door', act() { if (state.truck === 'service') return {block: 'Interlocked: the HV door opens only with the breaker in test position (O §7.1). Rack it to test first.'}; }},
    {t: 'Pull the door handle upwards and open the HV door.', view: 'sdcOpen', act() { pd({door: 1}); }},
    {t: 'To close it: the LV connector must be plugged on (or no breaker in the panel); with forced ventilation the flap on the inside must be in its operational position. Push the handle fully up and hold it.', view: 'sdcOpen', act() { if (state.lvStowed && state.truck !== 'out') return {block: 'Interlocked: the door closes only with the LV connector plugged on (O §7.1). Plug it on first.'}; if (state.truck === 'out') return {block: 'The breaker stands in front of the panel on the service truck: put it back first.'}; }},
    {t: 'Press the door fully onto the frame with the handle, push the handle fully down and release it; fit the padlock.', view: 'door', act() { pd({door: 0}); }},
  ], done: 'Door closed. The motor in the breaker charges the spring as soon as auxiliary voltage is on (noise is normal).'},
  takeOut: {name: 'Take the breaker out', steps: [
    {t: 'Breaker OPEN in TEST position, closing spring discharged, auxiliary voltage off, HV door open.', view: 'sdcOpen', act() {
      if (state.truck === 'out') return {block: 'The breaker is already out.'};
      if (state.bk.s > 0.5) return {block: 'Open the breaker first (OFF).'};
      let note = '';
      if (state.truck === 'service') { if (!rackTo('test')) return {block: 'Racking to test is blocked.'}; note = 'Racked to test first. '; }
      if (state.bk.c > 0.99) { state.bk.c = 0; syncPanelCb(); note += 'Spring discharged with OFF – ON – OFF. '; }
      pd({door: 1});
      return {note: note + 'Door open.'};
    }},
    {t: 'Remove the LV connector: push the longitudinal fastener of the coupling up, pull the connector forward and hang it in the support under the LV compartment.', view: 'sdcOpen', act() { pd({lvStowed: 1}); }},
    {t: 'Move the service truck (the one for this panel width) centrally in front of the panel, push its locking elements into the openings of the panel frame with the rails level (setting wheels), pull it back to check that it is locked.', view: 'side', act() { pd({svcTruck: 1}); }},
    {t: 'Turn the two locking levers of the breaker to the OUTSIDE: it is free from the panel frame.', view: 'sdcOpen'},
    {t: 'Pull the breaker by its handles onto the service truck to the end stop, then turn its locking levers to the INSIDE: it is locked on the truck.', view: 'side', act() { state.truck = 'out'; syncTools(); }},
    {t: 'Pull the two unlocking levers of the service truck up and move it away slowly, on a dry level floor only.', view: 'side'},
  ], done: 'Breaker out. The shutters have closed; open them only with the slip-on levers (drill "Shutters by hand").'},
  putIn: {name: 'Put the breaker in', steps: [
    {t: 'Panel empty and ready; coding symbols of breaker and LV connector the same (never change them); coupling pin of the earthing-switch shaft vertical on breaker and panel; spring discharged; auxiliary voltage off; door open.', view: 'side', act() { if (state.truck !== 'out') return {block: 'The breaker is in the panel. Take it out first.'}; pd({svcTruck: 1, slip: null, shutPad: null, shutU: 0, shutL: 0, earthDev: null}); }},
    {t: 'Service truck centrally in front of the panel, locking elements into the frame, rails level, pull back to check. Turn the breaker\'s locking levers to the OUTSIDE (free from the truck).', view: 'side'},
    {t: 'Pull the unlocking handle of the truck, hold it and push the breaker into the panel as far as it goes.', view: 'side', act() { state.truck = 'test'; syncTools(); }},
    {t: 'Pull the two unlocking levers of the truck up and pull it back; turn the breaker\'s locking levers to the INSIDE until both latch: interlocked in test position.', view: 'sdcOpen', act() { pd({svcTruck: 0}); }},
    {t: 'Plug the LV connector on: from its support onto the breaker from the front, longitudinal fastener down.', view: 'sdcOpen', act() { pd({lvStowed: 0}); }},
    {t: 'Close the HV door, switch the auxiliary voltage on: the motor charges the closing spring (indicator CHARGED).', view: 'door', act() { pd({door: 0}); state.bk.c = 1; syncPanelCb(); }},
  ], done: 'In test position, door closed, spring charged. Racking to service: step "Rack the breaker".'},
  shutters: {name: 'Shutters by hand', steps: [
    {t: 'Breaker taken out, door open, LV connector stowed. Busbars isolated and earthed and safe isolation verified (for the lower shutter: the cable side). PPE on.', view: 'shutters', act() { if (state.truck !== 'out') return {block: 'Take the breaker out first (drill "Take the breaker out").'}; }},
    {t: 'Padlock the shutter mechanism on the RIGHT side, so the lower shutter stays shut.', view: 'shutters', act() { pd({shutPad: 'R'}); }},
    {t: 'Push the slip-on lever marked L onto the mechanism on the LEFT side.', view: 'shutters', act() { pd({slip: 'L'}); }},
    {t: 'Standing outside the panel, push its handle down as far as it goes: the lever latches and the upper (busbar-side) shutter opens. Never touch the mechanism itself.', view: 'shutters', act() { pd({shutU: 1}); }},
    {t: 'Do the voltage test or the work at once. To close: push the handle slightly to the right to release the latch and let it slip up; remove the lever; take the padlock off the right side.', view: 'shutters', act() { pd({shutU: 0, slip: null, shutPad: null}); }},
  ], done: 'Lower shutter: the same mirrored, padlock on the LEFT, lever R on the RIGHT, release to the left (O §22.2). Remove every padlock before the breaker goes back in.'},
  earthDev: {name: 'Earthing device', steps: [
    {t: 'Breaker out, LV connector stowed, both shutters closed, the contacts to be earthed isolated. Inspect the device: copper wires not brown or stiff, tulip joints tight. An observer stays until all three tulips are on.', view: 'shutters', act() { if (state.truck !== 'out') return {block: 'Take the breaker out first.'}; }},
    {t: 'Bolt the earthing clamp to the fixed earthing point at the lower left with its screw handle (≈ 20 Nm), before any shutter is opened.', view: 'sdcOpen'},
    {t: 'Padlock the mechanism of the lower shutter (right side) and open the upper shutter with lever L.', view: 'shutters', act() { pd({shutPad: 'R', slip: 'L', shutU: 1}); }},
    {t: 'Push the central earthing tulip onto the rod coupling; hold the rod only in the hand area; push the tulip onto the central contact and turn the rod clockwise; then the two outer contacts. A small discharge (light, noise) is normal.', view: 'shutters', act() { pd({earthDev: 'upper'}); }},
    {t: 'Removing: rod onto each tulip, turn counter-clockwise, pull it off and lay the tulip on the floor; close the shutter; unscrew the clamp; take the padlock off.', view: 'shutters', act() { pd({earthDev: null, shutU: 0, slip: null, shutPad: null}); }},
  ], done: 'The same on the lower contacts through the lower shutter (padlock on the left, lever R). 25 kA 1 s, Ø 40 / 60 mm contacts (O §26).'},
  front: {name: 'Connection compartment from the front', steps: [
    {t: 'Feeder earthed: the indicator on the HV door shows vertical I.', view: 'door', act() { if (state.eswT < 0.5) return {block: 'Earth the feeder first (step "Earth and de-earth the feeder"): the partition only comes off with the feeder earthing switch CLOSED.'}; }},
    {t: 'Open the door and take the breaker out; the earthing-switch indicator inside the compartment also points to vertical I.', view: 'sdcOpen', act() { pd({door: 1, lvStowed: 1}); if (state.truck !== 'out') { state.truck = 'out'; syncTools(); } }},
    {t: 'Remove the protection plate at the bottom of the compartment: 4 nuts M8 with contact washers.', view: 'connFront', act() { pd({protOff: 1}); }},
    {t: 'Remove the vertical partition: 10 bolts M8x20 with contact and plain washers and 5 bolts M8x20 with contact washers. The connection compartment is open from the front.', view: 'connFront', act() { pd({partOff: 1}); }},
    {t: 'Refit: no foreign objects, partition in, all 15 bolts hand-tight all round, then 25 Nm; protection plate, 4 nuts M8, 25 Nm. Then breaker in, door closed, de-earth, rack to service.', view: 'connFront', act() { pd({partOff: 0, protOff: 0}); }},
  ], done: 'Partition and protection plate back at 25 Nm (O §23.3).'},
  verify: {name: 'Verify isolation (LRM)', steps: [
    {t: 'Function-test the LRM-ST indicator on its test unit (or on a live panel). Only an indicator tested immediately before may be used.', view: 'lrm', act() { if (state.peq.vds !== 'lrm') { state.peq.vds = 'lrm'; build(); return {note: 'LRM test sockets fitted for this drill (Specs → Panel options).'}; } }},
    {t: 'HV door and LV door closed. Take the cover off test socket L1 (it stays on the panel) and plug the LRM-ST on.', view: 'lrm', act() { pd({lrm: 0}); }},
    {t: 'No light and no flashing: L1 isolated. Refit the cover; plug on L2.', view: 'lrm', act() { pd({lrm: 1}); }},
    {t: 'L2 isolated; refit the cover; plug on L3.', view: 'lrm', act() { pd({lrm: 2}); }},
    {t: 'L3 isolated: L1, L2 and L3 isolated, safe isolation verified. Refit the cover, take the LRM-ST off.', view: 'lrm', act() { pd({lrm: null}); }},
  ], done: 'With CAPDIS / VOIS instead: doors closed and the display shows A0 "operational high voltage not present" on L1, L2, L3 (O §20.7).'},
  busEarth: {name: 'Earth the busbars', steps: [
    {t: 'Switching released from outside; this panel is the released one. Electrician\'s ladder in front of the panel. (Busbar earthing switch OPEN.)', view: 'lvTop', act() { if (!state.peq.busES) { state.peq.busES = true; state.peq.fan = false; build(); return {note: 'Busbar earthing switch fitted for this drill (Specs → Panel options); panel 2350 mm with the high LV compartment.'}; } if (state.busEs > 0.5) return {block: 'The busbars are already earthed.'}; }},
    {t: 'Open the padlock and lift the operating slide on the LV door: the actuating opening is free.', view: 'lvTop', act() { pd({busSlide: 1}); }},
    {t: 'Insert the operating lever with its pins at "10 past 8" (the closing receptacle) as far as it goes.', view: 'lvTop', act() { pd({busLever: 1}); }},
    {t: 'Hold it straight and turn clockwise to the stop, ≈ 115°, without stopping: the indicator goes OPEN → intermediate → CLOSED.', view: 'lvTop', act() { pd({busEs: 1}); }},
    {t: 'Remove the lever, push the slide fully down and padlock it.', view: 'lvTop', act() { pd({busLever: 0, busSlide: 0}); }},
  ], done: 'Busbars earthed. There is no internal interlock: it is secured only by the padlock, an electromagnetic interlock or the key locks.'},
  busDeearth: {name: 'De-earth the busbars', steps: [
    {t: 'De-earthing released from outside, ladder in front of the panel. (Busbar earthing switch CLOSED.)', view: 'lvTop', act() { if (!state.peq.busES || state.busEs < 0.5) return {block: 'The busbars are not earthed (drill "Earth the busbars").'}; }},
    {t: 'Open the padlock and lift the operating slide.', view: 'lvTop', act() { pd({busSlide: 1}); }},
    {t: 'Insert the operating lever with its pins VERTICAL (the opening receptacle).', view: 'lvTop', act() { pd({busLever: 1}); }},
    {t: 'Turn counter-clockwise to the stop, ≈ 115°: indicator CLOSED → intermediate → OPEN.', view: 'lvTop', act() { pd({busEs: 0}); }},
    {t: 'Remove the lever, slide down, padlock.', view: 'lvTop', act() { pd({busLever: 0, busSlide: 0}); }},
  ], done: 'Busbars de-earthed.'},
};
let pdrill = null; // {id, i, note}
function pdrillHtml(ids) {
  const id = ids.includes(pdrill?.id) ? pdrill.id : ids[0];
  const d = P_DRILL[id], i = pdrill?.id === id ? pdrill.i : 0;
  return `<div class="drill" id="pDrill">
    <h3>Do it on the model</h3>
    ${ids.length > 1 ? `<div class="seg wrap" role="group" aria-label="Procedure">${ids.map((k) => `<button type="button" data-pdrill="${k}" aria-pressed="${k === id}">${esc(P_DRILL[k].name)}</button>`).join('')}</div>` : ''}
    <ol class="dsteps">${d.steps.map((st, k) => `<li class="${k < i ? 'done' : k === i ? 'on' : ''}">${esc(st.t)}</li>`).join('')}</ol>
    <div class="row">
      <button type="button" class="btn primary" data-pdrillgo="next" ${i >= d.steps.length ? 'disabled' : ''}>${i >= d.steps.length ? 'Done' : `Do step ${i + 1}`}</button>
      <button type="button" class="btn" data-pdrillgo="reset">Restart</button>
    </div>
    <p class="small muted">${esc((pdrill?.id === id && pdrill.note) || 'Each step acts on the 3D model with the interlocks of the panel (O §7.1).')}</p>
  </div>`;
}
function pdrillAct(cmd, id) {
  const ids = STEPS[state.step].drills || [];
  if (id) { pdrill = {id, i: 0}; renderStep(); goView(P_DRILL[id].steps[0].view); return; }
  pdrill ||= {id: ids[0], i: 0};
  const d = P_DRILL[pdrill.id];
  if (cmd === 'reset') { pdrill = {id: pdrill.id, i: 0}; renderStep(); goView(d.steps[0].view); return; }
  const st = d.steps[pdrill.i];
  if (!st) return;
  goView(st.view);
  const r = (st.act && st.act()) || {};
  if (r.block) { pdrill.note = r.block; toast(r.block); renderStep(); return; }
  pdrill.note = r.note || `Step ${pdrill.i + 1} done.`;
  pdrill.i++;
  if (pdrill.i >= d.steps.length) pdrill.note = (r.note ? r.note + ' ' : '') + d.done;
  applyPose();
  syncTools();
  renderStep();
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
  {t: 'Make it safe and take it out', field: true, ex: 0, focus: ['bkTruck'], view: 'iso', text: 'Breaker OFF, test position, supply voltage off and locked. Discharge the closing spring: OFF – ON – OFF with the push buttons. Unplug -X0, take the breaker out with the service truck. Lift only at the marked points on the top plate (crane hook symbol) or carry it on the truck; never let it tip – with the arms fitted it can fall onto the contact systems.'},
  {t: 'Contact systems off', field: true, ex: 0.3, focus: ['bkTulips'], view: 'rear', text: 'Contact system (23) off the threaded bolt (6 per breaker). Refit: fingers greased inside with Molykote Longterm 2 (3AX1133-2L), for Ø 40 mm arms the adapter 22.2 set in from the back, round outer edge towards the arm, 40 ±4 Nm on M12 (greased threads), then grease the other side of the fingers.'},
  {t: 'Contact arms and separating shells off', field: true, ex: 0.45, focus: ['bkArms', 'bkSleeves'], view: 'rear', text: 'Pull the hollow arms (22) off the bolts, unclip the separating shells (47) if fitted. Bolts (22.1): screw-in section greased with Vaseline (3AX1133-4A), 20 ±1 mm deep in both terminals (12 kV, 31.5 kA, 1250 A, M12), 40 ±4 Nm. Arm end faces: copper roughened, cleaned, Vaseline; silver-plated cleaned, Vaseline.'},
  {t: 'Cover off: see the mechanism', field: true, ex: 0.5, focus: ['bkCover', 'bkX0', 'bkX0plug'], view: 'iso', text: 'Plastic cover 20.1: pull both snap hooks at once, swing the cover forward, lift it off forward and up. Metal cover 20.2: two upper M6 loosened, four lower M6 with contact washers out, lift off; refit teeth towards the cover, 12 Nm. With the cover off: never trip the breaker by hand while the mechanical interlock is actuated (irreparable damage), keep 1 m away during test operations, block all operations before working inside.'},
  {t: 'Drive train: how the main shaft is turned', field: false, ex: 0, iso: true, focus: ['bkCloseRelease', 'bkY9', 'bkCloseLink', 'bkShaft', 'bkOpenLatch', 'bkRods'], view: 'drive', text: 'Side view of the linkage in the plane of the closing cam. Release: ON or -Y9 turn the closing release shaft at the front, whose arm and link swing the closing latch off the crank pin. Closing: the released spring turns the charging shaft; the cam lobe presses the roller of the closing lever down; the closing lever (a bell crank) pushes the push rod forward; the push rod pushes the drive lever on the main shaft forward, so the shaft turns, the pole levers at the back lift the insulators and the contacts close. The pawl of the opening latch drops behind the nose of the latch lever and holds the shaft. Opening: OFF, -Y1 or the trip bar lifts the pawl; the opening torsion springs and the contact-pressure springs turn the shaft back, and push rod and closing lever return with it. Press ON / OFF above to watch it.'},
  {t: 'Operating mechanism', field: false, ex: 0.75, focus: ['bkM1', 'bkGear', 'bkClosingSpring', 'bkShaft', 'bkOpeningSpring', 'bkY9', 'bkY1', 'bkS1', 'bkK1'], view: 'iso', text: 'Shown for understanding. Spare parts (motor, releases, switches) only by Siemens-trained and certified personnel with a final test on a Siemens-approved tester; otherwise the product liability lapses. Joints and bearings: wipe with a dry lint-free cloth only, never water or cleaner.'},
  {t: 'Poles', field: false, ex: 0.85, focus: ['bkShell', 'bkUpper', 'bkLower', 'bkRods', 'bkSep'], view: 'rear', text: 'Pole shells open to the panel, pole heads (42) and lower connections (44) with their contact plates, shed insulators (45) that carry the movement up from the main shaft. Factory-assembled and set; not dismantled in the field.'},
  {t: 'Inside the vacuum interrupter', field: false, ex: 0, iso: true, focus: ['bkVI', 'bkVIin', 'bkRods', 'bkUpper', 'bkLower'], view: 'vi', cut: true, text: 'Section through the middle pole. Sealed for life: the interrupter is replaced, never opened. Internals drawn generically: ceramic body, vapour shield, fixed and moving contact discs, bellows.'},
];
let bkSel = null;
function devCard(d) {
  const i = DEVICE_INFO[d.id];
  if (!i) return '';
  const eq = state.bk.equip;
  const fitted = world?.bk.parts[d.id]?.visible !== false;
  return `<details class="dev"${bkSel === d.id ? ' open' : ''}>
    <summary><span class="dtag">${esc(i.tag)}</span><span class="dt">${esc(i.title)}</span><span class="badge ${i.kind.startsWith('Basic') ? 'step' : 'none'}">${esc(i.kind)}</span>${fitted ? '' : '<span class="small muted"> · not fitted now</span>'}</summary>
    <div class="small">
      <p><b>Part no.</b> ${esc(i.pn)} · <b>Where</b> ${esc(i.where)}</p>
      <p><b>What it does.</b> ${esc(i.does)}</p>
      <p><b>How it works.</b> ${esc(i.how)}</p>
      ${i.data?.length ? kv(i.data) : ''}
      ${i.circuit && i.circuit !== '—' ? `<p><b>Circuit.</b> ${esc(i.circuit)}</p>` : ''}
      ${i.notes ? `<p class="warnline"><b>Note.</b> ${esc(i.notes)}</p>` : ''}
      <button type="button" class="btn" data-bkpart="${d.id}" ${fitted ? '' : 'disabled'}>Show in 3D</button>
    </div>
  </details>`;
}
function renderBreaker() {
  const {P, TD, armD, fingers} = BK_SPEC;
  const sel = bkSel && bkById[bkSel];
  const groups = [...new Set(BK_PARTS.map((p) => p.grp))];
  const comps = sel ? componentsOfBk(sel.id) : [];
  const table = (head, rows) => `<div class="scroll-x"><table class="grid4"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  $('#pane-breaker').innerHTML = `
    <span class="eyebrow">SION 3AE5 · 12 kV · 1250 A · 31.5 kA · ${P} mm pole centres · ${TD} mm terminal distance · arms Ø ${armD} · ${fingers}-finger contact systems</span>
    <h2>The breaker</h2>
    <p class="small">Drawn to the SION operating instructions 9229 0025 100 0C and the outline in catalog HG 11.02 (12 kV, ≤ 31.5 kA, a = 210 mm, b = 275 mm): 565 mm wide, 540 mm high, terminals 217.5 and 492.5 mm above the base, 169 mm mechanism box, 371 mm from the terminal faces to the front, contact arms 274 mm. The manual's example rating plate is exactly this breaker: <b>3AE5123-2</b>, Ur 12 kV, Ir 1250 A, Isc 31.5 kA, tk 3 s, Ud 42 kV, Up 95 kV, 80 kg, O – 0.3 s – CO – 15 s – CO, E2 C2 M2. This is the version for the NXAIR 800 mm panel; the 600 mm panel takes the 150 mm pole-centre version. Hover any part for its name; the Teardown steps below take it apart.</p>
    <h2>How it works</h2>
    <ol class="body how">
      <li><b>Charge.</b> With supply voltage on and the spring discharged, the motor -M1 starts at once and charges the closing spring through the gear unit; -S21 switches it off when the spring has latched (< 15 s, then ≥ 60 s before the next charge). The crank on the charging shaft stretches the helical extension spring through a link until it is just past dead centre and the closing latch holds it: spring indicator CHARGED, -S3 and -S4 open. Without supply: hand crank 3AX1530-4B on the coupling 57.2, clockwise until the indicator changes.</li>
      <li><b>Close.</b> Push button ON or the closing solenoid -Y9 (command ≥ 45 ms) frees the closing latch. Both act on the <b>closing release shaft</b> just behind the cover: the push finger of the button presses one arm back, the -Y9 plunger is pulled into its coil and its push pin lifts another arm; the shaft turns, and its arm and a parallel link swing the latch down, off the crank pin. Then the spring pulls the crank round from 170° to 360°. On the same charging shaft sits the <b>closing cam</b>: its lobe presses the roller of the <b>closing lever</b> (a bell crank on the mechanism plate) down. The bell crank turns this into a forward push of the <b>push rod</b>, which pushes the <b>drive lever</b> on the <b>main shaft</b> forward: the main shaft at the bottom of the drive turns, its three <b>pole levers</b> reach back under the poles and push the shed insulators up, the moving contacts meet the fixed contacts, and the last millimetres compress the contact-pressure springs. The same rotation winds the opening torsion springs on the shaft ends, and the <b>opening latch</b> (pawl) drops behind the nose of the <b>latch lever</b> on the main shaft and holds it closed. Closing ≤ 60 ms. The motor then recharges the spring; the cam lobe has passed, so the roller stays down, clear of the cam, until the next opening.</li>
      <li><b>Open.</b> Push button OFF, the 1st shunt release -Y1 (armature on the latch, command ≥ 40 ms) or, through the <b>trip bar</b>, the strikers of -Y2 … -Y7 (≥ 20 ms) lift the pawl. Nothing holds the main shaft any more: the opening springs and the contact-pressure springs turn it back, the pole levers lower the insulators and pull the contacts apart, and push rod and closing lever swing back with it. Opening ≤ 30 ms, arcing < 15 ms, break time ≤ 45 ms with -Y1 (≤ 60 ms with a 2nd / 3rd release). -S6 gives a fleeting "tripped" contact. Trip-free: an OFF during closing frees the pawl, so the breaker cannot stay closed; with OFF and ON held together it opens and stays open (anti-pumping, -K1) until ON is given anew. The teardown step "Drive train" below shows the linkage alone.</li>
      <li><b>Interrupt.</b> The arc burns in metal vapour between the contacts and goes out at current zero; the vapour condenses on the shield and the gap regains its strength within microseconds.</li>
    </ol>
    <div class="cycle">
      <div class="row">
        <button type="button" class="btn" data-bk="charge">Charge spring</button>
        <button type="button" class="btn ok" data-bk="close">ON</button>
        <button type="button" class="btn bad" data-bk="open">OFF</button>
        <button type="button" class="btn primary" data-bk="play">Play O – 0.3 s – CO</button>
      </div>
      <div class="row">
        <label class="small check"><input type="checkbox" id="bkAux" ${state.bk.aux ? 'checked' : ''}> Control voltage on</label>
        <label class="small check"><input type="checkbox" id="bkMcb" ${state.bk.mcb ? 'checked' : ''}> Motor MCB on (recharges after closing)</label>
      </div>
      <div class="readout" id="bkRead"></div>
      <div class="seg" role="group" aria-label="Timing chart">
        <button type="button" data-bkchart="close">Closing</button>
        <button type="button" data-bkchart="open">Opening</button>
        <button type="button" data-bkchart="charge">Charging</button>
      </div>
      <div id="bkChart" class="chartbox"></div>
    </div>
    <p class="small muted">The 3D model plays each operation in slow motion on the same time base as the chart; the red cursor marks the moment shown. From the manual: closing ≤ 60 ms, opening ≤ 30 ms, arcing < 15 ms, break time ≤ 45 ms, minimum commands, -S6 pulse > 10 ms, charging < 15 s. Drawn, not published by Siemens: the shape of the travel curve, the latch delay and the moments the auxiliary switch -S1 changes over. Contact travel is drawn larger than life (Siemens publishes no stroke; it changes slightly over the service life, which does not affect function). Use Cut for a section through the middle pole.</p>
    ${bkDrillHtml()}
    <h3>Springs</h3>
    ${table(['Spring', 'Type', 'Charged by', 'Does'], [
      ['Closing spring (55)', 'helical extension, 1 per breaker, right of the mechanism plate', 'motor / hand crank via gear unit, charging shaft and crank', 'closes the breaker; also charges the opening and contact-pressure springs'],
      ['Opening springs', 'helical torsion, on the main-shaft ends', 'the closing movement', 'open the breaker when the opening latch is released'],
      ['Contact-pressure springs', 'helical compression, 1 per pole under the moving stem', 'the last part of the closing stroke (over-travel)', 'keep the closed contacts pressed, take up erosion, assist opening'],
      ['Release energy stores', 'inside -Y2, -Y4 … -Y7', 'reset by the mechanism', 'strike the opening latch on a trip'],
      ['Ring springs of the contact systems', '2 per contact system', 'assembly', 'press the contact fingers onto arm and fixed contact'],
    ])}
    <h3>Times</h3>${table(['Quantity', 'Value'], CB_TIMES)}
    <h3>Operation at the breaker</h3>
    <ul class="body">
      <li>Close: hold ON (or the command) until the breaker shows ON. Open: hold OFF until it shows OFF; the spring indicator does not change on opening.</li>
      <li>Discharge the closing spring: supply off, then OFF, ON, OFF by hand. The breaker is then open and discharged.</li>
      <li>Key lock 3AX1437 (option): hold OFF and turn the key to vertical; the key comes out with the breaker locked against hand and electrical closing (-S5). Delivered locked: unlock for tests and commissioning.</li>
      <li>Electrical closing lock-out -Y8E (option): closing only with control voltage present. Undervoltage release -Y7: closing only with -Y7 energised; move its striker locking screw from A to B before commissioning.</li>
      <li>Mechanical interlock (59.2) for trucks and cassettes: the panel's interrogation part (cross-section ≤ 14 × 3 mm, force 50–450 N) senses the breaker position; with the breaker OFF it is lifted 5–10 mm and blocks closing (-S12 blocks electrically); with the breaker ON it cannot move, so the truck cannot be racked. Closing only in service or disconnected position, racking only when OFF.</li>
    </ul>
    <h3>Secondary equipment</h3>
    <p class="small">Every device of the basic and the optional equipment lists (operating instructions p. 22) is its own part in 3D. Choose the options below; "Show in 3D" isolates the device with the X-ray housing. Hover any detail (terminals, varistors, rectifiers, -X0 pins) for its name.</p>
    <div class="equip">
      <label>Auxiliary switch <select data-equip="s1"><option value="6">6 NO + 6 NC (3SV9273)</option><option value="12">12 NO + 12 NC (3SV9274)</option></select></label>
      <label>Release position 51.2 <select data-equip="slot2">${SLOT_TYPES.map((t) => `<option value="${t}">${t === 'none' ? 'empty' : '-' + t}</option>`).join('')}</select></label>
      <label>Release position 51.3 <select data-equip="slot3">${SLOT_TYPES.map((t) => `<option value="${t}">${t === 'none' ? 'empty' : t === 'Y4' ? '-Y5' : '-' + t}</option>`).join('')}</select></label>
      <label>LV interface <select data-equip="lv"><option value="X0">64-pole -X0</option><option value="strip">plug strip Q0-X1</option></select></label>
      <label class="check"><input type="checkbox" data-equip="key"> Key lock 3AX1437</label>
      <label class="check"><input type="checkbox" data-equip="y8e"> Closing lock-out -Y8E</label>
      <label class="check"><input type="checkbox" data-equip="s12"> -S12</label>
      <label class="check"><input type="checkbox" data-equip="heater"> Heater -R01</label>
    </div>
    <p class="small muted">Besides -Y1 at most two releases 3AX11 can be fitted (positions 51.2, 51.3); the permitted combinations are in catalog HG 11.02. -R1 appears with -Y7.</p>
    <div class="devs">${DEVICE_PARTS.map((d) => devCard(d)).join('')}</div>
    <h3>Teardown</h3>
    <ol class="tear">${BK_TEAR.map((x, k) => `<li><button type="button" class="tearbtn" data-tear="${k}"><span class="tt">${esc(x.t)}</span><span class="badge ${x.field ? 'step' : 'none'}">${x.field ? 'Field work' : 'Siemens only'}</span></button><div class="small">${esc(x.text)}</div></li>`).join('')}</ol>
    ${sel ? `<div class="pcard" style="margin-top:14px"><span class="eyebrow">${esc(sel.grp)}</span><h2>${esc(sel.name)}</h2>${state.selLabel && state.selLabel !== sel.name ? `<p class="small"><b>Clicked:</b> ${esc(state.selLabel)}</p>` : ''}<p>${esc(sel.desc)}</p>${comps.length ? `<h3>Components</h3><ul class="plain small">${comps.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}</div>` : ''}
    <h3>Parts</h3>
    ${groups.map((g) => `<div class="group-h">${esc(g)}</div><div class="plist">${BK_PARTS.filter((p) => p.grp === g).map((p) => `<button type="button" data-bkpart="${p.id}" class="${bkSel === p.id ? 'sel' : ''}"><span class="sw" style="background:var(--copper)"></span>${esc(p.name)}</button>`).join('')}</div>`).join('')}
    <h3>Fasteners on the breaker</h3><div class="joints">${CB_JOINTS.map((j) => jointRow(j)).join('')}</div>
    <h3>Screw-in depths of bolts / threaded rods from the contact face</h3>${table(['Rating', 'Thread', 'Upper (A)', 'Lower (B)'], CB_DEPTHS)}
    <h3>Secondary equipment</h3>${table(['Device', 'Part no.', 'Data'], CB_AUX)}
    <h3>Motor: power and protection</h3>${table(['Supply', 'Power', 'MCB (C char.)'], CB_MOTOR)}
    <h3>Commissioning checklist</h3><ul class="plain small checks">${CB_CHECKS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <h3>Accessories and lubricants</h3>${table(['Item', 'Order no.', 'Note'], CB_ACCESSORIES)}
    <h3>Breaker data</h3>${kv(CB_DATA)}`;
  for (const el of document.querySelectorAll('[data-equip]')) { const v = state.bk.equip[el.dataset.equip]; if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v); }
  renderBreakerReadout();
  renderBkChart();
}
function componentsOfBk(id) {
  const set = new Set();
  world?.bk.parts[id]?.traverse((c) => { if (c.isMesh && c.userData.label) set.add(c.userData.label); });
  return [...set];
}
// ================================================================================ LV tab
let lvSel = null;
let lvTour = -1;
function componentsOfLv(id) {
  const set = new Set();
  for (const g of world?.lv.parts[id] || []) g.traverse((c) => { if (c.isMesh && c.userData.label) set.add(c.userData.label); });
  return [...set];
}
function renderLv() {
  const sel = lvSel && lvById[lvSel];
  const comps = sel ? componentsOfLv(sel.id) : [];
  const groups = [...new Set(LV_PARTS.map((p) => p.grp))];
  const table = (head, rows) => `<div class="scroll-x"><table class="grid4"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  $('#pane-lv').innerHTML = `
    <span class="eyebrow">Low-voltage compartment (E) · ${state.W} mm panel · 630 × 406 mm</span>
    <h2>What Siemens documents</h2>
    <ul class="body">
      <li>The LV compartment holds all protection, control, measuring and metering equipment and is partitioned safe-to-touch from the high-voltage part. Options: a higher compartment (980 mm, panel 2350 mm) and a separation wall from panel to panel. <span class="ref">HA 25.73 p. 30</span></li>
      <li>It can be removed as a whole: all bus wires and control cables are plugged. Withdrawable-part and panel wiring arrive on 10-pole coded plug connections; bus wires plug from panel to panel; LV cables are flexible and run under metal covers. <span class="ref">HA 25.73 p. 30</span></li>
      <li>EMC: the compartment is metal-enclosed with the devices in defined zones, wiring in metal ducts, inductive loads suppressed (diode, varistor, RC), cable shields earthed all round in the LV compartment. <span class="ref">I §5.11</span></li>
      <li>Control cables come up the wiring duct on the left inner side of the switching-device compartment and are connected per the circuit diagrams kept in the compartment; bus wires are clamped or plugged on the bus-wire terminal block. <span class="ref">I §10.12–10.13</span></li>
      <li>Protection devices are typically SIPROTEC 5; with an arc protection module (3 optical point or line sensors) the arc is cleared within 100 ms including the breaker. Update the protection-device firmware before commissioning and register for the SIPROTEC / SICAM security notices. <span class="ref">HA 25.73 p. 31 · I §14</span></li>
    </ul>
    <div class="note-box small"><b>Typical example, not an order drawing.</b> What is fitted in a given panel, the device tags and the terminal numbers come from that panel's circuit diagrams. This page shows a cable feeder with a SIPROTEC 5 7SJ82 (PS101 + IO102) drawn to the SIPROTEC 5 hardware manual, wired to the 3AE breaker pins of the 3AE sample circuit diagrams.</div>
    <h3>Walk through it on the model</h3>
    <ol class="tear">${LV_TOUR.map((x, k) => `<li><button type="button" class="tearbtn${lvTour === k ? ' on' : ''}" data-lvtour="${k}"><span class="tt">${esc(x.t)}</span></button><div class="small">${esc(x.text)}</div></li>`).join('')}</ol>
    ${sel ? `<div class="pcard" style="margin-top:14px"><span class="eyebrow">${esc(sel.grp)}</span><h2>${esc(sel.name)}</h2>${state.selLabel && state.selLabel !== sel.name ? `<p class="small"><b>Clicked:</b> ${esc(state.selLabel)}</p>` : ''}<p>${esc(sel.desc)}</p>${comps.length ? `<h3>Components</h3><ul class="plain small">${comps.map((l) => `<li${l === state.selLabel ? ' style="color:var(--accent-ink);font-weight:600"' : ''}>${esc(l)}</li>`).join('')}</ul>` : ''}</div>` : ''}
    <h3>Parts</h3>
    ${groups.map((g) => `<div class="group-h">${esc(g)}</div><div class="plist">${LV_PARTS.filter((p) => p.grp === g).map((p) => `<button type="button" data-lvpart="${p.id}" class="${lvSel === p.id ? 'sel' : ''}"><span class="sw" style="background:#9a7fb8"></span>${esc(p.name)}</button>`).join('')}</div>`).join('')}
    <h3>SIPROTEC 5 7SJ82: the device</h3>
    ${kv([
      ['Type', 'Non-modular 1/3 × 19" device. Standard variant V3: PS101 + IO102 = 4 I, 4 V, 11 BI, 8 BO + life contact (V4 adds IO110: 23 BI, 15 BO). V1/V2 without VTs, V5 with 8 I'],
      ['Supply PS101', 'DC 24/48 V, DC 60/110/125 V, or DC 110–250 V / AC 100–230 V; 7 W; hold-up ≥ 50 ms at ≥ DC 60 V'],
      ['Inputs', 'CT 1 A / 5 A set in software, 0.1 VA, 20 A continuous, 500 A for 1 s; VT 0–200 V; BI DC 24–250 V with software thresholds (≥ 19 / 88 / 176 V)'],
      ['Communication', 'Port J RJ45 (DIGSI 5, IEC 61850); 2 plug-in slots E/F for Ethernet (IEC 61850, IEC 60870-5-104, DNP3, Modbus, PROFINET, PRP/HSR) or serial (IEC 60870-5-103, DNP3, Modbus RTU) modules; time sync G (IRIG-B / DCF77)'],
      ['Front', '150 × 266 mm, 34 mm proud of the door; housing 145 × 244 mm'],
      ['Depth', '163 mm behind the door + 34 mm terminals = 231 mm; installation depth ≥ 275 mm; ≥ 50 mm bend radius for RJ45 / fibre. The USB cover adds 15 mm in front'],
      ['Protection', 'IP54 front, IP2x rear terminals'],
      ['Door cut-out', '146 +2 × 245 +1 mm, 4 holes Ø 6 or M4; mount vertically'],
      ['Weight', '3.6 kg'],
      ['Earthing', 'Protection class I: PE terminal ≥ 4 mm², M4, ≥ 1.2 Nm, before switching on'],
    ])}
    <h3>Front panel, element by element</h3>
    <p class="small muted">Use the tour steps above for close-ups; hover any key or LED in 3D for its name.</p>
    ${table(['Element', 'Use'], FRONT_ELEMENTS)}
    <h3>LED allocation (example)</h3>
    ${table(['LED', 'Example text on the label strip'], LEDS.map((t, i) => [String(i + 1), t]))}
    <h3>Function keys F1–F9 (example)</h3>
    ${table(['Key', 'Example function'], FKEYS.map((t, i) => [`Fn + ${i + 1} = F${i + 1}`, t]))}
    <h3>Rear terminals, all ${TERMINALS.length}</h3>
    <p class="small muted">Designations from the IO102 and PS101 terminal diagrams; ● marks the polarity terminal of each CT / VT input. Hover a terminal screw in 3D for the same text.</p>
    ${table(['Terminal', 'Function', 'Example connection'], TERMINALS)}
    <h3>Rear: other connections</h3>
    ${table(['Item', 'Use'], [
      ['E (plug-in module position)', 'Example: Ethernet module ETH-BA-2EL, 2 × RJ45 (CH1, CH2): IEC 61850, IEC 60870-5-104, DNP3 TCP, Modbus TCP, PRP / HSR'],
      ['F (plug-in module position)', 'Free: serial (IEC 60870-5-103, DNP3, Modbus RTU, RS485 or fibre), another Ethernet module, or the arc-protection module ARC-CD-3FO'],
      ['G (D-sub 9)', 'Time synchronisation IRIG-B / DCF77 at 5 / 12 / 24 V, PPS; ≤ 10 m'],
      ['J (RJ45)', 'Integrated Ethernet 100Base-TX: DIGSI 5, IEC 61850 reporting / GOOSE; CAT6 S/FTP ≤ 20 m'],
      ['Battery', 'CR2032 for the clock and fault records, pull the compartment out to change'],
      ['Protective earth', '2 × M4 terminals, ≥ 4 mm², ≥ 1.2 Nm, to the shield / PE bar'],
      ['Name plate (housing top)', 'Order number, serial number, auxiliary voltage range, rated current, binary-input range'],
    ])}
    <h3>Protection and control functions</h3>
    ${table(['ANSI', 'Function', 'Use on a cable feeder'], FUNCS)}
    <h3>Example: I/O allocation</h3>
    ${table(['Input / output', 'Signal', 'Terminals', 'Wired to'], IO)}
    <h3>Example: control circuits</h3>
    <div class="scroll-x sch-wrap">${controlSvg()}</div><button type="button" class="btn sch-btn" data-enlarge="0">Enlarge diagram</button>
    <p class="small muted">Trip-circuit supervision with one isolated binary input: BI 1.1 lies across the trip contact; the resistor R in series with a spare NC contact of -S1 (31-32) bridges -S1 23-24, so the -Y1 coil and its wiring are monitored with the breaker open and closed. Control voltage must exceed 2 × the BI threshold (≥ 38 V). R between R<sub>min</sub> = R<sub>coil</sub>·(V<sub>ctrl</sub> − V<sub>coil,max off</sub>)/V<sub>coil,max off</sub> (so -Y1 does not trip) and R<sub>max</sub> = (V<sub>ctrl</sub> − V<sub>BI,min</sub>)/I<sub>BI</sub> − R<sub>coil</sub> (so BI 1.1 still picks up); take the mean. With two binary inputs the second BI replaces R. All 7SJ82 outputs are standard relays (5 A continuous, break 30 W at L/R 40 ms): the -Y1 coil current is broken by -S1 23-24 inside the breaker, not by BO 1.1. Routing of BIs / BOs is free in DIGSI 5; CB position should be wired as a double-point indication (closed + open). <span class="ref">S5F p. 669–686, 780–786 · S5H p. 237</span></p>
    <h3>Example: CT and VT inputs</h3>
    <div class="scroll-x sch-wrap">${analogSvg()}</div><button type="button" class="btn sch-btn" data-enlarge="1">Enlarge diagram</button>
    <p class="small muted">CT secondaries earthed at one point on -X2 (installation report 9.1), never opened under load: close the shorting jumpers on -X2 before opening a test slider. VT secondaries earthed at the terminal strip (10.6), damping resistor in the open-delta winding (10.9).</p>
    <h3>Example: settings for a cable feeder</h3>
    ${table(['Function', 'Example setting', 'Why'], SETTINGS)}
    <p class="small muted">Illustrative numbers only. Real settings come from the network protection study (grading with the incomer and the downstream devices, CT saturation, cable short-circuit withstand).</p>
    <h3>Breaker plug -X0 (64-pole): pins</h3>
    ${table(['Circuit', 'Path (pins)', 'Note'], X0)}
    <p class="small muted">From the 3AE sample circuit diagrams Fig. 59–63 (non-binding examples). The order-specific diagram in the LV compartment governs.</p>
    <h3>Terminals, wires, torques</h3><div class="joints">${LV_JOINTS.map((j) => jointRow(j)).join('')}</div>
    <h3>Commissioning checks (installation report)</h3>
    <ul class="plain small checks">${CHECKS.map(([n, t]) => `<li><b>${esc(n)}</b> ${esc(t)}</li>`).join('')}</ul>
    <h3>Testing the protection</h3>
    <ul class="body">
      <li>Connect DIGSI 5 to the USB-B front port or the Ethernet port J; check the firmware and the parameter set against the protection study.</li>
      <li>Secondary injection through -X2 / -X3: close the CT shorting jumpers, open the test sliders, inject on the device side. Check pickup, times, LEDs, the trip and close commands on the breaker in TEST position (LV plug in, primary isolated).</li>
      <li>Trip-circuit supervision: switch off -F02 or pull the LV plug: the TCS alarm must come after its delay; switch on again and it resets.</li>
      <li>Primary injection or load check: CT polarity and the direction of the directional functions, earth-fault path through the core-balance CT (cable screens returned through the CT).</li>
      <li>Alarms: MCB trip, VT MCB trip, breaker trip, device fault (life contact) up to the terminal strip or SCADA (report 8.1 / 8.2).</li>
    </ul>`;
}
function selectLv(id) {
  lvSel = id;
  state.selPart = id;
  state.isolate = true;
  applyFocus();
  applyGlass();
  syncTools();
  location.hash = 'lv';
  renderLv();
}
function lvTourGo(k) {
  const x = LV_TOUR[k];
  lvTour = k;
  lvSel = null; state.selPart = null; state.lvFocus = x.focus; state.lvEx = x.ex; state.lvDoor = x.door; state.lvCut = false; state.isolate = false; state.glass = x.glass !== false;
  applyCut(); applyFocus(); applyGlass(); syncTools(); goView(x.view); renderLv();
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
let BK_PROF = null; // operation profiles on a real time base (bkcycle.js), built with the breaker
let bkLast = 'Closing spring discharged, breaker open. Press Charge spring.';
function bkPredict() {
  // state after everything queued
  let {c, s} = state.bk;
  for (const a of [bkCur, ...bkQueue].filter(Boolean)) {
    if (a.kind === 'charge' || a.kind === 'hand') c = 1;
    if (a.kind === 'close') { c = 0; s = 1; }
    if (a.kind === 'open') s = 0;
  }
  return {c, s};
}
const hasY7 = () => state.bk.equip.slot2 === 'Y7' || state.bk.equip.slot3 === 'Y7';
const y7Active = () => hasY7() && state.bk.scene.y7 > 0.5; // locking screw in B
const canCharge = () => state.bk.aux && state.bk.mcb;
// why an operation cannot run now (interlocks of the 3AE5), or ''
function bkBlocked(kind, st = state.bk) {
  if (kind === 'close') {
    if (st.s > 0.5) return 'The breaker is already closed.';
    if (state.bk.keyLocked) return 'Closing blocked by the key lock (and -S5). Insert the key and turn it to horizontal.';
    if (state.bk.equip.y8e && !state.bk.aux) return 'Closing blocked: -Y8E has no control voltage, so it blocks hand and electrical closing.';
    if (y7Active() && !state.bk.aux) return 'Closing blocked: the undervoltage release -Y7 is not energised (control voltage off).';
    if (state.bk.scene.tool > 0.5) return 'Take the hand crank out first.';
    if (st.c < 0.99) return 'Closing blocked: the closing spring is not charged. Charge it first.';
  }
  if (kind === 'open' && st.s < 0.5) return 'The breaker is already open.';
  if (kind === 'charge') {
    if (st.c > 0.99) return 'The closing spring is already charged.';
    if (!canCharge()) return `${state.bk.aux ? 'Motor MCB off' : 'No control voltage'}: the motor cannot charge. Use the hand crank (drill below) or switch it on.`;
  }
  if (kind === 'hand') {
    if (st.c > 0.99) return 'The closing spring is already charged.';
    if (state.bk.scene.tool < 0.5) return 'Insert the hand crank first.';
  }
  return '';
}
function bkDo(kind) {
  if (kind === 'play') {
    if (bkCur || bkQueue.length) return toast('Wait for the running operation.');
    if (!canCharge()) return toast('Switch the control voltage and the motor MCB on for the automatic sequence.');
    const {c, s} = state.bk;
    const why = bkBlocked('close', {c: 1, s: 0});
    if (why && !/already/.test(why)) return toast(why);
    if (c < 0.99) bkQueue.push({kind: 'charge'});
    if (s < 0.5) { bkQueue.push({kind: 'close'}); bkQueue.push({kind: 'charge'}); }
    else if (c < 0.99 || bkQueue.length) bkQueue.push({kind: 'charge'});
    bkQueue.push({kind: 'open'}, {kind: 'dead'}, {kind: 'close', noAuto: true}, {kind: 'open'});
    return;
  }
  if (bkCur || bkQueue.length) return toast('Wait for the running operation.');
  const st = bkPredict();
  const why = bkBlocked(kind, st);
  if (why) return toast(why, /already/.test(why) ? 'ok' : 'warn');
  bkQueue.push({kind});
}
// supply voltage switched: the motor starts at once on a discharged spring; -Y7 trips a closed breaker when it drops
function bkSupply(on, which = 'both') {
  if (which !== 'mcb') state.bk.aux = on;
  if (which !== 'aux') state.bk.mcb = on;
  for (const [id, k] of [['bkAux', 'aux'], ['bkMcb', 'mcb']]) { const el = $('#' + id); if (el) el.checked = state.bk[k]; }
  if (bkCur || bkQueue.length) return;
  if (canCharge() && state.bk.c < 0.99 && state.bk.scene.tool < 0.5) bkQueue.push({kind: 'charge'});
  if (!state.bk.aux && y7Active() && state.bk.s > 0.5) { toast('Control voltage off: the undervoltage release -Y7 trips the breaker.'); bkQueue.push({kind: 'open'}); }
}
let bkReadT = 0;
let bkChartX = () => 0;
function renderBkChart() {
  const el = $('#bkChart');
  if (!el || !BK_PROF) return;
  const kind = ['close', 'open', 'charge'].includes(state.bk.chart) ? state.bk.chart : 'close';
  const ch = chartSvg(BK_PROF, kind, {aux: canCharge()});
  el.innerHTML = ch.svg;
  bkChartX = ch.xs;
  for (const b of document.querySelectorAll('[data-bkchart]')) b.setAttribute('aria-pressed', String(b.dataset.bkchart === kind));
}
function bkCursor(kind, t) {
  if (state.bk.chart !== kind) return;
  const cur = $('#bkCursor');
  if (!cur || !BK_PROF) return;
  const x = bkChartX(Math.min(BK_PROF[kind].T, t));
  cur.setAttribute('x1', x); cur.setAttribute('x2', x);
}
function bkTick(now, dt) {
  if (!world?.bk || !BK_PROF) return;
  if (!bkCur && bkQueue.length) {
    const next = bkQueue.shift();
    const why = next.kind === 'dead' ? '' : bkBlocked(next.kind);
    if (why) { if (!/already/.test(why)) toast(why); bkQueue.length = 0; return; }
    bkCur = {...next, t0: now, from: {...state.bk}, motor: 0};
    if (['close', 'open', 'charge'].includes(next.kind) && state.bk.chart !== next.kind) { state.bk.chart = next.kind; renderBkChart(); }
  }
  if (!bkCur) return;
  const P = BK_PROF[bkCur.kind];
  const u = Math.min(1, (now - bkCur.t0) / 1000 / (reduced ? 0.25 : P.anim));
  const t = u * P.T;
  const a = P.at(t, bkCur.from);
  let c = a.c ?? state.bk.c, sv = a.s ?? state.bk.s;
  let crank = a.crank ?? (c > 0.99 ? 170 : 0);
  if (a.motor) bkCur.motor += dt * 40;
  if (a.toolRot != null) world.bk.setScene({toolRot: a.toolRot});
  world.bk.pose({c, s: sv, crank, motor: bkCur.motor, pClose: a.pClose || 0, pOpen: a.pOpen || 0, count: state.bk.count});
  bkCursor(bkCur.kind, t);
  bkCur.live = `${P.label} … ${P.unit === 's' ? t.toFixed(1) : Math.round(t)} ${P.unit}`;
  if (u >= 1) {
    state.bk.c = c; state.bk.s = sv;
    if (bkCur.kind === 'close') { state.bk.count++; bkLast = `Closed: contacts touched at ${Math.round(BK_PROF.close.ev.touch)} ms (≤ 60 ms), pressed by the contact-pressure springs; opening springs wound; the opening latch holds the main shaft.`; if (canCharge() && !bkCur.noAuto && !bkQueue.length) bkQueue.unshift({kind: 'charge'}); }
    if (bkCur.kind === 'open') bkLast = `Opened: contacts parted at ${Math.round(BK_PROF.open.ev.sep)} ms (≤ 30 ms), arc out at current zero after < 15 ms, break time ≤ 45 ms.`;
    if (bkCur.kind === 'charge') bkLast = 'Closing spring charged and latched; motor switched off by -S21. Next charge ≥ 60 s later.';
    if (bkCur.kind === 'hand') bkLast = 'Closing spring charged by hand; take the crank out.';
    world.bk.pose({c, s: sv, crank: c > 0.99 ? 170 : 0, count: state.bk.count});
    bkCur = null;
    syncPanelCb();
    renderBreakerReadout();
    if (bkDrill) drillBkNote();
    return;
  }
  if (now - bkReadT > 90) { bkReadT = now; renderBreakerReadout(); }
}
// ------------------------------------------------------------------------------------- breaker drills
// Manual procedures of the SION operating instructions, step by step on the model. A step either moves the scene
// (crank, cover, key, -Y7 screw) or runs an operation; the next step waits until the operation has finished.
const bkBusy = () => !!(bkCur || bkQueue.length);
const bkScene = (patch) => Object.assign(state.bk.scene, patch);
const bkRun = (kind) => { const why = bkBlocked(kind); if (why) return {block: why}; bkQueue.push({kind}); return null; };
const BK_DRILL = {
  hand: {name: 'Charge by hand', steps: [
    {t: 'Switch the motor MCB off. Spring DISCHARGED, so the hand crank is needed.', view: 'panel', act() { bkSupply(false, 'mcb'); if (state.bk.c > 0.99) return {note: 'The spring is already charged: discharge it first (drill "Discharge spring"), then charge it by hand.'}; }},
    {t: 'Put the hand crank 3AX1530-4B through the opening in the cover onto the coupling 57.2.', view: 'crank', act() { bkScene({tool: 1}); }},
    {t: 'Turn clockwise, about 50 turns, until the spring indicator shows CHARGED. The slip clutch protects the drive; turning on is harmless.', view: 'crank', act() { if (state.bk.c > 0.99) return; return bkRun('hand'); }},
    {t: 'Pull the crank out. Never leave it in: racking with the crank inserted damages the breaker.', view: 'crank', act() { bkScene({tool: 0}); }},
  ], done: 'Spring charged by hand. ON now closes the breaker.'},
  discharge: {name: 'Discharge spring', steps: [
    {t: 'Motor MCB off, otherwise the motor recharges at once. Keep the control voltage on if -Y7 or -Y8E is fitted: they allow ON only with voltage.', view: 'panel', act() { bkSupply(false, 'mcb'); }},
    {t: 'Push OFF.', view: 'panel', act() { if (state.bk.s < 0.5) return {note: 'Already open.'}; return bkRun('open'); }},
    {t: 'Push ON: the closing spring releases and closes the breaker.', view: 'panel', act() { if (state.bk.c < 0.99) return {note: 'Spring already discharged: nothing to release.'}; return bkRun('close'); }},
    {t: 'Push OFF again. Breaker OPEN, spring DISCHARGED, indicator shows the discharged spring.', view: 'panel', act() { if (state.bk.s < 0.5) return; return bkRun('open'); }},
  ], done: 'Open and discharged: the state needed before work on the drive.'},
  lock: {name: 'Key lock: lock', need: 'key', steps: [
    {t: 'The breaker must be OFF. Push OFF if it shows ON.', view: 'key', act() { if (state.bk.s < 0.5) return; return bkRun('open'); }},
    {t: 'Hold OFF pressed.', view: 'key', act() { bkScene({offHeld: 1}); }},
    {t: 'Turn the key to vertical. The cam blocks the closing latch, -S5 interrupts the closing circuit.', view: 'key', act() { bkScene({key: 1}); state.bk.keyLocked = true; }},
    {t: 'Release OFF and pull the key out: it only comes out locked.', view: 'key', act() { bkScene({offHeld: 0, keyOut: true}); }},
    {t: 'Try ON.', view: 'panel', act() { const why = bkBlocked('close'); return {note: why || 'ON would close: the lock is not effective!'}; }},
  ], done: 'Locked against hand and electrical closing. Delivered like this: unlock before tests and commissioning.'},
  unlock: {name: 'Key lock: unlock', need: 'key', steps: [
    {t: 'Insert the key (vertical).', view: 'key', act() { bkScene({keyOut: false, key: 1}); }},
    {t: 'Turn the key to horizontal: closing latch and -S5 free. The key stays in.', view: 'key', act() { bkScene({key: 0}); state.bk.keyLocked = false; }},
  ], done: 'Unlocked: the breaker can be closed again.'},
  y7: {name: '-Y7 screw A → B', need: 'y7', steps: [
    {t: 'Breaker OFF, spring discharged (drill "Discharge spring"), then control voltage and motor MCB off. As delivered the locking screw of -Y7 sits in hole A: the striker is blocked.', view: 'panel', act() { if (state.bk.s > 0.5 || state.bk.c > 0.99) return {block: 'Discharge the breaker first (drill "Discharge spring"): it must be OFF with the spring discharged.'}; bkSupply(false); bkScene({y7: 0}); }},
    {t: 'Plastic cover off: pull the bottom forward and lift it off the two snap hooks.', view: 'iso', act() { bkScene({cover: 1}); }},
    {t: 'Move the locking screw of -Y7 from A to B. Now the striker can act: with no voltage -Y7 trips and blocks closing.', view: 'y7', act() { bkScene({y7: 1}); }},
    {t: 'Cover back on, snap hooks engaged.', view: 'iso', act() { bkScene({cover: 0}); }},
    {t: 'Control voltage and motor MCB on: -Y7 picks up, the motor charges the spring. Closing is possible only now.', view: 'panel', act() { bkSupply(true); }},
  ], done: '-Y7 ready for service. Switching the control voltage off now trips a closed breaker.'},
  cover: {name: 'Cover off / on', steps: [
    {t: 'Breaker OFF and discharged. Pull the bottom of the plastic cover forward and lift it up off the snap hooks.', view: 'iso', act() { if (state.bk.s > 0.5 || state.bk.c > 0.99) toast('Discharge first: OFF, ON, OFF with the motor MCB off.'); bkScene({cover: 1}); }},
    {t: 'Refit: hang it on the snap hooks at the top, press the bottom in. The push buttons, indicators and the crank opening must line up.', view: 'iso', act() { bkScene({cover: 0}); }},
  ], done: 'Cover on.'},
};
let bkDrill = null; // {id, i, note}
function bkDrillHtml() {
  const id = bkDrill?.id || 'hand';
  const d = BK_DRILL[id], i = bkDrill?.i ?? 0;
  const busy = bkBusy();
  return `<div class="drill" id="bkDrill">
    <h3>Do it on the model</h3>
    <div class="seg wrap" role="group" aria-label="Procedure">${Object.entries(BK_DRILL).map(([k, x]) => `<button type="button" data-bkdrill="${k}" aria-pressed="${k === id}">${esc(x.name)}</button>`).join('')}</div>
    <ol class="dsteps">${d.steps.map((st, k) => `<li class="${k < i ? 'done' : k === i ? 'on' : ''}">${esc(st.t)}</li>`).join('')}</ol>
    <div class="row">
      <button type="button" class="btn primary" data-bkdrillgo="next" ${i >= d.steps.length || busy ? 'disabled' : ''}>${busy ? 'Running …' : i >= d.steps.length ? 'Done' : `Do step ${i + 1}`}</button>
      <button type="button" class="btn" data-bkdrillgo="reset">Restart</button>
    </div>
    <p class="small muted" id="bkDrillNote">${esc(bkDrill?.note || 'Each step acts on the 3D model with the interlocks of the real breaker; the readout above follows.')}</p>
  </div>`;
}
function drillBkNote() {
  const el = $('#bkDrill');
  if (el) el.outerHTML = bkDrillHtml();
}
function bkDrillAct(cmd, id) {
  if (id) { bkDrill = {id, i: 0}; drillBkNote(); return; }
  bkDrill ||= {id: 'hand', i: 0};
  const d = BK_DRILL[bkDrill.id];
  if (cmd === 'reset') { bkDrill = {id: bkDrill.id, i: 0}; bkScene({tool: 0, offHeld: 0}); drillBkNote(); goView(d.steps[0].view); return; }
  if (bkBusy()) return;
  const st = d.steps[bkDrill.i];
  if (!st) return;
  // the drill needs the option fitted
  const eq = state.bk.equip;
  if (bkDrill.i === 0 && d.need === 'key' && !eq.key) { eq.key = true; world.bk.setEquip(eq); syncPanelCb(); toast('Key lock 3AX1437 fitted for this drill.', 'ok'); renderBreaker(); }
  if (bkDrill.i === 0 && d.need === 'y7' && !hasY7()) { eq.slot2 = 'Y7'; world.bk.setEquip(eq); syncPanelCb(); toast('Undervoltage release -Y7 fitted in position 51.2 for this drill.', 'ok'); renderBreaker(); }
  if (state.mode === 'breaker') goView(st.view);
  const r = st.act() || {};
  if (r.block) { bkDrill.note = r.block; drillBkNote(); return; }
  bkDrill.note = r.note || `Step ${bkDrill.i + 1} done.`;
  bkDrill.i++;
  if (bkDrill.i >= d.steps.length) bkDrill.note = (r.note ? r.note + ' ' : '') + d.done;
  renderBreakerReadout();
  drillBkNote();
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
    <div><span>Supply</span><b>${state.bk.aux ? 'control on' : 'control OFF'} · ${state.bk.mcb ? 'motor on' : 'motor OFF'}${state.bk.keyLocked ? ' · key LOCKED' : ''}</b></div>
    <div class="wide"><span>Now</span><b>${esc(live || bkLast)}</b></div>`;
}

// -------------------------------------------------------------------------------------------- tools wiring
function syncTools() {
  for (const b of document.querySelectorAll('[data-truck]')) b.setAttribute('aria-pressed', String(b.dataset.truck === state.truck));
  for (const b of document.querySelectorAll('[data-esw]')) b.setAttribute('aria-pressed', String(b.dataset.esw === (state.eswT > 0.5 ? 'closed' : 'open')));
  $('#ex').value = String(Math.round(state[mk().e] * 100));
  $('#t-cut').setAttribute('aria-pressed', String(state[mk().c]));
  $('#t-gas').setAttribute('aria-pressed', String(state.gas));
  renderSld();
  $('#t-row').setAttribute('aria-pressed', String(state.row));
  $('#t-glass').setAttribute('aria-pressed', String(state.glass));
  $('#t-iso').setAttribute('aria-pressed', String(state.isolate));
  $('#t-lab').setAttribute('aria-pressed', String(state.labels));
  for (const b of document.querySelectorAll('[data-bolts]')) b.setAttribute('aria-pressed', String(b.dataset.bolts === state.bolts));
  for (const b of document.querySelectorAll('[data-lvdoor]')) b.setAttribute('aria-pressed', String((b.dataset.lvdoor === 'open') === state.lvDoor > 0.5));
}
function variantNote() {
  const notes = [];
  if (state.D === 1350 && state.bus === 4000) notes.push('3150/4000 A busbar needs depth ≥ 1500 mm.');
  $('#vnote').textContent = notes.join(' ');
}

function wire() {
  $('#views').innerHTML = VIEW_BUTTONS.map(([k, l]) => `<button type="button" data-view="${k}" aria-pressed="false">${l}</button>`).join('');
  document.addEventListener('change', (e) => {
    if (e.target.id === 'bkAux' || e.target.id === 'bkMcb') { bkSupply(e.target.checked, e.target.id === 'bkAux' ? 'aux' : 'mcb'); renderBkChart(); renderBreakerReadout(); }
    const pk = e.target.dataset?.peq;
    if (pk) {
      state.peq[pk] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (pk === 'busES' && state.peq.busES) state.peq.fan = false;
      if (pk === 'fan' && state.peq.fan) state.peq.busES = false;
      build();
      renderSpecs();
      return;
    }
    const k = e.target.dataset?.equip;
    if (k) {
      state.bk.equip[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      world.bk.setEquip(state.bk.equip);
      syncPanelCb();
      if (bkSel && world.bk.parts[bkSel]?.visible === false) { bkSel = null; state.selPart = null; }
      applyGlass(); applyFocus(); renderBreaker();
    }
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.view) goView(t.dataset.view);
    else if (t.dataset.truck) rackTo(t.dataset.truck);
    else if (t.dataset.esw) setEsw(t.dataset.esw);
    else if (t.dataset.bolts) { state.bolts = t.dataset.bolts; syncTools(); applyFocus(); }
    else if (t.id === 't-gas') { state.gas = !state.gas; applyGas(); syncTools(); if (state.gas) goView('gas'); if (state.gas) toast('Arc-gas routes: A and B up through their flaps, C up the rear duct, then along the pressure relief duct out of the row.', 'ok'); }
    else if (t.id === 't-cut') { state[mk().c] = !state[mk().c]; applyCut(); syncTools(); }
    else if (t.id === 't-row') { state.row = !state.row; applyPose(); syncTools(); }
    else if (t.id === 't-glass') { state.glass = !state.glass; applyGlass(); syncTools(); }
    else if (t.id === 't-iso') { state.isolate = !state.isolate; applyGlass(); syncTools(); }
    else if (t.id === 't-lab') { state.labels = !state.labels; renderLabels(); syncTools(); }
    else if (t.dataset.drill) drillAct(t.dataset.drill);
    else if (t.dataset.pdrill) pdrillAct(null, t.dataset.pdrill);
    else if (t.dataset.pdrillgo) pdrillAct(t.dataset.pdrillgo);
    else if (t.dataset.drilldir) { drill = {dir: t.dataset.drilldir, i: 0}; renderStep(); }
    else if (t.dataset.gas) { state.gas = !state.gas; applyGas(); renderSpecs(); syncTools(); if (state.gas) goView('gas'); }
    else if (t.dataset.bk) bkDo(t.dataset.bk);
    else if (t.dataset.bkchart) { state.bk.chart = t.dataset.bkchart; renderBkChart(); }
    else if (t.dataset.bkdrill) bkDrillAct(null, t.dataset.bkdrill);
    else if (t.dataset.bkdrillgo) bkDrillAct(t.dataset.bkdrillgo);
    else if (t.dataset.bkpart) { selectBk(t.dataset.bkpart); framePart(t.dataset.bkpart); }
    else if (t.dataset.lvpart) { selectLv(t.dataset.lvpart); framePart(t.dataset.lvpart); }
    else if (t.dataset.lvtour) lvTourGo(+t.dataset.lvtour);
    else if (t.dataset.enlarge) { const d = $('#schDlg'); $('.dlg-body', d).innerHTML = [controlSvg, analogSvg][+t.dataset.enlarge](); d.showModal(); }
    else if (t.dataset.dlgclose != null) $('#schDlg').close();
    else if (t.dataset.lvdoor) { state.lvDoor = t.dataset.lvdoor === 'open' ? 1 : 0; syncTools(); }
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
  $('#ex').addEventListener('input', (e) => { state[mk().e] = +e.target.value / 100; if (solo()) renderLabels(); });
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
      renderLv();
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
renderLv();
applyThemeColors();
setStep(state.step, {view: false});
goView(STEPS[state.step].view || 'iso', true);
showTab(location.hash.slice(1));
requestAnimationFrame(frame);
// scripted renders for geometry review (node sims/nxair/check.mjs covers clashes; this exposes the camera)
if (location.hash === '#debug') window.__nxair = {state, anim, camera, controls, cutPlane, applyPose, applyGlass, applyFocus, get world() { return world; }};
