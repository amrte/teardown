// The 8DB10-type GIS panel film: the panel (panel.js) in the studio (stage.js) under the console (console.js). The
// operator walks the panel (hero, labels, the side section matching the catalog drawing, the nine gas compartments),
// transfers the feeder from busbar 1 to busbar 2 with the disconnectors in x-ray, puts a 40 kA fault on the cable and
// watches the breaker clear it and auto-reclose from inside the interrupter, then earths the feeder. A pure function
// of t: the procedure clock comes from program.js, tabulated at load.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {createConsole, DISPLAY} from './console.js';
import {G, rateAt, stateAt} from './gis.js';
import {DURATION, EVENTS, FF, progAt, SCRIPT, stepOf, tauAt, WINDOWS} from './program.js';
import {createGisStage} from './stage.js';

export {DURATION, SCRIPT};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: '8db10', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
// display modes that start on
export const DISPLAY_ON = {ghost: 1};

// ------------------------------------------------------------ display toggles at film time t
export const displayAt = (t) => {
  const out = Object.fromEntries(DISPLAY.map((k) => [k, DISPLAY_ON[k] ?? 0]));
  for (const e of SCRIPT) if (e.display && e.t <= t) out[e.display] = out[e.display] ? 0 : 1;
  return out;
};
const lastFlip = (key, t) => SCRIPT.filter((e) => e.display === key && e.t <= t).pop()?.t ?? -9;
export const easedDisplay = (key, t, dur = 0.7) => {
  const on = displayAt(t)[key];
  const k = ss(lastFlip(key, t), lastFlip(key, t) + dur, t);
  return on ? k : 1 - k;
};

// ------------------------------------------------------------ views; u = seconds on the view
export const VIEW_FN = {
  hero: (u) => ({tx: 0.05, ty: 1.12, tz: 0.08, az: 50 + 1.4 * u, el: 12, d: 9.9, sx: 0, sy: -34}),
  front: (u) => ({tx: 0, ty: 1.2, tz: 1.3, az: 12 + 0.6 * u, el: 4, d: 6.0, sx: 0, sy: -30}),
  side: (u) => ({tx: 0, ty: 1.17, tz: -0.05, az: 90 + 0.3 * u, el: 3, d: 9.7, sx: 0, sy: -34}),
  disc: (u) => ({tx: 0, ty: 1.58, tz: 0.36, az: 78 + 0.6 * u, el: 7, d: 4.6, sx: 0, sy: -30}),
  cb: (u) => ({tx: 0, ty: 1.04, tz: 0.7, az: 76 + 0.4 * u, el: 6, d: 2.5, sx: 0, sy: -30}),
  cable: (u) => ({tx: 0, ty: 0.5, tz: 0.3, az: 62 + 1 * u, el: 8, d: 3.6, sx: 0, sy: -30}),
  busbar: (u) => ({tx: -0.2, ty: 1.85, tz: 0.0, az: 35 + 1 * u, el: 26, d: 5.4, sx: 0, sy: -30}),
};
const VIEWS = SCRIPT.filter((e) => e.view).map((e) => [e.t, e.view]);
const blend = (a, b, k) => {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : a[key] + (b[key] - a[key]) * k;
  const swing = Math.min(1, Math.abs(((b.az - a.az + 540) % 360) - 180) / 90);
  o.d += Math.max(0, Math.max(a.d, b.d) + 0.8 * swing - o.d) * Math.sin(Math.PI * k);
  return o;
};
export const camAt = (t, orbit = 0) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[VIEWS[i][1]](t - VIEWS[i][0]);
  let o = cur;
  if (i > 0) {
    const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.6, t);
    if (k < 1) o = blend(VIEW_FN[VIEWS[i - 1][1]](t - VIEWS[i - 1][0]), cur, k);
  }
  if (orbit > 0) o = {...o, az: o.az + 12 * Math.max(0, t - lastFlip('orbit', t)) * orbit};
  return o;
};
export const viewAt = (t) => VIEWS.filter(([a]) => a <= t).pop();

// ------------------------------------------------------------ the operator's pointer
const REST = [[860, 470], [760, 420], [940, 520], [820, 380]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0).flatMap((e) => {
    const out = [];
    if (e.prog) out.push({t: e.t, spot: ui.spots[e.prog]});
    if (e.view) out.push({t: e.t, spot: ui.spots[e.view]});
    if (e.display) out.push({t: e.t, spot: ui.spots[e.display]});
    return out;
  });
  const WP = [[0, 900, 600]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.16, ...e.spot], [e.t + 0.22, ...e.spot]);
    WP.push([e.t + 1.4, ...REST[i % REST.length]]);
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

// ------------------------------------------------------------ the labels: parts of the panel, front pole L1 mostly
const V3 = THREE.Vector3;
const [Z1, Z2] = G.poleZ;
const PARTS = [
  {name: 'BUSBAR SYSTEM 1', sub: 'COPPER IN SF6 · 5000 A', at: () => new V3(0.31, G.yBB, Z1)},
  {name: 'BUSBAR SYSTEM 2', sub: 'ITS OWN HOUSING, 360 MM BEHIND', at: () => new V3(0.31, G.yBB, G.bb2Z[0])},
  {name: 'GAS-TIGHT BUSHING', sub: 'SEPARATES THE COMPARTMENTS', at: () => new V3(0.15, G.yBush1, Z2)},
  {name: 'THREE-POSITION DISCONNECTOR', sub: 'CLOSED · OPEN · READY-TO-EARTH', at: () => new V3(0.17, G.yDisc, Z1)},
  {name: 'DISCONNECTOR, BUSBAR 2', sub: 'NO-LOAD SWITCHING ONLY', at: () => new V3(0.135, 1.5, G.bb2Z[0] + 0.02)},
  {name: 'VACUUM CIRCUIT-BREAKER', sub: '40 kA · INTERRUPTER IN SF6', at: () => new V3(0.2, G.cbY, Z2)},
  {name: 'CURRENT TRANSFORMER', sub: 'RING CORE, OUTSIDE THE GAS', at: () => new V3(0.138, 0.51, Z1)},
  {name: 'CABLE CONNECTION', sub: 'INSIDE CONE · EN 50181', at: () => new V3(0.1, 0.27, Z1)},
  {name: 'OPERATING MECHANISM', sub: 'STORED-ENERGY SPRING', at: () => new V3(0.3, 1.0, 1.13)},
  {name: 'LOW-VOLTAGE COMPARTMENT', sub: 'PROTECTION AND CONTROL', at: () => new V3(0.3, 1.95, 1.13)},
];
export function makeLabels(st) {
  return (o) => {
    if (o < 0.02) return [];
    const pts = PARTS.map((p) => ({p, at: st.project(...p.at().toArray())})).filter((x) => x.at && x.at[0] > 330 && x.at[0] < 1270 && x.at[1] > 130 && x.at[1] < 745);
    const L = pts.filter((x) => x.at[0] < 800).sort((a, b) => a.at[1] - b.at[1]);
    const R = pts.filter((x) => x.at[0] >= 800).sort((a, b) => a.at[1] - b.at[1]);
    const out = [];
    const stack = (col, x, w) => {
      let y = 140;
      for (const c of col) {
        y = Math.max(y, Math.min(710, c.at[1] - 10));
        out.push({name: c.p.name, sub: c.p.sub, at: c.at, label: [x, y], w, o});
        y += 34;
      }
    };
    stack(L, 332, 200);
    stack(R, 1100, 170);
    return out;
  };
}

/** the console frame: everything the console draws, from the state and the operator's choices */
export function makeConsoleFrame(ui, st) {
  const labels = makeLabels(st);
  return (u) => {
    ui.update({...u, step: stepOf(u.s), callouts: labels(u.labels)});
  };
}

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createGisStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    const progs = SCRIPT.filter((e) => e.prog);
    window.GIS = st;
    return {
      resize,
      render(t) {
        const tau = tauAt(t);
        const s = stateAt(EVENTS, tau);
        const disp = displayAt(t);
        const o = {xray: easedDisplay('xray', t), gas: easedDisplay('gas', t), section: !!disp.section, ghost: easedDisplay('ghost', t), ambient: 20};
        const cam = camAt(t, disp.orbit);
        st.frame(s, o, {...cam, az: cam.az * D2R, el: cam.el * D2R});
        const [vt0, view] = viewAt(t);
        const p = progs.filter((e) => e.t <= t).pop();
        const disc = s.q1.pos === 'moving' || s.q2.pos === 'moving';
        frame({s, events: EVENTS, prog: progAt(t), progEvents: p?.events ?? [], rate: rateAt(WINDOWS, tau, s.springBusy ? FF : 1, disc), view, display: disp, labels: easedDisplay('labels', t, 0.5) * ss(vt0 + 1.1, vt0 + 1.7, t), cursor: cursorAt(t), paused: false, refusal: '', gas: o.gas, ambient: 20});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
