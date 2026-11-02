// The 8DB10-type GIS panel as a page you drive: the film's panel, studio and console in real time. The programs
// (BUSBAR 1, BUSBAR 2, EARTH, FAULT) plan a legal switching sequence from wherever the panel is; the single-device
// buttons go through the same interlocks as the real panel and a refused click shakes and says why. The procedure
// clock slows down by itself around every breaker operation. Seven views, six display modes, an orbit you drag and a
// zoom on the wheel. Left alone it plays the film's script as an auto tour with the operator's cursor, looped; a click,
// drag, wheel or key hands control to the visitor, 25 s of quiet hands it back.
import {warmComposer} from '../kit/warm.js';
import {createConsole, DEVICES, DISPLAY, PROGS, VIEWS} from './console.js';
import {camAt, DISPLAY_ON, displayAt, makeConsoleFrame, makeCursor, viewAt, VIEW_FN} from './film.js';
import {allowed, baseOf, faultEvents, INITIAL, rateAt, stateAt, windows, worstInception} from './gis.js';
import {DURATION, EVENTS, FF, programEvents, SCRIPT, tauAt, WINDOWS} from './program.js';
import {createGisStage} from './stage.js';

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

const CSS = (top) => `
html,body{background:#eceeeb;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.bt{pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.96)}
.tourchip{position:absolute;left:800px;top:104px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:22px;padding:0 11px;border:1px solid #dde2e0;border-radius:4px;background:rgba(250,251,250,.95);color:#23282b;font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#e4572e}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#8a9296;text-transform:uppercase;display:none}
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
  const st = createGisStage({canvas});
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
    const h = innerHeight - top;
    scale = Math.min(innerWidth / W, h / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${top + (h - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    st.setQuality(q);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = 'Turn your phone sideways for the full console';
  document.body.appendChild(note);

  // ------------------------------------------------------------ state: the procedure clock and its events
  let T = 0;
  let tau = 0;
  let events = [];
  let base = INITIAL;
  let win = [];
  let prog = null;
  let progEvents = [];
  let paused = false;
  let refusal = '';
  let refusalT = -9;
  let view = 'hero';
  let viewAt0 = 0;
  const disp = Object.fromEntries(DISPLAY.map((k) => [k, {on: DISPLAY_ON[k] ?? 0, t: -9}]));
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.hero(0)};
  let ring = {t: -9, x: 0, y: 0};
  const eased = (k, dur = 0.7) => {
    const d = disp[k];
    const x = ss(d.t, d.t + dur, T);
    return d.on ? x : 1 - x;
  };
  const pulse = (k) => ui.spots[k] && (ring = {t: T, x: ui.spots[k][0], y: ui.spots[k][1]});
  const now = () => stateAt(events, tau, base);
  const setEvents = (ev) => {
    events = ev.sort((a, b) => a.at - b.at);
    win = windows(events);
  };
  const refuse = (key, reason) => {
    refusal = reason;
    refusalT = T;
    ui.refuse(key);
  };

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0, loop: 0};
  let lastInput = 0;
  let tourCyc = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.loop = 0;
    paused = false;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    // carry the film's panel over: what has happened, plus the rest of the program that is running
    const cyc = tourCyc;
    const [t0, v] = viewAt(cyc);
    view = v;
    viewAt0 = T - (cyc - t0);
    tau = tauAt(cyc);
    const p = SCRIPT.filter((e) => e.prog && e.t <= cyc).pop();
    base = INITIAL;
    setEvents(EVENTS.filter((e) => e.at <= tau || (p && p.events.includes(e))));
    prog = p?.prog ?? null;
    progEvents = p?.events ?? [];
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
  const syncDisplay = (cyc) => {
    const want = displayAt(cyc);
    for (const k of DISPLAY) {
      if (disp[k].on !== want[k]) {
        disp[k].on = want[k];
        disp[k].t = T;
      }
    }
  };

  // ------------------------------------------------------------ controls
  // a manual operation cancels whatever is left of a running program
  const dropPending = () => {
    setEvents(events.filter((e) => e.at <= tau));
  };
  for (const p of [...PROGS, 'fault'])
    ui.btn[p].addEventListener('click', () => {
      takeOver();
      pulse(p);
      const s = now();
      if (p === 'fault') {
        const a = allowed(s, 'fault');
        if (!a.ok) return refuse(p, a.reason);
        // the auto-reclose needs the closing spring charged before the fault
        dropPending();
        const ev = faultEvents(worstInception(tau + 0.05), s.spring >= 1);
        setEvents([...events, ...ev]);
        prog = 'fault';
        progEvents = ev;
        refusal = s.spring >= 1 ? '' : 'SPRING NOT CHARGED · NO AUTO-RECLOSE';
        refusalT = T;
        return;
      }
      if (s.busy) return refuse(p, 'OPERATION IN PROGRESS');
      dropPending();
      const ev = programEvents(p, now(), tau);
      setEvents([...events, ...ev]);
      prog = p;
      progEvents = ev;
      refusal = '';
    });
  for (const [dev, to] of DEVICES) {
    const key = `${dev}:${to}`;
    ui.btn[key].addEventListener('click', () => {
      takeOver();
      pulse(key);
      dropPending();
      const s = now();
      const a = allowed(s, dev, to);
      if (!a.ok) return refuse(key, a.reason);
      const ev = [{at: tau + 0.05, dev, to}];
      setEvents([...events, ...ev]);
      prog = null;
      progEvents = ev;
      refusal = '';
    });
  }
  for (const v of VIEWS)
    ui.btn[v].addEventListener('click', () => {
      takeOver();
      pulse(v);
      view = v;
      viewAt0 = T;
      Object.assign(off, {az: 0, el: 0, k: 1});
    });
  for (const k of DISPLAY)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      disp[k].on = disp[k].on ? 0 : 1;
      disp[k].t = T;
    });
  ui.btn.play.addEventListener('click', () => {
    takeOver();
    pulse('play');
    paused = !paused;
  });
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const v = VIEWS[Number(key) - 1];
    if (v) ui.btn[v].click();
    else if (key === ' ') ui.btn.play.click();
    else if (key === 'x') ui.btn.xray.click();
    else if (key === 's') ui.btn.section.click();
    else if (key === 'g') ui.btn.gas.click();
    else if (key === 'l') ui.btn.labels.click();
    else if (key === 'f') ui.btn.fault.click();
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
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -25, 60);
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

  // ------------------------------------------------------------ the frame
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (nowMs) => {
    const dt = Math.min(0.1, Math.max(0, (nowMs - last) / 1000));
    last = nowMs;
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
    let s;
    let r;
    let evs;
    let pEv;
    let pr;
    if (AP.on) {
      const c = T - AP.t0;
      const loop = Math.floor(c / DURATION);
      const cyc = c - loop * DURATION;
      tourCyc = cyc;
      if (loop > AP.loop) AP.loop = loop;
      syncDisplay(cyc);
      tgt = camAt(cyc, displayAt(cyc).orbit);
      const [t0, v] = viewAt(cyc);
      view = v;
      since = cyc - t0;
      cursor = tourCursor(cyc);
      if (AP.loop > 0 && cyc < 0.8) {
        const end = tourCursor(DURATION - 0.01);
        const k = ss(0, 0.8, cyc);
        cursor = {...cursor, x: end.x + (cursor.x - end.x) * k, y: end.y + (cursor.y - end.y) * k};
      }
      const tu = tauAt(cyc);
      s = stateAt(EVENTS, tu);
      r = rateAt(WINDOWS, tu, s.springBusy ? FF : 1, s.q1.pos === 'moving' || s.q2.pos === 'moving');
      evs = EVENTS;
      const p = SCRIPT.filter((e) => e.prog && e.t <= cyc).pop();
      pEv = p?.events ?? [];
      pr = p?.prog ?? null;
    } else {
      if (T - lastInput > IDLE) startTour();
      const s0 = now();
      r = rateAt(win, tau, 1, s0.q1.pos === 'moving' || s0.q2.pos === 'moving');
      if (!paused) tau += dt * r;
      // fold old history into the base so the event list stays short
      if (events.length > 24 && !s0.busy) {
        const keep = events.filter((e) => e.at > tau - 1);
        base = baseOf(stateAt(events.filter((e) => e.at <= tau - 1), tau - 1, base));
        setEvents(keep);
      }
      s = now();
      evs = events;
      pEv = progEvents;
      pr = prog;
      since = T - viewAt0;
      tgt = VIEW_FN[view](since);
      tgt.az += off.az + (disp.orbit.on ? 12 * (T - disp.orbit.t) : 0);
      tgt.el = clamp(tgt.el + off.el, -20, 88);
      tgt.d *= off.k;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
    }
    const k = 1 - Math.exp(-dt / (AP.on ? 0.18 : 0.45));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;
    const o = {xray: eased('xray'), gas: eased('gas'), section: !!disp.section.on, ghost: eased('ghost'), ambient: 20};
    st.frame(s, o, {...cam, az: cam.az * D2R, el: cam.el * D2R});
    const display = Object.fromEntries(DISPLAY.map((x) => [x, disp[x].on]));
    frameConsole({s, events: evs, prog: pr, progEvents: pEv, rate: AP.on ? r : r * (paused ? 0 : 1), view, display, labels: eased('labels', 0.5) * ss(1.1, 1.7, since), cursor, paused: AP.on ? false : paused, refusal: T - refusalT < 6 ? refusal : '', gas: o.gas, ambient: 20});
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
  window.LIVE = {st, cam, startTour, takeOver, get tier() {
    return tier;
  }, get T() {
    return T;
  }, get tau() {
    return tau;
  }, get events() {
    return events;
  }};
}
