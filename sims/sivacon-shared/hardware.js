// The small parts: every bolt, nut, washer, conical spring washer, thread-forming screw, contact finger and cage nut
// on the board, drawn as one InstancedMesh per kind. A builder hangs each instance on a parent Group (the part it
// fastens) with a local position and axis; update() follows the parents through every teardown move, so a joint's
// bolts leave with its link and a door's hinge pins swing with the door. Every instance keeps a record the picker
// reads: the designation, the size and the tightening torque from the operating instructions.
import * as THREE from 'three';
import {TORQUE} from './catalog.js';

const Y = new THREE.Vector3(0, 1, 0);
const q = new THREE.Quaternion();
const m = new THREE.Matrix4();
const s = new THREE.Vector3();
const p = new THREE.Vector3();
const ax = new THREE.Vector3();

// unit geometries, sized for d = 1 and scaled per instance
const head = () => new THREE.CylinderGeometry(0.92, 0.92, 0.65, 6).translate(0, 0.325, 0); // hex head, s ≈ 1.6 d
const shank = () => {
  // thread drawn as a ribbed cylinder: 12 ridges along the unit length so the pitch reads up close
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 12).translate(0, 0.5, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = 1 - 0.08 * (Math.round(y * 12) % 2);
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
};
const nut = () => new THREE.CylinderGeometry(0.92, 0.92, 0.8, 6).translate(0, 0.4, 0);
const washer = () => {
  const g = new THREE.RingGeometry(0.55, 1.05, 18);
  const e = new THREE.ExtrudeGeometry(
    (() => {
      const sh = new THREE.Shape();
      sh.absarc(0, 0, 1.05, 0, Math.PI * 2, false);
      const h = new THREE.Path();
      h.absarc(0, 0, 0.55, 0, Math.PI * 2, true);
      sh.holes.push(h);
      return sh;
    })(),
    {depth: 0.2, bevelEnabled: false, curveSegments: 18},
  );
  g.dispose();
  e.rotateX(-Math.PI / 2);
  return e;
};
// a conical spring washer (DIN 6796), the joint washer of every busbar connection
const spring = () => {
  const g = new THREE.CylinderGeometry(0.62, 1.15, 0.28, 18, 1, true).translate(0, 0.14, 0);
  return g;
};
// a pan-head Torx thread-forming screw for sheets
const pan = () => {
  const g = new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, 0.45, 1);
  return g;
};
// a cage nut / clip nut in the frame's square holes
const cage = () => new THREE.BoxGeometry(1.6, 0.25, 1.6).translate(0, -0.125, 0);
// a contact finger of a withdrawable unit's plug-in contact: a sprung silver-plated tulip
const finger = () => new THREE.BoxGeometry(1, 1, 1);

export const KINDS = {
  head: {geo: head, mat: 'bolt'},
  shank: {geo: shank, mat: 'bolt'},
  nut: {geo: nut, mat: 'bolt'},
  washer: {geo: washer, mat: 'bolt'},
  spring: {geo: spring, mat: 'bolt'},
  pan: {geo: pan, mat: 'bolt'},
  cage: {geo: cage, mat: 'bolt'},
  finger: {geo: finger, mat: 'copperTin'},
};

export function createHardware(M) {
  const items = Object.fromEntries(Object.keys(KINDS).map((k) => [k, []]));
  const recs = [];
  // one record per fastener (the bolt, its washers and its nut share it)
  const rec = (info) => {
    recs.push(info);
    return recs.length - 1;
  };
  const put = (kind, parent, pos, dir, scl, r) => {
    items[kind].push({parent, pos: new THREE.Vector3(...pos), dir: new THREE.Vector3(...dir).normalize(), scl: new THREE.Vector3(...scl), r});
  };
  /**
   * A through-bolted joint: hexagon bolt from `pos` along `dir` (head on pos, shank into the stack), a washer and a
   * conical spring washer under the head, washer, spring washer and nut at `grip` mm.
   */
  const bolt = (parent, pos, dir, d, grip, opts = {}) => {
    const len = opts.len ?? Math.ceil((grip + 0.8 * d + 0.6 * d + 2 * d * 0.3) / 5) * 5;
    const r = rec({kind: 'bolt', title: `Hexagon bolt M${d} × ${len}`, lines: [`ISO 4017 · 8.8 · zinc flake`, `${opts.what || 'Busbar joint'} · grip ${grip} mm`, `Torque ${TORQUE[d] ?? '—'} Nm`], d, len});
    const dv = new THREE.Vector3(...dir).normalize();
    const at = (k) => [pos[0] + dv.x * k, pos[1] + dv.y * k, pos[2] + dv.z * k];
    const back = [-dv.x, -dv.y, -dv.z];
    // head sits outside the stack facing back along -dir
    put('head', parent, at(opts.spring !== false ? -0.48 * d : -0.2 * d), back, [d, d, d], r);
    put('washer', parent, at(0), back, [d, d, d], r);
    if (opts.spring !== false) put('spring', parent, at(-0.2 * d), back, [d, d, d], r);
    put('shank', parent, at(opts.spring !== false ? -0.48 * d : -0.2 * d), dir, [d, len, d], r);
    if (opts.nut !== false) {
      put('washer', parent, at(grip), dir, [d, d, d], r);
      if (opts.spring !== false) put('spring', parent, at(grip + 0.2 * d), dir, [d, d, d], r);
      put('nut', parent, at(grip + (opts.spring !== false ? 0.48 : 0.2) * d), dir, [d, d, d], r);
    }
    return r;
  };
  // a thread-forming pan-head screw into sheet: head only, axis `dir` out of the sheet
  const screw = (parent, pos, dir, d = 6, what = 'Sheet fixing') => {
    const r = rec({kind: 'screw', title: `Thread-forming screw M${d}`, lines: ['Torx T30 · pan head · zinc flake', what, `Torque ${TORQUE[`s${d}`] ?? TORQUE[d]} Nm`], d});
    put('pan', parent, pos, dir, [d * 0.95, d * 0.95, d * 0.95], r);
    return r;
  };
  const cageNut = (parent, pos, dir, d = 6) => {
    const r = rec({kind: 'cage', title: `Cage nut M${d}`, lines: ['Clips into the 25 mm hole grid', 'Spring steel · zinc plated'], d});
    put('cage', parent, pos, dir, [d * 1.1, d, d * 1.1], r);
    return r;
  };
  // a plug-in contact: n fingers side by side along x, gripping a bar edge
  const fingers = (parent, pos, n, pitch, size, info) => {
    const r = rec({kind: 'finger', title: info?.title || 'Plug-in contact', lines: info?.lines || ['Silver-plated copper fingers', 'Spring-loaded, self-aligning']});
    for (let i = 0; i < n; i++) put('finger', parent, [pos[0] + (i - (n - 1) / 2) * pitch, pos[1], pos[2]], [0, 1, 0], size, r);
    return r;
  };

  const meshes = {};
  let root = null;
  const rootInv = new THREE.Matrix4();
  const build = (boardRoot) => {
    root = boardRoot;
    for (const [k, list] of Object.entries(items)) {
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(KINDS[k].geo(), M[KINDS[k].mat], list.length);
      mesh.castShadow = k === 'head' || k === 'nut';
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.userData.hw = k;
      meshes[k] = mesh;
      root.add(mesh);
    }
    update(true);
  };
  const update = () => {
    if (!root) return;
    root.updateMatrixWorld(true);
    rootInv.copy(root.matrixWorld).invert();
    for (const [k, mesh] of Object.entries(meshes)) {
      const list = items[k];
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        let vis = true;
        for (let o = it.parent; o && o !== root; o = o.parent) if (!o.visible) vis = false;
        q.setFromUnitVectors(Y, it.dir);
        s.copy(it.scl);
        if (!vis) s.set(0, 0, 0);
        m.compose(p.copy(it.pos), q, s);
        m.premultiply(it.parent.matrixWorld).premultiply(rootInv);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
  const info = (kind, id) => recs[items[kind]?.[id]?.r];
  const count = () => {
    const c = {};
    for (const r of recs) {
      const key = r.kind === 'bolt' ? `M${r.d} bolt sets` : r.kind === 'screw' ? `M${r.d} sheet screws` : r.kind === 'cage' ? 'Cage nuts' : 'Contact sets';
      c[key] = (c[key] || 0) + 1;
    }
    return c;
  };
  const total = () => Object.values(items).reduce((n, l) => n + l.length, 0);
  const dispose = () => {
    for (const mesh of Object.values(meshes)) {
      mesh.geometry.dispose();
      mesh.removeFromParent();
    }
  };
  return {bolt, screw, cageNut, fingers, build, update, info, count, total, dispose, meshes, recs, items, axis: ax};
}
