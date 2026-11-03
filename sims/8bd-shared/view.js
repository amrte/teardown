// The 8BD1 panel's viewport: a pale studio, one soft key light with shadows, a floor, an environment map baked from
// a few bright cards, and nothing else: no post-processing, no bloom, no AO. frame(state, cam) poses the panel and
// draws one frame; project() maps a point on the model to console pixels so the labels can point at it.
import * as THREE from 'three';
import {buildPanel} from './panel.js';

const V3 = THREE.Vector3;
export const COL = {bg: '#eef0ee', floor: '#e6e8e4', shadow: '#2e3a40'};

export function createView({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 9, 20);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 60);

  {
    // the environment: a ceiling softbox and two strip lights, baked once
    const env = new THREE.Scene();
    env.background = new THREE.Color('#dfe3e0');
    const card = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    card(10, 10, new V3(0, 12, 3), 2.2);
    card(3, 12, new V3(-11, 4, 5), 2.6);
    card(3, 12, new V3(11, 4, -3), 1.7);
    card(16, 2, new V3(0, 2, 12), 1.3);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#c9cec9', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -1;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.03).texture;
    scene.environmentIntensity = 0.9;
    pm.dispose();
  }
  const key = new THREE.DirectionalLight('#fffaf2', 2.0);
  key.position.set(-3.2, 6.5, 4.6);
  key.castShadow = true;
  Object.assign(key.shadow.camera, {left: -2.6, right: 2.6, top: 2.6, bottom: -2.6, near: 1, far: 16});
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.target.position.set(0, 1, 0.4);
  scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#c8cdc8', 0.7));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({color: COL.floor, roughness: 0.95, metalness: 0}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  // the switchroom floor marking: a hatched strip where the truck is drawn out (the operating aisle)
  {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#e6e8e4';
    x.fillRect(0, 0, 512, 512);
    x.strokeStyle = '#d2d6d1';
    x.lineWidth = 10;
    for (let i = -512; i < 1024; i += 48) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i + 512, 512);
      x.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    tex.anisotropy = 4;
    const aisle = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshStandardMaterial({map: tex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4}));
    aisle.rotation.x = -Math.PI / 2;
    aisle.receiveShadow = true;
    aisle.userData.aisle = true;
    scene.add(aisle);
    floor.userData.aisle = aisle;
  }

  const panel = buildPanel(renderer);
  scene.add(panel.root);
  const aisle = floor.userData.aisle;
  aisle.position.set(0, 0.0005, panel.P.depth / 2 + 0.55);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  // cam: {tx, ty, tz, az, el (radians), d (m), sx, sy (px of view offset)}
  const frame = (state, cam) => {
    panel.update(state);
    camera.position.set(cam.tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), cam.ty + cam.d * Math.sin(cam.el), cam.tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
  };
  const pv = new V3();
  const project = (p) => {
    pv.copy(p).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({shadow}) => {
    if (shadow === 0) {
      key.castShadow = false;
    } else if (shadow) {
      key.castShadow = true;
      key.shadow.mapSize.set(shadow, shadow);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    }
  };
  return {renderer, scene, camera, panel, resize, frame, project, size, setQuality};
}
