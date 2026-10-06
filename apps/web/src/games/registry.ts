/**
 * Every game on Lapdle, declared once. The hub, the "Today" bar, the finish
 * card's "Play next", the footer, the how-to cards, page titles and the
 * routing all read from here, so a new game is a folder plus one entry below
 * (and its route in public/_redirects and public/sitemap.xml; a test checks).
 *
 * This file holds identity, copy and today's status only. The games' own UI
 * is loaded lazily by the app; their logic lives in src/modes.
 */
import { DAILY_LAPS, allDailies, bestMedal, dateKey, loadDaily } from "../modes/daily";
import { type Medal, MEDAL_NAME } from "../modes/medals";
import { MYSTERY_TRIES, isOver, isSolved, loadMystery, mysteryDoneDays } from "../modes/mystery";
import { loadPitStop, secs, todaysStop } from "../modes/pitstop";
import { DAILY_CALLS, dailyCalls, dailyDone, dailyDoneDays, dailyScore } from "../modes/higherLower";
import { loadReaction } from "../modes/reaction";

export type GameId = "quali" | "mystery" | "pit-stop" | "higher-lower" | "reaction";

/** Where a game stands today, for the "Today" bar and the hub. */
export interface TodayStatus {
  state: "new" | "playing" | "done";
  /** short, for the Today bar: "Silver", "2 guesses left", "2.314 s" */
  label: string;
  medal?: Medal | null;
}

export interface GameDef {
  id: GameId;
  name: string;
  /** a shorter name where space is tight (the Today bar on phones) */
  short: string;
  /** the page's own address; the Daily Quali opens from the hub for now */
  route: string | null;
  /** daily: a new round every day; endless: play as often as you like */
  cadence: "daily" | "endless";
  /** counts towards "x of y played today" */
  inDailySet: boolean;
  /** one line, for "Play next" lists */
  tagline: string;
  /** two lines, for the hub card */
  blurb: string;
  /** the page title (also the search result title) */
  title: string;
  howTo?: { steps: string[]; tip: string };
  today(day?: string): TodayStatus;
  /** for daily games: every day the round was finished, read in one go (streaks scan the whole history) */
  doneDays?(): string[];
}

export const GAMES: GameDef[] = [
  {
    id: "quali",
    name: "Daily Quali",
    short: "Quali",
    route: null,
    cadence: "daily",
    inDailySet: true,
    tagline: "Today's circuit, six laps for a medal",
    blurb: "One real circuit a day. Set your line through every corner, drive it, and chase the perfect lap in six laps.",
    title: "Lapdle – Daily Racing Line Challenge",
    today(day = dateKey()) {
      const d = loadDaily(day);
      const medal = bestMedal(d);
      if (d.status !== "playing") return { state: "done", label: d.status === "won" ? "Pole" : medal ? MEDAL_NAME[medal] : "No medal", medal };
      return d.laps.length ? { state: "playing", label: `${DAILY_LAPS - d.laps.length} laps left`, medal } : { state: "new", label: "Not started" };
    },
    doneDays: () => allDailies().filter((d) => d.status !== "playing").map((d) => d.key),
  },
  {
    id: "mystery",
    name: "Mystery circuit",
    short: "Mystery",
    route: "/mystery",
    cadence: "daily",
    inDailySet: true,
    tagline: "Name the circuit from a few corners",
    blurb: "Name the circuit from a few corners. Six guesses, a new one every day.",
    title: "Mystery circuit: guess the racing circuit | Lapdle",
    howTo: {
      steps: [
        "A few corners of a real circuit are drawn. Pick the circuit you think it is.",
        "Every miss draws more of the lap and scores your guess: country, length, corners and first Grand Prix.",
        "Green is exact, yellow is close, and the arrows say whether the answer is higher or lower.",
      ],
      tip: "Six guesses. A new circuit every day.",
    },
    today(day = dateKey()) {
      const m = loadMystery(day);
      if (isOver(m)) return { state: "done", label: isSolved(m) ? `Solved in ${m.guesses.length}` : "Missed" };
      return m.guesses.length ? { state: "playing", label: `${MYSTERY_TRIES - m.guesses.length} guesses left` } : { state: "new", label: "Not started" };
    },
    doneDays: mysteryDoneDays,
  },
  {
    id: "pit-stop",
    name: "Pit stop",
    short: "Pit stop",
    route: "/pit-stop",
    cadence: "daily",
    inDailySet: true,
    tagline: "Four wheels, then go on green",
    blurb: "Four wheels light up one at a time. Change them, then go on green. The record is 1.80 s.",
    title: "Pit stop: change four tyres, go on green | Lapdle",
    howTo: {
      steps: [
        "Call the car in: press Space, or tap the pit box.",
        "The wheels light up one at a time. Hit the key shown beside it, or tap the lit tyre on a phone. A wrong key costs time.",
        "When the light turns green, release the car: Space, or tap. Too early is a penalty.",
      ],
      tip: "The daily stop counts once a day. Practice as often as you like.",
    },
    today(day = dateKey()) {
      const stop = todaysStop(loadPitStop(), day);
      return stop ? { state: "done", label: `${secs(stop.totalMs)} s` } : { state: "new", label: "Not started" };
    },
    doneDays: () => Object.keys(loadPitStop().days),
  },
  {
    id: "higher-lower",
    name: "Higher or lower",
    short: "Hi-Lo",
    route: "/higher-lower",
    cadence: "daily",
    inDailySet: true,
    tagline: "Ten calls on real circuit facts",
    blurb: "Longer lap, more corners, earlier Grand Prix? Today's ten calls are the same for everyone. Endless runs too.",
    title: "Higher or lower: racing circuit facts | Lapdle",
    howTo: {
      steps: [
        "Two circuits and one real fact: length, corners, race laps, first Grand Prix or the pole time.",
        "Call the second circuit against the first: longer or shorter, more or fewer, earlier or later, quicker or slower.",
        "The daily ten is the same for everyone and a miss costs a point. In Endless, one wrong call ends the run.",
      ],
      tip: "Arrow keys work too. The daily ten resets at midnight.",
    },
    today(day = dateKey()) {
      const calls = dailyCalls(day);
      if (dailyDone(calls)) return { state: "done", label: `${dailyScore(calls)}/${DAILY_CALLS}` };
      return calls.length ? { state: "playing", label: `${DAILY_CALLS - calls.length} calls left` } : { state: "new", label: "Not started" };
    },
    doneDays: dailyDoneDays,
  },
  {
    id: "reaction",
    name: "Lights out",
    short: "Lights out",
    route: "/reaction",
    cadence: "endless",
    inDailySet: false,
    tagline: "Five lights, one tap",
    blurb: "How fast are you off the line? Racing drivers react in about 0.2 s.",
    title: "Lights out: start-light reaction test | Lapdle",
    howTo: {
      steps: [
        "Press Start. The five red lights come on, one a second, then hold for a moment.",
        "The instant they all go out, hit Launch. Space works too.",
        "Moving before the lights go out is a jump start.",
      ],
      tip: "Racing drivers react in about 0.2 s. Most people take about 0.27 s.",
    },
    today() {
      const r = loadReaction();
      return { state: "new", label: r.best !== null ? `Best ${(r.best / 1000).toFixed(3)} s` : "Five lights, one tap" };
    },
  },
];

const BY_ID = new Map(GAMES.map((g) => [g.id, g]));
export const game = (id: GameId): GameDef => BY_ID.get(id)!;

/** The games with their own page, by the page's path segment ("mystery", "pit-stop", ...). */
export const GAME_PAGES = GAMES.filter((g) => g.route).map((g) => g.route!.slice(1) as Exclude<GameId, "quali">);
export type GamePage = (typeof GAME_PAGES)[number];

/** The daily set and how much of it is done: "2 of 3 played today". */
export const DAILY_SET = GAMES.filter((g) => g.inDailySet);
export function todayProgress(day = dateKey()) {
  const status = DAILY_SET.map((g) => ({ game: g, status: g.today(day) }));
  return { items: status, done: status.filter((s) => s.status.state === "done").length, total: DAILY_SET.length };
}

/** Pages that aren't games, with their titles. */
export const PAGES = {
  archive: "Daily Quali archive: every past circuit | Lapdle",
  privacy: "Privacy | Lapdle",
  legal: "Legal notice and terms | Lapdle",
} as const;
export type InfoPage = keyof typeof PAGES;

/** Every public address of the site (the SPA serves them all from index.html). */
export const PUBLIC_ROUTES = ["/", ...GAMES.flatMap((g) => (g.route ? [g.route] : [])), "/corner", ...Object.keys(PAGES).map((p) => `/${p}`)];
