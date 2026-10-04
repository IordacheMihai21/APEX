/**
 * Procedural materials for the satellite view, generated once at startup.
 *
 * Every texture is tileable and built from fractal value noise (several
 * octaves, so there is structure at every scale) rather than plain per-pixel
 * noise, which reads as TV static. Each material then gets the thing that makes
 * it recognisable from above: blades and dry patches in grass, aggregate in
 * asphalt, lit-and-shadowed pebbles in gravel, slab joints and stains in
 * concrete, ripples and glints on water, courses of tiles on a roof.
 * A separate macro layer (very low frequency) is laid over the ground so a
 * repeating tile never shows.
 */
/** Deterministic PRNG (same as scenery's), so materials look the same on every load. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RGB = [number, number, number];

/** Tileable value noise on a period-p lattice, smoothstep-interpolated. */
function valueNoise(period: number, seed: number) {
  const r = rng(seed);
  const lat = Float32Array.from({ length: period * period }, () => r());
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const m = (v: number) => ((v % period) + period) % period;
    const a = lat[m(yi) * period + m(xi)];
    const b = lat[m(yi) * period + m(xi + 1)];
    const c = lat[m(yi + 1) * period + m(xi)];
    const d = lat[m(yi + 1) * period + m(xi + 1)];
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
  };
}

/** Fractal noise in 0..1, tileable over `size` pixels; `cells` is the coarsest lattice. */
export function fbm(size: number, cells: number, octaves: number, seed: number) {
  const layers = Array.from({ length: octaves }, (_, o) => ({ n: valueNoise(cells << o, seed + o * 101), f: (cells << o) / size, a: Math.pow(0.5, o) }));
  const norm = layers.reduce((s, l) => s + l.a, 0);
  return (x: number, y: number) => {
    let v = 0;
    for (const l of layers) v += l.n(x * l.f, y * l.f) * l.a;
    return v / norm;
  };
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Paint a field: colour from a function of (x, y), written straight to pixels. */
function field(size: number, colour: (x: number, y: number) => RGB): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const [c, ctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const [r, g, b] = colour(x, y);
      const i = (y * size + x) * 4;
      img.data[i] = clamp(r);
      img.data[i + 1] = clamp(g);
      img.data[i + 2] = clamp(b);
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return [c, ctx];
}

/** Draw `fn` at (x, y) and at its wrapped copies, so marks crossing an edge tile seamlessly. */
function wrapped(size: number, x: number, y: number, rad: number, fn: (x: number, y: number) => void) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) if (x + ox > -rad && x + ox < size + rad && y + oy > -rad && y + oy < size + rad) fn(x + ox, y + oy);
}

/**
 * Grass from above: a cool-to-warm spread of greens at several scales, darker
 * clumps, a few sun-dried patches, and thousands of short blades catching the
 * light from the north-west.
 */
function grassGen(seed = 41, wet = false): HTMLCanvasElement {
  const S = 512;
  const big = fbm(S, 4, 5, seed);
  const fine = fbm(S, 32, 3, seed + 7);
  const dry = fbm(S, 3, 3, seed + 13);
  const deep: RGB = wet ? [28, 50, 30] : [34, 60, 30];
  const lush: RGB = wet ? [40, 68, 38] : [54, 86, 40];
  const straw: RGB = [104, 104, 62];
  const [c, ctx] = field(S, (x, y) => {
    const v = big(x, y);
    let col = mix(deep, lush, Math.min(1, Math.max(0, (v - 0.25) * 1.9)));
    const d = dry(x, y);
    if (!wet && d > 0.62) col = mix(col, straw, Math.min(0.45, (d - 0.62) * 2.2));
    const f = (fine(x, y) - 0.5) * 22;
    return [col[0] + f * 0.7, col[1] + f, col[2] + f * 0.5];
  });
  // blades: short strokes, lit tips and shaded roots
  const r = rng(seed + 3);
  ctx.lineCap = "round";
  for (let k = 0; k < 9000; k++) {
    const x = r() * S;
    const y = r() * S;
    const a = -0.9 + (r() - 0.5) * 1.4;
    const len = 1.5 + r() * 3;
    const lit = r() < 0.55;
    ctx.strokeStyle = lit ? `rgba(150,190,110,${0.1 + r() * 0.18})` : `rgba(10,24,10,${0.12 + r() * 0.2})`;
    ctx.lineWidth = 0.6 + r() * 0.6;
    wrapped(S, x, y, 6, (cx, cy) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      ctx.stroke();
    });
  }
  return c;
}

/**
 * Asphalt: a cool dark grey with large faint stains, fine aggregate (bright
 * stone chips and dark voids), and the odd lighter chip that catches the sun.
 */
function asphaltGen(base: RGB, seed = 51, wet = false): HTMLCanvasElement {
  const S = 512;
  const stain = fbm(S, 3, 4, seed);
  const grain = fbm(S, 128, 2, seed + 5);
  const k = wet ? 0.72 : 1;
  const [c, ctx] = field(S, (x, y) => {
    const s = (stain(x, y) - 0.5) * 16;
    const g = (grain(x, y) - 0.5) * 26;
    return [(base[0] + s + g) * k, (base[1] + s + g) * k, (base[2] + s * 1.1 + g) * k];
  });
  const r = rng(seed + 9);
  for (let n = 0; n < 5200; n++) {
    const x = r() * S;
    const y = r() * S;
    const bright = r() < 0.45;
    const v = bright ? 150 + r() * 70 : 8 + r() * 14;
    ctx.fillStyle = `rgba(${v},${v},${v + (bright ? 4 : 0)},${bright ? 0.22 + r() * 0.25 : 0.4 + r() * 0.3})`;
    const s = 0.7 + r() * 1.3;
    ctx.fillRect(x, y, s, s);
  }
  return c;
}

/** Gravel trap: pebbles with a lit top and a shadowed foot, in a spread of stone colours. */
function gravelGen(seed = 61, wet = false): HTMLCanvasElement {
  const S = 512;
  const tone = fbm(S, 6, 3, seed);
  const k = wet ? 0.74 : 1;
  const [c, ctx] = field(S, (x, y) => {
    const t = (tone(x, y) - 0.5) * 30;
    return [(150 + t) * k, (134 + t) * k, (108 + t * 0.9) * k];
  });
  const r = rng(seed + 4);
  const stones: RGB[] = [
    [196, 182, 156],
    [168, 154, 128],
    [140, 128, 108],
    [210, 200, 184],
    [120, 112, 100],
    [182, 160, 126],
  ];
  for (let n = 0; n < 7000; n++) {
    const x = r() * S;
    const y = r() * S;
    const rx = 1.4 + r() * 2.8;
    const ry = rx * (0.6 + r() * 0.4);
    const rot = r() * Math.PI;
    const [sr, sg, sb] = stones[Math.floor(r() * stones.length)].map((v) => v * k) as RGB;
    wrapped(S, x, y, 8, (cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = "rgba(30,24,16,0.35)";
      ctx.beginPath();
      ctx.ellipse(0.8, 0.9, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(-rx * 0.35, -ry * 0.35, 0.2, 0, 0, rx);
      g.addColorStop(0, `rgb(${Math.min(255, sr * 1.25)},${Math.min(255, sg * 1.25)},${Math.min(255, sb * 1.25)})`);
      g.addColorStop(1, `rgb(${sr * 0.7},${sg * 0.7},${sb * 0.7})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }
  return c;
}

/** Urban paving: slab joints, weathering stains, a few repaired slabs, fine grit. */
function concreteGen(base: RGB, seed = 71, slabPx = 64): HTMLCanvasElement {
  const S = 512;
  const stain = fbm(S, 4, 4, seed);
  const grit = fbm(S, 128, 2, seed + 2);
  const [c, ctx] = field(S, (x, y) => {
    const s = (stain(x, y) - 0.5) * 22;
    const g = (grit(x, y) - 0.5) * 12;
    return [base[0] + s + g, base[1] + s + g, base[2] + s * 0.9 + g];
  });
  const r = rng(seed + 6);
  // a few slabs a shade different (replaced over the years)
  for (let n = 0; n < 9; n++) {
    const sx = Math.floor(r() * (S / slabPx)) * slabPx;
    const sy = Math.floor(r() * (S / slabPx)) * slabPx;
    ctx.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(sx, sy, slabPx, slabPx);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 1.5;
  for (let k2 = 0; k2 <= S; k2 += slabPx) {
    ctx.beginPath();
    ctx.moveTo(k2, 0);
    ctx.lineTo(k2, S);
    ctx.moveTo(0, k2);
    ctx.lineTo(S, k2);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  for (let k2 = 1.5; k2 <= S; k2 += slabPx) {
    ctx.beginPath();
    ctx.moveTo(k2, 0);
    ctx.lineTo(k2, S);
    ctx.moveTo(0, k2);
    ctx.lineTo(S, k2);
    ctx.stroke();
  }
  return c;
}

/**
 * Water from above: a deep base, ripple bands warped by noise (so they never
 * line up), lighter crests, and scattered sun glints.
 */
function waterGen(base: RGB, seed = 81, calm = false): HTMLCanvasElement {
  const S = 512;
  const warp = fbm(S, 4, 3, seed);
  const swell = fbm(S, 8, 4, seed + 3);
  const amp = calm ? 0.5 : 1;
  const [c, ctx] = field(S, (x, y) => {
    const w = warp(x, y) * 6;
    // two wave trains crossing at an angle, both tileable (integer cycles per tile)
    const a = Math.sin(((x + y * 0.35) / S) * Math.PI * 2 * 18 + w);
    const b = Math.sin(((x * 0.4 - y) / S) * Math.PI * 2 * 11 + w * 1.3);
    const crest = Math.max(0, a * 0.6 + b * 0.4) ** 3;
    const s = (swell(x, y) - 0.5) * 18;
    return [base[0] + s + crest * 26 * amp, base[1] + s + crest * 34 * amp, base[2] + s * 1.2 + crest * 40 * amp];
  });
  const r = rng(seed + 8);
  for (let n = 0; n < (calm ? 120 : 420); n++) {
    const x = r() * S;
    const y = r() * S;
    ctx.fillStyle = `rgba(230,240,245,${0.25 + r() * 0.45})`;
    ctx.fillRect(x, y, 1 + r() * 2.5, 0.8);
  }
  return c;
}

/** Roof tiles: courses of curved clay tiles, each course lit on top and shaded below. */
function roofTilesGen(seed = 91): HTMLCanvasElement {
  const S = 128;
  const [c, ctx] = canvas(S);
  const r = rng(seed);
  const course = 8;
  for (let y = 0; y < S; y += course) {
    for (let x = (y / course) % 2 ? -6 : 0; x < S; x += 12) {
      const v = 0.85 + r() * 0.3;
      const g = ctx.createLinearGradient(0, y, 0, y + course);
      g.addColorStop(0, `rgba(255,236,220,${0.32 * v})`);
      g.addColorStop(0.55, "rgba(255,255,255,0)");
      g.addColorStop(1, `rgba(40,16,8,${0.45 * v})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 12, course);
      ctx.fillStyle = "rgba(30,12,6,0.35)";
      ctx.fillRect(x, y, 1, course);
    }
  }
  return c;
}

/** Flat roof membrane: gravel ballast or bitumen, mottled, with seams. */
function roofMembraneGen(seed = 95): HTMLCanvasElement {
  const S = 256;
  const tone = fbm(S, 4, 4, seed);
  const grit = fbm(S, 64, 2, seed + 1);
  const [c, ctx] = field(S, (x, y) => {
    const t = (tone(x, y) - 0.5) * 50 + (grit(x, y) - 0.5) * 30;
    return [128 + t, 128 + t, 128 + t];
  });
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  for (let k = 0; k <= S; k += 32) {
    ctx.beginPath();
    ctx.moveTo(0, k);
    ctx.lineTo(S, k);
    ctx.stroke();
  }
  return c;
}

/**
 * Macro variation for the ground: 0..1 luminance at a very low frequency,
 * drawn over the land in multiply at low strength, so repeating tiles vanish
 * and the land has the large-scale patchiness of a real aerial photo.
 */
function macroGen(seed = 101): HTMLCanvasElement {
  const S = 256;
  const n = fbm(S, 3, 4, seed);
  const [c] = field(S, (x, y) => {
    const v = 128 + (n(x, y) - 0.5) * 170; // centred on mid-grey: neutral under soft-light
    return [v, v, v];
  });
  return c;
}

/**
 * Cloud shadows: soft dark islands with ragged edges and clear sky between,
 * as an alpha map (black, transparent where the sun is out).
 */
function cloudShadowsGen(seed = 111): HTMLCanvasElement {
  const S = 256;
  const n = fbm(S, 3, 5, seed);
  const [c, ctx] = canvas(S);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = n(x, y);
      const a = Math.max(0, Math.min(1, (v - 0.52) * 5));
      const i = (y * S + x) * 4;
      img.data[i] = 10;
      img.data[i + 1] = 16;
      img.data[i + 2] = 28;
      img.data[i + 3] = Math.round(a * a * (3 - 2 * a) * 255);
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Generation costs 10-150 ms per texture, so each one is made once per page
 * and reused by every later session (a new circuit or a retry starts instantly).
 * Callers only read the canvases, as pattern sources.
 */
function memo<A extends unknown[]>(gen: (...a: A) => HTMLCanvasElement): (...a: A) => HTMLCanvasElement {
  const made = new Map<string, HTMLCanvasElement>();
  return (...a: A) => {
    const key = JSON.stringify(a);
    let c = made.get(key);
    if (!c) made.set(key, (c = gen(...a)));
    return c;
  };
}

export const grass = memo(grassGen);
export const asphalt = memo(asphaltGen);
export const gravel = memo(gravelGen);
export const concrete = memo(concreteGen);
export const water = memo(waterGen);
export const roofTiles = memo(roofTilesGen);
export const roofMembrane = memo(roofMembraneGen);
export const macro = memo(macroGen);
export const cloudShadows = memo(cloudShadowsGen);
