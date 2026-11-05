// The lineup's math: where every field sits, which fields ship together as a transport unit (and so where the
// busbar fishplate joints fall), how much of each device compartment is used, the rated values the panels show, an
// estimated weight and the configuration rules the documents state. One configuration in, one result out; the
// geometry and every panel read from it, so nothing on screen can disagree (rule 2).
import {BREAKERS, BUSBAR, FIELD_TYPES, MODULE_KINDS, SIDE_DESIGN, SIDE_T, TU_MAX, barsFor, devHeight, ROWS, HEAD} from './catalog.js';

export function layout(cfg) {
  const side = cfg.designStrip ? SIDE_DESIGN : SIDE_T;
  const xs = [];
  let x = 0;
  for (const f of cfg.fields) {
    xs.push(x);
    x += f.width;
  }
  const length = x + 2 * side;
  // transport units: consecutive fields up to TU_MAX; a 3WA13 field always starts its own (ships separately, OI TL p.9)
  const tu = [];
  let cur = [];
  let len = 0;
  cfg.fields.forEach((f, i) => {
    if (cur.length && (len + f.width > TU_MAX || f.opts?.acb === '3WA13')) {
      tu.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(i);
    len += f.width;
  });
  if (cur.length) tu.push(cur);
  const tuOf = [];
  tu.forEach((g, k) => g.forEach((i) => (tuOf[i] = k)));
  // a fishplate joint on the right edge of the last field of every transport unit but the last
  const jointRight = cfg.fields.map((_, i) => i < cfg.fields.length - 1 && tuOf[i] !== tuOf[i + 1]);

  const rows = cfg.busbar === 'top' ? BUSBAR.top : BUSBAR.rear;
  const rating = rows.find((r) => r[0] === cfg.In) || rows[0];
  const ventilated = cfg.ip !== 'IP54';
  const pack = barsFor(cfg.In);

  const cap = cfg.fields.map((f) => FIELD_TYPES[f.type].capacity(cfg, f));
  const warnings = [];
  let units = 0;
  let kg = 0;
  let loss = 0;
  const count = {};
  const inc = (k, n = 1) => (count[k] = (count[k] || 0) + n);
  cfg.fields.forEach((f, i) => {
    const T = FIELD_TYPES[f.type];
    // weight: the type's reference field from TIP Tab. 9/1, scaled by width and depth [estimate]
    const [k0, w0, d0] = T.kg;
    kg += k0 * (f.width / w0) * Math.sqrt(cfg.depth / d0) * (cfg.height === 2000 ? 0.93 : 1);
    if (T.needsRear && cfg.busbar === 'top') warnings.push(`${f.tag}: 3NJ4 needs a rear main busbar`);
    if (f.type === 'acb') {
      const br = BREAKERS[f.opts.acb];
      if (f.width < br.minW) warnings.push(`${f.tag}: ${f.opts.acb} needs ≥ ${br.minW} mm`);
      if (f.opts.n === 2 && cfg.busbar === 'top') warnings.push(`${f.tag}: 2 ACBs need a rear busbar`);
      if (f.opts.n === 2 && cfg.height !== 2200) warnings.push(`${f.tag}: 2 ACBs need frame 2200`);
      if ((f.opts.acb === '3WA13') && cfg.height !== 2200) warnings.push(`${f.tag}: 3WA13 needs frame 2200`);
      if (br.In[br.In.length - 1] > cfg.In * 1.6 && f.opts.role === 'infeed') warnings.push(`${f.tag}: breaker exceeds busbar`);
      kg += br.kg * (f.opts.n || 1);
      loss += br.loss * 0.64 * (f.opts.n || 1);
      inc(br.fixed ? 'MCCB 3VA' : `ACB ${f.opts.acb}`, f.opts.n || 1);
    }
    for (const m of f.modules) {
      const K = MODULE_KINDS[m.kind];
      if (K.positions || ['fixed', 'cover', 'capstage', 'capfuse'].includes(m.kind) || K.axis) units += m.cols || 1;
      if (m.kind === 'hfd' || m.kind === 'sfd') inc(`Withdrawable ${m.kind.toUpperCase()}`);
      else if (m.kind === 'small') inc(`Small withdrawable 1/${m.cols}`, m.cols);
      else if (m.kind.startsWith('nj')) inc(m.kind.startsWith('nj4') ? '3NJ4 strips' : '3NJ63 strips');
      else if (m.kind === 'capstage') inc('Capacitor modules');
      else if (/^fs/.test(m.kind)) inc('G120 converters');
      else if (m.kind === 'fixed' || m.kind === 'cover') inc('Fixed-mounted modules');
    }
    if (T.modular && !T.locked) {
      const used = f.modules.reduce((a, m) => a + m.h, 0);
      if (used > cap[i]) warnings.push(`${f.tag}: compartment overfull`);
    }
    loss += {universal: 600, plugin: 1500, fixedcover: 600, nj4: 600, pfc: 1.4 * 250, fc: 1200, ccs: 100, acb: 0}[f.type] || 0;
  });
  const tuCount = tu.length;

  // location code of a module (OI OFFW p.6–7): row letter from the 100 mm grid, half-row A/B, slot 1–4
  const loc = (i, j, slot = 1) => {
    const f = cfg.fields[i];
    let top = 0;
    for (let k = 0; k < j; k++) top += f.modules[k].h;
    const r = Math.floor(top / 100);
    const half = top % 100 >= 50 ? 'B' : 'A';
    return `${f.tag}.${ROWS[r] || 'U'}${half}00${slot}`;
  };

  return {
    xs, length, side, tu, tuOf, tuCount, jointRight, rating, In: rating[0], Icw: rating[2], ventilated, pack,
    cap, warnings, units, weight: Math.round(kg / 10) * 10, loss: Math.round(loss), count, loc,
    transport: tuCount,
    devH: devHeight(cfg.height),
    head: HEAD,
  };
}
