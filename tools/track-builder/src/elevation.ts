/**
 * Real elevation from Terrain Tiles on AWS (Terrarium encoding, zoom 14, about 7 m a pixel at these latitudes; from
 * SRTM, 3DEP and others, see https://github.com/tilezen/joerd/blob/master/docs/attribution.md). Downloaded tiles are
 * kept in data/raw/terrain/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const Z = 14;
const root = resolve(import.meta.dirname, "../../..");
const cacheDir = resolve(root, "data/raw/terrain");
mkdirSync(cacheDir, { recursive: true });

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
export async function elevation(lon: number, lat: number): Promise<number> {
  const [px, py] = pixel(lon, lat);
  const x0 = Math.floor(px - 0.5);
  const y0 = Math.floor(py - 0.5);
  const fx = px - 0.5 - x0;
  const fy = py - 0.5 - y0;
  const at = async (x: number, y: number) => (await tile(Math.floor(x / 256), Math.floor(y / 256)))[(y % 256) * 256 + (x % 256)];
  const [a, b, c, d] = await Promise.all([at(x0, y0), at(x0 + 1, y0), at(x0, y0 + 1), at(x0 + 1, y0 + 1)]);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

