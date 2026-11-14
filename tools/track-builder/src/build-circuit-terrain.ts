/**
 * The ground under a whole circuit, for the 3D lap: real elevation (./elevation.ts) on a 5 m grid over the circuit's
 * scenery box and 500 m beyond it.
 *
 * Satellite heights are of the surface (roofs and treetops) and a few metres noisy, so:
 * - the ground is sampled on a 20 m grid, each point taking the lower quarter of its 5 x 5 neighbourhood, and the 5 m
 *   grid is interpolated from that;
 * - the road follows the lap's height profile, smoothed round the lap (Gaussian, sigma 40 m), each point the lowest of
 *   a few samples within 15 m;
 * - the ground across the track is laid flat at the profile's height out to FLAT_IN from the centre line, blending
 *   back to the real terrain by FLAT_TO.
 *
 * Output:
 * - apps/web/src/game/circuit3d/<id>.bin: Int16 decimetres relative to the start line, row by row from the south-west
 *   (x east, y north, track metres);
 * - <id>.json: the grid (x0, y0, step, nx, ny) and the road's height at every centre-line point (decimetres).
 * Usage: npm run build:circuit-terrain -- spa
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GameTrack } from "@apex/engine";
import { elevation } from "./elevation";
import { circuitFrame, loadFeatures } from "./import-geojson";
import { REAL_CIRCUITS } from "./real-circuits";

const STEP = 5;
const COARSE = 20;
const MARGIN = 500;
const FLAT_IN = 24;
const FLAT_TO = 75;

const root = resolve(import.meta.dirname, "../../..");
const outDir = resolve(root, "apps/web/src/game/circuit3d");
mkdirSync(outDir, { recursive: true });
const features = loadFeatures(resolve(root, "data/raw/bacinger/f1-circuits.geojson"));

const ids = process.argv.slice(2);
if (!ids.length) throw new Error("usage: build:circuit-terrain -- <track id> [...]");

for (const id of ids) {
  const rc = REAL_CIRCUITS.find((r) => r.id === id);
  if (!rc) throw new Error(`no real circuit ${id}`);
  const frame = circuitFrame(features.get(rc.sourceId)!, rc);
  const ll = (x: number, y: number) => frame.toLonLat(x, y);
  const track: GameTrack = JSON.parse(readFileSync(resolve(root, `data/tracks/${id}.v1.json`), "utf8"));
  const scenery = JSON.parse(readFileSync(resolve(root, `data/scenery/${id}.json`), "utf8")) as { box: [number, number, number, number] };
  const cl = track.centerline;
  const N = cl.length;
  const step = track.lengthMeters / N;

  // the lap's height profile
  const around = [[0, 0], [15, 0], [-15, 0], [0, 15], [0, -15], [10, 10], [-10, 10], [10, -10], [-10, -10]];
  const raw = await Promise.all(cl.map(async ([x, y]) => Math.min(...(await Promise.all(around.map(([a, b]) => elevation(...ll(x + a, y + b))))))));
  const sigma = 40 / step;
  const w = Math.ceil(3 * sigma);
  const kernel = Array.from({ length: 2 * w + 1 }, (_, k) => Math.exp(-((k - w) ** 2) / (2 * sigma * sigma)));
  const ksum = kernel.reduce((a, b) => a + b, 0);
  const profile = raw.map((_, i) => kernel.reduce((a, kv, k) => a + kv * raw[(i + k - w + N) % N], 0) / ksum);
  const zero = profile[0];

  // the grid
  const [bx0, by0, bx1, by1] = scenery.box;
  const x0 = Math.floor((bx0 - MARGIN) / COARSE) * COARSE;
  const y0 = Math.floor((by0 - MARGIN) / COARSE) * COARSE;
  const cnx = Math.ceil((bx1 + MARGIN - x0) / COARSE) + 1;
  const cny = Math.ceil((by1 + MARGIN - y0) / COARSE) + 1;
  const coarse = new Float32Array(cnx * cny);
  for (let j = 0; j < cny; j++) {
    const row = await Promise.all(Array.from({ length: cnx }, (_, i) => elevation(...ll(x0 + i * COARSE, y0 + j * COARSE))));
    coarse.set(row, j * cnx);
  }
  const soft = coarse.map((_, k) => {
    const i = k % cnx;
    const j = Math.floor(k / cnx);
    const v: number[] = [];
    for (let b = -2; b <= 2; b++)
      for (let a = -2; a <= 2; a++) {
        const ii = i + a;
        const jj = j + b;
        if (ii >= 0 && jj >= 0 && ii < cnx && jj < cny) v.push(coarse[jj * cnx + ii]);
      }
    v.sort((p, q) => p - q);
    return v[Math.floor(v.length / 4)];
  });
  const softAt = (x: number, y: number) => {
    const fx = Math.min(cnx - 1.001, Math.max(0, (x - x0) / COARSE));
    const fy = Math.min(cny - 1.001, Math.max(0, (y - y0) / COARSE));
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const u = fx - i;
    const v = fy - j;
    const h = (a: number, b: number) => soft[b * cnx + a];
    return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
  };

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
    for (let a = -4; a <= 4; a++)
      for (let b = -4; b <= 4; b++)
        for (const i of cells.get(`${gx + a},${gy + b}`) ?? []) {
          const d = (cl[i][0] - x) ** 2 + (cl[i][1] - y) ** 2;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
    return [best, Math.sqrt(bd)];
  };

  const nx = Math.round(((cnx - 1) * COARSE) / STEP) + 1;
  const ny = Math.round(((cny - 1) * COARSE) / STEP) + 1;
  const out = new Int16Array(nx * ny);
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * STEP;
      const y = y0 + j * STEP;
      const g = softAt(x, y);
      const [ni, d] = nearest(x, y);
      const t = ni < 0 ? 0 : Math.min(1, Math.max(0, (FLAT_TO - d) / (FLAT_TO - FLAT_IN)));
      const blend = t * t * (3 - 2 * t);
      const h = g * (1 - blend) + (ni < 0 ? g : profile[ni]) * blend;
      const v = Math.round((h - zero) * 10);
      out[j * nx + i] = v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  writeFileSync(resolve(outDir, `${id}.bin`), Buffer.from(out.buffer));
  writeFileSync(
    resolve(outDir, `${id}.json`),
    JSON.stringify({ x0, y0, step: STEP, nx, ny, road: profile.map((p) => Math.round((p - zero) * 10)) }),
  );
  const pl = Math.min(...profile) - zero;
  const ph = Math.max(...profile) - zero;
  console.log(`${id}: ${nx} x ${ny} at ${STEP} m, ground ${(lo / 10).toFixed(0)} to +${(hi / 10).toFixed(0)} m, road ${pl.toFixed(1)} to +${ph.toFixed(1)} m from the start line`);
}
