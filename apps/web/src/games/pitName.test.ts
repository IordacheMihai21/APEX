import { describe, expect, it } from "vitest";
import { cleanNickname } from "./nickname";
import { suggestName } from "./pitName";

describe("pitlane names", () => {
  it("always suggests a valid nickname", () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 500; i++) {
      const n = suggestName(rand);
      expect(cleanNickname(n), n).toBe(n);
      expect(n.length).toBeLessThanOrEqual(16);
    }
  });
});
