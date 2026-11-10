import { useEffect, useState } from "react";
import { track } from "./analytics";
import { LANG } from "./i18n";
import { isIos, standalone } from "./install";
import { dateKey } from "./modes/schedule";

/**
 * The daily reminder: one notification a day, at the hour the player picks, when the new games are out (Web Push,
 * sent by supabase/functions/push). The server keeps only the browser's push address, the hour and the time zone.
 * It skips a day the player has already played: finishing a daily game tells it so. Everything fails quietly.
 *
 * iPhone and iPad only allow it in the installed app (Add to Home Screen), so there it's offered after installing.
 */
const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
/** The public half of the VAPID pair (the private half is a secret of the push function). */
const VAPID_PUBLIC = "BNeL8i1LqX6yWvR2tQWgxhCF4Sj2K_BvbYvXj2XVZvf-C_C6QFBu6Tpkon8f_osEl6D1fAlTNg1JK3NOc518SBI";
const STORE = "apex.reminder";
const PLAYED = "apex.reminder.played";
const DISMISS = "apex.reminder.dismissed";
const EVENT = "apex:reminder";

export type ReminderSupport = "yes" | "install-first" | "no";

/** Whether this browser can take the reminder now, only after installing (iPhone, iPad), or not at all. */
export function reminderSupport(): ReminderSupport {
  if (typeof window === "undefined" || !URL_ || !KEY) return "no";
  const push = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIos() && !standalone()) return "install-first";
  if (!push || Notification.permission === "denied") return "no";
  return "yes";
}

/** The hour the reminder comes (0-23), or null when it's off. */
export function reminderHour(): number | null {
  try {
    const h = Number(JSON.parse(localStorage.getItem(STORE) ?? "null")?.hour);
    return Number.isInteger(h) && h >= 0 && h < 24 ? h : null;
  } catch {
    return null;
  }
}

const notify = () => window.dispatchEvent(new CustomEvent(EVENT));
const post = (body: unknown) =>
  fetch(`${URL_}/functions/v1/push`, { method: "POST", headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (b64url + "=".repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  // production registers the worker on load; make sure it's there even if the player was quicker
  return (await navigator.serviceWorker.getRegistration()) ?? navigator.serviceWorker.register("/sw.js");
}

/**
 * Turn the reminder on (or move it to another hour): asks for notification permission, subscribes this browser and
 * tells the server the hour and time zone. Resolves "on", "denied" (the player said no) or "failed".
 */
export async function enableReminder(hour: number, from: string): Promise<"on" | "denied" | "failed"> {
  if (reminderSupport() !== "yes") return "failed";
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      track("Reminder", { action: "denied", from });
      notify();
      return "denied";
    }
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) }));
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await post({ action: "subscribe", sub: sub.toJSON(), tz, hour, lang: LANG });
    if (!res.ok) return "failed";
    localStorage.setItem(STORE, JSON.stringify({ hour }));
    track("Reminder", { action: "on", hour, from });
    notify();
    return "on";
  } catch {
    return "failed";
  }
}

/** Turn the reminder off: the browser drops the subscription and the server forgets it. */
export async function disableReminder(from: string): Promise<void> {
  try {
    localStorage.removeItem(STORE);
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (sub) {
      await post({ action: "unsubscribe", endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
    track("Reminder", { action: "off", from });
  } catch {
    /* off on this device either way */
  }
  notify();
}

/** A daily game was finished: tell the server once a day, so today's reminder doesn't come. */
export async function reminderPlayed(): Promise<void> {
  if (reminderHour() === null || import.meta.env.DEV) return;
  const day = dateKey();
  try {
    if (localStorage.getItem(PLAYED) === day) return;
    const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
    if (!sub) return;
    const res = await post({ action: "played", endpoint: sub.endpoint, day });
    if (res.ok) localStorage.setItem(PLAYED, day);
  } catch {
    /* at worst one reminder too many */
  }
}

export function reminderDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS) === "1";
  } catch {
    return false;
  }
}
export function dismissReminder() {
  try {
    localStorage.setItem(DISMISS, "1");
  } catch {
    /* it just shows again */
  }
  notify();
}

/** The reminder's state for a component: support, the hour (null when off) and whether it was waved away. */
export function useReminder() {
  const read = () => ({ support: reminderSupport(), hour: reminderHour(), dismissed: reminderDismissed() });
  const [state, setState] = useState(read);
  useEffect(() => {
    const on = () => setState(read());
    window.addEventListener(EVENT, on);
    on();
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return state;
}

/** An hour as the player's clock shows it ("09:00", or "9 AM" on a 12-hour clock). */
export function hourLabel(hour: number): string {
  const d = new Date(2026, 0, 1, hour, 0);
  return d.toLocaleTimeString(LANG === "es" ? "es" : undefined, { hour: "numeric", minute: "2-digit" });
}
