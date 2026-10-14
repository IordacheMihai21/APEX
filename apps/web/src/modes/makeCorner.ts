import { CONDITION_CARS, type Condition, carConstants, cornerSpeedLimit, gripAt } from "@apex/engine";
import { MAX_POINTS } from "./makeCornerDay";

export { MAX_POINTS };

/**
 * Make the corner: one famous corner, driven on the perfect line with three
 * calls. Hold (Space, or a finger on the screen) to brake: where you press is
 * your braking point. Let go and the brakes come off: the speed you let go at
 * is the speed you carry through the corner. Press again for full throttle:
 * the exit. Too fast anywhere and the car runs wide, off the road; hold the
 * brake until the car stops and the run is over too.
 *
 * The car is the physics engine's car on the corner's perfect line
 * (game/corners/<id>.json, from tools/track-builder/src/build-corners.ts), with
 * the engine's grip, braking and traction: tyre force shared between braking
 * or accelerating and turning (the friction circle), downforce growing with
 * speed, drag and a power limit. It steps in fixed time steps, so a run is
 * the same on every device, and the reference is this same car driven with
 * the ideal calls, so a perfect run scores the maximum.
 */

export interface CornerData {
  id: string;
  trackId: string;
  complex: number;
  name: string;
  direction: "left" | "right" | "mixed";
  /** the dry apex on the circuit (track metres): the stretch's coordinates are relative to it */
  origin: [number, number];
  /** metres along the line from the start of the run-up, one per point */
  s: number[];
  /** the line and both track edges, metres, origin at the dry apex */
  x: number[];
  y: number[];
  lx: number[];
  ly: number[];
  rx: number[];
  ry: number[];
  conditions: Record<Condition, { kappa: number[]; speed: number[]; brake: number; apex: number }>;
}

export type Phase = "approach" | "braking" | "rolling" | "throttle";
export type Outcome = "done" | "off" | "stopped";

/** Fixed time step (s). */
export const DT = 1 / 240;
/** Below this the car has stopped (m/s, about 15 km/h): the run is over, zero points. */
export const STOP_SPEED = 4.2;
/** How far over the curve's speed (m/s, about 2 km/h) the tyres still hold, braking or rolling. */
const GRIP_MARGIN = 0.5;
/** On the throttle, too early: once the car has had to give back this much speed in all (m/s) it runs wide. */
const WIDE_LIMIT = 2.5;
/** Lifting for the kinks on the run-up is fine; having to give back this much speed in all (m/s) means the brakes never came on in time. */
const LIFT_LIMIT = 6;
/** Running wide only counts in the corner itself: up to this far past the ideal throttle point (m); further on the driver lifts for the kinks. */
const WIDE_ZONE_M = 60;
/** Points lost per second slower than the perfect run. */
const POINTS_PER_SECOND = 450;

/** The ideal calls for a corner in a condition: where to brake, the speed to carry, where to get on the throttle. */
export interface IdealCalls {
  brakeS: number;
  minSpeed: number;
  /** the perfect lap is at its slowest from releaseS to throttleS (one point for a hairpin, an arc for a long corner) */
  releaseS: number;
  throttleS: number;
}

export function idealCalls(c: CornerData, condition: Condition): IdealCalls {
  const k = c.conditions[condition];
  const v = k.speed;
  const min = v[k.apex];
  // the slowest stretch: every point within 0.05 m/s of the slowest, around the apex
  let a = k.apex;
  let b = k.apex;
  while (a > 0 && v[a - 1] < min + 0.05) a--;
  while (b < v.length - 1 && v[b + 1] < min + 0.05) b++;
  return { brakeS: c.s[k.brake], minSpeed: min, releaseS: c.s[a], throttleS: c.s[b] };
}

/** One run through a corner: step it with whether the button is down, read where the car is. */
export class CornerRun {
  readonly c: CornerData;
  readonly condition: Condition;
  private readonly cc;
  private readonly kappa: number[];
  /** distance along the line (m), speed (m/s), time (s) */
  s = 0;
  v: number;
  t = 0;
  phase: Phase = "approach";
  outcome: Outcome | null = null;
  /** where each call was made (m along the line), and the speed when the brakes came off */
  brakeS: number | null = null;
  releaseS: number | null = null;
  releaseV: number | null = null;
  throttleS: number | null = null;
  /** the slowest the car went once braking, and how close to the grip limit it is (0..1+, for the HUD and tyre squeal) */
  minV: number;
  load = 0;
  /** speed the car has had to give back on the throttle, too early (m/s) */
  wide = 0;
  /** speed given back lifting on the run-up (m/s) */
  lift = 0;
  private down = false;
  private i = 0;
  private readonly wideUntil: number;
  private readonly idealBrakeS: number;
  private readonly speedRef: number[];

  constructor(c: CornerData, condition: Condition = "dry") {
    this.c = c;
    this.condition = condition;
    this.cc = carConstants(CONDITION_CARS[condition]);
    this.kappa = c.conditions[condition].kappa;
    this.v = c.conditions[condition].speed[0];
    this.minV = Infinity;
    const ideal = idealCalls(c, condition);
    this.wideUntil = ideal.throttleS + WIDE_ZONE_M;
    this.idealBrakeS = ideal.brakeS;
    this.speedRef = c.conditions[condition].speed;
  }

  /** The perfect lap's speed at s, linear between points (call after kappaAt, which places the index). */
  private refSpeedAt(s: number): number {
    const { s: S } = this.c;
    const f = Math.min(1, Math.max(0, (s - S[this.i]) / (S[this.i + 1] - S[this.i] || 1)));
    return this.speedRef[this.i] + (this.speedRef[this.i + 1] - this.speedRef[this.i]) * f;
  }

  get length() {
    return this.c.s[this.c.s.length - 1];
  }

  /** Curvature at the car (1/m), linear between points. */
  private kappaAt(s: number): number {
    const { s: S } = this.c;
    while (this.i < S.length - 2 && S[this.i + 1] <= s) this.i++;
    while (this.i > 0 && S[this.i] > s) this.i--;
    const f = (s - S[this.i]) / (S[this.i + 1] - S[this.i] || 1);
    return this.kappa[this.i] + (this.kappa[this.i + 1] - this.kappa[this.i]) * Math.min(1, Math.max(0, f));
  }

  /** The button: down brakes (the first time) or opens the throttle (after the brakes came off). */
  press(down: boolean) {
    if (this.outcome || down === this.down) return;
    this.down = down;
    if (down && this.phase === "approach") {
      this.phase = "braking";
      this.brakeS = this.s;
    } else if (!down && this.phase === "braking") {
      this.phase = "rolling";
      this.releaseS = this.s;
      this.releaseV = this.v;
    } else if (down && this.phase === "rolling") {
      this.phase = "throttle";
      this.throttleS = this.s;
    }
  }

  /** Advance by `seconds`, in fixed steps. */
  advance(seconds: number) {
    const steps = Math.max(0, Math.round(seconds / DT));
    for (let n = 0; n < steps && !this.outcome; n++) this.step();
  }

  private step() {
    const { cc } = this;
    const k = this.kappaAt(this.s);
    const v = this.v;
    this.load = (v * v * Math.abs(k)) / gripAt(cc, v);
    const limit = cornerSpeedLimit(cc, k);
    if (this.phase === "approach" && this.s < this.idealBrakeS) {
      // the run-up (often out of the corner before) is driven as the perfect lap drives it
      this.v = Math.min(v, this.refSpeedAt(this.s));
    } else if (v > limit) {
      if (this.phase === "approach") {
        // flat out down the run-up, the driver lifts for the kinks; lifting for the corner itself means no braking: off
        this.lift += v - limit;
        this.v = limit;
        if (this.lift > LIFT_LIMIT) {
          this.outcome = "off";
          return;
        }
      } else if (this.phase === "throttle" && this.s > this.wideUntil) {
        // out of the corner: the driver lifts for the kinks
        this.v = limit;
      } else if (this.phase === "throttle") {
        // on the power too soon: the car pushes wide, and too much of it is off the road
        this.wide += v - limit;
        this.v = limit;
        if (this.wide > WIDE_LIMIT) {
          this.outcome = "off";
          return;
        }
      } else if (v > limit + GRIP_MARGIN) {
        // braking too late, or the brakes off too soon: too fast for the corner
        this.outcome = "off";
        return;
      }
    }
    const u = this.v;
    const r = (u * u * Math.abs(k)) / gripAt(cc, u);
    const remaining = r >= 1 ? 0 : gripAt(cc, u) * Math.sqrt(1 - r * r);
    const drag = cc.kDrag * u * u;
    let a: number;
    if (this.phase === "braking") a = -(remaining + drag);
    else if (this.phase === "rolling") a = 0; // a whiff of throttle holds the speed
    else a = Math.min(remaining, cc.powerPerMass / (u > 1 ? u : 1)) - drag; // flat out, as much as the tyres take
    this.v = Math.max(0, u + a * DT);
    this.s += ((u + this.v) / 2) * DT;
    this.t += DT;
    if (this.phase !== "approach" && this.v < this.minV) this.minV = this.v;
    if (this.v < STOP_SPEED) this.outcome = "stopped";
    else if (this.s >= this.length) this.outcome = "done";
  }

  /** Where the car is: position (m) and heading (radians), on the line. */
  pose(): { x: number; y: number; heading: number } {
    const { s: S, x, y } = this.c;
    let i = 0;
    while (i < S.length - 2 && S[i + 1] <= this.s) i++;
    const f = Math.min(1, Math.max(0, (this.s - S[i]) / (S[i + 1] - S[i] || 1)));
    return { x: x[i] + (x[i + 1] - x[i]) * f, y: y[i] + (y[i + 1] - y[i]) * f, heading: Math.atan2(y[i + 1] - y[i], x[i + 1] - x[i]) };
  }
}

/** Drive a whole run with calls made at these distances (null: never made). */
export function driveCalls(c: CornerData, condition: Condition, calls: { brakeS: number | null; releaseS: number | null; throttleS: number | null }): CornerRun {
  const run = new CornerRun(c, condition);
  const at = (target: number | null) => {
    if (target === null) return;
    while (!run.outcome && run.s < target) run.advance(DT);
  };
  at(calls.brakeS);
  if (calls.brakeS !== null) run.press(true);
  at(calls.releaseS);
  if (calls.releaseS !== null) run.press(false);
  at(calls.throttleS);
  if (calls.throttleS !== null) run.press(true);
  while (!run.outcome) run.advance(DT);
  return run;
}

/**
 * The perfect run: this car with the ideal calls, the brakes coming off the
 * moment it is down to the corner's speed. Its time is the one to beat.
 */
export function perfectRun(c: CornerData, condition: Condition): CornerRun {
  const ideal = idealCalls(c, condition);
  const run = new CornerRun(c, condition);
  while (!run.outcome && run.s < ideal.brakeS) run.advance(DT);
  run.press(true);
  while (!run.outcome && run.v > ideal.minSpeed + 0.02 && run.s < ideal.throttleS) run.advance(DT);
  run.press(false);
  while (!run.outcome && run.s < ideal.throttleS) run.advance(DT);
  run.press(true);
  while (!run.outcome) run.advance(DT);
  return run;
}

export interface RunScore {
  points: number;
  outcome: Outcome;
  /** seconds slower than the perfect run (only for a finished run) */
  lost: number | null;
  /** each call against the ideal: metres (negative early), km/h (negative slow), metres */
  brakeM: number | null;
  speedKmh: number | null;
  throttleM: number | null;
}

export function scoreRun(run: CornerRun, perfect: CornerRun): RunScore {
  const ideal = idealCalls(run.c, run.condition);
  const calls = {
    brakeM: run.brakeS === null ? null : run.brakeS - ideal.brakeS,
    speedKmh: run.releaseV === null ? null : (run.releaseV - ideal.minSpeed) * 3.6,
    throttleM: run.throttleS === null ? null : run.throttleS - ideal.throttleS,
  };
  if (run.outcome !== "done") return { points: 0, outcome: run.outcome ?? "off", lost: null, ...calls };
  const lost = Math.max(0, run.t - perfect.t);
  return { points: Math.max(0, Math.round(MAX_POINTS - lost * POINTS_PER_SECOND)), outcome: "done", lost, ...calls };
}
