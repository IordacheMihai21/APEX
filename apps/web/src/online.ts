import { useEffect, useState } from "react";
import { t } from "./i18n";
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

/** The anonymous id, if one was ever made on this device (shown on the privacy page). */
export function existingDeviceId(): string | null {
  try {
    return localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
}

/**
 * Right to erasure: remove every result this device put on the board, then
 * start over with a new id and no cached standings. Returns rows removed, or
 * null if the server couldn't be reached.
 */
export async function forgetThisDevice(): Promise<number | null> {
  const id = existingDeviceId();
  if (!ONLINE || !id) return 0;
  try {
    const res = await fetch(`${URL_}/functions/v1/submit-lap`, { method: "POST", headers: headers(), body: JSON.stringify({ action: "forget", deviceId: id }) });
    if (!res.ok) return null;
    const { removed } = (await res.json()) as { removed: number };
    localStorage.removeItem(DEVICE_KEY);
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem("apex.nickname");
    return removed;
  } catch {
    return null;
  }
}

/** This device's anonymous id, made on first use. */
export function deviceId(): string {
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

export const headers = () => ({ apikey: KEY!, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" });

/** Send the day's best line; the server times it and answers with where you stand. */
export async function submitDailyLine(b: Board, knots: number[]): Promise<Standing | null> {
  // only the live site puts laps on the board: test laps from a development build never do
  if (!ONLINE || import.meta.env.DEV) return null;
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
  if (s.players <= 1) return t("First on today's board. Check back as others drive.");
  if (s.faster === 0) return t("Fastest of today's {n} players.", { n: s.players });
  const beat = s.players - s.faster - 1;
  const pct = Math.round((100 * beat) / (s.players - 1));
  return t("Faster than {pct}% of today's {n} players.", { pct, n: s.players });
}

export interface LapRecord {
  trackId: string;
  condition: Condition;
  lapMs: number;
  day: string;
}
export interface BoardDay {
  day: string;
  trackId: string;
  condition: Condition;
  players: number;
  bestMs: number;
  medianMs: number;
}

async function rpc<T>(name: string, body: unknown): Promise<T | null> {
  if (!ONLINE) return null;
  try {
    const res = await fetch(`${URL_}/rest/v1/rpc/${name}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** The fastest lap ever on each circuit and condition, for this physics version (null: unreachable). */
export async function fetchRecords(physics: string): Promise<LapRecord[] | null> {
  const rows = await rpc<{ track_id: string; condition: Condition; lap_ms: number; day: string }[]>("lap_records", { p_physics: physics });
  return rows && rows.map((r) => ({ trackId: r.track_id, condition: r.condition, lapMs: r.lap_ms, day: r.day }));
}

/** Totals of each daily board over the last 30 days, newest first (null: unreachable). */
export async function fetchRecentBoards(): Promise<BoardDay[] | null> {
  const rows = await rpc<{ day: string; track_id: string; condition: Condition; players: number; best_ms: number; median_ms: number }[]>("recent_boards", { p_days: 30 });
  return rows && rows.map((r) => ({ day: r.day, trackId: r.track_id, condition: r.condition, players: r.players, bestMs: r.best_ms, medianMs: r.median_ms }));
}

// ---- named board -------------------------------------------------------------------------------------------------
const NICK_KEY = "apex.nickname";

export interface BoardRow {
  pos: number;
  nickname: string;
  lapMs: number;
  badge: boolean;
}

/** The nickname this device put on the board (null: none). */
export function myNickname(): string | null {
  try {
    return localStorage.getItem(NICK_KEY);
  } catch {
    return null;
  }
}

/** Today's named board: each named player's position among all of the day's players (null: unreachable). */
export async function fetchBoard(b: Board, limit = 10): Promise<BoardRow[] | null> {
  const rows = await rpc<{ pos: number; nickname: string; lap_ms: number; badge: boolean }[]>("daily_board", { p_day: b.day, p_track: b.trackId, p_condition: b.condition, p_limit: limit });
  return rows && rows.map((r) => ({ pos: r.pos, nickname: r.nickname, lapMs: r.lap_ms, badge: r.badge }));
}

/**
 * Put this device's laps on the board under a nickname (or take the name off with null). Resolves "ok", "taken"
 * (another player has it), "invalid" or "failed".
 */
export async function setNickname(nickname: string | null): Promise<"ok" | "taken" | "invalid" | "failed"> {
  if (!ONLINE) return "failed";
  try {
    const res = await fetch(`${URL_}/functions/v1/submit-lap`, { method: "POST", headers: headers(), body: JSON.stringify({ action: "nickname", deviceId: deviceId(), nickname }) });
    if (res.status === 409) return "taken";
    if (res.status === 400) return "invalid";
    if (!res.ok) return "failed";
    const { nickname: saved } = (await res.json()) as { nickname: string | null };
    if (saved) localStorage.setItem(NICK_KEY, saved);
    else localStorage.removeItem(NICK_KEY);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: "nickname" }));
    return "ok";
  } catch {
    return "failed";
  }
}

// ---- championship --------------------------------------------------------------------------------------------------
export interface ChampionRow {
  pos: number;
  nickname: string;
  /** Grands Prix (days with a daily game finished) this month */
  gps: number;
  /** current days in a row */
  streak: number;
  total: number;
  badge: boolean;
}

/** This month's Championship: the named players with the most Grands Prix (null: unreachable). */
export async function fetchChampionship(today: string, limit = 10): Promise<ChampionRow[] | null> {
  return rpc<ChampionRow[]>("championship", { p_today: today, p_limit: limit });
}

// ---- restore: the same player on another browser -------------------------------------------------------------------

const RESTORED_DAYS_KEY = "apex.restored.days";
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

/**
 * This device's restore link: opened in another browser (or after this one forgot the site), it brings back the
 * name, the Championship and the streak. It carries the anonymous device id, so it's the player's own key.
 */
export function restoreLink(): string {
  const origin = typeof location !== "undefined" ? location.origin : "https://lapdle.com";
  return `${origin}/?restore=${deviceId()}`;
}

/** The device id in a pasted restore link or code, or null. */
export function restoreCodeIn(text: string): string | null {
  return text.match(UUID_RE)?.[0].toLowerCase() ?? null;
}

/** A restore link this page was opened with (read before the app tidies the address), or null. */
export const RESTORE_ARRIVAL: string | null = typeof location !== "undefined" ? restoreCodeIn(new URLSearchParams(location.search).get("restore") ?? "") : null;

/** Days a restore brought back from the server (the streak counts them as played). */
export function restoredDays(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RESTORED_DAYS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
  } catch {
    return [];
  }
}

export interface RestorePreview {
  nickname: string | null;
  days: string[];
}

/** What a restore code would bring back: null when the code is unknown, "failed" when the server can't be reached. */
export async function previewRestore(code: string): Promise<RestorePreview | null | "failed"> {
  if (!ONLINE) return "failed";
  try {
    const res = await fetch(`${URL_}/rest/v1/rpc/restore_device`, { method: "POST", headers: headers(), body: JSON.stringify({ p_device: code }) });
    if (!res.ok) return "failed";
    const rows = (await res.json()) as { nickname: string | null; days: string[] }[];
    return rows[0] ? { nickname: rows[0].nickname, days: rows[0].days ?? [] } : null;
  } catch {
    return "failed";
  }
}

/** Become the device a restore code belongs to: its id, its name and its days. */
export function applyRestore(code: string, preview: RestorePreview) {
  try {
    localStorage.setItem(DEVICE_KEY, code);
    if (preview.nickname) localStorage.setItem(NICK_KEY, preview.nickname);
    else localStorage.removeItem(NICK_KEY);
    const days = new Set([...restoredDays(), ...preview.days]);
    localStorage.setItem(RESTORED_DAYS_KEY, JSON.stringify([...days].sort()));
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage is off: nothing to restore into */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}
