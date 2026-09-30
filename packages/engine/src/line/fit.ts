import { solveDense } from "../math/linalg";
import type { CarModel } from "../physics/car";
import type { PreparedTrack } from "../track/prepare";
import type { Vec2 } from "../track/types";
import { type LineIssue, type LineStatus, type RacingLine, enforceLimits, usableHalfWidth } from "./line";

export interface FitOptions {
  /** How far past the track edge (metres) a drawn point may stray before it counts as off track. */
  offTrackToleranceM?: number;
  /** Longest stretch of track (metres) the drawing may skip, e.g. an unclosed loop. */
  maxGapM?: number;
  /** Search window either side of the previous projection (metres). */
  trackingWindowM?: number;
  /** An excursion past the tolerance must last this long (metres of track) to count as OFF_TRACK. */
  minOffTrackRunM?: number;
}

export interface FitResult {
  line: RacingLine;
  valid: boolean;
  status: LineStatus;
  issues: LineIssue[];
  /** Fraction of centerline indices with at least one drawn sample. */
  coverage: number;
}

const DEFAULTS = { offTrackToleranceM: 1.5, maxGapM: 30, trackingWindowM: 40, minOffTrackRunM: 15 };
const RIDGE = 1e-3;

/**
 * Convert a freehand drawing (track metres) into a RacingLine.
 *
 *  1. Densify the stroke to at most one sample per centerline step.
 *  2. Project each sample onto the centerline, tracking locally so
 *     neighbouring parts of the track (hairpin legs) are not confused.
 *  3. Average the lateral offset per centerline index.
 *  4. Weighted least-squares fit of the knot offsets.
 *  5. Pull knots inward until the spline is within track limits, on the
 *     centimetre grid (the canonical form that is submitted).
 *
 * Drawing direction does not matter: a line is a set of offsets.
 */
export function fitDrawing(pt: PreparedTrack, points: Vec2[], car: CarModel, options: FitOptions = {}): FitResult {
  const opt = { ...DEFAULTS, ...options };
  const { n, k, basis, cx, cy, nx, ny, step } = pt;
  const issues: LineIssue[] = [];
  const fail = (status: LineIssue["status"], message: string): FitResult => ({
    line: { knotOffsets: new Array(k).fill(0) },
    valid: false,
    status,
    issues: [...issues, { status, message }],
    coverage: 0,
  });

  if (points.length < 2 || !points.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))) {
    return fail("INVALID_INPUT", "drawing needs at least two finite points");
  }

  // 1. densify
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    if (i > 0) {
      const [bx, by] = points[i - 1];
      const d = Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
      const pieces = Math.ceil(d / (0.5 * step));
      for (let q = 1; q < pieces; q++) {
        px.push(bx + ((ax - bx) * q) / pieces);
        py.push(by + ((ay - by) * q) / pieces);
      }
    }
    px.push(ax);
    py.push(ay);
  }

  // 2-3. project
  const d2 = (i: number, x: number, y: number) => (x - cx[i]) * (x - cx[i]) + (y - cy[i]) * (y - cy[i]);
  const nearestGlobal = (x: number, y: number) => {
    let best = 0;
    for (let i = 1; i < n; i++) if (d2(i, x, y) < d2(best, x, y)) best = i;
    return best;
  };
  const win = Math.ceil(opt.trackingWindowM / step);
  const hard = pt.track.widthMeters / 2;
  const offLimit = hard + opt.offTrackToleranceM;
  const sum = new Float64Array(n);
  const cnt = new Uint32Array(n);
  // Brief finger overshoots are forgiven (their samples are clamped by the fit);
  // only a sustained excursion counts.
  const reportOff = (from: number, to: number) => {
    const len = Math.min((to - from + n) % n, (from - to + n) % n) * step;
    if (len >= opt.minOffTrackRunM) issues.push({ status: "OFF_TRACK", fromIndex: from, toIndex: to, message: "drawing leaves the track" });
  };
  let cur = nearestGlobal(px[0], py[0]);
  let offRun = -1;

  for (let p = 0; p < px.length; p++) {
    const x = px[p];
    const y = py[p];
    let best = cur;
    for (let o = -win; o <= win; o++) {
      const i = (cur + o + n) % n;
      if (d2(i, x, y) < d2(best, x, y)) best = i;
    }
    if (Math.sqrt(d2(best, x, y)) > offLimit) {
      // Lost the local track: did the stroke jump to another part of it?
      const g = nearestGlobal(x, y);
      const jump = Math.min((g - cur + n) % n, (cur - g + n) % n);
      if (Math.sqrt(d2(g, x, y)) <= offLimit && jump > win) {
        issues.push({ status: "CUT_CORNER", fromIndex: cur, toIndex: g, message: "line cuts across the infield" });
        best = g;
      }
    }
    cur = best;
    const lat = (x - cx[cur]) * nx[cur] + (y - cy[cur]) * ny[cur];
    const off = Math.abs(lat) > offLimit;
    if (off && offRun < 0) offRun = cur;
    if (!off && offRun >= 0) {
      reportOff(offRun, cur);
      offRun = -1;
    }
    sum[cur] += lat > hard ? hard : lat < -hard ? -hard : lat;
    cnt[cur] += 1;
  }
  if (offRun >= 0) reportOff(offRun, cur);

  // coverage: largest circular run of uncovered indices
  let covered = 0;
  for (let i = 0; i < n; i++) if (cnt[i] > 0) covered++;
  if (covered === 0) return fail("INCOMPLETE", "drawing does not follow the track");
  let start = 0;
  while (cnt[start] === 0) start++;
  let gap = 0;
  let gapAt = start;
  for (let o = 1, run = 0; o <= n; o++) {
    const i = (start + o) % n;
    if (cnt[i] === 0) {
      run++;
      if (run > gap) {
        gap = run;
        gapAt = i;
      }
    } else run = 0;
  }
  if (gap * step > opt.maxGapM) {
    issues.push({
      status: "INCOMPLETE",
      fromIndex: (gapAt - gap + 1 + n) % n,
      toIndex: gapAt,
      message: `drawing skips ${Math.round(gap * step)} m of track`,
    });
  }

  // 4. weighted least squares: (BᵀWB + λI) z = BᵀW y
  const A = new Float64Array(k * k);
  const rhs = new Float64Array(k);
  for (let i = 0; i < n; i++) {
    if (cnt[i] === 0) continue;
    const yi = sum[i] / cnt[i];
    const row = i * k;
    for (let a = 0; a < k; a++) {
      const ba = basis[row + a];
      if (ba === 0) continue;
      rhs[a] += ba * yi;
      for (let b = 0; b < k; b++) A[a * k + b] += ba * basis[row + b];
    }
  }
  for (let a = 0; a < k; a++) A[a * k + a] += RIDGE;
  const z = solveDense(A, rhs, k);
  const knotOffsets = enforceLimits(pt, Array.from(z), usableHalfWidth(pt, car));

  return {
    line: { knotOffsets },
    valid: issues.length === 0,
    status: issues[0]?.status ?? "VALID",
    issues,
    coverage: covered / n,
  };
}
