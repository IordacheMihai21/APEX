import { beforeEach, describe, expect, it } from "vitest";
import POINTS from "../game/speedtrap.json";
import { ROUNDS, type TrapPoint, dailyTraps, recordRound, roundPoints, trapDone, trapGrade, trapRounds, trapScore, trapShare } from "./speedtrap";

const points = POINTS as TrapPoint[];
const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  } as Storage;
});

describe("speed trap", () => {
  it("has points of every kind on every circuit's data", () => {
    expect(new Set(points.map((p) => p.track)).size).toBe(12);
    for (const k of ["top", "apex", "fast"]) expect(points.filter((p) => p.kind === k).length).toBeGreaterThanOrEqual(12);
    for (const p of points) expect(p.kmh).toBeGreaterThan(20);
  });

  it("picks five spots a day on five circuits: one top, two corners, two fast corners", () => {
    for (const key of ["2026-10-06", "2026-10-07", "2026-12-25"]) {
      const day = dailyTraps(points, key).map((i) => points[i]);
      expect(day).toHaveLength(ROUNDS);
      expect(new Set(day.map((p) => p.track)).size).toBe(ROUNDS);
      expect(day.map((p) => p.kind).sort()).toEqual(["apex", "apex", "fast", "fast", "top"]);
      expect(dailyTraps(points, key)).toEqual(dailyTraps(points, key));
    }
  });

  it("scores closeness", () => {
    expect(roundPoints(150, 150)).toBe(100);
    expect(roundPoints(180, 150)).toBe(50);
    expect(roundPoints(250, 150)).toBe(0);
    expect(trapGrade(103, 100)).toBe("purple");
    expect(trapGrade(88, 100)).toBe("green");
    expect(trapGrade(125, 100)).toBe("yellow");
    expect(trapGrade(140, 100)).toBe("red");
  });

  it("records a day's five rounds once", () => {
    const key = "2026-10-06";
    for (let i = 0; i < ROUNDS + 2; i++) recordRound(100, 110, key);
    const r = trapRounds(key);
    expect(r).toHaveLength(ROUNDS);
    expect(trapDone(r)).toBe(true);
    expect(trapScore(r)).toBe(ROUNDS * 83);
    expect(trapShare(r, "x", key).split("\n")[1]).toBe("🟩🟩🟩🟩🟩");
  });
});
