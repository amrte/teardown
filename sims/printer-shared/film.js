// Filament FX-1, the tour: the printer (printer.js) on the studio (stage.js) under the console (console.js), all read
// from one run of the firmware model (model.js). Film time maps to machine time through keyframes pinned to the
// model's own events: homing at 2×, a look into the menu, the heat-up at about 20×, the first layer, then one G-code
// line followed at 1/8× from the listing down through the parser, the planner, the step pulses, the driver's coils,
// the rotor and the belt to the nozzle; a layer at 1×, the hotend in section, the board under x-ray, the whole
// machine. render(t) is a pure function of t. The live page plays the same SCRIPT as its auto tour.
import {runSim} from '../kit/runtime.js';
import {createConsole, VIEWS} from './console.js';
import {P, runModel} from './model.js';
import {K} from './printer.js';
import {createScreen} from './screen.js';
import {createStage} from './stage.js';
import {LAYER_HW, LAYERS_UI, machineAt, poseOf, screenData} from './state.js';
import * as THREE from 'three';

export const DURATION = 30;
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'fx1', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ the operator's moves, in film seconds
export const SCRIPT = [
  {t: 0, view: 'hero'},
  {t: 1.5, layer: 'host'},
  {t: 3.6, view: 'screen'},
  {t: 4.1, layer: 'ui'},
  {t: 8.0, layer: 'thermal'},
  {t: 8.5, view: 'hotend'},
  {t: 11.5, view: 'head'},
  {t: 11.9, layer: 'planner'},
  {t: 15.6, follow: true},
  {t: 16.4, layer: 'parser', auto: true},
  {t: 17.2, layer: 'planner', auto: true},
  {t: 18.0, layer: 'stepper', auto: true},
  {t: 18.2, view: 'motor', auto: true},
  {t: 18.3, cut: 'motor', auto: true},
  {t: 19.5, layer: 'driver', auto: true},
  {t: 20.7, layer: 'mech', auto: true},
  {t: 20.8, cut: 'motor', auto: true},
  {t: 20.9, view: 'head', auto: true},
  {t: 22.6, view: 'hotend'},
  {t: 22.9, cut: 'hotend'},
  {t: 23.3, layer: 'thermal'},
  {t: 25.7, view: 'board'},
  {t: 26.0, cut: 'xray'},
  {t: 26.3, layer: 'stepper'},
  {t: 27.7, cut: 'hotend'},
  {t: 27.9, view: 'hero'},
  {t: 28.2, layer: null},
];
export const FOLLOW_STAGES = [0, 0.8, 1.6, 2.4, 3.9, 4.6, 5.1, 5.5]; // seconds after the click: line, parser, planner, ISR, driver, motor, belt, nozzle

// ------------------------------------------------------------ film time → machine time, pinned to the model's events
function monotone(xs, ys) {
  // Fritsch–Carlson: a smooth, never-backward clock
  const n = xs.length;
  const d = [];
  const m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (3 * (xs[i + 1] - xs[i - 1])) / ((2 * xs[i + 1] - xs[i] - xs[i - 1]) / d[i - 1] + (xs[i + 1] - 2 * xs[i] + xs[i - 1]) / d[i]));
  m.push(d[n - 2]);
  // the plateau keyframes (follow-a-line) hold their slope exactly
  return {
    at(x) {
      if (x <= xs[0]) return ys[0] + (x - xs[0]) * m[0];
      if (x >= xs[n - 1]) return ys[n - 1] + (x - xs[n - 1]) * m[n - 1];
      let i = 0;
      while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i];
      const u = (x - xs[i]) / h;
      const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
      const h10 = u ** 3 - 2 * u ** 2 + u;
      const h01 = -2 * u ** 3 + 3 * u ** 2;
      const h11 = u ** 3 - u ** 2;
      return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
    },
  };
}
export function makeClock(M) {
  const ev = M.ev;
  const fb = M.blocks[ev.follow];
  const Ts = fb.tStart;
  const keys = [
    [0, 0],
    [3.6, ev.homeDone - 0.4],
    [8.0, M.knob[M.knob.length - 1].t + 0.4],
    [11.5, ev.heatDone - 2.5],
    [13.0, ev.printStart + 1.2],
    [15.6, Ts - 0.2],
    [21.6, Ts - 0.2 + 6 / 8],
    [25.0, Ts + 0.55 + 3.6],
    [27.6, Ts + 0.55 + 6.2],
    [30, Ts + 0.55 + 8.6],
  ];
  const f = monotone(
    keys.map((k) => k[0]),
    keys.map((k) => k[1]),
  );
  const tmAt = (t) => Math.max(0, f.at(t));
  const rateAt = (t) => (tmAt(t + 0.01) - tmAt(t - 0.01)) / 0.02;
  return {tmAt, rateAt, keys, followLine: fb.line, followBlock: fb};
}

// ------------------------------------------------------------ the script's state at film time t
const last = (key, t, pred = () => true) => SCRIPT.filter((e) => key in e && e.t <= t && pred(e)).pop();
export const viewAt = (t) => {
  const e = last('view', t);
  return [e.t, e.view];
};
export const openAt = (t) => {
  // one layer open at a time: the newest eases in, the one before eases out
  const out = Object.fromEntries(LAYERS_UI.map((k) => [k, 0]));
  const evs = SCRIPT.filter((e) => 'layer' in e && e.t <= t);
  const cur = evs[evs.length - 1];
  const prev = evs[evs.length - 2];
  const k = cur ? ss(cur.t, cur.t + 0.55, t) : 0;
  if (cur?.layer) out[cur.layer] = Math.max(out[cur.layer], k);
  if (prev?.layer && prev.layer !== cur?.layer) out[prev.layer] = Math.max(out[prev.layer], 1 - k);
  return out;
};
export const cutAt = (t) => {
  const out = {motor: 0, hotend: 0, xray: 0};
  for (const c of Object.keys(out)) {
    const evs = SCRIPT.filter((e) => e.cut === c && e.t <= t);
    const on = evs.length % 2 === 1;
    const t0 = evs.length ? evs[evs.length - 1].t : -9;
    const k = ss(t0, t0 + 0.5, t);
    out[c] = on ? k : 1 - k;
  }
  return out;
};
export const followAt = (t, clock) => {
  const e = SCRIPT.find((x) => x.follow);
  if (!e || t < e.t || t > e.t + 6.3) return null;
  const u = t - e.t;
  let stage = 0;
  FOLLOW_STAGES.forEach((s, i) => {
    if (u >= s) stage = i;
  });
  return {line: clock.followLine, block: clock.followBlock, stage, flash: Math.max(0, 1 - u / 0.6), u};
};

// ------------------------------------------------------------ cameras: target, azimuth, elevation (degrees), distance
// The 3D view lives between the side columns: its centre is about (795, 430) on the 1600 x 900 console.
const nozzleW = (m) => [(m.pos.x - 110) / 1000, (K.bedTop + m.pos.z) / 1000, 0];
export const VIEW_FN = {
  hero: (u) => ({tx: 0.06, ty: 0.27, tz: 0.0, az: 34 + 1.6 * u, el: 17, d: 2.2, sx: 0, sy: -24}),
  front: (u) => ({tx: 0.06, ty: 0.25, tz: 0, az: 4 + u, el: 9, d: 1.95, sx: 0, sy: -14}),
  head: (u, m) => {
    const [x, y] = nozzleW(m);
    return {tx: x * 0.7 + 0.01, ty: y + 0.03, tz: -0.03, az: 28 + 1.2 * u, el: 24, d: 0.62, sx: 0, sy: -18};
  },
  motor: (u, m) => {
    const [, y] = nozzleW(m);
    return {tx: -0.238, ty: y + 0.055, tz: -0.1, az: 204 + 1.5 * u, el: 12, d: 0.2, sx: 0, sy: -18};
  },
  hotend: (u, m) => {
    const [x, y] = nozzleW(m);
    return {tx: x, ty: y + 0.022, tz: 0, az: 2 + 0.8 * u, el: 6, d: 0.155, sx: 0, sy: -18};
  },
  board: (u) => ({tx: 0.327, ty: 0.016, tz: -0.025, az: 62 + 1.5 * u, el: 56, d: 0.42, sx: 0, sy: -18}),
  screen: (u) => ({tx: 0.2, ty: 0.045, tz: 0.25, az: 6 + 0.8 * u, el: 24, d: 0.3, sx: 0, sy: -18}),
};
const blend = (a, b, k) => {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : a[key] + (b[key] - a[key]) * k;
  // a long swing backs off a little so the move reads as one arc
  const swing = Math.min(1, Math.abs(((b.az - a.az + 540) % 360) - 180) / 120);
  o.d += Math.max(a.d, b.d) * 1.3 * swing * Math.sin(Math.PI * k);
  return o;
};
export const camAt = (t, mAt) => {
  const list = SCRIPT.filter((e) => e.view).map((e) => [e.t, e.view]);
  let i = 0;
  while (i < list.length - 1 && list[i + 1][0] <= t) i++;
  const cur = VIEW_FN[list[i][1]](t - list[i][0], mAt);
  if (i === 0) return cur;
  const k = ss(list[i][0], list[i][0] + 1.5, t);
  if (k >= 1) return cur;
  return blend(VIEW_FN[list[i - 1][1]](t - list[i - 1][0], mAt), cur, k);
};

// ------------------------------------------------------------ the operator's pointer (film coordinates)
const REST = [[820, 470], [700, 420], [900, 520], [760, 380]];
export function makeCursor(ui, M, clock) {
  const sp = ui.spots();
  const OPEN_H = ui.ST.h - ui.ST.head - LAYERS_UI.length * ui.ST.row;
  // where a layer's row is when the click lands: the rows above an open layer sit lower by its height
  const rowSpot = (k, t) => {
    const open = openAt(t - 0.01);
    let y = ui.ST.y + ui.ST.head;
    for (const L of LAYERS_UI) {
      if (L === k) return [ui.ST.x + 120, y + 13];
      y += ui.ST.row + OPEN_H * open[L];
    }
    return [ui.ST.x + 120, ui.ST.y + 40];
  };
  const lineSpot = (t) => {
    const m = machineAt(M, clock.tmAt(t));
    const focus = m.ls.exec ?? m.ls.parsed ?? 1;
    const first = Math.max(1, Math.min(M.lines.length - 20, focus - 8));
    return [150, 150 + (clock.followLine - first) * 14 + 7];
  };
  const EV = SCRIPT.filter((e) => e.t > 0 && !e.auto).map((e) => {
    if (e.layer !== undefined) {
      // a click on the open row closes it
      const prev = SCRIPT.filter((x) => 'layer' in x && x.t < e.t).pop();
      return {t: e.t, spot: rowSpot(e.layer ?? prev?.layer ?? 'ui', e.t)};
    }
    if (e.view) return {t: e.t, spot: sp[e.view]};
    if (e.cut) return {t: e.t, spot: sp['c_' + e.cut]};
    if (e.follow) return {t: e.t, spot: lineSpot(e.t)};
    return null;
  }).filter(Boolean);
  const WP = [[0, 900, 600]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.16, ...e.spot], [e.t + 0.22, ...e.spot]);
    const next = EV[i + 1];
    if (!next || next.t - e.t > 1.6) WP.push([e.t + 1.2, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = Math.sin(Math.PI * k) * Math.min(24, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + 0.09) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ one frame, for the film and the live page alike
const LABELS = {
  hero: [
    ['X MOTOR', 'BELT · 80 STEPS/MM', 'xmotor', -200, -30],
    ['HOTEND', '40 W · 100 K NTC', 'heater', 120, -120],
    ['MAIN BOARD', '32-BIT MCU · 4 DRIVERS', 'mcu', 60, 40],
    ['SCREEN + KNOB', '128 × 64 · 20 DETENTS', 'lcd', -190, 50],
    ['Z LEAD SCREWS', 'T8 · 400 STEPS/MM', 'zscrew', 40, -150],
    ['Y BELT', 'GT2 · THE BED SLIDES', 'ybelt', -200, 70],
  ],
  front: [],
};
export function makeFrame(st, ui, opts = {}) {
  const drawScreen = createScreen(st.pr.screenCanvas);
  let frameNo = 0;
  let screenKey = 0;
  const V = THREE.Vector3;
  void V;
  const inView = (p) => p && p[0] > 320 && p[0] < 1275 && p[1] > 128 && p[1] < 742;
  /** f: {M, m, rate, paused, view, viewSince, cam, open, cut, follow, partInfo, touched, window, cursor, labels} */
  return (f) => {
    const {M, m} = f;
    frameNo++;
    const dirty = drawScreen(screenData(M, m));
    if (dirty) screenKey++;
    // the hardware each open layer drives, lit in the accent
    const hl = {};
    for (const k of LAYERS_UI) for (const g of LAYER_HW[k]) hl[g] = Math.max(hl[g] ?? 0, f.open[k] ?? 0);
    if (f.follow) {
      const s = f.follow.stage;
      if (s >= 5) hl.motors = Math.max(hl.motors ?? 0, 1);
      if (s === 6) hl.belts = 1;
      if (s === 7) hl.bead = 1;
    }
    if (f.partHL) for (const g of f.partHL) hl[g] = 1;
    hl.cables = Math.max(hl.cables ?? 0, (f.open.stepper ?? 0) + (f.open.driver ?? 0) + (f.cut.xray ?? 0));
    hl.drivers = Math.max(hl.drivers ?? 0, f.cut.xray ?? 0);
    ui.layout(f.open);
    const pose = poseOf(m, {cut: f.cut, hl, aheadOn: Math.max(f.open.planner ?? 0, f.follow && f.follow.stage === 2 ? 1 : 0), coilShow: 1}, frameNo, dirty);
    st.frame(pose, {...f.cam, az: f.cam.az * D2R, el: f.cam.el * D2R});
    // callouts: names in the wide views, leaders from the open panel into the part it drives
    const callouts = [];
    const P2 = (name) => st.project(st.pr.anchor(name));
    const lab = LABELS[f.view] ?? [];
    for (const [name, sub, at, dx, dy] of lab) {
      const p = P2(at);
      if (!inView(p)) continue;
      const lx = Math.min(1150, Math.max(330, p[0] + dx));
      callouts.push({name, sub, at: p, label: [lx, p[1] + dy], w: 130, o: f.labels});
    }
    const lead = (k, part, from) => {
      const o = f.open[k] ?? 0;
      if (o < 0.3) return;
      const p = P2(part);
      if (inView(p)) callouts.push({at: p, from, o: (o - 0.3) / 0.7});
    };
    const panelY = (k) => ui.rowSpot(k)[1] + 70;
    lead('ui', 'lcd', [ui.ST.x, panelY('ui')]);
    lead('host', 'usb', [ui.ST.x, panelY('host')]);
    lead('planner', 'nozzle', [ui.ST.x, panelY('planner')]);
    lead('stepper', 'xmotor', [ui.AN.x + 250, ui.AN.y]);
    lead('driver', 'xmotorBack', [ui.ST.x, panelY('driver')]);
    lead('thermal', 'heater', [ui.ST.x, panelY('thermal')]);
    lead('mech', 'xbelt', [ui.ST.x, panelY('mech')]);
    if (f.follow) {
      const s = f.follow.stage;
      const to = s <= 2 ? 'nozzle' : s <= 5 ? 'xmotorBack' : s === 6 ? 'xbelt' : 'nozzle';
      const from = s === 0 ? ui.lineSpot(f.follow.line) ?? [300, 300] : s === 3 ? [ui.AN.x + 250, ui.AN.y] : [ui.ST.x, ui.rowSpot(['', 'parser', 'planner', 'stepper', 'driver', 'driver', 'mech', 'mech'][s])[1]];
      const p = P2(to);
      if (inView(p) && from) callouts.push({at: p, from: s === 0 ? [303, from[1]] : from, o: 1, dash: s === 0});
    }
    ui.update({
      M,
      m,
      rate: f.rate,
      paused: f.paused,
      view: f.view,
      cut: f.cut,
      open: f.open,
      follow: f.follow,
      partInfo: f.partInfo,
      touched: f.touched,
      window: f.window,
      callouts,
      cursor: f.cursor,
      screenCanvas: st.pr.screenCanvas,
      screenDirty: dirty,
      screenKey,
    });
    return pose;
  };
}

export const beadColor = (p, c) => c.set('#3d8fe0').lerp(new THREE.Color('#d6182b'), clamp(p.v / 45));
export const WINDOW = (rate) => clamp(0.32 * rate, 0.004, 0.5);

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const M = runModel('none');
    st.pr.setBead(M.bead, beadColor);
    const ui = createConsole(document.getElementById('app'));
    const clock = makeClock(M);
    const cursorAt = makeCursor(ui, M, clock);
    const frame = makeFrame(st, ui);
    window.FX = {M, st, clock};
    return {
      resize,
      render(t) {
        const tm = clock.tmAt(t);
        const rate = clock.rateAt(t);
        const m = machineAt(M, tm);
        const [vt0, view] = viewAt(t);
        frame({
          M,
          m,
          rate,
          paused: false,
          view,
          cam: camAt(t, m),
          open: openAt(t),
          cut: cutAt(t),
          follow: followAt(t, clock),
          window: WINDOW(rate),
          cursor: cursorAt(t),
          labels: view === 'hero' || view === 'front' ? ss(vt0 + 0.9, vt0 + 1.5, t) * (1 - ss(27.95, 28.1, t) * 0) : 0,
        });
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
export {VIEWS, P};
