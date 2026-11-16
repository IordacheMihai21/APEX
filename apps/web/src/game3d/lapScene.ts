import * as THREE from "three";
import { BloomEffect, BrightnessContrastEffect, EffectComposer, EffectPass, HueSaturationEffect, RenderPass, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode, VignetteEffect } from "postprocessing";
import type { Condition, SimulationResult } from "@apex/engine";
import { loadScenery, loadTrack } from "../game/catalog";
import { DEFAULT_LOOK, type RearLights, buildCarF1, carDetail } from "./carF1";
import { CITY_CIRCUITS, buildCircuitWorld, loadCircuitGround } from "./circuitWorld";
import { HeatHazeEffect, LapEffects, LensFlareEffect, RainField } from "./lapEffects";
import { buildDaySky } from "./daySky";
import { currentGround } from "./geometry";
import { MotionBlurEffect } from "./motionBlur";
import { buildSkyline, loadTrackSkyline } from "./skyline";
import { loadSurfaces } from "./textures";
import { loadTreeAtlases } from "./treeImpostors";

/** top speed in each gear (m/s): eight gears, as the lap's sound has them */
const GEAR_TOP = [100, 135, 168, 200, 232, 265, 300, 345].map((k) => k / 3.6);

/**
 * The Daily Quali lap in 3D: the whole circuit (circuitWorld), a day sky, the player's car driving the lap the game
 * simulated (where the line runs, at the physics' speed, steering, the nose into the bends, the 2026 rear lights) and a
 * ghost car at the pace target. The game's own clock drives it (frame(tMs)), so the timing tower, the sectors and the
 * 3D view always agree. Cameras: chase (behind, on a boom that rides with the car), cockpit, and TV (trackside cameras
 * on long lenses that cut from one to the next as the car passes).
 */
export type LapCamera = "chase" | "tcam" | "cockpit" | "tv";

/** One simulated lap, laid on the 3D road: lookups by distance and by time. */
class LapPath {
  readonly n: number;
  readonly length: number;
  readonly lapMs: number;
  private readonly h: Float64Array;
  constructor(readonly sim: SimulationResult, ground: (x: number, y: number) => number) {
    const s = sim.samples;
    this.n = s.x.length;
    this.h = Float64Array.from(s.x, (x, i) => ground(x, s.y[i]) + 0.03);
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
  /** ms into the lap at d metres along the line */
  timeAt(d: number) {
    return this.lerp(this.sim.samples.elapsedMs, Math.max(0, Math.min(this.length - 0.01, d)));
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
  private readonly sunDir: THREE.Vector3;
  private readonly sunTint: THREE.Color;
  private readonly sunElevation: number;
  private flare: LensFlareEffect | null = null;
  private readonly sun: THREE.DirectionalLight;
  private readonly sky: ReturnType<typeof buildDaySky>;
  private hills: THREE.Group | null = null;
  private readonly disposables: { dispose(): void }[] = [];
  private car!: ReturnType<typeof buildCarF1>;
  private ghost: ReturnType<typeof buildCarF1> | null = null;
  private ground: (x: number, y: number) => number = () => 0;
  private path: LapPath | null = null;
  private ghostPath: LapPath | null = null;
  private ghostScale = 1;
  private vMax = 90;
  private cameraMode: LapCamera = "chase";
  private boomDir = new THREE.Vector3(0, 0, -1);
  private boomPitch = 0;
  private steerNow = 0;
  /** the car's attitude on its suspension and its rear flap, eased */
  private att = { pitch: 0, roll: 0, heave: 0, aero: 0 };
  private lastD = 0;
  private lastT = -1;
  private clock = 0;
  private tvCams: THREE.Vector3[] = [];
  private tvAt = -1;
  private size = { w: 1, h: 1 };
  private stands: THREE.Vector3[] = [];
  /** what the sound follows: the car's speed and acceleration, the camera's distance, how near the crowd is */
  readonly telemetry = { v: 0, along: 0, vertical: 0, decel: 0, cameraDistance: 0, onboard: false, crowdNear: 0, racing: false };

  static async create(canvas: HTMLCanvasElement, trackId: string, condition: Condition, hour = 16.8, look: { paint: string; paint2: string } | null = null): Promise<LapScene> {
    const detail = carDetail();
    const [track, osm, photo, ground, skyline, treeAtlases] = await Promise.all([loadTrack(trackId), loadScenery(trackId), loadSurfaces(), loadCircuitGround(trackId), loadTrackSkyline(trackId), loadTreeAtlases()]);
    const scene = new LapScene(canvas, detail, condition === "wet", hour);
    const world = buildCircuitWorld(track, ground, osm, photo, { wet: condition === "wet", street: false, detail, treeAtlases, city: CITY_CIRCUITS.has(trackId) });
    scene.scene.add(world.group);
    // this circuit's ground, kept: the corner view sets the shared one to its own corner when it opens
    scene.ground = currentGround();
    scene.disposables.push(world, photo);
    scene.stands = world.stands;
    scene.worldUpdate = world.update;
    if (skyline) {
      const hills = buildSkyline(skyline, { wet: false, horizon: `#${scene.sky.horizon.getHexString()}`, sunDir: scene.sunDir });
      hills.group.scale.setScalar(2.6);
      scene.hills = hills.group;
      scene.scene.add(hills.group);
      scene.disposables.push(hills);
    }
    // TV cameras: every 220 m round the lap, 26 m out from the centre line, 9 m up (over the barriers and the
    // nearer stands), on whichever side has no building in the way
    const blocks = (osm?.buildings ?? []).map((b) => b.p);
    scene.blocks = blocks.map((p) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < p.length; i += 2) {
        x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
        y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
      }
      return { p, box: [x0, y0, x1, y1] as const };
    });
    const inBuilding = (x: number, y: number) =>
      blocks.some((p) => {
        let hit = false;
        for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
          if (p[i + 1] > y !== p[j + 1] > y && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) hit = !hit;
        }
        return hit;
      });
    const cl = track.centerline;
    const step = track.lengthMeters / cl.length;
    for (let k = 0; k < cl.length; k += Math.round(220 / step)) {
      const a = cl[(k - 2 + cl.length) % cl.length];
      const b = cl[(k + 2) % cl.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const d = Math.hypot(dx, dy) || 1;
      let side = (k / Math.round(220 / step)) % 2 ? 1 : -1;
      // a building on this side, or between it and the track: the other side
      const clear = (sd: number) => [8, 14, 20, 26].every((r) => !inBuilding(cl[k][0] + (-dy / d) * r * sd, cl[k][1] + (dx / d) * r * sd));
      if (!clear(side)) {
        if (!clear(-side)) continue;
        side = -side;
      }
      const x = cl[k][0] + (-dy / d) * 26 * side;
      const y = cl[k][1] + (dx / d) * 26 * side;
      // nor by a grandstand, whose roof would fill the shot
      if (scene.stands.some((st) => Math.hypot(st.x - x, -st.z - y) < 55)) continue;
      scene.tvCams.push(new THREE.Vector3(x, scene.ground(x, y) + 9, -y));
    }
    // on a wet day the car is on full wets (the blue band)
    scene.car = buildCarF1(detail, { ...DEFAULT_LOOK, ...(look ?? {}), ...(condition === "wet" ? { tyreBand: "#2f8be6" } : {}) });
    scene.scene.add(scene.car.car);
    scene.disposables.push(scene.car);
    await scene.car.ready;
    return scene;
  }

  private worldUpdate: ((t: number) => void) | null = null;
  private dashAt = -1;
  private dashGear = 0;
  private ers = 0.9;
  private readonly fx = new LapEffects();
  private haze: HeatHazeEffect | null = null;
  /** the braking zones so far this lap, and until when (ms into the lap) the inside front tyre is locked */
  private brakeZone = { on: false, n: 0, lockUntil: -1 };

  private rain: RainField | null = null;
  private blocks: { p: number[]; box: readonly [number, number, number, number] }[] = [];

  /** whether a trackside camera sees the car: no building or grandstand on the line between them */
  private sightClear(c: THREE.Vector3, p: THREE.Vector3) {
    // every 2 m along the line (a stand's footprint can be narrow), a stand's roof reaching a few metres past it
    const n = Math.max(8, Math.ceil(c.distanceTo(p) / 2));
    for (let k = 1; k < n - 2; k++) {
      const t = k / n;
      const x = c.x + (p.x - c.x) * t;
      const y = -(c.z + (p.z - c.z) * t);
      for (const { p: poly, box } of this.blocks) {
        if (x < box[0] - 4 || x > box[2] + 4 || y < box[1] - 4 || y > box[3] + 4) continue;
        let hit = false;
        for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
          if (poly[i + 1] > y !== poly[j + 1] > y && x < ((poly[j] - poly[i]) * (y - poly[i + 1])) / (poly[j + 1] - poly[i + 1]) + poly[i]) hit = !hit;
        }
        if (hit) return false;
        // within the reach of its roof or rake: near an edge counts too
        for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
          const ex = poly[i] - poly[j];
          const ey = poly[i + 1] - poly[j + 1];
          const u = Math.max(0, Math.min(1, ((x - poly[j]) * ex + (y - poly[j + 1]) * ey) / (ex * ex + ey * ey || 1)));
          if (Math.hypot(x - poly[j] - ex * u, y - poly[j + 1] - ey * u) < 4) return false;
        }
      }
    }
    return true;
  }

  private constructor(canvas: HTMLCanvasElement, detail: "full" | "lite", private readonly wet = false, hour = 16.8) {
    // the sun at this hour of a summer's day in the Ardennes: high at midday, low and golden in the evening, moving
    // round from the south-east to the west
    const sun = sunAt(hour);
    this.sunElevation = sun.elevation;
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - sun.elevation), THREE.MathUtils.degToRad(sun.azimuth));
    this.sunTint = sun.tint;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, detail === "full" ? 2 : 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 0.82;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.sky = buildDaySky(this.renderer, this.sunDir, { overcast: wet, horizon: wet ? undefined : sun.horizon });
    this.scene.add(this.sky.group);
    this.disposables.push(this.sky);
    // in the rain the air is thick with spray and drizzle: the far side of the circuit greys out
    this.scene.fog = new THREE.Fog(this.sky.horizon, wet ? 60 : 260, wet ? 1500 : 5200);
    this.scene.environment = this.sky.environment;
    this.scene.environmentIntensity = wet ? 0.5 : 0.42;
    this.scene.add(wet ? new THREE.HemisphereLight("#c9cfd5", "#4a5046", 2.1) : new THREE.HemisphereLight(sun.skyLight, "#55603f", 1.1 * sun.fill));
    // under rain clouds the sun is weak and its shadows faint
    this.sun = new THREE.DirectionalLight(wet ? "#e4e8ec" : sun.tint, wet ? 0.5 : sun.intensity);
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
      this.haze = new HeatHazeEffect();
      composer.addPass(new EffectPass(this.camera, this.haze));
    }
    this.scene.add(this.fx.group);
    if (wet) {
      this.rain = new RainField(detail === "full" ? 9000 : 4000);
      this.scene.add(this.rain.mesh);
      this.disposables.push(this.rain);
    }
    this.disposables.push(this.fx);
    composer.addPass(new EffectPass(this.camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));
    // a low sun in the lens flares (computers only; never in the rain)
    if (detail === "full" && !wet) {
      this.flare = new LensFlareEffect();
      composer.addPass(new EffectPass(this.camera, this.flare));
    }
    composer.addPass(
      new EffectPass(
        this.camera,
        // the brightest things (the sun's glare, the lights, the sparks, a wet road's sheen) glow a little, as through
        // a real lens
        new BloomEffect({ luminanceThreshold: 4.5, luminanceSmoothing: 0.5, intensity: detail === "full" ? 0.45 : 0.3, mipmapBlur: true, radius: 0.55 }),
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
    this.path = new LapPath(sim, this.ground);
    this.vMax = Math.max(...sim.samples.speed);
    this.ghostPath = ghost ? new LapPath(ghost, this.ground) : null;
    this.ghostScale = ghostScale;
    this.lastT = -1;
    this.blur?.reset();
    if (ghost) this.makeGhost();
    if (this.ghost) this.ghost.car.visible = !!ghost;
  }

  private makeGhost() {
    if (this.ghost) return this.ghost;
    const g = buildCarF1("lite", { paint: "#cfd4da", paint2: "#7d838b", accent: "#ffffff" });
    this.ghost = g;
    g.car.visible = false;
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
    return g;
  }

  /**
   * Get the GPU ready before the lap: compile every shader (in parallel where the browser can), upload every texture
   * and draw one frame, while the player is still drawing their line. Otherwise the first frame of the lap does it
   * all at once and freezes the page for seconds on a phone. Safe to skip; the lap then just starts slower.
   */
  async warm() {
    const ghost = this.makeGhost();
    await Promise.all([this.car.ready, ghost.ready]);
    const wasGhost = ghost.car.visible;
    ghost.car.visible = true;
    await this.renderer.compileAsync(this.scene, this.camera);
    const seen = new Set<THREE.Texture>();
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const mat of m ? (Array.isArray(m) ? m : [m]) : [])
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture && !seen.has(v)) seen.add(v);
    });
    for (const tex of seen) this.renderer.initTexture(tex);
    await new Promise((r) => setTimeout(r, 0));
    this.composer?.render(0.016);
    ghost.car.visible = wasGhost;
  }

  /** the player's race number on the car (null: none) */
  setCarNumber(n: number | null) {
    this.car.setNumber(n);
  }

  setCamera(mode: LapCamera) {
    if (mode === this.cameraMode) return;
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
    this.fx.setResolution(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
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
    const dt = Math.min(0.25, dtMs / 1000);
    const jumped = this.lastT < 0 || tMs < this.lastT || dtMs > 1500;
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
    const lights: RearLights = tMs <= 0 ? (this.wet ? "on" : "off") : decel > 4 ? "harvest" : v > this.vMax * 0.96 ? "clip" : this.wet ? "on" : "off";
    this.car.setRearLights(lights);
    this.car.updateLights(this.clock);
    // the suspension, from the lap's accelerations: the nose dives under braking and lifts on the throttle, the body
    // leans out of a bend, and it squats with speed (downforce) and in compressions; an F1 car is stiff, so a degree
    // at most
    const ds = Math.max(2, v * 0.12);
    const v1 = path.speed(d - ds);
    const v2 = path.speed(d + ds);
    const along = tMs <= 0 ? 0 : (v2 * v2 - v1 * v1) / (2 * 2 * ds);
    const lateralG = tMs <= 0 ? 0 : (v * v * kappa) / 9.81;
    const hA = path.point(d - 8).y;
    const hB = path.point(d + 8).y;
    const vertical = tMs <= 0 ? 0 : ((hA + hB - 2 * p.y) / 64) * v * v / 9.81;
    const target = {
      pitch: THREE.MathUtils.clamp((-along / 9.81) * 0.0036, -0.006, 0.019),
      roll: THREE.MathUtils.clamp(lateralG * 0.0022, -0.011, 0.011),
      heave: THREE.MathUtils.clamp(-0.012 * (v / 90) ** 2 - 0.01 * vertical, -0.03, 0.01),
      // 2026 active aero: the flap opens on a straight at speed, and closes before the braking
      aero: tMs > 0 && Math.abs(kappa) < 1 / 700 && Math.abs(path.curvature(d + v * 0.6)) < 1 / 700 && v > 50 && path.speed(d + v * 0.8) >= v - 2 ? 1 : 0,
    };
    const k = jumped ? 1 : 1 - Math.pow(0.85, dt * 60);
    this.att.pitch += (target.pitch - this.att.pitch) * k;
    this.att.roll += (target.roll - this.att.roll) * k;
    this.att.heave += (target.heave - this.att.heave) * k;
    this.att.aero += THREE.MathUtils.clamp(target.aero - this.att.aero, -dt * 4, dt * 3);
    this.car.setAttitude(this.att.pitch, this.att.roll, this.att.heave);
    this.car.setAero(this.att.aero);
    this.car.setDriverVisible(this.cameraMode !== "cockpit");
    this.lastD = d;
    // the ghost at the pace target's lap time
    if (this.ghost && this.ghostPath) {
      // on the grid the ghost would sit inside the car: it shows once the lap is under way
      const gt = tMs / this.ghostScale;
      const gd = this.ghostPath.at(gt);
      const gp = this.placeCar(this.ghost, this.ghostPath, gd, this.ghostPath.speed(gd)).p;
      // a ghost inside the car only washes it out: it shows once the two are a car's length apart
      this.ghost.car.visible = tMs > 1500 && gp.distanceTo(p) > 6;
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
      // low and close, as in the F1 games, with the lens opening up with the speed: at a fixed narrow lens from
      // higher up, 300 km/h looked like 30 (no shake: the car read as trembling)
      const fast = THREE.MathUtils.clamp(v / 90, 0, 1);
      const boom = 5.3 - 0.4 * fast;
      const back = this.boomDir.clone().multiplyScalar(-boom * Math.cos(this.boomPitch)).setY(-boom * Math.sin(this.boomPitch));
      this.camera.position.copy(p).add(back).add(new THREE.Vector3(0, 1.25, 0));
      this.camera.lookAt(p.clone().addScaledVector(this.boomDir, 9).add(new THREE.Vector3(0, 0.5 + 9 * Math.sin(this.boomPitch), 0)));
      this.camera.fov = 64 + 10 * fast;
      this.camera.near = 0.3;
    } else if (this.cameraMode === "tcam") {
      // the T-cam over the airbox, as on the broadcasts: the helmet just below and ahead, the track beyond
      const eye = this.car.cameras.tcam ?? [-0.09, 1.06, 0.16];
      this.car.car.updateMatrixWorld();
      this.camera.position.set(0, eye[1] + 0.02, eye[2]).applyMatrix4(this.car.car.matrixWorld);
      this.camera.lookAt(new THREE.Vector3(0, eye[1] - 0.55, eye[2] - 10).applyMatrix4(this.car.car.matrixWorld));
      this.camera.fov = 64 + 8 * THREE.MathUtils.clamp(v / 90, 0, 1);
      this.camera.near = 0.08;
    } else if (this.cameraMode === "cockpit") {
      const eye = this.car.cameras.cockpit ?? [0, 0.74, -0.2];
      this.car.car.updateMatrixWorld();
      this.camera.position.set(eye[0], eye[1], eye[2]).applyMatrix4(this.car.car.matrixWorld);
      const look = new THREE.Vector3(eye[0], eye[1] - 0.15, eye[2] - 10).applyMatrix4(this.car.car.matrixWorld);
      this.camera.lookAt(look);
      this.camera.fov = 70 + 6 * THREE.MathUtils.clamp(v / 90, 0, 1);
      this.camera.near = 0.05;
    } else {
      // the nearest trackside camera ahead of the car, held until the car is past it
      let best = this.tvAt;
      if (best < 0 || this.tvCams[best].distanceTo(p) > 170 || !this.sightClear(this.tvCams[best], p)) {
        let bd = Infinity;
        this.tvCams.forEach((c, i) => {
          const dd = c.distanceTo(p);
          const toCam = c.clone().sub(p).setY(0).normalize();
          if (dd < bd && dd < 220 && toCam.dot(flat) > -0.2 && this.sightClear(c, p)) {
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

    // what the sound needs
    let nearest = Infinity;
    for (const st of this.stands) nearest = Math.min(nearest, st.distanceTo(p));
    Object.assign(this.telemetry, {
      v,
      along,
      vertical,
      decel,
      cameraDistance: this.camera.position.distanceTo(p),
      onboard: this.cameraMode === "cockpit" || this.cameraMode === "tcam",
      crowdNear: Math.max(0, 1 - nearest / 160),
      racing: tMs > 0 && tMs < path.lapMs,
    });

    this.sky.update(this.camera, this.clock);
    this.rain?.update(this.camera, this.clock, this.size.w * this.renderer.getPixelRatio(), this.size.h * this.renderer.getPixelRatio());
    this.worldUpdate?.(this.clock);
    if (this.hills) this.hills.position.set(this.camera.position.x, this.hills.position.y, this.camera.position.z);
    this.sun.target.position.copy(this.car.car.position);
    this.sun.position.copy(this.car.car.position).addScaledVector(this.sunDir, 400);
    this.blur?.setCar(this.car.car);
    // sparks from the floor in compressions, a lock-up's smoke in some of the hardest stops, the exhaust's shimmer
    if (jumped) {
      this.fx.reset();
      this.brakeZone = { on: false, n: 0, lockUntil: -1 };
    }
    const hard = decel > 40;
    if (hard && !this.brakeZone.on) {
      this.brakeZone.n++;
      // two stops in five, the same ones every time the lap plays (picked by where on the lap the stop is)
      const h = Math.sin(Math.round(d / 40) * 12.9898 + 4.1) * 43758.5453;
      if (h - Math.floor(h) < 0.4) this.brakeZone.lockUntil = tMs + 520;
    }
    this.brakeZone.on = decel > 25 && (hard || this.brakeZone.on);
    this.car.car.updateMatrixWorld();
    this.fx.update(dt, this.car.car, this.car.wheels, p.y, {
      v,
      // on a wet track the cars run higher and the water cools the blocks: hardly any sparks
      vertical: this.wet ? vertical * 0.6 : vertical,
      decel,
      velocity: flat.clone().multiplyScalar(v),
      turn: path.curvature(d + 20),
      lockup: !this.wet && tMs > 0 && tMs < this.brakeZone.lockUntil,
      wet: this.wet,
    });
    this.haze?.place(this.car.car, this.camera, this.cameraMode === "cockpit" ? 0 : v < 1 ? 1 : 0.5, this.clock);
    // the steering wheel's screen, a dozen times a second while it's in view
    this.ers = THREE.MathUtils.clamp(this.ers + dt * (decel > 4 ? 0.09 : v > 60 && along > -1 ? -0.022 : 0), 0, 1);
    if (jumped) this.ers = 0.9;
    if ((this.cameraMode === "cockpit" || this.cameraMode === "tcam") && (jumped || this.clock - this.dashAt > 0.08)) {
      this.dashAt = this.clock;
      const top = GEAR_TOP;
      const rpmIn = (g: number) => (v / top[g]) * 12500;
      if (jumped) this.dashGear = Math.max(0, top.findIndex((t) => v < t * 0.97));
      if (rpmIn(this.dashGear) > 12100 && this.dashGear < 7) this.dashGear++;
      else if (rpmIn(this.dashGear) < 8800 && this.dashGear > 0) this.dashGear--;
      const ghostMs = this.ghostPath ? this.ghostPath.timeAt((d / path.length) * this.ghostPath.length) * this.ghostScale : null;
      this.car.setDash({
        gear: this.dashGear + 1,
        kmh: v * 3.6,
        rpm: Math.min(1, Math.max(0, rpmIn(this.dashGear) / 12500)),
        lapMs: Math.max(0, Math.min(tMs, path.lapMs)),
        deltaMs: ghostMs != null && tMs > 500 ? path.timeAt(d) - ghostMs : null,
        ers: this.ers,
      });
    }
    this.flare?.place(this.camera, this.sunDir, this.sunTint, THREE.MathUtils.clamp(1.25 - this.sunElevation / 40, 0.35, 1));
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

/**
 * The sun at an hour (local, 0-24) of a summer's day at about 50 degrees north: its height and bearing, its colour
 * (white at midday, golden low down), how strong it is, the sky's light and the haze at the horizon.
 */
export function sunAt(hour: number) {
  const k = THREE.MathUtils.clamp((hour - 5.5) / 15, 0, 1);
  const elevation = Math.max(5, 60 * Math.sin(Math.PI * k));
  // the scene's south-west is the old fixed sun's bearing; round from there by 15 degrees an hour
  const azimuth = 215 - (hour - 14) * 15;
  const low = THREE.MathUtils.clamp(1 - (elevation - 8) / 30, 0, 1);
  const tint = new THREE.Color("#fff1dc").lerp(new THREE.Color("#ffb066"), low * 0.85);
  return {
    elevation,
    azimuth,
    tint,
    intensity: 3.2 - 1.0 * low,
    fill: 1 - 0.25 * low,
    skyLight: `#${new THREE.Color("#dce9f7").lerp(new THREE.Color("#e7d9c8"), low * 0.6).getHexString()}`,
    horizon: `#${new THREE.Color("#c3d0dc").lerp(new THREE.Color("#e3c9ac"), low * 0.8).getHexString()}`,
  };
}
