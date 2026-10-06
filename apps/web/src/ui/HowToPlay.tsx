import { useEffect, useRef, useState } from "react";
import { type GameId, game as gameDef } from "../games/registry";
import { primaryBtn } from "./styles";

type Game = Exclude<GameId, "quali">;

/** Whether a game's card (how-to or finish) is open: game keys stay off while one is. */
export const modalOpen = () => typeof document !== "undefined" && !!document.querySelector('[aria-modal="true"]');

const seenKey = (g: Game) => `lapdle.howto.${g}`;
function seen(g: Game) {
  try {
    return localStorage.getItem(seenKey(g)) === "1";
  } catch {
    return true;
  }
}
function markSeen(g: Game) {
  try {
    localStorage.setItem(seenKey(g), "1");
  } catch {
    /* no storage: it simply shows again next time */
  }
}

/**
 * How to play: a small "?" beside a minigame's title, and the card it opens.
 * The card opens by itself on the first visit to each game, the way daily-game
 * sites introduce a round; the cross, Escape, a tap outside or "Play" close it.
 */
export function HowToPlay({ game, onOpenChange }: { game: Game; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(() => !seen(game));
  const close = useRef<HTMLButtonElement>(null);
  const def = gameDef(game);
  const g = { name: def.name, steps: def.howTo?.steps ?? [], tip: def.howTo?.tip ?? "" };

  useEffect(() => {
    onOpenChange?.(open);
    if (!open) return;
    close.current?.focus();
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") done();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const done = () => {
    markSeen(game);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`How to play ${g.name}`}
        title="How to play"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-[16px] font-bold text-steel transition-colors hover:border-paint/40 hover:text-paint"
      >
        ?
      </button>
      {open && (
        <div
          className="fixed inset-0 z-30 flex cursor-default items-end justify-center bg-night/80 backdrop-blur-[2px] sm:items-center sm:p-4"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            done();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`howto-${game}`}
            className="finish-in relative max-h-[92dvh] w-full overflow-y-auto border-t border-line bg-board px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:max-w-[420px] sm:border"
            onClick={(e) => e.stopPropagation()}
          >
            <button ref={close} onClick={done} aria-label="Close" className="absolute top-2 right-2 grid h-10 w-10 place-items-center text-[24px] leading-none text-steel hover:text-paint">
              ×
            </button>
            <p className="caption">How to play</p>
            <h2 id={`howto-${game}`} className="wide mt-1 pr-10 text-[28px] leading-none text-paint">
              {g.name}
            </h2>
            <ol className="mt-5 space-y-4">
              {g.steps.map((step, i) => (
                <li key={i} className="grid grid-cols-[28px_1fr] items-start gap-3">
                  <span className="wide num grid h-7 w-7 place-items-center bg-ink text-[14px] text-night">{i + 1}</span>
                  <span className="pt-0.5 text-[15px] leading-snug text-paint/90">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 border-t border-line pt-4 text-[14px] text-steel">
              {g.tip}{" "}
              <a href={`/how-to-play/${game}`} onClick={done} className="text-paint underline decoration-line underline-offset-4 hover:decoration-paint">
                Full guide
              </a>
            </p>
            <button className={`${primaryBtn} mt-5 w-full`} onClick={done}>
              Play
            </button>
          </div>
        </div>
      )}
    </>
  );
}
