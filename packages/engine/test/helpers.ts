import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type GameTrack, type PreparedTrack, type TrackSpec, type Vec2, prepareTrack } from "../src";

export const loadTrack = (id: string, version = 1): GameTrack =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, `../../../data/tracks/${id}.v${version}.json`), "utf8"));

let kestrel: PreparedTrack | undefined;
export const kestrelPrepared = () => (kestrel ??= prepareTrack(loadTrack("kestrel")));

/** Rounded rectangle: long straights, four 90° left corners of radius r. */
export function roundedRect(w = 800, h = 250, r = 40, width = 12): TrackSpec {
  const pts: Vec2[] = [];
  const straight = (x0: number, y0: number, x1: number, y1: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const m = Math.max(1, Math.round(len / 60));
    for (let i = 0; i < m; i++) pts.push([x0 + ((x1 - x0) * i) / m, y0 + ((y1 - y0) * i) / m]);
  };
  const arc = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i < 4; i++) {
      const a = a0 + (Math.PI / 2) * (i / 4);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  straight(r, 0, w - r, 0);
  arc(w - r, r, -Math.PI / 2);
  straight(w, r, w, h - r);
  arc(w - r, h - r, 0);
  straight(w - r, h, r, h);
  arc(r, h - r, Math.PI / 2);
  straight(0, h - r, 0, r);
  arc(r, r, Math.PI);
  return { id: "rect", name: "Rect", version: 1, widthMeters: width, controlPoints: pts, samples: 800 };
}

/** Points of a line given per-index offsets, closed (first point repeated). */
export function drawOffsets(pt: PreparedTrack, off: ArrayLike<number>, reverse = false): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= pt.n; i++) {
    const j = i % pt.n;
    pts.push([pt.cx[j] + off[j] * pt.nx[j], pt.cy[j] + off[j] * pt.ny[j]]);
  }
  return reverse ? pts.reverse() : pts;
}
