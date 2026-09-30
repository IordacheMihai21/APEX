import type { Grade } from "./grading";

/** Daily Quali: one circuit per day for everyone, 6 laps, all-purple lap wins. */
export const DAILY_LAPS = 6;
const LAUNCH = "2026-10-01";
const POOL = ["monza", "spa", "silverstone", "suzuka", "monaco", "interlagos", "hungaroring", "red-bull-ring", "zandvoort", "austin", "barcelona", "imola"];
const KEY = "apex.daily.v1";

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

/** Every circuit once per 12-day cycle, in a shuffled order that changes each cycle. */
export function dailyTrack(key = dateKey()): string {
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

function loadAll(): Record<string, DailyRecord> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function loadDaily(key = dateKey()): DailyRecord {
  return loadAll()[key] ?? { key, trackId: dailyTrack(key), laps: [], status: "playing" };
}

export function saveDaily(rec: DailyRecord) {
  try {
    const all = loadAll();
    all[rec.key] = rec;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode: today's progress just won't persist */
  }
}

export function recordLap(rec: DailyRecord, lap: DailyLap, knots: number[]): DailyRecord {
  if (rec.status !== "playing") return rec;
  const laps = [...rec.laps, lap];
  const won = lap.grades.every((g) => g === "purple");
  const status = won ? "won" : laps.length >= DAILY_LAPS ? "lost" : "playing";
  const next = { ...rec, laps, status, knots } as DailyRecord;
  saveDaily(next);
  return next;
}

export interface DailyStats {
  played: number;
  wins: number;
  streak: number;
  bestStreak: number;
  /** wins by number of laps used, index 0 = won on lap 1 */
  distribution: number[];
}

export function dailyStats(): DailyStats {
  const all = Object.values(loadAll()).filter((r) => r.status !== "playing").sort((a, b) => a.key.localeCompare(b.key));
  const distribution = new Array(DAILY_LAPS).fill(0);
  let streak = 0;
  let best = 0;
  let prev: number | null = null;
  for (const r of all) {
    const d = dayIndex(r.key);
    if (r.status === "won") {
      distribution[r.laps.length - 1]++;
      streak = prev !== null && d === prev + 1 ? streak + 1 : 1;
    } else streak = 0;
    best = Math.max(best, streak);
    prev = d;
  }
  // a streak only counts if it reaches yesterday or today
  const today = dayIndex(dateKey());
  if (prev === null || prev < today - 1) streak = 0;
  return { played: all.length, wins: distribution.reduce((a, b) => a + b, 0), streak, bestStreak: best, distribution };
}

export function msToNextDay(now = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function shareText(rec: DailyRecord, trackName: string, flag: string, emoji: Record<Grade, string>): string {
  const n = dailyNumber(rec.key);
  const score = rec.status === "won" ? `${rec.laps.length}/${DAILY_LAPS}` : `X/${DAILY_LAPS}`;
  const rows = rec.laps.map((l) => l.grades.map((g) => emoji[g]).join("")).join("\n");
  const best = Math.min(...rec.laps.map((l) => l.lapTimeMs));
  const m = Math.floor(best / 60000);
  const s = ((best - m * 60000) / 1000).toFixed(3).padStart(6, "0");
  return `APEX Quali #${n} ${flag} ${trackName} ${score}\n${rows}\nBest ${m}:${s}`;
}
