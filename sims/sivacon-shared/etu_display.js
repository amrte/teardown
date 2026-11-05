// The trip unit's front, drawn live from the simulation (wl_sim.js) after the drawings in the operating instructions:
// ETU15B / 25B / 27B (OI 8-3, 8-6, 8-9), ETU45B with or without its alphanumeric display (8-12) and ETU76B with its
// graphical display (8-17). One routine draws it into any 2D canvas in a 240 x 600 drawing space: the 3D model's ETU
// face and the full-size replica panel share it, and so do their click zones (hits), so a press on either works.
import {activeSettings, hasG, igA, settingsFor, WL_ETU} from './wl.js';
import {displayModel, leds} from './wl_sim.js';
import {draw76} from './etu76.js';

export const ETU_W = 240;
export const ETU_H = 600;

const txt = (g, s, x, y, size, color = '#e8eef2', weight = 600, align = 'left', font = 'Inter, sans-serif') => {
  g.fillStyle = color;
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(s, x, y);
};
const rrect = (g, x, y, w, h, r, fill, stroke) => {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = 1.5;
    g.stroke();
  }
};
const knob = (g, cx, cy, r, frac, label, value) => {
  g.fillStyle = '#d9dde0';
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  // scale ticks
  g.strokeStyle = '#9aa3aa';
  g.lineWidth = 1;
  for (let i = 0; i <= 9; i++) {
    const a = -Math.PI * 1.25 + (i / 9) * Math.PI * 1.5;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
    g.lineTo(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6));
    g.stroke();
  }
  g.fillStyle = '#2f3a44';
  g.beginPath();
  g.arc(cx, cy, r * 0.74, 0, Math.PI * 2);
  g.fill();
  const a = -Math.PI * 1.25 + frac * Math.PI * 1.5;
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
  g.stroke();
  txt(g, label, cx, cy - r - 9, 9.5, '#e8eef2', 700, 'center');
  txt(g, value, cx, cy + r + 8, 8.5, '#9fd3c7', 700, 'center');
};
const slide = (g, x, y, label, on, a = 'OFF', b = 'ON') => {
  txt(g, label, x, y, 8.5, '#e8eef2', 700);
  rrect(g, x + 42, y - 6, 34, 12, 3, '#1b2126');
  rrect(g, x + 42 + (on ? 18 : 2), y - 4.5, 14, 9, 2, '#d9dde0');
  txt(g, a, x + 82, y - 4, 6, '#c9d1d6', 600);
  txt(g, b, x + 82, y + 4, 6, '#c9d1d6', 600);
};
const ledDot = (g, x, y, on, color = '#7fe39a') => {
  g.fillStyle = on ? color : '#4c5862';
  g.fillRect(x, y, 10, 8);
};

/**
 * Draws the ETU front for simulation state st into 2D context g (240 x 600 units) and returns the click zones:
 * [{id, x, y, w, h}], id = 'up' | 'down' | 'esc' | 'enter' | 'test' | 'query' | 'clear' | 'reset' |
 * 'knob:<key>' | 'slide:<what>'.
 */
export function drawETU(g, st, now) {
  const o = st.o;
  const E = WL_ETU[o.wlEtu];
  const P = activeSettings(o);
  const L = leds(st, now);
  const S = settingsFor(o);
  const e = st.etu;
  const hits = [];
  const hit = (id, x, y, w, h) => hits.push({id, x, y, w, h});
  // every indicator is collected and drawn last, so the self-test running light can pass through all of them in turn
  const lamps = [];
  const lamp = (x, y, on, c) => lamps.push([x, y, on, c]);
  const W = ETU_W;
  const H = ETU_H;
  g.fillStyle = '#3d4a56';
  g.fillRect(0, 0, W, H);
  // top strip: BREAKER TRIPPED with the reset pin (out and red after a trip) and the safety lock
  rrect(g, 10, 10, W - 20, 58, 4, '#33404b');
  txt(g, 'BREAKER TRIPPED', 18, 24, 11.5, '#e8eef2', 700);
  const pr = 10 - (st.resetPress || 0) * 3;
  g.fillStyle = st.tripped ? '#d6182b' : '#c9d1d6';
  g.beginPath();
  g.arc(36, 48, st.tripped ? pr + 2 : pr, 0, Math.PI * 2);
  g.fill();
  txt(g, 'RESET', 54, 48, 10.5, '#e8eef2', 700);
  hit('reset', 20, 32, 70, 32);
  g.fillStyle = '#1b2126';
  g.beginPath();
  g.arc(W - 36, 42, 15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#5a6670';
  g.fillRect(W - 38, 32, 4, 20);
  // type name and the LEDs (slanted labels)
  txt(g, E.name.replace(' with display', ''), W - 14, 88, 22, '#e8eef2', 800, 'right');
  txt(g, 'Release 2', W - 14, 106, 9, '#c9d1d6', 600, 'right');
  const ledList = E.face === 'graphic' ? [['ACTIVE', L.ACTIVE], ['ALARM', L.ALARM, '#e7c11e'], ['COMM.', L.COMM], ['EXTEND.', L.EXTEND], ['TRIP L', L.L, '#ff5b5b'], ['TRIP N', L.N, '#ff5b5b'], ['TRIP S', L.S, '#ff5b5b'], ['TRIP I', L.I, '#ff5b5b']] : o.wlEtu === '45B' || o.wlEtu === '45BD' ? [['ACTIVE', L.ACTIVE], ['ALARM', L.ALARM, '#e7c11e'], ['COMM.', L.COMM], ['EXTEND.', L.EXTEND]] : [['ACTIVE', L.ACTIVE], ['ALARM', L.ALARM, '#e7c11e']];
  ledList.forEach(([s, on, c], i) => {
    lamp(16 + i * 26, 152, on, c);
    g.save();
    g.translate(20 + i * 26, 146);
    g.rotate(-Math.PI / 4);
    txt(g, s, 0, 0, 7.5, '#c9d1d6', 600);
    g.restore();
  });

  // ---------------------------------------------------------------- display
  const dm = displayModel(st);
  const mono = '"JetBrains Mono", monospace';
  if (E.face === 'graphic') {
    const x0 = 26;
    const y0 = 166;
    const dw = W - 52;
    const dh = 158;
    draw76(g, st, x0, y0, dw, dh, {txt, rrect, mono, setOpt: () => {}});
    // rating plug, T.U. ERROR, keys
    rrect(g, 16, 336, 118, 32, 3, '#9aa3aa');
    txt(g, `In = ${o.wlIn} A`, 75, 352, 12.5, '#16181b', 700, 'center');
    rrect(g, 140, 336, 28, 32, 2, '#5a6670');
    txt(g, 'T.U.', 154, 346, 7.5, '#e8eef2', 700, 'center');
    txt(g, 'ERROR', 154, 358, 6.5, '#e8eef2', 700, 'center');
    const key = (id, s, x, y, w) => {
      rrect(g, x, y, w, 28, 4, '#9aa3aa');
      txt(g, s, x + w / 2, y + 14, 11, '#16181b', 800, 'center');
      hit(id, x, y, w, 28);
    };
    key('up', '▲', 180, 334, 42);
    key('down', '▼', 180, 368, 42);
    key('esc', 'ESC', 40, 384, 54);
    key('enter', 'ENTER', 100, 384, 66);
    // sealing eyelet
    g.fillStyle = '#1b2126';
    g.fillRect(200, 410, 8, 14);
  } else {
    let y = 166;
    if (E.display) {
      // ETU45B: 4 lines x 20 characters, inclined, ▲ ▼ below (OI 8-30)
      rrect(g, 26, y, W - 52, 70, 3, '#b9e3d8');
      dm.lines.slice(0, 4).forEach((l, i) => txt(g, l.slice(0, 20), 32, y + 12 + i * 15.5, 10, '#16303a', 700, 'left', mono));
      for (const [id, s, x] of [['up', '▲', 48], ['down', '▼', 168]]) {
        g.fillStyle = '#1b2126';
        g.beginPath();
        g.arc(x, y + 88, 9, 0, Math.PI * 2);
        g.fill();
        txt(g, s, x + (id === 'up' ? 18 : -18), y + 88, 11, '#e8eef2', 800, 'center');
        hit(id, x - 14, y + 74, 40, 28);
      }
      y += 106;
    } else {
      rrect(g, 26, y, W - 52, 70, 3, '#33404b');
      txt(g, o.wlEtu === '15B' ? 'In = In max' : '', W / 2, y + 35, 10, '#c9d1d6', 600, 'center');
      y += 82;
    }
    // rating plug (ETU15B has a fixed In) and T.U. ERROR
    rrect(g, 16, y, 106, 30, 3, '#9aa3aa');
    txt(g, `In = ${o.wlIn} A`, 69, y + 15, 12, '#16181b', 700, 'center');
    rrect(g, 128, y, 24, 30, 2, '#5a6670');
    txt(g, 'T.U.', 140, y + 15, 7, '#e8eef2', 700, 'center');
    // slide switches (ETU45B: MEMORY, IN on/off, IN 0.5/1, I²t/I⁴t; ETU27B: N on/off)
    if (o.wlEtu === '45B' || o.wlEtu === '45BD') {
      slide(g, 156, y + 3, 'MEMORY', e.mem !== false);
      hit('slide:mem', 154, y - 4, 84, 14);
      slide(g, 156, y + 19, 'IN', o.wlIN !== 'OFF');
      hit('slide:INon', 154, y + 12, 84, 14);
      slide(g, 156, y + 35, 'IN =', o.wlIN === 1, '.5', '1×In');
      hit('slide:INval', 154, y + 28, 84, 14);
      slide(g, 156, y + 51, 'I²t', !!e.i4t, 'I²t', 'I⁴t');
      hit('slide:i4t', 154, y + 44, 84, 14);
    } else if (o.wlEtu === '27B') {
      slide(g, 156, y + 15, 'N', o.wlIN !== 'OFF', 'OFF', '1×In');
      hit('slide:INon', 154, y + 8, 84, 14);
    }
    y += 64;
    // rotary coding switches: L S I on the left, the delays on the right (OI 8-12)
    const frac = (k) => {
      const s = S.find((x) => x.key === k);
      return s ? Math.max(0, s.steps.map(String).indexOf(String(o[k]))) / Math.max(1, s.steps.length - 1) : null;
    };
    const val = (k) => {
      const v = o[k];
      return v === undefined ? '' : `${v}${typeof v === 'number' ? (k[2] === 't' ? ' s' : '') : ''}`;
    };
    const rows = [['L · IR', 'wlIr', 'tR', 'wltR'], ['S · Isd', 'wlIsd', 'tsd', 'wltsd'], ['I · Ii', 'wlIi', '', null]];
    rows.forEach(([n, a, n2, b], i) => {
      const yy = y + 14 + i * 62;
      const fa = frac(a);
      if (fa !== null) {
        knob(g, 58, yy, 17, fa, n, val(a));
        hit(`knob:${a}`, 30, yy - 30, 56, 60);
      } else {
        rrect(g, 24, yy - 14, 70, 28, 3, '#33404b');
        txt(g, n.startsWith('I') ? 'Ii ≥ 20 × In' : n.startsWith('S') ? '—' : '', 59, yy, 8.5, '#c9d1d6', 700, 'center');
      }
      if (b) {
        const fb = frac(b);
        if (fb !== null) {
          knob(g, 182, yy, 17, fb, n2, val(b));
          hit(`knob:${b}`, 154, yy - 30, 56, 60);
        } else if (b === 'wltR') {
          rrect(g, 146, yy - 14, 74, 28, 3, '#33404b');
          txt(g, 'tR = 10 s', 183, yy, 8.5, '#c9d1d6', 700, 'center');
        }
      }
    });
    // trip-cause LEDs in their dashed oval (lit on QUERY)
    g.setLineDash([3, 3]);
    g.strokeStyle = '#9aa3aa';
    g.beginPath();
    g.ellipse(120, y + 80, 20, 46, 0, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    [['L', L.L], ['N', L.N], ['S', L.S], ['I', L.I]].forEach(([s, on], i) => {
      lamp(108, y + 50 + i * 16, on, '#ff5b5b');
      txt(g, s, 124, y + 54 + i * 16, 8, '#e8eef2', 700);
    });
  }
  // the ground-fault zone: ETU27B G switch, GFM AT 45B, GFM AT 55B-76B
  if (hasG(o)) {
    const y = 494;
    rrect(g, 12, y, W - 24, 54, 3, '#33404b');
    txt(g, o.wlEtu === '27B' ? 'G' : E.face === 'graphic' ? 'GFM AT 55B-76B' : 'GFM AT 45B', 20, y + 10, 9.5, '#e8eef2', 700);
    if (E.face === 'graphic') {
      txt(g, `Ig = ${P.Ig} A`, 22, y + 26, 10, '#e8eef2', 700);
      txt(g, `tg = ${P.tg} s`, 22, y + 42, 10, '#e8eef2', 700);
    } else {
      knob(g, 46, y + 28, 12, ['A', 'B', 'C', 'D', 'E'].indexOf(o.wlIg) / 4, '', '');
      txt(g, `${o.wlIg} · ${igA(o, o.wlIg)} A`, 64, y + 44, 8.5, '#9fd3c7', 700);
      hit('knob:wlIg', 28, y + 12, 40, 34);
      knob(g, W - 46, y + 28, 12, [0.1, 0.2, 0.3, 0.4, 0.5].indexOf(o.wltg) / 4, '', '');
      txt(g, `${o.wltg} s`, W - 64, y + 44, 8.5, '#9fd3c7', 700, 'right');
      hit('knob:wltg', W - 64, y + 12, 40, 34);
    }
    lamp(112, y + 18, L.G, '#ff5b5b');
    txt(g, 'TRIP', 126, y + 22, 7.5, '#e8eef2', 700);
    lamp(112, y + 32, false, '#e7c11e');
    txt(g, 'ALARM', 126, y + 36, 7.5, '#e8eef2', 700);
  }
  // TEST · QUERY · CLEAR over the test connector
  ['test', 'query', 'clear'].forEach((id, i) => {
    const x = 46 + i * 74;
    const p = e.keys?.[id] || 0;
    if (p > 0) {
      g.fillStyle = 'rgba(231,193,30,.55)';
      g.beginPath();
      g.arc(x, 563, 16, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = p > 0 ? '#a9aba7' : '#e4e5e2';
    g.beginPath();
    g.arc(x, 563, 12 - p * 2, 0, Math.PI * 2);
    g.fill();
    txt(g, id.toUpperCase(), x, 582, 8, '#e8eef2', 700, 'center');
    hit(id, x - 18, 549, 36, 40);
  });
  rrect(g, 40, 590, W - 80, 7, 2, '#9aa3aa');
  const runI = L.run >= 0 ? L.run % lamps.length : -1;
  lamps.forEach(([x, y, on, c], i) => ledDot(g, x, y, runI >= 0 ? i === runI : on, c));
  return hits;
}

/** the click zone at drawing coordinates (x, y), or null */
export const hitAt = (hits, x, y) => hits.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) || null;
