// SENTRON 3WL1 air circuit-breaker: the numbers and the logic behind the configurator. No three.js in here.
// Sources in the sivacon repository:
//   OI  = "Manual for 3WL1 circuit breaker" 3ZW1012-0WL11-0AB1, 08/2015 (Segment 001–004 of Z_8714.pdf), page as printed
//   COM = "3WL COM35 Communication Guide" L1V30536190-04, 03/2020
// The manuals give the front panel (door cut-out 300 x 350 mm, OI 21-1), weights (OI 4-2), the mounting-bracket widths
// (OI 5-3), every trip-unit setting range (OI 8-22…8-29) and the maintenance sequence (OI 23). They do not give the
// breaker's height and depth or the racking travel; those are [inferred] and only shape the geometry.

// ------------------------------------------------------------ frame sizes
// w3/w4: body width 3/4-pole = mounting-bracket width c minus the brackets (OI 5-3: FS I 338/428, FS II 478/608; FS III
// [inferred]); kg / kgG: breaker / guide frame 3- and 4-pole (OI 4-2); icu: Icu at 440 V (OI 23-25, 2-2; C > 100 kA)
export const WL_SIZES = {
  '3WL11': {size: 1, In: [630, 800, 1000, 1250, 1600, 2000], classes: ['N', 'S', 'H'], icu: {N: 50, S: 65, H: 85}, w3: 320, w4: 410, h: 430, d: 420, kg: [47, 55], kgG: [27, 32], minW: 400, loss: 1000, imin: 80},
  '3WL12': {size: 2, In: [800, 1000, 1250, 1600, 2000, 2500, 3200, 4000], classes: ['N', 'S', 'H', 'C'], icu: {N: 55, S: 80, H: 100, C: 130}, w3: 460, w4: 590, h: 470, d: 440, kg: [85, 103], kgG: [54, 65], minW: 600, loss: 3680, imin: 80},
  '3WL13': {size: 3, In: [4000, 5000, 6300], classes: ['H', 'C'], icu: {H: 100, C: 150}, w3: 704, w4: 914, h: 470, d: 440, kg: [90, 108], kgG: [70, 119], minW: 1000, loss: 8150, imin: 150},
};
// interrupting class: order-number digit (COM Format 99; OI glossary 26-1)
export const WL_CLASS = {N: {code: 2, name: 'N · ECO breaking capacity'}, S: {code: 3, name: 'S · standard breaking capacity'}, H: {code: 4, name: 'H · high breaking capacity'}, C: {code: 5, name: 'C · Ics = Icu > 100 kA'}};
// the front panel is common to all frame sizes: door cut-out 300 x 350 mm, 65 mm above the mounting surface (OI 21-1)
export const PANEL = {w: 296, h: 346, bottom: 65, cutW: 300, cutH: 350};

// ------------------------------------------------------------ trip units (OI 8-1…8-29, function matrix 8-2)
// letter: order-number position 9 (COM Format 103; • where neither manual gives it); code: trip unit type (COM Format 412)
export const WL_ETU = {
  '15B': {name: 'ETU15B', letter: '•', code: null, codeG: null, g: 'none', face: 'rotary'},
  '25B': {name: 'ETU25B', letter: '•', code: null, codeG: null, g: 'none', face: 'rotary'},
  '27B': {name: 'ETU27B', letter: '•', code: null, codeG: null, g: 'std', face: 'rotary'},
  '45B': {name: 'ETU45B', letter: 'E', code: 4, codeG: 6, g: 'opt', face: 'rotary', bus: true},
  '45BD': {name: 'ETU45B with display', letter: 'F', code: 5, codeG: 7, g: 'opt', face: 'rotary', display: true, bus: true},
  '76B': {name: 'ETU76B', letter: 'N', code: 13, codeG: 14, g: 'opt', face: 'graphic', display: true, sets: true, bus: true},
};
export const hasG = (o) => WL_ETU[o.wlEtu].g === 'std' || (WL_ETU[o.wlEtu].g === 'opt' && o.wlGf === 'yes');

// ground-fault pickup letters A–E in amps (OI 8-29, also printed on the breaker front)
export const IG_TABLE = {small: {A: 100, B: 300, C: 600, D: 900, E: 1200}, large: {A: 400, B: 600, C: 800, D: 1000, E: 1200}};
export const igA = (o, letter) => IG_TABLE[WL_SIZES[o.acb].size === 3 ? 'large' : 'small'][letter];

/** the settings this trip unit has, with its real switch positions (OI 8-3…8-29) and data points (COM Tab. 4-10) */
export function settingsFor(o) {
  const e = o.wlEtu;
  const S = [];
  const add = (key, label, unit, dp, steps, fmt) => S.push({key, label, unit, dp, steps, fmt});
  add('wlIr', 'IR', '× In', 333, e === '15B' ? [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 1] : [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9, 1]);
  if (['45B', '45BD', '76B'].includes(e)) add('wltR', 'tR', 's', 335, [2, 3.5, 5.5, 8, 10, 14, 17, 21, 25, 30]);
  if (e !== '15B') {
    add('wlIsd', 'Isd', '× In', 337, [1.25, 1.5, 2, 2.5, 3, 4, 6, 8, 10, 12]);
    add('wltsd', 'tsd', 's', 338, e === '25B' || e === '27B' ? [0, 0.02, 0.1, 0.2, 0.3, 0.4] : e === '76B' ? [0.02, 0.08, 0.1, 0.2, 0.3, 0.4, 1, 2, 4, 'OFF'] : [0.02, 0.1, 0.2, 0.3, 0.4, 'OFF']);
  }
  if (e === '15B') add('wlIi', 'Ii', '× In', 336, [2, 3, 4, 5, 6, 7, 8]);
  else if (['45B', '45BD', '76B'].includes(e)) add('wlIi', 'Ii', '× In', 336, [1.5, 2.2, 3, 4, 6, 8, 10, 12, 'MAX', 'OFF']);
  if (e === '27B') add('wlIN', 'IN', '× In', 334, ['OFF', 1]);
  else if (e === '45B' || e === '45BD') add('wlIN', 'IN', '× In', 334, ['OFF', 0.5, 1]);
  else if (e === '76B') add('wlIN', 'IN', '× In', 334, ['OFF', 0.2, 0.5, 1, 1.5, 2]);
  if (hasG(o)) {
    add('wlIg', 'Ig', '', 339, ['A', 'B', 'C', 'D', 'E']);
    add('wltg', 'tg', 's', 340, [0.1, 0.2, 0.3, 0.4, 0.5]);
  }
  return S;
}
export const WL_DEFAULT = {wlIr: 1, wltR: 10, wlIsd: 4, wltsd: 0.2, wlIi: 12, wlIN: 1, wlIg: 'C', wltg: 0.2};

// the options a 3WL adds to the circuit-breaker field (the console shows those whose `when` holds)
const isWL = (f) => String(f.opts?.acb || '').startsWith('3WL');
export const WL_OPTIONS = [
  {key: 'wlIn', label: 'RATED CURRENT In · RATING PLUG', values: (f) => WL_SIZES[f.opts.acb].In, cols: 4, fmt: (v) => `${v} A`, when: isWL},
  {key: 'wlClass', label: 'BREAKING CAPACITY', values: (f) => WL_SIZES[f.opts.acb].classes, cols: 4, fmt: (v) => v, when: isWL},
  {key: 'wlEtu', label: 'TRIP UNIT ETU · D = WITH DISPLAY', values: Object.keys(WL_ETU), cols: 6, fmt: (v) => v.replace('BD', 'B D'), when: isWL},
  {key: 'wlGf', label: 'GROUND-FAULT MODULE GFM', values: ['no', 'yes'], cols: 4, when: (f) => isWL(f) && WL_ETU[f.opts.wlEtu]?.g === 'opt'},
  {key: 'wlPoles', label: 'POLES', values: [3, 4], cols: 4, when: isWL},
  {key: 'wlMount', label: 'DESIGN', values: ['withdrawable', 'fixed'], cols: 2, when: isWL},
  {key: 'wlMech', label: 'OPERATING MECHANISM', values: ['manual', 'motor'], cols: 2, when: isWL},
  {key: 'wlRel', label: 'AUXILIARY RELEASES · Y1 ALWAYS', values: ['F1', 'F1+F2', 'F1+F3', 'F1+F4'], cols: 4, when: isWL},
  {key: 'wlCom', label: 'COMMUNICATION (X7)', values: ['COM35', 'none'], cols: 2, when: (f) => isWL(f) && WL_ETU[f.opts.wlEtu]?.bus},
  {key: 'wlDas', label: 'DAS MAINTENANCE MODE · SET B', values: ['off', 'on'], cols: 4, when: (f) => isWL(f) && f.opts.wlEtu === '76B' && f.opts.wlCom === 'COM35'},
];
export {isWL};

/** fill in and validate a 3WL's options */
export function normaliseWL(o) {
  const S = WL_SIZES[o.acb];
  if (!S.In.includes(o.wlIn)) o.wlIn = {1: 1600, 2: 3200, 3: 5000}[S.size];
  if (!S.classes.includes(o.wlClass)) o.wlClass = S.classes.includes('S') ? 'S' : S.classes[0];
  if (!WL_ETU[o.wlEtu]) o.wlEtu = '76B';
  const g = WL_ETU[o.wlEtu].g;
  o.wlGf = g === 'std' ? 'yes' : g === 'opt' && o.wlGf === 'yes' ? 'yes' : 'no';
  if (![3, 4].includes(o.wlPoles)) o.wlPoles = 3;
  if (!['withdrawable', 'fixed'].includes(o.wlMount)) o.wlMount = 'withdrawable';
  if (!['manual', 'motor'].includes(o.wlMech)) o.wlMech = 'motor';
  if (!['F1', 'F1+F2', 'F1+F3', 'F1+F4'].includes(o.wlRel)) o.wlRel = 'F1';
  if (!WL_ETU[o.wlEtu].bus) o.wlCom = 'none';
  else if (!['COM35', 'none'].includes(o.wlCom)) o.wlCom = 'COM35';
  if (!(o.wlEtu === '76B' && o.wlCom === 'COM35')) o.wlDas = 'off';
  else if (!['off', 'on'].includes(o.wlDas)) o.wlDas = 'off';
  for (const s of settingsFor(o)) {
    const hit = s.steps.find((v) => String(v) === String(o[s.key]));
    if (hit !== undefined) {
      o[s.key] = hit;
      continue;
    }
    const d = WL_DEFAULT[s.key];
    o[s.key] = s.steps.includes(d) ? d : s.steps[Math.floor(s.steps.length / 2)];
  }
  return o;
}

/** the breaker record the field builders and the layout read (same shape as a 3WA entry in BREAKERS) */
export function wlBreaker(o) {
  const S = WL_SIZES[o.acb];
  const four = o.wlPoles === 4;
  const fixed = o.wlMount === 'fixed';
  return {
    name: `${o.acb} · frame size ${['I', 'II', 'III'][S.size - 1]}`,
    In: [o.wlIn],
    w: four ? S.w4 : S.w3,
    h: S.h,
    d: S.d,
    kg: S.kg[four ? 1 : 0] + (fixed ? 0 : S.kgG[four ? 1 : 0]),
    minW: four ? Math.max(S.minW, S.size === 1 ? 600 : S.size === 2 ? 800 : 1200) : S.minW,
    loss: S.loss * (o.wlIn / S.In[S.In.length - 1]) ** 2,
    tag: orderNo(o).slice(0, 7),
    wl: true,
    fixed,
  };
}

/**
 * The order number (COM Format 103; OI 2-1 example 3WL1232-4CB35-4GG2-Z): 3WL1 · size · rated current -
 * class · ETU · G/B · poles · installation (pos. 12) - mechanism · F1 (pos. 14) · 2nd release (pos. 15) · aux switches
 * (pos. 16). Codes the manuals give are filled in (releases for 208–240 V AC, OI 10-9/10-10); the others show •.
 */
export function orderNo(o) {
  const S = WL_SIZES[o.acb];
  const E = WL_ETU[o.wlEtu];
  const rel = o.wlRel.split('+')[1];
  const p15 = rel === 'F2' ? 'G' : rel === 'F3' ? 'N' : rel === 'F4' ? 'S' : 'A';
  return `3WL1${S.size}${String(Math.round(o.wlIn / 100)).padStart(2, '0')}-${WL_CLASS[o.wlClass].code}${E.letter}${hasG(o) ? 'G' : 'B'}${o.wlPoles}•-•G${p15}2`;
}

/** the protection values in force (Ir, Isd, Ii as × In; Ig in A): set A, or set B in DAS mode (COM p.24–29) */
export function activeSettings(o) {
  const e = o.wlEtu;
  const num = (v) => (v === 'OFF' || v === undefined ? null : v);
  const A = {
    Ir: o.wlIr,
    tR: ['45B', '45BD', '76B'].includes(e) ? o.wltR : 10,
    Isd: e === '15B' ? null : o.wlIsd,
    tsd: e === '15B' ? null : num(o.wltsd),
    Ii: e === '25B' || e === '27B' ? 20 : num(o.wlIi),
    IN: e === '15B' || e === '25B' ? null : num(o.wlIN),
    Ig: hasG(o) ? igA(o, o.wlIg) : null,
    tg: hasG(o) ? o.wltg : null,
  };
  // MAX = 0.8 x Ics (OI 8-24); tsd OFF and Ii OFF together are corrected to Ii = 1.5 x In
  if (A.Ii === 'MAX') A.Ii = Math.round((WL_SIZES[o.acb].icu[o.wlClass] * 800) / o.wlIn);
  if (A.Ii === null && A.tsd === null) A.Ii = 1.5;
  if (o.wlDas !== 'on') return {...A, set: 'A'};
  // set B: no deliberate short-circuit delay and a lower instantaneous pickup (example values; the real ones come from a
  // coordination study, COM p.29)
  return {...A, tsd: A.tsd === null ? null : 0.02, Ii: Math.min(A.Ii ?? 2.2, 2.2), set: 'B'};
}

/** tripping time (s) at current I (A): L as I²t through tR at 6 IR, S definite time, I instantaneous */
export function tripTime(o, I) {
  const P = activeSettings(o);
  const In = o.wlIn;
  const Ir = P.Ir * In;
  // ETU25B/27B: I fixed at 20 x In, max 50 kA (OI 8-6)
  const Ii = P.Ii !== null ? Math.min(P.Ii * In, o.wlEtu === '25B' || o.wlEtu === '27B' ? 50000 : Infinity) : Infinity;
  if (I >= Ii) return 0.03;
  if (P.Isd !== null && P.tsd !== null && I >= P.Isd * In) return Math.max(0.03, P.tsd);
  if (I > 1.05 * Ir) return P.tR * ((6 * Ir) / I) ** 2;
  return Infinity;
}

/** positions in the guide frame (OI 6-2) and the COM35 micro-switches S46 / S47 / S48 (COM p.30) */
export const POSITION = {
  connected: {s: [1, 0, 0], dp24: 1, text: 'Connected position', ind: 'CONNECT'},
  test: {s: [0, 1, 0], dp24: 2, text: 'Test position', ind: 'TEST'},
  disconnected: {s: [0, 0, 1], dp24: 0, text: 'Disconnected position', ind: 'DISCON'},
  removed: {s: [0, 0, 0], dp24: 3, text: 'Circuit breaker not available', ind: 'DISCON'},
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
      ['DP 412 · trip unit', live ? `${(hasG(o) ? E.codeG : E.code) ?? 'n/a'} · ${E.name}${hasG(o) ? ' + G' : ''}` : '—'],
      ['DP 377 · rating plug', live ? `${o.wlIn} A` : '—'],
      ['DP 370 · parameter set', live ? A.set : '—'],
      ['DP 333 · IR', live ? `${Math.round(A.Ir * o.wlIn)} A` : '—'],
      ['DP 336 · Ii', live ? (A.Ii === null ? 'OFF' : `${Math.round(A.Ii * o.wlIn)} A`) : '—'],
    ],
    leds: {PN: 'green', TCP: 'green', CUB: live ? 'green' : pos === 'disconnected' ? 'flash' : 'off'},
  };
}

// ------------------------------------------------------------ the maintenance teardown (OI chapter 23)
// step n runs while the counter goes from n to n + 1; the builders hang each part on its step (flyStep)
export const WL_MAINT = [
  {label: 'Prepare', sub: 'OFF · rack to DISCON (green) · ON · OFF: springs discharged (23-3)'},
  {label: 'Out of the guide frame', sub: 'Crank anticlockwise CONNECT → TEST → DISCON, rails out, lift off (23-4)'},
  {label: 'Front panel off', sub: '2 × PH2, refit 2.5 Nm · swing the charging lever down (23-11)'},
  {label: 'Arc chutes out', sub: 'One per pole · loosen hex 4 ≈ 15 mm, push cover back, lift · refit 8 Nm (23-5)'},
  {label: 'Main shaft retainer on', sub: 'Right side · press the contacts together, fix with PH2 (23-12)'},
  {label: 'Racking shaft out', sub: 'Retaining ring DIN 471-17×1, washer Ø30.1×Ø45×0.5, crank (23-15)'},
  {label: 'Current transformers out', sub: 'Cable-duct cover off, CT covers hex 5 · refit 10 Nm (23-16, 23-23)'},
  {label: 'Breaker feet off', sub: 'Hex 4 · refit 10 Nm (23-17, 23-22)'},
  {label: 'Rear wall off', sub: 'Hex 6 (FS III upper hex 8) · end-position retaining springs · refit 18 / 12 Nm (23-18, 23-21)'},
  {label: 'Upper fixed contacts out', sub: 'Bolts + nuts hex 5 per pole · refit 10 Nm (23-19)'},
  {label: 'Pole assemblies out', sub: 'Push out the coupling bolt · grease Isoflex Topas NB 52 on refit (23-19, 23-20)'},
];
export const NMAINT = WL_MAINT.length;
