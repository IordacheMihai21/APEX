import { CIRCUITS, load, save, seeded } from "./circuits";
import { dailyNumber, dailyTrack, dateKey } from "./daily";
import { mysteryAnswer } from "./mystery";

/**
 * Order the corners: one circuit a day, its map with the start line and the
 * direction of travel, and six of its corners as shuffled tiles, each drawn
 * from the racing line exactly as it sits on the map. Put them in lap order;
 * each check marks the right slots, which stay, and there are four checks.
 * Never the day's Daily Quali or Mystery circuit.
 */
export const CORNERS_PER_DAY = 6;
export const ORDER_TRIES = 4;

type Pt = [number, number];

/** The points of an "M x yL x y…" path. */
export function points(d: string): Pt[] {
  const n = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const out: Pt[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]);
  return out;
}

const heading = (a: Pt, b: Pt) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));

export interface Corner {
  /** index of the corner group on the circuit (lap order) */
  group: number;
  /** the turn alone: the racing line around its sharpest point */
  path: Pt[];
  /** where it turns most, for numbering it on the map */
  apex: Pt;
  /** how much it turns, radians */
  turn: number;
}

/** Trim a corner group's line to the turn itself (the straight after it would give the answer away). */
export function cornerOf(group: number, d: string, radius = 120): Corner {
  const p = points(d);
  // sharpest point: the biggest change of heading over a short window
  let best = 0;
  let at = Math.floor(p.length / 2);
  for (let i = 2; i < p.length - 2; i++) {
    const change = Math.abs(wrap(heading(p[i], p[i + 2]) - heading(p[i - 2], p[i])));
    if (change > best) {
      best = change;
      at = i;
    }
  }
  const near = (q: Pt) => Math.hypot(q[0] - p[at][0], q[1] - p[at][1]) <= radius;
  let a = at;
  let b = at;
  while (a > 0 && near(p[a - 1])) a--;
  while (b < p.length - 1 && near(p[b + 1])) b++;
  const path = p.slice(a, b + 1);
  let turn = 0;
  for (let i = 1; i + 1 < path.length; i++) turn += wrap(heading(path[i], path[i + 1]) - heading(path[i - 1], path[i]));
  return { group, path, apex: p[at], turn: Math.abs(turn) };
}

/** Six corners spread around the lap, from the ones that really turn (lap order). */
export function pickCorners(corners: string[]): Corner[] {
  const all = corners.map((d, i) => cornerOf(i, d));
  const turning = all.filter((c) => c.turn >= (40 * Math.PI) / 180 && c.path.length >= 4);
  const pool = turning.length >= CORNERS_PER_DAY ? turning : all;
  if (pool.length <= CORNERS_PER_DAY) return pool;
  // evenly through the lap
  return Array.from({ length: CORNERS_PER_DAY }, (_, k) => pool[Math.floor((k * pool.length) / CORNERS_PER_DAY)]);
}

/** The day's circuit: never the Daily Quali's or the Mystery circuit's. */
export function orderCircuit(key = dateKey()): string {
  const taken = new Set([dailyTrack(key), mysteryAnswer(key)]);
  const ids = CIRCUITS.map((c) => c.id).filter((id) => !taken.has(id));
  const rand = seeded(dailyNumber(key) * 48_271 + 11);
  return ids[Math.floor(rand() * ids.length)];
}

/** The tiles' starting order (positions into the lap-ordered corners), the same for everyone and never already right. */
export function trayOrder(n: number, key = dateKey()): number[] {
  const rand = seeded(dailyNumber(key) * 69_621 + 3);
  for (;;) {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (a.some((v, i) => v !== i)) return a;
  }
}

/** Which slots of a guess are right (a guess lists, per slot, the lap position of the corner put there). */
export const marks = (guess: number[]) => guess.map((v, i) => v === i);
export const solved = (guess: number[]) => marks(guess).every(Boolean);

const KEY = "apex.order.v1";
export interface OrderRecord {
  days: Record<string, number[][]>;
}
const loadDays = () => load<OrderRecord>(KEY, { days: {} }).days;

export const orderTries = (key = dateKey()): number[][] => loadDays()[key] ?? [];
export const orderOver = (tries: number[][]) => tries.length >= ORDER_TRIES || tries.some(solved);
export const orderSolved = (tries: number[][]) => tries.some(solved);

/** Record a check; ignored once the day is over. */
export function recordTry(guess: number[], key = dateKey()): number[][] {
  const days = loadDays();
  const tries = days[key] ?? [];
  if (orderOver(tries)) return tries;
  const next = [...tries, guess];
  save(KEY, { days: { ...days, [key]: next } });
  return next;
}

export const orderDoneDays = () =>
  Object.entries(loadDays())
    .filter(([, t]) => orderOver(t))
    .map(([k]) => k);

export function orderStats() {
  const days = loadDays();
  const done = orderDoneDays();
  const won = done.filter((k) => orderSolved(days[k]));
  return { played: done.length, solved: won.length, average: won.length ? won.reduce((a, k) => a + days[k].length, 0) / won.length : null };
}

export function orderShare(tries: number[][], link: string, key = dateKey()): string {
  const result = orderSolved(tries) ? `${tries.length}/${ORDER_TRIES}` : `X/${ORDER_TRIES}`;
  return `Lapdle Order the corners #${dailyNumber(key)} ${result}\n${tries.map((t) => marks(t).map((m) => (m ? "🟩" : "⬛")).join("")).join("\n")}\n${link}`;
}
