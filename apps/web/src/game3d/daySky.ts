import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

/**
 * A clear day's sky over a circuit: the sky's colour from the scattering of sunlight in the air (the Preetham model,
 * three.js's Sky: deep blue overhead, paler and hazier towards the horizon, brightest round the sun), a layer of
 * fair-weather cumulus drawn from noise high above that drifts slowly, and the same sky as the light the scene reflects.
 * The haze at ground level (the scene's fog) takes the horizon's colour, so far hills fade into the sky as through real
 * air. Everything here moves with the camera.
 */
export interface DaySky {
  group: THREE.Group;
  /** the sky as an environment map, for reflections and the soft light from all round */
  environment: THREE.Texture;
  /** the horizon's colour, for the fog */
  horizon: THREE.Color;
  update(camera: THREE.Camera, time: number): void;
  dispose(): void;
}

const CLOUD_VERT = /* glsl */ `
varying vec3 vWorld;
#include <common>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const CLOUD_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uCamera;
uniform vec3 uHorizon;
uniform float uCoverage;
uniform float uGrey;
varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}
void main() {
  vec2 p = vWorld.xz / 2600.0 + vec2(uTime * 0.0035, uTime * 0.0012);
  // the cloud's density: big cumulus shapes, their edges broken up finer
  float base = fbm(p);
  float detail = fbm(p * 4.0 + 3.7);
  float d = smoothstep(uCoverage, uCoverage + 0.22, base * 0.78 + detail * 0.3);
  if (d < 0.01) discard;
  // lit from the sun's side: bright tops, grey undersides, a silver edge where they're thin
  float thick = smoothstep(0.0, 1.0, d);
  float lit = 0.72 + 0.28 * clamp(dot(normalize(vec3(fbm(p + 0.05) - base, 0.35, fbm(p + vec2(0.0, 0.05)) - base)), uSunDir), 0.0, 1.0);
  vec3 col = mix(vec3(0.97, 0.97, 0.96), vec3(0.7, 0.72, 0.74), thick * 0.55) * lit;
  // rain clouds: a low, dark grey lid, darker where it's thick
  col = mix(col, mix(vec3(0.62, 0.64, 0.67), vec3(0.36, 0.38, 0.41), thick) * (0.9 + 0.1 * lit), uGrey);
  // far clouds sink into the haze at the horizon
  vec3 dir = normalize(vWorld - uCamera);
  float fade = smoothstep(0.02, 0.22, dir.y);
  // towards the sun the thin clouds shine (light scattered forward through them) instead of standing dark on the glare
  float toSun = max(dot(dir, normalize(uSunDir)), 0.0);
  col += vec3(1.0, 0.95, 0.85) * (pow(toSun, 6.0) * 1.6 + pow(toSun, 40.0) * 3.0) * (1.0 - thick * 0.7) * (1.0 - uGrey);
  gl_FragColor = vec4(mix(uHorizon, col, fade), d * fade * 0.92);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function buildDaySky(renderer: THREE.WebGLRenderer, sunDir: THREE.Vector3, opts: { coverage?: number; overcast?: boolean; horizon?: string } = {}): DaySky {
  const grey = !!opts.overcast;
  const group = new THREE.Group();
  const sky = new Sky();
  sky.scale.setScalar(15000);
  const u = sky.material.uniforms;
  // a clear, slightly hazy summer day in the Ardennes
  // or a wet one: a thick grey sky, the sun only a brighter patch in it
  u.turbidity.value = grey ? 14 : 3.2;
  u.rayleigh.value = grey ? 0.25 : 1.15;
  u.mieCoefficient.value = grey ? 0.03 : 0.004;
  u.mieDirectionalG.value = grey ? 0.6 : 0.82;
  u.sunPosition.value.copy(sunDir).multiplyScalar(1000);
  group.add(sky);

  // the cloud layer: a wide plane 1.8 km up
  const cloudMat = new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERT,
    fragmentShader: CLOUD_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: sunDir.clone().normalize() },
      uCamera: { value: new THREE.Vector3() },
      uHorizon: { value: new THREE.Color() },
      uCoverage: { value: opts.coverage ?? (grey ? 0.12 : 0.5) },
      uGrey: { value: grey ? 1 : 0 },
    },
  });
  const cloudGeo = new THREE.PlaneGeometry(40000, 40000, 1, 1).rotateX(-Math.PI / 2);
  const clouds = new THREE.Mesh(cloudGeo, cloudMat);
  clouds.position.y = 1800;
  clouds.frustumCulled = false;
  clouds.renderOrder = -1;
  group.add(clouds);

  // the environment: the sky (with its sun) and a dark green ground below, prefiltered for reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(1000);
  for (const k of ["turbidity", "rayleigh", "mieCoefficient", "mieDirectionalG"] as const) envSky.material.uniforms[k].value = u[k].value;
  envSky.material.uniforms.sunPosition.value.copy(u.sunPosition.value);
  envScene.add(envSky);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 32), new THREE.MeshBasicMaterial({ color: grey ? "#33392f" : "#3f4a33" }));
  // under the rain clouds the light comes from all round, grey
  const lid = grey ? new THREE.Mesh(new THREE.SphereGeometry(60, 24, 12), new THREE.MeshBasicMaterial({ color: "#7a8086", side: THREE.BackSide })) : null;
  if (lid) envScene.add(lid);
  // the sun's disc in the sky is thousands of times brighter than the sky, and every glossy surface turned to a mirror of
  // it (a car seen against a low sun went white): in the reflections it's a bright patch, the sunlight itself comes from
  // the scene's sun
  const disc = grey ? null : new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.0, 2.7) }));
  if (disc) {
    disc.position.copy(sunDir).normalize().multiplyScalar(50);
    disc.lookAt(0, 0, 0);
    envScene.add(disc);
  }
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -5;
  envScene.add(ground);
  const env = pmrem.fromScene(envScene, 0.02);
  pmrem.dispose();
  envSky.geometry.dispose();
  envSky.material.dispose();
  ground.geometry.dispose();
  lid?.geometry.dispose();
  disc?.geometry.dispose();
  (disc?.material as THREE.Material | undefined)?.dispose();
  (lid?.material as THREE.Material | undefined)?.dispose();
  (ground.material as THREE.Material).dispose();

  // the horizon's colour, as the sky draws it a little above the horizon away from the sun
  const horizon = new THREE.Color(grey ? "#9aa1a7" : (opts.horizon ?? "#c3d0dc"));
  cloudMat.uniforms.uHorizon.value.copy(horizon);

  return {
    group,
    environment: env.texture,
    horizon,
    update(camera, time) {
      group.position.set(camera.position.x, 0, camera.position.z);
      sky.position.set(0, camera.position.y, 0);
      cloudMat.uniforms.uTime.value = time;
      (cloudMat.uniforms.uCamera.value as THREE.Vector3).copy(camera.position);
    },
    dispose() {
      sky.geometry.dispose();
      sky.material.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      env.dispose();
    },
  };
}
