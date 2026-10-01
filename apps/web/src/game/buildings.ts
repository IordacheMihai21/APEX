import { canvas, rng } from "./scenery";

/**
 * Buildings and trees as a satellite photo shows them. Roofs carry the detail:
 * hip roofs on houses (a ridge skeleton, every face shaded by its angle to the
 * sun), parapets and rooftop plant on flat roofs, seat rows and a roof canopy
 * on grandstands, garage doors on pit buildings. Shadows are cast south-east
 * by height in two soft passes. Trees are pre-rendered crown sprites.
 *
 * Everything is grouped into a handful of Path2D buckets at build time so a
 * frame is a few fills, not one per building.
 */
export interface BuildingData {
  p: number[];
  h: number;
  k?: "stand" | "pits";
}

/** Sun from the north-west (world y is north). */
const SUN = { x: -Math.SQRT1_2, y: Math.SQRT1_2 };
const SHADOW = { dx: 0.45, dy: -0.45 };

type Pt = [number, number];

/** Four tone steps for roof faces, from shaded to lit. */
const TONES = [0.62, 0.8, 0.98, 1.14];

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function points(flat: number[]): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  // drop a closing duplicate
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  return pts;
}

function signedArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  return a / 2;
}

function centroid(pts: Pt[]): Pt {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
}

/** Long axis (unit vector) and the extent along it and across it. */
function axis(pts: Pt[]): { u: Pt; len: number; wid: number } {
  // the longest edge sets the orientation (buildings are mostly rectilinear)
  let best = 0;
  let u: Pt = [1, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > best) {
      best = l;
      u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    }
  }
  const [cx, cy] = centroid(pts);
  let lo = Infinity;
  let hi = -Infinity;
  let lo2 = Infinity;
  let hi2 = -Infinity;
  for (const [x, y] of pts) {
    const s = (x - cx) * u[0] + (y - cy) * u[1];
    const t = -(x - cx) * u[1] + (y - cy) * u[0];
    lo = Math.min(lo, s);
    hi = Math.max(hi, s);
    lo2 = Math.min(lo2, t);
    hi2 = Math.max(hi2, t);
  }
  return { u, len: hi - lo, wid: hi2 - lo2 };
}

function inside(pts: Pt[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    if (pts[i][1] > y !== pts[j][1] > y && x < ((pts[j][0] - pts[i][0]) * (y - pts[i][1])) / (pts[j][1] - pts[i][1]) + pts[i][0]) c = !c;
  }
  return c;
}

function poly(path: Path2D, pts: Pt[]) {
  pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
}

/** Tree crown sprite: shaded dome of leaf clumps, lit from the north-west. */
function treeSprite(seed: number, base: [number, number, number]): HTMLCanvasElement {
  const S = 64;
  const [c, ctx] = canvas(S);
  const r = rng(seed);
  const R = S * 0.46;
  const col = (f: number, a = 1) => `rgba(${Math.round(base[0] * f)},${Math.round(base[1] * f)},${Math.round(base[2] * f)},${a})`;
  // dome: dark rim to lit north-west
  const g = ctx.createRadialGradient(S * 0.38, S * 0.38, R * 0.1, S / 2, S / 2, R);
  g.addColorStop(0, col(1.35));
  g.addColorStop(0.65, col(0.95));
  g.addColorStop(1, col(0.55));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, R, 0, Math.PI * 2);
  ctx.fill();
  // leaf clumps
  for (let k = 0; k < 26; k++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * R * 0.78;
    const x = S / 2 + Math.cos(a) * d;
    const y = S / 2 + Math.sin(a) * d;
    const cr = R * (0.16 + r() * 0.16);
    const lit = 1 - ((x - S * 0.3) + (y - S * 0.3)) / (S * 1.4);
    const cg = ctx.createRadialGradient(x - cr * 0.35, y - cr * 0.35, cr * 0.1, x, y, cr);
    cg.addColorStop(0, col(0.9 + lit * 0.7, 0.9));
    cg.addColorStop(1, col(0.55 + lit * 0.3, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(x, y, cr, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

export class Buildings {
  private readonly shadowFar = new Path2D();
  private readonly shadowNear = new Path2D();
  private readonly faces = new Map<string, Path2D>();
  private readonly ridges = new Path2D();
  private readonly eaves = new Path2D();
  private readonly flats = new Map<string, Path2D>();
  private readonly parapets = new Path2D();
  private readonly units = new Path2D();
  private readonly unitShadows = new Path2D();
  private readonly skylights = new Path2D();
  private readonly stands: { seats: Path2D; canopy: Path2D; ribs: Path2D; aisles: Path2D; angle: number }[] = [];
  private readonly pitRoofs = new Path2D();
  private readonly doors = new Path2D();
  private readonly trees: { x: number; y: number; r: number; v: number }[] = [];
  private sprites: HTMLCanvasElement[] | null = null;
  private seatPattern: CanvasPattern | null = null;

  constructor(
    buildings: BuildingData[],
    trees: number[],
    palette: string[],
    /** sampled centreline, to know which side of a grandstand or pit building faces the track */
    private readonly track: Pt[],
  ) {
    const r = rng(11);
    for (const b of buildings) {
      const pts = points(b.p);
      if (pts.length < 3) continue;
      if (signedArea(pts) < 0) pts.reverse(); // counter-clockwise, so edge normals point outward
      const area = signedArea(pts);
      // shadow: two passes for a soft edge
      poly(this.shadowFar, pts.map(([x, y]) => [x + SHADOW.dx * b.h, y + SHADOW.dy * b.h] as Pt));
      poly(this.shadowNear, pts.map(([x, y]) => [x + SHADOW.dx * b.h * 0.6, y + SHADOW.dy * b.h * 0.6] as Pt));
      if (b.k === "stand") this.stand(pts);
      else if (b.k === "pits" || this.isPitBuilding(pts)) this.pits(pts);
      else if (area < 420 && b.h <= 12) this.hipRoof(pts, palette[Math.floor(r() * palette.length)]);
      else this.flatRoof(pts, area, r);
    }
    for (let i = 0; i < trees.length; i += 2) this.trees.push({ x: trees[i], y: trees[i + 1], r: 2.8 + r() * 2.6, v: Math.floor(r() * 3) });
  }

  /**
   * The pit building is rarely named in the map data; find it by shape instead:
   * a long, narrow building near the start line, parallel to the main straight.
   */
  private isPitBuilding(pts: Pt[]): boolean {
    const { u, len, wid } = axis(pts);
    if (len < 80 || wid > 45) return false;
    const [cx, cy] = centroid(pts);
    const [sx, sy] = this.track[0];
    if ((cx - sx) ** 2 + (cy - sy) ** 2 > 300 * 300) return false;
    const [tx, ty] = this.track[1];
    const tl = Math.hypot(tx - sx, ty - sy) || 1;
    return Math.abs((u[0] * (tx - sx) + u[1] * (ty - sy)) / tl) > 0.92;
  }

  private bucket(map: Map<string, Path2D>, color: string): Path2D {
    let p = map.get(color);
    if (!p) map.set(color, (p = new Path2D()));
    return p;
  }

  /** Hip roof from a ridge skeleton: each eave edge rises to the ridge; faces shaded by their angle to the sun. */
  private hipRoof(pts: Pt[], color: string) {
    const [cx, cy] = centroid(pts);
    const { u, len, wid } = axis(pts);
    const half = Math.max(0, (len - wid) / 2);
    const a: Pt = [cx - u[0] * half, cy - u[1] * half];
    const b: Pt = [cx + u[0] * half, cy + u[1] * half];
    const onRidge = ([x, y]: Pt): Pt => {
      const t = Math.max(-half, Math.min(half, (x - cx) * u[0] + (y - cy) * u[1]));
      return [cx + u[0] * t, cy + u[1] * t];
    };
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      // outward normal of a counter-clockwise edge
      const nx = (q[1] - p[1]) / l;
      const ny = -(q[0] - p[0]) / l;
      const light = nx * SUN.x + ny * SUN.y; // -1 shaded .. 1 lit
      const tone = TONES[Math.max(0, Math.min(3, Math.round((light + 1) * 1.5)))];
      const face = this.bucket(this.faces, shade(color, tone));
      poly(face, [p, q, onRidge(q), onRidge(p)]);
    }
    this.ridges.moveTo(a[0], a[1]);
    this.ridges.lineTo(b[0], b[1]);
    // hip lines from each corner to the ridge
    for (const p of pts) {
      const t = onRidge(p);
      this.ridges.moveTo(p[0], p[1]);
      this.ridges.lineTo(t[0], t[1]);
    }
    poly(this.eaves, pts);
  }

  /** Flat roof: membrane, parapet, plant units with shadows, skylights on long sheds. */
  private flatRoof(pts: Pt[], area: number, r: () => number) {
    const greys = ["#8c8f93", "#9da0a3", "#7a7d81", "#a9a7a1"];
    poly(this.bucket(this.flats, greys[Math.floor(r() * greys.length)]), pts);
    poly(this.parapets, pts);
    const { u, len, wid } = axis(pts);
    const [cx, cy] = centroid(pts);
    const v: Pt = [-u[1], u[0]];
    const n = Math.min(7, Math.floor(area / 160));
    for (let k = 0, tries = 0; k < n && tries < 40; tries++) {
      const s = (r() - 0.5) * len * 0.7;
      const t = (r() - 0.5) * wid * 0.6;
      const x = cx + u[0] * s + v[0] * t;
      const y = cy + u[1] * s + v[1] * t;
      if (!inside(pts, x, y)) continue;
      k++;
      const w = 1.6 + r() * 1.6;
      const h = 1.2 + r() * 1.0;
      const box: Pt[] = [
        [x - u[0] * w - v[0] * h, y - u[1] * w - v[1] * h],
        [x + u[0] * w - v[0] * h, y + u[1] * w - v[1] * h],
        [x + u[0] * w + v[0] * h, y + u[1] * w + v[1] * h],
        [x - u[0] * w + v[0] * h, y - u[1] * w + v[1] * h],
      ];
      poly(this.unitShadows, box.map(([bx, by]) => [bx + 0.7, by - 0.7] as Pt));
      poly(this.units, box);
    }
    if (len > 70 && wid > 22) {
      for (const off of [-0.25, 0.25]) {
        const sx = cx + v[0] * wid * off;
        const sy = cy + v[1] * wid * off;
        const L = len * 0.36;
        poly(this.skylights, [
          [sx - u[0] * L - v[0] * 0.9, sy - u[1] * L - v[1] * 0.9],
          [sx + u[0] * L - v[0] * 0.9, sy + u[1] * L - v[1] * 0.9],
          [sx + u[0] * L + v[0] * 0.9, sy + u[1] * L + v[1] * 0.9],
          [sx - u[0] * L + v[0] * 0.9, sy - u[1] * L + v[1] * 0.9],
        ]);
      }
    }
  }

  /** Which way across the long axis points at the track (+1 = +v side). */
  private trackSide(pts: Pt[], u: Pt): 1 | -1 {
    const [cx, cy] = centroid(pts);
    let best: Pt = this.track[0];
    let d = Infinity;
    for (const p of this.track) {
      const dd = (p[0] - cx) ** 2 + (p[1] - cy) ** 2;
      if (dd < d) {
        d = dd;
        best = p;
      }
    }
    return (best[0] - cx) * -u[1] + (best[1] - cy) * u[0] >= 0 ? 1 : -1;
  }

  /** Grandstand: seat rows parallel to the track, aisles, and a ribbed roof canopy on the far side. */
  private stand(pts: Pt[]) {
    const { u, len, wid } = axis(pts);
    const [cx, cy] = centroid(pts);
    const side = this.trackSide(pts, u);
    const v: Pt = [-u[1] * side, u[0] * side]; // towards the track
    const seats = new Path2D();
    poly(seats, pts);
    // canopy: the back 45% of the stand, away from the track
    const canopy = new Path2D();
    const ribs = new Path2D();
    const back = -wid / 2;
    const front = back + wid * 0.45;
    const L = len / 2;
    const at = (s: number, t: number): Pt => [cx + u[0] * s + v[0] * t, cy + u[1] * s + v[1] * t];
    poly(canopy, [at(-L, back), at(L, back), at(L, front), at(-L, front)]);
    for (let s = -L + 4; s < L; s += 6) {
      const [x0, y0] = at(s, back);
      const [x1, y1] = at(s, front);
      ribs.moveTo(x0, y0);
      ribs.lineTo(x1, y1);
    }
    const aisles = new Path2D();
    for (let s = -L + 10; s < L - 4; s += 14) {
      const [x0, y0] = at(s, front);
      const [x1, y1] = at(s, wid / 2);
      aisles.moveTo(x0, y0);
      aisles.lineTo(x1, y1);
    }
    this.stands.push({ seats, canopy, ribs, aisles, angle: Math.atan2(u[1], u[0]) });
  }

  /** Pit building: flat roof and a row of garage doors on the track side. */
  private pits(pts: Pt[]) {
    poly(this.pitRoofs, pts);
    poly(this.parapets, pts);
    const { u, len, wid } = axis(pts);
    const [cx, cy] = centroid(pts);
    const side = this.trackSide(pts, u);
    const v: Pt = [-u[1] * side, u[0] * side];
    const edge = wid / 2 - 0.4;
    for (let s = -len / 2 + 2; s + 4 < len / 2 - 1; s += 5.5) {
      const at = (a: number, b: number): Pt => [cx + u[0] * a + v[0] * b, cy + u[1] * a + v[1] * b];
      poly(this.doors, [at(s, edge - 1.4), at(s + 4.2, edge - 1.4), at(s + 4.2, edge), at(s, edge)]);
    }
  }

  draw(ctx: CanvasRenderingContext2D, px: number) {
    const detailed = px < 0.9;
    ctx.fillStyle = "rgba(6,8,10,0.2)";
    ctx.fill(this.shadowFar);
    ctx.fillStyle = "rgba(6,8,10,0.24)";
    ctx.fill(this.shadowNear);

    for (const [color, path] of this.faces) {
      ctx.fillStyle = color;
      ctx.fill(path);
    }
    for (const [color, path] of this.flats) {
      ctx.fillStyle = color;
      ctx.fill(path);
    }
    ctx.fillStyle = "#c9cbcd";
    ctx.fill(this.pitRoofs);

    // grandstands: seat rows run along each stand
    if (!this.seatPattern) {
      const [c, sctx] = canvas(32);
      sctx.fillStyle = "#28313c";
      sctx.fillRect(0, 0, 32, 32);
      const rows = ["#5e7590", "#6b839f", "#536a85", "#7891ad"];
      for (let i = 0; i < 4; i++) {
        sctx.fillStyle = rows[i];
        sctx.fillRect(0, i * 8, 32, 5);
      }
      this.seatPattern = ctx.createPattern(c, "repeat");
    }
    for (const s of this.stands) {
      if (this.seatPattern && detailed) {
        // 32 px tile = 3.2 m: four seat rows of 0.8 m, rotated to the stand's axis
        this.seatPattern.setTransform(new DOMMatrix().rotate((s.angle * 180) / Math.PI).scale(0.1, 0.1));
        ctx.fillStyle = this.seatPattern;
      } else ctx.fillStyle = "#4a5d74";
      ctx.fill(s.seats);
      ctx.fillStyle = "#d4d6d8";
      ctx.fill(s.canopy);
      if (detailed) {
        ctx.strokeStyle = "rgba(60,64,70,0.55)";
        ctx.lineWidth = 0.35;
        ctx.stroke(s.ribs);
        ctx.strokeStyle = "rgba(210,214,218,0.6)";
        ctx.lineWidth = 0.6;
        ctx.stroke(s.aisles);
      }
    }

    if (!detailed) return;
    // roof detail: ridges and hips catch the light, eaves and parapets cast a line
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(255,240,225,0.28)";
    ctx.lineWidth = 0.22;
    ctx.stroke(this.ridges);
    ctx.strokeStyle = "rgba(20,14,10,0.45)";
    ctx.lineWidth = 0.25;
    ctx.stroke(this.eaves);
    ctx.strokeStyle = "rgba(40,42,46,0.6)";
    ctx.lineWidth = 0.9;
    ctx.stroke(this.parapets);
    ctx.strokeStyle = "rgba(230,232,234,0.55)";
    ctx.lineWidth = 0.35;
    ctx.stroke(this.parapets);
    ctx.fillStyle = "rgba(10,12,14,0.35)";
    ctx.fill(this.unitShadows);
    ctx.fillStyle = "#c3c6c9";
    ctx.fill(this.units);
    ctx.fillStyle = "rgba(150,190,215,0.55)";
    ctx.fill(this.skylights);
    ctx.fillStyle = "#3a3e44";
    ctx.fill(this.doors);
  }

  /** Trees after buildings so canopies overhang roofs a little, as they do. */
  drawTrees(ctx: CanvasRenderingContext2D, px: number) {
    if (px > 2.5 || !this.trees.length) return;
    if (!this.sprites) this.sprites = [treeSprite(3, [44, 78, 36]), treeSprite(5, [52, 86, 40]), treeSprite(8, [38, 68, 34])];
    ctx.fillStyle = "rgba(6,10,6,0.32)";
    ctx.beginPath();
    for (const t of this.trees) {
      ctx.moveTo(t.x + t.r * 1.0 + t.r, t.y - t.r * 1.0);
      ctx.arc(t.x + t.r * 1.0, t.y - t.r * 1.0, t.r, 0, Math.PI * 2);
    }
    ctx.fill();
    for (const t of this.trees) {
      ctx.save();
      // sprites are drawn in a y-down frame; flip so the lit side stays north-west
      ctx.translate(t.x, t.y);
      ctx.scale(1, -1);
      ctx.drawImage(this.sprites[t.v], -t.r, -t.r, t.r * 2, t.r * 2);
      ctx.restore();
    }
  }
}
