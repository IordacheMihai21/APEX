import { Suspense, lazy, useEffect, useState, useRef } from "react";
import { GAME_PAGES, type GameId, type GamePage, type InfoPage, PAGES, game } from "./games/registry";
import { type ContentPage, contentMeta, contentPath, parseContent } from "./content/meta";
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
const About = lazy(() => fresh(() => import("./content/Guides")).then((m) => ({ default: m.About })));
const HowToPlayIndex = lazy(() => fresh(() => import("./content/Guides")).then((m) => ({ default: m.HowToPlayIndex })));
const HowToPlayGuide = lazy(() => fresh(() => import("./content/Guides")).then((m) => ({ default: m.HowToPlayGuide })));
const CircuitsIndex = lazy(() => fresh(() => import("./content/Circuits")).then((m) => ({ default: m.CircuitsIndex })));
const CircuitGuide = lazy(() => fresh(() => import("./content/Circuits")).then((m) => ({ default: m.CircuitGuide })));
const BrakingPoint = lazy(() => fresh(() => import("./ui/BrakingPoint")).then((m) => ({ default: m.BrakingPoint })));
const TriviaIndex = lazy(() => fresh(() => import("./content/Trivia")).then((m) => ({ default: m.TriviaIndex })));
const TriviaQuiz = lazy(() => fresh(() => import("./content/Trivia")).then((m) => ({ default: m.TriviaQuiz })));
const Records = lazy(() => fresh(() => import("./ui/Records")).then((m) => ({ default: m.Records })));
const HigherLower = lazy(() => fresh(() => import("./ui/HigherLower")).then((m) => ({ default: m.HigherLower })));

/** A screen with its own address: a game's page or an info page (both declared in games/registry). */
type Mini = GamePage | InfoPage;
type Screen = { kind: "hub" } | { kind: "about" } | { kind: "howto"; game?: GameId } | { kind: "circuits"; id?: string } | { kind: "trivia"; id?: string } | { kind: "reaction" } | { kind: "mystery" } | { kind: "higher-lower" } | { kind: "braking-point" } | { kind: "pit-stop" } | { kind: "archive" } | { kind: "records" } | { kind: "privacy" } | { kind: "legal" } | { kind: "play"; mode: Mode; trackId: string; nonce?: number; challenge?: number[]; watch?: boolean; day?: string; condition?: Condition };

/** A practice link (?play=practice&track=…&cond=…), as the circuit guides use. */
function practiceFromQuery(search: string): Screen | null {
  const q = new URLSearchParams(search);
  const track = q.get("track");
  if (q.get("play") !== "practice" || !CATALOG.some((t) => t.id === track)) return null;
  const cond = q.get("cond");
  return { kind: "play", mode: "practice", trackId: track!, condition: cond === "wet" || cond === "lowdf" ? cond : undefined };
}

function initialScreen(): Screen {
  const q = new URLSearchParams(location.search);
  const vs = decodeChallenge(q.get("vs"));
  if (vs) return { kind: "play", mode: "practice", trackId: vs.trackId, challenge: vs.knots };
  const practice = practiceFromQuery(location.search);
  if (practice) return practice;
  const fromPath = screenFromPath(location.pathname);
  if (fromPath && fromPath.kind !== "hub") return fromPath;
  const path = location.pathname.replace(/\/$/, "").slice(1) || q.get("play");
  if (path === "corner") return { kind: "play", mode: "corner", trackId: weeklyCorner().trackId };
  if (path && isMini(path)) return { kind: path };
  return { kind: "hub" };
}

const isMini = (k: string): k is Mini => (GAME_PAGES as readonly string[]).includes(k) || k in PAGES;
/** The screen an address leads to (pages with their own path; query-string links are read in initialScreen). */
function screenFromPath(pathname: string): Screen | null {
  const p = pathname.replace(/^\/+|\/+$/g, "");
  if (p === "") return { kind: "hub" };
  if (p === "corner") return { kind: "play", mode: "corner", trackId: weeklyCorner().trackId };
  if (isMini(p)) return { kind: p };
  const c = parseContent(p);
  if (c) return c.page === "about" ? { kind: "about" } : c.page === "circuits" ? { kind: "circuits", id: c.id } : c.page === "trivia" ? { kind: "trivia", id: c.id } : { kind: "howto", game: c.game };
  return null;
}
function asContent(s: Screen): ContentPage | null {
  if (s.kind === "about") return { page: "about" };
  if (s.kind === "howto") return { page: "howto", game: s.game };
  if (s.kind === "circuits") return { page: "circuits", id: s.id };
  if (s.kind === "trivia") return { page: "trivia", id: s.id };
  return null;
}

/** The page title of a screen with its own address. */
const miniTitle = (k: Mini) => (k in PAGES ? PAGES[k as InfoPage] : game(k as GamePage).title);

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
    const mini = isMini(screen.kind) ? screen.kind : null;
    const corner = screen.kind === "play" && screen.mode === "corner";
    const content = asContent(screen);
    url.pathname = mini ? `/${mini}` : corner ? "/corner" : content ? contentPath(content) : "/";
    document.title = content ? contentMeta(content).title : mini ? miniTitle(mini) : corner ? `Corner of the week: ${weeklyCorner().name} | Lapdle` : game("quali").title;
    // each page is its own canonical address (practice and challenge links point back at the page they belong to)
    const canonical = `https://lapdle.com${url.pathname === "/" ? "/" : url.pathname}`;
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
    document.querySelector('meta[property="og:url"]')?.setAttribute("content", canonical);
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

  // links in content pages and elsewhere: an anchor to one of the app's own pages opens it in place
  useEffect(() => {
    const on = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target || a.origin !== location.origin || a.hasAttribute("download")) return;
      const next = practiceFromQuery(a.search) ?? screenFromPath(a.pathname);
      if (!next) return;
      e.preventDefault();
      setScreen(next);
      document.querySelector("main [class*='overflow-y-auto']")?.scrollTo({ top: 0 });
    };
    document.addEventListener("click", on);
    return () => document.removeEventListener("click", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Play next" on a minigame's finish card
  const goRef = useRef<(to: string) => void>(() => {});
  goRef.current = (to: string) => (to === "quali" ? act({ kind: "daily" }) : isMini(to) ? setScreen({ kind: to }) : undefined);
  useEffect(() => {
    const on = (e: Event) => goRef.current((e as CustomEvent<string>).detail);
    window.addEventListener("lapdle:go", on);
    return () => window.removeEventListener("lapdle:go", on);
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
              LAPDLE
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
        ) : screen.kind === "about" ? (
          <About />
        ) : screen.kind === "howto" ? (
          screen.game ? <HowToPlayGuide id={screen.game} /> : <HowToPlayIndex />
        ) : screen.kind === "circuits" ? (
          screen.id ? <CircuitGuide id={screen.id} /> : <CircuitsIndex />
        ) : screen.kind === "trivia" ? (
          screen.id ? <TriviaQuiz key={screen.id} id={screen.id} /> : <TriviaIndex />
        ) : screen.kind === "records" ? (
          <Records />
        ) : screen.kind === "legal" ? (
          <Legal />
        ) : screen.kind === "privacy" ? (
          <Privacy />
        ) : screen.kind === "archive" ? (
          <Archive onPlay={(day, trackId) => setScreen({ kind: "play", mode: "daily", trackId, day })} />
        ) : screen.kind === "pit-stop" ? (
          <PitStop onPlayDaily={() => act({ kind: "daily" })} />
        ) : screen.kind === "braking-point" ? (
          <BrakingPoint />
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
