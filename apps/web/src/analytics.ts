/**
 * Plausible analytics: cookieless and aggregate (no personal data, nothing
 * stored on the device), loaded only when VITE_PLAUSIBLE_DOMAIN is set. The
 * app has its own addresses but changes them with replaceState, so page views
 * are sent by hand (Plausible's manual script) whenever the screen changes.
 */
const DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
const SRC = (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined) || "https://plausible.io/js/script.manual.js";

type Plausible = ((event: string, options?: { u?: string; props?: Record<string, string | number | boolean> }) => void) & { q?: unknown[] };
declare global {
  interface Window {
    plausible?: Plausible;
  }
}

export const ANALYTICS_ON = !!DOMAIN;

let started = false;
export function initAnalytics() {
  if (started || !DOMAIN || import.meta.env.DEV) return;
  started = true;
  // queue calls made before the script arrives
  window.plausible ??= Object.assign((...args: unknown[]) => void (window.plausible!.q ??= []).push(args), {});
  const s = document.createElement("script");
  s.defer = true;
  s.dataset.domain = DOMAIN;
  s.src = SRC;
  document.head.appendChild(s);
}

let lastPath = "";
/** A page view for the current address (deduplicated, so re-renders don't count twice). */
export function pageview() {
  if (!started) return;
  const path = location.pathname;
  if (path === lastPath) return;
  lastPath = path;
  window.plausible?.("pageview", { u: location.origin + path });
}

/** A named event with a few small properties (no ids, no times of day, nothing personal). */
export function track(event: string, props: Record<string, string | number | boolean> = {}) {
  if (!started) return;
  window.plausible?.(event, { props });
}
