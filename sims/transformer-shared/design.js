// From one catalog row to a full design. The catalog fixes what the outside world sees: rating, voltages, insulation,
// uk, no-load and load losses, noise, weight and the length / width / height. A catalog does not publish the inside
// (turns, core, windings), so it is designed here with ordinary design rules and fitted so that the model reproduces
// the catalog: volts per turn from the rating; the flux density solved so the core's losses equal P0; the conductor
// sections sized so the I²R losses at 120 °C equal Pk; the main duct sized so the leakage reactance gives uk; the
// coil height and the limb pitch taken from the catalog's height and length. The weight is left free and serves as
// the check. Units: mm for geometry, SI for the rest.
import {truckFor} from './catalog.js';

export const STEPS = 7;
// the stepped limb: step k (0 = widest) spans ±a_k across the sheets and ±b_k through the stack, inside a unit circle
export const STEP = Array.from({length: STEPS}, (_, k) => {
  const ph = ((k + 0.5) / STEPS) * (Math.PI / 2);
  return [Math.cos(ph), Math.sin(ph)];
});
const UNIT_AREA = (() => {
  let A = 0;
  let b0 = 0;
  for (const [a, b] of STEP) {
    A += 4 * a * (b - b0);
    b0 = b;
  }
  return A;
})();
export const FILL = UNIT_AREA / Math.PI;

const F = 50;
const MU0 = 4e-7 * Math.PI;
const RHO_AL = 2.82e-8 * (1 + 0.00403 * 100); // aluminium at 120 °C, the catalog's reference for Pk
const RHO_AL20 = 2.82e-8;
const STACK = 0.96;
const D_FE = 7650;
const D_AL = 2700;
const D_RESIN = 1900; // epoxy with quartz flour
const D_ST = 7850;
// core steel, 0.27 mm grain-oriented (about M100-27P): specific loss and specific apparent power at 50 Hz
const pFe = (B) => 0.98 * Math.pow(B / 1.7, 2.1);
const qFe = (B) => 0.25 + 1.15 * Math.pow(B / 1.7, 8);
const BF_P = 1.35; // building factor on losses (three-limb, step-lap)
const BF_Q = 2.5; // and on magnetising VA, joints included
const B_SAT = 2.03;

// insulation class by HV voltage: main duct, phase-to-phase coil gap, resin wall, coil end clearance, disc count,
// gap between discs, and the manual's minimum clearance on the HV side (column a, LI per catalog)
const CLS = {
  10: {um: 12, a12: 22, phase: 30, wall: 7, end: 45, discs: 10, gapD: 10},
  20: {um: 24, a12: 38, phase: 50, wall: 9, end: 75, discs: 14, gapD: 10},
  30: {um: 36, a12: 55, phase: 75, wall: 11, end: 105, discs: 18, gapD: 9},
};
const CLEAR = {75: 120, 95: 160, 125: 220, 145: 270, 170: 320};
// frame channels stand this far above and below the yoke, more on the big units
const frameMargin = (rc) => 10 + 0.1 * rc;

/** bisection on a monotone function: the x in [lo, hi] where fn(x) = target */
function solve(fn, target, lo, hi, n = 50) {
  const up = fn(hi) > fn(lo);
  for (let i = 0; i < n; i++) {
    const m = (lo + hi) / 2;
    if (fn(m) > target === up) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

export function makeDesign(row, {group = 'Dyn5'} = {}) {
  const c = CLS[row.U1];
  const tr = truckFor(row.S);
  const S = row.S * 1e3;
  const U1 = row.U1 * 1e3;
  const U2 = row.U2 * 1e3;
  const U2ph = U2 / Math.sqrt(3);
  const I2 = S / (Math.sqrt(3) * U2); // LV phase = line current (star)
  const I1w = S / (3 * U1); // HV winding current inside the delta
  // volts per turn: every LV turn count from about 0.35 to 0.9 · √S volts per turn is tried; for each the flux
  // density is solved for P0, and the count whose total weight lands on the catalog's wins (flux densities outside
  // 1.3-1.72 T and missed uk or length cost extra)
  const lvGap = U2 > 1000 ? 18 : 12;
  const lvDuct = 10;
  const ur = (row.Pk / S) * 100;
  const uxT = Math.sqrt(Math.max(0.5, row.uk * row.uk - ur * ur));
  const at = (N2) => {
    const et = U2ph / N2;
    const N1 = Math.round(U1 / et);
    const phi = et / (4.44 * F);
    const a1 = STEP[0][0];

    // everything that follows from a flux density B
    const build = (B) => {
      const Anet = phi / B;
      const rc = Math.sqrt(Anet / STACK / UNIT_AREA) * 1000;
      const yokeH = 2 * a1 * rc;
      const truckH = tr.f + tr.k;
      const win = Math.max(300, row.h - truckH - 2 * (yokeH + frameMargin(rc)));
      const hc = win - 2 * c.end; // HV coil height
      const lvH = Math.min(win - 20, hc + 40);
      const ri2 = rc + lvGap;
      const P2 = 0.47 * row.Pk;
      const P1 = 0.47 * row.Pk; // the rest: eddy and stray losses
      // the windings for a main duct a12
      const wind = (a12) => {
        let b2 = 30;
        let A2 = 0;
        let lmt2 = 0;
        for (let i = 0; i < 4; i++) {
          lmt2 = (2 * Math.PI * (ri2 + b2 / 2)) / 1000;
          A2 = (3 * I2 * I2 * RHO_AL * N2 * lmt2) / P2;
          b2 = N2 * ((A2 / (lvH / 1000)) * 1000 + 0.15) + lvDuct + 3;
        }
        const t2 = (A2 / (lvH / 1000)) * 1000;
        const ro2 = ri2 + b2;
        const ri1 = ro2 + a12;
        const hd = (hc - 2 * c.wall - (c.discs - 1) * c.gapD) / c.discs;
        let b1 = 40;
        let A1 = 0;
        let lmt1 = 0;
        for (let i = 0; i < 4; i++) {
          lmt1 = (2 * Math.PI * (ri1 + b1 / 2)) / 1000;
          A1 = (3 * I1w * I1w * RHO_AL * N1 * lmt1) / P1;
          b1 = (N1 / c.discs) * ((A1 / (hd / 1000)) * 1000 + 0.08) + 2 * c.wall;
        }
        const t1 = (A1 / (hd / 1000)) * 1000;
        const ro1 = ri1 + b1;
        // leakage reactance of two concentric windings, Rogowski-corrected
        const Dm = (2 * (ro2 + a12 / 2)) / 1000;
        const sig = (a12 + (b1 - 2 * c.wall + b2) / 3) / 1000;
        const wsum = (a12 + b1 + b2) / 1000;
        const h = hc / 1000;
        const KR = 1 - ((1 - Math.exp((-Math.PI * h) / wsum)) * wsum) / (Math.PI * h);
        const ux = ((2 * Math.PI * F * MU0 * N2 * I2 * Math.PI * Dm * sig * KR) / (h * et)) * 100;
        return {a12, b2, t2, A2, lmt2, ro2, ri1, b1, t1, A1, lmt1, ro1, hd, ux};
      };
      const a12 = solve((a) => wind(a).ux, uxT, c.a12, 260);
      const w = wind(a12);
      // the coils stand a phase gap apart; the catalog length is the frame, which overhangs the yoke
      const pitchMin = 2 * w.ro1 + c.phase;
      const pitchCat = (row.a - 40 - 2 * a1 * rc) / 2;
      const pitch = pitchMin;
      const yokeLen = 2 * pitch + 2 * a1 * rc;
      const Mcore = D_FE * Anet * ((3 * win + 2 * yokeLen) / 1000);
      return {B, Anet, rc, yokeH, truckH, win, hc, lvH, ri2, w, pitch, pitchMin, pitchCat, yokeLen, Mcore, P0: Mcore * pFe(B) * BF_P};
    };
    // the flux density that makes the core's losses the catalog's P0
    const Bfit = solve((B) => build(B).P0, row.P0, 1.15, 1.85);
    const B = Math.min(1.8, Math.max(1.15, Bfit));
    const d = build(B);
    const w = d.w;

    // masses: core, aluminium, resin, steel frame and truck
    const M_lv = 3 * N2 * w.lmt2 * w.A2 * D_AL;
    const M_hv = 3 * N1 * w.lmt1 * w.A1 * D_AL;
    const hvVol = 3 * Math.PI * ((w.ro1 / 1000) ** 2 - (w.ri1 / 1000) ** 2) * (d.hc / 1000);
    const M_resin = Math.max(0, hvVol * D_RESIN - M_hv * (D_RESIN / D_AL)) * 0.92;
    const chArea = ((d.yokeH + 30) * 8 + 2 * 70 * 8) / 1e6; // C channel section, m²
    const M_frame = 4 * (row.a / 1000) * chArea * D_ST + 2 * (row.b / 1000) * 0.0025 * D_ST + 60;
    const mass = d.Mcore + M_lv + M_hv + M_resin + M_frame;

    // no-load current: the loss component from P0, the magnetising one from the core's VA
    const Ife = row.P0 / (Math.sqrt(3) * U1);
    const Sm = d.Mcore * qFe(B) * BF_Q;
    const Imag = Sm / (Math.sqrt(3) * U1);
    const I0 = Math.hypot(Ife, Imag);
    const I1 = S / (Math.sqrt(3) * U1);
    // inrush, worst case: switched on at voltage zero with remanence 0.8 B in the same sense; the core saturates and the
    // HV winding acts as an air coil over its own mean area. Peak winding current against the rated winding peak.
    const rm1 = (w.ri1 + w.b1 / 2) / 1000;
    const Lair = (MU0 * N1 * N1 * Math.PI * rm1 * rm1) / (d.hc / 1000);
    const Br = 0.8 * B;
    const iPk = ((Math.SQRT2 * U1) / (2 * Math.PI * F * Lair)) * ((2 * B + Br - B_SAT) / (2 * B));
    const R1 = (RHO_AL20 * N1 * w.lmt1) / w.A1;
    const inrush = {peak: iPk, ratio: iPk / (Math.SQRT2 * I1w), tau: Lair / R1};
    const J2 = I2 / (w.A2 * 1e6);
    const J1 = I1w / (w.A1 * 1e6);
    const ukModel = Math.hypot(ur, w.ux);
    const flags = [];
    if (Bfit > 1.8 || Bfit < 1.15) flags.push(`flux density would be ${Bfit.toFixed(2)} T to meet P0; held at ${B.toFixed(2)} T`);
    if (Math.abs(ukModel - row.uk) > 0.15) flags.push(`uk ${ukModel.toFixed(1)} % (the main duct hit its limit)`);
    if (d.pitchMin > d.pitchCat + 1) flags.push(`coils need ${Math.round(2 * d.pitchMin + 2 * a1 * d.rc + 40)} mm of length, catalog ${row.a}`);


    return {N2, et, N1, B, Bfit, d, w, M_lv, M_hv, M_resin, M_frame, mass, Ife, Imag, I0, inrush, J1, J2, ukModel, flags};
  };
  const lo = Math.max(4, Math.floor(U2ph / (0.9 * Math.sqrt(row.S))));
  const hi = Math.ceil(U2ph / (0.35 * Math.sqrt(row.S)));
  let best = null;
  for (let n = lo; n <= hi; n++) {
    const t = at(n);
    const score =
      Math.abs(t.mass - row.mass) / row.mass +
      Math.max(0, 1.3 - t.Bfit) * 3 +
      Math.max(0, t.Bfit - 1.72) * 3 +
      (2 * Math.abs(t.ukModel - row.uk)) / row.uk +
      Math.max(0, t.d.pitchMin - t.d.pitchCat) / 200;
    if (!best || score < best.score) best = {...t, score};
  }
  const {N2, et, N1, B, d, w, M_lv, M_hv, M_resin, M_frame, mass, Ife, Imag, I0, inrush, J1, J2, ukModel, flags} = best;
  const I1 = S / (Math.sqrt(3) * U1);
  const a1 = STEP[0][0];
  const lim = Number(row.insHV.split('/')[1]);
  const R = {
    S,
    S_AF: 1.5 * S,
    U1,
    U2,
    f: F,
    group,
    clock: group === 'Dyn11' ? 11 : 5,
    N2,
    N1,
    discs: c.discs,
    uk: row.uk,
    P0: row.P0,
    Pk: row.Pk,
    Bpk: B,
    LWA: row.LWA,
    mass: row.mass,
    order: row.order,
    std: row.std,
    kva: row.S,
    insulation: `${row.insHV} / ${row.insLV}`,
    clearance: CLEAR[lim] ?? 120,
    um: c.um,
  };
  const G = {
    rc: d.rc,
    lv: {ri: d.ri2, layer: (w.b2 - lvDuct - 3) / 2, duct: lvDuct, h: d.lvH, ro: d.ri2 + w.b2, t: w.t2},
    hv: {ri: w.ri1, wall: c.wall, strip: w.b1 - 2 * c.wall, h: d.hc, ro: w.ro1, t: w.t1, hd: w.hd, gapD: c.gapD},
    mainDuct: w.a12,
    phaseGap: d.pitch - 2 * w.ro1,
    pitch: d.pitch,
    win: d.win,
    yokeTop: d.win / 2,
    limbX: [-d.pitch, 0, d.pitch],
    len: d.yokeLen,
    frameLen: row.a,
    width: row.b,
    truck: tr,
    truckH: d.truckH,
    frameMargin: frameMargin(d.rc),
    floor: -(d.win / 2 + d.yokeH + frameMargin(d.rc) + d.truckH),
  };
  const fit = {
    P0: [row.P0, d.P0],
    Pk: [row.Pk, row.Pk],
    uk: [row.uk, ukModel],
    mass: [row.mass, mass],
    length: [row.a, Math.max(row.a, 2 * d.pitchMin + 2 * a1 * d.rc + 40)],
    height: [row.h, d.win + 2 * (d.yokeH + frameMargin(d.rc)) + d.truckH],
    masses: {core: d.Mcore, lv: M_lv, hv: M_hv, resin: M_resin, frame: M_frame},
    B,
    et,
    J1,
    J2,
    I0: {A: I0, pct: (I0 / I1) * 100, fe: Ife, mag: Imag},
    inrush,
    flags,
  };
  return {R, G, fit, row};
}
