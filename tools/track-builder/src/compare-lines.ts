/**
 * Phase 1 go/no-go report: run many qualitatively different lines on a
 * track and check that good racecraft wins for understandable reasons.
 * Usage: npm run compare [trackId]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  APEX_FORMULA,
  type GameTrack,
  type RacingLine,
  type Vec2,
  compareRuns,
  fitDrawing,
  optimizeLine,
  prepareTrack,
  simulateLap,
  usableHalfWidth,
} from "@apex/engine";
import { fmt, signed } from "./format";

const id = process.argv[2] ?? "kestrel";
const track: GameTrack = JSON.parse(readFileSync(resolve(import.meta.dirname, `../../../data/tracks/${id}.v1.json`), "utf8"));
// Note: shortest-path and min-curvature lines are re-optimised here, which takes a while on real circuits.
const pt = prepareTrack(track);
const car = APEX_FORMULA;
const lim = usableHalfWidth(pt, car);
const optimal: RacingLine = track.optimalLine!;
const ref = simulateLap({ track: pt, line: optimal });

/** Offsets per centerline index → drawn points → fitted line (the real input pipeline). */
function viaDrawing(off: ArrayLike<number>): RacingLine {
  const pts: Vec2[] = [];
  for (let i = 0; i <= pt.n; i++) {
    const j = i % pt.n;
    pts.push([pt.cx[j] + off[j] * pt.nx[j], pt.cy[j] + off[j] * pt.ny[j]]);
  }
  const fit = fitDrawing(pt, pts, car);
  if (!fit.valid) throw new Error(`fit failed: ${fit.status}`);
  return fit.line;
}
const optOff = simulateLap({ track: pt, line: optimal }).samples.offset;
const shifted = (m: number) => {
  const sh = Math.round(m / pt.step);
  return viaDrawing(Array.from(optOff, (_, i) => optOff[(i - sh + pt.n) % pt.n]));
};
// Turn direction per centerline index: +1 left, −1 right, 0 straight.
const centerK = simulateLap({ track: pt, line: { knotOffsets: new Array(pt.k).fill(0) } }).samples.curvature.map((k) =>
  Math.abs(k) > 1 / 400 ? Math.sign(k) : 0,
);

const lines: [string, RacingLine][] = [
  ["Optimal (min lap time)", optimal],
  ["Centerline", { knotOffsets: new Array(pt.k).fill(0) }],
  [
    "Shortest path",
    optimizeLine(pt, { objective: (r) => r.samples.distance[pt.n - 1] + Math.hypot(r.samples.x[0] - r.samples.x[pt.n - 1], r.samples.y[0] - r.samples.y[pt.n - 1]) }).line,
  ],
  [
    "Minimum curvature",
    optimizeLine(pt, { objective: (r) => r.samples.curvature.reduce((a, k) => a + k * k, 0) }).line,
  ],
  ["Hug inside of every corner", viaDrawing(Array.from(centerK, (s) => s * lim))],
  ["Hug outside of every corner", viaDrawing(Array.from(centerK, (s) => -s * lim))],
  ["Optimal, every apex 12 m early", shifted(-12)],
  ["Optimal, every apex 12 m late", shifted(12)],
  ["Optimal, every apex 25 m early", shifted(-25)],
  ["Optimal, every apex 25 m late", shifted(25)],
];

console.log(`\n${track.name} v${track.version} — ${track.lengthMeters.toFixed(0)} m, ${track.widthMeters} m wide, ${pt.k} knots, physics ${ref.physicsVersion}`);
console.log(`\n${"Line".padEnd(32)} ${"Lap".padStart(8)} ${"Δ".padStart(8)} ${"Length".padStart(8)} ${"Min".padStart(6)} ${"Top".padStart(6)}  km/h`);
for (const [name, line] of lines) {
  const r = simulateLap({ track: pt, line });
  const len = r.samples.distance[pt.n - 1];
  const vmin = Math.min(...r.samples.speed) * 3.6;
  const vmax = Math.max(...r.samples.speed) * 3.6;
  console.log(
    `${name.padEnd(32)} ${fmt(r.lapTimeMs).padStart(8)} ${signed(r.lapTimeMs - ref.lapTimeMs).padStart(8)} ${len.toFixed(0).padStart(7)}m ${vmin.toFixed(0).padStart(6)} ${vmax.toFixed(0).padStart(6)}${r.valid ? "" : "  " + r.status}`,
  );
}

// Per-corner feedback example: early apex everywhere
const early = simulateLap({ track: pt, line: shifted(-12) });
const cmp = compareRuns(early, ref);
console.log(`\nFeedback example ("apex 12 m early"): ${signed(cmp.lapDeltaMs)} s total`);
for (const c of cmp.corners) console.log(`  ${c.name.padEnd(4)} ${signed(c.deltaMs)}`);

// Hand-drawn noise: seeded, at several on-screen track widths.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function drawNoisy(base: ArrayLike<number>, noiseM: number, rnd: () => number): Vec2[] {
  const waves = Array.from({ length: 6 }, () => ({ wl: 15 + 40 * rnd(), ph: 6.283 * rnd() }));
  const wob = Array.from({ length: pt.n }, (_, i) => waves.reduce((a, w) => a + Math.sin((6.283 * i) / w.wl + w.ph), 0));
  const sd = Math.sqrt(wob.reduce((a, v) => a + v * v, 0) / pt.n);
  const pts: Vec2[] = [];
  for (let i = 0; i <= pt.n; i++) {
    const j = i % pt.n;
    const gauss = Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(6.283 * rnd());
    const o = base[j] + (wob[j] / sd) * noiseM + gauss * noiseM * 0.5;
    pts.push([pt.cx[j] + o * pt.nx[j], pt.cy[j] + o * pt.ny[j]]);
  }
  return pts;
}
const xs = pt.cx, ys = pt.cy;
const bbox = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
console.log(`\nHand-drawn noise, player aiming for the optimal line (12 attempts each, mean ± sd, invalid %):`);
for (const trackPx of [22, 40, 60]) {
  const pxToM = track.widthMeters / trackPx;
  const cells: string[] = [];
  for (const noisePx of [2, 4, 6]) {
    const rnd = mulberry32(1000 * trackPx + noisePx);
    const deltas: number[] = [];
    let invalid = 0;
    for (let a = 0; a < 12; a++) {
      const fit = fitDrawing(pt, drawNoisy(optOff, noisePx * pxToM, rnd), car);
      const r = simulateLap({ track: pt, line: fit.line });
      if (!fit.valid || !r.valid) invalid++;
      deltas.push(r.lapTimeMs - ref.lapTimeMs);
    }
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const sd = Math.sqrt(deltas.reduce((a, b) => a + (b - mean) * (b - mean), 0) / deltas.length);
    cells.push(`${noisePx}px ${signed(mean)}±${(sd / 1000).toFixed(2)} ${Math.round((100 * invalid) / 12)}%`);
  }
  console.log(`  track ${String(trackPx).padStart(2)} px wide (screen bbox ≈ ${Math.round((bbox / track.widthMeters) * trackPx)} px): ${cells.join(" | ")}`);
}
