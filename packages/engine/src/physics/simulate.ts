import { type RacingLine, type LineIssue, type LineStatus, resolveLine } from "../line/line";
import { curvature, segmentLengths } from "../track/geometry";
import type { PreparedTrack } from "../track/prepare";
import { APEX_FORMULA, type CarModel, carConstants } from "./car";
import { integrateTime, speedProfile } from "./profile";
import { PHYSICS_VERSION } from "./version";

/** Struct-of-arrays samples, one per centerline index (line index i ↔ centerline index i). */
export interface LapSamples {
  distance: Float64Array; // along the driven line, m
  x: Float64Array;
  y: Float64Array;
  offset: Float64Array; // lateral offset from centerline, m
  speed: Float64Array; // m/s
  curvature: Float64Array; // 1/m, + = left
  elapsedMs: Float64Array;
}

export interface SegmentResult {
  id: number;
  name: string;
  startIndex: number;
  endIndex: number; // exclusive, may wrap (endIndex < startIndex)
  timeMs: number;
  minSpeed: number;
  exitSpeed: number;
}

export interface SimulationResult {
  valid: boolean;
  status: LineStatus;
  issues: LineIssue[];
  /** Integer milliseconds: the official, comparable result. */
  lapTimeMs: number;
  /** Unrounded lap time, for optimisers and analysis only. Never rank on this. */
  rawLapTimeMs: number;
  physicsVersion: string;
  carModel: string;
  trackId: string;
  trackVersion: number;
  samples: LapSamples;
  sectors: SegmentResult[];
  corners: SegmentResult[];
}

export interface SimulateInput {
  track: PreparedTrack;
  line: RacingLine;
  car?: CarModel;
}

function segment(
  id: number,
  name: string,
  a: number,
  b: number,
  n: number,
  elapsed: Float64Array,
  lap: number,
  speed: Float64Array,
): SegmentResult {
  const t0 = elapsed[a];
  const t1 = b === 0 || b === n ? lap : elapsed[b];
  let min = Infinity;
  for (let o = 0, len = (b - a + n) % n || n; o < len; o++) {
    const v = speed[(a + o) % n];
    if (v < min) min = v;
  }
  const time = a === b ? lap : t1 >= t0 ? t1 - t0 : lap - t0 + t1;
  return { id, name, startIndex: a, endIndex: b, timeMs: time * 1000, minSpeed: min, exitSpeed: speed[(b - 1 + n) % n] };
}

/**
 * Flying-lap simulation of a racing line. Pure and deterministic: the same
 * track + line + car + PHYSICS_VERSION always gives the same lapTimeMs,
 * in any JavaScript engine (only + - * / sqrt in the numeric path).
 */
export function simulateLap({ track: pt, line, car = APEX_FORMULA }: SimulateInput): SimulationResult {
  const resolved = resolveLine(pt, line, car);
  const { n } = pt;
  const { x, y } = resolved;
  const ds = segmentLengths(x, y);
  const kappa = curvature(x, y, pt.curvatureStride);
  const c = carConstants(car);
  const speed = speedProfile(ds, kappa, c, { closed: true });
  const { elapsed, total } = integrateTime(ds, speed, true);

  const distance = new Float64Array(n);
  for (let i = 1; i < n; i++) distance[i] = distance[i - 1] + ds[i - 1];
  const elapsedMs = elapsed.map((t) => t * 1000);

  const corners = pt.track.corners.map((corner, j, all) =>
    segment(corner.id, corner.name, corner.timingStartIndex, all[(j + 1) % all.length].timingStartIndex, n, elapsed, total, speed),
  );
  const sectors = pt.track.sectors.map((s) => segment(s.id, `S${s.id}`, s.startIndex, s.endIndex, n, elapsed, total, speed));

  return {
    valid: resolved.valid,
    status: resolved.status,
    issues: resolved.issues,
    lapTimeMs: Math.round(total * 1000),
    rawLapTimeMs: total * 1000,
    physicsVersion: PHYSICS_VERSION,
    carModel: car.id,
    trackId: pt.track.id,
    trackVersion: pt.track.version,
    samples: { distance, x, y, offset: resolved.offsets, speed, curvature: kappa, elapsedMs },
    sectors,
    corners,
  };
}

export interface SegmentDelta {
  id: number;
  name: string;
  deltaMs: number; // + = slower than reference
}

/**
 * Time lost per corner/sector versus a reference run on the same track.
 * Corner segments partition the lap, so corner deltas sum to the lap delta.
 */
export function compareRuns(run: SimulationResult, reference: SimulationResult) {
  const diff = (a: SegmentResult[], b: SegmentResult[]): SegmentDelta[] =>
    a.map((s, i) => ({ id: s.id, name: s.name, deltaMs: s.timeMs - b[i].timeMs }));
  return {
    lapDeltaMs: run.lapTimeMs - reference.lapTimeMs,
    corners: diff(run.corners, reference.corners),
    sectors: diff(run.sectors, reference.sectors),
  };
}
