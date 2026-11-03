// Oil Transformer · the explorer film: the transformer (trafo3d.js) on the pale studio (stage.js) under the overlay
// (console.js). Two clocks run off the film's time: the electrical angle at 1/150 of 50 Hz (one period every 3 s) and
// the thermal state in time-lapse (1 s = 6 min). An operator opens the tank to glass, goes inside, isolates the core
// and its flux, cuts a section through the windings, drives the load from 50 to 130 % and watches the oil heat and
// circulate, reads the lid with the manual's part numbers, reconfigures the unit to hermetic and low-radiation, and
// lifts the active part out of the tank. A pure function of t.
import {runSim} from '../kit/runtime.js';
import {coordination, FAULTS, protInit, protReset, protStep} from './protect.js';
import {createConsole, LOAD_MAX} from './console.js';
import {createTrafoStage} from './stage.js';
import {
  ageing, continuousLoad, defaultConfig, efficiency, electrical, EXTRA_PARTS, expansion, losses, lvVoltage, oltcPosition,
  OPTIONS, optText, parallel, PARTS, regulation, resolve, seismic, spec, steady, thermalStep, ultimate,
} from './trafo.js';

export const DURATION = 48;
export const SCRIPT = [
  {t: 0, cam: 'open'},
  {t: 3.2, cut: 'glass'},
  {t: 6.0, cam: 'inside'},
  {t: 8.6, view: 'core'},
  {t: 11.4, cut: 'section'},
  {t: 13.8, view: 'windings'},
  {t: 16.4, view: 'all'},
  {t: 17.6, load: [0.5, 1.3, 1.6]},
  {t: 20.8, cut: 'glass'},
  {t: 23.0, cam: 'lid'},
  {t: 25.2, overlay: 'parts'},
  {t: 28.6, tab: 'configure'},
  {t: 30.2, cfg: ['design', 'hermetic']},
  {t: 32.2, cfg: ['core', 'lowrad']},
  {t: 34.2, cfg: ['monitor', 'full']},
  {t: 36.0, tab: 'protect'},
  {t: 37.6, fault: 'arc'},
  {t: 40.6, fault: 'reset'},
  {t: 42.4, overlay: 'untank'},
  {t: 45.0, cam: 'hero'},
];
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'transformer', subtitle: ''}, director: {enabled: false}, watermark: ''};
export const DEG_PER_S = 120; // electrical degrees per film second: 50 Hz at 1/150
export const THERMAL_MIN_PER_S = 6; // thermal minutes per film second
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ------------------------------------------------------------------------------------------------ the film's state
const LOAD_EV = SCRIPT.find((e) => e.load);
export const loadAt = (t) => LOAD_EV.load[0] + (LOAD_EV.load[1] - LOAD_EV.load[0]) * ss(LOAD_EV.t, LOAD_EV.t + LOAD_EV.load[2], t);
const lastOf = (key, t, def) => SCRIPT.filter((e) => e[key] !== undefined && e.t <= t).pop()?.[key] ?? def;
export const cutAt = (t) => lastOf('cut', t, 'solid');
export const viewAt = (t) => lastOf('view', t, 'all');
export const tabAt = (t) => lastOf('tab', t, 'operate');
export const overlaysAt = (t) => {
  const on = {parts: 0, flux: 1, current: 1, flow: 1, untank: 0};
  for (const e of SCRIPT) if (e.overlay && e.t <= t) on[e.overlay] = 1;
  return on;
};
export const cfgAt = (t) => {
  let c = defaultConfig();
  for (const e of SCRIPT) if (e.cfg && e.t <= t) c = resolve({...c, [e.cfg[0]]: e.cfg[1]}, e.cfg[0]).cfg;
  return c;
};
export const explodeAt = (t) => {
  const e = SCRIPT.find((x) => x.overlay === 'untank');
  return e ? ss(e.t + 0.2, e.t + 2.4, t) : 0;
};

// the thermal history, integrated once at load: steady at 50 % before the film, a minute per step; `onAt` says when
// the unit is energised (a trip takes the load and the losses away)
const buildThermal = (onAt) => {
  const sp = spec(defaultConfig());
  const ta = 20;
  const u = ultimate(sp, 0.5);
  let st = {oil: u.oil, hs: u.hs, max: ta + u.oil};
  const rows = [];
  const pre = 360;
  for (let m = -pre; m <= DURATION * THERMAL_MIN_PER_S + 1; m++) {
    const t = m / THERMAL_MIN_PER_S;
    const on = t < 0 || onAt(t);
    const K = t < 0 ? 0.5 : on ? loadAt(t) : 0;
    st = thermalStep(sp, st, K, ta, 1, 1, on);
    rows.push({m, oil: st.oil, hs: st.hs, top: st.top, hot: st.hot, max: st.max, ta});
  }
  return {rows, pre};
};
let TH_TAB = buildThermal(() => true);
// the protection devices, stepped once at load on the film's thermal state and its faults (1/30 s steps)
const PROT_DT = 1 / 30;
const buildProt = () => {
  const out = [];
  let key = '';
  let sp = null;
  let st = null;
  for (let i = 0; i * PROT_DT <= DURATION + 0.5; i++) {
    const t = i * PROT_DT;
    const cfg = cfgAt(t);
    const k = JSON.stringify(cfg);
    if (k !== key) {
      key = k;
      sp = spec(cfg);
      st = st ? {...st} : protInit(sp);
    }
    const crossed = (name) => SCRIPT.some((e) => e.fault === name && e.t > t - PROT_DT && e.t <= t);
    if (crossed('reset')) st = protReset(sp, st);
    st = protStep(sp, st, {top: thermalAt(t).top, energised: true, faults: {}, arc: crossed('arc'), lvshort: crossed('lvshort'), simMin: t * THERMAL_MIN_PER_S}, PROT_DT * THERMAL_MIN_PER_S, PROT_DT);
    out.push(st);
  }
  return out;
};
export const thermalAt = (t) => {
  const m = t * THERMAL_MIN_PER_S;
  const u = clamp(m + TH_TAB.pre, 0, TH_TAB.rows.length - 2);
  const i = Math.floor(u);
  const a = TH_TAB.rows[i];
  const b = TH_TAB.rows[i + 1];
  const k = u - i;
  const o = {};
  for (const key of ['oil', 'hs', 'top', 'hot', 'max']) o[key] = a[key] + (b[key] - a[key]) * k;
  return o;
};
let PROT = null;
PROT = buildProt();
export const protAt = (t) => PROT[clamp(Math.round(t / PROT_DT), 0, PROT.length - 1)];
export const energisedAt = (t) => protAt(t).energised !== false;
TH_TAB = buildThermal(energisedAt);
PROT = buildProt();
export const effLoadAt = (t) => (energisedAt(t) ? loadAt(t) : 0);
const historyAt = (t) => {
  const m = t * THERMAL_MIN_PER_S;
  const out = [];
  for (let ago = 360; ago >= 0; ago -= 6) {
    const r = TH_TAB.rows[clamp(Math.round(m - ago + TH_TAB.pre), 0, TH_TAB.rows.length - 1)];
    out.push({ago, top: r.top, hot: r.hot, ta: r.ta});
  }
  return out;
};
// the convection's phase: integrated once at load, its rate by the losses
const FLOW_TAB = (() => {
  const sp = spec(defaultConfig());
  const out = [0];
  let ph = 0;
  const dt = 1 / 120;
  for (let t = 0; t <= DURATION + 1; t += dt) {
    ph += (energisedAt(t) ? flowRate(sp, loadAt(t)) : flowRate(sp, 0) * 0.3) * dt;
    out.push(ph);
  }
  return out;
})();
export function flowRate(sp, K) {
  return 0.045 * Math.sqrt(losses(sp, K).tot / (sp.p0 + sp.pk));
}
const flowAt = (t) => {
  const u = clamp(t * 120, 0, FLOW_TAB.length - 2);
  const i = Math.floor(u);
  return FLOW_TAB[i] + (FLOW_TAB[i + 1] - FLOW_TAB[i]) * (u - i);
};

// ------------------------------------------------------------------------------------------------ views
// every view is a function of u (seconds since it came on) and the unit's size; H the overall height (m)
const VIEWS = SCRIPT.filter((e) => e.cam).map((e) => [e.t, e.cam]);
// a slow sway with the given starting rate (°/s) that stays bounded on a page left open
const sw = (u, rate) => rate * 5 * Math.sin(u / 5);
export const VIEW_FN = {
  open: (u, z) => {
    const k = smoother(u / 3.4);
    return {tx: 0, ty: z.H * 0.42, tz: 0, az: 12 + 26 * k, el: 15 + 7 * k, d: z.D * (1.18 - 0.14 * k), sx: -30, sy: 18};
  },
  hero: (u, z) => ({tx: 0, ty: z.H * 0.42, tz: 0, az: 38 + sw(u, 3), el: 22, d: z.D * 1.04, sx: -30, sy: 18}),
  front: (u, z) => ({tx: 0, ty: z.H * 0.42, tz: 0, az: 2 + sw(u, 1.5), el: 9, d: z.D, sx: -30, sy: 18}),
  side: (u, z) => ({tx: 0, ty: z.H * 0.42, tz: 0, az: 88 - sw(u, 2), el: 12, d: z.D * 0.9, sx: -30, sy: 18}),
  top: (u, z) => ({tx: 0, ty: z.H * 0.5, tz: 0, az: 4 + sw(u, 1.5), el: 72, d: z.D * 0.92, sx: -30, sy: 0}),
  lid: (u, z) => ({tx: 0, ty: z.lid, tz: 0, az: 24 + sw(u, 2.5), el: 36, d: z.D * 0.86, sx: -30, sy: 30}),
  inside: (u, z) => ({tx: 0, ty: z.mid + z.H * 0.06, tz: 0, az: 8 + sw(u, 2), el: 9, d: z.D * 0.8, sx: -30, sy: 10}),
};
export const sizeOf = (tr) => {
  const H = tr.dims.h;
  const W = Math.max(tr.dims.l, tr.dims.b * 1.2);
  return {H, D: Math.max(H * 4.1, W * 3.4), lid: tr.dims.yLid * 0.001, mid: tr.dims.coreMid};
};
export const camAt = (t, z) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const view = (k) => VIEW_FN[VIEWS[k][1]](t - VIEWS[k][0], z);
  const cur = view(i);
  if (i === 0) return cur;
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.6, t);
  return k >= 1 ? cur : blend(view(i - 1), cur, k);
};
export function blend(a, b, k, backOff = true) {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : a[key] + (b[key] - a[key]) * k;
  const swing = Math.min(1, Math.abs(((b.az - a.az + 540) % 360) - 180) / 90);
  if (backOff) o.d += Math.max(0, Math.max(a.d, b.d) * (1 + 0.15 * swing) - o.d) * Math.sin(Math.PI * k) * 0.6;
  return o;
}
export const camName = (t) => {
  const v = VIEWS.filter(([t0]) => t0 <= t).pop()[1];
  return v === 'open' ? 'hero' : v;
};
/** The untanked unit needs room: lift the target and back off with the explode factor. */
export const withExplode = (c, e, z) => ({...c, ty: c.ty + e * z.H * 0.3, d: c.d * (1 + 0.32 * e)});

// ------------------------------------------------------------------------------------------------ the operator's pointer
const REST = [[820, 470], [700, 430], [900, 520], [760, 380]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0).map((e) => {
    if (e.load) return {t: e.t, spot: ui.knob('load', e.load[0] / LOAD_MAX), to: ui.knob('load', e.load[1] / LOAD_MAX), drag: e.load[2]};
    if (e.cfg) return {t: e.t, spot: ui.rowSpot(e.cfg[0]), drag: 0};
    const k = e.fault ? 'f_' + e.fault : e.cam ?? e.cut ?? e.view ?? e.overlay ?? e.tab;
    return {t: e.t, spot: ui.spots[k], drag: 0};
  });
  const WP = [[0, 980, 640]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.16, ...e.spot]);
    if (e.drag) {
      for (let k = 0; k <= 12; k++) {
        const tt = e.t + (k / 12) * e.drag;
        WP.push([tt + 0.02, ...ui.knob('load', loadAt(tt) / LOAD_MAX)]);
      }
      WP.push([e.t + e.drag + 0.3, ...e.to]);
    } else WP.push([e.t + 0.24, ...e.spot]);
    const next = EV[i + 1];
    if (!next || next.t - e.t > 2.2) WP.push([e.t + e.drag + 1.4, ...REST[i % REST.length]]);
  });
  WP.sort((a, b) => a[0] - b[0]);
  return (t) => {
    let i = 0;
    while (i < WP.length - 2 && t > WP[i + 1][0]) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const lin = t1 - t0 < 0.2;
    const k = lin ? clamp((t - t0) / (t1 - t0), 0, 1) : ss(t0, t1, t);
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

// ------------------------------------------------------------------------------------------------ one frame: model and overlay
/** The 3D model's pose for an operating point. */
export function poseOf(sp, op) {
  const el = electrical(sp, op.th, op.K, op.pf);
  const T = op.thermal;
  const ex = expansion(sp, T.top);
  const Lt = losses(sp, op.K).tot;
  const on = op.energised !== false;
  const pr = op.prot;
  return {
    flux: on ? el.flux : [0, 0, 0],
    lv: on ? el.lv : [0, 0, 0],
    hv: on ? el.hv : [0, 0, 0],
    prot: pr && {
      leakL: pr.leakL, leaking: !!op.faults?.leak, bubbles: pr.bubbles, arcFlash: pr.arcFlash, time: op.time ?? 0, sat: pr.sat, prvOpen: pr.prvOpen,
      dgptFrac: pr.gasDgpt / 400, buchFrac: pr.gasBuch / 300, levelCm: pr.levelCm ?? 0,
    },
    K: op.K,
    heat: clamp(Lt / (sp.p0 + sp.pk), 0, 1.6) / 1.6,
    flowPhase: op.flowPhase,
    topOil: T.top,
    maxOil: T.max,
    oilLevelMm: ex.cm * 10,
    finBulge: sp.herm ? 1 + clamp(ex.litres / (sp.oilL * 0.08), -0.25, 0.8) : 1,
    tap: op.tap,
    view: op.view,
    overlays: op.overlays,
    explode: op.explode,
    dipstick: op.dipstick ?? 0,
    wheelTurn: op.wheelTurn ?? 0,
  };
}

const CALLOUTS = {
  core: [['core', 'core', [930, 170], 150]],
  windings: [['windings', 'hv', [1010, 200], 130], ['lvw', 'lv', [330, 650], 110]],
};
export function makeConsoleFrame(ui, st) {
  const P = (a) => (a ? st.project(a[0], a[1], a[2]) : null);
  return (t, op) => {
    const tr = st.tr;
    const sp = op.sp;
    const el = electrical(sp, op.th, op.K, op.pf);
    const T = op.thermal;
    const ex = expansion(sp, T.top);
    const Ls = losses(sp, op.K, clamp(T.hot - 10, 20, 120));
    const reg = regulation(sp, op.K, op.pf);
    const ulv = lvVoltage(sp, op.ug, op.tap, op.K, op.pf);
    const vis = ss(1.1, 1.8, op.since) * (op.overlays.parts ? 0.35 : 1);
    const callouts = [];
    if (op.cut !== 'solid' || op.view !== 'all')
      for (const [anchor, key, label, w] of CALLOUTS[op.view] ?? []) {
        const ex2 = EXTRA_PARTS[key];
        callouts.push({name: ex2.name, sub: ex2.sub, at: P(tr.anchor(anchor)), label, w, o: vis});
      }
    if (op.view === 'windings' && sp.cfg.screen && tr.anchor('screen')) callouts.push({name: EXTRA_PARTS.screen.name, sub: EXTRA_PARTS.screen.sub, at: P(tr.anchor('screen')), label: [1010, 600], w: 130, o: vis});
    // a leader from the flux panel into the tracked limb, from the thermal panel to the thermometer
    const lead = 1;
    if (op.view === 'core' || op.view === 'windings' || op.cut === 'section')
      callouts.push({name: '', sub: '', at: P([((op.limb - 1) * sp.core.pitch) * 0.001, tr.dims.coreMid, 0]), label: [282, 320], w: 0, o: 0.8 * lead});
    if (op.tab === 'operate' && (op.cam === 'lid' || op.cam === 'hero') && op.explode < 0.05)
      callouts.push({name: '', sub: '', at: P(tr.anchor('thermo')), label: [1318 - 0.01, 110], w: 0, o: 0.7 * lead});
    const parts = PARTS.map((p) => P(tr.anchor(p.key)));
    const partsO = op.overlays.parts ? ss(0, 0.5, op.partsSince ?? 9) : 0;
    let card = null;
    if (op.partSel) {
      const p = PARTS.find((x) => x.n === op.partSel);
      card = {title: `${p.n} · ${p.name} · p.${p.p}`, text: p.info};
    } else if (op.view !== 'all' && EXTRA_PARTS[op.view === 'windings' ? 'hv' : op.view === 'oil' ? 'oil' : op.view]) {
      const x = EXTRA_PARTS[op.view === 'windings' ? 'hv' : op.view === 'oil' ? 'oil' : op.view];
      card = {title: `${x.name} · ${x.sub}`, text: x.info};
    } else if (op.cut === 'glass' && op.view === 'all') card = {title: `${EXTRA_PARTS.oil.name} · ${EXTRA_PARTS.oil.sub}`, text: EXTRA_PARTS.oil.info};
    if (op.explode > 0.3) card = {title: 'Untanking · the active part hangs from the lid', text: 'Lid, bushings, leads and the active part come out as one. Revisions only at the factory or an equipped workshop (p.58). Never lift by the waves; sling angle ≥ 60° on the two lugs (p.40).'};
    if (op.card) card = op.card;
    const lastEv = op.prot?.events?.at(-1);
    const evFlash = lastEv && op.simMin - lastEv.min < 18 && lastEv.kind !== 'info' ? `${lastEv.kind === 'trip' ? '⚡ ' : '⚑ '}${lastEv.text}` : '';
    const site = sp.cfg.zone ?? 'Z1';
    ui.update({
      sp,
      th: op.th,
      K: op.K,
      pf: op.pf,
      ta: op.ta,
      ug: op.ug,
      tap: op.tap,
      phi: el.phi,
      flux: op.energised === false ? [0, 0, 0] : el.flux,
      limb: op.limb,
      thermal: {...T, V: ageing(T.hot), levelCm: ex.cm, dV: ex.litres},
      contK: continuousLoad(sp, op.ta),
      history: op.history,
      simMin: op.simMin,
      loss: Ls,
      eta: efficiency(sp, op.K, op.pf),
      reg,
      ulv,
      flowSpeed: (op.flowRate ?? flowRate(sp, op.K)) * 1100,
      seismic: seismic(sp, site, 'C', 'II'),
      seismicKey: site,
      parallel: parallel(sp),
      cam: op.cam,
      cut: op.cut,
      view: op.view,
      overlays: op.overlays,
      tab: op.tab,
      cfgHi: op.cfgHi,
      notes: op.notes,
      flash: op.flash || evFlash || (op.energised === false ? 'DE-ENERGISED · HV BREAKER OPEN' : ''),
      prot: op.prot,
      coord: coordination(sp),
      faults: op.faults,
      energised: op.energised !== false,
      card,
      callouts,
      parts,
      partsO,
      partSel: op.partSel,
      buchholz: op.buchholz,
      paused: !!op.paused,
      sliders: op.sliders ?? {playText: '1/150 · 6 MIN/S', playK: 0.5},
      scale: op.scale,
      cursor: op.cursor,
    });
  };
}

export function makeFilm() {
  return async ({canvas, capture}) => {
    let cfgKey = JSON.stringify(defaultConfig());
    let sp = spec(defaultConfig());
    const st = createTrafoStage({canvas, spec: sp});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    window.TRAFO = st;
    // the card during the parts beat walks the lid: HV, LV, tap changer, thermometer
    const PART_WALK = [4, 5, 6, 8, 3];
    return {
      resize,
      render(t) {
        const cfg = cfgAt(t);
        const key = JSON.stringify(cfg);
        if (key !== cfgKey) {
          cfgKey = key;
          sp = spec(cfg);
          st.setSpec(sp);
        }
        const cut = cutAt(t);
        const view = viewAt(t);
        const ov = overlaysAt(t);
        const explode = explodeAt(t);
        const K = effLoadAt(t);
        const thermal = thermalAt(t);
        const prot = protAt(t);
        const fEv = SCRIPT.filter((e) => e.fault && e.fault !== 'reset' && e.t <= t).pop();
        const cam = camName(t);
        const t0 = VIEWS.filter(([a]) => a <= t).pop()[0];
        const ev = SCRIPT.filter((e) => e.t <= t).pop();
        const partsEv = SCRIPT.find((e) => e.overlay === 'parts');
        const partsSince = t - partsEv.t;
        const cfgEv = SCRIPT.filter((e) => e.cfg && e.t <= t).pop();
        const notes = cfgEv && t - cfgEv.t < 2.2 ? resolve({...cfgAt(cfgEv.t - 0.01), [cfgEv.cfg[0]]: cfgEv.cfg[1]}, cfgEv.cfg[0]).notes : [];
        const partSel = ov.parts && partsSince > 0.6 && t < SCRIPT.find((e) => e.tab).t ? PART_WALK[Math.min(PART_WALK.length - 1, Math.floor((partsSince - 0.6) / 0.66))] : 0;
        const op = {
          sp,
          th: 30 + t * DEG_PER_S,
          K,
          pf: 0.9,
          ta: 20,
          ug: 1,
          tap: 3,
          limb: 0,
          thermal,
          history: historyAt(t),
          simMin: Math.max(0, t * THERMAL_MIN_PER_S),
          flowPhase: flowAt(t),
          cut,
          view,
          overlays: ov,
          explode,
          tab: tabAt(t),
          cfgHi: cfgEv && t - cfgEv.t < 2 ? cfgEv.cfg[0] : null,
          notes,
          cam,
          since: t - t0,
          partsSince,
          partSel,
          dipstick: cam === 'lid' && cfg.design === 'breathing' ? ss(23.6, 24.6, t) * (1 - ss(28.2, 28.8, t)) : 0,
          cursor: cursorAt(t),
          prot,
          energised: energisedAt(t),
          faults: fEv && t - fEv.t < 1.2 ? {[fEv.fault]: 1} : {},
          time: t,
          card: fEv && t - fEv.t < 3 && t < 40.6 ? {title: `${FAULTS.find((f) => f.key === fEv.fault).name} · p.${FAULTS.find((f) => f.key === fEv.fault).p}`, text: FAULTS.find((f) => f.key === fEv.fault).text + '. The full protection reads the pressure and the gas; the relief valve vents; the trip contact opens the HV breaker.'} : null,
        };
        void ev;
        st.setCut(cut);
        const z = sizeOf(st.tr);
        const c = withExplode(camAt(t, z), explode, z);
        st.frame(poseOf(sp, op), {...c, az: c.az * D2R, el: c.el * D2R});
        frame(t, op);
        return {};
      },
    };
  };
}
void OPTIONS;
void optText;
void steady;
void oltcPosition;

export const run = () => runSim(DEFAULTS, makeFilm());
