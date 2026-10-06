import { beforeEach, describe, expect, it } from "vitest";
import { recordDailyCall } from "../modes/higherLower";
import { loadMystery, mysteryAnswer, recordGuess } from "../modes/mystery";
import { playStreak } from "./profile";
import { todayProgress } from "./registry";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  } as Storage;
});

const TODAY = "2026-10-20";
const day = (n: number) => {
  const d = new Date(`${TODAY}T12:00:00`);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// finish one game on a given day, the way each game stores it
const solveMystery = (key: string) => recordGuess(loadMystery(key), mysteryAnswer(key));
const pitStop = (key: string) => {
  const rec = JSON.parse(store["apex.pitstop.v1"] ?? '{"best":null,"recent":[],"stops":0,"days":{}}');
  rec.days[key] = { totalMs: 2400, splits: [], wrongKeys: 0, earlyRelease: false };
  store["apex.pitstop.v1"] = JSON.stringify(rec);
};
const quali = (key: string) => {
  const rec = JSON.parse(store["apex.daily.v1"] ?? "{}");
  rec[key] = { key, trackId: "monza", laps: [{ lapTimeMs: 80_000, grades: ["green"] }], status: "lost" };
  store["apex.daily.v1"] = JSON.stringify(rec);
};

describe("play streak", () => {
  it("starts at nothing", () => {
    expect(playStreak(TODAY)).toEqual({ current: 0, best: 0, playedToday: false, daysPlayed: 0, perfectDays: 0 });
  });

  it("counts any daily game, and stays alive until today is over", () => {
    solveMystery(day(2));
    pitStop(day(1));
    expect(playStreak(TODAY)).toMatchObject({ current: 2, playedToday: false });
    quali(TODAY);
    expect(playStreak(TODAY)).toMatchObject({ current: 3, best: 3, playedToday: true, daysPlayed: 3 });
  });

  it("breaks on a missed day but keeps the best run", () => {
    for (const n of [6, 5, 4]) pitStop(day(n));
    solveMystery(day(1));
    expect(playStreak(TODAY)).toMatchObject({ current: 1, best: 3 });
  });

  it("counts a perfect day when the whole daily set is done", () => {
    quali(TODAY);
    solveMystery(TODAY);
    expect(todayProgress(TODAY).done).toBe(2);
    expect(playStreak(TODAY).perfectDays).toBe(0);
    pitStop(TODAY);
    expect(todayProgress(TODAY).done).toBe(3);
    expect(playStreak(TODAY).perfectDays).toBe(0);
    for (let i = 0; i < 10; i++) recordDailyCall(true, TODAY);
    expect(todayProgress(TODAY)).toMatchObject({ done: 4, total: 4 });
    expect(playStreak(TODAY).perfectDays).toBe(1);
  });
});
