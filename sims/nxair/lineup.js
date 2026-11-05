// Switchgear row configurator: a line-up of joined NXAIR panels, each with its application and hardware.
//
// Rules from catalog HA 25.71 · 2019 p. 26–31 (dimensions table, product range, room planning), operating instructions
// 110-0134.9 §4.6 / §4.11, installation instructions 110-0084.9 §5.6, dimension drawings 110-2300.9. The applications
// are typical engineering choices mapped onto the panel types the model draws; they are not a Siemens selection list.

// ------------------------------------------------------------------------------------------------ applications
export const APPS = {
  incoming: {label: 'Incoming feeder', type: 'cbp', In: 1250, hw: {relay: '7SJ82', ct: true, vt: true, vds: 'capdis'}, why: 'circuit-breaker with CTs for protection and VTs for metering and voltage protection of the supply'},
  incomingWVT: {label: 'Incoming feeder, removable VTs', type: 'wvt', In: 1250, hw: {relay: '7SJ82', ct: true, vds: 'capdis'}, why: 'as above, VTs with primary fuses in a drawer so they can be taken out without opening the connection compartment'},
  outgoing: {label: 'Outgoing cable feeder', type: 'cbp', In: 630, hw: {relay: '7SJ82', ct: true, vt: false}, why: 'circuit-breaker with CTs for the feeder protection'},
  transformerCB: {label: 'Transformer feeder (circuit-breaker)', type: 'cbp', In: 630, hw: {relay: '7UT82', ct: true, vt: false}, why: 'circuit-breaker and CTs; for transformers above the switch-fuse range or with differential protection'},
  transformerSF: {label: 'Transformer feeder (switch-fuse)', type: 'ltri', In: 200, hw: {relay: 'none'}, why: 'switch-disconnector L-TRI 5F with HV HRC fuses, up to 500 / 800 / 1250 kVA at 7.2 / 12 / 17.5 kV (catalog p. 18)'},
  motorContactor: {label: 'Motor feeder (contactor)', type: 'cp600', In: 400, hw: {relay: '7SK82', ct: true, vt: false, arresters: true}, why: 'vacuum contactor 3TL8 with HV HRC fuses, 7.2 kV; surge limiters against switching overvoltages (starting currents ≤ 600 A, catalog p. 14)'},
  motorCB: {label: 'Motor feeder (circuit-breaker)', type: 'cbp', In: 630, hw: {relay: '7SK82', ct: true, vt: false, arresters: true}, why: 'circuit-breaker for large motors or 12 / 17.5 kV, with surge limiters'},
  disconnect: {label: 'Disconnecting feeder', type: 'dp', In: 1250, hw: {relay: 'none', ct: true, vt: false}, why: 'withdrawable disconnector link: visible isolation without switching capacity (off-load only)'},
  metering: {label: 'Busbar metering', type: 'mp', In: null, hw: {relay: 'none'}, why: 'withdrawable metering part with fuses and VTs on the busbar'},
};
export const TYPE_LABEL = {cbp: 'Circuit-breaker panel', dp: 'Disconnecting panel', mp: 'Metering panel', wvt: 'CB panel + removable VTs', cp600: 'Contactor panel 3TL8', ltri: 'Switch-disconnector L-TRI 5F'};
// rated normal currents offered per type (catalog p. 30; contactor and switch-fuse depend on the fuses)
export const CURRENTS = {cbp: [630, 1000, 1250, 2000, 2500, 3150, 4000], wvt: [1250, 2000, 2500, 3150, 4000], dp: [1250, 2000, 2500, 3150, 4000], mp: [null], cp600: [400], ltri: [200]};

// catalog p. 30: width of the circuit-breaker and disconnecting panel by rated normal current and short-time current
const WIDTH_TABLE = {630: {31.5: [600], 40: []}, 1000: {31.5: [600], 40: [800]}, 1250: {31.5: [800], 40: [800]}, 2000: {31.5: [800], 40: [800]}, 2500: {31.5: [1000], 40: [800, 1000]}, 3150: {31.5: [1000], 40: [800, 1000]}, 4000: {31.5: [1000], 40: [1000]}};
const iscKey = (isc) => (isc <= 31.5 ? 31.5 : 40);
// widths the model can draw for a panel
export function widthsFor(p, row) {
  if (p.type === 'mp') return [800];
  if (p.type === 'cp600') return [600];
  if (p.type === 'ltri') return [800];
  let w = (WIDTH_TABLE[p.In] || {})[iscKey(row.isc)] || [];
  if (p.type === 'dp' || p.type === 'wvt') w = w.filter((x) => x >= 800); // disconnecting panel not in 600 (fn 4); WVT views 800 / 1000
  if (p.type === 'dp' && !w.length && p.In <= 1000) w = [800];
  return w;
}
// forced ventilation: 2500 / 3150 A in 800 mm panels at 40 kA, 4000 A in 1000 mm panels (catalog p. 27 fn 2)
export const fanNeeded = (p, row) => (p.In === 4000) || (iscKey(row.isc) === 40 && p.W === 800 && (p.In === 2500 || p.In === 3150));

export function newPanel(app, row) {
  const a = APPS[app];
  const p = {app, type: a.type, In: a.In, W: 800, hw: {vds: 'lrm', relay: '7SJ82', ct: true, vt: true, busES: false, fan: false, keys: false, padlock: false, motor: false, arresters: false, ...a.hw}};
  if (p.In && row && row.busbar && p.In > row.busbar && p.type !== 'cp600' && p.type !== 'ltri') p.In = CURRENTS[p.type].filter((x) => x <= row.busbar).pop() || p.In;
  p.W = widthsFor(p, row || {isc: 31.5})[0] || 800;
  return p;
}
// protection devices selectable per panel (SIPROTEC 5; drawn in the LV door, the LV tab details the 7SJ82)
export const RELAY_OPTS = [
  ['none', 'None'],
  ['7SJ82', '7SJ82 overcurrent / feeder (1/3 × 19")'],
  ['7SJ85', '7SJ85 overcurrent / feeder, modular (1/2 × 19")'],
  ['7SK82', '7SK82 motor (1/3 × 19")'],
  ['7UT82', '7UT82 transformer differential (1/3 × 19")'],
  ['7SD82', '7SD82 line differential (1/3 × 19")'],
];
// stored or loaded rows from before a field existed get the application's default
export function normPanel(p) {
  p.hw ||= {};
  p.hw.relay ??= APPS[p.app]?.hw.relay ?? '7SJ82';
  return p;
}
export const DEFAULT_ROW = {isc: 31.5, relief: 'lateralL', busbar: 2500};
export function defaultLineup(row = DEFAULT_ROW) {
  return ['incoming', 'metering', 'outgoing', 'outgoing', 'transformerCB', 'transformerSF'].map((a) => newPanel(a, row));
}

// ------------------------------------------------------------------------------------------------ rules
// returns [{level: 'error' | 'warn' | 'info', pos: index | null, text}]
export function validate(lineup, row) {
  const out = [];
  const n = lineup.length;
  const add = (level, pos, text) => out.push({level, pos, text});
  if (!n) add('error', null, 'The row is empty.');
  lineup.forEach((p, i) => {
    const ws = widthsFor(p, row);
    if (p.type === 'cp600' && row.ur !== 7.2) add('error', i, 'Contactor 3TL8 is for 7.2 kV only (O §4.11): set Ur to 7.2 kV or use a circuit-breaker motor feeder.');
    if (p.type === 'ltri' && iscKey(row.isc) === 40) add('error', i, 'The switch-disconnector panel is not available at 40 kA (catalog p. 30).');
    if (p.type === 'cbp' && p.In === 630 && iscKey(row.isc) === 40) add('error', i, '630 A circuit-breaker panels are not offered at 40 kA (catalog p. 30): use 1000 A / 800 mm.');
    if (!ws.length && !(p.type === 'cbp' && p.In === 630)) add('error', i, `No panel width for ${p.In} A at ${row.isc} kA (catalog p. 30).`);
    else if (ws.length && !ws.includes(p.W)) add('error', i, `${p.W} mm is not a width for ${TYPE_LABEL[p.type]} ${p.In ?? ''} A at ${row.isc} kA; use ${ws.join(' / ')} mm.`);
    if (p.In && p.In > row.busbar && p.type !== 'cp600' && p.type !== 'ltri') add('warn', i, `Feeder ${p.In} A is above the busbar rating ${row.busbar} A.`);
    // protection device (engineering rules, not catalog limits)
    const rl = p.hw.relay || 'none', trips = p.type === 'cbp' || p.type === 'wvt' || p.type === 'cp600';
    if (trips && rl === 'none') add('warn', i, 'No protection device: the switching device gets no protection trip, unless the protection sits elsewhere (e.g. a central or upstream device).');
    if (rl !== 'none' && trips && !p.hw.ct) add('error', i, `The ${rl} needs current transformers in this panel: fit CTs.`);
    if (rl !== 'none' && !trips) add('info', i, p.type === 'ltri' ? 'The HV HRC fuses protect the transformer; a protection device here has no circuit-breaker to trip.' : `There is no switching device in this panel for the ${rl} to trip (supervision / annunciation only).`);
    if (rl === '7UT82' && !/^transformer/.test(p.app)) add('info', i, '7UT82 is a transformer differential device: is this panel a transformer feeder?');
    if (rl === '7UT82' && trips) add('info', i, '7UT82: the second set of CTs (transformer secondary side) comes from the transformer or the LV switchboard.');
    if (rl === '7SK82' && !/^motor/.test(p.app)) add('info', i, '7SK82 is a motor protection device: is this panel a motor feeder?');
    if (rl === '7SD82') add('info', i, '7SD82 line differential needs a protection data link (fibre) to the device at the other end of the line.');
    if (fanNeeded(p, row) && !p.hw.fan) add('error', i, `Forced ventilation is required for ${p.In} A in ${p.W} mm${iscKey(row.isc) === 40 ? ' at 40 kA' : ''} (catalog p. 27): tick "Forced ventilation".`);
    if (p.hw.fan && p.W < 800) add('error', i, 'Forced ventilation only in 800 / 1000 mm panels.');
    if (p.hw.busES && p.W > 800) add('error', i, 'The busbar earthing switch is built in 600 / 800 mm panels (110-2300.9).');
    if (p.hw.busES && p.hw.fan) add('error', i, 'The busbar earthing switch box is not possible in a ventilated panel (catalog p. 14).');
    if (p.hw.busES && p.type === 'mp') add('error', i, 'With a withdrawable metering part no earthing switch or VT on the busbar (catalog p. 28 fn 2).');
    if (p.type === 'mp') add('info', i, 'Metering panel: at ≤ 31.5 kA the drawings give 1350 mm only; drawn at the depth of the row.');
    const end = (i === 0 && row.relief === 'lateralL') || (i === n - 1 && row.relief === 'lateralR');
    if (end && p.hw.busES) add('error', i, 'The end panel where the evacuation duct leaves must not have a busbar earthing switch, busbar VTs or a supply from above (I §5.6).');
  });
  if (n && !lineup.some((p) => p.app === 'incoming' || p.app === 'incomingWVT')) add('info', null, 'No incoming feeder in the row: the busbar is supplied from elsewhere (e.g. a bus sectionalizer or another row).');
  if (lineup.filter((p) => p.app === 'metering').length > 1) add('info', null, 'More than one busbar metering panel on one busbar section.');
  if (row.relief === 'absorber' && row.ur === 12 && row.isc <= 25) add('info', null, 'With absorbers at 12 kV, ≤ 25 kA the panel height stays 2300 / 2350 mm (catalog p. 30 fn 3: absorber for 12 kV > 25 kA or 17.5 kV).');
  return out;
}

// ------------------------------------------------------------------------------------------------ totals
const WEIGHT = {435: [700, 770], 600: [800, 950], 800: [1020, 1320], 1000: [1230, 1650]}; // 110-0250.9 sheet 1, ≤ 31.5 kA
export function rowDepth(lineup, row) {
  // single busbar: 1500 for the 3AE5 panels (the model cannot fit the breaker in 1350); 3150 / 4000 A panels 1540 → 1650 drawn
  return lineup.some((p) => p.In >= 3150) ? 1650 : 1500;
}
export function panelHeight(p, row) {
  if (row.relief === 'absorber' && (row.ur === 17.5 || row.isc > 25)) return 2500;
  return p.hw.fan ? 2450 : p.hw.busES ? 2350 : 2300;
}
export function totals(lineup, row) {
  const L = lineup.reduce((s, p) => s + p.W, 0);
  const endWalls = 2 * 35;
  const wMin = lineup.reduce((s, p) => s + (WEIGHT[p.W]?.[0] || 0), 0), wMax = lineup.reduce((s, p) => s + (WEIGHT[p.W]?.[1] || 0), 0);
  const H = Math.max(2300, ...lineup.map((p) => panelHeight(p, row)));
  const D = rowDepth(lineup, row);
  const ceiling = row.relief === 'absorber' ? (row.ur === 17.5 ? 3500 : row.isc <= 25 ? 2800 : row.isc <= 31.5 ? 3000 : 3500) : 2500;
  // room: lateral wall ≥ 150 (IEC 62271-200), ≥ 500 for maintenance and on the side of a closed duct to the outside;
  // rear ≥ 150 (wall-standing); operating aisle ≥ 1250 (device replacement) / ≥ 1700 (extension, panel replacement)
  const sideL = row.relief === 'lateralL' ? 500 : 150, sideR = row.relief === 'lateralR' ? 500 : 150;
  return {L, Lwalls: L + endWalls, D, H, wMin, wMax, ceiling, room: {length: L + endWalls + sideL + sideR, lengthMaint: L + endWalls + 1000, depth: D + 150 + 1250, depthExt: D + 150 + 1700, sideL, sideR}};
}

// ------------------------------------------------------------------------------------------------ row single-line diagram
const SHORT = {incoming: 'Incomer', incomingWVT: 'Incomer + VT', outgoing: 'Cable feeder', transformerCB: 'Transf. (CB)', transformerSF: 'Transf. (fuse)', motorContactor: 'Motor (3TL8)', motorCB: 'Motor (CB)', disconnect: 'Disconnector', metering: 'Metering'};
export function rowSldSvg(lineup, row, sel = -1) {
  const S = 0.16, top = 46, colH = 230;
  let x = 14;
  const cols = lineup.map((p) => { const w = Math.max(104, p.W * S); const c = {p, x, w, cx: x + w / 2}; x += w; return c; });
  const W = x + 14, H = top + colH + 60;
  const o = [`<svg class="rowsld" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Single-line diagram of the switchgear row">`];
  o.push(`<line x1="10" y1="${top}" x2="${W - 10}" y2="${top}" class="bb"/><text x="12" y="${top - 8}" class="t">Busbar ${row.busbar} A · ${row.ur} kV · ${row.isc} kA</text>`);
  const chev = (cx, y, down) => `<path d="M${cx - 6},${y - (down ? 3 : -3)} L${cx},${y + (down ? 3 : -3)} L${cx + 6},${y - (down ? 3 : -3)}" class="l"/>`;
  const fuse = (cx, y) => `<rect x="${cx - 4}" y="${y}" width="8" height="15" class="l"/>`;
  const vt = (cx, y) => `<circle cx="${cx}" cy="${y}" r="5.5" class="l"/><circle cx="${cx}" cy="${y + 8}" r="5.5" class="l"/>`;
  const es = (cx, y) => `<line x1="${cx}" y1="${y}" x2="${cx + 20}" y2="${y}" class="l"/><line x1="${cx + 20}" y1="${y}" x2="${cx + 30}" y2="${y + 12}" class="l"/><line x1="${cx + 24}" y1="${y + 16}" x2="${cx + 38}" y2="${y + 16}" class="l"/><line x1="${cx + 27}" y1="${y + 20}" x2="${cx + 35}" y2="${y + 20}" class="l"/>`;
  cols.forEach(({p, x: x0, w, cx}, i) => {
    o.push(`<rect x="${x0 + 2}" y="${top + 6}" width="${w - 4}" height="${colH}" rx="3" class="${i === sel ? 'cell sel' : 'cell'}" data-lsel="${i}"/>`);
    o.push(`<line x1="${cx}" y1="${top}" x2="${cx}" y2="${top + 24}" class="l"/>`);
    if (p.hw.busES) o.push(es(cx - 52 < x0 ? cx : cx - 40, top + 14));
    let y = top + 24;
    const wd = p.type !== 'ltri';
    if (wd) { o.push(chev(cx, y + 3, true)); y += 8; }
    if (p.type === 'mp') {
      o.push(`<line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + 14}" class="l"/>${fuse(cx, y + 14)}<line x1="${cx}" y1="${y + 29}" x2="${cx}" y2="${y + 40}" class="l"/>${vt(cx, y + 46)}`);
    } else {
      if (p.type === 'cbp' || p.type === 'wvt') o.push(`<line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + 22}" class="l"/><path d="M${cx - 5},${y + 18} l10,10 m0,-10 l-10,10" class="l"/><line x1="${cx}" y1="${y + 50}" x2="${cx + 12}" y2="${y + 26}" class="l b"/>`);
      else if (p.type === 'dp') o.push(`<line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + 50}" class="l"/>`);
      else if (p.type === 'cp600') o.push(`<line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + 6}" class="l"/>${fuse(cx, y + 6)}<line x1="${cx}" y1="${y + 21}" x2="${cx}" y2="${y + 26}" class="l"/><path d="M${cx - 5},${y + 26} a5 5 0 0 0 10 0" class="l"/><line x1="${cx}" y1="${y + 50}" x2="${cx + 12}" y2="${y + 30}" class="l b"/>`);
      else if (p.type === 'ltri') o.push(`<line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + 8}" class="l"/><line x1="${cx}" y1="${y + 30}" x2="${cx + 12}" y2="${y + 10}" class="l b"/><line x1="${cx}" y1="${y + 30}" x2="${cx}" y2="${y + 34}" class="l"/>${fuse(cx, y + 34)}`);
      y += 50;
      if (wd) { o.push(chev(cx, y + 3, false)); y += 8; }
      o.push(`<line x1="${cx}" y1="${y}" x2="${cx}" y2="${top + colH - 30}" class="l"/>`);
      if (p.hw.ct || p.type === 'ltri') o.push(`<circle cx="${cx}" cy="${y + 16}" r="6" class="l"/>`);
      if (p.hw.relay && p.hw.relay !== 'none') o.push(`<line x1="${cx + 6}" y1="${y + 16}" x2="${cx + 14}" y2="${y + 16}" class="l d"/><rect x="${cx + 14}" y="${y + 9}" width="34" height="14" class="l"/><text x="${cx + 31}" y="${y + 19.5}" class="c r">${esc(p.hw.relay)}</text>`);
      if ((p.hw.vt && p.type !== 'wvt') || p.type === 'wvt') o.push(`<line x1="${cx}" y1="${y + 36}" x2="${cx - 16}" y2="${y + 36}" class="l"/>${vt(cx - 22, y + 30)}${p.type === 'wvt' ? fuse(cx - 26, y + 50) : ''}`);
      o.push(es(cx, y + 58));
      if (p.hw.arresters) o.push(`<rect x="${cx - 26}" y="${y + 80}" width="9" height="16" class="l"/><line x1="${cx - 17}" y1="${y + 84}" x2="${cx}" y2="${y + 84}" class="l"/>`);
      o.push(`<path d="M${cx - 6},${top + colH - 30} l12,0 l-6,10 z" class="l"/>`);
    }
    o.push(`<text x="${cx}" y="${top + colH - 6}" class="c">+${i + 1}</text>`);
    o.push(`<text x="${cx}" y="${top + colH + 14}" class="c s">${esc(SHORT[p.app] || TYPE_LABEL[p.type])}</text>`);
    o.push(`<text x="${cx}" y="${top + colH + 28}" class="c s">${p.In ? p.In + ' A · ' : ''}${p.W} mm</text>`);
  });
  o.push('</svg>');
  return o.join('');
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

// ------------------------------------------------------------------------------------------------ export
export function lineupCsv(lineup, row) {
  const head = ['Position', 'Application', 'Panel type', 'Rated current A', 'Width mm', 'Height mm', 'CTs', 'VTs', 'Voltage detection', 'Busbar earthing switch', 'Forced ventilation', 'Key interlocks', 'Padlocks', 'Motor racking', 'Surge arresters / limiters', 'Protection device', 'Weight kg (≤ 31.5 kA)'];
  const rows = lineup.map((p, i) => [`+${i + 1}`, APPS[p.app]?.label || '', TYPE_LABEL[p.type], p.In ?? '', p.W, panelHeight(p, row), p.hw.ct || p.type === 'ltri' ? 'yes' : 'no', p.type === 'wvt' ? 'removable' : p.type === 'mp' ? 'on the part' : p.hw.vt ? 'fixed' : 'no', p.hw.vds, p.hw.busES ? 'yes' : 'no', p.hw.fan ? 'yes' : 'no', p.hw.keys ? 'yes' : 'no', p.hw.padlock ? 'yes' : 'no', p.hw.motor ? 'yes' : 'no', p.hw.arresters ? 'yes' : 'no', p.hw.relay && p.hw.relay !== 'none' ? `SIPROTEC 5 ${p.hw.relay}` : 'none', (WEIGHT[p.W] || []).join('–')]);
  return [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
