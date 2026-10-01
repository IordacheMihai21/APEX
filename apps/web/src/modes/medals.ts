import { OUTLINES } from "../game/outlines";
import type { Grade } from "./grading";

/**
 * Medals turn a lap time into a tier everyone can reach a step of (the
 * Trackmania ladder): Bronze, Silver, Gold by lap time against per-circuit
 * calibrated targets (tools/track-builder/src/build-outlines.ts), and Pole,
 * the impossible one, for a lap with every corner purple.
 */
export type Medal = "bronze" | "silver" | "gold" | "pole";

export const MEDALS: Medal[] = ["bronze", "silver", "gold", "pole"];

export const MEDAL_NAME: Record<Medal, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", pole: "Pole" };

/** Medal discs: metal tones for the three, sector purple for Pole. */
export const MEDAL_COLOR: Record<Medal, string> = { bronze: "#c8834f", silver: "#c3c8d0", gold: "#e2b13c", pole: "#a259ff" };

export const MEDAL_EMOJI: Record<Medal, string> = { bronze: "🥉", silver: "🥈", gold: "🥇", pole: "🟪" };

const rank = (m: Medal | null) => (m ? MEDALS.indexOf(m) : -1);

export function better(a: Medal | null, b: Medal | null): Medal | null {
  return rank(a) >= rank(b) ? a : b;
}

/** Lap times for Bronze, Silver and Gold on this circuit (null for an unknown track). */
export function medalTimes(trackId: string): Record<Exclude<Medal, "pole">, number> | null {
  return OUTLINES[trackId]?.medals ?? null;
}

export function medalFor(trackId: string, lapTimeMs: number, grades: Grade[]): Medal | null {
  if (grades.length > 0 && grades.every((g) => g === "purple")) return "pole";
  const t = medalTimes(trackId);
  if (!t) return null;
  if (lapTimeMs <= t.gold) return "gold";
  if (lapTimeMs <= t.silver) return "silver";
  if (lapTimeMs <= t.bronze) return "bronze";
  return null;
}

/** The next tier above `current` and the time it needs (Pole has no time: it needs every corner purple). */
export function nextMedal(trackId: string, current: Medal | null): { medal: Medal; ms: number | null } | null {
  const t = medalTimes(trackId);
  const next = MEDALS[rank(current) + 1];
  if (!next || !t) return null;
  return { medal: next, ms: next === "pole" ? null : t[next] };
}

/**
 * The circuit's real 2025 pole lap (a time only, no names). `beatable` is
 * false where real cars are quicker than our perfect lap or need Gold-level
 * precision anyway: there it is shown as a fact, not offered as a goal.
 */
export function realPole(trackId: string): { ms: number; beatable: boolean } | null {
  const o = OUTLINES[trackId];
  if (!o?.realPoleMs) return null;
  return { ms: o.realPoleMs, beatable: o.realPoleMs > o.medals.gold };
}
