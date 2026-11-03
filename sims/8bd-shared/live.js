// The 8BD1 teardown as a page you drive. One input, the procedure position p (0..23 steps), poses the panel and feeds
// every readout. ◀◀ / ▶ / ▶▶ walk the procedure (backwards it reassembles), the timeline scrubs it, the checklist
// jumps to a step; views, display modes, isolate, an orbit you drag and a zoom on the wheel. No auto tour: the page
// waits for the visitor.
import {DISPLAY, ISO, VIEWS, createConsole} from './console.js';
import {FASTENERS, N, NAMES, P, STEPS, fastTorque, stateAt} from './kin.js';
import * as THREE from 'three';
import {createView} from './view.js';

const W = 1600;
const H = 900;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
const SPEED = [0.25, 3];
const speedK = (v) => (v - SPEED[0]) / (SPEED[1] - SPEED[0]);

// camera views: target (tx, ty, tz), azimuth (0 = from the front, + from the right), elevation, distance; the
// truck views follow the truck. `cut` turns the section on while the view is shown.
const VIEW_FN = {
  hero: (s) => ({tx: 0.05 - s.travel * 0.2, ty: 1.04 - s.travel * 0.12, tz: 0.25 + s.travel * 0.45, az: -0.62, el: 0.2 + s.travel * 0.08, d: 4.3 + s.travel * 1.6}),
  front: (s) => ({tx: 0.02, ty: 1.0, tz: P.zf + s.travel, az: -0.2, el: 0.1, d: 4.0}),
  shaft: (s) => ({tx: -0.08, ty: 0.5, tz: P.zf + s.travel, az: -0.45, el: 0.22, d: 2.9}),
  side: (s) => ({tx: 0.0, ty: 1.0, tz: 0.1 + s.travel * 0.5, az: -Math.PI / 2, el: 0.06, d: 4.7 + s.travel * 0.9, cut: true}),
  plug: (s) => ({tx: 0.12, ty: 1.2, tz: 0.25 + s.travel * 0.5, az: -1.2, el: 0.22, d: 2.6, cut: true}),
  iso: (s) => ({tx: 0.1, ty: 0.85, tz: 0.55 + s.travel * 0.5, az: 0.78, el: 0.27, d: 6.2}),
  boxes: () => ({tx: 0.05, ty: 0.85, tz: P.zp + 0.1, az: -0.68, el: 0.26, d: 3.4, walls: true}),
  earth: (s) => ({tx: 0.2, ty: 0.55, tz: P.zf - 0.1 + s.travel * 0.4, az: 0.8, el: 0.3, d: 3.4, walls: true}),
  truck: (s) => ({tx: 0.0, ty: 0.72, tz: 0.32 + s.travel, az: -0.72, el: 0.3, d: 3.8}),
  mech: (s) => ({tx: 0.0, ty: 0.58, tz: 0.48 + s.travel, az: -0.4, el: 0.24, d: 2.8}),
  poles: (s) => ({tx: -0.75, ty: 0.5, tz: 0.15 + s.travel, az: -0.9, el: 0.42, d: 3.6}),
  top: () => ({tx: 0.4, ty: 1.1, tz: 0.6, az: 0.55, el: 0.82, d: 4.8}),
  open: () => ({tx: 0.45, ty: 0.75, tz: 0.15, az: 0.42, el: 0.42, d: 5.0}),
  busbars: () => ({tx: 0.05, ty: 0.95, tz: -0.25, az: -0.42, el: 0.14, d: 3.7, walls: true}),
  rear: () => ({tx: 0.2, ty: 1.04, tz: -0.2, az: Math.PI - 0.62, el: 0.24, d: 4.4}),
};

const CSS = `
html,body{background:#eef0ee;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#8a9094;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

export function runLive() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  document.title = '8BD1 Teardown';
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const v = createView({canvas});
  const ui = createConsole(app);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = 'Turn your phone sideways for the full console';
  document.body.appendChild(note);

  // ------------------------------------------------------------ quality tiers
  const TIERS = [{shadow: 2048, pr: 2}, {shadow: 1024, pr: 1.5}, {shadow: 0, pr: 1}];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 1 : 0;
  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    v.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    v.setQuality({shadow: TIERS[tier].shadow});
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };

  // ------------------------------------------------------------ state
  const q = new URLSearchParams(location.search);
  let p = clamp(Number(q.get('step') ?? 0), 0, N);
  let target = p;
  let speed = 1;
  let view = STEPS[Math.min(N - 1, Math.floor(p))].view;
  let userView = false;
  const display = {labels: 1, section: 0, xray: 0, follow: 1, orbit: 0, screws: q.has('fasteners') ? 1 : 0};
  let iso = null;
  const off = {az: 0, el: 0, k: 1};
  let T = 0;
  let orbitT = 0;
  let lastStep = -1;
  const camK = {...VIEW_FN[view](stateAt(p))};
  let labelsT = 0;

  const resetOff = () => Object.assign(off, {az: 0, el: 0, k: 1});
  const goStep = (i) => {
    // a click on a step: jump to its start and play it through
    p = clamp(i, 0, N - 1);
    target = p + 1;
    userView = false;
  };
  ui.btn.play.addEventListener('click', () => {
    if (target !== p) target = p;
    else {
      if (p >= N - 1e-6) p = 0;
      target = N;
    }
  });
  ui.btn.next.addEventListener('click', () => {
    target = Math.min(N, Math.floor(p + 1e-6) + 1);
    userView = false;
  });
  ui.btn.prev.addEventListener('click', () => {
    target = Math.max(0, Math.ceil(p - 1e-6) - 1);
    userView = false;
  });
  STEPS.forEach((_, i) => ui.btn[`step${i}`].addEventListener('click', () => goStep(i)));
  for (const k of VIEWS)
    ui.btn[k].addEventListener('click', () => {
      view = k;
      userView = true;
      resetOff();
    });
  for (const k of DISPLAY)
    ui.btn[k].addEventListener('click', () => {
      display[k] = display[k] ? 0 : 1;
      if (k === 'follow' && display.follow) {
        userView = false;
        resetOff();
      }
      if (k === 'orbit') orbitT = T;
    });
  for (const k of ['all', ...ISO.slice(1)]) ui.btn['iso_' + k].addEventListener('click', () => (iso = k === 'all' || iso === k ? null : k));

  const slider = (x0, w, y, apply) => {
    const d = document.createElement('div');
    d.className = 'hit';
    Object.assign(d.style, {left: `${x0 - 8}px`, top: `${y - 11}px`, width: `${w + 16}px`, height: '22px'});
    const move = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      apply(clamp((x - x0) / w, 0, 1));
    };
    d.addEventListener('pointerdown', (e) => {
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
  slider(ui.TL.x, ui.TL.w, 834, (k) => {
    p = k * N;
    target = p;
  });
  slider(ui.SP.x, ui.SP.w, 791, (k) => (speed = SPEED[0] + k * (SPEED[1] - SPEED[0])));
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const vk = VIEWS[Number(key) - 1];
    if (vk) ui.btn[vk].click();
    else if (key === ' ') ui.btn.play.click();
    else if (key === 'arrowright') ui.btn.next.click();
    else if (key === 'arrowleft') ui.btn.prev.click();
    else if (key === 'l') ui.btn.labels.click();
    else if (key === 's') ui.btn.section.click();
    else if (key === 'x') ui.btn.xray.click();
    else if (key === 'o') ui.btn.orbit.click();
    else if (key === 'f') ui.btn.screws.click();
    else if (key === 'escape') iso = null;
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
    off.az -= ((e.clientX - drag.x) / scale) * 0.006;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.004, -0.3, 1.1);
    drag = {x: e.clientX, y: e.clientY};
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
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.4);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ labels: the current step's parts, with leaders
  // a label is shown only when its point is in sight: a ray from the camera must not meet an opaque part first
  const ray = new THREE.Raycaster();
  const seen = new Map();
  const visible = (id, w) => {
    if (frameNo % 6 !== 0 && seen.has(id)) return seen.get(id);
    const o = v.camera.position;
    const dir = w.clone().sub(o);
    const dist = dir.length();
    ray.set(o, dir.normalize());
    ray.far = dist - 0.04;
    const hit = ray.intersectObject(v.panel.root, true).find((h) => {
      const m = h.object.material;
      if (m.opacity <= 0.5 || m.transparent) return false;
      // a part the section has cut away does not hide anything
      return !(m.clippingPlanes || []).some((pl) => pl.distanceToPoint(h.point) < 0);
    });
    seen.set(id, !hit);
    return !hit;
  };
  let seenKey = '';
  const callouts = (s, fade) => {
    const st = STEPS[s.step];
    const key = `${s.step}|${view}|${display.section}|${iso}|${display.screws}`;
    if (key !== seenKey) {
      seenKey = key;
      seen.clear();
    }
    const out = [];
    // in fastener mode the labels are the fasteners of this step (or, with none, those still fitted in sight)
    let items;
    if (display.screws) {
      const here = FASTENERS.filter((f) => f.step === st.id && s.fast[f.id] < 0.999);
      const rest = FASTENERS.filter((f) => s.fast[f.id] < 0.999);
      items = (here.length ? here : rest).map((f) => ({id: f.id, anchor: `f:${f.id}`, name: f.name, sub: `${f.size || 'size not given'}${f.cls ? ' ' + f.cls : ''} · ${fastTorque(f)}`}));
    } else items = st.focus.map((id) => ({id, anchor: id, name: (NAMES[id] || [id])[0], sub: (NAMES[id] || [id, ''])[1]}));
    for (const it of items) {
      if (out.length >= 7) break;
      const a = v.panel.anchorAt(it.anchor);
      if (!a) continue;
      const w = a.clone();
      if (!visible(it.anchor, w)) continue;
      const at = v.project(w);
      if (!at || at[0] < 330 || at[0] > 1270 || at[1] < 100 || at[1] > 740) continue;
      const wd = Math.max(it.name.length + it.id.length + 1, it.sub.length * 0.83) * 6.4 + 20;
      out.push({id: it.id, name: it.name, sub: it.sub, at, w: wd, o: fade, fast: !!display.screws});
    }
    // left of the screen centre the label goes left, right of it right; then stacked apart
    for (const side of [-1, 1]) {
      const grp = out.filter((c) => (side < 0 ? c.at[0] < 800 : c.at[0] >= 800)).sort((a, b) => a.at[1] - b.at[1]);
      let y = 110;
      for (const c of grp) {
        const ly = Math.max(y, c.at[1] - 26);
        let lx = side < 0 ? c.at[0] - 120 - c.w : c.at[0] + 120;
        // no room on its own side: the label goes to the other side of its anchor
        if (side > 0 && lx + c.w > 1262) lx = c.at[0] - 120 - c.w;
        if (side < 0 && lx < 340) lx = c.at[0] + 120;
        lx = clamp(lx, 340, 1262 - c.w);
        c.label = [lx, Math.min(712, ly)];
        y = c.label[1] + 32;
      }
    }
    return out;
  };

  // ------------------------------------------------------------ the frame
  let last = performance.now();
  let frameNo = 0;
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    frameNo++;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.8) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.6 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.024 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= 2) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }
    // the procedure runs toward its target at each step's own pace
    if (p !== target) {
      const i = Math.min(N - 1, Math.floor(target > p ? p : p - 1e-6));
      const rate = (speed / STEPS[Math.max(0, i)].dur) * dt;
      p = target > p ? Math.min(target, p + rate) : Math.max(target, p - rate);
    }
    const s = stateAt(p);
    if (s.step !== lastStep) {
      lastStep = s.step;
      labelsT = T;
      if (display.follow && !userView) {
        view = STEPS[s.step].view;
        resetOff();
      }
    }
    const tgt = VIEW_FN[view](s);
    tgt.az += off.az + (display.orbit ? 0.25 * (T - orbitT) : 0);
    tgt.el = clamp(tgt.el + off.el, -0.25, 1.35);
    tgt.d *= off.k * 1.45;
    tgt.sy = -28;
    const k = window.LIVE?.snap ? 1 : 1 - Math.exp(-dt / 0.35);
    camK.az += wrap(tgt.az - camK.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sy']) camK[key] = (camK[key] ?? tgt[key]) + (tgt[key] - (camK[key] ?? tgt[key])) * k;
    v.panel.setDisplay({iso, xray: display.xray ? 1 : 0, walls: !!tgt.walls, section: !!(display.section || tgt.cut), screws: !!display.screws});
    v.panel.setFocus(STEPS[s.step].focus, 0.07 + 0.04 * Math.sin(T * 4));
    v.frame(s, camK);
    const fade = display.labels ? (window.LIVE?.snap ? 1 : clamp((T - labelsT - 0.5) / 0.4, 0, 1)) : 0;
    ui.update(s, {view, display, iso, playing: p !== target, speed, speedK: speedK(speed), callouts: fade > 0 ? callouts(s, fade) : []});
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  v.renderer.compileAsync(v.scene, v.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {
    v,
    stateAt,
    set p(x) {
      p = target = x;
    },
    get p() {
      return p;
    },
    setView(x) {
      view = x;
      userView = true;
      resetOff();
    },
    display,
    setIso(x) {
      iso = x;
    },
    follow() {
      userView = false;
      lastStep = -1;
    },
  };
}
