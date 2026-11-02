// SIQuench 3AM4, the film: the device in the switchgear, an arc strikes between the phases in the cable compartment,
// the light sensor sees it, the controller fires the three coils, the plungers knock the latch tongues off the
// crossheads, the disc spring stacks drive the contacts 18 mm through the oil, the three phases are bolted to earth
// and the arc goes out at 4 ms; then the operator recharges the poles with the Spannwerkzeug and the controller's LEDs
// walk through the manual's sequence back to Quencher Ready. A pure function of t: the event clock tau(t) (ms after
// ignition) and each pole's charge progress k(t) pose everything; the panels read the same functions.
import {runSim} from '../kit/runtime.js';
import {ACCENT} from './device.js';
import {CAMS, createConsole} from './console.js';
import {DEV, DRIVE, POLES, currents, events, leds, poleState} from './quench.js';
import {createStage} from './stage.js';

export const DET = 1.0;
export const SCRIPT = [
  {t: 0, cam: 'open'},
  {t: 4.2, cam: 'system'},
  {t: 6.4, trip: true},
  {t: 9.6, cam: 'latch'},
  {t: 14.0, cam: 'pole'},
  {t: 19.6, cam: 'system'},
  {t: 24.0, cam: 'mech'},
  {t: 26.2, charge: [2], cam: 'charge'},
  {t: 34.4, charge: [0, 1], cam: 'mech'},
  {t: 40.2, cam: 'hero'},
];
export const DURATION = 45;
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'siquench', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ the event clock: film seconds -> ms after ignition
// slow motion through the trip (1 / 2,600 while the arc is detected, 1 / 4,400 while the latch lets go, 1 / 2,700
// while the contact flies), then fast to the circuit breaker
const TRIP = SCRIPT.find((e) => e.trip).t;
const TAU_KEYS = [[TRIP, 0], [TRIP + 2.6, 1.0], [TRIP + 7.2, 2.05], [TRIP + 12.6, 4.0], [TRIP + 13.6, 4.7], [TRIP + 14.6, 6.5], [TRIP + 17.2, 60]];
export const tauAt = (t) => {
  if (t < TRIP) return null;
  for (let i = 0; i < TAU_KEYS.length - 1; i++) {
    const [t0, a] = TAU_KEYS[i];
    const [t1, b] = TAU_KEYS[i + 1];
    if (t <= t1) return a + ((t - t0) / (t1 - t0)) * (b - a);
  }
  return TAU_KEYS[TAU_KEYS.length - 1][1];
};
/** playback rate shown on the console at t: film seconds per event millisecond -> "1 / N" */
export const slowAt = (t) => {
  for (let i = 0; i < TAU_KEYS.length - 1; i++) {
    const [t0, a] = TAU_KEYS[i];
    const [t1, b] = TAU_KEYS[i + 1];
    if (t <= t1) return (t1 - t0) / ((b - a) / 1000);
  }
  return 1;
};
export const slowText = (n) => (n <= 1.01 ? '1× SPEED' : `1 / ${Math.round(n).toLocaleString('en-US')}`);
// each pole's recharge: 7.8 s for the first (L3, as in the manual's example), 5.4 s for L1 and L2 together
const CHARGES = SCRIPT.filter((e) => e.charge);
export const chargeAt = (t, i) => {
  for (const [n, e] of CHARGES.entries()) {
    if (!e.charge.includes(i)) continue;
    const dur = n === 0 ? 7.8 : 5.4;
    if (t >= e.t) return t >= e.t + dur ? 1 : (t - e.t) / dur;
  }
  return null;
};

// ------------------------------------------------------------ one frame's machine state, shared with the live page
/**
 * tau: ms after ignition (null: no event yet); kc: per pole recharge progress (null: none); quench: SIQuench armed;
 * det: detection time (ms). Returns the poles, the LEDs, the chip and the device's display inputs.
 */
export function compose({tau, kc = [null, null, null], quench = true, det = DET, blinkT = 0, armed = [true, true, true]}) {
  const ev = events(det);
  const poles = [0, 1, 2].map((i) => {
    if (kc[i] !== null && kc[i] !== undefined) return poleState(null, ev, kc[i]);
    if (!armed[i]) return poleState(1e9, ev, null);
    return poleState(quench ? tau : null, ev, null);
  });
  const charging = kc.findIndex((k) => k !== null && k !== undefined && k > 0 && k < 1);
  const L = leds(poles, blinkT);
  const sum = tau === null ? {arc: 0, earth: 0} : [0, 1, 2].map((ph) => currents(tau, ev, quench, ph)).reduce((a, c) => ({arc: a.arc + Math.abs(c.arc), earth: a.earth + Math.abs(c.earth)}), {arc: 0, earth: 0});
  const live = tau !== null && tau >= 0;
  const arc = !live ? 0 : Math.min(1, (tau < 0.25 ? tau / 0.25 : 1) * (0.25 + sum.arc / 90)) * (sum.arc > 0.6 ? 1 : sum.arc / 0.6);
  const flow = !live ? 0 : Math.min(1, sum.earth / 25);
  let chip;
  const p = poles[0];
  if (charging >= 0) {
    const c = poles[charging];
    chip = [`Recharging L${charging + 1}`, c.tool ? (c.torque > 0 ? `${Math.round(c.torque)} NM · INTERLOCK ACTIVE` : 'TOOL SEATED · TRIP OUTPUT BLOCKED') : 'TOOL IN THE ACTUATION OPENING', 'charge'];
  } else if (!live) chip = poles.every((q) => q.latched && !q.closed) ? ['Quencher ready', 'ALL 3 POLES CHARGED & LATCHED', 'ready'] : ['Not ready', 'RECHARGE THE TRIPPED POLES', 'earthed'];
  else if (!quench) chip = tau < ev.cb ? ['Arc burning', `NO QUENCHER · ${Math.round(sum.arc / 3)} KA PER PHASE`, 'off'] : ['Cleared by the CB', `${Math.round(ev.cb)} MS OF ARCING`, 'off'];
  else if (tau < ev.det) chip = ['Arc burning', 'NOT YET SEEN · LIGHT SENSOR', 'arc'];
  else if (tau < ev.coil) chip = ['Arc detected', 'RELAY SIGNALS THE CONTROLLER', 'arc'];
  else if (tau < ev.release) chip = ['Trigger', tau < ev.strike ? 'TRIP COILS ENERGISED' : 'TONGUES PULLED OFF THE LIPS', 'arc'];
  else if (tau < ev.close) chip = ['Earthing', `CONTACTS IN FLIGHT · ${p.v.toFixed(1)} M/S`, 'move'];
  else if (tau < ev.out) chip = ['Earthed', 'CURRENT LEAVES THE ARC', 'earthed'];
  else if (tau < ev.cb) chip = ['Arc quenched', `3-PHASE SHORT TO EARTH · CB AT ${Math.round(ev.cb)} MS`, 'earthed'];
  else chip = poles.every((q) => q.latched && !q.closed) ? ['Quencher ready', 'ALL 3 POLES CHARGED & LATCHED', 'ready'] : ['Fault cleared', 'RECHARGE TO RESTORE · SPANNWERKZEUG', 'earthed'];
  const on = (a, b) => (live && quench && tau >= a && tau < b ? 1 : 0);
  const active = {
    coil: on(ev.coil, ev.release + 0.4),
    tongue: on(ev.strike, ev.release + 0.6),
    cross: [0, 1, 2].map((i) => Math.max(on(ev.release, ev.close + 0.3), charging === i && poles[i].torque > 3 ? 1 : 0)),
    contact: on(ev.close, ev.cb),
    tool: charging >= 0 ? 1 : 0,
  };
  const tool = charging >= 0 ? {pole: charging, in: poles[charging].toolIn, turns: poles[charging].toolTurns} : null;
  const flowPhase = !live ? 0 : 0.35 * Math.min(tau, 8) + 0.03 * Math.max(0, tau - 8);
  return {ev, poles, leds: L, chip, charging, arc, arcTick: live ? Math.floor(tau * 26) : 0, flow, flowPhase, active, tool, sum};
}

// ------------------------------------------------------------ views, each a function of u (seconds since it came on)
export const VIEW_FN = {
  open: (u) => {
    const k = smoother(u / 4.4);
    return {tx: 0, ty: -0.015, tz: 0.0, az: -78 + 36 * k, el: 24 - 8 * k, d: 2.05 - 0.4 * k, sx: 0, sy: -20};
  },
  hero: (u) => ({tx: 0, ty: -0.015, tz: 0.0, az: -42 + 3 * Math.sin(u * 0.35), el: 16, d: 1.65, sx: 0, sy: -20}),
  front: (u) => ({tx: 0, ty: -0.01, tz: 0, az: -2 + 2 * Math.sin(u * 0.3), el: 6, d: 1.85, sx: 0, sy: -20}),
  side: (u) => ({tx: 0, ty: -0.03, tz: 0.0, az: 88 - 2 * u * 0.2, el: 8, d: 1.5, sx: 0, sy: -20}),
  mech: (u) => ({tx: 0, ty: -0.05, tz: -0.12, az: 150 + 3 * Math.sin(u * 0.3), el: 34, d: 1.85, sx: 0, sy: -20}),
  pole: (u) => ({tx: 0.21, ty: -0.01, tz: 0.04, az: 90 + 0.6 * u, el: 5, d: 1.25, sx: 0, sy: -14}),
  latch: (u) => ({tx: 0.21, ty: 0.01, tz: -0.09, az: 96 + 0.5 * u, el: 12, d: 1.0, sx: 0, sy: -14}),
  system: (u) => ({tx: 0, ty: -0.14, tz: 0.08, az: -32 + 1.2 * Math.sin(u * 0.3), el: 10, d: 2.45, sx: 0, sy: -20}),
  charge: (u) => ({tx: 0.19, ty: -0.04, tz: -0.2, az: 122 + 0.6 * u, el: 14, d: 1.15, sx: 0, sy: -14}),
};
// what each view shows: the hood, the section through pole L3, the busbars
export const VIEW_LOOK = {
  open: {hood: 1, section: -1, sys: 0},
  hero: {hood: 1, section: -1, sys: 0},
  front: {hood: 1, section: -1, sys: 0},
  side: {hood: 1, section: -1, sys: 0},
  mech: {hood: 0, section: -1, sys: 0},
  pole: {hood: 1, section: 2, sys: 0},
  latch: {hood: 0, section: 2, sys: 0},
  system: {hood: 1, section: -1, sys: 1},
  charge: {hood: 0, section: 2, sys: 0},
};
const VIEWS = SCRIPT.filter((e) => e.cam).map((e) => [e.t, e.cam]);
export const camAt = (t, list = VIEWS) => {
  let i = 0;
  while (i < list.length - 1 && list[i + 1][0] <= t) i++;
  const view = (k, tt) => VIEW_FN[list[k][1]](tt - list[k][0]);
  const cur = view(i, t);
  if (i === 0) return cur;
  const k = ss(list[i][0], list[i][0] + 1.7, t);
  if (k >= 1) return cur;
  return blend(view(i - 1, t), cur, k);
};
export function blend(a, b, k, backOff = true) {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : a[key] + (b[key] - a[key]) * k;
  const swing = Math.min(1, Math.abs(((b.az - a.az + 540) % 360) - 180) / 90);
  if (backOff) o.d += Math.max(0, Math.max(a.d, b.d) + 0.5 * swing - o.d) * Math.sin(Math.PI * k);
  return o;
}
export const camName = (t) => VIEWS.filter(([t0]) => t0 <= t).pop()[1];
/** the look (hood, section, busbars) eased across a view change */
export const lookAt = (t) => {
  let i = 0;
  while (i < VIEWS.length - 1 && VIEWS[i + 1][0] <= t) i++;
  const cur = VIEW_LOOK[VIEWS[i][1]];
  if (i === 0) return {...cur};
  const prev = VIEW_LOOK[VIEWS[i - 1][1]];
  const k = ss(VIEWS[i][0], VIEWS[i][0] + 1.2, t);
  // the section switches at the middle of the move, the hood and the busbars fade
  return {hood: prev.hood + (cur.hood - prev.hood) * k, sys: prev.sys + (cur.sys - prev.sys) * k, section: k < 0.5 ? prev.section : cur.section};
};
const camButton = (v) => (v === 'open' ? 'hero' : v === 'charge' ? 'mech' : v);

// ------------------------------------------------------------ callouts per view: name, sub, world point, label, width
const P3 = POLES[2];
export const CALLOUTS = {
  hero: (st) => [
    ['High-voltage connection', 'Ø55 · 4 × M8 · 20 NM', [POLES[0], 0.02, 0.276], [360, 196], 150],
    ['Epoxy housing', 'CYCLOALIPHATIC RESIN · OIL INSIDE', [POLES[1], 0.084, 0.2], [700, 150], 168],
    ['Earthing plate', 'COPPER · BONDS THE 3 POLES', [-0.25, -0.03, 0.007], [330, 560], 160],
    ['Earth connection', 'M12 · 105 NM · EARTHING BAR', [-0.33, 0, 0.017], [330, 640], 150],
    ['Switching part', 'THE MECHANISM UNDER THE HOOD', [0.1, 0.04, -0.12], [1060, 210], 170],
    ['Base plate', '10 × M8 FIXING POINTS · 24 NM', [0.345, -0.045, 0.004], [1110, 560], 168],
  ],
  system: (st) => [
    ['Arc', 'PHASE TO PHASE · CABLE COMPARTMENT', [POLES[0] + 0.1, -0.5, 0.29], [360, 610], 186, st.arc > 0.05],
    ['Point light sensor', 'FIBRE TO THE ARC FLASH RELAY', [-0.36, -0.42, 0.32], [360, 470], 172],
    ['Busbars', 'BOLTED ON THE HV TERMINALS', [POLES[2], -0.2, 0.282], [1080, 420], 150],
    ['SIQuench Core', 'ONE POLE PER PHASE, TO EARTH', [0.1, 0.07, 0.14], [1060, 196], 160],
    ['Earthing bar', 'TO THE SWITCHGEAR EARTH', [-0.448, -0.3, 0.011], [360, 300], 190],
  ],
  mech: (st) => [
    ['Disc spring stack', `${(DRIVE.Fcharged / 1000).toFixed(0)} KN WHEN CHARGED`, [POLES[0], -0.037, -0.17], [360, 560], 150, Math.max(...st.active.cross) > 0],
    ['Latch tongue', 'HOLDS THE CROSSHEAD BACK', [POLES[1], 0.04, -0.09], [690, 150], 150, st.active.tongue > 0],
    ['Position switch S3', 'ON THE TONGUE BRACKET · 3 IN SERIES', [POLES[2] - 0.016, 0.058, -0.095], [1050, 170], 190],
    ['Helical springs', 'ON THE GUIDE RODS · GREASE: ISOFLEX', [POLES[1] + 0.05, -0.037, -0.17], [1080, 600], 190],
    ['Actuation opening', 'Ø16.1 · FOR THE SPANNWERKZEUG', [POLES[1], -0.037, -0.27], [690, 690], 170],
    ['Position switches', 'S1 · S2 · QUENCHER READY SIGNAL', [POLES[0] - 0.045, 0.05, -0.11], [400, 300], 170],
  ],
  pole: (st) => [
    ['Fixed contact', 'AT HIGH VOLTAGE · TULIP', [P3, 0.012, 0.225], [1040, 200], 150, st.ev && st.poles[2].closed],
    ['Moving contact', `AT EARTH · ${DRIVE.L * 1000} MM THROUGH OIL`, [P3, -0.009, 0.15], [1040, 610], 180, st.active.contact > 0 || st.poles[2].v > 0],
    ['Insulating oil', 'MINERAL OIL DIALA S4 ZX-I', [P3, 0.035, 0.12], [640, 160], 150],
    ['Sliding contact', 'EARTHED THROUGH THE COPPER PLATE', [P3, -0.017, 0.022], [480, 630], 180],
  ],
  latch: (st) => [
    ['Position switch S3', 'ON THE TONGUE BRACKET', [P3 - 0.016, 0.058, -0.095], [480, 170], 160],
    ['Latch tongue', 'ZUNGE · PULLED UP BY THE TRIP COIL', [P3, 0.04, -0.109], [1080, 380], 190, st.active.coil > 0 || st.active.tongue > 0],
    ['Slotted bracket', 'GUIDES THE TONGUE', [P3 + 0.02, 0.041, -0.07], [1060, 200], 150],
    ['Crosshead', 'CARRIES THE CONTACT ROD', [P3, -0.03, crossZ0()], [500, 600], 150, Math.max(...st.active.cross) > 0],
  ],
  charge: (st) => [
    ['Spannwerkzeug', 'SW24 · CLOCKWISE TO THE STOP · ≤ 100 NM', [P3, -0.037, -0.33], [440, 600], 220, st.active.tool > 0],
    ['Charging spindle', 'DRAWN BACK BY THE THREAD', [P3, -0.037, -0.235], [460, 250], 160],
    ['Disc spring stack', 'COMPRESSED 18 MM', [P3, -0.037, -0.17], [1060, 200], 140, Math.max(...st.active.cross) > 0],
    ['Latch tongue', 'DROPS IN FRONT OF THE LIP · RE-ARMED', [P3, 0.04, -0.109], [1060, 560], 200],
  ],
};
CALLOUTS.open = CALLOUTS.hero;
CALLOUTS.front = CALLOUTS.hero;
function crossZ0() {
  return -0.11;
}

// labels in two columns either side of the anchors, right-aligned on the left, pushed apart so none overlap; the
// leader runs from the part to the end of the label's rule. Recomputed every frame, so it holds while the camera orbits.
export function layoutCallouts(list) {
  const shown = list.filter((c) => c.at && c.at[0] > 0 && c.at[0] < 1600 && c.at[1] > 0 && c.at[1] < 900);
  if (!shown.length) return [];
  const cx = shown.reduce((a, c) => a + c.at[0], 0) / shown.length;
  const sides = {L: [], R: []};
  for (const c of shown) {
    const w = Math.round(Math.max(c.name.length * 7.0, c.sub.length * 6.55) + 6);
    const left = c.at[0] < cx || (shown.length === 1 && c.at[0] < 800);
    const lx = left ? Math.min(312 + w, c.at[0] - 40) : Math.max(1282 - w, c.at[0] + 40);
    sides[left ? 'L' : 'R'].push({...c, w: left ? -w : w, label: [lx, c.at[1] - 34]});
  }
  for (const k of ['L', 'R']) {
    const a = sides[k].sort((p, q) => p.label[1] - q.label[1]);
    for (let i = 0; i < a.length; i++) a[i].label[1] = Math.max(a[i].label[1], i ? a[i - 1].label[1] + 44 : 110);
    for (let i = a.length - 1; i >= 0; i--) a[i].label[1] = Math.min(a[i].label[1], i < a.length - 1 ? a[i + 1].label[1] - 44 : 730);
  }
  return [...sides.L, ...sides.R];
}

// ------------------------------------------------------------ the operator's pointer
const REST = [[820, 470], [700, 430], [900, 520], [760, 380], [880, 420]];
export function makeCursor(ui) {
  const EV = SCRIPT.filter((e) => e.t > 0).map((e) => {
    if (e.trip) return {t: e.t, spot: ui.spots.trip};
    if (e.charge) return {t: e.t, spot: ui.spots.charge};
    return {t: e.t, spot: ui.spots[camButton(e.cam)]};
  });
  const WP = [[0, 980, 640]];
  EV.forEach((e, i) => {
    WP.push([e.t - 0.16, ...e.spot]);
    WP.push([e.t + 0.24, ...e.spot]);
    WP.push([e.t + 1.6, ...REST[i % REST.length]]);
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

// ------------------------------------------------------------ the overlay's data for a frame
export function makeConsoleFrame(ui, st) {
  return (m, {tau, cam, since, cursor, quench = true, det = DET, slow = '', slowK = 0.5, paused = false, display, opsIk, opsMech, canTrip = true, canCharge = false, labels = 1}) => {
    const vis = ss(1.0, 1.7, since) * labels;
    const callouts = layoutCallouts((CALLOUTS[cam] || (() => []))(m).map(([name, sub, at, , , hot]) => ({name, sub, at: st.project(...at), o: vis, hot: !!hot})));
    ui.update({
      tau,
      ev: m.ev,
      quench,
      det,
      slowText: slow,
      slowK,
      paused,
      poles: m.poles,
      charging: m.charging,
      torque: m.charging >= 0 ? m.poles[m.charging].torque : 0,
      toolTurns: m.charging >= 0 ? m.poles[m.charging].toolTurns : 0,
      leds: m.leds,
      chip: m.chip,
      cam: camButton(cam),
      display,
      callouts,
      cursor,
      opsIk,
      opsMech,
      canTrip,
      canCharge,
    });
  };
}

/** the device inputs for a frame from the machine state and the look */
export const deviceState = (m, look, extra = {}) => ({
  poles: m.poles,
  tool: m.tool,
  hood: look.hood,
  xray: look.xray ?? 0,
  section: look.section,
  explode: look.explode ?? 0,
  sys: look.sys,
  arc: m.arc * Math.min(1, look.sys * 1.5),
  arcTick: m.arcTick,
  flow: m.flow * (look.current ?? 1),
  flowPhase: m.flowPhase,
  active: m.active,
  ...extra,
});

export function makeFilm() {
  return async ({cfg, canvas, capture}) => {
    const st = createStage({canvas});
    // --config with {"lite": true}: no AO, 2x MSAA, a smaller shadow map, for software-GPU renders
    if (cfg.lite) st.setQuality({samples: 2, ao: false, shadow: 2048});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    window.SQ = st;
    return {
      resize,
      render(t) {
        const tau = tauAt(t);
        const kc = [0, 1, 2].map((i) => chargeAt(t, i));
        const m = compose({tau: kc.some((k) => k !== null) ? 80 : tau, kc, blinkT: t});
        const cam = camName(t);
        const c = camAt(t);
        const look = lookAt(t);
        st.frame(deviceState(m, look), {...c, az: c.az * D2R, el: c.el * D2R});
        const t0 = VIEWS.filter(([a]) => a <= t).pop()[0];
        const display = {hood: look.hood > 0.5, xray: false, section: look.section >= 0, explode: false, labels: true, current: true};
        const done = tau !== null;
        frame(m, {tau: tau === null ? null : Math.min(tau, 80), cam, since: t - t0, cursor: cursorAt(t), slow: tau === null || tau >= 60 ? '1× SPEED' : slowText(slowAt(t)), slowK: 0.55, display, opsIk: done ? 1 : 0, opsMech: done ? 1 : 0, canTrip: !done, canCharge: done});
        return {};
      },
    };
  };
}
void CAMS;
void ACCENT;
void DEV;

export const run = () => runSim(DEFAULTS, makeFilm());
