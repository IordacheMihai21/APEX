import { describe, expect, it } from "vitest";
import { standingLine } from "./online";

const s = (players: number, faster: number) => ({ yourBestMs: 80000, players, faster, bestMs: 79000, medianMs: 81000 });

describe("standing line", () => {
  it("reads like a daily-game result", () => {
    expect(standingLine(s(1, 0))).toMatch(/First on today's board/);
    expect(standingLine(s(412, 0))).toBe("Fastest of today's 412 players.");
    expect(standingLine(s(101, 25))).toBe("Faster than 75% of today's 101 players.");
    expect(standingLine(s(2, 1))).toBe("Faster than 0% of today's 2 players.");
  });
});
