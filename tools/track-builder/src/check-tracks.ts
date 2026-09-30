/**
 * Quality gate for every built track: racecraft invariants + pace sanity.
 * Usage: npx tsx tools/track-builder/src/check-tracks.ts [id...]
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { APEX_FORMULA as car, type GameTrack, type RacingLine, type Vec2, fitDrawing, prepareTrack, simulateLap, usableHalfWidth } from "@apex/engine";
import { fmt } from "./format";

/**
 * Approximate real-world pole laps (2025 qualifying, rounded). Reference only:
 * used to sanity-check pace, never shown as official data.
 */
export const REFERENCE_POLE_MS: Record<string, number> = {
  monza: 78_792, spa: 100_562, silverstone: 84_892, suzuka: 86_983, monaco: 69_954, interlagos: 69_511,
  hungaroring: 75_372, "red-bull-ring": 63_971, zandvoort: 68_662, austin: 92_510, barcelona: 71_546, imola: 74_670,
};

if (import.meta.url === `file://${process.argv[1]}`) main();
function main() {
const dir = resolve(import.meta.dirname, "../../../data/tracks");
const only = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith(".json") && (only.length === 0 || only.includes(f.split(".")[0])));

const rows: string[] = [];
let failures = 0;
for (const f of files) {
  const track: GameTrack = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
  const pt = prepareTrack(track);
  const opt = simulateLap({ track: pt, line: track.optimalLine! });
  const draw = (off: ArrayLike<number>): RacingLine => {
    const p: Vec2[] = [];
    for (let i = 0; i <= pt.n; i++) {
      const j = i % pt.n;
      p.push([pt.cx[j] + off[j] * pt.nx[j], pt.cy[j] + off[j] * pt.ny[j]]);
    }
    return fitDrawing(pt, p, car).line;
  };
  const shift = (m: number) => {
    const s = Math.round(m / pt.step);
    const o = opt.samples.offset;
    return simulateLap({ track: pt, line: draw(Array.from(o, (_, i) => o[(i - s + pt.n) % pt.n])) }).lapTimeMs;
  };
  const lim = usableHalfWidth(pt, car);
  const centerCurv = simulateLap({ track: pt, line: { knotOffsets: new Array(pt.k).fill(0) } });
  const inside = simulateLap({
    track: pt,
    line: draw(Array.from(centerCurv.samples.curvature, (k) => (Math.abs(k) > 1 / 400 ? Math.sign(k) * lim : 0))),
  }).lapTimeMs;
  const center = centerCurv.lapTimeMs;
  const early = shift(-12);
  const late = shift(12);
  const t = opt.lapTimeMs;
  // Informational (not a gate): on corners that lead onto a straight >= 250 m,
  // where does the optimal line apex relative to the geometric apex
  // (centerline curvature peak)? Positive = later. Noisy on traced geometry
  // and compound corners, so exit priority is enforced by the controlled
  // unit tests (racing.test.ts) instead.
  const o = opt.samples.offset;
  const n = pt.n;
  const idxDist = (a: number, b: number) => ((b - a + n) % n) * pt.step;
  let exitCorners = 0;
  let exitWins = 0;
  const lateness: number[] = [];
  track.corners.forEach((c, j) => {
    const next = track.corners[(j + 1) % track.corners.length];
    if (idxDist(c.endIndex, next.startIndex) < 250) return;
    const side = c.direction === "left" ? 1 : -1; // inside edge sign
    const from = (c.startIndex - Math.round(30 / pt.step) + n) % n;
    const len = Math.round(idxDist(from, c.endIndex) / pt.step + 30 / pt.step);
    let best = -Infinity;
    for (let q = 0; q <= len; q++) best = Math.max(best, side * o[(from + q) % n]);
    // centre of the plateau within 0.2 m of the closest approach to the inside
    const near: number[] = [];
    for (let q = 0; q <= len; q++) if (side * o[(from + q) % n] >= best - 0.2) near.push(q);
    const apexQ = near.reduce((a, b) => a + b, 0) / near.length;
    const geoQ = idxDist(from, c.apexIndex) / pt.step;
    const late = (apexQ - geoQ) * pt.step;
    lateness.push(late);
    exitCorners++;
    if (late > 0) exitWins++;
  });
  const checks = {
    valid: opt.valid && opt.lapTimeMs === track.optimalTimeMs,
    "centerline slower": center > t + 1000,
    "inside slower": inside > t + 500,
    "apex errors cost time": early > t + 300 && late > t + 300,
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  failures += failed.length;
  const pole = REFERENCE_POLE_MS[track.id];
  const d = (x: number) => `+${((x - t) / 1000).toFixed(2)}`;
  rows.push(
    [
      track.name.padEnd(18),
      fmt(t).padStart(8),
      pole ? `${fmt(pole)} (${((100 * (t - pole)) / pole >= 0 ? "+" : "")}${((100 * (t - pole)) / pole).toFixed(1)}%)`.padStart(18) : "".padStart(18),
      d(center).padStart(7),
      d(inside).padStart(7),
      d(early).padStart(7),
      d(late).padStart(7),
      `${exitWins}/${exitCorners}`.padStart(5),
      lateness.map((m) => `${m >= 0 ? "+" : ""}${Math.round(m)}`).join(" ").padEnd(24),
      failed.length ? `FAIL: ${failed.join(", ")}` : "ok",
    ].join("  "),
  );
}
console.log(
  ["Track".padEnd(18), "Optimal".padStart(8), "Real pole (≈)".padStart(18), "Center".padStart(7), "Inside".padStart(7), "Early".padStart(7), "Late".padStart(7), "Late".padStart(5), "Apex vs geometric (m)".padEnd(24), "Checks"].join("  "),
);
for (const r of rows) console.log(r);
if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
}
