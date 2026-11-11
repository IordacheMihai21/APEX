import type { GameTrack, PreparedTrack } from "@apex/engine";
import type { CornerData } from "../modes/makeCorner";

/**
 * One corner group of a lap as a 3D stretch, for the Daily Quali's 3D view: the player's own line through it (from
 * the run-up to the exit), both track edges, and the speed and curvature the physics gave that line. The same shape
 * Make the corner's scene draws (CornerData), built in the browser from the lap just simulated, so any corner of any
 * circuit can be shown. Metres, origin at the slowest point of the player's line.
 */
const RUNUP_M = 260;
const EXIT_M = 200;

export interface LapSamples {
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  speed: ArrayLike<number>;
  curvature: ArrayLike<number>;
}

export function stretchOf(
  track: GameTrack,
  pt: PreparedTrack,
  group: { corners: string[]; direction: "left" | "right" | "mixed"; index: number; name: string },
  samples: LapSamples,
): CornerData | null {
  const parts = track.corners.filter((c) => group.corners.includes(c.name));
  if (!parts.length) return null;
  const n = pt.n;
  const ring = (i: number) => ((i % n) + n) % n;
  const step = (i: number) => Math.hypot(samples.x[ring(i + 1)] - samples.x[ring(i)], samples.y[ring(i + 1)] - samples.y[ring(i)]);

  // the slowest point of the group, then back up the braking curve to where the speed stops rising
  const first = parts[0].startIndex;
  const last = parts[parts.length - 1].endIndex;
  let apex = first;
  for (let i = first - 40; i <= last + 10; i++) if (samples.speed[ring(i)] < samples.speed[ring(apex)]) apex = i;
  let peak = apex;
  for (let i = apex - 1; i > apex - 400; i--) {
    if (samples.speed[ring(i)] >= samples.speed[ring(peak)] - 1e-6) peak = i;
    else if (samples.speed[ring(i)] < samples.speed[ring(peak)] - 0.3) break;
  }
  const brake = Math.min(peak, first);

  let start = brake;
  for (let d = 0; d < RUNUP_M && start > brake - n / 2; start--) d += step(start - 1);
  let end = Math.max(apex, last);
  for (let d = 0; d < EXIT_M && end < apex + n / 2; end++) d += step(end);
  const idx = Array.from({ length: end - start + 1 }, (_, k) => ring(start + k));

  const ox = samples.x[ring(apex)];
  const oy = samples.y[ring(apex)];
  const L = track.leftBoundary;
  const R = track.rightBoundary;
  const s: number[] = [0];
  for (let k = 1; k < idx.length; k++) s.push(s[k - 1] + Math.hypot(samples.x[idx[k]] - samples.x[idx[k - 1]], samples.y[idx[k]] - samples.y[idx[k - 1]]));
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const run = {
    kappa: idx.map((i) => samples.curvature[i]),
    speed: idx.map((i) => r2(samples.speed[i])),
    brake: idx.indexOf(ring(brake)),
    apex: idx.indexOf(ring(apex)),
  };
  return {
    id: `${track.id}-${group.index}`,
    trackId: track.id,
    complex: group.index,
    name: group.name,
    direction: group.direction,
    origin: [r2(ox), r2(oy)],
    s: s.map(r2),
    x: idx.map((i) => r2(samples.x[i] - ox)),
    y: idx.map((i) => r2(samples.y[i] - oy)),
    lx: idx.map((i) => r2(L[i][0] - ox)),
    ly: idx.map((i) => r2(L[i][1] - oy)),
    rx: idx.map((i) => r2(R[i][0] - ox)),
    ry: idx.map((i) => r2(R[i][1] - oy)),
    // the scene reads the kerbs from the dry entry; the player's own run stands in for every condition
    conditions: { dry: run, wet: run, lowdf: run },
  };
}

/** Where the car is at time t (s) along a stretch driven at its speeds: position, heading, curvature, distance. */
export function poseAt(c: CornerData, t: number): { x: number; y: number; heading: number; kappa: number; s: number; speed: number; braking: boolean; done: boolean } {
  const v = c.conditions.dry.speed;
  let time = 0;
  for (let k = 1; k < c.s.length; k++) {
    const ds = c.s[k] - c.s[k - 1];
    const dt = ds / Math.max(1, (v[k] + v[k - 1]) / 2);
    if (time + dt >= t) {
      const f = dt > 0 ? (t - time) / dt : 0;
      const heading = Math.atan2(c.y[k] - c.y[k - 1], c.x[k] - c.x[k - 1]);
      return {
        x: c.x[k - 1] + (c.x[k] - c.x[k - 1]) * f,
        y: c.y[k - 1] + (c.y[k] - c.y[k - 1]) * f,
        heading,
        kappa: c.conditions.dry.kappa[k],
        s: c.s[k - 1] + ds * f,
        speed: v[k - 1] + (v[k] - v[k - 1]) * f,
        braking: v[k] < v[k - 1] - 0.05,
        done: false,
      };
    }
    time += dt;
  }
  const k = c.s.length - 1;
  return { x: c.x[k], y: c.y[k], heading: Math.atan2(c.y[k] - c.y[k - 1], c.x[k] - c.x[k - 1]), kappa: 0, s: c.s[k], speed: v[k], braking: false, done: true };
}
