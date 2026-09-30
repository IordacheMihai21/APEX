import type { CarModel } from "../physics/car";
import type { PreparedTrack } from "../track/prepare";

/**
 * A racing line is a lateral offset (metres, + = left of travel) at each of
 * the track's knots. Between knots the offset follows a periodic cubic
 * spline in (centerline index, offset) space.
 *
 * This low-dimensional form is deliberate: it keeps the player's intent
 * (turn-in, apex, exit per corner) and discards hand tremor, which in the
 * research spike cost more lap time than racing skill earned.
 */
export interface RacingLine {
  knotOffsets: number[];
}

/** Slack on the usable width, for centimetre rounding of submitted knots. */
export const LIMIT_TOLERANCE_M = 0.02;

export type LineStatus = "VALID" | "OFF_TRACK" | "CUT_CORNER" | "INCOMPLETE" | "INVALID_INPUT";

export interface LineIssue {
  status: Exclude<LineStatus, "VALID">;
  /** Centerline index range affected, when known. */
  fromIndex?: number;
  toIndex?: number;
  message: string;
}

export interface ResolvedLine {
  valid: boolean;
  status: LineStatus;
  issues: LineIssue[];
  /** Offset at every centerline index, clipped to the usable width. */
  offsets: Float64Array;
  x: Float64Array;
  y: Float64Array;
}

/** Max offset of the car's centre with all four wheels on track. */
export function usableHalfWidth(pt: PreparedTrack, car: CarModel): number {
  return pt.track.widthMeters / 2 - car.halfWidth;
}

/**
 * Expand knots to a full line and check track limits.
 *
 * The line is never clipped. Clipping creates kinks whose shape jumps with
 * tiny knot changes: in testing, a 5 cm nudge cost ~0.5 s on a clipped
 * optimum versus ~0.02 s for 20 cm on an unclipped one. Instead the whole
 * spline must keep all four wheels on track (|offset| <= usableHalfWidth);
 * fitDrawing pulls knots inward so drawn lines satisfy this.
 */
export function resolveLine(pt: PreparedTrack, line: RacingLine, car: CarModel): ResolvedLine {
  const { n, k, basis } = pt;
  const offsets = new Float64Array(n);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const issues: LineIssue[] = [];

  if (!Array.isArray(line.knotOffsets) || line.knotOffsets.length !== k || !line.knotOffsets.every(Number.isFinite)) {
    issues.push({ status: "INVALID_INPUT", message: `expected ${k} finite knot offsets` });
    return { valid: false, status: "INVALID_INPUT", issues, offsets, x, y };
  }

  const lim = usableHalfWidth(pt, car) + LIMIT_TOLERANCE_M;
  const z = line.knotOffsets;
  let runStart = -1;
  for (let i = 0; i <= n; i++) {
    let out = false;
    if (i < n) {
      let o = 0;
      const row = i * k;
      for (let j = 0; j < k; j++) o += basis[row + j] * z[j];
      offsets[i] = o;
      x[i] = pt.cx[i] + o * pt.nx[i];
      y[i] = pt.cy[i] + o * pt.ny[i];
      out = o > lim || o < -lim;
    }
    if (out && runStart < 0) runStart = i;
    if (!out && runStart >= 0) {
      issues.push({ status: "OFF_TRACK", fromIndex: runStart, toIndex: i - 1, message: "line leaves the track" });
      runStart = -1;
    }
  }

  return { valid: issues.length === 0, status: issues[0]?.status ?? "VALID", issues, offsets, x, y };
}

/** Evaluate the offset spline B·z at every index (no validation). */
export function evaluateOffsets(pt: PreparedTrack, z: ArrayLike<number>): Float64Array {
  const { n, k, basis } = pt;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let o = 0;
    for (let j = 0; j < k; j++) o += basis[i * k + j] * z[j];
    out[i] = o;
  }
  return out;
}

/**
 * Pull knots inward (on the centimetre grid) until the spline between them
 * stays within ±limit. Each overshoot is corrected through the knot that
 * dominates it. Deterministic; converges in a few iterations.
 */
export function enforceLimits(pt: PreparedTrack, z: number[], limit: number): number[] {
  const { n, k, basis } = pt;
  const cm = (v: number) => Math.round(v * 100) / 100 + 0;
  let cur = z.map((v) => cm(v > limit ? limit : v < -limit ? -limit : v));
  for (let iter = 0; iter < 100; iter++) {
    const raw = evaluateOffsets(pt, cur);
    const corr = new Float64Array(k);
    let over = false;
    for (let i = 0; i < n; i++) {
      const e = Math.abs(raw[i]) - limit;
      if (e <= 0) continue;
      over = true;
      let jd = 0;
      for (let j = 1; j < k; j++) if (Math.abs(basis[i * k + j]) > Math.abs(basis[i * k + jd])) jd = j;
      const need = (Math.sign(raw[i]) * e) / basis[i * k + jd];
      if (Math.abs(need) > Math.abs(corr[jd])) corr[jd] = need;
    }
    if (!over) return cur;
    cur = cur.map((v, j) => (corr[j] === 0 ? v : cm(v - corr[j] - Math.sign(corr[j]) * 0.01)));
  }
  return cur;
}

/** The centerline expressed as a RacingLine (all offsets zero). */
export function centerLine(pt: PreparedTrack): RacingLine {
  return { knotOffsets: new Array(pt.k).fill(0) };
}
