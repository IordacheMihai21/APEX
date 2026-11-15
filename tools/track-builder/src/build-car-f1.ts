/**
 * The 3D car of the games: "F1 2026 concept (polygon model)" by Qvist Designs, CC BY 4.0
 * (https://sketchfab.com/3d-models/f1-2026-concept-polygon-model-ea3bde709b1e4dc9b0ec8557d106ed42), with the steering
 * wheel of "AM26 - F1 25/F1 2026 DLC" by DeX, CC BY 4.0 (https://skfb.ly/pKNCK).
 *
 * The download is one CAD shell, exported as eleven 65k-vertex chunks. It has no UVs, one grey material and plain
 * normals. Its separate pieces are found by shared vertex positions:
 * - the four wheels (720 mm discs), each split into tyre and rim by the distance from its axle;
 * - two mirror glasses;
 * - the exhaust;
 * - one welded body, painted by zone.
 *
 * The approach (pieces by welded positions, the tyre/rim radius, the paint zones and their heights, the rain light) follows
 * LibreCorsa's scripts/cars/port_qvist_f1.mjs, MIT, (c) the LibreCorsa contributors
 * (https://github.com/KhazP/librecorsa).
 *
 * Two files are written:
 * - car-f1.glb: every triangle of the source (1.16 M), only welded and compressed. Used on desktop.
 * - car-f1-lite.glb: the body simplified for phones.
 *
 * Frame: metres, Y up, nose towards -Z, the middle of the wheelbase at the origin, the ground at y = 0. The front
 * wheels are wheel-FL / wheel-FR, about their hubs.
 * Materials: body (its paint zones are drawn by the game's shader), light (rain light), mirror, exhaust, tyre, rim. The steering wheel's own
 * materials come along with it, under the node "steer".
 * Root extras: cockpit cameras in the game frame.
 *
 * Inputs (not in git): marketing/models/f1_2026_concept_polygon_model/scene.gltf (from the Sketchfab page above) and
 * marketing/models/am26-steering-wheel/am26-steering-wheel.glb (from LibreCorsa's scripts/cars/sources).
 * Outputs: apps/web/src/game3d/car-f1.glb and car-f1-lite.glb.
 * Usage: npm run build:car-f1
 */
import { resolve } from "node:path";
import { statSync } from "node:fs";
import { Document, type Material, type Node, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { copyToDocument, dedup, meshopt, prune, unpartition, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

const root = resolve(import.meta.dirname, "../../..");
const SRC = resolve(root, "marketing/models/f1_2026_concept_polygon_model/scene.gltf");
const STEER = resolve(root, "marketing/models/am26-steering-wheel/am26-steering-wheel.glb");
const OUT = resolve(root, "apps/web/src/game3d");

/** Where the steering wheel's source puts the front axle (its frame: +X left, +Z forward); the body is placed to match */
const FRONT_AXLE_Z = 1.5045;
/** tyre / rim boundary, metres from the axle */
const TYRE_MIN_RADIUS = 0.25;
/** the lite body's triangle budget (the wheels keep a share of theirs) */
const LITE = { body: 160_000, tyre: 0.25, rim: 0.2 };

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });

// ---------------------------------------------------------------------------------------------------------------
// Source: every triangle in its own millimetre frame (x back, y right, z up)
// ---------------------------------------------------------------------------------------------------------------
const src = await io.read(SRC);
const P: number[] = [];
const N: number[] = [];
const I: number[] = [];
for (const node of src.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  for (const prim of mesh.listPrimitives()) {
    const p = prim.getAttribute("POSITION")!;
    const n = prim.getAttribute("NORMAL")!;
    const ix = prim.getIndices()!;
    const base = P.length / 3;
    const v = [0, 0, 0];
    for (let i = 0; i < p.getCount(); i++) {
      p.getElement(i, v);
      P.push(v[0], v[1], v[2]);
      n.getElement(i, v);
      N.push(v[0], v[1], v[2]);
    }
    for (let i = 0; i < ix.getCount(); i++) I.push(base + ix.getScalar(i));
  }
}
const triCount = I.length / 3;
console.log(`source: ${triCount} triangles, ${P.length / 3} vertices`);

// connected pieces: vertices at the same position join
const keyOf = new Map<string, number>();
const welded = new Int32Array(P.length / 3);
for (let i = 0; i < welded.length; i++) {
  const k = `${P[3 * i]},${P[3 * i + 1]},${P[3 * i + 2]}`;
  let j = keyOf.get(k);
  if (j === undefined) keyOf.set(k, (j = keyOf.size));
  welded[i] = j;
}
const parent = Int32Array.from({ length: keyOf.size }, (_, i) => i);
const find = (x: number) => {
  while (parent[x] !== x) x = parent[x] = parent[parent[x]];
  return x;
};
for (let t = 0; t < I.length; t += 3) {
  const a = find(welded[I[t]]);
  parent[find(welded[I[t + 1]])] = a;
  parent[find(welded[I[t + 2]])] = a;
}
interface Piece {
  tris: number[];
  min: number[];
  max: number[];
}
const byRoot = new Map<number, Piece>();
for (let t = 0; t < triCount; t++) {
  const r = find(welded[I[3 * t]]);
  let p = byRoot.get(r);
  if (!p) byRoot.set(r, (p = { tris: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }));
  p.tris.push(t);
  for (let c = 0; c < 3; c++) {
    const v = I[3 * t + c];
    for (let k = 0; k < 3; k++) {
      p.min[k] = Math.min(p.min[k], P[3 * v + k]);
      p.max[k] = Math.max(p.max[k], P[3 * v + k]);
    }
  }
}
const list = [...byRoot.values()].sort((a, b) => b.tris.length - a.tris.length);
const size = (p: Piece, k: number) => p.max[k] - p.min[k];
const wheelPieces = list.filter((p) => Math.abs(size(p, 0) - 718) < 30 && Math.abs(size(p, 2) - 718) < 30);
if (wheelPieces.length !== 4) throw new Error(`expected 4 wheels, found ${wheelPieces.length}`);
const body = list[0];
const rest = list.filter((p) => p !== body && !wheelPieces.includes(p));
const mirrors = rest.filter((p) => p.tris.length < 400 && Math.min(Math.abs(p.min[1]), Math.abs(p.max[1])) > 400);
const exhaust = rest.find((p) => Math.abs(p.min[1] + p.max[1]) < 5 && p.min[0] > 3000 && p.tris.length > 1000);
const other = rest.filter((p) => !mirrors.includes(p) && p !== exhaust);
console.log(`pieces: body ${body.tris.length}, wheels ${wheelPieces.map((w) => w.tris.length).join("/")}, mirrors ${mirrors.length}, exhaust ${exhaust ? "yes" : "no"}, other ${other.length}`);

// ---------------------------------------------------------------------------------------------------------------
// Frames. "rig": metres, +X left, +Y up, +Z forward, the front axle at FRONT_AXLE_Z (the zones and the steering
// wheel are in it). "game": a half turn of the rig about Y, the middle of the wheelbase at the origin.
// ---------------------------------------------------------------------------------------------------------------
const cx = (p: Piece) => (p.min[0] + p.max[0]) / 2;
const xs = wheelPieces.map(cx).sort((a, b) => a - b);
const xFront = (xs[0] + xs[1]) / 2;
const xRear = (xs[2] + xs[3]) / 2;
const zGround = Math.min(...wheelPieces.map((p) => p.min[2]));
const wheelbase = (xRear - xFront) / 1000;
const MID = FRONT_AXLE_Z - wheelbase / 2;
console.log(`wheelbase ${wheelbase.toFixed(3)} m`);

const nv = P.length / 3;
const rig = new Float32Array(nv * 3);
const rigN = new Float32Array(nv * 3);
for (let i = 0; i < nv; i++) {
  const [x, y, z] = [P[3 * i], P[3 * i + 1], P[3 * i + 2]];
  rig.set([-y / 1000, (z - zGround) / 1000, FRONT_AXLE_Z - (x - xFront) / 1000], 3 * i);
  const d = [-N[3 * i + 1], N[3 * i + 2], -N[3 * i]];
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  rigN.set([d[0] / l, d[1] / l, d[2] / l], 3 * i);
}
/** rig to game: the half turn and the shift */
const game = (x: number, y: number, z: number): [number, number, number] => [-x, y, MID - z];

const centroid = (t: number) => {
  const c = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const v = I[3 * t + k];
    for (let j = 0; j < 3; j++) c[j] += rig[3 * v + j] / 3;
  }
  return c;
};
const faceNormal = (t: number) => {
  const [a, b, c] = [I[3 * t], I[3 * t + 1], I[3 * t + 2]];
  const u = [0, 1, 2].map((k) => rig[3 * b + k] - rig[3 * a + k]);
  const w = [0, 1, 2].map((k) => rig[3 * c + k] - rig[3 * a + k]);
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return n.map((v) => v / l);
};

// ---------------------------------------------------------------------------------------------------------------
// The paint zones (paint, paint2, accent, carbon, the cockpit's inside) are drawn per pixel by the game's shader
// (game3d/carF1.ts), from the position on the body: the source's triangles are long, so zones cut along them would
// come out in a saw-tooth. Only the rain light is its own mesh.
// ---------------------------------------------------------------------------------------------------------------

// the rain light: the rear face of the crash structure, under the exhaust
const lightTris = new Set<number>();
{
  const facing = body.tris.filter((t) => {
    const c = centroid(t);
    const n = faceNormal(t);
    return n[2] < -0.85 && Math.abs(c[0]) < 0.12 && c[1] > 0.15 && c[1] < 0.5 && c[2] < -2.0;
  });
  if (facing.length) {
    const zMin = Math.min(...facing.map((t) => centroid(t)[2]));
    for (const t of facing) if (centroid(t)[2] < zMin + 0.015) lightTris.add(t);
  }
}

// the rear wing's upper flap, its own piece so the game can open it on the straights (2026 active aero): above the main
// plane (from 0.795 m up) and behind it (rig z below -2.40), between the endplates
const isFlap = (t: number) => {
  const c = centroid(t);
  return c[1] >= 0.795 && c[2] <= -2.4 && Math.abs(c[0]) < 0.5;
};
/** where the flap turns: its trailing edge, at the top (rig), as the real flaps pivot near it */
const FLAP_PIVOT_RIG: [number, number, number] = [0, 0.9, -2.55];
const zones: Record<"body" | "light" | "flap", number[]> = { body: [], light: [], flap: [] };
for (const t of body.tris) zones[lightTris.has(t) ? "light" : isFlap(t) ? "flap" : "body"].push(t);
for (const p of other) zones.body.push(...p.tris);
console.log(Object.entries(zones).map(([k, v]) => `${k} ${v.length}`).join(", "));

// ---------------------------------------------------------------------------------------------------------------
// Wheels: tyre and rim by the distance from the axle (rig X)
// ---------------------------------------------------------------------------------------------------------------
interface Wheel {
  id: string;
  hub: [number, number, number]; // game frame
  tyre: number[];
  rim: number[];
}
const wheels: Wheel[] = wheelPieces.map((piece) => {
  let yMin = Infinity;
  let yMax = -Infinity;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const t of piece.tris)
    for (let c = 0; c < 3; c++) {
      const v = I[3 * t + c];
      yMin = Math.min(yMin, rig[3 * v + 1]);
      yMax = Math.max(yMax, rig[3 * v + 1]);
      zMin = Math.min(zMin, rig[3 * v + 2]);
      zMax = Math.max(zMax, rig[3 * v + 2]);
    }
  const cy = (yMin + yMax) / 2;
  const cz = (zMin + zMax) / 2;
  const tyre: number[] = [];
  const rim: number[] = [];
  let xMin = Infinity;
  let xMax = -Infinity;
  for (const t of piece.tris) {
    let r = Infinity;
    for (let c = 0; c < 3; c++) {
      const v = I[3 * t + c];
      r = Math.min(r, Math.hypot(rig[3 * v + 1] - cy, rig[3 * v + 2] - cz));
    }
    if (r >= TYRE_MIN_RADIUS) {
      tyre.push(t);
      for (let c = 0; c < 3; c++) {
        const x = rig[3 * I[3 * t + c]];
        xMin = Math.min(xMin, x);
        xMax = Math.max(xMax, x);
      }
    } else rim.push(t);
  }
  const hubRig = [(xMin + xMax) / 2, cy, cz];
  // +X is the car's left in the rig
  const id = `${cz > MID ? "F" : "R"}${hubRig[0] > 0 ? "L" : "R"}`;
  return { id, hub: game(hubRig[0], hubRig[1], hubRig[2]), tyre, rim };
});
const tyreRadius = (() => {
  const w = wheelPieces[0];
  return (w.max[2] - w.min[2]) / 2000;
})();
console.log(`wheels ${wheels.map((w) => w.id).join(" ")}, tyre radius ${tyreRadius.toFixed(3)} m`);

// ---------------------------------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------------------------------
const srgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

async function build(file: string, lite: boolean) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const mat = (name: string, hex: string, metal: number, rough: number): Material =>
    doc.createMaterial(name).setBaseColorFactor([...srgb(hex), 1]).setMetallicFactor(metal).setRoughnessFactor(rough);
  const M: Record<string, Material> = {
    body: mat("body", "#ff6a13", 0.05, 0.45),
    light: mat("light", "#4a0606", 0, 0.3).setEmissiveFactor([1, 0.08, 0.05]),
    mirror: mat("mirror", "#9a9a9e", 1, 0.05),
    exhaust: mat("exhaust", "#5a5650", 0.8, 0.35),
    tyre: mat("tyre", "#1a1a1a", 0, 0.88),
    rim: mat("rim", "#2b2e34", 0.7, 0.35),
  };
  const sceneNode = doc.createScene("car");
  const car = doc.createNode("car").setExtras({
    source: {
      body: 'This work is based on "F1 2026 concept (polygon model)" by Qvist_designs, CC BY 4.0',
      steeringWheel: '"AM26 - F1 25/F1 2026 DLC" by DeX, CC BY 4.0 (steering wheel only)',
    },
    tyreRadius,
    // the zone shader works in the rig frame: rig = (-x, y, rigMid - z)
    rigMid: MID,
    // the cockpit eye and a camera over the airbox, from the steering wheel's source, in the game frame
    cameras: { cockpit: game(0, 0.74, 0), tcam: game(0.09, 1.06, -0.36) },
  });
  sceneNode.addChild(car);

  /** a mesh from source triangles, in the game frame, relative to `origin` */
  function meshOf(name: string, tris: number[], material: Material, origin: [number, number, number] = [0, 0, 0], keep = 1) {
    const remap = new Map<number, number>();
    const pos: number[] = [];
    const nrm: number[] = [];
    const idx = new Uint32Array(tris.length * 3);
    let o = 0;
    for (const t of tris)
      for (let c = 0; c < 3; c++) {
        const v = I[3 * t + c];
        // keyed by the welded position, so the source's chunk seams join into one surface
        let j = remap.get(welded[v]);
        if (j === undefined) {
          remap.set(welded[v], (j = remap.size));
          const g = game(rig[3 * v], rig[3 * v + 1], rig[3 * v + 2]);
          pos.push(g[0] - origin[0], g[1] - origin[1], g[2] - origin[2]);
          nrm.push(-rigN[3 * v], rigN[3 * v + 1], -rigN[3 * v + 2]);
        }
        idx[o++] = j;
      }
    let index: Uint32Array = idx;
    let P3 = Float32Array.from(pos);
    let N3 = Float32Array.from(nrm);
    if (keep < 1) {
      const target = Math.floor((index.length / 3) * keep) * 3;
      const [out] = MeshoptSimplifier.simplify(index, P3, 3, target, 0.002, []);
      // drop unused vertices
      const used = new Map<number, number>();
      const p2: number[] = [];
      const n2: number[] = [];
      const i2 = new Uint32Array(out.length);
      for (let i = 0; i < out.length; i++) {
        const v = out[i];
        let j = used.get(v);
        if (j === undefined) {
          used.set(v, (j = used.size));
          p2.push(P3[3 * v], P3[3 * v + 1], P3[3 * v + 2]);
          n2.push(N3[3 * v], N3[3 * v + 1], N3[3 * v + 2]);
        }
        i2[i] = j;
      }
      index = i2;
      P3 = Float32Array.from(p2);
      N3 = Float32Array.from(n2);
    }
    const prim = doc
      .createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(P3).setBuffer(buffer))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(N3).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(index).setBuffer(buffer))
      .setMaterial(material);
    return doc.createMesh(name).addPrimitive(prim);
  }

  const bodyTris = Object.values(zones).reduce((s, z) => s + z.length, 0);
  const bodyKeep = lite ? Math.min(1, LITE.body / bodyTris) : 1;
  for (const [z, tris] of Object.entries(zones)) {
    if (!tris.length) continue;
    if (z === "flap") {
      // about its pivot, so the game turns it there
      const pivot = game(...FLAP_PIVOT_RIG);
      car.addChild(doc.createNode("rear-flap").setTranslation(pivot).setMesh(meshOf("rear-flap", tris, M.body, pivot, bodyKeep)));
      continue;
    }
    // small zones (the light, the interior) keep their shape
    const keep = z === "light" ? 1 : bodyKeep;
    car.addChild(doc.createNode(z).setMesh(meshOf(z, tris, M[z], [0, 0, 0], keep)));
  }
  mirrors.forEach((m, i) => car.addChild(doc.createNode(`mirror-${i}`).setMesh(meshOf(`mirror-${i}`, m.tris, M.mirror))));
  if (exhaust) car.addChild(doc.createNode("exhaust").setMesh(meshOf("exhaust", exhaust.tris, M.exhaust, [0, 0, 0], lite ? 0.3 : 1)));
  for (const w of wheels) {
    const node = doc.createNode(`wheel-${w.id}`).setTranslation(w.hub);
    node.addChild(doc.createNode(`tyre-${w.id}`).setMesh(meshOf(`tyre-${w.id}`, w.tyre, M.tyre, w.hub, lite ? LITE.tyre : 1)));
    node.addChild(doc.createNode(`rim-${w.id}`).setMesh(meshOf(`rim-${w.id}`, w.rim, M.rim, w.hub, lite ? LITE.rim : 1)));
    car.addChild(node);
  }

  // the steering wheel, from its source's STEER_BASE (rig frame), under a node that turns the rig into the game frame
  const steerDoc = await io.read(STEER);
  const steerBase = steerDoc.getRoot().listNodes().find((n) => n.getName() === "STEER_BASE");
  if (!steerBase) throw new Error("no STEER_BASE in the steering wheel source");
  const map = copyToDocument(doc, steerDoc, [steerBase]);
  const copied = map.get(steerBase) as Node;
  copied.setName("steer");
  const frame = doc.createNode("steer-frame").setRotation([0, 1, 0, 0]).setTranslation([0, 0, MID]);
  frame.addChild(copied);
  car.addChild(frame);

  await doc.transform(unpartition(), weld({}), dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  await io.write(file, doc);
  let tris = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
  console.log(`${file}: ${Math.round(tris)} triangles, ${(statSync(file).size / 1048576).toFixed(2)} MB`);
}

await build(resolve(OUT, "car-f1.glb"), false);
await build(resolve(OUT, "car-f1-lite.glb"), true);
