/**
 * The corners for Make the corner: for each famous corner of the Corner of the
 * week list, a stretch of the perfect lap from the run-up to the exit, as the
 * physics engine drives it in each condition. For every point of the stretch
 * (one per centerline sample, about 2.5 m apart): the racing line, both track
 * edges (for the 3D road), the curvature and the perfect lap's speed; and
 * where the perfect lap brakes, its slowest point, and the point where it is
 * back on full throttle. The game drives its own car along the same line with
 * the same car model, so a perfect run matches the perfect lap.
 * Output: apps/web/src/game/corners/<id>.json and index.json (generated).
 * Usage: npm run build:corners
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CONDITION_CARS, type Condition, type GameTrack, expandGates, prepareTrack, simulateLap, trackControls, usableHalfWidth } from "@apex/engine";
import { WEEKLY_CORNERS } from "../../../apps/web/src/modes/cornerList";

/** Straight before the braking point, and road after the slowest point (m). */
const RUNUP_M = 320;
const EXIT_M = 260;
const CONDITIONS: Condition[] = ["dry", "wet", "lowdf"];

const root = resolve(import.meta.dirname, "../../..");
const r2 = (x: number) => Math.round(x * 100) / 100;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** circuits by the names fans use (never a sponsor's) */
const PLACE: Record<string, string> = {
  monza: "Monza", spa: "Spa", silverstone: "Silverstone", suzuka: "Suzuka", monaco: "Monaco", interlagos: "Interlagos",
  hungaroring: "Hungaroring", "red-bull-ring": "Spielberg", zandvoort: "Zandvoort", austin: "Austin", barcelona: "Barcelona", imola: "Imola",
};
// the famous corners first, then every big braking zone of the real circuits (from Braking point's data), named by its turn numbers
const zones = JSON.parse(readFileSync(resolve(root, "apps/web/src/game/braking.json"), "utf8")) as { track: string; complex: number; group: string }[];
const seen = new Set<string>();
const candidates = [
  ...WEEKLY_CORNERS,
  ...zones
    .filter((z) => !WEEKLY_CORNERS.some((w) => w.trackId === z.track && w.complex === z.complex))
    .map((z) => ({ trackId: z.track, complex: z.complex, name: `${PLACE[z.track]} ${z.group.includes("–") ? "Turns" : "Turn"} ${z.group.replace(/T/g, "")}`, note: "" })),
].filter((c) => !seen.has(`${c.trackId}-${c.complex}`) && seen.add(`${c.trackId}-${c.complex}`));

const corners: unknown[] = [];
for (const wc of candidates) {
  const track: GameTrack = JSON.parse(readFileSync(resolve(root, `data/tracks/${wc.trackId}.v1.json`), "utf8"));
  const pt = prepareTrack(track);
  const complex = trackControls(pt).complexes[wc.complex];
  const parts = track.corners.filter((c) => complex.corners.includes(c.name));
  const n = pt.n;
  const ring = (i: number) => ((i % n) + n) % n;

  const runs = Object.fromEntries(
    CONDITIONS.map((condition) => {
      const car = CONDITION_CARS[condition];
      const line = condition === "dry" ? track.optimalLine! : track.conditions![condition]!.optimalLine;
      const lap = simulateLap({ track: pt, line: { knotOffsets: expandGates(pt, trackControls(pt), line.knotOffsets, usableHalfWidth(pt, car)) }, car });
      const { speed } = lap.samples;
      // the slowest point of the corner group, then back to where the speed stops rising (the braking point)
      let apex = parts[0].startIndex;
      const from = parts[0].startIndex - 40;
      const to = parts[parts.length - 1].endIndex + 10;
      for (let i = from; i <= to; i++) if (speed[ring(i)] < speed[ring(apex)]) apex = i;
      // back from the slowest point: over the constant-speed arc, then up the braking curve to where the speed stops rising
      // (stepping over the constant-speed arc and over ripples of under 0.3 m/s; a real slower point stops it)
      let brake = apex;
      let peak = apex;
      for (let i = apex - 1; i > apex - 400; i--) {
        if (speed[ring(i)] >= speed[ring(peak)] - 1e-6) peak = i;
        else if (speed[ring(i)] < speed[ring(peak)] - 0.3) break;
      }
      brake = peak;
      return [condition, { lap, apex, brake }];
    }),
  );

  // one stretch for every condition: from the earliest braking point's run-up to the exit
  const dry = runs.dry.lap.samples;
  const dist = (a: number, b: number) => {
    let d = 0;
    for (let i = a; i < b; i++) d += Math.hypot(dry.x[ring(i + 1)] - dry.x[ring(i)], dry.y[ring(i + 1)] - dry.y[ring(i)]);
    return d;
  };
  const earliest = Math.min(...CONDITIONS.map((c) => runs[c].brake));
  let start = earliest;
  while (dist(start, earliest) < RUNUP_M) start--;
  const lastApex = Math.max(...CONDITIONS.map((c) => runs[c].apex));
  let end = lastApex;
  while (dist(lastApex, end) < EXIT_M) end++;
  const idx = Array.from({ length: end - start + 1 }, (_, k) => ring(start + k));

  // the 3D world: metres, origin at the dry apex, the dry line's points
  const ox = dry.x[ring(runs.dry.apex)];
  const oy = dry.y[ring(runs.dry.apex)];
  const L = track.leftBoundary;
  const R = track.rightBoundary;
  const sAt: number[] = [0];
  for (let k = 1; k < idx.length; k++) sAt.push(sAt[k - 1] + Math.hypot(dry.x[idx[k]] - dry.x[idx[k - 1]], dry.y[idx[k]] - dry.y[idx[k - 1]]));

  // one slowest point (a hairpin, a long corner), or several (a chicane needs the brakes twice)?
  const minima = (c: Condition) => {
    const v = idx.map((i) => runs[c].lap.samples.speed[i]);
    const from = idx.indexOf(ring(runs[c].brake));
    const low = v[idx.indexOf(ring(runs[c].apex))];
    // from the braking point to where the car is 25 m/s (90 km/h) quicker than at the slowest point
    let to = idx.indexOf(ring(runs[c].apex));
    while (to < v.length - 1 && v[to] < low + 25) to++;
    // a slowest point counts when the car then gains at least 5 m/s before it slows again (or the stretch ends)
    let count = 0;
    let k = Math.max(1, from);
    while (k < to) {
      if (v[k] < v[k - 1] - 1e-6 && v[k] <= v[k + 1] + 1e-6) {
        let peak = v[k];
        let j = k + 1;
        while (j < to && v[j] >= peak - 0.5) peak = Math.max(peak, v[j++]);
        if (peak - v[k] >= 5 || j >= to) count++;
        k = j;
      } else k++;
    }
    return count;
  };
  // and a real stop from speed: the brakes go on near the run-up's top speed (not after a slow section, as in a chicane's second part)
  const bigStop = (c: Condition) => {
    const v = idx.map((i) => runs[c].lap.samples.speed[i]);
    const b = idx.indexOf(ring(runs[c].brake));
    return v[b] >= 0.8 * Math.max(...v.slice(0, b + 1)) && v[b] - v[idx.indexOf(ring(runs[c].apex))] >= 12;
  };
  const single = CONDITIONS.every((c) => minima(c) === 1 && bigStop(c));
  if (process.env.DEBUG) console.log(wc.name, CONDITIONS.map((c) => `${c}: minima ${minima(c)}, stop ${bigStop(c)}`).join(" | "));

  // chicanes and double-apex corners need the brakes twice: not playable with three calls
  if (!single) continue;
  corners.push({
    id: `${wc.trackId}-${wc.complex}`,
    trackId: wc.trackId,
    complex: wc.complex,
    name: wc.name,
    direction: complex.direction,
    /** metres along the line, the line itself and both edges, relative to the dry apex */
    s: sAt.map(r2),
    x: idx.map((i) => r2(dry.x[i] - ox)),
    y: idx.map((i) => r2(dry.y[i] - oy)),
    lx: idx.map((i) => r2(L[i][0] - ox)),
    ly: idx.map((i) => r2(L[i][1] - oy)),
    rx: idx.map((i) => r2(R[i][0] - ox)),
    ry: idx.map((i) => r2(R[i][1] - oy)),
    conditions: Object.fromEntries(
      CONDITIONS.map((c) => {
        const { lap, apex, brake } = runs[c];
        const pos = (i: number) => idx.indexOf(ring(i));
        return [
          c,
          {
            kappa: idx.map((i) => r3(lap.samples.curvature[i] * 1000) / 1000),
            speed: idx.map((i) => r2(lap.samples.speed[i])),
            brake: pos(brake),
            apex: pos(apex),
          },
        ];
      }),
    ),
  });
  console.log(`${wc.name}: ${idx.length} points, ${Math.round(sAt[sAt.length - 1])} m, ${single ? "one slowest point" : "several"}`);
}

// one file per corner (the game loads only the day's), and a small index
const dirOut = resolve(root, "apps/web/src/game/corners");
rmSync(dirOut, { recursive: true, force: true });
mkdirSync(dirOut, { recursive: true });
for (const c of corners as { id: string }[]) writeFileSync(resolve(dirOut, `${c.id}.json`), `${JSON.stringify(c)}\n`);
const index = (corners as { id: string; trackId: string; name: string }[]).map(({ id, trackId, name }) => ({ id, trackId, name }));
writeFileSync(resolve(dirOut, "index.json"), `${JSON.stringify(index, null, 1)}\n`);
console.log(`${corners.length} playable corners → ${dirOut}`);
