import { beforeEach, describe, expect, it } from "vitest";
import { average, loadReaction, randomHold, recordJump, recordReaction, verdict } from "./reaction";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
  } as Storage;
});

describe("reaction test", () => {
  it("keeps the best and the last five", () => {
    let r = loadReaction();
    for (const ms of [300, 250, 280, 210, 260, 240]) r = recordReaction(r, ms);
    expect(r.best).toBe(210);
    expect(r.recent).toEqual([240, 260, 210, 280, 250]);
    expect(average(r)).toBe(248);
    expect(loadReaction().attempts).toBe(6);
  });

  it("counts jump starts without touching times", () => {
    const r = recordJump(recordReaction(loadReaction(), 230));
    expect(r.jumps).toBe(1);
    expect(r.best).toBe(230);
  });

  it("holds between 0.2 and 3 s", () => {
    expect(randomHold(() => 0)).toBe(200);
    expect(randomHold(() => 1)).toBe(3000);
  });

  it("calls out anticipation and F1 pace", () => {
    expect(verdict(90)).toMatch(/anticipation/);
    expect(verdict(200)).toMatch(/F1/);
  });
});
