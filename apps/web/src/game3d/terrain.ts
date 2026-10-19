/**
 * The ground under a corner: real elevation on a 20 m grid, 2.6 km across, centred on the apex (built by
 * tools/track-builder/src/build-terrain.ts from Terrain Tiles on AWS), with the road laid flat on the lap's smoothed
 * height profile. Heights in metres relative to the apex; outside the grid, the nearest edge.
 */
export const TERRAIN_STEP = 20;
export const TERRAIN_N = 131;
const HALF = ((TERRAIN_N - 1) / 2) * TERRAIN_STEP;

const files = import.meta.glob<string>("../game/terrain/*.bin", { query: "?url", import: "default" });

export class Terrain {
  constructor(private readonly dm: Int16Array) {}

  /** The ground's height (m) at a point (corner metres). */
  at(x: number, y: number): number {
    const fx = Math.min(TERRAIN_N - 1.001, Math.max(0, (x + HALF) / TERRAIN_STEP));
    const fy = Math.min(TERRAIN_N - 1.001, Math.max(0, (y + HALF) / TERRAIN_STEP));
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const u = fx - i;
    const v = fy - j;
    const h = (a: number, b: number) => this.dm[b * TERRAIN_N + a] / 10;
    return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
  }

  /** The mean height round the grid's edge: where the world beyond it sits. */
  edgeMean(): number {
    let s = 0;
    let n = 0;
    for (let k = 0; k < TERRAIN_N; k++)
      for (const [i, j] of [
        [k, 0],
        [k, TERRAIN_N - 1],
        [0, k],
        [TERRAIN_N - 1, k],
      ]) {
        s += this.dm[j * TERRAIN_N + i] / 10;
        n++;
      }
    return s / n;
  }

  static half = HALF;
}

/** A corner's ground, or null where none was built (the scene is then flat). */
export async function loadTerrain(cornerId: string): Promise<Terrain | null> {
  const load = files[`../game/terrain/${cornerId}.bin`];
  if (!load) return null;
  const url = await load();
  const buf = await (await fetch(url)).arrayBuffer();
  return new Terrain(new Int16Array(buf));
}

/**
 * The road is laid flat on the lap's height profile up to `flatIn` from its centre line, real terrain from `flatTo`.
 * A street circuit runs between buildings with the hillside behind them: there the slope starts further out.
 */
const FLAT = { circuit: [26, 60], street: [45, 140] } as const;

/**
 * The ground the scene stands on: the terrain, except along the circuit, where it is the lap's smoothed height
 * profile flat across the road (a 20 m grid can't hold a narrow street between steep sides), blending back to the
 * terrain beyond the run-off. `line` is the circuit's centre line (corner metres), in lap order.
 */
export function groundOf(terrain: Terrain, line: [number, number][], street = false): (x: number, y: number) => number {
  const [FLAT_IN, FLAT_TO] = FLAT[street ? "street" : "circuit"];
  const near = line.filter(([x, y]) => Math.abs(x) < Terrain.half + 200 && Math.abs(y) < Terrain.half + 200);
  if (!near.length) return (x, y) => terrain.at(x, y);
  // the profile along the line, smoothed again over about 60 m (the grid was already flat along it)
  const raw = line.map(([x, y]) => terrain.at(x, y));
  const n = raw.length;
  const w = 12;
  const profile = raw.map((_, i) => {
    let s = 0;
    for (let k = -w; k <= w; k++) s += raw[(i + k + n) % n];
    return s / (2 * w + 1);
  });
  const CELL = 30;
  const cells = new Map<string, number[]>();
  line.forEach(([x, y], i) => {
    if (Math.abs(x) > Terrain.half + 200 || Math.abs(y) > Terrain.half + 200) return;
    const key = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
    const l = cells.get(key);
    if (l) l.push(i);
    else cells.set(key, [i]);
  });
  return (x, y) => {
    const gx = Math.floor(x / CELL);
    const gy = Math.floor(y / CELL);
    let best = -1;
    let bd = FLAT_TO * FLAT_TO;
    const r = Math.ceil(FLAT_TO / CELL);
    for (let a = -r; a <= r; a++)
      for (let b = -r; b <= r; b++)
        for (const i of cells.get(`${gx + a},${gy + b}`) ?? []) {
          const d = (line[i][0] - x) ** 2 + (line[i][1] - y) ** 2;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
    const t0 = terrain.at(x, y);
    if (best < 0) return t0;
    // the height along the line between its points, not the nearest point's: a step at every point would shake the
    // car (and the road) as it passes them
    let h = profile[best];
    let dist = Math.sqrt(bd);
    for (const j of [(best - 1 + n) % n, (best + 1) % n]) {
      const [ax, ay] = line[best];
      const ex = line[j][0] - ax;
      const ey = line[j][1] - ay;
      const len2 = ex * ex + ey * ey;
      if (!len2) continue;
      const u = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / len2));
      const d = Math.hypot(x - ax - ex * u, y - ay - ey * u);
      if (u > 0 && d <= dist + 1e-6) {
        dist = d;
        h = profile[best] * (1 - u) + profile[j] * u;
      }
    }
    const t = Math.min(1, Math.max(0, (FLAT_TO - dist) / (FLAT_TO - FLAT_IN)));
    const k = t * t * (3 - 2 * t);
    return t0 * (1 - k) + h * k;
  };
}
