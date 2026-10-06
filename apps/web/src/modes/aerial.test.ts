import { beforeEach, describe, expect, it } from "vitest";
import { AERIAL_TRIES, aerialCircuit, aerialGuesses, aerialOver, aerialShare, aerialSolved, recordAerialGuess } from "./aerial";
import { CIRCUITS } from "./circuits";
import { dailyTrack } from "./daily";
import { mysteryAnswer } from "./mystery";
import { orderCircuit } from "./order";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  } as Storage;
});

describe("aerial view", () => {
  it("never shows the day's Quali, Mystery or Order circuit", () => {
    for (let d = 0; d < 60; d++) {
      const key = new Date(Date.UTC(2026, 9, 6 + d)).toISOString().slice(0, 10);
      const id = aerialCircuit(key);
      expect([dailyTrack(key), mysteryAnswer(key), orderCircuit(key)]).not.toContain(id);
      expect(aerialCircuit(key)).toBe(id);
    }
  });

  it("ends on the right circuit or six guesses, ignores repeats", () => {
    const key = "2026-10-06";
    const answer = aerialCircuit(key);
    const wrong = CIRCUITS.map((c) => c.id).filter((id) => id !== answer);
    recordAerialGuess(wrong[0], key);
    recordAerialGuess(wrong[0], key);
    expect(aerialGuesses(key)).toHaveLength(1);
    recordAerialGuess(answer, key);
    expect(aerialSolved(aerialGuesses(key), key)).toBe(true);
    expect(aerialShare(aerialGuesses(key), "x", key)).toContain("2/6");
    const other = "2026-10-07";
    const miss = CIRCUITS.map((c) => c.id).filter((id) => id !== aerialCircuit(other));
    for (const id of miss) recordAerialGuess(id, other);
    expect(aerialGuesses(other)).toHaveLength(AERIAL_TRIES);
    expect(aerialOver(aerialGuesses(other), other)).toBe(true);
  });
});
