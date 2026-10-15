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

  it("turns the car smoothly: no zigzag from one point of the line to the next", () => {
    // the line's points are 2.5 m apart and rounded to the centimetre; drawn segment by segment, the car's heading
    // flicked left and right a hundred times a lap. Frame by frame at 30 fps, the turn rate now only changes gently,
    // and changes direction only where the road does (an S-bend on the way in)
    for (const c of corners) {
      const run = new CornerRun(c, "dry");
      const ideal = idealCalls(c, "dry");
      let prev: number | null = null;
      let prevTurn: number | null = null;
      let reversals = 0;
      while (!run.outcome) {
        for (let t = 0; t < 1 / 30 - 1e-9 && !run.outcome; t += DT) {
          if (run.phase === "approach" && run.s >= ideal.brakeS) run.press(true);
          else if (run.phase === "braking" && run.v <= ideal.minSpeed + 0.02) run.press(false);
          else if (run.phase === "rolling" && run.s >= ideal.throttleS) run.press(true);
          run.advance(DT);
        }
        const h = run.pose().heading;
        if (prev !== null) {
          const turn = (Math.atan2(Math.sin(h - prev), Math.cos(h - prev)) * 180) / Math.PI;
          if (prevTurn !== null) {
            expect(Math.abs(turn - prevTurn), c.name).toBeLessThan(1);
            if (Math.sign(turn) !== Math.sign(prevTurn) && Math.abs(turn - prevTurn) > 0.25) reversals++;
          }
          prevTurn = turn;
        }
        prev = h;
      }
      expect(reversals, c.name).toBeLessThanOrEqual(3);
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
