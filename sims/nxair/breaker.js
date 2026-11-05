// Stand-alone SION 3AE5 vacuum circuit-breaker, 12 kV · 1250 A · 31.5 kA, pole-centre distance 210 mm, terminal
// distance 275 mm (the version for the NXAIR 800 mm panel), on its NXAIR withdrawable truck.
//
// Sources: SION operating instructions 9229 0025 100 0C (02.2020): Fig. 11/12 (drive side / pole side 1250 A 31.5 kA),
// Fig. 15 (operating panel), Fig. 17/18 (opened mechanism, item numbers), Fig. 40 (rating plate 3AE5123-2, 12 kV,
// 1250 A, 31.5 kA, 80 kg), Fig. 66 (earth terminal on the top plate), Fig. 84–85 (hollow contact arm on a threaded
// bolt, contact system with arm adapter); catalog HG 11.02 · 2020 p. 59 (outline, 12 kV ≤ 31.5 kA, a = 210, b = 275:
// width c 565, height 540, lower terminal e 217.5 above the base, mechanism box q 169 deep, terminal face to front l 371,
// contact arm projection k 274, base g 329); HG 11.02 · 2018 p. 71 (withdrawable truck 679 × 620 × 107 mm, ≈ 20 kg).
//
// What is real: outline dimensions, terminal positions, the arrangement and item numbers of the components, part
// numbers, the open-to-the-rear pole shells with the shed insulators below the interrupters, the drive-side and
// installation-side separating shells, the hollow arms with contact systems. What is drawn: the internal kinematics
// (crank, cam, levers), the interrupter internals and the contact travel, which Siemens does not publish; positions
// inside the mechanism are read from the perspective drawings and are approximate.
//
// Rig: crank angle (0° discharged, 170° charged and latched just past dead centre, 360° after closing) and s = main
// shaft / contact position (0 open .. 1 closed). Closing spring: helical extension spring on the right of the
// mechanism plate; opening springs: torsion springs on the main-shaft ends.
//
// Axes (mm): x across (poles at -P, 0, +P), y up from the truck bottom (breaker base at YB), z towards the operator
// (mechanism rear plate at 0, front frame at 150, cover face at 169), poles and contact arms behind (z < 0).
import * as THREE from 'three';
import {B, C, L, PartBuilder, RB, T, TU, spread} from './geom.js';
import {DEVICE_INFO, DEVICE_PARTS, EQUIP_DEFAULT, buildDevices} from './bkdevices.js';

export const YB = 107; // breaker base on top of the 107 mm truck
// the breaker shown in the Breaker tab: SION 3AE5, 12 kV, 1250 A, 31.5 kA, pole centres 210 mm, terminals 275 mm apart
export const BK_SPEC = {P: 210, TD: 275, armD: 40, fingers: 13};

const BK_BASE = [
  {id: 'bkTruck', name: 'Withdrawable truck', grp: 'Truck', dir: [0, -260, 0], desc: 'NXAIR withdrawable truck under the breaker: 679 mm wide, 620 mm deep, 107 mm high, ≈ 20 kg (HG 11.02 · 2018 p. 71, pole centres 210 mm). Four wheels on the panel rails, racking spindle driven by the racking crank through the door, sliding earthing contact, two locking levers that latch it in the panel or on the service truck. Racking travel in NXAIR 200 mm.'},
  {id: 'bkFrame', name: 'Mechanism housing (20), base, earth terminal (70)', grp: 'Operating mechanism', dir: [0, 0, 0], desc: 'Sheet-steel drive housing 540 mm high and 169 mm deep with the cover, on the base frame that also carries the three poles. Inside: the vertical mechanism mounting plate that carries the charging shaft, gear unit and closing spring. Top plate with the lifting points (marked with a crane hook) and the earth terminal (70): hexagon screw M12, washer, ring lug of the earth conductor, contact washer SN 70093 with its teeth towards the housing, 105 Nm. Earth conductor for 30 A with ≤ 3 V drop (IEC 62271-200); not needed when the breaker sits on an earthed frame with external-tooth lock washers under the screw heads.'},
  {id: 'bkCover', name: 'Cover (20.1) + operating panel', grp: 'Operating mechanism', dir: [0, 0, 360], desc: 'Plastic cover 20.1 (or metal cover 20.2) with openings for the operating panel: push button OFF (56.2), push button ON (56.1), position indicator ON-OFF (56.3), spring state indicator (55.1), operating cycle counter (58, one cycle = one closing + one opening), hand-crank opening (57.1) to the coupling 57.2, optional key lock 59.3, rating plate (21). Plastic cover: pull both snap hooks at the same time, swing forward, lift off; fit from above into the guide and let both hooks snap in. Metal cover: 2 upper M6 loosened, 4 lower M6 with contact washers out; refit teeth towards the cover, 12 Nm. Operate the breaker in the panel only with the cover fitted.'},
  {id: 'bkClosingSpring', name: 'Closing spring (55), charging shaft, crank, closing cam', grp: 'Operating mechanism', dir: [280, 40, 170], desc: 'Helical extension spring hanging from a bracket at the top right of the mechanism plate. The charging shaft turns the crank, which stretches the spring through a link until the crank is just past dead centre and the closing latch holds it: spring indicator CHARGED, -S3 and -S4 open. ON (56.1 or -Y9) frees the latch, the spring pulls the crank round and the closing cam on the same shaft drives the roller lever of the main shaft. The motor recharges the spring at once, so OFF – ON – OFF is stored. Discharging: supply off, then OFF, ON, OFF by hand.'},
  {id: 'bkShaft', name: 'Main shaft, pole levers, roller lever', grp: 'Operating mechanism', dir: [0, -90, 220], desc: 'The switching shaft runs across the bottom of the drive and out through both side plates (optional shaft covers, Torx T20, 5 Nm, close off the ends). The cam turns it through the roller lever; one lever per pole reaches back under the pole and pushes its shed insulator (45) up: the contacts close, the contact-pressure springs are loaded, the opening springs on the shaft ends wound. Pole synchronism ≤ 2 ms. Do not touch the poles or the shaft: they move fast, also by remote control.'},
  {id: 'bkOpeningSpring', name: 'Opening springs, torsion, on the main shaft', grp: 'Operating mechanism', dir: [-300, -80, 120], desc: 'Helical torsion springs on the main-shaft ends, one leg fixed to the base, one on the shaft. The closing movement winds them; with the contact-pressure springs they open the breaker when the opening latch is released: opening ≤ 30 ms with -Y1, arcing < 15 ms, break time ≤ 45 ms. Spring forces are not published.'},
  {id: 'bkShell', name: 'Pole shells (46)', grp: 'Pole', dir: [0, 0, -330], desc: 'One epoxy pole shell per phase, open towards the panel (rear), with creepage ribs at its foot. It carries the pole head, the interrupter and the lower connection and takes the switching forces. Clean insulating parts with a damp cloth, warm water and a mild household cleaner only.'},
  {id: 'bkSep', name: 'Separating shells to the drive side (41, optional)', grp: 'Pole', dir: [0, 220, 0], desc: 'Insulating U-shells between each pole and the drive housing, standing above the housing top. Optional.'},
  {id: 'bkUpper', name: 'Pole heads with contact plate (42)', grp: 'Pole', dir: [0, 210, -200], desc: 'Upper connection: pole head with the pole contact plate facing the panel, 4 tapped holes M12 for flat busbars plus the centre thread for the contact-arm bolt. The fixed stem of the interrupter is bolted rigidly here. Screw-in depth 20 ±1 mm (12 kV, ≤ 31.5 kA, ≤ 1600 A, M12).'},
  {id: 'bkLower', name: 'Lower connections, pole contact plates (44)', grp: 'Pole', dir: [0, -30, -260], desc: 'Lower connection with its pole contact plate (44), the guide of the moving stem and the flexible conductor that feeds it. Screw-in depth 20 ±1 mm for M12 at ≤ 31.5 kA, ≤ 1600 A (28 ±1 mm for M16 2000–2500 A, 38 ±1 mm at 40 kA). Contact faces: sprayed-copper and sprayed-silver faces wiped with a cloth, never brushed; copper busbars wire-brushed crosswise until bright, a thin film of acid-free Vaseline, bolted at once.'},
  {id: 'bkVI', name: 'Vacuum interrupters (43)', grp: 'Vacuum interrupter', dir: [0, 0, -520], desc: 'Sealed vacuum interrupter per pole, type-approved as an interference emitter under the German Radiation Protection Act (§ 45 StrlSchG). The arc burns in metal vapour and goes out at current zero; arcing < 15 ms. A small change of the contact stroke over its life does not affect function. Frequent switching of overload or short-circuit currents can end its life early. Maintenance-free up to 10 000 cycles (30 000 with Siemens maintenance); replaced as a pole by Siemens.'},
  {id: 'bkVIin', name: 'Interrupter internals (generic)', grp: 'Vacuum interrupter', dir: [0, 0, -720], desc: 'Generic construction, not a Siemens drawing: ceramic insulating body (2 rings), end flanges, centre vapour shield, fixed contact stem and slotted CuCr contact disc at the top, moving contact disc and stem below, stainless bellows that keep the vacuum while the stem moves. Gap and stroke drawn larger than life (Siemens publishes no stroke).'},
  {id: 'bkRods', name: 'Insulators (45) with contact-pressure springs', grp: 'Pole', dir: [0, -170, -60], desc: 'Shed insulators below each interrupter "transmit the switching movement to the poles": the main-shaft lever pushes the insulator up, its top coupling drives the moving stem through a contact-pressure spring that keeps the closed contacts pressed and takes up contact erosion (over-travel).'},
  {id: 'bkArms', name: 'Contact arms (22) on threaded bolts (22.1)', grp: 'Primary contacts', dir: [0, 0, -400], desc: 'Hollow silver-plated copper arms Ø 40 mm (≤ 1250 A), 274 mm from the pole contact plate to the end of the contact system. The threaded bolt is greased with Vaseline in the screw-in section, screwed 20 ±1 mm into the terminal and tightened 40 ±4 Nm (M12, greased); the arm slides over it. Copper end faces roughened, cleaned and greased with Vaseline; silver-plated faces cleaned and greased.'},
  {id: 'bkTulips', name: 'Contact systems (23, 23.1) with arm adapter (22.2)', grp: 'Primary contacts', dir: [0, 0, -600], desc: 'Contact system: a cage of spring-loaded contact fingers held by ring springs. For Ø 40 mm arms the contact arm adapter (22.2) is set in from the back of the contact system: fingers greased with Molykote Longterm 2, adapter adjusted with screw, washers and nut, tightened with an open-ended spanner, then screw, washers and nut removed. The contact system goes onto bolt and arm with the round outer edge towards the arm, 40 ±4 Nm (M12, greased); the other side of the fingers is greased last.'},
  {id: 'bkSleeves', name: 'Separating shells to the panel side (47, optional)', grp: 'Primary contacts', dir: [0, 0, -260], desc: 'Insulating sleeves slid over the main conductors and snapped into the pole shell, to insulate the poles from each other where the connection space is tight; conductors up to Ø 60 mm. Up to 17.5 kV: slide onto the bolts, set against the pole shell and let them engage; check that the snap hooks are fully behind the insulating ribs.'},
];
// mechanism, then the secondary devices (basic, option), then the poles and contacts
const ORDER = ['Truck', 'Operating mechanism', 'Secondary equipment (basic)', 'Secondary equipment (option)', 'Pole', 'Vacuum interrupter', 'Primary contacts'];
export const BK_PARTS = [...BK_BASE, ...DEVICE_PARTS.map((d) => ({...d, desc: DEVICE_INFO[d.id]?.summary || ''}))].sort((a, b) => ORDER.indexOf(a.grp) - ORDER.indexOf(b.grp));

const HAS_DOM = typeof document !== 'undefined';
function canvasTex(Wmm, Hmm, ppm, draw) {
  const c = document.createElement('canvas');
  c.width = Math.round(Wmm * ppm);
  c.height = Math.round(Hmm * ppm);
  const g = c.getContext('2d');
  g.scale(ppm, ppm);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const FONT = '"IBM Plex Sans Condensed", "Arial Narrow", Arial, sans-serif';
const txt = (g, s, x, y, size, color = '#1f2427', weight = 600, align = 'center') => { g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y); };
const plane = (x0, x1, y0, y1, z) => { const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, z); return g; };
const COVER = {x0: -140, x1: 140, y0: 40, y1: 500};
// a plane over part of the cover that shows the same part of the cover art (uv from the vertex positions)
const coverDecal = (x0, x1, y0, y1, z) => {
  const g = plane(x0, x1, y0, y1, z);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - COVER.x0) / (COVER.x1 - COVER.x0), (pos.getY(i) - COVER.y0) / (COVER.y1 - COVER.y0));
  return g;
};

function coverArt(g) {
  // canvas x = X + 140, y = 500 - Y (cover face, mm)
  const at = (X, Y) => [X + 140, 500 - Y];
  let [x, y] = at(-62, 452);
  txt(g, 'SION', x, y, 15, '#2d3a44', 700);
  // rating plate (values of the example plate in the operating instructions, Fig. 40)
  [x, y] = at(20, 478);
  g.fillStyle = '#f4f4f0'; g.fillRect(x, y, 100, 73);
  const rows = ['Type 3AE5123-2', 'Ur 12 kV   fr 50/60 Hz', 'Ir 1250 A   Isc 31.5 kA', 'tk 3 s   m 80 kg', 'Ud 42 kV   Up 95 kV', 'O - 0.3 s - CO - 15 s - CO', 'IEC 62271-100: E2, C2, M2'];
  rows.forEach((r, i) => txt(g, r, x + 3, y + 5 + i * 9.6, 5.6, '#1f2427', i === 0 ? 700 : 500, 'left'));
  // hand-crank opening with its direction arrow
  [x, y] = at(0, 360);
  g.strokeStyle = '#1f2427'; g.lineWidth = 1.6;
  g.beginPath(); g.arc(x, y, 24, -Math.PI * 0.95, -Math.PI * 0.2); g.stroke();
  g.beginPath(); g.moveTo(x + 24 * Math.cos(-Math.PI * 0.2) - 5, y + 24 * Math.sin(-Math.PI * 0.2) - 3); g.lineTo(x + 24 * Math.cos(-Math.PI * 0.2), y + 24 * Math.sin(-Math.PI * 0.2)); g.lineTo(x + 24 * Math.cos(-Math.PI * 0.2) - 1, y + 24 * Math.sin(-Math.PI * 0.2) + 6); g.stroke();
  txt(g, 'hand crank', x, y + 32, 6.5, '#3a454d', 500);
  // window frame of the control board and the element captions
  [x, y] = at(-110, 250);
  g.strokeStyle = '#2b3035'; g.lineWidth = 1.2; g.strokeRect(x, y, 220, 120);
  for (const [s, X, Y] of [['OFF', -75, 239], ['ON', -35, 239], ['count', -75, 141], ['position', -35, 136], ['spring', 60, 165]]) { [x, y] = at(X, Y); txt(g, s, x, y, 5.6, '#2b3035', 600); }
}
function buttonArt(sym) {
  return (g) => {
    g.fillStyle = 'rgba(0,0,0,0)';
    g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = 3;
    if (sym === 'O') { g.beginPath(); g.arc(16, 16, 8, 0, Math.PI * 2); g.stroke(); } else g.fillRect(14.5, 7, 3, 18);
  };
}
function flagArt(kind) {
  return (g) => {
    g.fillStyle = kind === 'I' ? '#d8d8d2' : kind === 'O' ? '#d8d8d2' : kind === 'charged' ? '#f1c232' : '#eeeeea';
    g.fillRect(0, 0, 30, 30);
    g.strokeStyle = '#111'; g.fillStyle = '#111'; g.lineWidth = 2.2;
    if (kind === 'I') g.fillRect(13.5, 5, 3, 20);
    else if (kind === 'O') { g.beginPath(); g.arc(15, 15, 8, 0, Math.PI * 2); g.stroke(); }
    else {
      // spring symbol: compressed zig-zag when charged, open zig-zag when discharged
      const n = kind === 'charged' ? 7 : 4, x0 = 4, x1 = 26;
      g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0, 15);
      for (let i = 0; i <= n; i++) g.lineTo(x0 + ((x1 - x0) * i) / n, i % 2 ? 9 : 21);
      g.lineTo(x1, 15); g.stroke();
    }
  };
}
function counterArt(g) {
  g.fillStyle = '#111'; g.fillRect(0, 0, 40, 20);
  for (let i = 0; i < 5; i++) { g.fillStyle = '#f4f4f0'; g.fillRect(2 + i * 7.4, 3, 6.4, 14); txt(g, '00042'[i], 5.2 + i * 7.4, 10.4, 10, '#111', 600); }
}

export function buildBreaker(mats, {P = 210, TD = 275, armD = 40, fingers = 13} = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // the breaker on its truck
  body.position.y = YB;
  root.add(body);
  const parts = {};
  const rig = {};
  const half = P + 72; // overall half-width (HG c = 2a + 145: 565 at a = 210)
  const hh = half - 12; // drive housing half-width
  const H = 540; // housing / pole height above the base
  const ZF = 150, ZC = 169; // front frame of the housing, cover face (HG q = 169)
  const ZT = ZC - 371; // terminal contact face (HG l = 371)
  const zPole = ZT + 88; // pole axis
  const yLo = 217.5, yUp = yLo + TD; // terminal centres above the base (HG e = 217.5)
  const yVI0 = yLo + 40.5, yVI1 = yUp - 46.5; // interrupter flanges
  const yGap = (yVI0 + yVI1) / 2;
  const xs = [-P, 0, P];
  const STROKE = 14, OVER = 6; // drawn contact travel and over-travel (larger than life)
  const yMS = 66, zMS = 60, LEVER = zMS - zPole; // main shaft, pole-lever length
  const yCS = 290, zCS = 70; // charging shaft
  const xCrank = 150, xCam = 60, xDisc = 116, CR = 40; // spring axis, cam, crank web (beside the spring, not under it) // closing crank, closing cam, crank radius
  const ySpringTop = 495;
  const ROD_TOP = yLo - 41.5; // top of the insulator coupling, contacts closed

  // textured materials for the operating panel (browser only)
  const MX = {...mats};
  if (HAS_DOM) {
    const planes = mats.galv.clippingPlanes;
    const mk = (map, o = {}) => new THREE.MeshStandardMaterial({map, roughness: 0.6, metalness: 0.02, clippingPlanes: planes, ...o});
    MX.bkCoverArt = mk(canvasTex(280, 460, 4, coverArt), {alphaTest: 0.3});
    MX.bkBtnO = mk(canvasTex(32, 32, 8, buttonArt('O')), {alphaTest: 0.3});
    MX.bkBtnI = mk(canvasTex(32, 32, 8, buttonArt('I')), {alphaTest: 0.3});
    for (const k of ['I', 'O', 'charged', 'discharged']) MX['bkFlag' + k] = mk(canvasTex(30, 30, 8, flagArt(k)));
    MX.bkCounter = mk(canvasTex(40, 20, 8, counterArt));
  }
  const tex = !!MX.bkCoverArt;

  const part = (id, parent = body) => {
    const g = new THREE.Group();
    g.userData.part = id;
    const meta = BK_PARTS.find((p) => p.id === id);
    g.userData.dir = new THREE.Vector3(...(meta?.dir || [0, 0, 0]));
    parent.add(g);
    parts[id] = g;
    return new PartBuilder(g, MX);
  };
  const sub = (pid, label, build) => {
    // a moving sub-object with its own pivot, inside part pid
    const g = new THREE.Group();
    const pb = new PartBuilder(g, MX);
    build(pb);
    pb.finish();
    g.userData.label = label;
    parts[pid].add(g);
    return g;
  };
  const helix = (len, r, turns, wire) => {
    const pts = [];
    const n = turns * 16;
    for (let i = 0; i <= n; i++) { const a = (i / n) * turns * Math.PI * 2; pts.push([Math.cos(a) * r, (i / n) * len, Math.sin(a) * r]); }
    return TU(pts, wire, n * 2, 6);
  };
  const Y = new THREE.Vector3(0, 1, 0);

  // ------------------------------------------------------------ truck (root coordinates, y 0 .. YB)
  {
    const p = part('bkTruck', root);
    const w = 679 / 2, z0 = -330, z1 = 290;
    for (const s of [-1, 1]) {
      p.add(B(s * w - (s > 0 ? 22 : 0), s * w + (s < 0 ? 22 : 0), 20, YB, z0, z1), 'galvDark', 'Side member');
      for (const z of [z0 + 50, z1 - 50]) {
        p.add(C(30, 30, 20, 'x', s * (w + 12), 30, z, 24), 'black', 'Wheel');
        p.add(C(8, 8, 26, 'x', s * (w + 1), 30, z, 12), 'steel', 'Wheel axle');
      }
      p.add(RB(s * 250 - 30, s * 250 + 30, 70, 100, z1 + 6, z1 + 40, 4), 'red', 'Locking lever (latches the truck in the panel / on the service truck)');
    }
    for (const z of [-150, 60]) p.add(B(-w + 22, w - 22, YB - 27, YB, z - 18, z + 18), 'galvDark', 'Cross member (breaker fixing, 4 × M10 8.8, 48 ±4 Nm greased)');
    p.add(B(-w + 22, w - 22, 20, 60, z1 - 30, z1), 'galvDark', 'Front cross member');
    p.add(B(-w + 22, w - 22, 20, 60, z0, z0 + 30), 'galvDark', 'Rear cross member');
    p.add(B(-300, 300, 20, YB, z1, z1 + 6), 'galv', 'Front plate');
    p.add(C(11, 11, z1 - z0 - 40, 'z', 0, 45, (z0 + z1) / 2, 16), 'steel', 'Racking spindle');
    p.add(C(13, 13, 14, 'z', 0, 45, z1 + 13, 6), 'steel', 'Racking crank coupling');
    p.add(RB(-45, 45, 24, 66, -200, -140, 4), 'black', 'Spindle nut (held by the panel)');
    p.add(B(-30, 30, 2, 20, -280, -120), 'copper', 'Sliding earthing contact');
    p.finish();
  }

  // ------------------------------------------------------------ housing, base, mechanism plate, earth terminal
  {
    const p = part('bkFrame');
    p.add(B(-half, half, 0, 8, ZT - 8, 120), 'galvDark', 'Base frame (HG g = 329 mm)');
    p.add(B(-hh, -hh + 3, 8, H, 0, ZF), 'housing', 'Side plate');
    p.add(B(hh - 3, hh, 8, H, 0, ZF), 'housing', 'Side plate');
    p.add(B(-hh + 3, hh - 3, 8, H - 3, 0, 3), 'housing', 'Rear plate (slots for the pole levers at the bottom)');
    p.add(B(-hh + 3, hh - 3, 8, 12, 3, ZF), 'housing', 'Housing floor');
    p.add(B(-hh, hh, H - 3, H, 0, ZF), 'housing', 'Top plate');
    p.add(B(-hh, -140, 8, H, ZF - 3, ZF), 'housing', 'Front frame');
    p.add(B(140, hh, 8, H, ZF - 3, ZF), 'housing', 'Front frame');
    p.add(B(-140, 140, 8, 40, ZF - 3, ZF), 'housing', 'Front frame');
    p.add(B(-140, 140, 500, H, ZF - 3, ZF), 'housing', 'Front frame');
    p.add(B(85, 91, 12, 520, 3, 140), 'galv', 'Mechanism mounting plate (9)');
    p.add(B(91, 180, 512, 520, 40, 100), 'galv', 'Spring anchor bracket');
    for (const x of [-205, 205]) p.add(B(x - 22, x + 22, H, H + 0.4, 45, 105), 'black', 'Lifting point (crane hook mark) – crane only at the marked points');
    // earth terminal (70): screw M12, washer, ring lug, contact washer with its teeth to the housing, 105 Nm
    p.add(C(11, 11, 1.5, 'y', 150, H + 0.75, 75, 20), 'zinc', 'Contact washer SN 70093 (teeth to the housing)');
    p.add(C(12, 12, 2.5, 'y', 150, H + 2.75, 75, 20), 'tinned', 'Ring lug of the earth conductor');
    p.add(B(150, 200, H + 1.5, H + 4, 69, 81), 'tinned', 'Ring lug of the earth conductor');
    p.add(C(12, 12, 2.5, 'y', 150, H + 5.25, 75, 20), 'zinc', 'Washer');
    p.add(C(9.8, 9.8, 7.5, 'y', 150, H + 10.25, 75, 6), 'zinc', 'Earth terminal (70): hexagon screw M12, 105 Nm');
    p.add(TU([[200, H + 2.75, 75], [240, H + 6, 75], [268, H + 6, 75], [279, H - 4, 75]], 5, 16, 8), 'earth', 'Earth conductor (30 A at ≤ 3 V drop)');
    p.add(C(5, 5, 90, 'y', 279, H - 49, 75, 8), 'earth', 'Earth conductor (30 A at ≤ 3 V drop)');
    for (const [x, z] of [[-half + 25, ZT + 20], [half - 25, ZT + 20], [-half + 25, 100], [half - 25, 100]]) p.add(C(6, 6, 0.6, 'y', x, 8.3, z, 14), 'black', 'Fixing hole M10 (fixed mounting: 4 × M10 8.8, 48 ±4 Nm greased)');
    p.finish();
  }

  // ------------------------------------------------------------ cover and operating panel
  {
    const p = part('bkCover');
    p.add(RB(COVER.x0, COVER.x1, COVER.y0, COVER.y1, ZF, ZC, 8, 2), 'housing', 'Cover (20.1), plastic, snap hooks');
    if (tex) p.add(plane(COVER.x0, COVER.x1, COVER.y0, COVER.y1, ZC + 0.1), 'bkCoverArt', 'Cover (20.1), plastic, snap hooks');
    p.add(B(-110, 110, 130, 250, ZC, ZC + 1), 'grey', 'Control board');
    p.add(B(20, 120, 405, 478, ZC, ZC + 0.5), 'white', 'Rating plate (21): 3AE5123-2, 12 kV, 1250 A, 31.5 kA, tk 3 s, Ud 42 kV, Up 95 kV, 80 kg');
    if (tex) p.add(coverDecal(20, 120, 405, 478, ZC + 0.6), 'bkCoverArt', 'Rating plate (21): 3AE5123-2, 12 kV, 1250 A, 31.5 kA, tk 3 s, Ud 42 kV, Up 95 kV, 80 kg');
    if (tex) p.add(coverDecal(-110, 110, 130, 250, ZC + 1.05), 'bkCoverArt', 'Control board');
    p.add(C(15, 15, 0.8, 'z', 0, 360, ZC + 0.4, 24), 'black', 'Hand-crank opening (57.1)');
    p.add(B(-95, -55, 150, 170, ZC + 1, ZC + 1.5), 'black', 'Operating cycle counter (58)');
    if (tex) p.add(plane(-95, -55, 150, 170, ZC + 1.6), 'bkCounter', 'Operating cycle counter (58)');
    p.add(B(-52, -18, 143, 177, ZC + 1, ZC + 1.5), 'black', 'Position indicator ON-OFF (56.3)');
    p.add(B(43, 77, 168, 202, ZC + 1, ZC + 1.5), 'black', 'Spring state indicator (55.1)');
    p.finish();
    // push buttons (move in when pressed) and indicator flags (change with the state)
    const btn = (x, mat, sym, lab) => sub('bkCover', lab, (b) => {
      b.add(RB(x - 16, x + 16, 199, 231, ZC + 1, ZC + 9, 3, 1), mat, lab);
      b.add(C(5, 5, ZC + 1 - 138, 'z', x, 215, (ZC + 1 + 138) / 2, 12), 'steel', `${lab}: plunger`);
      if (tex) b.add(plane(x - 16, x + 16, 199, 231, ZC + 9.1), sym, lab);
    });
    rig.btnOff = btn(-75, 'red', 'bkBtnO', 'Push button OFF (56.2)');
    rig.btnOn = btn(-35, 'green', 'bkBtnI', 'Push button ON (56.1)');
    const flag = (x0, x1, y0, y1, m, fallback, lab) => sub('bkCover', lab, (b) => b.add(tex ? plane(x0, x1, y0, y1, ZC + 1.6) : B(x0, x1, y0, y1, ZC + 1.5, ZC + 1.7), tex ? m : fallback, lab));
    rig.flagI = flag(-50, -20, 145, 175, 'bkFlagI', 'white', 'Position indicator: I = closed');
    rig.flagO = flag(-50, -20, 145, 175, 'bkFlagO', 'green', 'Position indicator: O = open');
    rig.flagCh = flag(45, 75, 170, 200, 'bkFlagcharged', 'yellow', 'Spring state: charged');
    rig.flagDis = flag(45, 75, 170, 200, 'bkFlagdischarged', 'white', 'Spring state: discharged');
  }

  // ------------------------------------------------------------ charging shaft, crank, cam, closing spring
  {
    const p = part('bkClosingSpring');
    p.add(T(9, 3, 'x', xCrank, ySpringTop + 5, zCS), 'steel', 'Spring hook (top)');
    p.add(B(xCrank - 4, xCrank + 4, ySpringTop + 14, 512, zCS - 4, zCS + 4), 'steel', 'Spring hanger');
    p.add(B(125, 141, 226, 243, 64, 92), 'black', 'Closing latch (holds the crank pin past dead centre, released by ON / -Y9)');
    p.finish();
    rig.crank = sub('bkClosingSpring', 'Charging shaft set: worm wheel, crank, closing cam', (b) => {
      b.add(C(14, 14, xDisc + 6 + 40, 'x', (xDisc + 6 - 40) / 2, 0, 0), 'steel', 'Charging shaft (ends at the crank web, clear of the spring)');
      b.add(C(38, 38, 16, 'x', 0, 0, 0, 36), 'steel', 'Charging gear wheel (inside the gear unit)');
      b.add(C(46, 46, 12, 'x', xDisc, 0, 0, 28), 'steel', 'Closing crank disc');
      b.add(C(7, 7, xCrank + 6 - xDisc, 'x', (xDisc + xCrank + 6) / 2, CR, 0, 12), 'zinc', 'Crank pin');
      b.add(C(40, 40, 14, 'x', xCam, -12, 0, 28), 'steel', 'Closing cam (eccentric)');
    });
    rig.crank.position.set(0, yCS, zCS);
    // the spring mesh is rebuilt at its real length in pose(); no edge lines on it
    const spring = new THREE.Mesh(helix(150, 22, 14, 4.5), MX.spring);
    spring.userData = {label: 'Closing spring (55), helical extension spring', noEdges: true};
    rig.closeSpring = spring;
    parts.bkClosingSpring.add(spring);
    rig.springEye = sub('bkClosingSpring', 'Spring eye', (b) => b.add(T(10, 3, 'x', 0, -6, 0), 'steel', 'Spring eye (bottom)'));
    rig.link = sub('bkClosingSpring', 'Link rod spring → crank pin', (b) => b.add(C(5, 5, 1, 'y', 0, 0.5, 0, 10), 'steel', 'Link rod'));
  }

  // ------------------------------------------------------------ main shaft and levers
  {
    const p = part('bkShaft');
    p.add(B(xCam - 34, xCam - 18, yMS + 30, yMS + 62, zMS - 8, zMS + 8), 'black', 'Opening latch (released by OFF / -Y1)');
    p.add(B(-155, -25, 180, 186, 105, 125), 'steel', 'Trip bar: the strikers of -Y2 … -Y7 hit it, it frees the opening latch');
    p.add(B(-28, -22, 110, 180, 100, 112), 'steel', 'Trip bar link to the opening latch');
    p.add(B(-22, xCam - 34, 110, 116, 100, 112), 'steel', 'Trip bar link to the opening latch');
    p.add(B(xCam - 40, xCam - 34, 110, 116, 68, 100), 'steel', 'Trip bar link to the opening latch');
    p.finish();
    rig.shaft = sub('bkShaft', 'Main shaft with pole levers', (b) => {
      b.add(C(18, 18, 2 * hh + 30, 'x', 0, 0, 0), 'steel', 'Main shaft');
      for (const x of xs) {
        b.add(B(x - 8, x + 8, -6, 6, -LEVER + 30, 0), 'steel', 'Pole lever');
        for (const s of [-1, 1]) b.add(B(x + s * 9 - 2.5, x + s * 9 + 2.5, -10, 10, -LEVER - 8, -LEVER + 30), 'steel', 'Pole lever fork');
        b.add(C(4, 4, 24, 'x', x, 0, -LEVER, 10), 'zinc', 'Lever pin');
      }
      b.add(B(xCam - 7, xCam + 7, 0, 148, -7, 7), 'steel', 'Roller lever');
      b.add(C(12, 12, 16, 'x', xCam, 160, 0, 16), 'zinc', 'Cam roller');
      b.add(B(-186, -178, 0, 26, 8, 22), 'steel', 'Auxiliary switch drive crank');
      for (const s of [-1, 1]) {
        b.add(B(s * (hh + 8) - 3, s * (hh + 8) + 3, -10, 40, -8, 8), 'steel', 'Shaft end lever (covered by the optional shaft cover)');
        b.add(B(s * (hh - 30) - 3, s * (hh - 30) + 3, 30, 52, -3, 3), 'spring', 'Opening spring leg (moving)');
      }
    });
    rig.shaft.position.set(0, yMS, zMS);
  }

  // ------------------------------------------------------------ opening springs
  {
    const p = part('bkOpeningSpring');
    for (const sx of [-1, 1]) {
      const x0 = sx > 0 ? hh - 50 : -(hh - 10);
      p.add(helix(40, 30, 6, 4).rotateZ(-Math.PI / 2).translate(x0, yMS, zMS), 'spring', 'Opening spring, torsion');
      p.add(B(sx * (hh - 15) - 3, sx * (hh - 15) + 3, 13, yMS - 34, zMS - 3, zMS + 3), 'spring', 'Opening spring leg (fixed)');
    }
    p.finish();
  }

  // ------------------------------------------------------------ secondary equipment (bkdevices.js), one part per device
  rig.setEquip = buildDevices({part, sub, rig, parts, MX, H, zCS});
  rig.setEquip(EQUIP_DEFAULT);

  // ------------------------------------------------------------ poles
  const shell = part('bkShell');
  const sep = part('bkSep');
  const upper = part('bkUpper');
  const lower = part('bkLower');
  const vi = part('bkVI');
  const viIn = part('bkVIin');
  const rods = part('bkRods');
  const arms = part('bkArms');
  const tulips = part('bkTulips');
  const sleeves = part('bkSleeves');
  rig.moving = [];
  rig.rodParts = [];
  rig.bellows = [];
  const zS0 = zPole - 75, zS1 = zPole + 76; // shell rear edges, front face
  const gap = P - 144; // room between neighbouring shells for the foot ribs
  const pad = (pb, x, y, label) => {
    for (const [dx, dy] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) pb.add(C(6.5, 6.5, 0.6, 'z', x + dx, y + dy, ZT - 0.3, 14), 'black', `${label}: tapped hole M12 for flat busbars (40 ±4 Nm greased)`);
  };
  for (const x of xs) {
    // pole shell (46): side walls full height, front wall above the lever opening, open to the rear
    shell.add(B(x - 72, x - 66, 8, H, zS0, zS1), 'epoxy', 'Pole shell (46)');
    shell.add(B(x + 66, x + 72, 8, H, zS0, zS1), 'epoxy', 'Pole shell (46)');
    shell.add(B(x - 66, x + 66, 100, H, zS1 - 6, zS1), 'epoxy', 'Pole shell (46)');
    if (gap > 20) for (const y of spread(22, 118, 5)) for (const s of [-1, 1]) shell.add(B(Math.min(x + s * 72, x + s * 82), Math.max(x + s * 72, x + s * 82), y, y + 6, zS0 + 18, zS1 - 18), 'epoxy', 'Creepage ribs at the foot of the pole shell');
    // separating shell to the drive side (41)
    sep.add(B(x - 70, x + 70, 300, 600, -9, -4), 'plastic', 'Separating shell to the drive side (41)');
    for (const s of [-1, 1]) sep.add(B(Math.min(x + s * 70, x + s * 65), Math.max(x + s * 70, x + s * 65), 300, 600, zS1 + 2, -9), 'plastic', 'Separating shell to the drive side (41)');
    // pole head (42) with the upper pole contact plate
    upper.add(RB(x - 52, x + 52, yVI1 + 9, H - 5, ZT, zPole + 40, 6, 2), 'tinned', 'Pole head with pole contact plate (42)');
    upper.add(C(16, 16, 9, 'y', x, yVI1 + 4.5, zPole, 20), 'copper', 'Fixed stem clamp');
    pad(upper, x, yUp, 'Upper terminal');
    // lower connection with its pole contact plate (44), flexible conductor, stem guide
    lower.add(RB(x - 52, x + 52, ROD_TOP + 4, yVI0 - 3, ZT, zPole + 40, 6, 2), 'tinned', 'Lower connection with pole contact plate (44)');
    pad(lower, x, yLo, 'Lower terminal');
    lower.add(B(x + 52, x + 56, ROD_TOP + 10, yVI0 - 8, zPole - 30, zPole + 30), 'copper', 'Flexible conductor (laminated copper) to the moving stem');
    lower.add(C(14, 14, 4, 'y', x, ROD_TOP + 2, zPole, 20), 'steel', 'Guide bushing of the moving stem');
    // vacuum interrupter (43)
    vi.add(L([[48, 0], [52, 6], [52, 12], [46, 12]], 'y', x, yVI1 - 12, zPole), 'steel', 'Upper end flange');
    vi.add(L([[46, 0], [52, 0], [52, 6], [48, 12]], 'y', x, yVI0, zPole), 'steel', 'Lower end flange');
    const ceramic = yGap - 2 - (yVI0 + 6);
    vi.add(L([[49, 0], [50, 4], [50, ceramic - 4], [49, ceramic]], 'y', x, yVI0 + 6, zPole), 'white', 'Ceramic insulating body (lower ring)');
    vi.add(L([[49, 0], [50, 4], [50, ceramic - 4], [49, ceramic]], 'y', x, yGap + 2, zPole), 'white', 'Ceramic insulating body (upper ring)');
    vi.add(T(50.5, 2, 'y', x, yGap, zPole), 'steel', 'Centre flange (shield support)');
    // internals
    viIn.add(L([[40, 0], [42, 6], [42, 60], [38, 70], [38, 72], [40, 72]], 'y', x, yGap - 36, zPole), 'copper', 'Vapour (arc) shield');
    viIn.add(C(30, 30, 8, 'y', x, yGap + 5, zPole, 28), 'copper', 'Fixed contact disc (CuCr, slotted)');
    viIn.add(B(x - 1.5, x + 1.5, yGap + 1, yGap + 10, zPole - 31, zPole + 31), 'black', 'Contact slot');
    viIn.add(B(x - 31, x + 31, yGap + 1, yGap + 10, zPole - 1.5, zPole + 1.5), 'black', 'Contact slot');
    viIn.add(C(12, 12, yVI1 - (yGap + 9), 'y', x, (yVI1 + yGap + 9) / 2, zPole), 'copper', 'Fixed contact stem');
    const mv = new THREE.Group();
    mv.userData.part = 'bkVIin';
    const mb = new PartBuilder(mv, MX);
    const stemLen = yGap - 8 - ROD_TOP;
    mb.add(C(30, 30, 8, 'y', 0, -4, 0, 28), 'copper', 'Moving contact disc (CuCr, slotted)');
    mb.add(C(12, 12, stemLen, 'y', 0, -8 - stemLen / 2, 0), 'copper', 'Moving contact stem');
    mb.finish();
    mv.position.set(x, yGap, zPole);
    parts.bkVIin.add(mv);
    rig.moving.push(mv);
    const prof = [];
    for (let i = 0; i <= 16; i++) prof.push([i % 2 ? 26 : 19, i * 3]);
    const bel = new THREE.Group();
    bel.userData.part = 'bkVIin';
    const bb = new PartBuilder(bel, MX);
    bb.add(L(prof, 'y', 0, 0, 0, 20), 'silver', 'Metal bellows (keeps the vacuum while the stem moves)');
    bb.finish();
    bel.position.set(x, yVI0 + 12, zPole);
    parts.bkVIin.add(bel);
    rig.bellows.push(bel);
    // shed insulator (45): moves with the lever; contact-pressure spring under its top coupling
    const rod = new THREE.Group();
    rod.userData.part = 'bkRods';
    const rb = new PartBuilder(rod, MX);
    const yE = yMS + 9; // lever pin height with the contacts closed
    rb.add(B(-6, 6, yE - 8, yE + 14, -8, 8), 'steel', 'Insulator foot eye (lever pin)');
    rb.add(C(22, 22, 150 - (yE + 14), 'y', 0, (150 + yE + 14) / 2, 0, 24), 'epoxy', 'Insulator (45)');
    for (const y of [100, 120, 140]) rb.add(L([[22, 0], [42, 3], [40, 6], [22, 9]], 'y', 0, y - 4.5, 0, 28), 'epoxy', 'Insulator shed');
    rb.add(C(25, 25, 8, 'y', 0, 154, 0, 24), 'steel', 'Top coupling');
    rb.add(helix(14, 13, 4, 2.4).translate(0, 158, 0), 'spring', 'Contact-pressure spring');
    rb.add(C(7, 7, ROD_TOP - 158, 'y', 0, (ROD_TOP + 158) / 2, 0, 12), 'steel', 'Coupling bolt to the moving stem');
    rb.finish();
    rod.position.set(x, 0, zPole);
    parts.bkRods.add(rod);
    rig.rodParts.push(rod);
    // contact arms (22) on threaded bolts (22.1), contact systems (23) with arm adapter (22.2), sleeves (47)
    const ar = armD / 2;
    for (const [y, lab] of [[yUp, 'Upper'], [yLo, 'Lower']]) {
      arms.add(C(6, 6, 265, 'z', x, y, ZT + 20 - 265 / 2, 12), 'zinc', 'Threaded bolt (22.1), M12, 20 ±1 mm deep, 40 ±4 Nm greased');
      arms.add(L([[ar - 7, 0], [ar, 0], [ar, 235], [ar - 7, 235]], 'z', x, y, ZT - 235, 28), 'silver', `${lab} contact arm (22), hollow, Ø ${armD}`);
      tulips.add(L([[34, 0], [38, 0], [38, 80], [34, 80]], 'z', x, y, ZT - 274, 32), 'tinned', 'Contact system cage (23)');
      tulips.add(L([[ar + 0.5, 0], [34, 0], [34, 10], [ar + 0.5, 10]], 'z', x, y, ZT - 204, 28), 'steel', 'Contact arm adapter (22.2)');
      for (let f = 0; f < fingers; f++) {
        const a = (f / fingers) * Math.PI * 2, rr = ar + 3.5;
        tulips.add(RB(x + Math.cos(a) * rr - 3.4, x + Math.cos(a) * rr + 3.4, y + Math.sin(a) * rr - 3.4, y + Math.sin(a) * rr + 3.4, ZT - 272, ZT - 214, 1.4, 1), 'silver', 'Contact finger (23.1)');
      }
      for (const z of [ZT - 262, ZT - 226]) tulips.add(T(ar + 9.5, 2.2, 'z', x, y, z), 'spring', 'Ring spring');
      tulips.add(C(10, 10, 10, 'z', x, y, ZT - 245, 6), 'zinc', 'Nut on the threaded bolt');
      sleeves.add(L([[30, 0], [36, 0], [36, 182], [30, 182]], 'z', x, y, ZT - 185, 32), 'plastic', `Separating shell to the panel side (47), ${lab.toLowerCase()} conductor`);
    }
  }
  for (const pb of [shell, sep, upper, lower, vi, viIn, rods, arms, tulips, sleeves]) pb.finish();

  // ------------------------------------------------------------ the rig
  const E = new THREE.Vector3(), Pp = new THREE.Vector3(), d = new THREE.Vector3();
  let springLen = -1;
  const pose = ({c = 0, s = 0, crank = null, motor = 0, pClose = 0, pOpen = 0}) => {
    // charging crank: 0° discharged (pin up), 170° charged and latched, 360° after the closing stroke
    const th = ((crank ?? (c > 0.99 ? 170 : c * 170)) * Math.PI) / 180;
    rig.crank.rotation.x = th;
    const pinY = yCS + CR * Math.cos(th), pinZ = zCS + CR * Math.sin(th);
    const yBot = pinY + 14;
    const len = ySpringTop - yBot;
    if (Math.abs(len - springLen) > 0.5) {
      springLen = len;
      rig.closeSpring.geometry.dispose();
      rig.closeSpring.geometry = helix(len, 22, 14, 4.5);
      rig.closeSpring.geometry.computeBoundingBox();
      rig.closeSpring.userData.prims = [{label: 'Closing spring (55), helical extension spring', box: rig.closeSpring.geometry.boundingBox.clone()}];
    }
    rig.closeSpring.position.set(xCrank, yBot, zCS);
    rig.springEye.position.set(xCrank, yBot, zCS);
    E.set(xCrank, yBot - 12, zCS);
    Pp.set(xCrank, pinY, pinZ);
    d.subVectors(Pp, E);
    rig.link.position.copy(E);
    if (d.length() > 0.5) rig.link.quaternion.setFromUnitVectors(Y, d.clone().normalize());
    rig.link.scale.set(1, Math.max(0.5, d.length()), 1);
    rig.motorRotor.rotation.x = motor;
    // main shaft: lever tips rise from 57 (open) to 75 (closed): contact travel + over-travel
    const travel = Math.min(1, s * 1.15) * STROKE;
    const lift = travel + OVER * Math.max(0, s * 1.15 - 1) / 0.15;
    rig.shaft.rotation.x = Math.asin((yMS + 9 - (STROKE + OVER) + lift - yMS) / LEVER);
    for (const mv of rig.moving) mv.position.y = yGap - STROKE + travel;
    for (const bel of rig.bellows) bel.scale.y = 1 + (travel - STROKE) / 48;
    for (const r of rig.rodParts) r.position.y = -(STROKE + OVER) + lift;
    rig.plungerClose.position.y = 150 + 14 * pClose;
    rig.plungerOpen.position.z = 92 - 8 * pOpen;
    rig.btnOn.position.z = -6 * pClose;
    rig.btnOff.position.z = -6 * pOpen;
    rig.flagI.visible = s > 0.5;
    rig.flagO.visible = s <= 0.5;
    rig.flagCh.visible = c > 0.98;
    rig.flagDis.visible = c <= 0.98;
  };
  pose({});
  return {root, parts, pose, setEquip: rig.setEquip, dims: {P, TD, armD, fingers, STROKE, ZC, ZT, zPole, yUp: yUp + YB, yLo: yLo + YB, yGap: yGap + YB, viR: 52, shellIn: 66, viFront: zPole + 52, shellFrontIn: zS1 - 6, torsionIn: 26, mainShaftR: 18, sleeveIn: 30, armR: armD / 2}};
}
