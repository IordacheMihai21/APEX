import { Suspense, lazy, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { colourBlind, setColourBlind } from "./game/palette";
import { CATALOG } from "./game/catalog";
import type { Condition } from "@apex/engine";
import type { Mode } from "./game/game";
import { CONDITION_NAME, dailyCondition, dailyNumber, loadDaily } from "./modes/daily";
import { currentTrack, loadSeason, newSeason } from "./modes/season";
import { type HubAction, Hub } from "./ui/Hub";
import { ADS_ON, AdSlot, adShows } from "./ui/Ads";
import { Stats } from "./ui/Stats";
import { decodeChallenge } from "./modes/challenge";
import { ChevronLeft, ColourBlind } from "./ui/icons";
import { DailySummary, Loading, TrackPicker } from "./Dialogs";
import { pageview } from "./analytics";
import { weeklyCorner } from "./modes/corner";

// The hub is all a first visit needs; the race (engine, renderer, scenery) and
// the minigames load when they're opened, and the race is fetched early while idle.
// A tab left open across a deploy asks for chunk names that no longer exist:
// reload once to pick up the new build, rather than showing a broken screen.
function fresh<T>(load: () => Promise<T>): Promise<T> {
  return load().then(
    (m) => {
      sessionStorage.removeItem("apex.reloaded");
      return m;
    },
    (err) => {
      if (sessionStorage.getItem("apex.reloaded")) throw err;
      sessionStorage.setItem("apex.reloaded", "1");
      location.reload();
      return new Promise<T>(() => {});
    },
  );
}
const loadPlay = () => fresh(() => import("./Play"));
const Play = lazy(() => loadPlay().then((m) => ({ default: m.Play })));
const Reaction = lazy(() => fresh(() => import("./ui/Reaction")).then((m) => ({ default: m.Reaction })));
const Mystery = lazy(() => fresh(() => import("./ui/Mystery")).then((m) => ({ default: m.Mystery })));
const Legal = lazy(() => fresh(() => import("./ui/Legal")).then((m) => ({ default: m.Legal })));
const Privacy = lazy(() => fresh(() => import("./ui/Privacy")).then((m) => ({ default: m.Privacy })));
const Archive = lazy(() => fresh(() => import("./ui/Archive")).then((m) => ({ default: m.Archive })));
const PitStop = lazy(() => fresh(() => import("./ui/PitStop")).then((m) => ({ default: m.PitStop })));
const HigherLower = lazy(() => fresh(() => import("./ui/HigherLower")).then((m) => ({ default: m.HigherLower })));

type Mini = "reaction" | "mystery" | "higher-lower" | "pit-stop" | "archive" | "privacy" | "legal";
type Screen = { kind: "hub" } | { kind: "reaction" } | { kind: "mystery" } | { kind: "higher-lower" } | { kind: "pit-stop" } | { kind: "archive" } | { kind: "privacy" } | { kind: "legal" } | { kind: "play"; mode: Mode; trackId: string; nonce?: number; challenge?: number[]; watch?: boolean; day?: string; condition?: Condition };

function initialScreen(): Screen {
  const q = new URLSearchParams(location.search);
  const mode = q.get("play") as Mode | null;
  const track = q.get("track");
  const vs = decodeChallenge(q.get("vs"));
  if (vs) return { kind: "play", mode: "practice", trackId: vs.trackId, challenge: vs.knots };
  const cond = q.get("cond");
  const condition = cond === "wet" || cond === "lowdf" ? cond : undefined;
  if (mode === "practice" && CATALOG.some((t) => t.id === track)) return { kind: "play", mode, trackId: track!, condition };
  const path = location.pathname.replace(/\/$/, "").slice(1) || q.get("play");
  if (path === "corner") return { kind: "play", mode: "corner", trackId: weeklyCorner().trackId };
  if (path && path in MINI) return { kind: path as Mini };
  return { kind: "hub" };
}

/** The minigames have their own addresses and titles, so they can be found and shared. */
const MINI: Record<Mini, string> = {
  reaction: "Lights out: start-light reaction test | Lapdle",
  mystery: "Mystery circuit: guess the racing circuit | Lapdle",
  "higher-lower": "Higher or lower: racing circuit facts | Lapdle",
  "pit-stop": "Pit stop: change four tyres, go on green | Lapdle",
  archive: "Daily Quali archive: every past circuit | Lapdle",
  privacy: "Privacy | Lapdle",
  legal: "Legal notice and terms | Lapdle",
};

const MODE_LABEL: Record<Mode, string> = { daily: "Daily quali", season: "Perfect season", practice: "Free practice", corner: "Corner of the week" };

export function App() {
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
    idle(() => void loadPlay().catch(() => {}));
  }, []);
  const [screen, setScreenNow] = useState<Screen>(initialScreen);
  // Grid <-> circuit goes through the cut (a slanted wipe) where view transitions exist.
  const setScreen = (next: Screen) => {
    type Transition = { ready: Promise<void>; finished: Promise<void> };
    const doc = document as Document & { startViewTransition?: (cb: () => void | Promise<void>) => Transition };
    if (!doc.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return setScreenNow(next);
    // the new screen's code is in hand before the cut starts (the race is usually
    // prefetched already), so the wipe never lands on a loading state
    const code = next.kind === "play" ? loadPlay() : Promise.resolve();
    code.then(
      () => {
        const t = doc.startViewTransition!(() => flushSync(() => setScreenNow(next)));
        // a transition interrupted by another navigation is fine; the state change still lands
        t.ready.catch(() => {});
        t.finished.catch(() => {});
      },
      () => setScreenNow(next),
    );
  };
  const [picking, setPicking] = useState(false);
  const [summary, setSummary] = useState(false);
  const [stats, setStats] = useState(false);

  useEffect(() => {
    const url = new URL(location.href);
    url.search = "";
    const mini = screen.kind in MINI ? (screen.kind as Mini) : null;
    const corner = screen.kind === "play" && screen.mode === "corner";
    url.pathname = mini ? `/${mini}` : corner ? "/corner" : "/";
    document.title = mini ? MINI[mini] : corner ? `Corner of the week: ${weeklyCorner().name} | Lapdle` : "Lapdle: find the perfect lap";
    if (screen.kind === "play" && screen.mode === "practice") {
      url.searchParams.set("play", "practice");
      url.searchParams.set("track", screen.trackId);
      if (screen.condition && screen.condition !== "dry") url.searchParams.set("cond", screen.condition);
    }
    // history: the grid is one entry, any game or page sits one entry above it, so a phone's
    // Back (or the browser's) returns to the grid instead of leaving the site, even when the
    // visit started on a deep link like /mystery
    const at = (history.state as { lapdle?: string } | null)?.lapdle;
    if (screen.kind === "hub") {
      if (at === "screen") history.back();
      else history.replaceState({ lapdle: "hub" }, "", url);
    } else if (at === "screen") history.replaceState({ lapdle: "screen" }, "", url);
    else {
      if (at !== "hub") history.replaceState({ lapdle: "hub" }, "", "/");
      history.pushState({ lapdle: "screen" }, "", url);
    }
    pageview();
  }, [screen]);

  // Back from a game or page lands on the grid entry: show the grid
  useEffect(() => {
    const on = (e: PopStateEvent) => {
      if ((e.state as { lapdle?: string } | null)?.lapdle !== "screen") {
        setPicking(false);
        setStats(false);
        setSummary(false);
        setScreenNow({ kind: "hub" });
      }
    };
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);

  const act = (a: HubAction) => {
    if (a.kind === "daily") setScreen({ kind: "play", mode: "daily", trackId: loadDaily().trackId });
    else if (a.kind === "daily-summary") setSummary(true);
    else if (a.kind === "practice") setPicking(true);
    else if (a.kind === "mini") setScreen({ kind: a.game });
    else if (a.kind === "corner") setScreen({ kind: "play", mode: "corner", trackId: weeklyCorner().trackId });
    else if (a.kind === "stats") setStats(true);
    else if (a.kind === "practice-track") setScreen({ kind: "play", mode: "practice", trackId: a.trackId });
    else {
      const store = a.fresh ? newSeason() : loadSeason();
      setScreen({ kind: "play", mode: "season", trackId: currentTrack(store.run!) });
    }
  };

  const [cb, setCb] = useState(colourBlind);
  const toggleColourBlind = () => {
    setColourBlind(!cb);
    setCb(!cb);
  };


  // AdSense asks for ads well away from games that are played with the mouse
  // (150 px or more): the side rails stay off the race screen, where you drag
  // points across the whole map, and show everywhere else.
  const rails = ADS_ON && screen.kind !== "play";
  const track = screen.kind === "play" ? CATALOG.find((t) => t.id === screen.trackId) : null;

  return (
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto] overflow-hidden select-none">
      <header className="flex h-[52px] items-stretch justify-between border-b border-line bg-night pt-[env(safe-area-inset-top)]">
        <div className="flex min-w-0 items-stretch">
          {screen.kind !== "hub" && (
            <button onClick={() => setScreen({ kind: "hub" })} className="back grid w-12 shrink-0 place-items-center border-r border-line text-paint transition-colors hover:bg-graphite active:bg-graphite" aria-label="Back to the grid">
              <ChevronLeft />
            </button>
          )}
          <div className="flex min-w-0 items-center gap-3 px-3">
            <span className="wide text-[17px] leading-none tracking-[0.02em] text-paint sm:text-[20px]">
              LAPDLE<span className="text-steel">/</span>
            </span>
            {track && screen.kind === "play" && (
              <div className="min-w-0 leading-tight">
                <div className="caption truncate">
                  {screen.day ? `Archive, quali No. ${dailyNumber(screen.day)}` : MODE_LABEL[screen.mode]}
                  {screen.mode === "daily" && dailyCondition(screen.day) !== "dry" ? `, ${CONDITION_NAME[dailyCondition(screen.day)].toLowerCase()}` : ""}
                  {screen.mode === "practice" && screen.condition && screen.condition !== "dry" ? `, ${CONDITION_NAME[screen.condition].toLowerCase()}` : ""}
                </div>
                <div className="truncate text-[14px] font-bold text-paint">{track.name}</div>
              </div>
            )}
          </div>
        </div>
        <span className="flex">
        <button
          onClick={toggleColourBlind}
          aria-pressed={cb}
          aria-label={cb ? "Colour-blind colours on. Turn off" : "Colour-blind colours off. Turn on"}
          title={cb ? "Colour-blind colours: on" : "Colour-blind colours: off"}
          className={`grid w-12 shrink-0 place-items-center border-l border-line hover:bg-graphite ${cb ? "text-ink" : "text-steel"}`}
        >
          <ColourBlind />
        </button>
        </span>
      </header>

      <div className={`grid min-h-0 grid-cols-[minmax(0,1fr)] ${rails ? "xl:grid-cols-[176px_minmax(0,1fr)_176px] 2xl:grid-cols-[316px_minmax(0,1fr)_316px]" : ""}`}>
      {rails && (
        <aside aria-label="Advertisement" className="hidden min-h-0 border-r border-line bg-night px-2 xl:flex xl:items-center">
          <AdSlot kind="rail" className="w-full" />
        </aside>
      )}
      <main className="relative min-h-0 [view-transition-name:stage]">
        <Suspense fallback={screen.kind === "play" ? <Loading trackId={screen.trackId} error={null} /> : null}>
        {screen.kind === "hub" ? (
          <Hub onAction={act} />
        ) : screen.kind === "reaction" ? (
          <Reaction onPlayDaily={() => act({ kind: "daily" })} />
        ) : screen.kind === "mystery" ? (
          <Mystery onPlayDaily={() => act({ kind: "daily" })} />
        ) : screen.kind === "legal" ? (
          <Legal />
        ) : screen.kind === "privacy" ? (
          <Privacy />
        ) : screen.kind === "archive" ? (
          <Archive onPlay={(day, trackId) => setScreen({ kind: "play", mode: "daily", trackId, day })} />
        ) : screen.kind === "pit-stop" ? (
          <PitStop onPlayDaily={() => act({ kind: "daily" })} />
        ) : screen.kind === "higher-lower" ? (
          <HigherLower onPlayDaily={() => act({ kind: "daily" })} />
        ) : (
          <Play
            key={`${screen.mode}:${screen.trackId}:${screen.day ?? ""}:${screen.condition ?? ""}:${screen.nonce ?? 0}`}
            mode={screen.mode}
            trackId={screen.trackId}
            challenge={screen.challenge}
            watch={screen.watch}
            day={screen.day}
            condition={screen.condition}
            onNext={(trackId) => setScreen(trackId ? { kind: "play", mode: screen.mode, trackId, nonce: Date.now() } : screen.day ? { kind: "archive" } : { kind: "hub" })}
          />
        )}
        </Suspense>
      </main>
      {rails && (
        <aside aria-label="Advertisement" className="hidden min-h-0 border-l border-line bg-night px-2 xl:flex xl:items-center">
          <AdSlot kind="rail" className="w-full" />
        </aside>
      )}
      </div>

      {/* phones: a small strip under the page (its own row, so it never covers anything); never while racing */}
      {screen.kind !== "play" && adShows("anchor") && (
        <aside aria-label="Advertisement" className="flex justify-center border-t border-line bg-night pt-1 pb-[max(4px,env(safe-area-inset-bottom))] lg:hidden">
          <AdSlot kind="anchor" />
        </aside>
      )}

      {picking && (
        <TrackPicker
          onPick={(id, condition) => {
            setPicking(false);
            setScreen({ kind: "play", mode: "practice", trackId: id, condition });
          }}
          onClose={() => setPicking(false)}
        />
      )}
      {stats && <Stats onClose={() => setStats(false)} />}
      {summary && (
        <DailySummary
          onClose={() => setSummary(false)}
          onWatch={() => {
            setSummary(false);
            setScreen({ kind: "play", mode: "daily", trackId: loadDaily().trackId, watch: true });
          }}
        />
      )}
    </div>
  );
}
