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

## SENTRON 3WL air circuit-breaker (`wl.js`, `breaker3wl.js`)

Source: *3WL Air Circuit Breaker COM35 Communication Guide PROFINET IO, Modbus TCP*, Equipment Manual 03/2020,
L1V30536190-04 (`MAN_L1V30536190-04_en_en-US.pdf`, page numbers as printed).

| Value | Source |
|---|---|
| COM35 at position X7 of the auxiliary conductor plug-in system; X7 terminals not usable with it | p.15–16 |
| COM35 body 72 × 60 × 92 mm, 160 g; 24 V DC ±20 %, 125 mA, 2.6 VA; terminals 0.5 Nm | p.47–50 |
| LEDs PN / TCP / CUB and their states; CUB flashing = no ETU found | p.12 |
| Terminals 1–9: Write Enable, free input, free output, Close (Y1), Open (F1, F2) | p.16–19 |
| Two Ethernet ports X1 X2 with switch; function button S1; CubicleBUS RJ45 at the rear with terminating plug; 4-wire lead to X8:1–4 | p.11–20, 39 |
| Position detection: micro-switches S46 (rear), S47 (centre), S48 (front) → connected / test / disconnected / not available; data point 24 values 1 / 2 / 0 / 3 | p.30, Format (24) p.178 |
| Breaker data available only in the connected and test positions | p.13 |
| Order number structure (3WL · market · size · rated current - class · ETU · G/B · poles · connections - mechanism · releases · aux switch) | Format (103) p.180 |
| Interrupting class codes N 2, S 3, H 4, C 5; frame size 1 / 2 / 3 | Format (99), (100) p.180 |
| ETU letters E (ETU45B), F (ETU45B with display), Y (ETU55B), N (ETU76B); G = with ground-fault module | Format (103) p.180 |
| Trip unit type codes ETU45B 4 / 5 / 6 / 7, ETU76B 13 / 14 | Format (412) p.193 |
| Poles: 1 = 3-pole, 2 = 4-pole; rating plug = data point 377 | Format (108) p.181, Tab. 4-6 |
| Protection parameters IR, tR, Ii, Isd, tsd, IN, Ig, tg (data points 333–342), sets A / B (data point 370) | Tab. 4-10 p.106 |
| DAS maintenance mode: ETU76B parameter set B switched by the COM35 free input, indicated by its free output | p.24–29 |
| DSP800 in the door: cut-out 92 × 92 mm, 24 V DC, 2.2 W, up to 8 breakers | p.83 |
| TD400 at the ETU front interface | p.85–89 |

The manual does not give the breaker's outer dimensions, the inner layout, the racking travel, or the setting ranges and
curve of the trip unit. Those are typical values, marked `[inferred]` in the code. The curve on screen is labelled as typical.
