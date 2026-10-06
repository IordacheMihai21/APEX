import { useEffect, useRef } from "react";

/**
 * Google AdSense display slots, placed the way daily-game sites do it
 * (playfootball.games, futbol11): sticky skyscraper rails beside the game on
 * wide screens, one in-content block on the hub on phones. Never beside the
 * game controls (accidental clicks are both bad play and against AdSense
 * policy). See docs/ADS.md for setup.
 *
 * Configure with Vite env vars:
 *   VITE_ADSENSE_CLIENT      ca-pub-…           (no client = no ads)
 *   VITE_ADSENSE_SLOT_RAIL   slot id for the side rails
 *   VITE_ADSENSE_SLOT_INLINE slot id for the hub's in-content block
 * Units without a slot id render as labelled placeholders in development (or
 * with ?ads=preview) so the layout can be designed, and not at all otherwise.
 */
const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
const SLOTS = {
  rail: import.meta.env.VITE_ADSENSE_SLOT_RAIL as string | undefined,
  inline: import.meta.env.VITE_ADSENSE_SLOT_INLINE as string | undefined,
  /** phones only: a 320×50 strip under the page, never on the race screen */
  anchor: import.meta.env.VITE_ADSENSE_SLOT_ANCHOR as string | undefined,
};
type Kind = keyof typeof SLOTS;

const preview = typeof location !== "undefined" && new URLSearchParams(location.search).get("ads") === "preview";

/** Whether ad space should be laid out at all. */
export const ADS_ON = (!!CLIENT && !!(SLOTS.rail || SLOTS.inline || SLOTS.anchor)) || import.meta.env.DEV || preview;

/** Whether a unit of this kind appears at all: a live unit, or a placeholder while designing. */
export const adShows = (kind: Kind) => (!!CLIENT && !!SLOTS[kind]) || import.meta.env.DEV || preview;

let scriptAdded = false;
function loadAdSense() {
  if (scriptAdded || !CLIENT) return;
  // production pages already carry the script in <head> (vite.config.ts)
  if (document.querySelector('script[src*="adsbygoogle.js"]')) return void (scriptAdded = true);
  scriptAdded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(CLIENT)}`;
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdSlot({ kind, className = "" }: { kind: Kind; className?: string }) {
  const ref = useRef<HTMLModElement>(null);
  const slot = SLOTS[kind];
  const live = !!CLIENT && !!slot;
  useEffect(() => {
    if (!live) return;
    loadAdSense();
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* blocked by an ad blocker: the reserved space just stays empty */
    }
  }, [live]);
  // a unit without its slot id never shows a placeholder on the live site
  if (!ADS_ON || (!live && !import.meta.env.DEV && !preview)) return null;
  const size = kind === "rail" ? "h-[600px] w-full" : kind === "anchor" ? "h-[50px] w-[320px] max-w-full" : "h-[250px] w-[300px] max-w-full";
  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <span className="text-[11px] text-steel/70">Advertisement</span>
      {live ? (
        <ins
          ref={ref}
          className={`adsbygoogle block ${size}`}
          data-ad-client={CLIENT}
          data-ad-slot={slot}
          data-ad-format={kind === "rail" ? "vertical" : kind === "anchor" ? "horizontal" : "rectangle"}
          data-full-width-responsive="false"
        />
      ) : (
        <div className={`${size} grid place-items-center border border-dashed border-line text-[12px] text-steel/60`}>{kind === "rail" ? "Ad 160×600 / 300×600" : kind === "anchor" ? "Ad 320×50" : "Ad 300×250"}</div>
      )}
    </div>
  );
}

/**
 * The block under a minigame, as daily-game sites place it: after the game and
 * its results, across the full width, separated by a hairline.
 */
export function AdBelow() {
  if (!adShows("inline")) return null;
  return (
    <aside aria-label="Advertisement" className="flex justify-center border-t border-line px-4 py-10">
      <AdSlot kind="inline" />
    </aside>
  );
}
