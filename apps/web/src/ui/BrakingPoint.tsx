import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HowToPlay, modalOpen } from "./HowToPlay";
import { AdBelow } from "./Ads";
import { FinishCard } from "./FinishCard";
import { NextToday } from "./NextToday";
import { track } from "../analytics";
import ZONES from "../game/braking.json";
import { CATALOG } from "../game/catalog";
import { OUTLINES } from "../game/outlines";
import {
  STOPS_PER_DAY,
  type StopRecord,
  type StopResult,
  type Zone,
  brakingDone,
  brakingScore,
  brakingShare,
  brakingStats,
  cornerSpeed,
  dailyStops,
  dayStops,
  describe,
  entrySpeed,
  grade,
  idealBrake,
  recordPractice,
  recordStop,
  scoreStop,
  speedAt,
  verdict,
} from "../modes/braking";
import { WEEKLY_CORNERS } from "../modes/corner";
import { dailyNumber } from "../modes/daily";
import { BOARDS, drawRun } from "./brakingView";
import { primaryBtn, secondaryBtn } from "./styles";

const zones = ZONES as Zone[];
const kmh = (v: number) => Math.round(v * 3.6);
const circuitName = (id: string) => CATALOG.find((t) => t.id === id)?.name ?? id;

/** A stop's name: the corner's own name where the Corner of the week knows it, otherwise its number in the lap. */
function stopName(z: Zone): string {
  const sameGroup = zones.filter((x) => x.track === z.track && x.complex === z.complex).length;
  const famous = sameGroup === 1 ? WEEKLY_CORNERS.find((w) => w.trackId === z.track && w.complex === z.complex) : undefined;
  return famous ? famous.name.replace(/^.*'s /, "") : `Stop ${z.order}`;
}

const GRADE_BG = { purple: "bg-purple", green: "bg-green", yellow: "bg-yellow", red: "bg-kerb" } as const;
const GRADE_TEXT = { purple: "text-purple", green: "text-green", yellow: "text-yellow", red: "text-kerb" } as const;

type Phase = "ready" | "run" | "result";
/** taps this soon after the start are the start tap bouncing, not a brake */
const START_GUARD_MS = 450;

/**
 * Braking point: five big stops a day from real circuits, the same for
 * everyone. The car runs the physics engine's perfect lap down the straight;
 * the player hits the brake, and the car brakes as the engine would from
 * there. Scored on metres from the perfect braking point; too late is off.
 * After the daily five, practice stops are unlimited.
 */
export function BrakingPoint() {
  const today = useMemo(() => dailyStops(zones), []);
  const [stops, setStops] = useState<StopRecord[]>(() => dayStops());
  const done = brakingDone(stops);
  const [mode, setMode] = useState<"daily" | "practice">(() => (brakingDone(dayStops()) ? "practice" : "daily"));
  const [practiceZone, setPracticeZone] = useState(() => Math.floor(Math.random() * zones.length));
  const zoneIndex = mode === "daily" ? today[Math.min(stops.length, STOPS_PER_DAY - 1)] : practiceZone;
  const [shown, setShown] = useState(zoneIndex); // the stop on screen (stays put while its result shows)
  const z = zones[shown];
  const [phase, setPhase] = useState<Phase>("ready");
  const [result, setResult] = useState<StopResult | null>(null);
  const [brakeAt, setBrakeAt] = useState<number | null>(null);
  const [finish, setFinish] = useState(false);

  const canvas = useRef<HTMLCanvasElement>(null);
  const resultBox = useRef<HTMLDivElement>(null);
  // a phone shows the result under the view: bring it up when the stop ends
  useEffect(() => {
    if (phase === "result") resultBox.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [phase]);
  const sim = useRef({ s: 0, v: 0, brakeAt: null as number | null, t0: 0, last: 0, raf: 0 });

  const paint = useCallback(
    (s: number, v: number, braking: boolean, t: number) => {
      const c = canvas.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const dpr = c.width / Math.max(1, c.clientWidth);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRun(ctx, c.clientWidth, c.clientHeight, z, { s, v, braking, t });
    },
    [z],
  );

  // size the canvas to its box (sharp on high-density screens) and draw the waiting frame
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      const st = sim.current;
      if (phase === "ready") paint(z.from, speedAt(z, z.from, null), false, 0);
      else paint(st.s, st.v, st.brakeAt !== null, (st.last - st.t0) / 1000);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, [paint, phase, z]);

  const end = useCallback(
    (at: number | null) => {
      const r = scoreStop(z, at);
      setResult(r);
      setBrakeAt(at);
      setPhase("result");
      if (mode === "daily") {
        const next = recordStop(r);
        setStops(next);
        if (brakingDone(next)) {
          track("Minigame finished", { game: "braking-point", mode: "daily", score: brakingScore(next) });
          window.setTimeout(() => setFinish(true), 1400);
        }
      } else recordPractice();
    },
    [mode, z],
  );

  const start = useCallback(() => {
    const st = sim.current;
    st.s = z.from;
    st.v = speedAt(z, z.from, null);
    st.brakeAt = null;
    st.t0 = st.last = performance.now();
    setResult(null);
    setBrakeAt(null);
    setPhase("run");
    const vMin = cornerSpeed(z);
    const frame = (now: number) => {
      // a crawl to the corner after braking far too early runs at triple speed
      const crawl = st.brakeAt !== null && st.v < vMin * 1.03 && st.s < -25 ? 3 : 1;
      const dt = Math.min(0.05, (now - st.last) / 1000) * crawl;
      st.last = now;
      st.v = speedAt(z, st.s, st.brakeAt);
      st.s += st.v * dt;
      if (st.s >= 0) {
        st.s = 0;
        paint(0, speedAt(z, 0, st.brakeAt), st.brakeAt !== null, (now - st.t0) / 1000);
        end(st.brakeAt);
        return;
      }
      paint(st.s, st.v, st.brakeAt !== null, (now - st.t0) / 1000);
      st.raf = requestAnimationFrame(frame);
    };
    st.raf = requestAnimationFrame(frame);
  }, [end, paint, z]);
  useEffect(() => () => cancelAnimationFrame(sim.current.raf), []);

  const brake = useCallback(() => {
    const st = sim.current;
    const now = performance.now();
    if (phase === "ready") return start();
    if (phase !== "run" || st.brakeAt !== null || now - st.t0 < START_GUARD_MS) return;
    // where the car is right now, between frames
    st.brakeAt = Math.min(-0.01, st.s + st.v * Math.max(0, (now - st.last) / 1000));
    setBrakeAt(st.brakeAt); // the "Braking" flag and prompt
  }, [phase, start]);

  const next = () => {
    if (mode === "practice") {
      let i = practiceZone;
      while (zones.length > 1 && i === practiceZone) i = Math.floor(Math.random() * zones.length);
      setPracticeZone(i);
      setShown(i);
    } else if (!done) setShown(today[stops.length]);
    setPhase("ready");
    setResult(null);
  };

  const practice = () => {
    setFinish(false);
    setMode("practice");
    const i = Math.floor(Math.random() * zones.length);
    setPracticeZone(i);
    setShown(i);
    setPhase("ready");
    setResult(null);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (finish || modalOpen()) return;
      if (e.code === "Space" || e.key === "ArrowDown") {
        e.preventDefault();
        brake();
      } else if (e.key === "Enter" && phase === "result" && !(mode === "daily" && done)) next();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const score = brakingScore(stops);
  const st = brakingStats();
  const stopNo = mode === "daily" ? Math.min(stops.length + (phase === "result" ? 0 : 1), STOPS_PER_DAY) : null;
  const o = OUTLINES[z.track];
  const g = result ? grade(result) : null;
  const braking = phase === "run" && brakeAt !== null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[880px] px-4 pt-6 pb-12 md:px-8 lg:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <div className="flex items-start gap-3">
              <h1 className="wide text-[clamp(28px,6vw,52px)] leading-none text-paint">Braking point</h1>
              <HowToPlay game="braking-point" />
            </div>
            <p className="mt-2 max-w-[48ch] text-[15px] text-steel">
              {mode === "daily" ? "Five big stops on real circuits, the same for everyone. Brake as late as you dare." : "Practice: any stop on any circuit, as often as you like."}
            </p>
          </div>
          {mode === "daily" ? (
            <dl className="flex gap-6 text-center">
              <div>
                <dd className="wide num text-[26px] leading-none text-paint">
                  {score}
                  <span className="text-steel">/{STOPS_PER_DAY * 100}</span>
                </dd>
                <dt className="caption mt-1">Score</dt>
              </div>
              <div>
                <dd className="wide num text-[26px] leading-none text-steel">
                  {stopNo}/{STOPS_PER_DAY}
                </dd>
                <dt className="caption mt-1">Stop</dt>
              </div>
            </dl>
          ) : (
            done && (
              <button className={secondaryBtn} onClick={() => setFinish(true)}>
                Today's result
              </button>
            )
          )}
        </div>

        {mode === "daily" && (
          <ol className="mt-4 flex gap-1" aria-label={`${stops.length} of ${STOPS_PER_DAY} stops made, ${score} points`}>
            {Array.from({ length: STOPS_PER_DAY }, (_, i) => (
              <li key={i} className={`h-2.5 flex-1 ${i < stops.length ? GRADE_BG[grade(stops[i])] : i === stops.length ? "bg-paint/40" : "bg-asphalt"}`} />
            ))}
          </ol>
        )}

        {/* the stop: where it is and how much speed it takes off */}
        <div className="mt-4 flex items-center gap-3 border border-line bg-board/70 p-2.5 pr-4">
          {o && (
            <svg viewBox="0 0 1000 1000" className="h-12 w-12 shrink-0" aria-hidden="true">
              <path d={o.outline} fill="none" stroke="#3a3f48" strokeWidth={46} strokeLinejoin="round" />
              <line x1={z.mapFrom[0]} y1={z.mapFrom[1]} x2={z.map[0]} y2={z.map[1]} stroke="#ff6a13" strokeWidth={40} strokeLinecap="round" />
              <circle cx={z.map[0]} cy={z.map[1]} r={62} fill="#ff6a13" stroke="#0a0b0d" strokeWidth={20} />
            </svg>
          )}
          <div className="min-w-0 flex-1">
            <p className="wide truncate text-[16px] leading-tight text-paint">{circuitName(z.track)}</p>
            <p className="truncate text-[13px] text-steel">
              {stopName(z)}, a {z.direction} turn
            </p>
          </div>
          <p className="num shrink-0 text-right text-[14px] leading-tight text-paint">
            {kmh(entrySpeed(z))} <span className="text-steel">→</span> {kmh(cornerSpeed(z))}
            <span className="block text-[12px] text-steel">km/h</span>
          </p>
        </div>

        {/* the onboard view */}
        <div className="relative mt-3 overflow-hidden border border-line bg-night">
          <canvas ref={canvas} className="block aspect-[4/3] w-full sm:aspect-[16/9]" aria-label={`Onboard, approaching ${stopName(z)} at ${circuitName(z.track)}`} />
          <Speed s={phase} getV={() => (phase === "run" ? sim.current.v : phase === "result" && result ? result.cornerV : speedAt(z, z.from, null))} />
          {braking && <span className="caption absolute top-3 left-3 bg-lamp px-2 py-1 text-night">Braking</span>}
          {phase === "ready" && (
            <p className="absolute top-3 left-3 max-w-[55%] bg-night/80 px-2.5 py-1.5 text-[12px] leading-snug text-paint/90 sm:text-[13px]">
              Boards at {BOARDS.filter((m) => -m >= z.from + 6).join(", ")} m before the corner
            </p>
          )}
          {phase !== "result" && (
            // the pedal, in the view and clear of the car: one screen to watch and brake
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault(); // on touch-down, not release: a metre is 12 ms at 300 km/h
                brake();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") e.preventDefault(); // the window handles the keys, once
              }}
              className={`launch-btn brake-pedal absolute right-2 bottom-2 sm:right-4 sm:bottom-4 ${phase === "run" ? "launch-armed" : ""}`}
              aria-label={phase === "ready" ? "Go" : "Brake"}
            >
              <span className="launch-cap">
                <span className="wide text-[15px] tracking-[0.06em] sm:text-[17px]">{phase === "ready" ? "Go" : "Brake"}</span>
              </span>
            </button>
          )}
        </div>

        {/* the result of the stop (the pedal sits in the view) */}
        {phase !== "result" ? (
          <p className="mt-3 text-center text-[14px] text-steel">
            {phase === "ready" ? (
              <>
                Press Go, then Brake for the corner<span className="hidden [@media(hover:hover)]:inline"> (Space works too)</span>.
              </>
            ) : brakeAt === null ? (
              "Brake!"
            ) : (
              "Braking. Hold your nerve."
            )}
          </p>
        ) : (
          result &&
          g && (
            <div ref={resultBox} className="rise mt-5 scroll-mb-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className={`wide text-[clamp(26px,6vw,40px)] leading-none ${GRADE_TEXT[g]}`}>{result.off ? (result.metres === null ? "No brakes" : "Off the road") : describe(result)}</p>
                <p className="wide num text-[22px] text-paint">
                  +{result.points} <span className="text-[14px] text-steel">pts</span>
                </p>
              </div>
              <p className="mt-2 text-[15px] text-paint/85">
                {result.metres === null
                  ? "The car never braked and went straight on."
                  : result.off
                    ? `${describe(result)}: ${kmh(result.cornerV)} km/h into a ${kmh(cornerSpeed(z))} km/h corner.`
                    : result.metres < 0
                      ? `Safe, but ${result.lost.toFixed(2)} s slower than the perfect stop.`
                      : `${kmh(result.cornerV)} km/h at the corner, ${kmh(result.cornerV) - kmh(cornerSpeed(z))} km/h over its limit: you'll run wide.`}
              </p>
              <BrakeStrip z={z} brakeAt={brakeAt} />
              <div className="mt-5 flex flex-wrap gap-2">
                {mode === "daily" && done ? (
                  <>
                    <button className={primaryBtn} onClick={() => setFinish(true)}>
                      See result
                    </button>
                    <button className={secondaryBtn} onClick={practice}>
                      Practice stops
                    </button>
                  </>
                ) : (
                  <button className={primaryBtn} onClick={next}>
                    {mode === "daily" ? `Stop ${stops.length + 1} of ${STOPS_PER_DAY}` : "Another stop"}
                  </button>
                )}
              </div>
            </div>
          )
        )}

        {mode === "daily" && done && phase !== "result" && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <NextToday />
          </div>
        )}
      </div>

      <AdBelow />

      {finish && done && (
        <FinishCard
          game="braking-point"
          eyebrow={`Braking point #${dailyNumber()}`}
          title={verdict(score)}
          tone={score >= 350 ? "win" : score >= 200 ? "neutral" : "loss"}
          value={`${score}`}
          valueLabel={`of ${STOPS_PER_DAY * 100} points`}
          message={stops.map((s) => (s.off ? (s.metres === null ? "no brakes" : "off") : describe(s).toLowerCase())).join(", ")}
          stats={[
            ["Played", String(st.played)],
            ["Average", st.average !== null ? String(Math.round(st.average)) : "-"],
            ["Best", st.best !== null ? String(st.best) : "-"],
          ]}
          shareText={brakingShare(stops, `${location.origin}/braking-point`)}
          again={{ label: "Practice stops", onClick: practice }}
          daily="set of stops"
          onClose={() => setFinish(false)}
        />
      )}
    </div>
  );
}

/** The speed readout over the view, refreshed each frame while running. */
function Speed({ s, getV }: { s: Phase; getV: () => number }) {
  const [v, setV] = useState(getV);
  useEffect(() => {
    setV(getV());
    if (s !== "run") return;
    let raf = 0;
    const tick = () => {
      setV(getV());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);
  return (
    <div className="pointer-events-none absolute top-3 right-3 bg-night/75 px-2.5 py-1.5 text-right">
      <span className="wide num block text-[clamp(22px,5vw,34px)] leading-none text-paint">{kmh(v)}</span>
      <span className="caption">km/h</span>
    </div>
  );
}

/** The stop on one line: the boards, the perfect braking point, and yours. */
function BrakeStrip({ z, brakeAt }: { z: Zone; brakeAt: number | null }) {
  const ideal = idealBrake(z);
  const lo = Math.min(ideal, brakeAt ?? 0, z.from) - 10;
  const x = (s: number) => `${((s - lo) / -lo) * 100}%`;
  return (
    <div className="mt-5">
      <div className="relative h-12 border-y border-line bg-asphalt/60">
        {BOARDS.filter((m) => -m > lo).map((m) => (
          <span key={m} className="absolute top-0 h-full border-l border-paint/15" style={{ left: x(-m) }}>
            <span className="num absolute top-1 left-1 text-[11px] text-steel">{m}</span>
          </span>
        ))}
        <span className="absolute top-0 h-full w-0.5 bg-purple" style={{ left: x(ideal) }} title="Perfect braking point" />
        {brakeAt !== null && <span className="absolute top-0 h-full w-1 -translate-x-1/2 bg-ink" style={{ left: x(brakeAt) }} title="You braked here" />}
        <span className="caption absolute top-1/2 right-1 -translate-y-1/2 text-paint">Corner</span>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-5 text-[13px] text-steel">
        <span>
          <span className="mr-1.5 inline-block h-2.5 w-2.5 bg-purple align-middle" />
          Perfect: brake {Math.round(-ideal)} m before
        </span>
        {brakeAt !== null && (
          <span>
            <span className="mr-1.5 inline-block h-2.5 w-2.5 bg-ink align-middle" />
            You: {Math.round(-brakeAt)} m before
          </span>
        )}
      </p>
    </div>
  );
}
