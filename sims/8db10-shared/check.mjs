// Hand checks for gis.js: the catalog's numbers add up, every fault clears inside the catalog's times, the film's
// switching programs never break an interlock.   node sims/8db10-shared/check.mjs
import {allowed, CB, faultEvents, G, gasAt, GAS, iFault, INITIAL, plan, R, stateAt, worstInception} from './gis.js';

let fails = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!cond) fails++;
};
const mm = (m) => Math.round(m * 1000);

// 1. the side view adds up: 275 + 5 x 360 + 590 = 2665
ok(mm(G.poleZ[0] - G.rearZ) === 2075 && mm(G.frontZ - G.poleZ[0]) === 590 && mm(G.D) === 2665, `depth 275 + 5×360 + ${mm(G.frontZ - G.poleZ[0])} = ${mm(G.frontZ - G.rearZ)} mm`);
ok(mm(G.poleZ[0] - G.poleZ[1]) === 720 && mm(G.poleZ[0] - G.bb2Z[0]) === 360, 'feeder poles 720 mm apart, busbar 2 housing 360 mm behind busbar 1');
ok(G.poleZ[0] + G.bbFlangeR < G.cubZ0, 'front busbar housing clears the operating cubicle');

// 2. every fault phase angle: arcing <= 15 ms, break time <= 80 ms, opening time < 65 ms, closing < 95 ms
let worstArc = 0;
let worstBreak = 0;
let peak = 0;
for (let deg = 0; deg < 360; deg += 2) {
  const tf = 1 + deg / 360 / R.f;
  const [f] = faultEvents(tf);
  const firstArc = f.sep;
  worstArc = Math.max(worstArc, f.ext - firstArc);
  worstBreak = Math.max(worstBreak, f.ext - f.trip);
  for (let x = tf; x < tf + 0.02; x += 2e-5) for (let p = 0; p < 3; p++) peak = Math.max(peak, Math.abs(iFault(x, p, tf)));
}
ok(worstArc <= 0.015, `arcing time ≤ 15 ms over all fault angles: worst ${(worstArc * 1000).toFixed(1)} ms`);
ok(worstBreak <= 0.08, `break time ≤ 80 ms: worst ${(worstBreak * 1000).toFixed(1)} ms`);
ok(CB.openT < 0.065 && CB.closeT < 0.095, `opening ${CB.openT * 1000} ms < 65, closing ${CB.closeT * 1000} ms < 95`);
ok(peak / 1000 <= 104 && peak / 1000 >= 95, `first peak of a 40 kA fault ${(peak / 1000).toFixed(1)} kA vs rated peak withstand ${R.ip}/104 kA`);

// 3. the worst-case inception gives L1 its full offset
{
  const tf = worstInception(2);
  let pk = 0;
  for (let x = tf; x < tf + 0.012; x += 1e-5) pk = Math.max(pk, Math.abs(iFault(x, 0, tf)));
  ok(pk > 95e3, `worst-case inception: L1 peaks at ${(pk / 1000).toFixed(1)} kA`);
}

// 4. gas
ok(Math.abs(gasAt(20) - GAS.rated) < 1e-9 && gasAt(-5) > GAS.low, `manometer ${gasAt(20).toFixed(0)} kPa at 20 °C, ${gasAt(-5).toFixed(0)} kPa at -5 °C (low alarm ${GAS.low})`);

// 5. the film's programs: bb1 -> bb2, a fault with auto-reclose, earth, back to bb1. Every event must be allowed
// the instant it fires, and each program must end where it says.
{
  const ev = [];
  const fire = (list) => {
    for (const e of list) {
      const s = stateAt(ev, e.at - 1e-6);
      const a = e.dev === 'fault' || e.cause ? {ok: true} : allowed(s, e.dev, e.to);
      if (!a.ok) ok(false, `event ${e.dev}→${e.to} at ${e.at.toFixed(2)} refused: ${a.reason}`);
      ev.push(e);
      ev.sort((x, y) => x.at - y.at);
    }
  };
  let tau = 1;
  const run = (target, label, want) => {
    const s = stateAt(ev, tau);
    const p = plan(s, target, tau);
    fire(p);
    tau = p[p.length - 1].at + 1;
    const e = stateAt(ev, tau);
    ok(e.node === want.node && e.cable === want.cable, `${label}: node ${e.node}, cable ${e.cable}`);
  };
  ok(stateAt(ev, 0.5).node === 'bb1' && stateAt(ev, 0.5).cable === 'live', 'start: feeder on busbar 1');
  run('bb2', 'transfer to busbar 2', {node: 'bb2', cable: 'live'});
  const tf = worstInception(tau + 0.3);
  const fe = faultEvents(tf);
  ok(allowed(stateAt(ev, tf), 'fault').ok, 'fault allowed on a live feeder');
  fire(fe);
  const f = fe[0];
  const mid = stateAt(ev, f.sep + 0.001);
  ok(mid.arc.some(Boolean) && !mid.touching, 'contacts apart, arc burning');
  const dead = stateAt(ev, f.ext + 0.1);
  ok(dead.cable === 'dead' && dead.i.every((x) => x === 0), 'dead time: no current');
  const back = stateAt(ev, fe[2].at + CB.closeT + 0.01);
  ok(back.cable === 'live' && back.touching && !back.faultOn, `auto-reclose after ${((fe[2].at + CB.closeT - f.ext) * 1000).toFixed(0)} ms: feeder back`);
  ok(back.spring < 0.01 && !allowed(back, 'q0', 'closed').ok, 'spring discharged after the reclose');
  tau = fe[2].at + 0.6;
  run('earth', 'earth the feeder', {node: 'earth', cable: 'earth'});
  run('bb1', 'back to busbar 1', {node: 'bb1', cable: 'live'});
}

// 6. the interlocks refuse what they must
{
  const s = stateAt([], 0);
  ok(!allowed(s, 'q1', 'open').ok, 'Q1 locked while the CB is closed');
  const ev = [{at: 0.1, dev: 'q0', to: 'open'}];
  const s2 = stateAt(ev, 1);
  ok(!allowed(s2, 'q1', 'earth').ok, 'Q1 cannot go CLOSED → READY-TO-EARTH directly');
  ok(!allowed(s2, 'q2', 'closed').ok, 'Q2 cannot close with Q1 closed');
  ok(allowed(s2, 'q1', 'open').ok, 'Q1 may open with the CB open');
  ok(!allowed(stateAt(ev, 0.1 + 0.02), 'q1', 'open').ok, 'nothing moves while the CB is moving');
}
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
process.exit(fails ? 1 : 0);
void INITIAL;
