import { GRADE_LIMITS_MS } from "../modes/grading";

/**
 * Canvas colours. Keep in sync with the @theme tokens in index.css.
 * Timing colours follow motorsport sector-timing convention.
 */
export const C = {
  tarmac: "#1d2024", // page / infield
  runoff: "#262a30",
  asphalt: "#33383f",
  paint: "#ecebe4", // track edge lines
  ink: "#ff6a13", // the player's line (safety orange)
  inkDim: "rgba(255,106,19,0.35)",
  kerb: "#d7263d",
  purple: "#a259ff", // on target
  green: "#29cc6a", // small loss
  yellow: "#f5c518", // moderate loss
  steel: "#8b939c",
  board: "#0c0d0f",
} as const;

/** Colour for time lost in one corner segment vs the target line (same scale as the lap tiles). */
export function lossColor(deltaMs: number): string {
  if (deltaMs <= GRADE_LIMITS_MS.purple) return C.purple;
  if (deltaMs <= GRADE_LIMITS_MS.green) return C.green;
  if (deltaMs <= GRADE_LIMITS_MS.yellow) return C.yellow;
  return C.kerb;
}
