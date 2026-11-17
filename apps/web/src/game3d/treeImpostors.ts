import * as THREE from "three";
import { loadPicture } from "./textures";
import meta from "./assets/impostors/trees.json";
import firA from "./assets/impostors/fir-a.webp?url";
import firB from "./assets/impostors/fir-b.webp?url";
import broadA from "./assets/impostors/broad-a.webp?url";
import { FLORA_BY_TRACK } from "../game/trees";

/**
 * Trees from real scanned models: "Fir Tree 01" and "Tree Small 02" from Poly Haven (CC0; photography Rob Tuytel,
 * modelling Rico Cilliers), baked by dev/bake-trees.html into impostor atlases: each tree lit as the circuit lights
 * it and photographed from 12 x 12 directions over the upper hemisphere. Here each tree is a single quad turned to
 * the camera; its fragment shader finds where the camera stands on the hemi-octahedral grid, takes the four nearest
 * photographs, projects the quad's point into each of them and blends them by how near they are. From any side and
 * any height the tree looks like the scanned model, for two triangles.
 */
export type TreeKind = "fir-a" | "fir-b" | "broad-a";
const URLS: Record<TreeKind, string> = { "fir-a": firA, "fir-b": firB, "broad-a": broadA };
type Meta = { frames: number; height: number; centreY: number; radius: number };
const META = meta as Record<string, Meta>;

export interface TreeInstance {
  kind: TreeKind;
  /** the foot of the trunk (three's world coordinates) */
  x: number;
  y: number;
  z: number;
  /** the tree's height (m) */
  height: number;
  /** 0..1, for a little variety in tone */
  tint: number;
}

export async function loadTreeAtlases(trackId: string): Promise<Partial<Record<TreeKind, THREE.Texture>>> {
  // Tropical circuits have broadleaf and palm trees, both drawn by broad-a.
  // Fetching fir atlases there wasted two large GPU textures without drawing a tree.
  const kinds: TreeKind[] = FLORA_BY_TRACK[trackId] === "tropical" ? ["broad-a"] : ["fir-a", "fir-b", "broad-a"];
  const out: Partial<Record<TreeKind, THREE.Texture>> = {};
  await Promise.all(
    kinds.map(async (k) => {
      const t = await loadPicture(URLS[k]);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      out[k] = t;
    }),
  );
  return out;
}

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec3 iPos;
attribute float iScale;
attribute float iTint;
uniform float uCentreY;
uniform float uRadius;
varying vec3 vWorld;
varying vec3 vCentre;
varying float vR;
varying vec3 vDir;
varying float vTint;
void main() {
  vec3 centre = iPos + vec3(0.0, uCentreY * iScale, 0.0);
  float r = uRadius * iScale;
  vec3 d = cameraPosition - centre;
  d.y = max(d.y, 0.0);
  d = normalize(d + vec3(0.0, 1e-4, 0.0));
  vec3 fwd = -d;
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)) + vec3(1e-5, 0.0, 0.0));
  vec3 up = cross(right, fwd);
  vec3 world = centre + (position.x * right + position.y * up) * r;
  vWorld = world;
  vCentre = centre;
  vR = r;
  vDir = d;
  vTint = iTint;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uMap;
uniform float uFrames;
varying vec3 vWorld;
varying vec3 vCentre;
varying float vR;
varying vec3 vDir;
varying float vTint;

vec3 hemiOctDir(vec2 uv) {
  float x = uv.x * 2.0 - 1.0;
  float z = uv.y * 2.0 - 1.0;
  float px = (x + z) * 0.5;
  float pz = (x - z) * 0.5;
  return normalize(vec3(px, 1.0 - abs(px) - abs(pz), pz));
}
vec2 hemiOctUV(vec3 d) {
  vec2 p = d.xz / (abs(d.x) + abs(d.y) + abs(d.z));
  return vec2(p.x + p.y, p.x - p.y) * 0.5 + 0.5;
}
vec4 frameSample(vec2 cell) {
  vec3 d = hemiOctDir(cell / (uFrames - 1.0));
  vec3 fwd = -d;
  vec3 up0 = abs(d.y) > 0.999 ? vec3(0.0, 0.0, -1.0) : vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(fwd, up0));
  vec3 up = cross(right, fwd);
  vec3 rel = vWorld - vCentre;
  vec2 local = vec2(dot(rel, right), dot(rel, up)) / vR * 0.5 + 0.5;
  if (local.x < 0.0 || local.x > 1.0 || local.y < 0.0 || local.y > 1.0) return vec4(0.0);
  vec2 atlas = vec2((cell.x + local.x) / uFrames, 1.0 - (cell.y + 1.0 - local.y) / uFrames);
  vec4 s = texture2D(uMap, atlas);
  // premultiplied, so blending a frame's edge with an empty neighbour keeps the colour
  return vec4(s.rgb * s.a, s.a);
}
void main() {
  vec2 g = clamp(hemiOctUV(vDir), 0.0, 1.0) * (uFrames - 1.0);
  vec2 c0 = floor(g);
  vec2 c1 = min(c0 + 1.0, vec2(uFrames - 1.0));
  vec2 f = g - c0;
  vec4 a = frameSample(c0);
  vec4 b = frameSample(vec2(c1.x, c0.y));
  vec4 c = frameSample(vec2(c0.x, c1.y));
  vec4 e = frameSample(c1);
  vec4 col = mix(mix(a, b, f.x), mix(c, e, f.x), f.y);
  if (col.a < 0.42) discard;
  // back to straight colour; a little variety from tree to tree
  vec3 rgb = col.rgb / max(col.a, 1e-3) * (0.9 + vTint * 0.2);
  gl_FragColor = vec4(rgb, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/** One instanced mesh per kind of tree: a quad each, turned to the camera in the shader. */
export function buildTreeImpostors(trees: TreeInstance[], atlases: Partial<Record<TreeKind, THREE.Texture>>): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  for (const kind of Object.keys(atlases) as TreeKind[]) {
    const mine = trees.filter((t) => t.kind === kind);
    if (!mine.length) continue;
    const m = META[kind];
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(2, 2);
    geo.index = quad.index;
    geo.setAttribute("position", quad.getAttribute("position"));
    const pos = new Float32Array(mine.length * 3);
    const scale = new Float32Array(mine.length);
    const tint = new Float32Array(mine.length);
    mine.forEach((t, k) => {
      pos.set([t.x, t.y, t.z], k * 3);
      scale[k] = t.height / m.height;
      tint[k] = t.tint;
    });
    geo.setAttribute("iPos", new THREE.InstancedBufferAttribute(pos, 3));
    geo.setAttribute("iScale", new THREE.InstancedBufferAttribute(scale, 1));
    geo.setAttribute("iTint", new THREE.InstancedBufferAttribute(tint, 1));
    geo.instanceCount = mine.length;
    // the bounds of the whole forest, for culling
    geo.boundingSphere = new THREE.Sphere();
    const box = new THREE.Box3();
    for (const t of mine) box.expandByPoint(new THREE.Vector3(t.x, t.y, t.z));
    box.expandByScalar(m.radius * 3);
    box.getBoundingSphere(geo.boundingSphere);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uFrames: { value: m.frames }, uCentreY: { value: m.centreY }, uRadius: { value: m.radius } }]),
      fog: true,
      side: THREE.DoubleSide,
    });
    mat.uniforms.uMap.value = atlases[kind]!;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
    disposables.push(geo, quad, mat);
  }
  return {
    group,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
