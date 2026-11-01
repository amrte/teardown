// The transformer's overlay: title and the load readout top left, the phasor diagram and the limb flux chart, the
// transport (pause, ±30°, load, playback) bottom left, the legend top centre, the tracked phase, losses & efficiency
// and winding temperature on the right, camera / cutaway / overlay toggles bottom right, the phase and HV tap pickers
// bottom centre, and callouts with thin leaders into the unit. Fixed 1600 x 900 CSS layout; update(s) redraws every
// live part from the frame's state, every number from kin.js.
import {bLimb, CORE_D, GRID, hotSpot, operating, PHASES, R, tapName, TAPS, tapTurns} from './kin.js';
import {ACCENT} from './unit.js';

export const C = {ink: '#16181b', mute: '#8b8f95', faint: '#c9ccd0', line: '#e1e3e6', panel: 'rgba(248,248,249,.94)', acc: ACCENT, red: '#d6182b', blue: '#3d8fe0', warm: '#f07818', grey: '#5d6670'};
export const CAMS = ['hero', 'front', 'top', 'side', 'limb', 'taps'];
export const CUTS = ['solid', 'section', 'xray'];
export const OVERLAYS = ['callouts', 'flux', 'airflow', 'heat', 'charts'];
export const S_MAX = R.S_AF * 1.0;
const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.pn{position:absolute;background:${C.panel};border:1px solid ${C.line};box-shadow:0 1px 2px rgba(20,22,26,.04)}
.cp{font-size:9.6px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap}
.mu{color:${C.mute}}
.tb{position:absolute;height:19px;padding:0 7px;display:flex;align-items:center;justify-content:center;font-size:8.8px;font-weight:600;letter-spacing:.9px;text-transform:uppercase;border:1px solid ${C.line};background:#fff;color:${C.ink};white-space:nowrap}
.call{position:absolute;white-space:nowrap;background:rgba(243,243,244,.86);padding:3px 6px 4px;margin:-3px -6px}
.call b{display:block;font-size:11.5px;font-weight:600;letter-spacing:.1px}
.call span{display:block;font-size:8.6px;font-weight:500;letter-spacing:1.4px;color:${C.mute};text-transform:uppercase;margin-top:2px}
.row{display:flex;justify-content:space-between;align-items:baseline;height:17px;font-size:9.4px;letter-spacing:1.2px;text-transform:uppercase;color:${C.mute};font-weight:500}
.row b{color:${C.ink};font-weight:600;letter-spacing:.4px;font-size:10.5px;text-transform:none}
.nt{text-transform:none}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.acc};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const f0 = (v) => Math.round(v).toLocaleString('en-US');
const f1 = (v) => v.toFixed(1);
const f2 = (v) => v.toFixed(2);
const D2R = Math.PI / 180;

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

  // ------------------------------------------------------------ title and load
  add(`<div class="pn" style="left:24px;top:22px;width:270px;height:238px"></div>`);
  add(`<div style="position:absolute;left:35px;top:33px;width:43px;height:3px;background:${C.acc}"></div>`);
  add(`<div style="position:absolute;left:35px;top:47px;font-size:24px;font-weight:700;letter-spacing:-.2px">Cast-Resin <span style="color:${C.acc}">·</span> Transformer</div>`);
  add(`<div class="cp" style="position:absolute;left:35px;top:81px;font-weight:500;letter-spacing:1.7px;font-size:9.4px">1000 kVA AN / 1500 AF &nbsp;•&nbsp; 10 / 0.69 kV &nbsp;•&nbsp; ${R.group.toUpperCase()}</div>`);
  const loadBig = add(`<div style="position:absolute;left:33px;top:103px;font-size:56px;font-weight:800;letter-spacing:-3.2px;color:${C.acc};line-height:1"></div>`);
  const loadUnit = add(`<div style="position:absolute;top:141px;font-size:11px;font-weight:600;letter-spacing:1px">kVA</div>`);
  const BW = 247;
  const bx = (S) => 35 + (S / S_MAX) * BW;
  add(`<div style="position:absolute;left:35px;top:174px;width:${BW}px;height:9px;background:#e6e7e9"></div>`);
  const afZone = add(`<div style="position:absolute;left:${bx(R.S)}px;top:174px;width:${bx(R.S_AF) - bx(R.S)}px;height:9px;background:repeating-linear-gradient(135deg,#d9dbde 0 3px,#e6e7e9 3px 6px)"></div>`);
  const loadFill = add(`<div style="position:absolute;left:35px;top:174px;height:9px;background:${C.acc}"></div>`);
  add(`<div style="position:absolute;left:${bx(R.S)}px;top:168px;width:1px;height:21px;background:${C.ink}"></div>`);
  add(`<div class="cp mu" style="position:absolute;left:35px;top:191px;font-size:9px;font-weight:500">0</div>`);
  add(`<div class="cp" style="position:absolute;right:${1600 - bx(R.S) + 5}px;top:191px;font-size:9px;font-weight:600">AN 1000</div>`);
  const afLbl = add(`<div class="cp" style="position:absolute;right:${1600 - 282}px;top:191px;font-size:9px;font-weight:500">AF 1500</div>`);
  add(`<div style="position:absolute;left:35px;top:209px;width:${BW}px;height:1px;background:${C.faint}"></div>`);
  const loadLine = add(`<div style="position:absolute;left:35px;top:216px;font-size:12.5px;font-weight:500"></div>`);
  const loadSub = add(`<div class="cp mu" style="position:absolute;left:35px;top:236px;font-size:9px;font-weight:500"></div>`);

  // ------------------------------------------------------------ phasors
  add(`<div class="pn" data-g="charts" style="left:35px;top:274px;width:247px;height:208px"></div>`);
  add(`<div class="cp" data-g="charts" style="position:absolute;left:46px;top:286px;font-weight:700">PHASORS</div>`);
  const phAng = add(`<div class="cp mu" data-g="charts" style="position:absolute;right:${1600 - 271}px;top:286px;font-weight:500"></div>`);
  const ph = add(`<svg data-g="charts" style="position:absolute;left:46px;top:303px" width="226" height="134"></svg>`);
  add(`<div data-g="charts" style="position:absolute;left:46px;top:440px;width:226px;height:1px;background:${C.line}"></div>`);
  add(`<div data-g="charts" style="position:absolute;left:46px;top:447px;font-size:9.5px;color:${C.mute};font-family:'JetBrains Mono',monospace">U₂ = U₁ · √3 · N₂ / N₁</div>`);
  const phFoot = add(`<div data-g="charts" style="position:absolute;left:46px;top:461px;font-size:9.5px;color:${C.mute}"></div>`);

  // ------------------------------------------------------------ flux in the limbs
  add(`<div class="pn" data-g="charts" style="left:35px;top:490px;width:247px;height:192px"></div>`);
  add(`<div class="cp" data-g="charts" style="position:absolute;left:46px;top:502px;font-weight:700">FLUX IN THE LIMBS</div>`);
  add(`<div class="cp mu" data-g="charts" style="position:absolute;right:${1600 - 271}px;top:502px;font-weight:500">TESLA</div>`);
  const fxLeg = add(`<div class="cp" data-g="charts" style="position:absolute;left:46px;top:518px;font-weight:500;font-size:9px"></div>`);
  const fx = add(`<svg data-g="charts" style="position:absolute;left:43px;top:532px" width="232" height="118"></svg>`);
  add(`<div data-g="charts" style="position:absolute;left:46px;top:654px;width:226px;height:1px;background:${C.line}"></div>`);
  add(`<div data-g="charts" style="position:absolute;left:46px;top:661px;font-size:9.5px;color:${C.mute}">B<sub>U</sub> + B<sub>V</sub> + B<sub>W</sub> = 0 &nbsp;·&nbsp; the yokes carry the return</div>`);

  // ------------------------------------------------------------ transport
  add(`<div class="pn" style="left:35px;top:742px;width:259px;height:143px"></div>`);
  const btn = {};
  btn.pause = add(`<div class="tb" style="left:45px;top:750px;width:99px;height:26px;background:${C.acc};color:#fff;border-color:${C.acc};font-size:9.6px">❚❚ &nbsp;PAUSE</div>`);
  btn.back = add(`<div class="tb" style="left:149px;top:750px;width:66px;height:26px;font-size:9.6px">−30°</div>`);
  btn.fwd = add(`<div class="tb" style="left:219px;top:750px;width:66px;height:26px;font-size:9.6px">+30°</div>`);
  const SL = {x: 46, w: 238};
  const slider = (label, y) => {
    add(`<div class="cp" style="position:absolute;left:45px;top:${y}px;font-weight:500">${label}</div>`);
    const val = add(`<div class="cp" style="position:absolute;right:${1600 - 284}px;top:${y}px;font-weight:700"></div>`);
    add(`<div style="position:absolute;left:${SL.x}px;top:${y + 18}px;width:${SL.w}px;height:2px;background:#e1e3e6"></div>`);
    const knob = add(`<div style="position:absolute;top:${y + 13}px;width:9px;height:11px;margin-left:-4.5px;background:${C.acc}"></div>`);
    return {val, knob, y: y + 18};
  };
  const sLoad = slider('LOAD · COS <span class="nt">φ</span> 0.9', 786);
  const sGrid = slider('HV GRID VOLTAGE', 819);
  const sPlay = slider('PLAYBACK', 852);
  const gridK = (U) => (U - GRID[0]) / (GRID[1] - GRID[0]);

  // ------------------------------------------------------------ legend
  add(`<div class="cp" style="position:absolute;left:0;right:0;top:36px;display:flex;justify-content:center;gap:16px;font-weight:500;font-size:9.6px">
    ${[['FLUX', C.acc], ['COOL AIR', C.blue], ['WARM AIR', C.warm]].map(([n, c]) => `<span><i style="display:inline-block;width:15px;height:2.4px;background:${c};vertical-align:middle;margin-right:6px"></i>${n}</span>`).join('')}
    <span><i style="display:inline-block;width:34px;height:5px;background:linear-gradient(90deg,#295cc7,#2eb8db,#fad638,#f5731a,#cc0f1a);vertical-align:middle;margin-right:6px"></i>20 → 180 °C</span></div>`);

  // ------------------------------------------------------------ tracked phase
  add(`<div class="pn" style="left:1318px;top:36px;width:245px;height:209px"></div>`);
  const phName = add(`<div class="cp" style="position:absolute;left:1329px;top:47px;font-weight:500"></div>`);
  const phTurns = add(`<div class="cp mu" style="position:absolute;right:${1600 - 1552}px;top:47px;font-weight:500"></div>`);
  const curBig = add(`<div style="position:absolute;left:1328px;top:63px;font-size:36px;font-weight:800;letter-spacing:-1.6px;color:${C.acc};line-height:1"></div>`);
  const curUnit = add(`<div style="position:absolute;top:69px;font-size:10.5px;font-weight:500;letter-spacing:1px;line-height:1.35">A<br><span style="color:${C.mute};letter-spacing:1.5px">LV PHASE CURRENT</span></div>`);
  const phRows = add(`<div style="position:absolute;left:1329px;top:112px;width:224px"></div>`);

  // ------------------------------------------------------------ losses and efficiency
  add(`<div class="pn" data-g="charts" style="left:1318px;top:252px;width:245px;height:184px"></div>`);
  add(`<div class="cp" data-g="charts" style="position:absolute;left:1329px;top:263px;font-weight:700">LOSSES & EFFICIENCY</div>`);
  const etaHdr = add(`<div class="cp mu" data-g="charts" style="position:absolute;right:${1600 - 1552}px;top:263px;font-weight:500"></div>`);
  const lossLeg = add(`<div class="cp" data-g="charts" style="position:absolute;left:1329px;top:280px;font-weight:500;font-size:9px"></div>`);
  const ef = add(`<svg data-g="charts" style="position:absolute;left:1326px;top:296px" width="232" height="135"></svg>`);

  // ------------------------------------------------------------ temperature
  add(`<div class="pn" style="left:1318px;top:443px;width:245px;height:262px"></div>`);
  add(`<div class="cp" style="position:absolute;left:1329px;top:455px;font-weight:700">WINDING TEMPERATURE</div>`);
  add(`<div class="cp mu" style="position:absolute;right:${1600 - 1552}px;top:455px;font-weight:500">PT100</div>`);
  const tBig = add(`<div style="position:absolute;left:1328px;top:473px;font-size:36px;font-weight:800;letter-spacing:-1.6px;line-height:1"></div>`);
  const tUnit = add(`<div style="position:absolute;top:479px;font-size:10.5px;font-weight:500;letter-spacing:1px;line-height:1.35">°C<br><span style="color:${C.mute};letter-spacing:1.5px">WINDING · PT100</span></div>`);
  const th = add(`<svg style="position:absolute;left:1326px;top:516px" width="232" height="66"></svg>`);
  const tRows = add(`<div style="position:absolute;left:1329px;top:588px;width:224px"></div>`);
  btn.reset = add(`<div class="tb" style="left:1329px;top:676px;width:224px;height:22px;background:${C.red};color:#fff;border-color:${C.red};display:none">TRIPPED · CLICK TO RESET</div>`);

  // ------------------------------------------------------------ camera, cutaway, overlays
  add(`<div class="pn" style="left:1296px;top:720px;width:268px;height:165px"></div>`);
  const group = (title, keys, y, labels) => {
    add(`<div class="cp mu" style="position:absolute;left:1305px;top:${y}px;font-weight:500">${title}</div>`);
    let x = 1305;
    let yy = y + 15;
    keys.forEach((k) => {
      const w = Math.round(labels[k].length * 6.2 + 14);
      if (x + w > 1561) {
        x = 1305;
        yy += 23;
      }
      btn[k] = add(`<div class="tb" style="left:${x}px;top:${yy}px;width:${w}px">${labels[k]}</div>`);
      x += w + 4;
    });
  };
  const L = Object.fromEntries([...CAMS, ...CUTS, ...OVERLAYS].map((k) => [k, k.toUpperCase()]));
  L.xray = 'X-RAY';
  group('CAMERA', CAMS, 727, L);
  group('CUTAWAY', CUTS, 771, L);
  group('OVERLAYS', OVERLAYS, 815, L);

  // ------------------------------------------------------------ phase and tap pickers
  add(`<div class="pn" style="left:556px;top:787px;width:488px;height:107px"></div>`);
  const PX = (i) => 588 + i * 36;
  const TX = (i) => 744 + i * 52;
  add(`<div class="cp" style="position:absolute;left:${PX(0) - 12}px;top:795px;font-weight:500">PHASE</div>`);
  add(`<div class="cp" style="position:absolute;left:${TX(0) - 20}px;top:795px;font-weight:500">HV TAP LINK <span class="mu">— OFF-CIRCUIT, ALL 3 PHASES</span></div>`);
  add(`<div style="position:absolute;left:${PX(2) + 34}px;top:816px;width:1px;height:30px;background:${C.line}"></div>`);
  const pk = add(`<svg style="position:absolute;left:0;top:815px;overflow:visible" width="1600" height="34"></svg>`);
  const tapSub = add(`<div class="cp mu" style="position:absolute;left:0;right:0;top:864px;text-align:center;font-weight:500"></div>`);
  add(`<div class="cp" style="position:absolute;left:0;right:0;top:883px;text-align:center;font-weight:500;font-size:8.6px;color:${C.faint}">DRAG TO ORBIT &nbsp;·&nbsp; SCROLL TO ZOOM &nbsp;·&nbsp; H HIDES THE OVERLAY</div>`);
  const phSpot = (i) => [PX(i), 815 + 17];
  const tapSpot = (i) => [TX(i), 815 + 17];

  // ------------------------------------------------------------ callouts, the pointer
  const callSvg = add(`<svg data-callouts style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div data-callouts style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centre = (n) => {
    const r = n.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const knobX = (v) => SL.x + v * SL.w;

  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };
  const tog = (n, on, col = C.ink) => {
    n.style.background = on ? col : '#fff';
    n.style.color = on ? '#fff' : C.ink;
    n.style.borderColor = on ? col : C.line;
  };

  return {
    spots,
    phSpot,
    tapSpot,
    loadKnob: (v) => [knobX(v), sLoad.y],
    gridKnob: (v) => [knobX(v), sGrid.y],
    playKnob: (v) => [knobX(v), sPlay.y],
    btn,
    root: ui,
    /**
     * s: {S (VA), th (deg), k (tracked limb), tap (index), tapF (float, animating), hs, fan, fanOn, trip, energised,
     *     cam, cut, overlays, callouts, cursor, playText, playK, paused}
     */
    update(s) {
      const tapI = Math.round(s.tap);
      const Ug = s.Ug ?? R.U1;
      const o = operating(s.S, 0.9, tapI, Ug);
      const k = s.k;
      const on = s.energised ? 1 : 0;

      // ---- load
      loadBig.textContent = f0(s.S / 1000);
      loadUnit.style.left = `${40 + loadBig.offsetWidth + 6}px`;
      loadFill.style.width = `${((s.S / S_MAX) * BW).toFixed(1)}px`;
      loadFill.style.background = s.S > R.S ? `linear-gradient(90deg, ${C.acc} ${((R.S / s.S) * 100).toFixed(1)}%, ${s.fanOn ? C.acc : C.red} 0)` : C.acc;
      afZone.style.opacity = s.fan > 0.5 ? '0.35' : '1';
      afLbl.style.color = s.fan > 0.5 ? C.ink : C.mute;
      loadLine.innerHTML = s.energised
        ? `${(o.K * 100).toFixed(0)} % of AN rating`
        : s.relink
          ? `<span style="color:${C.red}">Breaker open · relinking taps</span>`
          : `<span style="color:${C.red}">Tripped · breaker open</span>`;
      loadSub.innerHTML = `LV <b style="color:${C.ink}">${f0(o.U2 * on)} V</b> &nbsp;·&nbsp; HV <b style="color:${C.ink}">${f1(o.I1 * on)} A</b> &nbsp;·&nbsp; <span class="nt">η</span> <b style="color:${C.ink}">${(o.eta * 100).toFixed(2)} %</b>`;
      sLoad.val.textContent = `${f0(s.S / 1000)} kVA`;
      sLoad.knob.style.left = `${knobX(s.S / S_MAX).toFixed(1)}px`;
      sGrid.val.innerHTML = `${(s.Ug / 1000).toFixed(2)} <span class="nt">kV</span>`;
      sGrid.knob.style.left = `${knobX(gridK(s.Ug)).toFixed(1)}px`;
      sPlay.val.textContent = s.playText;
      sPlay.knob.style.left = `${knobX(s.playK).toFixed(1)}px`;
      btn.pause.innerHTML = s.paused ? '▶ &nbsp;PLAY' : '❚❚ &nbsp;PAUSE';

      // ---- phasors: HV phase voltages (ink) and LV phase voltages (accent), rotating with θ; Dyn11 puts LV 30° ahead
      {
        const a0 = ((s.th % 360) + 360) % 360;
        phAng.innerHTML = `<span class="nt">θ</span> <b style="color:${C.ink}">${Math.round(a0)}°</b>`;
        const cx = 113;
        const cy = 66;
        let h = `<circle cx="${cx}" cy="${cy}" r="56" fill="none" stroke="${C.line}"/><line x1="${cx - 62}" x2="${cx + 62}" y1="${cy}" y2="${cy}" stroke="${C.line}" stroke-width=".8"/>`;
        const vec = (ang, r, col, w, lbl, bold) => {
          const x = cx + r * Math.cos(ang * D2R);
          const y = cy - r * Math.sin(ang * D2R);
          const lx = cx + (r + 9) * Math.cos(ang * D2R);
          const ly = cy - (r + 9) * Math.sin(ang * D2R);
          return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="${w}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${bold ? 2.6 : 1.8}" fill="${col}"/><text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" font-size="8" text-anchor="middle" fill="${col}" font-weight="${bold ? 700 : 500}">${lbl}</text>`;
        };
        for (let i = 0; i < 3; i++) h += vec(a0 - i * 120, 54, i === k ? C.ink : C.faint, i === k ? 1.6 : 1, ['A', 'B', 'C'][i], i === k);
        for (let i = 0; i < 3; i++) h += vec(a0 + 30 - i * 120, 34 * (o.U2 / o.U2nl) * on + 0.01, i === k ? C.acc : '#f5c27a', i === k ? 2 : 1.2, ['a', 'b', 'c'][i], i === k);
        // the 30° arc between the tracked pair
        const r = 22;
        const p0 = a0 - k * 120;
        const p1 = p0 + 30;
        const ax = (a) => (cx + r * Math.cos(a * D2R)).toFixed(1);
        const ay = (a) => (cy - r * Math.sin(a * D2R)).toFixed(1);
        h += `<path d="M${ax(p0)} ${ay(p0)} A${r} ${r} 0 0 0 ${ax(p1)} ${ay(p1)}" fill="none" stroke="${C.acc}" stroke-width="1"/>`;
        h += `<text x="4" y="12" font-size="7.4" letter-spacing="1" fill="${C.mute}">HV A B C</text><text x="4" y="22" font-size="7.4" letter-spacing="1" fill="${C.acc}">LV a b c</text><text x="222" y="12" font-size="7.4" letter-spacing="1" text-anchor="end" fill="${C.mute}">LV LEADS 30°</text><text x="222" y="128" font-size="7.4" letter-spacing="1" text-anchor="end" fill="${C.mute}">CLOCK 11</text>`;
        ph.innerHTML = h;
        phFoot.innerHTML = `<b style="color:${C.ink}">${(Ug / 1000).toFixed(2)}</b> kV · √3 · ${R.N2} / <b style="color:${C.ink}">${o.N1}</b> = <b style="color:${C.ink}">${f0(o.U2nl)}</b> V no load`;
      }

      // ---- flux: B in the three limbs over one cycle, the cursor at θ
      {
        const W = 232;
        const X = (d) => 20 + (d / 360) * (W - 28);
        const Y = (b) => 52 - (b / 1.8) * 44;
        let h = '';
        for (const [v, l] of [[1.6, '1.6'], [0, '0'], [-1.6, '−1.6']]) h += `<text x="15" y="${Y(v) + 2.5}" font-size="6.5" text-anchor="end" fill="${C.mute}">${l}</text><line x1="${X(0)}" x2="${X(360)}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v ? C.line : C.faint}" stroke-width=".8"/>`;
        const curve = (i, col, w) => {
          let p = '';
          for (let d = 0; d <= 360; d += 6) p += `${d ? 'L' : 'M'}${X(d).toFixed(1)} ${Y(bLimb(d, i, tapI, Ug) * on).toFixed(1)}`;
          return `<path d="${p}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
        };
        for (let i = 0; i < 3; i++) if (i !== k) h += curve(i, C.faint, 1.1);
        h += curve(k, C.acc, 1.8);
        const a0 = ((s.th % 360) + 360) % 360;
        h += `<line x1="${X(a0)}" x2="${X(a0)}" y1="${Y(1.8)}" y2="${Y(-1.8)}" stroke="${C.ink}" stroke-width="1"/>`;
        for (let i = 0; i < 3; i++) h += `<circle cx="${X(a0).toFixed(1)}" cy="${Y(bLimb(a0, i, tapI, Ug) * on).toFixed(1)}" r="${i === k ? 3 : 2}" fill="${i === k ? C.acc : C.grey}"/>`;
        for (const d of [0, 90, 180, 270, 360]) h += `<text x="${X(d)}" y="${Y(-1.8) + 10}" font-size="6.5" text-anchor="middle" fill="${C.mute}">${d}°</text>`;
        fx.innerHTML = h;
        fxLeg.innerHTML = PHASES.map((p, i) => `<span style="color:${i === k ? C.acc : C.mute}">${p}</span> <b style="color:${i === k ? C.ink : C.mute}">${(bLimb(s.th, i, tapI, Ug) * on >= 0 ? '+' : '−') + Math.abs(bLimb(s.th, i, tapI, Ug) * on).toFixed(2)}</b>`).join(' &nbsp; ');
      }

      // ---- tracked phase
      phName.innerHTML = `PHASE <b>${PHASES[k]}</b> &nbsp;·&nbsp; LIMB ${k + 1}`;
      phTurns.innerHTML = `<b style="color:${C.ink}">${o.N1} : ${R.N2}</b> TURNS`;
      curBig.textContent = f0(o.I2 * on);
      curUnit.style.left = `${1334 + curBig.offsetWidth + 8}px`;
      const row = (l, v) => `<div class="row"><span>${l}</span><b>${v}</b></div>`;
      phRows.innerHTML =
        `<div style="height:1px;background:${C.line};margin-bottom:6px"></div>` +
        row('HV line current', `${f1(o.I1 * on)} A`) +
        row('HV winding (Δ)', `${f1(o.I1w * on)} A`) +
        row('LV phase voltage', `${f0(o.U2ph * on)} V`) +
        row('Flux density peak', `${f2(o.B * on)} T`) +
        row('Volts per turn', `${f1((R.U1 / o.N1) * on)} V`) +
        row('Core · step fill', `${Math.round(CORE_D)} mm · 7 steps`);

      // ---- losses: iron constant, copper with K², the efficiency curve over load with the dot at S
      {
        etaHdr.innerHTML = `<span class="nt">η</span> <b style="color:${C.ink}">${(o.eta * 100).toFixed(2)} %</b>`;
        lossLeg.innerHTML = `<span style="color:${C.grey}">■</span> IRON <b>${f2((o.P0 * on) / 1000)}</b> &nbsp; <span style="color:${C.acc}">■</span> COPPER <b>${f2((o.Pcu * on) / 1000)}</b> <span class="nt">kW</span>`;
        const W = 232;
        let h = '';
        // stacked bar of the two losses, out of 25 kW
        const bw = W - 24;
        const sc = (p) => (p / 25000) * bw;
        h += `<rect x="12" y="2" width="${bw}" height="9" fill="#e6e7e9"/><rect x="12" y="2" width="${sc(o.P0 * on).toFixed(1)}" height="9" fill="${C.grey}"/><rect x="${(12 + sc(o.P0 * on)).toFixed(1)}" y="2" width="${sc(o.Pcu * on).toFixed(1)}" height="9" fill="${C.acc}"/>`;
        h += `<text x="12" y="21" font-size="6.5" fill="${C.mute}">0</text><text x="${12 + bw}" y="21" font-size="6.5" text-anchor="end" fill="${C.mute}">25 kW</text>`;
        // η over load
        const X = (S) => 22 + (S / S_MAX) * (W - 32);
        const Y = (e) => 112 - ((e - 0.975) / (0.992 - 0.975)) * 80;
        for (const [e, l] of [[0.99, '99.0'], [0.98, '98.0']]) h += `<line x1="${X(0)}" x2="${X(S_MAX)}" y1="${Y(e)}" y2="${Y(e)}" stroke="${C.line}" stroke-width=".8"/><text x="18" y="${Y(e) + 2.5}" font-size="6.5" text-anchor="end" fill="${C.mute}">${l}</text>`;
        let p = '';
        for (let S = 60e3; S <= S_MAX; S += 30e3) p += `${p ? 'L' : 'M'}${X(S).toFixed(1)} ${Y(Math.max(0.975, operating(S, 0.9, tapI, Ug).eta)).toFixed(1)}`;
        h += `<path d="${p}" fill="none" stroke="${C.ink}" stroke-width="1.3"/>`;
        // peak efficiency where copper = iron losses
        const Sopt = R.S * Math.sqrt(o.P0 / R.Pk);
        h += `<line x1="${X(Sopt)}" x2="${X(Sopt)}" y1="${Y(0.992)}" y2="${Y(0.975)}" stroke="${C.faint}" stroke-dasharray="2 2"/><text x="${X(Sopt) + 3}" y="${Y(0.9915)}" font-size="6.2" letter-spacing=".8" fill="${C.mute}">PEAK η · P<tspan font-size="5" dy="1">CU</tspan><tspan dy="-1"> = P</tspan><tspan font-size="5" dy="1">FE</tspan></text>`;
        if (on && s.S > 30e3) h += `<circle cx="${X(s.S).toFixed(1)}" cy="${Y(Math.max(0.975, o.eta)).toFixed(1)}" r="3.2" fill="${C.acc}"/>`;
        for (const S of [0, 500e3, 1000e3, 1500e3]) h += `<text x="${X(S)}" y="124" font-size="6.5" text-anchor="middle" fill="${C.mute}">${S / 1000}</text>`;
        h += `<text x="${X(S_MAX)}" y="133" font-size="6.2" letter-spacing="1" text-anchor="end" fill="${C.mute}">LOAD kVA · ROOM AIR ${f0(o.air * on)} m³/h</text>`;
        ef.innerHTML = h;
      }

      // ---- temperature: hot spot against the PTC thresholds, fans, trip
      {
        const t = s.hs;
        const T = R.tc;
        const hot = s.trip ? C.red : t >= T.alarm ? C.red : t >= T.fanOn ? C.acc : C.ink;
        tBig.textContent = Math.round(t);
        tBig.style.color = hot;
        tUnit.style.left = `${1334 + tBig.offsetWidth + 8}px`;
        const W = 232;
        const X = (v) => 8 + ((Math.min(170, Math.max(40, v)) - 40) / 130) * (W - 16);
        let h = `<rect x="${X(40)}" y="22" width="${X(170) - X(40)}" height="8" fill="#e6e7e9"/>`;
        h += `<rect x="${X(40)}" y="22" width="${Math.max(0, X(t) - X(40)).toFixed(1)}" height="8" fill="${hot}"/>`;
        const mark = (v, l, col, dash) => `<line x1="${X(v)}" x2="${X(v)}" y1="14" y2="38" stroke="${col}" stroke-width="1" ${dash ? 'stroke-dasharray="2 2"' : ''}/><text x="${X(v)}" y="10" font-size="6.4" letter-spacing=".8" text-anchor="middle" fill="${col}" font-weight="600">${l}</text><text x="${X(v)}" y="48" font-size="6.5" text-anchor="middle" fill="${C.mute}">${v}</text>`;
        h += mark(T.fanOff, 'FAN OFF', C.mute, true) + mark(T.fanOn, 'FAN ON', C.ink) + mark(T.alarm, 'ALARM', C.ink) + mark(T.trip, 'TRIP', C.red);
        h += `<text x="${X(40)}" y="48" font-size="6.5" fill="${C.mute}">40</text>`;
        th.innerHTML = h;
        const fanTxt = s.fan > 0.5 ? `<span style="color:${C.acc}">ON · AF</span>` : 'OFF · AN';
        tRows.innerHTML =
          row('Hot spot (est.) · ambient', `${Math.round(hotSpot(t))} · ${R.amb} °C`) +
          row('Fans', fanTxt) +
          row('Rating now', s.fan > 0.5 ? '1500 kVA' : '1000 kVA') +
          row('Stray field at 3 m', `${f1(o.stray * on)} µT`) +
          row('Thermal time', `τ ${R.tau} min · ×800`);
        btn.reset.style.display = s.trip ? 'flex' : 'none';
      }

      // ---- pickers
      {
        let h = '';
        PHASES.forEach((p, i) => {
          const [x] = phSpot(i);
          const t = i === k;
          h += `<circle cx="${x}" cy="17" r="12" fill="${t ? C.acc : '#fff'}" stroke="${t ? C.acc : C.faint}" stroke-width="1.2"/><text x="${x}" y="20.5" font-size="10" text-anchor="middle" font-weight="600" fill="${t ? '#fff' : C.ink}">${p}</text>`;
        });
        TAPS.forEach((p, i) => {
          const [x] = tapSpot(i);
          if (i) h += `<line x1="${x - 38}" x2="${x - 14}" y1="17" y2="17" stroke="${C.faint}"/>`;
          const t = i === tapI;
          h += `<circle cx="${x}" cy="17" r="13" fill="${t ? C.ink : '#fff'}" stroke="${t ? C.ink : C.faint}" stroke-width="1.2"/><text x="${x}" y="20.5" font-size="9.5" text-anchor="middle" font-weight="600" fill="${t ? '#fff' : C.ink}">${tapName(i)}</text>`;
          h += `<text x="${x}" y="41" font-size="7" text-anchor="middle" fill="${t ? C.ink : C.mute}" letter-spacing=".5">${(p.V / 1000).toFixed(p.V % 500 ? 2 : 1)}</text>`;
        });
        pk.innerHTML = h;
        const match = Math.abs(o.U2nl - R.U2) < 6;
        tapSub.innerHTML = `LINK <b style="color:${C.ink}">${tapName(tapI)}</b> · <b style="color:${C.ink}">${TAPS[tapI].V}</b> V TAP · <b style="color:${C.ink}">${tapTurns(tapI)}</b> TURNS &nbsp;·&nbsp; GRID <b style="color:${C.ink}">${(Ug / 1000).toFixed(2)} kV</b> → LV <b style="color:${match ? C.ink : C.red}">${f0(o.U2nl)} V</b>${match ? '' : ` · <span style="color:${C.red}">RELINK</span>`}`;
      }

      // ---- toggles
      for (const c of CAMS) tog(btn[c], s.cam === c);
      for (const c of CUTS) tog(btn[c], s.cut === c);
      for (const c of OVERLAYS) tog(btn[c], !!s.overlays[c], C.acc);

      // ---- callouts: a label, a thin leader to its point in the unit
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = c.w < 0;
        const w = Math.abs(c.w);
        const ex = right ? lx - w : lx + w;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${lx.toFixed(1)},${(ly + 16).toFixed(1)} ${ex.toFixed(1)},${(ly + 16).toFixed(1)}" fill="none" stroke="${C.mute}" stroke-width=".8" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2" fill="${C.ink}" opacity="${c.o.toFixed(2)}"/>`;
        if (c.name) ch += `<div class="call" style="${right ? `right:${(1600 - lx).toFixed(1)}px;text-align:right` : `left:${lx.toFixed(1)}px`};top:${(ly - 10).toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
    pointer,
  };
}
