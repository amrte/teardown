// Procedural NXAIR circuit-breaker panel in millimetres. Layout after the dimension drawing 110-2300.9 (SUP p10/p54)
// and the catalog section HA 25.71 p. 10: busbar compartment B top rear, connection compartment C bottom rear,
// switching-device compartment A front with the withdrawable 3AE breaker on a mid-height shelf, low-voltage
// compartment E top front, pressure relief duct on top. Panel axes: x across the row (±W/2), y up from the floor,
// z from the rear (0) to the front door (D).
//
// Clearances are designed, not guessed: every part is placed from the named levels below and the model is verified
// with check.mjs (no interpenetration between parts in service and test position, earthing switch open and closed).
// Outer dimensions and compartment levels are real; shapes of poles, CTs, VTs and mechanisms are simplified.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BUSBAR, WIDTHS} from './data.js';
import {B, BAR, C, EX, EY, EZ, L, PartBuilder, RB, T, TU, circleHole, rect, rectHole, slotHole, spread} from './geom.js';

export const H = 2300;
export const TRAVEL = 200; // racking travel drawn (3AE options 180 / 200 / 220 mm; NXAIR value not published)
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

// The LV plug cable between the static plug under the LV compartment and the carrier on the breaker, which moves
// with the truck. Rebuilt whenever the truck moves.
export function lvCableGeometry(L0, dz) {
  const {x, y, z0, z1} = L0;
  return TU([[x, y, z0], [x, y + 4, z0 + 6], [x, y + 8, (z0 + z1 + dz) / 2], [x, y + 4, z1 + dz - 6], [x, y, z1 + dz]], 9, 24, 10);
}

// ---------------------------------------------------------------------------------------------- the panel
export function buildPanel(mats, opts) {
  const {W, D, bus, ur} = opts;
  const hw = W / 2;
  // ----- levels (mm). Dimension drawing: front part 688 mm (1350 deep) or 738 mm (≥ 1500), C top at 1075,
  // LV compartment 630 high x 406 deep from 1370, pressure relief duct to 2300 behind the LV compartment.
  const zP = D - (D >= 1500 ? 738 : 688); // partition A | B,C
  const yBC = 1075; // B floor / C roof
  const yPRC = 1730; // top of B, bottom of the pressure relief duct
  const zLV = D - 406; // back wall of the low-voltage compartment
  const yLV = 1370; // floor of the low-voltage compartment
  const LVTOP = yLV + 630;
  const TD = W === 1000 ? 310 : 275; // terminal distance upper-lower (3AE p. 32)
  const yU = 1170, yL = yU - TD; // contact axes
  const yShelf = 560; // withdrawable-part shelf
  const pitch = WIDTHS[W].pitch;
  const xs = [-pitch, 0, pitch]; // L1 L2 L3
  const BB = BUSBAR[bus];
  const zPh = [zP * 0.74, zP * 0.5, zP * 0.26]; // busbar stacks L1 front, L2 middle, L3 rear (I Fig. 61)
  const yPh = [1520, 1610, 1520];
  const contactR = (WIDTHS[W].contact || 79) / 2; // fixed contact radius in the bushings
  const armR = WIDTHS[W].contact === 40 ? 20 : 30; // contact arm Ø 40 / 60 (3AE p. 54)
  const nf = WIDTHS[W].contact === 40 ? 13 : 26; // tulip fingers (HG p. 36)
  const fw = nf === 26 ? 3.5 : 5; // finger half-width
  // switching-device compartment, front to back
  const zDoorIn = D - 40; // inner face of the HV door reinforcement
  const zFront = zDoorIn - 15 - TRAVEL - 15; // breaker front plate in service position (test: 15 mm behind the door)
  const SP = 100; // bushing spout length into A
  const spoutRi = contactR + 22, spoutRo = contactR + 45;
  const zTulip0 = zP + 35, zTulip1 = zP + 115; // tulip fingers in service position (overlap the fixed contact 60 mm)
  const zSh = zP + 125; // shutter plane
  const zPole = zP + 230; // pole centre
  const zMech0 = zPole + 70; // rear of the mechanism housing
  const yTruck0 = yShelf + 4; // top of the guide rails
  const yMech0 = yTruck0 + 76; // underside of the mechanism housing (640)
  const yMech1 = 1300;
  // connection compartment
  const zC = zP - 320; // cable connection bars
  const yBarLow = 610; // lower end of the connection bars
  const yLug = 640; // cable lug bolt
  const cz = zC - 11; // cable axis (lug on the rear face of the bar)
  const ySE1 = 548, ySE0 = ySE1 - 280; // sealing end
  const yClamp = 200;
  const yS = 740, zS = zC - 130; // earthing switch shaft
  const xE = pitch / 2; // earthing drive path between L2 and L3
  const flangeH = Math.min(90, pitch / 2 - 3);

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
  const cyl = (p, r, from, to, mat, label) => {
    // straight cylinder between two axis-aligned points
    const [ax, ay, az] = from, [bx, by, bz] = to;
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    const axis = ax !== bx ? 'x' : ay !== by ? 'y' : 'z';
    p.add(C(r, r, len, axis, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, 14), mat, label);
  };

  // ================================================================ SITE
  {
    const p = part('rails', V(0, -380, 0));
    const cutW = {600: 440, 800: 640, 1000: 700}[W];
    const ctl = 1215 + (D - 1500);
    p.add(EY(rect(-hw - 2, -60, hw + 2, D + 60), -60, -52, [rectHole(-cutW / 2, -125, cutW / 2, -(125 + 545)), rectHole(-hw + 20, -(ctl - 180), -hw + 85, -ctl)]), 'galvDark', 'Floor cut-outs (HV cables, control cables)');
    for (const z of [40, D - 40]) {
      const prof = [[-25, -30], [25, -30], [25, 0], [22, 0], [22, -27], [-22, -27], [-22, 0], [-25, 0]];
      p.add(EX(prof.map(([zz, y]) => [z + zz, y]), -hw, hw), 'steel', 'C-profile rail CB 50x30x3');
      for (const x of [-hw + 150, hw - 150]) {
        p.add(B(x - 40, x + 40, -35, -30, z - 72, z + 73), 'galvDark', 'Floor fixing plate 80x5x145');
        p.add(C(8, 8, 60, 'y', x, -65, z + 50), 'zinc', 'Expansion dowel FAN 12/10');
      }
    }
    p.finish();
  }

  // ================================================================ BASE FRAME
  {
    const p = part('base', V(0, -200, 0));
    for (const s of [-1, 1]) {
      const x0 = s * hw, x1 = s * (hw - 45);
      p.add(B(Math.min(x0, x1), Math.max(x0, x1), 0, 3, 0, D), 'galvDark', 'Base frame side channel');
      p.add(B(Math.min(x0, x1), Math.max(x0, x1), YB - 3, YB, 0, D), 'galvDark', 'Base frame side channel');
      p.add(B(Math.min(s * hw, s * (hw - 3)), Math.max(s * hw, s * (hw - 3)), 3, YB - 3, 0, D), 'galvDark', 'Base frame side channel');
    }
    for (const [z0, z1, zc] of [[10, 80, 45], [D - 85, D - 15, D - 60]]) {
      p.add(EY(rect(-hw + 45, z0, hw - 45, z1), YB - 3, YB, [slotHole(0, -zc, 60, 20)]), 'galvDark', 'Cross member, elongated hole 60x20');
      p.add(B(-hw + 45, hw - 45, 0, YB - 3, z0, z0 + 3), 'galvDark', 'Cross member');
    }
    for (const z of [zP - 45, zP + 300]) p.add(B(-hw + 45, hw - 45, YB - 3, YB, z - 25, z + 25), 'galvDark', 'Cross member');
    for (const z of [45, D - 60]) for (const x of [-60, 60]) p.add(B(x - 20, x + 20, -1, 0, z - 30, z + 30), 'steel', 'Shim 0.5–1.0 mm');
    anchor('floorC', p, [{p: N(0, YB, 45), n: N(0, 1, 0)}, {p: N(0, YB, D - 60), n: N(0, 1, 0)}]);
    p.finish();
  }

  // ================================================================ SIDE WALLS
  {
    const prof = [[0, YB], [D, YB], [D, LVTOP], [zLV, LVTOP], [zLV, H - 120], [zLV - 120, H], [100, H], [0, H - 100]];
    // opening in the busbar compartment: busbars run through to the neighbour (covered by the transverse partition)
    const busOpening = new THREE.Path([new THREE.Vector2(20, yBC + 25), new THREE.Vector2(zP - 20, yBC + 25), new THREE.Vector2(zP - 20, yPRC - 25), new THREE.Vector2(20, yPRC - 25)]);
    for (const s of [-1, 1]) {
      const p = part('sideL', V(s * 560, 0, 0), {shell: true});
      const x = s * hw;
      p.add(EX(prof, x - (s > 0 ? 0 : 2), x + (s > 0 ? 2 : 0), [busOpening]), 'galv', 'Side wall');
      p.add(B(Math.min(x, x - s * 25), Math.max(x, x - s * 25), YB, H - 100, 0, 2), 'galv', 'Side wall rear flange');
      p.add(B(Math.min(x, x - s * 20), Math.max(x, x - s * 20), yBC - 20, yBC + 20, 2, zP - 20), 'galvDark', 'Stiffener');
      p.add(B(Math.min(x, x - s * 20), Math.max(x, x - s * 20), yPRC - 20, yPRC + 20, 2, zLV), 'galvDark', 'Stiffener');
      p.add(B(Math.min(x, x - s * 20), Math.max(x, x - s * 20), YB, yPRC - 20, zP - 20, zP + 20), 'galvDark', 'Stiffener');
      if (s < 0) anchor('sdc', p, spread(220, 1300, 7).map((y) => ({p: N(x, y, D - 120), n: N(1, 0, 0)})));
      p.finish();
    }
  }

  // ================================================================ FIXED COMPARTMENT WALLS
  {
    const p = part('shellB', V(0, 0, -280), {shell: true});
    const xi = hw - 20;
    p.add(B(-(hw - 25), hw - 25, yBC, H - 100, -2, 0), 'galv', 'Busbar compartment rear wall');
    p.add(EZ(rect(-xi, yBC, xi, 1360), zP - 2, zP, xs.map((x) => circleHole(x, yU, spoutRo + 3))), 'galv', 'Bushing plate (busbar side)');
    p.add(B(-xi, xi, yBC - 2, yBC, 2, zP - 2), 'galv', 'Floor of busbar compartment');
    for (const [z0, z1] of [[30, zP / 2 - 10], [zP / 2 + 10, zP - 30]]) {
      p.add(B(-(hw - 40), hw - 40, yPRC, yPRC + 2, z0, z1), 'galvDark', 'Pressure relief flap (busbar compartment)');
      p.add(C(5, 5, W - 100, 'x', 0, yPRC + 7, z0 + 6), 'steel', 'Flap hinge');
    }
    p.add(B(-(hw - 40), hw - 40, yPRC, yPRC + 2, zP + 30, zLV - 30), 'galvDark', 'Pressure relief flap (switching-device compartment)');
    p.finish();
  }

  // ================================================================ PRESSURE RELIEF DUCT
  {
    const p = part('prc', V(0, 760, -60), {shell: true});
    const y0 = yPRC, y1 = H;
    p.add(B(-hw, hw, y1 - 2, y1, 100, zLV - 120), 'galv', 'PRC roof');
    p.add(EX([[0, y1 - 100], [100, y1], [100, y1 - 2], [2, y1 - 100]], -hw, hw), 'galv', 'PRC rear chamfer');
    p.add(EX([[zLV - 120, y1], [zLV, y1 - 120], [zLV, y1 - 122], [zLV - 120, y1 - 2]], -hw, hw), 'galv', 'PRC front chamfer');
    p.add(B(-hw, hw, LVTOP, y1 - 120, zLV - 2, zLV), 'galv', 'PRC front wall');
    for (const s of [-1, 1]) {
      const xa = Math.min(s * hw, s * (hw - 6)), xb = Math.max(s * hw, s * (hw - 6));
      p.add(B(xa, xb, y0 + 22, y0 + 40, 22, zLV - 22), 'galvDark', 'PRC side frame');
      p.add(B(xa, xb, y1 - 40, y1 - 22, 122, zLV - 142), 'galvDark', 'PRC side frame');
      p.add(B(xa, xb, y0 + 40, y1 - 100, 22, 40), 'galvDark', 'PRC side frame');
      p.add(B(xa, xb, y0 + 40, y1 - 140, zLV - 40, zLV - 22), 'galvDark', 'PRC side frame');
    }
    p.add(EX([[zP - 100, y0 + 60], [zP + 60, y0 + 220], [zP + 62, y0 + 218], [zP - 98, y0 + 58]], -(hw - 20), hw - 20), 'galvDark', 'Deflector plate');
    const lo = [];
    for (const z of spread(60, zLV - 60, 8)) lo.push({p: N(-hw, y0 + 31, z), n: N(1, 0, 0)});
    for (const y of spread(y0 + 90, y1 - 160, 3)) lo.push({p: N(-hw, y, 31), n: N(1, 0, 0)}, {p: N(-hw, y, zLV - 31), n: N(1, 0, 0)});
    anchor('prcLow', p, lo, {nut: 8});
    anchor('prcUp', p, spread(140, zLV - 160, 8).map((z) => ({p: N(-hw, y1 - 31, z), n: N(1, 0, 0)})), {nut: 8});
    p.finish();
  }

  // ================================================================ BUSBAR COVER (upper part of the A|B wall, removed from A)
  {
    const p = part('busCover', V(0, 120, 320));
    const y0 = 1360, y1 = yPRC;
    p.add(B(-(hw - 22), hw - 22, y0, y1, zP - 2, zP), 'galv', 'Busbar cover');
    p.add(B(-(hw - 22), hw - 22, y0, y0 + 3, zP, zP + 20), 'galv', 'Busbar cover fold');
    p.add(TU([[-60, 1560, zP], [-60, 1560, zP + 30], [60, 1560, zP + 30], [60, 1560, zP]], 5), 'black', 'Handle');
    const pts = [];
    for (const x of spread(-hw + 50, hw - 50, 5)) pts.push(N(x, y1 - 25, zP), N(x, y0 + 30, zP));
    pts.push(N(0, 1460, zP));
    anchor('busCover', p, pts.map((q) => ({p: q, n: N(0, 0, 1)})));
    p.finish();
  }

  // ================================================================ BUSBARS + FEEDER BARS + TRANSVERSE PARTITION
  const t = 10;
  const barH = BB.bars === 1 ? 80 : BB.bars === 2 ? 100 : 120; // 1x80x10 / 2x100x10 / 3x120x10 Cu (SUP p162-181)
  const stackZ = (k, b) => zPh[k] + (b - (BB.bars - 1) / 2) * (t + 10);
  const stackHalf = ((BB.bars - 1) / 2) * (t + 10) + t / 2;
  {
    const p = part('transPart', V(500, 0, 0));
    const x = hw - 6;
    const holes = zPh.map((z, k) => new THREE.Path([
      new THREE.Vector2(z - stackHalf - 12, yPh[k] - barH / 2 - 12), new THREE.Vector2(z + stackHalf + 12, yPh[k] - barH / 2 - 12),
      new THREE.Vector2(z + stackHalf + 12, yPh[k] + barH / 2 + 12), new THREE.Vector2(z - stackHalf - 12, yPh[k] + barH / 2 + 12)]));
    p.add(EX(rect(22, yBC + 25, zP - 22, yPRC - 25), x - 1.5, x + 1.5, holes), 'galv', 'Transverse partition plate');
    for (let k = 0; k < 3; k++) {
      // cast-resin wall bushing: rectangular frame around the bar stack
      const z0 = zPh[k] - stackHalf - 12, z1 = zPh[k] + stackHalf + 12, ya = yPh[k] - barH / 2 - 12, yb = yPh[k] + barH / 2 + 12;
      const x0 = x - 38, x1 = x - 1.5;
      p.add(B(x0, x1, ya - 10, ya, z0 - 10, z1 + 10), 'resin', 'Busbar wall bushing');
      p.add(B(x0, x1, yb, yb + 10, z0 - 10, z1 + 10), 'resin', 'Busbar wall bushing');
      p.add(B(x0, x1, ya, yb, z0 - 10, z0), 'resin', 'Busbar wall bushing');
      p.add(B(x0, x1, ya, yb, z1, z1 + 10), 'resin', 'Busbar wall bushing');
    }
    anchor('transPart', p, [
      {p: N(x - 1.5, yPRC - 45, 60), n: N(-1, 0, 0)}, {p: N(x - 1.5, yPRC - 45, zP - 60), n: N(-1, 0, 0)},
      {p: N(x - 1.5, yBC + 45, 60), n: N(-1, 0, 0)}, {p: N(x - 1.5, yBC + 45, zP - 60), n: N(-1, 0, 0)},
    ]);
    p.finish();
  }
  {
    const p = part('busbars', V(0, 540, 0));
    for (let k = 0; k < 3; k++) {
      for (let b = 0; b < BB.bars; b++) {
        const z = stackZ(k, b);
        p.add(RB(-hw - 30, hw + 30, yPh[k] - barH / 2, yPh[k] + barH / 2, z - t / 2, z + t / 2, 2, 1), 'copper', `Main busbar L${k + 1}`);
      }
      if (BB.spacer) for (let b = 0; b < BB.bars - 1; b++) p.add(B(xs[k] - 30, xs[k] + 30, yPh[k] - 45, yPh[k] + 45, stackZ(k, b) + 5, stackZ(k, b + 1) - 5), 'copper', 'Copper spacer');
      p.add(B(-hw + 70, -hw + 100, yPh[k] + barH / 2, yPh[k] + barH / 2 + 1, stackZ(k, 0) - 5, stackZ(k, BB.bars - 1) + 5), ['yellow', 'green', 'red'][k], 'Phase marking');
      const zf = stackZ(k, BB.bars - 1) + t / 2;
      const through = 2 * stackHalf + t;
      anchor('busbar', p, [
        {p: N(xs[k] - 22, yPh[k] - 20, zf), n: N(0, 0, 1)},
        {p: N(xs[k] + 22, yPh[k] - 20, zf), n: N(0, 0, 1)},
      ], {nut: through});
      if (ur === 17.5) {
        const sh = stackHalf + t + 20;
        p.add(RB(xs[k] - Math.min(75, pitch / 2 - 2), xs[k] + Math.min(75, pitch / 2 - 2), yPh[k] - barH / 2 - 28, yPh[k] + barH / 2 + 28, zPh[k] - sh, zPh[k] + sh, 14, 2), 'plastic', 'Insulating half-shells (17.5 kV)');
      }
    }
    p.finish();
  }
  {
    const p = part('feeders', V(0, 320, 0));
    for (let k = 0; k < 3; k++) {
      const zb = stackZ(k, 0) - t / 2 - t / 2; // feeder flag against the rear face of the busbar stack
      for (const g of BAR([[xs[k], yU, zP - 60], [xs[k], yU, zb], [xs[k], yPh[k] + 30, zb]], 60, 10)) p.add(g, 'copper', `Feeder bar L${k + 1}`);
      // support insulator under the horizontal leg
      const h = yU - 5 - (yBC + 2);
      p.add(L([[26, 0], [26, 8], [18, 8], [22, h * 0.3], [16, h * 0.4], [22, h * 0.6], [16, h * 0.7], [20, h - 8], [26, h - 8], [26, h]], 'y', xs[k], yBC, (zb + zP - 60) / 2), 'resin', 'Support insulator');
    }
    p.finish();
  }

  // ================================================================ BUSHINGS (hollow spouts; the tulip enters the spout)
  const bushing = (p, y, label) => {
    for (const x of xs) {
      p.add(L([[spoutRi, SP], [spoutRo - 8, SP], [spoutRo, SP - 10], [spoutRo, 0], [spoutRo - 4, 0]], 'z', x, y, zP + 0.01), 'resin', label);
      p.add(L([[spoutRi, 0], [spoutRi, SP]], 'z', x, y, zP), 'resin', label + ' (bore)');
      for (const h of [30, 60]) p.add(T(spoutRo + 4, 5, 'z', x, y, zP + h), 'resin', label + ' shed');
      p.add(RB(x - flangeH, x + flangeH, y - flangeH, y + flangeH, zP + 4, zP + 20, 8, 2), 'resin', label + ' flange');
      p.add(C(contactR, contactR, 75, 'z', x, y, zP + 57.5), 'silver', 'Fixed contact (silver-plated)');
      p.add(C(contactR - 6, contactR, 6, 'z', x, y, zP + 98), 'silver', 'Fixed contact (silver-plated)');
      p.add(L([[30, 0], [44, 10], [40, 45], [30, 90]], '-z', x, y, zP), 'resin', label + ' tail');
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.add(C(6, 6, 4, 'z', x + dx * (flangeH - 12), y + dy * (flangeH - 12), zP + 22), 'zinc', 'Flange bolt');
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
  const SH_OPEN = 180;
  {
    const p = part('shutters', V(0, 0, 420));
    for (const s of [-1, 1]) {
      const xa = Math.min(s * (hw - 75), s * (hw - 62)), xb = Math.max(s * (hw - 75), s * (hw - 62));
      p.add(B(xa, xb, yShelf + 40, yU + 320, zSh - 7, zSh + 10), 'galvDark', 'Shutter guide');
    }
    p.finish();
    for (const [y, s, name] of [[yU, 1, 'Upper shutter (busbar side)'], [yL, -1, 'Lower shutter (feeder side)']]) {
      const pp = new PartBuilder(new THREE.Group(), mats);
      pp.add(B(-(hw - 78), hw - 78, y - 100, y + 100, zSh, zSh + 3), 'galv', name);
      pp.add(B(-(hw - 78), hw - 78, s > 0 ? y - 100 : y + 85, s > 0 ? y - 85 : y + 100, zSh + 3, zSh + 8), 'galvDark', name + ' edge');
      pp.add(B(-30, 30, y - 25, y + 25, zSh + 3, zSh + 4), 'yellow', 'Warning label');
      const m = pp.finish();
      m.userData.shut = s;
      m.userData.part = 'shutters';
      m.userData.travel = SH_OPEN;
      parts.shutters[0].add(m);
    }
    const lk = part('shutterMech', V(0, 0, 420));
    for (const s of [-1, 1]) {
      const x = s * (hw - 55);
      lk.add(B(x - 5, x + 5, yShelf + 40, yShelf + 200, zSh + 15, zSh + 165), 'steel', 'Drive slide');
      lk.add(TU([[x, yShelf + 190, zSh + 150], [x, yL - 30, zSh + 60], [x, yL + 40, zSh + 20]], 6), 'steel', 'Shutter lever');
      lk.add(TU([[x, yShelf + 190, zSh + 120], [x, yU - 80, zSh + 70], [x, yU + 60, zSh + 20]], 6), 'steel', 'Shutter lever');
      lk.add(C(12, 12, 10, 'x', x, yL - 30, zSh + 60), 'steel', 'Pivot');
      lk.add(C(12, 12, 10, 'x', x, yU - 80, zSh + 70), 'steel', 'Pivot');
      const xc = s * (hw - 50);
      lk.add(B(Math.min(xc, xc + s * 3), Math.max(xc, xc + s * 3), yShelf + 30, yU + 320, zSh + 12, Math.min(zSh + 175, zLV - 5)), 'galv', 'Shutter mechanism cover');
    }
    lk.finish();
  }

  // ================================================================ SHELF, GUIDE RAILS, INTERLOCK UNITS, LV SOCKET
  {
    const p = part('shelf', V(0, -120, 120));
    p.add(EY(rect(-hw + 80, zP + 30, hw - 10, D - 45), yShelf - 3, yShelf), 'galv', 'Withdrawable-part shelf');
    for (const s of [-1, 1]) {
      const x = s * (hw - 110);
      p.add(B(x - 15, x + 15, yShelf, yTruck0, zP + 150, D - 60), 'steel', 'Guide rail (ISOFLEX TOPAS L 32)');
      p.add(B(x - 15, x + 15, yTruck0, yShelf + 30, D - 60, D - 45), 'steel', 'Guide rail end stop');
      const xf = s * (hw - 128);
      p.add(B(xf - 3, xf + 3, yShelf, yShelf + 20, zP + 150, D - 60), 'steel', 'Guide rail flank');
    }
    p.add(RB(-150, -20, yShelf - 80, yShelf - 3, D - 150, D - 50, 6), 'black', 'Operating and interlocking unit (racking)');
    p.add(RB(xE - 35, xE + 35, 430, 510, D - 150, D - 50, 6), 'black', 'Earthing switch operating unit');
    cyl(p, 10, [xE, 470, zP + 6], [xE, 470, D - 150], 'steel', 'Earthing switch drive rod');
    p.add(B(-hw + 20, -hw + 30, yShelf + 30, yShelf + 300, D - 60, zDoorIn), 'zinc', 'Position switch block');
    p.add(B(-30, 30, yShelf, yShelf + 8, zP + 200, D - 160), 'copper', 'Truck earthing contact rail');
    p.add(RB(-80, 80, yLV - 38, yLV, zLV + 5, zLV + 55, 4), 'black', 'LV socket (fixed part, 64-pole)');
    p.finish();
  }

  // ================================================================ VERTICAL PARTITION A|C + PROTECTION PLATE
  {
    const p = part('partition', V(0, 0, 560));
    const z = zP + 2;
    const holes = xs.map((x) => circleHole(x, yL, spoutRo + 3)).concat([circleHole(xE, 470, 16)]);
    p.add(EZ(rect(-(hw - 22), YB + 70, hw - 22, yBC), z - 1.5, z + 1.5, holes), 'galv', 'Vertical partition');
    p.add(B(-(hw - 22), hw - 22, YB + 70, YB + 73, z + 1.5, z + 20), 'galv', 'Partition bottom fold');
    p.add(B(-150, 150, 650, 710, z + 1.5, z + 2.5), 'yellow', 'Instruction label "screw in all bolts"');
    const pts = [];
    for (const x of spread(-hw + 45, hw - 45, 5)) pts.push(N(x, yBC - 15, z + 1.5));
    for (const y of spread(YB + 200, yBC - 120, 3)) pts.push(N(-hw + 35, y, z + 1.5), N(hw - 35, y, z + 1.5));
    for (const x of spread(-hw + 45, hw - 45, 4)) pts.push(N(x, YB + 100, z + 1.5));
    anchor('partition', p, pts.map((q) => ({p: q, n: N(0, 0, 1)})));
    p.finish();
  }
  {
    const p = part('protPlate', V(0, 0, 760));
    p.add(EZ(rect(-(hw - 50), YB + 15, hw - 50, YB + 300), zP + 30, zP + 32, [rectHole(-(hw - 90), YB + 120, hw - 90, YB + 200)]), 'galv', 'Protection plate');
    anchor('protPlate', p, [N(-(hw - 75), YB + 40, zP + 32), N(hw - 75, YB + 40, zP + 32), N(-(hw - 75), YB + 275, zP + 32), N(hw - 75, YB + 275, zP + 32)].map((q) => ({p: q, n: N(0, 0, 1)})));
    p.finish();
  }

  // ================================================================ WIRING DUCT + FRONT LINK
  {
    const p = part('wiringDuct', V(-300, 0, 120));
    const x0 = -hw + 8, x1 = -hw + 72;
    p.add(B(x0, x1, YB + 60, yLV - 40, D - 200, D - 198), 'galvDark', 'Wiring duct back');
    p.add(B(x0, x1, YB + 60, yLV - 40, D - 92, D - 90), 'galvDark', 'Wiring duct side');
    p.add(B(x1, x1 + 2, YB + 80, 840, D - 200, D - 90), 'galv', 'Lower wiring duct cover');
    p.add(B(x1, x1 + 2, 870, yLV - 60, D - 200, D - 90), 'galv', 'Upper wiring duct cover');
    for (let i = 0; i < 6; i++) p.add(C(3, 3, yLV - 40 - (YB + 80), 'y', x0 + 12 + i * 8, (yLV - 40 + YB + 80) / 2, D - 180 + i * 12, 6), i % 2 ? 'black' : 'grey', 'Control cables');
    anchor('wdc', p, [N(x1 + 2, 160, D - 145), N(x1 + 2, 780, D - 145), N(x1 + 2, 940, D - 145), N(x1 + 2, yLV - 120, D - 145)].map((q) => ({p: q, n: N(1, 0, 0)})));
    p.finish();
    const l = part('link', V(-140, 0, 320));
    l.add(B(-hw + 2, -hw + 10, 300, 1300, D - 70, D - 52), 'galvDark', 'Panel connection link');
    l.finish();
  }

  // ================================================================ CONNECTION COMPARTMENT
  {
    const p = part('cts', V(0, 0, -260));
    for (const x of xs) {
      p.add(RB(x - 70, x + 70, yL - 95, yL + 95, zP - 270, zP - 110, 10, 2), 'resin', 'Block-type current transformer');
      p.add(RB(x - 75, x + 75, yL - 100, yL - 95, zP - 280, zP - 100, 2, 1), 'resinLight', 'CT foot');
      p.add(RB(x - 40, x + 40, yL + 95, yL + 125, zP - 230, zP - 150, 4, 1), 'black', 'Secondary terminal box');
      p.add(B(x - 35, x + 35, yL + 10, yL + 50, zP - 271, zP - 270), 'white', 'CT rating plate');
      for (const dz of [-210, -170]) p.add(C(5, 5, 14, 'y', x - 20, yL + 132, zP + dz), 'zinc', 'Secondary terminal');
    }
    p.add(B(-(hw - 22), hw - 22, yL - 115, yL - 100, zP - 280, zP - 100), 'galvDark', 'CT mounting frame');
    p.finish();
  }
  {
    const p = part('connBars', V(0, 0, -400));
    for (const x of xs) {
      for (const g of BAR([[x, yL, zP - 50], [x, yL, zC], [x, yBarLow, zC]], 60, 10)) p.add(g, 'copper', 'Cable connection bar');
      p.add(B(x - 22, x + 22, yS - 25, yS + 25, zC - 22, zC - 5), 'silver', 'Earthing switch fixed contact');
    }
    anchor('lugM12', p, xs.map((x) => ({p: N(x, yLug, zC - 17), n: N(0, 0, -1)})), {nut: 22});
    p.finish();
  }
  {
    const p = part('cables', V(0, -140, -560));
    for (const x of xs) {
      p.add(RB(x - 21, x + 21, 606, 664, zC - 17, zC - 5, 3, 1), 'tinned', 'Cable lug (palm)');
      p.add(C(13, 13, 606 - ySE1, 'y', x, (606 + ySE1) / 2, cz), 'tinned', 'Cable lug (barrel)');
      const sh = [[26, 0], [30, 10], [32, 60], [26, 70], [50, 80], [26, 92], [50, 110], [26, 122], [50, 140], [26, 152], [32, 250], [30, 270], [26, 280]];
      p.add(L(sh.map(([r, h]) => [r, 280 - h]), 'y', x, ySE0, cz), 'rubber', 'Cable sealing end');
      p.add(C(23, 23, ySE0 + 200, 'y', x, (ySE0 - 200) / 2, cz, 18), 'cable', 'HV cable (single-core)');
      // copper screen earth lead to the earthing busbar, kept clear of the cables and clamps
      const xl = x + 60;
      cyl(p, 4, [xl, 250, cz], [xl, ySE0 + 6, cz], 'earth', 'Cable screen earth lead');
      cyl(p, 4, [xl, 250, 72], [xl, 250, cz], 'earth', 'Cable screen earth lead');
      cyl(p, 4, [xl, 200, 72], [xl, 250, 72], 'earth', 'Cable screen earth lead');
      cyl(p, 4, [x + 26, ySE0 + 6, cz], [xl, ySE0 + 6, cz], 'earth', 'Cable screen earth lead');
    }
    p.finish();
  }
  {
    const p = part('clamps', V(0, -60, -620));
    const y = yClamp;
    p.add(EX([[cz - 80, y - 25], [cz - 48, y - 25], [cz - 48, y - 22], [cz - 77, y - 22], [cz - 77, y + 25], [cz - 80, y + 25]], -(hw - 80), hw - 80), 'galvDark', 'Cable bracket');
    const lo = [], hi = [];
    for (const x of xs) {
      p.add(RB(x - 46, x + 46, y - 22, y + 22, cz - 48, cz - 23, 4, 1), 'black', 'Cable clamp lower part (id-Technik K)');
      p.add(RB(x - 46, x + 46, y - 22, y + 22, cz + 23, cz + 40, 4, 1), 'black', 'Cable clamp upper part');
      lo.push(N(x - 36, y, cz - 80), N(x + 36, y, cz - 80));
      hi.push(N(x - 36, y, cz + 40), N(x + 36, y, cz + 40));
    }
    anchor('clampBr', p, lo.map((q) => ({p: q, n: N(0, 0, -1)})));
    anchor('clampTop', p, hi.map((q) => ({p: q, n: N(0, 0, 1)})));
    p.finish();
  }
  {
    const p = part('floorPlate', V(0, -300, -320));
    const holes = xs.map((x) => circleHole(x, -cz, 52));
    holes.push(slotHole(-hw + 70, -110, 42, 7));
    p.add(EY(rect(-(hw - 20), 70, hw - 20, zP - 20), YB, YB + 3, holes), 'galv', 'Floor plate');
    for (const x of xs) p.add(L([[52, 0], [56, 0], [56, 6], [30, 12], [27, 26], [24, 26]], 'y', x, YB + 3, cz), 'rubber', 'Rubber sleeve');
    const pts = [];
    for (const x of spread(-hw + 45, hw - 45, 3)) pts.push(N(x, YB + 3, 85), N(x, YB + 3, zP - 35));
    anchor('floorPlate', p, pts.map((q) => ({p: q, n: N(0, 1, 0)})));
    p.finish();
  }
  {
    const p = part('earthBar', V(0, -120, -700));
    p.add(EZ(rect(-(hw - 5), 170, hw - 5, 210), 62, 68, spread(-hw + 40, hw - 40, Math.round(W / 60)).map((x) => circleHole(x, 190, 6.5))), 'copper', 'Earthing busbar');
    p.add(B(-hw + 2, -hw + 45, 172, 208, 68, 74), 'copper', 'Earthing busbar link to neighbour');
    for (const x of [-(hw - 60), hw - 60]) p.add(B(x - 15, x + 15, YB, 170, 60, 70), 'galvDark', 'Earth bar support');
    anchor('earthLink', p, [{p: N(-hw + 14, 190, 74), n: N(0, 0, 1)}, {p: N(-hw + 34, 190, 74), n: N(0, 0, 1)}], {nut: 12});
    anchor('earthConn', p, [{p: N(0, 190, 68), n: N(0, 0, 1)}], {nut: 6});
    p.finish();
  }
  {
    // make-proof feeder earthing switch behind the connection bars: knife blades close horizontally onto the fixed
    // contacts on the rear face of the bars and open by swinging 60° upwards into free space.
    const p = part('esw', V(0, -40, -460));
    p.add(C(15, 15, W - 70, 'x', 0, yS, zS), 'steel', 'Earthing switch shaft');
    for (const s of [-1, 1]) p.add(RB(s * (hw - 45) - 10, s * (hw - 45) + 10, yS - 50, yS + 40, zS - 25, zS + 25, 4), 'galvDark', 'Shaft bearing');
    p.add(RB(xE - 12, xE + 12, yS - 62, yS + 14, zS - 14, zS + 62, 4), 'black', 'Drive lever + toggle spring');
    cyl(p, 10, [xE, 470, zS + 50], [xE, yS - 62, zS + 50], 'steel', 'Earthing switch drive rod');
    cyl(p, 10, [xE, 470, zS + 50], [xE, 470, zP - 2], 'steel', 'Earthing switch drive rod');
    // earthing braid from the shaft to the earthing busbar
    const xb = -(hw - 60);
    cyl(p, 5, [xb, 210, zS], [xb, yS - 15, zS], 'copper', 'Earthing braid to earth bar');
    cyl(p, 5, [xb, 210, 72], [xb, 210, zS], 'copper', 'Earthing braid to earth bar');
    const len = zC - 22 - zS;
    for (const x of xs) {
      const bl = new THREE.Group();
      bl.position.set(x, yS, zS);
      bl.userData.blade = true;
      bl.userData.closedAngle = 0;
      bl.userData.openDelta = -1.05; // 60° up when open
      const pb = new PartBuilder(bl, mats);
      for (const o of [-14, 14]) pb.add(B(o - 3, o + 3, -12, 12, 0, len), 'copper', 'Earthing knife');
      pb.add(C(18, 18, 44, 'x', 0, 0, 0), 'steel', 'Blade hub');
      pb.finish();
      bl.rotation.x = 0;
      parts.esw[0].add(bl);
    }
    p.finish();
  }
  {
    const p = part('vt', V(0, 140, -700));
    for (const x of xs) {
      p.add(RB(x - 60, x + 60, 760, 960, 25, 175, 12, 2), 'resin', 'Voltage transformer (cast resin)');
      p.add(L([[26, 0], [32, 15], [24, 25], [32, 40], [24, 50], [20, 70]], 'y', x, 960, 100), 'resin', 'VT primary terminal');
      p.add(B(x - 45, x + 45, 800, 840, 175, 177), 'white', 'VT rating plate');
      cyl(p, 5, [x, 1030, 100], [x, 1060, 100], 'copper', 'VT primary lead');
      p.add(TU([[x, 1060, 100], [x, 1062, 106], [x, yL + 10, zP - 290]], 5, 12, 8), 'copper', 'VT primary lead');
    }
    p.add(EY(rect(-(hw - 20), 14, hw - 20, 175), 745, 760), 'galvDark', 'VT support');
    anchor('vtPrim', p, xs.map((x) => ({p: N(x, 1030, 100), n: N(0, 1, 0)})));
    p.finish();
  }
  {
    const p = part('heater', V(0, 0, -300));
    p.add(RB(-110, 110, YB + 60, YB + 140, zP - 70, zP - 30, 4), 'galvDark', 'Anti-condensation heater');
    for (const x of spread(-100, 100, 9)) p.add(B(x - 1, x + 1, YB + 62, YB + 138, zP - 80, zP - 70), 'galv', 'Heater fins');
    p.finish();
  }

  // ================================================================ REAR WALL + LEDGES
  {
    const p = part('rearWall', V(0, 0, -780), {shell: true});
    p.add(B(-(hw - 12), hw - 12, YB + 5, yBC - 5, -2, 0), 'galv', 'Rear wall');
    for (const y of [400, 650]) p.add(B(-(hw - 30), hw - 30, y - 20, y + 20, 0, 12), 'galv', 'Rear wall stiffener');
    p.add(TU([[-70, 520, -2], [-70, 520, -30], [70, 520, -30], [70, 520, -2]], 6), 'black', 'Handle');
    p.add(B(-60, 60, 860, 960, -3, -2), 'yellow', 'Warning sign');
    anchor('rearBase', p, spread(-hw + 80, hw - 80, 4).map((x) => ({p: N(x, YB + 40, -2), n: N(0, 0, -1)})));
    p.finish();
    const h = part('ledgeH', V(0, 0, -960));
    h.add(B(-hw, hw, yBC - 25, yBC + 25, -12, -3), 'ral', 'Horizontal ledge');
    anchor('rearH', h, spread(-hw + 60, hw - 60, 9).map((x) => ({p: N(x, yBC, -12), n: N(0, 0, -1)})));
    h.finish();
    const v = part('ledgeV', V(0, 0, -1040));
    for (const sx of [-hw, hw]) {
      v.add(B(sx - 25, sx + 25, YB + 20, yBC - 25, -12, -3), 'ral', 'Vertical ledge');
      v.add(B(sx - 4, sx + 4, YB + 30, yBC - 30, -3, -2), 'rubber', 'Sealing bracket');
    }
    anchor('rearV', v, [-hw, hw].flatMap((sx) => spread(YB + 50, yBC - 50, 14).map((y) => ({p: N(sx + (sx < 0 ? 14 : -14), y, -12), n: N(0, 0, -1)}))));
    v.finish();
  }

  // ================================================================ LOW-VOLTAGE COMPARTMENT
  {
    const p = part('lv', V(0, 460, 340), {shell: true});
    p.add(B(-(hw - 2), hw - 2, yLV, yLV + 2, zLV, D - 24), 'galv', 'LV compartment floor');
    p.add(B(-(hw - 2), hw - 2, LVTOP - 2, LVTOP, zLV, D - 24), 'galv', 'LV compartment roof');
    p.add(B(-hw, -hw + 2, yLV, LVTOP, zLV, D - 24), 'galv', 'LV side');
    p.add(B(hw - 2, hw, yLV, LVTOP, zLV, D - 24), 'galv', 'LV side');
    p.add(B(-(hw - 2), hw - 2, yLV + 2, LVTOP - 2, zLV, zLV + 2), 'galv', 'LV back wall');
    p.add(RB(-hw + 4, hw - 4, yLV + 6, LVTOP - 6, D - 24, D, 4, 1), 'ral', 'LV door');
    for (const y of [yLV + 80, LVTOP - 80]) p.add(C(6, 6, 60, 'y', -hw + 10, y, D + 5), 'steel', 'Door hinge');
    p.add(RB(hw - 60, hw - 30, 1660, 1760, D, D + 16, 4), 'black', 'Door lock (3 mm double-bit)');
    const rx = -60, ry = 1720;
    p.add(RB(rx - 75, rx + 75, ry - 130, ry + 140, D, D + 18, 4), 'grey', 'Protection device');
    p.add(B(rx - 55, rx + 55, ry + 40, ry + 120, D + 18, D + 19), 'screen', 'Protection device display');
    for (let i = 0; i < 8; i++) p.add(C(3, 3, 3, 'z', rx - 63, ry + 110 - i * 14, D + 19.5), i < 2 ? 'green' : 'red', 'LED');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) p.add(RB(rx - 28 + c * 22, rx - 12 + c * 22, ry - 100 + r * 22, ry - 84 + r * 22, D + 18, D + 21, 2, 1), 'white', 'Keypad');
    for (let i = 0; i < 3; i++) p.add(C(7, 7, 6, 'z', -60 + i * 40, yLV + 50, D + 4), ['yellow', 'green', 'red'][i], 'LRM test socket');
    p.add(B(-90, 90, yLV + 30, yLV + 70, D, D + 1), 'black', 'Test socket panel');
    p.add(B(rx + 100, rx + 210, 1880, 1930, D, D + 1), 'white', 'Panel designation label');
    p.add(B(-(hw - 20), hw - 20, yLV + 30, LVTOP - 30, zLV + 2, zLV + 4), 'galv', 'Mounting plate');
    for (const [y, n, mat, lab] of [[1880, 6, 'white', 'MCB (3RV)'], [1715, 4, 'grey', 'Auxiliary relay'], [1525, Math.round((W - 160) / 14), 'grey', 'Terminal block']]) {
      p.add(B(-(hw - 80), hw - 80, y - 18, y + 18, zLV + 4, zLV + 12), 'steel', 'DIN rail');
      const w = lab === 'Terminal block' ? 6 : 26;
      for (const x of spread(-hw + 100, hw - 100, n)) p.add(RB(x - w, x + w, y - 45, y + 45, zLV + 12, zLV + 80, 2, 1), mat, lab);
      p.add(B(-(hw - 80), hw - 80, y + 52, y + 80, zLV + 4, zLV + 55), 'grey', 'Slotted wiring duct');
    }
    p.add(B(-hw + 30, -hw + 70, yLV + 20, LVTOP - 40, zLV + 4, zLV + 60), 'grey', 'Slotted wiring duct');
    p.add(RB(hw - 75, hw - 25, yLV + 20, yLV + 140, zLV + 4, zLV + 70, 4), 'black', 'Bus-wire terminal block');
    anchor('lv', p, spread(yLV + 80, LVTOP - 80, 3).map((y) => ({p: N(-hw, y, zLV + 200), n: N(1, 0, 0)})), {nut: 8});
    p.finish();
  }

  // ================================================================ HIGH-VOLTAGE DOOR
  {
    const p = part('hvdoor', V(0, 0, 960), {shell: true});
    const z = D - 30;
    p.add(RB(-hw + 4, hw - 4, YB + 5, yLV - 6, z, D, 5, 1), 'ral', 'High-voltage door (pressure-resistant)');
    p.add(RB(-hw + 30, hw - 30, YB + 30, yLV - 30, zDoorIn, z, 4, 1), 'ralDark', 'Door inner reinforcement');
    for (const y of [YB + 150, 700, yLV - 150]) p.add(C(6, 6, 80, 'y', -hw + 10, y, D + 5), 'steel', 'Door hinge');
    p.add(B(-125, 125, 1000, 1200, D - 1, D + 1), 'glass', 'Inspection window (CB indicators, counter)');
    p.add(B(-135, 135, 990, 1000, D, D + 3), 'black', 'Window frame');
    p.add(B(-135, 135, 1200, 1210, D, D + 3), 'black', 'Window frame');
    p.add(B(-hw + 70, hw - 70, 480, 950, D, D + 2), 'white', 'Mimic diagram');
    p.add(B(-hw + 100, hw - 100, 912, 920, D + 2, D + 3), 'black', 'Mimic: busbar');
    p.add(B(-3, 3, 690, 912, D + 2, D + 3), 'black', 'Mimic: feeder');
    p.add(B(-28, 28, 790, 850, D + 2, D + 3), 'black', 'Mimic: circuit-breaker');
    p.add(C(26, 26, 5, 'z', 0, 870, D + 4.5), 'black', 'Position indicator withdrawable part');
    p.add(C(20, 20, 5, 'z', xE, 610, D + 4.5), 'black', 'Position indicator feeder earthing switch');
    p.add(C(14, 14, 6, 'z', 0, 614, D + 5), 'steel', 'Actuating opening: racking');
    p.add(RB(-30, 30, 574, 654, D + 2, D + 7, 3), 'zinc', 'Operating slide (racking)');
    p.add(C(7, 7, 6, 'z', -55, 614, D + 5), 'steel', 'Double-bit key opening (5 mm)');
    p.add(C(14, 14, 6, 'z', xE, 520, D + 5), 'steel', 'Actuating opening: earthing switch');
    p.add(C(9, 9, 6, 'z', -60, 1250, D + 5), 'green', 'Actuating opening: CLOSE');
    p.add(C(9, 9, 6, 'z', 60, 1250, D + 5), 'red', 'Actuating opening: OPEN');
    p.add(C(14, 14, 8, 'z', 0, 1300, D + 6), 'black', 'Rotary button / spring charging opening');
    p.add(RB(hw - 55, hw - 30, 620, 940, D, D + 40, 6), 'black', 'Door handle');
    p.add(C(14, 14, 20, 'z', hw - 42, 940, D + 10), 'steel', 'Handle pivot');
    p.add(B(-hw + 80, -hw + 260, 1230, 1280, D, D + 1), 'yellow', 'Instruction label');
    p.finish();
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
    mk('eswSlide', 'Operating slide (earthing switch)', (b) => b.add(RB(-30, 30, -40, 40, 0, 5, 3), 'zinc', 'Operating slide (earthing switch)'), V(xE, 520, D + 2));
    mk('eswInd', 'Position indicator feeder earthing switch (vertical I = earthed)', (b) => b.add(B(-4, 4, -18, 18, 0, 1), 'white', 'Indicator bar'), V(xE, 610, D + 7));
    mk('truckInd', 'Position indicator withdrawable part (vertical = service, horizontal = test)', (b) => b.add(B(-4, 4, -22, 22, 0, 1), 'white', 'Indicator bar'), V(0, 870, D + 7));
    const lev = mk('eswLever', 'Operating lever, feeder earthing switch (180°)', (b) => {
      b.add(C(9, 9, 160, 'z', 0, 0, 80), 'steel', 'Lever shaft');
      b.add(B(-14, 14, -3, 3, -6, 6).translate(0, 0, 4), 'steel', 'Coupling pins');
      b.add(C(16, 16, 240, 'x', 0, 0, 165), 'black', 'Lever handle (cross bar)');
      b.add(C(19, 19, 60, 'x', 112, 0, 165), 'red', 'Grip');
    }, V(xE, 520, D + 8));
    lev.visible = false;
  }

  // ================================================================ WITHDRAWABLE 3AE CIRCUIT-BREAKER (service position)
  // truck, mech and breaker move together by the racking travel; the LV plug stays in its socket.
  {
    const p = part('truck', V(0, 0, 0));
    p.group.userData.truck = true;
    const y0 = yTruck0;
    p.add(RB(-(hw - 125), hw - 125, y0 + 25, y0 + 75, zP + 150, zFront, 4), 'galvDark', 'Truck chassis');
    for (const s of [-1, 1]) {
      p.add(B(Math.min(s * (hw - 98), s * (hw - 88)), Math.max(s * (hw - 98), s * (hw - 88)), y0 + 36, y0 + 75, zP + 150, zFront), 'steel', 'Truck side member');
      for (const z of [zP + 200, zFront - 60]) {
        p.add(C(28, 28, 20, 'x', s * (hw - 108), y0 + 28, z, 20), 'black', 'Truck wheel');
      }
      p.add(RB(Math.min(s * (hw - 160), s * (hw - 100)), Math.max(s * (hw - 160), s * (hw - 100)), y0 + 30, y0 + 70, zFront, zFront + 15, 4), 'red', 'Unlocking lever (service truck)');
    }
    p.add(C(11, 11, zFront - zP - 260, 'z', 0, y0 + 50, (zFront + zP + 260) / 2), 'steel', 'Racking spindle');
    p.add(RB(-45, 45, y0 + 30, y0 + 72, zP + 300, zP + 360, 4), 'black', 'Spindle nut');
    p.add(B(-25, 25, yShelf + 8, y0 + 25, zP + 220, zP + 300), 'copper', 'Earthing contact (sliding)');
    p.finish();
  }
  {
    const p = part('mech', V(0, 0, 0));
    p.group.userData.truck = true;
    const y0 = yMech0, y1 = yMech1;
    p.add(RB(-(hw - 85), hw - 85, y0, y1, zMech0, zFront, 8, 2), 'housing', 'Operating mechanism housing');
    p.add(B(-(hw - 100), hw - 100, y0 + 20, y1 - 20, zFront, zFront + 3), 'housing', 'Front cover');
    p.add(RB(-30, 30, 1080, 1115, zFront + 3, zFront + 10, 4), 'green', 'CLOSE push button');
    p.add(RB(-30, 30, 1020, 1055, zFront + 3, zFront + 10, 4), 'red', 'OPEN push button');
    p.add(B(40, 120, 1130, 1180, zFront + 3, zFront + 4), 'white', 'CLOSED/OPEN indicator');
    p.add(B(40, 120, 1070, 1110, zFront + 3, zFront + 4), 'yellow', 'Spring state indicator (CHARGED)');
    p.add(B(-120, -50, 1140, 1170, zFront + 3, zFront + 4), 'black', 'Operations counter');
    p.add(C(14, 14, 8, 'z', 0, 1240, zFront + 7), 'steel', 'Hand-crank shaft (≈ 50 turns)');
    p.add(B(-80, 80, 860, 940, zFront + 3, zFront + 4), 'white', 'Rating plate');
    p.add(RB(-(hw - 120), -(hw - 190), 960, 1020, zFront + 3, zFront + 8, 3), 'black', 'Racking interlock / coding');
    // internals (visible in the section)
    const zi = (zMech0 + zFront) / 2, dz = (zFront - zMech0) / 2 - 12;
    const coil = (x, yb, len, r, label) => {
      const pts = [];
      for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 2 * 9; pts.push([x + Math.cos(a) * r, yb + (i / 120) * len, zi + Math.sin(a) * Math.min(r, dz - 5)]); }
      p.add(TU(pts, 4, 240, 6), 'spring', label);
    };
    coil(-(hw - 150), y0 + 60, 380, 32, 'Closing spring');
    coil(hw - 150, y0 + 60, 260, 22, 'Opening spring');
    p.add(C(Math.min(45, dz), Math.min(45, dz), 2 * dz, 'z', -40, y0 + 130, zi), 'blue', 'Spring charging motor');
    p.add(C(26, 26, W - 260, 'x', 0, 1000, zi), 'steel', 'Main shaft (camshaft)');
    p.add(C(Math.min(60, dz), Math.min(60, dz), 18, 'x', -60, 1000, zi), 'steel', 'Closing cam');
    p.add(RB(40, 120, 1120, 1190, zi - dz, zi + dz, 4), 'black', 'Shunt closing release');
    p.add(RB(140, 220, 1120, 1190, zi - dz, zi + dz, 4), 'black', 'Shunt opening release');
    p.add(RB(-(hw - 110), -(hw - 170), y0 + 450, y0 + 620, zi - dz, zi + dz, 4), 'grey', 'Auxiliary switch');
    p.add(RB(-50, 50, y1, y1 + 25, zLV + 65, zLV + 115, 4), 'black', 'LV plug carrier');
    p.finish();
  }
  // static LV plug under the LV compartment + cable to the carrier (rebuilt as the truck moves)
  const lvCable = {x: 0, y: yMech1 + 14, z0: zLV + 55, z1: zLV + 65};
  {
    const plug = part('lvPlug', V(0, 0, 0));
    plug.add(RB(-80, 80, yMech1 + 2, yLV - 38, zLV + 5, zLV + 55, 4), 'black', 'LV plug (64-pole, coded)');
    plug.finish();
    const cable = new THREE.Mesh(lvCableGeometry(lvCable, 0), mats.black);
    cable.userData.label = 'LV plug cable (64-pole)';
    cable.userData.lvCable = true;
    cable.userData.noEdges = true;
    parts.lvPlug[0].add(cable);
  }
  {
    const p = part('breaker', V(0, 0, 0));
    p.group.userData.truck = true;
    const ym = (yU + yL) / 2;
    for (let k = 0; k < 3; k++) {
      const x = xs[k];
      p.add(RB(x - 55, x + 55, yL - 110, yU + 120, zPole - 60, zPole + 60, 20, 3), 'epoxy', `Embedded pole L${k + 1}`);
      for (const y of spread(yL - 60, yU + 70, 6)) p.add(RB(x - 60, x + 60, y - 4, y + 4, zPole - 64, zPole + 64, 4, 1), 'epoxy', `Embedded pole L${k + 1}`);
      p.add(C(38, 38, 210, 'y', x, ym + 10, zPole), 'silver', 'Vacuum interrupter (inside the pole)');
      for (const [y, lab] of [[yU, 'Upper contact arm'], [yL, 'Lower contact arm']]) {
        const z0 = zTulip1 + 10, z1 = zPole - 64;
        p.add(C(armR, armR, z1 - z0, 'z', x, y, (z0 + z1) / 2, 20), 'silver', lab);
        // tulip contact: fingers whose inner faces rest on the fixed contact, garter springs, carrier
        const rr = contactR + fw;
        for (let f = 0; f < nf; f++) {
          const a = (f / nf) * Math.PI * 2;
          p.add(RB(x + Math.cos(a) * rr - fw, x + Math.cos(a) * rr + fw, y + Math.sin(a) * rr - fw, y + Math.sin(a) * rr + fw, zTulip0, zTulip1, 1.5, 1), 'silver', 'Tulip contact finger');
        }
        for (const zz of [zTulip0 + 20, zTulip1 - 20]) p.add(T(rr + fw + 2.5, 2.5, 'z', x, y, zz), 'spring', 'Tulip garter spring');
        p.add(C(rr + fw + 4, rr + fw + 4, 10, 'z', x, y, zTulip1 + 5), 'steel', 'Contact system carrier');
      }
      p.add(C(16, 16, yL - 110 - (yMech0 + 20), 'y', x, (yL - 110 + yMech0 + 20) / 2, zPole + 40), 'epoxy', 'Insulating coupling rod');
      p.add(B(x - 22, x + 22, yMech0 + 20, yMech0 + 60, zPole + 40, zMech0), 'steel', 'Lever + contact pressure spring');
    }
    anchor('cbArm', p, xs.flatMap((x) => [yU, yL].map((y) => ({p: N(x, y + armR, zPole - 80), n: N(0, 1, 0)}))));
    anchor('cbTulip', p, xs.flatMap((x) => [yU, yL].map((y) => ({p: N(x, y, zTulip1 + 10), n: N(0, 0, 1)}))));
    p.add(B(-(hw - 85), hw - 85, yMech0, yMech0 + 20, zPole - 65, zMech0), 'steel', 'Pole frame');
    for (const s of [-1, 1]) p.add(B(Math.min(s * (hw - 100), s * (hw - 85)), Math.max(s * (hw - 100), s * (hw - 85)), yMech0 + 20, yU + 140, zMech0 - 30, zMech0), 'steel', 'Pole frame');
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
      const x = s * (hw - 110);
      p.add(B(x - 15, x + 15, yT, yTruck0, z0, z0 + 900), 'steel', 'Service truck rails');
      for (const z of [z0 + 60, z0 + 840]) p.add(B(s * (hw - 70) - 15, s * (hw - 70) + 15, 60, yT - 6, z - 15, z + 15), 'steel', 'Service truck column');
      for (const z of [z0 + 60, z0 + 840]) p.add(C(30, 30, 30, 'x', s * (hw - 70), 30, z, 16), 'black', 'Castor');
      p.add(B(s * (hw - 70) - 10, s * (hw - 70) + 10, yT, 1100, z0 + 870, z0 + 890), 'steel', 'Push handle');
    }
    p.add(C(14, 14, W - 160, 'x', 0, 1100, z0 + 880), 'steel', 'Push handle');
    p.add(RB(-hw + 60, hw - 60, 180, 220, z0 + 100, z0 + 800, 4), 'steel', 'Height adjustment / scissor');
    p.finish();
  }

  // ================================================================ CRANING ANGLES + RODS (transport)
  {
    const p = part('crane', V(0, 0, 0));
    p.group.visible = false;
    p.group.userData.crane = true;
    const pts = [];
    for (const s of [-1, 1]) for (const z of [zLV - 160, 160]) {
      const x = s * (hw + 2);
      p.add(B(Math.min(x, x + s * 8), Math.max(x, x + s * 8), 1900, 2200, z - 60, z + 60), 'steel', 'Craning angle');
      p.add(B(Math.min(x + s * 8, x + s * 90), Math.max(x + s * 8, x + s * 90), 2150, 2200, z - 60, z + 60), 'steel', 'Craning angle');
      for (const y of spread(1950, 2120, 3)) pts.push({p: N(x + s * 8, y, z), n: N(s, 0, 0)});
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
  return {root, parts, anchors, dirs, shellIds, lvCable, dims: {W, D, zP, zLV, yLV, yU, yL, zC, yShelf, zFront, contactR, spoutRi, spoutRo, tulipIn: contactR, tulipOut: contactR + 2 * fw + 5, armR, zTulip0, zTulip1, SP}};
}

// ------------------------------------------------------------------------------------------------- bolts
// Hex bolt drawn along +Y with the bearing face at y = 0 (head + washer above, shank below), and a matching nut.
export const SIZES = {M8: {d: 8, s: 13, k: 5.3, m: 6.8}, M10: {d: 10, s: 16, k: 6.4, m: 8.4}, M12: {d: 12, s: 18, k: 7.5, m: 10.8}, M16: {d: 16, s: 24, k: 10, m: 14.8}};
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
  head.translate(0, d * 0.2 + k / 2, 0);
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
  nut.translate(0, d * 0.2 + m / 2, 0);
  const washer = new THREE.CylinderGeometry(s * 0.62, s * 0.5, d * 0.2, 18);
  washer.translate(0, d * 0.1, 0);
  const g = mergeGeometries([nut, washer].map((x) => x.toNonIndexed()));
  g.userData.shared = true;
  return (cache[key] = g);
}
