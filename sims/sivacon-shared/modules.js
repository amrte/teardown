// What fills a device compartment, one builder per module kind, in field coordinates (mm). Each builder gets the
// module, its index and the box it occupies ({x0, x1, y0, y1}; z runs from the device compartment's rear, zSep, to
// the front frame plane, 0) and returns the outgoing feeders it brings to the cable compartment.
// The withdrawable unit follows OI OFFW p.12–16: chassis 507 mm wide, input contact system at the rear left plugging
// onto the vertical distribution bars, output contact system at the rear right into the outgoing feeder housing,
// control plug on the right side wall, ratchet levers at both bottom front corners, the gate valve in front of the
// tool opening, the position indicator (green 0 · blue TEST · red I) and the swing-out instrument panel. In HFD units
// the body stays latched and only the contact systems travel; SFD units slide as a whole.
import * as THREE from 'three';
import {BREAKERS, MODULE_KINDS, UNIT_W} from './catalog.js';
import {bb, buildDoor, bx, cy, label, mk, part} from './cabinet.js';
import {faceTex, plateGeo, cableGeo} from './parts.js';

// travel of the contact systems (HFD) or of the whole unit (SFD, ACB) per position, mm [inferred, OI gives no number]
const CONTACT = {connected: 0, test: 12, disconnected: 26, removed: 26};
const SLIDE = {connected: 0, test: 16, disconnected: 32, removed: 32};
const ACB = {connected: 0, test: 60, disconnected: 115, removed: 115};
const OUT = 520; // drawn fully out of the compartment
const IND = {connected: ['#d6182b', 'I'], test: ['#2f6fc2', 'TEST'], disconnected: ['#2e9d4a', '0'], removed: ['#2e9d4a', '0']};
// a running board: units default to CONNECTED (they ship in DISCONNECTED, OI OFFW p.27)
const posOf = (m) => m.pos || 'connected';

const indMats = {};
const indMat = (pos) => {
  if (!indMats[pos]) {
    const [c, t] = IND[pos];
    const tex = faceTex(64, 32, (g) => {
      g.fillStyle = c;
      g.fillRect(0, 0, 64, 32);
      g.fillStyle = '#fff';
      g.font = '700 20px Inter, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(t, 32, 17);
    });
    indMats[pos] = new THREE.MeshStandardMaterial({map: tex, roughness: 0.5, emissive: c, emissiveIntensity: 0.15});
  }
  return indMats[pos];
};
// the position indicator: a little window whose colour follows the module's position, set every frame
const indicator = (ctx, g, m, x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 15), indMat(posOf(m)));
  mesh.position.set(x, y, z);
  mesh.userData.keep = true;
  g.add(mesh);
  ctx.ticks.push(() => (mesh.material = indMat(posOf(m))));
  bx(g, 36, 21, 2, ctx.M.black, x, y, z - 1.2);
};

// a 3VA moulded-case breaker body facing the front, w x h x d
const mccb = (g, M, x, y, z, w, h, d) => {
  bx(g, w, h, d, M.dev, x, y, z);
  bx(g, w * 0.7, h * 0.32, 3, M.devLight, x, y + h * 0.18, z + d / 2 + 1.5);
  bx(g, w * 0.2, h * 0.18, 14, M.black, x, y - h * 0.1, z + d / 2 + 7);
  for (let p = 0; p < 3; p++) {
    bx(g, w * 0.22, h * 0.14, d * 0.5, M.devDark, x + (p - 1) * w * 0.3, y + h / 2 + h * 0.07, z);
    bx(g, w * 0.22, h * 0.14, d * 0.5, M.devDark, x + (p - 1) * w * 0.3, y - h / 2 - h * 0.07, z);
  }
};
// a contactor / relay block
const contactor = (g, M, x, y, z, w, h, d) => {
  bx(g, w, h, d, M.devLight, x, y, z);
  bx(g, w * 0.85, h * 0.2, 4, M.devDark, x, y + h * 0.12, z + d / 2 + 2);
  bx(g, w * 0.3, h * 0.12, 3, M.green, x - w * 0.25, y - h * 0.25, z + d / 2 + 1.5);
};

/** standard (HFD/SFD) and small withdrawable units */
export function unitWithdrawable(ctx, m, j, box, out) {
  const {M, hw} = ctx;
  const K = MODULE_KINDS[m.kind];
  const small = m.kind === 'small';
  const hfd = m.kind !== 'sfd';
  const cols = small ? m.cols || 4 : 1;
  const Dd = -ctx.zSep;
  const ud = Math.min(small ? 300 : 400, Dd - 90);
  const cw = (box.x1 - box.x0) / cols;
  const h = box.y1 - box.y0;
  // compartment: bottom plate (Fachboden, compartment-to-compartment separation) and the support plate
  const comp = part(ctx, {name: `Compartment bottom ${ctx.R.loc(ctx.i, j)}`, layer: 'inner', stage: 'inner', module: j, at: [(box.x0 + box.x1) / 2, box.y0 + 1, ctx.zSep / 2], dir: [0, 0, 1], dist: 420 + j * 10, lines: ['Fachboden: compartment to compartment', 'Padlock hole Ø6 in the left bent edge', 'Pull out forward, reinsert into the rear slot']});
  bx(comp, box.x1 - box.x0, 2, Dd - 20, M.zinc, 0, 0, 0);
  bx(comp, box.x1 - box.x0, 22, 2, M.zinc, 0, 10, Dd / 2 - 12);
  if (small) {
    // the miniature adapter plate at the top of the compartment and the snap-fit separating plates
    bx(comp, box.x1 - box.x0 - 20, 30, 3, M.zincPerf, 0, h - 18, -Dd / 2 + 70, 10);
    for (let c = 1; c < cols; c++) bx(comp, 1.5, h - 4, ud, M.zinc, -((box.x1 - box.x0) / 2) + c * cw, h / 2, Dd / 2 - 20 - ud / 2);
  }
  for (let c = 0; c < cols; c++) {
    const uw = small ? cw - 8 : UNIT_W;
    const uh = h - (small ? 12 : 22);
    const cx = box.x0 + cw * (c + 0.5);
    const cyy = box.y0 + 4 + uh / 2;
    const cz = -14 - ud / 2;
    const slot = small ? c * (4 / cols) + 1 : 1;
    const loc = ctx.R.loc(ctx.i, j, slot);
    const pos = () => posOf(m);
    const g = part(ctx, {
      name: `${K.name}${small ? ` 1/${cols}` : ''} · ${loc}`,
      layer: 'unit',
      stage: 'units',
      module: j,
      at: [cx, cyy, cz],
      dir: [0, 0.04, 1],
      dist: 620 + (small ? 50 * c : 0) + (j % 2) * 80,
      draw: () => (pos() === 'removed' ? OUT : hfd ? 0 : SLIDE[pos()]),
      lines: [`${m.label || K.label} · ${h} mm${small ? ` · 1/${cols} width` : ' · 507 mm wide'}`, ...K.lines.slice(0, 2), `Position: ${'%POS%'}`],
    });
    g.userData.part.posOf = pos;
    // chassis: floor, sides, the instrument panel in front, a cross brace
    bx(g, uw, 2, ud, M.zinc, 0, -uh / 2 + 1, 0);
    bx(g, 2, uh, ud, M.zinc, -uw / 2 + 1, 0, 0);
    bx(g, 2, uh, ud, M.zinc, uw / 2 - 1, 0, 0);
    bx(g, uw - 4, 14, 2, M.zinc, 0, uh / 2 - 7, -ud / 2 + 20);
    // the swing-out instrument panel
    const ip = part(ctx, {parent: g, sub: true, name: 'Instrument panel (swing-out)', layer: 'unit', stage: 'units', module: j, at: [0, 0, ud / 2 - 2], lines: [`Usable ${small ? (uh > 120 ? '94 × 88' : '94 × 38') : uh > 100 ? '190 × 96' : '190 × 51.5'} mm`, 'Opens up-left, then swings', 'Max device depth 60–70 mm']});
    mk(ip, plateGeo(uw - 6, uh - 4, 3, 2, [[-uw * 0.18, 0, Math.min(70, uw * 0.24), Math.min(uh - 30, 60), 0]]), M.zinc, 0, 0, 0);
    label(ip, [loc, m.label || K.label], Math.min(uw - 30, 150), Math.min(24, uh * 0.22), uw * 0.18, uh / 2 - Math.min(24, uh * 0.22) / 2 - 6, 1.8, {pw: 300, ph: 56, size: 22, bg: '#ffffff'});
    // the main switch actuator (rotary handle, door-coupled through the compartment door)
    const hx = -uw * 0.18;
    const hr = Math.min(24, uh * 0.22);
    cy(ip, hr, 10, M.devDark, hx, 0, 6, {rx: Math.PI / 2, seg: 24});
    bx(ip, hr * 0.55, hr * 2.6, 12, M.black, hx, 0, 16);
    bx(ip, hr * 0.25, hr * 0.8, 2, M.yellow, hx, hr * 0.8, 22.5);
    // the position indicator and the gate valve in front of the tool opening
    indicator(ctx, ip, m, uw * 0.12, -uh / 2 + Math.min(18, uh * 0.2) + 2, 2.4);
    cy(ip, 7, 3, M.black, uw * 0.3, -uh / 2 + Math.min(18, uh * 0.2) + 2, 1.6, {rx: Math.PI / 2});
    bx(ip, 30, 14, 2, M.devLight, uw * 0.3 + 14, -uh / 2 + Math.min(18, uh * 0.2) + 2, 3, 0, {keep: true});
    // padlock hasp Ø6
    bx(ip, 10, 18, 3, M.bolt, uw * 0.42, -uh / 2 + Math.min(18, uh * 0.2) + 2, 3);
    // ratchet levers at both bottom front corners
    for (const sx of small ? [-1] : [-1, 1]) {
      const lv = part(ctx, {parent: g, sub: true, name: `Ratchet lever ${sx < 0 ? 'left' : 'right'}`, layer: 'unit', stage: 'units', module: j, at: [sx * (uw / 2 - 14), -uh / 2 + 8, ud / 2 + 4], lines: ['Lift to stop to release the unit', 'Latches down into the compartment bottom']});
      bx(lv, 16, 10, 22, M.accent, 0, 0, 0);
    }
    // devices on the chassis: MCCB, contactor and overload relay as the label calls for
    const dh = Math.min(uh - 30, small ? 110 : 190);
    const dz = ud / 2 - 30 - 55;
    if (!small) {
      mccb(g, M, -uw * 0.18, -uh / 2 + dh / 2 + 6, dz, Math.min(140, uw * 0.24), dh, 90);
      if (/DOL|kW|3RV/.test(m.label || '')) {
        contactor(g, M, uw * 0.08, -uh / 2 + Math.min(dh, 120) / 2 + 6, dz - 20, 70, Math.min(dh, 120), 110);
        contactor(g, M, uw * 0.24, -uh / 2 + Math.min(dh, 90) / 2 + 6, dz - 20, 55, Math.min(dh, 90), 90);
      } else {
        bx(g, 90, Math.min(dh, 70), 60, M.devLight, uw * 0.16, -uh / 2 + Math.min(dh, 70) / 2 + 6, dz);
      }
      // terminal rail and a few wires
      bx(g, uw * 0.6, 8, 35, M.zinc, uw * 0.06, -uh / 2 + 6, -ud / 2 + 70);
      for (let k = 0; k < 8; k++) bx(g, 6, 34, 30, k % 4 === 3 ? M.blue : M.devLight, -uw * 0.22 + k * 8, -uh / 2 + 24, -ud / 2 + 70);
      mk(g, cableGeo([[-uw * 0.18, uh / 2 - 30, dz - 30], [0, uh / 2 - 20, -ud / 2 + 40], [uw * 0.38, uh / 2 - 26, -ud / 2 + 20]], 4), M.cableGrey, 0, 0, 0, {shadow: false});
    } else {
      contactor(g, M, 0, -uh / 2 + dh / 2 + 6, dz, Math.min(uw - 30, 45), dh, 90);
    }
    // the contact systems at the rear: HFD/small: they travel, SFD: fixed to the body
    const cs = part(ctx, {
      parent: g,
      sub: true,
      name: 'Input contact system L1 L2 L3 N',
      layer: 'unit',
      stage: 'units',
      module: j,
      at: [small ? 0 : -uw * 0.22, small ? uh / 2 - 22 : 0, -ud / 2 + 4],
      draw: hfd ? () => CONTACT[pos()] : null,
      lines: ['Silver-plated tulip contacts', 'Plug onto the vertical distribution bar', 'Grease: Klüber Isoflex Topas NB 52'],
    });
    const nc = small ? 3 : 4;
    const pitch = small ? Math.min(14, (uw - 20) / 4) : 46;
    bx(cs, nc * pitch + 14, small ? 26 : Math.min(60, uh - 40), 26, M.insul, 0, 0, 0);
    hw.fingers(cs, [0, 0, -20], nc, pitch, [small ? 8 : 18, small ? 18 : Math.min(44, uh - 52), 12], {title: 'Input contact fingers', lines: ['Silver-plated Cu tulip, spring loaded', `${nc} poles · travel ${CONTACT.disconnected} mm [inferred]`, 'Mates through the bus duct openings']});
    if (!small) {
      const co = part(ctx, {
        parent: g,
        sub: true,
        name: 'Output contact system L1 L2 L3',
        layer: 'unit',
        stage: 'units',
        module: j,
        at: [uw * 0.3, 0, -ud / 2 + 4],
        draw: hfd ? () => CONTACT[pos()] : null,
        lines: ['Plugs into the outgoing feeder housing', 'Cu links to the cable compartment terminals'],
      });
      bx(co, 3 * 40 + 14, Math.min(60, uh - 40), 26, M.insul, 0, 0, 0);
      hw.fingers(co, [0, 0, -20], 3, 40, [16, Math.min(44, uh - 52), 12], {title: 'Output contact fingers', lines: ['Silver-plated Cu tulip, spring loaded', '3 poles']});
      // the control plug on the right side wall
      const cp = part(ctx, {parent: g, sub: true, name: 'Control plug', layer: 'unit', stage: 'units', module: j, at: [uw / 2 + 6, uh / 2 - 26, -ud / 2 + 40], draw: hfd ? () => (pos() === 'disconnected' || pos() === 'removed' ? 14 : 0) : null, lines: ['Up to 40 aux contacts, 10 A 250 V', 'Closed in TEST and CONNECTED', 'Push-in terminals 0.35–2.5 mm²']});
      bx(cp, 12, 30, 60, M.devDark, 0, 0, 0);
    }
    out.push({j, y: box.y0 + h / 2, h, amps: /630|400|90 kW|315/.test(m.label || '') ? 400 : small ? 35 : 160, label: m.label || K.label, loc});
    // the compartment door (one per slot for small units)
    const dw = small ? cw : box.x1 - box.x0 + 40;
    const dx = small ? box.x0 + cw * c - (c === 0 ? 40 : 0) : box.x0 - 40;
    buildDoor(ctx, {
      name: `Compartment door ${loc}`,
      module: j,
      x: dx,
      y: box.y0,
      w: small && c === 0 ? dw + 40 : dw,
      h,
      lock: 'quarter',
      lockY: 0,
      cut: [[(cx - dx) - (small && c === 0 ? dw + 40 : dw) / 2 + hx, cyy - box.y0 - h / 2, hr * 2 + 14, Math.min(hr * 2 + 14, h - 30)], [(cx - dx) - (small && c === 0 ? dw + 40 : dw) / 2 + uw * 0.12, -h / 2 + Math.min(18, uh * 0.2) + 6 + 4, 40, 20]],
      open: () => (pos() === 'removed' ? 1 : 0),
      dist: 1000 + j * 8,
      lines: ['Compartment door, Form 4b', 'Positions are changed with the door closed', 'Door-coupled rotary drive interlock'],
    });
  }
}

/** fixed-mounted module behind a compartment door, or a reserve compartment */
export function fixedModule(ctx, m, j, box, out, {door = true} = {}) {
  const {M, hw} = ctx;
  const K = MODULE_KINDS[m.kind];
  const h = box.y1 - box.y0;
  const w = box.x1 - box.x0;
  const loc = ctx.R.loc(ctx.i, j);
  const Dd = -ctx.zSep;
  const comp = part(ctx, {name: `Compartment bottom ${loc}`, layer: 'inner', stage: 'inner', module: j, at: [(box.x0 + box.x1) / 2, box.y0 + 1, ctx.zSep / 2], dir: [0, 0, 1], dist: 650 + j * 10, lines: ['Compartment to compartment separation']});
  bx(comp, w, 2, Dd - 20, M.zinc, 0, 0, 0);
  if (m.kind !== 'empty') {
    const g = part(ctx, {name: `${K.name} · ${loc}`, layer: 'unit', stage: 'units', module: j, at: [(box.x0 + box.x1) / 2, box.y0 + h / 2, ctx.zSep + 60], dir: [0, 0.05, 1], dist: 820, lines: [`${m.label || K.label} · ${h} mm`, ...K.lines.slice(0, 2)]});
    // mounting plate on the rear and the device
    bx(g, w - 30, h - 20, 3, M.zincPerf, 0, 0, -20, 10);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) hw.screw(g, [sx * (w / 2 - 30), sy * (h / 2 - 25), -18], [0, 0, 1], 6, 'Mounting plate');
    if (/3NP/.test(m.label || '')) {
      // a 3NP1 fuse switch disconnector: body, the hinged fuse cover and its handle
      const dw = Math.min(w * 0.42, 210);
      const dh = Math.min(h - 40, 260);
      bx(g, dw, dh, 150, M.dev, -w * 0.12, 0, 60);
      bx(g, dw * 0.9, dh * 0.7, 10, M.devDark, -w * 0.12, 0, 140);
      bx(g, dw * 0.5, 24, 30, M.black, -w * 0.12, dh * 0.3, 155);
      for (let p = 0; p < 3; p++) bx(g, 18, 30, 40, M.copperTin, -w * 0.12 + (p - 1) * dw * 0.3, dh / 2 + 15, 40);
    } else {
      mccb(g, M, -w * 0.12, 0, 60, Math.min(140, w * 0.25), Math.min(h - 40, 190), 100);
    }
    bx(g, 120, Math.min(h - 50, 80), 60, M.devLight, w * 0.25, -h * 0.15, 30);
    out.push({j, y: box.y0 + h / 2, h, amps: /630|400/.test(m.label || '') ? 400 : 160, label: m.label || K.label, loc});
  }
  if (door)
    buildDoor(ctx, {
      name: m.kind === 'empty' ? `Blank door ${loc}` : `Compartment door ${loc}`,
      module: j,
      x: box.x0 - 40,
      y: box.y0,
      w: w + 40,
      h,
      lock: 'quarter',
      cut: m.kind === 'empty' ? [] : [[-w * 0.12 + 20, 0, 70, Math.min(70, h - 40)]],
      dist: 1000 + j * 8,
      lines: m.kind === 'empty' ? ['Blanking door for the reserve compartment', h <= 100 ? '8PQ2010-0AA06' : h <= 150 ? '8PQ2020-0AA25' : '8PQ2000-0AC22'] : ['Compartment door with handle cut-out', 'Form 3b / 4a / 4b'],
    });
}

/** the 3NJ63 adapter at the bottom of a universal field: five plug-in strips on 60 x 10 vertical bars */
export function plugAdapter(ctx, m, j, box, out) {
  const {M} = ctx;
  const h = box.y1 - box.y0;
  const w = box.x1 - box.x0;
  const loc = ctx.R.loc(ctx.i, j);
  const bars = part(ctx, {name: `3NJ63 adapter bars ${loc}`, layer: 'busbar', stage: 'devices', module: j, at: [(box.x0 + box.x1) / 2, box.y0 + h / 2, ctx.zSep + 40], dir: [0, 0, 1], dist: 600, lines: ['Vertical bars 60 × 10 Cu, 1560 A', 'Covered IP2X', '500 mm usable for strips']});
  for (let p = 0; p < 3; p++) bx(bars, 60, h - 40, 10, M.copper, (p - 1) * 120, 0, 0);
  bx(bars, w - 20, h - 30, 2, M.clear, 0, 0, 30, 0, {shadow: false});
  const sh = [50, 100, 100, 100, 150];
  let y = box.y1 - 50;
  sh.forEach((s, k) => {
    strip63(ctx, {kind: s === 50 ? 'nj00' : s === 150 ? 'nj2' : 'nj1', h: s, label: ''}, j, {x0: box.x0, x1: box.x1, y0: y - s, y1: y}, out, k);
    y -= s;
  });
  buildDoor(ctx, {name: `Compartment door ${loc}`, module: j, x: box.x0 - 40, y: box.y0, w: w + 40, h, lock: 'quarter', vent: [[h / 2 - 40, 40], [-h / 2 + 40, 40]], dist: 1000, lines: ['3NJ63 compartment door', 'Ventilated']});
}

/** a horizontal 3NJ63 plug-in fuse switch-disconnector strip, or a ventilated blanking cover */
export function strip63(ctx, m, j, box, out, sub = 0) {
  const {M, hw} = ctx;
  const K = MODULE_KINDS[m.kind];
  const h = box.y1 - box.y0;
  const w = Math.min(box.x1 - box.x0, 600) - 20;
  const cx = (box.x0 + box.x1) / 2;
  const loc = ctx.R.loc(ctx.i, j);
  if (m.kind === 'blank') {
    const g = part(ctx, {name: `Blanking cover ${h} mm · ${loc}`, layer: 'unit', stage: 'units', module: j, at: [cx, box.y0 + h / 2, -30], dir: [0, 0, 1], dist: 500, lines: K.lines});
    bx(g, w, h - 2, 2, h === 50 ? M.devDark : M.zincSlots, 0, 0, 0, 12);
    return;
  }
  const g = part(ctx, {name: `${K.name} · ${loc}${sub ? '.' + sub : ''}`, layer: 'unit', stage: 'units', module: j, at: [cx, box.y0 + h / 2, -30 - 90], dir: [0, 0.03, 1], dist: 700, lines: [`${m.label || K.label} · ${h} mm`, ...K.lines.slice(1)]});
  // base with plug-in contacts at the rear, three fuse covers in front (one per phase), the handle bar
  bx(g, w, h - 4, 150, M.devDark, 0, 0, 0);
  const fw = (w - 80) / 3;
  for (let p = 0; p < 3; p++) {
    bx(g, fw - 8, h - 14, 12, M.dev, -w / 2 + 40 + fw * (p + 0.5), 0, 81);
    bx(g, fw * 0.5, Math.max(6, h * 0.16), 6, M.devLight, -w / 2 + 40 + fw * (p + 0.5), h * 0.18, 89, 0, {keep: true});
    bx(g, 22, h - 18, 30, M.copperTin, -w / 2 + 40 + fw * (p + 0.5), 0, -88);
  }
  bx(g, 28, h - 10, 30, M.black, w / 2 - 22, 0, 85);
  bx(g, 24, Math.min(h - 16, 40), 14, M.green, -w / 2 + 18, 0, 81);
  for (const sx of [-1, 1]) hw.screw(g, [sx * (w / 2 - 6), 0, 76], [0, 0, 1], 6, 'Strip latch');
  out.push({j, y: box.y0 + h / 2, h, amps: m.kind === 'nj3' ? 450 : m.kind === 'nj2' ? 320 : m.kind === 'nj1' ? 200 : 125, label: K.name.split(' ·')[0], loc});
}

/** a vertical 3NJ4 strip on the horizontal distribution busbar */
export function strip4(ctx, m, j, x0, w, yMid, out) {
  const {M, hw} = ctx;
  const K = MODULE_KINDS[m.kind];
  const sh = m.kind === 'nj410' ? 560 : 740;
  const g = part(ctx, {name: `${K.name} · slot ${j + 1}`, layer: 'unit', stage: 'units', module: j, at: [x0 + w / 2, yMid, -150], dir: [0, 0.05, 1], dist: 700 + j * 18, lines: [`${K.label} · ${w} mm wide`, ...K.lines.slice(1)]});
  bx(g, w - 3, sh, 160, M.devDark, 0, 0, 0);
  const n = 3;
  for (let p = 0; p < n; p++) {
    const yy = sh / 2 - sh / n * (p + 0.5);
    bx(g, w - 10, sh / n - 16, 14, M.dev, 0, yy, 86);
    bx(g, (w - 10) * 0.5, 22, 5, M.devLight, 0, yy + sh / n * 0.22, 95, 0, {keep: true});
  }
  bx(g, w * 0.6, 60, 40, M.black, 0, -sh / 2 + 70, 98);
  // terminals at both ends
  for (const sy of [-1, 1]) {
    bx(g, w * 0.7, 30, 40, M.copperTin, 0, sy * (sh / 2 + 15), 30);
    hw.bolt(g, [0, sy * (sh / 2 + 30), 30], [0, -sy, 0], m.kind === 'nj410' ? 8 : m.kind === 'nj412' ? 10 : 12, 20, {nut: false, what: 'Strip cable terminal'});
  }
  out.push({j, y: yMid - sh / 2 - 30, h: 100, amps: m.kind === 'nj414' ? 380 : m.kind === 'nj413' ? 290 : m.kind === 'nj412' ? 200 : 117, label: K.label, loc: `slot ${j + 1}`, x: x0 + w / 2});
}

/** a capacitor stage: three cans, the reactor, the contactor and fuses on a tray */
export function capStage(ctx, m, j, box, out) {
  const {M, hw} = ctx;
  const K = MODULE_KINDS[m.kind];
  const h = box.y1 - box.y0;
  const w = box.x1 - box.x0;
  const loc = ctx.R.loc(ctx.i, j);
  const d = Math.min(-ctx.zSep - 60, 480);
  const g = part(ctx, {name: `${K.name} · ${loc}`, layer: 'unit', stage: 'units', module: j, at: [(box.x0 + box.x1) / 2, box.y0 + 4, -20 - d / 2], dir: [0, 0.05, 1], dist: 900, lines: [m.label || K.label, ...K.lines]});
  bx(g, w - 20, 3, d, M.zinc, 0, 1.5, 0);
  bx(g, w - 20, 40, 3, M.zinc, 0, 20, d / 2 - 1.5);
  for (const sx of [-1, 1]) {
    bx(g, 2, h - 20, d, M.zinc, sx * (w / 2 - 11), (h - 20) / 2, 0);
    hw.screw(g, [sx * (w / 2 - 30), 20, d / 2 + 1], [0, 0, 1], 6, 'Tray front');
  }
  if (m.kind === 'capfuse') {
    bx(g, 220, h - 60, 150, M.dev, -60, (h - 40) / 2, 40);
    bx(g, 200, h - 100, 12, M.devDark, -60, (h - 40) / 2, 120);
    bx(g, 110, 24, 30, M.black, -60, h - 80, 136);
    return;
  }
  // three capacitor cans
  const ch = Math.min(h - 70, 230);
  for (let k = 0; k < 3; k++) {
    cy(g, 42, ch, M.alu, -w / 2 + 80 + k * 95, 3 + ch / 2, -d / 2 + 70, {seg: 24});
    cy(g, 12, 18, M.devDark, -w / 2 + 80 + k * 95, 3 + ch + 9, -d / 2 + 70);
  }
  // the reactor (choke): iron core and three coils
  if (/choked/.test(m.label || K.label)) {
    bx(g, 200, ch * 0.9, 90, M.devDark, w / 2 - 140, 3 + ch * 0.45, -d / 2 + 90);
    for (let k = 0; k < 3; k++) cy(g, 34, ch * 0.6, M.copper, w / 2 - 205 + k * 65, 3 + ch * 0.45, -d / 2 + 90, {seg: 18});
  }
  contactor(g, M, -40, 3 + Math.min(h - 80, 120) / 2, d / 2 - 70, 70, Math.min(h - 80, 120), 110);
  for (let k = 0; k < 3; k++) bx(g, 30, 60, 60, M.devLight, 60 + k * 36, 33, d / 2 - 60);
}

/** a SINAMICS G120 power module on its full-height mounting plate */
export function converter(ctx, m, j, x0, w, yb, yt, out) {
  const {M, hw} = ctx;
  const K = MODULE_KINDS[m.kind];
  const ph = {fsa: 200, fsb: 290, fsc: 300, fsd: 470, fse: 550, fsf: 700}[m.kind];
  const g = part(ctx, {name: `${K.name} · slot ${j + 1}`, layer: 'unit', stage: 'units', module: j, at: [x0 + w / 2, yb, -200], dir: [0, 0.05, 1], dist: 800 + j * 30, lines: [K.label, ...K.lines]});
  const hh = yt - yb;
  bx(g, w - 6, hh - 20, 3, M.zincPerf, 0, hh / 2, -100, 10);
  // fuse base on top, the power module in the middle, the output reactor below
  bx(g, w - 30, 120, 110, M.dev, 0, hh - 120, -40);
  bx(g, w - 14, ph, 200, M.devDark, 0, hh * 0.55, 0);
  bx(g, (w - 14) * 0.6, 70, 20, M.devLight, 0, hh * 0.55 + ph / 2 - 60, 110);
  bx(g, (w - 14) * 0.5, 30, 4, M.lamp, 0, hh * 0.55 + ph / 2 - 50, 121, 0, {keep: true});
  for (let k = 0; k < Math.floor(ph / 30); k++) bx(g, w - 30, 3, 6, M.black, 0, hh * 0.55 - ph / 2 + 15 + k * 30, 101);
  bx(g, w - 30, 160, 120, M.devDark, 0, 200, -30);
  hw.screw(g, [0, hh - 30, -97], [0, 0, 1], 6, 'Mounting plate');
  out.push({j, y: yb + 120, h: 100, amps: 63, label: K.label, loc: `slot ${j + 1}`});
}

/** the ACB: breaker in its guide frame with the racking crank; cradle rails extend when it is drawn out */
export function breaker(ctx, m, j, box, out) {
  const {M, hw, f} = ctx;
  const br = BREAKERS[f.opts.acb];
  const loc = ctx.R.loc(ctx.i, j);
  const h = box.y1 - box.y0;
  const w = box.x1 - box.x0;
  const cx = (box.x0 + box.x1) / 2;
  const yb = box.y0 + Math.max(20, (h - br.h) / 2 - 30);
  const pos = () => posOf(m);
  const gw = br.w + 60;
  const gd = Math.min(br.d + 40, -ctx.zSep - 40);
  // the guide frame (fixed part): side walls with rails, the rear main terminals
  const gf = part(ctx, {name: `Guide frame ${br.tag} · ${loc}`, layer: 'unit', stage: 'devices', module: j, at: [cx, yb, -gd / 2 - 10], dir: [0, 0, 1], dist: 700, lines: [br.fixed ? 'Fixed-mounted MCCB, mounting plate' : 'Withdrawable guide frame (cradle)', 'Main terminals at the rear, horizontal', 'Shutters close over the isolating contacts']});
  if (!br.fixed) {
    for (const sx of [-1, 1]) {
      bx(gf, 3, br.h + 40, gd, M.zinc, sx * gw / 2, (br.h + 40) / 2, 0);
      bx(gf, 14, 20, gd, M.zinc, sx * (gw / 2 - 8), 30, 0);
    }
    bx(gf, gw, 3, gd, M.zinc, 0, 0, 0);
    // isolating contacts at the rear (upper and lower row)
    for (let p = 0; p < 3; p++)
      for (const yy of [br.h * 0.78, br.h * 0.32]) {
        bx(gf, br.w * 0.18, 30, 60, M.copperTin, (p - 1) * br.w * 0.3, yy, -gd / 2 + 20);
        hw.bolt(gf, [(p - 1) * br.w * 0.3, yy + 15, -gd / 2 + 20], [0, -1, 0], 12, 30, {nut: true, what: 'ACB main terminal'});
      }
    // the shutters over the contacts (grey, close when the breaker leaves)
    bx(gf, br.w * 0.95, br.h * 0.9, 2, M.insul, 0, br.h * 0.55, -gd / 2 + 55);
  } else {
    bx(gf, gw, br.h + 80, 3, M.zincPerf, 0, (br.h + 80) / 2, -gd / 2 + 10, 10);
  }
  const g = part(ctx, {
    name: `${br.fixed ? 'MCCB' : 'Circuit-breaker'} ${m.label} · ${loc}`,
    layer: 'unit',
    stage: 'units',
    module: j,
    at: [cx, yb + br.h / 2 + 8, -gd / 2 - 10 + 20],
    dir: [0, 0.05, 1],
    dist: 1100,
    draw: br.fixed ? null : () => (pos() === 'removed' ? 620 : ACB[pos()]),
    lines: [`${br.name}`, `${m.label} · ${br.w} × ${br.h} × ${br.d} mm [inferred]`, `≈ ${br.kg} kg · ${br.fixed ? 'fixed' : 'CONNECTED / TEST / DISCONNECTED'}`],
  });
  g.userData.part.posOf = pos;
  // the body, the arc chute cover on top, the front panel with the trip unit and the push buttons
  bx(g, br.w, br.h, br.d, M.dev, 0, 0, 0);
  bx(g, br.w - 20, 30, br.d - 60, M.devDark, 0, br.h / 2 + 15, -20);
  for (let k = 0; k < 6; k++) bx(g, br.w - 40, 3, 4, M.black, 0, br.h / 2 + 31, -br.d / 2 + 60 + k * 40);
  const ft = breakerFace(br);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(br.w - 16, br.h - 16), new THREE.MeshStandardMaterial({map: ft, roughness: 0.55}));
  face.position.set(0, 0, br.d / 2 + 1.5);
  face.userData.keep = true;
  g.add(face);
  bx(g, br.w - 10, br.h - 10, 3, M.devLight, 0, 0, br.d / 2);
  // the charging lever and the racking crank shaft
  bx(g, 40, 90, 22, M.black, br.w * 0.3, -br.h * 0.28, br.d / 2 + 12);
  if (!br.fixed) {
    cy(g, 9, 30, M.bolt, 0, -br.h / 2 + 30, br.d / 2 + 15, {rx: Math.PI / 2});
    // isolating contact fingers at the rear of the breaker
    for (let p = 0; p < 3; p++)
      for (const yy of [br.h * 0.28, -br.h * 0.18])
        hw.fingers(g, [(p - 1) * br.w * 0.3, yy, -br.d / 2 - 14], 4, 12, [8, 26, 28], {title: 'ACB isolating contact', lines: ['Silver-plated finger cluster', 'Mates with the guide frame terminal']});
    for (const sx of [-1, 1]) bx(g, 8, 18, br.d - 40, M.zinc, sx * (br.w / 2 + 4), -br.h / 2 + 22, 0);
  }
  for (const sx of [-1, 1]) hw.screw(g, [sx * (br.w / 2 - 14), br.h / 2 - 14, br.d / 2 + 2], [0, 0, 1], 6, 'Front cover');
  out.push({j, y: yb + 40, h: 120, amps: Number((m.label.match(/(\d+) A/) || [0, 1600])[1]), label: m.label, loc, acb: true});
  return {yb, gd, br};
}

const faceCache = {};
function breakerFace(br) {
  if (faceCache[br.tag]) return faceCache[br.tag];
  const W = 320;
  const H = Math.round((320 * (br.h - 16)) / (br.w - 16));
  const t = faceTex(W, H, (g) => {
    g.fillStyle = '#e3e4e2';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#b9bcbf';
    g.lineWidth = 2;
    g.strokeRect(6, 6, W - 12, H - 12);
    // the trip unit (ETU) with its display
    g.fillStyle = '#3a3e45';
    g.fillRect(W * 0.08, H * 0.1, W * 0.42, H * 0.42);
    g.fillStyle = '#9fd3c7';
    g.fillRect(W * 0.12, H * 0.14, W * 0.34, H * 0.12);
    g.fillStyle = '#e3e4e2';
    for (let k = 0; k < 6; k++) g.fillRect(W * 0.12 + k * W * 0.055, H * 0.33, W * 0.035, H * 0.06);
    // ON / OFF push buttons, charge and state indicators
    const btn = (x, y, c, s) => {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x, y, W * 0.05, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.font = `700 ${Math.round(W * 0.04)}px Inter, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(s, x, y + 1);
    };
    btn(W * 0.62, H * 0.2, '#2e9d4a', 'I');
    btn(W * 0.78, H * 0.2, '#d6182b', 'O');
    g.fillStyle = '#f2f2f0';
    g.fillRect(W * 0.58, H * 0.34, W * 0.12, H * 0.07);
    g.fillRect(W * 0.74, H * 0.34, W * 0.12, H * 0.07);
    g.fillStyle = '#16181b';
    g.font = `600 ${Math.round(W * 0.03)}px Inter, sans-serif`;
    g.textAlign = 'left';
    g.fillText('CHARGED', W * 0.585, H * 0.38);
    g.fillText('OPEN', W * 0.755, H * 0.38);
    g.font = `700 ${Math.round(W * 0.05)}px Inter, sans-serif`;
    g.fillText(br.tag, W * 0.08, H * 0.62);
    g.font = `500 ${Math.round(W * 0.032)}px Inter, sans-serif`;
    g.fillStyle = '#5d6670';
    g.fillText(`IEC 60947-2 · Ue 690 V · In ${br.In[br.In.length - 1]} A`, W * 0.08, H * 0.69);
    // racking crank opening and position window
    g.fillStyle = '#24262a';
    g.fillRect(W * 0.44, H * 0.84, W * 0.12, H * 0.06);
    g.fillStyle = '#2e9d4a';
    g.fillRect(W * 0.6, H * 0.84, W * 0.12, H * 0.06);
  });
  faceCache[br.tag] = t;
  return t;
}
