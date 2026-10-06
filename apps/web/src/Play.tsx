import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CATALOG, loadScenery, loadTrack } from "./game/catalog";
import { type Condition, LINE_STYLES, type LineStyle } from "@apex/engine";
import { Game, type MapView, type Mode, type Snapshot } from "./game/game";
import { DAILY_HINT_AFTER_LAPS, DAILY_LAPS, type DailyRecord, bestMedal, conditionOf, recordHint, loadDaily, recordLap } from "./modes/daily";
import { type Grade, gradeFor } from "./modes/grading";
import { type RoundOutcome, SEASON_LAPS, SEASON_ROUNDS, type SeasonStore, currentTrack, loadSeason, newSeason, recordSeasonLap, rivalMs, seasonDone } from "./modes/season";
import { CornerTower } from "./ui/CornerTower";
import { GateSlider } from "./ui/GateSlider";
import { LapGrid } from "./ui/LapGrid";
import { RaceHud, SectorCells } from "./ui/RaceHud";
import { SpeedTrace } from "./ui/SpeedTrace";
import { MedalDisc, MedalRow } from "./ui/Medals";
import { MEDAL_COLOR, MEDAL_NAME, medalFor, realPole } from "./modes/medals";
import { challengeUrl } from "./modes/challenge";
import { Roll } from "./ui/Roll";
import { delta, lapTime } from "./ui/format";
import { ChevronRight, Frame, Minus, NudgeLeft, NudgeRight, Plus, Undo, WholeTrack } from "./ui/icons";
import { iconBtn, primaryBtn, secondaryBtn } from "./ui/styles";
import { Loading, ShareButton, StandingLine, boardOf, dailyShare, dayHeadline, useCountdown } from "./Dialogs";
import { submitDailyLine } from "./online";
import { CORNER_MEDAL_MS, type CornerWeek, cornerMedal, cornerShare, daysLeft, loadCornerWeek, recordCornerRun, weekNumber, weeklyCorner } from "./modes/corner";

const GRADE_TEXT: Record<Grade, string> = { purple: "text-purple", green: "text-green", yellow: "text-yellow", red: "text-kerb" };

function useSnapshot(game: Game): Snapshot {
  return useSyncExternalStore(game.subscribe, game.getSnapshot);
}

/**
 * One session on one circuit. The mode controller lives here: it restores the
 * session from storage, persists every lap, and locks the game when the
 * session is over (6 daily laps, a won/lost season round).
 */
export function Play({
  mode,
  trackId,
  challenge,
  watch,
  day,
  condition,
  onNext,
}: {
  mode: Mode;
  trackId: string;
  challenge?: number[];
  /** open straight into the perfect-lap demo (a finished daily) */
  watch?: boolean;
  /** a past daily from the archive (YYYY-MM-DD): played the same way, kept apart, unranked */
  day?: string;
  /** practice conditions (the daily's come from the day) */
  condition?: Condition;
  onNext: (trackId: string | null) => void;
}) {
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [daily, setDaily] = useState<DailyRecord | null>(null);
  const [round, setRound] = useState<Round>(null);
  const [practiceLaps, setPracticeLaps] = useState<Grade[][]>([]);
  const [week, setWeek] = useState<CornerWeek | null>(() => (mode === "corner" ? loadCornerWeek() : null));

  useEffect(() => {
    let alive = true;
    Promise.all([loadTrack(trackId), loadScenery(trackId).catch(() => null)])
      .then(([t, scenery]) => {
        if (!alive) return;
        let g: Game;
        if (mode === "daily") {
          const rec = loadDaily(day, !!day);
          setDaily(rec);
          g = new Game(t, { scenery, mode, lapLimit: DAILY_LAPS, lapsUsed: rec.laps.length, startKnots: rec.knots, locked: rec.status !== "playing", condition: conditionOf(rec) });
          g.onLap = (lap) => {
            const next = recordLap(loadDaily(day, !!day), { lapTimeMs: lap.lapTimeMs, grades: lap.grades }, lap.knots);
            // today's best line goes on the board (the server times it); archive replays don't
            const board = boardOf(next);
            if (board) void submitDailyLine(board, next.bestKnots ?? lap.knots);
            setDaily(next);
            if (next.status !== "playing") g.lock();
          };
        } else if (mode === "season") {
          const store = loadSeason();
          const run = store.run!;
          const rival = rivalMs(t.optimalTimeMs!, run.results.length);
          setRound({ outcome: "continue", laps: [], store });
          g = new Game(t, { scenery, mode, lapLimit: SEASON_LAPS, lapsUsed: run.lapsUsed, rivalMs: rival, startKnots: run.knots });
          g.onLap = (lap) => {
            const { store: next, outcome } = recordSeasonLap(lap.lapTimeMs, rival, lap.knots);
            setRound((r) => ({ outcome, laps: [...(r?.laps ?? []), lap.grades], store: next }));
            if (outcome !== "continue") g.lock();
          };
        } else if (mode === "corner") {
          const wc = weeklyCorner();
          g = new Game(t, { scenery, mode, lapLimit: null, focus: wc.complex, startKnots: loadCornerWeek()?.knots });
          g.onLap = (lap) => {
            const r = g.focusResult();
            if (r) setWeek(recordCornerRun({ deltaMs: Math.round(r.deltaMs), timeMs: Math.round(r.timeMs), knots: lap.knots }));
          };
        } else {
          g = new Game(t, { scenery, mode, lapLimit: null, challengeKnots: challenge, condition });
          g.onLap = (lap) => setPracticeLaps((p) => [...p, lap.grades].slice(-3));
        }
        setGame(g);
        if (watch) setTimeout(() => g.watchPerfect(), 600);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [mode, trackId, day, condition]);

  if (!game) return <Loading trackId={trackId} error={error} />;
  return <GameView game={game} daily={daily} round={round} practiceLaps={practiceLaps} week={week} onNext={onNext} onHint={() => setDaily((d) => (d ? recordHint(d) : d))} />;
}

type Round = { outcome: RoundOutcome; laps: Grade[][]; store: SeasonStore } | null;

function GameView({
  game,
  daily,
  round,
  practiceLaps,
  week,
  onNext,
  onHint,
}: {
  game: Game;
  daily: DailyRecord | null;
  round: Round;
  practiceLaps: Grade[][];
  week: CornerWeek | null;
  onNext: (trackId: string | null) => void;
  onHint: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tower = useRef<HTMLDivElement>(null);
  const s = useSnapshot(game);
  // lives here, not in the setup bar, so it sees the race start and can close itself
  const coach = useCoach(s);

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
      } else if (s.phase === "setup" && (k === "1" || k === "2" || k === "3")) {
        game.applyStyle(LINE_STYLES[Number(k) - 1]);
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
      {/* ODbL: the credit stays visible whenever the map is on screen */}
      {game.scenery.hasOsm && (
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="absolute top-2 left-1/2 -translate-x-1/2 bg-night/60 px-1.5 py-0.5 text-[11px] text-steel/80 hover:text-paint max-[719px]:hidden"
        >
          Map data © OpenStreetMap contributors
        </a>
      )}
      {/* one corner needs no tower of corners */}
      <div className="absolute top-2 left-2 flex flex-col items-start gap-1.5">
      {/* phones: the tower only while racing (setup and result list the corners in their panels) */}
      <div ref={tower} className={game.focus !== null ? "hidden" : racing ? "" : "max-[719px]:hidden"}>
        <CornerTower
          rows={rows}
          active={s.activeGroup}
          header={header}
          live={racing}
          onSelect={s.phase === "setup" && !s.locked ? (i) => game.selectGate(i, 0) : s.phase === "result" && !s.locked ? (i) => game.adjust(game.controls.complexes[i].corners[0]) : undefined}
        />
      </div>
      {game.scenery.hasOsm && (
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="bg-night/60 px-1.5 py-0.5 text-[10px] text-steel/80 hover:text-paint min-[720px]:hidden"
        >
          © OpenStreetMap
        </a>
      )}
      </div>
      {s.phase === "setup" && !s.locked && <ViewControls game={game} />}
      {s.phase === "setup" && !s.locked && <ControlBar s={s} game={game} coach={coach} />}
      {s.phase === "setup" && s.locked && daily && <LockedNote daily={daily} game={game} onHub={() => onNext(null)} />}
      {racing && <RaceHud s={s} onSkip={() => game.skip()} />}
      {s.phase === "result" && s.result && s.mode === "corner" && <CornerResult game={game} week={week} onGrid={() => onNext(null)} />}
      {s.phase === "result" && s.result && s.mode !== "corner" && <ResultSheet s={s} game={game} lapRows={lapRows} daily={daily} round={round} onNext={onNext} names={names} onHint={onHint} />}
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
const STYLE_NAME: Record<LineStyle, string> = { early: "Early apex", classic: "Classic", late: "Late apex" };
const STYLE_HINT: Record<LineStyle, string> = {
  early: "Turn in early, then run wide on the exit.",
  classic: "Outside, inside at the apex, outside again.",
  late: "Stay wide, apex late, straighter exit.",
};

function useFineTune(): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem("apex.finetune") === "1";
    } catch {
      return false;
    }
  });
  const set = (v: boolean) => {
    setOpen(v);
    try {
      localStorage.setItem("apex.finetune", v ? "1" : "0");
    } catch {
      /* preference just won't persist */
    }
  };
  return [open, set];
}

/**
 * First-run coaching: three short prompts over the first line, shown once.
 * Each step advances on what actually happens in the game (so keys work as
 * well as taps): a style picked, a move to the next corner, then the race.
 */
const COACH_KEY = "apex.coach.v1";
const COACH: string[] = [
  "Set your line one corner at a time. Pick how you take this one: early, classic or late apex.",
  "Each corner keeps its own line. Press Next to set the following one.",
  "Ready? Lights out races your line, and the physics turns it into a lap time.",
];

function useCoach(s: Snapshot) {
  const [step, setStep] = useState(() => {
    try {
      return localStorage.getItem(COACH_KEY) ? COACH.length : 0;
    } catch {
      return COACH.length;
    }
  });
  const from = useRef({ style: s.style, complex: s.complex });
  const finish = useCallback(() => {
    setStep(COACH.length);
    try {
      localStorage.setItem(COACH_KEY, "1");
    } catch {
      /* it shows again next time, no harm */
    }
  }, []);
  useEffect(() => {
    if (step === 0 && s.style !== from.current.style) setStep(1);
    else if (step === 1 && s.complex !== from.current.complex) setStep(2);
  }, [s.style, s.complex, step]);
  // racing the first line is the end of the lesson
  useEffect(() => {
    if (step < COACH.length && s.phase !== "setup") finish();
  }, [s.phase, step, finish]);
  return { step, active: step < COACH.length && s.mode !== "corner", picked: () => step === 0 && setStep(1), skip: finish };
}

function ControlBar({ s, game, coach }: { s: Snapshot; game: Game; coach: ReturnType<typeof useCoach> }) {
  const ref = useInset(game, "bottom");
  const [fine, setFine] = useFineTune();
  const cx = game.controls.complexes[s.complex];
  const inside = cx.direction === "mixed" ? null : cx.direction;
  const gate = cx.gates[s.gate];
  const last = s.complex === game.controls.complexes.length - 1;
  return (
    <div ref={ref} className="absolute inset-x-0 bottom-0 flex justify-center min-[720px]:px-3 min-[720px]:pb-3">
      <div className="wipe-in w-full max-w-[560px] border-t border-line bg-night/94 px-4 pt-4 pb-[max(14px,env(safe-area-inset-bottom))] backdrop-blur-[3px] min-[720px]:border min-[720px]:px-3 min-[720px]:pt-3">
        {coach.active && (
          <div key={coach.step} className="coach-in mb-4 flex items-start gap-3 rounded-sm border border-ink/30 bg-ink/10 px-3 py-2" role="status">
            <span className="mt-[7px] flex shrink-0 gap-1" aria-label={`Tip ${coach.step + 1} of ${COACH.length}`}>
              {COACH.map((_, i) => (
                <span key={i} className={`h-1 w-3 ${i <= coach.step ? "bg-ink" : "bg-asphalt"}`} />
              ))}
            </span>
            <p className="flex-1 text-[14px] leading-snug text-paint">{COACH[coach.step]}</p>
            <button className="shrink-0 px-1 text-[13px] text-steel underline decoration-line underline-offset-4 hover:text-paint" onClick={coach.skip}>
              Skip
            </button>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <h2 className="wide truncate text-[20px] leading-none text-paint">
            {s.mode === "corner" ? weeklyCorner().name : cx.name}
            {fine && <span className="ml-2 text-[13px] text-ink">{gate.label === "Apex" && gate.corner ? `Apex ${gate.corner}` : gate.label}</span>}
          </h2>
          {game.focus === null && (
          <span className="flex shrink-0 items-center gap-2">
            <span className="caption num">
              Corner {s.complex + 1} of {game.controls.complexes.length}
            </span>
            <button className={`btn-line inline-flex items-center gap-1 border border-paint/20 py-1 pr-1.5 pl-2.5 text-[13px] font-semibold text-paint/90 ${coach.active && coach.step === 1 ? "coach-ring" : ""}`} onClick={() => game.nextComplex()}>
              {last ? "First corner" : "Next"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </span>
          )}
        </div>

        {s.challengeMs !== null && (
          <p className="mt-1.5 text-[13px] text-paint">
            Challenge: beat <span className="num font-bold">{lapTime(s.challengeMs)}</span>
          </p>
        )}

        {/* the one-tap line for this corner */}
        <div className={`mt-3.5 grid grid-cols-3 border border-line ${coach.active && coach.step === 0 ? "coach-ring" : ""}`} role="radiogroup" aria-label="Line through this corner">
          {LINE_STYLES.map((st) => (
            <button
              key={st}
              role="radio"
              aria-checked={s.style === st}
              onClick={() => {
                game.applyStyle(st);
                coach.picked();
              }}
              className={`style-pick h-10 border-r border-line text-[14px] font-semibold last:border-r-0 ${s.style === st ? "bg-paint text-night" : "text-paint/85 hover:bg-graphite"}`}
            >
              {STYLE_NAME[st]}
            </button>
          ))}
        </div>
        <p className="caption mt-2.5 min-h-[17px] leading-snug">{s.style ? STYLE_HINT[s.style] : "Your own line. Pick a style to start from one, or fine-tune each point."}</p>
        <p className="caption mt-0.5 hidden text-steel/70 [@media(hover:hover)_and_(min-width:720px)]:block">{game.focus !== null ? "Keys: 1, 2, 3 for a style, Enter to race." : "Keys: 1, 2, 3 for a style, ] for the next corner, Enter to race."}</p>

        {fine && (
          <>
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
          </>
        )}

        <div className="mt-4 flex flex-wrap gap-2.5">
          <button className={iconBtn} onClick={() => game.undo()} disabled={!s.canUndo} aria-label="Undo" title="Undo">
            <Undo />
          </button>
          <button className={secondaryBtn} onClick={() => setFine(!fine)} aria-expanded={fine}>
            {fine ? "Done" : "Fine-tune"}
          </button>
          {s.pbMs !== null && s.mode === "practice" && (
            <button className={secondaryBtn} onClick={() => game.loadBest()}>
              Best line
            </button>
          )}
          <button className={`${primaryBtn} flex-1 basis-40 ${coach.active && coach.step === 2 ? "coach-ring" : ""}`} onClick={() => game.race()}>
            Lights out
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One corner the lap lost time in: the gap, the coach's reason, and an opt-in
 * hint for which way to move. Tapping the row goes back to fix that corner.
 */
function CoachRow({ name, deltaMs, game, hintsOpen, onHint }: { name: string; deltaMs: number; game: Game; hintsOpen: boolean; onHint?: () => void }) {
  const [shown, setShown] = useState(false);
  const c = game.coach(name);
  return (
    <li className="flex items-center gap-2 border-b border-line py-2">
      <button onClick={() => game.adjust(name)} className="group flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="w-14 shrink-0">
          <span className="block text-[14px] font-bold text-paint [font-stretch:85%]">{name}</span>
          <span className={`num block text-[13px] font-semibold ${GRADE_TEXT[gradeFor(deltaMs)]}`}>{delta(deltaMs)}</span>
        </span>
        <span className={`min-w-0 flex-1 text-[13px] leading-snug ${shown ? "text-paint" : "text-steel"}`}>{c ? (shown ? c.hint : c.why) : ""}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-steel transition-transform group-hover:translate-x-0.5" />
      </button>
      {c && hintsOpen && !shown && (
        <button
          className="btn-line shrink-0 border border-paint/20 px-2.5 py-1 text-[13px] font-semibold text-paint/90"
          onClick={() => {
            setShown(true);
            onHint?.();
          }}
        >
          Hint
        </button>
      )}
    </li>
  );
}

const MAP_VIEW_NAME: Record<MapView, string> = { corners: "Corners", best: "Previous best", challenge: "Challenge" };

/** What the circuit map shows after a lap: corner grades, or a mini-sector duel. */
function MapViewSwitch({ s, game }: { s: Snapshot; game: Game }) {
  return (
    <div className="mt-3 border-t border-line pt-2.5">
      <div className="grid border border-line" style={{ gridTemplateColumns: `repeat(${s.mapViews.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label="Map shows">
        {s.mapViews.map((v) => (
          <button
            key={v}
            role="radio"
            aria-checked={s.mapView === v}
            onClick={() => game.setMapView(v)}
            className={`h-8 border-r border-line text-[13px] font-semibold last:border-r-0 ${s.mapView === v ? "bg-paint text-night" : "text-paint/85 hover:bg-graphite"}`}
          >
            {MAP_VIEW_NAME[v]}
          </button>
        ))}
      </div>
      <p className="caption mt-1.5 flex flex-wrap gap-x-3">
        {s.mapView === "corners" ? (
          "Each corner coloured by time lost to the perfect lap."
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 bg-ink" />
              You were quicker
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 ${s.mapView === "challenge" ? "bg-paint" : "bg-steel"}`} />
              {s.mapView === "challenge" ? "Challenger was quicker" : "Your previous best was quicker"}
            </span>
          </>
        )}
      </p>
    </div>
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
  onHint,
}: {
  s: Snapshot;
  game: Game;
  lapRows: Grade[][];
  daily: DailyRecord | null;
  round: Round;
  onNext: (trackId: string | null) => void;
  names: string[];
  onHint: () => void;
}) {
  const r = s.result!;
  // hints open after two laps in the daily, any time elsewhere; daily hints are counted for the share text
  const hintsOpen = s.mode !== "daily" || s.lapsUsed >= DAILY_HINT_AFTER_LAPS;
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
    const dayMedal = bestMedal(daily);
    headline = daily.status === "won" ? "Pole" : dayMedal ? `${MEDAL_NAME[dayMedal]}${daily.archive ? "" : " today"}` : "Out of laps";
    body = daily.status === "won" ? `Every corner perfect on lap ${daily.laps.length} of ${DAILY_LAPS}.` : daily.archive ? "An archive replay: it doesn't count for your streak." : `New circuit in ${countdown}.`;
    actions = (
      <>
        <ShareButton {...dailyShare(daily)} />
        <button className={secondaryBtn} onClick={() => game.watchPerfect()}>
          Watch perfect lap
        </button>
        <button className={secondaryBtn} onClick={() => onNext(null)}>
          {daily.archive ? "Archive" : "Grid"}
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
    const beat = s.challengeMs !== null && r.lapTimeMs < s.challengeMs;
    headline = r.allPurple ? "Pole" : beat ? "Challenge beaten" : s.mode === "practice" ? "Lap complete" : `${left} ${left === 1 ? "lap" : "laps"} left`;
    body = r.allPurple ? "Every corner perfect." : s.mode === "season" ? `Beat ${lapTime(s.rivalMs ?? 0)} to take pole.` : "Tap a corner to fix it.";
    actions = (
      <>
        <button className={`${primaryBtn} flex-1`} onClick={() => game.adjust()} autoFocus>
          Improve line
        </button>
        {s.mode === "practice" && (
          <ShareButton
            label="Challenge"
            variant="secondary"
            text={`Beat my ${lapTime(r.lapTimeMs)} at ${info.name} in Lapdle: ${challengeUrl({ trackId: game.track.id, knots: game.currentKnots() })}`}
          />
        )}
      </>
    );
  }

  const lapMedal = medalFor(game.track.id, r.lapTimeMs, r.grades.map((g) => g.grade), game.condition);
  const pole = realPole(game.track.id, game.condition);
  const trace = useMemo(() => game.speedTrace(), [game, r]);
  const vsRival = s.mode === "season" && s.rivalMs !== null ? r.lapTimeMs - s.rivalMs : null;
  const pbDelta = r.pbBeforeMs === null ? null : r.lapTimeMs - r.pbBeforeMs;

  return (
    <div
      ref={ref}
      className="absolute inset-x-0 bottom-0 max-h-[70%] overflow-y-auto min-[720px]:inset-x-auto min-[720px]:top-2 min-[720px]:right-2 min-[720px]:bottom-2 min-[720px]:max-h-none min-[720px]:w-[380px]"
    >
      <div className="wipe-in border-t border-line bg-night/95 px-4 pt-4 pb-[max(14px,env(safe-area-inset-bottom))] backdrop-blur-[3px] min-[720px]:h-full min-[720px]:border min-[720px]:px-3 min-[720px]:pt-3">
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
          <MedalRow trackId={game.track.id} medal={lapMedal} lapTimeMs={r.lapTimeMs} stamp={!!lapMedal && r.newPb} condition={game.condition} />
          {s.mode === "daily" && daily && <StandingLine daily={daily} className="border-t border-line py-2" />}
          <div className="border-t border-line pt-2 pb-1">
            <SectorCells sectors={s.sectors} large />
            <p className="caption mt-1 flex flex-wrap gap-x-3">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 bg-purple" />
                Perfect sector
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 bg-green" />
                Your best
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 bg-yellow" />
                Slower
              </span>
            </p>
          </div>
          {s.challengeMs !== null && (
            <TimingLine label={`Challenge ${lapTime(s.challengeMs)}`} value={delta(r.lapTimeMs - s.challengeMs)} tone={r.lapTimeMs < s.challengeMs ? "text-ink" : "text-paint"} />
          )}
          <TimingLine label="Perfect lap" value={lapTime(r.targetMs)} />
          {pole && (
            <TimingLine order={1} label={`Real 2025 pole ${lapTime(pole.ms)}`} value={delta(r.lapTimeMs - pole.ms)} tone={r.lapTimeMs < pole.ms ? "text-ink" : "text-paint"} />
          )}
          {vsRival !== null && <TimingLine order={1} label={`Rival pole ${lapTime(s.rivalMs!)}`} value={delta(vsRival)} tone={vsRival < 0 ? "text-ink" : "text-paint"} />}
          <TimingLine
            order={2}
            label={pbDelta === null ? "Personal best" : r.newPb ? "New personal best" : "Personal best"}
            value={pbDelta === null ? "First lap" : delta(pbDelta)}
            tone={pbDelta === null || r.newPb ? "text-ink" : "text-paint"}
          />
        </div>

        {s.mapViews.length > 1 && <MapViewSwitch s={s} game={game} />}

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
        {trace && <SpeedTrace data={trace} />}
        {!s.locked && worst.length > 0 && (
          <ul className="mt-3 border-t border-line" aria-label="Where the time went">
            {worst.map((l) => (
              <CoachRow key={l.name} name={l.name} deltaMs={l.deltaMs} game={game} hintsOpen={hintsOpen} onHint={s.mode === "daily" ? onHint : undefined} />
            ))}
            {!hintsOpen && <li className="caption py-2">Hints open after lap {DAILY_HINT_AFTER_LAPS}.</li>}
          </ul>
        )}
        <Legend />
        <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
      </div>
    </div>
  );
}

/** Daily already finished today: the circuit stays visible, with the result and a way out. */
function LockedNote({ daily, game, onHub }: { daily: DailyRecord; game: Game; onHub: () => void }) {
  const countdown = useCountdown();
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-center">
      <div className="wipe-in w-full max-w-[560px] border-t border-line bg-night/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <h2 className="wide text-[20px] leading-none text-paint">{dayHeadline(daily)}</h2>
        <StandingLine daily={daily} className="mt-1.5" />
        <p className="mt-1.5 text-[14px] text-paint/75">
          {daily.archive ? "An archive replay, unranked." : `New circuit in ${countdown}.`}
          {game.getSnapshot().perfectShown ? " The perfect line is now drawn under yours." : ""}
        </p>
        <div className="mt-3">
          <LapGrid rows={daily.laps.map((l) => l.grades)} total={DAILY_LAPS} cols={game.controls.complexes.length} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={secondaryBtn} onClick={() => game.watchPerfect()}>
            Watch the perfect lap
          </button>
          <ShareButton {...dailyShare(daily)} />
          <button className={secondaryBtn} onClick={onHub}>
            {daily.archive ? "Archive" : "Grid"}
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

/**
 * The weekly corner's result: time through the corner, the gap to the perfect
 * line, this run's medal, the ladder, and the week's best so far.
 */
function CornerResult({ game, week, onGrid }: { game: Game; week: CornerWeek | null; onGrid: () => void }) {
  const r = game.focusResult();
  const ref = useInset(game, "bottom");
  if (!r) return null;
  const wc = weeklyCorner();
  const medal = cornerMedal(r.deltaMs);
  const bestMedal = week ? cornerMedal(week.bestDeltaMs) : null;
  const gap = (ms: number) => (ms <= 0 ? "on the perfect line" : `+${(ms / 1000).toFixed(3)} s`);
  const tone = r.deltaMs <= CORNER_MEDAL_MS.pole ? "text-purple" : r.deltaMs <= CORNER_MEDAL_MS.silver ? "text-green" : r.deltaMs <= CORNER_MEDAL_MS.bronze ? "text-yellow" : "text-kerb";
  const left = daysLeft();
  return (
    <div ref={ref} className="absolute inset-x-0 bottom-0 flex justify-center min-[720px]:px-3 min-[720px]:pb-3">
      <div className="wipe-in w-full max-w-[560px] border-t border-line bg-night/95 p-4 pb-[max(14px,env(safe-area-inset-bottom))] min-[720px]:border">
        <p className="caption">Corner of the week #{weekNumber()}</p>
        <div className="mt-1 flex items-end justify-between gap-4">
          <h2 className="wide text-[22px] leading-none text-paint">{wc.name}</h2>
          <span className="flex items-center gap-2">
            {medal ? <MedalDisc medal={medal} size={18} /> : null}
            <span className="wide text-[15px] text-paint">{medal ? MEDAL_NAME[medal] : "No medal"}</span>
          </span>
        </div>
        {/* the score is the time lost to the perfect line in this corner, nothing else */}
        <div className="mt-3 flex items-baseline gap-3">
          <span className={`wide num text-[40px] leading-none ${tone}`}>{r.deltaMs <= 0 ? "Perfect" : `+${(r.deltaMs / 1000).toFixed(3)}`}</span>
          <span className="text-[14px] text-steel">{r.deltaMs <= 0 ? `through ${wc.name}` : `s lost to the perfect line through ${wc.name}`}</span>
        </div>
        <ol className="mt-4 grid grid-cols-4 gap-2" aria-label="Medal targets">
          {(["bronze", "silver", "gold", "pole"] as const).map((m) => {
            const on = r.deltaMs <= CORNER_MEDAL_MS[m];
            return (
              <li key={m} className={`flex flex-col gap-1 border-t-2 pt-1.5 ${on ? "" : "border-line"}`} style={on ? { borderColor: MEDAL_COLOR[m] } : undefined}>
                <span className={`text-[13px] font-semibold ${on ? "text-paint" : "text-steel"}`}>{MEDAL_NAME[m]}</span>
                <span className={`num text-[13px] ${on ? "text-paint" : "text-steel"}`}>+{(CORNER_MEDAL_MS[m] / 1000).toFixed(2)} s</span>
              </li>
            );
          })}
        </ol>
        {week && (
          <p className="caption mt-3">
            Your best this week: <span className="text-paint">{gap(week.bestDeltaMs)}</span>
            {bestMedal ? `, ${MEDAL_NAME[bestMedal]}` : ""}, {week.tries} {week.tries === 1 ? "try" : "tries"}. {left === 1 ? "Last day" : `${left} days left`}.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={`${primaryBtn} flex-1`} onClick={() => game.adjust()} autoFocus>
            Try again
          </button>
          {week && <ShareButton text={`${cornerShare(week, wc)}\n${location.origin}/corner`} label="Share" variant="secondary" />}
          <button className={secondaryBtn} onClick={onGrid}>
            Grid
          </button>
        </div>
      </div>
    </div>
  );
}
