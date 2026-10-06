import type { Condition } from "@apex/engine";
import type { Grade } from "./grading";
import { MEDAL_EMOJI, MEDAL_NAME, type Medal, better, medalFor, realPole } from "./medals";

/**
 * Daily Quali: one circuit per day for everyone, 6 laps. Each lap earns a medal
 * by lap time (Bronze, Silver, Gold); an all-purple lap is Pole and ends the
 * day. The streak counts days with at least Bronze.
 */
export const DAILY_LAPS = 6;
/**
 * Day No. 1. Set VITE_LAUNCH_DATE to the real launch day for the live build:
 * numbering, the circuit rotation, the conditions and the archive all count
 * from it. A missing or malformed value falls back to the development date.
 */
const LAUNCH_ENV = (import.meta.env?.VITE_LAUNCH_DATE as string | undefined) ?? "";
export const LAUNCH = /^\d{4}-\d{2}-\d{2}$/.test(LAUNCH_ENV) ? LAUNCH_ENV : "2026-10-01";
const POOL = ["monza", "spa", "silverstone", "suzuka", "monaco", "interlagos", "hungaroring", "red-bull-ring", "zandvoort", "austin", "barcelona", "imola"];
const KEY = "apex.daily.v1";
const ARCHIVE_KEY = "apex.archive.v1";

export interface DailyLap {
  lapTimeMs: number;
  grades: Grade[];
}

export interface DailyRecord {
  key: string; // YYYY-MM-DD local
  trackId: string;
  laps: DailyLap[];
  status: "playing" | "won" | "lost";
  /** Last line raced, so a returning player continues where they left off. */
  knots?: number[];
  /** Coach hints opened today; shown on the share text. */
  hints?: number;
  /** Line of the fastest lap today, for the "race my best lap" link. */
  bestKnots?: number[];
  /** A past day replayed from the archive: kept apart, so it never counts for the streak or stats. */
  archive?: boolean;
  /** Track conditions for the day (records from before conditions existed are dry). */
  condition?: Condition;
}

/** Laps that must be driven before the coach's hints open in the daily. */
export const DAILY_HINT_AFTER_LAPS = 2;

export function recordHint(rec: DailyRecord): DailyRecord {
  const next = { ...rec, hints: (rec.hints ?? 0) + 1 };
  saveDaily(next);
  return next;
}

export function dateKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

const dayIndex = (key: string) => Math.round((Date.parse(`${key}T12:00:00Z`) - Date.parse(`${LAUNCH}T12:00:00Z`)) / 86_400_000);

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

function loadAll(store = KEY): Record<string, DailyRecord> {
  try {
    return JSON.parse(localStorage.getItem(store) ?? "{}");
  } catch {
    return {};
  }
}

/** Every daily played on this device, oldest first. */
export function allDailies(): DailyRecord[] {
  return Object.values(loadAll())
    .filter((r) => r.laps.length > 0)
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** How many days ended on each best medal (null = no medal). */
export function medalDistribution(): { medal: Medal | null; days: number }[] {
  const order: (Medal | null)[] = ["pole", "gold", "silver", "bronze", null];
  const days = allDailies().map(bestMedal);
  return order.map((medal) => ({ medal, days: days.filter((m) => m === medal).length }));
}

export function loadDaily(key = dateKey(), archive = false): DailyRecord {
  return loadAll(archive ? ARCHIVE_KEY : KEY)[key] ?? { key, trackId: dailyTrack(key), condition: dailyCondition(key), laps: [], status: "playing", ...(archive ? { archive } : {}) };
}

export const conditionOf = (rec: DailyRecord): Condition => rec.condition ?? "dry";

export const CONDITION_NAME: Record<Condition, string> = { dry: "Dry", wet: "Wet", lowdf: "Low downforce" };

/** One line on what the conditions change, for the hub. */
export const CONDITION_NOTE: Record<Condition, string> = {
  dry: "",
  wet: "Much less grip everywhere: brake earlier, carry less speed. The perfect line and the medal times change.",
  lowdf: "The low-drag trim: faster on the straights, less grip in quick corners. The perfect line and the medal times change.",
};

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

export function saveDaily(rec: DailyRecord) {
  const store = rec.archive ? ARCHIVE_KEY : KEY;
  try {
    const all = loadAll(store);
    all[rec.key] = rec;
    localStorage.setItem(store, JSON.stringify(all));
  } catch {
    /* private mode: today's progress just won't persist */
  }
}

export function recordLap(rec: DailyRecord, lap: DailyLap, knots: number[]): DailyRecord {
  if (rec.status !== "playing") return rec;
  const laps = [...rec.laps, lap];
  const won = lap.grades.every((g) => g === "purple");
  const status = won ? "won" : laps.length >= DAILY_LAPS ? "lost" : "playing";
  const fastest = rec.laps.every((l) => lap.lapTimeMs < l.lapTimeMs);
  const next = { ...rec, laps, status, knots, bestKnots: fastest ? knots : rec.bestKnots } as DailyRecord;
  saveDaily(next);
  return next;
}

/** The best medal of the day so far (null until a lap reaches Bronze). */
export function bestMedal(rec: DailyRecord): Medal | null {
  return rec.laps.reduce<Medal | null>((m, l) => better(m, medalFor(rec.trackId, l.lapTimeMs, l.grades, conditionOf(rec))), null);
}

export interface DailyStats {
  /** days with at least one lap */
  played: number;
  /** days that ended with at least Bronze */
  medalDays: number;
  poles: number;
  /** consecutive days with at least Bronze, reaching yesterday or today */
  streak: number;
  bestStreak: number;
}

export function dailyStats(): DailyStats {
  const all = Object.values(loadAll())
    .filter((r) => r.laps.length > 0)
    .sort((a, b) => a.key.localeCompare(b.key));
  const today = dayIndex(dateKey());
  let streak = 0;
  let best = 0;
  let medalDays = 0;
  let poles = 0;
  let prev: number | null = null;
  for (const r of all) {
    const d = dayIndex(r.key);
    const m = bestMedal(r);
    if (m) {
      medalDays++;
      if (m === "pole") poles++;
      streak = prev !== null && d === prev + 1 ? streak + 1 : 1;
      prev = d;
    } else if (d !== today) {
      // today without a medal yet doesn't break the streak; a finished day does
      streak = 0;
      prev = d;
    }
    best = Math.max(best, streak);
  }
  if (prev === null || prev < today - 1) streak = 0;
  return { played: all.length, medalDays, poles, streak, bestStreak: best };
}

export interface ArchiveDay {
  key: string;
  number: number;
  trackId: string;
  condition: Condition;
  /** the day as played on the day, if it was */
  live: DailyRecord | null;
  /** a later replay from the archive, if any */
  replay: DailyRecord | null;
}

/** Every past daily, newest first: each can be replayed (unranked). */
export function archiveDays(today = dateKey()): ArchiveDay[] {
  const live = loadAll(KEY);
  const replays = loadAll(ARCHIVE_KEY);
  const days: ArchiveDay[] = [];
  for (let i = dayIndex(today) - 1; i >= 0; i--) {
    const d = new Date(`${LAUNCH}T12:00:00`);
    d.setDate(d.getDate() + i);
    const key = dateKey(d);
    const l = live[key];
    days.push({ key, number: i + 1, trackId: dailyTrack(key), condition: dailyCondition(key), live: l?.laps.length ? l : null, replay: replays[key] ?? null });
  }
  return days;
}

export function msToNextDay(now = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function shareText(rec: DailyRecord, trackName: string, flag: string, emoji: Record<Grade, string>, link?: string): string {
  const n = dailyNumber(rec.key);
  const medal = bestMedal(rec);
  const rows = rec.laps.map((l) => l.grades.map((g) => emoji[g]).join("")).join("\n");
  const best = Math.min(...rec.laps.map((l) => l.lapTimeMs));
  const m = Math.floor(best / 60000);
  const s = ((best - m * 60000) / 1000).toFixed(3).padStart(6, "0");
  const head = medal ? `${MEDAL_EMOJI[medal]} ${MEDAL_NAME[medal]}` : "No medal";
  const hints = rec.hints ? `, ${rec.hints} ${rec.hints === 1 ? "hint" : "hints"} used` : "";
  const race = link ? `\nRace my best lap: ${link}` : "";
  const pole = realPole(rec.trackId, conditionOf(rec));
  const fasterThanPole = pole && best < pole.ms ? `\nFaster than the real 2025 pole by ${((pole.ms - best) / 1000).toFixed(3)}s` : "";
  const cond = conditionOf(rec);
  return `Lapdle Quali #${n}${rec.archive ? " (archive)" : ""} ${flag} ${trackName}${cond === "dry" ? "" : `, ${CONDITION_NAME[cond].toLowerCase()}`}\n${head} ${m}:${s} in ${rec.laps.length}/${DAILY_LAPS} laps${hints}${fasterThanPole}\n${rows}${race}`;
}
