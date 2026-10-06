import { CIRCUITS, type CircuitFacts, circuit, load, save, seeded } from "../modes/circuits";

/**
 * Circuit trivia: a short multiple-choice quiz per circuit, generated from the
 * same sourced facts as the games (modes/circuits.ts) and a list of the
 * circuits' best-known corner names. Deterministic per circuit, so the
 * pre-rendered page and the app ask the same questions in the same order.
 * Venue facts only: no teams, drivers or results; corners named after a
 * person or a sponsor are left out.
 */

/** Well-known corners, by the names fans use (venue names, not people or sponsors). */
export const NAMED_CORNERS: Record<string, string[]> = {
  monza: ["Prima Variante", "Lesmo", "Parabolica"],
  spa: ["La Source", "Eau Rouge", "Pouhon", "Blanchimont"],
  silverstone: ["Copse", "Maggotts", "Becketts", "Stowe"],
  suzuka: ["130R", "Spoon"],
  monaco: ["Sainte Dévote", "Casino", "Tabac", "Rascasse"],
  interlagos: ["Descida do Lago", "Ferradura", "Junção"],
  zandvoort: ["Tarzan", "Scheivlak"],
  imola: ["Tamburello", "Tosa", "Acque Minerali", "Rivazza"],
};

export interface Question {
  prompt: string;
  options: string[];
  /** index of the right option */
  answer: number;
  /** one line shown after answering */
  explain: string;
}

const km = (v: number) => `${v.toFixed(3)} km`;
const lap = (ms: number) => {
  const m = Math.floor(ms / 60000);
  return `${m}:${((ms - m * 60000) / 1000).toFixed(3).padStart(6, "0")}`;
};
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

/** Shuffle with a seeded generator (Fisher-Yates). */
function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A question from the right answer and wrong ones (distinct, at least three), options in a seeded order. */
function ask(prompt: string, right: string, wrong: string[], explain: string, rand: () => number): Question {
  const decoys = shuffle([...new Set(wrong.filter((w) => w !== right))], rand).slice(0, 3);
  if (decoys.length < 3) throw new Error(`trivia: not enough options for "${prompt}"`);
  const options = shuffle([right, ...decoys], rand);
  return { prompt, options, answer: options.indexOf(right), explain };
}

/** Numbers near `v` for when the other circuits don't offer enough distinct values. */
const near = (v: number, steps: number[]) => steps.map((s) => v + s);

export function quiz(id: string): Question[] {
  const c = circuit(id);
  const others = CIRCUITS.filter((x) => x.id !== id);
  const rand = seeded([...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 17) >>> 0);
  const pick = <K extends keyof CircuitFacts>(k: K) => others.map((x) => x[k]);
  const byLength = [...CIRCUITS].sort((a, b) => b.lengthKm - a.lengthKm);
  const qs: Question[] = [];

  qs.push(ask(`In which country is ${c.name}?`, c.country, pick("country"), `${c.name} is in ${c.country}.`, rand));

  qs.push(
    ask(
      `How long is a lap of ${c.name}?`,
      km(c.lengthKm),
      pick("lengthKm").map(km),
      `A lap is ${km(c.lengthKm)}, the ${ordinal(byLength.indexOf(c) + 1)} longest of the twelve circuits in Lapdle.`,
      rand,
    ),
  );

  qs.push(
    ask(
      `How many corners does ${c.name} have?`,
      String(c.turns),
      [...pick("turns"), ...near(c.turns, [-3, -2, 2, 3])].map(String),
      `${c.name} has ${c.turns} corners on its current layout.`,
      rand,
    ),
  );

  qs.push(
    ask(
      `In which year did ${c.name} hold its first world championship Grand Prix?`,
      String(c.firstGp),
      [...pick("firstGp"), ...near(c.firstGp, [-6, 4, 9, 14])].filter((y) => y <= 2025 && y >= 1950).map(String),
      `Its first Grand Prix was in ${c.firstGp}.`,
      rand,
    ),
  );

  qs.push(
    ask(
      `How many laps is the Grand Prix at ${c.name}?`,
      String(c.laps),
      [...pick("laps"), ...near(c.laps, [-7, -4, 5, 9])].map(String),
      `The race runs ${c.laps} laps, about ${Math.round(c.laps * c.lengthKm)} km.`,
      rand,
    ),
  );

  // longer or shorter: one circuit on the asked side, three on the other; the longest and
  // the shortest circuit are asked the other way round
  const longer = others.filter((x) => x.lengthKm > c.lengthKm);
  const shorter = others.filter((x) => x.lengthKm < c.lengthKm);
  const canLonger = longer.length >= 1 && shorter.length >= 3;
  const canShorter = shorter.length >= 1 && longer.length >= 3;
  if (canLonger || canShorter) {
    const askLonger = canLonger && (!canShorter || rand() < 0.5);
    const side = askLonger ? longer : shorter;
    const right = side[Math.floor(rand() * side.length)];
    qs.push(
      ask(
        `Which of these circuits has a ${askLonger ? "longer" : "shorter"} lap than ${c.name}?`,
        right.name,
        (askLonger ? shorter : longer).map((x) => x.name),
        `${right.name} is ${km(right.lengthKm)} against ${c.name}'s ${km(c.lengthKm)}.`,
        rand,
      ),
    );
  } else {
    const longest = longer.length === 0;
    qs.push(
      ask(
        `Which of these circuits has the ${longest ? "longest" : "shortest"} lap?`,
        c.name,
        others.map((x) => x.name),
        `${c.name}, at ${km(c.lengthKm)}, is the ${longest ? "longest" : "shortest"} lap of the twelve circuits in Lapdle.`,
        rand,
      ),
    );
  }

  const named = NAMED_CORNERS[id];
  if (named) {
    const corner = named[Math.floor(rand() * named.length)];
    const elsewhere = Object.entries(NAMED_CORNERS)
      .filter(([t]) => t !== id)
      .flatMap(([, names]) => names);
    qs.push(ask(`Which of these corners is at ${c.name}?`, corner, elsewhere, `${corner} is at ${c.name}.`, rand));
  }

  if (c.poleMs) {
    const offsets = shuffle([-2140, -1270, 1180, 2030, 3260], rand).slice(0, 3);
    qs.push(
      ask(
        `What was the pole lap at ${c.name} in 2025?`,
        lap(c.poleMs),
        offsets.map((o) => lap(c.poleMs! + o)),
        `Pole in 2025 was ${lap(c.poleMs)}. The perfect lap in Lapdle is our physics model's best, not a real-world time.`,
        rand,
      ),
    );
  }
  return qs;
}

export function verdict(score: number, total: number): string {
  const r = score / total;
  return r === 1 ? "Full marks" : r >= 0.75 ? "Paddock regular" : r >= 0.5 ? "Getting there" : "Back to the guide";
}

const KEY = "apex.trivia.v1";
interface TriviaRecord {
  best: Record<string, number>;
}
export const triviaBest = (id: string): number | null => load<TriviaRecord>(KEY, { best: {} }).best[id] ?? null;

export function recordQuiz(id: string, score: number) {
  const rec = load<TriviaRecord>(KEY, { best: {} });
  if ((rec.best[id] ?? -1) >= score) return;
  save(KEY, { best: { ...rec.best, [id]: score } });
}
