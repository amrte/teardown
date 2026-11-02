// SIQuench 3AM4 as a page you drive: the film's device and overlay in real time. STRIKE ARC fires an event at the chosen
// slow motion (the detection slider sets when the relay sees it), SIQUENCH ON/OFF runs the same fault without the
// quencher to compare, RECHARGE walks the Spannwerkzeug through the poles (or click a red Tripped LED to charge that
// pole), the timeline scrubs the event, views and display toggles, an orbit you drag, a zoom on the wheel, H hides the
// overlay. Left alone it plays the film's script as an auto tour; a click, drag, wheel or key hands control over and
// 25 s of quiet hands it back.
import {warmComposer} from '../kit/warm.js';
import {CAMS, CLOCK_MAX, createConsole, DISPLAY} from './console.js';
import {camAt, camName, chargeAt, compose, deviceState, DURATION, lookAt, makeConsoleFrame, makeCursor, SCRIPT, slowAt, slowText, tauAt, VIEW_FN, VIEW_LOOK} from './film.js';
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
// slow motion: film seconds per event millisecond x 1000
const SLOWS = [250, 500, 1000, 2000, 4000, 8000];
const CHARGE_S = 7.8;
const END = 60;

const CSS = `
html,body{background:#e9ebed;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.tb{pointer-events:auto;cursor:pointer}
.tb:hover{filter:brightness(.95)}
.tb.dis{cursor:not-allowed}
.hit{position:absolute;pointer-events:auto;cursor:pointer}
.hit.ew{cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:72px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:21px;padding:0 11px;border:1px solid #e1e3e6;background:rgba(255,255,255,.95);color:#16181b;font:600 8.8px Inter,sans-serif;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#00a0a0}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#8b8f95;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

export function runLive() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  document.title = 'SIQuench 3AM4 · Teardown';
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
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
  // the page names a real product: say plainly whose it is and where the numbers come from
  const credit = document.createElement('div');
  credit.className = 'cp';
  credit.style.cssText = 'position:absolute;left:0;right:0;top:889px;text-align:center;font-size:7.4px;font-weight:500;letter-spacing:1.2px;color:#a3a7ac';
  credit.textContent = 'INDEPENDENT EXPLAINER · BUILT FROM SIEMENS MANUAL 9229 0100 100 (06/2026) AND THE SIQUENCH BROCHURE · NOT A SIEMENS PUBLICATION · SIQUENCH® IS A SIEMENS TRADEMARK';
  ui.root.appendChild(credit);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = 'Turn your phone sideways for the full console';
  document.body.appendChild(note);

  // ------------------------------------------------------------ state
  let T = 0;
  let tau = null; // ms after ignition, null: no event
  let kc = [null, null, null]; // per pole recharge progress
  let queue = []; // poles waiting for the tool
  let det = 1.0;
  let quench = true;
  let slowI = 3;
  let paused = false;
  let view = 'hero';
  let viewAt = 0;
  let opsIk = 0;
  let opsMech = 0;
  const disp = {hood: 1, xray: 0, section: 0, explode: 0, labels: 1, current: 1};
  const look = {hood: 1, xray: 0, explode: 0, sys: 0};
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.open(0)};
  let ring = {t: -9, x: 0, y: 0};
  let hidden = false;
  const pulse = (x, y) => (ring = {t: T, x, y});
  const pulseBtn = (k) => pulse(...ui.spots[k]);
  const allReady = () => tau === null || kc.every((k) => k === 1);
  const done = () => tau !== null && tau >= END;
  const canTrip = () => !quench || allReady();
  const canCharge = () => quench && tau !== null && tau > 4.5 && kc.some((k) => k === null) && !queue.length;

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0, loop: 0};
  let lastInput = 0;
  const applyView = (v) => {
    const L = VIEW_LOOK[v];
    Object.assign(disp, {hood: L.hood, section: L.section >= 0 ? 1 : 0, xray: 0, explode: 0});
  };
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.loop = 0;
    paused = false;
    quench = true;
    det = 1.0;
    Object.assign(disp, {labels: 1, current: 1});
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const cyc = (T - AP.t0) % DURATION;
    view = camName(cyc);
    if (view === 'open') view = 'hero';
    viewAt = T - 3;
    tau = tauAt(cyc);
    kc = [0, 1, 2].map((i) => chargeAt(cyc, i));
    if (kc.some((k) => k !== null)) tau = END;
    queue = [];
    kc.forEach((k, i) => {
      if (k !== null && k < 1) queue.push(i);
    });
    const L = lookAt(cyc);
    Object.assign(disp, {hood: L.hood > 0.5 ? 1 : 0, section: L.section >= 0 ? 1 : 0, xray: 0, explode: 0});
    opsIk = tau !== null ? 1 : 0;
    opsMech = opsIk;
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

  // ------------------------------------------------------------ actions
  const strike = () => {
    if (!canTrip()) return;
    tau = 0;
    kc = [null, null, null];
    queue = [];
    paused = false;
    if (quench) {
      opsIk = Math.min(5, opsIk + 1);
      opsMech = Math.min(30, opsMech + 1);
    }
    if (view !== 'system' && view !== 'pole' && view !== 'latch') setView('system');
  };
  const recharge = (poles) => {
    for (const i of poles) if (kc[i] === null && !queue.includes(i)) queue.push(i);
    if (tau !== null && tau < END) tau = END;
    if (view !== 'mech') setView('mech');
  };
  const setView = (v) => {
    view = v;
    viewAt = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
    applyView(v);
  };
  for (const k of CAMS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      setView(k);
    });
  for (const k of DISPLAY)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      disp[k] = disp[k] ? 0 : 1;
    });
  ui.btn.trip.addEventListener('click', () => {
    takeOver();
    pulseBtn('trip');
    strike();
  });
  ui.btn.charge.addEventListener('click', () => {
    takeOver();
    pulseBtn('charge');
    if (canCharge()) recharge([2, 1, 0]);
  });
  ui.btn.pause.addEventListener('click', () => {
    takeOver();
    pulseBtn('pause');
    paused = !paused;
  });
  ui.btn.quench.addEventListener('click', () => {
    takeOver();
    pulseBtn('quench');
    quench = !quench;
    tau = null;
    kc = [null, null, null];
    queue = [];
  });
  // a red Tripped LED charges that pole
  [0, 1, 2].forEach((i) => {
    const [x, y] = ui.ledSpot(i);
    const d = document.createElement('div');
    d.className = 'hit';
    d.title = `Recharge pole L${i + 1}`;
    Object.assign(d.style, {left: `${x - 10}px`, top: `${y - 10}px`, width: '20px', height: '20px', borderRadius: '50%'});
    d.addEventListener('click', () => {
      takeOver();
      pulse(x, y);
      if (canCharge() || (quench && tau !== null && tau > 4.5 && kc[i] === null)) recharge([i]);
    });
    ui.root.appendChild(d);
  });
  // sliders: slow motion and the detection time
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
  slider(ui.slowKnob, (k) => (slowI = Math.round(k * (SLOWS.length - 1))));
  slider(ui.detKnob, (k) => (det = Math.round((0.6 + 0.9 * k) * 10) / 10));
  // the event timeline: click or drag to scrub
  {
    const d = document.createElement('div');
    d.className = 'hit ew';
    Object.assign(d.style, {left: `${ui.TL.x - 10}px`, top: `${ui.TL.y - 22}px`, width: `${ui.TL.w + 20}px`, height: '40px'});
    const move = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      if (!canTrip() && (tau === null || kc.some((k) => k !== null))) return;
      kc = [null, null, null];
      queue = [];
      tau = clamp(((x - ui.TL.x) / ui.TL.w) * CLOCK_MAX, 0, CLOCK_MAX);
      paused = true;
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
    const key = e.key.toLowerCase();
    const v = {1: 'hero', 2: 'front', 3: 'side', 4: 'mech', 5: 'pole', 6: 'latch', 7: 'system'}[key];
    takeOver();
    if (v) setView(v);
    else if (key === ' ') paused = !paused;
    else if (key === 'h') hidden = !hidden;
    else if (key === 'a') strike();
    else if (key === 'r' && canCharge()) recharge([2, 1, 0]);
    else if (key === 'arrowleft' && tau !== null) {
      paused = true;
      tau = Math.max(0, tau - 0.1);
    } else if (key === 'arrowright' && tau !== null) {
      paused = true;
      tau += 0.1;
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
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -40, 70);
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
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.4, 2.4);
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
    let slowTxt;
    let lk;
    let showTau;
    let m;
    let camKey;
    if (AP.on) {
      const c = T - AP.t0;
      const loop = Math.floor(c / DURATION);
      const cyc = c - loop * DURATION;
      if (loop > AP.loop) AP.loop = loop;
      camKey = camName(cyc);
      const tt = tauAt(cyc);
      const kk = [0, 1, 2].map((i) => chargeAt(cyc, i));
      m = compose({tau: kk.some((k) => k !== null) ? 80 : tt, kc: kk, blinkT: T});
      showTau = tt === null ? null : Math.min(tt, 80);
      slowTxt = tt === null || tt >= END ? '1× SPEED' : slowText(slowAt(cyc));
      tgt = camAt(cyc);
      since = cyc - SCRIPT.filter((e) => e.cam && e.t <= cyc).pop().t;
      const L = lookAt(cyc);
      lk = {hood: L.hood, section: L.section, sys: L.sys, xray: 0, explode: 0, current: 1};
      disp.hood = L.hood > 0.5 ? 1 : 0;
      disp.section = L.section >= 0 ? 1 : 0;
      cursor = tourCursor(cyc);
      if (AP.loop > 0 && cyc < 0.8) {
        const end = tourCursor(DURATION - 0.01);
        const k = ss(0, 0.8, cyc);
        cursor = {...cursor, x: end.x + (cursor.x - end.x) * k, y: end.y + (cursor.y - end.y) * k};
      }
      opsIk = tt !== null ? 1 : 0;
      opsMech = opsIk;
    } else {
      if (T - lastInput > IDLE) startTour();
      // the event clock: slow through the trip, faster to the breaker, stopped at 60 ms
      if (tau !== null && !paused && tau < END) {
        const rate = 1000 / SLOWS[slowI];
        tau = Math.min(END, tau + dt * rate * (tau < 6.5 ? 1 : 25));
      }
      // the recharge queue: one pole at a time
      if (queue.length && !paused) {
        const i = queue[0];
        kc[i] = Math.min(1, (kc[i] ?? 0) + dt / CHARGE_S);
        if (kc[i] >= 1) queue.shift();
      }
      m = compose({tau: kc.some((k) => k !== null) ? 80 : tau, kc, quench, det, blinkT: T});
      showTau = tau;
      slowTxt = tau === null || tau >= 6.5 ? (tau !== null && tau < END ? `1 / ${Math.round(SLOWS[slowI] / 25)}` : '1× SPEED') : slowText(SLOWS[slowI]);
      since = T - viewAt;
      tgt = VIEW_FN[view](since);
      tgt.az += off.az;
      tgt.el = clamp(tgt.el + off.el, -30, 80);
      tgt.d *= off.k;
      const L = VIEW_LOOK[view];
      lk = {hood: disp.hood, section: disp.section ? 2 : -1, sys: L.sys, xray: disp.xray, explode: disp.explode, current: disp.current};
      camKey = view;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
    }
    // eased display: the hood, x-ray, explode and the busbars glide
    const e = 1 - Math.exp(-dt / 0.18);
    for (const key of ['hood', 'xray', 'explode', 'sys']) look[key] += ((lk[key] ?? 0) - look[key]) * (AP.on ? 1 : e);
    const kcam = 1 - Math.exp(-dt / (AP.on ? 0.18 : 0.45));
    cam.az += wrap(tgt.az - cam.az) * kcam;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * kcam;
    st.frame(deviceState(m, {...look, section: lk.section, current: lk.current}), {...cam, az: cam.az * D2R, el: cam.el * D2R});

    ui.root.style.display = hidden ? 'none' : '';
    for (const n of ui.root.querySelectorAll('[data-g="charts"]')) n.style.visibility = '';
    frameConsole(m, {
      tau: showTau,
      cam: camKey,
      since,
      cursor,
      quench: AP.on ? true : quench,
      det: AP.on ? 1.0 : det,
      slow: slowTxt,
      slowK: slowI / (SLOWS.length - 1),
      paused,
      display: {...disp},
      opsIk,
      opsMech,
      canTrip: AP.on ? showTau === null : canTrip(),
      canCharge: AP.on ? showTau !== null : canCharge(),
      labels: disp.labels,
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
  void done;
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, cam, startTour, takeOver, strike, get tier() {
    return tier;
  }, get T() {
    return T;
  }, get tau() {
    return tau;
  }};
}
