/** Every published track must pass these; run after `npm run build:tracks`. */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APEX_FORMULA as car, type GameTrack, PHYSICS_VERSION, fitDrawing, prepareTrack, simulateLap } from "../src";
import { drawOffsets } from "./helpers";

const dir = resolve(import.meta.dirname, "../../../data/tracks");
const tracks: GameTrack[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")));

describe.each(tracks.map((t) => [t.name, t] as const))("%s", (_name, track) => {
  const pt = prepareTrack(track);
  const opt = simulateLap({ track: pt, line: track.optimalLine!, car });

  it("was built with the current physics and car", () => {
    expect(track.physicsVersion).toBe(PHYSICS_VERSION);
    expect(track.carModel).toBe(car.id);
  });

  it("optimal line is valid and reproduces the published target exactly", () => {
    expect(opt.valid).toBe(true);
    expect(opt.lapTimeMs).toBe(track.optimalTimeMs);
  });

  it("the centerline is clearly slower than the optimal line", () => {
    const center = simulateLap({ track: pt, line: { knotOffsets: new Array(pt.k).fill(0) }, car });
    expect(center.lapTimeMs - opt.lapTimeMs).toBeGreaterThan(1000);
  });

  it("a clean drawing of the optimal line round-trips through fitDrawing", () => {
    const fit = fitDrawing(pt, drawOffsets(pt, opt.samples.offset), car);
    expect(fit.valid).toBe(true);
    const r = simulateLap({ track: pt, line: fit.line, car });
    expect(r.lapTimeMs - opt.lapTimeMs).toBeLessThan(0.002 * opt.lapTimeMs); // within 0.2%
  });
});
