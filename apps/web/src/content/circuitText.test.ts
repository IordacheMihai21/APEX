import { describe, expect, it } from "vitest";
import { CIRCUITS } from "../modes/circuits";
import { CIRCUIT_TEXT } from "./circuitText";
import { contentMeta, contentPath, parseContent } from "./meta";

describe("circuit guides", () => {
  it("has written text for every circuit, and nothing else", () => {
    expect(Object.keys(CIRCUIT_TEXT).sort()).toEqual(CIRCUITS.map((c) => c.id).sort());
    for (const c of CIRCUITS) {
      expect(CIRCUIT_TEXT[c.id].character.length, c.id).toBeGreaterThan(100);
      expect(CIRCUIT_TEXT[c.id].drive.length, c.id).toBeGreaterThan(80);
    }
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
