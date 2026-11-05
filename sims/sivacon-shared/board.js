// The whole lineup built from a configuration: every field's frame, plinth, enclosure, busbars, devices and doors as
// registered parts (registry.js) plus every fastener as an instance (hardware.js). pose(S, dt) puts it all where the
// teardown, the door switch and the units' positions say; pick(ray) names what is under the pointer; callouts()
// gives the leaders for the selected field's key parts. Built in millimetres under a root scaled to metres.
import * as THREE from 'three';
import {DOOR_T, FIELD_TYPES, HEAD, FOOT, POST, REAR_T, devHeight} from './catalog.js';
import {buildBase, buildEnclosure, buildFrame, buildMainBusbar, buildPE} from './cabinet.js';
import {BUILD} from './fields.js';
import {createHardware} from './hardware.js';
import {makeMaterials, mergeGeos} from './parts.js';
import {createRegistry, NSTAGE} from './registry.js';
import {NMAINT} from './wl.js';

let MATS = null;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};

// merge a part group's direct meshes by material: one draw call per material per part, the part still moves and picks
function bake(group, made) {
  const by = new Map();
  for (const c of group.children) {
    if (!c.isMesh || c.isInstancedMesh || c.userData.keep || c.userData.part) continue;
    if (!by.has(c.material)) by.set(c.material, []);
    by.get(c.material).push(c);
  }
  for (const [mat, list] of by) {
    if (list.length < 2) continue;
    const geos = list.map((c) => {
      c.updateMatrix();
      const g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
      g.applyMatrix4(c.matrix);
      return g;
    });
    const mg = mergeGeos(geos);
    geos.forEach((g) => g.dispose());
    mg.computeBoundingSphere();
    mg.computeBoundingBox();
    const m = new THREE.Mesh(mg, mat);
    m.castShadow = list.some((c) => c.castShadow);
    m.receiveShadow = list.some((c) => c.receiveShadow);
    for (const c of list) group.remove(c);
    group.add(m);
    made.push(mg);
  }
}

// which key parts of the selected field get a leader, and in which stretch of the teardown (s = x * 8)
const CALLS = [
  {re: /^Head-room door/, title: 'Head-room door', sub: (r) => 'Field ' + r.tag + ' · row A 225 mm', win: [0, 1.1]},
  {re: /^(Breaker door|Compartment door|Field door|Device compartment door|Strip compartment door)/, title: (r) => r.name.split(' +')[0].split(' ·')[0], sub: () => 'Opens 105° · door-coupled drive', win: [0, 1.6]},
  {re: /^Roof (plate|hoods)/, title: (r) => r.name.split(' (')[0], sub: () => 'Removed before lifting', win: [1.2, 2.9]},
  {re: /^Design side wall|^Side wall/, title: (r) => r.name, sub: () => 'End of the lineup', win: [1.6, 2.9]},
  {re: /^(Withdrawable unit|Small withdrawable)/, title: (r) => r.name.split(' ·')[0], sub: (r) => (r.posOf ? r.posOf().toUpperCase() : '') + (/^Small/.test(r.name) ? ' · miniature unit' : ' · 507 mm chassis'), win: [0.6, 4.1]},
  {re: /^(Circuit-breaker|MCCB)/, title: (r) => r.name.split(' ·')[0], sub: (r) => (r.posOf ? r.posOf().toUpperCase() : 'FIXED'), win: [0.6, 4.1]},
  {re: /^3NJ6|^3NJ4|^Capacitor module|^SINAMICS/, title: (r) => r.name.split(' ·')[0], sub: () => 'Plug-in / fixed module', win: [0.6, 4.1]},
  {re: /^Plug-in bus duct/, title: 'Plug-in bus duct', sub: () => 'Openings every 50 mm', win: [3.1, 4.8]},
  {re: /^Vertical distribution bars|^Vertical bars for the strips|^Horizontal distribution busbar/, title: (r) => r.name, sub: (r) => r.lines[0], win: [4.3, 6.1]},
  {re: /^Guide frame/, title: 'Guide frame', sub: () => 'Isolating contacts · shutters', win: [3.6, 5.9]},
  {re: /^Main busbar L1/, title: 'Main busbar', sub: (r) => r.lines[0] + ' · ' + r.lines[1].split(' ·')[0], win: [2.4, 7.2]},
  {re: /^Fishplate joint L2/, title: 'Fishplate joint', sub: () => 'M10 · DIN 6796 · 40 Nm', win: [3, 7.3]},
  {re: /^Busbar holder/, title: 'Busbar holder', sub: () => 'SMC comb support', win: [5.8, 7.4]},
  {re: /^Frame upright, right front/, title: 'Frame upright', sub: () => '25 mm hole rows · M6 4 Nm', win: [6.3, 8.1]},
  {re: /^Plinth \d/, title: (r) => r.name, sub: () => 'M12 × 25 corners', win: [6.6, 8.1]},
  {re: /^Foundation/, title: 'Foundation U50', sub: () => 'Floor fixing M10 · Ø14.8', win: [6.9, 8.1]},
];

export function buildBoard(cfg, R) {
  if (!MATS) MATS = makeMaterials();
  const M = MATS;
  const root = new THREE.Group();
  root.scale.setScalar(0.001);
  const reg = createRegistry();
  const hw = createHardware(M);
  const ticks = [];
  const wlStates = [];
  const fields = [];
  const H = cfg.height;
  const B = cfg.base;
  const D = cfg.depth;
  const rear = cfg.busbar !== 'top';
  const Bz = rear ? (D <= 600 ? 200 : 400) : 100;
  cfg.fields.forEach((f, i) => {
    const T = FIELD_TYPES[f.type];
    const g = new THREE.Group();
    g.position.x = R.side + R.xs[i];
    root.add(g);
    const ctx = {
      cfg, R, M, hw, reg, ticks, wlStates, f, T, i, g,
      W: f.width, D, H, B, y0: B, yt: B + H,
      yDb: B + FOOT, yDt: B + FOOT + devHeight(H),
      dev: Math.min(f.width, T.dev(f.width) + (T.dev(f.width) < f.width ? 0 : 0)),
      rear, Bz, zSep: -(D - Bz),
      first: i === 0, last: i === cfg.fields.length - 1,
    };
    buildFrame(ctx);
    buildBase(ctx);
    buildEnclosure(ctx);
    const main = buildMainBusbar(ctx);
    buildPE(ctx);
    BUILD[f.type]?.(ctx, main);
    fields.push({g, f, ctx});
  });
  hw.build(root);
  const made = [];
  for (const r of reg.parts) bake(r.g, made);
  root.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh) o.userData.mat0 = o.material;
  });
  // the record of every part keeps its field tag for the card
  for (const r of reg.parts) r.tag = cfg.fields[r.field]?.tag ?? '';

  // ------------------------------------------------------------ layers and glass
  let layers = {};
  const layerOn = (r) => {
    if (r.layer === 'enclosure') return layers.enclosure !== 'off';
    if (r.layer === 'door') return layers.doors !== false && layers.enclosure !== 'off';
    if (r.layer === 'busbar') return layers.busbar !== false;
    if (r.layer === 'unit') return layers.units !== false;
    return true;
  };
  const setLayers = (L) => {
    layers = {...L};
    for (const r of reg.parts) {
      if (r.sub) continue;
      r.g.visible = layerOn(r);
      const glass = layers.enclosure === 'glass' && (r.layer === 'enclosure' || r.layer === 'door');
      r.g.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh) return;
        if (o.userData.label) o.visible = layers.labels !== false && !glass;
        else o.material = glass ? M.ghost : o.userData.mat0;
        o.castShadow = glass ? false : o.userData.cs0 ?? (o.userData.cs0 = o.castShadow);
      });
    }
    for (const m of Object.values(hw.meshes)) m.visible = layers.hardware !== false;
    applySolo();
    dirty = true;
  };
  // solo: only the selected field's 3WL, with its guide frame (1) or the breaker alone (2)
  let solo = {field: -1, mode: 0};
  const applySolo = () => {
    if (!solo.mode) return;
    for (const r of reg.parts) {
      if (r.sub) continue;
      r.g.visible = r.field === solo.field && (r.wl === 'breaker' || (solo.mode === 1 && r.wl === 'frame'));
    }
  };
  const setSolo = (field, mode) => {
    solo = {field, mode};
    if (mode) applySolo();
    else setLayers(layers);
    dirty = true;
  };
  const wp2 = new THREE.Vector3();
  /** world position of a field's 3WL breaker, or null */
  const wlCenter = (field) => {
    const r = reg.parts.find((p) => p.field === field && p.wl === 'breaker');
    if (!r) return null;
    return r.g.getWorldPosition(wp2).clone();
  };
  /** the box around the part a procedure step asks the operator to use */
  const targetBox = (st) => {
    const t = st?.target && st.targets?.[st.target];
    if (!t) return null;
    const b = new THREE.Box3();
    for (const g of [].concat(t)) if (g) b.expandByObject(g);
    return b.isEmpty() ? null : b;
  };

  // ------------------------------------------------------------ pose
  let dirty = true;
  let lastX = -1;
  let lastSel = -1;
  let lastScope = '';
  const spreadOf = (S) => smoother((S.x * NSTAGE - 1.4) / 1.6);
  // the selected field's 3WL comes apart on its own (S.wlx), eased here
  let wlx = 0;
  let wlxField = -1;
  const TS = {sel: -1, v: 0};
  const pose = (S, dt) => {
    const wt = S.wlx || 0;
    if (wlxField !== S.sel) wlx = 0;
    wlxField = S.sel;
    const wPrev = wlx;
    // one maintenance step per 0.9 s: the counter runs at a steady rate toward its target
    const rate = (dt || 0.016) / (0.9 * NMAINT);
    wlx += Math.max(-rate * 3, Math.min(rate, wt - wlx));
    if (Math.abs(wt - wlx) < 1e-3) wlx = wt;
    if (wlx !== wPrev) dirty = true;
    const n = fields.length;
    const sp = spreadOf(S);
    fields.forEach((fd, i) => {
      let dx = 0;
      if (S.scope === 'all') dx = (i - (n - 1) / 2) * 520 * sp;
      else if (i < S.sel) dx = -950 * sp;
      else if (i > S.sel) dx = 950 * sp;
      fd.g.position.x = R.side + R.xs[i] + dx;
    });
    const scope = (fi) => (S.scope === 'all' ? 1 : fi === S.sel || fi < 0 ? 1 : 0);
    const moving = reg.pose(S.x, scope, {dt, doors: S.doors, distK: S.scope === 'all' ? 0.7 : 1, fly: (r) => (r.field === S.sel ? wlx : 0), flySteps: NMAINT});
    // the ticks see the selected field's maintenance step counter
    TS.sel = S.sel;
    TS.v = wlx * NMAINT;
    for (const t of ticks) t(TS);
    if (dirty || moving > 0.01 || S.x !== lastX || S.sel !== lastSel || S.scope !== lastScope) {
      hw.update();
      dirty = moving > 0.01;
    }
    lastX = S.x;
    lastSel = S.sel;
    lastScope = S.scope;
  };

  // ------------------------------------------------------------ picking
  const box3 = new THREE.Box3();
  const mtx = new THREE.Matrix4();
  const pp = new THREE.Vector3();
  const visibleChain = (o) => {
    for (let p = o; p && p !== root; p = p.parent) if (!p.visible) return false;
    return true;
  };
  const partOf = (o) => {
    for (let p = o; p && p !== root; p = p.parent) if (p.userData.part) return p.userData.part;
    return null;
  };
  const posText = (r) => {
    for (let p = r.g; p && p !== root; p = p.parent) if (p.userData.part?.posOf) return p.userData.part.posOf().toUpperCase();
    return '';
  };
  const pick = (ray) => {
    const hits = ray.intersectObject(root, true);
    for (const h of hits) {
      const o = h.object;
      if (!visibleChain(o)) continue;
      if (o.material?.transparent && o.material.opacity < 0.3) continue;
      if (o.isInstancedMesh) {
        const kind = o.userData.hw;
        const info = hw.info(kind, h.instanceId);
        if (!info) continue;
        o.getMatrixAt(h.instanceId, mtx);
        pp.setFromMatrixPosition(mtx);
        root.localToWorld(pp);
        const s = (info.d || 8) * 0.0022;
        box3.setFromCenterAndSize(pp, new THREE.Vector3(s, s, s));
        const item = hw.items[kind][h.instanceId];
        const owner = partOf(item.parent);
        return {info: {title: info.title, lines: info.lines, where: owner ? `${owner.tag} · ${owner.name.split(' ·')[0]}` : ''}, box: box3.clone(), field: owner?.field ?? -1, module: owner?.module ?? -1};
      }
      const r = partOf(o);
      if (!r) continue;
      box3.setFromObject(r.g);
      const lines = r.lines.map((l) => l.replace('%POS%', posText(r)));
      // an operable part names its action; the ETU face reports where on its drawing the ray hit
      let action = null;
      for (let p = o; p && p !== root && !action; p = p.parent) action = p.userData.part?.action || null;
      const etu = o.userData.etu && h.uv ? {st: o.userData.etu, hits: o.userData.hits, x: h.uv.x * 240, y: (1 - h.uv.y) * 600} : null;
      return {info: {title: r.name, lines, where: `${r.tag}${r.module >= 0 ? ' · module ' + (r.module + 1) : ''}`}, box: box3.clone(), field: r.field, module: r.module, action, etu};
    }
    return null;
  };

  // ------------------------------------------------------------ callouts
  const wp = new THREE.Vector3();
  const callouts = (S, project) => {
    if (solo.mode) return [];
    if (layers.labels === false) return [];
    const s = S.x * NSTAGE;
    const used = new Set();
    const list = [];
    for (const c of CALLS) {
      const r = reg.parts.find((p) => p.field === S.sel && !p.sub && c.re.test(p.name) && p.g.visible);
      if (!r || used.has(r)) continue;
      const [a, b] = c.win;
      const alpha = Math.min(smoother((s - a + 0.3) / 0.3), smoother((b - s) / 0.3));
      if (alpha <= 0.01) continue;
      used.add(r);
      r.g.getWorldPosition(wp);
      const p = project(wp.x, wp.y, wp.z);
      if (!p || p[0] < 300 || p[0] > 1300 || p[1] < 90 || p[1] > 760) continue;
      list.push({anchor: p, title: typeof c.title === 'function' ? c.title(r) : c.title, sub: c.sub(r), alpha});
      if (list.length >= 6) break;
    }
    // labels to the outside of their anchors, spaced so they never overlap
    for (const side of [-1, 1]) {
      const l = list.filter((c) => (side < 0 ? c.anchor[0] < 800 : c.anchor[0] >= 800)).sort((p, q) => p.anchor[1] - q.anchor[1]);
      let yPrev = -99;
      for (const c of l) {
        const y = Math.max(c.anchor[1] - 34, yPrev + 40, 110);
        c.at = [side < 0 ? Math.max(500, c.anchor[0] - 120) : Math.min(1120, c.anchor[0] + 120), y];
        yPrev = y;
      }
    }
    return list;
  };

  // ------------------------------------------------------------ views and extents
  const fieldCentre = (i) => {
    const fd = fields[i];
    if (!fd) return 0;
    return (fd.g.position.x + fd.f.width / 2) * 0.001;
  };
  const fieldBox = (i) => {
    const fd = fields[i];
    if (!fd) return null;
    const x = fd.g.position.x;
    return new THREE.Box3(new THREE.Vector3(x * 0.001, 0, (-D - REAR_T) * 0.001), new THREE.Vector3((x + fd.f.width) * 0.001, (B + H + 75) * 0.001, (DOOR_T + 2) * 0.001));
  };
  const bbox = new THREE.Box3(new THREE.Vector3(0, 0, (-D - 30) * 0.001), new THREE.Vector3(R.length * 0.001, (B + H + 120) * 0.001, 0.03));

  // ------------------------------------------------------------ bill of materials
  const byName = (re) => reg.parts.filter((p) => !p.sub && re.test(p.name)).length;
  const hwc = hw.count();
  R.parts = reg.parts.length + hw.recs.length;
  R.bom = [
    ['Fields', cfg.fields.length, cfg.fields.map((f) => f.width).join(' + ')],
    ['Transport units', R.tuCount, `≤ ${2400} mm`],
    ...Object.entries(R.count).sort((p, q) => q[1] - p[1]),
    ['—'],
    ['Main busbar', R.pack.txt, `${R.In} A · ${cfg.busbar}`],
    ['Fishplate joints', byName(/^Fishplate joint/), 'M10 · 40 Nm'],
    ['Busbar holders', byName(/^Busbar holder/), 'SMC'],
    ['Doors and covers', reg.parts.filter((p) => p.layer === 'door').length, ''],
    ['Frame uprights', byName(/^Frame upright/), '25 mm grid'],
    ['—'],
    ...Object.entries(hwc).sort((p, q) => q[1] - p[1]).map(([k, v]) => [k, v, k.includes('M12') ? '70 Nm' : k.includes('M10') ? '40 Nm' : k.includes('M8') ? '20 Nm' : k.includes('M6 bolt') ? '6 Nm' : k.includes('M6 sheet') ? '4 Nm' : '']),
    ['—'],
    ['Weight ≈', `${R.weight.toLocaleString('en-US')} kg`, 'TIP Tab. 9/1 scaled'],
    ['Power loss ≈', `${R.loss.toLocaleString('en-US')} W`, 'at 80 % In'],
    ['Rated values', `${R.In} A`, `Icw ${R.Icw} kA 1 s · ${cfg.ip}`],
  ];

  const dispose = () => {
    made.forEach((g) => g.dispose());
    hw.dispose();
  };
  return {root, reg, hw, fields, pose, pick, setLayers, setSolo, wlCenter, targetBox, wlStates, callouts, fieldCentre, fieldBox, bbox, dispose, M};
}
