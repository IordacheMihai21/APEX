import { useEffect, useMemo, useState } from "react";
import type { GameTrack } from "@apex/engine";
import { CATALOG } from "../game/catalog";
import { OUTLINES, type Outline } from "../game/outlines";
import { DAILY_LAPS, dailyNumber, dailyStats, dateKey, loadDaily, msToNextDay } from "../modes/daily";
import { SEASON_ROUNDS, currentTrack, loadSeason, seasonDone } from "../modes/season";
import { Gantry } from "./Gantry";
import { LapGrid } from "./LapGrid";
import { Roll } from "./Roll";
import { Segments } from "./Segments";
import { primaryBtn, secondaryBtn } from "./styles";

export type HubAction =
  | { kind: "daily" }
  | { kind: "daily-summary" }
  | { kind: "season"; fresh: boolean }
  | { kind: "practice" }
  | { kind: "practice-track"; trackId: string };

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
 * Today's circuit as a track map: the ribbon with painted edges, corner
 * numbers, the start line, and the optimal line with a car lapping it at the
 * speeds the physics engine computes (×4, the game's playback speed). The map
 * draws itself in once, then the car runs.
 */
function HeroCircuit({ id, o }: { id: string; o: Outline }) {
  const reduce = useReducedMotion();
  const w = Math.max(o.width * 1.7, 15);
  const [sx, sy, heading] = o.start;
  const lineId = `line-${id}`;
  return (
    <svg viewBox="0 0 1000 1000" className="hero-map h-full w-full" role="img" aria-label={`Map of ${CATALOG.find((t) => t.id === id)?.name}`}>
      <path className="draw draw-1" pathLength={1} d={o.ribbon} fill="none" stroke="#f2f2ee" strokeOpacity={0.9} strokeWidth={w + 7} strokeLinejoin="round" />
      <path className="draw draw-1" pathLength={1} d={o.ribbon} fill="none" stroke="#262a31" strokeWidth={w} strokeLinejoin="round" />
      <g transform={`translate(${sx} ${sy}) rotate(${heading + 90})`} className="fade-late">
        {[-1, 0, 1].map((k) => (
          <rect key={k} x={k * 7 - 3.5} y={-7} width={7} height={7} fill={k % 2 ? "#f2f2ee" : "#0a0b0d"} />
        ))}
        {[-1, 0, 1].map((k) => (
          <rect key={`b${k}`} x={k * 7 - 3.5} y={0} width={7} height={7} fill={k % 2 ? "#0a0b0d" : "#f2f2ee"} />
        ))}
      </g>
      <path id={lineId} className="draw draw-2" pathLength={1} d={o.line} fill="none" stroke="#ff6a13" strokeWidth={3.2} strokeLinejoin="round" />
      <g className="fade-late" fontFamily="Archivo Variable, Archivo, sans-serif" fontWeight={700} fontSize={24} fill="#9aa1ab" textAnchor="middle" dominantBaseline="central">
        {o.corners.map(([n, x, y]) => (
          <text key={n} x={x} y={y} style={{ fontStretch: "80%" }}>
            {n}
          </text>
        ))}
      </g>
      <g className="fade-late">
        <g>
          <rect x={-19} y={-8} width={38} height={16} fill="#ff6a13" stroke="#0a0b0d" strokeWidth={3.5} />
          <rect x={5} y={-5} width={7} height={10} fill="#0a0b0d" />
          {!reduce && (
            <animateMotion
              dur={`${o.lapMs / PLAYBACK}ms`}
              begin="2.4s"
              repeatCount="indefinite"
              rotate="auto"
              calcMode="linear"
              keyPoints={o.keyPoints}
              keyTimes={o.keyTimes}
            >
              <mpath href={`#${lineId}`} />
            </animateMotion>
          )}
        </g>
      </g>
    </svg>
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
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const lapsLeft = DAILY_LAPS - daily.laps.length;
  const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

  return (
    <div className="hub relative h-full overflow-x-hidden overflow-y-auto">
      {/* today's circuit */}
      <section
        aria-labelledby="daily-h"
        className="relative mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-x-10 px-4 pt-5 pb-10 md:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:pt-10 lg:pb-14"
      >
        <div className="relative z-[1] flex flex-col">
          <div className="rise flex items-center gap-4" style={d(0)}>
            <Gantry lit={lit} size="sm" sequence label={`Next Daily Quali in ${hms(left)}`} />
            <div className="leading-tight">
              <div className="text-[13px] text-steel">Next circuit in</div>
              <Segments text={hms(left)} className="mt-1 h-4" color="#ff2b1a" ghost={0.18} />
            </div>
          </div>

          <p className="rise mt-8 text-[15px] font-semibold text-ink lg:mt-12" style={d(250)}>
            Daily Quali No. {dailyNumber()}
          </p>
          <h1 id="daily-h" className="reveal-up wide mt-2 pb-1 text-[clamp(44px,6vw,84px)] leading-[0.95] text-paint" style={d(320)}>
            <span>{info.name}</span>
          </h1>
          <p className="rise mt-2 text-[15px] text-steel" style={d(480)}>
            {info.country}, {(o.lengthM / 1000).toFixed(2)} km, {o.cornerCount} corners
          </p>

          {/* the map sits inline on phones, beside the copy from lg */}
          <div className="relative mt-2 aspect-square w-full max-w-[460px] self-center lg:hidden">
            <HeroCircuit id={daily.trackId} o={o} />
          </div>

          <div className="rise mt-4 max-w-[440px] lg:mt-10" style={d(620)}>
            <LapGrid rows={daily.laps.map((l) => l.grades)} total={DAILY_LAPS} cols={cols} size="sm" />
            <p className="mt-3 text-[15px] leading-snug text-paint/85">
              {daily.status === "won"
                ? `Perfect lap on lap ${daily.laps.length}. Come back tomorrow.`
                : daily.status === "lost"
                  ? "Out of laps today. A new circuit at midnight."
                  : daily.laps.length
                    ? `${lapsLeft} ${lapsLeft === 1 ? "lap" : "laps"} left. Purple every corner to win.`
                    : "Six laps to find the perfect line. Purple every corner to win."}
            </p>
            <button
              className={`${finished ? secondaryBtn : primaryBtn} mt-5 w-full sm:w-auto sm:min-w-[260px]`}
              onClick={() => onAction(finished ? { kind: "daily-summary" } : { kind: "daily" })}
            >
              {finished ? "See today's result" : daily.laps.length ? "Continue" : "Lights out"}
            </button>
          </div>
        </div>

        <div className="relative hidden aspect-square max-h-[calc(100dvh-140px)] w-full justify-self-center lg:block">
          <div aria-hidden="true" className="absolute inset-[6%] rounded-full bg-[radial-gradient(closest-side,rgba(38,42,49,0.5),transparent)]" />
          <HeroCircuit id={daily.trackId} o={o} />
        </div>
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
      <footer className="border-t border-line">
        <p className="mx-auto flex max-w-[1240px] flex-wrap items-baseline gap-x-6 gap-y-2 px-4 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] text-[13px] text-steel md:px-8">
          {stats.played === 0 ? (
            <span>Finish a Daily Quali to start your record.</span>
          ) : (
            <>
              <span>
                <Roll text={String(stats.played)} className="wide mr-1.5 text-[15px] text-paint" />
                {stats.played === 1 ? "daily played" : "dailies played"}
              </span>
              <span>
                <Roll text={`${winPct}%`} className="wide mr-1.5 text-[15px] text-paint" />
                perfect
              </span>
              <span>
                <Roll text={String(stats.streak)} className="wide mr-1.5 text-[15px] text-ink" />
                streak, best {stats.bestStreak}
              </span>
            </>
          )}
          <span className="sm:ml-auto">An independent game. Circuit names refer to venues only.</span>
        </p>
      </footer>
    </div>
  );
}
