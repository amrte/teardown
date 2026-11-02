// SIPROTEC 5 7SJ82 (1/3 x 19", PS101 + IO102), every key, LED and terminal as its own named element, with the
// printed legends (key glyphs, terminal numbers, module letters, label strips, display) drawn onto canvas textures.
//
// Geometry and terminal designations: SIPROTEC 5 hardware manual C53000-G5040-C002-Q, Fig. 2-1 / 2-22 (front),
// Fig. 2-4 (rear of a 7xx82 with IO102), Fig. 3-87 (IO102 terminal diagram), catalog Fig. 6.2/23 (PS101).
// Positions are read from those figures and are accurate to a few millimetres. The LED texts, function-key texts,
// display content and the "example" connections are a typical cable-feeder allocation, not a Siemens default:
// every LED, key and binary I/O of a SIPROTEC 5 is routed freely in DIGSI 5.
//
// Relay-local axes (mm): origin at the device centre on the door's outer face, x right (seen from the front), y up,
// z towards the operator. Front plate face at z = 33, rear plate at z = -165.
import * as THREE from 'three';
import {B, C, RB, spread} from './geom.js';

// ------------------------------------------------------------------------------------------------ terminals
// [designation, function (IO102 / PS101), example connection in this cable feeder]
export const TERMINALS = [
  ['A1', 'I1 ● (polarity)', 'CT L1 s1 via -X2'],
  ['A2', 'I1', 'CT star point (A2, A4, A6 bridged), earthed once at -X2'],
  ['A3', 'I2 ●', 'CT L2 s1 via -X2'],
  ['A4', 'I2', 'CT star point'],
  ['A5', 'I3 ●', 'CT L3 s1 via -X2'],
  ['A6', 'I3', 'CT star point'],
  ['A7', 'I4 ●', 'Core-balance CT s1 via -X2'],
  ['A8', 'I4', 'Core-balance CT s2 via -X2'],
  ['B1', 'V1 ●', 'VT a via -F11 / -X3'],
  ['B2', 'V1 / V2 / V3 common (star point)', 'VT n via -X3 (earthed at -X3)'],
  ['B3', 'V2 ●', 'VT b via -F11 / -X3'],
  ['B4', 'V3 ●', 'VT c via -F11 / -X3'],
  ['B5', 'V4 ●', 'Open delta da via -F12'],
  ['B6', 'V4', 'Open delta dn via -F12'],
  ['B7', 'BO 1.1 (make contact)', 'TRIP: to -X0:C2 → -S1 23-24 → -Y1'],
  ['B8', 'BO 1.1 (make contact)', 'TRIP: from L+ via -F02'],
  ['B9', 'BO 1.2 NC', ''],
  ['B10', 'BO 1.2 common', 'CLOSE: from L+ via -F02'],
  ['B11', 'BO 1.2 NO', 'CLOSE: to -X0:A2 → -Y9'],
  ['B12', 'BO 1.3 NC', ''],
  ['B13', 'BO 1.3 common', 'TRIP 2: from L+'],
  ['B14', 'BO 1.3 NO', 'TRIP 2: to -X0:A3 → -Y2 (if fitted)'],
  ['D1', 'BO 1.4', 'Protection trip signal (SCADA)'],
  ['D2', 'BO 1.4 / 1.5 / 1.6 common', 'L+ (signalling)'],
  ['D3', 'BO 1.5', 'Pickup → incomer (reverse interlocking)'],
  ['D4', 'BI 1.1 (isolated)', 'Trip-circuit supervision: across BO 1.1 (B8)'],
  ['D5', 'BO 1.6', 'General alarm'],
  ['D6', 'BI 1.1 (isolated)', 'Trip-circuit supervision: across BO 1.1 (B7)'],
  ['D7', 'BI 1.2', 'CB closed: -S1 53-54 (-X0:C8 → D9)'],
  ['D8', 'BI 1.3', 'CB open: -S1 51-52 (-X0:C8 → D8)'],
  ['D9', 'BI 1.4', 'Truck in service position'],
  ['D10', 'BI 1.5', 'Truck in test position'],
  ['D11', 'BI 1.6', 'Feeder earthing switch closed'],
  ['D12', 'BI 1.7', 'VT MCB -F11 tripped'],
  ['D13', 'BI 1.8', 'Closing spring charged (-S4)'],
  ['D14', 'BI 1.2–1.8 common', 'L−'],
  ['L1', 'Auxiliary supply +', 'L+ via -F01'],
  ['L2', 'Auxiliary supply −', 'L− via -F01'],
  ['L3', 'BO 2.1 (make contact)', 'Breaker failure: to the upstream breaker trip'],
  ['L4', 'BO 2.1 (make contact)', 'Breaker failure: from L+'],
  ['L5', 'BO 2.2 common', ''],
  ['L6', 'BO 2.2 NC', ''],
  ['L7', 'Life contact NC', 'Device-fault alarm (closed = fault / no supply)'],
  ['L8', 'BO 2.2 NO', ''],
  ['L9', 'Life contact NO', ''],
  ['L10', 'Life contact common', 'Alarm L+'],
  ['L11', 'BI 2.1–2.3 common', 'L−'],
  ['L12', 'BI 2.1', 'External trip'],
  ['L13', 'BI 2.3', 'Reverse interlocking in (from the outgoing feeders)'],
  ['L14', 'BI 2.2', 'MCB tripped (-F02 / -F03 auxiliary contacts)'],
];
const termById = Object.fromEntries(TERMINALS.map((t) => [t[0], t]));
const termLabel = (id) => {
  const [, fn, ex] = termById[id];
  return `Terminal ${id} · ${fn}${ex ? ' · example: ' + ex : ''}`;
};

// example LED and function-key allocation (free in DIGSI 5)
export const LEDS = [
  'Pickup (any protection)', 'Trip (any protection)', 'Overcurrent trip I>, I>>', 'Earth-fault trip IE>, 67Ns',
  'Thermal overload alarm (49)', 'Breaker failure (50BF)', 'Trip-circuit fault (74TC)', 'VT MCB tripped',
  'Arc detected (with arc module)', 'Local control active', 'CB closed (red) / open (green)', 'Truck in service position',
  'Truck in test position', 'Earthing switch closed', 'Closing spring charged', 'Lockout (86) active',
];
export const FKEYS = ['Local / remote', 'Reset LEDs + lockout', 'Fault records', 'Measured values', 'Protection on / off', 'Test mode', 'Event log', 'Control display', 'Spare'];

// front elements with their manual names, in the order of the hardware manual Fig. 2-22
export const FRONT_ELEMENTS = [
  ['RUN LED (green)', 'Operating state: device running'],
  ['ERROR LED (red)', 'Operating state: device fault; the life contact drops at the same time'],
  ['16 LEDs, red / green', 'Freely routed; text on the LED label strip (cover label) beside them. Example allocation below'],
  ['LED label strip', 'Paper insert under a transparent cover, written per panel'],
  ['Display (large, 240 × 320 px)', 'Menus, measured values, event and fault logs, control display with the feeder mimic'],
  ['LED reset / test key', 'Resets latched LEDs, held: LED test'],
  ['2 softkeys', 'Act on the caption shown at the bottom of the display above them'],
  ['Navigation keys ◀ ▲ ▼ ▶', 'Move through menus and lists, select the switching device in the control display'],
  ['Numeric keys 0–9, decimal point', 'Values and passwords'],
  ['Fn key (blue) + F1–F9', 'Fn turns keys 1–9 into function keys F1–F9 (small print on each key). Example allocation on the function-key label strip'],
  ['Ctrl key (yellow)', 'Opens control: select the device, then I or O'],
  ['I key (green)', 'CLOSE the selected switching device (after confirmation, authority and interlocking checks)'],
  ['O key (red)', 'OPEN the selected switching device'],
  ['USB type B port with cover', 'DIGSI 5 service connection; cover held by a captive screw'],
  ['4 screw covers', 'Hide the M4 fastening screws (1.2 Nm); remove with a screwdriver in the slot'],
];

// ------------------------------------------------------------------------------------------------ textures
const HAS_DOM = typeof document !== 'undefined';
const PPM = 8; // texture pixels per mm
const FONT = '"IBM Plex Sans Condensed", "Arial Narrow", Arial, sans-serif';
const MONO = '"IBM Plex Mono", Menlo, monospace';
function atlas(Wmm, Hmm, draw) {
  const c = document.createElement('canvas');
  c.width = Math.round(Wmm * PPM);
  c.height = Math.round(Hmm * PPM);
  const g = c.getContext('2d');
  g.scale(PPM, PPM);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const text = (g, s, x, y, size, {weight = 600, color = '#1f2427', align = 'center', font = FONT} = {}) => {
  g.font = `${weight} ${size}px ${font}`;
  g.fillStyle = color;
  g.textAlign = align;
  g.fillText(s, x, y);
};

// front: panel window x -70..70, y -128..128 (canvas x = X + 70, y = 128 - Y)
const FW = 140, FH = 256;
const fc = (X, Y) => [X + 70, 128 - Y];
// rear: x -72.5..72.5, y -122..122, seen from behind (canvas x = 72.5 - X, y = 122 - Y)
const RW = 145, RH = 244;
const rc = (X, Y) => [72.5 - X, 122 - Y];

// front element positions (read from HW Fig. 2-22)
const KEY = 11.5;
const KX = [5, 19, 33], KY = [-63, -77, -91, -105];
const KEYS = [
  ['7', 'F7'], ['8', 'F8'], ['9', 'F9'],
  ['4', 'F4'], ['5', 'F5'], ['6', 'F6'],
  ['1', 'F1'], ['2', 'F2'], ['3', 'F3'],
  ['Fn', ''], ['0', ''], ['.', ''],
];
const LEDY = (i) => 92 - i * 7.1;
const NAV = [['◀', 2, -37, 'Navigation key left'], ['▶', 36, -37, 'Navigation key right'], ['▲', 19, -28, 'Navigation key up'], ['▼', 19, -46, 'Navigation key down']];
const CTRL = [['Ctrl', -65, 'yellow', 'Ctrl key (control)'], ['I', -85, 'green', 'Control key I (CLOSE)'], ['O', -105, 'red', 'Control key O (OPEN)']];

// rear blocks (relay-local x0, x1, y0, y1, depth behind the rear plate)
export const BLOCKS = {
  A: {x0: -70, x1: 7, y0: 32, y1: 120, d: 30, poles: 8},
  B: {x0: -64, x1: -19, y0: -21, y1: 30, d: 24, poles: 14},
  D: {x0: -64, x1: -19, y0: -122, y1: -71, d: 24, poles: 14},
  L: {x0: 9, x1: 51, y0: 17, y1: 68, d: 24, poles: 14},
};
// terminal n of a block: screw and wire-entry position. Seen from behind odd numbers are on the left (device +x).
function termPos(k, n) {
  const b = BLOCKS[k];
  if (k === 'A') {
    const row = Math.floor((n - 1) / 2), odd = n % 2 === 1;
    const y = 110 - row * 22 - (odd ? 0 : 6);
    return {x: odd ? -12 : -52, y, num: [odd ? -23 : -41, y], out: odd ? 1 : -1};
  }
  const row = Math.floor((n - 1) / 2), odd = n % 2 === 1;
  const y = b.y1 - 4.5 - row * ((b.y1 - b.y0 - 9) / 6);
  return odd ? {x: b.x1 - 10, y, entry: b.x1 - 3.5, num: [b.x1 - 17.5, y], out: 1} : {x: b.x0 + 10, y, entry: b.x0 + 3.5, num: [b.x0 + 17.5, y], out: -1};
}

function displayArt(g) {
  // large display x -21..59, y -15..96: example control display with the feeder mimic and measured values
  const [x0, y0] = fc(-21, 96);
  const w = 80, h = 111;
  g.fillStyle = '#9fb7ad';
  g.fillRect(x0, y0, w, h);
  g.fillStyle = '#2b3a36';
  g.fillRect(x0, y0, w, 7);
  text(g, 'Control · Feeder Q10', x0 + 3, y0 + 3.7, 3.6, {color: '#dfe9e4', align: 'left'});
  text(g, '10:42', x0 + w - 3, y0 + 3.7, 3.6, {color: '#dfe9e4', align: 'right'});
  const ink = '#1d2b27';
  g.strokeStyle = ink;
  g.lineWidth = 0.7;
  const cx = x0 + 26;
  // busbar, withdrawable breaker (disconnect chevrons + CB square), earthing switch, cable
  g.beginPath(); g.moveTo(x0 + 6, y0 + 14); g.lineTo(x0 + 46, y0 + 14); g.stroke();
  text(g, 'BB', x0 + 49, y0 + 14, 3.4, {color: ink, align: 'left'});
  g.beginPath(); g.moveTo(cx, y0 + 14); g.lineTo(cx, y0 + 20); g.moveTo(cx - 3, y0 + 23); g.lineTo(cx, y0 + 20); g.lineTo(cx + 3, y0 + 23); g.stroke();
  g.beginPath(); g.moveTo(cx, y0 + 24); g.lineTo(cx, y0 + 28); g.stroke();
  g.fillStyle = '#3d8a45'; g.fillRect(cx - 5, y0 + 28, 10, 10); g.strokeRect(cx - 5, y0 + 28, 10, 10);
  text(g, 'Q0', cx + 8, y0 + 33, 3.4, {color: ink, align: 'left'});
  text(g, 'open', cx + 17, y0 + 33, 3.2, {color: ink, align: 'left', weight: 400});
  g.beginPath(); g.moveTo(cx, y0 + 38); g.lineTo(cx, y0 + 42); g.moveTo(cx - 3, y0 + 42); g.lineTo(cx, y0 + 45); g.lineTo(cx + 3, y0 + 42); g.stroke();
  g.beginPath(); g.moveTo(cx, y0 + 45); g.lineTo(cx, y0 + 60); g.stroke();
  g.beginPath(); g.moveTo(cx, y0 + 52); g.lineTo(cx - 10, y0 + 52); g.lineTo(cx - 13, y0 + 47); g.moveTo(cx - 14, y0 + 52); g.lineTo(cx - 14, y0 + 56); g.moveTo(cx - 17, y0 + 56); g.lineTo(cx - 11, y0 + 56); g.stroke();
  text(g, 'Q8', cx - 22, y0 + 50, 3.4, {color: ink});
  g.beginPath(); g.moveTo(cx - 3, y0 + 60); g.lineTo(cx + 3, y0 + 60); g.lineTo(cx, y0 + 64); g.closePath(); g.stroke();
  text(g, 'cable', cx + 6, y0 + 61, 3.2, {color: ink, align: 'left', weight: 400});
  // measured values
  const mv = [['IL1', '212 A'], ['IL2', '208 A'], ['IL3', '215 A'], ['IN', '0.4 A'], ['V12', '10.02 kV'], ['P', '3.61 MW'], ['cos φ', '0.95']];
  mv.forEach(([k, v], i) => {
    text(g, k, x0 + 5, y0 + 72 + i * 4.6, 3.4, {color: ink, align: 'left', font: MONO, weight: 500});
    text(g, v, x0 + w - 5, y0 + 72 + i * 4.6, 3.4, {color: ink, align: 'right', font: MONO, weight: 500});
  });
  // softkey captions above the softkeys
  g.fillStyle = '#2b3a36';
  g.fillRect(x0, y0 + h - 6, w, 6);
  text(g, 'Menu', x0 + 4, y0 + h - 3, 3.4, {color: '#dfe9e4', align: 'left'});
  text(g, 'Select', x0 + w - 4, y0 + h - 3, 3.4, {color: '#dfe9e4', align: 'right'});
}

function frontArt(g) {
  g.fillStyle = '#8e99a1';
  g.fillRect(0, 0, FW, FH);
  // top strip: device designation (no maker's logo drawn)
  let [x, y] = fc(30, 107);
  text(g, 'SIPROTEC', x, y, 5.6, {weight: 600, color: '#26313a'});
  [x, y] = fc(56, 107);
  g.fillStyle = '#f2f2ee'; g.fillRect(x - 7, y - 2.6, 14, 5.2);
  text(g, '7SJ82', x, y + 0.2, 3.6, {weight: 700, color: '#26313a'});
  [x, y] = fc(-54, 107); text(g, 'Run', x, y, 3.4, {align: 'left', color: '#26313a'});
  [x, y] = fc(-37, 107); text(g, 'Error', x, y, 3.4, {align: 'left', color: '#26313a'});
  // LED label strip (cover label) x -54..-26, y -19..96
  [x, y] = fc(-54, 96);
  g.fillStyle = '#f6f5f0'; g.fillRect(x, y, 28, 115);
  g.strokeStyle = '#c9c7bd'; g.lineWidth = 0.25;
  for (let i = 0; i < 16; i++) {
    const [, ly] = fc(0, LEDY(i));
    g.beginPath(); g.moveTo(x, ly + 3.55); g.lineTo(x + 28, ly + 3.55); g.stroke();
    text(g, LEDS[i], x + 1, ly, 2.15, {align: 'left', color: '#22262a', weight: 500});
  }
  // display
  displayArt(g);
  // function-key label strip x -35..-9, y -116..-55
  [x, y] = fc(-35, -55);
  g.fillStyle = '#f6f5f0'; g.fillRect(x, y, 26, 61);
  FKEYS.forEach((s, i) => {
    const ly = y + 4 + i * 6.4;
    text(g, `F${i + 1}`, x + 1.2, ly, 2.4, {align: 'left', weight: 700, color: '#22262a'});
    text(g, s, x + 6, ly, 2.2, {align: 'left', weight: 500, color: '#22262a'});
    g.strokeStyle = '#c9c7bd'; g.beginPath(); g.moveTo(x, ly + 3.2); g.lineTo(x + 26, ly + 3.2); g.stroke();
  });
  // USB recess and the bottom tab
  [x, y] = fc(-70, -64);
  g.fillStyle = '#5a646b'; g.fillRect(x, y, 28, 55);
  [x, y] = fc(-33, -119);
  g.fillStyle = '#f6f5f0'; g.fillRect(x, y, 25, 4);
  // fine print under the keypad groups
  [x, y] = fc(19, -116); text(g, 'Fn + 1…9 = F1…F9', x, y, 2.4, {color: '#3a454d', weight: 500});
}

function keyArt(g) {
  // transparent atlas with the glyphs of every key, same mapping as the front
  const dark = '#22262a';
  KEYS.forEach(([main, f], i) => {
    const [x, y] = fc(KX[i % 3], KY[Math.floor(i / 3)]);
    if (main === 'Fn') { text(g, 'Fn', x, y + 0.3, 4.4, {color: '#ffffff', weight: 700}); return; }
    text(g, main, x + 0.6, y + 1.2, 5.2, {color: dark, weight: 600});
    if (f) text(g, f, x - 3.6, y - 3.4, 2.3, {color: '#2f5f8f', weight: 700});
  });
  for (const [s, X, Y] of NAV) { const [x, y] = fc(X, Y); text(g, s, x, y + 0.3, 4.2, {color: dark}); }
  for (const [s, Y, , ] of CTRL) {
    const [x, y] = fc(55, Y);
    if (s === 'O') { g.strokeStyle = '#ffffff'; g.lineWidth = 0.9; g.beginPath(); g.arc(x, y, 3.6, 0, Math.PI * 2); g.stroke(); }
    else if (s === 'I') { g.fillStyle = '#ffffff'; g.fillRect(x - 0.6, y - 4, 1.2, 8); }
    else text(g, 'Ctrl', x, y + 0.3, 4.2, {color: dark, weight: 700});
  }
  // LED reset / test key symbol
  let [x, y] = fc(-59, -30);
  g.strokeStyle = dark; g.lineWidth = 0.5;
  g.beginPath(); g.arc(x, y - 0.8, 1.8, 0, Math.PI * 2); g.stroke();
  for (let a = 0; a < 6; a++) { const t = (a / 6) * Math.PI * 2; g.beginPath(); g.moveTo(x + Math.cos(t) * 2.6, y - 0.8 + Math.sin(t) * 2.6); g.lineTo(x + Math.cos(t) * 3.4, y - 0.8 + Math.sin(t) * 3.4); g.stroke(); }
  g.beginPath(); g.moveTo(x - 1.6, y + 2.6); g.lineTo(x - 0.3, y + 3.6); g.lineTo(x + 2, y + 1.6); g.stroke();
  // USB cover marking
  [x, y] = fc(-56.5, -82); text(g, 'USB', x, y, 3.0, {color: '#e8ecee', weight: 700});
}

function rearArt(g) {
  // plate markings (letters, positions, battery, earth) and the numbers on each terminal block, seen from behind
  const ink = '#1d2226';
  const put = (s, X, Y, size, opt = {}) => { const [x, y] = rc(X, Y); text(g, s, x, y, size, {color: ink, ...opt}); };
  put('A', 12, 115, 5.2, {weight: 700});
  put('B', -16.5, 24, 5.2, {weight: 700});
  put('D', -16.5, -77, 5.2, {weight: 700});
  put('L', 54, 62, 5.2, {weight: 700});
  put('Pos.2', 30, 73, 3.4);
  put('Pos.1', -41, -46, 3.4);
  put('E', 55, 11, 4.2, {weight: 700});
  put('F', 55, -64, 4.2, {weight: 700});
  put('G', 6.5, -4, 4.0, {weight: 700});
  put('J', 3, -107.5, 4.0, {weight: 700});
  put('Battery', 13, -59, 2.6, {weight: 700});
  // protective earth symbol
  const [ex, ey] = rc(-9, -104);
  g.strokeStyle = ink; g.lineWidth = 0.45;
  g.beginPath(); g.arc(ex, ey, 3.2, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(ex, ey - 2.2); g.lineTo(ex, ey + 0.4); g.moveTo(ex - 2, ey + 0.4); g.lineTo(ex + 2, ey + 0.4); g.moveTo(ex - 1.3, ey + 1.3); g.lineTo(ex + 1.3, ey + 1.3); g.moveTo(ex - 0.6, ey + 2.1); g.lineTo(ex + 0.6, ey + 2.1); g.stroke();
  // terminal numbers
  for (const [k, b] of Object.entries(BLOCKS)) {
    for (let n = 1; n <= b.poles; n++) {
      const t = termPos(k, n);
      const [x, y] = rc(t.num[0], t.num[1]);
      text(g, String(n), x, y + 0.2, k === 'A' ? 4.0 : 3.0, {color: ink, weight: 700});
    }
  }
}

// planes that carry a sub-rectangle of an atlas; uv from the vertex positions so the texture lines up exactly
function decal(x0, x1, y0, y1, z, {flip = false, area}) {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
  if (flip) g.rotateY(Math.PI);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const X = pos.getX(i), Y = pos.getY(i);
    uv.setXY(i, flip ? (area.X1 - X) / (area.X1 - area.X0) : (X - area.X0) / (area.X1 - area.X0), (Y - area.Y0) / (area.Y1 - area.Y0));
  }
  return g;
}
const FRONT_AREA = {X0: -70, X1: 70, Y0: -128, Y1: 128};
const REAR_AREA = {X0: -72.5, X1: 72.5, Y0: -122, Y1: 122};

// textured materials, registered into the material dictionary the part builders use (none without a DOM)
export function siprotecMaterials(mats) {
  if (!HAS_DOM) return {};
  const planes = mats.galv.clippingPlanes;
  const mk = (map, o = {}) => new THREE.MeshStandardMaterial({map, roughness: 0.6, metalness: 0.02, clippingPlanes: planes, ...o});
  return {
    sipFront: mk(atlas(FW, FH, frontArt), {roughness: 0.5}),
    sipKeys: mk(atlas(FW, FH, keyArt), {alphaTest: 0.35, transparent: false}),
    sipRear: mk(atlas(RW, RH, rearArt), {alphaTest: 0.35, transparent: false}),
    ledLit: new THREE.MeshStandardMaterial({color: 0xff4b3a, emissive: 0xff2a1a, emissiveIntensity: 0.9, roughness: 0.3, clippingPlanes: planes}),
    ledGreen: new THREE.MeshStandardMaterial({color: 0x52d26a, emissive: 0x2fd24f, emissiveIntensity: 0.9, roughness: 0.3, clippingPlanes: planes}),
  };
}

// --------------------------------------------------------------------------------------------- the device
export function buildSiprotec(p, pt, {rx = 0, ry = 0, textured = false} = {}) {
  const at = (x, y) => [rx + x, ry + y];
  const F = 33;
  const box = (x, y, w, h, z0, z1, mat, lab) => p.add(B(rx + x - w / 2, rx + x + w / 2, ry + y - h / 2, ry + y + h / 2, z0, z1), mat, lab);
  // housing, front frame, operation panel
  p.add(RB(rx - 75, rx + 75, ry - 133, ry + 133, 0, 30, 5, 2), 'black', 'Front frame');
  p.add(B(rx - 70, rx + 70, ry - 128, ry + 128, 30, F), 'slate', 'On-site operation panel');
  if (textured) p.add(decal(rx - 70, rx + 70, ry - 128, ry + 128, F + 0.08, {area: shift(FRONT_AREA, rx, ry)}), 'sipFront', 'On-site operation panel');
  p.add(B(rx - 62, rx + 62, ry - 122, ry + 122, -163, 0), 'grey', 'Housing (1/3 × 19")');
  for (const s of [-1, 1]) for (const y of spread(ry - 110, ry + 110, 6)) p.add(B(Math.min(rx + s * 62, rx + s * 72.5), Math.max(rx + s * 62, rx + s * 72.5), y - 6, y + 6, -160, -8), 'grey', 'Heat-sink ribs');
  p.add(B(rx - 62, rx + 62, ry - 122, ry + 122, -165, -163), 'galvDark', 'Rear plate');
  p.add(B(rx - 48, rx + 48, ry + 122, ry + 122.4, -150, -40), 'white', 'Name plate (order no., serial no., auxiliary voltage, In 1 / 5 A, BI range)');
  // operating-state LEDs, 16 LEDs
  const led = (x, y, mat, lab) => p.add(C(1.7, 1.7, 1.6, 'z', rx + x, ry + y, F + 0.8, 10), mat, lab);
  led(-58, 107, textured ? 'ledGreen' : 'green', 'RUN LED (green): device running');
  led(-41, 107, 'ledOff', 'ERROR LED (red): device fault');
  for (let i = 0; i < 16; i++) {
    const lit = i === 10 ? (textured ? 'ledGreen' : 'green') : 'ledOff';
    led(-59, LEDY(i), lit, `LED ${i + 1} (red / green) · example: ${LEDS[i]}`);
  }
  // printed regions get their own decal (same artwork) so hovering names them
  const region = (x0, x1, y0, y1, lab) => { if (textured) p.add(decal(rx + x0, rx + x1, ry + y0, ry + y1, F + 0.16, {area: shift(FRONT_AREA, rx, ry)}), 'sipFront', lab); };
  region(-54, -26, -19, 96, 'LED label strip (cover label), example texts');
  region(-21, 59, -15, 96, 'Display (large, 240 × 320 px), example: control display with feeder mimic and measured values');
  region(-35, -9, -116, -55, 'Function-key label strip (cover label), example F1–F9');
  region(10, 50, 100, 114, 'Device designation SIPROTEC 7SJ82');
  // keys below the display
  const round = (x, y, lab) => { const [X, Y] = at(x, y); p.add(C(5, 5, 2, 'z', X, Y, F + 1, 20), 'beige', lab); };
  round(-59, -30, 'LED reset / test key');
  round(-19, -30, 'Softkey left (caption on the display: Menu)');
  round(59, -30, 'Softkey right (caption on the display: Select)');
  for (const [, x, y, lab] of NAV) p.add(RB(rx + x - 5.5, rx + x + 5.5, ry + y - 4.5, ry + y + 4.5, F, F + 2.2, 1.5, 1), 'beige', lab);
  KEYS.forEach(([main, f], i) => {
    const x = KX[i % 3], y = KY[Math.floor(i / 3)];
    const lab = main === 'Fn' ? 'Fn key (shifts 1–9 to F1–F9)' : main === '.' ? 'Key . (decimal point)' : f ? `Key ${main} / function key ${f} · example: ${FKEYS[+f.slice(1) - 1]}` : `Key ${main}`;
    p.add(RB(rx + x - KEY / 2, rx + x + KEY / 2, ry + y - KEY / 2, ry + y + KEY / 2, F, F + 2.2, 1.5, 1), main === 'Fn' ? 'blue' : 'beige', lab);
  });
  for (const [, y, mat, lab] of CTRL) p.add(RB(rx + 55 - 8.5, rx + 55 + 8.5, ry + y - 8.5, ry + y + 8.5, F, F + 2.4, 1.5, 1), mat, lab);
  // USB port with cover and captive screw, bottom tab, screw covers over the M4 fastening screws
  box(-56.5, -91.5, 27, 51, F, F + 4, 'black', 'USB type B port cover (DIGSI 5 service port behind)');
  { const [X, Y] = at(-56.5, -108); p.add(C(2.6, 2.6, 1.6, 'z', X, Y, F + 4.8, 14), 'steel', 'Captive screw of the USB cover'); }
  box(-20.5, -121, 25, 4, F, F + 0.6, 'white', 'Label-strip pull tab');
  for (const y of [127.9, -127.9]) for (const x of [-66.75, 64.75]) { const [X, Y] = at(x, y); p.add(C(3.2, 3.2, 1.6, 'z', X, Y, 30.8, 14), 'black', 'Screw cover (M4 fastening screw behind, 1.2 Nm)'); }
  if (textured) {
    // key glyphs: one decal per key, so hovering a glyph names the key
    const area = shift(FRONT_AREA, rx, ry), z = F + 2.25;
    KEYS.forEach(([main, f], i) => {
      const x = KX[i % 3], y = KY[Math.floor(i / 3)];
      const lab = main === 'Fn' ? 'Fn key (shifts 1–9 to F1–F9)' : main === '.' ? 'Key . (decimal point)' : f ? `Key ${main} / function key ${f} · example: ${FKEYS[+f.slice(1) - 1]}` : `Key ${main}`;
      p.add(decal(rx + x - 5.5, rx + x + 5.5, ry + y - 5.5, ry + y + 5.5, z, {area}), 'sipKeys', lab);
    });
    for (const [, x, y, lab] of NAV) p.add(decal(rx + x - 5, rx + x + 5, ry + y - 4, ry + y + 4, z, {area}), 'sipKeys', lab);
    for (const [, y, , lab] of CTRL) p.add(decal(rx + 55 - 8, rx + 55 + 8, ry + y - 8, ry + y + 8, F + 2.45, {area}), 'sipKeys', lab);
    p.add(decal(rx - 64, rx - 54, ry - 35, ry - 25, F + 2.05, {area}), 'sipKeys', 'LED reset / test key');
    p.add(decal(rx - 66, rx - 47, ry - 87, ry - 77, F + 4.05, {area}), 'sipKeys', 'USB type B port cover (DIGSI 5 service port behind)');
  }

  // ------------------------------------------------------------------------------------------- rear
  const zr = -165;
  const blk = (b, mat, lab) => pt.add(B(rx + b.x0, rx + b.x1, ry + b.y0, ry + b.y1, zr - b.d, zr), mat, lab);
  const BLK_LABEL = {
    A: 'Current terminal block A (IO102: I1–I4, 8 poles, ring lugs, 2.7 Nm)',
    B: 'Voltage terminal block B (IO102: V1–V4, BO 1.1–1.3, 14 poles, 1.0 Nm)',
    D: 'Voltage terminal block D (IO102: BO 1.4–1.6, BI 1.1–1.8, 14 poles, 1.0 Nm)',
    L: 'Voltage terminal block L (PS101: supply, BO 2.1–2.2, life contact, BI 2.1–2.3, 14 poles, 1.0 Nm)',
  };
  for (const k of Object.keys(BLOCKS)) blk(BLOCKS[k], 'termGrey', BLK_LABEL[k]);
  // spring clips that hold each block on the rear plate (bend outwards to pull the block)
  for (const [k, b] of Object.entries(BLOCKS)) for (const y of [b.y1 - 6, b.y0 + 6]) {
    const x = k === 'L' ? b.x0 - 2 : b.x0 - 2;
    pt.add(B(rx + x - 1, rx + x + 1, ry + y - 5, ry + y + 5, zr - b.d + 4, zr), 'steel', `Spring clip of block ${k} (bend outwards to pull the block)`);
  }
  // every terminal: clamping screw, wire entry, and a wire where the example uses it
  for (const [k, b] of Object.entries(BLOCKS)) {
    const face = zr - b.d;
    for (let n = 1; n <= b.poles; n++) {
      const id = `${k}${n}`, t = termPos(k, n), lab = termLabel(id), used = !!termById[id][2];
      if (k === 'A') {
        pt.add(C(4.5, 4.5, 3, 'z', rx + t.x, ry + t.y, face - 1.5, 16), 'steel', lab);
        pt.add(B(rx + t.x - 1.6, rx + t.x + 1.6, ry + t.y - 0.4, ry + t.y + 0.4, face - 3.2, face - 2.9), 'black', lab);
        // ring lug under the screw, tongue to the outside, wire 2.5 mm² going back
        const xo = t.x + t.out * 11;
        pt.add(C(4.8, 4.8, 0.8, 'z', rx + t.x, ry + t.y, face - 0.4, 16), 'tinned', `Ring lug on ${id} (insulated, D 5.0 mm)`);
        pt.add(B(rx + Math.min(t.x, xo), rx + Math.max(t.x, xo), ry + t.y - 2.5, ry + t.y + 2.5, face - 0.8, face), 'tinned', `Ring lug on ${id} (insulated, D 5.0 mm)`);
        pt.add(C(2.6, 2.6, 8, 'x', rx + xo + t.out * 4, ry + t.y, face - 0.4, 10), 'red', `Crimp sleeve on ${id}`);
        pt.add(C(1.6, 1.6, 30, 'z', rx + xo + t.out * 9, ry + t.y, face - 15, 10), 'cable', `Wire ${id} (2.5 mm²) · ${termById[id][2]}`);
        pt.add(C(2.2, 2.2, 6, 'z', rx + xo + t.out * 9, ry + t.y, face - 22, 10), 'white', `Wire marker ${id}`);
        continue;
      }
      pt.add(C(2.3, 2.3, 1.4, 'z', rx + t.x, ry + t.y, face - 0.7, 12), 'steel', lab);
      pt.add(B(rx + t.x - 1.5, rx + t.x + 1.5, ry + t.y - 0.3, ry + t.y + 0.3, face - 1.5, face - 1.3), 'black', lab);
      pt.add(B(rx + t.entry - 1.8, rx + t.entry + 1.8, ry + t.y - 1.6, ry + t.y + 1.6, face - 0.3, face), 'black', `${lab} (wire entry)`);
      if (used) {
        pt.add(C(1.1, 1.1, 8, 'z', rx + t.entry, ry + t.y, face - 4, 8), 'zinc', `Ferrule on ${id}`);
        pt.add(C(0.9, 0.9, 22, 'z', rx + t.entry, ry + t.y, face - 19, 8), id.startsWith('B') && +id.slice(1) <= 6 ? 'black' : 'blue', `Wire ${id} (1.5 mm²) · ${termById[id][2]}`);
        pt.add(C(1.5, 1.5, 5, 'z', rx + t.entry, ry + t.y, face - 12, 8), 'white', `Wire marker ${id}`);
      }
    }
  }
  // plug-in module positions E (Ethernet module, 2 ports CH1 / CH2) and F (cover), G, battery, J, protective earth
  pt.add(B(rx + 19, rx + 60, ry - 27, ry + 6, zr - 3, zr), 'galvDark', 'Plug-in module position E · example: Ethernet module ETH-BA-2EL (IEC 61850, 2 × RJ45)');
  for (const [y, ch] of [[-2, 'CH1'], [-21, 'CH2']]) {
    pt.add(B(rx + 28, rx + 46, ry + y - 7, ry + y + 7, zr - 15, zr - 3), 'black', `Module port ${ch} (RJ45)`);
    pt.add(B(rx + 31, rx + 43, ry + y - 4, ry + y + 4, zr - 15.2, zr - 15), 'steel', `Module port ${ch} (RJ45)`);
  }
  pt.add(B(rx + 19, rx + 60, ry - 60, ry - 30, zr - 2, zr), 'galvDark', 'Plug-in module position F (cover, free slot: serial, Ethernet or arc-protection module)');
  pt.add(B(rx + 9, rx + 17, ry - 17, ry + 8, zr - 10, zr), 'grey', 'Time synchronisation G (D-sub 9: IRIG-B / DCF77, PPS)');
  for (const y of [-14, 5]) pt.add(C(1.4, 1.4, 4, 'z', rx + 13, ry + y, zr - 12, 8), 'steel', 'D-sub locking screw');
  pt.add(B(rx + 7, rx + 19, ry - 86, ry - 62, zr - 6, zr), 'black', 'Battery compartment (CR2032, pull out to change)');
  pt.add(B(rx + 5, rx + 19, ry - 115, ry - 100, zr - 16, zr), 'black', 'Integrated Ethernet J (RJ45, 100Base-TX: DIGSI 5, IEC 61850)');
  pt.add(B(rx + 7, rx + 17, ry - 112, ry - 103, zr - 16.2, zr - 16), 'steel', 'Integrated Ethernet J (RJ45, 100Base-TX: DIGSI 5, IEC 61850)');
  for (const x of [-12, -6]) pt.add(C(2.8, 2.8, 8, 'z', rx + x, ry - 115, zr - 4, 6), 'zinc', 'Protective earth terminal (M4, ≥ 4 mm², ≥ 1.2 Nm)');
  pt.add(B(rx - 16, rx - 2, ry - 120, ry - 110, zr - 1, zr), 'tinned', 'Protective earth terminal (M4, ≥ 4 mm², ≥ 1.2 Nm)');
  pt.add(C(1.8, 1.8, 26, 'z', rx - 9, ry - 115, zr - 21, 8), 'earth', 'Earth wire 4 mm² to the shield / PE bar');
  if (textured) pt.add(decal(rx - 62, rx + 62, ry - 122, ry + 122, zr - 0.08, {flip: true, area: shift(REAR_AREA, rx, ry)}), 'sipRear', 'Rear plate markings');
  // block face numbers: decals on each face, cut from the same rear atlas
  if (textured) for (const [k, b] of Object.entries(BLOCKS)) pt.add(decal(rx + b.x0, rx + b.x1, ry + b.y0, ry + b.y1, zr - b.d - 0.1, {flip: true, area: shift(REAR_AREA, rx, ry)}), 'sipRear', BLK_LABEL[k]);
}
const shift = (a, dx, dy) => ({X0: a.X0 + dx, X1: a.X1 + dx, Y0: a.Y0 + dy, Y1: a.Y1 + dy});
