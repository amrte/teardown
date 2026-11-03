// Acceptance checks for the FX-1 model (brief §8). node sims/printer-shared/check.mjs
import {AX, FAULTS, P, runModel, TMC} from './model.js';

let fail = 0;
const ok = (c, m) => {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`);
  if (!c) fail++;
};
console.log('steps/mm', P.steps, 'heater W', P.heaterW.toFixed(1), 'TMC', TMC.irun, TMC.ihold, TMC.vsense, TMC.iRms.toFixed(3), TMC.regs.map((r) => r[0] + '=' + r[2]).join(' '));
ok(P.steps.x === 80 && P.steps.y === 80 && P.steps.z === 400, 'X/Y 80 steps/mm, Z 400 steps/mm');
ok(Math.abs(P.steps.e - 415.2) < 0.1, `E ${P.steps.e.toFixed(2)} steps/mm`);
const t0 = performance.now();
const M = runModel('none');
console.log('model ms', (performance.now() - t0).toFixed(0), 'end', M.end.toFixed(2), 'ev', JSON.stringify(M.ev, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
console.log('blocks', M.live.length, 'bead', M.bead.length, 'serial', M.serial.length, 'starved', M.live.filter((b) => b.starved).length);
// 1. positions equal step counts / steps per mm (nominal: no lost steps; resonance only on the nozzle)
for (const t of [M.ev.homeDone - 0.5, M.ev.layers[1] + 0.73, M.ev.printEnd - 0.31]) {
  const good = AX.every((a) => Math.abs(M.cmdPhys(t, a) - (M.stepsAt(t, a) / P.steps[a] + M.offAt(t, a))) < 1e-9);
  ok(good, `t=${t.toFixed(2)} carriage = steps/spm (+ home offset ${['x', 'y', 'z'].map((a) => M.offAt(t, a).toFixed(4)).join(',')})`);
}
ok(Math.abs(M.offAt(M.end, 'x')) < 1 / 80 && Math.abs(M.offAt(M.end, 'z')) < 1 / 400, 'after homing the offset is under one step');
// 2. analyzer step count == Δposition × spm
for (const a of ['x', 'y', 'e']) {
  const ta = M.ev.layers[1] + 0.2;
  const tb = ta + 1.7;
  const edges = M.stepEdges(a, ta, tb, 1e9);
  // count signed: edges between ta and tb all with the block direction
  let signed = 0;
  for (const e of edges) signed += M.dirAt(e, a);
  const d = M.stepsAt(tb, a) - M.stepsAt(ta, a);
  ok(signed === d, `${a}: analyzer ${signed} edges = Δsteps ${d}`);
}
// 3. coil currents follow the microstep counter
{
  const t = M.ev.layers[1] + 0.5;
  const dr = M.driverAt(t, 'x');
  ok(Math.abs(Math.hypot(dr.iA, dr.iB) - TMC.iPeak) < 1e-9 && dr.mscnt === (((M.stepsAt(t, 'x') * 16) % 1024) + 1024) % 1024, `driver X mscnt ${dr.mscnt} |I| ${Math.hypot(dr.iA, dr.iB).toFixed(3)} A`);
}
// 4. bead only during extrusion
{
  let bad = 0;
  for (const p of M.bead) {
    const b = M.blockAt(p.t);
    if (!b || (!b.extruding && !(Math.abs(p.t - b.tStart) < 1e-9))) bad++;
  }
  ok(bad === 0, `bead points outside extruding blocks: ${bad}`);
}
// 5. 90° corner speed
{
  const b = M.live.find((x) => x.i === M.ev.follow);
  console.log('follow block', b.line, M.lines[b.line - 1].raw, 'entry', b.vEntry.toFixed(2), 'nom', b.vNom.toFixed(1), 'exit', b.vExit.toFixed(2), 'peak', b.vPeak.toFixed(1), 'dur', b.dur.toFixed(3), 'theta', b.theta?.toFixed(1));
  ok(Math.abs(b.vExit - 9.7) < 0.2, `90° corner exit ${b.vExit.toFixed(2)} mm/s ≈ 9.7`);
}
// 6. faults
for (const f of FAULTS.slice(1)) {
  const t1 = performance.now();
  const F = runModel(f);
  const th = F.killed ? F.thAt(F.killed.t) : null;
  console.log(f, 'ms', (performance.now() - t1).toFixed(0), 'kill', F.killed ? `${F.killed.why} @${F.killed.t.toFixed(2)} faultAt ${F.ev.faultAt?.toFixed?.(2)} realT ${th.T.toFixed(1)} sensed ${th.Ts.toFixed(1)} duty ${th.duty}` : 'none', 'end', F.end.toFixed(1));
  if (f === 'unplug') ok(F.killed?.why === 'MINTEMP' && F.killed.t - F.ev.faultAt <= P.pid.dt + 1e-6 && F.thAt(F.killed.t + 1).duty === 0, 'unplugged thermistor → MINTEMP within one PID tick, heater off');
  if (f === 'loose') ok(F.killed?.why === 'THERMAL RUNAWAY' && Math.abs(F.killed.t - F.ev.faultAt - 40) < 6, `loose thermistor → runaway ${(F.killed?.t - F.ev.faultAt).toFixed(1)} s after it came loose`);
  if (f === 'skip') {
    const t = F.ev.printEnd - 0.1;
    ok(Math.abs(F.cmdPhys(t, 'x') - F.stepsAt(t, 'x') / 80 - F.offAt(t, 'x') + 3.2) < 1e-9, 'skipped steps: carriage 3.2 mm off the count');
  }
  if (f === 'accel') {
    // the corners are taken twice as fast and the bead rings harder: Δv/ω at each corner and a/ω² on each ramp
    const pk = (MM) => Math.max(...MM.bead.map((p) => Math.hypot(MM.deflAt(p.t, 'x'), MM.deflAt(p.t, 'y'))));
    const cj = (MM) => MM.live.find((b) => b.extruding && Math.abs(b.theta - 90) < 1).vEntry;
    ok(cj(F) > 1.9 * cj(M) && pk(F) > 1.4 * pk(M), `ringing grows: 90° corner ${cj(M).toFixed(1)} → ${cj(F).toFixed(1)} mm/s, peak deflection ${pk(M).toFixed(3)} → ${pk(F).toFixed(3)} mm`);
  }
}
console.log(fail ? `${fail} FAILED` : 'all passed');
process.exit(fail ? 1 : 0);
