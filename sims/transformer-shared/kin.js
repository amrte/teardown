// The cast-resin transformer's numbers: the selected catalog design (design.js from catalog.js) and every readout as
// a function of the electrical angle θ (HV phase U, degrees), the load S (VA), the power factor, the HV tap and the
// grid voltage. No three.js in here. Geometry is in millimetres: limbs along x (U at −pitch, V at 0, W at +pitch),
// y up through the middle of the core window, z toward the HV connection side.
//
// Sources:
//  - Siemens catalog TV1 · 2013 (catalog.js): ratings, voltages, insulation, uk, P0, Pk at 120 °C, LWA, weight and
//    dimensions per order number; vector group Dyn5 (Dyn11 on request); HV taps ±2 × 2.5 %; fans raise the output by
//    up to 50 %, load losses go with the square of the load (p. 11); truck dimensions (p. 15)
//  - Siemens "GEAFOL Cast-Resin Transformers — Planning Guidelines" (2015): the room-loss formula
//    Pv = P0 + 1.1 · Pk120 · (S/S_AN)² (p. 12), 200 m³/h of air per kW at 15 K (pp. 13-14), the stray field (p. 23)
//  - Siemens "Operating Manual for Cast-resin Dry Type Distribution Transformer": tap links 3 4 5 over 8 7 6
//    (5-6 +5 %, 4-6 +2.5 %, 4-7 rated, 3-7 −2.5 %, 3-8 −5 %), changed de-energised on all three phases (p. 21); delta
//    tubes U-V-W above, V-W-U below (p. 12); PT100 controller fan on 100, fan off 80, alarm 130, trip 150 °C (p. 18);
//    minimum HV-side clearances (p. 17); inrush 6-8 × rated current (p. 21)
// The inside of each design (turns, core, windings) is generated and fitted to the catalog row in design.js.
import {DEFAULT_ORDER, findRow} from './catalog.js';
import {makeDesign, STEP as STEP_} from './design.js';

export const STEP = STEP_;
// the selected design's rating block and geometry; setDesign() refills them in place so every importer sees the change
export const R = {
  amb: 20, // ambient, °C (the guide's annual average)
  riseW: 100, // winding rise at rated load where the PT100 sits: class F average (IEC 60076-11)
  hsFactor: 1.15, // hot spot over that: 155 °C class F hot spot at 40 °C ambient is 115 K
  qAN: 0.8, // loading-guide exponents on the loss ratio
  qAF: 0.9,
  tc: {fanOn: 100, fanOff: 80, alarm: 130, trip: 150}, // PT100 controller settings, °C (manual 7.1.1)
  tau: 40, // winding thermal time constant, minutes
  steps: STEP_.length,
};
export const G = {};
export const CUR = {D: null, key: ''};
// HV tappings: one link per phase between a stud of the top row (3 4 5) and one of the bottom row (8 7 6). The tapping
// turns sit in the middle of the HV winding; the link decides how many of them are in circuit. A higher tap voltage
// means more turns, so the same grid gives a lower LV.
export const TAPS = [
  {link: [3, 8], pct: -5, V: 0},
  {link: [3, 7], pct: -2.5, V: 0},
  {link: [4, 7], pct: 0, V: 0},
  {link: [4, 6], pct: 2.5, V: 0},
  {link: [5, 6], pct: 5, V: 0},
];
export const TAP0 = 2; // 4-7, the factory setting
export const tapName = (i) => TAPS[i].link.join('-');
export const tapTurns = (i) => Math.round((R.N1 * TAPS[i].V) / R.U1);
export const GRID = [0, 0]; // the grid voltage range the page offers, V: the tap range
export const coreD = () => 2 * G.rc;

/** make design D the current one: rating block, geometry, taps and grid range follow */
export function setDesign(D) {
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, D.G);
  Object.assign(R, D.R);
  for (const t of TAPS) t.V = R.U1 * (1 + t.pct / 100);
  GRID[0] = R.U1 * 0.95;
  GRID[1] = R.U1 * 1.05;
  CUR.D = D;
  CUR.key = `${R.order}-${R.group}`;
}
/** the design for an order number and vector group, cached */
const cache = new Map();
export function designFor(order = DEFAULT_ORDER, group = 'Dyn5') {
  const key = `${order}-${group}`;
  if (!cache.has(key)) cache.set(key, makeDesign(findRow(order) ?? findRow(DEFAULT_ORDER), {group}));
  return cache.get(key);
}
setDesign(designFor());

// ------------------------------------------------------------ electrical state
const D2R = Math.PI / 180;
const sin = (d) => Math.sin(d * D2R);
const cos = (d) => Math.cos(d * D2R);
export const PHASES = ['U', 'V', 'W'];
// The HV winding on limb k lies across lines k and k+1, so its voltage leads HV phase k by 30°; the flux lags its
// winding voltage by 90°. The LV phase on the same limb is that voltage (Dyn11: LV leads by 30°) or, with the LV
// winding's ends swapped at the star point, its opposite (Dyn5: LV lags by 150°).
export const SHIFT = 30;
export const limbAngle = (th, k) => th + SHIFT - k * 120;
export const lvShift = () => (R.clock === 5 ? SHIFT - 180 : SHIFT);
/** peak flux density at grid voltage Ug on tap tap: volts per turn set the flux (fewer turns or more volts → more) */
export const bPeak = (tap = TAP0, Ug = R.U1) => R.Bpk * (Ug / R.U1) * (R.N1 / tapTurns(tap));
/** flux density in limb k at angle th */
export const bLimb = (th, k, tap = TAP0, Ug = R.U1) => bPeak(tap, Ug) * sin(limbAngle(th, k));

/** everything the panels read for load S (VA), power factor pf, tap index, grid voltage Ug (V) */
export function operating(S, pf = 0.9, tap = TAP0, Ug = R.U1) {
  const K = S / R.S;
  const N1 = tapTurns(tap);
  const ur = (R.Pk / R.S) * 100;
  const ux = Math.sqrt(R.uk * R.uk - ur * ur);
  const sphi = Math.sqrt(Math.max(0, 1 - pf * pf));
  // IEC 60076-1 regulation for a lagging load, %
  const du = K * (ur * pf + ux * sphi) + (K * (ux * pf - ur * sphi)) ** 2 / 200;
  const U2nl = (Ug * R.N2 * Math.sqrt(3)) / N1; // no-load LV line voltage at this grid voltage and tap
  const U2 = U2nl * (1 - du / 100);
  const B = bPeak(tap, Ug);
  const P0 = R.P0 * (B / R.Bpk) ** 2; // iron losses go roughly with B²
  const Pcu = K * K * R.Pk;
  const Pout = S * pf;
  return {
    K,
    N1,
    U2nl,
    U2,
    du,
    U2ph: U2 / Math.sqrt(3),
    I1: S / (Math.sqrt(3) * Ug), // HV line current
    I1w: S / (3 * Ug), // HV winding current inside the delta
    Ug,
    I2: S / (Math.sqrt(3) * U2), // LV line = phase current
    B,
    P0,
    Pcu,
    Ploss: P0 + Pcu,
    eta: Pout > 0 ? Pout / (Pout + P0 + Pcu) : 0,
    // the guide's heat to remove from the room and the air it takes at 15 K rise
    Proom: P0 + 1.1 * Pcu,
    air: ((P0 + 1.1 * Pcu) / 1000 / (1.015 * 1.18 * 15)) * 3600,
    // stray field at 3 m (guide, p. 23), scaled by the load current
    stray: 5 * (R.uk / 6) * Math.sqrt(R.S / 1000 / 630) * K,
    phi: Math.acos(pf) / D2R,
  };
}
/** instantaneous values on limb k: LV phase voltage, LV current, HV winding current (all per unit of their peak) */
export const wave = (th, k, phi = 25.8) => {
  const a = th + lvShift() - k * 120;
  return {v: cos(a), i: cos(a - phi)};
};

// ------------------------------------------------------------ heat
// The state's hs is the winding temperature the PT100 reads; the hot spot runs R.hsFactor higher over ambient.
/** steady-state winding rise at the PT100 in K for load S and fan level 0..1 (the fans blend AN into AF) */
export function windRise(S, fan = 0) {
  const K = S / R.S;
  // the windings see their own losses and a fifth of the core's
  const c = (0.2 * R.P0) / R.Pk;
  const an = R.riseW * Math.pow((c + K * K) / (c + 1), R.qAN);
  const kAF = (R.S_AF / R.S) ** 2; // with fans: 1.5 × the rating, 2.25 × the load losses
  const af = R.riseW * Math.pow((c + K * K) / (c + kAF), R.qAF);
  return an + (af - an) * fan;
}
export const hotSpot = (tw) => R.amb + (tw - R.amb) * R.hsFactor;
/** one thermal step: state {hs, fan, fanOn, trip}, load S, dt in screen seconds, tauS the screen time constant;
 *  the controller runs the fans between 100 and 80 °C and trips at 150 °C */
export function stepHeat(st, S, dt, tauS) {
  const target = R.amb + windRise(S, st.fan);
  st.hs += (target - st.hs) * (1 - Math.exp(-dt / tauS));
  if (!st.fanOn && st.hs >= R.tc.fanOn) st.fanOn = true;
  else if (st.fanOn && st.hs <= R.tc.fanOff) st.fanOn = false;
  st.fan += ((st.fanOn ? 1 : 0) - st.fan) * (1 - Math.exp(-dt / 0.6));
  if (st.hs >= R.tc.trip) st.trip = true;
  return st;
}
/** winding temperature along the height, 0 bottom .. 1 top: dry windings run hottest near the top */
export const tempAlong = (hs, y) => {
  const rise = hs - R.amb;
  return R.amb + rise * (0.45 + 0.55 * Math.sin(Math.min(1, y / 0.85) * Math.PI * 0.5));
};
/** natural-draught air speed through the ducts (m/s) from the rise, plus the fans */
export const airSpeed = (hs, fan) => 0.12 * Math.sqrt(Math.max(0, hs - R.amb)) + 1.6 * fan;
