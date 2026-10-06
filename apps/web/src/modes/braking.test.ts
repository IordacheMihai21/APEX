import { beforeEach, describe, expect, it } from "vitest";
import ZONES from "../game/braking.json";
import { STOPS_PER_DAY, type Zone, brakingDistance, brakingDone, brakingScore, cornerSpeed, dailyStops, dayStops, entrySpeed, grade, idealBrake, recordStop, scoreStop, speedAt, speedWithLeft } from "./braking";

const zones = ZONES as Zone[];
const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  } as Storage;
});

describe("braking point", () => {
  it("has real stops on every circuit", () => {
    expect(new Set(zones.map((z) => z.track)).size).toBe(12);
    for (const z of zones) {
      expect(entrySpeed(z) - cornerSpeed(z), `${z.track} ${z.group}`).toBeGreaterThan(22);
      expect(z.speeds.length).toBeGreaterThan(z.brakeIndex);
    }
  });

  it("the braking curve and its inverse agree", () => {
    for (const z of zones.slice(0, 10)) {
      for (const d of [5, 20, z.brakeM * 0.7, z.brakeM, z.brakeM + 15]) expect(brakingDistance(z, speedWithLeft(z, d))).toBeCloseTo(d, 0);
    }
  });

  it("braking on the perfect point is perfect; late is fast, early is slow", () => {
    for (const z of zones) {
      const perfect = scoreStop(z, idealBrake(z));
      expect(perfect.points).toBe(100);
      expect(perfect.cornerV).toBeCloseTo(cornerSpeed(z), 1);
      const late = scoreStop(z, idealBrake(z) + 8);
      expect(late.metres).toBeCloseTo(8, 1);
      expect(late.cornerV).toBeGreaterThan(cornerSpeed(z));
      expect(late.points).toBeLessThan(100);
      const early = scoreStop(z, idealBrake(z) - 15);
      expect(early.lost).toBeGreaterThan(0);
      expect(early.off).toBe(false);
      expect(speedAt(z, -1, idealBrake(z) - 15)).toBeCloseTo(cornerSpeed(z), 3);
      expect(scoreStop(z, idealBrake(z) + 40).off).toBe(true);
      expect(scoreStop(z, null)).toMatchObject({ off: true, points: 0, metres: null });
    }
  });

  it("grades stops by metres", () => {
    expect(grade({ metres: 1.5, off: false })).toBe("purple");
    expect(grade({ metres: -5, off: false })).toBe("green");
    expect(grade({ metres: 11, off: false })).toBe("yellow");
    expect(grade({ metres: 3, off: true })).toBe("red");
  });

  it("picks the same stops for everyone, from different circuits", () => {
    const a = dailyStops(zones, "2026-10-06");
    expect(a).toEqual(dailyStops(zones, "2026-10-06"));
    expect(a).toHaveLength(STOPS_PER_DAY);
    expect(new Set(a.map((i) => zones[i].track)).size).toBe(STOPS_PER_DAY);
    expect(a).not.toEqual(dailyStops(zones, "2026-10-07"));
  });

  it("records a day's stops once", () => {
    const z = zones[0];
    for (let i = 0; i < STOPS_PER_DAY + 2; i++) recordStop(scoreStop(z, idealBrake(z)), "2026-10-06");
    const stops = dayStops("2026-10-06");
    expect(brakingDone(stops)).toBe(true);
    expect(stops).toHaveLength(STOPS_PER_DAY);
    expect(brakingScore(stops)).toBe(500);
  });
});
