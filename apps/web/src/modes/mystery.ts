import { CIRCUITS, type CircuitFacts, circuit, load, save } from "./circuits";
import { dailyNumber, dailyTrack, dateKey } from "./daily";

/**
 * Mystery circuit: a daily guess-the-circuit puzzle. The outline draws in a
 * little more with every wrong guess, and each guess is marked against the
 * answer on country, length, corners and first Grand Prix, Wordle-style.
 */
export const MYSTERY_TRIES = 6;
/** How much of the lap is drawn before guess 1, 2, ... 6. */
export const REVEAL = [0.18, 0.32, 0.46, 0.6, 0.75, 0.9];
const KEY = "apex.mystery.v1";

/**
 * Today's answer: a walk through all twelve circuits every twelve days (5 is
 * coprime with 12), never the circuit the Daily Quali is on that day.
 */
export function mysteryAnswer(key = dateKey()): string {
  const n = CIRCUITS.length;
  let i = (((dailyNumber(key) - 1) * 5 + 7) % n + n) % n;
  if (CIRCUITS[i].id === dailyTrack(key)) i = (i + 1) % n;
  return CIRCUITS[i].id;
}

/** Where the reveal starts on the lap (0..1), so the start line isn't always the giveaway. */
export function revealOffset(key = dateKey()): number {
  return ((dailyNumber(key) * 0.382) % 1 + 1) % 1;
}

export type Mark = "hit" | "near" | "miss";
export type Dir = "up" | "down" | null;
export interface Feedback {
  id: string;
  country: Mark;
  length: { mark: Mark; dir: Dir };
  turns: { mark: Mark; dir: Dir };
  firstGp: { mark: Mark; dir: Dir };
}

/** "near" is within 0.5 km, 2 corners or 10 years; dir says which way the answer lies. */
function numeric(guess: number, answer: number, near: number, eps = 0): { mark: Mark; dir: Dir } {
  const d = answer - guess;
  if (Math.abs(d) <= eps) return { mark: "hit", dir: null };
  return { mark: Math.abs(d) <= near ? "near" : "miss", dir: d > 0 ? "up" : "down" };
}

export function judge(guessId: string, answerId: string): Feedback {
  const g = circuit(guessId);
  const a = circuit(answerId);
  return {
    id: guessId,
    country: g.country === a.country ? "hit" : g.continent === a.continent ? "near" : "miss",
    length: numeric(g.lengthKm, a.lengthKm, 0.5, 0.0005),
    turns: numeric(g.turns, a.turns, 2),
    firstGp: numeric(g.firstGp, a.firstGp, 10),
  };
}

export interface MysteryDay {
  key: string;
  guesses: string[];
}
export interface MysteryRecord {
  days: Record<string, string[]>;
}

export function loadMystery(key = dateKey()): MysteryDay {
  return { key, guesses: load<MysteryRecord>(KEY, { days: {} }).days[key] ?? [] };
}

export function recordGuess(day: MysteryDay, id: string): MysteryDay {
  if (day.guesses.includes(id) || isOver(day)) return day;
  const next = { ...day, guesses: [...day.guesses, id] };
  const rec = load<MysteryRecord>(KEY, { days: {} });
  save(KEY, { days: { ...rec.days, [day.key]: next.guesses } });
  return next;
}

export const isSolved = (day: MysteryDay) => day.guesses.includes(mysteryAnswer(day.key));

/** Every day whose mystery was finished (solved or out of guesses), read in one go. */
export function mysteryDoneDays(): string[] {
  const days = load<MysteryRecord>(KEY, { days: {} }).days;
  return Object.keys(days).filter((key) => isOver({ key, guesses: days[key] }));
}
export const isOver = (day: MysteryDay) => isSolved(day) || day.guesses.length >= MYSTERY_TRIES;

export interface MysteryStats {
  played: number;
  solved: number;
  streak: number;
  /** solved in 1..6 guesses */
  dist: number[];
}

export function mysteryStats(today = dateKey()): MysteryStats {
  const days = load<MysteryRecord>(KEY, { days: {} }).days;
  const dist = Array(MYSTERY_TRIES).fill(0);
  let played = 0;
  let solved = 0;
  for (const [key, guesses] of Object.entries(days)) {
    const day = { key, guesses };
    if (!isOver(day)) continue;
    played++;
    if (isSolved(day)) {
      solved++;
      dist[guesses.indexOf(mysteryAnswer(key))]++;
    }
  }
  // streak: consecutive solved days ending today (or yesterday, if today is still open)
  let streak = 0;
  const d = new Date(`${today}T12:00:00`);
  if (!days[today] || !isOver({ key: today, guesses: days[today] })) d.setDate(d.getDate() - 1);
  for (;;) {
    const k = dateKey(d);
    if (!days[k] || !isSolved({ key: k, guesses: days[k] })) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return { played, solved, streak, dist };
}

const SQUARE: Record<Mark, string> = { hit: "🟩", near: "🟨", miss: "⬛" };

export function mysteryShare(day: MysteryDay, link: string): string {
  const answer = mysteryAnswer(day.key);
  const rows = day.guesses.map((g) => {
    const f = judge(g, answer);
    return [f.country, f.length.mark, f.turns.mark, f.firstGp.mark].map((m) => SQUARE[m]).join("");
  });
  const score = isSolved(day) ? `${day.guesses.length}/${MYSTERY_TRIES}` : `X/${MYSTERY_TRIES}`;
  return `Lapdle Mystery circuit #${dailyNumber(day.key)} ${score}\n${rows.join("\n")}\n${link}`;
}

export type { CircuitFacts };
