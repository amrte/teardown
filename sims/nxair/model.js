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
import {YB as BK_YB, buildBreaker} from './breaker.js';
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
    orange: m({color: 0xd9822b, roughness: 0.55}), // test-disconnect sliders
    slate: m({color: 0x34404c, roughness: 0.45, metalness: 0.1}), // SIPROTEC 5 front panel
    beige: m({color: 0xe4ddc8, roughness: 0.6}), // keys, label strips, terminal housings
    termGrey: m({color: 0xa7abad, roughness: 0.6}), // terminal blocks
    ledOff: m({color: 0x56606a, roughness: 0.4}),
  };
}

// The LV plug cable between the static plug under the LV compartment and the carrier on the breaker, which moves
// with the truck. Rebuilt whenever the truck moves.
export function lvCableGeometry(L0, dz) {
  const {x, y0, z0, y1, z1} = L0;
  const ze = z1 + dz; // the gland end moves with the truck
  // out of the front face of the plug, forward above the breaker, down in front of the gland and into it
  return TU([[x, y0, z0], [x, y0 - 1, z0 + 24], [x, y0 - 3, ze + 30], [x, y1 + 24, ze + 32], [x, y1, ze]], 8, 28, 10);
}

// ---------------------------------------------------------------------------------------------- the panel
export function buildPanel(mats, opts) {
  const {W, D, bus, ur} = opts;
  const hw = W / 2;
  // optional equipment (O 110-0134.9 §6.3, §7.4–7.6, §20, §21, §26, §27; catalog HA 25.71 p. 10, 14, 27–29)
  const EQ = {vds: 'lrm', busES: false, fan: false, keys: false, padlock: false, motor: false, arresters: false, endWalls: false, ...(opts.eq || {})};
  EQ.busES = EQ.busES && W <= 800; // busbar earthing switch: 600 / 800 mm panels (110-0250.9 sheet 19)
  EQ.fan = EQ.fan && W >= 800 && !EQ.busES; // forced ventilation: 800 / 1000 mm; the busbar box is not for ventilated panels
  const Hd = EQ.busES ? 2350 : 2300; // top of the pressure relief duct: 2350 with the high LV compartment / busbar earthing switch
  // ----- levels (mm). Dimension drawings: front part 738 mm at 1500 deep (40 kA sheet 110-0262.9: 762 + 738; the
  // ≤ 31.5 kA sheet 110-0250.9 shows 688 at 1350 and 1500, in which the 3AE5 with its catalog dimensions would not fit), C top at 1075,
  // LV compartment 630 high x 406 deep from 1370, pressure relief duct to 2300 behind the LV compartment.
  const zP = D - (D >= 1500 ? 738 : 688); // partition A | B,C
  const yBC = 1075; // B floor / C roof
  const yPRC = 1730; // top of B, bottom of the pressure relief duct
  const zLV = D - 406; // back wall of the low-voltage compartment
  const yLV = 1370; // floor of the low-voltage compartment
  const LVTOP = yLV + (EQ.busES ? 980 : 630); // standard 630, high 980 (operating point of the busbar earthing switch 2094)
  const TD = W === 1000 ? 310 : 275; // terminal distance upper-lower (3AE p. 32)
  const yU = 1170, yL = yU - TD; // contact axes
  const pitch = WIDTHS[W].pitch;
  const xs = [-pitch, 0, pitch]; // L1 L2 L3
  const BB = BUSBAR[bus];
  // ----- the withdrawable SION 3AE5 (breaker.js), built for this panel: pole centres = phase pitch, terminal distance
  // TD, contact arms Ø = fixed contacts of the bushings (Ø 40 at 600, Ø 60 at 800 mm; Ø 79 drawn for 1000 mm)
  const CB_SPEC = {600: {P: 150, TD, armD: 40, fingers: 13}, 800: {P: 210, TD, armD: 60, fingers: 26}, 1000: {P: 275, TD, armD: 79, fingers: 32}}[W];
  const cb = buildBreaker(mats, CB_SPEC);
  const cbd = cb.dims;
  const yBk = yU - cbd.yUp; // truck bottom = top of the guide rails, so the arms meet the bushing axes
  const yShelf = yBk - 4; // withdrawable-part shelf
  const yTruck0 = yBk;
  const yFront = yBk + BK_YB; // y of the breaker body origin (its operating panel is drawn from here)
  const contactR = cbd.armR; // fixed contact radius = contact arm radius (the fingers bridge both)
  const armR = cbd.armR;
  // switching-device compartment, front to back. Dimension drawing 110-0250.9 (CBP, test position): breaker front just
  // behind the door, contact systems just in front of the closed shutters; in service the 3AE5 (645 mm from contact
  // system to cover) puts the contacts about 145 mm behind the partition, inside the bushings.
  const zDoorIn = D - 40; // inner face of the HV door reinforcement
  const zBk = zDoorIn - 15 - TRAVEL - (cbd.ZC + 9); // breaker origin in service position (test: front 15 mm behind the door)
  const zFront = zBk + cbd.ZC; // breaker cover face in service position
  const zFC1 = zBk + cbd.fixedFace, zFC0 = zFC1 - 75; // fixed contact: 27 mm inside the contact fingers in service
  const zBot = zFC0 - 12; // closed end of the bushing
  const zTerm = zBot - 30; // rear terminal of the bushing: feeder bar (B) / cable connection bar (C)
  const spoutRi = cbd.cageOut + 6, spoutRo = spoutRi + 16; // bushing bore and outer radius
  const zTulip0 = zBk + cbd.ZT - 274, zTulip1 = zTulip0 + 80; // contact systems in service position
  const zSh = zP + 14; // shutter plane, just in front of the bushing mouths
  const zPh = [zTerm - 70, (zTerm - 70 + 120) / 2, 120]; // busbar stacks L1 front, L2 middle, L3 rear (I Fig. 61)
  const yPh = [1520, 1610, 1520];
  // connection compartment
  const zC = zTerm - 180; // cable connection bars (behind the block-type CTs)
  const yBarLow = 610; // lower end of the connection bars
  const yLug = 640; // cable lug bolt
  const cz = zC - 11; // cable axis (lug on the rear face of the bar)
  const ySE1 = 548, ySE0 = ySE1 - 280; // sealing end
  const yClamp = 200;
  const yS = 740, zS = zC - 115; // earthing switch shaft
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
    const prof = [[0, YB], [D, YB], [D, LVTOP], [zLV, LVTOP], [zLV, Hd - 120], [zLV - 120, Hd], [100, Hd], [0, Hd - 100]];
    // opening in the busbar compartment: busbars run through to the neighbour (covered by the transverse partition)
    const busOpening = new THREE.Path([new THREE.Vector2(20, yBC + 25), new THREE.Vector2(zP - 20, yBC + 25), new THREE.Vector2(zP - 20, yPRC - 25), new THREE.Vector2(20, yPRC - 25)]);
    for (const s of [-1, 1]) {
      const p = part('sideL', V(s * 560, 0, 0), {shell: true});
      const x = s * hw;
      p.add(EX(prof, x - (s > 0 ? 0 : 2), x + (s > 0 ? 2 : 0), [busOpening]), 'galv', 'Side wall');
      p.add(B(Math.min(x, x - s * 25), Math.max(x, x - s * 25), YB, Hd - 100, 0, 2), 'galv', 'Side wall rear flange');
      p.add(B(Math.min(x, x - s * 20), Math.max(x, x - s * 20), yBC - 20, yBC + 20, 2, zP - 20), 'galvDark', 'Stiffener');
      p.add(B(Math.min(x, x - s * 20), Math.max(x, x - s * 20), yPRC - 20, yPRC + 20, 2, zLV), 'galvDark', 'Stiffener');
      p.add(B(Math.min(x, x - s * 20), Math.max(x, x - s * 20), YB, yPRC - 20, zP - 20, zP + 20), 'galvDark', 'Stiffener');
      if (s < 0) anchor('sdc', p, spread(220, 1300, 7).map((y) => ({p: N(x, y, D - 120), n: N(1, 0, 0)})));
      p.finish();
    }
  }

  // ================================================================ END WALLS (option: ends of the row)
  // Lateral end walls, powder-coated with epoxy resin, 35 mm thick (110-2300.9); the crane rod goes through them.
  if (EQ.endWalls) {
    const prof = [[0, YB], [D, YB], [D, LVTOP], [zLV, LVTOP], [zLV, Hd - 120], [zLV - 120, Hd], [100, Hd], [0, Hd - 100]];
    for (const s of [-1, 1]) {
      const p = part('endWall', V(s * 400, 0, 0), {shell: true});
      p.group.userData.side = s;
      const x = s * hw;
      p.add(EX(prof, Math.min(x, x + s * 35), Math.max(x, x + s * 35)), 'ral', s < 0 ? 'End wall (left)' : 'End wall (right)');
      p.add(C(20, 20, 4, 'x', x + s * 36, 2230, D / 2), 'black', 'Sealing stopper (crane-rod hole)');
      p.finish();
    }
  }

  // ================================================================ FIXED COMPARTMENT WALLS
  {
    const p = part('shellB', V(0, 0, -280), {shell: true});
    const xi = hw - 20;
    p.add(B(-(hw - 25), hw - 25, yBC, Hd - 100, -2, 0), 'galv', 'Busbar compartment rear wall');
    p.add(EZ(rect(-xi, yBC, xi, 1360), zP - 2, zP, xs.map((x) => circleHole(x, yU, spoutRo + 3))), 'galv', 'Bushing plate (busbar side)');
    p.add(B(-xi, xi, yBC - 2, yBC, 56, zP - 2), 'galv', 'Floor of busbar compartment');
    // rear pressure relief duct of the connection compartment (catalog HA 25.71: "pressure relief upwards through rear
    // pressure relief duct"): a flat duct between the rear wall and the busbars, flaps at its foot and top. Depth drawn.
    p.add(B(-(hw - 25), hw - 25, yBC, yPRC, 52, 54), 'galv', 'Rear pressure relief duct (connection compartment), front wall');
    p.add(B(-(hw - 40), hw - 40, yBC - 2, yBC, 6, 48), 'galvDark', 'Pressure relief flap (connection compartment, into the rear duct)');
    p.add(B(-(hw - 40), hw - 40, yPRC, yPRC + 2, 6, 48), 'galvDark', 'Pressure relief flap (rear duct, into the pressure relief duct)');
    for (const [z0, z1] of [[62, zP / 2 - 10], [zP / 2 + 10, zP - 30]]) {
      p.add(B(-(hw - 40), hw - 40, yPRC, yPRC + 2, z0, z1), 'galvDark', 'Pressure relief flap (busbar compartment)');
      p.add(C(5, 5, W - 100, 'x', 0, yPRC + 7, z0 + 6), 'steel', 'Flap hinge');
    }
    p.add(B(-(hw - 40), hw - 40, yPRC, yPRC + 2, zP + 30, zLV - 30), 'galvDark', 'Pressure relief flap (switching-device compartment)');
    p.finish();
  }

  // ================================================================ PRESSURE RELIEF DUCT
  {
    const p = part('prc', V(0, 760, -60), {shell: true});
    const y0 = yPRC, y1 = Hd;
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

  // ================================================================ FORCED VENTILATION (option, 800 / 1000 mm)
  // Fan box on the front of the pressure relief duct roof, directly behind the LV compartment, panel height 2450
  // (O §6.3, Fig. 28; I §7.12; fan ebm-papst R2E270-AA01-05 per O §29.7 / R3G250-RO06-71 per I p. 102). Sizes drawn.
  if (EQ.fan) {
    const f = part('fan', V(0, 300, 0));
    const fx = Math.min(300, hw - 60), z0 = zLV - 450, z1 = zLV - 130, y0 = Hd, y1 = 2450;
    f.add(B(-fx, fx, y0, y0 + 2, z0, z1), 'galv', 'Fan box floor (opening into the pressure relief duct)');
    for (const sx of [-1, 1]) f.add(B(Math.min(sx * fx, sx * (fx - 2)), Math.max(sx * fx, sx * (fx - 2)), y0, y1 - 4, z0, z1), 'galv', 'Fan box side');
    f.add(B(-fx, fx, y0, y1 - 4, z0, z0 + 2), 'galv', 'Fan box rear');
    f.add(B(-fx, fx, y0, y1 - 4, z1 - 2, z1), 'galv', 'Fan box front cover (2 × M8x25)');
    f.add(B(-fx, fx, y1 - 4, y1, z0, z1), 'galvDark', 'Fan box roof plate with the fan (10 × M8x20)');
    for (const sx of [-1, 1]) f.add(B(sx * fx * 0.55 - 60, sx * fx * 0.55 + 60, y0 + 30, y1 - 30, z1, z1 + 1), 'black', 'Metal grid (vacuum-clean yearly)');
    const zc = (z0 + z1) / 2, r = Math.min(135, (z1 - z0) / 2 - 15);
    f.add(L([[r, 0], [r + 6, 0], [r + 6, 70], [r, 70]], 'y', 0, y0 + 20, zc, 32), 'grey', 'Fan housing ring');
    f.add(C(40, 40, 60, 'y', 0, y1 - 40, zc, 20), 'black', 'Fan motor (ebm-papst, 40 000 h)');
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; f.add(B(-6, 6, 0, 6, 40, r - 6).rotateY(a).translate(0, y0 + 50, zc), 'steel', 'Fan impeller blade'); }
    f.add(B(fx - 50, fx - 30, y0 + 30, y0 + 70, z1 - 40, z1 - 10), 'yellow', 'Wind vane (air-flow monitor)');
    for (const sx of [-1, 1]) f.add(TU([[sx * (fx - 60), y1, zc - 60], [sx * (fx - 60), y1 + 18, zc - 60], [sx * (fx - 60), y1 + 18, zc + 60], [sx * (fx - 60), y1, zc + 60]], 5), 'black', 'Roof plate handle');
    f.finish();
  }

  // ================================================================ BUSBAR COVER (upper part of the A|B wall, removed from A)
  {
    const p = part('busCover', V(0, 120, 320));
    const y0 = 1360, y1 = yPRC;
    p.add(B(-(hw - 22), hw - 22, y0, y1, zP - 2, zP), 'galv', 'Busbar cover');
    p.add(B(-(hw - 22), hw - 22, y0, y0 + 3, zP - 22, zP - 2), 'galv', 'Busbar cover fold'); // folded into B, clear of the shutters
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
      for (const g of BAR([[xs[k], yU, zTerm + 10], [xs[k], yU, zb], [xs[k], yPh[k] + 30, zb]], 60, 10)) p.add(g, 'copper', `Feeder bar L${k + 1}`);
      // support insulator under the horizontal leg
      const h = yU - 5 - (yBC + 2);
      p.add(L([[26, 0], [26, 8], [18, 8], [22, h * 0.3], [16, h * 0.4], [22, h * 0.6], [16, h * 0.7], [20, h - 8], [26, h - 8], [26, h]], 'y', xs[k], yBC, (zb + zTerm) / 2), 'resin', 'Support insulator');
    }
    p.finish();
  }

  // ================================================================ BUSBAR EARTHING SWITCH (option, 600 / 800 mm)
  // Make-proof earthing switch for the busbar (endurance M0, E1) in a top-mounted box over the busbar compartment,
  // inside the pressure relief duct, with its own relief flaps (catalog HA 25.71 p. 14; I Fig. 118). Operated from
  // the LV door (operating point 2094 mm) through a drive rod and gearbox. Inner arrangement is not published: drawn.
  if (EQ.busES) {
    const bx = hw - 40, by0 = yPRC + 6, by1 = yPRC + 250, bz0 = 70, bz1 = zP - 110;
    const zE = (zPh[0] + zPh[2]) / 2, yFC = 1800, ySh = 1900, zSh2 = zE + 120;
    const box = part('busESbox', V(0, 420, -200), {shell: true});
    box.add(B(-bx, bx, by0, by0 + 2, bz0, bz1), 'galv', 'Busbar earthing switch box: floor');
    box.add(B(-bx, bx, by0, by1, bz0, bz0 + 2), 'galv', 'Busbar earthing switch box: rear wall');
    box.add(B(-bx, bx, by0, by1, bz1 - 2, bz1), 'galv', 'Busbar earthing switch box: front wall');
    for (const sx of [-1, 1]) box.add(B(Math.min(sx * bx, sx * (bx - 2)), Math.max(sx * bx, sx * (bx - 2)), by0, by1, bz0, bz1), 'galv', 'Busbar earthing switch box: side wall');
    for (const [z0, z1] of [[bz0 + 10, (bz0 + bz1) / 2 - 6], [(bz0 + bz1) / 2 + 6, bz1 - 10]]) box.add(B(-(bx - 10), bx - 10, by1 - 2, by1, z0, z1), 'galvDark', 'Pressure relief flap (busbar earthing switch box)');
    box.finish();
    const q = part('busES', V(0, 420, -200));
    for (let k = 0; k < 3; k++) {
      const xr = xs[k] + (k === 2 ? -1 : 1) * pitch * 0.75; // clear of the joint (and its half-shells) of its own phase
      const yTop = yPh[k] + barH / 2;
      for (const g of BAR([[xr, yTop, zPh[k]], [xr, yFC - 10, zPh[k]], [xr, yFC - 10, zE]], 40, 10)) q.add(g, 'copper', `Riser L${k + 1} from the busbar to the busbar earthing switch`);
      q.add(L([[24, 0], [28, 8], [22, 16], [28, 24], [22, 32], [20, 40]], 'y', xr, by0 + 2, zPh[k]), 'resin', 'Bushing in the floor of the busbar earthing switch box');
      q.add(B(xr - 22, xr + 22, yFC - 5, yFC + 25, zE - 18, zE + 18), 'silver', `Fixed contact L${k + 1} (busbar earthing switch)`);
    }
    q.add(C(14, 14, 2 * (bx - 30), 'x', 0, ySh, zSh2), 'steel', 'Busbar earthing switch shaft');
    for (const sx of [-1, 1]) q.add(RB(sx * (bx - 30) - 10, sx * (bx - 30) + 10, ySh - 40, ySh + 30, zSh2 - 25, zSh2 + 25, 4), 'galvDark', 'Shaft bearing');
    q.add(RB(-hw + 70, -hw + 130, by1 + 4, by1 + 130, zSh2 - 40, zSh2 + 40, 4), 'black', 'Gearbox of the busbar earthing switch drive');
    cyl(q, 9, [-hw + 100, ySh + 16, zSh2], [-hw + 100, by1 + 4, zSh2], 'steel', 'Drive shaft into the box');
    cyl(q, 9, [-hw + 100, 2094, zSh2 + 40], [-hw + 100, 2094, D - 26], 'steel', 'Drive rod from the LV door to the gearbox (through the LV compartment)');
    q.add(TU([[-hw + 100, 2094, zSh2 + 40], [-hw + 100, 2094, zSh2 + 20], [-hw + 100, by1 + 100, zSh2 + 20]], 9, 10, 8), 'steel', 'Drive rod from the LV door to the gearbox (through the LV compartment)');
    q.finish();
    // blades: closed on the fixed contacts, open swung up
    const L0 = Math.hypot(ySh - (yFC + 25), zSh2 - zE);
    for (let k = 0; k < 3; k++) {
      const xr = xs[k] + (k === 2 ? -1 : 1) * pitch * 0.75;
      const bl = new THREE.Group();
      bl.position.set(xr, ySh, zSh2);
      bl.userData.busBlade = true;
      bl.userData.closed = -Math.asin((ySh - (yFC + 25)) / L0);
      bl.userData.open = 0.75;
      const pb = new PartBuilder(bl, mats);
      for (const o of [-12, 12]) pb.add(B(o - 3, o + 3, -10, 10, -L0, 0), 'copper', 'Earthing blade (busbar earthing switch)');
      pb.add(C(18, 18, 40, 'x', 0, 0, 0), 'steel', 'Blade hub');
      pb.finish();
      bl.rotation.x = bl.userData.open;
      parts.busES[0].add(bl);
    }
  }

  // ================================================================ BUSHINGS (recessed: the contact system enters the bore)
  // cast-resin tube through the partition with the mouth 6 mm in front of it; the silver-plated fixed contact sits at
  // the closed end, the rear terminal carries the feeder bar (B) or the cable connection bar (C)
  const bushing = (p, y, label) => {
    const len = zP + 6 - zBot;
    for (const x of xs) {
      p.add(L([[0.5, 0], [spoutRo - 6, 0], [spoutRo, 6], [spoutRo, len - 4], [spoutRo - 4, len], [spoutRi, len], [spoutRi, 12], [0.5, 12]], 'z', x, y, zBot), 'resin', label);
      for (const z of spread(zBot + 30, zP - 40, 3)) p.add(T(spoutRo + 4, 5, 'z', x, y, z), 'resin', label + ' shed');
      p.add(RB(x - flangeH, x + flangeH, y - flangeH, y + flangeH, zP - 20, zP - 3, 8, 2), 'resin', label + ' flange');
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) p.add(C(6, 6, 4, 'z', x + dx * (flangeH - 12), y + dy * (flangeH - 12), zP - 22), 'zinc', 'Flange bolt');
      p.add(C(contactR, contactR, 71, 'z', x, y, zFC0 + 35.5), 'silver', 'Fixed contact (silver-plated)');
      p.add(C(contactR - 4, contactR, 4, 'z', x, y, zFC1 - 2), 'silver', 'Fixed contact (silver-plated)');
      p.add(RB(x - 30, x + 30, y - 30, y + 30, zTerm, zBot, 3, 1), 'copper', label + ' rear terminal');
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
      for (const dy of [-55, 55]) pp.add(B(-(hw - 84), hw - 84, y + dy - 6, y + dy + 6, zSh + 3, zSh + 6), 'galvDark', name + ': stiffening bead');
      for (const sx of [-1, 1]) pp.add(C(5, 5, 10, 'x', sx * (hw - 73), y + s * -70, zSh + 2), 'steel', name + ': guide pin in the shutter guide');
      pp.add(B(-30, 30, y - 25, y + 25, zSh + 3, zSh + 4), 'yellow', 'Warning label (lightning arrow)');
      pp.add(B(-hw + 100, -hw + 160, y - 12, y + 12, zSh + 3, zSh + 3.6), 'white', s > 0 ? 'Shutter marking: busbar side' : 'Shutter marking: feeder side');
      const m = pp.finish();
      m.userData.shut = s;
      m.userData.part = 'shutters';
      m.userData.travel = SH_OPEN;
      parts.shutters[0].add(m);
    }
    const lk = part('shutterMech', V(0, 0, 420));
    const xSM = Math.max(hw - 55, cbd.truck.a / 2 + 12);
    for (const s of [-1, 1]) {
      const x = s * xSM;
      // drive slide beside the truck (pushed by it in the last part of the travel), lever between shutter and breaker.
      // O §22: the left mechanism opens the upper shutter (busbar side, slip-on lever marked L), the right one the lower
      // shutter (feeder side); each can be padlocked.
      const up = s < 0, ys = up ? yU : yL, side = up ? 'left, upper shutter' : 'right, lower shutter';
      lk.add(B(x - 5, x + 5, yShelf + 20, yShelf + 150, zP + 24, zP + 88), 'steel', `Drive slide (${side})`);
      lk.add(B(x - 6, x + 6, yShelf + 150, yShelf + 166, zP + 70, zP + 86), 'steel', `Coupling for the slip-on shutter lever${up ? ' L' : ' R'}`);
      lk.add(TU(up ? [[x, yShelf + 140, zP + 70], [x, yU - 80, zP + 50], [x, yU + 60, zP + 24]] : [[x, yShelf + 140, zP + 80], [x, yL - 30, zP + 55], [x, yL + 40, zP + 24]], 6), 'steel', `Shutter lever (${side})`);
      lk.add(C(12, 12, 10, 'x', x, up ? yU - 80 : yL - 30, up ? zP + 50 : zP + 55), 'steel', 'Pivot');
      lk.add(B(x - 2, x + 2, yShelf + 100, yShelf + 130, zP + 88, zP + 92), 'steel', 'Padlock hasp');
      const xc = x + s * 8;
      lk.add(B(Math.min(xc, xc + s * 3), Math.max(xc, xc + s * 3), yShelf + 10, yU + 320, zP + 18, zP + 92), 'galv', 'Shutter mechanism cover');
      lk.add(B(Math.min(xc + s * 3, xc + s * 3.5), Math.max(xc + s * 3, xc + s * 3.5), yShelf + 200, yShelf + 240, zP + 40, zP + 80), 'yellow', 'Warning label: danger of crushing');
    }
    lk.finish();
    for (const s of [-1, 1]) {
      const x = s * xSM, side = s < 0 ? 'L' : 'R';
      const lev = new THREE.Group();
      lev.position.set(x, yShelf + 158, zP + 78);
      const pb = new PartBuilder(lev, mats);
      pb.add(C(7, 7, D + 220 - (zP + 78), 'z', 0, 0, (D + 220 - (zP + 78)) / 2, 10), 'steel', `Slip-on shutter lever ${side} (O Fig. 40)`);
      pb.add(C(14, 14, 120, 'x', -s * 60, 0, D + 220 - (zP + 78), 12), 'red', `Slip-on shutter lever ${side}: handle`);
      pb.finish();
      lev.userData.slipLever = side;
      lev.userData.label = `Slip-on shutter lever ${side}`;
      lev.visible = false;
      parts.shutterMech[0].add(lev);
      const pad = new THREE.Group();
      pad.position.set(x, yShelf + 104, zP + 96);
      const pp = new PartBuilder(pad, mats);
      pp.add(T(9, 2.2, 'z', 0, 8, 0), 'steel', 'Padlock shackle (shutter mechanism)');
      pp.add(RB(-11, 11, -22, 2, -6, 6, 3), 'yellow', `Padlock on the ${s < 0 ? 'left' : 'right'} shutter mechanism`);
      pp.finish();
      pad.userData.shutPad = side;
      pad.userData.label = `Padlock on the ${s < 0 ? 'left' : 'right'} shutter mechanism`;
      pad.visible = false;
      parts.shutterMech[0].add(pad);
    }
  }

  // ================================================================ SHELF, GUIDE RAILS, INTERLOCK UNITS, LV SOCKET
  {
    const p = part('shelf', V(0, -120, 120));
    p.add(EY(rect(-hw + 80, zP + 30, hw - 10, D - 45), yShelf - 3, yShelf), 'galv', 'Withdrawable-part shelf');
    for (const s of [-1, 1]) {
      const x = s * cbd.truck.d / 2; // under the truck wheels (wheel track d)
      p.add(B(x - 15, x + 15, yShelf, yTruck0, zP + 30, D - 60), 'steel', 'Guide rail (ISOFLEX TOPAS L 32)');
      p.add(B(x - 15, x + 15, yTruck0, yShelf + 30, D - 60, D - 45), 'steel', 'Guide rail end stop');
      const xf = x - s * 18;
      p.add(B(xf - 3, xf + 3, yShelf, yShelf + 20, zP + 30, D - 60), 'steel', 'Guide rail flank');
    }
    p.add(RB(-150, -20, yShelf - 80, yShelf - 3, D - 150, D - 50, 6), 'black', 'Operating and interlocking unit (racking)');
    p.add(RB(xE - 35, xE + 35, 430, 510, D - 150, D - 50, 6), 'black', 'Earthing switch operating unit');
    cyl(p, 10, [xE, 470, zP + 6], [xE, 470, D - 150], 'steel', 'Earthing switch drive rod');
    p.add(B(-hw + 20, -hw + 30, yShelf + 30, yShelf + 300, D - 60, zDoorIn), 'zinc', 'Position switch block');
    p.add(B(-30, 30, yShelf, yShelf + 8, zP + 200, D - 160), 'copper', 'Truck earthing contact rail');
    p.add(RB(-80, 80, yLV - 38, yLV, zLV + 5, zLV + 55, 4), 'black', 'LV socket (fixed part, 64-pole)');
    p.add(B(-hw + 2, -hw + 14, yShelf + 30, yShelf + 70, zP + 110, zP + 150), 'tinned', 'Fixed earthing point for the earthing device (lower left)');
    p.add(C(6, 6, 16, 'x', -hw + 18, yShelf + 50, zP + 130), 'zinc', 'Fixed earthing point: stud for the earthing clamp');
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
    // on the left side wall, as deep as the room beside the truck and the drive housing allows
    const dd = Math.min(64, Math.max(12, hw - 2 - Math.max(cbd.truck.a / 2, cbd.half) - 4));
    const x0 = -hw + 2, x1 = x0 + dd;
    p.add(B(x0, x1, YB + 60, yLV - 40, D - 200, D - 198), 'galvDark', 'Wiring duct back');
    p.add(B(x0, x1, YB + 60, yLV - 40, D - 92, D - 90), 'galvDark', 'Wiring duct side');
    p.add(B(x1, x1 + 2, YB + 80, 840, D - 200, D - 90), 'galv', 'Lower wiring duct cover');
    p.add(B(x1, x1 + 2, 870, yLV - 60, D - 200, D - 90), 'galv', 'Upper wiring duct cover');
    for (let i = 0; i < 6; i++) p.add(C(3, 3, yLV - 40 - (YB + 80), 'y', x0 + 8 + ((dd - 12) * (i % 3)) / 2, (yLV - 40 + YB + 80) / 2, D - 192 + i * 11, 6), i % 2 ? 'black' : 'grey', 'Control cables');
    // cover screws: on the side of the cover where there is room, on its front edge in the narrow 600 mm duct
    if (dd >= 30) anchor('wdc', p, [N(x1 + 2, 160, D - 145), N(x1 + 2, 780, D - 145), N(x1 + 2, 940, D - 145), N(x1 + 2, yLV - 120, D - 145)].map((q) => ({p: q, n: N(1, 0, 0)})));
    else anchor('wdc', p, [N(x1 + 1, 160, D - 90), N(x1 + 1, 780, D - 90), N(x1 + 1, 940, D - 90), N(x1 + 1, yLV - 120, D - 90)].map((q) => ({p: q, n: N(0, 0, 1)})));
    p.finish();
    const l = part('link', V(-140, 0, 320));
    l.add(B(-hw + 2, -hw + 10, 300, 1300, D - 70, D - 52), 'galvDark', 'Panel connection link');
    l.finish();
  }

  // ================================================================ CONNECTION COMPARTMENT
  {
    const p = part('cts', V(0, 0, -260));
    const zCT0 = zTerm - 155, zCT1 = zTerm - 15; // on the cable side of the lower bushings, under the connection bar
    // support-type block CTs, narrow design (DIN 42600 Part 8; catalog HA 25.71 p. 22): cast-resin body tapering to the
    // top, primary terminals P1 / P2 on top that carry the cable connection bar, secondary terminal box at the foot,
    // base plate with four slots. DIN main dimensions are not public: sizes are drawn from the catalog photo.
    const zm = (zCT0 + zCT1) / 2, yTop = yL - 11, yBase = yTop - 190;
    for (const x of xs) {
      const hwCT = Math.min(68, pitch / 2 - 6);
      p.add(RB(x - hwCT - 4, x + hwCT + 4, yBase, yBase + 8, zCT0 - 12, zCT1 + 12, 2, 1), 'galvDark', 'CT base plate');
      for (const dx of [-(hwCT - 12), hwCT - 12]) for (const dz of [-1, 1]) p.add(B(x + dx - 4, x + dx + 4, yBase + 7.5, yBase + 8.2, zm + dz * ((zCT1 - zCT0) / 2) - 6, zm + dz * ((zCT1 - zCT0) / 2) + 6), 'black', 'CT fixing slot');
      p.add(RB(x - hwCT, x + hwCT, yBase + 8, yBase + 120, zCT0, zCT1, 8, 2), 'resin', 'Block-type current transformer (cast resin, support type)');
      p.add(RB(x - hwCT + 8, x + hwCT - 8, yBase + 116, yTop, zCT0 + 8, zCT1 - 8, 10, 2), 'resin', 'Block-type current transformer (cast resin, support type)');
      for (const [z, lab] of [[zCT1 - 30, 'P1'], [zCT0 + 30, 'P2']]) {
        p.add(RB(x - 26, x + 26, yTop - 14, yTop, z - 20, z + 20, 3, 1), 'resin', `CT primary terminal plinth ${lab}`);
        p.add(B(x - 25, x + 25, yTop - 0.1, yTop + 6, z - 19, z + 19), 'tinned', `Primary terminal ${lab} (the connection bar is bolted on, 2 × M12)`);
      }
      p.add(RB(x - 45, x + 45, yBase + 8, yBase + 48, zCT1, zCT1 + 16, 3, 1), 'black', 'Secondary terminal box (1S1, 1S2, 2S1, 2S2)');
      p.add(B(x - 41, x + 41, yBase + 12, yBase + 44, zCT1 + 16, zCT1 + 17), 'glass', 'Secondary terminal cover (transparent, sealable)');
      for (let k = 0; k < 4; k++) p.add(C(3.5, 3.5, 6, 'z', x - 30 + k * 20, yBase + 28, zCT1 + 13), 'zinc', `Secondary terminal ${['1S1', '1S2', '2S1', '2S2'][k]}`);
      p.add(B(x + hwCT, x + hwCT + 0.5, yBase + 30, yBase + 90, zm - 40, zm + 40), 'white', 'CT rating plate (copy inside the HV door)');
    }
    for (const [z0, z1] of [[zCT0 + 4, zCT0 + 24], [zCT1 - 24, zCT1 - 4]]) p.add(B(-(hw - 22), hw - 22, yBase - 15, yBase, z0, z1), 'galvDark', 'CT mounting rail');
    p.finish();
  }
  {
    const p = part('connBars', V(0, 0, -400));
    for (const x of xs) {
      // in two pieces: bushing → CT terminal P1, CT terminal P2 → cable (the CT primary carries the current between them)
      for (const g of BAR([[x, yL, zTerm + 10], [x, yL, zTerm - 15 - 50]], 60, 10)) p.add(g, 'copper', 'Cable connection bar (bushing to CT P1)');
      for (const g of BAR([[x, yL, zTerm - 155 + 50], [x, yL, zC], [x, yBarLow, zC]], 60, 10)) p.add(g, 'copper', 'Cable connection bar (CT P2 to the cables)');
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
  // earthing device (O §26): clamp on the fixed earthing point, three earthing tulips on the bushing contacts of one
  // side, copper earthing wires; only shown in the drill (truck out, one shutter open). 25 kA 1 s; Ø 40 / 60 contacts.
  for (const [side, y] of [['upper', yU], ['lower', yL]]) {
    const ed = part('earthDev', V(0, 0, 0));
    ed.group.visible = false;
    ed.group.userData.earthDev = side;
    ed.add(RB(-hw + 30, -hw + 70, yShelf + 30, yShelf + 70, zP + 115, zP + 145, 3), 'steel', 'Earthing clamp with screw handle (≈ 20 Nm)');
    for (const x of xs) {
      ed.add(L([[contactR + 1, 0], [contactR + 9, 0], [contactR + 9, 46], [contactR + 1, 46]], 'z', x, y, zFC1 - 26, 24), 'tinned', 'Earthing tulip (on the fixed contact)');
      ed.add(C(6, 6, zP + 30 - (zFC1 + 20), 'z', x, y, (zP + 30 + zFC1 + 20) / 2, 10), 'steel', 'Spindle of the earthing tulip');
      ed.add(TU([[x, y, zP + 30], [x, y - 30, zP + 105], [-hw + 90, yShelf + 100, zP + 125], [-hw + 60, yShelf + 60, zP + 130]], 5, 24, 8), 'copper', 'Copper earthing wire (inspect: brown or stiff = replace)');
    }
    ed.finish();
  }
  // surge arresters (option, catalog HA 25.71 p. 10 item 26 / p. 14): beside the sealing ends, top to the cable
  // connection, base to the earthing busbar. Type and size not given: drawn.
  if (EQ.arresters) {
    const ar = part('arresters', V(0, -100, -500));
    const za = zC - 105;
    for (const x of xs) {
      ar.add(C(20, 20, 230, 'y', x, 515, za, 16), 'grey', 'Surge arrester (metal-oxide, silicone housing)');
      for (const y of spread(420, 610, 6)) ar.add(T(30, 6, 'y', x, y, za), 'grey', 'Surge arrester shed');
      ar.add(C(14, 14, 16, 'y', x, 638, za, 12), 'zinc', 'Surge arrester HV terminal');
      for (const g of BAR([[x, 646, za], [x, 694, za], [x, 694, zC - 8]], 30, 6)) ar.add(g, 'copper', 'Connection strap to the cable connection bar');
      ar.add(C(16, 16, 12, 'y', x, 394, za, 12), 'zinc', 'Surge arrester earth terminal');
      cyl(ar, 4, [x, 300, za], [x, 386, za], 'earth', 'Earth lead to the earthing busbar');
      cyl(ar, 4, [x, 300, 80], [x, 300, za], 'earth', 'Earth lead to the earthing busbar');
      cyl(ar, 4, [x, 213, 80], [x, 300, 80], 'earth', 'Earth lead to the earthing busbar');
      ar.add(B(x - 30, x + 30, 380, 388, za - 30, za + 30), 'galvDark', 'Surge arrester base bracket');
    }
    ar.add(B(-pitch - 40, pitch + 40, 372, 380, za - 30, za + 30), 'galvDark', 'Surge arrester mounting rail');
    ar.finish();
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
      // single-pole cast-resin VT, fixed-mounted (catalog HA 25.71 p. 23 photo): base plate with feet, body tapering to the
      // HV terminal head, secondary terminal box with transparent cover at the front foot. Sizes drawn.
      const hv = Math.min(58, pitch / 2 - 8);
      p.add(RB(x - hv - 8, x + hv + 8, 760, 766, 22, 178, 2, 1), 'galvDark', 'VT base plate');
      for (const dx of [-(hv - 4), hv - 4]) for (const z of [32, 168]) p.add(B(x + dx - 4, x + dx + 4, 765.5, 766.2, z - 5, z + 5), 'black', 'VT fixing slot');
      p.add(RB(x - hv, x + hv, 766, 880, 30, 170, 10, 2), 'resin', 'Voltage transformer (cast resin, single-pole)');
      p.add(RB(x - hv + 10, x + hv - 10, 876, 950, 40, 160, 12, 2), 'resin', 'Voltage transformer (cast resin, single-pole)');
      p.add(RB(x - 30, x + 30, 946, 962, 70, 130, 8, 2), 'resin', 'Voltage transformer (cast resin, single-pole)');
      p.add(L([[26, 0], [32, 15], [24, 25], [32, 40], [24, 50], [20, 70]], 'y', x, 960, 100), 'resin', 'VT primary terminal (A)');
      p.add(C(9, 9, 8, 'y', x, 1034, 100, 6), 'zinc', 'VT primary terminal nut');
      p.add(RB(x - 46, x + 46, 768, 808, 170, 186, 3, 1), 'black', 'VT secondary terminal box (a, n, da, dn)');
      p.add(B(x - 42, x + 42, 772, 804, 186, 187), 'glass', 'VT secondary terminal cover (transparent)');
      for (let k = 0; k < 4; k++) p.add(C(3.5, 3.5, 6, 'z', x - 30 + k * 20, 788, 183), 'zinc', `VT secondary terminal ${['a', 'n', 'da', 'dn'][k]}`);
      p.add(C(4, 4, 10, 'x', x - hv - 4, 763, 160, 8), 'zinc', 'VT earthing terminal (base plate)');
      p.add(B(x - 40, x + 40, 820, 860, 170, 171), 'white', 'VT rating plate');
      cyl(p, 5, [x, 1030, 100], [x, 1060, 100], 'copper', 'VT primary lead');
      p.add(TU([[x, 1060, 100], [x, 1062, 106], [x, yL + 10, zC + 8]], 5, 12, 8), 'copper', 'VT primary lead');
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
    // SIPROTEC 5 7SJ82, 1/3 x 19" flush-mounted (detailed in lv.js): front 150 x 266 mm, 34 mm proud, housing 145 x 244 mm
    // 163 mm deep + 34 mm terminals
    const rx = 0, ry = yLV + 380;
    p.add(RB(rx - 75, rx + 75, ry - 133, ry + 133, D, D + 30, 5, 2), 'black', 'SIPROTEC 5 7SJ82 protection device');
    p.add(B(rx - 70, rx + 70, ry - 128, ry + 128, D + 30, D + 33), 'slate', 'SIPROTEC 5 7SJ82 protection device');
    p.add(B(rx - 25, rx + 47, ry - 25, ry + 85, D + 33, D + 34), 'screen', 'Protection device display');
    for (let i = 0; i < 16; i++) p.add(B(rx - 65, rx - 61, ry + 90 - i * 6.9, ry + 94 - i * 6.9, D + 33, D + 34), i < 2 ? 'green' : 'red', 'LED');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) p.add(B(rx - 9.5 + c * 14, rx + 1.5 + c * 14, ry - 67.5 - r * 14, ry - 56.5 - r * 14, D + 33, D + 35), 'beige', 'Keypad');
    for (const [y, m] of [[-67, 'yellow'], [-86, 'green'], [-105, 'red']]) p.add(B(rx + 36, rx + 52, ry + y - 8, ry + y + 8, D + 33, D + 35), m, 'Ctrl / CLOSE / OPEN keys');
    p.add(B(rx - 72.5, rx + 72.5, ry - 122, ry + 122, D - 163, D - 24), 'grey', 'Protection device housing');
    p.add(B(rx - 70, rx + 7, ry + 32, ry + 120, D - 197, D - 163), 'termGrey', 'Protection device terminals');
    p.add(B(rx - 64, rx + 51, ry - 122, ry + 68, D - 189, D - 163), 'termGrey', 'Protection device terminals');
    // voltage detecting system (O §20, IEC 61243-5). LRM: two test-socket strips at the bottom edge of the LV door,
    // directly above the HV door (O Fig. 48 / 484 / 485), one for the feeder and one for the busbar, each L1 L2 L3 with
    // captive covers; the plug-in indicator LRM-ST 8DX1620 is carried separately. CAPDIS / VOIS: one integrated unit in
    // the LV door instead. Sizes and heights are not given: drawn.
    if (EQ.vds === 'lrm') {
      for (const [x0, lab] of [[-hw + 40, 'feeder'], [hw - 190, 'busbar']]) {
        p.add(B(x0, x0 + 150, yLV + 22, yLV + 58, D, D + 2), 'black', `LRM test-socket strip (${lab})`);
        p.add(B(x0 + 4, x0 + 26, yLV + 28, yLV + 52, D + 2, D + 2.5), 'white', `Label: repeat test of the interface (${lab})`);
        for (let k = 0; k < 3; k++) {
          const cx = x0 + 48 + k * 36;
          p.add(C(6, 6, 6, 'z', cx - 6, yLV + 40, D + 5), 'yellow', `LRM test socket L${k + 1} (${lab}), captive cover`);
          p.add(C(3.5, 3.5, 5, 'z', cx + 9, yLV + 40, D + 4.5), 'zinc', `LRM earth socket L${k + 1} (${lab})`);
        }
      }
    } else {
      const capdis = EQ.vds === 'capdis', x0 = -hw + 40, y0 = yLV + 330;
      const name = capdis ? 'CAPDIS-S2+ voltage monitoring system (relay output)' : 'VOIS+ integrated voltage detecting system';
      p.add(RB(x0, x0 + 96, y0, y0 + 96, D, D + 26, 4, 1), capdis ? 'slate' : 'yellow', name);
      p.add(B(x0 + 8, x0 + 52, y0 + 40, y0 + 84, D + 26, D + 27), 'screen', capdis ? 'CAPDIS-S2+ LC display (A0 … A8)' : 'VOIS+ LC display (A0 … A3)');
      for (const [k, dx, dy] of [[1, 66, 70], [2, 82, 54], [3, 66, 38]]) p.add(C(4, 4, 5, 'z', x0 + dx, y0 + dy, D + 28), 'zinc', `${capdis ? 'CAPDIS' : 'VOIS'} test socket L${k} (phase comparison)`);
      p.add(C(4, 4, 5, 'z', x0 + 82, y0 + 22, D + 28), 'earth', `${capdis ? 'CAPDIS' : 'VOIS'} earth socket`);
      if (capdis) p.add(C(7, 7, 5, 'z', x0 + 20, y0 + 20, D + 28), 'grey', 'CAPDIS-S2+ "Test" button');
      p.add(B(x0 + 2, x0 + 94, y0 + 2, y0 + 94, D + 30, D + 31), 'glass', `${capdis ? 'CAPDIS-S2+' : 'VOIS+'} hinged transparent cover (IP54)`);
      p.add(B(x0, x0 + 96, y0 - 14, y0 - 2, D, D + 1), 'white', `${capdis ? 'CAPDIS-S2+' : 'VOIS+'} short instructions`);
    }
    if (EQ.busES) {
      // operating plate of the busbar earthing switch, front upper area of the LV door; operating point 2094 mm (SUP)
      const xo = -hw + 100, yo = 2094;
      p.add(B(xo - 50, xo + 100, yo - 56, yo + 56, D, D + 1.5), 'white', 'Operating plate: busbar earthing switch');
      p.add(B(xo - 50, xo + 100, yo + 62, yo + 92, D, D + 1), 'yellow', 'Instruction label: busbar earthing switch (O Fig. 498)');
      p.add(C(14, 14, 6, 'z', xo, yo, D + 4), 'steel', 'Actuating opening: busbar earthing switch (pins "10 past 8" = close, vertical = open)');
      if (EQ.keys) for (const x of [xo - 46, xo + 98]) p.add(C(9, 9, 10, 'z', x, yo, D + 6), 'zinc', x < xo ? 'Key lock (1): key free only with the busbar earthing switch OPEN' : 'Key lock (2): key free only with the busbar earthing switch CLOSED');
    }
    p.add(B(rx + 110, rx + 220, 1880, 1930, D, D + 1), 'white', 'Panel designation label');
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
    if (EQ.busES) {
      const xo = -hw + 100, yo = 2094;
      const mkLv = (flag, label, build, pos) => {
        const g = new THREE.Group();
        const pb = new PartBuilder(g, mats);
        build(pb);
        pb.finish();
        g.userData[flag] = true;
        g.userData.label = label;
        g.position.copy(pos);
        parts.lv[0].add(g);
        return g;
      };
      mkLv('busSlide', 'Operating slide (busbar earthing switch)', (b) => {
        b.add(RB(-30, 30, -30, 30, 0, 5, 3), 'zinc', 'Operating slide (busbar earthing switch)');
        if (EQ.padlock) b.add(T(9, 2.2, 'x', 0, -38, 12), 'steel', 'Padlock shackle (busbar earthing switch)');
        if (EQ.padlock) b.add(RB(-11, 11, -66, -42, 6, 18, 3), 'yellow', 'Padlock (busbar earthing switch)');
      }, V(xo, yo, D + 2));
      mkLv('busInd', 'Position indicator busbar earthing switch (vertical = earthed)', (b) => b.add(B(-4, 4, -18, 18, 0, 1), 'white', 'Indicator bar'), V(xo + 50, yo, D + 2));
      const lev = mkLv('busLever', 'Operating lever, busbar earthing switch (≈ 115°)', (b) => {
        b.add(C(9, 9, 160, 'z', 0, 0, 80), 'steel', 'Lever shaft');
        b.add(C(16, 16, 240, 'x', 0, 0, 165), 'black', 'Lever handle (cross bar)');
        b.add(C(19, 19, 60, 'x', 112, 0, 165), 'red', 'Grip');
      }, V(xo, yo, D + 8));
      lev.visible = false;
    }
    if (EQ.vds === 'lrm') {
      const g = new THREE.Group();
      const pb = new PartBuilder(g, mats);
      pb.add(RB(-20, 20, -10, 60, 0, 30, 5, 2), 'beige', 'LRM-ST plug-in voltage indicator (8DX1620)');
      pb.add(C(5, 5, 2, 'z', 0, 40, 31), 'ledOff', 'LRM-ST indication: flashing or lit = NOT isolated');
      pb.add(B(-14, 14, 4, 22, 30, 30.5), 'white', 'LRM-ST label: last repeat test');
      pb.finish();
      g.userData.lrmSt = true;
      g.userData.label = 'LRM-ST plug-in voltage indicator';
      g.userData.sockets = [0, 1, 2].map((k) => V(-hw + 40 + 48 + k * 36 - 6, yLV + 40, D + 8));
      g.visible = false;
      parts.lv[0].add(g);
    }
  }

  // ================================================================ HIGH-VOLTAGE DOOR
  {
    const p = part('hvdoor', V(0, 0, 960), {shell: true});
    const z = D - 30;
    p.add(RB(-hw + 4, hw - 4, YB + 5, yLV - 6, z, D, 5, 1), 'ral', 'High-voltage door (pressure-resistant)');
    p.add(RB(-hw + 30, hw - 30, YB + 30, yLV - 30, zDoorIn, z, 4, 1), 'ralDark', 'Door inner reinforcement');
    for (const y of [YB + 150, 700, yLV - 150]) p.add(C(6, 6, 80, 'y', -hw + 10, y, D + 5), 'steel', 'Door hinge');
    // inspection window over the indicators and the counter of the 3AE5, push-rod openings over its ON / OFF buttons,
    // hand-crank opening over its charging coupling (all at the breaker's own heights)
    const wy0 = yFront + 135, wy1 = yFront + 196;
    p.add(B(-110, 90, wy0, wy1, D - 1, D + 1), 'glass', 'Inspection window (position and spring indicators, operations counter)');
    p.add(B(-120, 100, wy0 - 8, wy0, D, D + 3), 'black', 'Window frame');
    p.add(B(-120, 100, wy1, wy1 + 4, D, D + 3), 'black', 'Window frame');
    const mt = wy0 - 18; // top of the mimic diagram
    p.add(B(-hw + 70, hw - 70, 470, mt, D, D + 2), 'white', 'Mimic diagram');
    p.add(B(-hw + 100, hw - 100, mt - 14, mt - 6, D + 2, D + 3), 'black', 'Mimic: busbar');
    p.add(B(-3, 3, mt - 50, mt - 14, D + 2, D + 3), 'black', 'Mimic: feeder');
    p.add(B(-3, 3, 560, mt - 110, D + 2, D + 3), 'black', 'Mimic: feeder');
    p.add(C(26, 26, 5, 'z', 0, mt - 80, D + 4.5), 'black', 'Position indicator withdrawable part (in the circuit-breaker symbol)');
    p.add(C(20, 20, 5, 'z', xE, 610, D + 4.5), 'black', 'Position indicator feeder earthing switch');
    p.add(C(14, 14, 6, 'z', 0, 614, D + 5), 'steel', 'Actuating opening: racking');
    p.add(RB(-30, 30, 574, 654, D + 2, D + 7, 3), 'zinc', 'Operating slide (racking)');
    p.add(C(7, 7, 6, 'z', -55, 614, D + 5), 'steel', 'Double-bit key opening (5 mm)');
    p.add(C(14, 14, 6, 'z', xE, 520, D + 5), 'steel', 'Actuating opening: earthing switch');
    p.add(C(9, 9, 6, 'z', -35, yFront + 215, D + 5), 'green', 'Actuating opening: CLOSE (push rod onto the ON button)');
    p.add(C(9, 9, 6, 'z', -75, yFront + 215, D + 5), 'red', 'Actuating opening: OPEN (push rod onto the OFF button)');
    p.add(C(12, 12, 8, 'z', -120, yFront + 215, D + 6), 'black', 'Rotary button: swings the cover of the push-rod openings aside');
    p.add(C(16, 16, 8, 'z', 0, yFront + 360, D + 6), 'black', 'Hand-crank opening (charging the closing spring)');
    p.add(RB(hw - 55, hw - 30, 620, 940, D, D + 40, 6), 'black', 'Door handle');
    p.add(C(14, 14, 20, 'z', hw - 42, 940, D + 10), 'steel', 'Handle pivot');
    p.add(B(-hw + 80, -hw + 260, 1230, 1280, D, D + 1), 'yellow', 'Instruction label');
    // key interlocks (O §25.1): locks under a hinged cover in the lower area, below the earthing-switch indicator
    // (600 mm: lower centre; 800 / 1000 mm: lower right). Cover size drawn.
    if (EQ.keys) {
      const kx = W === 600 ? 0 : hw - 150;
      p.add(RB(kx - 60, kx + 60, 300, 410, D, D + 8, 4), 'ralDark', 'Hinged cover of the key interlocks (keys: ES CLOSED / ES OPEN / test position)');
      p.add(C(10, 10, 8, 'z', kx + 42, 355, D + 12), 'black', 'Rotary button of the key-interlock cover');
      for (let k = 0; k < 3; k++) p.add(C(7, 7, 2, 'z', kx - 35 + k * 30, 355, D + 9), 'zinc', ['Key lock (3): key free only with the feeder ES CLOSED', 'Key lock (4): key free only with the feeder ES OPEN', 'Key lock (5): key free only in test position'][k]);
    }
    if (EQ.padlock) for (const [x, y, lab] of [[hw - 42, 600, 'door handle'], [0, 560, 'racking slide'], [xE, 466, 'earthing-switch slide']]) {
      p.add(T(9, 2.2, 'x', x, y + 8, D + 12), 'steel', `Padlock shackle (${lab})`);
      p.add(RB(x - 11, x + 11, y - 22, y + 2, D + 8, D + 20, 3), 'yellow', `Padlock (${lab}, O §7.5)`);
    }
    // forced ventilation: ventilation slots at the bottom and top of the HV door, flap on the inside (O §10.6, Fig. 744)
    if (EQ.fan) {
      for (const [y0, y1] of [[130, 230], [1290, 1340]]) for (const y of spread(y0, y1, Math.round((y1 - y0) / 16))) p.add(B(-hw + 120, hw - 120, y - 3, y + 3, D - 1, D + 1), 'black', 'Ventilation slots (HV door)');
      p.add(B(-hw + 120, hw - 120, 1285, 1345, zDoorIn - 8, zDoorIn - 2), 'galvDark', 'Ventilation flap (inside the HV door; set to the operational position before closing the door)');
      p.add(C(8, 8, 6, 'z', hw - 90, 1315, D + 3), 'green', 'Ventilation-flap position indicator (green = operational)');
    }
    // motor-operated racking (O §27): control door on the HV door over the racking, key, earthing-switch, CLOSE and
    // charging openings, with windows for the indicators and the push-rod opening for OPEN. Size drawn.
    if (EQ.motor) {
      const cx0 = -170, cx1 = xE + 50, cy0 = 470, cy1 = yFront + 380;
      p.add(RB(cx0, cx1, cy0, cy1, D + 9, D + 13, 4), 'ral', 'Control door (motor-operated racking, O §27.2)');
      p.add(B(-105, 85, yFront + 140, yFront + 192, D + 13, D + 13.5), 'glass', 'Control door window: CB CLOSED / OPEN, closing spring, counter');
      p.add(C(24, 24, 1, 'z', xE, 610, D + 13.5), 'glass', 'Control door window: feeder earthing switch');
      p.add(C(10, 10, 2, 'z', -75, yFront + 215, D + 14), 'red', 'Control door: push-rod opening for OPEN');
      for (const y of [cy0 + 60, cy1 - 60]) p.add(C(5, 5, 40, 'y', cx0 - 2, y, D + 11), 'steel', 'Control door hinge');
      p.add(RB(cx1 - 34, cx1 - 12, (cy0 + cy1) / 2 - 50, (cy0 + cy1) / 2 + 50, D + 13, D + 25, 4), 'black', 'Control door handle (pull up to open)');
      p.add(RB(cx1 - 30, cx1 - 16, (cy0 + cy1) / 2 - 80, (cy0 + cy1) / 2 - 58, D + 13, D + 22, 2), 'yellow', 'Padlock appliance of the control door (3AE5)');
      p.add(B(cx0 + 10, cx0 + 110, cy0 + 10, cy0 + 30, D + 13, D + 13.5), 'white', 'Label: racking M motor / H hand / T interlocked');
    }
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
    mk('truckInd', 'Position indicator withdrawable part (vertical = service, horizontal = test)', (b) => b.add(B(-4, 4, -22, 22, 0, 1), 'white', 'Indicator bar'), V(0, mt - 80, D + 7));
    const lev = mk('eswLever', 'Operating lever, feeder earthing switch (180°)', (b) => {
      b.add(C(9, 9, 160, 'z', 0, 0, 80), 'steel', 'Lever shaft');
      b.add(B(-14, 14, -3, 3, -6, 6).translate(0, 0, 4), 'steel', 'Coupling pins');
      b.add(C(16, 16, 240, 'x', 0, 0, 165), 'black', 'Lever handle (cross bar)');
      b.add(C(19, 19, 60, 'x', 112, 0, 165), 'red', 'Grip');
    }, V(xE, 520, D + 8));
    lev.visible = false;
  }

  // ================================================================ WITHDRAWABLE SION 3AE5 (service position)
  // The breaker of the Breaker tab, built for this panel. Its part groups go into three panel parts that move together
  // by the racking travel (truck / operating mechanism with the secondary devices / poles and contacts); the LV plug
  // stays in its socket.
  const cbGroups = {};
  for (const id of ['truck', 'mech', 'breaker']) {
    const pb = part(id, V(0, 0, 0));
    pb.group.userData.truck = true;
    pb.finish();
    const off = new THREE.Group();
    off.position.set(0, yBk, zBk);
    pb.group.add(off);
    cbGroups[id] = off;
  }
  const cbPanelPart = (id) => (id === 'bkTruck' ? 'truck' : /^bk(Shell|Sep|Upper|Lower|Rods|VI|VIin|Arms|Tulips|Sleeves)$/.test(id) ? 'breaker' : 'mech');
  for (const [id, g] of Object.entries(cb.parts)) {
    const hold = new THREE.Group();
    hold.position.copy(g.parent.position); // the breaker body sits YB above the truck bottom
    hold.add(g);
    cbGroups[cbPanelPart(id)].add(hold);
  }
  cb.parts.bkTool.visible = false;
  // the stub of the -X0 control cable is replaced by the panel's LV plug cable
  let gland = V(0, 700, 127);
  cb.parts.bkX0plug.traverse((c) => {
    if (!c.isMesh) return;
    if (c.userData.label === 'Control cable to the panel LV socket') c.visible = false;
    if (c.userData.label === '-X0 cable gland') { c.geometry.computeBoundingBox(); gland = c.geometry.boundingBox.getCenter(V(0, 0, 0)); }
  });
  cb.parts.bkX0plug.userData.prims = (cb.parts.bkX0plug.userData.prims || []).filter((q) => q.label !== 'Control cable to the panel LV socket');
  cb.pose({c: 1, s: 0});
  {
    const xs3 = xs.flatMap((x) => [yU, yL].map((y) => [x, y]));
    const pb = {group: cbGroups.breaker.parent};
    anchor('cbArm', pb, xs3.map(([x, y]) => ({p: N(x, y + armR, zBk + cbd.ZT - 60), n: N(0, 1, 0)})));
    anchor('cbTulip', pb, xs3.map(([x, y]) => ({p: N(x, y, zBk + cbd.ZT - 238), n: N(0, 0, 1)})));
  }
  // static LV plug in the socket under the LV compartment + cable to the -X0 gland on the breaker (rebuilt as it moves)
  const yPlug0 = 1300;
  const lvCable = {x: 0, y0: yPlug0 + 16, z0: zLV + 55, y1: yFront + gland.y, z1: zBk + gland.z + 11};
  {
    const plug = part('lvPlug', V(0, 0, 0));
    plug.add(RB(-80, 80, yPlug0 + 2, yLV - 38, zLV + 5, zLV + 55, 4), 'black', 'LV plug (64-pole, coded)');
    plug.finish();
    const cable = new THREE.Mesh(lvCableGeometry(lvCable, 0), mats.black);
    cable.userData.label = 'LV plug cable (64-pole)';
    cable.userData.lvCable = true;
    cable.userData.noEdges = true;
    parts.lvPlug[0].add(cable);
  }

  // ================================================================ SERVICE TRUCK
  {
    const p = part('serviceTruck', V(0, 0, 0));
    p.group.visible = false;
    p.group.userData.service = true;
    const z0 = D + 10, yT = yShelf;
    p.add(B(-hw + 40, hw - 40, yT - 6, yT, z0, z0 + 900), 'steel', 'Service truck platform');
    for (const s of [-1, 1]) {
      const x = s * cbd.truck.d / 2;
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
  return {root, parts, anchors, dirs, shellIds, lvCable, cb, eq: EQ, dims: {W, D, H: Hd, LVTOP, yBC, yPRC, zP, zLV, yLV, yU, yL, zC, yShelf, zFront, contactR, spoutRi, spoutRo, tulipIn: contactR, tulipOut: cbd.cageOut, sleeveOut: cbd.sleeveIn + 6, armR, zTulip0, zTulip1, zFC1}};
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
