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

/** Colour for time lost in one corner segment vs the target line. */
export function lossColor(deltaMs: number): string {
  if (deltaMs <= 20) return C.purple;
  if (deltaMs <= 120) return C.green;
  if (deltaMs <= 300) return C.yellow;
  return C.kerb;
}
