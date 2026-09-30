import { PeriodicSpline } from "../math/spline";
import { cumulative, curvature, leftNormals, resampleClosed, segmentLengths } from "./geometry";
import type { GameTrack, TrackCorner, TrackSector, Vec2 } from "./types";
import { PHYSICS_VERSION } from "../physics/version";
import { APEX_FORMULA } from "../physics/car";

export interface TrackSpec {
  id: string;
  name: string;
  version: number;
  widthMeters: number;
  /** Closed loop of control points in metres; the first point is start/finish. */
  controlPoints: Vec2[];
  samples?: number;
  source?: GameTrack["source"];
}

/** Corner detection and knot-placement parameters (see docs/PHYSICS.md). */
export const TRACK_BUILD = {
  cornerCurvature: 1 / 250, // |κ| above this on the smoothed centerline = corner
  cornerStencilM: 10,
  minCornerLengthM: 10,
  knotLeadM: 25, // entry/exit knots this far outside the curved region
  maxKnotGapM: 200, // fill straights so no two knots are further apart
  minKnotGapM: 10,
  maxBrakingLeadM: 100, // timing segment starts at most this far before a corner
} as const;

const round3 = (v: number) => Math.round(v * 1000) / 1000 + 0; // + 0 turns -0 into 0 (JSON drops the sign)

export function buildTrack(spec: TrackSpec): GameTrack {
  const n = spec.samples ?? 1000;
  const cp = spec.controlPoints;
  if (cp.length < 4) throw new Error("buildTrack: need at least 4 control points");

  // 1. Periodic spline through control points (chord-length parameter), dense sample, uniform resample.
  const t: number[] = [0];
  for (let i = 1; i < cp.length; i++) {
    const dx = cp[i][0] - cp[i - 1][0];
    const dy = cp[i][1] - cp[i - 1][1];
    t.push(t[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const last = cp[cp.length - 1];
  const cdx = cp[0][0] - last[0];
  const cdy = cp[0][1] - last[1];
  const closeLen = Math.sqrt(cdx * cdx + cdy * cdy);
  const period = t[t.length - 1] + closeLen;
  const sx = new PeriodicSpline(t, cp.map((p) => p[0]), period);
  const sy = new PeriodicSpline(t, cp.map((p) => p[1]), period);
  const dense = 20 * n;
  const dx = new Float64Array(dense);
  const dy = new Float64Array(dense);
  for (let i = 0; i < dense; i++) {
    const u = (period * i) / dense;
    dx[i] = sx.evaluate(u);
    dy[i] = sy.evaluate(u);
  }
  const rs = resampleClosed(dx, dy, n);
  const x = rs.x.map(round3);
  const y = rs.y.map(round3);

  // 2. Derived geometry.
  const ds = segmentLengths(x, y);
  const s = cumulative(ds);
  const length = s[n - 1] + ds[n - 1];
  const step = length / n;
  const { nx, ny } = leftNormals(x, y);
  const half = spec.widthMeters / 2;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += x[i] * y[j] - x[j] * y[i];
  }

  // 3. Corners: contiguous same-sign regions of high smoothed curvature.
  const k = curvature(x, y, Math.max(1, Math.round(TRACK_BUILD.cornerStencilM / step)));
  const sign = (i: number) => (Math.abs(k[i]) > TRACK_BUILD.cornerCurvature ? Math.sign(k[i]) : 0);
  let origin = 0;
  while (origin < n && sign(origin) !== 0) origin++;
  if (origin === n) throw new Error("buildTrack: track is one continuous corner");
  const regions: { a: number; b: number; dir: number }[] = [];
  for (let off = 0; off < n; ) {
    const i = (origin + off) % n;
    const d = sign(i);
    if (d === 0) {
      off++;
      continue;
    }
    let len = 0;
    while (off + len < n && sign((origin + off + len) % n) === d) len++;
    if (len * step >= TRACK_BUILD.minCornerLengthM) regions.push({ a: i, b: (i + len - 1) % n, dir: d });
    off += len;
  }
  regions.sort((p, q) => p.a - q.a);

  const idx = (i: number) => ((i % n) + n) % n;
  const fwd = (from: number, to: number) => idx(to - from); // forward index distance
  const corners: TrackCorner[] = regions.map((r, j) => {
    let apex = r.a;
    for (let o = 0; o <= fwd(r.a, r.b); o++) {
      const i = idx(r.a + o);
      if (Math.abs(k[i]) > Math.abs(k[apex])) apex = i;
    }
    const prevEnd = regions[(j - 1 + regions.length) % regions.length].b;
    const gap = regions.length > 1 ? fwd(prevEnd, r.a) : n;
    const lead = Math.min(Math.round(TRACK_BUILD.maxBrakingLeadM / step), Math.floor(gap / 2));
    return {
      id: j + 1,
      name: `T${j + 1}`,
      direction: r.dir > 0 ? "left" : "right",
      startIndex: r.a,
      apexIndex: apex,
      endIndex: r.b,
      startDistance: round3(s[r.a]),
      apexDistance: round3(s[apex]),
      endDistance: round3(s[r.b]),
      timingStartIndex: idx(r.a - lead),
    };
  });

  // 4. Line knots: entry / apex / exit per corner, straights filled sparsely.
  const leadIdx = Math.round(TRACK_BUILD.knotLeadM / step);
  const raw = new Set<number>();
  for (const c of corners) {
    raw.add(idx(c.startIndex - leadIdx));
    raw.add(c.apexIndex);
    raw.add(idx(c.endIndex + leadIdx));
  }
  let knots = [...raw].sort((a, b) => a - b);
  const filled: number[] = [];
  for (let j = 0; j < knots.length; j++) {
    const a = knots[j];
    const gapIdx = j + 1 < knots.length ? knots[j + 1] - a : knots[0] + n - a;
    filled.push(a);
    const extra = Math.floor((gapIdx * step) / TRACK_BUILD.maxKnotGapM);
    for (let e = 1; e <= extra; e++) filled.push(idx(a + Math.round((gapIdx * e) / (extra + 1))));
  }
  knots = [...new Set(filled)].sort((a, b) => a - b);
  // Drop knots closer than minKnotGapM to the previous one, never dropping an apex.
  const apexes = new Set(corners.map((c) => c.apexIndex));
  const minGap = Math.round(TRACK_BUILD.minKnotGapM / step);
  const kept: number[] = [];
  for (const kn of knots) {
    const prev = kept[kept.length - 1];
    if (prev !== undefined && kn - prev < minGap) {
      if (apexes.has(kn) && !apexes.has(prev)) kept[kept.length - 1] = kn;
      continue;
    }
    kept.push(kn);
  }
  if (kept.length > 1 && kept[0] + n - kept[kept.length - 1] < minGap && !apexes.has(kept[kept.length - 1])) kept.pop();

  const sectors: TrackSector[] = [0, 1, 2].map((j) => ({
    id: j + 1,
    startIndex: Math.round((n * j) / 3),
    endIndex: Math.round((n * (j + 1)) / 3),
  }));

  const pts = (sgn: number): Vec2[] =>
    Array.from({ length: n }, (_, i) => [round3(x[i] + sgn * nx[i] * half), round3(y[i] + sgn * ny[i] * half)]);

  return {
    format: "apex-track",
    formatVersion: 1,
    id: spec.id,
    name: spec.name,
    version: spec.version,
    closed: true,
    direction: area > 0 ? "ccw" : "cw",
    lengthMeters: round3(length),
    widthMeters: spec.widthMeters,
    centerline: Array.from({ length: n }, (_, i) => [x[i], y[i]] as Vec2),
    leftBoundary: pts(1),
    rightBoundary: pts(-1),
    corners,
    sectors,
    lineKnots: kept,
    optimalLine: null,
    optimalTimeMs: null,
    physicsVersion: PHYSICS_VERSION,
    carModel: APEX_FORMULA.id,
    source: spec.source ?? { kind: "original" },
  };
}
