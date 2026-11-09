import { describe, expect, it } from "vitest";
import { vegasWeek } from "./vegasNight";

describe("Vegas Night", () => {
  it("runs from 19 to 23 November 2026 by the local calendar day", () => {
    expect(vegasWeek(new Date(2026, 10, 18, 23, 59))).toBe(false);
    expect(vegasWeek(new Date(2026, 10, 19, 0, 0))).toBe(true);
    expect(vegasWeek(new Date(2026, 10, 21, 22, 0))).toBe(true);
    expect(vegasWeek(new Date(2026, 10, 23, 23, 59))).toBe(true);
    expect(vegasWeek(new Date(2026, 10, 24, 0, 0))).toBe(false);
    expect(vegasWeek(new Date(2027, 10, 20))).toBe(false);
  });
});
