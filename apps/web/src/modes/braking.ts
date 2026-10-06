import { load, save, seeded } from "./circuits";
import { dailyNumber, dateKey } from "./daily";

/**
 * Braking point: the car comes down a straight flat out; hit the brake at the
 * right moment for the corner. The run replays the physics engine's perfect
 * lap (game/braking.json, from tools/track-builder/src/build-braking.ts): the
 * speed on the run-up, and the engine's own braking curve from wherever the
 * player braked. Brake early and the car crawls to the corner at its slowest
 * speed; brake late and it arrives too fast, and too fast is off the road.
 *
 * Positions are metres along the racing line, 0 at the slowest point of the
 * corner, negative before it.
 */
export interface Zone {
  track: string;
  /** index of the corner group (controls.complexes) the stop belongs to */
  complex: number;
  group: string | null;
  direction: "left" | "right";
  /** the zone's place in the lap, metres from the line, and its number among this circuit's stops */
  lapM: number;
  order: number;
  /** metres from the slowest point back to where the perfect lap brakes */
  brakeM: number;
  /** start of the run-up (negative) */
  from: number;
  /** index in speeds where the brakes go on */
  brakeIndex: number;
  speedStep: number;
  /** km/h along the line from `from` to 0, every speedStep metres */
  speeds: number[];
  kappaStep: number;
  /** curvature ×1e5 (1/m, + = left) from `from` to 160 m past the corner */
  kappa: number[];
  /** the corner and the braking point on the circuit map (outline coordinates) */
  map: [number, number];
  mapFrom: [number, number];
}

export const STOPS_PER_DAY = 5;
/** Arriving more than this over the corner's speed (a share of it, and at least OFF_KMH) puts the car off the road; so does braking more than OFF_LATE_M late. */
export const OFF_RATIO = 0.25;
export const OFF_KMH = 25;
export const OFF_LATE_M = 20;

const KMH = 1 / 3.6;
const vAt = (z: Zone, i: number) => z.speeds[Math.max(0, Math.min(z.speeds.length - 1, i))] * KMH;

/** Entry speed, corner speed (m/s) and where the perfect lap brakes. */
export const entrySpeed = (z: Zone) => vAt(z, z.brakeIndex);
export const cornerSpeed = (z: Zone) => vAt(z, z.speeds.length - 1);
export const idealBrake = (z: Zone) => -z.brakeM;

/** The run-up speed at s, flat out: the engine's trace, and past the perfect braking point still accelerating a little. */
export function approachSpeed(z: Zone, s: number): number {
  const ideal = idealBrake(z);
  if (s >= ideal) {
    // keep the last metres' acceleration, fading (the car is near top speed)
    const v0 = entrySpeed(z);
    const prev = vAt(z, z.brakeIndex - 1);
    const a = Math.max(0, (v0 * v0 - prev * prev) / (2 * z.speedStep));
    return Math.sqrt(v0 * v0 + 2 * a * 0.5 * (s - ideal));
  }
  const f = (s - z.from) / z.speedStep;
  const i = Math.floor(f);
  return vAt(z, i) + (vAt(z, i + 1) - vAt(z, i)) * (f - i);
}

/**
 * The engine's braking curve as distance-to-go: how far before the corner the
 * car must be doing `v` to make it at the corner's speed. Above the entry
 * speed it is extended with the first metres' deceleration.
 */
export function brakingDistance(z: Zone, v: number): number {
  const end = z.speeds.length - 1;
  const v0 = entrySpeed(z);
  if (v >= v0) {
    const v1 = vAt(z, z.brakeIndex + 1);
    const a = (v0 * v0 - v1 * v1) / (2 * z.speedStep);
    return z.brakeM + (v * v - v0 * v0) / (2 * a);
  }
  if (v <= cornerSpeed(z)) return 0;
  for (let i = z.brakeIndex; i < end; i++) {
    const a = vAt(z, i);
    const b = vAt(z, i + 1);
    if (v <= a && v >= b) {
      const t = a === b ? 0 : (a - v) / (a - b);
      return -(z.from + (i + t) * z.speedStep);
    }
  }
  return 0;
}

/** The inverse: the speed with `d` metres of braking left (the corner's speed at 0). */
export function speedWithLeft(z: Zone, d: number): number {
  if (d <= 0) return cornerSpeed(z);
  if (d >= z.brakeM) {
    const v0 = entrySpeed(z);
    const v1 = vAt(z, z.brakeIndex + 1);
    const a = (v0 * v0 - v1 * v1) / (2 * z.speedStep);
    return Math.sqrt(v0 * v0 + 2 * a * (d - z.brakeM));
  }
  const f = (-d - z.from) / z.speedStep;
  const i = Math.floor(f);
  return vAt(z, i) + (vAt(z, i + 1) - vAt(z, i)) * (f - i);
}

/**
 * The car's speed at s, having braked at `brakeAt` (null: not yet). After
 * braking it rides the braking curve from the speed it had, down to the
 * corner's speed, and holds that; past the corner it keeps what it has.
 */
export function speedAt(z: Zone, s: number, brakeAt: number | null): number {
  if (brakeAt === null || s < brakeAt) return approachSpeed(z, s);
  const u = approachSpeed(z, brakeAt);
  const left = brakingDistance(z, u) - (Math.min(s, 0) - brakeAt);
  return speedWithLeft(z, left);
}

export interface StopResult {
  /** metres from the perfect braking point: + late, − early; null if the car never braked */
  metres: number | null;
  /** speed at the corner, m/s */
  cornerV: number;
  off: boolean;
  /** time lost to the perfect stop (s), braking early; 0 when late */
  lost: number;
  points: number;
}

/** Score a stop braked at `brakeAt` (or never). */
export function scoreStop(z: Zone, brakeAt: number | null): StopResult {
  if (brakeAt === null || brakeAt >= 0) return { metres: null, cornerV: approachSpeed(z, 0), off: true, lost: 0, points: 0 };
  const metres = brakeAt - idealBrake(z);
  const cornerV = speedAt(z, 0, brakeAt);
  const off = metres > OFF_LATE_M || cornerV - cornerSpeed(z) > Math.max(cornerSpeed(z) * OFF_RATIO, OFF_KMH / 3.6);
  let lost = 0;
  if (metres < 0) {
    // time over the run from the earlier braking point to the corner, against the perfect stop
    const step = 0.5;
    for (let s = brakeAt; s < 0; s += step) lost += step / Math.max(1, speedAt(z, s, brakeAt)) - step / Math.max(1, speedAt(z, s, idealBrake(z)));
  }
  const e = Math.abs(metres);
  const points = off ? 0 : Math.round(100 * Math.max(0, 1 - e / (metres < 0 ? 30 : 15)));
  return { metres: Math.round(metres * 10) / 10, cornerV, off, lost, points };
}

export type Grade = "purple" | "green" | "yellow" | "red";
/** The colour of a stop, as the Quali colours corners. */
export function grade(r: Pick<StopResult, "metres" | "off">): Grade {
  if (r.off || r.metres === null) return "red";
  const e = Math.abs(r.metres);
  return e <= 2 ? "purple" : e <= 6 ? "green" : e <= 12 ? "yellow" : "red";
}

/** "3.4 m early", "1.2 m late", "Spot on" */
export function describe(r: Pick<StopResult, "metres" | "off">): string {
  if (r.metres === null) return "No brakes";
  const e = Math.abs(r.metres);
  if (e < 0.5) return "Spot on";
  return `${e.toFixed(1)} m ${r.metres < 0 ? "early" : "late"}`;
}

/** Today's stops: indexes into the zone list, each from a different circuit, the same for everyone. */
export function dailyStops(zones: Pick<Zone, "track">[], key = dateKey()): number[] {
  const rand = seeded(dailyNumber(key) * 7_919 + 5);
  const tracks = [...new Set(zones.map((z) => z.track))].sort();
  for (let i = tracks.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
  }
  return tracks.slice(0, STOPS_PER_DAY).map((t) => {
    const of = zones.map((z, i) => [z, i] as const).filter(([z]) => z.track === t);
    return of[Math.floor(rand() * of.length)][1];
  });
}

const KEY = "apex.braking.v1";
export interface StopRecord {
  metres: number | null;
  off: boolean;
  points: number;
}
export interface BrakingRecord {
  days: Record<string, StopRecord[]>;
  /** practice stops braked, all time */
  practice: number;
}
export const loadBraking = () => load<BrakingRecord>(KEY, { days: {}, practice: 0 });

export const dayStops = (key = dateKey()) => loadBraking().days[key] ?? [];
export const brakingDone = (stops: StopRecord[]) => stops.length >= STOPS_PER_DAY;
export const brakingScore = (stops: StopRecord[]) => stops.reduce((a, s) => a + s.points, 0);

/** Record one of today's stops; ignored once all are in. */
export function recordStop(r: StopResult, key = dateKey()): StopRecord[] {
  const rec = loadBraking();
  const stops = rec.days[key] ?? [];
  if (brakingDone(stops)) return stops;
  const next = [...stops, { metres: r.metres, off: r.off, points: r.points }];
  save(KEY, { ...rec, days: { ...rec.days, [key]: next } });
  return next;
}

export function recordPractice() {
  const rec = loadBraking();
  save(KEY, { ...rec, practice: rec.practice + 1 });
}

export const brakingDoneDays = () =>
  Object.entries(loadBraking().days)
    .filter(([, s]) => brakingDone(s))
    .map(([k]) => k);

export function brakingStats() {
  const days = loadBraking().days;
  const scores = brakingDoneDays().map((k) => brakingScore(days[k]));
  return {
    played: scores.length,
    best: scores.length ? Math.max(...scores) : null,
    average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
  };
}

const SQUARE: Record<Grade, string> = { purple: "🟪", green: "🟩", yellow: "🟨", red: "🟥" };
export function brakingShare(stops: StopRecord[], link: string, key = dateKey()): string {
  return `Lapdle Braking point #${dailyNumber(key)} ${brakingScore(stops)}/${STOPS_PER_DAY * 100}\n${stops.map((s) => SQUARE[grade(s)]).join("")}\n${link}`;
}

export function verdict(score: number): string {
  return score >= 450 ? "Late-braking hero" : score >= 350 ? "Right on the boards" : score >= 200 ? "Solid stops" : "Brakes on fire";
}
