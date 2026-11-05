// SENTRON 3WL trip unit ETU76B: the graphical display as the operating instructions describe it (OI 8-42…8-64).
// Operating screen CURRENT; ESC opens MAIN MENU; ▲ ▼ move the marking or change a value; ENTER selects or accepts;
// ESC goes back. Parameter changes end in "Save Parameter Changes? ENTER = YES ESC = NO", clearing in "Are You Sure
// You Want To Clear?". Change Parameter, Clear and Display Setup need the 4-digit password (default 0000). The status
// line shows key · wrench · PAR A/B · pencil · TRIG A/B · ⇕/ESC. Not shown in the manual and [inferred] here: the
// password prompt, the contents of Warnings / Setpoints / CubicleBUS / Communication, the Uavg, S, Q, pf, W and Temp
// sub-screens, the System Config. values, the step sizes, and the example counter values.
import {activeSettings, hasG, igA, orderNo, setB, settingsFor, WL_SIZES} from './wl.js';
import {currents, displayModel, etuActive, leds, v24} from './wl_sim.js';

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const p2 = (n) => String(n).padStart(2, '0');
const A = (x) => `${Math.round(x)} A`;
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
function dateOf(m, d) {
  const y = p2(d.getFullYear() % 100);
  if (m.disp.date === 'MM/DD/YY') return `${p2(d.getMonth() + 1)}/${p2(d.getDate())}/${y}`;
  if (m.disp.date === 'YYYY-MM-DD') return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  return `${p2(d.getDate())}-${MON[d.getMonth()]}-${y}`;
}
const timeOf = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.${p2(Math.floor(d.getMilliseconds() / 10))}`;
const stamp = (m, d) => `${dateOf(m, d)} ${timeOf(d)}`;

/** the display's own state, kept with the breaker's simulation state */
export function m76(st) {
  const e = st.etu;
  if (!e.m76)
    e.m76 = {
      path: null, // null = operating screen CURRENT; otherwise the row indices from MAIN MENU
      cur: 0,
      edit: null,
      dlg: null,
      pw: null,
      unlocked: false,
      msg: null,
      graph: null,
      idle: 0,
      dark: false,
      boot: 0,
      was: false,
      disp: {pw: '0000', scr: 30, contrast: 40, temp: '°C', date: 'Auto', lang: 'English'},
      sys: {underflow: 50, derating: 'off', pt: '400 V · Y', dir: 'top → bottom', rot: 'L1-L2-L3', shed: 0.9, restore: 0.7, tx: 5, itavg: 15},
      mm: {},
      // example service history [inferred]
      cnt: {ops: 214, opsLoad: 38, SI: 0, L: 1, G: 0, hours: 3120, intF: 0, i2t: [0.6, 0.7, 0.6, 0.1]},
      W: 21207000,
      lt: null,
      trig: {A: {type: 'No Trigger', pos: 0.8, ev: null}, B: {type: 'No Trigger', pos: 0.8, ev: null}},
      up: null,
      prevClosed: st.closed,
      prevAlarm: false,
    };
  return e.m76;
}

// ------------------------------------------------------------ measured values (metering function, OI 8-55)
function meter(st) {
  const o = st.o;
  const c = currents(st);
  const In = o.wlIn;
  const I = c.I;
  const Iavg = (I[0] + I[1] + I[2]) / 3;
  const live = c.live;
  const U = live ? 401 : 0;
  const pf = live && Iavg > 0 ? 0.918 : 0;
  const P = (Math.sqrt(3) * U * Iavg * pf) / 1000;
  const S = (Math.sqrt(3) * U * Iavg) / 1000;
  const Q = Math.sqrt(Math.max(0, S * S - P * P));
  const f = live ? 50 + 0.02 * Math.sin(st.etu.t / 7) : 0;
  const temp = 30 + 18 * (Iavg / In) ** 2;
  const unbal = Iavg > 1 ? (Math.max(...I.map((x) => Math.abs(x - Iavg))) / Iavg) * 100 : 0;
  return {c, I, IN: c.IN, Ig: c.Ig, Iavg, U, pf, P, S, Q, f, temp, unbal, live, PL: I.map((x) => (U / Math.sqrt(3)) * x * pf / 1000)};
}
const tempTxt = (m, t) => (m.disp.temp === '°F' ? `${(t * 1.8 + 32).toFixed(1)} °F` : `${t.toFixed(1)} °C`);

// ------------------------------------------------------------ the protection parameters of one set (OI 8-56, 8-62)
function protRows(st, set, change, setOpt) {
  const o = st.o;
  const In = o.wlIn;
  const v = set === 'B' ? setB(o) : o;
  const S = settingsFor(v);
  const step = (key) => S.find((s) => s.key === key);
  const put = (key, x) => setOpt(set === 'B' ? `wlB.${key}` : key, x);
  // an editable line for one setting; fmt shows the value as the display does (in amps)
  const ed = (label, key, fmt) => {
    const s = step(key);
    return s ? {l: label, v: () => fmt(v[key]), edit: {steps: s.steps, get: () => v[key], put: (x) => put(key, x), fmt}} : null;
  };
  const amps = (x) => (x === 'OFF' ? 'OFF' : x === 'MAX' ? 'MAX' : A(x * In));
  const sec = (x) => (x === 'OFF' ? 'OFF' : `${x} s${x === 0.02 ? ' M' : ''}`);
  const onoff = (get, putF) => ({l: 'Status', v: () => get(), edit: {steps: ['On', 'Off'], get, put: putF, fmt: (x) => x}});
  const P = activeSettings({...o, wlPar: set, wlDas: 'off'});
  const trip = (title, rows) => ({t: title, change, detail: true, rows: rows.filter(Boolean)});
  const lOn = v.wlLst !== 'Off';
  const sOn = v.wltsd !== 'OFF';
  const iOn = v.wlIi !== 'OFF';
  const nOn = v.wlIN !== 'OFF';
  const gOn = v.wlIg !== 'OFF';
  const rows = [
    {l: `L Trip = ${lOn ? A(v.wlIr * In) : 'Off'}`, go: () => trip('TRIP', [
      onoff(() => (lOn ? 'On' : 'Off'), (x) => put('wlLst', x)),
      ed('Pickup', 'wlIr', amps),
      ed('Delay', 'wltR', sec),
      {l: 'I*t', v: () => (v.wlLit === 'I4t' ? 'I⁴t' : 'I²t'), edit: {steps: ['I2t', 'I4t'], get: () => v.wlLit, put: (x) => put('wlLit', x), fmt: (x) => (x === 'I4t' ? 'I⁴t' : 'I²t')}},
    ])},
    {l: `S Trip = ${sOn ? A(v.wlIsd * In) : 'Off'}`, go: () => trip('S TRIP', [
      onoff(() => (sOn ? 'On' : 'Off'), (x) => put('wltsd', x === 'Off' ? 'OFF' : 0.2)),
      ed('Pickup', 'wlIsd', amps),
      ed('Delay', 'wltsd', sec),
      {l: 'I*t', v: () => (v.wlSit === 'on' ? 'I²t' : 'Off'), edit: {steps: ['off', 'on'], get: () => v.wlSit, put: (x) => put('wlSit', x), fmt: (x) => (x === 'on' ? 'I²t' : 'Off')}},
    ])},
    {l: `I Trip = ${iOn ? (v.wlIi === 'MAX' ? 'MAX' : A(v.wlIi * In)) : 'Off'}`, go: () => trip('I TRIP', [
      onoff(() => (iOn ? 'On' : 'Off'), (x) => put('wlIi', x === 'Off' ? 'OFF' : 12)),
      ed('Pickup', 'wlIi', (x) => (x === 'MAX' ? `MAX ${A(P.Ii * In)}` : amps(x))),
    ])},
    {l: `N Trip = ${nOn ? A(v.wlIN * In) : 'Off'}`, go: () => trip('N TRIP', [
      onoff(() => (nOn ? 'On' : 'Off'), (x) => put('wlIN', x === 'Off' ? 'OFF' : 1)),
      ed('Pickup', 'wlIN', amps),
    ])},
    hasG(o)
      ? {l: `G Protec = ${gOn ? A(igA(o, v.wlIg)) : 'Off'}`, go: () => trip('G PROTEC', [
          onoff(() => (gOn ? 'On' : 'Off'), (x) => put('wlIg', x === 'Off' ? 'OFF' : 'C')),
          ed('Pickup', 'wlIg', (x) => (x === 'OFF' ? 'OFF' : `${x} ${A(igA(o, x))}`)),
          ed('Delay', 'wltg', sec),
          {l: 'I*t', v: () => (v.wlGit === 'on' ? 'I²t' : 'Off'), edit: {steps: ['off', 'on'], get: () => v.wlGit, put: (x) => put('wlGit', x), fmt: (x) => (x === 'on' ? 'I²t' : 'Off')}},
        ])}
      : null,
    {l: 'ThermMem', v: () => v.wlTM, edit: {steps: ['off', 'on'], get: () => v.wlTM, put: (x) => put('wlTM', x), fmt: (x) => x}},
    {l: 'PhaseSen', v: () => (v.wltsd === 0.02 ? 'on (M)' : v.wlPS), edit: {steps: ['off', 'on'], get: () => v.wlPS, put: (x) => put('wlPS', x), fmt: (x) => x}},
    {l: 'Tau', v: () => '100', grey: true},
  ].filter(Boolean);
  return {t: `PROT. PAR. SET ${set}`, change, rows};
}

// ------------------------------------------------------------ the menu tree (OI 8-55…8-64)
function sysConfig(st, change, setOpt) {
  const m = m76(st);
  const o = st.o;
  const Ir = (activeSettings(o).Ir ?? 1) * o.wlIn;
  const local = (label, key, steps, fmt = (x) => String(x)) => ({l: label, v: () => fmt(m.sys[key]), edit: {steps, get: () => m.sys[key], put: (x) => (m.sys[key] = x), fmt}});
  return {
    t: 'SYSTEM CONFIG.',
    change,
    rows: [
      {l: 'Select Par. Set', go: () => ({
        t: 'SELECT PAR. SET',
        change,
        rows: ['A', 'B'].map((x) => ({
          l: `${(o.wlPar || 'A') === x ? '[x]' : '[ ]'}Par. Set ${x}`,
          act: () => (change ? saveQuery(st, () => setOpt('wlPar', x)) : null),
        })),
      })},
      local('Underflow Limit', 'underflow', [20, 30, 40, 50, 60, 80, 100], (x) => `${x} A`),
      local('Derating Harm.', 'derating', ['off', 'on']),
      local('PT Config', 'pt', ['400 V · Y', '400 V · Δ', '690 V · Y', '690 V · Δ']),
      local('Power Direction', 'dir', ['top → bottom', 'bottom → top']),
      local('Phase Rotation', 'rot', ['L1-L2-L3', 'L1-L3-L2']),
      {l: 'Load Mangmt', go: () => ({
        t: 'LOAD MANGMT',
        change,
        rows: [
          // load shedding / restore 40 A … 1.5 x IR, tx 1…15 s (OI 8-25)
          local('Shed', 'shed', [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5], (x) => A(Math.max(40, x * Ir))),
          local('Restore', 'restore', [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5], (x) => A(Math.max(40, x * Ir))),
          local('tx', 'tx', [1, 2, 3, 5, 8, 10, 15], (x) => `${x} s`),
        ],
      })},
      local('Itavg Calc', 'itavg', [5, 10, 15, 30, 60], (x) => `${x} min`),
    ],
  };
}
const unavailable = (label) => ({l: `[ ]${label}`, act: (st) => note(st, [label, 'Option not', 'present'], 2)});
function communication(st) {
  const o = st.o;
  return {t: 'COMMUNICATION', rows: (o.wlCom === 'COM35' ? ['COM35 · PROFINET IO', 'Modbus TCP', 'CubicleBUS: OK', 'Par. set via COM: yes'] : ['No COM module', 'CubicleBUS only']).map((l) => ({l}))};
}

function root(st, setOpt) {
  const m = m76(st);
  const o = st.o;
  const In = o.wlIn;
  const M = meter(st);
  const mm = (k) => m.mm[k] || {min: 0, max: 0, tmin: '—', tmax: '—'};
  const minmax = (title, k, fmt) => ({t: title, rows: [{l: `${k} min = ${fmt(mm(k).min)}`}, {l: `  ${mm(k).tmin}`}, {l: `${k} max = ${fmt(mm(k).max)}`}, {l: `  ${mm(k).tmax}`}]});
  const bar = (v, max, k) => ({v, max, min: mm(k).min, mx: mm(k).max});
  const text = (title, lines) => ({t: title, rows: lines.map((l) => ({l}))});
  const harmonics = () => {
    const h = {3: 1.2, 5: 6.1, 7: 3.9, 9: 0.8, 11: 2.4, 13: 1.9, 15: 0.4, 17: 1.1, 19: 0.9, 23: 0.6, 25: 0.5, 29: 0.3};
    const k = M.live && M.Iavg > 0 ? 1 : 0;
    return {t: 'HARMONICS', table: true, rows: [{l: '      Iavg   Uavg'}, {l: `THD  ${(10 * k).toFixed(1).padStart(5)}% ${(3 * k).toFixed(1).padStart(5)}%`}, ...Array.from({length: 28}, (_, i) => i + 2).map((n) => ({l: `${String(n).padStart(2)}   ${((h[n] || 0.1) * k).toFixed(1).padStart(5)}% ${((h[n] || 0.1) * 0.35 * k).toFixed(1).padStart(5)}%`}))]};
  };
  const lock = true;
  const cnt = m.cnt;
  const ero = erosion(m);
  const trigNode = (s) => {
    const T = m.trig[s];
    const setType = (type) => () => {
      T.type = type;
      T.ev = null;
      note(st, [`Trigger ${s} =`, type], 2, () => {
        m.path = m.path.slice(0, 4);
        m.cur = 0;
      });
    };
    return {
      t: `SET TRIGGER ${s}`,
      lock,
      change: true,
      rows: [
        {l: `Trigger = ${T.type}`, go: () => ({t: 'TRIGGER', rows: [
          {l: 'Trip Event', go: () => ({t: 'TRIP EVENT', rows: [
            {l: 'Prot. Param.', go: () => ({t: 'PROT. PARAM.', rows: ['L Trip', 'S Trip', 'I Trip', 'G Trip', 'N Trip'].map((x) => ({l: x, act: setType(x)}))})},
            ...['Current', 'Voltage', 'Real Power', 'Frequency'].map((x) => ({l: x, act: setType(`${x} trip`)})),
          ]})},
          {l: 'Setpoint Event', act: setType('Setpoint Event')},
          {l: 'Overload', act: setType('Overload')},
          {l: 'No Trigger', act: setType('No Trigger')},
        ]})},
        // pre-trigger position in the 1 s recording (OI 8-59)
        {l: 'Position', v: () => `${T.pos.toFixed(2)}s`, edit: {steps: Array.from({length: 21}, (_, i) => round(i * 0.05)), get: () => T.pos, put: (x) => (T.pos = x), fmt: (x) => `Pre Trig ${x.toFixed(2)} s`}},
        {l: 'Reset/Start', act: () => {
          T.ev = null;
          note(st, [`Trigger ${s} Reset`, dateOf(m, new Date())], 3);
        }},
      ],
    };
  };
  const upload = (kind) => ({
    t: kind.toUpperCase(),
    rows: ['A', 'B'].map((s) => ({l: `Upload ${s} Events`, act: () => {
      note(st, ['Please Wait…', 'Upload in Progress'], 2, () => {
        const T = m.trig[s];
        if (T.ev) {
          m.up = {set: s, kind, ev: T.ev};
          note(st, [`Trigger ${s}`, kind, 'recorded', dateOf(m, T.ev.d), timeOf(T.ev.d)], 5);
        } else note(st, [T.type === 'No Trigger' ? 'No Trigger set' : /Trip/.test(T.type) ? 'No Trip' : 'No Event'], 5);
      });
    }})),
  });
  return {
    t: 'MAIN MENU',
    rows: [
      {l: 'Metering', go: () => ({t: 'METERING', rows: [
        {l: `Iavg = ${A(M.Iavg)}`, go: () => ({t: 'CURRENT', bars: true, rows: [
          ...[['IL1', M.I[0]], ['IL2', M.I[1]], ['IL3', M.I[2]], ['IN', M.IN], ['IG', M.Ig]].map(([k, x]) => ({l: k, v: () => A(x), bar: bar(x, In * 1.2, k), go: () => minmax(k, k, A)})),
          {l: 'Iavg', v: () => A(M.Iavg), bar: bar(M.Iavg, In * 1.2, 'Iavg'), go: () => minmax('IAVG', 'Iavg', A)},
          {l: 'Iavglt', v: () => A(m.lt ?? 0), bar: bar(m.lt ?? 0, In * 1.2, 'Iavglt')},
          {l: `Unbal. = ${Math.round(M.unbal)} %`},
        ]})},
        {l: `Uavg = ${Math.round(M.U)} V`, go: () => text('VOLTAGE', [`UL12 = ${Math.round(M.U)} V`, `UL23 = ${Math.round(M.U * 0.998)} V`, `UL31 = ${Math.round(M.U * 1.002)} V`, `Uavg = ${Math.round(M.U)} V`])},
        {l: `P = +${Math.round(M.P)} kW`, go: () => ({t: 'REAL POWER', rows: [
          ...M.PL.map((x, i) => ({l: `PL${i + 1} = +${Math.round(x)} kW`})),
          {l: 'Pavg', v: () => `+${Math.round(M.P / 3)} kW`, bar: bar(M.P / 3, (401 / Math.sqrt(3)) * In / 1000, 'Pavg'), go: () => minmax('PAVG', 'Pavg', (x) => `+${Math.round(x)} kW`)},
        ]})},
        {l: `S = ${Math.round(M.S)} kVA`},
        {l: `Q = +${Math.round(M.Q)}kVAR`},
        {l: `pfavg = ${M.pf ? M.pf.toFixed(3) + ' lag' : '—'}`},
        {l: `W = +${Math.round(m.W / 1000)} MWh`},
        {l: `freq = ${M.f ? M.f.toFixed(2) : '—'} Hz`, go: () => ({t: 'FREQUENCY', rows: [
          {l: 'freq', v: () => `${M.f.toFixed(2)} Hz`, bar: bar(M.f, 60, 'freq'), go: () => minmax('FREQ', 'freq', (x) => `${x.toFixed(2)} Hz`)},
          {l: 'ITHD = 10 %', bar: {v: M.live ? 10 : 0, max: 100}},
          {l: 'UTHD = 3 %', bar: {v: M.live ? 3 : 0, max: 100}},
          {l: 'Formfactor = 1.1'},
          {l: 'Crestfactor = 1.4'},
          {l: 'Harmonics', go: harmonics},
        ]})},
        {l: `Temp = ${tempTxt(m, M.temp)}`},
      ]})},
      {l: 'Diagnostic', go: () => ({t: 'DIAGNOSTICS', rows: [
        {l: 'Warnings', go: () => text('WARNINGS', warnings(st, M))},
        {l: 'Trip Log', go: () => text('TRIP LOG', st.etu.log.length ? st.etu.log.flatMap((x, i) => [`${i + 1} ${x.cause} Trip ${x.phase} ${x.I} A`, `  ${x.d ? stamp(m, x.d) : ''}`]) : ['No trips logged'])},
        {l: 'Setpoints', go: () => text('SETPOINTS', ['No setpoints set'])},
        {l: 'Maintenance', go: () => ({t: 'MAINTENANCE', rows: [
          {l: `Total Ops = ${cnt.ops}`},
          {l: `Ops w/load = ${cnt.opsLoad}`},
          {l: `SI Trips = ${cnt.SI}`},
          {l: `L Trips = ${cnt.L}`},
          {l: `g Trips = ${cnt.G}`},
          {l: `Op Hours = ${Math.floor(cnt.hours)}`},
          {l: `Int. Fault = ${cnt.intF}`},
          ...['L1', 'L2', 'L3', 'N'].map((p, i) => ({l: `Sum I²t ${p} = ${cnt.i2t[i].toFixed(1)} kA²s`})),
          {l: 'Contact Erosion', go: () => text('CONTACT EROSION', ero >= 80 ? ['Maintenance', 'required', `(${Math.round(ero)} %)`] : ['Maintenance not', 'required at', 'this time', `(${Math.round(ero)} %)`])},
        ]})},
        {l: 'CubicleBUS', go: () => text('CUBICLEBUS', ['ETU76B  OK', 'BSS     OK', 'Metering OK', o.wlCom === 'COM35' ? 'COM35   OK' : 'COM     —'])},
        {l: 'Waveform', go: () => ({t: 'WAVEFORM', rows: [
          {l: 'Waveform Setup', go: () => ({t: 'WAVEFORM SETUP', rows: ['A', 'B'].map((s) => ({l: `Set Trigger ${s}`, go: () => trigNode(s)}))})},
          {l: 'Display Waveform', go: () => ({t: 'DISPLAY WAVEFORM', rows: [
            {l: 'Event Upload', go: () => ({t: 'EVENT UPLOAD', rows: ['Currents', 'Currents + G & N', 'Voltages'].map((k) => ({l: k, go: () => upload(k)}))})},
            {l: 'Display Graph', act: () => {
              if (!m.up) return note(st, ['No Data Available.', 'Please Upload', 'Event'], 5);
              const u = m.up;
              note(st, [`Trigger ${u.set}`, u.kind, 'recorded', dateOf(m, u.ev.d), timeOf(u.ev.d)], 5, () => (m.graph = {curve: 0, t: 0}));
            }},
          ]})},
        ]})},
      ]})},
      {l: 'View Parameter', go: () => ({t: 'VIEW PARAMETER', rows: [
        {l: 'System Config.', go: () => sysConfig(st, false, setOpt)},
        {l: 'Prot. Par. Set A', go: () => protRows(st, 'A', false, setOpt)},
        {l: 'Prot. Par. Set B', go: () => protRows(st, 'B', false, setOpt)},
        {l: '[x]Metering', go: () => text('METERING', ['Metering function', 'PLUS fitted'])},
        unavailable('Setpoints'),
        {l: 'Communication', go: () => communication(st)},
      ]})},
      {l: 'Change Parameter', go: () => ({t: 'CHANGE PARAMETER', lock, change: true, rows: [
        {l: 'System Config.', go: () => sysConfig(st, true, setOpt)},
        {l: 'Prot. Par. Set A', go: () => protRows(st, 'A', true, setOpt)},
        {l: 'Prot. Par. Set B', go: () => protRows(st, 'B', true, setOpt)},
        {l: '[x]Metering', go: () => text('METERING', ['Metering function', 'PLUS fitted'])},
        unavailable('Setpoints'),
        {l: 'Communication', go: () => communication(st)},
      ]})},
      {l: 'Identification', go: () => ({t: 'IDENTIFICATION', rows: [
        {l: 'Trip Unit Part#', go: () => text('TRIP UNIT PART#', ['3WL9111-0AT•', `(${orderNo(o)})`])},
        {l: 'Trip Unit S/N', go: () => text('TRIP UNIT S/N', [String(423812675238 + WL_SIZES[o.acb].size * 1117 + o.wlIn)])},
        {l: 'Test Info.', go: () => text('TEST INFO.', st.etu.lastTest ? [`Self-test ${st.etu.lastTest.mode}`, st.etu.lastTest.ok ? 'Test OK' : 'Ended with CLEAR', stamp(m, st.etu.lastTest.d)] : ['No test recorded'])},
        {l: 'User Given ID# [x]', go: () => text('USER GIVEN ID#', ['+A01-Q1'])},
        {l: 'User Comment [x]', go: () => text('USER COMMENT', ['Infeed', 'transformer T1'])},
      ]})},
      {l: 'Clear', go: () => ({t: 'CLEAR', lock, change: true, rows: [
        clearRow(st, 'Current Fault', () => (st.cause = null)),
        clearRow(st, 'Min/Max Buffer', () => (m.mm = {})),
        clearRow(st, 'Temp Min/Max', () => delete m.mm.Temp, '[ ]'),
        clearRow(st, 'Trip Log', () => (st.etu.log = []), '[ ]'),
        clearRow(st, 'Maintenance Info.', () => (m.cnt.i2t = [0, 0, 0, 0])),
      ]})},
      {l: 'Display Setup', go: () => ({t: 'DISPLAY SETUP', lock, change: true, rows: [
        {l: 'System Time [x]', go: () => text('SYSTEM TIME', [dateOf(m, new Date()), timeOf(new Date()).slice(0, 8)])},
        {l: 'Language', v: () => m.disp.lang, edit: {steps: ['English'], get: () => m.disp.lang, put: (x) => (m.disp.lang = x), fmt: (x) => x}},
        {l: 'Password', v: () => '0000'.replace(/0/g, '*'), act: () => (m.pw = {mode: 'new', d: [0, 0, 0, 0], i: 0})},
        {l: 'Default SCR', v: () => `${m.disp.scr}s`, edit: {steps: Array.from({length: 20}, (_, i) => 30 + i * 30), get: () => m.disp.scr, put: (x) => (m.disp.scr = x), fmt: (x) => `${x}s`}},
        {l: 'Contrast', v: () => `${m.disp.contrast}%`, edit: {steps: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], get: () => m.disp.contrast, put: (x) => (m.disp.contrast = x), fmt: (x) => `${x}%`}},
        {l: 'Temp Unit', v: () => m.disp.temp, edit: {steps: ['°C', '°F'], get: () => m.disp.temp, put: (x) => (m.disp.temp = x), fmt: (x) => x}},
        {l: 'Date Format', v: () => m.disp.date, edit: {steps: ['Auto', 'MM/DD/YY', 'YYYY-MM-DD'], get: () => m.disp.date, put: (x) => (m.disp.date = x), fmt: (x) => x}},
      ]})},
    ],
  };
}
function clearRow(st, name, fn, box = '') {
  return {l: `${name}${box ? ' ' + box : ''}`, act: () => {
    const m = m76(st);
    m.dlg = {lines: ['Are You Sure You', 'Want To Clear?', '', 'ENTER = YES', 'ESC = NO'], yes: () => {
      fn();
      note(st, [name, 'Cleared.'], 3);
    }, no: () => note(st, [name, 'NOT Cleared !!'], 3)};
  }};
}
function warnings(st, M) {
  const P = activeSettings(st.o);
  const m = m76(st);
  const w = [];
  const Ir = (P.Ir ?? Infinity) * st.o.wlIn;
  if (Math.max(...M.I) >= Ir) w.push('Overload: I > IR');
  if (Math.max(...M.I) >= m.sys.shed * (P.Ir ?? 1) * st.o.wlIn) w.push('Load shedding');
  if (M.unbal >= 50) w.push('Phase unbalance');
  if (P.Ir === null) w.push('L protection OFF');
  if (erosion(m) >= 80) w.push('Contact erosion');
  if (!v24(st)) w.push('No 24 V DC supply');
  return w.length ? w : ['No warnings'];
}
const erosion = (m) => Math.min(100, ((m.cnt.i2t[0] + m.cnt.i2t[1] + m.cnt.i2t[2]) / 3 / 400) * 100 + m.cnt.ops * 0.004);

/** a message for a few seconds, then optionally an action */
function note(st, lines, t, then) {
  m76(st).msg = {lines, t, then};
}
function saveQuery(st, yes, what = 'Parameter') {
  const m = m76(st);
  m.dlg = {lines: what === 'Password' ? ['Save Changes?', '', 'ENTER = YES', 'ESC = NO'] : ['Save Parameter', 'Changes?', '', 'ENTER = YES', 'ESC = NO'], yes: () => {
    yes();
    note(st, [`${what} Change`, 'Saved.'], 3, () => {
      if (m.path) m.path = m.path.slice(0, 1);
      m.cur = 0;
    });
  }, no: () => note(st, [`${what} Change`, what === 'Password' ? 'NOT saved' : 'NOT saved!!'], 3, () => {
    if (m.path) m.path = m.path.slice(0, 1);
    m.cur = 0;
  })};
}

/** the node the path leads to, whether it (or one above it) is password-protected, and whether its values can be changed */
function walk(st, setOpt) {
  const m = m76(st);
  let n = root(st, setOpt);
  let lock = false;
  for (const i of m.path) {
    const r = n.rows[i];
    if (!r || !r.go) {
      m.path = m.path.slice(0, m.path.indexOf(i));
      break;
    }
    n = r.go();
    lock = lock || !!n.lock;
  }
  return {n, lock};
}

// ------------------------------------------------------------ keys
/** a key on the ETU76B: up, down, esc, enter */
export function key76(st, k, setOpt) {
  const m = m76(st);
  if (!etuActive(st)) return 'The display is dark: the trip unit is not active (no load current, no 24 V DC)';
  m.idle = 0;
  // any key first switches the backlight back on (OI 8-43)
  if (m.dark) {
    m.dark = false;
    return null;
  }
  if (m.boot > 0) return null;
  if (m.msg) return null;
  if (m.dlg) {
    const d = m.dlg;
    if (k === 'enter') {
      m.dlg = null;
      d.yes();
    } else if (k === 'esc') {
      m.dlg = null;
      d.no();
    }
    return null;
  }
  if (m.pw) return pwKey(st, m, k);
  if (m.graph) {
    const g = m.graph;
    if (k === 'esc') m.graph = null;
    else if (k === 'up' || k === 'down') g.t = Math.max(-0.1, Math.min(0.1, round(g.t + (k === 'up' ? 0.005 : -0.005), 3)));
    else if (k === 'enter') g.curve = (g.curve + 1) % 6;
    return null;
  }
  // the operating screen: ESC opens MAIN MENU (OI 8-44)
  if (m.path === null) {
    if (k === 'esc') {
      m.path = [];
      m.cur = 0;
    }
    return null;
  }
  const {n, lock} = walk(st, setOpt);
  const rows = n.rows || [];
  if (m.edit) {
    const r = rows[m.edit.i];
    const E = r.edit;
    if (k === 'up' || k === 'down') m.edit.j = Math.max(0, Math.min(E.steps.length - 1, m.edit.j + (k === 'up' ? 1 : -1)));
    else if (k === 'enter') {
      const x = E.steps[m.edit.j];
      m.edit = null;
      if (String(x) === String(E.get())) return null;
      saveQuery(st, () => E.put(x));
    } else if (k === 'esc') {
      m.edit = null;
      // ESC while editing a TRIP screen returns to the PROT. PAR. SET list (OI 8-63)
      if (n.detail) {
        m.cur = m.path.pop();
      }
    }
    return null;
  }
  if (k === 'up') m.cur = Math.max(0, m.cur - 1);
  else if (k === 'down') m.cur = Math.min(rows.length - 1, m.cur + 1);
  else if (k === 'esc') {
    if (m.path.length) m.cur = m.path.pop();
    else {
      m.path = null;
      m.unlocked = false;
    }
  } else if (k === 'enter') {
    const r = rows[m.cur];
    if (!r || r.grey) return null;
    if (r.go) {
      const nx = r.go();
      const enter = () => {
        m.path.push(m.cur);
        m.cur = 0;
      };
      if (nx.lock && !lock && !m.unlocked) {
        m.pw = {mode: 'check', d: [0, 0, 0, 0], i: 0, then: enter};
        return null;
      }
      enter();
    } else if (r.edit && n.change) {
      // parameterising on the display needs the external 24 V DC supply (OI 8-18)
      if (!v24(st) && /PROT|SYSTEM|SELECT|LOAD/.test(n.t)) {
        note(st, ['Needs external', '24 V DC supply', '(OI 8-18)'], 3);
        return null;
      }
      m.edit = {i: m.cur, j: Math.max(0, r.edit.steps.map(String).indexOf(String(r.edit.get())))};
      if (st.closed && /PROT/.test(n.t) || st.closed && n.detail) return 'CAUTION: change protection parameters only with the breaker switched off, it may trip (OI 8-18)';
    } else if (r.act) r.act(st);
  }
  return null;
}
function pwKey(st, m, k) {
  const p = m.pw;
  if (k === 'esc') {
    m.pw = null;
    return null;
  }
  if (k === 'up' || k === 'down') p.d[p.i] = (p.d[p.i] + (k === 'up' ? 1 : 9)) % 10;
  else if (k === 'enter') {
    p.i++;
    if (p.i < 4) return null;
    const code = p.d.join('');
    m.pw = null;
    if (p.mode === 'new') {
      m.dlg = {lines: ['Save Changes?', '', 'ENTER = YES', 'ESC = NO'], yes: () => {
        m.disp.pw = code;
        note(st, ['Password Change', 'Saved.'], 3);
      }, no: () => note(st, ['Password Change', 'NOT saved'], 3)};
    } else if (code === m.disp.pw) {
      m.unlocked = true;
      p.then();
    } else note(st, ['Wrong Password'], 2);
  }
  return null;
}

// ------------------------------------------------------------ the clock
export function step76(st, dt) {
  const m = m76(st);
  const active = etuActive(st);
  // power-up: "Version" for about 5 s, then CURRENT (OI 8-43)
  if (active && !m.was) {
    m.boot = 5;
    m.path = null;
    m.dark = false;
    m.idle = 0;
  }
  m.was = active;
  if (!active) return;
  if (m.boot > 0) m.boot -= dt;
  if (m.msg) {
    m.msg.t -= dt;
    if (m.msg.t <= 0) {
      const then = m.msg.then;
      m.msg = null;
      then?.();
    }
  }
  // backlight off after Default SCR; back to CURRENT (OI 8-43)
  m.idle += dt;
  if (m.idle > m.disp.scr && !m.dark) {
    m.dark = true;
    m.path = null;
    m.edit = null;
    m.dlg = null;
    m.pw = null;
    m.graph = null;
    m.unlocked = false;
  }
  const M = meter(st);
  const now = new Date();
  const track = (k, x) => {
    const r = m.mm[k];
    if (!r) m.mm[k] = {min: x, max: x, tmin: stamp(m, now), tmax: stamp(m, now)};
    else {
      if (x < r.min) Object.assign(r, {min: x, tmin: stamp(m, now)});
      if (x > r.max) Object.assign(r, {max: x, tmax: stamp(m, now)});
    }
  };
  [['IL1', M.I[0]], ['IL2', M.I[1]], ['IL3', M.I[2]], ['IN', M.IN], ['IG', M.Ig], ['Iavg', M.Iavg], ['Pavg', M.P / 3], ['Temp', M.temp]].forEach(([k, x]) => track(k, x));
  if (M.live) track('freq', M.f);
  const tau = m.sys.itavg * 60;
  m.lt = m.lt === null ? M.Iavg : m.lt + (M.Iavg - m.lt) * Math.min(1, dt / tau);
  track('Iavglt', m.lt);
  m.W += (M.P * dt) / 3600;
  // switching operations and operating hours (OI 8-57)
  if (st.closed && !m.prevClosed) {
    m.cnt.ops++;
    if (M.live) m.cnt.opsLoad++;
  }
  m.prevClosed = st.closed;
  if (st.closed) m.cnt.hours += dt / 3600;
  // waveform trigger "Overload": the recording starts when the current exceeds IR
  const alarm = leds(st, 0).ALARM;
  if (alarm && !m.prevAlarm) record(st, 'Overload', null, Math.max(...M.I), M.I.indexOf(Math.max(...M.I)));
  m.prevAlarm = alarm;
}
/** a trip: maintenance counters and waveform triggers (called from trip()) */
export function onTrip76(st, cause, I, phase, dur) {
  const m = m76(st);
  if (cause === 'S' || cause === 'I') m.cnt.SI++;
  else if (cause === 'G') m.cnt.G++;
  else m.cnt.L++;
  m.cnt.i2t[cause === 'N' ? 3 : phase] += (I / 1000) ** 2 * Math.min(dur, 1);
  record(st, `${cause} Trip`, cause, I, phase, dur);
}
function record(st, kind, cause, I, phase, dur = 0) {
  const m = m76(st);
  const c = currents(st);
  for (const s of ['A', 'B']) {
    const T = m.trig[s];
    if (T.ev) continue;
    const hitT = T.type === kind || (kind === 'Overload' && T.type === 'Overload');
    if (!hitT) continue;
    T.ev = {d: new Date(), kind, cause, I, phase: cause === 'G' ? 'g' : cause === 'N' ? 'N' : phase, dur, pre: c.I.slice(), trip: !!cause, pos: T.pos};
  }
}

// ------------------------------------------------------------ the display (240 x 600 drawing units, OI 8-42/8-43)
/** what the current screen holds: {title, rows, sel, edit, bars, icons, text, graph, dark, off} */
function screen(st, setOpt) {
  const m = m76(st);
  const o = st.o;
  const e = st.etu;
  const P = activeSettings(o);
  const T = m.trig;
  const trigOn = T.A.type !== 'No Trigger' ? 'A' : T.B.type !== 'No Trigger' ? 'B' : '';
  const icons = {key: false, wrench: erosion(m) >= 80, par: P.set, pencil: false, trig: trigOn, nav: 'ESC'};
  if (!etuActive(st)) return {off: true};
  if (m.boot > 0) return {title: '', text: ['', 'SENTRON WL', 'ETU76B', 'Version X.0X.X'], icons};
  // the trip unit's own messages: self-test, trip cause cleared …
  if (e.test || e.combo || (e.msg && e.msgT > 0)) {
    const dm = displayModel(st);
    return {title: (dm.title || 'MESSAGE').toUpperCase(), text: dm.lines, icons, dark: m.dark};
  }
  if (m.msg) return {title: '', text: m.msg.lines, icons, center: true, dark: m.dark};
  if (m.dlg) return {title: '', text: m.dlg.lines, icons: {...icons, nav: 'ESC'}, center: true, dark: m.dark};
  if (m.pw) {
    const p = m.pw;
    const shown = p.d.map((x, i) => (i <= p.i ? x : '*')).join('');
    return {title: 'PASSWORD', text: ['', p.mode === 'new' ? 'Enter New Pswrd' : 'Enter Pswrd', '', `      ${shown}`, '', '▲▼ digit · ENTER'], icons: {...icons, key: true, pencil: true}, dark: m.dark};
  }
  if (m.graph) return {graph: graphModel(st, m), icons: {...icons, nav: '▲▼'}, dark: m.dark};
  if (m.path === null) {
    const c = currents(st);
    const mm = (k) => m.mm[k] || {min: 0, max: 0};
    return {
      title: 'CURRENT',
      oper: [['IL1', c.I[0]], ['IL2', c.I[1]], ['IL3', c.I[2]], ['IN', c.IN]].map(([k, x]) => ({k, x, max: (P.Ir ?? 1) * o.wlIn, min: mm(k).min, mx: mm(k).max})),
      icons,
      dark: m.dark,
    };
  }
  const {n, lock} = walk(st, setOpt);
  const rows = n.rows || [];
  m.cur = Math.min(m.cur, Math.max(0, rows.length - 1));
  const r = rows[m.cur];
  const nav = rows.length <= 1 ? 'ESC' : m.cur === 0 ? '▼' : m.cur === rows.length - 1 ? '▲' : '▲▼';
  return {
    title: n.t,
    rows: rows.map((x, i) => {
      const ed = m.edit && m.edit.i === i;
      const v = ed ? x.edit.fmt(x.edit.steps[m.edit.j]) : x.v ? x.v() : null;
      return {l: x.l, v, bar: x.bar, grey: x.grey, ed, go: !!x.go};
    }),
    sel: n.table ? -1 : m.cur,
    top: n.table ? m.cur : null,
    icons: {...icons, key: lock, pencil: !!(n.change && (m.edit || r?.edit)), nav},
    dark: m.dark,
  };
}
/** the recorded event as a curve: 50 Hz, the trigger at t = 0 (OI 8-61) */
function graphModel(st, m) {
  const u = m.up;
  const ev = u.ev;
  const names = ['L1', 'L2', 'L3', 'g', 'N', 'all'];
  const g = m.graph;
  const sel = names[g.curve];
  const amp = (ph, t) => {
    const idx = {L1: 0, L2: 1, L3: 2}[ph];
    const pre = idx !== undefined ? ev.pre[idx] : ph === 'N' ? ev.pre[0] * 0.08 : 0;
    const faulted = ev.phase === idx || ev.phase === ph;
    // the fault current flows for its tripping time before the trigger; after a trip the current is zero
    if (ev.trip && t > 0.012) return 0;
    if (faulted && t > -Math.max(0.02, Math.min(ev.dur || 0.1, 0.5))) return ev.I;
    if (!ev.trip && faulted && t > 0) return ev.I;
    return pre;
  };
  const wave = (ph, t) => amp(ph, t) * Math.SQRT2 * Math.sin(2 * Math.PI * 50 * t + ({L1: 0, L2: -2.094, L3: 2.094, g: 0.5, N: 1}[ph] || 0));
  const curves = sel === 'all' ? ['L1', 'L2', 'L3', 'g', 'N'] : [sel];
  const shown = curves[0];
  const v = Math.abs(amp(shown, g.t));
  return {title: `I${shown} Waveform`, curves, wave, t: g.t, value: `I${shown} = ${A(v)}`, tl: `t = ${g.t >= 0 ? '+' : ''}${Math.round(g.t * 1000)} ms`, max: Math.max(ev.I, ...ev.pre) * Math.SQRT2 * 1.1};
}

const ICON_INK = (on, ink) => (on ? ink : 'rgba(22,48,58,.25)');
/** draw the display into the rectangle (x0, y0, dw, dh) */
export function draw76(g, st, x0, y0, dw, dh, {txt, rrect, mono, setOpt}) {
  const m = m76(st);
  const s = screen(st, setOpt);
  if (s.off) {
    rrect(g, x0, y0, dw, dh, 3, '#2c3834');
    return;
  }
  const lit = !s.dark;
  const k = 0.6 + (m.disp.contrast / 100) * 0.8;
  rrect(g, x0, y0, dw, dh, 3, lit ? '#b9e3d8' : '#7c9a91');
  const ink = `rgba(22,48,58,${Math.min(1, k)})`;
  const bg = lit ? '#b9e3d8' : '#7c9a91';
  const line = (y) => {
    g.fillStyle = ink;
    g.fillRect(x0 + 4, y, dw - 8, 1);
  };
  const title = s.graph ? s.graph.title : s.title;
  if (title) {
    txt(g, title, x0 + 6, y0 + 11, 10, ink, 800);
    line(y0 + 19);
  }
  const top = y0 + 30;
  const LH = 14.2;
  const barAt = (y, b, x, w) => {
    rrect(g, x, y - 5, w, 10, 1, null, ink);
    g.fillStyle = ink;
    g.fillRect(x + 1, y - 4, Math.max(0, Math.min(1, b.v / (b.max || 1))) * (w - 2), 8);
    // min / max markers (OI 8-43)
    for (const q of [b.min, b.mx]) {
      if (q === undefined || !b.max) continue;
      const xx = x + Math.max(0, Math.min(1, q / b.max)) * w;
      g.fillRect(xx - 0.5, y - 8, 1.2, 16);
    }
  };
  if (s.oper) {
    s.oper.forEach((r, i) => {
      const y = top + 6 + i * 24;
      txt(g, `${r.k}`, x0 + 6, y - 5, 9.5, ink, 800, 'left', mono);
      txt(g, `= ${A(r.x)}`, x0 + dw - 6, y - 5, 9.5, ink, 800, 'right', mono);
      barAt(y + 6, {v: r.x, max: r.max, min: r.min, mx: r.mx}, x0 + 6, dw - 12);
    });
  } else if (s.graph) {
    const G = s.graph;
    const gx = x0 + 6;
    const gw = dw - 12;
    const gy = y0 + 64;
    const gh = 70;
    g.strokeStyle = ink;
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(gx, gy);
    g.lineTo(gx + gw, gy);
    g.moveTo(gx + gw / 2, gy - gh / 2);
    g.lineTo(gx + gw / 2, gy + gh / 2);
    g.stroke();
    G.curves.forEach((ph, ci) => {
      g.lineWidth = ci === 0 ? 1.2 : 0.7;
      g.beginPath();
      for (let i = 0; i <= 200; i++) {
        const t = -0.1 + (i / 200) * 0.2;
        const y = gy - (G.wave(ph, t) / G.max) * (gh / 2);
        if (i === 0) g.moveTo(gx + (i / 200) * gw, y);
        else g.lineTo(gx + (i / 200) * gw, y);
      }
      g.stroke();
    });
    const cx = gx + ((G.t + 0.1) / 0.2) * gw;
    g.fillStyle = ink;
    g.fillRect(cx - 0.5, gy - gh / 2, 1, gh);
    txt(g, G.value, x0 + 6, y0 + 29, 9, ink, 700, 'left', mono);
    txt(g, G.tl, x0 + dw - 6, y0 + 29, 9, ink, 700, 'right', mono);
  } else if (s.text) {
    s.text.slice(0, 8).forEach((l, i) => txt(g, l, s.center ? x0 + dw / 2 : x0 + 7, top + (s.title ? 0 : -8) + i * LH, 9.5, ink, 700, s.center ? 'center' : 'left', mono));
  } else if (s.rows) {
    // 8 lines; the window follows the marking
    const n = s.rows.length;
    const focus = s.top !== null ? s.top : s.sel;
    const first = Math.max(0, Math.min(n - 8, focus - 3));
    s.rows.slice(first, first + 8).forEach((r, k2) => {
      const i = first + k2;
      const y = top + k2 * LH;
      const sel = i === s.sel && !r.ed;
      if (sel) {
        g.fillStyle = ink;
        g.fillRect(x0 + 3, y - 7, dw - 6, 13.5);
      }
      const c1 = sel ? bg : r.grey ? 'rgba(22,48,58,.35)' : ink;
      if (r.bar) {
        txt(g, r.l, x0 + 7, y, 8.5, c1, 700, 'left', mono);
        if (r.v) txt(g, r.v, x0 + dw - 7, y, 8.5, c1, 700, 'right', mono);
        if (!sel) barAt(y, r.bar, x0 + 44, dw - 118);
      } else if (r.v !== null && r.v !== undefined) {
        const lab = `${r.l} = `;
        txt(g, lab, x0 + 7, y, 8.8, c1, 700, 'left', mono);
        g.font = `700 8.8px ${mono}`;
        const w0 = g.measureText(lab).width;
        if (r.ed) {
          // the value being edited is shown inverted (OI 8-62)
          const w1 = g.measureText(r.v).width;
          g.fillStyle = ink;
          g.fillRect(x0 + 6 + w0, y - 7, w1 + 3, 13.5);
          txt(g, r.v, x0 + 7.5 + w0, y, 8.8, bg, 800, 'left', mono);
        } else txt(g, r.v, x0 + 7 + w0, y, 8.8, c1, 700, 'left', mono);
      } else txt(g, r.l, x0 + 7, y, 8.8, c1, 700, 'left', mono);
      if (r.go && !r.bar) txt(g, '▸', x0 + dw - 8, y, 8, c1, 700, 'right');
    });
  }
  // status line: key · wrench · PAR A/B · pencil · TRIG A/B · navigation (OI 8-43)
  const I = s.icons || {};
  const ys = y0 + dh - 8;
  line(y0 + dh - 17);
  let x = x0 + 8;
  const icon = (on, draw, w) => {
    g.save();
    g.strokeStyle = ICON_INK(on, ink);
    g.fillStyle = ICON_INK(on, ink);
    g.lineWidth = 1.3;
    draw(x);
    g.restore();
    x += w;
  };
  icon(I.key, (x1) => {
    g.beginPath();
    g.arc(x1 + 3, ys, 2.6, 0, Math.PI * 2);
    g.moveTo(x1 + 5.6, ys);
    g.lineTo(x1 + 12, ys);
    g.moveTo(x1 + 10, ys);
    g.lineTo(x1 + 10, ys + 3);
    g.stroke();
  }, 18);
  icon(I.wrench, (x1) => {
    g.beginPath();
    g.moveTo(x1, ys + 4);
    g.lineTo(x1 + 8, ys - 3);
    g.stroke();
    g.beginPath();
    g.arc(x1 + 9, ys - 4, 2.4, 0, Math.PI * 2);
    g.stroke();
  }, 18);
  txt(g, `PAR ${I.par || 'A'}`, x, ys, 7.5, ink, 800);
  x += 34;
  icon(I.pencil, (x1) => {
    g.beginPath();
    g.moveTo(x1, ys + 4);
    g.lineTo(x1 + 2, ys + 1);
    g.lineTo(x1 + 8, ys - 5);
    g.lineTo(x1 + 10, ys - 3);
    g.lineTo(x1 + 4, ys + 3);
    g.closePath();
    g.stroke();
  }, 18);
  txt(g, `TRIG ${I.trig || 'A'}`, x, ys, 7.5, ICON_INK(!!I.trig, ink), 800);
  txt(g, I.nav || 'ESC', x0 + dw - 7, ys, 8, ink, 800, 'right');
}
export {stamp};
