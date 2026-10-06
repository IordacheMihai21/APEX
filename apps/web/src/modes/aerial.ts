import { CIRCUITS, load, save, seeded } from "./circuits";
import { dailyNumber, dailyTrack, dateKey } from "./daily";
import { mysteryAnswer } from "./mystery";
import { orderCircuit } from "./order";

/**
 * Aerial view: the circuit's surroundings from above, drawn from map data
 * without the track itself: fields, woods, water, roads, buildings, trees.
 * Start close in; every wrong guess pulls the view further out. Six guesses;
 * after three misses the continent is given, after five the country. Never
 * the day's Daily Quali, Mystery or Order the corners circuit.
 */
export const AERIAL_TRIES = 6;
/** How much ground the view covers (metres across) for each guess; the last is the whole map. */
export const VIEW_WIDTHS = [350, 600, 1000, 1700, 2800, null] as const;
export const CONTINENT_AFTER = 3;
export const COUNTRY_AFTER = 5;

export function aerialCircuit(key = dateKey()): string {
  const taken = new Set([dailyTrack(key), mysteryAnswer(key), orderCircuit(key)]);
  const ids = CIRCUITS.map((c) => c.id).filter((id) => !taken.has(id));
  const rand = seeded(dailyNumber(key) * 15_485_863 + 29);
  return ids[Math.floor(rand() * ids.length)];
}

/**
 * Where the first view looks: a point of the lap (as a fraction of the
 * centreline) and a sideways offset in metres, so the track isn't simply
 * down the middle of the picture. The same for everyone each day.
 */
export function aerialSpot(key = dateKey()): { at: number; offset: number } {
  const rand = seeded(dailyNumber(key) * 7_368_787 + 41);
  return { at: rand(), offset: (rand() - 0.5) * 200 };
}

const KEY = "apex.aerial.v1";
interface AerialRecord {
  days: Record<string, string[]>;
}
const loadDays = () => load<AerialRecord>(KEY, { days: {} }).days;

export const aerialGuesses = (key = dateKey()): string[] => loadDays()[key] ?? [];
export const aerialSolved = (guesses: string[], key = dateKey()) => guesses.includes(aerialCircuit(key));
export const aerialOver = (guesses: string[], key = dateKey()) => aerialSolved(guesses, key) || guesses.length >= AERIAL_TRIES;

export function recordAerialGuess(id: string, key = dateKey()): string[] {
  const days = loadDays();
  const guesses = days[key] ?? [];
  if (aerialOver(guesses, key) || guesses.includes(id)) return guesses;
  const next = [...guesses, id];
  save(KEY, { days: { ...days, [key]: next } });
  return next;
}

export const aerialDoneDays = () =>
  Object.entries(loadDays())
    .filter(([k, g]) => aerialOver(g, k))
    .map(([k]) => k);

export function aerialStats() {
  const days = loadDays();
  const done = aerialDoneDays();
  const won = done.filter((k) => aerialSolved(days[k], k));
  return { played: done.length, solved: won.length, average: won.length ? won.reduce((a, k) => a + days[k].length, 0) / won.length : null };
}

export function aerialShare(guesses: string[], link: string, key = dateKey()): string {
  const solved = aerialSolved(guesses, key);
  const row = guesses.map((g) => (g === aerialCircuit(key) ? "🟩" : "🟥")).join("") + "⬛".repeat(Math.max(0, AERIAL_TRIES - guesses.length));
  return `Lapdle Aerial view #${dailyNumber(key)} ${solved ? guesses.length : "X"}/${AERIAL_TRIES}\n🛰️ ${row}\n${link}`;
}
