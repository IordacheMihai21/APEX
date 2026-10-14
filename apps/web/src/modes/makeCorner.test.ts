import { describe, expect, it } from "vitest";
import INDEX from "../game/corners/index.json";
import { CONDITIONS } from "@apex/engine";
import { type CornerData, CornerRun, DT, MAX_POINTS, driveCalls, idealCalls, perfectRun, scoreRun } from "./makeCorner";

const files = import.meta.glob<CornerData>(["../game/corners/*.json", "!../game/corners/index.json"], { eager: true, import: "default" });
const corners = Object.values(files);

describe("make the corner", () => {
  it("has a file for every corner in the index, and enough of them for a daily game", () => {
    expect(corners.length).toBe(INDEX.length);
    expect(corners.length).toBeGreaterThanOrEqual(15);
    for (const c of INDEX) expect(corners.some((x) => x.id === c.id), c.id).toBe(true);
  });

  it("drives every corner cleanly with the ideal calls, in every condition", () => {
    for (const c of corners)
      for (const cond of CONDITIONS) {
        const p = perfectRun(c, cond);
        expect(p.outcome, `${c.name} ${cond}`).toBe("done");
        expect(scoreRun(p, p).points).toBe(MAX_POINTS);
        // the perfect run carries the perfect lap's speed through the corner
        expect(Math.abs(p.minV - idealCalls(c, cond).minSpeed), `${c.name} ${cond}`).toBeLessThan(1);
      }
  });

  it("punishes each call: early braking costs time, late braking puts the car off, holding the brake stops it", () => {
    for (const c of corners) {
      const ideal = idealCalls(c, "dry");
      const perfect = perfectRun(c, "dry");
      // brakes on 10 m early, off once down to the corner's speed, throttle at the ideal point: slower, still on the road
      const e = new CornerRun(c, "dry");
      while (!e.outcome && e.s < ideal.brakeS - 10) e.advance(DT);
      e.press(true);
      while (!e.outcome && e.v > ideal.minSpeed) e.advance(DT);
      e.press(false);
      while (!e.outcome && e.s < ideal.throttleS) e.advance(DT);
      e.press(true);
      while (!e.outcome) e.advance(DT);
      const early = scoreRun(e, perfect);
      expect(early.outcome, c.name).toBe("done");
      expect(early.points, c.name).toBeLessThan(MAX_POINTS);
      expect(early.points, c.name).toBeGreaterThan(400);
      const late = scoreRun(driveCalls(c, "dry", { brakeS: ideal.brakeS + 40, releaseS: ideal.releaseS + 20, throttleS: ideal.throttleS + 20 }), perfect);
      expect(late.outcome, c.name).toBe("off");
      expect(late.points).toBe(0);
      const held = scoreRun(driveCalls(c, "dry", { brakeS: ideal.brakeS, releaseS: null, throttleS: null }), perfect);
      expect(held.outcome, c.name).toBe("stopped");
      expect(held.points).toBe(0);
      const never = driveCalls(c, "dry", { brakeS: null, releaseS: null, throttleS: null });
      expect(never.outcome, c.name).toBe("off");
    }
  });

  it("is the same run on every device: steps are fixed, whatever the frame rate", () => {
    const c = corners[0];
    const a = perfectRun(c, "dry");
    const b = perfectRun(c, "dry");
    expect(a.t).toBe(b.t);
    expect(a.s).toBe(b.s);
  });
});
