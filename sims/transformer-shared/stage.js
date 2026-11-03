// The transformer's stage: the V8's pale studio scaled up to a 2 m object, a soft shadow on an invisible floor, GTAO
// kept off the floor, and a model that rebuilds when the configuration changes. frame(state, cam) poses the
// transformer for one operating point and draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildTrafo} from './trafo3d.js';

const V3 = THREE.Vector3;
export const BG = {top: '#f3f3f4', mid: '#e9eaec', low: '#e2e3e5'};

export function createTrafoStage({canvas, spec}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.localClippingEnabled = true;
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
  gtao.updateGtaoMaterial({radius: 0.12, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
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
  // the floor's shadow catcher, the fluid, the flow and the arrows stay out of the AO pass
  const aoSkip = (on) => {
    shade.visible = on;
    if (tr) {
      for (const o of tr.aoSkip ?? []) o.visible = on && o.userData.vis !== false;
    }
  };
  composer.addPass(new Toggle(() => aoSkip(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(() => aoSkip(true)));
  composer.addPass(new OutputPass());

  // a bright studio for the paint and the porcelain to read
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
    box(18, 2, new V3(0, 2, 14), 1.5);
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
  sun.position.set(-2.6, 6.4, 3.4);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 1, far: 16});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 12;
  sun.shadow.blurSamples = 24;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.004;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfd0d3', 0.75));

  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.ShadowMaterial({color: '#5d636c', opacity: 0.26, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.0005;
  shade.receiveShadow = true;
  scene.add(shade);

  let tr = null;
  let cut = 'solid';
  const setSpec = (sp) => {
    if (tr) {
      scene.remove(tr.root);
      tr.dispose();
    }
    tr = buildTrafo(sp);
    tr.aoSkip = [];
    tr.root.traverse((o) => {
      if (o.isMesh && (o.material.transparent || o.isInstancedMesh && o.material.depthWrite === false)) tr.aoSkip.push(o);
    });
    scene.add(tr.root);
    tr.setCut(cut);
    api.tr = tr;
    return tr;
  };

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  // cam: target (tx, ty, tz), azimuth from +z toward +x, elevation, distance (radians, metres), sx/sy screen shift
  const frame = (state, cam) => {
    tr.update(state);
    // the AO skip list follows the visibility the update just set
    for (const o of tr.aoSkip) o.userData.vis = isShown(o);
    const {tx, ty, tz, az, el, d} = cam;
    camera.position.set(tx + d * Math.cos(el) * Math.sin(az), ty + d * Math.sin(el), tz + d * Math.cos(el) * Math.cos(az));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    composer.render();
  };
  const isShown = (o) => {
    let p = o;
    while (p) {
      if (!p.visible) return false;
      p = p.parent;
    }
    return true;
  };
  const pv = new V3();
  const project = (x, y, z) => {
    pv.set(x, y, z).project(camera);
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
  const setCut = (mode) => {
    if (mode === cut) return;
    cut = mode;
    tr.setCut(mode);
    gtao.normalMaterial.clippingPlanes = mode === 'section' ? [tr.CLIP] : null;
    gtao.normalMaterial.needsUpdate = true;
  };
  const api = {renderer, scene, camera, composer, gtao, sun, resize, frame, project, size, setQuality, setCut, setSpec, tr: null, get cut() {
    return cut;
  }};
  setSpec(spec);
  return api;
}
