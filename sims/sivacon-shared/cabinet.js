// The parts every field shares, built in millimetres in field coordinates: x from the field's left frame edge to the
// right (0..W), y up from the floor (the frame starts on the plinth at y0), z from the rear frame plane (-D) to the
// front frame plane (0); doors sit in the 25 mm in front of it. The frame of hole-row uprights and roof/floor
// frames, the plinth with its corner brackets on the U50 foundation, the roof (louvred hoods for IP31, a plate on
// spacers for IP43/54), rear wall, side walls, field partitions, the main busbar packs with their holders and the
// fishplate joints, the PE bars, the cable compartment, and the doors with hinges, lock and seal.
import * as THREE from 'three';
import {DOOR_T, FEED_Y, FLOOR, JOINT_Y, POST, REAR_T, SIDE_DESIGN, SIDE_T, TORQUE} from './catalog.js';
import {boxGeo, cylGeo, labelTex, plateGeo, ringGeo, cableGeo, bentBarGeo} from './parts.js';

const D2R = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

// ------------------------------------------------------------ helpers
/** a mesh at (x, y, z) in its parent group; big meshes cast shadows */
export function mk(parent, geo, mat, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  if (o.keep) m.userData.keep = true;
  geo.computeBoundingSphere?.();
  const r = geo.boundingSphere?.radius ?? 0;
  m.castShadow = o.shadow ?? r > 90;
  m.receiveShadow = r > 60;
  parent.add(m);
  return m;
}
/** a box w x h x d centred at (x, y, z) */
export const bx = (parent, w, h, d, mat, x, y, z, pitch = 0, o) => mk(parent, boxGeo(w, h, d, pitch), mat, x, y, z, o);
/** a box between two corners */
export const bb = (parent, x0, y0, z0, x1, y1, z1, mat, pitch = 0, o) =>
  bx(parent, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, pitch, o);
export const cy = (parent, r, h, mat, x, y, z, o = {}) => mk(parent, cylGeo(r, h, o.seg ?? 16, o.r2 ?? r), mat, x, y, z, o);

/** a registered part: a Group at `at` in `parent` (the field group by default) */
export function part(ctx, o) {
  const g = new THREE.Group();
  g.position.set(...(o.at || [0, 0, 0]));
  if (o.ry) g.rotation.y = o.ry;
  (o.parent || ctx.g).add(g);
  ctx.reg.add(g, {field: ctx.i, ...o});
  g.userData.layer = o.layer || 'inner';
  return g;
}
const label = (parent, text, w, h, x, y, z, o = {}) => {
  const tex = labelTex(text, {w: o.pw ?? 256, h: o.ph ?? 64, bg: o.bg ?? '#f4f4f2', fg: o.fg ?? '#16181b', size: o.size ?? 30, align: o.align});
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({map: tex, roughness: 0.6}));
  m.position.set(x, y, z);
  if (o.ry) m.rotation.y = o.ry;
  m.userData.keep = true;
  m.userData.label = true;
  parent.add(m);
  return m;
};
export {label};

// ------------------------------------------------------------ frame
export function buildFrame(ctx) {
  const {W, D, H, y0, yt, M, hw} = ctx;
  const P = POST;
  const posts = [
    ['left front', 0, 0, -1],
    ['right front', W - P, 0, 1],
    ['left rear', 0, -D + P, -1],
    ['right rear', W - P, -D + P, 1],
  ];
  for (const [nm, x, z, sx] of posts) {
    const g = part(ctx, {
      name: `Frame upright, ${nm}`,
      layer: 'frame',
      stage: 'frame',
      at: [x + P / 2, y0 + H / 2, z - P / 2],
      dir: [sx, 0.15, z < -D / 2 ? -0.4 : 0.4],
      dist: 320,
      lines: ['Hole-row profile, Sendzimir galvanised', `${H} mm · 25 mm hole pitch`, 'Frame screws M6 Torx T30 · 4 Nm'],
    });
    bx(g, P, H, P, M.zincHoles, 0, 0, 0, 25);
    // the frame corner screws, two at each end of the upright, into the roof and floor frame
    for (const yy of [H / 2 - 20, -H / 2 + 20]) {
      hw.screw(g, [0, yy, P / 2 + 0.5], [0, 0, 1], 6, 'Frame corner, upright to frame');
      hw.screw(g, [-sx * (P / 2 + 0.5), yy, 0], [-sx, 0, 0], 6, 'Frame corner, upright to frame');
    }
  }
  // roof frame and floor frame: four profiles each
  const ring = (y, name, dir, dist) => {
    const g = part(ctx, {name, layer: 'frame', stage: 'frame', at: [W / 2, y, -D / 2], dir, dist, lines: ['Folded profiles, Sendzimir galvanised', `${W} × ${D} mm`, 'Transport and lifting brackets bolt here']});
    bx(g, W - 2 * P, P, P, M.zincHoles, 0, 0, D / 2 - P / 2, 25);
    bx(g, W - 2 * P, P, P, M.zincHoles, 0, 0, -D / 2 + P / 2, 25);
    bx(g, P, P, D - 2 * P, M.zincHoles, -W / 2 + P / 2, 0, 0, 25);
    bx(g, P, P, D - 2 * P, M.zincHoles, W / 2 - P / 2, 0, 0, 25);
    return g;
  };
  ring(yt - P / 2, 'Roof frame', [0, 1, 0], 520);
  ring(y0 + P / 2, 'Floor frame', [0, -1, 0], 160);
  // the head-room rail and the foot rail across the front, a support profile at the busbar compartment
  const rails = part(ctx, {name: 'Front cross rails', layer: 'frame', stage: 'frame', at: [W / 2, 0, -P / 2], dir: [0, 0, 1], dist: 380, lines: ['Head-room rail at row A (225 mm)', 'Foot rail at the 175 mm base room']});
  bx(rails, W - 2 * P, 30, P, M.zincHoles, 0, ctx.yDt + 15, 0, 25);
  bx(rails, W - 2 * P, 30, P, M.zincHoles, 0, ctx.yDb - 15, 0, 25);
  if (ctx.rear) {
    const sp = part(ctx, {name: 'Busbar compartment support profiles', layer: 'frame', stage: 'frame', at: [W / 2, y0 + H / 2, ctx.zSep - P / 2], dir: [0, 1, 0], dist: 700, lines: ['Uprights at the device / busbar compartment boundary', 'Carry the separation plate and the busbar holders']});
    bx(sp, P, H - 2 * P, P, M.zincHoles, -W / 2 + P / 2, 0, 0, 25);
    bx(sp, P, H - 2 * P, P, M.zincHoles, W / 2 - P / 2, 0, 0, 25);
  }
  if (ctx.dev < W - 2 * P && ctx.T.dev(W) < W) {
    const xm = ctx.dev;
    const ip = part(ctx, {name: 'Intermediate uprights', layer: 'frame', stage: 'frame', at: [xm + P / 2, y0 + H / 2, -D / 2], dir: [0, 1, 0], dist: 900, lines: ['Device compartment | cable compartment', `At x = ${xm} mm`]});
    bx(ip, P, H - 2 * P, P, M.zincHoles, 0, 0, D / 2 - P / 2, 25);
    bx(ip, P, H - 2 * P, P, M.zincHoles, 0, 0, ctx.zSep + D / 2 - P / 2 + (ctx.rear ? 0 : P), 25);
  }
  // frame-to-frame joint: M6 bolts through the adjoining uprights at five heights, front and rear (OI Feldverbund p.5)
  if (!ctx.last) {
    const g = ctx.g.children.find((c) => c.userData.part?.name === 'Frame upright, right front');
    const gr = ctx.g.children.find((c) => c.userData.part?.name === 'Frame upright, right rear');
    for (const yy of JOINT_Y[H]) {
      for (const gg of [g, gr]) {
        const r = hw.bolt(gg, [P / 2 - 6, yy - H / 2, 0], [1, 0, 0], 6, 12, {spring: false, len: yy === JOINT_Y[H][2] ? 25 : 16, what: 'Field joint, frame to frame'});
        hw.recs[r].title = `Joint screw M6 × ${yy === JOINT_Y[H][2] ? 25 : 16}`;
        hw.recs[r].lines = ['Frame-to-frame joint, 5 heights front and rear', `at ${yy} mm above the frame bottom`, 'Screw + nut 6 Nm · thread-forming 4 Nm'];
      }
    }
  }
}

// ------------------------------------------------------------ plinth and foundation
export function buildBase(ctx) {
  const {W, D, B, M, hw} = ctx;
  if (B > 0) {
    const g = part(ctx, {name: `Plinth ${B} mm`, layer: 'frame', stage: 'frame', at: [W / 2, B / 2, -D / 2], dir: [0, -1, 0.2], dist: 420, lines: ['Corner brackets M12 × 25 + M6 × 16', 'Panels M6 × 10 · RAL 9005', 'Fixing holes Ø14.8 for M10 / M12']});
    const t = 2;
    // corner brackets
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      bx(g, 90, B, t, M.plinth, sx * (W / 2 - 45), 0, sz * (D / 2 - 1));
      bx(g, t, B, 90, M.plinth, sx * (W / 2 - 1), 0, sz * (D / 2 - 45));
      bx(g, 90, t, 90, M.plinth, sx * (W / 2 - 45), B / 2 - 1, sz * (D / 2 - 45));
      hw.bolt(g, [sx * (W / 2 - 25), B / 2 - 2, sz * (D / 2 - 25)], [0, -1, 0], 12, 6, {nut: false, len: 25, what: 'Plinth to frame (M12 × 25)'});
    }
    // front and rear plinth cover (Sockelblende), side covers at the lineup ends, depth brackets every 400 mm
    const pc = part(ctx, {name: 'Plinth cover, front', layer: 'enclosure', stage: 'covers', at: [W / 2, B / 2, 2], dir: [0, -0.2, 1], dist: 500, lines: ['Sockelblende, removable', 'M6 × 10 thread-forming']});
    bx(pc, W - 4, B - 4, 2, M.plinth, 0, 0, 0);
    for (const sx of [-1, 1]) hw.screw(pc, [sx * (W / 2 - 30), 0, 1.5], [0, 0, 1], 6, 'Plinth cover');
    bx(g, W - 4, B - 4, 2, M.plinth, 0, 0, -D / 2 - 1);
    if (ctx.first) bx(g, 2, B - 4, D - 4, M.plinth, -W / 2 + 1, 0, 0);
    if (ctx.last) bx(g, 2, B - 4, D - 4, M.plinth, W / 2 - 1, 0, 0);
    for (let zz = 400; zz < D - 100; zz += 400) for (const sx of [-1, 1]) bx(g, t, B, 80, M.plinth, sx * (W / 2 - 1), 0, D / 2 - zz);
  }
  // the U50 foundation channels in the screed (OI Aufstellung p.8) and the floor fixing (TIP p.105)
  const fd = part(ctx, {name: 'Foundation frame U50', layer: 'frame', stage: 'frame', at: [W / 2, -26.5, -D / 2], dir: [0, -1, 0], dist: 650, lines: ['U-profile DIN 1026 U50 (max U100) in screed', 'Levelled on shims to 1 mm / m', 'Heavy-duty dowels, DIN 434 tapered washers']});
  const U = (zc) => {
    bx(fd, W, 5, 50, M.zinc, 0, 22.5, zc);
    bx(fd, W, 50, 5, M.zinc, 0, 0, zc - 22.5);
    bx(fd, W, 50, 5, M.zinc, 0, 0, zc + 22.5);
  };
  U(D / 2 - 38);
  U(-D / 2 + 38);
  // fixing bolts M10 8.8: front row 25 mm behind the front, 75 mm in from the sides; side holes 25 mm in at 350 mm
  const holes = [
    [-W / 2 + 75, D / 2 - 25],
    [W / 2 - 75, D / 2 - 25],
    [-W / 2 + 25, D / 2 - FLOOR.mid],
    [W / 2 - 25, D / 2 - FLOOR.mid],
  ];
  for (const [hx, hz] of holes) {
    const r = hw.bolt(fd, [hx, 25 + 2 + ctx.B * 0 + 8, hz], [0, -1, 0], 10, 12, {nut: false, len: 40, what: 'Field to foundation'});
    hw.recs[r].lines = ['Floor fixing M10 8.8 + washer DIN 125', `Hole Ø${FLOOR.hole} mm · 25/75/350 mm pattern`, 'Into the U50 foundation channel'];
  }
}

// ------------------------------------------------------------ enclosure: roof, rear wall, side walls, partitions
export function buildEnclosure(ctx) {
  const {W, D, yt, y0, H, M, hw, cfg} = ctx;
  // roof (OI Aufstellung p.6–7): IP31 two louvred hoods 118 high overhanging 55 front and rear; IP43 a plate on
  // 50 mm spacers overhanging 101; IP54 a sealed plate on the roof frame
  const ip = cfg.ip;
  const roof = part(ctx, {name: ip === 'IP31' ? 'Roof hoods, louvred (IP31)' : ip === 'IP43' ? 'Roof plate on spacers (IP43)' : 'Roof plate, sealed (IP54)', layer: 'enclosure', stage: 'walls', at: [W / 2, yt, -D / 2], dir: [0, 1, 0], dist: 900, lines: ip === 'IP31' ? ['Two sloped hoods, 118 mm high', 'Overhang 55 mm front and rear', 'M6 × 10 at the corners'] : ip === 'IP43' ? ['Plate lip 15 mm on 50 mm spacers', 'Overhang 101 mm front and rear, 71 mm high', 'EPDM 4 × 10 seal at field joints'] : ['Closed roof plate, EPDM seal', 'M6 × 10 thread-forming, 4 per plate']});
  if (ip === 'IP31') {
    for (const sz of [-1, 1]) {
      const zc = sz * (D / 4 + 27.5 / 2);
      const len = D / 2 + 55;
      bx(roof, W - 6, 2, len * 1.01, M.sheet, 0, 70, zc, 0, {shadow: true});
      bx(roof, W - 6, 116, 2, M.sheetSlots, 0, 59, sz * (D / 2 + 55), 12);
      bx(roof, 2, 116, len, M.sheet, -W / 2 + 4, 59, zc);
      bx(roof, 2, 116, len, M.sheet, W / 2 - 4, 59, zc);
    }
    bx(roof, W - 6, 118, 2, M.zinc, 0, 59, 0);
  } else {
    const ov = ip === 'IP43' ? 101 : 0;
    const h = ip === 'IP43' ? 50 : 0;
    bx(roof, W - 4, 2, D + 2 * ov, M.sheet, 0, h + 20, 0, 0, {shadow: true});
    bx(roof, W - 4, 15, 2, M.sheet, 0, h + 13, D / 2 + ov);
    bx(roof, W - 4, 15, 2, M.sheet, 0, h + 13, -D / 2 - ov);
    if (h) for (const sx of [-1, 1]) for (const sz of [-1, 1]) cy(roof, 8, h, M.zinc, sx * (W / 2 - 60), h / 2, sz * (D / 2 - 60));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) hw.screw(roof, [sx * (W / 2 - 60), (ip === 'IP43' ? 71 : ip === 'IP31' ? 71 : 21) + 1, sz * (D / 2 - 60)], [0, 1, 0], 6, 'Roof plate M6 × 10');
  // rear wall: a pressed panel 25 mm deep
  const rw = part(ctx, {name: 'Rear wall', layer: 'enclosure', stage: 'walls', at: [W / 2, y0 + H / 2, -D - REAR_T + 1], dir: [0, 0, -1], dist: 800, lines: ['Powder-coated RAL 7035', 'Adds 25 mm behind the frame', 'M6 thread-forming round the edge']});
  bx(rw, W - 2, H - 2, 2, M.sheet, 0, 0, 0, 0, {shadow: true});
  bx(rw, W - 2, 2, REAR_T, M.sheet, 0, H / 2 - 2, REAR_T / 2);
  bx(rw, W - 2, 2, REAR_T, M.sheet, 0, -H / 2 + 2, REAR_T / 2);
  for (let yy = -H / 2 + 150; yy < H / 2 - 100; yy += 500) for (const sx of [-1, 1]) hw.screw(rw, [sx * (W / 2 - 20), yy, -1.5], [0, 0, -1], 6, 'Rear wall');
  // side walls at the ends of the lineup: plain 9 mm or the design side wall (Blue Green Basic) with its strip
  const side = (sx) => {
    const t = cfg.designStrip ? SIDE_DESIGN : SIDE_T;
    const g = part(ctx, {name: cfg.designStrip ? 'Design side wall' : 'Side wall', layer: 'enclosure', stage: 'walls', at: [sx < 0 ? -t / 2 : W + t / 2, y0 + H / 2, -D / 2], dir: [sx, 0, 0], dist: 700, lines: cfg.designStrip ? ['Design side wall, colour Blue Green Basic', 'With design strip: 36 mm', 'End of the lineup'] : ['Plain side wall, RAL 7035', 'Adds 9 mm at the end of the lineup']});
    const mat = cfg.designStrip ? M.design : M.sheet;
    bx(g, 2, H, D + REAR_T + DOOR_T - 2, mat, sx * (t / 2 - 1), 0, (DOOR_T - REAR_T) / 2, 0, {shadow: true});
    bx(g, t, H, 2, mat, 0, 0, D / 2 + DOOR_T - 1);
    bx(g, t, H, 2, mat, 0, 0, -D / 2 - REAR_T + 1);
    bx(g, t, 2, D + REAR_T + DOOR_T, mat, 0, H / 2 - 1, (DOOR_T - REAR_T) / 2);
    if (cfg.designStrip) {
      // the vertical name strip
      label(g, 'SIVACON', 1800 * 0.25, 46, sx * (t / 2 + 1), 300, (DOOR_T - REAR_T) / 2 + D * 0.25, {pw: 512, ph: 52, bg: '#1d4b52', fg: '#e8eeee', size: 34, ry: sx * Math.PI / 2}).rotation.z = Math.PI / 2;
    }
    for (let yy = -H / 2 + 200; yy < H / 2; yy += 600) hw.screw(g, [sx * t / 2, yy, D / 2 - 60], [sx, 0, 0], 6, 'Side wall');
  };
  if (ctx.first) side(-1);
  if (ctx.last) side(1);
  // field-to-field partition (Feld zu Feld) on the right of every field but the last
  if (!ctx.last) {
    const pt = part(ctx, {name: 'Field partition', layer: 'enclosure', stage: 'inner', at: [W - 2, y0 + H / 2, -D / 2], dir: [1, 0.1, 0.2], dist: 520, lines: ['Internal separation field to field', 'Sendzimir galvanised sheet', 'Arc barrier between fields']});
    bx(pt, 1.5, H - 2 * POST, D - 2 * POST, M.zinc, 0, 0, 0, 0, {shadow: true});
  }
}

// ------------------------------------------------------------ main busbar
// rear: phases one above the other, PE at the roof frame then N L1 L2 L3 (rear top), L1 L2 L3 N then PE at the floor
// frame (rear bottom); each phase a pack of rows x laminations held by an insulating comb holder (OI Feldverbund p.3–4).
// top: N L3 L2 L1 side by side over the depth, bars on edge (TIP p.18).
export function buildMainBusbar(ctx) {
  const {W, D, y0, yt, M, hw, R, cfg} = ctx;
  const pk = R.pack;
  const gapR = Math.max(16, pk.h * 0.6);
  const packH = pk.rows * pk.h + (pk.rows - 1) * gapR;
  const packT = pk.lams * 10 + (pk.lams - 1) * 10;
  const phases = [];
  if (ctx.rear) {
    const pitch = packH + 55;
    const zb = -D + ctx.Bz / 2;
    const names = cfg.busbar === 'rear-top' ? ['N', 'L1', 'L2', 'L3'] : ['L1', 'L2', 'L3', 'N'];
    names.forEach((n, k) => {
      const yc = cfg.busbar === 'rear-top' ? yt - 120 - packH / 2 - k * pitch : y0 + 120 + packH / 2 + (3 - k) * pitch;
      phases.push({n, yc, zc: zb, axis: 'z'});
    });
  } else {
    const pitch = Math.min(150, (D - 140) / 4);
    ['N', 'L3', 'L2', 'L1'].forEach((n, k) => phases.push({n, yc: yt - 115, zc: -D + 90 + k * pitch, axis: 'y'}));
  }
  const col = {L1: '#8a5a2b', L2: '#1c1d20', L3: '#8a8d90', N: '#2f6fc2'};
  for (const [k, ph] of phases.entries()) {
    const g = part(ctx, {
      name: `Main busbar ${ph.n}`,
      layer: 'busbar',
      stage: 'busbars',
      at: [W / 2, ph.yc, ph.zc],
      dir: ctx.rear ? [0, (k - 1.5) * 0.35, -1] : [0, 1, (k - 1.5) * 0.4],
      dist: ctx.rear ? 520 : 600,
      lines: [`${pk.txt} mm Cu per phase`, `${R.In} A · Icw ${R.Icw} kA 1 s`, `${cfg.busbar} · ${ctx.T.name === undefined ? '' : W + ' mm section'}`],
    });
    for (let r = 0; r < pk.rows; r++)
      for (let l = 0; l < pk.lams; l++) {
        const yy = -packH / 2 + pk.h / 2 + r * (pk.h + gapR);
        const zz = -packT / 2 + 5 + l * 20;
        if (ph.axis === 'z') bx(g, W, pk.h, 10, M.copper, 0, yy, zz);
        else bx(g, W, pk.h, 10, M.copper, 0, -yy, zz);
      }
    // phase colour bands at the field ends
    for (const sx of [-1, 1]) bx(g, 14, packH + 6, packT + 6, new THREE.MeshStandardMaterial({color: col[ph.n], roughness: 0.6}), sx * (W / 2 - 30), 0, 0, 0, {keep: true});
    ph.g = g;
  }
  // PE bar in the stack (rear) at the roof or floor frame
  if (ctx.rear) {
    const ype = cfg.busbar === 'rear-top' ? yt - 70 : y0 + 70;
    const g = part(ctx, {name: 'Main PE bar (rear)', layer: 'busbar', stage: 'busbars', at: [W / 2, ype, -D + ctx.Bz / 2], dir: [0, cfg.busbar === 'rear-top' ? 1 : -1, -0.6], dist: 420, lines: ['Two flat PE bars, 40 × 10 Cu', 'PE joint plates, DIN 6796 · 20 Nm', 'At the ' + (cfg.busbar === 'rear-top' ? 'roof' : 'floor') + ' frame']});
    bx(g, W, 40, 10, M.copper, 0, 0, -10);
    bx(g, W, 40, 10, M.copper, 0, 0, 10);
    bx(g, W, 42, 1, M.peStripe, 0, 0, 15.6, 0, {keep: true});
  }
  // the comb holders: an insulating support every field, bolted to a vertical support profile
  const xs = W >= 800 ? [W * 0.25, W * 0.75] : [W / 2];
  for (const hx of xs) {
    if (ctx.rear) {
      const top = Math.max(...phases.map((p) => p.yc)) + packH / 2 + 25;
      const bot = Math.min(...phases.map((p) => p.yc)) - packH / 2 - 25;
      const hg = part(ctx, {name: 'Busbar holder', layer: 'busbar', stage: 'busbars', at: [hx, (top + bot) / 2, -D + ctx.Bz / 2], dir: [0, 0, -1], dist: 260, lines: ['Comb support, glass-fibre polyester (SMC)', 'Holds every lamination of every phase', 'Bolted M8 · 20 Nm to the support profile']});
      const hh = top - bot;
      bx(hg, 40, hh, 12, M.devLight, 0, 0, -packT / 2 - 12);
      bx(hg, 40, hh, 12, M.devLight, 0, 0, packT / 2 + 12);
      for (const ph of phases) {
        for (let r = 0; r <= pk.rows; r++) {
          const yy = ph.yc - (top + bot) / 2 - packH / 2 - gapR / 2 + r * (pk.h + gapR);
          bx(hg, 40, Math.min(gapR, 14), packT + 12, M.devLight, 0, yy + (r === 0 ? gapR / 2 - 4 : r === pk.rows ? -gapR / 2 + 4 : 0), 0);
        }
      }
      bx(hg, 50, hh + 60, 30, M.zincHoles, 0, 0, -packT / 2 - 40, 25);
      for (const yy of [hh / 2 + 15, -hh / 2 - 15]) hw.bolt(hg, [0, yy, packT / 2 + 18], [0, 0, -1], 8, packT + 40, {what: 'Busbar holder to support profile'});
    } else {
      const hg = part(ctx, {name: 'Busbar holder', layer: 'busbar', stage: 'busbars', at: [hx, yt - 115, -D / 2], dir: [0, 1, 0], dist: 380, lines: ['Comb support across the depth', 'Glass-fibre polyester (SMC)']});
      bx(hg, 40, 14, D - 120, M.devLight, 0, -packH / 2 - 12, 0);
      bx(hg, 40, 14, D - 120, M.devLight, 0, packH / 2 + 12, 0);
      for (const ph of phases) bx(hg, 40, packH + 24, 8, M.devLight, 0, 0, ph.zc + D / 2 - packT / 2 - 8);
    }
  }
  // the fishplate joint to the next transport unit: two slotted Cu straps per phase sandwiching the pack, factory
  // bolted here with 2 bolts per row, the free end slides over the neighbour's bolts (OI Feldverbund p.7–11)
  if (R.jointRight[ctx.i]) {
    for (const ph of phases) {
      const fg = part(ctx, {name: `Fishplate joint ${ph.n}`, layer: 'busbar', stage: 'busbars', at: [W, ph.yc, ph.zc], dir: [0.8, ctx.rear ? 0.2 : 1, ctx.rear ? -1 : 0], dist: 380, lines: ['Slotted Cu fishplates, 2 per phase', 'M10 8.8 + DIN 6796 · 40 Nm', 'Contact faces greased with Vaseline · tool 8PQ9400-1AA75']});
      const ph2 = packH + 16;
      const slots = [];
      for (let r = 0; r < pk.rows; r++) slots.push([80, -packH / 2 + pk.h / 2 + r * (pk.h + gapR), 50, 12, 0]);
      for (const sz of [-1, 1]) {
        const pl = mk(fg, plateGeo(220, ph2, 8, 3, slots), M.copperTin, 0, 0, sz * (packT / 2 + 4));
        pl.castShadow = true;
      }
      for (let r = 0; r < pk.rows; r++) {
        const yy = -packH / 2 + pk.h / 2 + r * (pk.h + gapR);
        for (const xx of [-80, -40, 70]) {
          const id = hw.bolt(fg, [xx, yy, packT / 2 + 8], [0, 0, -1], 10, packT + 16, {what: xx > 0 ? 'Fishplate, free end in slot' : 'Fishplate, factory bolted'});
          hw.recs[id].lines.push('Nut tool 8PQ9400-1AA75 · SW17');
        }
      }
      // the slide-in transparent joint cover
      const cv = part(ctx, {name: 'Joint cover, transparent', layer: 'busbar', stage: 'busbars', at: [W, ph.yc, ph.zc], dir: [0, 0.3, 1], dist: 300, lines: ['Slide-in cover over the joint', 'Slide down, swivel, push up']});
      bx(cv, 240, ph2 + 20, packT + 40, M.clear, 0, 0, 0, 0, {shadow: false});
    }
  }
  return {phases, packH, packT};
}

// ------------------------------------------------------------ PE bar along the foot of the field (TIP Abb. 2/1, 14)
export function buildPE(ctx) {
  const {W, y0, M, hw, R} = ctx;
  const g = part(ctx, {name: 'Main PE bar', layer: 'busbar', stage: 'busbars', at: [W / 2, y0 + 75, -70], dir: [0, -0.3, 1], dist: 420, lines: ['Two flat PE bars, 40 × 10 Cu, 10 mm apart', 'PE cable lugs bolted between the bars', 'PE joint plates · DIN 6796 · 20 Nm']});
  bx(g, W - 2 * POST, 40, 10, M.copper, 0, 0, -10);
  bx(g, W - 2 * POST, 40, 10, M.copper, 0, 0, 10);
  bx(g, W - 2 * POST, 42, 1, M.peStripe, 0, 0, 15.6, 0, {keep: true});
  for (const sx of [-1, 1]) {
    bx(g, 30, 60, 50, M.insul, sx * (W / 2 - POST - 30), 0, 0);
    hw.bolt(g, [sx * (W / 2 - POST - 70), 0, 16], [0, 0, -1], 8, 30, {what: 'PE bar clamp'});
  }
  if (R.jointRight[ctx.i]) {
    const j = part(ctx, {name: 'PE joint plate', layer: 'busbar', stage: 'busbars', at: [W, y0 + 75, -70], dir: [1, -0.4, 0.6], dist: 300, lines: ['Slotted PE joint plate', 'Conical spring washer DIN 6796 · 20 Nm']});
    bx(j, 160, 40, 6, M.copperTin, 0, 0, 0);
    for (const xx of [-50, 50]) hw.bolt(j, [xx, 0, 18], [0, 0, -1], 8, 36, {what: 'PE joint'});
  }
}

// ------------------------------------------------------------ the cable compartment on the right of the device compartment
export function buildCableCompartment(ctx, outs) {
  const {W, M, hw, yDb, yDt, zSep, dev} = ctx;
  const x0 = dev;
  const x1 = W - POST;
  const cw = x1 - x0;
  // separation plate device | cable compartment
  const sp = part(ctx, {name: 'Separation plate, device | cable compartment', layer: 'enclosure', stage: 'inner', at: [x0 + POST + 1, (yDb + yDt) / 2, zSep / 2], dir: [1, 0.25, 0.5], dist: 560, lines: ['Form 4b separation', 'Openings for the outgoing terminals', 'M6 Torx T30 · 4 Nm']});
  bx(sp, 1.5, yDt - yDb, -zSep - 40, M.zinc, 0, 0, 0, 0, {shadow: true});
  // vertical PE and N bars at the rear right (TIP Abb. 2/1, 16 and 17)
  const bars = part(ctx, {name: 'Vertical PE and N bars', layer: 'busbar', stage: 'devices', at: [x1 - 70, (yDb + yDt) / 2, zSep + 40], dir: [0, 0, 1], dist: 520, lines: ['PE: M10 40 Nm (≤ 250 A), M12 70 Nm (≤ 630 A)', 'N(PEN): same terminals', 'In the cable connection compartment']});
  bx(bars, 40, yDt - yDb, 10, M.copper, 0, 0, 0);
  bx(bars, 40, yDt - yDb, 1, M.peStripe, 0, 0, 5.6, 0, {keep: true});
  bx(bars, 30, yDt - yDb, 10, M.copper, -60, 0, 0);
  bx(bars, 31, 30, 11, M.blue, -60, (yDt - yDb) / 2 - 30, 0);
  for (let yy = -(yDt - yDb) / 2 + 60; yy < (yDt - yDb) / 2; yy += 120) {
    bx(bars, 50, 26, 24, M.insul, 0, yy, -14);
    bx(bars, 40, 26, 24, M.insul, -60, yy, -14);
  }
  // C30 cable clamping rails every 300 mm (OI El. Anschluss p.6)
  const cr = part(ctx, {name: 'Cable clamping rails C30', layer: 'inner', stage: 'devices', at: [(x0 + x1) / 2 + 20, 0, zSep + 15], dir: [0, 0, 1], dist: 380, lines: ['C-rail 30/15 (EN 50024-C30)', 'Cable clamps non-magnetic', 'Single cores trefoil-tied']});
  for (let yy = yDb + 150; yy < yDt; yy += 300) {
    bx(cr, cw - 40, 30, 15, M.zinc, 0, yy, 0);
    hw.screw(cr, [-(cw - 40) / 2 + 10, yy, 8], [0, 0, 1], 6, 'C-rail fixing');
    hw.screw(cr, [(cw - 40) / 2 - 10, yy, 8], [0, 0, 1], 6, 'C-rail fixing');
  }
  // outgoing terminals and cables for every feeder: a terminal plate on the left wall at the module's height
  outs.forEach((o, k) => {
    const big = o.amps > 250;
    const tp = part(ctx, {name: `Outgoing terminals ${o.loc}`, layer: 'inner', stage: 'devices', module: o.j, at: [x0 + POST + 40, o.y, -130], dir: [0.3, 0, 1], dist: 560, lines: [big ? 'M12 lugs, 1 × 240 / 2 × 120 mm² · 70 Nm' : o.amps > 63 ? 'M10 lugs, 1 × 185 / 2 × 120 mm² · 40 Nm' : 'Terminal block UT16 / UT35 · 2.5–3.7 Nm', `${o.label}`, 'Form 4b: bellows over each lug']});
    bx(tp, 60, Math.min(o.h - 20, 90), 120, M.insul, 0, 0, 0);
    const n = 3;
    for (let p = 0; p < n; p++) {
      const zz = -40 + p * 40;
      bx(tp, 40, 14, 22, M.copperTin, 40, 0, zz);
      if (o.amps > 63) hw.bolt(tp, [50, 10, zz], [0, -1, 0], big ? 12 : 10, 24, {what: 'Outgoing cable lug'});
    }
    // the cable: down the compartment to the floor, held on the C-rails
    const cg = part(ctx, {name: `Outgoing cable ${o.loc}`, layer: 'inner', stage: 'devices', module: o.j, at: [0, 0, 0], dir: [0, -1, 0.4], dist: 420, lines: [big ? 'NYY-J 4 × 240 mm²' : o.amps > 63 ? 'NYY-J 4 × 95 mm²' : 'NYY-J 4 × 16 mm²', 'Clamped on the C30 rails', 'Down through the floor opening']});
    const cx = x0 + POST + 100 + (k % 6) * Math.min(38, (cw - 160) / 6);
    const r = big ? 21 : o.amps > 63 ? 14 : 9;
    const zc = zSep + 45 + (k % 2) * 30;
    mk(cg, cableGeo([[x0 + POST + 70, o.y, -130], [cx, o.y - 40, -150], [cx, o.y - 140, zc + 10], [cx, ctx.y0 + 120, zc], [cx, -40, zc]], r), M.cable, 0, 0, 0, {shadow: false});
  });
}

// ------------------------------------------------------------ doors
/**
 * A door on the field front: x, y its lower left corner (field coordinates), w x h; hinged on the left.
 * o.cut: rectangles [cx, cy, w, h] (door-local, centre origin) cut through it; o.vent: [cy, h] ventilated bands;
 * o.lock: 'quarter' | 'handle'; o.open(): own opening 0..1
 */
export function buildDoor(ctx, o) {
  const {M, hw} = ctx;
  const {x, y, w, h} = o;
  const g = part(ctx, {
    name: o.name,
    layer: 'door',
    stage: o.stage || 'covers',
    module: o.module ?? -1,
    at: [x + w / 2, y + h / 2, DOOR_T / 2],
    dir: o.dir || [-1, 0.02, 0.5],
    // doors leave to the left-front like the handbook's exploded view, stacked doors fanned a little
    dist: 420 + w * 0.55 + (o.module >= 0 ? (o.module % 3) * 60 : 0),
    hinge: {axis: UP, pivot: new THREE.Vector3(x + 2, 0, DOOR_T), angle: -105 * D2R},
    open: o.open,
    lines: o.lines || ['Powder-coated RAL 7035', 'Opens 105°, door stopper holds it', 'Hinge side changeable'],
  });
  const holes = [...(o.cut || []).map(([cx, cyy, cw, ch]) => [cx, cyy, cw, ch, 0]), ...(o.vent || []).map(([cyy, vh]) => [0, cyy, w - 60, vh, 0])];
  mk(g, plateGeo(w - 3, h - 3, 2, 2, holes), M.sheet, 0, 0, DOOR_T / 2 - 1, {shadow: true});
  mk(g, ringGeo(w - 3, h - 3, 20, 2), M.sheet, 0, 0, DOOR_T / 2 - 12);
  mk(g, ringGeo(w - 16, h - 16, 4, 6), M.rubber, 0, 0, -DOOR_T / 2 + 4);
  for (const [cyy, vh] of o.vent || []) bx(g, w - 60, vh, 1, M.sheetSlots, 0, cyy, DOOR_T / 2 - 4, 12);
  // hinges on the left edge
  const nh = h > 1200 ? 3 : 2;
  for (let k = 0; k < nh; k++) {
    const yy = nh === 2 ? (k ? h / 2 - Math.min(80, h * 0.2) : -h / 2 + Math.min(80, h * 0.2)) : [-h / 2 + 120, 0, h / 2 - 120][k];
    cy(g, 6, Math.min(60, h * 0.25), M.devDark, -w / 2 + 2, yy, DOOR_T / 2 + 5);
    bx(g, 18, Math.min(60, h * 0.25), 4, M.devDark, -w / 2 + 10, yy, DOOR_T / 2 + 1);
  }
  // lock: quarter-turn insert for compartment doors, a swing handle for field-high doors
  if (o.lock === 'handle') {
    bx(g, 28, 150, 10, M.black, w / 2 - 40, 0, DOOR_T / 2 + 5);
    bx(g, 22, 120, 14, M.devDark, w / 2 - 40, -10, DOOR_T / 2 + 14);
    cy(g, 8, 4, M.bolt, w / 2 - 40, 55, DOOR_T / 2 + 22, {rx: Math.PI / 2});
  } else if (o.lock !== 'none') {
    const ly = o.lockY ?? 0;
    cy(g, 11, 8, M.black, w / 2 - 30, ly, DOOR_T / 2 + 4, {rx: Math.PI / 2});
    bx(g, 3, 14, 2, M.bolt, w / 2 - 30, ly, DOOR_T / 2 + 8.5);
    hw.screw(g, [w / 2 - 30, ly - 22, DOOR_T / 2 + 0.5], [0, 0, 1], 4, 'Lock insert retainer');
  }
  if (o.label) label(g, o.label, Math.min(w - 80, 150), 26, o.labelX ?? 0, o.labelY ?? h / 2 - 40, DOOR_T / 2 + 0.9, {pw: 300, ph: 52, size: 28});
  if (o.extra) o.extra(g);
  return g;
}

export {D2R, UP, FEED_Y, TORQUE, bentBarGeo};
