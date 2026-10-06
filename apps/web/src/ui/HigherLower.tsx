import { useEffect, useRef, useState } from "react";
import { AdBelow } from "./Ads";
import { track } from "../analytics";
import type { CircuitFacts } from "../modes/circuits";
import { type Round, firstRound, isRight, loadHigherLower, nextRound, recordRun, value } from "../modes/higherLower";
import { CircuitOutline } from "./Hub";
import { Roll } from "./Roll";
import { Down, Share, Up } from "./icons";
import { primaryBtn, secondaryBtn } from "./styles";

type Phase = "ask" | "right" | "wrong";

function Card({ c, label, shown, tone, roll }: { c: CircuitFacts; label: string; shown: string | null; tone?: "right" | "wrong"; roll?: boolean }) {
  return (
    <div className={`hl-card flex min-w-0 flex-col border bg-board/70 p-3 sm:p-5 ${tone === "right" ? "border-green" : tone === "wrong" ? "border-kerb" : "border-line"}`}>
      <CircuitOutline track={c.id} className="mx-auto aspect-square w-full max-w-[200px] text-paint/85" />
      <p className="wide mt-4 text-[17px] leading-tight text-paint [overflow-wrap:anywhere] sm:text-[22px]">{c.name}</p>
      <p className="mt-1 text-[13px] text-steel">{c.country}</p>
      <p className="caption mt-5">{label}</p>
      <p className="wide mt-1 h-[38px] text-[22px] leading-none whitespace-nowrap text-paint sm:text-[32px]">{shown === null ? <span className="text-steel/50">?</span> : roll ? <Roll text={shown} /> : <span className="num">{shown}</span>}</p>
    </div>
  );
}

/**
 * Higher or lower on real circuit facts: lap length, corners, the year of the
 * first Grand Prix, race laps, the 2025 pole lap. Get it right and the
 * revealed circuit becomes the one to beat; one wrong call ends the run.
 */
export function HigherLower({ onPlayDaily }: { onPlayDaily: () => void }) {
  const [round, setRound] = useState<Round>(() => firstRound());
  const [phase, setPhase] = useState<Phase>("ask");
  const [streak, setStreak] = useState(0);
  const [rec, setRec] = useState(loadHigherLower);
  const [newBest, setNewBest] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const call = (higher: boolean) => {
    if (phase !== "ask") return;
    if (isRight(round, higher)) {
      setPhase("right");
      setStreak((s) => s + 1);
      timer.current = window.setTimeout(() => {
        setRound((r) => nextRound(r.right, Math.random, r.stat.key));
        setPhase("ask");
      }, 1300);
    } else {
      setPhase("wrong");
      setNewBest(streak > rec.best);
      setRec(recordRun(streak));
      track("Minigame finished", { game: "higher-lower", streak });
    }
  };

  const again = () => {
    setRound(firstRound());
    setStreak(0);
    setNewBest(false);
    setPhase("ask");
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") call(true);
      else if (e.key === "ArrowDown") call(false);
      else if (e.key === "Enter" && phase === "wrong") again();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const { stat, left, right } = round;
  const share = async () => {
    const text = `Lapdle Higher or lower: ${streak} in a row on real circuit facts (best ${rec.best}). ${location.origin}/higher-lower`;
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[880px] px-4 pt-8 pb-12 md:px-8 lg:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="wide text-[clamp(30px,6vw,52px)] leading-none text-paint">Higher or lower</h1>
            <p className="mt-3 max-w-[46ch] text-[15px] text-steel">Real facts about the circuits. Call the next one right and keep going; one miss ends the run.</p>
          </div>
          <dl className="flex gap-6 text-center">
            <div>
              <dd className="wide num text-[28px] leading-none text-paint">
                <Roll text={String(streak)} />
              </dd>
              <dt className="caption mt-1">Streak</dt>
            </div>
            <div>
              <dd className="wide num text-[28px] leading-none text-steel">{Math.max(rec.best, streak)}</dd>
              <dt className="caption mt-1">Best</dt>
            </div>
          </dl>
        </div>

        <p className="mt-8 text-center text-[16px] text-paint/85" aria-live="polite">
          {phase === "ask" ? (
            stat.ask(left.name, right.name)
          ) : phase === "right" ? (
            <span className="text-green">Right.</span>
          ) : (
            <span className="text-kerb">Wrong call.</span>
          )}
        </p>

        <div key={`${left.id}-${right.id}-${stat.key}`} className="hl-deal mt-5 grid grid-cols-2 gap-3 sm:gap-5">
          <Card c={left} label={stat.label} shown={stat.format(value(left, stat.key)!)} />
          <Card c={right} label={stat.label} shown={phase === "ask" ? null : stat.format(value(right, stat.key)!)} tone={phase === "ask" ? undefined : phase} roll />
        </div>

        {phase === "wrong" ? (
          <div className="rise mt-8 flex flex-col items-center text-center">
            <p className="wide text-[24px] text-paint">{newBest ? `New best: ${streak} in a row.` : `${streak} in a row.`}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {streak > 0 && (
                <button className={secondaryBtn} onClick={share}>
                  <Share className="h-4 w-4" /> {copied ? "Copied" : "Share"}
                </button>
              )}
              <button className={secondaryBtn} onClick={again}>
                Go again
              </button>
              <button className={primaryBtn} onClick={onPlayDaily}>
                Play the Daily Quali
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5">
            <button className={`${secondaryBtn} h-14 text-[16px]`} disabled={phase !== "ask"} onClick={() => call(true)}>
              <Up /> {stat.up}
            </button>
            <button className={`${secondaryBtn} h-14 text-[16px]`} disabled={phase !== "ask"} onClick={() => call(false)}>
              <Down /> {stat.down}
            </button>
          </div>
        )}
        <p className="caption mt-6 text-center">Pole laps are the real 2025 qualifying times.<span className="hidden [@media(hover:hover)]:inline"> Arrow keys work too.</span></p>
      </div>
      <AdBelow />
    </div>
  );
}
