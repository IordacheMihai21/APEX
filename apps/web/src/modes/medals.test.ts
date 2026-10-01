import { describe, expect, it } from "vitest";
import { OUTLINES } from "../game/outlines";
import { better, medalFor, medalTimes, nextMedal } from "./medals";

const t = medalTimes("interlagos")!;
const notAllPurple = ["purple", "green"] as const;

describe("medals", () => {
  it("are ordered bronze > silver > gold > optimal on every circuit", () => {
    for (const [id, o] of Object.entries(OUTLINES)) {
      expect(o.medals.bronze, id).toBeGreaterThan(o.medals.silver);
      expect(o.medals.silver, id).toBeGreaterThan(o.medals.gold);
      expect(o.medals.gold, id).toBeGreaterThan(o.lapMs);
    }
  });

  it("awards by lap time, inclusive at each target", () => {
    expect(medalFor("interlagos", t.bronze + 1, [...notAllPurple])).toBeNull();
    expect(medalFor("interlagos", t.bronze, [...notAllPurple])).toBe("bronze");
    expect(medalFor("interlagos", t.silver, [...notAllPurple])).toBe("silver");
    expect(medalFor("interlagos", t.gold, [...notAllPurple])).toBe("gold");
  });

  it("gives Pole only for an all-purple lap, whatever the time", () => {
    expect(medalFor("interlagos", t.bronze + 5000, ["purple", "purple"])).toBe("pole");
    expect(medalFor("interlagos", t.gold - 500, [...notAllPurple])).toBe("gold");
  });

  it("points at the next tier", () => {
    expect(nextMedal("interlagos", null)).toEqual({ medal: "bronze", ms: t.bronze });
    expect(nextMedal("interlagos", "gold")).toEqual({ medal: "pole", ms: null });
    expect(nextMedal("interlagos", "pole")).toBeNull();
  });

  it("keeps the better medal", () => {
    expect(better("silver", "bronze")).toBe("silver");
    expect(better(null, "gold")).toBe("gold");
  });
});
