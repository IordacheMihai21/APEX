import { describe, expect, it } from "vitest";
import { CONDITION_CARS, type GameTrack, prepareTrack, simulateLap, trackControls } from "@apex/engine";
import monza from "../../../../data/tracks/monza.v1.json";
import { poseAt, stretchOf } from "./stretch";

const track = monza as unknown as GameTrack;
const pt = prepareTrack(track);
const controls = trackControls(pt);
const lap = simulateLap({ track: pt, line: track.optimalLine!, car: CONDITION_CARS.dry });

describe("3D stretch of a corner group", () => {
  it("runs from the run-up to the exit, origin at the slowest point", () => {
    const cx = controls.complexes[0];
    const c = stretchOf(track, pt, { corners: cx.corners, direction: cx.direction, index: cx.id, name: cx.name }, lap.samples)!;
    expect(c).not.toBeNull();
    const n = c.x.length;
    for (const a of [c.y, c.lx, c.ly, c.rx, c.ry, c.s, c.conditions.dry.speed]) expect(a.length).toBe(n);
    expect(c.s[n - 1]).toBeGreaterThan(400);
    const apex = c.conditions.dry.apex;
    expect(Math.hypot(c.x[apex], c.y[apex])).toBeLessThan(0.01);
    expect(c.conditions.dry.brake).toBeLessThan(apex);
    expect(Math.min(...c.conditions.dry.speed)).toBe(c.conditions.dry.speed[apex]);
  });

  it("drives the stretch at its speeds and ends on its last point", () => {
    const cx = controls.complexes[1];
    const c = stretchOf(track, pt, { corners: cx.corners, direction: cx.direction, index: cx.id, name: cx.name }, lap.samples)!;
    const start = poseAt(c, 0);
    expect(start.x).toBeCloseTo(c.x[0], 5);
    const mid = poseAt(c, 2);
    expect(mid.s).toBeGreaterThan(0);
    expect(mid.done).toBe(false);
    const end = poseAt(c, 999);
    expect(end.done).toBe(true);
    expect(end.x).toBe(c.x[c.x.length - 1]);
  });

  it("turns the car smoothly through the bend, without jumps from one sample to the next", () => {
    const cx = controls.complexes[0];
    const c = stretchOf(track, pt, { corners: cx.corners, direction: cx.direction, index: cx.id, name: cx.name }, lap.samples)!;
    let prev = poseAt(c, 0).heading;
    let worst = 0;
    for (let t = 1 / 60; !poseAt(c, t).done; t += 1 / 60) {
      const h = poseAt(c, t).heading;
      let d = h - prev;
      d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
      worst = Math.max(worst, Math.abs(d));
      prev = h;
    }
    // a 60 Hz frame through a slow corner turns the car well under 2 degrees
    expect(worst).toBeLessThan((2 * Math.PI) / 180);
  });
});
