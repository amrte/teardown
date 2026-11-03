// The transformer built from code in millimetres, entirely from one datasheet (trafo.js spec): the chassis with its
// turnable rollers, the corrugated tank, the lid with bushings, tap changer, lifting lugs, thermometer and the vents
// (or the hermetic filler, or a conservator with Buchholz relay and silica-gel breather), and inside the active part:
// a three-limb stepped core, LV and HV windings on every limb, clamping frames, leads and the tap changer; the fluid
// and its natural convection; the oil pan and the seismic kit. update(state) poses it for one operating point.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const PAINT = '#86917f'; // RAL 7033-ish cement grey, as in the manual's photos

// ------------------------------------------------------------------------------------------------ geometry helpers
const lathe = (pts, seg = 40) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
// a closed annulus of height h (inner r0, outer r1), its axis on y, the base at y = 0
const ring = (r0, r1, h, seg = 56) => lathe([[r0, 0], [r1, 0], [r1, h], [r0, h], [r0, 0]], seg);
// a stepped core section: the steps of a limb inside a circle of diameter d, as a polygon in the plane
function steppedShape(d, steps = 6) {
  const R = d / 2;
  const ws = [];
  for (let i = 0; i < steps; i++) {
    const h = R * Math.sin(((i + 1) / (steps + 0.6)) * (Math.PI / 2));
    ws.push([Math.sqrt(R * R - h * h), h]);
  }
  // walk the outline: right half top to bottom then back up the left
  const pts = [];
  for (let i = steps - 1; i >= 0; i--) {
    const [w, h] = ws[i];
    const hPrev = i > 0 ? ws[i - 1][1] : 0;
    pts.push([w, h], [w, hPrev]);
  }
  const right = pts.slice();
  const all = [...right, ...right.slice().reverse().map(([x, y]) => [x, -y])];
  const left = all.map(([x, y]) => [-x, -y]);
  const sh = new THREE.Shape();
  [...all, ...left].forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.closePath();
  return sh;
}
const extrude = (shape, depth, bevel = 0) => {
  const g = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 18});
  g.translate(0, 0, -depth / 2);
  return g;
};
const roundRect = (w, h, r) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};
const canvasTex = (w, h, draw, repeat) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
};

// ------------------------------------------------------------------------------------------------ the build
/** sp: the datasheet (trafo.js spec). Returns the scene root (metres), update(state), anchors for callouts, setCut. */
export function buildTrafo(sp) {
  const cfg = sp.cfg;
  const root = new THREE.Group();
  const T = sp.tank;
  const yT = sp.yTank + (cfg.pan === 'standard' ? 40 : 0) + (cfg.seismic === 'vibrastop' ? 60 : 0);
  const yLid = yT + T.h;
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);

  // ---------------------------------------------------------------- materials
  const std = (color, roughness, metalness, extra = {}) => keep(new THREE.MeshStandardMaterial({color, roughness, metalness, ...extra}));
  const lamTex = keep(canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#5a6067';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      g.fillStyle = y % 8 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.18)';
      g.fillRect(0, y, w, 1.4);
    }
  }, [1, 6]));
  const turnTex = keep(canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#b8743f';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      g.fillStyle = 'rgba(60,25,8,.35)';
      g.fillRect(0, y, w, 1.6);
    }
  }, [6, 5]));
  const M = {
    paint: std(PAINT, 0.62, 0.15, {envMapIntensity: 0.5}),
    base: std(PAINT, 0.62, 0.15, {envMapIntensity: 0.5}),
    dark: std('#30353a', 0.5, 0.3),
    steel: std('#b8bcc1', 0.38, 0.85),
    zinc: std('#c9cdd2', 0.42, 0.8),
    brass: std('#c7a252', 0.3, 0.95),
    copper: std('#c07a42', 0.36, 0.75, {map: turnTex, emissive: new THREE.Color('#ff5a1a'), emissiveIntensity: 0}),
    copperLV: std('#a9673a', 0.4, 0.7, {emissive: new THREE.Color('#ff5a1a'), emissiveIntensity: 0}),
    core: std('#596068', 0.5, 0.55, {map: lamTex, emissive: new THREE.Color('#d6182b'), emissiveIntensity: 0}),
    paper: std('#e6dcc4', 0.75, 0),
    porcelain: keep(new THREE.MeshPhysicalMaterial({color: '#5b2a1e', roughness: 0.25, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.15})),
    plug: std('#b93b2d', 0.45, 0.05),
    black: std('#1d1f22', 0.5, 0.1),
    rubber: std('#26282b', 0.85, 0),
    white: std('#f1efe9', 0.5, 0),
    red: std('#d6182b', 0.5, 0.05),
    cream: std('#e8e2cf', 0.55, 0.05),
    green: std('#6f8f63', 0.55, 0.15),
    alu: std('#d3d6da', 0.35, 0.85, {envMapIntensity: 0.6}),
    silica: keep(new THREE.MeshPhysicalMaterial({color: '#f0a43a', roughness: 0.3, transmission: 0, transparent: true, opacity: 0.85})),
    glass: keep(new THREE.MeshPhysicalMaterial({color: '#ffffff', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.35, depthWrite: false})),
    oil: keep(new THREE.MeshBasicMaterial({color: sp.fluid.colour, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide})),
    flow: keep(new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false})),
    arrow: keep(new THREE.MeshBasicMaterial({color: '#d6182b', transparent: true, opacity: 0.95, depthWrite: false})),
    capCore: std('#9aa1a8', 0.55, 0.3, {map: keep(canvasTex(256, 32, (g, w, h) => {
      g.fillStyle = '#7c838b';
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 3) {
        g.fillStyle = x % 6 ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.22)';
        g.fillRect(x, 0, 1, h);
      }
    }, [8, 1])), side: THREE.DoubleSide}),
    capCu: std('#c47b40', 0.4, 0.6, {map: keep(canvasTex(32, 256, (g, w, h) => {
      g.fillStyle = '#c47b40';
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 5) {
        g.fillStyle = 'rgba(70,30,10,.4)';
        g.fillRect(0, y, w, 1);
      }
    }, [1, 8])), side: THREE.DoubleSide, emissive: new THREE.Color('#ff5a1a'), emissiveIntensity: 0}),
  };
  // the see-through twins of the tank parts for the glass cutaway
  const GHOST = keep(new THREE.MeshPhysicalMaterial({color: '#dfe6dc', roughness: 0.2, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide}));
  const GHOST_EDGE = keep(new THREE.MeshBasicMaterial({color: '#7d8a78', transparent: true, opacity: 0.22, depthWrite: false}));
  const add = (parent, geo, mat, cast = true) => {
    keep(geo);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const at = (m, x, y, z) => (m.position.set(x, y, z), m);

  // the groups the subsystem views and the cutaway work on
  const G = {};
  for (const k of ['base', 'tank', 'lid', 'active', 'core', 'windings', 'leads', 'oil', 'flow', 'pan', 'seismic', 'caps', 'arrows'])
    root.add((G[k] = new THREE.Group()));
  // the lid, its fittings and the active part hang together: they lift out as one ("untanking")
  const lift = new THREE.Group();
  root.add(lift);
  lift.add(G.lid, G.active, G.leads, G.caps, G.arrows);
  G.active.add(G.core, G.windings);
  const anchors = {};

  // ---------------------------------------------------------------- chassis and rollers [37]
  const ch = sp.chassis;
  const wr = ch.wheel.d / 2;
  const skidY = yT - ch.h;
  const wheelZ = ch.len / 2 - 110;
  const wheels = [];
  for (const sx of [-1, 1]) {
    const x = (sx * ch.gauge) / 2;
    // a U channel: web and two flanges, open outward
    add(G.base, new THREE.BoxGeometry(10, ch.h, ch.len), M.base).position.set(x - sx * 30, skidY + ch.h / 2, 0);
    for (const fy of [skidY + 5, yT - 5]) add(G.base, new THREE.BoxGeometry(70, 10, ch.len), M.base).position.set(x, fy, 0);
    for (const sz of [-1, 1]) {
      const w = new THREE.Group();
      w.position.set(x, 0, sz * wheelZ);
      G.base.add(w);
      const fork = new THREE.Group();
      w.add(fork);
      add(fork, new THREE.BoxGeometry(ch.wheel.w + 36, 12, 110), M.base).position.y = skidY - 6;
      for (const s of [-1, 1]) add(fork, new THREE.BoxGeometry(8, skidY - wr + 20, 70), M.base).position.set(s * (ch.wheel.w / 2 + 12), (skidY + wr - 20) / 2 + 2, 0);
      const wheel = add(fork, new THREE.CylinderGeometry(wr, wr, ch.wheel.w, 36), M.base);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.y = wr;
      add(fork, new THREE.CylinderGeometry(14, 14, ch.wheel.w + 30, 16), M.steel).rotation.z = Math.PI / 2;
      fork.children[fork.children.length - 1].position.y = wr;
      // the rollers face front: axle along x, so the unit rolls along z; turned 90° they roll along x [37]
      fork.rotation.y = Math.PI / 2;
      wheels.push({w, fork, sx, sz});
    }
  }
  anchors.roller = [ch.gauge / 2, wr, wheelZ + 30];

  // ---------------------------------------------------------------- the tank with its cooling waves [36]
  const li = T.li;
  const bi = T.bi;
  const wall = 6;
  const tankParts = [];
  const tankMesh = (geo, mat = M.paint) => {
    const m = add(G.tank, geo, mat);
    tankParts.push(m);
    return m;
  };
  // floor and four walls
  at(tankMesh(new THREE.BoxGeometry(li + 2 * wall, 12, bi + 2 * wall)), 0, yT + 6, 0);
  for (const sz of [-1, 1]) at(tankMesh(new THREE.BoxGeometry(li + 2 * wall, T.h, wall)), 0, yT + T.h / 2, sz * (bi / 2 + wall / 2));
  for (const sx of [-1, 1]) at(tankMesh(new THREE.BoxGeometry(wall, T.h, bi)), sx * (li / 2 + wall / 2), yT + T.h / 2, 0);
  // the top and bottom frames over the waves
  const frameH = 60;
  for (const fy of [yT + frameH / 2, yLid - frameH / 2 - 4]) {
    for (const sz of [-1, 1]) at(tankMesh(new THREE.BoxGeometry(T.l, frameH, T.fin + wall)), 0, fy, sz * (bi / 2 + (T.fin + wall) / 2));
    for (const sx of [-1, 1]) at(tankMesh(new THREE.BoxGeometry(T.fin + wall, frameH, bi)), sx * (li / 2 + (T.fin + wall) / 2), fy, 0);
  }
  // the waves: thin plates standing out of every wall, one instanced mesh
  const finH = T.h - 2 * frameH - 8;
  const finY = yT + frameH + finH / 2 + 4;
  const finSpots = [];
  const along = (len, pitch) => {
    const n = Math.floor((len - 60) / pitch);
    return Array.from({length: n}, (_, i) => -((n - 1) * pitch) / 2 + i * pitch);
  };
  for (const sz of [-1, 1]) for (const x of along(li, T.finPitch)) finSpots.push({x, z: sz * (bi / 2 + wall + T.fin / 2), ry: 0});
  for (const sx of [-1, 1]) for (const z of along(bi, T.finPitch)) finSpots.push({x: sx * (li / 2 + wall + T.fin / 2), z, ry: Math.PI / 2});
  const finGeo = keep(new THREE.BoxGeometry(10, finH, T.fin + 2));
  {
    // round the outer edge of every wave a little: pull the outer corners in
    const p = finGeo.attributes.position;
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getZ(i)) > T.fin / 2) p.setX(i, p.getX(i) * 0.55 * (p.getZ(i) > 0 ? 1 : 1));
    finGeo.computeVertexNormals();
  }
  const fins = new THREE.InstancedMesh(finGeo, M.paint, finSpots.length);
  fins.castShadow = true;
  fins.receiveShadow = true;
  G.tank.add(fins);
  tankParts.push(fins);
  const finM = new THREE.Matrix4();
  const finQ = new THREE.Quaternion();
  const setFins = (bulge) => {
    finSpots.forEach((f, i) => {
      // the long-side waves stand along z, the short-side ones along x
      finQ.setFromAxisAngle(new V3(0, 1, 0), f.ry === 0 ? 0 : Math.PI / 2);
      const zSide = f.ry === 0;
      finM.compose(new V3(f.x, finY, f.z), finQ, new V3(bulge, 1, 1));
      void zSide;
      fins.setMatrixAt(i, finM);
    });
    fins.instanceMatrix.needsUpdate = true;
  };
  setFins(1);
  anchors.tank = [li / 2 + wall + T.fin, yT + T.h * 0.45, bi / 4];
  // the rating plate on its bracket in front of the waves [10]
  const plateTex = keep(canvasTex(200, 260, (g, w, h) => {
    g.fillStyle = '#e9ecef';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2b4fd8';
    g.fillRect(10, 30, w - 20, 10);
    for (let r = 0; r < 9; r++) {
      g.fillRect(10, 52 + r * 13, 74, 8);
      g.fillRect(90, 52 + r * 13, 20, 8);
      g.fillRect(118, 52 + r * 13, 50, 8);
      g.fillRect(172, 52 + r * 13, 18, 8);
    }
    g.fillRect(10, 175, w - 20, 75);
    g.fillStyle = '#16181b';
    g.font = '600 15px Inter, sans-serif';
    g.fillText(`${sp.S} kVA`, 12, 22);
    g.font = '500 11px Inter, sans-serif';
    g.fillText(`${cfg.hv} kV / 400 V  ${cfg.vector}`, 84, 22);
    g.fillStyle = '#fff';
    g.font = '600 12px Inter, sans-serif';
    g.fillText(`uk ${sp.uk.toFixed(1)} %   P0 ${sp.p0} W`, 18, 200);
    g.fillText(`Pk ${sp.pk} W   ${sp.fluid.short}`, 18, 220);
    g.fillText(`${sp.mass} kg   ${sp.oilL} l`, 18, 240);
  }));
  const plateW = 190;
  const plateH = 245;
  const plate = add(G.tank, new THREE.PlaneGeometry(plateW, plateH), std('#ffffff', 0.4, 0.2, {map: plateTex}), false);
  at(plate, 140, yT + T.h * 0.62, bi / 2 + wall + T.fin + 14);
  tankParts.push(plate);
  at(tankMesh(new THREE.BoxGeometry(plateW + 12, plateH + 12, 6), M.zinc), 140, yT + T.h * 0.62, bi / 2 + wall + T.fin + 9);
  anchors.plate = [140 + plateW / 2, yT + T.h * 0.62, bi / 2 + wall + T.fin + 14];
  // the drain valve and the low earth terminal [37]
  const drain = at(add(G.tank, new THREE.CylinderGeometry(26, 26, 70, 20), M.paint), -li / 2 + 120, yT + 70, bi / 2 + wall + 35);
  drain.rotation.x = Math.PI / 2;
  at(add(G.tank, new THREE.CylinderGeometry(30, 30, 18, 6), M.paint), -li / 2 + 120, yT + 70, bi / 2 + wall + 72).rotation.x = Math.PI / 2;
  anchors.drain = [-li / 2 + 120, yT + 70, bi / 2 + wall + 80];
  const earthLow = at(add(G.tank, new THREE.CylinderGeometry(12, 12, 50, 12), M.zinc), li / 2 - 130, yT + 40, bi / 2 + wall + 25);
  earthLow.rotation.x = Math.PI / 2;
  at(add(G.tank, new THREE.CylinderGeometry(19, 19, 12, 6), M.zinc), li / 2 - 130, yT + 40, bi / 2 + wall + 50).rotation.x = Math.PI / 2;
  anchors.earth = [li / 2 - 130, yT + 40, bi / 2 + wall + 56];

  // the terminal box for the monitoring contacts (datasheet option "Anschlusskasten"; size and place est.)
  if (cfg.devices?.includes('terminalbox')) {
    const tb = at(new THREE.Group(), li / 2 + wall + T.fin + 70, yLid - 260, -bi * 0.15);
    G.tank.add(tb);
    add(tb, new THREE.BoxGeometry(140, 220, 160), M.paint);
    add(tb, new THREE.BoxGeometry(6, 200, 140), M.zinc).position.x = 72;
    add(tb, new THREE.BoxGeometry(140, 10, 20), M.paint).position.set(-70, 0, 0);
    for (const z of [-40, 0, 40]) add(tb, new THREE.CylinderGeometry(10, 10, 30, 10), M.black).position.set(0, -125, z);
    anchors.terminalbox = [li / 2 + wall + T.fin + 145, yLid - 260, -bi * 0.15];
  }

  // ---------------------------------------------------------------- the lid and its fittings [36][37]
  const lidW = T.l - 30;
  const lidB = T.b - 30;
  const lidT = 10;
  at(add(G.lid, new THREE.BoxGeometry(lidW, lidT, lidB), M.paint), 0, yLid + lidT / 2, 0);
  const lidParts = [G.lid.children[0]];
  // bolts round the rim
  {
    const spots = [];
    const nx = Math.round(lidW / 150);
    const nz = Math.round(lidB / 150);
    for (let i = 0; i <= nx; i++) for (const s of [-1, 1]) spots.push([-lidW / 2 + 25 + (i * (lidW - 50)) / nx, s * (lidB / 2 - 25)]);
    for (let i = 1; i < nz; i++) for (const s of [-1, 1]) spots.push([s * (lidW / 2 - 25), -lidB / 2 + 25 + (i * (lidB - 50)) / nz]);
    const bg = keep(new THREE.CylinderGeometry(9, 9, 10, 6));
    const bolts = new THREE.InstancedMesh(bg, M.zinc, spots.length);
    spots.forEach(([x, z], i) => bolts.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, yLid + lidT + 5, z)));
    G.lid.add(bolts);
    lidParts.push(bolts);
  }
  const yTop = yLid + lidT;
  anchors.lid = [-lidW / 2 + 60, yTop, lidB / 2 - 40];
  const S20 = sp.un1 / 20;
  // HV bushings: three in a row along x on the front half of the lid (as in the manual's lid drawing [14])
  const hvZ = bi * 0.2;
  const hvGap = Math.max(170, Math.min(320, li * 0.2));
  const hvX = [-hvGap, 0, hvGap].map((x) => x - li * 0.06);
  const hvTops = [];
  for (const x of hvX) {
    const b = new THREE.Group();
    b.position.set(x, yTop, hvZ);
    G.lid.add(b);
    add(b, new THREE.CylinderGeometry(62, 62, 14, 32), M.zinc).position.y = 7;
    if (cfg.hvBushing === 'plugin') {
      // the outer-cone part (EN 50180) under its plug: a red cone and a black elbow connector
      add(b, lathe([[0, 14], [44, 14], [44, 34], [34, 40], [24, 120], [16, 130], [0, 130]], 32), M.plug);
      add(b, new THREE.CylinderGeometry(30, 34, 70, 24), M.black).position.y = 160;
      const elbow = add(b, new THREE.CylinderGeometry(24, 24, 120, 20), M.black);
      elbow.rotation.z = Math.PI / 2;
      elbow.position.set(-50, 190, 0);
      hvTops.push([x, yTop + 150, hvZ]);
    } else {
      // porcelain with sheds, height by the voltage class
      const h = Math.round(230 + 160 * S20);
      const pts = [[0, 14], [40, 14], [40, 40]];
      const sheds = Math.max(3, Math.round(h / 70));
      for (let i = 0; i < sheds; i++) {
        const y0 = 40 + ((h - 70) * i) / sheds;
        const dy = (h - 70) / sheds;
        pts.push([30, y0 + dy * 0.15], [62, y0 + dy * 0.45], [60, y0 + dy * 0.6], [30, y0 + dy * 0.75]);
      }
      pts.push([28, h - 30], [22, h], [0, h]);
      add(b, lathe(pts, 32), M.porcelain);
      add(b, new THREE.CylinderGeometry(9, 9, 60, 12), M.brass).position.y = h + 30;
      add(b, new THREE.CylinderGeometry(20, 20, 26, 6), M.brass).position.y = h + 10;
      hvTops.push([x, yTop + h, hvZ]);
    }
  }
  anchors.hv = [hvX[2], hvTops[2][1], hvZ];
  // LV bushings: four in a row at the back, or eight in two point-symmetric rows for low radiation [14]
  const lvZ = -bi * 0.22;
  const lvTops = [];
  const lvH = 150 + Math.min(80, sp.lvBushA / 40);
  const stud = clamp(8 + sp.lvBushA / 120, 10, 30);
  const lvRows = sp.lowrad ? [lvZ + 55, lvZ - 55] : [lvZ];
  const lvGap = Math.max(140, Math.min(240, li * 0.15));
  const lvNames = sp.lowrad ? [['2U', '2V', '2W', '2N'], ['2N', '2W', '2V', '2U']] : [['2U', '2V', '2W', '2N']];
  const PH_COL = {'2U': '#2d64b8', '2V': '#c8352b', '2W': '#1d1f22', '2N': '#3fa59a'};
  lvRows.forEach((z, row) => {
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * lvGap + li * 0.04;
      const b = new THREE.Group();
      b.position.set(x, yTop, z);
      G.lid.add(b);
      add(b, new THREE.CylinderGeometry(55, 55, 12, 6), M.zinc).position.y = 6;
      add(b, lathe([[0, 12], [42, 12], [42, 30], [30, 36], [52, 62], [50, 72], [30, 78], [46, 100], [44, 110], [26, 118], [24, lvH - 40], [0, lvH - 40]], 32), M.porcelain);
      add(b, new THREE.CylinderGeometry(stud, stud, 80, 16), M.brass).position.y = lvH;
      add(b, new THREE.CylinderGeometry(stud * 1.8, stud * 1.8, 18, 6), M.brass).position.y = lvH - 26;
      if (sp.lowrad) add(b, new THREE.CylinderGeometry(stud * 1.9, stud * 1.9, 6, 20), std(PH_COL[lvNames[row][i]], 0.5, 0.1)).position.y = lvH - 40;
      if (cfg.lvFlags) {
        // the connection flag: a copper plate with four holes clamped on the stud [39]
        const flag = add(b, new THREE.BoxGeometry(14, 120, Math.max(60, stud * 4)), M.copperLV);
        flag.position.set(stud + 8, lvH + 60, 0);
      }
      lvTops.push([x, yTop + lvH, z]);
    }
  });
  anchors.lv = lvTops[sp.lowrad ? 3 : 3];
  // the tap changer knob(s) [37], or the ECOTAP drive [18]
  const tapX = li * 0.3;
  const tapZ = bi * 0.02;
  const knob = new THREE.Group();
  knob.position.set(tapX, yTop, tapZ);
  G.lid.add(knob);
  let tapDial = null;
  let ecotapDrive = null;
  if (!sp.oltc) {
    add(knob, new THREE.CylinderGeometry(58, 62, 34, 8), M.black).position.y = 17;
    tapDial = new THREE.Group();
    tapDial.position.y = 34;
    knob.add(tapDial);
    add(tapDial, new THREE.CylinderGeometry(30, 34, 52, 10), M.red).position.y = 26;
    add(tapDial, new THREE.BoxGeometry(10, 20, 54), M.red).position.set(0, 50, 18);
    // one stud per position round the base (5 standard, the datasheet's count otherwise)
    for (let p = 0; p < sp.positions; p++) {
      const a = (-60 + (p * 120) / (sp.positions - 1)) * D2R;
      add(knob, new THREE.CylinderGeometry(5, 5, 6, 8), M.white).position.set(Math.sin(a) * 50, 37, Math.cos(a) * 50);
    }
    if (cfg.hv === '10/20') {
      // the second knob: HV level I / II [37]
      const k2 = new THREE.Group();
      k2.position.set(tapX - 150, yTop, tapZ);
      G.lid.add(k2);
      add(k2, new THREE.CylinderGeometry(52, 56, 30, 8), M.black).position.y = 15;
      add(k2, new THREE.CylinderGeometry(26, 30, 46, 10), M.red).position.y = 52;
    }
  } else {
    // ECOTAP VPD motor drive on the lid [18]
    // the motor-drive housing on its cover flange, as in MR's Figure 2 (6107891 p.19); proportions est.
    ecotapDrive = new THREE.Group();
    ecotapDrive.position.set(tapX - 20, yTop, -5);
    G.lid.add(ecotapDrive);
    add(ecotapDrive, new THREE.BoxGeometry(230, 12, 112), M.zinc).position.y = 6;
    add(ecotapDrive, extrude(roundRect(200, 100, 26), 92, 3).rotateX(Math.PI / 2).translate(0, 0, 0), M.dark).position.y = 58;
    add(ecotapDrive, new THREE.BoxGeometry(150, 6, 70), std('#3b4046', 0.5, 0.3)).position.y = 106;
    add(ecotapDrive, new THREE.BoxGeometry(120, 26, 2), M.white).position.set(0, 66, 47.5);
    const gland = add(ecotapDrive, new THREE.CylinderGeometry(12, 12, 40, 12), M.black);
    gland.rotation.z = Math.PI / 2;
    gland.position.set(118, 58, 0);
  }
  anchors.tap = [tapX, yTop + 90, tapZ];
  // lifting lugs, lashing eyes [40]
  const lugShape = (w, h, r) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h - w / 2);
    s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
    s.lineTo(-w / 2, 0);
    const hole = new THREE.Path();
    hole.absarc(0, h - w / 2, r, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return s;
  };
  const lugGeo = extrude(lugShape(120, 150, 30), 16, 2);
  for (const sx of [-1, 1]) at(add(G.lid, lugGeo.clone(), M.paint), sx * (li / 2 - 80), yTop, 0);
  anchors.lug = [li / 2 - 80, yTop + 150, 0];
  const eyeGeo = extrude(lugShape(60, 70, 16), 12, 1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const e = at(add(G.lid, eyeGeo.clone(), M.paint), sx * (lidW / 2 - 10), yLid - 40, sz * (lidB / 2 + 6));
    e.rotation.x = sz * 1.2;
  }
  anchors.lash = [lidW / 2 - 10, yLid - 10, lidB / 2 + 20];
  // the lid earth terminal [37]
  at(add(G.lid, new THREE.CylinderGeometry(12, 12, 40, 12), M.zinc), -li / 2 + 60, yTop + 20, bi / 2 - 60);

  // the thermometer with its drag pointer [38]
  const th = new THREE.Group();
  // with the ECOTAP drive on the lid centre line the thermometer moves to the front corner, clear of it
  const thZ = sp.oltc ? bi * 0.3 : -bi * 0.02;
  th.position.set(li / 2 - 170, yTop, thZ);
  G.lid.add(th);
  add(th, new THREE.CylinderGeometry(22, 26, 30, 6), M.brass).position.y = 15;
  add(th, new THREE.CylinderGeometry(10, 10, 110, 12), M.brass).position.y = 85;
  const dial = new THREE.Group();
  dial.position.y = 190;
  dial.rotation.y = 0.35;
  th.add(dial);
  const dialR = 62;
  add(dial, new THREE.CylinderGeometry(dialR, dialR, 34, 40), M.zinc).rotation.x = Math.PI / 2;
  const faceTex = keep(canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#fbfaf6';
    g.fillRect(0, 0, w, w);
    g.translate(w / 2, w / 2);
    // 0…100 °C over 270° (the R&S thermometer's range, KD-00215)
    for (let v = 0; v <= 100; v += 5) {
      const a = (-135 + (v / 100) * 270) * D2R;
      const big = v % 20 === 0;
      g.strokeStyle = v >= 85 ? '#d6182b' : '#222';
      g.lineWidth = big ? 3 : 1.4;
      g.beginPath();
      g.moveTo(Math.sin(a) * 100, -Math.cos(a) * 100);
      g.lineTo(Math.sin(a) * (big ? 82 : 90), -Math.cos(a) * (big ? 82 : 90));
      g.stroke();
      if (big) {
        g.fillStyle = '#222';
        g.font = '600 17px Inter, sans-serif';
        g.textAlign = 'center';
        g.fillText(String(v), Math.sin(a) * 66, -Math.cos(a) * 66 + 6);
      }
    }
    g.font = '600 15px Inter, sans-serif';
    g.fillText('°C', 0, 48);
  }));
  at(add(dial, new THREE.CircleGeometry(dialR - 6, 48), std('#ffffff', 0.5, 0, {map: faceTex}), false), 0, 0, 17.5);
  const needle = new THREE.Group();
  needle.position.z = 20;
  dial.add(needle);
  add(needle, new THREE.BoxGeometry(4, dialR - 14, 2), M.black, false).position.y = (dialR - 14) / 2 - 6;
  const drag = new THREE.Group();
  drag.position.z = 19;
  dial.add(drag);
  add(drag, new THREE.BoxGeometry(4, dialR - 18, 1.5), M.red, false).position.y = (dialR - 18) / 2 - 2;
  add(dial, new THREE.CylinderGeometry(6, 6, 4, 12), M.black, false).rotation.x = Math.PI / 2;
  dial.children[dial.children.length - 1].position.z = 22;
  anchors.thermo = [li / 2 - 170, yTop + 190, thZ + 40];
  if (cfg.monitor === 'pt100') {
    const pt = at(new THREE.Group(), li / 2 - 170, yTop, -bi * 0.36);
    G.lid.add(pt);
    add(pt, new THREE.CylinderGeometry(10, 10, 60, 12), M.steel).position.y = 30;
    add(pt, new THREE.CylinderGeometry(36, 36, 50, 20), M.alu).position.y = 85;
    add(pt, new THREE.CylinderGeometry(12, 12, 40, 12), M.alu).position.set(40, 85, 0);
    pt.children[pt.children.length - 1].rotation.z = Math.PI / 2;
  }
  if (cfg.monitor === 'level') {
    const lv = at(new THREE.Group(), -li / 2 + 170, yTop, -bi * 0.3);
    G.lid.add(lv);
    add(lv, new THREE.CylinderGeometry(34, 34, 30, 6), M.brass).position.y = 15;
    add(lv, new THREE.CylinderGeometry(24, 24, 40, 16), M.dark).position.y = 50;
    levelCap = add(lv, new THREE.BoxGeometry(30, 6, 8), M.red);
    levelCap.position.y = 72;
    anchors.level = [-li / 2 + 170, yTop + 80, -bi * 0.3];
  }

  // vents / filler / full protection / conservator [37][38][39]
  const ventX = -li / 2 + 170;
  let dipstick = null;
  let conservatorLevel = null;
  let buchholz = null;
  let silica = null;
  let dgptGas = null;
  let buchGas = null;
  let levelCap = null;
  let prvCap = null;
  if (cfg.design === 'breathing') {
    for (const [x, z] of [[ventX, bi * 0.22], [ventX + 0, -bi * 0.05]]) {
      const v = at(new THREE.Group(), x, yTop, z);
      G.lid.add(v);
      add(v, new THREE.CylinderGeometry(34, 38, 50, 20), M.paint).position.y = 25;
      add(v, new THREE.CylinderGeometry(56, 52, 40, 20), M.paint).position.y = 68;
      add(v, new THREE.CylinderGeometry(42, 56, 18, 20), M.paint).position.y = 96;
    }
    // the wooden dipstick, drawn half out of its vent for the level check
    dipstick = new THREE.Group();
    dipstick.position.set(ventX, yTop, -bi * 0.05);
    G.lid.add(dipstick);
    add(dipstick, new THREE.CylinderGeometry(11, 11, 300, 12), std('#c99a5b', 0.6, 0)).position.y = 150;
    add(dipstick, new THREE.TorusGeometry(15, 3, 6, 20), M.black).rotation.x = Math.PI / 2;
    dipstick.children[1].position.y = 250;
    dipstick.visible = false;
    anchors.vent = [ventX, yTop + 110, bi * 0.22];
  } else if (cfg.design === 'hermetic') {
    const f = at(new THREE.Group(), ventX, yTop, bi * 0.18);
    G.lid.add(f);
    add(f, new THREE.CylinderGeometry(40, 40, 260, 24), M.paint).position.y = 130;
    add(f, new THREE.CylinderGeometry(48, 48, 40, 24), M.paint).position.y = 270;
    add(f, new THREE.PlaneGeometry(70, 90), M.red, false).position.set(0, 150, 41);
    anchors.vent = [ventX, yTop + 270, bi * 0.18];
    if (cfg.monitor === 'full') {
      // the DGPT full protection: cream body, dial, gas window [38]
      const d = at(new THREE.Group(), ventX + 30, yTop, -bi * 0.2);
      G.lid.add(d);
      add(d, new THREE.CylinderGeometry(22, 22, 70, 16), M.steel).position.y = 35;
      add(d, new THREE.BoxGeometry(130, 210, 90), M.cream).position.y = 175;
      add(d, new THREE.CylinderGeometry(38, 38, 10, 32), M.white).position.set(10, 220, 46);
      d.children[d.children.length - 1].rotation.x = Math.PI / 2;
      add(d, new THREE.CylinderGeometry(20, 20, 80, 16), M.glass).position.set(-48, 160, 30);
      // the gas collecting at the top of the window, filling it downward
      dgptGas = new THREE.Group();
      dgptGas.position.set(-48, 200, 30);
      d.add(dgptGas);
      add(dgptGas, new THREE.CylinderGeometry(17, 17, 1, 16), keep(new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.85})), false).position.y = -0.5;
      anchors.dgpt = [ventX + 30, yTop + 260, -bi * 0.2];
      // the pressure relief valve beside it (hermetic option, p.12)
      const prv = at(new THREE.Group(), -li * 0.12, yTop, -bi * 0.4);
      G.lid.add(prv);
      add(prv, new THREE.CylinderGeometry(34, 38, 40, 20), M.steel).position.y = 20;
      prvCap = new THREE.Group();
      prvCap.position.y = 40;
      prv.add(prvCap);
      add(prvCap, new THREE.CylinderGeometry(44, 44, 18, 24), M.red).position.y = 9;
      add(prvCap, new THREE.CylinderGeometry(8, 8, 30, 10), M.steel).position.y = 30;
      anchors.prv = [-li * 0.12, yTop + 80, -bi * 0.4];
    }
  } else {
    // conservator: a drum across the lid on two brackets, a pipe with the Buchholz relay, a silica-gel breather
    const cr = Math.round(110 + sp.S / 40);
    const cl = Math.round(Math.min(bi + 2 * T.fin, 420 + sp.S / 4));
    const cy = sp.consTop ? sp.consTop - cr : yTop + 380;
    const rise = cy - yTop;
    const cx = ventX - 20;
    const c = at(new THREE.Group(), cx, cy, 0);
    G.lid.add(c);
    const drum = add(c, new THREE.CylinderGeometry(cr, cr, cl, 40), M.paint);
    drum.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) add(c, new THREE.SphereGeometry(cr, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.paint).rotation.x = (s * Math.PI) / 2;
    c.children[1].position.z = cl / 2;
    c.children[2].position.z = -cl / 2;
    c.children[1].scale.y = 0.18;
    c.children[2].scale.y = 0.18;
    for (const s of [-1, 1]) add(c, new THREE.BoxGeometry(14, rise - cr + 20, 90), M.paint).position.set(0, -rise / 2 - cr / 2 + 10, s * cl * 0.32);
    // level gauge on the drum end
    add(c, new THREE.CylinderGeometry(40, 40, 16, 24), M.white).position.set(0, 0, cl / 2 + cr * 0.18 + 6);
    c.children[c.children.length - 1].rotation.x = Math.PI / 2;
    conservatorLevel = new THREE.Group();
    conservatorLevel.position.set(0, 0, cl / 2 + cr * 0.18 + 16);
    c.add(conservatorLevel);
    add(conservatorLevel, new THREE.BoxGeometry(4, 30, 2), M.black, false).position.y = 13;
    // the pipe down to the lid with the Buchholz relay in it [43]
    // the pipe from the drum down to the lid, the Buchholz relay half way along it [43]
    const pA = new V3(cx + cr * 0.55, cy - cr * 0.75, 0);
    const pB = new V3(cx + 300, yTop, 0);
    const pD = pB.clone().sub(pA);
    const pipe = add(G.lid, new THREE.CylinderGeometry(22, 22, pD.length(), 16), M.paint);
    pipe.position.copy(pA).add(pB).multiplyScalar(0.5);
    pipe.quaternion.setFromUnitVectors(new V3(0, 1, 0), pD.clone().normalize());
    if (cfg.monitor === 'buchholz') {
      const bm = pA.clone().lerp(pB, 0.5);
      buchholz = at(new THREE.Group(), bm.x, bm.y, 0);
      buchholz.quaternion.setFromUnitVectors(new V3(1, 0, 0), pD.clone().normalize());
      G.lid.add(buchholz);
      add(buchholz, new THREE.BoxGeometry(150, 130, 120), M.green).position.y = 0;
      add(buchholz, new THREE.BoxGeometry(110, 50, 100), M.green).position.y = 85;
      add(buchholz, new THREE.CylinderGeometry(18, 18, 6, 16), M.glass).position.set(0, 0, 62);
      buchholz.children[2].rotation.x = Math.PI / 2;
      buchGas = add(buchholz, new THREE.CircleGeometry(16, 20), keep(new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.9})), false);
      buchGas.position.set(0, 0, 65.5);
      add(buchholz, new THREE.CylinderGeometry(9, 9, 46, 12), M.steel).position.set(30, 130, 0);
      anchors.buchholz = [bm.x, bm.y + 60, 60];
    }
    // the silica-gel breather hanging off the drum [39]
    silica = at(new THREE.Group(), cx - cr - 60, yTop + 120, cl * 0.2);
    G.lid.add(silica);
    add(silica, new THREE.CylinderGeometry(12, 12, 260, 12), M.steel).position.y = 230;
    add(silica, new THREE.CylinderGeometry(58, 58, 18, 24), M.zinc).position.y = 190;
    add(silica, new THREE.CylinderGeometry(52, 52, 150, 24), M.silica).position.y = 105;
    add(silica, new THREE.CylinderGeometry(58, 58, 18, 24), M.zinc).position.y = 22;
    add(silica, new THREE.CylinderGeometry(40, 30, 40, 20), M.glass).position.y = -6;
    anchors.vent = [cx, cy + cr, 0];
    anchors.conservator = [cx, cy + cr * 0.6, cl / 2];
    anchors.silica = [cx - cr - 60, yTop + 150, cl * 0.2 + 52];
  }

  // ---------------------------------------------------------------- the active part [13][14]
  const C = sp.core;
  const cy0 = yT + 60; // bottom of the lower yoke
  const yokeH = Math.round(C.d * 0.92);
  const limbY0 = cy0 + yokeH;
  const limbY1 = limbY0 + C.window;
  const limbX = [-C.pitch, 0, C.pitch];
  const amorph = sp.amorph;
  const coreParts = [];
  const limbs = limbX.map((x) => {
    const g = extrude(steppedShape(C.d), C.window + 2);
    g.rotateX(Math.PI / 2);
    const m = add(G.core, g, M.core.clone());
    m.position.set(x, (limbY0 + limbY1) / 2, 0);
    coreParts.push(m);
    return m;
  });
  const yokeLen = 2 * C.pitch + C.d * (amorph ? 1.25 : 1.0);
  const yokes = [cy0 + yokeH / 2, limbY1 + yokeH / 2].map((y) => {
    const g = extrude(steppedShape(C.d * 0.98), yokeLen, amorph ? 0 : 0);
    g.rotateY(Math.PI / 2);
    g.scale(1, yokeH / (C.d * 0.98), 1);
    const m = add(G.core, g, M.core.clone());
    m.position.set(0, y, 0);
    coreParts.push(m);
    return m;
  });
  if (amorph) for (const m of coreParts) m.material.color.set('#8c939b');
  // clamping frames: steel channels along both yokes, front and back, and tie rods
  const clampMat = std('#4f5b66', 0.55, 0.35);
  for (const y of [cy0 + yokeH / 2, limbY1 + yokeH / 2]) {
    for (const s of [-1, 1]) {
      add(G.core, new THREE.BoxGeometry(yokeLen + 80, yokeH + 30, 10), clampMat).position.set(0, y, s * (C.d / 2 + 12));
      add(G.core, new THREE.BoxGeometry(yokeLen + 80, 10, 50), clampMat).position.set(0, y + (yokeH + 30) / 2 - 5, s * (C.d / 2 + 37));
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(G.core, new THREE.CylinderGeometry(8, 8, limbY1 - cy0 + 40, 10), M.steel).position.set(sx * (yokeLen / 2 + 20), (cy0 + limbY1 + yokeH) / 2, sz * (C.d / 2 + 30));
  }
  anchors.core = [C.pitch + C.d / 2, limbY1 + yokeH * 0.5, C.d / 2 + 40];
  // windings: LV inside, HV outside, a cooling duct between, the screen if fitted
  const Wd = sp.coil;
  const coilY = limbY0 + (C.window - Wd.h) / 2;
  const coils = limbX.map((x) => {
    const g = new THREE.Group();
    g.position.set(x, coilY, 0);
    G.windings.add(g);
    const lv = add(g, ring(Wd.lvR[0], Wd.lvR[1], Wd.h, 48), M.copperLV.clone());
    const hv = add(g, ring(Wd.hvR[0], Wd.hvR[1], Wd.h - 20, 56), M.copper.clone());
    hv.position.y = 10;
    // spacer sticks in the duct, end rings of pressboard
    for (const y of [-14, Wd.h]) add(g, ring(Wd.lvR[0] - 4, Wd.hvR[1] + 4, 14, 48), M.paper).position.y = y;
    let screen = null;
    if (Wd.screen) {
      screen = add(g, ring(Wd.screen - 1.5, Wd.screen + 1.5, Wd.h + 10, 48), std('#2f8f5b', 0.45, 0.4));
      screen.position.y = -5;
    }
    return {g, lv, hv, screen};
  });
  anchors.windings = [C.pitch + Wd.hvR[1], coilY + Wd.h * 0.6, 0];
  anchors.lvw = [-C.pitch + Wd.lvR[1], coilY + Wd.h + 4, Wd.lvR[1] * 0.4];
  anchors.screen = Wd.screen ? [Wd.screen, coilY + Wd.h * 0.8, 0] : null;
  // the off-circuit tap changer barrel under its knob, or the OLTC in the tank
  // off-circuit: the switch barrel under its knob; ECOTAP: three phase modules under a support beam, each a selector
  // assembly and a diverter switch assembly with transition resistor and vacuum interrupter (MR 6107891 p.19)
  const barrel = add(G.leads, new THREE.CylinderGeometry(46, 46, sp.oltc ? 10 : 300, 24), M.paper);
  barrel.position.set(tapX, yLid - 170, tapZ);
  barrel.visible = !sp.oltc;
  const modX = [-95, 0, 95].map((d) => tapX - 20 + d);
  const modY = yLid - 70 - 95;
  if (sp.oltc) {
    add(G.leads, new THREE.BoxGeometry(300, 30, 40), M.dark).position.set(tapX - 20, yLid - 45, 0);
    for (const x of modX) {
      add(G.leads, new THREE.BoxGeometry(70, 190, 58), M.cream).position.set(x, modY, -34);
      add(G.leads, new THREE.BoxGeometry(70, 160, 58), std('#4a5058', 0.5, 0.35)).position.set(x, modY + 15, 34);
      add(G.leads, new THREE.CylinderGeometry(16, 16, 60, 14), M.glass).position.set(x, modY + 40, 66);
    }
    anchors.ecotap = [modX[2] + 35, modY, 64];
  }
  // leads: HV from the top of each HV coil to its bushing, LV bars from the LV coils to the LV bushings
  const leadMat = M.paper;
  const leadsTo = (from, to, r, mat, mid = 0.55) => {
    const a = new V3(...from);
    const b = new V3(...to);
    const m1 = new V3(a.x, a.y + (b.y - a.y) * mid, a.z);
    const m2 = new V3(b.x, b.y - 60, b.z);
    const curve = new THREE.CatmullRomCurve3([a, m1, m2, b]);
    return add(G.leads, new THREE.TubeGeometry(curve, 40, r, 8, false), mat);
  };
  limbX.forEach((x, i) => {
    const hvTop = hvTops[i];
    leadsTo([x + Wd.hvR[1] * 0.7, coilY + Wd.h - 10, Wd.hvR[1] * 0.4], [hvTop[0], yLid - 4, hvTop[2]], 9, leadMat);
    // tap leads from mid-coil to the barrel
    leadsTo([x + Wd.hvR[1] * 0.9, coilY + Wd.h * 0.5, Wd.hvR[1] * 0.5], sp.oltc ? [modX[i], modY - 95, -30] : [tapX, barrel.position.y - 80 + i * 40, tapZ + 30], 5, leadMat, 0.3);
  });
  const lvCount = lvTops.length;
  for (let j = 0; j < lvCount; j++) {
    const t = lvTops[j];
    const limb = j % 4 === 3 ? 1 : j % 4;
    const from = [limbX[Math.min(2, limb)] + (j % 4 === 3 ? 0 : Wd.lvR[0] * 0.5), coilY + Wd.h + 10, -Wd.lvR[1] * 0.8];
    const a = new V3(...from);
    const b = new V3(t[0], yLid - 4, t[2]);
    const m = new V3(a.x, b.y - 120, b.z);
    for (const [p, q] of [[a, new V3(a.x, m.y, a.z)], [new V3(a.x, m.y, a.z), m], [m, b]]) {
      const len = p.distanceTo(q);
      if (len < 1) continue;
      const bar = add(G.leads, new THREE.BoxGeometry(12, len, Math.max(30, stud * 2.4)), M.copperLV);
      bar.position.copy(p).add(q).multiplyScalar(0.5);
      bar.quaternion.setFromUnitVectors(new V3(0, 1, 0), q.clone().sub(p).normalize());
    }
  }
  // the bushings' inner stems through the lid
  for (const t of [...hvTops, ...lvTops]) add(G.leads, new THREE.CylinderGeometry(10, 10, 60, 10), M.brass).position.set(t[0], yLid - 30, t[2]);

  // ---------------------------------------------------------------- section faces (the cut at z = 0)
  // flat faces lying just behind the cut, unclipped: laminations for the core (one per limb and yoke, so each glows
  // with its own flux), turns for the windings
  const capLimbs = [];
  const capYokes = [];
  {
    const zc = -0.8;
    const planeUV = (g) => {
      const uv = g.attributes.uv;
      const pos = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 300, pos.getY(i) / 300);
      return g;
    };
    const L2 = yokeLen / 2;
    for (const x of limbX) {
      const g = new THREE.PlaneGeometry(C.d, C.window);
      g.translate(x, (limbY0 + limbY1) / 2, 0);
      capLimbs.push(at(add(G.caps, planeUV(g), M.capCore.clone(), false), 0, 0, zc));
    }
    for (const y of [cy0 + yokeH / 2, limbY1 + yokeH / 2]) {
      const g = new THREE.PlaneGeometry(2 * L2, yokeH);
      g.translate(0, y, 0);
      capYokes.push(at(add(G.caps, planeUV(g), M.capCore.clone(), false), 0, 0, zc));
    }
    const cuGeos = [];
    for (const x of limbX)
      for (const [r0, r1, y0, h] of [[Wd.lvR[0], Wd.lvR[1], coilY, Wd.h], [Wd.hvR[0], Wd.hvR[1], coilY + 10, Wd.h - 20]])
        for (const sgn of [-1, 1]) {
          const g = new THREE.PlaneGeometry(r1 - r0, h);
          g.translate(x + sgn * (r0 + r1) / 2, y0 + h / 2, zc + 0.3);
          cuGeos.push(g);
        }
    add(G.caps, mergeGeometries(cuGeos), M.capCu, false);
    G.caps.visible = false;
  }
  for (const m of [...capLimbs, ...capYokes]) m.material.emissive = new THREE.Color('#d6182b');

  // ---------------------------------------------------------------- the flux arrows in the core (one accent)
  const arrowGeo = keep(new THREE.ConeGeometry(C.d * 0.16, C.d * 0.32, 3));
  const fluxArrows = limbX.map((x) => {
    const g = new THREE.Group();
    g.position.set(x, (limbY0 + limbY1) / 2, C.d / 2 + 8);
    G.arrows.add(g);
    const list = [-0.3, 0, 0.3].map((f) => {
      const m = new THREE.Mesh(arrowGeo, M.arrow);
      m.position.y = f * C.window;
      m.renderOrder = 5;
      g.add(m);
      return m;
    });
    return {g, list};
  });

  // ---------------------------------------------------------------- the fluid and its flow
  const oilTop0 = cfg.design === 'breathing' ? yLid - 110 : yLid - 2;
  const oilBox = add(G.oil, new THREE.BoxGeometry(li - 2, 1, bi - 2), M.oil, false);
  oilBox.renderOrder = 2;
  const oilSurface = add(G.oil, new THREE.PlaneGeometry(li - 2, bi - 2), keep(new THREE.MeshBasicMaterial({color: sp.fluid.colour, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide})), false);
  oilSurface.rotation.x = -Math.PI / 2;
  oilSurface.renderOrder = 2;
  // convection: N particles, each on a loop up a cooling duct, out under the lid, down a wave, back along the floor
  const NF = 260;
  const flowGeo = keep(new THREE.SphereGeometry(7, 8, 6));
  const flowMesh = new THREE.InstancedMesh(flowGeo, M.flow, NF);
  flowMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NF * 3), 3);
  flowMesh.renderOrder = 4;
  G.flow.add(flowMesh);
  const rnd = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const paths = [];
  for (let i = 0; i < NF; i++) {
    const limb = i % 3;
    const ang = rnd(i * 3.1) * Math.PI * 2;
    const rr = (Wd.lvR[1] + Wd.hvR[0]) / 2 + (rnd(i * 5.7) - 0.5) * (Wd.hvR[0] - Wd.lvR[1]) * 0.6;
    const x0 = limbX[limb] + Math.cos(ang) * rr;
    const z0 = Math.sin(ang) * rr;
    const side = z0 >= 0 ? 1 : -1;
    const fx = clamp(x0 + (rnd(i * 9.3) - 0.5) * 400, -li / 2 + 80, li / 2 - 80);
    const zW = side * (bi / 2 + wall + T.fin * (0.35 + 0.4 * rnd(i * 2.3)));
    const yBot = coilY - 30;
    const yHi = Math.min(oilTop0, yLid) - 40 - rnd(i * 4.4) * 60;
    const pts = [
      [x0, yBot, z0],
      [x0, coilY + Wd.h + 40, z0],
      [x0 * 0.9 + fx * 0.1, yHi, z0 * 0.6 + side * bi * 0.2],
      [fx, yHi, side * (bi / 2 - 30)],
      [fx, yHi - 30, zW],
      [fx, yT + frameH + 80, zW],
      [fx, yT + 50, side * (bi / 2 - 60)],
      [x0 * 0.7 + fx * 0.3, yT + 40, z0 * 0.8],
      [x0, yBot, z0],
    ].map((p) => new V3(...p));
    // arc-length table: hot segment speeds (rising) differ little from the wave; keep it uniform
    const segs = [];
    let tot = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const l = pts[k].distanceTo(pts[k + 1]);
      segs.push(l);
      tot += l;
    }
    paths.push({pts, segs, tot, off: rnd(i * 7.7)});
  }
  const flowPos = new V3();
  const flowM = new THREE.Matrix4();
  const hot = new THREE.Color('#ff7a2e');
  const cool = new THREE.Color('#5aa7e6');
  const tmpC = new THREE.Color();
  const setFlow = (phase, heat) => {
    for (let i = 0; i < NF; i++) {
      const P = paths[i];
      let d = (((phase + P.off) % 1) + 1) % 1;
      d *= P.tot;
      let k = 0;
      while (k < P.segs.length - 1 && d > P.segs[k]) {
        d -= P.segs[k];
        k++;
      }
      const u = clamp(d / P.segs[k], 0, 1);
      flowPos.lerpVectors(P.pts[k], P.pts[k + 1], u);
      flowM.makeTranslation(flowPos.x, flowPos.y, flowPos.z);
      flowMesh.setMatrixAt(i, flowM);
      // hot leaving the coils, cooling down the wave
      const hk = k <= 2 ? 1 : k === 3 ? 0.85 : k === 4 ? 0.85 - 0.75 * u : k <= 6 ? 0.1 : 0.1 + 0.4 * u;
      tmpC.copy(cool).lerp(hot, clamp(hk * (0.4 + 0.6 * heat), 0, 1));
      flowMesh.setColorAt(i, tmpC);
    }
    flowMesh.instanceMatrix.needsUpdate = true;
    flowMesh.instanceColor.needsUpdate = true;
  };
  setFlow(0, 0.5);
  anchors.oil = [-li / 2 + 60, yT + T.h * 0.5, bi / 2 - 20];

  // ---------------------------------------------------------------- oil pan [23][38]
  if (cfg.pan !== 'none') {
    if (cfg.pan === 'integrated') {
      // between tank and chassis, the tank colour, 150 mm round the tank [38]
      const pl = T.l + 300;
      const pb = T.b + 300;
      const ph = 260;
      const py = skidY - 20;
      for (const s of [-1, 1]) {
        add(G.pan, new THREE.BoxGeometry(pl, ph, 6), M.paint).position.set(0, py + ph / 2 - 120, s * pb / 2);
        add(G.pan, new THREE.BoxGeometry(6, ph, pb), M.paint).position.set(s * pl / 2, py + ph / 2 - 120, 0);
      }
      add(G.pan, new THREE.BoxGeometry(pl, 6, pb), M.paint).position.set(0, py - 120, 0);
    } else {
      const P = sp.panFit ?? {lo: T.l + 400, bo: T.b + 400, h: 320};
      const ph = P.h;
      const mat = M.alu;
      for (const s of [-1, 1]) {
        add(G.pan, new THREE.BoxGeometry(P.lo, ph, 5), mat).position.set(0, ph / 2, (s * P.bo) / 2);
        add(G.pan, new THREE.BoxGeometry(5, ph, P.bo), mat).position.set((s * P.lo) / 2, ph / 2, 0);
      }
      add(G.pan, new THREE.BoxGeometry(P.lo, 4, P.bo), mat).position.set(0, 2, 0);
      // bolt rows on the screwable side, the rails under the rollers (STANDARD)
      const bolts = Math.round(P.lo / 110);
      for (let i = 0; i < bolts; i++) add(G.pan, new THREE.CylinderGeometry(7, 7, 6, 6), M.steel).position.set(-P.lo / 2 + 55 + i * 110, 30, P.bo / 2 + 3);
      G.pan.children.slice(-bolts).forEach((m) => (m.rotation.x = Math.PI / 2));
      if (cfg.pan === 'standard') for (const sx of [-1, 1]) add(G.pan, new THREE.BoxGeometry(70, 40, P.bi ?? P.bo - 50), mat).position.set((sx * ch.gauge) / 2, 22, 0);
      else for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(G.pan, new THREE.BoxGeometry(90, 30, 160), mat).position.set((sx * ch.gauge) / 2, 15, sz * wheelZ);
    }
    anchors.pan = [T.l / 2 + 100, 120, T.b / 2 + 120];
  }
  // ---------------------------------------------------------------- seismic: locks, Vibrastop, the quake kit [27][35]
  if (cfg.seismic === 'locks') {
    for (const [sx, sz] of [[-1, -1], [1, 1]]) {
      const g = at(new THREE.Group(), (sx * ch.gauge) / 2, 0, sz * wheelZ);
      G.seismic.add(g);
      for (const s of [-1, 1]) add(g, new THREE.BoxGeometry(60, 70, 50), M.alu).position.set(0, 35, s * (wr + 40));
      for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(8, 8, 2 * wr + 160, 10), M.steel).position.set(s * 40, 50, 0);
      g.children.slice(-2).forEach((m) => (m.rotation.x = Math.PI / 2));
    }
  } else if (cfg.seismic === 'vibrastop') {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const g = at(new THREE.Group(), (sx * ch.gauge) / 2, 0, sz * wheelZ);
      G.seismic.add(g);
      add(g, new THREE.BoxGeometry(110, 8, 240), M.alu).position.y = 4;
      add(g, new THREE.BoxGeometry(90, 36, 200), M.rubber).position.y = 26;
      add(g, new THREE.BoxGeometry(100, 16, 220), M.alu).position.y = 52;
    }
  } else if (cfg.seismic === 'quake') {
    // turnbuckle stays from the lid corners down to floor anchors beyond the tank [35]
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const a = new V3((sx * lidW) / 2 + sx * 20, yLid + 6, (sz * lidB) / 2 - sz * 40);
      const b = new V3((sx * lidW) / 2 + sx * 380, 0, (sz * lidB) / 2 + sz * 200);
      const d = b.clone().sub(a);
      const len = d.length();
      const rod = add(G.seismic, new THREE.CylinderGeometry(9, 9, len, 10), M.steel);
      rod.position.copy(a).add(b).multiplyScalar(0.5);
      rod.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize());
      const tb = add(G.seismic, new THREE.CylinderGeometry(20, 20, 220, 12), M.zinc);
      tb.position.copy(a).addScaledVector(d, 0.62);
      tb.quaternion.copy(rod.quaternion);
      add(G.seismic, new THREE.BoxGeometry(120, 14, 120), M.zinc).position.copy(b);
      add(G.seismic, new THREE.BoxGeometry(80, 10, 80), M.zinc).position.copy(a).add(new V3(0, 6, 0));
    }
  }

  // ---------------------------------------------------------------- fault visuals: leak, gas bubbles, arc flash
  const FX = new THREE.Group();
  root.add(FX);
  const dripMat = keep(new THREE.MeshBasicMaterial({color: sp.fluid.colour, transparent: true, opacity: 0.9}));
  const drops = [0, 1, 2].map(() => add(FX, new THREE.SphereGeometry(7, 8, 6), dripMat, false));
  const puddle = add(FX, new THREE.CircleGeometry(1, 40), keep(new THREE.MeshBasicMaterial({color: sp.fluid.colour, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2})), false);
  puddle.rotation.x = -Math.PI / 2;
  const dripX = -li / 2 + 120;
  const dripZ = bi / 2 + wall + 70;
  const floorY = cfg.pan === 'standard' || cfg.pan === 'easy' ? 5 : cfg.pan === 'integrated' ? skidY - 116 : 1;
  puddle.position.set(dripX, floorY, dripZ + 40);
  const NB = 60;
  const bubbleMesh = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(9, 8, 6)), keep(new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false})), NB);
  bubbleMesh.renderOrder = 6;
  lift.add(bubbleMesh);
  const arcGlow = add(lift, new THREE.SphereGeometry(1, 20, 14), keep(new THREE.MeshBasicMaterial({color: '#cfe6ff', transparent: true, opacity: 0.9, depthWrite: false})), false);
  arcGlow.position.set(C.pitch + Wd.hvR[0], coilY + Wd.h * 0.6, Wd.hvR[0] * 0.4);
  arcGlow.renderOrder = 7;
  anchors.arc = [arcGlow.position.x, arcGlow.position.y, arcGlow.position.z];
  const bm = new THREE.Matrix4();
  const setFx = (pr) => {
    const leak = pr?.leakL ?? 0;
    const t = pr?.time ?? 0;
    drops.forEach((d, i) => {
      const u = (t * 1.6 + i / 3) % 1;
      d.visible = leak > 0.01 && pr.leaking;
      d.position.set(dripX, yT + 60 - u * (yT + 60 - floorY), dripZ);
    });
    puddle.visible = leak > 0.05;
    puddle.scale.setScalar(Math.min(700, 60 + 90 * Math.sqrt(leak)));
    const b = pr?.bubbles ?? 0;
    bubbleMesh.visible = b > 0.02;
    if (bubbleMesh.visible) {
      for (let i = 0; i < NB; i++) {
        const show = i / NB < b;
        const u = (t * (0.25 + 0.5 * b) + rnd(i * 1.7)) % 1;
        const x = arcGlow.position.x + (rnd(i * 3.3) - 0.5) * 90;
        const z = arcGlow.position.z + (rnd(i * 5.1) - 0.5) * 90;
        const y = arcGlow.position.y + u * (yLid - 20 - arcGlow.position.y);
        bm.makeScale(show ? 1 : 0, show ? 1 : 0, show ? 1 : 0).setPosition(x, y, z);
        bubbleMesh.setMatrixAt(i, bm);
      }
      bubbleMesh.instanceMatrix.needsUpdate = true;
    }
    const a = pr?.arcFlash ?? 0;
    arcGlow.visible = a > 0.02;
    arcGlow.scale.setScalar(20 + 140 * a);
    arcGlow.material.opacity = Math.min(0.95, a * 1.2);
    if (dgptGas) dgptGas.scale.y = 1 + 78 * Math.min(1, pr?.dgptFrac ?? 0);
    if (dgptGas) dgptGas.visible = (pr?.dgptFrac ?? 0) > 0.005;
    if (buchGas) {
      buchGas.visible = (pr?.buchFrac ?? 0) > 0.01;
      buchGas.scale.setScalar(Math.max(0.05, Math.min(1, pr?.buchFrac ?? 0)));
    }
    if (silica) silica.children[2].material.color.set('#f0a43a').lerp(new THREE.Color('#f4eeb0'), Math.min(1, pr?.sat ?? 0));
    if (levelCap) levelCap.rotation.y = clamp((pr?.levelCm ?? 0) / 8, -1.3, 1.3);
    if (prvCap) prvCap.position.y = 40 + 28 * (pr?.prvOpen ?? 0);
  };
  setFx(null);

  // ---------------------------------------------------------------- cutaway, ghosting, subsystems
  const CLIP = new THREE.Plane(new V3(0, 0, -1), 0);
  const clipMats = new Set();
  const noClip = new Set([M.base, GHOST_EDGE, M.capCu, ...[...capLimbs, ...capYokes].map((m) => m.material)]);
  root.traverse((o) => {
    if (o.isMesh && !o.parent?.isGroup) return;
  });
  const allMeshes = [];
  root.traverse((o) => o.isMesh && allMeshes.push(o));
  for (const m of allMeshes) {
    m.userData.mat0 = m.material;
    if (!noClip.has(m.material)) clipMats.add(m.material);
  }
  const tankGhostSet = new Set([...tankParts, ...lidParts]);
  let cutMode = 'solid';
  const setCut = (mode) => {
    cutMode = mode;
    for (const mat of clipMats) {
      mat.clippingPlanes = mode === 'section' ? [CLIP] : null;
      mat.clipShadows = true;
      if (mat !== M.oil && mat !== M.flow && mat !== M.arrow && mat !== GHOST && mat !== M.glass) mat.side = mode === 'section' ? THREE.DoubleSide : THREE.FrontSide;
      mat.needsUpdate = true;
    }
    GHOST.clippingPlanes = null;
    for (const m of tankGhostSet) {
      const ghost = mode === 'glass';
      m.material = ghost ? GHOST : m.userData.mat0;
      m.castShadow = !ghost;
    }
    G.caps.visible = mode === 'section';
  };

  // ---------------------------------------------------------------- update
  const Y_ = new V3(0, 1, 0);
  let lastFinBulge = 1;
  /**
   * s: {flux[3], lv[3], hv[3] (pu), K, heat 0..1, flowPhase, topOil, maxOil, oilLevelMm, finBulge, tap (position),
   * positions, wheelTurn 0..1, explode 0..1, view: 'all'|'active'|'core'|'windings'|'oil'|'fittings', overlays}
   */
  const update = (s) => {
    const ov = s.overlays ?? {};
    const view = s.view ?? 'all';
    const showFlux = ov.flux ?? true;
    const showCurrent = ov.current ?? true;
    const showFlow = ov.flow ?? true;
    // the flux: limb glow in the accent by |Φ|, arrows up or down along every limb
    limbs.forEach((m, i) => {
      const f = s.flux[i];
      m.material.emissiveIntensity = showFlux ? 0.32 * Math.abs(f) : 0;
      capLimbs[i].material.emissiveIntensity = showFlux ? 0.2 * Math.abs(f) : 0;
      const fa = fluxArrows[i];
      fa.g.visible = showFlux && (view === 'core' || view === 'active' || view === 'windings' || cutMode !== 'solid');
      for (const a of fa.list) {
        a.rotation.z = f >= 0 ? 0 : Math.PI;
        a.scale.setScalar(0.25 + 0.75 * Math.abs(f));
      }
    });
    // the yokes carry the outer limbs' flux back
    // each yoke half carries an outer limb's flux back: shown by the larger of the two
    const yk = Math.max(Math.abs(s.flux[0]), Math.abs(s.flux[2]));
    yokes.forEach((m) => (m.material.emissiveIntensity = showFlux ? 0.12 * yk : 0));
    capYokes.forEach((m) => (m.material.emissiveIntensity = showFlux ? 0.1 * yk : 0));
    // the currents: the copper warms in colour by |i|
    coils.forEach((c, i) => {
      c.lv.material.emissiveIntensity = showCurrent ? 0.45 * Math.abs(s.lv[i]) : 0;
      c.hv.material.emissiveIntensity = showCurrent ? 0.35 * Math.abs(s.hv[i]) : 0;
    });
    M.capCu.emissiveIntensity = showCurrent ? 0.18 * s.K : 0;
    // the thermometer: 0…100 °C over 270°, the drag pointer at the maximum reached
    const ang = (v) => -(-135 + (clamp(v, 0, 100) / 100) * 270) * D2R;
    needle.rotation.z = ang(s.topOil);
    drag.rotation.z = ang(s.maxOil ?? s.topOil);
    // the fluid: the level over the tank (free-breathing), full to the lid otherwise
    const level = cfg.design === 'breathing' ? oilTop0 + (s.oilLevelMm ?? 0) : oilTop0;
    oilBox.scale.y = level - yT - 12;
    oilBox.position.y = (level + yT + 12) / 2;
    oilSurface.position.y = level;
    if (conservatorLevel) conservatorLevel.rotation.z = clamp(-(s.oilLevelMm ?? 0) / 60, -1.2, 1.2);
    if (dipstick) {
      dipstick.visible = !!s.dipstick;
      dipstick.position.y = yTop + (s.dipstick ?? 0) * 120;
    }
    // hermetic: the waves swell with the fluid (exaggerated as the console states)
    const bulge = s.finBulge ?? 1;
    if (Math.abs(bulge - lastFinBulge) > 1e-3) {
      setFins(bulge);
      lastFinBulge = bulge;
    }
    setFx(s.prot);
    // the tap changer
    if (tapDial) tapDial.rotation.y = -(-60 + (((s.tap ?? 3) - 1) * 120) / (sp.positions - 1)) * D2R;
    // the rollers turned for transverse travel
    for (const w of wheels) w.fork.rotation.y = Math.PI / 2 - (s.wheelTurn ?? 0) * (Math.PI / 2);
    // the flow
    const flowOn = showFlow && (view === 'oil' || (cutMode !== 'solid' && view === 'all'));
    G.flow.visible = flowOn && (s.explode ?? 0) < 0.02;
    if (G.flow.visible) setFlow(s.flowPhase ?? 0, s.heat ?? 0.5);
    // untanking: the lid and the active part lift out together
    const e = s.explode ?? 0;
    lift.position.y = e * (T.h + 160);
    // subsystems
    const tankOn = view === 'all' || view === 'oil' || view === 'fittings';
    G.tank.visible = tankOn;
    G.lid.visible = view !== 'core' && view !== 'windings';
    G.oil.visible = (view === 'all' || view === 'oil') && cutMode !== 'solid' && e < 0.02;
    G.base.visible = view !== 'core' && view !== 'windings';
    G.pan.visible = view === 'all' || view === 'fittings' || view === 'oil';
    G.seismic.visible = G.pan.visible;
    G.windings.visible = view !== 'core';
    G.leads.visible = view !== 'core' && view !== 'windings';
    G.active.visible = view !== 'fittings' || cutMode !== 'solid';
    G.arrows.visible = showFlux;
    G.caps.visible = cutMode === 'section';
    if (buchholz) buchholz.visible = G.lid.visible;
    if (silica) silica.visible = G.lid.visible;
    if (ecotapDrive) ecotapDrive.visible = G.lid.visible;
    void Y_;
  };
  const anchor = (k) => {
    const a = anchors[k];
    if (!a) return null;
    const lifted = ['tank', 'plate', 'drain', 'earth', 'roller', 'pan', 'oil'].includes(k) ? 0 : lift.position.y;
    return [a[0] * 0.001, (a[1] + lifted) * 0.001, a[2] * 0.001];
  };
  // the overall size as built (mm), for the dimension lines: the highest point of tank, lid and fittings
  let topY = 0;
  let topX = 0;
  let topZ = 0;
  {
    const bb = new THREE.Box3();
    const skip = new Set([dipstick, G.leads, G.active, G.caps, G.arrows, G.flow, G.oil, FX].filter(Boolean));
    const walk = (o) => {
      if (skip.has(o)) return;
      if (o.isMesh) {
        o.updateWorldMatrix(true, false);
        bb.setFromObject(o);
        if (bb.max.y > topY) {
          topY = bb.max.y;
          topX = (bb.min.x + bb.max.x) / 2;
          topZ = (bb.min.z + bb.max.z) / 2;
        }
      }
      for (const c of o.children) walk(c);
    };
    for (const g of [G.base, G.tank, G.lid]) walk(g);
  }
  // modelled in mm; one world unit is a metre
  root.scale.setScalar(0.001);
  const dispose = () => {
    for (const d of disposables) d.dispose?.();
    for (const m of allMeshes) m.material?.dispose?.();
  };
  return {
    root, update, setCut, CLIP, anchor, anchors, dispose, M,
    dims: {yT, yLid, yTop, topY, topX, topZ, wheelZ, gauge: ch.gauge, Lmm: T.l, Bmm: T.b, h: (yLid + 300) * 0.001, l: T.l * 0.001, b: T.b * 0.001, coilY: coilY * 0.001, coreTop: (limbY1 + yokeH) * 0.001, coreMid: ((limbY0 + limbY1) / 2) * 0.001},
  };
}
