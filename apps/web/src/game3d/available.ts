/**
 * Which circuits have their 3D world built (game/circuit3d, by tools/track-builder/src/build-circuit-terrain.ts): the
 * Daily Quali lap can be watched in 3D there. No three.js here, so the game's own bundle can ask cheaply.
 */
const BUILT = Object.keys(import.meta.glob("../game/circuit3d/*.json")).map((k) => k.replace(/^.*\/(.*)\.json$/, "$1"));
export const has3D = (trackId: string) => BUILT.includes(trackId);

const KEY = "apex.lap3d";
/** Whether the player watches laps in 3D (on by default where it exists). */
export function lap3DOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}
export function setLap3D(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // private mode: the choice lasts the visit
  }
}
