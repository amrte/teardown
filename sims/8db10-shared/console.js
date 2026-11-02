// The GIS console, laid out at 1600 x 900: the badge and title; the feeder state with its live single-line diagram;
// the nine gas compartments; the circuit-breaker chart (current per pole, contact gap, arc windows, the times read off
// the model); the switching board (programs, single devices, the interlock line); views; display modes; the procedure
// strip with the program's steps and the time rate; floor notes and labels with leaders.
// update(s) redraws every live part from the frame's state.
import {CB, COMPARTMENTS, DISC_T, GAS, gasAt, Q1A, Q2A, R, stateAt} from './gis.js';
import {ACCENT, EARTH} from './panel.js';

export const C = {ink: '#23282b', mute: '#8a9296', faint: '#cfd5d3', line: '#dde2e0', panel: 'rgba(250,251,250,.95)', acc: ACCENT, green: EARTH, blue: '#3c79a8'};
export const VIEWS = ['hero', 'front', 'side', 'disc', 'cb', 'cable', 'busbar'];
export const VIEW_LABEL = {hero: 'HERO', front: 'FRONT', side: 'SIDE', disc: 'DISCONNECTORS', cb: 'BREAKER', cable: 'CABLE', busbar: 'BUSBARS'};
export const DISPLAY = ['labels', 'xray', 'section', 'gas', 'ghost', 'orbit'];
export const DISPLAY_LABEL = {labels: 'LABELS', xray: 'X-RAY', section: 'SECTION', gas: 'GAS', ghost: 'NEIGHBOUR', orbit: 'ORBIT'};
export const PROGS = ['bb1', 'bb2', 'earth'];
export const DEVICES = [['q1', 'closed', 'Q1 CLOSE'], ['q1', 'open', 'OPEN'], ['q1', 'earth', 'EARTH'], ['q2', 'closed', 'Q2 CLOSE'], ['q2', 'open', 'OPEN'], ['q0', 'closed', 'CB ON'], ['q0', 'open', 'OFF']];
const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,monospace}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 2px 10px rgba(40,60,60,.07)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.acc}}
.pn{position:absolute;font:500 9.5px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.6px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.bt{position:absolute;height:21px;padding:0 8px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fdfefd;font:700 9.2px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.ink};white-space:nowrap;box-sizing:border-box}
.call{position:absolute;white-space:nowrap}
.call b{display:flex;align-items:center;gap:6px;font:700 9.4px 'JetBrains Mono',monospace;letter-spacing:1.3px;color:${C.ink}}
.call b i{display:block;width:6px;height:6px;background:${C.acc}}
.call span{display:block;font:500 7.8px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.mute};margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.acc};opacity:0;z-index:49}
.shake{animation:shake .35s}
@keyframes shake{20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const T = (x, y, s, opts = '') => `<text x="${x}" y="${y}" font-family="JetBrains Mono" font-size="7.4" letter-spacing="1" fill="${C.mute}" ${opts}>${s}</text>`;

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  const panel = (x, y, w, h, title, n) => {
    add(`<div class="cp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="ph" style="left:${x + 14}px;top:${y + 13}px"><i></i>${title}</div>`);
    add(`<div class="pn" style="right:${1600 - x - w + 14}px;top:${y + 15}px">${n}</div>`);
  };

  // ------------------------------------------------------------ header
  add(`<div style="position:absolute;left:0;top:0;width:160px;height:89px;background:${C.acc}"></div>`);
  add(`<svg style="position:absolute;left:24px;top:28px" width="40" height="34"><g fill="none" stroke="#fff" stroke-width="3"><path d="M3 4h34M3 14h34"/><path d="M12 4v26M28 14v16"/></g></svg>`);
  add(`<div class="mo" style="position:absolute;left:78px;top:35px;color:#fff;font-size:16px;font-weight:600;letter-spacing:4px">8DB</div>`);
  add(`<div class="sm" style="position:absolute;left:182px;top:22px;letter-spacing:2.4px">MEDIUM-VOLTAGE SWITCHGEAR</div>`);
  add(`<div style="position:absolute;left:181px;top:37px;font-size:33px;font-weight:700;letter-spacing:-.6px;line-height:1">Double-busbar GIS panel <span style="color:${C.acc};font-weight:400">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:182px;top:77px;font-size:11.2px;letter-spacing:2.2px;color:#5d666a">8DB10-TYPE · CIRCUIT-BREAKER FEEDER · SF6 INSULATED</div>`);
  add(`<div class="sm" style="position:absolute;left:1000px;top:49px;letter-spacing:2.6px;font-size:9.6px">SINGLE-POLE ENCLOSED · 40 kA</div>`);
  add(`<div class="mo" style="position:absolute;left:1262px;top:47px;color:${C.acc};font-size:12px;letter-spacing:-1px">//////</div>`);
  add(`<div style="position:absolute;left:1322px;top:34px;color:${C.acc};font-size:39px;font-weight:700;letter-spacing:-.8px;line-height:1">40.5<span style="font-size:20px;font-weight:600"> kV</span></div>`);
  add(`<div style="position:absolute;left:1488px;top:33px;width:1px;height:44px;background:${C.faint}"></div>`);
  add(`<div class="sm" style="position:absolute;left:1502px;top:34px;line-height:14px;letter-spacing:2.2px">5000 A<br>BUSBAR<br>3150 A</div>`);

  // ------------------------------------------------------------ 01 feeder state + single-line diagram
  panel(28, 126, 282, 300, 'FEEDER STATE', '01');
  const chip = add(`<div style="position:absolute;left:42px;top:166px;width:13px;height:24px;border-radius:2px"></div>`);
  const stTitle = add(`<div style="position:absolute;left:66px;top:164px;font-size:15px;font-weight:600;white-space:nowrap"></div>`);
  const stSub = add(`<div class="sm" style="position:absolute;left:67px;top:184px;width:236px;overflow:hidden;text-overflow:ellipsis"></div>`);
  add(`<div style="position:absolute;left:42px;top:203px;width:254px;height:1px;background:${C.line}"></div>`);
  const sld = add(`<svg style="position:absolute;left:42px;top:212px" width="254" height="206"></svg>`);

  // ------------------------------------------------------------ 02 gas compartments
  panel(28, 440, 282, 196, 'GAS COMPARTMENTS', '02');
  const gasSvg = add(`<svg style="position:absolute;left:42px;top:474px" width="254" height="126"></svg>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:608px;font-size:8.2px">SF6 · RATED ${GAS.rated} kPa · LOW ${GAS.low} · CRITICAL ${GAS.critical}</div>`);

  // ------------------------------------------------------------ 03 circuit-breaker
  panel(1290, 126, 282, 262, 'CIRCUIT-BREAKER', '03');
  const chart = add(`<svg style="position:absolute;left:1304px;top:160px" width="254" height="146"></svg>`);
  const rd = add(`<div style="position:absolute;left:1304px;top:312px;width:254px;height:70px"></div>`);

  // ------------------------------------------------------------ 04 switching, 05 views, 06 display
  const btn = {};
  panel(1290, 402, 282, 198, 'SWITCHING', '04');
  const row = (items, x0, y, wmax = 254) => {
    const n = items.length;
    const gap = 5;
    const w = Math.floor((wmax - gap * (n - 1)) / n);
    items.forEach(([k, label], i) => {
      btn[k] = add(`<div class="bt" style="left:${x0 + i * (w + gap)}px;top:${y}px;width:${w}px;height:23px">${label}</div>`);
    });
  };
  add(`<div class="sm" style="position:absolute;left:1304px;top:436px;font-size:8px">PROGRAM</div>`);
  row([['bb1', 'BUSBAR 1'], ['bb2', 'BUSBAR 2'], ['earth', 'EARTH'], ['fault', 'FAULT']], 1304, 449);
  add(`<div class="sm" style="position:absolute;left:1304px;top:481px;font-size:8px">SINGLE DEVICE · INTERLOCKED</div>`);
  row(DEVICES.slice(0, 3).map(([d, to, l]) => [`${d}:${to}`, l]), 1304, 494);
  row(DEVICES.slice(3).map(([d, to, l]) => [`${d}:${to}`, l]), 1304, 522);
  add(`<div style="position:absolute;left:1304px;top:556px;width:254px;height:1px;background:${C.line}"></div>`);
  const lock = add(`<div class="mo" style="position:absolute;left:1304px;top:564px;width:254px;font-size:8.6px;letter-spacing:1px;line-height:13px;white-space:nowrap;overflow:hidden"></div>`);
  const btnRow = (keys, labels, x0, y, wmax = 254) => {
    let x = x0;
    let yy = y;
    for (const k of keys) {
      const w = Math.round(labels[k].length * 6.9 + 18);
      if (x + w > x0 + wmax) {
        x = x0;
        yy += 29;
      }
      btn[k] = add(`<div class="bt" style="left:${x}px;top:${yy}px;width:${w}px;height:23px">${labels[k]}</div>`);
      x += w + 5;
    }
  };
  panel(1290, 614, 282, 106, 'VIEWS', '05');
  btnRow(VIEWS, VIEW_LABEL, 1304, 648);
  panel(1290, 734, 282, 106, 'DISPLAY', '06');
  btnRow(DISPLAY, DISPLAY_LABEL, 1304, 768);

  // ------------------------------------------------------------ 07 procedure
  panel(430, 752, 740, 108, 'PROCEDURE', '07');
  btn.play = add(`<div class="bt" style="left:445px;top:795px;width:44px;height:44px;border-radius:50%;border:none;background:${C.acc};color:#fff;font-size:15px"></div>`);
  const pTitle = add(`<div class="mo" style="position:absolute;left:506px;top:789px;font-size:12px;font-weight:700;letter-spacing:1.6px;color:${C.acc};white-space:nowrap"></div>`);
  const pSub = add(`<div class="sm" style="position:absolute;left:506px;top:807px;width:420px;overflow:hidden;text-overflow:ellipsis"></div>`);
  const steps = add(`<div style="position:absolute;left:506px;top:827px;width:430px;height:22px"></div>`);
  const rate = add(`<div class="mo" style="position:absolute;left:960px;top:786px;width:196px;text-align:right;font-size:10px;font-weight:700;letter-spacing:1.4px"></div>`);
  const clock = add(`<div class="mo" style="position:absolute;left:960px;top:806px;width:196px;text-align:right;font-size:18px;font-weight:600;letter-spacing:.5px"></div>`);
  add(`<div class="sm" style="position:absolute;left:960px;top:832px;width:196px;text-align:right;font-size:8px">PROCEDURE CLOCK · REAL SECONDS</div>`);

  // ------------------------------------------------------------ footer and floor notes
  add(`<div class="sm" style="position:absolute;left:27px;top:882px;letter-spacing:2.2px">SWITCHGEAR STUDY &nbsp;·&nbsp; PROCEDURAL MODEL &nbsp;·&nbsp; ONE PROCEDURE CLOCK DRIVES EVERY PART</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:882px;letter-spacing:2.2px">BUILT FROM CATALOG HA 35.11 <span style="color:${C.acc}">//////</span></div>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:660px;line-height:16px;letter-spacing:2px">CIRCUIT-BREAKER PANEL<br>600 × 2350 × 2665 MM<br>POLES ONE BEHIND THE OTHER</div>`);
  add(`<svg style="position:absolute;left:42px;top:716px" width="120" height="40"><path d="M0 20h96" stroke="${C.mute}" stroke-width="1.2"/><path d="M96 16l8 4-8 4z" fill="${C.mute}"/></svg>`);
  add(`<div class="sm" style="position:absolute;left:42px;top:744px">OPERATING FRONT</div>`);
  add(`<svg style="position:absolute;left:330px;top:126px" width="80" height="70"><path d="M0 70V0h70" fill="none" stroke="${C.acc}" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/></svg>`);
  add(`<svg style="position:absolute;left:1190px;top:660px" width="80" height="80"><path d="M80 0v76H0" fill="none" stroke="${C.acc}" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/></svg>`);

  // ------------------------------------------------------------ labels, the pointer
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centre = (n) => {
    const r = n.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };
  const onBtn = (k, on, kind = 'fill') => {
    const b = btn[k];
    if (!b) return;
    b.style.background = on ? (kind === 'fill' ? C.acc : '#fff3ee') : '#fdfefd';
    b.style.color = on && kind === 'fill' ? '#fff' : C.ink;
    b.style.borderColor = on ? C.acc : C.faint;
  };
  let sldKey = '';
  let gasKey = '';

  return {
    spots,
    btn,
    root: ui,
    refuse(k) {
      const b = btn[k];
      if (!b) return;
      b.classList.remove('shake');
      void b.offsetWidth;
      b.classList.add('shake');
    },
    update(u) {
      const s = u.s;
      // -------------------------------------------------- state chip, single-line diagram
      const [title, sub] = u.step;
      chip.style.background = s.arc.some(Boolean) || s.faultOn ? C.acc : s.cable === 'live' ? C.acc : s.cable === 'earth' ? C.green : C.mute;
      stTitle.textContent = title;
      stSub.textContent = sub;
      const k = [s.q1.ang.toFixed(1), s.q2.ang.toFixed(1), s.touching, s.node, s.cable, s.arc.join()].join('|');
      if (k !== sldKey) {
        sldKey = k;
        sld.innerHTML = drawSLD(s);
      }
      // -------------------------------------------------- gas
      const gk = Math.round((u.ambient ?? 20) * 10);
      if (gk !== gasKey) {
        gasKey = gk;
        gasSvg.innerHTML = drawGas(u.ambient ?? 20, u.gas ?? 0);
      }
      // -------------------------------------------------- circuit-breaker chart and readouts
      chart.innerHTML = drawChart(s, u.events);
      const amp = (x) => (Math.abs(x) >= 1000 ? `${(x / 1000).toFixed(1)} kA` : `${Math.round(x)} A`);
      rd.innerHTML =
        `<div style="display:flex;gap:6px">${['L1', 'L2', 'L3']
          .map((l, p) => `<div style="flex:1"><div class="sm" style="font-size:8px">i ${l}</div><div class="mo" style="font-size:12.5px;font-weight:700;color:${s.arc[p] ? C.acc : C.ink}">${amp(s.i[p])}</div></div>`)
          .join('')}</div>` +
        `<div style="display:flex;gap:6px;margin-top:9px;align-items:flex-end">` +
        `<div style="flex:1"><div class="sm" style="font-size:8px">GAP</div><div class="mo" style="font-size:12.5px;font-weight:700">${(s.gap * 1000).toFixed(1)} mm</div></div>` +
        `<div style="flex:1.3"><div class="sm" style="font-size:8px">SPRING ${Math.round(s.spring * 100)} %</div><div style="margin-top:6px;height:4px;background:#e8ecea;border-radius:2px"><div style="height:4px;width:${(s.spring * 100).toFixed(1)}%;background:${s.spring >= 1 ? C.green : C.acc};border-radius:2px"></div></div></div>` +
        `<div style="flex:.8;text-align:right"><div class="sm" style="font-size:8px">OPS</div><div class="mo" style="font-size:12.5px;font-weight:700">${String(s.ops).padStart(5, '0')}</div></div></div>`;
      // -------------------------------------------------- buttons
      for (const p of PROGS) onBtn(p, u.prog === p);
      onBtn('fault', u.prog === 'fault', 'soft');
      for (const [d, to] of DEVICES) onBtn(`${d}:${to}`, d === 'q0' ? s.q0 === to : s[d].to === to, 'soft');
      for (const v of VIEW_KEYS) onBtn(v, u.view === v);
      for (const d of DISPLAY) onBtn(d, !!u.display[d]);
      lock.innerHTML = u.refusal ? `<span style="color:${C.acc}">✕ ${u.refusal}</span>` : `<span style="color:${C.mute}">INTERLOCKS ${s.q0 === 'closed' ? '· DISCONNECTORS LOCKED BY CB' : '· CB OPEN · GATE FREE'}</span>`;
      // -------------------------------------------------- procedure strip
      btn.play.innerHTML = u.paused ? '▶' : '❚❚';
      pTitle.textContent = title;
      pSub.textContent = sub;
      steps.innerHTML = drawSteps(u.progEvents ?? [], s.tau);
      const r = u.rate ?? 1;
      rate.innerHTML = r < 0.99 ? `<span style="color:${C.acc}">SLOW MOTION 1:${Math.round(1 / r)}</span>` : r > 1.01 ? `<span style="color:${C.blue}">FAST × ${r.toFixed(0)}</span>` : `<span style="color:${C.mute}">REAL TIME</span>`;
      clock.textContent = `τ ${s.tau.toFixed(r < 0.2 ? 4 : 2)} s`;
      // -------------------------------------------------- labels
      let lh = '';
      let ch = '';
      for (const c of u.callouts ?? []) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = lx > ax;
        const ex = right ? lx - 6 : lx + c.w + 6;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${(ly + 6).toFixed(1)}" fill="none" stroke="${C.acc}" stroke-width=".9" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.4" fill="${C.acc}" opacity="${c.o.toFixed(2)}"/>`;
        ch += `<div class="call" style="left:${lx.toFixed(1)}px;top:${(ly - 1).toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b><i></i>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(u.cursor);
    },
    pointer,
  };
}
const VIEW_KEYS = VIEWS;

// ------------------------------------------------------------ the single-line diagram (cat. p.29 mimic)
function drawSLD(s) {
  const fed = s.node === 'bb1' || s.node === 'bb2';
  const col = (m) => (m === 'live' ? C.acc : m === 'earth' ? C.green : C.ink);
  const cBB1 = s.node === 'bb1' ? 'live' : null;
  const cBB2 = s.node === 'bb2' ? 'live' : null;
  const cNode = fed ? 'live' : s.node === 'earth' ? 'earth' : null;
  const cCab = s.cable;
  const w = (m) => (m === 'live' || m === 'earth' ? 2.6 : 1.4);
  const L = (x1, y1, x2, y2, m) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col(m)}" stroke-width="${w(m)}" stroke-linecap="round"/>`;
  let h = '';
  h += T(2, 9, 'BB1') + T(2, 31, 'BB2');
  h += L(28, 12, 250, 12, cBB1) + L(28, 34, 250, 34, cBB2);
  // Q1: three-position, x 74; its blade from the pivot (74, 92) up toward the busbar contact (74, 52)
  const x1 = 74;
  const p1 = 92;
  h += L(x1, 12, x1, 50, cBB1) + `<circle cx="${x1}" cy="12" r="2.6" fill="${col(cBB1)}"/>`;
  const a1 = (s.q1.ang / Q1A.earth) * 62 * (Math.PI / 180);
  const q1m = s.q1.pos === 'closed' ? cNode : s.q1.pos === 'earth' ? 'earth' : cNode;
  h += L(x1, p1, x1 - Math.sin(a1) * 40, p1 - Math.cos(a1) * 40, q1m);
  // earthing contact of Q1 and the earth symbol
  h += L(38, 73, 50, 73, s.q1.pos === 'earth' ? 'earth' : null) + L(44, 73, 44, 82, s.q1.pos === 'earth' ? 'earth' : null);
  h += `<path d="M37 82h14M40 86h8M42.5 90h3" stroke="${col(s.q1.pos === 'earth' ? 'earth' : null)}" stroke-width="1.3"/>`;
  h += T(84, 64, 'Q1');
  // Q2 at x 168
  const x2 = 168;
  h += L(x2, 34, x2, 50, cBB2) + `<circle cx="${x2}" cy="34" r="2.6" fill="${col(cBB2)}"/>`;
  const k2 = (s.q2.ang - Q2A.closed) / (Q2A.open - Q2A.closed);
  const a2 = -k2 * 40 * (Math.PI / 180);
  h += L(x2, p1, x2 - Math.sin(a2) * 40, p1 - Math.cos(a2) * 40, s.q2.pos === 'closed' ? cNode : cNode === 'live' && s.q2.pos !== 'closed' ? 'live' : cNode);
  h += T(178, 64, 'Q2');
  // the node between the disconnectors and the CB
  h += L(x1, p1, x2, p1, cNode) + `<circle cx="${x1}" cy="${p1}" r="2.6" fill="${col(cNode)}"/><circle cx="${x2}" cy="${p1}" r="2.6" fill="${col(cNode)}"/>`;
  // the CB: a square with its contact
  h += L(x1, p1, x1, 108, cNode);
  h += `<rect x="${x1 - 9}" y="108" width="18" height="24" fill="none" stroke="${C.ink}" stroke-width="1.2"/>`;
  const arcing = s.arc.some(Boolean);
  h += s.touching || arcing ? L(x1, 108, x1, 132, arcing ? 'live' : s.cable) : `<line x1="${x1}" y1="132" x2="${x1 - 10}" y2="111" stroke="${C.ink}" stroke-width="1.4"/>`;
  if (arcing) h += `<circle cx="${x1}" cy="120" r="6" fill="${C.acc}" opacity=".35"/>`;
  h += T(86, 124, 'Q0');
  // current transformer, cable, voltage detection
  h += L(x1, 132, x1, 186, cCab);
  h += `<circle cx="${x1}" cy="150" r="7" fill="none" stroke="${C.ink}" stroke-width="1.2"/><circle cx="${x1}" cy="160" r="7" fill="none" stroke="${C.ink}" stroke-width="1.2"/>`;
  h += T(86, 158, 'T1 · CT');
  h += `<path d="M${x1 - 7} 186h14l-7 12z" fill="${col(cCab)}"/>`;
  h += T(86, 194, 'CABLE');
  h += `<circle cx="214" cy="172" r="7" fill="${s.cable === 'live' ? '#ffcf6a' : '#e3e7e5'}" stroke="${C.ink}" stroke-width="1"/>` + T(196, 194, 'VDS');
  h += `<line x1="${x1}" y1="172" x2="207" y2="172" stroke="${C.faint}" stroke-width="1" stroke-dasharray="2 2"/>`;
  return h;
}

// ------------------------------------------------------------ the nine manometers
function drawGas(T0, tint) {
  let h = '';
  COMPARTMENTS.forEach((c, i) => {
    const cx = 30 + (i % 3) * 86;
    const cy = 22 + Math.floor(i / 3) * 42;
    const p = gasAt(T0);
    const ang = (kpa) => Math.PI * 0.8 + (kpa / 250) * Math.PI * 1.4;
    const arc = (a, b, col, r = 14) => {
      const x0 = cx + Math.cos(ang(a)) * r;
      const y0 = cy + Math.sin(ang(a)) * r;
      const x1 = cx + Math.cos(ang(b)) * r;
      const y1 = cy + Math.sin(ang(b)) * r;
      return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${ang(b) - ang(a) > Math.PI ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${col}" stroke-width="3"/>`;
    };
    h += arc(0, GAS.low, '#e4a99d') + arc(GAS.low, GAS.high, '#7fc49a') + arc(GAS.high, 250, '#e4a99d');
    h += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(ang(p)) * 12).toFixed(1)}" y2="${(cy + Math.sin(ang(p)) * 12).toFixed(1)}" stroke="${C.ink}" stroke-width="1.6"/><circle cx="${cx}" cy="${cy}" r="2" fill="${C.ink}"/>`;
    h += `<text x="${cx + 20}" y="${cy - 2}" font-family="JetBrains Mono" font-size="8.5" font-weight="700" fill="${C.ink}">${c.id}</text>`;
    h += `<text x="${cx + 20}" y="${cy + 9}" font-family="JetBrains Mono" font-size="8" fill="${C.mute}">${p.toFixed(0)} kPa</text>`;
  });
  void tint;
  return h;
}

// ------------------------------------------------------------ the circuit-breaker chart
function drawChart(s, events = []) {
  const W = 254;
  const tau = s.tau;
  // the latest breaker command or fault within the last 0.4 s sets a fixed window; otherwise the last 60 ms roll
  const ev = events.filter((e) => (e.dev === 'q0' || e.dev === 'fault') && e.at <= tau && tau - e.at < 0.4).pop();
  const f = s.fault && tau - s.fault.at < 0.45 && tau >= s.fault.at ? s.fault : null;
  let a;
  let b;
  const useF = f && (!ev || ev.cause);
  if (useF) {
    a = f.at - 0.005;
    b = f.at + 0.11;
  } else if (ev) {
    a = ev.at - 0.008;
    b = ev.at + 0.1;
  } else {
    a = tau - 0.06;
    b = tau;
  }
  const big = !!f;
  const scale = big ? 110000 : 2600;
  const X = (x) => 4 + ((x - a) / (b - a)) * (W - 8);
  const top = 6;
  const mid = 50;
  const amp = 42;
  const Y = (i) => mid - (i / scale) * amp;
  const gapTop = 104;
  const gapH = 26;
  const G = (g) => gapTop + gapH - (g / CB.stroke) * gapH;
  const end = Math.min(tau, b);
  const N = 150;
  const pts = [[], [], []];
  const gp = [];
  const arcs = [];
  const evs = events.filter((e) => e.at <= end + 1e-9);
  for (let j = 0; j <= N; j++) {
    const x = a + ((end - a) * j) / N;
    if (x < a) continue;
    const st = stateAt(evs, x);
    for (let p = 0; p < 3; p++) pts[p].push(`${X(x).toFixed(1)},${Y(st.i[p]).toFixed(1)}`);
    gp.push(`${X(x).toFixed(1)},${G(Math.min(st.gap, CB.stroke * 1.1)).toFixed(1)}`);
    if (st.arc.some(Boolean)) arcs.push(X(x));
  }
  let h = `<rect x="0" y="0" width="${W}" height="${gapTop + gapH + 4}" fill="#f6f8f7" rx="3"/>`;
  h += `<line x1="4" x2="${W - 4}" y1="${mid}" y2="${mid}" stroke="${C.faint}" stroke-width="1"/>`;
  for (const v of [-1, 1]) h += `<line x1="4" x2="${W - 4}" y1="${Y((v * scale) / 1.1)}" y2="${Y((v * scale) / 1.1)}" stroke="${C.line}" stroke-width="1" stroke-dasharray="2 3"/>`;
  h += T(6, top + 6, big ? '±100 kA' : '±2.4 kA');
  if (arcs.length) h += `<rect x="${Math.min(...arcs).toFixed(1)}" y="${top}" width="${Math.max(2, Math.max(...arcs) - Math.min(...arcs)).toFixed(1)}" height="${gapTop + gapH - top}" fill="${C.acc}" opacity=".13"/>`;
  const PC = [C.acc, C.ink, '#9aa3a7'];
  for (let p = 2; p >= 0; p--) h += `<polyline points="${pts[p].join(' ')}" fill="none" stroke="${PC[p]}" stroke-width="${p === 0 ? 1.5 : 1.1}"/>`;
  h += `<line x1="4" x2="${W - 4}" y1="${gapTop - 4}" y2="${gapTop - 4}" stroke="${C.line}" stroke-width="1"/>`;
  h += `<polyline points="${gp.join(' ')}" fill="none" stroke="${C.blue}" stroke-width="1.5"/>`;
  h += T(6, gapTop + 6, 'CONTACT GAP 0–20 mm');
  // the times read off the model
  if (f) {
    const mark = (x, label, y) => (x >= a && x <= end ? `<line x1="${X(x)}" x2="${X(x)}" y1="${top}" y2="${gapTop + gapH}" stroke="${C.ink}" stroke-width=".8" stroke-dasharray="2 2"/>` + T(Math.min(W - 60, X(x) + 3), y, label, `fill="${C.ink}"`) : '');
    h += mark(f.trip, `TRIP ${((f.trip - f.at) * 1000).toFixed(0)} ms`, 16);
    h += mark(f.sep, `OPEN ${((f.sep - f.trip) * 1000).toFixed(0)} ms`, 26);
    h += mark(f.ext, `CLEAR · ARC ${((f.ext - f.sep) * 1000).toFixed(1)} ms`, 92);
  }
  if (tau <= b) h += `<line x1="${X(end)}" x2="${X(end)}" y1="${top}" y2="${gapTop + gapH}" stroke="${C.acc}" stroke-width="1"/>`;
  // legend and the axis
  h += `<g font-family="JetBrains Mono" font-size="7.4" letter-spacing="1">` + ['L1', 'L2', 'L3'].map((l, p) => `<rect x="${156 + p * 32}" y="${top + 1}" width="8" height="2.4" fill="${PC[p]}"/><text x="${167 + p * 32}" y="${top + 5}" fill="${C.mute}">${l}</text>`).join('') + `</g>`;
  const rel = useF ? f : ev;
  h += T(4, gapTop + gapH + 14, rel ? `t = 0 AT ${rel.dev === 'fault' ? 'FAULT INCEPTION' : rel.to === 'closed' ? 'CLOSE COMMAND' : 'OPEN COMMAND'}` : 'LAST 60 ms · 50 Hz');
  h += T(W - 4, gapTop + gapH + 14, `${((b - a) * 1000).toFixed(0)} ms`, 'text-anchor="end"');
  return h;
}

// ------------------------------------------------------------ the program's steps
const STEP_NAME = (e) =>
  e.dev === 'fault' ? 'FAULT' : e.dev === 'q0' ? (e.cause === 'protection' ? 'TRIP' : e.cause === 'auto-reclose' ? 'RECLOSE' : e.to === 'closed' ? 'CB ON' : 'CB OFF') : `${e.dev.toUpperCase()} ${e.to === 'earth' ? 'EARTH' : e.to === 'closed' ? 'CLOSE' : 'OPEN'}`;
function drawSteps(events, tau) {
  if (!events.length) return '';
  const done = (e) => tau >= e.at + (e.dev === 'q1' || e.dev === 'q2' ? DISC_T : e.dev === 'q0' ? (e.to === 'closed' ? CB.closeT : CB.openT) : 0);
  let cur = events.findIndex((e) => !done(e));
  let h = '<div style="display:flex;gap:5px;align-items:center">';
  events.forEach((e, i) => {
    const d = done(e);
    const on = i === cur;
    h += `<div class="mo" style="font-size:8.4px;font-weight:700;letter-spacing:1px;padding:3px 6px;border-radius:3px;white-space:nowrap;border:1px solid ${on ? C.acc : C.faint};background:${d ? '#eef2f0' : on ? '#fff3ee' : '#fff'};color:${d ? C.mute : on ? C.acc : C.ink}">${d ? '✓ ' : ''}${STEP_NAME(e)}</div>`;
  });
  return h + '</div>';
}
void R;
