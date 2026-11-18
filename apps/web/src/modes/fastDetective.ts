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
  visual: {
    left: [number, number][]; right: [number, number][]; line: [number, number][];
    start: [number, number]; brake: [number, number]; apex: [number, number]; throttle: [number, number]; outcome: [number, number];
    replay: [number, number][];
  };
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

function caseVisual(c: CornerData, condition: Condition, brakeS: number, throttleS: number, outcomeS: number): DetectiveCase["visual"] {
  const allX = [...c.lx, ...c.rx];
  const allY = [...c.ly, ...c.ry];
  const minX = Math.min(...allX), maxX = Math.max(...allX);
  const minY = Math.min(...allY), maxY = Math.max(...allY);
  const scale = Math.min(276 / Math.max(1, maxX - minX), 166 / Math.max(1, maxY - minY));
  const insetX = (320 - (maxX - minX) * scale) / 2;
  const insetY = (210 - (maxY - minY) * scale) / 2;
  const point = (x: number, y: number): [number, number] => [Math.round((insetX + (x - minX) * scale) * 10) / 10, Math.round((insetY + (maxY - y) * scale) * 10) / 10];
  const at = (s: number): [number, number] => {
    const end = c.s.findIndex((x) => x >= s);
    const i = Math.min(c.s.length - 1, Math.max(1, end < 0 ? c.s.length - 1 : end));
    const f = Math.min(1, Math.max(0, (s - c.s[i - 1]) / (c.s[i] - c.s[i - 1] || 1)));
    return point(c.x[i - 1] + (c.x[i] - c.x[i - 1]) * f, c.y[i - 1] + (c.y[i] - c.y[i - 1]) * f);
  };
  const sample = (xs: number[], ys: number[]) => c.s.map((_, i) => i).filter((i) => i % 3 === 0 || i === c.s.length - 1).map((i) => point(xs[i], ys[i]));
  const replay = c.s.map((_, i) => i).filter((i) => i % 3 === 0 && c.s[i] < outcomeS).map((i) => point(c.x[i], c.y[i]));
  replay.push(at(outcomeS));
  return {
    left: sample(c.lx, c.ly), right: sample(c.rx, c.ry), line: sample(c.x, c.y),
    start: at(0), brake: at(brakeS), apex: at(c.s[c.conditions[condition].apex]), throttle: at(throttleS), outcome: at(outcomeS), replay,
  };
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
    visual: caseVisual(c, condition, brakeS, throttleS, run.s),
  };
}

export function gradeDetective(c: DetectiveCase, verdict: boolean, guessKmh: number): DetectiveAnswer {
  const correct = verdict === c.tookCorner;
  const proximity = Math.max(0, 300 - Math.abs(Math.round(guessKmh) - c.actualKmh) * 12);
  return { day: c.day, verdict, guessKmh: Math.round(guessKmh), actualKmh: c.actualKmh, correct, score: (correct ? 700 : 0) + proximity };
}
