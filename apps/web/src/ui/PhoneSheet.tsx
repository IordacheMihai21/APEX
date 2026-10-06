import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Game } from "../game/game";
import { ChevronDown } from "./icons";

/**
 * The phone's result sheet, with two stops like a maps app: collapsed, it
 * shows the lap time, the outcome and the actions, and the circuit fills the
 * screen above it; pulled up, it shows every stat and the circuit shrinks into
 * the space left. Drag the top edge, or tap it, to switch. The camera reframes
 * the circuit into whatever is visible (Game.setInsets).
 */
export function PhoneSheet({ game, summary, actions, details }: { game: Game; summary: React.ReactNode; actions: React.ReactNode; details: React.ReactNode }) {
  const [full, setFull] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [size, setSize] = useState({ sheet: 0, peek: 0 });
  const sheet = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; t: number } | null>(null);

  // peek = the handle, the summary and the actions; the rest waits below the fold
  useLayoutEffect(() => {
    const el = sheet.current;
    const head = top.current;
    if (!el || !head) return;
    const measure = () => setSize({ sheet: el.offsetHeight, peek: head.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(head);
    return () => ro.disconnect();
  }, []);

  const travel = Math.max(0, size.sheet - size.peek);
  const base = full ? 0 : travel;
  const y = Math.min(travel, Math.max(0, base + (drag ?? 0)));

  // frame the circuit into the part of the screen the sheet leaves free
  useEffect(() => {
    if (!size.sheet) return;
    game.setInsets({ bottom: full ? size.sheet : size.peek, right: 0 });
  }, [game, full, size]);
  useEffect(() => () => game.setInsets({ bottom: 0, right: 0 }), [game]);

  const down = (e: React.PointerEvent) => {
    start.current = { y: e.clientY, t: performance.now() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (start.current) setDrag(e.clientY - start.current.y);
  };
  const up = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    setDrag(null);
    if (!s) return;
    const dy = e.clientY - s.y;
    const v = dy / Math.max(1, performance.now() - s.t); // px per ms
    if (Math.abs(dy) < 6) setFull((f) => !f); // a tap
    else if (dy < -40 || v < -0.4) setFull(true);
    else if (dy > 40 || v > 0.4) setFull(false);
  };

  return (
    <div
      ref={sheet}
      className="absolute inset-x-0 bottom-0 flex h-[86%] flex-col border-t border-line bg-night/95 backdrop-blur-[3px]"
      style={{ transform: `translateY(${y}px)`, transition: drag === null ? "transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none" }}
    >
      <div ref={top}>
        <div className="touch-none select-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <button
            type="button"
            className="flex w-full flex-col items-center gap-1 pt-2 pb-1"
            aria-expanded={full}
            aria-label={full ? "Show the circuit" : "Show all the stats"}
            // pointer taps are handled on pointer-up; this is the keyboard path (Enter / Space)
            onClick={(e) => e.detail === 0 && setFull((f) => !f)}
          >
            <span className="h-1 w-10 rounded-full bg-paint/30" aria-hidden="true" />
            <span className="caption flex items-center gap-1 text-steel">
              {full ? "Circuit" : "Stats"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${full ? "" : "rotate-180"}`} />
            </span>
          </button>
          <div className="px-4">{summary}</div>
        </div>
        <div className="flex flex-wrap gap-2.5 px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))]">{actions}</div>
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto border-t border-line px-4 pb-6 ${full ? "" : "pointer-events-none"}`} aria-hidden={!full}>
        {details}
      </div>
    </div>
  );
}
