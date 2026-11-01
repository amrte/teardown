// The transformer's stage: the V8's pale studio scaled up for a 1.7 m machine. A screen-space backdrop, a soft
// shadow on an invisible floor under the wheels, soft boxes for the resin's gloss, GTAO kept off the floor.
// frame(s, cam) poses the unit and draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {CUR, designFor, G, setDesign} from './kin.js';
import {buildUnit} from './unit.js';

const V3 = THREE.Vector3;
export const BG = {top: '#f3f3f4', mid: '#e9eaec', low: '#e2e3e5'};

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 512;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, BG.top);
    gr.addColorStop(0.55, BG.mid);
    gr.addColorStop(1, BG.low);
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
  }
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.05, 80);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.7;
  gtao.updateGtaoMaterial({radius: 0.14, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  // the floor's shadow catcher, the air and the chevrons stay out of the AO pass
  const aoSkip = (on) => {
    shade.visible = on;
    unit.air.visible = on && airOn;
  };
  let airOn = true;
  composer.addPass(new Toggle(() => aoSkip(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(() => aoSkip(true)));
  composer.addPass(new OutputPass());

  // a bright studio for the resin to read: a big top softbox, two side strips, a front kicker
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#d9dadd');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(12, 12, new V3(0, 14, 2), 2.4);
    box(3, 14, new V3(-12, 4, 6), 3.0);
    box(3, 14, new V3(12, 4, -4), 2.0);
    box(18, 2, new V3(0, 2, 14), 1.4);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#c9cacd', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 1.0;
    pm.dispose();
  }
  const sun = new THREE.DirectionalLight('#ffffff', 2.3);
  sun.position.set(-3.0, 8.0, 4.0);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 2, far: 18});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 12;
  sun.shadow.blurSamples = 24;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.004;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfd0d3', 0.75));

  const FLOOR_Y = -0.9;
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({color: '#5d636c', opacity: 0.3, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = FLOOR_Y;
  shade.receiveShadow = true;
  scene.add(shade);

  let unit = buildUnit();
  scene.add(unit.root);
  // size the shadow and the floor to the current design
  const fitScene = () => {
    shade.position.y = G.floor * 0.001;
    const r = Math.max(G.frameLen, -G.floor * 2) * 0.001 * 0.75;
    Object.assign(sun.shadow.camera, {left: -r, right: r, top: r, bottom: -r});
    sun.shadow.camera.updateProjectionMatrix();
  };
  fitScene();

  const size = {w: 1600, h: 900, pr: 1};
  const dispose = (o) =>
    o.traverse((n) => {
      n.geometry?.dispose();
      for (const m of [n.material].flat()) {
        if (!m) continue;
        m.map?.dispose();
        m.dispose();
      }
    });
  /** switch to catalog order no. order with vector group group: rebuild the unit around the new design */
  const selectDesign = (order, group) => {
    const D = designFor(order, group);
    if (CUR.key === `${D.R.order}-${D.R.group}` && st.unit) return D;
    setDesign(D);
    scene.remove(unit.root);
    dispose(unit.root);
    unit = buildUnit();
    scene.add(unit.root);
    st.unit = unit;
    fitScene();
    unit.setPointScale(size.pr * (size.h / 900));
    return D;
  };
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    size.pr = pr;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    unit.setPointScale(pr * (h / 900));
  };
  // cam: target (tx, ty, tz) in metres, azimuth from +z toward +x, elevation, distance (radians, metres), sx/sy screen shift
  const frame = (s, cam) => {
    airOn = s.air > 0.01;
    unit.update(s);
    const {tx, ty, tz, az, el, d} = cam;
    camera.position.set(tx + d * Math.cos(el) * Math.sin(az), ty + d * Math.sin(el), tz + d * Math.cos(el) * Math.cos(az));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    composer.render();
  };
  const pv = new V3();
  /** a point in the unit's millimetres → CSS px */
  const project = (p) => {
    pv.set(p[0] * 0.001, p[1] * 0.001, p[2] * 0.001).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, ao, shadow}) => {
    if (samples !== undefined) {
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    }
    if (ao !== undefined) gtao.enabled = ao;
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  const st = {renderer, scene, camera, unit, composer, gtao, sun, resize, frame, project, size, FLOOR_Y, setQuality, selectDesign};
  return st;
}
