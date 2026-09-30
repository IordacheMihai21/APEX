import { type RacingLine, enforceLimits, usableHalfWidth } from "../line/line";
import { APEX_FORMULA, type CarModel } from "../physics/car";
import { type SimulationResult, simulateLap } from "../physics/simulate";
import type { PreparedTrack } from "../track/prepare";

export interface OptimizeOptions {
  car?: CarModel;
  initial?: RacingLine;
  startStepM?: number;
  minStepM?: number;
  maxEvaluations?: number;
  /** What to minimise (default: raw lap time). Used to build comparison lines. */
  objective?: (r: SimulationResult) => number;
  /**
   * Map a candidate knot vector to a valid one (default: enforceLimits).
   * E.g. expandGates, to optimise only the player-controlled gates.
   */
  project?: (z: number[]) => number[];
}

export interface OptimizeResult {
  line: RacingLine;
  /** Objective value of the result (lap time in ms by default). */
  rawLapTimeMs: number;
  evaluations: number;
}

/**
 * Minimum-lap-time racing line by coordinate descent over knot offsets,
 * scored by the same simulateLap the game uses (score = simulated time,
 * never geometric similarity). Deterministic; good enough for tracks with
 * a few dozen knots. Every candidate is projected back inside the track
 * limits (enforceLimits) rather than rejected, so the search can slide
 * along the track edge; offsets stay on the centimetre grid players submit.
 */
export function optimizeLine(pt: PreparedTrack, opts: OptimizeOptions = {}): OptimizeResult {
  const car = opts.car ?? APEX_FORMULA;
  const lim = usableHalfWidth(pt, car);
  const project = opts.project ?? ((z: number[]) => enforceLimits(pt, z, lim));
  let evaluations = 0;
  const score = (z: number[]) => {
    evaluations++;
    const r = simulateLap({ track: pt, line: { knotOffsets: z }, car });
    return r.valid ? (opts.objective ? opts.objective(r) : r.rawLapTimeMs) : Infinity;
  };

  let z = project(opts.initial?.knotOffsets ?? new Array(pt.k).fill(0));
  let best = score(z);
  let step = opts.startStepM ?? 4;
  const minStep = opts.minStepM ?? 0.01;
  const maxEval = opts.maxEvaluations ?? 50_000;

  while (step >= minStep && evaluations < maxEval) {
    let improved = false;
    for (let j = 0; j < pt.k; j++) {
      for (const dir of [1, -1]) {
        // keep stepping while it helps
        for (;;) {
          const moved = z.slice();
          moved[j] = z[j] + dir * step;
          const cand = project(moved);
          if (cand.every((v, i) => v === z[i])) break;
          const t = score(cand);
          if (t < best) {
            best = t;
            z = cand;
            improved = true;
          } else break;
        }
      }
    }
    if (!improved) step /= 2;
  }
  return { line: { knotOffsets: z }, rawLapTimeMs: best, evaluations };
}
