import { PHYSICS_VERSION } from "@apex/engine";

/** Personal bests live in localStorage, keyed so physics changes never mix results. */
export interface PersonalBest {
  lapTimeMs: number;
  knotOffsets: number[];
  at: number;
}

const key = (trackId: string, version: number) => `apex.pb.${trackId}.v${version}.p${PHYSICS_VERSION}`;

export function loadPB(trackId: string, version: number): PersonalBest | null {
  try {
    const raw = localStorage.getItem(key(trackId, version));
    return raw ? (JSON.parse(raw) as PersonalBest) : null;
  } catch {
    return null;
  }
}

export function savePB(trackId: string, version: number, pb: PersonalBest) {
  try {
    localStorage.setItem(key(trackId, version), JSON.stringify(pb));
  } catch {
    /* storage unavailable (private mode): PBs just don't persist */
  }
}

/** Minimal local event log for playtests (attempts per player is the key metric). */
export function logEvent(name: string, data: Record<string, unknown> = {}) {
  const entry = { name, at: Date.now(), ...data };
  if (import.meta.env.DEV) console.debug("[apex]", entry);
  try {
    const log = JSON.parse(localStorage.getItem("apex.events") ?? "[]") as unknown[];
    log.push(entry);
    localStorage.setItem("apex.events", JSON.stringify(log.slice(-1000)));
  } catch {
    /* ignore */
  }
}

/** Best time (ms) in each of the three sectors on a circuit, from any lap. */
const sectorKey = (trackId: string, version: number) => `apex.sectors.${trackId}.v${version}.p${PHYSICS_VERSION}`;

export function loadSectorBests(trackId: string, version: number): number[] | null {
  try {
    const raw = localStorage.getItem(sectorKey(trackId, version));
    return raw ? (JSON.parse(raw) as number[]) : null;
  } catch {
    return null;
  }
}

export function saveSectorBests(trackId: string, version: number, bests: number[]) {
  try {
    localStorage.setItem(sectorKey(trackId, version), JSON.stringify(bests));
  } catch {
    /* storage unavailable: sector bests just don't persist */
  }
}
