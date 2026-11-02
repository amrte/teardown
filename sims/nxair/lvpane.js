// LV tab: low-voltage compartment + SIPROTEC 5 example. Data and HTML for the rail; app.js wires the events.
//
// Sources: NXAIR catalog HA 25.73 p. 30–31 (LV compartment, arc protection), NXAIR installation instructions
// 110-0084.9 (I §5.11 EMC, §7.9 LV bolting, §10.12–10.13 control cables and bus wires, installation report),
// 3AE operating instructions 9229 0001 176 0E Fig. 59–63 (64-pole plug -X0 sample circuit diagrams), SIPROTEC 5
// hardware manual C53000-G5040-C002-Q (dimensions, terminals, torques, PS101 / IO102 terminal diagrams, earthing),
// SIPROTEC 5 manuals for trip-circuit supervision (principle with 1 and 2 binary inputs).

export const LV_DOCS = [
  {k: 'S5H', t: 'SIPROTEC 5 Hardware Description, Manual', no: 'C53000-G5040-C002-Q', rev: 'Edition 09.2022', url: 'https://cache.industry.siemens.com/dl/files/193/109742193/att_1119486/v1/SIP5_Hardware_V09.31_Manual_C002-Q_en.pdf'},
  {k: 'S5O', t: 'SIPROTEC 5 Operation, Manual', no: 'C53000-G5040-C003-G', rev: 'Edition 11.2021', url: 'https://cache.industry.siemens.com/dl/files/321/109742321/att_1089364/v1/SIP5_Operating_V08.83_Manual_C003-G_en.pdf'},
  {k: 'S5C', t: 'SIPROTEC 5 Catalog (7SJ82 functions, variants, connection diagrams)', no: 'V8.4', rev: 'Edition 7', url: 'https://assets.new.siemens.com/siemens/assets/api/uuid:279cb01d-fd3b-4df4-8e04-f1fe98b81d6b/SIPROTEC-5-Catalog-EN.pdf'},
  {k: 'S5F', t: 'SIPROTEC 5 7SY82 Manual (same SIPROTEC 5 text for trip-circuit supervision and CB control)', no: 'C53000-G5040-C608-1', rev: 'Edition 10.2023', url: 'https://cache.industry.siemens.com/dl/files/959/109818959/att_1156862/v1/SIP5_7SY82_V09.60_Manual_C608-1_en.pdf'},
];

// 7SJ82 function scope (catalog Table 2.4/3, selection) and what it is used for on a cable feeder
export const FUNCS = [
  ['50 / 51', 'Phase overcurrent, definite and inverse time (several stages, 50HS high-speed, SOTF)', 'Main feeder protection, graded with the incomer'],
  ['50N / 51N', 'Earth overcurrent (residual or measured on I4)', 'Earth faults in solidly / resistance-earthed networks'],
  ['50Ns / 51Ns, 67Ns', 'Sensitive earth fault on I4 (cos φ / sin φ, transient, admittance, harmonic), intermittent earth fault', 'Isolated or compensated networks, with the core-balance CT'],
  ['67 / 67N', 'Directional overcurrent, phase and earth', 'Ring or parallel feeders'],
  ['46', 'Negative-sequence overcurrent', 'Unbalance, broken conductor'],
  ['49', 'Thermal overload (thermal replica)', 'Cable thermal limit'],
  ['27 / 59, 59N, 47', 'Under / overvoltage, residual voltage, phase sequence', 'With VTs: voltage protection, earth-fault detection'],
  ['81, 81U', 'Frequency, under-frequency load shedding', 'Load shedding schemes'],
  ['37, 32', 'Undercurrent, directional power', 'Special feeders, generators'],
  ['25', 'Synchrocheck', 'With busbar voltage on V4'],
  ['50BF', 'Circuit-breaker failure', 'Trips the upstream breaker if the feeder breaker does not open'],
  ['79', 'Automatic reclosing (3-pole)', 'Overhead lines; usually off on cable feeders'],
  ['74TC', 'Trip-circuit supervision (1 or 2 binary inputs)', 'Monitors -Y1, its wiring and the supply'],
  ['86', 'Lockout', 'Blocks closing after a trip until reset'],
  ['—', 'Arc protection (with plug-in module ARC-CD-3FO), fault locator, CB wear monitoring, fault recording, PQ-basic measurements', 'Arc detection in NXAIR: 3 sensors, cleared within 100 ms'],
  ['—', 'Control of the breaker and disconnector / earthing-switch objects, SBO, interlocking in CFC', 'Local (Ctrl, I, O) and remote control with feedback monitoring'],
];

// illustrative settings for a cable feeder (not from Siemens; depends on the network study)
export const SETTINGS = [
  ['51 phase, inverse', 'CT 400/1 A, load 300 A: I> = 360 A prim. (0.90 A sec.), IEC normal inverse, TMS 0.10', '120 % of maximum load; 0.3 s grading margin to the downstream device'],
  ['50 phase, definite', 'I>> = 2400 A prim. (6.0 A sec.), 0.05 s', 'Fast clearing of close-in faults; above the through-fault and inrush of the downstream transformer'],
  ['50N / 51N earth', 'IE> = 80 A prim. (0.20 A sec.), 0.5 s', 'Above the CT residual error and the cable charging current'],
  ['67Ns sensitive earth', 'Core-balance CT 60/1 A: 3I0 > 6 A prim., cos φ method, 1.0 s', 'Compensated network: earth-fault direction'],
  ['49 thermal', 'k = 1.1 × cable rating, τ from the cable data', 'Protects the cable against overload'],
  ['50BF', 'Current flag 0.1 × In, retrip 0.05 s, upstream trip 0.15 s', 'Breaker opening time < 65 ms + reset margin'],
  ['74TC (1 BI)', 'Alarm delay 300 s (Siemens recommendation for 1 BI; 2 s with 2 BIs)', 'Long delay rides through switching operations'],
  ['Reverse interlocking', 'Pickup of 51 → BO 1.5 → incomer: blocks its fast 50 stage (e.g. 0.1 s)', 'Fast busbar protection without a busbar-protection relay'],
  ['79', 'Off', 'Cable faults are permanent'],
];

// guided views for the 3D model: door state, explode, focus, camera
export const LV_TOUR = [
  {t: 'Door closed: the operator side', door: 0, ex: 0, glass: false, focus: ['relay', 'lrm'], view: 'front', text: 'The protection device is flush-mounted in the LV door, the voltage detecting sockets L1–L3 sit below it, the lock on the right takes the 3 mm double-bit key. Everything the operator reads or presses is on this door.'},
  {t: 'SIPROTEC 5 on-site operation panel', door: 0, ex: 0, glass: false, focus: [], view: 'relay', text: 'RUN / ERROR LEDs, 16 configurable two-colour LEDs with label strip, large display, softkeys and navigation keys, numeric keypad with function keys F1–F9, Ctrl, I (CLOSE) and O (OPEN), USB-B service port for DIGSI 5.'},
  {t: 'Open the door: device rear and door loom', door: 1, ex: 0, focus: ['relayTerm', 'loom'], view: 'relayRear', text: 'Behind the door: the 1/3 × 19" housing (163 mm + 34 mm terminals), plug-in terminal blocks A (CT), B and D (VT, binary I/O), L (power supply), plug-in module positions E / F, Ethernet J, protective earth. The flexible door loom runs to the hinge.'},
  {t: 'Pull the terminal blocks', door: 1, ex: 0.6, focus: ['relayTerm', 'relay'], view: 'relayRear', text: 'Terminal blocks are held by spring clips: bend the clips outwards and pull the wired blocks off the rear plate; the device can then be taken out to the front after removing the 4 screw covers and M4 screws. The current terminal shorts the CT circuits when pulled; still short them on -X2 first.'},
  {t: 'Mounting plate: MCBs, relays, terminal strips', door: 1, ex: 0, focus: ['mcb', 'auxDev', 'terms', 'lvPlate'], view: 'inside', text: 'Three DIN-rail rows with slotted ducts: top row climate control and interposing relays, middle row the MCBs (supply, control, motor, heater, VT MCBs), bottom row terminal strips -X1 / -X2 / -X3 with the shield bar below.'},
  {t: 'Where the wires come in', door: 1, ex: 0.5, focus: ['plugs', 'busWire', 'socket'], view: 'iso', text: 'From below: 10-pole coded plug connections for the withdrawable-part and panel wiring, the customer cable grommet over the wiring duct (left), and under the floor the 64-pole socket for the breaker plug. At the sides: bus-wire plug connectors to the neighbour panels.'},
];

// the operating elements of the front panel (hardware manual Fig. 2-1, on-site operation panel with large display)
export const FRONT = [
  ['RUN (green) / ERROR (red)', 'Device ready / device fault. ERROR lit = protection may be blocked: check the life contact alarm.'],
  ['16 LEDs, two-colour', 'Freely assigned in DIGSI 5 (pickup, trip, CB position, alarms), latched or unlatched; text on the label strip next to them.'],
  ['Large display', 'Menus, measured values, fault records, and the control display with the feeder mimic.'],
  ['Softkeys + navigation keys', 'Context functions shown at the bottom of the display; arrows move through the menus.'],
  ['LED test / reset key', 'Tests all LEDs, resets latched LEDs and the latched trip indication.'],
  ['Keypad 0–9 with F1–F9, Fn', 'Numbers and passwords; with Fn the keys act as function keys F1–F9 (e.g. local/remote, display pages).'],
  ['Ctrl, I, O', 'Ctrl opens control; select the switching device, then I = CLOSE, O = OPEN and confirm. Switching authority (local / remote) and interlocking conditions are checked by the device.'],
  ['USB type B', 'Service port for DIGSI 5 (settings, fault records, firmware). Keep the cover closed in service.'],
];

// example I/O allocation, 7SJ82 with PS101 + IO102 (terminal numbers from the hardware manual / catalog)
export const IO = [
  ['Analog', 'I1 / I2 / I3', 'A1–A2 / A3–A4 / A5–A6', 'Phase CTs L1 / L2 / L3 via -X2 test terminals (e.g. 400/1 A 5P20)'],
  ['Analog', 'I4', 'A7–A8', 'Earth current from the core-balance CT around the cables (sensitive earth-fault detection)'],
  ['Analog', 'V1 / V2 / V3', 'B1 / B3 / B4, common B2', 'Phase-earth VT voltages via -F11 and -X3 (feeder VT option, or busbar VT on bus wires)'],
  ['Analog', 'V4', 'B5–B6', 'Open-delta voltage via -F12 (directional earth fault)'],
  ['Supply', 'L+ / L−', 'L1 / L2', 'Auxiliary voltage via -F01 (Siemens: 6 A, characteristic C; inrush ≤ 18 A; 7 W)'],
  ['BI 1.1 (isolated)', 'Trip-circuit supervision', 'D4–D6', 'Across the trip contact BO 1.1; 1-input scheme with resistor R (see diagram)'],
  ['BI 1.2', 'CB closed', 'D7 (common D14)', '3AE auxiliary switch -S1 53-54, -X0:C8 → D9'],
  ['BI 1.3', 'CB open', 'D8', '-S1 51-52, -X0:C8 → D8'],
  ['BI 1.4', 'Truck in service position', 'D9', 'Panel position switch (tag per order)'],
  ['BI 1.5', 'Truck in test position', 'D10', 'Panel position switch'],
  ['BI 1.6', 'Feeder earthing switch closed', 'D11', 'Earthing-switch auxiliary switch'],
  ['BI 1.7', 'VT MCB tripped', 'D12', 'Auxiliary contact of -F11: blocks voltage-dependent functions'],
  ['BI 1.8', 'Closing spring charged', 'D13', 'Breaker switch -S4 (pins on the order diagram)'],
  ['BI 2.1–2.3', 'External trip, MCB tripped, reverse interlocking in', 'L12 / L14 / L13, common L11', 'Examples'],
  ['BO 1.1 (NO)', 'TRIP', 'B8–B7', '→ -X0:C2 → -S1 23-24 → 1st shunt release -Y1 → -X0:D2'],
  ['BO 1.2 (change-over)', 'CLOSE', 'B10 → B11 (NO)', '→ -X0:A2 → -S1 11-12, -K1 anti-pumping → closing solenoid -Y9 → -X0:B2'],
  ['BO 1.3 (change-over)', 'TRIP 2', 'B13 → B14 (NO)', '→ 2nd shunt release -Y2 via -X0:A3 / B3, if fitted'],
  ['BO 1.4–1.6 (NO)', 'Alarms / signals', 'D1 / D3 / D5, common D2', 'Protection trip, pickup to the incomer (reverse interlocking), general alarm'],
  ['BO 2.1 (NO)', 'Breaker failure', 'L4–L3', 'Trip to the upstream breaker (50BF)'],
  ['BO 2.2 (change-over)', 'Spare', 'L5 → L6 / L8', ''],
  ['Life contact', 'Device ready', 'L10 → L9 (NO) / L7 (NC)', 'NC closes on device fault or loss of supply → alarm'],
];

// the breaker's 64-pole plug -X0: pins from the 3AE sample circuit diagrams (Fig. 59–63, non-binding examples)
export const X0 = [
  ['Motor -M1 (spring charging)', 'A1 → -S21 21-22 → M1 → -S22 21-22 → D16', 'S21/S22 switch the motor off when the spring is charged'],
  ['Closing solenoid -Y9 + anti-pumping', 'A2 → -S1 11-12 → -K1 21-22, 31-32 → -Y9 → -S12 13-14 → B2', '-K1 picks up via -S3 21-22 and holds via 13-14 (anti-pumping); -S12 only with mechanical closing lock'],
  ['1st shunt release -Y1', 'C2 → -S1 23-24 → -Y1 → D2', 'C3 = monitoring point between -S1 and -Y1 (trip-circuit supervision)'],
  ['2nd shunt release -Y2', 'A3 → -S1 33-34 → -Y2 → B3', 'D3 = monitoring point'],
  ['C.t.-operated release -Y4', 'A4 → B4', ''],
  ['Low-energy release -Y6', 'C4 → D4', ''],
  ['Undervoltage release -Y7', 'C5 → D1 · D2 → -R1 → B5; -S1 43-44 at D5', 'Tripping via NC or NO contact, see Fig. 63'],
  ['Electrical closing lock-out -F1 (3AE1)', 'A5 → -X1:2 → F1 → -X1:3 → B1', 'Optional'],
  ['CB tripping signal -S6', 'A7 → -S6 13-14 → B7', 'Fleeting contact on a release trip'],
  ['Heater -R01 230 V AC', '-X1:26 → R01 → -X1:27', ''],
  ['Free contacts of -S1 (6 NO + 6 NC)', '31-32 C7/D7 · 41-42 A8/B8 · 51-52 C8/D8 · 53-54 C8/D9 · 61-62 A9/B9 · 63-64 A9/C9', '33-34 (A3/B3) is used by -Y2, 43-44 (D5/C5) by -Y7 when fitted'],
  ['Extended -S1 (12 NO + 12 NC)', '71-72 A10/B10 · 73-74 C10/D10 · 81-82 A11/B11 · 83-84 C11/D11 · 93-94 A12/B12 · 103-104 C12/D12 · 113-114 A13/B13', ''],
];

// fasteners and terminals in the LV compartment (same row format as the torque table)
export const LV_JOINTS = [
  {id: 'lvBolt', where: 'LV compartment to the neighbour LV compartment', qty: '3 (630 mm) or 5 (980 mm)', bolt: 'M8x20', wash: 'Contact washers + nuts', t: 30, c: 25, basis: 'check', ref: 'I §7.9 Fig. 112', size: 'M8'},
  {id: 'sCur', where: 'SIPROTEC current terminal A (CT circuits)', qty: '8 points, ≤ 2 conductors each', bolt: 'Clamping screw, ring lug D 5.0 / W 9.5 mm, insulated (e.g. PIDG)', wash: 'Stranded 2.0–4.0 mm² with ring lug or ferrule (L 10 / 12 mm), strip 15 mm', t: 2.7, c: null, tol: 'solid 2 mm²: 2.0', basis: 'step', ref: 'S5H §5.7.2, Table 6.13', size: '—', note: 'Copper only, ≥ 105 °C insulation. Solid or ferruled conductors enter from the side of the clamp, never from the centre. Tool speed ≤ 640 rpm.'},
  {id: 'sVolt', where: 'SIPROTEC voltage terminals B, D, L (spring-clip type: VT, binary I/O, supply)', qty: '14 per block', bolt: 'Clamping screw, PZ1 or 4.0 × 0.8 slotted driver', wash: '0.5–2.5 mm², ferrule L 12 mm or strip 12 mm; twin ferrules for 2 wires', t: 1.0, c: null, basis: 'step', ref: 'S5H §5.7.3.1, Table 6.13', size: '—', note: 'No ring lugs. 2.5 mm² for currents of 5–10 A.'},
  {id: 'sScrew', where: 'SIPROTEC screw-type terminals (IO110, IO111, PS203 …), if fitted', qty: '—', bolt: 'Phoenix screw terminal', wash: '0.5–2.5 mm²', t: 0.6, c: null, basis: 'step', ref: 'S5H §5.7.3.2', size: '—'},
  {id: 'sFix', where: 'SIPROTEC housing into the door cut-out', qty: '4', bolt: 'M4 oval-head screws (4 mm shank), PZ2 driver, behind the plastic screw covers', wash: 'Cut-out 146+2 × 245+1 mm; 4 × M4 holes for the device screws (255.8 mm apart vertically), 4 × Ø 6 openings for the operation-panel screws', t: 1.2, c: null, basis: 'step', ref: 'S5H Fig. 6-1 · S5O p. 45', size: '—', note: 'Mount vertically only. Installation depth ≥ 275 mm.'},
  {id: 'sPE', where: 'SIPROTEC protective earth terminal', qty: '1 per module', bolt: 'M4 (grounding area ≥ M4)', wash: '≥ 4.0 mm² copper to the panel earth / shield bar', t: 1.2, c: null, ref_t: '≥ 1.2', basis: 'step', ref: 'S5H §5.4 grounding', size: '—', note: 'Protection class I: earth before switching on.'},
  {id: 'mcbT', where: 'MCBs, terminal strips, relays on the DIN rails', qty: '—', bolt: 'Device terminal screws', wash: '—', t: null, c: null, ref_t: 'see device', basis: 'maker', ref: 'Maker of the device (printed on the device)', size: '—'},
];

// the NXAIR installation report items that concern the LV compartment and the protection
export const CHECKS = [
  ['3.1', 'Bus wire plug connector appropriately latched or wired to terminal strip?'],
  ['3.2', 'Jamming of wires and protective tubes avoided?'],
  ['3.3', 'Wire markings and terminal designation labels complete?'],
  ['3.4', 'Damping resistor for earth-fault winding installed and connected?'],
  ['3.5', 'Can the low-voltage door be opened and closed easily?'],
  ['3.6', 'High-voltage and low-voltage doors flush?'],
  ['3.7', 'Low-voltage compartment cleaned?'],
  ['3.8', 'Firmware of protection devices updated?'],
  ['8.1 / 8.2', 'Alarm signalling tested: terminal strip, MCB trip, VT MCB trip, circuit-breaker trip'],
  ['9.1–9.5', 'CT secondary windings earthed; jumpers on CT terminal strips in correct position; unused windings short-circuited; CT circuits for measurement and protection tested'],
  ['10.4–10.9', 'VT secondary windings earthed (at the terminal strip); insulation test on the non-fuse-protected wiring up to the open MCB; VT circuits tested; damping resistor in the open-delta winding'],
  ['11.1 / 11.2', 'Panel heating and LV-compartment illumination tested'],
  ['12.4', 'Documentation (switchgear and protection-device instructions, CT / VT test certificates) handed over'],
];

// ------------------------------------------------------------------------------------------------ diagrams
// Hand-drawn schematic primitives. Strokes and text use currentColor so the drawing follows the theme.
const L = (x1, y1, x2, y2, cls = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${cls ? ` class="${cls}"` : ''}/>`;
const T = (x, y, s, cls = '', anchor = 'start') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${s}</text>`;
const term = (x, y, lab, side = 1) => `<circle cx="${x}" cy="${y}" r="3.2" class="term"/>${lab ? T(x + side * 7, y + 4, lab, 'pin', side > 0 ? 'start' : 'end') : ''}`;
const no = (x, y, lab, side = 1) => `${L(x, y - 2, x, y)}${L(x, y + 20, x - 10, y + 4)}${L(x, y + 20, x, y + 22)}${lab ? T(x + side * 8, y + 15, lab, 'lab', side > 0 ? 'start' : 'end') : ''}`;
const nc = (x, y, lab, side = 1) => `${L(x, y - 2, x, y)}${L(x, y, x + 11, y)}${L(x, y + 20, x + 12, y - 1)}${L(x, y + 20, x, y + 22)}${lab ? T(x + side * (side > 0 ? 16 : 8), y + 15, lab, 'lab', side > 0 ? 'start' : 'end') : ''}`;
const coil = (x, y, lab, side = 1) => `<rect x="${x - 10}" y="${y}" width="20" height="16" class="box"/>${lab ? T(x + side * 15, y + 12, lab, 'lab', side > 0 ? 'start' : 'end') : ''}`;
const bi = (x, y, lab, side = 1) => `<rect x="${x - 8}" y="${y}" width="16" height="16" class="box"/>${L(x - 8, y + 16, x + 8, y)}${lab ? T(x + side * 13, y + 12, lab, 'lab', side > 0 ? 'start' : 'end') : ''}`;
const res = (x, y, lab, side = 1) => `<rect x="${x - 5}" y="${y}" width="10" height="24" class="box"/>${lab ? T(x + side * 11, y + 15, lab, 'lab', side > 0 ? 'start' : 'end') : ''}`;
const mcb = (x, y, lab) => `<rect x="${x - 9}" y="${y}" width="18" height="22" class="box"/>${L(x - 9, y + 22, x + 9, y)}${T(x + 14, y + 15, lab, 'lab')}`;
const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="2.6" class="dot"/>`;
const frame = (x, y, w, h, lab, cls = 'frame', at = 'top') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${cls}"/>${lab ? (at === 'top' ? T(x + 6, y + 14, lab, 'flab') : T(x + w - 6, y + h - 7, lab, 'flab', 'end')) : ''}`;

export function controlSvg() {
  const P = 36, N = 500; // L+ and L− rails
  const s = [];
  s.push(L(24, P, 806, P, 'rail'), T(24, P - 8, 'L+  (auxiliary DC, bus wire)', 'flab'), L(24, N, 806, N, 'rail'), T(24, N + 16, 'L−', 'flab'));
  // breaker frame with the 64-pole plug pins on its edges
  s.push(frame(112, 232, 600, 212, '3AE breaker, behind the 64-pole plug -X0', 'frame cb', 'bottom'));
  // a) device supply
  s.push(L(66, P, 66, 60), mcb(66, 60, '-F01'), L(66, 82, 66, 167));
  s.push(frame(40, 140, 64, 100, 'PS101'), term(66, 170, 'L1', 1), term(66, 222, 'L2', 1), L(66, 225, 66, N), dot(66, N));
  s.push(T(72, 200, '7SJ82', 'lab'));
  // b) trip with trip-circuit supervision (1 binary input + resistor R)
  const xb = 200;
  s.push(L(xb, P, xb, 60), mcb(xb, 60, '-F02'), L(xb, 82, xb, 104), dot(xb, 104), L(xb, 104, 676, 104));
  s.push(frame(152, 112, 118, 62, 'IO102'), L(xb, 104, xb, 128), no(xb, 128, 'BO 1.1  B8–B7', -1));
  s.push(L(xb, 150, xb, 186), dot(xb, 120), L(xb, 120, 246, 120), L(246, 120, 246, 128), bi(246, 128, ''), L(246, 144, 246, 162), L(246, 162, xb, 162), dot(xb, 162), T(256, 152, 'BI 1.1', 'lab'), T(256, 164, 'TCS', 'lab acc'));
  s.push(term(xb, 186, '-X1', 1), L(xb, 189, xb, 232), dot(xb, 205), L(xb, 205, 136, 205), L(136, 205, 136, 206), res(136, 206, 'R', -1), L(136, 230, 136, 232));
  s.push(term(136, 232, 'C7', -1), term(xb, 232, 'C2', 1));
  s.push(L(136, 235, 136, 252), nc(136, 252, '-S1 31-32', -1), L(136, 274, 136, 300), term(136, 300, 'D7', -1));
  s.push(L(136, 303, 136, 318), L(136, 318, xb, 318, 'jumper'), T(140, 332, 'jumper D7–C3', 'pin acc'));
  s.push(L(xb, 235, xb, 262), no(xb, 262, '-S1 23-24'), L(xb, 284, xb, 352), dot(xb, 318), term(xb + 0.01, 300, '', 1), T(xb + 8, 304, 'C3', 'pin'));
  s.push(coil(xb, 352, '-Y1 shunt release'), L(xb, 368, xb, 444), term(xb, 444, 'D2', 1), L(xb, 447, xb, N), dot(xb, N));
  // c) close with anti-pumping
  const xc = 410;
  s.push(dot(xc, 104), frame(372, 112, 104, 62, 'IO102'), L(xc, 104, xc, 128), no(xc, 128, 'BO 1.2  B10–B11'), L(xc, 150, xc, 232), term(xc, 232, 'A2', 1));
  s.push(L(xc, 235, xc, 250), nc(xc, 250, '-S1 11-12  (CB open)'), L(xc, 272, xc, 284), nc(xc, 284, '-K1 anti-pumping'), L(xc, 306, xc, 320), coil(xc, 320, '-Y9 closing solenoid'));
  s.push(L(xc, 336, xc, 358), no(xc, 358, '-S12 (mech. lock)'), L(xc, 380, xc, 444), term(xc, 444, 'B2', 1), L(xc, 447, xc, N), dot(xc, N));
  // d) motor
  const xd = 560;
  s.push(L(xd, P, xd, 60), mcb(xd, 60, '-F03'), L(xd, 82, xd, 232), term(xd, 232, 'A1', 1), L(xd, 235, xd, 252), nc(xd, 252, '-S21'), L(xd, 274, xd, 300));
  s.push(`<circle cx="${xd}" cy="312" r="12" class="box"/>`, T(xd, 316, 'M', 'lab', 'middle'), T(xd + 18, 316, '-M1', 'lab'), L(xd, 324, xd, 352), nc(xd, 352, '-S22'), L(xd, 374, xd, 444), term(xd, 444, 'D16', 1), L(xd, 447, xd, N), dot(xd, N));
  // e) CB position to binary inputs
  const xe = 676;
  s.push(dot(xe, 104), L(xe, 104, xe, 232), term(xe, 232, 'C8', 1), L(xe, 235, xe, 250), dot(xe, 250), L(xe, 250, 652, 250), L(xe, 250, 700, 250));
  s.push(L(652, 250, 652, 262), no(652, 262, '53-54', -1), L(652, 284, 652, 444), term(652, 444, 'D9', -1));
  s.push(L(700, 250, 700, 262), nc(700, 262, ''), T(708, 296, '51-52', 'lab'), L(700, 284, 700, 444), term(700, 444, 'D8', 1));
  s.push(L(652, 447, 652, 456), bi(652, 456, ''), L(652, 472, 652, N), dot(652, N), T(646, 466, 'BI 1.2', 'lab', 'end'), T(646, 478, 'CB closed', 'lab', 'end'));
  s.push(L(700, 447, 700, 456), bi(700, 456, ''), L(700, 472, 700, N), dot(700, N), T(712, 466, 'BI 1.3', 'lab'), T(712, 478, 'CB open', 'lab'));
  s.push(T(xe, 330, '-S1', 'lab', 'middle'));
  return `<svg class="sch" viewBox="0 0 820 524" role="img" aria-label="Example control circuits between the SIPROTEC 7SJ82 and the 3AE breaker">${s.join('')}</svg>`;
}

export function analogSvg() {
  const s = [];
  const xs = [56, 86, 116];
  ['L1', 'L2', 'L3'].forEach((p, i) => { s.push(L(xs[i], 22, xs[i], 300, 'prim'), T(xs[i], 16, p, 'lab', 'middle')); });
  s.push(T(14, 314, 'cable feeder (primary)', 'pin'));
  const xX = 340, xR = 560; // -X2 / -X3 terminal column, relay terminals
  // phase CTs: s1 of each phase to I1 / I2 / I3, the three s2 joined to the star point, earthed once at -X2
  const yS1 = [44, 58, 72], yStar = 90;
  xs.forEach((x, i) => {
    s.push(`<circle cx="${x}" cy="70" r="9" class="box"/>`);
    s.push(L(x + 6, 63, 150, yS1[i], 'thin'), L(x + 6, 77, 150, yStar, 'thin'));
  });
  s.push(T(150, 30, 'phase CTs, e.g. 400/1 A 5P20', 'pin'));
  yS1.forEach((y, i) => { s.push(L(150, y, xR, y), term(xX, y, ''), T(156, y - 3, `L${i + 1} s1`, 'pin'), T(xR - 6, y - 3, `A${2 * i + 1}`, 'pin', 'end')); });
  s.push(L(150, yStar, xR, yStar), term(xX, yStar, ''), T(156, yStar - 3, 's2 star', 'pin'), T(xR - 6, yStar - 3, 'A2 + A4 + A6 bridged', 'pin', 'end'));
  s.push(dot(xX - 24, yStar), L(xX - 24, yStar, xX - 24, 108), L(xX - 32, 108, xX - 16, 108), L(xX - 29, 112, xX - 19, 112), L(xX - 26, 116, xX - 22, 116), T(xX - 36, 118, 'earthed once', 'pin acc', 'end'));
  s.push(frame(xX - 12, 34, 24, 66, ''), T(xX, 128, '-X2', 'flab', 'middle'));
  // core-balance CT round the three cables -> I4
  s.push(`<ellipse cx="86" cy="160" rx="46" ry="9" class="box"/>`, L(132, 156, xR, 156), L(132, 166, xR, 166), term(xX, 156, ''), term(xX, 166, ''));
  s.push(T(150, 182, 'core-balance CT, e.g. 60/1 A', 'pin'), T(xR - 6, 153, 'A7', 'pin', 'end'), T(xR - 6, 180, 'A8', 'pin', 'end'));
  // VTs phase-earth: star secondary a-b-c-n via -F11 and -X3, open delta da-dn via -F12 with damping resistor
  xs.forEach((x) => s.push(dot(x, 214), L(x, 214, x + 10, 214), `<circle cx="${x + 16}" cy="214" r="6" class="box"/><circle cx="${x + 16}" cy="224" r="6" class="box"/>`, L(x + 16, 230, x + 16, 238)));
  s.push(L(72, 238, 132, 238), L(66, 238, 72, 238), L(66, 238, 66, 244), L(60, 244, 72, 244), L(62, 248, 70, 248));
  s.push(T(150, 204, 'VT secondaries: star a-b-c-n, open delta da-dn', 'pin'));
  const brk = (x, y, lab) => `<rect x="${x - 9}" y="${y - 8}" width="18" height="16" class="box"/>${L(x - 9, y + 8, x + 9, y - 8)}${T(x, y - 12, lab, 'lab', 'middle')}`;
  s.push(L(150, 228, 276, 228), T(156, 225, 'a b c', 'pin'), L(214, 232, 222, 224), brk(285, 228, '-F11'), L(294, 228, xR, 228), term(xX, 228, ''), T(xR - 6, 225, 'B1 / B3 / B4', 'pin', 'end'));
  s.push(L(150, 244, xR, 244), term(xX, 244, ''), T(156, 256, 'n, earthed at -X3', 'pin'), T(xR - 6, 241, 'B2', 'pin', 'end'));
  s.push(L(150, 276, 276, 276), brk(285, 276, '-F12'), L(294, 276, xR, 276), L(150, 292, xR, 292), term(xX, 276, ''), term(xX, 292, ''));
  s.push(T(156, 273, 'da', 'pin'), T(156, 304, 'dn', 'pin'), T(xR - 6, 273, 'B5', 'pin', 'end'), T(xR - 6, 304, 'B6', 'pin', 'end'));
  s.push(dot(420, 276), dot(420, 292), L(420, 276, 420, 278), L(420, 290, 420, 292), `<rect x="415" y="278" width="10" height="12" class="box"/>`, T(430, 288, 'damping R', 'pin acc'));
  s.push(frame(xX - 12, 216, 24, 84, ''), T(xX, 316, '-X3', 'flab', 'middle'));
  // relay
  s.push(frame(xR, 30, 110, 282, '7SJ82 IO102'), T(xR + 10, 62, 'I1 I2 I3', 'lab'), T(xR + 10, 164, 'I4', 'lab'), T(xR + 10, 238, 'V1 V2 V3', 'lab'), T(xR + 10, 284, 'V4', 'lab'));
  return `<svg class="sch" viewBox="0 0 690 328" role="img" aria-label="Example CT and VT connections to the SIPROTEC 7SJ82">${s.join('')}</svg>`;
}
