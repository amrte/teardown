// The 8DB10-type circuit-breaker panel built from code in metres (gis.js holds every dimension): three single-pole
// switchpanel poles one behind the other on the subframe, each with its busbar-1 and busbar-2 housings on top, the
// three-position disconnector and the busbar-2 disconnector under them, the vacuum circuit-breaker housing, the
// pervious bushing, the ring-core current transformer and the inside-cone cable connection under the frame; the
// operating cubicle and LV compartment in front, with the control board drawn live on a canvas. One ghosted
// neighbour panel on the left shows the busbars running through.
// update(s, opts) poses the blades and contacts from gis.stateAt() and sets the display modes.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {CB, COMPARTMENTS, G, gasAt, GAS, Q1A, Q1L, Q2A, Q2L, Q2P} from './gis.js';

const V3 = THREE.Vector3;
const D2R = Math.PI / 180;
export const ACCENT = '#e4572e';
export const EARTH = '#2f9e6a';

// ------------------------------------------------------------ geometry helpers
const cylY = (r, y0, y1, seg = 40, open = false) => {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg, 1, open);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
};
const cylX = (r, len, seg = 40) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
const cylZ = (r, len, seg = 32) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
const ring = (ro, ri, h, seg = 48) => new THREE.LatheGeometry([new THREE.Vector2(ri, -h / 2), new THREE.Vector2(ro, -h / 2), new THREE.Vector2(ro, h / 2), new THREE.Vector2(ri, h / 2), new THREE.Vector2(ri, -h / 2)], seg);
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// ------------------------------------------------------------ materials
const std = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.55, metalness: 0.0, envMapIntensity: 0.5, ...o});

export function buildPanel() {
  const root = new THREE.Group();
  const M = {
    alu: std('#b9bec3', {metalness: 0.55, roughness: 0.5}),
    aluDark: std('#9aa0a6', {metalness: 0.55, roughness: 0.5}),
    bush: std('#9c3f30', {roughness: 0.45}),
    bushPerv: std('#d9b46a', {roughness: 0.45}),
    steel: std('#c4c8c6', {metalness: 0.35, roughness: 0.55}),
    sheet: std('#d8dad6', {roughness: 0.7}),
    sheetDark: std('#b9bcb8', {roughness: 0.7}),
    resin: std('#e7e1d1', {roughness: 0.6}),
    ceramic: std('#f2efe8', {roughness: 0.35}),
    silicone: std('#6e7479', {roughness: 0.75}),
    cable: std('#2b2d30', {roughness: 0.8}),
    copper: std('#c47b46', {metalness: 0.85, roughness: 0.35}),
    bolt: std('#8a8f94', {metalness: 0.7, roughness: 0.4}),
    floorHole: new THREE.MeshBasicMaterial({color: '#9aa09c', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4}),
  };
  // one housing material per gas compartment, so the gas view can tint each and the x-ray can fade them
  const compMat = {};
  for (const c of COMPARTMENTS) compMat[c.id] = M.alu.clone();
  // the conductors by circuit: busbar 1, busbar 2, the feeder node between the disconnectors and the CB, the cable side
  const cond = {bb1: M.copper.clone(), bb2: M.copper.clone(), node: M.copper.clone(), cable: M.copper.clone(), earth: M.copper.clone()};
  const housingMats = [...Object.values(compMat), M.aluDark];
  const add = (geo, mat, parent = root, pos) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.copy(pos);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const bolts = [];
  const boltCircle = (centre, axis, r, n) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const u = axis === 'x' ? new V3(0, Math.cos(a), Math.sin(a)) : axis === 'y' ? new V3(Math.cos(a), 0, Math.sin(a)) : new V3(Math.cos(a), Math.sin(a), 0);
      bolts.push({p: centre.clone().addScaledVector(u, r), axis});
    }
  };

  const blades1 = [];
  const blades2 = [];
  const moving = [];
  const arcs = [];
  const links = [];
  const poleParts = [];

  G.poleZ.forEach((z, k) => {
    const z2 = G.bb2Z[k];
    const bb1 = compMat[`B1${k + 1}`];
    const bb2 = compMat[`B2${k + 1}`];
    const pole = new THREE.Group();
    root.add(pole);
    poleParts.push(pole);

    // ---------------------------------------------------------- busbar housings: horizontal cylinders across the width
    for (const [zz, mat] of [[z, bb1], [z2, bb2]]) {
      add(cylX(G.bbBodyR, G.W - 0.03), mat, pole, new V3(0, G.yBB, zz));
      for (const sx of [-1, 1]) {
        add(cylX(G.bbFlangeR, 0.03), M.aluDark, pole, new V3(sx * (G.W / 2 - 0.015), G.yBB, zz));
        boltCircle(new V3(sx * (G.W / 2 - 0.03), G.yBB, zz), 'x', 0.135, 12);
      }
      // the right-hand end of the line-up: a busbar end cover (man. 18.9)
      add(cylX(G.bbFlangeR - 0.004, 0.022), M.aluDark, pole, new V3(G.W / 2 + 0.011, G.yBB, zz));
      boltCircle(new V3(G.W / 2 + 0.022, G.yBB, zz), 'x', 0.128, 12);
      // the top stub and its cover, the neck down to the gas-tight bushing
      add(cylY(0.085, G.yBB, G.yBBCover - 0.012), mat, pole, new V3(0, 0, zz));
      add(cylY(0.135, G.yBBCover - 0.012, G.yBBCover + 0.006), M.aluDark, pole, new V3(0, 0, zz));
      add(cylY(G.bbNeckR, G.yBush1 + G.bushT / 2, G.yBB), mat, pole, new V3(0, 0, zz));
      add(cylY(0.15, G.yBush1 + G.bushT / 2, G.yBush1 + G.bushT / 2 + 0.022), M.aluDark, pole, new V3(0, 0, zz));
      // gas-tight bushing between the busbar housing and the disconnector housing
      add(cylY(G.bushR, G.yBush1 - G.bushT / 2, G.yBush1 + G.bushT / 2), M.bush, pole, new V3(0, 0, zz));
      add(cylY(0.15, G.yBush1 - G.bushT / 2 - 0.022, G.yBush1 - G.bushT / 2), M.aluDark, pole, new V3(0, 0, zz));
    }
    // the busbars: copper through every housing, on into the neighbour (-x) and out as stubs (+x), as in the catalog photo
    for (const [zz, c] of [[z, cond.bb1], [z2, cond.bb2]]) {
      add(cylX(0.04, G.W + 0.04, 24), c, pole, new V3(-0.04, G.yBB, zz));
      add(cylX(0.05, 0.06, 24), c, pole, new V3(0, G.yBB, zz));
      // the drop to the fixed contact
      add(cylY(0.026, G.yBush1 - 0.03, G.yBB, 20), c, pole, new V3(0, 0, zz));
    }
    // fixed contacts: busbar 1 above Q1's pivot, busbar 2 above Q2's
    add(new RoundedBoxGeometry(0.07, 0.05, 0.055, 2, 0.008), cond.bb1, pole, new V3(0, G.yDisc + Q1L + 0.03, z));
    add(new RoundedBoxGeometry(0.07, 0.05, 0.055, 2, 0.008), cond.bb2, pole, new V3(0, Q2P.contactY + 0.03, z2));

    // ---------------------------------------------------------- Q1 housing (three-position disconnector, compartment B1)
    const q1 = compMat.B1;
    add(cylY(G.bbNeckR, G.yBush2 + G.bushT / 2, G.yBush1 - G.bushT / 2 - 0.022), q1, pole, new V3(0, 0, z));
    add(cylX(G.discR, 0.3), q1, pole, new V3(0, G.yDisc, z));
    for (const sx of [-1, 1]) {
      add(cylX(G.discR + 0.004, 0.018), M.aluDark, pole, new V3(sx * 0.159, G.yDisc, z));
      boltCircle(new V3(sx * 0.168, G.yDisc, z), 'x', 0.128, 12);
    }
    // the neck back to the vertical bushing into Q2
    const bz = z + G.q2BushDz;
    add(cylZ(0.125, z - 0.1 - (bz + G.bushT / 2)), q1, pole, new V3(0, G.yDisc, (z - 0.1 + bz + G.bushT / 2) / 2));
    add(cylZ(G.bushR - 0.009, G.bushT), M.bush, pole, new V3(0, G.yDisc - 0.01, bz));
    // the earthing contact on the front wall, bonded to the housing
    const ea = Q1A.earth * D2R;
    add(new RoundedBoxGeometry(0.07, 0.045, 0.04, 2, 0.008), cond.earth, pole, new V3(0, G.yDisc + (Q1L + 0.022) * Math.cos(ea), z + (Q1L + 0.022) * Math.sin(ea)));

    // ---------------------------------------------------------- Q2 housing (busbar-2 disconnector, compartment B2)
    const q2 = compMat.B2;
    const q2z0 = z2 - 0.125;
    const q2z1 = bz - G.bushT / 2;
    add(new RoundedBoxGeometry(0.27, G.q2Top - G.q2Bot, q2z1 - q2z0, 4, 0.045), q2, pole, new V3(0, (G.q2Top + G.q2Bot) / 2, (q2z0 + q2z1) / 2));
    add(cylY(G.bbNeckR, G.q2Top - 0.02, G.yBush1 - G.bushT / 2 - 0.022), q2, pole, new V3(0, 0, z2));
    add(cylX(0.09, 0.29), M.aluDark, pole, new V3(0, Q2P.y - 0.01, z2 + 0.01));

    // ---------------------------------------------------------- disconnector blades
    const blade = (len, mat) => {
      const g = new THREE.Group();
      add(new RoundedBoxGeometry(0.05, len + 0.02, 0.022, 2, 0.006).translate(0, len / 2, 0), mat, g);
      add(cylX(0.03, 0.09, 24), mat, g);
      return g;
    };
    const b1 = blade(Q1L, cond.node);
    b1.position.set(0, G.yDisc, z);
    pole.add(b1);
    blades1.push(b1);
    const b2 = blade(Q2L, cond.node);
    b2.position.set(0, Q2P.y, z2 + Q2P.dz);
    pole.add(b2);
    blades2.push(b2);
    // the node conductors: Q1 pivot down to the interrupter, Q1 back to Q2's pivot
    add(cylY(0.026, G.viY + G.viLen / 2, G.yDisc, 20), cond.node, pole, new V3(0, 0, z));
    add(cylZ(0.022, z - (z2 + Q2P.dz), 20), cond.node, pole, new V3(0, G.yDisc, (z + z2 + Q2P.dz) / 2));

    // ---------------------------------------------------------- gas-tight bushing Q1 -> CB, the CB housing (B0)
    add(cylY(G.bushR - 0.01, G.yBush2 - G.bushT / 2, G.yBush2 + G.bushT / 2), M.bush, pole, new V3(0, 0, z));
    for (const s of [-1, 1]) add(cylY(0.145, 0, 0.02).translate(0, G.yBush2 + s * (G.bushT / 2 + 0.01) - 0.01, 0), M.aluDark, pole, new V3(0, 0, z));
    const cb = compMat.B0;
    const prof = [[0.001, G.cbBot], [0.11, G.cbBot], [0.138, G.cbBot + 0.012], [0.157, G.cbBot + 0.045], [0.168, 0.86], [0.17, 0.97], [0.163, 1.07], [0.15, 1.13], [0.134, 1.175], [0.128, G.yBush2 - G.bushT / 2 - 0.02], [0.001, G.yBush2 - G.bushT / 2 - 0.02]];
    const cbm = add(lathe(prof, 56), cb, pole, new V3(0, 0, z));
    cbm.scale.set(1, 1, 1.05);
    add(cylX(0.143, 0.37), cb, pole, new V3(0, G.cbY, z));
    for (const sx of [-1, 1]) {
      add(cylX(0.147, 0.018), M.aluDark, pole, new V3(sx * 0.19, G.cbY, z));
      boltCircle(new V3(sx * 0.199, G.cbY, z), 'x', 0.128, 12);
    }

    // ---------------------------------------------------------- the vacuum interrupter
    const yC = G.viY; // contact plane when closed
    const y0 = G.viY - G.viLen / 2;
    const y1 = G.viY + G.viLen / 2;
    const vi = new THREE.Group();
    vi.position.z = z;
    pole.add(vi);
    add(cylY(G.viR, y0 + 0.012, y1 - 0.012, 40), M.ceramic, vi);
    for (const y of [y0 + 0.006, y1 - 0.006]) add(cylY(G.viR + 0.004, y - 0.006, y + 0.006, 40), M.bolt, vi);
    // fixed contact and stem
    add(cylY(0.016, yC + 0.012, y1, 16), cond.node, vi);
    add(cylY(0.036, yC, yC + 0.014, 32), cond.node, vi);
    // moving contact, stem and the bellows: they ride down by the gap
    const mv = new THREE.Group();
    add(cylY(0.036, yC - 0.014, yC, 32), cond.cable, mv);
    add(cylY(0.016, 0.8, yC - 0.014, 16), cond.cable, mv);
    vi.add(mv);
    const bellows = new THREE.Group();
    for (let i = 0; i < 7; i++) add(ring(0.03, 0.017, 0.005, 24).translate(0, y0 + 0.02 + i * 0.011, 0), M.bolt, bellows);
    vi.add(bellows);
    // the arc: a hot core and a soft halo sprite, sized by the current
    const arcCore = new THREE.Mesh(cylY(0.012, -0.5, 0.5, 16), new THREE.MeshBasicMaterial({color: '#fff6e8', toneMapped: false}));
    arcCore.visible = false;
    vi.add(arcCore);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTexture(), color: '#ffb36b', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false}));
    halo.visible = false;
    vi.add(halo);
    moving.push({mv, bellows});
    arcs.push({core: arcCore, halo});
    // the flexible connection and the conductor down through the pervious bushing into the cable connection
    add(cylY(0.028, G.connTop - 0.04, 0.8, 20), cond.cable, pole, new V3(0, 0, z));

    // ---------------------------------------------------------- operating linkage: a crank per pole on the shaft
    const crank = new THREE.Group();
    crank.position.set(-0.21, 0.82, z);
    add(new RoundedBoxGeometry(0.02, 0.016, 0.075, 2, 0.005).translate(0, 0, 0.032), M.steel, crank);
    pole.add(crank);
    add(cylX(0.022, 0.05), M.aluDark, pole, new V3(-0.18, 0.82, z));
    links.push(crank);

    // ---------------------------------------------------------- under the frame: pervious bushing, CT, connection
    add(cylY(0.13, G.frameTop + 0.002, G.frameTop + 0.016), M.bush, pole, new V3(0, 0, z));
    add(ring(0.1, 0.07, 0.016).translate(0, G.frameTop + 0.009, 0), M.bushPerv, pole, new V3(0, 0, z));
    add(cylY(0.066, G.connTop, G.frameTop), cb, pole, new V3(0, 0, z));
    add(ring(G.ctR, 0.078, G.ctTop - G.ctBot - 0.004).translate(0, (G.ctTop + G.ctBot) / 2, 0), M.resin, pole, new V3(0, 0, z));
    add(cylY(G.connRTop + 0.014, G.connTop - 0.018, G.connTop), M.aluDark, pole, new V3(0, 0, z));
    add(lathe([[0.001, G.connBot], [G.connRBot, G.connBot], [G.connRTop, G.connTop - 0.018], [0.001, G.connTop - 0.018]]), cb, pole, new V3(0, 0, z));
    // two inside-cone cable plugs per phase, the cables leave down through the floor opening
    for (const sx of [-1, 1]) {
      const x = sx * 0.042;
      add(cylY(0.034, G.connBot - 0.085, G.connBot, 24), M.silicone, pole, new V3(x, 0, z));
      add(cylY(0.024, -0.2, G.connBot - 0.085, 16), M.cable, pole, new V3(x, 0, z));
    }
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.16, 40).rotateX(-Math.PI / 2), M.floorHole);
    hole.position.set(0, 0.0015, z);
    hole.renderOrder = 1;
    root.add(hole);
  });

  // ------------------------------------------------------------ the linkage shaft from the mechanism to all three poles
  const shaft = add(cylZ(0.016, G.cubZ0 - (G.poleZ[2] - 0.1)), M.steel, root, new V3(-0.21, 0.82, (G.cubZ0 + G.poleZ[2] - 0.1) / 2));
  shaft.castShadow = true;

  // ------------------------------------------------------------ the subframe
  const frame = new THREE.Group();
  root.add(frame);
  const zLen = G.frameFrontZ - G.rearZ;
  const zMid = (G.frameFrontZ + G.rearZ) / 2;
  for (const sx of [-1, 1]) {
    const x = sx * (G.W / 2 - 0.03);
    add(new THREE.BoxGeometry(0.05, G.frameTop - G.frameTopB, zLen), M.steel, frame, new V3(x, (G.frameTop + G.frameTopB) / 2, zMid));
    add(new THREE.BoxGeometry(0.05, G.frameBot, zLen), M.steel, frame, new V3(x, G.frameBot / 2, zMid));
    for (const [a, b] of [[0, 0.079], [0.795, 0.849], [1.512, 1.565]]) add(new THREE.BoxGeometry(0.05, G.frameTopB - G.frameBot, b - a), M.steel, frame, new V3(x, (G.frameTopB + G.frameBot) / 2, G.rearZ + (a + b) / 2));
  }
  for (const [a, b] of [[0, 0.079], [0.795, 0.849], [1.512, 1.565]]) {
    add(new THREE.BoxGeometry(G.W - 0.06, 0.05, b - a), M.steel, frame, new V3(0, G.frameTop - 0.025, G.rearZ + (a + b) / 2));
    add(new THREE.BoxGeometry(G.W - 0.06, 0.05, b - a), M.steel, frame, new V3(0, 0.025, G.rearZ + (a + b) / 2));
  }
  // a mounting plate under each CB housing, with the hole for the conductor
  for (const z of G.poleZ) {
    const sh = new THREE.Shape();
    sh.moveTo(-0.27, -0.2);
    sh.lineTo(0.27, -0.2);
    sh.lineTo(0.27, 0.2);
    sh.lineTo(-0.27, 0.2);
    sh.closePath();
    const h = new THREE.Path();
    h.absarc(0, 0, 0.075, 0, Math.PI * 2, true);
    sh.holes.push(h);
    const g = new THREE.ExtrudeGeometry(sh, {depth: 0.012, bevelEnabled: false, curveSegments: 24}).rotateX(-Math.PI / 2);
    add(g, M.steel, frame, new V3(0, G.frameTop - 0.012, z));
  }
  // the earthing bar along the frame
  add(new THREE.BoxGeometry(0.008, 0.04, zLen - 0.1), M.copper, frame, new V3(-G.W / 2 + 0.065, G.frameBot + 0.03, zMid));

  // ------------------------------------------------------------ operating cubicle and LV compartment
  const front = new THREE.Group();
  root.add(front);
  const cd = G.frontZ - G.cubZ0;
  add(new THREE.BoxGeometry(G.W, G.cubTop, cd - 0.004), M.sheet, front, new V3(0, G.cubTop / 2, G.cubZ0 + cd / 2 - 0.002));
  add(new THREE.BoxGeometry(G.W, G.H - G.cubTop - 0.004, cd - 0.004), M.sheet, front, new V3(0, (G.H + G.cubTop) / 2, G.cubZ0 + cd / 2 - 0.002));
  // the control board: one canvas over the whole front, redrawn from the state
  const fc = document.createElement('canvas');
  fc.width = 600;
  fc.height = 2350;
  const ftex = new THREE.CanvasTexture(fc);
  ftex.colorSpace = THREE.SRGBColorSpace;
  ftex.anisotropy = 4;
  const fmat = new THREE.MeshStandardMaterial({map: ftex, roughness: 0.65, envMapIntensity: 0.5});
  const face = add(new THREE.PlaneGeometry(G.W, G.H), fmat, front, new V3(0, G.H / 2, G.frontZ + 0.0015));
  face.castShadow = false;
  // relief: the gauge bezels, the relay, the push buttons, the door handle
  const FX = (mm) => -G.W / 2 + mm / 1000;
  const FY = (mm) => mm / 1000;
  const bezel = (xmm, ymm, r) => add(ring(r, r - 0.008, 0.022, 32).rotateX(Math.PI / 2), M.bolt, front, new V3(FX(xmm), FY(ymm), G.frontZ + 0.011));
  for (const g of FRONT.gauges) bezel(g.x, g.y, g.r / 1000 + 0.004);
  add(new RoundedBoxGeometry(0.15, 0.26, 0.04, 2, 0.006), std('#3a3f45', {roughness: 0.5}), front, new V3(FX(FRONT.relay.x + 73), FY(FRONT.relay.y + 128), G.frontZ + 0.02)).castShadow = false;
  const relayFace = document.createElement('canvas');
  relayFace.width = 140;
  relayFace.height = 240;
  const rtex = new THREE.CanvasTexture(relayFace);
  rtex.colorSpace = THREE.SRGBColorSpace;
  add(new THREE.PlaneGeometry(0.14, 0.24), new THREE.MeshBasicMaterial({map: rtex, toneMapped: false}), front, new V3(FX(FRONT.relay.x + 73), FY(FRONT.relay.y + 128), G.frontZ + 0.0405)).castShadow = false;
  for (const b of FRONT.buttons) add(new RoundedBoxGeometry(0.05, 0.05, 0.022, 2, 0.006), std('#26292c', {roughness: 0.6}), front, new V3(FX(b.x), FY(b.y), G.frontZ + 0.011));
  add(new RoundedBoxGeometry(0.018, 0.11, 0.03, 2, 0.006), M.bolt, front, new V3(FX(560), FY(1960), G.frontZ + 0.015));

  // ------------------------------------------------------------ the bolts, one instanced mesh
  {
    const g = new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6);
    M.boltCover = M.bolt.clone();
    const inst = new THREE.InstancedMesh(g, M.boltCover, bolts.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    bolts.forEach((b, i) => {
      q.setFromUnitVectors(new V3(0, 1, 0), b.axis === 'x' ? new V3(1, 0, 0) : b.axis === 'y' ? new V3(0, 1, 0) : new V3(0, 0, 1));
      m4.compose(b.p, q, new V3(1, 1, 1));
      inst.setMatrixAt(i, m4);
    });
    inst.castShadow = true;
    root.add(inst);
  }

  // ------------------------------------------------------------ the neighbour panel, as a line drawing
  const ghost = new THREE.Group();
  {
    const lm = new THREE.LineBasicMaterial({color: '#8d969c', transparent: true, opacity: 0.55});
    const fm = new THREE.MeshBasicMaterial({color: '#dfe3e2', transparent: true, opacity: 0.35, depthWrite: false});
    const edges = (geo, pos) => {
      const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), lm);
      l.position.copy(pos);
      ghost.add(l);
      const f = new THREE.Mesh(geo, fm);
      f.position.copy(pos);
      ghost.add(f);
    };
    for (const zz of [...G.poleZ, ...G.bb2Z]) edges(cylX(G.bbBodyR, G.W - 0.03, 20), new V3(0, G.yBB, zz));
    for (const zz of G.poleZ) {
      edges(cylY(G.bbNeckR, G.yBush2, G.yBush1, 20), new V3(0, 0, zz));
      edges(cylY(0.16, G.cbBot, G.yBush2, 20), new V3(0, 0, zz));
    }
    edges(new THREE.BoxGeometry(G.W, G.H, G.frontZ - G.cubZ0), new V3(0, G.H / 2, (G.frontZ + G.cubZ0) / 2));
    edges(new THREE.BoxGeometry(G.W - 0.06, G.frameTop, G.frameFrontZ - G.rearZ), new V3(0, G.frameTop / 2, zMid));
    ghost.position.x = -G.W;
  }
  root.add(ghost);

  // ------------------------------------------------------------ section: a clip plane through x = 0 for the housings
  const clip = [new THREE.Plane(new V3(-1, 0, 0), 0)];
  const setSection = (on) => {
    for (const m of [...housingMats, M.alu, M.bush, M.bushPerv, M.ceramic, M.resin, M.silicone]) {
      m.clippingPlanes = on ? clip : null;
      m.clipShadows = true;
      m.side = on ? THREE.DoubleSide : THREE.FrontSide;
      m.needsUpdate = true;
    }
  };
  let sectionOn = false;

  // ------------------------------------------------------------ display state
  const GAS_TINT = {B11: '#6aa6d6', B12: '#86b8de', B13: '#a2cae6', B21: '#5fbfa0', B22: '#7ecdb4', B23: '#9fdac6', B1: '#e9c85a', B2: '#c4a1dd', B0: '#e8b48c'};
  const aluCol = new THREE.Color('#b9bec3');
  const copperCol = new THREE.Color('#c47b46');
  const acc = new THREE.Color(ACCENT);
  const grn = new THREE.Color(EARTH);
  const paint = (mat, mode) => {
    if (mode === 'live') {
      mat.color.copy(copperCol).lerp(acc, 0.65);
      mat.emissive.copy(acc);
      mat.emissiveIntensity = 0.55;
    } else if (mode === 'earth') {
      mat.color.copy(copperCol).lerp(grn, 0.7);
      mat.emissive.copy(grn);
      mat.emissiveIntensity = 0.35;
    } else {
      mat.color.copy(copperCol);
      mat.emissive.setRGB(0, 0, 0);
    }
  };
  const fade = new Set([...housingMats, M.ceramic, M.bush, M.bushPerv, M.resin]);
  const housingMeshes = [];
  root.traverse((o) => o.isMesh && fade.has(o.material) && housingMeshes.push(o));
  let shadowsOn = true;
  // a material turning transparent needs a new program
  const see = (m, xray) => {
    const t = xray > 0.001;
    if (m.transparent !== t) {
      m.transparent = t;
      m.needsUpdate = true;
    }
    m.depthWrite = xray < 0.5;
  };
  let frontKey = '';
  let relayKey = '';

  /**
   * s: gis.stateAt() result. o: {xray 0..1, gas 0..1, section bool, ghost 0..1, ambient °C}
   */
  const update = (s, o = {}) => {
    const xray = o.xray ?? 0;
    const gas = o.gas ?? 0;
    // the blades, all three poles together
    for (const b of blades1) b.rotation.x = s.q1.ang * D2R;
    for (const b of blades2) b.rotation.x = s.q2.ang * D2R;
    // the moving contacts ride down by the gap; the bellows stretch
    moving.forEach(({mv, bellows}, p) => {
      mv.position.y = -s.gap;
      bellows.scale.y = 1;
      bellows.position.y = -s.gap * 0.5;
      const a = arcs[p];
      const on = s.arc[p];
      a.core.visible = on && s.gap > 1e-4;
      a.halo.visible = on;
      if (on) {
        const kA = Math.abs(s.i[p]) / 1000;
        const g = Math.max(s.gap, 0.002);
        a.core.scale.set(0.6 + kA / 60, g, 0.6 + kA / 60);
        a.core.position.y = G.viY - g / 2;
        const hs = 0.05 + 0.13 * Math.min(1, kA / 60);
        a.halo.scale.set(hs, hs, 1);
        a.halo.position.y = G.viY - g / 2;
        a.halo.material.opacity = 0.35 + 0.65 * Math.min(1, kA / 40);
      }
    });
    for (const c of links) c.rotation.x = -(s.gap / CB.stroke) * 38 * D2R;
    shaft.rotation.z = (s.gap / CB.stroke) * 38 * D2R;
    // the energised path
    const fed = s.node === 'bb1' || s.node === 'bb2' ? s.node : null;
    paint(cond.bb1, fed === 'bb1' ? 'live' : null);
    paint(cond.bb2, fed === 'bb2' ? 'live' : null);
    paint(cond.node, fed ? 'live' : s.node === 'earth' ? 'earth' : null);
    paint(cond.cable, s.cable === 'live' ? 'live' : s.cable === 'earth' ? 'earth' : null);
    paint(cond.earth, s.node === 'earth' ? 'earth' : null);
    // housings: x-ray fades them, the gas view tints each compartment
    for (const c of COMPARTMENTS) {
      const m = compMat[c.id];
      m.color.copy(aluCol).lerp(new THREE.Color(GAS_TINT[c.id]), gas * 0.85);
      m.metalness = 0.55 * (1 - gas);
      m.opacity = 1 - 0.8 * xray;
      see(m, xray);
    }
    for (const [m, k] of [[M.boltCover, 0.85], [M.aluDark, 0.88], [M.ceramic, 0.62], [M.bush, 0.8], [M.bushPerv, 0.8], [M.resin, 0.8]]) {
      m.opacity = 1 - k * xray;
      see(m, xray);
    }
    const shadows = xray < 0.5;
    if (shadows !== shadowsOn) {
      shadowsOn = shadows;
      for (const h of housingMeshes) h.castShadow = shadows;
    }
    if (!!o.section !== sectionOn) {
      sectionOn = !!o.section;
      setSection(sectionOn);
    }
    ghost.visible = (o.ghost ?? 1) > 0.01;
    // the control board
    const fk = frontKeyOf(s, o);
    if (fk !== frontKey) {
      frontKey = fk;
      drawFront(fc.getContext('2d'), s, o);
      ftex.needsUpdate = true;
    }
    const rk = relayKeyOf(s);
    if (rk !== relayKey) {
      relayKey = rk;
      drawRelay(relayFace.getContext('2d'), s);
      rtex.needsUpdate = true;
    }
  };
  return {root, update, M, compMat, cond, ghost};
}

// ------------------------------------------------------------ the arc halo
let GLOW = null;
function glowTexture() {
  if (GLOW) return GLOW;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.2, 'rgba(255,220,170,.8)');
  r.addColorStop(0.5, 'rgba(255,150,80,.25)');
  r.addColorStop(1, 'rgba(255,120,60,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  GLOW = new THREE.CanvasTexture(c);
  GLOW.colorSpace = THREE.SRGBColorSpace;
  return GLOW;
}

// ------------------------------------------------------------ the control board (mm, from the panel's bottom-left)
// Layout after the catalog's front view (p.20) and the panel photo (p.25): busbar manometers in a column on the left,
// the LV door with the protection relay, the feeder manometers B1 / B0 / B2 in a row, the mimic diagram with the
// disconnector shafts and the control gate, the circuit-breaker board, the cable compartment cover with the voltage
// detecting system.
export const FRONT = {
  gauges: [
    ...[0, 1, 2, 3, 4, 5].map((i) => ({id: ['B11', 'B12', 'B13', 'B21', 'B22', 'B23'][i], x: 42, y: 2170 - i * 132, r: 34})),
    {id: 'B1', x: 150, y: 1425, r: 52},
    {id: 'B0', x: 318, y: 1425, r: 52},
    {id: 'B2', x: 486, y: 1425, r: 52},
  ],
  relay: {x: 250, y: 1580},
  buttons: [{x: 400, y: 960, k: 'on'}, {x: 400, y: 820, k: 'off'}],
};
const frontKeyOf = (s, o) => [s.q0, s.touching, s.q1.pos, s.q2.pos, Math.round(s.q1.ang), Math.round(s.q2.ang), s.spring >= 1, s.ops, s.node, s.cable, Math.round(o.ambient ?? 20)].join('|');
const relayKeyOf = (s) => [s.cable, s.q0Cause, s.faultOn, s.touching, Math.round(Math.abs(s.i[0]) / 50)].join('|');

function drawFront(g, s, o) {
  const H = 2350;
  const Y = (mm) => H - mm;
  const ink = '#2b2e30';
  const mute = '#7b8286';
  g.fillStyle = '#d9dbd7';
  g.fillRect(0, 0, 600, H);
  const line = (x0, y0, x1, y1, w = 2, c = '#b4b8b3') => {
    g.strokeStyle = c;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0, Y(y0));
    g.lineTo(x1, Y(y1));
    g.stroke();
  };
  const rect = (x, y, w, h, fill, stroke) => {
    if (fill) {
      g.fillStyle = fill;
      g.fillRect(x, Y(y + h), w, h);
    }
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = 2;
      g.strokeRect(x, Y(y + h), w, h);
    }
  };
  const text = (t, x, y, size = 14, c = mute, align = 'left', weight = 600) => {
    g.fillStyle = c;
    g.font = `${weight} ${size}px "JetBrains Mono", monospace`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillText(t, x, Y(y));
  };
  // panel seams: the gauge strip, the LV door, the CB board, the cable compartment cover
  rect(0, 0, 600, H, null, '#a9ada8');
  line(84, 1300, 84, H, 2);
  line(0, 1505, 600, 1505, 3);
  line(0, 1300, 600, 1300, 2);
  line(0, 630, 600, 630, 3);
  rect(96, 1520, 492, 816, null, '#c3c7c2');
  // a small rating plate in place of a maker's badge
  rect(110, 2280, 120, 34, '#c8ccc7');
  text('8DB-TYPE GIS', 118, 2297, 12, ink, 'left', 700);
  // manometers: dial, the green band between min and max functional level, the needle
  const amb = o.ambient ?? 20;
  for (const ga of FRONT.gauges) {
    const p = gasAt(amb);
    const r = ga.r;
    const cx = ga.x;
    const cy = Y(ga.y);
    g.fillStyle = '#f6f5f1';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    const ang = (kpa) => Math.PI * 0.75 + (kpa / 250) * Math.PI * 1.5;
    const band = (a, b, c) => {
      g.strokeStyle = c;
      g.lineWidth = r * 0.16;
      g.beginPath();
      g.arc(cx, cy, r * 0.78, ang(a), ang(b));
      g.stroke();
    };
    band(0, GAS.low, '#d0453a');
    band(GAS.low, GAS.high, '#3d9a64');
    band(GAS.high, 250, '#d0453a');
    g.strokeStyle = ink;
    g.lineWidth = Math.max(2, r * 0.06);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(ang(p)) * r * 0.86, cy + Math.sin(ang(p)) * r * 0.86);
    g.stroke();
    g.fillStyle = ink;
    g.beginPath();
    g.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
    g.fill();
    text(ga.id, cx, ga.y - r - 14, r > 40 ? 15 : 12, ink, 'center', 700);
    // the filling valve beside it
    g.fillStyle = '#b5b9b4';
    g.beginPath();
    g.arc(cx + (r > 40 ? r + 22 : 0), r > 40 ? cy : cy + r + 30, 9, 0, Math.PI * 2);
    g.fill();
  }
  // the mimic diagram (cat. p.29): busbar 1 and 2, Q1 with its earthing, Q2, the CB, the cable
  const live = ACCENT;
  const earth = EARTH;
  const dead = '#3a3e42';
  const fed = s.node === 'bb1' || s.node === 'bb2';
  const cBB1 = s.node === 'bb1' ? live : dead;
  const cBB2 = s.node === 'bb2' ? live : dead;
  const cNode = fed ? live : s.node === 'earth' ? earth : dead;
  const cCab = s.cable === 'live' ? live : s.cable === 'earth' ? earth : dead;
  rect(96, 1308, 492, 180, '#d2d5d0');
  const lw = 7;
  line(110, 1460, 575, 1460, lw, '#3a3e42');
  line(110, 1430, 575, 1430, lw, '#3a3e42');
  line(110, 1460, 300, 1460, lw, cBB1);
  line(300, 1430, 575, 1430, lw, cBB2);
  // Q1: from busbar 1 down; Q2: from busbar 2 down; joined to the node
  const sw = (x, ytop, ybot, ang, c) => {
    line(x, ytop, x, ytop - 18, lw, c);
    const a = ang * D2R;
    g.strokeStyle = c;
    g.lineWidth = lw;
    g.beginPath();
    g.moveTo(x, Y(ybot));
    g.lineTo(x - Math.sin(a) * (ytop - 18 - ybot), Y(ybot + Math.cos(a) * (ytop - 18 - ybot)));
    g.stroke();
  };
  const q1c = s.q1.pos === 'closed' ? cBB1 : s.q1.pos === 'earth' ? earth : dead;
  sw(170, 1460, 1360, s.q1.ang * 0.8, q1c === dead ? cNode : q1c);
  sw(470, 1430, 1360, -s.q2.ang * 0.4, s.q2.pos === 'closed' ? cBB2 : cNode === live ? dead : dead);
  // the earthing contact of Q1
  line(130, 1395, 150, 1395, 4, s.q1.pos === 'earth' ? earth : '#5a5f63');
  line(135, 1385, 145, 1385, 3, '#5a5f63');
  line(170, 1360, 470, 1360, lw, cNode);
  line(170, 1360, 170, 1330, lw, cNode);
  // position windows on the mimic: Q1, earthing, Q2 (a bar across = closed)
  const win = (x, y, closed) => {
    rect(x - 26, y - 10, 52, 20, '#1d1f21');
    g.fillStyle = closed ? '#f2f2ee' : '#5d6266';
    if (closed) g.fillRect(x - 20, Y(y) - 3, 40, 6);
    else g.fillRect(x - 3, Y(y) - 8, 6, 16);
  };
  win(230, 1480, s.q1.pos === 'closed');
  win(350, 1480, s.q1.pos === 'earth');
  win(470, 1480, s.q2.pos === 'closed');
  // the CB board: the shafts for disconnecting and earthing, the control gate
  rect(96, 640, 492, 650, '#d6d8d4');
  line(170, 1300, 170, 1150, lw, cNode);
  // the CB symbol
  rect(150, 1110, 40, 40, null, ink);
  g.strokeStyle = s.touching ? cNode : '#5a5f63';
  g.lineWidth = lw;
  g.beginPath();
  g.moveTo(170, Y(1110));
  g.lineTo(s.touching ? 170 : 188, Y(1150));
  g.stroke();
  line(170, 1110, 170, 1050, lw, cCab);
  g.fillStyle = cCab;
  g.beginPath();
  g.moveTo(158, Y(1052));
  g.lineTo(182, Y(1052));
  g.lineTo(170, Y(1030));
  g.fill();
  for (const [x, lab] of [[260, 'Q1'], [330, 'ERTH'], [470, 'Q2']]) {
    g.fillStyle = '#9da29d';
    g.beginPath();
    g.arc(x, Y(1230), 17, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2b2e30';
    g.beginPath();
    g.arc(x, Y(1230), 7, 0, Math.PI * 2);
    g.fill();
    text(lab, x, 1196, 12, mute, 'center');
  }
  rect(250, 1120, 150, 26, '#b9bdb8');
  g.fillStyle = '#2b2e30';
  g.beginPath();
  g.arc(325, Y(1133), 12, 0, Math.PI * 2);
  g.fill();
  text('CONTROL GATE', 325, 1100, 11, mute, 'center');
  // circuit-breaker: position indicator, spring indicator, operations counter, ON / OFF, crank opening
  rect(110, 940, 70, 40, '#1d1f21');
  text(s.touching ? 'I' : 'O', 145, 960, 26, s.touching ? '#f2f2ee' : '#8fd18a', 'center', 800);
  text('CB', 145, 922, 11, mute, 'center');
  rect(110, 860, 70, 40, s.spring >= 1 ? '#e6c650' : '#f0efe9');
  text(s.spring >= 1 ? 'CHRGD' : 'DISCH', 145, 880, 12, ink, 'center', 800);
  text('SPRING', 145, 842, 11, mute, 'center');
  rect(105, 780, 80, 28, '#1d1f21');
  text(String(s.ops).padStart(5, '0'), 145, 794, 15, '#f2f2ee', 'center', 700);
  text('COUNTER', 145, 764, 11, mute, 'center');
  g.fillStyle = '#c9ccc8';
  g.beginPath();
  g.arc(265, Y(960), 22, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#7b8286';
  g.beginPath();
  g.arc(265, Y(960), 8, 0, Math.PI * 2);
  g.fill();
  text('CRANK', 265, 925, 11, mute, 'center');
  text('ON', 400, 1000, 13, ink, 'center', 700);
  text('OFF', 400, 860, 13, ink, 'center', 700);
  rect(470, 700, 22, 90, '#babeb9');
  // cable compartment cover and the capacitive voltage detecting system: L1 L2 L3 lit while the cable is live
  rect(500, 420, 64, 150, '#3a3e42');
  for (let p = 0; p < 3; p++) {
    g.fillStyle = s.cable === 'live' ? '#ffcf6a' : '#55595d';
    g.beginPath();
    g.arc(532, Y(540 - p * 42), 11, 0, Math.PI * 2);
    g.fill();
    text(`L${p + 1}`, 532, 520 - p * 42, 10, '#c9ccc8', 'center');
  }
  text('VDS', 532, 405, 11, mute, 'center');
}

function drawRelay(g, s) {
  g.fillStyle = '#2f3439';
  g.fillRect(0, 0, 140, 240);
  g.fillStyle = '#a9d3c4';
  g.fillRect(14, 16, 112, 92);
  g.fillStyle = '#18302a';
  g.font = '700 11px "JetBrains Mono", monospace';
  g.textBaseline = 'top';
  const rms = s.touching && s.cable === 'live' ? (s.faultOn ? 40000 : 1250) : 0;
  g.fillText('PROT. RELAY', 20, 22);
  ['L1', 'L2', 'L3'].forEach((l, i) => g.fillText(`I${l} ${String(rms).padStart(5, ' ')} A`, 20, 42 + i * 16));
  g.fillText(s.q0Cause === 'protection' ? 'TRIP  I>>' : s.q0Cause === 'auto-reclose' ? 'AR  SUCCESS' : 'READY', 20, 92);
  const led = (y, on, c) => {
    g.fillStyle = on ? c : '#4a4f54';
    g.beginPath();
    g.arc(26, y, 6, 0, Math.PI * 2);
    g.fill();
  };
  led(128, true, '#4fd07a');
  led(148, s.q0Cause === 'protection' || s.q0Cause === 'auto-reclose', '#ff5a3c');
  led(168, s.q0Cause === 'auto-reclose', '#ffcf6a');
  g.fillStyle = '#8b939a';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.fillRect(56 + c * 24, 122 + r * 26, 18, 18);
}
