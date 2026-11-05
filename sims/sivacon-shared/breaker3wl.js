// The SENTRON 3WL air circuit-breaker, withdrawable (in its guide frame) or fixed-mounted, built to the configuration:
// frame size, rated current (rating plug), breaking capacity, trip unit (ETU45B / 45B with display / 55B / 76B with
// its graphic display and parameter sets A/B), ground-fault module, 3 or 4 poles, manual or motor operating
// mechanism, the auxiliary releases (closing coil Y1, shunt releases F1/F2, undervoltage release F3) and the COM35
// communication module plugged into position X7 of the auxiliary conductor plug-in system.
//
// From the COM35 manual (L1V30536190-04): the COM35 body 72 x 60 x 92 mm (p.50), its 3 LEDs PN / TCP / CUB and what
// they show (p.12), terminals 1–9 for Write Enable, free input, free output, Close and Open (p.16), the two Ethernet
// ports X1 X2 and the function button S1 (p.11, 39), the CubicleBUS RJ45 socket at the rear with its terminating plug
// and the 4-wire lead to X8 (p.20), and the three micro-switches S46 / S47 / S48 on its underside that report the
// breaker's position in the guide frame (p.30). The breaker's outer dimensions and the inner layout are [inferred].
//
// Every sub-part also carries an exploded-view offset (fly): the breaker's own teardown, driven by S.wlx.
import * as THREE from 'three';
import {DOOR_T} from './catalog.js';
import {bx, cy, label, mk, part} from './cabinet.js';
import {faceTex, plateGeo, ringGeo, cableGeo} from './parts.js';
import {activeSettings, com35Data, orderNo, POSITION, WL_CLASS, WL_ETU, WL_SIZES} from './wl.js';

const TRAVEL = {connected: 0, test: 60, disconnected: 115, removed: 620}; // mm [inferred]
const SLIDE = {connected: 0, test: 28, disconnected: 56, removed: 92}; // the position-signalling slide [inferred]
const posOf = (m) => m.pos || 'connected';

// ------------------------------------------------------------ textures
const texCache = new Map();
const cachedTex = (key, w, h, draw) => {
  if (!texCache.has(key)) texCache.set(key, faceTex(w, h, draw));
  return texCache.get(key);
};
const txt = (g, s, x, y, size, color = '#16181b', weight = 600, align = 'left') => {
  g.fillStyle = color;
  g.font = `${weight} ${size}px Inter, sans-serif`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(s, x, y);
};

/** the trip unit's front: rotary coding switches (ETU45B/55B) or the graphic display (ETU76B), live settings */
function etuTex(o) {
  const E = WL_ETU[o.wlEtu];
  const P = activeSettings(o);
  const key = JSON.stringify(['etu', o.wlEtu, o.wlGf, o.wlIn, P]);
  return cachedTex(key, 320, 320, (g, W, H) => {
    g.fillStyle = '#2f3a44';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#3c4955';
    g.fillRect(8, 8, W - 16, H - 16);
    txt(g, E.name, 18, 26, 18, '#e8eef2', 700);
    txt(g, o.wlGf === 'yes' ? 'LSIG' : 'LSI', W - 18, 26, 15, '#9fd3c7', 700, 'right');
    if (E.face === 'graphic') {
      // the graphic display with the active parameter set
      g.fillStyle = '#b9e3d8';
      g.fillRect(20, 46, W - 40, 150);
      g.fillStyle = '#16303a';
      txt(g, `Parameter set ${P.set}${P.set === 'B' ? ' · DAS' : ''}`, 30, 64, 14, '#16303a', 700);
      const rows = [
        ['IR', `${Math.round(P.Ir * o.wlIn)} A`],
        ['tR', `${P.tR} s`],
        ['Isd', `${Math.round(P.Isd * P.Ir * o.wlIn)} A`],
        ['tsd', `${P.tsd} s`],
        ['Ii', `${Math.round(P.Ii * o.wlIn)} A`],
      ];
      if (o.wlGf === 'yes') rows.push(['Ig', `${Math.round(P.Ig * o.wlIn)} A`]);
      rows.forEach(([k, v], i) => {
        const y = 90 + (i % 3) * 34;
        const x = i < 3 ? 28 : 168;
        txt(g, k, x, y, 13, '#16303a', 600);
        txt(g, v, x + (i < 3 ? 110 : 122), y, 15, '#16303a', 700, 'right');
      });
      // five keys
      for (let k = 0; k < 5; k++) {
        g.fillStyle = '#d9dde0';
        g.beginPath();
        g.roundRect(24 + k * 56, 214, 44, 26, 5);
        g.fill();
      }
      txt(g, '◀   ▲   ▼   ▶   ESC', W / 2, 227, 13, '#2f3a44', 700, 'center');
    } else {
      // rotary coding switches, one per setting
      const dials = [
        ['IR', 'wlIr'],
        ['tR', 'wltR'],
        ['Isd', 'wlIsd'],
        ['tsd', 'wltsd'],
        ['Ii', 'wlIi'],
      ];
      if (o.wlGf === 'yes') dials.push(['Ig', 'wlIg']);
      dials.forEach(([lab, k], i) => {
        const cx = 52 + (i % 3) * 108;
        const cy = 92 + Math.floor(i / 3) * 96;
        g.fillStyle = '#d9dde0';
        g.beginPath();
        g.arc(cx, cy, 30, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#2f3a44';
        g.beginPath();
        g.arc(cx, cy, 22, 0, Math.PI * 2);
        g.fill();
        const val = o[k];
        const steps = {wlIr: 10, wltR: 10, wlIsd: 10, wltsd: 4, wlIi: 10, wlIg: 7}[k];
        const idx = ({wlIr: [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9, 1], wltR: [2, 3.5, 5.5, 8, 10, 14, 17, 21, 25, 30], wlIsd: [1.25, 1.5, 2, 2.5, 3, 4, 6, 8, 10, 12], wltsd: [0.1, 0.2, 0.3, 0.4], wlIi: [1.5, 2.2, 3, 4, 6, 8, 10, 12, 15, 20], wlIg: [0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1]}[k]).indexOf(val);
        const a = -Math.PI * 0.75 + (Math.max(0, idx) / (steps - 1)) * Math.PI * 1.5 - Math.PI / 2;
        g.strokeStyle = '#ffffff';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
        g.stroke();
        txt(g, lab, cx, cy + 42, 13, '#e8eef2', 700, 'center');
      });
      if (E.display) {
        g.fillStyle = '#b9e3d8';
        g.fillRect(20, 250, W - 40, 34);
        txt(g, `I L1 ${Math.round(o.wlIn * 0.62)} A`, 30, 267, 14, '#16303a', 700);
      }
    }
    // the trip indicator LEDs and the front interface (TD400 adapter)
    ['L', 'S', 'I', 'N', 'G'].forEach((s, i) => {
      g.fillStyle = '#5a6670';
      g.beginPath();
      g.arc(30 + i * 26, H - 22, 7, 0, Math.PI * 2);
      g.fill();
      txt(g, s, 30 + i * 26, H - 38, 10, '#c9d1d6', 700, 'center');
    });
    g.fillStyle = '#1b2126';
    g.fillRect(W - 90, H - 34, 70, 22);
    txt(g, 'TD400', W - 55, H - 46, 10, '#c9d1d6', 700, 'center');
  });
}

/** the breaker's front cover print: type, order number, ratings */
function coverTex(o) {
  const S = WL_SIZES[o.acb];
  const key = JSON.stringify(['cov', o.acb, o.wlIn, o.wlClass, o.wlEtu, o.wlGf, o.wlPoles, o.wlMech]);
  return cachedTex(key, 256, 128, (g, W, H) => {
    g.fillStyle = '#e4e5e2';
    g.fillRect(0, 0, W, H);
    txt(g, 'SENTRON 3WL', 12, 18, 16, '#16181b', 800);
    txt(g, orderNo(o), 12, 42, 14, '#16181b', 700);
    txt(g, `In ${o.wlIn} A · frame size ${['I', 'II', 'III'][S.size - 1]} · ${o.wlPoles}-pole`, 12, 64, 11, '#3c4247', 600);
    txt(g, `${WL_CLASS[o.wlClass].name}`, 12, 82, 11, '#3c4247', 600);
    txt(g, `IEC 60947-2 · Ue 690 V · ${o.wlMech === 'motor' ? 'motor operator' : 'manual operation'}`, 12, 100, 10, '#5d6670', 500);
  });
}

// the position window: CONNECTED · TEST · DISCONNECTED
const posMats = {};
const posMat = (p) => {
  if (!posMats[p]) {
    const [c, t] = {connected: ['#d6182b', 'CONNECTED'], test: ['#2f6fc2', 'TEST'], disconnected: ['#2e9d4a', 'DISCONNECTED'], removed: ['#2e9d4a', 'DISCONNECTED']}[p];
    posMats[p] = new THREE.MeshStandardMaterial({map: faceTex(128, 32, (g) => {
      g.fillStyle = '#1b1d20';
      g.fillRect(0, 0, 128, 32);
      g.fillStyle = c;
      g.fillRect(0, 26, 128, 6);
      txt(g, t, 64, 13, 14, '#ffffff', 700, 'center');
    }), roughness: 0.5});
  }
  return posMats[p];
};
const ledMat = {};
const led = (c) => (ledMat[c] ??= new THREE.MeshStandardMaterial({color: c, emissive: c, emissiveIntensity: c === '#2a2c30' ? 0 : 0.9, roughness: 0.4}));

/** the COM35 front print (p.11, Figure 2-1) */
const comTex = () =>
  cachedTex('com35', 288, 240, (g, W, H) => {
    g.fillStyle = '#e8e9e6';
    g.fillRect(0, 0, W, H);
    txt(g, 'PROFINET IO – MODBUS TCP', 14, 22, 17, '#3c4247', 600);
    txt(g, 'S1', W - 34, 22, 13, '#3c4247', 600);
    txt(g, 'MAC ADD:', 12, 62, 12, '#3c4247', 600);
    txt(g, 'XX-XX-XX-XX-XX-XX', 12, 78, 11, '#3c4247', 500);
    // QR code
    g.fillStyle = '#16181b';
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if ((i * 7 + j * 3 + i * j) % 3 === 0 || i % 8 === 0 || j % 8 === 0) g.fillRect(14 + i * 6, 96 + j * 6, 6, 6);
    txt(g, 'X1', 120, 62, 13, '#3c4247', 700, 'center');
    txt(g, 'X2', 184, 62, 13, '#3c4247', 700, 'center');
    ['PN', 'TCP', 'CUB'].forEach((s, i) => txt(g, s, 250, 66 + i * 34, 12, '#3c4247', 700, 'center'));
    txt(g, '3WL9111-0AT65-0AA0', 14, H - 20, 13, '#3c4247', 700);
    txt(g, 'Cat.No.: WLCOM35', W - 12, H - 20, 12, '#3c4247', 600, 'right');
  });

// a helical spring along y
const springGeo = (r, wire, turns, len) => {
  const pts = [];
  for (let i = 0; i <= turns * 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, -len / 2 + (i / (turns * 24)) * len, Math.sin(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, wire, 6, false);
};

/**
 * Builds a 3WL in the box of its module. Returns what the field needs to connect it: the bottom of the breaker yb,
 * the guide frame depth gd, the breaker record, the world z of the rear main terminals and the pole x positions.
 */
export function breakerWL(ctx, m, j, box, out, B) {
  const {M, hw, f} = ctx;
  const o = f.opts;
  const S = WL_SIZES[o.acb];
  const E = WL_ETU[o.wlEtu];
  const loc = ctx.R.loc(ctx.i, j);
  const h = box.y1 - box.y0;
  const cx = (box.x0 + box.x1) / 2;
  const fixed = o.wlMount === 'fixed';
  const pos = () => (fixed ? 'connected' : posOf(m));
  const np = o.wlPoles;
  const w = B.w;
  const bh = B.h;
  const yb = box.y0 + Math.max(20, (h - bh) / 2 - 30);
  const zf = DOOR_T - 4;
  const gd = Math.min(B.d + 20, zf - 30 - (ctx.zSep + 15));
  const bd = gd - 20;
  const gz = zf - 30 - gd / 2;
  const gw = w + 70;
  const gh = bh + 70;
  const pitch = w / np;
  // pole centres, left to right; a 4-pole breaker carries N on the left [inferred]
  const poleX = Array.from({length: np}, (_, p) => -w / 2 + pitch * (p + 0.5));
  const phaseX = np === 4 ? poleX.slice(1) : poleX;
  const ep = Math.min(1, w / 460);

  // ================================================================ the guide frame (fixed part) or mounting plate
  const gf = part(ctx, {
    name: fixed ? `Mounting plate 3WL · ${loc}` : `Guide frame ${o.acb} · ${loc}`,
    layer: 'unit', stage: 'devices', module: j, at: [cx, yb, gz], dir: [0, 0, 1], dist: 700,
    lines: fixed ? ['Fixed-mounted 3WL on its mounting plate', 'Spring plunger holds the COM35 S46 switch: CONNECTED', 'Main terminals at the rear'] : ['Withdrawable guide frame, Sendzimir galvanised', 'Telescopic rails, racking spindle, shutters', `${np}-pole · ${gw} × ${gh} × ${gd} mm [inferred]`],
  });
  if (!fixed) {
    // side walls with lightening holes, the floor, the rear plate, the top front cross member
    for (const sx of [-1, 1]) {
      const sw = mk(gf, plateGeo(gd, gh, 3, 4, [[-gd * 0.2, gh * 0.25, gd * 0.25, gh * 0.22, 0], [gd * 0.15, gh * 0.25, gd * 0.2, gh * 0.22, 0], [0, -gh * 0.12, 0, 0, 22]]), M.zinc, sx * (gw / 2 - 1.5), gh / 2, 0, {ry: Math.PI / 2});
      sw.castShadow = true;
      bx(gf, 3, 26, gd, M.zinc, sx * (gw / 2 - 18), 18, 0);
      for (const zz of [-gd / 2 + 40, gd / 2 - 40]) hw.screw(gf, [sx * gw / 2, 30, zz], [sx, 0, 0], 6, 'Guide frame side wall');
    }
    bx(gf, gw, 3, gd, M.zinc, 0, 1.5, 0);
    bx(gf, gw, 30, 3, M.zinc, 0, gh - 15, gd / 2 - 1.5);
    bx(gf, gw, 3, 60, M.zinc, 0, gh - 1.5, gd / 2 - 30);
    // rear plate with the terminal openings
    const holes = [];
    for (const px of poleX) for (const yy of [bh * 0.78 - gh / 2, bh * 0.32 - gh / 2]) holes.push([px, yy, pitch * 0.62, 46, 0]);
    mk(gf, plateGeo(gw, gh, 3, 2, holes), M.zinc, 0, gh / 2, -gd / 2 + 1.5);
    // telescopic withdrawal rails: the inner rail runs out with the breaker when it is removed
    for (const sx of [-1, 1]) {
      bx(gf, 10, 30, gd - 30, M.zinc, sx * (gw / 2 - 12), 45, 0);
      const rail = part(ctx, {parent: gf, sub: true, name: `Telescopic rail, ${sx < 0 ? 'left' : 'right'}`, layer: 'unit', stage: 'devices', module: j, at: [sx * (gw / 2 - 20), 45, 0], draw: () => (pos() === 'removed' ? 360 : 0), lines: ['Inner rail of the telescopic withdrawal rail', 'Carries the breaker when it is drawn out']});
      bx(rail, 7, 22, gd - 40, M.bolt, 0, 0, 0);
    }
    // the racking spindle under the breaker and the racking nut that the breaker rides on
    cy(gf, 8, gd - 30, M.bolt, 0, 26, 0, {rx: Math.PI / 2, seg: 12});
    bx(gf, 40, 22, 22, M.zinc, 0, 26, gd / 2 - 18);
    const nut = part(ctx, {parent: gf, sub: true, name: 'Racking nut', layer: 'unit', stage: 'devices', module: j, at: [0, 26, -gd / 2 + 60], draw: () => Math.min(TRAVEL[pos()], TRAVEL.disconnected), lines: ['Runs on the racking spindle', 'CONNECTED → TEST → DISCONNECTED with the crank']});
    bx(nut, 36, 26, 30, M.brass, 0, 0, 0);
    // the shutters over the isolating contacts: open in TEST and CONNECTED, closed once the breaker is out
    const sh = [];
    for (const [k, yy] of [[0, bh * 0.78], [1, bh * 0.32]]) {
      const s = bx(gf, w * 0.98, bh * 0.36, 2.5, M.insul, 0, yy, -gd / 2 + 58 + k * 3, 0, {keep: true});
      sh.push([s, yy]);
    }
    ctx.ticks.push(() => {
      const shut = pos() === 'disconnected' || pos() === 'removed';
      sh.forEach(([s, yy], k) => (s.position.y = shut ? yy : bh + 30 + k * 4));
    });
    // the position window on the guide frame front
    const pw = new THREE.Mesh(new THREE.PlaneGeometry(64, 16), posMat(pos()));
    pw.position.set(-gw / 2 + 60, 30, gd / 2 + 0.8);
    pw.userData.keep = true;
    gf.add(pw);
    ctx.ticks.push(() => (pw.material = posMat(pos())));
  } else {
    bx(gf, gw, 4, bd, M.zinc, 0, 2, -10);
    for (const sx of [-1, 1]) bx(gf, 4, 60, bd, M.zinc, sx * (gw / 2 - 2), 30, -10);
    for (const sx of [-1, 1]) for (const zz of [-bd / 2 + 30, bd / 2 - 50]) hw.bolt(gf, [sx * (w / 2 - 20), 6, zz], [0, -1, 0], 10, 10, {nut: false, what: 'Breaker to mounting plate'});
  }
  // main terminals at the rear: horizontal flat connectors, upper (busbar side) and lower (cable side)
  const tg = part(ctx, {parent: gf, sub: true, name: `Main terminals, ${np}-pole`, layer: 'unit', stage: 'devices', module: j, at: [0, 0, -gd / 2], lines: ['Horizontal rear connectors, Cu', 'M12 · 70 Nm (DIN 6796)', 'Upper: busbar side · lower: cable side']});
  for (const px of poleX)
    for (const yy of [bh * 0.78, bh * 0.32]) {
      bx(tg, pitch * 0.55, 14, 24, M.copperTin, px, yy, -2);
      bx(tg, pitch * 0.5, 34, 26, M.insul, px, yy, 18);
      for (const dx of [-pitch * 0.13, pitch * 0.13]) hw.bolt(tg, [px + dx, yy + 7, -6], [0, -1, 0], 12, 14, {what: '3WL main terminal'});
    }

  // ---------------------------------------------------------------- the auxiliary conductor plug-in system X5…X8
  const ax = part(ctx, {parent: gf, sub: true, name: 'Auxiliary conductor plug-in system X5–X8', layer: 'unit', stage: 'devices', module: j, at: [0, gh + 18, gd / 2 - 40], lines: ['Sliding contacts for the control circuits', 'X5 releases · X6 aux switches · X7 COM35 · X8 CubicleBUS', 'COM35 at X7: X7 terminals are not available (p.15)']});
  bx(ax, gw - 10, 6, 70, M.zinc, 0, -15, 0);
  const blocks = ['X5', 'X6', 'X7', 'X8'];
  const bw = Math.min(90, (gw - 40) / 4);
  blocks.forEach((b, k) => {
    const x = -gw / 2 + 20 + bw * (k + 0.5);
    if (b === 'X7' && o.wlCom === 'COM35') return;
    bx(ax, bw - 6, 24, 60, M.devDark, x, 0, 0);
    for (let t = 0; t < 6; t++) cy(ax, 2.6, 3, M.bolt, x - (bw - 18) / 2 + (t * (bw - 18)) / 5, 12.5, 18, {seg: 8});
    label(ax, b, 22, 10, x, 0, 30.8, {pw: 64, ph: 32, size: 22, bg: '#24262a', fg: '#e8eef2'});
  });

  // ---------------------------------------------------------------- COM35 at X7 (COM35 p.11–20, 30, 50)
  let com = null;
  if (o.wlCom === 'COM35') {
    const xc = -gw / 2 + 20 + bw * 2.5;
    com = part(ctx, {parent: gf, sub: true, name: 'COM35 communication module', layer: 'unit', stage: 'devices', module: j, at: [xc, gh + 18 + 30, gd / 2 - 52], lines: ['PROFINET IO + Modbus TCP, 2 × RJ45 with switch', '72 × 60 × 92 mm · 160 g · 24 V DC 125 mA (p.47–50)', 'Position by micro-switches S46 S47 S48 (p.30)']});
    bx(com, 72, 60, 92, M.devLight, 0, 0, 0);
    // the printed front (72 x 60) and the terminal ridge on top with terminals 1–9 (p.16)
    const face = new THREE.Mesh(new THREE.PlaneGeometry(70, 58), new THREE.MeshStandardMaterial({map: comTex(), roughness: 0.55}));
    face.position.set(0, 0, 46.7);
    face.userData.keep = true;
    com.add(face);
    bx(com, 72, 14, 26, M.devLight, 0, 37, 20);
    for (let t = 0; t < 9; t++) {
      cy(com, 2.6, 3, M.bolt, -30 + t * 7.5, 45.5, 24, {seg: 8});
      bx(com, 5, 6, 8, M.devDark, -30 + t * 7.5, 42, 34);
    }
    label(com, 'CubicleBUS  IN  1 2 3 4 5 6 7 8 9  OUT', 66, 6, 0, 37, 33.8, {pw: 512, ph: 48, size: 26, bg: '#16181b', fg: '#e8eef2'});
    // RJ45 ports X1 X2, LEDs PN TCP CUB, function button S1
    for (const px of [-4, 14]) bx(com, 14, 12, 8, M.black, px, 4, 43.5);
    const leds = ['PN', 'TCP', 'CUB'].map((s, i) => {
      const l = cy(com, 2.2, 2, led('#2a2c30'), 28, 9 - i * 7, 47, {rx: Math.PI / 2, seg: 10, keep: true});
      l.userData.keep = true;
      return l;
    });
    cy(com, 3, 3, M.devDark, 28, 23, 47.2, {rx: Math.PI / 2, seg: 10});
    ctx.ticks.push(() => {
      const d = com35Data(o, pos()).leds;
      const on = Math.floor(performance.now() / 400) % 2 === 0;
      leds[0].material = led(d.PN === 'green' ? '#2fbf55' : '#2a2c30');
      leds[1].material = led(d.TCP === 'green' ? '#2fbf55' : '#2a2c30');
      leds[2].material = led(d.CUB === 'green' || (d.CUB === 'flash' && on) ? '#2fbf55' : '#2a2c30');
    });
    // rear: the CubicleBUS RJ45 with its terminating plug, and the twisted-pair lead to X8 (p.20)
    bx(com, 16, 14, 12, M.devDark, 18, 4, -50);
    mk(com, cableGeo([[-10, 8, -46], [-20, 0, -70], [-40, -10, -60], [bw + 10, -14, -20]], 3), M.cable, 0, 0, 0, {shadow: false});
    mk(com, cableGeo([[-14, 8, -46], [-24, 2, -72], [-44, -8, -62], [bw + 12, -16, -18]], 3), M.cable, 0, 0, 0, {shadow: false});
    // the three micro-switches underneath, rear to front S46 S47 S48, and the position slide under them
    const plungers = [-28, 0, 28].map((zz, k) => {
      bx(com, 18, 8, 14, M.devDark, -18, -34, zz);
      const pl = bx(com, 5, 8, 5, M.bolt, -18, -41, zz, 0, {keep: true});
      label(com, ['S46', 'S47', 'S48'][k], 12, 5, -18, -34, zz + 7.4, {pw: 48, ph: 20, size: 16, bg: '#24262a', fg: '#e8eef2'}).rotation.x = 0;
      return pl;
    });
    const slide = part(ctx, {parent: gf, sub: true, name: 'Position signalling slide', layer: 'unit', stage: 'devices', module: j, at: [xc - 18, gh + 18 - 22, gd / 2 - 52 - 28], draw: () => SLIDE[pos()], lines: ['Coupled to the racking mechanism [inferred]', 'Its cam operates S46 (connected), S47 (test), S48 (disconnected)', 'None operated: breaker not available (p.30)']});
    bx(slide, 12, 6, 70, M.zinc, 0, 0, -20);
    bx(slide, 12, 8, 10, M.accent, 0, 6, 0);
    ctx.ticks.push(() => {
      const s = POSITION[pos()].s;
      plungers.forEach((pl, k) => {
        pl.position.y = s[k] ? -37 : -41;
        pl.material = s[k] ? M.green : M.bolt;
      });
    });
  }

  // ================================================================ the breaker (moving part)
  const g = part(ctx, {
    name: `Circuit-breaker ${orderNo(o)} · ${loc}`,
    layer: 'unit', stage: 'units', module: j,
    at: [cx, yb + bh / 2 + 8, zf - bd / 2],
    dir: [0, 0.05, 1], dist: 1100,
    draw: fixed ? null : () => TRAVEL[pos()],
    lines: [`SENTRON ${o.acb} · frame size ${['I', 'II', 'III'][S.size - 1]} · ${np}-pole`, `In ${o.wlIn} A · ${WL_CLASS[o.wlClass].name}`, `${E.name}${o.wlGf === 'yes' ? ' + ground-fault module' : ''} · ${o.wlMech === 'motor' ? 'motor operator' : 'manual'}`, `Position: %POS%`],
  });
  g.userData.part.posOf = pos;
  const sub = (name, at, fly, flyAt, lines, parent = g) => part(ctx, {parent, sub: true, name, layer: 'unit', stage: 'units', module: j, at, fly, flyAt, lines});

  // the housing: moulded insulating body around the poles; in the exploded view it drops away
  const housing = sub('Breaker housing', [0, 0, -12], [0, -(bh + 260), -60], 0.35, ['Moulded insulating housing (thermoset)', 'Carries poles, mechanism and the front cover', 'Carrying handles on both sides']);
  bx(housing, w, bh, bd - 24, M.dev, 0, 0, 0);
  for (const sx of [-1, 1]) {
    bx(housing, 10, 18, 120, M.devDark, sx * (w / 2 + 5.6), bh / 2 - 30, bd / 2 - 110);
    bx(housing, 8, 18, bd - 60, M.zinc, sx * (w / 2 + 4.6), -bh / 2 + 22, 0);
  }
  // the poles: per pole an insulating cassette with the fixed and moving main contacts, the arcing contacts, the
  // flexible connector, the current sensor and the primary disconnect contacts at the rear
  poleX.forEach((px, p) => {
    const isN = np === 4 && p === 0;
    const pg = sub(`Pole ${isN ? 'N' : `L${np === 4 ? p : p + 1}`}`, [px, 0, -bd / 2 + 110], [(p - (np - 1) / 2) * 120, 60, -10], 0.45, ['Main contacts: fixed + moving contact arm', 'Arcing contacts lead the main contacts', 'Flexible Cu connector, current sensor on the lower path']);
    bx(pg, 4, bh * 0.86, 190, M.insul, -pitch * 0.42, 0, 0);
    bx(pg, 4, bh * 0.86, 190, M.insul, pitch * 0.42, 0, 0);
    bx(pg, pitch * 0.5, 34, 60, M.copper, 0, bh * 0.28, -70);
    bx(pg, pitch * 0.5, 34, 60, M.copper, 0, -bh * 0.18, -70);
    bx(pg, pitch * 0.46, 22, 24, M.copperTin, 0, bh * 0.2, 0);
    const arm = bx(pg, pitch * 0.4, bh * 0.34, 16, M.copper, 0, bh * 0.04, 28);
    arm.rotation.x = -0.18;
    bx(pg, pitch * 0.4, 30, 50, M.copper, 0, -bh * 0.14, 10);
    // the flexible connector: laminated braid, drawn as a stack
    for (let k = 0; k < 5; k++) bx(pg, pitch * 0.4, 3, 40, M.copperTin, 0, -bh * 0.1 + k * 4, 40);
    // the current sensor ring around the lower conductor
    const cs = sub(`Current sensor ${isN ? 'N' : `L${np === 4 ? p : p + 1}`}`, [0, -bh * 0.18, -40], [0, -90, 0], 0.55, ['Current transformer: energy and measuring', 'Feeds the ETU on the CubicleBUS'], pg);
    mk(cs, plateGeo(pitch * 0.74, 70, 40, 10, [[0, 0, pitch * 0.54, 42, 0]]), M.devDark, 0, 0, 0, {rx: Math.PI / 2});
    // primary disconnect contacts at the rear (finger clusters)
    for (const yy of [bh * 0.28, -bh * 0.18]) hw.fingers(pg, [0, yy, -112], 4, Math.min(16, pitch * 0.14), [10 * ep, 30, 34], {title: 'Primary disconnect contact', lines: ['Silver-plated finger cluster', 'Plugs onto the guide frame terminal', 'Grease: Isoflex Topas NB 52 (OI Betrieb p.18)']});
    // the arc chute on top of the pole: housing, a stack of splitter plates that lifts out of it, the vent grid
    const ac = sub(`Arc chute ${isN ? 'N' : `L${np === 4 ? p : p + 1}`}`, [px, bh / 2 + 18, -bd / 2 + 150], [0, 300 + p * 20, 0], 0.15 + p * 0.04, ['Quenches the arc on opening', 'Splitter plates in a ceramic-fibre housing', 'Inspect after a short-circuit trip']);
    bx(ac, pitch * 0.84, 36, 170, M.devDark, 0, 0, 0);
    for (let k = 0; k < 7; k++) bx(ac, pitch * 0.7, 2.4, 6, M.black, 0, 19.2, -66 + k * 22);
    const plates = sub('Splitter plates', [0, -12, 0], [0, 110, 0], 0.5, ['Steel splitter plates, divide the arc', `${12} plates per pole [inferred]`], ac);
    for (let k = 0; k < 12; k++) bx(plates, pitch * 0.66, 30, 2, M.zinc, 0, 0, -66 + k * 12);
  });

  // the stored-energy operating mechanism at the left front, with its closing spring and the motor operator
  const mech = sub('Stored-energy operating mechanism', [-w * 0.28, -bh * 0.05, bd / 2 - 90], [-(w / 2 + 180), 20, 140], 0.25, ['Closing spring charged by hand lever or motor', 'Closes in < 80 ms [inferred]', 'Operations counter, ready-to-close signal']);
  bx(mech, w * 0.26, bh * 0.62, 110, M.zinc, 0, 0, 0);
  for (const sx of [-1, 1]) mk(mech, springGeo(16, 3.2, 9, bh * 0.4), M.bolt, sx * w * 0.06, 0, 62, {shadow: false});
  if (o.wlMech === 'motor') {
    const mot = sub('Motor operator (spring charging motor)', [0, -bh * 0.36, 20], [0, -120, 60], 0.4, ['Recharges the closing spring after closing', 'Remote operation with closing coil Y1'], mech);
    cy(mot, 26, 90, M.devDark, 0, 0, 0, {rx: 0, seg: 18});
    bx(mot, 50, 30, 50, M.zinc, 0, 50, 0);
  }
  // the auxiliary releases on top of the mechanism: Y1, F1, then F2 or F3
  const rel = o.wlRel.split('+');
  rel.forEach((r, k) => {
    const nm = {Y1: 'Closing coil Y1', F1: 'Shunt release F1', F2: '2nd shunt release F2', F3: 'Undervoltage release F3'}[r];
    const rg = sub(nm, [-w * 0.42 + k * 48, bh / 2 - 34, bd / 2 - 60], [0, 230 + k * 40, 120], 0.2 + k * 0.05, [nm, r === 'F3' ? 'Opens when the voltage drops' : 'Plug-in coil, wired via X5', 'COM35 drives Y1 / F1 at 24 V DC directly (p.17)']);
    bx(rg, 40, 46, 56, r === 'F3' ? M.devDark : M.dev, 0, 0, 0);
    bx(rg, 36, 8, 50, M.yellow, 0, 24, 0);
  });
  // auxiliary switch block, breaker status sensor BSS, metering function (ETU76B)
  const aux = sub('Auxiliary switch block S1–S4', [w * 0.36, bh / 2 - 40, bd / 2 - 70], [w / 2 + 160, 160, 60], 0.25, ['Auxiliary contacts for the breaker state', 'Wired to X6']);
  bx(aux, w * 0.18, 50, 60, M.devLight, 0, 0, 0);
  const bss = sub('Breaker status sensor BSS', [w * 0.34, -bh * 0.3, bd / 2 - 70], [w / 2 + 170, -60, 80], 0.3, ['CubicleBUS node: breaker state, spring, trip', 'Temperature sensor inside the breaker (p.13)']);
  bx(bss, 60, 40, 50, M.devLight, 0, 0, 0);
  if (o.wlEtu === '76B') {
    const mf = sub('Metering function PLUS', [w * 0.12, -bh * 0.32, bd / 2 - 70], [80, -200, 160], 0.3, ['CubicleBUS node: U, P, Q, S, cos φ, THD', 'Enhanced protection: voltage, frequency, power (Tab. 4-11)']);
    bx(mf, 90, 50, 50, M.devLight, 0, 0, 0);
  }

  // the front cover with its print and the cut-outs for the ETU and the charging lever
  const ew = Math.max(150, Math.min(220, w * 0.42));
  const eh = Math.max(150, Math.min(210, bh * 0.42));
  const ex = w * 0.05;
  const ey = bh * 0.14;
  const cov = sub('Front cover', [0, 0, bd / 2 + 1.5], [0, 30, 300], 0.05, ['Moulded front cover, RAL 7035', 'Cut-outs: trip unit, hand lever, crank', 'Push buttons, indicators, operations counter']);
  mk(cov, plateGeo(w - 6, bh - 6, 3, 4, [[ex, ey, ew + 6, eh + 6, 0], [0, -bh * 0.34, 90, 70, 0]]), M.devLight, 0, 0, 0);
  const print = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(220, w * 0.42), Math.min(110, w * 0.21)), new THREE.MeshStandardMaterial({map: coverTex(o), roughness: 0.6}));
  print.position.set(-w / 2 + Math.min(110, w * 0.21) + 12, -bh * 0.14, 2.2);
  print.userData.keep = true;
  cov.add(print);
  // ON (I, green) and OFF (O, red) push buttons, the open/closed and spring windows, operations counter
  const bxx = -w / 2 + 40;
  cy(cov, 15, 10, M.green, bxx, bh * 0.3, 6.5, {rx: Math.PI / 2, seg: 20});
  cy(cov, 15, 10, M.accent, bxx, bh * 0.3 - 40, 6.5, {rx: Math.PI / 2, seg: 20});
  for (const [k, mat] of [[0, M.black], [1, M.yellow], [2, M.black]].map(([a, b]) => [a, b])) bx(cov, 30, 16, 2, mat, bxx + 46, bh * 0.3 - k * 22, 2.6);
  bx(cov, 34, 12, 2, M.black, bxx + 46, bh * 0.3 - 74, 2.6);
  // the trip indicator / reset button
  cy(cov, 9, 12, M.accent, ex + ew / 2 + 22, ey + eh / 2 - 10, 7.5, {rx: Math.PI / 2, seg: 14});
  // the racking crank opening and the padlock hasp on the breaker front
  if (!fixed) {
    cy(cov, 12, 4, M.black, 0, -bh / 2 + 26, 3.6, {rx: Math.PI / 2, seg: 16});
    bx(cov, 14, 26, 4, M.bolt, w / 2 - 30, -bh / 2 + 30, 3.6);
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) hw.screw(cov, [sx * (w / 2 - 14), sy * (bh / 2 - 14), 1.6], [0, 0, 1], 6, 'Front cover');
  // the hand lever for charging the closing spring
  const lever = sub('Hand lever (spring charging)', [0, -bh * 0.34, bd / 2 + 8], [0, -130, 360], 0.1, ['Pump to charge the closing spring', 'Spring state shown in the window above']);
  bx(lever, 70, 54, 16, M.black, 0, 0, 0);
  bx(lever, 40, 18, 30, M.devDark, 0, -12, 14);
  // the electronic trip unit, its rating plug and the front interface for the TD400
  const etu = sub(`Electronic trip unit ${E.name}`, [ex, ey, bd / 2 + 4], [0, 60, 470], 0.08, [`${E.name}${o.wlGf === 'yes' ? ' + ground-fault module G' : ''} · trip unit type ${(o.wlGf === 'yes' ? E.codeG : E.code) ?? 'n/a'} (Format 412)`, E.sets ? 'Two parameter sets A / B (DAS, p.26)' : 'Settings by rotary coding switches', 'Front interface for TD400 (p.88)']);
  bx(etu, ew, eh, 30, M.devDark, 0, 0, 0);
  const ef = new THREE.Mesh(new THREE.PlaneGeometry(ew - 8, eh - 8), new THREE.MeshStandardMaterial({map: etuTex(o), roughness: 0.5}));
  ef.position.set(0, 0, 15.8);
  ef.userData.keep = true;
  etu.add(ef);
  const plug = sub(`Rating plug ${o.wlIn} A`, [-ew / 2 + 28, -eh / 2 - 16, 6], [0, -60, 120], 0.3, [`Sets In = ${o.wlIn} A (data point 377)`, 'Exchangeable, coded to the frame size'], etu);
  bx(plug, 48, 26, 26, M.devLight, 0, 0, 0);
  label(plug, `${o.wlIn} A`, 40, 14, 0, 0, 13.6, {pw: 128, ph: 44, size: 30, bg: '#e4e5e2'});
  if (E.sets) {
    const das = new THREE.Mesh(new THREE.PlaneGeometry(34, 12), new THREE.MeshStandardMaterial({color: o.wlDas === 'on' ? '#e7c11e' : '#4a4e55', emissive: o.wlDas === 'on' ? '#e7c11e' : '#000000', emissiveIntensity: 0.6}));
    das.position.set(ew / 2 - 24, eh / 2 + 10, 0.8);
    das.userData.keep = true;
    etu.add(das);
  }
  out.push({j, y: yb + 40, h: 120, amps: o.wlIn, label: m.label, loc, acb: true});
  return {yb, gd, br: B, zTerm: gz - gd / 2 - 10, px: phaseX, com, gf, gh, gz, bw};
}

/** the COM35 Ethernet patch cables from X1 / X2 up to the cross-wiring compartment (field coordinates) */
export function com35Cables(ctx, r, cx) {
  const {M} = ctx;
  const g = part(ctx, {name: 'PROFINET / Modbus TCP cables X1 X2', layer: 'inner', stage: 'devices', at: [0, 0, 0], dir: [0, 0.6, 0.5], dist: 300, lines: ['Industrial Ethernet, RJ45, 100 Mbit/s', 'Daisy chain through the COM35 switch (p.13)', 'Up to the cross-wiring compartment']});
  const x0 = r.gf.position.x - (r.br.w + 70) / 2 + 20 + r.bw * 2.5;
  const y0 = r.gf.position.y + r.gh + 18 + 34;
  const z0 = r.gz + r.gd / 2 - 52 + 50;
  const teal = M.cableTeal || (M.cableTeal = new THREE.MeshStandardMaterial({color: '#2a9d8f', roughness: 0.7}));
  for (const [k, dx] of [[0, -4], [1, 14]]) {
    mk(g, cableGeo([[x0 + dx, y0, z0], [x0 + dx, y0, z0 + 30], [x0 + dx + 10, y0 + 80, z0 + 20], [ctx.W - 120 + k * 14, ctx.yt - 200, -40], [ctx.W - 120 + k * 14, ctx.yt - 160, -120]], 3.2), teal, 0, 0, 0, {shadow: false});
  }
  return g;
}
