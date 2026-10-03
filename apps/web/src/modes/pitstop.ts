import { load, save, seeded } from "./circuits";
import { dailyNumber, dateKey } from "./daily";

/**
 * Pit stop: the car stops in its box, the four wheels light one at a time in a
 * random order, each with its own key; change them, then release the car when
 * the light turns green. The clock runs from the car stopping to the release,
 * plus penalties: a wrong key cross-threads a wheel nut (+0.5 s) and going
 * before the green is an early release (+1 s). One daily stop is the same for
 * everyone; practice is unlimited.
 */
export type Wheel = "fl" | "fr" | "rl" | "rr";
export const WHEELS: Wheel[] = ["fl", "fr", "rl", "rr"];
export const WHEEL_NAME: Record<Wheel, string> = { fl: "Front left", fr: "Front right", rl: "Rear left", rr: "Rear right" };
/** Home-row keys, so both hands stay put. */
export const KEY_POOL = ["A", "S", "D", "F", "J", "K", "L"];
export const WRONG_KEY_MS = 500;
export const EARLY_RELEASE_MS = 1000;
/** The fastest stop on record, for the verdict. */
export const RECORD_MS = 1800;

export interface PitPlan {
  /** the order the wheels light in */
  order: Wheel[];
  /** the key for each step, same index as order */
  keys: string[];
  /** wait between the last wheel and the green light, ms */
  greenDelayMs: number;
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makePlan(rand: () => number = Math.random): PitPlan {
  return {
    order: shuffle(WHEELS, rand),
    keys: shuffle(KEY_POOL, rand).slice(0, 4),
    greenDelayMs: Math.round(220 + rand() * 480),
  };
}

/** Today's stop, the same for everyone. */
export function dailyPlan(key = dateKey()): PitPlan {
  return makePlan(seeded(dailyNumber(key) * 7919 + 17));
}

export interface PitResult {
  totalMs: number;
  /** time for each wheel in order, then the release (green to go), ms */
  splits: number[];
  wrongKeys: number;
  earlyRelease: boolean;
}

export const penaltyMs = (r: Pick<PitResult, "wrongKeys" | "earlyRelease">) => r.wrongKeys * WRONG_KEY_MS + (r.earlyRelease ? EARLY_RELEASE_MS : 0);

export type StepGrade = "purple" | "green" | "yellow" | "red";

/** Each wheel and the release graded like a sector: purple is outstanding, red is slow. */
export function gradeStep(step: number, ms: number): StepGrade {
  const [purple, green, yellow] = step < 4 ? [300, 420, 600] : [230, 300, 450];
  return ms < purple ? "purple" : ms < green ? "green" : ms < yellow ? "yellow" : "red";
}

export function verdict(ms: number): string {
  if (ms < RECORD_MS) return "Faster than the fastest stop on record (1.80 s).";
  if (ms < 2000) return "Front-running pace. A stop like that wins places.";
  if (ms < 2500) return "A clean stop. The midfield would take it.";
  if (ms < 3500) return "Slow. The car behind just went past in the pit lane.";
  return "A long stop. Time to check the wheel guns.";
}

const KEY = "apex.pitstop.v1";

export interface PitRecord {
  best: number | null;
  /** most recent first */
  recent: number[];
  stops: number;
  /** the daily stop, by date: only the first attempt of the day counts */
  days: Record<string, PitResult>;
}

const EMPTY: PitRecord = { best: null, recent: [], stops: 0, days: {} };

export const loadPitStop = (): PitRecord => load<PitRecord>(KEY, EMPTY);

export function recordStop(r: PitRecord, result: PitResult, daily: string | null): PitRecord {
  const next: PitRecord = {
    best: r.best === null ? result.totalMs : Math.min(r.best, result.totalMs),
    recent: [result.totalMs, ...r.recent].slice(0, 5),
    stops: r.stops + 1,
    days: daily && !r.days[daily] ? { ...r.days, [daily]: result } : r.days,
  };
  save(KEY, next);
  return next;
}

export function todaysStop(r: PitRecord, key = dateKey()): PitResult | null {
  return r.days[key] ?? null;
}

const SQUARE: Record<StepGrade, string> = { purple: "🟪", green: "🟩", yellow: "🟨", red: "🟥" };

export const secs = (ms: number) => (ms / 1000).toFixed(3);

export function pitShare(result: PitResult, link: string, key = dateKey()): string {
  const squares = result.splits.map((ms, i) => SQUARE[gradeStep(i, ms)]).join("");
  const pen = penaltyMs(result);
  return `APEX Pit stop #${dailyNumber(key)} ${secs(result.totalMs)} s\n${squares}${pen ? ` +${(pen / 1000).toFixed(1)} s penalty` : ""}\n${link}`;
}
