import { describe, expect, it } from "vitest";
import { GUIDE_CIRCUITS as CIRCUITS } from "../modes/circuits";
import STATS from "../game/circuitStats.json";
import { CIRCUIT_MORE, CIRCUIT_TEXT } from "./circuitText";
import { contentMeta, contentPath, parseContent } from "./meta";

describe("circuit guides", () => {
  it("has written text for every circuit, and nothing else", () => {
    expect(Object.keys(CIRCUIT_TEXT).sort()).toEqual(CIRCUITS.map((c) => c.id).sort());
    for (const c of CIRCUITS) {
      expect(CIRCUIT_TEXT[c.id].character.length, c.id).toBeGreaterThan(100);
      expect(CIRCUIT_TEXT[c.id].drive.length, c.id).toBeGreaterThan(80);
      expect(CIRCUIT_MORE[c.id].lap.length, c.id).toBeGreaterThanOrEqual(3);
      expect(CIRCUIT_MORE[c.id].history.length, c.id).toBeGreaterThan(300);
    }
    expect(Object.keys(CIRCUIT_MORE).sort()).toEqual(Object.keys(CIRCUIT_TEXT).sort());
    expect(Object.keys(STATS).sort()).toEqual(Object.keys(CIRCUIT_TEXT).sort());
  });

  it("parses and prints circuit addresses", () => {
    expect(parseContent("/circuits")).toEqual({ page: "circuits" });
    expect(parseContent("/circuits/spa/")).toEqual({ page: "circuits", id: "spa" });
    expect(parseContent("/circuits/kestrel")).toBeNull();
    expect(parseContent("/circuits/spielberg")).toEqual({ page: "circuits", id: "red-bull-ring" });
    expect(parseContent("/circuits/red-bull-ring")).toBeNull();
    expect(contentPath({ page: "circuits", id: "red-bull-ring" })).toBe("/circuits/spielberg");
    expect(contentPath({ page: "circuits", id: "monza" })).toBe("/circuits/monza");
    for (const c of CIRCUITS) expect(contentMeta({ page: "circuits", id: c.id }).description.length, c.id).toBeLessThanOrEqual(160);
  });
});
