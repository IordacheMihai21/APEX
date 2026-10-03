import { beforeEach, describe, expect, it } from "vitest";
import { WEEKLY_CORNERS, cornerMedal, cornerShare, daysLeft, loadCornerWeek, recordCornerRun, weekNumber, weekStart, weeklyCorner } from "./corner";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
  } as Storage;
});

describe("corner of the week", () => {
  it("runs Monday to Sunday", () => {
    expect(weekStart("2026-10-03")).toBe("2026-09-28"); // a Saturday
    expect(weekStart("2026-10-05")).toBe("2026-10-05"); // a Monday
    expect(daysLeft("2026-10-05")).toBe(7);
    expect(daysLeft("2026-10-04")).toBe(1);
  });

  it("numbers weeks from launch and changes corner each week", () => {
    expect(weekNumber("2026-10-01")).toBe(1);
    expect(weekNumber("2026-10-05")).toBe(2);
    expect(weeklyCorner("2026-10-05")).not.toEqual(weeklyCorner("2026-10-04"));
    expect(new Set(WEEKLY_CORNERS.map((c) => `${c.trackId}:${c.complex}`)).size).toBe(WEEKLY_CORNERS.length);
  });

  it("awards medals by time lost to the perfect line", () => {
    expect(cornerMedal(30)).toBe("pole");
    expect(cornerMedal(80)).toBe("gold");
    expect(cornerMedal(150)).toBe("silver");
    expect(cornerMedal(300)).toBe("bronze");
    expect(cornerMedal(600)).toBeNull();
  });

  it("keeps the week's best run and counts every try", () => {
    recordCornerRun({ deltaMs: 300, timeMs: 5000, knots: [1] }, "2026-10-03");
    recordCornerRun({ deltaMs: 120, timeMs: 4900, knots: [2] }, "2026-10-03");
    const wk = recordCornerRun({ deltaMs: 200, timeMs: 4950, knots: [3] }, "2026-10-04");
    expect(wk).toMatchObject({ bestDeltaMs: 120, tries: 3, knots: [2] });
    expect(loadCornerWeek("2026-10-05")).toBeNull();
    expect(cornerShare(wk, weeklyCorner("2026-10-03"), "2026-10-03")).toMatch(/Silver, \+0\.120 s to perfect \(3 tries\)/);
  });
});
