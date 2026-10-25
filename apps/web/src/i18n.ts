/**
 * The site's language: English, or Spanish for players whose phone is set to Spanish or who came in on /es.
 *
 * The language is fixed for the page load, in this order: an /es address, then the player's own choice (kept on the
 * device), then the browser's language. Spanish pages keep the /es prefix in their addresses (one canonical address
 * per language for search engines); the app's routing reads paths without it (stripLang) and writes them back with
 * it (withLang). Shared links carry no language: whoever opens one gets their own.
 *
 * Text goes through t(english): the English is the key into the Spanish dictionary (i18n/es.ts), so a string with
 * no translation yet simply stays English. Variables are written {name} in both.
 */
import { ES } from "./i18n/es";

export type Lang = "en" | "es";
export const LANGS: Lang[] = ["en", "es"];
const KEY = "apex.lang";
const ES_PATH = /^\/es(?=\/|$)/;

function detect(): Lang {
  // the build's prerender sets the language of the pages it is writing (scripts/prerender.mjs)
  const built = (globalThis as { __LAPDLE_LANG__?: Lang }).__LAPDLE_LANG__;
  if (built) return built;
  if (typeof location === "undefined") return "en";
  if (ES_PATH.test(location.pathname)) return "es";
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "es") return saved;
  } catch {
    /* storage blocked: fall through to the browser's language */
  }
  const langs = typeof navigator !== "undefined" ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
  return /^es\b/i.test(langs[0] ?? "") ? "es" : "en";
}

export const LANG: Lang = detect();

/** A path without its language prefix: "/es/mystery" → "/mystery", "/es" → "/". */
export const stripLang = (path: string) => path.replace(ES_PATH, "") || "/";
/** The pages written in English only (the circuit guides, trivia and About): they keep their one address. */
const ENGLISH_ONLY = /^\/(circuits|trivia|about)(\/|$)/;
/** An app path in the current language: "/mystery" → "/es/mystery" in Spanish. */
export const withLang = (path: string, lang: Lang = LANG) => (lang === "es" && !ENGLISH_ONLY.test(path) ? (path === "/" ? "/es" : `/es${path}`) : path);
/** Whether a page has a Spanish version at /es (for the prerender, hreflang and the sitemap). */
export const hasSpanish = (path: string) => !ENGLISH_ONLY.test(path);

/** Switch language: remembered on this device, and the page reloads in it at the same place. */
export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* the address still carries Spanish; English without storage falls back to the browser's language */
  }
  location.href = withLang(stripLang(location.pathname), lang) + location.search;
}

/** The text in the current language (the English itself when there's no translation), with {vars} filled in. */
export function t(english: string, vars?: Record<string, string | number>): string {
  let s = LANG === "es" ? (ES[english] ?? english) : english;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Singular or plural by count: tn(1, "{n} lap left", "{n} laps left"). */
export const tn = (n: number, one: string, many: string) => t(n === 1 ? one : many, { n });

/** A corner's number in the page's language: "Turn 12" → "Curva 12", "Turns 3-4" → "Curvas 3-4"; named corners stay. */
export const turnName = (name: string) => (LANG === "es" ? name.replace(/\bTurns\b/g, "Curvas").replace(/\bTurn\b/g, "Curva") : name);

if (typeof document !== "undefined") document.documentElement.lang = LANG;
