// The transformer as a page you drive: the film's model and overlay in real time. Camera views, the cutaway (solid,
// glass, section), the subsystems (all, active part, core, windings, fluid, fittings), the overlays (part numbers,
// flux, current, flow, untanking); sliders for the load, the ambient, the power factor, the grid voltage and the
// time-lapse; the tap changer strip; the four tabs on the right, the CONFIGURE one rebuilding the unit option by option
// under the manual's rules; click a part number for its page in the manual; drag to orbit, scroll to zoom, H hides the
// overlay. The thermal state integrates in real time (IEC 60076-7), so the drag pointer keeps the maximum. On load it
// plays the film's script as an auto tour; a click, drag, wheel or key hands control over and the camera then holds
// still where it is put; the tour only comes back from the RESUME TOUR chip.
import {warmComposer} from '../kit/warm.js';
import {CAMS, createConsole, CUTS, LOAD_MAX, OVERLAYS, TA_RANGE, TABS, VIEWS} from './console.js';
import {
  camAt, camName, cfgAt, cutAt, DURATION, DEG_PER_S, explodeAt, flowRate, loadAt, makeConsoleFrame, makeCursor,
  overlaysAt, poseOf, protAt, energisedAt, SCRIPT, sizeOf, ss, tabAt, thermalAt, THERMAL_MIN_PER_S, VIEW_FN, viewAt, withExplode,
} from './film.js';
import {FAULTS, fitted, protInit, protReset, protStep, SET} from './protect.js';
import {createTrafoStage} from './stage.js';
import {defaultConfig, LIMITS, MR, lvVoltage, OPTION_KEYS, OPTIONS, PARTS, resolve, spec, thermalStep, ultimate} from './trafo.js';

const W = 1600;
const H = 900;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
// time-lapse steps: electrical degrees per second and thermal minutes per second, together
const PLAYS = [
  {deg: 15, min: 0.5, text: '1/1200 · 30 S/S'},
  {deg: 40, min: 2, text: '1/450 · 2 MIN/S'},
  {deg: 120, min: 6, text: '1/150 · 6 MIN/S'},
  {deg: 240, min: 20, text: '1/75 · 20 MIN/S'},
  {deg: 480, min: 60, text: '1/38 · 1 H/S'},
];

const CSS = `
html,body{background:#ecedef;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.tb,.row,.num{pointer-events:auto;cursor:pointer}
.tb:hover,.row:hover{filter:brightness(.95)}
.hit{position:absolute;pointer-events:auto;cursor:pointer}
.hit.ew{cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:78px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:21px;padding:0 11px;border:1px solid #e1e3e6;background:rgba(255,255,255,.95);color:#16181b;font:600 8.8px Inter,sans-serif;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#d6182b}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#8b8f95;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

export function runLive() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  let cfg = defaultConfig();
  let sp = spec(cfg);
  let cfgKey = JSON.stringify(cfg);
  const st = createTrafoStage({canvas, spec: sp});
  const ui = createConsole(app);
  const tourCursor = makeCursor(ui);
  const frameConsole = makeConsoleFrame(ui, st);

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
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
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
  let T = 0;
  let th = 30;
  let K = 0.5;
  let Ktarget = 0.5;
  let ta = 20;
  let pf = 0.9;
  let ug = 1;
  let tap = 3;
  let playI = 2;
  let paused = false;
  let view = 'hero';
  let viewAt0 = 0;
  let cut = 'solid';
  let show = 'all';
  let tab = 'operate';
  let explode = 0;
  let partSel = 0;
  let partsAt = -9;
  let flash = '';
  let flashAt = -9;
  let notes = [];
  let notesAt = -9;
  let cfgHi = null;
  let simMin = 0;
  let flowPhase = 0;
  let thermal = null;
  let history = [];
  let lastHist = 0;
  let tapStepAt = 0;
  let prot = protInit(sp);
  // the ECOTAP control unit (MR 8209941 p.13, parameters p.127): one measured phase against the desired voltage
  const avr = {t1: 0, t2: 0, busy: 0, to: 0, cool: 0, ops: 0, state: 'IN BAND', ua: 230, du: 0, blocked: false};
  const faults = {overload: 0, cooling: 0, leak: 0, gassing: 0};
  let pendArc = false;
  let pendSc = false;
  let seenEv = 0;
  const ov = {parts: 0, flux: 1, current: 1, flow: 1, untank: 0};
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.open(0, sizeOf(st.tr))};
  let ring = {t: -9, x: 0, y: 0};
  let hidden = false;
  const pulse = (x, y) => (ring = {t: T, x, y});
  const pulseBtn = (k) => pulse(...ui.spots[k]);
  const say = (msg) => {
    flash = msg;
    flashAt = T;
  };
  const resetThermal = (src) => {
    const u = ultimate(sp, K);
    thermal = src ? {oil: src.oil, hs: src.hs, top: src.top, hot: src.hot, max: src.max} : {oil: u.oil, hs: u.hs, top: ta + u.oil, hot: ta + u.oil + u.hs, max: ta + u.oil};
    history = [];
    for (let ago = 360; ago >= 0; ago -= 6) history.push({ago, top: thermal.top, hot: thermal.hot, ta});
  };
  resetThermal();
  const setConfig = (next, changed) => {
    const r = resolve(next, changed);
    cfg = r.cfg;
    notes = r.notes;
    notesAt = T;
    cfgHi = changed;
    const key = JSON.stringify(cfg);
    if (key === cfgKey) return;
    cfgKey = key;
    const old = sp;
    sp = spec(cfg);
    st.setSpec(sp);
    if (sp.positions !== old.positions) tap = (sp.positions + 1) / 2;
    tap = clamp(tap, 1, sp.positions);
    buildTapHits();
  };

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0, loop: 0};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.loop = 0;
    paused = false;
    playI = 2;
    Object.assign(off, {az: 0, el: 0, k: 1});
    ta = 20;
    pf = 0.9;
    ug = 1;
    tap = 3;
    partSel = 0;
    setConfig(defaultConfig(), null);
    notes = [];
    prot = protInit(sp);
    for (const k in faults) faults[k] = 0;
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const cyc = (T - AP.t0) % DURATION;
    view = camName(cyc);
    viewAt0 = T - (cyc - SCRIPT.filter((e) => e.cam && e.t <= cyc).pop().t);
    if (view === 'hero' && cyc < 3.5) viewAt0 = T - 6;
    cut = cutAt(cyc);
    show = viewAt(cyc);
    tab = tabAt(cyc);
    Object.assign(ov, overlaysAt(cyc));
    explode = explodeAt(cyc);
    K = Ktarget = loadAt(cyc);
    resetThermal(thermalAt(cyc));
    simMin = cyc * THERMAL_MIN_PER_S;
    partSel = 0;
    prot = {...protAt(cyc), contacts: {...protAt(cyc).contacts}};
    seenEv = prot.events.length;
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
  const setView = (v) => {
    view = v;
    viewAt0 = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const on = (k, fn) =>
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      fn();
    });
  for (const k of CAMS) on(k, () => setView(k));
  for (const k of CUTS) on(k, () => (cut = k));
  for (const k of VIEWS) on(k, () => (show = k));
  for (const k of TABS) on(k, () => (tab = k));
  for (const k of OVERLAYS)
    on(k, () => {
      ov[k] = ov[k] ? 0 : 1;
      if (k === 'parts') {
        partsAt = T;
        if (!ov.parts) partSel = 0;
      }
    });
  for (const f of FAULTS)
    on('f_' + f.key, () => {
      if (f.key === 'arc') pendArc = true;
      else if (f.key === 'lvshort') pendSc = true;
      else {
        faults[f.key] = faults[f.key] ? 0 : 1;
        if (faults[f.key]) {
          if (f.key === 'overload') Ktarget = 1.4;
          playI = Math.max(playI, 4);
          say(`${f.text} — time-lapse set to 1 h/s`);
        } else if (f.key === 'overload') Ktarget = 0.5;
      }
    });
  on('f_reset', () => {
    for (const k in faults) faults[k] = 0;
    if (Ktarget > 1.2) Ktarget = 0.5;
    prot = protReset(sp, prot);
    seenEv = prot.events.length;
    say('Reset: cause cleared, gas vented, fuse replaced — never re-energise before the cause is clarified (p.54)');
  });
  on('pause', () => (paused = !paused));
  on('back', () => {
    paused = true;
    th -= 30;
  });
  on('fwd', () => {
    paused = true;
    th += 30;
  });
  // configuration rows: click cycles the option, the rules may move others
  for (const k of OPTION_KEYS)
    ui.rows[k].addEventListener('click', () => {
      takeOver();
      pulse(...ui.rowSpot(k));
      const vals = OPTIONS[k].values;
      const i = vals.indexOf(cfg[k]);
      setConfig({...cfg, [k]: vals[(i + 1) % vals.length]}, k);
    });
  // part numbers
  PARTS.forEach((p, i) =>
    ui.nums[i].addEventListener('click', (e) => {
      e.stopPropagation();
      takeOver();
      partSel = partSel === p.n ? 0 : p.n;
    }),
  );
  // the tap changer strip
  let tapHits = [];
  function buildTapHits() {
    for (const d of tapHits) d.remove();
    tapHits = [];
    for (let p = 1; p <= sp.positions; p++) {
      const d = document.createElement('div');
      d.className = 'hit';
      ui.root.appendChild(d);
      d.addEventListener('click', () => {
        takeOver();
        const [x, y] = ui.tapSpot(p - 1);
        pulse(x, y);
        if (sp.oltc) {
          say('ECOTAP selects its position itself under load — move the grid voltage instead');
          return;
        }
        if (K > 0.001) {
          say('Caution: off-circuit tap changer — de-energised only (p.52). Load set to 0, unit isolated.');
          K = Ktarget = 0;
        }
        tap = p;
      });
      tapHits.push(d);
    }
    tapHits.forEach((d, i) => {
      const [x, y] = ui.tapSpot(i);
      Object.assign(d.style, {left: `${x - 14}px`, top: `${y - 14}px`, width: '28px', height: '28px', borderRadius: '50%'});
    });
  }
  // the sliders: drag along their tracks
  const slider = (k, apply) => {
    const [x0, y] = ui.knob(k, 0);
    const [x1] = ui.knob(k, 1);
    const d = document.createElement('div');
    d.className = 'hit ew';
    Object.assign(d.style, {left: `${x0 - 8}px`, top: `${y - 11}px`, width: `${x1 - x0 + 16}px`, height: '22px'});
    const move = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      apply(clamp((x - x0) / (x1 - x0), 0, 1));
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
  };
  slider('load', (k) => (Ktarget = Math.round(k * LOAD_MAX * 100) / 100));
  slider('ambient', (k) => (ta = Math.round(TA_RANGE[0] + k * (TA_RANGE[1] - TA_RANGE[0]))));
  slider('pf', (k) => (pf = Math.round((0.7 + 0.3 * k) * 100) / 100));
  slider('grid', (k) => (ug = Math.round((0.9 + 0.2 * k) * 200) / 200));
  slider('play', (k) => (playI = Math.round(k * (PLAYS.length - 1))));
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const v = {1: 'hero', 2: 'front', 3: 'side', 4: 'top', 5: 'lid', 6: 'inside'}[key];
    takeOver();
    if (v) setView(v);
    else if (key === ' ') paused = !paused;
    else if (key === 'h') hidden = !hidden;
    else if (key === 'arrowup') Ktarget = clamp(Ktarget + 0.1, 0, LOAD_MAX);
    else if (key === 'arrowdown') Ktarget = clamp(Ktarget - 0.1, 0, LOAD_MAX);
    else if (key === 'arrowleft') {
      paused = true;
      th -= 30;
    } else if (key === 'arrowright') {
      paused = true;
      th += 30;
    } else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az += ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -20, 70);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.4);
    },
    {passive: false},
  );
  buildTapHits();

  // ------------------------------------------------------------ the frame
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
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

    let tgt;
    let cursor;
    let since;
    let op;
    const z = sizeOf(st.tr);
    if (AP.on) {
      // the tour: everything from the film's script at the cycle's time
      const c = T - AP.t0;
      const loop = Math.floor(c / DURATION);
      const cyc = c - loop * DURATION;
      if (loop > AP.loop) {
        AP.loop = loop;
        setConfig(defaultConfig(), null);
      }
      const want = cfgAt(cyc);
      if (JSON.stringify(want) !== cfgKey) {
        const ev = SCRIPT.filter((e) => e.cfg && e.t <= cyc).pop();
        setConfig(want, ev?.cfg[0] ?? null);
      }
      view = camName(cyc);
      cut = cutAt(cyc);
      show = viewAt(cyc);
      tab = tabAt(cyc);
      Object.assign(ov, overlaysAt(cyc));
      explode = explodeAt(cyc);
      K = Ktarget = loadAt(cyc);
      const tm = thermalAt(cyc);
      thermal = tm;
      simMin = cyc * THERMAL_MIN_PER_S;
      const t0 = SCRIPT.filter((e) => e.cam && e.t <= cyc).pop().t;
      since = cyc - t0;
      tgt = withExplode(camAt(cyc, z), explode, z);
      cursor = tourCursor(cyc);
      if (AP.loop > 0 && cyc < 0.8) {
        const end = tourCursor(DURATION - 0.01);
        const k = ss(0, 0.8, cyc);
        cursor = {...cursor, x: end.x + (cursor.x - end.x) * k, y: end.y + (cursor.y - end.y) * k};
      }
      const pe = SCRIPT.find((e) => e.overlay === 'parts');
      const ps = cyc - pe.t;
      const walk = [4, 5, 6, 8, 3];
      partSel = ov.parts && ps > 0.6 && cyc < SCRIPT.find((e) => e.tab).t ? walk[Math.min(walk.length - 1, Math.floor((ps - 0.6) / 0.66))] : 0;
      partsAt = T - ps;
      const cfgEv = SCRIPT.filter((e) => e.cfg && e.t <= cyc).pop();
      cfgHi = cfgEv && cyc - cfgEv.t < 2 ? cfgEv.cfg[0] : null;
      if (!(cfgEv && cyc - cfgEv.t < 2.2)) notes = [];
      th = 30 + cyc * DEG_PER_S;
      prot = protAt(cyc);
      seenEv = prot.events.length;
      flowPhase += flowRate(sp, K) * dt;
      history = [];
      for (let ago = 360; ago >= 0; ago -= 6) {
        const r = thermalAt(cyc - ago / THERMAL_MIN_PER_S);
        history.push({ago, top: r.top, hot: r.hot, ta: 20});
      }
    } else {
      // the visitor's camera holds still: no sway, no return to the tour until RESUME TOUR is clicked
      since = T - viewAt0;
      tgt = VIEW_FN[view](0, z);
      tgt.az += off.az;
      tgt.el = clamp(tgt.el + off.el, -10, 85);
      tgt.d *= off.k;
      explode += ((ov.untank ? 1 : 0) - explode) * (1 - Math.exp(-dt / 0.5));
      tgt = withExplode(tgt, explode, z);
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
      // the operating point: a trip or a blown fuse takes the unit off the grid
      K += (Ktarget - K) * (1 - Math.exp(-dt / 0.25));
      const P = PLAYS[playI];
      const dm = paused ? 0 : P.min * dt;
      const on = prot.energised !== false;
      if (!paused) {
        th += P.deg * dt;
        simMin += dm;
        thermal = thermalStep(sp, thermal, on ? K : 0, ta, dm, faults.cooling ? SET.coolFactor.v : 1, on);
        flowPhase += flowRate(sp, on ? K : 0) * dt * (on ? 1 : 0.3);
        if (simMin - lastHist >= 6 || simMin < lastHist) {
          lastHist = simMin;
          history = history.map((r) => ({...r, ago: r.ago + 6})).filter((r) => r.ago <= 360);
          history.push({ago: 0, top: thermal.top, hot: thermal.hot, ta});
        }
      }
      prot = protStep(sp, prot, {top: thermal.top, energised: true, faults, arc: pendArc, lvshort: pendSc, simMin}, dm, dt);
      pendArc = pendSc = false;
      if (prot.events.length !== seenEv) {
        const e = prot.events.at(-1);
        seenEv = prot.events.length;
        say(`${e.kind === 'trip' ? '⚡ ' : e.kind === 'alarm' ? '⚑ ' : ''}${e.text}`);
      }
      // the ECOTAP control unit: dU = Uactual − Udesired on one phase; outside B1 for T1, or outside B2 for T2, it starts
      // one tap change (approx. 420 ms), then keeps approx. 3 s of cooling time before the next (MR 8209941 p.13–14, 127, 138)
      if (sp.oltc) {
        const A = MR.avr;
        avr.ua = lvVoltage(sp, ug, tap, on ? K : 0, pf) / Math.sqrt(3);
        avr.du = ((avr.ua - A.desired.def) / A.desired.def) * 100;
        avr.blocked = avr.ua < A.block.under || avr.ua > A.block.over || !on;
        const want = avr.du > 0 ? tap - 1 : tap + 1; // position 1 carries the most HV turns: the lowest LV
        if (avr.busy > 0) {
          avr.busy -= dt;
          avr.state = 'TAP CHANGE';
          if (avr.busy <= 0) {
            tap = avr.to;
            avr.ops++;
            avr.cool = MR.coolingS;
          }
        } else if (avr.cool > 0) {
          avr.cool -= dt;
          avr.state = 'COOLING TIME';
        } else if (avr.blocked) {
          avr.t1 = avr.t2 = 0;
          avr.state = on ? 'VOLTAGE BLOCKING' : 'DE-ENERGISED';
        } else {
          const ad = Math.abs(avr.du);
          if (ad > A.b2.def) avr.t2 += dt;
          else avr.t2 = 0;
          if (ad > A.b1.def) avr.t1 += dt;
          else avr.t1 = 0;
          const go = (ad > A.b2.def && avr.t2 >= A.t2.def) || (ad > A.b1.def && avr.t1 >= A.t1.def);
          avr.state = ad > A.b2.def ? 'OUTSIDE B2 · T2' : ad > A.b1.def ? 'OUTSIDE B1 · T1' : 'IN BAND';
          if (go) {
            if (want < 1 || want > sp.positions) avr.state = 'END POSITION';
            else {
              avr.busy = MR.tapChangeMs / 1000;
              avr.to = want;
              avr.t1 = avr.t2 = 0;
            }
          }
        }
      }
      // without contacts only the dial shows the temperature (p.38)
      if (!fitted(cfg).contacts && thermal.top >= LIMITS.thermoAlarm && T - flashAt > 6) say(`Top oil ${Math.round(thermal.top)} °C: no thermometer contacts fitted — only the dial and its drag pointer show it`);
    }
    // the camera eases toward its target
    const k = 1 - Math.exp(-dt / (AP.on ? 0.18 : 0.45));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;
    st.setCut(cut);
    const energised = prot.energised !== false && (!AP.on || energisedAt((T - AP.t0) % DURATION));
    op = {
      sp,
      th,
      K: energised ? K : 0,
      prot,
      energised,
      faults: {...faults},
      time: T,
      avr: sp.oltc ? {...avr} : null,
      pf,
      ta,
      ug,
      tap,
      limb: 0,
      thermal: {...thermal, max: thermal.max ?? thermal.top},
      history,
      simMin,
      flowPhase,
      flowRate: flowRate(sp, K),
      cut,
      view: show,
      overlays: {...ov},
      explode,
      tab,
      cfgHi: T - notesAt < 2.5 ? cfgHi : AP.on ? cfgHi : null,
      notes: T - notesAt < 6 || AP.on ? notes : [],
      flash: T - flashAt < 6 ? flash : '',
      cam: view,
      since,
      partsSince: T - partsAt,
      partSel,
      buchholz: Math.min(1, (T % 6) / 5),
      dipstick: view === 'lid' && cfg.design === 'breathing' && cut !== 'section' ? 1 : 0,
      paused,
      live: true,
      scale,
      sliders: {playText: PLAYS[playI].text, playK: playI / (PLAYS.length - 1)},
      cursor,
    };
    st.frame(poseOf(sp, op), {...cam, az: cam.az * D2R, el: cam.el * D2R});
    ui.root.style.display = hidden ? 'none' : '';
    frameConsole(T, op);
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>AUTO TOUR · CLICK TO TAKE OVER' : '▶ RESUME TOUR';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, cam, startTour, takeOver, get cfg() {
    return cfg;
  }, setConfig, get tier() {
    return tier;
  }, get T() {
    return T;
  }};
}
