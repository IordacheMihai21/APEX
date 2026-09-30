/**
 * Build every original track: geometry → corners/knots → optimal line → JSON.
 * Usage: npm run build:tracks
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildTrack, optimizeLine, prepareTrack, simulateLap } from "@apex/engine";
import { TRACKS } from "./tracks";
import { realCircuitSpecs } from "./real-circuits";
import { fmt } from "./format";

const outDir = resolve(import.meta.dirname, "../../../data/tracks");
mkdirSync(outDir, { recursive: true });

const only = process.argv.slice(2);
const specs = [...TRACKS, ...realCircuitSpecs()].filter((s) => only.length === 0 || only.includes(s.id));

for (const spec of specs) {
  const t0 = performance.now();
  const track = buildTrack(spec);
  const pt = prepareTrack(track);
  // Coordinate descent finds local minima: start from the centerline and from the
  // minimum-curvature line, keep the faster.
  const minCurv = optimizeLine(pt, { objective: (r) => r.samples.curvature.reduce((a, k) => a + k * k, 0) });
  const starts = [optimizeLine(pt), optimizeLine(pt, { initial: minCurv.line })];
  const opt = starts.reduce((a, b) => (b.rawLapTimeMs < a.rawLapTimeMs ? b : a));
  opt.evaluations = starts.reduce((a, b) => a + b.evaluations, minCurv.evaluations);
  const result = simulateLap({ track: pt, line: opt.line });
  if (!result.valid) throw new Error(`${spec.id}: optimal line is invalid`);
  track.optimalLine = opt.line;
  track.optimalTimeMs = result.lapTimeMs;

  const file = resolve(outDir, `${track.id}.v${track.version}.json`);
  writeFileSync(file, JSON.stringify(track) + "\n");
  console.log(
    `${track.name} v${track.version}: ${track.lengthMeters.toFixed(0)} m, ${track.corners.length} corners, ` +
      `${track.lineKnots.length} knots, optimal ${fmt(result.lapTimeMs)} ` +
      `(${opt.evaluations} sims, ${((performance.now() - t0) / 1000).toFixed(1)} s) → ${file}`,
  );
}
