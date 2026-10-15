import { describe, expect, it } from "vitest";
import { Gearbox, loopRate } from "./engineSound";
import { type CornerData, CornerRun, DT, idealCalls } from "../modes/makeCorner";

const files = import.meta.glob<CornerData>(["../game/corners/*.json", "!../game/corners/index.json"], { eager: true, import: "default" });

describe("engine sound", () => {
  it("revs within the V10's range and shifts one gear at a time through every corner", () => {
    for (const c of Object.values(files)) {
      const run = new CornerRun(c, "dry");
      const ideal = idealCalls(c, "dry");
      const box = new Gearbox(run.v);
      const gears: number[] = [];
      while (!run.outcome) {
        for (let t = 0; t < 1 / 30 - 1e-9 && !run.outcome; t += DT) {
          if (run.phase === "approach" && run.s >= ideal.brakeS) run.press(true);
          else if (run.phase === "braking" && run.v <= ideal.minSpeed + 0.02) run.press(false);
          else if (run.phase === "rolling" && run.s >= ideal.throttleS) run.press(true);
          run.advance(DT);
        }
        const rpm = box.step(run.v);
        expect(rpm).toBeGreaterThanOrEqual(4500);
        expect(rpm).toBeLessThanOrEqual(18800);
        // the loop is never played absurdly slow or fast
        expect(loopRate(rpm)).toBeGreaterThan(0.25);
        expect(loopRate(rpm)).toBeLessThan(1.2);
        gears.push(box.gear);
      }
      // it changes gear through the corner, one gear at a time
      expect(new Set(gears).size, c.name).toBeGreaterThan(1);
      for (let i = 1; i < gears.length; i++) expect(Math.abs(gears[i] - gears[i - 1])).toBeLessThanOrEqual(1);
    }
  });
});
