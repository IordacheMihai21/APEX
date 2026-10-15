import * as THREE from "three";

/**
 * Soft particles for the corner: dust and gravel thrown up when the car runs off the road, spray behind the wheels in
 * the wet. One pool of points drawn in one call; each particle has its own colour, size, life and fade. Positions are
 * three's world (metres, y up).
 */
// the scene uses a logarithmic depth buffer: the shaders write depth the same way, or every particle fails the depth test
const VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float size;
attribute float alpha;
attribute vec3 tint;
varying float vAlpha;
varying vec3 vTint;
uniform float scale;
void main() {
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // a particle right in front of the lens would fill the screen: fade it out as it gets within a few metres
  vAlpha = alpha * smoothstep(1.5, 4.5, -mv.z);
  gl_PointSize = size * scale / -mv.z;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
const FRAG = `
#include <logdepthbuf_pars_fragment>
varying float vAlpha;
varying vec3 vTint;
void main() {
  #include <logdepthbuf_fragment>
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d) * 4.0;
  if (r > 1.0) discard;
  gl_FragColor = vec4(vTint, vAlpha * (1.0 - r) * (1.0 - r));
}`;

export class Particles {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly tint: Float32Array;
  private readonly life: Float32Array;
  private readonly age: Float32Array;
  private readonly grow: Float32Array;
  private readonly opacity0: Float32Array;
  private next = 0;
  private readonly material: THREE.ShaderMaterial;

  constructor(private readonly max = 600) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.tint = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max).fill(1e9);
    this.grow = new Float32Array(max);
    this.opacity0 = new Float32Array(max);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("size", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("alpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("tint", new THREE.BufferAttribute(this.tint, 3).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { scale: { value: 600 } }, transparent: true, depthWrite: false });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
  }

  /** How big a 1 m particle looks: depends on the screen height and the field of view. */
  setScale(heightPx: number, fovDeg: number) {
    this.material.uniforms.scale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  /** One particle at p with velocity v (m/s), size (m) growing by `grow` per second, living `life` s. */
  emit(p: THREE.Vector3, v: THREE.Vector3, size: number, grow: number, life: number, colour: THREE.Color, opacity: number) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.tint.set([colour.r, colour.g, colour.b], i * 3);
    this.size[i] = size;
    this.grow[i] = grow;
    this.life[i] = life;
    this.age[i] = 0;
    this.alpha[i] = opacity;
    this.opacity0[i] = opacity;
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= this.life[i]) {
        this.alpha[i] = 0;
        continue;
      }
      this.age[i] += dt;
      const k = i * 3;
      // air drag, a little gravity for the heavy bits
      this.vel[k] *= 1 - 1.6 * dt;
      this.vel[k + 2] *= 1 - 1.6 * dt;
      this.vel[k + 1] = this.vel[k + 1] * (1 - 1.2 * dt) - 2.5 * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] = Math.max(0.05, this.pos[k + 1] + this.vel[k + 1] * dt);
      this.pos[k + 2] += this.vel[k + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      const f = this.age[i] / this.life[i];
      this.alpha[i] = this.opacity0[i] * (1 - f) * Math.min(1, this.age[i] * 12);
    }
    const g = this.points.geometry;
    for (const name of ["position", "size", "alpha", "tint"]) g.getAttribute(name).needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
