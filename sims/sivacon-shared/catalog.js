// SIVACON S8, the numbers. Everything here is read from the documentation in the sivacon repository:
//   TIP   = "SIVACON S8 – Technische Informationen für die Planung" 02/2025 (page = PDF page)
//   OI-xx = the operating instructions 8PQ9800-… (Aufstellung, Feldverbund, El. Anschluss, Einschubtechnik OFFW,
//           Erden und Kurzschließen, Betrieb und Instandhaltung, Transport und Lagerung)
// Values the documents do not give (busbar cross-sections, device outer dimensions, sheet thickness) are marked
// [inferred]; they only shape the geometry and never a rating on screen. No three.js in here.

import {WL_OPTIONS, isWL, normaliseWL, wlBreaker} from './wl.js';

// ------------------------------------------------------------ tightening torques (Nm) by thread, OI El. Anschluss / Feldverbund
// 8.8 bolts with DIN 6796 conical spring washers (OI El. Anschluss p.9); M6 frame joint screw + nut 6 Nm and
// thread-forming M6 Torx T30 into sheet 4 Nm (OI Feldverbund p.6, Aufstellung p.14); M4 terminal carriers ~1.5 Nm
export const TORQUE = {4: 1.5, 6: 6, 8: 20, 10: 40, 12: 70, s6: 4, s4: 1.5};

// ------------------------------------------------------------ the field's vertical structure (TIP p.46, Abb. 4/3)
// frame 2200: head zone + 1800 device compartment + foot zone; frame 2000: 1600 device compartment
// height grid (OI OFFW p.6–7): head room row A = 225, rows B…U of 100 (half-rows of 50), base room = 175 + plinth
export const HEAD = 225;
export const FOOT = 175;
export const ROWS = 'BCDEFGHJKLMNPQRSTU';
export const devHeight = (H) => (H === 2000 ? 1600 : 1800);
export const POST = 40; // [inferred] frame profile, hole rows at 25 mm pitch
export const PITCH = 25;
export const DOOR_T = 25; // door adds 25 mm in front of the frame (TIP p.20, Abb. 2/2)
export const REAR_T = 25; // rear wall adds 25 mm
export const SIDE_T = 9; // end side wall 9 mm (36 mm with the design strip)
export const SIDE_DESIGN = 36;

// main busbar ratings: Ie ventilated / non-ventilated / Icw 1 s (TIP p.22, Tab. 2/9)
export const BUSBAR = {
  top: [
    [1190, 965, 35], [1630, 1310, 50], [1920, 1480, 65], [2470, 1870, 85], [3010, 2250, 100],
    [3270, 2450, 100], [3700, 3000, 100], [4660, 3680, 100], [5620, 4360, 150], [6300, 4980, 150],
  ],
  rear: [
    [1280, 1160, 50], [1630, 1400, 65], [2200, 1800, 65], [2520, 2010, 85], [2830, 2210, 100], [3170, 2490, 100],
    [4000, 3160, 100], [4910, 3730, 100], [5340, 4080, 100], [5780, 4440, 100], [7010, 5440, 150],
  ],
};
// conductor packs per phase (OI Feldverbund p.8–10 lists 2×20×10 … 2×6×50×10); which pack belongs to which rating
// is [inferred]. rows: bars one above the other, lams: laminations side by side in depth, h: bar height
export function barsFor(In) {
  const P = (rows, lams, h, txt) => ({rows, lams, h, n: rows * lams, txt});
  if (In <= 1300) return P(2, 1, 20, '2 × 20 × 10');
  if (In <= 1700) return P(2, 1, 30, '2 × 30 × 10');
  if (In <= 2250) return P(2, 2, 20, '4 × 20 × 10');
  if (In <= 2600) return P(2, 2, 30, '4 × 30 × 10');
  if (In <= 3300) return P(2, 2, 40, '4 × 40 × 10');
  if (In <= 4100) return P(2, 2, 50, '4 × 50 × 10');
  if (In <= 5000) return P(2, 3, 50, '6 × 50 × 10');
  if (In <= 5400) return P(2, 4, 40, '2 × 4 × 40 × 10');
  if (In <= 6300) return P(2, 4, 50, '2 × 4 × 50 × 10');
  return P(2, 6, 50, '2 × 6 × 50 × 10');
}
// frame-to-frame M6 joint heights above the frame bottom (OI Feldverbund p.5)
export const JOINT_Y = {2200: [100, 600, 1100, 1600, 2100], 2000: [100, 550, 1000, 1450, 1900]};
// feed points of the vertical distribution bar from a rear main busbar (OI OFFW p.9), above the frame bottom
export const FEED_Y = {2200: [337.5, 1462.5], 2000: [237.5, 1362.5]};
// [inferred] one transport unit holds fields up to this length; fishplate joints sit between transport units
export const TU_MAX = 2400;
export const UNIT_W = 507; // standard withdrawable unit width (OI OFFW p.10)
// field depths allowed per busbar position and current (TIP p.20, Tab. 2/6; single-front, front connection)
export function depthsFor(busbar, In) {
  if (busbar === 'top') return In <= 3270 ? [500, 800] : [800, 1000, 1200];
  return In <= 4000 ? [600] : [800];
}
// floor fixing: Ø14.8 holes for M12, 25 mm in from each side and from front and rear, a middle row 350 mm from the
// front (TIP p.105, Abb. 9/5–9/8)
export const FLOOR = {hole: 14.8, bolt: 12, edge: 25, mid: 350};

// ------------------------------------------------------------ system options (one per lineup)
export const SYSTEM = {
  tagline: 'LOW-VOLTAGE SWITCHBOARD • IEC 61439-2 • ≤ 690 V • ≤ 7010 A • ≤ 150 kA 1 s',
  options: [
    {key: 'height', label: 'FRAME H', values: [2000, 2200], cols: 4},
    {key: 'base', label: 'PLINTH', values: [0, 100, 200], cols: 4},
    {key: 'busbar', label: 'MAIN BB', values: ['top', 'rear-top', 'rear-bottom'], cols: 3, fmt: (v) => ({top: 'top', 'rear-top': 'rear top', 'rear-bottom': 'rear btm'})[v]},
    {key: 'In', label: 'RATED In A', values: (cfg) => (cfg.busbar === 'top' ? BUSBAR.top : BUSBAR.rear).map((r) => r[0]), cols: 6},
    {key: 'depth', label: 'DEPTH', values: (cfg) => depthsFor(cfg.busbar, cfg.In), cols: 4},
    {key: 'form', label: 'FORM', values: ['1', '2b', '3b', '4b'], cols: 4},
    {key: 'ip', label: 'IP', values: ['IP31', 'IP43', 'IP54'], cols: 4},
  ],
};

// ------------------------------------------------------------ circuit-breakers (TIP p.29–31, 108) [outer dims inferred]
// w x h x d: withdrawable breaker with its guide frame; minW: narrowest field for cable connection (Tab. 3/2, 3/3)
export const BREAKERS = {
  '3WA11': {name: '3WA11 · frame size I', In: [630, 800, 1000, 1250, 1600, 2000], w: 320, h: 430, d: 420, minW: 400, kg: 62, loss: 1000, tag: '3WA1116'},
  '3WA12': {name: '3WA12 · frame size II', In: [2000, 2500, 3200, 4000], w: 460, h: 470, d: 470, minW: 600, kg: 96, loss: 3680, tag: '3WA1232'},
  '3WA13': {name: '3WA13 · frame size III', In: [4000, 5000, 6300], w: 760, h: 470, d: 470, minW: 1000, kg: 160, loss: 8150, tag: '3WA1363'},
  '3VA': {name: '3VA15 MCCB, fixed', In: [400, 630, 800, 1000], w: 210, h: 320, d: 190, minW: 400, kg: 18, loss: 180, tag: '3VA1510', fixed: true},
};

/** the breaker a circuit-breaker field holds: a 3WA / 3VA from BREAKERS, or a configured 3WL (wl.js) */
export function breakerOf(f) {
  return isWL(f) ? wlBreaker(normaliseWL({...f.opts})) : BREAKERS[f.opts.acb] || BREAKERS['3WA12'];
}

// ------------------------------------------------------------ module kinds (what fills a device compartment)
// heights in mm on the 50 mm grid (TIP p.49, 55, 56); positions: the withdrawable unit's switching positions
// OI OFFW p.12–14: DISCONNECTED (green 0), TEST (blue), CONNECTED (red I); delivered in DISCONNECTED
const POS = ['connected', 'test', 'disconnected', 'removed'];
const range = (a, b, s = 50) => Array.from({length: Math.floor((b - a) / s) + 1}, (_, i) => a + i * s);
export const MODULE_KINDS = {
  hfd: {name: 'Withdrawable unit HFD', short: 'HFD', heights: [100, 150, 200, 250, 300, 400, 500, 600, 700, 800], positions: POS, label: '3VA12 250 A', lines: ['High Feature: moving contacts, door stays closed', 'Normal withdrawable 1/1 · 50 mm grid', 'Up to 40 aux contacts · coding 96/9216']},
  sfd: {name: 'Withdrawable unit SFD', short: 'SFD', heights: range(100, 400), positions: POS, label: '3RV2 · DOL', lines: ['Standard Feature: fixed contacts, unit slides', '≤ 250 A · IP30 in TEST / DISCONNECTED', 'Coding 15/21']},
  small: {name: 'Small withdrawable', short: 'SMALL', heights: [150, 200, 300], cols: [4, 2], positions: POS, label: '3RV2 · 15 kW', lines: ['Kleineinschub HFD · ¼ or ½ width', '≤ 35 A 16 mm² / ≤ 63 A 35 mm² terminals', 'Aux contacts 6 A 250 V']},
  fixed: {name: 'Fixed-mounted, compartment door', short: 'FIX', heights: [150, 200, 250, 300, 350, 400, 450, 500, 600], label: '3NP1 fuse switch', lines: ['Devices on mounting plates', 'Fed from the vertical distribution bars', 'Usable depth 310 mm']},
  empty: {name: 'Reserve compartment', short: 'RES', heights: [100, 150, 200, 300, 400, 500, 600], label: '', lines: ['Empty compartment, door fitted', 'Ready for a later unit']},
  plugadapt: {name: '3NJ63 plug-in adapter', short: '3NJ63', heights: [600], label: '5 strips', lines: ['Plug-in strips in the bottom 600 mm zone', '500 mm usable for strips · front connection']},
  cover: {name: 'Front-cover module', short: 'COVER', heights: [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600], label: '3VA20 160 A', lines: ['Devices on depth-adjustable carriers', 'Uniform front plane of covers', 'Usable depth 310 mm']},
  mcb: {name: 'MCB kit', short: 'MCB', heights: [150, 200, 300, 400, 450, 600], label: '24 TE per row', lines: ['24 modules × 18 mm per row', 'Row pitch 150 or 200 mm']},
  nj00: {name: '3NJ6303 strip · size 00', short: '00', heights: [50, 100], label: '160 A', lines: ['3NJ63 plug-in fuse switch-disconnector', 'Ie 125 A · 50 mm (3p) / 100 mm (4p)', 'Plugs on 60×10 or 80×10 vertical bars']},
  nj1: {name: '3NJ6313 strip · size 1', short: 'BG1', heights: [100, 150], label: '250 A', lines: ['3NJ63 plug-in fuse switch-disconnector', 'Ie 200 A · 100 mm (3p) / 150 mm (4p)']},
  nj2: {name: '3NJ6323 strip · size 2', short: 'BG2', heights: [200, 250], label: '400 A', lines: ['3NJ63 plug-in fuse switch-disconnector', 'Ie 320 A · 200 mm (3p) / 250 mm (4p)']},
  nj3: {name: '3NJ6333 strip · size 3', short: 'BG3', heights: [200, 250], label: '630 A', lines: ['3NJ63 plug-in fuse switch-disconnector', 'Ie 450 A · 200 mm (3p) / 250 mm (4p)']},
  blank: {name: 'Blanking cover, ventilated', short: 'VENT', heights: [50, 100, 200, 300], label: '', lines: ['50 mm plastic, 100/200/300 mm metal', 'Needed below each strip group (Tab. 5/8)']},
  nj410: {name: '3NJ410 strip · 160 A', short: '410', heights: [50], axis: 'x', label: '160 A', lines: ['3NJ4 in-line fuse switch-disconnector', 'Ie 117/136 A · 50 mm wide · M8 95 mm²']},
  nj412: {name: '3NJ412 strip · 250 A', short: '412', heights: [100], axis: 'x', label: '250 A', lines: ['3NJ4 in-line fuse switch-disconnector', 'Ie 200/220 A · 100 mm wide · M10 240 mm²']},
  nj413: {name: '3NJ413 strip · 400 A', short: '413', heights: [100], axis: 'x', label: '400 A', lines: ['3NJ4 in-line fuse switch-disconnector', 'Ie 290/340 A · 100 mm wide · M12 240 mm²']},
  nj414: {name: '3NJ414 strip · 630 A', short: '414', heights: [100], axis: 'x', label: '630 A', lines: ['3NJ4 in-line fuse switch-disconnector', 'Ie 380/460 A · 100 mm wide · M12 240 mm²']},
  capstage: {name: 'Capacitor module', short: 'CAP', heights: [300], label: '50 kvar · choked 7 %', lines: ['Contactor, reactor, 3 capacitors, fuses', 'Choked 5.67 / 7 / 14 % or unchoked', '6.0 W/kvar choked · 1.4 W/kvar unchoked']},
  capfuse: {name: 'Fuse-switch isolation', short: 'ISO', heights: [200], label: '3NP1 isolator', lines: ['Optional isolation of the PFC field']},
  fsa: {name: 'SINAMICS G120 FSA', short: 'FSA', heights: [100], axis: 'x', label: '≤ 3 kW', lines: ['PM240-2 frame size A · 100 mm wide', 'Cable 4 mm²']},
  fsb: {name: 'SINAMICS G120 FSB', short: 'FSB', heights: [125], axis: 'x', label: '≤ 7.5 kW', lines: ['PM240-2 frame size B · 125 mm wide', 'Cable 10 mm²']},
  fsc: {name: 'SINAMICS G120 FSC', short: 'FSC', heights: [150], axis: 'x', label: '≤ 15 kW', lines: ['PM240-2 frame size C · 150 mm wide', 'Cable 16 mm²']},
  fsd: {name: 'SINAMICS G120 FSD', short: 'FSD', heights: [225], axis: 'x', label: '≤ 45 kW', lines: ['PM240-2 frame size D · 225 mm wide', 'Cable 35 mm²']},
  fse: {name: 'SINAMICS G120 FSE', short: 'FSE', heights: [300], axis: 'x', label: '≤ 75 kW', lines: ['PM240-2 frame size E · 300 mm wide', 'Cable 70 mm²']},
  fsf: {name: 'SINAMICS G120 FSF', short: 'FSF', heights: [325], axis: 'x', label: '≤ 132 kW', lines: ['PM240-2 frame size F · 325 mm wide', 'Cable 2 × 120 mm²']},
  aux: {name: 'Auxiliary device compartment', short: 'AUX', heights: [300, 400, 500], label: 'meters, relays', lines: ['Hilfsgeräteträger: meters, protection relays', 'Own compartment door']},
  acb: {name: 'Air circuit-breaker, withdrawable', short: 'ACB', heights: [600, 700, 800], positions: POS, label: '', lines: ['Guide frame with racking crank', 'CONNECTED · TEST · DISCONNECTED · removed']},
  louvre: {name: 'Ventilated compartment', short: 'VENT', heights: [300, 400, 500, 600, 700, 800, 900, 1000], label: 'cable connection', lines: ['Louvred door, connection space behind', 'Optional fans for forced ventilation']},
};

// ------------------------------------------------------------ field types (TIP Tab. 2/12 p.24–25 and the chapters)
// widths: allowed frame widths; dev: device compartment width (rest is the cable compartment on the right);
// modules: kinds allowed in it; capacity(cfg, f): the space the modules share (height, or width for axis x)
export const FIELD_TYPES = {
  acb: {
    name: 'Circuit-breaker', short: '3WA / 3WL · ≤ 6300 A', glyph: 'acb', width: 800, widths: [400, 600, 800, 1000, 1200, 1400],
    modular: true, locked: true, fixedModules: true, compartment: 'BREAKER FIELD',
    options: [
      {key: 'acb', label: 'BREAKER', values: ['3WA11', '3WA12', '3WA13', '3WL11', '3WL12', '3WL13', '3VA'], cols: 4},
      {key: 'role', label: 'FUNCTION', values: ['infeed', 'outgoing', 'coupling']},
      {key: 'n', label: 'BREAKERS IN FIELD', values: [1, 2]},
      ...WL_OPTIONS,
    ],
    capacity: (cfg) => devHeight(cfg.height), dev: (W) => W, kg: [545, 800, 600],
    lines: ['Infeed, outgoing, bus-section coupling', '3-part door for Form 3a/4b', 'One CT set L1–L3 on the customer side'],
  },
  universal: {
    name: 'Universal mounting', short: 'MCC · ≤ 630 A', glyph: 'grid', width: 1000, widths: [600, 1000, 1200], devFrac: 0.6,
    modular: true, modules: ['hfd', 'sfd', 'small', 'fixed', 'empty', 'plugadapt'],
    capacity: (cfg) => devHeight(cfg.height), dev: () => 600, kg: [470, 1000, 600],
    lines: ['Withdrawable, fixed and plug-in combined', 'Device compartment 600 mm wide', 'Cable compartment 400 / 600 mm on the right'],
  },
  plugin: {
    name: 'In-line plug-in', short: '3NJ63 · ≤ 630 A', glyph: 'plug', width: 1000, widths: [1000, 1200], devFrac: 0.6,
    modular: true, modules: ['nj00', 'nj1', 'nj2', 'nj3', 'blank'], compartment: 'STRIP COMPARTMENT',
    capacity: (cfg) => (cfg.height === 2000 ? 1550 : 1750), dev: () => 600, kg: [440, 1000, 600],
    lines: ['Horizontal plug-in strips, size 3 at the bottom', 'Vertical bars 60×10 (1560 A) / 80×10 (2100 A)', 'Form 3b / 4b'],
  },
  fixedcover: {
    name: 'Fixed, front covers', short: '3VA / 3NP · ≤ 630 A', glyph: 'fixed', width: 1000, widths: [1000, 1200], devFrac: 0.6,
    modular: true, modules: ['cover', 'mcb', 'empty'],
    capacity: (cfg) => devHeight(cfg.height), dev: () => 600, kg: [470, 1000, 600],
    lines: ['Depth-adjustable device carriers', 'Field-high door, covers behind it', 'Form 1, 2b, 4a, 4b'],
  },
  nj4: {
    name: 'In-line fixed', short: '3NJ4 strips', glyph: 'inline', width: 800, widths: [600, 800, 1000],
    modular: true, modules: ['nj410', 'nj412', 'nj413', 'nj414'], axis: 'x', compartment: 'STRIPS · WIDTH',
    capacity: (cfg, f) => f.width - 100, dev: (W) => W - 100, kg: [470, 800, 800], needsRear: true,
    lines: ['Vertical fuse switch-disconnector strips', 'Horizontal distribution busbar at the rear', 'Rear main busbar only'],
  },
  pfc: {
    name: 'Power factor corr.', short: '≤ 500 kvar', glyph: 'cap', width: 800, widths: [800],
    modular: true, modules: ['capstage', 'capfuse'], compartment: 'CAPACITOR STAGES',
    capacity: (cfg) => devHeight(cfg.height), dev: () => 600, kg: [930, 800, 600],
    lines: ['Central reactive power compensation', 'Controller in the field-high door', 'Max 500 kvar per field'],
  },
  fc: {
    name: 'Frequency converter', short: 'G120 · ≤ 132 kW', glyph: 'inline', width: 600, widths: [400, 600, 800, 1000],
    modular: true, modules: ['fsa', 'fsb', 'fsc', 'fsd', 'fse', 'fsf'], axis: 'x', compartment: 'CONVERTERS · WIDTH',
    capacity: (cfg, f) => f.width - 100, dev: (W) => W - 100, kg: [420, 600, 600],
    lines: ['SINAMICS G120 PM240-2, full-height modules', 'Usable width = field width − 100 mm', 'Form 2b'],
  },
  ccs: {
    name: 'Free fixed / cable', short: 'CCS · mounting plate', glyph: 'blank', width: 600, widths: [200, 350, 400, 600, 800, 850, 1000],
    modular: false, options: [{key: 'plate', label: 'MOUNTING PLATE', values: ['perforated', 'plain', 'none']}],
    capacity: (cfg) => devHeight(cfg.height), dev: (W) => W, kg: [300, 600, 600],
    lines: ['Mounting plate for free configuration', 'Field extension, earthing (KSE/ZEP), reserve', 'Form 1, 2b'],
  },
};

// ------------------------------------------------------------ defaults
const M = (kind, h, extra = {}) => ({kind, h, cols: MODULE_KINDS[kind].cols ? MODULE_KINDS[kind].cols[0] : 1, label: MODULE_KINDS[kind].label, ...extra});

export function defaultModules(type, width, cfg, opts = {}) {
  const cap = FIELD_TYPES[type].capacity(cfg, {width});
  switch (type) {
    case 'acb': {
      const n = opts.n === 2 ? 2 : 1;
      const br = breakerOf({opts: {acb: '3WA12', ...opts}});
      const dev = devHeight(cfg.height);
      const ah = n === 2 ? 0 : 400;
      const bh = n === 2 ? Math.min(800, dev / 2) : br.h > 450 ? 800 : 700;
      const mods = [];
      if (ah) mods.push(M('aux', ah, {label: opts.role === 'coupling' ? 'coupling relay' : 'PAC4200 meter'}));
      for (let i = 0; i < n; i++) mods.push(M('acb', bh, {label: br.wl ? `${br.tag} ${br.In[0]} A` : `${br.tag} ${br.In[br.In.length - 1 - Math.min(i, 1)]} A`, pos: 'connected'}));
      const rest = dev - mods.reduce((a, m) => a + m.h, 0);
      if (rest > 0) mods.push(M('louvre', rest));
      return mods;
    }
    case 'universal':
      return [
        M('small', 150, {cols: 4, label: '3RV2 · 4 kW'}),
        M('small', 200, {cols: 2, label: '3RV2 · 15 kW'}),
        M('hfd', 300, {label: 'DOL 90 kW'}),
        M('hfd', 200, {label: '3VA12 250 A'}),
        M('hfd', 150, {label: '3VA11 160 A'}),
        M('sfd', 150, {label: '3VA10 100 A'}),
        M('hfd', 100, {label: 'DOL 11 kW'}),
        M('fixed', 300, {label: '3NP1153 400 A'}),
        M('empty', 150),
      ].reduce((a, m) => (a.sum + m.h <= cap ? {sum: a.sum + m.h, l: [...a.l, m]} : a), {sum: 0, l: []}).l;
    case 'plugin':
      return [
        M('nj00', 50), M('nj00', 50), M('nj00', 50), M('nj00', 50), M('blank', 100),
        M('nj1', 100), M('nj1', 100), M('nj1', 100), M('blank', 100),
        M('nj2', 200), M('nj2', 200), M('blank', 50),
        M('blank', 50), M('nj3', 200), M('blank', 100),
      ].reduce((a, m) => (a.sum + m.h <= cap ? {sum: a.sum + m.h, l: [...a.l, m]} : a), {sum: 0, l: []}).l;
    case 'fixedcover':
      return [M('cover', 300, {label: '3NP1163 630 A'}), M('cover', 250, {label: '3NP1143 250 A'}), M('cover', 150, {label: '3VA20 160 A'}), M('cover', 150, {label: '3VA20 160 A'}), M('mcb', 300, {label: '2 × 24 TE'}), M('cover', 250, {label: '3VA13 400 A'}), M('empty', 200)];
    case 'nj4': {
      const l = [M('nj414', 100), M('nj413', 100), M('nj412', 100), M('nj412', 100), M('nj410', 50), M('nj410', 50), M('nj410', 50), M('nj410', 50), M('nj410', 50), M('nj410', 50)];
      return l.reduce((a, m) => (a.sum + m.h <= cap ? {sum: a.sum + m.h, l: [...a.l, m]} : a), {sum: 0, l: []}).l;
    }
    case 'pfc':
      return [M('capfuse', 200), M('capstage', 300), M('capstage', 300), M('capstage', 300, {label: '50 kvar · choked 7 %'}), M('capstage', 300, {label: '2 × 25 kvar · choked 7 %'}), M('capstage', 300, {label: '2 × 12.5 kvar · choked 7 %'})].reduce(
        (a, m) => (a.sum + m.h <= cap ? {sum: a.sum + m.h, l: [...a.l, m]} : a),
        {sum: 0, l: []},
      ).l;
    case 'fc': {
      const l = [M('fse', 300), M('fsd', 225), M('fsc', 150), M('fsb', 125), M('fsa', 100), M('fsa', 100)];
      return l.reduce((a, m) => (a.sum + m.h <= cap ? {sum: a.sum + m.h, l: [...a.l, m]} : a), {sum: 0, l: []}).l;
    }
    default:
      return [];
  }
}

export function newField(type, cfg) {
  const T = FIELD_TYPES[type];
  return {type, width: T.width, opts: {}, modules: defaultModules(type, T.width, cfg)};
}

const field = (type, width, opts = {}, cfg = {height: 2200}) => ({type, width, opts, modules: defaultModules(type, width, cfg, opts)});

export const DEFAULT = {
  height: 2200, base: 100, busbar: 'rear-top', In: 4000, depth: 600, form: '4b', ip: 'IP43', designStrip: true,
  fields: [
    field('acb', 800, {acb: '3WA12', role: 'infeed', n: 1}),
    field('universal', 1000),
    field('plugin', 1000),
    field('fixedcover', 1000),
    field('pfc', 800),
  ],
};
export const PRESETS = {
  standard: DEFAULT,
  mcc: {
    height: 2200, base: 100, busbar: 'rear-top', In: 2520, depth: 600, form: '4b', ip: 'IP43', designStrip: true,
    fields: [field('acb', 600, normaliseWL({acb: '3WL11', role: 'infeed', n: 1, wlIn: 2000})), field('universal', 1000), field('universal', 1000), field('universal', 1200), field('fc', 800), field('ccs', 400, {plate: 'perforated'})],
  },
  small: {
    height: 2000, base: 100, busbar: 'rear-top', In: 1630, depth: 600, form: '2b', ip: 'IP31', designStrip: false,
    fields: [field('acb', 400, {acb: '3WA11', role: 'infeed', n: 1}, {height: 2000}), field('nj4', 800, {}, {height: 2000}), field('fixedcover', 1000, {}, {height: 2000})],
  },
};

// ------------------------------------------------------------ normalise: make any configuration valid and tag it
export function normalise(cfg) {
  const c = {...structuredClone(DEFAULT), ...cfg};
  if (![2000, 2200].includes(c.height)) c.height = 2200;
  if (![0, 100, 200].includes(c.base)) c.base = 100;
  if (!['top', 'rear-top', 'rear-bottom'].includes(c.busbar)) c.busbar = 'rear-top';
  const list = (c.busbar === 'top' ? BUSBAR.top : BUSBAR.rear).map((r) => r[0]);
  if (!list.includes(c.In)) c.In = list.reduce((b, v) => (Math.abs(v - c.In) < Math.abs(b - c.In) ? v : b), list[0]);
  const ds = depthsFor(c.busbar, c.In);
  if (!ds.includes(c.depth)) c.depth = ds[0];
  c.fields = (c.fields || []).filter((f) => FIELD_TYPES[f.type]);
  if (!c.fields.length) c.fields = [newField('universal', c)];
  c.fields.forEach((f, i) => {
    const T = FIELD_TYPES[f.type];
    if (!T.widths.includes(f.width)) f.width = T.width;
    f.opts = f.opts || {};
    for (const o of T.options || []) {
      if (o.when) continue;
      if (!o.values.map(String).includes(String(f.opts[o.key] ?? o.values[0]))) f.opts[o.key] = o.values[0];
    }
    if (f.type === 'acb') {
      f.opts.acb = f.opts.acb || '3WA12';
      f.opts.role = f.opts.role || 'infeed';
      f.opts.n = f.opts.n === 2 && !['3WA13', '3WL13'].includes(f.opts.acb) ? 2 : 1;
      if (isWL(f)) normaliseWL(f.opts);
    }
    f.modules = (f.modules || []).filter((m) => MODULE_KINDS[m.kind]);
    if (T.fixedModules) {
      const keep = f.modules.filter((m) => m.kind === 'acb').map((m) => m.pos);
      f.modules = defaultModules(f.type, f.width, c, f.opts);
      f.modules.filter((m) => m.kind === 'acb').forEach((m, j) => (m.pos = keep[j] || 'connected'));
    }
    // modules that no longer fit are dropped from the end
    const cap = T.capacity(c, f);
    let sum = 0;
    f.modules = f.modules.filter((m) => (sum + m.h <= cap ? ((sum += m.h), true) : false));
    f.tag = `+A${String(i + 1).padStart(2, '0')}`;
  });
  return c;
}
