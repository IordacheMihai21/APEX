import DATA from "../game/racing-context.json";
import { seeded } from "./circuits";
import { dailyNumber, dateKey } from "./daily";

export interface Driver { id: string; name: string; nation: string; first: number; last: number; teams: string[]; starts: number; wins: number; titles: number }
export const DRIVERS = DATA.drivers as Driver[];
export const CONTEXT_SOURCE = DATA.source;
const KEY = "apex.racing-context.v1";
const CLUE_KEY = "apex.racing-context-clues.v1";
const clueMemory = new Map<string, number>();
const TARGETS = DRIVERS.filter((d) => d.starts >= 50 || d.wins > 0);

function shuffledCycle(cycle: number) {
  const ids = TARGETS.map((x) => x.id);
  const rand = seeded(cycle * 19001 + 313);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

export function secretDriver(day = dateKey()): Driver {
  const n = dailyNumber(day);
  return DRIVERS.find((d) => d.id === shuffledCycle(Math.floor(n / TARGETS.length))[n % TARGETS.length])!;
}

function score(a: Driver, b: Driver) {
  if (a.id === b.id) return Infinity;
  const overlap = a.teams.filter((x) => b.teams.includes(x)).length;
  const gap = Math.max(0, a.first - b.last, b.first - a.last);
  const midGap = Math.abs((a.first + a.last) / 2 - (b.first + b.last) / 2);
  return (a.nation === b.nation ? 28 : 0)
    + Math.min(2, overlap) * 16
    + (gap === 0 ? 22 : 22 * Math.exp(-gap / 10))
    + 12 * Math.exp(-midGap / 16)
    + 8 * Math.exp(-Math.abs(Math.log1p(a.starts) - Math.log1p(b.starts)))
    + 8 * Math.exp(-Math.abs(Math.log1p(a.wins) - Math.log1p(b.wins)))
    + (a.titles && b.titles ? 4 : 0);
}

export function ranksFor(secret: Driver): Map<string, number> {
  return new Map([secret, ...DRIVERS.filter((d) => d.id !== secret.id).sort((a, b) => score(b, secret) - score(a, secret) || a.name.localeCompare(b.name))].map((d, i) => [d.id, i + 1]));
}

export function contextGuesses(day = dateKey()): string[] {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string[]>)[day] ?? []; }
  catch { return []; }
}

export function recordContextGuess(id: string, day = dateKey()): string[] {
  const old = contextGuesses(day);
  if (old.includes(id) || !DRIVERS.some((d) => d.id === id)) return old;
  const next = [...old, id];
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string[]>;
    all[day] = next;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* still works during this visit */ }
  return next;
}

export function contextClues(day = dateKey()): number {
  if (clueMemory.has(day)) return clueMemory.get(day)!;
  try { return Math.min(3, Math.max(0, (JSON.parse(localStorage.getItem(CLUE_KEY) ?? "{}") as Record<string, number>)[day] ?? 0)); }
  catch { return 0; }
}

export function revealContextClue(day = dateKey()): number {
  const next = Math.min(3, contextClues(day) + 1);
  clueMemory.set(day, next);
  try {
    const all = JSON.parse(localStorage.getItem(CLUE_KEY) ?? "{}") as Record<string, number>;
    all[day] = next;
    localStorage.setItem(CLUE_KEY, JSON.stringify(all));
  } catch { /* visible for this visit */ }
  return next;
}
