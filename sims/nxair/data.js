// NXAIR teardown data. One source for every number on the page: the 3D model, the step cards, the torque table and
// the spec sheets all read from here.
//
// Primary source: Siemens Installation Instructions NXAIR ≤ 17.5 kV / ≤ 40 kA / ≤ 4000 A, order no. 110-0084.9,
// revision 15 (Dec 2020) → "I". Operating Instructions, same product, 110-0134.9 rev. 14 (Jan 2019) → "O".
// Cross-checked: 50 kA installation instructions 172-2014.9 rev. 04 and NXAIR M 24 kV 139-2019.9 rev. 07 carry the
// same general torque table. Section numbers point into those documents.

import {CB_DOCS, CB_JOINTS, OPS_JOINTS, OPS_STEPS} from './ops.js';
import {LV_DOCS} from './lvpane.js';

const BASE_DOCS = [
  {k: 'I', t: 'Installation Instructions NXAIR ≤ 17.5 kV / ≤ 40 kA / ≤ 4000 A', no: '110-0084.9', rev: 'Rev. 15, Dec 2020', url: 'https://assets.new.siemens.com/siemens/assets/api/uuid:33c1a0b8-3ac8-4cbe-8923-0fc9568e6a41/110-0084-9-e.pdf'},
  {k: 'O', t: 'Operating Instructions NXAIR ≤ 17.5 kV / ≤ 40 kA', no: '110-0134.9', rev: 'Rev. 14, Jan 2019', url: 'https://assets.new.siemens.com/siemens/assets/api/uuid:c9d54883-7f95-480e-86e8-f8a50151946e/nxair-operacao-110-0134-9-e.pdf'},
  {k: 'I50', t: 'Installation Instructions NXAIR ≤ 17.5 kV / 50 kA', no: '172-2014.9', rev: 'Rev. 04, Jun 2018', url: 'https://assets.new.siemens.com/siemens/assets/api/uuid:dc26bbce-688d-4063-8205-b33d742aa106/nxair-50ka-instalacao-172-2014-9-04.pdf'},
  {k: 'IM', t: 'Installation Instructions NXAIR M 24 kV / 25 kA', no: '139-2019.9', rev: 'Rev. 07, Sep 2018', url: 'https://assets.new.siemens.com/siemens/assets/api/uuid:3f740473-f357-47f7-932d-04b792b1b4aa/nxair-m-instalacao-139-2019-9.pdf'},
  {k: 'SUP', t: 'Information / dimension drawings NXAIR (110-0250.9 ≤ 31.5 kA, 110-0262.9 40 kA)', no: '110-2300.9', rev: 'Rev. 02, Jan 2017', url: 'https://assets.new.siemens.com/siemens/assets/api/uuid:843eb425-ac4a-4df2-86a3-f5b8e6d656b2/nxair-desenhos-suplementares-nxair-110-2300-9-02-bx1-184.pdf'},
  {k: 'C23', t: 'Catalog HA 25.73 NXAIR up to 17.5 kV, 40 kA', no: 'HA 25.73', rev: 'Edition 2023', url: 'https://assets.new.siemens.com/siemens/assets/api/uuid:e8fb6cbc-9887-4533-939c-9d67a3a130ff/NXAIR-40kA-EN.pdf'},
  {k: 'C', t: 'Catalog HA 25.71 NXAIR and NXAIR M', no: 'HA 25.71', rev: 'Edition 2019', url: 'https://assets.new.siemens.com/siemens/assets/api/uuid:35caf0b0-ed6f-474f-846c-8f5545a6fddb/catalogue-nxair-en.pdf'},
];

export const DOCS = [...BASE_DOCS, ...CB_DOCS, ...LV_DOCS];

// I §7.1 and §12.2. Applies to every bolted joint that has no torque stated in its own step.
export const TORQUE_TABLE = [
  {size: 'M8', t: 30, c: 25, key: 13},
  {size: 'M12', t: 70, c: 60, key: 18},
  {size: 'M16', t: 110, c: 90, key: 24},
];

// How the torque on a joint is known. Shown as a badge on every row so nobody mistakes a general value for a
// step-specific one.
export const BASIS = {
  step: {label: 'Stated in step', tip: 'The manual states this torque in the assembly step itself.'},
  general: {label: 'General table', tip: 'No torque in the step; the manual says the general table I §7.1 applies (M8 30, M12 70, M16 110 Nm).'},
  check: {label: 'Installation report', tip: 'Value from the installation report checklist, I §17.'},
  hand: {label: 'By hand ≈', tip: 'The manual says "by hand force", which it equates to approx. this torque.'},
  maker: {label: 'Maker of part', tip: 'The manual defers to the manufacturer of this part (cable lug, sealing end, anchor).'},
  none: {label: 'Not stated', tip: 'Siemens gives no value. The figure shown is a generic engineering reference, marked as such.'},
};

// Busbar rating → bolting kit for the busbar-to-feeder-bar joint (I §7.6, Fig. 58–69). Feeder ≤ 1250 A unless noted.
export const BUSBAR = {
  1250: {label: '1250 A', bars: 1, bolt: 'M12x40', bag: '110-0770.3 or 110-1221.3', spacer: false, fig: 'Fig. 58/59', note: 'Feeder ≤ 1250 A, Ur ≤ 12 kV.'},
  2500: {label: '2000 / 2500 A', bars: 2, bolt: 'M12x50', bag: '110-0771.3', spacer: false, fig: 'Fig. 60/61', note: 'Feeder ≤ 1250 A. With feeder 1600–2500 A the bolt becomes M12x60, bag 110-0772.3 or 110-1222.3 (Fig. 62/63).'},
  4000: {label: '3150 / 4000 A', bars: 3, bolt: 'M12x80', bag: '110-1223.3', spacer: true, fig: 'Fig. 64–69', note: 'Copper spacer between the bars for feeders ≤ 2500 A. Panel depth 1500 mm minimum, 1540/1650 mm with 3150/4000 A feeders.'},
};

// pitch: phase spacing used to draw the model only (not a Siemens figure, never displayed).
export const WIDTHS = {
  600: {label: '600 mm', feeder: '≤ 1000 A', contact: 40, pitch: 150, kg: 950},
  800: {label: '800 mm', feeder: '1250 – 2000 A', contact: 60, pitch: 210, kg: 1170},
  1000: {label: '1000 mm', feeder: '2500 – 4000 A', contact: null, pitch: 275, kg: 1250},
};
// circuit-breaker panel with single busbar: 1500 mm (110-0250.9 sheet 1; 1350 mm is for the other panel types), 1650 with extended CTs
export const DEPTHS = [1500, 1650];

// --------------------------------------------------------------------------------------------- bolted joints
// qty: per panel. bolt: designation as printed. wash: washers / nut. t: torque Nm (null = see basis), c: control
// torque. part: which 3D part carries the bolts. ref: where it is written.
const BASE_JOINTS = [
  // transport + erection
  {id: 'crane', group: 'Transport', where: 'Craning angles to panel', qty: '3 per side angle, 2 per rear angle (3–4 angles)', bolt: 'M8x20 combination screw SN 65480 (+ nut SN 65482 on 1000 mm panels)', wash: 'Washer ISO 7093-1-8-200 HV', t: 30, c: 25, basis: 'step', ref: 'I §6.9', part: 'crane', size: 'M8'},
  {id: 'pallet', group: 'Transport', where: 'Angle brackets to wooden pallet (front + rear)', qty: '1 bracket front, 1 rear', bolt: 'Hexagon head bolts: screw them back into the panel after removing the brackets', wash: '—', t: null, c: null, basis: 'none', ref: 'I §6.7', size: '—', note: 'Size not given in the manual. These holes are later used by the panel itself, so tighten to the general table value for their size.'},
  {id: 'floorC', group: 'Foundation', where: 'Base frame to C-profile rail (bolted floor fixing)', qty: '2 points per panel (front + rear cross member, elongated holes 60 x 20 mm)', bolt: 'Hook-head bolt M16x35-4.6, galvanized', wash: 'Washer ISO 7094-16-100 HV, hex nut ISO 4032-M16-8', t: 110, c: 90, basis: 'general', ref: 'I §5.12 Fig. 7, §7.5; kit 8BX2060', part: 'base', size: 'M16'},
  {id: 'floorDouble', group: 'Foundation', where: 'Base frame to double-floor supporting profile', qty: '2 points per panel', bolt: 'Hex head bolt ISO 4017-M10-8.8', wash: 'Washer ISO 7093-1-10-200 HV, hex nut ISO 4032-M10-8', t: null, ref_t: '≈ 49 Nm (generic M10 8.8, µ 0.14)', c: null, basis: 'none', ref: 'I §5.12 Fig. 9', size: 'M10'},
  {id: 'floorQuake', group: 'Foundation', where: 'Base frame to U60 rail, earthquake stabilisation', qty: 'per drilling template (435: 4, 600/800: 6, 1000: 5 points)', bolt: 'Threaded bolt M12x45 into tapped U-profile', wash: 'Plain washers (supplied)', t: 70, c: 60, basis: 'general', ref: 'I §5.13, §5.14 Fig. 17', size: 'M12'},
  {id: 'anchor', group: 'Foundation', where: 'Floor fixing plates to raw concrete', qty: '1 per fixing plate, plates ≤ 1200 mm apart', bolt: 'Expansion dowel FAN 12/10 with hex head bolt + washer', wash: '—', t: null, c: null, basis: 'maker', ref: 'I §5.12 Fig. 7/8', size: 'M10'},
  {id: 'transport', group: 'Busbar', where: 'Busbar transport retainer (remove and discard)', qty: '2 retainer bolts + busbar fixing bolts', bolt: 'as delivered', wash: 'strip fasteners: cut', t: null, c: null, basis: 'none', ref: 'I §7.3', size: 'M8'},

  // busbar compartment
  {id: 'transPart', group: 'Busbar compartment', where: 'Transverse partition plate (busbar bushings) to busbar compartment', qty: '2 top + 2 bottom', bolt: '2 hex head M8x20 (top), 2 M8x20 (bottom)', wash: 'Top: plain washers 8.4 mm. Bottom: contact washers', t: 30, c: 25, basis: 'general', ref: 'I §7.7 Fig. 51, §7.8 Fig. 96', part: 'transPart', size: 'M8', note: 'Compulsory at panel depth ≥ 1400 mm, optional at 1350 mm. Contactor 435 mm: 2 M8x20 top + 1 hex socket bolt (key 6) bottom, fitted from the adjacent panel.'},
  {id: 'busCover', group: 'Busbar compartment', where: 'Busbar cover, between busbar and switching-device compartment', qty: '11', bolt: 'Nut M8 (on studs)', wash: 'Contact washers', t: 25, c: null, basis: 'step', ref: 'I §7.7 Fig. 54, §7.8 Fig. 100', part: 'busCover', size: 'M8', note: 'Hand-tight all round first, then 25 Nm. Switch-disconnector panel: 3 bolts M8x20 with contact washers, 25 Nm.'},
  {id: 'busbar', group: 'Busbar compartment', where: 'Busbar to feeder bar, each phase L1 L2 L3', qty: '2 bolts per phase joint (4 per phase in the end panel)', bolt: 'per busbar rating: M12x40 / M12x50 / M12x60 / M12x80', wash: 'Conical spring washer under head AND under nut, hex nut M12', t: 70, c: 60, basis: 'check', ref: 'I §7.6 Fig. 58–90, report 1.7', part: 'busbars', size: 'M12', note: 'Threads dry and grease-free. Copper contact faces brushed (silver-plated faces are not brushed), then a thin film of Vaseline. Drawing 110-2300.9: ISO 4017 M12 bolt, ISO 4032 nut, 2 conical spring washers DIN 6796, 70 Nm. Follow the bolt insertion direction in the figure. No distortion or gap between bars.'},
  {id: 'shells', group: 'Busbar compartment', where: 'Insulating half-shells over busbar joints (Ur = 17.5 kV and insulated busbar)', qty: '1 pair per joint, all three phases', bolt: 'Reclosable strip fastener', wash: 'Trim leaving ≈ 15 mm protrusion', t: null, c: null, basis: 'none', ref: 'I §7.6 Fig. 92/93', size: '—'},

  // bolting panels together
  {id: 'sdc', group: 'Panel to panel', where: 'Switching-device compartment side wall to adjacent panel (left inner side)', qty: '7', bolt: 'Hex head M8x25 with contact washer', wash: 'Plain washer size 8 ISO 7093. Bag 110-0788.3', t: 30, c: 25, basis: 'check', ref: 'I §7.9 Fig. 108, report 1.4', part: 'sideL', size: 'M8'},
  {id: 'wdc', group: 'Panel to panel', where: 'Upper + lower wiring duct cover, left inner side of switching-device compartment', qty: '2 + 2', bolt: 'Hex head M8x20 with contact washer', wash: '—', t: 30, c: 25, basis: 'general', ref: 'I §7.9 Fig. 107/109', part: 'wiringDuct', size: 'M8'},
  {id: 'link', group: 'Panel to panel', where: 'Panel connection link, front, between switching-device compartments', qty: '1 link per joint', bolt: 'plug-in link', wash: '—', t: null, c: null, basis: 'none', ref: 'I §7.9 Fig. 106, §12.4', part: 'link', size: '—'},
  {id: 'prcLow', group: 'Panel to panel', where: 'Pressure relief duct (PRC), lower area + left and right side', qty: '14', bolt: 'M8x20', wash: 'Contact washers + nuts', t: 30, c: 25, basis: 'check', ref: 'I §7.9 Fig. 110, report 2.7', part: 'prc', size: 'M8'},
  {id: 'prcUp', group: 'Panel to panel', where: 'Pressure relief duct (PRC), upper area', qty: '8', bolt: 'M8x20', wash: 'Contact washers + nuts', t: 30, c: 25, basis: 'check', ref: 'I §7.9 Fig. 111, report 2.7', part: 'prc', size: 'M8'},
  {id: 'lv', group: 'Panel to panel', where: 'Low-voltage compartment side to adjacent panel', qty: '3 (LV height 630 mm) or 5 (980 mm)', bolt: 'M8x20', wash: 'Contact washers + nuts', t: 30, c: 25, basis: 'check', ref: 'I §7.9 Fig. 112, report 1.4', part: 'lv', size: 'M8'},
  {id: 'rearLink', group: 'Panel to panel', where: 'Rear panel connection links (free-standing switchgear only)', qty: 'all holes at busbar + connection compartment rear', bolt: 'M8x20', wash: '—', t: 30, c: 25, basis: 'general', ref: 'I §7.9 Fig. 113/114', size: 'M8'},
  {id: 'evac', group: 'Panel to panel', where: 'Evacuation duct sections (galvanised 2 mm sheet, 530 x 245 mm)', qty: 'as per drawing 110-2300.9', bolt: 'M8, property class 8.8', wash: '—', t: 30, c: 25, basis: 'general', ref: 'I §5.6', size: 'M8'},

  // earthing
  {id: 'earthLink', group: 'Earthing', where: 'Earthing busbar link to adjacent panel (refit using its second hole)', qty: '1 joint per panel interface', bolt: 'M12', wash: 'Contact faces brushed + Vaseline', t: 70, c: 60, basis: 'check', ref: 'I §7.10 Fig. 127, report 1.12', part: 'earthBar', size: 'M12', note: 'Substation earth to both end panels, then every 5th panel. Not needed every 5th panel if 100 A DC test gives < 200 µΩ from both ends.'},
  {id: 'earthConn', group: 'Earthing', where: 'Cable screen earth connection to earthing busbar', qty: '1 central bolt, all screens of the panel', bolt: 'Connection bolt M12x35', wash: 'Cable lug of screen', t: 70, c: 60, basis: 'general', ref: 'I §10.8 Fig. 226, §10.10 Fig. 231', part: 'earthBar', size: 'M12', note: 'Contactor panel 435 mm: earth stud M8.'},

  // connection compartment access (front)
  {id: 'protPlate', group: 'Connection compartment', where: 'Protection plate of switching-device compartment', qty: '4', bolt: 'Nut M8', wash: 'Contact washers', t: 25, c: null, basis: 'step', ref: 'I §8.2 Fig. 158, §11.1 Fig. 253', part: 'protPlate', size: 'M8'},
  {id: 'partition', group: 'Connection compartment', where: 'Vertical partition switching-device ↔ connection compartment', qty: '15 = 10 + 5', bolt: '10 × M8x20 with contact + plain washer size 8 ISO 7093; 5 × M8x20 with contact washer', wash: 'see bolt column', t: 25, c: null, basis: 'step', ref: 'I §8.2 Fig. 159, §11.1 Fig. 246', part: 'partition', size: 'M8', note: 'Screw every bolt in up to the end of the thread before torquing (label on the partition). Contactor 435 mm: left part 7 × M8x20, right part 4 × M8x16.'},
  {id: 'ventI', group: 'Connection compartment', where: 'Ventilation duct type I (base frame front 2, lateral 2 × 3, partition top 4, air-guide holder 2 × 2)', qty: '20 M8', bolt: 'M8x20', wash: 'Contact washers', t: 25, c: null, basis: 'step', ref: 'I §11.2', size: 'M8', note: 'Duct is heavy: lift with 2 persons, ≈ 2 cm over the door threshold.'},
  {id: 'ventII', group: 'Connection compartment', where: 'Ventilation duct type II + partition unit; front part', qty: '13 + 7, front part 8', bolt: 'M8x20', wash: '13 with contact + plain washer ISO 7093, 7 + 8 with contact washer', t: 25, c: null, basis: 'step', ref: 'I §8.4, §11.3', size: 'M8'},
  {id: 'vtComp', group: 'Connection compartment', where: 'Removable-VT compartment (labyrinth 2 nuts + 11 × M8x16, wiring cover 2, metal cover 6, compartment 10, partition 8, bushing plate 8 + 3)', qty: '50', bolt: 'M8x16 / M8x20 / nuts M8', wash: 'Contact washers (+ plain washers where listed)', t: 25, c: null, basis: 'step', ref: 'I §8.5, §11.4', size: 'M8'},

  // connection compartment access (rear)
  {id: 'rearBase', group: 'Rear wall', where: 'Rear wall at panel base', qty: '4', bolt: 'M8x20 with contact washer', wash: '—', t: 25, c: null, basis: 'step', ref: 'I §9.1 Fig. 211, §11.5 Fig. 289', part: 'rearWall', size: 'M8', note: 'Only loosened to remove; rear wall lifts out by its handle.'},
  {id: 'rearH', group: 'Rear wall', where: 'Horizontal ledge', qty: '9', bolt: 'M8x25 with contact washer', wash: 'Plain washer size 8 ISO 7093', t: 25, c: null, basis: 'step', ref: 'I §9.1 Fig. 209, §11.5 Fig. 290', part: 'ledgeH', size: 'M8', note: 'The operating instructions (O §24.1) list 8 × M8x25 here; the installation instructions list 9. Fit every hole the ledge has.'},
  {id: 'rearV', group: 'Rear wall', where: 'Vertical ledges (2), over the panel-to-panel gap with sealing brackets', qty: '2 × 14 = 28', bolt: 'M8x20 with contact washer', wash: '—', t: 25, c: null, basis: 'step', ref: 'I §9.1 Fig. 209, §11.5 Fig. 290', part: 'ledgeV', size: 'M8'},

  // cables
  {id: 'floorPlate', group: 'Cables', where: 'Floor plates with rubber sleeves (connection compartment)', qty: 'all', bolt: 'Nuts / bolts M8', wash: '—', t: 25, c: null, basis: 'step', ref: 'I §10.1 Fig. 217, §10.8', part: 'floorPlate', size: 'M8', note: 'Covers in the connection compartment are torqued like the partition: 25 Nm. One rubber sleeve per cable, cut to cable Ø; gap > 2.5 mm → fit a new sleeve.'},
  {id: 'lugM12', group: 'Cables', where: 'Cable lug to connection bar, M12 version (per phase connection point)', qty: '1 per lug', bolt: 'Bolt M12 (pre-assembled, do not change)', wash: '2 plain washers ISO 7093 + 2 conical spring washers 12 + nut M12', t: 70, c: 60, basis: 'maker', ref: 'I §10.3, §10.8', part: 'cables', size: 'M12', note: 'Manual: observe the cable lug / sealing end maker\'s torque. 70 Nm is the switchgear general value for M12; use the lower of the two.'},
  {id: 'lugM16', group: 'Cables', where: 'Cable lug to connection bar, M16 version', qty: '1 per lug', bolt: 'Bolt M16 (pre-assembled)', wash: '2 conical spring washers 16 + nut M16', t: 110, c: 90, basis: 'maker', ref: 'I §10.3', size: 'M16', note: 'Same rule as M12: maker of the lug governs.'},
  {id: 'clampBr', group: 'Cables', where: 'Cable clamp lower part to cable bracket (id-Technik series K only)', qty: '2 per clamp', bolt: 'Hex head M10 ISO 4017 8.8, fully threaded (M10x80 / x100 / x120 by clamp size)', wash: 'Plain washer 10.5 ISO 7093-1 + plain washer 10.5 ISO 7089, hex nut M10 ISO 4032', t: 20, c: null, basis: 'step', ref: 'I §10.4 Fig. 219 item 6', part: 'clamps', size: 'M10'},
  {id: 'clampTop', group: 'Cables', where: 'Cable clamp upper part over the cable', qty: '2 per clamp', bolt: 'same M10 bolt', wash: 'Plain washer 10.5 ISO 7089, hex nut M10 ISO 4032', t: 5, c: null, basis: 'step', ref: 'I §10.4 Fig. 219 item 8', part: 'clamps', size: 'M10', note: 'Single-core cables: antimagnetic clamps. Clamps sit below the sealing end; move the bracket if needed.'},
  {id: 'bracket', group: 'Cables', where: 'Cable bracket in deep bottom pan (three-core cables)', qty: '4', bolt: 'Bolts / nuts M8', wash: 'Plain washers size 8 ISO 7093', t: 25, c: null, basis: 'step', ref: 'I §10.10 Fig. 235', size: 'M8'},
  {id: 'bottomPan', group: 'Cables', where: 'Deep bottom pan (three-core cables): plates to studs, plates together, floor cover', qty: '8 × M8x16 + 4 nuts + 16 × M8x20; floor cover 4 + 12 × M8x20', bolt: 'M8x16 / M8x20 / nuts M8 on standing studs', wash: 'Contact washers 8 / plain washers 8 ISO 7093', t: 25, c: null, basis: 'step', ref: 'I §10.10 Fig. 232–234', size: 'M8'},
  {id: 'vtPrim', group: 'Cables', where: 'Primary connections of voltage transformers and surge arresters', qty: '1 per phase', bolt: 'per device', wash: '—', t: 20, c: null, basis: 'check', ref: 'I report 2.4', part: 'vt', size: 'M8'},
  {id: 'vtCable', group: 'Cables', where: 'Removable-VT connecting cables to cable / bar connection', qty: '3', bolt: 'Nut M8', wash: 'Contact washer + plain washer', t: 25, c: null, basis: 'step', ref: 'I §11.4 Fig. 273', size: 'M8', note: 'Keep ≥ 100 mm (≤ 12 kV) / ≥ 160 mm (17.5 kV) from cable screen earth conductors.'},

  // forced ventilation
  {id: 'fan', group: 'Forced ventilation (4000 A)', where: 'Fan box to PRC: 6 × M8x20 + 10 × M8x25 (plain washers). Roof plate 10 × M8x20. Cover 2 × M8x20. Front cover 2 × M8x25', qty: '30', bolt: 'M8x20 / M8x25', wash: 'Plain washers on the M8x25', t: 30, c: 25, basis: 'general', ref: 'I §7.12', size: 'M8', note: 'Fan ebm-papst, replace before 40 000 h.'},

  // doors + operation
  {id: 'doorHS', group: 'Doors and operation', where: 'HV door, busbar current metering panel (6) / VT compartment door (3)', qty: '6 / 3', bolt: 'Hex socket head bolt, key size 6', wash: '—', t: 20, c: null, basis: 'hand', ref: 'O §17, §19', size: 'M8'},
  {id: 'earthClamp', group: 'Doors and operation', where: 'Earthing device clamp to fixed earthing point (screw handle)', qty: '1', bolt: 'Screw handle', wash: '—', t: 20, c: null, basis: 'hand', ref: 'O §26', size: '—'},
  {id: 'quakeHoles', group: 'Doors and operation', where: 'Unused craning-angle holes at the panel rear after removing the angles', qty: 'as found', bolt: 'none: seal holes', wash: 'SIKAFLEX 221-GR 310 ML', t: null, c: null, basis: 'none', ref: 'I §6.11', size: '—'},
];

export const JOINTS = [...BASE_JOINTS, ...CB_JOINTS, ...OPS_JOINTS];
export const jointById = Object.fromEntries(JOINTS.map((j) => [j.id, j]));

// --------------------------------------------------------------------------------------------------- parts
// comp: compartment key. Every part in the 3D model has an entry; joints list what holds it.
export const COMPS = {
  enclosure: {name: 'Enclosure and frame', color: '#8d969c'},
  busbar: {name: 'Busbar compartment (B)', color: '#c27a44'},
  sdc: {name: 'Switching-device compartment (A)', color: '#4c86a8'},
  conn: {name: 'Connection compartment (C)', color: '#6f9a54'},
  lv: {name: 'Low-voltage compartment (E)', color: '#9a7fb8'},
  prc: {name: 'Pressure relief duct', color: '#b08d3a'},
  truck: {name: 'Withdrawable circuit-breaker (D)', color: '#3d6f8f'},
  site: {name: 'Site and foundation', color: '#7d7d72'},
};

export const PARTS = [
  {id: 'rails', comp: 'site', name: 'Foundation rails', desc: 'Two C-profile rails CB 50 x 30 x 3 (S235JR) or U50 rails cast flush in the floor, under the front and rear cross members. Holder plates (80 x 5 x 145 mm, galvanised) every ≤ 1200 mm, anchored with FAN 12/10 dowels. Tolerance DIN 43661: straightness 1 mm/m and 2 mm over the full length, evenness 1 mm per 1 m.', joints: ['floorC', 'anchor', 'floorDouble', 'floorQuake']},
  {id: 'base', comp: 'enclosure', name: 'Base frame', desc: 'Galvanised steel frame the panel stands on. Front and rear cross members carry elongated holes 60 x 20 mm for 2 floor fixing points per panel. Shim 0.5–1.0 mm under the frame next to each fixing so bolting does not distort it.', joints: ['floorC']},
  {id: 'sideL', comp: 'enclosure', name: 'Side walls', desc: 'Galvanised sheet steel, bolted modular compartments. The left inner side of the switching-device compartment takes 7 × M8x25 into the neighbour panel. End panels get powder-coated end walls (RAL 7035) with a sealing stopper where the crane rod passes.', joints: ['sdc']},
  {id: 'rearWall', comp: 'enclosure', name: 'Rear wall', desc: 'One-piece rear cover of the connection compartment with handle. Held by 4 × M8x20 at the base and trapped by the ledges. Lift by the handle and pull out after removing the ledges.', joints: ['rearBase']},
  {id: 'ledgeH', comp: 'enclosure', name: 'Horizontal ledge', desc: 'Clamps the top edge of the rear wall. 9 × M8x25 with contact washer and plain washer ISO 7093.', joints: ['rearH']},
  {id: 'ledgeV', comp: 'enclosure', name: 'Vertical ledges + sealing brackets', desc: 'Two vertical ledges cover the joints to the neighbour panels; 2 sealing brackets go into the vertical gaps first. 14 × M8x20 per ledge.', joints: ['rearV']},
  {id: 'transPart', comp: 'busbar', name: 'Transverse partition plate', desc: 'Side wall of the busbar compartment with the busbar bushings, pre-assembled at the factory. Remove it to fit the busbars from the side (the recommended route), refit after. Compulsory at panel depth ≥ 1400 mm.', joints: ['transPart']},
  {id: 'busbars', comp: 'busbar', name: 'Main busbars L1 L2 L3', desc: 'Flat copper bars running panel to panel, delivered fixed to the side of the panel (right end panel has none). 1, 2 or 3 bars per phase by rating. Bolted to the feeder bars with 2 × M12 per phase (4 in the end panel), conical spring washers both sides, 70 Nm, dry threads.', joints: ['busbar', 'shells', 'transport']},
  {id: 'feeders', comp: 'busbar', name: 'Feeder bars', desc: 'Copper droppers from each main busbar down to the upper bushing. The busbar joint sits on the feeder bar flag. Mount main busbars on all phases first, connect feeder bars last to avoid stress (switch-disconnector panel).', joints: ['busbar']},
  {id: 'busCover', comp: 'busbar', name: 'Busbar cover', desc: 'Floor of the busbar compartment seen from the switching-device compartment; gives front access to the busbar joints. Lift by the handle and pull out after removing 11 × M8 nuts.', joints: ['busCover']},
  {id: 'bushU', comp: 'sdc', name: 'Upper bushings (busbar side)', desc: 'Cast-resin bushings through the partition, recessed: the bore takes the contact system of the breaker arm, and the silver-plated fixed contact sits at its closed end, about 145 mm behind the partition (Ø 40 mm at 600 mm width / ≤ 1000 A, Ø 60 mm at 800 mm; the 1000 mm panel is drawn with Ø 79). The mouth is 6 mm in front of the partition, right behind the shutters; the rear terminal carries the feeder bar to the busbar. The dimension drawing 110-0250.9 shows the contact systems just in front of the closed shutters in test position, which puts the contacts inside the bushings in service; bore and length are drawn from that. Contacts carry a thin, even film of Molykote Longterm 2 plus. The bore stays clean, dry and grease-free. Contact pieces are bolted and replaceable from the front.', joints: []},
  {id: 'bushL', comp: 'sdc', name: 'Lower bushings (feeder side)', desc: 'Same as the upper bushings, through the vertical partition into the connection compartment. Their rear terminal carries the cable connection bar, which runs through the block-type current transformers behind them.', joints: []},
  {id: 'shutters', comp: 'sdc', name: 'Metallic shutters', desc: 'Two metal plates just in front of the bushing mouths. Positively driven by the truck: they open (upper up, lower down) in the last part of the travel to service and close before the contact systems leave the bushings. Never push them by hand; open only with the slip-on shutter levers (left / right). Linkage cleaned with WD-40 on a cloth.', joints: []},
  {id: 'partition', comp: 'conn', name: 'Vertical partition', desc: 'Metal partition between switching-device and connection compartment (partition class PM). 15 bolts: 10 × M8x20 with contact + plain washer, 5 × M8x20 with contact washer. Screw all in to the end of the thread, then 25 Nm.', joints: ['partition']},
  {id: 'protPlate', comp: 'sdc', name: 'Protection plate', desc: 'Lower plate in the switching-device compartment in front of the partition. 4 × M8 nuts with contact washers, 25 Nm.', joints: ['protPlate']},
  {id: 'wiringDuct', comp: 'sdc', name: 'Wiring duct + covers', desc: 'Metal duct on the left inner side (right side in the 435 mm contactor panel) for customer control cables up to the LV compartment. Upper and lower cover, 2 × M8x20 each.', joints: ['wdc']},
  {id: 'link', comp: 'sdc', name: 'Panel connection link', desc: 'Front link inserted between neighbouring switching-device compartments. Checked at the end of installation (I §12.4).', joints: ['link']},
  {id: 'esw', comp: 'conn', name: 'Feeder earthing switch', desc: 'Make-proof earthing switch in the connection compartment: a shaft behind the cable connection bars with twin knife blades per phase. Closed, the knives lie on the fixed contacts on the rear face of the bars; open, they stand 60° upwards in free space. Driven from the front through a rod that passes the partition, operated with the lever (180°) only with the truck in test position. After 2 short-circuit making operations inspect blades and fixed laminated contacts. Fixed contacts greased with Longterm 2 plus. Shaft and blade geometry in this model is representative.', joints: []},
  {id: 'cts', comp: 'conn', name: 'Block-type current transformers', desc: 'Inductive support-type block CTs, cast resin, narrow design to DIN 42600 Part 8 (catalog HA 25.71 p. 22): up to 4000 A, up to 3 secondary cores, 1 or 5 A, up to 30 VA, measuring 0.2 – 1 FS5/FS10, protection 5P/10P. They stand under the cable connection bar on the cable side of the lower bushings: the bar from the bushing ends on P1, the bar to the cables starts at P2, so the primary of the CT carries the feeder current. Secondary terminals in a sealable box at the foot; own rating plates (copy inside the HV door). Unused secondary windings short-circuited; secondary windings earthed. DIN main dimensions are not public; sizes drawn from the catalog photo.', joints: []},
  {id: 'connBars', comp: 'conn', name: 'Cable connection bars', desc: 'In two pieces per phase: bushing to CT terminal P1, CT terminal P2 down to the cables. Up to 6 connection points per phase. Bolts are pre-assembled on the connection bar and must not be changed. Minimum 74 mm lug to lug between phases (≤ 17.5 kV).', joints: ['lugM12', 'lugM16']},
  {id: 'cables', comp: 'conn', name: 'Cables + sealing ends', desc: 'Drawn with one single-core cable per phase (up to 6 per phase are possible). Single-core: sealing end Ø ≤ 95 mm, length ≤ 450 mm incl. lug, ≤ 500 mm². Three-core: Ø ≤ 60 mm, ≤ 300 mm, ≤ 240 mm², ≤ 500 mm lug to splitting cap. Lug bolted without distortion or gap. No phase tape on the sealing ends.', joints: ['lugM12', 'earthConn']},
  {id: 'clamps', comp: 'conn', name: 'Cable bracket + clamps', desc: 'Clamps sit below the sealing end (I §10.8). id-Technik series K clamps only (not supplied). K 26/38 & K 36/52 → M10x80, K 50/75 → M10x100, K 66/90 → M10x120. Lower nut 20 Nm, upper nut 5 Nm.', joints: ['clampBr', 'clampTop']},
  {id: 'floorPlate', comp: 'conn', name: 'Floor plates + rubber sleeves', desc: 'Gland plate of the connection compartment. One rubber sleeve per cable, cut to the cable diameter (the rings are only a rough guide). Elongated cutout 7 x 42 mm at the left corner for the substation earth; seal with SIKAFLEX 221.', joints: ['floorPlate']},
  {id: 'earthBar', comp: 'conn', name: 'Earthing busbar', desc: 'Copper earth bar along the rear bottom of the connection compartment, linked panel to panel with an M12 link (70 Nm). Cable screens land on the central M12x35 bolt.', joints: ['earthLink', 'earthConn']},
  {id: 'vt', comp: 'conn', name: 'Voltage transformers (optional)', desc: 'Fixed single-pole cast-resin VTs (catalog HA 25.71 p. 23: up to 24 kV primary, 120 V or 120 V / √3 secondary, classes 0.2 / 0.5 / 1.0, up to 200 VA; option earth-fault winding da-dn) on a base plate in the connection compartment, HV terminal on top, secondary terminals a, n, da, dn behind a transparent cover; own rating plates. Primary connections 20 Nm. Earthed on primary (X, N) and secondary side; damping resistor in the open-delta winding.', joints: ['vtPrim']},
  {id: 'breaker', comp: 'truck', name: 'Circuit-breaker poles and contacts (SION 3AE5)', desc: 'The SION 3AE5 of the Breaker tab, built for this panel: pole centres = phase spacing (150 / 210 / 275 mm), terminal distance 275 mm (310 at 1000 mm), contact arms Ø 40 / 60 mm to match the fixed contacts (Ø 79 drawn at 1000 mm), 13 / 26 contact fingers. Pole shells, vacuum interrupters, contact arms on threaded bolts, contact systems and separating shells. In service the contact systems sit inside the bushings, gripping the fixed contacts. Contact systems greased thin with Molykote Longterm 2 plus. The Breaker tab takes it apart; hover any detail for its name.', joints: []},
  {id: 'truck', comp: 'truck', name: 'Withdrawable truck', desc: 'SION truck under the breaker: 679 × 424 × 107 mm at 210 mm pole centres (529 / 879 mm wide at 150 / 275 mm), wheels on the guide rails at the wheel track d. Positions: service (connected), test (disconnected, LV plug in), disconnected (LV plug out). Racking spindle driven through the door; taken out with the service truck. Solenoid-interlock locking bolts are removed once auxiliary voltage is available (I §13.2).', joints: []},
  {id: 'hvdoor', comp: 'sdc', name: 'High-voltage door', desc: 'Pressure-resistant front door with control board: racking opening and slide, double-bit key opening, earthing-switch opening and slide, mimic with mechanical position indicators, inspection window over the indicators and counter of the breaker, CLOSE / OPEN push-rod openings over its buttons (cover swung aside with the rotary button), hand-crank opening over its charging coupling. Opens only with the truck in test position.', joints: []},
  {id: 'lv', comp: 'lv', name: 'Low-voltage compartment', desc: 'Protection relay (example: SIPROTEC 5 7SJ82, 1/3 × 19", detailed with wiring in the LV + relay tab), terminals, MCBs, bus wires panel to panel. Height 630 mm standard (980 mm high version: panel 2350 mm). Door key: 3 mm double-bit. Bolted to the neighbour with 3 or 5 × M8x20.', joints: ['lv']},
  {id: 'prc', comp: 'prc', name: 'Pressure relief duct (PRC)', desc: 'Collects arc gases from all compartments through flaps and leads them sideways or to the rear (evacuation duct) or into an absorber. Bolted panel to panel with 14 + 8 × M8x20, 30 Nm. Relief flaps must lie flush on top of the busbar compartment.', joints: ['prcLow', 'prcUp', 'evac', 'fan']},
  {id: 'shellB', comp: 'busbar', name: 'Fixed compartment walls + relief flaps', desc: 'Galvanised walls that stay on the panel: busbar compartment rear wall, the bushing plate between busbar and switching-device compartment, the partition to the LV compartment, and the pressure relief flaps on top of each high-voltage compartment that open into the pressure relief duct in an internal arc. The flaps must rest flush (installation report 2.6).', joints: []},
  {id: 'shutterMech', comp: 'sdc', name: 'Shutter mechanism (left + right)', desc: 'Drive slides and cranked levers on both side walls of the switching-device compartment, between the shutters and the breaker. The truck pushes the slides while racking in: the left mechanism lifts the upper shutter (busbar side), the right one lowers the lower shutter (feeder side). With the breaker out, either shutter can be opened with its slip-on lever (L for the upper one: push the handle down to the end stop until it latches; to close, push it slightly right and let it slip up), and either mechanism can be padlocked, e.g. the right one while the busbar shutter is open (O §22). Do not reach into it. Linkage cleaned with WD-40 on a cloth, never sprayed.', joints: []},
  {id: 'shelf', comp: 'sdc', name: 'Withdrawable-part shelf, guide rails, interlocking unit', desc: 'Mid-height shelf the withdrawable breaker runs on. Guide rails greased with Klüber ISOFLEX TOPAS L 32. At the front: operating and interlocking unit with the racking shaft, the earthing-switch operating unit with its drive rod to the connection compartment, position switches, the truck earthing contact rail, and the fixed half of the 64-pole LV connector under the LV compartment.', joints: []},
  {id: 'heater', comp: 'conn', name: 'Anti-condensation heater (optional)', desc: 'Finned heater in the connection compartment, thermostat- or hygrostat-controlled from the LV compartment. Switch it on after installation (I §11.1). Hot surface: let it cool before touching.', joints: []},
  {id: 'mech', comp: 'truck', name: 'Operating mechanism and secondary equipment (SION 3AE5)', desc: 'The drive of the 3AE5, as in the Breaker tab: housing and cover with the operating panel (ON / OFF buttons, position and spring indicators, counter, hand-crank opening), closing spring, charging motor, main shaft and linkage, releases -Y9 / -Y1 / -Y2 … -Y7, auxiliary switch -S1, position switches and the -X0 interface on top. The door has the inspection window over the indicators, the push-rod openings over the buttons and the hand-crank opening over the coupling. With the 150 mm breaker the drive is drawn 565 mm wide like the others (catalog: 445 mm).', joints: []},
  {id: 'lvPlug', comp: 'truck', name: 'Low-voltage plug, 64-pole', desc: 'Coded 64-pole plug in the fixed socket under the LV compartment, on the cable to the -X0 interface on top of the breaker. Plugged = auxiliary circuits connected (test and service position); the cable follows the breaker. Coding stops a breaker with a lower rating from being plugged into a panel with a higher one. A 3 m 64-pole coupling cable is available for tests outside the panel.', joints: []},
  {id: 'serviceTruck', comp: 'truck', name: 'Service truck', desc: 'Height-matched trolley to take the withdrawable part out of the panel and put it back. Lift both unlocking levers to release the part. Move it only empty or with the part latched in its end position, operate only from the operating side, park with the rear side against a wall. Remove the transport protection plate before first use.', joints: []},
  {id: 'doorCtl', comp: 'sdc', name: 'Door controls: earthing slide, indicators, lever', desc: 'Moving elements on the HV door: the operating slide that uncovers the earthing-switch actuating opening, the mechanical position indicators (feeder earthing switch: vertical I = earthed; withdrawable part: vertical bar = service, horizontal = test) and the removable operating lever, turned 180° to earth or de-earth.', joints: []},
  {id: 'crane', comp: 'site', name: 'Craning angles (transport)', desc: 'Bolted to the panel for lifting: 4 angles on a panel without end wall, 3 with end wall. M8x20 at 30 Nm. Crane rods S355JR Ø 25 mm pushed through, protrusion > 300 mm each end, washer size 27 + cotter pin. Remove after setting down, seal open rear holes.', joints: ['crane']},
];
export const partById = Object.fromEntries(PARTS.map((p) => [p.id, p]));

// --------------------------------------------------------------------------------------------------- steps
// view: camera preset. ex: explode amount 0..1 for the subject panel. focus: parts lit with the accent. joints: bolts
// shown and labelled. truck: 'service' | 'test' | 'out'. row: show the neighbour panels. cut: section through the
// panel centre.
const INSTALL_STEPS = [
  {
    id: 'safety', phase: 'Before you start', title: 'Five safety rules, people, PPE', view: 'iso', ex: 0, truck: 'service', row: true,
    body: [
      'Work only as or under qualified personnel trained for MV switchgear (I §4).',
      'Five safety rules before any work on primary parts: disconnect · secure against reconnection · verify absence of voltage · earth and short-circuit · cover or barrier adjacent live parts.',
      'PPE for erection: safety shoes, helmet, cut-resistant gloves and arm sleeves (sheet edges inside the panel are sharp).',
      'These steps assume new, never-energised switchgear. On a running board follow the operating instructions for every compartment you open.',
    ],
    warn: 'Do not climb on the panel roof. Do not move transport units by body force.',
  },
  {
    id: 'room', phase: 'Prepare', title: 'Room, foundation, rails', view: 'front', ex: 0, truck: 'service', row: true, focus: ['rails', 'base'], joints: ['floorC'],
    body: [
      'Room height decides the pressure relief. Evacuation duct out of the building: room ≥ 2500 mm (≤ 17.5 kV, ≤ 40 kA). Evacuation duct or absorber: ≥ 2800 mm (≤ 12 kV, ≤ 25 kA), ≥ 3000 mm (≤ 12 kV, 31.5 kA), ≥ 3500 mm (17.5 kV, ≤ 31.5 kA), ≥ 3500 mm (≤ 17.5 kV, 40 kA). Lower room: not permitted.',
      'Aisles: control aisle ≥ 1250 mm for panel replacement. Rear ≥ 500 mm for rear cable access (also with rear duct); side walls ≥ 150 mm from the end panels.',
      'Rails per DIN 43661: straightness 1 mm/m and 2 mm over the full length, evenness 1 mm per 1 m. Measure level differences on a measuring sheet and plan shims 0.5–1.0 mm.',
      'Floor in front of the panels, where trucks roll, at the same level as the panel standing surface.',
      'Bolted fixing on concrete: C-profile CB 50 x 30 x 3, holder plates every ≤ 1200 mm, raw floor to rail ≥ 90 mm, rail top ≥ 50 mm above raw floor, plate 80 mm wide.',
    ],
  },
  {
    id: 'lift', phase: 'Transport', title: 'Lift and set down', view: 'iso', ex: 0, truck: 'service', row: false, focus: ['crane'], joints: ['crane'], crane: true,
    body: [
      'Centre of gravity (800 mm CB panel): 630 mm behind the front, 400 mm from the side, 980 mm high. 435 mm contactor: 390 / 145 / 560 mm. It is marked on the packing.',
      'Craning angles: side angle 3 × M8x20, rear angle 2 × M8x20, 30 Nm. Front angles first, then rear at the same height. 4 angles without end wall, 3 with end wall (rod goes through the end wall: push out the sealing stopper, keep it in the LV compartment).',
      'Crane rods S355JR Ø 25 mm, length 1200 (600/435 wide) or 1600 mm (800/1000 wide) front-to-rear, 1900 mm lateral. Protrusion > 300 mm each end, washer size 27 ISO 7089 + cotter pin. Slings close to the angles, rod to hook > 2000 mm.',
      'Chains: crane cross-member length 1500 mm, hook spacing 520 / 680 / 880 / 1080 mm for 435 / 600 / 800 / 1000 mm panels. Panels with end wall only by crane rods.',
      'The withdrawable part stays inside until the panel stands on firm ground in the room. Never lift with roller crowbars at sides, rear, or at the front with the HV door closed.',
    ],
    warn: 'Weights (≤ 31.5 kA, no rear duct): 600 CB ≈ 950 kg · 800 CB ≈ 1170 kg · 1000 CB 2500 A ≈ 1250 kg · 435 contactor ≈ 750 kg · rear duct + 250 / 250 / 350 kg.',
  },
  {
    id: 'unpack', phase: 'Transport', title: 'Off the pallet, busbars out of transport fixing', view: 'side', ex: 0.15, truck: 'service', row: false, focus: ['busbars'], joints: ['transport'],
    body: [
      'Lift the PE foil ≈ 30 cm. Unscrew the angle bracket at front and rear bottom from the pallet, take it off, screw the hex head bolts back into the open holes in the panel.',
      'Busbars travel bolted to the side of their own panel (right end panel has none): cut the strip fasteners, remove 2 retainer bolts and the retainer, unbolt the bars and store them with their panel.',
      'Remove the factory transport plate from the service truck: lift both unlocking levers and pull it out.',
    ],
  },
  {
    id: 'align', phase: 'Erect', title: 'Place and align the first panel', view: 'front', ex: 0, truck: 'service', row: true, focus: ['base'], joints: [],
    body: [
      'Start with the end panel that carries the left end wall (or right, per room plan). Place the next unit ≈ 300 mm away so both can still be aligned.',
      'Level horizontally and plumb vertically. Max. level difference 1 mm/m. Shim 0.5–1.0 mm under the frame. A distorted frame jams doors, trucks and shutters.',
    ],
  },
  {
    id: 'fix', phase: 'Erect', title: 'Fix the panel to the floor', view: 'low', ex: 0.25, truck: 'service', row: false, focus: ['base', 'rails'], joints: ['floorC'],
    body: [
      '2 points per panel through the elongated holes 60 x 20 mm in the front and rear cross members. Shims next to each point.',
      'Bolted on C-rail: hook-head bolt M16x35-4.6, washer ISO 7094-16-100 HV, nut ISO 4032-M16-8 → 110 Nm (control 90). Kit 8BX2060.',
      'Welded on U50 rail: weld in the elongated holes, paint the seam. Not allowed with earthquake stabilisation.',
      'Double floor: ISO 4017 M10-8.8, washer ISO 7093-1-10-200 HV, nut M10-8 into a supporting profile (≈ 70 x 40 x 2). Earthquake: threaded bolts M12x45 into tapped U60 rails, holes marked with the drilling template from an already fixed panel.',
      'Panels with ventilation duct: first remove its bottom front part (4 nuts M8 + 2 × M8x20) to reach the front hole.',
      'Afterwards check gaps against IP3XD: seal ≤ 2.5 mm with SIKAFLEX 221-GR 310 ML; > 2.5 mm call Siemens.',
    ],
  },
  {
    id: 'busOpen', phase: 'Busbars', title: 'Open the busbar compartment', view: 'iso', ex: 0.55, truck: 'out', row: false, focus: ['transPart', 'busCover'], joints: ['transPart', 'busCover'], cut: true,
    body: [
      'Best route: from the side of the panel. Remove the transverse partition plate (bushings stay in it): top 2 × M8x20 + plain washers 8.4 mm, bottom 2 × M8x20 with contact washers.',
      'Front route (not for the 435 mm contactor): feeder earthed, truck out, then remove the busbar cover from below in the switching-device compartment: 11 nuts M8 with contact washers, lift by the handle and pull out.',
      'From the top is possible but much harder because of the pressure relief duct.',
    ],
  },
  {
    id: 'busbar', phase: 'Busbars', title: 'Bolt the busbars to the feeder bars', view: 'bus', ex: 0.35, truck: 'test', row: true, focus: ['busbars', 'feeders'], joints: ['busbar'], cut: true, busbar: true,
    body: [
      'The bag with bolts, conical spring washers and nuts hangs on the busbar compartment of each panel.',
      'Brush the contact faces, then a thin film of Vaseline on the faces only. Threads stay dry and grease-free.',
      'Each phase: 2 bolts through busbar and feeder bar (4 per phase in the end panel). Conical spring washer under the head and under the nut. Insert bolts in the direction shown in the drawing for your rating.',
      'Torque 70 Nm (control 60 Nm). No gap and no distortion between bars.',
      'Ur = 17.5 kV or insulated busbar: clip insulating half-shells (male + female) over every joint, close with the reclosable strip, trim to ≈ 15 mm. Insulated busbar: slide plastic tubes over the horizontal bars.',
    ],
  },
  {
    id: 'busClose', phase: 'Busbars', title: 'Close the busbar compartment', view: 'iso', ex: 0.2, truck: 'out', row: true, focus: ['transPart', 'busCover'], joints: ['transPart', 'busCover'],
    body: [
      'Before closing: no tools, offcuts or cloths left; vacuum and lint-free cloth; check every busbar joint at control torque 60 Nm and record it.',
      'Transverse partition (compulsory at depth ≥ 1400 mm): slide it over the busbars, 2 × M8x20 + 8.4 washers top, 2 × M8x20 contact washers bottom. Check it at control torque before the next panel covers it.',
      'Busbar cover: 11 nuts M8 with contact washers hand-tight all round, then 25 Nm.',
    ],
  },
  {
    id: 'join', phase: 'Panel to panel', title: 'Bolt the panels together', view: 'iso', ex: 0.15, truck: 'out', row: true, focus: ['sideL', 'prc', 'lv', 'wiringDuct', 'link'], joints: ['sdc', 'wdc', 'prcLow', 'prcUp', 'lv'],
    body: [
      'Align the next panel to the same level (1 mm/m), fix it to the floor, fit its busbars, then pull the two together.',
      'Front: insert the panel connection link between the two switching-device compartments.',
      'Switching-device compartment: remove the upper and lower wiring duct covers (2 × M8x20 each) on the left inner side. From there 7 × M8x25 with contact washer + plain washer ISO 7093 into the neighbour (bag 110-0788.3). Refit the covers.',
      'Pressure relief duct: 14 × M8x20 in the lower area and both sides, 8 × M8x20 in the upper area, contact washers and nuts.',
      'Low-voltage compartment: 3 × M8x20 (630 mm high) or 5 (980 mm), contact washers and nuts.',
      'Free-standing board: rear connection links with M8x20 at every hole. All panel-to-panel M8 joints 30 Nm.',
    ],
    warn: '435 mm contactor next to a ≥ 600 mm panel: bolt in the supplied earthing-busbar connecting element.',
  },
  {
    id: 'earth', phase: 'Earthing', title: 'Earthing busbar and substation earth', view: 'rear', ex: 0.45, truck: 'out', row: true, focus: ['earthBar'], joints: ['earthLink'], cut: true,
    body: [
      'The link travels bolted on the right side of each panel. Undo its M12, slide it right half out of the panel, refix it through its second hole.',
      'In the neighbour remove the pre-assembled bolt from the joint, brush the faces, thin film of Vaseline, bolt the link with M12 → 70 Nm. Remove a wiring duct part (2 × M8x20) if it is in the way.',
      'Substation earth to the earthing busbar of both end panels, and every 5th panel counted from each end. Feed it through the 7 x 42 mm cutout at the left corner of the floor cover and seal it.',
      'Skip the every-5th connection only if a 100 A DC test from each end panel to the station earthing point reads < 200 µΩ.',
    ],
  },
  {
    id: 'connOpen', phase: 'Cables', title: 'Open the connection compartment', view: 'rear', ex: 0.6, truck: 'out', row: false, focus: ['rearWall', 'ledgeH', 'ledgeV', 'partition', 'protPlate'], joints: ['rearH', 'rearV', 'rearBase', 'partition', 'protPlate'],
    body: [
      'Precondition: truck in test position or out, HV door closed, feeder earthing switch CLOSED (indicator vertical I on the door and inside).',
      'From the rear (preferred): horizontal ledge 9 × M8x25 + plain washers, each vertical ledge 14 × M8x20, take out 2 sealing brackets, loosen 4 × M8x20 at the base, lift the rear wall by its handle.',
      'From the front: protection plate 4 nuts M8, then the partition 10 × M8x20 (contact + plain washer) + 5 × M8x20 (contact washer).',
      'Ventilated or VT-compartment versions: remove the ventilation duct (2 persons) or the VT compartment first, see torque table.',
    ],
  },
  {
    id: 'cable', phase: 'Cables', title: 'Terminate the HV cables', view: 'cable', ex: 0.3, truck: 'out', row: false, focus: ['cables', 'connBars', 'clamps', 'floorPlate', 'earthBar'], joints: ['lugM12', 'clampBr', 'clampTop', 'earthConn', 'floorPlate'], cut: true,
    body: [
      'Remove lug bolts from the connection bars, brush all contact faces, thin film of Vaseline, refit the bolts. Remove floor plates (nuts M8) and the rubber sleeves.',
      'Cut one sleeve per cable to its diameter. Pull the cable in, bolt the lug flat on the connection point with the pre-assembled kit: M12 = bolt + 2 plain ISO 7093 + 2 conical spring washers + nut; M16 = bolt + 2 conical spring washers + nut. Use the lug maker\'s torque.',
      'Minimum 74 mm lug to lug between phases. Sealing ends: single-core Ø ≤ 95, length ≤ 450 mm incl. lug, ≤ 500 mm²; three-core Ø ≤ 60, ≤ 300 mm, ≤ 240 mm². No phase tape on sealing ends.',
      'Clamp below the sealing end: lower M10 nut 20 Nm, upper M10 nut 5 Nm. Antimagnetic clamps for single-core.',
      'Screens: lead each earth lug straight to the earthing busbar, central M12x35 bolt, max. distance from live parts. With a zero-sequence CT, route the earth back through the CT.',
      'Refit floor plates with sleeves (M8). Gaps > 2.5 mm around a cable → new sleeve.',
    ],
  },
  {
    id: 'control', phase: 'Cables', title: 'Control cables and bus wires', view: 'front', ex: 0.15, truck: 'out', row: true, focus: ['wiringDuct', 'lv'], joints: ['wdc'],
    body: [
      'Open the customer wiring duct covers on the left inner side of the switching-device compartment (right side for the 435 mm contactor).',
      'Run control cables from the floor up the duct into the LV compartment. Connect per the circuit diagrams stored in the LV compartment. Refit the covers.',
      'Bus wires panel to panel: plug or clamp into the bus-wire terminal block.',
      'EMC: shields bonded all round at the cable end in the LV compartment, pigtails < 10 cm, shield used as PE marked green/yellow over its full length.',
    ],
  },
  {
    id: 'connClose', phase: 'Cables', title: 'Close the connection compartment', view: 'rear', ex: 0.25, truck: 'out', row: true, focus: ['rearWall', 'ledgeH', 'ledgeV', 'partition', 'protPlate'], joints: ['rearBase', 'rearH', 'rearV', 'partition', 'protPlate'],
    body: [
      'Before closing: no foreign objects, clean, every joint at control torque, screen earths connected, welded seams painted. Record the condition.',
      'Partition: screw all 15 bolts in to the end of the thread, then 25 Nm. Protection plate: 4 nuts M8, 25 Nm.',
      'Rear wall: insert by the handle, push down, 4 × M8x20 at the base 25 Nm. Sealing brackets into the vertical gaps. Horizontal ledge 9 × M8x25 + plain washers 25 Nm. Vertical ledges 14 × M8x20 each 25 Nm.',
    ],
  },
  {
    id: 'final', phase: 'Finish', title: 'Final checks', view: 'iso', ex: 0, truck: 'out', row: true, focus: ['bushU', 'bushL', 'shutters'], joints: [],
    body: [
      'Clean: vacuum and dry lint-free cloth, never compressed air. Do not wipe off functional grease.',
      'Spot-check every accessible joint at control torque: M8 25, M12 60, M16 90 Nm. Open closed compartments if there is any doubt.',
      'Bushings: open both shutters with the slip-on levers. The 6 silver-plated fixed contacts carry a thin, even film of Longterm 2 plus all round; tulip surfaces clean, dry, grease-free.',
      'Check the panel connection links, wiring duct covers, partition and rear-wall bolts with the torque wrench. Touch up paint with RAL 7035.',
      'HV door with ventilation flap: indicator must show operational position.',
    ],
  },
  {
    id: 'truckIn', phase: 'Finish', title: 'Truck in, interlocks, racking', view: 'side', ex: 0, truck: 'test', row: false, focus: ['breaker', 'truck', 'hvdoor'], joints: [], cut: true,
    body: [
      'With auxiliary voltage on, truck in test position and LV plug in: remove the 1 or 2 locking bolts of the solenoid interlocks from the truck mechanism.',
      'Tulip contacts undamaged and thinly greased with Molykote Longterm 2 plus. Trucks coded to their panels.',
      'Racking to service: breaker OPEN, earthing switch OPEN, HV door closed, LV plug in. Lift the operating slide, 5 mm double-bit key clockwise 90°, racking crank clockwise to the end stop, key back 90°, slide down. Indicator shows a vertical bar.',
      'Manual spring charge: hand crank on the shaft, hold the freewheel, ≈ 50 turns clockwise until CHARGED.',
    ],
  },
  {
    id: 'commission', phase: 'Commission', title: 'Test operation and first energising', view: 'iso', ex: 0, truck: 'service', row: true, focus: ['breaker'], joints: [],
    body: [
      'Check every interlock: racking only with breaker and earthing switch open and door closed; breaker only in an end position; earthing switch only in test position; door opens only in test position.',
      'Auxiliary voltage on (charging motors start). Rack each truck test ↔ service 5 times, each earthing switch 5 times, each breaker CLOSE/OPEN 5 times locally and remotely; check every indication.',
      'Update protection-relay firmware. Dry damp panels with 1–2 kW heaters, truck out.',
      'Energise: all doors closed, all breakers open, trucks in test, earthing switch CLOSED on panels without cables. Energise the incomer from the far end, rack in and close it. Check phase sequence of every further incomer, then feeders one by one.',
    ],
    warn: 'High-voltage test: short-circuit capacitive indicators and CT secondaries, disconnect VTs and surge arresters first; reset afterwards.',
  },
];

export const STEPS = [...INSTALL_STEPS, ...OPS_STEPS];

// ---------------------------------------------------------------------------------------------------- specs
export const RATINGS = [
  ['Rated voltage', '7.2 / 12 / 17.5 kV'],
  ['Power-frequency withstand', '20 / 28 / 38 kV (special: 32 kV at 7.2, 42 kV at 12)'],
  ['Lightning impulse withstand', '60 / 75 / 95 kV'],
  ['Rated frequency', '50 / 60 Hz'],
  ['Short-time withstand current', '≤ 40 kA, ≤ 3 s'],
  ['Peak withstand current', '100 / 104 kA'],
  ['Busbar current', '≤ 4000 A'],
  ['Feeder current', 'CB / disconnector ≤ 4000 A · contactor ≤ 400 A · switch-fuse ≤ 200 A'],
  ['Internal arc', 'IAC A FLR ≤ 40 kA 1 s (or A FL)'],
  ['Service continuity / partition', 'LSC 2B, PM (switch-disconnector panel LSC 2A, PI)'],
  ['Degree of protection', 'IP3XD enclosure, IP4X optional (sealed per drawings)'],
  ['Ambient', '−5 … +40 °C, 24 h mean ≤ 35 °C, ≤ 1000 m'],
  ['Storage', '−25 … +70 °C; seaworthy crate ≤ 6 months at ≤ 60 % RH'],
  ['Switching devices', '3AE1 / SION 3AE5 vacuum CB · 3TM3 (435 mm) / 3TL8 (600 mm) vacuum contactor · L-TRI 5F switch-fuse'],
];

export const FOUNDATION = [
  ['', '≤ 31.5 kA, 1350 deep', '40 kA, 1500 deep', '40 kA, 1650 deep'],
  ['Base frame depth', '1314', '1464', '1614'],
  ['Fixing holes (oblong 60 x 20)', '68 from rear, 1195 apart, panel centre', '68 from rear, 1345 apart', '218 from rear'],
  ['HV cable cut-out', 'from 125 to 570 from rear (445 long); 440 wide (600 panel)', 'from 125 to 670 from rear (545 long)', 'from 275 from rear'],
  ['HV cut-out width', '600: 440 · 1000: 700', '435: 265 · 600: 440 · 800: 640 · 1000: 700', 'as 1500'],
  ['Control cable cut-out', '65 x 180 at the left edge, top 1065 from rear', 'top 1215 from rear', 'top 1365 from rear'],
  ['Wall behind panels', '≥ 150 (contactor ≥ 100)', '≥ 150', '≥ 110 (1540); ≥ 800 with rear box'],
];

export const ROOM = [
  ['Operating aisle', '≥ 1250 mm to replace a device; ≥ 1700 mm for extension or panel replacement'],
  ['Side walls', '≥ 150 mm; ≥ 500 mm for maintenance and on the side where the duct leaves'],
  ['Rear', '≥ 500 mm for maintenance access, ≥ 800 mm for operation from the rear'],
  ['Ceiling (duct out of the building)', '≥ 2500 mm (≥ 2800 mm with IPX1/2 roof)'],
  ['Ceiling (absorber)', '12 kV: ≥ 2800 (25 kA), ≥ 3000 (31.5 kA), ≥ 3500 (40 kA); 17.5 kV: ≥ 3500'],
  ['Duct wall opening', '537 x 249 mm, bottom edge 2000 mm above floor; exit flange 537 x 248.5 with M8 press nuts (3 across at 230, 3 down at 85)'],
  ['Foundation rails (drawing)', '3 rails per panel, L 100 x 100 x 8 EN 10056, 4 x M12 anchors each, spacing 595 / 1195 (435: 688 / 1287.5)'],
  ['Earthquake points', 'M12 in tapped rails: drill Ø 6 pilot, Ø 10.2, tap M12; template widths 440 / 605 / 805 / 1005'],
];

export const DIMENSIONS = [
  ['Height', '2300 mm standard LV · 2350 high LV / busbar add-on compartment · 2450 forced ventilation · 2500 with absorber'],
  ['Depth', '1350 or 1500 mm (≤ 2500 A, ≤ 31.5 kA) · 1500 mm at 40 kA · 1540 / 1650 mm with 3150 / 4000 A feeders · 435 mm contactor 1400 mm · rear duct + 600 mm'],
  ['Standing surface depth', '1314 mm (1350 panel) · 1363 mm (1400) · 1464 mm (1500 / 1540 / 1650)'],
  ['Width, circuit-breaker panel', '600 mm ≤ 1000 A · 800 mm 1250–2000 A (40 kA also 2500/3150 A) · 1000 mm 2500–4000 A'],
  ['Width, other', 'Disconnecting 800 / 1000 · metering 800 · contactor 435 or 600 · switch-disconnector 800 · bus sectionalizer 2 × 800 / 2 × 1000'],
  ['Evacuation duct', '2 mm galvanised sheet, cross-section 530 x 245 mm, bolted M8-8.8, lateral or rear'],
  ['Internal split (drawing)', 'Rear compartments 662 / 762 / 812 mm, front 688 / 738 mm; connection compartment top 1075 mm; LV compartment 630 (or 980) high, 406 deep, from 1370 mm; pressure relief duct to 2300 mm behind it'],
  ['Busbar copper', '1250 A 1 x 80 x 10 or 1 x 100 x 10 · 2500 A 2 x 100 x 10 · 4000 A 3 x 120 x 10 (Cu)'],
  ['Panel weights (drawing)', '435: 700–770 · 600: 800–950 · 800: 1020–1320 · 1000: 1230–1650 kg; with rear box 950–1890 kg'],
];

export const CABLES = [
  ['', 'Single-core (≤ 12 / 17.5 kV)', 'Single-core, 435 contactor', 'Three-core (all)'],
  ['Sealing end Ø', '≤ 95 mm', '≤ 60 mm', '≤ 60 mm'],
  ['Sealing end length incl. lug', '≤ 450 mm', '≤ 350 mm', '≤ 300 mm'],
  ['Lug to splitting cap', '—', '—', '≤ 500 mm'],
  ['Cross-section', '≤ 500 mm²', '≤ 240 mm²', '≤ 240 mm²'],
];

export const LUBES = [
  ['Busbar + earth contact faces', 'Vaseline, thin film', 'Before every bolted copper joint'],
  ['Bushing fixed contacts (silver)', 'Molykote Longterm 2 plus (8BX1022, 1 kg)', 'Thin, even, all round'],
  ['Truck tulip contacts', 'Molykote Longterm 2 plus', 'Thin film'],
  ['Earthing-switch fixed contacts', 'Molykote Longterm 2 plus', '—'],
  ['Switch-fuse fixed contacts', 'Molykote Longterm 2 plus', '—'],
  ['Guide rails of truck', 'Klüber ISOFLEX TOPAS L 32 (3AX1133-3E, 1 kg)', '—'],
  ['Shutter guiding linkage', 'WD-40 on a cloth (clean)', 'Do not spray into the mechanism'],
  ['Bolt and nut threads', 'none: dry, grease-free', 'All busbar joints'],
  ['Sealing gaps ≤ 2.5 mm, open holes', 'SIKAFLEX 221-GR 310 ML', 'IP3XD / IP4X'],
];

export const TOOLS = [
  'Torque wrenches 8–20 Nm and 20–70 Nm',
  'Electric / pneumatic driver 110 Nm for M16 hex bolts',
  'Ring spanners 8, 10, 12, 16, 20 · open-end 19 · hex socket key 6',
  'Sockets for M8, M10, M12, M16, M20 · ½" and ⅜" ratchets with extensions',
  'Shims 0.5–1 mm · plumb bob · water level · guide string',
  'Wire brush and copper sponge · lint-free cloths · vacuum cleaner',
  'Phase tape L1 L2 L3 gn/ye · thickness gauge (switch-fuse: ≥ 0.1 mm blade to notch)',
  'Lifting truck, roller pads + boards, hydraulic jack 2–3 t, chains / shackles',
  'Racking crank, 5 mm double-bit key (truck), 3 mm double-bit key (LV door), hand crank, earthing-switch lever, shutter slip-on levers',
];

export const MAINT = [
  ['Visual inspection', 'Every year', 'Paint, dust on PRC ventilation grids and fan box, condensation in every 3rd switching-device compartment, partial-discharge noise, accessories complete.'],
  ['Maintenance', 'Every 10 years or by events', 'After short-circuit making of an earthing switch (inspect after 2), or when a device reaches its operating cycles. Grease guide rails, shutter linkage, earthing-switch and bushing contacts.'],
  ['Overpressure monitors', 'With maintenance', 'Test unit on the tube connector: must trip between 8 and 12 on the manometer.'],
  ['Forced-ventilation fan', 'Before 40 000 h', 'ebm-papst R2E270-AA01-05, 280 W / 50 Hz, 430 W / 60 Hz.'],
  ['Circuit-breaker / contactor', 'Per device instructions', '3AE: 9229 0001 176 0F (EN). 3TM3: 9229 0090 176 0A (EN).'],
];

export const INTERLOCKS = [
  ['Rack truck to service', 'Truck inserted + locked, LV plug in, HV door closed, CB OPEN, earthing switch OPEN'],
  ['Rack truck to test', 'CB OPEN'],
  ['Close CB', 'Truck in an end position (test or service), undervoltage release not operated'],
  ['Operate feeder earthing switch', 'Truck in test position'],
  ['Open HV door', 'Truck in test position'],
  ['Close HV door', 'LV plug plugged on'],
  ['Plug LV connector', 'Coding of plug and truck match'],
  ['Busbar earthing switch', 'Padlock or electromagnetic interlock only'],
];
