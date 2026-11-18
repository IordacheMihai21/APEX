import type { DraftRun, DraftStore } from "./draftSeason";

const KEY = "apex.draft-season.v2";
let memory: DraftStore | null = null;

export function readDraft(): DraftStore {
  if (memory) return memory;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "null") as DraftStore | null;
    if (stored && typeof stored.played === "number") return stored;
  } catch { /* use an empty store */ }
  return { run: null, bestWins: 0, played: 0 };
}
export function saveDraft(store: DraftStore): DraftStore {
  memory = store;
  try { localStorage.setItem(KEY, JSON.stringify(store)); }
  catch { /* keep the current run in memory */ }
  return store;
}
export function saveRun(run: DraftRun): DraftStore { return saveDraft({ ...readDraft(), run }); }
export function clearDraft(): DraftStore { return saveDraft({ ...readDraft(), run: null }); }
