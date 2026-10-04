/**
 * Lights-out reaction test: five red lights come on one a second, hold for a
 * random 0.2–3 s, then go out together; the time from lights out to the tap is
 * the reaction. A tap before they go out is a jump start.
 */
export const LIGHT_MS = 1000;
export const HOLD_MIN_MS = 200;
export const HOLD_MAX_MS = 3000;
const KEY = "apex.reaction.v1";
const RECENT = 5;

export interface ReactionRecord {
  best: number | null;
  /** most recent first */
  recent: number[];
  attempts: number;
  jumps: number;
}

const EMPTY: ReactionRecord = { best: null, recent: [], attempts: 0, jumps: 0 };

export function loadReaction(): ReactionRecord {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { ...EMPTY };
  }
}

function save(r: ReactionRecord) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* records just won't persist */
  }
}

export function recordReaction(r: ReactionRecord, ms: number): ReactionRecord {
  const next = { ...r, best: r.best === null ? ms : Math.min(r.best, ms), recent: [ms, ...r.recent].slice(0, RECENT), attempts: r.attempts + 1 };
  save(next);
  return next;
}

export function recordJump(r: ReactionRecord): ReactionRecord {
  const next = { ...r, jumps: r.jumps + 1 };
  save(next);
  return next;
}

export function average(r: ReactionRecord): number | null {
  return r.recent.length ? r.recent.reduce((a, b) => a + b, 0) / r.recent.length : null;
}

/** A plain verdict against real reference points: F1 drivers about 0.2 s, people on average about 0.27 s. */
export function verdict(ms: number): string {
  if (ms < 100) return "Under 0.1 s: that's anticipation, not reaction.";
  if (ms < 180) return "Quicker than a typical racing driver's start.";
  if (ms < 220) return "Racing driver territory.";
  if (ms < 270) return "Quicker than the average person.";
  if (ms < 350) return "About average. The field is past you.";
  return "Still on the grid while the rest are in turn 1.";
}

export function randomHold(rand = Math.random): number {
  return HOLD_MIN_MS + rand() * (HOLD_MAX_MS - HOLD_MIN_MS);
}
