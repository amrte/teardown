// One builder per field type: what sits inside the device compartment, how it is fed from the main busbar and
// which doors close it. The parts every field shares (frame, plinth, enclosure, main busbar, PE) come from
// cabinet.js and are built by board.js before these run.
import * as THREE from 'three';
import {breakerOf, DOOR_T, FEED_Y, HEAD, MODULE_KINDS, POST} from './catalog.js';
import {bb, buildCableCompartment, buildDoor, bx, cy, label, mk, part} from './cabinet.js';
import {breakerWL, com35Cables} from './breaker3wl.js';
import {activeSettings} from './wl.js';
import {breaker, capStage, converter, fixedModule, plugAdapter, strip4, strip63, unitWithdrawable} from './modules.js';
import {bentBarGeo, faceTex, plateGeo, ringGeo} from './parts.js';

// ------------------------------------------------------------ shared pieces
// the DSP800 display in the auxiliary compartment door, reading the 3WL through the COM35 (COM35 p.83)
const dspTex = (o) => {
  const P = activeSettings(o);
  return faceTex(192, 192, (c) => {
    c.fillStyle = '#1f2327';
    c.fillRect(0, 0, 192, 192);
    c.fillStyle = '#dfe9ee';
    c.fillRect(12, 14, 168, 120);
    c.fillStyle = '#16303a';
    c.font = '700 15px Inter, sans-serif';
    c.fillText(`3WL · ${o.acb} · ${o.wlIn} A`, 20, 34);
    c.font = '600 14px Inter, sans-serif';
    ['L1', 'L2', 'L3'].forEach((p, i) => c.fillText(`I ${p}  ${Math.round(o.wlIn * (0.61 + i * 0.03))} A`, 20, 58 + i * 20));
    c.fillText(`IR ${Math.round(P.Ir * o.wlIn)} A · set ${P.set}`, 20, 122);
    c.fillStyle = '#c9cfd3';
    for (let k = 0; k < 4; k++) c.fillRect(20 + k * 40, 150, 30, 22);
    c.fillStyle = '#e8eef2';
    c.font = '700 11px Inter, sans-serif';
    c.fillText('DSP800', 20, 186);
  });
};
// the plug-in bus duct texture: four contact openings (L1 L2 L3 N) every 50 mm segment
let ductTex = null;
const ductMat = (M) => {
  if (!ductTex) {
    ductTex = faceTex(128, 32, (g) => {
      g.fillStyle = '#26282c';
      g.fillRect(0, 0, 128, 32);
      g.fillStyle = '#0d0e10';
      for (let k = 0; k < 4; k++) g.fillRect(14 + k * 29, 6, 14, 20);
      g.fillStyle = '#7a4a30';
      for (let k = 0; k < 4; k++) g.fillRect(19 + k * 29, 9, 4, 14);
      g.fillStyle = '#3a3d42';
      g.fillRect(0, 30, 128, 2);
    });
    ductTex.wrapT = THREE.RepeatWrapping;
  }
  return new THREE.MeshStandardMaterial({map: ductTex, roughness: 0.6});
};

/** vertical distribution bars L1 L2 L3 N in the plug-in bus duct at the rear of the 600 mm device area */
function busDuct(ctx, yb, yt, main) {
  const {M, hw, R, cfg} = ctx;
  const x0 = POST + 20;
  const x1 = ctx.dev - 20;
  const w = x1 - x0;
  const zd = ctx.zSep + 34;
  const h = yt - yb;
  const pxs = [0, 1, 2, 3].map((k) => x0 + w * (0.2 + k * 0.2));
  // the duct (cover with the contact openings), removed in the partitions stage
  const cover = part(ctx, {name: 'Plug-in bus duct', layer: 'inner', stage: 'inner', at: [(x0 + x1) / 2, (yb + yt) / 2, zd], dir: [0, 0.1, 1], dist: 560, lines: ['Steckschienenkanal: insulating moulding', 'Contact openings every 50 mm (L1 L2 L3 N)', 'Shutter in the lowest 50 mm of each compartment']});
  bx(cover, w, h, 44, M.insul, 0, 0, -4);
  const pg = new THREE.PlaneGeometry(w, h);
  const uv = pg.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (h / 50));
  const face = new THREE.Mesh(pg, ductMat(M));
  face.position.set(0, 0, 18.9);
  face.userData.keep = true;
  cover.add(face);
  // the vertical bars themselves: profile bars 650 mm² (1100 A) [TIP Tab. 4/2]
  const bars = part(ctx, {name: 'Vertical distribution bars L1 L2 L3 N', layer: 'busbar', stage: 'devices', at: [0, (yb + yt) / 2, zd - 8], dir: [0, 0.1, 1], dist: 560, lines: ['Profile bars 650 mm² Cu · 1100 A ventilated', 'Icw 65 kA 1 s · finger-safe IP2X', `Fed from the main busbar at ${FEED_Y[cfg.height].join(' / ')} mm`]});
  for (const px of pxs) {
    bx(bars, 13, h, 50, M.copper, px, 0, 0);
    bx(bars, 30, h, 4, M.copper, px, 0, 23);
  }
  // feed links from the main busbar
  feedLinks(ctx, pxs, zd - 8, main, ctx.rear ? FEED_Y[cfg.height].map((y) => ctx.y0 + y) : [yt]);
  return {pxs, zd};
}

/** Cu links from vertical bars at x = pxs (z = zb) to the main busbar phases, bolted M12 at both ends */
function feedLinks(ctx, pxs, zb, main, ys) {
  const {M, hw, cfg} = ctx;
  const order = ['L1', 'L2', 'L3', 'N'];
  const g = part(ctx, {name: 'Feed links to the main busbar', layer: 'busbar', stage: 'busbars', at: [0, 0, 0], dir: [0, 0.2, -1], dist: 360, lines: ['Cu links 40 × 10, bolted M12 · 70 Nm', ctx.rear ? 'Current division 5 : 1 between two feed points' : 'Up into the top busbar compartment', 'DIN 6796 conical spring washers']});
  pxs.forEach((px, k) => {
    const ph = main.phases.find((p) => p.n === order[k]);
    if (!ph) return;
    const zf = ph.zc + (ctx.rear ? main.packT / 2 + 14 : 0);
    const yEnd = ctx.rear ? ph.yc : ph.yc - main.packH / 2 - 8;
    for (const y of ys.slice(0, ctx.rear ? 2 : 1)) {
      const pts = ctx.rear ? [[-zb, y], [-(zb - 40), y], [-(zf + 20), y], [-zf, yEnd]] : [[-zb, y], [-zb, y + 30], [-zf, yEnd]];
      const m = mk(g, bentBarGeo(pts, 10, 40), M.copper, px, 0, 0, {ry: Math.PI / 2});
      m.rotation.y = Math.PI / 2;
      m.castShadow = true;
      hw.bolt(g, [px + 30, y, zb], [-1, 0, 0], 12, 30, {what: 'Feed link to distribution bar'});
      hw.bolt(g, [px, yEnd, zf + 12], [0, 0, -1], 12, main.packT + 30, {what: 'Feed link to main busbar'});
      if (!ctx.rear) break;
    }
  });
}

/** head zone: the head-room door with the field tag and the cross-wiring compartment behind it */
function head(ctx) {
  const {W, M, hw, yt, f, i} = ctx;
  const hd = buildDoor(ctx, {name: `Head-room door ${f.tag}`, x: 0, y: yt - HEAD, w: W, h: HEAD, lock: 'quarter', label: [f.tag, ctx.T.name], labelY: 30, dist: 1150, lines: ['Kopfraumtür', 'Cross-wiring compartment behind it', 'Field designation plate']});
  if (i === 0) label(hd, 'SIVACON S8', 140, 22, -W / 2 + 120, -30, DOOR_T / 2 + 0.9, {pw: 280, ph: 44, size: 28, bg: '#d4d6d3', fg: '#1d4b52'});
  const cw = part(ctx, {name: 'Cross-wiring compartment', layer: 'inner', stage: 'inner', at: [W / 2, yt - HEAD + 2, -140], dir: [0, 1, 0.3], dist: 520, lines: ['Querverdrahtungsraum', 'Terminal blocks, wiring duct, control buses', 'Row A of the height grid (225 mm)']});
  bx(cw, W - 2 * POST, 2, 260, M.zinc, 0, 0, 0);
  bx(cw, W - 2 * POST - 40, 35, 7, M.zinc, 0, 60, -60);
  const nt = Math.floor((W - 160) / 7);
  for (let k = 0; k < nt; k += 1) bx(cw, 6, 44, 40, k % 8 === 7 ? M.blue : M.devLight, -(W - 160) / 2 + k * 7, 86, -46);
  bx(cw, W - 2 * POST - 40, 60, 60, M.devLight, 0, 160, -90);
  for (const sx of [-1, 1]) hw.screw(cw, [sx * (W / 2 - POST - 20), 60, -55], [0, 0, 1], 6, 'DIN rail');
}

/** foot zone: the ventilated plinth-space cover */
function foot(ctx) {
  const {W, M, hw, y0} = ctx;
  const g = part(ctx, {name: 'Plinth-space cover, ventilated', layer: 'door', stage: 'covers', at: [W / 2, y0 + 175 / 2, DOOR_T - 2], dir: [0, -0.4, 1], dist: 700, lines: ['Sockelraumblende belüftet', 'Base room 175 mm · PE bar behind it', 'M6 Torx T30 · 4 Nm']});
  mk(g, plateGeo(W - 4, 171, 2, 2, [[0, 0, W - 80, 90, 0]]), M.sheet, 0, 0, 0);
  bx(g, W - 80, 90, 1, M.sheetSlots, 0, 0, -1.2, 12);
  for (const sx of [-1, 1]) hw.screw(g, [sx * (W / 2 - 22), 0, 1.5], [0, 0, 1], 6, 'Plinth-space cover');
}

/** the cable compartment door on the right */
function cableDoor(ctx) {
  const {W, yDb, yDt} = ctx;
  const x0 = ctx.dev;
  const h = yDt - yDb;
  buildDoor(ctx, {name: 'Cable compartment door', x: x0, y: yDb, w: W - x0, h, lock: 'handle', vent: [[h / 2 - 120, 160], [-h / 2 + 120, 160]], dist: 1100, lines: ['Feldtür belüftet, field-high', 'Cable connection compartment behind it', 'Door stopper type 1']});
}

/** device compartment separation from the busbar compartment (rear busbar) */
function sepPlate(ctx) {
  if (!ctx.rear) return;
  const {W, M, y0, H, zSep, hw} = ctx;
  const g = part(ctx, {name: 'Separation plate, device | busbar compartment', layer: 'enclosure', stage: 'inner', at: [W / 2, y0 + H / 2, zSep + 2], dir: [0, 1, 0.15], dist: 1350, lines: ['Geräteraum / Sammelschienenraum', 'Access openings to the busbar joints', 'M6 Torx T30 · 4 Nm']});
  bx(g, W - 2 * POST, H - 2 * POST, 1.5, M.zinc, 0, 0, 0, 0, {shadow: true});
  for (let yy = -H / 2 + 200; yy < H / 2; yy += 500) for (const sx of [-1, 1]) hw.screw(g, [sx * (W / 2 - POST - 15), yy, 1.5], [0, 0, 1], 6, 'Separation plate');
}

const stack = (f, yTop) => {
  let y = yTop;
  return f.modules.map((m) => {
    const b = {y1: y, y0: y - m.h};
    y -= m.h;
    return b;
  });
};

// ------------------------------------------------------------ field types
export const BUILD = {
  universal(ctx, main) {
    const {f, yDt, yDb} = ctx;
    busDuct(ctx, yDb, yDt, main);
    sepPlate(ctx);
    const out = [];
    stack(f, yDt).forEach((b, j) => {
      const m = f.modules[j];
      const box = {x0: POST, x1: ctx.dev, ...b};
      if (m.kind === 'hfd' || m.kind === 'sfd' || m.kind === 'small') unitWithdrawable(ctx, m, j, box, out);
      else if (m.kind === 'plugadapt') plugAdapter(ctx, m, j, box, out);
      else fixedModule(ctx, m, j, box, out);
    });
    if (ctx.W > ctx.dev + 100) {
      buildCableCompartment(ctx, out);
      cableDoor(ctx);
    }
    head(ctx);
    foot(ctx);
  },

  fixedcover(ctx, main) {
    const {f, yDt, yDb, M, hw} = ctx;
    busDuct(ctx, yDb, yDt, main);
    sepPlate(ctx);
    const out = [];
    stack(f, yDt).forEach((b, j) => {
      const m = f.modules[j];
      const K = MODULE_KINDS[m.kind];
      const h = b.y1 - b.y0;
      const w = ctx.dev - POST;
      const loc = ctx.R.loc(ctx.i, j);
      const cx = POST + w / 2;
      if (m.kind !== 'empty') {
        const g = part(ctx, {name: `${K.name} · ${loc}`, layer: 'unit', stage: 'units', module: j, at: [cx, b.y0 + h / 2, -140], dir: [0, 0.05, 1], dist: 800, lines: [`${m.label || K.label} · ${h} mm`, ...K.lines.slice(0, 2)]});
        // the depth-adjustable carrier and the device(s)
        bx(g, w - 20, 3, 250, M.zinc, 0, -h / 2 + 6, 0);
        bx(g, w - 20, h - 20, 3, M.zincPerf, 0, 0, -120, 10);
        if (m.kind === 'mcb') {
          const rows = h >= 300 ? 2 : 1;
          for (let r = 0; r < rows; r++) {
            const yy = rows === 1 ? 0 : (r - 0.5) * (h / 2);
            bx(g, w - 60, 35, 7.5, M.zinc, 0, yy, -110);
            for (let k = 0; k < 24; k++) {
              bx(g, 17, 90, 70, k % 6 === 5 ? M.devDark : M.devLight, -(24 * 18) / 2 + 9 + k * 18, yy, -70);
              bx(g, 6, 18, 8, M.black, -(24 * 18) / 2 + 9 + k * 18, yy, -32);
            }
          }
        } else {
          const n = h >= 250 && /3VA2/.test(m.label || '') ? 3 : 1;
          for (let k = 0; k < n; k++) {
            const dw = Math.min(140, (w - 60) / n - 10);
            const dx = n === 1 ? -w * 0.15 : (k - (n - 1) / 2) * (dw + 20);
            bx(g, dw, Math.min(h - 40, 230), 120, /3NP/.test(m.label || '') ? M.dev : M.devDark, dx, 0, -40);
            bx(g, dw * 0.4, 30, 30, M.black, dx, Math.min(h - 40, 230) * 0.15, 30);
          }
        }
        out.push({j, y: b.y0 + h / 2, h, amps: /630|400/.test(m.label || '') ? 400 : 160, label: m.label || K.label, loc});
      }
      // the front cover in a uniform front plane, cut out for the handles
      const cv = part(ctx, {name: `Front cover ${loc}`, layer: 'door', stage: 'covers', module: j, at: [cx, b.y0 + h / 2, -8], dir: [0, 0, 1], dist: 650 + j * 10, lines: ['Front cover, uniform front plane', m.kind === 'mcb' ? 'Slot cut-out for 24 TE per row' : 'Cut-out for the device handle', 'M6 quarter-turn fasteners']});
      const holes = m.kind === 'empty' ? [] : m.kind === 'mcb' ? (h >= 300 ? [[0, h / 4, 24 * 18 + 6, 50, 0], [0, -h / 4, 24 * 18 + 6, 50, 0]] : [[0, 0, 24 * 18 + 6, 50, 0]]) : [[-w * 0.15, Math.min(h - 40, 230) * 0.15, 60, 46, 0]];
      mk(cv, plateGeo(w - 2, h - 3, 2, 1, holes), M.sheet, 0, 0, 0);
      for (const sx of [-1, 1]) cy(cv, 6, 4, M.black, sx * (w / 2 - 18), 0, 2, {rx: Math.PI / 2});
    });
    buildCableCompartment(ctx, out);
    // the field-high door over the covers
    buildDoor(ctx, {name: 'Device compartment door', x: 0, y: yDb, w: ctx.dev, h: yDt - yDb, lock: 'handle', dist: 1150, lines: ['Field-high door over the front covers', 'Optional glazed door']});
    cableDoor(ctx);
    head(ctx);
    foot(ctx);
  },

  plugin(ctx, main) {
    const {f, yDt, yDb, M, hw, cfg} = ctx;
    sepPlate(ctx);
    const ytop = yDt - 25;
    const ybot = ytop - (cfg.height === 2000 ? 1550 : 1750);
    // vertical bars 60 x 10 (1560 A) or 80 x 10 (2100 A), L1 L2 L3 at the rear, covered IP2X
    const zb = ctx.zSep + 30;
    const pxs = [140, 320, 500];
    const bars = part(ctx, {name: 'Vertical bars for the strips', layer: 'busbar', stage: 'devices', at: [0, (ytop + ybot) / 2, zb], dir: [0, 0.1, 1], dist: 560, lines: ['60 × 10 Cu · 1560 A (80 × 10 · 2100 A)', 'Icw 50 kA 1 s · Icc 120 kA', 'L1 L2 L3 at the rear, PE/N in the cable compartment']});
    for (const px of pxs) bx(bars, 60, ytop - ybot, 10, M.copper, px, 0, 0);
    const cov = part(ctx, {name: 'Touch-protection cover', layer: 'inner', stage: 'inner', at: [POST + 280, (ytop + ybot) / 2, zb + 30], dir: [0, 0, 1], dist: 650, lines: ['Covered IP2X, slots for the strip contacts']});
    bx(cov, 540, ytop - ybot, 2, M.clear, 0, 0, 0, 0, {shadow: false});
    feedLinks(ctx, pxs, zb, main, ctx.rear ? [ybot + 200, ytop - 200] : [ytop]);
    const out = [];
    stack(f, ytop).forEach((b, j) => strip63(ctx, f.modules[j], j, {x0: POST, x1: ctx.dev, ...b}, out));
    buildCableCompartment(ctx, out);
    buildDoor(ctx, {name: 'Strip compartment door', x: 0, y: yDb, w: ctx.dev, h: yDt - yDb, lock: 'handle', vent: [[(yDt - yDb) / 2 - 100, 120], [-(yDt - yDb) / 2 + 100, 120]], dist: 1150, lines: ['Door over the 3NJ63 strips', 'Ventilated top and bottom']});
    cableDoor(ctx);
    head(ctx);
    foot(ctx);
  },

  nj4(ctx, main) {
    const {f, yDt, yDb, M, hw, W} = ctx;
    sepPlate(ctx);
    // the horizontal distribution busbar at the rear, L1 L2 L3, the strips hang on it
    const yMid = yDb + (yDt - yDb) * 0.52;
    const zb = ctx.zSep + 25;
    const hb = part(ctx, {name: 'Horizontal distribution busbar', layer: 'busbar', stage: 'devices', at: [W / 2, yMid, zb], dir: [0, 0.2, 1], dist: 600, lines: ['L1 L2 L3 across the field', 'Strips clamp onto it', 'CTs possible in this busbar']});
    for (let p = 0; p < 3; p++) bx(hb, W - 2 * POST - 40, 40, 10, M.copper, 0, (p - 1) * 185, 0);
    for (const sx of [-1, 1]) bx(hb, 30, 450, 30, M.devLight, sx * (W / 2 - POST - 40), 0, -10);
    feedLinks(ctx, [W / 2 - 60, W / 2, W / 2 + 60], zb, main, ctx.rear ? [yMid + 185, yMid] : [yMid + 300]);
    const out = [];
    let x = POST + 30;
    f.modules.forEach((m, j) => {
      strip4(ctx, m, j, x, m.h, yMid, out);
      x += m.h;
    });
    // cables from the strip terminals straight down
    const cg = part(ctx, {name: 'Outgoing cables', layer: 'inner', stage: 'devices', at: [0, 0, 0], dir: [0, -1, 0.4], dist: 420, lines: ['Front connection at the device', 'Cable from top or bottom']});
    for (const o of out) mk(cg, (bentBarGeo([[o.x, o.y], [o.x, ctx.y0 - 40]], 22, 22)), M.cable, 0, 0, -150, {shadow: false});
    // the C30 rail across the bottom
    bx(cg, W - 2 * POST - 40, 30, 15, M.zinc, W / 2, yDb + 120, -150);
    buildDoor(ctx, {name: 'Field door with cut-out', x: 0, y: yDb, w: W, h: yDt - yDb, lock: 'handle', cut: [[0, yMid - (yDb + yDt) / 2, W - 120, 760]], dist: 1150, lines: ['Field-high door', 'IP31: cut-out, strips operated through the door', 'IP43 / IP54: closed, ventilated']});
    head(ctx);
    foot(ctx);
  },

  pfc(ctx, main) {
    const {f, yDt, yDb, M, hw, W} = ctx;
    sepPlate(ctx);
    // the supply: a vertical bar set from the main busbar down the rear of the field
    const zb = ctx.zSep + 30;
    const pxs = [180, 300, 420];
    const sup = part(ctx, {name: 'Module supply bars', layer: 'busbar', stage: 'devices', at: [0, (yDb + yDt) / 2, zb], dir: [0, 0.1, 1], dist: 520, lines: ['L1 L2 L3 to every capacitor module', 'Via the isolation module']});
    for (const px of pxs) bx(sup, 30, yDt - yDb, 10, M.copper, px, 0, 0);
    feedLinks(ctx, pxs, zb, main, ctx.rear ? [yDt - 100, yDt - 100] : [yDt]);
    const out = [];
    stack(f, yDt).forEach((b, j) => capStage(ctx, f.modules[j], j, {x0: POST, x1: ctx.dev + 80, ...b}, out));
    // forced ventilation: two fans in the roof area
    const fan = part(ctx, {name: 'Roof fans', layer: 'inner', stage: 'inner', at: [W / 2, yDt + 60, -200], dir: [0, 1, 0], dist: 500, lines: ['Forced ventilation for the capacitor stages', 'Replace preventively after 5 years']});
    for (const sx of [-1, 1]) {
      cy(fan, 75, 60, M.devDark, sx * 160, 0, 0, {seg: 24});
      cy(fan, 30, 62, M.black, sx * 160, 0, 0);
    }
    buildDoor(ctx, {
      name: 'Field door with PF controller',
      x: 0, y: yDb, w: W, h: yDt - yDb, lock: 'handle', dist: 1150,
      cut: [[-W * 0.2, (yDt - yDb) / 2 - 220, 144, 144]],
      vent: [[-(yDt - yDb) / 2 + 160, 220], [(yDt - yDb) / 2 - 450, 120]],
      lines: ['Field-high door, ventilated', 'Power factor controller in the door', '≤ 500 kvar per field'],
      extra: (g) => {
        const ctl = faceTex(128, 128, (c) => {
          c.fillStyle = '#2b2d31';
          c.fillRect(0, 0, 128, 128);
          c.fillStyle = '#9fd3c7';
          c.fillRect(12, 14, 104, 44);
          c.fillStyle = '#16181b';
          c.font = '700 22px Inter, sans-serif';
          c.fillText('cos φ 0.97', 18, 44);
          c.fillStyle = '#e3e4e2';
          for (let k = 0; k < 4; k++) c.fillRect(14 + k * 27, 78, 18, 14);
          c.fillStyle = '#2e9d4a';
          for (let k = 0; k < 6; k++) c.fillRect(14 + k * 17, 104, 10, 8);
        });
        const mm = new THREE.Mesh(new THREE.PlaneGeometry(138, 138), new THREE.MeshStandardMaterial({map: ctl, roughness: 0.5}));
        mm.position.set(-W * 0.2, (yDt - yDb) / 2 - 220, DOOR_T / 2 - 6);
        mm.userData.keep = true;
        g.add(mm);
      },
    });
    head(ctx);
    foot(ctx);
  },

  fc(ctx, main) {
    const {f, yDt, yDb, M, W} = ctx;
    sepPlate(ctx);
    const zb = ctx.zSep + 30;
    const sup = part(ctx, {name: 'Supply bars', layer: 'busbar', stage: 'devices', at: [W / 2, yDt - 90, zb], dir: [0, 0.2, 1], dist: 500, lines: ['L1 L2 L3 across the top', 'Feeds every converter fuse base']});
    for (let p = 0; p < 3; p++) bx(sup, W - 2 * POST - 40, 30, 10, M.copper, 0, (p - 1) * 45, 0);
    feedLinks(ctx, [W / 2 - 60, W / 2, W / 2 + 60], zb, main, ctx.rear ? [yDt - 45, yDt - 45] : [yDt]);
    const out = [];
    let x = POST + 10;
    f.modules.forEach((m, j) => {
      converter(ctx, m, j, x, m.h, yDb + 20, yDt - 140, out);
      x += m.h;
    });
    buildDoor(ctx, {name: 'Field door, ventilated', x: 0, y: yDb, w: W, h: yDt - yDb, lock: 'handle', vent: [[-(yDt - yDb) / 2 + 200, 300], [(yDt - yDb) / 2 - 200, 300]], dist: 1150, lines: ['Field-high door', 'IP54 only with forced ventilation']});
    head(ctx);
    foot(ctx);
  },

  ccs(ctx) {
    const {f, yDt, yDb, M, hw, W} = ctx;
    sepPlate(ctx);
    if (f.opts.plate !== 'none') {
      const g = part(ctx, {name: `Mounting plate, ${f.opts.plate}`, layer: 'unit', stage: 'units', at: [W / 2, (yDb + yDt) / 2, ctx.zSep + 60], dir: [0, 0.05, 1], dist: 900, lines: ['Free fixed-mounted (CCS)', 'Split / unsplit, perforated / plain', 'For KSE, ZEP, ALPHA 8GK or reserve']});
      bx(g, W - 2 * POST - 20, yDt - yDb - 40, 3, f.opts.plate === 'perforated' ? M.zincPerf : M.zinc, 0, 0, 0, 10);
      for (const sx of [-1, 1]) for (const sy of [-1, 0, 1]) hw.screw(g, [sx * (W / 2 - POST - 30), sy * ((yDt - yDb) / 2 - 40), 2], [0, 0, 1], 6, 'Mounting plate');
      if (W >= 400) {
        bx(g, W - 2 * POST - 80, 35, 7.5, M.zinc, 0, 300, 5);
        for (let k = 0; k < Math.floor((W - 200) / 18); k++) bx(g, 17, 90, 70, M.devLight, -(W - 200) / 2 + k * 18, 300, 40);
      }
    }
    buildDoor(ctx, {name: 'Field door', x: 0, y: yDb, w: W, h: yDt - yDb, lock: 'handle', dist: 1150, lines: ['Field-high door or glazed door', 'Form 1 / 2b']});
    head(ctx);
    foot(ctx);
  },

  acb(ctx, main) {
    const {f, yDt, yDb, M, hw, W, cfg} = ctx;
    const br = breakerOf(f);
    sepPlate(ctx);
    const out = [];
    const boxes = stack(f, yDt);
    let acbs = [];
    boxes.forEach((b, j) => {
      const m = f.modules[j];
      const h = b.y1 - b.y0;
      const loc = ctx.R.loc(ctx.i, j);
      if (m.kind === 'aux') {
        const dsp = br.wl && f.opts.wlCom === 'COM35';
        const g = part(ctx, {name: `Auxiliary device carrier · ${loc}`, layer: 'unit', stage: 'units', module: j, at: [W / 2, b.y0 + h / 2, -60], dir: [0, 0.05, 1], dist: 700, lines: ['Hilfsgeräteträger', 'Meters, protection relays, terminals']});
        bx(g, W - 2 * POST - 20, h - 30, 3, M.zincPerf, 0, 0, -60, 10);
        bx(g, W - 2 * POST - 60, 35, 7.5, M.zinc, 0, -h / 2 + 60, -55);
        for (let k = 0; k < Math.floor((W - 160) / 18); k++) bx(g, 17, 80, 60, k % 5 === 4 ? M.devDark : M.devLight, -(W - 160) / 2 + k * 18, -h / 2 + 60, -25);
        buildDoor(ctx, {
          name: `Auxiliary compartment door ${loc}`, module: j, x: 0, y: b.y0, w: W, h, lock: 'quarter', dist: 1050,
          cut: [[-W * 0.18, 30, dsp ? 92 : 96, dsp ? 92 : 96]], lines: dsp ? ['Door with the DSP800 display (cut-out 92 × 92 mm)', 'Reads the 3WL over Modbus TCP from the COM35', 'DSP800 3VA9987-0TD10 · 24 V DC · 2.2 W (COM35 p.83)'] : ['Door with meter and indicator lamps', 'Form 3a / 4b: 3-part door'],
          extra: (dg) => {
            const t = dsp ? dspTex(f.opts) : faceTex(128, 128, (c) => {
              c.fillStyle = '#e3e4e2';
              c.fillRect(0, 0, 128, 128);
              c.fillStyle = '#2b2d31';
              c.fillRect(8, 8, 112, 112);
              c.fillStyle = '#9fd3c7';
              c.fillRect(16, 18, 96, 60);
              c.fillStyle = '#16181b';
              c.font = '700 15px Inter, sans-serif';
              c.fillText('L1 2 841 A', 22, 40);
              c.fillText('U 401 V', 22, 62);
              c.fillStyle = '#e3e4e2';
              for (let k = 0; k < 4; k++) c.fillRect(18 + k * 24, 92, 16, 12);
            });
            const mm = new THREE.Mesh(new THREE.PlaneGeometry(dsp ? 96 : 92, dsp ? 96 : 92), new THREE.MeshStandardMaterial({map: t, roughness: 0.5}));
            mm.position.set(-W * 0.18, 30, DOOR_T / 2 - 4);
            mm.userData.keep = true;
            dg.add(mm);
            for (const [k, mat] of [[0, M.lamp], [1, M.lampRed], [2, M.yellow]].map(([a, b]) => [a, b])) cy(dg, 11, 14, mat, W * 0.12 + k * 46, 20, DOOR_T / 2 + 7, {rx: Math.PI / 2});
          },
        });
      } else if (m.kind === 'acb') {
        const r = br.wl ? breakerWL(ctx, m, j, {x0: POST, x1: W - POST, ...b}, out, br) : breaker(ctx, m, j, {x0: POST, x1: W - POST, ...b}, out);
        if (br.wl && r.com) com35Cables(ctx, r);
        acbs.push({...r, b, j});
        // the 3WL door cut-out is 300 x 350 for every frame size (OI 21-1); the 3WA cut-out follows its front
        const cyc = br.wl ? r.cut.y - (b.y0 + h / 2) : r.yb + 8 + br.h / 2 - (b.y0 + h / 2);
        buildDoor(ctx, {
          name: `Breaker door ${loc}`, module: j, x: 0, y: b.y0, w: W, h, lock: 'handle', dist: 1100,
          open: () => (m.pos === 'removed' ? 1 : 0),
          cut: [br.wl ? [0, cyc, r.cut.w, r.cut.h] : [0, cyc, br.w + 10, br.h + 10]],
          lines: ['Door with cut-out for the breaker front', 'Racking with the door closed', br.wl ? 'Door sealing frame around the cut-out' : 'Door frame seal for IP54'],
          // the 3WL door sealing frame around the cut-out
          // the IP41 door sealing frame, 8 × Ø5.5 holes (OI 21-1)
          extra: br.wl
            ? (dg) => {
                mk(dg, ringGeo(r.cut.w + 30, r.cut.h + 30, 6, 15), M.devDark, 0, cyc, DOOR_T / 2 + 3);
                for (const [hx, hy] of [[-157, 0], [-157, -140], [157, 0], [157, 140], [-120, 185], [40, 185], [-40, -180], [120, -180]]) hw.screw(dg, [hx, cyc + hy, DOOR_T / 2 + 6.2], [0, 0, 1], 5, 'Door sealing frame IP41 · Ø5.5');
              }
            : null,
        });
      } else {
        // the louvred compartment: cable connection behind it
        buildDoor(ctx, {name: `Louvred door ${loc}`, module: j, x: 0, y: b.y0, w: W, h, lock: 'quarter', vent: [[0, h - 80]], dist: 1100, lines: ['Ventilated compartment', 'Cable connection behind it', 'Optional fans (forced ventilation)']});
      }
    });
    // connection bars: from the upper (busbar side) terminals to the main busbar, from the lower to the cable side
    const a = acbs[0];
    if (a) {
      const {br: B, yb, zTerm} = a;
      const cx = W / 2;
      const order = ['L1', 'L2', 'L3'];
      const g = part(ctx, {name: 'Connection bars, busbar side', layer: 'busbar', stage: 'devices', at: [0, 0, 0], dir: [0, 0.3, -1], dist: 420, lines: [`${main.packT > 30 ? '2 × 100 × 10' : '2 × 60 × 10'} Cu per phase`, 'From the guide frame to the main busbar', 'M12 · 70 Nm · DIN 6796']});
      order.forEach((n, p) => {
        const ph = main.phases.find((q) => q.n === n);
        const px = cx + (a.px ? a.px[p] : (p - 1) * B.w * 0.3);
        const yA = yb + B.h * 0.78;
        const zA = zTerm;
        if (ctx.rear) {
          const zf = ph.zc + main.packT / 2 + 12;
          const ys = cfg.busbar === 'rear-top' ? ph.yc : ph.yc;
          const pts = [[-zA, yA], [-(zA - 40), yA], [-(zf + 30), yA], [-(zf + 30), ys], [-zf, ys]];
          for (const dx of [-12, 12]) {
            const mm = mk(g, bentBarGeo(pts, 10, 60), M.copper, px + dx, 0, 0);
            mm.rotation.y = Math.PI / 2;
            mm.castShadow = true;
          }
          hw.bolt(g, [px, ys, zf + 14], [0, 0, -1], 12, main.packT + 30, {what: 'Connection bar to main busbar'});
        } else {
          const pts = [[-zA, yA], [-(zA - 60), yA], [-(zA - 60), ph.yc - main.packH / 2 - 10], [-ph.zc, ph.yc - main.packH / 2 - 10]];
          const mm = mk(g, bentBarGeo(pts, 10, 60), M.copper, px, 0, 0);
          mm.rotation.y = Math.PI / 2;
        }
      });
      // customer side: lower terminals down to the cable connection bars in the foot of the field, with the CT set
      const cg = part(ctx, {name: 'Cable connection bars with CT set', layer: 'busbar', stage: 'devices', at: [0, 0, 0], dir: [0, -0.3, 1], dist: 460, lines: ['One CT set L1–L3 on the customer side', 'Studs for earthing & short-circuiting (M12 SW19 · 70 Nm)', 'Up to 12 × 240 mm² per phase (3WA12)']});
      order.forEach((n, p) => {
        const px = cx + (a.px ? a.px[p] : (p - 1) * B.w * 0.3);
        const yB = yb + B.h * 0.32;
        // down behind the breaker, forward under the guide frame, down the front of the connection compartment
        const zA = zTerm + 6;
        const zC = -190;
        const yU = yb - 45;
        const yE = ctx.y0 + 260;
        const pts = [[-zA, yB], [-zA, yU], [-zC, yU], [-zC, yE]];
        const mm = mk(cg, bentBarGeo(pts, 10, 60), M.copper, px, 0, 0);
        mm.rotation.y = Math.PI / 2;
        // current transformer around the front vertical leg
        const ct = mk(cg, plateGeo(110, 110, 50, 12, [[0, 0, 76, 30, 0]]), M.devDark, px, (yU + yE) / 2 + 60, zC, {rx: Math.PI / 2});
        ct.castShadow = true;
        // cable lugs with M12 bolts on the front leg, and the cables down to the floor opening
        for (let k = 0; k < 3; k++) {
          const yy = yE + 30 + k * 60;
          hw.bolt(cg, [px + 8, yy, zC], [-1, 0, 0], 12, 30, {what: 'Cable lug on connection bar'});
          bx(cg, 34, 50, 14, M.copperTin, px + 14, yy, zC);
        }
        for (const dz of [-25, 25]) mk(cg, bentBarGeo([[px + 34, yE + 30], [px + 34, -40]], 34, 34), M.cable, 0, 0, zC + dz, {shadow: false});
      });
    }
    head(ctx);
    foot(ctx);
  },
};
