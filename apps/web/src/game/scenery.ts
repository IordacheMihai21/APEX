import * as M from "./materials";
import { type GameTrack, type PreparedTrack, curvature } from "@apex/engine";
import { type SceneryData, Surroundings } from "./surroundings";

/**
 * Aerial-view circuit scenery for Canvas 2D.
 *
 * Everything static is built once: geometry as world-space Path2D objects,
 * surfaces as small procedural textures used as world-anchored patterns.
 * A frame only fills/strokes cached paths, which keeps it cheap on phones.
 *
 * Layer order (bottom → top): grass + mowing stripes → the real
 * surroundings from OpenStreetMap (land cover, water, roads, pit lane,
 * buildings, trees; surroundings.ts) → tarmac run-off → gravel traps →
 * barriers with TecPro, catch fencing and marshal posts → landmarks → track
 * asphalt → edge lines → kerbs → start line + grid boxes. The car sprite
 * lives in car.ts.
 */

export type CircuitStyle = "permanent" | "street";

const PALETTE = {
  grass: "#3b5a2f",
  grassLight: "#456838",
  gravel: "#b3a284",
  runoff: "#53585e",
  asphalt: "#2e3136",
  paint: "#f2f2ee",
  kerbRed: "#e5332a",
  kerbWhite: "#f2f2ee",
  barrier: "#c3c7cc",
  tecproRed: "#c8312b",
  tecproBlue: "#2f5fae",
  fence: "rgba(205,210,215,0.55)",
  marshal: "#e9e7e2",
  wall: "#9aa0a6",
  concrete: "#585752",
};

/** Deterministic PRNG so textures look the same on every load. */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!];
}

/** Per-pixel noise around a base colour, plus sparse speckles (aggregate, pebbles, blades). */
export function noiseTexture(size: number, base: [number, number, number], amp: number, speckle: { rate: number; light: number; dark: number }, seed: number) {
  const [c, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  const r = rng(seed);
  // low-frequency blotches: a few soft value offsets on a coarse grid
  const grid = 8;
  const coarse = Array.from({ length: grid * grid }, () => (r() - 0.5) * amp * 1.2);
  const lf = (x: number, y: number) => {
    const gx = (x / size) * grid;
    const gy = (y / size) * grid;
    const x0 = Math.floor(gx) % grid;
    const y0 = Math.floor(gy) % grid;
    const x1 = (x0 + 1) % grid;
    const y1 = (y0 + 1) % grid;
    const fx = gx - Math.floor(gx);
    const fy = gy - Math.floor(gy);
    const a = coarse[y0 * grid + x0] * (1 - fx) + coarse[y0 * grid + x1] * fx;
    const b = coarse[y1 * grid + x0] * (1 - fx) + coarse[y1 * grid + x1] * fx;
    return a * (1 - fy) + b * fy;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let v = (r() - 0.5) * amp + lf(x, y);
      const s = r();
      if (s < speckle.rate) v += speckle.light;
      else if (s < speckle.rate * 2) v -= speckle.dark;
      const i = (y * size + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, base[0] + v));
      img.data[i + 1] = Math.max(0, Math.min(255, base[1] + v));
      img.data[i + 2] = Math.max(0, Math.min(255, base[2] + v * 0.9));
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface Textures {
  concrete: CanvasPattern;
  asphalt: CanvasPattern;
  runoff: CanvasPattern;
  grass: CanvasPattern;
  stripes: CanvasPattern;
  gravel: CanvasPattern;
  macro: CanvasPattern;
  clouds: CanvasPattern;
  /** wet days only: sky reflected in the water film on the track */
  sheen: CanvasPattern | null;
}

/** The circuit's own materials, as calls into the memoised generators (so they can also be made ahead, see prewarm.ts). */
export function trackMaterials(wet: boolean) {
  return {
    asphalt: () => M.asphalt(hex(PALETTE.asphalt), 51, wet),
    runoff: () => M.asphalt([78, 82, 88], 52, wet),
    grass: () => M.grass(41, wet),
    gravel: () => M.gravel(61, wet),
    concrete: () => M.concrete(hex(PALETTE.concrete), 71),
    macro: () => M.macro(),
    clouds: () => M.cloudShadows(),
    sheen: () => (wet ? M.water([150, 160, 172], 83, true) : null),
  };
}

function makeTextures(ctx: CanvasRenderingContext2D, wet: boolean): Textures {
  const pattern = (src: HTMLCanvasElement, metresPerTile: number, angle = 0) => {
    const p = ctx.createPattern(src, "repeat")!;
    const k = metresPerTile / src.width;
    p.setTransform(new DOMMatrix().rotate(angle).scale(k, k));
    return p;
  };
  const m = trackMaterials(wet);
  const asphalt = m.asphalt();
  const runoff = m.runoff();
  const grass = m.grass();
  const gravel = m.gravel();
  const concrete = m.concrete();
  // mowing stripes: one light band per tile, rotated in world space
  const [st, sctx] = canvas(64);
  sctx.fillStyle = "rgba(255,255,255,0)";
  sctx.fillRect(0, 0, 64, 64);
  sctx.fillStyle = "rgba(96,140,72,0.075)";
  sctx.fillRect(0, 0, 32, 64);
  return {
    concrete: pattern(concrete, 12),
    asphalt: pattern(asphalt, 9),
    runoff: pattern(runoff, 11),
    grass: pattern(grass, 20),
    stripes: pattern(st, 30, 32),
    gravel: pattern(gravel, 10),
    macro: pattern(m.macro(), 700, 17),
    clouds: pattern(m.clouds(), 1600),
    sheen: wet ? pattern(m.sheen()!, 30, 64) : null,
  };
}

/** The track's asphalt as a data URL, so DOM surfaces (the hub) share the canvas material. */
export function asphaltDataUrl(): string {
  return noiseTexture(256, hex(PALETTE.asphalt), 10, { rate: 0.02, light: 26, dark: 14 }, 11).toDataURL("image/png");
}

const rngLocal = (seed: number) => rng(seed);

/** Smooth a per-index profile with a circular moving average. */
function smooth(a: Float64Array, half: number): Float64Array {
  const n = a.length;
  const out = new Float64Array(n);
  let sum = 0;
  for (let o = -half; o <= half; o++) sum += a[(o + n) % n];
  for (let i = 0; i < n; i++) {
    out[i] = sum / (2 * half + 1);
    sum += a[(i + half + 1) % n] - a[(i - half + n) % n];
  }
  return out;
}

export class Scenery {
  private tex: Textures | null = null;
  private readonly W: number;
  private readonly centre = new Path2D();
  private readonly paved = new Path2D();
  private readonly gravel = new Path2D();
  private readonly barriers = new Path2D();
  private readonly kerbRed = new Path2D();
  private readonly kerbWhite = new Path2D();
  private readonly grid = new Path2D();
  private readonly tecRed = new Path2D();
  private readonly tecBlue = new Path2D();
  private readonly tecTop = new Path2D();
  private readonly railPosts = new Path2D();
  // surface detail: resurfaced patches, paving seams, sealant, lock-up marks, run-wide marks
  private readonly patches = new Path2D();
  private readonly seams = new Path2D();
  private readonly sealant = new Path2D();
  private readonly lockups = new Path2D();
  private readonly runwide = new Path2D();
  // trackside: astroturf behind exit kerbs, brake marker boards, painted grid numbers
  private readonly astro = new Path2D();
  private readonly boards = new Path2D();
  private readonly boardStripes = new Path2D();
  private readonly gridNumbers: { x: number; y: number; a: number; n: number }[] = [];
  private readonly joints = new Path2D();
  private readonly posts = new Path2D();
  private readonly marshals = new Path2D();
  private readonly flags = new Path2D();
  private readonly world: Surroundings | null;
  private readonly bounds: [number, number, number, number];
  /** Standing water for wet days, near the track edges (built once). */
  private readonly puddles = new Path2D();

  constructor(
    private pt: PreparedTrack,
    private track: GameTrack,
    private style: CircuitStyle,
    /** Corners that slow the car (get gravel traps and wide run-off). */
    private significant: Set<string>,
    /** The real surroundings (OpenStreetMap), when available for this circuit. */
    osm: SceneryData | null = null,
  ) {
    this.world = osm ? new Surroundings(osm, track.id, track.centerline.filter((_, i) => i % 10 === 0) as [number, number][]) : null;
    this.W = track.widthMeters;
    track.centerline.forEach(([x, y], i) => (i ? this.centre.lineTo(x, y) : this.centre.moveTo(x, y)));
    this.centre.closePath();
    const xs = track.leftBoundary.concat(track.rightBoundary);
    const pad = 400;
    this.bounds = [
      Math.min(...xs.map((p) => p[0])) - pad,
      Math.min(...xs.map((p) => p[1])) - pad,
      Math.max(...xs.map((p) => p[0])) + pad,
      Math.max(...xs.map((p) => p[1])) + pad,
    ];
    // puddles: low spots near both edges, every 25-60 m, a few metres long
    {
      const r = rng(97);
      const { n, cx, cy, nx, ny } = this.pt;
      for (let i = 0; i < n; i += Math.max(1, Math.round((25 + r() * 35) / this.pt.step))) {
        if (r() < 0.45) continue;
        const side = r() < 0.5 ? 1 : -1;
        const off = side * (this.W / 2 - 0.6 - r() * 1.4);
        const x = cx[i] + nx[i] * off;
        const y = cy[i] + ny[i] * off;
        const a = Math.atan2(cy[(i + 1) % n] - cy[i], cx[(i + 1) % n] - cx[i]);
        this.puddles.ellipse(x, y, 1.2 + r() * 2.8, 0.4 + r() * 0.8, a, 0, Math.PI * 2);
        this.puddles.closePath();
      }
    }
    this.buildRunoff();
    this.buildKerbs();
    this.buildGrid();
  }

  /** True when the real surroundings (OpenStreetMap) are drawn, so the view must credit them. */
  get hasOsm(): boolean {
    return this.world !== null;
  }

  // ---------------------------------------------------------------- geometry
  private gridIndex: Map<string, number[]> | null = null;
  private static readonly CELL = 25;

  /**
   * True if (x, y), placed `dist` metres beside centerline index i, is actually
   * closer to a different stretch of track. Used to hide barriers and tyre walls
   * that would cut across a neighbouring section (chicanes, hairpins, crossovers).
   */
  private foreign(x: number, y: number, i: number, dist: number): boolean {
    const { cx, cy, n, step } = this.pt;
    const C = Scenery.CELL;
    if (!this.gridIndex) {
      this.gridIndex = new Map();
      for (let k = 0; k < n; k++) {
        const key = `${Math.floor(cx[k] / C)},${Math.floor(cy[k] / C)}`;
        const list = this.gridIndex.get(key);
        if (list) list.push(k);
        else this.gridIndex.set(key, [k]);
      }
    }
    const own = Math.round(40 / step);
    const r = Math.ceil(dist / C) + 1;
    const gx = Math.floor(x / C);
    const gy = Math.floor(y / C);
    const limit = (dist - 0.5) * (dist - 0.5);
    for (let a = -r; a <= r; a++)
      for (let b = -r; b <= r; b++) {
        const list = this.gridIndex.get(`${gx + a},${gy + b}`);
        if (!list) continue;
        for (const k of list) {
          const di = Math.min((k - i + n) % n, (i - k + n) % n);
          if (di <= own) continue;
          const dx = cx[k] - x;
          const dy = cy[k] - y;
          if (dx * dx + dy * dy < limit) return true;
        }
      }
    return false;
  }

  /** Point at centerline index i, offset laterally by d metres (+ = left). */
  private at(i: number, d: number): [number, number] {
    const { cx, cy, nx, ny, n } = this.pt;
    const j = ((i % n) + n) % n;
    return [cx[j] + nx[j] * d, cy[j] + ny[j] * d];
  }

  /** Closed band between two lateral offset profiles over [from, from+len]. */
  private band(path: Path2D, from: number, len: number, inner: (i: number) => number, outer: (i: number) => number) {
    const a: [number, number][] = [];
    const b: [number, number][] = [];
    for (let o = 0; o <= len; o++) {
      a.push(this.at(from + o, inner(from + o)));
      b.push(this.at(from + o, outer(from + o)));
    }
    a.forEach(([x, y], k) => (k ? path.lineTo(x, y) : path.moveTo(x, y)));
    for (let k = b.length - 1; k >= 0; k--) path.lineTo(b[k][0], b[k][1]);
    path.closePath();
  }

  /**
   * Run-off per side: paved strip, gravel trap on the outside of slow
   * corners, then a barrier. Street circuits get walls tight to the track.
   */
  private buildRunoff() {
    const { n, step, cx, cy } = this.pt;
    const W2 = this.W / 2;
    const m = (metres: number) => Math.round(metres / step);
    // Offsets on the inside of a bend must stay inside its radius, or the
    // offset curve folds back on itself (loops). kappa > 0 = left-hand bend.
    const kappa = smooth(curvature(cx, cy, Math.max(1, m(8))), m(10));
    const maxOffset = (i: number, side: 1 | -1) => {
      const k = kappa[((i % n) + n) % n] * side;
      return k > 1e-4 ? 0.8 / k : Infinity;
    };
    const pavedL = new Float64Array(n);
    const pavedR = new Float64Array(n);
    const gravelL = new Float64Array(n);
    const gravelR = new Float64Array(n);
    const street = this.style === "street";
    pavedL.fill(street ? 0.6 : 3);
    pavedR.fill(street ? 0.6 : 3);
    if (!street) {
      for (const c of this.track.corners) {
        const slow = this.significant.has(c.name);
        const out = c.direction === "left" ? { paved: pavedR, gravel: gravelR } : { paved: pavedL, gravel: gravelL };
        const a = c.startIndex - m(50);
        const len = ((c.endIndex - c.startIndex + n) % n) + m(50) + m(90);
        for (let o = 0; o <= len; o++) {
          const t = o / len;
          const bell = Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.7; // widest just after the apex
          const i = (a + o + n) % n;
          out.paved[i] = Math.max(out.paved[i], 3 + (slow ? 7 : 9) * bell);
          if (slow) out.gravel[i] = Math.max(out.gravel[i], 22 * bell);
        }
      }
    }
    const pl = smooth(pavedL, m(12));
    const pr = smooth(pavedR, m(12));
    const gl = smooth(gravelL, m(12));
    const gr = smooth(gravelR, m(12));
    const clamp = (i: number, side: 1 | -1, d: number) => Math.min(d, maxOffset(i, side));
    // paved run-off (both sides, full lap)
    this.band(this.paved, 0, n, () => W2, (i) => clamp(i, 1, W2 + pl[(i + n) % n]));
    this.band(this.paved, 0, n, () => -W2, (i) => -clamp(i, -1, W2 + pr[(i + n) % n]));
    // gravel traps: bands only where present
    const traps = (g: Float64Array, p: Float64Array, side: 1 | -1) => {
      let i = 0;
      while (i < n) {
        if (g[i] < 0.5) {
          i++;
          continue;
        }
        let j = i;
        while (j < n && g[j] >= 0.5) j++;
        this.band(
          this.gravel,
          i,
          j - i,
          (k) => side * clamp(k, side, W2 + p[k % n]),
          (k) => side * clamp(k, side, W2 + p[k % n] + g[k % n]),
        );
        i = j;
      }
    };
    traps(gl, pl, 1);
    traps(gr, pr, -1);
    this.buildDetail(pl, pr, clamp);
    // barriers
    const verge = street ? 0.4 : 9;
    for (const side of [1, -1] as const) {
      const p = side > 0 ? pl : pr;
      const g = side > 0 ? gl : gr;
      let pen = false;
      for (let i = 0; i <= n; i++) {
        // continuous: the barrier sits just beyond the gravel, or at the verge distance
        const d = side * clamp(i, side, W2 + p[i % n] + Math.max(g[i % n] + 2, verge));
        const [x, y] = this.at(i, d);
        if (this.foreign(x, y, i % n, Math.abs(d))) {
          pen = false; // break the rail where it would cross another section
          continue;
        }
        if (pen) this.barriers.lineTo(x, y);
        else this.barriers.moveTo(x, y);
        pen = true;
        // guardrail posts every 2.5 m; on street circuits, joints between the 5 m concrete segments
        const every = street ? m(5) : m(2.5);
        if (i % Math.max(1, every) === 0) {
          if (street) {
            const [ax, ay] = this.at(i, d - side * 0.45);
            const [bx, by] = this.at(i, d + side * 0.45);
            this.joints.moveTo(ax, ay);
            this.joints.lineTo(bx, by);
          } else {
            const [px2, py2] = this.at(i, d + side * 0.15);
            this.railPosts.rect(px2 - 0.09, py2 - 0.09, 0.18, 0.18);
          }
        }
      }
      // energy-absorbing barrier in front of the rail where cars arrive fast: TecPro blocks,
      // alternating red and blue, behind every gravel trap (and at slow street corners)
      const block = Math.max(1, m(1.5));
      for (let i = 0, k = 0; i < n; i += block, k++) {
        const tec = g[i] >= 4 || (street && this.streetTecpro(i, side));
        if (!tec) continue;
        const back = W2 + p[i] + Math.max(g[i] + 2, verge);
        const d0 = clamp(i, side, back - 1.0);
        const d1 = clamp(i, side, back - 0.15);
        const q = [this.at(i, side * d0), this.at(i + block - 0.2, side * d0), this.at(i + block - 0.2, side * d1), this.at(i, side * d1)];
        if (this.foreign(q[0][0], q[0][1], i, d1)) continue;
        const path = k % 2 ? this.tecBlue : this.tecRed;
        q.forEach(([x, y], z) => (z ? path.lineTo(x, y) : path.moveTo(x, y)));
        path.closePath();
        // the block's top face catches the light along its track-side edge
        const h0 = this.at(i, side * (d0 + 0.12));
        const h1 = this.at(i + block - 0.2, side * (d0 + 0.12));
        this.tecTop.moveTo(h0[0], h0[1]);
        this.tecTop.lineTo(h1[0], h1[1]);
      }
      // catch-fence posts every 6 m along the rail
      for (let i = 0; i < n; i += Math.max(1, m(6))) {
        const d = side * clamp(i, side, W2 + p[i] + Math.max(g[i] + 2, verge) + 0.5);
        const [x, y] = this.at(i, d);
        if (this.foreign(x, y, i, Math.abs(d))) continue;
        this.posts.moveTo(x + 0.25, y);
        this.posts.arc(x, y, 0.25, 0, Math.PI * 2);
      }
      // marshal posts: a cabin behind the barrier on the outside of every slow corner
      for (const c of this.track.corners) {
        if (!this.significant.has(c.name) || (c.direction === "left" ? -1 : 1) !== side) continue;
        const i = (c.apexIndex + m(35)) % n;
        const d = side * clamp(i, side, W2 + p[i] + Math.max(g[i] + 2, verge) + (street ? 1.6 : 4));
        const [x, y] = this.at(i, d);
        if (this.foreign(x, y, i, Math.abs(d) + 2)) continue;
        this.marshals.rect(x - 1.3, y - 1.1, 2.6, 2.2);
        this.flags.moveTo(x + 1.5 + 0.45, y + 1.3);
        this.flags.arc(x + 1.5, y + 1.3, 0.45, 0, Math.PI * 2);
      }
    }
  }

  /**
   * Surface and trackside detail, all built once. Nothing here follows the
   * racing line (a rubbered-in line would give the puzzle away): lock-up marks
   * spread across the width of braking zones, patches and seams follow the
   * paving, and boards and turf follow each corner's geometry.
   */
  private buildDetail(pl: Float64Array, pr: Float64Array, clamp: (i: number, side: 1 | -1, d: number) => number) {
    const { n, step } = this.pt;
    const W2 = this.W / 2;
    const m = (metres: number) => Math.max(1, Math.round(metres / step));
    const r = rngLocal(this.track.id.length * 977 + n);
    const line = (path: Path2D, pts: [number, number][]) => pts.forEach(([x, y], k) => (k ? path.lineTo(x, y) : path.moveTo(x, y)));
    const street = this.style === "street";

    // paving seams: the joints between laying passes run the length of the lap
    for (const off of [-0.17, 0.17]) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i += m(4)) pts.push(this.at(i, off * this.W));
      line(this.seams, pts);
    }

    const corners = this.track.corners;
    corners.forEach((c, ci) => {
      if (!this.significant.has(c.name)) return;
      const outside: 1 | -1 = c.direction === "left" ? -1 : 1;
      const prevEnd = corners[(ci - 1 + corners.length) % corners.length].endIndex;
      const straight = (((c.startIndex - prevEnd + n) % n) * step) | 0;

      // lock-up marks in the braking zone: tyre pairs 1.6 m apart, spread across the width
      const pairs = 2 + Math.floor(r() * 3);
      for (let k = 0; k < pairs; k++) {
        const len = m(14 + r() * 26);
        const start = c.startIndex - m(10 + r() * Math.min(110, straight * 0.6));
        const d0 = (r() * 2 - 1) * (W2 - 1.8);
        const drift = (r() - 0.5) * 1.2;
        for (const tyre of [-0.8, 0.8]) {
          const pts: [number, number][] = [];
          for (let o = 0; o <= len; o += 1) pts.push(this.at(start + o, d0 + tyre + (drift * o) / len));
          line(this.lockups, pts);
        }
      }

      // a resurfaced patch over part of the braking zone (every other slow corner)
      if (ci % 2 === 0 && straight > 80) {
        const a = c.startIndex - m(20 + r() * 30);
        const len = m(18 + r() * 22);
        const edge = (r() * 0.6 - 0.1) * W2;
        const q: [number, number][] = [this.at(a, -W2 + 0.3), this.at(a + len, -W2 + 0.3), this.at(a + len, edge), this.at(a, edge)];
        line(this.patches, q);
        this.patches.closePath();
      }

      // sealant: black bitumen lines where cracks were filled
      for (let k = 0; k < 2; k++) {
        const i0 = c.startIndex - m(r() * 60);
        let d = (r() * 2 - 1) * (W2 - 1);
        const pts: [number, number][] = [];
        for (let o = 0; o < 6; o++) {
          pts.push(this.at(i0 + o * m(0.9), d));
          d += (r() - 0.5) * 0.9;
        }
        line(this.sealant, pts);
      }

      // marks where cars ran wide on the exit run-off
      if (!street) {
        const p = outside > 0 ? pl : pr;
        for (let k = 0; k < 2; k++) {
          const a = c.apexIndex + m(5 + r() * 15);
          const len = m(25 + r() * 25);
          const depth = 1 + r() * 0.9;
          for (const tyre of [0, 1.6]) {
            const pts: [number, number][] = [];
            for (let o = 0; o <= len; o++) {
              const i = (a + o) % n;
              const t = o / len;
              const out = W2 + 0.4 + Math.sin(Math.PI * t) * Math.max(0, p[i] - 1.5) * 0.6 * depth + tyre * Math.sin(Math.PI * t);
              pts.push(this.at(a + o, outside * clamp(i, outside, out)));
            }
            line(this.runwide, pts);
          }
        }

        // astroturf behind the outside exit kerb
        const from = c.apexIndex;
        const len = ((c.endIndex - c.apexIndex + n) % n) + m(26);
        this.band(this.astro, from, len, (i) => outside * clamp(i, outside, W2 + 0.9), (i) => outside * clamp(i, outside, W2 + Math.min(2.8, 0.9 + p[((i % n) + n) % n] * 0.4)));
      }

      // brake marker boards at 300, 200 and 100 m on the outside, where the straight is long enough
      if (straight > 330) {
        const p = outside > 0 ? pl : pr;
        for (const [dist, stripes] of [
          [300, 3],
          [200, 2],
          [100, 1],
        ] as const) {
          const i = (c.startIndex - m(dist) + n) % n;
          const d = W2 + Math.min(p[i], 4) + 1.6;
          const [x, y] = this.at(i, outside * clamp(i, outside, d));
          const h = this.heading(i);
          const ux = Math.cos(h);
          const uy = Math.sin(h);
          const vx = -uy;
          const vy = ux;
          // a 2.4 m board face, seen from above at an angle: 0.9 m deep along the track
          const P = (a: number, b: number): [number, number] => [x + ux * a + vx * b, y + uy * a + vy * b];
          line(this.boards, [P(-0.45, -1.2), P(0.45, -1.2), P(0.45, 1.2), P(-0.45, 1.2)]);
          this.boards.closePath();
          for (let k = 0; k < stripes; k++) {
            const b0 = -0.95 + k * 0.7;
            line(this.boardStripes, [P(-0.33, b0), P(0.33, b0), P(0.33, b0 + 0.4), P(-0.33, b0 + 0.4)]);
            this.boardStripes.closePath();
          }
        }
      }
    });
  }

  private heading(i: number): number {
    const { cx, cy, n } = this.pt;
    const a = ((i % n) + n) % n;
    const b = (a + 2) % n;
    return Math.atan2(cy[b] - cy[a], cx[b] - cx[a]);
  }

  /** Street circuits: TecPro on the outside of slow corners, from the braking zone to just past the apex. */
  private streetTecpro(i: number, side: 1 | -1): boolean {
    const { n, step } = this.pt;
    for (const c of this.track.corners) {
      if (!this.significant.has(c.name) || (c.direction === "left" ? -1 : 1) !== side) continue;
      const from = (c.startIndex - Math.round(25 / step) + n) % n;
      const len = ((c.apexIndex - from + n) % n) + Math.round(20 / step);
      if ((i - from + n) % n <= len) return true;
    }
    return false;
  }

  /** Red/white kerb blocks: inside of each corner, outside on entry and exit. */
  private buildKerbs() {
    const { n, step } = this.pt;
    const W2 = this.W / 2;
    const block = Math.max(1, Math.round(1.6 / step));
    const m = (metres: number) => Math.round(metres / step);
    const run = (from: number, len: number, side: 1 | -1) => {
      for (let o = 0, k = 0; o < len; o += block, k++) {
        const a = from + o;
        const e = from + Math.min(len, o + block);
        // taper the first and last block so kerbs start and end cleanly
        const taper = (x: number) => Math.min(1, x / m(3), (len - x) / m(3));
        const w0 = 1.1 * taper(o);
        const w1 = 1.1 * taper(Math.min(len, o + block));
        const q = [this.at(a, side * (W2 - 0.25)), this.at(e, side * (W2 - 0.25)), this.at(e, side * (W2 - 0.25 + w1)), this.at(a, side * (W2 - 0.25 + w0))];
        const path = k % 2 ? this.kerbWhite : this.kerbRed;
        q.forEach(([x, y], z) => (z ? path.lineTo(x, y) : path.moveTo(x, y)));
        path.closePath();
      }
    };
    // Full kerbs (inside + outside on entry and exit) only on corners the car
    // slows for; a gentle bend gets at most a short inside kerb at the apex.
    const { cx, cy } = this.pt;
    const k = curvature(cx, cy, Math.max(1, m(8)));
    for (const c of this.track.corners) {
      const inside: 1 | -1 = c.direction === "left" ? 1 : -1;
      if (this.significant.has(c.name)) {
        const len = (c.endIndex - c.startIndex + n) % n;
        run(c.startIndex - m(4), len + m(8), inside);
        run(c.startIndex - m(22), m(24), (-inside) as 1 | -1);
        run(c.apexIndex, ((c.endIndex - c.apexIndex + n) % n) + m(26), (-inside) as 1 | -1);
      } else if (Math.abs(k[c.apexIndex]) > 1 / 150) {
        run(c.apexIndex - m(12), m(24), inside);
      }
    }
  }

  /** Staggered grid slots behind the start line. */
  private buildGrid() {
    const { step } = this.pt;
    const W2 = this.W / 2;
    for (let slot = 0; slot < 10; slot++) {
      const back = Math.round((10 + slot * 8) / step);
      const side = slot % 2 ? -1 : 1;
      const i = -back;
      const c = side * W2 * 0.45;
      const [ax, ay] = this.at(i, c - 1.4);
      const [bx, by] = this.at(i, c + 1.4);
      const [cx, cy] = this.at(i - Math.round(1.6 / step), c - 1.4);
      const [dx, dy] = this.at(i - Math.round(1.6 / step), c + 1.4);
      this.grid.moveTo(cx, cy);
      this.grid.lineTo(ax, ay);
      this.grid.lineTo(bx, by);
      this.grid.lineTo(dx, dy);
      // the position, painted just behind its box
      const [nx2, ny2] = this.at(i - Math.round(3.4 / step), c);
      this.gridNumbers.push({ x: nx2, y: ny2, a: this.heading(i), n: slot + 1 });
    }
  }

  // ---------------------------------------------------------------- drawing
  /** Flat ground colour to clear the whole screen with before drawing. */
  get groundColor() {
    return this.style === "street" ? PALETTE.concrete : PALETTE.grass;
  }

  private _wet = false;
  /** Wet days: darker materials, a water film on the track, puddles (set before the first draw). */
  set wet(v: boolean) {
    this._wet = v;
    this.tex = null;
    if (this.world) this.world.wet = v;
  }
  get wet() {
    return this._wet;
  }

  /**
   * Cloud shadows drifting over the whole scene (cars included), as on a
   * broadcast aerial on a bright, broken-cloud day. Off on wet days: under
   * full overcast there are no cloud edges, only flat light. `t` in seconds.
   */
  drawClouds(ctx: CanvasRenderingContext2D, t: number, px: number) {
    if (this._wet || !this.tex || px > 6) return;
    const [x0, y0, x1, y1] = this.bounds;
    const drift = t * 2.2; // m/s of wind
    this.tex.clouds.setTransform(new DOMMatrix().translate(drift, drift * 0.45).scale(1600 / 256, 1600 / 256));
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = this.tex.clouds;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.globalAlpha = 1;
  }

  /** Everything under the racing line. `px` = one CSS pixel in metres. */
  draw(ctx: CanvasRenderingContext2D, px: number) {
    if (!this.tex) this.tex = makeTextures(ctx, this._wet);
    const t = this.tex;
    const detailed = px < 0.9; // small props and fine marks only when zoomed in enough to see them
    const textured = px < 5; // materials read zoomed out too
    const [x0, y0, x1, y1] = this.bounds;

    const street = this.style === "street";
    ctx.fillStyle = street ? (textured ? t.concrete : PALETTE.concrete) : textured ? t.grass : PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (detailed && !street) {
      ctx.fillStyle = t.stripes;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }

    this.world?.draw(ctx, px);

    // large-scale patchiness over all the land, as in a real aerial photo; hides tile repeats
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = t.macro;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    ctx.fillStyle = textured ? t.runoff : PALETTE.runoff;
    ctx.fill(this.paved);
    ctx.fillStyle = textured ? t.gravel : PALETTE.gravel;
    ctx.fill(this.gravel);
    if (detailed) {
      // gravel traps: a darker, raked rim where the stones meet the run-off
      ctx.strokeStyle = "rgba(70,54,36,0.55)";
      ctx.lineWidth = 0.5;
      ctx.stroke(this.gravel);
      // astroturf behind the exit kerbs: bright synthetic green with a lighter edge
      ctx.fillStyle = "#3f7d3a";
      ctx.fill(this.astro);
      ctx.strokeStyle = "rgba(170,220,150,0.35)";
      ctx.lineWidth = 0.12;
      ctx.stroke(this.astro);
      // where cars have run wide: faint rubber arcs on the run-off
      ctx.strokeStyle = "rgba(14,14,16,0.16)";
      ctx.lineWidth = 0.32;
      ctx.stroke(this.runwide);
    }

    // barrier: soft shadow then the rail (hidden when zoomed far out, where it reads as an outline)
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (px < 2.5) {
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = Math.max(1.4, 3 * px);
      ctx.stroke(this.barriers);
      ctx.strokeStyle = street ? PALETTE.wall : PALETTE.barrier;
      ctx.lineWidth = Math.max(street ? 0.9 : 0.4, 1.2 * px);
      ctx.stroke(this.barriers);
      if (detailed) {
        if (street) {
          // concrete: a lit top, and the joints between segments
          ctx.strokeStyle = "rgba(235,237,240,0.55)";
          ctx.lineWidth = 0.25;
          ctx.stroke(this.barriers);
          ctx.strokeStyle = "rgba(40,44,48,0.7)";
          ctx.lineWidth = 0.12;
          ctx.stroke(this.joints);
        } else {
          // guardrail: the W-profile reads as a bright edge over a darker band, on posts
          ctx.strokeStyle = "#7d838a";
          ctx.lineWidth = 0.16;
          ctx.stroke(this.barriers);
          ctx.fillStyle = "#3b4046";
          ctx.fill(this.railPosts);
        }
      }
      if (detailed) {
        // catch fence: the mesh reads as a faint line just behind the rail, its posts as dots
        ctx.save();
        ctx.translate(0.5, -0.5);
        ctx.strokeStyle = PALETTE.fence;
        ctx.lineWidth = Math.max(0.15, 0.6 * px);
        ctx.stroke(this.barriers);
        ctx.restore();
        ctx.fillStyle = PALETTE.wall;
        ctx.fill(this.posts);
        ctx.fillStyle = PALETTE.tecproRed;
        ctx.fill(this.tecRed);
        ctx.fillStyle = PALETTE.tecproBlue;
        ctx.fill(this.tecBlue);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 0.14;
        ctx.stroke(this.tecTop);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.save();
        ctx.translate(0.8, -0.8);
        ctx.fill(this.marshals);
        ctx.restore();
        ctx.fillStyle = PALETTE.marshal;
        ctx.fill(this.marshals);
        ctx.fillStyle = "#f5c518";
        ctx.fill(this.flags);
      }
    }
    if (px < 3) this.world?.drawLandmarks(ctx);

    // track: paint band slightly wider than the asphalt = white edge lines
    const edge = Math.max(0.3, 1.3 * px);
    ctx.strokeStyle = PALETTE.paint;
    ctx.lineWidth = this.W + 0.2;
    ctx.stroke(this.centre);
    ctx.strokeStyle = textured ? t.asphalt : PALETTE.asphalt;
    ctx.lineWidth = this.W - 2 * edge;
    ctx.stroke(this.centre);
    if (this._wet && t.sheen) {
      // a film of water: the grey sky mirrored in it, brighter than the dry surface
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = t.sheen;
      ctx.stroke(this.centre);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (detailed) {
        // standing water: darker, glossy puddles with a light rim, near the edges and in the run-off
        ctx.fillStyle = "rgba(14,18,24,0.42)";
        ctx.fill(this.puddles);
        ctx.strokeStyle = "rgba(190,205,220,0.28)";
        ctx.lineWidth = 0.12;
        ctx.stroke(this.puddles);
      }
    }

    if (detailed) {
      // the surface: paving seams, newer asphalt patches, sealant, lock-up marks
      ctx.strokeStyle = "rgba(0,0,0,0.09)";
      ctx.lineWidth = 0.08;
      ctx.stroke(this.seams);
      ctx.fillStyle = "rgba(8,9,11,0.2)";
      ctx.fill(this.patches);
      ctx.strokeStyle = "rgba(0,0,0,0.28)";
      ctx.lineWidth = 0.08;
      ctx.stroke(this.patches);
      ctx.strokeStyle = "rgba(6,6,8,0.55)";
      ctx.lineWidth = 0.1;
      ctx.stroke(this.sealant);
      ctx.strokeStyle = "rgba(10,10,12,0.2)";
      ctx.lineWidth = 0.3;
      ctx.stroke(this.lockups);
      // kerbs stand proud of the track: a thin shadow on their south-east edge
      ctx.save();
      ctx.translate(0.14, -0.14);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fill(this.kerbRed);
      ctx.fill(this.kerbWhite);
      ctx.restore();
      ctx.fillStyle = PALETTE.kerbRed;
      ctx.fill(this.kerbRed);
      ctx.fillStyle = PALETTE.kerbWhite;
      ctx.fill(this.kerbWhite);
      for (const kerb of [this.kerbRed, this.kerbWhite]) {
        ctx.save();
        ctx.clip(kerb);
        // rubber and dirt ground into the paint, densest where the cars ride it
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = t.asphalt;
        ctx.fill(kerb);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        // rounded profile: lit on the sun side, shaded on the far side
        ctx.lineWidth = 0.18;
        ctx.translate(0.07, -0.07);
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.stroke(kerb);
        ctx.translate(-0.14, 0.14);
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.stroke(kerb);
        ctx.restore();
      }
      if (this._wet) {
        // painted kerbs go glassy in the rain
        ctx.fillStyle = "rgba(200,215,230,0.12)";
        ctx.fill(this.kerbRed);
        ctx.fill(this.kerbWhite);
      }
      ctx.strokeStyle = PALETTE.paint;
      ctx.lineWidth = 0.22;
      ctx.stroke(this.grid);
      ctx.fillStyle = "rgba(242,242,238,0.85)";
      ctx.font = "800 1.5px 'Archivo Variable', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const g of this.gridNumbers) {
        ctx.save();
        ctx.translate(g.x, g.y);
        // read in the direction of travel: the top of each numeral points down the track
        ctx.rotate(g.a - Math.PI / 2);
        ctx.scale(1, -1);
        ctx.fillText(String(g.n), 0, 0);
        ctx.restore();
      }
      // brake marker boards with their shadows
      ctx.save();
      ctx.translate(0.5, -0.5);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fill(this.boards);
      ctx.restore();
      ctx.fillStyle = "#eeeeea";
      ctx.fill(this.boards);
      ctx.fillStyle = "#16171a";
      ctx.fill(this.boardStripes);
    }
    this.drawStartLine(ctx);
    if (px < 2.5) this.drawGantry(ctx, detailed);
  }

  /**
   * The start-light gantry bridging the track at the line: a truss beam on two
   * pylons with the light pods on top, casting a long shadow down the grid.
   */
  private drawGantry(ctx: CanvasRenderingContext2D, detailed: boolean) {
    const W2 = this.W / 2;
    const i = Math.round(6 / this.pt.step);
    const [x, y] = this.at(i, 0);
    const a = this.heading(i);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    const span = W2 + 3.5;
    const H = 8;
    // shadow, offset south-east by height (rotated into the gantry's frame)
    const sx = 0.45 * H * Math.cos(-a) - -0.45 * H * Math.sin(-a);
    const sy = 0.45 * H * Math.sin(-a) + -0.45 * H * Math.cos(-a);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(-0.7 + sx, -span + sy, 1.4, span * 2);
    // pylons
    ctx.fillStyle = "#5c6168";
    ctx.fillRect(-0.8, -span - 0.8, 1.6, 1.6);
    ctx.fillRect(-0.8, span - 0.8, 1.6, 1.6);
    // beam
    ctx.fillStyle = "#b8bcc1";
    ctx.fillRect(-0.7, -span, 1.4, span * 2);
    if (detailed) {
      ctx.strokeStyle = "rgba(60,64,70,0.7)";
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      for (let k = -span; k < span; k += 1.2) {
        ctx.moveTo(-0.7, k);
        ctx.lineTo(0.7, k + 1.2);
      }
      ctx.stroke();
      // five light pods over the track
      ctx.fillStyle = "#16171a";
      for (let k = -2; k <= 2; k++) ctx.fillRect(-0.45, k * 1.3 - 0.45, 0.9, 0.9);
    }
    ctx.restore();
  }

  private drawStartLine(ctx: CanvasRenderingContext2D) {
    const [x0, y0] = this.track.centerline[0];
    const [x1, y1] = this.track.centerline[1];
    const a = Math.atan2(y1 - y0, x1 - x0);
    const W = this.W;
    ctx.save();
    ctx.translate(x0, y0);
    ctx.rotate(a);
    const rows = 2;
    const cols = 12;
    const cell = W / cols;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 ? PALETTE.paint : "#111214";
        ctx.fillRect(r * cell - cell, -W / 2 + c * cell, cell, cell);
      }
    ctx.restore();
  }
}
