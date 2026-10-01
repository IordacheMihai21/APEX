/**
 * Small drawable outlines of every track for the web hub: the circuit ribbon,
 * the optimal line, corner numbers, the start line, and the optimal lap's
 * timing so a car can lap the drawing at the speeds the physics engine
 * computes, plus the medal times. Output: apps/web/src/game/outlines.ts (generated).
 *
 * Medal times are calibrated per circuit to the same driving precision, since
 * circuits differ ~3x in how much a metre of error costs: each medal is the
 * median lap of the optimal line with Gaussian error of a set size on every
 * gate the player controls (bronze 2.0 m, silver 0.75 m, gold 0.3 m). Bronze is
 * set so that choosing a good one-tap line style per corner (engine/line/styles.ts)
 * reaches it on most circuits; Silver and Gold need fine-tuning.
 * Usage: npx tsx tools/track-builder/src/build-outlines.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { APEX_FORMULA as car, type GameTrack, expandGates, prepareTrack, simulateLap, trackControls, usableHalfWidth } from "@apex/engine";

const BOX = 1000;
const LINE_POINTS = 320;
const OUTLINE_POINTS = 140;
const TIMING_KEYS = 64;
const MEDAL_SIGMA_M = { bronze: 2.0, silver: 0.75, gold: 0.3 } as const;
const MEDAL_SAMPLES = 41;

/** Median lap (ms) of the optimal line with N(0, sigma) metres added to each player gate. Deterministic per track. */
function noisyMedian(track: GameTrack, pt: ReturnType<typeof prepareTrack>, sigma: number): number {
  const ctl = trackControls(pt);
  const lim = usableHalfWidth(pt, car);
  let seed = [...track.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) & 0x7fffffff;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const times: number[] = [];
  for (let r = 0; r < MEDAL_SAMPLES; r++) {
    const z = track.optimalLine!.knotOffsets.map((v, j) => (ctl.isGate[j] ? v + gauss() * sigma : v));
    times.push(simulateLap({ track: pt, line: { knotOffsets: expandGates(pt, ctl, z, lim) } }).lapTimeMs);
  }
  return times.sort((a, b) => a - b)[(MEDAL_SAMPLES - 1) / 2];
}

const dir = resolve(import.meta.dirname, "../../../data/tracks");
const out: Record<string, unknown> = {};

for (const f of readdirSync(dir).filter((f) => f.endsWith(".v1.json"))) {
  const track: GameTrack = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
  const pt = prepareTrack(track);
  const lap = simulateLap({ track: pt, line: track.optimalLine! });
  const n = pt.n;

  // north-up box with a margin; y flipped for SVG
  const xs = [...pt.cx];
  const ys = [...pt.cy];
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const s = (BOX * 0.86) / Math.max(x1 - x0, y1 - y0);
  const ox = (BOX - (x1 - x0) * s) / 2;
  const oy = (BOX - (y1 - y0) * s) / 2;
  const P = (x: number, y: number): [number, number] => [Math.round(ox + (x - x0) * s), Math.round(oy + (y1 - y) * s)];

  const path = (count: number, at: (i: number) => [number, number]) => {
    const step = n / count;
    const pts: string[] = [];
    let last = "";
    for (let j = 0; j < count; j++) {
      const [x, y] = at(Math.floor(j * step));
      const p = `${x} ${y}`;
      if (p !== last) pts.push(p);
      last = p;
    }
    return `M${pts.join("L")}Z`;
  };

  const centre = (i: number) => P(pt.cx[i], pt.cy[i]);
  const line = (i: number) => P(lap.samples.x[i], lap.samples.y[i]);

  // keyPoints (distance fraction) against keyTimes (time fraction) so the car brakes and accelerates
  const total = lap.samples.distance[n - 1];
  const totalMs = lap.samples.elapsedMs[n - 1];
  const keyTimes: number[] = [];
  const keyPoints: number[] = [];
  for (let j = 0; j <= TIMING_KEYS; j++) {
    const i = j === TIMING_KEYS ? n - 1 : Math.floor((j * n) / TIMING_KEYS);
    keyTimes.push(+(lap.samples.elapsedMs[i] / totalMs).toFixed(4));
    keyPoints.push(+(lap.samples.distance[i] / total).toFixed(4));
  }
  keyTimes[0] = 0;
  keyPoints[0] = 0;
  keyTimes[TIMING_KEYS] = 1;
  keyPoints[TIMING_KEYS] = 1;

  // one open path per corner group (the game's grading unit), timing line to timing line, on the racing line
  const corners = track.corners;
  const groups = (track.controls?.complexes ?? []).map((cx) => {
    const j0 = corners.findIndex((c) => c.name === cx.corners[0]);
    const jl = corners.findIndex((c) => c.name === cx.corners[cx.corners.length - 1]);
    const a = corners[j0].timingStartIndex;
    const b = corners[(jl + 1) % corners.length].timingStartIndex;
    const len = (b - a + n) % n || n;
    const step = Math.max(1, Math.round(n / LINE_POINTS));
    const pts: string[] = [];
    for (let o = 0; o <= len; o += step) pts.push(line((a + o) % n).join(" "));
    pts.push(line(b % n).join(" "));
    return `M${pts.join("L")}`;
  });

  // medal times, rounded up to the hundredth so the target reads cleanly
  const up = (ms: number) => Math.ceil(ms / 10) * 10;
  const medals = {
    bronze: up(noisyMedian(track, pt, MEDAL_SIGMA_M.bronze)),
    silver: up(noisyMedian(track, pt, MEDAL_SIGMA_M.silver)),
    gold: up(noisyMedian(track, pt, MEDAL_SIGMA_M.gold)),
  };

  const [sx, sy] = centre(0);
  const [tx, ty] = centre(3);
  out[track.id] = {
    width: +(track.widthMeters * s).toFixed(1),
    outline: path(OUTLINE_POINTS, centre),
    ribbon: path(LINE_POINTS, centre),
    line: path(LINE_POINTS, line),
    start: [sx, sy, +((Math.atan2(ty - sy, tx - sx) * 180) / Math.PI).toFixed(1)],
    groups,
    keyTimes: keyTimes.join(";"),
    keyPoints: keyPoints.join(";"),
    lapMs: Math.round(lap.lapTimeMs),
    lengthM: Math.round(track.lengthMeters),
    cornerCount: track.corners.length,
    medals,
  };
  console.log(`${track.id.padEnd(14)} optimal ${(lap.lapTimeMs / 1000).toFixed(3)}  bronze ${(medals.bronze / 1000).toFixed(2)}  silver ${(medals.silver / 1000).toFixed(2)}  gold ${(medals.gold / 1000).toFixed(2)}`);
}

const ts = `// Generated by tools/track-builder/src/build-outlines.ts. Do not edit.
export interface Outline {
  /** track width in drawing units (the box is ${BOX}×${BOX}) */
  width: number;
  /** coarse centreline, for thumbnails */
  outline: string;
  /** fine centreline, for the hero ribbon */
  ribbon: string;
  /** the optimal racing line */
  line: string;
  /** start line: x, y, heading in degrees */
  start: [number, number, number];
  /** one open path per corner group (controls.complexes order), along the optimal line */
  groups: string[];
  /** animateMotion timing so a car laps at the optimal lap's speeds */
  keyTimes: string;
  keyPoints: string;
  lapMs: number;
  lengthM: number;
  cornerCount: number;
  /** lap times (ms) for each medal; Pole is every corner purple */
  medals: { bronze: number; silver: number; gold: number };
}

export const OUTLINES: Record<string, Outline> = ${JSON.stringify(out)};
`;
writeFileSync(resolve(import.meta.dirname, "../../../apps/web/src/game/outlines.ts"), ts);
console.log(`wrote ${Object.keys(out).length} outlines, ${(ts.length / 1024).toFixed(1)} kB`);
