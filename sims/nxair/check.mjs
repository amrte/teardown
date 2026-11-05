#!/usr/bin/env node
// Clearance checker for the NXAIR model: builds the panel (and the breaker) in node, takes the box of every
// primitive in world space and reports pairs from different parts / sub-components that interpenetrate by more
// than TOL mm on all three axes. Whitelisted pairs are contacts that exist in the real switchgear (bolted joints,
// conductors passing through bushings, parts seated on frames); each has a reason.
//
//   node sims/nxair/check.mjs [--width 800] [--all]
import * as THREE from 'three';
import {buildPanel, lvCableGeometry, makeMaterials, SIZES, TRAVEL} from './model.js';
import {BK_SPEC, buildBreaker} from './breaker.js';
import {LV_PARTS, buildLV} from './lv.js';
import {PartBuilder} from './geom.js';
PartBuilder.keepGeo = true;
import {DEPTHS, JOINTS, WIDTHS} from './data.js';

const TOL = 2; // mm of penetration tolerated on the smallest axis
const args = process.argv.slice(2);
const widths = args.includes('--all') ? [600, 800, 1000] : [Number(args[args.indexOf('--width') + 1]) || 800];

// [regexA, regexB, reason]: matched against "part:label" of either primitive
const ALLOW = [
  [/./, /Shim/, 'shims sit between frame and rail'],
  [/^cables:HV cable/, /^floorPlate:/, 'cable passes through its rubber sleeve / the gland plate hole (r 52 > sleeve bore 24 > cable 23)'],
  [/^busbars:Insulating half-shells/, /^feeders:Feeder bar/, 'half-shells enclose the busbar-to-feeder joint'],
  [/^feeders:Feeder bar/, /^bushU:Upper bushing tail/, 'feeder bar bolted to the bushing conductor inside the tail'],
  [/^connBars:Cable connection bar/, /^bushL:Lower bushing tail/, 'connection bar bolted to the bushing conductor inside the tail'],
  [/^connBars:Cable connection bar/, /^cts:Block-type current transformer/, 'primary conductor passes through the CT window'],
  [/^busbars:Main busbar/, /^transPart:Transverse partition plate/, 'busbars pass through the openings (12 mm clearance)'],
  [/^bushL:Lower bushing/, /^partition:Vertical partition/, 'bushing passes through the partition hole (r spoutRo + 3)'],
  [/^lvPlug(#[^:]*)?:LV plug cable/, /^(bkX0plug|breaker|mech):-X0 cable gland|^lvPlug:LV plug \(64-pole/, 'cable leaves the -X0 gland on the breaker and is moulded into the plug'],
  [/^bk(Tulips|Arms|Sleeves):/, /^(partition:Vertical partition|shellB:Bushing plate)/, 'arms pass through the bushing holes of the partition / plate (radial check below)'],
  [/^bolt:cbTulip/, /^bush[UL]:/, 'contact-system joint inside the bushing bore in service'],
  [/^hvdoor(#[^:]*)?:Shared operating slide/, /^hvdoor:Actuating opening/, 'the slide covers the actuating openings on the door'],
  [/^feeders:Feeder bar/, /^ltriSwitch:Upper fixed contact/, 'feeder bar bolted to the upper fixed contact'],
  [/^cts:Primary terminal/, /^(connBars:|ltriSwitch:Connection)/, 'bar bolted to the CT primary terminal'],
  [/^ltriSwitch:Earthing-switch fixed contact/, /^esw:Earthing knife/, 'closed earthing knife on its fixed contact'],
  [/^bkArms:Threaded bolt/, /^breaker:Insulating body of the disconnector link/, 'threaded bolt screwed into the metal insert of the link body'],
  [/^breaker:(Contact arm|Contact finger|Ring spring|Contact system cage)/, /^(bush[UL]:|shellB:Bushing plate|partition:Vertical partition)/, 'contact arm of the metering part in the bushing bore (radial check below)'],
  [/^wvt:VT bushing/, /^partition:Vertical partition/, 'VT bushing through its hole in the partition'],
  [/^wvt:Lead from the VT bushing/, /^connBars:Cable connection bar/, 'lead bolted to the connection bar'],
  [/^endWall:/, /^busbars:Main busbar|^bolt:(prcUp|prcLow|lv|earthLink)/, 'at the row end the busbars stop at the end panel and the panel-to-panel bolts are not fitted (drawn on every panel)'],
  [/^earthDev:Earthing tulip|^earthDev:Spindle/, /^bush[UL]:|^shutters:|^partition:Vertical partition|^shellB:Bushing plate/, 'earthing tulip on the fixed contact inside the bushing bore, spindle through the open shutter'],
  [/Padlock shackle/, /Operating slide/, 'the padlock hangs in the hole of the operating slide'],
  [/^lv(#[^:]*)?:Operating slide \(busbar/, /^lv:(Actuating opening: busbar|LV door)/, 'the slide covers the actuating opening on the door'],
  [/^arresters:Connection strap/, /^connBars:Cable connection bar/, 'strap bolted to the connection bar'],
  [/^busES:Riser|^busES:Bushing in the floor/, /^(shellB:Pressure relief flap|busESbox:Busbar earthing switch box: floor|busbars:Main busbar)/, 'riser bolted on the busbar, through its bushing in the box floor'],
  [/^busES:Drive/, /^(lv:|busESbox:|prc:PRC front wall)/, 'drive rod through the LV compartment and the duct wall into the box'],
  [/^bk(Tulips|Arms|Sleeves):/, /^bush[UL]:/, 'contact systems, arms and separating shells inside the bushing bore: verified radially below'],
  [/^bkTulips:Contact finger|^bkTulips:Ring spring|^bkTulips:Contact system cage/, /^bush[UL]:Fixed contact/, 'the fingers grip the fixed contact (radial check below)'],
  [/^bush[UL]:/, /^(shellB:Bushing plate|partition:Vertical partition)/, 'bushing passes through its hole in the plate / partition (r spoutRo + 3)'],
  [/^bush[UL]:.*rear terminal/, /^(feeders:Feeder bar|connBars:Cable connection bar)/, 'bar bolted to the rear terminal of the bushing'],
  [/^connBars:Cable connection bar/, /^cts:Block-type current transformer/, 'primary conductor passes through the CT window'],
  [/^bkTruck:Wheel/, /^shelf:Guide rail/, 'wheels run on the guide rails'],
  [/^bkTruck:Sliding earthing contact/, /^shelf:Truck earthing contact rail/, 'sliding earthing contact on its rail'],
  [/^hvdoor:Operating slide/, /^hvdoor:Actuating opening/, 'the slide covers the actuating opening (it is the shutter of that opening)'],
  [/^breaker:(Tulip|Contact system)/, /^bush[UL]:/, 'tulip inside the bushing bore: verified radially below'],
  [/^rails:/, /^base:/, 'frame stands on the rails'],
  [/^rails:Floor cut-outs/, /./, 'floor slab under everything'],
];
// moving sub-assemblies carry '#label' in their key; allow-list patterns match the key without it
const allowIn = (list, a, b) => list.some(([x, y]) => (x.test(a) && y.test(b)) || (x.test(b) && y.test(a)));
const allowed = (a, b) => allowIn(ALLOW, a, b);

const VIS = Number(process.env.VIS || 1.6);
function boltBoxes(panel) {
  const out = [];
  for (const [jid, list] of Object.entries(panel.anchors)) {
    for (const {group, list: pts, nut} of list) {
      if (group.visible === false) continue;
      const own = group.userData.part;
      const size = /M1[026]/.test(jid) ? 'M12' : 'M8';
      for (const {p, n} of pts) {
        const {d, s, k} = SIZES[jidSize[jid] || 'M8'];
        const r = (s / Math.sqrt(3)) * VIS, h = (d * 0.2 + k) * VIS;
        const nn = n.clone().normalize();
        const a = p.clone(), b = p.clone().addScaledVector(nn, h);
        const box = new THREE.Box3().setFromPoints([a, b]).expandByVector(new THREE.Vector3(r, r, r).multiply(new THREE.Vector3(1 - Math.abs(nn.x), 1 - Math.abs(nn.y), 1 - Math.abs(nn.z))));
        box.applyMatrix4(group.matrixWorld);
        out.push({part: 'bolt', own, label: jid, key: `bolt:${jid}`, pkey: `bolt:${jid}`, box});
        if (nut) {
          const na = p.clone().addScaledVector(nn, -nut), nb = na.clone().addScaledVector(nn, -h);
          const nbox = new THREE.Box3().setFromPoints([na, nb]).expandByVector(new THREE.Vector3(r, r, r).multiply(new THREE.Vector3(1 - Math.abs(nn.x), 1 - Math.abs(nn.y), 1 - Math.abs(nn.z))));
          nbox.applyMatrix4(group.matrixWorld);
          out.push({part: 'bolt', own, label: jid + ' nut', key: `bolt:${jid} nut`, pkey: `bolt:${jid} nut`, box: nbox});
        }
      }
    }
  }
  return out;
}
const jidSize = Object.fromEntries(JOINTS.map((j) => [j.id, j.size]));
function collect(root) {
  root.updateMatrixWorld(true);
  const out = [];
  root.traverse((o) => {
    const prims = o.userData?.prims;
    if (!prims || o.visible === false) return;
    let vis = true;
    for (let p = o; p; p = p.parent) if (p.visible === false) vis = false;
    if (!vis) return;
    // moving sub-assemblies (rig groups with their own label, e.g. the charging-shaft set, the spring, the main
    // shaft) count as separate assemblies, so they are checked against the static parts of their own part too
    let part = null, sub = null;
    for (let p = o; p && !part; p = p.parent) { part = p.userData?.part; if (!part && !sub && p.userData?.label) sub = p.userData.label; }
    const base = part;
    if (sub) part = `${part}#${sub}`;
    for (const pr of prims) {
      let box;
      if (pr.geo) {
        // exact box of the transformed vertices (rotated knives, gear, levers)
        box = new THREE.Box3();
        const pos = pr.geo.attributes.position, v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
      } else box = pr.box.clone().applyMatrix4(o.matrixWorld);
      out.push({part, label: pr.label, key: `${part}:${pr.label}`, pkey: `${base}:${pr.label}`, box});
    }
  });
  return out;
}

// the LV cable is bent: its box covers the top of the breaker. Judge it by its horizontal run instead (lvRun: y of the
// run's underside, z range), which must pass above the part.
let lvRun = null;
const cableClear = (cab, part) => {
  if (!lvRun) return false;
  const b = part.box;
  const offRun = b.max.y < lvRun.y - 1 || b.max.z < lvRun.z0 || b.min.z > lvRun.zDown + 10; // under or beside the run
  const offDrop = b.max.z < lvRun.zDown - 10 || b.min.z > lvRun.zDown + 10 || b.max.y < lvRun.y1 - 24; // clear of the drop
  return offRun && offDrop;
};
function clashes(list, sameKeyOk = true) {
  const res = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (a.part === b.part && a.label === b.label && sameKeyOk) continue;
      if (a.part === b.part) continue; // within one assembly the builder places parts deliberately; checked visually
      if ((a.part === 'bolt' && a.own === b.part) || (b.part === 'bolt' && b.own === a.part)) continue; // a bolt in its own part
      if ((a.part === 'bolt' && /^(truck|mech|breaker)$/.test(a.own) && /^bk/.test(b.pkey)) || (b.part === 'bolt' && /^(truck|mech|breaker)$/.test(b.own) && /^bk/.test(a.pkey))) continue; // joint markers of the breaker
      const ix = Math.min(a.box.max.x, b.box.max.x) - Math.max(a.box.min.x, b.box.min.x);
      const iy = Math.min(a.box.max.y, b.box.max.y) - Math.max(a.box.min.y, b.box.min.y);
      const iz = Math.min(a.box.max.z, b.box.max.z) - Math.max(a.box.min.z, b.box.min.z);
      const pen = Math.min(ix, iy, iz);
      if (pen <= TOL) continue;
      if (allowed(a.pkey, b.pkey)) continue;
      if (/^bk/.test(a.pkey) && /^bk/.test(b.pkey)) continue; // inside the breaker: checked on its own below
      if ((/^lvPlug#LV plug cable/.test(a.key) || /^lvPlug#LV plug cable/.test(b.key)) && /^(bk|breaker:|mech:)/.test(/^(bk|breaker:|mech:)/.test(a.pkey) ? a.pkey : b.pkey) && cableClear(null, /^(bk|breaker:|mech:)/.test(a.pkey) ? a : b)) continue; // box of a bent cable
      res.push({a: a.key, b: b.key, pa: a.pkey, pb: b.pkey, pen: Math.round(pen), at: [Math.round((Math.max(a.box.min.x, b.box.min.x) + Math.min(a.box.max.x, b.box.max.x)) / 2), Math.round((Math.max(a.box.min.y, b.box.min.y) + Math.min(a.box.max.y, b.box.max.y)) / 2), Math.round((Math.max(a.box.min.z, b.box.min.z) + Math.min(a.box.max.z, b.box.max.z)) / 2)]});
    }
  }
  return res;
}

// radial checks for coaxial parts that box tests cannot judge
function radial(panel) {
  const d = panel.dims, out = [];
  if (d.tulipIn < d.contactR - 0.01) out.push(`tulip fingers cut into the fixed contact (${d.tulipIn} < ${d.contactR})`);
  if (d.tulipOut > d.spoutRi - 3) out.push(`tulip/garter (${d.tulipOut}) touches the bushing bore (${d.spoutRi})`);
  if (d.armR > d.spoutRi - 3) out.push(`contact arm (${d.armR}) touches the bushing bore`);
  if (d.sleeveOut > d.spoutRi - 3) out.push(`separating shell (${d.sleeveOut}) touches the bushing bore`);
  if (d.zTulip0 > d.zFC1 - 20) out.push(`contact fingers overlap the fixed contact by less than 20 mm (${d.zFC1 - d.zTulip0})`);
  return out;
}
// breaker: assemblies that are mounted into each other in the real breaker
const BK_ALLOW = [
  [/^bkShell:/, /^bk(VI|VIin|Rods|Lower|Upper|Shaft):/, 'inside the U of the pole shell, open to the rear (radial check below)'],
  [/^bkVI:/, /^bkVIin:/, 'internals inside the interrupter bottle (radial check below)'],
  [/^bkVIin:(Moving|Fixed) contact stem|^bkVIin:Metal bellows/, /^bk(Lower|Upper|VI|Rods):/, 'stems run coaxially through flanges, guide bushing and couplings'],
  [/^bkRods:Guide bolt/, /^bkVIin:(Spring cup|Moving contact stem)/, 'guide bolt slides inside the spring cup'],
  [/^bkRods:Contact-pressure spring/, /^bkRods:Top coupling|^bkVIin:Spring cup|^bkRods:Guide bolt/, 'spring seated on the coupling and in the cup, around the guide bolt'],
  [/^bkArms:Threaded bolt/, /^bk(Upper|Lower):/, 'threaded bolt screwed 20 mm into the pole terminal'],
  [/^bkArms:/, /^bkTulips:/, 'contact system mounted coaxially on the arm'],
  [/^bkSleeves:/, /^bkArms:/, 'separating shell slid coaxially over the conductor (radial check below)'],
  [/^bkShaft:Pole lever/, /^bkFrame:Rear plate/, 'lever passes through its slot in the rear plate'],
  [/^bkShaft:(Pole lever|Lever pin)/, /^bkRods:Insulator foot eye/, 'lever fork and pin engage the insulator foot'],
  [/^bkShaft:Main shaft/, /^bkFrame:(Side plate|Mechanism mounting plate)/, 'shaft runs through the side plates and the mechanism plate'],
  [/^bkShaft:(Main shaft|Opening spring leg)/, /^bkOpeningSpring:Opening spring, torsion/, 'torsion springs coaxial on the main shaft (radial check below)'],
  [/^bkClosingSpring:Charging shaft/, /^bkFrame:Mechanism mounting plate|^bkGear:Gear unit|^bkCloseLink:Closing cam/, 'charging shaft runs through the mechanism plate into the gear unit'],
  [/^bkClosingSpring:Charging gear wheel/, /^bkGear:Gear unit/, 'gear wheel inside the gear-unit housing'],
  [/^bkCloseLink:Closing cam/, /^bkCloseLink:Closing-lever roller/, 'the roller runs on the cam (contact; the lobe is computed so it never cuts in)'],
  [/^bkCloseLink:Push rod/, /^bkCloseLink:Push-rod pin|^bkShaft:Drive lever/, 'push rod on its pins'],
  [/^bkCloseLink:Closing lever/, /^bkCloseLink:Closing-lever pivot pin/, 'lever on its pivot pin'],
  [/^bkOpenLatch:(Opening latch|Pawl)/, /^bkOpenLatch:Opening-latch pivot pin/, 'pawl on its pivot pin'],
  [/^bkShaft:Main shaft/, /^bkShaft:Main-shaft bearing/, 'shaft in its bearings'],
  [/^bkS1:-S1 coupling rod/, /^bkShaft:Auxiliary switch drive crank|^bkS1:-S1 operating lever/, 'rod ends on the shaft crank pin and on the -S1 lever'],
  [/^bkCover:Push button (ON|OFF) \(56\.[12]\)$/, /^bkCover:Cover \(20\.1\)/, 'a pressed push button sinks into its cut-out'],
  [/^bkCover:/, /^bkCover:/, 'buttons, flags and the cover move as one unit; checked with the cover fitted'],
  [/^bkCloseRelease:Release-shaft bearing/, /^bkCloseRelease:Closing release shaft|^bkFrame:Mechanism mounting plate/, 'release shaft runs in its bearings; the right bearing sits in the mechanism plate'],
  [/^bkCloseRelease:Closing release shaft/, /^bkFrame:Mechanism mounting plate/, 'release shaft passes through the bearing bore of the mechanism plate'],
  [/^bkY9:-Y9 (coil|yoke)/, /^bkY9:-Y9 (push pin|plunger)/, 'plunger is pulled into the core bore; the push pin runs through the bore and the hole in the top yoke'],
  [/^bkCloseRelease:Release link/, /^bkClosingSpring:Closing latch: release arm|^bkCloseRelease:Release arm for the closing latch/, 'link on the arm pins'],
  [/^bkCloseRelease:Release arm for (the ON button|-Y9)/, /^bkCover:Push button ON \(56.1\): push finger|^bkY9:-Y9 push pin/, 'push finger and push pin bear on the release arms (contact)'],
  [/^bkTool:Hand crank/, /^bkCover:|^bkGear:Hand-crank coupling|^bkGear:Slip clutch/, 'crank through the cover opening onto the coupling'],
  [/^bkX0plug:/, /^bkX0:-X0 (pin|locking bow)/, 'plug pushed over the pins, held by the locking bows'],
  [/^bkKey:Key lock 3AX1437, lock cylinder/, /^bkCover:/, 'lock cylinder through its hole in the cover'],
  [/^bkInterlock:Mechanical interlock plunger/, /^bkFrame:(Housing floor|Base frame)/, 'plunger passes through the floor from below'],
  [/^bkClosingSpring:Spring hook/, /^bkClosingSpring:Closing spring \(55\)/, 'top hook through the end coil of the spring'],
  [/^bkClosingSpring:Spring eye/, /^bkClosingSpring:(Closing spring \(55\)|Link rod|Crank pin)/, 'bottom eye in the spring, link rod in the eye'],
  [/^bkClosingSpring:Link rod/, /^bkClosingSpring:Crank pin/, 'link rod on the crank pin'],
  [/^bkCover:Push button (ON|OFF) \(56\.[12]\): plunger/, /^bkCover:Cover \(20\.1\)/, 'plunger passes through its hole in the cover'],
];
const mats = makeMaterials([]);
let total = 0;
for (const W of widths) {
  const EQS = [null, {vds: 'capdis', busES: true, keys: true, padlock: true, motor: true, arresters: true, endWalls: true, relay: '7SJ85', arc: 'sip', arcPress: true}, {vds: 'vois', fan: true, keys: true, padlock: true, motor: true, arresters: true, endWalls: true, ct: false, vt: false, relay: 'none'}, {siq: true, arc: 'aq', arcPress: true, keys: true, padlock: true, motor: true, arresters: true, endWalls: true}];
  // other panel types: once per allowed width and depth (busbar 2500 A), with and without options
  const PTS = {dp: [800, 1000], mp: [800], wvt: [800, 1000], cp600: [600], ltri: [800]};
  for (const D of DEPTHS) for (const bus of [1250, 2500, 4000]) for (const eq of EQS) for (const ptype of ['cbp', ...Object.keys(PTS)]) {
    if (eq && bus !== 2500) continue; // options: once per width and depth
    if (ptype !== 'cbp' && (bus !== 2500 || !PTS[ptype].includes(W) || (eq && eq.fan))) continue;
    const panel = buildPanel(mats, {W, D, bus, ur: 17.5, eq: eq || undefined, ptype});
    for (const r of radial(panel)) { console.log(`W${W} D${D}: ${r}`); total++; }
    for (const [truck, z] of [['service', 0], ['test', TRAVEL], ...(eq ? [['out', 1150]] : [])]) for (const esw of [0, 1]) {
      for (const k of ['truck', 'mech', 'breaker']) for (const g of panel.parts[k] || []) g.position.z = z;
      const edSide = truck === 'out' ? (esw ? 'lower' : 'upper') : null;
      for (const g of panel.parts.shutters || []) for (const c of g.children) if (c.userData.shut) { c.userData.y0 ??= c.position.y; c.position.y = c.userData.y0 + c.userData.shut * c.userData.travel * (truck === 'service' || (edSide === 'upper' && c.userData.shut > 0) || (edSide === 'lower' && c.userData.shut < 0) ? 1 : 0); }
      { const L = panel.lvCable, pr = panel.root.position; lvRun = {y: L.y0 - 3 - 8 + pr.y, z0: L.z0 + pr.z, z1: L.z1 + z + 30 + pr.z, zDown: L.z1 + z + 31 + pr.z, y1: L.y1 + 24 + pr.y}; }
      for (const g of panel.parts.lvPlug || []) g.traverse((c) => { if (c.userData.lvCable) c.visible = truck !== 'out'; });
      for (const g of panel.parts.lvPlug || []) g.traverse((c) => { if (c.userData.lvCable) { c.geometry = lvCableGeometry(panel.lvCable, z); c.geometry.computeBoundingBox(); c.userData.prims = [{label: 'LV plug cable (64-pole)', box: c.geometry.boundingBox.clone()}]; } });
      for (const g of panel.parts.esw || []) for (const c of g.children) if (c.userData.blade) c.rotation.x = -c.userData.closedAngle + (c.userData.openDelta ?? 1.25) * (1 - esw);
      // L-TRI: the earthing switch closes only with the switch open (O §7.3)
      for (const g of panel.parts.ltriSwitch || []) for (const c of g.children) if (c.userData.ltBlade) c.rotation.x = esw ? c.userData.open : c.userData.closed;
      for (const g of panel.parts.busES || []) for (const c of g.children) if (c.userData.busBlade) c.rotation.x = esw ? c.userData.closed : c.userData.open;
      // breaker out: earthing device fitted on the upper (ES open) or lower (ES closed) contacts, that shutter open
      for (const g of panel.parts.earthDev || []) g.visible = truck === 'out' && g.userData.earthDev === (esw ? 'lower' : 'upper');
      if (truck === 'service' && esw === 1) continue; // interlocked, cannot exist
      panel.root.updateMatrixWorld(true);
      const res = clashes(collect(panel.root).concat(args.includes('--bolts') ? boltBoxes(panel) : []));
      if (res.length) {
        console.log(`\n== ${ptype} W${W} D${D} ${bus} A ${eq ? JSON.stringify(eq) : ''} · truck ${truck} · ES ${esw ? 'closed' : 'open'}: ${res.length}`);
        const seen = new Set();
        for (const r of res.sort((x, y) => y.pen - x.pen)) {
          const k = [r.a, r.b].sort().join(' × ');
          if (seen.has(k)) continue;
          seen.add(k);
          console.log(`  ${String(r.pen).padStart(4)} mm  ${r.a}  ×  ${r.b}  @ ${r.at.join(',')}`);
        }
      }
      total += res.length;
    }
  }
}
console.log(`\n${total ? 'CLASHES: ' + total : 'clean'}`);
if (total) process.exitCode = 1;

// ------------------------------------------------------------------------------------------------ breaker tab
if (args.includes('--breaker') || args.includes('--all')) {
  let bt = 0;
  // the Breaker-tab breaker, then the versions built into the 600 / 800 / 1000 mm panels (fewer poses)
  for (const [W, spec, full] of [['3AE5 12 kV 1250 A 31.5 kA', BK_SPEC, true], ['panel 600', {P: 150, TD: 275, armD: 40, fingers: 13}], ['panel 800', {P: 210, TD: 275, armD: 60, fingers: 26}], ['panel 1000', {P: 275, TD: 310, armD: 79, fingers: 32}]]) {
    const bk = buildBreaker(mats, spec);
    const dd = bk.dims;
    if (dd.viR >= dd.shellIn) { console.log(`breaker W${W}: interrupter (${dd.viR}) touches the pole shell (${dd.shellIn})`); bt++; }
    if (dd.viFront >= dd.shellFrontIn) { console.log(`breaker W${W}: interrupter touches the front wall of the pole shell`); bt++; }
    if (dd.sleeveIn <= dd.armR) { console.log(`breaker W${W}: separating shell bore touches the contact arm`); bt++; }
    if (dd.torsionIn <= dd.mainShaftR) { console.log(`breaker W${W}: torsion spring bore touches the main shaft`); bt++; }
    const EQ = [{}, {s1: '12', slot2: 'Y4', slot3: 'Y6', lv: 'strip', y8e: true, key: false}, {slot2: 'Y7', slot3: 'Y2', y8e: true, key: true}, {slot2: 'none', slot3: 'Y4', heater: false, s12: false}];
    const POSES = [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0, 85], [0, 0.5, 265], [0, 1, 360], [0, 0, 200], [0, 0, 245], [0, 0, 275], [0, 0, 300], [0, 0, 330], [1, 0, null, 1], [0, 1, null, 2], [1, 1, null, 3], [1, 0, 170, 0, 1], [1, 0, 175, 0, 0.5], [0.95, 0, 185, 1, 1]];
    for (const [c, s, crank, ei, pClose = 0] of (full ? POSES : POSES.filter((q, k) => k < 4 || k === 6))) {
      bk.setEquip(EQ[ei || 0]);
      bk.setScene(ei === 2 ? {tool: 1, toolRot: 1.3, key: 1, y7: 0, offHeld: 1} : ei === 3 ? {cover: 1} : {tool: 0, key: 0, y7: 1, offHeld: 0, cover: 0});
      bk.pose({c, s, crank, pClose});
      const res = clashes(collect(bk.root)).filter((r) => !allowIn(BK_ALLOW, r.pa, r.pb));
      if (res.length) {
        console.log(`\n== breaker W${W} spring ${c} contacts ${s}: ${res.length}`);
        const seen = new Set();
        for (const r of res.sort((x, y) => y.pen - x.pen)) {
          const k = [r.a, r.b].sort().join(' × ');
          if (seen.has(k)) continue;
          seen.add(k);
          console.log(`  ${String(r.pen).padStart(4)} mm  ${r.a}  ×  ${r.b}  @ ${r.at.join(',')}`);
        }
      }
      bt += res.length;
    }
  }
  console.log(`\nbreaker: ${bt ? 'CLASHES: ' + bt : 'clean'}`);
  if (bt) process.exitCode = 1;
}

// ------------------------------------------------------------------------------------------------ LV tab
const LV_ALLOW = [
  [/^loom:Door loom/, /^(relay|relayTerm|lvDoor|lrm|lvBox|lvPlate|auxDev|busWire):/, 'curved loom: its box spans half the door; checked in renders'],
  [/^loom:Single wire/, /^(mcb|terms|auxDev|lvPlate):/, 'wire leaves the device terminal and enters the duct'],
  [/^relay:Housing|^relay:Heat-sink/, /^lvDoor:Door$/, 'housing passes through the door cut-out (148 × 246 vs 145 × 244)'],
  [/^socket:/, /^lvBox:Floor/, 'socket hangs under the floor opening'],
  [/^plugs:Cable from the panel/, /^lvBox:Floor/, 'cable comes through the floor opening'],
];
if (args.includes('--lv') || args.includes('--all')) {
  let lt = 0;
  for (const W of [600, 800, 1000]) for (const door of [0, 1]) for (const ex of [0]) {
    const lv = buildLV(mats, {W});
    lv.pose({ex, door});
    // with the door open, door-mounted parts are rotated and their boxes inflate: they were checked against each other
    // with the door closed, so only door-mounted vs fixed parts are checked open
    const doorIds = new Set(LV_PARTS.filter((p) => p.door).map((p) => p.id).concat(['loom']));
    const res = clashes(collect(lv.root)).filter((r) => !allowIn(LV_ALLOW, r.pa, r.pb))
      .filter((r) => !(door && doorIds.has(r.a.split(':')[0]) && doorIds.has(r.b.split(':')[0])));
    if (res.length) {
      console.log(`\n== LV W${W} door ${door ? 'open' : 'closed'}: ${res.length}`);
      const seen = new Set();
      for (const r of res.sort((x, y) => y.pen - x.pen)) {
        const k = [r.a, r.b].sort().join(' × ');
        if (seen.has(k)) continue;
        seen.add(k);
        console.log(`  ${String(r.pen).padStart(4)} mm  ${r.a}  ×  ${r.b}  @ ${r.at.join(',')}`);
      }
    }
    lt += res.length;
  }
  console.log(`\nLV: ${lt ? 'CLASHES: ' + lt : 'clean'}`);
  if (lt) process.exitCode = 1;
}
