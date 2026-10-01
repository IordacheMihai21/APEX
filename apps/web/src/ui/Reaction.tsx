import { useCallback, useEffect, useRef, useState } from "react";
import { soundEnabled } from "../game/audio";
import { LIGHT_MS, type ReactionRecord, average, loadReaction, randomHold, recordJump, recordReaction, verdict } from "../modes/reaction";
import { Gantry } from "./Gantry";
import { Segments } from "./Segments";
import { Share } from "./icons";
import { primaryBtn, secondaryBtn } from "./styles";

type Phase = "idle" | "lights" | "hold" | "go" | "done" | "jump";

/** A short start-light beep (only with sound on). */
let audio: AudioContext | null = null;
function beep(freq: number, ms: number) {
  if (!soundEnabled()) return;
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.12, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + ms / 1000);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + ms / 1000);
  } catch {
    /* no audio */
  }
}

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
  const timers = useRef<number[]>([]);
  const outAt = useRef(0);

  const clear = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clear, []);

  const start = useCallback(() => {
    clear();
    setMs(null);
    setLit(0);
    setPhase("lights");
    for (let k = 1; k <= 5; k++)
      timers.current.push(
        window.setTimeout(() => {
          setLit(k);
          beep(660, 120);
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
      beep(220, 300);
    } else if (phase === "go") {
      const t = Math.round(performance.now() - outAt.current);
      setMs(t);
      setPhase("done");
      setRec((r) => recordReaction(r, t));
    }
  }, [phase, start]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [tap]);

  const avg = average(rec);
  const share = async () => {
    const text = `APEX lights out: ${secs(ms ?? rec.best ?? 0)}s${rec.best !== null ? ` (best ${secs(rec.best)}s)` : ""}. How fast off the line are you? ${location.origin}/reaction`;
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

  const display = phase === "done" && ms !== null ? secs(ms) : phase === "jump" ? "-.---" : "0.000";
  const prompt =
    phase === "idle"
      ? "Tap anywhere, or press Space, to start. Tap again the moment the lights go out."
      : phase === "lights" || phase === "hold"
        ? "Wait for it."
        : phase === "go"
          ? "Go!"
          : phase === "jump"
            ? "Jump start. You moved before the lights went out. Tap to try again."
            : verdict(ms!);

  return (
    <div
      className="flex h-full cursor-pointer touch-manipulation flex-col items-center overflow-y-auto px-4 pt-8 pb-10 select-none lg:pt-14"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button,a")) return;
        tap();
      }}
    >
      <h1 className="wide text-[clamp(30px,6vw,52px)] leading-none text-paint">Lights out</h1>
      <p className="mt-2 max-w-[42ch] text-center text-[15px] text-steel">How fast are you off the line? F1 drivers react in about 0.2 s; most people take about 0.27 s.</p>

      <div className="mt-10">
        <Gantry lit={lit} size="lg" label={phase === "go" ? "Lights out" : `${lit} of 5 start lights on`} />
      </div>

      <div className={`mt-10 ${phase === "jump" ? "text-lamp" : phase === "done" ? "text-paint" : "text-steel/50"}`} aria-live="polite">
        <Segments text={display} className="h-16 lg:h-20" ghost={0.12} />
        <span className="sr-only">{phase === "done" && ms !== null ? `${secs(ms)} seconds` : ""}</span>
      </div>
      <p className={`mt-4 min-h-[44px] max-w-[40ch] text-center text-[16px] ${phase === "jump" ? "text-lamp" : "text-paint/85"}`}>{prompt}</p>

      <dl className="mt-6 flex gap-8 text-center">
        {[
          ["Best", rec.best !== null ? secs(rec.best) : "-"],
          ["Last 5 average", avg !== null ? secs(avg) : "-"],
          ["Jump starts", String(rec.jumps)],
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
            <Share className="h-4 w-4" /> {copied ? "Copied" : "Share"}
          </button>
          <button className={primaryBtn} onClick={onPlayDaily}>
            Now find the perfect lap
          </button>
        </div>
      )}
    </div>
  );
}
