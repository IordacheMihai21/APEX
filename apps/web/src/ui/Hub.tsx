import { useEffect, useMemo, useState } from "react";
import { GAMES, type GamePage, type InfoPage, game, todayProgress } from "../games/registry";
import { playStreak } from "../games/profile";
import type { GameTrack } from "@apex/engine";
import { CATALOG } from "../game/catalog";
import { OUTLINES, type Outline, type OutlineDetail, loadOutlineDetail } from "../game/outlines";
import { CONDITION_NOTE, DAILY_LAPS, CONDITION_NAME, bestMedal, conditionOf, dailyNumber, qualifyingDay, raceWeek, dailyStats, dateKey, loadDaily, msToNextDay } from "../modes/daily";
import { type Grade, bestPerGroup } from "../modes/grading";
import { SEASON_ROUNDS, currentTrack, loadSeason, seasonDone } from "../modes/season";
import { MEDAL_NAME, type Medal, nextMedal } from "../modes/medals";
import { CIRCUITS } from "../modes/circuits";
import { cornerMedal, daysLeft, loadCornerWeek, weekNumber, weeklyCorner } from "../modes/corner";
import { loadHigherLower } from "../modes/higherLower";
import { MYSTERY_TRIES, REVEAL, isOver, isSolved, loadMystery, mysteryAnswer, revealOffset } from "../modes/mystery";
import { loadPitStop, secs } from "../modes/pitstop";
import { loadReaction } from "../modes/reaction";
import { ADS_ON, AdSlot } from "./Ads";
import { Chequered, Down, LowDownforce, Rain, Up } from "./icons";
import { Footer } from "./Footer";
import { Gantry } from "./Gantry";
import { MedalDisc, MedalLadder, PoleTarget } from "./Medals";
import { lapTime } from "./format";
import { LapGrid } from "./LapGrid";
import { Roll } from "./Roll";
import { Segments } from "./Segments";
import { primaryBtn, secondaryBtn } from "./styles";

export type HubAction =
  | { kind: "daily" }
  | { kind: "daily-summary" }
  | { kind: "season"; fresh: boolean }
  | { kind: "practice" }
  | { kind: "practice-track"; trackId: string }
  | { kind: "mini"; game: GamePage | InfoPage }
  | { kind: "corner" }
  | { kind: "stats" };

const PLAYBACK = 4;
/** Before a season is drawn, the calendar shows the twelve circuits in catalog order. */
const POOL = CATALOG.filter((t) => t.id !== "kestrel").map((t) => t.id);

function hms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduce;
}

/**
 * Today at a glance, the way a timing screen shows session status: how many of
 * the two dailies are done, each one's state (a chequered flag once it's
 * finished), and the medal streak. Each entry opens its game.
 */
function TodayBar({ daily, onAction }: { daily: ReturnType<typeof loadDaily>; onAction: (a: HubAction) => void }) {
  const streak = playStreak(daily.key);
  // the daily set and today's status of each, from the registry
  const { items: today, done: played } = todayProgress(daily.key);
  const items = today.map(({ game: g, status }) => ({
    key: g.id,
    name: g.name,
    short: g.short as string | null,
    done: status.state === "done",
    state: status.label,
    medal: status.medal ?? null,
    act: () =>
      onAction(
        g.id === "quali" ? (status.state === "done" ? { kind: "daily-summary" } : { kind: "daily" }) : { kind: "mini", game: g.route!.slice(1) as GamePage },
      ),
  }));
  return (
    <nav aria-label="Today's dailies" className="border-b border-line bg-board/60">
      <div className="mx-auto flex max-w-[1240px] items-stretch gap-x-6 px-4 md:px-8">
        <p className="flex shrink-0 items-center gap-3 py-2.5">
          <span className="hidden text-[13px] text-steel sm:inline">Today</span>
          <span className="num text-[13px] font-semibold text-paint">
            {played}/{items.length}
            <span className="sr-only"> daily games played today</span>
          </span>
          <span className="hidden gap-1 sm:flex" aria-hidden="true">
            {items.map((i) => (
              <span key={i.key} className={`today-pip h-1.5 w-5 ${i.done ? "bg-ink" : "bg-asphalt"}`} />
            ))}
          </span>
        </p>
        <ul className="flex min-w-0 flex-1 items-stretch">
          {items.map((i) => (
            <li key={i.key} className="min-w-0 flex-1 border-line sm:flex-none sm:border-l">
              <button onClick={i.act} aria-label={`${i.name}: ${i.state}`} className="today-item flex h-full w-full min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-2 text-center sm:flex-row sm:justify-start sm:gap-2.5 sm:px-4 sm:py-2.5 sm:text-left">
                <span className={`grid h-5 w-4 shrink-0 place-items-center sm:h-6 sm:w-6 ${i.done ? "text-paint" : "text-steel/60"}`}>
                  {i.medal ? <MedalDisc medal={i.medal} size={16} /> : i.done ? <Chequered className="h-4 w-4" /> : <span className="h-2 w-2 border border-current" />}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[11px] font-semibold text-paint sm:text-[13px]">
                    {i.short ? (
                      <>
                        <span className="sm:hidden">{i.short}</span>
                        <span className="hidden sm:inline">{i.name}</span>
                      </>
                    ) : (
                      i.name
                    )}
                  </span>
                  <span className={`hidden truncate text-[12px] sm:block ${i.done ? "text-paint/75" : "text-steel"}`}>{i.state}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p
          className="flex shrink-0 items-center gap-1.5 border-l border-line py-2.5 pl-3 text-[12px] text-steel sm:gap-2 sm:pl-4"
          title={`Days in a row with a daily game played. Best ${streak.best}.${streak.current && !streak.playedToday ? " Play one today to keep it." : ""}`}
        >
          <span className={`wide num text-[18px] leading-none ${streak.current && !streak.playedToday ? "text-steel" : "text-paint"}`}>{streak.current}</span>
          <span className="leading-tight">
            <span className="hidden sm:inline">day</span>
            <br className="hidden sm:inline" />
            streak
          </span>
        </p>
      </div>
    </nav>
  );
}

/** The weekly corner's circuit with that corner lit in ink (paths load on their own, like the hero's). */
function CornerMap({ trackId, complex }: { trackId: string; complex: number }) {
  const [detail, setDetail] = useState<OutlineDetail | null>(null);
  useEffect(() => {
    let live = true;
    loadOutlineDetail(trackId).then((d) => live && setDetail(d));
    return () => {
      live = false;
    };
  }, [trackId]);
  const o = OUTLINES[trackId];
  if (!detail || !o) return <div className="aspect-square w-full" />;
  const w = Math.max(o.width * 2.2, 20);
  return (
    <svg viewBox="0 0 1000 1000" className="aspect-square w-full overflow-visible" role="img" aria-label={`Map of ${CATALOG.find((t) => t.id === trackId)?.name} with the corner marked`}>
      <path d={detail.ribbon} fill="none" stroke="#23262d" strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />
      <path d={detail.corners[complex]} fill="none" stroke="var(--color-ink)" strokeWidth={w * 0.55} strokeLinejoin="round" strokeLinecap="round" className="corner-glow" />
    </svg>
  );
}

/**
 * Corner of the week: one famous corner, unlimited tries, a medal for the
 * week. Map on the left (the corner lit on its circuit), the brief on the right.
 */
function CornerBand({ onAction }: { onAction: (a: HubAction) => void }) {
  const wc = weeklyCorner();
  const week = loadCornerWeek();
  const left = daysLeft();
  const medal = week ? cornerMedal(week.bestDeltaMs) : null;
  const info = CATALOG.find((t) => t.id === wc.trackId)!;
  return (
    <section aria-labelledby="corner-h" className="border-t border-line">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[96px_minmax(0,1fr)] items-center gap-x-5 gap-y-4 px-4 py-10 sm:grid-cols-[160px_minmax(0,1fr)] md:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-x-12 lg:py-14">
        <div className="in-view w-full max-w-[340px] justify-self-center lg:row-span-2">
          <CornerMap trackId={wc.trackId} complex={wc.complex} />
        </div>
        <div className="min-w-0 lg:self-end">
          <p className="text-[14px] font-semibold text-ink">
            Corner of the week #{weekNumber()}, {left === 1 ? "last day" : `${left} days left`}
          </p>
          <h2 id="corner-h" className="wide mt-2 text-[clamp(26px,4vw,40px)] leading-[1.02] text-paint">
            {wc.name}
          </h2>
          <p className="mt-1 text-[14px] text-steel">{info.name}</p>
          <p className="mt-3 hidden max-w-[52ch] text-[15px] leading-snug text-paint/85 sm:block">{wc.note}</p>
        </div>
        <div className="col-span-2 flex flex-wrap items-center gap-x-6 gap-y-3 lg:col-span-1 lg:col-start-2 lg:self-start">
          <button className={`${secondaryBtn} min-w-[200px]`} onClick={() => onAction({ kind: "corner" })}>
            {week ? "Try again" : "Take the corner"}
          </button>
          <span className="flex items-center gap-2 text-[14px]">
            {week ? (
              <>
                {medal ? <MedalDisc medal={medal} size={14} /> : null}
                <span className="text-paint">{medal ? MEDAL_NAME[medal] : "No medal yet"}</span>
                <span className="num text-steel">
                  {week.bestDeltaMs <= 0 ? "on the perfect line" : `+${(week.bestDeltaMs / 1000).toFixed(3)} s`}, {week.tries} {week.tries === 1 ? "try" : "tries"}
                </span>
              </>
            ) : (
              <span className="text-steel">Unlimited tries. Your best counts for the week.</span>
            )}
          </span>
        </div>
      </div>
    </section>
  );
}

/** Four quick games beside the lap: one daily puzzle, one streak, one reflex test. */
/**
 * The game cards, in two groups: today's set (the daily games besides the
 * Quali, which has the hero) and the extras. Each card shows today's status
 * and what its button does.
 */
function GameCards({ onAction, group }: { onAction: (a: HubAction) => void; group: "daily" | "extras" }) {
  const mystery = loadMystery();
  const answer = OUTLINES[mysteryAnswer(mystery.key)];
  const hl = loadHigherLower();
  const hlToday = game("higher-lower").today();
  const reaction = loadReaction();
  const pit = loadPitStop();
  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
  const status = isOver(mystery)
    ? isSolved(mystery)
      ? `Solved in ${mystery.guesses.length}. Back tomorrow.`
      : "Missed today. Back tomorrow."
    : mystery.guesses.length
      ? `${MYSTERY_TRIES - mystery.guesses.length} guesses left`
      : "New today";
  const games = [
    {
      game: "mystery" as const,
      title: game("mystery").name,
      blurb: game("mystery").blurb,
      status,
      cta: isOver(mystery) ? "See today's answer" : "Guess the circuit",
      art: (
        <svg viewBox="0 0 1000 1000" className="h-full w-auto" aria-hidden="true">
          <path d={answer.outline} pathLength={1} fill="none" stroke="var(--color-ink)" strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${REVEAL[0]} 1`} strokeDashoffset={-revealOffset(mystery.key)} />
        </svg>
      ),
    },
    {
      game: "higher-lower" as const,
      title: game("higher-lower").name,
      blurb: game("higher-lower").blurb,
      // today's ten first; once done, the endless run
      status: hlToday.state === "done" ? `Today ${hlToday.label}. Endless next.` : hlToday.state === "playing" ? hlToday.label : hl.best ? `New today. Best run ${hl.best}` : "New today",
      cta: hlToday.state === "done" ? "Start a run" : hlToday.state === "playing" ? "Finish today's ten" : "Today's ten calls",
      art: (
        <span className="wide flex items-center gap-3 text-[34px] leading-none text-paint">
          7.004 <span className="flex flex-col text-steel"><Up className="h-5 w-5" /><Down className="h-5 w-5" /></span> <span className="text-steel/50">?</span>
        </span>
      ),
    },
    {
      game: "pit-stop" as const,
      title: game("pit-stop").name,
      blurb: game("pit-stop").blurb,
      status: pit.days[dateKey()] ? `Today ${secs(pit.days[dateKey()].totalMs)} s` : pit.best !== null ? `New today. Best ${secs(pit.best)} s` : "New today",
      cta: pit.days[dateKey()] ? "Practice stops" : "Box, box",
      art: (
        <span className="flex gap-1.5" aria-hidden="true">
          {["S", "K", "F", "J"].map((k, i) => (
            <span key={k} className={`pit-key wide !static !animate-none !text-[20px] ${i === 0 ? "" : "opacity-40"}`}>
              {k}
            </span>
          ))}
        </span>
      ),
    },
    {
      game: "reaction" as const,
      title: game("reaction").name,
      blurb: game("reaction").blurb,
      status: reaction.best !== null ? `Best ${(reaction.best / 1000).toFixed(3)} s` : "Five lights, one tap",
      cta: "Test your reaction",
      art: <Gantry lit={0} size="sm" label="Start lights" />,
    },
  ];
  // in the registry's order, the same as the Today bar
  const order = (id: string) => GAMES.findIndex((x) => x.id === id);
  const shown = games.filter((g) => game(g.game).inDailySet === (group === "daily")).sort((a, b) => order(a.game) - order(b.game));
  const progress = todayProgress();
  return (
    <section aria-labelledby={`games-${group}-h`} className="border-t border-line">
      <div className="mx-auto max-w-[1240px] px-4 py-12 md:px-8 lg:py-16">
        {group === "daily" ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <h2 id="games-daily-h" className="wide text-[34px] leading-none text-paint">
                Today's set
              </h2>
              <p className="text-[14px] text-steel">
                <span className="num font-semibold text-paint">
                  {progress.done} of {progress.total}
                </span>{" "}
                played. A new set at midnight.
              </p>
            </div>
            <p className="mt-3 text-[15px] text-steel">
              {COUNT_WORD[shown.length] ?? shown.length} more {shown.length === 1 ? "daily" : "dailies"} beside the Quali. The same puzzles for everyone, a few minutes each.
            </p>
          </>
        ) : (
          <>
            <h2 id="games-extras-h" className="wide text-[34px] leading-none text-paint">
              More to play
            </h2>
            <p className="mt-3 text-[15px] text-steel">Any time, as often as you like.</p>
          </>
        )}
        <ul className={`mt-6 grid gap-3 md:grid-cols-2 ${shown.length > 2 ? "lg:grid-cols-3" : ""}`}>
          {shown.map((g, i) => {
            const done = game(g.game).inDailySet && game(g.game).today().state === "done";
            return (
              <li key={g.game} className="in-view" style={d(i * 60)}>
                <button onClick={() => onAction({ kind: "mini", game: g.game })} className="track-tile flex h-full w-full flex-col border border-line bg-board/70 p-5 text-left">
                  <span className="flex h-[88px] items-center justify-between gap-3">
                    {g.art}
                    {done && (
                      <span className="flex shrink-0 items-center gap-1.5 self-start text-[12px] font-semibold text-paint/80">
                        <Chequered className="h-4 w-4" /> Done
                      </span>
                    )}
                  </span>
                  <span className="wide mt-5 text-[22px] leading-none text-paint">{g.title}</span>
                  <span className="mt-2 text-[14px] text-steel">{g.blurb}</span>
                  <span className="mt-auto flex items-baseline justify-between gap-3 pt-5">
                    <span className="caption">{g.status}</span>
                    <span className="text-[14px] font-semibold whitespace-nowrap text-ink">{g.cta}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

const COUNT_WORD: Record<number, string> = { 1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six" };

/** An in-content ad between sections, on phones and tablets; wide screens have the side rails. */
function AdBand() {
  if (!ADS_ON) return null;
  return (
    <div className="flex justify-center border-t border-line py-8 xl:hidden">
      <AdSlot kind="inline" />
    </div>
  );
}

/** Circuit outline as a small SVG from a precomputed outline (north-up, start marked). */
export function CircuitOutline({ track, className = "" }: { track: GameTrack | string; className?: string }) {
  const o = OUTLINES[typeof track === "string" ? track : track.id];
  if (!o) return null;
  return (
    <svg viewBox="0 0 1000 1000" className={className} aria-hidden="true">
      <path d={o.outline} fill="none" stroke="currentColor" strokeWidth={42} strokeLinejoin="round" />
      <circle cx={o.start[0]} cy={o.start[1]} r={46} fill="#ff6a13" stroke="#0a0b0d" strokeWidth={18} />
    </svg>
  );
}

/**
 * Today's circuit, drawn the way a timing map is: one quiet asphalt stroke,
 * today's best lap painted over it in sector colours (one stroke per corner
 * group, lit in lap order), the perfect line as a hairline, and the car as an orange dot with
 * a tapering streak. The car runs the optimal lap at the speeds the physics
 * engine computes (×4, the game's playback), so the streak stretches on the
 * straights and shrinks under braking. The track draws itself in once.
 */
const GRADE_STROKE: Record<Grade, string> = { purple: "var(--color-purple)", green: "var(--color-green)", yellow: "var(--color-yellow)", red: "var(--color-kerb)" };

function HeroCircuit({ id, o, grades }: { id: string; o: Outline; grades: Grade[] | null }) {
  // the paths load on their own (a few kB, cached offline); the box holds its size meanwhile
  const [detail, setDetail] = useState<{ id: string; d: OutlineDetail } | null>(null);
  useEffect(() => {
    let live = true;
    loadOutlineDetail(id).then((d) => live && setDetail({ id, d }));
    return () => {
      live = false;
    };
  }, [id]);
  if (!detail || detail.id !== id) return null;
  return <HeroMap id={id} o={{ ...o, ...detail.d }} grades={grades} />;
}

function HeroMap({ id, o, grades }: { id: string; o: Outline & OutlineDetail; grades: Grade[] | null }) {
  const reduce = useReducedMotion();
  const w = Math.max(o.width * 2.2, 20);
  const lineId = `line-${id}`;
  const dur = `${o.lapMs / PLAYBACK}ms`;
  const points = o.keyPoints.split(";").map(Number);
  // a dash of length len whose head sits at the car: offset = len - progress
  const trail = (len: number) => points.map((p) => (len - p).toFixed(4)).join(";");
  const timing = { dur, begin: "1.3s", repeatCount: "indefinite", calcMode: "linear", keyTimes: o.keyTimes } as const;
  return (
    <svg viewBox="0 0 1000 1000" className="hero-map h-full w-full overflow-visible" role="img" aria-label={`Map of ${CATALOG.find((t) => t.id === id)?.name}`}>
      <path className="draw draw-1" pathLength={1} d={o.ribbon} fill="none" stroke="#23262d" strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />
      {grades &&
        o.groups.map((g, i) =>
          grades[i] ? (
            <path
              key={i}
              className="sector-in"
              style={{ "--d": `${950 + i * 70}ms` } as React.CSSProperties}
              d={g}
              fill="none"
              stroke={GRADE_STROKE[grades[i]]}
              strokeWidth={w * 0.42}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null,
        )}
      <path id={lineId} className="draw draw-2" pathLength={1} d={o.line} fill="none" stroke="#f2f2ee" strokeOpacity={0.22} strokeWidth={2} strokeLinejoin="round" />
      {!reduce &&
        (
          [
            [0.16, 0.1, 3],
            [0.07, 0.3, 4.5],
            [0.025, 0.85, 6],
          ] as const
        ).map(([len, op, sw]) => (
          <path
            key={len}
            className="fade-late"
            pathLength={1}
            d={o.line}
            fill="none"
            stroke="#ff6a13"
            strokeOpacity={op}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${len} ${1 - len}`}
            strokeDashoffset={len}
          >
            <animate attributeName="stroke-dashoffset" values={trail(len)} {...timing} />
          </path>
        ))}
      <g className="fade-late">
        <circle r={10} fill="#ff6a13" stroke="#0a0b0d" strokeWidth={4}>
          {!reduce && (
            <animateMotion {...timing} keyPoints={o.keyPoints}>
              <mpath href={`#${lineId}`} />
            </animateMotion>
          )}
        </circle>
      </g>
    </svg>
  );
}

/** What the map is showing: your best lap today against the lap you are hunting. */
function MapCaption({ o, bestMs, medal, perfectMs }: { o: Outline; bestMs: number | null; medal: Medal | null; perfectMs: number }) {
  return (
    <figcaption className="fade-in-late grid grid-cols-2 gap-4 border-t border-line pt-3">
      <div>
        <div className="text-[13px] text-steel">{bestMs === null ? "No lap yet today" : "Your best today"}</div>
        <div className="mt-1 flex items-center gap-2">
          {medal && <MedalDisc medal={medal} size={14} />}
          <span className="wide num text-[15px] text-paint">{bestMs === null ? "-:--.---" : lapTime(bestMs)}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[13px] text-steel">Perfect lap, driven live</div>
        <div className="wide num mt-1 text-[15px] text-paint">{lapTime(perfectMs)}</div>
      </div>
    </figcaption>
  );
}

export function Hub({ onAction }: { onAction: (a: HubAction) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const today = dateKey(new Date(now));
  const daily = useMemo(() => loadDaily(today), [today]);
  const stats = useMemo(() => dailyStats(), []);
  const season = useMemo(() => loadSeason(), []);

  const info = CATALOG.find((t) => t.id === daily.trackId)!;
  // the official figures, the same ones the minigames use (our corner groups can differ)
  const facts = CIRCUITS.find((c) => c.id === daily.trackId);
  const condition = conditionOf(daily);
  // build today's circuit textures ahead, so lights out opens without a freeze. Not during page
  // load (the work would block the first seconds): on the player's first touch, scroll or key,
  // or after six quiet seconds, whichever comes first
  useEffect(() => {
    let done = false;
    const warm = () => {
      if (done) return;
      done = true;
      stop();
      import("../game/prewarm").then((m) => m.prewarm(daily.trackId, condition === "wet")).catch(() => {});
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    const t = setTimeout(warm, 6000);
    const stop = () => {
      clearTimeout(t);
      for (const e of events) window.removeEventListener(e, warm, true);
    };
    for (const e of events) window.addEventListener(e, warm, { capture: true, passive: true, once: true });
    return stop;
  }, [daily.trackId, condition]);
  const o = OUTLINES[daily.trackId];
  const perfectMs = condition === "dry" ? o.lapMs : (o.conditions[condition]?.lapMs ?? o.lapMs);
  const left = msToNextDay(new Date(now));
  // the gantry is the clock: a pod lights for every fifth of the day gone; at midnight, lights out
  const lit = Math.min(5, Math.floor(((86_400_000 - left) / 86_400_000) * 5) + 1);
  const cols = daily.laps[0]?.grades.length ?? 8;
  const finished = daily.status !== "playing";
  const run = season.run && !seasonDone(season.run) ? season.run : null;
  const wins = run?.results.filter((r) => r === "W").length ?? 0;
  const losses = (run?.results.length ?? 0) - wins;
  const lapsLeft = DAILY_LAPS - daily.laps.length;
  const week = raceWeek(today);
  const quali = qualifyingDay(today);
  const weekName = week ? CATALOG.find((t) => t.id === week.trackId)?.name : null;
  const medal = bestMedal(daily);
  const next = nextMedal(daily.trackId, medal, conditionOf(daily));
  // today's fastest lap (its time goes in the caption)
  const best = daily.laps.reduce<(typeof daily.laps)[number] | null>((b, l) => (!b || l.lapTimeMs < b.lapTimeMs ? l : b), null);
  // the map paints each corner group in its personal best of the day, F1 style:
  // the best colour reached there on any lap, not just the fastest lap's
  const sectorBest = bestPerGroup(daily.laps.map((l) => l.grades));
  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

  return (
    <div className="hub relative h-full overflow-x-hidden overflow-y-auto">
      <TodayBar daily={daily} onAction={onAction} />
      {week && (
        <p className="border-b border-line bg-board px-4 py-2 text-center text-[13px] text-paint/90">
          {quali ? (
            <>
              <span className="font-semibold text-ink">Qualifying day at {weekName}.</span> Today's Daily Quali is on the race-weekend circuit.
            </>
          ) : (
            <>
              <span className="font-semibold text-ink">Race week:</span> {weekName} hosts its Grand Prix this weekend. Saturday's Daily Quali is there.
            </>
          )}
        </p>
      )}
      {/* today's circuit */}
      <section
        aria-labelledby="daily-h"
        className="relative mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-x-10 px-4 pt-5 pb-10 md:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:pt-10 lg:pb-14"
      >
        <div className="@container relative z-[1] flex flex-col">
          <div className="rise flex items-center gap-4" style={d(0)}>
            <Gantry lit={lit} size="sm" sequence label={`Next Daily Quali in ${hms(left)}`} />
            <div className="leading-tight">
              <div className="text-[13px] text-steel">Next circuit in</div>
              <Segments text={hms(left)} className="mt-1 h-4" color="#ff2b1a" ghost={0.18} />
            </div>
          </div>

          <p className="rise mt-6 text-[15px] font-semibold text-ink lg:mt-12" style={d(60)}>
            Daily Quali No. {dailyNumber()}
            {quali ? ", race-weekend special" : ""}
          </p>
          <h1 id="daily-h" className="reveal-up wide mt-2 pb-1 text-[clamp(36px,12.5cqw,84px)] [overflow-wrap:anywhere] leading-[0.95] text-paint" style={d(100)}>
            <span className="sr-only">Lapdle, the daily racing line challenge. Today's circuit: </span>
            <span>{info.name}</span>
          </h1>
          <p className="rise mt-2 text-[15px] text-steel" style={d(200)}>
            {info.country}, {(facts?.lengthKm ?? o.lengthM / 1000).toFixed(3)} km, {facts?.turns ?? o.cornerCount} corners
          </p>
          {condition !== "dry" && (
            <p className="rise mt-3 flex items-start gap-2.5 text-[14px] leading-snug text-paint/85" style={d(230)}>
              <span className="grid h-7 w-7 shrink-0 place-items-center border border-line text-paint">{condition === "wet" ? <Rain className="h-4 w-4" /> : <LowDownforce className="h-4 w-4" />}</span>
              <span>
                <span className="font-semibold text-paint">{CONDITION_NAME[condition]}.</span> {CONDITION_NOTE[condition]}
              </span>
            </p>
          )}

          {/* the map sits inline on phones, beside the copy from lg */}
          <figure className="mt-4 w-full max-w-[460px] self-center lg:hidden">
            <div className="h-[min(26vh,320px)] w-full">
              <HeroCircuit id={daily.trackId} o={o} grades={sectorBest} />
            </div>
            <MapCaption o={o} bestMs={best?.lapTimeMs ?? null} medal={medal} perfectMs={perfectMs} />
          </figure>

          <div className="rise mt-4 max-w-[440px] lg:mt-10" style={d(260)}>
            <p className="mb-2.5 text-[15px] leading-snug text-paint/85">
              {daily.status === "won"
                ? `Pole on lap ${daily.laps.length}. Come back tomorrow.`
                : daily.status === "lost"
                  ? `Out of laps${medal ? ` with ${MEDAL_NAME[medal]}` : ""}. A new circuit at midnight.`
                  : daily.laps.length
                    ? `${lapsLeft} ${lapsLeft === 1 ? "lap" : "laps"} left${next ? `. ${MEDAL_NAME[next.medal]} is next.` : "."}`
                    : "Six laps to earn a medal."}
            </p>
            <LapGrid rows={daily.laps.map((l) => l.grades)} total={DAILY_LAPS} cols={cols} size="sm" />
            <div className="mt-4">
              <MedalLadder trackId={daily.trackId} best={medal} condition={conditionOf(daily)} />
              <PoleTarget trackId={daily.trackId} bestMs={best?.lapTimeMs ?? null} condition={conditionOf(daily)} />
            </div>
            {/* on phones the action stays in reach while the hero is on screen */}
            <div className="sticky bottom-0 z-[2] -mx-4 mt-1 bg-gradient-to-t from-night from-60% to-transparent px-4 pt-4 pb-[max(12px,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:bg-none sm:px-0 sm:pb-0">
              {finished ? (
                // the day is done: the next thing to play is a past day
                <span className="flex flex-wrap gap-2">
                  <button className={`${primaryBtn} flex-1 sm:flex-none sm:min-w-[220px]`} onClick={() => onAction({ kind: "mini", game: "archive" })}>
                    Play past days
                  </button>
                  <button className={`${secondaryBtn} flex-1 sm:flex-none`} onClick={() => onAction({ kind: "daily-summary" })}>
                    Today's result
                  </button>
                </span>
              ) : (
                <button className={`${primaryBtn} w-full sm:w-auto sm:min-w-[260px]`} onClick={() => onAction({ kind: "daily" })}>
                  {daily.laps.length ? "Continue" : "Lights out"}
                </button>
              )}
            </div>
          </div>
        </div>

        <figure className="hidden w-full max-w-[600px] justify-self-end lg:block">
          <div className="aspect-square w-full p-[4%]">
            <HeroCircuit id={daily.trackId} o={o} grades={sectorBest} />
          </div>
          <MapCaption o={o} bestMs={best?.lapTimeMs ?? null} medal={medal} perfectMs={perfectMs} />
        </figure>
      </section>

      {/* the rest of today's set, then an ad before the extras */}
      <GameCards onAction={onAction} group="daily" />
      <AdBand />

      {/* more to play: the extras, then the weekly corner, the season and practice */}
      <GameCards onAction={onAction} group="extras" />

      {/* the corner of the week */}
      <CornerBand onAction={onAction} />

      {/* perfect season */}
      <section aria-labelledby="season-h" className="border-t border-line bg-board/60">
        <div className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-8 px-4 py-12 md:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:items-center lg:py-16">
          <div>
            <h2 id="season-h" className="wide text-[34px] leading-none text-paint">
              Perfect Season
            </h2>
            <p className="mt-3 max-w-[38ch] text-[15px] leading-snug text-steel">
              {run
                ? `Round ${run.results.length + 1} of ${SEASON_ROUNDS}: ${CATALOG.find((t) => t.id === currentTrack(run))?.name}. Beat the rival's pole in three laps.`
                : season.best
                  ? `Your best is ${season.best.wins}-${season.best.losses}. Twelve circuits, three laps each, one rival on pole.`
                  : "Twelve circuits, three laps each, one rival on pole. Win all twelve."}
            </p>
            <div className="mt-6 flex items-center gap-4">
              <Roll text={run ? `${wins}-${losses}` : season.best ? `${season.best.wins}-${season.best.losses}` : "12-0"} className="wide text-[44px] text-paint" />
              <span className="text-[13px] leading-tight text-steel">{run ? "this season" : season.best ? "best season" : "the target"}</span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button className={run ? primaryBtn : secondaryBtn} onClick={() => onAction({ kind: "season", fresh: !run })}>
                {run ? "Next race" : "Start a season"}
              </button>
              {run && (
                <button className={secondaryBtn} onClick={() => onAction({ kind: "season", fresh: true })}>
                  Restart
                </button>
              )}
            </div>
          </div>

          {/* the calendar: twelve rounds, each its own circuit once a season is drawn */}
          <ol className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6" aria-label="Season calendar">
            {Array.from({ length: SEASON_ROUNDS }, (_, i) => {
              const id = run?.order[i] ?? POOL[i];
              const r = run?.results[i];
              const current = !!run && i === run.results.length;
              const tone = r === "W" ? "text-paint" : r === "L" ? "text-steel/40" : current ? "text-ink" : "text-[#3a3f49]";
              return (
                <li key={i} className="in-view flex flex-col items-center" style={d(i * 40)}>
                  <div className={`aspect-square w-full max-w-[84px] ${tone}`}>
                    <CircuitOutline track={id} className="h-full w-full" />
                  </div>
                  <span className={`num mt-1.5 text-[12px] font-semibold ${current ? "text-ink" : "text-steel"}`}>
                    R{i + 1}
                    {r ? ` ${r === "W" ? "Pole" : "P2"}` : ""}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* free practice */}
      <section aria-labelledby="practice-h" className="border-t border-line">
        <div className="mx-auto max-w-[1240px] px-4 pt-12 md:px-8 lg:pt-16">
          <h2 id="practice-h" className="wide text-[34px] leading-none text-paint">
            Free Practice
          </h2>
          <p className="mt-3 text-[15px] text-steel">Any circuit, unlimited laps, the perfect line on demand.</p>
        </div>
        <ul className="mx-auto flex max-w-[1240px] snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-6 pb-12 [scrollbar-color:#2b2f37_transparent] [scrollbar-width:thin] md:px-8 lg:pb-16">
          {CATALOG.filter((t) => OUTLINES[t.id] && t.id !== "kestrel").map((t, i) => {
            const to = OUTLINES[t.id];
            return (
              <li key={t.id} className="in-view shrink-0 snap-start" style={d(i * 35)}>
                <button onClick={() => onAction({ kind: "practice-track", trackId: t.id })} className="track-tile flex w-[176px] flex-col border border-line bg-board/70 p-3 text-left">
                  <svg viewBox="0 0 1000 1000" className="aspect-square w-full" aria-hidden="true">
                    <path d={to.outline} fill="none" stroke="#2b2f37" strokeWidth={46} strokeLinejoin="round" />
                    <path className="tile-lap" pathLength={1} d={to.outline} fill="none" stroke="#f2f2ee" strokeWidth={22} strokeLinejoin="round" />
                  </svg>
                  <span className="wide mt-3 truncate text-[15px] leading-tight text-paint">{t.name}</span>
                  <span className="mt-0.5 text-[13px] text-steel">
                    {t.country}, {(to.lengthM / 1000).toFixed(1)} km
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>


      {/* record */}
      <section aria-label="Your record" className="border-t border-line">
        <p className="mx-auto flex max-w-[1240px] flex-wrap items-baseline gap-x-6 gap-y-2 px-4 py-6 text-[13px] text-steel md:px-8">
          {stats.played === 0 ? (
            <span>Win a medal in the Daily Quali to start your record.</span>
          ) : (
            <>
              <span>
                <Roll text={String(stats.played)} className="wide mr-1.5 text-[15px] text-paint" />
                {stats.played === 1 ? "daily played" : "dailies played"}
              </span>
              <span>
                <Roll text={String(stats.medalDays)} className="wide mr-1.5 text-[15px] text-paint" />
                {stats.medalDays === 1 ? "medal" : "medals"}
              </span>
              <span>
                <Roll text={String(stats.poles)} className="wide mr-1.5 text-[15px] text-purple" />
                {stats.poles === 1 ? "pole" : "poles"}
              </span>
              <span>
                <Roll text={String(stats.streak)} className="wide mr-1.5 text-[15px] text-ink" />
                day medal streak, best {stats.bestStreak}
              </span>
            </>
          )}
          <button className="text-paint underline decoration-line underline-offset-4 hover:decoration-paint" onClick={() => onAction({ kind: "stats" })}>
            See your record
          </button>
          <button className="text-paint underline decoration-line underline-offset-4 hover:decoration-paint" onClick={() => onAction({ kind: "mini", game: "archive" })}>
            Past dailies
          </button>
        </p>
      </section>

      <AdBand />

      {/* what Lapdle is, in plain words: for new visitors and for search engines */}
      <section aria-labelledby="about-h" className="border-t border-line">
        <div className="mx-auto max-w-[1240px] px-4 py-12 md:px-8 lg:py-16">
          <h2 id="about-h" className="wide text-[clamp(24px,3.4vw,34px)] leading-none text-paint">
            The daily racing line challenge
          </h2>
          <div className="mt-4 grid max-w-[1000px] gap-4 text-[15px] leading-relaxed text-paint/80 md:grid-cols-2 md:gap-10">
            <p>
              Lapdle is a free daily puzzle for anyone who loves a good racing line. Every day there is one real circuit to master. Choose how you take each corner (early apex, classic or late), then watch your car drive
              that line with real physics and see, corner by corner, where the time went.
            </p>
            <p>
              You have six laps to earn a medal and close in on the perfect lap, and a new circuit arrives every day. Between laps, name a circuit from a few corners, call higher or lower on circuit facts, run a pit stop
              or test your start against the lights. It plays in your browser, with no account and no download.{" "}
              <a href="/how-to-play" className="text-paint underline decoration-line underline-offset-4 hover:decoration-paint">
                How to play every game
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <Footer onAction={onAction} />
    </div>
  );
}
