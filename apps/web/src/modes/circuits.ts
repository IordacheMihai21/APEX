import { CATALOG } from "../game/catalog";
import { OUTLINES } from "../game/outlines";

export type Continent = "Europe" | "Asia" | "North America" | "South America";

/**
 * Public facts about the real circuits, for the trivia games: official lap
 * length, official corner count, the year of the first world championship
 * Grand Prix held there, race distance in laps, and the 2025 pole lap.
 * Venue facts only: no teams, drivers or results.
 */
export interface CircuitFacts {
  id: string;
  name: string;
  country: string;
  flag: string;
  continent: Continent;
  lengthKm: number;
  turns: number;
  firstGp: number;
  laps: number;
  poleMs: number | null;
}

const FACTS: Record<string, Omit<CircuitFacts, "id" | "name" | "country" | "flag" | "poleMs">> = {
  monza: { continent: "Europe", lengthKm: 5.793, turns: 11, firstGp: 1950, laps: 53 },
  spa: { continent: "Europe", lengthKm: 7.004, turns: 19, firstGp: 1950, laps: 44 },
  silverstone: { continent: "Europe", lengthKm: 5.891, turns: 18, firstGp: 1950, laps: 52 },
  suzuka: { continent: "Asia", lengthKm: 5.807, turns: 18, firstGp: 1987, laps: 53 },
  monaco: { continent: "Europe", lengthKm: 3.337, turns: 19, firstGp: 1950, laps: 78 },
  interlagos: { continent: "South America", lengthKm: 4.309, turns: 15, firstGp: 1973, laps: 71 },
  hungaroring: { continent: "Europe", lengthKm: 4.381, turns: 14, firstGp: 1986, laps: 70 },
  "red-bull-ring": { continent: "Europe", lengthKm: 4.318, turns: 10, firstGp: 1970, laps: 71 },
  zandvoort: { continent: "Europe", lengthKm: 4.259, turns: 14, firstGp: 1952, laps: 72 },
  austin: { continent: "North America", lengthKm: 5.513, turns: 20, firstGp: 2012, laps: 56 },
  barcelona: { continent: "Europe", lengthKm: 4.657, turns: 14, firstGp: 1991, laps: 66 },
  imola: { continent: "Europe", lengthKm: 4.909, turns: 19, firstGp: 1980, laps: 63 },
};

/** The twelve real circuits, in catalog order. */
export const CIRCUITS: CircuitFacts[] = CATALOG.filter((t) => FACTS[t.id]).map((t) => ({
  id: t.id,
  name: t.name,
  country: t.country,
  flag: t.flag,
  poleMs: OUTLINES[t.id]?.realPoleMs ?? null,
  ...FACTS[t.id],
}));

export const circuit = (id: string) => CIRCUITS.find((c) => c.id === id)!;

/** A small seeded generator (mulberry32), so a day's puzzle is the same for everyone. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function load<T>(key: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? "{}") };
  } catch {
    return { ...fallback };
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* records just won't persist */
  }
}
