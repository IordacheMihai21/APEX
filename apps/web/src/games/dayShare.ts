/**
 * "Share your day": one text for the whole daily set, the way the daily-game
 * sites close a day. A line per game in the set, with its result where it is
 * finished, then the link (tagged ?ref=share-day). It shows at a glance that
 * Lapdle is several games, which is what brings people in from the clips.
 */
import { t } from "../i18n";
import { dailyNumber, dateKey } from "../modes/daily";
import { MEDAL_EMOJI } from "../modes/medals";
import { type GameId, todayProgress } from "./registry";

/** A mark for a finished game that has no medal. */
const DONE_MARK: Partial<Record<GameId, string>> = {
  quali: "🏁",
  mystery: "🗺️",
  "pit-stop": "🔧",
  "higher-lower": "↕️",
  "make-the-corner": "🎯",
  "braking-point": "🛑",
  "corner-order": "🔢",
  "speed-trap": "📸",
  "line-up": "🧩",
  aerial: "🛰️",
};

/** Whether the day is worth sharing as a whole: two games or more done. */
export const dayShareReady = (day = dateKey()) => todayProgress(day).done >= 2;

export function dayShareText(link: string, day = dateKey()): string {
  const { items, done, total } = todayProgress(day);
  const lines = items.map(({ game: g, status }) =>
    status.state === "done" ? `${status.medal ? MEDAL_EMOJI[status.medal] : (DONE_MARK[g.id] ?? "✅")} ${g.name}: ${status.label}` : `⬜ ${g.name}`,
  );
  return `${t("Lapdle #{n}: {done}/{total} dailies", { n: dailyNumber(day), done, total })}\n${lines.join("\n")}\n${link}`;
}
