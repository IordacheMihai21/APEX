import { useEffect, useRef } from "react";
import { GAMES, type GamePage, todayProgress } from "../games/registry";
import { loadSeason, seasonDone } from "../modes/season";
import type { HubAction } from "./Hub";
import { Chequered, Close, GameMarks } from "./icons";

/**
 * The menu behind the hub's ☰: every game in one list, today's daily set first
 * with where you stand, then the rest under More Games.
 * Slides in from the left; Escape, the backdrop or picking an entry closes it.
 */
export function Menu({ open, onClose, onAction }: { open: boolean; onClose: () => void; onAction: (a: HubAction) => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button, a")?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      prev?.focus?.();
    };
  }, [open, onClose]);

  const go = (a: HubAction) => {
    onClose();
    onAction(a);
  };
  const { items: today } = todayProgress();
  // every other game: the other dailies, then the ones you can play any time
  const run = loadSeason().run;
  const underWay = !!run && !seasonDone(run);
  const more: [string, HubAction | string][] = [
    ...GAMES.filter((g) => !g.inDailySet && g.route).map((g): [string, HubAction] => [g.name, { kind: "mini", game: g.route!.slice(1) as GamePage }]),
    ["Free Practice", { kind: "practice" }],
    ["Corner of the week", { kind: "corner" }],
    ["Perfect Season", { kind: "season", fresh: !underWay }],
    ["Circuit trivia", "/trivia"],
  ];

  const row = "flex w-full items-center gap-3 px-5 py-3 text-left text-[15px] text-paint transition-colors hover:bg-graphite focus-visible:bg-graphite";
  const heading = "caption mt-2 border-t border-line px-5 pt-5 pb-1 text-steel";
  const entry = ([name, to]: [string, HubAction | string]) => (
    <li key={name}>
      {typeof to === "string" ? (
        <a className={row} href={to} onClick={onClose}>
          {name}
        </a>
      ) : (
        <button className={row} onClick={() => go(to)}>
          {name}
        </button>
      )}
    </li>
  );

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open} inert={!open}>
      <div className={`absolute inset-0 bg-night/70 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div
        ref={panel}
        // a dialog only while open: the games pause their keys while any aria-modal is on the page
        role={open ? "dialog" : undefined}
        aria-modal={open ? "true" : undefined}
        aria-label="Menu"
        className={`absolute inset-y-0 left-0 flex w-[min(86vw,340px)] flex-col border-r border-line bg-night pt-[env(safe-area-inset-top)] transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[52px] shrink-0 items-stretch justify-between border-b border-line">
          <span className="wide flex items-center px-5 text-[17px] leading-none tracking-[0.02em] text-paint">LAPDLE</span>
          <button onClick={onClose} aria-label="Close the menu" className="grid w-12 place-items-center border-l border-line text-paint hover:bg-graphite">
            <Close />
          </button>
        </div>
        <nav aria-label="All games" className="min-h-0 flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <ul>
            {today.map(({ game: g, status }) => {
              const Mark = (GameMarks as Record<string, ((p: { className?: string }) => React.ReactElement) | undefined>)[g.id];
              const a: HubAction = g.id === "quali" ? (status.state === "done" ? { kind: "daily-summary" } : { kind: "daily" }) : { kind: "mini", game: g.route!.slice(1) as GamePage };
              return (
                <li key={g.id}>
                  <button className={row} onClick={() => go(a)}>
                    <span className={`grid h-5 w-5 place-items-center ${status.state === "done" ? "text-paint" : "text-steel"}`}>
                      {status.state === "done" ? <Chequered className="h-4 w-4" /> : Mark ? <Mark className="h-4 w-4" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{g.name}</span>
                    <span className="shrink-0 text-[12px] text-steel">{status.state === "new" ? "New today" : status.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className={heading}>More Games</p>
          <ul>{more.map(entry)}</ul>
        </nav>
      </div>
    </div>
  );
}
