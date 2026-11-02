// Stand-alone 3AE5 vacuum circuit-breaker on its withdrawable truck, detailed for the breaker teardown, with a rig
// that poses every moving part from the charging-crank angle (0° discharged, 170° charged and latched just past dead
// centre, 360° after closing) and s = main-shaft / contact position (0 open .. 1 closed).
//
// Operating principle (HG 11.02 p. 8, 3AE instructions Fig. 20): the closing spring is a helical extension spring
// hanging at the right side plate; the motor turns the charging shaft through the gear unit, the crank on that shaft
// stretches the spring via a link until it passes dead centre and the closing latch holds it. CLOSE (-Y9 or push
// button) frees the latch, the spring pulls the crank round, the closing cam on the charging shaft pushes the roller
// lever of the main shaft, the main shaft turns, its pole levers push the insulating rods up and the contacts close;
// the same movement winds the two opening torsion springs on the main-shaft ends and loads the contact-pressure
// springs, and the opening latch holds the main shaft. OPEN (-Y1 or push button) frees the opening latch and the
// opening + contact-pressure springs turn the shaft back. Spring types are read from the drawings; Siemens publishes
// no spring forces or rates. Layout after catalog HG 11.02 p. 8 (pole structure, open mechanism) and the 3AE
// operating instructions 9229 0001 176 0E Fig. 20 (callout numbers in the labels).
//
// Breaker axes (mm): x across (pole centres -P, 0, +P), y up from the truck rails, z towards the operator (front
// plate at z = ZF), poles and contact arms behind (negative z). Real values used: pole centre distance P, terminal
// distance TD, contact arm Ø, finger count, contact arm projection 274 mm (HG p. 59 'k'). Interrupter internals and
// the contact travel are generic and drawn larger than life (Siemens publishes no stroke).
import * as THREE from 'three';
import {B, C, L, PartBuilder, RB, T, TU, spread} from './geom.js';

export const BK_PARTS = [
  // id, name, group, explode dir (mm), description
  {id: 'bkTruck', name: 'Withdrawable truck (10)', grp: 'Truck', dir: [0, -260, 0], desc: 'Chassis with 4 wheels running on the panel shelf rails, racking spindle with nut (driven by the racking crank through the door), sliding earthing contact, locking levers that latch the part on the service truck. Racking travel 180 / 200 / 220 mm.'},
  {id: 'bkCover', name: 'Mechanism cover + control board (20.1)', grp: 'Operating mechanism', dir: [0, 0, 380], desc: 'Front cover with the central control board: CLOSE push button (56.1, green), OPEN push button (56.2, red), CLOSED/OPEN position indicator (56.3), spring state indicator (55.1), operating cycle counter (58), hand-crank opening (57.1), rating plate (21). Pressing CLOSE and OPEN together on a 3AE5 causes irreversible damage.'},
  {id: 'bkLV', name: 'LV interface: 64-pin plug, terminal strip (32, 33)', grp: 'Operating mechanism', dir: [0, 260, 120], desc: 'Low-voltage plug-connector -X0 (64-pin) on top, connector strip -X1, plugs -X01/-X02 for the withdrawable version. Carries motor supply, releases, auxiliary contacts, position switches and the spring-charged signal to the panel.'},
  {id: 'bkMotor', name: 'Motor + gear unit (53, 57)', grp: 'Operating mechanism', dir: [-260, 160, 120], desc: 'Motor -M1 (3AY1711, 3AE5 100–200 W/VA) turns the charging shaft through the gear unit (57); charging takes < 15 s. Position switches -S21/-S22 switch the motor off when the closing spring has latched. The hand crank fits the coupling (57.2) behind the cover opening (57.1) for manual charging (NXAIR: ≈ 50 turns); it uncouples when motor voltage returns.'},
  {id: 'bkClosingSpring', name: 'Closing spring (55), charging shaft, crank, closing cam', grp: 'Operating mechanism', dir: [300, 0, 120], desc: 'Helical extension spring hanging from the top of the right side plate, coils closed at rest. The charging shaft turns the closing crank, which stretches the spring through a link rod until the crank is just past dead centre, where the closing latch holds it (indicator CHARGED, -S4 signals). CLOSE (-Y9 or push button) frees the latch: the spring pulls the crank round and the closing cam on the same shaft drives the roller lever of the main shaft. The motor then recharges it at once, so OPEN – CLOSE – OPEN is stored.'},
  {id: 'bkShaft', name: 'Main shaft, pole levers, roller lever, opening latch (16)', grp: 'Operating mechanism', dir: [0, -120, 220], desc: 'Transverse main shaft between the side plates with one lever per pole and a roller lever driven by the closing cam. Turning it pushes the three insulating rods up (pole synchronism ≤ 2 ms) and winds the opening springs; the opening latch then holds it in CLOSED. -Y1 (or the OPEN button) frees the latch. Trip-free: an OPEN command during closing returns the contacts to OPEN even with CLOSE held.'},
  {id: 'bkOpeningSpring', name: 'Opening springs (17), torsion, on the main shaft', grp: 'Operating mechanism', dir: [-300, -80, 120], desc: 'Two helical torsion springs on the ends of the main shaft (as drawn in the 3AE instructions Fig. 20), one leg fixed to the frame, one on the shaft. The closing movement winds them up; together with the three contact-pressure springs they turn the shaft back when the opening latch is released: opening < 65 ms, arcing < 15 ms, break time < 80 ms.'},
  {id: 'bkReleases', name: 'Closing solenoid + releases (52, 51.1, 51.2)', grp: 'Operating mechanism', dir: [0, 120, 300], desc: 'Closing solenoid -Y9 (3AY1410), 1st shunt release -Y1 (direct-acting armature on the opening latch), optional 2nd release -Y2 (3AX1101), c.t.-operated release -Y4…-Y6 (3AX1102/1104) and undervoltage release -Y7 (3AX1103, transport screw from A to B before commissioning).'},
  {id: 'bkAux', name: 'Auxiliary switch, position switches, relay (31, 54, 34)', grp: 'Operating mechanism', dir: [260, 160, 200], desc: 'Auxiliary switch -S1 (3SV9273, 6 NO + 6 NC, or 3SV9274, 12 NO + 12 NC) coupled to the main shaft. Position switches -S12 (blocks electrical closing with the mechanical lock), -S21/-S22 (motor cut-off), -S3 (controls -K1), -S4 (spring charged), -S6 (trip signal). Contactor relay -K1: electrical anti-pumping.'},
  {id: 'bkFrame', name: 'Mechanism mounting plate + housing (9)', grp: 'Operating mechanism', dir: [0, 0, 0], desc: 'Steel housing and mounting plate carrying all mechanism parts, the separating panel to the poles (41) and the earth terminal M12 (70), tightened to 70 Nm.'},
  {id: 'bkRods', name: 'Insulating operating rods + contact-pressure springs (45)', grp: 'Pole', dir: [0, -160, -120], desc: 'One glass-fibre rod per pole carries the shaft lever movement up into the pole to the moving contact. A contact-pressure spring at the rod end keeps the closed contacts pressed together and compensates contact erosion (over-travel).'},
  {id: 'bkShell', name: 'Pole shells + insulating shells (46, 3)', grp: 'Pole', dir: [0, 0, -360], desc: 'Epoxy pole shell per phase. It holds the interrupter between the upper and lower connection and takes the switching forces and the contact pressure. The insulating shell opens towards the mechanism; the inter-phase panels (47) separate the poles.'},
  {id: 'bkUpper', name: 'Upper connections / pole heads (4, 42)', grp: 'Pole', dir: [0, 220, -200], desc: 'Pole head with the pole contact plate and cooling ribs. The fixed contact stem of the interrupter is bolted rigidly here. The upper contact arm screws into its thread (M12 ≤ 1250 A, M16 2000–2500 A), screw-in depth 20 ±1 mm.'},
  {id: 'bkLower', name: 'Lower connections + flexible conductor (7, 44)', grp: 'Pole', dir: [0, -60, -260], desc: 'Lower terminal on the pole shell. The moving stem of the interrupter is guided axially here and connected through a flexible copper conductor so it can travel. Lower contact arm screw-in depth 28 ±1 mm (38 ±1 mm at 40 kA).'},
  {id: 'bkVI', name: 'Vacuum interrupters (5, 43)', grp: 'Vacuum interrupter', dir: [0, 0, -560], desc: 'Sealed vacuum bottle per pole. The arc burns in metal vapour between the contacts and goes out at the next current zero; the vapour condenses on the shield and the gap regains its dielectric strength within microseconds. Maintenance-free; replaced as a pole by Siemens, never opened.'},
  {id: 'bkVIin', name: 'Interrupter internals (generic)', grp: 'Vacuum interrupter', dir: [0, 0, -760], desc: 'Generic construction of a vacuum interrupter, not a Siemens drawing: ceramic insulating body (2 rings), end flanges, central vapour shield, fixed contact stem and contact disc at the top, moving contact disc and stem at the bottom, stainless metal bellows that keep the vacuum while the stem moves, guide bushing. Contact discs are slotted (copper–chromium) to drive the arc. Gap and stroke drawn larger than life.'},
  {id: 'bkArms', name: 'Contact arms + threaded rods (22, 22.1)', grp: 'Primary contacts', dir: [0, 0, -420], desc: 'Silver-plated copper arms Ø 40 mm (≤ 1250 A, with contact arm adapter 22.2) or Ø 60 mm, 274 mm projection. Threaded rods greased with Vaseline, screwed into the terminals and tightened 40 ±4 Nm (M12) / 100 ±10 Nm (M16), greased threads. End faces: copper roughened, cleaned, Vaseline.'},
  {id: 'bkTulips', name: 'Contact systems / tulips (23.1)', grp: 'Primary contacts', dir: [0, 0, -640], desc: 'Ring of spring-loaded contact fingers (13 for ≤ 1250 A, 26 above) held by garter springs. They slide over the silver-plated fixed contacts in the panel bushings. Fingers greased both sides with Molykote Longterm 2; round outer edge towards the arm; tightened 40 ±4 / 100 ±10 Nm.'},
];

export function buildBreaker(mats, {P = 210, TD = 275, armD = 60, fingers = 26} = {}) {
  const root = new THREE.Group();
  const parts = {};
  const rig = {}; // moving objects
  const half = P + 72; // mechanism half-width (c = 565 for P = 210)
  const ZF = 300, ZB = 0; // front plate, rear wall of the mechanism box
  const zPole = -130; // pole axis
  const yLo = 250, yUp = yLo + TD; // terminal axes
  const yVI0 = yLo + 40, yVI1 = yUp - 40; // interrupter body
  const yGap = (yVI0 + yVI1) / 2 - 10; // contact plane
  const xs = [-P, 0, P];
  const STROKE = 14; // drawn contact travel (mm), larger than life
  const h = half - 10;
  const mx = -h + 140; // motor + gear unit column
  const zF0 = ZB + 126, zR = ZB + 60; // front-zone start (in front of the mounting plate), shaft plane (rear zone)
  const yMS = 160, yCS = 360; // main shaft, charging shaft
  const xCrank = h - 35, xCam = P / 2, CR = 40; // closing crank, closing cam, crank radius
  const ySpringTop = 620, SPRING0 = 120; // closing spring anchored at the top; closed-coil length

  const part = (id) => {
    const g = new THREE.Group();
    g.userData.part = id;
    const meta = BK_PARTS.find((p) => p.id === id);
    g.userData.dir = new THREE.Vector3(...(meta?.dir || [0, 0, 0]));
    root.add(g);
    parts[id] = g;
    return new PartBuilder(g, mats);
  };
  const sub = (pid, label, build, mat) => {
    // a moving sub-object with its own pivot, inside part pid
    const g = new THREE.Group();
    const pb = new PartBuilder(g, mats);
    build(pb);
    pb.finish();
    g.userData.label = label;
    parts[pid].add(g);
    return g;
  };

  // ------------------------------------------------------------ truck
  {
    const p = part('bkTruck');
    const w = P === 210 ? 679 / 2 : P === 275 ? 879 / 2 : 529 / 2;
    p.add(RB(-w, w, 20, 70, -360, ZF, 4), 'galvDark', 'Truck chassis');
    for (const s of [-1, 1]) {
      p.add(B(s * w - 10, s * w + 10, 10, 90, -360, ZF), 'steel', 'Side member');
      for (const z of [-310, ZF - 50]) p.add(C(28, 28, 22, 'x', s * (w + 12), 28, z, 20), 'black', 'Wheel');
      p.add(RB(s * (w - 70) - 30, s * (w - 70) + 30, 70, 95, ZF - 80, ZF + 10, 4), 'red', 'Locking lever');
    }
    p.add(C(11, 11, 560, 'z', 0, 45, ZF - 300), 'steel', 'Racking spindle');
    p.add(RB(-45, 45, 25, 70, -200, -140, 4), 'black', 'Spindle nut');
    p.add(B(-25, 25, 0, 20, -300, -150), 'copper', 'Sliding earthing contact');
    p.add(RB(-60, 60, 50, 92, ZF, ZF + 40, 6), 'steel', 'Pull handle');
    p.finish();
  }

  // ------------------------------------------------------------ mechanism housing + mounting plate
  {
    const p = part('bkFrame');
    p.add(B(-half, half, 95, 100, ZB, ZF), 'housing', 'Base of mechanism housing');
    p.add(B(-half, -half + 3, 100, 640, ZB, ZF - 10), 'housing', 'Side wall');
    p.add(B(half - 3, half, 100, 640, ZB, ZF - 10), 'housing', 'Side wall');
    p.add(B(-half, half, 100, 640, ZB, ZB + 4), 'galvDark', 'Separating panel to the poles (41)');
    p.add(B(-half + 20, half - 20, 110, 620, ZB + 120, ZB + 126), 'galv', 'Mechanism mounting plate (9)');
    p.add(C(10, 10, 20, 'x', -half - 8, 130, 60), 'zinc', 'Earth terminal M12 (70), 70 Nm');
    p.add(B(-half, half, 636, 640, ZB, ZF - 10), 'housing', 'Top plate');
    p.finish();
  }

  // ------------------------------------------------------------ cover + control board
  {
    const p = part('bkCover');
    p.add(RB(-half - 2, half + 2, 98, 642, ZF - 12, ZF, 6, 2), 'housing', 'Mechanism cover (20.1)');
    p.add(RB(-150, 150, 160, 420, ZF, ZF + 4, 4), 'grey', 'Central control board');
    p.add(RB(-135, -85, 250, 295, ZF + 4, ZF + 12, 4), 'green', 'CLOSE push button (56.1)');
    p.add(RB(-135, -85, 180, 225, ZF + 4, ZF + 12, 4), 'red', 'OPEN push button (56.2)');
    p.add(B(10, 120, 340, 385, ZF + 4, ZF + 5), 'black', 'Position indicator window (56.3)');
    p.add(B(10, 120, 280, 320, ZF + 4, ZF + 5), 'black', 'Spring state window (55.1)');
    p.add(B(10, 120, 220, 255, ZF + 4, ZF + 5), 'black', 'Operating cycle counter (58)');
    p.add(C(18, 18, 8, 'z', mx, 380, ZF + 6), 'steel', 'Hand-crank opening (57.1)');
    p.add(B(-130, 130, 470, 600, ZF, ZF + 1), 'white', 'Rating plate (21)');
    p.add(B(-140, 140, 610, 630, ZF, ZF + 1), 'black', 'SION label');
    p.finish();
    // indicator flags that change with the state
    rig.posFlag = sub('bkCover', 'Position indicator: I = closed, O = open', (b) => b.add(B(20, 110, 345, 380, ZF + 5, ZF + 6), 'white', 'flag'));
    rig.springFlag = sub('bkCover', 'Spring state indicator', (b) => b.add(B(20, 110, 285, 315, ZF + 5, ZF + 6), 'yellow', 'flag'));
    rig.posFlagMesh = rig.posFlag.children[0];
    rig.springFlagMesh = rig.springFlag.children[0];
  }

  // Mechanism: the mounting plate (9) at z ZB+120..126 separates a rear zone between the side plates (charging shaft,
  // main shaft, crank, cam, closing spring, opening springs, levers) from the front zone (motor + gear unit,
  // releases, switches, relay, terminal strip, heater).
  const helix = (len, r, turns, wire) => {
    const pts = [];
    const n = turns * 16;
    for (let i = 0; i <= n; i++) { const a = (i / n) * turns * Math.PI * 2; pts.push([Math.cos(a) * r, (i / n) * len, Math.sin(a) * r]); }
    return TU(pts, wire, n * 2, 6);
  };
  const Y = new THREE.Vector3(0, 1, 0);

  // ------------------------------------------------------------ LV interface
  {
    const p = part('bkLV');
    p.add(RB(-110, 110, 640, 690, 40, 140, 4), 'black', '64-pin LV plug-connector -X0 (32)');
    p.add(B(70, Math.min(190, h - 12), 330, 600, zF0, zF0 + 34), 'grey', 'Connector strip -X1 (33.1)');
    for (const y of spread(340, 590, 14)) p.add(B(75, Math.min(185, h - 17), y - 4, y + 4, zF0 + 34, zF0 + 40), 'white', 'Terminal');
    p.add(RB(-h + 10, -h + 90, 560, 610, zF0, zF0 + 60, 4), 'grey', 'Plugs -X01 / -X02 (33.2)');
    p.finish();
  }

  // ------------------------------------------------------------ motor + gear unit (front zone), charging gear (rear)
  {
    const p = part('bkMotor');
    p.add(C(36, 36, 120, 'z', mx, 580, ZB + 210), 'blue', 'Motor -M1 (53)');
    p.add(C(28, 28, 10, 'z', mx, 580, ZB + 275), 'black', 'Motor end cap');
    p.add(B(mx - 22, mx + 22, 330, 544, zF0 + 4, zF0 + 44), 'galvDark', 'Gear unit (57)');
    p.add(C(20, 20, 40, 'z', mx, 380, zF0 + 64), 'steel', 'Hand-crank coupling (57.2)');
    // gear unit output: a worm along z meshing on top of the charging gear (axes at right angles)
    const yW = yCS + 54 + 13; // thread tip on the tooth tip
    p.add(C(8, 8, zF0 + 4 - (zR - 30), 'z', mx, yW, (zF0 + 4 + zR - 30) / 2), 'steel', 'Worm shaft (gear unit output)');
    {
      const pts = [];
      for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2 * 6; pts.push([mx + Math.cos(a) * 10, yW + Math.sin(a) * 10, zR - 24 + (i / 96) * 48]); }
      p.add(TU(pts, 2.5, 192, 5), 'steel', 'Worm thread');
    }
    p.finish();
    rig.motorRotor = sub('bkMotor', 'Motor rotor (spins while charging)', (b) => b.add(B(-24, 24, -5, 5, -3, 3), 'zinc', 'rotor mark'));
    rig.motorRotor.position.set(mx, 580, ZB + 283);
  }

  // ------------------------------------------------------------ charging shaft, crank, cam, closing spring (rear zone)
  {
    const p = part('bkClosingSpring');
    p.add(C(14, 14, 2 * half - 40, 'x', 0, yCS, zR), 'steel', 'Charging shaft');
    p.add(B(xCrank - 40, xCrank + 40, ySpringTop, ySpringTop + 15, zR - 30, zR + 30), 'steel', 'Spring anchor (top)');
    p.add(T(10, 3, 'x', xCrank, ySpringTop - 4, zR), 'steel', 'Spring hook (top)');
    p.add(B(xCrank + 14, xCrank + 30, yCS + 30, yCS + 70, zR - 10, zR + 10), 'black', 'Closing latch (holds the crank past dead centre)');
    p.finish();
    // the rotating set on the charging shaft: charging gear (driven by the gear unit), crank with pin, closing cam
    rig.crank = sub('bkClosingSpring', 'Charging shaft set: gear, crank, closing cam', (b) => {
      b.add(C(48, 48, 16, 'x', mx, 0, 0, 36), 'steel', 'Charging gear wheel (57)');
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        b.add(B(mx - 8, mx + 8, Math.cos(a) * 51 - 3, Math.cos(a) * 51 + 3, Math.sin(a) * 51 - 3, Math.sin(a) * 51 + 3), 'steel', 'Gear tooth');
      }
      b.add(C(CR + 6, CR + 6, 12, 'x', xCrank - 14, 0, 0, 28), 'steel', 'Closing crank disc');
      b.add(C(7, 7, 28, 'x', xCrank, CR, 0, 12), 'zinc', 'Crank pin');
      b.add(C(45, 45, 14, 'x', xCam, -12, 0, 28), 'steel', 'Closing cam (eccentric)');
    });
    rig.crank.position.set(0, yCS, zR);
    // extension spring: closed coils at rest, stretched by the crank via the link
    rig.closeSpring = sub('bkClosingSpring', 'Closing spring (55), helical extension spring', (b) => b.add(helix(SPRING0, 26, 12, 5), 'spring', 'Closing spring (55)'));
    rig.closeSpring.position.set(xCrank, ySpringTop - SPRING0, zR);
    rig.springEye = sub('bkClosingSpring', 'Spring eye', (b) => b.add(T(10, 3, 'x', 0, -6, 0), 'steel', 'Spring eye (bottom)'));
    rig.springEye.position.set(xCrank, ySpringTop - SPRING0, zR);
    rig.link = sub('bkClosingSpring', 'Link rod spring → crank pin', (b) => b.add(C(5, 5, 1, 'y', 0, 0.5, 0, 10), 'steel', 'Link rod'));
  }

  // ------------------------------------------------------------ main shaft, levers, opening latch (rear zone)
  {
    const p = part('bkShaft');
    p.add(B(xCam + 22, xCam + 40, yMS + 22, yMS + 62, zR - 10, zR + 10), 'black', 'Opening latch (released by -Y1)');
    p.finish();
    rig.shaft = sub('bkShaft', 'Main shaft with pole levers (16)', (b) => {
      b.add(C(18, 18, 2 * half - 40, 'x', 0, 0, 0), 'steel', 'Main shaft');
      for (const x of xs) b.add(B(x - 10, x + 10, -10, 10, zPole + 55 - zR, 0), 'steel', 'Pole lever');
      const top = yCS - 12 - 45 - 12 - yMS; // roller sits on the cam
      b.add(B(xCam - 8, xCam + 8, 0, top, -8, 8), 'steel', 'Roller lever');
      b.add(C(12, 12, 20, 'x', xCam, top, 0, 16), 'zinc', 'Cam roller');
      for (const sx of [-1, 1]) b.add(B(sx * (half - 60) - 3, sx * (half - 60) + 3, 36, 64, -3, 3), 'spring', 'Opening spring leg (moving)');
    });
    rig.shaft.position.set(0, yMS, zR);
  }

  // ------------------------------------------------------------ opening springs: torsion springs on the main-shaft ends
  {
    const p = part('bkOpeningSpring');
    for (const sx of [-1, 1]) {
      const x0 = sx > 0 ? half - 60 : -(half - 20);
      p.add(helix(40, 30, 6, 4).rotateZ(-Math.PI / 2).translate(x0, yMS, zR), 'spring', 'Opening spring (17), torsion');
      p.add(B(sx * (half - 21) - 3, sx * (half - 21) + 3, 105, yMS - 36, zR - 3, zR + 3), 'spring', 'Opening spring leg (fixed)');
    }
    p.finish();
  }

  // ------------------------------------------------------------ releases (front zone; plungers pulse)
  {
    const p = part('bkReleases');
    p.add(RB(-30, 50, 230, 300, ZB + 140, ZB + 220, 4), 'black', 'Closing solenoid -Y9 (52)');
    p.add(RB(-30, 50, 320, 380, ZB + 140, ZB + 220, 4), 'black', '1st shunt release -Y1 (51.1)');
    p.add(RB(-30, 50, 400, 460, ZB + 140, ZB + 220, 4), 'grey', '2nd release -Y2 (51.2)');
    p.finish();
    rig.plungerClose = sub('bkReleases', 'Closing solenoid plunger', (b) => b.add(C(8, 8, 40, 'y', 0, 0, 0), 'zinc', 'plunger'));
    rig.plungerClose.position.set(10, 210, ZB + 180);
    rig.plungerOpen = sub('bkReleases', 'Shunt release armature', (b) => b.add(C(8, 8, 18, 'x', 0, 0, 0), 'zinc', 'armature'));
    rig.plungerOpen.position.set(59, 350, ZB + 180);
  }

  // ------------------------------------------------------------ aux switch, position switches, relay, heater, counter
  {
    const p = part('bkAux');
    p.add(RB(-h + 10, -h + 90, 300, 520, ZB + 140, ZB + 240, 4), 'grey', 'Auxiliary switch -S1 (31)');
    for (const y of spread(320, 500, 6)) p.add(B(-h + 90, -h + 96, y - 6, y + 6, ZB + 160, ZB + 220), 'zinc', 'Aux switch terminals');
    p.add(C(6, 6, 100, 'y', -h + 50, 250, ZB + 190), 'steel', 'Aux switch coupling rod');
    const names = ['Position switch -S21/-S22 (motor)', 'Position switch -S3 (K1)', 'Position switch -S4 (spring charged)', 'Position switch -S12'];
    for (let i = 0; i < 4; i++) p.add(RB(70 + i * 28, 90 + i * 28, 230, 290, ZB + 200, ZB + 240, 2), 'black', names[i]);
    p.add(RB(-30, 50, 560, 620, ZB + 140, ZB + 200, 4), 'grey', 'Contactor relay -K1, anti-pumping (34)');
    p.add(RB(-30, 60, 150, 200, ZF - 60, ZF - 20, 3), 'black', 'Operating cycle counter mechanism (58)');
    p.add(RB(-h + 10, -h + 110, 110, 160, ZB + 140, ZB + 200, 4), 'black', 'Heater -R01 (59.4), 50 W');
    p.finish();
  }

  // ------------------------------------------------------------ poles
  // pole shell: U open towards the mechanism, wraps the interrupter; heads and lower connections sit above / below it
  const yShell0 = yLo + 40, yShell1 = yUp - 41;
  const uShape = (x, g) => {
    const o = [[-70, 0], [-70, -60], [-50, -115], [0, -135], [50, -115], [70, -60], [70, 0]].map(([a, b]) => [a + Math.sign(a) * g, b - (b < 0 ? g : 0)]);
    const i = [[62, 0], [62, -58], [44, -108], [0, -127], [-44, -108], [-62, -58], [-62, 0]];
    return new THREE.Shape(o.concat(i).map(([dx, dz]) => new THREE.Vector2(x + dx, -(zPole + 60 + dz))));
  };
  const uExtrude = (x, y0, y1, g) => {
    const geo = new THREE.ExtrudeGeometry(uShape(x, g), {depth: y1 - y0, bevelEnabled: false});
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, y0, 0);
    return geo;
  };
  const poleShell = part('bkShell');
  const upper = part('bkUpper');
  const lower = part('bkLower');
  const vi = part('bkVI');
  const viIn = part('bkVIin');
  const rods = part('bkRods');
  const arms = part('bkArms');
  const tulips = part('bkTulips');
  rig.moving = [];
  rig.rodParts = [];
  for (const x of xs) {
    poleShell.add(uExtrude(x, yShell0, yShell1, 0), 'epoxy', 'Pole shell (46)');
    for (const y of spread(yShell0 + 20, yShell1 - 28, 4)) poleShell.add(uExtrude(x, y, y + 8, 4), 'epoxy', 'Pole shell rib');
    poleShell.add(B(x - 72, x + 72, yLo - 50, yUp + 80, zPole + 60, zPole + 64), 'epoxy', 'Insulating shell to the mechanism (3)');
    // insulator with sheds below the pole (8); the operating rod runs through its bore
    lower.add(L([[40, 0], [55, 10], [36, 25], [55, 40], [36, 55], [55, 70], [36, 85], [42, 100]], 'y', x, 100, zPole), 'epoxy', 'Insulator (8)');
    // upper connection / pole head
    upper.add(RB(x - 62, x + 62, yUp - 25, yUp + 80, zPole - 62, zPole + 40, 8, 2), 'tinned', 'Pole head with cooling ribs (42.2)');
    for (const dy of [30, 50, 70]) upper.add(B(x - 64, x + 64, yUp + dy - 4, yUp + dy + 4, zPole - 66, zPole + 20), 'tinned', 'Cooling ribs');
    upper.add(B(x - 45, x + 45, yUp - 30, yUp + 45, zPole - 72, zPole - 62), 'silver', 'Pole contact plate, upper terminal (44)');
    // lower connection with guide + flexible conductor
    lower.add(RB(x - 60, x + 60, yLo - 50, yLo + 30, zPole - 62, zPole + 40, 8, 2), 'tinned', 'Lower connection (7)');
    lower.add(B(x - 45, x + 45, yLo - 30, yLo + 30, zPole - 72, zPole - 62), 'silver', 'Pole contact plate, lower terminal (44)');
    for (let i = 0; i < 5; i++) lower.add(TU([[x - 20 + i * 10, yLo + 30, zPole + 8], [x - 20 + i * 10, yLo + 38, zPole + 22], [x - 20 + i * 10, yLo + 30, zPole + 34]], 2.2, 12, 5), 'copper', 'Flexible conductor (laminated)');
    lower.add(C(26, 26, 10, 'y', x, yLo + 35, zPole), 'steel', 'Guide bushing of the moving stem');
    // vacuum interrupter outer body
    vi.add(L([[48, 0], [52, 6], [52, 12], [46, 12]], 'y', x, yVI1 - 12, zPole), 'steel', 'Upper end flange');
    vi.add(L([[48, 0], [52, 6], [52, 12], [46, 12]], 'y', x, yVI0, zPole), 'steel', 'Lower end flange');
    vi.add(L([[46, 0], [47, 4], [46, (yVI1 - yVI0) / 2 - 18], [46, (yVI1 - yVI0) / 2 - 12]], 'y', x, yVI0 + 12, zPole), 'white', 'Ceramic insulating body (lower ring)');
    vi.add(L([[46, 0], [47, 4], [46, (yVI1 - yVI0) / 2 - 18], [46, (yVI1 - yVI0) / 2 - 12]], 'y', x, yGap + 4, zPole), 'white', 'Ceramic insulating body (upper ring)');
    vi.add(T(47, 3, 'y', x, yGap, zPole), 'steel', 'Centre flange (shield support)');
    vi.add(C(16, 16, yUp - 25 - (yVI1 - 12) + 12, 'y', x, (yUp - 25 + yVI1 - 12) / 2, zPole), 'copper', 'Fixed stem to the upper connection');
    // internals: shield, fixed contact
    viIn.add(L([[40, 0], [42, 6], [42, 70], [38, 80], [38, 82], [40, 82]], 'y', x, yGap - 41, zPole), 'copper', 'Vapour (arc) shield');
    viIn.add(C(30, 30, 8, 'y', x, yGap + 5, zPole, 28), 'copper', 'Fixed contact disc (CuCr, slotted)');
    viIn.add(B(x - 1.5, x + 1.5, yGap + 1, yGap + 10, zPole - 31, zPole + 31), 'black', 'Contact slot');
    viIn.add(B(x - 31, x + 31, yGap + 1, yGap + 10, zPole - 1.5, zPole + 1.5), 'black', 'Contact slot');
    viIn.add(C(12, 12, yVI1 - 12 - (yGap + 9), 'y', x, (yVI1 - 12 + yGap + 9) / 2, zPole), 'copper', 'Fixed contact stem');
    const mv = new THREE.Group();
    mv.userData.part = 'bkVIin';
    const mb = new PartBuilder(mv, mats);
    mb.add(C(30, 30, 8, 'y', 0, -4, 0, 28), 'copper', 'Moving contact disc (CuCr, slotted)');
    mb.add(C(12, 12, 120, 'y', 0, -68, 0), 'copper', 'Moving contact stem');
    mb.finish();
    mv.position.set(x, yGap, zPole);
    parts.bkVIin.add(mv);
    rig.moving.push(mv);
    const prof = [];
    for (let i = 0; i <= 16; i++) prof.push([i % 2 ? 26 : 19, i * 3]);
    const bel = new THREE.Group();
    bel.userData.part = 'bkVIin';
    const bb = new PartBuilder(bel, mats);
    bb.add(L(prof, 'y', 0, 0, 0, 20), 'silver', 'Metal bellows (keeps the vacuum while the stem moves)');
    bb.finish();
    bel.position.set(x, yVI0 + 12, zPole);
    parts.bkVIin.add(bel);
    rig.bellows = (rig.bellows || []).concat(bel);
    const rod = new THREE.Group();
    rod.userData.part = 'bkRods';
    const rb = new PartBuilder(rod, mats);
    // rod from the lever pin (at the lever height) up to the moving stem (its top meets the stem end)
    const rodTop = yGap - STROKE - 128 - (130 - STROKE);
    rb.add(C(14, 14, rodTop - 52, 'y', 0, (rodTop + 52) / 2, 0), 'yellow', 'Insulating operating rod (45), glass-fibre');
    rb.add(helix(40, 19, 4, 3).translate(0, 56, 0), 'spring', 'Contact-pressure spring');
    rb.add(B(-14, 14, 36, 52, -14, 14), 'steel', 'Rod end / lever pin');
    rb.finish();
    rod.position.set(x, 130, zPole);
    parts.bkRods.add(rod);
    rig.rodParts.push(rod);
    for (const [y, lab] of [[yUp, 'Upper'], [yLo, 'Lower']]) {
      const z0 = zPole - 72, z1 = z0 - 274;
      arms.add(C(armD / 2, armD / 2, z0 - z1 - 60, 'z', x, y, (z0 + z1 + 60) / 2, 24), 'silver', `${lab} contact arm (22), Ø ${armD}`);
      arms.add(C(armD / 2 + 8, armD / 2 + 8, 14, 'z', x, y, z0 - 7, 24), 'silver', 'Contact arm flange');
      arms.add(C(6, 6, 30, 'z', x, y, z0 + 8), 'zinc', 'Threaded rod (22.1)');
      const rr = armD / 2 + 4;
      const fw = fingers === 26 ? 3.5 : 5.5;
      for (let f = 0; f < fingers; f++) {
        const a = (f / fingers) * Math.PI * 2;
        tulips.add(RB(x + Math.cos(a) * rr - fw, x + Math.cos(a) * rr + fw, y + Math.sin(a) * rr - fw, y + Math.sin(a) * rr + fw, z1 - 20, z1 + 58, 1.5, 1), 'silver', 'Contact finger');
      }
      tulips.add(T(rr + fw + 2.5, 2.5, 'z', x, y, z1 + 5), 'spring', 'Garter spring');
      tulips.add(T(rr + fw + 2.5, 2.5, 'z', x, y, z1 + 40), 'spring', 'Garter spring');
    }
  }
  poleShell.finish();
  upper.finish();
  lower.finish();
  vi.finish();
  viIn.finish();
  rods.finish();
  arms.finish();
  tulips.finish();

  // ------------------------------------------------------------ the rig
  const OVER = 6; // contact-pressure spring compression
  const E = new THREE.Vector3(), Pp = new THREE.Vector3(), d = new THREE.Vector3();
  const pose = ({c = 0, s = 0, crank = null, motor = 0, pClose = 0, pOpen = 0}) => {
    // charging crank: 0° discharged (pin up), 170° charged and latched, 360° after the closing stroke
    const th = ((crank ?? (c > 0.99 ? 170 : c * 170)) * Math.PI) / 180;
    rig.crank.rotation.x = th;
    const L = SPRING0 + CR * (1 - Math.cos(th)); // spring stretches as the pin goes down
    rig.closeSpring.position.y = ySpringTop - L;
    rig.closeSpring.scale.set(1, L / SPRING0, 1);
    rig.springEye.position.y = ySpringTop - L;
    E.set(xCrank, ySpringTop - L - 12, zR);
    Pp.set(xCrank, yCS + CR * Math.cos(th), zR + CR * Math.sin(th));
    d.subVectors(Pp, E);
    rig.link.position.copy(E);
    rig.link.quaternion.setFromUnitVectors(Y, d.clone().normalize());
    rig.link.scale.set(1, d.length(), 1);
    rig.motorRotor.rotation.z = motor;
    // main shaft: closing turns it; the opening springs on its ends wind up with it
    rig.shaft.rotation.x = 0.15 * s; // pole-lever tips rise ≈ 20 mm: contact travel + over-travel
    const travel = Math.min(1, s * 1.15) * STROKE; // contacts touch before the shaft ends: over-travel loads the pressure springs
    for (const mv of rig.moving) mv.position.y = yGap - STROKE + travel;
    for (const bel of rig.bellows) bel.scale.y = 1 + (travel - STROKE) / 48;
    for (const r of rig.rodParts) r.position.y = 130 - STROKE + travel + OVER * Math.max(0, s * 1.15 - 1) / 0.15;
    rig.plungerClose.position.y = 210 + 18 * pClose;
    rig.plungerOpen.position.x = 59 + 14 * pOpen;
    rig.posFlagMesh.material = s > 0.5 ? mats.black : mats.green;
    rig.springFlagMesh.material = c > 0.98 ? mats.yellow : mats.white;
  };
  pose({});
  return {root, parts, pose, dims: {P, TD, armD, fingers, STROKE, ZF, zPole, yUp, yLo, viR: 52, shellIn: 62, viRear: zPole - 52, shellRear: zPole - 67, torsionIn: 30 - 4.5, mainShaftR: 18}};
}
