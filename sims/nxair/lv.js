// Stand-alone NXAIR low-voltage compartment with a SIPROTEC 5 7SJ82 protection device, for the LV tab.
//
// What is real: compartment 630 mm high x 406 mm deep, panel width 600 / 800 / 1000 mm (NXAIR drawing, I §7.9),
// door with 3 mm double-bit lock, panel-to-panel bolts 3 x M8x20, LRM test sockets below the device (HA 25.71 / 25.73
// p. 30 photos), shields earthed in the LV compartment (I §5.11), bus-wire terminal block / plug connectors (I §10.13),
// 10-pole coded plug connections for withdrawable-part and panel wiring (HA 25.73 p. 30). The SIPROTEC 5 device is
// drawn to the SIPROTEC 5 hardware manual C53000-G5040-C002-Q: 1/3 x 19" flush-mounting housing, front 150 x 266 mm,
// 34 mm in front of the mounting wall, housing 145 x 244 mm, 163 mm behind the wall plus 34 mm of rear terminals
// (231 mm total, Fig. 6-13), cut-out 146+2 x 245+1 mm (Fig. 6-1), on-site operation panel with large display,
// 16 LEDs, keypad with function keys, Ctrl / I / O keys, USB-B port (Fig. 2-1), rear terminals of a 7xx82 with
// PS101 + IO102 (Fig. 2-4, 3-86).
//
// What is an example: the equipment of an LV compartment is order-specific (circuit diagrams in the compartment).
// The MCB / relay / terminal-strip layout and the device tags (-F01 …) are a typical cable-feeder example, not a
// Siemens drawing.
//
// Axes (mm): x across the panel (hinge side = -x), y up from the compartment floor, z towards the operator with the
// closed door's outer face at z = 0. The door (and everything on it) hangs in a hinge group that pose() rotates.
import * as THREE from 'three';
import {B, C, EY, EZ, PartBuilder, RB, TU, rect, rectHole, spread} from './geom.js';

export const LV_PARTS = [
  {id: 'lvBox', name: 'Compartment housing', grp: 'Compartment', dir: [0, 0, 0], door: false, desc: 'Galvanised sheet-steel box, 630 mm high (980 mm option), 406 mm deep, the full panel width. It sits on the switching-device compartment and is partitioned safe-to-touch from the high-voltage part. Bolted to the neighbour LV compartment through the side wall with 3 × M8x20 (5 × at 980 mm), contact washers and nuts, 30 Nm (I §7.9). Floor openings: cable grommet for the customer wiring duct (left), the 64-pole socket wiring and the 10-pole plug connections. It can be removed as a whole because all bus wires and control cables are plugged (HA 25.73 p. 30).'},
  {id: 'lvDoor', name: 'Door, lock, hinges, document pocket', grp: 'Compartment', dir: [0, 0, 0], door: true, desc: 'Hinged on the left, opens 110°. Lock with 3 mm double-bit insert. Cut-out 148 × 246 mm for the 1/3 × 19" SIPROTEC 5 device, cut-out for the voltage detecting system below it. Inside: pocket with the circuit diagrams of this panel (I §10.12: connect the control cables per the circuit diagrams stored in the LV compartment), rating plate (serial no., year, functional unit no.), earthing stud for the door strap.'},
  {id: 'relay', name: 'SIPROTEC 5 7SJ82 protection device (-F10)', grp: 'Protection device', dir: [0, 0, 260], door: true, desc: 'Overcurrent and feeder protection with control, 1/3 × 19" non-modular flush-mounting device, 3.6 kg. Front 150 × 266 mm, 34 mm proud of the door; housing 145 × 244 mm, 163 mm deep behind the door plus 34 mm of terminals (231 mm in all). On-site operation panel: large display, 16 two-colour LEDs with label strip, RUN / ERROR LEDs, navigation keys, numeric keypad with function keys F1–F9, Ctrl, CLOSE (I, green) and OPEN (O, red) control keys, USB type B for DIGSI 5. Fixed with 4 × M4 screws through the fastening openings behind the plastic screw covers (1.2 Nm). Tag -F10 is an example.'},
  {id: 'relayTerm', name: 'SIPROTEC rear terminals + communication', grp: 'Protection device', dir: [0, 0, -170], door: true, desc: 'Plug-in terminal blocks held by spring clips, so the device can be changed without unwiring. A: current terminal, 8 screw points for I1–I4 (ring lugs 2.0–4.0 mm², 2.7 Nm; solid 2.0 Nm), CT circuits shorted automatically when the block is pulled. B, D: 14-pole voltage terminals of IO102 (V1–V4, BO 1.1–1.6, BI 1.1–1.8; 0.5–2.5 mm², 1.0 Nm, PZ1). L: PS101 power supply (L+ / L−, BI 2.1–2.3, BO 2.1–2.2, life contact). E / F: plug-in module positions (e.g. Ethernet or serial protocol module, arc protection module). G: time synchronisation (D-sub 9). J: integrated Ethernet RJ45 (DIGSI 5). Battery compartment. Protective earth terminals: ≥ 4 mm², M4, ≥ 1.2 Nm.'},
  {id: 'lrm', name: 'Voltage detecting system (LRM / CAPDIS)', grp: 'Door devices', dir: [0, 0, 120], door: true, desc: 'Capacitive voltage detecting system to IEC 61243-5 with the test sockets for L1, L2, L3 in the LV door, below the protection device; coupling unit behind the door. LRM indicator (8DX1620) plugged on to read; or integrated CAPDIS-S1+/S2+ / VOIS+ without auxiliary power.'},
  {id: 'lvPlate', name: 'Mounting plate, DIN rails, wiring ducts', grp: 'Interior', dir: [0, 0, 0], door: false, desc: 'Galvanised mounting plate on the back wall. TS 35 DIN rails in three rows with slotted wiring ducts between them and on both sides. The secondary devices are mounted in defined zones and the wiring runs in the ducts (EMC measures, I §5.11).'},
  {id: 'mcb', name: 'Miniature circuit-breakers (-F01 … -F12)', grp: 'Interior', dir: [0, 0, 170], door: false, desc: 'Example row: -F01 protection-device supply, -F02 close / trip control circuit, -F03 spring-charging motor -M1, -F04 heater 230 V AC, -F11 3-pole VT MCB (3RV16) with auxiliary contact to a binary input (fuse failure), -F12 VT MCB for the open-delta winding. Switch the VT MCBs off before working on VT circuits; commissioning checks the alarm of every MCB and VT MCB trip (report items 8.1, 8.2).'},
  {id: 'auxDev', name: 'Thermostat, hygrostat, interposing relays, lamp', grp: 'Interior', dir: [0, 0, 170], door: false, desc: 'Top row: thermostat -B1 and hygrostat -B2 that switch the anti-condensation heaters, heater relay -K21, interposing relays -K11 … -K14 (e.g. remote trip in, CB position to the SCADA). LED luminaire under the roof with door contact switch -S10 (commissioning item 11.2: illumination tested). Tags are examples.'},
  {id: 'terms', name: 'Terminal strips -X1 / -X2 / -X3, shield + PE bar', grp: 'Interior', dir: [0, 0, 170], door: false, desc: '-X1 control and bus-wire terminals (5.2 mm feed-through, 2.5 mm²); -X2 current-transformer test-disconnect terminals with shorting jumpers: short the CT secondary before opening a link (report item 9.2: jumpers in correct position; 9.1: secondary windings earthed at one point); -X3 voltage-transformer disconnect terminals; PE terminals. Below: copper shield bar where cable screens are bonded all round, pigtails < 10 cm (I §5.11).'},
  {id: 'busWire', name: 'Bus-wire plug connectors (panel to panel)', grp: 'Interior', dir: [0, 90, 60], door: false, desc: 'Bus wires are the ring circuits running from panel to panel through the LV compartments: auxiliary DC supply, heater AC supply, busbar VT voltage, interlocking and alarm buses. They are plugged from panel to panel (HA 25.73 p. 30) or clamped on the bus-wire terminal block (I §10.13). Commissioning item 3.1: plug connector latched or wired to the terminal strip.'},
  {id: 'plugs', name: '10-pole coded plug connections', grp: 'Interior', dir: [0, 80, 140], door: false, desc: 'The wiring from the withdrawable-part socket and from the panel (position switches, earthing-switch signals, interlocking magnets, CTs, VTs, heaters) arrives in the LV compartment on 10-pole coded plug connectors (HA 25.73 p. 30), so the LV compartment can be unplugged and lifted off.'},
  {id: 'socket', name: '64-pole socket for the breaker LV plug', grp: 'Interior', dir: [0, -150, 0], door: false, desc: 'Fixed 64-pole socket under the LV compartment floor, in the switching-device compartment. The breaker plug -X0 hangs here in test and service position. Its pins carry motor, closing solenoid -Y9, shunt release -Y1, auxiliary switch -S1 and position switches -S4 / -S6 (pin list in the LV tab).'},
  {id: 'loom', name: 'Wiring looms', grp: 'Interior', dir: [0, 0, 0], door: false, desc: 'Door loom from the protection device to the hinge (flexible, spiral-wrapped), loom from the hinge into the left duct, single wires from each terminal and MCB into the ducts. Wire sizes typical: CT circuits 2.5–4 mm², VT and control 1.5 mm², 105 °C copper (SIPROTEC terminal requirements).'},
];
// parts drawn see-through in X-ray
export const LV_SHELLS = new Set(['lvBox', 'lvDoor']);

const Y0 = 60; // the compartment floor is lifted 60 mm in the scene so the socket under it clears the floor grid
export const LV_DOOR_OPEN = (110 * Math.PI) / 180;

export function buildLV(mats, {W = 800} = {}) {
  const root = new THREE.Group();
  root.position.y = Y0;
  const parts = {};
  const hw = W / 2;
  const H = 630, DEP = 406, DT = 24; // height, depth, door depth
  const zB = -DEP; // inner face of the back wall is zB + 2
  const hingeX = -hw + 10, hingeZ = 5;
  const hinge = new THREE.Group(); // pivot on the hinge axis; door-mounted parts live in here
  hinge.position.set(hingeX, 0, hingeZ);
  root.add(hinge);
  const doorFrame = new THREE.Group(); // door coordinates = compartment coordinates when closed
  doorFrame.position.set(-hingeX, 0, -hingeZ);
  hinge.add(doorFrame);

  const part = (id) => {
    const meta = LV_PARTS.find((p) => p.id === id);
    const g = new THREE.Group();
    g.userData.part = id;
    g.userData.dir = new THREE.Vector3(...(meta?.dir || [0, 0, 0]));
    (meta?.door ? doorFrame : root).add(g);
    (parts[id] ||= []).push(g);
    return new PartBuilder(g, mats);
  };

  // ------------------------------------------------------------------------------------------------ housing
  {
    const p = part('lvBox');
    // floor with the cable grommet slot (customer wiring duct, left), the 64-pole socket opening and the plug opening
    const holes = [rectHole(-hw + 25, 95, -hw + 115, 195), rectHole(-60, 372, 60, 398)];
    p.add(EY(rect(-(hw - 2), -24, hw - 2, zB), 0, 2, holes), 'galv', 'Floor');
    p.add(B(-(hw - 2), hw - 2, H - 2, H, zB, -DT), 'galv', 'Roof');
    p.add(B(-hw, -hw + 2, 0, H, zB, -DT), 'galv', 'Side wall');
    p.add(B(hw - 2, hw, 0, H, zB, -DT), 'galv', 'Side wall');
    p.add(B(-(hw - 2), hw - 2, 2, H - 2, zB, zB + 2), 'galv', 'Back wall (partition to the pressure relief duct)');
    // front frame the door closes on
    p.add(B(-(hw - 2), -(hw - 22), 2, H - 2, -DT - 6, -DT), 'galvDark', 'Door frame');
    p.add(B(hw - 22, hw - 2, 2, H - 2, -DT - 6, -DT), 'galvDark', 'Door frame');
    p.add(B(-(hw - 22), hw - 22, 2, 22, -DT - 6, -DT), 'galvDark', 'Door frame');
    p.add(B(-(hw - 22), hw - 22, H - 22, H - 2, -DT - 6, -DT), 'galvDark', 'Door frame');
    // rubber grommet round the floor slot
    p.add(B(-hw + 21, -hw + 119, 2, 8, -199, -195), 'rubber', 'Cable grommet');
    p.add(B(-hw + 21, -hw + 119, 2, 8, -95, -91), 'rubber', 'Cable grommet');
    // panel-to-panel joint: 3 x M8x20 through the side walls, heads inside the left wall, nuts inside the right wall
    for (const y of spread(80, H - 80, 3)) {
      p.add(C(6.5, 6.5, 5.3, 'x', -hw + 2 + 2.65, y, -206, 6), 'zinc', 'Panel-to-panel bolt M8x20 (30 Nm)');
      p.add(C(7.5, 7.5, 6.5, 'x', hw - 2 - 3.25, y, -206, 6), 'zinc', 'Hex nut M8 + contact washer');
    }
    p.finish();
  }

  // ------------------------------------------------------------------------------------------------ door
  const rx = 0, ry = 380; // centre of the protection device
  const cutW = 148, cutH = 246; // SIPROTEC 5 1/3 cut-out 146+2 x 245+1
  const lrmY = 50;
  {
    const p = part('lvDoor');
    const holes = [rectHole(rx - cutW / 2, ry - cutH / 2, rx + cutW / 2, ry + cutH / 2), rectHole(-86, lrmY - 16, 86, lrmY + 16)];
    p.add(EZ(rect(-hw + 4, 6, hw - 4, H - 6), -2, 0, holes), 'ral', 'Door');
    p.add(B(-hw + 4, -hw + 6, 6, H - 6, -DT + 1, -2), 'ral', 'Door fold');
    p.add(B(hw - 6, hw - 4, 6, H - 6, -DT + 1, -2), 'ral', 'Door fold');
    p.add(B(-hw + 6, hw - 6, 6, 8, -DT + 1, -2), 'ral', 'Door fold');
    p.add(B(-hw + 6, hw - 6, H - 8, H - 6, -DT + 1, -2), 'ral', 'Door fold');
    p.add(B(-hw + 8, hw - 8, 8, 12, -DT + 1, -DT + 4), 'rubber', 'Door seal');
    p.add(B(-hw + 8, hw - 8, H - 12, H - 8, -DT + 1, -DT + 4), 'rubber', 'Door seal');
    for (const y of [80, H - 80]) p.add(C(6, 6, 60, 'y', hingeX, y, hingeZ), 'steel', 'Door hinge');
    for (const y of [80, H - 80]) p.add(B(-hw + 4, hingeX + 2, y - 25, y + 25, -1, 2), 'steel', 'Hinge leaf');
    // lock: knob outside, cam behind the door that turns behind the frame
    p.add(C(11, 11, 12, 'z', hw - 45, 340, 6), 'black', 'Door lock (3 mm double-bit insert)');
    p.add(C(4, 4, 1, 'z', hw - 45, 340, 12.5), 'steel', 'Double-bit key insert 3 mm');
    p.add(C(8, 8, 18, 'z', hw - 45, 340, -11), 'steel', 'Lock barrel');
    p.add(B(hw - 50, hw - 14, 330, 350, -22, -20), 'steel', 'Lock cam');
    // inside: document pocket, rating plate, earthing stud
    const px0 = -hw + 34, px1 = Math.min(-95, px0 + 210);
    p.add(B(px0, px1, 120, 330, -10, -2), 'plastic', 'Circuit-diagram pocket');
    p.add(B(px0 + 8, px1 - 8, 140, 320, -12, -10), 'white', 'Circuit diagrams of this panel');
    p.add(B(95, 185, 120, 170, -3, -2), 'white', 'Rating plate (serial no., year, functional unit no.)');
    p.add(C(4, 4, 14, 'z', -hw + 30, 40, -9), 'zinc', 'Door earthing stud M6 + strap');
    p.finish();
  }

  // ------------------------------------------------------------------------------------------------ SIPROTEC 5 7SJ82
  {
    const p = part('relay');
    const fx = 75, fy = 133; // front 150 x 266
    p.add(RB(rx - fx, rx + fx, ry - fy, ry + fy, 0, 30, 5, 2), 'black', 'Front frame');
    p.add(B(rx - 70, rx + 70, ry - 128, ry + 128, 30, 33), 'slate', 'On-site operation panel');
    // housing through the cut-out, heat-sink ribs on both sides, rear plate
    p.add(B(rx - 62, rx + 62, ry - 122, ry + 122, -163, 0), 'grey', 'Housing (1/3 × 19")');
    for (const s of [-1, 1]) for (const y of spread(ry - 110, ry + 110, 6)) p.add(B(Math.min(rx + s * 62, rx + s * 72.5), Math.max(rx + s * 62, rx + s * 72.5), y - 6, y + 6, -160, -8), 'grey', 'Heat-sink ribs');
    p.add(B(rx - 62, rx + 62, ry - 122, ry + 122, -165, -163), 'galvDark', 'Rear plate');
    // front elements (positions read from the hardware manual Fig. 2-1)
    const F = 33, f = (x, y, w, h, d, mat, lab) => p.add(B(rx + x - w / 2, rx + x + w / 2, ry + y - h / 2, ry + y + h / 2, F, F + d), mat, lab);
    f(-61, 106, 3.5, 3.5, 1.2, 'green', 'RUN LED');
    f(-47, 106, 3.5, 3.5, 1.2, 'red', 'ERROR LED');
    for (let i = 0; i < 16; i++) f(-63, 92 - i * 6.9, 3.2, 3.2, 1.2, i < 2 ? 'green' : 'red', 'LED 1–16 (two-colour, configurable)');
    f(-44, 38, 22, 110, 0.6, 'white', 'LED label strip');
    f(11, 30, 72, 110, 0.8, 'screen', 'Large display');
    f(-63, -28, 10, 10, 1.5, 'beige', 'LED test / reset key');
    f(-27, -31, 10, 10, 1.5, 'beige', 'Softkey (left)');
    f(48, -34, 10, 10, 1.5, 'beige', 'Softkey (right)');
    for (const [x, y] of [[10, -29], [10, -51], [-2, -40], [22, -40]]) f(x, y, 11, 11, 2, 'beige', 'Navigation keys');
    f(-61, -76, 20, 30, 4, 'black', 'USB type B port with cover (DIGSI 5)');
    f(-26, -84, 22, 62, 0.6, 'white', 'Function-key label strip');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      const fn = r === 3 && c === 0;
      f(-4 + c * 14, -62 - r * 14, 11, 11, 2, fn ? 'blue' : 'beige', fn ? 'Fn key' : r === 3 ? 'Keypad (0, .)' : 'Keypad 1–9 / function keys F1–F9');
    }
    f(44, -67, 16, 17, 2, 'yellow', 'Ctrl key');
    f(44, -86, 16, 17, 2, 'green', 'Control key I (CLOSE)');
    f(44, -105, 16, 17, 2, 'red', 'Control key O (OPEN)');
    f(0, -122, 120, 6, 0.6, 'white', 'Device label strip');
    for (const y of [ry + 124, ry - 124]) for (const x of [rx - 52, rx + 52]) p.add(C(3.5, 3.5, 2, 'z', x, y, 31), 'black', 'Screw cover (M4 fastening screw behind, 1.2 Nm)');
    p.finish();
  }
  {
    // rear terminals, positions read from the rear view of a 7xx82 with IO102 (Fig. 2-4 / 3-86). Seen from behind,
    // the device's +x side is on the left.
    const p = part('relayTerm');
    const zr = -165;
    const blk = (x0, x1, y0, y1, d, mat, lab) => p.add(B(rx + x0, rx + x1, ry + y0, ry + y1, zr - d, zr), mat, lab);
    blk(-70, 7, 32, 120, 30, 'termGrey', 'Current terminal A (I1–I4, ring lugs, 2.7 Nm)');
    for (let i = 0; i < 8; i++) {
      const x = i % 2 ? -52 : -12, y = 110 - Math.floor(i / 2) * 22 - (i % 2 ? 6 : 0);
      p.add(C(4.5, 4.5, 4, 'z', rx + x, ry + y, zr - 32), 'steel', 'Clamping screw (current terminal)');
    }
    blk(-64, -19, -21, 30, 24, 'termGrey', 'Voltage terminal B (14-pole: V1–V4, BO 1.1–1.3)');
    blk(-64, -19, -122, -71, 24, 'termGrey', 'Voltage terminal D (14-pole: BI 1.1–1.8, BO 1.4–1.6)');
    blk(9, 51, 17, 68, 24, 'termGrey', 'Voltage terminal L (PS101: supply, BI 2.1–2.3, BO 2.1–2.2, life contact)');
    for (const [x0, x1, y0, y1] of [[-64, -19, -21, 30], [-64, -19, -122, -71], [9, 51, 17, 68]]) for (const y of spread(y0 + 4, y1 - 4, 7)) {
      p.add(B(rx + x0 + 2, rx + x0 + 8, ry + y - 1.5, ry + y + 1.5, zr - 26, zr - 24), 'orange', 'Spring clip / screw (1.0 Nm, PZ1)');
    }
    blk(19, 65, -57, 6, 3, 'galvDark', 'Plug-in module positions E / F (communication, arc protection)');
    for (const y of [-12, -42]) blk(28, 48, y - 8, y + 8, 14, 'black', 'Plug-in module port (e.g. Ethernet)');
    blk(9, 17, -17, 8, 10, 'grey', 'Time synchronisation G (D-sub 9)');
    blk(7, 19, -86, -62, 6, 'black', 'Battery compartment');
    blk(5, 19, -115, -100, 16, 'black', 'Integrated Ethernet J (RJ45, DIGSI 5)');
    blk(-14, -4, -120, -109, 8, 'zinc', 'Protective earth terminals (≥ 4 mm², M4, ≥ 1.2 Nm)');
    p.finish();
  }

  // ------------------------------------------------------------------------------------------------ LRM sockets
  {
    const p = part('lrm');
    p.add(B(-90, 90, lrmY - 20, lrmY + 20, 0, 2), 'black', 'Test socket panel');
    ['L1', 'L2', 'L3'].forEach((ph, i) => {
      p.add(C(7, 7, 8, 'z', -50 + i * 50, lrmY, 6), ['yellow', 'green', 'red'][i], `LRM test socket ${ph}`);
      p.add(C(9, 9, 2, 'z', -50 + i * 50, lrmY, 3), 'black', 'Socket cover');
    });
    p.add(B(-84, 84, lrmY - 14, lrmY + 14, -40, -2), 'black', 'Coupling unit (behind the door)');
    p.finish();
  }

  // ------------------------------------------------------------------------------------------------ interior
  const zP = zB + 3; // front face of the mounting plate
  const RAIL = 7.5;
  const xL = -hw + 70, xR = hw - 70; // DIN rail ends
  const rows = {A: 250, B: 115, C: 470}; // rail centre lines
  {
    const p = part('lvPlate');
    p.add(B(-(hw - 25), hw - 25, 20, 605, zB + 2.5, zP), 'galv', 'Mounting plate');
    for (const y of Object.values(rows)) {
      p.add(B(xL, xR, y - 17.5, y + 17.5, zP, zP + RAIL), 'steel', 'DIN rail TS 35');
    }
    const duct = (x0, x1, y0, y1, lab) => {
      p.add(B(x0, x1, y0, y1, zP, zP + 55), 'termGrey', lab);
      p.add(B(x0 - 1, x1 + 1, y0 - 1, y1 + 1, zP + 55, zP + 58), 'termGrey', 'Duct cover');
    };
    duct(-hw + 25, -hw + 65, 20, 570, 'Slotted wiring duct (vertical)');
    duct(hw - 65, hw - 25, 20, 570, 'Slotted wiring duct (vertical)');
    duct(-hw + 66, hw - 66, 160, 200, 'Slotted wiring duct');
    duct(-hw + 66, hw - 66, 305, 345, 'Slotted wiring duct');
    duct(-hw + 66, hw - 66, 525, 565, 'Slotted wiring duct');
    p.finish();
  }
  const zR = zP + RAIL; // device mounting face
  const wireStubs = []; // [x, yFrom, yTo] single wires from devices up into the ducts
  {
    // MCB row A
    const p = part('mcb');
    const y = rows.A;
    let x = xL + 10;
    p.add(B(x - 9, x, y - 25, y + 25, zR, zR + 40), 'grey', 'End stop');
    const list = [
      [36, 'white', '-F01 MCB 2-pole: protection-device supply L+ / L−'],
      [36, 'white', '-F02 MCB 2-pole: close / trip control circuit'],
      [36, 'white', '-F03 MCB 2-pole: spring-charging motor -M1'],
      [36, 'white', '-F04 MCB 2-pole: heater 230 V AC'],
      [45, 'grey', '-F11 VT MCB 3-pole (3RV16) with auxiliary contact'],
      [18, 'grey', '-F12 VT MCB 1-pole: open-delta winding'],
    ];
    for (const [w, mat, lab] of list) {
      p.add(RB(x + 0.5, x + w - 0.5, y - 45, y + 45, zR, zR + 45, 2, 1), mat, lab);
      p.add(RB(x + 1.5, x + w - 1.5, y - 22, y + 22, zR + 45, zR + 70, 2, 1), mat, lab);
      for (let k = 0; k < Math.max(1, Math.floor(w / 18)); k++) {
        p.add(B(x + 5 + k * 18, x + 13 + k * 18, y - 6, y + 10, zR + 70, zR + 78), mat === 'white' ? 'blue' : 'black', 'Switch toggle');
        wireStubs.push([x + 9 + k * 18, y + 45, 305, 'mcb']);
        wireStubs.push([x + 9 + k * 18, y - 45, 200, 'mcb']);
      }
      x += w;
    }
    p.add(B(x, x + 9, y - 25, y + 25, zR, zR + 40), 'grey', 'End stop');
    p.finish();
  }
  {
    // row C: climate control + interposing relays; lamp and door switch
    const p = part('auxDev');
    const y = rows.C;
    let x = xL + 10;
    for (const [w, h, d, mat, lab] of [[33, 75, 46, 'white', '-B1 thermostat (heater)'], [33, 75, 46, 'white', '-B2 hygrostat (heater)'], [18, 90, 70, 'grey', '-K21 heater relay']]) {
      p.add(RB(x + 1, x + w - 1, y - h / 2, y + h / 2, zR, zR + d, 3, 1), mat, lab);
      if (lab.startsWith('-B')) p.add(C(9, 9, 6, 'z', x + w / 2, y + 8, zR + d + 3), 'blue', 'Setting dial');
      wireStubs.push([x + w / 2, y + h / 2, 525, 'auxDev']);
      x += w + 3;
    }
    x = Math.max(x + 20, xL + 140);
    for (let i = 0; i < 4; i++) {
      p.add(RB(x + 1, x + 15.5, y - 40, y + 40, zR, zR + 30, 2, 1), 'grey', 'Relay socket');
      p.add(RB(x + 2, x + 14.5, y - 28, y + 28, zR + 30, zR + 68, 2, 1), 'plastic', `-K1${i + 1} interposing relay (plug-in)`);
      wireStubs.push([x + 8, y + 40, 525, 'auxDev']);
      x += 16.5;
    }
    p.add(RB(-110, 110, H - 20, H - 2, -95, -55, 4, 1), 'white', 'LED luminaire');
    p.add(B(-104, 104, H - 21, H - 20, -92, -58), 'yellow', 'Diffuser');
    p.add(RB(hw - 48, hw - 26, H - 50, H - 8, -62, -32, 3, 1), 'black', '-S10 door contact switch (lamp)');
    p.finish();
  }
  {
    // row B: terminal strips; shield + PE bar under them
    const p = part('terms');
    const y = rows.B;
    let x = xL + 10;
    const end = () => { p.add(B(x, x + 9.5, y - 30, y + 30, zR, zR + 42), 'grey', 'End bracket'); x += 9.5; };
    const strip = (n, w, h, d, mat, lab, test) => {
      for (let i = 0; i < n; i++) {
        p.add(B(x + 0.2, x + w - 0.2, y - h / 2, y + h / 2, zR, zR + d), mat, lab);
        if (test) p.add(B(x + 1, x + w - 1, y - 6, y + 6, zR + d, zR + d + 4), 'orange', 'Disconnect / test slider');
        if (i % 2 === 0) wireStubs.push([x + w / 2, y + h / 2, 160, 'terms']);
        x += w;
      }
    };
    end();
    p.add(B(x, x + 1, y + 32, y + 45, zR, zR + 30), 'white', 'Strip marker -X1');
    strip(Math.min(30, Math.floor((W - 330) / 5.2 * 0.45)), 5.2, 60, 47, 'termGrey', '-X1 control + bus-wire terminals (2.5 mm²)');
    end();
    p.add(B(x, x + 1, y + 32, y + 45, zR, zR + 30), 'white', 'Strip marker -X2');
    strip(8, 8.2, 70, 52, 'beige', '-X2 CT test-disconnect terminals (shorting jumpers)', true);
    p.add(B(xL + 10, x, y + 26, y + 29, zR + 52, zR + 55), 'steel', 'CT shorting jumper bar');
    end();
    p.add(B(x, x + 1, y + 32, y + 45, zR, zR + 30), 'white', 'Strip marker -X3');
    strip(6, 6.2, 66, 50, 'beige', '-X3 VT disconnect terminals', true);
    end();
    strip(3, 5.2, 60, 47, 'earth', 'PE terminals (green / yellow)');
    end();
    // shield + PE bar
    p.add(B(xL, xR, 38, 48, zP + 12, zP + 22), 'copper', 'Shield bar (cable screens bonded 360°)');
    for (const xx of [xL, xR - 10]) p.add(B(xx, xx + 10, 30, 56, zP, zP + 12), 'black', 'Bar insulator / stand-off');
    for (const xx of spread(xL + 40, xR - 40, Math.max(4, Math.round((xR - xL) / 70)))) p.add(B(xx - 8, xx + 8, 35, 51, zP + 22, zP + 30), 'zinc', 'Shield clamp');
    p.finish();
  }
  {
    // bus-wire plug connectors on both side walls, high up and in front of the vertical ducts
    const p = part('busWire');
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -hw + 2 : hw - 44, x1 = s < 0 ? -hw + 44 : hw - 2;
      p.add(RB(x0, x1, 525, 595, -330, -262, 3, 1), 'grey', 'Bus-wire plug connector (heavy-duty housing)');
      p.add(B(Math.min(x0, x1) + 6, Math.max(x0, x1) - 6, 600, 612, -322, -270), 'steel', 'Locking lever');
      p.add(C(9, 9, 15, 'z', s * (hw - 30), 555, -337.5), 'black', 'Bus-wire cable into the duct');
    }
    p.finish();
  }
  {
    // 10-pole coded plug connections on the floor (front right), and the 64-pole socket under the floor
    const p = part('plugs');
    for (let i = 0; i < 4; i++) {
      const x = 40 + i * 46;
      p.add(RB(x, x + 40, 2, 48, -330, -290, 3, 1), 'black', '10-pole coded plug connector');
      p.add(B(x + 4, x + 36, 48, 58, -326, -294), 'grey', 'Coding / latch');
      p.add(C(8, 8, 10, 'y', x + 20, -3, -310), 'rubber', 'Cable from the panel (through the floor)');
    }
    p.finish();
  }
  {
    const p = part('socket');
    p.add(RB(-80, 80, -40, -1, zB + 5, zB + 55, 4), 'black', '64-pole socket (fixed part)');
    p.add(B(-60, 60, -46, -40, zB + 12, zB + 48), 'grey', 'Plug guide');
    p.finish();
  }
  {
    // looms: door loom (in the door frame), loom from the hinge into the left duct, single wires into the ducts
    const g = new THREE.Group();
    g.userData.part = 'loom';
    g.userData.dir = new THREE.Vector3();
    const gd = new THREE.Group();
    gd.userData.part = 'loom';
    gd.userData.dir = new THREE.Vector3();
    doorFrame.add(gd);
    root.add(g);
    parts.loom = [g, gd];
    const pd = new PartBuilder(gd, mats);
    pd.add(TU([[rx - 88, ry + 40, -150], [rx - 100, ry + 100, -135], [-hw + 120, ry + 150, -110], [-hw + 66, 560, -60], [-hw + 58, 565, -45]], 11, 40, 10), 'black', 'Door loom (spiral-wrapped)');
    pd.finish();
    const pl = new PartBuilder(g, mats);
    pl.add(TU([[-hw + 58, 565, -52], [-hw + 58, 565, -150], [-hw + 56, 565, -290], [-hw + 52, 560, -345]], 11, 30, 10), 'black', 'Door loom into the duct');
    for (const [x, y0, y1] of wireStubs) {
      const a = Math.min(y0, y1), b = Math.max(y0, y1);
      pl.add(C(1.3, 1.3, b - a, 'y', x, (a + b) / 2, zR + 25, 5), 'blue', 'Single wire into the duct');
    }
    pl.finish();
  }

  // ------------------------------------------------------------------------------------------------ pose + views
  const pose = ({ex = 0, door = 1} = {}) => {
    hinge.rotation.y = -LV_DOOR_OPEN * door;
    for (const list of Object.values(parts)) for (const g of list) g.position.copy(g.userData.dir).multiplyScalar(ex);
  };
  pose({ex: 0, door: 1});
  // camera views (metres, scene coordinates) for this width; the open door swings to the front-left
  const m = (x, y, z) => [x / 1000, (y + Y0) / 1000, z / 1000];
  const th = LV_DOOR_OPEN;
  const relayOpen = (lx, lz) => [hingeX + (lx - hingeX) * Math.cos(-th) + (lz - hingeZ) * Math.sin(-th), hingeZ - (lx - hingeX) * Math.sin(-th) + (lz - hingeZ) * Math.cos(-th)];
  const [rcx, rcz] = relayOpen(rx, -100);
  const [rbx, rbz] = relayOpen(rx, -850); // a point behind the relay rear, where the camera looks from
  const k = W / 800;
  const views = {
    iso: {p: m(1100 * k - 100, 1000, 1850 * k), t: m(-150 * k, 300, 50)},
    front: {p: m(0, 330, 1700 * k + 300), t: m(0, 315, -150)},
    side: {p: m(-1650 * k - 250, 420, 120), t: m(0, 315, -150)},
    rear: {p: m(-600 * k, 700, -1300 * k - 200), t: m(0, 315, -200)},
    top: {p: m(60, 1650 * k + 350, 250), t: m(0, 300, -180)},
    relay: {p: m(rx + 150, ry + 90, 620), t: m(rx, ry, 10)},
    relayRear: {p: m(rbx + 150, ry + 220, rbz + 120), t: m(rcx, ry - 10, rcz)},
    inside: {p: m(160 * k, 430, 560 + 300 * k), t: m(0, 280, -330)},
    socket: {p: m(380, -120, 330), t: m(0, -10, -380)},
  };
  return {root, parts, pose, views, dims: {W, hw, H, DEP, ry, rx, cutW, cutH}};
}
