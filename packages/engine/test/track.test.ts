import { describe, expect, it } from "vitest";
import { buildTrack, prepareTrack } from "../src";
import { KESTREL } from "../../../tools/track-builder/src/tracks";
import { loadTrack, roundedRect } from "./helpers";

describe("buildTrack", () => {
  it("is reproducible: rebuilding Kestrel matches the committed JSON geometry", () => {
    const built = buildTrack(KESTREL);
    const stored = loadTrack("kestrel");
    expect(built.centerline).toEqual(stored.centerline);
    expect(built.lineKnots).toEqual(stored.lineKnots);
    expect(built.corners).toEqual(stored.corners);
  });

  it("Kestrel: sensible geometry, corners and knots", () => {
    const t = loadTrack("kestrel");
    expect(t.centerline).toHaveLength(1000);
    expect(t.lengthMeters).toBeGreaterThan(2000);
    expect(t.direction).toBe("ccw");
    expect(t.corners.length).toBeGreaterThanOrEqual(5);
    // knots strictly increasing and every apex is a knot
    for (let i = 1; i < t.lineKnots.length; i++) expect(t.lineKnots[i]).toBeGreaterThan(t.lineKnots[i - 1]);
    for (const c of t.corners) expect(t.lineKnots).toContain(c.apexIndex);
  });

  it("boundaries sit half the width from the centerline", () => {
    const t = loadTrack("kestrel");
    for (const i of [0, 250, 500, 750]) {
      const [cx, cy] = t.centerline[i];
      expect(Math.hypot(t.leftBoundary[i][0] - cx, t.leftBoundary[i][1] - cy)).toBeCloseTo(t.widthMeters / 2, 2);
      expect(Math.hypot(t.rightBoundary[i][0] - cx, t.rightBoundary[i][1] - cy)).toBeCloseTo(t.widthMeters / 2, 2);
    }
  });

  it("rounded rectangle: four left-hand corners, timing segments cover the lap", () => {
    const t = buildTrack(roundedRect());
    expect(t.corners).toHaveLength(4);
    expect(t.corners.every((c) => c.direction === "left")).toBe(true);
    const pt = prepareTrack(t);
    expect(pt.k).toBe(t.lineKnots.length);
  });
});

describe("real-circuit import", () => {
  it("is reproducible from the raw GeoJSON", async () => {
    const { realCircuitSpecs } = await import("../../../tools/track-builder/src/real-circuits");
    const monza = realCircuitSpecs().find((s) => s.id === "monza")!;
    const built = buildTrack(monza);
    const stored = loadTrack("monza");
    expect(built.centerline).toEqual(stored.centerline);
    expect(built.lineKnots).toEqual(stored.lineKnots);
  });

  it("keeps the official lap length and race direction", () => {
    const expected: Record<string, [number, "cw" | "ccw"]> = {
      monza: [5793, "cw"], spa: [7004, "cw"], silverstone: [5891, "cw"], monaco: [3337, "cw"],
      interlagos: [4309, "ccw"], austin: [5514, "ccw"], imola: [4909, "ccw"], zandvoort: [4259, "cw"],
    };
    for (const [id, [len, dir]] of Object.entries(expected)) {
      const t = loadTrack(id);
      expect(Math.abs(t.lengthMeters - len) / len).toBeLessThan(0.005);
      expect(t.direction).toBe(dir);
    }
  });
});
