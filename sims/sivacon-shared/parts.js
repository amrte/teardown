// Materials, procedural textures and geometry helpers for the switchboard. Everything is in millimetres; the board's
// root is scaled by 0.001. No layout decisions live here, only how a sheet, a profile, a bar or a bolt looks.
import * as THREE from 'three';

// ------------------------------------------------------------ procedural textures
const canvasTex = (w, h, draw, {srgb = true, repeat = false} = {}) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
};

// the frame profile's hole row: one 25 mm pitch cell, a square hole in the middle (alpha map, black = hole)
const holeCell = () =>
  canvasTex(
    64,
    64,
    (g) => {
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#000';
      g.fillRect(22, 22, 20, 20);
    },
    {srgb: false, repeat: true},
  );
// a ventilation grille cell: one slot per cell, rounded ends
const slotCell = () =>
  canvasTex(
    64,
    64,
    (g) => {
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#000';
      g.beginPath();
      g.roundRect(8, 26, 48, 12, 6);
      g.fill();
    },
    {srgb: false, repeat: true},
  );
// perforated mounting plate / shutter: round holes on a 10 mm grid
const perfCell = () =>
  canvasTex(
    32,
    32,
    (g) => {
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 32, 32);
      g.fillStyle = '#000';
      g.beginPath();
      g.arc(16, 16, 7, 0, Math.PI * 2);
      g.fill();
    },
    {srgb: false, repeat: true},
  );

// ------------------------------------------------------------ materials
export function makeMaterials() {
  const holes = holeCell();
  const slots = slotCell();
  const perf = perfCell();
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    // RAL 7035 light grey, powder-coated: doors, side walls, roof, rear walls
    sheet: std({color: '#d4d6d3', roughness: 0.62, metalness: 0.0, envMapIntensity: 0.6}),
    sheetIn: std({color: '#c9cbc8', roughness: 0.7, metalness: 0.0, envMapIntensity: 0.5, side: THREE.DoubleSide}),
    // sendzimir zinc-plated sheet steel: frame profiles, partitions, mounting plates, rails
    zinc: std({color: '#b9bec4', roughness: 0.45, metalness: 0.75, envMapIntensity: 0.55}),
    zincHoles: std({color: '#b4b9bf', roughness: 0.45, metalness: 0.75, envMapIntensity: 0.55, alphaMap: holes, alphaTest: 0.5, side: THREE.DoubleSide}),
    zincSlots: std({color: '#b4b9bf', roughness: 0.45, metalness: 0.7, envMapIntensity: 0.5, alphaMap: slots, alphaTest: 0.5, side: THREE.DoubleSide}),
    zincPerf: std({color: '#b4b9bf', roughness: 0.45, metalness: 0.7, envMapIntensity: 0.5, alphaMap: perf, alphaTest: 0.5, side: THREE.DoubleSide}),
    sheetSlots: std({color: '#d4d6d3', roughness: 0.62, metalness: 0.0, envMapIntensity: 0.6, alphaMap: slots, alphaTest: 0.5, side: THREE.DoubleSide}),
    alu: std({color: '#c6c9cc', roughness: 0.38, metalness: 0.85, envMapIntensity: 0.6}),
    // design side wall, Blue Green Basic
    design: std({color: '#1d4b52', roughness: 0.55, metalness: 0.05}),
    // base / plinth, RAL 9005-ish
    plinth: std({color: '#2b2d31', roughness: 0.6, metalness: 0.1}),
    // bare and tin-plated copper
    copper: std({color: '#c8784a', roughness: 0.34, metalness: 0.95, envMapIntensity: 0.6}),
    copperTin: std({color: '#c9c9c4', roughness: 0.32, metalness: 0.9, envMapIntensity: 0.6}),
    // PE bar marking green-yellow is a stripe texture
    pe: std({color: '#c8784a', roughness: 0.34, metalness: 0.95, envMapIntensity: 0.6}),
    // glass-fibre reinforced polyester supports and insulating parts
    insul: std({color: '#3b3e44', roughness: 0.7, metalness: 0.0}),
    insulRed: std({color: '#8a2f2a', roughness: 0.65, metalness: 0.0}),
    // device housings
    dev: std({color: '#4a4e55', roughness: 0.55, metalness: 0.05}),
    devLight: std({color: '#e3e4e2', roughness: 0.5, metalness: 0.0}),
    devDark: std({color: '#24262a', roughness: 0.5, metalness: 0.05}),
    // steel hardware: zinc flake bolts, nuts, washers
    bolt: std({color: '#a9adb2', roughness: 0.35, metalness: 0.9}),
    brass: std({color: '#b89a5a', roughness: 0.35, metalness: 0.9}),
    black: std({color: '#1c1d20', roughness: 0.45, metalness: 0.1}),
    rubber: std({color: '#202124', roughness: 0.9, metalness: 0.0}),
    // transparent covers (arc-fault / touch protection)
    clear: new THREE.MeshPhysicalMaterial({color: '#ffffff', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide}),
    // glass mode for the enclosure
    ghost: new THREE.MeshStandardMaterial({color: '#cfd6dc', roughness: 0.3, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide}),
    // accents
    accent: std({color: '#d6182b', roughness: 0.5, metalness: 0.0}),
    green: std({color: '#2e9d4a', roughness: 0.5}),
    yellow: std({color: '#e7c11e', roughness: 0.5}),
    blue: std({color: '#2f6fc2', roughness: 0.5}),
    cable: std({color: '#2a2b2e', roughness: 0.75, metalness: 0}),
    cableBlue: std({color: '#2c5aa0', roughness: 0.75}),
    cableGY: std({color: '#8fb33a', roughness: 0.75}),
    cableBrown: std({color: '#5a3a24', roughness: 0.75}),
    cableGrey: std({color: '#8a8d90', roughness: 0.75}),
    lamp: new THREE.MeshStandardMaterial({color: '#2e9d4a', emissive: '#2e9d4a', emissiveIntensity: 0.6, roughness: 0.4}),
    lampRed: new THREE.MeshStandardMaterial({color: '#d6182b', emissive: '#d6182b', emissiveIntensity: 0.5, roughness: 0.4}),
  };
  // the green-yellow PE stripe
  M.peStripe = std({
    map: canvasTex(
      64,
      8,
      (g) => {
        for (let i = 0; i < 8; i++) {
          g.fillStyle = i % 2 ? '#e7c11e' : '#2e9d4a';
          g.fillRect(i * 8, 0, 8, 8);
        }
      },
      {repeat: true},
    ),
    roughness: 0.5,
  });
  return M;
}

// a label texture: dark text on a plate, sized in mm
const labelCache = new Map();
export function labelTex(lines, {w = 256, h = 64, bg = '#f4f4f2', fg = '#16181b', font = 600, size = 30, align = 'center'} = {}) {
  const key = JSON.stringify([lines, w, h, bg, fg, font, size, align]);
  if (labelCache.has(key)) return labelCache.get(key);
  const t = canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.textAlign = align;
    g.textBaseline = 'middle';
    const ls = Array.isArray(lines) ? lines : [lines];
    ls.forEach((s, i) => {
      g.font = `${i ? 500 : font} ${i ? size * 0.62 : size}px Inter, sans-serif`;
      const y = h / 2 + (i - (ls.length - 1) / 2) * size * 1.05;
      g.fillText(s, align === 'center' ? w / 2 : 10, y);
    });
  });
  labelCache.set(key, t);
  return t;
}

// a device face drawn on canvas: breaker fronts, the meter, the withdrawable unit front
export function faceTex(w, h, draw) {
  return canvasTex(w, h, draw);
}

// ------------------------------------------------------------ geometry
const geoCache = new Map();
const cached = (key, make) => {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
};
// a box whose UVs are world-scaled: one texture cell per `pitch` mm, so hole rows and slots keep their real pitch
export function boxGeo(w, h, d, pitch = 0) {
  return cached(`box${w}|${h}|${d}|${pitch}`, () => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (pitch) {
      const p = g.attributes.position;
      const n = g.attributes.normal;
      const uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const nx = Math.abs(n.getX(i));
        const ny = Math.abs(n.getY(i));
        const [a, b] = nx > 0.5 ? [p.getZ(i), p.getY(i)] : ny > 0.5 ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
        uv.setXY(i, a / pitch + 0.5, b / pitch + 0.5);
      }
    }
    return g;
  });
}
export const cylGeo = (r, h, seg = 16, r2 = r) => cached(`cyl${r}|${h}|${seg}|${r2}`, () => new THREE.CylinderGeometry(r2, r, h, seg));
// a hexagon prism (bolt head, nut), axis along y
export const hexGeo = (s, h) => cached(`hex${s}|${h}`, () => new THREE.CylinderGeometry(s / Math.sqrt(3), s / Math.sqrt(3), h, 6));
// a rounded rectangle plate extruded along z (door seals, handles, cut-outs)
export function plateGeo(w, h, d, r = 2, holes = []) {
  return cached(`plate${w}|${h}|${d}|${r}|${JSON.stringify(holes)}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    for (const [x, y, hw, hh, rr] of holes) {
      const p = new THREE.Path();
      if (rr) p.absarc(x, y, rr, 0, Math.PI * 2, true);
      else {
        p.moveTo(x - hw / 2, y - hh / 2);
        p.lineTo(x - hw / 2, y + hh / 2);
        p.lineTo(x + hw / 2, y + hh / 2);
        p.lineTo(x + hw / 2, y - hh / 2);
      }
      s.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(s, {depth: d, bevelEnabled: false, curveSegments: 4});
    g.translate(0, 0, -d / 2);
    return g;
  });
}
// a bent bar along a polyline in the x-y plane, rectangular section t (in plane) x b (out of plane)
export function bentBarGeo(pts, t, b) {
  return cached(`bent${JSON.stringify(pts)}|${t}|${b}`, () => {
    const geos = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0) + t;
      const g = new THREE.BoxGeometry(len, t, b);
      g.rotateZ(Math.atan2(y1 - y0, x1 - x0));
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
      geos.push(g);
    }
    return mergeGeos(geos);
  });
}
// merge non-indexed or indexed geometries with the same attributes (position, normal, uv)
export function mergeGeos(geos) {
  const out = new THREE.BufferGeometry();
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const name of ['position', 'normal', 'uv']) {
    const size = parts[0].attributes[name].itemSize;
    const total = parts.reduce((s, g) => s + g.attributes[name].count, 0);
    const arr = new Float32Array(total * size);
    let o = 0;
    for (const g of parts) {
      arr.set(g.attributes[name].array, o);
      o += g.attributes[name].count * size;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}
// a hollow rectangular frame (door frame, cut-out surround) as 4 boxes merged
export function ringGeo(w, h, d, bar) {
  return cached(`ring${w}|${h}|${d}|${bar}`, () => {
    const a = new THREE.BoxGeometry(w, bar, d).translate(0, h / 2 - bar / 2, 0);
    const b = new THREE.BoxGeometry(w, bar, d).translate(0, -h / 2 + bar / 2, 0);
    const c = new THREE.BoxGeometry(bar, h - 2 * bar, d).translate(-w / 2 + bar / 2, 0, 0);
    const e = new THREE.BoxGeometry(bar, h - 2 * bar, d).translate(w / 2 - bar / 2, 0, 0);
    return mergeGeos([a, b, c, e]);
  });
}
// a cable: a tube along a few points
export function cableGeo(pts, r) {
  return cached(`cable${JSON.stringify(pts)}|${r}`, () => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.2);
    return new THREE.TubeGeometry(curve, Math.max(8, pts.length * 8), r, 10, false);
  });
}
