/**
 * Closed-polyline geometry on struct-of-arrays coordinates.
 * Deterministic: only + - * / and Math.sqrt.
 */

/** Segment lengths ds[i] = |p[i+1] - p[i]| (wrapping). */
export function segmentLengths(x: ArrayLike<number>, y: ArrayLike<number>): Float64Array {
  const n = x.length;
  const ds = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const j = i + 1 < n ? i + 1 : 0;
    const dx = x[j] - x[i];
    const dy = y[j] - y[i];
    ds[i] = Math.sqrt(dx * dx + dy * dy);
  }
  return ds;
}

/** Cumulative distance at each point, starting at 0. */
export function cumulative(ds: ArrayLike<number>): Float64Array {
  const s = new Float64Array(ds.length);
  for (let i = 1; i < ds.length; i++) s[i] = s[i - 1] + ds[i - 1];
  return s;
}

/** Unit left normals from central-difference tangents. */
export function leftNormals(x: ArrayLike<number>, y: ArrayLike<number>) {
  const n = x.length;
  const nx = new Float64Array(n);
  const ny = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = i > 0 ? i - 1 : n - 1;
    const b = i + 1 < n ? i + 1 : 0;
    const tx = x[b] - x[a];
    const ty = y[b] - y[a];
    const len = Math.sqrt(tx * tx + ty * ty);
    nx[i] = -ty / len;
    ny[i] = tx / len;
  }
  return { nx, ny };
}

/**
 * Signed curvature using a three-point (Menger) stencil spanning `stride`
 * points either side. Positive = turning left.
 *
 * A stride measured in metres rather than neighbouring points is essential:
 * neighbour-point curvature amplifies sub-metre kinks and made lap times
 * resolution-dependent in the research spike (34 s at N=1000, 42 s at N=2000).
 */
export function curvature(x: ArrayLike<number>, y: ArrayLike<number>, stride: number): Float64Array {
  const n = x.length;
  const k = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - stride + n) % n;
    const c = (i + stride) % n;
    const abx = x[i] - x[a];
    const aby = y[i] - y[a];
    const bcx = x[c] - x[i];
    const bcy = y[c] - y[i];
    const cax = x[a] - x[c];
    const cay = y[a] - y[c];
    const cross = abx * bcy - aby * bcx;
    const la = Math.sqrt(abx * abx + aby * aby);
    const lb = Math.sqrt(bcx * bcx + bcy * bcy);
    const lc = Math.sqrt(cax * cax + cay * cay);
    const denom = la * lb * lc;
    k[i] = denom > 0 ? (2 * cross) / denom : 0;
  }
  return k;
}

/** Resample a closed polyline to n points uniformly spaced by arc length. */
export function resampleClosed(x: ArrayLike<number>, y: ArrayLike<number>, n: number) {
  const m = x.length;
  const ds = segmentLengths(x, y);
  const total = ds.reduce((a, b) => a + b, 0);
  const ox = new Float64Array(n);
  const oy = new Float64Array(n);
  let seg = 0;
  let segStart = 0;
  for (let i = 0; i < n; i++) {
    const target = (total * i) / n;
    while (seg < m - 1 && segStart + ds[seg] < target) {
      segStart += ds[seg];
      seg++;
    }
    const j = seg + 1 < m ? seg + 1 : 0;
    const f = ds[seg] > 0 ? (target - segStart) / ds[seg] : 0;
    ox[i] = x[seg] + (x[j] - x[seg]) * f;
    oy[i] = y[seg] + (y[j] - y[seg]) * f;
  }
  return { x: ox, y: oy, length: total };
}
