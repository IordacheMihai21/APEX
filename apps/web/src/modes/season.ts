/**
 * Perfect Season (the 38-0 of Lapdle): 12 real circuits in a random order,
 * 3 laps per round to beat a rival pole that tightens every round.
 * The impossible goal: 12–0.
 */
export const SEASON_ROUNDS = 12;
export const SEASON_LAPS = 3;
const POOL = ["monza", "spa", "silverstone", "suzuka", "monaco", "interlagos", "hungaroring", "red-bull-ring", "zandvoort", "austin", "barcelona", "imola"];
const KEY = "apex.season.v1";

export interface SeasonRun {
  order: string[];
  results: ("W" | "L")[];
  lapsUsed: number; // in the current round
  bestLapMs: number | null; // in the current round
  knots?: number[];
}

export interface SeasonStore {
  run: SeasonRun | null;
  best: { wins: number; losses: number } | null;
  seasons: number;
  perfect: number;
}

export function loadSeason(): SeasonStore {
  try {
    return { run: null, best: null, seasons: 0, perfect: 0, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { run: null, best: null, seasons: 0, perfect: 0 };
  }
}

function save(s: SeasonStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function newSeason(): SeasonStore {
  const s = loadSeason();
  const order = POOL.slice().sort(() => Math.random() - 0.5);
  s.run = { order, results: [], lapsUsed: 0, bestLapMs: null };
  save(s);
  return s;
}

/**
 * Rival pole for a round: starts 1.2% slower than the perfect lap and closes
 * to 0.15% by the final round, so the season gets harder as it goes.
 */
export function rivalMs(targetMs: number, round: number): number {
  const t = Math.min(1, round / (SEASON_ROUNDS - 1));
  return Math.round(targetMs * (1 + 0.012 + (0.0015 - 0.012) * t));
}

export type RoundOutcome = "continue" | "won" | "lost";

/** Record a lap in the current round; returns what happened to the round. */
export function recordSeasonLap(lapTimeMs: number, rival: number, knots: number[]): { store: SeasonStore; outcome: RoundOutcome } {
  const s = loadSeason();
  const run = s.run!;
  run.lapsUsed++;
  run.bestLapMs = run.bestLapMs === null ? lapTimeMs : Math.min(run.bestLapMs, lapTimeMs);
  run.knots = knots;
  let outcome: RoundOutcome = "continue";
  if (lapTimeMs < rival) outcome = "won";
  else if (run.lapsUsed >= SEASON_LAPS) outcome = "lost";
  if (outcome !== "continue") {
    run.results.push(outcome === "won" ? "W" : "L");
    run.lapsUsed = 0;
    run.bestLapMs = null;
    run.knots = undefined;
    if (run.results.length >= SEASON_ROUNDS) {
      const wins = run.results.filter((r) => r === "W").length;
      const losses = run.results.length - wins;
      s.seasons++;
      if (losses === 0) s.perfect++;
      if (!s.best || wins > s.best.wins) s.best = { wins, losses };
    }
  }
  save(s);
  return { store: s, outcome };
}

export function seasonDone(run: SeasonRun | null) {
  return !!run && run.results.length >= SEASON_ROUNDS;
}

export function currentTrack(run: SeasonRun): string {
  return run.order[run.results.length];
}
