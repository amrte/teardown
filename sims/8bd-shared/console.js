// The 8BD1 console, laid out at 1600 x 900: the title, the panel state with a live side schematic, the readouts, the
// procedure checklist, the interlocks (what the operator may do now and which condition of section 111 forbids the
// rest), views, display, isolate, the panel data and the procedure transport at the bottom. update(s) redraws every
// live part from the frame's state; nothing here computes a number of its own.
import {ACTIONS, FASTENERS, MANUAL, N, P, STEPS, fastStatus} from './kin.js';

export const C = {ink: '#23272a', mute: '#8a9094', faint: '#d3d8d8', line: '#e2e6e5', panel: 'rgba(250,251,250,.95)', or: '#e3562a', green: '#2f9a64', red: '#c8402f', blue: '#3c79a8'};
export const VIEWS = ['hero', 'front', 'side', 'iso', 'open', 'top', 'truck', 'mech', 'rear'];
export const VIEW_LABEL = {hero: 'HERO', front: 'FRONT', side: 'SIDE CUT', iso: 'AISLE', open: 'OPEN ¾', top: 'ROOF', truck: 'TRUCK', mech: 'MECHANISM', rear: 'REAR', shaft: 'SHAFT 51', plug: 'LV PLUG', boxes: 'PARTITIONS', earth: 'EARTHING', poles: 'POLES', busbars: 'BUSBARS'};
export const DISPLAY = ['labels', 'section', 'xray', 'follow', 'orbit', 'screws'];
export const DISPLAY_LABEL = {labels: 'LABELS', section: 'SECTION', xray: 'X-RAY', follow: 'FOLLOW STEP', orbit: 'ORBIT', screws: 'FASTENERS'};
const FC = {torque: '#2f9a64', size: '#d9952b', none: '#4d79a8'};
export const ISO = ['all', 'truck', 'poles', 'mech', 'bus', 'cable', 'locks', 'lv'];
export const ISO_LABEL = {all: 'ALL', truck: 'TRUCK', poles: 'POLES + ARMS', mech: 'MECHANISM', bus: 'BUSBARS', cable: 'CABLE COMP.', locks: 'INTERLOCKS', lv: 'LV COMP.'};

const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,monospace}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 2px 10px rgba(40,60,60,.07)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.or}}
.pn{position:absolute;font:500 9.5px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.5px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.bt{position:absolute;height:21px;padding:0 9px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fff;font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.1px;color:${C.ink};white-space:nowrap;pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.96)}
.rw{position:absolute;display:flex;align-items:center;justify-content:space-between}
.pill{font:700 8.2px 'JetBrains Mono',monospace;letter-spacing:1px;padding:2px 6px;border-radius:3px;color:#fff;white-space:nowrap}
.stp{position:absolute;display:flex;gap:5px;align-items:baseline;font:500 9.6px Inter,sans-serif;letter-spacing:0;color:${C.mute};white-space:nowrap;pointer-events:auto;cursor:pointer;overflow:hidden}
.stp b{font:700 9px 'JetBrains Mono',monospace;color:${C.faint};width:17px;flex:none}
.stp.done{color:${C.ink}}
.stp.done b{color:${C.green}}
.stp.cur{color:${C.or};font-weight:700}
.stp.cur b{color:${C.or}}
.call{position:absolute;white-space:nowrap}
.call b{display:flex;align-items:center;gap:6px;font:700 9.4px 'JetBrains Mono',monospace;letter-spacing:1.1px;color:${C.ink}}
.call b i{display:block;width:6px;height:6px;background:${C.or}}
.call b em{font-style:normal;color:${C.or}}
.call span{display:block;font:500 7.8px 'JetBrains Mono',monospace;letter-spacing:1px;color:${C.mute};margin-top:2px}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const POS = {service: ['SERVICE POSITION', 'run-in contacts on the fixed contacts'], between: ['TRUCK MOVING', 'between Service and Test position'], test: ['TEST POSITION', 'isolating distance · LV plug in'], isolated: ['ISOLATED POSITION', 'isolating distance · LV plug out'], withdrawn: ['TRUCK WITHDRAWN', 'out of the panel on its rollers']};

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
  const btn = {};

  // ------------------------------------------------------------ header
  add(`<div style="position:absolute;left:0;top:0;width:160px;height:89px;background:${C.or}"></div>`);
  add(`<svg style="position:absolute;left:24px;top:24px" width="40" height="42"><g fill="none" stroke="#fff" stroke-width="2.4"><rect x="2" y="2" width="36" height="38" rx="2"/><path d="M2 15h36M20 15v25M8 24h6M8 30h6"/></g></svg>`);
  add(`<div class="mo" style="position:absolute;left:76px;top:34px;color:#fff;font-size:15px;font-weight:700;letter-spacing:3px">8BD1</div>`);
  add(`<div class="sm" style="position:absolute;left:182px;top:21px;letter-spacing:2.4px">METAL-ENCLOSED TRUCK-TYPE SWITCHBOARD · UP TO 24 KV</div>`);
  add(`<div style="position:absolute;left:181px;top:36px;font-size:32px;font-weight:700;letter-spacing:-.6px;line-height:1">8BD1 feeder panel <span style="color:${C.or};font-weight:400">/</span> teardown</div>`);
  add(`<div class="mo" style="position:absolute;left:182px;top:75px;font-size:11px;letter-spacing:2px;color:#5e666b">TRUCK WITH V BREAKER 3AF · 12 KV LIST 2 · 1250 A</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:30px;text-align:right;line-height:15px;letter-spacing:2px">PER OPERATING INSTRUCTIONS<br><span style="color:${C.ink};font-weight:700">${MANUAL.order} · ${MANUAL.issue}</span><br>EVERY STEP CITES ITS PAGE</div>`);

  // ------------------------------------------------------------ 01 state with the side schematic
  panel(28, 106, 282, 236, 'PANEL STATE', '01');
  const chip = add(`<div style="position:absolute;left:42px;top:144px;width:12px;height:24px;border-radius:2px"></div>`);
  const stTitle = add(`<div style="position:absolute;left:64px;top:142px;font-size:15px;font-weight:700"></div>`);
  const stSub = add(`<div class="sm" style="position:absolute;left:65px;top:161px;letter-spacing:1px"></div>`);
  add(`<div style="position:absolute;left:42px;top:180px;width:254px;height:1px;background:${C.line}"></div>`);
  const sch = add(`<svg style="position:absolute;left:42px;top:188px" width="254" height="146"></svg>`);

  // ------------------------------------------------------------ 02 readouts
  panel(28, 354, 282, 204, 'READOUTS', '02');
  const RD = ['TRAVEL', 'SHAFT 51', 'BREAKER', 'CLOSING SPRING', 'COUNTER 339.59', 'SHUTTERS', 'LV PLUG 593', 'EARTHING SW.'];
  const rd = RD.map((n, i) => {
    const y = 388 + i * 20.5;
    add(`<div class="sm" style="position:absolute;left:42px;top:${y}px">${n}</div>`);
    return add(`<div class="mo" style="position:absolute;right:${1600 - 296}px;top:${y - 2}px;font-size:10.5px;font-weight:700;text-align:right"></div>`);
  });
  const travelBar = add(`<div style="position:absolute;left:104px;top:392px;height:3px;background:${C.or};border-radius:2px"></div>`);
  add(`<div style="position:absolute;left:104px;top:392px;width:110px;height:3px;background:#e6ebea;border-radius:2px;z-index:-1"></div>`);

  // ------------------------------------------------------------ 03 procedure checklist
  panel(28, 570, 282, 290, 'PROCEDURE', '03');
  const stepEls = STEPS.map((s, i) => {
    const col = i < 12 ? 0 : 1;
    const row = i < 12 ? i : i - 12;
    const n = add(`<div class="stp" style="left:${42 + col * 135}px;top:${604 + row * 20.8}px;width:130px"><b>${String(i + 1).padStart(2, '0')}</b>${s.t}</div>`);
    btn[`step${i}`] = n;
    return n;
  });

  // ------------------------------------------------------------ 03b fasteners (shown over the checklist in fastener mode)
  const fastPanel = add(`<div style="position:absolute;left:28px;top:570px;width:282px;height:290px;display:none"></div>`);
  fastPanel.innerHTML = `<div class="cp" style="left:0;top:0;width:282px;height:290px"></div>
    <div class="ph" style="left:14px;top:13px"><i></i>FASTENERS</div><div class="pn" data-n style="right:14px;top:15px"></div>
    <div style="position:absolute;left:14px;top:36px;display:flex;gap:10px" class="sm">${Object.entries({torque: 'TORQUE GIVEN', size: 'SIZE ONLY', none: 'NOT GIVEN'}).map(([k, n]) => `<span style="display:flex;align-items:center;gap:4px"><i style="display:block;width:7px;height:7px;border-radius:50%;background:${FC[k]}"></i>${n}</span>`).join('')}</div>
    <div data-rows style="position:absolute;left:14px;top:56px;width:254px"></div>
    <div style="position:absolute;left:14px;top:244px;width:254px;font-size:8.6px;line-height:11.5px;color:${C.mute}">The manual's only tightening torque is 70 Nm, for the M12 busbar and earth-bar joints (201/11). Values it does not give are left blank, not filled in.</div>`;
  const fastRows = fastPanel.querySelector('[data-rows]');
  const fastNum = fastPanel.querySelector('[data-n]');
  let fastKey = '';

  // ------------------------------------------------------------ 04 interlocks
  panel(1290, 106, 282, 346, 'INTERLOCKS · 111', '04');
  add(`<div class="sm" style="position:absolute;left:1304px;top:136px">THE OPERATOR MAY NOW</div>`);
  const acts = ACTIONS.map(([k, name], i) => {
    const y = 154 + i * 19.5;
    add(`<div class="mo" style="position:absolute;left:1304px;top:${y}px;font-size:9.6px;font-weight:600">${name}</div>`);
    const p = add(`<div class="pill" style="position:absolute;right:${1600 - 1558}px;top:${y - 1}px"></div>`);
    return {k, p};
  });
  add(`<div style="position:absolute;left:1304px;top:296px;width:254px;height:1px;background:${C.line}"></div>`);
  const condHead = add(`<div class="sm" style="position:absolute;left:1304px;top:304px"></div>`);
  const condBox = add(`<div style="position:absolute;left:1304px;top:322px;width:254px;height:124px"></div>`);

  // ------------------------------------------------------------ 05 views, 06 display, 07 isolate
  const row = (keys, labels, x0, y, prefix = '', wmax = 254) => {
    let x = x0;
    let yy = y;
    for (const k of keys) {
      const w = Math.round(labels[k].length * 6.5 + 20);
      if (x + w > x0 + wmax) {
        x = x0;
        yy += 27;
      }
      btn[prefix + k] = add(`<div class="bt" style="left:${x}px;top:${yy}px;width:${w}px">${labels[k]}</div>`);
      x += w + 5;
    }
  };
  panel(1290, 464, 282, 120, 'VIEWS', '05');
  row(VIEWS, VIEW_LABEL, 1304, 498);
  panel(1290, 596, 282, 92, 'DISPLAY', '06');
  row(DISPLAY, DISPLAY_LABEL, 1304, 630);
  panel(1290, 700, 282, 120, 'ISOLATE', '07');
  row(ISO, ISO_LABEL, 1304, 734, 'iso_');
  add(`<div class="sm" style="position:absolute;left:1291px;top:836px;width:282px;line-height:13px;letter-spacing:1px;white-space:normal;text-transform:none">Panel ${Math.round(P.width * 1000)} × ${Math.round(P.depth * 1000)} mm (200/3) · track ${Math.round(P.track * 1000)} mm (200/1) · arms ${P.armUp.map((v) => Math.round(v * 1000)).join(' / ')} and ${Math.round(P.armLow * 1000)} mm (203/2)</div>`);

  // ------------------------------------------------------------ 08 step transport
  panel(330, 744, 940, 116, 'STEP', '08');
  const sNum = add(`<div class="mo" style="position:absolute;left:390px;top:757px;font-size:10px;font-weight:700;letter-spacing:1.6px;color:${C.mute}"></div>`);
  const sTitle = add(`<div style="position:absolute;left:344px;top:776px;font-size:17px;font-weight:700;white-space:nowrap"></div>`);
  const sRef = add(`<div class="pill" style="position:absolute;top:779px;background:${C.ink}"></div>`);
  const sSay = add(`<div style="position:absolute;left:344px;top:800px;width:640px;font-size:10.6px;line-height:14.5px;color:#454c50"></div>`);
  btn.prev = add(`<div class="bt" style="left:1000px;top:772px;width:36px;height:30px;font-size:12px">◀◀</div>`);
  btn.play = add(`<div class="bt" style="left:1042px;top:766px;width:42px;height:42px;border-radius:50%;border:none;background:${C.or};color:#fff;font-size:14px"></div>`);
  btn.next = add(`<div class="bt" style="left:1090px;top:772px;width:36px;height:30px;font-size:12px">▶▶</div>`);
  add(`<div class="sm" style="position:absolute;left:1140px;top:770px">SPEED</div>`);
  const SP = {x: 1142, w: 110};
  add(`<div style="position:absolute;left:${SP.x}px;top:790px;width:${SP.w}px;height:3px;background:#e6ebea;border-radius:2px"></div>`);
  const spFill = add(`<div style="position:absolute;left:${SP.x}px;top:790px;height:3px;background:${C.or};border-radius:2px"></div>`);
  const spKnob = add(`<div style="position:absolute;top:784px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
  const spVal = add(`<div class="mo" style="position:absolute;left:1200px;top:768px;font-size:9.6px;font-weight:700"></div>`);
  const TL = {x: 1000, w: 252};
  add(`<div style="position:absolute;left:${TL.x}px;top:833px;width:${TL.w}px;height:3px;background:#e6ebea;border-radius:2px"></div>`);
  {
    let h = '';
    for (let i = 0; i <= N; i++) h += `<line x1="${((i / N) * TL.w).toFixed(1)}" x2="${((i / N) * TL.w).toFixed(1)}" y1="0" y2="5" stroke="${C.faint}" stroke-width="1"/>`;
    add(`<svg style="position:absolute;left:${TL.x}px;top:838px;overflow:visible" width="${TL.w}" height="6">${h}</svg>`);
  }
  const tlFill = add(`<div style="position:absolute;left:${TL.x}px;top:833px;height:3px;background:${C.or};border-radius:2px"></div>`);
  const tlKnob = add(`<div style="position:absolute;top:827px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
  const tlTxt = add(`<div class="sm" style="position:absolute;left:1000px;top:813px"></div>`);

  // ------------------------------------------------------------ footer, labels
  add(`<div class="sm" style="position:absolute;left:27px;top:880px;letter-spacing:2px">MECHANISM STUDY · PROCEDURAL MODEL · ONE INPUT: THE PROCEDURE STEP</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:880px;letter-spacing:2px">DRAG ORBIT · WHEEL ZOOM · SPACE PLAY · ← → STEP <span style="color:${C.or}">//////</span></div>`);
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);

  // ------------------------------------------------------------ the side schematic: the panel as manual fig 2 (front right)
  const schematic = (s) => {
    const k = 120 / P.depth; // px per metre, panel depth across 120 px... scaled so the withdrawn truck fits
    const X0 = 8; // rear of the panel
    const Y0 = 128; // floor
    const ky = k * 0.58;
    const zx = (z) => X0 + (z + P.depth / 2) * k;
    const yy = (y) => Y0 - y * ky;
    let h = '';
    const ln = (x1, y1, x2, y2, c = C.ink, w = 1) => (h += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="${w}"/>`);
    const rect = (x, y, w, hh, f, c = C.ink, sw = 1) => (h += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" fill="${f}" stroke="${c}" stroke-width="${sw}"/>`);
    // floor, cubicle body, LV box, compartments
    ln(0, Y0, 254, Y0, C.mute, 1);
    rect(zx(-P.depth / 2), yy(P.body), P.depth * k, P.body * ky, '#f4f5f3');
    rect(zx(P.zf - P.lvD), yy(P.body + P.lvH), P.lvD * k, P.lvH * ky, '#eceeec');
    const pL = 1 - s.partL;
    const pU = 1 - s.partU;
    if (pU > 0.5) ln(zx(P.zp), yy(P.joint), zx(P.zp), yy(P.partTop), C.ink, 2);
    if (pL > 0.5) ln(zx(P.zp), yy(P.partBot), zx(P.zp), yy(P.joint), C.ink, 2);
    ln(zx(-P.depth / 2), yy(P.busFloor), zx(P.zp), yy(P.busFloor), C.mute, 1);
    // busbars (three heights), fixed contacts
    if (s.bus < 0.5) P.armUp.forEach((y) => h += `<circle cx="${zx(P.zf - P.zBus).toFixed(1)}" cy="${yy(y).toFixed(1)}" r="2.6" fill="${C.or}"/>`);
    if (s.ct < 0.5) {
      rect(zx(P.zf - P.zCT - P.ctD / 2), yy(P.ctTopY), P.ctD * k, P.ctH * ky, '#d9cfc7', C.mute);
      // earthing switch knife
      const a = s.earth;
      const ex = zx(P.zf - P.esZ);
      const ey = yy(P.esY);
      const ang = 2.52 + (0.918 - 2.52) * a;
      h += `<line x1="${ex}" y1="${ey}" x2="${(ex + Math.sin(ang) * P.knife * k).toFixed(1)}" y2="${(ey - Math.cos(ang) * P.knife * ky).toFixed(1)}" stroke="${a > 0.5 ? C.or : C.ink}" stroke-width="2"/>`;
    }
    // shutters at the partition mouths
    const shut = (y, open) => ln(zx(P.zp) - 2, yy(y) - 5, zx(P.zp) - 2 - open * 5, yy(y) - 5 + (1 - open) * 10, open > 0.5 ? C.green : C.or, 1.6);
    if (pU > 0.5) shut(P.armUp[1], s.shutU);
    if (pL > 0.5) shut(P.armLow, s.shutL);
    // the truck: front plate, frame, poles, arms
    const tz = s.travel;
    const fr = s.front;
    if (fr < 0.5) rect(zx(P.zf + tz) - 3, yy(P.body - 0.015 + s.lift), 3, (P.body - 0.03) * ky, C.or, C.or);
    rect(zx(0 + tz), yy(0.1), (P.zf - 0.035) * k, 0.012 * k, '#999', '#999');
    for (const z of [0.06, P.zf - 0.115]) h += `<circle cx="${zx(z + tz).toFixed(1)}" cy="${(Y0 - 3).toFixed(1)}" r="3" fill="none" stroke="${C.ink}"/>`;
    if (s.poles < 0.5) rect(zx(0.19 + tz), yy(0.99), 0.09 * k, 0.41 * ky, s.brkOn ? C.or : '#fff', C.ink);
    if (s.armsU < 0.5) ln(zx(0.18 + tz), yy(P.armUp[1]), zx(P.zc - 0.03 + tz), yy(P.armUp[1]), C.ink, 2.2);
    if (s.armsL < 0.5) ln(zx(0.18 + tz), yy(P.armLow), zx(P.zc - 0.03 + tz), yy(P.armLow), C.ink, 2.2);
    // the travel scale: S / T / out
    for (const [z, n] of [[0, 'S'], [P.testTravel, 'T'], [P.outTravel, 'OUT']]) {
      const x = zx(P.zf + z);
      ln(x, Y0 + 1, x, Y0 + 4, C.mute);
      h += `<text x="${x.toFixed(1)}" y="${Y0 + 12}" text-anchor="middle" font-size="7" font-family="JetBrains Mono" fill="${C.mute}">${n}</text>`;
    }
    sch.innerHTML = h;
  };

  return {
    root: ui,
    btn,
    TL,
    SP,
    stepEls,
    update(s, view) {
      const [t, sub] = POS[s.pos];
      chip.style.background = s.pos === 'service' ? (s.brkOn ? C.red : C.green) : s.pos === 'withdrawn' ? C.blue : C.or;
      stTitle.textContent = t;
      stSub.textContent = s.pos === 'service' && s.brkOn ? 'breaker ON · feeder energised' : sub;
      schematic(s);
      // readouts
      const vals = [
        `${s.travelMM} mm`,
        ['OUT', 'IN', 'LOCKED'][Math.round(s.shaft)],
        s.brkOn ? 'ON  "I"' : 'OFF "O"',
        s.springCharged ? 'CHARGED' : 'DISCHARGED',
        String(s.closings).padStart(5, '0'),
        s.partU > 0.5 && s.partL > 0.5 ? 'REMOVED' : `${Math.round(Math.max(s.shutU, s.shutL) * 100)} % OPEN`,
        s.plugIn ? 'IN SOCKET' : 'ON TRUCK',
        s.earthOn ? 'ON · EARTHED' : 'OFF',
      ];
      rd.forEach((n, i) => {
        n.textContent = vals[i];
        n.style.color = (i === 2 && s.brkOn) || (i === 7 && s.earthOn) ? C.or : C.ink;
      });
      travelBar.style.width = `${(Math.min(1, s.travel / P.outTravel) * 110).toFixed(1)}px`;
      // checklist
      stepEls.forEach((n, i) => {
        n.className = 'stp' + (i < s.step || (i === s.step && s.k >= 0.999) ? ' done' : '') + (i === s.step ? ' cur' : '');
      });
      // fasteners of this step
      fastPanel.style.display = view.display.screws ? 'block' : 'none';
      for (const n of stepEls) n.style.visibility = view.display.screws ? 'hidden' : 'visible';
      if (view.display.screws) {
        const here = FASTENERS.filter((f) => f.step === STEPS[s.step].id);
        const k = `${s.step}`;
        if (k !== fastKey) {
          fastKey = k;
          fastNum.textContent = `STEP ${String(s.step + 1).padStart(2, '0')}`;
          const nextI = STEPS.findIndex((st, i) => i > s.step && FASTENERS.some((f) => f.step === st.id));
          fastRows.innerHTML = here.length
            ? here
                .slice(0, 6)
                .map((f) => {
                  const stt = fastStatus(f);
                  const tq = f.torque ? `${f.torque} Nm` : 'NOT GIVEN';
                  return `<div style="display:flex;gap:7px;margin-bottom:5px;align-items:flex-start"><i style="display:block;flex:none;width:7px;height:7px;margin-top:3px;border-radius:50%;background:${FC[stt]}"></i><div style="flex:1;min-width:0"><div style="display:flex;justify-content:space-between;gap:6px"><span style="font-size:9.8px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="mo" style="color:${C.or};font-size:8.6px">${f.id}</span> ${f.name}</span><span class="pill" style="background:${f.torque ? FC.torque : '#9aa1a5'}">${tq}</span></div><div class="mo" style="font-size:7.8px;line-height:10.5px;color:${C.mute};margin-top:1px">${f.size || 'size not given'}${f.cls ? ' · ' + f.cls : ''} · ${f.count} · ${f.ref}${f.note ? '<br>' + f.note : ''}</div></div></div>`;
                })
                .join('')
            : `<div style="font-size:10px;line-height:14px;color:#454c50">No fasteners are undone in this step.${nextI >= 0 ? `<br><span class="sm" style="letter-spacing:1px">NEXT: STEP ${String(nextI + 1).padStart(2, '0')} · ${STEPS[nextI].t.toUpperCase()}</span>` : ''}</div>`;
        }
      }
      // interlocks: actions, then the conditions in force at this position
      for (const {k, p} of acts) {
        const a = s.il.act[k];
        p.textContent = a.ok ? 'ALLOWED' : `BLOCKED${a.cond ? ' · ' + a.cond.toUpperCase() : ''}`;
        p.style.background = a.ok ? C.green : '#9aa1a5';
      }
      const active = s.il.conds.filter((c) => c.active);
      condHead.textContent = active.length ? `CONDITIONS IN FORCE · ${s.pos.toUpperCase()}` : 'NO TRUCK IN THE PANEL';
      condBox.innerHTML = active
        .slice(0, 4)
        .map((c) => `<div style="display:flex;gap:7px;margin-bottom:6px"><span class="mo" style="font-size:9px;font-weight:700;color:${C.or};width:16px;flex:none">${String(c.n).padStart(2, '0')}</span><span style="font-size:9.6px;line-height:12px;width:228px">${c.t}<br><span class="mo" style="font-size:8px;color:${C.mute}">${c.how} · ${c.ref}</span></span></div>`)
        .join('');
      // buttons
      const onBtn = (b, on) => {
        b.style.background = on ? C.or : '#fff';
        b.style.color = on ? '#fff' : C.ink;
        b.style.borderColor = on ? C.or : C.faint;
      };
      for (const v of VIEWS) onBtn(btn[v], view.view === v);
      for (const d of DISPLAY) onBtn(btn[d], !!view.display[d]);
      for (const i of ['all', ...ISO.slice(1)]) onBtn(btn['iso_' + i], (view.iso || 'all') === i);
      // the step
      const st = STEPS[s.step];
      sNum.textContent = `${String(s.step + 1).padStart(2, '0')} / ${N}`;
      sTitle.textContent = st.t;
      sRef.textContent = `MANUAL ${st.ref}`;
      sRef.style.left = `${350 + sTitle.offsetWidth}px`;
      sSay.textContent = st.say;
      btn.play.innerHTML = view.playing ? '❚❚' : '▶';
      const kx = (s.p / N) * TL.w;
      tlFill.style.width = `${kx.toFixed(1)}px`;
      tlKnob.style.left = `${(TL.x + kx).toFixed(1)}px`;
      tlTxt.textContent = `PROCEDURE ${(s.p).toFixed(2)} / ${N}`;
      const sk = view.speedK * SP.w;
      spFill.style.width = `${sk.toFixed(1)}px`;
      spKnob.style.left = `${(SP.x + sk).toFixed(1)}px`;
      spVal.textContent = `${view.speed.toFixed(1)}×`;
      // labels with leaders
      let lh = '';
      let ch = '';
      for (const c of view.callouts) {
        if (c.o < 0.02) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = lx > ax;
        const ex = right ? lx - 6 : lx + c.w + 6;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${(ly + 6).toFixed(1)}" fill="none" stroke="${C.or}" stroke-width=".9" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.4" fill="${C.or}" opacity="${c.o.toFixed(2)}"/>`;
        const col = c.fast ? FC[fastStatus(FASTENERS.find((f) => f.id === c.id))] : C.or;
        ch += `<div class="call" style="left:${lx.toFixed(1)}px;top:${(ly - 1).toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b><i style="background:${col}"></i><em>${c.id}</em> ${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
    },
  };
}
