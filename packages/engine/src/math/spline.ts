import { solveDense } from "./linalg";

/**
 * Periodic cubic spline through (t[j], y[j]) with period `period`.
 * Knots must be strictly increasing within [t0, t0 + period).
 *
 * The spline is linear in y, which is what lets the racing line be fitted
 * by least squares against a precomputed basis (see line/basis.ts).
 */
export class PeriodicSpline {
  readonly t: Float64Array;
  readonly y: Float64Array;
  readonly m: Float64Array; // second derivatives at knots
  readonly period: number;

  constructor(t: ArrayLike<number>, y: ArrayLike<number>, period: number) {
    const k = t.length;
    if (k < 3 || y.length !== k) throw new Error("PeriodicSpline: need >= 3 knots");
    this.t = Float64Array.from(t);
    this.y = Float64Array.from(y);
    this.period = period;
    const h = new Float64Array(k);
    for (let j = 0; j < k; j++) {
      const next = j + 1 < k ? this.t[j + 1] : this.t[0] + period;
      h[j] = next - this.t[j];
      if (!(h[j] > 0)) throw new Error("PeriodicSpline: knots must be strictly increasing");
    }
    // Cyclic tridiagonal system for second derivatives, solved densely (k is small).
    const A = new Float64Array(k * k);
    const rhs = new Float64Array(k);
    for (let j = 0; j < k; j++) {
      const jp = (j - 1 + k) % k;
      const jn = (j + 1) % k;
      A[j * k + jp] += h[jp];
      A[j * k + j] += 2 * (h[jp] + h[j]);
      A[j * k + jn] += h[j];
      rhs[j] = 6 * ((this.y[jn] - this.y[j]) / h[j] - (this.y[j] - this.y[jp]) / h[jp]);
    }
    this.m = solveDense(A, rhs, k);
  }

  evaluate(tq: number): number {
    const { t, y, m, period } = this;
    const k = t.length;
    let u = tq - t[0];
    u -= Math.floor(u / period) * period;
    u += t[0];
    // binary search for segment j with t[j] <= u < t[j+1]
    let lo = 0;
    let hi = k - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (t[mid] <= u) lo = mid;
      else hi = mid - 1;
    }
    const j = lo;
    const jn = (j + 1) % k;
    const t1 = j + 1 < k ? t[j + 1] : t[0] + period;
    const h = t1 - t[j];
    const a = t1 - u;
    const b = u - t[j];
    return (
      (m[j] * a * a * a + m[jn] * b * b * b) / (6 * h) +
      ((y[j] - (m[j] * h * h) / 6) * a) / h +
      ((y[jn] - (m[jn] * h * h) / 6) * b) / h
    );
  }
}
