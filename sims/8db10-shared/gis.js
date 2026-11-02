// The 8DB10-type double-busbar GIS feeder panel as numbers. No three.js here: the parameter block in metres, the switching
// devices as functions of the procedure clock tau (real seconds), the interlocks, the fault current and the energised
// path. Everything on screen (the poses, the single-line diagram, the gauges, the charts) reads from stateAt().
//
// Sources: Siemens catalog HA 35.11 · 2025 ("cat.") and the 8DB10 installation and operating instructions 864-5091.9
// rev. 06 ("man."). Lengths marked "p.20 drawing" were measured off the catalog's side view of the circuit-breaker
// panel (2665 mm depth = 744 px, 3.58 mm/px, about ±10 mm). Values marked ASSUMED are not in either document.

// ------------------------------------------------------------ ratings (cat. p.5, man. p.42)
export const R = {
  Ur: 40.5, // kV rated voltage
  f: 50, // Hz
  Ud: 85, // kV power-frequency withstand
  Up: 185, // kV lightning impulse withstand
  Ik: 40, // kA short-circuit breaking current
  ip: 100, // kA peak withstand at 50 Hz (104 at 60 Hz)
  Ibb: 5000, // A busbar
  Ifd: 3150, // A feeder, with forced ventilation
  Iload: 1250, // A ASSUMED load on the feeder in the film
  pfLoad: 0.9, // ASSUMED load power factor
};

// ------------------------------------------------------------ geometry (metres). x across the 600 mm width, y up from
// the floor, z along the depth with the operating front at +z. The poles stand one behind the other (cat. p.24).
const zr = (mm) => (mm - 1332.5) / 1000; // depth measured from the rear face
export const G = {
  W: 0.6, // panel spacing (cat. p.20)
  H: 2.35, // height
  D: 2.665, // depth, double busbar, wall-standing
  lvH: 0.85, // low-voltage compartment height
  rearZ: zr(0),
  frontZ: zr(2665),
  // pole centrelines: 275 + k * 360 mm from the rear (cat. p.20). Feeder poles L1 (front), L2, L3 at 720 mm pitch,
  // each busbar-2 housing 360 mm behind its busbar-1 housing; front to rear the busbar housings read 1 4 2 5 3 6 (p.25)
  poleZ: [zr(2075), zr(1355), zr(635)],
  bb2Z: [zr(1715), zr(995), zr(275)],
  // busbar housings: horizontal cylinders along x, flange OD 297, neck 244, cover plate on top (p.20 drawing)
  yBB: 1.927,
  bbFlangeR: 0.1485,
  bbBodyR: 0.122,
  bbNeckR: 0.122,
  yBBCover: 2.088,
  // gas-tight bushing busbar -> disconnector housing: 312 mm OD, 43 mm thick
  yBush1: 1.701,
  bushR: 0.156,
  bushT: 0.043,
  // three-position disconnector housing (busbar system 1): vertical body, round side cover 294 mm
  yDisc: 1.515,
  discR: 0.147,
  // disconnector housing busbar system 2: a T box from its neck forward to the vertical bushing next to Q1
  q2Top: 1.648,
  q2Bot: 1.354,
  q2BushDz: -0.19, // vertical gas-tight bushing, 190 mm behind the feeder pole axis
  // gas-tight bushing disconnector -> circuit-breaker
  yBush2: 1.236,
  // circuit-breaker housing: 752..1211 mm, 340 mm wide, side cover centre at 1021
  cbTop: 1.211,
  cbBot: 0.752,
  cbY: 1.021,
  cbR: 0.17,
  // base frame (subframe): top beams 602..738, bottom 0..107, runs from the rear face to the operating cubicle
  frameTop: 0.738,
  frameTopB: 0.602,
  frameBot: 0.107,
  frameFrontZ: zr(2264),
  // feeder current transformer (4MC4, outside the gas): 423..602, 276 OD
  ctTop: 0.602,
  ctBot: 0.423,
  ctR: 0.138,
  // panel connection housing with inside-cone sockets (EN 50181): 154..394, 225 -> 161 wide
  connTop: 0.394,
  connBot: 0.154,
  connRTop: 0.112,
  connRBot: 0.08,
  connH: 0.108, // panel connection height h for cable plugs, double busbar (cat. p.33, version 5)
  // operating cubicle (mechanisms behind the control board) and the LV compartment above it
  cubZ0: zr(2264),
  cubTop: 1.505,
  // vacuum interrupter inside the CB housing: ASSUMED proportions for a 40.5 kV bottle
  viLen: 0.27,
  viR: 0.058,
  viY: 0.985,
};

// ------------------------------------------------------------ the switching devices
// Q1: three-position disconnector, busbar system 1. Blade angle from vertical, + toward the front; the earthing contact
// sits on the housing's front wall (man. p.24, Fig. 7). Angles read off that figure: ASSUMED to about 10 degrees.
export const Q1A = {closed: 0, open: 52, earth: 104};
export const Q1L = 0.115; // blade length, pivot to tip
// Q2: disconnector, busbar system 2. Pivot near the bushing to Q1, the fixed contact under the busbar-2 neck;
// OPEN swings the blade down toward the rear (Fig. 7, item 4)
export const Q2P = {dz: 0.1, y: 1.5};
export const Q2L = 0.16;
export const Q2A = {closed: (Math.atan2(-Q2P.dz, 1.625 - Q2P.y) * 180) / Math.PI, open: -120};

export const CB = {
  closeT: 0.058, // command -> contacts touch (cat. < 95 ms)
  openT: 0.034, // command -> contacts separate (cat. < 65 ms)
  stroke: 0.02, // ASSUMED contact gap of a 40.5 kV interrupter, metres
  moveClose: 0.017, // time the moving contact travels before touching, ASSUMED (~1.2 m/s)
  moveOpen: 0.014, // separation -> full gap, ASSUMED (~1.4 m/s)
  bounce: 0.0006, // ASSUMED contact bounce on closing
  relay: 0.03, // protection pick-up -> trip command, ASSUMED instantaneous overcurrent
  arcMin: 0.003, // ASSUMED minimum arcing before a current zero can clear
  deadT: 0.3, // dead time of the auto-reclose O - 0.3 s - CO (cat. p.27)
  charge: 11, // closing spring recharge by the motor (cat. < 15 s), ASSUMED 11 s
  tauDC: 0.045, // DC time constant of the fault, IEC default 45 ms (X/R = 14 at 50 Hz)
};
export const DISC_T = 2.0; // ASSUMED disconnector motor operating time, not in the documents

// ------------------------------------------------------------ gas (man. p.44): SF6, relative pressures at 20 °C
export const GAS = {
  rated: 120, // kPa, the 120 kPa level for these ratings
  critical: 90, // "critical functional level" signal
  low: 100, // "pressure too low" / minimum functional level
  high: 180, // "pressure too high" / maximum functional level
  patm: 101.3,
  leak: 0.001, // < 0.1 % per year (cat. p.25)
};
// the nine compartments and their manometers (cat. p.25)
export const COMPARTMENTS = [
  {id: 'B11', name: 'BUSBAR 1 · L1', kind: 'bb1', pole: 0},
  {id: 'B12', name: 'BUSBAR 1 · L2', kind: 'bb1', pole: 1},
  {id: 'B13', name: 'BUSBAR 1 · L3', kind: 'bb1', pole: 2},
  {id: 'B21', name: 'BUSBAR 2 · L1', kind: 'bb2', pole: 0},
  {id: 'B22', name: 'BUSBAR 2 · L2', kind: 'bb2', pole: 1},
  {id: 'B23', name: 'BUSBAR 2 · L3', kind: 'bb2', pole: 2},
  {id: 'B1', name: 'THREE-POS. DISCONNECTOR', kind: 'q1'},
  {id: 'B2', name: 'DISCONNECTOR BB2', kind: 'q2'},
  {id: 'B0', name: 'CIRCUIT-BREAKER', kind: 'cb'},
];
/** manometer reading in kPa (relative) at ambient temperature T °C: constant density, so p_abs scales with T */
export const gasAt = (T = 20, rated = GAS.rated) => ((rated + GAS.patm) * (273.15 + T)) / 293.15 - GAS.patm;

// ------------------------------------------------------------ currents
const W = 2 * Math.PI * R.f;
const THETA = Math.atan(W * CB.tauDC); // current lags the source voltage by ~86° in a fault
const PH = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
const PHI_LOAD = Math.acos(R.pfLoad);
/** load current of phase p at tau, amperes */
export const iLoad = (tau, p) => Math.SQRT2 * R.Iload * Math.sin(W * tau - PH[p] - PHI_LOAD);
/** fault current of phase p at tau for a fault starting at tf: the AC part plus the decaying DC that keeps it continuous */
export const iFault = (tau, p, tf) => {
  const Ik = R.Ik * 1000;
  const ac = (x) => Math.SQRT2 * Ik * Math.sin(W * x - PH[p] - THETA);
  return ac(tau) + (iLoad(tf, p) - ac(tf)) * Math.exp(-(tau - tf) / CB.tauDC);
};
/** the fault inception time at or after tau that gives phase L1 its full DC offset (the worst case, for the film) */
export const worstInception = (tau) => {
  const want = THETA - Math.PI / 2; // voltage angle where the AC part is at its negative peak
  const ph = (((want - W * tau) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return tau + ph / W;
};

/** a fault at tf: protection trips, each pole clears at its first current zero after contact separation plus the
 * minimum arcing time, the auto-reclose closes after the dead time. Returns the events to add. */
export function faultEvents(tf, autoReclose = true) {
  const trip = tf + CB.relay;
  const sep = trip + CB.openT;
  const clear = PH.map((_, p) => {
    let a = sep + CB.arcMin;
    let s = Math.sign(iFault(a, p, tf));
    for (let x = a; x < a + 0.05; x += 1e-5) {
      const v = Math.sign(iFault(x, p, tf));
      if (v !== s) return x;
      s = v;
    }
    return a + 0.05;
  });
  const ext = Math.max(...clear);
  const ev = [{at: tf, dev: 'fault', trip, sep, clear, ext}, {at: trip, dev: 'q0', to: 'open', cause: 'protection'}];
  if (autoReclose) ev.push({at: ext + CB.deadT - CB.closeT, dev: 'q0', to: 'closed', cause: 'auto-reclose'});
  return ev;
}

// ------------------------------------------------------------ device kinematics
const sm = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
/** contact gap in metres, 0 = touching. kind 'closed' or 'open', u = seconds since the command */
export function cbGap(to, u) {
  if (to === 'closed') {
    const t0 = CB.closeT - CB.moveClose;
    if (u < t0) return CB.stroke;
    if (u < CB.closeT) {
      const k = (u - t0) / CB.moveClose;
      return CB.stroke * (1 - k * k * (1.6 - 0.6 * k)); // the spring accelerates the contact into the touch
    }
    const b = u - CB.closeT;
    return b < 0.003 ? CB.bounce * Math.sin((Math.PI * b) / 0.003) : 0;
  }
  if (u < CB.openT) return 0;
  const k = (u - CB.openT) / CB.moveOpen;
  if (k < 1) return CB.stroke * (1 - (1 - k) * (1 - k));
  // the damper catches it: a small overshoot that dies out
  const r = (u - CB.openT - CB.moveOpen) / 0.012;
  return CB.stroke * (1 + 0.06 * Math.exp(-r) * Math.sin(Math.PI * Math.min(r, 3)));
}

// ------------------------------------------------------------ the state at tau
export const INITIAL = {q0: 'closed', q1: 'closed', q2: 'open', spring: 1, ops: 0, closedAt: -99};

/** fold the events (sorted by at) over the base state; tau in real seconds */
export function stateAt(events, tau, base = INITIAL) {
  const s = {
    q0: base.q0, q0From: base.q0, q0At: -99, q0Cause: '',
    q1: base.q1, q1From: base.q1, q1At: -99,
    q2: base.q2, q2From: base.q2, q2At: -99,
    closedAt: base.closedAt ?? -99, ops: base.ops ?? 0, spring0: base.spring ?? 1, fault: null,
  };
  for (const e of events) {
    if (e.at > tau) break;
    if (e.dev === 'fault') s.fault = e;
    else if (e.dev === 'q0') {
      s.q0From = s.q0;
      s.q0 = e.to;
      s.q0At = e.at;
      s.q0Cause = e.cause || '';
      if (e.to === 'closed') {
        s.closedAt = e.at;
        s.ops++;
      }
    } else {
      s[e.dev + 'From'] = s[e.dev];
      s[e.dev] = e.to;
      s[e.dev + 'At'] = e.at;
    }
  }
  // disconnectors: angle, and a conducting position only at the end of the travel
  const disc = (q, A) => {
    const k = sm((tau - s[q + 'At']) / DISC_T);
    return {ang: A[s[q + 'From']] + (A[s[q]] - A[s[q + 'From']]) * k, k, pos: k >= 1 ? s[q] : 'moving', to: s[q], from: s[q + 'From']};
  };
  const q1 = disc('q1', Q1A);
  const q2 = disc('q2', Q2A);
  // circuit-breaker: the contact gap, the spring
  const u = tau - s.q0At;
  const gap = cbGap(s.q0, u);
  const cbMoving = s.q0 === 'closed' ? u < CB.closeT + 0.004 : u < CB.openT + CB.moveOpen + 0.03;
  const touching = gap < 1e-4 && (s.q0 === 'closed' ? u >= CB.closeT : true);
  const spring = s.closedAt > -99 ? Math.min(1, Math.max(0, (tau - s.closedAt - CB.closeT - 0.05) / CB.charge)) : s.spring0;
  const springBusy = s.closedAt > -99 && spring < 1;
  // the fault, pole by pole
  const f = s.fault;
  const arc = [0, 1, 2].map((p) => !!f && tau >= f.sep && tau < f.clear[p]);
  const faultOn = [0, 1, 2].map((p) => !!f && tau >= f.at && tau < f.clear[p]);
  // energised path: both busbars are live (fed by their incomers); the feeder node above the CB takes whatever its
  // disconnectors connect it to; the cable follows through the CB
  const node = q1.pos === 'closed' ? 'bb1' : q2.pos === 'closed' ? 'bb2' : q1.pos === 'earth' ? 'earth' : 'dead';
  const conducts = [0, 1, 2].map((p) => touching || arc[p]);
  const live = node === 'bb1' || node === 'bb2';
  const cable = live && conducts.some(Boolean) ? 'live' : node === 'earth' && touching ? 'earth' : 'dead';
  const i = [0, 1, 2].map((p) => {
    if (!live || !conducts[p]) return 0;
    if (faultOn[p]) return iFault(tau, p, f.at);
    return touching ? iLoad(tau, p) : 0;
  });
  return {
    tau, q0: s.q0, q0Cause: s.q0Cause, q0At: s.q0At, gap, touching, cbMoving, spring, springBusy, ops: s.ops,
    q1, q2, node, cable, i, arc, fault: f, faultOn: faultOn.some(Boolean),
    busy: cbMoving || q1.pos === 'moving' || q2.pos === 'moving',
  };
}

/** the base state to restart a fold from (live page pruning, film checkpoints) */
export const baseOf = (s) => ({q0: s.q0, q1: s.q1.to, q2: s.q2.to, spring: s.spring, ops: s.ops, closedAt: s.springBusy ? s.tau - s.spring * CB.charge - CB.closeT - 0.05 : -99});

// ------------------------------------------------------------ the interlocks (cat. p.27-29, man. p.22-26)
const NO = (reason) => ({ok: false, reason});
const OK = {ok: true, reason: ''};
/** may device dev go to position to now? {ok, reason} */
export function allowed(s, dev, to) {
  if (dev === 'fault') return s.cable === 'live' && s.touching ? OK : NO('FEEDER NOT CARRYING CURRENT');
  if (s.busy) return NO('OPERATION IN PROGRESS');
  if (dev === 'q0') {
    if (to === s.q0) return NO(to === 'closed' ? 'CIRCUIT-BREAKER ALREADY CLOSED' : 'CIRCUIT-BREAKER ALREADY OPEN');
    if (to === 'closed' && s.spring < 1) return NO('CLOSING SPRING NOT CHARGED');
    return OK;
  }
  if (s.q0 === 'closed') return NO('CIRCUIT-BREAKER CLOSED · DISCONNECTORS LOCKED');
  const cur = s[dev].to;
  if (cur === to) return NO('ALREADY IN THAT POSITION');
  if (dev === 'q1') {
    if (to !== 'open' && cur !== 'open') return NO('SWITCH Q1 TO OPEN FIRST');
    if (to !== 'open' && s.q2.to === 'closed') return NO(to === 'closed' ? 'Q2 CLOSED · WOULD COUPLE THE BUSBARS' : 'Q2 CLOSED · WOULD EARTH BUSBAR 2');
    return OK;
  }
  if (to === 'closed' && s.q1.to === 'closed') return NO('Q1 CLOSED · WOULD COUPLE THE BUSBARS');
  if (to === 'closed' && s.q1.to === 'earth') return NO('Q1 READY-TO-EARTH · WOULD EARTH BUSBAR 2');
  return OK;
}

/** the switching program from state s to a target ('bb1' | 'bb2' | 'earth' | 'off'), as events from tau0 on */
export function plan(s, target, tau0) {
  const ev = [];
  let t = tau0 + 0.4;
  let q1 = s.q1.to;
  let q2 = s.q2.to;
  if (s.q0 === 'closed') {
    ev.push({at: t, dev: 'q0', to: 'open'});
    t += 0.6;
  }
  const mv = (dev, to) => {
    ev.push({at: t, dev, to});
    t += DISC_T + 0.4;
    if (dev === 'q1') q1 = to;
    else q2 = to;
  };
  if (target === 'bb1') {
    if (q2 === 'closed') mv('q2', 'open');
    if (q1 === 'earth') mv('q1', 'open');
    if (q1 !== 'closed') mv('q1', 'closed');
  } else if (target === 'bb2') {
    if (q1 !== 'open') mv('q1', 'open');
    if (q2 !== 'closed') mv('q2', 'closed');
  } else if (target === 'earth') {
    if (q2 === 'closed') mv('q2', 'open');
    if (q1 === 'closed') mv('q1', 'open');
    if (q1 !== 'earth') mv('q1', 'earth');
  } else {
    if (q1 !== 'open') mv('q1', 'open');
    if (q2 !== 'open') mv('q2', 'open');
  }
  if (target !== 'off') {
    // the closing spring must be charged again before the next close
    const ready = s.springBusy ? s.tau + (1 - s.spring) * CB.charge + 0.2 : 0;
    ev.push({at: Math.max(t, ready), dev: 'q0', to: 'closed'});
  }
  return ev;
}

// ------------------------------------------------------------ playback rate: slow motion around the breaker
const sw = (a, b, x) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
/** the slow-motion windows the events ask for: [from, to, factor] in tau */
export function windows(events) {
  const out = [];
  for (const e of events) {
    if (e.dev === 'fault') {
      out.push([e.at - 0.004, e.ext + 0.012, 1 / 60, 'fault']);
      out.push([e.ext + 0.012, e.ext + CB.deadT - 0.02, 1 / 4, 'dead']);
    } else if (e.dev === 'q0' && e.to === 'closed') out.push([e.at + CB.closeT - 0.026, e.at + CB.closeT + 0.012, 1 / 30, 'close']);
    else if (e.dev === 'q0' && e.cause !== 'protection') out.push([e.at + CB.openT - 0.008, e.at + CB.openT + CB.moveOpen + 0.012, 1 / 30, 'open']);
  }
  return out;
}
/** d tau / d t at tau: 1 in real time, slow inside the windows (eased in log space), ff when nothing moves */
export function rateAt(win, tau, ff = 1, discBusy = false) {
  let lg = 0;
  let near = false;
  for (const [a, b, k] of win) {
    const r = Math.min(0.012, (b - a) / 3);
    const w = sw(a - r, a, tau) * (1 - sw(b, b + r, tau));
    lg = Math.min(lg, Math.log(k) * w);
    if (tau > a - 0.35 && tau < b + 0.35) near = true;
  }
  if (lg < 0) return Math.exp(lg);
  return near || discBusy ? 1 : ff;
}
