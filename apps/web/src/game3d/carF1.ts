import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import fullUrl from "./car-f1.glb?url";
import liteUrl from "./car-f1-lite.glb?url";

/**
 * The 3D car of the games: "F1 2026 concept (polygon model)" by Qvist Designs, CC BY 4.0, with the steering wheel of
 * "AM26 - F1 25/F1 2026 DLC" by DeX, CC BY 4.0. Both are credited on the Legal page and under the games.
 * tools/track-builder/src/build-car-f1.ts builds the two files:
 * - car-f1.glb: every triangle of the source, for desktops;
 * - car-f1-lite.glb: a lighter body for phones.
 *
 * Frame: metres, nose along -z, ground at y = 0, the middle of the wheelbase at the origin. Wheels are about their hubs,
 * named wheel-FL/FR/RL/RR. The steering wheel is the node "steer".
 * Zone materials: paint (the player's colour), paint2 (the lower bodywork, wings and halo), accent, carbon,
 * interior, light (the rain light).
 */
export const CAR_F1_CREDIT = [
  {
    title: "F1 2026 concept (polygon model)",
    author: "Qvist Designs",
    url: "https://sketchfab.com/3d-models/f1-2026-concept-polygon-model-ea3bde709b1e4dc9b0ec8557d106ed42",
    license: "CC BY 4.0",
  },
  { title: "AM26 - F1 25/F1 2026 DLC (steering wheel)", author: "DeX", url: "https://skfb.ly/pKNCK", license: "CC BY 4.0" },
] as const;

export type CarDetail = "full" | "lite";

/** Full detail on a desktop-class device, the lighter body on phones and small or low-memory devices. */
export function carDetail(): CarDetail {
  if (typeof window === "undefined") return "lite";
  const q = new URLSearchParams(location.search).get("car");
  if (q === "full" || q === "lite") return q;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return coarse || (mem !== undefined && mem < 4) ? "lite" : "full";
}

export interface CarLook {
  /** the main colour of the bodywork */
  paint: string;
  /** the lower bodywork, wings and halo */
  paint2?: string;
  /** pinstripe, endplate tops, nose tip */
  accent?: string;
  /** the band on the tyres' sidewalls: the compound (yellow medium slicks, blue full wets) */
  tyreBand?: string;
}

export const DEFAULT_LOOK: Required<CarLook> = { paint: "#ff6a13", paint2: "#141518", accent: "#f2f2ee", tyreBand: "#f5c518" };

export function buildCarF1(detail: CarDetail = carDetail(), look: CarLook = DEFAULT_LOOK) {
  const car = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  /** the front wheels, which also steer */
  const front: THREE.Object3D[] = [];
  const mats = new Set<THREE.Material>();
  const geos = new Set<THREE.BufferGeometry>();
  let steer: THREE.Object3D | null = null;
  let rainLight: THREE.MeshStandardMaterial | null = null;
  let cameras: Record<string, [number, number, number]> = {};

  const uniforms = {
    uPaint: { value: new THREE.Color(look.paint ?? DEFAULT_LOOK.paint) },
    uPaint2: { value: new THREE.Color(look.paint2 ?? DEFAULT_LOOK.paint2) },
    uAccent: { value: new THREE.Color(look.accent ?? DEFAULT_LOOK.accent) },
    uCarbon: { value: new THREE.Color("#0d0e10") },
    uInterior: { value: new THREE.Color("#09090a") },
    uMid: { value: -0.1955 },
    uZone: { value: new THREE.Matrix4() },
  };
  // a glossy clear coat over a satin base, so the sky slides over the bodywork like on a real car; the zones are
  // drawn per pixel (ZONE_GLSL)
  const bodyMat = new THREE.MeshPhysicalMaterial({ name: "body", metalness: 0.05, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.8 });
  bodyMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform mat4 uZone;\nvarying vec3 vZonePos;\nvarying vec3 vZoneNrm;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvZonePos = (uZone * vec4(position, 1.0)).xyz;\nvZoneNrm = mat3(uZone) * normal;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${ZONE_GLSL}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec3 zp = vec3(-vZonePos.x, vZonePos.y, uMid - vZonePos.z);
        vec3 zn = normalize(vec3(-vZoneNrm.x, vZoneNrm.y, -vZoneNrm.z));
        int zone = carZone(zp, zn);
        diffuseColor.rgb = zone == 0 ? uPaint : zone == 1 ? uPaint2 : zone == 2 ? uAccent : zone == 3 ? uCarbon : uInterior;
        if (zone == 3) diffuseColor.rgb *= carbonWeave(zp, zn);`,
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nif (zone == 3) roughnessFactor = 0.32; else if (zone == 4) roughnessFactor = 0.95;")
      .replace("#include <lights_physical_fragment>", "#include <lights_physical_fragment>\nif (zone == 4) material.clearcoat = 0.0; else if (zone == 3) material.clearcoat = 0.7;");
  };
  bodyMat.customProgramCacheKey = () => "lapdle-car-zones";
  const bodyMeshes: THREE.Mesh[] = [];
  const tyreMeshes: THREE.Mesh[] = [];
  const tyreBand = { value: new THREE.Color(look.tyreBand ?? DEFAULT_LOOK.tyreBand) };

  let disposed = false;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const ready = loader.loadAsync(detail === "full" ? fullUrl : liteUrl).then((gltf) => {
    if (disposed) return;
    const root = gltf.scene.getObjectByName("car") ?? gltf.scene;
    cameras = (root.userData.cameras as typeof cameras) ?? {};
    gltf.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        geos.add(o.geometry);
        let m = o.material as THREE.MeshStandardMaterial;
        const name = m.name;
        if (name === "body") {
          m.dispose();
          o.material = m = bodyMat;
          bodyMeshes.push(o);
        } else if (name === "light") {
          m.emissiveIntensity = 0.4;
          rainLight = m;
        } else if (name === "tyre") {
          tyreMeshes.push(o);
        } else if (name === "rim") {
          m.envMapIntensity = 0.9;
        } else if (name === "mirror") {
          m.envMapIntensity = 1;
        }
        mats.add(m);
        o.castShadow = true;
        o.receiveShadow = true;
      }
      if (o.name.startsWith("wheel-")) {
        wheels.push(o);
        if (o.name.startsWith("wheel-F")) front.push(o);
        // roll about the hub, then steer about the vertical: steering is the outer turn
        o.rotation.order = "YXZ";
      }
      if (o.name === "steer") steer = o;
    });
    if (typeof root.userData.rigMid === "number") uniforms.uMid.value = root.userData.rigMid;
    car.add(gltf.scene);
    // the zones are drawn in the car's own frame: the body mesh's place in the car (the compressed file scales and
    // shifts each mesh)
    car.updateMatrixWorld(true);
    const inv = car.matrixWorld.clone().invert();
    if (bodyMeshes[0]) uniforms.uZone.value.multiplyMatrices(inv, bodyMeshes[0].matrixWorld);
    // each tyre gets the compound's coloured band on its sidewalls, drawn in the frame of its own hub
    for (const o of tyreMeshes) {
      const hub = new THREE.Matrix4().copy(o.parent!.matrixWorld).invert().multiply(o.matrixWorld);
      const m = (o.material as THREE.MeshStandardMaterial).clone();
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uHub = { value: hub };
        sh.uniforms.uBand = tyreBand;
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nuniform mat4 uHub;\nvarying vec3 vHubPos;\nvarying vec3 vHubNrm;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHubPos = (uHub * vec4(position, 1.0)).xyz;\nvHubNrm = mat3(uHub) * normal;");
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform vec3 uBand;\nvarying vec3 vHubPos;\nvarying vec3 vHubNrm;")
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
            float r = length(vHubPos.yz);
            float side = smoothstep(0.55, 0.75, abs(normalize(vHubNrm).x));
            float aa = fwidth(r);
            float band = smoothstep(0.296 - aa, 0.296 + aa, r) * (1.0 - smoothstep(0.312 - aa, 0.312 + aa, r));
            diffuseColor.rgb = mix(diffuseColor.rgb, uBand, band * side);`,
          );
      };
      m.customProgramCacheKey = () => "lapdle-tyre-band";
      mats.add(m);
      o.material = m;
    }
  });

  return {
    car,
    wheels,
    front,
    detail,
    /** resolves once the model is in */
    ready,
    /** the steering wheel (turns about its own column), once loaded */
    get steer() {
      return steer;
    },
    /** cockpit camera positions in the car's frame, once loaded */
    get cameras() {
      return cameras;
    },
    /** the rain light glows while braking (0..1) */
    setBraking(on: number) {
      if (rainLight) (rainLight as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + 3.6 * on;
    },
    /** repaint the car */
    setLook(next: CarLook) {
      if (next.paint) uniforms.uPaint.value.set(next.paint);
      if (next.paint2) uniforms.uPaint2.value.set(next.paint2);
      if (next.accent) uniforms.uAccent.value.set(next.accent);
      if (next.tyreBand) tyreBand.value.set(next.tyreBand);
    },
    dispose() {
      disposed = true;
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      bodyMat.dispose();
    },
  };
}

/**
 * The paint zones, per pixel, in the "rig" frame (metres, +X left, +Y up, +Z forward, front axle at z 1.5045, rear at
 * -1.8955). 0 paint, 1 paint2, 2 accent, 3 carbon, 4 the cockpit's inside. The heights and boxes follow LibreCorsa's
 * scripts/cars/port_qvist_f1.mjs (MIT, the LibreCorsa contributors).
 */
const ZONE_GLSL = /* glsl */ `
varying vec3 vZonePos;
varying vec3 vZoneNrm;
uniform vec3 uPaint;
uniform vec3 uPaint2;
uniform vec3 uAccent;
uniform vec3 uCarbon;
uniform vec3 uInterior;
uniform float uMid;
float zoneSplitY(float z) { return 0.33 + 0.06 * clamp((0.6 - z) / 2.2, 0.0, 1.0); }
int carZone(vec3 p, vec3 n) {
  float x = p.x, y = p.y, z = p.z, ax = abs(x);
  if (y < 0.105) return 3;
  if (z < -1.85 && y < 0.36 && ax < 0.62) return 3;
  if (n.y < -0.55 && y < 0.5 && z < 1.7) return 3;
  if (z > 1.6 && ax > 0.6 && y < 0.45) return y > 0.39 ? 2 : 1;
  if (z > 1.68 && y < 0.345) return (ax < 0.15 && y > 0.2) ? 0 : 1;
  if (abs(z - 1.5045) < 0.36 && ax > 0.17 && y < 0.68) return 3;
  if (abs(z + 1.8955) < 0.36 && ax > 0.2 && y < 0.62 && y > 0.12) return 3;
  if (z < -1.95 && y > 0.36) {
    if (ax > 0.5) return y > 0.86 ? 2 : 0;
    if (y > 0.74) return 1;
  }
  if (ax < 0.26 && z > -0.22 && z < 0.56 && y < 0.655 && y > 0.2) return 4;
  if (y > 0.7 && z > -0.08 && z < 0.66 && ax < 0.32) return 1;
  if (z > 2.5) return 2;
  if (z > 1.25) return 0;
  float s = zoneSplitY(z);
  if (y > s + 0.022) return 0;
  if (y > s && ax > 0.1) return 2;
  return y > s ? 0 : 1;
}
// a 2x2 twill weave, about 8 mm a tow, projected along the surface's main axis
float carbonWeave(vec3 p, vec3 n) {
  vec3 a = abs(n);
  vec2 uv = a.y > a.x && a.y > a.z ? p.xz : a.x > a.z ? p.zy : p.xy;
  vec2 c = floor(uv / 0.008);
  float tw = mod(c.x + c.y, 4.0) < 2.0 ? 1.0 : 0.0;
  vec2 f = fract(uv / 0.008);
  float along = tw > 0.5 ? f.x : f.y;
  return 0.8 + 0.4 * (0.5 + 0.5 * sin(along * 3.14159)) * (0.6 + 0.4 * tw);
}
`;
