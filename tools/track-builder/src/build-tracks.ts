/**
 * Build every original track: geometry → corners/knots → optimal line → JSON.
 * Usage: npm run build:tracks
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { APEX_FORMULA, buildTrack, expandGates, lineControls, optimizeLine, prepareTrack, simulateLap, usableHalfWidth } from "@apex/engine";
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
  // Player controls: gates only at corners that slow the car; the rest is interpolated.
  const controls = lineControls(pt);
  track.controls = { complexes: controls.complexes };
  const lim = usableHalfWidth(pt, APEX_FORMULA);
  const project = (z: number[]) => expandGates(pt, controls, z, lim);
  // Coordinate descent finds local minima. Optimise freely first (centerline and
  // minimum-curvature starts), then refine inside the player's control space so
  // the published target is exactly reachable.
  const minCurv = optimizeLine(pt, { objective: (r) => r.samples.curvature.reduce((a, k) => a + k * k, 0) });
  const free = [optimizeLine(pt), optimizeLine(pt, { initial: minCurv.line })];
  const starts = [...free.map((f) => f.line), minCurv.line, { knotOffsets: new Array(pt.k).fill(0) }].map((line) =>
    optimizeLine(pt, { initial: { knotOffsets: project(line.knotOffsets) }, project }),
  );
  const opt = starts.reduce((a, b) => (b.rawLapTimeMs < a.rawLapTimeMs ? b : a));
  opt.evaluations = [...free, ...starts].reduce((a, b) => a + b.evaluations, minCurv.evaluations);
  const result = simulateLap({ track: pt, line: opt.line });
  if (!result.valid) throw new Error(`${spec.id}: optimal line is invalid`);
  track.optimalLine = opt.line;
  track.optimalTimeMs = result.lapTimeMs;

  const file = resolve(outDir, `${track.id}.v${track.version}.json`);
  writeFileSync(file, JSON.stringify(track) + "\n");
  console.log(
    `${track.name} v${track.version}: ${track.lengthMeters.toFixed(0)} m, ${track.corners.length} corners, ` +
      `${track.lineKnots.length} knots, ${controls.complexes.length} corner groups / ${controls.isGate.filter(Boolean).length} gates, target ${fmt(result.lapTimeMs)} ` +
      `(${opt.evaluations} sims, ${((performance.now() - t0) / 1000).toFixed(1)} s) → ${file}`,
  );
}
