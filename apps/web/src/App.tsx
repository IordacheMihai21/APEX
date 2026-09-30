import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CATALOG, loadTrack } from "./game/catalog";
import { Game, PLAYBACK_SPEED, type Snapshot } from "./game/game";
import { GateSlider } from "./ui/GateSlider";
import { PitBoard } from "./ui/PitBoard";
import { delta, lapTime } from "./ui/format";

function initialTrack() {
  const id = new URLSearchParams(location.search).get("track");
  return CATALOG.some((t) => t.id === id) ? id! : "monza";
}

export function App() {
  const [trackId, setTrackId] = useState(initialTrack);
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let alive = true;
    setGame(null);
    setError(null);
    loadTrack(trackId)
      .then((t) => alive && setGame(new Game(t)))
      .catch((e: Error) => alive && setError(e.message));
    const url = new URL(location.href);
    url.searchParams.set("track", trackId);
    history.replaceState(null, "", url);
    return () => {
      alive = false;
    };
  }, [trackId]);

  const info = CATALOG.find((t) => t.id === trackId)!;

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] overflow-hidden select-none">
      <header className="flex items-center justify-between gap-3 border-b border-white/5 bg-tarmac px-4 pt-[max(10px,env(safe-area-inset-top))] pb-2.5">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span className="font-display text-[26px] font-black leading-none tracking-[0.06em] text-paint">APEX</span>
          <button
            onClick={() => setPicking(true)}
            className="min-w-0 truncate rounded px-1 font-display text-[19px] font-bold uppercase leading-none tracking-[0.04em] text-steel hover:text-paint"
            aria-label={`Track: ${info.name}. Change track`}
          >
            / {info.name} <span aria-hidden="true" className="text-[13px]">▾</span>
          </button>
        </div>
        {game && <PbChip game={game} />}
      </header>

      <main className="relative min-h-0">
        {game ? (
          <GameView key={trackId} game={game} />
        ) : (
          <div className="grid h-full place-items-center font-mono text-sm text-steel">{error ?? "Loading circuit…"}</div>
        )}
      </main>

      {picking && (
        <TrackPicker
          current={trackId}
          onPick={(id) => {
            setPicking(false);
            setTrackId(id);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

function useSnapshot(game: Game): Snapshot {
  return useSyncExternalStore(game.subscribe, game.getSnapshot);
}

function PbChip({ game }: { game: Game }) {
  const s = useSnapshot(game);
  if (s.pbMs === null) return null;
  return (
    <div className="shrink-0 text-right leading-tight">
      <div className="font-mono text-[10px] tracking-[0.14em] text-steel">PERSONAL BEST</div>
      <div className="font-mono text-[15px] font-medium tabular-nums text-green">{lapTime(s.pbMs)}</div>
    </div>
  );
}

function GameView({ game }: { game: Game }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const s = useSnapshot(game);

  useEffect(() => {
    game.attach(canvas.current!);
    return () => game.detach();
  }, [game]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("[role=dialog]")) return;
      const k = e.key;
      if ((k === "z" && (e.metaKey || e.ctrlKey)) || k === "Backspace") {
        e.preventDefault();
        game.undo();
      } else if (s.phase === "setup" && (k === "ArrowLeft" || k === "ArrowRight")) {
        e.preventDefault();
        // ← moves the car left on track (positive offset = left of travel)
        game.nudge((k === "ArrowLeft" ? 1 : -1) * (e.shiftKey ? 0.5 : 0.05));
      } else if (s.phase === "setup" && (k === "Tab" || k === "ArrowUp" || k === "ArrowDown")) {
        e.preventDefault();
        game.stepGate(k === "ArrowUp" || (k === "Tab" && !e.shiftKey) ? 1 : -1);
      } else if (s.phase === "setup" && (k === "]" || k === "[")) {
        game.stepComplex(k === "]" ? 1 : -1);
      } else if (k === "Enter") {
        if (s.phase === "setup") game.race();
        else if (s.phase === "result") game.adjust();
      } else if (k === "Escape" && s.phase === "race") game.skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, s.phase]);

  return (
    <>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label={`${game.track.name} circuit`} />
      {s.phase === "setup" && <ViewControls game={game} />}
      {s.phase === "setup" && <SetupPanel s={s} game={game} />}
      {s.phase === "race" && <RaceHud s={s} game={game} />}
      {s.phase === "result" && s.result && <ResultPanel s={s} game={game} />}
    </>
  );
}

/** Reports a panel's size to the game so the camera frames around it. */
function useInset(game: Game, side: "bottom" | "right", enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const parent = el.offsetParent?.getBoundingClientRect();
      if (!parent) return;
      if (side === "bottom") game.setInsets({ bottom: parent.bottom - r.top, right: 0 });
      else game.setInsets({ right: parent.right - r.left, bottom: 0 });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      game.setInsets({ bottom: 0, right: 0 });
    };
  }, [game, side, enabled]);
  return ref;
}

const btn =
  "rounded-md border border-white/12 bg-board/80 px-3.5 py-2.5 font-body text-[15px] font-medium text-paint backdrop-blur-sm transition-colors hover:border-white/30 disabled:opacity-35 disabled:hover:border-white/12";
const primary =
  "rounded-md bg-ink px-5 py-2.5 font-display text-[20px] font-black uppercase leading-none tracking-[0.08em] text-board transition-transform active:scale-[0.97] disabled:bg-asphalt disabled:text-steel";

function ViewControls({ game }: { game: Game }) {
  const c = "grid h-10 w-10 place-items-center rounded-md border border-white/12 bg-board/80 font-mono text-lg text-paint hover:border-white/30";
  return (
    <div className="absolute top-3 left-3 flex flex-col gap-2">
      <button className={c} onClick={() => game.zoom(1.4)} aria-label="Zoom in">
        +
      </button>
      <button className={c} onClick={() => game.zoom(1 / 1.4)} aria-label="Zoom out">
        −
      </button>
      <button className={`${c} text-[11px]`} onClick={() => game.showOverview()} aria-label="Show the whole track">
        ALL
      </button>
      <button className={`${c} text-[11px]`} onClick={() => game.recenter()} aria-label="Back to the selected corner">
        FIT
      </button>
    </div>
  );
}

/** Compact chip text; the selected chip (and small groups) spell the label out. */
function gateChip(g: { label: string; corner?: string }, selected: boolean, count: number) {
  const full = selected || count <= 4;
  if (g.label === "Apex") return full ? `APEX ${g.corner ?? ""}`.trim() : (g.corner ?? "A");
  if (g.label === "Turn-in") return full ? "TURN-IN" : "IN";
  if (g.label === "Exit") return full ? "EXIT" : "OUT";
  if (g.label === "Approach") return full ? "APPROACH" : "APP";
  if (g.label === "Track-out") return full ? "TRACK-OUT" : "TO";
  return full ? "MID" : "•";
}

function SetupPanel({ s, game }: { s: Snapshot; game: Game }) {
  const ref = useInset(game, "bottom");
  const cx = game.controls.complexes[s.complex];
  const total = game.controls.complexes.length;
  const inside = cx.direction === "mixed" ? null : cx.direction;
  const first = s.attempts === 0 && s.pbMs === null;
  const nav = "grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/12 font-mono text-lg text-paint hover:border-white/30";
  return (
    <div ref={ref} className="absolute inset-x-0 bottom-0 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-lg rounded-lg border border-white/10 bg-board/92 p-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button className={nav} onClick={() => game.stepComplex(-1)} aria-label="Previous corner">
            ‹
          </button>
          <div className="min-w-0 flex-1 text-center leading-none">
            <div className="font-display text-[26px] font-black tracking-[0.04em] text-paint">{cx.name}</div>
            <div className="mt-1 font-mono text-[10px] tracking-[0.14em] text-steel">
              CORNER {s.complex + 1} OF {total}
            </div>
          </div>
          <button className={nav} onClick={() => game.stepComplex(1)} aria-label="Next corner">
            ›
          </button>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Points in this corner">
          {cx.gates.map((g, i) => (
            <button
              key={g.knot}
              role="tab"
              aria-selected={i === s.gate}
              onClick={() => game.selectGate(s.complex, i)}
              aria-label={g.label === "Apex" && g.corner ? `Apex ${g.corner}` : g.label}
              className={`h-8 min-w-8 rounded-full border px-2.5 font-mono text-[11px] tracking-[0.06em] ${
                i === s.gate ? "border-ink bg-ink text-board" : "border-white/15 text-paint/80 hover:border-white/35"
              }`}
            >
              {gateChip(g, i === s.gate, cx.gates.length)}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button className={nav} onClick={() => game.nudge(0.05)} aria-label="Move 5 cm left">
            ◂
          </button>
          <div className="min-w-0 flex-1">
            <GateSlider
              offset={s.offset}
              limit={s.limit}
              inside={inside}
              onBegin={() => {
                game.beginEdit();
                return game.getSnapshot().offset;
              }}
              onChange={(v) => game.setOffset(v)}
              onEnd={() => game.endEdit()}
            />
          </div>
          <button className={nav} onClick={() => game.nudge(-0.05)} aria-label="Move 5 cm right">
            ▸
          </button>
        </div>

        <p className="mt-2 text-center text-[13px] leading-snug text-paint/60">
          {first
            ? "Race the centre line first to see where time is lost, or place the car at each white line."
            : "Tap the bar to place the car. Drag for fine control, and slide your finger away from the bar for even finer."}
        </p>

        <div className="mt-3 flex gap-2">
          <button className={btn} onClick={() => game.undo()} disabled={!s.canUndo}>
            Undo
          </button>
          {s.pbMs !== null && (
            <button className={btn} onClick={() => game.loadBest()}>
              Best line
            </button>
          )}
          <button className={`${primary} flex-1`} onClick={() => game.race()}>
            Race
          </button>
        </div>
      </div>
    </div>
  );
}

function RaceHud({ s, game }: { s: Snapshot; game: Game }) {
  return (
    <>
      <div className="pointer-events-none absolute top-3 left-3 rounded-md border border-white/10 bg-board/85 px-3 py-2 backdrop-blur-sm">
        <div className="font-mono text-[34px] font-medium leading-none tabular-nums text-paint">
          {Math.round(s.raceSpeedKmh)}
          <span className="ml-1 text-[12px] text-steel">km/h</span>
        </div>
        <div className="mt-1 font-mono text-[15px] tabular-nums text-steel">{lapTime(s.raceTimeMs)}</div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 pb-[max(14px,env(safe-area-inset-bottom))]">
        <span className="font-mono text-[10px] tracking-[0.14em] text-steel">
          ×{PLAYBACK_SPEED} SPEED{s.pbMs !== null ? " · WHITE CAR = YOUR BEST" : ""}
        </span>
        <button className={btn} onClick={() => game.skip()}>
          Skip to result
        </button>
      </div>
    </>
  );
}

function ResultPanel({ s, game }: { s: Snapshot; game: Game }) {
  const r = s.result!;
  const worst = r.losses.filter((l) => l.deltaMs > 50 && l.complex >= 0).slice(0, 3);
  const wide = typeof window !== "undefined" && window.innerWidth >= 720;
  const ref = useInset(game, wide ? "right" : "bottom");
  return (
    <div ref={ref} className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-3 pb-[max(12px,env(safe-area-inset-bottom))] min-[720px]:inset-x-auto min-[720px]:top-0 min-[720px]:right-0 min-[720px]:w-[400px] min-[720px]:justify-center min-[720px]:p-6">
      <PitBoard r={r} />
      <div className="rise rounded-lg border border-white/10 bg-board/90 p-3 backdrop-blur-sm [animation-delay:250ms]">
        {worst.length === 0 ? (
          <p className="text-[14px] leading-snug text-paint/85">You matched the target line everywhere. Nothing left to find.</p>
        ) : (
          <>
            <p className="font-mono text-[10px] tracking-[0.14em] text-steel">MOST TIME LOST · TAP TO FIX</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {worst.map((l) => (
                <button
                  key={l.name}
                  onClick={() => game.adjust(l.name)}
                  className="rounded-md border border-white/15 px-3 py-2 font-mono text-[14px] hover:border-white/40"
                >
                  <span className="font-medium text-paint">{l.name}</span> <span className="text-yellow">{delta(l.deltaMs)}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-paint/60">Target lap {lapTime(r.targetMs)}.</p>
          </>
        )}
        <Legend />
        <div className="mt-3 flex gap-2">
          <button className={`${primary} flex-1`} onClick={() => game.adjust()} autoFocus>
            Improve line
          </button>
        </div>
      </div>
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["bg-purple", "on target"],
    ["bg-green", "< 0.12 s"],
    ["bg-yellow", "< 0.3 s"],
    ["bg-kerb", "more"],
  ];
  return (
    <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.06em] text-steel">
      {items.map(([c, t]) => (
        <span key={t} className="flex items-center gap-1.5">
          <span className={`h-1 w-4 rounded-full ${c}`} />
          {t}
        </span>
      ))}
    </div>
  );
}

function TrackPicker({ current, onPick, onClose }: { current: string; onPick: (id: string) => void; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center bg-black/60 p-4 pt-16" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Choose a circuit"
        className="rise w-full max-w-sm overflow-hidden rounded-lg border border-white/10 bg-board"
        onClick={(e) => e.stopPropagation()}
      >
        <ul className="max-h-[70dvh] overflow-y-auto py-1">
          {CATALOG.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onPick(t.id)}
                className={`flex w-full items-baseline justify-between px-4 py-2.5 text-left hover:bg-white/5 ${t.id === current ? "text-ink" : "text-paint"}`}
              >
                <span className="font-display text-[20px] font-bold uppercase tracking-[0.04em]">{t.name}</span>
                <span className="font-mono text-[11px] text-steel">{t.country}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
