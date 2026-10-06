import { useEffect, useRef, useState } from "react";
import type { Game } from "../game/game";
import { ChevronDown } from "./icons";

/**
 * Phone panels that fold like a maps app: pull a panel down and it shrinks
 * to a strip while the circuit takes the screen; pull it up and it opens
 * again. Swipes work anywhere on the strip (buttons inside still click); a tap
 * on the handle toggles too, and so do Enter and Space on it.
 */
function useSwipe(onUp: () => void, onDown: () => void) {
  const start = useRef<{ y: number; t: number } | null>(null);
  /** set when the last gesture was a swipe, so the click that may follow it isn't also a tap */
  const swiped = useRef(false);
  useEffect(() => () => void (start.current = null), []);
  const down = (e: React.PointerEvent) => {
    swiped.current = false;
    start.current = { y: e.clientY, t: performance.now() };
    const end = (ev: PointerEvent) => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dy = ev.clientY - s.y;
      const v = dy / Math.max(1, performance.now() - s.t);
      if (dy < -32 || v < -0.4) {
        swiped.current = true;
        onUp();
      } else if (dy > 32 || v > 0.4) {
        swiped.current = true;
        onDown();
      }
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  return { down, swiped };
}

function Handle({ open, onToggle, openLabel, closedLabel }: { open: boolean; onToggle: () => void; openLabel: string; closedLabel: string }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full touch-none flex-col items-center gap-1 pt-2 pb-1.5">
      <span className="h-1 w-10 rounded-full bg-paint/30" aria-hidden="true" />
      <span className="caption flex items-center gap-1 text-steel">
        {open ? openLabel : closedLabel}
        <ChevronDown className={`h-3.5 w-3.5 ${open ? "" : "rotate-180"}`} />
      </span>
    </button>
  );
}

/** Reports a panel's height to the game so the camera frames the circuit into the rest of the screen. */
function useBottomInset(game: Game) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => game.setInsets({ bottom: el.offsetHeight, right: 0 }));
    ro.observe(el);
    return () => ro.disconnect();
  });
  useEffect(() => () => game.setInsets({ bottom: 0, right: 0 }), [game]);
  return ref;
}

/**
 * The line-setup panel on phones. Open, it holds every control; pulled down,
 * it is a strip with the corner and Lights out, and the circuit fills the screen.
 */
export function SetupSheet({ game, strip, children }: { game: Game; strip: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const ref = useBottomInset(game);
  const swipe = useSwipe(
    () => setOpen(true),
    () => setOpen(false),
  );
  return (
    <div ref={ref} onPointerDown={swipe.down} className="absolute inset-x-0 bottom-0 border-t border-line bg-night/94 backdrop-blur-[3px]">
      <Handle open={open} onToggle={() => !swipe.swiped.current && setOpen((o) => !o)} openLabel="Map" closedLabel="Controls" />
      <div className="px-4 pb-[max(14px,env(safe-area-inset-bottom))]">{open ? children : strip}</div>
    </div>
  );
}

/**
 * The result on phones. Down: the lap time, the outcome and the actions in a
 * strip, the circuit large above it. Up: the lap fills the whole screen with
 * every stat, and the circuit is out of the way until it is pulled down again.
 */
export function ResultPhoneSheet({ game, summary, actions, details }: { game: Game; summary: React.ReactNode; actions: React.ReactNode; details: React.ReactNode }) {
  const [full, setFull] = useState(false);
  const ref = useBottomInset(game);
  const swipe = useSwipe(
    () => setFull(true),
    () => setFull(false),
  );
  return (
    <div ref={ref} className={`absolute inset-x-0 bottom-0 flex flex-col border-t border-line bg-night/97 backdrop-blur-[3px] ${full ? "top-0" : ""}`}>
      <div onPointerDown={swipe.down} className="shrink-0">
        <Handle open={full} onToggle={() => !swipe.swiped.current && setFull((f) => !f)} openLabel="Circuit" closedLabel="Stats" />
        <div className="px-4">{summary}</div>
        <div className="flex flex-wrap gap-2.5 px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))]">{actions}</div>
      </div>
      {full && <div className="min-h-0 flex-1 overflow-y-auto border-t border-line px-4 pb-8">{details}</div>}
    </div>
  );
}
