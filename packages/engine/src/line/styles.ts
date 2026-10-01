import type { PreparedTrack } from "../track/prepare";
import type { Complex } from "./controls";

/**
 * One-tap line styles for a corner group, built from racing-line geometry
 * (outside, inside at the apex, outside again), never from the optimal line,
 * so a style is a good starting point but not the answer.
 *
 * Gates are placed by their position between apexes:
 * - before the first apex the line moves from the outside of that corner to
 *   its inside; `early` gets there sooner, `late` holds the outside longer;
 * - after the last apex it runs back out (`early` drifts wide sooner, `late`
 *   stays tight longer and opens the exit later);
 * - between two apexes it crosses over when they turn opposite ways
 *   (chicanes) and holds the inside when they turn the same way.
 */
export type LineStyle = "early" | "classic" | "late";

export const LINE_STYLES: LineStyle[] = ["early", "classic", "late"];

/**
 * Where each style sits at the corner's key points, as a share of the usable
 * half-width towards the corner's inside (+) or outside (−). "classic" is the
 * median of the optimal lines at each kind of gate across the 12 real
 * circuits (turn-in −0.51, apex 0.95, exit −0.54, between same-hand apexes
 * ~0.6); the spread between corners is wide, so every corner still has its
 * own better answer to find.
 */
const SHAPE: Record<LineStyle, { entry: number; apex: number; exit: number }> = {
  early: { entry: -0.25, apex: 0.95, exit: -0.85 },
  classic: { entry: -0.5, apex: 0.95, exit: -0.5 },
  late: { entry: -0.85, apex: 0.8, exit: -0.25 },
};

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Half-span (m) over which an apex's sharpness is measured. */
const SHARPNESS_SPAN_M = 15;

/** Heading change (rad) of the centreline across ±SHARPNESS_SPAN_M around index i. */
function sharpness(pt: PreparedTrack, i: number): number {
  const n = pt.n;
  const w = Math.max(1, Math.round(SHARPNESS_SPAN_M / pt.step));
  const a = (i - w + n) % n;
  const b = (i + w) % n;
  const h1 = Math.atan2(pt.cy[i] - pt.cy[a], pt.cx[i] - pt.cx[a]);
  const h2 = Math.atan2(pt.cy[b] - pt.cy[i], pt.cx[b] - pt.cx[i]);
  let d = h2 - h1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

/**
 * Knot offsets (metres, + = left) for each gate of `complex` under `style`,
 * keyed by knot index. Feed into expandGates to get a full line.
 */
export function styleGates(pt: PreparedTrack, complex: Complex, style: LineStyle, limit: number): Map<number, number> {
  const gates = complex.gates;
  const dirOf = (name: string | undefined) => pt.track.corners.find((c) => c.name === name)?.direction ?? "left";
  // the corner's inside, in metres: + is left, so a left-hander's inside is +
  const inside = (j: number) => (dirOf(gates[j].corner) === "left" ? 1 : -1) * limit;
  const apexes = gates.map((g, j) => (g.label === "Apex" ? j : -1)).filter((j) => j >= 0);
  const shape = SHAPE[style];
  const out = new Map<number, number>();
  if (apexes.length === 0) return out;
  // In a group, only the sharpest corner gets the full apex; milder kinks are
  // apexed in proportion, since the fast line runs nearly straight through them.
  const sharp = new Map(apexes.map((j) => [j, sharpness(pt, gates[j].index)]));
  const maxSharp = Math.max(...sharp.values());
  const weight = (j: number) => (maxSharp > 0 ? (sharp.get(j)! / maxSharp) ** 1 : 1);

  gates.forEach((g, j) => {
    const prev = [...apexes].reverse().find((a) => a <= j);
    const next = apexes.find((a) => a >= j);
    let v: number;
    if (prev === j) {
      v = shape.apex * weight(j) * inside(j);
    } else if (prev === undefined) {
      // entry: from the turn-in point towards the first apex
      const t = j / next!;
      v = inside(next!) * weight(next!) * (shape.entry + (shape.apex - shape.entry) * smoothstep(t));
    } else if (next === undefined) {
      // exit: from the last apex out to the exit point
      const last = gates.length - 1;
      const t = last === prev ? 1 : (j - prev) / (last - prev);
      v = inside(prev) * weight(prev) * (shape.apex + (shape.exit - shape.apex) * smoothstep(t));
    } else {
      // between apexes: hold the inside if they turn the same way, cross over if not
      const t = (j - prev) / (next - prev);
      const a = shape.apex * weight(prev) * inside(prev);
      const b = shape.apex * weight(next) * inside(next);
      v = Math.sign(a) === Math.sign(b) ? a * (1 - 0.4 * Math.sin(Math.PI * t)) : a + (b - a) * smoothstep(t);
    }
    out.set(g.knot, Math.round(v * 100) / 100);
  });
  return out;
}
