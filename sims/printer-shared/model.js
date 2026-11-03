// Filament FX-1, the firmware model. One G-code program and one clock drive everything: the program goes through a
// model of open-source printer firmware (Marlin-style) once at load, and every pose, gauge, trace, register and screen
// pixel afterwards is a lookup by machine time. No three.js in here.
//
//   G-code text → parser → look-ahead planner (trapezoids, junction deviation) → stepper ISR (Bresenham) → driver
//   (microstep sine table) → motor → pulley / lead screw → carriage, bed and Z.
//   Thermal: PID at PID_dT, first-order hotend, lagging thermistor, thermal-runaway state machine, MINTEMP.
//   UI: the 128 x 64 status screen and its menu.  Host: ping-pong "ok" streaming over USB serial.
//
// Every number below has its source in REFERENCES.md. Hand checks:
//   X/Y: 200 full steps × 16 microsteps = 3200 µsteps per turn; a 20-tooth GT2 pulley (2 mm pitch) moves the belt
//        40 mm per turn, so 3200 / 40 = 80 steps/mm.
//   Z:   3200 µsteps per turn on a T8 screw with an 8 mm lead: 3200 / 8 = 400 steps/mm.
//   E:   3:1 gearing on a drive gear of 7.36 mm effective diameter: 3200 × 3 / (π × 7.36) = 415.2 steps/mm.
//   Hotend: 24 V across a 14.4 Ω cartridge is 1.67 A and 40 W.
//   A 90° corner at a = 3000 mm/s² and δ = 0.013 mm: v = √(a·δ·sin45°/(1−sin45°)) = √(3000·0.013·2.414) = 9.7 mm/s.

const MICRO = 16;
const FULL = 200;
export const P = {
  bed: {x: 220, y: 220, zMax: 250},
  micro: MICRO,
  usteps: FULL * MICRO, // 3200 per revolution
  gt2: {pitch: 2, teeth: 20},
  lead: 8,
  ext: {ratio: 3, gearD: 7.36},
  steps: null, // derived below
  maxFeed: {x: 300, y: 300, z: 5, e: 25}, // DEFAULT_MAX_FEEDRATE, mm/s
  maxAcc: {x: 3000, y: 3000, z: 100, e: 10000}, // DEFAULT_MAX_ACCELERATION, mm/s²
  acc: {print: 3000, retract: 3000, travel: 3000}, // DEFAULT_ACCELERATION / RETRACT / TRAVEL
  jd: 0.013, // JUNCTION_DEVIATION_MM
  minPlannerSpeed: 0.05,
  homeFeed: {x: 50, y: 50, z: 4}, // HOMING_FEEDRATE_MM_M / 60
  bump: {x: 5, y: 5, z: 2}, // HOMING_BUMP_MM
  bumpDiv: {x: 2, y: 2, z: 4}, // HOMING_BUMP_DIVISOR
  blockBuffer: 16, // BLOCK_BUFFER_SIZE (one slot always free: 15 usable)
  bufsize: 4, // BUFSIZE, the command queue
  baud: 250000, // BAUDRATE
  firstMoveDelay: 0.02, // s, the planner waits a beat for more blocks before the first move
  pid: {kp: 22.2, ki: 1.08, kd: 114, dt: 1 / 7.689, k1: 0.95, range: 10, max: 255},
  runaway: {period: 40, hyst: 4}, // THERMAL_PROTECTION_PERIOD / HYSTERESIS
  watch: {period: 40, inc: 2}, // WATCH_TEMP_PERIOD / INCREASE
  mintemp: 5,
  maxtemp: 275,
  residency: {time: 10, window: 1, hyst: 3}, // TEMP_RESIDENCY_TIME / TEMP_WINDOW / TEMP_HYSTERESIS
  bedCtl: {interval: 5, hyst: 2}, // BED_CHECK_INTERVAL / BED_HYSTERESIS (bang-bang)
  therm: {r25: 100000, beta: 4092, pullup: 4700, oversample: 16, adcMax: 1024}, // TEMP_SENSOR_0 1
  hotend: {volts: 24, ohms: 14.4, C: 12, R: 23, Rfan: 17, tauS: 1.2, amb: 25},
  bedHeat: {watts: 220, C: 600, R: 0.9},
  fil: {d: 1.75, meltJ: 0.416}, // PLA: 1.25 g/cm³ × 1.8 J/gK × 185 K = 0.416 J/mm³
  line: {w: 0.45, h: 0.2},
  // TMC2209 on UART, Marlin's tmc_init(): 800 mA rms, R_SENSE 0.11 Ω, HOLD_MULTIPLIER 0.5, 24 V chopper {4, 2, 1}
  tmc: {mA: 800, rsense: 0.11, hold: 0.5, toff: 4, hend: 2, hstrt: 1, tbl: 1, iholddelay: 10, tpowerdown: 128, fclk: 12e6},
  // frame resonance, the toolhead (X) and the bed (Y): second-order, typical for a bed-slinger (see REFERENCES.md)
  res: {x: {f: 52, zeta: 0.1}, y: {f: 38, zeta: 0.1}},
  // where the machine sits when it is switched on (the firmware does not know this until it homes)
  power: {x: 62.4, y: 118.0, z: 6.0},
};
P.steps = {
  x: P.usteps / (P.gt2.pitch * P.gt2.teeth),
  y: P.usteps / (P.gt2.pitch * P.gt2.teeth),
  z: P.usteps / P.lead,
  e: (P.usteps * P.ext.ratio) / (Math.PI * P.ext.gearD),
};
export const AX = ['x', 'y', 'z', 'e'];
P.filArea = Math.PI * (P.fil.d / 2) ** 2; // 2.405 mm²
P.ePerMm = (P.line.w * P.line.h) / P.filArea; // filament per mm of bead
P.heaterW = P.hotend.volts ** 2 / P.hotend.ohms; // 40 W

// ------------------------------------------------------------ TMC2209 registers, built field by field (datasheet)
export const TMC = (() => {
  const t = P.tmc;
  // TMCStepper rms_current(): CS from the sense resistor, vsense switched on when CS would fall under 16
  const cs0 = (32 * Math.SQRT2 * (t.mA / 1000) * (t.rsense + 0.02)) / 0.325 - 1;
  const vsense = cs0 < 16 ? 1 : 0;
  const irun = Math.floor(vsense ? (32 * Math.SQRT2 * (t.mA / 1000) * (t.rsense + 0.02)) / 0.18 - 1 : cs0);
  const ihold = Math.floor(irun * t.hold);
  const vfs = vsense ? 0.18 : 0.325;
  const iRms = ((irun + 1) / 32) * (vfs / (t.rsense + 0.02)) / Math.SQRT2;
  const mres = {256: 0, 128: 1, 64: 2, 32: 3, 16: 4, 8: 5, 4: 6, 2: 7, 1: 8}[MICRO];
  const GCONF = (1 << 6) | (1 << 7); // pdn_disable, mstep_reg_select; StealthChop (en_spreadcycle 0)
  const CHOPCONF = (t.toff | ((t.hstrt - 1) << 4) | ((t.hend + 3) << 7) | (t.tbl << 15) | (vsense << 17) | (mres << 24) | (1 << 28)) >>> 0;
  const IHOLD_IRUN = (ihold | (irun << 8) | (t.iholddelay << 16)) >>> 0;
  const PWMCONF = (36 | (14 << 8) | (1 << 16) | (1 << 18) | (1 << 19) | (8 << 24) | (12 << 28)) >>> 0;
  const hex = (v) => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return {
    irun,
    ihold,
    vsense,
    iRms,
    iPeak: iRms * Math.SQRT2,
    holdDelay: (t.tpowerdown * 2 ** 18) / t.fclk, // 2.8 s of standstill before hold current
    regs: [
      ['GCONF', 0x00, hex(GCONF), 'UART, µsteps by register, StealthChop'],
      ['GSTAT', 0x01, hex(7), 'clear reset / drv_err / uv_cp'],
      ['CHOPCONF', 0x6c, hex(CHOPCONF), `MRES ${mres} (×${MICRO}) · intpol · TOFF ${t.toff} · vsense ${vsense}`],
      ['IHOLD_IRUN', 0x10, hex(IHOLD_IRUN), `IRUN ${irun} · IHOLD ${ihold} · delay ${t.iholddelay}`],
      ['TPOWERDOWN', 0x11, hex(t.tpowerdown), '≈2.8 s to hold current'],
      ['PWMCONF', 0x70, hex(PWMCONF), 'autoscale · autograd · ofs 36 grad 14'],
    ],
  };
})();

// ------------------------------------------------------------ the program
// A notched block, 40 × 40 mm, three walls high, one perimeter: square corners (90°, inside and out) and one 45°
// chamfer, so the planner has three kinds of junction to slow for.
export const POLY = [[96, 90], [130, 90], [130, 130], [118, 130], [118, 118], [102, 118], [102, 130], [90, 130], [90, 96]];
export const LAYERS = 3;
const f3 = (v) => (Math.abs(v) < 5e-4 ? '0' : v.toFixed(3).replace(/\.?0+$/, ''));
export function buildProgram(fault = 'none') {
  const L = [];
  const g = (s) => L.push(s);
  g('; FILAMENT FX-1 · demo.gcode');
  g('; notched block 40x40, 3 layers, 1 wall');
  g('M155 S2 ; report temps every 2 s');
  g('M140 S60 ; bed target, no wait');
  g('M104 S210 ; hotend target, no wait');
  g('G28 ; home X, Y, Z');
  g('M109 S210 ; wait for hotend');
  if (fault === 'accel') {
    g('M201 X12000 Y12000 ; raise limits');
    g('M204 P12000 T12000 ; accel x4');
  }
  g('G92 E0');
  g('G1 Z0.2 F300');
  g(`G1 X${POLY[0][0]} Y${POLY[0][1]} F6000 ; travel`);
  let E = 0;
  for (let l = 0; l < LAYERS; l++) {
    const z = 0.2 * (l + 1);
    if (l > 0) {
      g(`G1 E${f3(E - 0.8)} F2100 ; retract`);
      g(`G1 Z${f3(z)} F300`);
      g(`G1 E${f3(E)} F2100 ; unretract`);
    }
    if (l === 1) g('M106 S255 ; part fan on');
    g(`; layer ${l + 1}`);
    const F = l === 0 ? 1500 : 2700;
    for (let i = 1; i <= POLY.length; i++) {
      const [x0, y0] = POLY[i - 1];
      const [x, y] = POLY[i % POLY.length];
      E += Math.hypot(x - x0, y - y0) * P.ePerMm;
      g(`G1 X${x} Y${y} E${f3(E)}${i === 1 ? ` F${F}` : ''}`);
    }
  }
  g(`G1 E${f3(E - 0.8)} F2100 ; retract`);
  g('G1 Z10 F300');
  g('G1 X0 Y200 F6000 ; present the bed');
  g('M104 S0');
  g('M140 S0');
  g('M107');
  g('M84 ; motors off');
  return L.join('\n');
}

export function parseLine(raw) {
  const code = raw.split(';')[0].trim();
  const comment = raw.includes(';') ? raw.slice(raw.indexOf(';') + 1).trim() : '';
  if (!code) return {cmd: null, args: {}, fields: [], comment};
  const tok = code.split(/\s+/);
  const args = {};
  const fields = [];
  for (const t of tok.slice(1)) {
    args[t[0].toUpperCase()] = Number(t.slice(1));
    fields.push([t[0].toUpperCase(), t.slice(1)]);
  }
  return {cmd: tok[0].toUpperCase(), args, fields, comment, code};
}

// ------------------------------------------------------------ trapezoids
function trapezoid(b) {
  const {vEntry: vi, vExit: vf, vNom: vn, acc: a, len: L} = b;
  let dA = (vn * vn - vi * vi) / (2 * a);
  let dD = (vn * vn - vf * vf) / (2 * a);
  let vp = vn;
  if (dA + dD > L) {
    dA = Math.min(L, Math.max(0, (2 * a * L - vi * vi + vf * vf) / (4 * a)));
    vp = Math.sqrt(vi * vi + 2 * a * dA);
    dD = L - dA;
  }
  const dC = Math.max(0, L - dA - dD);
  Object.assign(b, {dA, dC, dD, vPeak: vp, t1: (vp - vi) / a, t2: dC / vp, t3: Math.max(0, (vp - vf) / a)});
  b.dur = b.t1 + b.t2 + b.t3;
}
const sOf = (b, u) => {
  const {vEntry: vi, vPeak: vp, acc: a, t1, t2} = b;
  if (u <= 0) return 0;
  if (u < t1) return vi * u + 0.5 * a * u * u;
  if (u < t1 + t2) return b.dA + vp * (u - t1);
  const w = Math.min(u - t1 - t2, b.t3);
  return Math.min(b.len, b.dA + b.dC + vp * w - 0.5 * a * w * w);
};
const vOf = (b, u) => {
  if (u < 0 || u > b.dur) return 0;
  if (u < b.t1) return b.vEntry + b.acc * u;
  if (u < b.t1 + b.t2) return b.vPeak;
  return Math.max(0, b.vPeak - b.acc * (u - b.t1 - b.t2));
};
const uOf = (b, s) => {
  const {vEntry: vi, vPeak: vp, acc: a} = b;
  if (s <= b.dA) return (-vi + Math.sqrt(vi * vi + 2 * a * s)) / a;
  if (s <= b.dA + b.dC) return b.t1 + (s - b.dA) / vp;
  const w = s - b.dA - b.dC;
  return b.t1 + b.t2 + (vp - Math.sqrt(Math.max(0, vp * vp - 2 * a * w))) / a;
};
// Bresenham as the stepper ISR runs it: every event steps the lead axis; the counter of axis a starts at −N/2, gains
// n_a per event and steps whenever it goes positive. After k events axis a has made c(k) steps.
const bres = (k, n, N) => (n === 0 || k <= 0 ? 0 : Math.min(n, Math.max(0, Math.ceil((k * n - (N >> 1)) / N))));

// ------------------------------------------------------------ the thermal loop (PID, runaway, MINTEMP, bed)
const adcOf = (T) => {
  const {r25, beta, pullup, oversample, adcMax} = P.therm;
  const r = r25 * Math.exp(beta * (1 / (T + 273.15) - 1 / 298.15));
  return Math.round(((adcMax * oversample) * r) / (r + pullup));
};
const tempOfAdc = (raw) => {
  const {r25, beta, pullup, oversample, adcMax} = P.therm;
  const full = adcMax * oversample;
  if (raw >= full - 1) return -15; // past the table's last row: the lowest entry, −15 °C
  const r = (pullup * raw) / (full - raw);
  return 1 / (1 / 298.15 + Math.log(r / r25) / beta) - 273.15;
};
export {adcOf, tempOfAdc};

function thermal({events, flow, until, fault, faultAt, waitFrom, waitTarget}) {
  const H = P.hotend;
  const dt = 0.005;
  const out = {t: [], T: [], Ts: [], tgt: [], duty: [], p: [], i: [], d: [], tr: [], trLeft: [], adc: [], bedT: [], bedTgt: [], bedOn: [], fan: []};
  let T = H.amb;
  let Ts = H.amb;
  let bedT = H.amb;
  let tgt = 0;
  let bedTgt = 0;
  let fanCmd = 0;
  let fan = 0;
  let duty = 0;
  let bedOn = 0;
  let iState = 0;
  let dState = H.amb;
  let workD = 0;
  let reset = true;
  let wP = 0;
  let wI = 0;
  let tr = 'INACTIVE';
  let running = 0;
  let trTimer = 0;
  let watchT = 0;
  let watchAt = 0;
  let nextPid = 0;
  let nextBed = 0;
  let kill = null;
  let ev = 0;
  let resid = null;
  let waitDone = null;
  const Ki = P.pid.ki * P.pid.dt;
  const Kd = P.pid.kd / P.pid.dt;
  const iMax = P.pid.max / Ki;
  for (let t = 0; t <= Math.min(until, 3000); t += dt) {
    while (ev < events.length && events[ev].t <= t) {
      const e = events[ev++];
      if (e.k === 'E') tgt = e.v;
      else if (e.k === 'B') bedTgt = e.v;
      else if (e.k === 'F') fanCmd = e.v;
    }
    if (kill) {
      tgt = 0;
      bedTgt = 0;
    }
    if (t >= nextPid - 1e-9) {
      nextPid += P.pid.dt;
      // the reading: the ADC oversampled, through the table
      const open = fault === 'unplug' && t >= faultAt;
      const raw = open ? P.therm.adcMax * P.therm.oversample - 1 : adcOf(Ts);
      const cur = tempOfAdc(raw);
      if (!kill && tgt > 0 && cur < P.mintemp) kill = {t, why: 'MINTEMP', msg: 'Err: MINTEMP E0'};
      if (!kill && cur > P.maxtemp) kill = {t, why: 'MAXTEMP', msg: 'Err: MAXTEMP E0'};
      // thermal-runaway state machine (Marlin thermal_runaway_protection)
      if (running !== tgt) {
        running = tgt;
        tr = tgt > 0 ? 'FIRST HEATING' : 'INACTIVE';
        watchT = cur + P.watch.inc;
        watchAt = t + P.watch.period;
      }
      if (tr === 'FIRST HEATING' && cur >= running) tr = 'STABLE';
      if (tr === 'FIRST HEATING' && !kill && t >= watchAt) {
        if (cur < watchT) kill = {t, why: 'HEATING FAILED', msg: 'Heating failed E0'};
        watchT = cur + P.watch.inc;
        watchAt = t + P.watch.period;
      }
      if (tr === 'STABLE') {
        if (running - cur <= P.runaway.hyst) trTimer = t + P.runaway.period;
        else if (t >= trTimer && !kill) {
          tr = 'RUNAWAY';
          kill = {t, why: 'THERMAL RUNAWAY', msg: 'THERMAL RUNAWAY E0'};
        }
      }
      // PID (Marlin PIDRunner): full power far below, off far above, PID inside the functional range
      const err = tgt - cur;
      let o;
      if (kill || tgt === 0 || err < -P.pid.range) {
        o = 0;
        reset = true;
        wP = wI = workD = 0;
      } else if (err > P.pid.range) {
        o = P.pid.max;
        reset = true;
        wP = wI = workD = 0;
      } else {
        if (reset) {
          iState = 0;
          workD = 0;
          reset = false;
        }
        iState = Math.min(iMax, Math.max(0, iState + err));
        wP = P.pid.kp * err;
        wI = Ki * iState;
        workD += (1 - P.pid.k1) * (Kd * (dState - cur) - workD);
        o = Math.min(P.pid.max, Math.max(0, wP + wI + workD));
      }
      dState = cur;
      duty = o;
      // M109: wait for the window, then hold it for the residency time
      if (waitFrom !== undefined && waitDone === null && t >= waitFrom && !kill) {
        if (Math.abs(cur - waitTarget) <= P.residency.window && resid === null) resid = t;
        if (resid !== null && Math.abs(cur - waitTarget) > P.residency.hyst) resid = null;
        if (resid !== null && t - resid >= P.residency.time) waitDone = t;
      }
      out.t.push(t);
      out.T.push(T);
      out.Ts.push(cur);
      out.tgt.push(tgt);
      out.duty.push(duty);
      out.p.push(wP);
      out.i.push(wI);
      out.d.push(workD);
      out.tr.push(tr);
      out.trLeft.push(tr === 'STABLE' ? Math.max(0, trTimer - t) : 0);
      out.adc.push(raw);
      out.bedT.push(bedT);
      out.bedTgt.push(bedTgt);
      out.bedOn.push(bedOn);
      out.fan.push(fan);
      if (waitDone !== null && until === Infinity) break;
    }
    if (t >= nextBed - 1e-9) {
      nextBed += P.bedCtl.interval;
      if (kill || bedTgt === 0) bedOn = 0;
      else if (bedT >= bedTgt + P.bedCtl.hyst) bedOn = 0;
      else if (bedT <= bedTgt - P.bedCtl.hyst) bedOn = 1;
    }
    if (kill && t > kill.t + 30 && until === Infinity) break;
    fan += (fanCmd - fan) * (1 - Math.exp(-dt / 0.6));
    const R = H.R + (H.Rfan - H.R) * fan;
    const pIn = (duty / P.pid.max) * P.heaterW;
    const melt = (flow ? flow(t) : 0) * P.fil.meltJ;
    T += ((pIn - (T - H.amb) / R - melt) / H.C) * dt;
    // the thermistor: seated in the block it lags by tauS; worked loose it reads mostly air
    const loose = fault === 'loose' && t >= faultAt;
    const seen = loose ? H.amb + 0.35 * (T - H.amb) : T;
    Ts += ((seen - Ts) / (loose ? 4 : H.tauS)) * dt;
    const B = P.bedHeat;
    bedT += ((bedOn * B.watts - (bedT - H.amb) / B.R) / B.C) * dt;
  }
  return {out, kill, waitDone};
}

// ------------------------------------------------------------ the run
const txTime = (s) => ((s.length + 2) * 10) / P.baud;
const lower = (A, v) => {
  let lo = 0;
  let hi = A.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (A[m] <= v) lo = m + 1;
    else hi = m;
  }
  return lo - 1;
};

export const FAULTS = ['none', 'unplug', 'loose', 'skip', 'accel'];
export const FAULT_LABEL = {none: 'NOMINAL', unplug: 'THERMISTOR UNPLUGGED', loose: 'THERMISTOR LOOSE', skip: 'SKIPPED STEPS', accel: 'ACCEL ×4'};

export function runModel(fault = 'none') {
  const text = buildProgram(fault);
  const lines = text.split('\n').map((raw, i) => ({n: i + 1, raw, ...parseLine(raw)}));
  const spm = P.steps;

  // ---------------- pass 1: blocks and operations, in program order, no time yet
  const blocks = [];
  const ops = [];
  const steps = {x: 0, y: 0, z: 0, e: 0};
  const off = {x: P.power.x, y: P.power.y, z: P.power.z, e: 0};
  const offs = [{t: 0, ...off}];
  let F = 1000 / 60;
  const acc = {...P.acc};
  const maxAcc = {...P.maxAcc};
  let segId = 0;
  const mkBlock = (line, d, vNom, kind) => {
    const dmm = {x: d.x / spm.x, y: d.y / spm.y, z: d.z / spm.z, e: d.e / spm.e};
    let len = Math.hypot(dmm.x, dmm.y, dmm.z);
    const eOnly = len < 1e-9;
    if (eOnly) len = Math.abs(dmm.e);
    const unit = eOnly ? {x: 0, y: 0, z: 0, e: Math.sign(dmm.e)} : {x: dmm.x / len, y: dmm.y / len, z: dmm.z / len, e: dmm.e / len};
    let v = vNom;
    for (const a of AX) if (Math.abs(unit[a]) * v > P.maxFeed[a]) v = P.maxFeed[a] / Math.abs(unit[a]);
    let ac = eOnly ? acc.retract : d.e !== 0 ? acc.print : acc.travel;
    for (const a of AX) if (Math.abs(unit[a]) * ac > maxAcc[a]) ac = maxAcc[a] / Math.abs(unit[a]);
    const n = {x: Math.abs(d.x), y: Math.abs(d.y), z: Math.abs(d.z), e: Math.abs(d.e)};
    const b = {
      i: blocks.length,
      line,
      kind,
      d: dmm,
      dir: {x: Math.sign(d.x), y: Math.sign(d.y), z: Math.sign(d.z), e: Math.sign(d.e)},
      n,
      N: Math.max(n.x, n.y, n.z, n.e),
      steps0: {...steps},
      len,
      unit,
      vNom: v,
      acc: ac,
      extruding: d.e > 0 && !eOnly,
      retract: eOnly,
      seg: segId,
    };
    for (const a of AX) steps[a] += d[a];
    b.stepsEnd = {...steps};
    blocks.push(b);
    return b;
  };
  const physOf = (a) => steps[a] / spm[a] + off[a];
  for (const L of lines) {
    if (!L.cmd) continue;
    const c = L.cmd;
    const A = L.args;
    if (c === 'G0' || c === 'G1') {
      if (A.F) F = A.F / 60;
      const d = {};
      for (const a of AX) {
        const k = a.toUpperCase();
        d[a] = k in A ? Math.round(A[k] * spm[a]) - steps[a] : 0;
      }
      if (AX.some((a) => d[a] !== 0)) ops.push({line: L.n, kind: 'move', b: mkBlock(L.n, d, F, 'move').i});
      else ops.push({line: L.n, kind: 'set'});
    } else if (c === 'G28') {
      segId++;
      const first = blocks.length;
      const resets = [];
      for (const a of ['x', 'y', 'z']) {
        const hf = P.homeFeed[a];
        // fast approach toward the switch, cut where the switch closes
        const cut = (b) => {
          const startPhys = b.steps0[a] / spm[a] + off[a];
          const k = Math.ceil(startPhys * spm[a] - 1e-9);
          b.cutK = Math.max(1, Math.min(b.N, k));
          b.cutS = (b.cutK / b.N) * b.len;
          const stop = b.steps0[a] - b.cutK;
          steps[a] = stop;
          const phys = stop / spm[a] + off[a];
          // the firmware now knows where it is: the count becomes 0 here
          steps[a] = 0;
          off[a] = phys;
          b.stepsEnd = {...steps};
          b.reset = {a, phys};
          resets.push(b.i);
        };
        const dd = {x: 0, y: 0, z: 0, e: 0};
        dd[a] = -Math.round(1.5 * (a === 'z' ? P.bed.zMax : P.bed[a]) * spm[a]);
        cut(mkBlock(L.n, dd, hf, 'home'));
        const up = {x: 0, y: 0, z: 0, e: 0};
        up[a] = Math.round(P.bump[a] * spm[a]);
        mkBlock(L.n, up, hf, 'home');
        const dn = {x: 0, y: 0, z: 0, e: 0};
        dn[a] = -Math.round(2 * P.bump[a] * spm[a]);
        cut(mkBlock(L.n, dn, hf / P.bumpDiv[a], 'home'));
      }
      ops.push({line: L.n, kind: 'home', from: first, to: blocks.length - 1});
      segId++;
    } else if (c === 'M109') ops.push({line: L.n, kind: 'wait', v: A.S}), segId++;
    else if (c === 'M84' || c === 'M400') ops.push({line: L.n, kind: 'sync', off: c === 'M84'}), segId++;
    else if (c === 'M104') ops.push({line: L.n, kind: 'set', ev: {k: 'E', v: A.S}});
    else if (c === 'M140') ops.push({line: L.n, kind: 'set', ev: {k: 'B', v: A.S}});
    else if (c === 'M106') ops.push({line: L.n, kind: 'set', ev: {k: 'F', v: (A.S ?? 255) / 255}});
    else if (c === 'M107') ops.push({line: L.n, kind: 'set', ev: {k: 'F', v: 0}});
    else if (c === 'M201') {
      if (A.X) maxAcc.x = A.X;
      if (A.Y) maxAcc.y = A.Y;
      ops.push({line: L.n, kind: 'set'});
    } else if (c === 'M204') {
      if (A.P) acc.print = A.P;
      if (A.T) acc.travel = A.T;
      ops.push({line: L.n, kind: 'set'});
    } else if (c === 'G92') {
      for (const a of AX) if (a.toUpperCase() in A) steps[a] = Math.round(A[a.toUpperCase()] * spm[a]);
      ops.push({line: L.n, kind: 'set'});
    } else ops.push({line: L.n, kind: 'set'});
  }
  void physOf;

  // ---------------- the planner: junction deviation, a reverse and a forward pass over each run of moves
  const junction = (p, b) => {
    const cos = -(p.unit.x * b.unit.x + p.unit.y * b.unit.y + p.unit.z * b.unit.z + p.unit.e * b.unit.e);
    let v;
    if (cos > 0.999999) v = P.minPlannerSpeed;
    else if (cos < -0.999999) v = Infinity;
    else {
      const s = Math.sqrt(0.5 * (1 - cos));
      v = Math.sqrt((b.acc * P.jd * s) / (1 - s));
    }
    b.theta = (Math.acos(Math.max(-1, Math.min(1, -cos))) * 180) / Math.PI;
    return Math.max(P.minPlannerSpeed, Math.min(v, p.vNom, b.vNom));
  };
  const plan = (run) => {
    run.forEach((b, k) => (b.vMaxEntry = k === 0 ? 0 : junction(run[k - 1], b)));
    for (let k = run.length - 1; k >= 0; k--) {
      const next = k === run.length - 1 ? 0 : run[k + 1].vEntry;
      run[k].vEntry = Math.min(run[k].vMaxEntry, Math.sqrt(next * next + 2 * run[k].acc * run[k].len));
    }
    for (let k = 1; k < run.length; k++) {
      const p = run[k - 1];
      run[k].vEntry = Math.min(run[k].vEntry, Math.sqrt(p.vEntry * p.vEntry + 2 * p.acc * p.len));
    }
    run.forEach((b, k) => {
      b.vExit = k === run.length - 1 ? 0 : run[k + 1].vEntry;
      trapezoid(b);
    });
  };
  {
    let run = [];
    const flush = () => {
      if (run.length) plan(run);
      run = [];
    };
    for (const b of blocks) {
      if (b.kind === 'home') {
        flush();
        plan([b]);
        continue;
      }
      if (run.length && run[run.length - 1].seg !== b.seg) flush();
      run.push(b);
    }
    flush();
  }
  // homing moves stop dead where the switch closes
  for (const b of blocks) if (b.cutS !== undefined) b.dur = uOf(b, b.cutS);

  // ---------------- pass 2: time. The host streams one line per "ok"; moves enter the planner when it has room
  const serial = [];
  const lineT = {}; // line → {sent, ok}
  const tEvents = [];
  let tHost = 0.1;
  let lastEnd = 0;
  let syncDone = 0;
  let killed = null;
  let heat = null;
  const ev = {};
  const segStart = {};
  const busy = [];
  for (const op of ops) {
    const L = lines[op.line - 1];
    const sent = tHost;
    const arrive = sent + txTime(L.code);
    let done = arrive + 0.0004;
    if (op.kind === 'move') {
      const b = blocks[op.b];
      const prev = blocks[op.b - 15];
      const enq = Math.max(done, prev && prev.tEnd !== undefined ? prev.tEnd : 0);
      if (segStart[b.seg] === undefined) {
        let t0 = Math.max(enq, syncDone) + P.firstMoveDelay;
        segStart[b.seg] = t0;
        for (const bb of blocks.filter((x) => x.seg === b.seg && x.kind === 'move')) {
          bb.tStart = t0;
          bb.tEnd = t0 + bb.dur;
          t0 = bb.tEnd;
        }
      }
      b.enq = enq;
      b.starved = enq > b.tStart + 1e-9;
      done = enq;
      lastEnd = Math.max(lastEnd, b.tEnd);
    } else if (op.kind === 'home') {
      let t0 = Math.max(arrive, lastEnd) + 0.01;
      ev.homeStart = t0;
      for (let i = op.from; i <= op.to; i++) {
        const b = blocks[i];
        b.enq = t0;
        b.tStart = t0;
        b.tEnd = t0 + b.dur;
        t0 = b.tEnd + 0.03;
        if (b.reset) offs.push({t: b.tEnd, a: b.reset.a, v: b.reset.phys});
      }
      done = t0;
      lastEnd = t0;
      syncDone = done;
      ev.homeDone = done;
      busy.push([arrive, done]);
    } else if (op.kind === 'wait') {
      ev.heatWait = arrive;
      const faultAt = fault === 'loose' ? 'auto' : Infinity;
      heat = {arrive, target: op.v, faultAt};
      // the wait itself is resolved by the thermal run below; mark it and stop timing here for now
      op.pendingAt = arrive;
      done = null;
    } else if (op.kind === 'sync') {
      done = Math.max(arrive, lastEnd);
      syncDone = done;
      if (op.off) ev.motorsOff = done;
    } else if (op.ev) tEvents.push({t: done, ...op.ev});
    if (done === null) {
      // M109: run the heater until the window holds for the residency time (or a fault kills the machine)
      let faultAt = Infinity;
      if (fault === 'loose') {
        // the thermistor works loose 3 s after the block first reaches its target
        const pre = thermal({events: tEvents.slice(), until: 400, fault: 'none'});
        const k = pre.out.Ts.findIndex((v, i) => pre.out.t[i] > heat.arrive && v >= heat.target);
        faultAt = pre.out.t[k] + 3;
      }
      ev.faultAt = faultAt;
      const r = thermal({events: tEvents.slice(), until: Infinity, fault, faultAt, waitFrom: heat.arrive, waitTarget: heat.target});
      if (r.kill) {
        killed = r.kill;
        serial.push({t: sent, d: '>', s: L.code});
        lineT[op.line] = {sent, ok: null};
        break;
      }
      done = r.waitDone;
      ev.heatDone = done;
      syncDone = Math.max(syncDone, done);
      busy.push([arrive, done]);
    }
    serial.push({t: sent, d: '>', s: L.code});
    serial.push({t: done, d: '<', s: 'ok'});
    lineT[op.line] = {sent, ok: done};
    tHost = done + txTime('ok') + 0.0006;
  }
  const timed = blocks.filter((b) => b.tStart !== undefined);
  let end = Math.max(lastEnd, tHost) + 2.5;

  // ---------------- the extrusion load, then the full thermal run (faults that strike mid-print land here)
  const moveB = timed.filter((b) => b.kind === 'move');
  const bStarts = timed.map((b) => b.tStart);
  const blockIdxAt = (t) => lower(bStarts, t);
  const flow = (t) => {
    const k = blockIdxAt(t);
    if (k < 0) return 0;
    const b = timed[k];
    if (t > b.tEnd || !b.extruding) return 0;
    return vOf(b, t - b.tStart) * Math.abs(b.unit.e) * P.filArea;
  };
  const printBlocks = moveB.filter((b) => b.extruding);
  ev.printStart = printBlocks.length ? printBlocks[0].tStart : end;
  ev.printEnd = printBlocks.length ? printBlocks[printBlocks.length - 1].tEnd : end;
  // layers start where Z steps up (or the first print block)
  ev.layers = [];
  {
    let z = -1;
    for (const b of printBlocks) {
      const bz = b.steps0.z;
      if (bz !== z) {
        ev.layers.push(b.tStart);
        z = bz;
      }
    }
  }
  if (fault === 'unplug') ev.faultAt = ev.layers[1] + 1.2;
  if (fault === 'skip') {
    const b = printBlocks.find((x) => x.tStart >= (ev.layers[2] ?? 0) && Math.abs(x.d.x) > 20);
    ev.faultAt = b ? b.tStart + 0.45 * b.dur : Infinity;
    ev.skipBlock = b?.i;
  }
  const th = thermal({events: tEvents, flow, until: killed ? killed.t + 30 : end, fault, faultAt: ev.faultAt ?? Infinity});
  if (!killed && th.kill) killed = th.kill;
  if (killed) {
    // kill(): heaters off, steppers off, the planner is thrown away; whatever is moving stops dead
    for (const b of timed) {
      if (b.tStart >= killed.t) b.dropped = true;
      else if (b.tEnd > killed.t) {
        b.cutS = sOf(b, killed.t - b.tStart);
        b.cutK = Math.floor((b.cutS / b.len) * b.N + 1e-9);
        b.dur = killed.t - b.tStart;
        b.tEnd = killed.t;
        b.killedHere = true;
      }
    }
    end = killed.t + 30;
    while (serial.length && serial[serial.length - 1].t > killed.t) serial.pop();
    for (const k in lineT) if (lineT[k].sent > killed.t) delete lineT[k];
    for (const k in lineT) if (lineT[k].ok !== null && lineT[k].ok > killed.t) lineT[k].ok = null;
    const tag = killed.why === 'MINTEMP' ? 'MINTEMP triggered' : killed.why === 'THERMAL RUNAWAY' ? 'Thermal Runaway' : 'Heating failed';
    serial.push({t: killed.t, d: '<', s: `Error:${tag}, system stopped! Heater_ID: 0`});
    serial.push({t: killed.t + 0.002, d: '<', s: 'Error:Printer halted. kill() called!'});
    ev.motorsOff = killed.t;
  }
  const live = timed.filter((b) => !b.dropped);
  const starts = live.map((b) => b.tStart);
  const TH = th.out;
  // temperature reports: every 2 s (M155 S2), every 1 s while M109 waits; "busy" every 2 s while G28 / M109 block
  {
    const look = (t) => {
      const k = Math.max(0, lower(TH.t, t));
      return k;
    };
    const rep = (t) => {
      const k = look(t);
      return ` T:${TH.Ts[k].toFixed(2)} /${TH.tgt[k].toFixed(2)} B:${TH.bedT[k].toFixed(2)} /${TH.bedTgt[k].toFixed(2)} @:${Math.round(TH.duty[k])} B@:${TH.bedOn[k] ? 127 : 0}`;
    };
    const m155 = lineT[3]?.ok ?? 0.2;
    const stopAt = killed ? killed.t : end - 2;
    for (let t = m155 + 2; t < stopAt; t += 2) serial.push({t, d: '<', s: rep(t)});
    if (ev.heatWait !== undefined) {
      const until = ev.heatDone ?? stopAt;
      for (let t = ev.heatWait + 1; t < until; t += 1) serial.push({t: t + 0.0001, d: '<', s: rep(t)});
    }
    for (const [a, b] of busy) for (let t = a + 2; t < Math.min(b, stopAt); t += 2) serial.push({t: t + 0.0002, d: '<', s: 'echo:busy: processing'});
    serial.sort((a, b) => a.t - b.t);
  }

  // ---------------- motion queries
  const blockAt = (t) => {
    const k = lower(starts, t);
    return k < 0 ? null : live[k];
  };
  const kAt = (b, t) => {
    const u = t - b.tStart;
    if (u >= b.dur) return b.cutK ?? b.N;
    return Math.min(b.cutK ?? b.N, Math.floor((sOf(b, u) / b.len) * b.N + 1e-9));
  };
  // the firmware's step count of axis a at time t: what the ISR has sent, an integer
  const stepsAt = (t, a) => {
    const b = blockAt(t);
    if (!b) return 0;
    if (t >= b.tEnd) return b.reset && t >= b.tEnd ? b.stepsEnd[a] : b.steps0[a] + b.dir[a] * bres(b.cutK ?? b.N, b.n[a], b.N);
    return b.steps0[a] + b.dir[a] * bres(kAt(b, t), b.n[a], b.N);
  };
  const offAt = (t, a) => {
    let v = P.power[a] ?? 0;
    for (const o of offs) if (o.a === a && o.t <= t) v = o.v;
    return v;
  };
  // skipped steps: the X motor stalls for 4 full-step cycles (16 full steps) against the commanded field
  const LOST = fault === 'skip' && ev.skipBlock !== undefined ? {t: ev.faultAt, mm: (-16 * MICRO * Math.sign(blocks[ev.skipBlock].d.x)) / spm.x} : null;
  const lostAt = (t, a) => (LOST && a === 'x' ? LOST.mm * Math.min(1, Math.max(0, (t - LOST.t) / 0.004)) : 0);
  const cmdPhys = (t, a) => stepsAt(t, a) / spm[a] + offAt(t, a) + lostAt(t, a);
  // velocity and planned state
  const velAt = (t) => {
    const b = blockAt(t);
    if (!b || t > b.tEnd) return {v: 0, b: null, u: 0};
    const u = t - b.tStart;
    return {v: vOf(b, u), b, u};
  };

  // ---------------- frame resonance: the toolhead and the bed lag and ring behind the motors
  const DT = 0.0002;
  const SAMP = 0.001;
  const nS = Math.ceil(end / SAMP) + 2;
  const defl = {x: new Float32Array(nS), y: new Float32Array(nS)};
  {
    for (const a of ['x', 'y']) {
      const w = 2 * Math.PI * P.res[a].f;
      const z = P.res[a].zeta;
      let x = cmdPhys(0, a);
      let v = 0;
      let next = 0;
      let idx = 0;
      // the commanded position is sampled on the fine grid; only moving stretches need the full rate
      for (let t = 0; t <= end + SAMP; t += DT) {
        const xc = cmdPhys(t, a);
        const acc = w * w * (xc - x) - 2 * z * w * v;
        v += acc * DT;
        x += v * DT;
        if (t >= next - 1e-12) {
          if (idx < nS) defl[a][idx++] = x - xc;
          next += SAMP;
        }
      }
    }
  }
  const deflAt = (t, a) => {
    if (a !== 'x' && a !== 'y') return 0;
    const u = Math.max(0, t / SAMP);
    const i = Math.min(nS - 2, Math.floor(u));
    return defl[a][i] + (defl[a][i + 1] - defl[a][i]) * (u - i);
  };
  // where the parts really are, mm: carriage X, bed Y, gantry Z, filament E
  const physAt = (t, a) => cmdPhys(t, a) + deflAt(t, a);

  // ---------------- the bead: the real nozzle path while the extruder pushes, sampled every 2 ms
  const bead = [];
  {
    const dt = 0.002;
    for (const b of live) {
      if (!b.extruding) continue;
      const t1 = b.tEnd;
      for (let t = b.tStart; t < t1 + 1e-9; t += dt) {
        const tt = Math.min(t, t1);
        bead.push({t: tt, x: physAt(tt, 'x'), y: physAt(tt, 'y'), z: cmdPhys(tt, 'z'), v: vOf(b, tt - b.tStart), b: b.i, nom: b.vNom, first: tt === b.tStart});
      }
    }
  }
  const beadT = bead.map((p) => p.t);

  // ---------------- the stepper ISR trace for the logic analyzer
  const stepEdges = (a, t0, t1, cap = 6000) => {
    const out = [];
    let k0 = Math.max(0, lower(starts, t0));
    for (let k = k0; k < live.length && live[k].tStart <= t1; k++) {
      const b = live[k];
      if (b.tEnd < t0 || b.n[a] === 0) continue;
      const K0 = b.tStart >= t0 ? 0 : kAt(b, t0);
      const K1 = b.tEnd <= t1 ? b.cutK ?? b.N : kAt(b, t1);
      let prev = bres(K0, b.n[a], b.N);
      const stride = Math.max(1, Math.floor((K1 - K0) / cap));
      for (let e = K0 + 1; e <= K1; e += stride) {
        const c = bres(e, b.n[a], b.N);
        if (c > prev) out.push(b.tStart + uOf(b, (e / b.N) * b.len));
        prev = c;
      }
      if (out.length > cap) break;
    }
    return out;
  };
  const dirAt = (t, a) => {
    for (let k = lower(starts, t); k >= 0; k--) if (live[k].dir[a]) return live[k].dir[a];
    return 1;
  };
  const rateAt = (t, a) => {
    const {v, b} = velAt(t);
    return b ? v * Math.abs(b.unit[a]) * spm[a] : 0;
  };
  // the driver: microstep counter, coil currents, run / hold / off
  const firstMove = live.length ? live[0].tStart : 0; // the drivers are enabled by the first move
  const lastMoveOf = (t, a) => {
    for (let k = lower(starts, t); k >= 0; k--) if (live[k].n[a] && live[k].dir[a]) return Math.min(t, live[k].tEnd);
    return -1;
  };
  const driverAt = (t, a) => {
    const s = stepsAt(t, a);
    const mscnt = (((s * (256 / MICRO)) % 1024) + 1024) % 1024; // 16 per step at 16 µsteps, 1024 per electrical cycle
    const enabled = t >= firstMove && !(ev.motorsOff !== undefined && t >= ev.motorsOff);
    const idle = t - lastMoveOf(t, a);
    const hold = idle > TMC.holdDelay ? (TMC.ihold + 1) / (TMC.irun + 1) : 1;
    const amp = enabled ? TMC.iPeak * hold : 0;
    const ph = (2 * Math.PI * mscnt) / 1024;
    return {mscnt, iA: amp * Math.sin(ph), iB: amp * Math.cos(ph), amp, hold: hold < 1, enabled, steps: s};
  };

  // ---------------- thermal lookups
  const thAt = (t) => {
    const k = Math.max(0, Math.min(TH.t.length - 1, lower(TH.t, t)));
    const k2 = Math.min(TH.t.length - 1, k + 1);
    const w = k2 > k ? Math.min(1, Math.max(0, (t - TH.t[k]) / (TH.t[k2] - TH.t[k]))) : 0;
    const L = (A) => A[k] + (A[k2] - A[k]) * w;
    return {T: L(TH.T), Ts: TH.Ts[k], tgt: TH.tgt[k], duty: TH.duty[k], p: TH.p[k], i: TH.i[k], d: TH.d[k], tr: TH.tr[k], trLeft: TH.trLeft[k], adc: TH.adc[k], bedT: L(TH.bedT), bedTgt: TH.bedTgt[k], bedOn: TH.bedOn[k], fan: L(TH.fan), k};
  };

  // ---------------- the program as the screen and the host see it
  const prog = lines.filter((L) => L.cmd);
  const lineState = (t) => {
    // parsed: the last line whose "ok" has gone out (or that is being worked on); executing: the block's line
    let parsed = null;
    for (const L of prog) {
      const lt = lineT[L.n];
      if (lt && lt.sent <= t) parsed = L.n;
    }
    const b = blockAt(t);
    const exec = b && t <= b.tEnd ? b.line : null;
    return {parsed, exec, block: b && t <= b.tEnd ? b : null};
  };
  const plannerAt = (t) => live.filter((b) => b.kind === 'move' && b.enq <= t && b.tEnd > t);
  const done = (n) => (lineT[n]?.ok ?? Infinity);

  // ---------------- the screen and the knob: a short look into the Tune menu while the hotend heats
  const MAIN = ['Info screen', 'Tune', 'Control', 'Pause print', 'Stop print'];
  const TUNE = ['Back', 'Speed', 'Flow', 'Nozzle', 'Bed', 'Fan'];
  const knob = [];
  if (ev.homeDone !== undefined) {
    const t0 = ev.homeDone + 0.6;
    const seq = ['click', 'cw', 'click', 'cw', 'cw', 'cw', 'cw', 'ccw', 'ccw', 'ccw', 'ccw', 'click', 'ccw', 'click'];
    const gap = [0, 0.45, 0.45, 0.4, 0.3, 0.3, 0.6, 0.9, 0.25, 0.25, 0.25, 0.45, 0.45, 0.45];
    let t = t0;
    seq.forEach((e, i) => {
      t += gap[i];
      knob.push({t, e});
    });
  }
  const uiAt = (t) => {
    let screen = 'status';
    let idx = 0;
    let det = 0;
    let press = 0;
    for (const k of knob) {
      if (k.t > t) break;
      if (t - k.t < 0.12 && k.e === 'click') press = 1;
      if (k.e === 'cw') det++;
      if (k.e === 'ccw') det--;
      if (screen === 'status' && k.e === 'click') {
        screen = 'main';
        idx = 0;
      } else if (screen === 'main') {
        if (k.e === 'cw') idx = Math.min(MAIN.length - 1, idx + 1);
        else if (k.e === 'ccw') idx = Math.max(0, idx - 1);
        else if (idx === 0) screen = 'status';
        else if (idx === 1) {
          screen = 'tune';
          idx = 0;
        }
      } else if (screen === 'tune') {
        if (k.e === 'cw') idx = Math.min(TUNE.length - 1, idx + 1);
        else if (k.e === 'ccw') idx = Math.max(0, idx - 1);
        else if (idx === 0) {
          screen = 'main';
          idx = 1;
        }
      }
    }
    const last = knob.filter((k) => k.t <= t).pop();
    let msg = 'FX-1 ready';
    if (ev.homeStart !== undefined && t >= ev.homeStart) msg = 'Homing XYZ';
    if (ev.homeDone !== undefined && t >= ev.homeDone) msg = 'Heating...';
    if (ev.heatDone !== undefined && t >= ev.heatDone) msg = 'Printing demo.gcode';
    if (ev.printEnd !== undefined && t >= ev.printEnd && !killed) msg = 'Print done';
    if (killed && t >= killed.t) {
      screen = 'error';
      msg = killed.msg;
    }
    return {screen, idx, items: screen === 'main' ? MAIN : TUNE, det, press, msg, last: last ? last.e : null, lastT: last ? last.t : -9, kill: killed && t >= killed.t ? killed : null};
  };

  // positions as the firmware reports them (mm); unknown until homed
  const homedAt = (t, a) => offs.some((o) => o.a === a && o.t <= t);

  // ---------------- the corner the film follows: layer 2's first edge along +X, into a 90° turn
  {
    const l2 = printBlocks.filter((b) => b.tStart >= (ev.layers[1] ?? Infinity));
    const fb = l2.find((b) => Math.abs(b.d.x) > 20 && Math.abs(b.d.y) < 1e-6) ?? l2[0];
    ev.follow = fb ? fb.i : null;
  }

  return {
    fault,
    text,
    lines,
    prog,
    blocks,
    live,
    ops,
    lineT,
    serial,
    ev,
    end,
    killed,
    TH,
    bead,
    beadT,
    knob,
    blockAt,
    stepsAt,
    cmdPhys,
    physAt,
    deflAt,
    lostAt,
    offAt,
    velAt,
    stepEdges,
    dirAt,
    rateAt,
    driverAt,
    thAt,
    lineState,
    plannerAt,
    uiAt,
    homedAt,
    done,
    sOf,
    vOf,
    uOf,
    bres,
    kAt,
    flow,
    lower,
  };
}
