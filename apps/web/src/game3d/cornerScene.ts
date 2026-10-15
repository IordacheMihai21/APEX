import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import type { Condition } from "@apex/engine";
import type { CornerData } from "../modes/makeCorner";
import { CATALOG, loadScenery, loadTrack } from "../game/catalog";
import { buildCar } from "./car";
import { toWorld } from "./geometry";
import { buildTrackside } from "./trackside";
import { Particles } from "./particles";
import { EffectComposer, EffectPass, RenderPass, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode, VignetteEffect } from "postprocessing";
import { N8AOPostPass } from "n8ao";

/**
 * How much post-processing a device gets. High (computers): contact shadows (N8AO ambient occlusion), SMAA and a
 * vignette. Medium (phones): the same without the ambient occlusion, the costly part. Low: the plain render. A
 * device that can't keep up steps down by itself. (No bloom: the sky is far brighter than the rain light, so a bloom
 * caught the whole sky and washed a violet haze over the trees.)
 */
export type Quality = "high" | "medium" | "low";
const startQuality = (): Quality => {
  if (typeof matchMedia !== "function") return "medium";
  const phone = matchMedia("(pointer: coarse)").matches || Math.min(screen.width, screen.height) < 700;
  return phone ? "medium" : "high";
};
import { buildWorld } from "./world";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { type Surfaces, loadSurfaces } from "./textures";
import skyDry from "./assets/sky-rural_asphalt_road.hdr?url";
import skyWet from "./assets/sky-belfast_open_field.hdr?url";

/**
 * The 3D corner for Make the corner. A sky with a real sun (and the same sky
 * as the light the car's paint reflects), haze, the world around the corner
 * (world.ts: the rest of the circuit, buildings, grandstands, trees, water),
 * the corner itself (trackside.ts: road, kerbs, run-off, barriers, fences,
 * boards), rain on wet days, and the car on the racing line with a chase
 * camera. World units are metres; the track's (x, y) plane is three's
 * (x, -z), y up. Only game3d imports three, so it loads with the game.
 */

const SKY = {
  dry: { turbidity: 3.2, rayleigh: 1.3, mie: 0.004, g: 0.8, elevation: 36, azimuth: 205, fog: "#bccfe0", near: 260, far: 2300, sun: 2.3, hemi: 1.2, exposure: 0.6 },
  wet: { turbidity: 0, rayleigh: 0, mie: 0, g: 0, elevation: 50, azimuth: 205, fog: "#959da3", near: 90, far: 850, sun: 0.55, hemi: 1.6, exposure: 0.85 },
};

const DUST = new THREE.Color("#9c8562");
const SPRAY = new THREE.Color("#dde3e8");

export class CornerScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.3, 5000);
  private readonly car: THREE.Group;
  private readonly wheels: THREE.Object3D[];
  private readonly frontWheels: THREE.Object3D[];
  private readonly rainLight: THREE.Mesh;
  private readonly sun: THREE.DirectionalLight;
  private readonly sunDir: THREE.Vector3;
  private readonly rain: THREE.LineSegments | null = null;
  /** dust and gravel off the road, spray in the wet */
  private readonly particles = new Particles(900);
  private readonly wet: boolean;
  /** where the kerbs are: per point of the line, the two edges (track metres) and whether the corner bites there */
  private readonly edges: { s: number[]; lx: number[]; ly: number[]; rx: number[]; ry: number[]; kerb: boolean[] };
  private baseFov = 58;
  private lastSpeed = 0;
  private decel = 0;
  private clock = 0;
  /** the barrier lines, and where a car that ran off stopped against them (with the moment, for the jolt) */
  private barriers: [number, number][][] = [];
  private hit: { x: number; y: number; heading: number; at: number } | null = null;
  private quality: Quality = startQuality();
  private composer: EffectComposer | null = null;
  private ao: N8AOPostPass | null = null;
  private size = { w: 1, h: 1 };
  /** frame times, for stepping the quality down on a device that can't keep up */
  private slowFrames = 0;
  private readonly exposure: number;
  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();
  private readonly camDir = new THREE.Vector3(0, 0, -1);
  private camReady = false;
  private wheelTurn = 0;
  private steer = 0;
  private readonly disposables: { dispose(): void }[] = [];
  private readonly carReady: Promise<void>;

  /** Load the circuit and its surroundings, then build the corner. */
  static async create(canvas: HTMLCanvasElement, c: CornerData, condition: Condition): Promise<CornerScene> {
    const [track, osm, photo, hdr] = await Promise.all([
      loadTrack(c.trackId),
      loadScenery(c.trackId),
      loadSurfaces(),
      new HDRLoader().loadAsync(condition === "wet" ? skyWet : skyDry),
    ]);
    const scene = new CornerScene(canvas, c, condition, track, osm, photo, hdr);
    await scene.carReady;
    return scene;
  }

  private constructor(
    canvas: HTMLCanvasElement,
    c: CornerData,
    condition: Condition,
    track: Awaited<ReturnType<typeof loadTrack>>,
    osm: Awaited<ReturnType<typeof loadScenery>>,
    photo: Surfaces,
    hdr: THREE.DataTexture,
  ) {
    const wet = condition === "wet";
    const look = wet ? SKY.wet : SKY.dry;
    const street = CATALOG.find((t) => t.id === c.trackId)?.style === "street";
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; // keeps the orange paint orange in full sun (ACES bleached it to peach)
    this.renderer.toneMappingExposure = look.exposure;
    this.exposure = look.exposure;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ---- the sky, and the same sky as the light everything reflects: a clear sky with a real sun, or low cloud on a wet day
    const makeSky = (scale: number): THREE.Mesh => {
      if (!wet) {
        const sky = new Sky();
        sky.scale.setScalar(scale);
        const u = sky.material.uniforms;
        u.turbidity.value = look.turbidity;
        u.rayleigh.value = look.rayleigh;
        u.mieCoefficient.value = look.mie;
        u.mieDirectionalG.value = look.g;
        u.sunPosition.value.copy(this.sunDir);
        return sky;
      }
      const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { top: { value: new THREE.Color("#5e676e") }, horizon: { value: new THREE.Color("#a9b1b6") } },
        vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader:
          "uniform vec3 top; uniform vec3 horizon; varying vec3 vDir; void main() { float t = pow(clamp(vDir.y, 0.0, 1.0), 0.45); gl_FragColor = vec4(mix(horizon, top, t), 1.0); }",
      });
      return new THREE.Mesh(new THREE.SphereGeometry(scale / 2, 32, 16), mat);
    };
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - look.elevation), THREE.MathUtils.degToRad(look.azimuth));
    const sky = makeSky(4000);
    this.scene.add(sky);
    {
      // what everything reflects and is lit by: a real photographed sky (CC0, Poly Haven): a sunny rural road, or
      // an overcast field on a wet day; the sky drawn behind stays the procedural one, with the sun where the shadows say
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      const env = pmrem.fromEquirectangular(hdr);
      this.scene.environment = env.texture;
      this.scene.environmentIntensity = wet ? 0.85 : 1.25;
      hdr.dispose();
      this.track(env, pmrem, sky.geometry, sky.material as THREE.Material, photo);
    }
    this.scene.fog = new THREE.Fog(look.fog, look.near, look.far);

    this.scene.add(new THREE.HemisphereLight(wet ? "#d4dade" : "#dcebff", "#46603a", look.hemi));
    this.sun = new THREE.DirectionalLight(wet ? "#e9eef2" : "#fff1dc", look.sun);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -45;
    sc.right = sc.top = 45;
    sc.near = 1;
    sc.far = 400;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    // ---- the world, then the corner (its barriers keep clear of the rest of the circuit)
    const world = buildWorld(c, track, osm, wet, street, photo);
    const side = buildTrackside(c, { street, wet, others: world.others, halfWidth: world.halfWidth, photo });
    this.scene.add(world.group, side.group);
    this.barriers = side.barriers;
    this.track(world, side);

    // ---- rain: streaks falling through a box around the camera
    if (wet) {
      const count = 2600;
      const pos = new Float32Array(count * 6);
      for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * 70;
        const y = Math.random() * 30;
        const z = (Math.random() - 0.5) * 70;
        pos.set([x, y, z, x + 0.05, y + 0.7, z + 0.05], i * 6);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.LineBasicMaterial({ color: "#aeb8c2", transparent: true, opacity: 0.55, fog: false });
      this.rain = new THREE.LineSegments(geo, mat);
      this.rain.frustumCulled = false;
      this.scene.add(this.rain);
      this.track(geo, mat);
    }

    // ---- the car
    const built = buildCar();
    this.car = built.car;
    this.wheels = built.wheels;
    this.frontWheels = built.front;
    this.rainLight = built.rainLight;
    this.carReady = built.ready;
    this.scene.add(this.car);
    this.track(built);

    this.wet = wet;
    this.scene.add(this.particles.points);
    this.track(this.particles);
    const k = c.conditions.dry.kappa;
    this.edges = { s: c.s, lx: c.lx, ly: c.ly, rx: c.rx, ry: c.ry, kerb: k.map((_, i) => k.slice(Math.max(0, i - 5), i + 6).some((x) => Math.abs(x) > 1 / 320)) };
  }

  private track(...things: { dispose(): void }[]) {
    this.disposables.push(...things);
  }

  /** Build (or drop) the post-processing for the current quality. */
  private setupPost() {
    this.composer?.dispose();
    this.composer = null;
    this.ao = null;
    if (this.quality === "low") {
      this.renderer.toneMapping = THREE.NeutralToneMapping;
      return;
    }
    // tone mapping moves to the end of the chain, in high precision
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = this.exposure;
    const composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, stencilBuffer: this.quality === "high", depthBuffer: true });
    const render = new RenderPass(this.scene, this.camera);
    if (this.quality === "high") render.clearPass.setClearFlags(true, true, true);
    composer.addPass(render);
    if (this.quality === "high") {
      const ao = new N8AOPostPass(this.scene, this.camera, this.size.w, this.size.h);
      ao.setQualityMode("Low");
      ao.configuration.aoRadius = 1.6;
      ao.configuration.distanceFalloff = 1.0;
      ao.configuration.intensity = 2.2;
      ao.configuration.halfRes = true;
      composer.addPass(ao);
      this.ao = ao;
    }
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
    const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.42 });
    composer.addPass(new EffectPass(this.camera, new SMAAEffect({ preset: SMAAPreset.MEDIUM })));
    composer.addPass(new EffectPass(this.camera, tone, vignette));
    composer.setSize(this.size.w, this.size.h, false);
    this.composer = composer;
  }

  /** The quality in use (it can step down by itself). */
  get currentQuality(): Quality {
    return this.quality;
  }

  setQuality(q: Quality) {
    if (q === this.quality && (this.composer || q === "low")) return;
    this.quality = q;
    this.setupPost();
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.size = { w: width, h: height };
    if (this.composer) this.composer.setSize(width, height, false);
    else if (this.quality !== "low") this.setupPost();
    this.camera.aspect = width / Math.max(1, height);
    // keep at least ~78° across, so a phone held upright still sees the corner coming
    const across = 2 * Math.atan(Math.tan((78 * Math.PI) / 360) / this.camera.aspect);
    this.baseFov = Math.min(78, Math.max(58, (across * 180) / Math.PI));
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.particles.setScale(height, this.baseFov);
  }

  /** Put the car where the run is and draw: pose (on the line, or off it), speed (m/s) and braking (rain light). */
  /** The car's distance inside the nearer track edge at a point of the line (m; negative: over it), and whether a kerb is there. */
  private edgeGap(x: number, y: number, s: number): { gap: number; kerb: boolean } {
    const e = this.edges;
    let i = 0;
    while (i < e.s.length - 2 && e.s[i + 1] <= s) i++;
    const toL = Math.hypot(e.lx[i] - x, e.ly[i] - y);
    const toR = Math.hypot(e.rx[i] - x, e.ry[i] - y);
    const width = Math.hypot(e.lx[i] - e.rx[i], e.ly[i] - e.ry[i]);
    // over an edge, the far edge is further than the road is wide
    const gap = Math.max(toL, toR) > width ? -Math.min(toL, toR) : Math.min(toL, toR);
    return { gap, kerb: e.kerb[i] };
  }

  /**
   * Put the car where the run is and draw: pose (on the line with `s`, or off the road without), speed (m/s) and
   * braking (rain light). The camera feels it: a wider view with speed, a fine buzz from the engine and the road, a
   * nod forward under braking, a lean against the corner, a hammering over the kerbs and a rough ride off the road.
   */
  /** True once a car that ran off has stopped against a barrier. */
  get crashed(): boolean {
    return this.hit !== null;
  }

  /** How close a point is to a barrier (m). */
  private barrierGap(x: number, y: number): number {
    let best = Infinity;
    for (const line of this.barriers)
      for (let i = 0; i < line.length; i += 2) {
        const d = (line[i][0] - x) ** 2 + (line[i][1] - y) ** 2;
        if (d < best) best = d;
      }
    return Math.sqrt(best);
  }

  render(pose: { x: number; y: number; heading: number; kappa: number; s?: number }, speed: number, braking: boolean, dt = 1 / 60) {
    // off the road, the car stops where it meets the barrier (instead of driving through it)
    if (pose.s !== undefined) this.hit = null;
    else if (!this.hit && this.barrierGap(pose.x, pose.y) < 2.6) this.hit = { x: pose.x, y: pose.y, heading: pose.heading, at: this.clock };
    if (this.hit) {
      pose = { ...pose, x: this.hit.x, y: this.hit.y, heading: this.hit.heading };
      speed = 0;
    }
    const dir = new THREE.Vector3(Math.cos(pose.heading), 0, -Math.sin(pose.heading));
    const p = toWorld(pose.x, pose.y);
    this.car.position.copy(p);
    this.car.rotation.y = Math.atan2(-dir.x, -dir.z);
    // wheels roll with the speed (radius 0.36 m); the fronts steer with the line's curvature (wheelbase 3.4 m)
    this.wheelTurn -= (speed * dt) / 0.36;
    // the front wheels steer with the line's curvature (wheelbase 3.4 m: tan(angle) = wheelbase x curvature), eased
    this.steer += (Math.atan(3.4 * pose.kappa) - this.steer) * Math.min(1, dt * 12);
    for (const w of this.wheels) w.rotation.x = this.wheelTurn;
    for (const w of this.frontWheels) w.rotation.y = this.steer;
    (this.rainLight.material as THREE.MeshStandardMaterial).emissiveIntensity = braking ? 6 : 0.4;

    // chase camera: a fixed distance behind and above the car, its direction eased so it swings smoothly through
    // the corner (easing the position itself would leave it metres behind at 300 km/h)
    // upright phones: a little higher and tilted down, so the road fills the view rather than the sky
    const tall = this.camera.aspect < 1;
    const ease = this.camReady ? 1 - Math.exp(-dt * 5) : 1;
    this.camDir.lerp(dir, ease).normalize();
    this.camReady = true;
    // what the car is feeling: braking (smoothed deceleration), cornering (lateral g), kerbs, the gravel
    this.clock += dt;
    if (dt > 0) this.decel += (Math.max(0, (this.lastSpeed - speed) / dt) - this.decel) * Math.min(1, dt * 6);
    this.lastSpeed = speed;
    const offRoad = pose.s === undefined;
    const edge = offRoad ? null : this.edgeGap(pose.x, pose.y, pose.s!);
    const onKerb = !!edge && edge.kerb && edge.gap < 1.0 && speed > 5;
    const fast = Math.min(1, speed / 90);
    const brake = Math.min(1, this.decel / 40);
    const lean = Math.max(-1, Math.min(1, (speed * speed * pose.kappa) / 45));
    // the buzz: a few unrelated frequencies, so it never looks like a regular wobble
    const t = this.clock;
    // the moment it meets the barrier: a hard jolt that dies away in half a second
    const crash = this.hit ? Math.max(0, 1 - (t - this.hit.at) / 0.5) : 0;
    const buzz = (0.003 + 0.01 * fast) * (onKerb ? 4 : 1) + (offRoad && speed > 1 ? 0.05 * Math.min(1, speed / 30) : 0) + 0.18 * crash * crash;
    const jx = buzz * (Math.sin(t * 71) + 0.6 * Math.sin(t * 113 + 1.7));
    const jy = buzz * (Math.sin(t * 89 + 0.4) + 0.7 * Math.sin(t * 131 + 2.3)) + (onKerb ? 0.03 * Math.sin((pose.s! / 1.25) * Math.PI * 2) : 0);
    const right = new THREE.Vector3(-this.camDir.z, 0, this.camDir.x);
    this.camPos
      .copy(p)
      .addScaledVector(this.camDir, (tall ? -4.8 : -5.4) + brake * 0.7)
      .add(new THREE.Vector3(0, (tall ? 2.05 : 1.75) - brake * 0.25 + jy, 0))
      .addScaledVector(right, jx - lean * 0.25);
    this.camLook
      .copy(p)
      .addScaledVector(this.camDir, tall ? 10 : 12)
      .add(new THREE.Vector3(0, (tall ? 0.1 : 0.55) - brake * 0.9, 0));
    this.camera.position.copy(this.camPos);
    // lean into the corner: tilt the camera's up a little against the turn
    this.camera.up.set(0, 1, 0).addScaledVector(right, lean * 0.05).normalize();
    this.camera.lookAt(this.camLook);
    const fov = this.baseFov + 7 * fast * fast;
    if (Math.abs(fov - this.camera.fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    // the car bounces over the kerbs and the gravel
    this.car.position.y = onKerb ? 0.025 * Math.abs(Math.sin((pose.s! / 1.25) * Math.PI * 2)) : offRoad && speed > 1 ? 0.02 * Math.abs(Math.sin(t * 37)) : 0;
    this.car.rotation.z = onKerb ? 0.012 * Math.sin((pose.s! / 1.25) * Math.PI * 2) : 0;

    // particles from the rear wheels: dust and stones off the road, spray in the wet
    if (dt > 0) {
      const back = dir.clone().multiplyScalar(-1);
      for (const sx of [-0.83, 0.83]) {
        const wheel = this.car.localToWorld(new THREE.Vector3(sx, 0.25, 1.6));
        if (offRoad && speed > 2) {
          for (let n = 0; n < 4; n++) {
            const v = back.clone().multiplyScalar(speed * (0.15 + Math.random() * 0.15)).add(new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4));
            this.particles.emit(wheel, v, 0.6 + Math.random() * 0.8, 2.8, 1.2 + Math.random() * 0.7, DUST, 0.75);
          }
        } else if (crash > 0.9) {
          // the impact throws up a cloud
          for (let n = 0; n < 10; n++) {
            const v = dir.clone().multiplyScalar(2 + Math.random() * 4).add(new THREE.Vector3((Math.random() - 0.5) * 5, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 5));
            this.particles.emit(wheel, v, 0.7 + Math.random() * 0.6, 1.6, 1.2 + Math.random() * 0.8, DUST, 0.5);
          }
        } else if (this.wet && speed > 15) {
          // a rooster tail of spray off each rear tyre, thicker the faster the car goes
          for (let n = 0; n < 3; n++) {
            const v = back.clone().multiplyScalar(speed * (0.3 + Math.random() * 0.25)).add(new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 3));
            this.particles.emit(wheel, v, 0.7 + Math.random() * 0.6, 4.5, 0.55 + Math.random() * 0.35, SPRAY, 0.42 * Math.min(1, speed / 50));
          }
        }
      }
      this.particles.update(dt);
    }
    // the sun's shadow box follows the car
    this.sun.position.copy(p).addScaledVector(this.sunDir, 150);
    this.sun.target.position.copy(p);
    // the rain falls around the camera
    if (this.rain) {
      this.rain.position.set(this.camPos.x, 0, this.camPos.z);
      const a = this.rain.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = a.array as Float32Array;
      const fall = 24 * dt;
      for (let i = 0; i < arr.length; i += 6) {
        arr[i + 1] -= fall;
        arr[i + 4] -= fall;
        if (arr[i + 1] < 0) {
          arr[i + 1] += 30;
          arr[i + 4] += 30;
        }
      }
      a.needsUpdate = true;
    }
    // a device that keeps taking longer than ~40 ms a frame steps down a quality
    if (dt > 0.04) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 45 && this.quality !== "low") {
      this.slowFrames = 0;
      this.setQuality(this.quality === "high" ? "medium" : "low");
    }
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.composer?.dispose();
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
  }
}
