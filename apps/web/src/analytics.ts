/**
 * Umami analytics: cookieless, no IP addresses in the statistics, live site only. The script and its data go
 * through lapdle.com/lp/ (a Cloudflare Pages worker, public/_worker.js, that only /lp/* reaches), so blockers that drop third-party
 * analytics hosts don't hide those visits. If that copy can't be loaded, Umami's own script is loaded instead.
 * The app has its own addresses but changes them with replaceState, so page
 * views are sent by hand whenever the screen changes. The website id is public:
 * it sits in the script tag of every page.
 */
const WEBSITE_ID = "d1a94723-d0b7-47ec-bbaf-fa6abdd7abf3";
const SRC = "/lp/script.js";
const DIRECT_SRC = "https://cloud.umami.is/script.js";
const HOST = "lapdle.com";

type Payload = Record<string, unknown>;
type Umami = { track: { (build: (props: Payload) => Payload): void; (event: string, data?: Record<string, string | number | boolean>): void } };
declare global {
  interface Window {
    umami?: Umami;
  }
}

export const ANALYTICS_ON = true;

let started = false;
/** Only the live site counts: preview deployments and local builds of production never do. */
const liveHost = () => typeof location !== "undefined" && (location.hostname === HOST || location.hostname === `www.${HOST}`);
/** Calls made before the script arrives, sent once it has. */
const waiting: (() => void)[] = [];
const send = (call: () => void) => (window.umami ? call() : waiting.push(call));

export function initAnalytics() {
  if (started || import.meta.env.DEV || !liveHost()) return;
  started = true;
  load(SRC, `${location.origin}/lp`, () => load(DIRECT_SRC));
}

function load(src: string, hostUrl?: string, onError?: () => void) {
  const s = document.createElement("script");
  s.src = src;
  s.async = true;
  s.dataset.websiteId = WEBSITE_ID;
  if (hostUrl) s.dataset.hostUrl = hostUrl;
  s.dataset.autoPageview = "false";
  s.onload = () => waiting.splice(0).forEach((call) => call());
  if (onError) s.onerror = () => (s.remove(), onError());
  document.head.appendChild(s);
}

/** The query parameters that say where a visit came from (the rest are the app's own). */
const SOURCE_PARAMS = ["ref", "source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

/** Only the source parameters of a query string ("?ref=tiktok"), or "" when there are none. */
export function sourceQuery(search: string): string {
  const q = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const k of SOURCE_PARAMS) {
    const v = q.get(k);
    if (v) kept.set(k, v);
  }
  const s = kept.toString();
  return s ? `?${s}` : "";
}

/** Umami reads only utm_ parameters, so a link tagged ?ref=tiktok goes in as utm_source=tiktok. */
export function utmQuery(query: string): string {
  const q = new URLSearchParams(query);
  const from = q.get("ref") ?? q.get("source");
  q.delete("ref");
  q.delete("source");
  if (from && !q.has("utm_source")) q.set("utm_source", from);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Read when the page loads, before the app rewrites its address, so a tagged link (?ref=tiktok) keeps its source. */
let arrival = typeof location !== "undefined" ? utmQuery(sourceQuery(location.search)) : "";
/** The visit's own source (ref, else utm_source), lower case, kept for the whole page load: "" when untagged. */
const ARRIVED_FROM = typeof location !== "undefined" ? (new URLSearchParams(location.search).get("ref") ?? new URLSearchParams(location.search).get("utm_source") ?? "").toLowerCase() : "";
export const arrivedFrom = () => ARRIVED_FROM;
/** Came in from one of our short videos (the bio links and descriptions are tagged per platform). */
export const fromClips = () => /^(tiktok|instagram|ig|ig-story|youtube|yt|reels|shorts)/.test(ARRIVED_FROM);
/** The page that sent the visit, read once at load (the app's own navigation never changes it). */
const REFERRER = typeof document !== "undefined" ? document.referrer : "";
/**
 * Came in from a paid ad: tagged <platform>-ads, or from TikTok with no tag at all. TikTok doesn't always keep the
 * ad's query string, and an untagged TikTok visit is an ad click or a tap through the profile it led to (the bio link
 * is tagged ?ref=tiktok). They saw one clip, so they land in its game, not on the home page.
 */
export const fromAds = () => /-ads$/.test(ARRIVED_FROM) || (ARRIVED_FROM === "" && /(^|\.)tiktok\.com$/.test(hostOf(REFERRER)));
function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

let lastPath = "";
/** A page view for the current address (deduplicated, so re-renders don't count twice); the first carries the visit's source and referrer. */
export function pageview() {
  if (!started) return;
  const path = location.pathname;
  if (path === lastPath) return;
  const first = lastPath === "";
  lastPath = path;
  const url = path + arrival;
  arrival = "";
  send(() => window.umami?.track((props) => ({ ...props, url, referrer: first ? props.referrer : "" })));
}

/** A named event with a few small properties (no ids, no times of day, nothing personal). */
export function track(event: string, props: Record<string, string | number | boolean> = {}) {
  if (!started) return;
  send(() => window.umami?.track(event, props));
}
