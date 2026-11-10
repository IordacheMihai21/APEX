import { dailyCondition, dailyNumber, dailyTrack } from "../modes/schedule";

/**
 * The daily reminder's clock and words, shared by the app and the push function (supabase/functions/push), so both
 * agree on when a player's reminder is due and what it says. Pure: no storage, no network.
 */
export type ReminderLang = "en" | "es";

export interface ReminderRow {
  tz: string;
  hour: number;
  last_sent: string | null;
  last_played: string | null;
}

/** Whether a time zone name is one this runtime knows ("Europe/Bucharest"). */
export function validTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The player's own calendar day ("2026-11-10") and hour (0-23) at a moment, in their time zone. */
export function localDayHour(tz: string, now: Date): { day: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

/**
 * Due now: it is the hour the player picked, in their time zone, and today's reminder hasn't gone out yet, and they
 * haven't already played today (a reminder for a set they're in the middle of is only noise).
 */
export function reminderDue(row: ReminderRow, now: Date): string | null {
  const { day, hour } = localDayHour(row.tz, now);
  if (hour !== row.hour || row.last_sent === day || row.last_played === day) return null;
  return day;
}

/** Venue names for the circuits in the Daily Quali rotation (the catalog's own names). */
const VENUES: Record<string, string> = {
  monza: "Monza",
  spa: "Spa-Francorchamps",
  silverstone: "Silverstone",
  suzuka: "Suzuka",
  monaco: "Monaco",
  interlagos: "Interlagos",
  hungaroring: "Hungaroring",
  "red-bull-ring": "Spielberg",
  zandvoort: "Zandvoort",
  austin: "Austin",
  barcelona: "Barcelona",
  imola: "Imola",
};

const COPY = {
  en: { title: "Today's Lapdle is ready", wet: " in the wet", lowdf: " with low downforce", tail: "New games are waiting." },
  es: { title: "El Lapdle de hoy ya está aquí", wet: " con lluvia", lowdf: " con poca carga aerodinámica", tail: "Hay juegos nuevos esperándote." },
} as const;

/** The notification for a day: the Daily Quali's number, circuit and conditions, and where a tap goes. */
export function reminderMessage(lang: ReminderLang, day: string): { title: string; body: string; url: string } {
  const c = COPY[lang] ?? COPY.en;
  const cond = dailyCondition(day);
  const extra = cond === "wet" ? c.wet : cond === "lowdf" ? c.lowdf : "";
  const venue = VENUES[dailyTrack(day)] ?? dailyTrack(day);
  return {
    title: c.title,
    body: `Daily Quali #${dailyNumber(day)}: ${venue}${extra}. ${c.tail}`,
    url: `${lang === "es" ? "/es" : "/"}?ref=push`,
  };
}

/** Push services a subscription may point at: the browsers' own, never an arbitrary address. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];

export function pushEndpointOk(endpoint: string): boolean {
  if (typeof endpoint !== "string" || endpoint.length > 1024) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}
