import * as THREE from "three";
import { BrightnessContrastEffect, EffectComposer, EffectPass, HueSaturationEffect, RenderPass, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode, VignetteEffect } from "postprocessing";
import type { Condition, SimulationResult } from "@apex/engine";
import { loadScenery, loadTrack } from "../game/catalog";
import { type RearLights, buildCarF1, carDetail } from "./carF1";
import { buildCircuitWorld, loadCircuitGround } from "./circuitWorld";
import { buildDaySky } from "./daySky";
import { groundAt } from "./geometry";
import { MotionBlurEffect } from "./motionBlur";
import { buildSkyline, loadSkyline } from "./skyline";
import { loadSurfaces } from "./textures";
import { loadTreeAtlases } from "./treeImpostors";

/**
 * The Daily Quali lap in 3D: the whole circuit (circuitWorld), a day sky, the player's car driving the lap the game
 * simulated (where the line runs, at the physics' speed, steering, the nose into the bends, the 2026 rear lights) and a
 * ghost car at the pace target. The game's own clock drives it (frame(tMs)), so the timing tower, the sectors and the
 * 3D view always agree. Cameras: chase (behind, on a boom that rides with the car), cockpit, and TV (trackside cameras
 * on long lenses that cut from one to the next as the car passes).
 */
export type LapCamera = "chase" | "cockpit" | "tv";

/** One simulated lap, laid on the 3D road: lookups by distance and by time. */
class LapPath {
  readonly n: number;
  readonly length: number;
  readonly lapMs: number;
  private readonly h: Float64Array;
  constructor(readonly sim: SimulationResult) {
    const s = sim.samples;
    this.n = s.x.length;
    this.h = Float64Array.from(s.x, (x, i) => groundAt(x, s.y[i]) + 0.03);
    this.length = s.distance[this.n - 1] + Math.hypot(s.x[0] - s.x[this.n - 1], s.y[0] - s.y[this.n - 1]);
    this.lapMs = sim.rawLapTimeMs;
  }
  private locate(d: number): [number, number, number] {
    const s = this.sim.samples;
    const n = this.n;
    const w = ((d % this.length) + this.length) % this.length;
    if (w >= s.distance[n - 1]) return [n - 1, 0, (w - s.distance[n - 1]) / Math.max(1e-6, this.length - s.distance[n - 1])];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s.distance[mid] <= w) lo = mid;
      else hi = mid;
    }
    return [lo, hi, (w - s.distance[lo]) / Math.max(1e-6, s.distance[hi] - s.distance[lo])];
  }
  private lerp(arr: ArrayLike<number>, d: number) {
    const [i, j, u] = this.locate(d);
    return arr[i] + (arr[j] - arr[i]) * u;
  }
  point(d: number, out = new THREE.Vector3()) {
    const s = this.sim.samples;
    return out.set(this.lerp(s.x, d), this.lerp(this.h, d), -this.lerp(s.y, d));
  }
  speed(d: number) {
    return this.lerp(this.sim.samples.speed, d);
  }
  curvature(d: number) {
    return this.lerp(this.sim.samples.curvature, d);
  }
  /** metres along the line at tMs into the lap (clamped to the lap) */
  at(tMs: number) {
    const s = this.sim.samples;
    const n = this.n;
    const ms = Math.max(0, Math.min(this.lapMs, tMs));
    if (ms >= s.elapsedMs[n - 1]) return s.distance[n - 1] + ((ms - s.elapsedMs[n - 1]) / Math.max(1, this.lapMs - s.elapsedMs[n - 1])) * (this.length - s.distance[n - 1]);
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s.elapsedMs[mid] <= ms) lo = mid;
      else hi = mid;
    }
    const u = (ms - s.elapsedMs[lo]) / Math.max(1e-6, s.elapsedMs[hi] - s.elapsedMs[lo]);
    return s.distance[lo] + (s.distance[hi] - s.distance[lo]) * u;
  }
}

export class LapScene {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(56, 1, 0.3, 20000);
  private composer: EffectComposer | null = null;
  private blur: MotionBlurEffect | null = null;
  private readonly sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 38), THREE.MathUtils.degToRad(215));
  private readonly sun: THREE.DirectionalLight;
  private readonly sky: ReturnType<typeof buildDaySky>;
  private hills: THREE.Group | null = null;
  private readonly disposables: { dispose(): void }[] = [];
  private car!: ReturnType<typeof buildCarF1>;
  private ghost: ReturnType<typeof buildCarF1> | null = null;
  private path: LapPath | null = null;
  private ghostPath: LapPath | null = null;
  private ghostScale = 1;
  private vMax = 90;
  private cameraMode: LapCamera = "chase";
  private boomDir = new THREE.Vector3(0, 0, -1);
  private boomPitch = 0;
  private steerNow = 0;
  private lastD = 0;
  private lastT = -1;
  private clock = 0;
  private tvCams: THREE.Vector3[] = [];
  private tvAt = -1;
  private size = { w: 1, h: 1 };

  static async create(canvas: HTMLCanvasElement, trackId: string, condition: Condition): Promise<LapScene> {
    const detail = carDetail();
    const [track, osm, photo, ground, skyline, treeAtlases] = await Promise.all([loadTrack(trackId), loadScenery(trackId), loadSurfaces(), loadCircuitGround(trackId), loadSkyline(`${trackId}-0`), loadTreeAtlases()]);
    const scene = new LapScene(canvas, detail);
    const world = buildCircuitWorld(track, ground, osm, photo, { wet: condition === "wet", street: false, detail, treeAtlases });
    scene.scene.add(world.group);
    scene.disposables.push(world, photo);
    if (skyline) {
      const hills = buildSkyline(skyline, { wet: false, horizon: `#${scene.sky.horizon.getHexString()}`, sunDir: scene.sunDir });
      hills.group.scale.setScalar(2.6);
      scene.hills = hills.group;
      scene.scene.add(hills.group);
      scene.disposables.push(hills);
    }
    // TV cameras: every 220 m round the lap, 26 m out from the centre line on alternate sides, 5 m up
    const cl = track.centerline;
    const step = track.lengthMeters / cl.length;
    for (let k = 0; k < cl.length; k += Math.round(220 / step)) {
      const a = cl[(k - 2 + cl.length) % cl.length];
      const b = cl[(k + 2) % cl.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const d = Math.hypot(dx, dy) || 1;
      const side = (k / Math.round(220 / step)) % 2 ? 1 : -1;
      const x = cl[k][0] + (-dy / d) * 26 * side;
      const y = cl[k][1] + (dx / d) * 26 * side;
      scene.tvCams.push(new THREE.Vector3(x, groundAt(x, y) + 5, -y));
    }
    scene.car = buildCarF1(detail);
    scene.scene.add(scene.car.car);
    scene.disposables.push(scene.car);
    await scene.car.ready;
    return scene;
  }

  private constructor(canvas: HTMLCanvasElement, detail: "full" | "lite") {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, detail === "full" ? 2 : 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 0.82;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.sky = buildDaySky(this.renderer, this.sunDir);
    this.scene.add(this.sky.group);
    this.disposables.push(this.sky);
    this.scene.fog = new THREE.Fog(this.sky.horizon, 260, 5200);
    this.scene.environment = this.sky.environment;
    this.scene.environmentIntensity = 0.42;
    this.scene.add(new THREE.HemisphereLight("#dce9f7", "#55603f", 1.1));
    this.sun = new THREE.DirectionalLight("#fff1dc", 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(detail === "full" ? 4096 : 2048, detail === "full" ? 4096 : 2048);
    Object.assign(this.sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 800 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    // post: motion blur on computers, the grade everywhere
    const composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (detail === "full") {
      this.blur = new MotionBlurEffect(this.camera, { shutter: 0.4 });
      composer.addPass(new EffectPass(this.camera, this.blur));
    }
    composer.addPass(new EffectPass(this.camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));
    composer.addPass(
      new EffectPass(
        this.camera,
        new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
        new HueSaturationEffect({ saturation: -0.14 }),
        new BrightnessContrastEffect({ brightness: 0.02, contrast: -0.04 }),
        new VignetteEffect({ offset: 0.35, darkness: 0.35 }),
      ),
    );
    this.composer = composer;
  }

  /** The lap to show, and the ghost's (the pace target's lap, run at `ghostScale` of its time), or none. */
  setLap(sim: SimulationResult, ghost: SimulationResult | null, ghostScale = 1) {
    this.path = new LapPath(sim);
    this.vMax = Math.max(...sim.samples.speed);
    this.ghostPath = ghost ? new LapPath(ghost) : null;
    this.ghostScale = ghostScale;
    this.lastT = -1;
    this.blur?.reset();
    if (ghost && !this.ghost) {
      const g = buildCarF1("lite", { paint: "#cfd4da", paint2: "#7d838b", accent: "#ffffff" });
      this.ghost = g;
      this.scene.add(g.car);
      this.disposables.push(g);
      void g.ready.then(() => {
        g.car.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
          for (const mat of m ? (Array.isArray(m) ? m : [m]) : []) {
            mat.transparent = true;
            mat.opacity = 0.32;
            mat.depthWrite = false;
          }
        });
      });
    }
    if (this.ghost) this.ghost.car.visible = !!ghost;
  }

  setCamera(mode: LapCamera) {
    this.cameraMode = mode;
    this.tvAt = -1;
    this.blur?.reset();
  }

  get cameraName(): LapCamera {
    return this.cameraMode;
  }

  resize(w: number, h: number) {
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /** Place a car on a path at d metres: on the road, nose along the line, pitched with the slope, into the bend. */
  private placeCar(car: ReturnType<typeof buildCarF1>, path: LapPath, d: number, v: number) {
    const p = path.point(d);
    const ahead = path.point(d + 6);
    const behind = path.point(d - 6);
    const flat = new THREE.Vector3(ahead.x - behind.x, 0, ahead.z - behind.z).normalize();
    const pitch = Math.atan2(path.point(d + 1.7).y - path.point(d - 1.7).y, 3.4);
    const dir = flat.clone().multiplyScalar(Math.cos(pitch)).setY(Math.sin(pitch));
    car.car.position.copy(p);
    car.car.position.y -= 0.012;
    car.car.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, new THREE.Vector3(0, 1, 0)));
    const kappa = path.curvature(d);
    const slip = THREE.MathUtils.clamp((0.018 * v * v * kappa) / 9.81, -0.09, 0.09);
    car.car.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), slip));
    return { p, flat, pitch, kappa };
  }

  /** Draw the lap at tMs (the game's race clock); before the start the car waits on the grid. */
  frame(tMs: number) {
    if (!this.path) return;
    const dtMs = this.lastT < 0 ? 16 : Math.max(0, tMs - this.lastT);
    const dt = Math.min(0.1, dtMs / 1000);
    const jumped = this.lastT < 0 || tMs < this.lastT || dtMs > 400;
    this.lastT = tMs;
    this.clock += dt;
    const path = this.path;
    const d = path.at(tMs);
    const v = tMs <= 0 ? 0 : path.speed(d);
    const { p, flat, pitch, kappa } = this.placeCar(this.car, path, d, v);
    // the front wheels steer into the bend, eased; the wheels turn with the speed (shown below a strobing rate)
    const want = Math.atan(3.4 * kappa) * 1.15;
    this.steerNow += (want - this.steerNow) * (jumped ? 1 : 1 - Math.pow(0.8, dt * 60));
    this.car.setSteer(this.steerNow);
    const real = (v * dt) / 0.36;
    const shown = Math.min(real, 0.72);
    for (const w of this.car.wheels) w.rotation.x -= shown;
    this.car.setSpinBlur(shown * 0.5);
    // rear lights: harvesting under braking, super clipping near top speed
    const ahead = path.speed(d + Math.max(1, v) * 0.25);
    const decel = (v - ahead) / 0.25;
    const lights: RearLights = tMs <= 0 ? "off" : decel > 4 ? "harvest" : v > this.vMax * 0.96 ? "clip" : "off";
    this.car.setRearLights(lights);
    this.car.updateLights(this.clock);
    this.lastD = d;
    // the ghost at the pace target's lap time
    if (this.ghost && this.ghostPath) {
      const gt = tMs / this.ghostScale;
      const gd = this.ghostPath.at(gt);
      this.placeCar(this.ghost, this.ghostPath, gd, this.ghostPath.speed(gd));
    }

    // the camera
    if (this.cameraMode === "chase") {
      const k = jumped ? 1 : 1 - Math.pow(1 - 0.22, dt * 60);
      if (jumped) {
        this.boomDir.copy(flat);
        this.boomPitch = pitch;
      } else {
        this.boomDir.lerp(flat, k).normalize();
        this.boomPitch += (pitch - this.boomPitch) * k;
      }
      const back = this.boomDir.clone().multiplyScalar(-6.2 * Math.cos(this.boomPitch)).setY(-6.2 * Math.sin(this.boomPitch));
      this.camera.position.copy(p).add(back).add(new THREE.Vector3(0, 1.55, 0));
      this.camera.lookAt(p.clone().addScaledVector(this.boomDir, 9).add(new THREE.Vector3(0, 0.55 + 9 * Math.sin(this.boomPitch), 0)));
      this.camera.fov = 56;
      this.camera.near = 0.3;
    } else if (this.cameraMode === "cockpit") {
      const eye = this.car.cameras.cockpit ?? [0, 0.74, -0.2];
      this.car.car.updateMatrixWorld();
      this.camera.position.set(eye[0], eye[1], eye[2]).applyMatrix4(this.car.car.matrixWorld);
      const look = new THREE.Vector3(eye[0], eye[1] - 0.15, eye[2] - 10).applyMatrix4(this.car.car.matrixWorld);
      this.camera.lookAt(look);
      this.camera.fov = 68;
      this.camera.near = 0.05;
    } else {
      // the nearest trackside camera ahead of the car, held until the car is past it
      let best = this.tvAt;
      if (best < 0 || this.tvCams[best].distanceTo(p) > 170) {
        let bd = Infinity;
        this.tvCams.forEach((c, i) => {
          const dd = c.distanceTo(p);
          const toCam = c.clone().sub(p).setY(0).normalize();
          if (dd < bd && toCam.dot(flat) > -0.2) {
            bd = dd;
            best = i;
          }
        });
        if (best !== this.tvAt) this.blur?.reset();
        this.tvAt = best;
      }
      const c = this.tvCams[Math.max(0, best)];
      this.camera.position.copy(c);
      this.camera.lookAt(p.clone().add(new THREE.Vector3(0, 0.6, 0)));
      // a long lens, framing the car about the same size whatever the distance
      this.camera.fov = THREE.MathUtils.clamp((2 * Math.atan(9 / Math.max(10, c.distanceTo(p))) * 180) / Math.PI, 6, 40);
      this.camera.near = 0.5;
    }
    this.camera.updateProjectionMatrix();
    if (jumped) this.blur?.reset();

    this.sky.update(this.camera, this.clock);
    if (this.hills) this.hills.position.set(this.camera.position.x, this.hills.position.y, this.camera.position.z);
    this.sun.target.position.copy(this.car.car.position);
    this.sun.position.copy(this.car.car.position).addScaledVector(this.sunDir, 400);
    this.blur?.setCar(this.car.car);
    this.composer?.render(dt);
  }

  /** where the car is along the line (m), for anything that follows it */
  get distance() {
    return this.lastD;
  }

  dispose() {
    this.composer?.dispose();
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
  }
}
