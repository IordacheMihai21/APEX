import { beforeEach, describe, expect, it } from "vitest";
import { CIRCUITS } from "./circuits";
import { dailyTrack } from "./daily";
import { MYSTERY_TRIES, isOver, isSolved, judge, loadMystery, mysteryAnswer, mysteryShare, mysteryStats, recordGuess } from "./mystery";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
  } as Storage;
});

const day = (i: number) => {
  const d = new Date("2026-10-01T12:00:00");
  d.setDate(d.getDate() + i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("mystery circuit", () => {
  it("has twelve circuits with facts", () => {
    expect(CIRCUITS).toHaveLength(12);
    expect(CIRCUITS.every((c) => c.lengthKm > 3 && c.turns >= 10 && c.firstGp >= 1950)).toBe(true);
  });

  it("never picks the Daily Quali circuit and covers the field", () => {
    const answers = Array.from({ length: 60 }, (_, i) => day(i));
    for (const k of answers) expect(mysteryAnswer(k)).not.toBe(dailyTrack(k));
    expect(new Set(answers.map((k) => mysteryAnswer(k))).size).toBeGreaterThanOrEqual(11);
  });

  it("marks guesses against the answer", () => {
    const f = judge("imola", "monza");
    expect(f.country).toBe("hit");
    expect(f.length).toEqual({ mark: "miss", dir: "up" });
    expect(f.turns).toEqual({ mark: "miss", dir: "down" });
    expect(judge("spa", "zandvoort").country).toBe("near");
    expect(judge("austin", "suzuka").country).toBe("miss");
    expect(judge("suzuka", "suzuka").firstGp).toEqual({ mark: "hit", dir: null });
  });

  it("records a solved day and its stats", () => {
    const k = day(0);
    const answer = mysteryAnswer(k);
    const wrong = CIRCUITS.find((c) => c.id !== answer)!.id;
    let d = recordGuess(loadMystery(k), wrong);
    d = recordGuess(d, wrong); // a repeat doesn't count
    d = recordGuess(d, answer);
    expect(d.guesses).toHaveLength(2);
    expect(isSolved(d) && isOver(d)).toBe(true);
    expect(loadMystery(k).guesses).toEqual([wrong, answer]);
    const s = mysteryStats(k);
    expect(s).toMatchObject({ played: 1, solved: 1, streak: 1 });
    expect(s.dist[1]).toBe(1);
    expect(mysteryShare(d, "x").split("\n")[0]).toMatch(/2\/6$/);
  });

  it("ends after six misses", () => {
    const k = day(1);
    const answer = mysteryAnswer(k);
    let d = loadMystery(k);
    for (const c of CIRCUITS.filter((c) => c.id !== answer).slice(0, MYSTERY_TRIES)) d = recordGuess(d, c.id);
    expect(isOver(d) && !isSolved(d)).toBe(true);
    expect(recordGuess(d, answer).guesses).toHaveLength(MYSTERY_TRIES);
  });
});
