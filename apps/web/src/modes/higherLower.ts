import { CIRCUITS, type CircuitFacts, load, save } from "./circuits";

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
