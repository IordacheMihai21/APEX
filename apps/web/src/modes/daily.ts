import type { Condition } from "@apex/engine";
import type { Grade } from "./grading";
import { MEDAL_EMOJI, MEDAL_NAME, type Medal, better, medalFor, realPole } from "./medals";
import { LAUNCH, dailyCondition, dailyNumber, dailyTrack, dateKey, dayIndex } from "./schedule";

export { LAUNCH, RACE_WEEKENDS, dailyCondition, dailyNumber, dailyTrack, dateKey, qualifyingDay, raceWeek } from "./schedule";

/**
 * Daily Quali: one circuit per day for everyone, 6 laps. Each lap earns a medal
 * by lap time (Bronze, Silver, Gold); an all-purple lap is Pole and ends the
 * day. The streak counts days with at least Bronze.
 */
export const DAILY_LAPS = 6;
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
