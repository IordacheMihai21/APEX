/**
 * Dev page (dev/circuit3d.html): a whole circuit in 3D (game3d/circuitWorld.ts) under a clear day sky, with the games'
 * car (game3d/carF1.ts) on the track. ?track=spa picks the circuit, ?car=full|lite the car. The slider moves the car
 * round the lap; the camera follows it (chase), watches from the side of the track (tv), or flies free (orbit).
 * window.place(s, mode) sets both, for screenshots.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadScenery, loadTrack } from "../game/catalog";
import { buildCarF1 } from "../game3d/carF1";
import { buildCircuitWorld, loadCircuitGround } from "../game3d/circuitWorld";
import { loadSurfaces } from "../game3d/textures";
import { buildSkyline, loadSkyline } from "../game3d/skyline";

const params = new URLSearchParams(location.search);
const trackId = params.get("track") ?? "spa";
const detail = params.get("car") === "lite" ? "lite" : "full";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", // reversed depth keeps the far hills and the road's layers apart (where the device has it); a logarithmic depth
  // buffer did too, but cost half the frame rate (it turns off the GPU's early depth test, and the trees overdraw)
  reversedDepthBuffer: params.get("rev") !== "0", preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(Number(params.get("dpr") ?? 2), devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.shadowMap.enabled = params.get("shadow") !== "0";
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.2, 20000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enabled = false;

// ---- a clear day: a blue sky, paler at the horizon, the sun high and to one side, a few soft clouds
const LOOK = { top: "#3f78c0", horizon: "#cfdbe4", sun: "#fff1dc", fog: "#c9d5de" };
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 38), THREE.MathUtils.degToRad(215));
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: { top: { value: new THREE.Color(LOOK.top) }, horizon: { value: new THREE.Color(LOOK.horizon) }, sunDir: { value: sunDir }, sunCol: { value: new THREE.Color(LOOK.sun) } },
  vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vDir;
    void main() {
      float t = pow(clamp(vDir.y, 0.0, 1.0), 0.5);
      vec3 c = mix(horizon, top, t);
      float s = max(dot(normalize(vDir), sunDir), 0.0);
      c += sunCol * (pow(s, 600.0) * 1.2 + pow(s, 12.0) * 0.18);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(12000, 48, 24), skyMat);
scene.add(sky);
// clouds: soft white puffs on canvases, far off and high up, moving with the camera like the sky
function cloudTexture(seed: number) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 26; k++) {
    const x = 70 + r() * 372;
    const y = 120 + (r() - 0.5) * 70 - Math.sin(((x - 70) / 372) * Math.PI) * 40;
    const rad = 30 + r() * 60;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, "rgba(255,255,255,0.55)");
    grd.addColorStop(0.6, "rgba(250,251,253,0.25)");
    grd.addColorStop(1, "rgba(245,247,250,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const clouds = new THREE.Group();
for (let k = 0; k < 16; k++) {
  const mat = new THREE.SpriteMaterial({ map: cloudTexture(k * 97 + 13), fog: false, depthWrite: false, transparent: true, opacity: 0.9 });
  const sp = new THREE.Sprite(mat);
  const a = (k / 16) * Math.PI * 2 + Math.random() * 0.3;
  const d = 7000 + Math.random() * 3000;
  sp.position.set(Math.cos(a) * d, 900 + Math.random() * 1400, Math.sin(a) * d);
  const w = 3500 + Math.random() * 3500;
  sp.scale.set(w, w * 0.45, 1);
  clouds.add(sp);
}
scene.add(clouds);
scene.fog = new THREE.Fog(LOOK.fog, 400, 6500);
// what the paint reflects: the same sky
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 32), new THREE.MeshBasicMaterial({ color: "#4d5a40" }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  envScene.add(ground);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.9;
}
scene.add(new THREE.HemisphereLight("#dce9f7", "#55603f", 1.1));
const sun = new THREE.DirectionalLight(LOOK.sun, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 800 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

// ---- the circuit and the car
const t0 = performance.now();
const [track, osm, photo, ground, skyline] = await Promise.all([loadTrack(trackId), loadScenery(trackId), loadSurfaces(), loadCircuitGround(trackId), loadSkyline(`${trackId}-0`)]);
const world = buildCircuitWorld(track, ground, osm, photo, { wet: false, street: false, detail, maxTrees: params.has("trees") ? Number(params.get("trees")) : undefined });
scene.add(world.group);
let hills: THREE.Group | null = null;
if (skyline) {
  // the skyline's rings stand beyond the whole circuit: scaled out (their heights are angles, so they look the same)
  hills = buildSkyline(skyline, { wet: false, horizon: LOOK.fog, sunDir }).group;
  hills.scale.setScalar(2.6);
  scene.add(hills);
}
const car = buildCarF1(detail);
scene.add(car.car);
await car.ready;
let tris = 0;
scene.traverse((o) => {
  if (o instanceof THREE.Mesh && o.geometry.index) tris += (o.geometry.index.count / 3) * (o instanceof THREE.InstancedMesh ? o.count : 1);
});
const stats = document.getElementById("stats") as HTMLElement;
const built = `${trackId}, ${detail}${renderer.capabilities.reversedDepthBuffer ? ", reversed depth" : ""}: built in ${Math.round(performance.now() - t0)} ms, ${(tris / 1e6).toFixed(2)} M triangles`;

// ---- placing the car on the lap, and the cameras
const line = world.line;
const N = line.x.length;
const lapLen = track.lengthMeters;
const pointAt = (s: number) => {
  const f = (((s % lapLen) + lapLen) % lapLen) / (lapLen / N);
  const i = Math.floor(f) % N;
  const j = (i + 1) % N;
  const u = f - Math.floor(f);
  return new THREE.Vector3(line.x[i] + (line.x[j] - line.x[i]) * u, line.h[i] + (line.h[j] - line.h[i]) * u, -(line.y[i] + (line.y[j] - line.y[i]) * u));
};
let mode: "chase" | "tv" | "orbit" = "chase";
let s = 0;
let driving = false;
function place(at: number, m: typeof mode = mode) {
  s = at;
  mode = m;
  const p = pointAt(s);
  const ahead = pointAt(s + 4);
  const behind = pointAt(s - 4);
  car.car.position.copy(p);
  // nose (local -z) along the lap, pitched with the slope
  const dir = ahead.clone().sub(behind).normalize();
  car.car.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, new THREE.Vector3(0, 1, 0)));
  controls.enabled = mode === "orbit";
  if (mode === "chase") {
    const back = pointAt(s - 7.5);
    camera.position.copy(back).add(new THREE.Vector3(0, 2.0, 0));
    camera.lookAt(pointAt(s + 12).add(new THREE.Vector3(0, 0.6, 0)));
    camera.fov = 58;
  } else if (mode === "tv") {
    // a camera on the outside of the track, a little ahead, long lens on the car
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    camera.position.copy(pointAt(s + 40)).add(side.multiplyScalar(22)).add(new THREE.Vector3(0, 4, 0));
    camera.lookAt(p.clone().add(new THREE.Vector3(0, 0.5, 0)));
    camera.fov = 22;
  } else {
    controls.target.copy(p);
    if (camera.position.distanceTo(p) > 200) camera.position.copy(p).add(new THREE.Vector3(30, 25, 30));
  }
  camera.updateProjectionMatrix();
  for (const w of car.wheels) w.rotation.x -= 0.6;
  slider.value = String(Math.round(s));
}
const ui = document.getElementById("ui") as HTMLElement;
const slider = document.createElement("input");
slider.type = "range";
slider.min = "0";
slider.max = String(Math.round(lapLen));
slider.oninput = () => place(Number(slider.value));
for (const m of ["chase", "tv", "orbit"] as const) {
  const b = document.createElement("button");
  b.textContent = m;
  b.onclick = () => place(s, m);
  ui.append(b);
}
const drive = document.createElement("button");
drive.textContent = "drive";
drive.onclick = () => (driving = !driving);
ui.append(drive, slider);
(window as unknown as { place: typeof place }).place = place;
place(Number(params.get("s") ?? 30), (params.get("mode") as typeof mode) ?? "chase");

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
let last = performance.now();
let frames = 0;
let fps = 0;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frames++;
  if (frames % 30 === 0) fps = Math.round(1 / Math.max(dt, 1e-3));
  if (driving) place(s + 70 * dt);
  if (mode === "orbit") controls.update();
  // the sky, clouds and hills move with the camera; the sun's shadow follows the car
  sky.position.copy(camera.position);
  clouds.position.copy(camera.position);
  if (hills) hills.position.set(camera.position.x, hills.position.y, camera.position.z);
  sun.target.position.copy(car.car.position);
  sun.position.copy(car.car.position).addScaledVector(sunDir, 400);
  stats.textContent = `${built} · ${fps} fps · s ${Math.round(s)} m`;
  renderer.render(scene, camera);
  (window as unknown as { frameReady: boolean }).frameReady = true;
});
