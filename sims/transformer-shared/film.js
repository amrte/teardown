// Cast-resin transformer, the explorer film: the unit (unit.js) on the pale studio (stage.js) under the overlay
// (console.js). The mains run at 50 Hz × playback (1/100: half a cycle a second on screen); the windings' thermal time
// constant of 40 min plays in 3 s (×800). An operator x-rays the core to show the flux, cuts the windings in half
// through the coil axes, turns the air on to watch it rise through the ducts, relinks the HV tap, turns on the heat map
// and drags the load to 1400 kVA: the hot spot climbs, the PTC starts the fans at 120 °C, the rating moves from AN to
// AF. A pure function of t.
import {runSim} from '../kit/runtime.js';
import {CUTS, createConsole, OVERLAYS, S_MAX} from './console.js';
import {airSpeed, bLimb, bPeak, G, hotRise, PHASES, R, stepHeat} from './kin.js';
import {createStage} from './stage.js';

export const SCRIPT = [
  {t: 0, cam: 'open'},
  {t: 3.6, cam: 'front'},
  {t: 4.6, cut: 'xray'},
  {t: 5.6, ov: 'flux'},
  {t: 9.4, cam: 'limb'},
  {t: 10.4, cut: 'section'},
  {t: 12.8, ov: 'airflow'},
  {t: 15.2, tap: 3},
  {t: 17.6, cam: 'hero'},
  {t: 18.3, cut: 'solid'},
  {t: 19.0, ov: 'heat'},
  {t: 19.8, load: [600e3, 1400e3, 1.6]},
  {t: 23.0, cam: 'side'},
  {t: 26.8, cam: 'hero'},
];
export const DURATION = 30;
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
  let S = LOAD_EV[0].load[0];
  for (const e of LOAD_EV) S = e.load[0] + (e.load[1] - e.load[0]) * ss(e.t, e.t + e.load[2], t);
  return S;
};
export const tapAt = (t) => {
  let v = 2;
  for (const e of SCRIPT.filter((x) => x.tap !== undefined)) v += (e.tap - v) * ss(e.t + 0.1, e.t + 0.7, t);
  return v;
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

// heat, fans, air and fan rotors are integrated once at load, then read by t
const DT = 1 / 120;
const TAB = (() => {
  const n = Math.ceil((DURATION + 1) / DT) + 2;
  const hs = new Float32Array(n);
  const fan = new Float32Array(n);
  const fanOn = new Uint8Array(n);
  const air = new Float32Array(n);
  const spin = new Float32Array(n);
  const st = {hs: R.amb + hotRise(loadAt(0), 0), fan: 0, fanOn: false, trip: false};
  let a = 0;
  let sp = 0;
  for (let i = 0; i < n; i++) {
    hs[i] = st.hs;
    fan[i] = st.fan;
    fanOn[i] = st.fanOn ? 1 : 0;
    air[i] = a;
    spin[i] = sp;
    stepHeat(st, loadAt(i * DT), DT, TAU_S);
    a += airSpeed(st.hs, st.fan) * 0.3 * DT;
    sp += st.fan * 22 * DT;
  }
  return {hs, fan, fanOn, air, spin};
})();
const read = (arr, t) => {
  const u = Math.max(0, Math.min(arr.length - 2, t / DT));
  const i = Math.floor(u);
  return arr[i] + (arr[i + 1] - arr[i]) * (u - i);
};
export const heatAt = (t) => ({hs: read(TAB.hs, t), fan: read(TAB.fan, t), fanOn: TAB.fanOn[Math.min(TAB.fanOn.length - 1, Math.round(t / DT))] === 1, air: read(TAB.air, t), spin: read(TAB.spin, t)});

// ------------------------------------------------------------ views: metres and degrees, functions of u (s since on)
const mx = (k) => G.limbX[k] * 0.001;
export const VIEW_FN = {
  open: (u) => {
    const k = smoother(u / 4.1);
    return {tx: 0, ty: -0.06, tz: 0, az: 8 + 30 * k, el: 10 + 6 * k, d: 5.9 - 0.8 * k, sx: 0, sy: -18};
  },
  hero: (u) => ({tx: 0, ty: -0.06, tz: 0, az: 38 + 2.5 * u, el: 16, d: 5.1, sx: 0, sy: -18}),
  front: (u) => ({tx: 0, ty: -0.05, tz: 0, az: 3 + 1.6 * u, el: 5, d: 4.8, sx: 0, sy: -18}),
  top: (u) => ({tx: 0, ty: 0.0, tz: 0, az: 24 + 2.5 * u, el: 44, d: 4.8, sx: 0, sy: -14}),
  side: (u) => ({tx: 0.05, ty: -0.1, tz: 0.05, az: 60 - 2 * u, el: 7, d: 5.0, sx: 0, sy: -20}),
  limb: (u, k) => ({tx: mx(k), ty: -0.02, tz: 0, az: 9 + 1.6 * u, el: 5, d: 2.8, sx: 0, sy: -18}),
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
const REST = [[820, 470], [700, 430], [900, 520], [760, 380]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0).map((e) => {
    if (e.load) return {t: e.t, spot: ui.loadKnob(e.load[0] / S_MAX), to: ui.loadKnob(e.load[1] / S_MAX), drag: e.load[2], from: e.load[0], dest: e.load[1]};
    if (e.tap !== undefined) return {t: e.t, spot: ui.tapSpot(e.tap), drag: 0};
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
        WP.push([tt + 0.02, ...ui.loadKnob(loadAt(tt) / S_MAX)]);
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
    {a: 'hv', name: 'Cast-resin HV winding', sub: `${R.N1} TURNS · ${R.discs} DISCS`, l: [1168, 318], w: 140},
    {a: 'tap', name: 'Tapping links', sub: '±2 × 2.5 % · OFF-LOAD', l: [440, 420], w: -128, hide: 'section'},
    {a: 'fan', name: 'Cross-flow fans', sub: 'AN → AF · +50 %', l: [1168, 690], w: 120},
    {a: 'lvBar', name: 'LV busbars', sub: '2U 2V 2W · 2N', l: [1190, 160], w: 100},
  ],
  front: [
    {a: 'delta', name: 'Delta connection', sub: 'CROSSED COPPER RODS', l: [440, 520], w: -132, hide: 'section'},
    {a: 'ptc', name: 'PTC relay box', sub: 'FANS · ALARM · TRIP', l: [1180, 150], w: 118},
    {a: 'plate', name: 'Rating plate', sub: `${R.mass} KG · IEC 60076-11`, l: [440, 160], w: -126},
  ],
  limb: [
    {a: 'lvFaceL', name: 'LV foil winding', sub: `${R.N2} TURNS · 2 LAYERS`, l: [470, 200], w: -130, cut: 'section'},
    {a: 'ductFace', name: 'Cooling duct', sub: '30 MM · AIR RISES', l: [1150, 200], w: 118, cut: 'section'},
    {a: 'hvFace', name: 'HV disc winding', sub: `${R.discs} DISCS CAST IN RESIN`, l: [1150, 470], w: 136, cut: 'section'},
    {a: 'coreFront', name: 'Stepped core', sub: `${Math.round(G.rc * 2)} MM · 7 STEPS · 1.6 T`, l: [470, 620], w: -140},
  ],
  top: [
    {a: 'ductTop', name: 'Axial ducts', sub: 'THREE PER LIMB', l: [1170, 250], w: 110},
    {a: 'neutral', name: 'Star point 2N', sub: 'LV NEUTRAL BAR', l: [1170, 130], w: 110},
  ],
  side: [
    {a: 'fan', name: 'Cross-flow fans', sub: 'SWITCHED BY THE PTC', l: [440, 640], w: -130},
    {a: 'pad', name: 'Rubber pads', sub: 'CLAMP · DAMP NOISE', l: [1150, 210], w: 120},
  ],
};

// ------------------------------------------------------------ the overlay's data for a frame
export function makeConsoleFrame(ui, st) {
  const A = st.unit.A;
  const at = (a, k) => (typeof A[a] === 'function' ? A[a](k) : A[a]);
  // live: the page's own state (overlays, cut, playback, pause); absent in the film
  return (t, {th, cam, k, S, tap, heat, cut, ov, cursor, since, live}) => {
    const vis = ss(1.1, 1.8, since) * (ov.callouts ? 1 : 0);
    const callouts = [];
    for (const c of CALL[cam] || []) {
      if ((c.cut && c.cut !== cut) || c.hide === cut) continue;
      const p = st.project(at(c.a, k));
      if (!p) continue;
      const [lx, ly] = c.l;
      callouts.push({name: c.name, sub: c.sub, at: p, label: [lx, ly], w: c.w, o: vis});
    }
    // the phase panel's leader into the tracked coil
    callouts.push({name: '', sub: '', at: st.project(cut === 'section' ? A.ductFace(k) : A.coilFront(k)), label: [1318 - 0.01, 124], w: 0, o: 0.85 * (ov.callouts ? 1 : 0)});
    ui.update({
      S,
      th,
      k,
      tap,
      hs: heat.hs,
      fan: heat.fan,
      fanOn: heat.fanOn,
      trip: live ? live.trip : false,
      energised: live ? live.energised : true,
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
export const unitState = ({th, tap, heat, cut, ovl, energised = true}) => {
  const on = energised ? 1 : 0;
  const ti = Math.round(tap);
  return {
    B: [0, 1, 2].map((i) => bLimb(th, i, ti) * on),
    bpk: bPeak(ti),
    flux: ovl.flux * on,
    fluxT: th / 360,
    cut,
    heat: ovl.heat > 0.5 ? 1 : 0,
    hs: heat.hs,
    air: ovl.airflow,
    airPhase: heat.air,
    airHot: Math.min(1, Math.max(0.15, (heat.hs - R.amb) / 110)),
    fanSpin: heat.spin,
    tap,
    ptcLit: Math.min(1, Math.max(0, (heat.hs - R.ptc.fan + 15) / 15)) * 0.8,
  };
};

export function makeFilm() {
  return async ({canvas, capture}) => {
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
        const S = loadAt(t);
        st.frame(unitState({th, tap, heat, cut, ovl}), {...c, az: c.az * D2R, el: c.el * D2R});
        frame(t, {th, cam, k: TRACK, S, tap, heat, cut, ov, cursor: cursorAt(t), since: t - viewStart(t)});
        return {};
      },
    };
  };
}
void PHASES;

export const run = () => runSim(DEFAULTS, makeFilm());
