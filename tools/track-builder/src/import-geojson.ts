/**
 * Real-circuit ingestion: GeoJSON LineString (lon/lat) → TrackSpec in metres.
 *
 * Source data (bacinger/f1-circuits, MIT) is hand-traced with ~80–200
 * vertices per circuit, so corners are polygons. Pipeline:
 *   project to local metres → resample every 2 m → circular moving-average
 *   smoothing (twice, i.e. triangular kernel) → scale to the official length
 *   → decimate to control points for buildTrack's spline.
 * Runs offline; the engine only ever sees the resulting track JSON.
 */
import { readFileSync } from "node:fs";
import type { TrackSpec, Vec2 } from "@apex/engine";

export interface RealCircuit {
  /** bacinger feature id, e.g. "it-1922". */
  sourceId: string;
  /** Our track id (slug). */
  id: string;
  /** Display name (venue/location name only, no series branding). */
  name: string;
  country: string;
  widthMeters: number;
  /** Reverse the traced point order if it runs against race direction. */
  reverse?: boolean;
  /** Move start/finish forward along the lap (metres). */
  startShiftM?: number;
  /** Smoothing half-window in metres (default 12). */
  smoothM?: number;
}

interface Feature {
  properties: { id: string; Name: string; Location: string; length: number };
  geometry: { type: string; coordinates: [number, number][] };
}

const EARTH_R = 6371008.8;

function resample(pts: Vec2[], stepM: number): Vec2[] {
  const out: Vec2[] = [];
  const closed = [...pts, pts[0]];
  let carry = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const [ax, ay] = closed[i];
    const [bx, by] = closed[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    let d = carry;
    while (d < len) {
      out.push([ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len]);
      d += stepM;
    }
    carry = d - len;
  }
  return out;
}

function smooth(pts: Vec2[], half: number): Vec2[] {
  const n = pts.length;
  return pts.map((_, i) => {
    let sx = 0;
    let sy = 0;
    for (let o = -half; o <= half; o++) {
      const p = pts[(i + o + n) % n];
      sx += p[0];
      sy += p[1];
    }
    return [sx / (2 * half + 1), sy / (2 * half + 1)] as Vec2;
  });
}

const polyLength = (p: Vec2[]) => p.reduce((a, q, i) => a + Math.hypot(p[(i + 1) % p.length][0] - q[0], p[(i + 1) % p.length][1] - q[1]), 0);

export function loadFeatures(file: string): Map<string, Feature> {
  const fc = JSON.parse(readFileSync(file, "utf8")) as { features: Feature[] };
  return new Map(fc.features.map((f) => [f.properties.id, f]));
}

export function circuitToSpec(feature: Feature, c: RealCircuit): TrackSpec {
  let coords = feature.geometry.coordinates.slice();
  if (feature.geometry.type !== "LineString") throw new Error(`${c.sourceId}: expected LineString`);
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) coords = coords.slice(0, -1);
  if (c.reverse) coords = [coords[0], ...coords.slice(1).reverse()];

  // Local equirectangular projection about the centroid (error ≪ 0.1% at circuit scale).
  const lon0 = coords.reduce((a, p) => a + p[0], 0) / coords.length;
  const lat0 = coords.reduce((a, p) => a + p[1], 0) / coords.length;
  const kx = (Math.PI / 180) * EARTH_R * Math.cos((lat0 * Math.PI) / 180);
  const ky = (Math.PI / 180) * EARTH_R;
  let pts: Vec2[] = coords.map(([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky]);

  const step = 2;
  pts = resample(pts, step);
  const half = Math.round((c.smoothM ?? 12) / step);
  pts = smooth(smooth(pts, half), half);

  // Smoothing and tracing both shorten the lap slightly: scale to the official length.
  const scale = feature.properties.length / polyLength(pts);
  pts = pts.map(([x, y]) => [x * scale, y * scale]);

  if (c.startShiftM) {
    const k = Math.round(c.startShiftM / (step * scale));
    pts = [...pts.slice(k), ...pts.slice(0, k)];
  }

  // Control points every ~10 m; buildTrack splines and resamples them.
  const control = pts.filter((_, i) => i % 5 === 0).map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as Vec2);
  return {
    id: c.id,
    name: c.name,
    version: 1,
    widthMeters: c.widthMeters,
    samples: Math.round(feature.properties.length / 2.5),
    controlPoints: control,
    source: {
      kind: "geojson",
      notes: `bacinger/f1-circuits (MIT) ${c.sourceId}: ${feature.properties.Name}, ${feature.properties.Location}. Scaled ×${scale.toFixed(4)} to ${feature.properties.length} m.`,
    },
  };
}
