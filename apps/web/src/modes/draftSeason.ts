import DATA from "../game/draft-season.json";
import { evaluateQuick, QUICK_TRACKS } from "./quickSeason";
import { seeded } from "./circuits";
import { readDraft, saveDraft, saveRun } from "./draftSeasonStore";
export { readDraft, saveRun, clearDraft } from "./draftSeasonStore";

export const DRAFT_SOURCE = DATA.source;
export type Squad = (typeof DATA.squads)[number];
export const SQUADS: Squad[] = DATA.squads;
export const SLOTS = ["driver1", "driver2", "chassis", "engine", "qualifying", "race", "reliability"] as const;
export type Slot = typeof SLOTS[number];
export type Philosophy = "balanced" | "low-drag" | "high-grip";
export type Difficulty = "easy" | "normal" | "hard";
export type Era = "all" | "2000s" | "2010s" | "modern";
export type DraftMode = "squad-first" | "slot-first";
export interface DraftConfig {
  philosophy: Philosophy; difficulty: Difficulty; era: Era; mode: DraftMode;
  driverRatings: "season" | "prime"; showRatings: boolean; midseason: boolean;
  fromYear: number; toYear: number; constructorOnly: string | null;
}
export interface DraftPick { slot: Slot; id: string; name: string; constructor: string; year: number; rating: number }
export interface DraftRace { circuit: string; baseMs: number; playerMs: number; rivalMs: number; position: number; won: boolean; points: number }
export interface DraftRun {
  seed: number; config: DraftConfig; picks: Partial<Record<Slot, DraftPick>>;
  currentSquadId: string | null; selectedSlot: Slot | null; spins: number; rerollsUsed: number;
  order: string[]; results: DraftRace[]; upgrade: "engine" | "aero" | "reliability" | null;
}
export interface DraftStore { run: DraftRun | null; bestWins: number; played: number }
export interface Candidate { id: string; name: string; slot: Slot | "driver"; rating: number }

export const DEFAULT_CONFIG: DraftConfig = {
  philosophy: "balanced", difficulty: "normal", era: "all", mode: "squad-first",
  driverRatings: "season", showRatings: true, midseason: false,
  fromYear: 1992, toYear: 2025, constructorOnly: null,
};
export const SLOT_NAME: Record<Slot, string> = {
  driver1: "Lead driver", driver2: "Second driver", chassis: "Chassis", engine: "Power unit",
  qualifying: "Qualifying", race: "Race pace", reliability: "Reliability",
};
export const REROLLS: Record<Difficulty, number> = { easy: 3, normal: 1, hard: 0 };

export function eligibleSquads(config: DraftConfig): Squad[] {
  const eraStart = config.era === "modern" ? 2016 : config.era === "2010s" ? 2010 : config.era === "2000s" ? 2000 : 1992;
  const first = Math.max(eraStart, config.fromYear ?? 1992);
  return SQUADS.filter((s) => s.year >= first && s.year <= (config.toYear ?? 2025) && (!config.constructorOnly || s.constructor === config.constructorOnly));
}

export function startDraft(config: DraftConfig, seed = crypto.getRandomValues(new Uint32Array(1))[0]): DraftStore {
  const order = [...QUICK_TRACKS];
  const rand = seeded(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return saveRun({ seed, config, picks: {}, currentSquadId: null, selectedSlot: null, spins: 0, rerollsUsed: 0, order, results: [], upgrade: null });
}

export function currentSquad(run: DraftRun): Squad | null { return SQUADS.find((s) => s.id === run.currentSquadId) ?? null; }
export function optionsFor(run: DraftRun, squad: Squad): Candidate[] {
  const used = new Set(Object.values(run.picks).map((p) => p?.id));
  const drivers: Candidate[] = squad.drivers.filter((d) => !used.has(d.id)).map((d) => ({ id: d.id, name: d.name, slot: "driver", rating: d[run.config.driverRatings] }));
  const modules: Candidate[] = (["chassis", "engine", "qualifying", "race", "reliability"] as const).map((slot) => ({
    id: `${squad.id}:${slot}`, slot, name: slot === "chassis" ? squad.chassis : slot === "engine" ? squad.engine : `${squad.constructor} ${SLOT_NAME[slot]}`,
    rating: squad.ratings[slot],
  }));
  const available = [...drivers, ...modules].filter((c) => c.slot === "driver" ? !run.picks.driver1 || !run.picks.driver2 : !run.picks[c.slot]);
  const selected = run.selectedSlot;
  return run.config.mode === "slot-first" && selected ? available.filter((c) => c.slot === selected || (c.slot === "driver" && selected.startsWith("driver"))) : available;
}

export function spinDraft(run: DraftRun, reroll = false): DraftRun {
  if (run.config.mode === "slot-first" && !run.selectedSlot) return run;
  if (reroll && (!run.currentSquadId || run.rerollsUsed >= REROLLS[run.config.difficulty])) return run;
  if (!reroll && run.currentSquadId) return run;
  const used = new Set(Object.values(run.picks).map((p) => `${p?.year}-${p?.constructor}`));
  const pool = eligibleSquads(run.config).filter((s) => !used.has(`${s.year}-${s.constructor}`) && s.id !== run.currentSquadId && optionsFor(run, s).length);
  if (!pool.length) return run;
  const rand = seeded(run.seed ^ Math.imul(run.spins + 1, 0x9e3779b9));
  const squad = pool[Math.floor(rand() * pool.length)];
  return { ...run, currentSquadId: squad.id, spins: run.spins + 1, rerollsUsed: run.rerollsUsed + Number(reroll) };
}

export function pickDraft(run: DraftRun, candidate: Candidate, slot: Slot): DraftRun {
  const squad = currentSquad(run);
  if (!squad || run.picks[slot] || !optionsFor(run, squad).some((x) => x.id === candidate.id)) return run;
  if (candidate.slot !== slot && !(candidate.slot === "driver" && slot.startsWith("driver"))) return run;
  if (run.config.mode === "slot-first" && run.selectedSlot !== slot) return run;
  const pick: DraftPick = { slot, id: candidate.id, name: candidate.name, constructor: squad.constructor, year: squad.year, rating: candidate.rating };
  return { ...run, picks: { ...run.picks, [slot]: pick }, currentSquadId: null, selectedSlot: null };
}

export function draftComplete(run: DraftRun) { return SLOTS.every((slot) => !!run.picks[slot]); }
export function wins(run: DraftRun) { return run.results.filter((r) => r.won).length; }
export function teamRating(run: DraftRun): number {
  const p = run.picks;
  const weights: Record<Slot, number> = { driver1: 0.14, driver2: 0.10, chassis: 0.20, engine: 0.18, qualifying: 0.11, race: 0.17, reliability: 0.10 };
  return SLOTS.reduce((sum, slot) => sum + (p[slot]?.rating ?? 50) * weights[slot], 0);
}
const fast = new Set(["monza", "spa", "austin", "red-bull-ring"]);
const technical = new Set(["monaco", "hungaroring", "zandvoort", "suzuka", "imola"]);
const RIVALS = [
  { name: "Northstar", rating: 79 }, { name: "Vector", rating: 76 }, { name: "Vanguard", rating: 74 },
  { name: "Orion", rating: 72 }, { name: "Aster", rating: 70 }, { name: "Kestrel", rating: 68 },
  { name: "Novus", rating: 66 }, { name: "Flux", rating: 64 }, { name: "Meridian", rating: 62 },
] as const;
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
function rivalTimes(seed: number, round: number, baseMs: number): number[] {
  return RIVALS.map((team, i) => {
    const rand = seeded(seed ^ Math.imul(round + 1, 0x85ebca6b) ^ Math.imul(i + 1, 0xc2b2ae35));
    return Math.round(baseMs * (1 + (76 - team.rating) * 0.0007 + (rand() - 0.5) * 0.012));
  });
}
export function seasonStandings(run: DraftRun): { name: string; points: number; wins: number; player: boolean }[] {
  const entries = [{ name: "Your team", points: 0, wins: 0, player: true }, ...RIVALS.map((r) => ({ name: r.name, points: 0, wins: 0, player: false }))];
  for (let i = 0; i < run.results.length; i++) {
    const result = run.results[i];
    const times = [result.playerMs, ...rivalTimes(run.seed, i, result.baseMs)];
    const order = times.map((time, index) => ({ time, index })).sort((a, b) => a.time - b.time || a.index - b.index);
    order.forEach((item, place) => { entries[item.index].points += POINTS[place]; if (place === 0) entries[item.index].wins++; });
  }
  return entries.sort((a, b) => b.points - a.points || b.wins - a.wins || Number(b.player) - Number(a.player));
}
function philosophyBonus(p: Philosophy, track: string) {
  if (p === "balanced") return 1;
  return p === "low-drag" ? fast.has(track) ? 4 : technical.has(track) ? -2 : 0 : technical.has(track) ? 4 : fast.has(track) ? -2 : 0;
}
function upgradeBonus(run: DraftRun, track: string) {
  if (run.upgrade === "engine") return fast.has(track) ? 6 : 2;
  if (run.upgrade === "aero") return technical.has(track) ? 6 : 2;
  if (run.upgrade === "reliability") return 3;
  return 0;
}

/** Use the existing deterministic lap model as the base time, then apply the drafted team's rated pace. */
export async function simulateDraft(run: DraftRun, onProgress?: (round: number) => void): Promise<DraftRun> {
  if (!draftComplete(run)) return run;
  const last = run.config.midseason && !run.upgrade ? 6 : 12;
  const results = [...run.results];
  for (let i = results.length; i < last; i++) {
    const circuit = run.order[i];
    const base = (await evaluateQuick(circuit, false, "balanced", i)).timeMs;
    const strength = teamRating(run) + philosophyBonus(run.config.philosophy, circuit) + (i >= 6 ? upgradeBonus(run, circuit) : 0);
    const playerMs = Math.round(base * (1 + (76 - strength) * 0.0007));
    const rivals = rivalTimes(run.seed, i, base);
    const rivalMs = Math.min(...rivals);
    const position = 1 + rivals.filter((time) => time < playerMs).length;
    const won = position === 1;
    results.push({ circuit, baseMs: base, playerMs, rivalMs, position, won, points: POINTS[position - 1] });
    onProgress?.(i + 1);
  }
  return { ...run, results };
}

export function finishDraft(run: DraftRun): DraftStore {
  const previous = readDraft();
  if (run.results.length !== 12 || previous.run?.results.length === 12) return saveRun(run);
  return saveDraft({ run, played: previous.played + 1, bestWins: Math.max(previous.bestWins, wins(run)) });
}
