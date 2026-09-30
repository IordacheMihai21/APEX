import { PeriodicSpline } from "../math/spline";
import { cumulative, leftNormals, segmentLengths } from "./geometry";
import type { GameTrack } from "./types";

/** Metres spanned by each side of the curvature stencil. See docs/PHYSICS.md. */
export const CURVATURE_STENCIL_M = 5;

/**
 * Runtime form of a GameTrack: typed arrays plus the racing-line basis.
 * Build once per track load and reuse across simulations.
 */
export interface PreparedTrack {
  track: GameTrack;
  n: number;
  cx: Float64Array;
  cy: Float64Array;
  nx: Float64Array;
  ny: Float64Array;
  /** Centerline distance at each index. */
  s: Float64Array;
  /** Mean centerline spacing in metres. */
  step: number;
  curvatureStride: number;
  /** Number of line knots. */
  k: number;
  /** Basis B (n × k, row-major): offsets = B · knotOffsets. */
  basis: Float64Array;
}

export function prepareTrack(track: GameTrack): PreparedTrack {
  const n = track.centerline.length;
  const cx = Float64Array.from(track.centerline, (p) => p[0]);
  const cy = Float64Array.from(track.centerline, (p) => p[1]);
  const { nx, ny } = leftNormals(cx, cy);
  const ds = segmentLengths(cx, cy);
  const s = cumulative(ds);
  const step = (s[n - 1] + ds[n - 1]) / n;

  const knots = track.lineKnots;
  const k = knots.length;
  const basis = new Float64Array(n * k);
  const unit = new Float64Array(k);
  for (let j = 0; j < k; j++) {
    unit.fill(0);
    unit[j] = 1;
    const sp = new PeriodicSpline(knots, unit, n);
    for (let i = 0; i < n; i++) basis[i * k + j] = sp.evaluate(i);
  }

  return {
    track,
    n,
    cx,
    cy,
    nx,
    ny,
    s,
    step,
    curvatureStride: Math.max(1, Math.round(CURVATURE_STENCIL_M / step)),
    k,
    basis,
  };
}
