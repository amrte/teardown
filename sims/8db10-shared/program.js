// The film's switching program, pure (no three.js, no DOM): the SCRIPT of operator moves in film seconds, and at load
// the procedure clock tau integrated over the film with the slow-motion and fast-forward rates, so tauAt(t) and the
// events are plain lookups. The film, the live page's auto tour and the node timing check all read this.
import {CB, faultEvents, plan, rateAt, stateAt, windows, worstInception} from './gis.js';

// the views, display toggles and switching programs, in film seconds
export const SCRIPT = [
  {t: 0, view: 'hero'},
  {t: 2.0, display: 'labels'},
  {t: 5.6, display: 'labels'},
  {t: 5.8, view: 'side'},
  {t: 6.6, display: 'section'},
  {t: 9.2, display: 'gas'},
  {t: 12.4, display: 'gas'},
  {t: 12.6, display: 'section'},
  {t: 12.8, view: 'disc'},
  {t: 13.2, display: 'xray'},
  {t: 14.2, prog: 'bb2'},
  {t: 22.6, view: 'cb'},
  {t: 23.4, prog: 'fault'},
  {t: 34.6, view: 'disc'},
  {t: 35.0, prog: 'earth'},
  {t: 44.6, display: 'xray'},
  {t: 44.8, view: 'hero'},
];
export const DURATION = 49;
export const FF = 4; // fast-forward while nothing moves (the spring recharging, the gaps between steps)
export const PROG_LABEL = {bb1: 'BUSBAR 1', bb2: 'BUSBAR 2', earth: 'EARTH', off: 'ISOLATE', fault: 'FAULT 40 kA'};

/** the events a program adds when it starts at tau from state s */
export const programEvents = (prog, s, tau) => {
  if (prog !== 'fault') return plan(s, prog, tau);
  // O - 0.3 s - CO needs the closing spring charged before the fault: wait for the motor
  const ready = s.springBusy ? tau + (1 - s.spring) * CB.charge + 0.1 : tau;
  return faultEvents(worstInception(Math.max(tau + 0.25, ready)));
};

// ------------------------------------------------------------ integrate tau over the film
const DT = 1 / 240;
const TAU = [0];
export const EVENTS = [];
let WIN = [];
{
  const progs = SCRIPT.filter((e) => e.prog);
  let tau = 0;
  let next = 0;
  for (let i = 1; i * DT <= DURATION + 1; i++) {
    const t = i * DT;
    while (next < progs.length && progs[next].t <= t) {
      const s = stateAt(EVENTS, tau);
      const ev = programEvents(progs[next].prog, s, tau);
      progs[next].tau = tau;
      progs[next].events = ev;
      EVENTS.push(...ev);
      EVENTS.sort((a, b) => a.at - b.at);
      WIN = windows(EVENTS);
      next++;
    }
    const s = stateAt(EVENTS, tau);
    const disc = s.q1.pos === 'moving' || s.q2.pos === 'moving';
    tau += DT * rateAt(WIN, tau, s.springBusy ? FF : 1, disc);
    TAU.push(tau);
  }
}
export const WINDOWS = WIN;
/** procedure time at film time t */
export const tauAt = (t) => {
  const u = Math.max(0, Math.min(TAU.length - 2, t / DT));
  const i = Math.floor(u);
  return TAU[i] + (TAU[i + 1] - TAU[i]) * (u - i);
};
/** film time at which tau is reached (for placing beats) */
export const filmAt = (tau) => {
  let lo = 0;
  let hi = TAU.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (TAU[m] < tau) lo = m;
    else hi = m;
  }
  return hi * DT;
};
export const progAt = (t) => SCRIPT.filter((e) => e.prog && e.t <= t).pop()?.prog ?? null;

/** a one-line description of what the panel is doing, for the procedure strip */
export function stepOf(s) {
  const f = s.fault;
  const ms = (x) => `${(x * 1000).toFixed(1)} ms`;
  if (f && s.tau >= f.at && s.tau < f.trip) return ['SHORT CIRCUIT', `40 kA FAULT · PROTECTION PICKS UP · ${ms(s.tau - f.at)}`];
  if (f && s.tau >= f.trip && s.tau < f.sep) return ['TRIP', `SHUNT RELEASE · CONTACTS STILL CLOSED · ${ms(s.tau - f.trip)}`];
  if (s.arc.some(Boolean)) return ['ARCING', `ARC IN VACUUM · CLEARS AT CURRENT ZERO · ${ms(s.tau - f.sep)}`];
  if (f && s.tau >= f.ext && s.tau < f.ext + CB.deadT && s.q0 === 'open') return ['DEAD TIME', `AUTO-RECLOSE IN ${Math.max(0, (f.ext + 0.3 - s.tau) * 1000).toFixed(0)} ms`];
  if (s.cbMoving) return s.q0 === 'closed' ? ['CB CLOSING', `CLOSING SPRING RELEASED · ${ms(s.tau - s.q0At)}`] : ['CB OPENING', `OPENING SPRING · ${ms(s.tau - s.q0At)}`];
  const dm = (q, n) => {
    const name = {closed: 'CLOSED', open: 'OPEN', earth: 'READY-TO-EARTH'};
    return [`${n} MOVING`, `${name[q.from]} → ${name[q.to]} · ${Math.round(q.k * 100)} %`];
  };
  if (s.q1.pos === 'moving') return dm(s.q1, 'Q1');
  if (s.q2.pos === 'moving') return dm(s.q2, 'Q2');
  const where = s.node === 'bb1' ? 'ON BUSBAR 1' : s.node === 'bb2' ? 'ON BUSBAR 2' : s.node === 'earth' ? 'READY-TO-EARTH' : 'ISOLATED';
  if (s.cable === 'earth') return ['FEEDER EARTHED', `EARTHED THROUGH THE CIRCUIT-BREAKER${s.springBusy ? ` · SPRING ${Math.round(s.spring * 100)} %` : ''}`];
  if (s.springBusy) return [`FEEDER ${where}`, `MOTOR CHARGING THE CLOSING SPRING · ${Math.round(s.spring * 100)} %`];
  if (s.cable === 'live') return [`FEEDER ${where}`, s.q0Cause === 'auto-reclose' ? 'AUTO-RECLOSE SUCCESSFUL · LOAD RESTORED' : 'IN SERVICE · LOAD CURRENT'];
  return [`FEEDER ${where}`, 'CIRCUIT-BREAKER OPEN'];
}

/** the state at film time t */
export const filmState = (t) => stateAt(EVENTS, tauAt(t));
