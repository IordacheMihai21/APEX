import { GRADE_LIMITS_MS } from "../modes/grading";

/**
 * Canvas colours. Keep in sync with the @theme tokens in index.css.
 * Timing colours follow motorsport sector-timing convention.
 */
export const C: Record<"night" | "asphalt" | "paint" | "ink" | "inkDim" | "kerb" | "purple" | "green" | "yellow" | "red" | "steel" | "board", string> = {
  night: "#0a0b0d", // page ground
  asphalt: "#262a31",
  paint: "#f2f2ee", // track edge lines
  ink: "#ff6a13", // the player's line (safety orange)
  inkDim: "rgba(255,106,19,0.35)",
  kerb: "#e5332a",
  purple: "#a259ff", // on target
  green: "#29cc6a", // small loss
  yellow: "#f5c518", // moderate loss
  red: "#e5332a", // far off
  steel: "#9aa1ab",
  board: "#121418",
};

/**
 * Timing colours for colour-blind players (Okabe-Ito based): blue for
 * perfect, bluish green for close, yellow for slow, reddish purple for far.
 * Distinct in lightness as well as hue, so they also hold under deuteranopia
 * and protanopia, and none is close to the player's orange.
 */
const TIMING = {
  standard: { purple: "#a259ff", green: "#29cc6a", yellow: "#f5c518", red: "#e5332a" },
  colourBlind: { purple: "#5aa9ff", green: "#009e73", yellow: "#f0e442", red: "#cc79a7" },
};

const KEY = "apex.palette";

export function colourBlind(): boolean {
  try {
    return localStorage.getItem(KEY) === "cb";
  } catch {
    return false;
  }
}

/** Switch the timing colours everywhere: CSS tokens for the UI, this object for the canvas. */
export function setColourBlind(on: boolean) {
  Object.assign(C, on ? TIMING.colourBlind : TIMING.standard);
  if (on) document.documentElement.dataset.palette = "cb";
  else delete document.documentElement.dataset.palette;
  try {
    localStorage.setItem(KEY, on ? "cb" : "standard");
  } catch {
    /* preference just won't persist */
  }
}

/** Colour for time lost in one corner segment vs the target line (same scale as the lap tiles). */
export function lossColor(deltaMs: number): string {
  if (deltaMs <= GRADE_LIMITS_MS.purple) return C.purple;
  if (deltaMs <= GRADE_LIMITS_MS.green) return C.green;
  if (deltaMs <= GRADE_LIMITS_MS.yellow) return C.yellow;
  return C.red;
}
