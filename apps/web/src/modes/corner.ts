import { load, save } from "./circuits";
import { LAUNCH, dateKey } from "./daily";
import type { Medal } from "./medals";

/**
 * Corner of the week: one famous corner, unlimited tries, a medal for the
 * week. The rest of the lap runs on the perfect line, so the run-in is the
 * same for everyone and the score is the time lost to the perfect line in
 * that corner alone. Weeks run Monday to Sunday.
 *
 * Only corners whose place in the lap is certain are used (the first corner
 * after the start, or the last before the line), named the way fans know
 * them, never after drivers or sponsors.
 */
import { type WeeklyCorner, WEEKLY_CORNERS } from "./cornerList";
export { type WeeklyCorner, WEEKLY_CORNERS };

const DAY_MS = 86_400_000;
const noon = (key: string) => Date.parse(`${key}T12:00:00Z`);

/** The Monday a week starts on, as YYYY-MM-DD. */
export function weekStart(key = dateKey()): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateKey(d);
}

/** Week No. 1 is the week of launch. */
export function weekNumber(key = dateKey()): number {
  return Math.max(1, Math.round((noon(weekStart(key)) - noon(weekStart(LAUNCH))) / (7 * DAY_MS)) + 1);
}

export function weeklyCorner(key = dateKey()): WeeklyCorner {
  return WEEKLY_CORNERS[(weekNumber(key) - 1) % WEEKLY_CORNERS.length];
}

/** Whole days left in this week, today included (7 on Monday, 1 on Sunday). */
export function daysLeft(key = dateKey()): number {
  return 7 - Math.round((noon(key) - noon(weekStart(key))) / DAY_MS);
}

/** Medals by time lost to the perfect line in the corner. Pole is the purple bar. */
export const CORNER_MEDAL_MS: Record<Medal, number> = { pole: 50, gold: 90, silver: 160, bronze: 400 };

export function cornerMedal(deltaMs: number): Medal | null {
  if (deltaMs <= CORNER_MEDAL_MS.pole) return "pole";
  if (deltaMs <= CORNER_MEDAL_MS.gold) return "gold";
  if (deltaMs <= CORNER_MEDAL_MS.silver) return "silver";
  if (deltaMs <= CORNER_MEDAL_MS.bronze) return "bronze";
  return null;
}

const KEY = "apex.corner.v1";

export interface CornerWeek {
  /** best (least) time lost to the perfect line, ms */
  bestDeltaMs: number;
  /** time through the corner on that run, ms */
  bestTimeMs: number;
  tries: number;
  /** the line of the best run, to pick up where you left off */
  knots: number[];
}

interface CornerRecord {
  weeks: Record<string, CornerWeek>;
}

export function loadCornerWeek(key = dateKey()): CornerWeek | null {
  return load<CornerRecord>(KEY, { weeks: {} }).weeks[weekStart(key)] ?? null;
}

export function recordCornerRun(run: { deltaMs: number; timeMs: number; knots: number[] }, key = dateKey()): CornerWeek {
  const rec = load<CornerRecord>(KEY, { weeks: {} });
  const wk = weekStart(key);
  const prev = rec.weeks[wk];
  const better = !prev || run.deltaMs < prev.bestDeltaMs;
  const next: CornerWeek = better
    ? { bestDeltaMs: run.deltaMs, bestTimeMs: run.timeMs, tries: (prev?.tries ?? 0) + 1, knots: run.knots }
    : { ...prev, tries: prev.tries + 1 };
  save(KEY, { weeks: { ...rec.weeks, [wk]: next } });
  return next;
}

/** Weeks with a medal, for the record. */
export function cornerMedals(): { weeks: number; medals: number; poles: number } {
  const weeks = Object.values(load<CornerRecord>(KEY, { weeks: {} }).weeks);
  const medals = weeks.map((w) => cornerMedal(w.bestDeltaMs));
  return { weeks: weeks.length, medals: medals.filter(Boolean).length, poles: medals.filter((m) => m === "pole").length };
}

export function cornerShare(week: CornerWeek, corner: WeeklyCorner, key = dateKey()): string {
  const medal = cornerMedal(week.bestDeltaMs);
  const tag = medal ? { pole: "🟪 Pole", gold: "🥇 Gold", silver: "🥈 Silver", bronze: "🥉 Bronze" }[medal] : "No medal";
  const delta = week.bestDeltaMs <= 0 ? "on the perfect line" : `+${(week.bestDeltaMs / 1000).toFixed(3)} s to perfect`;
  return `Lapdle Corner of the week #${weekNumber(key)}: ${corner.name}\n${tag}, ${delta} (${week.tries} ${week.tries === 1 ? "try" : "tries"})`;
}
