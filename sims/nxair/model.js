// Procedural NXAIR circuit-breaker panel in millimetres. Layout after the sectional view in catalog HA 25.71 p. 10
// (HA25-2611) and O §6.2 Fig. 27: busbar compartment B top rear, connection compartment C bottom rear, switching-
// device compartment A front with the withdrawable 3AE breaker on a mid-height shelf, low-voltage compartment E top
// front, pressure relief duct on top. Panel axes: x across the row (±W/2), y up from the floor, z from the rear (0) to
// the front door (D).
//
// Outer dimensions are real (W, D, 2300 mm). Internal heights are scaled from the catalog section; shapes of poles,
// bushings, CTs and mechanisms are simplified but every part listed in the manuals is present. Bolt anchors carry the
// counts the manual gives.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BUSBAR, WIDTHS} from './data.js';
import {B, BAR, C, EX, EY, EZ, L, PartBuilder, RB, T, TU, circleHole, rect, rectHole, slotHole, spread} from './geom.js';

export const H = 2300;
const YB = 55; // top of base frame = compartment floor
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// --------------------------------------------------------------------------------------------- materials
export function makeMaterials(planes) {
  const m = (o) => new THREE.MeshStandardMaterial({clippingPlanes: planes, side: THREE.DoubleSide, ...o});
  return {
    ral: m({color: 0xc9cdc8, roughness: 0.62, metalness: 0.04}), // RAL 7035 powder coat
    ralDark: m({color: 0xa9aeaa, roughness: 0.6, metalness: 0.05}),
    galv: m({color: 0xb3bbc0, roughness: 0.4, metalness: 0.55}), // sendzimir galvanised sheet
    galvDark: m({color: 0x8f989e, roughness: 0.48, metalness: 0.5}),
    copper: m({color: 0xc47a4a, roughness: 0.3, metalness: 0.85}),
    tinned: m({color: 0xcfd2d0, roughness: 0.3, metalness: 0.8}),
    silver: m({color: 0xe3e6e8, roughness: 0.18, metalness: 0.95}),
    resin: m({color: 0x8a3b26, roughness: 0.5, metalness: 0.0}), // cast resin (bushings, CTs, VTs)
    resinLight: m({color: 0xa04a2e, roughness: 0.5, metalness: 0.0}),
    epoxy: m({color: 0x9aa3a8, roughness: 0.55, metalness: 0.0}), // embedded poles
    housing: m({color: 0xb9bdbb, roughness: 0.55, metalness: 0.1}), // breaker mechanism housing
    black: m({color: 0x25292c, roughness: 0.7, metalness: 0.1}),
    rubber: m({color: 0x1d1f20, roughness: 0.9, metalness: 0.0}),
    cable: m({color: 0x2a2c2e, roughness: 0.8, metalness: 0.0}),
    red: m({color: 0xc23b2f, roughness: 0.5}),
    green: m({color: 0x3d8a45, roughness: 0.5}),
    yellow: m({color: 0xe0b52a, roughness: 0.5}),
    blue: m({color: 0x2f5f8f, roughness: 0.5}),
    earth: m({color: 0x7da23a, roughness: 0.5, metalness: 0.2}),
    glass: m({color: 0x9fb4bf, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.32}),
    screen: m({color: 0x1d3a4c, roughness: 0.25, metalness: 0.1, emissive: 0x16384c, emissiveIntensity: 0.6}),
    steel: m({color: 0x7d858a, roughness: 0.42, metalness: 0.72}),
    zinc: m({color: 0xa7aa9c, roughness: 0.4, metalness: 0.7}), // yellow-zinc hardware
    plastic: m({color: 0xd9d6cc, roughness: 0.6}),
    grey: m({color: 0x5e6569, roughness: 0.6}),
    white: m({color: 0xeef0ee, roughness: 0.5}),
    spring: m({color: 0x3f4447, roughness: 0.35, metalness: 0.8}),
  };
}

// ---------------------------------------------------------------------------------------------- the panel
export function buildPanel(mats, opts) {
  const {W, D, bus, ur} = opts;
  const hw = W / 2;
  // dimension drawing 110-2300.9 (SUP p10/p54): front part 688 mm (1350 deep) or 738 mm (≥ 1500), C top at 1075,
  // LV compartment 630 high x 406 deep from 1370, pressure relief duct to 2300 behind the LV compartment
  const zP = D - (D >= 1500 ? 738 : 688); // partition A | B,C
  const yBC = 1075; // B floor / C roof
  const yPRC = 1730; // top of B, bottom of the pressure relief duct
  const zLV = D - 406; // back wall of the low-voltage compartment
  const yLV = 1370; // floor of the low-voltage compartment
  const LVTOP = yLV + 630;
  const yU = 1170, yL = yU - (W === 1000 ? 310 : 275); // terminal distance 275 / 310 mm (CB p.32)
  const yShelf = 560; // withdrawable-part shelf with guide rails
  const zPole = zP + 270;
  const pitch = WIDTHS[W].pitch;
  const xs = [-pitch, 0, pitch]; // L1 L2 L3
  const BB = BUSBAR[bus];
  const zPh = [zP * 0.74, zP * 0.5, zP * 0.26]; // L1 front, L2 middle, L3 rear (I Fig. 61)
  const yPh = [1520, 1610, 1520];
  const zC = Math.round(zP * 0.56); // cable connection bars
  const contactR = (WIDTHS[W].contact || 79) / 2;

  const root = new THREE.Group();
  const parts = {};
  const anchors = {};
  const shellIds = new Set();
  const part = (id, dir, {shell = false} = {}) => {
    const g = new THREE.Group();
    g.userData.part = id;
    g.userData.dir = dir || V(0, 0, 0);
    root.add(g);
    (parts[id] ||= []).push(g);
    if (shell) shellIds.add(id);
    return new PartBuilder(g, mats);
  };
  const anchor = (jid, pb, list, extra = {}) => (anchors[jid] ||= []).push({group: pb.group, list, ...extra});
  const N = (x, y, z) => V(x, y, z);

  // ================================================================ SITE
  {
    const p = part('rails', V(0, -380, 0));
    // floor with HV cable cut-out and control cable cut-out (SUP p70: 40 kA, 1500 deep; widths 440 / 640 / 700)
    const cutW = {600: 440, 800: 640, 1000: 700}[W];
    p.add(EY(rect(-hw - 2, -60, hw + 2, D + 60), -60, -52, [rectHole(-cutW / 2, -125, cutW / 2, -(125 + 545)), rectHole(-hw + 20, -(1215 - 180 + (D - 1500)), -hw + 85, -(1215 + (D - 1500)))]), 'galvDark', 'Floor cut-outs (HV cables, control cables)');
    for (const z of [40, D - 40]) {
      // C-profile CB 50 x 30 x 3, open side up, cast flush
      const prof = [[-25, -30], [25, -30], [25, 0], [22, 0], [22, -27], [-22, -27], [-22, 0], [-25, 0]];
      p.add(EX(prof.map(([zz, y]) => [z + zz, y]), -hw, hw), 'steel', 'C-profile rail CB 50x30x3');
      for (const x of [-hw + 150, hw - 150]) p.add(B(x - 40, x + 40, -35, -30, z - 72, z + 73), 'galvDark', 'Floor fixing plate 80x5x145');
      p.add(C(8, 8, 60, 'y', -hw + 150, -60, z + 50), 'zinc', 'Expansion dowel FAN 12/10');
      p.add(C(8, 8, 60, 'y', hw - 150, -60, z + 50), 'zinc', 'Expansion dowel FAN 12/10');
    }
    p.finish();
  }

  // ================================================================ BASE FRAME
  {
    const p = part('base', V(0, -200, 0));
    // longitudinal C-channels on both sides
    for (const s of [-1, 1]) {
      const x0 = s * hw, x1 = s * (hw - 45);
      p.add(B(Math.min(x0, x1), Math.max(x0, x1), 0, 3, 0, D), 'galvDark', 'Base frame side channel');
      p.add(B(Math.min(x0, x1), Math.max(x0, x1), YB - 3, YB, 0, D), 'galvDark', 'Base frame side channel');
      p.add(B(s * hw - (s > 0 ? 3 : 0), s * hw + (s < 0 ? 3 : 0), 0, YB, 0, D), 'galvDark', 'Base frame side channel');
    }
    // cross members with elongated holes 60 x 20 for the floor fixing (I §7.5)
    for (const [z0, z1] of [[10, 80], [D - 80, D - 10]]) {
      const zc = (z0 + z1) / 2;
      p.add(EY(rect(-hw + 45, z0, hw - 45, z1), YB - 3, YB, [slotHole(0, -zc, 60, 20)]), 'galvDark', 'Cross member, elongated hole 60x20');
      p.add(B(-hw + 45, hw - 45, 0, YB, z0, z0 + 3), 'galvDark', 'Cross member');
    }
    // middle cross members
    for (const z of [zP - 20, zP + 300]) p.add(B(-hw + 45, hw - 45, YB - 3, YB, z - 25, z + 25), 'galvDark', 'Cross member');
    // shims under the fixing points
    for (const z of [45, D - 45]) for (const x of [-60, 60]) p.add(B(x - 20, x + 20, -1, 0, z - 30, z + 30), 'steel', 'Shim 0.5–1.0 mm');
    anchor('floorC', p, [{p: N(0, YB, 45), n: N(0, 1, 0)}, {p: N(0, YB, D - 45), n: N(0, 1, 0)}]);
    p.finish();
  }

  // ================================================================ SIDE WALLS (galvanised, bolted modular)
  {
    const prof = [[0, YB], [D, YB], [D, LVTOP], [zLV, LVTOP], [zLV, H - 120], [zLV - 120, H], [100, H], [0, H - 100]];
    for (const s of [-1, 1]) {
      const p = part('sideL', V(s * 560, 0, 0), {shell: true});
      const x = s * hw;
      const holes = [];
      p.add(EX(prof, x - (s > 0 ? 0 : 2), x + (s > 0 ? 2 : 0), holes), 'galv', 'Side wall');
      // front and rear folded flanges
      p.add(B(x - s * 30, x, YB, LVTOP, D - 2, D), 'galv', 'Side wall front flange');
      p.add(B(x - s * 25, x, YB, H - 100, 0, 2), 'galv', 'Side wall rear flange');
      // stiffening profiles at compartment boundaries
      p.add(B(x - s * 20, x, yBC - 20, yBC + 20, 0, zP), 'galvDark', 'Stiffener');
      p.add(B(x - s * 20, x, yPRC - 20, yPRC + 20, 0, zLV), 'galvDark', 'Stiffener');
      p.add(B(x - s * 20, x, YB, yPRC, zP - 20, zP + 20), 'galvDark', 'Stiffener');
      if (s < 0) anchor('sdc', p, spread(220, 1480, 7).map((y) => ({p: N(x + 2, y, D - 95), n: N(1, 0, 0)})));
      p.finish();
    }
  }

  // ================================================================ FIXED COMPARTMENT WALLS (B rear, A|B bushing plate)
  {
    const p = part('shellB', V(0, 0, -280), {shell: true});
    p.add(B(-hw, hw, yBC, H - 100, -1, 1), 'galv', 'Busbar compartment rear wall');
    p.add(B(-hw, hw, H - 100, H, 0, 2), 'galv', 'PRC rear wall');
    // A|B bushing plate with three openings
    const holes = xs.map((x) => circleHole(x, yU, 78));
    p.add(EZ(rect(-hw, yBC, hw, 1360), zP - 2, zP, holes), 'galv', 'Bushing plate (busbar side)');
    p.add(B(-hw, hw, yBC - 2, yBC, 0, zP), 'galv', 'Floor of busbar compartment');
    p.add(B(-hw, hw, yLV, yPRC, zLV - 2, zLV), 'galv', 'Partition A|E');
    // pressure relief flaps on the busbar compartment roof
    for (const [z0, z1] of [[30, zP / 2 - 10], [zP / 2 + 10, zP - 30]]) {
      p.add(B(-hw + 40, hw - 40, yPRC, yPRC + 2, z0, z1), 'galvDark', 'Pressure relief flap (busbar compartment)');
      p.add(C(5, 5, W - 100, 'x', 0, yPRC + 4, z0), 'steel', 'Flap hinge');
    }
    // relief flap of the switching-device compartment
    p.add(B(-hw + 40, hw - 40, yPRC, yPRC + 2, zP + 30, zLV - 30), 'galvDark', 'Pressure relief flap (switching-device compartment)');
    p.finish();
  }

  // ================================================================ PRESSURE RELIEF DUCT
  {
    const p = part('prc', V(0, 760, -60), {shell: true});
    const y0 = yPRC, y1 = H;
    p.add(B(-hw, hw, y1 - 2, y1, 100, zLV - 120), 'galv', 'PRC roof');
    p.add(EX([[0, y1 - 100], [100, y1], [100, y1 - 2], [2, y1 - 100]], -hw, hw), 'galv', 'PRC rear chamfer');
    p.add(EX([[zLV - 120, y1], [zLV, y1 - 120], [zLV, y1 - 122], [zLV - 120, y1 - 2]], -hw, hw), 'galv', 'PRC front chamfer');
    p.add(B(-hw, hw, y0, y1 - 120, zLV - 1, zLV + 1), 'galv', 'PRC front wall');
    // lateral openings to the neighbour (gas path along the row), framed
    for (const s of [-1, 1]) {
      const x = s * hw;
      p.add(B(x - 3, x + 3, y0 + 20, y0 + 40, 20, zLV - 20), 'galvDark', 'PRC side frame');
      p.add(B(x - 3, x + 3, y1 - 40, y1 - 20, 120, zLV - 140), 'galvDark', 'PRC side frame');
      p.add(B(x - 3, x + 3, y0 + 20, y1 - 30, 20, 40), 'galvDark', 'PRC side frame');
      p.add(B(x - 3, x + 3, y0 + 20, y1 - 130, zLV - 40, zLV - 20), 'galvDark', 'PRC side frame');
    }
    // deflector plate
    p.add(EX([[zP - 100, y0 + 60], [zP + 60, y0 + 220], [zP + 62, y0 + 218], [zP - 98, y0 + 58]], -hw + 20, hw - 20), 'galvDark', 'Deflector plate');
    const lo = [];
    for (const z of spread(60, zLV - 60, 8)) lo.push({p: N(-hw + 3, y0 + 30, z), n: N(1, 0, 0)});
    for (const y of spread(y0 + 90, y1 - 160, 3)) lo.push({p: N(-hw + 3, y, 30), n: N(1, 0, 0)}, {p: N(-hw + 3, y, zLV - 30), n: N(1, 0, 0)});
    anchor('prcLow', p, lo, {nut: 6});
    anchor('prcUp', p, spread(140, zLV - 160, 8).map((z) => ({p: N(-hw + 3, y1 - 30, z), n: N(1, 0, 0)})), {nut: 6});
    p.finish();
  }

  // ================================================================ BUSBAR COVER (upper part of the A|B wall, removed from A)
  {
    const p = part('busCover', V(0, 120, 320));
    const y0 = 1360, y1 = yPRC;
    p.add(B(-hw + 15, hw - 15, y0, y1, zP - 1, zP + 1), 'galv', 'Busbar cover');
    p.add(B(-hw + 15, hw - 15, y0, y0 + 20, zP, zP + 20), 'galv', 'Busbar cover fold');
    p.add(TU([[-60, y0 + 160, zP + 1], [-60, y0 + 160, zP + 30], [60, y0 + 160, zP + 30], [60, y0 + 160, zP + 1]], 5), 'black', 'Handle');
    const pts = [];
    for (const x of spread(-hw + 40, hw - 40, 5)) pts.push(N(x, y1 - 20, zP + 2), N(x, y0 + 40, zP + 2));
    pts.push(N(0, (y0 + y1) / 2 + 60, zP + 2));
    anchor('busCover', p, pts.map((q) => ({p: q, n: N(0, 0, 1)})));
    p.finish();
  }

  // ================================================================ TRANSVERSE PARTITION
  {
    const p = part('transPart', V(500, 0, 0));
    const x = hw - 6;
    p.add(EX(rect(20, yBC + 15, zP - 20, yPRC - 15), x - 1.5, x + 1.5, zPh.map((z, k) => circleHole(z, yPh[k], 60))), 'galv', 'Transverse partition plate');
    for (let k = 0; k < 3; k++) {
      p.add(L([[48, 0], [58, 0], [58, 14], [44, 14], [44, 70], [36, 70], [36, 0]], 'x', x - 35, yPh[k], zPh[k]), 'resin', 'Busbar bushing (wall)');
    }
    anchor('transPart', p, [
      {p: N(x - 3, yPRC - 40, 60), n: N(-1, 0, 0)}, {p: N(x - 3, yPRC - 40, zP - 60), n: N(-1, 0, 0)},
      {p: N(x - 3, yBC + 40, 60), n: N(-1, 0, 0)}, {p: N(x - 3, yBC + 40, zP - 60), n: N(-1, 0, 0)},
    ]);
    p.finish();
  }

  // ================================================================ BUSBARS + FEEDER BARS
  const t = 10;
  const barH = BB.bars === 1 ? 80 : BB.bars === 2 ? 100 : 120; // 1x80x10 / 2x100x10 / 3x120x10 Cu (SUP p162-181)
  const stackZ = (k, b) => zPh[k] + (b - (BB.bars - 1) / 2) * (t + 10);
  {
    const p = part('busbars', V(0, 540, 0));
    for (let k = 0; k < 3; k++) {
      for (let b = 0; b < BB.bars; b++) {
        const z = stackZ(k, b);
        p.add(RB(-hw - 30, hw + 30, yPh[k] - barH / 2, yPh[k] + barH / 2, z - t / 2, z + t / 2, 2, 1), 'copper', `Main busbar L${k + 1}`);
      }
      if (BB.spacer) for (let b = 0; b < BB.bars - 1; b++) p.add(B(xs[k] - 30, xs[k] + 30, yPh[k] - 45, yPh[k] + 45, stackZ(k, b) + 5, stackZ(k, b + 1) - 5), 'copper', 'Copper spacer');
      // phase marking
      p.add(B(-hw + 40, -hw + 70, yPh[k] + barH / 2, yPh[k] + barH / 2 + 1, stackZ(k, 0) - 5, stackZ(k, BB.bars - 1) + 5), ['yellow', 'green', 'red'][k], 'Phase marking');
      const zf = stackZ(k, BB.bars - 1) + t / 2;
      const through = BB.bars * t + (BB.bars - 1) * 10 + t + 12;
      anchor('busbar', p, [
        {p: N(xs[k] - 22, yPh[k] - 20, zf + 1), n: N(0, 0, 1)},
        {p: N(xs[k] + 22, yPh[k] - 20, zf + 1), n: N(0, 0, 1)},
      ], {nut: through});
      if (ur === 17.5) {
        const sh = 48 + BB.bars * 10;
        p.add(RB(xs[k] - 75, xs[k] + 75, yPh[k] - barH / 2 - 28, yPh[k] + barH / 2 + 28, zPh[k] - sh, zPh[k] + sh, 14, 2), 'plastic', 'Insulating half-shells (17.5 kV)');
      }
    }
    p.finish();
  }
  {
    const p = part('feeders', V(0, 320, 0));
    for (let k = 0; k < 3; k++) {
      const zb = stackZ(k, 0) - t / 2 - t / 2 - 1; // feeder flag behind the busbar stack
      for (const g of BAR([[xs[k], yU, zP - 60], [xs[k], yU, zb], [xs[k], yPh[k] + 30, zb]], 60, 10)) p.add(g, 'copper', `Feeder bar L${k + 1}`);
      // support insulator under the horizontal leg
      p.add(L([[28, 0], [28, 10], [20, 10], [24, 30], [18, 40], [24, 60], [18, 70], [24, 90], [22, 100], [28, 100], [28, 110]], 'y', xs[k], yBC, (zb + zP - 60) / 2), 'resin', 'Support insulator');
    }
    p.finish();
  }

  // ================================================================ BUSHINGS
  const bushing = (p, y, label) => {
    for (const x of xs) {
      // spout into A: cast-resin body with flange, sheds and the silver fixed contact
      p.add(L([[contactR + 26, 0], [contactR + 30, 40], [contactR + 22, 60], [contactR + 28, 80], [contactR + 20, 100], [contactR + 24, 120], [contactR + 16, 150], [contactR + 8, 150]], 'z', x, y, zP), 'resin', label);
      p.add(RB(x - 105, x + 105, y - 105, y + 105, zP - 2, zP + 18, 10, 2), 'resin', label + ' flange');
      p.add(C(contactR, contactR, 110, 'z', x, y, zP + 95), 'silver', 'Fixed contact (silver-plated)');
      p.add(C(contactR * 0.7, contactR * 0.7, 6, 'z', x, y, zP + 152), 'silver', 'Fixed contact (silver-plated)');
      p.add(L([[38, 0], [44, 30], [38, 60], [30, 90]], '-z', x, y, zP), 'resin', label + ' tail');
      for (const [dx, dy] of [[-80, -80], [80, -80], [-80, 80], [80, 80]]) p.add(C(7, 7, 6, 'z', x + dx, y + dy, zP + 20), 'zinc', 'Flange bolt');
    }
  };
  {
    const p = part('bushU', V(0, 0, 260));
    bushing(p, yU, 'Upper bushing');
    p.finish();
    const q = part('bushL', V(0, 0, 260));
    bushing(q, yL, 'Lower bushing');
    q.finish();
  }

  // ================================================================ SHUTTERS + LINKAGE
  {
    const g = new THREE.Group();
    const p = part('shutters', V(0, 0, 420));
    p.add(B(-hw + 60, -hw + 75, yShelf + 60, yPRC - 340, zP + 230, zP + 240), 'galvDark', 'Shutter guide');
    p.add(B(hw - 75, hw - 60, yShelf + 60, yPRC - 340, zP + 230, zP + 240), 'galvDark', 'Shutter guide');
    p.finish();
    // moving plates as separate meshes so the truck can drive them
    for (const [y, s, name] of [[yU, 1, 'Upper shutter (busbar side)'], [yL, -1, 'Lower shutter (feeder side)']]) {
      const pp = new PartBuilder(new THREE.Group(), mats);
      const y0 = s > 0 ? y - 120 : y - 140, y1 = s > 0 ? y + 140 : y + 120;
      pp.add(B(-hw + 75, hw - 75, y0, y1, zP + 232, zP + 235), 'galv', name);
      pp.add(B(-hw + 75, hw - 75, s > 0 ? y0 : y1 - 15, s > 0 ? y0 + 15 : y1, zP + 228, zP + 240), 'galvDark', name + ' edge');
      // warning label
      pp.add(B(-30, 30, y - 25, y + 25, zP + 235, zP + 236), 'yellow', 'Warning label');
      const m = pp.finish();
      m.userData.shut = s;
      m.userData.part = 'shutters';
      parts.shutters[0].add(m);
    }
    // side linkage: cranked levers on both sides driven by the truck
    const lk = part('shutterMech', V(0, 0, 420));
    for (const s of [-1, 1]) {
      const x = s * (hw - 50);
      lk.add(B(x - 5, x + 5, yShelf + 40, yShelf + 200, zP + 260, zP + 480), 'steel', 'Drive slide');
      lk.add(TU([[x, yShelf + 190, zP + 470], [x, yL - 20, zP + 300], [x, yL + 60, zP + 250]], 6), 'steel', 'Shutter lever');
      lk.add(TU([[x, yShelf + 190, zP + 420], [x, yU - 60, zP + 320], [x, yU + 80, zP + 250]], 6), 'steel', 'Shutter lever');
      lk.add(C(12, 12, 14, 'x', x, yL - 20, zP + 300), 'steel', 'Pivot');
      lk.add(C(12, 12, 14, 'x', x, yU - 60, zP + 320), 'steel', 'Pivot');
      lk.add(B(x - 2, x + 2, yShelf + 30, yPRC - 340, zP + 250, zP + 500), 'galv', 'Shutter mechanism cover');
    }
    lk.finish();
  }

  // ================================================================ SHELF + GUIDE RAILS + INTERLOCK UNIT (switching-device compartment)
  {
    const p = part('shelf', V(0, -120, 120));
    p.add(EY(rect(-hw + 2, zP + 30, hw - 2, D - 40), yShelf - 3, yShelf), 'galv', 'Withdrawable-part shelf');
    for (const s of [-1, 1]) {
      const x = s * (hw - 70);
      p.add(EX([[zP + 180, yShelf], [D - 40, yShelf], [D - 40, yShelf + 30], [D - 50, yShelf + 30], [D - 50, yShelf + 4], [zP + 180, yShelf + 4]], x - 15, x + 15), 'steel', 'Guide rail (ISOFLEX TOPAS L 32)');
      p.add(B(x - 22, x - 15, yShelf, yShelf + 30, zP + 180, D - 40), 'steel', 'Guide rail flank');
    }
    // racking spindle nut block and earthing interlock unit at the front of the shelf
    p.add(RB(-90, 90, yShelf, yShelf + 70, D - 150, D - 45, 6), 'black', 'Operating and interlocking unit (racking)');
    p.add(C(14, 14, 120, 'z', 0, yShelf + 40, D - 100), 'steel', 'Racking shaft');
    p.add(C(10, 10, D - 40 - (zP + 50), 'z', hw - 95, yShelf - 140, (D - 40 + zP + 50) / 2), 'steel', 'Earthing switch drive rod');
    p.add(RB(hw - 130, hw - 60, yShelf - 180, yShelf - 100, D - 130, D - 45, 6), 'black', 'Earthing switch operating unit');
    p.add(B(-hw + 20, -hw + 30, yShelf + 30, yShelf + 300, D - 60, D - 40), 'zinc', 'Position switch block');
    // earthing contact rail for the truck
    p.add(B(-30, 30, yShelf, yShelf + 8, zP + 200, D - 160), 'copper', 'Truck earthing contact rail');
    // fixed part of the 64-pole LV connector, under the LV compartment
    p.add(RB(-80, 80, yLV - 40, yLV - 2, zPole + 40, zPole + 120, 4), 'black', 'LV socket (fixed part, 64-pole)');
    p.finish();
  }

  // ================================================================ VERTICAL PARTITION A|C + PROTECTION PLATE
  {
    const p = part('partition', V(0, 0, 560));
    const z = zP + 2;
    p.add(EZ(rect(-hw + 8, YB + 70, hw - 8, yBC + 20), z - 1.5, z + 1.5, xs.map((x) => circleHole(x, yL, 78))), 'galv', 'Vertical partition');
    p.add(B(-hw + 8, hw - 8, YB + 70, YB + 90, z, z + 18), 'galv', 'Partition bottom fold');
    p.add(B(-150, 150, 700, 760, z + 1.5, z + 2.5), 'yellow', 'Instruction label "screw in all bolts"');
    const pts = [];
    for (const x of spread(-hw + 40, hw - 40, 5)) pts.push(N(x, yBC - 5, z + 3));
    for (const y of spread(YB + 200, yBC - 110, 3)) pts.push(N(-hw + 25, y, z + 3), N(hw - 25, y, z + 3));
    for (const x of spread(-hw + 40, hw - 40, 4)) pts.push(N(x, YB + 100, z + 3));
    anchor('partition', p, pts.map((q) => ({p: q, n: N(0, 0, 1)})));
    p.finish();
  }
  {
    const p = part('protPlate', V(0, 0, 760));
    p.add(EZ(rect(-hw + 50, YB + 15, hw - 50, YB + 300), zP + 30, zP + 32, [rectHole(-hw + 90, YB + 120, hw - 90, YB + 200)]), 'galv', 'Protection plate');
    for (const x of spread(-hw + 110, hw - 110, Math.round((W - 220) / 40))) p.add(B(x - 6, x + 6, YB + 120, YB + 200, zP + 30.5, zP + 31.5), 'galvDark', 'Vent slot');
    anchor('protPlate', p, [N(-hw + 75, YB + 40, zP + 33), N(hw - 75, YB + 40, zP + 33), N(-hw + 75, YB + 275, zP + 33), N(hw - 75, YB + 275, zP + 33)].map((q) => ({p: q, n: N(0, 0, 1)})));
    p.finish();
  }

  // ================================================================ WIRING DUCT + FRONT LINK
  {
    const p = part('wiringDuct', V(-300, 0, 120));
    const x0 = -hw + 8, x1 = -hw + 72;
    p.add(B(x0, x1, YB + 60, yLV - 40, D - 340, D - 338), 'galvDark', 'Wiring duct back');
    p.add(B(x0, x1, YB + 60, yLV - 40, D - 222, D - 220), 'galvDark', 'Wiring duct side');
    p.add(B(x1, x1 + 2, YB + 80, 840, D - 345, D - 215), 'galv', 'Lower wiring duct cover');
    p.add(B(x1, x1 + 2, 870, yLV - 60, D - 345, D - 215), 'galv', 'Upper wiring duct cover');
    for (let i = 0; i < 6; i++) p.add(TU([[x0 + 15 + i * 7, YB + 80, D - 300 + i * 8], [x0 + 15 + i * 7, yLV - 40, D - 300 + i * 8]], 3, 4, 6), i % 2 ? 'black' : 'grey', 'Control cables');
    anchor('wdc', p, [N(x1 + 3, 160, D - 280), N(x1 + 3, 780, D - 280), N(x1 + 3, 940, D - 280), N(x1 + 3, yLV - 120, D - 280)].map((q) => ({p: q, n: N(1, 0, 0)})));
    p.finish();
    const l = part('link', V(-140, 0, 320));
    l.add(B(-hw - 8, -hw + 8, 300, 1500, D - 60, D - 42), 'galvDark', 'Panel connection link');
    l.finish();
  }

  // ================================================================ CONNECTION COMPARTMENT
  {
    const p = part('cts', V(0, 0, -260));
    for (const x of xs) {
      // block-type CT: cast-resin block around the primary conductor, secondary terminal box on top
      p.add(RB(x - 70, x + 70, yL - 95, yL + 95, zP - 270, zP - 110, 10, 2), 'resin', 'Block-type current transformer');
      p.add(RB(x - 75, x + 75, yL - 100, yL - 80, zP - 280, zP - 100, 3, 1), 'resinLight', 'CT foot');
      p.add(RB(x - 40, x + 40, yL + 95, yL + 125, zP - 230, zP - 150, 4, 1), 'black', 'Secondary terminal box');
      p.add(B(x - 35, x + 35, yL + 10, yL + 50, zP - 271, zP - 270), 'white', 'CT rating plate');
      for (const dz of [-210, -170]) p.add(C(5, 5, 14, 'y', x - 20, yL + 130, zP + dz), 'zinc', 'Secondary terminal');
    }
    p.add(B(-hw + 20, hw - 20, yL - 115, yL - 100, zP - 300, zP - 80), 'galvDark', 'CT mounting frame');
    p.finish();
  }
  {
    const p = part('connBars', V(0, 0, -400));
    for (const x of xs) {
      for (const g of BAR([[x, yL, zP - 50], [x, yL, zC], [x, 470, zC]], 60, 10)) p.add(g, 'copper', 'Cable connection bar');
      p.add(C(10, 10, 8, 'z', x, 650, zC - 6), 'black', 'Lug bolt hole');
      p.add(C(10, 10, 8, 'z', x, 550, zC - 6), 'black', 'Lug bolt hole');
      // fixed earthing contact on the bar
      p.add(B(x - 22, x + 22, 720, 770, zC + 5, zC + 22), 'silver', 'Earthing switch fixed contact');
    }
    anchor('lugM12', p, xs.flatMap((x) => [N(x, 650, zC - 10), N(x, 550, zC - 10)]).map((q) => ({p: q, n: N(0, 0, -1)})), {nut: 32});
    p.finish();
  }
  {
    const p = part('cables', V(0, -140, -560));
    for (const x of xs) {
      for (const [yl, dz] of [[650, -24], [550, -62]]) {
        const z = zC + dz;
        p.add(RB(x - 21, x + 21, yl - 22, yl + 24, z - 6, z + 6, 3, 1), 'tinned', 'Cable lug (palm)');
        p.add(C(13, 13, 70, 'y', x, yl - 57, z - 4), 'tinned', 'Cable lug (barrel)');
        const top = yl - 90;
        p.add(L([[30, 0], [36, 30], [26, 40], [52, 50], [26, 62], [52, 80], [26, 92], [52, 110], [26, 122], [30, 280], [34, 330], [26, 340]].map(([r, h]) => [r, 340 - h]), 'y', x, top - 340, z - 4), 'rubber', 'Cable sealing end');
        p.add(TU([[x, top - 340, z - 4], [x, 200, z - 4], [x, YB + 20, z - 10], [x, -200, z - 30]], 23, 12, 14), 'cable', 'HV cable (single-core)');
        // copper screen earth lead to the earthing busbar
        p.add(TU([[x + 26, top - 330, z - 4], [x + 40, 260, z - 20], [x * 0.3 + 10, 205, 120], [0, 196, 80]], 4, 24, 6), 'earth', 'Cable screen earth lead');
      }
    }
    p.finish();
  }
  {
    const p = part('clamps', V(0, -60, -620));
    const y = 300;
    p.add(EX([[zC - 125, y - 25], [zC - 85, y - 25], [zC - 85, y - 22], [zC - 122, y - 22], [zC - 122, y + 25], [zC - 125, y + 25]], -hw + 25, hw - 25), 'galvDark', 'Cable bracket');
    const lo = [], hi = [];
    for (const x of xs) {
      for (const dz of [-24, -62]) {
        p.add(RB(x - 46, x + 46, y - 22, y + 22, zC + dz - 52, zC + dz - 28, 4, 1), 'black', 'Cable clamp lower part (id-Technik K)');
        p.add(RB(x - 46, x + 46, y - 22, y + 22, zC + dz + 20, zC + dz + 36, 4, 1), 'black', 'Cable clamp upper part');
      }
      lo.push(N(x - 36, y, zC - 126), N(x + 36, y, zC - 126));
      hi.push(N(x - 36, y, zC + 12), N(x + 36, y, zC + 12));
    }
    anchor('clampBr', p, lo.map((q) => ({p: q, n: N(0, 0, -1)})));
    anchor('clampTop', p, hi.map((q) => ({p: q, n: N(0, 0, 1)})));
    p.finish();
  }
  {
    const p = part('floorPlate', V(0, -300, -320));
    const holes = [];
    for (const x of xs) for (const dz of [-24, -62]) holes.push(circleHole(x, -(zC + dz - 8), 52));
    holes.push(slotHole(-hw + 70, -60, 42, 7));
    p.add(EY(rect(-hw + 20, 70, hw - 20, zP - 20), YB - 3, YB, holes), 'galv', 'Floor plate');
    for (const x of xs) for (const dz of [-24, -62]) p.add(L([[52, 0], [56, 0], [56, 8], [30, 14], [27, 30], [24, 30]], 'y', x, YB - 3, zC + dz - 8), 'rubber', 'Rubber sleeve');
    const pts = [];
    for (const x of spread(-hw + 40, hw - 40, 3)) pts.push(N(x, YB, 85), N(x, YB, zP - 35));
    anchor('floorPlate', p, pts.map((q) => ({p: q, n: N(0, 1, 0)})));
    p.finish();
  }
  {
    const p = part('earthBar', V(0, -120, -700));
    p.add(EZ(rect(-hw + 5, 170, hw - 5, 210), 62, 68, spread(-hw + 40, hw - 40, Math.round(W / 60)).map((x) => circleHole(x, 190, 6.5))), 'copper', 'Earthing busbar');
    p.add(B(-hw - 40, -hw + 70, 172, 208, 68, 74), 'copper', 'Earthing busbar link to neighbour');
    for (const x of [-hw + 60, hw - 60]) p.add(B(x - 15, x + 15, YB, 172, 60, 70), 'galvDark', 'Earth bar support');
    anchor('earthLink', p, [{p: N(-hw + 25, 190, 75), n: N(0, 0, 1)}, {p: N(-hw + 55, 190, 75), n: N(0, 0, 1)}], {nut: 20});
    anchor('earthConn', p, [{p: N(0, 190, 69), n: N(0, 0, 1)}], {nut: 14});
    p.finish();
  }
  {
    // make-proof feeder earthing switch: shaft low near the partition, knife blades swing up to the bar contacts
    const p = part('esw', V(0, -40, -460));
    const yS = 470, zS = zP - 70;
    p.add(C(15, 15, W - 70, 'x', 0, yS, zS), 'steel', 'Earthing switch shaft');
    for (const s of [-1, 1]) p.add(RB(s * (hw - 40) - 12, s * (hw - 40) + 12, yS - 50, yS + 40, zS - 40, zS + 40, 4), 'galvDark', 'Shaft bearing');
    p.add(RB(hw - 120, hw - 70, yS - 40, yS + 40, zS - 30, zS + 50, 4), 'black', 'Drive lever + toggle spring');
    p.add(TU([[hw - 95, yS, zS + 40], [hw - 95, yS - 100, zP], [hw - 95, yShelf - 140, zP + 40]], 7), 'steel', 'Drive linkage');
    for (const x of xs) {
      const bl = new THREE.Group();
      bl.position.set(x, yS, zS);
      bl.userData.blade = true;
      const pb = new PartBuilder(bl, mats);
      // twin knife blades from the shaft to the fixed contact on the bar (closed pose: pointing to it)
      const dy = 745 - yS, dz = zC + 14 - zS;
      const len = Math.hypot(dy, dz);
      for (const o of [-14, 14]) pb.add(B(o - 3, o + 3, -12, 12, 0, len), 'copper', 'Earthing knife');
      pb.add(C(18, 18, 40, 'x', 0, 0, 0), 'steel', 'Blade hub');
      pb.finish();
      bl.userData.closedAngle = Math.atan2(dy, dz); // rotation about x to point the +z blade at the contact
      bl.rotation.x = -bl.userData.closedAngle;
      parts.esw[0].add(bl);
      p.add(TU([[x, yS, zS], [x, 120, zS - 20], [x * 0.5, 180, 70]], 5, 10, 6), 'copper', 'Earthing connection to earth bar');
    }
    p.finish();
  }
  {
    const p = part('vt', V(0, 140, -700));
    for (const x of xs) {
      p.add(RB(x - 60, x + 60, 760, 960, 25, 175, 12, 2), 'resin', 'Voltage transformer (cast resin)');
      p.add(L([[26, 0], [32, 15], [24, 25], [32, 40], [24, 50], [20, 70]], 'y', x, 960, 100), 'resin', 'VT primary terminal');
      p.add(B(x - 45, x + 45, 800, 840, 175, 177), 'white', 'VT rating plate');
      p.add(TU([[x, 1032, 100], [x, 1060, 150], [x, yL + 60, zP - 290]], 5, 10, 6), 'copper', 'VT primary lead');
    }
    p.add(EY(rect(-hw + 20, 10, hw - 20, 190), 745, 760), 'galvDark', 'VT support');
    anchor('vtPrim', p, xs.map((x) => ({p: N(x, 1030, 100), n: N(0, 1, 0)})));
    p.finish();
  }
  {
    const p = part('heater', V(0, 0, -300));
    p.add(RB(-110, 110, YB + 60, YB + 140, zP - 70, zP - 30, 4), 'galvDark', 'Anti-condensation heater');
    for (const x of spread(-100, 100, 9)) p.add(B(x - 1, x + 1, YB + 60, YB + 140, zP - 80, zP - 70), 'galv', 'Heater fins');
    p.finish();
  }

  // ================================================================ REAR WALL + LEDGES
  {
    const p = part('rearWall', V(0, 0, -780), {shell: true});
    p.add(B(-hw + 12, hw - 12, YB + 5, yBC - 5, -2, 0), 'galv', 'Rear wall');
    for (const y of [400, 750]) p.add(B(-hw + 30, hw - 30, y - 20, y + 20, 0, 12), 'galv', 'Rear wall stiffener');
    p.add(TU([[-70, 640, -2], [-70, 640, -30], [70, 640, -30], [70, 640, -2]], 6), 'black', 'Handle');
    p.add(B(-60, 60, 860, 960, -3, -2), 'yellow', 'Warning sign');
    anchor('rearBase', p, spread(-hw + 80, hw - 80, 4).map((x) => ({p: N(x, YB + 40, -3), n: N(0, 0, -1)})));
    p.finish();
    const h = part('ledgeH', V(0, 0, -960));
    h.add(EX([[-12, yBC - 25], [-3, yBC - 25], [-3, yBC + 25], [-12, yBC + 25]], -hw, hw), 'ral', 'Horizontal ledge');
    anchor('rearH', h, spread(-hw + 30, hw - 30, 9).map((x) => ({p: N(x, yBC, -13), n: N(0, 0, -1)})));
    h.finish();
    const v = part('ledgeV', V(0, 0, -1040));
    for (const sx of [-hw, hw]) {
      v.add(B(sx - 25, sx + 25, YB + 20, yBC - 25, -12, -3), 'ral', 'Vertical ledge');
      v.add(B(sx - 6, sx + 6, YB + 30, yBC - 30, -3, 10), 'rubber', 'Sealing bracket');
    }
    anchor('rearV', v, [-hw, hw].flatMap((sx) => spread(YB + 50, yBC - 50, 14).map((y) => ({p: N(sx + (sx < 0 ? 12 : -12), y, -13), n: N(0, 0, -1)}))));
    v.finish();
  }

  // ================================================================ LOW-VOLTAGE COMPARTMENT
  {
    const p = part('lv', V(0, 460, 340), {shell: true});
    p.add(B(-hw + 1, hw - 1, yLV, yLV + 2, zLV, D), 'galv', 'LV compartment floor');
    p.add(B(-hw + 1, hw - 1, LVTOP - 2, LVTOP, zLV, D), 'galv', 'LV compartment roof');
    p.add(B(-hw, -hw + 2, yLV, LVTOP, zLV, D), 'galv', 'LV side');
    p.add(B(hw - 2, hw, yLV, LVTOP, zLV, D), 'galv', 'LV side');
    p.add(B(-hw + 1, hw - 1, yLV, LVTOP, zLV - 2, zLV), 'galv', 'LV back wall');
    // door
    p.add(RB(-hw + 4, hw - 4, yLV + 6, LVTOP - 6, D - 24, D, 4, 1), 'ral', 'LV door');
    for (const y of [yLV + 80, LVTOP - 80]) p.add(C(9, 9, 60, 'y', -hw + 6, y, D - 6), 'steel', 'Door hinge');
    p.add(RB(hw - 60, hw - 30, 1660, 1760, D, D + 16, 4), 'black', 'Door lock (3 mm double-bit)');
    // protection relay with display, LEDs and keypad
    const rx = -60, ry = 1720;
    p.add(RB(rx - 75, rx + 75, ry - 130, ry + 140, D, D + 18, 4), 'grey', 'Protection device');
    p.add(B(rx - 55, rx + 55, ry + 40, ry + 120, D + 18, D + 19), 'screen', 'Protection device display');
    for (let i = 0; i < 8; i++) p.add(C(3, 3, 3, 'z', rx - 60, ry + 110 - i * 14, D + 19), i < 2 ? 'green' : 'red', 'LED');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) p.add(RB(rx - 28 + c * 22, rx - 12 + c * 22, ry - 100 + r * 22, ry - 84 + r * 22, D + 18, D + 21, 2, 1), 'white', 'Keypad');
    // test sockets of the voltage detecting system (LRM) along the bottom of the door
    for (let i = 0; i < 3; i++) p.add(C(7, 7, 6, 'z', -60 + i * 40, yLV + 50, D + 2), ['yellow', 'green', 'red'][i], 'LRM test socket');
    p.add(B(-90, 90, yLV + 30, yLV + 70, D, D + 1), 'black', 'Test socket panel');
    p.add(B(rx + 100, rx + 210, 1880, 1930, D, D + 1), 'white', 'Panel designation label');
    // interior: mounting plate, DIN rails with MCBs, terminals, slotted ducts
    p.add(B(-hw + 20, hw - 20, yLV + 30, LVTOP - 30, zLV + 2, zLV + 4), 'galv', 'Mounting plate');
    for (const [y, n, mat, lab] of [[1890, 6, 'white', 'MCB (3RV)'], [1720, 4, 'grey', 'Auxiliary relay'], [1530, Math.round((W - 120) / 14), 'grey', 'Terminal block']]) {
      p.add(B(-hw + 40, hw - 40, y - 18, y + 18, zLV + 4, zLV + 12), 'steel', 'DIN rail');
      const w = lab === 'Terminal block' ? 6 : 26;
      for (const x of spread(-hw + 60, hw - 60, n)) p.add(RB(x - w, x + w, y - 45, y + 45, zLV + 12, zLV + 80, 2, 1), mat, lab);
      p.add(B(-hw + 40, hw - 40, y + 50, y + 80, zLV + 4, zLV + 55), 'grey', 'Slotted wiring duct');
    }
    p.add(B(-hw + 30, -hw + 70, yLV + 20, LVTOP - 40, zLV + 4, zLV + 60), 'grey', 'Slotted wiring duct');
    p.add(RB(hw - 120, hw - 40, yLV + 20, yLV + 140, zLV + 4, zLV + 70, 4), 'black', 'Bus-wire terminal block');
    anchor('lv', p, spread(yLV + 80, LVTOP - 80, 3).map((y) => ({p: N(-hw + 3, y, zLV + 200), n: N(1, 0, 0)})), {nut: 6});
    p.finish();
  }

  // ================================================================ HIGH-VOLTAGE DOOR
  {
    const p = part('hvdoor', V(0, 0, 960), {shell: true});
    const z = D - 30;
    p.add(RB(-hw + 4, hw - 4, YB + 5, yLV - 6, z, D, 5, 1), 'ral', 'High-voltage door (pressure-resistant)');
    p.add(RB(-hw + 30, hw - 30, YB + 30, yLV - 30, z - 25, z, 4, 1), 'ralDark', 'Door inner reinforcement');
    for (const y of [YB + 150, 700, yLV - 150]) p.add(C(11, 11, 80, 'y', -hw + 6, y, D - 8), 'steel', 'Door hinge');
    // inspection window
    p.add(B(-125, 125, 1000, 1200, D - 1, D + 1), 'glass', 'Inspection window (CB indicators, counter)');
    p.add(B(-135, 135, 990, 1000, D, D + 3), 'black', 'Window frame');
    p.add(B(-135, 135, 1200, 1210, D, D + 3), 'black', 'Window frame');
    // mimic diagram plate
    p.add(B(-hw + 70, hw - 70, 480, 950, D, D + 2), 'white', 'Mimic diagram');
    p.add(B(-hw + 100, hw - 100, 912, 920, D + 2, D + 3), 'black', 'Mimic: busbar');
    p.add(B(-3, 3, 510, 912, D + 2, D + 3), 'black', 'Mimic: feeder');
    p.add(B(-28, 28, 790, 850, D + 2, D + 3), 'black', 'Mimic: circuit-breaker');
    p.add(C(26, 26, 5, 'z', 0, 870, D + 4), 'black', 'Position indicator withdrawable part');
    p.add(C(20, 20, 5, 'z', 70, 600, D + 4), 'black', 'Position indicator feeder earthing switch');
    // actuating openings + slides
    p.add(C(14, 14, 6, 'z', 0, 720, D + 2), 'steel', 'Actuating opening: racking');
    p.add(RB(-30, 30, 680, 770, D + 2, D + 7, 3), 'zinc', 'Operating slide (racking)');
    p.add(C(7, 7, 6, 'z', 55, 720, D + 2), 'steel', 'Double-bit key opening (5 mm)');
    p.add(C(14, 14, 6, 'z', 70, 530, D + 2), 'steel', 'Actuating opening: earthing switch');
    p.add(C(9, 9, 6, 'z', -60, 1250, D + 2), 'green', 'Actuating opening: CLOSE');
    p.add(C(9, 9, 6, 'z', 60, 1250, D + 2), 'red', 'Actuating opening: OPEN');
    p.add(C(14, 14, 8, 'z', 0, 1300, D + 3), 'black', 'Rotary button / spring charging opening');
    // door handle lever on the right
    p.add(RB(hw - 55, hw - 30, 620, 940, D, D + 40, 6), 'black', 'Door handle');
    p.add(C(14, 14, 20, 'z', hw - 42, 940, D + 10), 'steel', 'Handle pivot');
    p.add(B(-hw + 80, -hw + 260, 1230, 1280, D, D + 1), 'yellow', 'Instruction label');
    p.finish();
    // moving front elements: earthing-switch slide, indicators, operating lever (O §10.16)
    const mk = (flag, label, build, pos) => {
      const g = new THREE.Group();
      const pb = new PartBuilder(g, mats);
      build(pb);
      pb.finish();
      g.userData[flag] = true;
      g.userData.label = label;
      g.traverse((c) => { if (c.isMesh) c.userData.part = 'doorCtl'; });
      g.position.copy(pos);
      parts.hvdoor[0].add(g);
      return g;
    };
    mk('eswSlide', 'Operating slide (earthing switch)', (b) => b.add(RB(-30, 30, -40, 40, 0, 5, 3), 'zinc', 'Operating slide (earthing switch)'), V(70, 530, D + 2));
    mk('eswInd', 'Position indicator feeder earthing switch (vertical I = earthed)', (b) => b.add(B(-4, 4, -18, 18, 0, 1), 'white', 'Indicator bar'), V(70, 600, D + 6));
    mk('truckInd', 'Position indicator withdrawable part (vertical = service, horizontal = test)', (b) => b.add(B(-4, 4, -22, 22, 0, 1), 'white', 'Indicator bar'), V(0, 870, D + 6));
    const lev = mk('eswLever', 'Operating lever, feeder earthing switch (180°)', (b) => {
      b.add(C(9, 9, 160, 'z', 0, 0, 80), 'steel', 'Lever shaft');
      b.add(B(-14, 14, -3, 3, -6, 6).translate(0, 0, 4), 'steel', 'Coupling pins');
      b.add(C(16, 16, 240, 'x', 0, 0, 165), 'black', 'Lever handle (cross bar)');
      b.add(C(19, 19, 60, 'x', 112, 0, 165), 'red', 'Grip');
    }, V(70, 530, D));
    lev.visible = false;
  }

  // ================================================================ WITHDRAWABLE 3AE CIRCUIT-BREAKER
  // three part groups that move together: truck (chassis), mech (operating mechanism), breaker (poles + contacts)
  const zFront = D - 95;
  {
    const p = part('truck', V(0, 0, 0));
    p.group.userData.truck = true;
    const y0 = yShelf + 4;
    p.add(RB(-hw + 70, hw - 70, y0 + 25, y0 + 75, zP + 200, zFront, 4), 'galvDark', 'Truck chassis');
    for (const s of [-1, 1]) {
      p.add(B(s * (hw - 82) - 8, s * (hw - 82) + 8, y0 + 20, y0 + 100, zP + 200, zFront), 'steel', 'Truck side member');
      for (const z of [zP + 240, zFront - 60]) p.add(C(28, 28, 22, 'x', s * (hw - 70), y0 + 28, z, 20), 'black', 'Truck wheel');
    }
    p.add(C(11, 11, zFront - zP - 260, 'z', 0, y0 + 50, (zFront + zP + 260) / 2), 'steel', 'Racking spindle');
    p.add(RB(-45, 45, y0 + 30, y0 + 80, zP + 300, zP + 360, 4), 'black', 'Spindle nut');
    p.add(RB(-hw + 90, -hw + 160, y0 + 75, y0 + 105, zFront - 100, zFront - 10, 4), 'red', 'Unlocking lever (service truck)');
    p.add(RB(hw - 160, hw - 90, y0 + 75, y0 + 105, zFront - 100, zFront - 10, 4), 'red', 'Unlocking lever (service truck)');
    p.add(B(-25, 25, y0 + 2, y0 + 25, zP + 220, zP + 300), 'copper', 'Earthing contact (sliding)');
    p.finish();
  }
  {
    const p = part('mech', V(0, 0, 0));
    p.group.userData.truck = true;
    const y0 = yShelf + 80, y1 = 1300;
    p.add(RB(-hw + 85, hw - 85, y0, y1, zPole + 110, zFront, 8, 2), 'housing', 'Operating mechanism housing');
    p.add(B(-hw + 100, hw - 100, y0 + 20, y1 - 20, zFront, zFront + 3), 'housing', 'Front cover');
    // front plate elements (3AE5)
    p.add(RB(-30, 30, 1080, 1115, zFront + 3, zFront + 10, 4), 'green', 'CLOSE push button');
    p.add(RB(-30, 30, 1020, 1055, zFront + 3, zFront + 10, 4), 'red', 'OPEN push button');
    p.add(B(40, 120, 1130, 1180, zFront + 3, zFront + 4), 'white', 'CLOSED/OPEN indicator');
    p.add(B(40, 120, 1070, 1110, zFront + 3, zFront + 4), 'yellow', 'Spring state indicator (CHARGED)');
    p.add(B(-120, -50, 1140, 1170, zFront + 3, zFront + 4), 'black', 'Operations counter');
    p.add(C(14, 14, 8, 'z', 0, 1240, zFront + 6), 'steel', 'Hand-crank shaft (≈ 50 turns)');
    p.add(B(-80, 80, 860, 940, zFront + 3, zFront + 4), 'white', 'Rating plate');
    p.add(RB(-hw + 120, -hw + 190, 960, 1020, zFront + 3, zFront + 8, 3), 'black', 'Racking interlock / coding');
    // internals visible in the section: closing spring, opening spring, motor, cam shaft, releases, aux switch
    const zi = (zPole + 110 + zFront) / 2;
    const coil = (x, yb, len, r, label) => {
      const pts = [];
      for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 2 * 9; pts.push([x + Math.cos(a) * r, yb + (i / 120) * len, zi + Math.sin(a) * r]); }
      p.add(TU(pts, 4, 240, 6), 'spring', label);
    };
    coil(-hw + 150, y0 + 60, 380, 32, 'Closing spring');
    coil(hw - 150, y0 + 60, 260, 22, 'Opening spring');
    p.add(C(45, 45, 110, 'z', -40, y0 + 130, zi), 'blue', 'Spring charging motor');
    p.add(C(26, 26, W - 240, 'x', 0, 1000, zi), 'steel', 'Main shaft (camshaft)');
    p.add(C(60, 60, 18, 'x', -60, 1000, zi), 'steel', 'Closing cam');
    p.add(RB(40, 120, 1120, 1190, zi - 40, zi + 40, 4), 'black', 'Shunt closing release');
    p.add(RB(140, 220, 1120, 1190, zi - 40, zi + 40, 4), 'black', 'Shunt opening release');
    p.add(RB(-hw + 110, -hw + 170, y0 + 450, y0 + 620, zi - 50, zi + 50, 4), 'grey', 'Auxiliary switch');
    // 64-pole LV plug and its cable to the fixed socket
    p.add(RB(-60, 60, y1, y1 + 40, zPole + 300, zPole + 380, 4), 'black', 'LV plug carrier');
    p.finish();
    const plug = part('lvPlug', V(0, 0, 0));
    plug.group.userData.truck = true;
    plug.add(TU([[0, y1 + 30, zPole + 340], [0, y1 + 50, zPole + 330], [0, yLV - 90, zPole + 200], [0, yLV - 60, zPole + 80]], 14, 30, 12), 'black', 'LV plug cable (64-pole)');
    plug.add(RB(-80, 80, yLV - 70, yLV - 40, zPole + 40, zPole + 120, 4), 'black', 'LV plug (64-pole, coded)');
    plug.finish();
  }
  {
    const p = part('breaker', V(0, 0, 0));
    p.group.userData.truck = true;
    const ym = (yU + yL) / 2;
    for (let k = 0; k < 3; k++) {
      const x = xs[k];
      // embedded pole: epoxy housing with ribs, vacuum interrupter inside
      p.add(RB(x - 55, x + 55, yL - 110, yU + 120, zPole - 60, zPole + 60, 20, 3), 'epoxy', `Embedded pole L${k + 1}`);
      for (const y of spread(yL - 60, yU + 70, 6)) p.add(RB(x - 60, x + 60, y - 4, y + 4, zPole - 64, zPole + 64, 4, 1), 'epoxy', `Embedded pole L${k + 1}`);
      p.add(C(38, 38, 210, 'y', x, ym + 10, zPole), 'silver', 'Vacuum interrupter (inside the pole)');
      // terminals and contact arms to the bushings
      for (const [y, lab] of [[yU, 'Upper contact arm'], [yL, 'Lower contact arm']]) {
        const z0 = zP + 175, z1 = zPole - 55;
        p.add(C(contactR * 0.55, contactR * 0.55, z1 - z0, 'z', x, y, (z0 + z1) / 2, 20), 'silver', lab);
        // tulip contact: ring of contact fingers around the fixed contact + garter springs
        const nf = WIDTHS[W].contact === 40 ? 13 : 26, rr = contactR + 6; // 13 or 26 fingers (CB p.36)
        for (let f = 0; f < nf; f++) {
          const a = (f / nf) * Math.PI * 2;
          { const fw = nf === 26 ? 3.5 : 5; p.add(RB(x + Math.cos(a) * rr - fw, x + Math.cos(a) * rr + fw, y + Math.sin(a) * rr - fw, y + Math.sin(a) * rr + fw, zP + 110, zP + 190, 1.5, 1), 'silver', 'Tulip contact finger'); }
        }
        p.add(T(rr + 6, 3, 'z', x, y, zP + 130), 'spring', 'Tulip garter spring');
        p.add(T(rr + 6, 3, 'z', x, y, zP + 170), 'spring', 'Tulip garter spring');
      }
      // insulating coupling rod from mechanism to the moving contact
      p.add(C(16, 16, ym - 110 - (yShelf + 90), 'y', x, (ym - 110 + yShelf + 90) / 2, zPole + 80), 'epoxy', 'Insulating coupling rod');
      p.add(B(x - 22, x + 22, yShelf + 80, yShelf + 130, zPole + 60, zPole + 120), 'steel', 'Lever + contact pressure spring');
    }
    anchor('cbArm', p, xs.flatMap((x) => [yU, yL].map((y) => ({p: N(x, y + contactR * 0.55 + 4, zPole - 70), n: N(0, 1, 0)}))));
    anchor('cbTulip', p, xs.flatMap((x) => [yU, yL].map((y) => ({p: N(x, y, zP + 196), n: N(0, 0, 1)}))));
    // pole support frame
    p.add(B(-hw + 85, hw - 85, yShelf + 80, yShelf + 100, zPole - 70, zPole + 120), 'steel', 'Pole frame');
    p.add(B(-hw + 85, -hw + 100, yShelf + 80, yU + 140, zPole + 70, zPole + 110), 'steel', 'Pole frame');
    p.add(B(hw - 100, hw - 85, yShelf + 80, yU + 140, zPole + 70, zPole + 110), 'steel', 'Pole frame');
    p.finish();
  }

  // ================================================================ SERVICE TRUCK
  {
    const p = part('serviceTruck', V(0, 0, 0));
    p.group.visible = false;
    p.group.userData.service = true;
    const z0 = D + 10, yT = yShelf;
    p.add(B(-hw + 40, hw - 40, yT - 6, yT, z0, z0 + 900), 'steel', 'Service truck platform');
    for (const s of [-1, 1]) {
      const x = s * (hw - 70);
      p.add(EX([[z0, yT], [z0 + 900, yT], [z0 + 900, yT + 30], [z0 + 890, yT + 30], [z0 + 890, yT + 4], [z0, yT + 4]], x - 15, x + 15), 'steel', 'Service truck rails');
      for (const z of [z0 + 60, z0 + 840]) p.add(B(x - 15, x + 15, 60, yT - 6, z - 15, z + 15), 'steel', 'Service truck column');
      for (const z of [z0 + 60, z0 + 840]) p.add(C(30, 30, 30, 'x', x, 30, z, 16), 'black', 'Castor');
      p.add(B(x - 10, x + 10, yT, 1100, z0 + 870, z0 + 890), 'steel', 'Push handle');
    }
    p.add(C(14, 14, W - 120, 'x', 0, 1100, z0 + 880), 'steel', 'Push handle');
    p.add(RB(-hw + 60, hw - 60, 180, 220, z0 + 100, z0 + 800, 4), 'steel', 'Height adjustment / scissor');
    p.finish();
  }

  // ================================================================ CRANING ANGLES + RODS (transport)
  {
    const p = part('crane', V(0, 0, 0));
    p.group.visible = false;
    p.group.userData.crane = true;
    const pts = [];
    for (const s of [-1, 1]) for (const z of [D - 140, 140]) {
      const x = s * (hw + 3);
      p.add(B(Math.min(x, x + s * 8), Math.max(x, x + s * 8), 1900, 2200, z - 60, z + 60), 'steel', 'Craning angle');
      p.add(B(Math.min(x + s * 8, x + s * 90), Math.max(x + s * 8, x + s * 90), 2150, 2200, z - 60, z + 60), 'steel', 'Craning angle');
      for (const y of spread(1950, 2120, 3)) pts.push({p: N(x + s * 9, y, z), n: N(s, 0, 0)});
    }
    for (const s of [-1, 1]) {
      p.add(C(12.5, 12.5, D + 650, 'z', s * (hw + 50), 2230, D / 2), 'steel', 'Crane rod Ø 25 S355JR');
      for (const e of [-1, 1]) {
        p.add(C(25, 25, 4, 'z', s * (hw + 50), 2230, D / 2 + e * (D / 2 + 60)), 'zinc', 'Washer size 27');
        p.add(T(9, 2, 'x', s * (hw + 50), 2230, D / 2 + e * (D / 2 + 90)), 'steel', 'Locking cotter pin');
      }
    }
    anchor('crane', p, pts);
    p.finish();
  }

  const dirs = {};
  for (const [id, gs] of Object.entries(parts)) dirs[id] = gs[0].userData.dir;
  return {root, parts, anchors, dirs, shellIds, dims: {W, D, zP, zLV, yLV, yU, yL, zC, yShelf}};
}

// ------------------------------------------------------------------------------------------------- bolts
// Hex bolt drawn along +Y with the bearing face at y = 0 (head, washer, shank), and a matching nut.
const SIZES = {M8: {d: 8, s: 13, k: 5.3, m: 6.8}, M10: {d: 10, s: 16, k: 6.4, m: 8.4}, M12: {d: 12, s: 18, k: 7.5, m: 10.8}, M16: {d: 16, s: 24, k: 10, m: 14.8}};
const cache = {};
const chamferHex = (s, k) => {
  const r = s / Math.sqrt(3);
  return new THREE.CylinderGeometry(r * 0.92, r, k, 6, 1);
};
export function boltGeometry(size) {
  const key = 'b' + size;
  if (cache[key]) return cache[key];
  const {d, s, k} = SIZES[size] || SIZES.M8;
  const head = chamferHex(s, k);
  head.translate(0, d * 0.22 + k / 2, 0);
  const washer = new THREE.CylinderGeometry(s * 0.62, s * 0.62, d * 0.2, 18);
  washer.translate(0, d * 0.1, 0);
  const shank = new THREE.CylinderGeometry(d / 2, d / 2, d * 2.4, 10);
  shank.translate(0, -d * 1.2, 0);
  const g = mergeGeometries([head, washer, shank].map((x) => x.toNonIndexed()));
  g.userData.shared = true;
  return (cache[key] = g);
}
export function nutGeometry(size) {
  const key = 'n' + size;
  if (cache[key]) return cache[key];
  const {d, s, m} = SIZES[size] || SIZES.M8;
  const nut = chamferHex(s, m);
  nut.translate(0, d * 0.22 + m / 2, 0);
  const washer = new THREE.CylinderGeometry(s * 0.62, s * 0.5, d * 0.22, 18); // conical spring washer look
  washer.translate(0, d * 0.11, 0);
  const g = mergeGeometries([nut, washer].map((x) => x.toNonIndexed()));
  g.userData.shared = true;
  return (cache[key] = g);
}
