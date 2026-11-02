// The switchgear room as a light studio: a pale concrete floor with a faint tile grid, soft shadows, GTAO kept off
// the floor, an environment of soft boxes for the cast aluminium. frame(state, opts, cam) poses the panel and draws.
// GTAO is skipped while the section cut is on: its normal pass cannot clip only the housings.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildPanel} from './panel.js';

const V3 = THREE.Vector3;
export const COL = {bg: '#eceeeb', floor: '#e6e8e4', line: '#d6d9d4', shadow: '#4c5650'};

const FLOOR_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLOOR_FRAG = /* glsl */ `uniform vec3 uF; uniform vec3 uL; uniform vec3 uBg; uniform vec3 uC; varying vec3 vW;
  void main(){
    // 600 mm floor tiles, aligned to the panel spacing
    vec2 q = abs(fract(vW.xz / 0.6 + 0.5) - 0.5) * 0.6;
    float m = 1.0 - smoothstep(0.0, 0.006, min(q.x, q.y));
    float n = fract(sin(dot(floor(vW.xz * 50.0), vec2(12.9898, 78.233))) * 43758.5453);
    vec3 col = mix(uF, uL, m * 0.7) * (0.99 + 0.02 * n);
    float d = length(vW.xz - uC.xz);
    gl_FragColor = vec4(mix(col, uBg, smoothstep(3.5, 11.0, d)), 1.0);
  }`;

export function createGisStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 9, 24);
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.05, 60);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.75;
  gtao.updateGtaoMaterial({radius: 0.12, distanceExponent: 1.4, thickness: 0.8, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
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
  const floorVis = (v) => () => {
    floor.visible = v;
    shade.visible = v;
    panel.ghost.visible = v && ghostOn;
  };
  composer.addPass(new Toggle(floorVis(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(floorVis(true)));
  composer.addPass(new OutputPass());

  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#e3e6e3');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(0.97, 0.98, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(12, 12, new V3(0, 14, 2), 2.2);
    box(3, 14, new V3(-12, 4, 6), 2.6);
    box(3, 14, new V3(12, 4, -4), 1.9);
    box(18, 2, new V3(0, 2, 14), 1.4);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#c9cdc9', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 1.0;
    pm.dispose();
  }
  const SUN_DIR = new V3(0.45, 0.85, 0.35).normalize();
  const sun = new THREE.DirectionalLight('#fffaf2', 2.2);
  sun.castShadow = true;
  const EXT = 2.4;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.5, far: 20});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 9;
  sun.shadow.blurSamples = 20;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.003;
  sun.position.copy(SUN_DIR).multiplyScalar(9).add(new V3(0, 1, 0));
  sun.target.position.set(0, 1, 0);
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9cec9', 0.75));

  const floorMat = new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
    uniforms: {uF: {value: new THREE.Color(COL.floor)}, uL: {value: new THREE.Color(COL.line)}, uBg: {value: new THREE.Color(COL.bg)}, uC: {value: new V3()}},
    toneMapped: false,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShadowMaterial({color: COL.shadow, opacity: 0.28, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.receiveShadow = true;
  scene.add(shade);

  const panel = buildPanel();
  scene.add(panel.root);
  let ghostOn = true;

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
  let aoWanted = true;

  // s: gis.stateAt(); o: display {xray, gas, section, ghost, ambient}
  // cam: {tx, ty, tz, az, el, d (radians, metres), sx, sy}
  const frame = (s, o, cam) => {
    panel.update(s, o);
    ghostOn = (o.ghost ?? 1) > 0.01;
    gtao.enabled = aoWanted && !o.section;
    camera.position.set(cam.tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), cam.ty + cam.d * Math.sin(cam.el), cam.tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    floorMat.uniforms.uC.value.set(cam.tx, 0, cam.tz);
    composer.render();
  };
  const pv = new V3();
  const project = (x, y, z) => {
    pv.set(x, y, z).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, ao, shadow}) => {
    if (samples !== undefined)
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    if (ao !== undefined) aoWanted = ao;
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  return {renderer, scene, camera, panel, composer, gtao, sun, resize, frame, project, size, setQuality};
}
