import { describe, expect, it } from "vitest";
import { dailyTrack, qualifyingDay, raceWeek } from "./daily";

describe("race weekends", () => {
  it("move the Saturday daily to that circuit", () => {
    expect(dailyTrack("2026-10-24")).toBe("austin");
    expect(dailyTrack("2026-11-07")).toBe("interlagos");
    expect(qualifyingDay("2026-10-24")?.trackId).toBe("austin");
    expect(qualifyingDay("2026-10-23")).toBeNull();
  });

  it("announce themselves from the Monday of race week to the Sunday", () => {
    expect(raceWeek("2026-10-19")?.trackId).toBe("austin");
    expect(raceWeek("2026-10-25")?.trackId).toBe("austin");
    expect(raceWeek("2026-10-18")).toBeNull();
    expect(raceWeek("2026-10-26")).toBeNull();
  });

  it("leave other days on the rotation", () => {
    const days = Array.from({ length: 12 }, (_, i) => dailyTrack(`2026-10-${String(i + 1).padStart(2, "0")}`));
    expect(new Set(days).size).toBe(12);
  });
});
