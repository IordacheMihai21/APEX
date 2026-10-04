/**
 * submit-lap: the Daily Quali leaderboard's only way in.
 *
 * The app sends the day, the circuit, the conditions, a random device id and
 * the LINE it raced (knot offsets), never a time. This function re-simulates
 * that line with the game's own deterministic engine and the condition's car,
 * so the time on the board is exactly what the line drives and can't be made
 * up. It keeps each device's best lap per day and answers with the standing.
 *
 * Built into index.ts by `npm run build:functions` (esbuild bundles the
 * engine and the circuits), deployed with the Supabase CLI.
 */
import {
  CONDITION_CARS,
  type Condition,
  type GameTrack,
  PHYSICS_VERSION,
  expandGates,
  prepareTrack,
  simulateLap,
  trackControls,
  usableHalfWidth,
} from "../../../packages/engine/src/index";
import austin from "../../../data/tracks/austin.v1.json";
import barcelona from "../../../data/tracks/barcelona.v1.json";
import hungaroring from "../../../data/tracks/hungaroring.v1.json";
import imola from "../../../data/tracks/imola.v1.json";
import interlagos from "../../../data/tracks/interlagos.v1.json";
import monaco from "../../../data/tracks/monaco.v1.json";
import monza from "../../../data/tracks/monza.v1.json";
import redBullRing from "../../../data/tracks/red-bull-ring.v1.json";
import silverstone from "../../../data/tracks/silverstone.v1.json";
import spa from "../../../data/tracks/spa.v1.json";
import suzuka from "../../../data/tracks/suzuka.v1.json";
import zandvoort from "../../../data/tracks/zandvoort.v1.json";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const TRACKS: Record<string, GameTrack> = Object.fromEntries(
  [austin, barcelona, hungaroring, imola, interlagos, monaco, monza, redBullRing, silverstone, spa, suzuka, zandvoort].map((t) => [(t as GameTrack).id, t as GameTrack]),
);
const prepared = new Map<string, { pt: ReturnType<typeof prepareTrack>; ctl: ReturnType<typeof trackControls> }>();

/**
 * Browsers may only call this from the game's own pages: ALLOWED_ORIGINS
 * (comma-separated, set as a function secret) once the site has a domain;
 * without it any origin is answered (development). CORS doesn't stop scripts,
 * so the rate limits below do the real work.
 */
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((o) => o.trim()).filter(Boolean);
function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED.length === 0 ? "*" : ALLOWED.includes(origin) ? origin : ALLOWED[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
let CORS: Record<string, string> = {};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** Limits: per device per day, per IP per hour (the IP only ever as a salted hash). */
const DEVICE_PER_DAY = 60;
const IP_PER_HOUR = 300;
const MAX_BODY_BYTES = 16_000;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function withinLimits(req: Request, deviceId: string): Promise<boolean> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const salt = Deno.env.get("RATE_SALT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ipKey = `ip:${(await sha256(`${salt}|${new Date().toISOString().slice(0, 10)}|${ip}`)).slice(0, 32)}`;
  const [okIp, okDevice] = await Promise.all([
    rpc("take_submit_slot", { p_key: ipKey, p_window_seconds: 3600, p_limit: IP_PER_HOUR }),
    rpc("take_submit_slot", { p_key: `d:${deviceId}`, p_window_seconds: 86400, p_limit: DEVICE_PER_DAY }),
  ]);
  return okIp === true && okDevice === true;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Only today's daily (with a day either side for time zones) can be submitted. */
function plausibleDay(day: string): boolean {
  if (!DAY.test(day)) return false;
  const diff = Math.abs(Date.parse(`${day}T12:00:00Z`) - Date.now());
  return diff <= 36 * 3600 * 1000;
}

async function rpc(name: string, args: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("missing server configuration");
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req) => {
  CORS = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  let body: { action?: unknown; day?: unknown; trackId?: unknown; condition?: unknown; deviceId?: unknown; knots?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { error: "too large" });
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "invalid JSON" });
  }

  // right to erasure: a device can remove everything it put on the board
  if (body.action === "forget") {
    if (typeof body.deviceId !== "string" || !UUID.test(body.deviceId)) return json(400, { error: "deviceId" });
    try {
      if (!(await withinLimits(req, body.deviceId))) return json(429, { error: "too many requests" });
      const removed = await rpc("forget_device", { p_device: body.deviceId });
      return json(200, { removed: removed ?? 0 });
    } catch (e) {
      return json(500, { error: (e as Error).message });
    }
  }

  const { day, trackId, condition, deviceId, knots } = body;
  if (typeof day !== "string" || !plausibleDay(day)) return json(400, { error: "day" });
  if (typeof trackId !== "string" || !TRACKS[trackId]) return json(400, { error: "trackId" });
  if (condition !== "dry" && condition !== "wet" && condition !== "lowdf") return json(400, { error: "condition" });
  if (typeof deviceId !== "string" || !UUID.test(deviceId)) return json(400, { error: "deviceId" });

  const track = TRACKS[trackId];
  let p = prepared.get(trackId);
  if (!p) {
    const pt = prepareTrack(track);
    p = { pt, ctl: trackControls(pt) };
    prepared.set(trackId, p);
  }
  const { pt, ctl } = p;
  if (!Array.isArray(knots) || knots.length !== pt.k || !knots.every((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 50)) {
    return json(400, { error: "knots" });
  }

  // the same projection the game applies (track limits, player gates), then the lap
  const car = CONDITION_CARS[condition as Condition];
  const line = expandGates(pt, ctl, knots as number[], usableHalfWidth(pt, car));
  const sim = simulateLap({ track: pt, line: { knotOffsets: line }, car });
  if (!sim.valid) return json(422, { error: "line is not valid" });
  const lapMs = Math.round(sim.lapTimeMs);

  try {
    if (!(await withinLimits(req, deviceId))) return json(429, { error: "too many requests" });
    // storage limitation: now and then, drop results older than the retention period
    if (Math.random() < 0.02) await rpc("prune_leaderboard", {}).catch(() => {});
    // the board ranks each device by its best lap of the day, which may be an earlier one
    const best: number = (await rpc("record_daily_lap", {
      p_day: day,
      p_track: trackId,
      p_condition: condition,
      p_device: deviceId,
      p_lap_ms: lapMs,
      p_knots: line.map((v) => Math.round(v * 100) / 100),
      p_physics: PHYSICS_VERSION,
    })) ?? lapMs;
    const rows = await rpc("daily_standing", { p_day: day, p_track: trackId, p_condition: condition, p_lap_ms: best });
    const s = rows?.[0] ?? { players: 1, faster: 0, best_ms: best, median_ms: best };
    return json(200, { lapMs, yourBestMs: best, players: s.players, faster: s.faster, bestMs: s.best_ms, medianMs: s.median_ms });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
