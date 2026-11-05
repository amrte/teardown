# SIVACON S8 teardown: where the numbers come from

Every dimension, rating and torque in `catalog.js` comes from the documents in the `sivacon` repository. Values that no
document gives are marked `[inferred]` in the code. They only shape the geometry and never change a rating on screen.

| Value | Source |
|---|---|
| Frame heights 2000 / 2200 mm, plinth 0 / 100 / 200 mm, widths 200 to 1400 mm, depths 500 to 1200 mm | TIP p.14, Tab. 2/1 · Tab. 2/6 p.20 |
| Height grid: head room row A 225 mm, rows B to U of 100 mm (half-rows of 50 mm), base room 175 mm | OI OFFW p.6–7 · TIP Abb. 4/3 p.46 |
| Device compartment 1800 / 1600 mm high, 600 mm wide; cable compartment 400 / 600 mm | TIP Tab. 4/1 p.44, Abb. 4/3 p.46 |
| Enclosure: door +25 mm, rear wall +25 mm, side wall 9 mm (design side wall 36 mm) | TIP Abb. 2/2 p.20 · OI Aufstellung p.6 |
| Roof: IP31 louvred hoods 118 mm with a 55 mm overhang; IP43 plate on 50 mm spacers with a 101 mm overhang | OI Aufstellung p.6–7 |
| Main busbar ratings for top and rear position (Ie and Icw) | TIP Tab. 2/9 p.22 |
| Busbar phase order: rear top PE N L1 L2 L3, rear bottom L1 L2 L3 N PE, top N L3 L2 L1 | OI Feldverbund p.3–4 · TIP p.18–19 |
| Conductor packs 2×20×10 to 2×6×50×10 (which pack goes with which rating is inferred) | OI Feldverbund p.8–10 |
| Fishplate joint: slotted Cu fishplates, M10 8.8, DIN 6796, 40 Nm, Vaseline, nut tool 8PQ9400-1AA75 | OI Feldverbund p.7–11 |
| PE joint 20 Nm; frame joint M6 at 100/600/1100/1600/2100 mm (2000 mm frame: 100/550/1000/1450/1900 mm), 6 Nm with nut, 4 Nm thread-forming | OI Feldverbund p.5–6, 14–15 |
| Torques M8 20, M10 40, M12 70 Nm (DIN 6796); thread-forming M6 Torx T30 4 Nm | OI El. Anschluss p.9 · OI Aufstellung p.14 |
| Floor fixing: Ø14.8 mm holes, 25 mm from front and rear, 75 mm from the sides, side holes 350 mm from the front, U50 foundation, M10 8.8 | TIP p.105 · OI Aufstellung p.7–9 |
| Plinth corners M12×25 + M6×16, panels M6×10 | OI Aufstellung p.15–17 |
| Withdrawable unit 507 mm wide; contacts at the rear left (in) and rear right (out), control plug on the right; gate valve, ratchet levers, indicator green 0 / blue TEST / red I | OI OFFW p.10–16 |
| Withdrawable heights: HFD 100 to 800 mm; miniature ¼ / ½ at 150 / 200 / 300 mm | OI OFFW p.10–11 · TIP Tab. 4/8 p.49 |
| Vertical distribution bars: profile bar 650 mm², 1100 A; feed points 337.5 / 1462.5 mm | TIP Tab. 4/2 p.46 · OI OFFW p.8–9 |
| Outgoing terminals: M10 40 Nm (≤ 250 A), M12 70 Nm (250 to 630 A); C30 cable rails | OI OFFW p.21–26 · OI El. Anschluss p.6 |
| 3WA frame sizes and minimum field widths; 3VA field 400 mm | TIP Tab. 3/2–3/3 p.29–30, p.41 |
| 3NJ63 strip heights 50 / 100 / 200 / 250 mm; vertical bars 60×10 (1560 A) and 80×10 (2100 A) | TIP Tab. 5/2, 5/5 p.61–62 |
| 3NJ4 strip widths 50 / 100 mm; field 600 / 800 / 1000 mm gives a 500 / 700 / 900 mm compartment; rear busbar only | TIP Tab. 6/1 p.68 |
| PFC field 800 mm, up to 500 kvar; G120 module widths FSA 100 to FSF 325 mm | TIP Ch. 7 p.80 · Tab. 6/18 p.76 |
| Field weights (scaled for the estimate) and power losses | TIP Tab. 9/1–9/2 p.108 |
| Earthing studs on the incoming connection bars: M12, 19 mm across flats, 70 Nm | OI Erden und Kurzschließen p.7–10 |

Inferred values, because no document gives them: breaker outer dimensions, the contact travel per position
(about 12 / 26 mm), frame profile section (40 mm), busbar compartment depth (200 mm at 600 mm depth, 400 mm at 800 mm),
and the maximum transport-unit length (2400 mm).

## SENTRON 3WL1 air circuit-breaker (`wl.js`, `breaker3wl.js`)

Sources:
- **OI**: *Manual for 3WL1 circuit breaker*, 3ZW1012-0WL11-0AB1, 08/2015 (`Segment 001`–`004 of Z_8714.pdf`), with page numbers as printed.
- **COM**: *3WL COM35 Communication Guide*, L1V30536190-04 (`MAN_L1V30536190-04_en_en-US.pdf`).

| Value | Source |
|---|---|
| Breaker items 1–28: front panel in three columns (ETU, operating field, label column), spring charging lever, racking handle drawer, position indicator, receptacles along the top edge, arc chutes, carrying handles, racking shaft | OI 1-1 |
| Guide frame items 1–18: arcing openings, crane holes, shutter, disconnecting contacts, Ø14 earthing terminals, guide rails and their lock, coding, position signalling switch, sliding contact modules | OI 1-2 |
| Front panel common to all frame sizes: door cut-out 300 × 350 mm, 65 mm above the mounting surface; IP41 sealing frame with 8 × Ø5.5 holes | OI 21-1 |
| Body widths 320 / 410 (FS I 3/4-pole) and 460 / 590 mm (FS II) from the mounting-bracket widths c = 338 / 428 / 478 / 608 mm | OI 5-3 |
| Weights of breaker / guide frame: FS I 47/55 + 27/32 kg, FS II 85/103 + 54/65 kg, FS III 90/108 + 70/119 kg | OI 4-2 |
| Fixing: M8-8.8 at 20 Nm (FS I/II), M10 at 40 Nm (FS III); guide frame M8 at 20 Nm | OI 5-2 |
| Main terminals: Ø13.5 bar holes, M12 at 85 Nm; flange M12 at 70 Nm; bracing ≤ 100 mm | OI 5-4…5-14 |
| Receptacles X8 · X7/COM · X6 · X5 left to right, 14 terminals each; which options use which receptacle | OI 5-16, 5-21 |
| Terminal assignments: Y1 X6.7/8, F1 X6.13/14, F2–F4 X5.11–14, motor X5.1/2, CubicleBUS X8.1/2 | OI 7-1…7-9, 10-6 |
| Positions CONNECT (red) / TEST (blue) / DISCON (green) and the maintenance position; the shutter closes at TEST | OI 6-2, 17-1 |
| Racking: clockwise to the stop; no movement during the first ~6 turns | OI 6-3, 6-11 |
| Spring: 9 strokes of the lever; motor recharges within 12 s; CONTACTS / READY / SPRING windows | OI 6-4, 6-6 |
| Releases F1 · Y1 · F2/F3/F4 left to right under the receptacles; S22 and S23 on the releases; F3 td < 80 ms; F4 td 0.2–1.7 s | OI 10-1…10-3 |
| Motor on the hand-charging shaft, fixed with one hex 5 screw at 6 Nm | OI 12-1, 12-2 |
| BSS behind the ETU; metering function PLUS on the back of the ETU | OI 8-79, 8-92 |
| COM35 at X7 on the guide-frame crossbar; S48 S47 S46 underneath, left to right | OI 8-83 · COM p.30 |
| ETU15B / 25B / 27B / 45B / 76B: function matrix and every switch position | OI 8-1…8-29 |
| Settings: IR, tR, Isd, tsd (incl. 0.02 s motor mode), Ii with MAX = 0.8 × Ics, IN, Ig letters A–E (100–1200 A or 400–1200 A), tg | OI 8-1…8-29 |
| Rating plugs 250–6300 A and their validity per frame size | OI 8-65, 8-66 |
| Maintenance sequence and torques: front panel 2 × PH2 at 2.5 Nm, arc chutes hex 4 at 8 Nm, main shaft retainer, racking shaft, CTs at 10 Nm, feet at 10 Nm, rear wall at 18/12 (FS III 25/18) Nm, fixed contacts at 10 Nm, pole assemblies | OI 23-3…23-26 |
| Order-number positions 14/15 (releases) and 16 (auxiliary switches); class digit; ETU letter | OI 10-9, 10-10, 11-5 · COM Format 103 |
| COM35 body, LEDs, ports, terminals, position detection, data points, DAS parameter set B | COM p.11–50 |
| Operating sequences (`wl_sim.js`): OFF/ON, spring charging, racking with handle, control lever and crank, withdrawing onto the rails, re-inserting; refusals when an action is not allowed | OI 6-1…6-11, 17-1, 23-3 |
| Trip unit front (`etu_display.js`): keys, rotary and slide switches, TEST / QUERY / CLEAR, the LED row and the trip-cause LEDs, RESET pin (BREAKER TRIPPED) | OI 8-1…8-29, 8-34 |
| TEST: self-test without tripping (only with the trip unit active and the current below the overload range; running light for tR, then the L LED for 30 s); TEST + CLEAR, release CLEAR, then TEST: self-test with tripping; QUERY: last stored trip cause while pressed; CLEAR: ends a test or deletes the trip cause | OI 6-7, 8-21, 8-74, 8-75 |
| Reset after a trip: QUERY, remedy, CLEAR, RESET pin (reclosing lockout), charge | OI 6-7 |
| ETU76B display (`etu76.js`): operating screen CURRENT with min/max markers; ESC opens MAIN MENU; status line key · wrench · PAR A/B · pencil · TRIG A/B · navigation; backlight off after Default SCR; "Version" on power-up | OI 8-42…8-44 |
| ETU76B menu tree: Metering (Iavg → CURRENT, P → REAL POWER, freq → FREQUENCY / HARMONICS, min/max with time stamps); Diagnostic (Warnings, Trip Log, Setpoints, Maintenance with 12 counters and Contact Erosion, CubicleBUS, Waveform with triggers A/B, event upload and graph); View / Change Parameter (System Config., Prot. Par. Set A, Set B, Metering, Setpoints, Communication); Identification; Clear; Display Setup | OI 8-55…8-64 |
| Parameter change: value inverted, "Save Parameter Changes? ENTER = YES ESC = NO", "Parameter Change Saved." / "NOT saved!!"; clearing with "Are You Sure You Want To Clear?"; 4-digit password (default 0000) | OI 8-62…8-64 |
| ETU76B settings in amps: L on/off, IR 0.4–1 × In, tR 2–30 s (I²t) or 1–5 s (I⁴t); Isd 1.25 × In – 0.8 × Icw (15/20/30 kA with tsd > 0.4 s); tsd 0.02 (M) / 0.08–4 s / OFF, I²t 0.1–0.4 s at 12 × In; Ii 1.5 × In – 0.8 × Ics, MAX, OFF; IN 0.2–2 × In (above 1 only 3-pole); Ig A–E / OFF, tg 0.1–0.5 s, I²t; ThermMem; PhaseSen; two stored sets A/B; display parameterising needs 24 V DC | OI 8-17…8-29 |
| ETU45B display: autoscroll pages, ▲▼ | OI 8-30…8-41 |

Not in the manuals:
- the breaker's height and depth, and the FS III width;
- the racking travel;
- the order-number codes for position 12 (installation) and the ETU letter for ETU15B/25B/27B (shown as •);
- the number of splitter plates.

- the timing of the animations, and the overload acceleration (× 20) used so that an L trip happens within seconds;
- the step sizes of the ETU76B settings (the manual gives ranges only), and Icw (50 / 80 / 100 kA by frame size, at most Icu);
- on the ETU76B display: the password prompt, the contents of Warnings, Setpoints, CubicleBUS and Communication, the Uavg / S / Q / pf / W / Temp sub-screens, the System Config. values, the waveform window (±100 ms) and the example counters and service history.

These are marked `[inferred]` in the code; apart from the last two, they only shape the geometry. The trip curve on screen is an L-S-I characteristic drawn from the settings (L as I²t through tR at 6 × IR, S as definite time).
