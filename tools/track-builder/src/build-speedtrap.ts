/**
 * Speed trap points: places on each real circuit's perfect lap (dry) where
 * the speed is worth guessing, with the speed the physics engine drives
 * there: the top speed at the end of each straight, the slowest point of each
 * corner, and fast corners taken at speed. Each has its spot and the direction
 * of travel on the circuit map. Output: apps/web/src/game/speedtrap.json (generated).
 * Usage: npx tsx tools/track-builder/src/build-speedtrap.ts
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type GameTrack, prepareTrack, simulateLap } from "@apex/engine";

const BOX = 1000;
const WINDOW_M = 150; // a top or a slowest point must be the extreme within this distance either side
const SPACING_M = 180; // points on one circuit at least this far apart
const MAX_PER_KIND = { top: 4, apex: 5, fast: 3 } as const;
const FAST_KMH = 200;
const FAST_KAPPA = 1 / 450; // tighter than a kink, at more than FAST_KMH

type Kind = keyof typeof MAX_PER_KIND;
const dir = resolve(import.meta.dirname, "../../../data/tracks");
const out: unknown[] = [];

for (const f of readdirSync(dir).filter((f) => f.endsWith(".v1.json"))) {
  const track: GameTrack = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
  if (track.id === "kestrel") continue;
  const pt = prepareTrack(track);
  const lap = simulateLap({ track: pt, line: track.optimalLine! });
  const { speed, distance, curvature, x, y } = lap.samples;
  const n = pt.n;
  const total = distance[n - 1] + Math.hypot(x[0] - x[n - 1], y[0] - y[n - 1]);
  const gap = (i: number, j: number) => {
    const d = Math.abs(distance[i] - distance[j]);
    return Math.min(d, total - d);
  };

  // the map transform of build-outlines (north-up box on the centreline, y flipped)
  const xs = [...pt.cx];
  const ys = [...pt.cy];
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const s = (BOX * 0.86) / Math.max(x1 - x0, y1 - y0);
  const ox = (BOX - (x1 - x0) * s) / 2;
  const oy = (BOX - (y1 - y0) * s) / 2;
  const P = (px: number, py: number): [number, number] => [Math.round(ox + (px - x0) * s), Math.round(oy + (y1 - py) * s)];

  /** i is the extreme of speed within WINDOW_M either side (max or min) */
  const extreme = (i: number, max: boolean) => {
    for (let o = 1; ; o++) {
      const a = (i + o) % n;
      const b = (i - o + n) % n;
      if (gap(i, a) > WINDOW_M) return true;
      if (max ? speed[a] > speed[i] || speed[b] >= speed[i] : speed[a] < speed[i] || speed[b] <= speed[i]) return false;
    }
  };

  const found: { i: number; kind: Kind; weight: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (extreme(i, true)) found.push({ i, kind: "top", weight: speed[i] });
    else if (extreme(i, false)) found.push({ i, kind: "apex", weight: -speed[i] });
    else if (speed[i] * 3.6 > FAST_KMH && Math.abs(curvature[i]) > FAST_KAPPA) found.push({ i, kind: "fast", weight: Math.abs(curvature[i]) * speed[i] * speed[i] });
  }

  // the strongest of each kind, kept apart from each other
  const keep: typeof found = [];
  for (const kind of ["top", "apex", "fast"] as Kind[]) {
    let k = 0;
    for (const c of found.filter((c) => c.kind === kind).sort((a, b) => b.weight - a.weight)) {
      if (k >= MAX_PER_KIND[kind]) break;
      if (keep.some((q) => gap(q.i, c.i) < SPACING_M)) continue;
      keep.push(c);
      k++;
    }
  }
  keep.sort((a, b) => a.i - b.i);
  for (const { i, kind } of keep) {
    const j = (i + 3) % n;
    const [ax, ay] = P(x[i], y[i]);
    const [bx, by] = P(x[j], y[j]);
    out.push({ track: track.id, kind, kmh: Math.round(speed[i] * 3.6), lapM: Math.round(distance[i]), map: [ax, ay], heading: Math.round((Math.atan2(by - ay, bx - ax) * 180) / Math.PI) });
  }
  console.log(`${track.id.padEnd(14)} ${keep.map((c) => `${c.kind}:${Math.round(speed[c.i] * 3.6)}`).join(" ")}`);
}

const file = resolve(import.meta.dirname, "../../../apps/web/src/game/speedtrap.json");
writeFileSync(file, JSON.stringify(out));
console.log(`${out.length} points → ${file}`);
