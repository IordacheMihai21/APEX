/**
 * The famous corners in numbers, for their guides (apps/web/src/content/Corners.tsx): for each corner of the Corner of
 * the week list and each condition, as the physics engine drives the condition's perfect line, the speed where the
 * brakes go on, the distance and time from there to the first corner's slowest point, that speed and the slowest of
 * the whole group, the speed 150 m past the group's last corner, and the time from the braking point to there.
 * Output: apps/web/src/game/cornerStats.json (generated).
 * Usage: npm run build:corner-stats
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONDITIONS, CONDITION_CARS, type GameTrack, expandGates, prepareTrack, simulateLap, trackControls, usableHalfWidth } from "@apex/engine";
import { WEEKLY_CORNERS } from "../../../apps/web/src/modes/cornerList";

/** the exit is measured this far past the group's last corner (m) */
const EXIT_M = 150;
const root = resolve(import.meta.dirname, "../../..");
const r1 = (x: number) => Math.round(x * 10) / 10;

/** minKmh: the first corner's slowest point; lowKmh: the whole group's (the same for a single corner) */
type Stats = { entryKmh: number; brakeM: number; brakeS: number; minKmh: number; lowKmh: number; exitKmh: number; timeS: number };
const out: Record<string, { turns: string[]; direction: string; conditions: Record<string, Stats> }> = {};

for (const wc of WEEKLY_CORNERS) {
  const track: GameTrack = JSON.parse(readFileSync(resolve(root, `data/tracks/${wc.trackId}.v1.json`), "utf8"));
  const pt = prepareTrack(track);
  const complex = trackControls(pt).complexes[wc.complex];
  const parts = track.corners.filter((c) => complex.corners.includes(c.name));
  const n = pt.n;
  const ring = (i: number) => ((i % n) + n) % n;
  const conditions: Record<string, Stats> = {};
  for (const cond of CONDITIONS) {
    const car = CONDITION_CARS[cond];
    const line = cond === "dry" ? track.optimalLine! : track.conditions![cond]!.optimalLine;
    const { speed, distance, elapsedMs, curvature } = simulateLap({ track: pt, line: { knotOffsets: expandGates(pt, trackControls(pt), line.knotOffsets, usableHalfWidth(pt, car)) }, car }).samples;
    // the whole lap, closing the loop from the last sample back to the first (samples are about evenly spaced)
    const lapM = distance[n - 1] + (distance[n - 1] - distance[n - 2]);
    const lapMs = elapsedMs[n - 1] + (elapsedMs[n - 1] - elapsedMs[n - 2]);
    // metres and seconds from sample a forward to sample b, across the line if need be
    const ahead = (a: number, b: number, arr: Float64Array, total: number) => (arr[ring(b)] - arr[ring(a)] + total) % total;
    // the first corner's slowest point, then back up the braking curve to where the speed stops rising (as
    // build-corners.ts, but from the first corner, so a chicane's second part doesn't hide the stop from speed)
    const first = parts[0];
    const last = parts[parts.length - 1];
    const firstEnd = first.endIndex < first.startIndex ? first.endIndex + n : first.endIndex;
    const groupEnd = last.endIndex < first.startIndex ? last.endIndex + n : last.endIndex;
    let apex = first.startIndex;
    for (let i = first.startIndex - 40; i <= firstEnd + 5; i++) if (speed[ring(i)] < speed[ring(apex)]) apex = i;
    let peak = apex;
    for (let i = apex - 1; i > apex - 400; i--) {
      if (speed[ring(i)] >= speed[ring(peak)] - 1e-6) peak = i;
      else if (speed[ring(i)] < speed[ring(peak)] - 0.3) break;
    }
    const brake = peak;
    // the slowest point of the whole group, and the way out: EXIT_M past the group's last corner
    let low = apex;
    for (let i = apex; i <= groupEnd + 10; i++) if (speed[ring(i)] < speed[ring(low)]) low = i;
    let exit = groupEnd;
    while (ahead(groupEnd, exit, distance, lapM) < EXIT_M) exit++;
    conditions[cond] = {
      entryKmh: Math.round(speed[ring(brake)] * 3.6),
      brakeM: Math.round(ahead(brake, apex, distance, lapM)),
      brakeS: r1(ahead(brake, apex, elapsedMs, lapMs) / 1000),
      minKmh: Math.round(speed[ring(apex)] * 3.6),
      lowKmh: Math.round(speed[ring(low)] * 3.6),
      exitKmh: Math.round(speed[ring(exit)] * 3.6),
      timeS: r1(ahead(brake, exit, elapsedMs, lapMs) / 1000),
    };
  }
  out[`${wc.trackId}-${wc.complex}`] = { turns: parts.map((p) => p.name), direction: complex.direction, conditions };
  console.log(wc.name.padEnd(28), JSON.stringify(out[`${wc.trackId}-${wc.complex}`]));
}

const file = resolve(root, "apps/web/src/game/cornerStats.json");
writeFileSync(file, JSON.stringify(out));
console.log(`→ ${file}`);
