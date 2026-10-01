import { canvas, hex, noiseTexture, rng } from "./scenery";

/**
 * The real world around a circuit, from OpenStreetMap (data/scenery/<id>.json,
 * built by tools/track-builder/src/import-osm.ts; © OpenStreetMap contributors,
 * ODbL): land cover, water and the sea, roads and rail, the pit lane and other
 * raceway, buildings with height shadows, grandstands, single trees, and a few
 * landmarks. Built once into cached Path2D layers; drawn under the run-off.
 */
export interface SceneryData {
  attribution: string;
  box: [number, number, number, number];
  areas: Record<"water" | "wood" | "scrub" | "sand" | "grass" | "farm" | "urban" | "parking" | "pier", number[][]>;
  buildings: { p: number[]; h: number; k?: "stand" | "pits" }[];
  trees: number[];
  roads: { w: number; p: number[] }[];
  rail: number[][];
  raceway: { pit: boolean; p: number[] }[];
  waterways: { w: number; p: number[] }[];
  landmarks: { k: "wheel" | "tower" | "art"; x: number; y: number; r: number; name?: string }[];
}

/** Sun from the north-west: shadows fall south-east, length ∝ height. */
const SHADOW = { dx: 0.45, dy: -0.45 };

const LAND = {
  water: "#24465c",
  waterEdge: "#3b6a84",
  wood: "#1f3a1f",
  scrub: "#3a4a2c",
  sand: "#b9a681",
  grass: "#36552f",
  farm: "#4a5a33",
  urban: "#3c3f42",
  parking: "#45494e",
  pier: "#8d8a83",
  road: "#3f4348",
  roadEdge: "#565b61",
  rail: "#2c2a28",
};

/** Roof palettes by region: terracotta where the tiles are, greys and slate elsewhere. */
const ROOFS: Record<"tile" | "slate", string[]> = {
  tile: ["#9a5a43", "#a8684d", "#b07a5c", "#8c8780", "#c9c4bb"],
  slate: ["#5d6268", "#6f747a", "#4f5459", "#8a8e93", "#b7b9bb"],
};
const TILE_ROOFS = new Set(["monaco", "monza", "imola", "barcelona", "interlagos"]);

type Area = keyof SceneryData["areas"];

function ringPath(path: Path2D, flat: number[], dx = 0, dy = 0) {
  for (let i = 0; i < flat.length; i += 2) {
    if (i) path.lineTo(flat[i] + dx, flat[i + 1] + dy);
    else path.moveTo(flat[i] + dx, flat[i + 1] + dy);
  }
  path.closePath();
}

function linePath(path: Path2D, flat: number[]) {
  for (let i = 0; i < flat.length; i += 2) {
    if (i) path.lineTo(flat[i], flat[i + 1]);
    else path.moveTo(flat[i], flat[i + 1]);
  }
}

/** Signed polygon area (shoelace), m². */
function area(flat: number[]): number {
  let a = 0;
  for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) a += (flat[j] + flat[i]) * (flat[j + 1] - flat[i + 1]);
  return a / 2;
}

/** Even-odd point in polygon. */
function inside(flat: number[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
    const xi = flat[i];
    const yi = flat[i + 1];
    const xj = flat[j];
    const yj = flat[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Tree-top texture: overlapping soft crowns, for woods seen from above. */
function canopyTexture(): HTMLCanvasElement {
  const [c, ctx] = canvas(256);
  ctx.fillStyle = LAND.wood;
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(21);
  const greens = ["#18301a", "#244423", "#2b4d27", "#1d3a1e", "#335a2c"];
  for (let k = 0; k < 340; k++) {
    const x = r() * 256;
    const y = r() * 256;
    const rad = 7 + r() * 11;
    for (const [ox, oy] of [[0, 0], [256, 0], [-256, 0], [0, 256], [0, -256]]) {
      const g = ctx.createRadialGradient(x + ox - rad * 0.3, y + oy - rad * 0.3, rad * 0.1, x + ox, y + oy, rad);
      g.addColorStop(0, greens[4]);
      g.addColorStop(0.6, greens[Math.floor(r() * 4)]);
      g.addColorStop(1, "rgba(10,20,10,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

export class Surroundings {
  private readonly areas = new Map<Area, Path2D>();
  private readonly waterways: { w: number; path: Path2D }[] = [];
  private readonly roads: { w: number; path: Path2D }[] = [];
  private readonly rail = new Path2D();
  private readonly raceway = new Path2D();
  private readonly pitlane = new Path2D();
  private readonly shadows = new Path2D();
  private readonly roofs: { color: string; path: Path2D }[] = [];
  private readonly stands = new Path2D();
  private readonly pits = new Path2D();
  private readonly treeShadow = new Path2D();
  private readonly trees: Path2D[] = [new Path2D(), new Path2D(), new Path2D()];
  private readonly treeLight = new Path2D();
  private readonly yachts = new Path2D();
  private readonly yachtDecks = new Path2D();
  private hasYachts = false;
  private readonly landmarks: SceneryData["landmarks"];
  private tex: { canopy: CanvasPattern; water: CanvasPattern; sand: CanvasPattern; seats: CanvasPattern } | null = null;

  constructor(
    data: SceneryData,
    private readonly trackId: string,
    centerline: [number, number][],
  ) {
    for (const [k, polys] of Object.entries(data.areas) as [Area, number[][]][]) {
      const p = new Path2D();
      for (const poly of polys) ringPath(p, poly);
      this.areas.set(k, p);
    }
    for (const w of data.waterways) {
      const path = new Path2D();
      linePath(path, w.p);
      this.waterways.push({ w: w.w, path });
    }
    // roads grouped by width so each width is one stroke
    const byWidth = new Map<number, Path2D>();
    for (const r of data.roads) linePath(byWidth.get(r.w) ?? byWidth.set(r.w, new Path2D()).get(r.w)!, r.p);
    for (const [w, path] of [...byWidth].sort((a, b) => b[0] - a[0])) this.roads.push({ w, path });
    for (const r of data.rail) linePath(this.rail, r);
    for (const r of data.raceway) linePath(r.pit ? this.pitlane : this.raceway, r.p);

    // buildings: shadow (offset by height), then roof colour buckets
    const palette = ROOFS[TILE_ROOFS.has(trackId) ? "tile" : "slate"];
    const buckets = palette.map(() => new Path2D());
    const rand = rng(7);
    for (const b of data.buildings) {
      ringPath(this.shadows, b.p, SHADOW.dx * b.h, SHADOW.dy * b.h);
      if (b.k === "stand") ringPath(this.stands, b.p);
      else if (b.k === "pits") ringPath(this.pits, b.p);
      else ringPath(buckets[Math.floor(rand() * palette.length)], b.p);
    }
    palette.forEach((color, i) => this.roofs.push({ color, path: buckets[i] }));

    // single trees: three shades, a crown highlight, and a shadow
    for (let i = 0; i < data.trees.length; i += 2) {
      const x = data.trees[i];
      const y = data.trees[i + 1];
      const r = 2.8 + rand() * 2.4;
      this.treeShadow.moveTo(x + r * 0.9 + r, y - r * 0.9);
      this.treeShadow.arc(x + r * 0.9, y - r * 0.9, r, 0, Math.PI * 2);
      const t = this.trees[Math.floor(rand() * 3)];
      t.moveTo(x + r, y);
      t.arc(x, y, r, 0, Math.PI * 2);
      this.treeLight.moveTo(x - r * 0.25 + r * 0.45, y + r * 0.25);
      this.treeLight.arc(x - r * 0.25, y + r * 0.25, r * 0.45, 0, Math.PI * 2);
    }

    // Monaco: yachts moored in the harbour water near the circuit
    if (trackId === "monaco") this.placeYachts(data, centerline);
    // Landmarks worth drawing: big wheels (one per site), the bull at Spielberg, and at Austin the
    // observation tower, which is the mapped tower nearest the circuit (by turns 16-18)
    const toTrack = (l: { x: number; y: number }) => Math.min(...centerline.map(([x, y]) => (x - l.x) ** 2 + (y - l.y) ** 2));
    const wheels = data.landmarks.filter((l) => l.k === "wheel").sort((a, b) => b.r - a.r);
    const keptWheels = wheels.filter((w, i) => !wheels.slice(0, i).some((o) => (o.x - w.x) ** 2 + (o.y - w.y) ** 2 < 120 * 120));
    const towers = trackId === "austin" ? data.landmarks.filter((l) => l.k === "tower").sort((a, b) => toTrack(a) - toTrack(b)).slice(0, 1) : [];
    const bull = data.landmarks.filter((l) => l.k === "art" && /bull/i.test(l.name ?? ""));
    this.landmarks = [...keptWheels, ...towers, ...bull];
  }

  /**
   * Yachts moored stern-to along the harbour quays (the Mediterranean way, as
   * in Port Hercule): along every pier edge that faces water, a boat every
   * 9–13 m, perpendicular to the quay, bigger ones on the outer moles.
   */
  private placeYachts(data: SceneryData, track: [number, number][]) {
    const water = data.areas.water;
    const r = rng(42);
    const taken = new Set<string>();
    const cellOf = (x: number, y: number) => `${Math.floor(x / 7)},${Math.floor(y / 7)}`;
    const nearCircuit = (x: number, y: number) => track.some(([tx, ty]) => (tx - x) ** 2 + (ty - y) ** 2 < 300 * 300);
    // quays: the piers, plus the water's own edge near the circuit (Monaco's waterfront is harbour)
    const quays = data.areas.pier.concat(water.filter((w) => w.some((_, i) => i % 2 === 0 && nearCircuit(w[i], w[i + 1]))));
    // harbour basins and the sea only: never a swimming pool or a pond
    const big = water.filter((w) => Math.abs(area(w)) > 6000);
    for (const pier of quays) {
      for (let i = 0; i < pier.length; i += 2) {
        const j = (i + 2) % pier.length;
        const ax = pier[i];
        const ay = pier[i + 1];
        const bx = pier[j];
        const by = pier[j + 1];
        const len = Math.hypot(bx - ax, by - ay);
        if (len < 14 || !nearCircuit((ax + bx) / 2, (ay + by) / 2)) continue;
        const ux = (bx - ax) / len;
        const uy = (by - ay) / len;
        for (const side of [1, -1]) {
          // outward normal of this edge, towards the water
          const nx = -uy * side;
          const ny = ux * side;
          for (let d = 8; d < len - 8; d += 12 + r() * 5) {
            if (r() < 0.15) continue; // the odd empty berth
            const boat = 12 + r() * 20;
            const cx = ax + ux * d + nx * (boat / 2 + 1.5);
            const cy = ay + uy * d + ny * (boat / 2 + 1.5);
            if (!big.some((w) => inside(w, cx, cy)) || !big.some((w) => inside(w, cx + nx * boat * 0.5, cy + ny * boat * 0.5))) continue;
            const cells: string[] = [];
            for (let t = -0.5; t <= 0.5; t += 0.125) for (const off of [-0.12, 0.12]) cells.push(cellOf(cx + nx * boat * t + ux * boat * off, cy + ny * boat * t + uy * boat * off));
            if (cells.some((c) => taken.has(c))) continue;
            cells.forEach((c) => taken.add(c));
            this.yacht(cx, cy, Math.atan2(ny, nx), boat);
          }
        }
      }
    }
  }

  /** One yacht seen from above: pointed bow, square stern, a lighter superstructure. */
  private yacht(px: number, py: number, a: number, len: number) {
    const beam = len * 0.24;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const P = (u: number, v: number): [number, number] => [px + u * c - v * s, py + u * s + v * c];
    const hull: [number, number][] = [P(len / 2, 0), P(len * 0.22, beam / 2), P(-len / 2, beam / 2), P(-len / 2, -beam / 2), P(len * 0.22, -beam / 2)];
    hull.forEach(([hx, hy], k) => (k ? this.yachts.lineTo(hx, hy) : this.yachts.moveTo(hx, hy)));
    this.yachts.closePath();
    const deck: [number, number][] = [P(len * 0.1, beam * 0.28), P(-len * 0.35, beam * 0.28), P(-len * 0.35, -beam * 0.28), P(len * 0.1, -beam * 0.28)];
    deck.forEach(([hx, hy], k) => (k ? this.yachtDecks.lineTo(hx, hy) : this.yachtDecks.moveTo(hx, hy)));
    this.yachtDecks.closePath();
    this.hasYachts = true;
  }

  private textures(ctx: CanvasRenderingContext2D) {
    if (this.tex) return this.tex;
    const pattern = (src: HTMLCanvasElement, metres: number) => {
      const p = ctx.createPattern(src, "repeat")!;
      const k = metres / src.width;
      p.setTransform(new DOMMatrix().scale(k, k));
      return p;
    };
    const water = noiseTexture(256, hex(LAND.water), 6, { rate: 0.01, light: 14, dark: 6 }, 31);
    const sand = noiseTexture(256, hex(LAND.sand), 14, { rate: 0.05, light: 18, dark: 16 }, 32);
    // grandstand seat rows: light rows on a dark tier, seen from above
    const [seats, sctx] = canvas(16);
    sctx.fillStyle = "#2f3a48";
    sctx.fillRect(0, 0, 16, 16);
    sctx.fillStyle = "#6f86a3";
    sctx.fillRect(0, 0, 16, 5);
    sctx.fillStyle = "#4c5f78";
    sctx.fillRect(0, 8, 16, 5);
    this.tex = { canopy: pattern(canopyTexture(), 70), water: pattern(water, 40), sand: pattern(sand, 12), seats: pattern(seats, 1.8) };
    return this.tex;
  }

  /** Land cover, water, roads, raceway, buildings and trees: everything under the run-off. */
  draw(ctx: CanvasRenderingContext2D, px: number) {
    const t = this.textures(ctx);
    const detailed = px < 0.9;
    const fill = (k: Area, style: string | CanvasPattern) => {
      const p = this.areas.get(k);
      if (!p) return;
      ctx.fillStyle = style;
      ctx.fill(p);
    };
    fill("farm", LAND.farm);
    fill("grass", LAND.grass);
    fill("urban", LAND.urban);
    fill("parking", LAND.parking);
    fill("scrub", LAND.scrub);
    fill("sand", detailed ? t.sand : LAND.sand);
    fill("wood", detailed ? t.canopy : LAND.wood);
    // water with a lighter shoreline
    const water = this.areas.get("water");
    if (water) {
      ctx.fillStyle = detailed ? t.water : LAND.water;
      ctx.fill(water);
      ctx.strokeStyle = LAND.waterEdge;
      ctx.lineWidth = Math.max(0.8, 1.5 * px);
      ctx.stroke(water);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = LAND.water;
    for (const w of this.waterways) {
      ctx.lineWidth = w.w;
      ctx.stroke(w.path);
    }
    fill("pier", LAND.pier);

    // roads: kerb edge then surface; rail as a dark band with sleepers when close
    for (const r of this.roads) {
      ctx.strokeStyle = LAND.roadEdge;
      ctx.lineWidth = r.w + 1.2;
      ctx.stroke(r.path);
    }
    ctx.strokeStyle = LAND.road;
    for (const r of this.roads) {
      ctx.lineWidth = r.w;
      ctx.stroke(r.path);
    }
    ctx.strokeStyle = LAND.rail;
    ctx.lineWidth = 3.2;
    ctx.stroke(this.rail);

    // other raceway: the old and alternative layouts, and the pit lane with its white lines
    ctx.strokeStyle = "#3a3d42";
    ctx.lineWidth = 11;
    ctx.stroke(this.raceway);
    ctx.strokeStyle = "#f2f2ee";
    ctx.lineWidth = 12.6;
    ctx.stroke(this.pitlane);
    ctx.strokeStyle = "#34373c";
    ctx.lineWidth = 12;
    ctx.stroke(this.pitlane);

    if (this.hasYachts) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.save();
      ctx.translate(1.2, -1.2);
      ctx.fill(this.yachts);
      ctx.restore();
      ctx.fillStyle = "#eceae4";
      ctx.fill(this.yachts);
      ctx.fillStyle = "#c9c6bd";
      ctx.fill(this.yachtDecks);
    }

    // buildings: soft shadow, then roofs; grandstands show their seat rows
    ctx.fillStyle = "rgba(6,8,10,0.38)";
    ctx.fill(this.shadows);
    for (const r of this.roofs) {
      ctx.fillStyle = r.color;
      ctx.fill(r.path);
    }
    ctx.fillStyle = "#c4c7cb";
    ctx.fill(this.pits);
    ctx.fillStyle = detailed ? t.seats : "#4c5f78";
    ctx.fill(this.stands);
    if (detailed) {
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = Math.max(0.25, 0.8 * px);
      for (const r of this.roofs) ctx.stroke(r.path);
      ctx.stroke(this.stands);
    }

    // single trees
    if (px < 2.5) {
      ctx.fillStyle = "rgba(6,10,6,0.4)";
      ctx.fill(this.treeShadow);
      ["#25451f", "#2f5327", "#38602d"].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fill(this.trees[i]);
      });
      if (detailed) {
        ctx.fillStyle = "rgba(120,170,90,0.22)";
        ctx.fill(this.treeLight);
      }
    }
  }

  /** Landmarks stand tall, so they're drawn after the run-off and barriers. */
  drawLandmarks(ctx: CanvasRenderingContext2D) {
    for (const l of this.landmarks) {
      ctx.save();
      ctx.translate(l.x, l.y);
      if (l.k === "wheel") {
        // a big wheel, tilted as an oblique aerial camera would see it: rim, spokes, gondolas, and its long shadow
        const R = Math.max(18, Math.min(l.r, 30));
        ctx.save();
        ctx.translate(R * 0.9, -R * 0.9);
        ctx.scale(1, 0.35);
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.scale(1, 0.55);
        ctx.strokeStyle = "#e8e6e1";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 0.5;
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
          ctx.stroke();
          ctx.fillStyle = k % 4 ? "#d9d6cf" : "#e5332a";
          ctx.beginPath();
          ctx.arc(Math.cos(a) * R, Math.sin(a) * R, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (l.k === "tower") {
        // an observation tower: long shadow, platform, and streaming red canopy strands
        const H = 77;
        ctx.scale(2, 2);
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo((H * SHADOW.dx) / 2, (H * SHADOW.dy) / 2);
        ctx.stroke();
        ctx.strokeStyle = "#c62b25";
        ctx.lineWidth = 0.7;
        for (let k = -6; k <= 6; k++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(k * 1.4, -9, k * 2.6, -16);
          ctx.stroke();
        }
        ctx.fillStyle = "#d9d6cf";
        ctx.beginPath();
        ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // the bull: a bronze body on its arch, horns forward, with a shadow (17 m tall in life)
        ctx.scale(1.7, 1.7);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(6, -6, 9, 4, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#6e4a2c";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, 9, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
        ctx.fillStyle = "#8a5a33";
        ctx.beginPath();
        ctx.ellipse(0, 0, 7.5, 3.4, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(7.2, 1.2, 2.4, 1.8, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#d9c9a8";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(8.5, 2.6);
        ctx.lineTo(11, 4.4);
        ctx.moveTo(8.8, 0);
        ctx.lineTo(11.4, -1.4);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
