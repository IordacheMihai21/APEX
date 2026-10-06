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
import { STOPS_PER_DAY, brakingDone, brakingDoneDays, brakingScore, dayStops } from "../modes/braking";
import { CIRCUITS, circuitSlug } from "../modes/circuits";
import { ORDER_TRIES, orderDoneDays, orderOver, orderSolved, orderTries } from "../modes/order";

export type GameId = "quali" | "mystery" | "pit-stop" | "higher-lower" | "braking-point" | "corner-order" | "reaction";

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
  /** the full How to play page: what it is, how it's scored, tips */
  guide: { intro: string; scoring: string; tips: string[] };
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
    howTo: {
      steps: [
        "Each day brings one real circuit, seen from above. Pick a line for each corner: early apex, classic or late apex, or fine-tune every point yourself.",
        "Press Lights out. The car drives your line with real physics: braking, turning in and accelerating as hard as your line allows.",
        "Every corner gets a colour for the time it lost to the perfect lap. Improve your line and go again: you have six laps.",
      ],
      tip: "Bronze, silver and gold are lap times. Pole is a lap with every corner purple.",
    },
    guide: {
      intro:
        "The Daily Quali is Lapdle's main game: one real circuit a day and six laps to find the fastest racing line through it. Everyone gets the same circuit and the same conditions, so every lap can be compared.",
      scoring:
        "Each corner group is graded against the perfect lap: purple within 0.05 s, green within 0.15 s, yellow within 0.4 s, red slower. Your best lap of the day earns a medal: bronze, silver or gold for the lap time, pole for a lap with every corner purple. Some days are wet, or run with low downforce: the grip changes, and so do the perfect line and the medal times.",
      tips: [
        "Slow corners reward a late apex: brake in a straight line, turn in later and get on the power early.",
        "In fast sweeps a classic line keeps the speed up; an early apex tends to run out of road on the exit.",
        "Fix the reddest corner first. The coach under your result says why it lost time.",
        "On wet days carry less speed into every corner: the grip is lower everywhere.",
      ],
    },
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
    guide: {
      intro: "Mystery circuit is a daily guessing game: name a real circuit from a few of its corners.",
      scoring:
        "You have six guesses. After each miss more of the lap is drawn, and your guess is compared with the answer on four clues: country, lap length, number of corners and the year of its first Grand Prix. Green means exact; yellow means close (the same continent, within 0.5 km, 2 corners or 10 years); the arrows point towards the answer.",
      tips: [
        "Open with a circuit whose numbers sit in the middle of the field: the arrows then tell you the most.",
        "Read the shape: long straights, hairpins and esses narrow it down quickly.",
        "Your result shares as coloured squares, without giving the answer away.",
      ],
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
    short: "Pit",
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
    guide: {
      intro: "Pit stop puts you on the wheel guns: change four tyres as fast as you can, then release the car.",
      scoring:
        "The clock runs from the moment the car stops to the release. The wheels light up one at a time: hit the key shown for each, or tap the lit tyre on a phone. A wrong key adds a time penalty, and so does releasing the car before the light turns green. Each wheel and the release are graded like sectors. The daily stop is the same for everyone and counts once a day; practice stops are unlimited.",
      tips: [
        "Look for the next wheel, not the one you just changed.",
        "On a phone, keep your thumbs close to the tyres.",
        "Wait for green: an early release is penalised.",
      ],
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
    guide: {
      intro: "Higher or lower is a quick quiz on real circuit facts.",
      scoring:
        "Each round shows one circuit's fact (lap length, corners, race laps, the year of its first Grand Prix or its 2025 pole lap) and asks how a second circuit compares. The daily ten are the same for everyone and scored out of ten: a miss costs a point, not the round. In Endless mode a single wrong call ends the run, and your longest run is kept.",
      tips: [
        "Street circuits tend to be short, with a lot of corners.",
        "The oldest venues held their first Grand Prix in 1950.",
        "Pole laps follow lap length, but not exactly: the mix of corners and straights matters too.",
      ],
    },
    today(day = dateKey()) {
      const calls = dailyCalls(day);
      if (dailyDone(calls)) return { state: "done", label: `${dailyScore(calls)}/${DAILY_CALLS}` };
      return calls.length ? { state: "playing", label: `${DAILY_CALLS - calls.length} calls left` } : { state: "new", label: "Not started" };
    },
    doneDays: dailyDoneDays,
  },
  {
    id: "braking-point",
    name: "Braking point",
    short: "Braking",
    route: "/braking-point",
    cadence: "daily",
    inDailySet: true,
    tagline: "Five big stops, brake as late as you dare",
    blurb: "Flat out down the straight, then hit the brakes for the corner. Five real stops a day; too late and you're off.",
    title: "Braking point: brake for the corner | Lapdle",
    howTo: {
      steps: [
        "The car comes down a straight flat out, towards a real corner. The boards count down the metres to it.",
        "Hit Brake (or Space) at the last moment you dare. The car then brakes as hard as the physics allows.",
        "Score on how close you got to the perfect braking point. Too early costs time; too late and you arrive too fast, or go off.",
      ],
      tip: "Five stops a day, the same for everyone, out of 500 points. Practice stops are unlimited.",
    },
    guide: {
      intro: "Braking point is a daily timing game: five of the biggest stops on real circuits, and one brake pedal.",
      scoring:
        "Each stop is scored out of 100 on how far you braked from the perfect braking point, the one the physics engine's perfect lap uses. Early costs less than late: 30 m early scores nothing, and so does 15 m late. Brake more than 20 m late, or arrive at the corner more than a quarter over its speed, and you go off the road for zero. Each stop gets a colour: purple within 2 m, green within 6 m, yellow within 12 m.",
      tips: [
        "The faster the straight, the earlier the braking point: speed takes distance to lose.",
        "Use the boards. Most big stops start between the 150 and the 100 m boards.",
        "Slow hairpins punish late braking the most: a few metres late is a lot of extra speed.",
        "Early is safer than late. A late stop can score zero.",
      ],
    },
    today(day = dateKey()) {
      const stops = dayStops(day);
      if (brakingDone(stops)) return { state: "done", label: `${brakingScore(stops)}/${STOPS_PER_DAY * 100}` };
      return stops.length ? { state: "playing", label: `${STOPS_PER_DAY - stops.length} stops left` } : { state: "new", label: "Not started" };
    },
    doneDays: brakingDoneDays,
  },
  {
    id: "corner-order",
    name: "Order the corners",
    short: "Order",
    route: "/corner-order",
    cadence: "daily",
    // a daily extra: the set stays at five, which is what the phone's Today bar holds
    inDailySet: false,
    tagline: "Six corners, put them in lap order",
    blurb: "Six corners of one circuit, shuffled. Put them in the order the car meets them, in four checks. A new circuit every day.",
    title: "Order the corners: put a circuit's corners in lap order | Lapdle",
    howTo: {
      steps: [
        "You get one circuit from above, with the start line and an arrow for the way round, and six of its corners as shuffled tiles.",
        "Tap the tiles into the slots in the order the car meets them, from the start line round the lap. The dot on a tile is where the car comes in.",
        "Check: the right slots turn green and stay. You have four checks.",
      ],
      tip: "Each tile is drawn the way it sits on the map, north up. A new circuit every day.",
    },
    guide: {
      intro: "Order the corners is a daily puzzle: put six corners of a real circuit in lap order.",
      scoring:
        "Every day brings one circuit, never the day's Daily Quali or Mystery circuit, drawn from above with its start line and direction of travel. Six of its corners are shown as tiles, each cut from the racing line and drawn the way it sits on the map. Place them in lap order and check: the right ones turn green and lock, the rest go back. You have four checks; the fewer you need, the better.",
      tips: [
        "Find the start line and follow the arrow: the first tile is the first real turn after it.",
        "Match the tiles by their shape and the way they face; the dot shows where the car enters.",
        "Lock in the corners you're sure of first: every right one narrows the rest.",
      ],
    },
    today(day = dateKey()) {
      const tries = orderTries(day);
      if (orderOver(tries)) return { state: "done", label: orderSolved(tries) ? `${tries.length}/${ORDER_TRIES}` : `X/${ORDER_TRIES}` };
      return tries.length ? { state: "playing", label: `${ORDER_TRIES - tries.length} checks left` } : { state: "new", label: "New today" };
    },
    doneDays: orderDoneDays,
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
    guide: {
      intro: "Lights out tests your reaction to the start lights.",
      scoring:
        "Five red lights come on one a second, hold for a random moment, then go out together. Hit Launch the instant they do: your time runs from lights out to your press. Pressing before they go out is a jump start, and anything under 0.1 s counts as anticipation rather than reaction. Your best time and the average of your last five are kept.",
      tips: [
        "Watch the lights, not the button.",
        "Rest your finger on the button, so only the press is left.",
        "The hold is random: counting it won't help.",
      ],
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
  records: "Lap records: the fastest Daily Quali laps | Lapdle",
  privacy: "Privacy | Lapdle",
  legal: "Legal notice and terms | Lapdle",
} as const;
export type InfoPage = keyof typeof PAGES;

/** Pre-rendered content pages (static HTML at build time, see src/ssg). */
export const CONTENT_ROUTES = ["/about", "/how-to-play", ...GAMES.map((g) => `/how-to-play/${g.id}`), "/circuits", ...CIRCUITS.map((c) => `/circuits/${circuitSlug(c.id)}`), "/trivia", ...CIRCUITS.map((c) => `/trivia/${circuitSlug(c.id)}`)];

/** Every public address of the site (the SPA serves them all from index.html). */
export const PUBLIC_ROUTES = ["/", ...GAMES.flatMap((g) => (g.route ? [g.route] : [])), "/corner", ...Object.keys(PAGES).map((p) => `/${p}`)];
