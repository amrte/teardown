// The 8BD1 feeder panel built from code, in metres: x across the panel (left to right seen from the front), y up from
// the floor, z toward the operator (front face at +depth/2). The cubicle is fixed; the truck moves along z by its
// travel. Everything is posed by update(state) from kin.js's stateAt(p): nothing here keeps its own time.
//
// Layout (101/3-101/4, 102/2-102/4, 104/3 fig 6b): truck compartment in front over the full HV height, busbar
// compartment rear-upper, cable compartment rear-lower, both behind insulating partitions 374 / 150 with the barrier
// boxes 360 (three, on a diagonal) and 316 (three, in a row); low-voltage compartment 530 on the roof at the front.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {FASTENERS, P, STEPS, fastStatus} from './kin.js';

const V3 = THREE.Vector3;
const PI = Math.PI;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = (x) => {
  const k = clamp(x, 0, 1);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};
const lerp = (a, b, k) => a + (b - a) * k;

export const ACCENT = '#e3562a';
// material kinds: RAL 7032 pebble grey sheet (101/3), insulating partitions, cast resin, copper, silvered contacts
const KIND = {
  sheet: {color: '#b8b3a4', roughness: 0.62, metalness: 0.04},
  sheetIn: {color: '#cdc9bd', roughness: 0.66, metalness: 0.03},
  frame: {color: '#8e8a7f', roughness: 0.55, metalness: 0.1},
  insul: {color: '#b49a6b', roughness: 0.7, metalness: 0},
  resin: {color: '#6a4a38', roughness: 0.42, metalness: 0},
  copper: {color: '#c47a4c', roughness: 0.38, metalness: 0.8},
  silver: {color: '#d6d6d0', roughness: 0.32, metalness: 0.8},
  ceramic: {color: '#efece4', roughness: 0.36, metalness: 0},
  galv: {color: '#c3c7c8', roughness: 0.45, metalness: 0.5},
  dark: {color: '#3a3c3f', roughness: 0.6, metalness: 0.2},
  spring: {color: '#59626a', roughness: 0.4, metalness: 0.7},
  black: {color: '#1c1d1f', roughness: 0.7, metalness: 0},
  glass: {color: '#a9c0c9', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.32},
  yellow: {color: '#e1b43a', roughness: 0.55, metalness: 0},
  red: {color: '#c23a2e', roughness: 0.5, metalness: 0},
  white: {color: '#f3f3f0', roughness: 0.5, metalness: 0},
  cable: {color: '#26272a', roughness: 0.8, metalness: 0},
  green: {color: '#3f8a57', roughness: 0.5, metalness: 0},
};
// which subsystem each part group belongs to (the ISOLATE buttons)
const SYS = {
  truck: ['613', '121', '91', '669', '619', '65', '133', '151', '125', '41', '395', '689', '653', '673', '339.55', '339.58'],
  poles: ['339.30', '339.20', '339.40', '339.16', '339.28', '339.48', '339.49', '423', '429', '295', '301'],
  mech: ['339', '339.60.1', '339.64', '339.63', '339.cs', '339.61.8'],
  bus: ['450', '430', '418', '374', '360', '396', '402', '340'],
  cable: ['150', '316', '220', '290', '300', '280', '256', '248', '130', '75', 'cables', '200'],
  locks: ['47', '51', '50', '66', '588', '592', '593', '587', '40', '78'],
  lv: ['530', '530.door'],
};
const SYS_OF = Object.fromEntries(Object.entries(SYS).flatMap(([s, ids]) => ids.map((id) => [id, s])));
const WALLS = new Set(['560', '180', '386', '544', '538', '486', '480', '90', '654', '156']);
const SHEETS = new Set(['30', '560', '180', '386', '544', '538', '486', '480', '90', '654', '156', '568', '530', '530.door', '374', '150', '340', '396']);

// ------------------------------------------------------------ geometry helpers
function ribbedGeo(len, r0, r1, sheds, seg = 28) {
  // a cast-resin / porcelain insulator along +y: a core of radius r0 with `sheds` ribs of radius r1
  const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(r0 * 1.25, 0), new THREE.Vector2(r0 * 1.25, len * 0.06)];
  const a = len * 0.08;
  const b = len * 0.92;
  for (let i = 0; i < sheds; i++) {
    const y0 = a + ((b - a) * i) / sheds;
    const y1 = a + ((b - a) * (i + 1)) / sheds;
    pts.push(new THREE.Vector2(r0, y0 + (y1 - y0) * 0.15), new THREE.Vector2(r1, y0 + (y1 - y0) * 0.42), new THREE.Vector2(r1, y0 + (y1 - y0) * 0.55), new THREE.Vector2(r0, y0 + (y1 - y0) * 0.85));
  }
  pts.push(new THREE.Vector2(r0 * 1.25, len * 0.94), new THREE.Vector2(r0 * 1.25, len), new THREE.Vector2(0.001, len));
  return new THREE.LatheGeometry(pts, seg);
}
class Helix extends THREE.Curve {
  constructor(r, h, turns) {
    super();
    Object.assign(this, {r, h, turns});
  }
  getPoint(t, out = new V3()) {
    const a = t * this.turns * PI * 2;
    return out.set(this.r * Math.cos(a), this.h * t, this.r * Math.sin(a));
  }
}
const coilGeo = (r, h, turns, wire) => new THREE.TubeGeometry(new Helix(r, h, turns), Math.round(turns * 20), wire, 6, false);
// a plate in the x-y plane with rectangular holes, extruded to thickness t (centred on z = 0)
function plateGeo(w, h, t, holes = []) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  s.lineTo(-w / 2, h);
  s.closePath();
  for (const [cx, cy, hw, hh] of holes) {
    const p = new THREE.Path();
    p.moveTo(cx - hw / 2, cy - hh / 2);
    p.lineTo(cx - hw / 2, cy + hh / 2);
    p.lineTo(cx + hw / 2, cy + hh / 2);
    p.lineTo(cx + hw / 2, cy - hh / 2);
    p.closePath();
    s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, {depth: t, bevelEnabled: false});
  g.translate(0, 0, -t / 2);
  return g;
}
// a canvas texture for the front-plate indicators and the rating plate
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const redraw = (...a) => {
    draw(c.getContext('2d'), w, h, ...a);
    tex.needsUpdate = true;
  };
  return {tex, redraw};
}

export function buildPanel() {
  const root = new THREE.Group();
  const groups = {}; // part id -> Object3D
  const mats = new Map(); // `${kind}|${id}` -> material
  const anchors = {}; // part id -> [Object3D, local point]
  const allMats = [];
  const mat = (kind, id) => {
    const key = `${kind}|${id}`;
    let m = mats.get(key);
    if (!m) {
      const k = KIND[kind];
      m = new THREE.MeshStandardMaterial({...k, envMapIntensity: 0.55, side: kind === 'sheet' || kind === 'sheetIn' || kind === 'insul' ? THREE.DoubleSide : THREE.FrontSide});
      m.userData = {kind, id, baseOpacity: k.opacity ?? 1, baseTransparent: !!k.transparent, sys: SYS_OF[id] || 'cubicle', sheet: SHEETS.has(id), wall: WALLS.has(id)};
      mats.set(key, m);
      allMats.push(m);
    }
    return m;
  };
  const G = (id, parent = root) => {
    const g = new THREE.Group();
    g.name = id;
    parent.add(g);
    if (!groups[id]) groups[id] = g;
    return g;
  };
  const add = (geo, kind, id, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat(kind, id));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d, kind, id, parent, x, y, z, rx, ry, rz) => add(new THREE.BoxGeometry(w, h, d), kind, id, parent, x, y, z, rx, ry, rz);
  const rbox = (w, h, d, r, kind, id, parent, x, y, z) => add(new RoundedBoxGeometry(w, h, d, 2, r), kind, id, parent, x, y, z);
  const cyl = (r, h, kind, id, parent, x, y, z, rx = 0, ry = 0, rz = 0, seg = 20) => add(new THREE.CylinderGeometry(r, r, h, seg), kind, id, parent, x, y, z, rx, ry, rz);
  const anchor = (id, obj, x, y, z) => (anchors[id] = [obj, new V3(x, y, z)]);

  const W = P.width;
  const D = P.depth;
  const H = P.body;
  const zf = P.zf;
  const zp = P.zp;
  const zc = P.zc;
  const zr = -D / 2;
  const X = P.phaseX;
  const zS = zf - P.z396; // support plate 396
  const zB = zf - P.zBus; // busbars
  const zT = zf - P.zCT; // CT body centre
  const zE = zf - P.esZ; // earthing switch shaft

  // ============================================================ the cubicle (stationary part, even numbers)
  const cub = G('cubicle');
  {
    const g = G('30', cub);
    box(W, 0.004, D, 'sheet', '30', g, 0, 0.002, 0);
    anchor('30', g, 0.25, 0.01, 0.45);
  }
  // walls: left partition 560 to the next panel, right end plate 180 (feeder panel no. 1 as right end panel, 102/2)
  {
    const g = G('560', cub);
    box(0.004, H, D, 'sheet', '560', g, -W / 2, H / 2, 0);
    const e = G('180', cub);
    box(0.006, H, D, 'sheet', '180', e, W / 2 + 0.001, H / 2, 0);
    const r = G('386', cub);
    box(W, H, 0.004, 'sheet', '386', r, 0, H / 2, zr + 0.002);
  }
  // front posts 654 / 90 with the eye hooks 620 / 86 the front plate hooks into, the mediate struts 156
  {
    const g = G('90', cub);
    const l = G('654', cub);
    for (const [grp, sx] of [[l, -1], [g, 1]]) {
      box(0.03, H, 0.04, 'frame', grp.name, grp, sx * (W / 2 - 0.016), H / 2, zf - 0.02);
      for (const y of [0.32, 0.8, 1.28]) box(0.018, 0.035, 0.02, 'galv', grp.name, grp, sx * (W / 2 - 0.036), y, zf - 0.03);
    }
    anchor('654', l, -W / 2 + 0.016, 0.3, zf);
    anchor('560', G('560', cub), -W / 2 - 0.003, 0.95, -0.2);
    const m = G('156', cub);
    for (const sx of [-1, 1]) box(0.03, H, 0.03, 'frame', '156', m, sx * (W / 2 - 0.016), H / 2, zp - 0.02);
  }
  // the roof: top cover 544 under the LV box, pressure relief flaps 538 (truck), 486 (busbar), 480 (cable) (111/16)
  const flaps = {};
  {
    const g = G('544', cub);
    box(W, 0.004, zf - 0.11 + 0.002, 'sheet', '544', g, 0, H, (zf + 0.11) / 2);
    const spans = {'538': [zp, 0.11], '486': [-0.4, zp], '480': [zr, -0.4]};
    for (const [id, [z0, z1]] of Object.entries(spans)) {
      const f = G(id, cub);
      const hinge = new THREE.Group();
      hinge.position.set(0, H, z0);
      f.add(hinge);
      box(W - 0.02, 0.006, z1 - z0 - 0.006, 'sheet', id, hinge, 0, 0.004, (z1 - z0) / 2);
      box(W - 0.02, 0.02, 0.01, 'frame', id, hinge, 0, 0.012, z1 - z0 - 0.008);
      flaps[id] = {g: f, hinge, z0, z1};
      anchor(id, hinge, 0.2, 0.01, (z1 - z0) / 2);
    }
    // main earthing bar 548 along the front edge of the roof
    box(W, 0.008, 0.03, 'copper', '548', G('548', cub), 0, H + 0.006, zf - 0.03);
  }
  // recess plate 568 at the top of the truck compartment, LV socket 592 on its right with latch 588 (102/5)
  const socket = new V3(0.2, P.partTop - 0.035, 0.06);
  {
    const g = G('568', cub);
    box(W - 0.02, 0.006, zf - zp - 0.06, 'sheetIn', '568', g, 0, P.partTop, (zf + zp) / 2 - 0.02);
    const s = G('592', cub);
    box(0.1, 0.05, 0.05, 'dark', '592', s, socket.x, socket.y + 0.01, socket.z - 0.03);
    cyl(0.034, 0.05, 'dark', '592', s, socket.x, socket.y, socket.z - 0.005, PI / 2);
    box(0.012, 0.05, 0.06, 'galv', '592', s, socket.x + 0.05, 1.4, socket.z);
    anchor('592', s, socket.x + 0.04, socket.y, socket.z);
    const l = G('588', cub);
    box(0.02, 0.012, 0.16, 'galv', '588', l, socket.x - 0.05, socket.y - 0.035, socket.z + 0.04);
  }
  // floor: centring rail 66, stop 78 at its rear, interlocking channel 50 under shaft 51, earthing bar 40 (102/4 fig 5)
  {
    const g = G('66', cub);
    box(0.035, 0.045, zf - zp - 0.02, 'galv', '66', g, 0, 0.026, (zf + zp) / 2 + 0.01);
    const st = G('78', cub);
    box(0.08, 0.06, 0.03, 'galv', '78', st, 0, 0.034, zp + 0.035);
    const ch = G('50', cub);
    box(0.14, 0.004, 0.24, 'galv', '50', ch, -0.12, 0.006, zf - 0.17);
    for (const [x, z, w, d] of [[-0.19, zf - 0.17, 0.012, 0.24], [-0.05, zf - 0.17, 0.012, 0.24], [-0.12, zf - 0.07, 0.07, 0.012], [-0.1, zf - 0.2, 0.05, 0.012]]) box(w, 0.04, d, 'galv', '50', ch, x, 0.026, z);
    anchor('50', ch, -0.12, 0.04, zf - 0.17);
    const e = G('40', cub);
    box(0.03, 0.006, zf - zp - 0.04, 'copper', '40', e, -0.17, 0.006, (zf + zp) / 2);
  }
  // upper partition 374 with the top barrier boxes 360 on the diagonal, lower partition 150 with the boxes 316 in a
  // row and the two inspection windows 314; shutters inside every box (102/6 fig 9)
  const BW = P.boxW + 0.016; // outer size of a barrier box around its 130 x 90 mm opening
  const BH = P.boxH + 0.016;
  const shutters = {U: [], L: []};
  const barrierBox = (id, parent, x, y, kind = 'insul') => {
    const z0 = zp;
    const d = P.zBox;
    const t = 0.008;
    box(BW, t, d, kind, id, parent, x, y + BH / 2 - t / 2, z0 - d / 2);
    box(BW, t, d, kind, id, parent, x, y - BH / 2 + t / 2, z0 - d / 2);
    box(t, BH, d, kind, id, parent, x - BW / 2 + t / 2, y, z0 - d / 2);
    box(t, BH, d, kind, id, parent, x + BW / 2 - t / 2, y, z0 - d / 2);
    // a flange round the mouth on the partition face
    box(BW + 0.02, 0.01, 0.006, kind, id, parent, x, y + BH / 2 + 0.005, z0 + 0.011);
    box(BW + 0.02, 0.01, 0.006, kind, id, parent, x, y - BH / 2 - 0.005, z0 + 0.011);
    // the shutter: a flap hinged at the top of the mouth, lifted rearward by the arm's slide piece (102/6 fig 9)
    const hinge = new THREE.Group();
    hinge.position.set(x, y + BH / 2 - 0.012, z0 - 0.012);
    parent.add(hinge);
    box(BW - 0.02, BH - 0.026, 0.005, 'dark', id, hinge, 0, -(BH - 0.026) / 2, 0);
    return hinge;
  };
  const partU = G('374', cub);
  {
    const y0 = P.joint;
    const holes = X.map((x, i) => [x, P.armUp[i] - y0, P.boxW, P.boxH]);
    add(plateGeo(W - 0.008, P.partTop - y0, 0.008, holes), 'insul', '374', partU, 0, y0, zp + 0.004);
    const bx = G('360', partU);
    X.forEach((x, i) => shutters.U.push(barrierBox('360', bx, x, P.armUp[i])));
    anchor('360', bx, X[0], P.armUp[0] + 0.05, zp);
    anchor('374', partU, -0.28, 1.0, zp + 0.01);
    // a warning triangle on the partition
    add(new THREE.CircleGeometry(0.035, 3), 'yellow', '374', partU, 0.22, 1.32, zp + 0.01, 0, 0, PI / 2);
  }
  const partL = G('150', cub);
  {
    const y0 = P.partBot;
    const holes = X.map((x) => [x, P.armLow - y0, P.boxW, P.boxH]);
    holes.push([X[0], P.winY - y0, P.winW, P.winH], [X[2], P.winY - y0, P.winW, P.winH]);
    add(plateGeo(W - 0.008, P.joint - y0, 0.008, holes), 'insul', '150', partL, 0, y0, zp + 0.004);
    const bx = G('316', partL);
    X.forEach((x) => shutters.L.push(barrierBox('316', bx, x, P.armLow)));
    for (const x of [X[0], X[2]]) box(P.winW, P.winH, 0.004, 'glass', '150', partL, x, P.winY, zp + 0.004);
    add(new THREE.CircleGeometry(0.035, 3), 'yellow', '150', partL, 0, 0.27, zp + 0.01, 0, 0, PI / 2);
    anchor('316', bx, X[2], P.armLow - 0.05, zp);
    anchor('150', partL, -0.27, 0.3, zp + 0.01);
  }
  // the 110 mm sill under partition 150
  box(W - 0.01, P.partBot - 0.004, 0.012, 'sheetIn', '30', G('30s', cub), 0, P.partBot / 2 + 0.002, zp);
  // horizontal partition 340 between busbar and cable compartments
  box(W - 0.01, 0.008, zp - zr - 0.01, 'insul', '340', G('340', cub), 0, P.busFloor, (zp + zr) / 2 - 0.003);
  // busbar compartment: support plate 396 with the diagonal brace 402, ribbed insulators 418, busbars 450 at three
  // heights running through the board, fixed contacts 430 reaching forward into the barrier boxes (102/3 fig 3)
  {
    const sp = G('396', cub);
    box(W - 0.01, H - P.busFloor - 0.02, 0.006, 'sheetIn', '396', sp, 0, (H + P.busFloor) / 2, zS);
    const br = G('402', cub);
    const pts = X.map((x, i) => new V3(x, P.armUp[i], zS + 0.008));
    const a = pts[0].clone().add(new V3(-0.1, 0.1, 0));
    const b = pts[2].clone().add(new V3(0.1, -0.06, 0));
    for (const [p0, p1] of [[a, pts[0]], [pts[0], pts[1]], [pts[1], pts[2]], [pts[2], b]]) {
      const m = box(0.05, 0.012, p0.distanceTo(p1) + 0.03, 'frame', '402', br, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, zS + 0.008);
      m.lookAt(p1.x, p1.y, zS + 0.008);
    }
  }
  const bus = G('bus', cub);
  const busPh = [];
  {
    X.forEach((x, i) => {
      const ph = G(`bus${i}`, bus);
      busPh.push(ph);
      const ins = ph;
      const bb = ph;
      const fc = ph;
      const y = P.armUp[i];
      add(ribbedGeo(zB - zS - 0.035, 0.026, 0.045, 3), 'resin', '418', ins, x, y, zS + 0.003, PI / 2);
      // two parallel flat bars on edge with the intermediate piece 450.6 at the insulator (201/8)
      for (const dz of [-0.018, 0.018]) box(W - 0.01, 0.08, 0.01, 'copper', '450', bb, 0, y, zB + dz);
      box(0.06, 0.08, 0.026, 'copper', '450', bb, x, y, zB);
      // fixed contact 430: a silvered flat bar forward into the box
      box(0.05, 0.014, zB - zc + 0.01, 'copper', '430', fc, x, y, (zc + zB) / 2 + 0.005);
      box(0.054, 0.018, 0.05, 'silver', '430', fc, x, y, zc + 0.02);
    });
    anchor('450', busPh[0], X[1] + 0.15, P.armUp[0], zB);
    anchor('430', busPh[1], X[1], P.armUp[1] + 0.01, (zc + zB) / 2);
    anchor('418', busPh[2], X[2], P.armUp[2] + 0.04, (zS + zB) / 2);
  }
  // cable compartment: support plate 220 under partition 340, post CTs 290 with the lower fixed contacts 300 at their
  // top terminal and the cable connectors 280 at the bottom, earthing switch 256 under them (102/8 fig 13)
  const ctu = G('ct', cub);
  const knives = [];
  const zLug = zT + 0.13; // the cable lugs, in front of the CTs over the cable openings (200/3 fig 4)
  const esContact = new V3(0, 0, 0); // fixed contact 256.18 on connection piece 280, one knife length from the shaft
  {
    const sp = G('220', ctu);
    box(W - 0.03, 0.008, 0.34, 'galv', '220', sp, 0, P.busFloor - 0.012, zT - 0.02);
    anchor('220', sp, -0.3, P.busFloor - 0.012, zT + 0.1);
    const ct = G('290', ctu);
    const fx = G('300', ctu);
    const cn = G('280', ctu);
    X.forEach((x) => {
      // post CT 136 x 265 mm hung from plate 220, terminal L (top, 670 mm) and K (bottom, 420 mm)
      rbox(0.12, P.ctH, P.ctD, 0.012, 'resin', '290', ct, x, P.ctTopY - P.ctH / 2, zT);
      box(0.07, P.busFloor - 0.016 - P.ctTopY, 0.07, 'resin', '290', ct, x, (P.busFloor - 0.016 + P.ctTopY) / 2, zT);
      // terminal L carries the fixed contact 300 forward into box 316
      box(0.05, 0.014, zT + P.ctD / 2 - zc, 'copper', '300', fx, x, P.armLow, (zc + zT + P.ctD / 2) / 2);
      box(0.054, 0.018, 0.05, 'silver', '300', fx, x, P.armLow, zc + 0.02);
      // terminal K: connection piece 280 forward to the cable lug, bolting point at 415 mm (202/4)
      box(0.05, 0.014, zLug - zT + 0.02, 'copper', '280', cn, x, 0.425, (zLug + zT) / 2 + 0.01);
      box(0.05, 0.06, 0.014, 'copper', '280', cn, x, P.lugY - 0.012, zLug);
    });
    anchor('290', ct, X[0] - 0.07, P.ctTopY - P.ctH / 2, zT);
    anchor('300', fx, X[1], P.armLow + 0.01, (zc + zT) / 2);
    // earthing switch 256: shaft .10 across the panel low at the rear (320 mm), knives .6 (210 mm) swing up onto the
    // fixed contacts .18 on the connection pieces 280 (102/8 fig 13, 202/4-202/8)
    const es = G('256', ctu);
    cyl(0.012, W - 0.06, 'galv', '256', es, 0, P.esY, zE, 0, 0, PI / 2);
    const dirC = new V3(0, 0.13, 0.17).normalize();
    esContact.set(0, P.esY + dirC.y * P.knife, zE + dirC.z * P.knife);
    X.forEach((x) => {
      box(0.04, 0.025, 0.03, 'copper', '256', es, x, esContact.y + 0.01, esContact.z);
      box(0.012, esContact.y + 0.01 - 0.425, 0.012, 'copper', '256', es, x, (esContact.y + 0.425) / 2 + 0.005, esContact.z);
      cyl(0.02, 0.05, 'galv', '256', es, x, P.esY, zE, 0, 0, PI / 2);
      const k = new THREE.Group();
      k.position.set(x, P.esY, zE);
      es.add(k);
      box(0.01, P.knife, 0.03, 'copper', '256', k, -0.011, P.knife / 2, 0);
      box(0.01, P.knife, 0.03, 'copper', '256', k, 0.011, P.knife / 2, 0);
      knives.push(k);
    });
    anchor('256', es, X[2] + 0.05, P.esY, zE);
  }
  // the cables: three single-core cables up through the 3-part bottom cover 200 to the connection pieces 280
  const cables = G('cables', cub);
  {
    X.forEach((x) => {
      cyl(0.022, 0.55, 'cable', 'cables', cables, x, 0.005, zLug + 0.03);
      cyl(0.032, 0.14, 'black', 'cables', cables, x, 0.28, zLug + 0.03);
      box(0.04, 0.06, 0.012, 'copper', 'cables', cables, x, P.lugY - 0.015, zLug + 0.014);
    });
    box(W - 0.01, 0.006, zp - zr, 'sheetIn', '200', G('200', cub), 0, 0.006, (zr + zp) / 2);
  }
  // earthing switch drive shaft 248, low on the right from the cable compartment to the truck front, with stop 130
  // and the detachable handle 75 (102/10, 111/13, 300/19)
  const es248 = G('248', cub);
  const shaft248 = new THREE.Group();
  shaft248.position.set(W / 2 - 0.05, 0.14, 0);
  es248.add(shaft248);
  cyl(0.011, zf - zE - 0.02, 'galv', '248', shaft248, 0, 0, (zf - 0.02 + zE) / 2, PI / 2);
  const stop130 = new THREE.Group();
  stop130.position.set(0, 0, zp + 0.12);
  shaft248.add(stop130);
  groups['130'] = stop130;
  box(0.016, 0.1, 0.03, 'red', '130', stop130, 0, -0.05, 0);
  const handle75 = new THREE.Group();
  handle75.position.set(0, 0, zf + 0.01);
  shaft248.add(handle75);
  groups['75'] = handle75;
  cyl(0.008, 0.42, 'galv', '75', handle75, 0, 0.21, 0.015);
  cyl(0.016, 0.1, 'black', '75', handle75, 0, 0.42, 0.015, 0, 0, PI / 2);
  anchor('248', shaft248, 0, 0, zp + 0.3);
  anchor('130', stop130, 0, -0.04, 0);
  anchor('75', handle75, 0, 0.32, 0.015);
  // linkage 240 from a crank on 248 to a crank on the earthing shaft
  const crank248 = new THREE.Group();
  crank248.position.set(0, 0, zE + 0.02);
  shaft248.add(crank248);
  box(0.012, 0.07, 0.012, 'galv', '256', crank248, 0, 0.035, 0);

  // low-voltage compartment 530 on the roof at the front, door hinged on the left (104/1)
  const lvDoor = new THREE.Group();
  {
    const g = G('530', cub);
    const z0 = zf - P.lvD;
    const y0 = H + 0.004;
    box(W, 0.004, P.lvD, 'sheet', '530', g, 0, y0 + P.lvH, zf - P.lvD / 2);
    box(0.004, P.lvH, P.lvD, 'sheet', '530', g, -W / 2, y0 + P.lvH / 2, zf - P.lvD / 2);
    box(0.004, P.lvH, P.lvD, 'sheet', '530', g, W / 2, y0 + P.lvH / 2, zf - P.lvD / 2);
    box(W, P.lvH, 0.004, 'sheet', '530', g, 0, y0 + P.lvH / 2, z0);
    // inside: instrument plate with relays and a terminal strip
    box(W - 0.06, P.lvH - 0.06, 0.004, 'sheetIn', '530', g, 0, y0 + P.lvH / 2, z0 + 0.06);
    for (let i = 0; i < 4; i++) box(0.11, 0.14, 0.09, 'dark', '530', g, -0.25 + i * 0.165, y0 + 0.42, z0 + 0.11);
    for (let i = 0; i < 18; i++) box(0.014, 0.05, 0.04, i % 6 === 5 ? 'red' : 'white', '530', g, -0.28 + i * 0.033, y0 + 0.13, z0 + 0.09);
    anchor('530', g, 0.25, y0 + P.lvH * 0.75, zf);
    lvDoor.position.set(-W / 2, y0, zf);
    g.add(lvDoor);
    groups['530.door'] = lvDoor;
    box(W - 0.004, P.lvH - 0.004, 0.018, 'sheet', '530.door', lvDoor, W / 2, P.lvH / 2, 0.009);
    // an ammeter, a control switch, signal lamps, the key lock; the rating plate inside at the bottom (100/1)
    cyl(0.055, 0.02, 'white', '530.door', lvDoor, W / 2 - 0.14, P.lvH * 0.64, 0.025, PI / 2, 0, 0, 32);
    cyl(0.03, 0.03, 'black', '530.door', lvDoor, W / 2 + 0.1, P.lvH * 0.64, 0.028, PI / 2);
    box(0.012, 0.05, 0.02, 'white', '530.door', lvDoor, W / 2 + 0.1, P.lvH * 0.64, 0.045);
    cyl(0.014, 0.016, 'green', '530.door', lvDoor, W / 2 + 0.22, P.lvH * 0.7, 0.025, PI / 2);
    cyl(0.014, 0.016, 'red', '530.door', lvDoor, W / 2 + 0.22, P.lvH * 0.58, 0.025, PI / 2);
    cyl(0.012, 0.02, 'galv', '530.door', lvDoor, W - 0.05, P.lvH * 0.45, 0.025, PI / 2);
    box(0.16, 0.06, 0.002, 'galv', '530.door', lvDoor, W / 2, 0.08, -0.001);
  }

  // ============================================================ the truck (odd numbers): 3AF vacuum breaker truck
  const truck = G('truck');
  const tilt = new THREE.Group(); // pitch for the wheeling device, about the rear roller contact
  tilt.position.set(0, 0, 0.06);
  truck.add(tilt);
  const tk = new THREE.Group();
  tk.position.set(0, 0, -0.06);
  tilt.add(tk);
  const zfp = zf - 0.035; // rear face of the front plate
  {
    // base plate 121 with the centring channel 151 under it, rollers 65 / 699 front and 133 / 681 rear on the
    // 581 mm track, earthing pin 125 on the floor bar 40 (105/5)
    const b = G('121', tk);
    box(0.62, 0.01, zfp - 0.0, 'galv', '121', b, 0, 0.095, zfp / 2);
    anchor('121', b, -0.25, 0.1, 0.12);
    const c = G('151', tk);
    for (const sx of [-1, 1]) box(0.008, 0.035, zfp - 0.02, 'galv', '151', c, sx * 0.028, 0.072, zfp / 2);
    const fr = G('65', tk);
    const rr = G('133', tk);
    for (const sx of [-1, 1]) {
      for (const [grp, z] of [[fr, zfp - 0.08], [rr, 0.06]]) {
        cyl(0.045, 0.03, 'galv', grp.name, grp, sx * (P.track / 2), 0.045, z, 0, 0, PI / 2, 24);
        box(0.012, 0.06, 0.06, 'galv', grp.name, grp, sx * (P.track / 2 - 0.025), 0.07, z);
      }
    }
    anchor('65', fr, P.track / 2, 0.045, zfp - 0.08);
    anchor('133', rr, -P.track / 2, 0.045, 0.06);
    const e = G('125', tk);
    cyl(0.01, 0.08, 'copper', '125', e, -0.17, 0.05, 0.3);
    // side plates 91 (right) / 669 (left), top cross girder 619, lower cover plate 689
    const sp = G('91', tk);
    const sl = G('669', tk);
    for (const [grp, sx] of [[sl, -1], [sp, 1]]) box(0.005, 1.22, 0.36, 'galv', grp.name, grp, sx * 0.3, 0.71, zfp - 0.18);
    box(0.6, 0.04, 0.06, 'galv', '619', G('619', tk), 0, 1.3, zfp - 0.24);
    box(0.6, 0.18, 0.005, 'galv', '689', G('689', tk), 0, 0.19, zfp - 0.01);
    // the pole frame: a vertical plate behind the mechanism housing that carries the post insulators
    box(0.6, 0.5, 0.008, 'galv', '91', sp, 0, 0.78, 0.39);
  }
  // locking shaft 51 low on the front plate, its crank down into channel 50 (111/3-111/4), the locating lever 47
  const shaft51 = new THREE.Group();
  shaft51.position.set(-0.12, P.shaft51Y, 0);
  tk.add(shaft51);
  groups['51'] = shaft51;
  cyl(0.012, zf - 0.38, 'galv', '51', shaft51, 0, 0, (zf + 0.38) / 2, PI / 2);
  const crank51 = new THREE.Group();
  crank51.position.set(0, 0, zf - 0.17);
  shaft51.add(crank51);
  box(0.02, 0.09, 0.016, 'galv', '51', crank51, 0, -0.045, 0);
  cyl(0.012, 0.03, 'galv', '51', crank51, 0, -0.085, 0, PI / 2);
  anchor('51', shaft51, 0, 0, zf + 0.005);
  const lever = new THREE.Group();
  lever.position.set(-0.12, P.shaft51Y, zf + 0.01);
  tk.add(lever);
  groups['47'] = lever;
  cyl(0.009, 0.62, 'galv', '47', lever, 0, 0.31, 0.012);
  cyl(0.02, 0.14, 'black', '47', lever, 0, 0.62, 0.012, 0, 0, PI / 2);
  anchor('47', lever, 0, 0.45, 0.012);

  // front plate 613 (lifted by shaft 51, removable off the truck): handles 401 / 649, ON 653 / OFF 673, the indicator
  // window with 339.55 spring-charged, 339.58 ON/OFF and 339.59 counter, slide plate 389, the arc scale of shaft 51
  const front = G('613', tk);
  const onoff = canvasTex(128, 128, (x, w, h, on) => {
    x.fillStyle = on ? '#c23a2e' : '#2f8a52';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff';
    x.font = 'bold 92px Inter, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(on ? 'I' : 'O', w / 2, h / 2 + 4);
  });
  const sprTex = canvasTex(128, 128, (x, w, h, charged) => {
    x.fillStyle = '#f3efe2';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#1c1d1f';
    x.lineWidth = 8;
    x.beginPath();
    x.moveTo(18, 20);
    x.lineTo(18, 108);
    x.stroke();
    x.lineWidth = 6;
    x.beginPath();
    const n = 6;
    const len = charged ? 50 : 92;
    for (let i = 0; i <= n * 2; i++) x.lineTo(24 + (len * i) / (n * 2), i % 2 ? 40 : 88);
    x.stroke();
  });
  const cntTex = canvasTex(256, 64, (x, w, h, n) => {
    x.fillStyle = '#111';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#eee';
    x.font = '600 46px "JetBrains Mono", monospace';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(String(n).padStart(5, '0'), w / 2, h / 2 + 2);
  });
  const scaleTex = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#b8b3a4';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#2a2a2a';
    x.lineWidth = 4;
    x.beginPath();
    x.arc(w / 2, h - 6, 100, PI * 1.2, PI * 1.8);
    x.stroke();
    x.fillStyle = '#2a2a2a';
    for (const a of [PI * 1.25, PI * 1.5, PI * 1.75]) {
      x.beginPath();
      x.arc(w / 2 + Math.cos(a) * 100, h - 6 + Math.sin(a) * 100, 7, 0, PI * 2);
      x.fill();
    }
  });
  scaleTex.redraw();
  {
    const FH = H - 0.03; // the plate from 15 mm above the floor to just under the roof
    box(0.744, FH, 0.006, 'sheet', '613', front, 0, 0.015 + FH / 2, zf - 0.003);
    // the plate's folded edges
    for (const sx of [-1, 1]) box(0.006, FH, 0.035, 'sheet', '613', front, sx * 0.369, 0.015 + FH / 2, zf - 0.0175);
    box(0.744, 0.006, 0.035, 'sheet', '613', front, 0, 0.012 + FH, zf - 0.0175);
    for (const sx of [-1, 1]) {
      const h = G(sx < 0 ? '649' : '401', front);
      cyl(0.011, 0.2, 'galv', h.name, h, sx * 0.25, P.handleY, zf + 0.04);
      for (const dy of [-0.1, 0.1]) cyl(0.008, 0.045, 'galv', h.name, h, sx * 0.25, P.handleY + dy, zf + 0.02, PI / 2);
    }
    const on = G('653', front);
    cyl(0.022, 0.025, 'black', '653', on, 0.12, 1.22, zf + 0.012, PI / 2);
    add(new THREE.CircleGeometry(0.017, 24), 'white', '653', on, 0.12, 1.22, zf + 0.0255);
    const off = G('673', front);
    cyl(0.022, 0.025, 'red', '673', off, 0.12, 1.12, zf + 0.012, PI / 2);
    anchor('653', on, 0.12, 1.22, zf + 0.02);
    anchor('673', off, 0.12, 1.12, zf + 0.02);
    // the window: indicators behind glass
    box(0.2, 0.16, 0.004, 'dark', '613', front, -0.09, 1.17, zf + 0.002);
    const ind = G('339.58', front);
    add(new THREE.PlaneGeometry(0.05, 0.05), 'white', '339.58', ind, -0.13, 1.2, zf + 0.0045).material.map = onoff.tex;
    const spr = G('339.55', front);
    add(new THREE.PlaneGeometry(0.05, 0.05), 'white', '339.55', spr, -0.05, 1.2, zf + 0.0045).material.map = sprTex.tex;
    add(new THREE.PlaneGeometry(0.11, 0.028), 'white', '339.59', G('339.59', front), -0.09, 1.13, zf + 0.0045).material.map = cntTex.tex;
    box(0.2, 0.16, 0.003, 'glass', '613', front, -0.09, 1.17, zf + 0.007);
    anchor('339.58', ind, -0.13, 1.2, zf + 0.005);
    anchor('339.55', spr, -0.05, 1.2, zf + 0.005);
    // slide plate 389 over the hand-crank opening, the rating plate, the shaft scale
    box(0.05, 0.11, 0.004, 'galv', '389', G('389', front), -0.27, 1.22, zf + 0.004);
    box(0.13, 0.06, 0.002, 'galv', '613', front, -0.09, 1.03, zf + 0.002);
    add(new THREE.PlaneGeometry(0.2, 0.1), 'white', '613', front, -0.12, P.shaft51Y + 0.085, zf + 0.002).material.map = scaleTex.tex;
    // hooks 395 on the rear, three per side (111/15)
    const hk = G('395', front);
    for (const sx of [-1, 1]) for (const y of [0.32, 0.8, 1.28]) box(0.02, 0.03, 0.03, 'galv', '395', hk, sx * 0.34, y + 0.03, zfp - 0.012);
    anchor('395', hk, 0.34, 1.31, zfp - 0.012);
    anchor('613', front, 0.3, 0.62, zf + 0.004);
  }

  // the 3AF mechanism housing 339 behind the front plate, its cover 339.60.1, inside: closing spring, tripping spring
  // 339.64, breaker shaft 339.63 with lever .3, dashpot 339.61.8 (106/2 fig 3, 111/9 fig 22)
  const mech = G('339', tk);
  const zm0 = 0.4;
  const zm1 = zfp - 0.012;
  {
    box(0.44, 0.005, zm1 - zm0, 'galv', '339', mech, 0, 0.7, (zm0 + zm1) / 2);
    box(0.44, 0.005, zm1 - zm0, 'galv', '339', mech, 0, 0.22, (zm0 + zm1) / 2);
    box(0.005, 0.48, zm1 - zm0, 'galv', '339', mech, -0.22, 0.46, (zm0 + zm1) / 2);
    box(0.005, 0.48, zm1 - zm0, 'galv', '339', mech, 0.22, 0.46, (zm0 + zm1) / 2);
    const cs = G('339.cs', mech);
    add(coilGeo(0.035, 0.3, 11, 0.006), 'spring', '339.cs', cs, 0.13, 0.3, 0.5);
    cyl(0.01, 0.34, 'galv', '339.cs', cs, 0.13, 0.47, 0.5);
    const ts = G('339.64', mech);
    add(coilGeo(0.03, 0.22, 9, 0.005), 'spring', '339.64', ts, -0.12, 0.26, 0.5);
    cyl(0.009, 0.26, 'galv', '339.64', ts, -0.12, 0.37, 0.5);
    anchor('339.64', ts, -0.12, 0.38, 0.5);
    anchor('339.cs', cs, 0.13, 0.45, 0.5);
    const dp = G('339.61.8', mech);
    cyl(0.018, 0.12, 'dark', '339.61.8', dp, 0.0, 0.3, 0.52);
  }
  const shaft63 = new THREE.Group();
  shaft63.position.set(0, 0.55, 0.43);
  mech.add(shaft63);
  groups['339.63'] = shaft63;
  cyl(0.014, 0.66, 'galv', '339.63', shaft63, 0, 0, 0, 0, 0, PI / 2);
  for (const x of X) box(0.014, 0.012, 0.09, 'galv', '339.63', shaft63, x, 0, -0.045);
  box(0.016, 0.07, 0.014, 'galv', '339.63', shaft63, -0.2, 0.035, 0);
  anchor('339.63', shaft63, -0.2, 0.05, 0);
  const cover = G('339.60.1', mech);
  {
    box(0.44, 0.48, 0.006, 'galv', '339.60.1', cover, 0, 0.46, zm1 + 0.003);
    cyl(0.016, 0.01, 'black', '339.60.1', cover, -0.12, 0.62, zm1 + 0.008, PI / 2);
    cyl(0.018, 0.012, 'black', '339.60.1', cover, 0.12, 0.62, zm1 + 0.008, PI / 2);
    cyl(0.018, 0.012, 'red', '339.60.1', cover, 0.12, 0.55, zm1 + 0.008, PI / 2);
    box(0.12, 0.05, 0.003, 'white', '339.60.1', cover, -0.05, 0.36, zm1 + 0.007);
    anchor('339.60.1', cover, 0.18, 0.3, zm1 + 0.006);
  }

  // the three poles: post insulators .16.1 / .16.2 from the pole frame, upper and lower pole supports .20 / .40, the
  // vacuum interrupter .30 between them, insulating strut .28, insulated coupler .48 with contact pressure spring .49
  const poles = G('poles', tk);
  const zPole = 0.235;
  const yLo = 0.58;
  const yUp = 0.9;
  const moving = [];
  const couplers = [];
  const poleSets = X.map((x, i) => {
    const pg = G(`pole${i}`, poles);
    const pi16 = G('339.16', pg);
    add(ribbedGeo(0.14, 0.022, 0.036, 3), 'resin', '339.16', pi16, x, yUp + 0.045, 0.385, -PI / 2);
    add(ribbedGeo(0.14, 0.022, 0.036, 3), 'resin', '339.16', pi16, x, yLo + 0.04, 0.385, -PI / 2);
    const up = G('339.20', pg);
    box(0.12, 0.09, 0.1, 'galv', '339.20', up, x, yUp + 0.045, zPole);
    const lo = G('339.40', pg);
    box(0.12, 0.085, 0.1, 'galv', '339.40', lo, x, yLo + 0.0425, zPole);
    const vi = G('339.30', pg);
    add(ribbedGeo(yUp - yLo - 0.09, 0.048, 0.052, 2), 'ceramic', '339.30', vi, x, yLo + 0.09, zPole);
    cyl(0.052, 0.012, 'galv', '339.30', vi, x, yUp - 0.006, zPole);
    cyl(0.052, 0.012, 'galv', '339.30', vi, x, yLo + 0.09, zPole);
    const st = G('339.28', pg);
    const s = box(0.018, 0.33, 0.03, 'insul', '339.28', st, x + 0.07, (yUp + yLo) / 2 + 0.03, (zPole + 0.385) / 2);
    s.rotation.x = Math.atan2(0.385 - zPole, 0.33) * 0.9;
    // moving contact stem out of the bottom of the interrupter, coupler .48 from the shaft lever, spring .49
    const mv = new THREE.Group();
    pg.add(mv);
    cyl(0.012, 0.1, 'silver', '339.30', mv, x, yLo + 0.02, zPole);
    moving.push(mv);
    const cp = G('339.48', pg);
    const rod = cyl(0.011, 1, 'insul', '339.48', cp, 0, 0, 0);
    const spr = add(coilGeo(0.02, 0.07, 6, 0.004), 'spring', '339.49', G('339.49', pg), x, yLo - 0.08, zPole);
    couplers.push({rod, spr, x});
    return {pg, x, i};
  });
  anchor('339.30', poleSets[0].pg, X[0] - 0.05, (yUp + yLo) / 2 + 0.05, zPole);
  anchor('339.20', poleSets[2].pg, X[2] + 0.06, yUp + 0.06, zPole);
  anchor('339.40', poleSets[2].pg, X[2] + 0.06, yLo + 0.04, zPole);
  anchor('339.48', poleSets[1].pg, X[1] + 0.02, yLo - 0.05, (zPole + 0.43) / 2);

  // contact arms: upper 423 (risers up to 1246 / 1046 / 906 mm) with run-in contacts 429, lower 295 at 665 mm with
  // 301; gaskets .5 seal the barrier box mouth in Service position (105/3-105/4, 203/2)
  const tipZ = zc - 0.03;
  const armsU = [];
  const armsL = [];
  const fingers = (kind, id, parent, x, y) => {
    box(0.07, 0.016, 0.075, 'silver', id, parent, x, y + 0.016, tipZ + 0.035);
    box(0.07, 0.016, 0.075, 'silver', id, parent, x, y - 0.016, tipZ + 0.035);
    box(0.074, 0.05, 0.012, kind, id, parent, x, y, tipZ + 0.075);
  };
  X.forEach((x, i) => {
    const g = G(`armU${i}`, tk);
    const y = P.armUp[i];
    const zr0 = zPole - 0.055;
    const ag = G('423', g);
    box(0.045, Math.max(0.02, y - yUp), 0.014, 'copper', '423', ag, x, (y + yUp) / 2, zr0);
    box(0.045, 0.014, zr0 - tipZ - 0.06, 'copper', '423', ag, x, y, (zr0 + tipZ + 0.06) / 2);
    box(P.boxW + 0.02, P.boxH + 0.02, 0.012, 'insul', '423', ag, x, y, zp + 0.02);
    const fg = G('429', g);
    fingers('galv', '429', fg, x, y);
    armsU.push(g);
  });
  X.forEach((x, i) => {
    const g = G(`armL${i}`, tk);
    const y = P.armLow;
    const ag = G('295', g);
    box(0.045, 0.014, zPole - 0.05 - tipZ - 0.06, 'copper', '295', ag, x, y, (zPole - 0.05 + tipZ + 0.06) / 2);
    box(P.boxW + 0.02, P.boxH + 0.02, 0.012, 'insul', '295', ag, x, y, zp + 0.02);
    const fg = G('301', g);
    fingers('galv', '301', fg, x, y);
    armsL.push(g);
  });
  anchor('423', armsU[0], X[0], P.armUp[0] + 0.01, 0.02);
  anchor('429', armsU[1], X[1], P.armUp[1] + 0.03, tipZ + 0.04);
  anchor('295', armsL[0], X[0], P.armLow + 0.01, 0.06);
  anchor('301', armsL[2], X[2], P.armLow - 0.03, tipZ + 0.04);

  // the LV plug 593 on its hose 587 (105/6): in socket 592, or lying on top of the truck (Isolated position)
  const plug = G('593', root);
  cyl(0.03, 0.15, 'dark', '593', plug, 0, 0, 0, PI / 2);
  cyl(0.034, 0.03, 'galv', '593', plug, 0, 0, -0.07, PI / 2);
  anchor('593', plug, 0, 0.03, 0.04);
  const hoseMat = mat('black', '587');
  let hose = null;
  let hoseKey = '';

  // the wheeling device 41: support plate .27 under the front plate, spindle .5, swivel roller .23 (300/15)
  const wheel = G('41', tk);
  {
    box(0.3, 0.012, 0.12, 'galv', '41', wheel, 0, 0.1, zf + 0.02);
    cyl(0.01, 0.16, 'galv', '41', wheel, 0, 0.18, zf + 0.09);
    box(0.06, 0.05, 0.06, 'dark', '41', wheel, 0, 0.27, zf + 0.09);
    cyl(0.04, 0.03, 'black', '41', wheel, 0, 0.04, zf + 0.09, 0, 0, PI / 2, 20);
    box(0.012, 0.08, 0.05, 'galv', '41', wheel, 0.025, 0.07, zf + 0.09);
    box(0.012, 0.08, 0.05, 'galv', '41', wheel, -0.025, 0.07, zf + 0.09);
    cyl(0.018, 0.12, 'black', '41', wheel, 0, 0.3, zf + 0.09, 0, 0, PI / 2);
    anchor('41', wheel, 0, 0.27, zf + 0.12);
  }

  // the voltage detector 365 in the release device 361 (300/18)
  const det = G('361', root);
  {
    const rel = G('361.r', det);
    cyl(0.03, 0.2, 'yellow', '361', rel, 0, 0, 0.1, PI / 2);
    const vd = G('365', det);
    cyl(0.012, 0.5, 'red', '365', vd, 0, 0, 0.35, PI / 2);
    cyl(0.02, 0.07, 'white', '365', vd, 0, 0, 0.0, PI / 2);
    cyl(0.022, 0.2, 'black', '365', vd, 0, 0, 0.6, PI / 2);
    anchor('361', det, 0, 0.04, 0.2);
  }


  // ============================================================ fasteners (kin.js FASTENERS; facts from 201/5-201/13,
  // 202/1-202/9, 300/22-300/23, 301/2, 400/9-400/10). Positions are the manual's where it shows them (partition fixing
  // maps 201/12-201/13, side drillings 201/6 fig 10, photos), EST where it only gives a count. Each fastener is drawn on
  // its own axis: +y of its geometry points out of the part, the way it unscrews.
  const FAST_COL = {torque: '#2f9a64', size: '#d9952b', none: '#4d79a8'};
  const headGeo = (kind, d) => {
    const parts = [];
    const s = d * 1.6; // across flats about 1.5-1.6 d (hex heads, nuts)
    const k = d * 0.65;
    const shank = new THREE.CylinderGeometry(d / 2, d / 2, d * 2.2, 10);
    shank.translate(0, -d * 1.1, 0);
    parts.push(shank);
    const washer = new THREE.CylinderGeometry(s * 0.62, s * 0.62, d * 0.16, 16);
    washer.translate(0, d * 0.08, 0);
    if (kind === 'hex' || kind === 'stud') {
      parts.push(washer);
      const h = new THREE.CylinderGeometry(s / Math.sqrt(3), s / Math.sqrt(3), k, 6);
      h.translate(0, d * 0.16 + k / 2, 0);
      parts.push(h);
      if (kind === 'stud') {
        const t = new THREE.CylinderGeometry(d / 2, d / 2, d * 0.9, 10);
        t.translate(0, d * 0.16 + k + d * 0.45, 0);
        parts.push(t);
      }
    } else if (kind === 'cap') {
      const c = new THREE.SphereGeometry(d * 1.05, 14, 8, 0, PI * 2, 0, PI / 2);
      const f = new THREE.CylinderGeometry(d * 1.35, d * 1.35, d * 0.14, 16);
      f.translate(0, d * 0.07, 0);
      parts.push(f, c);
    } else {
      // round and slotted heads: a low dome
      const c = new THREE.SphereGeometry(d * 0.9, 14, 6, 0, PI * 2, 0, PI / 2);
      c.scale(1, 0.55, 1);
      parts.push(c);
    }
    const g = mergeGeometries(parts.map((x) => x.toNonIndexed()));
    for (const x of parts) x.dispose();
    return g;
  };
  const FGEO = {};
  const geoFor = (kind, d) => (FGEO[`${kind}${d}`] ??= headGeo(kind, d));
  const fastMats = {};
  for (const st of ['torque', 'size', 'none']) {
    const m = new THREE.MeshStandardMaterial({color: '#9aa0a4', roughness: 0.4, metalness: 0.6, envMapIntensity: 0.6});
    m.userData = {kind: 'fast', id: `fast:${st}`, baseOpacity: 1, baseTransparent: false, sys: 'fast', sheet: false, wall: false, status: st};
    fastMats[st] = m;
    allMats.push(m);
  }
  const capMat = mat('black', 'fast:cap');
  capMat.userData.sys = 'fast';
  const fastGroups = []; // {spec, parent, kind, d, items: [{p, q}], mesh}
  const up = new V3(0, 1, 0);
  const fastAnchor = {};
  const fasten = (id, parent, kind, d, pts, dir) => {
    const spec = FASTENERS.find((f) => f.id === id);
    const q = new THREE.Quaternion().setFromUnitVectors(up, new V3(...dir).normalize());
    const items = pts.map((pt) => ({p: new V3(...pt), q, dir: new V3(...dir).normalize()}));
    const g = {spec, parent, kind, d, items};
    fastGroups.push(g);
    if (!fastAnchor[id]) fastAnchor[id] = [parent, items[0].p.clone()];
    return g;
  };
  const M12 = 0.012;
  const M8 = 0.008;
  const DU = 0.01; // size not given: drawn at 10 mm
  // C07 busbar joint bolts: 2 x 2 on the front of the intermediate piece 450.6 of every phase, heads to the front
  busPh.forEach((ph, i) => fasten('C07', ph, 'hex', M12, [[-0.015, 0.02], [0.015, 0.02], [-0.015, -0.02], [0.015, -0.02]].map(([dx, dy]) => [X[i] + dx, P.armUp[i] + dy, zB + 0.013]), [0, 0, 1]));
  // C16 insulator screws: heads behind support plate 396
  busPh.forEach((ph, i) => fasten('C16', ph, 'hex', DU, [[X[i], P.armUp[i], zS - 0.004]], [0, 0, -1]));
  // C17 CT unit: 4 studs with nuts through support plate 220, two at the front, two at the rear traverse
  fasten('C17', ctu, 'stud', DU, [[-0.33, zT + 0.13], [0.33, zT + 0.13], [-0.33, zT - 0.17], [0.33, zT - 0.17]].map(([x, z]) => [x, P.busFloor - 0.008, z]), [0, 1, 0]);
  // C13 cable lug bolts M12 8.8 on the connectors 280
  fasten('C13', ctu, 'hex', M12, X.map((x) => [x, P.lugY, zLug - 0.007]), [0, 0, -1]);
  // C14 the three earthing bolts low at the front of the cable compartment
  fasten('C14', cub, 'stud', DU, X.map((x) => [x, 0.01, zp - 0.07]), [0, 1, 0]);
  // C01 / C02 the partition screws from the fixing maps (fractions of width from the left seen from the front, of
  // height down from the top edge); caps (12 kV, fig 21) on the screws along the 374 / 150 joint
  const onPlate = (x0, x1, top, bottom) => ([xf, yf]) => [lerp(x0, x1, xf), lerp(top, bottom, yf), zp + 0.009];
  const map374 = [[0.15, 0.02], [0.33, 0.02], [0.65, 0.02], [0.89, 0.02], [0.035, 0.1], [0.035, 0.39], [0.035, 0.67], [0.97, 0.085], [0.97, 0.375], [0.97, 0.66]];
  const cap374 = [[0.035, 0.96], [0.97, 0.95], [0.34, 0.96], [0.66, 0.96]];
  const map150 = [[0.035, 0.29], [0.035, 0.555], [0.035, 0.81], [0.97, 0.28], [0.97, 0.555], [0.97, 0.81], [0.035, 0.97], [0.35, 0.97], [0.66, 0.97], [0.98, 0.97]];
  const cap150 = [[0.04, 0.03], [0.35, 0.03], [0.66, 0.03], [0.98, 0.03]];
  const pU = onPlate(-W / 2 + 0.004, W / 2 - 0.004, P.partTop, P.joint);
  const pL = onPlate(-W / 2 + 0.004, W / 2 - 0.004, P.joint, P.partBot);
  fasten('C01', partU, 'hex', DU, map374.map(pU), [0, 0, 1]);
  fasten('C01', partU, 'cap', DU, cap374.map(pU), [0, 0, 1]);
  fasten('C02', partL, 'hex', DU, map150.map(pL), [0, 0, 1]);
  fasten('C02', partL, 'cap', DU, cap150.map(pL), [0, 0, 1]);
  // barrier box screws: two round heads beside every box (photo 201/5 fig 8)
  fasten('B360', partU, 'round', DU, X.flatMap((x, i) => [[x - 0.076, P.armUp[i], zp + 0.009], [x + 0.076, P.armUp[i], zp + 0.009]]), [0, 0, 1]);
  fasten('B316', partL, 'round', DU, X.flatMap((x) => [[x - 0.076, P.armLow, zp + 0.009], [x + 0.076, P.armLow, zp + 0.009]]), [0, 0, 1]);
  // T01 front plate screw at R1, left of the shaft scale; T02 the rivets of lock angle 399 to its right (positions EST)
  fasten('T01', front, 'round', DU, [[-0.25, P.shaft51Y + 0.1, zf + 0.001]], [0, 0, 1]);
  fasten('T02', front, 'round', 0.0048, [[0.03, P.shaft51Y + 0.1], [0.09, P.shaft51Y + 0.1], [0.15, P.shaft51Y + 0.16]].map(([x, y]) => [x, y, zf + 0.001]), [0, 0, 1]);
  // T08 the mechanism cover's four corner screws, T06 the interlock adjusting screw inside the housing (EST)
  fasten('T08', cover, 'round', 0.006, [[-0.2, 0.25], [0.2, 0.25], [-0.2, 0.67], [0.2, 0.67]].map(([x, y]) => [x, y, zm1 + 0.006]), [0, 0, 1]);
  fasten('T06', mech, 'hex', 0.006, [[-0.17, 0.5, 0.46]], [0, 0, 1]);
  // T03 two hex screws per arm into the pole support, T04 the four spring screws on each arm
  armsU.forEach((g, i) => {
    fasten('T03', g, 'hex', DU, [[X[i], yUp + 0.025], [X[i], yUp + 0.065]].map(([x, y]) => [x, y, zPole - 0.052]), [0, 0, -1]);
    fasten('T04', g, 'hex', 0.006, [[-0.012, 0.13], [0.012, 0.13], [-0.012, 0.09], [0.012, 0.09]].map(([dx, z]) => [X[i] + dx, P.armUp[i] + 0.008, z]), [0, 1, 0]);
  });
  armsL.forEach((g, i) => {
    fasten('T03', g, 'hex', DU, [[X[i], yLo + 0.02], [X[i], yLo + 0.055]].map(([x, y]) => [x, y, zPole - 0.052]), [0, 0, -1]);
    fasten('T04', g, 'hex', 0.006, [[-0.012, 0.13], [0.012, 0.13], [-0.012, 0.09], [0.012, 0.09]].map(([dx, z]) => [X[i] + dx, P.armLow + 0.008, z]), [0, 1, 0]);
  });
  // C10 earth bar strap at the left end, C06 the LV joint screws on the left wall (positions EST), C12 the panel
  // earthing bolt, C04 the side drillings S / K / D (201/6 fig 10: depth from the rear, height from the floor)
  fasten('C10', cub, 'hex', M12, [[-W / 2 + 0.025, H + 0.012, zf - 0.03], [-W / 2 + 0.06, H + 0.012, zf - 0.03]], [0, 1, 0]);
  fasten('C06', cub, 'hex', M8, [0.15, 0.31, 0.47].flatMap((y) => [zf - 0.1, zf - P.lvD + 0.1].map((z) => [-W / 2 - 0.002, H + y, z])), [-1, 0, 0]);
  fasten('C12', cub, 'hex', M12, [[-W / 2 + 0.016, 0.06, zf + 0.001]], [0, 0, 1]);
  const SIDE = [[0.01, 0.98], [0.02, 0.73], [0.02, 0.48], [0.03, 0.26], [0.03, 0.04], [0.09, 0.45], [0.26, 0.45], [0.44, 0.44], [0.48, 0.99], [0.5, 0.94], [0.48, 0.51], [0.48, 0.08], [0.47, 0.02], ...[1.0, 0.94, 0.84, 0.74, 0.61, 0.48, 0.36, 0.24, 0.13, 0.01].map((h) => [0.98, h])];
  fasten('C04', cub, 'round', DU, SIDE.map(([d, h]) => [-W / 2 - 0.002, clamp(h, 0.015, 0.985) * H, -D / 2 + d * D]), [-1, 0, 0]);
  for (const g of fastGroups) {
    const geo = geoFor(g.kind, g.d);
    const m = new THREE.InstancedMesh(geo, g.kind === 'cap' ? capMat : fastMats[fastStatus(g.spec)], g.items.length);
    m.castShadow = true;
    m.frustumCulled = false;
    g.parent.add(m);
    g.mesh = m;
    for (const [id, [obj, pt]] of Object.entries(fastAnchor)) anchors[`f:${id}`] = [obj, pt];
  }
  const fm = new THREE.Matrix4();
  const fs = new V3();
  const fp = new V3();
  let fastKey = '';
  const updateFasteners = (st, show) => {
    const key = `${show}|${FASTENERS.map((f) => (st.fast[f.id] || 0).toFixed(3)).join(',')}`;
    if (key === fastKey) return;
    fastKey = key;
    for (const g of fastGroups) {
      const k = st.fast[g.spec.id] || 0;
      // back out along the axis (about 3 thread diameters), then gone
      const out = ease(Math.min(1, k / 0.8)) * Math.max(0.02, g.d * 3);
      const sc = (k >= 0.999 ? 0 : 1) * (show ? 1.7 : 1);
      g.items.forEach((it, i) => {
        fp.copy(it.p).addScaledVector(it.dir, out);
        fs.set(sc, sc, sc);
        fm.compose(fp, it.q, fs);
        g.mesh.setMatrixAt(i, fm);
      });
      g.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const [st2, m] of Object.entries(fastMats)) {
      m.color.set(show ? FAST_COL[st2] : '#9aa0a4');
      m.emissive.set(show ? FAST_COL[st2] : '#000000');
      m.emissiveIntensity = show ? 0.45 : 0;
    }
  };

  // ------------------------------------------------------------ removal paths
  // keyframes [x, y, z, rx, ry, rz] in the parent's frame, walked by the removal channel 0..1
  const pathAt = (keys, k) => {
    const n = keys.length - 1;
    const u = clamp(k, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(u));
    const f = ease(u - i);
    return keys[i].map((v, j) => lerp(v, keys[i + 1][j], f));
  };
  // the rotation turns the part about its own centre c (in the parent's frame), the translation moves that centre
  const pv = new V3();
  const pose = (obj, keys, k, c = null) => {
    const [x, y, z, rx, ry, rz] = pathAt(keys, k);
    obj.rotation.set(rx, ry, rz);
    obj.position.set(x, y, z);
    if (c) {
      pv.copy(c).applyEuler(obj.rotation);
      obj.position.add(c).sub(pv);
    }
  };
  const Z = [0, 0, 0, 0, 0, 0];
  // truck parts are laid out on the floor to the truck's left, cubicle parts to the right of the panel
  const ARMX = [-1.15, -1.31, -1.47];
  const PATH = {
    front: [Z, [0, P.plateLift, 0, 0, 0, 0], [0, P.plateLift, 0.3, 0, 0, 0], [-1.05, 0.45, 0.85, -0.6, 0, 0], [-1.1, -0.75 + 0.022, 0.75, -PI / 2, 0, 0]],
    cover: [Z, [0, 0, 0.16, 0, 0, 0], [0.05, 0.3, 0.7, 0, 0, 0], [0.05, -0.45 + 0.008, 0.72, -PI / 2, 0, 0]],
    armU: (i) => [Z, [0, 0, 0.1, 0, 0, 0], [ARMX[i] - X[i], 0.15, 0.15, 0, 0, 0], [ARMX[i] - X[i], -0.88, 0.15, 0, 0, 0]],
    armL: (i) => [Z, [0, 0, 0.1, 0, 0, 0], [ARMX[i] - X[i], 0.15, -0.35, 0, 0, 0], [ARMX[i] - X[i], -0.62, -0.35, 0, 0, 0]],
    pole: (i) => [Z, [0, 0.1, -0.12, 0, 0, 0], [-1.05 - i * 0.22 - X[i], 0.25, -0.6, 0, 0, 0], [-1.05 - i * 0.22 - X[i], -0.56, -1.05, 0, 0, 0]],
    partL: [Z, [0, 0, 0.75, 0, 0, 0], [1.0, 0.05, 0.86, 0, 0, 0], [1.0, -0.36, 0.86, PI / 2, 0, 0]],
    partU: [Z, [0, 0, 0.75, 0, 0, 0], [1.0, 0.05, 1.66, 0, 0, 0], [1.0, -1.04, 1.66, PI / 2, 0, 0]],
    bus: (i) => [Z, [0, 0.85, 0, 0, 0, 0], [1.43, 0.85, -0.67 + 0.4 * i, 0, 0, 0], [1.43, -(P.armUp[i] - 0.045), -0.67 + 0.4 * i, 0, 0, 0]],
    ct: [Z, [0, 0, 1.15, 0, 0, 0], [0.85, 0, 1.15, 0, 0, 0], [0.85, -0.17, 0.7, 0, 0, 0]],
  };
  const PIV = {
    front: new V3(0, 0.735, zf),
    cover: new V3(0, 0.46, zm1),
    pole: X.map((x) => new V3(x, 0.74, 0.3)),
    partL: new V3(0, 0.43, zp - 0.06),
    partU: new V3(0, 1.11, zp - 0.06),
  };

  // ------------------------------------------------------------ display state: isolate, x-ray, section, accent
  const section = new THREE.Plane(new V3(1, 0, 0), 0.03); // keeps x > -0.03: the left half comes off, cutting L2
  let disp = {iso: null, xray: 0, walls: false, section: false, screws: false};
  const applyDisplay = () => {
    for (const m of allMats) {
      const u = m.userData;
      let o = u.baseOpacity;
      if (disp.xray > 0 && u.sheet) o = Math.min(o, 1 - 0.86 * disp.xray);
      if (disp.walls && u.wall) o = Math.min(o, 0.12);
      if (disp.iso && u.sys !== disp.iso && !(disp.screws && u.sys === 'fast')) o = Math.min(o, 0.07);
      const tr = o < 0.999 || u.baseTransparent;
      if (m.transparent !== tr) {
        m.transparent = tr;
        m.needsUpdate = true;
      }
      m.opacity = o;
      m.depthWrite = o > 0.5;
      const planes = disp.section ? [section] : null;
      if ((m.clippingPlanes?.length || 0) !== (planes?.length || 0)) {
        m.clippingPlanes = planes;
        m.needsUpdate = true;
      }
    }
  };
  applyDisplay();
  const setDisplay = (d) => {
    const next = {...disp, ...d};
    if (next.iso === disp.iso && Math.abs(next.xray - disp.xray) < 1e-3 && next.section === disp.section && next.walls === disp.walls && next.screws === disp.screws) return;
    disp = next;
    applyDisplay();
  };
  const accent = new THREE.Color(ACCENT);
  const black = new THREE.Color(0);
  let lit = new Set();
  const setFocus = (ids, glow) => {
    const want = new Set(ids);
    for (const m of allMats) {
      const on = want.has(m.userData.id);
      if (on) m.emissive.copy(accent).multiplyScalar(glow);
      else if (lit.has(m.userData.id)) m.emissive.copy(black);
    }
    lit = want;
  };

  // ------------------------------------------------------------ pose everything from the state
  let lastBrk = -1;
  let lastSpr = -1;
  let lastCnt = -1;
  const tmp = new V3();
  const update = (s) => {
    updateFasteners(s, disp.screws);
    // the truck: travel along z; the wheeling device lifts its front onto the swivel roller
    truck.position.z = s.travel;
    wheel.visible = s.wheel > 0.01;
    wheel.position.z = (1 - clamp(s.wheel * 2, 0, 1)) * 0.25;
    tilt.rotation.x = -0.035 * clamp((s.wheel - 0.5) * 2, 0, 1);
    // locking shaft 51: lever angle out / in / interlocked = -55 / 0 / +55 deg; the crank follows
    const [aOut, aIn, aLock] = P.leverDeg.map((d) => (d * PI) / 180);
    const ang = s.shaft < 1 ? lerp(aOut, aIn, s.shaft) : lerp(aIn, aLock, s.shaft - 1);
    shaft51.rotation.z = ang;
    lever.rotation.z = ang;
    lever.visible = s.lever > 0.01;
    lever.position.z = zf + 0.01 + (1 - s.lever) * 0.3;
    // front plate: lifted by the shaft, then taken off along its path
    pose(front, PATH.front, s.front, PIV.front);
    front.position.y += s.lift;
    // the breaker: shaft 339.63 turns on closing, the moving contacts rise, the couplers follow
    shaft63.rotation.x = s.brk * 0.5;
    const lift = -s.gap;
    for (const mv of moving) mv.position.y = lift;
    const th = s.brk * 0.5;
    for (const c of couplers) {
      const a = new V3(c.x, 0.55 + 0.09 * Math.sin(th), 0.43 - 0.09 * Math.cos(th));
      const b = new V3(c.x, yLo - 0.05 + lift, zPole);
      c.rod.position.copy(a).add(b).multiplyScalar(0.5);
      c.rod.scale.set(1, a.distanceTo(b), 1);
      c.rod.quaternion.setFromUnitVectors(new V3(0, 1, 0), tmp.copy(b).sub(a).normalize());
      c.spr.position.y = yLo - 0.12 + lift;
    }
    if (s.brkOn !== lastBrk) {
      onoff.redraw(s.brkOn);
      lastBrk = s.brkOn;
    }
    if (s.springCharged !== lastSpr) {
      sprTex.redraw(s.springCharged);
      lastSpr = s.springCharged;
    }
    if (s.closings !== lastCnt) {
      cntTex.redraw(s.closings);
      lastCnt = s.closings;
    }
    // mechanism cover, contact arms, poles
    pose(cover, PATH.cover, s.mech, PIV.cover);
    armsU.forEach((g, i) => pose(g, PATH.armU(i), clamp(s.armsU * 1.6 - i * 0.3, 0, 1)));
    armsL.forEach((g, i) => pose(g, PATH.armL(i), clamp(s.armsL * 1.6 - i * 0.3, 0, 1)));
    poleSets.forEach(({pg}, i) => pose(pg, PATH.pole(i), clamp(s.poles * 1.6 - i * 0.3, 0, 1), PIV.pole[i]));
    for (const c of couplers) c.rod.visible = s.poles < 0.02;
    // shutters: lifted by the arms, or by the voltage detector in the verify step (one phase after the other)
    shutters.U.forEach((h) => (h.rotation.x = s.shutU * 1.45));
    const dk = s.det * 3;
    const dph = Math.min(2, Math.floor(dk));
    const du = dk - dph;
    shutters.L.forEach((h, i) => {
      const byDet = s.det > 0 && s.det < 1 && i === dph ? clamp(Math.min((du - 0.3) / 0.15, (0.9 - du) / 0.1), 0, 1) : 0;
      const byArm = (1 - s.armsL) * smooth01((zp + 0.02 - (zc + s.travel)) / 0.05);
      h.rotation.x = Math.max(byArm, byDet) * 1.45;
    });
    det.visible = s.det > 0.001 && s.det < 0.999;
    if (det.visible) {
      // approach, push 361 into the box mouth, the detector through it to the contact, back out
      const zIn = clamp(Math.min(du / 0.3, (1 - du) / 0.15), 0, 1);
      const zDeep = clamp(Math.min((du - 0.3) / 0.2, (0.85 - du) / 0.12), 0, 1);
      det.position.set(X[dph], P.armLow, lerp(zf + 0.5, zp - 0.02, ease(zIn)));
      groups['365'].position.z = lerp(0.2, zc - zp + 0.05, ease(zDeep));
    }
    // the earthing switch: handle 75 swung about 90 deg right, shaft 248 turns, stop 130 goes horizontal, knives close
    const e = s.earth;
    shaft248.rotation.z = -e * PI / 2;
    handle75.visible = STEPS[s.step].id === 'earth' && s.k > 0.04 && s.k < 0.96;
    knives.forEach((k) => (k.rotation.x = lerp(2.52, 0.918, ease(e))));
    // the LV plug: in its socket, or on the truck; its hose runs from the truck's cross girder
    const onTruck = new V3(0.12, 1.355, zfp - 0.24 + s.travel);
    const inSock = socket.clone().add(new V3(0, 0, 0.075));
    const u = ease(s.plug);
    plug.position.lerpVectors(inSock, onTruck, u);
    plug.position.y += Math.sin(u * PI) * 0.06;
    plug.rotation.set(0, u * 0.5, 0);
    const hStart = new V3(0.24, 1.32, zfp - 0.24 + s.travel);
    const hEnd = plug.position.clone().add(new V3(0, 0, 0.075).applyEuler(plug.rotation));
    const key = `${hStart.toArray().map((v) => v.toFixed(3))}|${hEnd.toArray().map((v) => v.toFixed(3))}`;
    if (key !== hoseKey) {
      hoseKey = key;
      const mid = hStart.clone().lerp(hEnd, 0.5).add(new V3(0, 0.05, 0.08));
      const curve = new THREE.CatmullRomCurve3([hStart, hStart.clone().add(new V3(0, 0.03, 0.05)), mid, hEnd.clone().add(new V3(0, 0, 0.06)), hEnd]);
      if (hose) {
        hose.geometry.dispose();
        hose.geometry = new THREE.TubeGeometry(curve, 24, 0.012, 6, false);
      } else {
        hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.012, 6, false), hoseMat);
        hose.castShadow = true;
        root.add(hose);
      }
    }
    // the cubicle: partitions, relief flaps, busbars, CT unit, cables, LV door
    pose(partL, PATH.partL, s.partL, PIV.partL);
    pose(partU, PATH.partU, s.partU, PIV.partU);
    const fk = ['538', '486', '480'];
    fk.forEach((id, i) => {
      const f = flaps[id];
      const k = clamp(s.flaps * 1.5 - i * 0.25, 0, 1);
      const open = ease(clamp(k * 2, 0, 1));
      const move = ease(clamp(k * 2 - 1, 0, 1));
      f.hinge.rotation.x = -1.1 * open * (1 - move);
      f.g.position.set(move * 1.0, -move * (H - 0.012 - i * 0.012), move * (2.35 - f.z0 - (f.z1 - f.z0) / 2));
    });
    busPh.forEach((g, i) => pose(g, PATH.bus(i), clamp(s.bus * 1.6 - i * 0.3, 0, 1)));
    pose(ctu, PATH.ct, s.ct);
    cables.position.y = -ease(clamp(s.ct * 4, 0, 1)) * 0.5;
    cables.visible = s.ct < 0.3;
    lvDoor.rotation.y = -ease(s.lv) * 1.75;
  };
  const smooth01 = (x) => {
    const k = clamp(x, 0, 1);
    return k * k * (3 - 2 * k);
  };

  const wp = new V3();
  const anchorAt = (id) => {
    const a = anchors[id];
    if (!a) return null;
    const [obj, local] = a;
    if (!obj.visible) return null;
    obj.updateWorldMatrix(true, false);
    return wp.copy(local).applyMatrix4(obj.matrixWorld);
  };
  return {root, P, groups, update, setDisplay, setFocus, anchorAt, anchors, section, allMats, fastGroups};
}
