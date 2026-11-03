// The transformer's overlay, a fixed 1600 x 900 layout: the title and the load top left, the core flux over one 50 Hz
// period and the vector-group clock on the left, the transport and the operating sliders bottom left; on the right four
// tabs: OPERATE (temperatures, ageing, losses, efficiency), CONFIGURE (every option the manual offers, click to
// cycle), DATASHEET (what follows from the configuration) and SERVICE (commissioning, maintenance, the Buchholz test);
// view, cutaway, subsystem and overlay toggles bottom right; the tap changer strip bottom centre; the manual's part
// numbers (Fig. 6) as callouts into the model. update(s) redraws every live part from the frame's state.
import {coordination, FAULTS, fitted, FUSE_CURVE, fuseTime, pt100Err, pt100R, SET, statusOf} from './protect.js';
import {BUCHHOLZ, ECOTAP, efficiency, FLUIDS, LIMITS, MAINT, OPTION_KEYS, OPTIONS, optText, PARTS, SAFETY_RULES, UT1_STANDARD} from './trafo.js';

export const C = {ink: '#16181b', mute: '#8b8f95', faint: '#c9ccd0', line: '#e1e3e6', panel: 'rgba(248,248,249,.94)', red: '#d6182b', blue: '#3d8fe0', grey: '#5d6670', orange: '#f05a23', hot: '#ff7a2e', cool: '#5aa7e6', est: '#a3a7ad'};
export const PH_COL = ['#3d8fe0', '#16181b', '#9aa0a7'];
export const CAMS = ['hero', 'front', 'side', 'top', 'lid', 'inside'];
export const CUTS = ['solid', 'glass', 'section'];
export const VIEWS = ['all', 'active', 'core', 'windings', 'oil', 'fittings'];
export const OVERLAYS = ['parts', 'flux', 'current', 'flow', 'untank'];
export const TABS = ['operate', 'configure', 'datasheet', 'protect', 'service'];
const TAB_LABEL = {operate: 'OPERATE', configure: 'CONFIG', datasheet: 'DATA', protect: 'PROTECT', service: 'SERVICE'};
export const LOAD_MAX = 1.5;
export const TA_RANGE = [-25, 40];
const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.pn{position:absolute;background:${C.panel};border:1px solid ${C.line};box-shadow:0 1px 2px rgba(20,22,26,.04)}
.cp{font-size:9.6px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap}
.mu{color:${C.mute}}
.mo{font-family:'JetBrains Mono',monospace}
.tb{position:absolute;height:19px;padding:0 7px;display:flex;align-items:center;justify-content:center;font-size:8.8px;font-weight:600;letter-spacing:.9px;text-transform:uppercase;border:1px solid ${C.line};background:#fff;color:${C.ink};white-space:nowrap}
.call{position:absolute;white-space:nowrap}
.call b{display:block;font-size:11.5px;font-weight:600;letter-spacing:.1px}
.call span{display:block;font-size:8.6px;font-weight:500;letter-spacing:1.4px;color:${C.mute};text-transform:uppercase;margin-top:2px}
.num{position:absolute;width:19px;height:19px;margin:-9.5px 0 0 -9.5px;border-radius:50%;background:#fff;border:1.2px solid ${C.ink};font:700 9.5px Inter,sans-serif;display:flex;align-items:center;justify-content:center}
.num.on{background:${C.red};border-color:${C.red};color:#fff}
.row{position:absolute;left:1329px;width:224px;height:21px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${C.line}}
.row .k{font-size:8.4px;font-weight:600;letter-spacing:1.2px;color:${C.mute}}
.row .v{font-size:9.2px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}
.row .v i{font-style:normal;font-weight:500;color:${C.faint};margin-left:6px;font-size:8px}
.ds{position:absolute;left:1329px;width:224px;font-size:9.1px;line-height:15.2px}
.ds div{display:flex;justify-content:space-between;white-space:nowrap;gap:6px}
.ds div span:first-child{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
.ds div b{flex:none}
.ds div span:first-child{color:${C.mute}}
.ds div b{font-weight:600}
.ds div b.e{color:${C.est};font-weight:500}
.ds h4{margin:7px 0 1px;font-size:8.4px;font-weight:700;letter-spacing:1.4px;color:${C.ink};border-bottom:1px solid ${C.line};padding-bottom:2px}
.sv{position:absolute;left:1329px;width:224px;font-size:8.9px;line-height:12.6px;color:${C.ink}}
.sv h4{margin:7px 0 2px;font-size:8.4px;font-weight:700;letter-spacing:1.4px;border-bottom:1px solid ${C.line};padding-bottom:2px}
.sv p{margin:0 0 3px;color:#3b3f45}
.sv .m{color:${C.mute}}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.red};opacity:0;z-index:49}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const fx = (v, d = 0) => Number(v).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d});
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`;

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

  // ------------------------------------------------------------ title and the load
  add(`<div style="position:absolute;left:35px;top:33px;width:43px;height:3px;background:${C.red}"></div>`);
  const title = add(`<div style="position:absolute;left:35px;top:45px;font-size:24px;font-weight:700;letter-spacing:-.2px;white-space:nowrap"></div>`);
  const subtitle = add(`<div class="cp" style="position:absolute;left:35px;top:79px;font-weight:500;letter-spacing:1.5px;font-size:9.2px"></div>`);
  const loadBig = add(`<div style="position:absolute;left:33px;top:101px;font-size:56px;font-weight:800;letter-spacing:-3.2px;color:${C.red};line-height:1"></div>`);
  const loadUnit = add(`<div style="position:absolute;top:139px;font-size:11px;font-weight:600;letter-spacing:1px">kVA</div>`);
  const loadMax = add(`<div style="position:absolute;left:226px;top:141px;font-size:11px;font-weight:500;text-align:right;width:56px"></div>`);
  add(`<div style="position:absolute;left:35px;top:164px;width:247px;height:6px;border:1px solid ${C.faint};border-top:none"></div>`);
  add(`<div style="position:absolute;left:35px;top:172px;width:247px;height:9px;background:#e6e7e9"></div>`);
  add(`<div style="position:absolute;left:${35 + 247 / 1.5}px;top:168px;width:1px;height:17px;background:${C.ink}"></div>`);
  const loadFill = add(`<div style="position:absolute;left:35px;top:172px;height:9px;background:${C.red}"></div>`);
  add(`<div class="cp mu" style="position:absolute;left:35px;top:187px;font-size:9px;font-weight:500">0</div>`);
  add(`<div class="cp" style="position:absolute;left:${35 + 247 / 1.5 - 14}px;top:187px;font-size:9px;font-weight:500">100 %</div>`);
  add(`<div class="cp mu" style="position:absolute;left:250px;top:187px;font-size:9px;font-weight:500">150 %</div>`);
  add(`<div style="position:absolute;left:35px;top:204px;width:247px;height:1px;background:${C.faint}"></div>`);
  const loadLine = add(`<div style="position:absolute;left:35px;top:211px;font-size:12px;font-weight:500;white-space:nowrap"></div>`);

  // ------------------------------------------------------------ core flux over one period
  add(`<div class="pn" style="left:35px;top:240px;width:247px;height:194px"></div>`);
  add(`<div class="cp" style="position:absolute;left:46px;top:252px;font-weight:700">CORE FLUX · 50 HZ</div>`);
  const fluxAng = add(`<div class="cp mu" style="position:absolute;right:${1600 - 271}px;top:252px;font-weight:500"></div>`);
  const fluxLeg = add(`<div class="cp" style="position:absolute;left:46px;top:268px;font-size:8.6px;font-weight:500"></div>`);
  const flux = add(`<svg style="position:absolute;left:44px;top:282px" width="232" height="112"></svg>`);
  add(`<div style="position:absolute;left:46px;top:398px;width:226px;height:1px;background:${C.line}"></div>`);
  const fluxFoot = add(`<div style="position:absolute;left:46px;top:405px;font-size:9.5px;color:${C.mute};white-space:nowrap"></div>`);
  const fluxFoot2 = add(`<div style="position:absolute;left:46px;top:418px;font-size:9.5px;color:${C.mute};white-space:nowrap"></div>`);

  // ------------------------------------------------------------ vector group clock
  add(`<div class="pn" style="left:35px;top:442px;width:247px;height:178px"></div>`);
  add(`<div class="cp" style="position:absolute;left:46px;top:454px;font-weight:700">VECTOR GROUP</div>`);
  const vgName = add(`<div class="cp" style="position:absolute;right:${1600 - 271}px;top:454px;font-weight:700;color:${C.red}"></div>`);
  const vg = add(`<svg style="position:absolute;left:44px;top:470px" width="232" height="120"></svg>`);
  const vgFoot = add(`<div style="position:absolute;left:46px;top:597px;font-size:9.5px;color:${C.mute};white-space:nowrap"></div>`);

  // ------------------------------------------------------------ transport and sliders
  add(`<div class="pn" style="left:35px;top:630px;width:259px;height:255px"></div>`);
  btn.pause = add(`<div class="tb" style="left:45px;top:639px;width:99px;height:26px;background:${C.red};color:#fff;border-color:${C.red};font-size:9.6px">❚❚ &nbsp;PAUSE</div>`);
  btn.back = add(`<div class="tb" style="left:149px;top:639px;width:66px;height:26px;font-size:9.6px">−30°</div>`);
  btn.fwd = add(`<div class="tb" style="left:219px;top:639px;width:66px;height:26px;font-size:9.6px">+30°</div>`);
  const SL = {x: 46, w: 238};
  const sliders = {};
  [['load', 'LOAD'], ['ambient', 'AMBIENT'], ['pf', 'POWER FACTOR'], ['grid', 'GRID VOLTAGE'], ['play', 'TIME-LAPSE']].forEach(([k, name], i) => {
    const y = 676 + i * 41;
    add(`<div class="cp" style="position:absolute;left:45px;top:${y}px;font-weight:500">${name}</div>`);
    const val = add(`<div class="cp" style="position:absolute;right:${1600 - 284}px;top:${y}px;font-weight:700"></div>`);
    add(`<div style="position:absolute;left:${SL.x}px;top:${y + 18}px;width:${SL.w}px;height:2px;background:#e1e3e6"></div>`);
    const knob = add(`<div style="position:absolute;top:${y + 13}px;width:9px;height:11px;margin-left:-4.5px;background:${C.red}"></div>`);
    sliders[k] = {y: y + 18, val, knob};
  });
  const knobX = (v) => SL.x + v * SL.w;

  // ------------------------------------------------------------ legend
  add(`<div class="cp" style="position:absolute;left:0;right:0;top:36px;display:flex;justify-content:center;gap:16px;font-weight:500;font-size:9.6px">
    ${[['FLUX Φ', C.red], ['LOAD CURRENT', C.orange], ['HOT FLUID', C.hot], ['COOLED FLUID', C.cool]].map(([n, c]) => `<span><i style="display:inline-block;width:15px;height:2.4px;background:${c};vertical-align:middle;margin-right:6px"></i>${n}</span>`).join('')}</div>`);
  const notesBox = add(`<div class="cp" style="position:absolute;left:0;right:0;top:56px;text-align:center;font-weight:600;font-size:9.2px;color:${C.red}"></div>`);

  // ------------------------------------------------------------ right column: tabs
  const tabX = [1318, 1366, 1418, 1460, 1514];
  const tabW = [46, 50, 40, 52, 49];
  TABS.forEach((k, i) => (btn[k] = add(`<div class="tb" style="left:${tabX[i]}px;top:36px;width:${tabW[i]}px;height:22px;padding:0;font-size:8px;letter-spacing:.5px">${TAB_LABEL[k]}</div>`)));
  add(`<div class="pn" style="left:1318px;top:62px;width:245px;height:640px"></div>`);
  const pane = {};
  for (const k of TABS) pane[k] = add(`<div style="position:absolute;inset:0"></div>`);
  const padd = (k, h) => {
    const n = el(h);
    pane[k].appendChild(n);
    return n;
  };

  // OPERATE
  padd('operate', `<div class="cp" style="position:absolute;left:1329px;top:74px;font-weight:700">THERMAL · IEC 60076-7</div>`);
  const clock = padd('operate', `<div class="cp mu" style="position:absolute;right:${1600 - 1552}px;top:74px;font-weight:500"></div>`);
  const topBig = padd('operate', `<div style="position:absolute;left:1328px;top:92px;font-size:36px;font-weight:800;letter-spacing:-1.6px;color:${C.red};line-height:1"></div>`);
  const topUnit = padd('operate', `<div style="position:absolute;top:96px;font-size:10.5px;font-weight:500;letter-spacing:1px;line-height:1.35">°C<br><span style="color:${C.mute};letter-spacing:1.5px">TOP OIL</span></div>`);
  const hotBox = padd('operate', `<div style="position:absolute;left:1468px;top:92px;text-align:right;width:85px"></div>`);
  const thermo = padd('operate', `<svg style="position:absolute;left:1326px;top:132px" width="232" height="40"></svg>`);
  const thermoRows = padd('operate', `<div class="ds" style="top:176px"></div>`);
  padd('operate', `<div class="cp" style="position:absolute;left:1329px;top:262px;font-weight:700">LAST 6 H</div>`);
  const histLeg = padd('operate', `<div class="cp mu" style="position:absolute;right:${1600 - 1552}px;top:262px;font-weight:500"></div>`);
  const hist = padd('operate', `<svg style="position:absolute;left:1326px;top:278px" width="232" height="104"></svg>`);
  padd('operate', `<div class="cp" style="position:absolute;left:1329px;top:394px;font-weight:700">LOSSES · EFFICIENCY</div>`);
  const etaBig = padd('operate', `<div class="cp" style="position:absolute;right:${1600 - 1552}px;top:394px;font-weight:700;color:${C.red};text-transform:none"></div>`);
  const lossRows = padd('operate', `<div class="ds" style="top:410px"></div>`);
  const eff = padd('operate', `<svg style="position:absolute;left:1326px;top:512px" width="232" height="96"></svg>`);
  padd('operate', `<div class="cp" style="position:absolute;left:1329px;top:616px;font-weight:700">LV SIDE</div>`);
  const lvRows = padd('operate', `<div class="ds" style="top:632px"></div>`);

  // CONFIGURE
  padd('configure', `<div class="cp" style="position:absolute;left:1329px;top:74px;font-weight:700">CONFIGURATION</div>`);
  padd('configure', `<div class="cp mu" style="position:absolute;right:${1600 - 1552}px;top:74px;font-weight:500">CLICK TO CHANGE</div>`);
  const rows = {};
  OPTION_KEYS.forEach((k, i) => {
    rows[k] = padd('configure', `<div class="row" style="top:${92 + i * 23}px"><span class="k">${OPTIONS[k].label}</span><span class="v"></span></div>`);
  });
  const cfgNotes = padd('configure', `<div class="sv" style="top:${92 + OPTION_KEYS.length * 23 + 8}px"></div>`);

  // PROTECT
  padd('protect', `<div class="cp" style="position:absolute;left:1329px;top:74px;font-weight:700">PROTECTION · p.38–50</div>`);
  const prChip = padd('protect', `<div class="cp" style="position:absolute;right:${1600 - 1552}px;top:72px;font-weight:700;padding:2px 6px;color:#fff"></div>`);
  const devBox = padd('protect', `<div style="position:absolute;left:1329px;top:90px;width:224px"></div>`);
  padd('protect', `<div class="cp mu" style="position:absolute;left:1329px;top:347px;font-weight:500;font-size:8.6px">FAULTS · CLICK TO INJECT</div>`);
  FAULTS.forEach((f, i) => {
    btn['f_' + f.key] = padd('protect', `<div class="tb" style="left:${1329 + (i % 3) * 76}px;top:${361 + Math.floor(i / 3) * 22}px;width:72px;padding:0;font-size:7.8px;letter-spacing:.5px">${f.name}</div>`);
  });
  btn.f_reset = padd('protect', `<div class="tb" style="left:1329px;top:405px;width:224px;padding:0;font-size:7.8px">RESET · CAUSE CLEARED (p.54)</div>`);
  padd('protect', `<div class="cp" style="position:absolute;left:1329px;top:434px;font-weight:700">FUSE COORDINATION</div>`);
  const fuseLeg = padd('protect', `<div class="cp mu" style="position:absolute;left:1352px;top:452px;font-weight:500;font-size:7.4px;letter-spacing:.8px"></div>`);
  const fuseSvg = padd('protect', `<svg style="position:absolute;left:1326px;top:448px" width="232" height="150"></svg>`);
  const fuseChk = padd('protect', `<div class="ds" style="top:598px;line-height:13px;font-size:8.6px"></div>`);
  const logBox = padd('protect', `<div class="sv" style="top:640px;font-size:8.4px;line-height:11.6px"></div>`);

  // DATASHEET and SERVICE
  const dsBox = padd('datasheet', `<div class="ds" style="top:68px"></div>`);
  const svBox = padd('service', `<div class="sv" style="top:68px"></div>`);

  // ------------------------------------------------------------ camera, cutaway, subsystems, overlays
  add(`<div class="pn" style="left:1296px;top:710px;width:268px;height:175px"></div>`);
  const group = (title, keys, y, labels) => {
    add(`<div class="cp mu" style="position:absolute;left:1305px;top:${y}px;font-weight:500;font-size:8.6px">${title}</div>`);
    let x = 1305;
    let yy = y + 13;
    keys.forEach((k) => {
      const w = Math.round(labels[k].length * 5.7 + 10);
      if (x + w > 1556) {
        x = 1305;
        yy += 22;
      }
      btn[k] = add(`<div class="tb" style="left:${x}px;top:${yy}px;width:${w}px">${labels[k]}</div>`);
      x += w + 3;
    });
  };
  const L = Object.fromEntries([...CAMS, ...CUTS, ...VIEWS, ...OVERLAYS].map((k) => [k, k.toUpperCase()]));
  L.windings = 'COILS';
  group('CAMERA', CAMS, 716, L);
  group('CUTAWAY', CUTS, 754, L);
  group('SHOW', VIEWS, 792, L);
  group('OVERLAYS', OVERLAYS, 844, L);

  // ------------------------------------------------------------ the tap changer strip and the part card
  const card = add(`<div style="position:absolute;left:430px;width:740px;top:706px;text-align:center;background:rgba(248,248,249,.9);border:1px solid ${C.line};padding:7px 12px 8px;box-sizing:border-box"></div>`);
  const tapHead = add(`<div class="cp mu" style="position:absolute;left:0;right:0;top:791px;text-align:center;font-weight:500"></div>`);
  const tapSvg = add(`<svg style="position:absolute;left:560px;top:808px" width="480" height="34"></svg>`);
  const tapFoot = add(`<div class="cp mu" style="position:absolute;left:0;right:0;top:848px;text-align:center;font-weight:500"></div>`);
  add(`<div class="cp" style="position:absolute;left:0;right:0;top:872px;text-align:center;font-weight:500;color:${C.faint}">DRAG TO ORBIT &nbsp;·&nbsp; SCROLL TO ZOOM &nbsp;·&nbsp; CLICK A NUMBER FOR THE PART &nbsp;·&nbsp; H HIDES THE OVERLAY</div>`);
  let tapN = 5;
  const tapSpot = (i, n = tapN) => {
    const gap = n > 5 ? 44 : 56;
    return [800 - ((n - 1) * gap) / 2 + i * gap, 808 + 17];
  };

  // ------------------------------------------------------------ callouts, part numbers, the pointer
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const numG = add(`<div style="position:absolute;inset:0"></div>`);
  const nums = PARTS.map((p) => {
    const n = el(`<div class="num">${p.n}</div>`);
    numG.appendChild(n);
    return n;
  });
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centre = (n) => {
    const left = parseFloat(n.style.left);
    const top = parseFloat(n.style.top);
    return [left + parseFloat(n.style.width) / 2, top + (parseFloat(n.style.height) || 19) / 2];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const rowSpot = (k) => [1500, 92 + OPTION_KEYS.indexOf(k) * 23 + 10];

  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };
  const setBtn = (k, on, accent = false) => {
    const b = btn[k];
    if (!b) return;
    b.style.background = on ? (accent ? C.red : C.ink) : '#fff';
    b.style.color = on ? '#fff' : C.ink;
    b.style.borderColor = on ? (accent ? C.red : C.ink) : C.line;
  };
  const cache = {};
  const once = (key, val, fn) => {
    if (cache[key] === val) return;
    cache[key] = val;
    fn();
  };

  return {
    spots,
    rowSpot,
    tapSpot: (i) => tapSpot(i),
    knob: (k, v) => [knobX(v), sliders[k].y],
    sliders: Object.fromEntries(Object.entries(sliders).map(([k, s]) => [k, s.y])),
    SL,
    btn,
    rows,
    nums,
    root: ui,
    pointer,
    update(s) {
      const sp = s.sp;
      const cfg = sp.cfg;
      // ---------------------------------------------------------------- title, load
      once('title', `${sp.S}|${cfg.core}|${cfg.design}|${cfg.hv}|${cfg.vector}|${cfg.tapchanger}|${cfg.fluid}`, () => {
        title.innerHTML = `Oil Transformer <span style="color:${C.red}">·</span> ${sp.S} kVA`;
        const kind = cfg.tapchanger === 'oltc' ? 'REGULATED' : cfg.core === 'amorphous' ? 'AMORPHOUS' : cfg.core === 'lowrad' ? 'LOW-RADIATION' : 'DISTRIBUTION';
        subtitle.innerHTML = `ONAN &nbsp;•&nbsp; ${cfg.hv} / 0.4 KV &nbsp;•&nbsp; ${cfg.vector.toUpperCase()} &nbsp;•&nbsp; ${optText('design', cfg.design)} &nbsp;•&nbsp; ${kind}`;
        loadMax.textContent = `${fx(sp.S * 1.5)}`;
      });
      const kva = s.K * sp.S;
      loadBig.textContent = fx(kva);
      loadUnit.style.left = `${38 + loadBig.getBoundingClientRect().width / (s.scale || 1) + 6}px`;
      loadFill.style.width = `${Math.min(247, (s.K / LOAD_MAX) * 247).toFixed(1)}px`;
      loadFill.style.background = s.K > s.contK + 1e-3 ? C.red : C.ink;
      loadLine.innerHTML = `Load <b>${Math.round(s.K * 100)} %</b> &nbsp;·&nbsp; cos φ <b>${s.pf.toFixed(2)}</b> &nbsp;·&nbsp; ${fx(s.K * sp.i2)} A LV`;

      // ---------------------------------------------------------------- flux over one period, the cursor at θ
      const th = ((s.th % 360) + 360) % 360;
      fluxAng.innerHTML = `<span style="text-transform:none">θ</span> <b style="color:${C.ink}">${Math.round(th)}°</b> · ${(th / 18).toFixed(1)} MS`;
      {
        const W = 232;
        const X = (d) => 14 + (d / 360) * (W - 20);
        const Y = (v) => 52 - v * 40;
        let h = '';
        for (const v of [-1, 0, 1]) h += `<line x1="${X(0)}" x2="${X(360)}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v ? C.line : C.faint}" stroke-width=".8"/>`;
        h += `<text x="2" y="${Y(1) + 3}" font-size="6.5" fill="${C.mute}">+1</text><text x="2" y="${Y(-1) + 3}" font-size="6.5" fill="${C.mute}">−1</text>`;
        const curve = (fn, col, w, dash = '') => {
          let p = '';
          for (let d = 0; d <= 360; d += 6) p += `${d ? 'L' : 'M'}${X(d).toFixed(1)} ${Y(fn(d)).toFixed(1)}`;
          return `<path d="${p}" fill="none" stroke="${col}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
        };
        const D = Math.PI / 180;
        [0, -120, 120].forEach((p, i) => (h += curve((d) => -Math.cos((d + p) * D), i === s.limb ? C.red : PH_COL[i], i === s.limb ? 1.8 : 1)));
        // the tracked limb's LV current, dashed, scaled by the load
        const ph = [0, -120, 120][s.limb];
        h += curve((d) => s.K * Math.sin((d + ph - s.phi - sp.shift) * D) / LOAD_MAX, C.orange, 1.1, '3 2');
        const cx = X(th);
        h += `<line x1="${cx}" x2="${cx}" y1="${Y(1) - 6}" y2="${Y(-1) + 4}" stroke="${C.red}" stroke-width="1.2"/>`;
        s.flux.forEach((f, i) => (h += `<circle cx="${cx}" cy="${Y(f).toFixed(1)}" r="${i === s.limb ? 3.2 : 2.2}" fill="${i === s.limb ? C.red : PH_COL[i]}"/>`));
        for (const d of [0, 90, 180, 270, 360]) h += `<text x="${X(d)}" y="${Y(-1) + 14}" font-size="6.5" text-anchor="middle" fill="${C.mute}">${d}</text>`;
        h += `<text x="${X(360)}" y="${Y(-1) + 24}" font-size="6.2" letter-spacing="1" text-anchor="end" fill="${C.mute}">ELECTRICAL ANGLE θ · 20 MS PERIOD</text>`;
        flux.innerHTML = h;
        fluxLeg.innerHTML = ['U', 'V', 'W'].map((n, i) => `<span style="color:${i === s.limb ? C.red : PH_COL[i]}">—</span> ${n} <b>${(s.flux[i] >= 0 ? '+' : '−') + Math.abs(s.flux[i] * sp.core.bPeak).toFixed(2)}</b>`).join(' &nbsp;') + ` T &nbsp;<span style="color:${C.orange}">┅</span> I<sub>LV</sub> U`;
        fluxFoot.innerHTML = `B̂ <b style="color:${C.ink}">${sp.core.bPeak.toFixed(2)} T</b> &nbsp;·&nbsp; ${sp.amorph ? 'amorphous ribbon 0.025 mm' : 'grain-oriented sheet, stepped limbs'}`;
        fluxFoot2.innerHTML = `Φ lags U by 90° &nbsp;·&nbsp; Σ Φ = 0 in the three limbs`;
      }
      // ---------------------------------------------------------------- vector group clock
      once('vg', `${cfg.vector}|${Math.round(th)}`, () => {
        vgName.textContent = cfg.vector.toUpperCase();
        const W = 232;
        const cx1 = 58;
        const cx2 = 172;
        const cy = 58;
        const R = 42;
        let h = '';
        for (const [cx, lab] of [[cx1, 'HV · D'], [cx2, cfg.vector.startsWith('Y') ? 'LV · zn' : 'LV · yn']]) {
          h += `<circle cx="${cx}" cy="${cy}" r="${R + 6}" fill="none" stroke="${C.line}"/>`;
          for (let k = 0; k < 12; k++) {
            const a = (k * 30 * Math.PI) / 180;
            h += `<line x1="${cx + Math.sin(a) * (R + 2)}" y1="${cy - Math.cos(a) * (R + 2)}" x2="${cx + Math.sin(a) * (R + 6)}" y2="${cy - Math.cos(a) * (R + 6)}" stroke="${C.faint}"/>`;
          }
          h += `<text x="${cx}" y="${cy + R + 20}" font-size="7" letter-spacing="1.2" text-anchor="middle" fill="${C.mute}">${lab}</text>`;
        }
        // rotating phasors: HV at θ, LV lagging by the group's 150° or 330°
        const ph = (cx, base, col, w, lab) => {
          const a = ((base + th - 90) * Math.PI) / 180;
          const x = cx + Math.sin(a) * R;
          const y = cy - Math.cos(a) * R;
          return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="${w}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.3" fill="${col}"/><text x="${(cx + Math.sin(a) * (R - 12)).toFixed(1)}" y="${(cy - Math.cos(a) * (R - 12) + 3).toFixed(1)}" font-size="7" font-weight="600" text-anchor="middle" fill="${col}">${lab}</text>`;
        };
        [0, -120, 120].forEach((p, i) => {
          h += ph(cx1, -p, i === 0 ? C.ink : C.mute, i === 0 ? 1.6 : 1, ['1U', '1V', '1W'][i]);
          h += ph(cx2, -p - sp.shift, i === 0 ? C.red : C.mute, i === 0 ? 1.6 : 1, ['2U', '2V', '2W'][i]);
        });
        h += `<text x="${(cx1 + cx2) / 2}" y="${cy - 2}" font-size="8" text-anchor="middle" fill="${C.ink}" font-weight="600">${sp.shift}°</text><text x="${(cx1 + cx2) / 2}" y="${cy + 9}" font-size="6.4" letter-spacing="1" text-anchor="middle" fill="${C.mute}">= ${sp.shift / 30} × 30°</text>`;
        vg.innerHTML = h;
        vgFoot.innerHTML = `Parallel only with the same index &nbsp;·&nbsp; 5 ↔ 11 by reconnection`;
      });

      // ---------------------------------------------------------------- sliders
      const sv = s.sliders;
      sliders.load.val.textContent = `${Math.round(s.K * 100)} %`;
      sliders.load.knob.style.left = `${knobX(s.K / LOAD_MAX).toFixed(1)}px`;
      sliders.ambient.val.textContent = `${Math.round(s.ta)} °C`;
      sliders.ambient.knob.style.left = `${knobX((s.ta - TA_RANGE[0]) / (TA_RANGE[1] - TA_RANGE[0])).toFixed(1)}px`;
      sliders.pf.val.textContent = s.pf.toFixed(2);
      sliders.pf.knob.style.left = `${knobX((s.pf - 0.7) / 0.3).toFixed(1)}px`;
      sliders.grid.val.textContent = `${(s.ug * sp.un1).toFixed(2)} KV`;
      sliders.grid.knob.style.left = `${knobX((s.ug - 0.9) / 0.2).toFixed(1)}px`;
      sliders.play.val.textContent = sv.playText;
      sliders.play.knob.style.left = `${knobX(sv.playK).toFixed(1)}px`;
      btn.pause.innerHTML = s.paused ? '▶ &nbsp;PLAY' : '❚❚ &nbsp;PAUSE';

      // ---------------------------------------------------------------- tabs
      for (const k of TABS) {
        pane[k].style.display = s.tab === k ? '' : 'none';
        setBtn(k, s.tab === k);
      }
      const T = s.thermal;
      if (s.tab === 'operate') {
        clock.innerHTML = `T + <b style="color:${C.ink}">${hhmm(s.simMin)}</b>`;
        topBig.textContent = Math.round(T.top);
        topUnit.style.left = `${1334 + topBig.getBoundingClientRect().width / (s.scale || 1) + 6}px`;
        hotBox.innerHTML = `<div style="font-size:22px;font-weight:800;letter-spacing:-.8px;line-height:1;color:${T.hot > 98 ? C.red : C.ink}">${Math.round(T.hot)}<span style="font-size:10px;font-weight:600"> °C</span></div><div class="cp mu" style="font-size:8.4px;margin-top:3px">HOT SPOT</div>`;
        // the thermometer scale −20…120 °C, alarm and trip marks, needle and drag pointer
        {
          const X = (v) => 6 + ((v + 20) / 140) * 220;
          let h = `<rect x="${X(-20)}" y="10" width="${X(120) - X(-20)}" height="7" fill="#e6e7e9"/><rect x="${X(-20)}" y="10" width="${Math.max(0, X(T.top) - X(-20)).toFixed(1)}" height="7" fill="${T.top >= LIMITS.thermoAlarm ? C.red : C.ink}"/>`;
          h += `<rect x="${X(LIMITS.thermoAlarm)}" y="6" width="1.4" height="15" fill="${C.orange}"/><rect x="${X(LIMITS.thermoTrip)}" y="6" width="1.4" height="15" fill="${C.red}"/>`;
          h += `<path d="M${X(T.max).toFixed(1)} 4 l4 -4 h-8 z" fill="${C.red}"/>`;
          for (const v of [-20, 0, 20, 40, 60, 80, 100, 120]) h += `<text x="${X(v)}" y="30" font-size="6.5" text-anchor="middle" fill="${C.mute}">${v}</text>`;
          h += `<text x="${X(LIMITS.thermoAlarm) - 2}" y="39" font-size="6" text-anchor="end" fill="${C.orange}" letter-spacing=".6">ALARM 85</text><text x="${X(LIMITS.thermoTrip) + 2}" y="39" font-size="6" text-anchor="start" fill="${C.red}" letter-spacing=".6">TRIP 95</text>`;
          thermo.innerHTML = h;
        }
        const lvl = sp.cfg.design === 'breathing' ? `${T.levelCm >= 0 ? '+' : '−'}${Math.abs(T.levelCm).toFixed(1)} cm on the 20 °C mark` : sp.cfg.design === 'hermetic' ? `waves take +${T.dV.toFixed(0)} l` : `conservator +${T.dV.toFixed(0)} l`;
        thermoRows.innerHTML = [
          ['Drag pointer (max)', `${Math.round(T.max)} °C`],
          ['Ageing rate · Montsinger', `<span style="color:${T.V > 1 ? C.red : C.ink}">× ${T.V < 0.01 ? T.V.toExponential(1) : T.V.toFixed(2)}</span>`],
          ['Continuous load at ' + Math.round(s.ta) + ' °C', `${Math.round(s.contK * 100)} %`],
          ['Oil volume change', lvl],
          ['Ambient · limits', `${Math.round(s.ta)} °C · max 40 · mean 20`],
        ].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
        // history: top oil and hot spot over the last 6 thermal hours
        {
          const W = 232;
          const H = s.history ?? [];
          const X = (m) => 16 + (1 - m / 360) * (W - 22);
          const Y = (v) => 88 - clamp01((v + 20) / 140) * 80;
          let h = '';
          for (const v of [0, 40, 80, 120]) h += `<line x1="${X(360)}" x2="${X(0)}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.line}" stroke-width=".7"/><text x="12" y="${Y(v) + 2}" font-size="6.2" text-anchor="end" fill="${C.mute}">${v}</text>`;
          h += `<line x1="${X(360)}" x2="${X(0)}" y1="${Y(98)}" y2="${Y(98)}" stroke="${C.red}" stroke-width=".7" stroke-dasharray="2 2"/><text x="${X(0) - 2}" y="${Y(98) - 2}" font-size="6" text-anchor="end" fill="${C.red}">98 °C NORMAL AGEING</text>`;
          const line = (key, col, w) => {
            let p = '';
            H.forEach((r, i) => (p += `${i ? 'L' : 'M'}${X(r.ago).toFixed(1)} ${Y(r[key]).toFixed(1)}`));
            return p ? `<path d="${p}" fill="none" stroke="${col}" stroke-width="${w}"/>` : '';
          };
          h += line('hot', C.red, 1.4) + line('top', C.ink, 1.2) + line('ta', C.faint, 1);
          for (const m of [360, 240, 120, 0]) h += `<text x="${X(m)}" y="100" font-size="6.2" text-anchor="middle" fill="${C.mute}">${m ? `−${m / 60} h` : 'now'}</text>`;
          hist.innerHTML = h;
          histLeg.innerHTML = `<span style="color:${C.red}">—</span> HOT SPOT &nbsp;<span style="color:${C.ink}">—</span> TOP OIL`;
        }
        const Ls = s.loss;
        etaBig.textContent = `η ${(s.eta * 100).toFixed(2)} %`;
        lossRows.innerHTML = [
          ['No-load loss P0', `${fx(Ls.p0)} W`],
          [`Load loss Pk · K² (at ${Math.round(T.hot)} °C)`, `${fx(Ls.pk)} W`],
          ['Total · heat to the room', `${fx(Ls.tot)} W`],
          ['Cooling air · 3 m³/min per kW', `${(Ls.tot / 1000 * 3).toFixed(1)} m³/min`],
          ['Flow in the waves', `${s.flowSpeed.toFixed(0)} mm/s (est.)`],
        ].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
        // efficiency over the load, the marker at the operating point
        {
          const W = 232;
          const X = (k) => 16 + (k / LOAD_MAX) * (W - 22);
          const etaMin = 0.975;
          const Y = (e) => 78 - clamp01((e - etaMin) / (1 - etaMin)) * 70;
          let p = '';
          for (let k = 0.02; k <= LOAD_MAX + 1e-6; k += 0.02) p += `${p ? 'L' : 'M'}${X(k).toFixed(1)} ${Y(efficiency(sp, k, s.pf)).toFixed(1)}`;
          let h = '';
          for (const e of [0.98, 0.99, 1]) h += `<line x1="${X(0)}" x2="${X(LOAD_MAX)}" y1="${Y(e)}" y2="${Y(e)}" stroke="${C.line}" stroke-width=".7"/><text x="12" y="${Y(e) + 2}" font-size="6.2" text-anchor="end" fill="${C.mute}">${Math.round(e * 100)}</text>`;
          h += `<path d="${p}" fill="none" stroke="${C.ink}" stroke-width="1.3"/>`;
          const kOpt = Math.sqrt(sp.p0 / sp.pk);
          h += `<line x1="${X(kOpt)}" x2="${X(kOpt)}" y1="${Y(1)}" y2="${Y(etaMin)}" stroke="${C.faint}" stroke-dasharray="2 2"/><text x="${X(kOpt) + 3}" y="${Y(etaMin) - 3}" font-size="6" fill="${C.mute}">MAX η AT ${Math.round(kOpt * 100)} % (P0 = Pk K²)</text>`;
          h += `<circle cx="${X(Math.min(LOAD_MAX, s.K)).toFixed(1)}" cy="${Y(s.eta).toFixed(1)}" r="3" fill="${C.red}"/>`;
          for (const k of [0, 0.5, 1, 1.5]) h += `<text x="${X(k)}" y="91" font-size="6.2" text-anchor="middle" fill="${C.mute}">${k * 100} %</text>`;
          eff.innerHTML = h;
        }
        lvRows.innerHTML = [
          ['LV line voltage', `<span style="color:${Math.abs(s.ulv - 400) > 20 ? C.red : C.ink}">${s.ulv.toFixed(1)} V</span>`],
          ['Voltage drop at this load', `${s.reg.toFixed(2)} %`],
        ].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
      }
      if (s.tab === 'configure') {
        for (const k of OPTION_KEYS) {
          const on = s.cfgHi === k;
          rows[k].style.background = on ? 'rgba(214,24,43,.08)' : '';
          rows[k].querySelector('.v').innerHTML = `${optText(k, cfg[k])}<i>p.${OPTIONS[k].p}</i>`;
          rows[k].querySelector('.v').style.color = on ? C.red : C.ink;
        }
        cfgNotes.innerHTML = (s.notes?.length ? s.notes.map((n) => `<p style="color:${C.red}">⚑ ${n.why} <span class="m">(p.${n.p})</span></p>`).join('') : '') + `<p class="m">Rules applied from the manual: natural ester only hermetic (p.17); ECOTAP 400–1000 kVA, hermetic, single HV (p.18–19); full protection hermetic, Buchholz with conservator (p.38–39); quake anchoring only with the integrated pan (p.35).</p>`;
      }
      if (s.tab === 'datasheet') once('ds', JSON.stringify(cfg) + s.seismicKey, () => (dsBox.innerHTML = datasheetHTML(s)));
      if (s.tab === 'protect' && s.prot) renderProtect(s, {prChip, devBox, fuseSvg, fuseLeg, fuseChk, logBox});
      for (const f of FAULTS) setBtn('f_' + f.key, !!s.faults?.[f.key], true);
      if (s.tab === 'service') once('sv', `${cfg.design}|${cfg.monitor}|${(s.buchholz ?? 0).toFixed(2)}|${s.prot?.contacts?.buchAlarm}|${s.prot?.contacts?.buchTrip}`, () => (svBox.innerHTML = serviceHTML(s)));

      // ---------------------------------------------------------------- toggles
      for (const k of CAMS) setBtn(k, s.cam === k);
      for (const k of CUTS) setBtn(k, s.cut === k);
      for (const k of VIEWS) setBtn(k, s.view === k);
      for (const k of OVERLAYS) setBtn(k, !!s.overlays[k], true);

      // ---------------------------------------------------------------- tap changer strip
      once('tap', `${sp.positions}|${s.tap}|${s.ulv.toFixed(0)}|${sp.oltc}|${s.ug.toFixed(3)}`, () => {
        tapN = sp.positions;
        tapHead.innerHTML = sp.oltc
          ? `<span style="color:${C.ink}">${ECOTAP.name}</span> &nbsp;— &nbsp;ON-LOAD, ${ECOTAP.positions} POSITIONS, AUTOMATIC`
          : `<span style="color:${C.ink}">TAP CHANGER</span> &nbsp;— &nbsp;DE-ENERGISED ONLY · CLICK TO SET`;
        let h = '';
        for (let p = 1; p <= sp.positions; p++) {
          const [x] = tapSpot(p - 1);
          const lx = x - 560;
          const pct = (((sp.positions + 1) / 2 - p) * LIMITS.tapStep);
          if (p > 1) h += `<line x1="${lx - (sp.positions > 5 ? 32 : 44)}" x2="${lx - 12}" y1="17" y2="17" stroke="${C.faint}"/>`;
          const on = p === s.tap;
          h += `<circle cx="${lx}" cy="17" r="11.5" fill="${on ? C.red : '#fff'}" stroke="${on ? C.red : C.faint}" stroke-width="${on ? 1.8 : 1}"/>`;
          h += `<text x="${lx}" y="20.5" font-size="10" text-anchor="middle" font-weight="600" fill="${on ? '#fff' : C.ink}">${p}</text>`;
          h += `<text x="${lx}" y="${p % 2 ? 0 : 0}" font-size="0"></text>`;
          void pct;
        }
        tapSvg.innerHTML = h;
        const pct = (((sp.positions + 1) / 2 - s.tap) * LIMITS.tapStep);
        tapFoot.innerHTML = `POSITION ${s.tap}: HV TURNS ${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)} % &nbsp;·&nbsp; GRID ${(s.ug * sp.un1).toFixed(2)} KV → LV <span style="color:${Math.abs(s.ulv - 400) > 20 ? C.red : C.ink}">${s.ulv.toFixed(0)} V</span>`;
      });

      // ---------------------------------------------------------------- the part card
      once('card', `${s.card?.title}|${s.card?.text}`, () => {
        card.style.display = s.card ? '' : 'none';
        card.innerHTML = s.card
          ? `<div class="cp" style="font-weight:700;color:${C.red}">${s.card.title}</div><div style="font-size:10.6px;line-height:14px;color:#3b3f45;margin-top:4px;white-space:normal">${s.card.text}</div>`
          : '';
      });
      notesBox.innerHTML = s.flash ?? '';

      // ---------------------------------------------------------------- callouts and part numbers
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${lx.toFixed(1)},${(ly + 16).toFixed(1)} ${(lx + c.w).toFixed(1)},${(ly + 16).toFixed(1)}" fill="none" stroke="${C.mute}" stroke-width=".8" opacity="${c.o.toFixed(2)}"/>`;
        if (c.name) ch += `<div class="call" style="left:${lx.toFixed(1)}px;top:${(ly - 10).toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      PARTS.forEach((p, i) => {
        const at = s.parts?.[i];
        const n = nums[i];
        if (!at || s.partsO < 0.02 || at[1] > 780 || at[0] < 300 || at[0] > 1290) {
          n.style.display = 'none';
          return;
        }
        n.style.display = 'flex';
        n.style.left = `${at[0].toFixed(1)}px`;
        n.style.top = `${at[1].toFixed(1)}px`;
        n.style.opacity = s.partsO.toFixed(2);
        n.classList.toggle('on', s.partSel === p.n);
      });
      pointer(s.cursor);
    },
  };
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function datasheetHTML(s) {
  const sp = s.sp;
  const cfg = sp.cfg;
  const E = (v) => `<b class="e">${v} <span style="font-size:7.5px">est.</span></b>`;
  const B = (v) => `<b>${v}</b>`;
  const row = (a, b) => `<div><span>${a}</span>${b}</div>`;
  const h = (t) => `<h4>${t}</h4>`;
  const q = s.seismic;
  const par = s.parallel;
  const pan = cfg.pan === 'standard' || cfg.pan === 'easy' ? sp.panCode(cfg.pan) : cfg.pan === 'integrated' ? '≥ 150 mm round the tank' : '—';
  const ut = sp.ut1 ? `${sp.ut1[0]} m / ${sp.ut1[1]} m` : '—';
  const out = [
    h('RATING · EN 60076 · EU 548/2014'),
    row('Power · cooling', B(`${sp.S} kVA · 50 Hz · ONAN`)),
    row('HV · Um · LV', B(`${cfg.hv} kV · ${sp.cls.um} kV · 400 V`)),
    row('Rated current HV / LV', B(`${sp.i1.toFixed(1)} A / ${fx(sp.i2)} A`)),
    row('Short-circuit voltage uk', sp.ukP ? B(`${sp.uk} % (p.50)`) : E(`${sp.uk} %`)),
    row('Sustained short-circuit LV', B(`${(sp.isc2 / 1000).toFixed(1)} kA`)),
    row('P0 / Pk', sp.S === 630 && !sp.amorph ? B(`${sp.p0} (p.21) / ${fx(sp.pk)} W`) : sp.S === 630 ? B(`${sp.p0} (p.21) / ${fx(sp.pk)} W`) : E(`${sp.p0} / ${fx(sp.pk)} W`)),
    row('Rises copper / top oil', B('65 K / 60 K (p.12)')),
    row('BIL HV', B(cfg.screen ? '125 kV · screened, +30 % layers' : '125 kV (170 kV option, p.54)')),
    h('BUILD'),
    row('Tank L × B × H', E(`${sp.tank.l} × ${sp.tank.b} × ${sp.tank.h} mm`)),
    row(sp.herm ? 'Waves (deeper, hermetic)' : 'Waves depth · pitch', E(`${sp.finDepth} · ${sp.tank.finPitch} mm`)),
    row('Fluid', B(`${FLUIDS[cfg.fluid].short} · fire ${FLUIDS[cfg.fluid].fire} °C`)),
    row('Fluid volume / mass', E(`${sp.oilL} l / ${sp.oilKg} kg`)),
    row('Total mass', E(`${fx(sp.mass)} kg`)),
    row('LV bushings · stud torque', B(`${sp.lvCount} × ${sp.lvBushA} A · ${sp.lvTorque.thread} ${sp.lvTorque.nm} Nm`)),
    row('Track gauge · rollers', B(`${sp.chassis.gauge} mm · Ø${sp.chassis.wheel.d} × ${sp.chassis.wheel.w}`)),
    h('PROTECTION · p.49–50'),
    row('HV HRC fuse', sp.fuseHV.rule ? E(`${sp.fuseHV.a} A (≈ 2 In rule)`) : B(`${sp.fuseHV.a} A`)),
    row('LV NH fuse gTr / gG', sp.fuseLV.rule ? E(`${sp.fuseLV.a} A`) : B(`${sp.fuseLV.a} A`)),
    row('Inrush (100 ms)', B('6–20 × In')),
    row('Thermometer alarm / trip', B('85 / 95 °C')),
    h('INSTALLATION · p.24, 32, 40, 44'),
    row('Oil pan', B(pan)),
    row('Ventilation A = 0.188 P / √H', B(`${sp.vent.area.toFixed(2)} m² (H ${sp.vent.h} m)`)),
    row('Clearance wall / units', B('300 / 500 mm')),
    row('Lashing eye h / 45° / v', B(`${sp.lash.h} / ${sp.lash.d45} / ${sp.lash.v} kg`)),
    row('1 µT line height / side', sp.ut1 ? B(`${ut} (low-rad.)`) : B(`${UT1_STANDARD[sp.S] ? UT1_STANDARD[sp.S] + ' m (standard)' : '—'}`)),
    row(`Seismic ${s.seismicKey} · s = hc/ac`, E(`s ${q.s.toFixed(2)} · Se ${q.Se.toFixed(1)} m/s²`)),
    row('Roller forces FD / FA / FQ', E(`${q.FD.toFixed(1)} / ${q.FA.toFixed(1)} / ${q.FQ.toFixed(1)} kN`)),
    `<div style="white-space:normal;color:${q.lift || q.reinforced ? C.red : C.ink};font-weight:600">${q.verdict}</div>`,
    par ? row(`Parallel ${par.S1} + ${par.S2} kVA`, B(`${par.ok ? '' : '⚑ '}max ${fx(par.Smax)} kVA`)) : '',
  ];
  return out.join('');
}

function serviceHTML(s) {
  const cfg = s.sp.cfg;
  const P = (t) => `<p>${t}</p>`;
  const h = (t) => `<h4>${t}</h4>`;
  const b = s.buchholz ?? 0;
  const k = BUCHHOLZ.contacts(b);
  const herm = cfg.design === 'hermetic';
  return [
    h('5 SAFETY RULES · p.8'),
    P(SAFETY_RULES.map((r, i) => `${i + 1}. ${r}`).join(' · ')),
    h('COMMISSIONING · p.41–51'),
    P(herm ? 'Hermetic: under pressure — open nothing, keep the lacquered bolts.' : 'Remove the transport plugs from vent and filler.'),
    P('Oil level at the filler or conservator: the mark is 20 °C, 1 cm ≈ 10 K.'),
    P('Drain tight · earthing resistance · phase sequence · all terminal bolts.'),
    P('Tap changer de-energised to position 1–5; level I/II on switchable units.'),
    P('Contact thermometer alarm 85 °C, trip 95 °C · then energise HV (no-load), check phases, connect LV.'),
    h('PARALLEL · p.47'),
    P('Same vector-group index, ratio within 0.5 %, uk within ±10 %, power ratio ≤ 3:1, same phase sequence.'),
    h('MAINTENANCE · p.57–58'),
    ...MAINT.map((m) => P(`<b>${m.every}</b> <span class="m">· ${m.who}</span> — ${m.what}`)),
    h('BUCHHOLZ RELAY · TERMINALS · p.43'),
    buchholzSVG(s),
    P(cfg.monitor === 'buchholz'
      ? `Test button ${Math.round(b * 100)} %: 3–6 <b>${k.c36 ? 'closed' : 'open'}</b> · 3–4 <b style="color:${k.c34 ? C.red : C.ink}">${k.c34 ? 'closed (alarm)' : 'open'}</b> · 1–5 <b>${k.c15 ? 'closed' : 'open'}</b> · 1–2 <b style="color:${k.c12 ? C.red : C.ink}">${k.c12 ? 'closed (trip)' : 'open'}</b>`
      : `<span class="m">Fitted only with the conservator (MONITORING: BUCHHOLZ). Diagram as on the relay's plate in the manual.</span>`),
  ].join('');
}

// the Buchholz relay's wiring plate as the manual shows it (p.43): insulators 6 3 4 (ALARM) and 5 1 2 (TRIP); the
// common 3 rests on 6 and moves to 4 on gas, the common 1 rests on 5 and moves to 2 on a surge or the full test press
function buchholzSVG(s) {
  const k = BUCHHOLZ.contacts(s.buchholz ?? 0);
  const fitted = s.sp.cfg.monitor === 'buchholz';
  const al = (fitted && k.c34) || !!s.prot?.contacts?.buchAlarm;
  const tr = (fitted && k.c12) || !!s.prot?.contacts?.buchTrip;
  const W = 224;
  const cell = W / 6;
  let h = `<svg width="${W}" height="112" style="display:block;margin:2px 0 4px">`;
  h += `<rect x=".5" y=".5" width="${W - 1}" height="111" fill="#fff" stroke="${C.faint}"/>`;
  h += `<line x1="${W / 2}" x2="${W / 2}" y1="0" y2="112" stroke="${C.faint}"/><line x1="0" x2="${W}" y1="18" y2="18" stroke="${C.faint}"/><line x1="0" x2="${W}" y1="94" y2="94" stroke="${C.faint}"/>`;
  const nums = [6, 3, 4, 5, 1, 2];
  nums.forEach((n, i) => {
    const x = cell * i + cell / 2;
    h += `<text x="${x}" y="13" font-size="9" font-weight="700" text-anchor="middle" fill="${C.ink}">${n}</text>`;
    if (i) h += `<line x1="${cell * i}" x2="${cell * i}" y1="0" y2="18" stroke="${C.line}"/>`;
  });
  // each group: left NC terminal, the common in the middle with its blade, right NO terminal
  const group = (i0, on, name) => {
    const xL = cell * i0 + cell / 2;
    const xC = xL + cell;
    const xR = xC + cell;
    const yT = 34;
    const yC = 78;
    let g = '';
    for (const x of [xL, xR]) g += `<line x1="${x}" x2="${x}" y1="18" y2="${yT}" stroke="${C.ink}" stroke-width="1"/><circle cx="${x}" cy="${yT + 3}" r="2.6" fill="#fff" stroke="${C.ink}"/>`;
    g += `<line x1="${xC}" x2="${xC}" y1="18" y2="24" stroke="${C.ink}"/><line x1="${xC}" x2="${xC}" y1="${yC}" y2="${yC + 6}" stroke="${C.ink}"/><circle cx="${xC}" cy="${yC}" r="2.6" fill="${C.ink}"/>`;
    const tx = on ? xR : xL;
    g += `<line x1="${xC}" y1="${yC}" x2="${tx}" y2="${yT + 6}" stroke="${on ? C.red : C.ink}" stroke-width="1.8"/>`;
    g += `<text x="${xC}" y="105" font-size="7.4" letter-spacing="1.2" text-anchor="middle" fill="${on ? C.red : C.mute}" font-weight="600">${name}${on ? ' · ACTIVE' : ''}</text>`;
    return g;
  };
  h += group(0, al, 'ALARM') + group(3, tr, 'TRIP');
  h += `<text x="4" y="90" font-size="6.2" fill="${C.mute}">NC 3–6 · NO 3–4</text><text x="${W / 2 + 4}" y="90" font-size="6.2" fill="${C.mute}">NC 1–5 · NO 1–2</text>`;
  return h + '</svg>';
}

const chip = (on, label, kind = 'alarm') => `<span style="display:inline-block;padding:0 4px;margin-left:3px;font-size:7.2px;font-weight:700;letter-spacing:.6px;border:1px solid ${on ? (kind === 'trip' ? C.red : C.orange) : C.line};background:${on ? (kind === 'trip' ? C.red : C.orange) : '#fff'};color:${on ? '#fff' : C.mute}">${label}</span>`;
function renderProtect(s, el2) {
  const sp = s.sp;
  const pr = s.prot;
  const f = fitted(sp.cfg);
  const c = pr.contacts;
  const st = statusOf(pr);
  el2.prChip.textContent = st;
  el2.prChip.style.background = st === 'TRIPPED' ? C.red : st === 'ALARM' ? C.orange : C.ink;
  const top = s.thermal.top;
  const e = pt100Err();
  const est = (t) => `<span style="color:${C.est}">${t}</span>`;
  const dev = (on, name, sub, val, chips = '') =>
    `<div style="height:26px;border-bottom:1px solid ${C.line};display:flex;justify-content:space-between;align-items:center;opacity:${on ? 1 : 0.42}"><div style="min-width:0"><div style="font-size:9px;font-weight:700;white-space:nowrap">${name}</div><div style="font-size:7.4px;color:${C.mute};white-space:nowrap;overflow:hidden">${sub}</div></div><div style="text-align:right;white-space:nowrap;font-size:9px;font-weight:600">${on ? val : '<span style="color:#a3a7ad;font-weight:500">not fitted</span>'}<div>${on ? chips : ''}</div></div></div>`;
  const lvl = sp.cfg.design === 'breathing' ? `${pr.levelCm >= 0 ? '+' : '−'}${Math.abs(pr.levelCm ?? 0).toFixed(1)} cm` : sp.cfg.design === 'conservator' ? `${Math.round((pr.consFrac ?? 0.5) * 100)} % cons.` : `${(pr.press ?? 0) >= 0 ? '+' : '−'}${Math.abs(pr.press ?? 0).toFixed(2)} bar`;
  const rows = [
    dev(true, 'Dial thermometer', f.contacts ? 'DRAG POINTER · CONTACTS 250 V · p.38, 41' : 'DRAG POINTER · NO CONTACTS · p.38', `${Math.round(top)} °C · max ${Math.round(s.thermal.max)}`, f.contacts ? chip(c.thAlarm, 'AL 85') + chip(c.thTrip, 'TR 95', 'trip') : ''),
    dev(f.pt100, 'PT100 resistance thermometer', `IEC 60751 · 2-WIRE ${est('+' + e.w2.toFixed(1) + ' K')} · 3/4-WIRE ≈ 0 · p.38`, `${pt100R(top).toFixed(2)} Ω`),
    dev(f.level || f.dipstick, f.level ? (f.reed ? 'Level indicator, float + reed' : 'Conservator level gauge') : 'Dipstick (manual check)', `MIN → OUT OF SERVICE · 1 cm ≈ 10 K · p.37–38 ${est('MIN est.')}`, lvl, f.reed || f.level ? chip(c.levelMin || c.consMin, 'MIN') : ''),
    dev(f.dgpt, 'Full protection (hermetic)', `T · LEVEL · PRESSURE · GAS · p.38 ${est(`set est. ${SET.dgptPressTrip.v} bar / ${SET.dgptGasAlarm.v} ml`)}`, `${(pr.press ?? 0).toFixed(2)} bar · ${Math.round(pr.gasDgpt)} ml`, chip(c.dgptGas, 'GAS') + chip(c.dgptLevel, 'LVL') + chip(c.dgptPress, 'P', 'trip') + chip(c.thTrip, 'T', 'trip')),
    dev(f.prv, 'Pressure relief valve', `HERMETIC OPTION · p.12 ${est(`opens ${SET.prvOpen.v} bar est.`)}`, pr.prvOpen > 0.05 ? '<span style="color:#d6182b">OPEN</span>' : 'closed'),
    dev(f.buchholz, 'Buchholz relay', `GAS ${est(SET.buchholzGasAlarm.v + ' ml')} · SURGE ${est(SET.buchholzSurgeTrip.v + ' m/s')} · p.39, 43`, `${Math.round(pr.gasBuch)} ml · ${pr.surge.toFixed(1)} m/s`, chip(c.buchAlarm, '3–4') + chip(c.buchTrip, '1–2', 'trip')),
    dev(f.breather, 'Silica-gel breather', `LIGHT YELLOW → DRY OR REPLACE · p.39`, `${Math.round(pr.sat * 100)} % ${est('est.')}`, chip(pr.sat > 0.85, 'YELLOW')),
    dev(true, `HV HRC fuse ${s.coord.hvIn} A`, `IN THE STATION · ≈ 2 In · p.49–50`, pr.fuseBlown ? '<span style="color:#d6182b">BLOWN</span>' : 'intact'),
    dev(true, `LV NH fuse ${s.coord.lvIn} A gTr / gG`, `OUTGOING SIDE · p.50`, 'intact'),
  ];
  el2.devBox.innerHTML = rows.join('');
  // the fuse chart: time over current on the HV side, log-log
  const co = s.coord;
  const W = 232;
  const H = 150;
  const x0 = 22;
  const x1 = W - 4;
  const y0 = 16;
  const y1 = H - 14;
  const iMin = Math.max(0.5, sp.i1 / 3);
  const iMax = Math.max(co.iScHV * 3, co.inrush[1] * 2);
  const X = (i) => x0 + ((Math.log10(i) - Math.log10(iMin)) / (Math.log10(iMax) - Math.log10(iMin))) * (x1 - x0);
  const Y = (t) => y0 + ((3 - Math.log10(Math.min(1000, Math.max(0.01, t)))) / 5) * (y1 - y0);
  let h = '';
  for (const t of [1000, 100, 10, 1, 0.1, 0.01]) h += `<line x1="${x0}" x2="${x1}" y1="${Y(t)}" y2="${Y(t)}" stroke="${C.line}" stroke-width=".6"/><text x="${x0 - 2}" y="${Y(t) + 2}" font-size="6" text-anchor="end" fill="${C.mute}">${t >= 1 ? t : t}</text>`;
  for (let d = Math.ceil(Math.log10(iMin)); d <= Math.log10(iMax); d++) h += `<line x1="${X(10 ** d)}" x2="${X(10 ** d)}" y1="${y0}" y2="${y1}" stroke="${C.line}" stroke-width=".6"/><text x="${X(10 ** d)}" y="${y1 + 9}" font-size="6" text-anchor="middle" fill="${C.mute}">${10 ** d} A</text>`;
  const curve = (kind, In, scale, col) => {
    let d = '';
    for (const [m, t] of FUSE_CURVE[kind]) {
      const i = m * In * scale;
      if (i < iMin || i > iMax) continue;
      d += `${d ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(t).toFixed(1)}`;
    }
    return `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.4"/>`;
  };
  h += curve('lv', co.lvIn, co.ratio, C.blue) + curve('hv', co.hvIn, 1, C.ink);
  // the transformer: rated current, 150 % overload, the inrush band at 0.1 s, the LV short circuit seen on the HV side
  h += `<line x1="${X(sp.i1)}" x2="${X(sp.i1)}" y1="${y0}" y2="${y1}" stroke="${C.faint}" stroke-dasharray="2 2"/><text x="${X(sp.i1) + 2}" y="${y0 + 7}" font-size="6" fill="${C.mute}">In</text>`;
  h += `<rect x="${X(co.inrush[0])}" y="${Y(0.1) - 2.5}" width="${X(co.inrush[1]) - X(co.inrush[0])}" height="5" fill="${co.inrushOk ? 'rgba(240,90,35,.45)' : C.red}"/><text x="${X(co.inrush[0]) - 3}" y="${Y(0.1) + 2}" font-size="6" text-anchor="end" fill="${C.orange}">INRUSH</text>`;
  h += `<circle cx="${X(co.iScHV)}" cy="${Y(co.tSc)}" r="3" fill="${C.red}"/><text x="${X(co.iScHV) + 5}" y="${Y(co.tSc) - 5}" font-size="6" text-anchor="start" fill="${C.red}">LV SHORT</text>`;
  const kNow = s.K * sp.i1;
  if (kNow > iMin) h += `<line x1="${X(kNow)}" x2="${X(kNow)}" y1="${y0}" y2="${y1}" stroke="${C.red}" stroke-width=".8"/>`;
  el2.fuseSvg.innerHTML = h;
  el2.fuseLeg.innerHTML = `<span style="color:${C.ink}">—</span> HV ${co.hvIn} A &nbsp;<span style="color:${C.blue}">—</span> LV ${co.lvIn} A ON HV SIDE`;
  const ok = (b) => (b ? '<b style="color:#2f8f5b">✓</b>' : '<b style="color:#d6182b">✗</b>');
  el2.fuseChk.innerHTML = [
    `<div><span>Inrush passes (fuse ${co.tInrush.toFixed(2)} s at 20 In &gt; 0.1 s)</span>${ok(co.inrushOk)}</div>`,
    `<div><span>Clears LV short in ${co.tSc < 1 ? (co.tSc * 1000).toFixed(0) + ' ms' : co.tSc.toFixed(1) + ' s'} · LV fuse first</span>${ok(co.scOk && co.selective)}</div>`,
    `<div><span style="color:${C.est}">Curve shapes generic (est.) — use the fuse maker's</span><b></b></div>`,
  ].join('');
  const col = {trip: C.red, alarm: C.orange, info: C.mute};
  const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  el2.logBox.innerHTML = pr.events.slice(-5).reverse().map((e) => `<p style="color:${col[e.kind]};margin:0 0 1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${hm(e.min)} · ${e.text}</p>`).join('') || `<p class="m">No events. Inject a fault above; raise TIME-LAPSE for the slow ones.</p>`;
}
void fuseTime;
void coordination;
