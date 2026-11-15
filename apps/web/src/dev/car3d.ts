/**
 * Dev page (dev/car3d.html): the games' 3D car (game3d/carF1.ts) on a patch of asphalt under the golden sky, with an
 * orbit camera, a few fixed views and the cockpit eye. ?car=full|lite picks the file. window.view(name) sets a view.
 */
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildCarF1 } from "../game3d/carF1";
import skyGolden from "../game3d/assets/sky-spruit_sunrise.hdr?url";
import asphaltUrl from "../game3d/assets/asphalt-color.webp?url";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 500);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.5, 0);
controls.enableDamping = true;

new HDRLoader().load(skyGolden, (t) => {
  t.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = t;
  scene.background = t;
  scene.backgroundBlurriness = 0.02;
});
const sun = new THREE.DirectionalLight("#ffe2bd", 3);
sun.position.set(-6, 5, -4);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 });
sun.shadow.bias = -0.0002;
scene.add(sun);

const tex = new THREE.TextureLoader().load(asphaltUrl);
tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
tex.repeat.set(8, 8);
tex.colorSpace = THREE.SRGBColorSpace;
const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const built = buildCarF1();
scene.add(built.car);
const t0 = performance.now();
let tris = 0;
built.ready.then(() => {
  built.car.traverse((o) => {
    if (o instanceof THREE.Mesh) tris += (o.geometry.index?.count ?? 0) / 3;
  });
  (document.getElementById("stats") as HTMLElement).textContent = `${built.detail}: ${Math.round(tris).toLocaleString()} triangles, loaded in ${Math.round(performance.now() - t0)} ms`;
  (window as unknown as { carReady: boolean }).carReady = true;
});

const VIEWS: Record<string, () => void> = {
  front: () => setView([3.6, 1.3, -4.6], [0, 0.45, -0.4], 40),
  side: () => setView([6.5, 0.9, 0], [0, 0.5, 0], 40),
  rear: () => setView([-3.4, 1.4, 4.8], [0, 0.5, 0.3], 40),
  top: () => setView([0, 9, 0.01], [0, 0, 0], 40),
  cockpit: () => {
    const c = built.cameras.cockpit ?? [0, 0.74, -0.2];
    setView([c[0], c[1], c[2]], [c[0], c[1] - 0.12, c[2] - 2], 65);
  },
  chase: () => setView([0, 1.8, 6.2], [0, 0.7, -2], 55),
};
function setView(pos: number[], target: number[], fov: number) {
  camera.position.set(pos[0], pos[1], pos[2]);
  controls.target.set(target[0], target[1], target[2]);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  controls.update();
}
(window as unknown as { view: (n: string) => void }).view = (n) => VIEWS[n]?.();
(window as unknown as { built: typeof built }).built = built;
(window as unknown as { steer: (r: number) => void }).steer = (r) => built.setSteer(r);
(window as unknown as { aero: (o: number) => void }).aero = (o) => built.setAero(o);
(window as unknown as { attitude: (p: number, r: number, h: number) => void }).attitude = (p, r, h) => built.setAttitude(p, r, h);
(window as unknown as { cam: (p: number[], t: number[], fov: number) => void }).cam = setView;
(window as unknown as { paint: (h: string, h2?: string, a?: string) => void }).paint = (paint, paint2, accent) => built.setLook({ paint, paint2, accent });
const ui = document.getElementById("ui") as HTMLElement;
for (const n of Object.keys(VIEWS)) {
  const b = document.createElement("button");
  b.textContent = n;
  b.onclick = VIEWS[n];
  ui.append(b);
}
for (const hex of ["#ff6a13", "#1e5bd6", "#e10600", "#00a19b", "#f5c518", "#ff2d95"]) {
  const b = document.createElement("button");
  b.style.background = hex;
  b.style.width = "26px";
  b.onclick = () => built.setLook({ paint: hex });
  ui.append(b);
}
VIEWS.front();

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
