import { beforeEach, describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORIES_V2, GROUPS, GROUP_SIZE, LINEUP_SOURCE, LINEUP_V2, MISTAKES, dailyLineup, item, judge, lineupGuesses, lineupShare, lineupState, recordLineupGuess, unambiguous } from "./lineup";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  } as Storage;
});

const days = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 9, 6 + i)).toISOString().slice(0, 10));

describe("line-up", () => {
  it("has enough groups to draw from", () => {
    expect(CATEGORIES.filter((c) => c.kind === "corner").length).toBeGreaterThanOrEqual(3);
    expect(CATEGORIES.filter((c) => c.kind === "circuit").length).toBeGreaterThanOrEqual(6);
  });

  it("makes a single-answer puzzle every day for a year, the same for everyone", () => {
    const seen = new Set<string>();
    for (const key of days(366)) {
      const p = dailyLineup(key);
      expect(p.groups).toHaveLength(GROUPS);
      expect(new Set(p.board).size).toBe(GROUPS * GROUP_SIZE);
      expect(unambiguous(p.groups)).toBe(true);
      expect(p.groups.map((g) => g.category.level)).toEqual([...p.groups.map((g) => g.category.level)].sort((a, b) => a - b));
      expect(dailyLineup(key)).toEqual(p);
      seen.add(p.groups.map((g) => g.category.id).sort().join());
    }
    // plenty of different line-ups across the year
    expect(seen.size).toBeGreaterThan(40);
  });

  it("keeps the first edition for the days before the second", () => {
    for (const key of days(366).filter((k) => k < LINEUP_V2)) {
      const ids = dailyLineup(key).board;
      expect(ids.every((id) => id.startsWith("c:") || id.startsWith("k:")), key).toBe(true);
    }
  });

  it("second edition: one group of each colour, drivers, teams and cars among the tiles, no two tiles alike", () => {
    expect(LINEUP_SOURCE.license).toBe("CC BY 4.0");
    for (const level of [1, 2, 3, 4]) expect(new Set(CATEGORIES_V2.filter((c) => c.level === level).map((c) => c.family ?? c.id)).size, `level ${level}`).toBeGreaterThanOrEqual(4);
    const kinds = new Set<string>();
    for (const key of days(366).filter((k) => k >= LINEUP_V2)) {
      const p = dailyLineup(key);
      expect(p.groups.map((g) => g.category.level), key).toEqual([1, 2, 3, 4]);
      const labels = p.board.map((id) => item(id).label.toLowerCase());
      expect(new Set(labels).size, key).toBe(16);
      p.board.forEach((id) => kinds.add(id.slice(0, 2)));
    }
    for (const k of ["d:", "t:", "v:", "r:", "k:"]) expect(kinds.has(k), k).toBe(true);
  });

  it("judges guesses: a group, one away, or a miss", () => {
    const p = dailyLineup("2026-10-06");
    const [a, b] = p.groups;
    expect(judge(p, a.items).group).toBe(0);
    expect(judge(p, [...a.items.slice(0, 3), b.items[0]])).toEqual({ group: null, best: 3 });
  });

  it("ends on four groups or four mistakes, and shares by colour", () => {
    const key = "2026-10-06";
    const p = dailyLineup(key);
    const miss = [...p.groups[0].items.slice(0, 2), ...p.groups[1].items.slice(0, 2)];
    recordLineupGuess(p, miss, key);
    for (const g of p.groups) recordLineupGuess(p, g.items, key);
    const s = lineupState(p, lineupGuesses(key));
    expect(s).toMatchObject({ won: true, mistakes: 1, over: true });
    expect(lineupShare(p, lineupGuesses(key), "x", key).split("\n")).toHaveLength(2 + GROUPS + 1);

    const other = "2026-10-07";
    const q = dailyLineup(other);
    const bad = [...q.groups[0].items.slice(0, 2), ...q.groups[1].items.slice(0, 2)];
    for (let i = 0; i < MISTAKES + 2; i++) recordLineupGuess(q, bad, other);
    expect(lineupState(q, lineupGuesses(other))).toMatchObject({ won: false, mistakes: MISTAKES, over: true });
  });
});
