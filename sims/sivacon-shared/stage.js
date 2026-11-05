// The switchboard's stage: a pale studio (rule 5), a soft sun shadow on an invisible floor, four soft boxes in the
// environment for the zinc-plated steel and the copper to catch, GTAO kept off the floor. frame(cam) draws one frame.
// The board itself is built elsewhere (board.js) and added to `scene` by the caller.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';

const V3 = THREE.Vector3;
export const BG = {top: '#f3f3f4', mid: '#e9eaec', low: '#e1e2e5'};

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

export function createStage({canvas, lo = false}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = lo ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
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
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.15, 80);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: lo ? 0 : 4}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.7;
  gtao.updateGtaoMaterial({radius: 0.12, distanceExponent: 1.4, thickness: 0.8, scale: 1.0, samples: 12, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12});
  const aoSkip = [];
  composer.addPass(new Toggle(() => aoSkip.forEach((o) => (o.visible = false))));
  composer.addPass(gtao);
  composer.addPass(new Toggle(() => aoSkip.forEach((o) => (o.visible = true))));
  if (lo) gtao.enabled = false;
  composer.addPass(new OutputPass());

  if (!lo) {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#d9dadd');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(14, 14, new V3(0, 16, 3), 2.4);
    box(3, 14, new V3(-13, 4, 7), 3.0);
    box(3, 14, new V3(13, 4, -5), 2.0);
    box(20, 2.5, new V3(0, 2, 15), 1.5);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#c4c5c8', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -0.5;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 0.9;
    pm.dispose();
  }
  const sun = new THREE.DirectionalLight('#ffffff', 2.0);
  sun.position.set(-3.5, 7.5, 5.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lo ? 1024 : 2048, lo ? 1024 : 2048);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.01;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#ffffff', '#cfd0d3', lo ? 2.4 : 0.8);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight('#ffffff', 0.5);
  fill.position.set(4, 3, -6);
  scene.add(fill);

  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.ShadowMaterial({color: '#5d636c', opacity: 0.26, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.receiveShadow = true;
  scene.add(shade);
  aoSkip.push(shade);

  // the shadow camera follows the board's extent
  const fitShadow = (box) => {
    const c = box.getCenter(new V3());
    const s = box.getSize(new V3());
    const r = Math.max(s.x, s.y, s.z) * 0.75 + 0.6;
    sun.target.position.copy(c);
    sun.position.copy(c).add(new V3(-3.5, 7.5, 5.5));
    Object.assign(sun.shadow.camera, {left: -r, right: r, top: r, bottom: -r, near: 0.5, far: 30});
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.needsUpdate = true;
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
  // cam: target (tx, ty, tz) in metres, azimuth from +z (front) toward +x, elevation, distance; sx/sy screen shift px
  const place = (cam) => {
    const {tx, ty, tz, az, el, d} = cam;
    camera.position.set(tx + d * Math.cos(el) * Math.sin(az), ty + d * Math.sin(el), tz + d * Math.cos(el) * Math.cos(az));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
  };
  const frame = (cam) => {
    place(cam);
    composer.render();
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
  const setClip = (planes) => {
    gtao.normalMaterial.clippingPlanes = planes && planes.length ? planes : null;
    gtao.normalMaterial.needsUpdate = true;
  };
  return {renderer, scene, camera, composer, gtao, sun, resize, frame, place, project, size, setQuality, setClip, fitShadow, aoSkip};
}
