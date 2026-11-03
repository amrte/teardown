# Task: a hardware + software teardown of a 3D printer

You are building one machine with the `teardown` skill (`SKILL.md` in this repo). This machine has a hardware side and a software side. The page shows both and how they connect: a line of G-code goes in, firmware turns it into step pulses, the pulses energise motor coils, the coils turn the rotor, the belt moves the carriage, and plastic comes out. The visitor can open any layer, hardware or software, and every number on screen comes from the same model that moves the parts.

Read `SKILL.md` in full before you start. Every rule in it applies here. This brief adds what is specific to showing software.

---

## 1. The machine

A generic Cartesian "bed-slinger" FDM printer: a Y bed moved by a belt, an X carriage on a gantry moved by a belt, Z on two lead screws, a direct-drive extruder, a 24 V hotend, a heated bed, a 32-bit MCU board with UART-configured stepper drivers, and a 128 x 64 monochrome screen with a rotary encoder. The firmware is modelled on open-source printer firmware (Marlin-style: G-code parser, look-ahead planner, stepper ISR, PID thermal loop, thermal-runaway watchdog).

Do **not** copy any vendor's name, logo, case styling or screen artwork. Call it something original (for example `Filament FX-1`), draw the screen UI in your own layout, and keep the mechanism real.

If the user names a different device, keep the structure of this brief and swap the content. See §10.

## 2. References first (Rule 1)

Collect these before you write any geometry. Save the notes and numbers to `sims/printer-shared/REFERENCES.md`, with a source next to each number.

- Photos or exploded drawings of an open-hardware i3-style printer: frame, gantry, carriage, extruder and hotend in section.
- A NEMA 17 stepper motor cutaway: stator with 8 poles and teeth, the 50-tooth rotor, two phases.
- The firmware source for the parts you model: G-code parser, planner (trapezoid or S-curve, junction deviation), stepper ISR and Bresenham step distribution, PID and thermal runaway, the screen's menu loop.
- Stepper driver datasheet: microstep sine table, STEP/DIR timing, the UART register map (GCONF, CHOPCONF, IHOLD_IRUN).
- The thermistor table (100 k NTC, β ≈ 3950) and the heater cartridge rating.

## 3. Real numbers, one source (Rule 2)

Put these in one parameter block in `sims/printer-shared/model.js`. Write the hand check from SKILL.md rule 2 into a comment above it.

| Quantity | Value | Hand check |
|---|---|---|
| Motor | 1.8° per full step, 200 steps/rev, 16 microsteps | 3200 µsteps per revolution |
| X/Y drive | GT2 belt (2 mm pitch), 20-tooth pulley | 40 mm per rev, so **80 steps/mm** |
| Z drive | T8 lead screw, 8 mm lead | **400 steps/mm** |
| Extruder | geared direct drive, take steps/mm from the reference | state the gear ratio and hob diameter you used |
| Build volume | about 220 x 220 x 250 mm | |
| Hotend | 40 W, 24 V cartridge, 100 k NTC | R = 14.4 Ω, I = 1.67 A |
| Bed | 220 x 220 mm, 24 V, ~0.24 kW | |
| Motion | v_max, a_max, junction deviation | take them from the firmware's default config |
| PID | Kp, Ki, Kd for the hotend | take them from the default config, state the source |
| ISR | the stepper timer frequency | take it from the firmware |

Every gauge, trace, register value and screen line reads from these values or from functions of them.

## 4. One input drives everything (Rule 3)

For a machine that runs on software, the one input is **the program and the clock**. The film and the live tour both play one short G-code program, written for the film: home, heat, a purge line, and two or three layers of a small part with corners, a travel move and a retraction.

At load, `model.js` runs that program through a deterministic firmware model and saves every result to typed arrays, indexed by time:

```
G-code text
  └─ parser          → command records (line number, opcode, args)
     └─ planner       → blocks (entry, cruise and exit speed, accel, junction speeds, look-ahead buffer depth)
        └─ stepper    → per-axis step counts, step timestamps, DIR, microstep phase
           └─ driver   → coil A/B current (the sine table), chopper state
              └─ motor  → rotor angle  →  pulley / screw  →  carriage, bed and Z positions
  └─ thermal loop    → setpoint, measured temp (with sensor lag), PID terms, heater PWM duty, runaway state
  └─ UI loop         → screen frame, menu state, encoder events
  └─ serial / bus    → host ↔ MCU lines ("ok", temperature reports), UART register writes at boot
```

- `render(t)` only reads these arrays. No state is carried between frames, no `Math.random` (use `rng(seed)`), no `Date`.
- The thermal plant is a first-order model: heater power in, heat lost to air and filament out, the thermistor lagging by its own time constant. Integrate it once at load with a fixed step.
- Nozzle position is the forward kinematics of the step counts. It is not a separate path, so the plastic laid down and the step counter can never disagree.
- The deposited bead is built from the nozzle trajectory while the extruder is turning forward: a ribbon or instanced capsules, revealed up to time t.

## 5. Showing software (the new part)

Software has no shape, so give each layer a panel, and use the 3D view as the shared map. Every layer is a button. Opening a layer does two things together: its panel expands, and the part it drives lights up in the 3D view in the accent colour. That link is what makes the page a hardware + software teardown and not two separate pages.

| Layer | Panel shows | Lights up in 3D |
|---|---|---|
| **UI** | The 128 x 64 screen redrawn pixel by pixel from the UI model (status screen, then the menu while the tour turns the knob). The 3D encoder turns with it. | Screen, encoder |
| **Host / serial** | Scrolling log of lines sent and the "ok" replies; the command queue filling and draining. | USB port, MCU |
| **Parser** | The current G-code line, highlighted in the program listing, broken into fields. | — (dims the hardware, the panel is the subject) |
| **Planner** | The velocity profile of the current and next N blocks (trapezoids), the look-ahead buffer as slots, junction speed at each corner. | The toolpath ahead of the nozzle, coloured by planned speed |
| **Stepper ISR** | A logic-analyzer strip: STEP and DIR for X, Y, Z, E, with a time window you can zoom. Step counters per axis. | The four motors, pulsing on each step |
| **Driver** | Coil A and B current as a sine/cosine pair with the microstep index marked; a register table (as written at boot). | Driver chips on the board; the cutaway motor's coils |
| **Thermal** | Setpoint vs measured temperature, the P, I, D terms, heater PWM duty, runaway watchdog state. | Heater cartridge glowing with duty, thermistor, heat-break gradient |
| **Mechanics** | Steps → mm for each axis, live; belt tension side; the nozzle position as XYZ. | Belts, pulleys, lead screws, carriage, bed |

Required interactions on top of the SKILL.md set (views, cutaways, isolate, auto tour, quality tiers):

- **Follow a line.** Click a G-code line in the listing. The page traces it down: the line flashes, then its planner block, then its step burst in the analyzer, then the motor it turned, then the plastic it laid. Use leaders that run from panel to part.
- **Follow a part.** Click a part in 3D (a motor, the heater, the screen). The page highlights every software layer that touches it.
- **Time lens.** Mechanics run in seconds and the ISR in microseconds. Use one master clock with playback speed (as the V8 runs at 1/20), plus a separate zoom on the analyzer strip, centred on now, from 100 ms down to 200 µs. Label both scales clearly so no one reads a slowed step train as the real rate.
- **Fault injection** (live page only, from a fixed list; each fault re-runs the model at load time, not inside `render`):
  - thermistor unplugged: reading jumps, then runaway trips, then the heaters cut and the screen shows the error;
  - skipped steps: the commanded position and the real one drift apart, and the print shifts on screen;
  - acceleration set too high: the planner profile changes, and ringing shows in the bead after corners.
- **Cutaways.** Stepper motor (stator, coils energised by phase from the driver's current, rotor teeth lining up), hotend section (filament, melt zone, heat break), board x-ray (MCU, drivers, the traces from MCU to driver to motor connector highlighted while active).

Layout on the fixed 1600 x 900 console: 3D in the centre-left; the software stack as a column of collapsible panels on the right, ordered top to bottom from UI to driver so the column reads as the stack; the analyzer strip and the program listing along the bottom; title and the key readouts top left. Only one software panel is fully open at a time. The rest stay one line high and still update.

## 6. Files

Follow the example layout in `sims/` exactly:

```
sims/printer-shared/
  REFERENCES.md   sources and every number
  model.js        parameters, G-code program, firmware + thermal + UI models, all trace arrays (no three.js)
  printer.js      geometry from code: frame, gantry, belts, motors (with cutaway), hotend, board, screen; update(state)
  stage.js        studio, lights, shadows, post
  console.js      overlay: software stack panels, analyzer, listing, readouts, callouts; update(state)
  film.js         SCRIPT of operator moves and render(t)
  live.js         real-time page, buttons, interactions in §5, auto tour, TIERS
  score.py        sound on the film's timeline
sims/printer-film/main.js + timeline.json
sims/printer-live/main.js
```

## 7. The film (about 30 s)

Plan it beat by beat in `timeline.json` before you write `film.js`. A suggested order:

1. 0 s: the whole printer, frame 0 shows the machine and the title (it is the thumbnail).
2. Heating: the thermal panel opens, the heater glows, the temperature curve climbs to the setpoint and overshoots slightly.
3. Homing: endstops trip, the step counters reset to zero.
4. Follow one line: a corner move traced from listing → planner → analyzer → motor cutaway (coils switching) → belt → nozzle.
5. A layer prints. The planner panel shows slowing at corners; the bead is coloured by speed.
6. The camera goes inside: hotend section, filament melting.
7. Pull back to the stack view: all layers live at once, then hero.

Sound: a soft tick for each layer that opens, a low bed under heating, a motor tone whose pitch follows the step rate (one key for all tonal sounds). Accent, never narrate.

## 8. Acceptance criteria

Do not report done until all of these hold and you have read the current review sheets (SKILL.md review loop).

- [ ] Every number from §3 appears in `model.js` with its source, and the hand checks are written down.
- [ ] Positions of carriage, bed and Z equal the step counts divided by steps/mm, checked in code at 3 times you pick.
- [ ] The analyzer's step count for an axis between two times equals the change in that axis's position × steps/mm.
- [ ] Coil currents in the motor cutaway match the driver panel at the same frame.
- [ ] The bead never runs ahead of the nozzle and never appears during travel moves or retraction.
- [ ] Each software layer button opens its panel and lights its hardware, and "follow a line" / "follow a part" both work.
- [ ] The thermistor fault trips the runaway at the time the firmware's rule says, and the heaters go to zero.
- [ ] Both time scales are labelled; at no point does a slowed signal pass as real time.
- [ ] The live page runs at 60 fps on the lowest TIER on an integrated GPU, shaders are warmed, and the HTML is under 1 MB.
- [ ] `render(t)` is pure: two captures of the same t are pixel-identical.
- [ ] Beat sheet, transition sheets and the final video sheet are read, and a full pass finds nothing on the SKILL.md checklist.
- [ ] No vendor name, logo or screen artwork anywhere.

Commands (from the repo root):

```
node sims/build.mjs printer-live
node sims/build.mjs printer-film
node sims/capture.mjs printer-film --size 1600x900 --dpr 1.2 --stills beats --cols 4 --out teardown-out/printer-beats.png
node sims/capture.mjs printer-film --size 1600x900 --dpr 1.2 --out teardown-out/printer-silent.mp4
python run_sfx.py sims/printer-shared/score.py
```

## 9. Limits to respect (say these to the user too)

- **A model, not the binary.** The page runs a faithful model of the firmware's logic in JavaScript, built from the source and the datasheets. It does not run or emulate the real firmware image. Say so in the page's footer. Optional upgrade: replay a real capture (a logic-analyzer CSV of STEP/DIR, a serial log) baked into the arrays at load, if the user gives you one.
- **A small, fixed program.** G-code is chosen from presets, so `render(t)` stays pure and the page stays small. Free text entry is out of scope unless the user asks for it; if they do, parse it at load with hard limits on length and moves.
- **Simplified physics where it doesn't show.** Belt stretch, extrusion pressure and plastic flow are approximated. Anything a panel shows as a number must come from the model, not a guess.

## 10. Using this brief for another device

Keep §4 (program + clock as the one input, traced once at load), §5 (one panel per software layer, each linked to the hardware it drives, follow-a-line, follow-a-part, time lens, faults) and §8. Swap the rest. Candidates that fit the skill well because they move:

| Device | Hardware you open | Software stack you show |
|---|---|---|
| Hard disk drive | platters, voice-coil actuator, head, spindle | SATA command → cache → LBA to cylinder/head/sector → servo loop on the embedded servo wedges → ECC |
| Mechanical keyboard | switch in section, matrix, diodes | matrix scan → debounce → keymap layers → USB HID report → host |
| Quadcopter | motors, ESCs, IMU, props | IMU sampling → attitude estimate → cascaded PID → motor mixer → ESC PWM / DShot |
| Robot arm (6-DOF) | servos, harmonic drives, encoders | trajectory → inverse kinematics → joint PID → encoder feedback |
| Inkjet printer | carriage, nozzles, paper path | raster → halftone → nozzle firing schedule → carriage encoder sync |

Devices with no moving parts (a phone, a router, a GPU) fit the skill less well: there is little for the 3D view to do besides an exploded board. For those, make the 3D view a board x-ray where data moves along the traces as particles, timed from the bus model.
