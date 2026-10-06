import { useEffect, useRef, useState } from "react";
import { primaryBtn } from "./styles";

type Game = "mystery" | "higher-lower" | "pit-stop" | "reaction";

const GUIDE: Record<Game, { name: string; steps: string[]; tip: string }> = {
  mystery: {
    name: "Mystery circuit",
    steps: [
      "A few corners of a real circuit are drawn. Pick the circuit you think it is.",
      "Every miss draws more of the lap and scores your guess: country, length, corners and first Grand Prix.",
      "Green is exact, yellow is close, and the arrows say whether the answer is higher or lower.",
    ],
    tip: "Six guesses. A new circuit every day.",
  },
  "higher-lower": {
    name: "Higher or lower",
    steps: [
      "Two circuits and one real fact: length, corners, race laps, first Grand Prix or the pole time.",
      "Call the second circuit against the first: longer or shorter, more or fewer, earlier or later, quicker or slower.",
      "Right, and a new circuit comes in. One wrong call ends the run.",
    ],
    tip: "Arrow keys work too. Endless: chase your longest run.",
  },
  "pit-stop": {
    name: "Pit stop",
    steps: [
      "Call the car in: press Space, or tap the pit box.",
      "The wheels light up one at a time. Hit the key shown beside it, or tap the lit tyre on a phone. A wrong key costs time.",
      "When the light turns green, release the car: Space, or tap. Too early is a penalty.",
    ],
    tip: "The daily stop counts once a day. Practice as often as you like.",
  },
  reaction: {
    name: "Lights out",
    steps: [
      "Press Start. The five red lights come on, one a second, then hold for a moment.",
      "The instant they all go out, hit Launch. Space works too.",
      "Moving before the lights go out is a jump start.",
    ],
    tip: "Racing drivers react in about 0.2 s. Most people take about 0.27 s.",
  },
};

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
  const g = GUIDE[game];

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
            <p className="mt-5 border-t border-line pt-4 text-[14px] text-steel">{g.tip}</p>
            <button className={`${primaryBtn} mt-5 w-full`} onClick={done}>
              Play
            </button>
          </div>
        </div>
      )}
    </>
  );
}
