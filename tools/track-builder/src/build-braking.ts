/**
 * The braking zones for Braking point: every big stop on each real circuit's
 * perfect lap (dry), as the physics engine drives it. For each zone: the
 * speed along the racing line from the approach to the slowest point of the
 * corner, where the brakes go on, the curvature of the road ahead (to draw
 * it), and where it is on the circuit map. The game replays this speed trace,
 * shifted to wherever the player brakes, so the braking itself is the
 * engine's. Output: apps/web/src/game/braking.json (generated).
 * Usage: npx tsx tools/track-builder/src/build-braking.ts
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type GameTrack, prepareTrack, simulateLap } from "@apex/engine";

/** A stop must shed at least this much speed (m/s, about 80 km/h) to be a braking zone. */
const MIN_DROP = 22.2;
/** The slowest point must be the slowest within this distance either side (m). */
const MIN_WINDOW_M = 120;
/** Run-up before the brakes go on, at most (m), and road drawn past the corner (m). */
const APPROACH_M = 280;
/** A stop needs at least this much straight before it to be playable (m). */
const MIN_RUNUP_M = 120;
const AFTER_M = 160;
const SPEED_STEP_M = 3;
const KAPPA_STEP_M = 4;
const MAX_ZONES = 6;
const BOX = 1000;

const dir = resolve(import.meta.dirname, "../../../data/tracks");
const zones: unknown[] = [];

for (const f of readdirSync(dir).filter((f) => f.endsWith(".v1.json"))) {
  const track: GameTrack = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
  if (track.id === "kestrel") continue; // invented circuit: not in the real-circuit games
  const pt = prepareTrack(track);
  const lap = simulateLap({ track: pt, line: track.optimalLine! });
  const { speed, distance, curvature, x, y } = lap.samples;
  const n = pt.n;
  const total = lap.samples.distance[n - 1] + Math.hypot(x[0] - x[n - 1], y[0] - y[n - 1]);

  // distance from i forward to j around the loop
  const ahead = (i: number, j: number) => (distance[j] - distance[i] + total) % total;
  /** value of arr at distance d along the loop (linear between samples) */
  const at = (arr: ArrayLike<number>, d: number) => {
    d = ((d % total) + total) % total;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (distance[mid] <= d) lo = mid;
      else hi = mid - 1;
    }
    const j = (lo + 1) % n;
    const seg = j === 0 ? total - distance[lo] : distance[j] - distance[lo];
    const t = seg > 0 ? (d - distance[lo]) / seg : 0;
    return arr[lo] + (arr[j] - arr[lo]) * t;
  };

  // the map transform of build-outlines (north-up box on the centreline, y flipped)
  const xs = [...pt.cx];
  const ys = [...pt.cy];
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const s = (BOX * 0.86) / Math.max(x1 - x0, y1 - y0);
  const ox = (BOX - (x1 - x0) * s) / 2;
  const oy = (BOX - (y1 - y0) * s) / 2;
  const P = (px: number, py: number): [number, number] => [Math.round(ox + (px - x0) * s), Math.round(oy + (y1 - py) * s)];

  // corner groups (the game's grading unit), to name a zone after its corner
  const corners = track.corners;
  const complexes = track.controls?.complexes ?? [];
  const startOf = (k: number) => corners.find((c) => c.name === complexes[k].corners[0])!.timingStartIndex;
  const complexAt = (i: number) => {
    let best = -1;
    let bestAhead = Infinity;
    for (let k = 0; k < complexes.length; k++) {
      const a = (i - startOf(k) + n) % n; // samples since group k began
      if (a < bestAhead) {
        bestAhead = a;
        best = k;
      }
    }
    return best;
  };

  const found: { drop: number; rec: Record<string, unknown> }[] = [];
  for (let i = 0; i < n; i++) {
    // the slowest point of a corner: slowest within MIN_WINDOW_M either side
    let isMin = true;
    for (let o = 1; isMin; o++) {
      const a = (i + o) % n;
      const b = (i - o + n) % n;
      if (ahead(i, a) > MIN_WINDOW_M) break;
      if (speed[a] < speed[i] || speed[b] <= speed[i]) isMin = false; // ties go to the first sample
    }
    if (!isMin) continue;
    // back up to where the brakes went on (the peak before the stop)
    let j = i;
    for (let guard = 0; guard < n; guard++) {
      const p = (j - 1 + n) % n;
      if (speed[p] < speed[j] - 1e-6) break;
      j = p;
    }
    const drop = speed[j] - speed[i];
    if (drop < MIN_DROP) continue;

    const dMin = distance[i];
    const brakeM = ahead(j, i);
    // the run-up: up to APPROACH_M before the brakes, but not back past the previous slow corner
    let runUp = 0;
    for (let d = SPEED_STEP_M; d <= APPROACH_M; d += SPEED_STEP_M) {
      const v = at(speed, dMin - brakeM - d);
      // stop at the previous corner, or at an earlier stop (the run-up only accelerates)
      if (v < speed[i] + 0.35 * drop || v > at(speed, dMin - brakeM - d + SPEED_STEP_M) + 0.05) break;
      runUp = d;
    }
    if (runUp < MIN_RUNUP_M) continue; // no time to see it coming
    const from = -(brakeM + runUp);
    const speeds: number[] = [];
    for (let d = from; d <= 0.001; d += SPEED_STEP_M) speeds.push(Math.round(at(speed, dMin + d) * 36) / 10); // km/h, 0.1
    const kappa: number[] = [];
    for (let d = from; d <= AFTER_M; d += KAPPA_STEP_M) kappa.push(Math.round(at(curvature, dMin + d) * 1e5));
    const k = complexAt(i);
    found.push({
      drop,
      rec: {
        track: track.id,
        complex: k,
        group: complexes[k]?.name ?? null,
        direction: curvature[i] > 0 ? "left" : "right",
        lapM: Math.round(dMin),
        /** metres from the slowest point back to where the brakes go on */
        brakeM: Math.round(brakeM * 10) / 10,
        /** start of the run-up, metres before the slowest point (negative) */
        from: Math.round(from * 10) / 10,
        /** index in speeds where the brakes go on */
        brakeIndex: runUp / SPEED_STEP_M,
        speedStep: SPEED_STEP_M,
        speeds,
        kappaStep: KAPPA_STEP_M,
        kappa,
        map: P(x[i], y[i]),
        mapFrom: P(x[j], y[j]),
      },
    });
  }
  // the biggest stops, in lap order
  const keep = found.sort((a, b) => b.drop - a.drop).slice(0, MAX_ZONES).map((z) => z.rec);
  keep.sort((a, b) => (a.lapM as number) - (b.lapM as number));
  keep.forEach((z, idx) => (z.order = idx + 1));
  zones.push(...keep);
  console.log(`${track.id.padEnd(14)} ${keep.map((z) => `${z.group} ${(z.speeds as number[])[z.brakeIndex as number]}→${(z.speeds as number[]).at(-1)} in ${z.brakeM} m`).join("  ")}`);
}

const outFile = resolve(import.meta.dirname, "../../../apps/web/src/game/braking.json");
writeFileSync(outFile, JSON.stringify(zones));
console.log(`${zones.length} zones → ${outFile}`);
