import { type CarConstants, cornerSpeedLimit, gripAt } from "./car";

export interface ProfileOptions {
  /** Closed loop (flying lap) or open path. */
  closed: boolean;
  /** Open paths only: speed at index 0 (default 0 = standing start). */
  startSpeed?: number;
}

/**
 * Quasi-steady-state speed profile along a path.
 *
 *   ds[i]    distance from point i to i+1
 *   kappa[i] path curvature at point i
 *
 * 1. Cornering limit per point from lateral grip (incl. downforce).
 * 2. Forward pass: accelerate with min(power, remaining grip) − drag.
 * 3. Backward pass: brake with remaining grip + drag.
 * Remaining grip uses a friction circle: sqrt(1 − (aLat / grip)²).
 *
 * For closed loops both passes start at the slowest point and sweep the
 * loop twice so the wrap-around is consistent.
 */
export function speedProfile(
  ds: ArrayLike<number>,
  kappa: ArrayLike<number>,
  c: CarConstants,
  opts: ProfileOptions,
): Float64Array {
  const n = ds.length;
  const vlim = new Float64Array(n);
  let s0 = 0;
  for (let i = 0; i < n; i++) {
    vlim[i] = cornerSpeedLimit(c, kappa[i]);
    if (vlim[i] < vlim[s0]) s0 = i;
  }

  const remaining = (v: number, k: number) => {
    const grip = gripAt(c, v);
    const r = (v * v * Math.abs(k)) / grip;
    return r >= 1 ? 0 : grip * Math.sqrt(1 - r * r);
  };
  const accel = (v: number, k: number) => {
    const aGrip = remaining(v, k);
    const aPow = c.powerPerMass / (v > 1 ? v : 1);
    return (aGrip < aPow ? aGrip : aPow) - c.kDrag * v * v;
  };
  const decel = (v: number, k: number) => remaining(v, k) + c.kDrag * v * v;

  const v = Float64Array.from(vlim);
  if (opts.closed) {
    for (let sweep = 0; sweep < 2; sweep++) {
      for (let o = 0; o < n; o++) {
        const i = (s0 + o) % n;
        const j = (i + 1) % n;
        const next = Math.sqrt(Math.max(0, v[i] * v[i] + 2 * accel(v[i], kappa[i]) * ds[i]));
        if (next < v[j]) v[j] = next;
      }
    }
    for (let sweep = 0; sweep < 2; sweep++) {
      for (let o = n - 1; o >= 0; o--) {
        const i = (s0 + o) % n;
        const j = (i + 1) % n;
        const prev = Math.sqrt(v[j] * v[j] + 2 * decel(v[j], kappa[j]) * ds[i]);
        if (prev < v[i]) v[i] = prev;
      }
    }
  } else {
    const v0 = opts.startSpeed ?? 0;
    if (v0 < v[0]) v[0] = v0;
    for (let i = 0; i < n - 1; i++) {
      const next = Math.sqrt(Math.max(0, v[i] * v[i] + 2 * accel(v[i], kappa[i]) * ds[i]));
      if (next < v[i + 1]) v[i + 1] = next;
    }
    for (let i = n - 2; i >= 0; i--) {
      const prev = Math.sqrt(v[i + 1] * v[i + 1] + 2 * decel(v[i + 1], kappa[i + 1]) * ds[i]);
      if (prev < v[i]) v[i] = prev;
    }
  }
  return v;
}

/** Elapsed time at each point (seconds), trapezoidal in speed. Returns [elapsed, total]. */
export function integrateTime(ds: ArrayLike<number>, v: ArrayLike<number>, closed: boolean) {
  const n = ds.length;
  const elapsed = new Float64Array(n);
  const segs = closed ? n : n - 1;
  let t = 0;
  for (let i = 0; i < segs; i++) {
    if (i < n) elapsed[i] = t;
    const j = i + 1 < n ? i + 1 : 0;
    const avg = 0.5 * (v[i] + v[j]);
    t += ds[i] / (avg > 0.1 ? avg : 0.1);
  }
  if (!closed) elapsed[n - 1] = t;
  return { elapsed, total: t };
}
