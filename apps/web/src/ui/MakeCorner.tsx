import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "../i18n";
import type { Condition } from "@apex/engine";
import { HowToPlay, modalOpen } from "./HowToPlay";
import { AdBelow } from "./Ads";
import { FinishCard } from "./FinishCard";
import { NextToday } from "./NextToday";
import { gameFinished, gameStarted } from "../games/events";
import { CONDITION_NAME, dailyNumber } from "../modes/daily";
import { CornerRun, type CornerData, DT, MAX_POINTS, type OffStart, type Phase, type RunScore, idealCalls, offDuration, offRoadPose, perfectRun, scoreRun } from "../modes/makeCorner";
import {
  CORNERS,
  type CallGrade,
  type CornerEntry,
  RUNS_PER_DAY,
  type RunRecord,
  callGrades,
  cornerDone,
  cornerLabel,
  cornerScore,
  cornerShare,
  cornerStats,
  cornerVerdict,
  dailyCorner,
  raceWeekCorner,
  dayRuns,
  recordCornerPractice,
  recordRun,
} from "../modes/makeCornerDay";
import { CornerScene } from "../game3d/cornerScene";
import { CAR_CREDIT } from "../game3d/car";
import { EngineSound, soundMuted } from "../game3d/engineSound";
import { SoundOff, SoundOn } from "./icons";
import { primaryBtn, secondaryBtn } from "./styles";
import { shareLink } from "../shareLink";

const files = import.meta.glob<CornerData>("../game/corners/*-*.json", { import: "default" });
const loadCorner = (id: string) => files[`../game/corners/${id}.json`]();

const kmh = (v: number) => Math.round(v * 3.6);
const GRADE_BG: Record<CallGrade, string> = { purple: "bg-purple", green: "bg-green", yellow: "bg-yellow", red: "bg-kerb", none: "bg-asphalt" };
const GRADE_TEXT: Record<CallGrade, string> = { purple: "text-purple", green: "text-green", yellow: "text-yellow", red: "text-kerb", none: "text-steel" };

type Screen = "loading" | "ready" | "run" | "result";
const PROMPT: Record<Phase, string> = {
  approach: t("Hold to brake"),
  braking: t("Let go to carry the speed"),
  rolling: t("Press for the throttle"),
  throttle: t("Flat out"),
};
const PEDAL: Record<Phase, string> = { approach: t("Brake"), braking: t("Let go"), rolling: t("Throttle"), throttle: t("Flat out") };

/** "3.2 m early", "Spot on" */
function early(m: number | null, unit: "m" | "km/h", spot: number): string {
  if (m === null) return t("Not made");
  if (Math.abs(m) < spot) return t("Spot on");
  const e = Math.abs(m).toFixed(1);
  return unit === "m" ? t(m < 0 ? "{e} m early" : "{e} m late", { e }) : t(m < 0 ? "{e} km/h slow" : "{e} km/h fast", { e });
}

/** Why a run ended short of the exit, from the phase it ended in. */
function offReason(r: RunScore, phase: Phase): { title: string; line: string } {
  if (r.outcome === "stopped") return { title: t("Stopped"), line: t("The brakes stayed on until the car stopped. Let go once you're down to the corner's speed.") };
  if (phase === "approach") return { title: t("No brakes"), line: t("The car reached the corner flat out and went straight on.") };
  if (phase === "throttle") return { title: t("Ran wide"), line: t("On the throttle too early: the tyres couldn't hold the line and the car ran off at the exit.") };
  return { title: t("Off the road"), line: r.brakeM !== null && r.brakeM > 0 && phase === "braking" ? t("Braked too late: still too fast when the corner arrived.") : t("Let go of the brakes too soon: too fast for the corner.") };
}

/**
 * Make the corner: one famous corner a day in 3D, the same for everyone, and
 * three runs at it. Hold to brake, let go to carry speed through the corner,
 * press again for the throttle. The physics is the engine's (modes/makeCorner);
 * the best of the three runs is the day's score. Practice is unlimited after.
 */
export function MakeCorner() {
  const today = useMemo(() => dailyCorner(), []);
  const [runs, setRuns] = useState<RunRecord[]>(() => dayRuns());
  const done = cornerDone(runs);
  const [mode, setMode] = useState<"daily" | "practice">(() => (cornerDone(dayRuns()) ? "practice" : "daily"));
  const [practice, setPractice] = useState<{ corner: CornerEntry; condition: Condition }>(() => randomCorner());
  const { corner, condition } = mode === "daily" ? today : practice;
  const [data, setData] = useState<CornerData | null>(null);
  const [screen, setScreen] = useState<Screen>("loading");
  const [phase, setPhase] = useState<Phase>("approach");
  const [down, setDown] = useState(false);
  const [result, setResult] = useState<{ score: RunScore; phase: Phase } | null>(null);
  const [finish, setFinish] = useState(false);
  const [noGl, setNoGl] = useState(false);
  const [muted, setMuted] = useState(soundMuted);
  const engine = useRef<EngineSound | null>(null);

  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const speedEl = useRef<HTMLSpanElement>(null);
  const resultBox = useRef<HTMLDivElement>(null);
  const scene = useRef<CornerScene | null>(null);
  const perfect = useRef<CornerRun | null>(null);
  const sim = useRef({ run: null as CornerRun | null, last: 0, acc: 0, raf: 0, needsUp: false, endAt: 0, off: null as (OffStart & { at: number }) | null, lastV: 0 });

  // the day's (or practice) corner: its data, and the perfect run to score against
  useEffect(() => {
    let live = true;
    setScreen("loading");
    setData(null);
    loadCorner(corner.id).then((c) => {
      if (!live) return;
      perfect.current = perfectRun(c, condition);
      sim.current.run = new CornerRun(c, condition);
      setData(c);
      setPhase("approach");
    });
    return () => {
      live = false;
    };
  }, [corner.id, condition]);

  // the 3D scene for that corner (the circuit and its surroundings load with it), sized to its box
  useEffect(() => {
    const c = canvas.current;
    const box = view.current;
    if (!c || !box || !data) return;
    let live = true;
    let s: CornerScene | null = null;
    let ro: ResizeObserver | null = null;
    CornerScene.create(c, data, condition).then(
      (made) => {
        if (!live) return made.dispose();
        s = made;
        scene.current = made;
        const fit = () => {
          made.resize(box.clientWidth, box.clientHeight);
          const run = sim.current.run;
          if (run && sim.current.raf === 0) made.render(run.pose(), run.v, run.phase === "braking", 0);
        };
        fit();
        ro = new ResizeObserver(fit);
        ro.observe(box);
        setScreen("ready");
      },
      () => live && setNoGl(true),
    );
    return () => {
      live = false;
      ro?.disconnect();
      cancelAnimationFrame(sim.current.raf);
      sim.current.raf = 0;
      s?.dispose();
      scene.current = null;
    };
  }, [data, condition]);

  useEffect(() => {
    if (screen === "result") resultBox.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [screen]);

  /** Bring the run up to `now` in fixed steps (so a press lands where the car is, between frames). */
  const sync = (now: number) => {
    const st = sim.current;
    const run = st.run;
    if (!run) return;
    st.acc += Math.min(0.1, Math.max(0, (now - st.last) / 1000));
    st.last = now;
    const steps = Math.floor(st.acc / DT);
    if (steps > 0 && !run.outcome) run.advance(steps * DT);
    st.acc -= steps * DT;
  };

  const end = useCallback(
    (run: CornerRun) => {
      if (!perfect.current) return;
      const score = scoreRun(run, perfect.current);
      setResult({ score, phase: run.phase });
      setScreen("result");
      setDown(false);
      if (mode === "daily") {
        const next = recordRun(score);
        setRuns(next);
        if (cornerDone(next)) {
          const best = cornerScore(next);
          gameFinished("make-the-corner", "daily", { score: best >= 900 ? "900-1000" : best >= 700 ? "700-899" : best >= 400 ? "400-699" : best > 0 ? "1-399" : "0", condition });
          window.setTimeout(() => setFinish(true), 1400);
        }
      } else {
        recordCornerPractice();
        gameFinished("make-the-corner", "practice", { outcome: score.outcome, condition });
      }
    },
    [mode, condition],
  );

  const loop = useCallback(
    (now: number) => {
      const st = sim.current;
      const run = st.run;
      const s = scene.current;
      if (!run || !s || !data) return;
      const dt = Math.min(0.1, Math.max(0, (now - st.last) / 1000));
      sync(now);
      if (run.outcome === "off" && !st.off) {
        // off the road: the car carries on the way it was going and slows on the grass or gravel
        const p = run.pose();
        // the speed it had on the road (the run's own speed is cut to the corner's limit as it gives up)
        st.off = { x: p.x, y: p.y, heading: p.heading, kappa: p.kappa, v: Math.max(run.v, st.lastV), at: now };
      }
      if (!run.outcome) st.lastV = run.v;
      if (run.outcome && !st.endAt) st.endAt = now + (st.off ? offDuration(st.off) * 1000 + 250 : 300);
      const off = st.off ? offRoadPose(st.off, (now - st.off.at) / 1000) : null;
      s.render(off ?? run.pose(), off ? off.v : run.v, off ? true : run.phase === "braking" && !run.outcome, dt);
      engine.current?.update(s.crashed ? 0 : off ? off.v : run.v, run.outcome === "off" || run.outcome === "stopped" ? run.outcome : run.phase);
      // into the barrier: the speed drops to nothing and the result comes sooner
      if (s.crashed && st.endAt > now + 700) st.endAt = now + 700;
      if (speedEl.current) speedEl.current.textContent = String(kmh(run.outcome === "stopped" || s.crashed ? 0 : off ? off.v : run.v));
      setPhase(run.phase);
      if (st.endAt && now >= st.endAt) {
        st.raf = 0;
        engine.current?.fade();
        end(run);
        return;
      }
      st.raf = requestAnimationFrame(loop);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, condition, end],
  );

  const start = () => {
    const st = sim.current;
    if (!data || screen === "run") return;
    gameStarted("make-the-corner", mode);
    st.run = new CornerRun(data, condition);
    st.acc = 0;
    st.last = performance.now();
    st.needsUp = true; // the start press is not the brake: it counts from the next press
    st.endAt = 0;
    st.off = null;
    setResult(null);
    setPhase("approach");
    setScreen("run");
    // the engine: sound may only start from a tap or a key, which is what started the run
    const eng = (engine.current ??= new EngineSound());
    const v0 = st.run.v;
    void eng.unlock().then(() => eng.start(v0));
    view.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(loop);
  };

  const press = (isDown: boolean) => {
    const st = sim.current;
    if (isDown && screen === "ready") return start();
    if (screen !== "run" || !st.run || st.run.outcome) return;
    if (!isDown) st.needsUp = false;
    else if (st.needsUp) return;
    sync(performance.now());
    st.run.press(isDown);
    setDown(isDown);
    setPhase(st.run.phase);
  };

  // Space for the pedal on a keyboard; Enter for the next run
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (finish || modalOpen()) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) press(e.type === "keydown");
      } else if (e.type === "keydown" && e.key === "Enter" && screen === "result" && !(mode === "daily" && done)) again();
    };
    window.addEventListener("keydown", k);
    window.addEventListener("keyup", k);
    return () => {
      window.removeEventListener("keydown", k);
      window.removeEventListener("keyup", k);
    };
  });
  useEffect(
    () => () => {
      cancelAnimationFrame(sim.current.raf);
      engine.current?.dispose();
    },
    [],
  );

  /** Back to the start of the corner for another run. */
  const again = () => {
    const st = sim.current;
    if (!data) return;
    st.run = new CornerRun(data, condition);
    st.off = null;
    setResult(null);
    setPhase("approach");
    setScreen("ready");
    const s = scene.current;
    if (s) s.render(st.run.pose(), st.run.v, false, 0);
  };

  const practiceNew = () => {
    setFinish(false);
    setMode("practice");
    setPractice(randomCorner(practice.corner.id));
  };

  const score = cornerScore(runs);
  const st = cornerStats();
  const label = cornerLabel(corner);
  const ideal = data ? idealCalls(data, condition) : null;
  const apexS = data ? data.s[data.conditions[condition].apex] : 0;
  const runNo = Math.min(runs.length + (screen === "result" ? 0 : 1), RUNS_PER_DAY);
  const grades = result ? callGrades(result.score) : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[880px] px-4 pt-6 pb-12 md:px-8 lg:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <div className="flex items-start gap-3">
              <h1 className="wide text-[clamp(28px,6vw,52px)] leading-none text-paint">Make the corner</h1>
              <HowToPlay game="make-the-corner" />
            </div>
            <p className="mt-2 max-w-[48ch] text-[15px] text-steel">
              {mode === "daily"
                ? raceWeekCorner()
                  ? t("Race week: {circuit}'s corners all week, before its Grand Prix. The same for everyone. Brake, carry the speed, get on the power.", { circuit: label.circuit })
                  : t("One famous corner a day, the same for everyone. Brake, carry the speed, get on the power.")
                : t("Practice: any corner, any conditions, as often as you like.")}
            </p>
          </div>
          {mode === "daily" ? (
            <dl className="flex gap-6 text-center">
              <div>
                <dd className="wide num text-[26px] leading-none text-paint">
                  {score}
                  <span className="text-steel">/{MAX_POINTS}</span>
                </dd>
                <dt className="caption mt-1">{t("Best")}</dt>
              </div>
              <div>
                <dd className="wide num text-[26px] leading-none text-steel">
                  {runNo}/{RUNS_PER_DAY}
                </dd>
                <dt className="caption mt-1">{t("Run")}</dt>
              </div>
            </dl>
          ) : (
            done && (
              <button className={secondaryBtn} onClick={() => setFinish(true)}>
                {t("Today's result")}
              </button>
            )
          )}
        </div>

        {/* the corner: where, and in what conditions */}
        <div className="mt-4 flex items-center gap-3 border border-line bg-board/70 p-2.5 pr-4">
          <div className="min-w-0 flex-1">
            <p className="wide truncate text-[16px] leading-tight text-paint">{label.corner}</p>
            <p className="truncate text-[13px] text-steel">
              {t(data?.direction === "left" ? "{circuit}, a left turn" : data?.direction === "right" ? "{circuit}, a right turn" : "{circuit}, a turn", { circuit: label.circuit })}
            </p>
          </div>
          <p className="shrink-0 text-right text-[13px] leading-tight text-paint">
            {t(CONDITION_NAME[condition])}
            {ideal && <span className="block text-[12px] text-steel">{t("perfect: {v} km/h", { v: kmh(ideal.minSpeed) })}</span>}
          </p>
        </div>

        {mode === "daily" && (
          <ol className="mt-3 flex gap-1" aria-label={t("{n} of {total} runs made, best {score} points", { n: runs.length, total: RUNS_PER_DAY, score })}>
            {Array.from({ length: RUNS_PER_DAY }, (_, i) => (
              <li key={i} className={`h-2.5 flex-1 ${i < runs.length ? (runs[i].points > 0 ? "bg-green" : "bg-kerb") : i === runs.length ? "bg-paint/40" : "bg-asphalt"}`} />
            ))}
          </ol>
        )}

        {/* the 3D view: the whole view is the pedal */}
        <div
          ref={view}
          className="relative mt-3 aspect-[4/5] touch-none overflow-hidden border border-line bg-night select-none sm:aspect-[16/9]"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("[data-ui]")) return; // the sound switch is not the pedal
            e.preventDefault();
            press(true);
          }}
          onPointerUp={() => press(false)}
          onPointerCancel={() => press(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <canvas ref={canvas} className="block h-full w-full" aria-label={t("3D view of {corner} at {circuit}", { corner: label.corner, circuit: label.circuit })} />
          {noGl && <p className="absolute inset-0 grid place-items-center p-6 text-center text-[15px] text-paint">{t("This game needs WebGL, which this browser has turned off.")}</p>}
          <div className="pointer-events-none absolute top-3 right-3 bg-night/75 px-2.5 py-1.5 text-right">
            <span ref={speedEl} className="wide num block text-[clamp(22px,5vw,34px)] leading-none text-paint">
              {data ? kmh(data.conditions[condition].speed[0]) : "–"}
            </span>
            <span className="caption">km/h</span>
          </div>
          {screen === "run" && phase !== "approach" && (
            <span className={`caption absolute top-3 left-3 px-2 py-1 text-night ${phase === "braking" ? "bg-lamp" : phase === "rolling" ? "bg-yellow" : "bg-green"}`}>
              {phase === "braking" ? t("Braking") : phase === "rolling" ? t("Carrying speed") : t("Throttle")}
            </span>
          )}
          {screen === "ready" && (
            <p className="absolute top-3 left-3 max-w-[60%] bg-night/80 px-2.5 py-1.5 text-[12px] leading-snug text-paint/90 sm:text-[13px]">
              {t("Boards at 300, 200, 100 and 50 m before the turn-in")}
            </p>
          )}
          {screen === "loading" && <p className="absolute inset-0 grid place-items-center text-[14px] text-steel">{t("Loading the corner…")}</p>}
          <button
            type="button"
            data-ui
            onClick={() => {
              const next = !muted;
              setMuted(next);
              (engine.current ??= new EngineSound()).setMuted(next);
            }}
            aria-label={muted ? t("Turn the engine sound on") : t("Turn the engine sound off")}
            aria-pressed={!muted}
            className="absolute bottom-3 left-3 grid h-10 w-10 place-items-center bg-night/75 text-paint"
          >
            {muted ? <SoundOff className="h-5 w-5" /> : <SoundOn className="h-5 w-5" />}
          </button>
          {(screen === "ready" || screen === "run") && (
            <span
              className={`launch-btn brake-pedal pointer-events-none absolute right-2 bottom-2 sm:right-4 sm:bottom-4 ${screen === "run" ? "launch-armed" : ""}`}
              style={down ? { transform: "translateY(2px) scale(0.97)" } : undefined}
              aria-hidden="true"
            >
              <span className="launch-cap">
                <span className="wide text-[14px] tracking-[0.06em] sm:text-[16px]">{screen === "ready" ? t("Go") : PEDAL[phase]}</span>
              </span>
            </span>
          )}
        </div>

        {screen !== "result" ? (
          <p className="mt-3 text-center text-[14px] text-steel" role="status">
            {screen === "ready" ? (
              <>
                {t("Tap the view to start")}<span className="hidden [@media(hover:hover)]:inline"> {t("(or press Space)")}</span>. {t("Hold to brake, let go, then press for the throttle.")}
              </>
            ) : screen === "run" ? (
              PROMPT[phase]
            ) : null}
          </p>
        ) : (
          result &&
          grades &&
          ideal && (
            <div ref={resultBox} className="rise mt-5 scroll-mb-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className={`wide text-[clamp(26px,6vw,40px)] leading-none ${result.score.outcome === "done" ? "text-paint" : "text-kerb"}`}>
                  {result.score.outcome === "done" ? (result.score.points >= MAX_POINTS - 5 ? t("Perfect corner") : `+${(result.score.lost ?? 0).toFixed(2)} s`) : offReason(result.score, result.phase).title}
                </p>
                <p className="wide num text-[22px] text-paint">
                  {result.score.points} <span className="text-[14px] text-steel">{t("pts")}</span>
                </p>
              </div>
              <p className="mt-2 text-[15px] text-paint/85">
                {result.score.outcome === "done"
                  ? result.score.points >= MAX_POINTS - 5
                    ? t("As quick as the perfect lap through here.")
                    : t("Through the corner, {s} s slower than the perfect lap.", { s: (result.score.lost ?? 0).toFixed(2) })
                  : offReason(result.score, result.phase).line}
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    [t("Brake"), early(result.score.brakeM, "m", 0.5), t("Perfect: {m} m before the apex", { m: Math.round(apexS - ideal.brakeS) })],
                    [t("Corner speed"), early(result.score.speedKmh, "km/h", 0.5), t("Perfect: {v} km/h", { v: kmh(ideal.minSpeed) })],
                    [t("Throttle"), early(result.score.throttleM, "m", 0.5), Math.abs(ideal.throttleS - apexS) < 2 ? t("Perfect: at the apex") : t("Perfect: {m} m after the apex", { m: Math.round(ideal.throttleS - apexS) })],
                  ] as const
                ).map(([name, what, perfectLine], i) => (
                  <li key={name} className="flex gap-3 border border-line bg-board/70 p-3">
                    <span className={`w-1.5 shrink-0 ${GRADE_BG[grades[i]]}`} />
                    <span className="min-w-0">
                      <span className="caption block">{name}</span>
                      <span className={`wide block text-[17px] leading-tight ${GRADE_TEXT[grades[i]]}`}>{what}</span>
                      <span className="block text-[12px] text-steel">{perfectLine}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                {mode === "daily" && done ? (
                  <>
                    <button className={primaryBtn} onClick={() => setFinish(true)}>
                      {t("See result")}
                    </button>
                    <button className={secondaryBtn} onClick={practiceNew}>
                      {t("Practice corners")}
                    </button>
                  </>
                ) : mode === "daily" ? (
                  <button className={primaryBtn} onClick={again}>
                    {t("Run {n} of {total}", { n: runs.length + 1, total: RUNS_PER_DAY })}
                  </button>
                ) : (
                  <>
                    <button className={primaryBtn} onClick={again}>
                      {t("Again")}
                    </button>
                    <button className={secondaryBtn} onClick={practiceNew}>
                      {t("Another corner")}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        )}

        {mode === "daily" && done && screen !== "result" && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <NextToday />
          </div>
        )}
      </div>

      <p className="mt-6 px-4 text-center text-[12px] text-steel">
        {t("Car:")}{" "}
        <a className="underline decoration-line underline-offset-4 hover:text-paint" href={CAR_CREDIT.url} target="_blank" rel="noreferrer">
          {CAR_CREDIT.title}
        </a>{" "}
        {t("by {author} ({license}), simplified and repainted. Surroundings:", { author: CAR_CREDIT.author, license: CAR_CREDIT.license })} ©{" "}
        <a className="underline decoration-line underline-offset-4 hover:text-paint" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>{" "}
        {t("contributors (ODbL). Terrain:")}{" "}
        <a className="underline decoration-line underline-offset-4 hover:text-paint" href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noreferrer">
          Terrain Tiles
        </a>{" "}
        {t("(SRTM, USGS 3DEP, Copernicus EU-DEM and others)")}
      </p>

      <AdBelow />

      {finish && done && (
        <FinishCard
          game="make-the-corner"
          eyebrow={`Make the corner #${dailyNumber()}`}
          title={t(cornerVerdict(score))}
          tone={score >= 800 ? "win" : score > 0 ? "neutral" : "loss"}
          value={`${score}`}
          valueLabel={t("of {n} points", { n: MAX_POINTS })}
          message={t("{corner}, {circuit}. Best of {n} runs.", { corner: cornerLabel(today.corner).corner, circuit: cornerLabel(today.corner).circuit, n: RUNS_PER_DAY })}
          stats={[
            [t("Played"), String(st.played)],
            [t("Average"), st.average !== null ? String(Math.round(st.average)) : "-"],
            [t("Best"), st.best !== null ? String(st.best) : "-"],
          ]}
          shareText={cornerShare(runs, shareLink("/make-the-corner", "share-make-the-corner"))}
          again={{ label: t("Practice corners"), onClick: practiceNew }}
          daily="corner"
          onClose={() => setFinish(false)}
        />
      )}
    </div>
  );
}

/** A practice corner: any corner but the one just driven, mostly dry. */
function randomCorner(not?: string): { corner: CornerEntry; condition: Condition } {
  const pool = CORNERS.filter((c) => c.id !== not);
  const r = Math.random();
  return { corner: pool[Math.floor(Math.random() * pool.length)], condition: r < 0.2 ? "wet" : r < 0.3 ? "lowdf" : "dry" };
}
