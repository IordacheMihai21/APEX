import { beforeEach, describe, expect, it } from "vitest";
import { CIRCUITS } from "./circuits";
import { dailyTrack } from "./daily";
import { mysteryAnswer } from "./mystery";
import { CORNERS_PER_DAY, ORDER_TRIES, orderCircuit, orderOver, orderSolved, orderTries, pickCorners, recordTry, trayOrder } from "./order";

const details = import.meta.glob<{ corners: string[] }>("../game/outline-detail/*.json", { import: "default", eager: true });
const cornersOf = (id: string) => details[`../game/outline-detail/${id}.json`].corners;

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  } as Storage;
});

describe("order the corners", () => {
  it("picks six real turns on every circuit, in lap order, each a short piece of track", () => {
    for (const c of CIRCUITS) {
      const cs = pickCorners(cornersOf(c.id));
      expect(cs.length, c.id).toBe(CORNERS_PER_DAY);
      expect(cs.map((x) => x.group)).toEqual([...cs.map((x) => x.group)].sort((a, b) => a - b));
      for (const x of cs) {
        const xs = x.path.map((p) => p[0]);
        const ys = x.path.map((p) => p[1]);
        expect(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)), `${c.id} ${x.group}`).toBeLessThanOrEqual(240);
      }
    }
  });

  it("never asks the day's Quali or Mystery circuit, and shuffles the same for everyone", () => {
    for (let d = 1; d <= 40; d++) {
      const key = `2026-11-${String((d % 28) + 1).padStart(2, "0")}`;
      const id = orderCircuit(key);
      expect(id).not.toBe(dailyTrack(key));
      expect(id).not.toBe(mysteryAnswer(key));
      expect(trayOrder(6, key)).toEqual(trayOrder(6, key));
      expect(trayOrder(6, key).some((v, i) => v !== i)).toBe(true);
    }
  });

  it("keeps a day's checks, and ends on the right order or after four", () => {
    const key = "2026-10-08";
    recordTry([1, 0, 2, 3, 4, 5], key);
    expect(orderOver(orderTries(key))).toBe(false);
    recordTry([0, 1, 2, 3, 4, 5], key);
    expect(orderSolved(orderTries(key))).toBe(true);
    recordTry([5, 4, 3, 2, 1, 0], key);
    expect(orderTries(key)).toHaveLength(2);
    const other = "2026-10-09";
    for (let i = 0; i < ORDER_TRIES + 1; i++) recordTry([1, 0, 2, 3, 4, 5], other);
    expect(orderTries(other)).toHaveLength(ORDER_TRIES);
    expect(orderOver(orderTries(other))).toBe(true);
  });
});
