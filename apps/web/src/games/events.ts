/**
 * Per-game analytics, the numbers a monetisation partner asks for: how many
 * who open a game finish it (completion), how many come back the next day
 * (retention), and how many games a visit plays (depth). Plausible is
 * cookieless and has no idea who anyone is, so each event carries a few coarse
 * buckets worked out on the device from what it already keeps (see
 * games/profile.ts): how many days it has played, when it last played, how much
 * of today's set is done. Never an id, a date or a time; nothing is stored for
 * this.
 *
 * Events:
 *   Visit           once per page load: last_played, player
 *   Game started    game, mode, player
 *   Game finished   game, mode, player, today (daily set done, "3/5"), plus a result
 *   Daily set done  the whole set finished today: player
 */
import { track } from "../analytics";
import { dateKey } from "../modes/daily";
import { playedDays } from "./profile";
import { type GameId, todayProgress } from "./registry";

/** Games outside the registry that report too. */
export type Tracked = GameId | "trivia";
export type Mode = "daily" | "practice" | "endless" | "archive";
type Props = Record<string, string | number | boolean>;

const DAY_MS = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY_MS);

/** How long this device has played: days with a daily game finished. */
export function playerBucket(days: number): string {
  return days <= 1 ? "new" : days <= 3 ? "2-3 days" : days <= 7 ? "4-7 days" : days <= 30 ? "8-30 days" : "31+ days";
}

/** When this device last finished a daily game, before today. */
export function lastPlayedBucket(days: Iterable<string>, today = dateKey()): string {
  let last: string | null = null;
  for (const d of days) if (d < today && (last === null || d > last)) last = d;
  if (last === null) return "never";
  const gap = daysBetween(last, today);
  return gap === 1 ? "yesterday" : gap <= 7 ? "2-7 days ago" : "8+ days ago";
}

function player(): string {
  return playerBucket(playedDays().size);
}

let visited = false;
/** Once per page load: the retention signal (a "yesterday" visit is a day-1 return). */
export function visit() {
  if (visited) return;
  visited = true;
  const days = playedDays();
  track("Visit", { last_played: lastPlayedBucket(days.keys()), player: playerBucket(days.size) });
}

const started = new Set<string>();
/** A game was begun (once per game and mode per page load). */
export function gameStarted(game: Tracked, mode: Mode) {
  const key = `${game}:${mode}`;
  if (started.has(key)) return;
  started.add(key);
  track("Game started", { game, mode, player: player() });
}

/** A game was finished (its result saved now or in this render), so today's set counts it. */
export function gameFinished(game: Tracked, mode: Mode, result: Props = {}) {
  // a tick later: some games save their result in a state updater, which runs after the click
  setTimeout(() => {
    const { done, total } = todayProgress();
    track("Game finished", { game, mode, player: player(), today: `${done}/${total}`, ...result });
    if (mode === "daily" && done === total) track("Daily set done", { player: player() });
  }, 0);
}
