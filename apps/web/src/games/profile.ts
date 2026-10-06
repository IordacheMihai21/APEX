/**
 * The player's daily habit across all games: the play streak and the days
 * they played. It is derived from each game's own records (nothing extra is
 * stored), so it is always consistent with them and counts days played before
 * it existed. A day counts when at least one game of the daily set was
 * finished; a "perfect day" is the whole set.
 */
import { dateKey } from "../modes/daily";
import { DAILY_SET, type GameId } from "./registry";

export interface PlayStreak {
  /** days in a row with a daily game finished, up to today (or yesterday, until today is played) */
  current: number;
  best: number;
  /** today already counts */
  playedToday: boolean;
  /** days with at least one daily game finished */
  daysPlayed: number;
  /** days with the whole daily set finished */
  perfectDays: number;
}

const previous = (key: string) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return dateKey(d);
};

/** Which games of the daily set were finished on each day. */
export function playedDays(): Map<string, GameId[]> {
  const days = new Map<string, GameId[]>();
  for (const g of DAILY_SET)
    for (const day of g.doneDays?.() ?? []) {
      const list = days.get(day) ?? [];
      list.push(g.id);
      days.set(day, list);
    }
  return days;
}

export function playStreak(today = dateKey()): PlayStreak {
  const days = playedDays();
  const played = (d: string) => days.has(d);

  // the current run: from today if it counts already, otherwise from yesterday (it lives until midnight)
  const playedToday = played(today);
  let current = 0;
  for (let d = playedToday ? today : previous(today); played(d); d = previous(d)) current++;

  // the best run: walk the played days in order, counting consecutive ones
  let best = 0;
  let run = 0;
  let last: string | null = null;
  for (const d of [...days.keys()].filter((k) => k <= today).sort()) {
    run = last !== null && previous(d) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = d;
  }

  const perfectDays = [...days.values()].filter((ids) => ids.length === DAILY_SET.length).length;
  return { current, best: Math.max(best, current), playedToday, daysPlayed: days.size, perfectDays };
}
