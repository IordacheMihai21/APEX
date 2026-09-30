/** Dump built geometry (no optimisation) for visual checks: npx tsx tools/track-builder/src/preview.ts > out.json */
import { buildTrack, prepareTrack, simulateLap } from "@apex/engine";
import { realCircuitSpecs } from "./real-circuits";
const out = realCircuitSpecs().map((spec) => {
  const t = buildTrack(spec);
  const r = simulateLap({ track: prepareTrack(t), line: { knotOffsets: new Array(t.lineKnots.length).fill(0) } });
  return { id: t.id, name: t.name, length: t.lengthMeters, n: t.centerline.length, corners: t.corners.map((c) => [c.apexIndex, c.direction[0]]), knots: t.lineKnots.length, center: t.centerline, speed: Array.from(r.samples.speed, (v) => Math.round(v * 3.6)), centerLap: r.lapTimeMs };
});
console.log(JSON.stringify(out));
