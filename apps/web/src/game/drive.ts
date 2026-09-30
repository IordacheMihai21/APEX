/**
 * Presentation-only drivetrain: derives gear, RPM and rev-light count from
 * simulated speed so the HUD and engine note feel like a real car. The physics
 * never reads this; lap times are unaffected.
 */
const SHIFT_KMH = [0, 95, 135, 170, 205, 240, 275, 310, 400]; // gear g spans SHIFT_KMH[g-1]..SHIFT_KMH[g]
export const RPM_MIN = 9800;
export const RPM_MAX = 12600;
export const REV_LEDS = 15;

export interface DriveState {
  gear: number;
  rpm: number;
  /** 0..REV_LEDS */
  leds: number;
  /** true in the last ~3% before the shift point: the lights flash */
  shift: boolean;
}

export function driveState(kmh: number): DriveState {
  let g = 1;
  while (g < SHIFT_KMH.length - 1 && kmh >= SHIFT_KMH[g]) g++;
  const lo = SHIFT_KMH[g - 1];
  const hi = SHIFT_KMH[g];
  const f = Math.max(0, Math.min(1, (kmh - lo) / (hi - lo)));
  const rpm = RPM_MIN + (RPM_MAX - RPM_MIN) * (g === 1 ? Math.max(0.15, f) : f);
  const leds = Math.round(((rpm - RPM_MIN) / (RPM_MAX - RPM_MIN)) * REV_LEDS);
  return { gear: g, rpm, leds, shift: f > 0.97 && g < SHIFT_KMH.length - 1 };
}
