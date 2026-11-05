// The part registry: every removable piece of the board is a Group with a record (name, layer, the teardown stage
// it leaves in, the direction and distance it travels, what the picker shows). One input, the teardown position
// x in [0, 1], poses all of them (rule 3): stage k of N runs while x * N goes from k to k + 1, and the parts in a
// stage leave one after another in the order they were registered, the way a fitter would take them off.
import * as THREE from 'three';

// the teardown sequence, front to back and outside in, as the operating instructions take a field apart
export const STAGES = [
  {key: 'doors', label: 'Doors open', sub: 'Door locks released, doors swing 105°'},
  {key: 'covers', label: 'Doors & covers off', sub: 'Hinge pins out, covers unscrewed'},
  {key: 'walls', label: 'Roof & walls off', sub: 'Roof plates, side and rear walls'},
  {key: 'units', label: 'Units withdrawn', sub: 'Breakers and withdrawable units out'},
  {key: 'inner', label: 'Partitions out', sub: 'Compartment partitions, shutters, guides'},
  {key: 'devices', label: 'Connections off', sub: 'Cable connections, distribution bars'},
  {key: 'busbars', label: 'Busbars out', sub: 'Main busbar, joints, supports'},
  {key: 'frame', label: 'Frame apart', sub: 'Profiles, base, floor fixing'},
];
export const NSTAGE = STAGES.length;
export const stageIndex = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};

export function createRegistry() {
  const parts = [];
  // parts leave in turn within their own field and stage
  const perFS = {};
  /**
   * g: the Group; o: {name, layer, stage, dir [x,y,z], dist mm, field, module, lines [], hinge {axis, pivot, angle},
   * open() -> 0..1 a door's own opening, draw() -> mm a unit is drawn out along +z, sub: rides on its parent part
   * without a teardown move of its own (it still has its own record for the picker)}
   * layer is what the visibility toggles switch: enclosure, door, frame, busbar, unit, inner, label
   */
  const add = (g, o) => {
    const st = stageIndex[o.stage] ?? 0;
    const rec = {
      g,
      name: o.name,
      layer: o.layer || 'inner',
      stage: st,
      order: o.sub ? 0 : (perFS[`${o.field ?? -1}|${st}`] = (perFS[`${o.field ?? -1}|${st}`] ?? -1) + 1),
      sub: !!o.sub,
      dir: new THREE.Vector3(...(o.dir || [0, 0, 1])).normalize(),
      dist: o.dist ?? 300,
      field: o.field ?? -1,
      module: o.module ?? -1,
      lines: o.lines || [],
      hinge: o.hinge || null,
      open: o.open || null,
      draw: o.draw || null,
      // an exploded view of the device itself (the 3WL's own teardown): offset [x, y, z] mm and its start 0..0.5
      fly: o.fly ? new THREE.Vector3(...o.fly) : null,
      flyAt: o.flyAt ?? 0,
      openCur: 0,
      drawCur: 0,
      base: g.position.clone(),
      baseQ: g.quaternion.clone(),
      id: parts.length,
    };
    g.userData.part = rec;
    parts.push(rec);
    return rec;
  };
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  /**
   * x: teardown 0..1; scope(field) -> 0..1 how much of the teardown applies to that field (explode one field or all);
   * opts.doors: 0..1 every door's opening outside the teardown; opts.dt eases each door and each unit to its target.
   * Returns how far anything still had to travel, so the caller knows whether the frame changed.
   */
  const pose = (x, scope, opts = {}) => {
    const kz = 1 - Math.exp(-(opts.dt ?? 1) / 0.22);
    let moving = 0;
    for (const r of parts) {
      r.g.position.copy(r.base);
      r.g.quaternion.copy(r.baseQ);
      if (r.draw) {
        const t = r.draw();
        moving += Math.abs(t - r.drawCur);
        r.drawCur += (t - r.drawCur) * kz;
        if (Math.abs(t - r.drawCur) < 0.05) r.drawCur = t;
        r.g.position.z += r.drawCur;
      }
      if (r.fly && opts.fly) {
        const k = smoother((opts.fly(r) - r.flyAt) / (1 - r.flyAt));
        if (k > 0) r.g.position.addScaledVector(r.fly, k);
      }
      if (r.sub) continue;
      const k = scope(r.field);
      const s = x * k * NSTAGE;
      if (r.hinge) {
        // a door: stage 0 swings it on its hinge, its own stage lifts it off forward
        const t = Math.max(smoother(s), opts.doors ?? 0, r.open ? r.open() : 0);
        moving += Math.abs(t - r.openCur);
        r.openCur += (t - r.openCur) * kz;
        if (Math.abs(t - r.openCur) < 1e-3) r.openCur = t;
        q.setFromAxisAngle(r.hinge.axis, r.hinge.angle * r.openCur);
        v.copy(r.g.position).sub(r.hinge.pivot).applyQuaternion(q).add(r.hinge.pivot);
        r.g.position.copy(v);
        r.g.quaternion.premultiply(q);
      }
      // within a stage the parts leave in turn: the stage's window is shared out by registration order
      const n = Math.max(1, (perFS[`${r.field}|${r.stage}`] ?? 0) + 1);
      const lead = Math.min(0.6, 2.4 / n);
      const u = smoother((s - r.stage - (r.order / n) * (1 - lead)) / lead);
      if (u > 0) r.g.position.addScaledVector(r.dir, r.dist * u * (opts.distK ?? 1));
    }
    return moving;
  };
  return {parts, add, pose};
}
