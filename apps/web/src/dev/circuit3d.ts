/**
 * Dev page (dev/circuit3d.html): a whole circuit in 3D (game3d/circuitWorld.ts) under a clear day sky, with the games'
 * car (game3d/carF1.ts) on the track. ?track=spa picks the circuit, ?car=full|lite the car. The slider moves the car
 * round the lap; the camera follows it (chase), watches from the side of the track (tv), or flies free (orbit).
 * window.place(s, mode) sets both, for screenshots.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadScenery, loadTrack } from "../game/catalog";
import { CONDITION_CARS, prepareTrack, simulateLap } from "@apex/engine";
import { groundAt } from "../game3d/geometry";
import { type RearLights, buildCarF1 } from "../game3d/carF1";
import { buildCircuitWorld, loadCircuitGround } from "../game3d/circuitWorld";
import { loadSurfaces } from "../game3d/textures";
import { loadTreeAtlases } from "../game3d/treeImpostors";
import { buildSkyline, loadSkyline } from "../game3d/skyline";
import { buildDaySky } from "../game3d/daySky";
import { BrightnessContrastEffect, EffectComposer, EffectPass, HueSaturationEffect, RenderPass, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode, VignetteEffect } from "postprocessing";
import { N8AOPostPass } from "n8ao";
import { MotionBlurEffect } from "../game3d/motionBlur";

const params = new URLSearchParams(location.search);
const trackId = params.get("track") ?? "spa";
const detail = params.get("car") === "lite" ? "lite" : "full";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", // reversed depth keeps the far hills and the road's layers apart (where the device has it); a logarithmic depth
  // buffer did too, but cost half the frame rate (it turns off the GPU's early depth test, and the trees overdraw)
  reversedDepthBuffer: params.get("rev") === "1" || (params.get("rev") !== "0" && params.get("post") === "0"), preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(Number(params.get("dpr") ?? 2), devicePixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.82;
renderer.shadowMap.enabled = params.get("shadow") !== "0";
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 20000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enabled = false;

// ---- a clear day: a blue sky, paler at the horizon, the sun high and to one side, a few soft clouds
const LOOK = { top: "#4a7fbf", horizon: "#cdd8e0", sun: "#fff1dc", fog: "#bfcbd4" };
const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 38), THREE.MathUtils.degToRad(215));
const daySky = buildDaySky(renderer, sunDir, { coverage: Number(params.get("clouds") ?? 0.5) });
scene.add(daySky.group);
// haze: the far woods and hills go pale and blue-grey with distance, into the sky's own horizon
scene.fog = new THREE.Fog(daySky.horizon, 260, 5200);
scene.environment = daySky.environment;
scene.environmentIntensity = 0.42;
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
const [track, osm, photo, ground, skyline, treeAtlases] = await Promise.all([loadTrack(trackId), loadScenery(trackId), loadSurfaces(), loadCircuitGround(trackId), loadSkyline(`${trackId}-0`), loadTreeAtlases()]);
const world = buildCircuitWorld(track, ground, osm, photo, { wet: false, street: false, detail, maxTrees: params.has("trees") ? Number(params.get("trees")) : undefined, treeAtlases });
scene.add(world.group);
let hills: THREE.Group | null = null;
if (skyline) {
  // the skyline's rings stand beyond the whole circuit: scaled out (their heights are angles, so they look the same)
  hills = buildSkyline(skyline, { wet: false, horizon: `#${daySky.horizon.getHexString()}`, sunDir }).group;
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

// ---- the lap: the line (the day's perfect line, or ?line=centre for the centre line) driven by the game's own physics
// (@apex/engine's simulateLap): where the car is, how fast, how hard it turns, at every point
const pt = prepareTrack(track);
const lineOf = params.get("line") === "centre" ? { knotOffsets: new Array(pt.k).fill(0) } : track.optimalLine!;
const sim = simulateLap({ track: pt, line: lineOf, car: CONDITION_CARS.dry });
const smp = sim.samples;
const N = smp.x.length;
const pathH = Array.from(smp.x, (x, i) => groundAt(x, smp.y[i]) + 0.03);
const lapLen = smp.distance[N - 1] + Math.hypot(smp.x[0] - smp.x[N - 1], smp.y[0] - smp.y[N - 1]);
const lapMs = sim.rawLapTimeMs;
/** the sample index and the share of the way to the next one, at s metres along the driven line */
const locate = (s: number): [number, number, number] => {
  const w = ((s % lapLen) + lapLen) % lapLen;
  let lo = 0;
  let hi = N - 1;
  if (w >= smp.distance[N - 1]) return [N - 1, 0, (w - smp.distance[N - 1]) / (lapLen - smp.distance[N - 1])];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (smp.distance[mid] <= w) lo = mid;
    else hi = mid;
  }
  return [lo, hi, (w - smp.distance[lo]) / Math.max(1e-6, smp.distance[hi] - smp.distance[lo])];
};
const lerpAt = (arr: ArrayLike<number>, s: number) => {
  const [i, j0, u] = locate(s);
  const j = i === N - 1 ? 0 : j0;
  return arr[i] + (arr[j] - arr[i]) * u;
};
const pointAt = (s: number) => new THREE.Vector3(lerpAt(smp.x, s), lerpAt(pathH, s), -lerpAt(smp.y, s));
const speedAt = (s: number) => lerpAt(smp.speed, s);
const curvatureAt = (s: number) => lerpAt(smp.curvature, s);
/** where the car is (m along the line) t seconds into the lap */
const sAtTime = (t: number) => {
  const ms = ((t * 1000) % lapMs + lapMs) % lapMs;
  let lo = 0;
  let hi = N - 1;
  if (ms >= smp.elapsedMs[N - 1]) return smp.distance[N - 1] + ((ms - smp.elapsedMs[N - 1]) / Math.max(1, lapMs - smp.elapsedMs[N - 1])) * (lapLen - smp.distance[N - 1]);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (smp.elapsedMs[mid] <= ms) lo = mid;
    else hi = mid;
  }
  const u = (ms - smp.elapsedMs[lo]) / Math.max(1e-6, smp.elapsedMs[hi] - smp.elapsedMs[lo]);
  return smp.distance[lo] + (smp.distance[hi] - smp.distance[lo]) * u;
};
const vMax = Math.max(...smp.speed);
let mode: "chase" | "tv" | "orbit" = "chase";
const boomDir = new THREE.Vector3(0, 0, -1);
let boomPitch = 0;
let steerNow = 0;
let chaseInit = false;
let frameDt = 1 / 60;
let s = 0;
let driving = false;
let currentSteer = 0;
/** the car's speed now (m/s), for the cornering force */
let curSpeed = 70;
function place(at: number, m: typeof mode = mode) {
  s = at;
  mode = m;
  const p = pointAt(s);
  // the heading from 6 m either side (the centre line is a polyline: a shorter base would twitch at every point), the
  // pitch from the two axles' heights (the wheelbase is 3.4 m)
  const ahead = pointAt(s + 6);
  const behind = pointAt(s - 6);
  const flat = new THREE.Vector3(ahead.x - behind.x, 0, ahead.z - behind.z).normalize();
  const pitch = Math.atan2(pointAt(s + 1.7).y - pointAt(s - 1.7).y, 3.4);
  const dir = flat.clone().multiplyScalar(Math.cos(pitch)).setY(Math.sin(pitch));
  // the front wheels steer into the bend: a car on a curve of radius R turns them by about atan(wheelbase / R);
  // the bend from the turn of the heading over 6 m either side, eased so it doesn't twitch at the line's points
  const hIn = Math.atan2(p.x - behind.x, -(p.z - behind.z));
  const hOut = Math.atan2(ahead.x - p.x, -(ahead.z - p.z));
  let dh = hOut - hIn;
  if (dh > Math.PI) dh -= 2 * Math.PI;
  if (dh < -Math.PI) dh += 2 * Math.PI;
  // heading measured clockwise from north: a right-hander increases it; steering is positive to the left
  void dh;
  const kappa = curvatureAt(s);
  const want = Math.atan(3.4 * kappa) * 1.15;
  steerNow += (want - steerNow) * (driving ? 1 - Math.pow(1 - 0.2, frameDt * 60) : 1);
  car.setSteer(steerNow);
  car.car.position.copy(p);
  car.car.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, new THREE.Vector3(0, 1, 0)));
  // the nose turns into the bend ahead of the path, as a car's does: the body runs at a slip angle that grows with
  // the cornering force (about a degree per g), so the car visibly yaws in the frame while the camera follows its path
  const lateralG = (curSpeed * curSpeed * kappa) / 9.81;
  const slip = THREE.MathUtils.clamp(0.018 * lateralG, -0.09, 0.09);
  car.car.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), slip));
  // the tyres squash a little under the car's weight and downforce: the body sits that much lower, on the road
  car.car.position.y -= 0.012;
  currentSteer = steerNow;
  controls.enabled = mode === "orbit";
  if (mode === "chase") {
    // a boom 6.2 m behind the car's middle (about 3 m behind its rear wing) and 1.55 m up, as in a racing game: the camera rides with the car (no lag along
    // the road, so the car never runs away from it); only the boom's direction follows the car's heading and the
    // road's slope, eased, so the car turns in the frame through a corner and the horizon stays calm
    const k = driving ? 1 - Math.pow(1 - 0.22, frameDt * 60) : 1;
    if (!chaseInit || !driving) {
      boomDir.copy(flat);
      boomPitch = pitch;
      chaseInit = true;
    } else {
      boomDir.lerp(flat, k).normalize();
      boomPitch += (pitch - boomPitch) * k;
    }
    const back = boomDir.clone().multiplyScalar(-6.2 * Math.cos(boomPitch)).setY(-6.2 * Math.sin(boomPitch));
    camera.position.copy(p).add(back).add(new THREE.Vector3(0, 1.55, 0));
    const look = p.clone().addScaledVector(boomDir, 9).add(new THREE.Vector3(0, 0.55 + 9 * Math.sin(boomPitch), 0));
    camera.lookAt(look);
    camera.fov = 56;
  } else if (mode === "tv") {
    // a low camera outside the corner, close enough to see the wheels and bodywork move
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    camera.position.copy(pointAt(s + 11)).add(side.multiplyScalar(6)).add(new THREE.Vector3(0, 1.8, 0));
    camera.lookAt(p.clone().add(new THREE.Vector3(0, 0.5, 0)));
    camera.fov = 26;
  } else {
    controls.target.copy(p);
    if (camera.position.distanceTo(p) > 200) camera.position.copy(p).add(new THREE.Vector3(30, 25, 30));
  }
  camera.updateProjectionMatrix();
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
(window as unknown as { place: typeof place; carObj: THREE.Object3D }).place = place;
(window as unknown as { carObj: THREE.Object3D }).carObj = car.car;
(window as unknown as { worldGroup: THREE.Object3D }).worldGroup = world.group;
place(Number(params.get("s") ?? 30), (params.get("mode") as typeof mode) ?? "chase");

// post: contact shadows (ambient occlusion) where things meet the ground, then a filmic grade a little cooler and
// softer than the raw render, the smoothest edges, a light vignette. ?post=0 renders plain; ?blur=0 drops the camera blur.
const usePost = params.get("post") !== "0";
let composer: EffectComposer | null = null;
let ao: N8AOPostPass | null = null;
let blur: MotionBlurEffect | null = null;
if (usePost) {
  renderer.toneMapping = THREE.NoToneMapping;
  composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  if (params.get("ao") === "1") {
  ao = new N8AOPostPass(scene, camera, innerWidth, innerHeight);
  ao.setQualityMode("Medium");
  ao.configuration.aoRadius = 2.2;
  ao.configuration.distanceFalloff = 1.2;
  ao.configuration.intensity = 2.6;
  ao.configuration.halfRes = true;
  composer.addPass(ao);
  }
  if (params.get("blur") !== "0") {
    blur = new MotionBlurEffect(camera, { shutter: 0.4, reversedDepth: renderer.capabilities.reversedDepthBuffer });
    composer.addPass(new EffectPass(camera, blur));
  }
  composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));
  composer.addPass(
    new EffectPass(
      camera,
      new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
      new HueSaturationEffect({ saturation: -0.14 }),
      new BrightnessContrastEffect({ brightness: 0.02, contrast: -0.04 }),
      new VignetteEffect({ offset: 0.35, darkness: 0.35 }),
    ),
  );
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  composer?.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
let last = performance.now();
let frames = 0;
let fps = 0;
// for recording: draw one frame with the car at s, as if driving, dt seconds after the last
let clock = 0;
(window as unknown as { renderAt: (s: number, dt: number, speed?: number, lights?: RearLights) => void }).renderAt = (at, dt, speed = 80, lights = "off") => {
  manual = true;
  curSpeed = speed;
  clock += dt;
  car.setRearLights(lights);
  car.updateLights(clock);
  driving = true;
  frameDt = dt;
  place(at, "chase");
  daySky.update(camera, clock);
  world.update(clock);
  if (hills) hills.position.set(camera.position.x, hills.position.y, camera.position.z);
  sun.target.position.copy(car.car.position);
  sun.position.copy(car.car.position).addScaledVector(sunDir, 400);
  spinWheels(speed, dt);
  blur?.setCar(car.car);
  if (composer) composer.render(dt);
  else renderer.render(scene, camera);
};
let manual = false;
/**
 * One frame of the lap at t seconds, as the game will show it: the car where the physics has it, at its speed, the
 * rear lights flashing while it harvests (braking, lifting) and fast at the end of the longest straights (super
 * clipping, near top speed).
 */
(window as unknown as { lapFrame: (t: number, dt: number) => void; lapInfo: () => { lapMs: number; vMax: number } }).lapFrame = (t, dt) => {
  const at = sAtTime(t);
  const v = speedAt(at);
  const ahead = speedAt(at + v * 0.25);
  const decel = (v - ahead) / 0.25;
  const lights: RearLights = decel > 4 ? "harvest" : v > vMax * 0.96 ? "clip" : "off";
  (window as unknown as { renderAt: (s: number, dt: number, speed?: number, lights?: RearLights) => void }).renderAt(at, dt, v, lights);
};
(window as unknown as { lapInfo: () => { lapMs: number; vMax: number } }).lapInfo = () => ({ lapMs, vMax });
/** for checking details: a fixed camera relative to the car (car frame: x right, y up, z back) after placing it */
(window as unknown as { look: (at: number, eye: number[], target: number[], fov: number, lights?: RearLights) => void }).look = (at, eye, target, fov, lights = "off") => {
  manual = true;
  driving = false;
  place(at, "chase");
  car.setRearLights(lights);
  car.updateLights(0.1);
  car.car.updateMatrixWorld();
  camera.position.set(eye[0], eye[1], eye[2]).applyMatrix4(car.car.matrixWorld);
  camera.lookAt(new THREE.Vector3(target[0], target[1], target[2]).applyMatrix4(car.car.matrixWorld));
  camera.fov = fov;
  camera.updateProjectionMatrix();
  daySky.update(camera, 0);
  sun.target.position.copy(car.car.position);
  sun.position.copy(car.car.position).addScaledVector(sunDir, 400);
  blur?.reset();
  blur?.setCar(car.car);
  if (composer) composer.render(0.016);
  else renderer.render(scene, camera);
};
/** a camera in another object's frame (a marshal post, a tower), to look at the scenery close up */
(window as unknown as { lookFrom: (o: THREE.Object3D, eye: number[], target: number[], fov: number, t?: number) => void }).lookFrom = (o, eye, target, fov, t = 0) => {
  manual = true;
  driving = false;
  o.updateMatrixWorld();
  camera.position.set(eye[0], eye[1], eye[2]).applyMatrix4(o.matrixWorld);
  camera.lookAt(new THREE.Vector3(target[0], target[1], target[2]).applyMatrix4(o.matrixWorld));
  camera.fov = fov;
  camera.updateProjectionMatrix();
  daySky.update(camera, 0);
  world.update(t);
  sun.target.position.copy(camera.position);
  sun.position.copy(camera.position).addScaledVector(sunDir, 400);
  blur?.reset();
  if (composer) composer.render(0.016);
  else renderer.render(scene, camera);
};
/**
 * The wheels at speed: really they turn about 6 rad a frame at 290 km/h, which a camera can't show (a wheel turning
 * nearly a whole round a frame looks still, or turning back). Show a visible forward turn of the sidewall markings,
 * with their lettering smeared across the exposure.
 */
function spinWheels(speed: number, dt: number) {
  const real = (speed * dt) / 0.36;
  const shown = Math.min(real, 0.72);
  for (const w of car.wheels) w.rotation.x -= shown;
  car.setSpinBlur(shown * 0.5);
}
renderer.setAnimationLoop((now) => {
  if (manual) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frames++;
  if (frames % 30 === 0) fps = Math.round(1 / Math.max(dt, 1e-3));
  frameDt = dt;
  if (driving) {
    // the car at the speed the game's physics gives it here
    const v = speedAt(s);
    curSpeed = v;
    place(s + v * dt);
    spinWheels(v, dt);
  }
  if (mode === "orbit") controls.update();
  // the sky, clouds and hills move with the camera; the sun's shadow follows the car
  daySky.update(camera, now / 1000);
  world.update(now / 1000);
  if (hills) hills.position.set(camera.position.x, hills.position.y, camera.position.z);
  sun.target.position.copy(car.car.position);
  sun.position.copy(car.car.position).addScaledVector(sunDir, 400);
  stats.textContent = `${built} · ${fps} fps · s ${Math.round(s)} m`;
  blur?.setCar(car.car);
  if (composer) composer.render(dt);
  else renderer.render(scene, camera);
  (window as unknown as { frameReady: boolean }).frameReady = true;
});
