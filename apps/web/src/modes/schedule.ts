import type { Condition } from "@apex/engine";

/**
 * The Daily Quali schedule: launch day, puzzle numbers, which circuit and
 * which conditions each day brings. Pure and dependency-free, so the
 * leaderboard's server function (supabase/functions/submit-lap) imports the
 * very same code and only takes laps for the day's real daily.
 */
/**
 * Day No. 1: lapdle.com launched on 6 October 2026. Numbering, the circuit
 * rotation, the conditions and the archive all count from it, so it never
 * changes again. VITE_LAUNCH_DATE can override it for a test build.
 */
const LAUNCH_ENV = (import.meta.env?.VITE_LAUNCH_DATE as string | undefined) ?? "";
export const LAUNCH = /^\d{4}-\d{2}-\d{2}$/.test(LAUNCH_ENV) ? LAUNCH_ENV : "2026-10-06";
const POOL = ["monza", "spa", "silverstone", "suzuka", "monaco", "interlagos", "hungaroring", "red-bull-ring", "zandvoort", "austin", "barcelona", "imola"];

export function dateKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export const dayIndex = (key: string) => Math.round((Date.parse(`${key}T12:00:00Z`) - Date.parse(`${LAUNCH}T12:00:00Z`)) / 86_400_000);

/** Puzzle number: #1 on launch day. */
export function dailyNumber(key = dateKey()): number {
  return dayIndex(key) + 1;
}

/**
 * Real Grand Prix weekends at our circuits (2026 calendar; add each new season).
 * On the Saturday (qualifying day) the daily moves to that circuit, and the hub
 * says so through race week. Dates are the Friday-to-Sunday weekend.
 */
export const RACE_WEEKENDS: { trackId: string; from: string; to: string }[] = [
  { trackId: "suzuka", from: "2026-03-27", to: "2026-03-29" },
  { trackId: "monaco", from: "2026-06-05", to: "2026-06-07" },
  { trackId: "barcelona", from: "2026-06-12", to: "2026-06-14" },
  { trackId: "red-bull-ring", from: "2026-06-26", to: "2026-06-28" },
  { trackId: "silverstone", from: "2026-07-03", to: "2026-07-05" },
  { trackId: "spa", from: "2026-07-17", to: "2026-07-19" },
  { trackId: "hungaroring", from: "2026-07-24", to: "2026-07-26" },
  { trackId: "zandvoort", from: "2026-08-21", to: "2026-08-23" },
  { trackId: "monza", from: "2026-09-04", to: "2026-09-06" },
  { trackId: "austin", from: "2026-10-23", to: "2026-10-25" },
  { trackId: "interlagos", from: "2026-11-06", to: "2026-11-08" },
];

const addDays = (key: string, n: number) => dateKey(new Date(Date.parse(`${key}T12:00:00`) + n * 86_400_000));

/** The race weekend whose Saturday is `key`, if any. */
export function qualifyingDay(key = dateKey()) {
  return RACE_WEEKENDS.find((w) => addDays(w.from, 1) === key) ?? null;
}

/** A race weekend in the coming week (Monday before through Sunday), for the hub banner. */
export function raceWeek(key = dateKey()) {
  return RACE_WEEKENDS.find((w) => key >= addDays(w.from, -4) && key <= w.to) ?? null;
}

/** Every circuit once per 12-day cycle, in a shuffled order that changes each cycle; race-weekend Saturdays go to that circuit. */
export function dailyTrack(key = dateKey()): string {
  const special = qualifyingDay(key);
  if (special) return special.trackId;
  const n = Math.max(0, dayIndex(key));
  const cycle = Math.floor(n / POOL.length);
  let seed = 0x9e3779b9 ^ (cycle * 2654435761);
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = POOL.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order[n % POOL.length];
}

/**
 * The day's conditions. Each circuit moves to the next condition every 12-day
 * cycle (dry, then wet, then low downforce), so a line remembered from its last
 * visit no longer holds; each cycle has four days of each. Race-weekend
 * Saturdays stay dry, like the qualifying they stand in for.
 */
export function dailyCondition(key = dateKey()): Condition {
  if (qualifyingDay(key)) return "dry";
  const n = Math.max(0, dayIndex(key));
  const cycle = Math.floor(n / POOL.length);
  const order: Condition[] = ["dry", "wet", "lowdf"];
  return order[(cycle + POOL.indexOf(dailyTrack(key))) % order.length];
}
