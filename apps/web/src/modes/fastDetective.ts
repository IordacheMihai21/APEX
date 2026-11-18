import type { Condition } from "@apex/engine";
import type { CornerData } from "./makeCorner";
import { CornerRun, DT, idealCalls } from "./makeCorner";
import { CORNERS, cornerLabel } from "./makeCornerDay";
import { dateKey, dailyNumber } from "./daily";
import { seeded } from "./circuits";

const KEY = "apex.fast-detective.v1";
export interface DetectiveAnswer { day: string; verdict: boolean; guessKmh: number; actualKmh: number; correct: boolean; score: number }
export interface DetectiveCase {
  day: string; cornerId: string; corner: string; circuit: string; condition: Condition;
  entryKmh: number; brakeBeforeM: number; carryKmh: number; throttleAfterM: number;
  tookCorner: boolean; actualKmh: number; offAtM: number | null;
}

const files = import.meta.glob<CornerData>("../game/corners/*-*.json", { import: "default" });

export function detectiveAnswer(day = dateKey()): DetectiveAnswer | null {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, DetectiveAnswer>)[day] ?? null; }
  catch { return null; }
}

export function saveDetective(answer: DetectiveAnswer) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, DetectiveAnswer>;
    all[answer.day] = answer;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* the result remains visible for this visit */ }
}

export function detectiveCaseId(day = dateKey()) {
  return CORNERS[(dailyNumber(day) * 17 + 7) % CORNERS.length];
}

export async function buildDetectiveCase(day = dateKey()): Promise<DetectiveCase> {
  const entry = detectiveCaseId(day);
  const c = await files[`../game/corners/${entry.id}.json`]();
  const rand = seeded(dailyNumber(day) * 4051 + 31);
  const condition: Condition = rand() < 0.22 ? "wet" : "dry";
  const ideal = idealCalls(c, condition);
  const brakeS = Math.max(2, ideal.brakeS + [-17, -8, 1, 12, 20][Math.floor(rand() * 5)]);
  const carry = Math.max(8, ideal.minSpeed + [-3, -1, 0.5, 2, 4][Math.floor(rand() * 5)]);
  const throttleS = Math.max(brakeS + 1, ideal.throttleS + [-18, -8, 0, 7, 16][Math.floor(rand() * 5)]);
  const run = new CornerRun(c, condition);
  let braked = false, released = false, powered = false;
  for (let i = 0; i < 12000 && !run.outcome; i++) {
    if (!braked && run.s >= brakeS) { run.press(true); braked = true; }
    if (braked && !released && run.v <= carry) { run.press(false); released = true; }
    if (released && !powered && run.s >= throttleS) { run.press(true); powered = true; }
    run.advance(DT);
  }
  const apexS = c.s[c.conditions[condition].apex];
  const label = cornerLabel(entry);
  return {
    day, cornerId: entry.id, corner: label.corner, circuit: label.circuit, condition,
    entryKmh: Math.round(c.conditions[condition].speed[0] * 3.6),
    brakeBeforeM: Math.round(apexS - brakeS), carryKmh: Math.round(carry * 3.6),
    throttleAfterM: Math.round(throttleS - apexS), tookCorner: run.outcome === "done",
    actualKmh: Math.round((Number.isFinite(run.minV) ? run.minV : run.v) * 3.6),
    offAtM: run.outcome === "done" ? null : Math.round(run.s - apexS),
  };
}

export function gradeDetective(c: DetectiveCase, verdict: boolean, guessKmh: number): DetectiveAnswer {
  const correct = verdict === c.tookCorner;
  const proximity = Math.max(0, 300 - Math.abs(Math.round(guessKmh) - c.actualKmh) * 12);
  return { day: c.day, verdict, guessKmh: Math.round(guessKmh), actualKmh: c.actualKmh, correct, score: (correct ? 700 : 0) + proximity };
}
