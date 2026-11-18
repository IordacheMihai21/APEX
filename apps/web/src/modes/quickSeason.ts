import { APEX_FORMULA, prepareTrack, simulateLap, type CarModel } from "@apex/engine";
import { loadTrack } from "../game/catalog";

export const QUICK_TRACKS = ["monza", "spa", "silverstone", "suzuka", "monaco", "interlagos", "hungaroring", "red-bull-ring", "zandvoort", "austin", "barcelona", "imola"] as const;
export type Setup = "low-drag" | "balanced" | "high-grip";
export const SETUPS: Setup[] = ["low-drag", "balanced", "high-grip"];
const KEY = "apex.quick-season.v1";

export interface QuickResult { track: string; wet: boolean; setup: Setup; timeMs: number; rivalMs: number; bestSetup: Setup; won: boolean }
export interface QuickRun { seed: number; order: string[]; results: QuickResult[] }
export interface QuickStore { run: QuickRun | null; bestWins: number; played: number; perfect: number }
let memoryStore: QuickStore | null = null;

function random(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 0x100000000);
}

export function readQuick(): QuickStore {
  if (memoryStore) return memoryStore;
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<QuickStore> | null;
    if (!s) return { run: null, bestWins: 0, played: 0, perfect: 0 };
    return { run: s.run ?? null, bestWins: s.bestWins ?? 0, played: s.played ?? 0, perfect: s.perfect ?? 0 };
  } catch { return { run: null, bestWins: 0, played: 0, perfect: 0 }; }
}

function save(store: QuickStore) {
  memoryStore = store;
  try { localStorage.setItem(KEY, JSON.stringify(store)); }
  catch { /* keep the current run playable when browser storage is blocked */ }
}

export function startQuick(seed = crypto.getRandomValues(new Uint32Array(1))[0]): QuickStore {
  const rand = random(seed);
  const order = [...QUICK_TRACKS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const store = readQuick();
  const next = { ...store, run: { seed, order, results: [] } };
  save(next);
  return next;
}

export function roundWet(seed: number, round: number) { return random(seed ^ Math.imul(round + 1, 0x9e3779b9))() < 0.25; }

export function setupCar(setup: Setup, wet: boolean): CarModel {
  const aero = setup === "low-drag" ? { clA: 4.2, cdA: 0.5 } : setup === "high-grip" ? { clA: 6.1, cdA: 1.6 } : { clA: 5, cdA: 1.1 };
  return { ...APEX_FORMULA, ...aero, mu: wet ? 1.3 : APEX_FORMULA.mu, id: `quick_${setup}_${wet ? "wet" : "dry"}` };
}

/** Same input gives the same times on every device; one small track chunk is loaded per round. */
export async function evaluateQuick(trackId: string, wet: boolean, setup: Setup, round: number): Promise<QuickResult> {
  const track = await loadTrack(trackId);
  const prepared = prepareTrack(track);
  const line = track.optimalLine!;
  const laps = SETUPS.map((id) => ({ id, ms: simulateLap({ track: prepared, line, car: setupCar(id, wet) }).lapTimeMs }));
  const best = laps.reduce((a, b) => b.ms < a.ms ? b : a);
  const chosen = laps.find((x) => x.id === setup)!;
  // Rival pressure rises across the season. The best setup always remains capable of winning.
  const rivalMs = Math.round(best.ms * (1 + 0.014 - round * 0.0008));
  return { track: trackId, wet, setup, timeMs: chosen.ms, rivalMs, bestSetup: best.id, won: chosen.ms <= rivalMs };
}

export function recordQuick(result: QuickResult): QuickStore {
  const store = readQuick();
  const run = store.run;
  if (!run || run.results.length >= QUICK_TRACKS.length || run.order[run.results.length] !== result.track) return store;
  const next: QuickStore = { ...store, run: { ...run, results: [...run.results, result] } };
  if (next.run!.results.length === QUICK_TRACKS.length) {
    const wins = next.run!.results.filter((r) => r.won).length;
    next.played++;
    next.bestWins = Math.max(next.bestWins, wins);
    if (wins === QUICK_TRACKS.length) next.perfect++;
  }
  save(next);
  return next;
}

export function setupLeft(run: QuickRun, setup: Setup) { return 4 - run.results.filter((r) => r.setup === setup).length; }
