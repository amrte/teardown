// The SENTRON 3WL1 air circuit-breaker, withdrawable in its guide frame or fixed-mounted, built to its configuration
// and to the operating instructions 3ZW1012-0WL11-0AB1 (OI) and the COM35 guide L1V30536190-04 (COM):
//
// Breaker (OI 1-1): the moulded front panel, common to all frame sizes (296 x 346 in the 300 x 350 door cut-out, 65 mm
// above the mounting surface, OI 21-1), in three columns: the trip unit on the left (with the BREAKER TRIPPED reset
// pin, rating plug, rotary coding switches or the ETU76B graphic display, TEST / QUERY / CLEAR, the test connector),
// the operating field in the centre (OFF lock field, the CONTACTS / READY / SPRING windows, Mechanical OFF and ON
// buttons, the max. rating label, the racking-handle release), the label column on the right (type label, racking
// pictogram, operations counter) with the tall spring charging lever between them; along the bottom the position
// indicator CONNECT / TEST / DISCON and the racking handle in its drawer; along the top edge the receptacles X8 · X7 ·
// X6 · X5 (OI 5-16) and behind them one arc chute per pole. Behind the panel: the releases F1 · Y1 · F2/F3/F4 under the
// receptacle strip (OI 10-1), the auxiliary switch block S21 S1 S2 S4 S3, S20, S24, the stored-energy mechanism with
// the control gate, the motor on the charging shaft (OI 12-1), the BSS behind the trip unit. Further back: the poles
// (moving contact assemblies) in the front housing, the rear wall with the fixed contacts and the main terminals, the
// current transformers on the lower terminals, the feet, the transverse racking shaft with a crank on each side.
//
// Guide frame (OI 1-2): side walls with arcing openings and crane holes, telescopic guide rails with their lock and the
// rated-current coding, the rear wall with the shutter straps and the disconnecting contacts, the top front crossbar
// with the sliding contact modules and the COM35 at X7 (its micro-switches S48 S47 S46 underneath, COM p.30, OI 8-83),
// earthing terminals Ø14, the door interlock and racking lock on the floor.
//
// Each breaker part also hangs on a step of the maintenance sequence of OI chapter 23 (flyStep), driven by S.wlx.
// Height and depth of the breaker and the racking travel are [inferred]; everything placed on the front is to scale.
import * as THREE from 'three';
import {DOOR_T} from './catalog.js';
import {bx, cy, label, mk, part} from './cabinet.js';
import {cableGeo, faceTex, plateGeo} from './parts.js';
import {activeSettings, com35Data, hasG, igA, orderNo, PANEL, POSITION, settingsFor as settingsOf, WL_CLASS, WL_ETU, WL_SIZES} from './wl.js';

// mm [inferred]; 'removed' is the breaker lifted off the rails onto the bench in front of the field (OI 23-4)
const TRAVEL = {connected: 0, test: 60, disconnected: 115, removed: 1000};
const CHUTE = 60; // arc chute height above the body [inferred]
const FOOT = 28; // feet under the body [inferred]
const posOf = (m) => m.pos || 'connected';

// ------------------------------------------------------------ textures
const texCache = new Map();
const cachedTex = (key, w, h, draw) => {
  if (!texCache.has(key)) texCache.set(key, faceTex(w, h, draw));
  return texCache.get(key);
};
const txt = (g, s, x, y, size, color = '#16181b', weight = 600, align = 'left') => {
  g.fillStyle = color;
  g.font = `${weight} ${size}px Inter, sans-serif`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(s, x, y);
};
const rrect = (g, x, y, w, h, r, fill) => {
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
};
const knob = (g, cx, cy, r, frac) => {
  g.fillStyle = '#d9dde0';
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2f3a44';
  g.beginPath();
  g.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  g.fill();
  const a = -Math.PI * 1.25 + frac * Math.PI * 1.5;
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6);
  g.stroke();
};

/** the trip unit's front after OI 8-3…8-17: tall slate panel, live settings */
function etuTex(o, S) {
  const E = WL_ETU[o.wlEtu];
  const P = activeSettings(o);
  const key = JSON.stringify(['etu2', o.wlEtu, o.wlGf, o.wlIn, o.acb, P, S.map((s) => o[s.key])]);
  return cachedTex(key, 240, 600, (g, W, H) => {
    g.fillStyle = '#3d4a56';
    g.fillRect(0, 0, W, H);
    // top strip: BREAKER TRIPPED, the reset pin, the optional safety lock
    rrect(g, 10, 10, W - 20, 58, 4, '#33404b');
    txt(g, 'BREAKER TRIPPED', 18, 24, 12, '#e8eef2', 700);
    g.fillStyle = '#c9d1d6';
    g.beginPath();
    g.arc(36, 48, 10, 0, Math.PI * 2);
    g.fill();
    txt(g, 'RESET', 54, 48, 11, '#e8eef2', 700);
    g.fillStyle = '#1b2126';
    g.beginPath();
    g.arc(W - 36, 42, 15, 0, Math.PI * 2);
    g.fill();
    // type name and the LED row
    txt(g, E.name.replace(' with display', ''), W - 14, 92, 22, '#e8eef2', 800, 'right');
    txt(g, 'Release 2', W - 14, 110, 9, '#c9d1d6', 600, 'right');
    const leds = E.face === 'graphic' ? ['ACTIVE', 'ALARM', 'COMM.', 'EXTEND.', 'TRIP L', 'TRIP N', 'TRIP S', 'TRIP I'] : E.display || o.wlEtu === '45B' ? ['ACTIVE', 'ALARM', 'COMM.', 'EXTEND.'] : ['ACTIVE', 'ALARM'];
    leds.forEach((s, i) => {
      g.fillStyle = i === 0 ? '#7fe39a' : '#5a6670';
      g.fillRect(16 + i * 26, 150, 10, 8);
      g.save();
      g.translate(20 + i * 26, 144);
      g.rotate(-Math.PI / 4);
      txt(g, s, 0, 0, 8, '#c9d1d6', 600);
      g.restore();
    });
    const dispY = 172;
    if (E.face === 'graphic') {
      rrect(g, 30, dispY, W - 60, 150, 3, '#b9e3d8');
      txt(g, `Set ${P.set}${P.set === 'B' ? ' · DAS' : ''}`, 40, dispY + 16, 12, '#16303a', 700);
      const rows = [
        ['IR', `${Math.round(P.Ir * o.wlIn)} A`],
        ['tR', `${P.tR} s`],
        ['Isd', P.Isd !== null ? `${Math.round(P.Isd * o.wlIn)} A` : '—'],
        ['tsd', P.tsd !== null ? `${P.tsd} s` : 'OFF'],
        ['Ii', P.Ii !== null ? `${Math.round(P.Ii * o.wlIn)} A` : 'OFF'],
      ];
      if (P.Ig) rows.push(['Ig', `${P.Ig} A`]);
      rows.forEach(([k, v], i) => {
        txt(g, k, 40, dispY + 38 + i * 19, 12, '#16303a', 600);
        txt(g, v, W - 40, dispY + 38 + i * 19, 13, '#16303a', 700, 'right');
      });
      // rating plug, T.U. ERROR, keys ▲ ▼ ESC ENTER
      rrect(g, 18, 340, 120, 34, 3, '#9aa3aa');
      txt(g, `In = ${o.wlIn} A`, 78, 357, 13, '#16181b', 700, 'center');
      rrect(g, 146, 340, 30, 34, 2, '#5a6670');
      txt(g, 'T.U.', 161, 351, 8, '#e8eef2', 700, 'center');
      for (const [k, x, y] of [['▲', 196, 338], ['▼', 196, 376], ['ESC', 60, 398], ['ENTER', 120, 398]]) {
        rrect(g, x - 20, y - 14, k.length > 1 ? 46 : 34, 28, 4, '#9aa3aa');
        txt(g, k, x - 20 + (k.length > 1 ? 23 : 17), y, 11, '#16181b', 700, 'center');
      }
    } else {
      if (E.display) {
        rrect(g, 30, dispY - 4, W - 60, 60, 3, '#b9e3d8');
        txt(g, `I1 ${Math.round(o.wlIn * 0.62)} A`, 40, dispY + 12, 12, '#16303a', 700);
        txt(g, `I2 ${Math.round(o.wlIn * 0.6)} A`, 40, dispY + 30, 12, '#16303a', 700);
        txt(g, '▲               ▼', W / 2, dispY + 72, 12, '#e8eef2', 700, 'center');
      }
      // rating plug and T.U. ERROR
      rrect(g, 18, 270, 120, 34, 3, '#9aa3aa');
      txt(g, `In = ${o.wlIn} A`, 78, 287, 13, '#16181b', 700, 'center');
      rrect(g, 146, 270, 30, 34, 2, '#5a6670');
      txt(g, 'T.U.', 161, 281, 8, '#e8eef2', 700, 'center');
      // the rotary coding switches: L S I on the left, the delays on the right (OI 8-12)
      const pos = (k) => {
        const s = S.find((x) => x.key === k);
        return s ? Math.max(0, s.steps.indexOf(o[k])) / Math.max(1, s.steps.length - 1) : null;
      };
      const rows = [['L', 'wlIr', 'wltR'], ['S', 'wlIsd', 'wltsd'], ['I', 'wlIi', null]];
      rows.forEach(([n, a, b], i) => {
        const y = 340 + i * 62;
        txt(g, n, 16, y, 14, '#e8eef2', 800);
        const pa = pos(a);
        if (pa !== null) knob(g, 56, y, 22, pa);
        else {
          rrect(g, 34, y - 14, 70, 28, 3, '#33404b');
          txt(g, n === 'I' ? '≥ 20 × In' : 'fix', 69, y, 9, '#c9d1d6', 700, 'center');
        }
        const pb = b ? pos(b) : null;
        if (pb !== null) knob(g, 186, y, 22, pb);
        else if (b === 'wltR') {
          rrect(g, 150, y - 14, 74, 28, 3, '#33404b');
          txt(g, 'tR = 10 s', 187, y, 9, '#c9d1d6', 700, 'center');
        }
      });
      // trip-cause LEDs
      ['L', 'N', 'S', 'I'].forEach((s, i) => {
        g.fillStyle = '#5a6670';
        g.beginPath();
        g.arc(110 + (i % 2) * 18, 350 + Math.floor(i / 2) * 24, 5, 0, Math.PI * 2);
        g.fill();
      });
    }
    // the ground-fault module zone (GFM AT 45B / 55B-76B) or the ETU27B G switch
    if (hasG(o)) {
      rrect(g, 14, 470, W - 28, 64, 3, '#33404b');
      txt(g, o.wlEtu === '27B' ? 'G' : E.face === 'graphic' ? 'GFM AT 55B-76B' : 'GFM AT 45B', 22, 484, 10, '#e8eef2', 700);
      knob(g, 46, 512, 16, ['A', 'B', 'C', 'D', 'E'].indexOf(o.wlIg) / 4);
      knob(g, W - 46, 512, 16, [0.1, 0.2, 0.3, 0.4, 0.5].indexOf(o.wltg) / 4);
      txt(g, `Ig ${o.wlIg} = ${igA(o, o.wlIg)} A`, W / 2, 512, 10, '#e8eef2', 700, 'center');
    }
    // TEST · QUERY · CLEAR and the test connector
    ['TEST', 'QUERY', 'CLEAR'].forEach((s, i) => {
      g.fillStyle = '#e4e5e2';
      g.beginPath();
      g.arc(46 + i * 74, 556, 13, 0, Math.PI * 2);
      g.fill();
      txt(g, s, 46 + i * 74, 576, 8, '#e8eef2', 700, 'center');
    });
    rrect(g, 40, 584, W - 80, 12, 2, '#9aa3aa');
  });
}

/** the front panel print: indicator field, type label column, racking pictogram */
function panelTex(o, fixed) {
  const S = WL_SIZES[o.acb];
  const key = JSON.stringify(['pan', o.acb, o.wlIn, o.wlClass, o.wlEtu, o.wlGf, o.wlPoles, o.wlMech, o.wlRel, fixed]);
  return cachedTex(key, 296, 346, (g, W, H) => {
    g.fillStyle = '#e1e2df';
    g.fillRect(0, 0, W, H);
    // the inset operating field
    rrect(g, W * 0.3, H * 0.29, W * 0.4, H * 0.22, 3, '#d3d5d2');
    // identification tags slot
    rrect(g, W * 0.6, H * 0.025, W * 0.16, 9, 2, '#b9bcbf');
    // the type label column
    rrect(g, W * 0.79, H * 0.08, W * 0.14, H * 0.33, 2, '#f4f4f2');
    g.save();
    g.translate(W * 0.86, H * 0.245);
    g.rotate(-Math.PI / 2);
    txt(g, orderNo(o), 0, -12, 10, '#16181b', 700, 'center');
    txt(g, `In max ${S.In[S.In.length - 1]} A · ${WL_CLASS[o.wlClass].name.split(' ·')[0]} · Icu ${S.icu[o.wlClass]} kA`, 0, 3, 7, '#3c4247', 600, 'center');
    txt(g, `IEC 60947-2 · Ue 690 V · ${o.wlPoles}-pole`, 0, 15, 7, '#3c4247', 600, 'center');
    g.restore();
    // the racking pictogram
    if (!fixed) {
      rrect(g, W * 0.79, H * 0.43, W * 0.14, H * 0.22, 2, '#f4f4f2');
      g.strokeStyle = '#16181b';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(W * 0.86, H * 0.53, 11, 0.3, Math.PI * 1.8);
      g.stroke();
      txt(g, 'CONNECT', W * 0.86, H * 0.465, 6, '#16181b', 700, 'center');
      txt(g, 'DISCON', W * 0.86, H * 0.62, 6, '#16181b', 700, 'center');
    }
    // max rating label, the 3WL mark
    rrect(g, W * 0.6, H * 0.53, W * 0.14, 12, 2, '#f4f4f2');
    txt(g, `${S.In[S.In.length - 1]} A`, W * 0.67, H * 0.53 + 6, 8, '#16181b', 700, 'center');
    txt(g, '3WL', W * 0.34, H * 0.545, 12, '#3c4247', 800);
    // ground-fault table bottom left (OI 1-1 item 17, 8-29)
    if (hasG(o)) {
      rrect(g, 3, H * 0.74, W * 0.11, H * 0.11, 2, '#f4f4f2');
      ['A', 'B', 'C', 'D', 'E'].forEach((l, i) => txt(g, `${l} ${igA(o, l)}`, 6, H * 0.755 + i * 7, 5.5, '#16181b', 700));
    }
    // the option label strip along the bottom edge (OI 2-1)
    rrect(g, 4, H - 14, W - 8, 10, 1, '#f4f4f2');
    txt(g, `Y1 ${o.wlRel.replace(/\+/g, ' ')}${o.wlMech === 'motor' ? ' · M' : ''} · S1 S2`, 10, H - 9, 6, '#3c4247', 700);
  });
}

// the windows that change: position indicator, CONTACTS / READY / SPRING
const matCache = {};
const winMat = (key, draw, w = 64, h = 32) => (matCache[key] ??= new THREE.MeshStandardMaterial({map: faceTex(w, h, draw), roughness: 0.5}));
const posInd = (p) =>
  winMat(`pos-${p}`, (g, W, H) => {
    g.fillStyle = '#1b1d20';
    g.fillRect(0, 0, W, H);
    const rows = [['CONNECT', '#d6182b'], ['TEST', '#2f6fc2'], ['DISCON', '#2e9d4a']];
    rows.forEach(([t, c], i) => {
      const on = POSITION[p].ind === t;
      g.fillStyle = on ? c : '#2c2f33';
      g.fillRect(4, 4 + i * 40, W - 8, 34);
      txt(g, t, W / 2, 21 + i * 40, 11, on ? '#fff' : '#7d858c', 700, 'center');
    });
  }, 64, 128);
const stateMat = (kind, v) =>
  winMat(`st-${kind}-${v}`, (g, W, H) => {
    g.fillStyle = '#f4f4f2';
    g.fillRect(0, 0, W, H);
    if (kind === 'contacts') {
      g.fillStyle = v ? '#d6182b' : '#2e9d4a';
      g.fillRect(0, 0, W, H);
      txt(g, v ? 'I CLOSED' : 'O OPEN', W / 2, H / 2, 14, '#fff', 800, 'center');
    } else if (kind === 'ready') {
      if (v) txt(g, 'OK', W / 2, H / 2, 16, '#16181b', 800, 'center');
    } else {
      g.fillStyle = v ? '#e7c11e' : '#f4f4f2';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#c9ccd0';
      if (!v) for (let i = 0; i < 8; i++) g.fillRect(i * 10, 0, 4, H);
      txt(g, v ? 'CHARGED' : 'DISCHARGED', W / 2, H / 2, 10, '#16181b', 800, 'center');
    }
  });

// LEDs and the COM35 print
const ledMat = {};
const led = (c) => (ledMat[c] ??= new THREE.MeshStandardMaterial({color: c, emissive: c, emissiveIntensity: c === '#2a2c30' ? 0 : 0.9, roughness: 0.4}));
const comTex = () =>
  cachedTex('com35', 288, 240, (g, W, H) => {
    g.fillStyle = '#e8e9e6';
    g.fillRect(0, 0, W, H);
    txt(g, 'PROFINET IO – MODBUS TCP', 14, 22, 17, '#3c4247', 600);
    txt(g, 'S1', W - 34, 22, 13, '#3c4247', 600);
    txt(g, 'MAC ADD:', 12, 62, 12, '#3c4247', 600);
    txt(g, 'XX-XX-XX-XX-XX-XX', 12, 78, 11, '#3c4247', 500);
    g.fillStyle = '#16181b';
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if ((i * 7 + j * 3 + i * j) % 3 === 0 || i % 8 === 0 || j % 8 === 0) g.fillRect(14 + i * 6, 96 + j * 6, 6, 6);
    txt(g, 'X1', 120, 62, 13, '#3c4247', 700, 'center');
    txt(g, 'X2', 184, 62, 13, '#3c4247', 700, 'center');
    ['PN', 'TCP', 'CUB'].forEach((s, i) => txt(g, s, 250, 66 + i * 34, 12, '#3c4247', 700, 'center'));
    txt(g, '3WL9111-0AT65-0AA0', 14, H - 20, 13, '#3c4247', 700);
    txt(g, 'Cat.No.: WLCOM35', W - 12, H - 20, 12, '#3c4247', 600, 'right');
  });

const springGeo = (r, wire, turns, len) => {
  const pts = [];
  for (let i = 0; i <= turns * 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, -len / 2 + (i / (turns * 24)) * len, Math.sin(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, wire, 6, false);
};
const smooth = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};

/**
 * Builds a 3WL in the box of its module. Returns what the field needs: the bottom yb, the guide frame depth gd, the
 * breaker record, the world z of the rear main terminals, the phase x positions, the door cut-out and the COM35 place.
 */
export function breakerWL(ctx, m, j, box, out, B) {
  const {M, hw, f} = ctx;
  const o = f.opts;
  const S = WL_SIZES[o.acb];
  const E = WL_ETU[o.wlEtu];
  const set = activeSettings(o);
  const loc = ctx.R.loc(ctx.i, j);
  const h = box.y1 - box.y0;
  const cx = (box.x0 + box.x1) / 2;
  const fixed = o.wlMount === 'fixed';
  const pos = () => (fixed ? 'connected' : posOf(m));
  const np = o.wlPoles;
  const w = B.w;
  const bh = B.h;
  const PW = PANEL.w;
  const PH = PANEL.h;
  const gh = FOOT + bh + CHUTE + 12;
  const yb = box.y0 + Math.max(15, (h - gh) / 2 - 20);
  const zf = DOOR_T - 4; // the panel front in CONNECTED, just behind the door face
  const gd = Math.min(S.d + 40, zf - 30 - (ctx.zSep + 15));
  const bd = gd - 30;
  const gz = zf - 30 - gd / 2;
  const gw = w + 70;
  const pitch = w / np;
  const poleX = Array.from({length: np}, (_, p) => -w / 2 + pitch * (p + 0.5));
  const phaseX = np === 4 ? poleX.slice(1) : poleX; // 4-pole: N on the left (OI 5-13)
  const poleName = (p) => (np === 4 ? (p === 0 ? 'N' : `L${p}`) : `L${p + 1}`);
  // the step counter of the maintenance teardown, for this field (board passes it to the ticks)
  const step = (TS) => (TS && TS.sel === ctx.i ? TS.v : 0);

  // ================================================================ guide frame or fixed-mounting
  const gf = part(ctx, {
    name: fixed ? `Fixed mounting 3WL · ${loc}` : `Guide frame ${o.acb} · ${loc}`,
    layer: 'unit', stage: 'devices', module: j, at: [cx, yb, gz], dir: [0, 0, 1], dist: 700,
    lines: fixed ? ['Fixed-mounted 3WL on its feet', `4 × M${S.size === 3 ? 10 : 8}-8.8 into captive nuts · ${S.size === 3 ? 40 : 20} Nm (OI 5-2)`, 'COM35 on its operating-module bracket (OI 8-86)'] : [`Guide frame · ${S.kgG[np === 4 ? 1 : 0]} kg (OI 4-2)`, '4 × M8-8.8 to the base · 20 Nm (OI 5-2)', 'Shutter, telescopic rails, sliding contacts X5–X8'],
  });
  if (!fixed) {
    // side walls: arcing openings at the upper rear, the crane hole at the upper front, the earthing terminal Ø14
    for (const sx of [-1, 1]) {
      const holes = [[gd * 0.32, gh * 0.33, 34, 22, 0], [gd * 0.32, gh * 0.18, 34, 22, 0], [gd * 0.12, gh * 0.33, 34, 22, 0], [-gd * 0.36, gh * 0.34, 0, 0, 9], [gd * 0.38, -gh * 0.38, 0, 0, 7]];
      const sw = mk(gf, plateGeo(gd, gh, 3, 4, holes), M.zinc, sx * (gw / 2 - 1.5), gh / 2, 0, {ry: Math.PI / 2});
      sw.rotation.y = sx * Math.PI / 2;
      sw.castShadow = true;
      // the telescopic guide rail: the outer rail fixed, the inner rail runs out to the maintenance position
      bx(gf, 10, 28, gd - 30, M.zinc, sx * (gw / 2 - 12), 22, 0);
      const rail = part(ctx, {parent: gf, sub: true, name: `Guide rail ${sx < 0 ? 'left' : 'right'}`, layer: 'unit', stage: 'devices', module: j, at: [sx * (gw / 2 - 20), 22, 0], draw: () => (pos() === 'removed' ? 380 : 0), lines: ['Telescopic guide rail (OI 1-2 item 12)', 'Pulled out to the maintenance position', 'Rated-current coding bolts M5 × 12 (OI 17-7)']});
      bx(rail, 7, 20, gd - 40, M.bolt, 0, 0, 0);
      for (const yy of [6, -6]) cy(rail, 3, 6, M.black, 0, yy, gd / 2 - 40, {rz: Math.PI / 2, seg: 8});
      for (const zz of [-gd / 2 + 60, gd / 2 - 60]) hw.screw(gf, [sx * gw / 2, 40, zz], [sx, 0, 0], 6, 'Guide frame');
    }
    bx(gf, gw, 3, gd, M.zinc, 0, 1.5, 0);
    // the floor: door interlock and the lock against racking with the door open (OI 1-2 items 10, 11), guide-rail lock
    bx(gf, 40, 16, 50, M.devDark, -14, 9, gd / 2 - 40);
    bx(gf, 30, 12, 40, M.zinc, 22, 7, gd / 2 - 40);
    bx(gf, 18, 30, 18, M.accent, gw / 2 - 34, 18, gd / 2 - 14);
    // the top front crossbar carrying the sliding contact modules
    const cbY = FOOT + bh + 4;
    bx(gf, gw, 40, 34, M.zinc, 0, cbY + 22, gd / 2 - 17);
    // rear wall with the shutter windows (two rows), the shutter straps and the 4 strap lifters (OI 17-2)
    const win = [];
    for (const px of poleX) for (const yy of [bh * 0.27, -bh * 0.18]) win.push([px, yy + FOOT + bh / 2 - gh / 2, pitch * 0.6, 44, 0]);
    mk(gf, plateGeo(gw, gh, 3, 2, win), M.zinc, 0, gh / 2, -gd / 2 + 1.5);
    const straps = [];
    for (const [k, yy] of [[0, bh * 0.27], [1, -bh * 0.18]]) {
      const sp = bx(gf, w * 0.98, 60, 3, M.insul, 0, FOOT + bh / 2 + yy, -gd / 2 + 52 + k * 4, 0, {keep: true});
      straps.push([sp, FOOT + bh / 2 + yy]);
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) bx(gf, 18, 30, 14, M.black, sx * (w * 0.3), FOOT + bh / 2 + sy * bh * 0.05, -gd / 2 + 60);
    // the shutter closes as soon as the breaker reaches TEST (OI 17-1)
    ctx.ticks.push(() => {
      const shut = pos() !== 'connected';
      straps.forEach(([sp, yy], k) => (sp.position.y = shut ? yy : yy + (k ? -46 : 46)));
    });
    // the disconnecting contacts behind the windows
    const dc = part(ctx, {parent: gf, sub: true, name: `Disconnecting contacts, ${np}-pole`, layer: 'unit', stage: 'devices', module: j, at: [0, FOOT + bh / 2, -gd / 2 + 20], lines: ['Finger clusters on the rear main terminals (OI 1-2 item 7)', 'Line side upper, load side lower', 'Grease Isoflex Topas NB 52 (OI 5-24)']});
    for (const px of poleX)
      for (const yy of [bh * 0.27, -bh * 0.18]) {
        bx(dc, pitch * 0.44, 36, 34, M.insul, px, yy, 0);
        hw.fingers(dc, [px, yy, 18], 4, Math.min(16, pitch * 0.12), [9, 30, 22], {title: 'Disconnecting contact', lines: ['Finger cluster, silver-plated', 'Mates with the breaker main contact blade']});
      }
    // left wall inside: the position signalling switch module and the shutter operating device (OI 1-2 items 16, 17)
    bx(gf, 14, 50, 90, M.black, -gw / 2 + 12, gh * 0.62, 0);
    bx(gf, 10, 120, 16, M.zinc, -gw / 2 + 12, gh * 0.45, -gd / 2 + 90);
    // earthing terminals Ø14 at the lower rear outside, one per side wall
    for (const sx of [-1, 1]) cy(gf, 10, 6, M.copperTin, sx * (gw / 2 + 3), 30, -gd / 2 + 40, {rz: Math.PI / 2, seg: 12});
  } else {
    // fixed: the two foot angles carry the breaker; M8 / M10 into captive nuts
    for (const sx of [-1, 1]) {
      bx(gf, 40, 4, bd * 0.8, M.zinc, sx * (w / 2 - 20), 2, -10);
      for (const zz of [-bd * 0.3, bd * 0.3 - 20]) hw.bolt(gf, [sx * (w / 2 - 20), 6, zz], [0, -1, 0], S.size === 3 ? 10 : 8, 6, {nut: false, what: 'Fixed breaker to the mounting surface'});
    }
  }
  // rear main terminals: horizontal flat connectors, upper (line) and lower (load); bar holes Ø13.5, M12 · 85 Nm
  const tg = part(ctx, {parent: gf, sub: true, name: 'Main terminals, horizontal connection', layer: 'unit', stage: 'devices', module: j, at: [0, FOOT + bh / 2, -gd / 2], lines: ['Horizontal connection, Ø13.5 holes (OI 5-4)', 'M12 + conical spring washer · 85 Nm', 'Brace the bars ≤ 100 mm from the terminal (OI 5-14)']});
  for (const px of poleX)
    for (const yy of [bh * 0.27, -bh * 0.18]) {
      bx(tg, pitch * 0.5, 12, 26, M.copperTin, px, yy, -4);
      hw.bolt(tg, [px, yy + 6, -10], [0, -1, 0], 12, 12, {what: '3WL main terminal (85 Nm, OI 5-5)'});
    }

  // ---------------------------------------------------------------- the sliding contact modules and the COM35 at X7
  const order = ['X8', 'X7', 'X6', 'X5'];
  const rw = (w - 20) / 4;
  const rx = (k) => -w / 2 + 10 + rw * (k + 0.5);
  const sl = part(ctx, {parent: gf, sub: true, name: 'Sliding contact modules X5–X8', layer: 'unit', stage: 'devices', module: j, at: [0, FOOT + bh + 6, gd / 2 - 20], lines: ['Clipped under the top crossbar (OI 5-17)', 'Mate with the breaker receptacles in TEST and CONNECTED', 'Hand plugs SIGUT 0.5 Nm']});
  order.forEach((x, k) => {
    if (x === 'X7' && o.wlCom === 'COM35') return;
    bx(sl, rw - 8, 18, 30, M.devDark, rx(k), 0, 0);
    label(sl, x, 20, 9, rx(k), 0, 15.8, {pw: 64, ph: 32, size: 22, bg: '#24262a', fg: '#e8eef2'});
  });
  let com = null;
  if (o.wlCom === 'COM35') {
    const xc = rx(1);
    com = part(ctx, {parent: gf, sub: true, name: 'COM35 communication module', layer: 'unit', stage: 'devices', module: j, at: [xc, FOOT + bh + 6 + 40 + 30, gd / 2 - 52], lines: ['PROFINET IO + Modbus TCP · 2 × RJ45 with switch', '72 × 60 × 92 mm · 160 g · 24 V DC 125 mA (COM p.47–50)', 'At X7 on the crossbar; S48 S47 S46 underneath (OI 8-83)']});
    bx(com, 72, 60, 92, M.devLight, 0, 0, 0);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(70, 58), new THREE.MeshStandardMaterial({map: comTex(), roughness: 0.55}));
    face.position.set(0, 0, 46.7);
    face.userData.keep = true;
    com.add(face);
    bx(com, 72, 14, 26, M.devLight, 0, 37, 20);
    for (let t = 0; t < 9; t++) {
      cy(com, 2.6, 3, M.bolt, -30 + t * 7.5, 45.5, 24, {seg: 8});
      bx(com, 5, 6, 8, M.devDark, -30 + t * 7.5, 42, 34);
    }
    label(com, 'CubicleBUS  IN  1 2 3 4 5 6 7 8 9  OUT', 66, 6, 0, 37, 33.8, {pw: 512, ph: 48, size: 26, bg: '#16181b', fg: '#e8eef2'});
    for (const px of [-4, 14]) bx(com, 14, 12, 8, M.black, px, 4, 43.5);
    const leds = [0, 1, 2].map((i) => cy(com, 2.2, 2, led('#2a2c30'), 28, 9 - i * 7, 47, {rx: Math.PI / 2, seg: 10, keep: true}));
    cy(com, 3, 3, M.devDark, 28, 23, 47.2, {rx: Math.PI / 2, seg: 10});
    bx(com, 16, 14, 12, M.devDark, 18, 4, -50);
    mk(com, cableGeo([[-10, 8, -46], [-20, 0, -70], [-50, -10, -60], [-rw - 10, -40, -10]], 3), M.cable, 0, 0, 0, {shadow: false});
    mk(com, cableGeo([[-14, 8, -46], [-24, 2, -72], [-54, -8, -62], [-rw - 12, -42, -8]], 3), M.cable, 0, 0, 0, {shadow: false});
    // the micro-switches on the underside, left to right S48 S47 S46 (OI 8-83); the one the breaker presses is green
    const plungers = [-22, 0, 22].map((xx, k) => {
      bx(com, 16, 8, 18, M.devDark, xx, -34, 10);
      const pl = bx(com, 5, 8, 5, M.bolt, xx, -41, 10, 0, {keep: true});
      label(com, ['S48', 'S47', 'S46'][k], 14, 5, xx, -34, 19.4, {pw: 48, ph: 20, size: 16, bg: '#24262a', fg: '#e8eef2'});
      return pl;
    });
    ctx.ticks.push(() => {
      const d = com35Data(o, pos()).leds;
      const on = Math.floor(performance.now() / 400) % 2 === 0;
      leds[0].material = led(d.PN === 'green' ? '#2fbf55' : '#2a2c30');
      leds[1].material = led(d.TCP === 'green' ? '#2fbf55' : '#2a2c30');
      leds[2].material = led(d.CUB === 'green' || (d.CUB === 'flash' && on) ? '#2fbf55' : '#2a2c30');
      const s = POSITION[pos()].s; // S46 S47 S48
      [s[2], s[1], s[0]].forEach((v, k) => {
        plungers[k].position.y = v ? -37 : -41;
        plungers[k].material = v ? M.green : M.bolt;
      });
    });
  }

  // ================================================================ the breaker
  const g = part(ctx, {
    name: `Circuit-breaker ${orderNo(o)} · ${loc}`,
    layer: 'unit', stage: 'units', module: j,
    at: [cx, yb + FOOT + bh / 2, zf - bd / 2],
    dir: [0, 0.05, 1], dist: 1100,
    draw: fixed ? null : () => TRAVEL[pos()],
    lines: [`SENTRON ${o.acb} · frame size ${['I', 'II', 'III'][S.size - 1]} · ${np}-pole · ${S.kg[np === 4 ? 1 : 0]} kg (OI 4-2)`, `In ${o.wlIn} A · ${WL_CLASS[o.wlClass].name} · Icu ${S.icu[o.wlClass]} kA`, `${E.name}${hasG(o) ? ' + G' : ''} · ${o.wlMech === 'motor' ? 'motor operator' : 'manual'} · Y1 ${o.wlRel}`, `Position: %POS%`],
  });
  g.userData.part.posOf = pos;
  const sub = (name, at, lines, opts = {}, parent = g) => part(ctx, {parent, sub: true, name, layer: 'unit', stage: 'units', module: j, at, lines, ...opts});
  const zN = bd / 2 - 130; // the full-width housing begins here; the 296 x 346 nose in front of it carries the panel
  // the panel bottom sits PANEL.bottom above the mounting surface (the guide-frame floor)
  const panelBottom = PANEL.bottom - FOOT - bh / 2;
  const pcy = panelBottom + PH / 2;
  const U = (u) => -PW / 2 + u * PW;
  const V = (v) => pcy + PH / 2 - v * PH;

  // the front housing: full width from zN back to the rear wall, with a hollow pole compartment at its rear
  const rd = bd * 0.28; // rear wall depth
  const pd = bd * 0.22; // pole compartment depth
  const hz0 = -bd / 2 + rd + pd;
  const housing = sub('Front housing', [0, 0, 0], ['Moulded housing: mechanism, poles, front nose', 'Carrying handles on both sides (OI 1-1 item 2)', `Body ${w} mm wide (OI 5-3) · height and depth [inferred]`]);
  bx(housing, w, bh, zN - hz0, M.dev, 0, 0, (zN + hz0) / 2);
  // the pole compartment shell (open to the rear once the rear wall is off)
  bx(housing, w, 6, pd, M.dev, 0, bh / 2 - 3, hz0 - pd / 2);
  bx(housing, w, 6, pd, M.dev, 0, -bh / 2 + 3, hz0 - pd / 2);
  for (const sx of [-1, 1]) bx(housing, 6, bh, pd, M.dev, sx * (w / 2 - 3), 0, hz0 - pd / 2);
  for (let p = 1; p < np; p++) bx(housing, 4, bh - 12, pd, M.insul, -w / 2 + pitch * p, 0, hz0 - pd / 2);
  // the nose: four walls around the 296 x 346 opening, from zN to the panel
  const nz = (zN + bd / 2 - 6) / 2;
  const nd = bd / 2 - 6 - zN;
  bx(housing, PW, 4, nd, M.dev, 0, pcy + PH / 2 - 2, nz);
  bx(housing, PW, 4, nd, M.dev, 0, pcy - PH / 2 + 2, nz);
  for (const sx of [-1, 1]) bx(housing, 4, PH, nd, M.dev, sx * (PW / 2 - 2), pcy, nz);
  // carrying handles at the upper rear of both sides
  for (const sx of [-1, 1]) {
    bx(housing, 10, 16, 90, M.devDark, sx * (w / 2 + 6), bh / 2 - 26, -bd / 2 + rd + 40);
    bx(housing, 10, 34, 12, M.devDark, sx * (w / 2 + 6), bh / 2 - 42, -bd / 2 + rd + 90);
  }

  // ---------------------------------------------------------------- receptacles along the top front (OI 5-16)
  const rec = sub('Receptacles X8 · X7 · X6 · X5', [0, bh / 2 - 17, zN - 22], ['Receptacles for the auxiliary contacts (OI 1-1 item 28)', 'Left to right: X8 · X7/COM · X6 · X5 · 14 terminals each', 'X6 always; X5, X7, X8 by options (OI 5-21)']);
  order.forEach((x, k) => {
    const used = x === 'X6' || x === 'X7' || (x === 'X5' && (o.wlMech === 'motor' || o.wlRel !== 'F1')) || (x === 'X8' && E.bus);
    bx(rec, rw - 6, 30, 40, used ? M.devDark : M.dev, rx(k), 0, 0);
    if (used) for (let t = 0; t < 14; t++) bx(rec, 2, 8, 34, M.black, rx(k) - (rw - 14) / 2 + (t * (rw - 14)) / 13, 17, 0);
    label(rec, used ? x : '—', 18, 8, rx(k), -6, 20.6, {pw: 64, ph: 28, size: 20, bg: '#24262a', fg: '#e8eef2'});
  });

  // ---------------------------------------------------------------- behind the panel: releases, switches, mechanism
  const zM = zN + 50; // mid-depth of the nose
  const rel = ['F1', 'Y1', o.wlRel.split('+')[1] || null];
  rel.forEach((r, k) => {
    if (!r) return;
    const nm = {F1: 'Shunt release F1', Y1: 'Closing coil Y1', F2: '2nd shunt release F2', F3: 'Undervoltage release F3 (instantaneous)', F4: 'Undervoltage release F4 (time-delayed)'}[r];
    const term = {F1: 'X6.13 / X6.14', Y1: 'X6.7 / X6.8', F2: 'X5.11 / X5.12', F3: 'X5.11 / X5.12', F4: 'X5.11–X5.14'}[r];
    const rg = sub(nm, [-PW * 0.22 + k * PW * 0.22, V(0.07), zM], [nm, `Terminals ${term} (OI 10-6)`, r === 'F3' ? 'td < 80 ms with the jumper set (OI 10-3)' : r === 'F4' ? 'td 0.2…1.7 s, rotary switch (OI 10-3)' : 'Plugged into its bay from the front (OI 10-2)']);
    bx(rg, 52, 40, 60, r === 'F3' || r === 'F4' ? M.devDark : M.dev, 0, 0, 0);
    bx(rg, 46, 6, 54, M.yellow, 0, 22, 0);
    if (r !== 'Y1') bx(rg, 14, 12, 20, M.black, -18, 26, 14); // S22 / S23 signalling switch on its upper left
  });
  // S24 trip signalling switch top left, S20 centre, the auxiliary switch block S21 S1 S2 S4 S3 right of centre
  const sw = sub('Auxiliary and signalling switches', [PW * 0.1, V(0.2), zM], ['S1, S2 standard; S3/S7, S4/S8 optional (OI 7-3)', 'S20 ready-to-close, S21 spring charged, S24 trip (OI 11-1)', 'Terminals on X5 / X6 / X7']);
  for (let k = 0; k < 5; k++) bx(sw, 16, 34, 50, M.devLight, k * 18, 0, 0);
  bx(sw, 12, 24, 30, M.devLight, -46, 6, 8);
  bx(sw, 12, 20, 30, M.black, -PW * 0.48, 22, 0);
  // the stored-energy mechanism: two closing springs, the main shaft, the control gate (OI 14-4)
  const mech = sub('Stored-energy operating mechanism', [PW * 0.02, V(0.5), zM - 10], ['Closing springs: 9 strokes of the lever or the motor (OI 6-4)', 'Recharged ≤ 12 s after closing with a motor (OI 6-6)', 'Replacement by Siemens service only (OI 23-26)']);
  bx(mech, PW * 0.34, PH * 0.42, 60, M.zinc, 0, 0, -14);
  for (const sx of [-1, 1]) mk(mech, springGeo(15, 3, 9, PH * 0.32), M.bolt, sx * PW * 0.08, 0, 22, {shadow: false});
  bx(mech, 14, PH * 0.4, 10, M.devDark, -PW * 0.21, 0, 18);
  cy(mech, 9, w * 0.8, M.bolt, 0, PH * 0.16, -30, {rz: Math.PI / 2, seg: 12});
  // the motor on the charging shaft, right half, with the operations counter on its gearbox (OI 12-1, 13-2)
  if (o.wlMech === 'motor') {
    const mot = sub('Motor operating mechanism M', [PW * 0.3, V(0.62), zM], ['On the hand-charging shaft · hex 5 · 6 Nm (OI 12-2)', 'X5.1 L− BK · X5.2 L+ BN', 'Operations counter on the gearbox (OI 13-2)']);
    cy(mot, 22, 96, M.devDark, 0, -10, 0, {seg: 18});
    bx(mot, 48, 34, 50, M.zinc, 0, 50, 0);
  }
  // the BSS behind the trip unit, metering function PLUS on the back of the ETU (OI 8-79, 8-92)
  if (E.bus) {
    const bss = sub('Breaker Status Sensor BSS', [U(0.15), V(0.62), zM - 30], ['S40 ready, S41 spring, S44 contacts, S45 trip (OI 8-79)', 'CubicleBUS node; reads S46–S48 with a COM module']);
    bx(bss, 60, 36, 30, M.green, 0, 0, 0);
    const mf = sub('Metering function PLUS', [U(0.15), V(0.4), zM - 20], ['Plugged onto the back of the ETU (OI 8-92)', 'U, P, Q, S, PF, f, THD · I ±1 %', 'Extended protection: voltage, frequency, power']);
    bx(mf, 70, 90, 24, M.devLight, 0, 0, 0);
  }
  // the spring charging lever between the centre and the right column; it swings down for the panel to come off
  const lev = sub('Spring charging lever', [U(0.71), V(0.19), bd / 2 + 10], ['9 full strokes down to the stop (OI 6-4)', 'Padlockable, Ø8 shackle (OI 14-26)', 'Swung down before the front panel comes off (OI 23-11)']);
  const levBar = bx(lev, 30, PH * 0.52, 18, M.black, 0, -PH * 0.26, 0, 0, {keep: true});
  bx(lev, 24, 22, 26, M.devDark, 0, -PH * 0.5, 6);
  ctx.ticks.push((TS) => {
    const k = smooth(step(TS) - 1.6);
    lev.rotation.x = k * 1.25;
    levBar.visible = true;
  });

  // ---------------------------------------------------------------- the trip unit (stays on the breaker)
  const sets = settingsOf(o);
  const etu = sub(`Overcurrent release ${E.name}`, [U(0.155), V(0.445), bd / 2 - 12], [`${E.name}${hasG(o) ? ' + ground-fault protection' : ''} · type ${(hasG(o) ? E.codeG : E.code) ?? '—'} (COM Format 412)`, `IR ${Math.round(set.Ir * o.wlIn)} A · ${set.Isd !== null ? `Isd ${Math.round(set.Isd * o.wlIn)} A · ` : ''}${set.Ii !== null ? `Ii ${Math.round(set.Ii * o.wlIn)} A` : 'Ii OFF'}`, 'Fixed with PH3 screws · 5 Nm (OI 8-71)']);
  bx(etu, 84, PH * 0.55, 40, M.devDark, 0, 0, 0);
  const ef = new THREE.Mesh(new THREE.PlaneGeometry(82, PH * 0.55 - 2), new THREE.MeshStandardMaterial({map: etuTex(o, sets), roughness: 0.5}));
  ef.position.set(0, 0, 20.8);
  ef.userData.keep = true;
  etu.add(ef);
  const plug = sub(`Rating plug ${o.wlIn} A`, [-14, PH * 0.55 * 0.5 - PH * 0.55 * (E.face === 'graphic' ? 0.6 : 0.475), 22], [`In = ${o.wlIn} A · data point 377`, 'Exchange only in DISCON or with the ETU unpowered (OI 8-66)', `${o.acb}: ${S.size === 3 ? '1250–6300' : S.size === 2 ? '250–4000' : '250–2000'} A plugs`], {}, etu);
  bx(plug, 46, 15, 6, M.devLight, 0, 0, 0);
  // the BREAKER TRIPPED reset pin
  cy(etu, 4.5, 8, M.accent, -24, PH * 0.55 * 0.5 - 20, 23, {rx: Math.PI / 2, seg: 10});

  // ---------------------------------------------------------------- the front panel (step 2: 2 × PH2, 2.5 Nm)
  const pan = sub('Front panel', [0, pcy, bd / 2 - 4], ['Moulded front panel, common to FS I–III', '2 × PH2 · refit 2.5 Nm (OI 23-11, 23-26)', 'Door cut-out 300 × 350 mm (OI 21-1)'], {flyStep: 2, fly: [0, 40, 380]});
  mk(pan, plateGeo(PW, PH, 4, 4, [[U(0.155), V(0.445) - pcy, 86, PH * 0.55 + 2, 0], [U(0.71), V(0.45) - pcy, 34, PH * 0.54, 0]]), M.devLight, 0, 0, 0);
  const pp = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({map: panelTex(o, fixed), roughness: 0.6, transparent: true, alphaTest: 0.5}));
  pp.material.alphaMap = cutoutMask(o.wlEtu);
  pp.position.set(0, 0, 2.6);
  pp.userData.keep = true;
  pan.add(pp);
  const at = (u, v, z = 2) => [U(u), V(v) - pcy, z];
  // the locking device OFF field, S10 / motor disconnect field
  cy(pan, 19, 4, M.devLight, ...at(0.38, 0.11, 4), {rx: Math.PI / 2, seg: 24});
  cy(pan, 13, 4, M.devLight, ...at(0.59, 0.13, 4), {rx: Math.PI / 2, seg: 20});
  // CONTACTS · READY · SPRING windows (OI 6-6)
  const wins = [['contacts', 0.385, 28], ['ready', 0.48, 14], ['spring', 0.585, 28]].map(([kind, u, ww]) => {
    const mm = new THREE.Mesh(new THREE.PlaneGeometry(ww, 15), stateMat(kind, 0));
    mm.position.set(...at(u, 0.36, 3.2));
    mm.userData.keep = true;
    pan.add(mm);
    return [kind, mm];
  });
  // Mechanical OFF (O) and ON (I) buttons
  for (const [u, t] of [[0.38, 'O'], [0.59, 'I']]) {
    cy(pan, 15, 8, M.devDark, ...at(u, 0.44, 6), {rx: Math.PI / 2, seg: 24});
    label(pan, t, 12, 12, ...at(u, 0.44, 10.3), {pw: 48, ph: 48, size: 40, bg: '#24262a', fg: '#ffffff'});
  }
  // the mechanical release of the racking handle, the position indicator, the racking handle in its drawer
  if (!fixed) {
    bx(pan, 12, 18, 6, M.devDark, ...at(0.32, 0.65, 5));
    const pi = new THREE.Mesh(new THREE.PlaneGeometry(14, 40), posInd(pos()));
    pi.position.set(...at(0.32, 0.82, 3.2));
    pi.userData.keep = true;
    pan.add(pi);
    ctx.ticks.push(() => (pi.material = posInd(pos())));
    const rh = sub('Racking handle', [U(0.645), V(0.815) - pcy, 6], ['Stowed in its drawer; pull out only with the breaker OFF', 'Clockwise to the stop: DISCON → TEST → CONNECT (OI 6-3)', 'No movement during the first ~6 turns (OI 6-11)'], {}, pan);
    bx(rh, PW * 0.49, 26, 8, M.devDark, 0, 0, 0);
    for (const sx of [-1, 1]) cy(rh, 10, 8, M.black, sx * PW * 0.2, 0, 6, {rx: Math.PI / 2, seg: 14});
  }
  // the operations counter window (with motor) in the right column
  if (o.wlMech === 'motor') bx(pan, 20, 10, 2, M.black, ...at(0.835, 0.67, 3));
  for (const [u, v] of [[0.02, 0.55], [0.98, 0.55]]) hw.screw(pan, at(u, v, 2.4), [0, 0, 1], 6, 'Front panel PH2 · 2.5 Nm (OI 23-26)');
  // the indicator windows follow the state: closed in CONNECTED; springs charged with a motor; discharged after the
  // preparation step (OFF · ON · OFF)
  ctx.ticks.push((TS) => {
    const v = step(TS);
    const closed = pos() === 'connected' && v < 0.5;
    const charged = v < 0.5 && (o.wlMech === 'motor' || !closed);
    for (const [kind, mm] of wins) mm.material = stateMat(kind, kind === 'contacts' ? closed : kind === 'ready' ? !closed && charged : charged);
  });

  // ---------------------------------------------------------------- arc chutes, one per pole (step 3: hex 4, 8 Nm)
  poleX.forEach((px, p) => {
    const ac = sub(`Arc chute ${poleName(p)}`, [px, bh / 2 + CHUTE / 2, -bd * 0.05], ['One per pole · hex 4 cover screw, refit 8 Nm (OI 23-5, 23-7)', 'Replace on heavy burn-off of the splitter plates (OI 23-6)', S.size === 2 && o.wlClass === 'C' ? 'FS II C: higher chute on an intermediate unit' : 'Ue ≤ 690 V version'], {flyStep: 3 + p * 0.1, fly: [0, 320 + p * 10, -60]});
    bx(ac, pitch * 0.9, CHUTE, bd * 0.5, M.devDark, 0, 0, 0);
    for (let k = 0; k < 9; k++) bx(ac, pitch * 0.74, 2.4, 7, M.black, 0, CHUTE / 2 + 0.6, -bd * 0.22 + k * bd * 0.055);
    hw.bolt(ac, [0, CHUTE / 2 + 2, bd * 0.2], [0, -1, 0], 5, 20, {nut: false, what: 'Arc chute cover screw, hex 4 · 8 Nm'});
    const plates = sub('Arc splitter plates', [0, -6, 0], ['Steel splitter plates divide and cool the arc', 'Count not given in the manual'], {flyStep: 3.4 + p * 0.1, fly: [0, 90, 0]}, ac);
    for (let k = 0; k < 12; k++) bx(plates, pitch * 0.7, CHUTE * 0.8, 2, M.zinc, 0, 0, -bd * 0.21 + k * bd * 0.038);
  });

  // ---------------------------------------------------------------- main shaft retainer (step 4, comes on)
  const ret = sub('Main shaft retainer', [w / 2 + 3, bh * 0.1, -bd * 0.05], ['Fitted before the poles come out, else the mechanism de-adjusts', 'Right side, PH2 (OI 23-12)']);
  const retM = bx(ret, 6, 90, 120, M.accent, 0, 0, 0, 0, {keep: true});
  ctx.ticks.push((TS) => {
    const k = smooth(step(TS) - 4);
    retM.visible = k > 0.002;
    retM.position.x = (1 - k) * 260;
  });

  // ---------------------------------------------------------------- racking shaft (step 5) with a crank on each side
  if (!fixed) {
    const rs = sub('Racking shaft', [0, -bh / 2 + 44, zN - 26], ['Transverse shaft, a crank on each side in the guide frame', 'Retaining ring DIN 471-17 × 1, spacer Ø30.1 × Ø45 × 0.5 (OI 23-15)'], {flyStep: 5, fly: [w / 2 + 340, 0, 40]});
    cy(rs, 8.5, w + 40, M.bolt, 0, 0, 0, {rz: Math.PI / 2, seg: 12});
    for (const sx of [-1, 1]) {
      bx(rs, 8, 52, 18, M.zinc, sx * (w / 2 + 14), -14, 0);
      cy(rs, 13, 3, M.devDark, sx * (w / 2 + 8), 0, 0, {rz: Math.PI / 2, seg: 14});
    }
  }

  // ---------------------------------------------------------------- feet (step 7: hex 4, 10 Nm)
  for (const sx of [-1, 1]) {
    const ft = sub(`Breaker foot ${sx < 0 ? 'left' : 'right'}`, [sx * (w / 2 - 18), -bh / 2 - FOOT / 2, -bd * 0.05], [fixed ? 'Fixed-mounting foot with captive nuts' : 'Draw-out foot: rated-current coding bolts M4 × 16 (OI 17-7)', 'Earthing hole Ø14 (OI 5-22) · hex 4 · 10 Nm (OI 23-22)'], {flyStep: 7, fly: [sx * 200, -80, 0]});
    bx(ft, 36, FOOT, bd * 0.8, M.zinc, 0, 0, 0);
    bx(ft, 6, 40, bd * 0.6, M.zinc, sx * 15, FOOT / 2 + 20, 0);
    for (const zz of [-bd * 0.3, 0, bd * 0.3]) hw.screw(ft, [sx * 18, FOOT / 2 + 30, zz], [sx, 0, 0], 6, 'Foot screw hex 4 · 10 Nm');
    cy(ft, 7, 4, M.black, sx * 18, 0, -bd * 0.34, {rz: Math.PI / 2, seg: 12});
  }

  // ---------------------------------------------------------------- the rear wall with the main contacts (step 8)
  const rwz = -bd / 2 + rd / 2;
  const rwall = sub('Rear wall', [0, 0, rwz], ['Moulded rear housing: main terminals and fixed contacts', `Hex ${S.size === 3 ? '8 upper / 6 lower · 25 / 18 Nm' : '6 · upper 18 Nm / lower 12 Nm'} (OI 23-21)`, 'End-position retaining springs between rear wall and housing'], {flyStep: 8, fly: [0, 30, -330]});
  bx(rwall, w, bh, rd, M.insul, 0, 0, 0);
  for (const px of poleX)
    for (const yy of [bh * 0.27, -bh * 0.18]) {
      // the main contact blades out of the back, gripped by the disconnecting contacts in CONNECTED
      bx(rwall, pitch * 0.42, 14, 70, M.copperTin, px, yy, -rd / 2 - 35);
      for (const sy of [-1, 1]) hw.bolt(rwall, [px + sy * pitch * 0.32, yy + 28, -rd / 2 - 1], [0, 0, 1], 8, 20, {nut: false, what: 'Rear wall screw'});
    }
  // the upper fixed contacts on the inside of the rear wall (step 9)
  poleX.forEach((px, p) => {
    const fc = sub(`Upper fixed contact ${poleName(p)}`, [px, bh * 0.27, rd / 2 + 8], ['Bolts + nuts hex 5 · 10 Nm (OI 23-19)', 'Square nut in the recess; FS I guide horn 15 Nm'], {flyStep: 9 + p * 0.08, fly: [0, 150, 120]}, rwall);
    bx(fc, pitch * 0.5, 40, 16, M.copper, 0, 0, 0);
    bx(fc, pitch * 0.36, 10, 12, M.copperTin, 0, -22, 4);
    hw.bolt(fc, [0, 8, 8], [0, 0, -1], 8, 20, {what: 'Fixed contact bolt hex 5 · 10 Nm'});
  });

  // ---------------------------------------------------------------- current transformers on the lower terminals (step 6)
  poleX.forEach((px, p) => {
    const ct = sub(`Current transformer ${poleName(p)}`, [px, -bh * 0.18, -bd / 2 - 30], ['Energy and measuring transformer for the ETU', 'CT cover hex 5 · 10 Nm, self-tapping 5 Nm (OI 23-23)'], {flyStep: 6 + p * 0.08, fly: [0, -170 - p * 18, -120]});
    mk(ct, plateGeo(pitch * 0.68, 64, 34, 10, [[0, 0, pitch * 0.46, 24, 0]]), M.devDark, 0, 0, 0);
  });

  // ---------------------------------------------------------------- the pole assemblies in the front housing (step 10)
  poleX.forEach((px, p) => {
    const pg = sub(`Pole assembly ${poleName(p)}`, [px, 0, hz0 - pd / 2], ['Moving contact assembly on its carrier', 'Coupling bolt; grease bearings with Isoflex Topas NB 52 (OI 23-20)', `Spare pole 3WL9111-0AM9${S.size === 1 ? 0 : S.size === 3 ? 3 : o.wlIn > 2000 ? 2 : 1} (OI 23-25)`], {flyStep: 10 + Math.abs(p - (np - 1) / 2) * 0.12, fly: [(p - (np - 1) / 2) * 150, 150, -200]});
    bx(pg, pitch * 0.62, bh * 0.68, pd * 0.7, M.insulRed, 0, 0, 0);
    for (let k = 0; k < 5; k++) bx(pg, pitch * 0.07, bh * 0.36, pd * 0.5, M.copper, -pitch * 0.22 + k * pitch * 0.11, bh * 0.06, -pd * 0.1);
    cy(pg, 6, pitch * 0.7, M.bolt, 0, -bh * 0.2, 0, {rz: Math.PI / 2, seg: 10});
    for (let k = 0; k < 4; k++) bx(pg, pitch * 0.4, 3, pd * 0.4, M.copperTin, 0, -bh * 0.12 - k * 4, -pd * 0.15);
    // the contact wear indicator pin, visible from above with the chutes off (OI 23-9)
    cy(pg, 2.5, 30, M.devLight, 0, bh * 0.36, 0, {seg: 8});
  });

  out.push({j, y: yb + 40, h: 120, amps: o.wlIn, label: m.label, loc, acb: true});
  const cutBottom = yb + PANEL.bottom;
  return {yb, gd, br: B, zTerm: gz - gd / 2 - 10, px: phaseX, com, gf, gh, gz, rw, rx: rx(1), cut: {y: cutBottom + PANEL.cutH / 2, w: PANEL.cutW, h: PANEL.cutH}};
}

// the cut-out mask for the panel print: transparent where the ETU and the lever pass through
const maskCache = {};
function cutoutMask(etu) {
  if (maskCache[etu]) return maskCache[etu];
  const t = faceTex(296, 346, (g, W, H) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#000';
    g.fillRect(W * 0.155 - 43, H * 0.445 - (H * 0.55) / 2 - 1, 86, H * 0.55 + 2);
    g.fillRect(W * 0.71 - 17, H * 0.45 - (H * 0.54) / 2, 34, H * 0.54);
  });
  t.colorSpace = THREE.NoColorSpace;
  maskCache[etu] = t;
  return t;
}

/** the COM35 Ethernet patch cables from X1 / X2 up to the cross-wiring compartment (field coordinates) */
export function com35Cables(ctx, r) {
  const {M} = ctx;
  const g = part(ctx, {name: 'PROFINET / Modbus TCP cables X1 X2', layer: 'inner', stage: 'devices', at: [0, 0, 0], dir: [0, 0.6, 0.5], dist: 300, lines: ['Industrial Ethernet, RJ45, 100 Mbit/s', 'Daisy chain through the COM35 switch (COM p.13)', 'Up to the cross-wiring compartment']});
  const x0 = r.gf.position.x + r.rx;
  const y0 = r.gf.position.y + r.com.position.y + 4;
  const z0 = r.gz + r.com.position.z + 50;
  const teal = M.cableTeal || (M.cableTeal = new THREE.MeshStandardMaterial({color: '#2a9d8f', roughness: 0.7}));
  for (const [k, dx] of [[0, -4], [1, 14]]) {
    mk(g, cableGeo([[x0 + dx, y0, z0], [x0 + dx, y0, z0 + 30], [x0 + dx + 10, y0 + 80, z0 + 20], [ctx.W - 120 + k * 14, ctx.yt - 200, -40], [ctx.W - 120 + k * 14, ctx.yt - 160, -120]], 3.2), teal, 0, 0, 0, {shadow: false});
  }
  return g;
}
