import { C } from "./palette";

/**
 * Vegas Night: Las Vegas Grand Prix week (19 to 23 November 2026) turns Lapdle neon, a pastel sunset over the water
 * with palm trees behind the page, with hot pink for the player. It switches itself on and off by the player's own date; a player can
 * keep the classic look, and ?theme=vegas previews it on any day. index.html carries the same check inline, so the
 * first paint is already in the right colours: keep the two in step.
 */
export const VEGAS_FROM = "2026-11-19";
export const VEGAS_TO = "2026-11-23";
const KEY = "apex.theme";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Whether the date falls in Vegas Night week (by the player's local calendar day). */
export function vegasWeek(d: Date = new Date()): boolean {
  const day = ymd(d);
  return day >= VEGAS_FROM && day <= VEGAS_TO;
}

function query(): string | null {
  try {
    return new URLSearchParams(location.search).get("theme");
  } catch {
    return null;
  }
}

function keptClassic(): boolean {
  try {
    return localStorage.getItem(KEY) === "classic";
  } catch {
    return false;
  }
}

/** Whether the neon look should show now: a ?theme= preview wins, then the player's choice, then the date. */
export function vegasOn(d: Date = new Date()): boolean {
  const q = query();
  if (q === "vegas") return true;
  if (q === "classic") return false;
  return vegasWeek(d) && !keptClassic();
}

/** Canvas colours for the neon night; the timing colours stay as they are so the grades read the same. */
const NEON = { night: "#10081c", board: "#1a0f2c", asphalt: "#2b1f3d", paint: "#fff3f7", steel: "#dccbea", ink: "#ff5c9d", inkDim: "rgba(255,92,157,0.35)" };
const CLASSIC = { night: C.night, board: C.board, asphalt: C.asphalt, paint: C.paint, steel: C.steel, ink: C.ink, inkDim: C.inkDim };

/** Paint the page and the canvas colours in the neon look, or back in the classic one. */
export function applyVegas(on: boolean) {
  Object.assign(C, on ? NEON : CLASSIC);
  const root = document.documentElement;
  if (on) root.dataset.theme = "vegas";
  else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", on ? NEON.night : CLASSIC.night);
}

/** The player's switch during the week: keep the classic look, or go back to the neon one. */
export function setVegas(on: boolean) {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "classic");
  } catch {
    /* the choice just won't persist */
  }
  applyVegas(on);
}
