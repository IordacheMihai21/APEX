import { beforeEach, describe, expect, it } from "vitest";
import { CORNERS, RUNS_PER_DAY, callGrades, conditionOfDay, cornerDone, cornerLabel, cornerOfDay, cornerScore, cornerShare, dayRuns, recordRun } from "./makeCornerDay";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  } as Storage;
});

const run = (points: number, outcome: "done" | "off" | "stopped" = "done") => ({ points, outcome, lost: null, brakeM: -1, speedKmh: 0.2, throttleM: 2 });

describe("make the corner's day", () => {
  it("drives every corner once a round, never the same corner two days running", () => {
    const n = CORNERS.length;
    for (let r = 0; r < 6; r++) {
      const ids = Array.from({ length: n }, (_, i) => cornerOfDay(r * n + i).id);
      expect(new Set(ids).size).toBe(n);
    }
    for (let d = 1; d < n * 6; d++) expect(cornerOfDay(d).id, `day ${d}`).not.toBe(cornerOfDay(d - 1).id);
  });

  it("is mostly dry", () => {
    const days = Array.from({ length: 400 }, (_, i) => conditionOfDay(i));
    const dry = days.filter((c) => c === "dry").length / days.length;
    expect(dry).toBeGreaterThan(0.6);
    expect(days).toContain("wet");
    expect(days).toContain("lowdf");
  });

  it("names the corner and its circuit", () => {
    expect(cornerLabel({ id: "spa-0", trackId: "spa", name: "La Source" })).toEqual({ corner: "La Source", circuit: "Spa-Francorchamps" });
    expect(cornerLabel({ id: "austin-0", trackId: "austin", name: "Austin's Turn 1" })).toEqual({ corner: "Turn 1", circuit: "Austin" });
    expect(cornerLabel({ id: "monaco-3", trackId: "monaco", name: "Monaco Turns 12–14" }).corner).toBe("Turns 12–14");
  });

  it("colours each call, and the call that ended a run red", () => {
    expect(callGrades({ brakeM: 1, speedKmh: -3, throttleM: 10, outcome: "done" })).toEqual(["purple", "green", "yellow"]);
    expect(callGrades({ brakeM: 1, speedKmh: 0.2, throttleM: 1, outcome: "off" })).toEqual(["purple", "purple", "red"]);
    expect(callGrades({ brakeM: null, speedKmh: null, throttleM: null, outcome: "off" })).toEqual(["red", "none", "none"]);
  });

  it("keeps three runs a day and scores the best", () => {
    recordRun(run(640));
    recordRun(run(0, "off"));
    const runs = recordRun(run(910));
    expect(runs.length).toBe(RUNS_PER_DAY);
    expect(cornerDone(runs)).toBe(true);
    expect(cornerScore(runs)).toBe(910);
    expect(recordRun(run(1000)).length).toBe(RUNS_PER_DAY);
    expect(cornerScore(dayRuns())).toBe(910);
    const share = cornerShare(dayRuns(), "https://lapdle.com/make-the-corner");
    expect(share).toMatch(/^Lapdle Make the corner #\d+\n.+\n🟪🟪🟪 910\/1000\nhttps:/);
  });
});
