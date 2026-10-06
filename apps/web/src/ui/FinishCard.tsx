import { useEffect, useRef, useState } from "react";
import { GAMES, type GameId } from "../games/registry";
import { msToNextDay } from "../modes/daily";
import { track } from "../analytics";
import { ChevronRight, Share } from "./icons";
import { primaryBtn, secondaryBtn } from "./styles";

/** Where a finished game can send the player next (App listens for this). */
export type GoTo = GameId;
export const go = (to: GoTo) => window.dispatchEvent(new CustomEvent<GoTo>("lapdle:go", { detail: to }));

function clock(ms: number) {
  const x = Math.floor(ms / 1000);
  return `${String(Math.floor(x / 3600)).padStart(2, "0")}:${String(Math.floor((x % 3600) / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
}

/**
 * The end-of-game card every minigame shows, the way daily-game sites close a
 * round: what happened in one line, the result large, the player's numbers,
 * Share, then what to do next (another go, the countdown to tomorrow's, the
 * other games). Escape, the cross or a tap outside closes it; the game's own
 * result stays on the page underneath.
 */
export function FinishCard({
  game,
  eyebrow,
  title,
  tone = "neutral",
  value,
  valueLabel,
  message,
  stats,
  shareText,
  again,
  daily,
  onClose,
}: {
  game: GoTo;
  eyebrow: string;
  title: string;
  tone?: "win" | "loss" | "neutral";
  value: string;
  valueLabel?: string;
  message?: string;
  stats: [string, string][];
  shareText: string;
  /** another go, for the endless and practice modes */
  again?: { label: string; onClick: () => void };
  /** a daily puzzle: show the countdown to the next one */
  daily?: string;
  onClose: () => void;
}) {
  const [left, setLeft] = useState(msToNextDay);
  const [copied, setCopied] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const t = setInterval(() => setLeft(msToNextDay()), 1000);
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", k);
    };
  }, [onClose]);

  const share = async () => {
    track("Share", { what: game });
    try {
      if (navigator.share) await navigator.share({ text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  const titleTone = tone === "win" ? "text-green" : tone === "loss" ? "text-paint" : "text-paint";
  return (
    <div
      className="fixed inset-0 z-20 flex cursor-default items-end justify-center bg-night/80 backdrop-blur-[2px] sm:items-center sm:p-4"
      // a game's stage can itself be one big tap target: nothing on the card reaches it
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="finish-in max-h-[92dvh] w-full overflow-y-auto border-t border-line bg-board px-5 pt-4 pb-[max(20px,env(safe-area-inset-bottom))] sm:max-w-[400px] sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="caption">{eyebrow}</span>
          <button ref={close} onClick={onClose} aria-label="Close" className="-mr-2 grid h-9 w-9 place-items-center text-[22px] leading-none text-steel hover:text-paint">
            ×
          </button>
        </div>

        <h2 className={`wide mt-1 text-[28px] leading-[1.05] ${titleTone}`}>{title}</h2>
        <div className="mt-4 flex items-baseline gap-3">
          <span className="wide num text-[48px] leading-none text-paint">{value}</span>
          {valueLabel && <span className="caption">{valueLabel}</span>}
        </div>
        {message && <p className="mt-2 text-[15px] leading-snug text-paint/80">{message}</p>}

        <dl className="mt-5 grid border-y border-line py-3 text-center" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
          {stats.map(([label, v]) => (
            <div key={label} className="flex flex-col-reverse gap-1">
              <dt className="caption">{label}</dt>
              <dd className="wide num text-[20px] leading-none text-paint">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <button className={`${primaryBtn} flex-1 basis-36`} onClick={share}>
            <Share className="h-4 w-4" />
            {copied ? "Copied" : "Share"}
          </button>
          {again && (
            <button className={`${secondaryBtn} flex-1 basis-28`} onClick={again.onClick}>
              {again.label}
            </button>
          )}
        </div>
        {daily && (
          <p className="mt-3 text-[13px] text-steel">
            Next {daily} in <span className="num font-semibold text-paint">{clock(left)}</span>
          </p>
        )}

        <h3 className="caption mt-5">Play next</h3>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {GAMES.filter((g) => g.id !== game).map((g) => (
            <li key={g.id}>
              <button className="group flex w-full items-center gap-3 py-2.5 text-left" onClick={() => go(g.id)}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-paint">{g.name}</span>
                  <span className="block truncate text-[13px] text-steel">{g.tagline}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-steel transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
