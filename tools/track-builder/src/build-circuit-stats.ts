/**
 * The perfect lap in numbers, for the circuit guides: on each real circuit and
 * in each condition, the top speed, the slowest point and the share of the lap
 * spent accelerating and braking, as the physics engine drives the condition's
 * perfect line. Output: apps/web/src/game/circuitStats.json (generated).
 * Usage: npx tsx tools/track-builder/src/build-circuit-stats.ts
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONDITIONS, CONDITION_CARS, type GameTrack, prepareTrack, simulateLap } from "@apex/engine";

/** a change of speed smaller than this between samples (m/s) is neither accelerating nor braking */
const STEADY = 0.002;
const dir = resolve(import.meta.dirname, "../../../data/tracks");
const out: Record<string, Record<string, { maxKmh: number; minKmh: number; accelPct: number; brakePct: number }>> = {};

for (const f of readdirSync(dir).filter((f) => f.endsWith(".v1.json"))) {
  const track: GameTrack = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
  if (track.id === "kestrel") continue;
  const pt = prepareTrack(track);
  out[track.id] = {};
  for (const cond of CONDITIONS) {
    const line = cond === "dry" ? track.optimalLine! : track.conditions![cond]!.optimalLine;
    const { speed, elapsedMs } = simulateLap({ track: pt, line, car: CONDITION_CARS[cond] }).samples;
    let accel = 0;
    let brake = 0;
    for (let i = 1; i < speed.length; i++) {
      const dt = elapsedMs[i] - elapsedMs[i - 1];
      const dv = speed[i] - speed[i - 1];
      if (dv > STEADY) accel += dt;
      else if (dv < -STEADY) brake += dt;
    }
    const total = elapsedMs[elapsedMs.length - 1];
    out[track.id][cond] = { maxKmh: Math.round(Math.max(...speed) * 3.6), minKmh: Math.round(Math.min(...speed) * 3.6), accelPct: Math.round((100 * accel) / total), brakePct: Math.round((100 * brake) / total) };
  }
  console.log(track.id.padEnd(14), JSON.stringify(out[track.id]));
}

const file = resolve(import.meta.dirname, "../../../apps/web/src/game/circuitStats.json");
writeFileSync(file, JSON.stringify(out));
console.log(`→ ${file}`);
