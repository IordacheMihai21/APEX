/**
 * Trees seen from above, drawn procedurally at high resolution, by species:
 * broadleaf crowns built from lobes and hundreds of leaf clumps shaded as a
 * dome lit from the north-west; conifers as a star of needled branches; palms
 * as arching fronds with leaflets. Each sprite gets a shadow cut from its own
 * silhouette, so the shade on the ground has the tree's shape, not a circle.
 *
 * Sprites are drawn y-down with the light from the top-left; the world frame
 * is y-up, so callers flip them vertically to keep the light in the north-west.
 */

export type Species = "broad" | "conifer" | "palm";
export type Flora = "temperate" | "conifer" | "mixed" | "mediterranean" | "tropical";

/** Share of each species around each circuit (the rest is broadleaf). */
export const FLORA_BY_TRACK: Record<string, Flora> = {
  spa: "conifer",
  "red-bull-ring": "conifer",
  suzuka: "mixed",
  zandvoort: "mixed",
  monaco: "mediterranean",
  barcelona: "mediterranean",
  interlagos: "tropical",
  austin: "temperate",
  monza: "temperate",
  imola: "temperate",
  hungaroring: "temperate",
  silverstone: "temperate",
};

const MIX: Record<Flora, { conifer: number; palm: number }> = {
  temperate: { conifer: 0.08, palm: 0 },
  conifer: { conifer: 0.62, palm: 0 },
  mixed: { conifer: 0.35, palm: 0 },
  mediterranean: { conifer: 0.22, palm: 0.38 },
  tropical: { conifer: 0, palm: 0.22 },
};

export function pickSpecies(flora: Flora, r: number): Species {
  const m = MIX[flora];
  return r < m.palm ? "palm" : r < m.palm + m.conifer ? "conifer" : "broad";
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RGB = [number, number, number];
const rgba = ([r, g, b]: RGB, f: number, a = 1) => `rgba(${Math.round(Math.min(255, r * f))},${Math.round(Math.min(255, g * f))},${Math.round(Math.min(255, b * f))},${a})`;

/** Light from the top-left (north-west in the world, after the flip). */
const LX = -0.62;
const LY = -0.62;
const LZ = 0.48;

function sprite(S: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = S;
  return [c, c.getContext("2d")!];
}

/**
 * Broadleaf: an irregular crown (lobes of different sizes), shaded as a dome,
 * then covered in leaf clumps that each catch the light on their own top-left,
 * with dark gaps where the canopy opens.
 */
function broadleaf(seed: number, leaf: RGB, wet: boolean): HTMLCanvasElement {
  const S = 192;
  const [c, ctx] = sprite(S);
  const r = rng(seed);
  const C = S / 2;
  const R = S * 0.42;
  const lobes = Array.from({ length: 7 + Math.floor(r() * 5) }, () => {
    const a = r() * Math.PI * 2;
    const d = R * (0.25 + r() * 0.35);
    return { x: C + Math.cos(a) * d, y: C + Math.sin(a) * d, r: R * (0.42 + r() * 0.22) };
  });
  // silhouette, dark (the shadowed inside of the crown)
  ctx.fillStyle = rgba(leaf, 0.42);
  ctx.beginPath();
  for (const l of lobes) {
    ctx.moveTo(l.x + l.r, l.y);
    ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
  }
  ctx.fill();
  // keep everything after this inside the silhouette
  ctx.globalCompositeOperation = "source-atop";
  // dome shading over the whole crown
  const g = ctx.createRadialGradient(C - R * 0.35, C - R * 0.35, R * 0.05, C, C, R * 1.15);
  g.addColorStop(0, rgba(leaf, 1.25, 0.9));
  g.addColorStop(0.6, rgba(leaf, 0.8, 0.6));
  g.addColorStop(1, rgba(leaf, 0.35, 0.8));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // leaf clumps: lit by the dome normal at their place, each with its own highlight
  const clumps = 260;
  for (let k = 0; k < clumps; k++) {
    const l = lobes[Math.floor(r() * lobes.length)];
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * l.r;
    const x = l.x + Math.cos(a) * d;
    const y = l.y + Math.sin(a) * d;
    const nx = (x - C) / R;
    const ny = (y - C) / R;
    const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
    const lit = Math.max(0, nx * LX + ny * LY + nz * LZ);
    const f = 0.55 + lit * 0.95 + (r() - 0.5) * 0.18;
    const cr = 3.5 + r() * 6.5;
    const cg = ctx.createRadialGradient(x - cr * 0.4, y - cr * 0.4, cr * 0.1, x, y, cr);
    cg.addColorStop(0, rgba(leaf, f * 1.18, 0.95));
    cg.addColorStop(0.7, rgba(leaf, f * 0.85, 0.85));
    cg.addColorStop(1, rgba(leaf, f * 0.5, 0));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(x, y, cr, 0, Math.PI * 2);
    ctx.fill();
  }
  // gaps where the canopy opens: a few dark pockets, more on the shaded side
  for (let k = 0; k < 18; k++) {
    const x = C + (r() - 0.35) * R * 1.4;
    const y = C + (r() - 0.35) * R * 1.4;
    ctx.fillStyle = `rgba(6,14,6,${0.25 + r() * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + r() * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // a wet canopy is darker and a little glossy
  if (wet) {
    ctx.fillStyle = "rgba(10,20,26,0.22)";
    ctx.fillRect(0, 0, S, S);
  }
  ctx.globalCompositeOperation = "source-over";
  return c;
}

/** Conifer from above: a star of needled branch tips around a dark core, blue-green. */
function conifer(seed: number, needle: RGB, wet: boolean): HTMLCanvasElement {
  const S = 192;
  const [c, ctx] = sprite(S);
  const r = rng(seed);
  const C = S / 2;
  const R = S * 0.44;
  ctx.fillStyle = rgba(needle, 0.35);
  ctx.beginPath();
  ctx.arc(C, C, R * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // tiers of branches, outer first (longer, darker), inner last (short, lit)
  for (let tier = 0; tier < 4; tier++) {
    const n = 11 + tier * 3;
    const len = R * (1 - tier * 0.2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.4 + tier * 0.3;
      const l = len * (0.75 + r() * 0.3);
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const lit = Math.max(0, dx * LX + dy * LY) * 0.8 + 0.35 + tier * 0.12;
      const grad = ctx.createLinearGradient(C, C, C + dx * l, C + dy * l);
      grad.addColorStop(0, rgba(needle, 0.4, 1));
      grad.addColorStop(1, rgba(needle, lit * 1.25, 1));
      ctx.fillStyle = grad;
      // a branch: a long thin leaf shape, ragged with needles along its length
      ctx.beginPath();
      ctx.moveTo(C, C);
      const w = l * 0.16;
      for (let s = 1; s <= 8; s++) {
        const t = s / 8;
        const side = (s % 2 ? 1 : 0.55) * w * (1 - t * 0.85);
        ctx.lineTo(C + dx * l * t - dy * side, C + dy * l * t + dx * side);
      }
      ctx.lineTo(C + dx * l, C + dy * l);
      for (let s = 8; s >= 1; s--) {
        const t = s / 8;
        const side = (s % 2 ? 0.55 : 1) * w * (1 - t * 0.85);
        ctx.lineTo(C + dx * l * t + dy * side, C + dy * l * t - dx * side);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  // the leader at the top catches the most light
  const tip = ctx.createRadialGradient(C - 3, C - 3, 0, C, C, R * 0.18);
  tip.addColorStop(0, rgba(needle, 1.4, 0.9));
  tip.addColorStop(1, rgba(needle, 0.7, 0));
  ctx.fillStyle = tip;
  ctx.beginPath();
  ctx.arc(C, C, R * 0.18, 0, Math.PI * 2);
  ctx.fill();
  if (wet) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "rgba(10,20,26,0.22)";
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = "source-over";
  }
  return c;
}

/** Palm from above: arching fronds from a crown, each a rib with leaflets, lighter at the tips. */
function palm(seed: number, frond: RGB, wet: boolean): HTMLCanvasElement {
  const S = 192;
  const [c, ctx] = sprite(S);
  const r = rng(seed);
  const C = S / 2;
  const R = S * 0.46;
  const n = 10 + Math.floor(r() * 4);
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.35;
    const l = R * (0.75 + r() * 0.25);
    const bend = (r() - 0.5) * 0.6;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const lit = Math.max(0, dx * LX + dy * LY) * 0.7 + 0.55;
    // leaflets either side of the rib, drooping, shorter towards the tip
    for (let s = 2; s <= 20; s++) {
      const t = s / 20;
      const bx = C + dx * l * t + -dy * bend * l * t * t;
      const by = C + dy * l * t + dx * bend * l * t * t;
      const ll = l * 0.24 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 1;
      for (const side of [-1, 1]) {
        const ax = Math.cos(a + side * 1.05);
        const ay = Math.sin(a + side * 1.05);
        ctx.strokeStyle = rgba(frond, lit * (0.75 + t * 0.5) * (side < 0 ? 1 : 0.85), 0.9);
        ctx.lineWidth = 1.6 - t * 0.6;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + ax * ll, by + ay * ll);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = rgba(frond, lit * 1.2, 1);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(C, C);
    ctx.quadraticCurveTo(C + dx * l * 0.5 - dy * bend * l * 0.25, C + dy * l * 0.5 + dx * bend * l * 0.25, C + dx * l - dy * bend * l, C + dy * l + dx * bend * l);
    ctx.stroke();
  }
  // the crown where the fronds meet
  const g = ctx.createRadialGradient(C - 2, C - 2, 0, C, C, 9);
  g.addColorStop(0, "#8a7a52");
  g.addColorStop(1, "rgba(60,50,30,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(C, C, 9, 0, Math.PI * 2);
  ctx.fill();
  if (wet) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "rgba(10,20,26,0.2)";
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = "source-over";
  }
  return c;
}

/** A soft shadow from a sprite's silhouette (canvas blur where supported). */
function shadowOf(src: HTMLCanvasElement): HTMLCanvasElement {
  const [sil, sctx] = sprite(src.width);
  sctx.drawImage(src, 0, 0);
  sctx.globalCompositeOperation = "source-in";
  sctx.fillStyle = "#060a08";
  sctx.fillRect(0, 0, sil.width, sil.height);
  const [out, octx] = sprite(src.width);
  octx.filter = "blur(4px)";
  octx.drawImage(sil, 0, 0);
  octx.filter = "none";
  return out;
}

export interface TreeSprite {
  crown: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
  species: Species;
}

const LEAF: RGB[] = [
  [52, 92, 42],
  [62, 100, 46],
  [46, 82, 40],
  [70, 104, 50],
  [58, 86, 38],
];
const NEEDLE: RGB[] = [
  [30, 66, 50],
  [36, 74, 54],
  [26, 58, 46],
];
const FROND: RGB[] = [
  [86, 118, 56],
  [96, 126, 62],
];

/** A set of sprites for one flora: several variants per species it uses. */
export function treeSprites(flora: Flora, wet: boolean): Record<Species, TreeSprite[]> {
  const make = (species: Species, n: number): TreeSprite[] =>
    Array.from({ length: n }, (_, i) => {
      const crown =
        species === "broad" ? broadleaf(11 + i * 7, LEAF[i % LEAF.length], wet) : species === "conifer" ? conifer(23 + i * 5, NEEDLE[i % NEEDLE.length], wet) : palm(37 + i * 3, FROND[i % FROND.length], wet);
      return { crown, shadow: shadowOf(crown), species };
    });
  const m = MIX[flora];
  return { broad: make("broad", 5), conifer: m.conifer ? make("conifer", 3) : [], palm: m.palm ? make("palm", 2) : [] };
}

/**
 * Woodland as a seamless tile: crowns of the flora's species stamped densely
 * with their shadows, over a dark understorey, wrapped at the edges.
 * `metres` is the tile's size in the world; crowns are 6-11 m across.
 */
export function forestTile(flora: Flora, wet: boolean, metres = 120): HTMLCanvasElement {
  const S = 1024;
  const pxm = S / metres;
  const [c, ctx] = sprite(S);
  ctx.fillStyle = wet ? "#0e1a10" : "#132214";
  ctx.fillRect(0, 0, S, S);
  const sprites = treeSprites(flora, wet);
  const r = rng(77);
  const stamps: { x: number; y: number; d: number; s: TreeSprite }[] = [];
  for (let k = 0; k < 900; k++) {
    const sp = pickSpecies(flora, r());
    const list = sprites[sp].length ? sprites[sp] : sprites.broad;
    stamps.push({ x: r() * S, y: r() * S, d: (6 + r() * 5) * pxm, s: list[Math.floor(r() * list.length)] });
  }
  const draw = (img: HTMLCanvasElement, x: number, y: number, d: number) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) if (x + ox > -d && x + ox < S + d && y + oy > -d && y + oy < S + d) ctx.drawImage(img, x + ox - d / 2, y + oy - d / 2, d, d);
  };
  // shadows first (down-right in the sprite frame = south-east in the world), then crowns
  ctx.globalAlpha = wet ? 0.3 : 0.6;
  for (const t of stamps) draw(t.s.shadow, t.x + t.d * 0.22, t.y + t.d * 0.22, t.d * 1.05);
  ctx.globalAlpha = 1;
  for (const t of stamps) draw(t.s.crown, t.x, t.y, t.d);
  return c;
}
