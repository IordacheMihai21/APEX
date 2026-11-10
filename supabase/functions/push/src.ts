/**
 * push: the daily reminder.
 *
 * The app subscribes a browser to Web Push with the hour the player picked and their time zone; nothing else is
 * kept (no account, no device id, no IP). Every hour pg_cron calls this function with the cron secret, and it sends
 * the reminder to every subscription whose chosen hour it now is, unless today's reminder already went out or the
 * player has already played today. A subscription the push service says is gone (404/410) is deleted.
 *
 * Actions (POST JSON): subscribe {sub, tz, hour, lang}, unsubscribe {endpoint}, played {endpoint, day},
 * send (cron only, x-cron-secret header). Built into index.ts by `npm run build:functions`.
 *
 * The VAPID key pair and the cron secret live in Supabase Vault (push_vapid_public, push_vapid_private,
 * push_cron_secret), read through public.push_config(), which only the service role may call.
 */
import webpush from "npm:web-push@3.6.7";
import { type ReminderLang, type ReminderRow, pushEndpointOk, reminderDue, reminderMessage, validTimeZone } from "../../../apps/web/src/push/when";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

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

const MAX_BODY_BYTES = 4_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^[A-Za-z0-9_-]{1,200}$/;

/** The table, through PostgREST with the service key (the table has RLS on and no policies, so only this reaches it). */
async function db(path: string, init: RequestInit & { prefer?: string } = {}) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("missing server configuration");
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.prefer ? { Prefer: init.prefer } : {}) },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
const byEndpoint = (endpoint: string) => `push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`;

type Config = { vapid_public: string | null; vapid_private: string | null; cron_secret: string | null };
let cached: Config | null = null;
/** The keys and the cron secret, from Vault (once per instance). */
async function config(): Promise<Config> {
  cached ??= (await db("rpc/push_config", { method: "POST", body: "{}" })) as Config;
  return cached;
}

type Row = ReminderRow & { endpoint: string; p256dh: string; auth: string; lang: ReminderLang };

async function sendDue(): Promise<{ sent: number; gone: number; failed: number }> {
  const { vapid_public, vapid_private } = await config();
  if (!vapid_public || !vapid_private) throw new Error("missing VAPID keys");
  webpush.setVapidDetails("https://lapdle.com", vapid_public, vapid_private);

  const rows = (await db("push_subscriptions?select=endpoint,p256dh,auth,tz,hour,lang,last_sent,last_played")) as Row[];
  const now = new Date();
  let sent = 0,
    gone = 0,
    failed = 0;
  await Promise.all(
    rows.map(async (row) => {
      const day = reminderDue(row, now);
      if (!day) return;
      const msg = reminderMessage(row.lang, day);
      try {
        await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify({ ...msg, tag: "daily" }), { TTL: 6 * 3600, urgency: "normal", topic: "daily" });
        await db(byEndpoint(row.endpoint), { method: "PATCH", body: JSON.stringify({ last_sent: day }) });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db(byEndpoint(row.endpoint), { method: "DELETE" });
          gone++;
        } else {
          failed++;
          console.error("push failed", status, (e as Error).message);
        }
      }
    }),
  );
  return { sent, gone, failed };
}

Deno.serve(async (req) => {
  CORS = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { error: "too large" });
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "invalid JSON" });
  }

  try {
    if (body.action === "send") {
      const secret = (await config()).cron_secret;
      if (!secret || req.headers.get("x-cron-secret") !== secret) return json(403, { error: "forbidden" });
      return json(200, await sendDue());
    }

    if (body.action === "subscribe") {
      const sub = body.sub as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
      const endpoint = String(sub?.endpoint ?? "");
      const p256dh = String(sub?.keys?.p256dh ?? "");
      const auth = String(sub?.keys?.auth ?? "");
      const tz = String(body.tz ?? "");
      const hour = Number(body.hour);
      const lang = body.lang === "es" ? "es" : "en";
      if (!pushEndpointOk(endpoint) || !KEY.test(p256dh) || !KEY.test(auth) || !validTimeZone(tz) || !Number.isInteger(hour) || hour < 0 || hour > 23) {
        return json(400, { error: "invalid subscription" });
      }
      await db("push_subscriptions?on_conflict=endpoint", {
        method: "POST",
        prefer: "resolution=merge-duplicates",
        body: JSON.stringify({ endpoint, p256dh, auth, tz, hour, lang }),
      });
      return json(200, { ok: true });
    }

    const endpoint = String(body.endpoint ?? "");
    if (!pushEndpointOk(endpoint)) return json(400, { error: "invalid endpoint" });

    if (body.action === "unsubscribe") {
      await db(byEndpoint(endpoint), { method: "DELETE" });
      return json(200, { ok: true });
    }

    if (body.action === "played") {
      const day = String(body.day ?? "");
      if (!DAY.test(day) || Math.abs(Date.parse(`${day}T12:00:00Z`) - Date.now()) > 36 * 3600 * 1000) return json(400, { error: "invalid day" });
      await db(byEndpoint(endpoint), { method: "PATCH", body: JSON.stringify({ last_played: day }) });
      return json(200, { ok: true });
    }

    return json(400, { error: "unknown action" });
  } catch (e) {
    console.error(e);
    return json(500, { error: "server error" });
  }
});
