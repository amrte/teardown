// The FX-1 console, a fixed 1600 x 900 layout over the 3D view: the title and the key readouts across the top, the
// G-code listing and the controls on the left, the firmware stack on the right (one row per software layer, one open
// at a time, read top to bottom from the screen down to the metal), the stepper ISR's logic analyzer and the
// transport along the bottom, callouts with thin leaders into the printer. update(s) redraws every live part.
import {FAULT_LABEL, FAULTS, P, TMC} from './model.js';
import {LCD} from './screen.js';
import {LAYER_NAME, LAYERS_UI} from './state.js';

export const C = {ink: '#16181b', mute: '#8b8f95', faint: '#c9ccd0', line: '#e1e3e6', panel: 'rgba(248,248,249,.95)', red: '#d6182b', blue: '#3d8fe0', pale: '#fbe9eb', grey: '#5d6670'};
export const VIEWS = ['hero', 'front', 'head', 'motor', 'hotend', 'board', 'screen'];
export const VIEW_LABEL = {hero: 'HERO', front: 'FRONT', head: 'TOOLHEAD', motor: 'X MOTOR', hotend: 'HOTEND', board: 'BOARD', screen: 'SCREEN'};
export const CUTS = ['motor', 'hotend', 'xray'];
export const CUT_LABEL = {c_motor: 'MOTOR CUT', c_hotend: 'HOTEND SECTION', c_xray: 'BOARD X-RAY'};
const FAULT_SHORT = {none: 'NOMINAL', unplug: 'UNPLUG THERM', loose: 'LOOSE THERM', skip: 'SKIP STEPS', accel: 'ACCEL ×4'};
const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,monospace}
.pn{position:absolute;background:${C.panel};border:1px solid ${C.line};box-shadow:0 1px 2px rgba(20,22,26,.04)}
.cp{font-size:9.4px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap}
.mu{color:${C.mute}}
.tb{position:absolute;height:19px;padding:0 6px;display:flex;align-items:center;justify-content:center;font-size:8.6px;font-weight:600;letter-spacing:.9px;text-transform:uppercase;border:1px solid ${C.line};background:#fff;color:${C.ink};white-space:nowrap;box-sizing:border-box}
.call{position:absolute;white-space:nowrap}
.call b{display:block;font-size:11.5px;font-weight:600;letter-spacing:.1px}
.call span{display:block;font-size:8.4px;font-weight:500;letter-spacing:1.4px;color:${C.mute};text-transform:uppercase;margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.red};opacity:0;z-index:49}
.lr{position:absolute;left:0;right:0;height:14px;font:500 9.3px/14px 'JetBrains Mono',monospace;white-space:pre;overflow:hidden}
.row{position:absolute;left:0;width:282px;height:26px;border-top:1px solid ${C.line};box-sizing:border-box}
.row .n{position:absolute;left:11px;top:8px;font:500 8.6px 'JetBrains Mono',monospace;color:${C.mute}}
.row .nm{position:absolute;left:32px;top:7.5px;font-size:9.4px;font-weight:700;letter-spacing:1.3px;white-space:nowrap}
.row .v{position:absolute;right:22px;top:8px;font:500 8.8px 'JetBrains Mono',monospace;color:${C.grey};white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis}
.row .dot{position:absolute;right:9px;top:10px;width:5px;height:5px;border-radius:50%;background:${C.faint}}
.body{position:absolute;left:10px;width:262px;overflow:hidden}
.kv{display:flex;justify-content:space-between;font:500 9px/15px 'JetBrains Mono',monospace;color:${C.grey}}
.kv b{color:${C.ink};font-weight:600}
.sec{font-size:8.4px;font-weight:700;letter-spacing:1.4px;color:${C.mute};margin:7px 0 3px}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fx = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—');
const pad = (s, n) => String(s).padStart(n, ' ');
const clock = (t) => {
  const s = Math.max(0, t);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(2).padStart(5, '0')}`;
};
export const playText = (r) => (r >= 0.995 ? `${r < 9.95 ? r.toFixed(r < 1.95 ? 1 : 0) : Math.round(r)}× SPEED` : `1/${Math.round(1 / r)}× SPEED`);

export function createConsole(app) {
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
  const btn = {};

  // ------------------------------------------------------------ title and readouts, over a pale scrim so close views never fight them
  add(`<div style="position:absolute;left:0;top:0;width:1600px;height:150px;background:linear-gradient(180deg,rgba(243,243,244,.97) 0,rgba(243,243,244,.9) 96px,rgba(243,243,244,0) 150px)"></div>`);
  add(`<div style="position:absolute;left:35px;top:33px;width:43px;height:3px;background:${C.red}"></div>`);
  add(`<div style="position:absolute;left:35px;top:45px;font-size:24px;font-weight:700;letter-spacing:-.2px">Filament FX-1 <span style="color:${C.red}">·</span> <span style="font-weight:500">Hardware + Firmware</span></div>`);
  add(`<div class="cp" style="position:absolute;left:35px;top:80px;font-weight:500;letter-spacing:1.7px;font-size:9.2px">CARTESIAN FDM &nbsp;•&nbsp; 32-BIT FIRMWARE MODEL &nbsp;•&nbsp; 220 × 220 × 250 MM</div>`);
  const RO = [['STATE', 520, 132], ['HOTEND', 660, 118], ['NOZZLE', 786, 196], ['LINE', 990, 70], ['MACHINE TIME', 1068, 190]];
  const ro = {};
  for (const [k, x, w] of RO) {
    add(`<div class="cp mu" style="position:absolute;left:${x}px;top:36px;font-size:8.4px">${k}</div>`);
    ro[k] = add(`<div class="mo" style="position:absolute;left:${x}px;top:50px;width:${w}px;font-size:15px;font-weight:600;white-space:nowrap"></div>`);
    add(`<div style="position:absolute;left:${x}px;top:74px;width:${w - 12}px;height:1px;background:${C.faint}"></div>`);
  }
  const sub = (x, w, col = C.mute, wt = 500) => add(`<div class="cp" style="position:absolute;left:${x}px;top:80px;width:${w - 14}px;overflow:hidden;text-overflow:ellipsis;font-size:8.2px;font-weight:${wt};color:${col}"></div>`);
  const roSub = {STATE: sub(520, 140), HOTEND: sub(660, 118), NOZZLE: sub(786, 196), 'MACHINE TIME': sub(1068, 190, C.red, 700)};
  const faultChip = add(`<div class="cp" style="position:absolute;left:1290px;top:44px;height:22px;padding:0 10px;display:none;align-items:center;background:${C.red};color:#fff;font-size:9px;letter-spacing:1.4px"></div>`);
  const followBar = add(`<div class="mo" style="position:absolute;left:330px;top:104px;width:940px;height:22px;display:none;align-items:center;gap:0;font-size:9px;font-weight:600;letter-spacing:.8px"></div>`);

  // ------------------------------------------------------------ 01 program listing
  add(`<div class="pn" style="left:35px;top:120px;width:268px;height:362px"></div>`);
  add(`<div class="cp" style="position:absolute;left:46px;top:132px;font-weight:700">PROGRAM</div>`);
  const lsHead = add(`<div class="cp mu" style="position:absolute;right:${1600 - 292}px;top:132px;font-weight:500"></div>`);
  const ROWS = 21;
  const lsBox = add(`<div style="position:absolute;left:36px;top:150px;width:266px;height:${ROWS * 14}px;overflow:hidden"></div>`);
  const lsRows = [];
  for (let i = 0; i < ROWS; i++) lsRows.push(add(`<div class="lr" style="top:${i * 14}px"></div>`, lsBox));
  add(`<div style="position:absolute;left:46px;top:449px;width:246px;height:1px;background:${C.line}"></div>`);
  add(`<div class="cp mu" style="position:absolute;left:46px;top:457px;font-size:8.2px;font-weight:500"><span style="display:inline-block;width:8px;height:8px;background:${C.red};vertical-align:-1px"></span> EXEC &nbsp; <span style="color:${C.blue};font-weight:700">›</span> PARSED</div>`);
  const lsAhead = add(`<div class="cp" style="position:absolute;right:${1600 - 292}px;top:457px;font-size:8.2px;font-weight:600;color:${C.blue}"></div>`);

  // ------------------------------------------------------------ 02 controls: views, cutaways, faults
  add(`<div class="pn" style="left:35px;top:494px;width:268px;height:248px"></div>`);
  const row = (label, keys, labels, y, x0 = 46, wmax = 246) => {
    add(`<div class="cp mu" style="position:absolute;left:${x0}px;top:${y}px;font-size:8.4px">${label}</div>`);
    let x = x0;
    let yy = y + 15;
    for (const k of keys) {
      const w = Math.round(labels[k].length * 6.3 + 14);
      if (x + w > x0 + wmax) {
        x = x0;
        yy += 24;
      }
      btn[k] = add(`<div class="tb" style="left:${x}px;top:${yy}px;width:${w}px">${labels[k]}</div>`);
      x += w + 5;
    }
    return yy + 24;
  };
  let yc = row('VIEWS', VIEWS, VIEW_LABEL, 505);
  yc = row('CUTAWAY', CUTS.map((c) => 'c_' + c), CUT_LABEL, yc + 4);
  const FK = FAULTS.map((f) => 'f_' + f);
  row('FAULT', FK, Object.fromEntries(FAULTS.map((f) => ['f_' + f, FAULT_SHORT[f]])), yc + 4);

  // ------------------------------------------------------------ 03 transport
  add(`<div class="pn" style="left:35px;top:754px;width:268px;height:120px"></div>`);
  btn.play = add(`<div class="tb" style="left:46px;top:766px;width:58px;height:24px;background:${C.red};color:#fff;border-color:${C.red}"></div>`);
  btn.slow = add(`<div class="tb" style="left:110px;top:766px;width:30px;height:24px">−</div>`);
  btn.fast = add(`<div class="tb" style="left:144px;top:766px;width:30px;height:24px">+</div>`);
  const spText = add(`<div class="mo" style="position:absolute;left:182px;top:771px;font-size:10px;font-weight:700;color:${C.red}"></div>`);
  const TL = {x: 46, w: 246, y: 818};
  add(`<div style="position:absolute;left:${TL.x}px;top:${TL.y}px;width:${TL.w}px;height:3px;background:#e6e7e9"></div>`);
  const tlFill = add(`<div style="position:absolute;left:${TL.x}px;top:${TL.y}px;height:3px;background:${C.red}"></div>`);
  const tlKnob = add(`<div style="position:absolute;top:${TL.y - 5}px;width:13px;height:13px;margin-left:-6.5px;border-radius:50%;background:#fff;border:2px solid ${C.red};box-sizing:border-box"></div>`);
  const tlMarks = add(`<div style="position:absolute;left:0;top:0"></div>`);
  const tlTime = add(`<div class="mo" style="position:absolute;left:46px;top:852px;font-size:9px;color:${C.mute};letter-spacing:.5px"></div>`);

  // ------------------------------------------------------------ 04 logic analyzer
  const AN = {x: 316, y: 754, w: 960, h: 120, lx: 392, tw: 828};
  add(`<div class="pn" style="left:${AN.x}px;top:${AN.y}px;width:${AN.w}px;height:${AN.h}px"></div>`);
  add(`<div class="cp" style="position:absolute;left:${AN.x + 11}px;top:${AN.y + 10}px;font-weight:700">STEPPER ISR <span class="mu" style="font-weight:500">· LOGIC ANALYZER · STEP AND DIR PINS</span></div>`);
  const anLens = add(`<div class="cp" style="position:absolute;right:${1600 - AN.x - AN.w + 78}px;top:${AN.y + 10}px;font-size:8.6px"></div>`);
  btn.zout = add(`<div class="tb" style="left:${AN.x + AN.w - 68}px;top:${AN.y + 6}px;width:27px">−</div>`);
  btn.zin = add(`<div class="tb" style="left:${AN.x + AN.w - 37}px;top:${AN.y + 6}px;width:27px">+</div>`);
  const anSvg = add(`<svg style="position:absolute;left:${AN.x}px;top:${AN.y + 28}px" width="${AN.w}" height="${AN.h - 30}"></svg>`);

  // ------------------------------------------------------------ 05 the firmware stack
  const ST = {x: 1290, y: 120, w: 282, h: 622, head: 34, row: 26};
  add(`<div class="pn" style="left:${ST.x}px;top:${ST.y}px;width:${ST.w}px;height:${ST.h}px"></div>`);
  add(`<div class="cp" style="position:absolute;left:${ST.x + 11}px;top:${ST.y + 12}px;font-weight:700">FIRMWARE STACK</div>`);
  add(`<div class="cp mu" style="position:absolute;right:${1600 - ST.x - ST.w + 11}px;top:${ST.y + 12}px;font-weight:500">SCREEN → METAL</div>`);
  const stack = add(`<div style="position:absolute;left:${ST.x}px;top:${ST.y + ST.head}px;width:${ST.w}px;height:${ST.h - ST.head}px;overflow:hidden"></div>`);
  const OPEN_H = ST.h - ST.head - LAYERS_UI.length * ST.row;
  const rows = {};
  LAYERS_UI.forEach((k, i) => {
    const r = add(`<div class="row"><div class="n">0${i + 1}</div><div class="nm">${LAYER_NAME[k]}</div><div class="v"></div><div class="dot"></div></div>`, stack);
    const body = add(`<div class="body" style="top:${ST.row}px;height:${OPEN_H - 6}px"></div>`, r);
    rows[k] = {r, v: r.querySelector('.v'), dot: r.querySelector('.dot'), nm: r.querySelector('.nm'), body, open: 0};
    btn['L_' + k] = r;
  });
  // the open layers' bodies, built once
  const B = {};
  {
    const b = rows.ui.body;
    B.lcd = add(`<canvas width="128" height="64" style="display:block;width:256px;height:128px;image-rendering:pixelated;border:3px solid #1a1c1f;background:${LCD.bg}"></canvas>`, b);
    B.uiInfo = add(`<div style="margin-top:8px"></div>`, b);
  }
  B.host = add(`<div></div>`, rows.host.body);
  B.parser = add(`<div></div>`, rows.parser.body);
  B.planner = add(`<div></div>`, rows.planner.body);
  B.stepper = add(`<div></div>`, rows.stepper.body);
  B.driver = add(`<div></div>`, rows.driver.body);
  B.thermal = add(`<div></div>`, rows.thermal.body);
  B.mech = add(`<div></div>`, rows.mech.body);

  // ------------------------------------------------------------ footer
  add(`<div class="cp mu" style="position:absolute;left:316px;top:882px;font-size:8.2px;font-weight:500;letter-spacing:1.6px">A MODEL OF OPEN-SOURCE PRINTER FIRMWARE BUILT FROM ITS SOURCE AND DATASHEETS · NOT THE FIRMWARE IMAGE</div>`);
  add(`<div class="cp mu" style="position:absolute;right:28px;top:882px;font-size:8.2px;font-weight:500;letter-spacing:1.6px">ONE PROGRAM · ONE CLOCK</div>`);

  // ------------------------------------------------------------ callouts, leaders, the pointer
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centre = (n) => {
    const r = n.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    const k = a.width / 1600 || 1;
    return [(r.left - a.left + r.width / 2) / k, (r.top - a.top + r.height / 2) / k];
  };
  const spots = () => Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };

  // ------------------------------------------------------------ chart helpers
  const svg = (w, h, inner) => `<svg width="${w}" height="${h}" style="display:block">${inner}</svg>`;
  const kv = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  const sec = (t) => `<div class="sec">${t}</div>`;
  const onBtn = (k, on, accent = true) => {
    if (!btn[k]) return;
    btn[k].style.background = on ? (accent ? C.red : C.ink) : '#fff';
    btn[k].style.color = on ? '#fff' : C.ink;
    btn[k].style.borderColor = on ? (accent ? C.red : C.ink) : C.line;
  };
  let lcdKey = '';
  const lcdCtx = B.lcd.getContext('2d');

  // the listing's row for a program line (for leaders and the follow-a-line click)
  let lsFirst = 1;
  const lineSpot = (n) => {
    const i = n - lsFirst;
    if (i < 0 || i >= ROWS) return null;
    return [300, 150 + i * 14 + 7];
  };
  const rowTop = {};

  return {
    btn,
    root: ui,
    spots,
    TL,
    AN,
    ST,
    lineSpot,
    /** lay the stack out for this frame's openness before anything reads a row's position */
    layout(open) {
      let y = 0;
      for (const k of LAYERS_UI) {
        rowTop[k] = y;
        y += ST.row + OPEN_H * (open[k] ?? 0);
      }
    },
    rowSpot: (k) => [ST.x + 4, ST.y + ST.head + (rowTop[k] ?? 0) + 13],
    panelSpot: (k) => [ST.x, ST.y + ST.head + (rowTop[k] ?? 0) + 120],
    lineAt: (y) => lsFirst + Math.floor((y - 150) / 14),
    lsBox,
    pointer,
    /** s: everything one frame shows (see film.js consoleState) */
    update(s) {
      const M = s.M;
      const m = s.m;
      // ---------------- readouts
      const state = m.ui.kill ? 'HALTED' : M.ev.homeStart !== undefined && m.tm < M.ev.homeStart ? 'IDLE' : M.ev.homeDone !== undefined && m.tm < M.ev.homeDone ? 'HOMING' : M.ev.heatDone === undefined || m.tm < M.ev.heatDone ? 'HEATING' : m.tm < M.ev.printEnd ? 'PRINTING' : M.ev.motorsOff !== undefined && m.tm >= M.ev.motorsOff ? 'DONE' : 'FINISHING';
      ro.STATE.textContent = state;
      ro.STATE.style.color = state === 'HALTED' ? C.red : C.ink;
      roSub.STATE.textContent = m.ui.kill ? m.ui.kill.why : m.ui.msg.toUpperCase();
      ro.HOTEND.innerHTML = `${fx(m.th.Ts, 1)}<span style="color:${C.mute};font-size:11px"> / ${m.th.tgt}°</span>`;
      roSub.HOTEND.textContent = Math.abs(m.th.T - m.th.Ts) > 8 ? `BLOCK REALLY ${m.th.T.toFixed(0)}°` : `HEATER ${Math.round((m.th.duty / 255) * 100)}%`;
      roSub.HOTEND.style.color = Math.abs(m.th.T - m.th.Ts) > 8 ? C.red : C.mute;
      const fw = (a, i) => (m.homed[i] ? (m.steps[a] / P.steps[a]).toFixed(a === 'z' ? 2 : 1) : '?');
      ro.NOZZLE.textContent = `${fw('x', 0)}  ${fw('y', 1)}  ${fw('z', 2)}`;
      roSub.NOZZLE.textContent = `X · Y · Z MM, FROM THE STEP COUNT · ${fx(m.vel.v, 1)} MM/S`;
      const total = M.prog.length;
      const exI = m.ls.exec ? M.prog.findIndex((L) => L.n === m.ls.exec) + 1 : 0;
      ro.LINE.textContent = `${m.ls.exec ?? m.ls.parsed ?? '—'}`;
      ro['MACHINE TIME'].textContent = clock(m.tm);
      roSub['MACHINE TIME'].textContent = s.paused ? 'PAUSED' : playText(s.rate);
      faultChip.style.display = M.fault !== 'none' ? 'flex' : 'none';
      faultChip.textContent = `FAULT · ${FAULT_LABEL[M.fault]}`;
      void exI;
      void total;

      // ---------------- the listing: the executing line in the middle
      {
        const lines = M.lines;
        const focus = s.follow?.line ?? m.ls.exec ?? m.ls.parsed ?? 1;
        lsFirst = Math.max(1, Math.min(lines.length - ROWS + 1, focus - 8));
        lsHead.textContent = `DEMO.GCODE · ${lines.length} LINES`;
        for (let i = 0; i < ROWS; i++) {
          const L = lines[lsFirst - 1 + i];
          const r = lsRows[i];
          if (!L) {
            r.innerHTML = '';
            continue;
          }
          const ex = L.n === m.ls.exec;
          const pa = L.n === m.ls.parsed;
          const fl = s.follow && L.n === s.follow.line;
          const sent = M.lineT[L.n];
          const doneL = sent && sent.ok !== null && sent.ok <= m.tm;
          const code = L.code ? esc(L.code) : '';
          const cm = L.comment ? `<span style="color:${C.faint}">${L.code ? ' ' : ''};${esc(L.comment)}</span>` : '';
          const col = ex ? C.ink : doneL || !L.code ? C.mute : C.ink;
          r.style.background = fl ? `rgba(214,24,43,${(0.1 + 0.12 * s.follow.flash).toFixed(3)})` : ex ? C.pale : 'transparent';
          r.innerHTML = `<span style="display:inline-block;width:3px;height:14px;vertical-align:top;background:${ex ? C.red : 'transparent'}"></span><span style="color:${pa ? C.blue : 'transparent'};font-weight:700"> ›</span><span style="color:${C.mute}">${pad(L.n, 3)} </span><span style="color:${col};font-weight:${ex ? 700 : 500}">${code}</span>${cm}`;
        }
        const ahead = m.planner.length;
        lsAhead.textContent = ahead ? `${ahead} MOVE${ahead > 1 ? 'S' : ''} BUFFERED` : '';
      }

      // ---------------- controls
      for (const v of VIEWS) onBtn(v, s.view === v);
      for (const c of CUTS) onBtn('c_' + c, s.cut[c] > 0.5);
      for (const f of FAULTS) onBtn('f_' + f, M.fault === f, f !== 'none');

      // ---------------- transport
      btn.play.innerHTML = s.paused ? '▶ PLAY' : '❚❚ PAUSE';
      spText.textContent = playText(s.rate);
      {
        const k = Math.min(1, m.tm / M.end);
        tlFill.style.width = `${(k * TL.w).toFixed(1)}px`;
        tlKnob.style.left = `${(TL.x + k * TL.w).toFixed(1)}px`;
        const ev = M.ev;
        const marks = [['HOME', ev.homeStart], ['HEAT', ev.homeDone], ['L1', ev.layers[0]], ['L2', ev.layers[1]], ['L3', ev.layers[2]]].filter((x) => x[1] !== undefined);
        const key = M.fault + marks.length;
        if (tlMarks.dataset.k !== key) {
          tlMarks.dataset.k = key;
          let h = '';
          let lastX = -99;
          for (const [n, t] of marks) {
            const x = TL.x + (t / M.end) * TL.w;
            h += `<div style="position:absolute;left:${x}px;top:${TL.y - 6}px;width:1px;height:15px;background:${C.faint}"></div>`;
            const lx = Math.max(x - 4, lastX + 2);
            h += `<div class="cp mu" style="position:absolute;left:${lx}px;top:${TL.y + 12}px;font-size:7.6px;letter-spacing:.6px">${n}</div>`;
            lastX = lx + n.length * 6 + 6;
          }
          if (M.killed) {
            const x = TL.x + (M.killed.t / M.end) * TL.w;
            h += `<div style="position:absolute;left:${x}px;top:${TL.y - 7}px;width:2px;height:17px;background:${C.red}"></div>`;
          }
          tlMarks.innerHTML = h;
        }
        tlTime.textContent = `${clock(m.tm)} / ${clock(M.end)} MACHINE`;
      }

      // ---------------- the logic analyzer: a window of machine time ending now
      {
        const win = s.window;
        const t1 = m.tm;
        const t0 = t1 - win;
        const X = (t) => AN.lx - AN.x + ((t - t0) / win) * AN.tw;
        const real = win / Math.max(1e-6, s.rate);
        const wtxt = (w) => (w >= 1 ? `${w.toFixed(1)} s` : w >= 0.001 ? `${(w * 1000).toFixed(w < 0.01 ? 1 : 0)} ms` : `${(w * 1e6).toFixed(0)} µs`);
        anLens.innerHTML = `<span style="color:${C.ink}">WINDOW ${wtxt(win)} MACHINE TIME</span> <span class="mu">·</span> <span style="color:${C.red}">ON SCREEN ${wtxt(real)}</span>`;
        let h = '';
        const chans = ['x', 'y', 'z', 'e'];
        chans.forEach((a, i) => {
          const y = 4 + i * 21;
          const rate = m.rate[a];
          h += `<text x="11" y="${y + 9}" font-family="JetBrains Mono" font-size="9" font-weight="700" fill="${C.ink}">${a.toUpperCase()}</text>`;
          h += `<text x="24" y="${y + 9}" font-family="JetBrains Mono" font-size="7.6" fill="${C.mute}">${rate >= 1000 ? (rate / 1000).toFixed(1) + 'k' : Math.round(rate)}/s</text>`;
          h += `<line x1="${AN.lx - AN.x}" x2="${AN.lx - AN.x + AN.tw}" y1="${y + 14}" y2="${y + 14}" stroke="${C.line}" stroke-width="1"/>`;
          const edges = M.stepEdges(a, t0, t1, 2400);
          // one pulse per step, a 2 µs high on the STEP pin, never thinner than a pixel
          let d = '';
          const pw = Math.max(1, (2e-6 / win) * AN.tw);
          if (edges.length > AN.tw * 0.7) {
            // denser than the pixels: a solid band says so
            const xa = X(edges[0]);
            const xb = X(edges[edges.length - 1]);
            h += `<rect x="${xa}" y="${y + 3}" width="${Math.max(1, xb - xa)}" height="11" fill="${C.ink}" opacity=".55"/>`;
          } else for (const e of edges) d += `M${X(e).toFixed(1)} ${y + 14}v-11h${pw.toFixed(1)}v11`;
          if (d) h += `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="1"/>`;
          // DIR: a thin line, high for +, low for −
          const dir = M.dirAt(t1, a);
          h += `<text x="${AN.lx - AN.x + AN.tw + 6}" y="${y + 10}" font-family="JetBrains Mono" font-size="7.6" fill="${C.blue}">DIR${dir > 0 ? '+' : '−'}</text>`;
          h += `<line x1="${AN.lx - AN.x + AN.tw - 20}" x2="${AN.lx - AN.x + AN.tw}" y1="${dir > 0 ? y + 3 : y + 14}" y2="${dir > 0 ? y + 3 : y + 14}" stroke="${C.blue}" stroke-width="1.5"/>`;
        });
        // the now line, and the follow-a-line block's edges
        h += `<line x1="${AN.lx - AN.x + AN.tw}" x2="${AN.lx - AN.x + AN.tw}" y1="0" y2="88" stroke="${C.red}" stroke-width="1.2"/>`;
        h += `<text x="${AN.lx - AN.x + AN.tw - 4}" y="88" text-anchor="end" font-family="JetBrains Mono" font-size="7.6" fill="${C.red}">NOW</text>`;
        if (s.follow?.block) {
          const b = s.follow.block;
          for (const tt of [b.tStart, b.tEnd]) if (tt > t0 && tt < t1) h += `<line x1="${X(tt)}" x2="${X(tt)}" y1="0" y2="86" stroke="${C.red}" stroke-dasharray="2 3" stroke-width="1"/>`;
        }
        anSvg.innerHTML = h;
      }

      // ---------------- the stack: row positions from each layer's openness
      {
        let y = 0;
        for (const k of LAYERS_UI) {
          const R = rows[k];
          const o = s.open[k] ?? 0;
          R.r.style.top = `${y}px`;
          rowTop[k] = y;
          R.r.style.height = `${ST.row + OPEN_H * o}px`;
          R.r.style.background = o > 0.02 ? '#fff' : s.touched?.[k] ? 'rgba(214,24,43,.07)' : 'transparent';
          R.nm.style.color = o > 0.5 || s.touched?.[k] ? C.red : C.ink;
          R.body.style.opacity = String(Math.max(0, (o - 0.4) / 0.6));
          R.body.style.display = o > 0.02 ? 'block' : 'none';
          y += ST.row + OPEN_H * o;
        }
      }
      // one-liners and activity dots
      const lp = M.lines[(m.ls.parsed ?? 1) - 1];
      const blk = m.ls.block;
      const one = {
        ui: m.ui.screen === 'status' || m.ui.screen === 'error' ? m.ui.msg : `${m.ui.screen.toUpperCase()} › ${m.ui.items[m.ui.idx]}`,
        host: (() => {
          const e = M.serial.filter((x) => x.t <= m.tm).pop();
          return e ? `${e.d} ${e.s.trim()}` : '—';
        })(),
        parser: lp?.code ? `L${lp.n} ${lp.code}` : '—',
        planner: `${m.planner.length}/15 BLOCKS · ${fx(m.vel.v, 1)} MM/S`,
        stepper: `X ${m.steps.x} · ${(Math.max(m.rate.x, m.rate.y, m.rate.z, m.rate.e) / 1000).toFixed(1)} kHz`,
        driver: `X MSCNT ${pad(m.drv.x.mscnt, 4)} · ${m.drv.x.enabled ? (m.drv.x.hold ? 'HOLD' : 'RUN') : 'OFF'}`,
        thermal: `${fx(m.th.Ts, 1)}/${m.th.tgt}° · ${Math.round((m.th.duty / 255) * 100)}%`,
        mech: `${fx(m.pos.x, 1)} ${fx(m.pos.y, 1)} ${fx(m.pos.z, 2)}`,
      };
      const act = {ui: m.tm - m.ui.lastT < 0.3, host: m.net.usb > 0.1, parser: m.net.usb > 0.1, planner: m.vel.v > 0.1, stepper: m.vel.v > 0.1, driver: m.drv.x.enabled, thermal: m.th.duty > 0, mech: m.vel.v > 0.1};
      for (const k of LAYERS_UI) {
        rows[k].v.textContent = one[k];
        rows[k].dot.style.background = act[k] ? C.red : C.faint;
      }

      // ---------------- the open bodies (only what is visible is drawn)
      const vis = (k) => (s.open[k] ?? 0) > 0.05;
      if (vis('ui')) {
        if (s.screenDirty || lcdKey !== s.screenKey) {
          lcdKey = s.screenKey;
          lcdCtx.drawImage(s.screenCanvas, 0, 0);
        }
        B.uiInfo.innerHTML =
          sec('THE SAME PIXELS AS THE GLASS') +
          kv('SCREEN', m.ui.screen.toUpperCase() + (m.ui.screen === 'main' || m.ui.screen === 'tune' ? ` · ${m.ui.items[m.ui.idx]}` : '')) +
          kv('KNOB', `${m.ui.det >= 0 ? '+' : ''}${m.ui.det} DETENTS · ${m.ui.last ? m.ui.last.toUpperCase() : '—'}`) +
          kv('PANEL', '128 × 64 MONO · SPI') +
          kv('ENCODER', '20 DETENTS / TURN') +
          kv('REDRAW', 'MENU LOOP, ~10 HZ') +
          kv('MESSAGE', esc(m.ui.msg));
      }
      if (vis('host')) {
        const log = M.serial.filter((e) => e.t <= m.tm).slice(-17);
        const sent = M.serial.filter((e) => e.t <= m.tm && e.d === '>').length;
        const oks = M.serial.filter((e) => e.t <= m.tm && e.s === 'ok').length;
        let h = `<div class="kv"><span>USB CDC · ${P.baud.toLocaleString('en-US')} BAUD</span><b>SENT ${sent} · OK ${oks}</b></div>`;
        h += `<div style="margin-top:6px;border-top:1px solid ${C.line};padding-top:4px">`;
        for (const e of log) {
          const err = e.s.startsWith('Error');
          h += `<div class="mo" style="font-size:8.4px;line-height:12.6px;white-space:pre;overflow:hidden;color:${err ? C.red : e.d === '>' ? C.blue : C.ink}"><span style="color:${C.mute}">${(e.t % 100).toFixed(2).padStart(6, ' ')} </span>${e.d} ${esc(e.s.trim())}</div>`;
        }
        h += `</div><div class="kv" style="margin-top:4px"><span>THE HOST SENDS A LINE PER "ok"</span><b>PING-PONG</b></div>`;
        B.host.innerHTML = h;
      }
      if (vis('parser')) {
        const L = M.lines[(m.ls.parsed ?? 1) - 1];
        const b = M.blocks.find((x) => x.line === L?.n && x.kind === 'move');
        let h = `<div class="mo" style="font-size:12.5px;font-weight:700;margin:2px 0 8px;white-space:nowrap;overflow:hidden">${esc(L?.code ?? '—')}</div>`;
        h += `<div style="display:flex;gap:4px;flex-wrap:wrap">`;
        for (const [k, v] of L?.fields ?? []) h += `<div class="mo" style="border:1px solid ${C.line};background:#fff;padding:2px 5px;font-size:9px"><b style="color:${C.red}">${k}</b> ${esc(v)}</div>`;
        h += `</div>`;
        const what = {G1: 'LINEAR MOVE → THE PLANNER', G0: 'RAPID MOVE → THE PLANNER', G28: 'HOME: SYNCHRONISE, RUN THE ENDSTOP DANCE', M109: 'SET HOTEND, BLOCK UNTIL IT HOLDS', M104: 'SET HOTEND TARGET, NO WAIT', M140: 'SET BED TARGET, NO WAIT', M106: 'FAN ON, AT PARSE TIME', M107: 'FAN OFF, AT PARSE TIME', G92: 'SET THE POSITION, NO MOVE', M84: 'WAIT FOR MOTION, MOTORS OFF', M155: 'AUTO-REPORT TEMPERATURES', M201: 'MAX ACCELERATION', M204: 'ACCELERATION'}[L?.cmd] ?? '—';
        h += sec('MEANING') + `<div class="mo" style="font-size:9px;color:${C.ink}">${what}</div>`;
        if (b) {
          h += sec(`→ BLOCK #${b.i}`);
          h += kv('ΔX ΔY ΔZ', `${fx(b.d.x)} ${fx(b.d.y)} ${fx(b.d.z)}`);
          h += kv('ΔE', `${fx(b.d.e, 3)} MM`);
          h += kv('LENGTH', `${fx(b.len)} MM`);
          h += kv('FEED', `${fx(b.vNom, 1)} MM/S`);
          h += kv('TARGET STEPS', `X ${b.stepsEnd.x} Y ${b.stepsEnd.y}`);
          h += kv('', `Z ${b.stepsEnd.z} E ${b.stepsEnd.e}`);
        }
        h += sec('COMMAND QUEUE') + kv('BUFSIZE', `${P.bufsize} LINES`);
        h += `<div class="mo" style="font-size:8.6px;line-height:13px;color:${C.grey};margin-top:6px">The parser runs ahead of the nozzle: M106 and M104 take effect when parsed, up to 15 moves early.</div>`;
        B.parser.innerHTML = h;
      }
      if (vis('planner')) {
        const bl = m.planner;
        const W = 262;
        const Hh = 140;
        let h = '';
        if (bl.length) {
          const t0 = m.tm;
          const tEnd = bl[bl.length - 1].tEnd;
          const span = Math.max(0.2, tEnd - t0);
          const vmax = 50;
          const X = (t) => 26 + ((t - t0) / span) * (W - 32);
          const Y = (v) => Hh - 18 - (v / vmax) * (Hh - 34);
          let p = '';
          let fills = '';
          for (const b of bl) {
            const n = 24;
            let seg = '';
            for (let i = 0; i <= n; i++) {
              const tt = b.tStart + (i / n) * b.dur;
              if (tt < t0) continue;
              seg += `${seg ? 'L' : 'M'}${X(tt).toFixed(1)} ${Y(M.vOf(b, tt - b.tStart)).toFixed(1)}`;
            }
            if (!seg) continue;
            p += seg;
            const xa = X(Math.max(t0, b.tStart));
            const xb = X(b.tEnd);
            const fl = s.follow?.block === b;
            fills += `<rect x="${xa}" y="${Y(b.vNom)}" width="${Math.max(0.5, xb - xa)}" height="${Y(0) - Y(b.vNom)}" fill="${fl ? 'rgba(214,24,43,.12)' : b.extruding ? 'rgba(61,143,224,.07)' : 'rgba(0,0,0,.03)'}"/>`;
            fills += `<line x1="${xb}" x2="${xb}" y1="${Y(0)}" y2="${Y(Math.max(b.vExit, 0))}" stroke="${C.faint}"/>`;
            if (b.vExit > 0.1 && b.vExit < b.vNom - 1) fills += `<circle cx="${xb}" cy="${Y(b.vExit)}" r="2.2" fill="${C.blue}"/>`;
          }
          h += svg(
            W,
            Hh,
            `${fills}<path d="${p}" fill="none" stroke="${C.ink}" stroke-width="1.4"/>` +
              `<line x1="26" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" stroke="${C.faint}"/>` +
              [0, 25, 50].map((v) => `<text x="22" y="${Y(v) + 3}" text-anchor="end" font-family="JetBrains Mono" font-size="7.4" fill="${C.mute}">${v}</text>`).join('') +
              `<circle cx="${X(t0)}" cy="${Y(m.vel.v)}" r="3.6" fill="${C.red}"/>` +
              `<text x="26" y="${Hh - 4}" font-family="JetBrains Mono" font-size="7.4" fill="${C.mute}">NOW</text><text x="${W}" y="${Hh - 4}" text-anchor="end" font-family="JetBrains Mono" font-size="7.4" fill="${C.mute}">+${(span * 1000).toFixed(0)} MS · MM/S ↑</text>`,
          );
        } else h += `<div class="mo" style="height:140px;font-size:9px;color:${C.mute};padding-top:60px;text-align:center">PLANNER EMPTY</div>`;
        // the buffer's 16 slots
        h += `<div style="display:flex;gap:2px;margin:6px 0 2px">${Array.from({length: P.blockBuffer}, (_, i) => `<div style="flex:1;height:9px;background:${i < bl.length ? (i === 0 ? C.red : C.ink) : i === P.blockBuffer - 1 ? 'transparent' : '#e6e7e9'};border:${i === P.blockBuffer - 1 ? `1px dashed ${C.faint}` : 'none'};box-sizing:border-box"></div>`).join('')}</div>`;
        h += `<div class="cp mu" style="font-size:7.6px;font-weight:500">BLOCK BUFFER · 16 SLOTS · ONE ALWAYS FREE</div>`;
        const b = m.ls.block;
        if (b && b.kind === 'move') {
          h += sec(`BLOCK #${b.i} · LINE ${b.line}`);
          h += kv('ENTRY · PEAK · EXIT', `${fx(b.vEntry, 1)} · ${fx(b.vPeak, 1)} · ${fx(b.vExit, 1)}`);
          h += kv('ACCEL', `${b.acc.toFixed(0)} MM/S²`);
          h += kv('CORNER IN', b.theta !== undefined ? `${(180 - b.theta).toFixed(0)}° TURN` : '—');
        } else if (b) h += sec(`HOMING MOVE · LINE ${b.line}`) + kv('STOPS AT', 'THE ENDSTOP, NO DECELERATION');
        h += `<div class="mo" style="font-size:8.6px;color:${C.grey};margin-top:5px">v<sub>j</sub> = √(a·δ·sin(θ/2) / (1 − sin(θ/2))) · δ ${P.jd} MM</div>`;
        h += `<div class="cp" style="font-size:7.6px;margin-top:5px;color:${C.mute}"><span style="color:${C.blue}">━</span> SLOW &nbsp;→&nbsp; <span style="color:${C.red}">━</span> FAST · THE BEAD AND THE PATH AHEAD</div>`;
        B.planner.innerHTML = h;
      }
      if (vis('stepper')) {
        let h = `<div class="kv" style="font-weight:700"><span>AXIS</span><span>STEPS</span><span>÷ STEPS/MM</span><span>RATE</span></div>`;
        for (const a of ['x', 'y', 'z', 'e']) h += `<div class="kv"><b style="width:22px">${a.toUpperCase()}</b><b style="width:56px;text-align:right">${m.steps[a]}</b><span style="width:70px;text-align:right">${fx(P.steps[a], a === 'e' ? 1 : 0)}</span><span style="width:60px;text-align:right">${Math.round(m.rate[a])}/s</span></div>`;
        const b = m.ls.block;
        if (b) {
          const k = M.kAt(b, m.tm);
          h += sec(`BRESENHAM · BLOCK #${b.i}`);
          h += kv('EVENTS', `${k} / ${b.N}`);
          const lead = ['x', 'y', 'z', 'e'].reduce((p, a) => (b.n[a] > b.n[p] ? a : p), 'x');
          h += kv('LEAD AXIS', `${lead.toUpperCase()} · STEPS EVERY EVENT`);
          for (const a of ['x', 'y', 'z', 'e']) if (b.n[a]) h += kv(`  ${a.toUpperCase()} ${b.n[a]} OF ${b.N}`, `${M.bres(k, b.n[a], b.N)} DONE`);
          // the bar of events
          const W = 262;
          h += svg(W, 16, `<rect x="0" y="4" width="${W}" height="8" fill="#e6e7e9"/><rect x="0" y="4" width="${((k / b.N) * W).toFixed(1)}" height="8" fill="${C.red}"/>`);
        }
        const isr = Math.max(m.rate.x, m.rate.y, m.rate.z, m.rate.e);
        h += sec('THE INTERRUPT');
        h += kv('ISR RATE', `${(isr / 1000).toFixed(2)} kHz`);
        h += kv('ONE EVENT EVERY', isr > 1 ? `${(1e6 / isr).toFixed(0)} µs` : '—');
        h += kv('STEP PULSE', '≥ 2 µs HIGH');
        h += `<div class="mo" style="font-size:8.6px;color:${C.grey};margin-top:5px;line-height:13px">Each event steps the lead axis; the others step when their Bresenham counter overflows, so every axis lands on its target count exactly.</div>`;
        B.stepper.innerHTML = h;
      }
      if (vis('driver')) {
        const d = m.drv.x;
        const W = 262;
        const Hh = 92;
        const X = (c) => 6 + (c / 1024) * (W - 12);
        const Y = (i) => Hh / 2 - (i / TMC.iPeak) * (Hh / 2 - 8);
        let pa = '';
        let pb = '';
        for (let c = 0; c <= 1024; c += 16) {
          const ph = (2 * Math.PI * c) / 1024;
          pa += `${c ? 'L' : 'M'}${X(c).toFixed(1)} ${Y(TMC.iPeak * Math.sin(ph)).toFixed(1)}`;
          pb += `${c ? 'L' : 'M'}${X(c).toFixed(1)} ${Y(TMC.iPeak * Math.cos(ph)).toFixed(1)}`;
        }
        const sc = d.amp / TMC.iPeak || 0;
        let h = `<div class="kv"><span>X AXIS · TMC2209 · UART</span><b>${d.enabled ? (d.hold ? 'HOLD CURRENT' : 'RUN CURRENT') : 'DISABLED'}</b></div>`;
        h += svg(
          W,
          Hh,
          `<line x1="6" x2="${W - 6}" y1="${Hh / 2}" y2="${Hh / 2}" stroke="${C.faint}"/>` +
            `<path d="${pa}" fill="none" stroke="${C.red}" stroke-width="1.3" opacity="${0.35 + 0.65 * sc}"/><path d="${pb}" fill="none" stroke="${C.blue}" stroke-width="1.3" opacity="${0.35 + 0.65 * sc}"/>` +
            `<line x1="${X(d.mscnt)}" x2="${X(d.mscnt)}" y1="4" y2="${Hh - 4}" stroke="${C.ink}" stroke-width="1"/>` +
            `<circle cx="${X(d.mscnt)}" cy="${Y(d.iA)}" r="3.4" fill="${C.red}"/><circle cx="${X(d.mscnt)}" cy="${Y(d.iB)}" r="3.4" fill="${C.blue}"/>` +
            `<text x="6" y="${Hh - 1}" font-family="JetBrains Mono" font-size="7.4" fill="${C.mute}">MSCNT 0</text><text x="${W - 6}" y="${Hh - 1}" text-anchor="end" font-family="JetBrains Mono" font-size="7.4" fill="${C.mute}">1023 = 4 FULL STEPS</text>`,
        );
        h += kv('MSCNT · +16 PER STEP', `${d.mscnt}`);
        h += kv(`<span style="color:${C.red}">COIL A</span> · <span style="color:${C.blue}">COIL B</span>`, `${fx(d.iA, 3)} · ${fx(d.iB, 3)} A`);
        h += kv('PEAK · RMS', `${fx(TMC.iPeak, 3)} · ${fx(TMC.iRms, 3)} A`);
        h += sec('REGISTERS WRITTEN AT BOOT');
        for (const [n, addr, v] of TMC.regs) h += `<div class="kv"><span>0x${addr.toString(16).toUpperCase().padStart(2, '0')} ${n}</span><b>${v}</b></div>`;
        B.driver.innerHTML = h;
      }
      if (vis('thermal')) {
        const TH = M.TH;
        const W = 262;
        const Hh = 118;
        const span = 60;
        const t0 = m.tm - span;
        const X = (t) => 24 + ((t - t0) / span) * (W - 28);
        const Y = (T) => Hh - 12 - (Math.min(320, Math.max(0, T)) / 320) * (Hh - 20);
        let pT = '';
        let pS = '';
        let pG = '';
        const k1 = m.th.k;
        const k0 = Math.max(0, M.lower(TH.t, t0));
        const st = Math.max(1, Math.floor((k1 - k0) / 160));
        for (let k = k0; k <= k1; k += st) {
          const x = X(TH.t[k]).toFixed(1);
          pT += `${pT ? 'L' : 'M'}${x} ${Y(TH.T[k]).toFixed(1)}`;
          pS += `${pS ? 'L' : 'M'}${x} ${Y(TH.Ts[k]).toFixed(1)}`;
          pG += `${pG ? 'L' : 'M'}${x} ${Y(TH.tgt[k]).toFixed(1)}`;
        }
        let h = svg(
          W,
          Hh,
          [0, 100, 200, 300].map((v) => `<line x1="24" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.line}"/><text x="20" y="${Y(v) + 3}" text-anchor="end" font-family="JetBrains Mono" font-size="7.4" fill="${C.mute}">${v}</text>`).join('') +
            `<path d="${pG}" fill="none" stroke="${C.mute}" stroke-dasharray="3 3"/><path d="${pT}" fill="none" stroke="${C.red}" stroke-width="1.2" opacity=".75"/><path d="${pS}" fill="none" stroke="${C.ink}" stroke-width="1.5"/>` +
            `<text x="${W}" y="${Hh - 1}" text-anchor="end" font-family="JetBrains Mono" font-size="7.4" fill="${C.mute}">LAST 60 S · °C</text>`,
        );
        h += `<div class="cp" style="font-size:7.6px;margin:2px 0 4px;color:${C.mute}"><span style="color:${C.ink}">━</span> SENSED &nbsp; <span style="color:${C.red}">━</span> BLOCK (REAL) &nbsp; ┅ TARGET</div>`;
        const bar = (label, v, max, col) => `<div class="kv"><span style="width:70px">${label}</span><span style="flex:1;margin:5px 6px 0;height:4px;background:#e6e7e9;position:relative"><i style="position:absolute;left:0;top:0;height:4px;width:${(Math.min(1, Math.max(0, v / max)) * 100).toFixed(1)}%;background:${col}"></i></span><b style="width:44px;text-align:right">${Math.round(v)}</b></div>`;
        h += bar('HEATER PWM', m.th.duty, 255, C.red);
        h += bar('P TERM', m.th.p, 255, C.ink);
        h += bar('I TERM', m.th.i, 255, C.ink);
        h += bar('D TERM', Math.abs(m.th.d), 255, C.grey);
        h += kv('PID Kp · Ki · Kd', `${P.pid.kp} · ${P.pid.ki} · ${P.pid.kd}`);
        h += kv('RUNAWAY WATCH', `${m.th.tr}${m.th.tr === 'STABLE' && m.th.trLeft < P.runaway.period - 0.2 ? ` · ${m.th.trLeft.toFixed(1)} S LEFT` : ''}`);
        h += kv('ADC (×16)', `${m.th.adc} → ${fx(m.th.Ts, 1)}°`);
        h += kv('BED · BANG-BANG', `${fx(m.th.bedT, 1)} / ${m.th.bedTgt}° ${m.th.bedOn ? 'ON' : 'OFF'}`);
        h += kv('PART FAN', `${Math.round(m.th.fan * 100)}%`);
        B.thermal.innerHTML = h;
      }
      if (vis('mech')) {
        let h = sec('STEPS ÷ STEPS/MM = WHERE THE FIRMWARE THINKS IT IS');
        for (const a of ['x', 'y', 'z']) h += kv(`${a.toUpperCase()} ${m.steps[a]} ÷ ${P.steps[a]}`, `${fx(m.steps[a] / P.steps[a], 3)} MM`);
        h += sec('WHERE THE PARTS REALLY ARE');
        h += kv('CARRIAGE X', `${fx(m.pos.x, 3)} MM`);
        h += kv('BED Y', `${fx(m.pos.y, 3)} MM`);
        h += kv('LOST STEPS X', m.lostX ? `<span style="color:${C.red}">${fx(m.lostX, 2)} MM · ${Math.round(m.lostX * P.steps.x)} µSTEPS</span>` : '0');
        // the last second of frame deflection, X and Y
        const W = 262;
        const Hh = 64;
        const span = 1;
        let px = '';
        let py = '';
        const sc = 0.25;
        for (let i = 0; i <= 120; i++) {
          const t = m.tm - span + (i / 120) * span;
          const x = (i / 120) * W;
          px += `${i ? 'L' : 'M'}${x.toFixed(1)} ${(Hh / 2 - (M.deflAt(t, 'x') / sc) * (Hh / 2 - 4)).toFixed(1)}`;
          py += `${i ? 'L' : 'M'}${x.toFixed(1)} ${(Hh / 2 - (M.deflAt(t, 'y') / sc) * (Hh / 2 - 4)).toFixed(1)}`;
        }
        h += sec('FRAME RINGING · LAST 1 S · ±0.25 MM');
        h += svg(W, Hh, `<line x1="0" x2="${W}" y1="${Hh / 2}" y2="${Hh / 2}" stroke="${C.faint}"/><path d="${px}" fill="none" stroke="${C.red}" stroke-width="1.2"/><path d="${py}" fill="none" stroke="${C.blue}" stroke-width="1.2"/>`);
        h += `<div class="cp" style="font-size:7.6px;color:${C.mute}"><span style="color:${C.red}">━</span> TOOLHEAD X ${P.res.x.f} HZ &nbsp; <span style="color:${C.blue}">━</span> BED Y ${P.res.y.f} HZ</div>`;
        h += sec('THE DRIVES');
        h += kv('X, Y · GT2 BELT, 20 T', '40 MM / TURN');
        h += kv('Z · T8 LEAD SCREW', '8 MM / TURN');
        h += kv('E · 3:1 GEARS, ⌀7.36', `${fx((Math.PI * P.ext.gearD) / P.ext.ratio, 2)} MM / TURN`);
        B.mech.innerHTML = h;
      }

      // ---------------- follow-a-line banner
      if (s.follow) {
        followBar.style.display = 'flex';
        const ST_ = ['LINE ' + s.follow.line, 'PARSER', 'PLANNER', 'STEPPER ISR', 'DRIVER', 'MOTOR', 'BELT', 'NOZZLE'];
        followBar.innerHTML = `<span style="color:${C.mute};margin-right:10px">FOLLOW A LINE</span>` + ST_.map((n, i) => `<span style="padding:3px 7px;background:${i === s.follow.stage ? C.red : i < s.follow.stage ? '#fff' : 'transparent'};color:${i === s.follow.stage ? '#fff' : i < s.follow.stage ? C.ink : C.mute};border:1px solid ${i <= s.follow.stage ? (i === s.follow.stage ? C.red : C.line) : 'transparent'}">${n}</span>${i < ST_.length - 1 ? `<span style="color:${C.faint};margin:0 4px">→</span>` : ''}`).join('');
      } else if (s.partInfo) {
        followBar.style.display = 'flex';
        followBar.innerHTML = `<span style="color:${C.mute};margin-right:10px">FOLLOW A PART</span><span style="padding:3px 7px;background:${C.red};color:#fff">${s.partInfo.name}</span><span style="color:${C.faint};margin:0 8px">←</span><span style="color:${C.ink}">${s.partInfo.layers.map((k) => LAYER_NAME[k]).join(' · ')}</span>`;
      } else followBar.style.display = 'none';

      // ---------------- callouts and leaders
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const o = c.o.toFixed(2);
        if (c.from) {
          // a leader from a panel into the printer
          lh += `<polyline points="${c.from[0].toFixed(1)},${c.from[1].toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)}" fill="none" stroke="${C.red}" stroke-width="1" opacity="${o}" stroke-dasharray="${c.dash ? '3 3' : 'none'}"/><circle cx="${c.from[0].toFixed(1)}" cy="${c.from[1].toFixed(1)}" r="2.4" fill="${C.red}" opacity="${o}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="3.2" fill="none" stroke="${C.red}" stroke-width="1.2" opacity="${o}"/>`;
          continue;
        }
        const [lx, ly] = c.label;
        const right = lx > ax;
        const ex = right ? lx - 6 : lx + c.w + 6;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${(ly + 7).toFixed(1)}" fill="none" stroke="${C.ink}" stroke-width=".8" opacity="${o}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.2" fill="${C.ink}" opacity="${o}"/>`;
        ch += `<div class="call" style="left:${lx.toFixed(1)}px;top:${(ly - 2).toFixed(1)}px;opacity:${o};${right ? '' : `width:${c.w}px;text-align:right`}"><b>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
  };
}
