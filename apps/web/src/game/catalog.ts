import type { GameTrack } from "@apex/engine";
import type { SceneryData } from "./surroundings";

export interface TrackInfo {
  id: string;
  name: string;
  country: string;
  /** Street circuits get walls tight to the track instead of run-off. */
  style?: "permanent" | "street";
  flag: string;
}

/** Display catalog (venue names only). Order = picker order. */
export const CATALOG: TrackInfo[] = [
  { id: "monza", name: "Monza", country: "Italy", flag: "🇮🇹" },
  { id: "spa", name: "Spa-Francorchamps", country: "Belgium", flag: "🇧🇪" },
  { id: "silverstone", name: "Silverstone", country: "Great Britain", flag: "🇬🇧" },
  { id: "suzuka", name: "Suzuka", country: "Japan", flag: "🇯🇵" },
  { id: "monaco", name: "Monaco", country: "Monaco", style: "street", flag: "🇲🇨" },
  { id: "interlagos", name: "Interlagos", country: "Brazil", flag: "🇧🇷" },
  { id: "hungaroring", name: "Hungaroring", country: "Hungary", flag: "🇭🇺" },
  { id: "red-bull-ring", name: "Spielberg", country: "Austria", flag: "🇦🇹" },
  { id: "zandvoort", name: "Zandvoort", country: "Netherlands", flag: "🇳🇱" },
  { id: "austin", name: "Austin", country: "United States", flag: "🇺🇸" },
  { id: "barcelona", name: "Barcelona", country: "Spain", flag: "🇪🇸" },
  { id: "imola", name: "Imola", country: "Italy", flag: "🇮🇹" },
  { id: "kestrel", name: "Kestrel", country: "Test circuit", flag: "🏁" },
];

const files = import.meta.glob<GameTrack>("../../../../data/tracks/*.json", { import: "default" });

export async function loadTrack(id: string): Promise<GameTrack> {
  const key = Object.keys(files).find((k) => k.endsWith(`/${id}.v1.json`));
  if (!key) throw new Error(`Unknown track "${id}"`);
  return files[key]();
}

const scenery = import.meta.glob<SceneryData>("../../../../data/scenery/*.json", { import: "default" });

/** The circuit's real surroundings (OpenStreetMap), or null where none were imported. */
export async function loadScenery(id: string): Promise<SceneryData | null> {
  const key = Object.keys(scenery).find((k) => k.endsWith(`/${id}.json`));
  return key ? scenery[key]() : null;
}
