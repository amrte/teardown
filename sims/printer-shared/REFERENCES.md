# Filament FX-1: references and numbers

The FX-1 is a generic Cartesian bed-slinger with an original name and screen layout. No vendor's name, logo, case or screen artwork is used. Its firmware is a **model** of open-source printer firmware (Marlin 2.1.x), built from the source and the datasheets. It is not the firmware image, and the page says so in its footer.

Every number in `model.js` is listed here with its source. Values marked *assumed* are engineering estimates. They are stated so you can change them.

## Firmware configuration (Marlin 2.1.x defaults)

Source: `Marlin/Configuration.h` and `Marlin/Configuration_adv.h` on the `2.1.x` branch of MarlinFirmware/Marlin.

| Quantity | Value | Define |
|---|---|---|
| Steps per mm X, Y, Z | 80, 80, 400 | `DEFAULT_AXIS_STEPS_PER_UNIT { 80, 80, 400, 500 }` (E is ours, below) |
| Max feedrate X, Y, Z, E | 300, 300, 5, 25 mm/s | `DEFAULT_MAX_FEEDRATE` |
| Max acceleration X, Y, Z, E | 3000, 3000, 100, 10000 mm/s² | `DEFAULT_MAX_ACCELERATION` |
| Print, retract and travel acceleration | 3000 mm/s² each | `DEFAULT_ACCELERATION`, `DEFAULT_RETRACT_ACCELERATION`, `DEFAULT_TRAVEL_ACCELERATION` |
| Junction deviation | 0.013 mm | `JUNCTION_DEVIATION_MM` |
| Homing feedrate | 50, 50, 4 mm/s | `HOMING_FEEDRATE_MM_M { (50*60), (50*60), (4*60) }` |
| Homing bump | 5, 5, 2 mm; second approach ÷ 2, 2, 4 | `HOMING_BUMP_MM`, `HOMING_BUMP_DIVISOR` |
| Planner buffer | 16 blocks | `BLOCK_BUFFER_SIZE` (the ring buffer keeps one slot free) |
| Command queue | 4 lines | `BUFSIZE` |
| Serial | 250 000 baud | `BAUDRATE` |
| Hotend PID | Kp 22.20, Ki 1.08, Kd 114.00 | `DEFAULT_Kp/Ki/Kd` |
| PID update rate | 7.689 Hz, so PID_dT = 0.130 s | `Configuration.h` comment on PID_dT; `temperature.h` (`PID_dT`, `scalePID_i`, `scalePID_d`) |
| PID smoothing, range, max | K1 0.95, ±10 °C full on/off, 255 | `PID_K1`, `PID_FUNCTIONAL_RANGE`, `PID_MAX` |
| Thermal runaway | 40 s outside 4 °C → kill | `THERMAL_PROTECTION_PERIOD`, `THERMAL_PROTECTION_HYSTERESIS` |
| Heating watch | +2 °C within 40 s | `WATCH_TEMP_PERIOD`, `WATCH_TEMP_INCREASE` |
| MINTEMP / MAXTEMP | 5 °C / 275 °C | `HEATER_0_MINTEMP`, `HEATER_0_MAXTEMP` |
| M109 residency | 10 s within 1 °C, reset beyond 3 °C | `TEMP_RESIDENCY_TIME`, `TEMP_WINDOW`, `TEMP_HYSTERESIS` |
| Bed control | bang-bang, checked every 5 s, ±2 °C | `PIDTEMPBED` off, `BED_CHECK_INTERVAL`, `BED_HYSTERESIS` |

The **thermal-runaway state machine** follows `Temperature::tr_state_machine_t::run()` in `temperature.cpp`. A new target sets `FIRST HEATING`. Reaching the target sets `STABLE`. In `STABLE`, a reading more than the hysteresis below target for the whole period sets `RUNAWAY`, and runaway calls kill.

The **PID** follows Marlin's `PIDRunner`. Full power is applied more than 10 °C below target and none more than 10 °C above. Inside that range: the I state is clamped to PID_MAX/Ki_scaled, Ki_scaled = Ki·dT, Kd_scaled = Kd/dT, and the D term is low-passed with K1.

The **planner** follows grbl/Marlin. Each block gets a junction speed v² = a·δ·sin(θ/2)/(1−sin(θ/2)), capped by both blocks' nominal speeds. A reverse pass and a forward pass then run over each run of moves, and each block becomes a trapezoid: accelerate, cruise, decelerate. Hand check: a 90° corner at 3000 mm/s² is √(3000·0.013·2.414) = 9.7 mm/s. The model gives 9.71 mm/s (`check.mjs`).

The **stepper ISR** is Bresenham as in `stepper.cpp`. The lead axis steps on every event. Every other axis keeps a counter that starts at −N/2, gains n_a per event, and steps when it goes positive.

Simplifications: the planner plans each run of moves with full look-ahead. A full 15-block buffer gives the same result, and `check.mjs` confirms the buffer never starves. S-curve acceleration, linear advance and input shaping are off, as they are by default.

## Stepper driver (TMC2209 on UART)

Sources: the Trinamic TMC2209 datasheet (register map and field positions) and Marlin `src/module/stepper/trinamic.cpp` `tmc_init()` for TMC2209, plus `src/feature/tmc_util.h`.

| Setting | Value | Source |
|---|---|---|
| Run current | 800 mA rms, R_SENSE 0.11 Ω | `X_CURRENT`, `X_RSENSE` |
| Hold current | 0.5 × run | `HOLD_MULTIPLIER` |
| Microsteps | 16, interpolated to 256 | `X_MICROSTEPS`, `INTERPOLATE` |
| Chopper (24 V) | toff 4, hend 2, hstrt 1 | `CHOPPER_DEFAULT_24V` in `tmc_util.h` |
| Init | GCONF pdn_disable + mstep_reg_select; CHOPCONF tbl 1, hend+3, hstrt−1, intpol; iholddelay 10; TPOWERDOWN 128; PWMCONF lim 12, reg 8, autograd, autoscale, freq 1, grad 14, ofs 36; GSTAT cleared | `tmc_init()` |

Current scaling follows TMCStepper `rms_current()`. With V_fs = 0.325 V, CS = 32·√2·I·(R+0.02)/0.325 − 1 = 13.5. That is under 16, so vsense goes on (V_fs = 0.180 V) and CS = 32·√2·0.8·0.13/0.18 − 1 = 25. IRUN = 25 and IHOLD = 12. The real rms current is (25+1)/32 · 0.18/0.13/√2 = 0.795 A, a peak of 1.125 A.

Registers as the model writes them: GCONF `0x000000C0`, CHOPCONF `0x14028284`, IHOLD_IRUN `0x000A190C`, TPOWERDOWN `0x00000080`, PWMCONF `0xC80D0E24`.

MSCNT advances 256/16 = 16 per step and wraps at 1024, one electrical cycle or 4 full steps. Coil A follows the sine and coil B the cosine of MSCNT (datasheet, "MSCNT / CUR_A / CUR_B"). The drop to hold current comes after TPOWERDOWN·2¹⁸ clocks at 12 MHz, 2.8 s.

## Mechanics

| Quantity | Value | Hand check |
|---|---|---|
| Motor | NEMA 17, 1.8°, 200 full steps; rotor 50 teeth, stator 8 poles | 360°/(50·4) = 1.8° |
| Microsteps | 16, so 3200 per turn | |
| X, Y | GT2 belt, 2 mm pitch, 20-tooth pulley | 40 mm per turn, 3200/40 = **80 steps/mm** |
| Z | T8 lead screw, 8 mm lead, two screws on one driver | 3200/8 = **400 steps/mm** |
| E | 3:1 gearing, drive gear 7.36 mm effective diameter (*assumed*, typical dual-gear extruder) | 3200·3/(π·7.36) = **415.2 steps/mm** |
| Build volume | 220 × 220 × 250 mm | |
| Frame resonance | toolhead X 52 Hz, bed Y 38 Hz, ζ 0.1 (*assumed*; bed-slingers typically measure 30–70 Hz in published input-shaper resonance tests) | ringing a/ω² ≈ 0.05 mm at 3000 mm/s² |

## Hotend, bed and thermistor

| Quantity | Value | Note |
|---|---|---|
| Heater cartridge | 24 V, 14.4 Ω, so 40 W | 24²/14.4 = 40 |
| Hotend heat capacity | 12 J/K (*assumed*) | aluminium block ≈ 10 g × 0.9 J/gK, plus brass nozzle and heat break |
| Hotend loss | 23 K/W still air, 17 K/W with the part fan (*assumed*) | 210 °C holds at about 20–30 % duty |
| Thermistor | 100 kΩ NTC, β 4092, 4.7 kΩ pull-up | `TEMP_SENSOR_0 1`, header of `thermistor_1.h` |
| ADC | 10 bit × 16 oversamples | `OVERSAMPLENR` |
| Open thermistor | the ADC sits at full scale, past the table's last row (−15 °C) | so MINTEMP trips on the next reading |
| Thermistor lag | 1.2 s seated (*assumed*); worked loose it reads air: ambient + 35 % of the rise, τ 4 s (*assumed*) | |
| Bed | 220 W, 600 J/K, 0.9 K/W (*assumed*) | about 0.37 °C/s from cold |
| Filament | 1.75 mm PLA; melting load 0.416 J/mm³ | 1.25 g/cm³ × 1.8 J/gK × 185 K |

## What the model shows

| Event (nominal run) | Machine time |
|---|---|
| G28 starts / ends | 0.1 s / 8.7 s |
| M109 satisfied (window reached, then 10 s residency) | 86.9 s |
| Layer 1, 2, 3 start | 88.3, 95.7, 99.9 s |
| Print ends / M84 | 104.0 s / 107.4 s |

Faults, run by `check.mjs`:

- **Thermistor unplugged** during layer 2: MINTEMP trips on the next PID reading (≤ 0.13 s). The heater goes to 0, the steppers stop dead, and the screen shows `ERR: MINTEMP E0 / PRINTER HALTED`.
- **Thermistor loose** 3 s after reaching temperature: the reading falls toward air temperature while PID holds the heater at full power. Thermal runaway trips 40.2 s later. By then the block is really at about 310 °C while the sensor reads about 120 °C.
- **Skipped steps**: the X motor stalls for 16 full steps (3.2 mm) on a layer-3 edge. The firmware's count is unchanged, but the carriage and every later bead are 3.2 mm off.
- **Acceleration ×4** (M201/M204 12000): corners are taken at 19.4 mm/s instead of 9.7, and peak frame deflection along the bead goes from 0.136 to 0.218 mm.
