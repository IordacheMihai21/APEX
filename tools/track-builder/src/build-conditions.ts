/**
 * The best line for each non-dry condition (wet, low downforce), written into
 * each track's JSON under `conditions`. Same method as build-tracks: free
 * coordinate descent with that condition's car, then refinement inside the
 * player's control space (expandGates) from several starts, so the target is
 * exactly reachable in the game.
 * Usage: npm run build:conditions [trackId ...]
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONDITION_CARS, type GameTrack, expandGates, optimizeLine, prepareTrack, simulateLap, trackControls, usableHalfWidth } from "@apex/engine";
import { fmt } from "./format";

const dir = resolve(import.meta.dirname, "../../../data/tracks");
const only = process.argv.slice(2);

for (const f of readdirSync(dir).filter((f) => f.endsWith(".v1.json"))) {
  const file = resolve(dir, f);
  const track: GameTrack = JSON.parse(readFileSync(file, "utf8"));
  if (only.length && !only.includes(track.id)) continue;
  const pt = prepareTrack(track);
  const ctl = trackControls(pt);
  track.conditions = {};
  for (const cond of ["wet", "lowdf"] as const) {
    const t0 = performance.now();
    const car = CONDITION_CARS[cond];
    const lim = usableHalfWidth(pt, car);
    const project = (z: number[]) => expandGates(pt, ctl, z, lim);
    const free = optimizeLine(pt, { car, initial: track.optimalLine! });
    const starts = [track.optimalLine!.knotOffsets, free.line.knotOffsets].map((z) => optimizeLine(pt, { car, initial: { knotOffsets: project(z) }, project }));
    const best = starts.reduce((a, b) => (b.rawLapTimeMs < a.rawLapTimeMs ? b : a));
    const lap = simulateLap({ track: pt, line: best.line, car });
    if (!lap.valid) throw new Error(`${track.id} ${cond}: best line is invalid`);
    track.conditions[cond] = { optimalLine: best.line, optimalTimeMs: lap.lapTimeMs };
    const dry = track.optimalTimeMs!;
    console.log(`${track.id.padEnd(14)} ${cond.padEnd(5)} ${fmt(lap.lapTimeMs)}  (dry ${fmt(dry)}, ${lap.lapTimeMs > dry ? "+" : ""}${((lap.lapTimeMs - dry) / 1000).toFixed(2)} s, ${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  }
  writeFileSync(file, JSON.stringify(track) + "\n");
}
