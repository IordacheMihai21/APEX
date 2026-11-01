/**
 * The skyline round each corner of Make the corner: in every direction, how high the hills and mountains stand above
 * the horizon as seen from the apex, from real elevation (Terrain Tiles on AWS, as build-terrain.ts, at a coarser zoom).
 * Two layers, so the far mountains fade behind the nearer hills: the highest point between 1.3 and 7 km (just past the
 * terrain the scene already has), and between 7 and 45 km. Angles allow for the earth's curvature (and the usual
 * refraction), and the sea counts as sea level.
 *
 * Output: apps/web/src/game/skyline/<corner id>.json: { near, far }, 360 elevation angles each in hundredths of a
 * degree, one per degree of bearing clockwise from north.
 * Usage: npm run build:skyline (downloaded tiles are kept in data/raw/terrain/)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { circuitFrame, loadFeatures } from "./import-geojson";
import { REAL_CIRCUITS } from "./real-circuits";

const Z = 10;
const EARTH_R = 6_371_000;
/** the light bends a little round the earth, so far hills stand higher than geometry alone says */
const REFRACTION = 0.13;
/** the camera's eye above the road (m) */
const EYE = 3;
const LAYERS = { near: [1300, 7000, 100], far: [7000, 45000, 250] } as const;

const root = resolve(import.meta.dirname, "../../..");
const cacheDir = resolve(root, "data/raw/terrain");
const outDir = resolve(root, "apps/web/src/game/skyline");
mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

// ---- elevation from Terrarium tiles: height = R * 256 + G + B / 256 - 32768
const tiles = new Map<string, Promise<Float32Array>>();
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
async function elevation(lon: number, lat: number): Promise<number> {
  const n = 2 ** Z * 256;
  const s = Math.sin((lat * Math.PI) / 180);
  const px = ((lon + 180) / 360) * n;
  const py = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
  const x = Math.floor(px);
  const y = Math.floor(py);
  return Math.max(0, (await tile(Math.floor(x / 256), Math.floor(y / 256)))[(y % 256) * 256 + (x % 256)]);
}

const features = loadFeatures(resolve(root, "data/raw/bacinger/f1-circuits.geojson"));
const index = JSON.parse(readFileSync(resolve(root, "apps/web/src/game/corners/index.json"), "utf8")) as { id: string; trackId: string }[];

for (const { id, trackId } of index) {
  const rc = REAL_CIRCUITS.find((r) => r.id === trackId)!;
  const frame = circuitFrame(features.get(rc.sourceId)!, rc);
  const { origin } = JSON.parse(readFileSync(resolve(root, `apps/web/src/game/corners/${id}.json`), "utf8")) as { origin: [number, number] };
  const [lon0, lat0] = frame.toLonLat(...origin);
  const eye = (await elevation(lon0, lat0)) + EYE;
  const mPerLon = (Math.PI / 180) * EARTH_R * Math.cos((lat0 * Math.PI) / 180);
  const mPerLat = (Math.PI / 180) * EARTH_R;
  const out: Record<string, number[]> = {};
  for (const [layer, [from, to, step]] of Object.entries(LAYERS)) {
    out[layer] = await Promise.all(
      Array.from({ length: 360 }, async (_, b) => {
        const dx = Math.sin((b * Math.PI) / 180);
        const dy = Math.cos((b * Math.PI) / 180);
        let best = -Infinity;
        for (let d = from; d <= to; d += step) {
          const h = await elevation(lon0 + (dx * d) / mPerLon, lat0 + (dy * d) / mPerLat);
          const drop = ((1 - REFRACTION) * d * d) / (2 * EARTH_R);
          best = Math.max(best, Math.atan2(h - drop - eye, d));
        }
        return Math.round((best * 180 * 100) / Math.PI);
      }),
    );
  }
  writeFileSync(resolve(outDir, `${id}.json`), `${JSON.stringify(out)}\n`);
  const peak = (a: number[]) => (Math.max(...a) / 100).toFixed(1);
  console.log(`${id}: near up to ${peak(out.near)}°, far up to ${peak(out.far)}°`);
}
