import { resolve } from "node:path";
import type { TrackSpec } from "@apex/engine";
import { type RealCircuit, circuitToSpec, loadFeatures } from "./import-geojson";

/**
 * Real circuits in the game. Direction verified against known race
 * direction (point-order orientation) and by eye on rendered previews.
 * Widths are typical for each venue; the engine uses one constant width.
 * Names are venue/location names only (see docs/DATA_SOURCES.md).
 */
export const REAL_CIRCUITS: RealCircuit[] = [
  { sourceId: "it-1922", id: "monza", name: "Monza", country: "IT", widthMeters: 14 },
  { sourceId: "be-1925", id: "spa", name: "Spa-Francorchamps", country: "BE", widthMeters: 14 },
  { sourceId: "gb-1948", id: "silverstone", name: "Silverstone", country: "GB", widthMeters: 15 },
  { sourceId: "jp-1962", id: "suzuka", name: "Suzuka", country: "JP", widthMeters: 13 },
  { sourceId: "mc-1929", id: "monaco", name: "Monaco", country: "MC", widthMeters: 10 },
  { sourceId: "br-1940", id: "interlagos", name: "Interlagos", country: "BR", widthMeters: 14 },
  { sourceId: "hu-1986", id: "hungaroring", name: "Hungaroring", country: "HU", widthMeters: 13 },
  { sourceId: "at-1969", id: "red-bull-ring", name: "Spielberg", country: "AT", widthMeters: 14 },
  { sourceId: "nl-1948", id: "zandvoort", name: "Zandvoort", country: "NL", widthMeters: 12 },
  { sourceId: "us-2012", id: "austin", name: "Austin", country: "US", widthMeters: 15 },
  { sourceId: "es-1991", id: "barcelona", name: "Barcelona", country: "ES", widthMeters: 14 },
  { sourceId: "it-1953", id: "imola", name: "Imola", country: "IT", widthMeters: 13 },
];

const RAW = resolve(import.meta.dirname, "../../../data/raw/bacinger/f1-circuits.geojson");

export function realCircuitSpecs(): TrackSpec[] {
  const features = loadFeatures(RAW);
  return REAL_CIRCUITS.map((c) => {
    const f = features.get(c.sourceId);
    if (!f) throw new Error(`unknown source circuit ${c.sourceId}`);
    return circuitToSpec(f, c);
  });
}
