import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { HowToPlay, modalOpen } from "./HowToPlay";
import { FinishCard } from "./FinishCard";
import { gameFinished, gameStarted, shared } from "../games/events";
import { LIGHT_MS, type ReactionRecord, average, loadReaction, randomHold, recordJump, recordReaction, verdict } from "../modes/reaction";
import { Gantry } from "./Gantry";
import { Segments } from "./Segments";
import { Share } from "./icons";
import { primaryBtn, secondaryBtn } from "./styles";
import { shareLink } from "../shareLink";

type Phase = "idle" | "lights" | "hold" | "go" | "done" | "jump";

const secs = (ms: number) => (ms / 1000).toFixed(3);

/**
 * The lights-out reaction test: tap (or Space) to arm, the five pods light one
 * a second, hold for a random 0.2–3 s, go out; tap as they go out. The whole
 * stage is the button, so a phone can be held one-handed.
 */
export function Reaction({ onPlayDaily }: { onPlayDaily: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lit, setLit] = useState(0);
  const [ms, setMs] = useState<number | null>(null);
  const [rec, setRec] = useState<ReactionRecord>(loadReaction);
  const [copied, setCopied] = useState(false);
  const [finish, setFinish] = useState(false);
  const timers = useRef<number[]>([]);
  const outAt = useRef(0);

  const clear = () => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => clear, []);

  const start = useCallback(() => {
    gameStarted("reaction", "endless");
    clear();
    setMs(null);
    setLit(0);
    setPhase("lights");
    for (let k = 1; k <= 5; k++)
      timers.current.push(
        window.setTimeout(() => {
          setLit(k);
          if (k === 5) {
            setPhase("hold");
            timers.current.push(
              window.setTimeout(() => {
                setLit(0);
                outAt.current = performance.now();
                setPhase("go");
              }, randomHold()),
            );
          }
        }, k * LIGHT_MS),
      );
  }, []);

  const tap = useCallback(() => {
    if (phase === "idle" || phase === "done" || phase === "jump") start();
    else if (phase === "lights" || phase === "hold") {
      clear();
      setLit(0);
      setPhase("jump");
      setRec((r) => recordJump(r));
      timers.current.push(window.setTimeout(() => setFinish(true), 700));
    } else if (phase === "go") {
      const took = Math.round(performance.now() - outAt.current);
      setMs(took);
      setPhase("done");
      setRec((r) => recordReaction(r, took));
      gameFinished("reaction", "endless", { band: took < 200 ? "under 0.2 s" : took < 250 ? "0.2-0.25 s" : took < 300 ? "0.25-0.3 s" : "0.3 s+" });
      // a beat to read the number on the stage, then the card
      timers.current.push(window.setTimeout(() => setFinish(true), 700));
    }
  }, [phase, start]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (finish || modalOpen()) return; // a card has the keys while open
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [tap, finish]);

  const avg = average(rec);
  const shareText = () =>
    rec.best !== null
      ? t("Lapdle lights out: {s}s (best {best}s). How fast off the line are you? {link}", { s: secs(ms ?? rec.best), best: secs(rec.best), link: shareLink("/reaction", "share-reaction") })
      : t("Lapdle lights out: {s}s. How fast off the line are you? {link}", { s: secs(ms ?? 0), link: shareLink("/reaction", "share-reaction") });
  const share = async () => {
    shared("reaction");
    const text = shareText();
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

  // the lights are running (or just went out): the button is the launch control
  const armed = phase === "lights" || phase === "hold" || phase === "go";
  const display = phase === "done" && ms !== null ? secs(ms) : phase === "jump" ? "-.---" : "0.000";
  const prompt =
    phase === "idle"
      ? t("Press Start (or Space). Hit Launch the moment the lights go out.")
      : phase === "lights" || phase === "hold"
        ? t("Wait for it.")
        : phase === "go"
          ? t("Go!")
          : phase === "jump"
            ? t("Jump start. You moved before the lights went out. Press Again to retry.")
            : verdict(ms!);

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-4 pt-8 pb-10 lg:pt-14">
      <div className="flex w-full max-w-[520px] items-center justify-center gap-3">
        <h1 className="wide text-[clamp(30px,6vw,52px)] leading-none text-paint">{t("Lights out")}</h1>
        <HowToPlay game="reaction" />
      </div>
      <p className="mt-2 max-w-[42ch] text-center text-[15px] text-steel">{t("How fast are you off the line? Racing drivers react in about 0.2 s; most people take about 0.27 s.")}</p>

      <div className="mt-10">
        <Gantry lit={lit} size="lg" label={phase === "go" ? t("Lights out") : t("{n} of 5 start lights on", { n: lit })} />
      </div>

      <div className={`mt-10 ${phase === "jump" ? "text-lamp" : phase === "done" ? "text-paint" : "text-steel/50"}`} aria-live="polite">
        <Segments text={display} className="h-16 lg:h-20" ghost={0.12} />
        <span className="sr-only">{phase === "done" && ms !== null ? t("{s} seconds", { s: secs(ms) }) : ""}</span>
      </div>
      <p className={`mt-4 min-h-[44px] max-w-[40ch] text-center text-[16px] ${phase === "jump" ? "text-lamp" : "text-paint/85"}`}>{prompt}</p>

      {/* the one control: a steering-wheel push button. Start arms the lights; the same button launches */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault(); // react on touch-down, not on release: every millisecond counts
          tap();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault(); // Enter is handled on the window, once
        }}
        className={`launch-btn mt-6 ${armed ? "launch-armed" : ""}`}
        aria-label={armed ? t("Launch") : phase === "idle" ? t("Start") : t("Start again")}
      >
        <span className="launch-cap">
          <span className="wide text-[18px] tracking-[0.06em]">{armed ? t("Launch") : phase === "idle" ? t("Start") : t("Again")}</span>
        </span>
      </button>

      <dl className="mt-6 flex gap-8 text-center">
        {[
          [t("Best"), rec.best !== null ? secs(rec.best) : "-"],
          [t("Last 5 average"), avg !== null ? secs(avg) : "-"],
          [t("Jump starts"), String(rec.jumps)],
        ].map(([k, v]) => (
          <div key={k}>
            <dd className="wide num text-[20px] text-paint">{v}</dd>
            <dt className="caption mt-1">{k}</dt>
          </div>
        ))}
      </dl>

      {phase === "done" && (
        <div className="rise mt-8 flex flex-wrap justify-center gap-2">
          <button className={secondaryBtn} onClick={share}>
            <Share className="h-4 w-4" /> {copied ? t("Copied") : t("Share")}
          </button>
          <button className={primaryBtn} onClick={onPlayDaily}>
            {t("Now find the perfect lap")}
          </button>
        </div>
      )}

      {finish && (phase === "done" || phase === "jump") && (
        <FinishCard
          game="reaction"
          eyebrow={t("Lights out")}
          title={phase === "jump" ? t("Jump start") : verdict(ms!)}
          tone={phase === "jump" || (ms !== null && ms < 100) ? "loss" : rec.best !== null && ms !== null && ms <= rec.best ? "win" : "neutral"}
          value={phase === "jump" ? "-.---" : secs(ms!)}
          valueLabel={t("seconds")}
          message={phase === "jump" ? t("You moved before the lights went out.") : t("Racing drivers react in about 0.2 s; most people take about 0.27 s.")}
          stats={[
            [t("Best"), rec.best !== null ? secs(rec.best) : "-"],
            [t("Average"), avg !== null ? secs(avg) : "-"],
            [t("Jump starts"), String(rec.jumps)],
          ]}
          shareText={shareText()}
          again={{ label: t("Try again"), onClick: () => (setFinish(false), start()) }}
          onClose={() => setFinish(false)}
        />
      )}
    </div>
  );
}
