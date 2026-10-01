import { useEffect, useMemo, useState } from "react";
import type { GameTrack } from "@apex/engine";
import { CATALOG } from "../game/catalog";
import { OUTLINES, type Outline } from "../game/outlines";
import { DAILY_LAPS, bestMedal, dailyNumber, qualifyingDay, raceWeek, dailyStats, dateKey, loadDaily, msToNextDay } from "../modes/daily";
import { type Grade, bestPerGroup } from "../modes/grading";
import { SEASON_ROUNDS, currentTrack, loadSeason, seasonDone } from "../modes/season";
import { MEDAL_NAME, type Medal, nextMedal } from "../modes/medals";
import { ADS_ON, AdSlot } from "./Ads";
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
  | { kind: "reaction" }
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
  const reduce = useReducedMotion();
  const w = Math.max(o.width * 2.2, 20);
  const lineId = `line-${id}`;
  const dur = `${o.lapMs / PLAYBACK}ms`;
  const points = o.keyPoints.split(";").map(Number);
  // a dash of length len whose head sits at the car: offset = len - progress
  const trail = (len: number) => points.map((p) => (len - p).toFixed(4)).join(";");
  const timing = { dur, begin: "2.2s", repeatCount: "indefinite", calcMode: "linear", keyTimes: o.keyTimes } as const;
  return (
    <svg viewBox="0 0 1000 1000" className="hero-map h-full w-full overflow-visible" role="img" aria-label={`Map of ${CATALOG.find((t) => t.id === id)?.name}`}>
      <path className="draw draw-1" pathLength={1} d={o.ribbon} fill="none" stroke="#23262d" strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />
      {grades &&
        o.groups.map((g, i) =>
          grades[i] ? (
            <path
              key={i}
              className="sector-in"
              style={{ "--d": `${1500 + i * 110}ms` } as React.CSSProperties}
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
function MapCaption({ o, bestMs, medal }: { o: Outline; bestMs: number | null; medal: Medal | null }) {
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
        <div className="wide num mt-1 text-[15px] text-paint">{lapTime(o.lapMs)}</div>
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
  const o = OUTLINES[daily.trackId];
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
  const next = nextMedal(daily.trackId, medal);
  // today's fastest lap (its time goes in the caption)
  const best = daily.laps.reduce<(typeof daily.laps)[number] | null>((b, l) => (!b || l.lapTimeMs < b.lapTimeMs ? l : b), null);
  // the map paints each corner group in its personal best of the day, F1 style:
  // the best colour reached there on any lap, not just the fastest lap's
  const sectorBest = bestPerGroup(daily.laps.map((l) => l.grades));
  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

  return (
    <div className="hub relative h-full overflow-x-hidden overflow-y-auto">
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

          <p className="rise mt-8 text-[15px] font-semibold text-ink lg:mt-12" style={d(250)}>
            Daily Quali No. {dailyNumber()}
            {quali ? ", race-weekend special" : ""}
          </p>
          <h1 id="daily-h" className="reveal-up wide mt-2 pb-1 text-[clamp(36px,12.5cqw,84px)] [overflow-wrap:anywhere] leading-[0.95] text-paint" style={d(320)}>
            <span>{info.name}</span>
          </h1>
          <p className="rise mt-2 text-[15px] text-steel" style={d(480)}>
            {info.country}, {(o.lengthM / 1000).toFixed(2)} km, {o.cornerCount} corners
          </p>

          {/* the map sits inline on phones, beside the copy from lg */}
          <figure className="mt-4 w-full max-w-[460px] self-center lg:hidden">
            <div className="h-[min(26vh,320px)] w-full">
              <HeroCircuit id={daily.trackId} o={o} grades={sectorBest} />
            </div>
            <MapCaption o={o} bestMs={best?.lapTimeMs ?? null} medal={medal} />
          </figure>

          <div className="rise mt-4 max-w-[440px] lg:mt-10" style={d(620)}>
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
              <MedalLadder trackId={daily.trackId} best={medal} />
              <PoleTarget trackId={daily.trackId} bestMs={best?.lapTimeMs ?? null} />
            </div>
            <button
              className={`${finished ? secondaryBtn : primaryBtn} mt-5 w-full sm:w-auto sm:min-w-[260px]`}
              onClick={() => onAction(finished ? { kind: "daily-summary" } : { kind: "daily" })}
            >
              {finished ? "See today's result" : daily.laps.length ? "Continue" : "Lights out"}
            </button>
          </div>
        </div>

        <figure className="hidden w-full max-w-[600px] justify-self-end lg:block">
          <div className="aspect-square w-full p-[4%]">
            <HeroCircuit id={daily.trackId} o={o} grades={sectorBest} />
          </div>
          <MapCaption o={o} bestMs={best?.lapTimeMs ?? null} medal={medal} />
        </figure>
      </section>

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

      {/* one in-content ad on phones and tablets; wide screens have the side rails */}
      {ADS_ON && (
        <div className="flex justify-center border-t border-line py-8 xl:hidden">
          <AdSlot kind="inline" />
        </div>
      )}

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

      {/* the reaction test: a quick warm-up for the thumbs */}
      <section aria-labelledby="reaction-h" className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 py-12 md:px-8 lg:flex-row lg:items-center lg:justify-between lg:py-14">
          <div className="flex items-center gap-5">
            <Gantry lit={0} size="sm" label="Start lights" />
            <div>
              <h2 id="reaction-h" className="wide text-[26px] leading-none text-paint">
                Lights out
              </h2>
              <p className="mt-2 text-[15px] text-steel">How fast are you off the line? F1 drivers react in about 0.2 s.</p>
            </div>
          </div>
          <button className={`${secondaryBtn} self-start lg:self-auto`} onClick={() => onAction({ kind: "reaction" })}>
            Test your reaction
          </button>
        </div>
      </section>

      {/* record */}
      <footer className="border-t border-line">
        <p className="mx-auto flex max-w-[1240px] flex-wrap items-baseline gap-x-6 gap-y-2 px-4 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] text-[13px] text-steel md:px-8">
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
          <span className="sm:ml-auto">An independent game. Circuit names refer to venues only.</span>
        </p>
      </footer>
    </div>
  );
}
