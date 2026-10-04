import { boatBox, boatSprites } from "./boats";
import { Buildings } from "./buildings";
import { asphalt as asphaltMat, concrete as concreteMat, grass as grassMat, water as waterMat } from "./materials";
import { FLORA_BY_TRACK, type Flora, forestTile } from "./trees";
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
  wood: "#284724",
  scrub: "#4b5935",
  sand: "#b9a681",
  grass: "#466636",
  farm: "#636e3d",
  urban: "#5b5954",
  parking: "#55585b",
  pier: "#8d8a83",
  road: "#44474b",
  roadEdge: "#6a6d70",
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

/**
 * Woodland seen from above: irregular crowns built from leaf clusters, each lit
 * from the north-west with its own shadow on the south-east, dark gaps between
 * trees, and a spread of greens so it never repeats as identical bubbles.
 */
function canopyTexture(): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = "#132514";
  ctx.fillRect(0, 0, S, S);
  const r = rng(21);
  const greens: [number, number, number][] = [
    [34, 62, 30],
    [42, 72, 34],
    [30, 56, 32],
    [50, 78, 38],
    [38, 60, 28],
    [46, 70, 44],
  ];
  const wrap = (x: number, y: number, rad: number, draw: (x: number, y: number) => void) => {
    for (const ox of [0, S, -S]) for (const oy of [0, S, -S]) if (x + ox > -rad && x + ox < S + rad && y + oy > -rad && y + oy < S + rad) draw(x + ox, y + oy);
  };
  for (let k = 0; k < 520; k++) {
    const x = r() * S;
    const y = r() * S;
    const R = 9 + r() * 13;
    const [gr, gg, gb] = greens[Math.floor(r() * greens.length)];
    // crown shadow, south-east
    wrap(x, y, R * 1.6, (cx, cy) => {
      ctx.fillStyle = "rgba(4,10,5,0.45)";
      ctx.beginPath();
      ctx.arc(cx + R * 0.35, cy + R * 0.35, R * 0.95, 0, Math.PI * 2);
      ctx.fill();
    });
    // the crown: 5-8 leaf clusters around the centre
    const n = 5 + Math.floor(r() * 4);
    for (let j = 0; j < n; j++) {
      const a = r() * Math.PI * 2;
      const d = R * (0.15 + r() * 0.45);
      const lx = x + Math.cos(a) * d;
      const ly = y + Math.sin(a) * d;
      const lr = R * (0.38 + r() * 0.25);
      wrap(lx, ly, lr, (cx, cy) => {
        const g = ctx.createRadialGradient(cx - lr * 0.4, cy - lr * 0.4, lr * 0.05, cx, cy, lr);
        g.addColorStop(0, `rgb(${gr * 1.45},${gg * 1.4},${gb * 1.3})`);
        g.addColorStop(0.55, `rgb(${gr},${gg},${gb})`);
        g.addColorStop(1, `rgba(${gr * 0.6},${gg * 0.6},${gb * 0.6},0.9)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, lr, 0, Math.PI * 2);
        ctx.fill();
      });
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
  private readonly buildings: Buildings;
  private readonly yachts = new Path2D();
  private readonly yachtDecks = new Path2D();
  private hasYachts = false;
  private readonly boats: { x: number; y: number; a: number; len: number; v: number }[] = [];
  private readonly landmarks: SceneryData["landmarks"];
  private tex: { canopy: CanvasPattern; water: CanvasPattern; sand: CanvasPattern; meadow: CanvasPattern; paving: CanvasPattern; road: CanvasPattern } | null = null;
  private readonly flora: Flora;
  private _wet = false;
  /** Wet days: darker, cooler ground, flat light (set before the first draw). */
  set wet(v: boolean) {
    this._wet = v;
    this.buildings.wet = v;
    this.tex = null;
  }

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

    const palette = ROOFS[TILE_ROOFS.has(trackId) ? "tile" : "slate"];
    this.flora = FLORA_BY_TRACK[trackId] ?? "temperate";
    this.buildings = new Buildings(data.buildings, data.trees, palette, centerline, this.flora);

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
    this.boats.push({ x: px, y: py, a, len, v: Math.floor(Math.abs(Math.sin(px * 12.9898 + py * 78.233)) * 4) });
  }

  private textures(ctx: CanvasRenderingContext2D) {
    if (this.tex) return this.tex;
    const pattern = (src: HTMLCanvasElement, metres: number) => {
      const p = ctx.createPattern(src, "repeat")!;
      const k = metres / src.width;
      p.setTransform(new DOMMatrix().scale(k, k));
      return p;
    };
    const wet = this._wet;
    // the sea and harbours are choppier than ponds; on a wet day the water goes grey
    const waterBase: [number, number, number] = wet ? [34, 54, 66] : this.trackId === "monaco" ? [26, 74, 98] : [32, 66, 84];
    const sand = noiseTexture(256, hex(LAND.sand), 14, { rate: 0.05, light: 18, dark: 16 }, 32);
    this.tex = {
      canopy: pattern(forestTile(this.flora, wet), 120),
      water: pattern(waterMat(waterBase, 81, false), 70),
      sand: pattern(sand, 12),
      meadow: pattern(grassMat(43, wet), 22),
      paving: pattern(concreteMat(hex(LAND.urban), 72, 48), 14),
      road: pattern(asphaltMat(hex(LAND.road), 53, wet), 8),
    };
    return this.tex;
  }

  /** Land cover, water, roads, raceway, buildings and trees: everything under the run-off. */
  draw(ctx: CanvasRenderingContext2D, px: number) {
    const t = this.textures(ctx);
    const detailed = px < 0.9;
    // materials hold up well zoomed out too (the overview is still), so only a far view goes flat
    const textured = px < 5;
    const fill = (k: Area, style: string | CanvasPattern) => {
      const p = this.areas.get(k);
      if (!p) return;
      ctx.fillStyle = style;
      ctx.fill(p);
    };
    // textured land, then each kind tinted over it so meadow, farmland and scrub read apart
    const tinted = (k: Area, tex: CanvasPattern, tint: string, flat: string) => {
      const p = this.areas.get(k);
      if (!p) return;
      ctx.fillStyle = textured ? tex : flat;
      ctx.fill(p);
      if (textured) {
        ctx.fillStyle = tint;
        ctx.fill(p);
      }
    };
    tinted("farm", t.meadow, "rgba(120,110,50,0.32)", LAND.farm);
    tinted("grass", t.meadow, "rgba(0,0,0,0)", LAND.grass);
    tinted("urban", t.paving, "rgba(0,0,0,0)", LAND.urban);
    tinted("parking", t.road, "rgba(90,96,104,0.25)", LAND.parking);
    tinted("scrub", t.meadow, "rgba(70,72,40,0.38)", LAND.scrub);
    fill("sand", textured ? t.sand : LAND.sand);
    const wood = this.areas.get("wood");
    if (wood) {
      // the treeline is 20 m tall: it throws a band of shade on the field to the south-east
      ctx.save();
      ctx.translate(4, -4);
      ctx.fillStyle = `rgba(4,10,6,${this._wet ? 0.15 : 0.38})`;
      ctx.fill(wood);
      ctx.restore();
      ctx.fillStyle = textured ? t.canopy : LAND.wood;
      ctx.fill(wood);
      if (textured) {
        // a ragged edge: crowns overhang the polygon a little
        ctx.lineJoin = "round";
        ctx.strokeStyle = t.canopy;
        ctx.lineWidth = 3;
        ctx.stroke(wood);
      }
    }
    // water: shallows lighter along the shore, a thin line of surf where it meets land
    const water = this.areas.get("water");
    if (water) {
      ctx.fillStyle = textured ? t.water : LAND.water;
      ctx.fill(water);
      if (textured) {
        ctx.save();
        ctx.clip(water);
        ctx.lineJoin = "round";
        for (const [w, a] of [
          [14, 0.07],
          [7, 0.09],
          [3, 0.12],
        ] as const) {
          ctx.strokeStyle = `rgba(120,190,200,${a})`;
          ctx.lineWidth = w;
          ctx.stroke(water);
        }
        ctx.strokeStyle = "rgba(235,245,245,0.35)";
        ctx.lineWidth = Math.max(0.6, 0.8 * px);
        ctx.stroke(water);
        ctx.restore();
      } else {
        ctx.strokeStyle = LAND.waterEdge;
        ctx.lineWidth = Math.max(0.8, 1.5 * px);
        ctx.stroke(water);
      }
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const w of this.waterways) {
      // rivers: dark banks, the water textured like the rest
      ctx.strokeStyle = "rgba(20,30,24,0.6)";
      ctx.lineWidth = w.w + 1.6;
      ctx.stroke(w.path);
      ctx.strokeStyle = textured ? t.water : LAND.water;
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
    ctx.strokeStyle = textured ? t.road : LAND.road;
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

    if (this.hasYachts && px < 3) {
      // moored yachts: soft shadow on the water to the south-east, then the boat
      const sprites = boatSprites();
      const smooth = ctx.imageSmoothingQuality;
      ctx.imageSmoothingQuality = "high";
      for (const pass of [0, 1])
        for (const b of this.boats) {
          const sp = sprites[b.v];
          const [w, h] = boatBox(b.len);
          ctx.save();
          if (pass === 0) {
            ctx.translate(b.len * 0.05, -b.len * 0.05);
            ctx.globalAlpha = this._wet ? 0.25 : 0.55;
          }
          ctx.translate(b.x, b.y);
          ctx.rotate(b.a);
          ctx.drawImage(pass === 0 ? sp.shadow : sp.img, -w / 2, -h / 2, w, h);
          ctx.restore();
        }
      ctx.imageSmoothingQuality = smooth;
    } else if (this.hasYachts) {
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

    this.buildings.draw(ctx, px);
    this.buildings.drawTrees(ctx, px);
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
