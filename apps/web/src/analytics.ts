/**
 * Plausible analytics: cookieless and aggregate (no personal data, nothing
 * stored on the device), loaded only when VITE_PLAUSIBLE_DOMAIN is set. The
 * app has its own addresses but changes them with replaceState, so page views
 * are sent by hand whenever the screen changes.
 *
 * Two kinds of Plausible script work:
 * - the site's own script (VITE_PLAUSIBLE_SRC = https://plausible.io/js/pa-….js,
 *   from Site settings > Site installation), started with plausible.init and
 *   automatic page views off; what Plausible gives new sites;
 * - the older manual script with data-domain (the default when no SRC is set).
 */
const DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
const SRC = (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined) || "https://plausible.io/js/script.manual.js";
/** the site's own script (pa-….js) takes plausible.init; the older ones take data-domain */
const SITE_SCRIPT = /\/pa-[^/]+\.js$/.test(SRC);

type Plausible = ((event: string, options?: { u?: string; url?: string; props?: Record<string, string | number | boolean> }) => void) & {
  q?: unknown[];
  o?: unknown;
  init?: (options: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    plausible?: Plausible;
  }
}

export const ANALYTICS_ON = !!DOMAIN;

let started = false;
/** Only the live site counts: preview deployments and local builds of production never do. */
const liveHost = () => typeof location !== "undefined" && DOMAIN !== undefined && (location.hostname === DOMAIN || location.hostname === `www.${DOMAIN}`);

export function initAnalytics() {
  if (started || !DOMAIN || import.meta.env.DEV || !liveHost()) return;
  started = true;
  // queue calls made before the script arrives
  window.plausible ??= Object.assign((...args: unknown[]) => void (window.plausible!.q ??= []).push(args), {});
  const s = document.createElement("script");
  s.src = SRC;
  if (SITE_SCRIPT) {
    // the snippet Plausible gives: init queued for the script, page views sent by the app
    s.async = true;
    window.plausible.init ??= (o: Record<string, unknown>) => void (window.plausible!.o = o);
    window.plausible.init({ autoCapturePageviews: false });
  } else {
    s.defer = true;
    s.dataset.domain = DOMAIN;
  }
  document.head.appendChild(s);
}

/** The query parameters Plausible reads a visit's source from (the rest it ignores). */
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

/** Read when the page loads, before the app rewrites its address, so a tagged link (?ref=tiktok) keeps its source. */
let arrival = typeof location !== "undefined" ? sourceQuery(location.search) : "";

let lastPath = "";
/** A page view for the current address (deduplicated, so re-renders don't count twice); the first carries the visit's source. */
export function pageview() {
  if (!started) return;
  const path = location.pathname;
  if (path === lastPath) return;
  lastPath = path;
  const url = location.origin + path + arrival;
  arrival = "";
  window.plausible?.("pageview", SITE_SCRIPT ? { url } : { u: url });
}

/** A named event with a few small properties (no ids, no times of day, nothing personal). */
export function track(event: string, props: Record<string, string | number | boolean> = {}) {
  if (!started) return;
  window.plausible?.(event, { props });
}
