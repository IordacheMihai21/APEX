import { load, save, seeded } from "./circuits";
import { dailyNumber, dateKey } from "./daily";

/**
 * Speed trap: five spots on real circuits a day, the same for everyone; guess
 * how fast the car is going there on the perfect lap (dry), as the physics
 * engine drives it (game/speedtrap.json, from
 * tools/track-builder/src/build-speedtrap.ts). Each round is a different
 * circuit: one top speed, two of the slowest points of corners, two fast
 * corners. Scored out of 100 a round on how close the guess is.
 */
export type TrapKind = "top" | "apex" | "fast";
export interface TrapPoint {
  track: string;
  kind: TrapKind;
  kmh: number;
  lapM: number;
  /** the spot on the circuit map, and the direction of travel (degrees, map axes) */
  map: [number, number];
  heading: number;
}

export const ROUNDS = 5;
export const MIN_KMH = 20;
export const MAX_KMH = 360;
/** Guesses this far off or more score nothing. */
export const ZERO_AT_KMH = 60;
const PATTERN: TrapKind[] = ["top", "apex", "apex", "fast", "fast"];

export const KIND_LABEL: Record<TrapKind, string> = {
  top: "Flat out, at the end of a straight",
  apex: "The slowest point of a corner",
  fast: "Through a fast corner",
};

/** Today's five points (indexes into the list), each from a different circuit, the kinds shuffled. */
export function dailyTraps(points: Pick<TrapPoint, "track" | "kind">[], key = dateKey()): number[] {
  const rand = seeded(dailyNumber(key) * 92_821 + 17);
  const kinds = [...PATTERN];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const used = new Set<string>();
  return kinds.map((kind) => {
    const pool = points.map((p, i) => [p, i] as const).filter(([p]) => p.kind === kind && !used.has(p.track));
    const [p, i] = pool[Math.floor(rand() * pool.length)];
    used.add(p.track);
    return i;
  });
}

export const roundPoints = (guess: number, actual: number) => Math.round(100 * Math.max(0, 1 - Math.abs(guess - actual) / ZERO_AT_KMH));

export type TrapGrade = "purple" | "green" | "yellow" | "red";
export function trapGrade(guess: number, actual: number): TrapGrade {
  const e = Math.abs(guess - actual);
  return e <= 5 ? "purple" : e <= 15 ? "green" : e <= 30 ? "yellow" : "red";
}

const KEY = "apex.speedtrap.v1";
/** One round played: the guess, and the speed it was (kept, so a day's score never needs the data again). */
export interface TrapRound {
  guess: number;
  actual: number;
}
interface TrapRecord {
  days: Record<string, TrapRound[]>;
}
const loadDays = () => load<TrapRecord>(KEY, { days: {} }).days;

/** The rounds played on a day, in order. */
export const trapRounds = (key = dateKey()): TrapRound[] => loadDays()[key] ?? [];
export const trapDone = (rounds: TrapRound[]) => rounds.length >= ROUNDS;
export const trapScore = (rounds: TrapRound[]) => rounds.reduce((a, r) => a + roundPoints(r.guess, r.actual), 0);

/** Record a round; ignored once the day's five are in. */
export function recordRound(guess: number, actual: number, key = dateKey()): TrapRound[] {
  const days = loadDays();
  const rounds = days[key] ?? [];
  if (trapDone(rounds)) return rounds;
  const next = [...rounds, { guess: Math.round(guess), actual }];
  save(KEY, { days: { ...days, [key]: next } });
  return next;
}

export const trapDoneDays = () =>
  Object.entries(loadDays())
    .filter(([, r]) => trapDone(r))
    .map(([k]) => k);

export function trapStats() {
  const days = loadDays();
  const scores = trapDoneDays().map((k) => trapScore(days[k]));
  return { played: scores.length, best: scores.length ? Math.max(...scores) : null, average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null };
}

const SQUARE: Record<TrapGrade, string> = { purple: "🟪", green: "🟩", yellow: "🟨", red: "🟥" };
export function trapShare(rounds: TrapRound[], link: string, key = dateKey()): string {
  return `Lapdle Speed trap #${dailyNumber(key)} ${trapScore(rounds)}/${ROUNDS * 100}\n${rounds.map((r) => SQUARE[trapGrade(r.guess, r.actual)]).join("")}\n${link}`;
}

export function trapVerdict(score: number): string {
  return score >= 450 ? "Radar gun" : score >= 350 ? "Sharp eye" : score >= 220 ? "In the ballpark" : "Back to the onboards";
}
