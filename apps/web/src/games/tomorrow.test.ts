import { describe, expect, it } from "vitest";
import { dailyCondition, dailyTrack } from "../modes/daily";
import { nextDay, tomorrowQuali } from "./tomorrow";

describe("tomorrow's Quali", () => {
  it("steps over month and year ends", () => {
    expect(nextDay("2026-10-31")).toBe("2026-11-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });

  it("names the next day's circuit, with its conditions unless dry", () => {
    const text = tomorrowQuali("2026-10-30");
    expect(dailyTrack("2026-10-31")).toBe("hungaroring");
    expect(text).toContain("Hungaroring");
    if (dailyCondition("2026-10-31") !== "dry") expect(text).toMatch(/, (wet|low downforce)$/);
  });
});
