import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Game } from "../game/game";

/**
 * A phone panel that follows the finger, like the sheets in a maps app. Its
 * top part (`head`) is always on show; dragging it up unfolds the rest
 * (`children`) and the circuit gives way, dragging it down folds the rest
 * away and the circuit takes the screen. On release it settles on the nearer
 * end, or the one the flick points to. Buttons inside still work; a drag
 * that moved never counts as a click. `full` lets the open panel cover the
 * whole screen (the lap result); otherwise it opens to its content's height.
 */
export function DragSheet({
  game,
  head,
  children,
  initial = "closed",
  full = false,
}: {
  game: Game;
  head: React.ReactNode;
  children: React.ReactNode;
  initial?: "open" | "closed";
  full?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(initial === "open");
  const [dragH, setDragH] = useState<number | null>(null);
  const [h, setH] = useState({ min: 0, max: 0 });
  const gesture = useRef<{ y: number; h: number; t: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);

  // the two ends: the head alone, and the head with everything under it (or the whole screen)
  useLayoutEffect(() => {
    const el = root.current;
    const hd = top.current;
    const bd = body.current;
    if (!el || !hd || !bd) return;
    const measure = () => {
      const room = el.parentElement?.clientHeight ?? window.innerHeight;
      const min = hd.offsetHeight;
      const max = full ? room : Math.min(room * 0.92, min + bd.scrollHeight);
      setH((p) => (p.min === min && p.max === max ? p : { min, max }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(hd);
    ro.observe(bd);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [full]);

  // the camera frames the circuit into whatever the panel leaves free (once it settles)
  useEffect(() => {
    if (!h.max || dragH !== null) return;
    const covered = open ? h.max : h.min;
    // a panel over the whole screen leaves no map to frame: keep the circuit framed for the strip
    game.setInsets({ bottom: full && open ? h.min : covered, right: 0 });
  }, [game, open, h, dragH, full]);
  useEffect(() => () => game.setInsets({ bottom: 0, right: 0 }), [game]);

  const settle = open ? h.max : h.min;
  const height = dragH ?? settle;

  const onDown = (e: React.PointerEvent) => {
    gesture.current = { y: e.clientY, h: height, t: performance.now(), moved: false };
    const move = (ev: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      const dy = ev.clientY - g.y;
      if (!g.moved && Math.abs(dy) < 6) return;
      g.moved = true;
      setDragH(Math.max(h.min, Math.min(h.max, g.h - dy)));
    };
    const end = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      const g = gesture.current;
      gesture.current = null;
      if (!g || !g.moved) return setDragH(null);
      swallowClick.current = true;
      const dy = ev.clientY - g.y;
      const v = dy / Math.max(1, performance.now() - g.t); // px per ms, down is positive
      const now = Math.max(h.min, Math.min(h.max, g.h - dy));
      const toOpen = v < -0.35 ? true : v > 0.35 ? false : now > (h.min + h.max) / 2;
      setOpen(toOpen);
      setDragH(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  return (
    <div
      ref={root}
      onClickCapture={(e) => {
        // the click that ends a drag is not a tap on whatever button it ended over
        if (swallowClick.current) {
          swallowClick.current = false;
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden border-t border-line bg-night/96 backdrop-blur-[3px]"
      style={{ height: height || undefined, transition: dragH === null ? "height 300ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none" }}
    >
      <div ref={top} onPointerDown={onDown} className="shrink-0 touch-none select-none px-4 pb-3">
        <div className="flex justify-center pt-2 pb-2.5" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-paint/30" />
        </div>
        {head}
      </div>
      <div
        className={`min-h-0 flex-1 border-t border-line ${open && dragH === null ? "overflow-y-auto" : "overflow-hidden"}`}
        aria-hidden={!open}
      >
        <div ref={body} className="px-4 pt-1 pb-[max(16px,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
