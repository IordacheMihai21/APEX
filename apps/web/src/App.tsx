import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { setSoundEnabled, soundEnabled } from "./game/audio";
import { CATALOG, loadTrack } from "./game/catalog";
import { Game, type Mode, type Snapshot } from "./game/game";
import { DAILY_LAPS, type DailyRecord, dailyNumber, loadDaily, msToNextDay, recordLap, shareText } from "./modes/daily";
import { GRADE_EMOJI, type Grade, gradeFor } from "./modes/grading";

const GRADE_TEXT: Record<Grade, string> = { purple: "text-purple", green: "text-green", yellow: "text-yellow", red: "text-kerb" };
import {
  type RoundOutcome,
  SEASON_LAPS,
  SEASON_ROUNDS,
  type SeasonStore,
  currentTrack,
  loadSeason,
  newSeason,
  recordSeasonLap,
  rivalMs,
  seasonDone,
} from "./modes/season";
import { type HubAction, Hub } from "./ui/Hub";
import { LapGrid } from "./ui/LapGrid";
import { RaceHud } from "./ui/RaceHud";
import { GateSlider } from "./ui/GateSlider";
import { ChevronLeft, ChevronRight, Frame, Minus, NudgeLeft, NudgeRight, Plus, Share, SoundOff, SoundOn, WholeTrack } from "./ui/icons";
import { PitBoard } from "./ui/PitBoard";
import { delta, lapTime } from "./ui/format";

type Screen = { kind: "hub" } | { kind: "play"; mode: Mode; trackId: string; nonce?: number };

function initialScreen(): Screen {
  const q = new URLSearchParams(location.search);
  const mode = q.get("play") as Mode | null;
  const track = q.get("track");
  if (mode === "practice" && CATALOG.some((t) => t.id === track)) return { kind: "play", mode, trackId: track! };
  return { kind: "hub" };
}

export function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [picking, setPicking] = useState(false);
  const [summary, setSummary] = useState(false);
  const [sound, setSound] = useState(soundEnabled);

  useEffect(() => {
    const url = new URL(location.href);
    url.search = "";
    if (screen.kind === "play" && screen.mode === "practice") {
      url.searchParams.set("play", "practice");
      url.searchParams.set("track", screen.trackId);
    }
    history.replaceState(null, "", url);
  }, [screen]);

  const act = (a: HubAction) => {
    if (a.kind === "daily") setScreen({ kind: "play", mode: "daily", trackId: loadDaily().trackId });
    else if (a.kind === "daily-summary") setSummary(true);
    else if (a.kind === "practice") setPicking(true);
    else {
      const store = a.fresh ? newSeason() : loadSeason();
      setScreen({ kind: "play", mode: "season", trackId: currentTrack(store.run!) });
    }
  };

  const toggleSound = () => {
    setSoundEnabled(!sound);
    setSound(!sound);
  };

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] overflow-hidden select-none">
      <header className="flex items-center justify-between gap-3 border-b border-white/5 bg-tarmac px-3 pt-[max(10px,env(safe-area-inset-top))] pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {screen.kind === "play" && (
            <button
              onClick={() => setScreen({ kind: "hub" })}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-white/12 text-paint hover:border-white/30"
              aria-label="Back to the grid"
            >
              <ChevronLeft />
            </button>
          )}
          <span className="font-display text-[26px] font-black leading-none tracking-[0.06em] text-paint">APEX</span>
          {screen.kind === "play" && (
            <span className="min-w-0 truncate font-display text-[19px] font-bold uppercase leading-none tracking-[0.04em] text-steel">
              / {MODE_LABEL[screen.mode]} · {CATALOG.find((t) => t.id === screen.trackId)?.name}
            </span>
          )}
        </div>
        <button
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label={sound ? "Engine sound on. Turn off" : "Engine sound off. Turn on"}
          title={sound ? "Sound on" : "Sound off"}
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border hover:border-white/30 ${sound ? "border-ink/60 text-ink" : "border-white/12 text-steel"}`}
        >
          {sound ? <SoundOn /> : <SoundOff />}
        </button>
      </header>

      <main className="relative min-h-0">
        {screen.kind === "hub" ? (
          <Hub onAction={act} />
        ) : (
          <Play
            key={`${screen.mode}:${screen.trackId}:${screen.nonce ?? 0}`}
            mode={screen.mode}
            trackId={screen.trackId}
            onNext={(trackId) => setScreen(trackId ? { kind: "play", mode: screen.mode, trackId, nonce: Date.now() } : { kind: "hub" })}
          />
        )}
      </main>

      {picking && (
        <TrackPicker
          current=""
          onPick={(id) => {
            setPicking(false);
            setScreen({ kind: "play", mode: "practice", trackId: id });
          }}
          onClose={() => setPicking(false)}
        />
      )}
      {summary && <DailySummary onClose={() => setSummary(false)} />}
    </div>
  );
}

const MODE_LABEL: Record<Mode, string> = { daily: "Quali", season: "Season", practice: "Practice" };

function useSnapshot(game: Game): Snapshot {
  return useSyncExternalStore(game.subscribe, game.getSnapshot);
}

/**
 * One session on one circuit. The mode controller lives here: it restores the
 * session from storage, persists every lap, and locks the game when the
 * session is over (6 daily laps, a won/lost season round).
 */
function Play({ mode, trackId, onNext }: { mode: Mode; trackId: string; onNext: (trackId: string | null) => void }) {
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [daily, setDaily] = useState<DailyRecord | null>(null);
  const [round, setRound] = useState<{ outcome: RoundOutcome; laps: Grade[][]; store: SeasonStore } | null>(null);
  const [practiceLaps, setPracticeLaps] = useState<Grade[][]>([]);

  useEffect(() => {
    let alive = true;
    loadTrack(trackId)
      .then((t) => {
        if (!alive) return;
        let g: Game;
        if (mode === "daily") {
          const rec = loadDaily();
          setDaily(rec);
          g = new Game(t, { mode, lapLimit: DAILY_LAPS, lapsUsed: rec.laps.length, startKnots: rec.knots, locked: rec.status !== "playing" });
          g.onLap = (lap) => {
            const next = recordLap(loadDaily(), { lapTimeMs: lap.lapTimeMs, grades: lap.grades }, lap.knots);
            setDaily(next);
            if (next.status !== "playing") g.lock();
          };
        } else if (mode === "season") {
          const store = loadSeason();
          const run = store.run!;
          const rival = rivalMs(t.optimalTimeMs!, run.results.length);
          setRound({ outcome: "continue", laps: [], store });
          g = new Game(t, { mode, lapLimit: SEASON_LAPS, lapsUsed: run.lapsUsed, rivalMs: rival, startKnots: run.knots });
          g.onLap = (lap) => {
            const { store: next, outcome } = recordSeasonLap(lap.lapTimeMs, rival, lap.knots);
            setRound((r) => ({ outcome, laps: [...(r?.laps ?? []), lap.grades], store: next }));
            if (outcome !== "continue") g.lock();
          };
        } else {
          g = new Game(t, { mode, lapLimit: null });
          g.onLap = (lap) => setPracticeLaps((p) => [...p, lap.grades].slice(-3));
        }
        setGame(g);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [mode, trackId]);

  if (!game) return <div className="grid h-full place-items-center font-mono text-sm text-steel">{error ?? "Loading circuit…"}</div>;
  return <GameView game={game} daily={daily} round={round} practiceLaps={practiceLaps} onNext={onNext} />;
}

type Round = { outcome: RoundOutcome; laps: Grade[][]; store: SeasonStore } | null;

function GameView({
  game,
  daily,
  round,
  practiceLaps,
  onNext,
}: {
  game: Game;
  daily: DailyRecord | null;
  round: Round;
  practiceLaps: Grade[][];
  onNext: (trackId: string | null) => void;
}) {
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
        else if (s.phase === "result" && !s.locked) game.adjust();
      } else if (k === "Escape" && (s.phase === "race" || s.phase === "lights")) game.skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, s.phase, s.locked]);

  const groupNames = game.controls.complexes.map((c) => c.name);
  // Laps shown on the result board: the whole session for daily/season.
  const lapRows = s.mode === "daily" ? (daily?.laps.map((l) => l.grades) ?? []) : s.mode === "season" ? (round?.laps ?? []) : practiceLaps;

  return (
    <>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label={`${game.track.name} circuit`} />
      {s.phase === "setup" && !s.locked && <ViewControls game={game} />}
      {s.phase === "setup" && !s.locked && <SetupPanel s={s} game={game} />}
      {s.phase === "setup" && s.locked && daily && <LockedNote daily={daily} game={game} onHub={() => onNext(null)} />}
      {(s.phase === "race" || s.phase === "lights") && <RaceHud s={s} onSkip={() => game.skip()} groupNames={groupNames} />}
      {s.phase === "result" && s.result && (
        <ResultPanel s={s} game={game} lapRows={lapRows} daily={daily} round={round} onNext={onNext} groupNames={groupNames} />
      )}
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
      <button className={c} onClick={() => game.zoom(1.4)} aria-label="Zoom in" title="Zoom in">
        <Plus />
      </button>
      <button className={c} onClick={() => game.zoom(1 / 1.4)} aria-label="Zoom out" title="Zoom out">
        <Minus />
      </button>
      <button className={c} onClick={() => game.showOverview()} aria-label="Show the whole track" title="Whole track">
        <WholeTrack />
      </button>
      <button className={c} onClick={() => game.recenter()} aria-label="Back to the selected corner" title="Back to corner">
        <Frame />
      </button>
    </div>
  );
}

/** Compact chip text; the selected chip (and small groups) spell the label out. */
function gateChip(g: { label: string; corner?: string }, selected: boolean, count: number): React.ReactNode {
  const full = selected || count <= 4;
  if (g.label === "Apex") return full ? `APEX ${g.corner ?? ""}`.trim() : (g.corner ?? "A");
  if (g.label === "Turn-in") return full ? "TURN-IN" : "IN";
  if (g.label === "Exit") return full ? "EXIT" : "OUT";
  if (g.label === "Approach") return full ? "APPROACH" : "APP";
  if (g.label === "Track-out") return full ? "TRACK-OUT" : "TO";
  return full ? "MID" : <span className="block h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />;
}

function SetupPanel({ s, game }: { s: Snapshot; game: Game }) {
  const ref = useInset(game, "bottom");
  const cx = game.controls.complexes[s.complex];
  const total = game.controls.complexes.length;
  const inside = cx.direction === "mixed" ? null : cx.direction;
  const first = s.attempts === 0 && s.lapsUsed === 0;
  const nav = "grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/12 font-mono text-lg text-paint hover:border-white/30";
  return (
    <div ref={ref} className="absolute inset-x-0 bottom-0 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-lg rounded-lg border border-white/10 bg-board/92 p-3 backdrop-blur-sm">
        <SessionStrip s={s} />
        <div className="flex items-center gap-2">
          <button className={nav} onClick={() => game.stepComplex(-1)} aria-label="Previous corner">
            <ChevronLeft />
          </button>
          <div className="min-w-0 flex-1 text-center leading-none">
            <div className="font-display text-[26px] font-black tracking-[0.04em] text-paint">{cx.name}</div>
            <div className="mt-1 font-mono text-[10px] tracking-[0.14em] text-steel">
              CORNER {s.complex + 1} OF {total}
            </div>
          </div>
          <button className={nav} onClick={() => game.stepComplex(1)} aria-label="Next corner">
            <ChevronRight />
          </button>
        </div>

        <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] min-[420px]:justify-center" role="tablist" aria-label="Points in this corner">
          {cx.gates.map((g, i) => (
            <button
              key={g.knot}
              role="tab"
              aria-selected={i === s.gate}
              onClick={() => game.selectGate(s.complex, i)}
              aria-label={g.label === "Apex" && g.corner ? `Apex ${g.corner}` : g.label}
              className={`grid h-8 min-w-8 shrink-0 place-items-center rounded-full border px-2.5 font-mono text-[11px] tracking-[0.06em] ${
                i === s.gate ? "border-ink bg-ink text-board" : "border-white/15 text-paint/80 hover:border-white/35"
              }`}
            >
              {gateChip(g, i === s.gate, cx.gates.length)}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button className={nav} onClick={() => game.nudge(0.05)} aria-label="Move 5 cm left">
            <NudgeLeft />
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
            <NudgeRight />
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
          {s.pbMs !== null && s.mode === "practice" && (
            <button className={btn} onClick={() => game.loadBest()}>
              Best line
            </button>
          )}
          <button className={`${primary} flex-1`} onClick={() => game.race()}>
            Lights out
          </button>
        </div>
      </div>
    </div>
  );
}

function SessionStrip({ s }: { s: Snapshot }) {
  if (s.mode === "practice") return null;
  const lap = Math.min(s.lapsUsed + 1, s.lapLimit ?? 0);
  return (
    <div className="mb-2.5 flex items-center justify-between border-b border-white/8 pb-2 font-mono text-[10px] tracking-[0.14em] text-steel">
      <span>{s.mode === "daily" ? `QUALI #${dailyNumber()}` : `RIVAL POLE ${lapTime(s.rivalMs ?? 0)}`}</span>
      <span className="flex items-center gap-1.5">
        LAP {lap} / {s.lapLimit}
        <span className="flex gap-0.5" aria-hidden="true">
          {Array.from({ length: s.lapLimit ?? 0 }, (_, i) => (
            <span key={i} className={`h-2 w-2 rounded-full ${i < s.lapsUsed ? "bg-steel/50" : i === s.lapsUsed ? "bg-ink" : "bg-white/15"}`} />
          ))}
        </span>
      </span>
    </div>
  );
}

function useCountdown() {
  const [left, setLeft] = useState(() => msToNextDay());
  useEffect(() => {
    const t = setInterval(() => setLeft(msToNextDay()), 1000);
    return () => clearInterval(t);
  }, []);
  const x = Math.floor(left / 1000);
  return `${String(Math.floor(x / 3600)).padStart(2, "0")}:${String(Math.floor((x % 3600) / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
}

function ShareButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }
    } catch {
      /* share sheet dismissed */
    }
  };
  return (
    <button className={`${primary} flex flex-1 items-center justify-center gap-2`} onClick={share}>
      <Share className="h-5 w-5" /> {done ? "Copied" : "Share"}
    </button>
  );
}

function ResultPanel({
  s,
  game,
  lapRows,
  daily,
  round,
  onNext,
  groupNames,
}: {
  s: Snapshot;
  game: Game;
  lapRows: Grade[][];
  daily: DailyRecord | null;
  round: Round;
  onNext: (trackId: string | null) => void;
  groupNames: string[];
}) {
  const r = s.result!;
  const worst = r.losses.filter((l) => l.deltaMs > 50 && l.complex >= 0).slice(0, 3);
  const wide = typeof window !== "undefined" && window.innerWidth >= 720;
  const ref = useInset(game, wide ? "right" : "bottom");
  const countdown = useCountdown();
  const info = CATALOG.find((t) => t.id === game.track.id)!;
  const total = s.mode === "daily" ? DAILY_LAPS : s.mode === "season" ? SEASON_LAPS : Math.max(1, lapRows.length);

  let headline: string;
  let body: string;
  let actions: React.ReactNode;
  if (s.mode === "daily" && daily && daily.status !== "playing") {
    headline = daily.status === "won" ? "Perfect lap" : "Out of laps";
    body = daily.status === "won" ? `Every corner purple on lap ${daily.laps.length} of ${DAILY_LAPS}.` : `The perfect lap was ${lapTime(r.targetMs)}. New circuit in ${countdown}.`;
    actions = (
      <>
        <ShareButton text={shareText(daily, info.name, info.flag, GRADE_EMOJI)} />
        <button className={btn} onClick={() => onNext(null)}>
          Grid
        </button>
      </>
    );
  } else if (s.mode === "season" && round && round.outcome !== "continue") {
    const run = round.store.run!;
    const done = seasonDone(run);
    const wins = run.results.filter((x) => x === "W").length;
    headline = round.outcome === "won" ? "Pole position" : "Rival keeps pole";
    body = done
      ? wins === SEASON_ROUNDS
        ? "12–0. The perfect season. You did the impossible."
        : `Season over: ${wins}–${run.results.length - wins}. The perfect season is still out there.`
      : `Season ${wins}–${run.results.length - wins} after round ${run.results.length} of ${SEASON_ROUNDS}.`;
    actions = done ? (
      <>
        <button className={`${primary} flex-1`} onClick={() => onNext(currentTrack(newSeason().run!))}>
          New season
        </button>
        <button className={btn} onClick={() => onNext(null)}>
          Grid
        </button>
      </>
    ) : (
      <button className={`${primary} flex-1`} onClick={() => onNext(currentTrack(loadSeason().run!))}>
        Next race
      </button>
    );
  } else {
    headline = r.allPurple ? "Perfect lap" : s.mode === "practice" ? "Lap complete" : `${(s.lapLimit ?? 0) - s.lapsUsed} laps left`;
    body = r.allPurple
      ? "Every corner purple."
      : s.mode === "season"
        ? `Beat ${lapTime(s.rivalMs ?? 0)} to take pole.`
        : "Purple every corner for the perfect lap. Tap a corner to fix it.";
    actions = (
      <button className={`${primary} flex-1`} onClick={() => game.adjust()} autoFocus>
        Improve line
      </button>
    );
  }

  return (
    <div
      ref={ref}
      className="absolute inset-x-0 bottom-0 flex max-h-full flex-col gap-2 overflow-y-auto p-3 pb-[max(12px,env(safe-area-inset-bottom))] min-[720px]:inset-x-auto min-[720px]:top-0 min-[720px]:right-0 min-[720px]:w-[400px] min-[720px]:justify-center min-[720px]:p-6"
    >
      <PitBoard r={r} rivalMs={s.mode === "season" ? s.rivalMs : null} />
      <div className="rise rounded-lg border border-white/10 bg-board/92 p-3 backdrop-blur-sm [animation-delay:200ms]">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[26px] font-black uppercase leading-none tracking-[0.03em] text-paint">{headline}</h2>
          {s.mode !== "practice" && (
            <span className="font-mono text-[11px] tracking-[0.1em] text-steel">
              {lapRows.length}/{total}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[14px] leading-snug text-paint/80">{body}</p>
        <div className="mt-2.5">
          <LapGrid rows={lapRows} total={total} cols={groupNames.length} labels={groupNames} />
        </div>
        {!s.locked && worst.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {worst.map((l) => (
              <button key={l.name} onClick={() => game.adjust(l.name)} className="rounded-md border border-white/15 px-2 py-2 font-mono text-[13px] whitespace-nowrap hover:border-white/40">
                <span className="font-medium text-paint">{l.name}</span> <span className={GRADE_TEXT[gradeFor(l.deltaMs)]}>{delta(l.deltaMs)}</span>
              </button>
            ))}
          </div>
        )}
        <Legend />
        <div className="mt-3 flex gap-2">{actions}</div>
      </div>
    </div>
  );
}

/** Daily already finished today: the circuit stays visible, with the result and a way out. */
function LockedNote({ daily, game, onHub }: { daily: DailyRecord; game: Game; onHub: () => void }) {
  const countdown = useCountdown();
  const info = CATALOG.find((t) => t.id === game.track.id)!;
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-center p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-lg rounded-lg border border-white/10 bg-board/92 p-3">
        <h2 className="font-display text-[26px] font-black uppercase leading-none text-paint">{daily.status === "won" ? "Perfect lap" : "Out of laps"}</h2>
        <p className="mt-1.5 text-[14px] text-paint/80">New circuit in {countdown}.</p>
        <div className="mt-3">
          <LapGrid rows={daily.laps.map((l) => l.grades)} total={DAILY_LAPS} cols={game.controls.complexes.length} />
        </div>
        <div className="mt-3 flex gap-2">
          <ShareButton text={shareText(daily, info.name, info.flag, GRADE_EMOJI)} />
          <button className={btn} onClick={onHub}>
            Grid
          </button>
        </div>
      </div>
    </div>
  );
}

/** Hub overlay for a finished daily: grid, share, countdown. */
function DailySummary({ onClose }: { onClose: () => void }) {
  const daily = loadDaily();
  const info = CATALOG.find((t) => t.id === daily.trackId)!;
  const countdown = useCountdown();
  const cols = daily.laps[0]?.grades.length ?? 8;
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div role="dialog" aria-label="Today's result" className="rise w-full max-w-sm rounded-lg border border-white/10 bg-board p-4" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono text-[11px] tracking-[0.12em] text-steel">
          QUALI #{dailyNumber()} · {info.name.toUpperCase()}
        </p>
        <h2 className="mt-1 font-display text-[30px] font-black uppercase leading-none text-paint">{daily.status === "won" ? `Perfect on lap ${daily.laps.length}` : "Out of laps"}</h2>
        <div className="mt-3">
          <LapGrid rows={daily.laps.map((l) => l.grades)} total={DAILY_LAPS} cols={cols} />
        </div>
        <p className="mt-3 text-[14px] text-paint/80">Next circuit in {countdown}.</p>
        <div className="mt-3 flex gap-2">
          <ShareButton text={shareText(daily, info.name, info.flag, GRADE_EMOJI)} />
          <button className={btn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["bg-purple", "perfect ≤.05s"],
    ["bg-green", "≤0.15s"],
    ["bg-yellow", "≤0.4s"],
    ["bg-kerb", "more"],
  ];
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.06em] whitespace-nowrap text-steel">
      {items.map(([c, t]) => (
        <span key={t} className="flex items-center gap-1.5">
          <span className={`h-1 w-4 shrink-0 rounded-full ${c}`} />
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
