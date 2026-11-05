// Operation, service and breaker-level data. Sources: O = NXAIR Operating Instructions 110-0134.9 rev. 14;
// CB = Siemens Operating Instructions vacuum circuit-breaker 3AE (SION) 9229 0001 176 0E (07.2013);
// HG = catalog HG 11.02 · 2020 (SION 3AE5). Page numbers are the printed pages.

export const CB_DOCS = [
  {k: 'BA5', t: 'Betriebsanleitung SION Vakuum-Leistungsschalter 3AE5 (operating instructions, German edition)', no: '9229 0025 100 0C', rev: '02.2020', url: ''},
  {k: 'CB', t: 'Operating Instructions vacuum circuit-breaker 3AE1 / SION 3AE5 (older, English)', no: '9229 0001 176 0E', rev: '07.2013 (EN)', url: 'https://cache.industry.siemens.com/dl/files/302/106325302/att_3120/v1/BA_3AE_Vakuum_Leistungsschalter_SION_EN_201409231052218953.pdf'},
  {k: 'HG', t: 'Catalog HG 11.02 SION vacuum circuit-breakers', no: 'HG 11.02', rev: 'Edition 2020', url: 'https://cache.industry.siemens.com/dl/files/074/109778074/att_1021110/v1/HG_11_02_2020_EN_202004281238152516.pdf'},
];

// Joints on the 3AE5 breaker (BA5 = SION operating instructions 9229 0025 100 0C, 02.2020). The breaker manual gives
// its torques for GREASED threads; the NXAIR busbar joints are tightened DRY. Where the 3AE5 manual differs from the
// older combined 3AE manual (earth terminal 105 vs 70 Nm, fixing M10 48 vs 40 Nm, brackets 24 vs 20 Nm) the 3AE5
// manual is used.
export const CB_JOINTS = [
  {id: 'cbArm', group: 'Circuit-breaker 3AE5', where: 'Threaded bolt (22.1) of the contact arm into the pole terminal, upper + lower, 3 poles', qty: '6', bolt: 'M12 (12 kV, ≤ 31.5 kA, ≤ 1600 A), screw-in depth 20 ±1 mm in both terminals', wash: 'Screw-in section greased with Vaseline', t: 40, c: null, tol: '±4', basis: 'step', ref: 'BA5 p.53–54 Fig. 79/82', part: 'breaker', size: 'M12', note: 'Greased threads only. M16 versions (2000–2500 A) 100 ±10 Nm, 28 ±1 mm lower. This is the breaker maker\'s value, NOT the 70 Nm dry value of the panel busbars.'},
  {id: 'cbTulip', group: 'Circuit-breaker 3AE5', where: 'Contact system (23) onto bolt and contact arm', qty: '6', bolt: 'M12 on the threaded bolt', wash: 'Round outer edge towards the arm; for Ø 40 mm arms the contact arm adapter 22.2 first', t: 40, c: null, tol: '±4', basis: 'step', ref: 'BA5 p.55–56 Fig. 85–87', part: 'breaker', size: 'M12', note: 'Fingers greased with Molykote Longterm 2 inside before fitting, the other side after tightening.'},
  {id: 'cbBus', group: 'Circuit-breaker 3AE5', where: 'Flat busbars on the pole contact plates (fixed-mounted breaker)', qty: '4 per terminal', bolt: 'M12 bolts and nuts, property class 8.8, with spring elements and washers (stainless bolts from the accessory pack recommended)', wash: 'Counter-hold the nut. Optional anti-twist pin ISO 8748 / ISO 8752 4 × X in a Ø 4 H11 hole', t: 40, c: null, tol: '±4 · M16: 100 ±10', basis: 'step', ref: 'BA5 p.53–54 Fig. 81', size: 'M12', note: 'Busbars fit flat and hole-to-hole before tightening. Silver-plated parts never bolted to aluminium bars. Not used in NXAIR (contact arms instead).'},
  {id: 'cbEarth', group: 'Circuit-breaker 3AE5', where: 'Earth terminal (70) on the top plate of the drive housing', qty: '1', bolt: 'Hexagon screw M12', wash: 'Order under the head: washer, ring lug of the earth conductor, contact washer SN 70093 with its teeth to the housing', t: 105, c: null, basis: 'step', ref: 'BA5 p.48 Fig. 66–69', size: 'M12', note: 'Earth conductor for 30 A with ≤ 3 V drop (IEC 62271-200). Not needed when the breaker is bolted to an earthed metal frame with external-tooth lock washers under the screw heads.'},
  {id: 'cbFix', group: 'Circuit-breaker 3AE5', where: 'Fixed-mounted breaker to its horizontal mounting surface / truck (from below)', qty: '4', bolt: 'M10, property class 8.8, with washers', wash: '—', t: 48, c: null, tol: '±4', basis: 'step', ref: 'BA5 p.44 Fig. 57/58', size: 'M10', note: 'Greased threads. Factory-assembled on the NXAIR withdrawable part; listed for completeness.'},
  {id: 'cbBracket', group: 'Circuit-breaker 3AE5', where: 'Fixing brackets for mounting on a vertical surface', qty: 'per bracket', bolt: 'M8 from the accessory pack', wash: '—', t: 24, c: null, basis: 'step', ref: 'BA5 p.45 Fig. 60/61', size: 'M8'},
  {id: 'cbIP', group: 'Circuit-breaker 3AE5', where: 'IP plates (internal-arc protection plates, option) to the drive housing', qty: 'per plate', bolt: 'Hexagon socket M8; angled IP plate on the housing M12', wash: '—', t: 24, c: null, tol: 'M12: 84 ±6', basis: 'step', ref: 'BA5 p.46 Fig. 62–64', size: 'M8'},
  {id: 'cbCover', group: 'Circuit-breaker 3AE5', where: 'Metal cover 20.2 (the plastic cover 20.1 only snaps on)', qty: '2 upper (loosened only) + 4 lower', bolt: 'Hexagon screws M6', wash: 'Contact washers, teeth towards the cover', t: 12, c: null, basis: 'step', ref: 'BA5 p.41 Fig. 48/49', size: '—', note: 'The text says 12 Nm; Fig. 49 is labelled 4 Nm. The page follows the text; confirm on the order documents.'},
  {id: 'cbShaft', group: 'Circuit-breaker 3AE5', where: 'Shaft covers (option) on both sides of the breaker', qty: 'per cover', bolt: 'Self-tapping screws Torx T20 with locking elements; expanding rivet first', wash: '—', t: 5, c: null, basis: 'step', ref: 'BA5 p.47 Fig. 65', size: '—'},
  {id: 'cbPG', group: 'Circuit-breaker 3AE5', where: 'Cable bracket (60) for the plug / terminal strip version without -X0', qty: 'per bracket', bolt: 'Self-tapping screws, Torx 20, single use only', wash: '—', t: 3, c: null, basis: 'step', ref: 'BA5 p.42 Fig. 50', size: '—', note: 'Route the loom towards the back of the pole shells.'},
  {id: 'cbBush', group: 'Circuit-breaker 3AE5', where: 'Bushings with counter contact on the customer plate or cassette frame (non-NXAIR installations)', qty: '4 per bushing', bolt: 'Mushroom-head square-neck bolts DIN 603 M8x25-8.8, contact washers, hex nuts', wash: 'Plate of non-ferromagnetic steel', t: 25, c: null, tol: '±2', basis: 'step', ref: 'BA5 p.56 Fig. 88', size: 'M8', note: 'Greased threads. Bushing cover from the other side.'},
];

export const CB_DEPTHS = [
  ['7.2–17.5 kV, 16–31.5 kA, 800–1600 A', 'M12', '20 ±1 mm', '20 ±1 mm'],
  ['7.2–17.5 kV, 16–31.5 kA, 2000–2500 A', 'M16', '20 ±1 mm', '28 ±1 mm'],
  ['7.2–17.5 kV, 40 kA, 1250 A', 'M12', '20 ±1 mm', '38 ±1 mm'],
  ['7.2–17.5 kV, 40 kA, 2000–4000 A', 'M16', '20 ±1 mm', '38 ±1 mm'],
  ['24 kV, 16–25 kA, 800–1250 A / 2000–2500 A', 'M12 / M16', '20 ±1 / 28 ±1 mm', '28 ±1 / 44 ±1 mm'],
];

export const CB_TIMES = [
  ['Closing time', '≤ 60 ms'],
  ['Opening time', '≤ 30 ms with -Y1 · ≤ 45 ms with 2nd / 3rd release (-Y2 … -Y7)'],
  ['Arcing time', '< 15 ms'],
  ['Break time', '≤ 45 ms with -Y1 · ≤ 60 ms with 2nd / 3rd release'],
  ['Dead time', '300 ms'],
  ['Close-open contact time', '≤ 45 ms with -Y1 · ≤ 60 ms with 2nd / 3rd release'],
  ['Minimum command duration', '-Y9 45 ms · -Y1 40 ms · 2nd / 3rd release 20 ms'],
  ['Shortest -S6 "tripped" pulse', '> 10 ms with -Y1 · > 6 ms with 2nd / 3rd release'],
  ['Charging time (motor)', '< 15 s; ≥ 60 s between charging operations'],
  ['Pole synchronism', '≤ 2 ms'],
];

export const CB_AUX = [
  ['Motor -M1 (53)', '3AY1411', 'see table below; supply -15 / +10 %'],
  ['Closing solenoid -Y9 (52)', '3AX1410 / 3AY1410', '300–370 W/VA, not for continuous duty, cut off by -S1; varistor ≥ 60 V DC'],
  ['1st shunt release -Y1 (51.1)', '3AX1410 / 3AY1410', '300–370 W/VA, direct-acting armature; DC -30 / +10 %, AC -15 / +10 %'],
  ['2nd shunt release -Y2 (option)', '3AX1101', '10 W/VA, energy store; varistor ≥ 60 V DC, rectifier ≥ 100 V'],
  ['C.t.-operated releases -Y4, -Y5 / -Y6 (option)', '3AX1102 / 3AX1104 (0.1 Ws)', 'trip at 90 % of rated current; ≤ 6 VA at 0.5 / 1 A; need matching auxiliary CTs'],
  ['Undervoltage release -Y7 (option)', '3AX1103', '20 W/VA, only with its series resistor -R1 (1 or 2 resistors); striker locking screw A → B'],
  ['Electrical closing lock-out -Y8E (option)', '3AX1415 (list: 3AX1405)', 'closing only with control voltage, with -S5'],
  ['Key lock (option)', '3AX1437', 'blocks hand and electrical closing (-S5)'],
  ['Auxiliary switch -S1 (31)', '3SV9273 / 3SV9274', '6 NO + 6 NC / 12 NO + 12 NC; 250 V, 10 A cont., making 50 A; breaking 10 A at 230 V AC, 5 A (4 A inductive) at 110 V DC, 2.5 A (2 A) at 220 V DC'],
  ['Auxiliary contactor -K1 (34)', '3AY1420', 'electrical anti-pumping'],
  ['Position switches -S21, -S3, -S4, -S6, -S12', '3AX4206-0A', 'motor cut-off, -K1 control, spring charged, tripped signal, mechanical-interlock blocking'],
  ['LV interface -X0 (32)', '3AX1134', '64-pole plug, crimp 1.5–2.5 mm²; or 20–30-pole plug strip (WAGO 231-110/026-000)'],
  ['Heater -R01 (option)', '—', '50 W, 230 V AC (110 V AC option), surface ≈ 180 °C'],
];

export const CB_MOTOR = [
  ['24 V DC', '140 W', '2 A'], ['30 V DC', '180 W', '—'], ['48 V DC', '110 W', '1 A'], ['60 V DC', '130 W', '1 A'],
  ['110 V DC', '100 W', '0.5 A'], ['110 V AC', '170 VA', '0.315 A'], ['120 V DC / AC', '110 W / 210 VA', '—'], ['125 V DC', '120 W', '—'],
  ['220 V DC', '110 W', '0.315 A'], ['230 V AC', '200 VA', '0.25 A'], ['240 V DC / AC', '130 W / 200 VA', '—'],
];

export const CB_CHECKS = [
  'Rating plate data match the order; correct supply voltage; ambient ≥ -5 °C (with A40 down to -25 °C)',
  'Breaker clean (insulating parts: damp cloth, warm water, mild cleaner); bolted joints tight; plug strip seated',
  'Closing interlocks (key lock, -Y8E, -Y7) released for the tests',
  'Without supply: charge with the hand crank, ON, then OFF',
  'With supply: motor starts at once and charges; check the mechanical and electrical spring indication',
  'Check -S1 and the position switches electrically in both end positions; check -Y9 and every shunt release electrically',
  '-Y7 fitted: striker locking screw moved from A to B',
  'Interlocks function as required by IEC 62271-200',
  'Cover refitted and fixed; only then high voltage',
];

export const CB_ACCESSORIES = [
  ['Hand crank for the closing spring', '3AX1530-4B', 'with slip clutch; only the original crank'],
  ['Hand crank for the cassette "Heavy Duty"', '3AX1430-2C', 'hexagon'],
  ['Hand crank for the motor cassette "Standard"', '3AX1430-8A', 'square; never with secondary voltage on'],
  ['Molykote Longterm 2', '3AX1133-2L', 'contact fingers; eye protection (causes serious eye damage)'],
  ['Vaseline (contact grease SN 10611)', '3AX1133-4A', 'threaded bolts and contact faces; acid-free, flash point 210 °C'],
  ['Operating / unpacking instructions', '9229 0025 100 / 9229 0027 100', 'support.industry.siemens.com'],
];

// fasteners from the operating instructions (all hand / 25 Nm M8)
export const OPS_JOINTS = [
  {id: 'vtDoor', group: 'Doors and operation', where: 'Removable-VT compartment door', qty: '3 (captive)', bolt: 'Hex socket head bolts, key size 6', wash: '—', t: 20, c: null, basis: 'hand', ref: 'O §19.3 p.241', size: '—'},
  {id: 'fuseCover', group: 'Doors and operation', where: 'Insulating covers of metering-part fuses, 17.5 kV', qty: '3 covers / 6 bolts', bolt: 'Plastic bolts M8x12', wash: 'Washers 8.4 mm', t: null, c: null, basis: 'none', ref: 'O §12.8 p.107', size: '—', note: 'Hand force only (plastic).'},
];

// ------------------------------------------------------------------------------------------- operation steps
export const OPS_STEPS = [
  {
    id: 'rack', phase: 'Operate', title: 'Rack the breaker test ↔ service', view: 'side', ex: 0, truck: 'service', row: false, focus: ['truck', 'shelf', 'shutters', 'shutterMech'], cut: true,
    body: [
      'Preconditions: truck in test position, LV connector plugged on, HV door closed, breaker OPEN (check through the window), feeder earthing switch OPEN, padlock off the slide, electromagnetic interlock released, VT door (if any) screwed shut.',
      '1 Lift the operating slide and hold it. 2 Insert the 5 mm double-bit key, turn 90° clockwise (horizontal → vertical) to release.',
      '3 Fit the racking crank on the shaft, turn clockwise to the end stop. The truck travels on its spindle; the shutters are driven open by the truck. 4 Remove the crank.',
      '5 Key 90° clockwise to interlock, 6 remove it, 7 slide down, 8 padlock. Indicator shows a vertical bar = service.',
      'Back to test: the same with the key and the crank turned counter-clockwise. Indicator: horizontal bar.',
      'Interlocks release only in stable end positions. 3AE racking travel: 180, 200 or 220 mm (≤ 17.5 kV), 260 mm at 24 kV.',
    ],
    warn: 'Key goes in but will not turn: earthing switch CLOSED or HV door open. Crank still inserted: the earthing-switch opening stays blocked and the breaker cannot close.',
  },
  {
    id: 'switch', phase: 'Operate', title: 'Close, open, charge, discharge', view: 'front', ex: 0, truck: 'service', row: false, focus: ['mech', 'hvdoor'], drills: ['ltClose', 'ltOpen', 'ltFuse'],
    body: [
      'Electrical close: breaker in test or service, OPEN, spring CHARGED, door closed, auxiliary voltage on, local/remote selected, undervoltage release (if any) energised. The motor recharges at once; the opening spring is charged during closing. Indicator 0 → I, counter + 1.',
      'Manual close / open: LOCAL, swing the opening cover aside with the rotary button, insert the push rod, press ON (or OFF) until the switching noise, remove the rod, padlock.',
      'Manual charging: auxiliary voltage off, spring DISCHARGED. Hand crank on the shaft, hold the freewheel, ≈ 50 turns clockwise until CHARGED. Never leave the crank in; racking with it inserted damages the breaker. The motor charges in < 15 s.',
      'Discharge before work: test position, LOCAL, auxiliary voltage OFF, then OPEN – CLOSE – OPEN with the push rod.',
      '3AE5: never press CLOSE and OPEN together; the manual warns of irreversible damage.',
    ],
  },
  {
    id: 'earthing', phase: 'Operate', title: 'Earth and de-earth the feeder', view: 'door', ex: 0, truck: 'test', esw: 0, row: false, focus: ['esw', 'doorCtl'], drill: 'esw', drills: ['ltOpen', 'ltEarth', 'ltDeearth'],
    body: [
      'Preconditions: HV door closed, feeder isolated (opposite end too), breaker in TEST position, operating lever at hand, padlock off, electromagnetic interlock released.',
      '1 Lift the slide. 2 Insert the lever slightly with its pins horizontal, 3 push it fully in. 4 Hold it straight and turn 180° clockwise to CLOSED in one movement. 5 Remove the lever, 6 slide down, 7 padlock. Indicator vertical I = earthed.',
      'De-earth: same with 180° counter-clockwise.',
      'Never stop half-way and never pull the lever out mid-turn. The switch is make-proof; after 2 short-circuit making operations inspect the blades and the laminated fixed contacts.',
      'Busbar earthing switch (optional, operated from the front upper area of the LV compartment, ladder): pins at "10 past 8", ≈ 115° clockwise to earth; pins vertical, ≈ 115° counter-clockwise to de-earth. Padlock or electromagnetic interlock only.',
    ],
  },
  {
    id: 'lvplug', phase: 'Operate', title: 'LV connector and coding', view: 'iso', ex: 0, truck: 'test', row: false, focus: ['lvPlug', 'shelf'],
    body: [
      'Remove: test position, spring discharged, auxiliary voltage off, HV door open. Push the longitudinal fastener up, pull the connector to the front, hang it in the support under the LV compartment.',
      'Plug on: follow the label, plug from the front, push the fastener down, close the door, switch auxiliary voltage on (the motor charges the spring).',
      'The HV door cannot be closed without the LV connector plugged on.',
      'Coding: 4 coding pins on the plug connection. 2–3 symbols on the withdrawable part and on the connector must match: 1st electromagnetic interlock (none / racking + earthing / racking / earthing), 2nd rated current (+ basic control), 3rd optional extended control (2nd shunt release, c.t.-operated or undervoltage release).',
    ],
  },
  {
    id: 'remove', phase: 'Service', title: 'Take the breaker out and put it back', view: 'iso', ex: 0, truck: 'test', row: false, focus: ['serviceTruck', 'truck', 'hvdoor', 'lvPlug'], drills: ['takeOut', 'putIn', 'door'],
    body: [
      'Out: service truck for this panel width, breaker in test, spring discharged, HV door open, LV connector stowed. 1 Centre the truck. 2 Push the left and right locking elements into the frame openings, rails aligned; set the height with the 2 setting wheels. 3 Pull back to check it is latched (click). 4 Turn the 2 breaker locking levers 90° outward. 5 Pull the breaker onto the truck by its handles to the end stop. 6 Levers inward. 7 Pull the 2 unlocking levers up. 8 Wheel away slowly on a dry, flat floor.',
      'In: same coding, earthing-switch coupling pin vertical on the breaker and in the compartment (turn with the lever if needed), spring discharged, auxiliary voltage off. Dock and check the truck, levers outward, pull out the truck unlocking handle and hold it, push the breaker in to the stop, pull the unlocking levers up, pull the truck back, turn the breaker levers inward until both latch, plug the LV connector on, close the door, auxiliary voltage on.',
      'Truck-type version: levers outward, lift the locking bracket into its retaining hook, pull the truck out by its handles. In: rollers onto the guide rails, push to the stop, lift the hook, pull the bracket fully down until it snaps (LOCKED), levers inward. Never lock the bracket with the truck only part-way in.',
      'Service truck: move only empty or with the part latched; operate from the operating side; park with the rear against a wall.',
    ],
  },
  {
    id: 'shutterOps', phase: 'Service', title: 'Open shutters, fit the earthing device', view: 'iso', ex: 0, truck: 'out', row: false, focus: ['shutters', 'shutterMech', 'bushU', 'bushL', 'earthDev'], drills: ['shutters', 'earthDev'],
    body: [
      'Upper (busbar) shutter = left mechanism, lever L. Lower (feeder) shutter = right mechanism, lever R. Padlock the other mechanism unless both must be open.',
      'Preconditions: withdrawable part removed, door open, LV connector stowed, isolated, earthed, verified dead, PPE. Work the lever from outside the panel by its handle; never put hands into the mechanism or push a shutter.',
      'Busbar shutter: padlock the right mechanism, fit lever L, push the handle down to the stop (it latches, shutter open). To close: push the handle slightly right, let it slip up, remove the lever, remove the padlock.',
      'Earthing device (600 mm: Ø 40 mm contacts, ≤ 1000 A; 800 mm: Ø 60 mm, 1250 A; max. 25 kA 1 s): inspect the copper wires (no brown discoloration or stiffness) and the tulip bolts. Bolt the earthing clamp to the earthing point hand-tight ≈ 20 Nm BEFORE opening a shutter.',
      'Open one shutter, couple the rod (both hands inside the limiting ring), push the earthing tulip onto the CENTRAL contact first, turn clockwise at the cross lever, pull the rod off; then the outer two. Expect a small static discharge. Removal in reverse, clamp last.',
    ],
  },
  {
    id: 'frontAccess', phase: 'Service', title: 'Reach the connection compartment from the front', view: 'connFront', ex: 0, truck: 'test', esw: 1, row: false, focus: ['partition', 'protPlate'], joints: ['partition', 'protPlate'], drills: ['front'],
    body: [
      'Danger: isolate and earth the cable or bar connections before the partition comes off; warning sign on the HV door; do not operate the feeder earthing switch during the work (O §23.1).',
      'Feeder earthing switch CLOSED (indicator vertical I on the door and inside the compartment), breaker taken out, door open.',
      'Withdrawable breaker and disconnector panels: protection plate first (4 nuts M8 with contact washers), then the vertical partition: 10 × M8x20 with contact and plain washers + 5 × M8x20 with contact washers (O §23.2). 435 mm contactor: left part 7 × M8x20, right part 4 × M8x16 (heater moved aside first if fitted).',
      'Refit (O §23.3): no foreign objects, clean, leave greased areas alone; all bolts all round, screwed to the end of the thread, hand-tight, then 25 Nm; protection plate 4 × M8 25 Nm. Then insert the breaker, close the door, de-earth, rack to service.',
      'From the rear instead (O §24): horizontal ledge 8 × M8x25, each vertical ledge 14 × M8x20, 2 sealing brackets, 4 × M8x20 at the base, lift the rear wall out by its handle; refit everything at 25 Nm. Never remove the ledges of the busbar compartment.',
    ],
  },
  {
    id: 'isolate', phase: 'Operate', title: 'Verify safe isolation, earth the busbars', view: 'front', ex: 0, truck: 'test', row: false, focus: ['lv', 'busES'], drills: ['verify', 'busEarth', 'busDeearth'],
    body: [
      'Capacitive voltage detecting system to IEC 61243-5 with test sockets for feeder and busbar below the LV door: LRM sockets, or CAPDIS-S1+/S2+ or VOIS+/VOIS-R+ indicators (IP54, no auxiliary power for the display).',
      'Function-test the indicator first (battery test unit, or on a live panel).',
      'HV and LV doors closed. Remove the L1 socket cover, plug on the LRM-ST indicator (Siemens 8DX1620), read, refit the cover. Repeat L2, L3. Flashing or steady light = NOT isolated; no light = isolated.',
      'CAPDIS-S2+ symbols: A0 no voltage · A1 voltage present · A2 no voltage / no auxiliary supply · A3 L1 failure · A4 non-operational voltage · A5 test passed · A6 test failed · A7 overvoltage · A8 error.',
      'Before a high-voltage test: short-circuit the capacitive indicators and CT secondaries, disconnect VTs and surge arresters; reset afterwards.',
    ],
  },
  {
    id: 'contacts', phase: 'Service', title: 'Breaker contact arms and tulips', view: 'side', ex: 0, truck: 'out', row: false, focus: ['breaker'], joints: ['cbArm', 'cbTulip'], cut: true,
    body: [
      'Pole centre distance 150 / 160 / 210 / 275 mm; terminal distance (upper to lower) 205 / 275 / 310 mm. Contact arms Ø 40 mm (≤ 1250 A, with contact arm adapter) or Ø 60 mm. Tulip: 13 fingers (≤ 1250 A) or 26 fingers.',
      'Terminal thread M12 for 800–1250 A, M16 for 2000–2500 A. Grease the screw-in section of the threaded rod with Vaseline and screw it in: upper terminal 20 ±1 mm, lower 28 ±1 mm (38 ±1 mm at 40 kA).',
      'Tighten threaded rods and contact systems to 40 ±4 Nm (M12) or 100 ±10 Nm (M16), greased threads. Counter-hold nuts.',
      'Arm end faces: copper roughened, cleaned, Vaseline; silver-plated faces cleaned, Vaseline. Contact fingers: Molykote Longterm 2 on both sides, round outer edge of the contact system towards the arm.',
      'Mechanism: maintenance-free up to 10 000 operating cycles (M2, E2, C2); clean with a moist cloth and mild detergent. Option M30: 30 000 cycles with maintenance.',
    ],
    warn: 'Different rule from the panel: breaker contact-arm threads are greased (40 Nm M12), panel busbar threads stay dry (70 Nm M12).',
  },
  {
    id: 'maint', phase: 'Service', title: 'Inspection and maintenance', view: 'iso', ex: 0.25, truck: 'out', row: false, focus: ['prc', 'shutterMech', 'shelf', 'bushU', 'bushL', 'esw'],
    body: [
      'Every year (or at the operator\'s discretion): paint damage on doors, end and rear walls; dust on the PRC ventilation grids and the fan box (vacuum, do not damage grids); condensation in every 3rd switching-device compartment; partial-discharge noise; accessories complete.',
      'Every 10 years or after events (short circuit, earthing switch making, cycles reached): clean with vacuum and dry lint-free cloth, never compressed air. Re-grease guide rails (ISOFLEX TOPAS L 32), shutter linkage cleaned with WD-40 on a cloth, fixed contacts of earthing switch and bushings (Longterm 2 plus).',
      'Overpressure monitors: test unit on the tube connector, must trip between 8 and 12 on the manometer.',
      'Heaters: 125 Ω ±10 % (110 V AC) or 500 Ω ±10 % (230–240 V AC) wire resistors; thermostat −20 … +80 °C or electronic hygrostat, factory set ≈ 30 °C / ≈ 70 % RH.',
      'Forced-ventilation fan: replace before 40 000 h.',
    ],
  },
];

export const TROUBLE = [
  ['Withdrawable part does not go fully in', 'Earthing-switch coupling on part and panel not aligned (set both pins vertical)'],
  ['HV door will not close', 'LV connector not plugged on'],
  ['HV door will not open', 'Part in service position'],
  ['Earthing-switch opening will not open', 'Racking crank still inserted'],
  ['Earthing lever will not insert', 'Part in service position'],
  ['Racking key goes in but will not turn', 'Earthing switch CLOSED or HV door open'],
  ['Breaker will not close', 'Crank inserted, intermediate position, spring not charged, or undervoltage release not energised'],
  ['Motor racking stopped (fault)', 'Finish racking by hand (resets fault) or switch auxiliary voltage off/on; > 65 s without end position raises a fault'],
];

export const CB_DATA = [
  ['Shown here', 'SION 3AE5, 12 kV, 1250 A, 31.5 kA, 3 s, pole centres 210 mm, terminals 275 mm apart (example rating plate 3AE5123-2, 80 kg)'],
  ['Insulation', 'Ud 28 kV (42 kV on request; plate example 42 kV), Up 75 kV (95 kV on request; plate example 95 kV), up to 1000 m; above: Ka = e^((H − 1000)/8150)'],
  ['Range of the type', '7.2–24 kV, 800–3150 A (4000 A with forced cooling), 16–40 kA; pole centres 150 / 160 / 210 / 275 mm, terminals 205 / 275 / 310 mm'],
  ['Operating sequence', 'O – 0.3 s – CO – 15 s – CO'],
  ['Classes', 'E2, C2, M2 (IEC 62271-100); 10 000 cycles maintenance-free, 30 000 with Siemens maintenance'],
  ['Mounting', 'Upright only (interrupters vertical), indoors; fixed or on a truck / cassette'],
  ['Cassette "Heavy Duty" / "Standard"', 'travel 220 mm (option 180 / 200 mm) / 200 mm up to 17.5 kV; 260 mm at 24 kV; cassette position switches -S1.5 … -S1.8 test, -S1.0 … -S1.3 service'],
  ['Environment', 'IEC 60721-3-3 classes 3K4, 3B1, 3M2, 3C2 (3C3 with D20), 3S2; -5 … +55 °C (-25 °C with A40); humidity 95 % (24 h mean), 90 % (month)'],
  ['Materials', 'steel, copper and aluminium (partly silver-plated), brass, chrome; epoxy, polyester, polyamide, polycarbonate, ABS-PC, silicone, rubber; ceramic; lubricants'],
];

export const PANEL_TYPES = [
  ['Disconnecting panel', 'Withdrawable disconnector link (pull handle, contact arms with tulips, racking mechanism) instead of the breaker. Same racking as the CB panel; never rack under load, get control-room authorisation. Racking padlocked, solenoid optional.'],
  ['Metering panel', 'Withdrawable metering part with VTs, no earthing switch. Switch the MCBs on the part off before unplugging. Fuses 7.2ABWNA 3.15 A 142 mm (7.2 kV), 12ABCNA 3.15 A 195 mm (12 kV), 17.5CAV2 2 A 220 mm (17.5 kV, with insulating covers on plastic M8x12).'],
  ['Busbar current metering', 'L1 and L3 busbars bolted straight onto the CTs, L2 via a feeder bar (M12x40 / x60 / x80 by rating, bags 110-1827.3 / -1828.3 / -1829.3). HV door held by 6 hex socket bolts, key 6, ≈ 20 Nm.'],
  ['Contactor 435 mm (3TM3, ≤ 12 kV)', 'Contactor truck with HV HRC fuses SIBA HHM e = 442 (7.2 kV 50–315 A, 12 kV 50–160 A), striker to the operating side. LV connector couples automatically, no coding. Busbars must be fitted from the side. Padlock the left busbar shutter mechanism as soon as the truck is out.'],
  ['Contactor 600 mm (3TL8, 7.2 kV)', 'Truck with locking bracket, 1 fuse per phase 50–315 A or 2 per phase 160/200/250 A, striker to the lower clamp, reset trip lever to "I". Control transformer fuses 7.2ABWNA 3.15 A 142 mm.'],
  ['Switch-disconnector (L-TRI 5F)', 'LSC 2A, insulating shutter (PI). Door: key 90°. Switch-fuse 90° with the slide down; earthing switch 90° with the slide up. Fuses SIBA e = 442 striker up (7.2 kV 20–80 A, 12 kV 16–80 A, 17.5 kV 6.3–80 A). Main blade to notch ≥ 0.1 mm.'],
  ['Removable VTs', 'Separate door (3 hex socket bolts ≈ 20 Nm), racking tool: guide pin right, 90° CCW unlock, push to service, 90° CW lock. Fuses 2 A 192 mm (SIBA 3000211.2 / 3011911.2 / 3017911.2 for 7.2 / 12 / 17.5 kV). Replace all fuses together.'],
];
