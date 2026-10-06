import { NAMED_CORNERS } from "../content/quiz";
import { CIRCUITS, type CircuitFacts, circuit, load, save, seeded } from "./circuits";
import { dailyNumber, dateKey } from "./daily";

/**
 * Line-up: sixteen tiles, four groups of four. The groups come from the same
 * sourced facts as the other games (circuits by first Grand Prix, lap length,
 * race laps or corner count) and from the circuits' best-known corner names.
 * A day is generated from the date, the same for everyone, and only accepted
 * if every tile fits exactly one of the day's four groups, so the answer is
 * never in doubt. Four mistakes allowed; three right of four is "one away".
 */
export const GROUPS = 4;
export const GROUP_SIZE = 4;
export const MISTAKES = 4;

export interface Item {
  id: string;
  label: string;
}
export interface Category {
  id: string;
  title: string;
  /** 1 (easiest) to 4 (hardest): sets the colour */
  level: number;
  kind: "circuit" | "corner";
  members: string[];
}

/** Tiles are small: Spa-Francorchamps goes by the name everyone uses. */
const SHORT: Record<string, string> = { spa: "Spa" };
const circuitItem = (c: CircuitFacts): Item => ({ id: `c:${c.id}`, label: SHORT[c.id] ?? c.name });
const cornerItem = (name: string): Item => ({ id: `k:${name}`, label: name });

const byFact = (id: string, title: string, level: number, test: (c: CircuitFacts) => boolean): Category => ({
  id,
  title,
  level,
  kind: "circuit",
  members: CIRCUITS.filter(test).map((c) => `c:${c.id}`),
});

export const CATEGORIES: Category[] = [
  byFact("gp-1950", "First Grand Prix in 1950", 2, (c) => c.firstGp === 1950),
  byFact("gp-late", "First Grand Prix after 1985", 3, (c) => c.firstGp > 1985),
  byFact("laps-many", "More than 70 race laps", 3, (c) => c.laps > 70),
  byFact("laps-few", "Fewer than 55 race laps", 3, (c) => c.laps < 55),
  byFact("long", "Over 5.5 km a lap", 2, (c) => c.lengthKm > 5.5),
  byFact("short", "Under 4.4 km a lap", 2, (c) => c.lengthKm < 4.4),
  byFact("few-corners", "Fewer than 15 corners", 4, (c) => c.turns < 15),
  byFact("many-corners", "19 corners or more", 4, (c) => c.turns >= 19),
  // corner names: the circuits with four well-known ones
  ...Object.entries(NAMED_CORNERS)
    .filter(([, names]) => names.length >= GROUP_SIZE)
    .map(([track, names]) => ({ id: `corners-${track}`, title: `Corners of ${circuit(track).name}`, level: 1, kind: "corner" as const, members: names.map((n) => `k:${n}`) })),
].filter((c) => c.members.length >= GROUP_SIZE);

const ITEMS = new Map<string, Item>([...CIRCUITS.map((c) => [`c:${c.id}`, circuitItem(c)] as const), ...Object.values(NAMED_CORNERS).flat().map((n) => [`k:${n}`, cornerItem(n)] as const)]);
export const item = (id: string) => ITEMS.get(id)!;

export interface Puzzle {
  /** the four groups, easiest first, with the four tiles of each */
  groups: { category: Category; items: string[] }[];
  /** the sixteen tiles in their starting order */
  board: string[];
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Every tile fits its own group and no other group of the day. */
export function unambiguous(groups: { category: Category; items: string[] }[]): boolean {
  return groups.every((g) => g.items.every((id) => groups.filter((h) => h.category.members.includes(id)).length === 1));
}

/** The day's puzzle: four groups (one or two of corner names, the rest of circuits), checked for a single answer. */
export function dailyLineup(key = dateKey()): Puzzle {
  const rand = seeded(dailyNumber(key) * 31_337 + 7);
  for (let attempt = 0; attempt < 5000; attempt++) {
    const corners = 1 + Math.floor(rand() * 2);
    const cats = [...shuffle(CATEGORIES.filter((c) => c.kind === "corner"), rand).slice(0, corners), ...shuffle(CATEGORIES.filter((c) => c.kind === "circuit"), rand).slice(0, GROUPS - corners)];
    const used = new Set<string>();
    const groups: { category: Category; items: string[] }[] = [];
    for (const category of cats) {
      const free = shuffle(
        category.members.filter((m) => !used.has(m)),
        rand,
      ).slice(0, GROUP_SIZE);
      if (free.length < GROUP_SIZE) break;
      free.forEach((m) => used.add(m));
      groups.push({ category, items: free });
    }
    if (groups.length < GROUPS || !unambiguous(groups)) continue;
    groups.sort((a, b) => a.category.level - b.category.level);
    return { groups, board: shuffle(groups.flatMap((g) => g.items), rand) };
  }
  throw new Error(`line-up: no puzzle for ${key}`);
}

/** How a guess of four fares: the group it is, or how many of it share the best group ("one away" at three). */
export function judge(p: Puzzle, guess: string[]): { group: number | null; best: number } {
  let best = 0;
  for (let g = 0; g < p.groups.length; g++) {
    const n = guess.filter((id) => p.groups[g].items.includes(id)).length;
    if (n === GROUP_SIZE) return { group: g, best: n };
    best = Math.max(best, n);
  }
  return { group: null, best };
}

const KEY = "apex.lineup.v1";
interface LineupRecord {
  /** each guess of the day, as tile ids */
  days: Record<string, string[][]>;
}
const loadDays = () => load<LineupRecord>(KEY, { days: {} }).days;

export const lineupGuesses = (key = dateKey()): string[][] => loadDays()[key] ?? [];

/** The day so far: groups found (in the order found), mistakes, and whether it's over. */
export function lineupState(p: Puzzle, guesses: string[][]) {
  const found: number[] = [];
  let mistakes = 0;
  for (const g of guesses) {
    const r = judge(p, g);
    if (r.group !== null) found.includes(r.group) || found.push(r.group);
    else mistakes++;
  }
  const won = found.length === GROUPS;
  return { found, mistakes, won, over: won || mistakes >= MISTAKES };
}

export function recordLineupGuess(p: Puzzle, guess: string[], key = dateKey()): string[][] {
  const days = loadDays();
  const guesses = days[key] ?? [];
  if (lineupState(p, guesses).over) return guesses;
  const next = [...guesses, [...guess].sort()];
  save(KEY, { days: { ...days, [key]: next } });
  return next;
}

/** Days whose puzzle was finished, won or lost (any guesses count as finished at the fourth group or mistake). */
export const lineupDoneDays = () =>
  Object.entries(loadDays())
    .filter(([k, g]) => lineupState(dailyLineup(k), g).over)
    .map(([k]) => k);

export function lineupStats() {
  const days = loadDays();
  const done = lineupDoneDays();
  const states = done.map((k) => lineupState(dailyLineup(k), days[k]));
  const won = states.filter((s) => s.won);
  return { played: done.length, won: won.length, perfect: won.filter((s) => s.mistakes === 0).length };
}

const SQUARE = ["🟨", "🟩", "🟦", "🟪"];
export function lineupShare(p: Puzzle, guesses: string[][], link: string, key = dateKey()): string {
  const rows = guesses.map((g) => g.map((id) => SQUARE[p.groups.findIndex((gr) => gr.items.includes(id))]).join(""));
  const s = lineupState(p, guesses);
  return `Lapdle Line-up #${dailyNumber(key)} ${s.won ? `${s.mistakes} mistake${s.mistakes === 1 ? "" : "s"}` : "X"}\n${rows.join("\n")}\n${link}`;
}
