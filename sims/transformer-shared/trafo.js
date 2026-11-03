// The oil-filled distribution transformer as numbers: the catalogue, every option and the rules that bind them, the
// datasheet that follows from one configuration, and the physics posed by one input, the electrical angle θ (degrees,
// 50 Hz) with the load factor K, the power factor, the ambient and the tap position as the operating point.
//
// Source: Rauscher & Stoecklin, "Handbuch Flüssigkeitsgefüllte Transformatoren ≤ 3150 kVA, freiatmende und hermetisch
// geschlossene Ausführung" (KD_TR_MA_Handbuch_V2_DE). Every value the manual gives carries its page as `p` / [page].
// Values it does not give (tank dimensions, masses, losses beyond the 630 kVA example, SIA 261 coefficients) are
// marked `est` and come from the standard the manual names (EU 548/2014 Tier 2, IEC 60076-7, SIA 261) or from typical
// catalogue proportions; they are there so the model is complete, and the console shows them in grey with "est.".
// No three.js in here. Lengths in mm, masses in kg, powers in W unless the name says otherwise.

import {PRESETS, presetOf} from './presets.js';

export const MANUAL = 'R&S Handbuch flüssigkeitsgefüllte Transformatoren ≤ 3150 kVA (KD_TR_MA_Handbuch_V2_DE)';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const D2R = Math.PI / 180;

// ------------------------------------------------------------------------------------------------ general limits [12]
export const LIMITS = {
  maxRating: 3150, // kVA, title page
  maxUm: 36, // kV operating voltage, p.12
  ambientMax: 40, ambientMean: 20, ambientMonth: 30, ambientMin: -25, // °C, p.12 and p.44
  riseWinding: 65, riseTopOil: 60, // K, copper and top oil, ONAN, p.12
  altitude: 1000, // m above sea level, p.12 / p.44
  tapStep: 2.5, tapSteps: 2, // ±2×2.5 %, p.12
  overloadMax: 1.5, // 150 % top permissible overload, p.52
  montsinger: 6, // K for twice the ageing, p.52
  normalLife: 30, // years at 20 °C mean, p.52
  storageMin: -25, // °C, p.41
  thermoAlarm: 85, thermoTrip: 95, // °C contact thermometer default, p.41 / p.51
  contactRating: 250, // V AC/DC thermometer contacts, p.41
  oilLevelPerCm: 10, // K per cm of level deviation from the 20 °C mark, p.41 / p.42
  inspectMonths: 12, maintainYears: 5, oilFirstYears: 12, oilEveryYears: 5, // p.57 / p.58
  oilSample: {standard: 1.0, chlorine: 0.05, flush: [0.5, 2]}, // litres, p.58
  inrush: [6, 20], inrushMs: 100, // × rated current over 100 ms, p.49
  fuseSelectivity: 2, // upstream fuse twice the downstream rating, p.50
  shieldDb: 35, shieldFactor: 55, shieldBand: [20, 200000], // grounded screen OS/US, p.54 / p.56
  insulationBoost: 30, // % layer insulation, p.54
  bil: {standard: 125, option: 170}, // kV 1.2/50 µs, p.54
  harmonicB: 1.6, // T induction limit for harmonic loads, p.55
  thdI: 5, thdU: 7, // % limits that call for the screen, p.55
  clearanceWall: 300, clearanceUnits: 500, // mm, p.45
  airPerKw: 3, airRise: [15, 18], // m³/min per kW of losses, K rise of the cell air, p.44
  slingAngle: 60, // ° minimum, p.40
  earthTorque: 75, // Nm M12, p.46
};

// ------------------------------------------------------------------------------------------------ catalogue
// The rating ladder the manual's tables use (100…1600, 2000…3150 up to the title page limit), with what the manual
// says about each: uk from the fuse table [50], the 1 µT distances of the low-radiation design [15].
export const RATINGS = [100, 160, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150];
const UK_MANUAL = {100: 4, 160: 4, 250: 4.2, 400: 4.4, 630: 6, 1000: 5}; // %, p.50
const UK_EST = {315: 4, 500: 4, 800: 6, 1250: 6, 1600: 6, 2000: 6, 2500: 6, 3150: 6};
// EU 548/2014 Tier 2 maximum losses (W) for ≤ 24 kV / ≤ 1.1 kV: Pk = Ak, P0 = A0 − 10 %. The manual: losses to EU
// 548/2014 [12]; the 630 kVA standard unit has 525 W, the amorphous one 280 W [21].
const EU548 = {
  100: [130, 1250], 160: [189, 1750], 250: [270, 2350], 315: [324, 2800], 400: [387, 3250], 500: [459, 3900],
  630: [540, 4600], 800: [585, 6000], 1000: [693, 7600], 1250: [855, 9500], 1600: [1080, 12000], 2000: [1305, 15000],
  2500: [1575, 18500], 3150: [1980, 23000],
};
export const AMDT_630 = {p0Std: 525, p0Amorph: 280, i0Std: 1.1, i0Amorph: 0.85, savedMWh: 2.2, lamination: 0.025, p: 21};
// 1 µT line at 100 % load for the low-radiation design: x-z plane height/side, y-z plane height/side (m) [15]
export const UT1 = {
  160: [1.84, 1.3, 1.84, 1.0], 250: [2.0, 1.5, 2.0, 1.2], 400: [2.09, 1.6, 2.04, 1.3], 630: [2.26, 1.8, 2.21, 1.3],
  1000: [2.46, 2.1, 2.44, 1.5], 1250: [2.57, 2.2, 2.57, 1.6], 1600: [3.1, 2.3, 3.1, 2.0],
};
export const UT1_STANDARD = {630: 4.0, 1000: 4.3}; // m, the same line for a standard unit [15]
// HV voltage classes as the fuse table lists them: rated / highest voltage for equipment (kV) [50]
export const HV_CLASSES = [
  {un: 6, um: 7.2, key: '6/7.2'},
  {un: 10, um: 12, key: '10/12'},
  {un: 16, um: 17.5, key: '16'},
  {un: 20, um: 24, key: '20/24'},
  {un: 30, um: 36, key: '30/36'},
];
// HV HRC fuse and LV NH fuse recommendations (A) [50]: per rating, per HV class key, and the LV fuse at 400 V
const FUSES = {
  100: {'6/7.2': '20 / 25', '10/12': '16', 16: '10', '20/24': '10', '30/36': '6.3', lv: '150'},
  160: {'6/7.2': '31.5 / 40', '10/12': '20 / 25', 16: '16', '20/24': '16', '30/36': '10', lv: '250'},
  250: {'6/7.2': '50 / 63', '10/12': '31.5 / 40', 16: '20 / 25', '20/24': '16 / 20', '30/36': '16', lv: '350 / 400'},
  400: {'6/7.2': '80 / 100', '10/12': '50 / 63', 16: '31.5', '20/24': '25', '30/36': '20', lv: '600'},
  630: {'6/7.2': '125 / 160', '10/12': '80 / 100', 16: '50 / 63', '20/24': '40 / 50', '30/36': '31.5', lv: '1000'},
  1000: {'6/7.2': '160 / 200', '10/12': '125 / 160', 16: '80', '20/24': '63', '30/36': '40 / 50', lv: '1500'},
};
const HH_SIZES = [6.3, 10, 16, 20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315];
const NH_SIZES = [100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000];
// porcelain bushing stud torques by rated current [47]
export const TORQUES = [
  {a: 250, thread: 'M12', nm: 15},
  {a: 630, thread: 'M20', nm: 30},
  {a: 1000, thread: 'M30×2', nm: 75},
  {a: 2000, thread: 'M42×3', nm: 95},
  {a: 3150, thread: 'M48×3', nm: 110},
];
// lashing eye forces per eye (kg) [40]
export const LASHING = {small: {h: 115, d45: 170, v: 230}, big: {h: 170, d45: 240, v: 340}};
// aluminium oil pans [24][25]: max oil litres, inner L × B, outer L × B, height, weight with rails, EASY weight,
// EASY track gauges, article numbers (long side / short side screwable / closed; EASY long / short)
export const PANS = [
  {l: 330, li: 1400, bi: 1000, lo: 1450, bo: 1050, h: 250, kg: 40, kgEasy: 35, gauge: [520, 670], art: [22285, 22286, 22297], easy: [22551, 22552]},
  {l: 500, li: 1600, bi: 1050, lo: 1650, bo: 1100, h: 300, kg: 50, kgEasy: 45, gauge: [520, 670], art: [22287, 22288, 22298], easy: [22553, 22554]},
  {l: 600, li: 1700, bi: 1100, lo: 1750, bo: 1150, h: 320, kg: 55, kgEasy: 50, gauge: [520, 670], art: [22289, 22290, 22299], easy: [22555, 22556]},
  {l: 700, li: 1800, bi: 1250, lo: 1850, bo: 1300, h: 320, kg: 60, kgEasy: 55, gauge: [670, 820], art: [22291, 22292, 22300], easy: [22557, 22558]},
  {l: 800, li: 1950, bi: 1300, lo: 2000, bo: 1350, h: 320, kg: 70, kgEasy: 60, gauge: [670, 820], art: [22293, 22294, 22301], easy: [22559, 22560]},
  {l: 950, li: 2150, bi: 1450, lo: 2200, bo: 1500, h: 320, kg: 80, kgEasy: 70, gauge: [670, 820], art: [22295, 22296, 22302], easy: [22561, 22562]},
];
export const PAN_MARGIN = 300; // mm inner pan over the tank, VSE 2.19d-CH2021 [24]
export const PAN_INTEGRATED_MARGIN = 150; // mm all round, integrated pan [38]
export const PAN_RAIL_LOAD = 1000; // kg max wheel load on the STANDARD rails [23]
// insulating liquids [17]: fire / flash point (°C), biodegradability (%), life at 100 °C (years, tensile / DP), the
// water saturation curve (ppm at 20…120 °C, read off the chart), density and expansion (est.)
export const FLUIDS = {
  mineral: {name: 'Mineral oil', short: 'MINERAL', fire: 165, flash: 147, bio: 30, life: [35, 40], water: [40, 120, 280, 560, 900, 1450], rho: 0.88, beta: 0.00075, colour: '#d9a63c', hermeticOnly: false},
  synthetic: {name: 'Synthetic ester (MIDEL 7131)', short: 'SYNTH. ESTER', fire: 320, flash: 275, bio: 80, life: null, water: null, rho: 0.97, beta: 0.00075, colour: '#e6cd77', hermeticOnly: false},
  natural: {name: 'Natural ester (Envirotemp FR3)', short: 'NAT. ESTER FR3', fire: 360, flash: 330, bio: 99, life: [80, 100], water: [950, 1450, 1950, 2600, 3350, 4400], rho: 0.92, beta: 0.00074, colour: '#c8c25a', hermeticOnly: true},
};
// Buchholz relay contacts [43]: normal state NC 3-6 (alarm) and 1-5 (trip) closed; alarm closes NO 3-4; trip closes 1-2
export const BUCHHOLZ = {
  steps: ['Remove the cap of the test button', 'Normal state: NC 3–6 (alarm) and NC 1–5 (trip) closed', 'Press halfway: NO 3–4 (alarm) closes, NO 1–2 (trip) still open', 'Press fully: NO 3–4 and NO 1–2 both closed', 'Alarm contacts 3, 4, 6 · trip contacts 1, 2, 5'],
  contacts: (press) => ({c36: press < 0.45, c34: press >= 0.45, c15: press < 0.85, c12: press >= 0.85}),
};
// the overload chart examples [53]: preload 50 %, K2 = 1.3 for t hours, the permissible continuous load
export const OVERLOAD_MANUAL = [
  {ta: 10, hours: 8, cont: 1.1},
  {ta: 20, hours: 4, cont: 1.0},
  {ta: 30, hours: 3, cont: 0.9},
  {ta: 40, hours: 2, cont: 0.8},
];
// SIA 261 (not in the manual, which names the zones and classes [32]): design ground acceleration agd (m/s²), the soil
// factor S, the importance factor γf
export const SEISMIC = {
  zones: {Z1: 0.6, Z2: 1.0, Z3a: 1.3, Z3b: 1.6},
  soil: {A: 1.0, B: 1.2, C: 1.15, D: 1.35, E: 1.4},
  bwk: {I: 1.0, II: 1.2, III: 1.4},
  sfrs: 1.15, // R&S safety factor [33]
  reinforcedAbove: 5, // m/s² spectral acceleration that calls for the reinforced tank [32]
  slenderness: [1.5, 2.5], // typical s of distribution transformers [32]
};
// the regulated transformer's on-load tap changer [18][19]
export const ECOTAP = {name: 'MR ECOTAP VPD', positions: 9, stepMaxV: 825, um: 36, amps: [30, 100], ops: 500000, ratings: [400, 1000], stepPct: 2.5};
// What Maschinenfabrik Reinhausen publishes (PDF page numbers):
//   A  Operating instructions ECOTAP VPD 6107891/02 EN (2019), VPD III 30 / VPD I 100, Um 36 / 40.5 kV
//   B  Operating instructions ECOTAP VPD III 30D-24 8209941/05 EN (12/2025), Um 24 kV
//   F  Flyer ECOTAP VPD 24 kV IN10321801/01 EN (03/2025)
// The internal switching sequence, transition resistor values and the regulating range in % are not published; the
// model shows no invented sequence and keeps the 2.5 % step as an estimate.
export const MR = {
  docs: {
    A: 'MR 6107891/02 EN, ECOTAP VPD operating instructions (36/40.5 kV)',
    B: 'MR 8209941/05 EN, ECOTAP VPD III 30D-24 operating instructions (24 kV)',
    F: 'MR IN10321801/01 EN, ECOTAP VPD 24 kV flyer',
    D: 'MR connection diagram 8049432_01, ECOTAP VPD III 30D-24-09 09 0 (in B)',
  },
  principle: 'The on-load tap-changer is based on the high-speed resistor-type tap-changer principle and uses vacuum cells to change the tap position under load. In this process, the arc is extinguished while isolated in a vacuum cell, preventing contaminants from entering the oil.', // B p.13
  assemblies: ['Diverter switch assembly with transition resistor and vacuum interrupter', 'Selector assembly', 'Change-over selector assembly (17 positions)'], // A p.19–21
  variants: [
    {type: 'VPD III 30D-24', um: 24, ir: 30, uir: 550, positions: 9, va: 16500, doc: 'B p.131–132'},
    {type: 'VPD III 30', um: 36, ir: 30, uir: 825, positions: 9, va: 24750, isc: 600, ipk: 1500, doc: 'A p.65'},
    {type: 'VPD I 100', um: 36, ir: 100, uir: 825, positions: 9, va: 82500, isc: 2000, ipk: 5000, doc: 'A p.65'},
  ],
  withChangeOver: {uir: 550, positions: 17, um: 40.5, doc: 'A p.65'},
  tapChangeMs: 420, // B p.138
  coolingS: 3, // B p.14: the control keeps a cooling time of approx. 3 s after each operation
  perMinute: 20, // F p.3
  switchCapacity: 2, // × Ir at Uir, A p.11
  uirOverload: 10, // % short-time over Uir if Ir is not exceeded, A p.11
  oilTemp: [-25, 105], // °C mineral oil for tap-change operations; esters on request, A p.65
  types: 'Free breathing with oil conservator; entirely oil-filled sealed (no gas cushion); free breathing with air cushion only with a special variant, on request', // A p.65
  life: {ops: 500000, controlYears: 20}, // B p.124
  // voltage regulation (B p.13, parameters p.127): one measured phase, the supply voltage (p.138)
  avr: {
    desired: {range: [100, 240], def: 230},
    b1: {range: [0.5, 8], def: 2}, t1: {range: [3, 1800], def: 10},
    b2: {range: [3, 9], def: 4, minOverB1: 0.5}, t2: {range: [2, null], def: 2},
    block: {under: 85, over: 264},
  },
};
/** The ECOTAP variant MR documents for this unit: Um class, step voltage and the HV winding current. */
export function ecotapVariant(sp) {
  // the tap winding is part of the HV winding: in delta (Dyn) it sees the line voltage and In/√3, in star (Yzn) the
  // phase voltage and In
  const delta = sp.cfg.vector.startsWith('D');
  const step = ((sp.un1 * 1000) / (delta ? 1 : Math.sqrt(3)) * ECOTAP.stepPct) / 100;
  const iw = delta ? sp.i1 / Math.sqrt(3) : sp.i1;
  const um = sp.cls.um;
  const fits = MR.variants.filter((v) => v.um >= um && v.ir >= iw && v.uir >= step);
  const v = fits[0] ?? null;
  return {v, step, iw, um, stepOk: v ? step <= v.uir : false, ampsOk: v ? iw <= v.ir : false};
}
export const MAINT = [
  {every: '12 months', who: 'Expert', what: 'Inspection: oil level, drag-pointer temperature (max 100 °C), load, bushings and connections, tank leaks / rust, noise, room ≤ 40 °C', p: 57},
  {every: '5 years', who: 'Expert', what: 'Function check: switches and disconnectors, bushing bolts, earthing measurement, tap changer (switch back and forth), cleaning, protective devices', p: 57},
  {every: '12 y, then 5 y', who: 'Expert', what: 'Insulating oil check on free-breathing units (1.0 l standard test, 50 ml chlorine test); hermetic units only on suspected damage', p: 58},
];
export const SAFETY_RULES = ['Disconnect on all sides', 'Secure against reconnection', 'Verify absence of voltage', 'Earth and short-circuit', 'Cover adjacent live parts']; // p.8

// ------------------------------------------------------------------------------------------------ R&S documents
// Beyond the manual: the accessory sheet KD-00215 (Ausgabe 1/2018) and the order code KD-00053 (v1.0.1, 23.03.2017),
// both published by Rauscher & Stoecklin. Only what those sheets print.
export const RS_DOCS = {
  kd215: 'R&S KD-00215 Zubehör für Verteiltransformatoren, Ausgabe 1/2018',
  kd53: 'R&S KD-00053 Transformatoren Ordercode, v1.0.1, 23.03.2017',
};
export const THERMOMETER_RS = {range: [0, 100], ip: 'IP 54', cls: 1.5, thread: 'G1', body: 'stainless steel', art: {drag: 17073, contacts: 17074}, contacts: '2 microswitches', dragStandardFrom: 400};
// section "30 – Zubehör" of the order code
export const ORDER_CODES = {
  T1: 'Drag-pointer thermometer', T2: 'Drag-pointer thermometer with 2 contacts', T3: 'PT100 sensor (2-wire)', T4: 'PT100 sensor (3-wire)', T5: 'PT100 sensor (4-wire)', T6: 'AKM thermometer',
  A1: 'Level: dipstick', A2: 'Level: Niveaumeter', A3: 'Level: Niveaumeter with 2 contacts', A5: 'Level switch, reed', F: 'Magnetic level indicator G 1.5"',
  X: 'Expansion tank (conservator)', B: 'Buchholz protection', L: 'Dehydrating breather', V: 'Transformer monitoring device R.I.S', P: 'Transformer monitoring device DGPT',
  D1: 'Pressure relief valve G 1"', D2: 'Pressure relief valve G 1.5"', O: 'Wheel lock', R1: 'Nylon rollers (turn 90°)', R2: 'Cast rollers (turn 90°)',
};
// connection flags to DIN 42530 (KD-00215)
export const FLAGS = [{type: 'DT630', holes: '1 × Ø14', art: 15034, a: 630}, {type: 'DT1000', holes: '2 × Ø14', art: 15036, a: 1000}, {type: 'DT2000', holes: '4 × Ø14', art: 15040, a: 2000}, {type: 'DT3150', holes: '4 × Ø14', art: 15044, a: 3150}];
// PT100 lead colours per EN/IEC 60751, single element (as printed in WIKA data sheet TE 60.13, 03/2021, p.4)
export const PT100_COLOURS = {w2: ['red', 'white'], w3: ['red', 'red', 'white'], w4: ['red', 'red', 'white', 'white'], src: 'EN/IEC 60751 colour code, per WIKA TE 60.13 (03/2021) p.4'};

// ------------------------------------------------------------------------------------------------ options
// Each option: values, labels, the default, and where the manual describes it.
export const OPTIONS = {
  preset: {label: 'DATASHEET', values: ['none', 'dso1600'], fmt: (v) => (v === 'none' ? 'GENERIC (MODEL)' : PRESETS[v].code.split('-S-')[0]), def: 'none', p: 10},
  rating: {label: 'RATING', values: RATINGS, fmt: (v) => `${v} kVA`, def: 630, p: 12},
  hv: {label: 'HV', values: ['6', '10', '16', '20', '30', '10/20'], fmt: (v) => `${v} kV`, def: '20', p: 12},
  vector: {label: 'VECTOR GROUP', values: ['Dyn5', 'Dyn11', 'Yzn5', 'Yzn11'], def: 'Dyn5', p: 47},
  design: {label: 'TANK', values: ['breathing', 'hermetic', 'conservator'], fmt: (v) => ({breathing: 'FREE-BREATHING', hermetic: 'HERMETIC', conservator: 'CONSERVATOR'})[v], def: 'breathing', p: 30},
  core: {label: 'ACTIVE PART', values: ['standard', 'lowrad', 'amorphous'], fmt: (v) => ({standard: 'STANDARD CRGO', lowrad: 'LOW-RADIATION', amorphous: 'AMORPHOUS AMDT'})[v], def: 'standard', p: 12},
  tapchanger: {label: 'TAP CHANGER', values: ['offload', 'oltc'], fmt: (v) => (v === 'oltc' ? 'OLTC ECOTAP 9 POS' : 'OFF-LOAD ±2×2.5 %'), def: 'offload', p: 37},
  fluid: {label: 'FLUID', values: ['mineral', 'synthetic', 'natural'], fmt: (v) => FLUIDS[v].short, def: 'mineral', p: 16},
  hvBushing: {label: 'HV BUSHINGS', values: ['plugin', 'porcelain'], fmt: (v) => (v === 'plugin' ? 'PLUG-IN EN 50180' : 'PORCELAIN EN 50180'), def: 'plugin', p: 36},
  lvFlags: {label: 'LV TERMINALS', values: [false, true], fmt: (v) => (v ? 'WITH FLAGS' : 'STUDS EN 50386'), def: false, p: 39},
  monitor: {label: 'MONITORING', values: ['thermo', 'contacts', 'pt100', 'level', 'full', 'buchholz'], fmt: (v) => ({thermo: 'THERMOMETER', contacts: 'CONTACT THERMO', pt100: 'PT100 + THERMO', level: 'LEVEL + THERMO', full: 'FULL PROTECTION', buchholz: 'BUCHHOLZ + THERMO'})[v], def: 'thermo', p: 38},
  pan: {label: 'OIL PAN', values: ['none', 'integrated', 'standard', 'easy'], fmt: (v) => ({none: 'NONE', integrated: 'INTEGRATED', standard: 'ALU STANDARD', easy: 'ALU EASY'})[v], def: 'none', p: 23},
  screen: {label: 'HARMONICS', values: [false, true], fmt: (v) => (v ? 'SCREEN + INSULATION' : 'STANDARD'), def: false, p: 54},
  seismic: {label: 'MOUNTING', values: ['rollers', 'locks', 'vibrastop', 'quake'], fmt: (v) => ({rollers: 'ROLLERS', locks: 'WHEEL LOCKS', vibrastop: 'VIBRASTOP', quake: 'QUAKE KIT'})[v], def: 'rollers', p: 39},
  parallel: {label: 'PARALLEL', values: ['none', 'twin', 'smaller'], fmt: (v) => ({none: 'NONE', twin: 'IDENTICAL UNIT', smaller: 'NEXT SIZE DOWN'})[v], def: 'none', p: 47},
  zone: {label: 'SITE (SIA 261)', values: ['Z1', 'Z2', 'Z3a', 'Z3b'], fmt: (v) => `${v.toUpperCase()} · SOIL C · BWK II`, def: 'Z1', p: 32},
};
export const OPTION_KEYS = Object.keys(OPTIONS);
export const defaultConfig = () => Object.fromEntries(OPTION_KEYS.map((k) => [k, OPTIONS[k].def]));
export const optText = (k, v, cfg) => {
  const P = presetOf(cfg);
  if (P && k === 'hv') return `${(P.data.taps[P.data.ratedPos - 1] / 1000).toFixed(3)} KV · UM ${P.data.insHV.um}`;
  if (P && k === 'tapchanger') return `OFF-LOAD · ${P.data.taps.length} TAPS`;
  if (P && k === 'monitor') return 'BUCHHOLZ + T2 + NIVEAU';
  return OPTIONS[k].fmt ? OPTIONS[k].fmt(v) : String(v).toUpperCase();
};

/**
 * The rules the manual sets between options. Returns the fixed configuration and the notes about what changed and why;
 * `changed` names the key the visitor just set, so that one wins and the others give way.
 */
export function resolve(cfg0, changed = null) {
  const c = {...defaultConfig(), ...cfg0};
  const notes = [];
  const force = (k, v, why, p) => {
    if (c[k] !== v) {
      c[k] = v;
      notes.push({k, why, p});
    }
  };
  // a datasheet preset: choosing it sets every option; changing one of them leaves the datasheet for a generic model
  if (changed === 'preset' && c.preset !== 'none') Object.assign(c, PRESETS[c.preset].cfg);
  else if (c.preset && c.preset !== 'none' && changed && changed !== 'preset' && c[changed] !== PRESETS[c.preset].cfg[changed]) {
    notes.push({k: 'preset', why: `Changed from the ${PRESETS[c.preset].code.split('-S-')[0]} datasheet: generic model from here`, p: 10});
    c.preset = 'none';
    delete c.devices;
  }
  if (c.preset === 'none') delete c.devices;
  // natural esters only in hermetically sealed units [17]
  if (c.fluid === 'natural' && c.design !== 'hermetic') {
    if (changed === 'design') force('fluid', 'synthetic', 'Natural esters only in hermetic units', 17);
    else force('design', 'hermetic', 'Natural esters only in hermetic units', 17);
  }
  // OLTC: 400…1000 kVA, single HV (p.18–19); hermetic or free-breathing, hermetic and plug-in bushings standard (p.18–19)
  if (c.tapchanger === 'oltc') {
    const bad = c.rating < ECOTAP.ratings[0] || c.rating > ECOTAP.ratings[1] || c.hv === '10/20';
    if (bad && changed && changed !== 'tapchanger') {
      force('tapchanger', 'offload', 'ECOTAP only 400–1000 kVA with a single HV', 18);
    } else {
      if (c.rating < ECOTAP.ratings[0]) force('rating', ECOTAP.ratings[0], 'ECOTAP units: 400–1000 kVA', 18);
      if (c.rating > ECOTAP.ratings[1]) force('rating', ECOTAP.ratings[1], 'ECOTAP units: 400–1000 kVA', 18);
      if (c.hv === '10/20') force('hv', '20', 'HV-switchable units cannot take an OLTC', 19);
      if (changed === 'tapchanger') {
        force('design', 'hermetic', 'ECOTAP standard execution: hermetic', 19);
        force('hvBushing', 'plugin', 'ECOTAP standard: plug-in bushings EN 50180', 19);
      }
      if (c.design === 'breathing') notes.push({k: 'design', why: 'MR: air cushion only with a special ECOTAP variant, on request (MR 6107891 p.65)', p: 18});
      if (c.fluid !== 'mineral') notes.push({k: 'fluid', why: 'MR: ECOTAP in ester fluids on request (MR 6107891 p.65)', p: 18});
    }
  }
  // the hermetic full protection needs a hermetic tank; the Buchholz needs a conservator [38][39]
  if (c.monitor === 'full' && c.design !== 'hermetic') {
    if (changed === 'design') force('monitor', c.design === 'conservator' ? 'buchholz' : 'thermo', 'Full protection is a hermetic device', 38);
    else force('design', 'hermetic', 'Full protection (DGPT) is a hermetic device', 38);
  }
  if (c.monitor === 'buchholz' && c.design !== 'conservator') {
    if (changed === 'design') force('monitor', c.design === 'hermetic' ? 'full' : 'thermo', 'Buchholz relay sits in the conservator pipe', 39);
    else force('design', 'conservator', 'Buchholz relay sits in the conservator pipe', 39);
  }
  // earthquake anchoring: with a pan only the integrated one [35]
  if (c.seismic === 'quake' && (c.pan === 'standard' || c.pan === 'easy')) {
    if (changed === 'pan') force('seismic', 'locks', 'Quake anchoring only with the integrated pan', 35);
    else force('pan', 'integrated', 'Quake anchoring only with the integrated pan', 35);
  }
  // Yz windings belong to small units; above 400 kVA use Dyn (est. practice)
  if (c.vector.startsWith('Yz') && c.rating > 400) force('vector', c.vector === 'Yzn5' ? 'Dyn5' : 'Dyn11', 'Yzn groups for units ≤ 400 kVA (est.)', 47);
  return {cfg: c, notes};
}

// ------------------------------------------------------------------------------------------------ the datasheet
const nextUp = (list, x) => list.find((v) => v >= x - 1e-9) ?? list[list.length - 1];
export const vectorShift = (vg) => (vg.endsWith('11') ? 330 : 150); // degrees the LV lags the HV
/** The single-voltage HV (kV) the unit runs on now: for a 10/20 kV switchable unit, `level` 'I' is 10 kV, 'II' 20 kV. */
export const hvNow = (cfg, level = 'II') => (cfg.hv === '10/20' ? (level === 'I' ? 10 : 20) : Number(cfg.hv));
const hvClass = (un) => HV_CLASSES.find((c) => c.un >= un - 0.5) ?? HV_CLASSES[HV_CLASSES.length - 1];

/** Everything that follows from one configuration: ratings, losses, geometry, masses, protection, installation. */
export function spec(cfgIn) {
  const cfg = resolve(cfgIn).cfg;
  const S = cfg.rating;
  const un1 = hvNow(cfg);
  const un2 = 400;
  const herm = cfg.design === 'hermetic';
  const amorph = cfg.core === 'amorphous';
  const lowrad = cfg.core === 'lowrad';
  const fluid = FLUIDS[cfg.fluid];
  const ukP = UK_MANUAL[S] != null;
  const uk = UK_MANUAL[S] ?? UK_EST[S];
  const [p0Std, pk] = EU548[S];
  // amorphous: the manual's 630 kVA ratio (280 / 525) applied over the range [21]
  const p0 = amorph ? (S === 630 ? AMDT_630.p0Amorph : Math.round(p0Std * (AMDT_630.p0Amorph / AMDT_630.p0Std))) : S === 630 ? AMDT_630.p0Std : p0Std;
  const ur = (pk / (S * 1000)) * 100;
  const ux = Math.sqrt(Math.max(0, uk * uk - ur * ur));
  const i1 = (S * 1000) / (Math.sqrt(3) * un1 * 1000);
  const i2 = (S * 1000) / (Math.sqrt(3) * un2);
  const isc2 = i2 / (uk / 100);
  const isc1 = i1 / (uk / 100);
  // geometry, scaled from the 630 kVA unit by the quarter power of the rating (est.)
  const k = Math.pow(S / 630, 0.25);
  const core = {
    d: Math.round(190 * k * (amorph ? 1.08 : 1)), // limb circle, mm
    pitch: Math.round(400 * k), // limb centre to centre
    window: Math.round(470 * k * (0.9 + 0.1 * Math.min(1.6, un1 / 20))), // window height
    bPeak: amorph ? 1.35 : cfg.screen ? LIMITS.harmonicB : 1.7, // T
  };
  const lvR = [core.d / 2 + 10, core.d / 2 + 10 + Math.round(34 * k)];
  const gapHL = Math.round(14 + 0.9 * hvClass(un1).um * 0.6) + (cfg.screen ? 6 : 0);
  const hvR = [lvR[1] + gapHL, lvR[1] + gapHL + Math.round(52 * k * (0.85 + 0.15 * un1 / 20))];
  const coil = {lvR, hvR, h: core.window - 40, screen: cfg.screen ? lvR[1] + gapHL / 2 : 0};
  const yokeH = Math.round(core.d * 0.92);
  const active = {
    len: 2 * core.pitch + 2 * hvR[1],
    h: core.window + 2 * yokeH,
    w: 2 * hvR[1],
  };
  const Ptot = p0 + pk;
  const finDepth = Math.round((70 + 30 * Math.sqrt(Ptot / 1000)) * (herm ? 1.3 : 1)); // hermetic: deeper waves [12]
  const inner = {
    l: active.len + 170,
    b: active.w + 190 + (cfg.tapchanger === 'oltc' ? 120 : 0),
    h: active.h + 60 + 330 + (herm ? 40 : 0), // bottom clearance, leads and the air cushion under the lid
  };
  const tank = {
    li: inner.l, bi: inner.b, h: inner.h,
    l: inner.l + 2 * finDepth, b: inner.b + 2 * finDepth,
    fin: finDepth,
    finPitch: 45,
    lid: 8,
    lidOver: 40,
  };
  const gauge = S <= 250 ? 520 : S <= 1000 ? 670 : 820; // track gauges of the EASY pans [25]
  // rollers EN 50216-4, Ø125×40 on every size: nylon to 400 kVA, cast iron above, M24 bracket from 1600 kVA (KD-00215)
  const wheel = {d: 125, w: 40, mat: S <= 400 ? 'nylon' : 'cast iron', bolt: S >= 1600 ? 'M24' : 'M16'};
  const chassis = {h: 90, gauge, wheel, len: tank.bi + 140};
  const yTank = wheel.d + chassis.h; // tank floor above the ground (rollers mounted)
  // volumes and masses (est.): the oil fills the tank and the waves less the active part
  const finVol = 2 * (tank.li + tank.bi) / tank.finPitch * (finDepth * 10 * (tank.h - 160)) * 0.98;
  const activeVol = 3 * Math.PI * (hvR[1] ** 2) * coil.h * 0.55 + active.len * active.w * yokeH * 2 * 0.6;
  const tankVol = tank.li * tank.bi * (tank.h - (herm ? 10 : 140));
  const oilL = Math.round(((tankVol - activeVol + finVol) / 1e6) * 0.62); // calibrated: 630 kVA ≈ 480 l (est.)
  const consL = cfg.design === 'conservator' ? Math.round(oilL * 0.1) : 0;
  const oilTotalL = oilL + consL;
  const oilKg = Math.round(oilTotalL * fluid.rho);
  const massEst = Math.round(15 * Math.pow(S, 0.75) * (amorph ? 1.15 : 1) * (herm ? 1.05 : 1) * (lowrad ? 1.04 : 1));
  const mass = Math.max(massEst, oilKg + 200);
  const activeKg = Math.round((mass - oilKg) * 0.68);
  // centre of gravity and slenderness for the seismic check [32]: hc above the floor, ac to the tipping edge
  const hc = yTank + tank.h * 0.42;
  const ac = Math.min(gauge / 2, chassis.len / 2 - 70);
  const s = hc / ac;
  // pan selection [24]: inner ≥ tank + 300 mm, volume ≥ the oil
  const panFit = PANS.find((p) => p.li >= tank.l + PAN_MARGIN && p.bi >= tank.b + PAN_MARGIN && p.l >= oilTotalL) ?? null;
  const panCode = (variant) => {
    if (!panFit) return 'special size on request';
    const L = variant === 'easy' ? 'U' : 'L';
    return `WA${variant === 'easy' ? 'O' : 'F'}${L}-${panFit.li / 10}/${panFit.bi / 10}/${panFit.h / 10}`;
  };
  // LV bushing: the current class and the stud torque [47]; low-radiation: 8 bushings share the current [14]
  const lvBushA = nextUp(TORQUES.map((t) => t.a), lowrad ? i2 / 2 : i2);
  const lvTorque = TORQUES.find((t) => t.a === lvBushA);
  // fuses [50]: the table where it has the rating, else the manual's rule (HV fuse ≈ 2 × In, p.49)
  const cls = hvClass(un1);
  const ft = FUSES[S];
  const fuseHV = ft ? {a: ft[cls.key], p: 50} : {a: String(nextUp(HH_SIZES, 2 * i1)), p: 49, rule: true};
  const fuseLV = ft ? {a: ft.lv, p: 50} : {a: String(nextUp(NH_SIZES, i2 * 1.05)), p: 50, rule: true};
  // ventilation [44]: air 3 m³/min per kW, A = 0.188 P / √H
  const ventH = 2.0;
  const vent = {air: LIMITS.airPerKw * (Ptot / 1000), area: (0.188 * (Ptot / 1000)) / Math.sqrt(ventH), h: ventH};
  const ut1 = UT1[S] ?? null;
  const out = {
    cfg, S, un1, un2, cls, uk, ukP, ur, ux, p0, pk, p0Std, ptot: Ptot, i1, i2, isc1, isc2, lowrad, amorph, herm, fluid,
    core, coil, active, tank, chassis, yTank, finDepth,
    oilL: oilTotalL, oilKg, consL, mass, activeKg, hc, ac, s,
    panFit, panCode, lvBushA, lvTorque, lvCount: lowrad ? 8 : 4, fuseHV, fuseLV, vent, ut1,
    lash: S <= 1000 ? LASHING.small : LASHING.big,
    shift: vectorShift(cfg.vector),
    oltc: cfg.tapchanger === 'oltc',
    positions: cfg.tapchanger === 'oltc' ? ECOTAP.positions : 5,
    overall: {l: tank.l + 2 * tank.lidOver * 0, b: tank.b, h: yTank + tank.h + (cfg.hvBushing === 'porcelain' ? 330 : 200) * (0.8 + 0.2 * un1 / 20)},
  };
  const P = presetOf(cfg);
  return P ? applyPreset(out, P) : out;
}

/** A real unit: the datasheet's values replace the estimates, the geometry is fitted to its dimensions. */
function applyPreset(sp, P) {
  const d = P.data;
  const o = {...sp, preset: P, ds: d};
  o.un1 = d.taps[d.ratedPos - 1] / 1000;
  o.un2 = d.un2;
  o.taps = d.taps;
  o.ratedPos = d.ratedPos;
  o.positions = d.taps.length;
  o.cls = HV_CLASSES.find((c) => c.um === d.insHV.um) ?? hvClass(o.un1);
  o.uk = d.uk;
  o.ukP = 'ds';
  o.p0 = d.p0;
  o.pk = d.pk;
  o.ptot = d.p0 + d.pk;
  o.ur = (d.pk / (d.S * 1000)) * 100;
  o.ux = Math.sqrt(o.uk * o.uk - o.ur * o.ur);
  o.i1 = (d.S * 1000) / (Math.sqrt(3) * o.un1 * 1000);
  o.i2 = d.i2;
  o.isc1 = o.i1 / (o.uk / 100);
  o.isc2 = o.i2 / (o.uk / 100);
  // the tank over its waves to the datasheet's L × B; the active part shrinks if it would not fit (est. inside)
  const tank = {...sp.tank, l: d.dims.l, b: d.dims.b};
  tank.li = tank.l - 2 * tank.fin;
  tank.bi = tank.b - 2 * tank.fin;
  const fit = Math.min(1, (tank.li - 170) / sp.active.len, (tank.bi - 190) / sp.active.w);
  if (fit < 1) {
    const sc = (x) => Math.round(x * fit);
    o.core = {...sp.core, d: sc(sp.core.d), pitch: sc(sp.core.pitch)};
    o.coil = {...sp.coil, lvR: sp.coil.lvR.map(sc), hvR: sp.coil.hvR.map(sc), screen: sc(sp.coil.screen)};
    o.active = {...sp.active, len: sc(sp.active.len), w: sc(sp.active.w), h: Math.round(sp.core.window + 2 * Math.round(o.core.d * 0.92))};
  }
  // the height: the expansion tank's top is the datasheet's H; with the drum about 380 mm over the lid (as the model
  // builds it) the tank takes the rest, never less than the active part needs (est.)
  const cr = Math.round(110 + d.S / 40);
  tank.h = Math.max(sp.tank.h, d.dims.h - 2 * cr - 380 - sp.yTank - 10);
  o.tank = tank;
  o.chassis = {...sp.chassis, gauge: d.gauge, len: tank.bi + 140};
  o.consTop = d.dims.h; // the expansion tank's top sets the overall height
  o.overall = {...d.dims};
  o.oilL = d.oil.l;
  o.oilKg = d.oil.kg;
  o.consL = Math.round(d.oil.l * 0.1); // est.
  o.mass = d.mass.total;
  o.activeKg = d.mass.active;
  o.ac = Math.min(d.gauge / 2, o.chassis.len / 2 - 70);
  o.s = d.slenderness;
  o.hc = o.s * o.ac;
  o.lvBushA = nextUp(TORQUES.map((t) => t.a), o.i2);
  o.lvTorque = TORQUES.find((t) => t.a === o.lvBushA);
  o.fuseHV = {a: String(nextUp(HH_SIZES, 2 * o.i1)), p: 49, rule: true};
  o.fuseLV = {a: String(nextUp(NH_SIZES, o.i2 * 1.05)), p: 50, rule: true};
  o.vent = {air: LIMITS.airPerKw * (o.ptot / 1000), area: (0.188 * (o.ptot / 1000)) / Math.sqrt(sp.vent.h), h: sp.vent.h};
  o.panFit = PANS.find((p) => p.li >= tank.l + PAN_MARGIN && p.bi >= tank.b + PAN_MARGIN && p.l >= o.oilL) ?? null;
  o.chassis.wheel = {...sp.chassis.wheel, mat: 'cast iron'};
  return o;
}

// ------------------------------------------------------------------------------------------------ operating point
/** The tap position's HV turns factor: position 1 is +5 % turns (for a high grid), the middle is nominal. */
/** The rated tap: the datasheet's, else the middle position. */
export const ratedTap = (sp) => sp.ratedPos ?? Math.round((sp.positions + 1) / 2);
export const tapFactor = (sp, pos) => {
  if (sp.taps) return sp.taps[pos - 1] / sp.taps[sp.ratedPos - 1];
  const mid = (sp.positions + 1) / 2;
  return 1 + ((mid - pos) * LIMITS.tapStep) / 100;
};
/** The voltage drop at load K and power factor pf (%, IEC 60076 approximation). */
export const regulation = (sp, K, pf) => {
  const sin = Math.sqrt(Math.max(0, 1 - pf * pf));
  const a = K * (sp.ur * pf + sp.ux * sin);
  const b = K * (sp.ux * pf - sp.ur * sin);
  return a + (b * b) / 200;
};
/** LV line voltage at grid voltage ug (pu of the rated HV), tap position, load and pf. */
export const lvVoltage = (sp, ug, pos, K, pf) => (sp.un2 * ug) / tapFactor(sp, pos) * (1 - regulation(sp, K, pf) / 100);
/** The OLTC's choice: the position that brings the no-load LV closest to 400 V × (1 + the load drop) (a simple controller). */
export const oltcPosition = (sp, ug, K, pf) => {
  let best = (sp.positions + 1) / 2;
  let err = 1e9;
  for (let p = 1; p <= sp.positions; p++) {
    const e = Math.abs(lvVoltage(sp, ug, p, K, pf) - sp.un2);
    if (e < err - 1e-6) {
      err = e;
      best = p;
    }
  }
  return best;
};
/** Losses (W) at load K, the load losses corrected for the winding temperature (75 °C reference). */
export const losses = (sp, K, tw = 75) => {
  const kt = (235 + tw) / (235 + 75);
  return {p0: sp.p0, pk: sp.pk * K * K * kt, tot: sp.p0 + sp.pk * K * K * kt};
};
export const efficiency = (sp, K, pf) => {
  const P = sp.S * 1000 * K * pf;
  const L = losses(sp, K).tot;
  return P > 0 ? P / (P + L) : 0;
};

// ------------------------------------------------------------------------------------------------ thermal (IEC 60076-7)
// ONAN distribution transformer: oil exponent x 0.8, winding exponent y 1.6, hot-spot factor H 1.1, τo 180 min,
// τw 4 min; the rises the manual gives: top oil 60 K, average copper 65 K [12]. With an average oil rise of 0.8 × 60 K
// the gradient is 17 K and the hot spot sits 18.7 K over the top oil: 98.7 °C at rated load in 20 °C air, the
// reference for normal ageing. This reproduces the manual's permissible continuous loads (110 / 100 / 90 / 80 % at
// 10 / 20 / 30 / 40 °C) [53]; the 50 % → 130 % overload durations land within about 20 % of its charts.
export const THERMAL = {x: 0.8, y: 1.6, H: 1.1, tauO: 180, tauW: 4, dTo: LIMITS.riseTopOil, gr: LIMITS.riseWinding - 0.8 * LIMITS.riseTopOil, ref: 98};
export const lossRatio = (sp) => sp.pk / sp.p0;
/** Ultimate (steady) rises at load K: top oil over ambient, hot spot over top oil (K). */
/** cool: the factor on the oil rise when the cooling is impaired (1 normal); on: false when de-energised (no losses). */
export const ultimate = (sp, K, cool = 1, on = true) => {
  if (!on) return {oil: 0, hs: 0};
  const R = lossRatio(sp);
  return {
    oil: cool * THERMAL.dTo * Math.pow((1 + R * K * K) / (1 + R), THERMAL.x),
    hs: THERMAL.H * THERMAL.gr * Math.pow(K, THERMAL.y),
  };
};
export const steady = (sp, K, ta) => {
  const u = ultimate(sp, K);
  return {top: ta + u.oil, hot: ta + u.oil + u.hs};
};
/** Relative ageing rate (Montsinger: twice per 6 K over 98 °C) [52]. */
export const ageing = (hot) => Math.pow(2, (hot - THERMAL.ref) / LIMITS.montsinger);
/** One step of the thermal state {oil, hs, max} over dt minutes at load K and ambient ta. */
export const thermalStep = (sp, st, K, ta, dtMin, cool = 1, on = true) => {
  const u = ultimate(sp, K, cool, on);
  const ko = 1 - Math.exp(-dtMin / THERMAL.tauO);
  const kw = 1 - Math.exp(-dtMin / THERMAL.tauW);
  const oil = st.oil + (u.oil - st.oil) * ko;
  const hs = st.hs + (u.hs - st.hs) * kw;
  const top = ta + oil;
  return {oil, hs, top, hot: top + hs, max: Math.max(st.max ?? -99, top)};
};
/** The permissible continuous load at ambient ta: the K whose hot spot sits at 98 °C. */
export const continuousLoad = (sp, ta) => {
  let lo = 0;
  let hi = 2;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (steady(sp, m, ta).hot > THERMAL.ref) hi = m;
    else lo = m;
  }
  return Math.min(LIMITS.overloadMax, lo);
};
/** Hours of overload K2 after a preload K1 that keep one day's ageing at normal (24 h at 98 °C), max 24. */
export const overloadHours = (sp, K1, K2, ta) => {
  const day = (t) => {
    let st = {oil: ultimate(sp, K1).oil, hs: ultimate(sp, K1).hs};
    let age = 0;
    const dt = 2;
    for (let cyc = 0; cyc < 2; cyc++) {
      age = 0;
      for (let m = 0; m < 1440; m += dt) {
        const K = m >= 480 && m < 480 + t * 60 ? K2 : K1;
        st = thermalStep(sp, st, K, ta, dt);
        age += ageing(st.hot) * dt;
      }
    }
    return age / 1440;
  };
  if (day(0) > 1) return 0;
  let lo = 0;
  let hi = 24;
  if (day(hi) <= 1) return 24;
  for (let i = 0; i < 18; i++) {
    const m = (lo + hi) / 2;
    if (day(m) > 1) hi = m;
    else lo = m;
  }
  return lo;
};
/** Oil volume change (litres) and the level deviation (cm) from the 20 °C mark: 1 cm ≈ 10 K [41]. */
export const expansion = (sp, topOil) => {
  const dT = topOil - 20;
  return {litres: sp.oilL * sp.fluid.beta * dT, cm: dT / LIMITS.oilLevelPerCm};
};

// ------------------------------------------------------------------------------------------------ electrical, at θ
const PH = [0, -120, 120];
/**
 * The instantaneous electrical state at angle th (degrees): HV phase voltages (pu), limb fluxes (pu of the peak),
 * LV and HV winding currents (pu of rated, the HV shifted by the vector group), the magnetising current.
 */
export function electrical(sp, th, K, pf) {
  const phi = Math.acos(clamp(pf, 0, 1)) / D2R;
  const v = PH.map((p) => Math.sin((th + p) * D2R));
  const flux = PH.map((p) => -Math.cos((th + p) * D2R));
  const lv = PH.map((p) => K * Math.sin((th + p - phi - sp.shift) * D2R));
  // in a Dyn unit the HV winding on a limb carries the current that balances its own LV winding, so the limb's two
  // currents are in opposition; the line current is shifted by the group (the phasor panel shows it)
  const hv = lv.map((i) => -i);
  const line = PH.map((p) => K * Math.sin((th + p - phi) * D2R));
  const i0 = PH.map((p) => 0.004 * Math.sin((th + p - 90) * D2R) * (sp.amorph ? AMDT_630.i0Amorph / AMDT_630.i0Std : 1));
  return {v, flux, lv, hv, line, i0, phi};
}

// ------------------------------------------------------------------------------------------------ installation
/** Seismic check [32][33]: zone, soil, structure class → Se, the lift-off limit, the roller forces, the measures. */
export function seismic(sp, zone = 'Z1', soil = 'C', bwk = 'II') {
  const agd = SEISMIC.zones[zone] * SEISMIC.soil[soil] * SEISMIC.bwk[bwk];
  const Se = 3 * agd;
  const Si = 10 / Se;
  const s = sp.s;
  const m = sp.mass / 1000;
  const g = 9.81;
  const F = SEISMIC.sfrs;
  const FD = ((1.2 * Se * m * s) / 4 + (m * g) / 4) * F;
  const FA = -((1.2 * Se * m * s) / 4 - (m * g) / 4) * F;
  const FQ = ((Se * m) / 4) * F;
  const lift = Si < s;
  const reinforced = Se > SEISMIC.reinforcedAbove;
  let verdict;
  if (!lift && !reinforced) verdict = 'No lift-off; securing against sliding recommended';
  else if (!lift && reinforced) verdict = 'Reinforced tank; floor or rail fixing';
  else if (lift && !reinforced) verdict = 'Lift-off protection: floor or rail fixing (integrated pan only)';
  else verdict = 'Reinforced tank + floor or rail fixing (integrated pan only)';
  return {agd, Se, Si, s, FD, FA, FQ, lift, reinforced, verdict, sliding: FQ * 4 > sp.mass * g * 0.3 / 1000};
}
/** Load sharing of two units in parallel [49]: S1′ = S1 uk/uk1 with uk = Stot / Σ(Si/uki); the allowed total. */
export function parallel(sp) {
  const mode = sp.cfg.parallel;
  if (mode === 'none') return null;
  const i = RATINGS.indexOf(sp.S);
  const S2 = mode === 'twin' ? sp.S : RATINGS[Math.max(0, i - 1)];
  const uk2 = mode === 'twin' ? sp.uk : UK_MANUAL[S2] ?? UK_EST[S2];
  const S1 = sp.S;
  const uk1 = sp.uk;
  const Stot = S1 + S2;
  const uk = Stot / (S1 / uk1 + S2 / uk2);
  const s1 = (S1 * uk) / uk1;
  const s2 = (S2 * uk) / uk2;
  // the one with the lower uk saturates first: the allowed total keeps it at its rating
  const lim = Math.min(S1 / s1, S2 / s2);
  const ratio = Math.max(S1, S2) / Math.min(S1, S2);
  const dUk = (Math.abs(uk1 - uk2) / Math.min(uk1, uk2)) * 100;
  return {S1, S2, uk1, uk2, uk, s1, s2, Smax: Stot * lim, ok: ratio <= 3 && dUk <= 10, ratio, dUk};
}
/** The overload table for this unit at preload 50 % and K2 130 % against the manual's chart values [53]. */
export const overloadTable = (sp) => OVERLOAD_MANUAL.map((r) => ({...r, model: overloadHours(sp, 0.5, 1.3, r.ta), contModel: continuousLoad(sp, r.ta)}));

// ------------------------------------------------------------------------------------------------ the manual's parts
// Fig. 6 [29]: the numbered parts of the free-breathing unit, plus the options the later pages add.
export const PARTS = [
  {n: 1, key: 'tank', name: 'Tank with cooling waves', sub: 'STEEL, WELDED · EARTHED', p: 36, info: 'Welded sheet steel on a standard chassis; the corrugated walls carry the full losses away up to the highest ambient. Above 1000 m the thinner air cools less. In the hermetic unit the waves also take up the oil expansion.'},
  {n: 2, key: 'lid', name: 'Lid', sub: 'BOLTED OIL-TIGHT', p: 36, info: 'Carries the lifting lugs, bushings, tap changer drive, monitoring and the vents. The lid bolts must never be loosened (sealing lacquer on hermetic units).'},
  {n: 3, key: 'vent', name: 'Vent / filler / level check', sub: 'DIN 42553 · DIPSTICK', p: 37, info: 'Free-breathing: two weatherproof vents let the air cushion under the lid breathe; one cap holds the wooden dipstick. Transport only with the plugs in. Hermetic: a sealed filler pipe above the highest oil-carrying part instead.'},
  {n: 4, key: 'hv', name: 'HV bushings', sub: 'EN 50180 · 1U 1V 1W', p: 36, info: 'Three HV bushings: touch-proof plug-in outer-cone parts (straight or angled plugs) or porcelain bushings for indoor and outdoor use.'},
  {n: 5, key: 'lv', name: 'LV bushings', sub: 'EN 50386 · 2U 2V 2W 2N', p: 36, info: 'Porcelain bushings for the three phases and the neutral; flat connection flags on request. Low-radiation units have 8, arranged point-symmetrically and connected point-symmetrically.'},
  {n: 6, key: 'tap', name: 'Tap changer', sub: 'OFF-CIRCUIT · ±2×2.5 %', p: 37, info: 'Three-phase switch in the de-energised state only: positions 1–5. Switchable-HV units (e.g. 10/20 kV) carry a second knob for level I / II. Switch back and forth several times for good contact.'},
  {n: 7, key: 'lug', name: 'Lifting lugs', sub: 'SLING ANGLE ≥ 60°', p: 40, info: 'The only crane points. Keep the slings clear of bushings and fittings; angle α at least 60°. Never lift, pull or push by the waves.'},
  {n: 8, key: 'thermo', name: 'Thermometer pocket', sub: 'DRAG POINTER · 85 / 95 °C', p: 38, info: 'Dial thermometer of the top-oil temperature with a drag pointer for the maximum reached; optional contacts (alarm 85 °C, trip 95 °C, 250 V). Or a PT100 in 2-, 3- or 4-wire connection.'},
  {n: 9, key: 'lash', name: 'Lashing eyes', sub: '≤ 230 KG VERTICAL', p: 40, info: 'Four eyes for transport lashing: ≤ 1000 kVA 115 / 170 / 230 kg (horizontal / 45° / vertical), > 1000 kVA 170 / 240 / 340 kg per eye. Never anchor against earthquakes on them.'},
  {n: 10, key: 'plate', name: 'Rating plate', sub: 'LONG OR SHORT SIDE', p: 10, info: 'Rated power, frequency, serial no., type, standards, year, rated voltages and currents, measured uk, vector group, insulation levels, short-circuit current, winding material, measured losses, fluid, weights.'},
  {n: 11, key: 'roller', name: 'Rollers', sub: 'TURN 90° · Ø125 × 40', p: 37, info: 'Standard roller centre distances; each roller turns 90° for longitudinal or transverse travel. Mount only with the transformer lifted and supported.'},
  {n: 12, key: 'earth', name: 'Earth terminals', sub: 'M12 · 75 NM', p: 46, info: 'On the lid and low on the tank. Earth the MV cable screens only on the lid terminals.'},
  {n: 13, key: 'drain', name: 'Drain valve', sub: 'EN 50216-4 · OIL SAMPLE', p: 37, info: 'Lower drain and sampling device. Check it is tight at commissioning; samples need overpressure on hermetic units.'},
];
export const EXTRA_PARTS = {
  core: {name: 'Core', sub: '3-LIMB · STEPPED CRGO', info: 'Grain-oriented sheet, stepped limbs; the no-load losses come from re-magnetising it 100 times a second. The amorphous core uses 0.025 mm ribbon cast in a thousandth of a second: no crystal order, up to 60 % less no-load loss.'},
  lv: {name: 'LV winding', sub: 'COPPER FOIL · INNER', info: 'Close to the core: low voltage, high current.'},
  hv: {name: 'HV winding', sub: 'LAYER WINDING · OUTER', info: 'Many turns at 6–36 kV with the tap leads brought out for the tap changer.'},
  screen: {name: 'Earthed screen', sub: '−35 DB · ×1/55', info: 'Between HV and LV: damps HV-side transients 20 Hz–200 kHz by about 35 dB (factor 55) without touching the power transfer.'},
  oil: {name: 'Insulating fluid', sub: 'ONAN · NATURAL FLOW', info: 'Insulates and cools: heated in the windings it rises, spreads under the lid, sinks through the waves as it cools and returns at the bottom.'},
  conservator: {name: 'Conservator', sub: 'SILICA-GEL BREATHER', info: 'Takes the volume change of the fluid; the air passes a silica-gel breather. Light yellow gel: dry or replace. MIN on the level gauge: take out of service.'},
  buchholz: {name: 'Buchholz relay', sub: 'ALARM 3-4 · TRIP 1-2', info: 'Collects gas from an internal fault. Test: press halfway — alarm NO 3-4 closes; press fully — trip NO 1-2 closes as well.'},
  dgpt: {name: 'Full protection', sub: 'TEMP · LEVEL · PRESSURE · GAS', info: 'Hermetic units: one device for thermometer, level, pressure and gas detection, each with a potential-free contact.'},
  ecotap: {name: 'ECOTAP VPD', sub: '9 POS · 420 MS PER CHANGE', info: 'High-speed resistor-type on-load tap changer with vacuum cells (MR): per phase a selector assembly and a diverter switch assembly with transition resistor and vacuum interrupter; motor drive and control unit; 500,000 operations.'},
};
