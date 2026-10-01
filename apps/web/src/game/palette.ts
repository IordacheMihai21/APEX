import { GRADE_LIMITS_MS } from "../modes/grading";

/**
 * Canvas colours. Keep in sync with the @theme tokens in index.css.
 * Timing colours follow motorsport sector-timing convention.
 */
export const C = {
  night: "#0a0b0d", // page ground
  asphalt: "#262a31",
  paint: "#f2f2ee", // track edge lines
  ink: "#ff6a13", // the player's line (safety orange)
  inkDim: "rgba(255,106,19,0.35)",
  kerb: "#e5332a",
  purple: "#a259ff", // on target
  green: "#29cc6a", // small loss
  yellow: "#f5c518", // moderate loss
  steel: "#9aa1ab",
  board: "#121418",
} as const;

/** Colour for time lost in one corner segment vs the target line (same scale as the lap tiles). */
export function lossColor(deltaMs: number): string {
  if (deltaMs <= GRADE_LIMITS_MS.purple) return C.purple;
  if (deltaMs <= GRADE_LIMITS_MS.green) return C.green;
  if (deltaMs <= GRADE_LIMITS_MS.yellow) return C.yellow;
  return C.kerb;
}
