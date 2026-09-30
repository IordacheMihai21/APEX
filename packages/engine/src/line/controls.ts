import { simulateLap } from "../physics/simulate";
import type { PreparedTrack } from "../track/prepare";
import { enforceLimits } from "./line";

/**
 * Player-facing line controls ("gates").
 *
 * A racing line is one lateral offset per knot. Knots near corners are
 * *gates* the player sets directly (turn-in, apex, exit); knots on straights
 * are *fillers*, derived by linear interpolation between the neighbouring
 * gates. Corners whose gate ranges overlap (chicanes, esses) are grouped into
 * one *complex* so they are edited together.
 */
export interface GateInfo {
  /** Index into track.lineKnots / knotOffsets. */
  knot: number;
  /** Centerline index of the knot. */
  index: number;
  /** Approach → Turn-in → Apex (→ Mid → Apex …) → Exit → Track-out. */
  label: "Approach" | "Turn-in" | "Apex" | "Mid" | "Exit" | "Track-out";
  /** Corner name for apex gates, e.g. "T5". */
  corner?: string;
}

export interface Complex {
  id: number;
  /** "T5" or "T1–T2". */
  name: string;
  corners: string[];
  direction: "left" | "right" | "mixed";
  gates: GateInfo[];
}

export interface LineControls {
  complexes: Complex[];
  /** Per knot: is it a gate (true) or an interpolated filler (false)? */
  isGate: boolean[];
}

/** How far outside a corner's curved region its turn-in/exit gates may sit. */
const GATE_REACH_M = 30;
/**
 * A corner gets gates only if the car must slow for it: the centerline lap's
 * speed drops by at least this much (m/s ≈ 12 km/h) from the fastest point in
 * the 200 m before the corner to the slowest point inside it. Flat-out kinks
 * are interpolated instead of asking the player for three decisions.
 */
export const SIGNIFICANT_SPEED_DROP = 3.3;
/** Longer chains (street circuits) are split so one screen never has more than ~9 gates. */
const MAX_GROUP_CORNERS = 3;

/** The track's published controls if stored, otherwise computed. */
export function trackControls(pt: PreparedTrack): LineControls {
  const stored = pt.track.controls;
  if (!stored) return lineControls(pt);
  const isGate = pt.track.lineKnots.map(() => false);
  for (const c of stored.complexes) for (const g of c.gates) isGate[g.knot] = true;
  return { complexes: stored.complexes, isGate };
}

export function lineControls(pt: PreparedTrack): LineControls {
  const { track, n, step } = pt;
  const knots = track.lineKnots;
  const reach = Math.round(GATE_REACH_M / step);
  const within = (i: number, a: number, b: number) => (i - a + n) % n <= (b - a + n) % n;

  const v = simulateLap({ track: pt, line: { knotOffsets: new Array(pt.k).fill(0) } }).samples.speed;
  const before = Math.round(200 / step);
  const significant = (c: (typeof track.corners)[number]) => {
    let vmax = 0;
    for (let o = 0; o <= before; o++) vmax = Math.max(vmax, v[(c.startIndex - o + n) % n]);
    let vmin = Infinity;
    const len = (c.endIndex - c.startIndex + n) % n;
    for (let o = 0; o <= len; o++) vmin = Math.min(vmin, v[(c.startIndex + o) % n]);
    return vmax - vmin >= SIGNIFICANT_SPEED_DROP;
  };

  // Group significant corners whose extended ranges overlap.
  const corners = track.corners.filter(significant);
  // Two corners belong together when the straight between them is shorter
  // than 1.5× the turn-in/exit reach (45 m): the exit of one is effectively the
  // entry of the next (chicanes, esses), so they must be edited together.
  const linked = (prevEnd: number, nextStart: number) => {
    const gap = (nextStart - prevEnd + n) % n; // forward distance, small for neighbours
    return gap < 1.5 * reach;
  };
  const groups: (typeof corners)[] = [];
  for (const c of corners) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    if (prev && last.length < MAX_GROUP_CORNERS && linked(prev.endIndex, c.startIndex)) last.push(c);
    else groups.push([c]);
  }
  // Wrap-around: merge the last group into the first if they touch across start/finish.
  if (groups.length > 1) {
    const lastG = groups[groups.length - 1];
    if (lastG.length + groups[0].length <= MAX_GROUP_CORNERS && linked(lastG[lastG.length - 1].endIndex, groups[0][0].startIndex))
      groups[0] = [...groups.pop()!, ...groups[0]];
  }

  const isGate = knots.map(() => false);
  const complexes: Complex[] = groups.map((g, id) => {
    const a = (g[0].startIndex - reach + n) % n;
    const b = (g[g.length - 1].endIndex + reach) % n;
    const gates: GateInfo[] = [];
    // knots in lap order starting from a
    const order = knots.map((idx, j) => ({ idx, j })).sort((p, q) => ((p.idx - a + n) % n) - ((q.idx - a + n) % n));
    for (const { idx, j } of order) {
      if (!within(idx, a, b) || isGate[j]) continue;
      isGate[j] = true;
      const apexOf = g.find((c) => c.apexIndex === idx);
      const beforeFirst = !within(idx, g[0].startIndex, b);
      const afterLast = within(idx, g[g.length - 1].endIndex, b) && idx !== g[g.length - 1].endIndex && !apexOf;
      gates.push({
        knot: j,
        index: idx,
        label: apexOf ? "Apex" : beforeFirst ? "Turn-in" : afterLast ? "Exit" : "Mid",
        corner: apexOf?.name,
      });
    }
    // Several points before the first corner: only the last is the turn-in.
    // Several after the last: the first is the exit, the final one the track-out.
    const ins = gates.filter((x) => x.label === "Turn-in");
    ins.slice(0, -1).forEach((x) => (x.label = "Approach"));
    const outs = gates.filter((x) => x.label === "Exit");
    if (outs.length > 1) outs[outs.length - 1].label = "Track-out";
    outs.slice(1, -1).forEach((x) => (x.label = "Mid"));
    const dirs = new Set(g.map((c) => c.direction));
    return {
      id: id + 1,
      name: g.length === 1 ? g[0].name : `${g[0].name}–${g[g.length - 1].name}`,
      corners: g.map((c) => c.name),
      direction: dirs.size === 1 ? g[0].direction : "mixed",
      gates,
    };
  });
  return { complexes: complexes.filter((c) => c.gates.length > 0), isGate };
}

/**
 * Fill every non-gate knot by linear interpolation (in centerline distance)
 * between the nearest gates before and after it, then enforce track limits.
 * The result is a complete, valid RacingLine knot vector.
 */
export function expandGates(pt: PreparedTrack, controls: LineControls, knotOffsets: number[], limit: number): number[] {
  // Interpolate, enforce limits (which may pull gates inward), and repeat
  // until stable, so expandGates(expandGates(z)) === expandGates(z).
  let z = knotOffsets;
  for (let iter = 0; iter < 10; iter++) {
    const next = enforceLimits(pt, interpolateFillers(pt, controls, z), limit);
    if (next.every((v, j) => v === z[j])) return next;
    z = next;
  }
  return z;
}

function interpolateFillers(pt: PreparedTrack, controls: LineControls, knotOffsets: number[]): number[] {
  const { n } = pt;
  const knots = pt.track.lineKnots;
  const k = knots.length;
  const z = knotOffsets.slice();
  if (!controls.isGate.some(Boolean)) return z;
  for (let j = 0; j < k; j++) {
    if (controls.isGate[j]) continue;
    let prev = -1;
    let next = -1;
    for (let o = 1; o < k && (prev < 0 || next < 0); o++) {
      if (prev < 0 && controls.isGate[(j - o + k) % k]) prev = (j - o + k) % k;
      if (next < 0 && controls.isGate[(j + o) % k]) next = (j + o) % k;
    }
    const dPrev = (knots[j] - knots[prev] + n) % n;
    const dNext = (knots[next] - knots[j] + n) % n;
    const t = dPrev / Math.max(1, dPrev + dNext);
    z[j] = Math.round((knotOffsets[prev] + (knotOffsets[next] - knotOffsets[prev]) * t) * 100) / 100 + 0;
  }
  return z;
}
