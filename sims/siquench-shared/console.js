// SIQuench's overlay, a fixed 1600 x 900 CSS layout redrawn from each frame's state. Left: the title, the event clock,
// the trip sequence with its times, the three poles, the charging torque, the transport. Right: the controller's LEDs
// exactly as the manual draws them, the compartment pressure with and without SIQuench, the fault current moving from
// the arc into the metal path, the arc's I2t. Bottom: the event timeline, views and display toggles. Callouts carry
// thin leaders into the device.
import {DEV, DRIVE, STEPS, PRESSURE_MAX_T, currents, pressure, stepAt, torqueCurve} from './quench.js';

export const C = {ink: '#16181b', mute: '#8b8f95', faint: '#c9ccd0', line: '#e1e3e6', panel: 'rgba(248,248,249,.94)', acc: '#00a0a0', accSoft: 'rgba(0,160,160,.12)', red: '#d6182b', green: '#19a64a', yellow: '#f2b400', off: '#e4e6e8', arc: '#5b4bd6'};
export const CAMS = ['hero', 'front', 'side', 'mech', 'pole', 'latch', 'system'];
export const DISPLAY = ['hood', 'xray', 'section', 'explode', 'labels', 'current'];
const LABEL = {hero: 'HERO', front: 'FRONT', side: 'SIDE', mech: 'MECHANISM', pole: 'POLE SECTION', latch: 'LATCH', system: 'SWITCHGEAR', hood: 'HOOD', xray: 'X-RAY', section: 'SECTION', explode: 'EXPLODED', labels: 'LABELS', current: 'CURRENT'};
const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.pn{position:absolute;background:${C.panel};border:1px solid ${C.line};box-shadow:0 1px 2px rgba(20,22,26,.04)}
.cp{font-size:9.6px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap}
.mu{color:${C.mute}}
.mono{font-family:'JetBrains Mono',monospace}
.tb{position:absolute;height:19px;padding:0 7px;display:flex;align-items:center;justify-content:center;font-size:8.8px;font-weight:600;letter-spacing:.9px;text-transform:uppercase;border:1px solid ${C.line};background:#fff;color:${C.ink};white-space:nowrap}
.tb.dis{opacity:.4}
.call{position:absolute;white-space:nowrap;background:rgba(243,244,246,.86);padding:2px 6px 3px;margin:-2px -6px 0}
.call b{display:block;font-size:11.5px;font-weight:600;letter-spacing:.1px}
.call span{display:block;font-size:8.6px;font-weight:500;letter-spacing:1.4px;color:${C.mute};text-transform:uppercase;margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.acc};opacity:0;z-index:49}
.tag{display:inline-block;font-size:7px;letter-spacing:1px;padding:1px 3px;border:1px solid ${C.faint};color:${C.mute};vertical-align:1px;margin-left:5px}
.led{display:inline-block;flex:none;width:11px;height:11px;border-radius:50%;border:1px solid rgba(0,0,0,.18);margin-right:4px;vertical-align:middle}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
export const CLOCK_MAX = 8; // ms on the event timeline
export const fmtMs = (t) => (t < 10 ? t.toFixed(2) : t < 100 ? t.toFixed(1) : Math.round(t).toString());

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
  const btn = {};

  // ------------------------------------------------------------ title, the event clock
  add(`<div style="position:absolute;left:35px;top:33px;width:43px;height:3px;background:${C.acc}"></div>`);
  add(`<div style="position:absolute;left:35px;top:45px;font-size:24px;font-weight:700;letter-spacing:-.2px">SIQuench<sup style="font-size:11px;font-weight:600">®</sup> Core 3AM4</div>`);
  add(`<div class="cp" style="position:absolute;left:35px;top:79px;font-weight:500;letter-spacing:1.6px;font-size:9.2px">ACTIVE ARC QUENCHING &nbsp;•&nbsp; 3-POLE FAST EARTHING &nbsp;•&nbsp; ${DEV.Ur} kV &nbsp;•&nbsp; ${DEV.Ik} kA</div>`);
  const clock = add(`<div style="position:absolute;left:33px;top:100px;font-size:52px;font-weight:800;letter-spacing:-2.6px;color:${C.acc};line-height:1"></div>`);
  const clockUnit = add(`<div style="position:absolute;top:126px;font-size:10.5px;font-weight:500;letter-spacing:1px;line-height:1.35">MS<br><span style="color:${C.mute};letter-spacing:1.5px">AFTER ARC IGNITION</span></div>`);
  const speedTxt = add(`<div class="cp mu" style="position:absolute;left:35px;top:162px;font-weight:500;font-size:9px"></div>`);
  add(`<div style="position:absolute;left:35px;top:178px;width:247px;height:5px;background:#e6e7e9"></div>`);
  const clockFill = add(`<div style="position:absolute;left:35px;top:178px;height:5px;background:${C.acc}"></div>`);

  // ------------------------------------------------------------ the sequence
  add(`<div class="pn" style="left:35px;top:198px;width:247px;height:246px"></div>`);
  add(`<div class="cp" style="position:absolute;left:46px;top:209px;font-weight:700">TRIP SEQUENCE</div>`);
  const detTxt = add(`<div class="cp mu" style="position:absolute;right:${1600 - 271}px;top:209px;font-weight:500"></div>`);
  const seq = add(`<div style="position:absolute;left:46px;top:228px;width:226px"></div>`);
  add(`<div style="position:absolute;left:46px;top:408px;width:226px;height:1px;background:${C.line}"></div>`);
  add(`<div style="position:absolute;left:46px;top:414px;font-size:9.2px;color:${C.mute};line-height:1.45">Brochure: detection ~0.6-1.5 ms, earthing ~3 ms,<br>arc out ≤ 5 ms from ignition.</div>`);

  // ------------------------------------------------------------ the poles
  add(`<div class="pn" style="left:35px;top:452px;width:247px;height:150px"></div>`);
  add(`<div class="cp" style="position:absolute;left:46px;top:463px;font-weight:700">POLES Q1 · Q2 · Q3</div>`);
  add(`<div class="cp mu" style="position:absolute;right:${1600 - 271}px;top:463px;font-weight:500">TRAVEL</div>`);
  const poleRows = [0, 1, 2].map((i) => {
    const y = 484 + i * 27;
    add(`<div class="cp" style="position:absolute;left:46px;top:${y}px;font-weight:700">L${i + 1}</div>`);
    add(`<div style="position:absolute;left:68px;top:${y + 4}px;width:96px;height:4px;background:#e6e7e9"></div>`);
    const fill = add(`<div style="position:absolute;left:68px;top:${y + 4}px;height:4px;background:${C.ink}"></div>`);
    const mm = add(`<div class="mono" style="position:absolute;left:170px;top:${y - 1}px;font-size:10px;font-weight:600"></div>`);
    const st = add(`<div class="cp" style="position:absolute;right:${1600 - 271}px;top:${y}px;font-weight:600;font-size:8.6px"></div>`);
    return {fill, mm, st};
  });
  add(`<div style="position:absolute;left:46px;top:566px;width:226px;height:1px;background:${C.line}"></div>`);
  const poleFoot = add(`<div style="position:absolute;left:46px;top:572px;font-size:9.4px;color:${C.mute};line-height:1.45;width:226px"></div>`);

  // ------------------------------------------------------------ charging torque
  add(`<div class="pn" style="left:35px;top:610px;width:247px;height:156px"></div>`);
  add(`<div class="cp" style="position:absolute;left:46px;top:621px;font-weight:700">CHARGING TORQUE<span class="tag">MODELLED</span></div>`);
  const tqVal = add(`<div class="cp" style="position:absolute;right:${1600 - 271}px;top:621px;font-weight:700"></div>`);
  const tq = add(`<svg style="position:absolute;left:43px;top:637px" width="232" height="108"></svg>`);
  const tqFoot = add(`<div class="cp mu" style="position:absolute;left:46px;top:748px;font-size:8.2px;font-weight:500"></div>`);

  // ------------------------------------------------------------ transport
  add(`<div class="pn" style="left:35px;top:774px;width:259px;height:111px"></div>`);
  btn.trip = add(`<div class="tb" style="left:45px;top:782px;width:112px;height:26px;background:${C.acc};color:#fff;border-color:${C.acc};font-size:9.4px">⚡ &nbsp;STRIKE ARC</div>`);
  btn.charge = add(`<div class="tb" style="left:161px;top:782px;width:74px;height:26px;font-size:9.2px">RECHARGE</div>`);
  btn.pause = add(`<div class="tb" style="left:239px;top:782px;width:46px;height:26px;font-size:9.2px">❚❚</div>`);
  add(`<div class="cp" style="position:absolute;left:45px;top:818px;font-weight:500">SLOW MOTION</div>`);
  const slowVal = add(`<div class="cp" style="position:absolute;right:${1600 - 284}px;top:818px;font-weight:700"></div>`);
  const SL = {x: 46, w: 238};
  add(`<div style="position:absolute;left:${SL.x}px;top:836px;width:${SL.w}px;height:2px;background:#e1e3e6"></div>`);
  const slowKnob = add(`<div style="position:absolute;top:831px;width:9px;height:11px;margin-left:-4.5px;background:${C.acc}"></div>`);
  add(`<div class="cp" style="position:absolute;left:45px;top:851px;font-weight:500">ARC DETECTION</div>`);
  const detVal = add(`<div class="cp" style="position:absolute;right:${1600 - 284}px;top:851px;font-weight:700"></div>`);
  add(`<div style="position:absolute;left:${SL.x}px;top:869px;width:${SL.w}px;height:2px;background:#e1e3e6"></div>`);
  const detKnob = add(`<div style="position:absolute;top:864px;width:9px;height:11px;margin-left:-4.5px;background:${C.acc}"></div>`);

  // ------------------------------------------------------------ the state chip, top centre
  const chip = add(`<div style="position:absolute;left:800px;top:34px;transform:translateX(-50%);display:flex;align-items:center;gap:9px;height:30px;padding:0 14px;border:1px solid ${C.line};background:rgba(255,255,255,.95);white-space:nowrap"></div>`);

  // ------------------------------------------------------------ controller LEDs (manual Abb. 30-38)
  add(`<div class="pn" style="left:1318px;top:36px;width:245px;height:172px"></div>`);
  add(`<div class="cp" style="position:absolute;left:1329px;top:47px;font-weight:700">SIQUENCH CONTROLLER</div>`);
  add(`<div class="cp mu" style="position:absolute;right:${1600 - 1552}px;top:47px;font-weight:500">STATUS</div>`);
  const ledTab = add(`<div style="position:absolute;left:1329px;top:66px;width:224px"></div>`);
  add(`<div style="position:absolute;left:1329px;top:150px;width:224px;height:1px;background:${C.line}"></div>`);
  const ledGen = add(`<div style="position:absolute;left:1329px;top:157px;width:224px"></div>`);
  const ops = add(`<div class="cp mu" style="position:absolute;left:1329px;top:188px;font-size:8.4px;font-weight:500"></div>`);

  // ------------------------------------------------------------ compartment pressure
  add(`<div class="pn" data-g="charts" style="left:1318px;top:216px;width:245px;height:178px"></div>`);
  add(`<div class="cp" data-g="charts" style="position:absolute;left:1329px;top:227px;font-weight:700">COMPARTMENT PRESSURE</div>`);
  const pVal = add(`<div class="cp" data-g="charts" style="position:absolute;right:${1600 - 1552}px;top:227px;font-weight:700"></div>`);
  const pLeg = add(`<div class="cp" data-g="charts" style="position:absolute;left:1329px;top:243px;font-weight:500;font-size:8.4px"><span style="color:${C.acc}">—</span> WITH SIQUENCH &nbsp; <span style="color:${C.mute}">- -</span> WITHOUT</div>`);
  const pc = add(`<svg data-g="charts" style="position:absolute;left:1326px;top:258px" width="232" height="132"></svg>`);

  // ------------------------------------------------------------ fault current
  add(`<div class="pn" data-g="charts" style="left:1318px;top:402px;width:245px;height:168px"></div>`);
  add(`<div class="cp" data-g="charts" style="position:absolute;left:1329px;top:413px;font-weight:700">FAULT CURRENT · L1</div>`);
  const iVal = add(`<div class="cp" data-g="charts" style="position:absolute;right:${1600 - 1552}px;top:413px;font-weight:700"></div>`);
  add(`<div class="cp" data-g="charts" style="position:absolute;left:1329px;top:429px;font-weight:500;font-size:8.4px"><span style="color:${C.arc}">—</span> IN THE ARC &nbsp; <span style="color:${C.acc}">—</span> VIA SIQUENCH TO EARTH</div>`);
  const ic = add(`<svg data-g="charts" style="position:absolute;left:1326px;top:444px" width="232" height="122"></svg>`);

  // ------------------------------------------------------------ I2t
  add(`<div class="pn" data-g="charts" style="left:1318px;top:578px;width:245px;height:96px"></div>`);
  add(`<div class="cp" data-g="charts" style="position:absolute;left:1329px;top:589px;font-weight:700">ARC I²t · L1</div>`);
  add(`<div class="cp mu" data-g="charts" style="position:absolute;right:${1600 - 1552}px;top:589px;font-weight:500">kA²s</div>`);
  const i2On = add(`<div data-g="charts" style="position:absolute;left:1328px;top:606px;font-size:30px;font-weight:800;letter-spacing:-1.2px;color:${C.acc};line-height:1"></div>`);
  const i2Off = add(`<div data-g="charts" style="position:absolute;left:1450px;top:606px;font-size:30px;font-weight:800;letter-spacing:-1.2px;color:${C.faint};line-height:1"></div>`);
  add(`<div class="cp" data-g="charts" style="position:absolute;left:1329px;top:640px;font-weight:500;font-size:8.2px"><span style="color:${C.acc}">WITH</span></div>`);
  add(`<div class="cp mu" data-g="charts" style="position:absolute;left:1451px;top:640px;font-weight:500;font-size:8.2px">WITHOUT</div>`);
  const i2Foot = add(`<div class="cp mu" data-g="charts" style="position:absolute;left:1329px;top:655px;font-weight:500;font-size:8.2px"></div>`);

  // ------------------------------------------------------------ views and display
  add(`<div class="pn" style="left:1296px;top:720px;width:268px;height:165px"></div>`);
  const group = (title, keys, y) => {
    add(`<div class="cp mu" style="position:absolute;left:1305px;top:${y}px;font-weight:500">${title}</div>`);
    let x = 1305;
    let yy = y + 15;
    keys.forEach((k) => {
      const w = Math.round(LABEL[k].length * 6.2 + 14);
      if (x + w > 1556) {
        x = 1305;
        yy += 23;
      }
      btn[k] = add(`<div class="tb" style="left:${x}px;top:${yy}px;width:${w}px">${LABEL[k]}</div>`);
      x += w + 4;
    });
  };
  group('VIEW', CAMS, 727);
  group('DISPLAY', DISPLAY, 795);

  // ------------------------------------------------------------ the event timeline, bottom centre
  const TL = {x: 500, w: 600, y: 836};
  add(`<div class="cp mu" style="position:absolute;left:0;right:0;top:790px;text-align:center;font-weight:500"><span style="color:${C.ink}">EVENT TIMELINE</span> &nbsp;— &nbsp;0 TO ${CLOCK_MAX} MS &nbsp;·&nbsp; CLICK TO SCRUB</div>`);
  btn.quench = add(`<div class="tb" style="left:330px;top:826px;width:132px;height:22px"></div>`);
  const tl = add(`<svg style="position:absolute;left:${TL.x - 20}px;top:${TL.y - 26}px;overflow:visible" width="${TL.w + 40}" height="56"></svg>`);
  add(`<div class="cp" style="position:absolute;left:0;right:0;top:874px;text-align:center;font-weight:500;color:${C.faint}">DRAG TO ORBIT &nbsp;·&nbsp; SCROLL TO ZOOM &nbsp;·&nbsp; H HIDES THE OVERLAY &nbsp;·&nbsp; INTERNALS SCHEMATIC, NOT TO MANUFACTURER DRAWING</div>`);

  // ------------------------------------------------------------ callouts, the pointer
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
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const knobX = (v) => SL.x + v * SL.w;
  const tlX = (ms) => TL.x + (Math.min(CLOCK_MAX, Math.max(0, ms)) / CLOCK_MAX) * TL.w;
  const ledSpot = (i) => [1329 + 74 + i * 22 + 6, 66 + 22 + 6];

  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };
  const toggle = (k, on, col = C.ink) => {
    btn[k].style.background = on ? col : '#fff';
    btn[k].style.color = on ? '#fff' : C.ink;
    btn[k].style.borderColor = on ? col : C.line;
  };
  // static chart frames, drawn once and reused
  const led = (col, on) => `<i class="led" style="background:${on ? col : C.off};${on ? `box-shadow:0 0 6px ${col}` : ''}"></i>`;

  let lastLed = '';
  return {
    spots,
    btn,
    root: ui,
    TL,
    tlX,
    ledSpot,
    slowKnob: (v) => [knobX(v), 836],
    detKnob: (v) => [knobX(v), 869],
    /**
     * s: {tau (ms, null before any event), ev (events), quench (bool), det, slowText, slowK, paused, poles [state x3],
     *     charging (pole index | -1), torque, leds, chip [title, sub, kind], cam, display {...}, callouts, cursor,
     *     opsIk, opsMech}
     */
    update(s) {
      const tau = s.tau;
      const ev = s.ev;
      const tShow = tau === null ? 0 : Math.max(0, tau);
      clock.textContent = fmtMs(tShow);
      clockUnit.style.left = `${38 + clock.getBoundingClientRect().width / ((app.getBoundingClientRect().width || 1600) / 1600) + 8}px`;
      speedTxt.innerHTML = tau === null ? 'READY · WAITING FOR AN ARC' : `PLAYBACK <b style="color:${C.ink}">${s.slowText}</b>`;
      clockFill.style.width = `${((Math.min(CLOCK_MAX, tShow) / CLOCK_MAX) * 247).toFixed(1)}px`;
      slowVal.textContent = s.slowText;
      slowKnob.style.left = `${knobX(s.slowK).toFixed(1)}px`;
      detVal.textContent = `${s.det.toFixed(1)} MS`;
      detKnob.style.left = `${knobX((s.det - 0.6) / 0.9).toFixed(1)}px`;
      btn.pause.textContent = s.paused ? '▶' : '❚❚';
      btn.trip.classList.toggle('dis', !s.canTrip);
      btn.quench.innerHTML = s.quench ? 'SIQUENCH &nbsp;<b>ON</b>' : 'SIQUENCH &nbsp;<b>OFF</b>';
      toggle('quench', !s.quench, C.red);
      btn.charge.classList.toggle('dis', !s.canCharge);
      detTxt.innerHTML = s.quench ? `<b style="color:${C.ink}">${(ev.close).toFixed(1)}</b> MS TO EARTH` : `<b style="color:${C.red}">SIQUENCH OFF</b>`;

      // the sequence list: done, now, next; each with its time
      const k = stepAt(tau, ev);
      const at = {ign: 0, ...ev};
      seq.innerHTML = STEPS.map(([id, name, sub], i) => {
        const skip = !s.quench && ['coil', 'strike', 'release', 'close', 'out'].includes(id);
        const done = tau !== null && i < k;
        const now = tau !== null && i === k;
        const col = skip ? C.faint : now ? C.acc : done ? C.ink : C.mute;
        const t = id === 'out' && !s.quench ? '' : `${fmtMs(id === 'cb' ? at.cb : at[id])}`;
        return `<div style="display:flex;align-items:flex-start;gap:9px;height:22px">
          <i style="display:block;flex:none;width:7px;height:7px;margin-top:3px;border-radius:50%;background:${now ? C.acc : done ? C.ink : '#fff'};border:1px solid ${skip ? C.faint : now ? C.acc : C.ink}"></i>
          <div style="flex:1;line-height:1.05"><div class="cp" style="font-size:9.2px;font-weight:${now ? 700 : 600};color:${col}">${name}${skip ? ' — SKIPPED' : ''}</div><div class="cp" style="font-size:7.6px;font-weight:500;color:${skip ? C.faint : C.mute};letter-spacing:1.1px;margin-top:2px">${sub}</div></div>
          <div class="mono" style="font-size:9.6px;font-weight:600;color:${col}">${skip ? '' : t}</div></div>`;
      }).join('');

      // the poles
      s.poles.forEach((p, i) => {
        const r = poleRows[i];
        const frac = p.x / DRIVE.L;
        r.fill.style.width = `${(frac * 96).toFixed(1)}px`;
        r.fill.style.background = p.v > 0.1 || s.charging === i ? C.acc : C.ink;
        r.mm.textContent = `${(p.x * 1000).toFixed(1)} mm`;
        const [txt, col] = s.charging === i ? ['CHARGING', C.acc] : p.closed ? ['EARTHED', C.red] : p.x > 0.0002 ? (p.v > 0 ? [`${p.v.toFixed(1)} M/S`, C.acc] : ['MOVING', C.acc]) : p.latched ? ['READY', C.green] : ['OPEN', C.mute];
        r.st.textContent = txt;
        r.st.style.color = col;
      });
      const p0 = s.poles[s.charging >= 0 ? s.charging : 0];
      poleFoot.innerHTML = `Disc stack <b style="color:${C.ink}">${(p0.force / 1000).toFixed(1)} kN</b> · travel <b style="color:${C.ink}">${DRIVE.L * 1000} mm</b> in ${'~2'} ms<br>closing speed <b style="color:${C.ink}">${DRIVE.vClose.toFixed(1)} m/s</b> <span class="tag">MODELLED</span>`;

      // charging torque over the tool's turns, the dot at the charging pole's turn
      {
        const W = 232;
        const X = (n) => 22 + (n / DRIVE.turns) * (W - 34);
        const Y = (nm) => 92 - (nm / 110) * 82;
        let h = `<text x="26" y="7" font-size="6.5" fill="${C.mute}">Nm</text>`;
        for (const v of [0, 50, 100]) h += `<text x="17" y="${Y(v) + 2}" font-size="6.5" text-anchor="end" fill="${C.mute}">${v}</text><line x1="${X(0)}" x2="${X(DRIVE.turns)}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v ? C.line : C.ink}" stroke-width=".8"/>`;
        h += `<line x1="${X(DRIVE.freeTurns)}" x2="${X(DRIVE.freeTurns)}" y1="${Y(105)}" y2="${Y(0)}" stroke="${C.line}" stroke-dasharray="2 2"/>`;
        h += `<text x="${X(1)}" y="${Y(14)}" font-size="6" letter-spacing=".8" text-anchor="middle" fill="${C.mute}">FREE</text><text x="${X(DRIVE.turns) - 2}" y="${Y(104)}" font-size="6" letter-spacing=".8" text-anchor="end" fill="${C.mute}">STOP · MAX 100 NM</text>`;
        let path = '';
        torqueCurve.forEach(([n, nm], j) => (path += `${j ? 'L' : 'M'}${X(n).toFixed(1)} ${Y(nm).toFixed(1)}`));
        h += `<path d="${path}" fill="none" stroke="${C.ink}" stroke-width="1.3"/>`;
        for (let n = 0; n <= 9; n += 3) h += `<text x="${X(n)}" y="${Y(0) + 10}" font-size="6.5" text-anchor="middle" fill="${C.mute}">${n}</text>`;
        if (s.charging >= 0 && s.toolTurns > 0) h += `<circle cx="${X(Math.min(DRIVE.turns, s.toolTurns)).toFixed(1)}" cy="${Y(s.torque).toFixed(1)}" r="3.2" fill="${C.acc}"/>`;
        tq.innerHTML = h;
        tqVal.innerHTML = s.charging >= 0 ? `<span style="color:${C.acc}">${Math.round(s.torque)} NM</span>` : `<span class="mu">— NM</span>`;
        tqFoot.textContent = s.charging >= 0 ? `POLE L${s.charging + 1} · ${s.toolTurns.toFixed(1)} TURNS CLOCKWISE · SW24` : `TOOL TURNS · CLOCKWISE TO THE STOP · SW24`;
      }

      // the chip
      const [ct, cs, kind] = s.chip;
      const dot = {ready: C.green, arc: C.arc, move: C.acc, earthed: C.red, charge: C.acc, off: C.red}[kind] || C.mute;
      chip.innerHTML = `<i style="display:block;width:8px;height:8px;border-radius:50%;background:${dot}"></i><b style="font-size:13px;font-weight:700">${ct}</b><span class="cp mu" style="font-weight:500;font-size:9px">${cs}</span>`;

      // the controller's LEDs
      {
        const L = s.leds;
        const key = JSON.stringify(L);
        if (key !== lastLed) {
          lastLed = key;
          const row = (cells, name) => `<div style="display:flex;align-items:center;height:22px;border-bottom:1px solid ${C.line}"><div style="width:74px">${cells}</div><div class="cp" style="font-size:8.6px;font-weight:600">${name}</div></div>`;
          ledTab.innerHTML =
            `<div class="cp mu" style="display:flex;height:16px;font-size:7.6px;font-weight:500"><div style="width:74px">LED 1 · 2 · 3</div><div>FUNCTION</div></div>` +
            row(L.tripped.map((on) => led(C.red, on)).join(''), 'TRIPPED') +
            row(L.ready.map((on) => led(C.green, on)).join(''), 'QUENCHER READY') +
            row(led(C.green, L.unblocked) + led(C.off, false) + led(C.red, L.blocked), `TRIP OUTPUT · <span style="color:${L.blocked ? C.red : C.green}">${L.blocked ? 'BLOCKED' : 'UNBLOCKED'}</span>`);
          ledGen.innerHTML = `<div class="cp" style="display:flex;gap:14px;font-size:8.4px;font-weight:600;align-items:center">${led(C.red, L.error)}ERROR ${led(C.yellow, L.diag)}DIAGNOSIS ${led(C.green, L.run)}READY</div>`;
        }
        ops.innerHTML = `OPERATIONS AT IK <b style="color:${C.ink}">${s.opsIk} / ${DEV.opsIk}</b> &nbsp;·&nbsp; MECHANICAL <b style="color:${C.ink}">${s.opsMech} / ${DEV.opsMech}</b>`;
      }

      // pressure: both curves over 0..30 ms, the cursor at tau
      const det = s.det;
      {
        const W = 232;
        const T = 30;
        const X = (t) => 22 + (t / T) * (W - 30);
        const Y = (p) => 112 - (p / 160) * 98;
        let h = `<text x="26" y="6" font-size="6.5" fill="${C.mute}">kPa</text>`;
        for (const v of [0, 40, 80, 120, 160]) h += `<text x="17" y="${Y(v) + 2}" font-size="6.5" text-anchor="end" fill="${C.mute}">${v}</text><line x1="${X(0)}" x2="${X(T)}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v ? C.line : C.ink}" stroke-width=".8"/>`;
        let off = '';
        let on = '';
        for (let t = 0; t <= T; t += 0.25) {
          const p = pressure(t, det);
          off += `${t ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(p.off).toFixed(1)}`;
          on += `${t ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(p.on).toFixed(1)}`;
        }
        h += `<path d="${off}" fill="none" stroke="${C.mute}" stroke-width="1.1" stroke-dasharray="3 2"/>`;
        h += `<path d="${on} L${X(T)} ${Y(0)} L${X(0)} ${Y(0)} Z" fill="${C.accSoft}" stroke="${C.acc}" stroke-width="1.5"/>`;
        h += `<text x="${X(11)}" y="${Y(146)}" font-size="6.2" letter-spacing=".8" fill="${C.mute}">FLAP OPENS · VENTING</text>`;
        if (tau !== null) {
          const tt = Math.min(T, Math.max(0, tau));
          const p = pressure(tt, det);
          const cur = s.quench ? p.on : p.off;
          h += `<line x1="${X(tt)}" x2="${X(tt)}" y1="${Y(160)}" y2="${Y(0)}" stroke="${C.ink}" stroke-width=".8"/><circle cx="${X(tt)}" cy="${Y(cur)}" r="3" fill="${s.quench ? C.acc : C.ink}"/>`;
          pVal.innerHTML = `<span style="color:${s.quench ? C.acc : C.ink}">${Math.round(cur)} KPA</span>`;
        } else pVal.innerHTML = `<span class="mu">0 KPA</span>`;
        for (const t of [0, 10, 20, 30]) h += `<text x="${X(t)}" y="${Y(0) + 10}" font-size="6.5" text-anchor="middle" fill="${C.mute}">${t}</text>`;
        h += `<text x="${X(T)}" y="${Y(0) + 19}" font-size="6.1" letter-spacing=".8" text-anchor="end" fill="${C.mute}">MS · 80 kA PEAK / 31.5 kA RMS · AFTER BROCHURE</text>`;
        pc.innerHTML = h;
      }
      // current: the arc and the earth path over 0..12 ms
      {
        const W = 232;
        const T = 12;
        const X = (t) => 22 + (t / T) * (W - 30);
        const Y = (i) => 54 - (i / 90) * 44;
        let h = `<text x="26" y="5" font-size="6.5" fill="${C.mute}">kA</text>`;
        for (const v of [-80, -40, 0, 40, 80]) h += `<text x="17" y="${Y(v) + 2}" font-size="6.5" text-anchor="end" fill="${C.mute}">${v}</text><line x1="${X(0)}" x2="${X(T)}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v ? C.line : C.ink}" stroke-width="${v ? 0.6 : 0.8}"/>`;
        let a = '';
        let e = '';
        const tEnd = tau === null ? -1 : Math.min(T, tau);
        for (let t = 0; t <= T; t += 0.05) {
          const c = currents(t, ev, s.quench, 0);
          a += `${t ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(c.arc).toFixed(1)}`;
          e += `${t ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(c.earth).toFixed(1)}`;
        }
        // drawn faint ahead of the clock, strong behind it
        const clip = `<clipPath id="ic-clip"><rect x="0" y="0" width="${tEnd < 0 ? 0 : X(tEnd)}" height="130"/></clipPath>`;
        h += clip + `<path d="${a}" fill="none" stroke="${C.arc}" stroke-width="1" opacity=".22"/><path d="${e}" fill="none" stroke="${C.acc}" stroke-width="1" opacity=".22"/>`;
        h += `<g clip-path="url(#ic-clip)"><path d="${a}" fill="none" stroke="${C.arc}" stroke-width="1.6"/><path d="${e}" fill="none" stroke="${C.acc}" stroke-width="1.8"/></g>`;
        if (s.quench) h += `<line x1="${X(ev.close)}" x2="${X(ev.close)}" y1="${Y(88)}" y2="${Y(-88)}" stroke="${C.acc}" stroke-dasharray="2 2" stroke-width=".8"/><text x="${X(ev.close) + 3}" y="${Y(-74)}" font-size="6.2" letter-spacing=".8" fill="${C.acc}">CONTACT CLOSES</text>`;
        for (const t of [0, 4, 8, 12]) h += `<text x="${X(t)}" y="${Y(-90) + 9}" font-size="6.5" text-anchor="middle" fill="${C.mute}">${t}</text>`;
        h += `<text x="${X(T)}" y="${Y(-90) + 18}" font-size="6.1" letter-spacing=".8" text-anchor="end" fill="${C.mute}">MS · FULL DC OFFSET · X/R 17</text>`;
        ic.innerHTML = h;
        if (tau !== null && tau >= 0) {
          const c = currents(tau, ev, s.quench, 0);
          iVal.innerHTML = Math.abs(c.arc) > 0.5 ? `<span style="color:${C.arc}">${Math.abs(c.arc).toFixed(1)} KA ARC</span>` : Math.abs(c.earth) > 0.5 ? `<span style="color:${C.acc}">${Math.abs(c.earth).toFixed(1)} KA EARTH</span>` : `<span class="mu">0 KA</span>`;
        } else iVal.innerHTML = `<span class="mu">0 KA</span>`;
      }
      // I2t
      {
        const tt = tau === null ? 0 : Math.min(PRESSURE_MAX_T - 0.1, Math.max(0, tau));
        const p = pressure(tt, det);
        const end = pressure(PRESSURE_MAX_T - 0.1, det);
        i2On.textContent = s.quench ? p.i2tOn.toFixed(2) : '—';
        i2Off.textContent = p.i2tOff < 10 ? p.i2tOff.toFixed(2) : p.i2tOff.toFixed(0);
        i2Foot.innerHTML = `TO CB CLEARING: <b style="color:${C.ink}">${end.i2tOn.toFixed(1)}</b> VS <b style="color:${C.ink}">${end.i2tOff.toFixed(0)}</b> · <b style="color:${C.acc}">${((end.i2tOn / end.i2tOff) * 100).toFixed(1)} %</b>`;
      }

      // the event timeline
      {
        const y = 26;
        let h = `<line x1="20" x2="${TL.w + 20}" y1="${y}" y2="${y}" stroke="${C.faint}" stroke-width="2"/>`;
        if (tau !== null) h += `<line x1="20" x2="${(tlX(tau) - TL.x + 20).toFixed(1)}" y1="${y}" y2="${y}" stroke="${C.acc}" stroke-width="2"/>`;
        for (let m = 0; m <= CLOCK_MAX; m++) h += `<line x1="${tlX(m) - TL.x + 20}" x2="${tlX(m) - TL.x + 20}" y1="${y + 3}" y2="${y + 7}" stroke="${C.faint}"/><text x="${tlX(m) - TL.x + 20}" y="${y + 17}" font-size="8" text-anchor="middle" fill="${C.mute}" font-family="JetBrains Mono">${m}</text>`;
        const marks = [['det', 'DETECT', 'end'], ['coil', 'TRIGGER', 'start'], ['release', 'RELEASE', 'middle'], ['close', 'EARTHED', 'middle']];
        marks.forEach(([id, name, anchor], j) => {
          if (!s.quench && id !== 'det') return;
          const x = tlX(ev[id]) - TL.x + 20;
          const lit = tau !== null && tau >= ev[id];
          h += `<line x1="${x}" x2="${x}" y1="${y - 6}" y2="${y + 2}" stroke="${lit ? C.acc : C.mute}" stroke-width="1.2"/><text x="${x + (anchor === 'end' ? -3 : anchor === 'start' ? 3 : 0)}" y="${y - 10}" font-size="7.4" letter-spacing="1" text-anchor="${anchor}" fill="${lit ? C.ink : C.mute}" font-weight="600">${name}</text>`;
        });
        if (tau !== null) h += `<circle cx="${(tlX(tau) - TL.x + 20).toFixed(1)}" cy="${y}" r="5" fill="${C.acc}" stroke="#fff" stroke-width="1.5"/>`;
        h += `<text x="${TL.w + 30}" y="${y + 3}" font-size="7.4" letter-spacing="1" fill="${C.mute}">CB ${Math.round(ev.cb)} MS →</text>`;
        tl.innerHTML = h;
      }

      // toggles
      for (const k of CAMS) toggle(k, s.cam === k);
      for (const k of DISPLAY) toggle(k, !!s.display[k], C.acc);

      // callouts
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = c.w < 0;
        const w = Math.abs(c.w);
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${lx.toFixed(1)},${(ly + 21).toFixed(1)} ${(lx + (right ? -w : w)).toFixed(1)},${(ly + 21).toFixed(1)}" fill="none" stroke="${C.mute}" stroke-width=".8" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2" fill="${c.hot ? C.acc : C.ink}" opacity="${c.o.toFixed(2)}"/>`;
        ch += `<div class="call" style="left:${(right ? lx - w : lx).toFixed(1)}px;top:${(ly - 10).toFixed(1)}px;opacity:${c.o.toFixed(2)};${right ? `width:${w}px;text-align:right` : ''}"><b style="${c.hot ? `color:${C.acc}` : ''}">${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
    pointer,
  };
}
