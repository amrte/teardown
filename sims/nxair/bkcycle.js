// Breaker operating cycles on a real time base, for the animation and the timing chart of the Breaker tab.
//
// Each operation is a profile: t (ms, or s for charging) → breaker pose (crank angle, contact position, coil pulses)
// plus the switching moments of the auxiliary contacts. The 3D animation plays the profile in slow motion, the
// chart draws the same profile, so both always agree.
//
// What is from the manual (SION 3AE5, 9229 0025 100 0C p. 37): closing time ≤ 60 ms, opening time ≤ 30 ms with -Y1,
// arcing < 15 ms, break time ≤ 45 ms, dead time 300 ms, minimum command -Y9 45 ms / -Y1 40 ms, -S6 pulse > 10 ms,
// charging < 15 s. What is drawn: the shape of the travel curve, the latch delay and the moments the auxiliary
// switch -S1 changes over (Siemens publishes none of these); the contact travel uses the model's drawn stroke.

const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const easeIO = (x) => { const t = Math.min(1, Math.max(0, x)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const pulse = (t, up, hold, down) => (t < 0 ? 0 : t < up ? t / up : t < up + hold ? 1 : Math.max(0, 1 - (t - up - hold) / down));

export function makeProfiles(bk) {
  const touch = bk.touchS;
  const T_REL = 8; // closing latch freed by -Y9 (drawn)
  const T_TOUCH = 55; // contact touch (≤ 60 ms in the manual)
  const sClose = (crank) => (crank >= 290 ? 1 : bk.sAtCrank(crank));
  const crankAt = (t, D) => (t < T_REL ? 170 : 170 + 190 * easeIO((t - T_REL) / D));
  // find the crank-stroke duration that puts the contact touch at T_TOUCH
  const touchAt = (D) => { for (let t = 0; t <= 200; t += 0.25) if (sClose(crankAt(t, D)) >= touch) return t; return 999; };
  let lo = 10, hi = 300;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; (touchAt(m) < T_TOUCH ? (lo = m) : (hi = m)); }
  const D = (lo + hi) / 2;
  const firstT = (f, T, step = 0.25) => { for (let t = 0; t <= T; t += step) if (f(t)) return t; return null; };

  const close = {
    kind: 'close', T: 100, anim: 1.8, unit: 'ms', label: 'Closing',
    at(t) {
      const crank = crankAt(t, D);
      return {crank, s: sClose(crank), c: Math.max(0, 1 - (crank - 170) / 190), pClose: pulse(t, 6, 30, 10)};
    },
  };
  close.ev = {
    release: T_REL,
    touch: firstT((t) => close.at(t).s >= touch, 100),
    full: firstT((t) => close.at(t).s >= 0.999, 100),
    nc: firstT((t) => close.at(t).s >= 0.45, 100), // -S1 NC open (cuts -Y9)
    no: firstT((t) => close.at(t).s >= 0.93, 100), // -S1 NO closed
    spring: T_REL + D, // crank at 360°: spring discharged, -S21 closes, the motor starts
  };

  const T_UNL = 20, OPEN_D = 32;
  const open = {
    kind: 'open', T: 80, anim: 1.4, unit: 'ms', label: 'Opening',
    at(t) { return {s: t < T_UNL ? 1 : 1 - smooth((t - T_UNL) / OPEN_D), pOpen: pulse(t, 5, 16, 10)}; },
  };
  open.ev = {
    unlatch: 6,
    sep: firstT((t) => open.at(t).s < touch, 80),
    no: firstT((t) => open.at(t).s < 0.8, 80), // -S1 NO 23-24 open (cuts -Y1)
    nc: firstT((t) => open.at(t).s < 0.45, 80), // -S1 NC closed
    full: firstT((t) => open.at(t).s < 0.001, 80),
  };
  open.ev.arcEnd = open.ev.sep + 10; // current zero after < 15 ms
  open.ev.s6 = open.ev.no + 2;

  const charge = {
    kind: 'charge', T: 16, anim: 2.6, unit: 's', label: 'Charging the closing spring (motor)',
    at(t, from) { const c = Math.min(1, from.c + (1 - from.c) * (t / 14)); return {c, crank: 170 * c, motor: t < 14}; },
    ev: {done: 14},
  };
  const hand = {
    kind: 'hand', T: 50, anim: 6, unit: 'turns', label: 'Charging by hand crank',
    at(t, from) { const c = Math.min(1, from.c + (1 - from.c) * (t / 50)); return {c, crank: 170 * c, toolRot: (t / 50) * 8 * Math.PI * 2}; },
  };
  const dead = {kind: 'dead', T: 300, anim: 0.9, unit: 'ms', label: 'Dead time', at: () => ({})};
  return {close, open, charge, hand, dead};
}

// ------------------------------------------------------------------------------------------------ chart
// Narrow layout for the side pane: each row has its label above the trace, the event marks are listed on top.
const W = 440, LX = 10, RX = W - 12, ROW = 33;
export function chartSvg(P, kind, opts = {}) {
  const p = P[kind];
  const xs = (t) => LX + ((RX - LX) * t) / p.T;
  const rows = [];
  const marks = [];
  const dig = (label, ranges, cls = '') => rows.push({label, ranges, cls});
  const ana = (label, f) => rows.push({label, f});
  if (kind === 'close') {
    const e = p.ev;
    dig('ON command (-Y9 ≥ 45 ms)', [[0, 45]], 'cmd');
    dig('-Y9 coil current (cut by -S1)', [[0, Math.min(45, e.nc)]], 'coil');
    dig('Closing latch freed', [[e.release, e.release + 22]]);
    ana('Contact travel', (t) => p.at(t).s);
    dig('Main contacts closed', [[e.touch, p.T]], 'main');
    dig('-S1 NC 11-12 … 61-62', [[0, e.nc]]);
    dig('-S1 NO 13-14 … 63-64', [[e.no, p.T]]);
    dig('Closing spring charged', [[0, e.spring]]);
    dig(opts.aux === false ? 'Motor -M1 (supply off)' : 'Motor -M1 → recharges < 15 s', opts.aux === false ? [] : [[e.spring, p.T]], 'motor');
    marks.push([60, 'closing time ≤ 60 ms'], [e.touch, `touch ${Math.round(e.touch)} ms`]);
  } else if (kind === 'open') {
    const e = p.ev;
    dig('OFF command (-Y1 ≥ 40 ms)', [[0, 40]], 'cmd');
    dig('-Y1 coil current (cut by -S1)', [[0, Math.min(40, e.no)]], 'coil');
    dig('Opening latch lifted', [[e.unlatch, e.unlatch + 20]]);
    ana('Contact travel', (t) => p.at(t).s);
    dig('Main contacts closed', [[0, e.sep]], 'main');
    dig('Arc (until current zero)', [[e.sep, e.arcEnd]], 'arc');
    dig('-S1 NO 23-24 …', [[0, e.no]]);
    dig('-S1 NC 11-12 …', [[e.nc, p.T]]);
    dig('-S6 "tripped" (> 10 ms)', [[e.s6, e.s6 + 12]]);
    marks.push([30, 'opening ≤ 30 ms'], [45, 'break ≤ 45 ms'], [e.sep, `contacts part ${Math.round(e.sep)} ms`]);
  } else if (kind === 'charge') {
    dig('Motor -M1 running', [[0, 14]], 'motor');
    ana('Closing spring charge', (t) => p.at(t, {c: 0}).c);
    dig('-S21 (motor circuit closed)', [[0, 14]]);
    dig('-S3, -S4 closed (spring not charged)', [[0, 14]]);
    marks.push([15, 'charging < 15 s']);
  }
  const M0 = 24, top = M0 + marks.length * 12 + 6;
  const H = top + rows.length * ROW + 18;
  const out = [`<svg class="tchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Timing chart of ${p.label}">`];
  out.push(`<text x="${LX}" y="14" class="ttl">${p.label}</text>`);
  out.push(`<text x="${RX}" y="14" class="ax" text-anchor="end">t in ${p.unit}</text>`);
  // time axis
  const step = p.T <= 100 ? 10 : p.T <= 300 ? 50 : 2;
  for (let t = 0; t <= p.T + 1e-6; t += step) {
    out.push(`<line x1="${xs(t)}" y1="${top}" x2="${xs(t)}" y2="${H - 16}" class="grid"/>`);
    out.push(`<text x="${xs(t)}" y="${H - 4}" class="ax" text-anchor="${t === 0 ? 'start' : t >= p.T ? 'end' : 'middle'}">${t}</text>`);
  }
  rows.forEach((r, i) => {
    const y0 = top + i * ROW, yh = y0 + 16, yl = y0 + ROW - 3;
    out.push(`<text x="${LX}" y="${y0 + 10}" class="lbl">${r.label}</text>`);
    if (r.f) {
      const pts = [];
      for (let k = 0; k <= 200; k++) { const t = (p.T * k) / 200; pts.push(`${xs(t).toFixed(1)},${(yl - (yl - yh) * r.f(t)).toFixed(1)}`); }
      out.push(`<polyline points="${pts.join(' ')}" class="ana"/>`);
    } else {
      let d = `M${LX},${yl}`;
      for (const [a, b] of r.ranges) d += ` L${xs(a)},${yl} L${xs(a)},${yh} L${xs(Math.min(b, p.T))},${yh} L${xs(Math.min(b, p.T))},${yl}`;
      d += ` L${RX},${yl}`;
      out.push(`<path d="${d}" class="dig ${r.cls}"/>`);
      for (const [a, b] of r.ranges) if (r.cls) out.push(`<rect x="${xs(a)}" y="${yh}" width="${Math.max(0, xs(Math.min(b, p.T)) - xs(a))}" height="${yl - yh}" class="fill ${r.cls}"/>`);
    }
  });
  marks.filter(([t]) => t != null && t <= p.T).sort((a, b) => a[0] - b[0]).forEach(([t, lab], k) => {
    const y = M0 + k * 12, x = xs(t), right = x > (LX + RX) / 2;
    out.push(`<line x1="${x}" y1="${y + 2}" x2="${x}" y2="${H - 16}" class="mark"/>`);
    out.push(`<text x="${right ? x - 3 : x + 3}" y="${y + 8}" class="mk" text-anchor="${right ? 'end' : 'start'}">${lab}</text>`);
  });
  out.push(`<line id="bkCursor" x1="${LX}" y1="${top}" x2="${LX}" y2="${H - 16}" class="cursor"/>`);
  out.push('</svg>');
  return {svg: out.join(''), xs};
}
