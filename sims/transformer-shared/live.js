// The cast-resin transformer as a page you drive: the film's unit and overlay, run in real time. Camera views, the
// cutaway (solid, half section, x-ray), the overlays (callouts, flux, airflow, heat map, charts), the phase picker,
// the HV tap links, PAUSE and ±30°, the load and playback sliders, an orbit you drag, a zoom on the wheel, H to hide
// the overlay. The windings heat with the load (τ 40 min played ×800); the PTC starts the fans at 120 °C and trips
// the breaker at 160 °C, which de-energises the unit until RESET. Left alone it plays the film's script as an auto tour
// with the operator's cursor, looped; a click, drag, wheel or key hands control to the visitor, 25 s of quiet hands
// it back.
import {warmComposer} from '../kit/warm.js';
import {CAMS, createConsole, CUTS, OVERLAYS, sMax} from './console.js';
import {camAt, camName, cutAt, designHash, DURATION, parseDesign, energisedAt, gridAt, gridK, heatAt, loadAt, makeConsoleFrame, makeCursor, overlaysAt, ovLevel, PLAY, RELINK, SCRIPT, tapAt, TAU_S, TRACK, unitState, VIEW_FN, viewStart} from './film.js';
import {airSpeed, designFor, GRID, PHASES, R, setDesign, stepHeat, TAP0, TAPS, windRise} from './kin.js';
import {createStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
// playback steps for the mains: the film runs at 1/100
const PLAYS = [1 / 1000, 1 / 400, 1 / 200, 1 / 100, 1 / 50, 1 / 20, 1 / 10];
const playText = (p) => `1 / ${Math.round(1 / p)} SPEED`;

const CSS = `
html,body{background:#ecedef;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.tb{pointer-events:auto;cursor:pointer}
.tb:hover{filter:brightness(.95)}
.hit{position:absolute;pointer-events:auto;cursor:pointer}
.hit.ew{cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:62px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:21px;padding:0 11px;border:1px solid #e1e3e6;background:rgba(255,255,255,.95);color:#16181b;font:600 8.8px Inter,sans-serif;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#f08a00}
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
  // the unit from the page's #order-no[-dyn11], or the default
  {
    const p = parseDesign(location.hash);
    setDesign(designFor(p.order, p.group));
  }
  const st = createStage({canvas});
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
    void pr;
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
  let th = 40;
  let S = loadAt(0);
  let Starget = S;
  let playI = 3;
  let paused = false;
  let view = 'hero';
  let viewAt = 0;
  let k = TRACK;
  let tap = TAP0;
  let tapF = TAP0;
  let cut = 'solid';
  let energised = true;
  let Ug = R.U1;
  let UgTarget = R.U1;
  // a tap change in progress: the breaker opened at t0, the links go from `from` to `tap`, the breaker closes again
  let relink = null;
  const ov = {callouts: 1, flux: 0, airflow: 0, heat: 0, charts: 1};
  const ovF = {...ov};
  const heat = {hs: R.amb + windRise(S, 0), fan: 0, fanOn: false, trip: false, air: 0, spin: 0};
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.open(0)};
  let ring = {t: -9, x: 0, y: 0};
  let hidden = false;
  const pulse = (x, y) => (ring = {t: T, x, y});
  const pulseBtn = (key) => pulse(...ui.spots[key]);

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0, loop: 0};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.loop = 0;
    paused = false;
    playI = 3;
    energised = true;
    relink = null;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  // the visitor takes over: the tour's state at this moment becomes the page's
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const cyc = (T - AP.t0) % DURATION;
    view = camName(cyc);
    viewAt = T - (cyc - viewStart(cyc));
    if (view === 'hero' && cyc < 3.6) viewAt = T - 6;
    cut = cutAt(cyc);
    Object.assign(ov, overlaysAt(cyc));
    tap = Math.round(tapAt(cyc));
    tapF = tap;
    energised = true;
    relink = null;
    Ug = UgTarget = gridAt(cyc);
    Starget = loadAt(cyc);
    const h = heatAt(cyc);
    Object.assign(heat, {hs: h.hs, fan: h.fan, fanOn: h.fanOn, trip: false});
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
    viewAt = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  for (const key of CAMS)
    ui.btn[key].addEventListener('click', () => {
      takeOver();
      pulseBtn(key);
      setView(key);
    });
  for (const key of CUTS)
    ui.btn[key].addEventListener('click', () => {
      takeOver();
      pulseBtn(key);
      cut = key;
    });
  for (const key of OVERLAYS)
    ui.btn[key].addEventListener('click', () => {
      takeOver();
      pulseBtn(key);
      ov[key] = ov[key] ? 0 : 1;
    });
  ui.btn.pause.addEventListener('click', () => {
    takeOver();
    pulseBtn('pause');
    paused = !paused;
  });
  for (const [key, d] of [['back', -30], ['fwd', 30]])
    ui.btn[key].addEventListener('click', () => {
      takeOver();
      pulseBtn(key);
      paused = true;
      th += d;
    });
  // the catalog: a new unit rebuilds the model and starts it at its own rated values
  const choose = (order, group) => {
    st.selectDesign(order, group);
    tap = tapF = TAP0;
    Ug = UgTarget = R.U1;
    S = Starget = 0.6 * R.S;
    relink = null;
    energised = true;
    Object.assign(heat, {hs: R.amb + windRise(S, 0), fan: 0, fanOn: false, trip: false});
    const h = `#${designHash()}`;
    if (location.hash !== h) history.replaceState(null, '', h);
  };
  ui.onSelect = (order, group) => {
    takeOver();
    choose(order, group);
  };
  ui.btn.model.addEventListener('click', () => {
    takeOver();
    pulseBtn('model');
    ui.toggleCard();
  });
  addEventListener('hashchange', () => {
    const p = parseDesign(location.hash);
    takeOver();
    choose(p.order, p.group);
  });
  ui.btn.reset.addEventListener('click', () => {
    takeOver();
    if (heat.hs < R.tc.alarm && !relink) {
      heat.trip = false;
      energised = true;
    }
  });
  const picker = (spot, n, fn) => {
    for (let i = 0; i < n; i++) {
      const [x, y] = spot(i);
      const d = document.createElement('div');
      d.className = 'hit';
      Object.assign(d.style, {left: `${x - 15}px`, top: `${y - 15}px`, width: '30px', height: '30px', borderRadius: '50%'});
      d.addEventListener('click', () => {
        takeOver();
        pulse(x, y);
        fn(i);
      });
      ui.root.appendChild(d);
    }
  };
  picker(ui.phSpot, 3, (i) => {
    k = i;
    if (view === 'limb') viewAt = T - 0.01;
  });
  // the manual's rule: taps are changed only de-energised, all three phases alike. The page opens the breaker, moves
  // the three links and closes it again; a tripped unit stays open.
  picker(ui.tapSpot, TAPS.length, (i) => {
    if (i === tap || relink) return;
    relink = {t0: T, from: tap, wasOn: energised};
    tap = i;
    energised = false;
  });
  const slider = (knobAt, apply) => {
    const [x0, y] = knobAt(0);
    const [x1] = knobAt(1);
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
  slider(ui.loadKnob, (v) => (Starget = Math.round((v * sMax()) / 1e3) * 1e3));
  slider(ui.gridKnob, (v) => (UgTarget = Math.round((GRID[0] + v * (GRID[1] - GRID[0])) / 10) * 10));
  void gridK;
  slider(ui.playKnob, (v) => (playI = Math.round(v * (PLAYS.length - 1))));
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const v = {1: 'hero', 2: 'front', 3: 'top', 4: 'side', 5: 'limb', 6: 'taps'}[key];
    takeOver();
    if (v) setView(v);
    else if (key === ' ') paused = !paused;
    else if (key === 'h') hidden = !hidden;
    else if (key === 'arrowleft') {
      paused = true;
      th -= 30;
    } else if (key === 'arrowright') {
      paused = true;
      th += 30;
    } else if (key === 'arrowup') Starget = clamp(Starget + 0.1 * R.S, 0, sMax());
    else if (key === 'arrowdown') Starget = clamp(Starget - 0.1 * R.S, 0, sMax());
    else return;
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
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.4, 2.2);
    },
    {passive: false},
  );

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
    let heatNow;
    let ovl;
    if (AP.on) {
      const c = T - AP.t0;
      const loop = Math.floor(c / DURATION);
      const cyc = c - loop * DURATION;
      if (loop > AP.loop) AP.loop = loop;
      view = camName(cyc);
      k = TRACK;
      tgt = camAt(cyc);
      since = cyc - viewStart(cyc);
      cut = cutAt(cyc);
      Object.assign(ov, overlaysAt(cyc));
      ovl = Object.fromEntries(Object.keys(ov).map((key) => [key, ovLevel(cyc, key)]));
      tapF = tapAt(cyc);
      tap = Math.round(tapF);
      energised = energisedAt(cyc);
      Ug = UgTarget = gridAt(cyc);
      S = loadAt(cyc);
      Starget = S;
      heatNow = heatAt(cyc);
      heat.air = heatNow.air;
      heat.spin = heatNow.spin;
      cursor = tourCursor(cyc);
      if (AP.loop > 0 && cyc < 0.8) {
        const end = tourCursor(DURATION - 0.01);
        const kk = ss(0, 0.8, cyc);
        cursor = {...cursor, x: end.x + (cursor.x - end.x) * kk, y: end.y + (cursor.y - end.y) * kk};
      }
      if (!paused) th += (R.f * 360 * dt) / PLAY;
    } else {
      if (T - lastInput > IDLE) startTour();
      since = T - viewAt;
      tgt = VIEW_FN[view](since, k);
      tgt.az += off.az;
      tgt.el = clamp(tgt.el + off.el, -10, 85);
      tgt.d *= off.k;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
      for (const key of Object.keys(ov)) ovF[key] += (ov[key] - ovF[key]) * (1 - Math.exp(-dt / 0.15));
      ovl = {...ovF};
      if (relink) {
        const u = T - relink.t0;
        tapF = relink.from + (tap - relink.from) * ss(RELINK.move[0], RELINK.move[1], u);
        if (u >= RELINK.close) {
          energised = relink.wasOn && !heat.trip;
          relink = null;
        }
      } else tapF = tap;
      Ug += (UgTarget - Ug) * (1 - Math.exp(-dt / 0.2));
      S += (Starget - S) * (1 - Math.exp(-dt / 0.3));
      // heat runs on its own clock (τ 40 min in 3 s); a pause holds it
      const Sload = energised ? S : 0;
      if (!paused) {
        stepHeat(heat, Sload, dt, TAU_S);
        if (heat.trip && energised) energised = false;
        heat.air += airSpeed(heat.hs, heat.fan) * 0.3 * dt;
        heat.spin += heat.fan * 22 * dt;
        th += (R.f * 360 * dt) * PLAYS[playI];
      }
      heatNow = heat;
    }

    // the camera eases toward its target: the tour's own moves pass through, a loop restart or a click glides
    const kc = 1 - Math.exp(-dt / (AP.on ? 0.18 : 0.45));
    cam.az += wrap(tgt.az - cam.az) * kc;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * kc;
    st.frame(unitState({th, tap: tapF, heat: heatNow, cut, ovl, energised, Ug}), {...cam, az: cam.az * D2R, el: cam.el * D2R});

    ui.root.style.display = hidden ? 'none' : '';
    for (const n of ui.root.querySelectorAll('[data-g="charts"]')) n.style.visibility = ov.charts ? '' : 'hidden';
    frameConsole(T, {
      th,
      cam: view,
      k,
      S: energised ? S : 0,
      tap,
      heat: heatNow,
      cut,
      ov,
      cursor,
      since,
      Ug,
      live: {freeCam: ui.card.style.display === 'block' || !AP.on && (Math.abs(off.az) > 2 || Math.abs(off.el) > 2 || Math.abs(off.k - 1) > 0.04), trip: heat.trip, energised, relink: AP.on ? !energised : !!relink, paused, playText: AP.on ? '1 / 100 SPEED' : playText(PLAYS[playI]), playK: AP.on ? 0.5 : playI / (PLAYS.length - 1)},
    });
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
  // every shader compiles at once off the main thread before the first frame (kit/warm.js)
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, cam, startTour, takeOver, PHASES, get tier() {
    return tier;
  }, get T() {
    return T;
  }};
}
