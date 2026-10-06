import { useEffect, useMemo, useState } from "react";
import { HowToPlay, modalOpen } from "./HowToPlay";
import { AdBelow } from "./Ads";
import { FinishCard } from "./FinishCard";
import { NextToday } from "./NextToday";
import { gameFinished, gameStarted } from "../games/events";
import POINTS from "../game/speedtrap.json";
import { OUTLINES } from "../game/outlines";
import { circuit } from "../modes/circuits";
import { dailyNumber } from "../modes/daily";
import {
  KIND_LABEL,
  MAX_KMH,
  MIN_KMH,
  ROUNDS,
  type TrapGrade,
  type TrapPoint,
  type TrapRound,
  dailyTraps,
  recordRound,
  roundPoints,
  trapDone,
  trapGrade,
  trapRounds,
  trapScore,
  trapShare,
  trapStats,
  trapVerdict,
} from "../modes/speedtrap";
import { primaryBtn, secondaryBtn } from "./styles";

const points = POINTS as TrapPoint[];
const GRADE_BG: Record<TrapGrade, string> = { purple: "bg-purple", green: "bg-green", yellow: "bg-yellow", red: "bg-kerb" };
const GRADE_TEXT: Record<TrapGrade, string> = { purple: "text-purple", green: "text-green", yellow: "text-yellow", red: "text-kerb" };
const clamp = (v: number) => Math.max(MIN_KMH, Math.min(MAX_KMH, Math.round(v)));

/** The circuit with the speed trap's spot lit and an arrow for the way the car is going. */
function TrapMap({ p }: { p: TrapPoint }) {
  const o = OUTLINES[p.track];
  return (
    <svg viewBox="0 0 1000 1000" className="aspect-square w-full" role="img" aria-label={`${circuit(p.track).name} from above, with the speed trap marked`}>
      <path d={o.outline} fill="none" stroke="#2b2f37" strokeWidth={44} strokeLinejoin="round" />
      <path d={o.outline} fill="none" stroke="#9aa1ab" strokeWidth={14} strokeLinejoin="round" />
      <g transform={`translate(${p.map[0]} ${p.map[1]})`}>
        <circle r={70} fill="rgba(255,106,19,0.18)" className="trap-pulse" />
        <g transform={`rotate(${p.heading})`}>
          <path d="M38 0 L 100 0 M78 -22 L 102 0 L 78 22" fill="none" stroke="#ff6a13" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <circle r={30} fill="#ff6a13" stroke="#0a0b0d" strokeWidth={10} />
      </g>
    </svg>
  );
}

/** A speedometer: the dial from MIN to MAX km/h, the real speed's needle and yours. */
function Gauge({ actual, guess }: { actual: number; guess: number }) {
  const SWEEP = 240;
  const angle = (v: number) => -120 + ((v - MIN_KMH) / (MAX_KMH - MIN_KMH)) * SWEEP; // degrees from straight up
  const at = (deg: number, r: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [100 + r * Math.cos(a), 100 + r * Math.sin(a)] as const;
  };
  const arc = (from: number, to: number, r: number) => {
    const [x0, y0] = at(from, r);
    const [x1, y1] = at(to, r);
    return `M${x0} ${y0} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const ticks = [];
  for (let v = 40; v <= MAX_KMH; v += 40) ticks.push(v);
  const needle = (v: number, color: string, w: number, len: number) => {
    const [x, y] = at(angle(v), len);
    return <line x1={100} y1={100} x2={x} y2={y} stroke={color} strokeWidth={w} strokeLinecap="round" />;
  };
  return (
    <svg viewBox="0 0 200 172" className="mx-auto w-full max-w-[210px] md:max-w-[300px]" role="img" aria-label={`Real speed ${actual} km/h, your guess ${guess} km/h`}>
      <path d={arc(-120, 120, 86)} fill="none" stroke="#2b2f37" strokeWidth={10} strokeLinecap="round" />
      {/* the gap between the guess and the real speed */}
      <path d={arc(Math.min(angle(actual), angle(guess)), Math.max(angle(actual), angle(guess)) + 0.01, 86)} fill="none" stroke="#ff6a13" strokeOpacity={0.45} strokeWidth={10} />
      {ticks.map((v) => {
        const [x0, y0] = at(angle(v), 74);
        const [x1, y1] = at(angle(v), 80);
        const [tx, ty] = at(angle(v), 62);
        return (
          <g key={v}>
            <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#9aa1ab" strokeWidth={1.5} />
            <text x={tx} y={ty + 3} textAnchor="middle" fontSize={8.5} fill="#9aa1ab" className="num">
              {v}
            </text>
          </g>
        );
      })}
      {/* both needles sweep up from the bottom of the dial: yours, then the real one */}
      <g className="gauge-needle" style={{ transformOrigin: "100px 100px", "--from": `${-(angle(guess) + 120)}deg` } as React.CSSProperties}>
        {needle(guess, "#ff6a13", 3, 70)}
      </g>
      <g className="gauge-needle gauge-needle-late" style={{ transformOrigin: "100px 100px", "--from": `${-(angle(actual) + 120)}deg` } as React.CSSProperties}>
        {needle(actual, "#f2f2ee", 4, 78)}
      </g>
      <circle cx={100} cy={100} r={7} fill="#f2f2ee" stroke="#0a0b0d" strokeWidth={2} />
      <text x={100} y={146} textAnchor="middle" className="wide num" fontSize={30} fill="#f2f2ee">
        {actual}
      </text>
      <text x={100} y={162} textAnchor="middle" fontSize={9} fill="#9aa1ab">
        km/h on the perfect lap
      </text>
    </svg>
  );
}

/**
 * Speed trap: five spots on five real circuits, the same for everyone each
 * day. Set the speed you think the car does there on the perfect lap, lock it
 * in, and the speedometer shows how close you were.
 */
export function SpeedTrap() {
  const today = useMemo(() => dailyTraps(points), []);
  const [rounds, setRounds] = useState<TrapRound[]>(() => trapRounds());
  const done = trapDone(rounds);
  // the round on screen: the next to play, or the one whose answer is showing
  const [revealed, setRevealed] = useState(false);
  const index = Math.min(revealed ? rounds.length - 1 : rounds.length, ROUNDS - 1);
  const p = points[today[index]];
  const [guess, setGuess] = useState(180);
  const [finish, setFinish] = useState(false);

  const lock = () => {
    if (done || revealed || modalOpen()) return;
    gameStarted("speed-trap", "daily");
    const next = recordRound(guess, p.kmh);
    setRounds(next);
    setRevealed(true);
    if (trapDone(next)) {
      gameFinished("speed-trap", "daily", { score: band(trapScore(next)) });
      window.setTimeout(() => setFinish(true), 1600);
    }
  };
  const next = () => {
    setRevealed(false);
    setGuess(180);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (finish || modalOpen()) return;
      if (e.target instanceof HTMLInputElement && e.target.type === "range" && e.key.startsWith("Arrow")) return; // the slider moves itself
      if (e.key === "Enter") revealed && !done ? next() : lock();
      else if (!revealed && (e.key === "ArrowUp" || e.key === "ArrowRight")) setGuess((g) => clamp(g + (e.shiftKey ? 10 : 1)));
      else if (!revealed && (e.key === "ArrowDown" || e.key === "ArrowLeft")) setGuess((g) => clamp(g - (e.shiftKey ? 10 : 1)));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const score = trapScore(rounds);
  const st = trapStats();
  const last = revealed || done ? rounds[index] : null;
  const c = circuit(p.track);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-4 pt-4 pb-12 md:px-8 md:pt-6 lg:pt-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="wide text-[clamp(26px,6vw,52px)] leading-none text-paint">Speed trap</h1>
              <HowToPlay game="speed-trap" />
            </div>
            <p className="mt-1.5 text-[14px] text-steel md:mt-2 md:text-[15px]">
              How fast is the car at the dot?<span className="hidden md:inline"> Five spots on five circuits, on the perfect lap.</span>
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className="wide num block text-[22px] leading-none text-paint md:text-[26px]">
              {score}
              <span className="text-steel">/{ROUNDS * 100}</span>
            </span>
            <span className="caption mt-1 block">Round {Math.min(index + 1, ROUNDS)}/{ROUNDS}</span>
          </p>
        </div>

        <ol className="mt-3 flex gap-1" aria-label={`${rounds.length} of ${ROUNDS} rounds played`}>
          {Array.from({ length: ROUNDS }, (_, i) => (
            <li key={i} className={`h-2 flex-1 ${i < rounds.length ? GRADE_BG[trapGrade(rounds[i].guess, rounds[i].actual)] : i === rounds.length ? "bg-paint/40" : "bg-asphalt"}`} />
          ))}
        </ol>

        <div className="mt-4 grid items-start gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-8">
          <figure className={`mx-auto w-full border border-line bg-board/70 p-2 transition-[max-width] md:max-w-none md:p-3 ${last ? "max-w-[160px]" : "max-w-[250px]"}`}>
            <TrapMap p={p} />
            <figcaption className="mt-1 flex items-center justify-between gap-2 text-[13px]">
              <span className="wide truncate text-paint">{c.name}</span>
              <span className="shrink-0">{c.flag}</span>
            </figcaption>
          </figure>

          <div>
            <p className="caption">{KIND_LABEL[p.kind]}</p>
            {!last ? (
              <>
                <p className="mt-2 text-center">
                  <span className="wide num text-[clamp(56px,14vw,84px)] leading-none text-paint">{guess}</span>
                  <span className="ml-2 text-[16px] text-steel">km/h</span>
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button className={`${secondaryBtn} h-11 w-11 shrink-0 px-0 text-[20px]`} aria-label="1 km/h slower" onClick={() => setGuess((g) => clamp(g - 1))}>
                    −
                  </button>
                  <input
                    type="range"
                    min={MIN_KMH}
                    max={MAX_KMH}
                    step={1}
                    value={guess}
                    onChange={(e) => setGuess(clamp(Number(e.target.value)))}
                    aria-label="Your guess, km/h"
                    className="trap-range h-11 min-w-0 flex-1"
                  />
                  <button className={`${secondaryBtn} h-11 w-11 shrink-0 px-0 text-[20px]`} aria-label="1 km/h faster" onClick={() => setGuess((g) => clamp(g + 1))}>
                    +
                  </button>
                </div>
                <div className="mt-1 flex justify-between px-14 text-[12px] text-steel">
                  <span>{MIN_KMH}</span>
                  <span>{MAX_KMH}</span>
                </div>
                <button className={`${primaryBtn} mt-4 w-full`} onClick={lock}>
                  Lock it in
                </button>
              </>
            ) : (
              <div className="rise mt-2">
                <Gauge actual={last.actual} guess={last.guess} />
                <div className="mt-2 flex items-baseline justify-between gap-4">
                  <p className={`wide text-[22px] leading-tight ${GRADE_TEXT[trapGrade(last.guess, last.actual)]}`}>
                    {last.guess === last.actual ? "Spot on" : `${Math.abs(last.guess - last.actual)} km/h ${last.guess > last.actual ? "over" : "under"}`}
                  </p>
                  <p className="wide num text-[20px] text-paint">
                    +{roundPoints(last.guess, last.actual)} <span className="text-[13px] text-steel">pts</span>
                  </p>
                </div>
                <p className="mt-1 text-[14px] text-steel">You said {last.guess} km/h.</p>
                {done ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className={primaryBtn} onClick={() => setFinish(true)}>
                      See result
                    </button>
                    <NextToday />
                  </div>
                ) : (
                  <button className={`${primaryBtn} mt-4 w-full`} onClick={next}>
                    Round {rounds.length + 1} of {ROUNDS}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AdBelow />

      {finish && done && (
        <FinishCard
          game="speed-trap"
          eyebrow={`Speed trap #${dailyNumber()}`}
          title={trapVerdict(score)}
          tone={score >= 350 ? "win" : score >= 220 ? "neutral" : "loss"}
          value={String(score)}
          valueLabel={`of ${ROUNDS * 100} points`}
          message={rounds.map((r) => `${Math.abs(r.guess - r.actual)} km/h off`).join(", ")}
          stats={[
            ["Played", String(st.played)],
            ["Average", st.average !== null ? String(Math.round(st.average)) : "-"],
            ["Best", st.best !== null ? String(st.best) : "-"],
          ]}
          shareText={trapShare(rounds, `${location.origin}/speed-trap`)}
          daily="set of speed traps"
          onClose={() => setFinish(false)}
        />
      )}
    </div>
  );
}

const band = (s: number) => (s >= 400 ? "400-500" : s >= 300 ? "300-399" : s >= 200 ? "200-299" : s >= 100 ? "100-199" : "0-99");
