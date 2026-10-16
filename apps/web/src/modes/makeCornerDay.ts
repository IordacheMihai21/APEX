import type { Condition } from "@apex/engine";
import { CATALOG } from "../game/catalog";
import INDEX from "../game/corners/index.json";
import { load, save, seeded } from "./circuits";
import { dailyNumber, dateKey, qualifyingDay, raceWeek } from "./daily";
import type { Outcome, RunScore } from "./makeCorner";

/**
 * Make the corner's day: one corner for everyone, in one condition, and three
 * runs at it; the best run is the day's score. The corners take turns: every
 * one of them once before any comes back, in a new order each round. A Grand
 * Prix's race week (Monday to Sunday) belongs to that circuit's corners instead.
 * Most days are dry; about one in five is wet and one in ten runs with low downforce.
 */

export interface CornerEntry {
  id: string;
  trackId: string;
  name: string;
}
export const CORNERS = INDEX as CornerEntry[];
export const RUNS_PER_DAY = 3;
/** A run's points: the maximum for the perfect calls, nothing for a car that ran wide or stopped. */
export const MAX_POINTS = 1000;

/** The circuit's name, and the corner's own ("La Source", "Turn 4", "Turns 12–14"). */
export function cornerLabel(e: CornerEntry): { corner: string; circuit: string } {
  const circuit = CATALOG.find((t) => t.id === e.trackId)?.name ?? e.trackId;
  const place = e.name.match(/^(.+?)(?:'s)? (Turns? .+)$/);
  return { corner: place ? place[2] : e.name, circuit };
}

/** The corner a day number lands on: rounds of every corner once, shuffled per round, never the same corner two days running. */
export function cornerOfDay(n: number): CornerEntry {
  const len = CORNERS.length;
  const round = (r: number) => {
    const order = CORNERS.map((_, i) => i);
    const rand = seeded(r * 104_729 + 17);
    for (let i = len - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  };
  const r = Math.floor(n / len);
  const order = round(r);
  // a round that starts with the corner the last one ended on swaps its first two
  if (r > 0 && order[0] === round(r - 1)[len - 1]) [order[0], order[1]] = [order[1], order[0]];
  return CORNERS[order[((n % len) + len) % len]];
}

export function conditionOfDay(n: number): Condition {
  const x = seeded(n * 7_727 + 3)();
  return x < 0.2 ? "wet" : x < 0.3 ? "lowdf" : "dry";
}

/**
 * The race-week corner, if `key` is in one: the Grand Prix circuit's corners in turn, its first (Turn 1) on qualifying
 * day. A circuit with fewer than three corners in the game gets only qualifying day, so no corner comes back daily.
 */
export function raceWeekCorner(key = dateKey()): CornerEntry | null {
  const week = raceWeek(key);
  if (!week || key < RACE_WEEK_CORNERS_FROM) return null;
  const own = CORNERS.filter((c) => c.trackId === week.trackId);
  if (!own.length) return null;
  if (own.length < 3) return qualifyingDay(key) ? own[0] : null;
  const quali = Date.parse(`${week.from}T12:00:00`) + 86_400_000;
  const d = Math.round((Date.parse(`${key}T12:00:00`) - quali) / 86_400_000);
  return own[((d % own.length) + own.length) % own.length];
}
/** Race weeks before this kept the plain rotation (days already played stay as they were). */
const RACE_WEEK_CORNERS_FROM = "2026-10-19";

export function dailyCorner(key = dateKey()): { corner: CornerEntry; condition: Condition } {
  const n = dailyNumber(key);
  // qualifying day is dry, like the Daily Quali on the same circuit
  return { corner: raceWeekCorner(key) ?? cornerOfDay(n), condition: raceWeekCorner(key) && qualifyingDay(key) ? "dry" : conditionOfDay(n) };
}

export type CallGrade = "purple" | "green" | "yellow" | "red" | "none";
/** Each call's colour, as the Quali colours corners: how far it was from the perfect one. */
export function callGrades(r: Pick<RunScore, "brakeM" | "speedKmh" | "throttleM" | "outcome">): [CallGrade, CallGrade, CallGrade] {
  const g = (x: number | null, purple: number, green: number, yellow: number): CallGrade => {
    if (x === null) return "none";
    const e = Math.abs(x);
    return e <= purple ? "purple" : e <= green ? "green" : e <= yellow ? "yellow" : "red";
  };
  const calls: [CallGrade, CallGrade, CallGrade] = [g(r.brakeM, 2, 6, 12), g(r.speedKmh, 1.5, 4, 8), g(r.throttleM, 3, 8, 16)];
  // the call that put the car off or stopped it is red, whatever its distance
  if (r.outcome !== "done") {
    let last = 0;
    calls.forEach((c, i) => c !== "none" && (last = i));
    calls[last] = "red";
  }
  return calls;
}

const KEY = "apex.makecorner.v1";
export interface RunRecord {
  points: number;
  outcome: Outcome;
  brakeM: number | null;
  speedKmh: number | null;
  throttleM: number | null;
}
interface Record_ {
  days: Record<string, RunRecord[]>;
  practice: number;
}
const loadRec = () => load<Record_>(KEY, { days: {}, practice: 0 });

export const dayRuns = (key = dateKey()) => loadRec().days[key] ?? [];
export const cornerDone = (runs: RunRecord[]) => runs.length >= RUNS_PER_DAY;
/** The day's score: its best run. */
export const cornerScore = (runs: RunRecord[]) => runs.reduce((a, r) => Math.max(a, r.points), 0);
export const bestRun = (runs: RunRecord[]) => runs.reduce<RunRecord | null>((a, r) => (!a || r.points > a.points ? r : a), null);

const round1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);

/** Record one of today's runs; ignored once all are in. */
export function recordRun(s: RunScore, key = dateKey()): RunRecord[] {
  const rec = loadRec();
  const runs = rec.days[key] ?? [];
  if (cornerDone(runs)) return runs;
  const next = [...runs, { points: s.points, outcome: s.outcome, brakeM: round1(s.brakeM), speedKmh: round1(s.speedKmh), throttleM: round1(s.throttleM) }];
  save(KEY, { ...rec, days: { ...rec.days, [key]: next } });
  return next;
}

export function recordCornerPractice() {
  const rec = loadRec();
  save(KEY, { ...rec, practice: rec.practice + 1 });
}

export const cornerDoneDays = () =>
  Object.entries(loadRec().days)
    .filter(([, r]) => cornerDone(r))
    .map(([k]) => k);

export function cornerStats() {
  const days = loadRec().days;
  const scores = cornerDoneDays().map((k) => cornerScore(days[k]));
  return {
    played: scores.length,
    best: scores.length ? Math.max(...scores) : null,
    average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
  };
}

const SQUARE: Record<CallGrade, string> = { purple: "🟪", green: "🟩", yellow: "🟨", red: "🟥", none: "⬛" };
const CONDITION_WORD: Record<Condition, string> = { dry: "", wet: " 🌧️", lowdf: " (low downforce)" };

/** "Lapdle Make the corner #12 · La Source, Spa-Francorchamps", the best run's three calls, the score. */
export function cornerShare(runs: RunRecord[], link: string, key = dateKey()): string {
  const { corner, condition } = dailyCorner(key);
  const l = cornerLabel(corner);
  const best = bestRun(runs);
  const squares = best ? callGrades(best).map((g) => SQUARE[g]).join("") : "";
  return `Lapdle Make the corner #${dailyNumber(key)}\n${l.corner}, ${l.circuit}${CONDITION_WORD[condition]}\n${squares} ${cornerScore(runs)}/${MAX_POINTS}\n${link}`;
}

export function cornerVerdict(score: number): string {
  return score >= 950 ? "Perfect corner" : score >= 800 ? "Quick through there" : score >= 500 ? "Made the corner" : score > 0 ? "Still learning it" : "Off at the corner";
}
