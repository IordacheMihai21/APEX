/**
 * The Phase 1 go/no-go invariants: good racecraft must beat bad racecraft
 * for understandable reasons. If any of these fail after a physics change,
 * the game design is broken, not just the test.
 */
import { describe, expect, it } from "vitest";
import { APEX_FORMULA as car, buildTrack, compareRuns, fitDrawing, optimizeLine, prepareTrack, simulateLap, usableHalfWidth } from "../src";
import { drawOffsets, kestrelPrepared, roundedRect } from "./helpers";

const pt = kestrelPrepared();
const ref = simulateLap({ track: pt, line: pt.track.optimalLine! });
const lap = (knotOffsets: number[]) => simulateLap({ track: pt, line: { knotOffsets } });
const shiftApex = (m: number) => {
  const sh = Math.round(m / pt.step);
  const off = ref.samples.offset;
  const moved = Array.from(off, (_, i) => off[(i - sh + pt.n) % pt.n]);
  return simulateLap({ track: pt, line: fitDrawing(pt, drawOffsets(pt, moved), car).line });
};
const centerCurv = lap(new Array(pt.k).fill(0)).samples.curvature;
const hug = (side: 1 | -1) => {
  const lim = usableHalfWidth(pt, car);
  const off = Array.from(centerCurv, (k) => (Math.abs(k) > 1 / 400 ? side * Math.sign(k) * lim : 0));
  return simulateLap({ track: pt, line: fitDrawing(pt, drawOffsets(pt, off), car).line });
};
const length = (r: ReturnType<typeof lap>) => r.samples.distance[pt.n - 1];

describe("racing logic on Kestrel", () => {
  it("the optimal line is valid and clearly beats the centerline (> 1.5 s)", () => {
    expect(ref.valid).toBe(true);
    expect(lap(new Array(pt.k).fill(0)).lapTimeMs - ref.lapTimeMs).toBeGreaterThan(1500);
  });

  it("the shortest line is NOT the fastest", () => {
    const shortest = simulateLap({
      track: pt,
      line: optimizeLine(pt, { objective: (r) => length(r) }).line,
    });
    expect(length(shortest)).toBeLessThan(length(ref));
    expect(shortest.lapTimeMs - ref.lapTimeMs).toBeGreaterThan(1000);
  });

  it("hugging the inside of every corner is clearly slow (> 0.5 s, ~2% of the lap)", () => {
    expect(hug(1).lapTimeMs - ref.lapTimeMs).toBeGreaterThan(500);
  });

  it("exit priority: a late apex costs less than an equally early apex", () => {
    for (const m of [12, 25]) {
      const early = shiftApex(-m);
      const late = shiftApex(m);
      expect(late.lapTimeMs).toBeGreaterThan(ref.lapTimeMs);
      expect(early.lapTimeMs).toBeGreaterThan(late.lapTimeMs);
    }
  });

  it("mistakes are graded: bigger apex errors cost more", () => {
    expect(shiftApex(-25).lapTimeMs).toBeGreaterThan(shiftApex(-12).lapTimeMs);
    expect(shiftApex(25).lapTimeMs).toBeGreaterThan(shiftApex(12).lapTimeMs);
  });

  it("corner time-loss segments partition the lap (deltas sum to the lap delta)", () => {
    const run = shiftApex(-12);
    const cmp = compareRuns(run, ref);
    const sum = cmp.corners.reduce((a, c) => a + c.deltaMs, 0);
    expect(Math.abs(sum - (run.rawLapTimeMs - ref.rawLapTimeMs))).toBeLessThan(1e-6);
    const sectorSum = cmp.sectors.reduce((a, c) => a + c.deltaMs, 0);
    expect(Math.abs(sectorSum - (run.rawLapTimeMs - ref.rawLapTimeMs))).toBeLessThan(1e-6);
  });

  it("the optimiser cannot improve the published line by a meaningful margin", () => {
    const again = optimizeLine(pt, { initial: pt.track.optimalLine!, startStepM: 0.5 });
    expect(ref.rawLapTimeMs - again.rawLapTimeMs).toBeLessThan(50);
  });
});

describe("exit speed on a simple circuit", () => {
  it("the optimal line is longer than the shortest line yet faster", () => {
    const rect = prepareTrack(buildTrack(roundedRect()));
    const fastest = simulateLap({ track: rect, line: optimizeLine(rect).line });
    const shortest = simulateLap({
      track: rect,
      line: optimizeLine(rect, { objective: (r) => r.samples.distance[rect.n - 1] }).line,
    });
    expect(length2(fastest)).toBeGreaterThan(length2(shortest));
    expect(fastest.lapTimeMs).toBeLessThan(shortest.lapTimeMs - 300);
    function length2(r: typeof fastest) {
      return r.samples.distance[rect.n - 1];
    }
  });
});
