import type { TrackSpec } from "@apex/engine";

/**
 * Original APEX circuits. Coordinates in metres, counter-clockwise,
 * first point = start/finish on the main straight.
 */

/** Kestrel: long straight → hairpin → medium esses → flat sweeper → tight left onto the straight. */
export const KESTREL: TrackSpec = {
  id: "kestrel",
  name: "Kestrel",
  version: 1,
  widthMeters: 12,
  samples: 1000,
  source: { kind: "original", notes: "Hand-designed test circuit for physics validation (Phase 1)." },
  controlPoints: [
    [0, 0], [300, 0], [600, 0], [820, 0],
    [880, 20], [890, 60], [860, 85], [810, 80],
    [740, 70], [680, 100], [640, 160],
    [560, 230], [430, 280], [280, 290],
    [150, 270], [80, 230],
    [40, 180], [-20, 150], [-70, 110],
    [-90, 50], [-60, 5],
  ],
};

export const TRACKS: TrackSpec[] = [KESTREL];
