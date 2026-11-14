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
export type RearLights = "off" | "on" | "harvest" | "clip";
/** degrees at the steering wheel per degree at the front wheels */
export const STEER_RATIO = 12;

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
  const rearLamps: THREE.MeshBasicMaterial[] = [];
  const disposables: { dispose(): void }[] = [];
  /**
   * What the rear lights do, as on a 2026 car: "off"; "on", steady (on intermediate or wet tyres); "harvest", flashing
   * while the car recovers energy (braking, lifting off); "clip", flashing fast (super clipping: recharging at full
   * throttle at the end of a long straight).
   */
  let lightMode: RearLights = "off";
  const rearGlows: THREE.SpriteMaterial[] = [];
  let rearGlowTexture: THREE.Texture | null = null;
  const tyreBand = { value: new THREE.Color(look.tyreBand ?? DEFAULT_LOOK.tyreBand) };
  /** how far (rad) the wheels turn in one frame, for blurring the sidewall's lettering round the tyre */
  const spinBlur = { value: 0 };

  /** the lights' brightness now: 0 dark lens, 1 lit */
  const applyLights = (level: number) => {
    if (rainLight) (rainLight as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + 3 * level;
    for (const lamp of rearLamps) lamp.color.setRGB(0.25 + 3.2 * level, 0.02 + 0.25 * level, 0.01 + 0.12 * level);
    for (const glow of rearGlows) glow.opacity = 0.7 * level;
  };

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
      // the model's tyre has its sidewalls curved in towards the rim, so from behind the tread and the sidewall read as
      // two separate pieces: it's replaced by a clean, perfectly round tyre of the same size (its extent about the hub)
      const rel = new THREE.Matrix4().copy(o.parent!.matrixWorld).invert().multiply(o.matrixWorld);
      const box = new THREE.Box3().setFromBufferAttribute(o.geometry.getAttribute("position") as THREE.BufferAttribute).applyMatrix4(rel);
      const radius = Math.max(box.max.y, -box.min.y, box.max.z, -box.min.z);
      geos.add(o.geometry);
      o.geometry = tyreGeometry(radius, box.min.x, box.max.x);
      geos.add(o.geometry);
      o.position.set(0, 0, 0);
      o.quaternion.identity();
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      const hub = new THREE.Matrix4();
      const m = (o.material as THREE.MeshStandardMaterial).clone();
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uHub = { value: hub };
        sh.uniforms.uBand = tyreBand;
        sh.uniforms.uSpin = spinBlur;
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nuniform mat4 uHub;\nvarying vec3 vHubPos;\nvarying vec3 vHubNrm;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHubPos = (uHub * vec4(position, 1.0)).xyz;\nvHubNrm = mat3(uHub) * normal;");
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", `#include <common>
uniform vec3 uBand;
uniform float uSpin;
varying vec3 vHubPos;
varying vec3 vHubNrm;
// Two bright, broken-up sidewall labels, large enough to read as the tyre spins past the camera.
float lettering(float a, float r) {
  float ring = smoothstep(0.26, 0.267, r) * (1.0 - smoothstep(0.296, 0.304, r));
  float ph = mod(a + 3.14159265, 6.2831853);
  float labels = step(0.22, ph) * step(ph, 1.18) + step(3.55, ph) * step(ph, 4.26);
  float gaps = step(0.19, fract(ph * 17.0));
  return ring * min(labels, 1.0) * gaps;
}
`)
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
            float r = length(vHubPos.yz);
            float side = smoothstep(0.55, 0.75, abs(normalize(vHubNrm).x));
            float aa = fwidth(r);
            float band = smoothstep(0.296 - aa, 0.296 + aa, r) * (1.0 - smoothstep(0.312 - aa, 0.312 + aa, r));
            diffuseColor.rgb = mix(diffuseColor.rgb, uBand, band * side);
            // the lettering, smeared round the tyre by how far it turns in a frame (as a camera's shutter sees it)
            float ang = atan(vHubPos.z, vHubPos.y);
            float lt = 0.0;
            for (int k = 0; k < 10; k++) lt += lettering(ang + uSpin * (float(k) / 9.0 - 0.5), r);
            float sideFace = smoothstep(0.72, 0.9, abs(normalize(vHubNrm).x));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9), (lt / 10.0) * sideFace * 0.92);
`,
          );
      };
      m.customProgramCacheKey = () => "lapdle-tyre-band";
      mats.add(m);
      o.material = m;
    }
    // The 2026 rear lights: the central light under the rear crash structure and an LED strip down the trailing edge of
    // each rear wing endplate, which mirrors it (Formula 1's technical regulations; formula1.com, "What do the new
    // lights on F1 cars mean"). Each is a panel of LEDs fixed to the car with a soft halo turned to the camera.
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 64;
    const ctx = glowCanvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,80,55,0.95)");
    gradient.addColorStop(0.2, "rgba(255,30,20,0.6)");
    gradient.addColorStop(1, "rgba(255,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    rearGlowTexture = glowTexture;
    // the LEDs: a grid of round dots behind the lens
    const ledCanvas = document.createElement("canvas");
    ledCanvas.width = ledCanvas.height = 32;
    const lc = ledCanvas.getContext("2d")!;
    lc.fillStyle = "#3a0000";
    lc.fillRect(0, 0, 32, 32);
    lc.fillStyle = "#ffffff";
    for (let yy = 4; yy < 32; yy += 8) for (let xx = 4; xx < 32; xx += 8) { lc.beginPath(); lc.arc(xx, yy, 3, 0, Math.PI * 2); lc.fill(); }
    const ledTexture = new THREE.CanvasTexture(ledCanvas);
    ledTexture.wrapS = ledTexture.wrapT = THREE.RepeatWrapping;
    ledTexture.colorSpace = THREE.SRGBColorSpace;
    for (const [x, y, z, width, height, halo] of [
      // central: under the crash structure, 10 cm by 5.5 cm
      [0, 0.275, 2.452, 0.1, 0.055, 4.5],
      // endplates: 2 cm wide, 26 cm tall, down each trailing edge
      [-0.548, 0.68, 2.452, 0.022, 0.26, 2.2],
      [0.548, 0.68, 2.452, 0.022, 0.26, 2.2],
    ]) {
      const tex = ledTexture.clone();
      tex.repeat.set(Math.max(1, Math.round(width / 0.012)) / 4, Math.max(1, Math.round(height / 0.012)) / 4);
      const ledMat = new THREE.MeshBasicMaterial({ map: tex, color: "#ff1a10", toneMapped: false, side: THREE.DoubleSide });
      const led = new THREE.Mesh(new THREE.PlaneGeometry(width, height), ledMat);
      led.position.set(x, y, z);
      car.add(led);
      geos.add(led.geometry);
      mats.add(ledMat);
      disposables.push(tex);
      rearLamps.push(ledMat);
      const glowMat = new THREE.SpriteMaterial({ map: glowTexture, color: "#ff3b23", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
      const glow = new THREE.Sprite(glowMat);
      glow.position.set(x, y, z + 0.03);
      glow.scale.set(Math.max(width, height * 0.35) * halo, height * halo * 0.9, 1);
      car.add(glow);
      mats.add(glowMat);
      rearGlows.push(glowMat);
    }
    applyLights(0);
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
    /**
     * Steer: the front wheels turn about their kingpins by `rad` (positive to the left), as much as 14 degrees
     * normally (about 20 at Monaco), and the steering wheel turns 12 times as far (about 180 degrees in a hairpin).
     */
    setSteer(rad: number) {
      const d = Math.max(-0.35, Math.min(0.35, rad));
      for (const w of front) w.rotation.y = d;
      if (steer) (steer as THREE.Object3D).rotation.z = d * STEER_RATIO;
    },
    /** set what the rear lights do (see RearLights) */
    setRearLights(mode: RearLights) {
      lightMode = mode;
    },
    /** advance the lights' flashing to time t (s) */
    updateLights(t: number) {
      const level = lightMode === "on" ? 1 : lightMode === "harvest" ? (t * 4) % 1 < 0.5 ? 1 : 0 : lightMode === "clip" ? (t * 10) % 1 < 0.5 ? 1 : 0 : 0;
      applyLights(level);
    },
    /** older name: braking lights the rear (flashing, as harvesting) */
    setBraking(on: number) {
      lightMode = on > 0.5 ? "harvest" : "off";
    },
    /** how far the wheels turn in this frame (rad): blurs the sidewall's lettering by as much */
    setSpinBlur(rad: number) {
      spinBlur.value = rad;
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
      rearGlowTexture?.dispose();
      bodyMat.dispose();
      for (const d of disposables) d.dispose();
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

/**
 * A racing slick about the x axis: the tread at full radius across most of the width, rounded shoulders, sidewalls
 * straight down to the rim. x0..x1 is its width (hub frame), the rim's radius about 70% of the tyre's.
 */
function tyreGeometry(radius: number, x0: number, x1: number): THREE.BufferGeometry {
  const rim = radius * 0.71;
  const width = x1 - x0;
  const sh = Math.min(0.06, width * 0.16);
  const pts: THREE.Vector2[] = [];
  // the inner sidewall from the rim out, the inner shoulder, the tread, the outer shoulder, the outer sidewall in
  // (Vector2: x = radius, y = along the axle)
  const side = (from: number, to: number, at: number) => {
    for (let k = 0; k <= 6; k++) pts.push(new THREE.Vector2(from + ((to - from) * k) / 6, at));
  };
  // a quarter circle about (cr radius, ca along the axle), angle 0 pointing out radially, +90 degrees along +x
  const shoulder = (cr: number, ca: number, a0: number, a1: number) => {
    for (let k = 0; k <= 10; k++) {
      const a = a0 + ((a1 - a0) * k) / 10;
      pts.push(new THREE.Vector2(cr + Math.cos(a) * sh, ca + Math.sin(a) * sh));
    }
  };
  side(rim, radius - sh, x0);
  shoulder(radius - sh, x0 + sh, -Math.PI / 2, 0);
  for (let k = 1; k < 12; k++) pts.push(new THREE.Vector2(radius, x0 + sh + ((width - 2 * sh) * k) / 12));
  shoulder(radius - sh, x1 - sh, 0, Math.PI / 2);
  side(radius - sh, rim, x1);
  const g = new THREE.LatheGeometry(pts, 128);
  // the lathe turns about y: lay it about x, the axle
  g.rotateZ(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
