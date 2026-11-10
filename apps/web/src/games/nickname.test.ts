import { describe, expect, it } from "vitest";
import { cleanNickname } from "./nickname";

describe("board nicknames", () => {
  it("tidies and keeps ordinary names", () => {
    expect(cleanNickname("  Max  Verst ")).toBe("Max Verst");
    expect(cleanNickname("apex_hunter.44")).toBe("apex_hunter.44");
  });
  it("refuses wrong shapes and names posing as the site or abuse", () => {
    expect(cleanNickname("ab")).toBeNull();
    expect(cleanNickname("a".repeat(17))).toBeNull();
    expect(cleanNickname("<b>hi</b>")).toBeNull();
    expect(cleanNickname("Lapdle Team")).toBeNull();
    expect(cleanNickname("sh1t driver")).toBeNull();
  });
});
