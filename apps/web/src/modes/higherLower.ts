import { CIRCUITS, type CircuitFacts, load, save, seeded } from "./circuits";
import { dailyNumber, dateKey } from "./daily";

/**
 * Higher or lower: one circuit's fact is shown, guess whether the next
 * circuit's is higher or lower. Right answers chain on; one wrong ends the run.
 */
export type StatKey = "lengthKm" | "turns" | "firstGp" | "laps" | "poleMs";

export interface Stat {
  key: StatKey;
  label: string;
  /** the words on the two buttons */
  up: string;
  down: string;
  format: (v: number) => string;
  /** the question, asked of the hidden circuit `b` against the shown one `a` */
  ask: (a: string, b: string) => string;
}

const poleTime = (ms: number) => {
  const m = Math.floor(ms / 60000);
  return `${m}:${((ms - m * 60000) / 1000).toFixed(3).padStart(6, "0")}`;
};

export const STATS: Stat[] = [
  { key: "lengthKm", label: "Lap length", up: "Longer", down: "Shorter", format: (v) => `${v.toFixed(3)} km`, ask: (a, b) => `Is ${b} longer or shorter than ${a}?` },
  { key: "turns", label: "Corners", up: "More", down: "Fewer", format: (v) => `${v}`, ask: (a, b) => `Does ${b} have more or fewer corners than ${a}?` },
  { key: "firstGp", label: "First Grand Prix", up: "Later", down: "Earlier", format: (v) => `${v}`, ask: (a, b) => `Did ${b} hold its first Grand Prix later or earlier than ${a}?` },
  { key: "laps", label: "Race laps", up: "More", down: "Fewer", format: (v) => `${v}`, ask: (a, b) => `Is the race at ${b} more or fewer laps than at ${a}?` },
  { key: "poleMs", label: "2025 pole lap", up: "Slower", down: "Quicker", format: poleTime, ask: (a, b) => `Was the 2025 pole at ${b} slower or quicker than at ${a}?` },
];

export const value = (c: CircuitFacts, s: StatKey) => c[s] as number | null;

export interface Round {
  stat: Stat;
  left: CircuitFacts;
  right: CircuitFacts;
}

/** A fresh round from `left`: a stat both circuits have, and a different circuit on the right. */
export function nextRound(left: CircuitFacts, rand = Math.random, avoid?: StatKey): Round {
  for (;;) {
    const stat = STATS[Math.floor(rand() * STATS.length)];
    if (stat.key === avoid && rand() < 0.7) continue;
    const others = CIRCUITS.filter((c) => c.id !== left.id && value(c, stat.key) !== null);
    const right = others[Math.floor(rand() * others.length)];
    if (value(left, stat.key) === null || value(right, stat.key) === value(left, stat.key)) continue;
    return { stat, left, right };
  }
}

export function firstRound(rand = Math.random): Round {
  return nextRound(CIRCUITS[Math.floor(rand() * CIRCUITS.length)], rand);
}

/** Is "higher" (true) or "lower" (false) the right call? */
export function isRight(r: Round, higher: boolean): boolean {
  return value(r.right, r.stat.key)! > value(r.left, r.stat.key)! === higher;
}

const KEY = "apex.higherlower.v1";
export interface HigherLowerRecord {
  best: number;
  runs: number;
}

export const loadHigherLower = () => load<HigherLowerRecord>(KEY, { best: 0, runs: 0 });

export function recordRun(streak: number): HigherLowerRecord {
  const r = loadHigherLower();
  const next = { best: Math.max(r.best, streak), runs: r.runs + 1 };
  save(KEY, next);
  return next;
}

/*
 * The daily edition: the same ten calls for everyone each day, chained like a
 * run (each round's second circuit is the next round's first), and all ten
 * are played: a miss costs a point, not the round. Scored out of ten.
 */
export const DAILY_CALLS = 10;
const DAILY_KEY = "apex.higherlower.daily.v1";

/** Today's ten rounds: deterministic from the day, so every player gets the same calls. */
export function dailyRounds(key = dateKey()): Round[] {
  const rand = seeded(dailyNumber(key) * 104_729 + 31);
  const rounds = [firstRound(rand)];
  while (rounds.length < DAILY_CALLS) {
    const prev = rounds[rounds.length - 1];
    rounds.push(nextRound(prev.right, rand, prev.stat.key));
  }
  return rounds;
}

export interface HigherLowerDaily {
  /** each call made so far: right or wrong, in order */
  days: Record<string, boolean[]>;
}
const loadDays = () => load<HigherLowerDaily>(DAILY_KEY, { days: {} }).days;

/** The calls made on a day (empty if not started). */
export const dailyCalls = (key = dateKey()): boolean[] => loadDays()[key] ?? [];
export const dailyDone = (calls: boolean[]) => calls.length >= DAILY_CALLS;
export const dailyScore = (calls: boolean[]) => calls.filter(Boolean).length;

/** Record one call of today's ten; ignored once all ten are in. */
export function recordDailyCall(right: boolean, key = dateKey()): boolean[] {
  const days = loadDays();
  const calls = days[key] ?? [];
  if (dailyDone(calls)) return calls;
  const next = [...calls, right];
  save(DAILY_KEY, { days: { ...days, [key]: next } });
  return next;
}

/** Every day whose ten calls were all made. */
export const dailyDoneDays = () =>
  Object.entries(loadDays())
    .filter(([, c]) => dailyDone(c))
    .map(([k]) => k);

/** Days played, average and best score, over finished days. */
export function dailyStats() {
  const scores = dailyDoneDays().map((k) => dailyScore(loadDays()[k]));
  return {
    played: scores.length,
    best: scores.length ? Math.max(...scores) : null,
    average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
  };
}

export function dailyShare(calls: boolean[], link: string, key = dateKey()): string {
  return `Lapdle Higher or lower #${dailyNumber(key)} ${dailyScore(calls)}/${DAILY_CALLS}\n${calls.map((c) => (c ? "🟩" : "🟥")).join("")}\n${link}`;
}
