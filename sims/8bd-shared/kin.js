// The 8BD1 panel's numbers and its teardown procedure. No three.js in here.
//
// Source: Siemens operating instructions "Metal-enclosed truck-type switchboards 8BC1 and 8BD1 for operating voltages
// up to 24 kV", order no. SWF 5.2845.2/2005, issue 8.78 (163 pages, German/English). Every number below carries the
// manual page it comes from (section/page). Numbers the manual does not give are marked EST and were measured off
// the manual's own drawings and photos; they move parts, they never feed a readout as if they were rated data.
//
// One input drives everything: the procedure position p, in steps (0 = in service, STEPS.length = fully torn down).
// stateAt(p) returns every pose and readout; interlocks(state) evaluates the manual's 14 interlock conditions on it.

export const MANUAL = {title: 'Metal-enclosed truck-type switchboards 8BC1 and 8BD1, up to 24 kV', order: 'SWF 5.2845.2/2005', issue: '8.78'};

// ------------------------------------------------------------ dimensions (metres)
export const P = {
  width: 0.75, // panel width b, 200/3
  depth: 1.259, // panel depth a, 200/3
  track: 0.581, // truck wheel track s, 200/1
  armUp: [1.246, 1.046, 0.906], // upper contact arm heights L1 L2 L3 above the floor (left high to right low), 203/2 fig 1
  armLow: 0.665, // lower contact arm height "a", 12 kV 630-1600 A 3AF truck, 203/3 fig 2
  phaseX: [-0.2175, 0, 0.2175], // phase columns at 21 / 50 / 79 % of the partition width, EST from photo 102/4 fig 4
  body: 1.5, // HV body height: the arm heights above sit 0.18 / 0.30 / 0.39 of it below the roof, EST from 104/3 fig 6b
  lvH: 0.62, // LV compartment height (0.43 x body), EST from 104/3 fig 6b
  lvD: 0.52, // LV compartment depth (0.35-0.5 x depth), EST
  truckComp: 0.667, // truck compartment depth (0.53 x depth), EST from 104/3 fig 6b
  busFloor: 0.78, // horizontal partition 340 (busbar compartment about half the body height, 104/3 fig 6b), EST
  testTravel: 0.24, // service -> test position: arms clear the barrier boxes 360/316 and the shutters drop, EST
  outTravel: 1.06, // truck rolled completely out of the panel (300/14), EST: truck depth plus clearance
  aisle: 1.5, // operating aisle in front of the board, minimum, 200/3
  plateLift: 0.04, // front plate 613 lifted about 4 cm to take it off, 300/22
  shaftLift: 0.008, // front plate lift by shaft 51 leaving "interlocked" (111/14), EST
  viStroke: 0.011, // vacuum interrupter contact stroke, EST (the manual defers to the 3AF instructions)
};
P.zf = P.depth / 2; // front face of the panel
P.zp = P.zf - P.truckComp; // partitions 374 / 150 (truck compartment to the rear compartments)
P.zc = P.zp - 0.11; // fixed isolating contacts 430 / 300, inside the barrier boxes, EST
P.zBox = 0.13; // barrier box depth behind the partition, EST

export const RATING = [
  ['Panel', '8BD1 feeder panel no. 1 (103/1)'],
  ['Rated voltage', '12 kV, List 2 (100/2)'],
  ['Impulse withstand', '75 / 85 kV (100/3)'],
  ['Power frequency', '28 / 32 kV (100/3)'],
  ['Breaker', 'V breaker 3AF, vacuum (106/1)'],
  ['Rated current', '1250 A, in the 630-1600 A class of 12 kV 3AF trucks (203/3)'],
  ['Breaking current', '12.5 / 20 / 25 kA class (203/3)'],
  ['Finish', 'RAL 7032 pebble grey (101/3)'],
];

// ------------------------------------------------------------ the procedure
// Each step: what is done, where the manual says so, the camera view that shows it, its playback time (s), the
// channels it moves (each eased 0..1 across the step, or across [k0, k1] of it), and the parts it works on (the accent).
// Channels: brk (breaker closed), cspr / tspr (closing / tripping spring charged), lever (lever 47 in shaft 51),
// shaft (0 moving outside, 1 moving inside, 2 interlocked), travel (m out of service), plug (LV plug 0 in socket,
// 1 on the truck), det (voltage detector), earth (earthing switch), wheel (wheeling device), front (front plate off),
// mech (mechanism cover off), armsU / armsL (contact arms off), poles (poles out), partL / partU (partitions off),
// flaps (relief flaps off), bus (busbars out), ct (CT unit out), lv (LV door open).
const T = P.testTravel;
const O = P.outTravel;
export const STEPS = [
  {id: 'service', t: 'In service', ref: '101/3', view: 'hero', dur: 2.2,
    say: 'Truck in Service position, V breaker 3AF ON, feeder energised. The truck front plate 613 closes the panel; the run-in contacts sit on the fixed contacts behind the barrier boxes.',
    ch: {}, focus: ['613', '530']},
  {id: 'trip', t: 'Trip the breaker', ref: '300/6', view: 'front', dur: 2.0,
    say: 'Press the OFF push button 673 strongly until the ON/OFF indicator shows "O". Tripping is mechanical and always possible. The tripping spring and the 3 contact pressure springs open the vacuum interrupters.',
    ch: {brk: [0.25, 0.55, 0], tspr: [0.25, 0.55, 0]}, focus: ['673', '339.58', '339.30']},
  {id: 'lever', t: 'Lever to Moving inside', ref: '300/11', view: 'shaft', dur: 2.6,
    say: 'Insert locating lever 47 into locking shaft 51 and move it from "Breaker truck interlocked" to "Moving inside". The front plate lifts out of the eye hooks. With the breaker ON the lever would not move (condition 2).',
    ch: {lever: [0, 0.35, 1], shaft: [0.4, 0.85, 1]}, focus: ['47', '51', '613']},
  {id: 'test', t: 'Pull to Test position', ref: '300/12', view: 'side', dur: 3.2,
    say: 'Pull the lever out, grip the truck by both handles and draw it out to the stop. The contact arms 423 / 295 leave the barrier boxes 360 / 316 and their shutters drop shut and lock.',
    ch: {lever: [0, 0.2, 0], travel: [0.25, 1, T]}, focus: ['423', '295', '360', '316']},
  {id: 'locktest', t: 'Lock in Test position', ref: '300/12', view: 'shaft', dur: 2.2,
    say: 'Re-insert the lever, move it to "Breaker truck interlocked" and pull it out. The truck is locked in Test position; with the LV plug in, the breaker can be test-switched.',
    ch: {lever: [0, 0.3, 1], shaft: [0.35, 0.75, 2], lever_: [0.8, 1, 0]}, focus: ['47', '51', '50']},
  {id: 'unplug', t: 'Unplug the LV plug', ref: '300/13', view: 'plug', dur: 2.8,
    say: 'Press bracket 592.6 of socket 592 down, pull the LV plug 593 and lay it on top of the truck. The truck has not moved: this is the Isolated position.',
    ch: {plug: [0.2, 1, 1]}, focus: ['593', '592']},
  {id: 'discharge', t: 'Discharge the springs', ref: '400/5', view: 'front', dur: 2.8,
    say: 'Before any work on the truck: close the breaker (the closing spring discharges, the tripping spring charges), then trip it. All drive springs are now discharged. Closing is allowed: the truck is interlocked.',
    ch: {brk: [0.15, 0.35, 1], cspr: [0.15, 0.35, 0], tspr: [0.15, 0.35, 1], brk_: [0.6, 0.8, 0], tspr_: [0.6, 0.8, 0]}, focus: ['653', '673', '339.55']},
  {id: 'withdraw', t: 'Withdraw the truck', ref: '300/14', view: 'iso', dur: 3.4,
    say: 'Lever to "Moving outside", hold both handles and roll the truck completely out of the panel on its own rollers. Never steer it by the contact arms (201/3).',
    ch: {lever: [0, 0.15, 1], shaft: [0.15, 0.3, 0], lever_: [0.32, 0.42, 0], travel: [0.4, 1, O]}, focus: ['65', '133', '121']},
  {id: 'verify', t: 'Verify feeder is dead', ref: '300/18', view: 'boxes', dur: 3.4,
    say: 'Push the release device 361 into a lower barrier box 316 to the stop, insert the voltage detector 365 through it: it opens the shutter and meets the fixed contact. No glow on all 3 phases: dead. Do not leave 361 in the box.',
    ch: {det: [0, 1, 1]}, focus: ['361', '316', '300']},
  {id: 'isolate', t: 'Push in to Isolated', ref: '300/17', view: 'iso', dur: 3.0,
    say: 'With the breaker OFF and shaft 51 at "Moving outside", push the truck in to the stop and move the lever to "Breaker truck interlocked": Isolated position.',
    ch: {travel: [0, 0.7, T], lever: [0.7, 0.8, 1], shaft: [0.8, 0.92, 2], lever_: [0.94, 1, 0]}, focus: ['50', '51']},
  {id: 'earth', t: 'Close earthing switch', ref: '300/19', view: 'earth', dur: 3.0,
    say: 'Plug handle 75 onto the earthing switch drive shaft 248 at the lower right of the truck front and swing it about 90 deg to the right. The feeder cable is earthed; stop 130 turns horizontal and bars the Service position (condition 11).',
    ch: {earth: [0.2, 0.85, 1]}, focus: ['75', '248', '256', '130']},
  {id: 'out', t: 'Withdraw truck again', ref: '300/14', view: 'iso', dur: 3.0,
    say: 'With the earthing switch closed the truck can still be withdrawn (only Service is barred). Lever to "Moving outside", roll it out.',
    ch: {lever: [0, 0.15, 1], shaft: [0.15, 0.3, 0], lever_: [0.32, 0.42, 0], travel: [0.4, 1, O]}, focus: ['613', '121']},
  {id: 'wheel', t: 'Fit wheeling device', ref: '300/15', view: 'truck', dur: 3.0,
    say: 'Push support plate 41.27 of wheeling device 41 under the front plate and screw spindle 41.5 in: the truck now runs on its two rear rollers and swivel roller 41.23 and turns without effort to the workplace.',
    ch: {wheel: [0, 1, 1]}, focus: ['41']},
  {id: 'front', t: 'Take off front plate', ref: '300/22', view: 'truck', dur: 3.2,
    say: 'Undo the slotted screw next to the shaft label, grip both handles, lift the front plate 613 about 4 cm and pull it forward. Not possible in Service position: an angle 399 locks it.',
    ch: {front: [0, 1, 1]}, focus: ['613', '395']},
  {id: 'mech', t: 'Open mechanism housing', ref: '400/5', view: 'mech', dur: 3.0,
    say: 'The 3AF mechanism housing is now exposed. Take off cover plate 339.60.1: closing spring, tripping spring 339.64, breaker shaft 339.63, dashpot 339.61.8. Work here only by trained fitters, springs discharged.',
    ch: {mech: [0, 1, 1]}, focus: ['339.60.1', '339.64', '339.63']},
  {id: 'arms', t: 'Remove contact arms', ref: '301/2', view: 'poles', dur: 3.4,
    say: 'Undo the hex screws of the 3 upper arms 423 (run-in contacts 429) and the 3 lower arms 295 (301). Each arm floats on spiral springs 423.13 / 295.13 on its bracket.',
    ch: {armsU: [0, 0.6, 1], armsL: [0.35, 1, 1]}, focus: ['423', '295', '429', '301']},
  {id: 'poles', t: 'Take out breaker poles', ref: '106/3', view: 'poles', dur: 3.6,
    say: 'Each pole: vacuum interrupter 339.30 between upper and lower pole supports .20 / .40, on post insulators .16.1 / .16.2, braced by strut .28, driven by insulated coupler .48. Pole service per the 3AF instructions.',
    ch: {poles: [0, 1, 1]}, focus: ['339.30', '339.20', '339.40', '339.48']},
  {id: 'partL', t: 'Remove lower partition', ref: '400/3', view: 'boxes', dur: 3.0,
    say: 'Mark the lower partition 150 with the panel no., pull off the insulation caps, undo the nuts and pull it forward off its bolts (201/5). The cable compartment opens: CTs 290, fixed contacts 300, earthing switch 256.',
    ch: {partL: [0, 1, 1]}, focus: ['150', '316']},
  {id: 'partU', t: 'Remove upper partition', ref: '400/3', view: 'boxes', dur: 3.0,
    say: 'Only with the busbars switched off, verified dead, earthed and short-circuited (VDE 0105, 400/1): take off partition 374 with the top barrier boxes 360. The busbar compartment opens.',
    ch: {partU: [0, 1, 1]}, focus: ['374', '360']},
  {id: 'flaps', t: 'Lift off relief flaps', ref: '400/9', view: 'top', dur: 2.6,
    say: 'Take off the pressure-relief flaps 538 (truck), 486 (busbar) and 480 (cable compartment). The screws of the ribbed insulators 418 are reachable only from above.',
    ch: {flaps: [0, 1, 1]}, focus: ['538', '486', '480']},
  {id: 'bus', t: 'Take out the busbars', ref: '201/8', view: 'open', dur: 3.6,
    say: 'Undo the M12 joint bolts of the busbar straps (tightened to 70 Nm at erection) and lift out busbars 450 with fixed contacts 430; the ribbed insulators 418 come off with the long-handled wrench and a belt wrench (400/9).',
    ch: {bus: [0, 1, 1]}, focus: ['450', '430', '418']},
  {id: 'ct', t: 'Draw out the CT unit', ref: '400/10', view: 'open', dur: 3.6,
    say: 'Push the two mounting rods (26 mm x 2500 mm) through support plate 220, turn them 90 deg behind the traverse, undo the 4 nuts and draw the CT unit out: CTs 290, lower fixed contacts 300, earthing switch 256.',
    ch: {ct: [0, 1, 1]}, focus: ['220', '290', '256']},
  {id: 'lv', t: 'Open LV compartment', ref: '300/20', view: 'hero', dur: 2.6,
    say: 'Open the LV compartment 530 with the standard key: instruments, relays and terminal blocks of the panel; the rating plate is inside the door at the bottom (100/1). Teardown complete.',
    ch: {lv: [0, 1, 1]}, focus: ['530']},
];
export const N = STEPS.length;

// the state before step 0
const INIT = {brk: 1, cspr: 1, tspr: 1, lever: 0, shaft: 2, travel: 0, plug: 0, det: 0, earth: 0, wheel: 0, front: 0, mech: 0, armsU: 0, armsL: 0, poles: 0, partL: 0, partU: 0, flaps: 0, bus: 0, ct: 0, lv: 0};
export const CHANNELS = Object.keys(INIT);

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = (x) => {
  const k = clamp(x, 0, 1);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};

// every step's channel moves as [channel, k0, k1, value], applied in order (a trailing _ means a second move)
const MOVES = STEPS.map((s) => Object.entries(s.ch).map(([k, [k0, k1, v]]) => [k.replace(/_$/, ''), k0, k1, v]));

/** the raw channel values at procedure position p (0..N) */
export function channelsAt(p) {
  const c = {...INIT};
  const pc = clamp(p, 0, N);
  for (let i = 0; i < N; i++) {
    if (pc <= i) break;
    const k = Math.min(1, pc - i);
    for (const [ch, k0, k1, v] of MOVES[i]) {
      const e = ease((k - k0) / (k1 - k0));
      c[ch] = c[ch] + (v - c[ch]) * e;
    }
  }
  return c;
}

// the shaft 51 position names, as printed on the arc scale above it (300/11 fig 15)
export const SHAFT = ['Moving outside', 'Moving inside', 'Breaker truck interlocked'];

/** the truck's position name from its travel and the plug (100/4, 300/13) */
function positionOf(c) {
  if (c.travel < 0.003) return 'service';
  if (c.travel < T - 0.003) return 'between';
  if (c.travel < T + 0.02) return c.plug > 0.5 ? 'isolated' : 'test';
  return 'withdrawn';
}

/** every pose and readout at procedure position p */
export function stateAt(p) {
  const c = channelsAt(p);
  const step = Math.min(N - 1, Math.floor(clamp(p, 0, N - 1e-6)));
  const k = clamp(p - step, 0, 1);
  const pos = positionOf(c);
  // the final run-in is the cam of the shaft-51 crank in channel 50 (111/4 fig 10-11): with the shaft interlocked
  // in service the truck sits fully home; the readout shows the travel from that home point
  const travelMM = Math.round(c.travel * 1000);
  // shutters: the arm tip's slide piece lifts the flap as it passes the box mouth (102/6); the detector opens the lower ones
  const tip = P.zc + c.travel; // arm tip z (service: at the fixed contact)
  const shutU = (1 - c.armsU) * smoothstep01((P.zp + 0.02 - tip) / 0.05);
  const shutL = Math.max((1 - c.armsL) * smoothstep01((P.zp + 0.02 - tip) / 0.05), detShutter(c.det));
  // front plate: lifted a little whenever shaft 51 is off "interlocked" (111/14)
  const lift = P.shaftLift * clamp(2 - c.shaft, 0, 1);
  // breaker: contact gap in the vacuum interrupters
  const gap = (1 - c.brk) * P.viStroke;
  // operations counter 339.59: closings so far (starts at an arbitrary service count, EST)
  const closings = 1824 + (p > 6.25 ? 1 : 0);
  const st = {
    p, step, k, pos, ...c, travelMM, shutU, shutL, lift, gap, closings,
    shaftName: SHAFT[Math.round(clamp(c.shaft, 0, 2))],
    brkOn: c.brk > 0.5,
    springCharged: c.cspr > 0.5,
    earthOn: c.earth > 0.5,
    plugIn: c.plug < 0.5,
  };
  st.il = interlocks(st);
  return st;
}
function smoothstep01(x) {
  const k = clamp(x, 0, 1);
  return k * k * (3 - 2 * k);
}
// the detector pushes the shutter open while it is in the box (verify step, middle of its travel)
function detShutter(d) {
  if (d <= 0 || d >= 1) return 0;
  return clamp(Math.min((d - 0.18) / 0.12, (0.86 - d) / 0.1), 0, 1);
}

// ------------------------------------------------------------ interlocks (section 111, figs 1-4)
export const CONDITIONS = [
  {n: 1, at: 'service', t: 'Final position reached definitely when pushing in', ref: '111/4', how: 'crank of shaft 51 in channel 50 at "B"'},
  {n: 2, at: 'service', t: 'Truck cannot move while the breaker is ON', ref: '111/10', how: 'lever 339.63.3 above lock rod 51.31'},
  {n: 3, at: 'service', t: 'LV plug cannot be disconnected', ref: '111/5', how: 'plug hidden behind front plate 613'},
  {n: 4, at: 'service', t: 'Earthing switch cannot be closed', ref: '111/14', how: 'shaft 248 covered by front plate 613'},
  {n: 6, at: 'between', t: 'LV plug cannot be disconnected', ref: '111/4', how: 'no room to reach it'},
  {n: 7, at: 'between', t: 'Breaker cannot be closed', ref: '111/9', how: 'lock rod 339.65.9 blocks ON; limit switch 141'},
  {n: 8, at: 'between', t: 'Earthing switch cannot be closed', ref: '111/14', how: 'shaft 248 covered by front plate 613'},
  {n: 9, at: 'test', t: 'Test position reached definitely by a stop', ref: '111/4', how: 'stop on withdrawal'},
  {n: 10, at: 'test', t: 'No move to Service while the breaker is ON', ref: '111/10', how: 'lever 339.63.3 above lock rod 51.31'},
  {n: 11, at: 'test', t: 'No move to Service while the earthing switch is ON', ref: '111/13', how: 'stop 130 horizontal'},
  {n: 13, at: 'isolated', t: 'No move to Service', ref: '111/3', how: 'latch piece 588.6 down (plug out)'},
  {n: 14, at: 'isolated', t: 'Isolated position reached definitely by a stop', ref: '111/3', how: 'crank at "T"'},
];

/** what the operator can do now, and which condition forbids the rest (sections 111 and 300) */
export function interlocks(s) {
  const pos = s.pos;
  const inPanel = pos !== 'withdrawn';
  const locked = s.shaft > 1.5;
  const atTest = pos === 'test' || pos === 'isolated';
  const coveredShaft = pos === 'service' || pos === 'between';
  const why = (ok, cond) => ({ok, cond: ok ? '' : cond});
  const act = {
    close: why(s.springCharged && locked && (pos === 'service' || atTest) && !s.brkOn, s.brkOn ? 'is ON' : !s.springCharged ? 'spring' : 'cond. 7'),
    trip: why(s.brkOn, 'is OFF'),
    moveTruck: why(!s.brkOn && !(locked && inPanel), s.brkOn ? 'cond. 2 / 10' : 'shaft 51'),
    toService: why(inPanel && !s.brkOn && s.plugIn && !s.earthOn && pos !== 'service', pos === 'service' ? 'in Service' : s.brkOn ? 'cond. 10' : s.earthOn ? 'cond. 11' : !s.plugIn ? 'cond. 13' : 'push in first'),
    unplug: why(s.plugIn && (atTest || pos === 'withdrawn'), !s.plugIn ? 'is out' : pos === 'service' ? 'cond. 3' : 'cond. 6'),
    earth: why(!coveredShaft && !s.earthOn, s.earthOn ? 'is ON' : pos === 'service' ? 'cond. 4' : 'cond. 8'),
    removeFront: why(atTest || pos === 'withdrawn', pos === 'service' ? 'angle 399' : 'moving'),
  };
  const group = pos === 'withdrawn' ? null : pos;
  const conds = CONDITIONS.map((c) => ({...c, active: group === c.at || (group === 'isolated' && c.at === 'test' && c.n !== 9)}));
  return {act, conds};
}

export const ACTIONS = [
  ['close', 'Close breaker'],
  ['trip', 'Trip breaker'],
  ['moveTruck', 'Move truck'],
  ['toService', 'Rack to Service'],
  ['unplug', 'Unplug LV plug'],
  ['earth', 'Close earthing sw.'],
  ['removeFront', 'Take off front plate'],
];

// ------------------------------------------------------------ part names (manual legends; even = cubicle, odd = truck)
export const NAMES = {
  '30': ['Bottom sheet', 'cubicle floor, 102/4'],
  '41': ['Wheeling device', 'swivel roller .23, spindle .5, 300/15'],
  '47': ['Locating lever', 'plugs into shaft 51, 300/11'],
  '50': ['Interlocking channel', 'stops A / T / B, 111/3'],
  '51': ['Locking shaft', 'out / in / interlocked, 111/3'],
  '65': ['Front roller', 'steel, track 581 mm, 200/1'],
  '66': ['Centring rail', 'guides channel 151, 111/5'],
  '75': ['Earthing switch handle', 'about 90 deg to the right, 300/19'],
  '121': ['Base plate', 'truck floor, 105/5'],
  '130': ['Stop on shaft 248', 'horizontal when earthed, 111/13'],
  '133': ['Rear roller', 'steel, 105/2'],
  '150': ['Lower partition', 'truck / cable compartment, 102/2'],
  '220': ['Support plate', 'carries the CTs, 400/10'],
  '248': ['Earthing switch drive shaft', 'low right, 102/10'],
  '256': ['Earthing switch', 'knives .6 to contacts .18, 102/8'],
  '290': ['Current transformers', 'post type, 102/8'],
  '295': ['Lower contact arms', 'height a = 665 mm, 203/3'],
  '300': ['Lower fixed contacts', 'feeder side, 102/9'],
  '301': ['Lower run-in contacts', 'cup springs .3, 105/4'],
  '316': ['Lower barrier boxes', 'shutters inside, 102/6'],
  '339.20': ['Upper pole support', 'V breaker 3AF, 106/3'],
  '339.30': ['Vacuum interrupters', 'one per pole, 106/1'],
  '339.40': ['Lower pole support', 'V breaker 3AF, 106/3'],
  '339.48': ['Insulated couplers', 'mechanism to moving contact, 106/3'],
  '339.55': ['Spring-charged indicator', '3AF front, 106/2'],
  '339.58': ['ON / OFF indicator', 'shows I or O, 106/2'],
  '339.60.1': ['Mechanism cover plate', '3AF housing, 106/2'],
  '339.63': ['Breaker shaft', 'lever .3 latches ON, 111/10'],
  '339.64': ['Tripping spring', 'with 3 contact springs .49, 106/1'],
  '360': ['Top barrier boxes', 'diagonal, shutters, 102/6'],
  '361': ['Release device', 'opens the shutter lock, 300/18'],
  '374': ['Upper partition', 'truck / busbar compartment, 102/2'],
  '395': ['Front plate hooks', 'into eye hooks 86 / 620, 111/15'],
  '418': ['Ribbed insulators', 'cast resin, 102/7'],
  '423': ['Upper contact arms', '1246 / 1046 / 906 mm, 203/2'],
  '429': ['Upper run-in contacts', 'finger contacts, 105/4'],
  '430': ['Upper fixed contacts', 'on the busbars, 102/6'],
  '450': ['Busbars', 'Cu, three heights, M12 at 70 Nm, 201/11'],
  '480': ['Relief flap, cable comp.', 'roof, rear, 111/16'],
  '486': ['Relief flap, busbar comp.', 'roof, middle, 111/16'],
  '530': ['Low-voltage compartment', 'rating plate in the door, 100/1'],
  '538': ['Relief flap, truck comp.', 'roof, front, 111/16'],
  '592': ['LV socket', 'bracket .6 locks the plug, 300/13'],
  '593': ['LV plug', '24-pole, hose 587, 105/6'],
  '613': ['Truck front plate', 'closes the panel, 105/1'],
  '653': ['ON push button', 'mechanical closing, 300/5'],
  '673': ['OFF push button', 'always possible, 300/6'],
};
