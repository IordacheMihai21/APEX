import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { soundEnabled } from "../game/audio";
import { FRONT_AXLE, REAR_AXLE, TRACK_HALF, bareCar } from "../game/car";
import { asphaltDataUrl } from "../game/scenery";
import { dailyNumber, dateKey } from "../modes/daily";
import {
  type PitPlan,
  type PitResult,
  type StepGrade,
  WHEEL_NAME,
  type Wheel,
  dailyPlan,
  gradeStep,
  loadPitStop,
  makePlan,
  penaltyMs,
  pitShare,
  recordStop,
  secs,
  todaysStop,
  verdict,
} from "../modes/pitstop";
import { Segments } from "./Segments";
import { Share } from "./icons";
import { primaryBtn, secondaryBtn } from "./styles";

type Phase = "idle" | "entering" | "service" | "hold" | "green" | "leaving" | "done";
type Mode = "daily" | "practice";

/* The pit box in metres: 8 wide, 11 deep, car centred at (4, 5.8), nose up. */
const BOX_W = 8;
const BOX_H = 11;
const CAR_X = 4;
const CAR_Y = 5.8;
const pctX = (m: number) => `${(m / BOX_W) * 100}%`;
const pctY = (m: number) => `${(m / BOX_H) * 100}%`;

const WHEEL_AT: Record<Wheel, { x: number; y: number; side: -1 | 1; front: boolean }> = {
  fl: { x: -TRACK_HALF, y: -FRONT_AXLE, side: -1, front: true },
  fr: { x: TRACK_HALF, y: -FRONT_AXLE, side: 1, front: true },
  rl: { x: -TRACK_HALF, y: -REAR_AXLE, side: -1, front: false },
  rr: { x: TRACK_HALF, y: -REAR_AXLE, side: 1, front: false },
};

const GRADE_BG: Record<StepGrade, string> = { purple: "bg-purple", green: "bg-green", yellow: "bg-yellow", red: "bg-kerb" };
const GRADE_TEXT: Record<StepGrade, string> = { purple: "text-purple", green: "text-green", yellow: "text-yellow", red: "text-kerb" };

/* Sound (only with sound on): a wheel gun's rattle, the green-light pip, a wrong-key buzz. */
let audio: AudioContext | null = null;
function ac(): AudioContext | null {
  if (!soundEnabled()) return null;
  try {
    audio ??= new AudioContext();
    return audio;
  } catch {
    return null;
  }
}
function gun() {
  const a = ac();
  if (!a) return;
  const len = 0.16;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / a.sampleRate;
    // noise chopped at ~45 Hz: the impact gun's ratchet
    d[i] = (Math.random() * 2 - 1) * (Math.sin(t * 2 * Math.PI * 45) > 0 ? 1 : 0.15) * (1 - t / len);
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 2400;
  f.Q.value = 0.8;
  const g = a.createGain();
  g.gain.value = 0.35;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}
function tone(freq: number, ms: number, gain = 0.1) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + ms / 1000);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + ms / 1000);
}
const buzz = (ms: number | number[]) => navigator.vibrate?.(ms);

/** The car without wheels, drawn once from the game's own sprite code. */
function CarBody() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const { canvas } = bareCar(120);
    canvas.className = "h-full w-full";
    canvas.setAttribute("aria-hidden", "true");
    host.replaceChildren(canvas);
  }, []);
  return <div ref={ref} className="pit-body absolute inset-0" />;
}

/** The clock: runs from the car stopping to the release, plus penalties so far. */
function Clock({ phase, t0, endMs, penalty, compact = false }: { phase: Phase; t0: number; endMs: number | null; penalty: number; compact?: boolean }) {
  const [now, setNow] = useState(0);
  const running = phase === "service" || phase === "hold" || phase === "green";
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  const ms = endMs ?? (running ? Math.max(0, now - t0) + penalty : 0);
  return (
    <div className={phase === "done" ? "text-paint" : running ? "text-paint" : "text-steel/50"} aria-live="off">
      <Segments text={secs(ms)} className={compact ? "h-6" : "h-14 lg:h-20"} ghost={0.12} />
    </div>
  );
}

/**
 * Pit stop. The car comes in and stops on its marks; the wheels light one at
 * a time in a random order, each showing its key (tap the wheel on a phone).
 * After the fourth, wait for the release light: go on green.
 */
export function PitStop({ onPlayDaily }: { onPlayDaily: () => void }) {
  const [rec, setRec] = useState(loadPitStop);
  const [mode, setMode] = useState<Mode>(() => (todaysStop(loadPitStop()) ? "practice" : "daily"));
  const [plan, setPlan] = useState<PitPlan>(() => (todaysStop(loadPitStop()) ? makePlan() : dailyPlan()));
  const [phase, setPhase] = useState<Phase>("idle");
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState(0);
  const [splits, setSplits] = useState<number[]>([]);
  const [wrong, setWrong] = useState(0);
  const [early, setEarly] = useState(false);
  const [flash, setFlash] = useState<Wheel | null>(null);
  const [result, setResult] = useState<PitResult | null>(null);
  const [copied, setCopied] = useState(false);
  const t0 = useRef(0);
  const lastT = useRef(0);
  const greenAt = useRef(0);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const clear = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clear, []);

  // the same asphalt the circuits are drawn with
  const asphalt = useMemo(() => `url(${asphaltDataUrl()})`, []);
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dailyDone = todaysStop(rec);
  const shown: PitResult | null = result ?? (mode === "daily" ? dailyDone : null);
  const locked = mode === "daily" && !!dailyDone;

  const switchMode = (m: Mode) => {
    if (phase !== "idle" && phase !== "done") return;
    clear();
    setMode(m);
    setPlan(m === "daily" ? dailyPlan() : makePlan());
    setResult(null);
    setSplits([]);
    setWrong(0);
    setEarly(false);
    setPhase("idle");
  };

  const start = useCallback(() => {
    if (locked) return;
    clear();
    const p = mode === "daily" ? dailyPlan() : result ? makePlan() : plan;
    setPlan(p);
    setAttempt((a) => a + 1);
    setStep(0);
    setSplits([]);
    setWrong(0);
    setEarly(false);
    setResult(null);
    setPhase("idle");
    // mount the car below the box, then let it roll in and settle on its marks
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setPhase("entering");
        later(
          () => {
            t0.current = lastT.current = performance.now();
            setPhase("service");
          },
          reduce ? 120 : 950,
        );
      }),
    );
  }, [locked, mode, plan, result, reduce]);

  const hit = useCallback(
    (by: { key?: string; wheel?: Wheel }) => {
      if (phase !== "service") return;
      const want = plan.order[step];
      const right = by.key ? by.key === plan.keys[step] : by.wheel === want;
      const now = performance.now();
      if (!right) {
        setWrong((w) => w + 1);
        setFlash(want);
        later(() => setFlash(null), 260);
        tone(140, 180, 0.12);
        buzz([30, 40, 30]);
        return;
      }
      setSplits((s) => [...s, now - lastT.current]);
      lastT.current = now;
      gun();
      buzz(12);
      if (step === 3) {
        setPhase("hold");
        later(() => {
          greenAt.current = performance.now();
          setPhase("green");
          tone(880, 140);
        }, plan.greenDelayMs);
      } else setStep(step + 1);
    },
    [phase, plan, step],
  );

  const release = useCallback(() => {
    if (phase === "hold") {
      if (!early) {
        setEarly(true);
        tone(140, 220, 0.12);
        buzz([40, 30, 40]);
      }
      return;
    }
    if (phase !== "green") return;
    const now = performance.now();
    const all = [...splits, now - greenAt.current];
    const r: PitResult = { totalMs: Math.round(now - t0.current + penaltyMs({ wrongKeys: wrong, earlyRelease: early })), splits: all.map(Math.round), wrongKeys: wrong, earlyRelease: early };
    setSplits(all);
    setResult(r);
    setRec((x) => recordStop(x, r, mode === "daily" ? dateKey() : null));
    setPhase("leaving");
    later(() => setPhase("done"), reduce ? 50 : 700);
  }, [phase, early, splits, wrong, mode, reduce]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (key === " " || key === "Enter") {
        e.preventDefault();
        if (phase === "idle" || phase === "done") start();
        else release();
      } else if (phase === "service" && /^[A-Z]$/.test(key)) hit({ key }); // any letter: a wrong one costs time
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [phase, start, release, hit]);

  const share = async () => {
    if (!shown) return;
    const text = mode === "daily" ? pitShare(shown, `${location.origin}/pit-stop`) : `APEX Pit stop: ${secs(shown.totalMs)} s. Beat it: ${location.origin}/pit-stop`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  const penalty = penaltyMs({ wrongKeys: wrong, earlyRelease: early });
  const active = phase === "service" ? plan.order[step] : null;
  const doneWheels = new Set(plan.order.slice(0, phase === "service" ? step : phase === "idle" || phase === "entering" ? 0 : 4));
  // a wheel's name appears only once it lights, so the order isn't given away
  const reached = phase === "service" ? step + 1 : phase === "idle" || phase === "entering" ? (locked ? 4 : 0) : 4;
  const rows = [...plan.order.map((w, i) => (i < reached ? WHEEL_NAME[w] : "Wheel")), "Release"];
  const rowSplits = shown && phase !== "service" && phase !== "hold" && phase !== "green" ? shown.splits : splits;
  const avg = rec.recent.length ? rec.recent.reduce((a, b) => a + b, 0) / rec.recent.length : null;
  const carState = phase === "idle" ? "below" : phase === "leaving" || phase === "done" ? "gone" : "in";

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-[1120px] gap-x-12 gap-y-5 px-4 pt-5 pb-12 md:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-[auto_1fr] lg:pt-12">
        <header className="lg:col-start-1 lg:row-start-1">
          <div role="radiogroup" aria-label="Mode" className="inline-flex border border-line">
            {(["daily", "practice"] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={mode === m}
                onClick={() => switchMode(m)}
                className={`px-4 py-2 text-[13px] font-semibold transition-colors ${mode === m ? "bg-paint text-night" : "text-steel hover:text-paint"}`}
              >
                {m === "daily" ? `Daily #${dailyNumber()}` : "Practice"}
              </button>
            ))}
          </div>
          <h1 className="wide mt-4 text-[clamp(32px,6vw,56px)] leading-none text-paint lg:mt-5">Pit stop</h1>
          <p className="mt-2.5 max-w-[44ch] text-[14px] text-steel lg:mt-3 lg:text-[15px]">
            Each wheel lights up in turn: hit its key, or tap it on a phone. Then release the car on green. The fastest stop on record is 1.80 s.
          </p>
        </header>

        {/* timing side */}
        <div className="order-last flex flex-col lg:order-none lg:col-start-1 lg:row-start-2">

          <div className="flex items-end justify-between gap-4 border-t border-line pt-5 lg:mt-1">
            <Clock phase={phase} t0={t0.current} endMs={phase === "leaving" || phase === "done" || locked ? (shown?.totalMs ?? null) : null} penalty={penalty} />
            {(penalty > 0 || (shown && penaltyMs(shown) > 0)) && (
              <span className="pb-1 text-right text-[13px] font-semibold text-kerb">
                +{((shown && phase !== "service" && phase !== "hold" && phase !== "green" ? penaltyMs(shown) : penalty) / 1000).toFixed(1)} s
                <span className="block font-normal text-steel">penalty</span>
              </span>
            )}
          </div>

          {/* the stop as a timing tower: one row per wheel in the order they lit, then the release */}
          <ol className="mt-5" aria-label="Splits">
            {rows.map((label, i) => {
              const ms = rowSplits[i];
              const grade = ms !== undefined ? gradeStep(i, ms) : null;
              const live = phase === "service" && i === step;
              return (
                <li key={`${label}-${i}`} className={`grid grid-cols-[4px_1fr_auto] items-center gap-3 py-1.5 ${live ? "bg-graphite/60" : ""}`}>
                  <span className={`h-5 w-1 ${grade ? GRADE_BG[grade] : "bg-asphalt"}`} />
                  <span className={`text-[14px] ${ms !== undefined || live ? "text-paint" : "text-steel"}`}>{label}</span>
                  <span className={`num text-[15px] font-semibold ${grade ? GRADE_TEXT[grade] : "text-steel/50"}`}>{ms !== undefined ? secs(ms) : "-.---"}</span>
                </li>
              );
            })}
          </ol>

          {phase === "done" || locked ? (
            shown && (
              <div className="rise mt-6 border-t border-line pt-5">
                <p className="wide text-[22px] leading-tight text-paint">{verdict(shown.totalMs)}</p>
                {locked && <p className="mt-2 text-[14px] text-steel">That was today's daily stop. Practice as much as you like.</p>}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button className={secondaryBtn} onClick={share}>
                    <Share className="h-4 w-4" /> {copied ? "Copied" : "Share"}
                  </button>
                  {locked ? (
                    <button className={primaryBtn} onClick={() => switchMode("practice")}>
                      Practice stops
                    </button>
                  ) : (
                    <button className={primaryBtn} onClick={() => (mode === "daily" ? switchMode("practice") : start())}>
                      {mode === "daily" ? "Practice stops" : "Go again"}
                    </button>
                  )}
                  <button className={secondaryBtn} onClick={onPlayDaily}>
                    Daily Quali
                  </button>
                </div>
              </div>
            )
          ) : null}

          <dl className="mt-auto grid grid-cols-3 gap-4 pt-8 text-center">
            {[
              ["Best", rec.best !== null ? secs(rec.best) : "-"],
              ["Last 5 average", avg !== null ? secs(avg) : "-"],
              ["Stops", String(rec.stops)],
            ].map(([k, v]) => (
              <div key={k}>
                <dd className="wide num text-[20px] text-paint">{v}</dd>
                <dt className="caption mt-1">{k}</dt>
              </div>
            ))}
          </dl>
        </div>

        {/* the pit box */}
        <div
          style={{ backgroundImage: asphalt }}
          className={`pit-stage relative mx-auto aspect-[8/11] w-full max-w-[460px] touch-manipulation overflow-hidden border border-line select-none lg:col-start-2 lg:row-span-2 lg:row-start-1 ${flash ? "pit-shake" : ""}`}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            if (phase === "idle" || phase === "done") start();
            else if (phase === "hold" || phase === "green") release();
          }}
        >
          {/* painted floor: garage apron on the left, the box in yellow, the fast lane on the right */}
          <svg viewBox="0 0 800 1100" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <rect x="0" y="0" width="120" height="1100" fill="#3a3d43" />
            <rect x="0" y="0" width="120" height="1100" fill="url(#apron)" />
            <defs>
              <pattern id="apron" width="120" height="110" patternUnits="userSpaceOnUse">
                <rect width="120" height="2" fill="#2c2f34" />
              </pattern>
            </defs>
            <line x1="120" y1="0" x2="120" y2="1100" stroke="#f2f2ee" strokeWidth="6" />
            <line x1="690" y1="0" x2="690" y2="1100" stroke="#f2f2ee" strokeWidth="5" strokeDasharray="60 50" opacity="0.8" />
            <rect x="205" y="160" width="390" height="830" fill="none" stroke="#f5c518" strokeWidth="8" />
            {/* wheel marks: an L at each corner where the tyres stop */}
            {(Object.keys(WHEEL_AT) as Wheel[]).map((w) => {
              const p = WHEEL_AT[w];
              const x = (CAR_X + p.x + p.side * 0.42) * 100;
              const y = (CAR_Y + p.y) * 100;
              return <path key={w} d={`M${x} ${y - 45} L${x} ${y + 45}`} stroke="#f2f2ee" strokeWidth="6" opacity="0.85" />;
            })}
            {/* the stop line the front wing parks on */}
            <rect x="330" y="282" width="140" height="10" fill="#f2f2ee" opacity="0.9" />
          </svg>

          {/* on phones the timing column is below the box, so a small clock rides in it */}
          <div className="pointer-events-none absolute top-[2.5%] left-[3%] bg-night/80 px-2 py-1.5 lg:hidden">
            <Clock phase={phase} t0={t0.current} endMs={phase === "leaving" || phase === "done" || locked ? (shown?.totalMs ?? null) : null} penalty={penalty} compact />
          </div>

          {/* release light, above the box */}
          <div className="absolute top-[3%] left-1/2 flex -translate-x-1/2 items-center gap-2 border border-line bg-[#060607] px-2.5 py-1.5 shadow-[0_6px_14px_rgba(0,0,0,0.5)]" aria-hidden="true">
            <span className={`pit-lamp h-4 w-4 rounded-full ${phase === "hold" || phase === "service" || phase === "entering" ? "pit-lamp-red" : ""}`} />
            <span className={`pit-lamp h-4 w-4 rounded-full ${phase === "green" || phase === "leaving" ? "pit-lamp-green" : ""}`} />
          </div>

          {/* the crew: one at each wheel, waiting on its mark; the active one shows its key */}
          {(Object.keys(WHEEL_AT) as Wheel[]).map((w) => {
            const p = WHEEL_AT[w];
            const x = CAR_X + p.x + p.side * 1.2;
            const y = CAR_Y + p.y;
            const on = active === w;
            return (
              <div key={w} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pctX(x), top: pctY(y) }}>
                <span className={`pit-crew block ${on ? "pit-crew-on" : ""} ${doneWheels.has(w) ? "pit-crew-done" : ""}`} />
                {on && (
                  <span className={`pit-key wide absolute top-1/2 -translate-y-1/2 ${p.side < 0 ? "right-[calc(100%+8px)]" : "left-[calc(100%+8px)]"}`}>
                    <span className="max-[767px]:hidden">{plan.keys[step]}</span>
                    <span className="md:hidden">Tap</span>
                  </span>
                )}
              </div>
            );
          })}

          {/* the spare beside each wheel: a fresh tyre waiting, then the worn one, left on the ground */}
          {(Object.keys(WHEEL_AT) as Wheel[]).map((w) => {
            const p = WHEEL_AT[w];
            const done = doneWheels.has(w);
            const tw = p.front ? 0.34 : 0.42;
            const tl = p.front ? 0.66 : 0.74;
            return (
              <span
                key={`spare-${w}`}
                aria-hidden="true"
                className={`pit-spare absolute -translate-x-1/2 -translate-y-1/2 ${done ? `pit-tyre-old ${p.side < 0 ? "pit-dropped-l" : "pit-dropped-r"}` : `pit-tyre-new ${p.side < 0 ? "pit-band-l" : "pit-band-r"}`}`}
                style={{ left: pctX(CAR_X + p.x + p.side * 0.62), top: pctY(CAR_Y + p.y), width: pctX(tw), height: pctY(tl) }}
              />
            );
          })}

          {/* the car: rolls in, sits on its marks, leaves on release */}
          <div
            key={attempt}
            className={`pit-car absolute -translate-x-1/2 -translate-y-1/2 pit-car-${carState}`}
            style={{ left: pctX(CAR_X), top: pctY(CAR_Y), width: pctX(3), height: pctY(6.6) }}
          >
            {(Object.keys(WHEEL_AT) as Wheel[]).map((w) => {
              const p = WHEEL_AT[w];
              const done = doneWheels.has(w);
              const on = active === w;
              const tw = p.front ? 0.34 : 0.42;
              const tl = p.front ? 0.66 : 0.74;
              return (
                <button
                  key={w}
                  aria-label={`${WHEEL_NAME[w]} wheel${on ? `, now: press ${plan.keys[step]}` : ""}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    hit({ wheel: w });
                  }}
                  disabled={phase !== "service"}
                  className={`pit-wheel absolute -translate-x-1/2 -translate-y-1/2 ${on ? "pit-wheel-on" : ""} ${flash === w ? "pit-wheel-flash" : ""}`}
                  style={{ left: `${((1.5 + p.x) / 3) * 100}%`, top: `${((3.3 + p.y) / 6.6) * 100}%`, width: `${(tw / 3) * 100}%`, height: `${(tl / 6.6) * 100}%` }}
                >
                  {/* always a tyre on the hub: the worn one until the gun's done, then the fresh one seats */}
                  <span
                    key={done ? "fresh" : "worn"}
                    className={`pit-tyre ${done ? `pit-tyre-new ${p.side < 0 ? "pit-band-l pit-mount-l" : "pit-band-r pit-mount-r"}` : "pit-tyre-old"}`}
                  />
                </button>
              );
            })}
            <CarBody />
          </div>

          {/* what to do now */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3" aria-live="polite">
            {phase === "idle" && !locked && <span className="pit-prompt">{mode === "daily" ? "Today's stop. One attempt counts." : "Ready."} Press Space or tap to call the car in.</span>}
            {phase === "hold" && <span className={`pit-prompt ${early ? "text-kerb" : ""}`}>{early ? "Early release: +1.0 s. Wait for green." : "Wait for green."}</span>}
            {phase === "done" && mode === "practice" && <span className="pit-prompt">Space or tap for another stop.</span>}
          </div>
          {(phase === "hold" || phase === "green") && (
            <button
              className={`pit-go wide absolute inset-x-[18%] bottom-[9%] py-3 text-[18px] uppercase ${phase === "green" ? "pit-go-green" : ""}`}
              onPointerDown={(e) => {
                e.preventDefault();
                release();
              }}
            >
              {phase === "green" ? "Go" : "Hold"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

