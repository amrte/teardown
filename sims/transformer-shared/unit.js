// The transformer itself, built from code in millimetres from kin.js: a three-limb stepped core, per limb an
// aluminium-foil LV winding in two layers with a duct between them and a red cast-resin HV disc winding around it,
// duct spacers, blue clamping frames with rubber pads on the coils, skids and wheels, the HV delta rods and
// tapping links on the front, the LV busbars and neutral at the back, cross-flow fans on both long sides, PTC sensors
// with their wires and box, and a rating plate. Overlays: the flux in every core segment (tint plus chevrons), the
// air through the ducts (points), a heat map on the windings. update(s) poses it all.
import * as THREE from 'three';
import {G, PHASES, R, STEP, TAPS, TAP0} from './kin.js';

const V3 = THREE.Vector3;
const V2 = THREE.Vector2;
const TAU = Math.PI * 2;
export const ACCENT = '#f08a00';

// ------------------------------------------------------------ geometry helpers
/** the stepped core section as a Shape, unit circle scaled by r: u across the sheets, v through the stack */
function stepShape(r) {
  const q1 = [];
  let b0 = 0;
  for (const [a, b] of STEP) {
    q1.push([a, b0], [a, b]);
    b0 = b;
  }
  const pts = [...q1, ...[...q1].reverse().map(([u, v]) => [-u, v]), ...q1.map(([u, v]) => [-u, -v]), ...[...q1].reverse().map(([u, v]) => [u, -v])];
  const uniq = pts.filter(([u, v], i) => {
    const [pu, pv] = pts[(i + pts.length - 1) % pts.length];
    return Math.abs(u - pu) > 1e-9 || Math.abs(v - pv) > 1e-9;
  });
  const sh = new THREE.Shape();
  uniq.forEach(([u, v], i) => (i ? sh.lineTo(u * r, v * r) : sh.moveTo(u * r, v * r)));
  sh.closePath();
  return sh;
}
function prism(shape, len, axis) {
  const g = new THREE.ExtrudeGeometry(shape, {depth: len, bevelEnabled: false});
  g.translate(0, 0, -len / 2);
  if (axis === 'y') g.rotateX(-Math.PI / 2);
  if (axis === 'x') g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
/** a ring's profile in (r, y) with filleted corners, walked bottom → outer → top → inner */
function ringProfile(ri, ro, h, f = 3, seg = 4) {
  const pts = [];
  const arc = (cx, cy, a0) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push(new V2(cx + f * Math.cos(a), cy + f * Math.sin(a)));
    }
  };
  arc(ri + f, -h / 2 + f, Math.PI);
  arc(ro - f, -h / 2 + f, -Math.PI / 2);
  arc(ro - f, h / 2 - f, 0);
  arc(ri + f, h / 2 - f, Math.PI / 2);
  // three's lathe wants the profile ordered so the outer face runs upward; close the loop
  const p = [...pts.slice(seg + 1), ...pts.slice(0, seg + 1)];
  p.push(p[0].clone());
  return p;
}
// cut: the back half only (phi 90° → 270°), the section through the coil axes
const ring = (ri, ro, h, f, cut) => new THREE.LatheGeometry(ringProfile(ri, ro, h, f), 96, cut ? Math.PI / 2 : 0, cut ? Math.PI : TAU);

/** a canvas texture drawn by fn(ctx, w, h) */
function canvasTex(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// the cut faces of the half section: what a saw would show
const lvFaceTex = () =>
  canvasTex(96, 1024, (g, w, h) => {
    g.fillStyle = '#4b4434';
    g.fillRect(0, 0, w, h);
    const turns = R.N2 / 2;
    for (let i = 0; i < turns; i++) {
      const x = 6 + (i / turns) * (w - 12);
      g.fillStyle = '#d5d9de';
      g.fillRect(x, 26, ((w - 12) / turns) * 0.62, h - 52);
    }
    g.fillStyle = '#2b2620';
    g.fillRect(0, 0, w, 22);
    g.fillRect(0, h - 22, w, 22);
  });
const hvFaceTex = () =>
  canvasTex(192, 1024, (g, w, h) => {
    g.fillStyle = '#a3241a';
    g.fillRect(0, 0, w, h);
    const wall = (G.hv.wall / (G.hv.ro - G.hv.ri)) * w;
    const n = R.discs;
    const gap = 30;
    const dh = (h - 2 * 40 - (n - 1) * gap) / n;
    const turns = Math.round(R.N1 / n);
    for (let d = 0; d < n; d++) {
      const y = 40 + d * (dh + gap);
      g.fillStyle = '#7d7f82';
      g.fillRect(wall, y, w - 2 * wall, dh);
      g.fillStyle = '#e1e4e7';
      for (let i = 0; i < turns; i++) {
        const x = wall + (i / turns) * (w - 2 * wall);
        g.fillRect(x, y + 1, ((w - 2 * wall) / turns) * 0.55, dh - 2);
      }
    }
  });
/** the two flat faces of the half section, in the plane z = 0 on either side of the axis, facing +z */
function cutFaces(ri, ro, h, mat) {
  const g = new THREE.Group();
  const a = new THREE.Mesh(new THREE.PlaneGeometry(ro - ri, h), mat);
  a.position.set((ri + ro) / 2, 0, 0.3);
  // the −x face: flip u so the texture still runs from the inside out
  const gb = new THREE.PlaneGeometry(ro - ri, h);
  const uv = gb.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  const b = new THREE.Mesh(gb, mat);
  b.position.set(-(ri + ro) / 2, 0, 0.3);
  g.add(a, b);
  return g;
}
/** a polyline with every corner rounded, for rods and bars */
function rodPath(points, r, mat, bend = 30) {
  const path = new THREE.CurvePath();
  const P = points.map((p) => new V3(...p));
  let prev = P[0].clone();
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i].clone().sub(P[i - 1]).normalize();
    const b = P[i + 1].clone().sub(P[i]).normalize();
    const p0 = P[i].clone().addScaledVector(a, -bend);
    const p1 = P[i].clone().addScaledVector(b, bend);
    path.add(new THREE.LineCurve3(prev, p0));
    path.add(new THREE.QuadraticBezierCurve3(p0, P[i].clone(), p1));
    prev = p1;
  }
  path.add(new THREE.LineCurve3(prev, P[P.length - 1]));
  return new THREE.Mesh(new THREE.TubeGeometry(path, 24 * P.length, r, 10, false), mat);
}

// tap studs on the panel, mm from its centre: top row 3 4 5, bottom row 8 7 6
const STUD = {3: [-30, 26], 4: [0, 26], 5: [30, 26], 8: [-30, -26], 7: [0, -26], 6: [30, -26]};
const numTex = (txt) =>
  canvasTex(256, 56, (g, w, h) => {
    g.fillStyle = '#f1f1ee';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b1c1f';
    g.font = 'bold 40px Inter, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    txt.split(/\s+/).forEach((t, i) => g.fillText(t, w / 2 + (i - 1) * 91, h / 2 + 2));
  });

// ------------------------------------------------------------ materials
function materials() {
  const M = {
    resin: new THREE.MeshPhysicalMaterial({color: '#b6281c', roughness: 0.34, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.3, envMapIntensity: 0.55}),
    lv: new THREE.MeshStandardMaterial({color: '#9aa1a8', roughness: 0.46, metalness: 0.55, envMapIntensity: 0.6}),
    lvEnd: new THREE.MeshStandardMaterial({color: '#3a3833', roughness: 0.6, metalness: 0.1}),
    core: new THREE.MeshStandardMaterial({color: '#41464d', roughness: 0.5, metalness: 0.55, envMapIntensity: 0.6}),
    frame: new THREE.MeshPhysicalMaterial({color: '#2f6fb6', roughness: 0.42, metalness: 0.15, clearcoat: 0.3, envMapIntensity: 0.6}),
    rubber: new THREE.MeshStandardMaterial({color: '#1c1d1f', roughness: 0.75, metalness: 0}),
    spacer: new THREE.MeshStandardMaterial({color: '#2c2a26', roughness: 0.7, metalness: 0}),
    copper: new THREE.MeshStandardMaterial({color: '#c27846', roughness: 0.32, metalness: 1, envMapIntensity: 0.7}),
    alu: new THREE.MeshStandardMaterial({color: '#cfd3d8', roughness: 0.34, metalness: 1, envMapIntensity: 0.6}),
    steel: new THREE.MeshStandardMaterial({color: '#b9bec4', roughness: 0.35, metalness: 1, envMapIntensity: 0.6}),
    fan: new THREE.MeshStandardMaterial({color: '#4b5158', roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide}),
    blade: new THREE.MeshStandardMaterial({color: '#8b9198', roughness: 0.45, metalness: 0.5}),
    dark: new THREE.MeshStandardMaterial({color: '#18191b', roughness: 0.6, metalness: 0.1}),
    box: new THREE.MeshStandardMaterial({color: '#d6d8db', roughness: 0.5, metalness: 0.05}),
    wire: new THREE.MeshStandardMaterial({color: '#e2ad17', roughness: 0.5, metalness: 0}),
    brass: new THREE.MeshStandardMaterial({color: '#c9a250', roughness: 0.3, metalness: 1, envMapIntensity: 0.7}),
    tin: new THREE.MeshStandardMaterial({color: '#d9dcdf', roughness: 0.28, metalness: 1, envMapIntensity: 0.7}),
    tube: new THREE.MeshPhysicalMaterial({color: '#1d1e21', roughness: 0.38, metalness: 0, clearcoat: 0.4}),
    barrier: new THREE.MeshStandardMaterial({color: '#ece5d3', roughness: 0.55, metalness: 0, side: THREE.DoubleSide}),
    lvFace: new THREE.MeshStandardMaterial({map: lvFaceTex(), roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide}),
    hvFace: new THREE.MeshStandardMaterial({map: hvFaceTex(), roughness: 0.45, metalness: 0.1, side: THREE.DoubleSide}),
  };
  const ghost = (color, opacity) => new THREE.MeshStandardMaterial({color, roughness: 0.3, metalness: 0, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide});
  M.resinGhost = ghost('#c9372a', 0.09);
  M.lvGhost = ghost('#8c949c', 0.08);
  M.frameGhost = ghost('#2f6fb6', 0.1);
  M.faceGhost = ghost('#c9372a', 0.0);
  return M;
}

// the heat map: ambient blue through yellow to red, by winding temperature along the height
const HEAT_VS = `
uniform float uHs; uniform float uAmb; uniform float uH; uniform float uScale;
varying float vT; varying vec3 vN;
void main(){
  float y = clamp(position.y / uH + 0.5, 0.0, 1.0);
  float rise = (uHs - uAmb) * uScale;
  vT = uAmb + rise * (0.45 + 0.55 * sin(min(1.0, y / 0.85) * 1.5707963));
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const HEAT_FS = `
varying float vT; varying vec3 vN;
vec3 ramp(float t){
  vec3 c0 = vec3(0.16,0.36,0.78), c1 = vec3(0.18,0.72,0.86), c2 = vec3(0.98,0.84,0.22), c3 = vec3(0.96,0.45,0.08), c4 = vec3(0.80,0.06,0.10);
  float k = clamp((t - 20.0) / 160.0, 0.0, 1.0) * 4.0;
  if (k < 1.0) return mix(c0, c1, k);
  if (k < 2.0) return mix(c1, c2, k - 1.0);
  if (k < 3.0) return mix(c2, c3, k - 2.0);
  return mix(c3, c4, k - 3.0);
}
void main(){
  float l = 0.62 + 0.38 * max(0.0, dot(normalize(vN), normalize(vec3(-0.3, 0.8, 0.6))));
  gl_FragColor = vec4(ramp(vT) * l, 1.0);
  #include <colorspace_fragment>
}`;
const heatMat = (h, scale) =>
  new THREE.ShaderMaterial({vertexShader: HEAT_VS, fragmentShader: HEAT_FS, uniforms: {uHs: {value: 20}, uAmb: {value: R.amb}, uH: {value: h}, uScale: {value: scale}}, side: THREE.DoubleSide});

// air through the ducts: every point rides a path (in from the side under the coil, up its duct, out over the top),
// placed by the vertex shader from its phase along the path, so the whole cloud is one draw
const AIR_VS = `
attribute float aX; attribute float aR; attribute float aAng; attribute float aU0; attribute float aSpd; attribute float aY;
uniform float uPhase; uniform float uSize; uniform float uHot; uniform float uHalf; uniform float uOut; uniform float uSection;
varying float vU; varying float vA; varying float vHot;
void main(){
  float u = fract(aU0 + uPhase * aSpd);
  float s = sin(aAng), c = cos(aAng);
  // the half section: fold every path onto the cut plane, just behind the faces, so the air shows in the duct slots
  if (uSection > 0.5) { s = s >= 0.0 ? 1.0 : -1.0; c = -0.02; }
  float zs = c >= 0.0 ? 1.0 : -1.0;
  vec3 duct = vec3(aX + aR * s, 0.0, aR * c);
  vec3 side = vec3(aX + (aR + 60.0) * s, 0.0, zs * max(abs(aR * c) + 40.0, uOut));
  vec3 p;
  float yb = -uHalf - 22.0 + aY, yt = uHalf + 22.0 + aY;
  if (u < 0.14) { float k = smoothstep(0.0, 0.14, u); p = mix(side, duct, k); p.y = yb; }
  else if (u < 0.78) { float k = (u - 0.14) / 0.64; p = duct; p.y = mix(yb, yt, k); }
  else if (u < 0.88) { float k = smoothstep(0.78, 0.88, u); p = mix(duct, side, k); p.y = yt; }
  else { float k = (u - 0.88) / 0.12; p = side; p.y = mix(yt, yt + 300.0, k); }
  vU = u;
  vA = smoothstep(0.0, 0.05, u) * (1.0 - smoothstep(0.9, 1.0, u));
  vHot = uHot;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(uSize / -mv.z, uSize * 0.2);
}`;
const AIR_FS = `
uniform float uOpacity;
varying float vU; varying float vA; varying float vHot;
void main(){
  vec2 q = gl_PointCoord - 0.5;
  float d = dot(q, q);
  if (d > 0.25) discard;
  float warm = smoothstep(0.12, 0.8, vU) * vHot;
  vec3 col = mix(vec3(0.24, 0.56, 0.92), vec3(0.95, 0.47, 0.10), warm);
  gl_FragColor = vec4(col, vA * uOpacity * (1.0 - d * 2.2));
  #include <colorspace_fragment>
}`;

export function buildUnit() {
  const M = materials();
  const root = new THREE.Group();
  const add = (parent, geo, mat, pos = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const {rc, lv, hv, pitch, win} = G;
  const a1 = STEP[0][0];
  const bn = STEP[STEP.length - 1][1];
  const yc = win / 2 + a1 * rc; // yoke centre height
  const yokeTop = yc + a1 * rc;
  const zFace = bn * rc; // core front face
  const fm = G.frameMargin; // frame channel beyond the yoke
  // terminal studs sit 70 mm in from the coil ends (less on short coils); the tap panel scales to fit between them
  const tOff = Math.min(70, hv.h * 0.14);
  const sp = Math.min(1, Math.max(0.45, (hv.h / 2 - tOff - 34) / 75));
  // the gap between the HV coil top and the frame flange: busbars and sensor wires run through it
  const yGap = (hv.h / 2 + G.win / 2 - fm) / 2;

  // ------------------------------------------------------------ core: 3 limbs, top and bottom yokes in halves
  const shape = stepShape(rc);
  const coreParts = [];
  const coreMat = () => M.core.clone();
  const limbs = G.limbX.map((x) => add(root, prism(shape, 2 * yc, 'y'), coreMat(), [x, 0, 0]));
  const yHalf = G.len / 2;
  const yokes = {
    tl: add(root, prism(shape, yHalf, 'x'), coreMat(), [-yHalf / 2, yc, 0]),
    tr: add(root, prism(shape, yHalf, 'x'), coreMat(), [yHalf / 2, yc, 0]),
    bl: add(root, prism(shape, yHalf, 'x'), coreMat(), [-yHalf / 2, -yc, 0]),
    br: add(root, prism(shape, yHalf, 'x'), coreMat(), [yHalf / 2, -yc, 0]),
  };
  coreParts.push(...limbs, ...Object.values(yokes));

  // ------------------------------------------------------------ windings
  const ghostable = []; // [mesh, solid, ghost]
  const heatable = []; // [mesh, solid, heat]
  const heatLV = heatMat(lv.h, 1.0);
  const heatHV = heatMat(hv.h, 0.88);
  const coils = G.limbX.map((x, k) => {
    const grp = new THREE.Group();
    grp.position.x = x;
    root.add(grp);
    const full = new THREE.Group();
    const cut = new THREE.Group();
    grp.add(full, cut);
    const lvIn = [lv.ri, lv.ri + lv.layer + 1.5];
    const lvOut = [lv.ri + lv.layer + 1.5 + lv.duct, lv.ro];
    for (const [isCut, g] of [[false, full], [true, cut]]) {
      for (const [ri, ro] of [lvIn, lvOut]) {
        const m = add(g, ring(ri, ro, lv.h, 2.5, isCut), M.lv);
        ghostable.push([m, M.lv, M.lvGhost]);
        heatable.push([m, M.lv, heatLV]);
        if (isCut) {
          const f = cutFaces(ri, ro, lv.h, M.lvFace);
          g.add(f);
          for (const c of f.children) {
            ghostable.push([c, M.lvFace, M.faceGhost]);
            heatable.push([c, M.lvFace, heatLV]);
          }
        }
      }
      // the insulating cylinder between LV and HV, standing proud of the HV winding (manual 4.1, item 7)
      const bar = add(g, ring(hv.ri - 9, hv.ri - 6, lv.h + 40, 1, isCut), M.barrier);
      ghostable.push([bar, M.barrier, M.lvGhost]);
      const hvm = add(g, ring(hv.ri, hv.ro, hv.h, 10, isCut), M.resin);
      ghostable.push([hvm, M.resin, M.resinGhost]);
      heatable.push([hvm, M.resin, heatHV]);
      if (isCut) {
        const f = cutFaces(hv.ri, hv.ro, hv.h, M.hvFace);
        g.add(f);
        for (const c of f.children) {
          ghostable.push([c, M.hvFace, M.faceGhost]);
          heatable.push([c, M.hvFace, heatHV]);
        }
      }
    }
    cut.visible = false;
    // duct spacers: 8 sticks in each duct; the front four hide with the section
    const sticks = [];
    for (const [r0, r1, h] of [[rc + 1, lv.ri - 1, lv.h], [lvIn[1] + 0.5, lvOut[0] - 0.5, lv.h], [lv.ro + 1, hv.ri - 1, hv.h - 20]]) {
      for (let i = 0; i < 8; i++) {
        const a = ((i + 0.5) / 8) * TAU;
        const r = (r0 + r1) / 2;
        const m = add(grp, new THREE.BoxGeometry(r1 - r0, h, 9), M.spacer, [r * Math.sin(a), 0, r * Math.cos(a)]);
        m.rotation.y = a + Math.PI / 2;
        m.userData.front = Math.cos(a) > 0;
        sticks.push(m);
      }
    }
    // rubber pads between the coil ends and the frames' flanges, at 45° off the axes
    const pads = [];
    const padTop = G.win / 2 - fm;
    for (const sy of [1, -1]) {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const r = (hv.ri + hv.ro) / 2;
        const ph = padTop - hv.h / 2;
        const m = add(grp, new THREE.BoxGeometry(48, ph, 64), M.rubber, [r * Math.sin(a), sy * (hv.h / 2 + ph / 2), r * Math.cos(a)]);
        m.rotation.y = a;
        m.userData.front = Math.cos(a) > 0;
        pads.push(m);
      }
    }
    // HV terminal bosses on the front face, top and bottom, and the tapping panel at mid height
    const front = new THREE.Group();
    grp.add(front);
    const bossR = hv.ro + 8;
    for (const y of [hv.h / 2 - tOff, -hv.h / 2 + tOff]) {
      const b = add(front, new THREE.CylinderGeometry(22, 26, 30, 32), M.resin, [0, y, bossR]);
      b.rotation.x = Math.PI / 2;
      ghostable.push([b, M.resin, M.resinGhost]);
      const s = add(front, new THREE.CylinderGeometry(9, 9, 34, 16), M.steel, [0, y, bossR + 28]);
      s.rotation.x = Math.PI / 2;
    }
    // the tapping panel (manual 8.1): brass studs 3 4 5 over 8 7 6 cast into a resin boss, number plates above and
    // below, one bolted link from a top stud to a bottom stud
    const tapG = new THREE.Group();
    tapG.position.z = hv.ro + 4;
    tapG.scale.setScalar(sp);
    front.add(tapG);
    const panel = add(tapG, new THREE.BoxGeometry(104, 150, 22), M.resin);
    ghostable.push([panel, M.resin, M.resinGhost]);
    for (const [y, nums] of [[52, '3   4   5'], [-52, '8   7   6']]) {
      const pl = add(tapG, new THREE.PlaneGeometry(84, 18), new THREE.MeshStandardMaterial({map: numTex(nums), roughness: 0.5}), [0, y, 11.5]);
      pl.castShadow = false;
    }
    for (const p of Object.values(STUD)) {
      const b = add(tapG, new THREE.CylinderGeometry(9, 9, 6, 24), M.brass, [p[0], p[1], 13]);
      b.rotation.x = Math.PI / 2;
    }
    // the link and its two bolts; update() places it between the studs of the current tap
    const link = new THREE.Group();
    tapG.add(link);
    const bar = add(link, new THREE.BoxGeometry(1, 18, 5), M.tin);
    const bolts = [0, 1].map(() => {
      const h = add(link, new THREE.CylinderGeometry(8, 8, 7, 6), M.steel);
      h.rotation.x = Math.PI / 2;
      return h;
    });
    const studs = STUD;
    const zp = 0;
    return {grp, full, cut, front, sticks, pads, link, bar, bolts, studs, zp, x, phase: PHASES[k]};
  });

  // ------------------------------------------------------------ frames
  const frames = [];
  const chH = 2 * a1 * rc + 2 * fm;
  const flange = 70;
  const chT = 8;
  const chZ = zFace + 6;
  const channel = (len) => {
    // a C section in (z, y): web against the core, flanges outward; extruded along x
    const sh = new THREE.Shape();
    const h = chH / 2;
    sh.moveTo(0, -h);
    sh.lineTo(flange, -h);
    sh.lineTo(flange, -h + chT);
    sh.lineTo(chT, -h + chT);
    sh.lineTo(chT, h - chT);
    sh.lineTo(flange, h - chT);
    sh.lineTo(flange, h);
    sh.lineTo(0, h);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, {depth: len, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 1});
    g.translate(0, 0, -len / 2);
    g.rotateY(Math.PI / 2); // extrusion → x, shape x (z depth) → −z
    return g;
  };
  const chLen = Math.max(G.len + 70, G.frameLen); // the catalog length is over the frame
  for (const sy of [1, -1]) {
    for (const sz of [1, -1]) {
      const m = add(root, channel(chLen), M.frame, [0, sy * yc, sz * chZ]);
      if (sz > 0) m.rotation.y = Math.PI; // flanges toward +z on the front
      frames.push(m);
      // bolt heads through the web, and end plates tying front to back
      for (let i = -3; i <= 3; i++) {
        const b = add(root, new THREE.CylinderGeometry(11, 11, 10, 6), M.steel, [i * (chLen / 7.4), sy * yc + (i % 2 ? 60 : -60), sz * (chZ + chT + 5)]);
        b.rotation.x = Math.PI / 2;
      }
    }
    for (const sx of [1, -1]) frames.push(add(root, new THREE.BoxGeometry(12, chH - 30, 2 * chZ), M.frame, [sx * (chLen / 2 - 6), sy * yc, 0]));
  }
  // lifting lugs on the top channels
  for (const sx of [1, -1])
    for (const sz of [1, -1]) {
      const sh = new THREE.Shape();
      sh.moveTo(-45, 0);
      sh.lineTo(45, 0);
      sh.lineTo(30, 70);
      sh.absarc(0, 70, 30, 0, Math.PI, false);
      sh.lineTo(-45, 0);
      const hole = new THREE.Path();
      hole.absarc(0, 70, 15, 0, TAU, true);
      sh.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(sh, {depth: 14, bevelEnabled: false, curveSegments: 16});
      g.translate(0, 0, -7);
      frames.push(add(root, g, M.frame, [sx * (chLen / 2 - 90), yokeTop + fm, sz * (chZ + flange - 20)]));
    }
  // skids under the bottom frame, wheels at their ends
  // the truck (catalog p. 15): two skids e apart, wheels f in diameter and g wide, the skids k deep; width b over all
  const tr = G.truck;
  const skidY = G.floor + tr.f + tr.k / 2;
  const skidLen = Math.max(G.width, 2 * (chZ + flange) + 120);
  for (const sx of [-1, 1]) {
    const x = (sx * tr.e) / 2;
    add(root, new THREE.BoxGeometry(Math.max(80, tr.g + 50), tr.k, skidLen), M.frame, [x, skidY, 0]);
    // a post from the skid up to the bottom frame
    add(root, new THREE.BoxGeometry(Math.max(80, tr.g + 50), 30, 2 * chZ + 40), M.frame, [x, skidY + tr.k / 2 + 15, 0]);
    for (const sz of [-1, 1]) {
      const w = add(root, new THREE.CylinderGeometry(tr.f / 2, tr.f / 2, tr.g, 40), M.dark, [x, G.floor + tr.f / 2, sz * (skidLen / 2 - tr.f / 2 - 30)]);
      w.rotation.z = Math.PI / 2;
      const hub = add(root, new THREE.CylinderGeometry(tr.f / 5, tr.f / 5, tr.g + 8, 20), M.steel, [x, G.floor + tr.f / 2, sz * (skidLen / 2 - tr.f / 2 - 30)]);
      hub.rotation.z = Math.PI / 2;
    }
  }
  const frameMeshes = frames;

  // ------------------------------------------------------------ HV connections: delta tubes on the front, cables in
  // Manual 6.2: the upper terminals carry U-V-W, the lower ones V-W-U, so each coil's lower terminal is tied to the next
  // coil's upper terminal by an insulated tube; the long one runs from W's lower terminal back to U's upper terminal.
  const z0 = hv.ro + 22;
  const zr = hv.ro + 62;
  const z2 = hv.ro + 100;
  const zc = hv.ro + 140;
  const yT = hv.h / 2 - tOff;
  const yB = -hv.h / 2 + tOff;
  const rods = [];
  const frontHW = new THREE.Group(); // everything in front of the coils: hidden by the section
  root.add(frontHW);
  const X = G.limbX;
  rods.push(rodPath([[X[0], yB, z0], [X[0], yB, zr], [X[1], yT, zr], [X[1], yT, z0]], 11, M.tube, 16));
  rods.push(rodPath([[X[1], yB, z0], [X[1], yB, zr], [X[2], yT, zr], [X[2], yT, z0]], 11, M.tube, 16));
  // the long one dips under the middle coil's tapping panel so the links stay reachable
  rods.push(rodPath([[X[2], yB, z0], [X[2], yB, z2], [X[1] + 60, -(75 * sp + 60), z2], [X[1] - 60, -(75 * sp + 30), z2], [X[0], yT, z2], [X[0], yT, z0]], 11, M.tube, 40));
  // flat lugs where the tubes land on the terminal studs
  for (let k = 0; k < 3; k++)
    for (const y of [yT, yB]) {
      const lug = add(frontHW, new THREE.BoxGeometry(30, 24, 6), M.tin, [X[k], y, hv.ro + 38]);
      lug.castShadow = false;
    }
  // the HV cables from the top tray onto the upper terminals (U-V-W), cut off above the frame
  const leadTop = yokeTop + 150;
  for (let k = 0; k < 3; k++) {
    rods.push(rodPath([[X[k], yT, hv.ro + 40], [X[k], yT, zc], [X[k], leadTop, zc]], 14, M.tube, 30));
    const end = add(frontHW, new THREE.CylinderGeometry(9, 9, 6, 16), M.copper, [X[k], leadTop + 2, zc]);
    end.castShadow = false;
  }
  for (const r of rods) {
    r.castShadow = true;
    frontHW.add(r);
  }
  // earth terminal on the lower clamping, front left, with its green-yellow tag (manual 4.1, item 11)
  const earth = add(frontHW, new THREE.CylinderGeometry(12, 12, 24, 6), M.steel, [-G.len / 2 + 90, -G.win / 2 - 2 * a1 * rc * 0.3, zFace + 30]);
  earth.rotation.x = Math.PI / 2;
  add(frontHW, new THREE.PlaneGeometry(26, 60), new THREE.MeshStandardMaterial({map: canvasTex(16, 64, (g) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#e4c21a' : '#2f9a3c';
      g.fillRect(0, i * 8, 16, 8);
    }
  }), roughness: 0.6}), [-G.len / 2 + 90, -G.win / 2 - 2 * a1 * rc * 0.3 - 46, zFace + 44]);
  // a "do not touch" sign on the middle coil (manual 4.1, item 8)
  {
    const a = -0.42;
    const sign = add(frontHW, new THREE.CircleGeometry(30, 32), new THREE.MeshStandardMaterial({map: canvasTex(128, 128, (g) => {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(64, 64, 62, 0, 7);
      g.fill();
      g.strokeStyle = '#d6182b';
      g.lineWidth = 14;
      g.beginPath();
      g.arc(64, 64, 52, 0, 7);
      g.stroke();
      g.beginPath();
      g.moveTo(28, 28);
      g.lineTo(100, 100);
      g.stroke();
      g.fillStyle = '#1b1c1f';
      g.font = 'bold 40px Inter, sans-serif';
      g.textAlign = 'center';
      g.fillText('✋', 64, 78);
    }), roughness: 0.4}), [X[1] + (hv.ro + 1) * Math.sin(a), yT - 75, (hv.ro + 1) * Math.cos(a)]);
    sign.rotation.y = a;
    sign.castShadow = false;
  }

  // ------------------------------------------------------------ LV busbars and neutral at the back
  const bars = [];
  const barOut = -(hv.ro + 30);
  const barTop = yokeTop + 120;
  const nY = yokeTop + 40;
  const nZ = barOut - 46;
  for (let k = 0; k < 3; k++) {
    const r = (lv.ri + lv.ro) / 2;
    for (const [dx, top, z] of [[-42, barTop, barOut], [42, nY, nZ]]) {
      const pts = [
        [X[k] + dx, lv.h / 2 - 10, -r],
        [X[k] + dx, yGap, -r],
        [X[k] + dx, yGap, z],
        [X[k] + dx, top, z],
      ];
      const path = new THREE.CurvePath();
      for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(new V3(...pts[i]), new V3(...pts[i + 1])));
      // flat bars: a box per straight run
      for (let i = 0; i < pts.length - 1; i++) {
        const a = new V3(...pts[i]);
        const b = new V3(...pts[i + 1]);
        const len = a.distanceTo(b);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        const vertical = Math.abs(b.y - a.y) > 1;
        const m = add(root, new THREE.BoxGeometry(50, vertical ? len + 10 : 10, vertical ? 10 : len + 10), M.alu, [mid.x, mid.y, mid.z]);
        bars.push(m);
      }
    }
    const pad = add(root, new THREE.BoxGeometry(60, 12, 60), M.alu, [X[k] - 42, barTop, barOut]);
    bars.push(pad);
  }
  // the star point: one bar along the back joining the three winding ends, out to the neutral terminal 2N
  const nEnd = X[2] + 260;
  bars.push(add(root, new THREE.BoxGeometry(nEnd - (X[0] + 42) + 10, 50, 10), M.alu, [(X[0] + 42 + nEnd) / 2, nY, nZ]));
  bars.push(add(root, new THREE.BoxGeometry(50, barTop - nY + 10, 10), M.alu, [nEnd, (nY + barTop) / 2, nZ]));
  bars.push(add(root, new THREE.BoxGeometry(60, 12, 60), M.alu, [nEnd, barTop, nZ]));

  // ------------------------------------------------------------ cross-flow fans on both long sides, under the coils
  const fans = [];
  const fanY = -hv.h / 2 - 95;
  const fanZ = hv.ro + 70;
  const fanLen = Math.min(400, 1.4 * hv.ro);
  const housing = (() => {
    // a scroll in (z, y) open at the top inner corner, extruded along x
    const sh = new THREE.Shape();
    sh.moveTo(-60, 45);
    sh.lineTo(-60, -40);
    sh.quadraticCurveTo(-60, -60, -40, -60);
    sh.lineTo(55, -60);
    sh.quadraticCurveTo(70, -60, 70, -40);
    sh.lineTo(70, 60);
    sh.lineTo(10, 60);
    sh.lineTo(10, 52);
    sh.lineTo(62, 52);
    sh.lineTo(62, -40);
    sh.quadraticCurveTo(62, -52, 52, -52);
    sh.lineTo(-40, -52);
    sh.quadraticCurveTo(-52, -52, -52, -40);
    sh.lineTo(-52, 45);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, {depth: fanLen, bevelEnabled: false, curveSegments: 6});
    g.translate(0, 0, -fanLen / 2);
    g.rotateY(Math.PI / 2);
    return g;
  })();
  const bladeGeo = new THREE.BoxGeometry(fanLen - 20, 3, 18);
  for (let k = 0; k < 3; k++)
    for (const sz of [1, -1]) {
      const f = new THREE.Group();
      f.position.set(X[k], fanY, sz * fanZ);
      if (sz > 0) f.rotation.y = Math.PI; // the open slot faces the coils
      root.add(f);
      add(f, housing, M.fan);
      for (const sx of [1, -1]) add(f, new THREE.BoxGeometry(6, 122, 132), M.fan, [sx * (fanLen / 2 + 3), 0, 5]);
      const motor = add(f, new THREE.CylinderGeometry(34, 34, 70, 24), M.dark, [fanLen / 2 + 41, 0, 0]);
      motor.rotation.z = Math.PI / 2;
      const rotor = new THREE.Group();
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        const b = add(rotor, bladeGeo, M.blade, [0, 34 * Math.sin(a), 34 * Math.cos(a)]);
        b.rotation.x = -a + 0.5;
      }
      f.add(rotor);
      // the bracket down to the bottom frame
      add(root, new THREE.BoxGeometry(60, 24, 110), M.fan, [X[k], fanY - 62, sz * (chZ + flange + 55)]);
      fans.push({grp: f, rotor});
    }

  // ------------------------------------------------------------ PTC sensors: a bead at the top of each LV, wires to a box
  const ptc = [];
  const boxY = yc;
  const boxZ = chZ + chT + 30;
  const wireZ = chZ + flange + 14;
  for (let k = 0; k < 3; k++) {
    const r = lv.ri + lv.layer + 1.5 + lv.duct / 2;
    const a = -0.35;
    const bx = X[k] + r * Math.sin(a);
    const bz = r * Math.cos(a);
    const bead = add(frontHW, new THREE.SphereGeometry(9, 16, 12), M.dark.clone(), [bx, lv.h / 2 - 6, bz]);
    ptc.push(bead);
    const wx = X[1] + (k - 1) * 30;
    frontHW.add(rodPath([[bx, lv.h / 2 - 6, bz], [bx, yGap, bz], [bx, yGap, wireZ], [bx, G.win / 2 + 30, wireZ], [wx, G.win / 2 + 30, wireZ], [wx, G.win / 2 + 30, boxZ], [wx, boxY - 40, boxZ]], 3, M.wire, 6));
  }
  add(root, new THREE.BoxGeometry(150, 110, 56), M.box, [X[1], boxY, boxZ]);
  add(root, new THREE.BoxGeometry(152, 8, 58), M.dark, [X[1], boxY + 38, boxZ]);

  // ------------------------------------------------------------ rating plate (a fictional maker)
  const plateTex = canvasTex(512, 300, (g, w, h) => {
    g.fillStyle = '#e7e8ea';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#1b1c1f';
    g.lineWidth = 6;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#1b1c1f';
    g.font = 'bold 40px Inter, sans-serif';
    g.fillText(`HALVARD  CR-${R.kva}`, 26, 58);
    g.font = '26px Inter, sans-serif';
    const L = [`CAST-RESIN DRY TYPE · IEC 60076-11`, `${R.kva} / ${R.kva * 1.5} kVA · AN/AF · F/F`, `${R.U1} ±2×2.5 % / ${R.U2} V · ${R.group}`, `${R.insulation} · uk ${R.uk} % · 50 Hz`, `E2 C2 F1 · ${R.mass} kg`];
    L.forEach((s, i) => g.fillText(s, 26, 106 + i * 38));
  });
  const plate = add(root, new THREE.PlaneGeometry(220, 129), new THREE.MeshStandardMaterial({map: plateTex, roughness: 0.4, metalness: 0.3}), [-pitch * 0.55, yc, chZ + chT + 2]);
  plate.castShadow = false;

  // ------------------------------------------------------------ flux overlay: chevrons on the core's front face
  const chev = (() => {
    const sh = new THREE.Shape();
    sh.moveTo(-44, -16);
    sh.lineTo(0, 20);
    sh.lineTo(44, -16);
    sh.lineTo(44, 4);
    sh.lineTo(0, 40);
    sh.lineTo(-44, 4);
    sh.closePath();
    const g = new THREE.ShapeGeometry(sh);
    g.translate(0, -12, 0);
    return g;
  })();
  const chevMat = new THREE.MeshBasicMaterial({color: ACCENT, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide});
  const N_LIMB = 6;
  const N_YOKE = 5;
  const chevrons = new THREE.InstancedMesh(chev, chevMat, 3 * N_LIMB + 4 * N_YOKE);
  chevrons.frustumCulled = false;
  chevrons.renderOrder = 5;
  root.add(chevrons);

  // ------------------------------------------------------------ air
  const air = (() => {
    const n = 3 * 640;
    const geo = new THREE.BufferGeometry();
    const f = (k) => new Float32Array(n * k);
    const pos = f(3);
    const aX = f(1);
    const aR = f(1);
    const aAng = f(1);
    const aU0 = f(1);
    const aSpd = f(1);
    const aY = f(1);
    // a fixed seed: the cloud is the same every load
    let s = 91;
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const ducts = [
      [rc + 6, 0.16],
      [lv.ri + lv.layer + 1.5 + lv.duct / 2, 0.2],
      [(lv.ro + hv.ri) / 2, 0.34],
      [hv.ro + 16, 0.3],
    ];
    for (let i = 0; i < n; i++) {
      aX[i] = G.limbX[i % 3];
      let u = rnd();
      let d = 0;
      while (d < ducts.length - 1 && u > ducts[d][1]) u -= ducts[d++][1];
      aR[i] = ducts[d][0] + (rnd() - 0.5) * (d === 3 ? 26 : 5);
      aAng[i] = rnd() * TAU;
      aU0[i] = rnd();
      aSpd[i] = 0.8 + 0.4 * rnd();
      aY[i] = (rnd() - 0.5) * 16;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    for (const [k, a] of Object.entries({aX, aR, aAng, aU0, aSpd, aY})) geo.setAttribute(k, new THREE.BufferAttribute(a, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: AIR_VS,
      fragmentShader: AIR_FS,
      uniforms: {uPhase: {value: 0}, uSize: {value: 26}, uSection: {value: 0}, uHot: {value: 0.5}, uHalf: {value: lv.h / 2}, uOut: {value: chZ + flange + 30}, uOpacity: {value: 0.85}},
      transparent: true,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 4;
    root.add(pts);
    return pts;
  })();

  // ------------------------------------------------------------ pose
  const dummy = new THREE.Object3D();
  const col = new THREE.Color(ACCENT);
  const coreBase = new THREE.Color('#41464d');
  const coreLit = new THREE.Color('#5b6168');
  let lastCut = '';
  let lastHeat = -1;
  const applyMats = (cut, heat) => {
    for (const [m, solid, ghost] of ghostable) m.material = cut === 'xray' ? ghost : solid;
    if (heat) for (const [m, , h] of heatable) m.material = h;
    for (const m of frameMeshes) m.material = cut === 'xray' ? M.frameGhost : M.frame;
    const sec = cut === 'section';
    for (const c of coils) {
      c.full.visible = !sec;
      c.cut.visible = sec;
      c.front.visible = !sec;
      for (const m of c.pads) m.visible = !(sec && m.userData.front);
      for (const m of c.sticks) m.visible = cut === 'solid' || (sec && !m.userData.front);
    }
    frontHW.visible = !sec;
  };
  /**
   * s: {B: [3 limb flux densities, T], bpk, flux 0..1 (overlay), fluxT (chevron drift, s), cut 'solid'|'section'|'xray',
   *     heat 0|1, hs (hot spot °C), air 0..1, airPhase, airHot 0..1, fanSpin (rad), tap (float index), ptcLit 0..1}
   */
  const update = (s) => {
    const heat = s.heat ? 1 : 0;
    if (s.cut !== lastCut || heat !== lastHeat) {
      applyMats(s.cut, heat);
      lastCut = s.cut;
      lastHeat = heat;
    }
    heatLV.uniforms.uHs.value = s.hs;
    heatHV.uniforms.uHs.value = s.hs;
    // core tint by |B|, chevrons along the flux
    const B = s.B;
    const segB = [B[0], B[1], B[2], B[0], -B[2], -B[0], B[2]]; // limbs, then yokes tl, tr, bl, br (signed along +x)
    coreParts.forEach((m, i) => {
      const k = Math.min(1, Math.abs(segB[i]) / s.bpk);
      m.material.emissive.copy(col).multiplyScalar(0.4 * k * s.flux);
      m.material.color.copy(coreBase).lerp(coreLit, s.flux);
    });
    let n = 0;
    const put = (x, y, z, ang, sc) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, ang);
      dummy.scale.setScalar(Math.max(0.001, sc));
      dummy.updateMatrix();
      chevrons.setMatrixAt(n++, dummy.matrix);
    };
    const drift = s.fluxT * 0.45;
    const zc = zFace + 3;
    for (let k = 0; k < 3; k++) {
      const b = B[k] / s.bpk;
      for (let i = 0; i < N_LIMB; i++) {
        const u = (((i / N_LIMB + Math.sign(b) * drift) % 1) + 1) % 1;
        const y = -win / 2 + 30 + u * (win - 60);
        const fade = Math.sin(Math.PI * u);
        put(G.limbX[k], y, zc, b >= 0 ? 0 : Math.PI, Math.sqrt(Math.abs(b)) * fade * s.flux);
      }
    }
    const yokeSeg = [
      [-yHalf + rc, -rc, yc, segB[3]],
      [rc, yHalf - rc, yc, segB[4]],
      [-yHalf + rc, -rc, -yc, segB[5]],
      [rc, yHalf - rc, -yc, segB[6]],
    ];
    for (const [x0, x1, y, bs] of yokeSeg) {
      const b = bs / s.bpk;
      for (let i = 0; i < N_YOKE; i++) {
        const u = (((i / N_YOKE + Math.sign(b) * drift * 1.2) % 1) + 1) % 1;
        const fade = Math.sin(Math.PI * u);
        put(x0 + u * (x1 - x0), y, zc, b >= 0 ? -Math.PI / 2 : Math.PI / 2, Math.sqrt(Math.abs(b)) * fade * s.flux);
      }
    }
    chevrons.instanceMatrix.needsUpdate = true;
    chevrons.visible = s.flux > 0.01;
    chevMat.depthTest = s.cut !== 'xray';
    chevMat.opacity = 0.95 * Math.min(1, s.flux * 1.5);
    // air
    air.visible = s.air > 0.01;
    air.material.uniforms.uPhase.value = s.airPhase;
    air.material.uniforms.uHot.value = s.airHot;
    air.material.uniforms.uOpacity.value = 0.85 * s.air;
    air.material.uniforms.uSection.value = s.cut === 'section' ? 1 : 0;
    // fans, tap links, PTC beads
    for (const f of fans) f.rotor.rotation.x = s.fanSpin;
    // the tap link: between the studs of tap i; between two taps it lifts off the panel, moves and re-seats
    {
      const i = Math.max(0, Math.min(TAPS.length - 1, s.tap));
      const i0 = Math.floor(i);
      const i1 = Math.min(TAPS.length - 1, i0 + 1);
      const f = i - i0;
      const ends = (j) => TAPS[j].link.map((n) => STUD[n]);
      const [a0, b0] = ends(i0);
      const [a1_, b1_] = ends(i1);
      const ax = a0[0] + (a1_[0] - a0[0]) * f;
      const ay = a0[1] + (a1_[1] - a0[1]) * f;
      const bx = b0[0] + (b1_[0] - b0[0]) * f;
      const by = b0[1] + (b1_[1] - b0[1]) * f;
      const len = Math.hypot(bx - ax, by - ay);
      const lift = Math.sin(Math.PI * f) * 26;
      for (const c of coils) {
        c.link.position.set((ax + bx) / 2, (ay + by) / 2, 18 + lift);
        c.bar.scale.x = len + 24;
        c.bar.rotation.z = Math.atan2(by - ay, bx - ax);
        c.bolts[0].position.set(((ax - bx) / 2), (ay - by) / 2, 5);
        c.bolts[1].position.set(((bx - ax) / 2), (by - ay) / 2, 5);
      }
    }
    for (const b of ptc) b.material.emissive.set(s.ptcLit > 0.01 ? '#ff3b1f' : '#000000').multiplyScalar(s.ptcLit);
  };

  // anchor points for callouts, mm
  const A = {
    core: [G.limbX[0] - rc * 0.6, yc + a1 * rc * 0.3, zFace],
    hv: [G.limbX[2] + hv.ro * 0.7, hv.h * 0.25, hv.ro * 0.7],
    lv: [G.limbX[1] + lv.ro * 0.7, lv.h / 2 - 20, lv.ro * 0.5],
    tap: [G.limbX[0], 0, hv.ro + 36],
    tapPanel: (k) => [G.limbX[k] + 30 * sp, -26 * sp, hv.ro + 30],
    delta: [(X[0] + X[1]) / 2, 0, zr],
    deltaLong: [X[1], 0, z2],
    fan: [G.limbX[2], fanY, fanZ + 60],
    ptc: [X[1], boxY + 50, boxZ + 28],
    frame: [G.limbX[2] + 260, yc + chH / 2, chZ + flange],
    limbCut: (k) => [G.limbX[k] + hv.ro * 0.4, hv.h * 0.1, hv.ro * 0.4],
    duct: (k) => [G.limbX[k] + (lv.ro + hv.ri) / 2 * 0.7, lv.h / 2 + 30, ((lv.ro + hv.ri) / 2) * 0.7],
    lvBar: [X[2] - 42, barTop, barOut],
    neutral: [nEnd, barTop, nZ],
    hvLead: [X[0], leadTop, zc],
    earth: [-G.len / 2 + 90, -G.win / 2 - 2 * a1 * rc * 0.3, zFace + 30],
    plate: [-pitch * 0.55, yc, chZ + chT + 2],
    limb: (k) => [G.limbX[k], 0, zFace],
    yokeTop: yokeTop,
    // on the half section's faces (z = 0), right of the axis
    lvFace: (k) => [G.limbX[k] + (lv.ri + lv.ro) / 2, lv.h * 0.3, 0],
    lvFaceL: (k) => [G.limbX[k] - (lv.ri + lv.ro) / 2, lv.h * 0.3, 0],
    hvFace: (k) => [G.limbX[k] + (hv.ri + hv.ro) / 2, hv.h * 0.12, 0],
    ductFace: (k) => [G.limbX[k] + (lv.ro + hv.ri) / 2, lv.h * 0.4, 0],
    coreFront: (k) => [G.limbX[k], -win * 0.25, zFace],
    coilFront: (k) => [G.limbX[k], hv.h * 0.32, hv.ro],
    ductTop: (k) => [G.limbX[k] + ((lv.ro + hv.ri) / 2) * 0.7, lv.h / 2, ((lv.ro + hv.ri) / 2) * 0.7],
    pad: [G.limbX[2] + ((hv.ri + hv.ro) / 2) * 0.707, hv.h / 2 + 20, ((hv.ri + hv.ro) / 2) * 0.707],
  };
  root.scale.setScalar(0.001);
  const setPointScale = (k) => (air.material.uniforms.uSize.value = 26 * k);
  return {root, update, M, coils, fans, A, TAPS, setPointScale, air};
}
