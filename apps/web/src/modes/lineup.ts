import { NAMED_CORNERS } from "../content/quiz";
import FACTS from "../game/lineup.json";
import { CIRCUITS, type CircuitFacts, circuit, load, save, seeded } from "./circuits";
import { t, tn } from "../i18n";
import { dailyNumber, dateKey } from "./daily";

/**
 * Line-up: sixteen tiles, four groups of four, one group of each difficulty
 * (yellow, green, blue, purple). The tiles are drivers, teams, title-winning
 * cars, circuits and famous corners; the groups come from F1DB
 * (game/lineup.json, built by npm run build:lineup, CC BY 4.0) and from the
 * circuits' best-known corner names. A day is generated from the date, the
 * same for everyone, and only accepted if every tile fits exactly one of the
 * day's four groups, so the answer is never in doubt. Four mistakes allowed;
 * three right of four is "one away".
 *
 * Days before LINEUP_V2 keep the first edition (circuit facts and corners
 * only), so the guesses saved for them still match their puzzle.
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
  kind: "circuit" | "corner" | "fact";
  /** groups of one kind ("drove for X and Y") share a family; a day draws the family first */
  family?: string;
  members: string[];
}

/** The first day of the second edition (drivers, teams and cars from F1DB). */
export const LINEUP_V2 = "2026-10-16";
export const LINEUP_SOURCE = FACTS.source;

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
    .map(([track, names]) => ({ id: `corners-${track}`, title: t("Corners of {circuit}", { circuit: circuit(track).name }), level: 1, kind: "corner" as const, members: names.map((n) => `k:${n}`) })),
].filter((c) => c.members.length >= GROUP_SIZE);

/** The second edition: the F1DB groups, plus the corner groups as yellow. */
export const CATEGORIES_V2: Category[] = [
  ...FACTS.groups.map((g) => ({ ...g, kind: "fact" as const })),
  ...CATEGORIES.filter((c) => c.kind === "corner").map((c) => ({ ...c, family: "corners" })),
];

const ITEMS = new Map<string, Item>([
  ...CIRCUITS.map((c) => [`c:${c.id}`, circuitItem(c)] as const),
  ...Object.values(NAMED_CORNERS).flat().map((n) => [`k:${n}`, cornerItem(n)] as const),
  ...FACTS.items.map((i) => [i.id, { id: i.id, label: i.label }] as const),
]);
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

/** The day's puzzle: the first edition before LINEUP_V2, the second from then on. */
export function dailyLineup(key = dateKey()): Puzzle {
  return key < LINEUP_V2 ? dailyLineupV1(key) : lineupV2(key);
}

/**
 * Second-edition days are built in order from LINEUP_V2 (and remembered), so a
 * day can steer clear of the groups of the two days before it.
 */
const V2_DAYS = new Map<string, Puzzle>();
const nextDay = (key: string) => dateKey(new Date(Date.parse(`${key}T12:00:00`) + 86_400_000));
function lineupV2(key: string): Puzzle {
  const hit = V2_DAYS.get(key);
  if (hit) return hit;
  let day = LINEUP_V2;
  const recent: string[][] = [];
  for (;;) {
    const p = V2_DAYS.get(day) ?? dailyLineupV2(day, new Set(recent.flat()));
    V2_DAYS.set(day, p);
    if (day >= key) return p;
    recent.push(p.groups.map((g) => g.category.id));
    if (recent.length > 2) recent.shift();
    day = nextDay(day);
  }
}

/** First edition: four groups (one or two of corner names, the rest of circuits), checked for a single answer. */
function dailyLineupV1(key: string): Puzzle {
  const rand = seeded(dailyNumber(key) * 31_337 + 7);
  for (let attempt = 0; attempt < 5000; attempt++) {
    const corners = 1 + Math.floor(rand() * 2);
    const cats = [...shuffle(CATEGORIES.filter((c) => c.kind === "corner"), rand).slice(0, corners), ...shuffle(CATEGORIES.filter((c) => c.kind === "circuit"), rand).slice(0, GROUPS - corners)];
    const groups = fill(cats, rand);
    if (!groups || !unambiguous(groups)) continue;
    groups.sort((a, b) => a.category.level - b.category.level);
    return { groups, board: shuffle(groups.flatMap((g) => g.items), rand) };
  }
  throw new Error(`line-up: no puzzle for ${key}`);
}

/**
 * Second edition: one group of each level. Each level's families take turns
 * (a shuffled order per cycle, like the Daily Quali's circuits), so no kind of
 * group comes back until the others have had a day; a group of the family is
 * drawn, then four tiles that fit it and none of the day's other groups.
 */
function dailyLineupV2(key: string, avoid: Set<string>): Puzzle {
  const day = Math.max(0, dailyNumber(key) - dailyNumber(LINEUP_V2));
  const rand = seeded(dailyNumber(key) * 48_271 + 11);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const families = [1, 2, 3, 4].map((level) => [...new Set(CATEGORIES_V2.filter((c) => c.level === level).map((c) => c.family ?? c.id))].sort());
  /** the n-th family in a level's rotation (a fresh shuffled order every cycle) */
  const familyAt = (l: number, n: number) => {
    const fs = families[l];
    return shuffle(fs, seeded(Math.floor(n / fs.length) * 7_919 + l * 104_729 + 3))[n % fs.length];
  };
  for (let attempt = 0; attempt < 5000; attempt++) {
    // today's turn first; if those four don't fit together, the next turns, each level stepping at its own pace
    const step = Math.floor(attempt / 200);
    const cats = [1, 2, 3, 4].map((level, l) => {
      const family = familyAt(l, day + step * [1, 2, 3, 5][l]);
      return pick(CATEGORIES_V2.filter((c) => c.level === level && (c.family ?? c.id) === family));
    });
    if (new Set(cats.map((c) => c.id)).size < GROUPS) continue;
    // not a group from the last two days (unless nothing else fits)
    if (attempt < 4000 && cats.some((c) => avoid.has(c.id))) continue;
    const groups = fillApart(cats, rand);
    if (!groups || !unambiguous(groups)) continue;
    const labels = groups.flatMap((g) => g.items.map((id) => item(id).label.toLowerCase()));
    if (new Set(labels).size !== labels.length) continue;
    return { groups, board: shuffle(groups.flatMap((g) => g.items), rand) };
  }
  throw new Error(`line-up: no puzzle for ${key}`);
}

/** Four tiles for each group that belong to none of the day's other groups, or null when a group has too few. */
function fillApart(cats: Category[], rand: () => number): { category: Category; items: string[] }[] | null {
  const groups: { category: Category; items: string[] }[] = [];
  for (const category of cats) {
    const own = category.members.filter((m) => cats.every((c) => c === category || !c.members.includes(m)));
    const chosen = shuffle(own, rand).slice(0, GROUP_SIZE);
    if (chosen.length < GROUP_SIZE) return null;
    groups.push({ category, items: chosen });
  }
  return groups;
}

/** Four free tiles for each group in turn, or null when a group runs out. */
function fill(cats: Category[], rand: () => number): { category: Category; items: string[] }[] | null {
  const used = new Set<string>();
  const groups: { category: Category; items: string[] }[] = [];
  for (const category of cats) {
    const free = shuffle(
      category.members.filter((m) => !used.has(m)),
      rand,
    ).slice(0, GROUP_SIZE);
    if (free.length < GROUP_SIZE) return null;
    free.forEach((m) => used.add(m));
    groups.push({ category, items: free });
  }
  return groups;
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
  return `${t("Lapdle Line-up #{n}", { n: dailyNumber(key) })} ${s.won ? tn(s.mistakes, "{n} mistake", "{n} mistakes") : "X"}\n${rows.join("\n")}\n${link}`;
}
