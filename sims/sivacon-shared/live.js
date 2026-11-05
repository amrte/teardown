// SIVACON S8 as a page you drive: configure the lineup (add, remove, move, duplicate and replace fields, change
// widths, fill the device compartments with withdrawable units, fixed-mounted modules, plug-in strips), take it apart
// stage by stage, pull a withdrawable unit to TEST, DISCONNECTED or out, point at any part for its data, orbit,
// pan, zoom. Left alone it plays an operator's tour with a cursor on the real controls; any click, drag, wheel or key
// hands control over, 25 s of quiet hands it back. The configuration lives in the URL hash, so a link reopens it.
import * as THREE from 'three';
import {warmComposer} from '../kit/warm.js';
import {buildBoard} from './board.js';
import {DEFAULT, FIELD_TYPES, MODULE_KINDS, PRESETS, SYSTEM, normalise, newField, defaultModules} from './catalog.js';
import {C, createConsole} from './console.js';
import {layout} from './layout.js';
import {NSTAGE} from './registry.js';
import {createStage} from './stage.js';
import {TOUR, TOUR_LEN} from './tour.js';
import {NMAINT, settingsFor} from './wl.js';
import {etuKey, injectFault, noteChange, PROCS, posAt, RACK, resetStates, startProc, step as simStep, TURNS} from './wl_sim.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};

const CSS = `
html,body{background:#ecedef;overflow:hidden;margin:0}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
#gl.hov{cursor:pointer}
.tourchip{position:absolute;left:800px;top:28px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:21px;padding:0 11px;border:1px solid #e1e3e6;background:rgba(255,255,255,.95);color:#16181b;font:600 8.8px Inter,sans-serif;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto;z-index:5}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#d6182b}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
`;

const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dec = (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));

export function runLive() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const q = new URLSearchParams(location.search);
  const LO = q.has('lo');
  const SPEED = Number(q.get('speed') || 1);
  const st = createStage({canvas, lo: LO});

  // ------------------------------------------------------------ state
  let fromHash = null;
  try {
    if (location.hash.length > 2) fromHash = normalise(dec(location.hash.slice(1)));
  } catch (e) {
    console.warn('bad config in hash', e);
  }
  const S = {
    cfg: fromHash || normalise(structuredClone(DEFAULT)),
    sel: 0,
    mod: -1,
    x: 0,
    xT: 0,
    scope: 'field',
    view: 'iso',
    viewAt: 0,
    layers: {enclosure: 'solid', doors: true, busbar: true, units: true, hardware: true, labels: true},
    doors: 0,
    doorsT: 0,
    wlx: 0,
    solo: 0, // 0 off · 1 the 3WL with its guide frame · 2 the breaker alone
    etuOpen: false,
  };
  let R = layout(S.cfg);
  let board = null;
  let pinned = null;
  let hover = null;
  let T = 0;

  const ui = createConsole(app, (verb, arg, node) => act(verb, arg, node));
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);

  // ------------------------------------------------------------ build / rebuild the board from the configuration
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({color: C.red, transparent: true, opacity: 0.9, depthTest: false}));
  outline.renderOrder = 10;
  outline.visible = false;
  st.scene.add(outline);
  const selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineDashedMaterial({color: C.red, dashSize: 0.03, gapSize: 0.02, transparent: true, opacity: 0.55, depthTest: false}));
  selBox.renderOrder = 9;
  st.scene.add(selBox);
  const procBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({color: '#e7c11e', transparent: true, opacity: 1, depthTest: false}));
  procBox.renderOrder = 11;
  procBox.visible = false;
  st.scene.add(procBox);

  const rebuild = (keepCam = true) => {
    S.cfg = normalise(S.cfg);
    S.sel = clamp(S.sel, 0, S.cfg.fields.length - 1);
    const f = S.cfg.fields[S.sel];
    if (!f || S.mod >= f.modules.length) S.mod = -1;
    R = layout(S.cfg);
    if (board) {
      st.scene.remove(board.root);
      board.dispose();
    }
    board = buildBoard(S.cfg, R);
    st.scene.add(board.root);
    st.fitShadow(board.bbox);
    board.setLayers(S.layers);
    if (S.solo) board.setSolo(S.sel, S.solo);
    pinned = null;
    hover = null;
    ui.refresh(S, R);
    if (!AP.on) history.replaceState(null, '', '#' + enc(S.cfg));
    if (!keepCam) S.viewAt = T - 9;
  };

  // ------------------------------------------------------------ the 3WL as a machine (wl_sim.js)
  const wlOf = (fi = S.sel) => {
    const fd = S.cfg.fields[fi];
    return fd && board ? board.wlStates.find((w) => w.key.startsWith(fd.tag + ':')) || null : null;
  };
  // the procedures that take the breaker from where it is to a target position
  const planTo = (ws, target) => {
    const removed = ws.rack >= RACK.removed - 1;
    let cur = removed ? 'removed' : posAt(ws.rack);
    const names = [];
    if (cur === target) return names;
    if (ws.closed) names.push('open');
    if (cur === 'removed') {
      names.push('insert');
      cur = 'disconnected';
    }
    if (target === 'connected') names.push('rackIn');
    else if (target === 'test') names.push('rackTest');
    else if (target === 'disconnected') {
      if (cur !== 'disconnected') names.push('rackOut');
    } else if (target === 'removed') {
      if (cur !== 'disconnected') names.push('rackOut');
      names.push('withdraw');
    }
    return names;
  };
  const planFor = (ws, name) => {
    if (name.startsWith('to:')) return planTo(ws, name.slice(3));
    const p = ws.rack >= RACK.removed - 1 ? 'removed' : posAt(ws.rack);
    return planTo(ws, {connected: 'test', test: 'disconnected', disconnected: 'connected', removed: 'disconnected', between: 'disconnected'}[p]);
  };
  const runPlan = (ws, names) => {
    if (!names.length) return;
    ws.queue = names.slice(1);
    const why = startProc(ws, names[0]);
    if (why) {
      ws.queue = [];
      ui.say(why);
    }
  };
  const wlAction = (ws, name, fd) => {
    if (!ws) return;
    if (fd.opts.wlMount === 'fixed' && /^to:|rack|withdraw|insert/.test(name)) return ui.say('Fixed-mounted breaker: no racking');
    // a new target while the breaker is moving: it follows once the running procedure ends
    if (ws.proc && (name.startsWith('to:') || name === 'rackNext')) {
      ws.queue = [];
      ws.pendingTo = name;
      return ui.say(`Next: ${name.startsWith('to:') ? 'rack to ' + name.slice(3) : 'next position'}, after ${ws.proc.label.toLowerCase()}`);
    }
    if (name.startsWith('to:') || name === 'rackNext') return runPlan(ws, planFor(ws, name));
    if (name === 'reset' && !ws.tripped) {
      ws.resetPress = 1;
      setTimeout(() => (ws.resetPress = 0), 200);
      return;
    }
    runPlan(ws, [name]);
  };
  // a press on the trip unit, from the replica or from the 3D model
  const etuHit = (ws, id, dir, fd) => {
    if (!ws || !id) return;
    const o = fd.opts;
    const setOpt = (k, v) => act('optset', `${k}:${v}`);
    if (['up', 'down', 'esc', 'enter', 'test', 'query', 'clear'].includes(id)) return etuKey(ws, id, setOpt);
    if (id === 'reset') return wlAction(ws, 'reset', fd);
    if (id.startsWith('knob:')) {
      const k = id.slice(5);
      const s = settingsFor(o).find((x) => x.key === k);
      if (!s) return;
      const i = s.steps.map(String).indexOf(String(o[k]));
      const v = s.steps[(i + dir + s.steps.length) % s.steps.length];
      noteChange(ws, s.label, `${v}${s.unit ? ' ' + s.unit : ''}`, typeof v === 'number' && s.unit === '× In' ? `= ${Math.round(v * o.wlIn)} A` : '');
      return setOpt(k, v);
    }
    if (id === 'slide:INon') return setOpt('wlIN', o.wlIN === 'OFF' ? 1 : 'OFF');
    if (id === 'slide:INval') return o.wlIN !== 'OFF' && setOpt('wlIN', o.wlIN === 1 ? 0.5 : 1);
    if (id === 'slide:mem') ws.etu.mem = ws.etu.mem === false;
    if (id === 'slide:i4t') ws.etu.i4t = !ws.etu.i4t;
  };

  // ------------------------------------------------------------ actions: every button, the tour and the keys call this
  const pulseAt = (p) => p && (ring = {t: T, x: p[0], y: p[1]});
  let ring = {t: -9, x: 0, y: 0};
  const act = (verb, arg, node) => {
    if (verb === 'takeover') return takeOver();
    if (!AP.playing) takeOver();
    if (node) {
      const r = node.getBoundingClientRect();
      const a = app.getBoundingClientRect();
      const s = a.width / W;
      pulseAt([(r.left + r.width / 2 - a.left) / s, (r.top + r.height / 2 - a.top) / s]);
    }
    const cfg = S.cfg;
    const f = cfg.fields[S.sel];
    const [a0, a1] = String(arg ?? '').split(':');
    let rb = false;
    switch (verb) {
      case 'td':
        if (arg === 'step') S.xT = Math.min(1, (Math.floor(S.xT * NSTAGE + 1e-3) + 1) / NSTAGE);
        else S.xT = Number(arg);
        break;
      case 'tdset':
        S.xT = S.x = Number(arg);
        break;
      case 'scope':
        S.scope = S.scope === 'all' ? 'field' : 'all';
        ui.refresh(S, R);
        break;
      case 'view':
        S.view = arg;
        S.viewAt = T;
        Object.assign(off, {az: 0, el: 0, k: 1, px: 0, py: 0});
        ui.refresh(S, R);
        break;
      case 'layer': {
        if (arg === 'enclosure') S.layers.enclosure = {solid: 'glass', glass: 'off', off: 'solid'}[S.layers.enclosure];
        else S.layers[arg] = !S.layers[arg];
        board.setLayers(S.layers);
        ui.refresh(S, R);
        break;
      }
      case 'field':
        S.sel = Number(arg);
        S.mod = -1;
        S.wlx = 0;
        if (S.solo) {
          if (String(S.cfg.fields[S.sel].opts?.acb || '').startsWith('3WL')) board.setSolo(S.sel, S.solo);
          else {
            S.solo = 0;
            board.setSolo(S.sel, 0);
            S.view = 'field';
          }
        }
        if (S.view === 'field') S.viewAt = T;
        ui.refresh(S, R);
        break;
      case 'fieldadd': {
        const nf = newField(arg === '-1' ? cfg.fields[0]?.type || 'universal' : 'universal', cfg);
        if (arg === '-1') {
          cfg.fields.unshift(nf);
          S.sel = 0;
        } else {
          cfg.fields.push(nf);
          S.sel = cfg.fields.length - 1;
        }
        S.mod = -1;
        ui.say(`Field added ${arg === '-1' ? 'on the left' : 'on the right'}: ${FIELD_TYPES[nf.type].name}, ${nf.width} mm`);
        rb = true;
        break;
      }
      case 'fielddel':
        if (cfg.fields.length > 1) {
          const gone = cfg.fields.splice(S.sel, 1)[0];
          ui.say(`Field ${gone.tag} removed`);
          S.sel = Math.min(S.sel, cfg.fields.length - 1);
          rb = true;
        }
        break;
      case 'fielddup': {
        const c = structuredClone(f);
        delete c.tag;
        cfg.fields.splice(S.sel + 1, 0, c);
        S.sel++;
        rb = true;
        break;
      }
      case 'fieldmove': {
        const j = S.sel + Number(arg);
        if (j >= 0 && j < cfg.fields.length) {
          [cfg.fields[S.sel], cfg.fields[j]] = [cfg.fields[j], cfg.fields[S.sel]];
          S.sel = j;
          rb = true;
        }
        break;
      }
      case 'type': {
        if (f.type === arg) break;
        const T2 = FIELD_TYPES[arg];
        f.type = arg;
        if (!T2.widths.includes(f.width)) f.width = T2.width;
        f.modules = defaultModules(arg, f.width, cfg);
        f.opts = {};
        S.mod = -1;
        ui.say(`Field ${f.tag} replaced with ${T2.name}`);
        rb = true;
        break;
      }
      case 'width':
        f.width = Number(arg);
        if (FIELD_TYPES[f.type].fixedModules) f.modules = defaultModules(f.type, f.width, cfg);
        rb = true;
        break;
      case 'opt':
        f.opts = {...(f.opts || {}), [a0]: isNaN(Number(a1)) ? a1 : Number(a1)};
        if (a0 === 'acb') S.wlx = 0;
        if (FIELD_TYPES[f.type].fixedModules) f.modules = defaultModules(f.type, f.width, cfg, f.opts);
        rb = true;
        break;
      case 'sys': {
        const o = SYSTEM.options.find((x) => x.key === a0);
        cfg[a0] = typeof o.values[0] === 'number' ? Number(a1) : a1;
        rb = true;
        break;
      }
      case 'preset':
        S.cfg = normalise(structuredClone(PRESETS[arg]));
        S.sel = 0;
        S.mod = -1;
        rb = true;
        break;
      case 'wlstep': {
        // the 3WL maintenance teardown, one step of OI chapter 23 at a time; stepping out of the guide frame racks the
        // breaker to DISCON and then to the maintenance position, stepping all the way back racks it in again
        const n = Math.round((S.wlx || 0) * NMAINT);
        const t = arg === 'all' ? NMAINT : arg === '0' ? 0 : Math.max(0, Math.min(NMAINT, n + Number(arg)));
        S.wlx = t / NMAINT;
        const fixed = f.opts.wlMount === 'fixed';
        for (const m of f.modules) if (m.kind === 'acb' && !fixed) m.pos = t >= 2 ? 'removed' : t >= 1 ? 'disconnected' : 'connected';
        const ws = wlOf();
        if (ws) {
          ws.proc = null;
          ws.queue = [];
          ws.pendingTo = null;
          if (t >= 1) {
            ws.closed = false;
            ws.charged = false;
          } else {
            ws.closed = true;
            ws.charged = f.opts.wlMech === 'motor';
            ws.tripped = false;
          }
          if (!fixed) {
            ws.rack = t >= 2 ? RACK.removed : t >= 1 ? RACK.disconnected : RACK.connected;
            ws.turns = t >= 1 ? 0 : TURNS.connected;
            ws.door = t >= 2 ? 1 : 0;
            ws.rails = t >= 2 ? 1 : 0;
          }
        }
        if (S.view !== 'field' && t > 0) {
          S.view = 'field';
          S.viewAt = T;
        }
        ui.refresh(S, R);
        break;
      }
      case 'optset': {
        const v = a1 === 'OFF' || a1 === 'MAX' || isNaN(Number(a1)) ? a1 : Number(a1);
        f.opts = {...f.opts, [a0]: v};
        rb = true;
        break;
      }
      case 'wlproc':
        wlAction(wlOf(), arg, f);
        break;
      case 'wlsolo':
        S.solo = arg === '' || arg === undefined ? (S.solo + 1) % 3 : Number(arg);
        board.setSolo(S.sel, S.solo);
        S.view = S.solo ? 'solo' : 'field';
        S.viewAt = T;
        if (S.solo) S.xT = 0;
        Object.assign(off, {az: 0, el: 0, k: 1, px: 0, py: 0});
        ui.refresh(S, R);
        break;
      case 'wletu':
        S.etuOpen = !S.etuOpen;
        ui.refresh(S, R);
        break;
      case 'wlfault': {
        const why = injectFault(wlOf(), arg);
        if (why) ui.say(why);
        break;
      }
      case 'wlload': {
        const ws = wlOf();
        if (ws) ws.load = clamp(Math.round((ws.load + Number(arg)) * 100) / 100, 0, 1.3);
        break;
      }
      case 'etuhit': {
        // id may itself contain ':' (knob:wlIr); the direction is the last field
        const parts = String(arg).split(':');
        const dir = Number(parts.pop());
        etuHit(wlOf(), parts.join(':'), dir || 1, f);
        break;
      }
      case 'optstep': {
        const st = settingsFor(f.opts).find((x) => x.key === a0);
        if (!st) break;
        const i = st.steps.map(String).indexOf(String(f.opts[a0]));
        f.opts[a0] = st.steps[Math.max(0, Math.min(st.steps.length - 1, i + Number(a1)))];
        rb = true;
        break;
      }
      case 'mod':
        S.mod = S.mod === Number(arg) ? -1 : Number(arg);
        ui.refresh(S, R);
        break;
      case 'addmod': {
        const K = MODULE_KINDS[a0];
        f.modules.push({kind: a0, h: Number(a1), cols: K.cols ? K.cols[0] : 1, label: K.label || ''});
        S.mod = f.modules.length - 1;
        rb = true;
        break;
      }
      case 'moddel':
        f.modules.splice(S.mod, 1);
        S.mod = Math.min(S.mod, f.modules.length - 1);
        rb = true;
        break;
      case 'moddup':
        f.modules.splice(S.mod + 1, 0, structuredClone(f.modules[S.mod]));
        S.mod++;
        rb = true;
        break;
      case 'modmove': {
        const j = S.mod + Number(arg);
        if (j >= 0 && j < f.modules.length) {
          [f.modules[S.mod], f.modules[j]] = [f.modules[j], f.modules[S.mod]];
          S.mod = j;
          rb = true;
        }
        break;
      }
      case 'modkind': {
        const m = f.modules[S.mod];
        const K = MODULE_KINDS[arg];
        m.kind = arg;
        if (!K.heights.includes(m.h)) m.h = K.heights.find((h) => h >= m.h) ?? K.heights[K.heights.length - 1];
        m.cols = K.cols ? (K.cols.includes(m.cols) ? m.cols : K.cols[0]) : 1;
        m.label = K.label || '';
        delete m.pos;
        rb = true;
        break;
      }
      case 'modh':
        f.modules[S.mod].h = Number(arg);
        rb = true;
        break;
      case 'modcols':
        f.modules[S.mod].cols = Number(arg);
        rb = true;
        break;
      case 'modpos':
        if (f.type === 'acb' && String(f.opts.acb).startsWith('3WL') && f.modules[S.mod]?.kind === 'acb') {
          // the 3WL moves the way the manual says: switch off, handle out, crank, handle in (wl_sim.js)
          wlAction(wlOf(), `to:${arg}`, f);
          f.modules[S.mod].pos = arg;
          ui.refresh(S, R);
          break;
        }
        f.modules[S.mod].pos = arg;
        ui.refresh(S, R);
        history.replaceState(null, '', '#' + enc(S.cfg));
        break;
      case 'export': {
        const blob = new Blob([JSON.stringify({config: S.cfg, bom: R.bom.filter((b) => b[0] !== '—')}, null, 2)], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'sivacon-s8-lineup.json';
        a.click();
        break;
      }
      case 'link':
        history.replaceState(null, '', '#' + enc(S.cfg));
        navigator.clipboard?.writeText(location.href).then(
          () => ui.say('Link with this configuration copied'),
          () => ui.say('Link is in the address bar'),
        );
        break;
    }
    if (rb) rebuild();
  };

  // ------------------------------------------------------------ the tour
  const AP = {on: true, t0: 0, loop: 0, i: 0, playing: false};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.i = 0;
    S.cfg = normalise(structuredClone(DEFAULT));
    S.sel = 0;
    S.mod = -1;
    S.x = S.xT = 0;
    S.scope = 'field';
    S.wlx = 0;
    S.solo = 0;
    S.etuOpen = false;
    resetStates();
    S.view = 'iso';
    S.viewAt = T;
    S.layers = {enclosure: 'solid', doors: true, busbar: true, units: true, hardware: true, labels: true};
    Object.assign(off, {az: 0, el: 0, k: 1, px: 0, py: 0});
    rebuild();
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    history.replaceState(null, '', '#' + enc(S.cfg));
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.target !== tourChip && e.isTrusted) takeOver();
  });
  // the cursor: glides to each step's control, presses on the beat
  const spotOf = (s) => (typeof s.at === 'function' ? s.at(ui, S, R, board, st) : ui.spot(s.at)) || [800, 450];
  const tourCursor = (c) => {
    const steps = TOUR;
    let i = steps.findIndex((s) => s.t > c);
    if (i < 0) i = steps.length;
    const prev = steps[i - 1];
    const next = steps[i];
    const p0 = prev ? prev._p || [1460, 640] : [1460, 640];
    if (!next) return {x: p0[0], y: p0[1], press: false};
    const p1 = spotOf(next);
    next._p = p1;
    const k = smoother((c - (next.t - 0.9)) / 0.8);
    const press = c > next.t - 0.08 && c < next.t + 0.1;
    return {x: p0[0] + (p1[0] - p0[0]) * k, y: p0[1] + (p1[1] - p0[1]) * k, press};
  };

  // ------------------------------------------------------------ camera: named views + the visitor's orbit, pan, zoom
  const off = {az: 0, el: 0, k: 1, px: 0, py: 0};
  const VIEW = {
    iso: () => {
      const b = R.length / 1000;
      const k = S.scope === 'all' ? 1 + S.x * 0.6 : 1 + S.x * 0.25;
      return {tx: (board ? board.fieldCentre(S.scope === 'all' ? Math.floor((S.cfg.fields.length - 1) / 2) : S.sel) : b / 2) * 0.35 + (b / 2) * 0.65, ty: 1.05 + S.x * 0.15, tz: 0.2 * S.x, az: 32, el: 16 + S.x * 6, d: Math.max(4.6, b * 1.5 + 2.6) * k};
    },
    front: () => ({tx: R.length / 2000, ty: 1.12, tz: 0, az: 0, el: 3, d: Math.max(4.4, (R.length / 1000) * 1.65 + 2.2)}),
    rear: () => ({tx: R.length / 2000, ty: 1.12, tz: 0, az: 180, el: 6, d: Math.max(4.4, (R.length / 1000) * 1.65 + 2.2)}),
    side: () => ({tx: 0, ty: 1.12, tz: 0, az: -90, el: 5, d: 4.4}),
    top: () => ({tx: R.length / 2000, ty: 1.2, tz: 0, az: 0.01, el: 84, d: Math.max(4.4, (R.length / 1000) * 1.7 + 2)}),
    solo: () => {
      const c = board?.wlCenter(S.sel);
      if (!c) return VIEW.field();
      return {tx: c.x, ty: c.y + 0.04, tz: c.z, az: 32, el: 14, d: 1.75 + 1.3 * (S.wlx || 0)};
    },
    field: () => {
      const fx = board?.fieldCentre(S.sel) ?? 0.5;
      const k = S.wlx || 0;
      return {tx: fx - 0.15 * S.x, ty: 1.15 + 0.1 * S.x, tz: 0.25 + 0.3 * S.x + 0.85 * k, az: 28 + 22 * k, el: 12 + 6 * S.x + 8 * k, d: (5.6 + 3.2 * S.x) * (1 - 0.25 * k)};
    },
  };
  const cam = {...VIEW.iso(), sx: 0, sy: 0};

  // ------------------------------------------------------------ pointer: orbit (left), pan (right / shift), wheel zoom, pick
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let scale = 1;
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };
  const pickAt = (cx, cy) => {
    if (!board) return null;
    const [x, y] = toStage(cx, cy);
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
    st.place({...cam, az: cam.az * D2R, el: cam.el * D2R});
    ray.setFromCamera(ndc, st.camera);
    return board.pick(ray);
  };
  let drag = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, pan: e.button === 2 || e.shiftKey};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  let hoverAt = null;
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) {
      hoverAt = [e.clientX, e.clientY];
      return;
    }
    const dx = (e.clientX - drag.x) / scale;
    const dy = (e.clientY - drag.y) / scale;
    if (drag.pan) {
      off.px -= dx * cam.d * 0.0011;
      off.py += dy * cam.d * 0.0011;
    } else {
      off.az -= dx * 0.3;
      off.el = clamp(off.el + dy * 0.2, -30, 80);
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
    lastInput = T;
  });
  const endDrag = (e) => {
    if (drag && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4) click(e);
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => {
    drag = null;
    canvas.classList.remove('drag');
  });
  canvas.addEventListener('pointerleave', () => (hoverAt = null));
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.12, 3);
    },
    {passive: false},
  );
  let lastClick = {t: -9, id: -1};
  const click = (e) => {
    const hit = pickAt(e.clientX, e.clientY);
    if (!hit) {
      pinned = null;
      return;
    }
    pinned = hit;
    if (hit.field >= 0 && hit.field !== S.sel) {
      S.sel = hit.field;
      S.mod = -1;
    }
    // a press on the 3D trip unit or on an operable part (buttons, lever, racking handle, RESET)
    const fd = S.cfg.fields[S.sel];
    if (hit.etu) {
      const z = hit.etu.hits?.find((h) => hit.etu.x >= h.x && hit.etu.x <= h.x + h.w && hit.etu.y >= h.y && hit.etu.y <= h.y + h.h);
      if (z) {
        etuHit(hit.etu.st, z.id, e.button === 2 || e.shiftKey ? -1 : 1, fd);
        return;
      }
    }
    if (hit.action) {
      wlAction(wlOf(), hit.action, fd);
      return;
    }
    if (hit.module >= 0) {
      const dbl = T - lastClick.t < 0.4 && lastClick.id === hit.module;
      S.mod = hit.module;
      const m = S.cfg.fields[S.sel].modules[S.mod];
      const K = MODULE_KINDS[m?.kind];
      if (dbl && K?.positions) {
        const i = K.positions.indexOf(m.pos || K.positions[0]);
        m.pos = K.positions[(i + 1) % K.positions.length];
        ui.say(`${K.name}: ${m.pos.toUpperCase()}`);
      }
      lastClick = {t: T, id: hit.module};
    }
    ui.refresh(S, R);
  };
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const v = {1: 'iso', 2: 'front', 3: 'rear', 4: 'side', 5: 'top', 6: 'field'}[key];
    takeOver();
    if (v) act('view', v);
    else if (key === 'e') act('td', 'step');
    else if (key === 'a') act('td', '0');
    else if (key === 'x') act('td', '1');
    else if (key === 'arrowleft') act('field', String(Math.max(0, S.sel - 1)));
    else if (key === 'arrowright') act('field', String(Math.min(S.cfg.fields.length - 1, S.sel + 1)));
    else if (key === 'delete') act('fielddel');
    else if (key === 'd') {
      S.doorsT = S.doorsT > 0.5 ? 0 : 1;
    } else if (key === 'h') ui.root.style.display = ui.root.style.display ? '' : 'none';
    else return;
    e.preventDefault();
  });

  // ------------------------------------------------------------ quality tiers (an integrated GPU drops to 2 quickly)
  const TIERS = [
    {samples: 4, ao: true, shadow: 2048, pr: 2},
    {samples: 4, ao: false, shadow: 2048, pr: 1.5},
    {samples: 0, ao: false, shadow: 1024, pr: 1},
  ];
  const light = LO || matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 2 : 0;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...qq} = TIERS[tier];
    st.setQuality(qq);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);

  // ------------------------------------------------------------ the frame
  rebuild();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const v3 = new THREE.Vector3();
  const frame = (now) => {
    // ?speed=N runs the clock N times faster (reviewing the tour on a slow renderer)
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)) * SPEED;
    last = now;
    T += dt;
    if (tier < TIERS.length - 1 && !q.has('notier')) {
      perf.age += dt;
      if (perf.age > 0.8) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.024 ? perf.slow + 1 : 0;
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

    // the tour fires its steps on time
    let cursor;
    if (AP.on) {
      const c = T - AP.t0;
      if (c >= TOUR_LEN) {
        startTour();
      } else {
        while (AP.i < TOUR.length && TOUR[AP.i].t <= c) {
          const s = TOUR[AP.i++];
          AP.playing = true;
          const p = spotOf(s);
          pulseAt(p);
          s.do(act, S, R);
          AP.playing = false;
        }
      }
      const cu = tourCursor(T - AP.t0);
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {...cu, ring: rk, ringX: ring.x, ringY: ring.y};
    } else {
      if (T - lastInput > IDLE && !q.has('notour')) startTour();
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
    }

    // teardown, doors and the units ease toward their targets
    S.x += (S.xT - S.x) * (1 - Math.exp(-dt / 0.42));
    if (Math.abs(S.xT - S.x) < 1e-4) S.x = S.xT;
    S.doors += (S.doorsT - S.doors) * (1 - Math.exp(-dt / 0.3));
    // the 3WL machines run, their queued procedures follow each other
    for (const ws of board.wlStates) {
      simStep(ws, dt);
      if (!ws.proc && ws.queue?.length) {
        const why = startProc(ws, ws.queue.shift());
        if (why) {
          ws.queue = [];
          ui.say(why);
        }
      } else if (!ws.proc && ws.pendingTo) {
        const n = ws.pendingTo;
        ws.pendingTo = null;
        runPlan(ws, planFor(ws, n));
      }
    }
    board.pose(S, dt);

    // camera eases toward the view plus the visitor's offsets
    const tgt = VIEW[S.view]();
    tgt.az += off.az;
    tgt.el = clamp(tgt.el + off.el, -30, 85);
    tgt.d *= off.k;
    const ca = Math.cos(tgt.az * D2R);
    const sa = Math.sin(tgt.az * D2R);
    tgt.tx += off.px * ca;
    tgt.tz -= off.px * sa;
    tgt.ty += off.py;
    // the console covers the left and right columns: the board centres between them
    tgt.sx = 0;
    tgt.sy = -18;
    const k = 1 - Math.exp(-dt / 0.32);
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;

    // hover pick, at most every other frame
    if (hoverAt && !drag && (Math.round(T * 60) & 1)) {
      hover = pickAt(hoverAt[0], hoverAt[1]);
      canvas.classList.toggle('hov', !!hover);
    } else if (!hoverAt) hover = null;
    const showP = hover || pinned;
    if (showP && showP.box) {
      outline.visible = true;
      showP.box.getCenter(outline.position);
      showP.box.getSize(v3);
      outline.scale.set(Math.max(v3.x, 0.004), Math.max(v3.y, 0.004), Math.max(v3.z, 0.004));
    } else outline.visible = false;
    const fb = board.fieldBox(S.sel);
    if (fb) {
      fb.getCenter(selBox.position);
      fb.getSize(v3);
      selBox.scale.copy(v3);
      selBox.visible = S.cfg.fields.length > 1 && !S.solo;
    }

    // the part the current procedure step needs, outlined and pulsing
    const ws = wlOf();
    const tb = ws ? board.targetBox(ws) : null;
    if (tb) {
      procBox.visible = true;
      tb.getCenter(procBox.position);
      tb.getSize(v3);
      procBox.scale.set(Math.max(v3.x, 0.01) * 1.08, Math.max(v3.y, 0.01) * 1.08, Math.max(v3.z, 0.01) * 1.08);
      procBox.material.opacity = 0.55 + 0.45 * Math.sin(T * 8);
    } else procBox.visible = false;

    st.frame({...cam, az: cam.az * D2R, el: cam.el * D2R});

    const card = showP ? {...showP.info, pinned: !hover && !!pinned} : null;
    const calls = S.solo ? [] : board.callouts(S, st.project, T);
    if (tb && ws.caption) {
      const c = tb.getCenter(new THREE.Vector3());
      const p = st.project(c.x, c.y, c.z);
      if (p) calls.push({anchor: p, at: [Math.min(1000, p[0] + 110), Math.max(110, p[1] - 70)], title: ws.caption, sub: ws.proc?.label || '', proc: true});
    }
    ui.frame(S, {card, callouts: calls, cursor, wl: ws});
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
  if (q.has('notour')) AP.on = false;
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, S, act, cam, off, startTour, takeOver, get board() {
    return board;
  }, get R() {
    return R;
  }, get tier() {
    return tier;
  }, get T() {
    return T;
  }};
}
