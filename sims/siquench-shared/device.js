// SIQuench Core 3AM4, built from code in metres from the manual's dimension drawings (Abb. 9-12) and its photos of the
// opened switching part (Abb. 23, 39): the galvanised base plate with its 10 fixing points, the copper earthing plate
// that shorts the three poles, per pole a steel sleeve and a cycloaliphatic epoxy housing filled with insulating oil
// around a fixed contact at the high-voltage terminal and a moving contact at earth; behind the plate, under the hood,
// per pole a disc spring stack, a crosshead on two guide rods with helical springs, the latch tongue, the solenoid,
// the position switches and the charging spindle the Spannwerkzeug screws into. Outside: three busbars to the cable
// compartment where the arc strikes, a point light sensor, and the charging tool with its SW24 spanner.
//
// The housing, plate, hood and drawings are to scale. The mechanism inside is a schematic reading of the manual's
// photos, sized to fit the switching part; its numbers come from quench.js (DRIVE).
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {DEV, DRIVE, POLES} from './quench.js';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
// layout (m): z = 0 the front face of the base plate, the pole axis at y = 0
export const L = {
  floorY: -DEV.axisH, // the switching part's floor
  rearZ: -DEV.rearD,
  toolY: -DEV.axisH + DEV.toolY, // the charging axis, 37 mm under the pole axis
  bulkZ: -0.209, // the spring seat's front face
  frontZ: -0.03, // front bulkhead behind the base plate
  ch: 0.012, // crosshead thickness
  tipOpen: 0.197, // moving contact tip, open
  fixedZ: DEV.poleLen - 0.06, // fixed contact (tulip) mouth
  busZ: DEV.poleLen + 0.015, // busbar plane: straight bars bolted flat on the terminals
  arcY: -0.36,
  slope: [[-DEV.rearD, -DEV.axisH + DEV.rearHBack], [-0.035, 0.1]], // hood ridge: rear top to the front top
};
const STACK0 = DRIVE.discs * (DRIVE.discT + DRIVE.discH); // free length of the disc stack
/** crosshead centre z for contact travel x (0 open, L closed) */
export const crossZ = (x) => L.bulkZ + STACK0 - (DRIVE.A - x) + L.ch / 2;
const ROD = L.tipOpen - crossZ(0);
const hoodY = (z) => {
  const [[z0, y0], [z1, y1]] = L.slope;
  return z >= z1 ? y1 : y0 + ((z - z0) / (z1 - z0)) * (y1 - y0);
};

// ------------------------------------------------------------ geometry helpers
function lathe(points, seg = 64) {
  const g = new THREE.LatheGeometry(points.map(([r, z]) => new THREE.Vector2(r, z)), seg);
  g.rotateX(Math.PI / 2);
  return g;
}
// the epoxy housing: a smooth base, three deep sheds, a domed front; a wall around the oil cavity
function housingGeo() {
  const out = [];
  const z0 = 0.072;
  const shedA = 0.148;
  const pitch = 0.028;
  const domeA = shedA + 3 * pitch;
  const front = 0.262;
  out.push([0.062, z0], [0.084, z0 + 0.003], [0.086, z0 + 0.01]);
  for (let z = z0 + 0.012; z < shedA; z += 0.01) out.push([0.086, z]);
  for (let i = 0; i <= 84; i++) {
    const z = shedA + (i / 84) * 3 * pitch;
    const v = ((z - shedA) / pitch) % 1;
    const c = 0.5 + 0.5 * Math.cos(TAU * v);
    out.push([0.066 + 0.02 * Math.pow(c, 0.55), z]);
  }
  for (let i = 1; i <= 16; i++) {
    const a = (i / 16) * (Math.PI / 2);
    out.push([0.031 + 0.055 * Math.cos(a), domeA + (front - domeA) * Math.sin(a)]);
  }
  out.push([0.028, front]);
  // the inside: the face behind the terminal, the oil cavity back to the sleeve
  out.push([0.02, front - 0.012], [0.05, front - 0.02], [0.054, front - 0.03], [0.054, z0 + 0.012], [0.062, z0]);
  return lathe(out, 72);
}
function oilGeo() {
  return lathe([[0.0, 0.034], [0.051, 0.034], [0.053, 0.04], [0.053, 0.23], [0.048, 0.24], [0.018, 0.245], [0.0, 0.245]], 48);
}
// a ring (washer-like) along z
function ring(ro, ri, len, seg = 48) {
  return lathe([[ri, 0], [ro, 0], [ro, len], [ri, len], [ri, 0]], seg);
}
function hexPrism(af, len) {
  const g = new THREE.CylinderGeometry(af / Math.sqrt(3), af / Math.sqrt(3), len, 6);
  g.rotateX(Math.PI / 2);
  g.rotateZ(Math.PI / 6);
  return g;
}
// a coil spring along +z from 0 to 1 (scaled to length in z), radius r, wire w, n turns
function helixGeo(r, w, n) {
  const pts = [];
  const N = n * 24;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * n * TAU;
    pts.push(new V3(r * Math.cos(a), r * Math.sin(a), i / N));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, w / 2, 6, false);
}
// a thread on a rod: the same helix, tight, along +z
const threadGeo = (r, len, pitch) => {
  const g = helixGeo(r, 0.0016, Math.round(len / pitch));
  g.scale(1, 1, len);
  return g;
};
// one Belleville disc: a coned annulus with thickness, inner edge at z = 0, outer edge at z = h0 (flip for the next)
function discGeo() {
  const {discOD, discID, discT, discH} = DRIVE;
  const ro = discOD / 2;
  const ri = discID / 2;
  return lathe([[ri, 0], [ri, discT], [ro, discT + discH], [ro, discH], [ri, 0]], 40);
}
// the base plate: 740 x 216 with the three pole bores, the flanges bent back
function plateGeo() {
  const sh = new THREE.Shape();
  const w = DEV.plateW / 2;
  const h = DEV.plateH / 2;
  sh.moveTo(-w, -h);
  sh.lineTo(w, -h);
  sh.lineTo(w, h);
  sh.lineTo(-w, h);
  sh.closePath();
  for (const x of POLES) {
    const p = new THREE.Path();
    p.absarc(x, 0, 0.074, 0, TAU, true);
    sh.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(sh, {depth: 0.003, bevelEnabled: false, curveSegments: 48});
  g.translate(0, 0, -0.003);
  return g;
}
// the copper earthing plate: a band across the three poles, a round boss at each, the tab with the M12 earth point
function copperParts() {
  const parts = [];
  for (const [a, b] of [[-0.355, POLES[0] - 0.074], [POLES[0] + 0.074, POLES[1] - 0.074], [POLES[1] + 0.074, POLES[2] - 0.074], [POLES[2] + 0.074, 0.305]]) {
    const g = new RoundedBoxGeometry(b - a, 0.09, 0.006, 2, 0.0015);
    g.translate((a + b) / 2, 0, 0.003);
    parts.push(g);
  }
  return parts;
}
// the hood's side panel: the switching part's profile (floor, rear, ridge, front)
function hoodSideGeo() {
  const sh = new THREE.Shape();
  const top = L.slope;
  sh.moveTo(L.rearZ, top[0][1] - 0.03);
  sh.lineTo(L.rearZ, top[0][1]);
  sh.lineTo(top[1][0], top[1][1]);
  sh.lineTo(-0.004, top[1][1]);
  sh.lineTo(-0.004, top[1][1] - 0.03);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, {depth: 0.002, bevelEnabled: false});
  // shape x = world z, shape y = world y, depth = world x
  g.rotateY(-Math.PI / 2);
  return g;
}
// a flat strip between two points in the yz plane, width along x
function strip(z0, y0, z1, y1, w, t) {
  const len = Math.hypot(z1 - z0, y1 - y0);
  const g = new THREE.BoxGeometry(w, t, len);
  const m = new THREE.Matrix4().makeRotationX(-Math.atan2(y1 - y0, z1 - z0));
  g.applyMatrix4(m);
  g.translate(0, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

// rating plate after Abb. 6, as a canvas texture
function plateTex() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 340;
  const g = c.getContext('2d');
  g.fillStyle = '#eceae4';
  g.fillRect(0, 0, 512, 340);
  g.strokeStyle = '#2a2b2e';
  g.lineWidth = 3;
  g.strokeRect(6, 6, 500, 328);
  g.fillStyle = '#1d1e21';
  g.font = '700 30px Inter, Arial, sans-serif';
  g.fillText('SIQuench® 3AM4', 24, 48);
  g.font = '500 21px "JetBrains Mono", monospace';
  const rows = [
    ['Typ 3AM4143-1DA12', ''],
    ['Ur   24 kV', 'fr  50/60 Hz'],
    ['Up  125 kV', 'Ik  31.5 kA'],
    ['', 'tk     3 s'],
    ['Mech. 30 ops', 'M  60 kg'],
    ['IEC 62271-102', 'Class E2'],
  ];
  rows.forEach(([a, b], i) => {
    g.fillText(a, 24, 92 + i * 38);
    g.fillText(b, 280, 92 + i * 38);
    g.fillRect(18, 102 + i * 38, 476, 1);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function glowTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const ACCENT = '#00a0a0';

export function buildDevice() {
  const M = {
    zinc: new THREE.MeshStandardMaterial({color: '#bfc3c7', roughness: 0.48, metalness: 0.75, envMapIntensity: 0.6}),
    hood: new THREE.MeshStandardMaterial({color: '#c4c7cb', roughness: 0.5, metalness: 0.7, envMapIntensity: 0.6, side: THREE.DoubleSide}),
    frame: new THREE.MeshStandardMaterial({color: '#aeb2b7', roughness: 0.5, metalness: 0.7, envMapIntensity: 0.5}),
    copper: new THREE.MeshStandardMaterial({color: '#c27448', roughness: 0.38, metalness: 1, envMapIntensity: 0.7}),
    sleeve: new THREE.MeshStandardMaterial({color: '#b6babf', roughness: 0.42, metalness: 0.85, envMapIntensity: 0.6}),
    epoxy: new THREE.MeshPhysicalMaterial({color: '#8a8474', roughness: 0.62, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.6, side: THREE.DoubleSide, envMapIntensity: 0.7}),
    alu: new THREE.MeshStandardMaterial({color: '#d7d9dc', roughness: 0.3, metalness: 0.9}),
    steel: new THREE.MeshStandardMaterial({color: '#9aa0a6', roughness: 0.35, metalness: 0.95}),
    spring: new THREE.MeshStandardMaterial({color: '#7a7f86', roughness: 0.38, metalness: 0.85}),
    disc: new THREE.MeshStandardMaterial({color: '#a3a9b0', roughness: 0.32, metalness: 0.85}),
    dark: new THREE.MeshStandardMaterial({color: '#232427', roughness: 0.55, metalness: 0.3}),
    black: new THREE.MeshStandardMaterial({color: '#141517', roughness: 0.6, metalness: 0.1}),
    coil: new THREE.MeshStandardMaterial({color: '#b5672f', roughness: 0.32, metalness: 0.9, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0}),
    tongue: new THREE.MeshStandardMaterial({color: '#4c5157', roughness: 0.35, metalness: 0.9, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0}),
    cross: new THREE.MeshStandardMaterial({color: '#8b9097', roughness: 0.36, metalness: 0.9, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0}),
    contact: new THREE.MeshStandardMaterial({color: '#c98a5c', roughness: 0.3, metalness: 1, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0}),
    silver: new THREE.MeshStandardMaterial({color: '#e2e4e6', roughness: 0.22, metalness: 1}),
    oil: new THREE.MeshPhysicalMaterial({color: '#d9a53c', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide}),
    switchBody: new THREE.MeshStandardMaterial({color: '#2f3a33', roughness: 0.6, metalness: 0.1}),
    tool: new THREE.MeshStandardMaterial({color: '#3c3f44', roughness: 0.35, metalness: 0.9, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0}),
    spanner: new THREE.MeshStandardMaterial({color: '#a9aeb4', roughness: 0.3, metalness: 1}),
    sensor: new THREE.MeshStandardMaterial({color: '#2b8fd6', roughness: 0.5, metalness: 0.1}),
    rating: new THREE.MeshStandardMaterial({map: plateTex(), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2}),
    bus: new THREE.MeshStandardMaterial({color: '#c27448', roughness: 0.4, metalness: 1, envMapIntensity: 0.6}),
  };
  // materials that go to glass in x-ray and get the section plane
  const SHELL = [M.zinc, M.hood, M.frame, M.copper, M.sleeve, M.epoxy, M.alu, M.rating];
  const all = [];
  const add = (parent, geo, mat, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    parent.add(m);
    all.push(m);
    return m;
  };
  const root = new THREE.Group();

  // ------------------------------------------------------------ base plate, flanges, fixing points
  const plateG = new THREE.Group();
  root.add(plateG);
  add(plateG, plateGeo(), M.zinc);
  const w = DEV.plateW / 2;
  const h = DEV.plateH / 2;
  for (const s of [-1, 1]) {
    add(plateG, new THREE.BoxGeometry(DEV.plateW, 0.003, 0.028), M.zinc).position.set(0, s * (h - 0.0015), -0.017);
    const side = add(plateG, new THREE.BoxGeometry(0.003, DEV.plateH - 0.006, 0.03), M.zinc);
    side.position.set(s * (w - 0.006), 0, -0.016);
    side.rotation.y = s * 0.35;
  }
  const FIX = [...POLES.map((x) => [x, 0.088]), ...POLES.map((x) => [x, -0.088]), [-0.345, 0.045], [-0.345, -0.045], [0.345, 0.045], [0.345, -0.045]];
  const boltHead = hexPrism(0.013, 0.006);
  const washer = ring(0.0085, 0.0045, 0.0015, 20);
  for (const [x, y] of FIX) {
    add(plateG, washer, M.steel).position.set(x, y, 0);
    add(plateG, boltHead, M.steel).position.set(x, y, 0.0045);
  }

  // ------------------------------------------------------------ copper earthing plate, the three poles
  const poleG = new THREE.Group();
  root.add(poleG);
  for (const g of copperParts()) add(poleG, g, M.copper);
  add(poleG, new THREE.CylinderGeometry(0.0075, 0.0075, 0.0015, 20).rotateX(Math.PI / 2), M.black, false).position.set(-0.33, 0, 0.0065);
  add(poleG, hexPrism(0.018, 0.008), M.steel).position.set(-0.33, 0, 0.011);
  const boss = ring(0.09, 0.074, 0.008, 64);
  const housingG = housingGeo();
  const collar = ring(0.088, 0.072, 0.024, 64);
  const sleeveG = ring(0.077, 0.06, 0.05, 64);
  const oilG = oilGeo();
  const tulip = lathe([[0.006, 0], [0.0135, 0], [0.0135, 0.04], [0.011, 0.045], [0.008, 0.045], [0.008, 0.008], [0.006, 0.008]], 24);
  const terminal = lathe([[0.0, 0], [0.0275, 0], [0.0275, 0.013], [0.0, 0.013]], 48);
  const termHole = new THREE.CylinderGeometry(0.0034, 0.0034, 0.0012, 12).rotateX(Math.PI / 2);
  const oilScrew = hexPrism(0.008, 0.004);
  const slider = ring(0.016, 0.0085, 0.022, 32);
  const poleNut = hexPrism(0.013, 0.007);
  const poles = POLES.map((px, i) => {
    const g = new THREE.Group();
    g.position.x = px;
    poleG.add(g);
    add(g, boss, M.copper);
    add(g, collar, M.copper).position.z = 0.008;
    add(g, sleeveG, M.sleeve).position.z = 0.03;
    add(g, housingG, M.epoxy);
    const oil = add(g, oilG, M.oil, false);
    oil.renderOrder = 2;
    add(g, terminal, M.alu).position.z = 0.262;
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      add(g, termHole, M.black, false).position.set(0.016 * Math.cos(a), 0.016 * Math.sin(a), 0.2752);
    }
    add(g, oilScrew, M.steel).position.z = 0.2765;
    // fixed contact: the tulip from the terminal's back into the oil
    const tul = add(g, tulip, M.contact);
    tul.position.z = L.fixedZ;
    add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.262 - L.fixedZ - 0.045, 16).rotateX(Math.PI / 2), M.contact).position.z = (0.262 + L.fixedZ + 0.045) / 2;
    // the sliding contact at earth where the rod enters the oil
    add(g, slider, M.copper).position.z = 0.012;
    // the four hex nuts around the pole on the copper
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      add(g, poleNut, M.steel).position.set(0.098 * Math.cos(a), 0.098 * Math.sin(a), 0.0115);
    }
    return {g, oil, i};
  });

  // ------------------------------------------------------------ the switching part: frame, bulkheads, hood
  const frameG = new THREE.Group();
  root.add(frameG);
  const RW = DEV.rearW;
  const rearTop = L.slope[0][1];
  add(frameG, new THREE.BoxGeometry(RW, 0.004, DEV.rearD - 0.003), M.frame).position.set(0, L.floorY + 0.002, L.rearZ / 2 - 0.0015);
  // the rear wall carries the three actuation openings (16.1 mm) on the charging axis
  {
    const sh = new THREE.Shape();
    sh.moveTo(-RW / 2, L.floorY);
    sh.lineTo(RW / 2, L.floorY);
    sh.lineTo(RW / 2, rearTop);
    sh.lineTo(-RW / 2, rearTop);
    sh.closePath();
    for (const x of POLES) {
      const p = new THREE.Path();
      p.absarc(x, L.toolY, 0.00805, 0, TAU, true);
      sh.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(sh, {depth: 0.003, bevelEnabled: false, curveSegments: 24});
    add(frameG, g, M.frame).position.z = L.rearZ;
    for (const x of POLES) {
      const boss = add(frameG, ring(0.016, 0.0081, 0.008, 32), M.steel);
      boss.position.set(x, L.toolY, L.rearZ - 0.008);
    }
    // three gussets under the rear wall (the Schaltteil's feet in Abb. 2)
    for (const x of [-0.2, 0, 0.2]) {
      const gs = new THREE.Shape();
      gs.moveTo(0, 0);
      gs.lineTo(0.05, 0);
      gs.lineTo(0.0, -0.045);
      gs.closePath();
      const gg = new THREE.ExtrudeGeometry(gs, {depth: 0.003, bevelEnabled: false});
      gg.rotateY(-Math.PI / 2);
      add(frameG, gg, M.frame).position.set(x + 0.0015, L.floorY, L.rearZ + 0.002);
    }
  }
  // spring seat bulkhead and front bulkhead, shared by the three poles
  const bulk = add(frameG, new THREE.BoxGeometry(RW - 0.02, 0.1, 0.006), M.frame);
  bulk.position.set(0, L.toolY - 0.012, L.bulkZ - 0.003);
  const fbulk = add(frameG, new THREE.BoxGeometry(RW - 0.02, 0.12, 0.005), M.frame);
  fbulk.position.set(0, -0.02, L.frontZ);
  for (const s of [-1, 1]) {
    const cheek = add(frameG, new THREE.BoxGeometry(0.004, 0.13, L.frontZ - L.bulkZ), M.frame);
    cheek.position.set(s * (RW / 2 - 0.012), -0.04, (L.frontZ + L.bulkZ) / 2);
  }
  // the hood: ridge and top as one bent sheet, the two side panels, the rating plate on the right
  const hoodG = new THREE.Group();
  root.add(hoodG);
  add(hoodG, strip(L.rearZ, rearTop, L.slope[1][0], L.slope[1][1], RW, 0.002), M.hood);
  add(hoodG, strip(L.slope[1][0], L.slope[1][1], -0.004, L.slope[1][1], RW, 0.002), M.hood);
  add(hoodG, strip(L.rearZ, rearTop, L.rearZ, rearTop - 0.03, RW, 0.002), M.hood);
  for (const s of [-1, 1]) add(hoodG, hoodSideGeo(), M.hood).position.x = s * (RW / 2) + (s > 0 ? 0.002 : 0);
  {
    const rp = add(hoodG, new THREE.PlaneGeometry(0.075, 0.05), M.rating, false);
    rp.rotation.y = Math.PI / 2;
    rp.position.set(RW / 2 + 0.0035, 0.02, -0.06);
  }
  // hood screws (M6 hex socket) along the ridge
  for (const x of [-0.25, -0.08, 0.08, 0.25]) {
    const sc = add(hoodG, new THREE.CylinderGeometry(0.0045, 0.0045, 0.003, 16), M.steel);
    sc.position.set(x, rearTop + 0.0015, L.rearZ + 0.012);
  }
  // cable outlet (Kabelauslass) on the top with the two control cables and their 8-pin connectors
  const cableG = new THREE.Group();
  hoodG.add(cableG);
  {
    const gx = -0.22;
    const gz = -0.02;
    const gy = L.slope[1][1];
    add(cableG, new THREE.CylinderGeometry(0.011, 0.012, 0.016, 20), M.black).position.set(gx, gy + 0.008, gz);
    const cab = (dx, end) => {
      const c = new THREE.CatmullRomCurve3([new V3(gx + dx, gy + 0.01, gz), new V3(gx + dx, gy + 0.08, gz - 0.01), new V3(end.x - 0.02, end.y + 0.05, end.z + 0.04), end]);
      add(cableG, new THREE.TubeGeometry(c, 40, 0.0042, 8, false), M.black);
      const plug = add(cableG, new RoundedBoxGeometry(0.06, 0.016, 0.022, 2, 0.003), M.dark);
      plug.position.copy(end);
      plug.rotation.y = -0.5;
    };
    cab(-0.004, new V3(gx - 0.12, gy + 0.11, gz - 0.12));
    cab(0.004, new V3(gx - 0.17, gy + 0.06, gz - 0.08));
  }

  // ------------------------------------------------------------ the mechanism, one per pole
  const discG = discGeo();
  const helix = helixGeo(0.0085, 0.0028, 9);
  const guide = new THREE.CylinderGeometry(0.005, 0.005, L.frontZ - L.bulkZ, 14).rotateX(Math.PI / 2);
  const spindle = new THREE.CylinderGeometry(0.0075, 0.0075, 1, 16).rotateX(Math.PI / 2);
  const crossGeo = new RoundedBoxGeometry(0.13, 0.072, L.ch, 2, 0.003);
  const lipGeo = new RoundedBoxGeometry(0.03, 0.01, L.ch, 2, 0.002);
  const tongueShape = (() => {
    // the latch tongue in its own frame: pivot at the origin, the hook reaching back (-z) and down, the tail forward
    const s = new THREE.Shape();
    s.moveTo(0.022, -0.004);
    s.lineTo(0.022, 0.006);
    s.lineTo(-0.032, 0.006);
    s.lineTo(-0.038, 0.0);
    s.lineTo(-0.038, -0.016);
    s.lineTo(-0.033, -0.016);
    s.lineTo(-0.03, -0.006);
    s.lineTo(0.0, -0.006);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {depth: 0.018, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1});
    g.translate(0, 0, -0.009);
    g.rotateY(-Math.PI / 2); // shape x -> world z, shape y -> world y
    return g;
  })();
  const coilBody = new THREE.CylinderGeometry(0.016, 0.016, 0.03, 28);
  const yokePlate = new THREE.BoxGeometry(0.046, 0.004, 0.04);
  const yokeBack = new THREE.BoxGeometry(0.004, 0.038, 0.04);
  const plunger = new THREE.CylinderGeometry(0.0055, 0.0055, 0.045, 16);
  const swBox = new RoundedBoxGeometry(0.022, 0.026, 0.012, 2, 0.002);
  const swLever = new THREE.BoxGeometry(0.0015, 0.004, 0.022);
  const bush = ring(0.012, 0.0075, 0.012, 24);
  const PIV = {y: 0.038, z: crossZ(0) + L.ch / 2 + 0.038}; // hook's rear face on the charged lip's front face // the tongue's pivot; its hook rests on the crosshead's lip
  const mechs = POLES.map((px, i) => {
    const g = new THREE.Group();
    g.position.x = px;
    root.add(g);
    // guide rods and their helical springs, both sides of the stack
    const springs = [];
    for (const s of [-1, 1]) {
      add(g, guide, M.steel).position.set(s * 0.05, L.toolY, (L.frontZ + L.bulkZ) / 2);
      const sp = add(g, helix, M.spring);
      sp.position.set(s * 0.05, L.toolY, L.bulkZ);
      springs.push(sp);
    }
    // the disc stack, alternating
    const discs = [];
    for (let k = 0; k < DRIVE.discs; k++) {
      const d = add(g, discG, M.disc);
      d.position.y = L.toolY;
      if (k % 2) d.rotation.y = Math.PI;
      discs.push(d);
    }
    // the moving group: crosshead, lip, spindle with its thread, the contact rod up to the tip
    const mov = new THREE.Group();
    g.add(mov);
    const crossM = M.cross.clone();
    const cross = add(mov, crossGeo, crossM);
    cross.position.y = L.toolY + 0.026;
    const lip = add(mov, lipGeo, crossM);
    lip.position.set(0, 0.0255, 0);
    const sp = add(mov, spindle, M.steel);
    const spLen = -(L.rearZ + 0.006) + crossZ(0);
    sp.scale.z = spLen;
    sp.position.set(0, L.toolY, -spLen / 2);
    // the spindle's rear end: a threaded sleeve the tool screws into
    add(mov, ring(0.0105, 0.0079, 0.03, 24), M.spring).position.set(0, L.toolY, -spLen);
    // spring seat washer on the crosshead
    add(mov, ring(0.042, 0.009, 0.004, 40), M.steel).position.set(0, L.toolY, -L.ch / 2 - 0.004);
    // the contact rod: steel behind the plate, copper in the oil, a silvered tip
    const rodSteel = add(mov, new THREE.CylinderGeometry(0.007, 0.007, 1, 16).rotateX(Math.PI / 2), M.steel);
    const zPlate = 0.012 - crossZ(0);
    rodSteel.scale.z = zPlate;
    rodSteel.position.z = zPlate / 2;
    const rodCu = add(mov, new THREE.CylinderGeometry(0.0085, 0.0085, 1, 20).rotateX(Math.PI / 2), M.contact);
    rodCu.scale.z = ROD - zPlate - 0.012;
    rodCu.position.z = zPlate + (ROD - zPlate - 0.012) / 2;
    const tip = add(mov, new THREE.SphereGeometry(0.0086, 20, 12, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2), M.silver);
    tip.position.z = ROD - 0.012;
    add(mov, new THREE.CylinderGeometry(0.0086, 0.0086, 0.012, 20).rotateX(Math.PI / 2), M.silver).position.z = ROD - 0.006;
    // a flag that works the position switches
    const flag = add(mov, new THREE.BoxGeometry(0.014, 0.006, 0.008), crossM);
    flag.position.set(-0.045, 0.028, 0);
    // bushings in the front bulkhead (contact rod) and spring seat (spindle)
    add(g, bush, M.steel).position.set(0, 0, L.frontZ - 0.006);
    add(g, ring(0.014, 0.0078, 0.01, 24), M.steel).position.set(0, L.toolY, L.bulkZ - 0.01);
    // the latch tongue on its pivot pin
    const tongueG = new THREE.Group();
    tongueG.position.set(0, PIV.y, PIV.z);
    g.add(tongueG);
    add(tongueG, tongueShape, M.tongue);
    const pin = add(g, new THREE.CylinderGeometry(0.0035, 0.0035, 0.034, 12).rotateZ(Math.PI / 2), M.steel);
    pin.position.set(0, PIV.y, PIV.z);
    for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(0.003, 0.03, 0.02), M.frame).position.set(s * 0.015, PIV.y + 0.006, PIV.z);
    // the solenoid over the tongue's tail: coil, yoke, plunger
    const solG = new THREE.Group();
    solG.position.set(0, PIV.y + 0.0335, PIV.z + 0.016);
    g.add(solG);
    for (const s of [-1, 1]) add(solG, yokePlate, M.dark).position.y = s * 0.017;
    add(solG, yokeBack, M.dark).position.x = -0.021;
    const coil = add(solG, coilBody, M.coil);
    coil.position.y = 0.0;
    coil.scale.set(1.02, 1.02, 1.02);
    const plng = add(solG, plunger, M.steel);
    // the switches: S1 (contact position) and S2 (charged) on a bracket beside the crosshead, S3 (oil) near the plate
    const sw = [];
    for (const z of [crossZ(0) - 0.003, crossZ(DRIVE.L) + 0.003]) {
      const b = add(g, swBox, M.switchBody);
      b.position.set(-0.045, 0.047, z);
      const lv = add(g, swLever, M.steel);
      lv.position.set(-0.045, 0.033, z);
      sw.push(lv);
    }
    add(g, new THREE.BoxGeometry(0.03, 0.003, 0.06), M.frame).position.set(-0.045, 0.0615, crossZ(DRIVE.L / 2));
    const s3 = add(g, swBox, M.switchBody);
    s3.position.set(-0.05, 0.03, L.frontZ - 0.012);
    return {g, mov, discs, springs, tongueG, plng, coil, sw, solG, crossM};
  });

  // ------------------------------------------------------------ the charging tool and the SW24 spanner
  const toolG = new THREE.Group();
  root.add(toolG);
  const toolSpin = new THREE.Group();
  toolG.add(toolSpin);
  {
    // hex bar SW24 (Abb. 29) with its cross hole, a shank that passes the 16.1 mm opening, a threaded tip; origin at
    // the tip, the hex's shoulder seats on the opening's boss
    add(toolSpin, hexPrism(0.024, 0.08), M.tool).position.z = -0.094;
    add(toolSpin, new THREE.CylinderGeometry(0.0076, 0.0076, 0.028, 16).rotateX(Math.PI / 2), M.tool).position.z = -0.04;
    add(toolSpin, threadGeo(0.0079, 0.026, DRIVE.pitch), M.spring).position.z = -0.026;
    add(toolSpin, new THREE.CylinderGeometry(0.0074, 0.0074, 0.026, 16).rotateX(Math.PI / 2), M.tool).position.z = -0.013;
    add(toolSpin, new THREE.CylinderGeometry(0.0028, 0.0028, 0.0245, 10), M.black).position.z = -0.12;
    // the open-end spanner on the hex
    add(toolSpin, new RoundedBoxGeometry(0.028, 0.16, 0.006, 2, 0.002), M.spanner).position.set(0, 0.096, -0.075);
    const jaw = add(toolSpin, new THREE.TorusGeometry(0.0175, 0.0055, 8, 6), M.spanner);
    jaw.position.z = -0.075;
    jaw.rotation.z = Math.PI / 6;
  }
  toolG.visible = false;

  // ------------------------------------------------------------ the switchgear context: busbars, the arc, a light sensor
  const sysG = new THREE.Group();
  root.add(sysG);
  for (const x of POLES) {
    // a straight flat bar bolted on the terminal face with four M8, hanging into the cable compartment
    const top = 0.04;
    const bot = L.arcY - 0.09;
    const bar = add(sysG, new RoundedBoxGeometry(0.06, top - bot, 0.01, 2, 0.002), M.bus);
    bar.position.set(x, (top + bot) / 2, DEV.poleLen + 0.006);
    for (const dy of [0.016, -0.016]) for (const dx of [-0.016, 0.016]) add(sysG, hexPrism(0.013, 0.006), M.steel).position.set(x + dx * 0.71, dy * 0.71, DEV.poleLen + 0.014);
  }
  const sensor = new THREE.Group();
  sysG.add(sensor);
  add(sensor, new RoundedBoxGeometry(0.03, 0.05, 0.018, 2, 0.004), M.sensor);
  add(sensor, new THREE.CylinderGeometry(0.006, 0.006, 0.006, 16).rotateX(Math.PI / 2), M.black).position.z = 0.01;
  sensor.position.set(-0.36, L.arcY + 0.08, L.busZ + 0.03);
  {
    const c = new THREE.CatmullRomCurve3([new V3(-0.36, L.arcY + 0.105, L.busZ + 0.03), new V3(-0.37, L.arcY + 0.25, L.busZ + 0.02), new V3(-0.42, -0.1, 0.2), new V3(-0.5, 0.05, 0.12)]);
    add(sysG, new THREE.TubeGeometry(c, 60, 0.0022, 6, false), M.dark);
  }
  // the arc: two glowing jagged channels between the phase bars and a halo, rebuilt each frame from the event clock
  const ARC_N = 26;
  const arcG = new THREE.Group();
  sysG.add(arcG);
  const arcMat = new THREE.MeshBasicMaterial({color: '#fff6e8', transparent: true, opacity: 1, toneMapped: false});
  const arcHaloMat = new THREE.SpriteMaterial({map: glowTex(), color: '#b9a8ff', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false});
  const arcs = [0, 1, 2].map(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(ARC_N * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(), new V3(0, 0, 0.01)]), 4, 0.002, 4), arcMat);
    arcG.add(tube);
    return {tube, pos};
  });
  const halos = [0, 1, 2, 3, 4].map(() => {
    const s = new THREE.Sprite(arcHaloMat);
    s.renderOrder = 10;
    arcG.add(s);
    return s;
  });
  const flash = new THREE.PointLight('#d8d0ff', 0, 3, 1.6);
  flash.position.set(0, L.arcY, L.busZ + 0.12);
  sysG.add(flash);

  // current in the metal path: dots that run up the bars, along the pole into the contact and out over the copper
  const FLOW_N = 26;
  const flowPaths = POLES.map((x, i) => {
    const pts = [new V3(x, L.arcY - 0.06, L.busZ), new V3(x, -0.04, L.busZ), new V3(x, 0.0, DEV.poleLen + 0.004), new V3(x, 0, L.fixedZ + 0.02), new V3(x, 0, 0.02), new V3(x, 0.07, 0.012), new V3(0 + (i - 1) * 0.06, 0.06, 0.012)];
    return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
  });
  const flowGeo = new THREE.BufferGeometry();
  const flowPos = new Float32Array(3 * FLOW_N * 3);
  flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
  const flowMat = new THREE.PointsMaterial({color: ACCENT, size: 0.014, map: glowTex(), transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: true, toneMapped: false});
  const flow = new THREE.Points(flowGeo, flowMat);
  flow.renderOrder = 12;
  flow.frustumCulled = false;
  root.add(flow);

  // ------------------------------------------------------------ display modes
  const CLIP = new THREE.Plane(new V3(-1, 0, 0), 0);
  const CLIPS = [CLIP];
  let xrayNow = -1;
  let sectionNow = -2;
  const setXray = (k) => {
    if (Math.abs(k - xrayNow) < 1e-3) return;
    xrayNow = k;
    for (const m of SHELL) {
      m.transparent = k > 0.001;
      m.opacity = 1 - (m === M.epoxy ? 0.8 : 0.86) * k;
      m.depthWrite = k < 0.5;
      m.needsUpdate = true;
    }
    M.oil.opacity = 0.22 + 0.2 * k;
  };
  const setSection = (pole) => {
    if (pole === sectionNow) return;
    sectionNow = pole;
    if (pole >= 0) CLIP.constant = POLES[pole] + 0.0005;
    for (const m of [...SHELL, M.oil]) {
      m.clippingPlanes = pole >= 0 ? CLIPS : null;
      m.side = pole >= 0 || m === M.epoxy || m === M.oil || m === M.hood ? THREE.DoubleSide : THREE.FrontSide;
      m.needsUpdate = true;
    }
  };
  // jagged arc channel points between bars a and b (pure: hashed from the tick)
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const tmp = new V3();
  const out = {flowCurves: flowPaths, PIV, flowObj: flow, arcObj: arcG};

  /**
   * s: {poles: [poleState x3] (from quench.js), tool: {pole, in, turns} | null, hood 0..1 (1 on), xray 0..1,
   *     section pole index | -1, explode 0..1, sys 0..1 (busbars and arc context), arc 0..1 (arc brightness),
   *     arcTick (an integer that changes the arc's shape), flow 0..1, flowPhase (dots' phase), active {coil, tongue,
   *     cross, contact, tool} 0..1 glow on the part doing the work}
   */
  const update = (s) => {
    setXray(s.xray ?? 0);
    setSection(s.section ?? -1);
    const e = s.explode ?? 0;
    hoodG.visible = (s.hood ?? 1) > 0.01;
    hoodG.position.y = 0.22 * e + 0.25 * (1 - (s.hood ?? 1));
    poleG.position.z = 0.16 * e;
    frameG.position.y = -0.05 * e;
    toolG.position.y = -0.05 * e;
    const act = s.active || {};
    M.coil.emissiveIntensity = 0.5 * (act.coil ?? 0);
    M.tongue.emissiveIntensity = 0.9 * (act.tongue ?? 0);
    M.contact.emissiveIntensity = 0.45 * (act.contact ?? 0);
    M.tool.emissiveIntensity = 0.6 * (act.tool ?? 0);

    mechs.forEach((m, i) => {
      const p = s.poles[i];
      m.g.position.y = -0.05 * e;
      m.g.position.z = -0.1 * e;
      const zc = crossZ(p.x);
      m.mov.position.z = zc;
      m.crossM.emissiveIntensity = 0.5 * (Array.isArray(act.cross) ? act.cross[i] : act.cross ?? 0);
      // the disc stack from the seat to the crosshead: each disc's pitch shortens with the deflection
      const len = zc - L.ch / 2 - L.bulkZ;
      const pitch = len / DRIVE.discs;
      const k = pitch / (DRIVE.discT + DRIVE.discH);
      m.discs.forEach((d, j) => {
        d.scale.z = k;
        d.position.z = L.bulkZ + j * pitch + (j % 2 ? pitch : 0);
      });
      for (const sp of m.springs) sp.scale.z = len - 0.004;
      // the tongue lifts when the plunger strikes it, rides the lip while it passes, drops behind it at the end
      const lipFront = zc + L.ch / 2;
      const onLip = lipFront > PIV.z - 0.038 + 0.0008 && zc - L.ch / 2 < PIV.z - 0.03 ? 1 : 0;
      const lift = Math.max(p.tongue ?? 0, p.latched ? 0 : onLip * 0.75);
      m.tongueG.rotation.x = -0.42 * lift;
      m.plng.position.y = -0.001 - 0.007 * (p.plunger ?? 0);
      // switch levers: pressed when the flag sits on them
      m.sw[0].rotation.x = Math.abs(zc - crossZ(0)) < 0.004 ? -0.35 : 0;
      m.sw[1].rotation.x = Math.abs(zc - crossZ(DRIVE.L)) < 0.004 ? -0.35 : 0;
    });

    // the tool: on the pole it charges, sliding in, turning
    const t = s.tool;
    toolG.visible = !!t && t.in > 0.001;
    if (toolG.visible) {
      toolG.position.x = POLES[t.pole];
      toolG.position.z = L.rearZ - 0.008 + 0.054 - 0.16 * (1 - t.in) - 0.1 * e;
      toolG.position.y = L.toolY - 0.05 * e;
      toolSpin.rotation.z = t.turns * TAU;
    }

    // context: busbars, sensor, the arc
    const sys = s.sys ?? 0;
    sysG.visible = sys > 0.01;
    sysG.position.z = 0.16 * e;
    const a = s.arc ?? 0;
    arcG.visible = sysG.visible && a > 0.01;
    flash.intensity = 6 * a * sys;
    if (arcG.visible) {
      const tick = s.arcTick ?? 0;
      const pairs = [[0, 1], [1, 2], [0, 2]];
      pairs.forEach(([ia, ib], k) => {
        const xa = POLES[ia] + 0.026;
        const xb = POLES[ib] - 0.026;
        const pts = [];
        const sag = k === 2 ? -0.07 : 0;
        for (let j = 0; j < ARC_N; j++) {
          const u = j / (ARC_N - 1);
          const env = Math.sin(Math.PI * u);
          const jit = (n) => (hash(tick * 0.37 + k * 13.1 + j * 1.7 + n) - 0.5) * 0.05 * env * (0.6 + a);
          pts.push(new V3(xa + (xb - xa) * u, L.arcY + jit(1) + sag * env + 0.02 * Math.sin(u * 9 + tick * 0.4 + k), L.busZ + 0.01 + jit(2)));
        }
        const tube = arcs[k].tube;
        tube.geometry.dispose();
        tube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), ARC_N * 2, 0.0025 + 0.004 * a, 5, false);
        tube.visible = k < 2 || a > 0.4;
      });
      arcMat.opacity = Math.min(1, a * 1.2);
      arcHaloMat.opacity = 0.75 * a;
      halos.forEach((h, j) => {
        const u = j / (halos.length - 1);
        h.position.set(POLES[0] + 0.42 * u, L.arcY + 0.01 * Math.sin(tick + j), L.busZ + 0.02);
        const sc = (0.16 + 0.12 * hash(tick + j * 3.1)) * (0.4 + a);
        h.scale.set(sc, sc, 1);
      });
    }
    // current dots in the metal path
    const f = s.flow ?? 0;
    flow.visible = f > 0.01;
    if (flow.visible) {
      flowMat.opacity = f;
      const ph = s.flowPhase ?? 0;
      let n = 0;
      flowPaths.forEach((c, i) => {
        for (let j = 0; j < FLOW_N; j++) {
          const u = (((j / FLOW_N + ph + i * 0.11) % 1) + 1) % 1;
          c.getPointAt(u, tmp);
          tmp.z += 0.16 * e;
          if (u < 0.32 && sys < 0.5) tmp.set(0, -9, 0);
          flowPos[n++] = tmp.x;
          flowPos[n++] = tmp.y;
          flowPos[n++] = tmp.z;
        }
      });
      flowGeo.attributes.position.needsUpdate = true;
    }
  };
  return {root, update, M, all, poles, mechs, toolG, sysG, hoodG, CLIP, out, crossZ, L};
}
