// The SENTRON 3WL as a machine you operate: its mechanical state (contacts, closing spring, tripped / reclosing lockout,
// racking handle, crank turns, guide rails, the cubicle door), the guided procedures of the operating instructions
// (OI 6-1…6-11, 23-3, 23-4) that move it step by step with the part to operate named and highlighted, and the
// electronic trip unit: load and fault currents, the LEDs (OI 8-20), TEST / QUERY / CLEAR (OI 8-74), the ETU45B
// alphanumeric display (OI 8-30…8-41) and the ETU76B menu (OI 8-42…8-64). No three.js in here; the geometry reads the
// state every frame, the console drives it.
import {activeSettings, hasG, igA, settingsFor, WL_ETU, WL_SIZES, orderNo, WL_CLASS} from './wl.js';

// racking geometry [inferred]: travel from CONNECT in mm; crank turns counted from DISCON
export const RACK = {connected: 0, test: 60, disconnected: 115, rails: 520, removed: 1000};
export const TURNS = {disconnected: 0, dead: 6, test: 14, connected: 30};
/** breaker travel (mm from CONNECT) at a crank position (turns from DISCON); no movement for the first 6 turns (OI 6-11) */
export function rackAt(turns) {
  if (turns <= TURNS.dead) return RACK.disconnected;
  if (turns <= TURNS.test) return RACK.disconnected - ((turns - TURNS.dead) / (TURNS.test - TURNS.dead)) * (RACK.disconnected - RACK.test);
  return RACK.test - (Math.min(turns, TURNS.connected) - TURNS.test) / (TURNS.connected - TURNS.test) * RACK.test;
}
const turnsOf = {connected: TURNS.connected, test: TURNS.test, disconnected: 0};
/** the position the guide frame reports for a travel */
export function posAt(rack) {
  if (rack < 3) return 'connected';
  if (Math.abs(rack - RACK.test) < 4) return 'test';
  if (Math.abs(rack - RACK.disconnected) < 4) return 'disconnected';
  if (rack > RACK.disconnected + 20) return 'removed';
  return 'between';
}

// ------------------------------------------------------------ one state per breaker (kept across rebuilds)
const STATES = new Map();
export function wlState(key, m, o) {
  let st = STATES.get(key);
  if (!st) {
    const r = RACK[m.pos === 'removed' ? 'removed' : m.pos || 'connected'] ?? 0;
    st = {
      key,
      closed: (m.pos || 'connected') === 'connected',
      charged: o.wlMech === 'motor',
      tripped: false,
      cause: null, // the last trip cause, stored for QUERY (OI 6-7)
      phase: null,
      tripI: 0,
      turns: turnsOf[m.pos] ?? (m.pos === 'removed' ? 0 : TURNS.connected),
      rack: r,
      rails: m.pos === 'removed' ? 1 : 0,
      door: 0,
      handle: 0, // 0 stowed in its drawer, 1 pulled out and engaged
      latch: 0, // the control lever (mechanical release of the racking handle) lifted
      offPress: 0,
      onPress: 0,
      resetPress: 0,
      lever: 0, // spring charging lever stroke 0..1
      strokes: 0,
      motorRun: 0,
      proc: null,
      target: null,
      caption: '',
      load: 0.62, // load current, fraction of In
      fault: null,
      etu: {screen: 'oper', menu: [], cur: 0, edit: null, msg: null, msgT: 0, page: 0, pageT: 0, test: null, query: 0, change: null, t: 0, log: []},
    };
    STATES.set(key, st);
  }
  st.o = o;
  st.m = m;
  return st;
}
export function resetStates() {
  STATES.clear();
}

// ------------------------------------------------------------ guided procedures
// each step: label (what the operator does, as in the manual), target (the part to highlight), dur (s) and run(st, k)
// for k from 0 to 1. Every procedure is checked before it runs; a refusal names the missing condition.
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);
const press = (key) => (st, k) => (st[key] = Math.sin(Math.min(1, k) * Math.PI));
const handleSteps = (out) =>
  out
    ? [
        {label: 'Push the crank in', target: 'handle', dur: 0.8, run: (st, k) => (st.handle = 0.08 * Math.sin(k * Math.PI))},
        {label: 'Pull the racking handle out of its drawer', target: 'handle', dur: 1.2, run: (st, k) => (st.handle = 0.6 * ease(k))},
        {label: 'Lift and hold the control lever', target: 'latch', dur: 1.0, run: (st, k) => (st.latch = ease(k))},
        {label: 'Pull the crank fully out', target: 'handle', dur: 0.9, run: (st, k) => (st.handle = lerp(0.6, 1, ease(k)))},
      ]
    : [
        {label: 'Turn the crank back to its stow position', target: 'handle', dur: 0.8, run: (st, k) => (st.latch = 1 - ease(k))},
        {label: 'Push the racking handle back into its drawer', target: 'handle', dur: 1.2, run: (st, k) => (st.handle = 1 - ease(k))},
      ];
const crank = (from, to) => ({
  label: `Turn the crank ${to > from ? 'clockwise' : 'anticlockwise'} to the stop · ${Math.abs(to - from)} turns${to > from && from === 0 ? ' (no movement for the first 6)' : ''}`,
  target: 'crank',
  dur: 0.22 * Math.abs(to - from) + 0.6,
  run: (st, k) => {
    st.turns = lerp(from, to, Math.min(1, k * 1.04));
    st.rack = rackAt(st.turns);
  },
});

export const PROCS = {
  open: {
    label: 'Switch off',
    check: (st) => (!st.closed ? 'The breaker is already open' : null),
    steps: () => [{label: 'Press "Mechanical OFF" (O)', target: 'off', dur: 0.9, run: (st, k) => {
      press('offPress')(st, k);
      if (k > 0.5) st.closed = false;
    }}],
  },
  close: {
    label: 'Switch on',
    check: (st) => (st.closed ? 'The breaker is already closed' : st.tripped ? 'Tripped: press RESET first (reclosing lockout, OI 6-8)' : !st.charged ? 'Spring discharged: charge it first (READY not OK)' : st.rack > RACK.test + 2 && st.rack < RACK.removed - 1 && posAt(st.rack) !== 'test' && posAt(st.rack) !== 'disconnected' ? 'Rack to a defined position first' : st.handle > 0.05 ? 'Push the racking handle in first (OI 6-11)' : null),
    steps: (st) => [
      {label: 'Check READY "OK" and SPRING "CHARGED"', target: 'windows', dur: 1.1, run: () => {}},
      {label: 'Press "Mechanical ON" (I)', target: 'on', dur: 0.9, run: (s, k) => {
        press('onPress')(s, k);
        if (k > 0.5 && !s.closed) {
          s.closed = true;
          s.charged = false;
        }
      }},
      ...(st.o.wlMech === 'motor'
        ? [{label: 'The motor recharges the closing spring (≤ 12 s, OI 6-6)', target: 'windows', dur: 2.6, run: (s, k) => {
            s.motorRun = k < 1 ? 1 : 0;
            if (k >= 1) s.charged = true;
          }}]
        : []),
    ],
  },
  charge: {
    label: 'Charge the spring by hand',
    check: (st) => (st.charged ? 'The spring is already charged' : null),
    steps: () => [{label: 'Pump the charging lever down to the stop · 9 strokes (OI 6-4)', target: 'lever', dur: 6.3, run: (st, k) => {
      const s = k * 9;
      st.strokes = Math.min(9, Math.floor(s));
      st.lever = Math.sin((s % 1) * Math.PI);
      if (k >= 1) {
        st.charged = true;
        st.lever = 0;
      }
    }}],
  },
  reset: {
    label: 'Reset after a trip',
    check: (st) => (!st.tripped ? 'Not tripped' : null),
    steps: (st) => [
      {label: 'Press QUERY: the trip cause LED shows', target: 'etu', dur: 1.4, run: (s, k) => (s.etu.query = k < 1 ? 1 : 0)},
      {label: 'Press the RESET pin (BREAKER TRIPPED)', target: 'reset', dur: 1.0, run: (s, k) => {
        press('resetPress')(s, k);
        if (k > 0.5) s.tripped = false;
      }},
      ...(st.o.wlMech === 'motor' ? [] : [{label: 'Charge the spring: 9 strokes of the lever', target: 'lever', dur: 6.3, run: PROCS.charge.steps()[0].run}]),
    ],
  },
  rackIn: {
    label: 'Rack in to CONNECT',
    check: (st) => (st.rack >= RACK.removed - 1 ? 'Insert the breaker into the guide frame first' : st.rack < 3 ? 'Already connected' : st.closed ? 'Switch off first' : st.door > 0.1 ? 'Close the cubicle door first' : null),
    steps: (st) => [
      ...handleSteps(true),
      crank(st.turns, TURNS.connected),
      {label: 'Position indicator: CONNECT (red)', target: 'indicator', dur: 1.0, run: () => {}},
      ...handleSteps(false),
    ],
  },
  rackTest: {
    label: 'Rack to TEST',
    check: (st) => (st.rack >= RACK.removed - 1 ? 'Insert the breaker into the guide frame first' : posAt(st.rack) === 'test' ? 'Already in TEST' : st.closed ? 'Switch off first' : st.door > 0.1 ? 'Close the cubicle door first' : null),
    steps: (st) => [...handleSteps(true), crank(st.turns, TURNS.test), {label: 'Position indicator: TEST (blue) · aux circuits connected', target: 'indicator', dur: 1.0, run: () => {}}, ...handleSteps(false)],
  },
  rackOut: {
    label: 'Rack out to DISCON',
    check: (st) => (st.rack >= RACK.removed - 1 ? 'The breaker is out of the guide frame' : posAt(st.rack) === 'disconnected' ? 'Already disconnected' : st.closed ? 'Switch off first (the handle cannot come out while ON)' : null),
    steps: (st) => [...handleSteps(true), crank(st.turns, TURNS.disconnected), {label: 'Position indicator: DISCON (green) · shutter closed', target: 'indicator', dur: 1.0, run: () => {}}, ...handleSteps(false)],
  },
  withdraw: {
    label: 'Withdraw to maintenance',
    check: (st) => (posAt(st.rack) !== 'disconnected' ? 'Rack out to DISCON first' : st.closed ? 'Switch off first' : null),
    steps: () => [
      {label: 'Open the cubicle door', target: 'door', dur: 1.4, run: (st, k) => (st.door = ease(k))},
      {label: 'Pull both guide rails out', target: 'rails', dur: 1.4, run: (st, k) => (st.rails = ease(k))},
      {label: 'Pull the breaker forward onto the rails (maintenance position)', target: 'breaker', dur: 1.8, run: (st, k) => (st.rack = lerp(RACK.disconnected, RACK.rails, ease(k)))},
      {label: 'Lift it off with the crane at the carrying handles (hook Ø ≤ 12 mm, OI 4-2)', target: 'handles', dur: 2.0, run: (st, k) => (st.rack = lerp(RACK.rails, RACK.removed, ease(k)))},
    ],
  },
  insert: {
    label: 'Insert into the guide frame',
    check: (st) => (st.rack < RACK.removed - 1 ? 'The breaker is in the guide frame' : st.closed ? 'Switch off first' : null),
    steps: () => [
      {label: 'Check the position indicator shows DISCON; remove padlocks from the shutter (OI 6-1)', target: 'indicator', dur: 1.2, run: (st) => (st.door = Math.max(st.door, 1))},
      {label: 'Pull both guide rails out', target: 'rails', dur: 1.2, run: (st, k) => (st.rails = Math.max(st.rails, ease(k)))},
      {label: 'Set the breaker onto the rails', target: 'breaker', dur: 1.8, run: (st, k) => (st.rack = lerp(RACK.removed, RACK.rails, ease(k)))},
      {label: 'Push it into the disconnected position', target: 'breaker', dur: 1.6, run: (st, k) => {
        st.rack = lerp(RACK.rails, RACK.disconnected, ease(k));
        st.rails = 1 - ease(k);
        st.turns = 0;
      }},
      {label: 'Close the cubicle door', target: 'door', dur: 1.2, run: (st, k) => (st.door = 1 - ease(k))},
    ],
  },
  prepare: {
    label: 'Prepare for maintenance',
    check: () => null,
    steps: (st) => [
      ...(st.closed ? [{label: 'Press "Mechanical OFF"', target: 'off', dur: 0.9, run: (s, k) => {
        press('offPress')(s, k);
        if (k > 0.5) s.closed = false;
      }}] : []),
      {label: 'Press "Mechanical ON" (discharges the spring, OI 23-3)', target: 'on', dur: 0.9, run: (s, k) => press('onPress')(s, k)},
      {label: 'Press "Mechanical OFF" again: OPEN · DISCHARGED', target: 'off', dur: 0.9, run: (s, k) => {
        press('offPress')(s, k);
        if (k > 0.5) s.charged = false;
      }},
    ],
  },
};

/** start a procedure; returns the refusal reason or null */
export function startProc(st, name) {
  const P = PROCS[name];
  const why = P.check(st);
  if (why) return why;
  if (st.proc) return 'Wait: another operation is running';
  const steps = P.steps(st);
  st.proc = {name, label: P.label, steps, i: 0, t: 0};
  return null;
}

// ------------------------------------------------------------ the trip unit
const PHASE = [1.0, 1.03, 0.97];
/** phase currents in A right now (the load, or the injected fault on its phase) */
export function currents(st) {
  const o = st.o;
  const live = st.closed && posAt(st.rack) === 'connected';
  const In = o.wlIn;
  if (!live) return {I: [0, 0, 0], IN: 0, Ig: 0, live};
  const I = PHASE.map((k) => st.load * In * k);
  if (st.fault && st.fault.kind !== 'G') I[st.fault.phase] = st.fault.I;
  const Ig = st.fault?.kind === 'G' ? st.fault.I : 4;
  return {I, IN: st.load * In * 0.08, Ig, live};
}

/** the faults the operator can inject, with the current that triggers each protection */
export function faults(o) {
  const P = activeSettings(o);
  const In = o.wlIn;
  const list = [{kind: 'L', label: 'Overload 1.5 × IR', I: 1.5 * P.Ir * In}];
  if (P.Isd !== null && P.tsd !== null) list.push({kind: 'S', label: 'Short circuit 1.2 × Isd', I: 1.2 * P.Isd * In});
  if (P.Ii !== null) list.push({kind: 'I', label: `Short circuit 1.2 × Ii`, I: Math.min(1.2 * P.Ii * In, WL_SIZES[o.acb].icu[o.wlClass] * 1000)});
  if (hasG(o)) list.push({kind: 'G', label: 'Ground fault 1.5 × Ig', I: 1.5 * P.Ig});
  return list;
}
/** time to trip (s) for a fault */
function faultTime(o, f) {
  const P = activeSettings(o);
  const In = o.wlIn;
  if (f.kind === 'G') return P.tg ?? 0.1;
  const Ii = P.Ii !== null ? P.Ii * In : Infinity;
  if (f.I >= Ii) return 0.03;
  if (P.Isd !== null && P.tsd !== null && f.I >= P.Isd * In) return Math.max(0.03, P.tsd);
  return P.tR * ((6 * P.Ir * In) / f.I) ** 2;
}
export const TIME_X = 20; // overload trips are shown 20 x faster than real time
export function injectFault(st, kind) {
  if (!(st.closed && posAt(st.rack) === 'connected')) return 'Close the breaker in CONNECT first';
  const f = faults(st.o).find((x) => x.kind === kind);
  if (!f) return 'This trip unit has no such protection';
  st.fault = {...f, phase: 1, t: 0, tTrip: faultTime(st.o, f)};
  return null;
}
function trip(st, cause, I, phase) {
  st.closed = false;
  st.tripped = true;
  st.cause = cause;
  st.phase = phase;
  st.tripI = I;
  st.fault = null;
  const e = st.etu;
  e.log.unshift({cause, I: Math.round(I), phase: ['L1', 'L2', 'L3', 'N'][phase] || 'L2', t: e.t});
  e.log.length = Math.min(e.log.length, 5);
  if (WL_ETU[st.o.wlEtu].display) {
    e.screen = 'trip';
    e.msg = null;
  }
}

/** the LEDs (OI 8-20): ACTIVE flashes above Imin or with 24 V, ALARM steady at I ≥ IR, COMM with a CubicleBUS node */
export function leds(st, now) {
  const o = st.o;
  const S = WL_SIZES[o.acb];
  const c = currents(st);
  const P = activeSettings(o);
  const imax = Math.max(...c.I);
  const flash = Math.floor(now / 500) % 2 === 0;
  const powered = imax > S.imin || o.wlCom === 'COM35';
  const e = st.etu;
  const testL = e.test && e.test.phase === 'done';
  const q = e.query > 0;
  return {
    ACTIVE: powered && flash,
    ALARM: imax >= P.Ir * o.wlIn,
    COMM: o.wlCom === 'COM35',
    EXTEND: false,
    L: (q && st.cause === 'L') || testL,
    N: q && st.cause === 'N',
    S: q && st.cause === 'S',
    I: q && st.cause === 'I',
    G: q && st.cause === 'G',
    run: e.test && e.test.phase === 'run' ? Math.floor(now / 150) % 4 : -1,
  };
}

// ETU76B menu tree (OI 8-42…8-64)
export function menuTree(st) {
  const o = st.o;
  const P = activeSettings(o);
  const c = currents(st);
  const In = o.wlIn;
  const A = (x) => `${Math.round(x)} A`;
  const params = settingsFor(o).map((s) => ({label: s.label, key: s.key, steps: s.steps, value: () => o[s.key], unit: s.unit}));
  return {
    label: 'Main menu',
    items: [
      {label: 'Metering', items: [
        {label: 'Currents', lines: () => [`IL1 ${A(c.I[0])}`, `IL2 ${A(c.I[1])}`, `IL3 ${A(c.I[2])}`, `IN  ${A(c.IN)}`, `Ig  ${A(c.Ig)}`]},
        {label: 'Voltages', lines: () => (c.live ? ['V12 400 V', 'V23 401 V', 'V31 399 V'] : ['V12 0 V', 'V23 0 V', 'V31 0 V'])},
        {label: 'Power', lines: () => {
          const p = c.live ? (Math.sqrt(3) * 400 * (c.I[0] + c.I[1] + c.I[2]) / 3 * 0.92) / 1000 : 0;
          return [`P  ${p.toFixed(0)} kW`, `Q  ${(p * 0.43).toFixed(0)} kvar`, `S  ${(p / 0.92).toFixed(0)} kVA`, `PF ${c.live ? '0.92' : '—'}`];
        }},
        {label: 'Frequency', lines: () => [`f  ${c.live ? '50.00' : '—'} Hz`]},
      ]},
      {label: 'Diagnostic', items: [
        {label: 'Trip log', lines: () => (st.etu.log.length ? st.etu.log.map((l, i) => `${i + 1} ${l.cause}  ${l.phase}  ${l.I} A`) : ['No trips'])},
        {label: 'Maintenance', lines: () => ['Operations     214', 'Trips            ' + st.etu.log.length, 'Contacts       OK']},
      ]},
      {label: 'View Parameter', items: [
        {label: `Protection set ${P.set}`, lines: () => [`IR  ${A(P.Ir * In)}`, `tR  ${P.tR} s`, `Isd ${P.Isd !== null ? A(P.Isd * In) : '—'}`, `tsd ${P.tsd ?? 'OFF'} s`, `Ii  ${P.Ii !== null ? A(P.Ii * In) : 'OFF'}`, `IN  ${P.IN ?? 'OFF'}`, ...(P.Ig ? [`Ig  ${P.Ig} A`] : [])]},
      ]},
      {label: 'Change Parameter', items: [{label: 'Protection parameter', params}]},
      {label: 'Identification', lines: () => [`${WL_ETU[o.wlEtu].name}`, `${orderNo(o)}`, `In ${In} A (plug)`, `FS ${['I', 'II', 'III'][WL_SIZES[o.acb].size - 1]} · ${o.wlPoles}-pole`, `${WL_CLASS[o.wlClass].name.split(' ·')[0]} class`]},
      {label: 'Clear', items: [{label: 'Trip log', action: (s) => (s.etu.log = [], 'Trip log cleared')}, {label: 'Min/max values', action: () => 'Min/max cleared'}]},
      {label: 'Display Setup', lines: () => ['Contrast      60 %', 'Backlight    60 s', 'Default  Metering']},
    ],
  };
}
const nodeAt = (st) => st.etu.menu.reduce((n, i) => (n.items || n.params)[i], menuTree(st));

/** a key on the trip unit: up, down, esc, enter (ETU76B), up / down (ETU45B display), test, query, clear */
export function etuKey(st, k, setOpt) {
  const e = st.etu;
  const E = WL_ETU[st.o.wlEtu];
  if (k === 'test') {
    if (!e.test) e.test = {phase: 'run', t: 0, dur: Math.max(1.5, activeSettings(st.o).tR / 4)};
    return;
  }
  if (k === 'query') {
    e.query = 3;
    return;
  }
  if (k === 'clear') {
    if (e.test) e.test = null;
    st.cause = null;
    e.query = 0;
    e.msg = 'Trip cause cleared';
    e.msgT = 2;
    if (e.screen === 'trip') e.screen = 'oper';
    return;
  }
  if (E.face !== 'graphic') {
    // ETU45B: ▲ ▼ scroll the screens, autoscroll pauses for 20 s
    if (k === 'up' || k === 'down') {
      e.page = (e.page + (k === 'up' ? 3 : 1)) % 4;
      e.pageT = -20;
      if (e.screen === 'trip') e.screen = 'oper';
    }
    return;
  }
  // ETU76B
  if (e.screen === 'oper' || e.screen === 'trip') {
    if (k === 'enter') {
      e.screen = 'menu';
      e.menu = [];
      e.cur = 0;
    }
    return;
  }
  const node = nodeAt(st);
  if (e.edit) {
    const p = node.params[e.edit.i];
    if (k === 'up' || k === 'down') e.edit.j = Math.max(0, Math.min(p.steps.length - 1, e.edit.j + (k === 'up' ? 1 : -1)));
    else if (k === 'enter') {
      setOpt(p.key, p.steps[e.edit.j]);
      e.msg = `${p.label} saved`;
      e.msgT = 2;
      e.edit = null;
    } else if (k === 'esc') e.edit = null;
    return;
  }
  const list = node.items || node.params || null;
  if (k === 'esc') {
    if (e.menu.length) {
      e.cur = e.menu.pop();
    } else e.screen = 'oper';
    return;
  }
  if (!list) return;
  if (k === 'up') e.cur = (e.cur + list.length - 1) % list.length;
  else if (k === 'down') e.cur = (e.cur + 1) % list.length;
  else if (k === 'enter') {
    const it = list[e.cur];
    if (node.params) {
      e.edit = {i: e.cur, j: Math.max(0, it.steps.map(String).indexOf(String(it.value())))};
    } else if (it.action) {
      e.msg = it.action(st);
      e.msgT = 2;
    } else {
      e.menu.push(e.cur);
      e.cur = 0;
    }
  }
}

/** what the display shows now: {title, lines, sel (highlighted line), status} */
export function displayModel(st) {
  const e = st.etu;
  const o = st.o;
  const E = WL_ETU[o.wlEtu];
  const c = currents(st);
  const P = activeSettings(o);
  const A = (x) => `${Math.round(x)} A`;
  if (e.msg && e.msgT > 0) return {title: E.face === 'graphic' ? 'Message' : '', lines: [e.msg], status: ''};
  if (e.screen === 'trip' && st.tripped) {
    const lines = [`Trip.Cause    ${st.cause}`, `Tripped.Phase ${['L1', 'L2', 'L3', 'N'][st.phase] || 'L2'}`, `I = ${Math.round(st.tripI)} A`, 'Press RESET'];
    return {title: 'Tripping info', lines, status: `Set ${P.set}`};
  }
  if (e.change && e.change.t > 0) return {title: 'Parameter', lines: [e.change.text, e.change.sub], status: ''};
  if (E.face !== 'graphic') {
    // ETU45B: autoscroll pages every 5 s (OI 8-34)
    const pages = [
      [`I1 ${A(c.I[0]).padStart(10)}`, `I2 ${A(c.I[1]).padStart(10)}`, `I3 ${A(c.I[2]).padStart(10)}`, `IN ${A(c.IN).padStart(10)}`],
      [`Ig ${A(c.Ig).padStart(10)}`, '', 'Autoscroll', ''],
      [`Trips      ${e.log.length}`, 'Operations   214', '', ''],
      [`IR = ${P.Ir} x In`, `   = ${A(P.Ir * o.wlIn)}`, `tR = ${P.tR} s`, ''],
    ];
    return {title: '', lines: pages[e.page], status: ''};
  }
  if (e.screen === 'oper') {
    return {title: 'Metering', bars: [['IL1', c.I[0]], ['IL2', c.I[1]], ['IL3', c.I[2]], ['IN', c.IN]].map(([k, v]) => ({k, v, max: o.wlIn * 1.2, text: A(v)})), lines: [], status: `Set ${P.set}${o.wlDas === 'on' ? ' DAS' : ''} · ENTER: menu`};
  }
  const node = nodeAt(st);
  if (node.lines) return {title: node.label, lines: node.lines(), status: 'ESC: back'};
  if (node.params) {
    return {
      title: node.label,
      lines: node.params.map((p, i) => {
        const v = e.edit && e.edit.i === i ? p.steps[e.edit.j] : p.value();
        return `${p.label.padEnd(5)} ${String(v).padStart(6)}${e.edit && e.edit.i === i ? ' ◄' : ''}`;
      }),
      sel: e.cur,
      status: e.edit ? '▲▼ change · ENTER save · ESC' : 'ENTER: edit',
    };
  }
  return {title: node.label, lines: node.items.map((it) => it.label), sel: e.cur, status: 'ENTER · ESC'};
}

/** rotate a rotary coding switch (ETU15B…45B): the parameter-change display shows it for 4 s (OI 8-41) */
export function noteChange(st, label, text, sub) {
  st.etu.change = {t: 4, text: `${label} = ${text}`, sub};
}

// ------------------------------------------------------------ the clock
export function step(st, dt) {
  const e = st.etu;
  e.t += dt;
  if (e.msgT > 0) e.msgT -= dt;
  if (e.change) e.change.t -= dt;
  if (e.query > 0) e.query -= dt;
  e.pageT += dt;
  if (e.pageT > 5) {
    e.pageT = 0;
    e.page = (e.page + 1) % 2;
  }
  if (e.test) {
    e.test.t += dt;
    if (e.test.phase === 'run' && e.test.t > e.test.dur) {
      e.test.phase = 'done';
      e.test.t = 0;
    } else if (e.test.phase === 'done' && e.test.t > 6) e.test = null;
  }
  // a fault runs toward its trip; overloads are compressed TIME_X times
  if (st.fault) {
    if (!(st.closed && posAt(st.rack) === 'connected')) st.fault = null;
    else {
      const k = st.fault.kind === 'L' ? TIME_X : 1;
      st.fault.t += dt * k;
      if (st.fault.t >= st.fault.tTrip) trip(st, st.fault.kind, st.fault.I, st.fault.phase);
    }
  }
  // the procedure
  const p = st.proc;
  if (p) {
    const s = p.steps[p.i];
    p.t += dt;
    const k = Math.min(1, p.t / s.dur);
    s.run(st, k);
    st.target = s.target;
    st.caption = `${p.i + 1} / ${p.steps.length} · ${s.label}`;
    if (k >= 1) {
      p.i++;
      p.t = 0;
      if (p.i >= p.steps.length) {
        st.proc = null;
        st.target = null;
        st.caption = `${p.label}: done`;
        st.captionT = 3;
      }
    }
  } else if (st.captionT > 0) {
    st.captionT -= dt;
    if (st.captionT <= 0) st.caption = '';
  }
}
