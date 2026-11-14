import * as THREE from "three";
import { BlendFunction, Effect, EffectAttribute } from "postprocessing";

/**
 * Camera motion blur, as a camera's shutter sees a scene that moves past it: each pixel's point in the world (from the
 * depth buffer) is put where the camera saw it a frame ago, and the image is averaged along that path. The road and
 * the trees streak by as fast as the car goes; the car, which moves with the camera, stays sharp. `shutter` is the
 * share of a frame the shutter is open (0.5 is a film camera's 180 degrees).
 */
const FRAG = /* glsl */ `
uniform mat4 uInvViewProj;
uniform mat4 uPrevViewProj;
uniform float uShutter;
uniform float uReversed;
uniform float uMaxLen;
uniform mat4 uCarInv;
// where the car is on screen (uv min x, min y, max x, max y): only there is a point tested against its box
uniform vec4 uCarRect;
bool inRect(vec2 p) { return p.x > uCarRect.x && p.y > uCarRect.y && p.x < uCarRect.z && p.y < uCarRect.w; }
// a point of the car: inside its box (its own frame: x across, y up from the road, z along), above the road
bool onCar(vec3 w) {
  vec3 c = (uCarInv * vec4(w, 1.0)).xyz;
  return abs(c.x) < 1.06 && c.y > 0.035 && c.y < 1.15 && abs(c.z) < 2.95;
}
vec3 worldAt(vec2 p, float d) {
  // clip-space depth: a reversed buffer holds 1 near and 0 far in 0..1, a normal one 0..1 for -1..1
  float z = uReversed > 0.5 ? max(d, 1e-6) : min(d, 0.999999) * 2.0 - 1.0;
  vec4 w = uInvViewProj * vec4(p * 2.0 - 1.0, z, 1.0);
  return w.xyz / w.w;
}
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 world = vec4(worldAt(uv, depth), 1.0);
  // the car moves with the camera: it stays sharp, and isn't smeared into the road behind it
  if (inRect(uv) && onCar(world.xyz)) {
    outputColor = inputColor;
    return;
  }
  vec4 prev = uPrevViewProj * world;
  vec2 prevUv = prev.xy / prev.w * 0.5 + 0.5;
  vec2 vel = (uv - prevUv) * uShutter;
  float len = length(vel);
  if (len < 0.0008) {
    outputColor = inputColor;
    return;
  }
  if (len > uMaxLen) vel *= uMaxLen / len;
  vec4 acc = vec4(0.0);
  float n = 0.0;
  const int TAPS = 10;
  for (int i = 0; i < TAPS; i++) {
    float t = float(i) / float(TAPS - 1) - 0.5;
    vec2 q = uv - vel * t;
    if (inRect(q) && onCar(worldAt(q, readDepth(q)))) continue;
    acc += texture2D(inputBuffer, q);
    n += 1.0;
  }
  outputColor = n > 0.0 ? acc / n : inputColor;
}
`;

export class MotionBlurEffect extends Effect {
  private readonly prev = new THREE.Matrix4();
  private readonly cur = new THREE.Matrix4();
  private first = true;

  constructor(
    private readonly camera: THREE.Camera,
    opts: { shutter?: number; reversedDepth?: boolean } = {},
  ) {
    super("MotionBlurEffect", FRAG, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ["uInvViewProj", new THREE.Uniform(new THREE.Matrix4())],
        ["uPrevViewProj", new THREE.Uniform(new THREE.Matrix4())],
        ["uShutter", new THREE.Uniform(opts.shutter ?? 0.5)],
        ["uReversed", new THREE.Uniform(opts.reversedDepth ? 1 : 0)],
        ["uMaxLen", new THREE.Uniform(0.08)],
        ["uCarInv", new THREE.Uniform(new THREE.Matrix4().makeTranslation(0, 1e5, 0))],
        ["uCarRect", new THREE.Uniform(new THREE.Vector4(2, 2, -1, -1))],
      ]),
    });
  }

  set shutter(v: number) {
    (this.uniforms.get("uShutter") as THREE.Uniform).value = v;
  }

  /** The car (its world matrix), so it stays sharp: it moves with the camera, not with the world. */
  setCar(car: THREE.Object3D) {
    car.updateMatrixWorld();
    (this.uniforms.get("uCarInv") as THREE.Uniform<THREE.Matrix4>).value.copy(car.matrixWorld).invert();
    // the car's box corners on screen, padded a little
    this.camera.updateMatrixWorld();
    const r = (this.uniforms.get("uCarRect") as THREE.Uniform<THREE.Vector4>).value.set(2, 2, -1, -1);
    const p = new THREE.Vector3();
    for (const x of [-1.1, 1.1])
      for (const y of [0, 1.2])
        for (const z of [-3, 3]) {
          p.set(x, y, z).applyMatrix4(car.matrixWorld).project(this.camera);
          if (p.z > 1) continue;
          const u = p.x * 0.5 + 0.5;
          const v = p.y * 0.5 + 0.5;
          r.set(Math.min(r.x, u), Math.min(r.y, v), Math.max(r.z, u), Math.max(r.w, v));
        }
    r.x -= 0.02;
    r.y -= 0.02;
    r.z += 0.02;
    r.w += 0.02;
  }

  /** Forget the last frame (after the camera jumps, so nothing smears across the cut). */
  reset() {
    this.first = true;
  }

  override update(): void {
    this.cur.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    if (this.first) {
      this.prev.copy(this.cur);
      this.first = false;
    }
    (this.uniforms.get("uInvViewProj") as THREE.Uniform<THREE.Matrix4>).value.copy(this.cur).invert();
    (this.uniforms.get("uPrevViewProj") as THREE.Uniform<THREE.Matrix4>).value.copy(this.prev);
    this.prev.copy(this.cur);
  }
}
