// Cast-resin transformer, the explorer film: the unit (unit.js) on the pale studio (stage.js) under the overlay
// (console.js). The mains run at 50 Hz × playback (1/100: half a cycle a second on screen); the windings' thermal time
// constant of 40 min plays in 3 s (×800). An operator x-rays the core to show the flux, cuts the windings in half
// through the coil axes, turns the air on to watch it rise through the ducts, then follows the operating manual's tap
// procedure: the grid rises to 10.25 kV and the LV reads high, the breaker opens, all three links move from 4-7 to
// 4-6, the unit is re-energised and the LV is back at 690 V. Then the heat map and a load drag to 1400 kVA: the
// windings warm, the PT100 controller starts the fans at 100 °C, the rating moves from AN to AF. A pure function of t.
import {runSim} from '../kit/runtime.js';
import {CUTS, createConsole, OVERLAYS, S_MAX} from './console.js';
import {airSpeed, bLimb, bPeak, CUR, designFor, G, GRID, hotSpot, PHASES, R, setDesign, stepHeat, TAP0, windRise} from './kin.js';
import {DEFAULT_ORDER} from './catalog.js';
import {createStage} from './stage.js';

export const SCRIPT = [
  {t: 0, cam: 'open'},
  {t: 3.6, cam: 'front'},
  {t: 4.6, cut: 'xray'},
  {t: 5.6, ov: 'flux'},
  {t: 9.4, cam: 'limb'},
  {t: 10.4, cut: 'section'},
  {t: 12.8, ov: 'airflow'},
  {t: 15.2, cut: 'solid'},
  {t: 15.8, cam: 'taps'},
  {t: 17.0, grid: [1, 1.025, 0.8]}, // × the rated HV voltage
  {t: 18.8, tap: 3},
  {t: 21.8, cam: 'hero'},
  {t: 22.5, ov: 'heat'},
  {t: 23.3, load: [0.6, 1.4, 1.6]}, // × the AN rating
  {t: 26.5, cam: 'side'},
  {t: 30.3, cam: 'hero'},
];
export const DURATION = 33.5;
// a tap change: the breaker opens at the click, the link moves, the breaker closes again
export const RELINK = {move: [0.35, 1.25], close: 1.55};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'cast-resin transformer', subtitle: ''}, director: {enabled: false}, watermark: ''};
export const PLAY = 100; // playback divider for the mains: 1/100
export const TAU_S = 3; // the thermal time constant on screen, s (40 min → 3 s is ×800)
export const TRACK = 1; // the film tracks phase V
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ inputs as functions of t
export const thetaAt = (t) => 40 + (R.f * 360 * t) / PLAY;
const LOAD_EV = SCRIPT.filter((e) => e.load);
export const loadAt = (t) => {
  let k = LOAD_EV[0].load[0];
  for (const e of LOAD_EV) k = e.load[0] + (e.load[1] - e.load[0]) * ss(e.t, e.t + e.load[2], t);
  return k * R.S;
};
export const tapAt = (t) => {
  let v = TAP0;
  for (const e of SCRIPT.filter((x) => x.tap !== undefined)) v += (e.tap - v) * ss(e.t + RELINK.move[0], e.t + RELINK.move[1], t);
  return v;
};
export const energisedAt = (t) => !SCRIPT.some((e) => e.tap !== undefined && t >= e.t && t < e.t + RELINK.close);
const GRID_EV = SCRIPT.filter((e) => e.grid);
export const gridAt = (t) => {
  let k = 1;
  for (const e of GRID_EV) k = e.grid[0] + (e.grid[1] - e.grid[0]) * ss(e.t, e.t + e.grid[2], t);
  return k * R.U1;
};
export const cutAt = (t) => SCRIPT.filter((e) => e.cut && e.t <= t).pop()?.cut ?? 'solid';
export const overlaysAt = (t) => {
  const o = {callouts: 1, flux: 0, airflow: 0, heat: 0, charts: 1};
  for (const e of SCRIPT) if (e.ov && e.t <= t) o[e.ov] = o[e.ov] ? 0 : 1;
  return o;
};
// the overlays fade in over 0.5 s after their click
export const ovLevel = (t, key) => {
  let on = key === 'callouts' || key === 'charts' ? 1 : 0;
  let k = on;
  for (const e of SCRIPT)
    if (e.ov === key && e.t <= t) {
      on = 1 - on;
      k = on ? ss(e.t, e.t + 0.5, t) : 1 - ss(e.t, e.t + 0.5, t);
    }
  return k;
};

// heat, fans, air and fan rotors are integrated once per design, then read by t
const DT = 1 / 120;
let TAB = null;
let TAB_KEY = '';
const tab = () => {
  if (TAB_KEY !== CUR.key) {
    TAB = integrate();
    TAB_KEY = CUR.key;
  }
  return TAB;
};
const integrate = () => {
  const n = Math.ceil((DURATION + 1) / DT) + 2;
  const hs = new Float32Array(n);
  const fan = new Float32Array(n);
  const fanOn = new Uint8Array(n);
  const air = new Float32Array(n);
  const spin = new Float32Array(n);
  const st = {hs: R.amb + windRise(loadAt(0), 0), fan: 0, fanOn: false, trip: false};
  let a = 0;
  let sp = 0;
  for (let i = 0; i < n; i++) {
    hs[i] = st.hs;
    fan[i] = st.fan;
    fanOn[i] = st.fanOn ? 1 : 0;
    air[i] = a;
    spin[i] = sp;
    stepHeat(st, energisedAt(i * DT) ? loadAt(i * DT) : 0, DT, TAU_S);
    a += airSpeed(st.hs, st.fan) * 0.3 * DT;
    sp += st.fan * 22 * DT;
  }
  return {hs, fan, fanOn, air, spin};
};
const read = (arr, t) => {
  const u = Math.max(0, Math.min(arr.length - 2, t / DT));
  const i = Math.floor(u);
  return arr[i] + (arr[i + 1] - arr[i]) * (u - i);
};
export const heatAt = (t) => {
  const T = tab();
  return {hs: read(T.hs, t), fan: read(T.fan, t), fanOn: T.fanOn[Math.min(T.fanOn.length - 1, Math.round(t / DT))] === 1, air: read(T.air, t), spin: read(T.spin, t)};
};

// ------------------------------------------------------------ views: metres and degrees, functions of u (s since on)
const mx = (k) => G.limbX[k] * 0.001;
// fixed views: the camera glides from one to the next and holds still
// the views were framed on the 1000 kVA unit; other sizes scale the distance and height with the frame
const REF = designFor(DEFAULT_ORDER).G;
const sk = () => Math.max(0.6, G.frameLen / REF.frameLen, G.floor / REF.floor);
const v = (o) => ({...o, d: o.d * sk(), ty: o.ty * sk()});
export const VIEW_FN = {
  open: () => v({tx: 0, ty: -0.06, tz: 0, az: 40, el: 16, d: 5.1, sx: 0, sy: -18}),
  hero: () => v({tx: 0, ty: -0.06, tz: 0, az: 40, el: 16, d: 5.1, sx: 0, sy: -18}),
  front: () => v({tx: 0, ty: -0.05, tz: 0, az: 5, el: 5, d: 4.8, sx: 0, sy: -18}),
  top: () => v({tx: 0, ty: 0.0, tz: 0, az: 26, el: 44, d: 4.8, sx: 0, sy: -14}),
  side: () => v({tx: 0.05, ty: -0.1, tz: 0.05, az: 58, el: 7, d: 5.0, sx: 0, sy: -20}),
  limb: (u, k) => ({...v({tx: 0, ty: -0.02, tz: 0, az: 11, el: 5, d: 2.8, sx: 0, sy: -18}), tx: mx(k)}),
  // close on the tracked coil's tapping panel
  taps: (u, k) => ({tx: mx(k), ty: 0.02, tz: (G.hv.ro + 20) * 0.001, az: -8, el: 4, d: 1.7 * Math.pow(G.hv.h / REF.hv.h, 0.6), sx: 0, sy: -30}),
};
const VIEWS = SCRIPT.filter((e) => e.cam).map((e) => [e.t, e.cam]);
export const camAt = (t, list = VIEWS, k = TRACK) => {
  let i = 0;
  while (i < list.length - 1 && list[i + 1][0] <= t) i++;
  const view = (j) => VIEW_FN[list[j][1]](t - list[j][0], k);
  const cur = view(i);
  if (i === 0) return cur;
  const kk = ss(list[i][0], list[i][0] + 1.6, t);
  if (kk >= 1) return cur;
  return blend(view(i - 1), cur, kk);
};
export function blend(a, b, k) {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : a[key] + (b[key] - a[key]) * k;
  const swing = Math.min(1, Math.abs(((b.az - a.az + 540) % 360) - 180) / 90 + Math.abs(b.el - a.el) / 90);
  o.d += Math.max(0, Math.max(a.d, b.d) + 0.8 * swing - o.d) * Math.sin(Math.PI * k);
  return o;
}
export const camName = (t) => {
  const v = VIEWS.filter(([t0]) => t0 <= t).pop()[1];
  return v === 'open' ? 'hero' : v;
};
export const viewStart = (t) => VIEWS.filter(([t0]) => t0 <= t).pop()[0];

// ------------------------------------------------------------ the operator's pointer
export const gridK = (U) => (U - GRID[0]) / (GRID[1] - GRID[0]);
const REST = [[820, 470], [700, 430], [900, 520], [760, 380]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0).map((e) => {
    if (e.load) return {t: e.t, spot: ui.loadKnob(e.load[0] / 1.5), to: ui.loadKnob(e.load[1] / 1.5), drag: e.load[2], knob: (tt) => ui.loadKnob(loadAt(tt) / R.S_AF)};
    if (e.tap !== undefined) return {t: e.t, spot: ui.tapSpot(e.tap), drag: 0};
    if (e.grid) return {t: e.t, spot: ui.gridKnob((e.grid[0] - 0.95) / 0.1), to: ui.gridKnob((e.grid[1] - 0.95) / 0.1), drag: e.grid[2], knob: (tt) => ui.gridKnob(gridK(gridAt(tt)))};
    if (e.cut) return {t: e.t, spot: ui.spots[e.cut], drag: 0};
    if (e.ov) return {t: e.t, spot: ui.spots[e.ov], drag: 0};
    return {t: e.t, spot: ui.spots[e.cam], drag: 0};
  });
  const WP = [[0, 980, 640]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.16, ...e.spot]);
    if (e.drag) {
      for (let k = 0; k <= 12; k++) {
        const tt = e.t + (k / 12) * e.drag;
        WP.push([tt + 0.02, ...e.knob(tt)]);
      }
      WP.push([e.t + e.drag + 0.3, ...e.to]);
    } else WP.push([e.t + 0.24, ...e.spot]);
    // the next click is close: stay near the panel instead of drifting to the middle
    const next = EV[i + 1];
    if (!next || next.t - (e.t + e.drag) > 1.9) WP.push([e.t + e.drag + 1.6, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const lin = t1 - t0 < 0.2;
    const k = lin ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : ss(t0, t1, t);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const bow = lin ? 0 : Math.sin(Math.PI * k) * Math.min(24, len * 0.07);
    let press = false;
    let ring = 0;
    let rx = 0;
    let ry = 0;
    for (const e of EV) {
      if (t >= e.t - 0.07 && t < e.t + Math.max(0.09, e.drag + 0.1)) press = true;
      if (t >= e.t && t < e.t + 0.55) {
        ring = 1 - (t - e.t) / 0.55;
        [rx, ry] = e.spot;
      }
    }
    return {x: x0 + (x1 - x0) * k + (len ? (-(y1 - y0) / len) * bow : 0), y: y0 + (y1 - y0) * k + (len ? ((x1 - x0) / len) * bow : 0), press, ring, ringX: rx, ringY: ry};
  };
}

// ------------------------------------------------------------ callouts per view
const CALL = {
  hero: [
    {a: 'hv', name: 'Cast-resin HV winding', sub: () => `${R.N1} TURNS · ${R.discs} DISCS`, l: [1168, 318], w: 140},
    {a: 'tap', name: 'Tap links', sub: 'OFF-CIRCUIT · ALL 3 PHASES', l: [440, 420], w: -140, hide: 'section'},
    {a: 'fan', name: 'Cross-flow fans', sub: 'AN → AF · +50 %', l: [1168, 690], w: 120},
    {a: 'lvBar', name: 'LV busbars', sub: '2U 2V 2W · 2N', l: [1190, 160], w: 100},
  ],
  front: [
    {a: 'delta', name: 'Delta tubes', sub: 'UPPER U-V-W · LOWER V-W-U', l: [440, 520], w: -150, hide: 'section'},
    {a: 'ptc', name: 'PT100 sensors', sub: 'IN ALL THREE WINDINGS', l: [1180, 150], w: 130},
    {a: 'earth', name: 'Earth terminal', sub: 'LOWER CLAMPING', l: [440, 680], w: -120, hide: 'section'},
    {a: 'plate', name: 'Rating plate', sub: () => `${R.mass} KG · IEC 60076-11`, l: [440, 160], w: -126},
  ],
  limb: [
    {a: 'lvFaceL', name: 'LV foil winding', sub: () => `${R.N2} TURNS · ${G.lv.t.toFixed(1)} MM FOIL`, l: [470, 200], w: -130, cut: 'section'},
    {a: 'ductFace', name: 'Cooling duct', sub: '30 MM · AIR RISES', l: [1150, 200], w: 118, cut: 'section'},
    {a: 'hvFace', name: 'HV disc winding', sub: () => `${R.discs} DISCS CAST IN RESIN`, l: [1150, 470], w: 136, cut: 'section'},
    {a: 'coreFront', name: 'Stepped core', sub: () => `${Math.round(G.rc * 2)} MM · 7 STEPS · ${R.Bpk.toFixed(2)} T`, l: [470, 620], w: -140},
  ],
  taps: [
    {a: 'tapPanel', name: 'Tap link', sub: 'STUDS 3 4 5 OVER 8 7 6', l: [1110, 560], w: 140},
    {a: 'hvLead', name: 'HV cable', sub: () => `CLEARANCE ≥ ${R.clearance} MM · Um ${R.um} kV`, l: [1110, 170], w: 150},
  ],
  top: [
    {a: 'ductTop', name: 'Axial ducts', sub: 'THREE PER LIMB', l: [1170, 250], w: 110},
    {a: 'neutral', name: 'Star point 2N', sub: 'LV NEUTRAL BAR', l: [1170, 130], w: 110},
  ],
  side: [
    {a: 'fan', name: 'Cross-flow fans', sub: 'SWITCHED BY THE PT100', l: [440, 640], w: -130},
    {a: 'pad', name: 'Rubber pads', sub: 'CLAMP · DAMP NOISE', l: [1150, 210], w: 120},
  ],
};

// ------------------------------------------------------------ the overlay's data for a frame
export function makeConsoleFrame(ui, st) {
  const at = (a, k) => {
    const A = st.unit.A;
    return typeof A[a] === 'function' ? A[a](k) : A[a];
  };
  // live: the page's own state (overlays, cut, playback, pause); absent in the film
  return (t, {th, cam, k, S, tap, heat, cut, ov, cursor, since, live, Ug = R.U1, energised = true, relink = false}) => {
    const vis = ss(1.1, 1.8, since) * (ov.callouts ? 1 : 0) * (live && live.freeCam ? 0 : 1);
    const callouts = [];
    for (const c0 of CALL[cam] || []) {
      const c = {...c0, sub: typeof c0.sub === 'function' ? c0.sub() : c0.sub};
      if ((c.cut && c.cut !== cut) || c.hide === cut) continue;
      const p = st.project(at(c.a, k));
      // a point under a panel or off the free middle of the screen gets no leader at all
      if (!p || p[0] < 300 || p[0] > 1300 || p[1] < 60 || p[1] > 780) continue;
      // keep the label clear of the side panels: estimate its width from the text (11.5 px name, 8.6 px caps sub)
      const tw = Math.max(c.name.length * 6.6, c.sub.length * 6.4) + 14;
      const ly = c.l[1];
      const lx = c.w < 0 ? Math.max(c.l[0], 296 + tw) : Math.min(c.l[0], 1306 - tw);
      callouts.push({name: c.name, sub: c.sub, at: p, label: [lx, ly], w: c.w, o: vis});
    }
    ui.update({
      S,
      th,
      k,
      tap,
      hs: heat.hs,
      fan: heat.fan,
      fanOn: heat.fanOn,
      trip: live ? live.trip : false,
      energised: live ? live.energised : energised,
      relink: live ? live.relink : relink,
      Ug,
      cam,
      cut,
      overlays: ov,
      callouts,
      cursor,
      playText: live ? live.playText : '1 / 100 SPEED',
      playK: live ? live.playK : 0.5,
      paused: live ? live.paused : false,
    });
  };
}
void CUTS;
void OVERLAYS;

/** the unit's pose for a frame: shared by the film and the live page */
export const unitState = ({th, tap, heat, cut, ovl, energised = true, Ug = R.U1}) => {
  const on = energised ? 1 : 0;
  const ti = Math.round(tap);
  return {
    B: [0, 1, 2].map((i) => bLimb(th, i, ti, Ug) * on),
    bpk: bPeak(TAP0),
    flux: ovl.flux * on,
    fluxT: th / 360,
    cut,
    heat: ovl.heat > 0.5 ? 1 : 0,
    hs: hotSpot(heat.hs), // the heat map's top is the hot spot
    air: ovl.airflow,
    airPhase: heat.air,
    airHot: Math.min(1, Math.max(0.15, (heat.hs - R.amb) / 110)),
    fanSpin: heat.spin,
    tap,
    ptcLit: Math.min(1, Math.max(0, (heat.hs - R.tc.fanOn + 15) / 15)) * 0.8,
  };
};

export function makeFilm() {
  return async ({canvas, capture}) => {
    // the unit: ?config {design, group} from the capture, or the page's #order-no[-dyn11]
    const pick = parseDesign(window.__SIM_CONFIG?.design ? `${window.__SIM_CONFIG.design}-${window.__SIM_CONFIG.group ?? 'dyn5'}` : location.hash);
    setDesign(designFor(pick.order, pick.group));
    const st = createStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    window.CR = st;
    return {
      resize,
      render(t) {
        const th = thetaAt(t);
        const cam = camName(t);
        const c = camAt(t);
        const heat = heatAt(t);
        const cut = cutAt(t);
        const ov = overlaysAt(t);
        const ovl = Object.fromEntries(Object.keys(ov).map((key) => [key, ovLevel(t, key)]));
        const tap = tapAt(t);
        const energised = energisedAt(t);
        const S = energised ? loadAt(t) : 0;
        const Ug = gridAt(t);
        const relink = SCRIPT.some((e) => e.tap !== undefined && t >= e.t && t < e.t + RELINK.close);
        st.frame(unitState({th, tap, heat, cut, ovl, energised, Ug}), {...c, az: c.az * D2R, el: c.el * D2R});
        frame(t, {th, cam, k: TRACK, S, tap, heat, cut, ov, cursor: cursorAt(t), since: t - viewStart(t), Ug, energised, relink});
        return {};
      },
    };
  };
}
void PHASES;

/** '#4GB6044-3DY05-0AA0-dyn11' → {order, group}; anything unknown falls back to the default unit, Dyn5 */
export function parseDesign(h = '') {
  const m = /(4GB[0-9A-Z]{4}-[0-9A-Z]{5}-[0-9A-Z]{4})(?:-(dyn5|dyn11))?/i.exec(h);
  return {order: m ? m[1].toUpperCase() : DEFAULT_ORDER, group: m && /11/.test(m[2] ?? '') ? 'Dyn11' : 'Dyn5'};
}
export const designHash = () => `${R.order}${R.group === 'Dyn11' ? '-dyn11' : ''}`;

export const run = () => runSim(DEFAULTS, makeFilm());
