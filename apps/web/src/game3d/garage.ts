/**
 * The player's car (the garage): its paint, its second colour and its race number, kept on this device only for now
 * (a shared, moderated version comes later). No three.js here, so the game's bundle can read it cheaply.
 *
 * Number 1 is the champion's: only the driver who set yesterday's fastest Daily Quali lap (under their board name)
 * may run it, for the day. Everyone else picks from 2 to 99. A driver who has earned it can also keep their own
 * number, as in F1.
 */
import { fetchBoard, fetchRecentBoards, myNickname } from "../online";
import { dateKey } from "../modes/schedule";

export interface Garage {
  paint: string;
  paint2: string;
  /** the player's own number, 2-99 (null: none chosen yet) */
  number: number | null;
  /** run number 1 on the days they've earned it */
  useOne: boolean;
}

/** the paints on offer: no team's colours copied, all bright enough to read on a track */
export const PAINTS = ["#ff6a13", "#e10600", "#1e5bc6", "#00a19c", "#2fa84f", "#ffd400", "#ff2d8a", "#7a3cff", "#f2f2ee", "#141518"];
export const PAINTS2 = ["#141518", "#f2f2ee", "#3b4048", "#c9a227", "#0d2a5c"];
/** the special livery, for three friends who played from your link: hot pink with turquoise, as the Neon grid car */
export const NEON_LIVERY = { paint: "#ff2d95", paint2: "#19e3d6" };

const KEY = "apex.garage";
export const DEFAULT_GARAGE: Garage = { paint: PAINTS[0], paint2: PAINTS2[0], number: null, useOne: true };

export function loadGarage(): Garage {
  try {
    const g = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Garage> | null;
    if (!g) return { ...DEFAULT_GARAGE };
    return {
      paint: typeof g.paint === "string" && /^#[0-9a-f]{6}$/i.test(g.paint) ? g.paint : DEFAULT_GARAGE.paint,
      paint2: typeof g.paint2 === "string" && /^#[0-9a-f]{6}$/i.test(g.paint2) ? g.paint2 : DEFAULT_GARAGE.paint2,
      number: validNumber(g.number) ? g.number : null,
      useOne: g.useOne !== false,
    };
  } catch {
    return { ...DEFAULT_GARAGE };
  }
}

export function saveGarage(g: Garage) {
  try {
    localStorage.setItem(KEY, JSON.stringify(g));
  } catch {
    // private mode: it lasts the visit
  }
}

/** a number a player may pick for themselves: 2 to 99 (1 is earned, not picked) */
export function validNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 2 && n <= 99;
}

const CHAMP_KEY = "apex.champion";

/**
 * Whether this device set yesterday's fastest Daily Quali lap, under its board name (checked once a day, then kept).
 * False when offline or unnamed: the champion is whoever tops the named board.
 */
export async function isChampion(today = dateKey()): Promise<boolean> {
  try {
    const kept = JSON.parse(localStorage.getItem(CHAMP_KEY) ?? "null") as { day: string; yes: boolean } | null;
    if (kept?.day === today) return kept.yes;
  } catch {
    /* check again */
  }
  const me = myNickname();
  if (!me) return false;
  const y = new Date(`${today}T12:00:00`);
  y.setDate(y.getDate() - 1);
  const yesterday = dateKey(y);
  const boards = await fetchRecentBoards();
  const day = boards?.find((b) => b.day === yesterday);
  if (!day) return false;
  const top = await fetchBoard({ day: yesterday, trackId: day.trackId, condition: day.condition }, 1);
  if (!top) return false;
  const yes = top[0]?.pos === 1 && top[0].nickname === me;
  try {
    localStorage.setItem(CHAMP_KEY, JSON.stringify({ day: today, yes }));
  } catch {
    /* not kept */
  }
  return yes;
}

/** the number on the car today: 1 for the champion who wants it, else their own (null: none) */
export function numberToday(g: Garage, champion: boolean): number | null {
  return champion && g.useOne ? 1 : g.number;
}
