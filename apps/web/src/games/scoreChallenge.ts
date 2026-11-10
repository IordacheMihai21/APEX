import { t } from "../i18n";
import type { GameId } from "./registry";

/**
 * "Challenge a friend" for the daily games: a link to the same game with the challenger's result in it
 * (?ref=challenge-<game>&score=3%2F10). The friend lands on the game with a banner saying what to beat, and their own
 * finish card shows it again. Everyone gets the same daily round, so the score is all a challenge needs. Read once at
 * load, before the app tidies the address.
 */
export interface ScoreChallenge {
  game: string;
  value: string;
}

/** A result as the finish card shows it ("3/10", "2.314 s", "4 tries"): short, and nothing that could carry markup. */
const VALUE = /^[\p{L}\p{N} .,:/%+'’-]{1,20}$/u;

export function parseScoreChallenge(search: string): ScoreChallenge | null {
  const q = new URLSearchParams(search);
  const ref = q.get("ref") ?? "";
  const value = (q.get("score") ?? "").trim();
  const m = /^challenge-([a-z-]{2,32})$/.exec(ref);
  if (!m || !VALUE.test(value)) return null;
  return { game: m[1], value };
}

const ARRIVED = typeof location !== "undefined" ? parseScoreChallenge(location.search) : null;
let dismissed = false;

/** The friend's result, when this visit came from a challenge for this game. */
export const challengeFor = (game: GameId | string): string | null => (ARRIVED && ARRIVED.game === game ? ARRIVED.value : null);
export const arrivedChallenge = () => (dismissed ? null : ARRIVED);
export const dismissChallenge = () => {
  dismissed = true;
};

/** What "Challenge a friend" sends: the result in a sentence, then the link straight into the game. */
export function challengeMessage(game: GameId, path: string, title: string, value: string, origin = typeof location !== "undefined" ? location.origin : "https://lapdle.com"): string {
  const link = `${origin}${path}?ref=challenge-${game}&score=${encodeURIComponent(value)}`;
  return `${t("I got {value} on {game}. Can you beat it?", { value, game: title })}\n${link}`;
}
