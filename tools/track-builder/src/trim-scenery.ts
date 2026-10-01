/**
 * Keep only a believable band of the real world around the track: buildings
 * close to the circuit (grandstands and pit buildings a little further out),
 * trees near the barriers, and roads only where they meet the circuit. Ground
 * cover (woods, water and the sea, sand, scrub, grass) stays as terrain.
 * Rewrites data/scenery/<id>.json in place; run after import-osm.ts.
 *
 * Usage: npx tsx tools/track-builder/src/trim-scenery.ts [id...]
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GameTrack } from "@apex/engine";

/** Metres from the track edge. */
export const KEEP = { building: 90, standOrPits: 160, tree: 60, road: 45, urbanArea: 80, landmark: 400 };

const ROOT = resolve(import.meta.dirname, "../../..");
const dir = resolve(ROOT, "data/scenery");
const only = process.argv.slice(2);

for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const id = f.replace(".json", "");
  if (only.length && !only.includes(id)) continue;
  const data = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
  const track: GameTrack = JSON.parse(readFileSync(resolve(ROOT, `data/tracks/${id}.v1.json`), "utf8"));
  const half = track.widthMeters / 2;

  const CELL = 25;
  const grid = new Map<string, [number, number][]>();
  for (const p of track.centerline) {
    const k = `${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`;
    (grid.get(k) ?? grid.set(k, []).get(k)!).push(p as [number, number]);
  }
  /** Within `d` metres of the track edge. */
  const near = (x: number, y: number, d: number) => {
    const r = half + d;
    const gx = Math.floor(x / CELL);
    const gy = Math.floor(y / CELL);
    const n = Math.ceil(r / CELL);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) for (const [px, py] of grid.get(`${gx + a},${gy + b}`) ?? []) if ((px - x) ** 2 + (py - y) ** 2 < r * r) return true;
    return false;
  };
  const anyNear = (flat: number[], d: number) => {
    for (let i = 0; i < flat.length; i += 2) if (near(flat[i], flat[i + 1], d)) return true;
    return false;
  };
  /** Cut a polyline to the runs that stay near the track. */
  const cut = (flat: number[], d: number): number[][] => {
    const runs: number[][] = [];
    let run: number[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      if (near(flat[i], flat[i + 1], d)) run.push(flat[i], flat[i + 1]);
      else {
        if (run.length >= 4) runs.push(run);
        run = [];
      }
    }
    if (run.length >= 4) runs.push(run);
    return runs;
  };

  const before = JSON.stringify(data).length;
  data.buildings = data.buildings.filter((b: { p: number[]; k?: string }) => anyNear(b.p, b.k ? KEEP.standOrPits : KEEP.building));
  const trees: number[] = [];
  for (let i = 0; i < data.trees.length; i += 2) if (near(data.trees[i], data.trees[i + 1], KEEP.tree)) trees.push(data.trees[i], data.trees[i + 1]);
  data.trees = trees;
  data.roads = data.roads.flatMap((r: { w: number; p: number[] }) => cut(r.p, KEEP.road).map((p) => ({ w: r.w, p })));
  data.rail = [];
  for (const k of ["urban", "farm", "parking"]) data.areas[k] = data.areas[k].filter((poly: number[]) => anyNear(poly, KEEP.urbanArea));
  data.landmarks = data.landmarks.filter((l: { x: number; y: number }) => near(l.x, l.y, KEEP.landmark));
  const json = JSON.stringify(data);
  writeFileSync(resolve(dir, f), json);
  console.log(`${id.padEnd(14)} ${(before / 1024).toFixed(0).padStart(4)} kB -> ${(json.length / 1024).toFixed(0).padStart(4)} kB  buildings ${data.buildings.length}  trees ${trees.length / 2}  roads ${data.roads.length}`);
}
