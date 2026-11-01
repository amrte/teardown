// The cast-resin transformer's numbers: one rating block, the core and winding geometry derived from it, and every
// readout as a function of the electrical angle θ (HV phase U, degrees), the load S (VA), the power factor and the HV
// tap. No three.js in here. Geometry is in millimetres: limbs along x (U at −pitch, V at 0, W at +pitch), y up through
// the middle of the core window, z toward the HV connection side.
//
// Sources: Siemens "GEAFOL Cast-Resin Transformers — Planning Guidelines" (2015) for the 1000 kVA figures:
//  - load losses 10 kW at 120 °C, 22.5 kW at the 1500 kVA forced-air rating (p. 11)
//  - 12.9 kW total losses per 1000 kVA unit in the ventilation example (p. 16) → no-load losses 12.9 − 1.1 × 10 = 1.9 kW
//    with the guide's room-loss formula Pv = P0 + 1.1 · Pk120 · (S/S_AN)² (p. 12)
//  - +50 % with cross-flow fans, cooling AN → AF (p. 11); PTC sensors in the LV windings, alarm and trip 20 K apart,
//    relay resets 3 K below its response temperature (p. 10)
//  - air 200 m³/h per kW at 15 K rise, Qv3 = V · c · ρ · Δθ (pp. 13-14); stray field formula (p. 23); 2,630 kg (p. 21)
// Siemens "Operating Manual for Cast-resin Dry Type Distribution Transformer" for how the unit is connected and run:
//  - nameplate 10000 V / 690 V, Dyn11, AN/AF, thermal class F/F, E2/C2/F1, insulation LI75 AC28 / AC3 (p. 6)
//  - off-circuit tap links on every HV coil: studs 3 4 5 over 8 7 6, one link per phase, 5-6 10500 V, 4-6 10250 V,
//    4-7 10000 V (factory setting), 3-7 9750 V, 3-8 9500 V; changed only de-energised, all three phases alike (p. 21)
//  - delta tubes: upper terminals carry U-V-W, lower terminals V-W-U (p. 12)
//  - PT100 temperature controller: fan on 100 °C, fan off 80 °C, alarm 130 °C, trip 150 °C (p. 18)
//  - minimum clearance on the HV side for Um 12 kV, LI 75: 120 mm (p. 17); inrush 6-8 × rated current (p. 21)
// Everything else (turns, core diameter, radii) is a design worked out here to be consistent with those figures.

export const R = {
  S: 1000e3, // AN rating, VA
  S_AF: 1500e3, // with fans (AF)
  U1: 10000, // HV line voltage, delta
  U2: 690, // LV line voltage at no load, star with neutral
  f: 50,
  group: 'Dyn11',
  N2: 20, // LV turns: aluminium foil
  N1: 502, // HV turns at the principal tap: aluminium strip in 10 discs
  discs: 10,
  uk: 6.0, // short-circuit impedance, %
  P0: 1900, // no-load (iron) losses, W
  Pk: 10000, // load losses at rated current and 120 °C, W
  Bpk: 1.6, // peak flux density at the principal tap, T
  stack: 0.96, // lamination stacking factor
  steps: 7, // core steps
  amb: 20, // ambient, °C (the guide's annual average)
  riseW: 100, // winding rise at rated load where the PT100 sits: class F average (IEC 60076-11)
  hsFactor: 1.15, // hot spot over that: 155 °C class F hot spot at 40 °C ambient is 115 K
  qAN: 0.8, // loading-guide exponents on the loss ratio
  qAF: 0.9,
  tc: {fanOn: 100, fanOff: 80, alarm: 130, trip: 150}, // PT100 controller settings, °C (manual 7.1.1)
  tau: 40, // winding thermal time constant, minutes
  mass: 2630,
  insulation: 'LI75 AC28 / AC3',
  clearance: 120, // mm, HV side with tappings, Um 12 kV LI 75
};
// HV tappings: one link per phase between a stud of the top row (3 4 5) and one of the bottom row (8 7 6). The tapping
// turns sit in the middle of the HV winding; the link decides how many of them are in circuit. A higher rated HV
// voltage means more turns, so the same grid gives a lower LV.
export const TAPS = [
  {link: [3, 8], pct: -5, V: 9500},
  {link: [3, 7], pct: -2.5, V: 9750},
  {link: [4, 7], pct: 0, V: 10000},
  {link: [4, 6], pct: 2.5, V: 10250},
  {link: [5, 6], pct: 5, V: 10500},
];
export const TAP0 = 2; // 4-7, the factory setting
export const tapName = (i) => TAPS[i].link.join('-');
export const tapTurns = (i) => Math.round((R.N1 * TAPS[i].V) / R.U1);
export const GRID = [9500, 10500]; // the grid voltage range the page offers, V

// ------------------------------------------------------------ core
const D2R = Math.PI / 180;
export const VPT = R.U1 / R.N1; // volts per turn at the principal tap
export const PHI = VPT / (4.44 * R.f); // peak flux, Wb
export const A_NET = PHI / R.Bpk; // net iron cross-section, m²
// the stepped limb: step k (0 = widest) spans ±a_k across and ±b_k deep inside a circle of radius 1
export const STEP = Array.from({length: R.steps}, (_, k) => {
  const ph = ((k + 0.5) / R.steps) * 90 * D2R;
  return [Math.cos(ph), Math.sin(ph)];
});
// gross area of the stepped section for a unit circle: the outline's area
const unitArea = (() => {
  let A = 0;
  let b0 = 0;
  for (const [a, b] of STEP) {
    A += 4 * a * (b - b0); // a quadrant strip, four quadrants
    b0 = b;
  }
  return A;
})();
export const FILL = unitArea / Math.PI; // step fill of the circle
export const CORE_D = 2 * Math.sqrt(A_NET / R.stack / unitArea) * 1000; // core circle diameter, mm

// ------------------------------------------------------------ windings and frame, mm
export const G = (() => {
  const rc = CORE_D / 2;
  const lv = {ri: rc + 12, layer: 12, duct: 10, h: 740};
  lv.ro = lv.ri + 2 * lv.layer + lv.duct + 3;
  const mainDuct = 30;
  const hv = {ri: lv.ro + mainDuct, wall: 8, strip: 30, h: 690};
  hv.ro = hv.ri + 2 * hv.wall + hv.strip;
  const pitch = Math.round(2 * hv.ro + 36);
  const win = 800;
  return {
    rc,
    lv,
    hv,
    mainDuct,
    pitch,
    win, // window height
    yokeTop: win / 2, // underside of the top yoke
    limbX: [-pitch, 0, pitch],
    len: 2 * pitch + 2 * rc, // yoke length
    floor: -(win / 2 + 2 * rc + 120 + 62), // skid 120, wheel radius 62
  };
})();

// ------------------------------------------------------------ electrical state
const sin = (d) => Math.sin(d * D2R);
const cos = (d) => Math.cos(d * D2R);
export const PHASES = ['U', 'V', 'W'];
// Dyn11: the HV winding on limb k lies across lines k and k+1, so its voltage (and the LV phase on the same limb)
// leads HV phase k by 30°. The flux lags its winding voltage by 90°.
export const SHIFT = 30;
export const limbAngle = (th, k) => th + SHIFT - k * 120;
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
export const wave = (th, k, phi = 25.8) => ({v: cos(limbAngle(th, k)), i: cos(limbAngle(th, k) - phi)});

// ------------------------------------------------------------ heat
// The state's hs is the winding temperature the PT100 reads; the hot spot runs R.hsFactor higher over ambient.
/** steady-state winding rise at the PT100 in K for load S and fan level 0..1 (the fans blend AN into AF) */
export function windRise(S, fan = 0) {
  const K = S / R.S;
  // the windings see their own losses and a fifth of the core's
  const c = (0.2 * R.P0) / R.Pk;
  const an = R.riseW * Math.pow((c + K * K) / (c + 1), R.qAN);
  const kAF = (R.S_AF / R.S) ** 2; // 22.5 kW at 1500 kVA over 10 kW at 1000 kVA
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
