import { describe, expect, it } from "vitest";
import { PeriodicSpline } from "../src";

describe("PeriodicSpline", () => {
  const t = [0, 10, 25, 40, 70];
  const y = [1, -2, 3, 0.5, -1];
  const sp = new PeriodicSpline(t, y, 100);

  it("interpolates its knots", () => {
    t.forEach((ti, j) => expect(sp.evaluate(ti)).toBeCloseTo(y[j], 12));
  });

  it("is periodic and continuous across the wrap", () => {
    expect(sp.evaluate(100)).toBeCloseTo(sp.evaluate(0), 12);
    expect(sp.evaluate(99.999)).toBeCloseTo(sp.evaluate(-0.001), 9);
    expect(sp.evaluate(135)).toBeCloseTo(sp.evaluate(35), 12);
  });

  it("reproduces a constant exactly", () => {
    const c = new PeriodicSpline(t, [2, 2, 2, 2, 2], 100);
    for (let u = 0; u < 100; u += 7.3) expect(c.evaluate(u)).toBeCloseTo(2, 12);
  });
});
