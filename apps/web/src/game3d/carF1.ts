import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
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
  let lcd: THREE.Mesh | null = null;
  const revMats = new Set<THREE.MeshStandardMaterial>();
  let rainLight: THREE.MeshStandardMaterial | null = null;
  let cameras: Record<string, [number, number, number]> = {};

  const uniforms = {
    uPaint: { value: new THREE.Color(look.paint ?? DEFAULT_LOOK.paint) },
    uPaint2: { value: new THREE.Color(look.paint2 ?? DEFAULT_LOOK.paint2) },
    uAccent: { value: new THREE.Color(look.accent ?? DEFAULT_LOOK.accent) },
    uCarbon: { value: new THREE.Color("#0d0e10") },
    uInterior: { value: new THREE.Color("#09090a") },
    uMid: { value: -0.1955 },
  };
  // a glossy clear coat over a satin base, so the sky slides over the bodywork like on a real car; the zones are
  // drawn per pixel (ZONE_GLSL)
  // one material per body mesh (the body, the rear flap): the colours are shared, each has its own place in the car
  const bodyMats: THREE.MeshPhysicalMaterial[] = [];
  const makeBodyMat = (zone: THREE.Matrix4) => {
  const bodyMat = new THREE.MeshPhysicalMaterial({ name: "body", metalness: 0.05, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.8 });
  bodyMats.push(bodyMat);
  bodyMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms, { uZone: { value: zone } });
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
  return bodyMat;
  };
  const bodyMeshes: { mesh: THREE.Mesh; zone: THREE.Matrix4 }[] = [];
  /** the sprung part of the car (everything but the wheels), which pitches, rolls and heaves on its suspension */
  const sprung = new THREE.Group();
  const sprungInner = new THREE.Group();
  const SPRUNG_PIVOT = 0.3;
  sprung.position.y = SPRUNG_PIVOT;
  sprungInner.position.y = -SPRUNG_PIVOT;
  sprung.add(sprungInner);
  let flap: THREE.Object3D | null = null;
  let helmet: THREE.Group | null = null;
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
    const gRoot = gltf.scene.getObjectByName("car") ?? gltf.scene;
    cameras = (gRoot.userData.cameras as typeof cameras) ?? {};
    gltf.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        geos.add(o.geometry);
        let m = o.material as THREE.MeshStandardMaterial;
        const name = m.name;
        if (name === "body") {
          m.dispose();
          const zone = new THREE.Matrix4();
          o.material = m = makeBodyMat(zone);
          bodyMeshes.push({ mesh: o, zone });
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
      if (o.name === "steering_wheel_generic_lcd_0") lcd = o as THREE.Mesh;
      if (o instanceof THREE.Mesh && (o.material as THREE.Material).name === "vehicle_revs_type1") revMats.add(o.material as THREE.MeshStandardMaterial);
      if (o.name === "rear-flap") flap = o;
    });
    if (typeof gRoot.userData.rigMid === "number") uniforms.uMid.value = gRoot.userData.rigMid;
    car.add(gltf.scene);
    // the zones are drawn in the car's own frame: the body mesh's place in the car (the compressed file scales and
    // shifts each mesh)
    car.updateMatrixWorld(true);
    const inv = car.matrixWorld.clone().invert();
    for (const b of bodyMeshes) b.zone.multiplyMatrices(inv, b.mesh.matrixWorld);
    // everything but the wheels rides on the suspension (the zones were taken at rest, so the paint moves with it)
    const root = gltf.scene.getObjectByName("car") ?? gltf.scene;
    for (const c of [...root.children]) if (!c.name.startsWith("wheel-")) sprungInner.add(c);
    root.add(sprung);
    // the driver: a helmet in the cockpit, gloves on the steering wheel
    helmet = buildHelmet(look.paint ?? DEFAULT_LOOK.paint, mats, geos);
    helmet.position.set(0, 0.748, -0.14);
    sprungInner.add(helmet);
    // gloves on the steering wheel's grips (its frame: x across the wheel, z along the column, the driver at -z); they
    // turn with it
    if (steer) {
      const gloveMat = new THREE.MeshStandardMaterial({ color: "#16171a", roughness: 0.9 });
      mats.add(gloveMat);
      // a fist round each grip: a short rounded shape along the grip, the knuckles towards the driver
      const fist = new THREE.CapsuleGeometry(0.026, 0.045, 4, 10);
      geos.add(fist);
      for (const side of [-1, 1]) {
        const hand = new THREE.Mesh(fist, gloveMat);
        hand.position.set(side * 0.133, -0.01, -0.012);
        hand.rotation.z = side * 0.18;
        hand.scale.set(1, 1, 0.85);
        (steer as THREE.Object3D).add(hand);
      }
    }
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
      [0, 0.265, 2.452, 0.085, 0.05, 3.6],
      // endplates: 1.4 cm wide, 16 cm tall, on the trailing edge at the top of each endplate (where it's vertical, from
      // 0.65 m up, 0.57 m out from the middle)
      [-0.566, 0.81, 2.454, 0.014, 0.16, 2.4],
      [0.566, 0.81, 2.454, 0.014, 0.16, 2.4],
    ]) {
      const tex = ledTexture.clone();
      tex.repeat.set(Math.max(1, Math.round(width / 0.012)) / 4, Math.max(1, Math.round(height / 0.012)) / 4);
      const ledMat = new THREE.MeshBasicMaterial({ map: tex, color: "#ff1a10", toneMapped: false, side: THREE.DoubleSide });
      const led = new THREE.Mesh(new THREE.PlaneGeometry(width, height), ledMat);
      led.position.set(x, y, z);
      sprungInner.add(led);
      geos.add(led.geometry);
      mats.add(ledMat);
      disposables.push(tex);
      rearLamps.push(ledMat);
      const glowMat = new THREE.SpriteMaterial({ map: glowTexture, color: "#ff3b23", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
      const glow = new THREE.Sprite(glowMat);
      glow.position.set(x, y, z + 0.03);
      glow.scale.set(Math.max(width, height * 0.35) * halo, height * halo * 0.9, 1);
      sprungInner.add(glow);
      mats.add(glowMat);
      rearGlows.push(glowMat);
    }
    applyLights(0);

    // contact shadows: where each tyre presses on the road the ground is darkest, and the floor, a few centimetres off
    // it, shades the road under the whole car; without them the car seems to float over the track
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 64;
    const sc = shadowCanvas.getContext("2d")!;
    const sg = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    sg.addColorStop(0, "rgba(0,0,0,1)");
    sg.addColorStop(0.45, "rgba(0,0,0,0.75)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    sc.fillStyle = sg;
    sc.fillRect(0, 0, 64, 64);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    disposables.push(shadowTex);
    const shadowMat = (opacity: number) => {
      const m = new THREE.MeshBasicMaterial({ map: shadowTex, color: "#000000", transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      mats.add(m);
      return m;
    };
    const decal = (x: number, z: number, w: number, l: number, opacity: number) => {
      const g = new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2);
      geos.add(g);
      const m = new THREE.Mesh(g, shadowMat(opacity));
      m.position.set(x, 0.006, z);
      m.renderOrder = 2;
      car.add(m);
    };
    decal(0, 0, 2.1, 5.4, 0.42);
    for (const w of wheels) decal(w.position.x, w.position.z, 0.62, 0.95, 0.85);
  });

  // ---- the race number: on the nose (read from in front) and on both sides of the engine cover, as the rules want it
  let numberDecals: THREE.Mesh[] = [];
  let numberTex: THREE.CanvasTexture | null = null;
  let numberMat: THREE.MeshStandardMaterial | null = null;
  let wantNumber: number | null = null;
  const placeNumber = () => {
    for (const d of numberDecals) {
      d.removeFromParent();
      d.geometry.dispose();
    }
    numberDecals = [];
    numberTex?.dispose();
    numberMat?.dispose();
    numberTex = null;
    numberMat = null;
    if (wantNumber == null || !bodyMeshes.length) return;
    numberTex = numberTexture(wantNumber, new THREE.Color(uniforms.uPaint.value));
    numberMat = new THREE.MeshStandardMaterial({ map: numberTex, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
    car.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const targets = bodyMeshes.map((b) => b.mesh);
    // where: a ray onto the body from outside (in the car's frame: +x left, +y up, -z forward), the decal's size, and
    // which way the number reads
    const spots: { from: [number, number, number]; dir: [number, number, number]; size: number; turn: number }[] = [
      { from: [0, 2, -2.12], dir: [0, -1, 0], size: 0.25, turn: 0 },
      { from: [1.6, 0.8, 0.95], dir: [-1, 0, 0], size: 0.42, turn: 1 },
      { from: [-1.6, 0.8, 0.95], dir: [1, 0, 0], size: 0.42, turn: -1 },
    ];
    for (const sp of spots) {
      const o = car.localToWorld(new THREE.Vector3(...sp.from));
      const d = new THREE.Vector3(...sp.dir).transformDirection(car.matrixWorld);
      ray.set(o, d);
      const hit = ray.intersectObjects(targets, false)[0];
      if (!hit) continue;
      const mesh = hit.object as THREE.Mesh;
      // the projector looks along -d; on the nose the top of the number points back (it reads from in front), on the
      // sides it stands upright
      const look = new THREE.Object3D();
      look.position.copy(hit.point);
      look.up.copy(sp.turn === 0 ? new THREE.Vector3(0, 0, 1).transformDirection(car.matrixWorld) : new THREE.Vector3(0, 1, 0).transformDirection(car.matrixWorld));
      look.lookAt(hit.point.clone().sub(d));
      const g = new DecalGeometry(mesh, hit.point, look.rotation, new THREE.Vector3(sp.size, sp.size, 0.25));
      // into the body's own frame, so it rides with it
      g.applyMatrix4(mesh.matrixWorld.clone().invert());
      const dm = new THREE.Mesh(g, numberMat);
      dm.renderOrder = 3;
      mesh.add(dm);
      numberDecals.push(dm);
    }
  };
  disposables.push({
    dispose() {
      for (const d of numberDecals) d.geometry.dispose();
      numberTex?.dispose();
      numberMat?.dispose();
    },
  });

  // ---- the steering wheel's screen: the model's display has no texture coordinates, so a screen of our own lies on
  // it, the same size and facing the driver, drawn from a canvas as the lap goes
  let dash: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; mesh: THREE.Mesh } | null = null;
  const makeDash = () => {
    if (dash || !lcd || !steer) return dash;
    car.updateMatrixWorld(true);
    const g = lcd.geometry;
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const toSteer = new THREE.Matrix4().copy(steer.matrixWorld).invert().multiply(lcd.matrixWorld);
    const box = new THREE.Box3();
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) box.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(toSteer));
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    // the thinnest side is the screen's facing; it faces the driver
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    const ext = [size.x, size.y, size.z];
    const thin = ext.indexOf(Math.min(...ext));
    const eye = new THREE.Vector3(...(cameras.cockpit ?? [0, 0.74, -0.2]));
    const eyeInSteer = steer.worldToLocal(car.localToWorld(eye.clone()));
    const normal = axes[thin].clone().multiplyScalar(Math.sign(eyeInSteer.getComponent(thin) - centre.getComponent(thin)) || 1);
    const others = [0, 1, 2].filter((k) => k !== thin);
    // its width the longer of the other two sides
    const wide = ext[others[0]] >= ext[others[1]] ? others[0] : others[1];
    const tall = wide === others[0] ? others[1] : others[0];
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 320;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ext[wide], ext[tall]), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    // the plane's x along the screen's width, its y up the screen, its face towards the driver
    const xAxis = axes[wide].clone();
    let yAxis = axes[tall].clone();
    if (new THREE.Vector3().crossVectors(xAxis, yAxis).dot(normal) < 0) yAxis = yAxis.negate();
    // the screen's top is the side away from the wheel's bottom: up in the car
    const upCar = steer.worldToLocal(car.localToWorld(new THREE.Vector3(0, 1, 0))).sub(steer.worldToLocal(car.localToWorld(new THREE.Vector3())));
    if (yAxis.dot(upCar) < 0) {
      yAxis.negate();
      xAxis.negate();
    }
    mesh.matrix.makeBasis(xAxis, yAxis, normal).setPosition(centre.clone().addScaledVector(normal, ext[thin] / 2 + 0.0015));
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = 2;
    steer.add(mesh);
    geos.add(mesh.geometry);
    mats.add(mesh.material as THREE.Material);
    disposables.push(tex);
    dash = { canvas, tex, mesh };
    return dash;
  };

  return {
    car,
    wheels,
    front,
    detail,
    /**
     * What the steering wheel's screen shows: the gear, the speed, the revs (0-1, as lights across the top), the lap
     * time and the gap to the ghost (ms, minus ahead; null: none), and the battery (0-1).
     */
    setDash(d: { gear: number; kmh: number; rpm: number; lapMs: number; deltaMs: number | null; ers: number }) {
      const ds = makeDash();
      if (!ds) return;
      drawDash(ds.canvas, d);
      ds.tex.needsUpdate = true;
      // the wheel's own lights glow with the revs, and flash at the limit
      const flash = d.rpm > 0.97 ? (performance.now() % 160 < 80 ? 3 : 0.3) : 0.3 + 2.2 * Math.max(0, (d.rpm - 0.55) / 0.42);
      for (const m of revMats) m.emissiveIntensity = flash;
    },
    /** the race number on the car (null: none); drawn once the model is in */
    setNumber(n: number | null) {
      wantNumber = n;
      void ready.then(() => {
        if (!disposed && wantNumber === n) placeNumber();
      });
    },
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
      // Ackermann: the inside wheel turns a little more than the outside one (it runs a tighter circle)
      for (const w of front) {
        const inside = (w.name.endsWith("L") && d > 0) || (w.name.endsWith("R") && d < 0);
        w.rotation.y = d * (inside ? 1.08 : 0.93);
      }
      // the wheel's node faces the driver: a turn to the left is a negative turn about its axis
      if (steer) (steer as THREE.Object3D).rotation.z = -d * STEER_RATIO;
    },
    /**
     * The car on its suspension: pitch (rad, + nose down, under braking), roll (rad, + leaning right, in a left-hander)
     * and heave (m, + up). An F1 car is stiff: about a degree of pitch under the hardest braking, half a degree of roll.
     */
    setAttitude(pitch: number, roll: number, heave: number) {
      sprung.rotation.set(-pitch, 0, -roll);
      sprung.position.y = SPRUNG_PIVOT + heave;
    },
    /** 2026 active aero: the rear wing's flap opens on the straights (1 open, 0 closed for the corners) */
    setAero(open: number) {
      if (flap) (flap as THREE.Object3D).rotation.x = 0.42 * Math.max(0, Math.min(1, open));
    },
    /** the driver's helmet, hidden from the cockpit camera (it sits where the camera is) */
    setDriverVisible(on: boolean) {
      if (helmet) helmet.visible = on;
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
      if (next.paint && numberDecals.length) placeNumber();
    },
    dispose() {
      disposed = true;
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      rearGlowTexture?.dispose();
      for (const m of bodyMats) m.dispose();
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

/**
 * The driver's helmet, as plain geometry (after LibreCorsa's driver-helmet.ts, MIT): a shell a little longer than wide
 * in the car's colour, a dark band and chin, a white stripe over the crown, a mirrored visor facing forward (-z), and
 * the HANS collar on the shoulders.
 */
function buildHelmet(colour: string, mats: Set<THREE.Material>, geos: Set<THREE.BufferGeometry>): THREE.Group {
  const g = new THREE.Group();
  const R = 0.134;
  const paint = (hex: string) => {
    const m = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 });
    mats.add(m);
    return m;
  };
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    geos.add(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(0.95, 1, 1.1);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  add(new THREE.SphereGeometry(R, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.78), paint(colour));
  add(new THREE.SphereGeometry(R * 1.004, 8, 24, Math.PI * 0.5 - 0.09, 0.18, 0, Math.PI * 0.62), paint("#f2f2ee"));
  add(new THREE.SphereGeometry(R * 1.003, 32, 6, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.16), paint("#141518"));
  const visorMat = new THREE.MeshPhysicalMaterial({ color: "#101418", metalness: 0.9, roughness: 0.06, clearcoat: 1 });
  mats.add(visorMat);
  // the visor: a window towards the front; three's sphere faces +z at phi = pi/2, and the car's front is -z
  const visor = add(new THREE.SphereGeometry(R * 1.008, 24, 10, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.36, Math.PI * 0.19), visorMat);
  visor.rotation.y = Math.PI;
  const collarMat = new THREE.MeshStandardMaterial({ color: "#141414", roughness: 0.8 });
  mats.add(collarMat);
  const collarGeo = new THREE.TorusGeometry(0.105, 0.03, 10, 28, Math.PI * 1.4);
  geos.add(collarGeo);
  const collar = new THREE.Mesh(collarGeo, collarMat);
  collar.rotation.set(Math.PI / 2, 0, Math.PI * 0.8 + Math.PI);
  collar.position.y = -0.11;
  g.add(collar);
  return g;
}

/**
 * A race number as a decal: bold italic figures in white with a dark edge on a dark car... and dark with a white edge
 * on a pale one, so it reads on any paint.
 */
function numberTexture(n: number, paint: THREE.Color): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const pale = paint.r * 0.3 + paint.g * 0.59 + paint.b * 0.11 > 0.3;
  g.font = "italic 900 190px Archivo, 'Arial Black', Arial, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.lineWidth = 16;
  g.strokeStyle = pale ? "#ffffff" : "#101114";
  g.fillStyle = pale ? "#101114" : "#ffffff";
  g.strokeText(String(n), 128, 136);
  g.fillText(String(n), 128, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** The steering wheel's screen, as on a 2026 car: the rev lights across the top, the gear big in the middle, the speed,
 * the lap time and the gap to the ghost (green ahead, red behind), the battery's charge. */
function drawDash(c: HTMLCanvasElement, d: { gear: number; kmh: number; rpm: number; lapMs: number; deltaMs: number | null; ers: number }) {
  const g = c.getContext("2d")!;
  const W = c.width;
  const H = c.height;
  g.fillStyle = "#050607";
  g.fillRect(0, 0, W, H);
  // rev lights: green, red, blue, filling with the revs
  const n = 15;
  for (let i = 0; i < n; i++) {
    const on = d.rpm > 0.55 + (i / n) * 0.42;
    const col = i < 5 ? "#27e05a" : i < 10 ? "#ff2a2a" : "#3a7bff";
    g.fillStyle = on ? col : "#16181b";
    g.beginPath();
    g.arc(28 + i * ((W - 56) / (n - 1)), 26, 12, 0, Math.PI * 2);
    g.fill();
  }
  const font = (w: number, px: number) => `${w} ${px}px Archivo, 'Arial Narrow', Arial, sans-serif`;
  g.textBaseline = "middle";
  // the gear
  g.textAlign = "center";
  g.fillStyle = "#ffffff";
  g.font = font(900, 150);
  g.fillText(d.kmh < 2 ? "N" : String(d.gear), W / 2, 150);
  // the speed, left
  g.textAlign = "left";
  g.fillStyle = "#e9edf2";
  g.font = font(800, 64);
  g.fillText(String(Math.round(d.kmh)), 20, 128);
  g.fillStyle = "#7f8893";
  g.font = font(700, 24);
  g.fillText("KM/H", 22, 172);
  // the gap to the ghost, right
  g.textAlign = "right";
  if (d.deltaMs != null) {
    const ahead = d.deltaMs < 0;
    g.fillStyle = ahead ? "#27e05a" : "#ff3b3b";
    g.font = font(800, 54);
    g.fillText(`${ahead ? "-" : "+"}${(Math.abs(d.deltaMs) / 1000).toFixed(2)}`, W - 18, 128);
    g.fillStyle = "#7f8893";
    g.font = font(700, 24);
    g.fillText("DELTA", W - 20, 172);
  }
  // the lap time along the bottom
  const m = Math.floor(d.lapMs / 60000);
  const sec = ((d.lapMs % 60000) / 1000).toFixed(3).padStart(6, "0");
  g.textAlign = "left";
  g.fillStyle = "#e9edf2";
  g.font = font(800, 46);
  g.fillText(`${m}:${sec}`, 20, 262);
  // the battery: a bar, bottom right
  g.fillStyle = "#16181b";
  g.fillRect(W - 190, 246, 170, 30);
  g.fillStyle = "#f5c518";
  g.fillRect(W - 190, 246, 170 * Math.max(0, Math.min(1, d.ers)), 30);
  g.fillStyle = "#7f8893";
  g.font = font(700, 22);
  g.textAlign = "right";
  g.fillText("ERS", W - 200, 262);
}
