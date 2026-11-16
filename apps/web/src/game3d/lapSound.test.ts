import { describe, expect, it } from "vitest";
import { layerWeights } from "./lapSound";

const layers = [
  { rpm: 7000, on: false },
  { rpm: 8000, on: true },
  { rpm: 10000, on: true },
  { rpm: 12000, on: true },
];

describe("engine loop crossfade", () => {
  it("plays the two loops either side of the revs, with equal power", () => {
    const w = layerWeights(layers, 9000, true);
    expect(w[0]).toBe(0);
    expect(w[3]).toBe(0);
    expect(w[1]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(w[1] ** 2 + w[2] ** 2).toBeCloseTo(1, 6);
  });

  it("holds the nearest loop beyond the ends, and uses only the set for the throttle", () => {
    expect(layerWeights(layers, 13000, true)).toEqual([0, 0, 0, 1]);
    expect(layerWeights(layers, 5000, true)).toEqual([0, 1, 0, 0]);
    expect(layerWeights(layers, 9000, false)).toEqual([1, 0, 0, 0]);
  });
});
