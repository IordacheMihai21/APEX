import { beforeEach, describe, expect, it } from "vitest";
import { circuit, seeded } from "./circuits";
import {
  DAILY_CALLS,
  STATS,
  dailyCalls,
  dailyDoneDays,
  dailyRounds,
  dailyScore,
  dailyShare,
  firstRound,
  isRight,
  loadHigherLower,
  nextRound,
  recordDailyCall,
  recordRun,
  value,
} from "./higherLower";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
  } as Storage;
});

describe("higher or lower", () => {
  it("deals rounds with two different circuits and a decisive stat", () => {
    const rand = seeded(7);
    let r = firstRound(rand);
    for (let i = 0; i < 200; i++) {
      expect(r.right.id).not.toBe(r.left.id);
      const a = value(r.left, r.stat.key);
      const b = value(r.right, r.stat.key);
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(a).not.toBe(b);
      r = nextRound(r.right, rand, r.stat.key);
    }
  });

  it("judges the call", () => {
    const stat = STATS.find((s) => s.key === "lengthKm")!;
    const r = { stat, left: circuit("monaco"), right: circuit("spa") };
    expect(isRight(r, true)).toBe(true);
    expect(isRight(r, false)).toBe(false);
  });

  it("keeps the best run", () => {
    recordRun(4);
    recordRun(2);
    expect(loadHigherLower()).toEqual({ best: 4, runs: 2 });
  });
});

describe("higher or lower, daily edition", () => {
  const ids = (key: string) => dailyRounds(key).map((r) => `${r.left.id}>${r.right.id}:${r.stat.key}`);

  it("deals the same ten chained calls to everyone on a day, and new ones the next day", () => {
    const today = dailyRounds("2026-10-20");
    expect(today).toHaveLength(DAILY_CALLS);
    for (let i = 1; i < today.length; i++) expect(today[i].left.id).toBe(today[i - 1].right.id);
    for (const r of today) expect(value(r.right, r.stat.key)).not.toBe(value(r.left, r.stat.key));
    expect(ids("2026-10-20")).toEqual(ids("2026-10-20"));
    expect(ids("2026-10-21")).not.toEqual(ids("2026-10-20"));
  });

  it("records each call, stops at ten, and scores out of ten", () => {
    const key = "2026-10-20";
    expect(dailyCalls(key)).toEqual([]);
    for (let i = 0; i < 12; i++) recordDailyCall(i % 3 !== 0, key);
    const calls = dailyCalls(key);
    expect(calls).toHaveLength(DAILY_CALLS);
    expect(dailyScore(calls)).toBe(6);
    expect(dailyDoneDays()).toEqual([key]);
    expect(dailyShare(calls, "https://lapdle.com/higher-lower", key)).toMatch(/^Lapdle Higher or lower #\d+ 6\/10\n(🟩|🟥){10}\nhttps:/u);
  });
});
