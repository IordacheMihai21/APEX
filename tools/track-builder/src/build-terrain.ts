/**
 * The ground under each corner of Make the corner: real elevation (Terrain Tiles on AWS, from SRTM, 3DEP and others;
 * see https://github.com/tilezen/joerd/blob/master/docs/attribution.md) on a 20 m grid, 2.6 km across, centred on
 * the corner's apex. Satellite elevation is a few metres noisy, so the road doesn't follow it directly: the whole
 * lap's height profile is smoothed over about 120 m and the ground across the track is laid flat at that height,
 * blending back to the real terrain beyond the run-off. Heights are decimetres relative to the apex, as Int16.
 *
 * Output: apps/web/src/game/terrain/<corner id>.bin (131 x 131, row by row from the south-west, x east, y north).
 * Usage: npm run build:terrain (downloaded tiles are kept in data/raw/terrain/)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import type { GameTrack } from "@apex/engine";
import { circuitFrame, loadFeatures } from "./import-geojson";
import { REAL_CIRCUITS } from "./real-circuits";

export const TERRAIN_STEP = 20;
export const TERRAIN_N = 131;
const HALF = ((TERRAIN_N - 1) / 2) * TERRAIN_STEP;
const Z = 14;
/** the road is flat on its profile up to here from the centre line (m), real terrain from FLAT_TO on */
const FLAT_IN = 24;
const FLAT_TO = 75;

const root = resolve(import.meta.dirname, "../../..");
const cacheDir = resolve(root, "data/raw/terrain");
const outDir = resolve(root, "apps/web/src/game/terrain");
mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

// ---- elevation from Terrarium tiles: height = R * 256 + G + B / 256 - 32768
const tiles = new Map<string, Promise<Float32Array>>();
/** One tile's heights; each tile is fetched (or read from the cache) once, however many points ask for it at once. */
function tile(x: number, y: number): Promise<Float32Array> {
  const key = `${x}/${y}`;
  let p = tiles.get(key);
  if (!p) tiles.set(key, (p = loadTile(x, y)));
  return p;
}
async function loadTile(x: number, y: number): Promise<Float32Array> {
  const file = resolve(cacheDir, `${Z}-${x}-${y}.png`);
  if (!existsSync(file)) {
    const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`);
    if (!r.ok) throw new Error(`tile ${x}/${y}: ${r.status}`);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  const { data } = await sharp(readFileSync(file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const h = new Float32Array(256 * 256);
  for (let i = 0; i < h.length; i++) h[i] = data[i * 3] * 256 + data[i * 3 + 1] + data[i * 3 + 2] / 256 - 32768;
  return h;
}
/** Web Mercator pixel position of a lon/lat at zoom Z */
function pixel(lon: number, lat: number): [number, number] {
  const n = 2 ** Z * 256;
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
}
async function elevation(lon: number, lat: number): Promise<number> {
  const [px, py] = pixel(lon, lat);
  const x0 = Math.floor(px - 0.5);
  const y0 = Math.floor(py - 0.5);
  const fx = px - 0.5 - x0;
  const fy = py - 0.5 - y0;
  const at = async (x: number, y: number) => (await tile(Math.floor(x / 256), Math.floor(y / 256)))[(y % 256) * 256 + (x % 256)];
  const [a, b, c, d] = await Promise.all([at(x0, y0), at(x0 + 1, y0), at(x0, y0 + 1), at(x0 + 1, y0 + 1)]);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

const features = loadFeatures(resolve(root, "data/raw/bacinger/f1-circuits.geojson"));
const index = JSON.parse(readFileSync(resolve(root, "apps/web/src/game/corners/index.json"), "utf8")) as { id: string; trackId: string }[];
const byTrack = new Map<string, string[]>();
for (const c of index) byTrack.set(c.trackId, [...(byTrack.get(c.trackId) ?? []), c.id]);

for (const [trackId, cornerIds] of byTrack) {
  const rc = REAL_CIRCUITS.find((r) => r.id === trackId)!;
  const frame = circuitFrame(features.get(rc.sourceId)!, rc);
  const track: GameTrack = JSON.parse(readFileSync(resolve(root, `data/tracks/${trackId}.v1.json`), "utf8"));
  const cl = track.centerline;
  const N = cl.length;
  const step = track.lengthMeters / N;

  // the lap's height profile, smoothed round the lap (Gaussian, sigma 40 m)
  // satellite heights are of the surface: roofs and treetops. The road is the lowest point round it: the least of a
  // few samples within 15 m
  const around = [[0, 0], [15, 0], [-15, 0], [0, 15], [0, -15], [10, 10], [-10, 10], [10, -10], [-10, -10]];
  const raw = await Promise.all(cl.map(async ([x, y]) => Math.min(...(await Promise.all(around.map(([a, b]) => elevation(...frame.toLonLat(x + a, y + b))))))));
  const sigma = 40 / step;
  const w = Math.ceil(3 * sigma);
  const kernel = Array.from({ length: 2 * w + 1 }, (_, k) => Math.exp(-((k - w) ** 2) / (2 * sigma * sigma)));
  const ksum = kernel.reduce((a, b) => a + b, 0);
  const profile = raw.map((_, i) => kernel.reduce((a, kv, k) => a + kv * raw[(i + k - w + N) % N], 0) / ksum);

  // the centre line in 25 m cells, for the nearest point of the track
  const CELL = 25;
  const cells = new Map<string, number[]>();
  cl.forEach(([x, y], i) => {
    const key = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
    cells.set(key, [...(cells.get(key) ?? []), i]);
  });
  const nearest = (x: number, y: number): [number, number] => {
    let best = -1;
    let bd = Infinity;
    const gx = Math.floor(x / CELL);
    const gy = Math.floor(y / CELL);
    for (let r = 1; r <= 4 && best < 0; r++)
      for (let a = -r; a <= r; a++)
        for (let b = -r; b <= r; b++)
          for (const i of cells.get(`${gx + a},${gy + b}`) ?? []) {
            const d = (cl[i][0] - x) ** 2 + (cl[i][1] - y) ** 2;
            if (d < bd) {
              bd = d;
              best = i;
            }
          }
    return [best, Math.sqrt(bd)];
  };

  for (const id of cornerIds) {
    const corner = JSON.parse(readFileSync(resolve(root, `apps/web/src/game/corners/${id}.json`), "utf8")) as { origin: [number, number] };
    const [ox, oy] = corner.origin;
    const grid = new Float32Array(TERRAIN_N * TERRAIN_N);
    for (let j = 0; j < TERRAIN_N; j++)
      for (let i = 0; i < TERRAIN_N; i++) grid[j * TERRAIN_N + i] = await elevation(...frame.toLonLat(ox - HALF + i * TERRAIN_STEP, oy - HALF + j * TERRAIN_STEP));
    // the ground round each point: the lower quarter of a 5 x 5 neighbourhood (the satellite sees roofs and treetops)
    const soft = grid.map((_, k) => {
      const i = k % TERRAIN_N;
      const j = Math.floor(k / TERRAIN_N);
      const v: number[] = [];
      for (let b = -2; b <= 2; b++)
        for (let a = -2; a <= 2; a++) {
          const ii = i + a;
          const jj = j + b;
          if (ii < 0 || jj < 0 || ii >= TERRAIN_N || jj >= TERRAIN_N) continue;
          v.push(grid[jj * TERRAIN_N + ii]);
        }
      v.sort((p, q) => p - q);
      return v[Math.floor(v.length / 4)];
    });
    const [apexI] = nearest(ox, oy);
    const zero = profile[apexI];
    const out = new Int16Array(TERRAIN_N * TERRAIN_N);
    for (let j = 0; j < TERRAIN_N; j++)
      for (let i = 0; i < TERRAIN_N; i++) {
        const k = j * TERRAIN_N + i;
        const [ni, d] = nearest(ox - HALF + i * TERRAIN_STEP, oy - HALF + j * TERRAIN_STEP);
        const t = ni < 0 ? 0 : Math.min(1, Math.max(0, (FLAT_TO - d) / (FLAT_TO - FLAT_IN)));
        const blend = t * t * (3 - 2 * t);
        const h = soft[k] * (1 - blend) + (ni < 0 ? soft[k] : profile[ni]) * blend;
        out[k] = Math.round((h - zero) * 10);
      }
    writeFileSync(resolve(outDir, `${id}.bin`), Buffer.from(out.buffer));
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of out) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    console.log(`${id}: ${(lo / 10).toFixed(0)} to +${(hi / 10).toFixed(0)} m around the apex`);
  }
}
