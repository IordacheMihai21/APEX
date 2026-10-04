import { trackMaterials } from "./scenery";
import { worldMaterials } from "./surroundings";

/**
 * Make a circuit's textures ahead of time, one per idle slot, so opening the
 * race doesn't freeze the page for the ~0.8 s (several seconds on a slow
 * phone) it takes to generate them all at once. The generators are memoised:
 * whatever is done here is free when the scene is built; anything not done
 * yet is simply made then. Safe to call more than once.
 */
export function prewarm(trackId: string, wet: boolean) {
  const jobs = [...Object.values(trackMaterials(wet)), ...Object.values(worldMaterials(trackId, wet))];
  const idle: (cb: () => void) => void =
    typeof requestIdleCallback === "function" ? (cb) => requestIdleCallback(cb, { timeout: 2000 }) : (cb) => setTimeout(cb, 50);
  const next = () => {
    const job = jobs.shift();
    if (!job) return;
    job();
    idle(next);
  };
  idle(next);
}
