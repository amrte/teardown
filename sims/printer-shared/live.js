// The FX-1 as a page you drive. The machine clock runs at the playback speed you pick (1/16× to 32×); pause, scrub
// the program, open any layer of the firmware stack and the part it drives lights up; click a G-code line to follow
// it down to the nozzle; click a part to see every layer that touches it; switch on a fault and the model re-runs;
// zoom the logic analyzer from 2 s down to 200 µs of machine time; the seven views, the three cutaways, an orbit you
// drag and a zoom on the wheel. Left alone it plays the film's script as an auto tour with the operator's cursor; a
// click, drag, wheel or key hands control over, 25 s of quiet hands it back.
import {warmComposer} from '../kit/warm.js';
import {createConsole, CUTS, VIEWS} from './console.js';
import {beadColor, camAt, cutAt, DURATION, followAt, FOLLOW_STAGES, makeClock, makeCursor, makeFrame, openAt, viewAt, VIEW_FN, WINDOW} from './film.js';
import {FAULTS, runModel} from './model.js';
import {createStage} from './stage.js';
import {LAYERS_UI, machineAt, PART_LAYERS, PART_NAME} from './state.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const RATES = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8, 16, 32];
const WINDOWS = [0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2];
// the hardware a clicked part lights up
const PART_HL = {xmotor: ['motors'], ymotor: ['motors'], zmotor: ['motors'], emotor: ['motors'], zscrew: ['screws'], xbelt: ['belts'], ybelt: ['belts'], bed: ['bed'], bedheat: ['bedheat'], heater: ['heater'], thermistor: ['thermistor'], hotend: ['hotend'], lcd: ['ui'], board: ['mcu', 'drivers'], mcu: ['mcu'], driver: ['drivers'], usb: ['usb'], cable: ['cables']};

const CSS = (top) => `
html,body{background:#ecedef;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:${top}px;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.tb,.row,.lr{pointer-events:auto;cursor:pointer}
.tb:hover{filter:brightness(.95)}
.row:hover .nm{text-decoration:underline}
.lr:hover{background:rgba(61,143,224,.08)}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:132px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:21px;padding:0 11px;border:1px solid #e1e3e6;background:rgba(255,255,255,.95);color:#16181b;font:600 8.8px Inter,sans-serif;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#d6182b}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#8b8f95;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

export function runLive() {
  const top = Number(document.body.dataset.top || 0);
  const style = document.createElement('style');
  style.textContent = CSS(top);
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createStage({canvas});
  const ui = createConsole(app);
  const frame = makeFrame(st, ui);

  // ------------------------------------------------------------ the model, one run per fault, made when first asked
  const models = {};
  const modelOf = (f) => (models[f] ||= runModel(f));
  let M = modelOf('none');
  st.pr.setBead(M.bead, beadColor);
  const clock = makeClock(M);
  const tourCursor = makeCursor(ui, M, clock);

  // ------------------------------------------------------------ quality tiers
  const TIERS = [
    {samples: 8, ao: true, shadow: 4096, pr: 2},
    {samples: 4, ao: false, shadow: 2048, pr: 1.5},
    {samples: 2, ao: false, shadow: 1024, pr: 1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 2 : 0;
  let scale = 1;
  const fit = () => {
    const h = innerHeight - top;
    scale = Math.min(innerWidth / W, h / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(h - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    st.setQuality(q);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = 'Turn your phone sideways for the full console';
  document.body.appendChild(note);

  // ------------------------------------------------------------ state
  let T = 0; // real seconds since the page started
  let tm = 0; // machine seconds
  let rateI = 4;
  let paused = false;
  let view = 'hero';
  let viewAt0 = 0;
  let winI = -1; // -1: the window follows the playback speed
  const open = Object.fromEntries(LAYERS_UI.map((k) => [k, {on: 0, t: -9}]));
  const cut = Object.fromEntries(CUTS.map((k) => [k, {on: 0, t: -9}]));
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.hero(0)};
  let follow = null; // {line, block, t0}
  let partSel = null; // {part, t0}
  let ring = {t: -9, x: 0, y: 0};
  const eased = (o, dur = 0.55) => {
    const x = ss(o.t, o.t + dur, T);
    return o.on ? x : 1 - x;
  };
  const pulse = (spot) => (ring = {t: T, x: spot[0], y: spot[1]});
  const setLayer = (k) => {
    for (const L of LAYERS_UI) {
      const want = L === k ? 1 : 0;
      if (open[L].on !== want) {
        open[L].on = want;
        open[L].t = T;
      }
    }
  };
  const setCut = (k, on) => {
    if (cut[k].on !== on) {
      cut[k].on = on;
      cut[k].t = T;
    }
  };
  const setView = (v) => {
    view = v;
    viewAt0 = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const setFault = (f) => {
    if (M.fault === f) return;
    M = modelOf(f);
    st.pr.setBead(M.bead, beadColor);
    tm = Math.min(tm, M.end);
    follow = null;
    // show the fault where it strikes: a few seconds before, at 1×
    const at = Number.isFinite(M.ev.faultAt) ? M.ev.faultAt : f === 'accel' ? M.ev.layers[1] : null;
    if (at !== null && at !== undefined) {
      tm = Math.max(0, at - (f === 'loose' ? 3 : 1.5));
      rateI = f === 'loose' ? 7 : f === 'accel' ? 2 : 3;
      paused = false;
      setLayer(f === 'skip' || f === 'accel' ? 'mech' : 'thermal');
      setView(f === 'skip' || f === 'accel' ? 'head' : 'hotend');
    }
  };

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0, loop: 0};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.loop = 0;
    paused = false;
    follow = null;
    partSel = null;
    winI = -1;
    if (M.fault !== 'none') {
      M = modelOf('none');
      st.pr.setBead(M.bead, beadColor);
    }
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    // keep where the tour was: its machine time, view, open layer and cutaways
    const cyc = (T - AP.t0) % DURATION;
    tm = clock.tmAt(cyc);
    const r = clock.rateAt(cyc);
    rateI = RATES.reduce((b, x, i) => (Math.abs(Math.log(x / r)) < Math.abs(Math.log(RATES[b] / r)) ? i : b), 0);
    const [t0, v] = viewAt(cyc);
    view = v;
    viewAt0 = T - (cyc - t0);
    const o = openAt(cyc);
    let best = null;
    for (const k of LAYERS_UI) if (o[k] > 0.5) best = k;
    for (const k of LAYERS_UI) open[k] = {on: k === best ? 1 : 0, t: -9};
    const c = cutAt(cyc);
    for (const k of CUTS) cut[k] = {on: c[k] > 0.5 ? 1 : 0, t: -9};
    const fo = followAt(cyc, clock);
    follow = fo ? {line: fo.line, block: fo.block, t0: T - fo.u} : null;
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.target !== tourChip) takeOver();
  });

  // ------------------------------------------------------------ controls
  const B = ui.btn;
  const spotOf = (n) => {
    const [x, y] = toStage(n.getBoundingClientRect().left + n.getBoundingClientRect().width / 2, n.getBoundingClientRect().top + n.getBoundingClientRect().height / 2);
    return [x, y];
  };
  const click = (n, fn) =>
    n.addEventListener('click', (e) => {
      takeOver();
      pulse(spotOf(n));
      fn(e);
    });
  for (const v of VIEWS)
    click(B[v], () => {
      setView(v);
      // the views made for a cutaway open it
      if (v === 'board') setCut('xray', 1);
      if (v === 'motor') setCut('motor', 1);
    });
  for (const c of CUTS) click(B['c_' + c], () => setCut(c, cut[c].on ? 0 : 1));
  for (const f of FAULTS) click(B['f_' + f], () => setFault(f));
  // a layer opens or closes from its header row; clicks inside its open body are left alone
  for (const k of LAYERS_UI)
    B['L_' + k].addEventListener('click', (e) => {
      if (e.target.closest('.body')) return;
      takeOver();
      setLayer(open[k].on ? null : k);
    });
  click(B.play, () => {
    if (tm >= M.end - 0.01) tm = 0;
    paused = !paused;
  });
  click(B.slow, () => (rateI = Math.max(0, rateI - 1)));
  click(B.fast, () => (rateI = Math.min(RATES.length - 1, rateI + 1)));
  click(B.zin, () => (winI = Math.max(0, (winI < 0 ? WINDOWS.findIndex((w) => w >= WINDOW(RATES[rateI])) : winI) - 1)));
  click(B.zout, () => (winI = Math.min(WINDOWS.length - 1, (winI < 0 ? WINDOWS.findIndex((w) => w >= WINDOW(RATES[rateI])) : winI) + 1)));
  // follow a line: click it in the listing
  ui.lsBox.style.pointerEvents = 'auto';
  ui.lsBox.addEventListener('click', (e) => {
    takeOver();
    const [, y] = toStage(e.clientX, e.clientY);
    const n = ui.lineAt(y);
    const L = M.lines[n - 1];
    if (!L) return;
    const b = M.live.find((x) => x.line === n && x.kind === 'move');
    pulse([150, y]);
    if (b) {
      tm = Math.max(0, b.tStart - 0.2);
      rateI = 1;
      paused = false;
      follow = {line: n, block: b, t0: T};
      setView('head');
    } else {
      const lt = M.lineT[n];
      if (lt) tm = Math.max(0, lt.sent - 0.05);
      follow = null;
      setLayer('parser');
    }
  });
  // the scrubber
  {
    const d = document.createElement('div');
    d.className = 'hit';
    Object.assign(d.style, {left: `${ui.TL.x - 8}px`, top: `${ui.TL.y - 11}px`, width: `${ui.TL.w + 16}px`, height: '22px'});
    const move = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      tm = clamp((x - ui.TL.x) / ui.TL.w, 0, 1) * M.end;
      follow = null;
      lastInput = T;
    };
    d.addEventListener('pointerdown', (e) => {
      takeOver();
      d.setPointerCapture(e.pointerId);
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
    ui.root.appendChild(d);
  }
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    takeOver();
    const k = e.key.toLowerCase();
    if (/^[1-7]$/.test(k)) setView(VIEWS[+k - 1]);
    else if (k === ' ') B.play.click();
    else if (k === 'arrowright') tm = Math.min(M.end, tm + 2);
    else if (k === 'arrowleft') tm = Math.max(0, tm - 2);
    else if (k === '-' || k === '_') B.slow.click();
    else if (k === '=' || k === '+') B.fast.click();
    else return;
    e.preventDefault();
  });
  // orbit, zoom, and a click on a part
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az -= ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -25, 60);
    drag.x = e.clientX;
    drag.y = e.clientY;
    lastInput = T;
  });
  const endDrag = (e) => {
    if (drag && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4) {
      const [x, y] = toStage(e.clientX, e.clientY);
      const part = st.pick(x, y);
      partSel = part && PART_LAYERS[part] ? {part, t0: T} : null;
      if (partSel) {
        follow = null;
        pulse([x, y]);
      }
    }
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => {
    drag = null;
    canvas.classList.remove('drag');
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.6);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ the frame
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const loop = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.6) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }
    let f;
    let tgt;
    if (AP.on) {
      const c = T - AP.t0;
      const cyc = c % DURATION;
      AP.loop = Math.floor(c / DURATION);
      tm = clock.tmAt(cyc);
      const rate = clock.rateAt(cyc);
      const [vt0, v] = viewAt(cyc);
      view = v;
      tgt = camAt(cyc, machineAt(M, tm));
      let cursor = tourCursor(cyc);
      if (AP.loop > 0 && cyc < 0.8) {
        const end = tourCursor(DURATION - 0.01);
        const k = ss(0, 0.8, cyc);
        cursor = {...cursor, x: end.x + (cursor.x - end.x) * k, y: end.y + (cursor.y - end.y) * k};
      }
      f = {rate, paused: false, open: openAt(cyc), cut: cutAt(cyc), follow: followAt(cyc, clock), window: WINDOW(rate), cursor, labels: v === 'hero' || v === 'front' ? ss(vt0 + 0.9, vt0 + 1.5, cyc) : 0};
    } else {
      if (T - lastInput > IDLE) startTour();
      const rate = RATES[rateI];
      if (!paused) tm = Math.min(M.end, tm + dt * rate);
      if (tm >= M.end) paused = true;
      // follow a line: the stages open the layers as the block runs, at 1/8×
      let fo = null;
      if (follow) {
        const u = T - follow.t0;
        if (u > 7) follow = null;
        else {
          let stage = 0;
          FOLLOW_STAGES.forEach((s, i) => {
            if (u >= s) stage = i;
          });
          fo = {line: follow.line, block: follow.block, stage, flash: Math.max(0, 1 - u / 0.6), u};
          const want = [null, 'parser', 'planner', 'stepper', 'driver', 'driver', 'mech', 'mech'][stage];
          if (want && !open[want].on) setLayer(want);
          const xMove = Math.abs(follow.block.d.x) > 0.5;
          if (stage === 3 && xMove && view !== 'motor') {
            setView('motor');
            setCut('motor', 1);
          }
          if (stage === 6 && view === 'motor') {
            setView('head');
            setCut('motor', 0);
          }
        }
      }
      const since = T - viewAt0;
      tgt = VIEW_FN[view](since, machineAt(M, tm));
      tgt.az += off.az;
      tgt.el = clamp(tgt.el + off.el, -20, 88);
      tgt.d *= off.k;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      const sel = partSel && T - partSel.t0 < 8 ? partSel : null;
      const touched = sel ? Object.fromEntries(PART_LAYERS[sel.part].map((k) => [k, 1])) : null;
      f = {
        rate,
        paused,
        open: Object.fromEntries(LAYERS_UI.map((k) => [k, eased(open[k])])),
        cut: Object.fromEntries(CUTS.map((k) => [k, eased(cut[k], 0.5)])),
        follow: fo,
        partInfo: sel ? {name: PART_NAME[sel.part] ?? sel.part.toUpperCase(), layers: PART_LAYERS[sel.part]} : null,
        partHL: sel ? PART_HL[sel.part] : null,
        touched,
        window: winI >= 0 ? WINDOWS[winI] : WINDOW(rate),
        cursor: {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y},
        labels: (view === 'hero' || view === 'front') && since > 0.9 ? ss(0.9, 1.5, since) : 0,
      };
    }
    const k = 1 - Math.exp(-dt / (AP.on ? 0.12 : 0.35));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;
    const m = machineAt(M, tm);
    frame({...f, M, m, view, cam});
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>AUTO TOUR · CLICK TO TAKE OVER' : '▶ RESUME TOUR';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(loop);
  };
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(loop));
  window.LIVE = {
    st,
    get M() {
      return M;
    },
    get tm() {
      return tm;
    },
    get tier() {
      return tier;
    },
    get auto() {
      return AP.on;
    },
    startTour,
    takeOver,
  };
}
