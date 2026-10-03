import { cbrt } from "../math/linalg";

/**
 * Point-mass car parameters. apex_formula_v2 is a generic formula-style car,
 * not a reproduction of any real car. v2 raised grip (μ 1.6 → 1.8) and
 * downforce (ClA 3.5 → 5.0) so optimal laps on real circuits land near
 * real-world pole pace (see docs/PHYSICS.md, "Calibration").
 */
export interface CarModel {
  id: string;
  mass: number; // kg
  power: number; // W at the wheels
  mu: number; // tyre friction coefficient (lateral and longitudinal)
  clA: number; // downforce coefficient × area, m²
  cdA: number; // drag coefficient × area, m²
  rho: number; // air density, kg/m³
  g: number; // m/s²
  halfWidth: number; // m, used for track limits
}

export const APEX_FORMULA: CarModel = Object.freeze({
  id: "apex_formula_v2",
  mass: 750,
  power: 600e3,
  mu: 1.8,
  clA: 5.0,
  cdA: 1.1,
  rho: 1.2,
  g: 9.81,
  halfWidth: 1.0,
});

/**
 * Track conditions, as variations of the same car (so lap times stay
 * comparable within a condition, and the physics stays one model):
 * - wet: tyre friction down about 28% (μ 1.8 → 1.3), everything else equal;
 *   corners and braking zones get slower, the line tightens up.
 * - lowdf: a low-downforce, low-drag spec (ClA 5.0 → 3.8, CdA 1.1 → 0.70),
 *   the Monza-style trim: faster on the straights, less grip in fast corners,
 *   so braking points and the best line move. Calibrated so it is quicker at
 *   Monza (about 0.6 s on the dry line) and 3-4 s slower on twisty circuits.
 */
export type Condition = "dry" | "wet" | "lowdf";
export const CONDITIONS: Condition[] = ["dry", "wet", "lowdf"];

export const CONDITION_CARS: Readonly<Record<Condition, CarModel>> = Object.freeze({
  dry: APEX_FORMULA,
  wet: Object.freeze({ ...APEX_FORMULA, id: "apex_formula_v2_wet", mu: 1.3 }),
  lowdf: Object.freeze({ ...APEX_FORMULA, id: "apex_formula_v2_lowdf", clA: 3.8, cdA: 0.7 }),
});

/** Precomputed per-car constants used in the hot loop. */
export interface CarConstants {
  car: CarModel;
  kAero: number; // downforce accel per v²
  kDrag: number; // drag decel per v²
  powerPerMass: number;
  topSpeed: number; // m/s where drag = power
}

export function carConstants(car: CarModel): CarConstants {
  const kAero = (0.5 * car.rho * car.clA) / car.mass;
  const kDrag = (0.5 * car.rho * car.cdA) / car.mass;
  const powerPerMass = car.power / car.mass;
  return { car, kAero, kDrag, powerPerMass, topSpeed: cbrt(powerPerMass / kDrag) };
}

/** Total grip (m/s²) available at speed v: μ(g + downforce/m). */
export function gripAt(c: CarConstants, v: number): number {
  return c.car.mu * (c.car.g + c.kAero * v * v);
}

/**
 * Max *sustainable* speed on curvature κ. Holding speed in a corner needs a
 * longitudinal tyre force equal to drag, which shares the friction circle
 * with the lateral force:  (v²κ)² + (kDrag v²)² = (μ(g + kAero v²))²
 *   ⇒  v² = μg / (sqrt(κ² + kDrag²) − μ kAero)
 * At this speed the forward pass has exactly zero net acceleration, so a
 * constant-radius corner gives a constant speed (no drag-induced decay).
 */
export function cornerSpeedLimit(c: CarConstants, kappa: number): number {
  const denom = Math.sqrt(kappa * kappa + c.kDrag * c.kDrag) - c.car.mu * c.kAero;
  if (denom <= 0) return c.topSpeed;
  const v = Math.sqrt((c.car.mu * c.car.g) / denom);
  return v < c.topSpeed ? v : c.topSpeed;
}
