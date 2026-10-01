import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { setSoundEnabled, soundEnabled } from "./game/audio";
import { CATALOG, loadTrack } from "./game/catalog";
import { OUTLINES } from "./game/outlines";
import { Game, type Mode, type Snapshot } from "./game/game";
import { DAILY_LAPS, type DailyRecord, dailyNumber, loadDaily, msToNextDay, recordLap, shareText } from "./modes/daily";
import { GRADE_EMOJI, type Grade, gradeFor } from "./modes/grading";
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
import { CornerTower } from "./ui/CornerTower";
import { GateSlider } from "./ui/GateSlider";
import { type HubAction, Hub } from "./ui/Hub";
import { LapGrid } from "./ui/LapGrid";
import { RaceHud } from "./ui/RaceHud";
import { Roll } from "./ui/Roll";
import { delta, lapTime } from "./ui/format";
import { ChevronLeft, Frame, Minus, NudgeLeft, NudgeRight, Plus, Share, SoundOff, SoundOn, Undo, WholeTrack } from "./ui/icons";
import { iconBtn, primaryBtn, secondaryBtn } from "./ui/styles";

const GRADE_TEXT: Record<Grade, string> = { purple: "text-purple", green: "text-green", yellow: "text-yellow", red: "text-kerb" };

type Screen = { kind: "hub" } | { kind: "play"; mode: Mode; trackId: string; nonce?: number };

function initialScreen(): Screen {
  const q = new URLSearchParams(location.search);
  const mode = q.get("play") as Mode | null;
  const track = q.get("track");
  if (mode === "practice" && CATALOG.some((t) => t.id === track)) return { kind: "play", mode, trackId: track! };
  return { kind: "hub" };
}

const MODE_LABEL: Record<Mode, string> = { daily: "Daily quali", season: "Perfect season", practice: "Free practice" };

export function App() {
  const [screen, setScreenNow] = useState<Screen>(initialScreen);
  // Grid <-> circuit goes through the cut (a slanted wipe) where view transitions exist.
  const setScreen = (next: Screen) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (!doc.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return setScreenNow(next);
    doc.startViewTransition(() => flushSync(() => setScreenNow(next)));
  };
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
    else if (a.kind === "practice-track") setScreen({ kind: "play", mode: "practice", trackId: a.trackId });
    else {
      const store = a.fresh ? newSeason() : loadSeason();
      setScreen({ kind: "play", mode: "season", trackId: currentTrack(store.run!) });
    }
  };

  const toggleSound = () => {
    setSoundEnabled(!sound);
    setSound(!sound);
  };

  const track = screen.kind === "play" ? CATALOG.find((t) => t.id === screen.trackId) : null;

  return (
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr] overflow-hidden select-none">
      <header className="flex h-[52px] items-stretch justify-between border-b border-line bg-night pt-[env(safe-area-inset-top)]">
        <div className="flex min-w-0 items-stretch">
          {screen.kind === "play" && (
            <button onClick={() => setScreen({ kind: "hub" })} className="back grid w-12 shrink-0 place-items-center border-r border-line text-paint transition-colors hover:bg-graphite active:bg-graphite" aria-label="Back to the grid">
              <ChevronLeft />
            </button>
          )}
          <div className="flex min-w-0 items-center gap-3 px-3">
            <span className="wide text-[20px] leading-none tracking-[0.02em] text-paint">
              APEX<span className="text-steel">/</span>
            </span>
            {track && screen.kind === "play" && (
              <div className="min-w-0 leading-tight">
                <div className="caption truncate">{MODE_LABEL[screen.mode]}</div>
                <div className="truncate text-[14px] font-bold text-paint">{track.name}</div>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label={sound ? "Engine sound on. Turn off" : "Engine sound off. Turn on"}
          title={sound ? "Sound on" : "Sound off"}
          className={`grid w-12 shrink-0 place-items-center border-l border-line hover:bg-graphite ${sound ? "text-ink" : "text-steel"}`}
        >
          {sound ? <SoundOn /> : <SoundOff />}
        </button>
      </header>

      <main className="relative min-h-0 [view-transition-name:stage]">
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

/** While the circuit loads, its outline draws itself where the map will be. */
function Loading({ trackId, error }: { trackId: string; error: string | null }) {
  const o = OUTLINES[trackId];
  return (
    <div className="grid h-full place-items-center content-center gap-4 px-6 text-center">
      {o && !error && (
        <svg viewBox="0 0 1000 1000" className="hero-map h-40 w-40" aria-hidden="true">
          <path className="draw draw-1 loading-loop" pathLength={1} d={o.outline} fill="none" stroke="#9aa1ab" strokeWidth={26} strokeLinejoin="round" />
        </svg>
      )}
      <p className={`text-[14px] ${error ? "text-paint" : "text-steel"}`} role="status">
        {error ? `This circuit did not load: ${error}. Go back to the grid and try again.` : `Loading ${CATALOG.find((t) => t.id === trackId)?.name ?? "the circuit"}`}
      </p>
    </div>
  );
}

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
  const [round, setRound] = useState<Round>(null);
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

  if (!game) return <Loading trackId={trackId} error={error} />;
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
  const tower = useRef<HTMLDivElement>(null);
  const s = useSnapshot(game);

  useEffect(() => {
    game.attach(canvas.current!);
    return () => game.detach();
  }, [game]);

  // the tower owns the left edge: keep the camera's subject clear of it
  useEffect(() => {
    const el = tower.current;
    if (!el) return;
    const ro = new ResizeObserver(() => game.setInsets({ left: el.getBoundingClientRect().width + 8 }));
    ro.observe(el);
    return () => ro.disconnect();
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

  const names = game.controls.complexes.map((c) => c.name);
  const lapRows = s.mode === "daily" ? (daily?.laps.map((l) => l.grades) ?? []) : s.mode === "season" ? (round?.laps ?? []) : practiceLaps;
  const racing = s.phase === "race" || s.phase === "lights";
  const showGrades = s.grades && (s.phase === "result" || s.phase === "setup");
  const rows = names.map((name, i) => {
    const g = s.grades?.[i];
    const visible = g && (showGrades || (racing && i < s.revealed));
    return { name, grade: visible ? g.grade : null, deltaMs: visible ? g.deltaMs : null };
  });
  const lap = Math.min(s.lapsUsed + (s.phase === "result" ? 0 : 1), s.lapLimit ?? Infinity);
  const header = s.lapLimit !== null ? `Lap ${Math.max(1, lap)}/${s.lapLimit}` : "Practice";

  return (
    <>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-label={`${game.track.name} circuit`} />
      <div ref={tower} className="absolute top-2 left-2">
        <CornerTower
          rows={rows}
          active={s.activeGroup}
          header={header}
          live={racing}
          onSelect={s.phase === "setup" && !s.locked ? (i) => game.selectGate(i, 0) : s.phase === "result" && !s.locked ? (i) => game.adjust(game.controls.complexes[i].corners[0]) : undefined}
        />
      </div>
      {s.phase === "setup" && !s.locked && <ViewControls game={game} />}
      {s.phase === "setup" && !s.locked && <ControlBar s={s} game={game} />}
      {s.phase === "setup" && s.locked && daily && <LockedNote daily={daily} game={game} onHub={() => onNext(null)} />}
      {racing && <RaceHud s={s} onSkip={() => game.skip()} />}
      {s.phase === "result" && s.result && <ResultSheet s={s} game={game} lapRows={lapRows} daily={daily} round={round} onNext={onNext} names={names} />}
    </>
  );
}

/** Reports a panel's size to the game so the camera frames around it. */
function useInset(game: Game, side: "bottom" | "right") {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
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
  }, [game, side]);
  return ref;
}

function ViewControls({ game }: { game: Game }) {
  return (
    <div className="absolute top-[140px] right-2 flex flex-col">
      <button className={`${iconBtn} border-b-0`} onClick={() => game.zoom(1.4)} aria-label="Zoom in" title="Zoom in">
        <Plus />
      </button>
      <button className={`${iconBtn} border-b-0`} onClick={() => game.zoom(1 / 1.4)} aria-label="Zoom out" title="Zoom out">
        <Minus />
      </button>
      <button className={`${iconBtn} border-b-0`} onClick={() => game.showOverview()} aria-label="Show the whole track" title="Whole track">
        <WholeTrack />
      </button>
      <button className={iconBtn} onClick={() => game.recenter()} aria-label="Back to the selected corner" title="Back to corner">
        <Frame />
      </button>
    </div>
  );
}

/** Segment text; the selected segment (and small groups) spell the label out. */
function gateLabel(g: { label: string; corner?: string }, selected: boolean, count: number): React.ReactNode {
  const full = selected || count <= 4;
  if (g.label === "Apex") return full ? `Apex ${g.corner ?? ""}`.trim() : (g.corner ?? "A");
  if (g.label === "Turn-in") return full ? "Turn-in" : "In";
  if (g.label === "Exit") return full ? "Exit" : "Out";
  if (g.label === "Approach") return full ? "Approach" : "App";
  if (g.label === "Track-out") return full ? "Track-out" : "TO";
  return full ? "Mid" : <span className="block h-1.5 w-1.5 bg-current" aria-hidden="true" />;
}

/**
 * Setup controls as a lower-third: the corner and point in one line, the
 * points as a segmented strip, the precision slider, and the start.
 */
function ControlBar({ s, game }: { s: Snapshot; game: Game }) {
  const ref = useInset(game, "bottom");
  const cx = game.controls.complexes[s.complex];
  const inside = cx.direction === "mixed" ? null : cx.direction;
  const gate = cx.gates[s.gate];
  return (
    <div ref={ref} className="absolute inset-x-0 bottom-0 flex justify-center min-[720px]:px-3 min-[720px]:pb-3">
      <div className="wipe-in w-full max-w-[560px] border-t border-line bg-night/94 px-3 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-[3px] min-[720px]:border">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="wide truncate text-[20px] leading-none text-paint">
            {cx.name}
            <span className="ml-2 text-[13px] text-ink">{gate.label === "Apex" && gate.corner ? `Apex ${gate.corner}` : gate.label}</span>
          </h2>
          <span className="caption num shrink-0">
            Corner {s.complex + 1} of {game.controls.complexes.length}
          </span>
        </div>

        <div className="mt-2.5 flex overflow-x-auto border border-line [scrollbar-width:none]" role="tablist" aria-label="Points in this corner">
          {cx.gates.map((g, i) => (
            <button
              key={g.knot}
              role="tab"
              aria-selected={i === s.gate}
              aria-label={g.label === "Apex" && g.corner ? `Apex ${g.corner}` : g.label}
              onClick={() => game.selectGate(s.complex, i)}
              className={`grid h-9 min-w-10 shrink-0 place-items-center border-r border-line px-2.5 text-[12px] font-bold whitespace-nowrap uppercase tracking-[0.04em] last:border-r-0 [font-stretch:85%] ${cx.gates.length <= 5 ? "flex-1" : "flex-none"} ${
                i === s.gate ? "bg-paint text-night" : "text-paint/80 hover:bg-graphite"
              }`}
            >
              {gateLabel(g, i === s.gate, cx.gates.length)}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button className={iconBtn} onClick={() => game.nudge(0.05)} aria-label="Move 5 cm left">
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
          <button className={iconBtn} onClick={() => game.nudge(-0.05)} aria-label="Move 5 cm right">
            <NudgeRight />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button className={iconBtn} onClick={() => game.undo()} disabled={!s.canUndo} aria-label="Undo" title="Undo">
            <Undo />
          </button>
          {s.pbMs !== null && s.mode === "practice" && (
            <button className={secondaryBtn} onClick={() => game.loadBest()}>
              Best line
            </button>
          )}
          <button className={`${primaryBtn} flex-1`} onClick={() => game.race()}>
            Lights out
          </button>
        </div>
      </div>
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
    <button className={`${primaryBtn} flex-1`} onClick={share}>
      <Share className="h-4 w-4" /> {done ? "Copied" : "Share result"}
    </button>
  );
}

/** One timing line: label left, value right. */
function TimingLine({ label, value, tone = "text-paint", order = 0 }: { label: string; value: string; tone?: string; order?: number }) {
  return (
    <div style={{ "--d": `${640 + order * 90}ms` } as React.CSSProperties} className="rise flex items-baseline justify-between gap-3 border-t border-line py-1.5">
      <span className="caption">{label}</span>
      <span className={`num text-[15px] font-bold ${tone}`}>{value}</span>
    </div>
  );
}

function ResultSheet({
  s,
  game,
  lapRows,
  daily,
  round,
  onNext,
  names,
}: {
  s: Snapshot;
  game: Game;
  lapRows: Grade[][];
  daily: DailyRecord | null;
  round: Round;
  onNext: (trackId: string | null) => void;
  names: string[];
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
    body = daily.status === "won" ? `Every corner purple on lap ${daily.laps.length} of ${DAILY_LAPS}.` : `New circuit in ${countdown}.`;
    actions = (
      <>
        <ShareButton text={shareText(daily, info.name, info.flag, GRADE_EMOJI)} />
        <button className={secondaryBtn} onClick={() => onNext(null)}>
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
        ? "12-0. The perfect season."
        : `Season over at ${wins}-${run.results.length - wins}. The perfect season is still out there.`
      : `Season ${wins}-${run.results.length - wins} after round ${run.results.length} of ${SEASON_ROUNDS}.`;
    actions = done ? (
      <>
        <button className={`${primaryBtn} flex-1`} onClick={() => onNext(currentTrack(newSeason().run!))}>
          New season
        </button>
        <button className={secondaryBtn} onClick={() => onNext(null)}>
          Grid
        </button>
      </>
    ) : (
      <button className={`${primaryBtn} flex-1`} onClick={() => onNext(currentTrack(loadSeason().run!))}>
        Next race
      </button>
    );
  } else {
    const left = (s.lapLimit ?? 0) - s.lapsUsed;
    headline = r.allPurple ? "Perfect lap" : s.mode === "practice" ? "Lap complete" : `${left} ${left === 1 ? "lap" : "laps"} left`;
    body = r.allPurple ? "Every corner purple." : s.mode === "season" ? `Beat ${lapTime(s.rivalMs ?? 0)} to take pole.` : "Tap a corner to fix it.";
    actions = (
      <button className={`${primaryBtn} flex-1`} onClick={() => game.adjust()} autoFocus>
        Improve line
      </button>
    );
  }

  const vsRival = s.mode === "season" && s.rivalMs !== null ? r.lapTimeMs - s.rivalMs : null;
  const pbDelta = r.pbBeforeMs === null ? null : r.lapTimeMs - r.pbBeforeMs;

  return (
    <div
      ref={ref}
      className="absolute inset-x-0 bottom-0 max-h-[78%] overflow-y-auto min-[720px]:inset-x-auto min-[720px]:top-2 min-[720px]:right-2 min-[720px]:bottom-2 min-[720px]:max-h-none min-[720px]:w-[380px]"
    >
      <div className="wipe-in border-t border-line bg-night/95 px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-[3px] min-[720px]:h-full min-[720px]:border">
        {/* timing card */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="caption">Lap time</div>
            <Roll text={lapTime(r.lapTimeMs)} className="wide text-[34px] text-paint" />
          </div>
          <div className={`plate-in cut-l num px-3 py-1.5 text-[15px] font-bold ${r.allPurple ? "bg-purple text-night" : "bg-graphite text-paint"}`}>
            {r.allPurple ? "Perfect" : delta(r.deltaTargetMs)}
          </div>
        </div>
        <div className="mt-2">
          <TimingLine label="Perfect lap" value={lapTime(r.targetMs)} />
          {vsRival !== null && <TimingLine order={1} label={`Rival pole ${lapTime(s.rivalMs!)}`} value={delta(vsRival)} tone={vsRival < 0 ? "text-ink" : "text-paint"} />}
          <TimingLine
            order={2}
            label={pbDelta === null ? "Personal best" : r.newPb ? "New personal best" : "Personal best"}
            value={pbDelta === null ? "First lap" : delta(pbDelta)}
            tone={pbDelta === null || r.newPb ? "text-ink" : "text-paint"}
          />
        </div>

        {/* outcome and the lap board */}
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
          <h2 className="wide text-[20px] leading-none text-paint">{headline}</h2>
          {s.mode !== "practice" && (
            <span className="caption num">
              Lap {lapRows.length} of {total}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[14px] leading-snug text-paint/75">{body}</p>
        <div className="mt-2.5">
          <LapGrid rows={lapRows} total={total} cols={names.length} labels={names} revealLast />
        </div>
        {!s.locked && worst.length > 0 && (
          <div className="mt-3 grid grid-cols-3 border border-line">
            {worst.map((l) => (
              <button key={l.name} onClick={() => game.adjust(l.name)} className="border-r border-line px-2 py-2 text-left last:border-r-0 hover:bg-graphite">
                <span className="block text-[13px] font-bold text-paint [font-stretch:85%]">{l.name}</span>
                <span className={`num block text-[13px] font-semibold ${GRADE_TEXT[gradeFor(l.deltaMs)]}`}>{delta(l.deltaMs)}</span>
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
    <div className="absolute inset-x-0 bottom-0 flex justify-center">
      <div className="wipe-in w-full max-w-[560px] border-t border-line bg-night/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <h2 className="wide text-[20px] leading-none text-paint">{daily.status === "won" ? "Perfect lap" : "Out of laps"}</h2>
        <p className="mt-1.5 text-[14px] text-paint/75">New circuit in {countdown}.</p>
        <div className="mt-3">
          <LapGrid rows={daily.laps.map((l) => l.grades)} total={DAILY_LAPS} cols={game.controls.complexes.length} />
        </div>
        <div className="mt-3 flex gap-2">
          <ShareButton text={shareText(daily, info.name, info.flag, GRADE_EMOJI)} />
          <button className={secondaryBtn} onClick={onHub}>
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
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-night/75 p-4" onClick={onClose}>
      <div role="dialog" aria-label="Today's result" className="wipe-in w-full max-w-sm border border-line bg-board p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="wide text-[20px] leading-none text-paint">{daily.status === "won" ? `Perfect on lap ${daily.laps.length}` : "Out of laps"}</h2>
        <p className="mt-1.5 text-[14px] text-paint/75">
          Daily quali #{dailyNumber()}, {info.name}. Next circuit in {countdown}.
        </p>
        <div className="mt-3">
          <LapGrid rows={daily.laps.map((l) => l.grades)} total={DAILY_LAPS} cols={cols} />
        </div>
        <div className="mt-3 flex gap-2">
          <ShareButton text={shareText(daily, info.name, info.flag, GRADE_EMOJI)} />
          <button className={secondaryBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["bg-purple", "Perfect"],
    ["bg-green", "Within 0.15s"],
    ["bg-yellow", "Within 0.4s"],
    ["bg-kerb", "Slower"],
  ];
  return (
    <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
      {items.map(([c, t]) => (
        <span key={t} className="caption flex items-center gap-1.5 whitespace-nowrap">
          <span className={`h-2 w-2 shrink-0 ${c}`} />
          {t}
        </span>
      ))}
    </div>
  );
}

function TrackPicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center bg-night/75 p-4 pt-16" onClick={onClose}>
      <div role="dialog" aria-label="Choose a circuit" className="wipe-in w-full max-w-sm border border-line bg-board" onClick={(e) => e.stopPropagation()}>
        <div className="wide border-b border-line px-4 py-3 text-[15px] text-paint">Choose a circuit</div>
        <ul className="max-h-[70dvh] overflow-y-auto">
          {CATALOG.map((t, i) => (
            <li key={t.id} className="border-b border-line/70 last:border-b-0">
              <button onClick={() => onPick(t.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-graphite">
                <span className="cut-l num grid h-6 w-7 shrink-0 place-items-center bg-graphite text-[11px] font-bold text-steel">{i + 1}</span>
                <span className="wide flex-1 truncate text-[15px] text-paint">{t.name}</span>
                <span className="caption">{t.country}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
