/**
 * Small dense linear algebra. Only + - * / are used so results are
 * bit-identical across JavaScript engines (see docs/PHYSICS.md, "Determinism").
 */

/** Solve A x = b (A is n×n, row-major) with partial pivoting. Inputs are not mutated. */
export function solveDense(A: ArrayLike<number>, b: ArrayLike<number>, n: number): Float64Array {
  const m = Float64Array.from(A);
  const x = Float64Array.from(b);
  for (let col = 0; col < n; col++) {
    let piv = col;
    let best = Math.abs(m[col * n + col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(m[r * n + col]);
      if (v > best) {
        best = v;
        piv = r;
      }
    }
    if (best === 0) throw new Error("solveDense: singular matrix");
    if (piv !== col) {
      for (let c = 0; c < n; c++) {
        const t = m[col * n + c];
        m[col * n + c] = m[piv * n + c];
        m[piv * n + c] = t;
      }
      const t = x[col];
      x[col] = x[piv];
      x[piv] = t;
    }
    const d = m[col * n + col];
    for (let r = col + 1; r < n; r++) {
      const f = m[r * n + col] / d;
      if (f === 0) continue;
      for (let c = col; c < n; c++) m[r * n + c] -= f * m[col * n + c];
      x[r] -= f * x[col];
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = x[r];
    for (let c = r + 1; c < n; c++) s -= m[r * n + c] * x[c];
    x[r] = s / m[r * n + r];
  }
  return x;
}

/** Cube root by Newton iteration (Math.cbrt is not guaranteed identical across engines). */
export function cbrt(v: number): number {
  if (v <= 0) return 0;
  let x = v > 1 ? v / 3 : 1;
  for (let i = 0; i < 200; i++) {
    const next = (2 * x + v / (x * x)) / 3;
    if (next === x) break;
    x = next;
  }
  return x;
}
