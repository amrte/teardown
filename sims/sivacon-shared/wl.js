// SENTRON 3WL air circuit-breaker: the numbers and the logic behind the configurator. No three.js in here.
// Source: "3WL Air Circuit Breaker COM35 Communication Guide PROFINET IO, Modbus TCP", Equipment Manual 03/2020,
// L1V30536190-04 (in the sivacon repository), cited as COM35 + page. That manual covers communication, the trip unit's
// data and the COM35 module; it does not give the breaker's outer dimensions or the setting ranges of the trip unit,
// so those are marked [inferred] (typical catalogue values) and only shape the geometry and the curve on screen.

// ------------------------------------------------------------ frame sizes (Format 100, COM35 p.180: frame size 1/2/3)
// In: rated currents per size, the 2 digits of the order number (Format 103 bytes 5–6); w3/w4: width 3/4-pole
export const WL_SIZES = {
  '3WL11': {size: 1, In: [630, 800, 1000, 1250, 1600, 2000], classes: ['N', 'S', 'H'], w3: 320, w4: 410, h: 430, d: 420, kg: 62, minW: 400, loss: 1000},
  '3WL12': {size: 2, In: [800, 1000, 1250, 1600, 2000, 2500, 3200, 4000], classes: ['N', 'S', 'H', 'C'], w3: 460, w4: 590, h: 470, d: 440, kg: 92, minW: 600, loss: 3680},
  '3WL13': {size: 3, In: [4000, 5000, 6300], classes: ['H', 'C'], w3: 704, w4: 914, h: 470, d: 440, kg: 155, minW: 1000, loss: 8150},
};
// interrupting class (Format 99, COM35 p.180): byte value = order-number digit
export const WL_CLASS = {N: {code: 2, name: 'ECO breaking capacity N'}, S: {code: 3, name: 'Standard breaking capacity S'}, H: {code: 4, name: 'High breaking capacity H'}, C: {code: 5, name: 'Extremely high breaking capacity C'}};
// trip units: order-number letter (Format 103 byte 9, COM35 p.180), trip unit type code (Format 412, COM35 p.193)
export const WL_ETU = {
  '45B': {name: 'ETU45B', letter: 'E', code: 4, codeG: 6, face: 'rotary'},
  '45BD': {name: 'ETU45B with display', letter: 'F', code: 5, codeG: 7, face: 'rotary', display: true},
  '55B': {name: 'ETU55B', letter: 'Y', code: null, codeG: null, face: 'rotary', display: true},
  '76B': {name: 'ETU76B', letter: 'N', code: 13, codeG: 14, face: 'graphic', display: true, sets: true},
};
// rated-current digits of the order number
const inCode = (In) => String(Math.round(In / 100)).padStart(2, '0');

// ------------------------------------------------------------ protection settings [inferred: typical ETU ranges]
// L: overload IR (x In) and tR (s at 6 IR); S: short-time Isd (x IR) and tsd (s); I: instantaneous Ii (x In);
// G: ground fault Ig (x In) and tg (s). Data points 333–342 (COM35 p.106, Tab. 4-10).
export const WL_STEPS = {
  wlIr: {label: 'IR', unit: '× In', dp: 333, steps: [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9, 1]},
  wltR: {label: 'tR', unit: 's', dp: 335, steps: [2, 3.5, 5.5, 8, 10, 14, 17, 21, 25, 30]},
  wlIsd: {label: 'Isd', unit: '× IR', dp: 337, steps: [1.25, 1.5, 2, 2.5, 3, 4, 6, 8, 10, 12]},
  wltsd: {label: 'tsd', unit: 's', dp: 338, steps: [0.1, 0.2, 0.3, 0.4]},
  wlIi: {label: 'Ii', unit: '× In', dp: 336, steps: [1.5, 2.2, 3, 4, 6, 8, 10, 12, 15, 20]},
  wlIg: {label: 'Ig', unit: '× In', dp: 339, steps: [0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1], gf: true},
  wltg: {label: 'tg', unit: 's', dp: 340, steps: [0.1, 0.2, 0.3, 0.4, 0.5], gf: true},
};
export const WL_DEFAULT = {wlIr: 1, wltR: 10, wlIsd: 4, wltsd: 0.2, wlIi: 12, wlIg: 0.4, wltg: 0.2};

// the options a 3WL adds to the circuit-breaker field (the console shows those whose `when` holds)
const isWL = (f) => String(f.opts?.acb || '').startsWith('3WL');
export const WL_OPTIONS = [
  {key: 'wlIn', label: 'RATED CURRENT In', values: (f) => WL_SIZES[f.opts.acb].In, cols: 4, fmt: (v) => `${v} A`, when: isWL},
  {key: 'wlClass', label: 'BREAKING CAPACITY', values: (f) => WL_SIZES[f.opts.acb].classes, cols: 4, when: isWL},
  {key: 'wlEtu', label: 'TRIP UNIT ETU · D = WITH DISPLAY', values: Object.keys(WL_ETU), cols: 4, fmt: (v) => WL_ETU[v].name.replace('ETU', '').replace(' with display', ' D'), when: isWL},
  {key: 'wlGf', label: 'GROUND-FAULT MODULE', values: ['no', 'yes'], cols: 4, when: isWL},
  {key: 'wlPoles', label: 'POLES', values: [3, 4], cols: 4, when: isWL},
  {key: 'wlMount', label: 'DESIGN', values: ['withdrawable', 'fixed'], cols: 2, when: isWL},
  {key: 'wlMech', label: 'OPERATING MECHANISM', values: ['manual', 'motor'], cols: 2, when: isWL},
  {key: 'wlRel', label: 'AUXILIARY RELEASES', values: ['Y1+F1', 'Y1+F1+F2', 'Y1+F1+F3'], cols: 3, when: isWL},
  {key: 'wlCom', label: 'COMMUNICATION (X7)', values: ['COM35', 'none'], cols: 2, when: isWL},
  {key: 'wlDas', label: 'DAS MAINTENANCE MODE · SET B', values: ['off', 'on'], cols: 4, when: (f) => isWL(f) && f.opts.wlEtu === '76B' && f.opts.wlCom === 'COM35'},
];
export {isWL};

/** fill in and validate a 3WL's options */
export function normaliseWL(o) {
  const S = WL_SIZES[o.acb];
  if (!S.In.includes(o.wlIn)) o.wlIn = {1: 1600, 2: 3200, 3: 5000}[S.size];
  if (!S.classes.includes(o.wlClass)) o.wlClass = S.classes.includes('S') ? 'S' : S.classes[0];
  if (!WL_ETU[o.wlEtu]) o.wlEtu = '76B';
  if (!['no', 'yes'].includes(o.wlGf)) o.wlGf = 'no';
  if (![3, 4].includes(o.wlPoles)) o.wlPoles = 3;
  if (!['withdrawable', 'fixed'].includes(o.wlMount)) o.wlMount = 'withdrawable';
  if (!['manual', 'motor'].includes(o.wlMech)) o.wlMech = 'motor';
  if (!['Y1+F1', 'Y1+F1+F2', 'Y1+F1+F3'].includes(o.wlRel)) o.wlRel = 'Y1+F1';
  if (!['COM35', 'none'].includes(o.wlCom)) o.wlCom = 'COM35';
  if (!(o.wlEtu === '76B' && o.wlCom === 'COM35')) o.wlDas = 'off';
  else if (!['off', 'on'].includes(o.wlDas)) o.wlDas = 'off';
  for (const [k, s] of Object.entries(WL_STEPS)) if (!s.steps.includes(o[k])) o[k] = WL_DEFAULT[k];
  return o;
}

/** the breaker record the field builders and the layout read (same shape as a 3WA entry in BREAKERS) */
export function wlBreaker(o) {
  const S = WL_SIZES[o.acb];
  const four = o.wlPoles === 4;
  return {
    name: `${o.acb} · frame size ${['I', 'II', 'III'][S.size - 1]}`,
    In: [o.wlIn],
    w: four ? S.w4 : S.w3,
    h: S.h,
    d: S.d,
    kg: S.kg + (four ? 12 : 0),
    minW: four ? Math.max(S.minW, S.size === 1 ? 600 : S.size === 2 ? 800 : 1200) : S.minW,
    loss: S.loss * (o.wlIn / S.In[S.In.length - 1]) ** 2,
    tag: orderNo(o).slice(0, 7),
    wl: true,
    fixed: o.wlMount === 'fixed',
  };
}

/**
 * The order number after Format (103), COM35 p.180: 3WL · market · size · rated current - class · ETU · G/B · poles ·
 * connections - mechanism · 1st release · 2nd release · aux switch. The manual gives the meaning of every byte but
 * the code tables only for some; the others are shown as • .
 */
export function orderNo(o) {
  const S = WL_SIZES[o.acb];
  const E = WL_ETU[o.wlEtu];
  return `3WL1${S.size}${inCode(o.wlIn)}-${WL_CLASS[o.wlClass].code}${E.letter}${o.wlGf === 'yes' ? 'G' : 'B'}${o.wlPoles}•-••••`;
}

/** the set of protection values in force: set A, or set B in DAS maintenance mode (COM35 p.24–29) */
export function activeSettings(o) {
  const A = {Ir: o.wlIr, tR: o.wltR, Isd: o.wlIsd, tsd: o.wltsd, Ii: o.wlIi, Ig: o.wlIg, tg: o.wltg};
  if (o.wlDas !== 'on') return {...A, set: 'A'};
  // set B: the set A values adapted so there is no deliberate delay in short-circuit protection and the
  // instantaneous pickup is lower (example values; the real ones come from a coordination study)
  return {...A, Isd: Math.min(A.Isd, 2), tsd: 0.1, Ii: Math.min(A.Ii, 2.2), set: 'B'};
}

/** tripping time (s) at current I (A) for the typical L-S-I(-G) characteristic, or Infinity */
export function tripTime(o, I) {
  const P = activeSettings(o);
  const In = o.wlIn;
  const Ir = P.Ir * In;
  if (I >= P.Ii * In) return 0.03;
  if (I >= P.Isd * Ir) return P.tsd;
  if (I > 1.05 * Ir) return P.tR * ((6 * Ir) / I) ** 2;
  return Infinity;
}

/** COM35 position detection (COM35 p.30, Tab. 2-4): micro-switches S46 rear, S47 centre, S48 front */
export const POSITION = {
  connected: {s: [1, 0, 0], dp24: 1, text: 'Connected position'},
  test: {s: [0, 1, 0], dp24: 2, text: 'Test position'},
  disconnected: {s: [0, 0, 1], dp24: 0, text: 'Disconnected position'},
  removed: {s: [0, 0, 0], dp24: 3, text: 'Circuit breaker not available'},
};

/** what the COM35 reports over PROFINET / Modbus for this breaker in this position */
export function com35Data(o, pos) {
  const P = POSITION[pos] || POSITION.connected;
  const E = WL_ETU[o.wlEtu];
  const live = pos === 'connected' || pos === 'test';
  const A = activeSettings(o);
  return {
    position: P,
    live,
    rows: [
      ['DP 24 · position', `${P.dp24} · ${P.text.replace(' position', '')}`],
      ['S46 · S47 · S48', P.s.join(' · ')],
      ['DP 100 · frame size', live ? `${WL_SIZES[o.acb].size}` : '—'],
      ['DP 108 · poles', live ? (o.wlPoles === 4 ? '2 · 4 poles' : '1 · 3 poles') : '—'],
      ['DP 412 · trip unit', live ? `${(o.wlGf === 'yes' ? E.codeG : E.code) ?? 'n/a'} · ${E.name}${o.wlGf === 'yes' ? ' + G' : ''}` : '—'],
      ['DP 377 · rating plug', live ? `${o.wlIn} A` : '—'],
      ['DP 370 · parameter set', live ? A.set : '—'],
      ['DP 333 · IR', live ? `${Math.round(A.Ir * o.wlIn)} A` : '—'],
      ['DP 336 · Ii', live ? `${Math.round(A.Ii * o.wlIn)} A` : '—'],
    ],
    leds: {PN: 'green', TCP: 'green', CUB: live ? 'green' : pos === 'disconnected' ? 'flash' : 'off'},
  };
}
