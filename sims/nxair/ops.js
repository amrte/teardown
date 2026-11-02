// Operation, service and breaker-level data. Sources: O = NXAIR Operating Instructions 110-0134.9 rev. 14;
// CB = Siemens Operating Instructions vacuum circuit-breaker 3AE (SION) 9229 0001 176 0E (07.2013);
// HG = catalog HG 11.02 · 2020 (SION 3AE5). Page numbers are the printed pages.

export const CB_DOCS = [
  {k: 'CB', t: 'Operating Instructions vacuum circuit-breaker 3AE1 / SION 3AE5', no: '9229 0001 176 0E', rev: '07.2013 (EN)', url: 'https://cache.industry.siemens.com/dl/files/302/106325302/att_3120/v1/BA_3AE_Vakuum_Leistungsschalter_SION_EN_201409231052218953.pdf'},
  {k: 'HG', t: 'Catalog HG 11.02 SION vacuum circuit-breakers', no: 'HG 11.02', rev: 'Edition 2020', url: 'https://cache.industry.siemens.com/dl/files/074/109778074/att_1021110/v1/HG_11_02_2020_EN_202004281238152516.pdf'},
];

// Joints on the breaker itself. Note the different rule: the 3AE manual gives torques for GREASED threads, the
// NXAIR busbar joints are tightened DRY.
export const CB_JOINTS = [
  {id: 'cbArm', group: 'Circuit-breaker 3AE', where: 'Threaded rod of the contact arm into the breaker terminal (upper + lower, 3 poles)', qty: '6', bolt: 'Threaded rod M12 (800–1250 A) or M16 (2000–2500 A), screw-in depth upper 20 ±1 mm, lower 28 ±1 mm (38 ±1 mm at 40 kA)', wash: 'Screw-in section greased with Vaseline', t: 40, c: null, tol: '±4 (M12) · M16: 100 ±10', basis: 'step', ref: 'CB p.52–53 Fig. 97/100', part: 'breaker', size: 'M12', note: 'Greased threads only. This is the breaker manufacturer\'s value; it is NOT the 70 Nm dry value for the panel busbars.'},
  {id: 'cbTulip', group: 'Circuit-breaker 3AE', where: 'Contact system (tulip) onto the contact arm', qty: '6', bolt: 'M12 or M16 on the threaded rod', wash: 'Round outer edge of the contact system towards the contact arm. Ø 40 mm arms (≤ 1250 A) use the contact arm adapter', t: 40, c: null, tol: '±4 (M12) · M16: 100 ±10', basis: 'step', ref: 'CB p.54–55 Fig. 102–105', part: 'breaker', size: 'M12', note: 'Grease the contact fingers with Molykote Longterm 2 on both sides. Arm end faces: copper roughened, cleaned, Vaseline; silver-plated faces cleaned, Vaseline.'},
  {id: 'cbEarth', group: 'Circuit-breaker 3AE', where: 'Earth terminal of the breaker (item 70)', qty: '1', bolt: 'Hexagon screw M12 with washer', wash: 'Ring terminal of the earth wire', t: 70, c: null, basis: 'step', ref: 'CB p.47 Fig. 85/86', size: 'M12', note: 'Earth conductor sized for 30 A with ≤ 3 V drop. Not needed when bolted to an earthed frame with serrated washers.'},
  {id: 'cbFix', group: 'Circuit-breaker 3AE', where: 'Fixed-mounted breaker to its mounting surface / cartridge (from below)', qty: '4', bolt: 'M10, property class 8.8', wash: '—', t: 40, c: null, tol: '±4', basis: 'step', ref: 'CB p.45 Fig. 80/81', size: 'M10', note: 'Greased threads. Factory-assembled on the NXAIR withdrawable part; listed for completeness.'},
  {id: 'cbBracket', group: 'Circuit-breaker 3AE', where: 'Mounting brackets / guard plate (3AE5)', qty: 'per bracket', bolt: 'from accessories pack', wash: '—', t: 20, c: null, tol: '±2', basis: 'step', ref: 'CB p.46 Fig. 82–84', size: 'M8'},
  {id: 'cbCover', group: 'Circuit-breaker 3AE', where: '3AE1 cover and side panels', qty: '4 each', bolt: 'Phillips pan-head screws ISO 7045, driver size 3', wash: '—', t: 4, c: null, tol: '±0.4', basis: 'step', ref: 'CB p.41–42', size: '—'},
  {id: 'cbPG', group: 'Circuit-breaker 3AE', where: 'PG fitting supporting plate (version without LV plug)', qty: 'per plate', bolt: 'Self-tapping screws, Torx 20, single use only', wash: '—', t: 3, c: null, tol: '±0.3', basis: 'step', ref: 'CB p.42', size: '—'},
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
    id: 'switch', phase: 'Operate', title: 'Close, open, charge, discharge', view: 'front', ex: 0, truck: 'service', row: false, focus: ['mech', 'hvdoor'],
    body: [
      'Electrical close: breaker in test or service, OPEN, spring CHARGED, door closed, auxiliary voltage on, local/remote selected, undervoltage release (if any) energised. The motor recharges at once; the opening spring is charged during closing. Indicator 0 → I, counter + 1.',
      'Manual close / open: LOCAL, swing the opening cover aside with the rotary button, insert the push rod, press ON (or OFF) until the switching noise, remove the rod, padlock.',
      'Manual charging: auxiliary voltage off, spring DISCHARGED. Hand crank on the shaft, hold the freewheel, ≈ 50 turns clockwise until CHARGED. Never leave the crank in; racking with it inserted damages the breaker. The motor charges in < 15 s.',
      'Discharge before work: test position, LOCAL, auxiliary voltage OFF, then OPEN – CLOSE – OPEN with the push rod.',
      '3AE5: never press CLOSE and OPEN together; the manual warns of irreversible damage.',
    ],
  },
  {
    id: 'earthing', phase: 'Operate', title: 'Earth and de-earth the feeder', view: 'door', ex: 0, truck: 'test', esw: 0, row: false, focus: ['esw', 'doorCtl'], drill: 'esw',
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
    id: 'remove', phase: 'Service', title: 'Take the breaker out and put it back', view: 'iso', ex: 0, truck: 'out', row: false, focus: ['serviceTruck', 'truck'],
    body: [
      'Out: service truck for this panel width, breaker in test, spring discharged, HV door open, LV connector stowed. 1 Centre the truck. 2 Push the left and right locking elements into the frame openings, rails aligned; set the height with the 2 setting wheels. 3 Pull back to check it is latched (click). 4 Turn the 2 breaker locking levers 90° outward. 5 Pull the breaker onto the truck by its handles to the end stop. 6 Levers inward. 7 Pull the 2 unlocking levers up. 8 Wheel away slowly on a dry, flat floor.',
      'In: same coding, earthing-switch coupling pin vertical on the breaker and in the compartment (turn with the lever if needed), spring discharged, auxiliary voltage off. Dock and check the truck, levers outward, pull out the truck unlocking handle and hold it, push the breaker in to the stop, pull the unlocking levers up, pull the truck back, turn the breaker levers inward until both latch, plug the LV connector on, close the door, auxiliary voltage on.',
      'Truck-type version: levers outward, lift the locking bracket into its retaining hook, pull the truck out by its handles. In: rollers onto the guide rails, push to the stop, lift the hook, pull the bracket fully down until it snaps (LOCKED), levers inward. Never lock the bracket with the truck only part-way in.',
      'Service truck: move only empty or with the part latched; operate from the operating side; park with the rear against a wall.',
    ],
  },
  {
    id: 'shutterOps', phase: 'Service', title: 'Open shutters, fit the earthing device', view: 'iso', ex: 0, truck: 'out', row: false, focus: ['shutters', 'shutterMech', 'bushU', 'bushL'],
    body: [
      'Upper (busbar) shutter = left mechanism, lever L. Lower (feeder) shutter = right mechanism, lever R. Padlock the other mechanism unless both must be open.',
      'Preconditions: withdrawable part removed, door open, LV connector stowed, isolated, earthed, verified dead, PPE. Work the lever from outside the panel by its handle; never put hands into the mechanism or push a shutter.',
      'Busbar shutter: padlock the right mechanism, fit lever L, push the handle down to the stop (it latches, shutter open). To close: push the handle slightly right, let it slip up, remove the lever, remove the padlock.',
      'Earthing device (600 mm: Ø 40 mm contacts, ≤ 1000 A; 800 mm: Ø 60 mm, 1250 A; max. 25 kA 1 s): inspect the copper wires (no brown discoloration or stiffness) and the tulip bolts. Bolt the earthing clamp to the earthing point hand-tight ≈ 20 Nm BEFORE opening a shutter.',
      'Open one shutter, couple the rod (both hands inside the limiting ring), push the earthing tulip onto the CENTRAL contact first, turn clockwise at the cross lever, pull the rod off; then the outer two. Expect a small static discharge. Removal in reverse, clamp last.',
    ],
  },
  {
    id: 'isolate', phase: 'Operate', title: 'Verify safe isolation', view: 'front', ex: 0, truck: 'test', row: false, focus: ['lv'],
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
  ['Types in NXAIR', '3AE1 (40 kA) and SION 3AE5, withdrawable on a cartridge / truck'],
  ['Classes', 'C2 · E2 · M2 · S1; 10 000 cycles maintenance-free (M30 option: 30 000 with maintenance)'],
  ['Operating sequence', 'O – 0.3 s – CO – 3 min – CO (also O – 3 min – CO – 3 min – CO, O – 0.3 s – CO – 15 s – CO)'],
  ['Times (manual)', 'closing < 75 ms · opening < 65 ms (1st shunt) · arcing < 15 ms · break < 80 ms · pole synchronism ≤ 2 ms'],
  ['Spring charging', 'motor < 15 s; by hand ≈ 50 turns (NXAIR O §10.15)'],
  ['Motor', '3AE5 100–200 W/VA · 3AE1 470–960 W/VA'],
  ['Pole centres / terminal distance', '150 · 160 · 210 · 275 mm / 205 · 275 · 310 mm (≥ 2000 A and 40 kA: 310 mm)'],
  ['Contact arms / tulips', 'Ø 40 mm with adapter (≤ 1250 A) or Ø 60 mm; 13 or 26 fingers'],
  ['Racking travel', '180 / 200 / 220 mm (≤ 17.5 kV), 260 mm (24 kV)'],
  ['Mechanism parts', 'closing spring, opening / contact-pressure springs, motor 3AY1711, gear unit, closing solenoid -Y9, 1st shunt release -Y1, 2nd release -Y2 3AX1101, c.t.-operated release 3AX1102/1104, undervoltage release -Y7 3AX1103, auxiliary switch 3SV9273 (6 NO + 6 NC) / 3SV9274, anti-pumping relay -K1, operations counter, 64-pin LV plug -X0'],
  ['Kinematics', 'Motor charges the closing spring through the gear unit until it latches (-S21/-S22 cut the motor). CLOSE releases it; while closing it charges the opening and contact-pressure springs through the insulating operating rods. The motor then recharges, so O–C–O is stored. Trip-free, mechanical + electrical anti-pumping.'],
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
