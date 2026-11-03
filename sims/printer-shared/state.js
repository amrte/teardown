// One frame of the FX-1, from the model at machine time tm: the pose for printer.js and the numbers for console.js.
// Shared by the film and the live page, so the two cannot disagree.
import {AX, P, TMC} from './model.js';

export const LAYERS_UI = ['ui', 'host', 'parser', 'planner', 'stepper', 'driver', 'thermal', 'mech'];
export const LAYER_NAME = {ui: 'UI', host: 'HOST · SERIAL', parser: 'PARSER', planner: 'PLANNER', stepper: 'STEPPER ISR', driver: 'DRIVER', thermal: 'THERMAL', mech: 'MECHANICS'};
// which hardware each software layer drives (lit in 3D when the layer opens)
export const LAYER_HW = {
  ui: ['ui', 'mcu'],
  host: ['usb', 'mcu'],
  parser: ['mcu'],
  planner: ['mcu', 'bead'],
  stepper: ['motors', 'mcu', 'cables', 'drivers'],
  driver: ['drivers', 'motors', 'cables'],
  thermal: ['heater', 'thermistor', 'bedheat', 'hotend'],
  mech: ['belts', 'screws', 'bed', 'motors'],
};
// which software layers touch each part (follow a part)
export const PART_LAYERS = {
  xmotor: ['planner', 'stepper', 'driver', 'mech'],
  ymotor: ['planner', 'stepper', 'driver', 'mech'],
  zmotor: ['planner', 'stepper', 'driver', 'mech'],
  zscrew: ['stepper', 'mech'],
  emotor: ['planner', 'stepper', 'driver', 'thermal'],
  extruder: ['stepper', 'mech'],
  filament: ['stepper', 'thermal'],
  xbelt: ['stepper', 'mech'],
  ybelt: ['stepper', 'mech'],
  carriage: ['planner', 'mech'],
  bed: ['planner', 'mech', 'thermal'],
  bedheat: ['thermal'],
  bead: ['planner', 'stepper', 'mech'],
  hotend: ['thermal'],
  heater: ['thermal'],
  thermistor: ['thermal'],
  fan: ['parser', 'thermal'],
  lcd: ['ui'],
  board: ['host', 'parser', 'planner', 'stepper', 'driver', 'thermal', 'ui'],
  mcu: ['host', 'parser', 'planner', 'stepper', 'thermal', 'ui'],
  driver: ['driver', 'stepper'],
  usb: ['host'],
  cable: ['stepper', 'driver'],
  frame: ['mech'],
};
export const PART_NAME = {
  xmotor: 'X MOTOR', ymotor: 'Y MOTOR', zmotor: 'Z MOTOR', zscrew: 'Z LEAD SCREW', emotor: 'EXTRUDER MOTOR', extruder: 'EXTRUDER', filament: 'FILAMENT', xbelt: 'X BELT', ybelt: 'Y BELT', carriage: 'X CARRIAGE', bed: 'BED', bedheat: 'BED HEATER', bead: 'PRINTED BEAD', hotend: 'HOTEND', heater: 'HEATER CARTRIDGE', thermistor: 'THERMISTOR', fan: 'FANS', lcd: 'SCREEN + KNOB', board: 'MAIN BOARD', mcu: 'MCU', driver: 'STEPPER DRIVER', usb: 'USB PORT', cable: 'MOTOR CABLE', frame: 'FRAME',
};

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/** the machine-side state at tm: pure, reads only the model */
export function machineAt(M, tm) {
  const pos = {};
  const steps = {};
  for (const a of AX) {
    steps[a] = M.stepsAt(tm, a);
    pos[a] = a === 'z' || a === 'e' ? M.cmdPhys(tm, a) : M.physAt(tm, a);
  }
  const lostX = M.lostAt(tm, 'x');
  const th = M.thAt(tm);
  const ui = M.uiAt(tm);
  const ls = M.lineState(tm);
  const vel = M.velAt(tm);
  const drv = {};
  const rate = {};
  for (const a of AX) {
    drv[a] = M.driverAt(tm, a);
    rate[a] = M.rateAt(tm, a);
  }
  // the board's nets: busy when their signal moves
  const ser = M.serial.filter((e) => e.t <= tm && e.t > tm - 0.25).length;
  const net = {
    x: clamp(rate.x / 1500),
    y: clamp(rate.y / 1500),
    z: clamp(rate.z / 400),
    e: clamp(rate.e / 300),
    heat: th.duty / 255,
    therm: th.tgt > 0 ? 0.55 : 0.15,
    usb: clamp(ser / 3),
    lcd: clamp(0.25 + (tm - ui.lastT < 0.4 ? 0.75 : 0)),
  };
  const sinkT = P.hotend.amb + 0.11 * (th.T - P.hotend.amb);
  return {
    tm,
    pos,
    steps,
    lostX,
    rotor: {x: steps.x + lostX * P.steps.x, y: steps.y, z: steps.z, e: steps.e},
    th,
    sinkT,
    ui,
    ls,
    vel,
    drv,
    rate,
    net,
    planner: M.plannerAt(tm),
    homed: ['x', 'y', 'z'].map((a) => M.homedAt(tm, a)),
    defl: {x: M.deflAt(tm, 'x'), y: M.deflAt(tm, 'y')},
  };
}

/** the pose for printer.js; view: {cut:{motor,hotend,xray}, hl:{group:k}, aheadOn, coilShow} */
export function poseOf(m, view, frameNo, screenDirty) {
  const ahead = [];
  if (view.aheadOn > 0.01) {
    ahead.push({x: m.pos.x, y: m.pos.y, z: m.pos.z, v: m.vel.v});
    for (const b of m.planner) {
      const end = {x: (b.stepsEnd.x ?? 0) / P.steps.x, y: (b.stepsEnd.y ?? 0) / P.steps.y, z: (b.stepsEnd.z ?? 0) / P.steps.z};
      if (b === m.vel.b) ahead[0].v = m.vel.v;
      ahead.push({x: end.x, y: end.y, z: end.z, v: b.vNom});
    }
  }
  return {
    x: m.pos.x,
    y: m.pos.y,
    z: m.pos.z,
    e: m.pos.e,
    rotor: m.rotor,
    coil: {iA: m.drv.x.iA, iB: m.drv.x.iB, peak: TMC.iPeak},
    coilShow: view.coilShow ?? 1,
    T: m.th.T,
    Tsink: m.sinkT,
    duty: m.th.duty / 255,
    bedOn: m.th.bedOn,
    fan: m.th.fan,
    net: m.net,
    ui: m.ui,
    time: m.tm,
    frameNo,
    screenDirty,
    cut: view.cut,
    hl: view.hl,
    ahead,
    aheadOn: view.aheadOn ?? 0,
  };
}

/** the data the screen draws */
export function screenData(M, m) {
  const total = M.prog.length;
  const done = m.ls.parsed ? M.prog.findIndex((L) => L.n === m.ls.parsed) + 1 : 0;
  return {
    ui: m.ui,
    T: m.th.Ts,
    tgt: m.th.tgt,
    bedT: m.th.bedT,
    bedTgt: m.th.bedTgt,
    fan: m.th.fan,
    pos: [m.steps.x / P.steps.x, m.steps.y / P.steps.y, m.steps.z / P.steps.z],
    homed: m.homed,
    prog: M.ev.heatDone !== undefined && m.tm > M.ev.heatDone ? done / total : 0,
    elapsed: m.tm,
    blink: Math.floor(m.tm * 2) % 2 === 0,
  };
}
