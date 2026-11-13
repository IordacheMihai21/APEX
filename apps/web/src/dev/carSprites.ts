/**
 * Dev page (dev/carsprites.html): the 3D car (game3d/car.ts, MaG80's model, CC BY 4.0) rendered straight from above on
 * a transparent ground, with the low golden sky in its paint and a soft shadow under it, in any livery colour.
 * window.render(hex) draws it and returns a PNG data URL; tools/track-builder/src/build-car-sprites.ts saves one per
 * colour to public/cars/ for the team grid.
 */
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { buildCar } from "../game3d/car";
import skyGolden from "../game3d/assets/sky-spruit_sunrise.hdr?url";

const W = 240;
const H = 600;
const canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
// the car is 5.6 m long and 2 m wide: a camera straight above, nose up the picture
const half = 3.05;
const camera = new THREE.OrthographicCamera(-half * (W / H), half * (W / H), half, -half, 0.1, 50);
camera.position.set(0, 20, 0);
camera.up.set(0, 0, -1);
camera.lookAt(0, 0, 0);

const sun = new THREE.DirectionalLight("#fff3e2", 2.4);
sun.position.set(-4, 10, -3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
sun.shadow.radius = 6;
scene.add(sun, new THREE.HemisphereLight("#e8eef7", "#5a5248", 1.6));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.45 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const built = buildCar();
scene.add(built.car);
const ready = Promise.all([
  built.ready.then(() => {
    // centre the camera on the car itself (the model's origin sits off its middle) with a little room for the shadow
    const box = new THREE.Box3().setFromObject(built.car);
    const c = box.getCenter(new THREE.Vector3());
    const len = box.max.z - box.min.z;
    const halfH = (len / 2) * 1.06;
    Object.assign(camera, { top: halfH, bottom: -halfH, left: -halfH * (W / H), right: halfH * (W / H) });
    camera.position.set(c.x, 20, c.z);
    camera.lookAt(c.x, 0, c.z);
    camera.updateProjectionMatrix();
    built.car.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      // carbon a shade lighter than on track, so it reads against the dark page
      if (m?.name === "carbon") m.color.multiplyScalar(2.2);
    });
  }),
  new HDRLoader().loadAsync(skyGolden).then((hdr) => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    scene.environmentIntensity = 0.9;
  }),
]);

function paint(hex: string) {
  built.car.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
    if (m?.name === "paint") {
      m.color.set(hex);
      m.roughness = 0.38;
      m.clearcoatRoughness = 0.05;
    }
  });
}

(window as unknown as { render: (hex: string) => Promise<string> }).render = async (hex: string) => {
  await ready;
  paint(hex);
  renderer.render(scene, camera);
  return canvas.toDataURL("image/png");
};
(window as unknown as { spritesReady: Promise<unknown> }).spritesReady = ready;
