// Secondary equipment of the SION 3AE5 (operating instructions 9229 0025 100 0C, "Grundausstattung" and "Zusätzliche
// Ausstattung", p. 20–34), each device as its own part with its parts named, and the optional devices switchable.
// Positions follow the opened-mechanism drawings Fig. 17 / 18 (item numbers in the names) and are approximate; device
// shapes follow the device photos on p. 23–34 in simplified form. Relay-local axes as in breaker.js (mm, y up from the
// breaker base, z towards the operator, cover face at z = 169).
import * as THREE from 'three';
import {B, C, PartBuilder, RB, TU, spread} from './geom.js';

export const EQUIP_DEFAULT = {s1: '6', slot2: 'Y2', slot3: 'Y7', lv: 'X0', y8e: false, key: true, s12: true, heater: true};
export const SLOT_TYPES = ['none', 'Y2', 'Y4', 'Y6', 'Y7'];

const G_BASIC = 'Secondary equipment (basic)', G_OPT = 'Secondary equipment (option)', G_MECH = 'Operating mechanism';
export const DEVICE_PARTS = [
  {id: 'bkM1', name: '-M1 motor 3AY1411 (53)', grp: G_BASIC, dir: [-260, 120, 150]},
  {id: 'bkGear', name: 'Gear unit (57) + hand-crank coupling (57.2)', grp: G_MECH, dir: [-60, 60, 230]},
  {id: 'bkS21', name: '-S21 position switch 3AX4206-0A, motor control (54.2)', grp: G_BASIC, dir: [60, -40, 260]},
  {id: 'bkK1', name: '-K1 auxiliary contactor 3AY1420, anti-pumping (34)', grp: G_BASIC, dir: [0, 150, 250]},
  {id: 'bkS3', name: '-S3 position switch 3AX4206-0A, controls -K1 (54.3)', grp: G_BASIC, dir: [80, -40, 280]},
  {id: 'bkY9', name: '-Y9 closing solenoid 3AX1410 (52)', grp: G_BASIC, dir: [20, -60, 280]},
  {id: 'bkY1', name: '-Y1 1st shunt release 3AX1410 (51.1)', grp: G_BASIC, dir: [-40, 20, 300]},
  {id: 'bkS1', name: '-S1 auxiliary switch 3SV9273 / 3SV9274 (31)', grp: G_BASIC, dir: [-120, 180, 230]},
  {id: 'bkS4', name: '-S4 position switch 3AX4206-0A, "closing spring charged" (54.4)', grp: G_BASIC, dir: [100, -40, 300]},
  {id: 'bkS6', name: '-S6 breaker-tripped signal 3AX4206-0A (54.6)', grp: G_BASIC, dir: [-20, -60, 300]},
  {id: 'bkX0', name: '-X0 low-voltage interface 3AX1134, fixed part (32)', grp: G_BASIC, dir: [0, 120, 0]},
  {id: 'bkX0plug', name: '-X0 64-pole plug with grommet housing', grp: G_BASIC, dir: [0, 260, 40]},
  {id: 'bkStrip', name: 'Plug strip Q0-X1.1 … X1.3, 20–30-pole (alternative to -X0)', grp: G_BASIC, dir: [0, 200, 40]},
  {id: 'bkLoom', name: 'Internal wiring, plugs -X01 / -X02 (33.2)', grp: G_BASIC, dir: [0, 120, 120]},
  {id: 'bkY2', name: '-Y2 2nd shunt release 3AX1101 (51.2 / 51.3)', grp: G_OPT, dir: [-160, 0, 280]},
  {id: 'bkY4', name: '-Y4 / -Y5 c.t.-operated release 3AX1102 (51.2 / 51.3)', grp: G_OPT, dir: [-160, 0, 280]},
  {id: 'bkY6', name: '-Y6 c.t.-operated release 3AX1104, 0.1 Ws (51.2 / 51.3)', grp: G_OPT, dir: [-160, 0, 280]},
  {id: 'bkY7', name: '-Y7 undervoltage release 3AX1103 (51.2 / 51.3)', grp: G_OPT, dir: [-160, 0, 280]},
  {id: 'bkR1', name: '-R1 series resistor for -Y7 (59.6)', grp: G_OPT, dir: [-160, 120, 300]},
  {id: 'bkR01', name: '-R01 heater, anti-condensation (59.4)', grp: G_OPT, dir: [0, -120, 260]},
  {id: 'bkY8E', name: '-Y8E electrical closing lock-out 3AX1405 with -S5 (59.5)', grp: G_OPT, dir: [180, -40, 260]},
  {id: 'bkS12', name: '-S12 position switch 3AX4206-0A, mechanical interlock (54.1)', grp: G_OPT, dir: [40, -80, 260]},
  {id: 'bkKey', name: 'Key lock 3AX1437 with -S5 (59.3)', grp: G_OPT, dir: [-40, 60, 330]},
  {id: 'bkIndic', name: 'Indicator drives and operations counter (55.1, 56.3, 58)', grp: G_MECH, dir: [0, -60, 200]},
  {id: 'bkInterlock', name: 'Mechanical interlock plunger (59.2)', grp: G_MECH, dir: [0, -160, 120]},
];

// 64-pole -X0: what the sample circuit diagrams of the 3AE instructions (Fig. 59–63, non-binding) put on each pin
export const X0_PINS = {
  A1: '-M1 motor (+), via -S21', D16: '-M1 motor (−)',
  A2: '-Y9 closing solenoid (+), via -S1 11-12 and -K1', B2: '-Y9 closing solenoid (−), via -S12 if fitted',
  C2: '-Y1 1st shunt release (+), via -S1 23-24', D2: '-Y1 (−)', C3: '-Y1 coil monitoring point (trip-circuit supervision)',
  A3: '-Y2 2nd shunt release (+), via -S1 33-34', B3: '-Y2 (−)', D3: '-Y2 coil monitoring point',
  A4: '-Y4 c.t.-operated release', B4: '-Y4 c.t.-operated release', C4: '-Y6 low-energy release', D4: '-Y6 low-energy release',
  C5: '-Y7 undervoltage release supply', B5: '-Y7 via -R1 (return)', D5: '-S1 43-44 (with -Y7)',
  A5: 'closing lock-out (+) (3AE1 sample diagram)', B1: 'closing lock-out (−) (3AE1 sample diagram)',
  A7: '-S6 breaker tripped, 13', B7: '-S6 breaker tripped, 14',
  C7: '-S1 31 (NC 31-32)', D7: '-S1 32', A8: '-S1 41 (NC 41-42)', B8: '-S1 42',
  C8: '-S1 51 / 53 common', D8: '-S1 52 (NC)', D9: '-S1 54 (NO)', A9: '-S1 61 / 63 common', B9: '-S1 62 (NC)', C9: '-S1 64 (NO)',
  A10: '-S1 71 (12 + 12 only)', B10: '-S1 72', C10: '-S1 73', D10: '-S1 74', A11: '-S1 81', B11: '-S1 82', C11: '-S1 83', D11: '-S1 84',
  A12: '-S1 93', B12: '-S1 94', C12: '-S1 103', D12: '-S1 104', A13: '-S1 113', B13: '-S1 114',
};

// printed device markings (browser only): a small plane facing +z with the tag text
let LBL = null;
const HAS_DOM = typeof document !== 'undefined';
function lblMat(text, dark) {
  const key = `bkLbl_${text}_${dark ? 'd' : 'l'}`;
  if (!HAS_DOM || !LBL) return null;
  if (!LBL[key]) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = dark ? '#23282c' : '#f2f2ee'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = dark ? '#f2f2ee' : '#1f2427';
    g.font = '700 84px "IBM Plex Sans Condensed", "Arial Narrow", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 70, 240);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    LBL[key] = new THREE.MeshStandardMaterial({map: t, roughness: 0.6, clippingPlanes: LBL.__planes});
  }
  return key;
}
function marking(p, text, x0, x1, y0, y1, z, dark, label) {
  const k = lblMat(text, dark);
  if (!k) return;
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
  p.add(g, k, label || `Device marking ${text}`);
}

// microswitch 3AX4206-0A: body, 3 tab terminals, roller lever (front)
function microswitch(p, x0, y0, z0, tag) {
  marking(p, tag.split(' ')[0].replace(/^-/, ''), x0 + 0.5, x0 + 9.5, y0 + 0.8, y0 + 4.2, z0 + 20.1, true, `${tag}: device marking`);
  p.add(B(x0, x0 + 10, y0, y0 + 26, z0, z0 + 20), 'black', `${tag}: switch body 3AX4206-0A`);
  ['C', 'NO', 'NC'].forEach((t, i) => p.add(B(x0 + 1.2 + i * 2.9, x0 + 2.6 + i * 2.9, y0 + 26, y0 + 31, z0 + 7, z0 + 13), 'tinned', `${tag}: terminal ${t}`));
  // roller lever pivots at its top; pose() presses it in
  const g = new THREE.Group();
  g.userData.label = `${tag}: roller lever`;
  const lb = new PartBuilder(g, LBL);
  lb.add(B(-2, 2, -18, 0, 0, 1.2), 'steel', `${tag}: roller lever`);
  lb.add(C(3, 3, 4, 'x', 0, -18, 4.2, 12), 'zinc', `${tag}: roller (pressed by its cam)`);
  lb.finish();
  g.position.set(x0 + 5, y0 + 22, z0 + 20);
  p.group.add(g);
  p.add(C(1.4, 1.4, 11.6, 'x', x0 + 5, y0 + 18, z0 + 10, 8), 'zinc', `${tag}: fixing screw`);
  return g;
}

export function buildDevices({part, sub, rig, parts, MX, H, zCS}) {
  // markings register their textured materials into the builders' material dictionary
  LBL = MX;
  MX.__planes = MX.galv.clippingPlanes;
  // ---------------------------------------------------------------- motor -M1 3AY1411 (53)
  {
    const p = part('bkM1');
    p.add(C(30, 30, 100, 'x', -95, 360, zCS, 28), 'blue', '-M1 motor housing 3AY1411');
    for (const x of spread(-135, -60, 6)) p.add(C(31.5, 31.5, 3, 'x', x, 360, zCS, 28), 'blue', '-M1 housing ribs');
    p.add(C(24, 24, 6, 'x', -148, 360, zCS, 24), 'black', '-M1 end shield (commutator side)');
    for (const s of [-1, 1]) p.add(C(5, 5, 6, 'y', -138, 360 + s * 33, zCS, 12), 'black', '-M1 brush-holder cap');
    p.add(C(34, 34, 5, 'x', -47.5, 360, zCS, 28), 'galvDark', '-M1 mounting flange on the gear unit');
    p.add(C(9, 9, 20, 'x', -35, 360, zCS, 14), 'steel', '-M1 pinion');
    marking(p, 'M1', -105, -85, 355, 365, zCS + 30.6, true, '-M1 device marking');
    p.add(TU([[-110, 390, zCS + 8], [-112, 402, zCS + 12], [-100, 412, zCS + 14]], 2.2, 10, 6), 'red', '-M1 lead (+) to -S21 / -X0:A1');
    p.add(TU([[-100, 390, zCS - 8], [-102, 402, zCS - 12], [-90, 412, zCS - 14]], 2.2, 10, 6), 'blue', '-M1 lead (−) to -X0:D16');
    p.finish();
    rig.motorRotor = sub('bkM1', 'Motor rotor (spins while charging)', (b) => b.add(B(-1, 1, -20, 20, -4, 4), 'zinc', 'rotor mark'));
    rig.motorRotor.position.set(-152, 360, zCS);
  }
  // ---------------------------------------------------------------- gear unit (57), hand-crank coupling (57.2)
  {
    const p = part('bkGear');
    p.add(B(-25, 25, 245, 395, 25, 118), 'galvDark', 'Gear unit (57)');
    for (const [y, z] of [[255, 35], [255, 108], [385, 35], [385, 108]]) p.add(C(3, 3, 3, 'x', 26.5, y, z, 10), 'zinc', 'Gear unit housing screw');
    p.add(C(12, 12, 22, 'z', 0, 360, 129, 6), 'steel', 'Hand-crank coupling (57.2): crank 3AX1530-4B clockwise');
    p.add(C(15, 15, 4, 'z', 0, 360, 120, 20), 'zinc', 'Slip clutch of the coupling (uncouples when the motor runs)');
    p.finish();
  }
  // ---------------------------------------------------------------- position switches
  {
    const p = part('bkS21'); (rig.ms ||= {}).S21 = microswitch(p, 95, 120, 100, '-S21 (54.2) motor cut-off'); p.finish();
  }
  {
    const p = part('bkS3'); rig.ms.S3 = microswitch(p, 107, 120, 100, '-S3 (54.3) control of -K1'); p.finish();
  }
  {
    const p = part('bkS4'); rig.ms.S4 = microswitch(p, 119, 120, 100, '-S4 (54.4) "closing spring charged"'); p.finish();
  }
  {
    const p = part('bkS6'); rig.ms.S6 = microswitch(p, -12, 120, 100, '-S6 (54.6) breaker tripped'); p.finish();
  }
  {
    const p = part('bkS12'); rig.ms.S12 = microswitch(p, 62, 120, 100, '-S12 (54.1) mechanical interlock'); p.finish();
  }
  // ---------------------------------------------------------------- -K1 auxiliary contactor 3AY1420 (34)
  {
    const p = part('bkK1');
    p.add(B(-25, 20, 410, 414, 50, 120), 'galvDark', '-K1 mounting plate');
    p.add(B(-22, 17, 414, 476, 58, 112), 'grey', '-K1 contactor housing 3AY1420');
    p.add(B(-14, 9, 438, 454, 112, 113), 'black', '-K1 coil window (A1-A2)');
    marking(p, 'K1', -12, 7, 440, 452, 113.1, true, '-K1 device marking');
    p.add(B(-22, 17, 476, 480, 62, 108), 'black', '-K1 auxiliary contact block');
    const tl = [['A1', 'coil +'], ['13', 'NO 13-14, self-hold'], ['21', 'NC 21-22 in the -Y9 circuit'], ['31', 'NC 31-32 in the -Y9 circuit'], ['A2', 'coil −'], ['14', 'NO 13-14'], ['22', 'NC 21-22'], ['32', 'NC 31-32']];
    tl.forEach(([n, f], i) => p.add(C(3, 3, 3, 'z', -16 + (i % 4) * 10, i < 4 ? 468 : 422, 113.5, 12), 'zinc', `-K1 terminal ${n}: ${f}`));
    p.add(B(-25, 20, 470, 480, 120, 126), 'black', '-K1 terminal strip');
    p.finish();
  }
  // ---------------------------------------------------------------- -Y9 closing solenoid (52)
  {
    const p = part('bkY9');
    p.add(B(-5, 35, 160, 163, 100, 135), 'steel', '-Y9 yoke (bottom)');
    p.add(B(-5, 35, 202, 205, 100, 135), 'steel', '-Y9 yoke (top)');
    p.add(B(-5, -2, 163, 202, 100, 135), 'steel', '-Y9 yoke (side)');
    p.add(B(32, 35, 163, 202, 100, 135), 'steel', '-Y9 yoke (side)');
    p.add(C(13, 13, 36, 'y', 15, 182.5, 117.5, 24), 'copper', '-Y9 coil 3AX1410 (300–370 W/VA, short-time rated)');
    p.add(C(4, 4, 3, 'z', 25, 196, 136.5, 12), 'blue', '-Y9 varistor (versions ≥ 60 V DC)');
    marking(p, 'Y9', 3, 19, 166, 174, 135.2, false, '-Y9 device marking');
    for (const x of [6, 24]) p.add(B(x - 2, x + 2, 205, 211, 110, 114), 'tinned', '-Y9 terminal (-X0:A2 / B2 circuit)');
    p.finish();
    rig.plungerClose = sub('bkY9', 'Closing solenoid plunger', (b) => {
      b.add(C(6, 6, 20, 'y', 0, 0, 0), 'zinc', '-Y9 plunger: pulled up into the coil when energised');
      b.add(C(2.5, 2.5, 62, 'y', 0, 41, 0, 10), 'steel', '-Y9 push pin: through the core and the top yoke onto the release arm');
    });
    rig.plungerClose.position.set(15, 150, 117);
  }
  // ---------------------------------------------------------------- -Y1 1st shunt release (51.1)
  {
    const p = part('bkY1');
    p.add(C(14, 14, 28, 'z', -20, 225, 118, 24), 'copper', '-Y1 coil 3AX1410 (300–370 W/VA, short-time rated)');
    p.add(B(-38, -2, 207, 243, 100, 104), 'steel', '-Y1 rear yoke plate');
    p.add(B(-38, -2, 207, 243, 132, 135), 'steel', '-Y1 front yoke plate');
    for (const y of [210, 240]) p.add(B(-38, -2, y - 3, y, 104, 132), 'steel', '-Y1 yoke bar');
    p.add(C(4, 4, 3, 'z', -30, 236, 136.5, 12), 'blue', '-Y1 varistor (versions ≥ 60 V DC)');
    marking(p, 'Y1', -36, -22, 211, 219, 135.1, false, '-Y1 device marking');
    for (const y of [218, 232]) p.add(B(-41, -38, y - 3, y + 3, 112, 118), 'tinned', '-Y1 terminal (-X0:C2 / D2 circuit)');
    p.finish();
    rig.plungerOpen = sub('bkY1', 'Shunt release armature', (b) => b.add(C(6, 6, 16, 'z', 0, 0, 0), 'zinc', '-Y1 armature: strikes the opening latch'));
    rig.plungerOpen.position.set(-20, 225, 92);
  }
  // ---------------------------------------------------------------- -S1 auxiliary switch (31), 6 + 6 and the second row for 12 + 12
  const s1Row2 = new THREE.Group();
  {
    const p = part('bkS1');
    const row = (pb, y0, k0) => {
      pb.add(B(-175, -35, y0, y0 + 50, 40, 58), 'galvDark', `-S1 mounting bracket (elements ${k0}–${k0 + 5})`);
      for (let k = k0; k < k0 + 6; k++) {
        const x0 = -175 + (k - k0) * (140 / 6);
        pb.add(B(x0 + 1, x0 + 22, y0 + 2, y0 + 48, 58, 118), 'grey', `-S1 contact element ${k}: NC ${k}1-${k}2 (closed with the breaker OFF), NO ${k}3-${k}4 (closed with the breaker ON)`);
        for (const [dx, dy, n, f] of [[7, 38, 1, 'NC'], [16, 38, 2, 'NC'], [7, 12, 3, 'NO'], [16, 12, 4, 'NO']]) pb.add(C(2.6, 2.6, 3, 'z', x0 + dx, y0 + dy, 119.5, 10), 'zinc', `-S1 terminal ${k}${n} (${f} ${k}${f === 'NC' ? 1 : 3}-${k}${f === 'NC' ? 2 : 4})`);
      }
    };
    row(p, 420, 1);
    marking(p, 'S1', -172, -154, 441, 449, 118.1, true, '-S1 device marking');
    p.finish();
    rig.s1Lever = sub('bkS1', '-S1 switching shaft and operating lever', (b) => {
      b.add(C(6, 6, 15, 'x', -0.5, 0, 0, 6), 'steel', '-S1 switching shaft (hexagon), turned by the coupling rod');
      b.add(B(-6, 6, -4, 4, 0, 12), 'steel', '-S1 operating lever');
    });
    rig.s1Lever.position.set(-182, 445, 80);
    rig.s1Rod = sub('bkS1', '-S1 coupling rod', (b) => b.add(C(3.5, 3.5, 1, 'y', 0, 0.5, 0, 10), 'steel', '-S1 coupling rod: the main-shaft crank moves it'));
    s1Row2.userData.label = '-S1 second row (3SV9274, 12 NO + 12 NC)';
    const p2 = new PartBuilder(s1Row2, MX);
    row(p2, 476, 7);
    p2.finish();
    parts.bkS1.add(s1Row2);
  }
  // ---------------------------------------------------------------- -X0 fixed part + 64 pins, plug, plug-strip alternative
  {
    const p = part('bkX0');
    p.add(B(-75, 75, H, H + 10, 40, 110), 'grey', '-X0 fixed housing 3AX1134 on the top plate');
    p.add(B(-64, 64, H + 10, H + 16, 50, 100), 'black', '-X0 contact insert, 64 pins in 4 rows A–D × 16');
    marking(p, 'X0', -12, 12, H + 1, H + 9, 110.1, false, '-X0 device marking');
    ['A', 'B', 'C', 'D'].forEach((r, ri) => {
      for (let n = 1; n <= 16; n++) {
        const id = `${r}${n}`;
        p.add(C(1.1, 1.1, 10, 'y', -56.25 + (n - 1) * 7.5, H + 21, 57 + ri * 12, 8), 'tinned', `-X0 pin ${id}: ${X0_PINS[id] || 'not used in the sample diagram'}`);
      }
    });
    for (const s of [-1, 1]) p.add(TU([[s * 70, H + 8, 55], [s * 82, H + 30, 75], [s * 70, H + 46, 95]], 3, 12, 6), 'steel', '-X0 locking bow');
    p.finish();
  }
  {
    const p = part('bkX0plug');
    p.add(RB(-70, 70, H + 16.5, H + 52, 45, 105, 5, 2), 'black', '-X0 plug, grommet housing (crimp contacts 1.5–2.5 mm²)');
    p.add(C(14, 14, 22, 'z', 0, H + 35, 116, 16), 'black', '-X0 cable gland');
    p.add(TU([[0, H + 35, 127], [0, H + 40, 160], [0, H + 70, 200]], 10, 16, 10), 'cable', 'Control cable to the panel LV socket');
    p.finish();
  }
  {
    const p = part('bkStrip');
    [['Q0-X1.1', -75], ['Q0-X1.2', -22], ['Q0-X1.3', 31]].forEach(([n, x0]) => {
      p.add(B(x0, x0 + 45, H, H + 14, 50, 100), 'grey', `${n} plug-strip header`);
      p.add(B(x0 + 2, x0 + 43, H + 14, H + 34, 52, 98), 'grey', `${n} plug, WAGO 231-110/026-000 spring terminals 1.5–2.5 mm²`);
      for (const x of spread(x0 + 5, x0 + 40, 10)) p.add(B(x - 1.2, x + 1.2, H + 34, H + 37, 60, 72), 'orange', `${n} release lever (insert a 0.5 × 3 mm slotted screwdriver)`);
    });
    p.add(B(-80, 80, H, H + 3, 105, 140), 'galvDark', 'Cable bracket (60) for the plug-strip version');
    p.add(B(-80, 80, H + 3, H + 42, 137, 140), 'galvDark', 'Cable bracket (60) for the plug-strip version');
    for (const x of [-60, 60]) p.add(C(3, 3, 3, 'y', x, H + 4.5, 122, 10), 'zinc', 'Torx 20 self-tapping screw, 3 Nm, single use');
    p.finish();
  }
  {
    const p = part('bkLoom');
    p.add(TU([[30, H - 14, 75], [42, H - 40, 80], [45, 470, 80], [45, 412, 80]], 8, 20, 8), 'black', 'Internal wiring loom from -X0 to the devices');
    p.add(B(200, 245, 420, 470, 50, 110), 'grey', 'Plugs -X01 / -X02 for the cassette position switches (33.2)');
    p.add(B(-60, 20, 485, 520, 128, 138), 'galvDark', 'Position for the plug strip Q0-X1 (33), blank');
    p.finish();
  }
  // ---------------------------------------------------------------- releases 3AX11 in slots 51.2 and 51.3, resistor -R1
  const SLOTS = {slot2: [-95, -45], slot3: [-150, -100]};
  const slotGroups = {};
  const release = (id, type) => {
    const meta = DEVICE_PARTS.find((d) => d.id === id);
    for (const [slot, [x0, x1]] of Object.entries(SLOTS)) {
      const g = new THREE.Group();
      g.userData.label = `${meta.name} in ${slot === 'slot2' ? '51.2' : '51.3'}`;
      const pb = new PartBuilder(g, MX);
      const xc = (x0 + x1) / 2;
      const tag = type === 'Y4' && slot === 'slot3' ? '-Y5' : `-${type}`;
      const what = {Y2: '2nd shunt release 3AX1101 (energy store, 10 W/VA)', Y4: 'c.t.-operated release 3AX1102 (energy store, trips at 90 % of rated current)', Y6: 'c.t.-operated release 3AX1104, 0.1 Ws (low-energy)', Y7: 'undervoltage release 3AX1103 (20 W/VA, holds while energised)'}[type];
      pb.add(B(x0, x1, 195, 300, 95, 135), 'grey', `${tag} ${what}`);
      for (const [x, y] of [[x0 + 14, 272], [x1 - 14, 246]]) pb.add(C(2.2, 2.2, 1.5, 'z', x, y, 135.75, 10), 'steel', `${tag} housing rivet`);
      pb.add(B(x0 + 10, x1 - 10, 205, 217, 135, 135.5), 'white', `${tag} type label`);
      marking(pb, tag.slice(1), x0 + 11, x1 - 11, 206, 216, 135.6, false, `${tag} device marking`);
      pb.add(B(x0 + 10, x1 - 10, 300, 312, 102, 128), 'black', `${tag} terminal block`);
      for (const x of [x0 + 18, x1 - 18]) pb.add(C(2.5, 2.5, 3, 'y', x, 313.5, 115, 10), 'zinc', `${tag} terminal screw`);
      pb.add(C(3, 3, 9, 'y', xc, 190.5, 115, 10), 'zinc', `${tag} striker: hits the trip bar, which frees the opening latch`);
      if (type !== 'Y6') pb.add(B(x0 + 4, x0 + 14, 284, 296, 135, 139), 'black', `${tag} rectifier (versions ≥ 100 V AC/DC${type === 'Y4' ? ', always on -Y4 / -Y5' : ''})`);
      if (type === 'Y2' || type === 'Y7') pb.add(C(4, 4, 3, 'z', xc + 8, 230, 136.5, 12), 'blue', `${tag} varistor (versions ≥ 60 V DC)`);
      if (type === 'Y7') {
        pb.add(C(2.5, 2.5, 0.6, 'z', xc - 9, 258, 135.3, 10), 'black', '-Y7 position A: transport lock of the striker');
        pb.add(C(2.5, 2.5, 0.6, 'z', xc + 9, 258, 135.3, 10), 'black', '-Y7 position B: operating position');
        marking(pb, 'A', xc - 13, xc - 5, 262, 268, 135.6, false, '-Y7 position A (transport)');
        marking(pb, 'B', xc + 5, xc + 13, 262, 268, 135.6, false, '-Y7 position B (operation)');
        const sg = new THREE.Group();
        sg.userData.label = '-Y7 striker locking screw';
        const sb = new PartBuilder(sg, MX);
        sb.add(C(3.2, 3.2, 4, 'z', 0, 258, 137.6, 6), 'steel', '-Y7 striker locking screw: move from A to B before commissioning');
        sb.finish();
        g.add(sg);
        (rig.y7Screws ||= []).push({g: sg, xA: xc - 9, xB: xc + 9});
      }
      pb.finish();
      parts[id].add(g);
      (slotGroups[id] ||= {})[slot] = g;
    }
  };
  for (const [id, t] of [['bkY2', 'Y2'], ['bkY4', 'Y4'], ['bkY6', 'Y6'], ['bkY7', 'Y7']]) { part(id).finish(); release(id, t); }
  {
    part('bkR1').finish();
    for (const [slot, [x0, x1]] of Object.entries(SLOTS)) {
      const g = new THREE.Group();
      g.userData.label = `-R1 above ${slot === 'slot2' ? '51.2' : '51.3'}`;
      const pb = new PartBuilder(g, MX);
      const xc = (x0 + x1) / 2;
      pb.add(B(x0 + 3, x1 - 3, 312, 314, 104, 132), 'galvDark', '-R1 bracket');
      for (const z of [111, 125]) {
        pb.add(C(6, 6, 36, 'x', xc, 321, z, 16), 'white', '-R1 series resistor of -Y7 (1 or 2 depending on the voltage), ceramic tube');
        for (const s of [-1, 1]) pb.add(C(6.6, 6.6, 4, 'x', xc + s * 18, 321, z, 16), 'steel', '-R1 end cap');
      }
      pb.finish();
      parts.bkR1.add(g);
      (slotGroups.bkR1 ||= {})[slot] = g;
    }
  }
  // ---------------------------------------------------------------- heater -R01 (59.4)
  {
    const p = part('bkR01');
    p.add(B(-70, 70, 14, 40, 95, 140), 'black', '-R01 heater, 50 W 230 V AC (110 V option), surface ≈ 180 °C');
    for (const x of spread(-60, 60, 9)) p.add(B(x - 1, x + 1, 40, 46, 100, 135), 'galv', '-R01 heater fins');
    for (const x of [-50, 50]) p.add(B(x - 6, x + 6, 12, 14, 100, 135), 'galvDark', '-R01 mounting bracket');
    for (const x of [-30, 30]) p.add(B(x - 3, x + 3, 22, 30, 140, 144), 'tinned', '-R01 terminal');
    p.add(B(-20, 20, 24, 32, 140, 140.5), 'yellow', '-R01 warning: hot surface');
    marking(p, 'R01', -62, -38, 22, 32, 140.1, true, '-R01 device marking');
    p.finish();
  }
  // ---------------------------------------------------------------- -Y8E electrical closing lock-out with -S5 (59.5)
  {
    const p = part('bkY8E');
    p.add(B(150, 190, 160, 215, 95, 135), 'grey', '-Y8E closing lock-out magnet 3AX1405: releases closing only with control voltage');
    p.add(B(158, 182, 175, 200, 135, 136), 'black', '-Y8E coil window');
    marking(p, 'Y8E', 160, 180, 182, 193, 136.1, true, '-Y8E device marking');
    for (const x of [157, 183]) p.add(B(x - 2, x + 2, 215, 221, 110, 114), 'tinned', '-Y8E terminal');
    p.add(C(4, 4, 10, 'y', 170, 155, 115, 12), 'zinc', '-Y8E locking bolt: without voltage it blocks hand and electrical closing');
    microswitch(p, 192, 170, 100, '-S5 (with -Y8E)');
    p.finish();
  }
  // ---------------------------------------------------------------- key lock 3AX1437 with -S5 (59.3)
  {
    const p = part('bkKey');
    p.add(C(9, 9, 50, 'z', -25, 305, 147, 20), 'steel', 'Key lock 3AX1437, lock cylinder (59.3)');
    p.add(C(3, 3, 1, 'z', -25, 305, 172.5, 10), 'black', 'Key lock keyway');
    p.add(B(-35, -15, 290, 298, 122, 132), 'steel', 'Key lock cam: blocks the closing latch');

    rig.ms.S5k = microswitch(p, -44, 316, 120, '-S5 (with the key lock)');
    p.finish();
    rig.key = sub('bkKey', 'Key', (b) => {
      b.add(B(-2, 2, -10, 10, 0, 9), 'zinc', 'Key (vertical = locked, removable only then; horizontal = unlocked)');
      b.add(RB(-11, 11, -6, 6, 9, 13, 3, 1), 'zinc', 'Key bow');
    });
    rig.key.position.set(-25, 305, 173);
  }
  // ---------------------------------------------------------------- indicator drives and counter
  {
    const p = part('bkIndic');
    p.add(B(-95, -55, 145, 175, 118, 148), 'black', 'Operations counter (58), 5 digits, one count per ON + OFF');
    p.add(B(-50, -20, 140, 180, 118, 148), 'black', 'Position indicator drive (56.3), linked to the main shaft');
    p.add(B(45, 75, 165, 205, 136, 148), 'black', 'Spring state indicator drive (55.1), linked to the charging crank');
    p.finish();
  }
  // ---------------------------------------------------------------- mechanical interlock plunger (59.2)
  {
    const p = part('bkInterlock');
    p.add(C(3, 3, 106, 'y', 82, 65, 110, 10), 'zinc', 'Mechanical interlock plunger (59.2): lifted 5–10 mm by the panel with the breaker OFF, blocks closing');
    p.add(B(73, 84, 116, 120, 104, 116), 'steel', 'Interlock blocking lever (acts on the closing latch, and on -S12 if fitted)');
    p.finish();
  }

  // ---------------------------------------------------------------- equipment variants
  const setEquip = (eq0 = {}) => {
    const eq = {...EQUIP_DEFAULT, ...eq0};
    s1Row2.visible = eq.s1 === '12';
    for (const id of ['bkY2', 'bkY4', 'bkY6', 'bkY7']) {
      let any = false;
      for (const slot of ['slot2', 'slot3']) { const on = eq[slot] === id.slice(2); slotGroups[id][slot].visible = on; any ||= on; }
      parts[id].visible = any;
    }
    let r1 = false;
    for (const slot of ['slot2', 'slot3']) { const on = eq[slot] === 'Y7'; slotGroups.bkR1[slot].visible = on; r1 ||= on; }
    parts.bkR1.visible = r1;
    parts.bkX0.visible = parts.bkX0plug.visible = eq.lv === 'X0';
    parts.bkStrip.visible = eq.lv === 'strip';
    parts.bkY8E.visible = !!eq.y8e;
    parts.bkKey.visible = !!eq.key;
    parts.bkS12.visible = !!eq.s12;
    parts.bkR01.visible = !!eq.heater;
    return eq;
  };
  return setEquip;
}

// ------------------------------------------------------------------------------------------------ descriptions
// BA5 = SION operating instructions 9229 0025 100 0C (02.2020, German); CB = older 3AE instructions 9229 0001 176 0E
// (sample circuit diagrams Fig. 59–63, non-binding: the order-specific circuit diagram governs).
export const DEVICE_INFO = {
  bkM1: {
    tag: '-M1', title: 'Motor for charging the closing spring', pn: '3AY1411-..', kind: 'Basic', where: 'Upper left of the drive (53), flanged to the gear unit (57).',
    summary: 'Charges the closing spring through the gear unit as soon as supply voltage is present and the spring is discharged; -S21 switches it off once the spring has latched. Charging < 15 s, ≥ 60 s between two charges.',
    does: 'Charges the closing spring so that one closing (and, with the opening spring charged by the closing, OFF – ON – OFF) is always stored.',
    how: 'The motor starts as soon as supply voltage is applied with the spring discharged and is switched off internally after charging (-S21). During the short charging time it runs in its overload range, so it needs at least 60 s between two charging operations. After every closing it recharges the spring at once. Without supply the spring is charged with the hand crank 3AX1530-4B on the coupling 57.2; the crank has a slip clutch and uncouples when the motor voltage returns.',
    data: [['Power', '24 V DC 140 W · 30 V DC 180 W · 48 V DC 110 W · 60 V DC 130 W · 110 V DC 100 W · 110 V AC 170 VA · 120 V DC 110 W / AC 210 VA · 125 V DC 120 W · 220 V DC 110 W · 230 V AC 200 VA · 240 V DC 130 W / AC 200 VA (±50 W, empirical)'],
      ['Supply tolerance', '-15 % … +10 % of the rated supply voltage'], ['Charging time', '< 15 s'], ['Pause', '≥ 60 s between charging operations'],
      ['Motor protection (not supplied)', 'MCB with C characteristic: 24 V DC 2 A · 48 V DC 1 A · 60 V DC 1 A · 110 V DC 0.5 A · 110 V AC 0.315 A · 220 V DC 0.315 A · 230 V AC 0.25 A']],
    circuit: '-X0:A1 → -S21 → -M1 → -X0:D16 (the 3AE sample diagram also shows a second cut-off switch -S22 in series).',
    notes: 'Protect the motor circuit separately; a missing pause after repeated charging overloads the motor.',
  },
  bkGear: {
    tag: '57 / 57.2', title: 'Gear unit and hand-crank coupling', pn: '—', kind: 'Basic', where: 'Centre of the drive, on the charging shaft; coupling behind the cover opening 57.1.',
    summary: 'Reduces the motor speed onto the charging shaft. The hand crank 3AX1530-4B fits the coupling 57.2 through the cover opening; clockwise until the spring indicator shows CHARGED.',
    does: 'Transmits the motor torque to the charging shaft; lets the spring be charged by hand.',
    how: 'Push the crank with its adapter forward through the opening onto the coupling and turn clockwise until the spring indicator changes, then take the crank out. The crank\'s slip clutch protects you if the motor starts; use only the original crank.',
    data: [['Hand crank', '3AX1530-4B, slip clutch'], ['Direction', 'clockwise']], circuit: '—', notes: 'Never use a crank without a slip clutch: it turns with the motor if supply returns.',
  },
  bkS21: {
    tag: '-S21', title: 'Position switch for motor control', pn: '3AX4206-0A', kind: 'Basic', where: 'Bottom right of the drive, next to the spring state indicator (54.2).',
    summary: 'Switches the motor off when the closing spring is charged and on again when it has been discharged by a closing.',
    does: 'Motor cut-off.', how: 'Its roller lever is actuated by the charging mechanism: the contact in the motor circuit opens when the spring has latched in the charged position.',
    data: [['Type', 'microswitch 3AX4206-0A with roller lever']], circuit: 'In series with -M1 between -X0:A1 and -X0:D16 (contacts 21-22 in the sample diagram).', notes: '',
  },
  bkK1: {
    tag: '-K1', title: 'Auxiliary contactor: electrical anti-pumping', pn: '3AY1420-..', kind: 'Basic', where: 'Top centre of the drive (34), right of -S1.',
    summary: 'Electrical anti-pumping: with ON and OFF commands applied together and held, the breaker opens again after closing and stays open until a new ON command. Mechanical anti-pumping is also built in.',
    does: 'Prevents repeated closing and opening ("pumping") under a standing close command, and switches off the closing solenoid circuit.',
    how: 'If a permanent ON and OFF command are present at the same time, the breaker returns to OFF after closing. -K1, controlled by -S3, picks up and holds itself through its NO contact 13-14 as long as the ON command stays; its NC contacts 21-22 and 31-32 in the -Y9 circuit stay open, so -Y9 cannot be energised again. Only when the ON command is removed and given again can the breaker close. The mechanism also has a mechanical anti-pumping device (part of the basic equipment).',
    data: [['Terminals', 'A1-A2 coil · 13-14 NO (self-hold) · 21-22 and 31-32 NC in the closing circuit']], circuit: 'Closing circuit: -X0:A2 → -S1 11-12 → -K1 21-22 → -K1 31-32 → -Y9 → (-S12) → -X0:B2; -K1 coil fed via -S3 21-22, held via -K1 13-14.', notes: '',
  },
  bkS3: {
    tag: '-S3', title: 'Position switch controlling -K1', pn: '3AX4206-0A', kind: 'Basic', where: 'Bottom right of the drive (54.3).',
    summary: 'Opens when the closing spring is charged; controls the anti-pumping contactor -K1.',
    does: 'Arms the anti-pumping relay after a closing.', how: 'While the spring is discharged (just after a closing) -S3 is closed and lets -K1 pick up from a standing ON command; once the spring is charged again -S3 opens.',
    data: [['Type', 'microswitch 3AX4206-0A']], circuit: 'Contacts 21-22 in the -K1 coil circuit (sample diagram).', notes: '',
  },
  bkY9: {
    tag: '-Y9', title: 'Closing solenoid', pn: '3AX1410-.. (power 3AY1410)', kind: 'Basic', where: 'Centre of the drive (52), below the gear unit; it acts on the closing latch at the right through the closing release shaft.',
    summary: 'Unlatches the charged closing spring and closes the breaker electrically. Short-time rated, switched off inside the breaker by -S1; 300–370 W/VA; minimum command 45 ms.',
    does: 'Electrical closing.', how: 'When energised the coil pulls its plunger up into the core; the push pin on the plunger comes out through the top yoke and lifts an arm of the closing release shaft. The shaft turns about 30° and, through its arm and a parallel link, swings the closing latch away from the crank pin (the ON button turns the same shaft by hand). The closing spring then turns the crank and cam and closes the breaker. The latch only holds a charged spring: with the spring discharged -Y9 moves the latch but nothing happens. (Release shaft, arms and link are drawn; Siemens only states that -Y9 frees the closing latch.) The solenoid is not rated for continuous duty: the auxiliary switch -S1 (11-12, open when the breaker is ON) cuts it off inside the breaker. Available for DC or AC.',
    data: [['Power', '300–370 W/VA'], ['Supply tolerance', '-15 % … +10 %'], ['Minimum command duration', '45 ms'], ['Closing time', '≤ 60 ms'], ['Protection', 'varistor on versions ≥ 60 V DC']],
    circuit: '-X0:A2 → -S1 11-12 → -K1 21-22, 31-32 → -Y9 → -S12 (if fitted) → -X0:B2.', notes: 'Hold the ON command until the breaker shows and signals ON.',
  },
  bkY1: {
    tag: '-Y1', title: '1st shunt release', pn: '3AX1410-.. (power 3AY1410)', kind: 'Basic', where: 'Centre left of the drive (51.1).',
    summary: 'Direct-acting armature on the OFF latch: the electrical trip impulse opens the breaker. Short-time rated, cut off by -S1; 300–370 W/VA; minimum command 40 ms; opening ≤ 30 ms.',
    does: 'Electrical opening (protection trip, remote OFF).', how: 'The trip impulse pulls the magnet armature, which strikes the OFF latch directly (no energy store): the opening springs open the breaker. -S1 23-24 (closed only with the breaker ON) cuts the coil off.',
    data: [['Power', '300–370 W/VA'], ['Supply tolerance', 'DC -30 % … +10 % · AC -15 % … +10 %'], ['Minimum command duration', '40 ms'], ['Opening / break time', '≤ 30 ms / ≤ 45 ms'], ['Protection', 'varistor on versions ≥ 60 V DC']],
    circuit: '-X0:C2 → -S1 23-24 → -Y1 → -X0:D2; -X0:C3 = monitoring point between -S1 and -Y1 for trip-circuit supervision.', notes: '-S6 gives a fleeting "tripped" contact > 10 ms after a -Y1 trip.',
  },
  bkS1: {
    tag: '-S1', title: 'Auxiliary switch', pn: '3SV9273-.. (6 NO + 6 NC) or 3SV9274-.. (12 NO + 12 NC)', kind: 'Basic', where: 'Top left of the drive (31), driven from the main shaft by a coupling rod.',
    summary: 'Contacts that follow the breaker position: 6 NO + 6 NC or 12 NO + 12 NC. Some cut off -Y9 / -Y1 internally, the rest are free for the customer (see the circuit diagram).',
    does: 'Position signalling and internal switching of the closing and trip coils.', how: 'A coupling rod from the main shaft turns the hexagon switching shaft through all contact elements. Each element has an NC pair (x1-x2, closed with the breaker OFF) and an NO pair (x3-x4, closed with the breaker ON). The 12 + 12 version adds six elements (71 … 124).',
    data: [['Rated insulation voltage', '250 V AC/DC, insulation group C (VDE 0110)'], ['Continuous current', '10 A'], ['Making capacity', '50 A'],
      ['Breaking capacity (resistive / inductive T = 20 ms)', '230 V AC 10 / 10 A · 24 V DC 10 / 10 A · 48 V DC 10 / 9 A · 60 V DC 9 / 7 A · 110 V DC 5 / 4 A · 220 V DC 2.5 / 2 A']],
    circuit: 'Used internally: 11-12 (-Y9), 23-24 (-Y1), 33-34 (-Y2), 43-44 (-Y7). Free (sample): 31-32 C7/D7, 41-42 A8/B8, 51-52 C8/D8, 53-54 C8/D9, 61-62 A9/B9, 63-64 A9/C9; 12 + 12 adds 71 … 114 on A10 … B13.', notes: 'Check every contact electrically in both end positions at commissioning.',
  },
  bkS4: {
    tag: '-S4', title: 'Position switch "closing spring charged"', pn: '3AX4206-0A', kind: 'Basic', where: 'Bottom right of the drive (54.4).',
    summary: 'Signals the spring state; opens when the closing spring is charged (as -S3).',
    does: 'Remote indication "closing spring charged / discharged", e.g. to a binary input of the protection device.', how: 'Actuated by the charging mechanism together with the mechanical spring indicator 55.1.',
    data: [['Type', 'microswitch 3AX4206-0A']], circuit: 'Pins per the order-specific diagram (not shown in the sample diagrams).', notes: '',
  },
  bkS6: {
    tag: '-S6', title: 'Breaker-tripped signal', pn: '3AX4206-0A', kind: 'Basic', where: 'Bottom centre of the drive (54.6).',
    summary: 'Gives a short (fleeting) contact when the breaker is opened by an electrical release; usable as a trip signal.',
    does: 'Signals a trip by a release (as opposed to a normal OFF).', how: 'Momentarily closes when a release trips the breaker.',
    data: [['Shortest pulse', '> 10 ms with -Y1 · > 6 ms with 2nd / 3rd release']], circuit: '-X0:A7 → -S6 13-14 → -X0:B7.', notes: 'Use a latching input for this short pulse.',
  },
  bkX0: {
    tag: '-X0', title: 'Low-voltage interface, 64-pole (fixed part)', pn: '3AX1134-..', kind: 'Basic', where: 'On the top plate of the drive (32).',
    summary: 'Standard control connection: 64-pole plug connector, crimp contacts for 1.5–2.5 mm². Alternatively a 20- to 30-pole plug strip Q0-X1.1 … X1.3.',
    does: 'Connects all control circuits of the breaker to the panel.', how: 'The fixed housing with the 64-pin insert sits on the top plate; the plug with the grommet housing (crimped wires) is pushed on and held by the locking bows. Hover each pin for its use in the sample diagram.',
    data: [['Pins', '64, rows A–D × 1–16'], ['Wire', 'crimp contacts 1.5–2.5 mm²']], circuit: 'See the -X0 pin list in the LV tab.', notes: 'In NXAIR the plug goes to the panel socket under the LV compartment.',
  },
  bkX0plug: {tag: '-X0', title: '64-pole plug with grommet housing', pn: '3AX1134-..', kind: 'Basic', where: 'On the fixed part on the top plate.', summary: 'The customer side of -X0: crimped control wires 1.5–2.5 mm² in a grommet housing, held by the locking bows.', does: 'Customer connection.', how: 'Push on, close the locking bows.', data: [], circuit: '', notes: ''},
  bkStrip: {
    tag: 'Q0-X1.1 … X1.3', title: 'Plug strip, 20- to 30-pole (alternative to -X0)', pn: '3AX1134-..; plugs WAGO 231-110/026-000', kind: 'Basic (alternative)', where: 'On the top plate instead of -X0, with the cable bracket (60).',
    summary: '20- or 30-pole plug strip instead of the 64-pole -X0: spring-clamp plugs for 1.5–2.5 mm² wires, cable bracket 60 with Torx 20 self-tapping screws, 3 Nm, single use.',
    does: 'Control connection without a 64-pole plug.', how: 'Remove the cover of the LV interface, insert a 0.5 × 3 mm slotted screwdriver into the plug, insert the stripped wire (solid or fine-stranded 1.5–2.5 mm², with or without ferrule), withdraw the screwdriver. Fit the cable bracket so the loom runs to the back of the pole shells.',
    data: [['Wires', '1.5–2.5 mm² solid or fine-stranded'], ['Cable bracket', 'Torx 20 self-tapping, 3 Nm, single use']], circuit: 'Per the order-specific diagram.', notes: '',
  },
  bkLoom: {tag: '—', title: 'Internal wiring and plugs -X01 / -X02', pn: '—', kind: 'Basic', where: 'Inside the drive; -X01 / -X02 at the top right (33.2).', summary: 'Wiring loom from -X0 to every device; plugs -X01 / -X02 for the position switches of a cassette.', does: 'Internal connections.', how: 'For a cassette, its loom with the -Q0 plugs is routed along the side wall through the breaker and tied to the existing loom, clear of the spring state indicator.', data: [], circuit: '', notes: ''},
  bkY2: {
    tag: '-Y2', title: '2nd shunt release', pn: '3AX1101-..', kind: 'Option', where: 'Release position 51.2 or 51.3, left of the drive.',
    summary: 'A second, independent trip coil: its armature unlatches an energy store, which acts on the OFF latch. 10 W/VA; minimum command 20 ms; opening ≤ 45 ms.',
    does: 'Redundant electrical opening (e.g. a second protection or trip circuit).', how: 'Fitted when more than one shunt release is needed. The electrical command pulls the armature, which releases a small energy store; its striker hits the trip bar and frees the OFF latch. Not for continuous duty.',
    data: [['Power', '10 W/VA'], ['Minimum command duration', '20 ms'], ['Opening / break time', '≤ 45 ms / ≤ 60 ms'], ['Protection', 'varistor ≥ 60 V DC; rectifier ≥ 100 V AC/DC']],
    circuit: '-X0:A3 → -S1 33-34 → -Y2 → -X0:B3; -X0:D3 monitoring point.', notes: 'At most two releases 3AX11 besides -Y1; permitted combinations in catalog HG 11.02.',
  },
  bkY4: {
    tag: '-Y4 / -Y5', title: 'C.t.-operated release', pn: '3AX1102-..', kind: 'Option', where: 'Release position 51.2 or 51.3.',
    summary: 'Trips from the current of the main CTs (through auxiliary CTs) without auxiliary voltage: energy store, unlatching device and electromagnet; trips at 90 % of its rated current.',
    does: 'Tripping by current-transformer energy, for feeders without a reliable auxiliary supply.', how: 'When the current exceeds the tripping value (90 % of the release rated current), the unlatching device frees the energy store and the breaker opens. Auxiliary CTs are needed to match the main CTs. -Y4 and -Y5 have a rectifier.',
    data: [['Burden', '≤ 6 VA at 0.5 A and 1 A, at ≤ 90 % of the rated current, armature open'], ['Power', '10 W/VA'], ['Tripping', '90 % of the release rated current']],
    circuit: '-X0:A4 / B4 (sample diagram, 1st c.t.-operated release).', notes: '',
  },
  bkY6: {
    tag: '-Y6', title: 'C.t.-operated release, low energy 0.1 Ws', pn: '3AX1104-..', kind: 'Option', where: 'Release position 51.2 or 51.3.',
    summary: 'Low-energy (0.1 Ws) version of the c.t.-operated release, for tripping by a CT-powered protection relay.',
    does: 'Tripping by a small energy pulse.', how: 'Same principle as -Y4 (energy store, unlatching, electromagnet) with a sensitivity of 0.1 Ws.',
    data: [['Tripping energy', '0.1 Ws'], ['Power', '10 W/VA']], circuit: '-X0:C4 / D4 (sample diagram, low-energy release).', notes: '',
  },
  bkY7: {
    tag: '-Y7', title: 'Undervoltage release', pn: '3AX1103-..', kind: 'Option', where: 'Release position 51.2 or 51.3; series resistor -R1 above it (59.6).',
    summary: 'Holds while energised and trips the breaker automatically when its voltage falls too low; only with its series resistor -R1; the breaker cannot be closed while it is de-energised. 20 W/VA.',
    does: 'Opens the breaker on loss or unacceptable drop of the supply voltage; also used for deliberate tripping.', how: 'Its magnet is continuously energised while the breaker is ON. When the voltage drops below a set value, the latch of the energy store is released and the breaker opens. Deliberate tripping is normally by an NC contact in its circuit, or by short-circuiting the coil with an NO contact (the built-in resistor limits that current). It can also be fed from a voltage transformer.',
    data: [['Power', '20 W/VA'], ['Protection', 'varistor ≥ 60 V DC; rectifier ≥ 100 V AC/DC'], ['Series resistor', '-R1, 1 or 2 resistors depending on the voltage (supplied)']],
    circuit: '-X0:C5 → -Y7 → -R1 → -X0:B5; -S1 43-44 via -X0:D5 (Fig. 63: tripping via NC or NO contact).', notes: 'Never operate it without -R1. Before commissioning move the striker locking screw from A to B (instruction card in the drive). Mechanical and electrical closing only with -Y7 energised.',
  },
  bkR1: {tag: '-R1', title: 'Series resistor for -Y7', pn: 'supplied with 3AX1103', kind: 'Option (with -Y7)', where: 'Above the -Y7 release position (59.6).', summary: 'Series resistor of the undervoltage release: one or two resistors depending on the voltage. -Y7 must never run without it.', does: 'Limits the holding current of -Y7 and the current when its coil is short-circuited for tripping.', how: 'Wired in series with -Y7.', data: [['Number', '1 or 2, depending on the voltage']], circuit: 'Between -Y7 and -X0:B5 (sample diagram).', notes: 'Running -Y7 without -R1 damages it.'},
  bkR01: {
    tag: '-R01', title: 'Heater (anti-condensation)', pn: '—', kind: 'Option', where: 'Bottom of the drive (59.4).',
    summary: 'Minimises condensation and corrosion: 50 W at 230 V AC (110 V AC option); surface about 180 °C.', does: 'Keeps the drive above the dew point.', how: 'Connect to its supply per the circuit diagram supplied (sample diagram: -X1:26 / 27, 230 V AC).',
    data: [['Power', '50 W'], ['Rated voltage', '230 V AC (110 V AC option)'], ['Surface temperature', '≈ 180 °C']], circuit: 'Separate 230 V AC supply (sample: -X1:26 → -R01 → -X1:27).', notes: 'Hot surface: let it and its surroundings cool before touching.',
  },
  bkY8E: {
    tag: '-Y8E / -S5', title: 'Electrical closing lock-out', pn: '3AX1405-.. (text p. 34: 3AX1415-..), with position switch -S5', kind: 'Option', where: 'Right of the drive near the closing latch (59.5, not shown in the manual\'s figure; position drawn here is assumed).',
    summary: 'Releases the breaker for operation only while auxiliary voltage is present; without it, hand and electrical closing are blocked mechanically, and -S5 blocks electrically.',
    does: 'Prevents closing when the control voltage is missing.', how: 'With control voltage applied the magnet withdraws its locking bolt and closing is possible; without voltage the bolt blocks the closing latch and -S5 opens the closing circuit.',
    data: [['Position switch', '-S5']], circuit: 'Per the order-specific diagram.', notes: 'For any closing (mechanical or electrical) -Y8E must be connected to control voltage.',
  },
  bkS12: {
    tag: '-S12', title: 'Position switch: no electrical closing with the mechanical interlock', pn: '3AX4206-0A', kind: 'Option', where: 'Bottom of the drive at the interlock plunger (54.1, not shown in the manual\'s figure).',
    summary: 'Opens the closing circuit while the mechanical interlock is actuated, so the breaker is also locked electrically against closing in an intermediate position.',
    does: 'Electrical blocking of closing by the panel interlock.', how: 'The panel-side interrogation part lifts the interlock plunger (59.2) by 5–10 mm with the breaker OFF; the plunger blocks closing mechanically and actuates -S12.',
    data: [['Interrogation part (panel)', 'cross-section ≤ 14 × 3 mm, force 50–450 N, stroke 5–10 mm']], circuit: '-S12 13-14 in series with -Y9 before -X0:B2 (sample diagram).', notes: 'Never trip the breaker by hand with the cover off while the mechanical interlock is actuated: irreparable damage to the drive.',
  },
  bkKey: {
    tag: 'Key lock / -S5', title: 'Key lock', pn: '3AX1437-.., with position switch -S5', kind: 'Option', where: 'In the cover below the hand-crank opening (59.3).',
    summary: 'Locks the breaker mechanically against hand closing and electrically (-S5) against electrical closing; the key is removable only in the locked position.',
    does: 'Lock-out of the breaker in the OFF position.', how: 'To lock: hold push button OFF pressed until the key has been turned to the vertical (ON) position; the key can then be withdrawn. Delivered locked: unlock it for test operations and commissioning.',
    data: [['Position switch', '-S5']], circuit: 'Per the order-specific diagram.', notes: 'Check the interlock function to IEC 62271-200 when a key lock is retrofitted.',
  },
  bkIndic: {tag: '55.1 / 56.3 / 58', title: 'Indicators and operations counter', pn: '—', kind: 'Basic', where: 'Behind the control board in the cover.', summary: 'Spring state indicator (55.1), position indicator ON-OFF (56.3) and the operations counter (58): one operating cycle = one closing and one opening.', does: 'Local indication.', how: 'Charging: spring indicator to CHARGED. Closing: position ON, spring indicator DISCHARGED then CHARGED again as the motor recharges (charged only with motor voltage). Opening: position OFF, the spring indicator does not change.', data: [], circuit: '', notes: ''},
  bkInterlock: {tag: '59.2', title: 'Mechanical interlock plunger', pn: '—', kind: 'Basic', where: 'Under the drive, acted on from the panel.', summary: 'Senses the switch position for the panel: with the breaker ON the interrogation part cannot move, so racking is blocked; with the breaker OFF it is lifted 5–10 mm and blocks closing.', does: 'Closing only in service or disconnected position, racking only when OFF.', how: 'The panel-side interrogation part (≤ 14 × 3 mm, 50–450 N) presses the plunger; dimensions c + d are on the dimension drawing supplied.', data: [['Stroke in OFF', '5–10 mm'], ['Force', '50–450 N'], ['Reference dimension', '35 ±0.3 mm']], circuit: '', notes: ''},
};
