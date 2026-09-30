import type { GameTrack } from "@apex/engine";

export interface TrackInfo {
  id: string;
  name: string;
  country: string;
}

/** Display catalog (venue names only). Order = picker order. */
export const CATALOG: TrackInfo[] = [
  { id: "monza", name: "Monza", country: "Italy" },
  { id: "spa", name: "Spa-Francorchamps", country: "Belgium" },
  { id: "silverstone", name: "Silverstone", country: "Great Britain" },
  { id: "suzuka", name: "Suzuka", country: "Japan" },
  { id: "monaco", name: "Monaco", country: "Monaco" },
  { id: "interlagos", name: "Interlagos", country: "Brazil" },
  { id: "hungaroring", name: "Hungaroring", country: "Hungary" },
  { id: "red-bull-ring", name: "Spielberg", country: "Austria" },
  { id: "zandvoort", name: "Zandvoort", country: "Netherlands" },
  { id: "austin", name: "Austin", country: "United States" },
  { id: "barcelona", name: "Barcelona", country: "Spain" },
  { id: "imola", name: "Imola", country: "Italy" },
  { id: "kestrel", name: "Kestrel", country: "Test circuit" },
];

const files = import.meta.glob<GameTrack>("../../../../data/tracks/*.json", { import: "default" });

export async function loadTrack(id: string): Promise<GameTrack> {
  const key = Object.keys(files).find((k) => k.endsWith(`/${id}.v1.json`));
  if (!key) throw new Error(`Unknown track "${id}"`);
  return files[key]();
}
