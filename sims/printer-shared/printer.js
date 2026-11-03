// Filament FX-1, built from code in metres: a 2040 frame, a bed that slides on a centre rail under a GT2 belt, an X
// gantry riding two T8 lead screws, a direct-drive toolhead, NEMA 17 motors (the X motor opens to its stator and
// rotor), a hotend that cuts in half down its axis, the main board under an x-ray lid, the 128 x 64 screen and its
// knob, and the bead laid down by the real nozzle path. update(s) poses everything from the model's state.
//
// Printer axes to the world: X → +x, Z → +y (up), Y → the bed slides toward the viewer (+z) as Y grows.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {P} from './model.js';

const V3 = THREE.Vector3;
const mm = (v) => v / 1000;
export const K = {
  bedTop: 66, // mm, the build surface above the floor
  railH: 40,
  upX: 215, // uprights at ±x
  topY: 500,
  screwX: 247,
  gantryZ: -35, // the X beam's centre, behind the nozzle line
  beltXZ: -58,
  nozzleToBeam: 55, // nozzle tip to the X beam's centre
  bedHalf: 117.5,
  boxX: [272, 382],
  boxZ: [-110, 60],
  lcd: {x: 200, y: 38, z: 246},
};
export const COL = {
  frame: '#2c3036',
  alu: '#c4c8ce',
  dark: '#25282d',
  cap: '#aeb3ba',
  sheet: '#c9a36b',
  brass: '#c79a4a',
  copper: '#c77a3e',
  pcb: '#1d2730',
  belt: '#1c1e21',
  red: '#d6182b',
  blue: '#3d8fe0',
  fil: '#3d8fe0',
  white: '#f4f4f2',
};

// ------------------------------------------------------------ helpers
const std = (color, rough = 0.5, metal = 0.0, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal, envMapIntensity: 0.6, ...extra});
const rbox = (w, h, d, r = 1) => new RoundedBoxGeometry(mm(w), mm(h), mm(d), 2, mm(Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01)));
function mesh(geo, mat, parent, pos = [0, 0, 0], part = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(mm(pos[0]), mm(pos[1]), mm(pos[2]));
  m.castShadow = true;
  m.receiveShadow = true;
  if (part) m.userData.part = part;
  parent.add(m);
  return m;
}
// a lathe around y from [r, y] in mm; half = only the back half (z ≤ 0), for the section
const lathe = (prof, seg = 40, half = false) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(mm(r), mm(y))), half ? seg / 2 : seg, half ? Math.PI / 2 : 0, half ? Math.PI : Math.PI * 2);
// the cut face of a lathe profile in the plane z = 0, both sides of the axis
function capGeo(prof) {
  const sh = (s) => {
    const shape = new THREE.Shape();
    prof.forEach(([r, y], i) => (i ? shape.lineTo(mm(s * r), mm(y)) : shape.moveTo(mm(s * r), mm(y))));
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  };
  const a = sh(1);
  const b = sh(-1);
  const g = new THREE.BufferGeometry();
  const pa = [...a.attributes.position.array, ...b.attributes.position.array];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pa, 3));
  const ia = [...a.index.array];
  const off = a.attributes.position.count;
  const ib = [...b.index.array].map((v) => v + off);
  // ShapeGeometry winds both halves counter-clockwise, so both face +z
  g.setIndex([...ia, ...ib]);
  g.computeVertexNormals();
  return g;
}
const cyl = (r, h, seg = 24) => new THREE.CylinderGeometry(mm(r), mm(r), mm(h), seg);

// a GT2 belt texture: teeth every 2 mm, scrolled by the belt's travel
function beltTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = '#1c1e21';
  g.fillRect(0, 0, 64, 8);
  g.fillStyle = '#3a3e44';
  for (let i = 0; i < 64; i += 16) g.fillRect(i, 0, 6, 8);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------ NEMA 17
// body 42.3 square, the shaft along +local z. inside: true builds the stator (8 poles, 48 small teeth), the coils and
// a 50-tooth rotor behind a removable back cap, for the cutaway.
function nema17(len, inside, part) {
  const g = new THREE.Group();
  const body = std(COL.dark, 0.55);
  const cap = std(COL.cap, 0.35, 0.6);
  const capF = mesh(rbox(42.3, 42.3, 8, 3), cap, g, [0, 0, len / 2 - 4], part);
  const capB = mesh(rbox(42.3, 42.3, 8, 3), cap, g, [0, 0, -len / 2 + 4], part);
  mesh(cyl(11, 2), cap, g, [0, 0, len / 2 + 1], part).rotation.x = Math.PI / 2;
  const shaft = mesh(cyl(2.5, 22, 16), std('#d9dcdf', 0.25, 0.8), g, [0, 0, len / 2 + 11], part);
  shaft.rotation.x = Math.PI / 2;
  const out = {g, capB, capF, body, shaft};
  if (!inside) {
    mesh(rbox(42.3, 42.3, len - 15.8, 2.5), body, g, [0, 0, 0], part);
    return out;
  }
  // the stator stack: a square outline with the pole profile as its bore
  const st = new THREE.Shape();
  const H = 21.15;
  const ch = 4;
  st.moveTo(-H + ch, -H);
  for (const [x, y] of [[H - ch, -H], [H, -H + ch], [H, H - ch], [H - ch, H], [-H + ch, H], [-H, H - ch], [-H, -H + ch]]) st.lineTo(x, y);
  st.closePath();
  const bore = new THREE.Path();
  const pts = [];
  for (let p = 0; p < 8; p++) {
    const a0 = (p * Math.PI) / 4;
    const neck = 0.16;
    const face = 0.3;
    // slot base, up the neck, the pole face with 6 teeth, down the neck
    const R = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
    pts.push(R(17.5, a0 - Math.PI / 8));
    pts.push(R(17.5, a0 - neck), R(13.2, a0 - neck), R(12.4, a0 - face));
    for (let k = 0; k < 6; k++) {
      const a = a0 - face + ((k + 0.5) / 6) * 2 * face;
      const w = (2 * face) / 6;
      pts.push(R(11.75, a - w / 2), R(11.75, a - w / 4), R(11.2, a - w / 4), R(11.2, a + w / 4), R(11.75, a + w / 4));
    }
    pts.push(R(12.4, a0 + face), R(13.2, a0 + neck), R(17.5, a0 + neck));
  }
  pts.forEach(([x, y], i) => (i ? bore.lineTo(x, y) : bore.moveTo(x, y)));
  bore.closePath();
  st.holes.push(bore);
  const stack = new THREE.ExtrudeGeometry(st, {depth: len - 16, bevelEnabled: false, curveSegments: 4});
  stack.scale(0.001, 0.001, 0.001);
  stack.translate(0, 0, mm(-(len - 16) / 2));
  mesh(stack, std('#5b6067', 0.45, 0.5), g, [0, 0, 0], part);
  // the coils, one on each pole neck: A on 0 2 4 6, B on 1 3 5 7
  out.coils = [];
  for (let p = 0; p < 8; p++) {
    const a0 = (p * Math.PI) / 4;
    const m = new THREE.MeshStandardMaterial({color: '#9a5a2c', roughness: 0.45, metalness: 0.4, emissive: '#000000'});
    const c = mesh(new RoundedBoxGeometry(mm(4.2), mm(6.8), mm(len - 13), 2, mm(1.2)), m, g, [15.2 * Math.cos(a0), 15.2 * Math.sin(a0), 0], part);
    c.rotation.z = a0;
    out.coils.push({m, phase: p % 2 === 0 ? 'A' : 'B', sign: p % 4 < 2 ? 1 : -1});
  }
  // the rotor: 50 teeth, 7.2° apart
  const rs = new THREE.Shape();
  for (let k = 0; k < 50; k++) {
    const a = (k / 50) * Math.PI * 2;
    const w = (Math.PI * 2) / 50;
    const R = (r, b) => [r * Math.cos(b), r * Math.sin(b)];
    const q = [R(10.3, a - w / 2), R(10.3, a - w / 4.5), R(10.95, a - w / 5), R(10.95, a + w / 5), R(10.3, a + w / 4.5)];
    q.forEach(([x, y], i) => (k === 0 && i === 0 ? rs.moveTo(x, y) : rs.lineTo(x, y)));
  }
  rs.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, 2.5, 0, Math.PI * 2, true);
  rs.holes.push(hole);
  const rg = new THREE.ExtrudeGeometry(rs, {depth: len - 17, bevelEnabled: false, curveSegments: 2});
  rg.scale(0.001, 0.001, 0.001);
  rg.translate(0, 0, mm(-(len - 17) / 2));
  out.rotor = mesh(rg, std('#8d939a', 0.35, 0.7), g, [0, 0, 0], part);
  // one tooth marked so the turn reads
  mesh(rbox(1.6, 1.6, len - 16.5, 0.3), std(COL.red, 0.5, 0, {emissive: COL.red, emissiveIntensity: 0.25}), out.rotor, [0, 10.55, 0], part);
  return out;
}

// ------------------------------------------------------------ the printer
export function buildPrinter() {
  const root = new THREE.Group();
  const groups = {}; // highlight groups: name → [materials]
  const hl = (name, mat) => {
    (groups[name] ||= []).push(mat);
    if (!mat.userData.base) mat.userData.base = mat.emissive ? mat.emissive.clone() : null;
    return mat;
  };
  const frameM = std(COL.frame, 0.5, 0.3);
  const aluM = std(COL.alu, 0.4, 0.6);

  // base: the centre rail and two cross members; uprights; the top bar
  mesh(rbox(40, K.railH, 470, 1.5), frameM, root, [0, K.railH / 2, 0], 'frame');
  for (const z of [-215, 215]) mesh(rbox(440, 20, 40, 1.5), frameM, root, [0, 10, z], 'frame');
  for (const s of [-1, 1]) mesh(rbox(20, K.topY - 20, 40, 1.5), frameM, root, [s * K.upX, 20 + (K.topY - 20) / 2, K.gantryZ], 'frame');
  mesh(rbox(470, 20, 40, 1.5), frameM, root, [0, K.topY + 10, K.gantryZ], 'frame');

  // ---------------- the bed: carriage, springs, aluminium plate, build sheet; it slides along z
  const bed = new THREE.Group();
  root.add(bed);
  const bedM = hl('bed', std(COL.alu, 0.45, 0.55));
  mesh(rbox(160, 6, 200, 1), aluM, bed, [0, 49, -110], 'bed');
  for (const [x, z] of [[-100, -20], [100, -20], [-100, -200], [100, -200]]) {
    mesh(cyl(4, 8), std('#c8a24a', 0.4, 0.6), bed, [x, 56, z], 'bed');
  }
  mesh(rbox(235, 3, 235, 1), bedM, bed, [0, K.bedTop - 2.5, -110], 'bed');
  const sheetM = hl('bed', std(COL.sheet, 0.6, 0.1));
  mesh(rbox(232, 1, 232, 0.4), sheetM, bed, [0, K.bedTop - 0.5, -110], 'bed');
  // the heater pad underneath, it glows with the bed's heat
  const padM = hl('bedheat', std('#8a3b26', 0.7, 0, {emissive: '#000000'}));
  mesh(rbox(200, 1, 200, 0.5), padM, bed, [0, K.bedTop - 4.5, -110], 'bedheat');

  // ---------------- Y drive: motor at the back, belt along the rail under the bed
  const yMot = nema17(40, false, 'ymotor');
  yMot.g.rotation.y = Math.PI / 2; // the shaft points +x, into the pulley on the rail line
  yMot.g.position.set(mm(-44), mm(22), mm(-212));
  root.add(yMot.g);
  const yPulley = mesh(cyl(6.4, 7, 20), aluM, root, [0, 22, -212], 'ybelt');
  yPulley.rotation.z = Math.PI / 2;
  mesh(cyl(6.4, 7, 20), aluM, root, [0, 22, 212], 'ybelt').rotation.z = Math.PI / 2;
  const beltTex = beltTexture();
  const beltY = beltTex.clone();
  beltY.repeat.set(424 / 8, 1);
  const beltYM = hl('belts', new THREE.MeshStandardMaterial({map: beltY, roughness: 0.7, emissive: '#000000'}));
  for (const y of [28.4, 15.6]) mesh(new THREE.BoxGeometry(mm(6), mm(1.2), mm(424)), beltYM, root, [0, y, 0], 'ybelt');

  // ---------------- Z: two lead screws, two motors on the base, the gantry rides them
  const screwTex = (() => {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#c9cdd2';
    g.fillRect(0, 0, 16, 64);
    g.strokeStyle = '#7d838b';
    g.lineWidth = 3;
    for (let i = -64; i < 128; i += 8) {
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(16, i + 8);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 52);
    return t;
  })();
  const screwM = hl('screws', new THREE.MeshStandardMaterial({map: screwTex, roughness: 0.35, metalness: 0.7, emissive: '#000000'}));
  const screws = [];
  const zMots = [];
  for (const s of [-1, 1]) {
    const zm = nema17(40, false, 'zmotor');
    zm.g.rotation.x = -Math.PI / 2;
    zm.g.position.set(mm(s * K.screwX), mm(20), mm(K.gantryZ));
    root.add(zm.g);
    zMots.push(zm);
    const sc = mesh(cyl(4, 400, 16), screwM, root, [s * K.screwX, 252, K.gantryZ], 'zscrew');
    screws.push(sc);
    mesh(cyl(9, 22, 20), aluM, root, [s * K.screwX, 52, K.gantryZ], 'zscrew');
  }

  // ---------------- the X gantry: beam, end brackets, motor, idler, belt; it rides up and down with Z
  const gantry = new THREE.Group();
  root.add(gantry);
  mesh(rbox(450, 20, 20, 1.2), frameM, gantry, [0, 0, K.gantryZ], 'frame');
  for (const s of [-1, 1]) {
    mesh(rbox(60, 50, 36, 3), std('#3a3f46', 0.5, 0.2), gantry, [s * 235, -4, K.gantryZ], 'frame');
    mesh(cyl(7, 14, 16), std(COL.brass, 0.35, 0.7), gantry, [s * K.screwX, -10, K.gantryZ], 'zscrew');
  }
  const xMot = nema17(40, true, 'xmotor');
  xMot.g.position.set(mm(-238), mm(0), mm(K.beltXZ - 26));
  gantry.add(xMot.g);
  const xPulley = mesh(cyl(6.4, 7, 20), aluM, gantry, [-238, 0, K.beltXZ], 'xbelt');
  xPulley.rotation.x = Math.PI / 2;
  mesh(cyl(6.4, 7, 20), aluM, gantry, [215, 0, K.beltXZ], 'xbelt').rotation.x = Math.PI / 2;
  const beltX = beltTex.clone();
  beltX.repeat.set(453 / 8, 1);
  const beltXM = hl('belts', new THREE.MeshStandardMaterial({map: beltX, roughness: 0.7, emissive: '#000000'}));
  for (const y of [6.4, -6.4]) mesh(new THREE.BoxGeometry(mm(453), mm(1.2), mm(6)), beltXM, gantry, [-11.5, y, K.beltXZ], 'xbelt');
  // the X motor's highlight materials

  // ---------------- the toolhead: carriage plate, extruder and its pancake motor, hotend, fans
  const head = new THREE.Group();
  gantry.add(head);
  const plateM = std('#e2e4e7', 0.45, 0.2);
  mesh(rbox(64, 70, 6, 2), plateM, head, [0, -6, -22], 'carriage');
  mesh(rbox(14, 14, 40, 2), plateM, head, [0, 14, -42], 'carriage'); // the belt clamp over the beam
  // the extruder: housing, pancake motor (shaft along z), filament in from the top
  const eMot = nema17(23, false, 'emotor');
  eMot.g.position.set(mm(-22), mm(34), mm(-3));
  head.add(eMot.g);
  mesh(rbox(22, 28, 26, 3), std('#e8e9eb', 0.5, 0.05), head, [10, 34, 0], 'extruder');
  const eGear = mesh(cyl(4.8, 4, 18), std(COL.brass, 0.35, 0.7), head, [4, 34, 14], 'extruder');
  eGear.rotation.x = Math.PI / 2;
  // the hotend, along y; the nozzle tip is the toolhead's origin (y = −55 from the beam)
  const hot = new THREE.Group();
  head.add(hot);
  hot.position.set(0, mm(-K.nozzleToBeam), 0);
  const sinkProf = [[2.1, 34]];
  for (let k = 0; k < 10; k++) {
    const y = 34 + k * 2.6;
    sinkProf.push([7.5, y], [11, y + 0.3], [11, y + 1.1], [7.5, y + 1.4]);
  }
  sinkProf.push([7.5, 61], [8, 62.5], [2.1, 62.5]);
  const breakProf = [[1.05, 16], [3.5, 16], [3.5, 18.5], [3.5, 22], [3.5, 26], [2.2, 27.5], [2.2, 29], [2.2, 30.5], [2.2, 32], [3.5, 34], [3.5, 36], ...Array.from({length: 21}, (_, i) => [1.05, 36 - i])];
  const nozProf = [[0.2, 0], [0.5, 0], [3.2, 3.2], [4, 3.5], [4, 7], [3, 7], [3, 13], [1.05, 13], [1.05, 5], [0.2, 0.6]];
  // the filament: rings every half millimetre so its colour can follow the heat and its marks can travel
  const filProf = [[0, 4], [0.85, 6], ...Array.from({length: 123}, (_, i) => [0.875, 9 + i * 0.5]), ...Array.from({length: 132}, (_, i) => [0, 70 - i * 0.5])];
  const sinkM = hl('hotend', std('#c9cdd3', 0.35, 0.65, {emissive: '#000000', side: THREE.DoubleSide}));
  const breakM = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.35, metalness: 0.5, side: THREE.DoubleSide});
  const nozM = hl('hotend', std(COL.brass, 0.3, 0.75, {emissive: '#000000', side: THREE.DoubleSide}));
  const filM = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.4, metalness: 0, side: THREE.DoubleSide});
  const blockM = hl('heater', std('#c4c8ce', 0.4, 0.55, {emissive: '#000000'}));
  const capM = std('#eef0f2', 0.6, 0.1, {side: THREE.DoubleSide});
  const hotParts = {full: [], half: []};
  const both = (prof, mat, part, capMat = null) => {
    const f = mesh(lathe(prof), mat, hot, [0, 0, 0], part);
    const h = mesh(lathe(prof, 40, true), mat, hot, [0, 0, 0], part);
    hotParts.full.push(f);
    hotParts.half.push(h);
    const c = mesh(capGeo(prof), mat.vertexColors ? mat : capMat ?? capM, hot, [0, 0, 0.02], part);
    hotParts.half.push(c);
    return {f, h, c};
  };
  both(sinkProf, sinkM, 'hotend');
  const brk = both(breakProf, breakM, 'hotend');
  both(nozProf, nozM, 'hotend', std('#e3c47f', 0.5, 0.2, {side: THREE.DoubleSide}));
  const fil = both(filProf, filM, 'filament');
  // vertex colour by height: the temperature along the heat break and the filament (set in update)
  const colorize = (geo) => {
    const n = geo.attributes.position.count;
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  };
  for (const o of [brk.f, brk.h, brk.c, fil.f, fil.h, fil.c]) colorize(o.geometry);
  // the heater block in two pieces either side of the bore (x −14.5..−3 and 3..5.5), holes for the cartridge and
  // the thermistor; 16 deep, or its back half in section
  const blockPieces = (depth, z0) => {
    const left = new THREE.Shape();
    left.moveTo(-14.5, 7);
    left.lineTo(-3, 7);
    left.lineTo(-3, 18.5);
    left.lineTo(-14.5, 18.5);
    left.closePath();
    const h1 = new THREE.Path();
    h1.absarc(-9, 12.5, 3.1, 0, Math.PI * 2, true);
    left.holes.push(h1);
    const h2 = new THREE.Path();
    h2.absarc(-4.6, 9.2, 1.0, 0, Math.PI * 2, true);
    left.holes.push(h2);
    const right = new THREE.Shape();
    right.moveTo(3, 7);
    right.lineTo(5.5, 7);
    right.lineTo(5.5, 18.5);
    right.lineTo(3, 18.5);
    right.closePath();
    return [left, right].map((s) => {
      const g = new THREE.ExtrudeGeometry(s, {depth, bevelEnabled: false, curveSegments: 16});
      g.scale(0.001, 0.001, 0.001);
      g.translate(0, 0, mm(z0));
      return g;
    });
  };
  for (const g of blockPieces(16, -8)) hotParts.full.push(mesh(g, blockM, hot, [0, 0, 0], 'heater'));
  for (const g of blockPieces(8, -8)) hotParts.half.push(mesh(g, blockM, hot, [0, 0, 0], 'heater'));
  // the bridge over the bore at the back, so the full block has no gap (the heat break and nozzle fill it)
  hotParts.full.push(mesh(new THREE.BoxGeometry(mm(6), mm(11.5), mm(4)), blockM, hot, [0, 12.75, -6], 'heater'));
  // heater cartridge and thermistor, along z
  const cartM = hl('heater', std('#8f949b', 0.35, 0.7, {emissive: '#000000'}));
  const cart = mesh(cyl(3, 20, 20), cartM, hot, [-9, 12.5, 0], 'heater');
  cart.rotation.x = Math.PI / 2;
  // in section only the back half of each stays: the cut plane passes through them
  const thermM = hl('thermistor', std('#d8d2c2', 0.5, 0.1, {emissive: '#000000'}));
  const therm = mesh(cyl(1, 14, 12), thermM, hot, [-4.6, 9.2, 0], 'thermistor');
  therm.rotation.x = Math.PI / 2;
  // wires out of the cartridge and the thermistor
  mesh(cyl(0.7, 30, 6), std('#d33', 0.6), hot, [-9.6, 12.5, -25], 'heater').rotation.x = Math.PI / 2;
  mesh(cyl(0.5, 26, 6), std('#eee', 0.6), hot, [-4.6, 9.2, -21], 'thermistor').rotation.x = Math.PI / 2;
  // the hotend fan on the heat sink's front, the part fan duct on its right
  const fanBox = mesh(rbox(30, 30, 10, 2), std('#e5e6e8', 0.5, 0.05), hot, [0, 48, 17], 'fan');
  hotParts.full.push(fanBox);
  const blade = mesh(new THREE.CylinderGeometry(mm(13), mm(13), mm(2), 7), std('#2b2e33', 0.6), hot, [0, 48, 22.5], 'fan');
  blade.rotation.x = Math.PI / 2;
  hotParts.full.push(blade);
  const duct = mesh(rbox(12, 26, 20, 3), std('#e5e6e8', 0.5, 0.05), hot, [24, 26, 2], 'fan');
  void duct;
  const partFan = mesh(new THREE.CylinderGeometry(mm(8), mm(8), mm(2), 7), std('#2b2e33', 0.6), hot, [30.2, 28, 2], 'fan');
  partFan.rotation.z = Math.PI / 2;
  for (const o of hotParts.half) o.visible = false;

  for (const m of [xMot, yMot, ...zMots, eMot]) hl('motors', m.body);

  // ---------------- the main board in its box, the lid goes to x-ray
  const box = new THREE.Group();
  root.add(box);
  const [bx0, bx1] = K.boxX;
  const [bz0, bz1] = K.boxZ;
  const bcx = (bx0 + bx1) / 2;
  const bcz = (bz0 + bz1) / 2;
  const boxM = std('#e4e5e8', 0.55, 0.05);
  mesh(rbox(bx1 - bx0, 3, bz1 - bz0, 1), boxM, box, [bcx, 1.5, bcz], 'board');
  const walls = [];
  for (const [w, d, x, z] of [[bx1 - bx0, 3, bcx, bz0 + 1.5], [bx1 - bx0, 3, bcx, bz1 - 1.5], [3, bz1 - bz0, bx0 + 1.5, bcz], [3, bz1 - bz0, bx1 - 1.5, bcz]]) walls.push(mesh(rbox(w, 44, d, 1), boxM, box, [x, 22, z], 'board'));
  const lidM = new THREE.MeshStandardMaterial({color: '#e8e9ec', roughness: 0.5, metalness: 0.05, transparent: true, opacity: 1});
  const lid = mesh(rbox(bx1 - bx0, 3, bz1 - bz0, 1), lidM, box, [bcx, 45.5, bcz], 'board');
  // the PCB and its parts: the MCU, five drivers, two MOSFETs, connectors, USB
  const pcbW = 96;
  const pcbD = 150;
  const pcbY = 14;
  const pcbTex = (() => {
    const c = document.createElement('canvas');
    c.width = 384;
    c.height = 600;
    const g = c.getContext('2d');
    g.fillStyle = COL.pcb;
    g.fillRect(0, 0, 384, 600);
    g.strokeStyle = '#3b5566';
    g.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      const y = 30 + i * 14;
      g.moveTo(20 + ((i * 37) % 60), y);
      g.lineTo(190, y + ((i % 5) - 2) * 6);
      g.lineTo(360 - ((i * 23) % 70), y + 4);
      g.stroke();
    }
    g.fillStyle = '#c7b27a';
    for (let i = 0; i < 300; i++) g.fillRect((i * 97) % 370 + 6, (i * 53) % 590 + 4, 3, 3);
    g.fillStyle = '#e8e8e8';
    g.font = '600 14px Inter, sans-serif';
    g.fillText('FX-1 MAIN · 32-BIT', 16, 584);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const pcb = mesh(new THREE.BoxGeometry(mm(pcbW), mm(1.6), mm(pcbD)), [std(COL.pcb), std(COL.pcb), new THREE.MeshStandardMaterial({map: pcbTex, roughness: 0.6}), std(COL.pcb), std(COL.pcb), std(COL.pcb)], box, [bcx, pcbY, bcz], 'board');
  void pcb;
  const PCB = (x, z) => [bcx + x, pcbY + 0.8, bcz + z]; // x across, z along the board
  const mcuM = hl('mcu', std('#1e2124', 0.4, 0.2, {emissive: '#000000'}));
  mesh(rbox(12, 1.6, 12, 0.3), mcuM, box, [PCB(-14, 18)[0], pcbY + 1.6, PCB(-14, 18)[2]], 'mcu');
  for (let k = 0; k < 4; k++) {
    // QFP legs
    const a = (k * Math.PI) / 2;
    const leg = mesh(new THREE.BoxGeometry(mm(12), mm(0.3), mm(1.2)), std('#c9cdd2', 0.3, 0.8), box, [PCB(-14, 18)[0] + 6.8 * Math.sin(a), pcbY + 1, PCB(-14, 18)[2] + 6.8 * Math.cos(a)], 'mcu');
    leg.rotation.y = a;
  }
  const drv = {};
  const DRV = ['x', 'y', 'z', 'e'];
  DRV.forEach((a, k) => {
    const z = -58 + k * 26;
    const m = hl('drivers', std('#232629', 0.45, 0.2, {emissive: '#000000'}));
    mesh(rbox(9, 1.4, 9, 0.3), m, box, [PCB(20, z)[0], pcbY + 1.5, PCB(20, z)[2]], 'driver');
    // a tiny heat sink on each
    mesh(rbox(9, 5, 9, 0.6), std('#9aa0a7', 0.4, 0.6), box, [PCB(20, z)[0], pcbY + 4.7, PCB(20, z)[2]], 'driver');
    // the motor connector on the board's edge
    mesh(rbox(7, 7, 10, 0.5), std('#f2f2ee', 0.6), box, [PCB(42, z)[0], pcbY + 4, PCB(42, z)[2]], 'driver');
    drv[a] = m;
  });
  const fetM = hl('heater', std('#26292d', 0.45, 0.2, {emissive: '#000000'}));
  for (const z of [56, 66]) mesh(rbox(10, 2.4, 7, 0.4), fetM, box, [PCB(-30, z)[0], pcbY + 2, PCB(-30, z)[2]], 'heater');
  const usbM = hl('usb', std('#c9cdd2', 0.3, 0.8, {emissive: '#000000'}));
  mesh(rbox(12, 6, 10, 0.6), usbM, box, [PCB(-30, -70)[0], pcbY + 4, PCB(-30, -70)[2]], 'usb');
  // the traces that carry the work, drawn over the board and lit when their net is busy
  const traces = {};
  const trace = (name, pts) => {
    const m = new THREE.MeshBasicMaterial({color: COL.red, transparent: true, opacity: 0, depthWrite: false});
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1];
      const [x1, z1] = pts[i];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const s = mesh(new THREE.BoxGeometry(mm(1.2), mm(0.2), mm(len)), m, box, [PCB((x0 + x1) / 2, (z0 + z1) / 2)[0], pcbY + 1.0, PCB((x0 + x1) / 2, (z0 + z1) / 2)[2]], null);
      s.rotation.y = Math.atan2(x1 - x0, z1 - z0);
      s.castShadow = false;
      s.renderOrder = 4;
    }
    traces[name] = m;
  };
  DRV.forEach((a, k) => {
    const z = -58 + k * 26;
    trace(a, [[-8, 14 + k * 2.5], [4, 14 + k * 2.5], [4, z], [15, z]]);
    trace(a + 'm', [[25, z], [38, z]]);
  });
  trace('heat', [[-14, 25], [-14, 56], [-25, 56], [-25, 66]]);
  trace('therm', [[-20, 18], [-38, 18], [-38, 46]]);
  trace('usb', [[-30, -64], [-30, -20], [-14, -20], [-14, 11]]);
  trace('lcd', [[-8, 22], [-2, 22], [-2, 66], [10, 66]]);

  // ---------------- the screen and the knob on the front
  const lcdG = new THREE.Group();
  root.add(lcdG);
  lcdG.position.set(mm(K.lcd.x), mm(K.lcd.y), mm(K.lcd.z));
  lcdG.rotation.x = -0.55;
  const lcdM = std('#e4e5e8', 0.55, 0.05);
  mesh(rbox(140, 62, 16, 4), lcdM, lcdG, [0, 0, -8], 'lcd');
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 128;
  screenCanvas.height = 64;
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.magFilter = THREE.NearestFilter;
  screenTex.minFilter = THREE.LinearFilter;
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screenM = new THREE.MeshBasicMaterial({map: screenTex, toneMapped: false});
  mesh(new THREE.PlaneGeometry(mm(76), mm(38)), screenM, lcdG, [-22, 3, 0.2], 'lcd');
  mesh(rbox(82, 44, 1, 1), std('#1a1c1f', 0.4), lcdG, [-22, 3, -0.4], 'lcd');
  const knobM = hl('ui', std('#2b2e33', 0.45, 0.2, {emissive: '#000000'}));
  const knob = new THREE.Group();
  knob.position.set(mm(46), mm(3), mm(0));
  lcdG.add(knob);
  const kb = mesh(cyl(11, 14, 32), knobM, knob, [0, 0, 7], 'lcd');
  kb.rotation.x = Math.PI / 2;
  mesh(rbox(2, 8, 1.5, 0.4), std(COL.red), knob, [0, 6.5, 14.2], 'lcd');
  hl('ui', lcdM);

  // ---------------- the spool on the top bar; it turns with the filament drawn
  const spool = new THREE.Group();
  spool.position.set(mm(290), mm(K.topY + 90), mm(K.gantryZ));
  root.add(spool);
  mesh(rbox(10, 90, 24, 2), std('#e2e4e7', 0.5), root, [245, K.topY + 55, K.gantryZ], 'frame');
  mesh(cyl(4, 50, 12), std('#c9cdd2', 0.3, 0.7), root, [270, K.topY + 90, K.gantryZ], 'frame').rotation.z = Math.PI / 2;
  const spoolR = 70;
  const sp = mesh(new THREE.CylinderGeometry(mm(spoolR), mm(spoolR), mm(62), 48, 1, true), std(COL.fil, 0.55, 0), spool, [0, 0, 0], 'filament');
  sp.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    const flange = mesh(new THREE.CylinderGeometry(mm(82), mm(82), mm(3), 48), std('#f0f0ee', 0.5, 0.05), spool, [s * 33, 0, 0], 'filament');
    flange.rotation.z = Math.PI / 2;
  }
  const spoolMark = mesh(rbox(3, 30, 6, 1), std(COL.dark, 0.5), spool, [35, 50, 0], 'filament');
  void spoolMark;
  // the filament from the spool to the extruder, rebuilt when the head moves
  const filTubeM = std(COL.fil, 0.5, 0);
  const filTube = mesh(new THREE.BufferGeometry(), filTubeM, root, [0, 0, 0], 'filament');
  filTube.castShadow = false;

  // ---------------- cables from the board to the motors and the hotend
  const cableDefs = {
    x: {color: '#2f3338', net: 'x'},
    y: {color: '#2f3338', net: 'y'},
    zl: {color: '#2f3338', net: 'z'},
    zr: {color: '#2f3338', net: 'z'},
    e: {color: '#2f3338', net: 'e'},
    heat: {color: '#2f3338', net: 'heat'},
  };
  const cables = {};
  for (const [k, d] of Object.entries(cableDefs)) {
    const m = std(d.color, 0.6, 0, {emissive: '#000000'});
    const c = mesh(new THREE.BufferGeometry(), m, root, [0, 0, 0], 'cable');
    c.castShadow = false;
    cables[k] = {mesh: c, m, net: d.net, key: ''};
  }
  const tube = (pts, r = 2.2) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new V3(mm(x), mm(y), mm(z)))), 40, mm(r), 6, false);
  const BOXOUT = [bx0 + 6, 30, bz0 + 30];

  // ---------------- the bead, in the bed's frame, one instance per 2 ms of the real nozzle path
  let bead = null;
  const setBead = (pts, colorOf) => {
    if (bead) {
      bed.remove(bead.mesh);
      bead.mesh.geometry.dispose();
    }
    const n = Math.max(1, pts.length);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({roughness: 0.55, metalness: 0});
    const im = new THREE.InstancedMesh(geo, mat, n);
    im.castShadow = true;
    im.receiveShadow = true;
    im.userData.part = 'bead';
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    const times = [];
    let k = 0;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      if (p1.first || p1.b !== p0.b && Math.hypot(p1.x - p0.x, p1.y - p0.y) > 1) continue;
      const x0 = p0.x - 110;
      const z0 = -p0.y;
      const x1 = p1.x - 110;
      const z1 = -p1.y;
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 1e-4) continue;
      o.position.set(mm((x0 + x1) / 2), mm(K.bedTop + p1.z - P.line.h / 2), mm((z0 + z1) / 2));
      o.rotation.set(0, Math.atan2(x1 - x0, z1 - z0), 0);
      o.scale.set(mm(P.line.w), mm(P.line.h), mm(len + P.line.w * 0.5));
      o.updateMatrix();
      im.setMatrixAt(k, o.matrix);
      im.setColorAt(k, colorOf(p1, col));
      times.push(p1.t);
      k++;
    }
    im.count = 0;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    bed.add(im);
    bead = {mesh: im, times, n: k};
  };

  // ---------------- the planner's look-ahead drawn on the bed: the path the buffered blocks will take
  const aheadGeo = new THREE.BufferGeometry();
  aheadGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(64 * 3), 3));
  aheadGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(64 * 3), 3));
  const ahead = new THREE.Line(aheadGeo, new THREE.LineBasicMaterial({vertexColors: true, transparent: true, opacity: 0, depthTest: false}));
  ahead.renderOrder = 8;
  bed.add(ahead);

  // ---------------- update
  const hotTint = new THREE.Color();
  const cold = new THREE.Color('#c4c8ce');
  const warm = new THREE.Color('#e0a070');
  const glow = new THREE.Color(COL.red);
  const red = new THREE.Color(COL.red);
  const blue = new THREE.Color(COL.blue);
  const filCold = new THREE.Color(COL.fil);
  const filHot = new THREE.Color('#ff6a3a');
  const heatCol = (T, out) => {
    // ambient: the metal's own grey; 200 °C a warm tint; 300 °C toward red
    const k = Math.min(1, Math.max(0, (T - 40) / 260));
    return out.copy(cold).lerp(warm, Math.min(1, k * 1.4)).lerp(glow, Math.max(0, k - 0.6) * 1.6);
  };
  const lastCable = {};
  const update = (s) => {
    // positions in mm from the model: carriage X, bed Y, gantry Z
    const X = s.x;
    const Y = s.y;
    const Z = s.z;
    bed.position.z = mm(Y);
    gantry.position.y = mm(K.bedTop + Z + K.nozzleToBeam);
    head.position.x = mm(X - 110);
    // motors and belts: rotor angles from the motors' own (physical) step positions
    const turn = (usteps) => (usteps / P.usteps) * Math.PI * 2;
    xMot.rotor.rotation.z = -turn(s.rotor.x);
    xPulley.rotation.y = -turn(s.rotor.x);
    yPulley.rotation.x = turn(s.rotor.y);
    for (const sc of screws) sc.rotation.y = -turn(s.rotor.z);
    beltX.offset.x = -(X / 8) % 1;
    beltY.offset.x = -(Y / 8) % 1;
    eGear.rotation.z = turn(s.rotor.e) / P.ext.ratio;
    spool.rotation.x = -(s.e / spoolR);
    // the X motor's coils: phase currents from the driver, red north and blue south, brighter with current
    for (const c of xMot.coils) {
      const I = (c.phase === 'A' ? s.coil.iA : s.coil.iB) * c.sign;
      const k = Math.min(1, Math.abs(I) / s.coil.peak);
      c.m.emissive.copy(I >= 0 ? red : blue).multiplyScalar(0.9 * k * s.coilShow);
    }
    // the motor cutaway: the back cap comes off
    const cutM = s.cut.motor;
    xMot.capB.visible = cutM < 0.5;
    xMot.capB.position.z = mm(-40 / 2 + 4 - 40 * cutM);
    // the hotend section
    const sec = s.cut.hotend > 0.5;
    for (const o of hotParts.full) o.visible = !sec;
    for (const o of hotParts.half) o.visible = sec;
    cart.scale.y = sec ? 0.5 : 1;
    cart.position.z = sec ? mm(-5) : 0;
    therm.scale.y = sec ? 0.5 : 1;
    therm.position.z = sec ? mm(-3.5) : 0;
    // heat: the block's colour with its temperature, the heat break's gradient, the melt in the filament
    blockM.color.copy(heatCol(s.T, hotTint));
    nozM.color.set(COL.brass).lerp(glow, Math.max(0, (s.T - 230) / 140));
    const grad = (geo, kind) => {
      const pos = geo.attributes.position;
      const colA = geo.attributes.color;
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) * 1000;
        // the block's heat up to the heat break's throat (y 27), the sink's cool above 34
        const f = Math.min(1, Math.max(0, (y - 18.5) / (32 - 18.5)));
        const T = s.T + (s.Tsink - s.T) * f;
        if (kind === 'fil') {
          const m = Math.min(1, Math.max(0, (T - 150) / 60));
          c.copy(filCold).lerp(filHot, m * 0.85);
          // marks every 4 mm on the filament, carried down as it feeds
          const ph = (((y + s.e) % 4) + 4) % 4;
          if (ph < 0.6 && f > 0.3) c.multiplyScalar(0.6);
        } else heatCol(T, c);
        colA.setXYZ(i, c.r, c.g, c.b);
      }
      colA.needsUpdate = true;
    };
    {
      grad(brk.f.geometry, 'brk');
      grad(brk.h.geometry, 'brk');
      grad(brk.c.geometry, 'brk');
      grad(fil.f.geometry, 'fil');
      grad(fil.h.geometry, 'fil');
      grad(fil.c.geometry, 'fil');
    }
    cartM.emissive.copy(glow).multiplyScalar(0.55 * s.duty);
    padM.emissive.copy(glow).multiplyScalar(0.35 * s.bedOn);
    // the fans spin with their duty
    blade.rotation.z = s.time * 40;
    partFan.rotation.x = s.time * 60 * s.fan;
    // the x-ray lid
    lidM.opacity = 1 - 0.88 * s.cut.xray;
    lidM.depthWrite = s.cut.xray < 0.5;
    lid.castShadow = s.cut.xray < 0.5;
    // the board's nets
    for (const a of ['x', 'y', 'z', 'e']) {
      traces[a].opacity = Math.min(1, s.net[a]) * 0.95;
      traces[a + 'm'].opacity = Math.min(1, s.net[a]) * 0.95;
    }
    traces.heat.opacity = s.net.heat * 0.95;
    traces.therm.opacity = s.net.therm * 0.95;
    traces.usb.opacity = s.net.usb * 0.95;
    traces.lcd.opacity = s.net.lcd * 0.95;
    // the knob and the screen
    knob.rotation.z = -(s.ui.det * Math.PI) / 10;
    knob.position.z = mm(-1.5 * s.ui.press);
    if (s.screenDirty) screenTex.needsUpdate = true;
    // highlights: emissive accent on whole groups
    for (const [name, mats] of Object.entries(groups)) {
      const k = s.hl[name] ?? 0;
      for (const m of mats) {
        if (!m.emissive || m === cartM || m === padM) continue;
        // pale parts take less of the accent, so white plastic reads lit, not pink
        const lum = 0.3 * m.color.r + 0.59 * m.color.g + 0.11 * m.color.b;
        m.emissive.copy(glow).multiplyScalar(k * (lum > 0.5 ? 0.13 : 0.42));
      }
    }
    for (const a of ['x', 'y', 'z', 'e']) drv[a].emissive.copy(glow).multiplyScalar(0.6 * Math.min(1, s.net[a]) * (s.hl.drivers ?? 0));
    // the bead up to now
    if (bead) {
      let lo = 0;
      let hi = bead.times.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (bead.times[m] <= s.time) lo = m + 1;
        else hi = m;
      }
      bead.mesh.count = lo;
    }
    // the planner's path ahead
    {
      const pos = aheadGeo.attributes.position;
      const col = aheadGeo.attributes.color;
      const pts = s.ahead || [];
      for (let i = 0; i < 64; i++) {
        const p = pts[Math.min(i, pts.length - 1)];
        if (!p) {
          pos.setXYZ(i, 0, -1, 0);
          continue;
        }
        pos.setXYZ(i, mm(p.x - 110), mm(K.bedTop + p.z + 0.8), mm(-p.y));
        const c = blue.clone().lerp(red, Math.min(1, p.v / 45));
        col.setXYZ(i, c.r, c.g, c.b);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      aheadGeo.setDrawRange(0, Math.min(64, pts.length));
      ahead.material.opacity = s.aheadOn;
    }
    // cables: rebuilt only when the thing they hang from has moved
    const key = `${X.toFixed(1)},${Z.toFixed(1)}`;
    if (lastCable.k !== key) {
      lastCable.k = key;
      const gy = K.bedTop + Z + K.nozzleToBeam;
      const hx = X - 110;
      const set = (c, pts) => {
        c.mesh.geometry.dispose();
        c.mesh.geometry = tube(pts);
      };
      // along the right upright, behind the gantry, then down to the part
      const up = [K.upX + 4, gy + 30, K.gantryZ - 26];
      set(cables.x, [BOXOUT, [bx0 - 8, 40, -80], [K.upX + 4, 60, K.gantryZ - 26], up, [0, gy + 34, K.gantryZ - 32], [-200, gy + 34, -70], [-238, gy + 23, -78]]);
      set(cables.e, [BOXOUT, [bx0 - 12, 44, -84], [K.upX + 8, 64, K.gantryZ - 30], [K.upX + 8, gy + 40, K.gantryZ - 30], [hx + 30, gy + 56, -50], [hx - 22, gy + 40, -20]]);
      set(cables.heat, [BOXOUT, [bx0 - 16, 48, -88], [K.upX + 12, 68, K.gantryZ - 34], [K.upX + 12, gy + 26, K.gantryZ - 34], [hx + 26, gy + 20, -64], [hx - 9.6, gy - 30, -56], [hx - 9.6, gy - 42.5, -40]]);
      const fy = K.topY + 90;
      filTube.geometry.dispose();
      filTube.geometry = tube([[290, fy - 70, K.gantryZ + 10], [240, fy - 120, -10], [hx + 30, gy + 90, 6], [hx + 12, gy + 62, 0], [hx + 12, gy + 49, 0]], 0.9);
    }
    if (!lastCable.static) {
      lastCable.static = true;
      cables.y.mesh.geometry = tube([BOXOUT, [bx0 - 30, 18, -150], [-20, 18, -212], [-44, 22, -240]]);
      cables.zl.mesh.geometry = tube([BOXOUT, [bx0 - 20, 12, -60], [0, 6, -60], [-K.screwX, 6, -60], [-K.screwX, 20, K.gantryZ - 22]]);
      cables.zr.mesh.geometry = tube([BOXOUT, [bx0 - 10, 12, -40], [K.screwX, 12, K.gantryZ - 22]]);
    }
    for (const c of Object.values(cables)) {
      const k = Math.min(1, s.net[c.net] ?? 0) * (s.hl.cables ?? 0);
      c.m.emissive.copy(glow).multiplyScalar(0.8 * k);
    }
  };

  // ---------------- anchors for labels and leaders, world metres, from the current pose
  const tmp = new V3();
  const anchor = (name) => {
    const w = (obj, x = 0, y = 0, z = 0) => obj.localToWorld(tmp.set(mm(x), mm(y), mm(z))).clone();
    root.updateMatrixWorld();
    switch (name) {
      case 'xmotor':
        return w(xMot.g, 0, 0, -10);
      case 'xmotorBack':
        return w(xMot.g, 0, 0, -20);
      case 'ymotor':
        return w(yMot.g, 0, 0, 0);
      case 'zmotor':
        return w(zMots[0].g, 0, 0, 0);
      case 'emotor':
        return w(eMot.g, 0, 0, 12);
      case 'nozzle':
        return w(hot, 0, 0, 0);
      case 'heater':
        return w(hot, -9, 12.5, 8);
      case 'block':
        return w(hot, -4, 12.5, 0);
      case 'thermistor':
        return w(hot, -4.6, 9.2, 8);
      case 'heatbreak':
        return w(hot, 0, 26, 0);
      case 'sink':
        return w(hot, 11, 48, 0);
      case 'xbelt':
        return w(gantry, 120, 6.4, K.beltXZ);
      case 'ybelt':
        return new V3(0, mm(28), mm(-150));
      case 'bed':
        return w(bed, 80, K.bedTop, -40);
      case 'mcu':
        return new V3(mm(bcx - 14), mm(pcbY + 3), mm(bcz + 18));
      case 'drivers':
        return new V3(mm(bcx + 20), mm(pcbY + 6), mm(bcz - 20));
      case 'usb':
        return new V3(mm(bcx - 30), mm(pcbY + 6), mm(bcz - 70));
      case 'lcd':
        return w(lcdG, -22, 3, 0);
      case 'knob':
        return w(lcdG, 46, 3, 14);
      case 'zscrew':
        return w(gantry, -K.screwX, 60, K.gantryZ);
      case 'bead':
        return w(bed, 0, K.bedTop, -110);
      default:
        return new V3(0, 0.2, 0);
    }
  };
  return {root, update, anchor, setBead, screenCanvas, groups, parts: root};
}
