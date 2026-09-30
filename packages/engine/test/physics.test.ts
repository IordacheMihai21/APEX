import { describe, expect, it } from "vitest";
import { APEX_FORMULA, carConstants, cornerSpeedLimit, gripAt, integrateTime, simulateLap, speedProfile } from "../src";
import { kestrelPrepared, loadTrack } from "./helpers";

const c = carConstants(APEX_FORMULA);
const fill = (n: number, v: number) => new Float64Array(n).fill(v);

/** Open path from segments of [length m, curvature]. 1 m spacing. */
function path(segs: [number, number][]) {
  const k: number[] = [];
  for (const [len, kap] of segs) for (let i = 0; i < len; i++) k.push(kap);
  return { ds: fill(k.length, 1), kappa: Float64Array.from(k) };
}

describe("car model", () => {
  it("has a plausible top speed (~349 km/h) where power equals drag", () => {
    expect(c.topSpeed * 3.6).toBeGreaterThan(330);
    expect(c.topSpeed * 3.6).toBeLessThan(360);
    expect(c.powerPerMass / c.topSpeed).toBeCloseTo(c.kDrag * c.topSpeed * c.topSpeed, 6);
  });

  it("corner speed limit uses exactly the friction circle: lateral² + drag² = grip²", () => {
    for (const r of [15, 30, 60, 90]) {
      const v = cornerSpeedLimit(c, 1 / r);
      expect(v).toBeLessThan(c.topSpeed); // only meaningful below the top-speed cap
      const lat = (v * v) / r;
      const drag = c.kDrag * v * v;
      expect(Math.sqrt(lat * lat + drag * drag)).toBeCloseTo(gripAt(c, v), 6);
    }
  });

  it("fast corners are flat out thanks to downforce", () => {
    expect(cornerSpeedLimit(c, 1 / 400)).toBe(c.topSpeed);
  });
});

describe("speed profile", () => {
  it("straight line: accelerates monotonically toward, never past, top speed", () => {
    const { ds, kappa } = path([[4000, 0]]);
    const v = speedProfile(ds, kappa, c, { closed: false, startSpeed: 0 });
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1]);
    expect(v[v.length - 1]).toBeLessThanOrEqual(c.topSpeed);
    expect(v[v.length - 1]).toBeGreaterThan(0.95 * c.topSpeed);
  });

  it("constant-radius circle: speed is exactly the lateral-grip limit everywhere", () => {
    const n = 628;
    const v = speedProfile(fill(n, 1), fill(n, 1 / 100), c, { closed: true });
    const lim = cornerSpeedLimit(c, 1 / 100);
    for (const s of v) expect(s).toBeCloseTo(lim, 6);
  });

  it("hairpin: brakes hard before the apex and never exceeds available grip", () => {
    const { ds, kappa } = path([[600, 0], [47, 1 / 15], [600, 0]]); // 180° at R=15
    const v = speedProfile(ds, kappa, c, { closed: false, startSpeed: c.topSpeed });
    const apex = 600 + 23;
    expect(v[apex]).toBeCloseTo(cornerSpeedLimit(c, 1 / 15), 6);
    expect(v[500]).toBeGreaterThan(2.5 * v[apex]); // still fast 100 m before
    for (let i = 0; i < 600; i++) {
      const decel = (v[i] * v[i] - v[i + 1] * v[i + 1]) / 2;
      expect(decel).toBeLessThanOrEqual(gripAt(c, v[i + 1]) + c.kDrag * v[i + 1] * v[i + 1] + 1e-9);
    }
  });

  it("a wider radius for the same 90° corner is faster", () => {
    const run = (r: number) => {
      const arcLen = Math.round((Math.PI / 2) * r);
      const { ds, kappa } = path([[300, 0], [arcLen, 1 / r], [300, 0]]);
      const v = speedProfile(ds, kappa, c, { closed: false, startSpeed: 60 });
      return { vmin: Math.min(...v), vexit: v[v.length - 1] };
    };
    const tight = run(30);
    const wide = run(60);
    expect(wide.vmin).toBeGreaterThan(1.3 * tight.vmin);
    expect(wide.vexit).toBeGreaterThan(tight.vexit);
  });

  it("integrates time consistently (constant speed)", () => {
    const { total } = integrateTime(fill(100, 2), fill(100, 50), true);
    expect(total).toBeCloseTo(4, 12);
  });
});

describe("determinism", () => {
  it("identical input gives bit-identical results", () => {
    const pt = kestrelPrepared();
    const line = pt.track.optimalLine!;
    const first = simulateLap({ track: pt, line });
    for (let i = 0; i < 50; i++) {
      const r = simulateLap({ track: pt, line: { knotOffsets: [...line.knotOffsets] } });
      expect(r.rawLapTimeMs).toBe(first.rawLapTimeMs);
      expect(r.lapTimeMs).toBe(first.lapTimeMs);
    }
  });

  it("golden: Kestrel optimal lap matches the published target (bump PHYSICS_VERSION if this changes)", () => {
    const track = loadTrack("kestrel");
    const r = simulateLap({ track: kestrelPrepared(), line: track.optimalLine! });
    expect(r.physicsVersion).toBe(track.physicsVersion);
    expect(r.lapTimeMs).toBe(track.optimalTimeMs);
  });
});
