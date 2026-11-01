/**
 * The car of Make the corner, from a free 3D model: "My take on the 2026 f1
 * regulations" by MaG80, CC BY 4.0
 * (https://sketchfab.com/3d-models/my-take-on-the-2026-f1-regulations-4b77c9b72dc44803a530eaaff18ed590).
 * The download is a car to the 2026 rules in a blue livery with the series'
 * logos on it; none of that is kept. Every triangle of the bodywork takes its
 * colour from the livery texture under it: the black of the floor, wings and
 * other carbon parts stays carbon, and everything else, logos and stripes
 * included, is painted plain in Lapdle's orange, so the car carries no texture
 * and no mark. The four tyres and wheel covers come in one mesh each and are
 * split into the four wheels, each about its own hub so it can roll. Then the
 * whole car is scaled to a real wheelbase (3.4 m, as the physics), cut to a
 * size a phone draws easily and written as a compressed GLB: metres, Y up,
 * nose towards -Z, the middle of the wheelbase at the origin, the ground at
 * y = 0. The tail light is left out: the game draws its own.
 *
 * Input: marketing/models/f1_2026_mag80/scene.gltf (not in git: download it
 * from the page above). Output: apps/web/src/game3d/car.glb.
 * Usage: npm run build:car
 */
import { resolve } from "node:path";
import { statSync } from "node:fs";
import sharp from "sharp";
import { Document, type Material, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, simplifyPrimitive, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const root = resolve(import.meta.dirname, "../../..");
const DIR = resolve(root, "marketing/models/f1_2026_mag80");
const OUT = resolve(root, "apps/web/src/game3d/car.glb");

const WHEELBASE = 3.4;
/** the share of each part's triangles kept: plenty for a car seen from a few metres, light enough to draw twice (shadows) on a phone */
const KEEP = { body: 0.3, carbon: 0.3, tyre: 1, rim: 0.12 };
/** a texel this dark (the sum of its 0-255 channels) is carbon */
const DARK = 60;

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const src = await io.read(resolve(DIR, "scene.gltf"));

// the livery texture, to tell carbon from paint
const tex = await sharp(resolve(DIR, "textures/Livery_baseColor.png")).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: TW, height: TH } = tex.info;
const dark = (u: number, v: number) => {
  const x = Math.min(TW - 1, Math.max(0, Math.floor((u - Math.floor(u)) * TW)));
  const y = Math.min(TH - 1, Math.max(0, Math.floor((v - Math.floor(v)) * TH)));
  const i = (y * TW + x) * 3;
  return tex.data[i] + tex.data[i + 1] + tex.data[i + 2] < DARK;
};

// every triangle in world space (Y up, nose towards +z, about twice life size), sorted into parts by material
type Source = "paint" | "carbon" | "tyre" | "rim";
const soup: Record<Source, number[]> = { paint: [], carbon: [], tyre: [], rim: [] };
const tf = (m: number[], v: number[]) => [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]);
for (const node of src.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const world = node.getWorldMatrix() as unknown as number[];
  for (const prim of mesh.listPrimitives()) {
    const name = prim.getMaterial()?.getName();
    if (name === "RearLight") continue;
    const pos = prim.getAttribute("POSITION")!;
    const uv = prim.getAttribute("TEXCOORD_0");
    const idx = prim.getIndices()?.getArray();
    const n = idx ? idx.length : pos.getCount();
    const p = [0, 0, 0];
    const t = [0, 0];
    for (let k = 0; k < n; k += 3) {
      const corners = [0, 1, 2].map((j) => (idx ? idx[k + j] : k + j));
      let into: Source = name === "Wheels" ? "tyre" : name === "WheelCovers" ? "rim" : "paint";
      if (name === "Livery" && uv) {
        let su = 0;
        let sv = 0;
        for (const c of corners) {
          uv.getElement(c, t);
          su += t[0];
          sv += t[1];
        }
        if (dark(su / 3, sv / 3)) into = "carbon";
      }
      for (const c of corners) soup[into].push(...tf(world, pos.getElement(c, p)));
    }
  }
}

// the wheels: their hubs from the tyres' extent in each quarter of the car, and the scale from the wheelbase
type Wheel = { id: string; x: number; y: number; z: number };
const quarter = (x: number, z: number, zMid: number) => `${z > zMid ? "F" : "R"}${x > 0 ? "R" : "L"}`;
let zMin = Infinity;
let zMax = -Infinity;
for (let i = 2; i < soup.tyre.length; i += 3) {
  zMin = Math.min(zMin, soup.tyre[i]);
  zMax = Math.max(zMax, soup.tyre[i]);
}
const zMid0 = (zMin + zMax) / 2;
const box = new Map<string, number[]>();
for (let i = 0; i < soup.tyre.length; i += 3) {
  const [x, y, z] = soup.tyre.slice(i, i + 3);
  const q = quarter(x, z, zMid0);
  const b = box.get(q) ?? [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  box.set(q, [Math.min(b[0], x), Math.min(b[1], y), Math.min(b[2], z), Math.max(b[3], x), Math.max(b[4], y), Math.max(b[5], z)]);
}
const wheels: Wheel[] = ["FL", "FR", "RL", "RR"].map((id) => {
  const b = box.get(id)!;
  return { id, x: (b[0] + b[3]) / 2, y: (b[1] + b[4]) / 2, z: (b[2] + b[5]) / 2 };
});
const front = (wheels[0].z + wheels[1].z) / 2;
const rear = (wheels[2].z + wheels[3].z) / 2;
const S = WHEELBASE / (front - rear);
const zMid = (front + rear) / 2;
let ground = Infinity;
for (const part of Object.values(soup)) for (let i = 1; i < part.length; i += 3) ground = Math.min(ground, part[i]);
console.log(`scale ${S.toFixed(3)}, tyre ${((box.get("FL")![4] - box.get("FL")![1]) * S).toFixed(2)} m across`);

// the game's frame: metres, nose towards -z (a half turn about y), the middle of the wheelbase at the origin
const toGame = (x: number, y: number, z: number): [number, number, number] => [-x * S, (y - ground) * S, -(z - zMid) * S];
// where the model's tail light was, for the game's own (game3d/car.ts)
console.log(`tail light at ${toGame(0, 0.695, -5.29).map((v) => v.toFixed(2)).join(", ")}`);

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

/** A mesh of world-space triangles, in the game's frame, relative to `origin` (game frame). */
function meshOf(name: string, flat: number[], material: Material, origin: [number, number, number]) {
  const pos = new Float32Array(flat.length);
  for (let i = 0; i < flat.length; i += 3) {
    const g = toGame(flat[i], flat[i + 1], flat[i + 2]);
    for (let k = 0; k < 3; k++) pos[i + k] = g[k] - origin[k];
  }
  const prim = doc.createPrimitive().setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(pos).setBuffer(buffer)).setMaterial(material);
  return doc.createMesh(name).addPrimitive(prim);
}

car.addChild(doc.createNode("body").setMesh(meshOf("body", soup.paint, MATS.body, [0, 0, 0])));
car.addChild(doc.createNode("carbon").setMesh(meshOf("carbon", soup.carbon, MATS.carbon, [0, 0, 0])));
// each wheel's triangles by the quarter of the car their centre is in
const perWheel = (flat: number[]) => {
  const out = new Map<string, number[]>();
  for (let t = 0; t < flat.length; t += 9) {
    const q = quarter((flat[t] + flat[t + 3] + flat[t + 6]) / 3, (flat[t + 2] + flat[t + 5] + flat[t + 8]) / 3, zMid0);
    let list = out.get(q);
    if (!list) out.set(q, (list = []));
    for (let k = 0; k < 9; k++) list.push(flat[t + k]);
  }
  return out;
};
const tyres = perWheel(soup.tyre);
const rims = perWheel(soup.rim);
for (const w of wheels) {
  // each wheel about its hub, placed at the hub: rolling is a turn about its x axis, steering about y
  // (the game calls the car's left the side its own left is on, nose towards -z: source +x is the car's right)
  const hub = toGame(w.x, w.y, w.z);
  const id = `${w.id[0]}${w.id[1] === "L" ? "R" : "L"}`;
  const node = doc.createNode(`wheel-${id}`).setTranslation(hub);
  node.addChild(doc.createNode(`tyre-${id}`).setMesh(meshOf(`tyre-${id}`, tyres.get(w.id) ?? [], MATS.tyre, hub)));
  node.addChild(doc.createNode(`rim-${id}`).setMesh(meshOf(`rim-${id}`, rims.get(w.id) ?? [], MATS.rim, hub)));
  car.addChild(node);
}
for (const [p, g] of Object.entries(soup)) console.log(`  ${p}: ${g.length / 9} triangles`);

// weld the triangle soup, then cut each part to its share
await doc.transform(weld({}));
for (const m of doc.getRoot().listMeshes()) {
  const kind = m.getName().split("-")[0] as keyof typeof KEEP;
  for (const prim of m.listPrimitives()) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: KEEP[kind], error: 0.001 });
}
await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));

let out = 0;
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) out += (p.getIndices()?.getCount() ?? 0) / 3;
await io.write(OUT, doc);
const bytes = statSync(OUT).size;
console.log(`${Math.round(out)} triangles out → ${OUT} (${Math.round(bytes / 1024)} KB)`);
