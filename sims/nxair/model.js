// Procedural NXAIR circuit-breaker panel, built in millimetres from the variant (width, depth, busbar rating, Ur).
// Layout follows the sectional view in O §6.2 Fig. 27: busbar compartment top rear, connection compartment bottom
// rear, switching-device compartment front with the withdrawable 3AE breaker, low-voltage compartment top front,
// pressure relief duct across the top. Panel-local axes: x across the row (±W/2), y up from the floor, z from the
// rear wall (0) to the front door (D).
//
// Every part is a THREE.Group keyed by its id in data.js. Bolt anchors are generated here with the counts the
// manual gives; their exact positions are representative.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BUSBAR, WIDTHS} from './data.js';

export const H = 2300;
const YB = 55; // top of base frame

// --------------------------------------------------------------------------------------------- materials
export function makeMaterials(planes) {
  const m = (o) => new THREE.MeshStandardMaterial({clippingPlanes: planes, clipShadows: true, side: THREE.DoubleSide, ...o});
  return {
    ral: m({color: 0xc9cdc8, roughness: 0.62, metalness: 0.05}), // RAL 7035 powder coat
    galv: m({color: 0xaeb6bb, roughness: 0.42, metalness: 0.55}), // galvanised sheet
    galvDark: m({color: 0x8c959b, roughness: 0.5, metalness: 0.5}),
    copper: m({color: 0xc47a4a, roughness: 0.32, metalness: 0.85}),
    silver: m({color: 0xdfe3e6, roughness: 0.2, metalness: 0.95}),
    resin: m({color: 0x8a3b26, roughness: 0.55, metalness: 0.0}), // cast-resin bushings / CTs
    epoxy: m({color: 0x4b5156, roughness: 0.6, metalness: 0.05}), // breaker poles
    black: m({color: 0x25292c, roughness: 0.7, metalness: 0.1}),
    rubber: m({color: 0x1d1f20, roughness: 0.9, metalness: 0.0}),
    cable: m({color: 0x2a2c2e, roughness: 0.8, metalness: 0.0}),
    earth: m({color: 0x7da23a, roughness: 0.5, metalness: 0.2}),
    glass: m({color: 0x9fb4bf, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.35}),
    screen: m({color: 0x1f3442, roughness: 0.3, metalness: 0.1, emissive: 0x0e2230}),
    steel: m({color: 0x7d858a, roughness: 0.45, metalness: 0.7}),
    plastic: m({color: 0xd9d6cc, roughness: 0.6, metalness: 0.0}),
  };
}

// ----------------------------------------------------------------------------------------------- helpers
const box = (mat, x0, x1, y0, y1, z0, z1) => {
  const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return mesh;
};
const cyl = (mat, r0, r1, len, axis, x, y, z, seg = 24) => {
  const g = new THREE.CylinderGeometry(r0, r1, len, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.set(x, y, z);
  return mesh;
};
// a polyline of rectangular bar (copper droppers), w across x, t thick
const barPath = (mat, pts, w, t) => {
  const grp = new THREE.Group();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    const vertical = Math.abs(d.y) > Math.abs(d.z);
    const g = vertical ? new THREE.BoxGeometry(w, len + t, t) : new THREE.BoxGeometry(w, t, len + t);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    grp.add(mesh);
  }
  return grp;
};
const spread = (a, b, n) => Array.from({length: n}, (_, i) => a + ((b - a) * (n === 1 ? 0.5 : i / (n - 1))));
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------------------------- the panel
// opts: {W, D, bus, ur, eswClosed}
export function buildPanel(mats, opts) {
  const {W, D, bus, ur} = opts;
  const hw = W / 2;
  const zP = Math.round(0.43 * D); // partition plane A | B,C
  const yBC = 1250; // busbar compartment floor / connection compartment roof
  const yPRC = 1960;
  const zLV = D - 480;
  const yLV = 1670;
  const yU = 1380, yL = 1060; // bushing axes
  const pitch = WIDTHS[W].pitch;
  const xs = [-pitch, 0, pitch]; // L1 L2 L3 across the panel
  const BB = BUSBAR[bus];
  const zPh = [zP * 0.78, zP * 0.52, zP * 0.26]; // L1 front, L2 middle, L3 rear (I Fig. 61)
  const yPh = [1690, 1790, 1690];

  const root = new THREE.Group();
  const parts = {}; // id -> [groups]
  const anchors = {}; // jointId -> {part, list:[{p,n}]}
  const dirs = {}; // id -> explode vector (mm at ex=1)
  const shellIds = new Set(); // parts drawn as glass in x-ray mode

  const part = (id, dir, {shell = false} = {}) => {
    const g = new THREE.Group();
    g.userData.part = id;
    root.add(g);
    (parts[id] ||= []).push(g);
    g.userData.dir = dir || V(0, 0, 0);
    if (shell) shellIds.add(id);
    return g;
  };
  const anchor = (jid, g, list) => {
    (anchors[jid] ||= []).push({group: g, list});
  };

  // ---------------------------------------------------------------- site
  {
    const g = part('rails', V(0, -380, 0));
    for (const z of [35, D - 35]) {
      g.add(box(mats.steel, -hw, hw, -50, -3, z - 25, z + 25)); // C 50 x 30 x 3, top flush
    }
    g.add(box(mats.galvDark, -hw, hw, -110, -50, D - 60, D - 10)); // concrete line hint under front rail
  }

  // ---------------------------------------------------------------- base frame
  {
    const g = part('base', V(0, -190, 0));
    g.add(box(mats.galvDark, -hw, -hw + 40, 0, YB, 0, D));
    g.add(box(mats.galvDark, hw - 40, hw, 0, YB, 0, D));
    g.add(box(mats.galvDark, -hw, hw, 0, YB, 10, 70));
    g.add(box(mats.galvDark, -hw, hw, 0, YB, D - 70, D - 10));
    // elongated holes 60 x 20 (drawn as dark slots)
    for (const z of [40, D - 40]) g.add(box(mats.black, -30, 30, YB - 1, YB + 0.5, z - 10, z + 10));
    anchor('floorC', g, [{p: V(0, YB + 2, 40), n: V(0, 1, 0)}, {p: V(0, YB + 2, D - 40), n: V(0, 1, 0)}]);
  }

  // ---------------------------------------------------------------- enclosure shells
  {
    // side walls with LV cut-out handled by LV part; walls span floor to roof
    const prof = new THREE.Shape();
    prof.moveTo(0, YB);
    prof.lineTo(D, YB);
    prof.lineTo(D, yLV);
    prof.lineTo(zLV, yLV);
    prof.lineTo(zLV, H);
    prof.lineTo(0, H);
    prof.closePath();
    const sideGeo = new THREE.ShapeGeometry(prof);
    // ShapeGeometry is in XY; map (x->z, y->y) and place at ±hw
    sideGeo.rotateY(-Math.PI / 2);
    for (const [id, sx, dx] of [['sideL', -hw, -1], ['sideR', hw, 1]]) {
      const g = part(id === 'sideR' ? 'sideL' : 'sideL', V(dx * 520, 0, 0), {shell: true});
      const mesh = new THREE.Mesh(sideGeo, mats.galv);
      mesh.position.x = sx;
      g.add(mesh);
      if (id === 'sideL') {
        // 7 × M8x25 into the neighbour along the front edge of the left inner wall (I Fig. 108)
        anchor('sdc', g, spread(220, 1480, 7).map((y) => ({p: V(sx + 2, y, D - 95), n: V(1, 0, 0)})));
      }
    }
    // fixed rear wall of busbar compartment
    const gb = part('shellB', V(0, 0, -260), {shell: true});
    gb.add(box(mats.galv, -hw, hw, yBC, yPRC, -1, 1));
    // upper partition A|B with the upper bushings
    gb.add(box(mats.galv, -hw, hw, yBC, yPRC, zP - 1, zP + 1));
    // floor of B / roof of C
    gb.add(box(mats.galv, -hw, hw, yBC - 1, yBC + 1, 0, zP));
    // roof of A rear part, top of B overhang
    gb.add(box(mats.galv, -hw, hw, yPRC - 1, yPRC + 1, 0, zLV));
  }

  // ---------------------------------------------------------------- busbar cover (floor of the B overhang above A)
  {
    const g = part('busCover', V(0, -260, 260));
    const y = 1590;
    g.add(box(mats.galv, -hw + 20, hw - 20, y - 1.5, y + 1.5, zP, zP + 300));
    g.add(box(mats.galv, -hw, hw, y, yPRC, zP + 300 - 1, zP + 300 + 1)); // front face of the overhang
    g.add(box(mats.black, -60, 60, y - 25, y - 2, zP + 260, zP + 275)); // handle
    const pts = [];
    for (const x of spread(-hw + 50, hw - 50, 5)) pts.push(V(x, y - 3, zP + 15), V(x, y - 3, zP + 285));
    pts.push(V(0, y - 3, zP + 150));
    anchor('busCover', g, pts.slice(0, 11).map((p) => ({p, n: V(0, -1, 0)})));
  }

  // ---------------------------------------------------------------- transverse partition (right side of B)
  {
    const g = part('transPart', V(480, 0, 0));
    const x = hw - 6;
    const plate = box(mats.galv, x - 1.5, x + 1.5, yBC + 10, yPRC - 10, 15, zP - 15);
    g.add(plate);
    for (let k = 0; k < 3; k++) {
      const r = 34 + BB.bars * 9;
      g.add(cyl(mats.resin, r, r, 50, 'x', x, yPh[k], zPh[k]));
    }
    anchor('transPart', g, [
      {p: V(x - 3, yPRC - 30, 60), n: V(-1, 0, 0)}, {p: V(x - 3, yPRC - 30, zP - 60), n: V(-1, 0, 0)},
      {p: V(x - 3, yBC + 30, 60), n: V(-1, 0, 0)}, {p: V(x - 3, yBC + 30, zP - 60), n: V(-1, 0, 0)},
    ]);
  }

  // ---------------------------------------------------------------- busbars and feeder bars
  {
    const g = part('busbars', V(0, 520, 0));
    const t = 10, hgt = BB.bars === 1 ? 80 : 100;
    for (let k = 0; k < 3; k++) {
      for (let b = 0; b < BB.bars; b++) {
        const z = zPh[k] + (b - (BB.bars - 1) / 2) * (t + (BB.spacer ? 10 : 10));
        g.add(box(mats.copper, -hw + 2, hw - 2, yPh[k] - hgt / 2, yPh[k] + hgt / 2, z - t / 2, z + t / 2));
      }
      if (BB.spacer) g.add(box(mats.copper, xs[k] - 30, xs[k] + 30, yPh[k] - 40, yPh[k] + 40, zPh[k] - 5, zPh[k] + 5));
      const zf = zPh[k] + ((BB.bars - 1) / 2) * (t + 10) + t / 2;
      anchor('busbar', g, [
        {p: V(xs[k] - 22, yPh[k] - 18, zf + 6), n: V(0, 0, 1)},
        {p: V(xs[k] + 22, yPh[k] - 18, zf + 6), n: V(0, 0, 1)},
      ]);
      if (ur === 17.5) {
        const sh = box(mats.plastic, xs[k] - 70, xs[k] + 70, yPh[k] - hgt / 2 - 25, yPh[k] + hgt / 2 + 25, zPh[k] - 50 - BB.bars * 10, zPh[k] + 50 + BB.bars * 10);
        sh.material = mats.plastic.clone();
        sh.material.transparent = true;
        sh.material.opacity = 0.45;
        g.add(sh);
      }
    }
    const f = part('feeders', V(0, 300, 0));
    for (let k = 0; k < 3; k++) {
      const zb = zPh[k] - ((BB.bars - 1) / 2) * (t + 10) - t / 2 - 6; // feeder flag behind the busbar stack
      f.add(barPath(mats.copper, [V(xs[k], yU, zP - 70), V(xs[k], yU, zb), V(xs[k], yPh[k] + 20, zb)], 60, 10));
    }
  }

  // ---------------------------------------------------------------- bushings, shutters
  for (const [id, y] of [['bushU', yU], ['bushL', yL]]) {
    const g = part(id, V(0, 0, 240));
    for (const x of xs) {
      g.add(cyl(mats.resin, 62, 86, 190, 'z', x, y, zP + 95)); // spout into A
      g.add(cyl(mats.resin, 95, 95, 14, 'z', x, y, zP + 5)); // flange
      g.add(cyl(mats.silver, WIDTHS[W].contact ? WIDTHS[W].contact / 2 : 34, 30, 120, 'z', x, y, zP + 140)); // fixed contact
      g.add(cyl(mats.resin, 40, 40, 90, 'z', x, y, zP - 45)); // tail into B / C
    }
  }
  {
    const g = part('shutters', V(0, 0, 380));
    g.userData.shutter = true;
    const up = box(mats.galv, -hw + 40, hw - 40, yU - 120, yU + 130, zP + 205, zP + 208);
    const lo = box(mats.galv, -hw + 40, hw - 40, yL - 130, yL + 120, zP + 205, zP + 208);
    up.userData.shut = 1;
    lo.userData.shut = -1;
    g.add(up, lo);
    for (const s of [-1, 1]) g.add(box(mats.galvDark, s * (hw - 30) - 8, s * (hw - 30) + 8, yL - 200, yU + 200, zP + 150, zP + 230)); // guide linkage
  }

  // ---------------------------------------------------------------- vertical partition A|C + protection plate
  {
    const g = part('partition', V(0, 0, 520));
    const z = zP + 2;
    const mesh = box(mats.galv, -hw + 8, hw - 8, YB + 70, yBC, z - 1.5, z + 1.5);
    g.add(mesh);
    const pts = [];
    for (const x of spread(-hw + 40, hw - 40, 5)) pts.push(V(x, yBC - 25, z + 3));
    for (const y of spread(YB + 180, yBC - 120, 3)) pts.push(V(-hw + 25, y, z + 3), V(hw - 25, y, z + 3));
    for (const x of spread(-hw + 40, hw - 40, 4)) pts.push(V(x, YB + 95, z + 3));
    anchor('partition', g, pts.map((p) => ({p, n: V(0, 0, 1)})));
  }
  {
    const g = part('protPlate', V(0, 0, 700));
    g.add(box(mats.galv, -hw + 50, hw - 50, YB + 10, YB + 260, zP + 30, zP + 33));
    anchor('protPlate', g, [
      V(-hw + 75, YB + 35, zP + 35), V(hw - 75, YB + 35, zP + 35), V(-hw + 75, YB + 235, zP + 35), V(hw - 75, YB + 235, zP + 35),
    ].map((p) => ({p, n: V(0, 0, 1)})));
  }

  // ---------------------------------------------------------------- wiring duct, front link
  {
    const g = part('wiringDuct', V(-280, 0, 120));
    const x0 = -hw + 8, x1 = -hw + 70;
    g.add(box(mats.galvDark, x0, x1, YB + 60, yLV - 40, D - 330, D - 220));
    g.add(box(mats.galv, x1, x1 + 2, YB + 80, 840, D - 335, D - 215)); // lower cover
    g.add(box(mats.galv, x1, x1 + 2, 870, yLV - 60, D - 335, D - 215)); // upper cover
    anchor('wdc', g, [V(x1 + 3, 160, D - 275), V(x1 + 3, 780, D - 275), V(x1 + 3, 940, D - 275), V(x1 + 3, yLV - 120, D - 275)].map((p) => ({p, n: V(1, 0, 0)})));
    const l = part('link', V(-120, 0, 300));
    l.add(box(mats.galvDark, -hw - 6, -hw + 6, 300, 1500, D - 60, D - 40));
  }

  // ---------------------------------------------------------------- connection compartment contents
  const zC = Math.round(zP * 0.55); // cable connection plane
  {
    // CTs on the feeder side of the lower bushings
    const g = part('cts', V(0, 0, -220));
    for (const x of xs) {
      g.add(box(mats.resin, x - 62, x + 62, yL - 80, yL + 80, zP - 250, zP - 110));
      g.add(box(mats.black, x - 30, x + 30, yL + 80, yL + 92, zP - 210, zP - 150)); // secondary terminal box
    }
  }
  {
    const g = part('connBars', V(0, 0, -360));
    for (const x of xs) {
      g.add(barPath(mats.copper, [V(x, yL, zP - 90), V(x, yL, zC), V(x, 470, zC)], 60, 10));
    }
    anchor('lugM12', g, xs.flatMap((x) => [V(x, 650, zC - 8), V(x, 520, zC - 8)]).map((p) => ({p, n: V(0, 0, -1)})));
  }
  {
    const g = part('cables', V(0, -120, -520));
    for (const x of xs) {
      for (const [yl, dz] of [[650, -22], [520, -60]]) {
        const z = zC + dz;
        g.add(box(mats.silver, x - 20, x + 20, yl - 70, yl + 22, z - 6, z + 6)); // lug palm
        const top = yl - 70;
        g.add(cyl(mats.rubber, 34, 40, 330, 'y', x + (dz < -30 ? 0 : 0), top - 165, z - 4)); // sealing end with sheds
        for (let s = 0; s < 4; s++) g.add(cyl(mats.rubber, 52, 52, 8, 'y', x, top - 40 - s * 45, z - 4, 20));
        g.add(cyl(mats.cable, 24, 24, top - 330 - 10, 'y', x, (top - 330) / 2, z - 4));
        // screen earth lead
        g.add(barPath(mats.earth, [V(x + 30, top - 300, z - 4), V(x + 30, 200, z - 4), V(x + 30, 200, 70)], 6, 6));
      }
    }
  }
  {
    const g = part('clamps', V(0, -60, -560));
    const y = 300;
    g.add(box(mats.galvDark, -hw + 30, hw - 30, y - 20, y + 20, zC - 120, zC - 85)); // bracket
    const pts = [], tops = [];
    for (const x of xs) {
      for (const dz of [-22, -60]) {
        g.add(box(mats.black, x - 45, x + 45, y + 20, y + 45, zC + dz - 30, zC + dz + 22));
      }
      pts.push(V(x - 38, y, zC - 122), V(x + 38, y, zC - 122));
      tops.push(V(x - 38, y + 48, zC - 40), V(x + 38, y + 48, zC - 40));
    }
    anchor('clampBr', g, pts.map((p) => ({p, n: V(0, 0, -1)})));
    anchor('clampTop', g, tops.map((p) => ({p, n: V(0, 1, 0)})));
  }
  {
    const g = part('floorPlate', V(0, -280, -300));
    g.add(box(mats.galv, -hw + 20, hw - 20, YB + 2, YB + 5, 80, zP - 20));
    for (const x of xs) for (const dz of [-22, -60]) g.add(cyl(mats.rubber, 50, 50, 8, 'y', x, YB + 8, zC + dz - 4, 24));
    const pts = [];
    for (const x of spread(-hw + 40, hw - 40, 3)) pts.push(V(x, YB + 7, 100), V(x, YB + 7, zP - 40));
    anchor('floorPlate', g, pts.map((p) => ({p, n: V(0, 1, 0)})));
  }
  {
    const g = part('earthBar', V(0, -100, -640));
    g.add(box(mats.copper, -hw + 5, hw - 5, 170, 210, 64, 70));
    g.add(box(mats.copper, -hw - 30, -hw + 60, 170, 210, 70, 76)); // link to the left neighbour
    anchor('earthLink', g, [{p: V(-hw + 20, 190, 78), n: V(0, 0, 1)}, {p: V(-hw + 45, 190, 78), n: V(0, 0, 1)}]);
    anchor('earthConn', g, [{p: V(0, 190, 72), n: V(0, 0, 1)}]);
  }
  {
    // feeder earthing switch: shaft along x near the rear, blades to the connection bars
    const g = part('esw', V(0, 0, -420));
    const y = 880, z0 = 120;
    g.add(cyl(mats.steel, 14, 14, W - 60, 'x', 0, y, z0));
    for (const x of xs) {
      const blade = new THREE.Group();
      blade.position.set(x, y, z0);
      const len = zC - z0 - 15;
      blade.add(box(mats.copper, -14, 14, -6, 6, 0, len));
      blade.userData.blade = true;
      g.add(blade);
      g.add(box(mats.silver, x - 20, x + 20, y - 25, y + 25, zC - 18, zC - 8)); // fixed contact on the bar
    }
  }
  {
    const g = part('vt', V(0, 120, -640));
    for (const x of xs) {
      g.add(box(mats.resin, x - 55, x + 55, 1000, 1180, 20, 150));
      g.add(cyl(mats.resin, 22, 22, 50, 'y', x, 1205, 85));
    }
    g.add(box(mats.galvDark, -hw + 20, hw - 20, 985, 1000, 10, 170));
    anchor('vtPrim', g, xs.map((x) => ({p: V(x, 1232, 85), n: V(0, 1, 0)})));
  }

  // ---------------------------------------------------------------- rear wall + ledges
  {
    const g = part('rearWall', V(0, 0, -720), {shell: true});
    g.add(box(mats.galv, -hw + 12, hw - 12, YB + 5, yBC - 5, -2, 0));
    g.add(box(mats.black, -70, 70, 640, 670, -30, -2)); // handle
    anchor('rearBase', g, spread(-hw + 80, hw - 80, 4).map((x) => ({p: V(x, YB + 40, -3), n: V(0, 0, -1)})));
    const h = part('ledgeH', V(0, 0, -900));
    h.add(box(mats.ral, -hw, hw, yBC - 22, yBC + 22, -10, -3));
    anchor('rearH', h, spread(-hw + 30, hw - 30, 9).map((x) => ({p: V(x, yBC, -11), n: V(0, 0, -1)})));
    const v = part('ledgeV', V(0, 0, -980));
    for (const sx of [-hw, hw]) {
      v.add(box(mats.ral, sx - 25, sx + 25, YB + 20, yBC - 22, -10, -3));
      v.add(box(mats.rubber, sx - 6, sx + 6, YB + 30, yBC - 30, -2, 8)); // sealing bracket
    }
    anchor('rearV', v, [-hw, hw].flatMap((sx) => spread(YB + 50, yBC - 50, 14).map((y) => ({p: V(sx + (sx < 0 ? 12 : -12), y, -11), n: V(0, 0, -1)}))));
  }

  // ---------------------------------------------------------------- pressure relief duct
  {
    const g = part('prc', V(0, 700, -60), {shell: true});
    const y0 = yPRC, y1 = H;
    g.add(box(mats.galv, -hw, hw, y1 - 2, y1, 0, zLV)); // roof
    g.add(box(mats.galv, -hw, hw, y0, y1, -1, 1));
    g.add(box(mats.galv, -hw, hw, y0, y1, zLV - 1, zLV + 1));
    // relief flaps lying on top of B
    for (const z of [zP * 0.3, zP * 0.7]) g.add(box(mats.galvDark, -hw + 40, hw - 40, y0 + 2, y0 + 5, z - zP * 0.18, z + zP * 0.18));
    const lo = [];
    for (const z of spread(60, zLV - 60, 8)) lo.push(V(-hw + 3, y0 + 25, z));
    for (const y of spread(y0 + 80, y1 - 70, 3)) lo.push(V(-hw + 3, y, 30), V(-hw + 3, y, zLV - 30));
    anchor('prcLow', g, lo.map((p) => ({p, n: V(1, 0, 0)})));
    anchor('prcUp', g, spread(60, zLV - 60, 8).map((z) => ({p: V(-hw + 3, y1 - 25, z), n: V(1, 0, 0)})));
  }

  // ---------------------------------------------------------------- low-voltage compartment
  {
    const g = part('lv', V(0, 430, 320), {shell: true});
    g.add(box(mats.galv, -hw + 1, hw - 1, yLV, yLV + 2, zLV, D));
    g.add(box(mats.galv, -hw + 1, hw - 1, H - 2, H, zLV, D));
    g.add(box(mats.galv, -hw + 1, hw - 1, yLV, H, zLV - 1, zLV + 1));
    g.add(box(mats.galv, -hw, -hw + 2, yLV, H, zLV, D));
    g.add(box(mats.galv, hw - 2, hw, yLV, H, zLV, D));
    g.add(box(mats.ral, -hw + 4, hw - 4, yLV + 6, H - 6, D - 22, D)); // LV door
    g.add(box(mats.screen, -150, 40, 2020, 2200, D + 0.5, D + 3)); // relay
    g.add(box(mats.black, 80, 200, 2060, 2180, D + 0.5, D + 3));
    g.add(box(mats.black, hw - 60, hw - 40, 1950, 2050, D, D + 12)); // door lock
    // DIN rail with terminals inside
    g.add(box(mats.steel, -hw + 40, hw - 40, 1760, 1790, zLV + 20, zLV + 30));
    for (const x of spread(-hw + 60, hw - 60, 18)) g.add(box(mats.plastic, x - 5, x + 5, 1740, 1810, zLV + 30, zLV + 75));
    anchor('lv', g, spread(1760, 2220, 3).map((y) => ({p: V(-hw + 3, y, zLV + 200), n: V(1, 0, 0)})));
  }

  // ---------------------------------------------------------------- high-voltage door
  {
    const g = part('hvdoor', V(0, 0, 900), {shell: true});
    const z = D - 24;
    g.add(box(mats.ral, -hw + 4, hw - 4, YB + 5, yLV - 6, z, D));
    g.add(box(mats.glass, -120, 120, 1180, 1460, D - 0.5, D + 1)); // inspection window
    g.add(box(mats.plastic, -hw + 60, hw - 60, 640, 1120, D, D + 2)); // mimic / control board
    // mimic: busbar, breaker, feeder line
    g.add(box(mats.black, -hw + 90, hw - 90, 1080, 1088, D + 2, D + 3));
    g.add(box(mats.black, -4, 4, 700, 1080, D + 2, D + 3));
    g.add(cyl(mats.black, 26, 26, 4, 'z', 0, 980, D + 3)); // truck position indicator
    g.add(cyl(mats.earth, 18, 18, 4, 'z', 0, 760, D + 3)); // earthing switch indicator
    for (const [x, y] of [[-hw + 120, 900], [-hw + 120, 820], [hw - 140, 880], [hw - 140, 760]]) g.add(cyl(mats.steel, 14, 14, 6, 'z', x, y, D + 3)); // actuating openings
    g.add(box(mats.black, hw - 50, hw - 30, 820, 1000, D, D + 40)); // handle
  }

  // ---------------------------------------------------------------- withdrawable 3AE breaker on its truck
  {
    const g = part('breaker', V(0, 0, 0));
    g.userData.truck = true;
    const zPole = zP + 330, zFront = D - 50;
    const t = new THREE.Group();
    t.userData.part = 'truck';
    g.add(t);
    // chassis + wheels
    t.add(box(mats.galvDark, -hw + 70, hw - 70, YB + 40, YB + 150, zP + 260, zFront));
    for (const x of [-hw + 90, hw - 90]) for (const z of [zP + 300, zFront - 40]) t.add(cyl(mats.black, 40, 40, 30, 'x', x, YB + 40, z, 20));
    // racking spindle
    t.add(cyl(mats.steel, 10, 10, zFront - zP - 300, 'z', 0, YB + 110, (zP + 300 + zFront) / 2));
    // operating mechanism housing
    const mech = box(mats.black, -hw + 90, hw - 90, YB + 150, 1180, zFront - 240, zFront);
    mech.userData.part = 'breaker';
    g.add(mech);
    g.add(box(mats.plastic, -hw + 130, hw - 130, 700, 1080, zFront + 0.5, zFront + 2)); // front plate
    g.add(box(mats.earth, -40, 40, 980, 1000, zFront + 2, zFront + 3)); // OPEN indicator
    g.add(box(mats.steel, -hw + 90, hw - 90, YB + 150, YB + 170, zPole - 60, zFront - 240)); // pole frame
    for (const x of xs) {
      g.add(cyl(mats.epoxy, 55, 60, 640, 'y', x, (yL + yU) / 2, zPole)); // pole housing
      g.add(cyl(mats.epoxy, 20, 20, (yL + yU) / 2 - YB - 300, 'y', x, YB + 160 + ((yL + yU) / 2 - YB - 300) / 2, zPole + 70)); // insulating coupling rod
      for (const y of [yU, yL]) {
        const arm = zPole - (zP + 205);
        g.add(cyl(mats.silver, 22, 22, arm, 'z', x, y, zPole - arm / 2));
        // tulip contact ring
        const r = (WIDTHS[W].contact ? WIDTHS[W].contact / 2 : 34) + 8;
        g.add(cyl(mats.silver, r, r, 70, 'z', x, y, zP + 225, 24));
      }
    }
  }

  // ---------------------------------------------------------------- service truck (shown when breaker is out)
  {
    const g = part('serviceTruck', V(0, 0, 0));
    g.visible = false;
    g.userData.service = true;
    const z0 = D + 10;
    g.add(box(mats.steel, -hw + 50, hw - 50, 40, YB, z0, z0 + 900));
    for (const x of [-hw + 60, hw - 60]) {
      g.add(box(mats.steel, x - 15, x + 15, YB, YB + 30, z0, z0 + 900)); // guide rails
      g.add(box(mats.steel, x - 10, x + 10, YB, 980, z0 + 870, z0 + 890)); // push handle uprights
    }
    g.add(cyl(mats.steel, 14, 14, W - 120, 'x', 0, 980, z0 + 880));
    for (const x of [-hw + 60, hw - 60]) for (const z of [z0 + 60, z0 + 840]) g.add(cyl(mats.black, 20, 20, 30, 'x', x, 20, z, 16));
  }

  // ---------------------------------------------------------------- craning angles (transport step only)
  {
    const g = part('crane', V(0, 0, 0));
    g.visible = false;
    g.userData.crane = true;
    const pts = [];
    for (const sx of [-1, 1]) for (const z of [D - 140, 140]) {
      const x = sx * (hw + 3);
      g.add(box(mats.steel, x, x + sx * 8, 1900, 2200, z - 60, z + 60));
      g.add(box(mats.steel, x + sx * 8, x + sx * 90, 2150, 2200, z - 60, z + 60));
      g.add(cyl(mats.black, 16, 16, 14, 'y', x + sx * 50, 2201, z));
      for (const y of spread(1950, 2120, 3)) pts.push({p: V(x + sx * 9, y, z), n: V(sx, 0, 0)});
    }
    anchor('crane', g, pts);
    // crane rods front-to-rear, Ø 25
    for (const sx of [-1, 1]) g.add(cyl(mats.steel, 12.5, 12.5, sx < 0 ? D + 600 : D + 600, 'z', sx * (hw + 50), 2230, D / 2));
  }

  for (const [id, gs] of Object.entries(parts)) for (const g of gs) dirs[id] = g.userData.dir;
  return {root, parts, anchors, dirs, shellIds, dims: {W, D, zP, zLV, yLV, yU, yL, zC}};
}

// ------------------------------------------------------------------------------------------------- bolts
// One merged hex-head + washer + shank geometry per size class, drawn along +Y with the bearing face at y = 0.
const SIZES = {M8: {d: 8, s: 13, k: 5.3}, M10: {d: 10, s: 16, k: 6.4}, M12: {d: 12, s: 18, k: 7.5}, M16: {d: 16, s: 24, k: 10}};
const boltGeoCache = {};
export function boltGeometry(size) {
  if (boltGeoCache[size]) return boltGeoCache[size];
  const {d, s, k} = SIZES[size] || SIZES.M8;
  const head = new THREE.CylinderGeometry(s / Math.sqrt(3), s / Math.sqrt(3), k, 6);
  head.translate(0, d * 0.2 + k / 2, 0);
  const washer = new THREE.CylinderGeometry(s * 0.62, s * 0.62, d * 0.2, 16);
  washer.translate(0, d * 0.1, 0);
  const shank = new THREE.CylinderGeometry(d / 2, d / 2, d * 2.2, 10);
  shank.translate(0, -d * 1.1, 0);
  const g = mergeGeometries([head.toNonIndexed(), washer.toNonIndexed(), shank.toNonIndexed()]);
  boltGeoCache[size] = g;
  return g;
}
