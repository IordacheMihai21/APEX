import { describe, expect, it } from "vitest";
import STATS from "../game/cornerStats.json";
import { WEEKLY_CORNERS } from "../modes/cornerList";
import { CORNER_TEXT, cornerBySlug, cornerSlug, keyOf } from "./cornerText";
import { parseContent } from "./meta";

describe("famous corner guides", () => {
  it("gives every famous corner its text, numbers and an address of its own", () => {
    for (const w of WEEKLY_CORNERS) {
      const text = CORNER_TEXT[keyOf(w)];
      expect(text, w.name).toBeDefined();
      expect(text.where.length + text.drive.length, w.name).toBeGreaterThanOrEqual(4);
      expect(text.mistakes.length, w.name).toBeGreaterThanOrEqual(3);
      expect(text.wet.length, w.name).toBeGreaterThan(200);
      expect(keyOf(w) in STATS, w.name).toBe(true);
      expect(cornerBySlug(cornerSlug(w)), w.name).toBe(w);
      expect(parseContent(`/corners/${cornerSlug(w)}`), w.name).toEqual({ page: "corners", slug: cornerSlug(w) });
    }
    expect(Object.keys(CORNER_TEXT).sort()).toEqual(WEEKLY_CORNERS.map(keyOf).sort());
  });
});
