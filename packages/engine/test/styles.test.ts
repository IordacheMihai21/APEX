/** One-tap line styles: valid on every track and a real improvement on the centreline start. */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APEX_FORMULA as car, type GameTrack, LINE_STYLES, expandGates, prepareTrack, simulateLap, styleGates, trackControls, usableHalfWidth } from "../src";

const dir = resolve(import.meta.dirname, "../../../data/tracks");
const tracks: GameTrack[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")));

describe.each(tracks.map((t) => [t.name, t] as const))("%s", (_name, track) => {
  const pt = prepareTrack(track);
  const ctl = trackControls(pt);
  const lim = usableHalfWidth(pt, car);
  const zero = new Array(pt.k).fill(0);
  const withStyle = (style: (typeof LINE_STYLES)[number]) => {
    const z = zero.slice();
    for (const cx of ctl.complexes) for (const [k, v] of styleGates(pt, cx, style, lim)) z[k] = v;
    return z;
  };

  it("sets only gates, within the usable width", () => {
    for (const cx of ctl.complexes)
      for (const style of LINE_STYLES)
        for (const [k, v] of styleGates(pt, cx, style, lim)) {
          expect(ctl.isGate[k]).toBe(true);
          expect(Math.abs(v)).toBeLessThanOrEqual(lim + 1e-9);
        }
  });

  it("gives three different lines", () => {
    const keys = LINE_STYLES.map((s) => withStyle(s).join(","));
    expect(new Set(keys).size).toBe(3);
  });

  it("beats the centreline with the best whole-lap style, but never reaches the optimal lap", () => {
    const time = (z: number[]) => simulateLap({ track: pt, line: { knotOffsets: expandGates(pt, ctl, z, lim) }, car }).lapTimeMs;
    const best = Math.min(...LINE_STYLES.map((s) => time(withStyle(s))));
    expect(best).toBeLessThan(time(zero));
    expect(best).toBeGreaterThan(track.optimalTimeMs! * 1.005);
  });
});
