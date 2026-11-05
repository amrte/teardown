// The configurator's overlay: title and the lineup readouts top left, the field inspector (type, width, the device
// compartment's modules) down the left, the part card and bill of materials on the right, the lineup strip along
// the bottom (click a field, add one at either end, move it, remove it), the teardown slider with its eight stages,
// camera views and layer toggles. Fixed 1600 x 900 CSS layout like the other examples; panels are rebuilt from the
// configuration on every change (refresh) and the live parts (callouts, slider, hover card) move every frame (frame).
import {FIELD_TYPES, MODULE_KINDS, SYSTEM} from './catalog.js';
import {STAGES} from './registry.js';
import {activeSettings, com35Data, hasG, isWL, NMAINT, orderNo, settingsFor, tripTime, WL_ETU, WL_MAINT} from './wl.js';
import {currents, faults, posAt, RACK, TIME_X} from './wl_sim.js';
import {drawETU, ETU_H, ETU_W, hitAt} from './etu_display.js';

export const C = {ink: '#16181b', mute: '#8b8f95', faint: '#c9ccd0', line: '#e1e3e6', panel: 'rgba(248,248,249,.94)', red: '#d6182b', copper: '#c8784a', blue: '#3d8fe0'};
export const VIEWS = ['iso', 'front', 'rear', 'side', 'top', 'field'];
export const LAYERS = ['enclosure', 'doors', 'busbar', 'units', 'hardware', 'labels'];

const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.ui *{box-sizing:border-box}
.pn{position:absolute;background:${C.panel};border:1px solid ${C.line};box-shadow:0 1px 2px rgba(20,22,26,.04);pointer-events:auto}
.cp{font-size:9.6px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap}
.mu{color:${C.mute}}
.hd{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:7px;min-width:0}
.hd .cp:first-child{font-weight:700;flex:none}
.hd .cp:last-child:not(:first-child){min-width:0;overflow:hidden;text-overflow:ellipsis}
.tb{height:19px;padding:0 7px;display:inline-flex;align-items:center;justify-content:center;font-size:8.6px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;border:1px solid ${C.line};background:#fff;color:${C.ink};white-space:nowrap;cursor:pointer;pointer-events:auto;user-select:none}
.tb:hover{border-color:${C.faint};filter:brightness(.97)}
.tb.on{background:${C.ink};color:#fff;border-color:${C.ink}}
.tb.acc{background:${C.red};color:#fff;border-color:${C.red}}
.tb.dis{opacity:.35;pointer-events:none}
.row{display:flex;gap:4px;flex-wrap:wrap}
.sep{height:1px;background:${C.line};margin:8px 0}
.kv{display:flex;justify-content:space-between;font-size:10.5px;line-height:17px}
.kv b{font-weight:600}
.ty{display:flex;align-items:center;gap:7px;padding:4px 6px;font-size:10.5px;border:1px solid transparent;cursor:pointer;line-height:1.2}
.ty:hover{background:#fff;border-color:${C.line}}
.ty.on{background:#fff;border-color:${C.ink}}
.ty i{display:block;width:16px;height:22px;border:1px solid ${C.faint};background:#fff;position:relative;flex:none}
.ty small{display:block;color:${C.mute};font-size:8.4px;letter-spacing:.6px;text-transform:uppercase;margin-top:1px}
.mods{position:relative;border:1px solid ${C.line};background:#fff}
.md{position:absolute;left:0;right:0;border-bottom:1px solid ${C.line};display:flex;align-items:center;font-size:9px;line-height:1;padding:0 5px;cursor:pointer;overflow:hidden;white-space:nowrap}
.md:hover{background:#f4f5f6}
.md.on{outline:1.5px solid ${C.red};outline-offset:-1.5px;z-index:2}
.md em{font-style:normal;color:${C.mute};margin-left:auto;padding-left:4px;font-size:8.4px}
.md.free{color:${C.mute};background:repeating-linear-gradient(135deg,#fff 0 6px,#f3f4f5 6px 7px)}
.gauge{height:5px;background:#e6e7e9;position:relative;margin-top:5px}
.gauge b{position:absolute;left:0;top:0;bottom:0;background:${C.ink}}
.lu{position:absolute;bottom:0;display:flex;flex-direction:column;align-items:center;cursor:pointer;pointer-events:auto}
.lu .bx{border:1px solid ${C.faint};background:#fff;width:100%;position:relative}
.lu.on .bx{border:1.5px solid ${C.red}}
.lu .nm{font-size:8.4px;font-weight:600;letter-spacing:.8px;margin-top:3px;white-space:nowrap}
.lu .ws{font-size:8px;color:${C.mute};white-space:nowrap}
.call{position:absolute;white-space:nowrap;pointer-events:none}
.call b{display:block;font-size:11px;font-weight:600;letter-spacing:.1px}
.call span{display:block;font-size:8.4px;font-weight:500;letter-spacing:1.3px;color:${C.mute};text-transform:uppercase;margin-top:2px}
.call.proc{background:rgba(255,255,255,.94);border-left:3px solid #e7c11e;padding:6px 9px;box-shadow:0 2px 10px rgba(0,0,0,.18);white-space:normal;max-width:300px;width:max-content}
.call.proc b{font-size:12.5px}
.call.proc span{color:#8a6d00}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3));pointer-events:none}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.red};opacity:0;z-index:49;pointer-events:none}
.tick{position:absolute;top:13px;width:1px;height:7px;background:${C.faint}}
.toast{position:absolute;left:800px;top:92px;transform:translateX(-50%);padding:5px 12px;background:${C.ink};color:#fff;font-size:10px;font-weight:600;letter-spacing:.5px;opacity:0;transition:opacity .25s;pointer-events:none;white-space:nowrap}
.scroll{overflow-y:auto;overflow-x:hidden;scrollbar-width:thin}
/* every button row is a grid with a fixed column count: labels never wrap or spill out of a panel */
.gr{display:grid;gap:3px}
.gr .tb{width:100%;min-width:0;padding:0 2px;letter-spacing:.5px;overflow:hidden;text-overflow:ellipsis}
.lb{font-size:8.2px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${C.mute};margin:8px 0 4px;white-space:nowrap}
.srow{display:grid;grid-template-columns:52px minmax(0,1fr);gap:4px;align-items:start;margin-top:3px}
.srow .lb{margin:0;padding-top:4px;font-size:7.8px;letter-spacing:1px}
.stp{display:grid;grid-template-columns:22px minmax(0,1fr) 22px;gap:3px;align-items:center}
.stp span{font-size:9.6px;font-weight:600;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wl{background:#fff;border:1px solid ${C.line};padding:7px 8px;margin-top:8px}
.sys .tb,.vw .tb{height:17px;font-size:8px}
.stg{position:absolute;top:0;font-size:7.6px;font-weight:600;color:${C.mute};transform:translateX(-50%)}
.stg.on{color:${C.red}}
`;

const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
// a row of buttons on a grid of n equal columns
const gr = (n, html) => `<div class="gr" style="grid-template-columns:repeat(${n},minmax(0,1fr))">${html}</div>`;
const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});

// a small front-view glyph of a field type for the type list and the lineup strip (SVG, 1 px = 1/scale mm)
export function glyph(type, w, h, mods = [], sel = -1, capacity = 0) {
  const T = FIELD_TYPES[type];
  const W = Math.max(1, w);
  let s = `<svg width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" style="position:absolute;left:0;top:0">`;
  const L = (x, y, ww, hh, f = 'none', st = C.faint) => (s += `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${f}" stroke="${st}" stroke-width="0.8"/>`);
  if (!T) return s + '</svg>';
  const g = T.glyph || 'blank';
  const top = h * 0.08;
  const bot = h * 0.95;
  if (g === 'acb') {
    const n = Math.max(1, mods.length || 1);
    for (let i = 0; i < n; i++) {
      const y0 = top + ((bot - top) / n) * i;
      const hh = (bot - top) / n;
      L(W * 0.15, y0 + hh * 0.25, W * 0.7, hh * 0.45, '#4a4e55', '#4a4e55');
      L(W * 0.32, y0 + hh * 0.33, W * 0.36, hh * 0.18, '#e3e4e2', '#e3e4e2');
    }
  } else if (g === 'grid') {
    const dev = T.devFrac ?? 0.6;
    L(W * dev, top, W * (1 - dev), bot - top, '#f3f4f5');
    let y = top;
    const H = bot - top;
    const tot = mods.reduce((a, m) => a + m.h, 0) || 1;
    const cap = Math.max(tot, capacity || tot);
    for (const [i, m] of mods.entries()) {
      const hh = (m.h / cap) * H;
      const cols = m.cols || 1;
      for (let c = 0; c < cols; c++) L((W * dev * c) / cols, y, (W * dev) / cols, hh, i === sel ? '#fde8ea' : '#fff', i === sel ? C.red : C.faint);
      y += hh;
    }
  } else if (g === 'inline') {
    const tot = Math.max(capacity, mods.reduce((a, m) => a + m.h, 0)) || 1;
    let x = W * 0.05;
    if (!mods.length) for (let i = 0; i < 6; i++) L(2 + i * ((W - 4) / 6), top + 4, (W - 4) / 6 - 1, (bot - top) * 0.62, '#4a4e55', '#4a4e55');
    for (const [i, m] of mods.entries()) {
      const ww = (m.h / tot) * W * 0.9;
      L(x, top + 4, Math.max(1, ww - 0.6), (bot - top) * 0.62, i === sel ? C.red : '#4a4e55', i === sel ? C.red : '#4a4e55');
      x += ww;
    }
  } else if (g === 'plug') {
    const dev = T.devFrac ?? 0.6;
    L(W * dev, top, W * (1 - dev), bot - top, '#f3f4f5');
    for (let y = top; y < bot - 2; y += 3.2) L(1, y, W * dev - 2, 2.4, '#4a4e55', '#4a4e55');
  } else if (g === 'cap') {
    for (let i = 0; i < 5; i++) L(W * 0.12, top + i * ((bot - top) / 5) + 1, W * 0.76, (bot - top) / 5 - 2, '#fff');
  } else if (g === 'fixed') {
    for (let i = 0; i < 4; i++) L(W * 0.06, top + i * ((bot - top) / 4) + 1, W * 0.6, (bot - top) / 4 - 2, '#fff');
    L(W * 0.7, top, W * 0.26, bot - top, '#f3f4f5');
  } else {
    L(W * 0.1, top, W * 0.8, bot - top, '#fff');
  }
  return s + '</svg>';
}

export function createConsole(app, act) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h, parent = ui) => {
    const n = el(h);
    parent.appendChild(n);
    return n;
  };

  // ------------------------------------------------------------ title and readouts
  add(`<div style="position:absolute;left:35px;top:28px;width:43px;height:3px;background:${C.red}"></div>`);
  add(`<div style="position:absolute;left:35px;top:40px;font-size:24px;font-weight:700;letter-spacing:-.2px">SIVACON S8 <span style="color:${C.red}">·</span> Teardown</div>`);
  add(`<div class="cp" style="position:absolute;left:35px;top:73px;font-weight:500;letter-spacing:1.5px;font-size:9px">${SYSTEM.tagline}</div>`);
  const kpi = add(`<div style="position:absolute;left:35px;top:94px;width:262px"></div>`);

  // ------------------------------------------------------------ field inspector
  const insp = add(`<div class="pn scroll" style="left:35px;top:196px;width:262px;height:566px;padding:10px 11px"></div>`);

  // ------------------------------------------------------------ right column: part card, bill of materials
  const card = add(`<div class="pn" style="left:1303px;top:28px;width:262px;height:172px;padding:10px 11px"></div>`);
  const sysp = add(`<div class="pn sys" style="left:1303px;top:208px;width:262px;height:286px;padding:9px 11px"></div>`);
  const bom = add(`<div class="pn scroll" style="left:1303px;top:502px;width:262px;height:260px;padding:10px 11px"></div>`);

  // ------------------------------------------------------------ bottom: lineup strip, teardown, views, layers
  const strip = add(`<div class="pn" style="left:305px;top:770px;width:990px;height:112px;padding:8px 11px"></div>`);
  const stripHd = add(`<div class="hd"><span class="cp">LINEUP · FRONT VIEW</span><span class="cp mu"></span></div>`, strip);
  const lineup = add(`<div style="position:relative;height:74px"></div>`, strip);
  const tdp = add(`<div class="pn" style="left:35px;top:770px;width:262px;height:112px;padding:8px 11px"></div>`);
  const viewp = add(`<div class="pn vw" style="left:1303px;top:770px;width:262px;height:112px;padding:8px 11px"></div>`);

  // teardown slider
  add(`<div class="hd" style="margin-bottom:3px"><span class="cp">TEARDOWN</span><span class="cp mu" data-k="tdv"></span></div>`, tdp);
  const stgName = add(`<div style="font-size:9.2px;height:13px;color:${C.mute};white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>`, tdp);
  const track = add(`<div style="position:relative;height:24px;margin:2px 6px 0;cursor:ew-resize;pointer-events:auto"></div>`, tdp);
  const stgLbl = [];
  STAGES.forEach((s, i) => {
    add(`<div class="tick" style="left:${(i / STAGES.length) * 100}%"></div>`, track);
    stgLbl.push(add(`<div class="stg" style="left:${((i + 0.5) / STAGES.length) * 100}%" title="${s.label}">${i + 1}</div>`, track));
  });
  add(`<div class="tick" style="left:100%"></div>`, track);
  add(`<div style="position:absolute;left:0;right:0;top:15px;height:3px;background:#e6e7e9"></div>`, track);
  const tdFill = add(`<div style="position:absolute;left:0;top:15px;height:3px;background:${C.red}"></div>`, track);
  const tdKnob = add(`<div style="position:absolute;top:10px;width:13px;height:13px;margin-left:-6.5px;border-radius:50%;background:#fff;border:2px solid ${C.red}"></div>`, track);
  const tdRow = add(gr(4, ''), tdp);
  tdRow.style.marginTop = '4px';
  const tdv = tdp.querySelector('[data-k=tdv]');
  const tdBtns = {
    assemble: add(`<div class="tb" data-a="td:0" title="Put everything back">Assemble</div>`, tdRow),
    step: add(`<div class="tb" data-a="td:step" title="Next teardown stage (E)">Next ▸</div>`, tdRow),
    full: add(`<div class="tb" data-a="td:1" title="All eight stages (X)">Explode</div>`, tdRow),
    scope: add(`<div class="tb" data-a="scope" title="Take apart the selected field or the whole lineup"></div>`, tdRow),
  };

  // views and layers
  add(`<div class="hd" style="margin-bottom:5px"><span class="cp">VIEW</span><span class="cp mu">DRAG · WHEEL · RIGHT-DRAG</span></div>`, viewp);
  const vrow = add(gr(VIEWS.length, ''), viewp);
  const vb = {};
  VIEWS.forEach((v, i) => (vb[v] = add(`<div class="tb" data-a="view:${v}" title="View ${v} (${i + 1})">${v}</div>`, vrow)));
  add(`<div class="cp" style="margin:6px 0 3px;font-weight:700">LAYERS</div>`, viewp);
  const lrow = add(gr(3, ''), viewp);
  const lb = {};
  for (const l of LAYERS) lb[l] = add(`<div class="tb" data-a="layer:${l}">${l}</div>`, lrow);

  const toast = add(`<div class="toast"></div>`);
  const calls = add(`<div style="position:absolute;inset:0;pointer-events:none"></div>`);
  const svg = add(`<svg style="position:absolute;left:0;top:0;pointer-events:none" width="1600" height="900"></svg>`);
  const cur = add(`<svg class="cur" width="22" height="26" viewBox="0 0 22 26"><path d="M2 2 L2 21 L7 16.5 L10.5 24 L13.6 22.6 L10.2 15.4 L17 15.4 Z" fill="#16181b" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`);
  const ring = add(`<div class="ring"></div>`);

  // ------------------------------------------------------------ one delegated handler: data-a="verb:arg"
  ui.addEventListener('click', (e) => {
    const n = e.target.closest('[data-a]');
    if (!n || !ui.contains(n)) return;
    e.stopPropagation();
    const [verb, ...rest] = n.dataset.a.split(':');
    if (verb === 'addkind') {
      addKind = rest[0];
      if (last) refresh(...last);
      return;
    }
    act(verb, rest.join(':'), n);
  });
  // the teardown track drags
  const tdFrom = (e) => {
    const r = track.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  track.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    act('takeover');
    track.setPointerCapture(e.pointerId);
    act('tdset', tdFrom(e));
    const mv = (ev) => act('tdset', tdFrom(ev));
    const up = () => {
      track.removeEventListener('pointermove', mv);
      track.removeEventListener('pointerup', up);
    };
    track.addEventListener('pointermove', mv);
    track.addEventListener('pointerup', up);
  });

  // ------------------------------------------------------------ refresh: rebuild panels from the configuration
  let lastSel = -1;
  let lastType = '';
  let addKind = '';
  let last = null;
  const refresh = (S, R) => {
    last = [S, R];
    const cfg = S.cfg;
    const f = cfg.fields[S.sel];
    // readouts
    kpi.innerHTML = `
      <div style="display:flex;gap:18px;align-items:flex-end">
        <div><div style="font-size:44px;font-weight:800;letter-spacing:-2.4px;color:${C.red};line-height:1">${fmt(R.length)}</div>
        <div class="cp mu" style="font-size:8.6px;margin-top:3px">MM LINEUP LENGTH</div></div>
        <div style="padding-bottom:13px;font-size:11px;line-height:15px"><b>${cfg.fields.length}</b> fields<br><b>${R.units}</b> units</div>
      </div>
      <div style="margin-top:8px;height:1px;background:${C.faint}"></div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:10.5px">
        <span><b>${fmt(cfg.height + cfg.base)}</b> <span class="mu">H</span></span>
        <span><b>${fmt(cfg.depth)}</b> <span class="mu">D</span></span>
        <span><b>${fmt(R.In)} A</b> <span class="mu">MAIN BB</span></span>
        <span><b>≈${fmt(R.weight)}</b> <span class="mu">KG</span></span>
      </div>`;
    // inspector
    if (!f) {
      insp.innerHTML = '';
    } else {
      const T = FIELD_TYPES[f.type];
      const types = Object.entries(FIELD_TYPES)
        .map(
          ([k, t]) =>
            `<div class="ty ${k === f.type ? 'on' : ''}" data-a="type:${k}"><i>${glyph(k, 16, 22, k === f.type ? f.modules : t.demo || [], -1, k === f.type ? R.cap[S.sel] : 0)}</i><div>${t.name}<small>${t.short}</small></div></div>`,
        )
        .join('');
      const widths = gr(Math.min(6, Math.max(3, T.widths.length)), T.widths.map((w) => `<div class="tb ${w === f.width ? 'on' : ''}" data-a="width:${w}">${w}</div>`).join(''));
      let modHtml = '';
      if (T.modular) {
        const cap = R.cap[S.sel];
        const used = f.modules.reduce((a, m) => a + m.h, 0);
        const H = 190;
        const sc = H / cap;
        let y = 0;
        const rows = f.modules
          .map((m, j) => {
            const K = MODULE_KINDS[m.kind];
            const hh = Math.max(11, m.h * sc);
            const s = `<div class="md ${j === S.mod ? 'on' : ''}" data-a="mod:${j}" style="top:${y}px;height:${hh}px">${m.cols > 1 ? `${m.cols}× ` : ''}${K.short} ${m.label ? '· ' + m.label : ''}<em>${m.h}</em></div>`;
            y += hh;
            return s;
          })
          .join('');
        const free = cap - used;
        const freeRow = free > 0 ? `<div class="md free" style="top:${y}px;height:${Math.max(9, free * sc)}px">free ${free} mm<em></em></div>` : '';
        // add a module in two steps: the kind, then one of its heights that still fits
        if (f.type !== lastType || !T.modules?.includes(addKind)) addKind = T.modules?.[0] || '';
        lastType = f.type;
        const AK = MODULE_KINDS[addKind];
        const pal = T.locked
          ? ''
          : gr(Math.min(6, T.modules.length), T.modules.map((k) => `<div class="tb ${k === addKind ? 'on' : ''}" data-a="addkind:${k}" title="${MODULE_KINDS[k].name}">${MODULE_KINDS[k].short}</div>`).join('')) +
            `<div style="height:3px"></div>` +
            (AK && AK.heights.some((h) => h <= free)
              ? gr(5, AK.heights.map((h) => `<div class="tb ${h > free ? 'dis' : ''}" data-a="addmod:${addKind}:${h}" title="Add ${AK.name}, ${h} mm">+ ${h}</div>`).join(''))
              : `<span class="mu" style="font-size:9.4px">No room for a ${AK?.short || ''} module: remove or shrink one</span>`);
        const m = f.modules[S.mod];
        const MK = m && MODULE_KINDS[m.kind];
        const modTools = m && T.locked
          ? `<div class="sep"></div><div class="hd"><span class="cp">MODULE ${S.mod + 1}</span><span class="cp mu">${MK.name}</span></div>
            ${MK.positions ? gr(2, MK.positions.map((p) => `<div class="tb ${p === (m.pos || 'connected') ? 'on' : ''}" data-a="modpos:${p}">${p}</div>`).join('')) : '<span class="mu" style="font-size:9.4px">Fixed part of the breaker field</span>'}`
          : m
          ? `<div class="sep"></div><div class="hd"><span class="cp">MODULE ${S.mod + 1}</span><span class="cp mu">${MK.name}</span></div>
            ${gr(4, `<div class="tb" data-a="modmove:-1">▲ up</div><div class="tb" data-a="modmove:1">▼ down</div><div class="tb" data-a="moddup">duplicate</div><div class="tb acc" data-a="moddel">remove</div>`)}
            <div class="lb">REPLACE WITH</div>
            ${gr(Math.min(6, T.modules.length), T.modules.map((k) => `<div class="tb ${k === m.kind ? 'on' : ''}" data-a="modkind:${k}" title="${MODULE_KINDS[k].name}">${MODULE_KINDS[k].short}</div>`).join(''))}
            ${MK.heights.length > 1 ? `<div class="lb">HEIGHT MM</div>${gr(5, MK.heights.map((h) => `<div class="tb ${h === m.h ? 'on' : ''} ${h - m.h > free ? 'dis' : ''}" data-a="modh:${h}">${h}</div>`).join(''))}` : ''}
            ${MK.cols ? `<div class="lb">WIDTH</div>${gr(MK.cols.length, MK.cols.map((c) => `<div class="tb ${c === (m.cols || 1) ? 'on' : ''}" data-a="modcols:${c}">1/${c} · ${c} units</div>`).join(''))}` : ''}
            ${MK.positions ? `<div class="lb">POSITION</div>${gr(2, MK.positions.map((p) => `<div class="tb ${p === (m.pos || 'connected') ? 'on' : ''}" data-a="modpos:${p}">${p}</div>`).join(''))}` : ''}`
          : '';
        modHtml = `<div class="sep"></div>
          <div class="hd"><span class="cp">${T.compartment || 'DEVICE COMPARTMENT'}</span><span class="cp mu">${used} / ${cap} MM</span></div>
          <div class="mods" style="height:${H + 2}px">${rows}${freeRow}</div>
          <div class="gauge"><b style="width:${Math.min(100, (used / cap) * 100)}%"></b></div>
          ${T.locked ? '' : `<div class="lb" style="color:${C.ink};font-weight:700">ADD MODULE</div>${pal}`}
          ${modTools}`;
      }
      const wl = f.type === 'acb' && isWL(f);
      const opts = (T.options || [])
        .filter((o) => !o.when || o.when(f))
        .map((o) => {
          const vals = typeof o.values === 'function' ? o.values(f) : o.values;
          const row = `<div class="lb">${o.label}</div>${gr(o.cols || Math.max(3, vals.length), vals
            .map((v) => `<div class="tb ${String(f.opts?.[o.key] ?? vals[0]) === String(v) ? 'on' : ''}" data-a="opt:${o.key}:${v}">${o.fmt ? o.fmt(v) : v}</div>`)
            .join(''))}`;
          // the 3WL's own teardown sits right under the breaker choice
          return o.key === 'acb' && wl
            ? row + operateBlock(S, f) + maintRow(S, f)
            : row;
        })
        .join('') + (wl ? wlPanel(S, f) : '');
      insp.innerHTML = `
        <div class="hd"><span class="cp">FIELD ${f.tag}</span><span class="cp mu">${T.short}</span></div>
        ${gr(4, `<div class="tb ${S.sel === 0 ? 'dis' : ''}" data-a="fieldmove:-1">◀ move</div><div class="tb ${S.sel === cfg.fields.length - 1 ? 'dis' : ''}" data-a="fieldmove:1">move ▶</div><div class="tb" data-a="fielddup">duplicate</div><div class="tb acc ${cfg.fields.length < 2 ? 'dis' : ''}" data-a="fielddel">remove</div>`)}
        <div class="lb">REPLACE WITH</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px">${types}</div>
        <div class="lb">FIELD WIDTH MM</div>
        ${widths}
        ${opts}
        ${modHtml}`;
      // a selected module brings its tools into view
      if (S.mod >= 0) insp.scrollTop = insp.scrollHeight;
      else if (S.sel !== lastSel) insp.scrollTop = 0;
      lastSel = S.sel;
    }
    // system panel
    const sys = SYSTEM.options
      .map(
        (o) =>
          `<div class="srow"><span class="lb">${o.label}</span>${gr(o.cols || 4, (typeof o.values === 'function' ? o.values(cfg) : o.values)
            .map((v) => `<div class="tb ${String(cfg[o.key]) === String(v) ? 'on' : ''}" data-a="sys:${o.key}:${v}">${o.fmt ? o.fmt(v) : v}</div>`)
            .join(''))}</div>`,
      )
      .join('');
    sysp.innerHTML = `<div class="hd"><span class="cp">SYSTEM</span><span class="cp mu">ALL FIELDS</span></div>${sys}
      <div class="sep" style="margin:6px 0 3px"></div>
      <div class="srow"><span class="lb">PRESET</span>${gr(3, `<div class="tb" data-a="preset:standard">standard</div><div class="tb" data-a="preset:mcc">MCC</div><div class="tb" data-a="preset:small">small</div>`)}</div>
      <div class="srow"><span class="lb">SHARE</span>${gr(2, `<div class="tb" data-a="export">export JSON</div><div class="tb" data-a="link">copy link</div>`)}</div>`;
    // bill of materials
    bom.innerHTML = `<div class="hd"><span class="cp">BILL OF MATERIALS</span><span class="cp mu">${fmt(R.parts)} PARTS</span></div>
      ${R.bom.map(([k, v, sub]) => (k === '—' ? '<div class="sep"></div>' : `<div class="kv"><span>${k}${sub ? ` <span class="mu" style="font-size:9px">${sub}</span>` : ''}</span><b>${v}</b></div>`)).join('')}`;
    // lineup strip
    const totalW = R.length;
    const avail = 966;
    const sc = Math.min(0.17, (avail - 70) / totalW);
    const hh = 52;
    let x = 30;
    let lu = `<div class="tb" data-a="fieldadd:-1" style="position:absolute;left:0;top:18px;width:24px;height:24px;font-size:14px" title="Add field on the left">+</div>`;
    cfg.fields.forEach((fd, i) => {
      const w = fd.width * sc;
      lu += `<div class="lu ${i === S.sel ? 'on' : ''}" data-a="field:${i}" style="left:${x}px;width:${w}px;top:0">
        <div class="bx" style="height:${hh}px">${glyph(fd.type, w - 2, hh - 2, fd.modules, i === S.sel ? S.mod : -1, R.cap[i])}</div>
        <div class="nm">${fd.tag}</div><div class="ws">${w > 34 ? fd.width : ''}</div></div>`;
      x += w + 2;
    });
    lu += `<div class="tb" data-a="fieldadd:1" style="position:absolute;left:${x + 4}px;top:18px;width:24px;height:24px;font-size:14px" title="Add field on the right">+</div>`;
    lineup.innerHTML = lu;
    stripHd.lastElementChild.textContent = `${R.transport} TRANSPORT UNIT${R.transport === 1 ? '' : 'S'} · ${R.warnings[0] || 'CONFIGURATION VALID'}`;
    stripHd.lastElementChild.style.color = R.warnings.length ? C.red : '';
    for (const v of VIEWS) vb[v].classList.toggle('on', S.view === v);
    for (const l of LAYERS) {
      const on = S.layers[l];
      lb[l].classList.toggle('on', l === 'enclosure' ? on !== 'off' : !!on);
      lb[l].textContent = l === 'enclosure' ? `encl. ${on}` : l;
    }
    tdBtns.scope.textContent = S.scope === 'all' ? 'lineup' : 'one field';
    tdBtns.scope.classList.toggle('on', S.scope === 'all');
  };

  // ------------------------------------------------------------ operate the 3WL (wl_sim.js): the procedures of OI 6
  const operateBlock = (S, f) => {
    const fixed = f.opts.wlMount === 'fixed';
    return `<div class="wl">
      <div class="hd" style="margin-bottom:4px"><span class="cp">OPERATE</span><span class="cp mu">OR CLICK THE PARTS IN 3D</span></div>
      <div data-k="wllive" style="font-size:9.2px;line-height:13px;min-height:52px"></div>
      ${gr(4, `<div class="tb" data-a="wlproc:close" title="Mechanical ON">I · on</div><div class="tb" data-a="wlproc:open" title="Mechanical OFF">O · off</div><div class="tb" data-a="wlproc:charge" title="9 strokes of the lever">charge</div><div class="tb" data-a="wlproc:reset" title="RESET pin">reset</div>`)}
      ${fixed ? '' : `<div class="lb" style="margin-top:6px">RACK TO · WITH THE HANDLE AND THE CRANK</div>${gr(4, [['connected', 'connect'], ['test', 'test'], ['disconnected', 'discon'], ['removed', 'maint.']].map(([p, t]) => `<div class="tb" data-a="wlproc:to:${p}">${t}</div>`).join(''))}`}
      <div style="height:4px"></div>
      ${gr(2, `<div class="tb ${S.solo ? 'on' : ''}" data-a="wlsolo">${['solo · off', 'solo · frame', 'solo · breaker'][S.solo]}</div><div class="tb ${S.etuOpen ? 'on' : ''}" data-a="wletu">${S.etuOpen ? 'close' : 'open'} trip unit</div>`)}
    </div>`;
  };

  // ------------------------------------------------------------ the 3WL maintenance teardown, OI chapter 23
  const maintRow = (S, f) => {
    const n = Math.round((S.wlx || 0) * NMAINT);
    const cur = n === 0 ? {label: 'In service', sub: `${orderNo(f.opts)} · step through the maintenance sequence of OI chapter 23`} : WL_MAINT[n - 1];
    return `<div class="lb">3WL MAINTENANCE · STEP ${n} / ${NMAINT}</div>
      ${gr(4, `<div class="tb ${n === 0 ? 'dis' : ''}" data-a="wlstep:-1">◀ back</div><div class="tb ${n === NMAINT ? 'dis' : ''}" data-a="wlstep:1">next ▶</div><div class="tb ${n === NMAINT ? 'on' : ''}" data-a="wlstep:all">all</div><div class="tb ${n === 0 ? 'on' : ''}" data-a="wlstep:0">refit</div>`)}
      <div style="margin-top:4px;font-size:10px;font-weight:700">${cur.label}</div>
      <div class="mu" style="font-size:8.8px;line-height:12px;margin-top:1px">${cur.sub}</div>`;
  };

  // ------------------------------------------------------------ the 3WL panel: trip unit settings, curve, COM35 data
  const wlPanel = (S, f) => {
    const o = f.opts;
    const P = activeSettings(o);
    const In = o.wlIn;
    const amps = (k, x) => (x === null || x === undefined ? 'OFF' : `${Math.round(x * In)} A`);
    const val = {
      wlIr: `${o.wlIr} × In · ${amps('', P.Ir)}`,
      wltR: `${o.wltR} s`,
      wlIsd: `${o.wlIsd} × In · ${amps('', P.Isd)}`,
      wltsd: o.wltsd === 'OFF' ? 'OFF' : `${o.wltsd} s${o.wltsd === 0.02 ? ' · motor' : ''}`,
      wlIi: o.wlIi === 'OFF' ? 'OFF' : o.wlIi === 'MAX' ? `MAX · ${amps('', P.Ii)}` : `${o.wlIi} × In · ${amps('', P.Ii)}`,
      wlIN: o.wlIN === 'OFF' ? 'OFF' : `${o.wlIN} × In`,
      wlIg: `${o.wlIg} · ${P.Ig} A`,
      wltg: `${o.wltg} s`,
    };
    const steps = settingsFor(o)
      .map((s) => `<div class="srow"><span class="lb">${s.label} · DP ${s.dp}</span><div class="stp"><div class="tb" data-a="optstep:${s.key}:-1">−</div><span>${val[s.key]}</span><div class="tb" data-a="optstep:${s.key}:1">+</div></div></div>`)
      .join('');
    // the time-current curve, log-log: I / In from 0.5 to 50, t from 0.01 to 10 000 s
    const Wd = 238;
    const Hd = 120;
    const X = (k) => ((Math.log10(k) - Math.log10(0.5)) / (Math.log10(50) - Math.log10(0.5))) * Wd;
    const Y = (t) => Hd - ((Math.log10(t) + 2) / 6) * Hd;
    let d = '';
    for (let i = 0; i <= 160; i++) {
      const k = 0.5 * 100 ** (i / 160);
      const t = tripTime(o, k * In);
      if (!isFinite(t)) continue;
      d += `${d ? 'L' : 'M'}${X(k).toFixed(1)} ${Math.max(0, Math.min(Hd, Y(Math.min(1e4, t)))).toFixed(1)} `;
    }
    let grid = '';
    for (const k of [1, 10]) grid += `<line x1="${X(k)}" x2="${X(k)}" y1="0" y2="${Hd}" stroke="${C.line}"/><text x="${X(k) + 2}" y="${Hd - 3}" font-size="7" fill="${C.mute}">${k}× In</text>`;
    for (const t of [0.1, 1, 10, 100, 1000]) grid += `<line x1="0" x2="${Wd}" y1="${Y(t)}" y2="${Y(t)}" stroke="${C.line}"/><text x="2" y="${Y(t) - 2}" font-size="7" fill="${C.mute}">${t} s</text>`;
    const C35 = o.wlCom === 'COM35';
    return `<div class="wl">
      <div class="hd" style="margin-bottom:4px"><span class="cp">${o.wlEtu.replace('D', '')} TRIP UNIT · SET ${P.set}</span><span class="cp mu">${P.Ig ? 'LSIG' : P.IN !== null ? 'LSIN' : P.Isd !== null ? 'LSI' : 'LI'}</span></div>
      ${steps}
      <svg width="${Wd}" height="${Hd}" style="display:block;margin-top:6px;background:#fafafa;border:1px solid ${C.line}">${grid}<path d="${d}" fill="none" stroke="${C.red}" stroke-width="1.6"/></svg>
      <div class="mu" style="font-size:8.4px;margin-top:3px;line-height:11px">Switch positions from the 3WL1 manual (8-22…8-29), data points from the COM35 guide (Tab. 4-10). Curve: L as I²t through tR at 6 IR, S definite time.</div>
    </div>
    <div class="wl">
      ${C35 ? '<div data-k="com35"></div>' : '<div class="hd" style="margin-bottom:4px"><span class="cp">COM35 · PROFINET / MODBUS</span><span class="cp mu">NOT FITTED</span></div><div class="mu" style="font-size:9.4px">No COM35 at X7: the breaker has no PROFINET / Modbus TCP connection. X7 is a plain terminal block.</div>'}
    </div>`;
  };

  // ------------------------------------------------------------ live 3WL readouts and the trip unit replica
  const etuP = add(`<div class="pn" style="left:306px;top:84px;width:250px;height:678px;padding:8px 10px;display:none;z-index:4"></div>`);
  etuP.innerHTML = `<div class="hd"><span class="cp">TRIP UNIT</span><span class="cp mu" data-k="etun"></span></div>
    <canvas width="${ETU_W * 2}" height="${ETU_H * 2}" style="width:228px;height:570px;display:block;cursor:pointer;margin:0 auto"></canvas>
    <div class="srow" style="margin-top:6px"><span class="lb">LOAD</span><div class="stp"><div class="tb" data-a="wlload:-0.1">−</div><span data-k="etuload"></span><div class="tb" data-a="wlload:0.1">+</div></div></div>
    <div class="srow"><span class="lb">FAULT</span><div data-k="etuf"></div></div>
    <div data-k="etus" class="mu" style="font-size:8.6px;line-height:11px;margin-top:3px"></div>`;
  const etuC = etuP.querySelector('canvas');
  let etuHits = [];
  let etuFKey = '';
  const etuXY = (e) => {
    const r = etuC.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * ETU_W, ((e.clientY - r.top) / r.height) * ETU_H];
  };
  etuC.addEventListener('contextmenu', (e) => e.preventDefault());
  etuC.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const h = hitAt(etuHits, ...etuXY(e));
    if (h) act('etuhit', `${h.id}:${e.button === 2 || e.shiftKey ? -1 : 1}`);
  });
  let wlT = 0;
  const wlFrame = (S, ws) => {
    const now = performance.now();
    etuP.style.display = S.etuOpen && ws ? '' : 'none';
    if (!ws) return;
    if (S.etuOpen) {
      const g = etuC.getContext('2d');
      g.setTransform(2, 0, 0, 2, 0, 0);
      etuHits = drawETU(g, ws, now);
      const o = ws.o;
      etuP.querySelector('[data-k=etun]').textContent = `${WL_ETU[o.wlEtu].name} · ${o.wlIn} A`;
      const fk = o.wlEtu + o.wlGf + o.wlIn;
      if (fk !== etuFKey) {
        etuFKey = fk;
        const fl = faults(o);
        etuP.querySelector('[data-k=etuf]').innerHTML = gr(fl.length, fl.map((x) => `<div class="tb" data-a="wlfault:${x.kind}" title="${x.label} · ${Math.round(x.I)} A">${x.kind} ${x.kind === 'L' ? '1.5 IR' : x.kind === 'G' ? '1.5 Ig' : x.kind === 'S' ? '1.2 Isd' : '1.2 Ii'}</div>`).join(''));
      }
    }
    if (now - wlT < 150) return;
    wlT = now;
    const c = currents(ws);
    const p = ws.rack >= RACK.removed - 1 ? 'maintenance' : posAt(ws.rack);
    const live = insp.querySelector('[data-k=wllive]');
    if (live) {
      const st = [
        `<b>${ws.closed ? 'CLOSED' : 'OPEN'}</b>${ws.tripped ? ' · <b style="color:#d6182b">TRIPPED ' + (ws.cause || '') + '</b>' : ''} · spring <b>${ws.charged ? 'charged' : 'discharged'}</b> · READY <b>${!ws.closed && ws.charged && !ws.tripped ? 'OK' : '—'}</b>`,
        `Position <b>${p.toUpperCase()}</b> · crank ${ws.turns.toFixed(1)} turns · travel ${Math.round(ws.rack)} mm`,
        `<span style="color:${ws.proc ? '#16181b' : '#8b8f95'};font-weight:${ws.proc ? 700 : 500}">${ws.caption || 'Choose an operation, or click a button, the lever, the racking handle or RESET on the model'}</span>`,
      ];
      live.innerHTML = st.map((l) => `<div>${l}</div>`).join('');
    }
    const com = insp.querySelector('[data-k=com35]');
    if (com) {
      const pp = p === 'maintenance' ? 'removed' : p === 'between' ? 'removed' : p;
      const C35 = com35Data(ws.o, pp);
      const ledc = (s) => (s === 'green' ? '#2fbf55' : s === 'flash' ? (Math.floor(now / 400) % 2 ? '#2fbf55' : '#c9ccd0') : '#c9ccd0');
      com.innerHTML = `<div class="hd" style="margin-bottom:4px"><span class="cp">COM35 · PROFINET / MODBUS</span><span class="cp mu">${C35.live ? 'BREAKER DATA LIVE' : 'NO BREAKER DATA'}</span></div>
        <div style="display:flex;gap:10px;margin:2px 0 5px">${['PN', 'TCP', 'CUB'].map((k) => `<span style="font-size:8.6px;font-weight:700;display:flex;align-items:center;gap:4px"><i style="width:8px;height:8px;border-radius:50%;background:${ledc(C35.leds[k])};display:block"></i>${k}</span>`).join('')}</div>
        ${C35.rows.map(([k, v]) => `<div class="kv" style="font-size:9.4px;line-height:14px"><span class="mu">${k}</span><b>${v}</b></div>`).join('')}`;
    }
    if (S.etuOpen) {
      etuP.querySelector('[data-k=etuload]').textContent = `${Math.round(ws.load * 100)} % In · ${Math.round(Math.max(...c.I))} A`;
      const f = ws.fault;
      etuP.querySelector('[data-k=etus]').innerHTML = f
        ? `<b style="color:#d6182b">${f.label}: ${Math.round(f.I)} A</b> · trips in ${Math.max(0, f.tTrip - f.t).toFixed(f.tTrip > 5 ? 0 : 2)} s${f.kind === 'L' ? ` (shown ${TIME_X}× faster)` : ''}`
        : c.live
        ? 'Keys, rotary and slide switches, TEST · QUERY · CLEAR and RESET work. Right-click a switch to turn it back. Inject a fault to trip the breaker.'
        : 'Close the breaker in CONNECT to load it. The trip unit is powered from its CTs above Imin, or with 24 V via the COM35.';
    }
  };

  // ------------------------------------------------------------ the hovered/pinned part card
  let cardKey = null;
  const setCard = (info) => {
    const key = info ? info.title + info.lines.join() + (info.pinned ? 'p' : '') : '';
    if (key === cardKey) return;
    cardKey = key;
    if (!info) {
      card.innerHTML = `<div class="hd"><span class="cp">PART</span><span class="cp mu">HOVER OR CLICK</span></div>
        <div style="font-size:10.5px;color:${C.mute};line-height:15px">Point at any part: a door hinge, a busbar joint bolt, a contact finger. Click to pin it and select its field; double-click a module to cycle its position.</div>`;
      return;
    }
    card.innerHTML = `<div class="hd"><span class="cp">${info.pinned ? 'PINNED PART' : 'PART'}</span><span class="cp mu">${info.where || ''}</span></div>
      <div style="font-size:14px;font-weight:700;letter-spacing:-.1px;line-height:17px">${info.title}</div>
      <div style="margin-top:6px">${info.lines.map((l) => `<div style="font-size:10.2px;line-height:15px">${l}</div>`).join('')}</div>`;
  };

  // ------------------------------------------------------------ frame: the live parts
  const frame = (S, live) => {
    const k = S.x;
    tdFill.style.width = `${k * 100}%`;
    tdKnob.style.left = `${k * 100}%`;
    const st = Math.min(STAGES.length - 1, Math.floor(k * STAGES.length - 1e-6));
    stgLbl.forEach((n, i) => n.classList.toggle('on', k > 0.001 && i === st));
    const tdText = k < 0.001 ? 'ASSEMBLED' : `STAGE ${st + 1} / ${STAGES.length} · ${Math.round(k * 100)}%`;
    const nameText = k < 0.001 ? 'Drag the track or step through 8 stages' : `${STAGES[st].label} — ${STAGES[st].sub}`;
    if (tdv.textContent !== tdText) tdv.textContent = tdText;
    if (stgName.textContent !== nameText) {
      stgName.textContent = nameText;
      stgName.title = nameText;
    }
    setCard(live.card);
    wlFrame(S, live.wl);
    // callouts with leaders
    let html = '';
    let lines = '';
    for (const c of live.callouts || []) {
      const [ax, ay] = c.anchor;
      const [lx, ly] = c.at;
      const a = c.alpha ?? 1;
      if (a <= 0.01 || !c.at || !(ax === ax)) continue;
      const left = lx < ax;
      html += `<div class="call${c.proc ? ' proc' : ''}" style="left:${left ? lx - 4 : lx + 4}px;top:${ly - 10}px;opacity:${a};transform:translateX(${left ? '-100%' : '0'});text-align:${left ? 'right' : 'left'}"><b>${c.title}</b><span>${c.sub || ''}</span></div>`;
      lines += `<path d="M${ax} ${ay} L${lx} ${ly}" stroke="${C.ink}" stroke-width="0.8" fill="none" opacity="${a * 0.8}"/><circle cx="${ax}" cy="${ay}" r="2.4" fill="${C.red}" opacity="${a}"/>`;
    }
    calls.innerHTML = html;
    svg.innerHTML = lines + (live.svg || '');
    const cu = live.cursor;
    cur.style.transform = `translate(${cu.x - 2}px, ${cu.y - 2}px) scale(${cu.press ? 0.86 : 1})`;
    cur.style.display = cu.x < 0 ? 'none' : '';
    ring.style.left = `${cu.ringX}px`;
    ring.style.top = `${cu.ringY}px`;
    ring.style.opacity = cu.ring;
    ring.style.transform = `scale(${1.6 - cu.ring * 0.6})`;
  };
  let toastT = 0;
  const say = (msg) => {
    toast.textContent = msg;
    toast.style.opacity = 1;
    clearTimeout(toastT);
    toastT = setTimeout(() => (toast.style.opacity = 0), 2200);
  };
  // the centre of a control in stage px, for the tour's cursor
  const spot = (sel) => {
    const n = ui.querySelector(sel);
    if (!n) return null;
    const r = n.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    const s = a.width / 1600;
    return [(r.left + r.width / 2 - a.left) / s, (r.top + r.height / 2 - a.top) / s];
  };
  const trackSpot = (k) => {
    const r = track.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    const s = a.width / 1600;
    return [(r.left + r.width * k - a.left) / s, (r.top + 16 - a.top) / s];
  };
  // a click zone on the trip unit replica, in stage px (the tour's cursor aims at it)
  const etuSpot = (id) => {
    const h = etuHits.find((x) => x.id === id);
    if (!h) return null;
    const r = etuC.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    const s = a.width / 1600;
    return [(r.left + ((h.x + h.w / 2) / ETU_W) * r.width - a.left) / s, (r.top + ((h.y + h.h / 2) / ETU_H) * r.height - a.top) / s];
  };
  return {root: ui, refresh, frame, say, spot, trackSpot, etuSpot};
}
