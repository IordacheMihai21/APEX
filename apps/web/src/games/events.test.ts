import { describe, expect, it } from "vitest";
import { lastPlayedBucket, playerBucket } from "./events";

describe("analytics buckets", () => {
  it("buckets how long a device has played", () => {
    expect(playerBucket(0)).toBe("new");
    expect(playerBucket(1)).toBe("new");
    expect(playerBucket(3)).toBe("2-3 days");
    expect(playerBucket(7)).toBe("4-7 days");
    expect(playerBucket(30)).toBe("8-30 days");
    expect(playerBucket(31)).toBe("31+ days");
  });

  it("says when it last played, ignoring today", () => {
    const today = "2026-10-10";
    expect(lastPlayedBucket([], today)).toBe("never");
    expect(lastPlayedBucket(["2026-10-10"], today)).toBe("never");
    expect(lastPlayedBucket(["2026-10-01", "2026-10-09", "2026-10-10"], today)).toBe("yesterday");
    expect(lastPlayedBucket(["2026-10-04"], today)).toBe("2-7 days ago");
    expect(lastPlayedBucket(["2026-09-20"], today)).toBe("8+ days ago");
    expect(lastPlayedBucket(["2026-10-31"], "2026-11-01")).toBe("yesterday");
  });
});
