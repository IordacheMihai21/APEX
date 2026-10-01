import { beforeEach, describe, expect, it } from "vitest";
import { circuit, seeded } from "./circuits";
import { STATS, firstRound, isRight, loadHigherLower, nextRound, recordRun, value } from "./higherLower";

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
