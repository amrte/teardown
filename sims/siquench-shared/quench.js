// SIQuench 3AM4: the numbers. No three.js in here. One event clock tau (milliseconds after the arc ignites) poses every
// part of a trip and feeds every readout; one charge progress k (0..1 per pole) poses the recharge with the
// Spannwerkzeug and drives the controller LEDs. Device space is metres: x across the three poles, y up, z along the
// pole axis (z = 0 the front of the base plate, +z toward the high-voltage terminals, -z into the switching part).
//
// Sources: Siemens Montage- und Betriebsanleitung 9229 0100 100 (06/2026) and the SIQuench brochure (2026).
// SOURCED below means read off those documents; MODELLED means a value chosen to make the mechanism move plausibly,
// because the internal drawings are not public. The on-screen panels say which is which.

// ------------------------------------------------------------ the device (SOURCED: dimension drawings, Abb. 9-12)
export const DEV = {
  mlfb: '3AM4143-1DA12-0AB2',
  Ur: 24, // kV rated voltage
  Up: 125, // kV lightning impulse withstand
  Ud: 50, // kV power-frequency withstand
  Ik: 31.5, // kA rated short-time withstand current (rms)
  ip: 80, // kA peak (brochure test: 80 kA peak / 31.5 kA rms)
  tk: 3, // s rated short-circuit duration
  f: 50, // Hz
  pcd: 0.21, // pole centre distance
  plateW: 0.74,
  plateH: 0.216,
  poleLen: 0.275, // pole projection in front of the plate
  termD: 0.055, // HV terminal diameter, 4 x M8, 12-20 mm thread engagement, 20 Nm
  rearD: 0.2645, // switching part depth behind the plate
  rearW: 0.58,
  rearHBack: 0.132,
  axisH: 0.1512, // pole axis above the switching part's floor
  toolY: 0.114, // actuation openings (3 x 16.1 mm) above the floor
  mass: 60, // kg
  opsMech: 30, // mechanical operations without load
  opsIk: 5, // operations at the full rated short-time current
  toolTorque: 100, // Nm, maximum when charging (manual 11.2 step 3)
};
export const POLES = [-1, 0, 1].map((k) => k * DEV.pcd);

// ------------------------------------------------------------ timing (SOURCED: brochure "Rapid arc fault detection")
// detection of the arc and signalling to the controller ~0.6-1.5 ms, earthing (quenching) ~3 ms, so the arc is out
// < ~4 ms after detection and <= 5 ms after ignition. The split of the 3 ms inside the device is MODELLED.
export const T = {
  detMin: 0.6,
  detMax: 1.5,
  coil: 0.15, // controller output to trip coil current, X1 per pole (MODELLED)
  strike: 0.65, // coil energised to the latch tongue starting to move (MODELLED)
  release: 0.2, // tongue swings clear of the crosshead (MODELLED)
  travel: 2.0, // contact travel under the disc springs (MODELLED, so the three add up to the brochure's ~3 ms)
  commute: 0.12, // arc current time constant once the metal path is closed (MODELLED)
  cbOpen: 55, // upstream circuit breaker: relay trip to interruption, typical MV vacuum breaker (MODELLED, typ.)
};
export function events(det = 1.0) {
  const coil = det + T.coil;
  const strike = coil + T.strike;
  const release = strike + T.release;
  const close = release + T.travel;
  return {det, coil, strike, release, close, out: close + 5 * T.commute, cb: det + T.cbOpen};
}

// ------------------------------------------------------------ the drive (MODELLED)
// A disc spring stack pushes the crosshead, the contact rod with it, forward. Charged it is held back by the latch
// tongue; released, the moving mass m runs out under a linear spring k from compression A: x = A (1 - cos wt). The
// angle at contact touch is 85 deg, so the stack still presses the closed contact with k (A - L).
export const DRIVE = {
  L: 0.018, // contact travel
  m: 1.2, // kg moving mass: contact rod, crosshead, a third of the discs
  thEnd: (85 * Math.PI) / 180,
  discs: 20, // discs in series, alternating
  discOD: 0.08,
  discID: 0.041,
  discT: 0.0035,
  discH: 0.0018, // free cone height
  pitch: 0.0025, // charging thread pitch
  freeTurns: 2, // lost motion before the tool picks up the spring
  rEff: 0.0058, // m, torque per newton of spring force through the thread (friction included)
};
DRIVE.A = DRIVE.L / (1 - Math.cos(DRIVE.thEnd));
DRIVE.w = DRIVE.thEnd / (T.travel / 1000);
DRIVE.k = DRIVE.m * DRIVE.w * DRIVE.w;
DRIVE.Fcharged = DRIVE.k * DRIVE.A;
DRIVE.Fclosed = DRIVE.k * (DRIVE.A - DRIVE.L);
DRIVE.energy = 0.5 * DRIVE.k * (DRIVE.A ** 2 - (DRIVE.A - DRIVE.L) ** 2);
DRIVE.vClose = DRIVE.A * DRIVE.w * Math.sin(DRIVE.thEnd);
DRIVE.loadTurns = DRIVE.L / DRIVE.pitch;
DRIVE.turns = DRIVE.freeTurns + DRIVE.loadTurns;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};

/** contact travel 0..L (m) and speed (m/s) at tau ms after ignition, for a released latch at `release` */
export function stroke(tau, ev) {
  if (tau <= ev.release) return {x: 0, v: 0};
  const s = (tau - ev.release) / 1000;
  const th = Math.min(DRIVE.thEnd, DRIVE.w * s);
  if (th >= DRIVE.thEnd) return {x: DRIVE.L, v: 0};
  return {x: DRIVE.A * (1 - Math.cos(th)), v: DRIVE.A * DRIVE.w * Math.sin(th)};
}
/** coil armature 0..1 (1 = pulled in; the coil is not drawn), latch tongue lift 0..1 (1 = clear of the lip) */
export function trigger(tau, ev) {
  const plunger = tau < ev.coil ? 0 : smooth((tau - ev.coil) / T.strike) ** 1.6;
  const tongue = tau < ev.strike ? 0 : smooth((tau - ev.strike) / T.release);
  return {plunger, tongue, coil: tau >= ev.coil && tau < ev.close + 1.5};
}

// ------------------------------------------------------------ the fault current (SOURCED: 31.5 kA rms, 80 kA peak)
// Each phase: the prospective short-circuit current with full DC offset, X/R 17 (time constant 54 ms), which puts
// the first peak of L1 at ~80 kA, the brochure's test current. The arc carries it until the earth path closes.
const W = 2 * Math.PI * DEV.f;
const TDC = 17 / W; // s
const PHI = Math.atan(17);
export const prospective = (tau, ph = 0) => {
  const t = tau / 1000;
  const a = (-ph * 2 * Math.PI) / 3;
  return Math.SQRT2 * DEV.Ik * (Math.sin(W * t + a - PHI) - Math.sin(a - PHI) * Math.exp(-t / TDC));
};
/** kA in the arc and in the SIQuench earth path for phase ph; quench false = no SIQuench, the arc burns to the CB */
export function currents(tau, ev, quench = true, ph = 0) {
  if (tau < 0) return {arc: 0, earth: 0, total: 0};
  const cbK = tau < ev.cb ? 1 : Math.exp(-(tau - ev.cb) / 0.4);
  const total = prospective(tau, ph) * cbK;
  if (!quench || tau < ev.close) return {arc: total, earth: 0, total};
  const k = Math.exp(-(tau - ev.close) / T.commute);
  return {arc: total * k, earth: total * (1 - k), total};
}

// ------------------------------------------------------------ compartment overpressure (MODELLED, fitted to the brochure)
// dp/dt = k P(t) - p / tc before the relief flap opens (heat in from the arc, heat out to the walls, tc 7 ms); past
// 135 kPa the flap opens over 1.5 ms and 70 % of the arc heat leaves with the gas. Arc power ~ sum of |i| over the phases (arc
// voltage taken constant). Tuned so the unprotected curve peaks near 140 kPa at ~10 ms and falls to ~20 kPa, the
// brochure's sample for 80 kA peak / 31.5 kA rms; the quenched curve then follows from the same equation.
export const PRESS = {k: 0.24, tc: 7, flap: 135, flapT: 1.5, vent: 50, keep: 0.3};
const P = PRESS;
const DT = 0.01;
const TAB_MAX = 90;
function integrate(det, quench) {
  const ev = events(det);
  const n = Math.round(TAB_MAX / DT) + 1;
  const p = new Float32Array(n);
  const i2t = new Float32Array(n);
  let pp = 0;
  let open = -1;
  let e = 0;
  for (let j = 1; j < n; j++) {
    const tau = j * DT;
    let pw = 0;
    for (let ph = 0; ph < 3; ph++) pw += Math.abs(currents(tau, ev, quench, ph).arc);
    const a1 = currents(tau, ev, quench, 0).arc;
    e += a1 * a1 * (DT / 1000);
    if (open < 0 && pp > P.flap) open = tau;
    const f = open < 0 ? 0 : clamp01((tau - open) / P.flapT);
    const dp = P.k * pw * (1 - (1 - P.keep) * f) - pp / P.tc - (f * pp) / P.vent;
    pp = Math.max(0, pp + dp * DT);
    p[j] = pp;
    i2t[j] = e;
  }
  return {p, i2t, flap: open};
}
const CACHE = new Map();
export const resetCurves = () => CACHE.clear();
export function curves(det = 1.0) {
  const key = det.toFixed(2);
  if (!CACHE.has(key)) CACHE.set(key, {on: integrate(det, true), off: integrate(det, false)});
  return CACHE.get(key);
}
const look = (arr, tau) => {
  const u = Math.min(arr.length - 1.001, Math.max(0, tau / DT));
  const i = Math.floor(u);
  return arr[i] + (arr[i + 1] - arr[i]) * (u - i);
};
/** kPa overpressure and arc I2t (kA2s, phase L1) at tau, with and without SIQuench */
export function pressure(tau, det = 1.0) {
  const c = curves(det);
  return {on: look(c.on.p, tau), off: look(c.off.p, tau), i2tOn: look(c.on.i2t, tau), i2tOff: look(c.off.i2t, tau)};
}
export const PRESSURE_MAX_T = TAB_MAX;

// ------------------------------------------------------------ the recharge (SOURCED sequence, manual 11.2; MODELLED torque)
// k 0..1 for one pole: the tool slides into the actuation opening, turns clockwise to the stop (the spring is drawn
// back, the contact opens, the tongue drops behind the crosshead), turns back out and is withdrawn.
export const CHARGE = {insert: [0, 0.14], wind: [0.14, 0.7], unwind: [0.7, 0.88], out: [0.88, 1]};
const span = (k, [a, b]) => clamp01((k - a) / (b - a));
export function charge(k) {
  const ins = smooth(span(k, CHARGE.insert)) - smooth(span(k, CHARGE.out));
  const wind = span(k, CHARGE.wind);
  const unwind = span(k, CHARGE.unwind);
  const turns = DRIVE.turns * (wind - unwind);
  // the lost motion first, then the pitch draws the crosshead back
  const drawn = Math.min(DRIVE.L, Math.max(0, (DRIVE.turns * wind - DRIVE.freeTurns) * DRIVE.pitch));
  const latched = wind >= 1;
  const force = latched ? DRIVE.Fcharged : DRIVE.k * (DRIVE.A - DRIVE.L + drawn);
  // friction while the lost motion is taken up, the spring after; at the stop the torque climbs to the manual's 100 Nm
  let torque = wind > 0 && unwind <= 0 ? (drawn <= 0 ? 2.5 : force * DRIVE.rEff) : unwind > 0 && unwind < 1 ? 1.5 : 0;
  if (wind > 0.97 && unwind <= 0) torque = Math.min(DEV.toolTorque, torque + ((wind - 0.97) / 0.03) * (DEV.toolTorque - torque));
  return {
    inserted: ins, // 0..1 how far the tool is in
    seated: k >= CHARGE.insert[1] && k < CHARGE.out[0] + 0.02, // the tool is fully in: mechanical interlock active
    turns, // tool rotation in turns (clockwise positive)
    x: DRIVE.L - drawn, // contact travel from open (L = closed)
    latched,
    force,
    torque,
  };
}
/** the torque curve over the wind, for the chart: [turns, Nm] */
export const torqueCurve = (() => {
  const out = [];
  for (let i = 0; i <= 120; i++) {
    const k = CHARGE.wind[0] + (i / 120) * (CHARGE.wind[1] - CHARGE.wind[0]) * 0.9999;
    const c = charge(k);
    out.push([c.turns, c.torque]);
  }
  return out;
})();

// ------------------------------------------------------------ the controller's LEDs (SOURCED: manual Abb. 30-38)
// rows: Tripped (red per phase), Quencher Ready (green per phase), Trip Output (LED 1 green Unblocked, LED 3 red
// Blocked); general: Error, Diagnosis (yellow, blinking: action needed), Ready.
/** poles: [{closed, latched, tool}] -> {tripped:[3], ready:[3], unblocked, blocked, error, diag, run} */
export function leds(poles, blinkT = 0) {
  const tripped = poles.map((p) => p.closed);
  const ready = poles.map((p) => p.latched && !p.closed);
  const blocked = poles.some((p) => p.tool);
  const any = tripped.some(Boolean);
  return {tripped, ready, unblocked: !blocked, blocked, error: false, diag: any && Math.floor(blinkT * 2.5) % 2 === 0, diagOn: any, run: true};
}

// ------------------------------------------------------------ one pole's whole state
/**
 * The pose and the readouts for pole i: tau (ms after ignition, null = no event yet), the event's timing, and the
 * recharge progress kc (0..1, null = none running). After a recharge the pole is open and latched again.
 */
export function poleState(tau, ev, kc) {
  if (kc !== null && kc !== undefined) {
    const c = charge(kc);
    return {x: c.x, v: 0, plunger: 0, tongue: c.latched ? 0 : 1, coil: false, latched: c.latched, closed: c.x > DRIVE.L * 0.98, tool: c.seated, toolIn: c.inserted, toolTurns: c.turns, torque: c.torque, force: c.force};
  }
  if (tau === null || tau === undefined || tau < 0) return {x: 0, v: 0, plunger: 0, tongue: 0, coil: false, latched: true, closed: false, tool: false, toolIn: 0, toolTurns: 0, torque: 0, force: DRIVE.Fcharged};
  const s = stroke(tau, ev);
  const tr = trigger(tau, ev);
  const force = DRIVE.k * (DRIVE.A - s.x);
  return {x: s.x, v: s.v, plunger: tr.plunger, tongue: tr.tongue, coil: tr.coil, latched: tau < ev.release, closed: s.x >= DRIVE.L * 0.999, tool: false, toolIn: 0, toolTurns: 0, torque: 0, force};
}

/** the stage of the event, for the console's step list */
export const STEPS = [
  ['ign', 'ARC IGNITES', 'CABLE COMPARTMENT'],
  ['det', 'ARC DETECTED', 'LIGHT SENSOR → ARC FLASH RELAY'],
  ['coil', 'TRIGGER', 'CONTROLLER FIRES 3 TRIP COILS (X1)'],
  ['strike', 'LATCH PULLED', 'TONGUE LIFTS OFF THE LIP'],
  ['release', 'SPRINGS RELEASED', 'DISC STACK DRIVES THE ROD'],
  ['close', 'EARTHED', 'CONTACT TOUCHES · 3-PHASE SHORT'],
  ['out', 'ARC QUENCHED', 'CURRENT IN THE METAL PATH'],
  ['cb', 'CB CLEARS', 'UPSTREAM BREAKER INTERRUPTS'],
];
export const stepAt = (tau, ev) => {
  if (tau === null || tau < 0) return -1;
  const at = {ign: 0, ...ev};
  let k = 0;
  STEPS.forEach(([id], i) => {
    if (tau >= at[id]) k = i;
  });
  return k;
};
