/** A 2D point in track metres. */
export type Vec2 = [number, number];

export interface TrackCorner {
  id: number;
  name: string; // "T1", "T2", ...
  direction: "left" | "right";
  /** Centerline indices of the curved region and its tightest point. */
  startIndex: number;
  apexIndex: number;
  endIndex: number;
  startDistance: number;
  apexDistance: number;
  endDistance: number;
  /**
   * Start of this corner's timing segment. Segments partition the lap:
   * corner j owns [timingStartIndex_j, timingStartIndex_{j+1}), i.e. its
   * braking zone, the corner, and the straight after it, so exit speed is
   * credited to the corner that produced it.
   */
  timingStartIndex: number;
}

export interface TrackSector {
  id: number;
  startIndex: number;
  endIndex: number; // exclusive
}

/**
 * Stable, source-agnostic game track format (see docs/ARCHITECTURE.md).
 * Everything the engine needs at runtime lives here; derived arrays
 * (normals, distances, fitting basis) are recomputed on load.
 */
export interface GameTrack {
  format: "apex-track";
  formatVersion: 1;
  id: string;
  name: string;
  version: number;
  closed: true;
  direction: "ccw" | "cw";
  lengthMeters: number;
  widthMeters: number;
  centerline: Vec2[];
  leftBoundary: Vec2[];
  rightBoundary: Vec2[];
  corners: TrackCorner[];
  sectors: TrackSector[];
  /** Centerline indices where the racing line's lateral offset is a free parameter. */
  lineKnots: number[];
  /**
   * Player controls: corner groups and their gates (see line/controls.ts).
   * Stored so client, server and optimiser always agree; the optimal line
   * is computed within this control space, so the target is reachable.
   */
  controls?: { complexes: import("../line/controls").Complex[] };
  optimalLine: { knotOffsets: number[] } | null;
  optimalTimeMs: number | null;
  /** The best line and its lap in other conditions (see physics/car.ts CONDITION_CARS); dry uses the fields above. */
  conditions?: Partial<Record<"wet" | "lowdf", { optimalLine: { knotOffsets: number[] }; optimalTimeMs: number }>>;
  physicsVersion: string;
  carModel: string;
  source: { kind: "original" | "geojson" | "svg" | "telemetry" | "procedural"; notes?: string };
}
