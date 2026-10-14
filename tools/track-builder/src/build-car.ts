/**
 * The car of Make the corner, from a free 3D model: "F1 2026 concept (polygon
 * model)" by Qvist_designs, CC BY 4.0
 * (https://sketchfab.com/3d-models/f1-2026-concept-polygon-model-ea3bde709b1e4dc9b0ec8557d106ed42).
 * An original design with no team, sponsor or logo. The download is one grey
 * CAD mesh of 1.2 million triangles in millimetres, Z up, nose towards -x; this
 * splits it by shape into the bodywork, the carbon parts (floor, wings,
 * suspension) and four wheels (tyre and rim, each about its own hub so it can
 * roll), paints it in Lapdle's colours, cuts it to a size a phone draws easily
 * and writes a compressed GLB: metres, Y up, nose towards -Z, the middle of the
 * wheelbase at the origin, the ground at y = 0.
 *
 * Input: marketing/models/f1_2026_concept_polygon_model/scene.gltf (not in git:
 * download it from the page above). Output: apps/web/src/game3d/car.glb.
 * Usage: npm run build:car
 */
import { resolve } from "node:path";
import { statSync } from "node:fs";
import { Document, type Material, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, simplifyPrimitive, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const root = resolve(import.meta.dirname, "../../..");
const SRC = resolve(root, "marketing/models/f1_2026_concept_polygon_model/scene.gltf");
const OUT = resolve(root, "apps/web/src/game3d/car.glb");

/** The wheels in the source (mm): axle positions along x, hub height, tyre radius, and where each tyre's inner sidewall is. */
const FRONT_X = -52;
const REAR_X = 3345;
const HUB_Z = 328;
const TYRE_R = 356;
const RIM_R = 236;
const INNER_Y = { front: 580, rear: 520 };
/** the origin: the middle of the wheelbase */
const MID_X = (FRONT_X + REAR_X) / 2;
/** about 1 in 25 triangles kept: plenty for a car seen from a few metres, light enough to draw twice (shadows) on a phone */
const KEEP = { body: 0.035, carbon: 0.04, tyre: 0.06, rim: 0.06 };

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const src = await io.read(SRC);

// every triangle of the source, in its own coordinates (the nodes carry no transform but the root's Z-up turn)
const tris: number[] = [];
for (const mesh of src.getRoot().listMeshes())
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION")!.getArray()!;
    const idx = prim.getIndices()?.getArray();
    const n = idx ? idx.length : pos.length / 3;
    for (let k = 0; k < n; k++) {
      const i = idx ? idx[k] : k;
      tris.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    }
  }
console.log(`${tris.length / 9} triangles in`);

type Part = "body" | "carbon" | `tyre-${string}` | `rim-${string}`;
const WHEELS = [
  { id: "FL", x: FRONT_X, side: 1, inner: INNER_Y.front },
  { id: "FR", x: FRONT_X, side: -1, inner: INNER_Y.front },
  { id: "RL", x: REAR_X, side: 1, inner: INNER_Y.rear },
  { id: "RR", x: REAR_X, side: -1, inner: INNER_Y.rear },
];

/** Which part a triangle belongs to, from its centre (mm, source axes). */
function part(x: number, y: number, z: number): Part {
  for (const w of WHEELS) {
    const d = Math.hypot(x - w.x, z - HUB_Z);
    if (d < TYRE_R && y * w.side > w.inner) return d > RIM_R ? `tyre-${w.id}` : `rim-${w.id}`;
  }
  const ay = Math.abs(y);
  if (z < 70) return "carbon"; // floor and plank
  if (x < -430 && (ay > 150 || z < 150)) return "carbon"; // front wing (the nose tip stays painted)
  if (x > 3760 && z > 420) return "carbon"; // rear wing
  if (x > 3700 && z < 420 && ay < 520) return "carbon"; // diffuser
  if (z > 110 && z < 640 && ((ay > 230 && x > -480 && x < 380) || (ay > 240 && x > 2920 && x < 3780))) return "carbon"; // suspension
  if (z > 760 && x > 650 && x < 1450 && ay < 360) return "carbon"; // halo
  return "body";
}

const groups = new Map<Part, number[]>();
for (let t = 0; t < tris.length; t += 9) {
  const cx = (tris[t] + tris[t + 3] + tris[t + 6]) / 3;
  const cy = (tris[t + 1] + tris[t + 4] + tris[t + 7]) / 3;
  const cz = (tris[t + 2] + tris[t + 5] + tris[t + 8]) / 3;
  const p = part(cx, cy, cz);
  let g = groups.get(p);
  if (!g) groups.set(p, (g = []));
  for (let k = 0; k < 9; k++) g.push(tris[t + k]);
}

// the new model: three's axes (x = source y, y = source z, z = source x), metres
const doc = new Document();
const buffer = doc.createBuffer();
const mat = (name: string, colour: [number, number, number], metal: number, rough: number): Material =>
  doc.createMaterial(name).setBaseColorFactor([...colour, 1]).setMetallicFactor(metal).setRoughnessFactor(rough);
const srgb = (hex: string): [number, number, number] => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return v.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
};
const MATS = {
  body: mat("paint", srgb("#ff6a13"), 0.35, 0.32), // Lapdle's player orange
  carbon: mat("carbon", srgb("#141518"), 0.2, 0.45),
  tyre: mat("tyre", srgb("#161616"), 0, 0.88),
  rim: mat("rim", srgb("#2b2e34"), 0.85, 0.3),
};
const scene = doc.createScene("car");
const car = doc.createNode("car");
scene.addChild(car);

/** A mesh of one part's triangles, relative to `origin` (mm, source axes). */
function meshOf(name: string, flat: number[], material: Material, origin: [number, number, number]) {
  const pos = new Float32Array(flat.length);
  for (let i = 0; i < flat.length; i += 3) {
    pos[i] = (flat[i + 1] - origin[1]) / 1000;
    pos[i + 1] = (flat[i + 2] - origin[2]) / 1000;
    pos[i + 2] = (flat[i] - origin[0]) / 1000;
  }
  const prim = doc.createPrimitive().setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(pos).setBuffer(buffer)).setMaterial(material);
  return doc.createMesh(name).addPrimitive(prim);
}

const body = doc.createNode("body").setMesh(meshOf("body", groups.get("body") ?? [], MATS.body, [MID_X, 0, 0]));
const carbon = doc.createNode("carbon").setMesh(meshOf("carbon", groups.get("carbon") ?? [], MATS.carbon, [MID_X, 0, 0]));
car.addChild(body).addChild(carbon);
for (const w of WHEELS) {
  // each wheel about its hub, placed at the hub: rolling is a turn about its x axis, steering about y
  const hubY = w.side * ((w.inner + 940) / 2);
  const hub = doc.createNode(`wheel-${w.id}`).setTranslation([hubY / 1000, HUB_Z / 1000, (w.x - MID_X) / 1000]);
  const origin: [number, number, number] = [w.x, hubY, HUB_Z];
  hub.addChild(doc.createNode(`tyre-${w.id}`).setMesh(meshOf(`tyre-${w.id}`, groups.get(`tyre-${w.id}`) ?? [], MATS.tyre, origin)));
  hub.addChild(doc.createNode(`rim-${w.id}`).setMesh(meshOf(`rim-${w.id}`, groups.get(`rim-${w.id}`) ?? [], MATS.rim, origin)));
  car.addChild(hub);
}
for (const [p, g] of groups) console.log(`  ${p}: ${g.length / 9} triangles`);

// weld the triangle soup, then cut each part to its share
await doc.transform(weld({}));
for (const m of doc.getRoot().listMeshes()) {
  const kind = m.getName().split("-")[0] as keyof typeof KEEP;
  for (const prim of m.listPrimitives()) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: KEEP[kind], error: 0.002 });
}
await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));

let out = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) out += (p.getIndices()?.getCount() ?? 0) / 3;
await io.write(OUT, doc);
const bytes = statSync(OUT).size;
console.log(`${Math.round(out)} triangles out → ${OUT} (${Math.round(bytes / 1024)} KB)`);
