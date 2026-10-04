import { useEffect, useState } from "react";
import type { Condition } from "@apex/engine";

/**
 * The Daily Quali board (Supabase). Anonymous: a random id made on this
 * device, no account. The app sends the line it raced, never a time; the
 * server re-simulates it (supabase/functions/submit-lap). Everything here
 * fails quietly: offline, or without the env vars, the game simply has no board.
 */
const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const ONLINE = !!URL_ && !!KEY;

export interface Standing {
  /** this device's best lap on the board, ms */
  yourBestMs: number;
  players: number;
  /** players with a faster lap than yours */
  faster: number;
  bestMs: number;
  medianMs: number;
}

const DEVICE_KEY = "apex.device";
const CACHE_KEY = "apex.standing.v1";
const EVENT = "apex:standing";

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

type Board = { day: string; trackId: string; condition: Condition };
const cacheId = (b: Board) => `${b.day}|${b.trackId}|${b.condition}`;

function readCache(): Record<string, Standing> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeCache(b: Board, s: Standing) {
  try {
    const all = readCache();
    all[cacheId(b)] = s;
    // keep the last few days only
    const keys = Object.keys(all).sort().slice(-14);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keys.map((k) => [k, all[k]]))));
  } catch {
    /* no cache, no harm */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: cacheId(b) }));
}

const headers = () => ({ apikey: KEY!, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" });

/** Send the day's best line; the server times it and answers with where you stand. */
export async function submitDailyLine(b: Board, knots: number[]): Promise<Standing | null> {
  if (!ONLINE) return null;
  try {
    const res = await fetch(`${URL_}/functions/v1/submit-lap`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ day: b.day, trackId: b.trackId, condition: b.condition, deviceId: deviceId(), knots }),
    });
    if (!res.ok) return null;
    const s = (await res.json()) as Standing;
    writeCache(b, s);
    return s;
  } catch {
    return null;
  }
}

/** Refresh the standing for a lap already on the board (others keep playing after you). */
export async function refreshStanding(b: Board, yourBestMs: number): Promise<Standing | null> {
  if (!ONLINE) return null;
  try {
    const res = await fetch(`${URL_}/rest/v1/rpc/daily_standing`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ p_day: b.day, p_track: b.trackId, p_condition: b.condition, p_lap_ms: yourBestMs }),
    });
    if (!res.ok) return null;
    const [row] = (await res.json()) as { players: number; faster: number; best_ms: number; median_ms: number }[];
    if (!row || !row.players) return null;
    const s: Standing = { yourBestMs, players: row.players, faster: row.faster, bestMs: row.best_ms, medianMs: row.median_ms };
    writeCache(b, s);
    return s;
  } catch {
    return null;
  }
}

export function cachedStanding(b: Board): Standing | null {
  return readCache()[cacheId(b)] ?? null;
}

/** The standing for a board, kept current as submissions and refreshes land. */
export function useStanding(b: Board | null): Standing | null {
  const id = b ? cacheId(b) : "";
  const [s, setS] = useState<Standing | null>(() => (b ? cachedStanding(b) : null));
  useEffect(() => {
    if (!b) return;
    setS(cachedStanding(b));
    const on = (e: Event) => (e as CustomEvent<string>).detail === id && setS(cachedStanding(b));
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return s;
}

/** "Faster than 73% of today's 412 players", or the first-on-the-board line. */
export function standingLine(s: Standing): string {
  if (s.players <= 1) return "First on today's board. Check back as others drive.";
  if (s.faster === 0) return `Fastest of today's ${s.players} players.`;
  const beat = s.players - s.faster - 1;
  const pct = Math.round((100 * beat) / (s.players - 1));
  return `Faster than ${pct}% of today's ${s.players} players.`;
}
