import { loadBakedMaterials } from "./bakedMaterials";

/** Start fetching the day's materials while the player is still in the hub. */
export function prewarm(trackId: string, wet: boolean) {
  void loadBakedMaterials(trackId, wet);
}
