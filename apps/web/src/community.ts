import { useEffect, useState } from "react";
import { C } from "./game/palette";
import { playedDays } from "./games/profile";
import { dateKey } from "./modes/schedule";
import { ONLINE, deviceId, headers, myNickname } from "./online";
import { track } from "./analytics";

/**
 * The community layer, all anonymous:
 * - Road to 1,000: each device that plays a daily game (drives a Daily Quali lap or finishes any daily game) is counted once for the day (submit-lap "played"), and the
 *   hub shows today's total against the goal.
 * - Invites: every device has its own random invite code (not its device id) in the links it shares (?inv=). A friend
 *   who arrives on one, has never played before and plays a daily game (a Daily Quali lap, or any daily game finished) is
 *   credited to that code, once.
 * - Rewards: 1 friend in unlocks the Magenta player colour, 3 unlock Cyan, 10 put a gold star next to the inviter's
 *   board nickname. The friend gets Magenta too. Colours only change how your line and buttons look.
 * Everything fails quietly: offline, the game plays the same.
 */
const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const ROAD_GOAL = 1000;

const CODE_KEY = "apex.invite.code";
const FROM_KEY = "apex.invite.from";
const PLAYED_KEY = "apex.road.played";
const UNLOCK_KEY = "apex.rewards";
const COLOUR_KEY = "apex.colour";
const EVENT = "apex:community";
const CODE = /^[a-z0-9]{10}$/;

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* not kept */
    }
  },
  del: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* nothing to drop */
    }
  },
};
const notify = () => typeof window !== "undefined" && window.dispatchEvent(new CustomEvent(EVENT));

/** This device's invite code, made on first use: ten random letters and digits. */
export function myInviteCode(): string {
  const saved = store.get(CODE_KEY);
  if (saved && CODE.test(saved)) return saved;
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const code = Array.from(bytes, (b) => abc[b % abc.length]).join("");
  store.set(CODE_KEY, code);
  return code;
}

/** The query part every shared link carries so a friend who plays counts for you. */
export const inviteParam = () => `inv=${myInviteCode()}`;

// Arrival on a friend's link: kept only for a device that has never played and isn't the inviter itself.
if (typeof location !== "undefined") {
  const inv = new URLSearchParams(location.search).get("inv");
  if (inv && CODE.test(inv) && inv !== store.get(CODE_KEY) && !store.get(FROM_KEY) && playedDays().size === 0) store.set(FROM_KEY, inv);
}
/** Came in on a friend's invite that hasn't been credited yet. */
export const invitedBy = () => store.get(FROM_KEY);

// ---- rewards -------------------------------------------------------------------------------------------------------
export interface PlayerColour {
  id: "papaya" | "magenta" | "cyan" | "red" | "blue" | "sky" | "green" | "lime" | "yellow" | "white" | "silver" | "purple" | "gold";
  name: string;
  hex: string;
  /** friends needed to unlock it (0: everyone) */
  need: number;
}
export const COLOURS: PlayerColour[] = [
  { id: "papaya", name: "Papaya", hex: "#ff6a13", need: 0 },
  { id: "magenta", name: "Magenta", hex: "#ff4fa3", need: 1 },
  // three friends who played: any car colour (the team grid's cars and the player's line, public/cars/<id>.webp)
  { id: "cyan", name: "Cyan", hex: "#22d3d3", need: 3 },
  { id: "red", name: "Red", hex: "#e5332a", need: 3 },
  { id: "blue", name: "Blue", hex: "#3b7bff", need: 3 },
  { id: "sky", name: "Sky", hex: "#4fb3ff", need: 3 },
  { id: "green", name: "Green", hex: "#1fbf62", need: 3 },
  { id: "lime", name: "Lime", hex: "#a6e22e", need: 3 },
  { id: "yellow", name: "Yellow", hex: "#f5c518", need: 3 },
  { id: "white", name: "White", hex: "#eef0f2", need: 3 },
  { id: "silver", name: "Silver", hex: "#aab3bd", need: 3 },
  { id: "purple", name: "Purple", hex: "#8a5cff", need: 3 },
  { id: "gold", name: "Gold", hex: "#e0b33c", need: 3 },
];
export const BADGE_FRIENDS = 10;

interface Unlocks {
  colours: PlayerColour["id"][];
  badge: boolean;
  friends: number;
  gift: boolean;
}
export function unlocks(): Unlocks {
  try {
    const u = JSON.parse(store.get(UNLOCK_KEY) ?? "{}") as Partial<Unlocks>;
    return { colours: Array.isArray(u.colours) ? u.colours : [], badge: !!u.badge, friends: Number(u.friends) || 0, gift: !!u.gift };
  } catch {
    return { colours: [], badge: false, friends: 0, gift: false };
  }
}
function saveUnlocks(u: Unlocks) {
  store.set(UNLOCK_KEY, JSON.stringify(u));
  notify();
}
export const colourUnlocked = (id: PlayerColour["id"]) => id === "papaya" || unlocks().colours.includes(id);

/** Unlock what a friend count earns (never takes anything back). */
function grant(friends: number, gift = false) {
  const u = unlocks();
  const colours = new Set(u.colours);
  for (const c of COLOURS) if (c.need > 0 && friends >= c.need) colours.add(c.id);
  if (gift) colours.add("magenta");
  saveUnlocks({ colours: [...colours], badge: u.badge || friends >= BADGE_FRIENDS, friends: Math.max(u.friends, friends), gift: u.gift || gift });
}

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
/** The player colour picked on this device (Papaya when none, or when the pick isn't unlocked). */
export function playerColour(): PlayerColour {
  const id = store.get(COLOUR_KEY) as PlayerColour["id"] | null;
  return COLOURS.find((c) => c.id === id && colourUnlocked(c.id)) ?? COLOURS[0];
}
/**
 * Paint the player's colour: the line, the car marker and the primary buttons. Papaya leaves the page's own colour
 * alone (so the seasonal themes keep theirs).
 */
export function applyPlayerColour() {
  if (typeof document === "undefined") return;
  const c = playerColour();
  const root = document.documentElement.style;
  if (c.id === "papaya") {
    root.removeProperty("--color-ink");
    root.removeProperty("--color-ink-hot");
    return;
  }
  root.setProperty("--color-ink", c.hex);
  root.setProperty("--color-ink-hot", c.hex);
  C.ink = c.hex;
  C.inkDim = rgba(c.hex, 0.35);
}
export function setPlayerColour(id: PlayerColour["id"]) {
  if (!colourUnlocked(id)) return;
  store.set(COLOUR_KEY, id);
  track("Colour", { colour: id });
  void syncCarColour();
  // back to Papaya: reload the canvas colours from the theme
  if (id === "papaya") location.reload();
  else applyPlayerColour();
  notify();
}

/** The car on the team grid takes the player's colour (a named driver only; the server checks the three friends). */
export async function syncCarColour(): Promise<void> {
  if (!myNickname()) return;
  await rpc<string>("set_colour", { p_device: deviceId(), p_code: myInviteCode(), p_colour: playerColour().id });
}

// ---- network -------------------------------------------------------------------------------------------------------
async function rpc<T>(name: string, body: unknown): Promise<T | null> {
  if (!ONLINE) return null;
  try {
    const res = await fetch(`${URL_}/rest/v1/rpc/${name}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}
async function submit<T>(body: unknown): Promise<T | null> {
  if (!ONLINE || import.meta.env.DEV) return null;
  try {
    const res = await fetch(`${URL_}/functions/v1/submit-lap`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** A daily game was finished: count this device for today (once a day), and credit the invite it came in on. */
/**
 * Count this device for today's road to 1,000 (a Daily Quali lap, or any daily game finished), and credit the invite
 * it came in on. `finished` false holds the invite back (counting only); every caller now credits it.
 */
export async function roadPlayed(finished = true): Promise<void> {
  const day = dateKey();
  const invite = finished ? invitedBy() : null;
  if (store.get(PLAYED_KEY) === day && !invite) return;
  const r = await submit<{ credited: boolean }>({ action: "played", deviceId: deviceId(), day, invite });
  if (!r) return;
  store.set(PLAYED_KEY, day);
  if (invite) {
    store.del(FROM_KEY);
    if (r.credited) {
      grant(0, true);
      track("Invite credited", {});
    }
  }
  notify();
}

/** Today's players and the best day so far (null: unreachable). */
export async function fetchRoad(): Promise<{ today: number; best: number } | null> {
  const rows = await rpc<{ today: number; best: number }[]>("road_count", { p_day: dateKey() });
  return rows?.[0] ?? null;
}

/** How many friends came in on this device's invites and played; unlocks what that earns. */
export async function refreshInvites(): Promise<number | null> {
  const code = myInviteCode();
  const n = await rpc<number>("invite_count", { p_code: code });
  if (n === null) return null;
  const before = unlocks();
  grant(n);
  if (n >= BADGE_FRIENDS && !before.badge) void submit({ action: "badge", deviceId: deviceId(), code });
  return n;
}

/** The community state for a component: unlocks, friends and the current colour, kept current. */
export function useCommunity() {
  const read = () => ({ ...unlocks(), colour: playerColour() });
  const [s, setS] = useState(read);
  useEffect(() => {
    const on = () => setS(read());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return s;
}
