import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import type { Condition } from "@apex/engine";
import type { CornerData } from "../modes/makeCorner";
import { CATALOG, loadScenery, loadTrack } from "../game/catalog";
import { buildCar } from "./car";
import { toWorld } from "./geometry";
import { buildTrackside } from "./trackside";
import { buildWorld } from "./world";

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
    const [track, osm] = await Promise.all([loadTrack(c.trackId), loadScenery(c.trackId)]);
    const scene = new CornerScene(canvas, c, condition, track, osm);
    await scene.carReady;
    return scene;
  }

  private constructor(canvas: HTMLCanvasElement, c: CornerData, condition: Condition, track: Awaited<ReturnType<typeof loadTrack>>, osm: Awaited<ReturnType<typeof loadScenery>>) {
    const wet = condition === "wet";
    const look = wet ? SKY.wet : SKY.dry;
    const street = CATALOG.find((t) => t.id === c.trackId)?.style === "street";
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", logarithmicDepthBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; // keeps the orange paint orange in full sun (ACES bleached it to peach)
    this.renderer.toneMappingExposure = look.exposure;
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
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const envScene = new THREE.Scene();
      const envSky = makeSky(1000);
      // the light everything reflects is the sky without the sun's disc: the disc is so bright that a car with the
      // sun behind the camera reflected it as a washed-out, almost white body
      const envUniforms = (envSky.material as THREE.ShaderMaterial).uniforms;
      if (envUniforms.showSunDisc) envUniforms.showSunDisc.value = 0;
      envScene.add(envSky);
      const env = pmrem.fromScene(envScene, 0, 0.1, 2000);
      this.scene.environment = env.texture;
      this.scene.environmentIntensity = wet ? 0.9 : 0.7;
      this.track(env, pmrem, envSky.geometry, envSky.material as THREE.Material, sky.geometry, sky.material as THREE.Material);
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
    const world = buildWorld(c, track, osm, wet, street);
    const side = buildTrackside(c, { street, wet, others: world.others, halfWidth: world.halfWidth });
    this.scene.add(world.group, side.group);
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
  }

  private track(...things: { dispose(): void }[]) {
    this.disposables.push(...things);
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    // keep at least ~78° across, so a phone held upright still sees the corner coming
    const across = 2 * Math.atan(Math.tan((78 * Math.PI) / 360) / this.camera.aspect);
    this.camera.fov = Math.min(78, Math.max(58, (across * 180) / Math.PI));
    this.camera.updateProjectionMatrix();
  }

  /** Put the car where the run is and draw: pose (on the line, or off it), speed (m/s) and braking (rain light). */
  render(pose: { x: number; y: number; heading: number; kappa: number }, speed: number, braking: boolean, dt = 1 / 60) {
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
    this.camPos.copy(p).addScaledVector(this.camDir, tall ? -4.8 : -5.4).add(new THREE.Vector3(0, tall ? 2.05 : 1.75, 0));
    this.camLook.copy(p).addScaledVector(this.camDir, tall ? 10 : 12).add(new THREE.Vector3(0, tall ? 0.1 : 0.55, 0));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
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
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
  }
}
