import { beforeEach, describe, expect, it } from "vitest";
import { archiveDays, dailyCondition, dailyStats, dailyTrack, loadDaily, qualifyingDay, raceWeek, recordLap } from "./daily";
import { medalFor, medalTimes, realPole } from "./medals";

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
  } as Storage;
});

describe("race weekends", () => {
  it("move the Saturday daily to that circuit", () => {
    expect(dailyTrack("2026-10-24")).toBe("austin");
    expect(dailyTrack("2026-11-07")).toBe("interlagos");
    expect(qualifyingDay("2026-10-24")?.trackId).toBe("austin");
    expect(qualifyingDay("2026-10-23")).toBeNull();
  });

  it("announce themselves from the Monday of race week to the Sunday", () => {
    expect(raceWeek("2026-10-19")?.trackId).toBe("austin");
    expect(raceWeek("2026-10-25")?.trackId).toBe("austin");
    expect(raceWeek("2026-10-18")).toBeNull();
    expect(raceWeek("2026-10-26")).toBeNull();
  });

  it("leave other days on the rotation", () => {
    const days = Array.from({ length: 12 }, (_, i) => dailyTrack(`2026-10-${String(i + 1).padStart(2, "0")}`));
    expect(new Set(days).size).toBe(12);
  });
});

describe("archive", () => {
  it("lists every past day, newest first, never today", () => {
    const days = archiveDays("2026-10-04");
    expect(days.map((d) => d.number)).toEqual([3, 2, 1]);
    expect(days[0].key).toBe("2026-10-03");
    expect(days[0].trackId).toBe(dailyTrack("2026-10-03"));
    expect(archiveDays("2026-10-01")).toEqual([]);
  });

  it("keeps replays apart from the days played live", () => {
    const rec = loadDaily("2026-10-02", true);
    expect(rec.archive).toBe(true);
    recordLap(rec, { lapTimeMs: 90_000, grades: ["green"] }, [0]);
    expect(loadDaily("2026-10-02", true).laps).toHaveLength(1);
    expect(loadDaily("2026-10-02").laps).toHaveLength(0);
    expect(dailyStats().played).toBe(0);
    const [, day2] = archiveDays("2026-10-04");
    expect(day2.replay?.laps).toHaveLength(1);
    expect(day2.live).toBeNull();
  });
});

const dayAt = (n: number) => {
  const d = new Date("2026-10-01T12:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("conditions", () => {
  it("move each circuit to a new condition every cycle", () => {
    const seen = new Map<string, string[]>();
    for (let n = 0; n < 36; n++) {
      const key = dayAt(n);
      if (qualifyingDay(key)) continue;
      const list = seen.get(dailyTrack(key)) ?? [];
      list.push(dailyCondition(key));
      seen.set(dailyTrack(key), list);
    }
    for (const list of seen.values()) for (let i = 1; i < list.length; i++) expect(list[i]).not.toBe(list[i - 1]);
  });

  it("give each cycle a mix of all three", () => {
    const cycle = Array.from({ length: 12 }, (_, n) => dayAt(n)).filter((k) => !qualifyingDay(k)).map((k) => dailyCondition(k));
    for (const c of ["dry", "wet", "lowdf"]) expect(cycle.filter((x) => x === c).length).toBeGreaterThanOrEqual(3);
  });

  it("use that condition's medals, and no real pole outside the dry", () => {
    const dry = medalTimes("spa")!;
    const wet = medalTimes("spa", "wet")!;
    expect(wet.gold).toBeGreaterThan(dry.gold + 5000);
    expect(medalFor("spa", dry.gold, [], "wet")).toBe("gold");
    expect(medalFor("spa", wet.gold, [], "dry")).toBeNull();
    expect(realPole("spa", "wet")).toBeNull();
    expect(realPole("spa")).not.toBeNull();
  });

  it("store the day's condition on new records", () => {
    expect(loadDaily(dayAt(5)).condition).toBe(dailyCondition(dayAt(5)));
  });
});
