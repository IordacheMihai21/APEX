import { describe, expect, it } from "vitest";
import { APEX_FORMULA as car, enforceLimits, fitDrawing, resolveLine, simulateLap, usableHalfWidth } from "../src";
import { drawOffsets, kestrelPrepared } from "./helpers";

const pt = kestrelPrepared();
const optimal = pt.track.optimalLine!;
const optOffsets = simulateLap({ track: pt, line: optimal }).samples.offset;
const optTime = pt.track.optimalTimeMs!;

describe("resolveLine (track limits)", () => {
  it("rejects malformed input", () => {
    expect(resolveLine(pt, { knotOffsets: [0, 1] }, car).status).toBe("INVALID_INPUT");
    const nan = new Array(pt.k).fill(0);
    nan[3] = NaN;
    expect(resolveLine(pt, { knotOffsets: nan }, car).status).toBe("INVALID_INPUT");
  });

  it("flags a knot beyond the usable width as OFF_TRACK", () => {
    const z = new Array(pt.k).fill(0);
    z[5] = usableHalfWidth(pt, car) + 0.5;
    const r = resolveLine(pt, { knotOffsets: z }, car);
    expect(r.valid).toBe(false);
    expect(r.status).toBe("OFF_TRACK");
  });

  it("never clips: spline overshoot between in-range knots is OFF_TRACK", () => {
    const lim = usableHalfWidth(pt, car);
    const z = Array.from({ length: pt.k }, (_, j) => (j % 2 ? lim : -lim)); // maximal zig-zag
    const r = resolveLine(pt, { knotOffsets: z }, car);
    expect(r.valid).toBe(false);
    expect(r.status).toBe("OFF_TRACK");
  });

  it("enforceLimits pulls such a line back inside the track", () => {
    const lim = usableHalfWidth(pt, car);
    const z = enforceLimits(pt, Array.from({ length: pt.k }, (_, j) => (j % 2 ? lim : -lim)), lim);
    expect(resolveLine(pt, { knotOffsets: z }, car).valid).toBe(true);
    z.forEach((v) => expect(Math.round(v * 100) / 100).toBe(v)); // centimetre grid
  });
});

describe("fitDrawing (freehand → line)", () => {
  it("recovers the optimal line from a clean drawing of it", () => {
    const fit = fitDrawing(pt, drawOffsets(pt, optOffsets), car);
    expect(fit.valid).toBe(true);
    expect(fit.coverage).toBeGreaterThan(0.99);
    const r = simulateLap({ track: pt, line: fit.line });
    expect(Math.abs(r.lapTimeMs - optTime)).toBeLessThan(60);
  });

  it("ignores drawing direction", () => {
    const a = fitDrawing(pt, drawOffsets(pt, optOffsets), car).line.knotOffsets;
    const b = fitDrawing(pt, drawOffsets(pt, optOffsets, true), car).line.knotOffsets;
    b.forEach((v, j) => expect(v).toBeCloseTo(a[j], 1));
  });

  it("works from a sparse stroke (pointer events arrive every few metres)", () => {
    const pts = drawOffsets(pt, optOffsets).filter((_, i) => i % 4 === 0);
    pts.push(pts[0]);
    const fit = fitDrawing(pt, pts, car);
    expect(fit.valid).toBe(true);
    expect(Math.abs(simulateLap({ track: pt, line: fit.line }).lapTimeMs - optTime)).toBeLessThan(150);
  });

  it("small random knot errors cost little (the line response is smooth)", () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
    let total = 0;
    for (let t = 0; t < 20; t++) {
      const z = optimal.knotOffsets.map((v) => v + 0.2 * rnd()); // ±10 cm
      const r = simulateLap({ track: pt, line: { knotOffsets: enforceLimits(pt, z, usableHalfWidth(pt, car)) } });
      expect(r.valid).toBe(true);
      total += r.lapTimeMs - optTime;
    }
    expect(total / 20).toBeLessThan(150);
  });

  it("forgives a brief overshoot past the edge", () => {
    const off = Float64Array.from(optOffsets);
    for (let i = 300; i < 303; i++) off[i] = 9; // ~6 m of track, 3 m past the edge
    expect(fitDrawing(pt, drawOffsets(pt, off), car).valid).toBe(true);
  });

  it("rejects a sustained excursion off track", () => {
    const off = Float64Array.from(optOffsets);
    for (let i = 300; i < 340; i++) off[i] = 12; // ~90 m, 6 m past the edge
    const fit = fitDrawing(pt, drawOffsets(pt, off), car);
    expect(fit.valid).toBe(false);
    expect(fit.issues.map((i) => i.status)).toContain("OFF_TRACK");
  });

  it("rejects a stroke that only covers half the lap", () => {
    const fit = fitDrawing(pt, drawOffsets(pt, optOffsets).slice(0, 500), car);
    expect(fit.valid).toBe(false);
    expect(fit.status).toBe("INCOMPLETE");
  });

  it("rejects cutting across the infield", () => {
    // Draw the lap but jump straight from the end of the main straight (T1 entry)
    // across to the T2 exit, skipping the hairpin.
    const full = drawOffsets(pt, optOffsets);
    const t1 = pt.track.corners[0];
    const cut = [...full.slice(0, t1.startIndex - 10), ...full.slice(t1.endIndex + 60)];
    const fit = fitDrawing(pt, cut, car);
    expect(fit.valid).toBe(false);
    expect(["CUT_CORNER", "OFF_TRACK", "INCOMPLETE"]).toContain(fit.status);
  });

  it("rejects garbage input", () => {
    expect(fitDrawing(pt, [], car).status).toBe("INVALID_INPUT");
    expect(fitDrawing(pt, [[0, 0], [NaN, 1]], car).status).toBe("INVALID_INPUT");
  });
});
