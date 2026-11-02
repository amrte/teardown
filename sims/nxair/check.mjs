#!/usr/bin/env node
// Clearance checker for the NXAIR model: builds the panel (and the breaker) in node, takes the box of every
// primitive in world space and reports pairs from different parts / sub-components that interpenetrate by more
// than TOL mm on all three axes. Whitelisted pairs are contacts that exist in the real switchgear (bolted joints,
// conductors passing through bushings, parts seated on frames); each has a reason.
//
//   node sims/nxair/check.mjs [--width 800] [--all]
import * as THREE from 'three';
import {buildPanel, lvCableGeometry, makeMaterials, SIZES, TRAVEL} from './model.js';
import {buildBreaker} from './breaker.js';
import {LV_PARTS, buildLV} from './lv.js';
import {PartBuilder} from './geom.js';
PartBuilder.keepGeo = true;
import {JOINTS, WIDTHS} from './data.js';

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
  [/^lvPlug:LV plug cable/, /^mech:LV plug carrier/, 'cable is clamped in the carrier'],
  [/^breaker:(Tulip|Contact system)/, /^bush[UL]:/, 'tulip inside the bushing bore: verified radially below'],
  [/^rails:/, /^base:/, 'frame stands on the rails'],
  [/^rails:Floor cut-outs/, /./, 'floor slab under everything'],
];
const allowed = (a, b) => ALLOW.some(([x, y]) => (x.test(a) && y.test(b)) || (x.test(b) && y.test(a)));

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
        out.push({part: 'bolt', own, label: jid, key: `bolt:${jid}`, box});
        if (nut) {
          const na = p.clone().addScaledVector(nn, -nut), nb = na.clone().addScaledVector(nn, -h);
          const nbox = new THREE.Box3().setFromPoints([na, nb]).expandByVector(new THREE.Vector3(r, r, r).multiply(new THREE.Vector3(1 - Math.abs(nn.x), 1 - Math.abs(nn.y), 1 - Math.abs(nn.z))));
          nbox.applyMatrix4(group.matrixWorld);
          out.push({part: 'bolt', own, label: jid + ' nut', key: `bolt:${jid} nut`, box: nbox});
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
    let part = null;
    for (let p = o; p && !part; p = p.parent) part = p.userData?.part;
    for (const pr of prims) {
      let box;
      if (pr.geo) {
        // exact box of the transformed vertices (rotated knives, gear, levers)
        box = new THREE.Box3();
        const pos = pr.geo.attributes.position, v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
      } else box = pr.box.clone().applyMatrix4(o.matrixWorld);
      out.push({part, label: pr.label, key: `${part}:${pr.label}`, box});
    }
  });
  return out;
}

function clashes(list, sameKeyOk = true) {
  const res = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (a.part === b.part && a.label === b.label && sameKeyOk) continue;
      if (a.part === b.part) continue; // within one assembly the builder places parts deliberately; checked visually
      if ((a.part === 'bolt' && a.own === b.part) || (b.part === 'bolt' && b.own === a.part)) continue; // a bolt in its own part
      const ix = Math.min(a.box.max.x, b.box.max.x) - Math.max(a.box.min.x, b.box.min.x);
      const iy = Math.min(a.box.max.y, b.box.max.y) - Math.max(a.box.min.y, b.box.min.y);
      const iz = Math.min(a.box.max.z, b.box.max.z) - Math.max(a.box.min.z, b.box.min.z);
      const pen = Math.min(ix, iy, iz);
      if (pen <= TOL) continue;
      if (allowed(a.key, b.key)) continue;
      res.push({a: a.key, b: b.key, pen: Math.round(pen), at: [Math.round((Math.max(a.box.min.x, b.box.min.x) + Math.min(a.box.max.x, b.box.max.x)) / 2), Math.round((Math.max(a.box.min.y, b.box.min.y) + Math.min(a.box.max.y, b.box.max.y)) / 2), Math.round((Math.max(a.box.min.z, b.box.min.z) + Math.min(a.box.max.z, b.box.max.z)) / 2)]});
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
  return out;
}
// breaker: assemblies that are mounted into each other in the real breaker
const BK_ALLOW = [
  [/^bkShell:/, /^bk(VI|VIin|Rods):|^bkLower:Guide/, 'inside the U of the pole shell (radial check below)'],
  [/^bkVI:/, /^bkVIin:/, 'internals inside the interrupter bottle (radial check below)'],
  [/^bkVIin:(Moving|Fixed) contact stem|^bkVIin:Metal bellows/, /^bk(Lower|Upper|VI|Rods):/, 'stems run coaxially through flanges, guide bushing and terminals'],
  [/^bkRods:/, /^bkLower:/, 'operating rod runs in the bore of the insulator and lower connection'],
  [/^bkArms:Threaded rod/, /^bk(Upper|Lower):/, 'threaded rod screwed into the pole terminal'],
  [/^bkArms:/, /^bkTulips:/, 'contact system mounted coaxially on the arm'],
  [/^bkShaft:Pole lever/, /^bkFrame:Separating panel|^bkLower:Insulator/, 'lever passes through its slot in the separating panel and the insulator'],
  [/^bkShaft:Pole lever/, /^bkRods:Rod end/, 'lever pin engages the rod end'],
  [/^bkUpper:/, /^bkVI:Fixed stem/, 'fixed stem bolted into the pole head'],
  [/^bkShaft:Main shaft/, /^bkOpeningSpring:Opening spring \(17\)/, 'torsion springs coaxial on the main shaft (radial check below)'],
  [/^bkMotor:Worm shaft/, /^bkFrame:Mechanism mounting plate/, 'worm shaft passes through the mounting plate'],
];
const mats = makeMaterials([]);
let total = 0;
for (const W of widths) {
  for (const D of [1350, 1500, 1650]) for (const bus of [1250, 2500, 4000]) {
    if (W === 600 && bus === 4000 && D === 1350) continue;
    const panel = buildPanel(mats, {W, D, bus, ur: 17.5});
    for (const r of radial(panel)) { console.log(`W${W} D${D}: ${r}`); total++; }
    for (const [truck, z] of [['service', 0], ['test', TRAVEL]]) for (const esw of [0, 1]) {
      for (const k of ['truck', 'mech', 'breaker']) for (const g of panel.parts[k] || []) g.position.z = z;
      for (const g of panel.parts.shutters || []) for (const c of g.children) if (c.userData.shut) { c.userData.y0 ??= c.position.y; c.position.y = c.userData.y0 + c.userData.shut * c.userData.travel * (truck === 'service' ? 1 : 0); }
      panel.parts.lvPlug[0].traverse((c) => { if (c.userData.lvCable) { c.geometry = lvCableGeometry(panel.lvCable, z); c.geometry.computeBoundingBox(); c.userData.prims = [{label: 'LV plug cable (64-pole)', box: c.geometry.boundingBox.clone()}]; } });
      for (const g of panel.parts.esw || []) for (const c of g.children) if (c.userData.blade) c.rotation.x = -c.userData.closedAngle + (c.userData.openDelta ?? 1.25) * (1 - esw);
      if (truck === 'service' && esw === 1) continue; // interlocked, cannot exist
      panel.root.updateMatrixWorld(true);
      const res = clashes(collect(panel.root).concat(args.includes('--bolts') ? boltBoxes(panel) : []));
      if (res.length) {
        console.log(`\n== W${W} D${D} ${bus} A · truck ${truck} · ES ${esw ? 'closed' : 'open'}: ${res.length}`);
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
  for (const W of [600, 800, 1000]) {
    const wd = WIDTHS[W];
    const bk = buildBreaker(mats, {P: wd.pitch, TD: W === 1000 ? 310 : 275, armD: wd.contact === 40 ? 40 : 60, fingers: wd.contact === 40 ? 13 : 26});
    const dd = bk.dims;
    if (dd.viR >= dd.shellIn) { console.log(`breaker W${W}: interrupter (${dd.viR}) touches the pole shell (${dd.shellIn})`); bt++; }
    if (dd.viRear <= dd.shellRear) { console.log(`breaker W${W}: interrupter pokes through the shell rear`); bt++; }
    if (dd.torsionIn <= dd.mainShaftR) { console.log(`breaker W${W}: torsion spring bore touches the main shaft`); bt++; }
    for (const [c, s] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      bk.pose({c, s});
      const res = clashes(collect(bk.root)).filter((r) => !BK_ALLOW.some(([x, y]) => (x.test(r.a) && y.test(r.b)) || (x.test(r.b) && y.test(r.a))));
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
    const res = clashes(collect(lv.root)).filter((r) => !LV_ALLOW.some(([x, y]) => (x.test(r.a) && y.test(r.b)) || (x.test(r.b) && y.test(r.a))))
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
