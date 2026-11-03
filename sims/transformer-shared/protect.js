// Monitoring and protection: every device the manual describes (p.37–43, 49–50) as a model with readings and contacts,
// the faults they have to catch, and the fuse coordination. One state, stepped in thermal minutes (dtMin) and real
// seconds (dtS, for the fast events), driven by the top-oil temperature and the faults switched on. No three.js.
//
// The manual gives the devices, the thermometer defaults (alarm 85 °C, trip 95 °C, 250 V contacts), the Buchholz test
// and contact numbers, the oil-level rule (1 cm ≈ 10 K, MIN = out of service), the silica-gel rule (light yellow =
// dry or replace), the PT100 wiring and the fuse rules (inrush 6–20 In for 100 ms, HV fuse ≈ 2 In, selectivity 1:2).
// It gives no setpoints for gas, pressure, oil surge or relief valve, no curves for the fuses: those are typical values
// marked `est` (PT100 to IEC 60751; fuse curves a generic shape for HRC back-up and gTr/gG fuses).
import {expansion, LIMITS} from './trafo.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export const SET = {
  thermoAlarm: {v: LIMITS.thermoAlarm, p: 41}, // °C
  thermoTrip: {v: LIMITS.thermoTrip, p: 41},
  thermoHyst: {v: 5, est: true}, // K contact reset
  levelMinCm: {v: -5, est: true}, // cm under the 20 °C mark: MIN on a free-breathing tank
  consMin: {v: 0.1, est: true}, // conservator fraction at MIN
  buchholzGasAlarm: {v: 200, est: true}, // ml collected
  buchholzSurgeTrip: {v: 1.0, est: true}, // m/s oil surge to the conservator
  buchholzCap: {v: 300, est: true}, // ml the relay holds before gas passes on
  dgptGasAlarm: {v: 20, est: true}, // ml
  dgptPressTrip: {v: 0.4, est: true}, // bar
  dgptLevelAlarm: {v: -0.1, est: true}, // bar: under-pressure in the sealed tank means fluid lost
  prvOpen: {v: 0.5, est: true}, // bar
  pressAt80: {v: 0.25, est: true}, // bar gauge at 80 °C top oil, hermetic (wave stiffness)
  leakRate: {v: 3, est: true}, // l/h at the drain valve
  gasRate: {v: 30, est: true}, // ml/h from a low-energy fault (hot joint, partial discharge)
  arcGas: {v: 3000, est: true}, // ml in the first fraction of a second
  arcSurge: {v: 2.5, est: true}, // m/s
  arcPress: {v: 0.9, est: true}, // bar spike in a hermetic tank
  coolFactor: {v: 1.45, est: true}, // oil rise × with the cooling air blocked
  gelCapacity: {v: 200, est: true}, // g water a 1 kg charge takes before it turns
  airWater: {v: 0.009, est: true}, // g water per litre of breathed air (20 °C, 55 % RH)
  leadOhm: {v: 0.34, est: true}, // Ω per lead: 10 m of 0.5 mm² copper
};
export const FAULTS = [
  {key: 'overload', name: 'OVERLOAD', text: 'Load set to 140 %: watch the thermometer contacts and the ageing', p: 52},
  {key: 'cooling', name: 'COOLING', text: 'Cell air inlet blocked: the oil rise goes up by about 45 % (est.)', p: 44},
  {key: 'leak', name: 'OIL LEAK', text: 'Drain valve weeping 3 l/h (est.): the level falls toward MIN', p: 38},
  {key: 'gassing', name: 'GASSING', text: 'Low-energy internal fault: 30 ml gas per hour (est.)', p: 39},
  {key: 'arc', name: 'INTERNAL ARC', text: 'Arc between turns: gas burst and oil surge — the gas and pressure relays must act', p: 39},
  {key: 'lvshort', name: 'LV SHORT', text: 'Three-phase short at the LV terminals: the HV fuse must clear it', p: 50},
];

/** Which devices this configuration carries (p.38–39) and what is always there. */
export function fitted(cfg) {
  const m = cfg.monitor;
  const d = cfg.design;
  const has = (k) => !!cfg.devices?.includes(k);
  return {
    thermo: true,
    contacts: m === 'contacts' || m === 'full' || has('contacts'),
    terminalBox: has('terminalbox'),
    pt100: m === 'pt100',
    level: m === 'level' || m === 'full' || d === 'conservator',
    reed: m === 'level' || m === 'full',
    dipstick: d === 'breathing',
    dgpt: m === 'full' && d === 'hermetic',
    prv: m === 'full' && d === 'hermetic',
    buchholz: m === 'buchholz' && d === 'conservator',
    breather: d === 'conservator',
    hvFuse: true,
    lvFuse: true,
  };
}

// ------------------------------------------------------------------------------------------------ PT100 (IEC 60751)
export const pt100R = (T) => 100 * (1 + 3.9083e-3 * T - 5.775e-7 * T * T);
/** The temperature error each connection adds for the given lead resistance (Ω per lead). */
export const pt100Err = (rLead = SET.leadOhm.v) => {
  const dRdT = 0.385;
  return {w2: (2 * rLead) / dRdT, w3: (0.05 * rLead) / dRdT, w4: 0};
};

// ------------------------------------------------------------------------------------------------ fuses
// time-current as (multiple of the fuse rating, seconds), log-log interpolated; est. generic shapes
const HRC = [[2.5, 3600], [3, 300], [4, 10], [6, 1], [10, 0.1], [20, 0.01], [40, 0.002]];
const GTR = [[1.3, 3600], [1.6, 900], [2, 120], [3, 15], [5, 1], [8, 0.1], [15, 0.01], [30, 0.002]];
export const FUSE_CURVE = {hv: HRC, lv: GTR};
/** Melting time (s) of a fuse of rating In at current I; Infinity below the curve. */
export function fuseTime(kind, I, In) {
  const c = FUSE_CURVE[kind];
  const m = I / In;
  if (m < c[0][0]) return Infinity;
  for (let i = 0; i < c.length - 1; i++) {
    const [m0, t0] = c[i];
    const [m1, t1] = c[i + 1];
    if (m <= m1) {
      const k = Math.log(m / m0) / Math.log(m1 / m0);
      return Math.exp(Math.log(t0) + k * (Math.log(t1) - Math.log(t0)));
    }
  }
  const [mL, tL] = c[c.length - 1];
  return tL * Math.pow(mL / m, 2);
}
/** The fuse coordination of a datasheet: ratings picked from the recommendation, the checks of p.49–50. */
export function coordination(sp) {
  const first = (a) => Number(String(a).split('/')[0].trim());
  const hvIn = first(sp.fuseHV.a);
  const lvIn = first(sp.fuseLV.a);
  const ratio = sp.un2 / (sp.un1 * 1000);
  const inrush = [6 * sp.i1, 20 * sp.i1];
  const tInrush = fuseTime('hv', inrush[1], hvIn);
  const iScHV = sp.isc1; // the HV line current with the LV terminals shorted
  const tSc = fuseTime('hv', iScHV, hvIn);
  // the LV fuse referred to the HV side, and the margin between the two at the LV fault current
  const tLvAtSc = fuseTime('lv', sp.isc2, lvIn);
  return {
    hvIn, lvIn, ratio, inrush, tInrush, inrushOk: tInrush > LIMITS.inrushMs / 1000,
    overloadOk: fuseTime('hv', 1.5 * sp.i1, hvIn) === Infinity, // carries the 150 % overload (p.49)
    iScHV, tSc, scOk: tSc <= 2, // clears the sustained LV short in time (2 s, est.)
    tLvAtSc, selective: tLvAtSc < tSc * 0.5,
    lvRefIn: lvIn * ratio,
  };
}

// ------------------------------------------------------------------------------------------------ the state
export function protInit(sp) {
  return {
    leakL: 0, gas: 0, gasBuch: 0, gasDgpt: 0, gasFree: 0, surge: 0, spike: 0, arcFlash: 0, bubbles: 0,
    sat: 0.08, tripped: null, fuseBlown: false, prvOpen: 0, prvVented: 0, contacts: {}, events: [],
    lastDV: null, scT: -1, arcT: -1,
  };
}
/**
 * One step. inp: {top (°C), energised, faults: {leak, gassing, cooling, overload}, arc (true on the step it strikes),
 * lvshort (true on its step), simMin}. Returns the new state; trips latch until reset().
 */
export function protStep(sp, st0, inp, dtMin, dtS) {
  const st = {...st0, contacts: {...st0.contacts}, events: st0.events};
  const f = fitted(sp.cfg);
  const log = (text, kind = 'info') => {
    st.events = [...st.events.slice(-7), {min: inp.simMin, text, kind}];
  };
  const on = inp.energised && !st.tripped && !st.fuseBlown;
  // fluid lost, gas made
  if (inp.faults.leak) st.leakL += (SET.leakRate.v * dtMin) / 60;
  let gasIn = 0;
  if (inp.faults.gassing && on) gasIn += (SET.gasRate.v * dtMin) / 60;
  if (inp.arc && on) {
    gasIn += SET.arcGas.v;
    st.surge = SET.arcSurge.v;
    st.spike = sp.cfg.design === 'hermetic' ? SET.arcPress.v : 0;
    st.arcFlash = 1;
    st.arcT = 0;
    log('Internal arc between turns: gas burst and oil surge, little extra line current', 'trip');
  }
  // an inter-turn arc the gas / pressure relays do not catch grows into a fault to earth: then the HV fuse clears it
  if (st.arcT >= 0) {
    st.arcT += dtS;
    if (st.arcT > 3 && !st.tripped && !st.fuseBlown) {
      st.fuseBlown = true;
      st.arcT = -1;
      log(`Arc escalated to earth (illustrative): HV fuse ${coordination(sp).hvIn} A clears the fault current`, 'trip');
    } else if (st.tripped || st.fuseBlown) st.arcT = -1;
  }
  if (inp.lvshort && on) {
    const c = coordination(sp);
    st.scT = c.tSc;
    st.fuseBlown = true;
    log(`LV short: ${c.iScHV.toFixed(0)} A on HV, fuse ${c.hvIn} A melts in ${c.tSc < 1 ? (c.tSc * 1000).toFixed(0) + ' ms' : c.tSc.toFixed(1) + ' s'}`, 'trip');
  }
  st.bubbles = Math.max(st.bubbles * Math.exp(-dtS / 1.5), inp.faults.gassing && on ? 0.35 : 0, inp.arc ? 1 : 0);
  st.arcFlash *= Math.exp(-dtS / 0.25);
  st.surge *= Math.exp(-dtS / 0.4);
  st.spike *= Math.exp(-dtS / 1.2);
  // where the gas collects: the Buchholz on its way to the conservator, the DGPT on a hermetic lid, else the air cushion
  if (gasIn > 0) {
    st.gas += gasIn;
    if (sp.cfg.design === 'conservator') {
      const room = SET.buchholzCap.v - st.gasBuch;
      st.gasBuch += Math.min(room, gasIn);
    } else if (sp.cfg.design === 'hermetic') st.gasDgpt += gasIn;
    else st.gasFree += gasIn;
  }
  // volumes and levels
  const ex = expansion(sp, inp.top);
  const net = ex.litres - st.leakL;
  const area = (sp.tank.li * sp.tank.bi) / 1e6; // m²: 10 l per cm per m²
  const levelCm = sp.cfg.design === 'breathing' ? net / (area * 10) : 0;
  const consFrac = sp.cfg.design === 'conservator' ? clamp(0.5 + net / Math.max(1, sp.consL), -0.5, 1) : 0;
  // conservator run dry: air reaches the Buchholz from above
  if (sp.cfg.design === 'conservator' && consFrac < 0) st.gasBuch = Math.max(st.gasBuch, Math.min(SET.buchholzCap.v, -consFrac * sp.consL * 1000));
  const press = sp.cfg.design === 'hermetic' ? (SET.pressAt80.v * net) / (sp.oilL * sp.fluid.beta * 60) + st.spike : 0;
  if (sp.cfg.design === 'hermetic' && press > SET.prvOpen.v) {
    if (!st.prvOpen) log(`Pressure relief valve opens at ${press.toFixed(2)} bar (est. ${SET.prvOpen.v})`, 'trip');
    st.prvOpen = 1;
    st.prvVented += dtS * 0.5;
  } else st.prvOpen = Math.max(0, st.prvOpen - dtS * 0.6);
  // silica gel: every litre of air breathed in carries water
  if (st.lastDV != null && f.breather) {
    const dIn = Math.max(0, st.lastDV - net); // fluid shrinks: air comes in
    st.sat = Math.min(1, st.sat + (dIn * SET.airWater.v) / SET.gelCapacity.v);
  }
  st.lastDV = net;
  // contacts: closed = true
  const C = st.contacts;
  const top = inp.top;
  const hy = SET.thermoHyst.v;
  const thAl = C.thAlarm ? top > SET.thermoAlarm.v - hy : top >= SET.thermoAlarm.v;
  const thTr = C.thTrip ? top > SET.thermoTrip.v - hy : top >= SET.thermoTrip.v;
  const next = {
    thAlarm: f.contacts && thAl,
    thTrip: f.contacts && thTr,
    levelMin: f.reed && (sp.cfg.design === 'breathing' ? levelCm <= SET.levelMinCm.v : sp.cfg.design === 'conservator' ? consFrac <= SET.consMin.v : press <= SET.dgptLevelAlarm.v),
    consMin: f.level && sp.cfg.design === 'conservator' && consFrac <= SET.consMin.v,
    buchAlarm: f.buchholz && st.gasBuch >= SET.buchholzGasAlarm.v,
    buchTrip: f.buchholz && (st.surge >= SET.buchholzSurgeTrip.v * 0.999 || C.buchTrip || consFrac < -0.05),
    dgptGas: f.dgpt && st.gasDgpt >= SET.dgptGasAlarm.v,
    dgptPress: f.dgpt && (press >= SET.dgptPressTrip.v || C.dgptPress),
    dgptLevel: f.dgpt && press <= SET.dgptLevelAlarm.v,
  };
  const NAMES = {
    thAlarm: ['Thermometer alarm contact closed', 'alarm'], thTrip: ['Thermometer trip contact closed', 'trip'],
    levelMin: ['Level indicator at MIN (reed contact)', 'alarm'], consMin: ['Conservator gauge at MIN', 'alarm'],
    buchAlarm: ['Buchholz alarm: NO 3–4 closed (gas)', 'alarm'], buchTrip: ['Buchholz trip: NO 1–2 closed', 'trip'],
    dgptGas: ['Full protection: gas alarm', 'alarm'], dgptPress: ['Full protection: pressure trip', 'trip'], dgptLevel: ['Full protection: level alarm', 'alarm'],
  };
  for (const k in next) {
    if (next[k] && !C[k]) {
      log(NAMES[k][0], NAMES[k][1]);
      if (NAMES[k][1] === 'trip' && !st.tripped && on) st.tripped = NAMES[k][0];
    }
    C[k] = next[k];
  }
  // a fault no device sees
  if (inp.faults.gassing && !f.buchholz && !f.dgpt && on && !st.warnedGas) {
    st.warnedGas = true;
    log('No device sees slow gassing here: only the oil analysis (p.58)', 'info');
  }
  if (sp.cfg.design === 'breathing' && levelCm <= SET.levelMinCm.v && !f.reed && !st.warnedLevel) {
    st.warnedLevel = true;
    log('Level under MIN: only the dipstick shows it — leads may be uncovered (p.37)', 'alarm');
  }
  st.levelCm = levelCm;
  st.consFrac = consFrac;
  st.press = press;
  st.energised = on && !st.tripped && !st.fuseBlown;
  return st;
}
/** Reset after the cause is cleared (p.54: never re-energise before it is clarified). Gas is vented, fuses replaced. */
export function protReset(sp, st) {
  return {...protInit(sp), sat: st.sat, events: [...st.events.slice(-7), {min: st.events.at(-1)?.min ?? 0, text: 'Cause cleared, gas vented, fuse replaced, unit re-energised', kind: 'info'}]};
}
/** Overall state for the header chip. */
export const statusOf = (st) => (st.tripped || st.fuseBlown ? 'TRIPPED' : Object.entries(st.contacts).some(([, v]) => v) ? 'ALARM' : 'NORMAL');
