import { useEffect, useMemo, useRef, useState } from "react";
import { HowToPlay, modalOpen } from "./HowToPlay";
import { AdBelow } from "./Ads";
import { FinishCard } from "./FinishCard";
import { gameFinished, gameStarted } from "../games/events";
import type { CircuitFacts } from "../modes/circuits";
import {
  DAILY_CALLS,
  type Round,
  dailyCalls,
  dailyDone,
  dailyRounds,
  dailyScore,
  dailyShare,
  dailyStats,
  firstRound,
  isRight,
  loadHigherLower,
  nextRound,
  recordDailyCall,
  recordRun,
  value,
} from "../modes/higherLower";
import { dailyNumber } from "../modes/daily";
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
function Endless({ onPlayDaily, modeSwitch }: { onPlayDaily: () => void; modeSwitch: React.ReactNode }) {
  const [round, setRound] = useState<Round>(() => firstRound());
  const [phase, setPhase] = useState<Phase>("ask");
  const [streak, setStreak] = useState(0);
  const [rec, setRec] = useState(loadHigherLower);
  const [newBest, setNewBest] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  const [finish, setFinish] = useState(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  const call = (higher: boolean) => {
    if (phase !== "ask") return;
    gameStarted("higher-lower", "endless");
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
      gameFinished("higher-lower", "endless", { streak });
      // the card follows once the right answer has been on screen for a moment
      timer.current = window.setTimeout(() => setFinish(true), 1400);
    }
  };

  const again = () => {
    clearTimeout(timer.current);
    setFinish(false);
    setRound(firstRound());
    setStreak(0);
    setNewBest(false);
    setPhase("ask");
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (modalOpen()) return; // a how-to or finish card has the keys
      if (e.key === "ArrowUp") call(true);
      else if (e.key === "ArrowDown") call(false);
      else if (e.key === "Enter" && phase === "wrong" && !finish) again();
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
        {modeSwitch}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="wide text-[clamp(30px,6vw,52px)] leading-none text-paint">Higher or lower</h1>
              <HowToPlay game="higher-lower" />
            </div>
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
      {finish && phase === "wrong" && (
        <FinishCard
          game="higher-lower"
          eyebrow="Higher or lower"
          title={newBest ? "New best run!" : "Run over"}
          tone={newBest ? "win" : "loss"}
          value={String(streak)}
          valueLabel={streak === 1 ? "right call" : "right calls in a row"}
          message={newBest ? "Your longest run yet." : streak === 0 ? "Missed the first one. The next run starts fresh." : `Your best run is ${rec.best}.`}
          stats={[
            ["This run", String(streak)],
            ["Best", String(rec.best)],
            ["Runs", String(rec.runs)],
          ]}
          shareText={`Lapdle Higher or lower: ${streak} in a row on real circuit facts (best ${rec.best}). ${location.origin}/higher-lower`}
          again={{ label: "Play again", onClick: again }}
          onClose={() => setFinish(false)}
        />
      )}
      <AdBelow />
    </div>
  );
}

type Mode = "daily" | "endless";

/**
 * Higher or lower comes in two modes: the daily ten (the same calls for
 * everyone, scored out of ten, part of today's set) and the endless run.
 * It opens on the daily until today's ten are done.
 */
export function HigherLower({ onPlayDaily }: { onPlayDaily: () => void }) {
  const [mode, setMode] = useState<Mode>(() => (dailyDone(dailyCalls()) ? "endless" : "daily"));
  const modeSwitch = (
    <div role="radiogroup" aria-label="Mode" className="inline-flex border border-line">
      {(["daily", "endless"] as const).map((m) => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          onClick={() => setMode(m)}
          className={`px-4 py-2 text-[13px] font-semibold transition-colors ${mode === m ? "bg-paint text-night" : "text-steel hover:text-paint"}`}
        >
          {m === "daily" ? `Daily #${dailyNumber()}` : "Endless"}
        </button>
      ))}
    </div>
  );
  return mode === "daily" ? (
    <Daily key="daily" modeSwitch={modeSwitch} onEndless={() => setMode("endless")} />
  ) : (
    <Endless key="endless" onPlayDaily={onPlayDaily} modeSwitch={modeSwitch} />
  );
}

const verdict = (score: number) => (score === DAILY_CALLS ? "Perfect ten!" : score >= 8 ? "Sharp calls" : score >= 5 ? "Solid day" : "Tough set");

/** Today's ten: every call is played, a miss costs a point. */
function Daily({ modeSwitch, onEndless }: { modeSwitch: React.ReactNode; onEndless: () => void }) {
  const rounds = useMemo(() => dailyRounds(), []);
  const [calls, setCalls] = useState<boolean[]>(() => dailyCalls());
  const [phase, setPhase] = useState<Phase>("ask");
  const [finish, setFinish] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const done = dailyDone(calls);
  // while a call is being revealed, keep showing that round
  const shownIndex = phase === "ask" ? Math.min(calls.length, DAILY_CALLS - 1) : calls.length - 1;
  const round = rounds[shownIndex];
  const score = dailyScore(calls);

  const call = (higher: boolean) => {
    if (phase !== "ask" || done || modalOpen()) return;
    gameStarted("higher-lower", "daily");
    const right = isRight(round, higher);
    const next = recordDailyCall(right);
    setCalls(next);
    setPhase(right ? "right" : "wrong");
    timer.current = window.setTimeout(() => {
      setPhase("ask");
      if (dailyDone(next)) {
        gameFinished("higher-lower", "daily", { score: dailyScore(next) });
        setFinish(true);
      }
    }, 1300);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") call(true);
      else if (e.key === "ArrowDown") call(false);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const st = dailyStats();
  const squares = (
    <ol className="flex gap-1" aria-label={`${calls.length} of ${DAILY_CALLS} calls made, ${score} right`}>
      {Array.from({ length: DAILY_CALLS }, (_, i) => (
        <li
          key={i}
          className={`h-2.5 flex-1 ${i < calls.length ? (calls[i] ? "bg-green" : "bg-kerb") : i === calls.length && !done ? "bg-paint/40" : "bg-asphalt"}`}
        />
      ))}
    </ol>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[880px] px-4 pt-8 pb-12 md:px-8 lg:pt-12">
        {modeSwitch}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="wide text-[clamp(30px,6vw,52px)] leading-none text-paint">Higher or lower</h1>
              <HowToPlay game="higher-lower" />
            </div>
            <p className="mt-3 max-w-[46ch] text-[15px] text-steel">Today's ten calls on real circuit facts, the same for everyone. A miss costs a point, not the round.</p>
          </div>
          <dl className="flex gap-6 text-center">
            <div>
              <dd className="wide num text-[28px] leading-none text-paint">
                <Roll text={String(score)} />
                <span className="text-steel">/{DAILY_CALLS}</span>
              </dd>
              <dt className="caption mt-1">Score</dt>
            </div>
            <div>
              <dd className="wide num text-[28px] leading-none text-steel">{Math.min(calls.length + (done ? 0 : 1), DAILY_CALLS)}</dd>
              <dt className="caption mt-1">Call</dt>
            </div>
          </dl>
        </div>

        <div className="mt-6">{squares}</div>

        {done && phase === "ask" ? (
          <div className="rise mt-10 flex flex-col items-center text-center">
            <p className="wide text-[clamp(40px,10vw,64px)] leading-none text-paint">
              {score}/{DAILY_CALLS}
            </p>
            <p className="mt-3 text-[16px] text-paint/85">{verdict(score)}. New calls tomorrow.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button className={secondaryBtn} onClick={() => setFinish(true)}>
                See result
              </button>
              <button className={primaryBtn} onClick={onEndless}>
                Play endless
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-8 text-center text-[16px] text-paint/85" aria-live="polite">
              {phase === "ask" ? (
                round.stat.ask(round.left.name, round.right.name)
              ) : phase === "right" ? (
                <span className="text-green">Right.</span>
              ) : (
                <span className="text-kerb">Wrong call.</span>
              )}
            </p>
            <div key={`${shownIndex}`} className="hl-deal mt-5 grid grid-cols-2 gap-3 sm:gap-5">
              <Card c={round.left} label={round.stat.label} shown={round.stat.format(value(round.left, round.stat.key)!)} />
              <Card
                c={round.right}
                label={round.stat.label}
                shown={phase === "ask" ? null : round.stat.format(value(round.right, round.stat.key)!)}
                tone={phase === "ask" ? undefined : phase}
                roll
              />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5">
              <button className={`${secondaryBtn} h-14 text-[16px]`} disabled={phase !== "ask"} onClick={() => call(true)}>
                <Up /> {round.stat.up}
              </button>
              <button className={`${secondaryBtn} h-14 text-[16px]`} disabled={phase !== "ask"} onClick={() => call(false)}>
                <Down /> {round.stat.down}
              </button>
            </div>
          </>
        )}
        <p className="caption mt-6 text-center">Pole laps are the real 2025 qualifying times.<span className="hidden [@media(hover:hover)]:inline"> Arrow keys work too.</span></p>
      </div>
      {finish && done && (
        <FinishCard
          game="higher-lower"
          eyebrow={`Higher or lower #${dailyNumber()}`}
          title={verdict(score)}
          tone={score >= 8 ? "win" : score >= 5 ? "neutral" : "loss"}
          value={`${score}/${DAILY_CALLS}`}
          valueLabel="right calls"
          message={score === DAILY_CALLS ? "Every call right." : `${DAILY_CALLS - score} ${DAILY_CALLS - score === 1 ? "miss" : "misses"} today.`}
          stats={[
            ["Played", String(st.played)],
            ["Average", st.average !== null ? st.average.toFixed(1) : "-"],
            ["Best", st.best !== null ? `${st.best}/${DAILY_CALLS}` : "-"],
          ]}
          shareText={dailyShare(calls, `${location.origin}/higher-lower`)}
          again={{ label: "Play endless", onClick: onEndless }}
          daily="daily ten"
          onClose={() => setFinish(false)}
        />
      )}
      <AdBelow />
    </div>
  );
}
