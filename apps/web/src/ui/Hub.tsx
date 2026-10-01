import { useEffect, useMemo, useState } from "react";
import type { GameTrack } from "@apex/engine";
import { CATALOG, loadTrack } from "../game/catalog";
import { asphaltDataUrl } from "../game/scenery";
import { DAILY_LAPS, dailyNumber, dailyStats, dateKey, loadDaily, msToNextDay } from "../modes/daily";
import { SEASON_ROUNDS, currentTrack, loadSeason, seasonDone } from "../modes/season";
import { Gantry } from "./Gantry";
import { LapGrid } from "./LapGrid";
import { Segments } from "./Segments";
import { Roll } from "./Roll";
import { primaryBtn, secondaryBtn } from "./styles";

export type HubAction = { kind: "daily" } | { kind: "daily-summary" } | { kind: "season"; fresh: boolean } | { kind: "practice" };

function hms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Circuit outline as a small SVG from the centerline (north-up, start marked). */
export function CircuitOutline({ track, className = "" }: { track: GameTrack; className?: string }) {
  const d = useMemo(() => {
    const pts = track.centerline.filter((_, i) => i % 6 === 0);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const y1 = Math.max(...ys);
    const w = Math.max(...xs) - x0;
    const h = y1 - Math.min(...ys);
    const s = 100 / Math.max(w, h);
    const ox = (100 - w * s) / 2;
    const oy = (100 - h * s) / 2;
    return {
      path: pts.map((p, i) => `${i ? "L" : "M"}${(ox + (p[0] - x0) * s).toFixed(1)} ${(oy + (y1 - p[1]) * s).toFixed(1)}`).join(" ") + "Z",
      start: [ox + (pts[0][0] - x0) * s, oy + (y1 - pts[0][1]) * s],
    };
  }, [track]);
  return (
    <svg viewBox="-6 -6 112 112" className={className} aria-hidden="true">
      <path d={d.path} fill="none" stroke="#f2f2ee" strokeWidth={4.5} strokeLinejoin="round" />
      <circle cx={d.start[0]} cy={d.start[1]} r={5} fill="#ff6a13" stroke="#0a0b0d" strokeWidth={2} />
    </svg>
  );
}

/**
 * A painted grid box on the tarmac: a white front line and full-depth side legs,
 * open at the back, with the grid position painted beside it. The content sits
 * directly on the asphalt; there is no card. Pole gets the deeper box.
 */
function GridSlot({ pos, side, pole = false, children }: { pos: number; side: "left" | "right"; pole?: boolean; children: React.ReactNode }) {
  // painted in grid order once the gantry has lit: P1, then P2, then P3
  const d = { "--d": `${900 + (pos - 1) * 160}ms`, "--from": side === "left" ? "14px" : "-14px" } as React.CSSProperties;
  return (
    <div style={d} className={`slot relative w-[62%] min-w-[236px] max-w-[400px] lg:w-full lg:max-w-none ${side === "right" ? "ml-auto" : ""}`}>
      <span
        aria-hidden="true"
        className={`slot-num absolute top-1 ${side === "left" ? "-right-3 translate-x-full" : "-left-3 -translate-x-full"} wide text-[44px] leading-none text-paint/40`}
      >
        {pos}
      </span>
      <div className={`relative px-3.5 pt-3.5 ${pole ? "pb-5" : "pb-3"}`}>
        <span aria-hidden="true" className="paint-x absolute inset-x-0 top-0 h-[3px] bg-paint/90" />
        <span aria-hidden="true" className="paint-y absolute top-0 bottom-0 left-0 w-[3px] bg-gradient-to-b from-paint/90 via-paint/70 to-transparent" />
        <span aria-hidden="true" className="paint-y absolute top-0 right-0 bottom-0 w-[3px] bg-gradient-to-b from-paint/90 via-paint/70 to-transparent" />
        <div className="slot-body">{children}</div>
      </div>
    </div>
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
  const [track, setTrack] = useState<GameTrack | null>(null);
  useEffect(() => {
    loadTrack(daily.trackId).then(setTrack, () => setTrack(null));
  }, [daily.trackId]);

  const info = CATALOG.find((t) => t.id === daily.trackId)!;
  const left = msToNextDay(new Date(now));
  // The gantry is the clock: a lamp lights for every fifth of the day gone; at midnight, lights out.
  const lit = Math.min(5, Math.floor(((86_400_000 - left) / 86_400_000) * 5) + 1);
  const cols = track?.controls?.complexes.length ?? 8;
  const finished = daily.status !== "playing";
  const run = season.run && !seasonDone(season.run) ? season.run : null;
  const wins = run?.results.filter((r) => r === "W").length ?? 0;
  const losses = (run?.results.length ?? 0) - wins;
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;

  const ground = useMemo(() => {
    try {
      return asphaltDataUrl();
    } catch {
      return null;
    }
  }, []);
  // rubbered-in lines where the cars pull away from each column of the grid
  const rubber =
    "linear-gradient(90deg, transparent 14%, rgba(8,8,10,0.22) 22%, transparent 30%, transparent 64%, rgba(8,8,10,0.2) 72%, transparent 80%)";
  const primary = primaryBtn;
  const secondary = secondaryBtn;

  return (
    <div
      className="asphalt relative h-full overflow-y-auto"
      style={ground ? { backgroundImage: `${rubber}, url(${ground})`, backgroundSize: "100% 100%, 180px 180px" } : undefined}
    >
      {/* start gantry: an overhead truss spanning the track, lamps hanging below */}
      <section aria-label="Next Daily Quali" className="relative border-b border-black/60 bg-[#0b0b0c] pb-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.5)]">
        <div aria-hidden="true" className="h-2.5 bg-[repeating-linear-gradient(135deg,#1c1d20_0_6px,#0b0b0c_6px_12px)]" />
        <div className="mx-auto max-w-[560px] px-4 pt-2.5">
          <Gantry lit={lit} sequence label={`Next Daily Quali in ${hms(left)}`} />
          <div className="mt-2.5 flex items-center justify-center gap-3">
            <span className="label text-paint/75">Next quali in</span>
            <Segments text={hms(left)} className="h-5" color="#ff2b1a" ghost={0.2} />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1040px] px-4 pt-4 pb-24 lg:pt-10">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-x-24 lg:gap-y-10 lg:px-16">
          {/* P1: Daily Quali on pole */}
          <GridSlot pos={1} side="left" pole>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="wide text-[26px] uppercase leading-[0.95] text-paint lg:text-[34px]">
                  Daily
                  <br />
                  Quali
                </h2>
                <p className="mt-1.5 text-[13px] font-semibold tracking-[0.06em] text-paint/80 uppercase">
                  #{dailyNumber()} · {info.name}
                </p>
              </div>
              {track && <CircuitOutline track={track} className="h-14 w-14 shrink-0" />}
            </div>
            <div className="mt-3">
              <LapGrid rows={daily.laps.map((l) => l.grades)} total={DAILY_LAPS} cols={cols} size="sm" />
            </div>
            <p className="mt-2.5 text-[14px] leading-snug text-paint/85">
              {daily.status === "won"
                ? `Perfect lap on lap ${daily.laps.length}. Come back tomorrow.`
                : daily.status === "lost"
                  ? "Out of laps today. New circuit at midnight."
                  : daily.laps.length
                    ? `${DAILY_LAPS - daily.laps.length} laps left. Purple every corner to win.`
                    : "6 laps to find the perfect line. Purple every corner to win."}
            </p>
            <button className={`${finished ? secondary : primary} mt-3 w-full`} onClick={() => onAction(finished ? { kind: "daily-summary" } : { kind: "daily" })}>
              {finished ? "See today's result" : daily.laps.length ? "Continue" : "Lights out"}
            </button>
          </GridSlot>

          {/* P2: Perfect Season, staggered right (and lower, on the wide grid) */}
          <div className="lg:pt-28">
            <GridSlot pos={2} side="right">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="wide text-[20px] uppercase leading-[0.95] text-paint lg:text-[26px]">
                  Perfect <br className="hidden lg:block" />
                  Season
                </h2>
                <Roll
                  className="wide shrink-0 text-[26px] whitespace-nowrap text-paint"
                  text={run ? `${wins}–${losses}` : season.best ? `${season.best.wins}–${season.best.losses}` : "12–0"}
                />
              </div>
              <p className="mt-1.5 text-[13px] font-medium leading-snug text-paint/80">
                {run
                  ? `Round ${run.results.length + 1} of ${SEASON_ROUNDS}: ${CATALOG.find((t) => t.id === currentTrack(run))?.name}`
                  : season.best
                    ? `Best ${season.best.wins}–${season.best.losses}. ${season.perfect} perfect seasons.`
                    : "12 circuits. Beat the rival's pole, 3 laps each."}
              </p>
              <div className="mt-2.5 flex gap-1" aria-hidden="true">
                {Array.from({ length: SEASON_ROUNDS }, (_, i) => {
                  const r = run?.results[i];
                  return <span key={i} className={`h-1.5 flex-1 ${r === "W" ? "bg-paint" : r === "L" ? "bg-steel/35" : i === (run?.results.length ?? -1) ? "bg-ink" : "bg-line"}`} />;
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <button className={`${run ? primary : secondary} flex-1`} onClick={() => onAction({ kind: "season", fresh: !run })}>
                  {run ? "Next race" : "Start season"}
                </button>
                {run && (
                  <button className={secondary} onClick={() => onAction({ kind: "season", fresh: true })}>
                    Restart
                  </button>
                )}
              </div>
            </GridSlot>
          </div>

          {/* P3: Free Practice */}
          <GridSlot pos={3} side="left">
            <h2 className="wide text-[20px] uppercase leading-[0.95] text-paint lg:text-[26px]">
              Free <br className="hidden lg:block" />
              Practice
            </h2>
            <p className="mt-1.5 text-[13px] font-medium leading-snug text-paint/80">Any circuit, unlimited laps.</p>
            <button className={`${secondary} mt-3 w-full`} onClick={() => onAction({ kind: "practice" })}>
              Pick a circuit
            </button>
          </GridSlot>
        </div>
      </div>

      {/* your record, one line along the pit wall */}
      <div className="sticky bottom-0 z-[1] border-t border-line bg-night/95 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <p className="rise mx-auto flex max-w-[1040px] flex-wrap items-baseline justify-center gap-x-5 gap-y-1 px-4 pt-2.5 text-[13px] text-steel" style={{ "--d": "1400ms" } as React.CSSProperties}>
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
        </p>
      </div>
    </div>
  );
}
