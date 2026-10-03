import { beforeEach, describe, expect, it } from "vitest";
import { KEY_POOL, WHEELS, dailyPlan, gradeStep, loadPitStop, makePlan, penaltyMs, pitShare, recordStop, todaysStop, verdict } from "./pitstop";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
  } as Storage;
});

const result = (totalMs: number, wrongKeys = 0) => ({ totalMs, splits: [350, 400, 500, 700, 260], wrongKeys, earlyRelease: false });

describe("pit stop", () => {
  it("lights every wheel once, each with its own key", () => {
    for (let i = 0; i < 50; i++) {
      const p = makePlan();
      expect([...p.order].sort()).toEqual([...WHEELS].sort());
      expect(new Set(p.keys).size).toBe(4);
      expect(p.keys.every((k) => KEY_POOL.includes(k))).toBe(true);
      expect(p.greenDelayMs).toBeGreaterThanOrEqual(220);
      expect(p.greenDelayMs).toBeLessThanOrEqual(700);
    }
  });

  it("gives everyone the same daily stop", () => {
    expect(dailyPlan("2026-10-04")).toEqual(dailyPlan("2026-10-04"));
    expect(dailyPlan("2026-10-04")).not.toEqual(dailyPlan("2026-10-05"));
  });

  it("adds penalties and grades steps like sectors", () => {
    expect(penaltyMs({ wrongKeys: 2, earlyRelease: true })).toBe(2000);
    expect(gradeStep(0, 250)).toBe("purple");
    expect(gradeStep(0, 500)).toBe("yellow");
    expect(gradeStep(4, 250)).toBe("green");
    expect(verdict(1750)).toMatch(/record/);
  });

  it("keeps the best, the last five and only the first daily attempt", () => {
    let r = loadPitStop();
    r = recordStop(r, result(2400), "2026-10-04");
    r = recordStop(r, result(2100), "2026-10-04");
    expect(r.best).toBe(2100);
    expect(todaysStop(loadPitStop(), "2026-10-04")?.totalMs).toBe(2400);
    expect(pitShare(result(2400, 1), "x", "2026-10-04")).toMatch(/2\.400 s\n🟩🟩🟨🟥🟩 \+0\.5 s penalty/);
  });
});
