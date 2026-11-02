// Geometry helpers for the NXAIR model. Everything is in millimetres. A PartBuilder collects primitive geometries
// per (material, label) and merges them into one mesh each, so a part with hundreds of primitives costs a handful of
// draw calls while every sub-component keeps its own name for hover and picking.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const flat = (g) => (g.index ? g.toNonIndexed() : g);
const strip = (g) => {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
  g.clearGroups();
  return g;
};

export class PartBuilder {
  constructor(group, mats) {
    this.group = group;
    this.mats = mats;
    this.bins = new Map();
  }
  add(geo, mat, label) {
    const key = mat + '|' + (label || '');
    if (!this.bins.has(key)) this.bins.set(key, {mat, label, geos: []});
    this.bins.get(key).geos.push(strip(flat(geo)));
    return this;
  }
  finish() {
    for (const {mat, label, geos} of this.bins.values()) {
      const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      const mesh = new THREE.Mesh(g, this.mats[mat]);
      mesh.userData.label = label;
      this.group.add(mesh);
    }
    this.bins.clear();
    return this.group;
  }
}

// axis-aligned box from extents
export const B = (x0, x1, y0, y1, z0, z1) => {
  const g = new THREE.BoxGeometry(Math.max(0.1, Math.abs(x1 - x0)), Math.max(0.1, Math.abs(y1 - y0)), Math.max(0.1, Math.abs(z1 - z0)));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
};
// rounded box from extents
export const RB = (x0, x1, y0, y1, z0, z1, r = 6, seg = 2) => {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  const g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.1, h / 2 - 0.1, d / 2 - 0.1));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
};
const orient = (g, axis) => {
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  else if (axis === '-z') g.rotateX(-Math.PI / 2);
  else if (axis === '-x') g.rotateZ(Math.PI / 2);
  return g;
};
// cylinder: radius r0 at the +axis end, r1 at the -axis end, centred at (x,y,z)
export const C = (r0, r1, len, axis, x, y, z, seg = 24) => {
  const g = orient(new THREE.CylinderGeometry(r0, r1, len, seg), axis);
  g.translate(x, y, z);
  return g;
};
// solid of revolution: profile [[r, h], ...] with h along the axis (0 at the base point), base at (x,y,z)
export const L = (profile, axis, x, y, z, seg = 28) => {
  const g = orient(new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(Math.max(0.01, r), h)), seg), axis);
  g.translate(x, y, z);
  return g;
};
// torus ring around an axis
export const T = (R, r, axis, x, y, z, seg = 24) => {
  const g = new THREE.TorusGeometry(R, r, 8, seg);
  if (axis === 'x') g.rotateY(Math.PI / 2);
  else if (axis === 'y') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
};
// 2D shape in the (z, y) plane extruded along x from x0 to x1 (side profiles of sheet parts)
export const EX = (pts, x0, x1, holes = []) => {
  const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  for (const h of holes) s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, {depth: Math.abs(x1 - x0), bevelEnabled: false, curveSegments: 10});
  // shape x→z, y→y, extrude z→x
  g.rotateY(-Math.PI / 2);
  g.translate(Math.max(x0, x1), 0, 0);
  return g;
};
// 2D shape in the (x, y) plane extruded along z from z0 to z1 (plates facing front/back, with holes)
export const EZ = (pts, z0, z1, holes = []) => {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, {depth: Math.abs(z1 - z0), bevelEnabled: false, curveSegments: 16});
  g.translate(0, 0, Math.min(z0, z1));
  return g;
};
// 2D shape in the (x, z) plane extruded along y from y0 to y1 (horizontal plates with holes)
export const EY = (pts, y0, y1, holes = []) => {
  const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const h of holes) s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, {depth: Math.abs(y1 - y0), bevelEnabled: false, curveSegments: 16});
  g.rotateX(-Math.PI / 2);
  g.translate(0, Math.min(y0, y1), 0);
  return g;
};
export const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
export const circleHole = (cx, cy, r) => {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
};
export const rectHole = (x0, y0, x1, y1) => new THREE.Path([new THREE.Vector2(x0, y0), new THREE.Vector2(x0, y1), new THREE.Vector2(x1, y1), new THREE.Vector2(x1, y0)]);
export const slotHole = (cx, cy, len, w) => {
  const p = new THREE.Path();
  const r = w / 2, a = len / 2 - r;
  p.absarc(cx + a, cy, r, -Math.PI / 2, Math.PI / 2, false);
  p.absarc(cx - a, cy, r, Math.PI / 2, Math.PI * 1.5, false);
  return p;
};
// tube along points (cables, wires, rods)
export const TU = (pts, r, seg = 40, radial = 12) => {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'catmullrom', 0.2);
  return new THREE.TubeGeometry(curve, seg, r, radial, false);
};
// rectangular bar along an orthogonal polyline (copper conductors), w across, t thick; 'xw' = width along x
export const BAR = (pts, w, t) => {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1];
    const ext = t / 2;
    if (ay !== by) out.push(B(ax - w / 2, ax + w / 2, Math.min(ay, by) - ext, Math.max(ay, by) + ext, az - t / 2, az + t / 2));
    else if (az !== bz) out.push(B(ax - w / 2, ax + w / 2, ay - t / 2, ay + t / 2, Math.min(az, bz) - ext, Math.max(az, bz) + ext));
    else out.push(B(Math.min(ax, bx) - ext, Math.max(ax, bx) + ext, ay - w / 2, ay + w / 2, az - t / 2, az + t / 2));
  }
  return out;
};
export const spread = (a, b, n) => Array.from({length: n}, (_, i) => a + (b - a) * (n === 1 ? 0.5 : i / (n - 1)));
