import * as THREE from "three";
import { BlendFunction, Effect } from "postprocessing";

/**
 * What a broadcast catches round the car beyond the car itself:
 * - Sparks: the titanium skid blocks under the plank (no more than 3 mm proud of it) scrape the track where the car bottoms out (the compression at
 *   the foot of Eau Rouge, a bump at top speed), throwing white-hot streaks that trail behind it, bounce on the
 *   tarmac and die orange.
 * - Lock-up smoke: on the hardest stops the inside front tyre locks for a moment and leaves a puff of blue-white
 *   smoke hanging over the braking zone.
 * - Heat haze: the air behind the exhaust shimmers (a post effect over a patch of the screen behind the car).
 * Sparks and smoke are pooled quads drawn in one call each.
 */

const SPARKS = 420;
const PUFFS = 320;

const SPARK_VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec2 iLife;
uniform vec2 uRes;
varying float vHeat;
varying float vAcross;
void main() {
  float k = iLife.x / max(iLife.y, 0.001);
  vHeat = 1.0 - k;
  vAcross = position.y;
  // a streak from where it is back along its path (the exposure), at least two pixels long
  vec4 a = projectionMatrix * viewMatrix * vec4(iPos, 1.0);
  vec4 b = projectionMatrix * viewMatrix * vec4(iPos - iVel * 0.022, 1.0);
  vec2 sa = a.xy / a.w;
  vec2 sb = b.xy / b.w;
  vec2 d = (sa - sb) * uRes;
  float len = length(d);
  vec2 dir = len > 0.001 ? d / len : vec2(1.0, 0.0);
  if (len < 2.0) sb = sa - dir * 2.0 / uRes;
  vec4 p = mix(b, a, position.x);
  // a pixel and a half across, a little wider near
  float w = (2.2 + 6.0 / max(a.w, 1.0)) * (0.6 + 0.4 * vHeat);
  p.xy += vec2(-dir.y, dir.x) * position.y * w / uRes * p.w;
  if (iLife.x >= iLife.y) p = vec4(2.0, 2.0, 2.0, 1.0);
  gl_Position = p;
}`;

const SPARK_FRAG = /* glsl */ `
varying float vHeat;
varying float vAcross;
void main() {
  // white-hot when new, through yellow to a dull orange as it cools
  vec3 col = mix(vec3(1.0, 0.22, 0.02), mix(vec3(1.0, 0.55, 0.08), vec3(1.0, 0.9, 0.55), smoothstep(0.6, 1.0, vHeat)), smoothstep(0.0, 0.6, vHeat));
  float edge = smoothstep(1.0, 0.2, abs(vAcross));
  gl_FragColor = vec4(col * (3.0 + 5.0 * vHeat), edge);
}`;

const PUFF_VERT = /* glsl */ `
attribute vec3 iPos;
attribute vec2 iLife;
attribute float iSize;
varying vec2 vUv;
varying float vAge;
varying float iSizeV;
void main() {
  iSizeV = iSize;
  float k = clamp(iLife.x / max(iLife.y, 0.001), 0.0, 1.0);
  vAge = k;
  vUv = position.xy;
  // a billboard that grows as it spreads
  float s = abs(iSize) * (0.45 + 1.6 * sqrt(k));
  vec4 v = viewMatrix * vec4(iPos + vec3(0.0, 0.35 * k, 0.0), 1.0);
  v.xy += position.xy * s;
  gl_Position = projectionMatrix * v;
  if (iLife.x >= iLife.y) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const PUFF_FRAG = /* glsl */ `
varying vec2 vUv;
varying float vAge;
varying float iSizeV;
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  float r = length(vUv);
  // a soft, lumpy ball of smoke
  float n = noise(vUv * 3.0 + vAge * 2.0) * 0.5 + noise(vUv * 7.0 - vAge) * 0.25;
  float a = smoothstep(1.0, 0.15, r + (n - 0.35) * 0.6);
  // spray (a negative size) is thinner and fades sooner than smoke
  float spray = step(iSizeV, 0.0);
  a *= (1.0 - smoothstep(mix(0.25, 0.1, spray), 1.0, vAge)) * smoothstep(0.0, 0.06, vAge) * mix(0.55, 0.11, spray);
  vec3 col = mix(vec3(0.86, 0.88, 0.92), vec3(0.7, 0.72, 0.76), n);
  gl_FragColor = vec4(col, a);
}`;

function quad(across: [number, number]) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, across[0], 0, 1, across[0], 0, 1, across[1], 0, 0, across[1], 0], 3),
  );
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

export interface EffectInput {
  /** the car's speed (m/s), the vertical load from the road's shape (g, plus in a compression), how hard it brakes (m/s²) */
  v: number;
  vertical: number;
  decel: number;
  /** the car's velocity in the world (m/s) */
  velocity: THREE.Vector3;
  /** the car goes left (+) or right (-) into the bend: the inside front tyre locks */
  turn: number;
  /** a lock-up wanted here (decided per braking zone by the scene) */
  lockup: boolean;
  /** a wet track: the tyres throw up spray */
  wet?: boolean;
}

export class LapEffects {
  readonly group = new THREE.Group();
  private readonly sparkGeo = quad([-1, 1]);
  private readonly puffGeo = new THREE.InstancedBufferGeometry();
  private readonly sp: { pos: Float32Array; vel: Float32Array; life: Float32Array; next: number };
  private readonly pf: { pos: Float32Array; vel: Float32Array; life: Float32Array; size: Float32Array; next: number };
  private readonly sparkMat: THREE.ShaderMaterial;
  private readonly puffMat: THREE.ShaderMaterial;
  private sparkDebt = 0;
  private puffDebt = 0;
  private sprayDebt = 0;
  private rnd = 1;
  private readonly tmp = new THREE.Vector3();

  constructor() {
    this.sp = { pos: new Float32Array(SPARKS * 3), vel: new Float32Array(SPARKS * 3), life: new Float32Array(SPARKS * 2), next: 0 };
    for (let i = 0; i < SPARKS; i++) this.sp.life[i * 2] = this.sp.life[i * 2 + 1] = 1;
    this.sparkGeo.setAttribute("iPos", new THREE.InstancedBufferAttribute(this.sp.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.sparkGeo.setAttribute("iVel", new THREE.InstancedBufferAttribute(this.sp.vel, 3).setUsage(THREE.DynamicDrawUsage));
    this.sparkGeo.setAttribute("iLife", new THREE.InstancedBufferAttribute(this.sp.life, 2).setUsage(THREE.DynamicDrawUsage));
    this.sparkGeo.instanceCount = SPARKS;
    this.sparkMat = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      uniforms: { uRes: { value: new THREE.Vector2(1280, 720) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sparks = new THREE.Mesh(this.sparkGeo, this.sparkMat);
    sparks.frustumCulled = false;
    sparks.renderOrder = 5;

    this.pf = { pos: new Float32Array(PUFFS * 3), vel: new Float32Array(PUFFS * 3), life: new Float32Array(PUFFS * 2), size: new Float32Array(PUFFS), next: 0 };
    for (let i = 0; i < PUFFS; i++) this.pf.life[i * 2] = this.pf.life[i * 2 + 1] = 1;
    this.puffGeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    this.puffGeo.setIndex([0, 1, 2, 0, 2, 3]);
    this.puffGeo.setAttribute("iPos", new THREE.InstancedBufferAttribute(this.pf.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.puffGeo.setAttribute("iLife", new THREE.InstancedBufferAttribute(this.pf.life, 2).setUsage(THREE.DynamicDrawUsage));
    this.puffGeo.setAttribute("iSize", new THREE.InstancedBufferAttribute(this.pf.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.puffGeo.instanceCount = PUFFS;
    this.puffMat = new THREE.ShaderMaterial({
      vertexShader: PUFF_VERT,
      fragmentShader: PUFF_FRAG,
      transparent: true,
      depthWrite: false,
    });
    const puffs = new THREE.Mesh(this.puffGeo, this.puffMat);
    puffs.frustumCulled = false;
    puffs.renderOrder = 6;
    this.group.add(sparks, puffs);
  }

  private random() {
    this.rnd = (this.rnd * 16807) % 2147483647;
    return this.rnd / 2147483647;
  }

  setResolution(w: number, h: number) {
    (this.sparkMat.uniforms.uRes.value as THREE.Vector2).set(w, h);
  }

  /** Clear everything in the air (a jump in the lap, a new lap). */
  reset() {
    for (let i = 0; i < SPARKS; i++) this.sp.life[i * 2] = this.sp.life[i * 2 + 1];
    for (let i = 0; i < PUFFS; i++) this.pf.life[i * 2] = this.pf.life[i * 2 + 1];
    this.sparkDebt = 0;
    this.puffDebt = 0;
  }

  /** Move everything on by dt (s), and throw new sparks and smoke from the car (its world matrix up to date). */
  update(dt: number, car: THREE.Object3D, wheels: THREE.Object3D[], groundY: number, e: EffectInput) {
    const { sp, pf } = this;
    // sparks: hard in a compression, a few at top speed on a bump; none slow
    const fast = Math.max(0, (e.v - 62) / 30);
    const rate = e.v < 45 ? 0 : 380 * THREE.MathUtils.clamp((e.vertical - 0.55) / 0.7, 0, 1) + (this.random() < 0.012 ? 300 : 0) * fast;
    this.sparkDebt += rate * dt;
    while (this.sparkDebt >= 1) {
      this.sparkDebt -= 1;
      const i = sp.next;
      sp.next = (sp.next + 1) % SPARKS;
      // from under the floor: the plank, from the middle back to the rear axle
      this.tmp.set((this.random() - 0.5) * 0.5, 0.03, 0.2 + this.random() * 1.6).applyMatrix4(car.matrixWorld);
      sp.pos[i * 3] = this.tmp.x;
      sp.pos[i * 3 + 1] = groundY + 0.03;
      sp.pos[i * 3 + 2] = this.tmp.z;
      // they leave at most of the car's speed (the track drags them back), fanning out and up
      const keep = 0.55 + this.random() * 0.3;
      // low over the tarmac in a narrow fan: they skim the ground, few rise above the tyres
      sp.vel[i * 3] = e.velocity.x * keep + (this.random() - 0.5) * 2.6;
      sp.vel[i * 3 + 1] = 0.1 + this.random() * this.random() * 1.4;
      sp.vel[i * 3 + 2] = e.velocity.z * keep + (this.random() - 0.5) * 2.6;
      sp.life[i * 2] = this.random() * 0.02;
      sp.life[i * 2 + 1] = 0.15 + this.random() * 0.25;
    }
    const drag = Math.pow(0.35, dt);
    for (let i = 0; i < SPARKS; i++) {
      if (sp.life[i * 2] >= sp.life[i * 2 + 1]) continue;
      sp.life[i * 2] += dt;
      sp.vel[i * 3 + 1] -= 9.81 * dt;
      sp.vel[i * 3] *= drag;
      sp.vel[i * 3 + 2] *= drag;
      sp.pos[i * 3] += sp.vel[i * 3] * dt;
      sp.pos[i * 3 + 1] += sp.vel[i * 3 + 1] * dt;
      sp.pos[i * 3 + 2] += sp.vel[i * 3 + 2] * dt;
      // a bounce on the tarmac, losing most of it
      if (sp.pos[i * 3 + 1] < groundY + 0.01 && sp.vel[i * 3 + 1] < 0) {
        sp.pos[i * 3 + 1] = groundY + 0.01;
        sp.vel[i * 3 + 1] *= -0.2;
      }
    }
    // smoke: from the inside front tyre while it's locked
    if (e.lockup && e.v > 12) {
      this.puffDebt += 55 * dt;
      const inside = wheels.find((w) => w.name.startsWith("wheel-F") && Math.sign(w.position.x) === (e.turn >= 0 ? -1 : 1)) ?? wheels[0];
      while (this.puffDebt >= 1 && inside) {
        this.puffDebt -= 1;
        const i = pf.next;
        pf.next = (pf.next + 1) % PUFFS;
        this.tmp.set(inside.position.x, 0.18, inside.position.z + 0.2).applyMatrix4(car.matrixWorld);
        pf.pos[i * 3] = this.tmp.x;
        pf.pos[i * 3 + 1] = groundY + 0.2;
        pf.pos[i * 3 + 2] = this.tmp.z;
        pf.vel[i * 3] = e.velocity.x * 0.18 + (this.random() - 0.5);
        pf.vel[i * 3 + 1] = 0.25;
        pf.vel[i * 3 + 2] = e.velocity.z * 0.18 + (this.random() - 0.5);
        pf.life[i * 2] = 0;
        pf.life[i * 2 + 1] = 1.4 + this.random() * 0.8;
        pf.size[i] = 0.45 + this.random() * 0.3;
      }
    }
    // spray: on a wet track each tyre lifts a plume of water, the rears most, growing with the speed
    if (e.wet && e.v > 12) {
      const k = Math.min(1, (e.v - 12) / 60);
      this.sprayDebt += 95 * k * dt;
      while (this.sprayDebt >= 1) {
        this.sprayDebt -= 1;
        const w = wheels[Math.floor(this.random() * wheels.length)];
        if (!w) break;
        const rear = !w.name.startsWith("wheel-F");
        if (!rear && this.random() < 0.6) continue;
        const i = pf.next;
        pf.next = (pf.next + 1) % PUFFS;
        this.tmp.set(w.position.x * 1.05, 0.3, w.position.z + 0.45).applyMatrix4(car.matrixWorld);
        pf.pos[i * 3] = this.tmp.x;
        pf.pos[i * 3 + 1] = groundY + 0.3 + this.random() * 0.3;
        pf.pos[i * 3 + 2] = this.tmp.z;
        // the water leaves the tyre at about half the car's speed and rises into a cloud behind it
        const keep = 0.35 + this.random() * 0.25;
        pf.vel[i * 3] = e.velocity.x * keep + (this.random() - 0.5) * 3;
        pf.vel[i * 3 + 1] = 1.2 + this.random() * 2.2 * k;
        pf.vel[i * 3 + 2] = e.velocity.z * keep + (this.random() - 0.5) * 3;
        pf.life[i * 2] = 0;
        pf.life[i * 2 + 1] = 0.6 + this.random() * 0.6;
        pf.size[i] = -(rear ? 0.55 + 0.6 * k : 0.35) * (0.8 + this.random() * 0.4);
      }
    }
    const air = Math.pow(0.25, dt);
    for (let i = 0; i < PUFFS; i++) {
      if (pf.life[i * 2] >= pf.life[i * 2 + 1]) continue;
      pf.life[i * 2] += dt;
      for (let a = 0; a < 3; a++) {
        pf.vel[i * 3 + a] *= air;
        pf.pos[i * 3 + a] += pf.vel[i * 3 + a] * dt;
      }
    }
    for (const n of ["iPos", "iVel", "iLife"]) (this.sparkGeo.getAttribute(n) as THREE.InstancedBufferAttribute).needsUpdate = true;
    for (const n of ["iPos", "iLife", "iSize"]) (this.puffGeo.getAttribute(n) as THREE.InstancedBufferAttribute).needsUpdate = true;
  }

  dispose() {
    this.sparkGeo.dispose();
    this.puffGeo.dispose();
    this.sparkMat.dispose();
    this.puffMat.dispose();
  }
}

const HAZE_FRAG = /* glsl */ `
uniform vec2 uA;
uniform vec2 uB;
uniform float uRadius;
uniform float uStrength;
uniform float uTime;
uniform float uAspect;
float hz(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hz(i), hz(i + vec2(1.0, 0.0)), u.x), mix(hz(i + vec2(0.0, 1.0)), hz(i + vec2(1.0, 1.0)), u.x), u.y);
}
void mainUv(inout vec2 uv) {
  if (uStrength <= 0.0) return;
  vec2 p = vec2(uv.x * uAspect, uv.y);
  vec2 a = vec2(uA.x * uAspect, uA.y);
  vec2 b = vec2(uB.x * uAspect, uB.y);
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  float d = length(p - a - ab * t);
  // strongest just behind the exhaust, thinning out behind
  float w = smoothstep(uRadius * (0.5 + 0.8 * t), 0.0, d) * (1.0 - 0.6 * t);
  if (w <= 0.0) return;
  // the hot air rises and wobbles
  vec2 q = p / max(uRadius, 1e-4) * 6.0;
  vec2 o = vec2(vn(q * 1.7 + vec2(0.0, -uTime * 3.0)) - 0.5, vn(q * 1.9 + vec2(4.1, -uTime * 3.6)) - 0.5);
  uv += o * w * uStrength * uRadius * 0.055;
}`;

/** The exhaust's heat shimmer: a patch of the screen behind the car whose image wobbles. */
export class HeatHazeEffect extends Effect {
  constructor() {
    super("HeatHazeEffect", HAZE_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["uA", new THREE.Uniform(new THREE.Vector2())],
        ["uB", new THREE.Uniform(new THREE.Vector2())],
        ["uRadius", new THREE.Uniform(0)],
        ["uStrength", new THREE.Uniform(0)],
        ["uTime", new THREE.Uniform(0)],
        ["uAspect", new THREE.Uniform(1)],
      ]),
    });
  }

  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();

  /** Put the shimmer behind the car's exhaust as this camera sees it; `strength` 0 turns it off. */
  place(car: THREE.Object3D, camera: THREE.PerspectiveCamera, strength: number, time: number) {
    const u = this.uniforms;
    (u.get("uTime") as THREE.Uniform).value = time;
    (u.get("uAspect") as THREE.Uniform).value = camera.aspect;
    // the exhaust under the rear wing, and 2.5 m behind it
    this.a.set(0, 0.5, 2.35).applyMatrix4(car.matrixWorld);
    this.b.set(0, 0.65, 4.8).applyMatrix4(car.matrixWorld);
    const dist = this.a.distanceTo(camera.position);
    this.a.project(camera);
    this.b.project(camera);
    const behind = this.a.z > 1 || this.b.z > 1;
    (u.get("uA") as THREE.Uniform<THREE.Vector2>).value.set(this.a.x * 0.5 + 0.5, this.a.y * 0.5 + 0.5);
    (u.get("uB") as THREE.Uniform<THREE.Vector2>).value.set(this.b.x * 0.5 + 0.5, this.b.y * 0.5 + 0.5);
    // about 35 cm across at the car, as the camera sees it
    const radius = (0.35 / Math.max(0.5, dist)) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / 2;
    (u.get("uRadius") as THREE.Uniform).value = radius;
    (u.get("uStrength") as THREE.Uniform).value = behind || radius < 0.002 ? 0 : strength;
  }
}

const RAIN_VERT = /* glsl */ `
attribute vec3 iSeed;
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uBox;
uniform vec3 uFall;
uniform vec2 uRes;
uniform float uNear;
varying float vA;
void main() {
  // each drop falls through a box that moves with the camera, wrapping round, so the rain is everywhere
  vec3 o = fract(iSeed - (uCam + uFall * uTime) / uBox) - 0.5;
  vec3 top = uCam + o * uBox;
  vec3 bottom = top + normalize(uFall) * 0.55;
  vec4 a = viewMatrix * vec4(top, 1.0);
  vec4 b = viewMatrix * vec4(bottom, 1.0);
  vec4 ca = projectionMatrix * a;
  vec4 cb = projectionMatrix * b;
  vec4 p = mix(ca, cb, position.x);
  vec2 d = (cb.xy / cb.w - ca.xy / ca.w) * uRes;
  d = length(d) > 1e-4 ? normalize(d) : vec2(0.0, 1.0);
  // a pixel or so wide however long the lens
  p.xy += vec2(-d.y, d.x) * position.y * 1.1 / uRes * p.w;
  // none right at the lens (out of focus; further out on a long lens), fainter far off
  float z = -a.z;
  vA = smoothstep(uNear, uNear * 2.5, z) * (1.0 - smoothstep(uNear * 6.0, uNear * 9.0, z));
  gl_Position = p;
}`;

const RAIN_FRAG = /* glsl */ `
varying float vA;
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(0.82, 0.85, 0.9, vA * uOpacity);
}`;

/** Rain falling round the camera: thin streaks, a little slanted by the wind, drawn in one call. */
export class RainField {
  readonly mesh: THREE.Mesh;
  private readonly geo = new THREE.InstancedBufferGeometry();
  private readonly mat: THREE.ShaderMaterial;

  constructor(count: number) {
    this.geo.setAttribute("position", new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
    this.geo.setIndex([0, 1, 2, 0, 2, 3]);
    const seed = new Float32Array(count * 3);
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
    this.geo.setAttribute("iSeed", new THREE.InstancedBufferAttribute(seed, 3));
    this.geo.instanceCount = count;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uBox: { value: new THREE.Vector3(36, 18, 36) },
        uFall: { value: new THREE.Vector3(1.2, -9, 0.6) },
        uOpacity: { value: 0.32 },
        uRes: { value: new THREE.Vector2(1280, 720) },
        uNear: { value: 1.2 },
      },
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
  }

  update(camera: THREE.PerspectiveCamera, time: number, w: number, h: number) {
    this.mat.uniforms.uTime.value = time;
    (this.mat.uniforms.uRes.value as THREE.Vector2).set(w, h);
    // a long lens looks far down the track: its rain starts further out, and the box grows with it
    const near = THREE.MathUtils.clamp(1.2 * (56 / camera.fov), 1.2, 14);
    this.mat.uniforms.uNear.value = near;
    (this.mat.uniforms.uBox.value as THREE.Vector3).set(near * 20, Math.max(18, near * 6), near * 20);
    (this.mat.uniforms.uCam.value as THREE.Vector3).copy(camera.position);
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}
