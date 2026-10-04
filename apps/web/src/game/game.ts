import {
  CONDITION_CARS,
  type CarModel,
  type Condition,
  type Complex,
  type GameTrack,
  type LineControls,
  type LineStyle,
  type PreparedTrack,
  type SimulationResult,
  compareRuns,
  expandGates,
  prepareTrack,
  resolveLine,
  simulateLap,
  styleGates,
  trackControls,
  usableHalfWidth,
} from "@apex/engine";
import { MEDAL_COLOR, MEDAL_NAME, type Medal, medalFor, nextMedal } from "../modes/medals";
import { Camera } from "./camera";
import { CarSprites } from "./car";
import { track as trackEvent } from "../analytics";
import { CATALOG } from "./catalog";
import { Scenery } from "./scenery";
import type { SceneryData } from "./surroundings";
import { C, lossColor } from "./palette";
import { type PersonalBest, loadPB, loadSectorBests, logEvent, savePB, saveSectorBests } from "./storage";
import { type Grade, type GroupGrade, gradeFor } from "../modes/grading";
import { type DriveState, driveState } from "./drive";
import { engine, soundEnabled } from "./audio";

export type Phase = "setup" | "lights" | "race" | "result";
export type Mode = "daily" | "season" | "practice" | "corner";

export interface GameOptions {
  mode: Mode;
  /** Laps allowed in this session (null = unlimited). */
  lapLimit: number | null;
  /** Laps already used today / this round (restored from storage). */
  lapsUsed?: number;
  /** Season: the rival pole to beat. */
  rivalMs?: number;
  /** Line to start from (e.g. the last line raced today). */
  startKnots?: number[];
  /** Session already over (daily finished today): results only. */
  locked?: boolean;
  /** A friend's line to beat (from a "Beat my lap" link), raced as a pace marker only. */
  challengeKnots?: number[];
  /** The circuit's real surroundings (OpenStreetMap), drawn under the run-off. */
  scenery?: SceneryData | null;
  /** Track conditions: the car, the perfect line and the medals all follow them (default dry). */
  condition?: Condition;
  /**
   * One corner group only (the weekly corner): the rest of the lap runs on the
   * perfect line, only this group can be set, and the race plays just the run
   * through it, straight away with no start lights.
   */
  focus?: number;
}

export interface LapEvent {
  lapTimeMs: number;
  /** time lost to the perfect line in each corner group, ms */
  deltas: number[];
  grades: Grade[];
  allPurple: boolean;
  knots: number[];
}

export interface CornerLoss {
  name: string;
  deltaMs: number;
  /** Corner group that contains this corner (for "fix it" jumps), or -1. */
  complex: number;
}

export interface RunResult {
  lapTimeMs: number;
  targetMs: number;
  deltaTargetMs: number;
  pbBeforeMs: number | null;
  newPb: boolean;
  losses: CornerLoss[]; // worst first
  /** One colour per corner group, lap order. */
  grades: GroupGrade[];
  allPurple: boolean;
}

/** F1 sector colours: purple = the perfect lap's sector (within 0.05 s), green = personal best, yellow = slower. */
export type SectorTone = "purple" | "green" | "yellow";

export interface SectorTime {
  ms: number;
  tone: SectorTone;
  /** race time at which the car crosses the sector line */
  doneAtMs: number;
  /** gap to the perfect lap's sector */
  deltaMs: number;
}

/** The result map: corner grades against the perfect lap, or a mini-sector duel with your previous best or a challenger. */
export type MapView = "corners" | "best" | "challenge";

export interface Snapshot {
  phase: Phase;
  complex: number;
  gate: number;
  /** Lateral offset of the selected gate (m, + = left of travel). */
  offset: number;
  /** Max |offset| with all four wheels on track. */
  limit: number;
  /** The one-tap style the selected corner group is set to, or null once fine-tuned away from it. */
  style: LineStyle | null;
  canUndo: boolean;
  raceTimeMs: number;
  raceSpeedKmh: number;
  result: RunResult | null;
  pbMs: number | null;
  attempts: number;
  /** True once the line differs from what was last raced. */
  edited: boolean;
  mode: Mode;
  /** Start lights lit (0–5) during the "lights" phase. */
  lights: number;
  /** Corner-group tiles of the lap in progress (colours known, revealed as the car passes). */
  grades: GroupGrade[] | null;
  revealed: number;
  /** Running gap to the pace target at the car's position (ms, + = behind). */
  liveDeltaMs: number;
  /** What the live gap and the pace marker measure against: the next medal above your best, or the perfect lap. */
  paceLabel: string;
  /** The challenger's lap time when racing a "Beat my lap" link, else null. */
  challengeMs: number | null;
  /** Sector times completed so far this lap (all three on the result). */
  sectors: SectorTime[];
  /** What the result map shows, and which comparisons are available. */
  mapView: MapView;
  mapViews: MapView[];
  /** Running the perfect lap as a demo (after the daily is over): nothing counts. */
  demo: boolean;
  /** The perfect line has been revealed and is drawn under yours. */
  perfectShown: boolean;
  drive: DriveState;
  lapsUsed: number;
  lapLimit: number | null;
  locked: boolean;
  rivalMs: number | null;
  /** Tower highlight: selected corner group (setup) or the one the car is in (race); -1 none. */
  activeGroup: number;
}

/** Race playback runs this many times faster than the simulated lap. */
export const PLAYBACK_SPEED = 4;
/** Race camera: track width on screen at low / top speed (zooms out as speed builds). */
const RACE_TRACK_PX_SLOW = 84;
const RACE_TRACK_PX_FAST = 58;
const LIGHT_MS_FIRST = 700;
const LIGHT_MS_REPEAT = 240;
const PUCK_HIT_PX = 26;

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export class Game {
  readonly track: GameTrack;
  readonly pt: PreparedTrack;
  readonly controls: LineControls;
  readonly limit: number;
  readonly camera = new Camera();
  private readonly reference: SimulationResult;
  private readonly bbox: [number, number, number, number];
  readonly scenery: Scenery;
  private readonly cars: CarSprites;
  /** complex index for each gated corner name */
  private readonly complexOfCorner = new Map<string, number>();

  private phase: Phase = "setup";
  private z: number[];
  private lineXY: { x: Float64Array; y: Float64Array };
  private sel = { complex: 0, gate: 0 };
  private history: number[][] = [];
  private editing = false;
  private lastRaced: string | null = null;

  private sim: SimulationResult | null = null;
  private raceT = 0;
  private result: RunResult | null = null;
  private pb: PersonalBest | null;
  private pbSim: SimulationResult | null = null;
  private attempts = 0;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private dpr = 1;
  private raf = 0;
  private lastFrame = 0;
  private lastEmit = 0;
  private dirty = true;
  private listeners = new Set<() => void>();
  private snap: Snapshot;
  private cleanup: (() => void)[] = [];
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

  private pointers = new Map<number, { x: number; y: number; x0: number; y0: number }>();
  private mode: "none" | "pan" | "pinch" | "puck" | "tap" = "none";
  private pinch0: { dist: number; scale: number; world: [number, number] } | null = null;

  readonly opts: GameOptions;
  /** Called after every completed lap; the mode controller persists it. */
  onLap: ((e: LapEvent) => void) | null = null;
  private lapsUsed: number;
  private locked: boolean;
  private lightsT0 = 0;
  private lightsHold = 0;
  private lightMs = LIGHT_MS_FIRST;
  private lightsLit = 0;
  private grades: GroupGrade[] | null = null;
  // race effects
  private shake: [number, number] = [0, 0];
  private skids: number[] = []; // x1,y1,x2,y2 quadruples
  private prevWheels: [number, number, number, number] | null = null;
  private prevSpeed = 0;
  private sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  /** Screen-space wind streaks at the frame edges above ~200 km/h (heading-up cam: they fall downward). */
  private streaks: { x: number; y: number; len: number; v: number }[] = [];
  /** Wet: water thrown up by the rear tyres (world space) and rain across the lens (screen space). */
  private spray: { x: number; y: number; vx: number; vy: number; life: number; max: number }[] = [];
  private rain: { x: number; y: number; len: number; v: number }[] = [];
  private sprayFrom: [number, number] | null = null;
  private raceKmh = 0;

  /** Conditions for this session, the car they give, and that condition's perfect line. */
  readonly condition: Condition;
  readonly car: CarModel;
  private readonly optimal: { knotOffsets: number[] };
  /** Personal bests and sector bests are kept per circuit and per condition. */
  private readonly store: string;
  /** The one corner group in play (weekly corner), or null for the whole lap. */
  readonly focus: number | null;

  constructor(track: GameTrack, opts: GameOptions = { mode: "practice", lapLimit: null }) {
    this.opts = opts;
    this.condition = opts.condition ?? "dry";
    const cond = this.condition === "dry" ? null : track.conditions?.[this.condition];
    // without that condition's line (an old track file), fall back to dry rather than mislead
    if (this.condition !== "dry" && !cond) this.condition = "dry";
    this.car = CONDITION_CARS[this.condition];
    this.cars = new CarSprites(this.condition === "wet");
    this.optimal = cond?.optimalLine ?? track.optimalLine!;
    this.store = this.condition === "dry" ? track.id : `${track.id}~${this.condition}`;
    this.focus = opts.focus ?? null;
    if (this.focus !== null) this.store += `~corner${this.focus}`;
    this.lapsUsed = opts.lapsUsed ?? 0;
    this.locked = !!opts.locked;
    this.track = track;
    this.pt = prepareTrack(track);
    this.controls = trackControls(this.pt);
    this.limit = usableHalfWidth(this.pt, this.car);
    this.reference = simulateLap({ track: this.pt, line: this.optimal, car: this.car });
    this.controls.complexes.forEach((c, i) => c.corners.forEach((name) => this.complexOfCorner.set(name, i)));
    const xs = track.leftBoundary.concat(track.rightBoundary);
    this.bbox = [
      Math.min(...xs.map((p) => p[0])),
      Math.min(...xs.map((p) => p[1])),
      Math.max(...xs.map((p) => p[0])),
      Math.max(...xs.map((p) => p[1])),
    ];
    const style = CATALOG.find((t) => t.id === track.id)?.style ?? "permanent";
    const significant = new Set(this.controls.complexes.flatMap((c) => c.corners));
    this.scenery = new Scenery(this.pt, track, style, significant, opts.scenery ?? null);
    this.scenery.wet = this.condition === "wet";

    this.pb = loadPB(this.store, track.version);
    // Continue from the session's last line, else (practice) your best line, else the centerline.
    const pbLine = opts.mode === "practice" && this.pb?.knotOffsets.length === this.pt.k ? this.pb.knotOffsets : null;
    // one corner: everything else sits on the perfect line, so the run-in speed is the same for everyone
    // (the corner itself starts from the centre of the track: it's yours to find)
    const base = this.focus !== null ? this.optimal.knotOffsets.slice() : new Array(this.pt.k).fill(0);
    if (this.focus !== null) for (const g of this.controls.complexes[this.focus].gates) base[g.knot] = 0;
    const start = opts.startKnots?.length === this.pt.k ? opts.startKnots : (pbLine ?? base);
    this.z = expandGates(this.pt, this.controls, start, this.limit);
    this.lineXY = this.resolve();
    if (this.pb) this.pbSim = simulateLap({ track: this.pt, line: { knotOffsets: this.pb.knotOffsets }, car: this.car });
    if (opts.challengeKnots?.length === this.pt.k) {
      // re-simulated here, so the time on the link can't be anything but what that line drives
      const line = expandGates(this.pt, this.controls, opts.challengeKnots, this.limit);
      this.challengeSim = simulateLap({ track: this.pt, line: { knotOffsets: line }, car: this.car });
      this.challengeMs = this.challengeSim.lapTimeMs;
      this.pace = this.paceTarget();
    }
    this.snap = this.buildSnapshot();
    logEvent("track_loaded", { track: track.id, returning: !!this.pb });
    if (import.meta.env.DEV) (window as unknown as { __apex: Game }).__apex = this;
  }

  // ------------------------------------------------------------ React bridge
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;

  private emit() {
    this.snap = this.buildSnapshot();
    this.listeners.forEach((l) => l());
  }

  private buildSnapshot(): Snapshot {
    let speed = 0;
    let liveDelta = 0;
    if (this.sim && (this.phase === "race" || this.phase === "result")) {
      speed = this.sampleAt(this.sim, this.raceT).speed * 3.6;
      const i = this.indexAt(this.sim, this.raceT);
      liveDelta = this.sim.samples.elapsedMs[i] - this.reference.samples.elapsedMs[i] * this.pace.scale;
    }
    return {
      phase: this.phase,
      complex: this.sel.complex,
      gate: this.sel.gate,
      offset: this.z[this.selectedGate().knot],
      limit: this.limit,
      style: this.styleOf(this.sel.complex),
      canUndo: this.history.length > 0,
      raceTimeMs: this.raceT,
      raceSpeedKmh: speed,
      result: this.result,
      pbMs: this.pb?.lapTimeMs ?? null,
      attempts: this.attempts,
      edited: this.lastRaced !== this.z.join(","),
      mode: this.opts.mode,
      lights: this.phase === "lights" ? this.lightsLit : 0,
      grades: this.grades,
      revealed: this.grades
        ? this.phase === "result"
          ? this.grades.length
          : this.grades.filter((g) => g.revealAtMs <= this.raceT).length
        : 0,
      liveDeltaMs: liveDelta,
      paceLabel: this.pace.label,
      challengeMs: this.challengeMs,
      demo: this.demo,
      mapView: this.mapView,
      mapViews: this.mapViews(),
      perfectShown: this.perfectXY !== null,
      sectors:
        this.sectorPlan && (this.phase === "race" || this.phase === "result")
          ? this.phase === "result"
            ? this.sectorPlan
            : this.sectorPlan.filter((x) => x.doneAtMs <= this.raceT)
          : [],
      drive: driveState(this.phase === "lights" ? 0 : speed),
      lapsUsed: this.lapsUsed,
      lapLimit: this.opts.lapLimit,
      locked: this.locked,
      rivalMs: this.opts.rivalMs ?? null,
      activeGroup:
        this.phase === "setup"
          ? this.sel.complex
          : this.phase === "lights"
            ? 0
            : this.phase === "race" && this.grades
              ? Math.min(this.grades.length - 1, this.grades.filter((g) => g.revealAtMs <= this.raceT).length)
              : -1,
    };
  }

  // ------------------------------------------------------------ lifecycle
  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas);
    this.resize();
    this.focusGate(0);

    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      canvas.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => canvas.removeEventListener(type, fn as EventListener));
    };
    on("pointerdown", (e) => this.onDown(e));
    on("pointermove", (e) => this.onMove(e));
    on("pointerup", (e) => this.onUp(e));
    on("pointercancel", (e) => this.onUp(e));
    on("wheel", (e) => this.onWheel(e), { passive: false });
    on("contextmenu", (e) => e.preventDefault());
    this.cleanup.push(() => ro.disconnect());

    const loop = (now: number) => {
      this.frame(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  detach() {
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    this.canvas = null;
    this.ctx = null;
  }

  /** Screen space covered by UI panels; framing keeps the subject clear of them. */
  setInsets(insets: Partial<Insets>) {
    const next = { ...this.insets, ...insets };
    if (JSON.stringify(next) === JSON.stringify(this.insets)) return;
    this.insets = next;
    if (this.phase === "setup") this.focusGate(250);
    else if (this.phase === "result") this.frameResult(250);
  }

  private resize() {
    const cv = this.canvas!;
    const r = cv.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(r.width * this.dpr);
    cv.height = Math.round(r.height * this.dpr);
    this.camera.w = r.width;
    this.camera.h = r.height;
    if (this.phase === "setup") this.focusGate(0);
    this.dirty = true;
  }

  // ------------------------------------------------------------ line editing
  private resolve() {
    const r = resolveLine(this.pt, { knotOffsets: this.z }, this.car);
    return { x: r.x, y: r.y };
  }

  private complex(): Complex {
    return this.controls.complexes[this.sel.complex];
  }

  private selectedGate() {
    return this.complex().gates[this.sel.gate];
  }

  /** Set the selected gate's lateral offset (m). Wrap a drag in beginEdit/endEdit for one undo step. */
  setOffset(offset: number) {
    if (this.phase !== "setup") return;
    if (!this.editing) this.history.push(this.z);
    const next = this.z.slice();
    next[this.selectedGate().knot] = Math.max(-this.limit, Math.min(this.limit, Math.round(offset * 100) / 100));
    this.z = expandGates(this.pt, this.controls, next, this.limit);
    this.lineXY = this.resolve();
    this.dirty = true;
    this.emit();
  }

  beginEdit() {
    if (this.phase !== "setup") return;
    this.history.push(this.z);
    this.editing = true;
  }

  endEdit() {
    if (!this.editing) return;
    this.editing = false;
    const prev = this.history[this.history.length - 1];
    if (prev && prev.join(",") === this.z.join(",")) this.history.pop();
    else logEvent("gate_set", { track: this.track.id, complex: this.complex().name, gate: this.selectedGate().label });
    this.emit();
  }

  /** Raw gate offsets of each one-tap style per corner group, computed once. */
  private styleCache = new Map<string, Map<number, number>>();
  /** Per corner group: the style last applied and the gate values it produced (after track limits). */
  private applied = new Map<number, { style: LineStyle; values: Map<number, number> }>();

  private styleTargets(complex: number, style: LineStyle): Map<number, number> {
    const key = `${complex}:${style}`;
    let t = this.styleCache.get(key);
    if (!t) this.styleCache.set(key, (t = styleGates(this.pt, this.controls.complexes[complex], style, this.limit)));
    return t;
  }

  /** The style a group is still set to: the last one applied, as long as its gates haven't moved (5 cm). */
  private styleOf(complex: number): LineStyle | null {
    const a = this.applied.get(complex);
    if (!a) return null;
    return [...a.values].every(([k, v]) => Math.abs(this.z[k] - v) <= 0.05) ? a.style : null;
  }

  /** Set every gate of the selected corner group to a one-tap style (one undo step). */
  applyStyle(style: LineStyle) {
    if (this.phase !== "setup") return;
    const t = this.styleTargets(this.sel.complex, style);
    if (t.size === 0) return;
    this.history.push(this.z);
    const next = this.z.slice();
    for (const [k, v] of t) next[k] = v;
    this.z = expandGates(this.pt, this.controls, next, this.limit);
    this.applied.set(this.sel.complex, { style, values: new Map([...t.keys()].map((k) => [k, this.z[k]])) });
    this.lineXY = this.resolve();
    this.dirty = true;
    logEvent("style_set", { track: this.track.id, complex: this.complex().name, style });
    this.emit();
  }

  /** Move to the next corner group (wrapping), selecting its first gate. */
  nextComplex() {
    this.selectGate((this.sel.complex + 1) % this.controls.complexes.length, 0);
  }

  nudge(deltaM: number) {
    this.setOffset(this.z[this.selectedGate().knot] + deltaM);
  }

  undo() {
    const prev = this.history.pop();
    if (!prev || this.phase !== "setup") return;
    this.z = prev;
    this.lineXY = this.resolve();
    this.dirty = true;
    this.emit();
  }

  resetLine() {
    this.history.push(this.z);
    this.z = expandGates(this.pt, this.controls, new Array(this.pt.k).fill(0), this.limit);
    this.lineXY = this.resolve();
    this.dirty = true;
    this.emit();
  }

  loadBest() {
    if (!this.pb) return;
    this.history.push(this.z);
    this.z = expandGates(this.pt, this.controls, this.pb.knotOffsets, this.limit);
    this.lineXY = this.resolve();
    this.dirty = true;
    this.emit();
  }

  selectGate(complex: number, gate: number, ms = 420) {
    const nc = this.controls.complexes.length;
    const c = this.focus ?? ((complex % nc) + nc) % nc;
    const g = Math.max(0, Math.min(gate, this.controls.complexes[c].gates.length - 1));
    this.sel = { complex: c, gate: g };
    if (this.phase === "setup") this.focusGate(ms);
    this.emit();
  }

  /** Step through gates in lap order, crossing into the next/previous corner group. */
  stepGate(dir: 1 | -1) {
    const { complex, gate } = this.sel;
    const n = this.complex().gates.length;
    if (gate + dir >= 0 && gate + dir < n) this.selectGate(complex, gate + dir);
    else if (dir > 0) this.selectGate(complex + 1, 0);
    else {
      const nc = this.controls.complexes.length;
      const prev = (complex - 1 + nc) % nc;
      this.selectGate(prev, this.controls.complexes[prev].gates.length - 1);
    }
  }

  stepComplex(dir: 1 | -1) {
    this.selectGate(this.sel.complex + dir, 0);
  }

  /** Heading (radians) of the direction of travel at centerline index i. */
  private headingAt(i: number) {
    const { n, cx, cy } = this.pt;
    const a = (i - 2 + n) % n;
    const b = (i + 2) % n;
    return Math.atan2(cy[b] - cy[a], cx[b] - cx[a]);
  }

  /**
   * Frame the selected corner group, rotated so travel through the selected
   * gate points straight up: left on screen = left on track = left on the slider.
   */
  private focusGate(ms = 420) {
    const cx0 = this.complex();
    const g = this.selectedGate();
    const angle = this.headingAt(g.index) - Math.PI / 2;
    const { n, step, cx, cy } = this.pt;
    const pad = Math.round(45 / step);
    const a = (cx0.gates[0].index - pad + n) % n;
    const len = ((cx0.gates[cx0.gates.length - 1].index - cx0.gates[0].index + n) % n) + 2 * pad;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    let rx0 = Infinity;
    let rx1 = -Infinity;
    let ry0 = Infinity;
    let ry1 = -Infinity;
    const W = this.track.widthMeters;
    for (let o = 0; o <= len; o += 2) {
      const i = (a + o) % n;
      const rx = cx[i] * c + cy[i] * s;
      const ry = -cx[i] * s + cy[i] * c;
      rx0 = Math.min(rx0, rx - W);
      rx1 = Math.max(rx1, rx + W);
      ry0 = Math.min(ry0, ry - W);
      ry1 = Math.max(ry1, ry + W);
    }
    const { w, h } = this.camera;
    const { top, right, bottom, left } = this.insets;
    const availW = Math.max(80, w - left - right - 24);
    const availH = Math.max(80, h - top - bottom - 24);
    const fit = Math.min(availW / (rx1 - rx0), availH / (ry1 - ry0));
    const scale = Math.max(26 / W, Math.min(120 / W, fit)); // track 26–120 px wide
    // Centre on the whole group if it fits; otherwise on the selected gate.
    let mrx = (rx0 + rx1) / 2;
    let mry = (ry0 + ry1) / 2;
    if (fit < scale) {
      mrx = cx[g.index] * c + cy[g.index] * s;
      mry = -cx[g.index] * s + cy[g.index] * c;
    }
    // Shift so the subject sits in the free area between the panels.
    const crx = mrx - (left - right) / 2 / scale;
    const cry = mry + (top - bottom) / 2 / scale;
    this.camera.animateTo(crx * c - cry * s, crx * s + cry * c, scale, angle, ms);
    this.dirty = true;
  }

  showOverview() {
    this.fitTrack(500);
  }

  private fitTrack(ms = 500) {
    const [bx0, by0, bx1, by1] = this.bbox;
    const { w, h } = this.camera;
    const { top, right, bottom, left } = this.insets;
    const W = Math.max(80, w - left - right);
    const H = Math.max(80, h - top - bottom);
    const s = Math.min(W / (bx1 - bx0), H / (by1 - by0)) * 0.88;
    const px = left + W / 2;
    const py = top + H / 2;
    const cx = (bx0 + bx1) / 2 - (px - w / 2) / s;
    const cy = (by0 + by1) / 2 + (py - h / 2) / s;
    this.camera.animateTo(cx, cy, s, 0, ms);
    this.dirty = true;
  }

  private frameResult(ms = 600) {
    this.fitTrack(ms);
  }

  // ------------------------------------------------------------ race
  race() {
    if (this.phase !== "setup") return;
    const sim = simulateLap({ track: this.pt, line: { knotOffsets: this.z }, car: this.car });
    if (!sim.valid) return; // expandGates keeps lines valid; defensive only
    if (this.locked || (this.opts.lapLimit !== null && this.lapsUsed >= this.opts.lapLimit)) return;
    this.sim = sim;
    this.grades = this.computeGrades(sim);
    this.sectorPlan = this.planSectors(sim);
    this.pace = this.paceTarget();
    this.prevBestSim = this.pbSim;
    if (this.mapView === "best" && !this.prevBestSim) this.mapView = "corners";
    this.raceT = 0;
    this.phase = "lights";
    if (this.focus !== null) {
      // one corner: start a couple of seconds before it, flying, no lights
      this.window = this.focusWindow(sim);
      this.raceT = Math.max(0, this.window.startMs - 2500);
      this.phase = "race";
    }
    this.lightsT0 = performance.now();
    this.lightsLit = 0;
    // lights hold 0.2–1.0 s after the fifth, like the real start; shorter from the second lap on
    this.lightsHold = this.attempts === 0 ? 200 + Math.random() * 800 : 150 + Math.random() * 300;
    this.lightMs = this.attempts === 0 ? LIGHT_MS_FIRST : LIGHT_MS_REPEAT;
    this.skids = [];
    this.spray = [];
    this.sprayFrom = null;
    this.prevWheels = null;
    this.sparks = [];
    this.prevSpeed = 0;
    this.lastRaced = this.z.join(",");
    const i0 = this.focus !== null ? this.indexAt(sim, this.raceT) : 0;
    this.camera.animateTo(sim.samples.x[i0], sim.samples.y[i0], RACE_TRACK_PX_SLOW / this.track.widthMeters, this.headingAt(i0) - Math.PI / 2, 450);
    if (soundEnabled()) engine.resume();
    logEvent("run_started", { track: this.track.id, mode: this.opts.mode });
    trackEvent("Lap started", { mode: this.opts.mode, circuit: this.track.id, condition: this.condition });
    this.emit();
  }

  /** Pace for this lap: the next medal above your personal best (by time), or the perfect lap once Gold is yours. */
  private pace: { label: string; medal: Medal | "perfect" | "challenge"; scale: number } = { label: "Perfect", medal: "perfect", scale: 1 };

  /** The challenger's re-simulated lap time, when racing a link. */
  private challengeMs: number | null = null;

  /** The race-time window of the focus corner group: from its first corner's timing line to the next corner's. */
  private window: { startMs: number; endMs: number } | null = null;

  private focusWindow(sim: SimulationResult): { startMs: number; endMs: number } {
    const corners = this.track.corners;
    const cx = this.controls.complexes[this.focus ?? 0];
    const first = corners.findIndex((c) => c.name === cx.corners[0]);
    const last = corners.findIndex((c) => c.name === cx.corners[cx.corners.length - 1]);
    const startIdx = corners[first].timingStartIndex;
    const endIdx = corners[(last + 1) % corners.length].timingStartIndex;
    const e = sim.samples.elapsedMs;
    return { startMs: e[startIdx], endMs: endIdx <= startIdx ? sim.rawLapTimeMs : e[endIdx] };
  }

  /** The focus corner on the last run: time through it and time lost to the perfect line. */
  focusResult(): { name: string; timeMs: number; perfectMs: number; deltaMs: number } | null {
    if (this.focus === null || !this.sim || !this.grades) return null;
    const mine = this.focusWindow(this.sim);
    const perfect = this.focusWindow(this.reference);
    return {
      name: this.controls.complexes[this.focus].name,
      timeMs: mine.endMs - mine.startMs,
      perfectMs: perfect.endMs - perfect.startMs,
      deltaMs: this.grades[this.focus].deltaMs,
    };
  }

  private paceTarget(): { label: string; medal: Medal | "perfect" | "challenge"; scale: number } {
    if (this.focus !== null) return { label: "Perfect", medal: "perfect", scale: 1 };
    if (this.challengeMs !== null) return { label: "Challenge", medal: "challenge", scale: this.challengeMs / this.reference.lapTimeMs };
    const pbMedal = this.pb ? medalFor(this.track.id, this.pb.lapTimeMs, [], this.condition) : null;
    const next = nextMedal(this.track.id, pbMedal, this.condition);
    if (!next || next.ms === null) return { label: "Perfect", medal: "perfect", scale: 1 };
    return { label: MEDAL_NAME[next.medal], medal: next.medal, scale: next.ms / this.reference.lapTimeMs };
  }

  /** Where a car at the pace target would be now, on the player's own line (so it never shows the perfect line). */
  private pacePoint(sim: SimulationResult): { x: number; y: number } {
    const e = this.reference.samples.elapsedMs;
    const t = this.raceT / this.pace.scale;
    let lo = 0;
    let hi = e.length - 1;
    if (t >= e[hi]) return { x: sim.samples.x[0], y: sim.samples.y[0] };
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (e[m] <= t) lo = m;
      else hi = m;
    }
    return { x: sim.samples.x[lo], y: sim.samples.y[lo] };
  }

  private sectorPlan: SectorTime[] | null = null;

  /** Sector times for this lap, coloured against the perfect lap and your bests before it. */
  private planSectors(sim: SimulationResult): SectorTime[] {
    const bests = loadSectorBests(this.store, this.track.version);
    const last = sim.sectors.length - 1;
    return sim.sectors.map((sec, k) => {
      const deltaMs = sec.timeMs - (this.reference.sectors[k]?.timeMs ?? sec.timeMs);
      const tone: SectorTone = deltaMs <= 50 ? "purple" : !bests || sec.timeMs < bests[k] ? "green" : "yellow";
      const doneAtMs = k === last || sec.endIndex <= sec.startIndex ? sim.rawLapTimeMs : sim.samples.elapsedMs[sec.endIndex];
      return { ms: sec.timeMs, tone, doneAtMs, deltaMs };
    });
  }

  /** Per corner group: time lost vs the perfect lap, its colour, and when its tile reveals. */
  private computeGrades(sim: SimulationResult): GroupGrade[] {
    const cmp = compareRuns(sim, this.reference).corners;
    const corners = this.track.corners;
    const deltas = new Array(this.controls.complexes.length).fill(0);
    corners.forEach((c, j) => {
      const g = this.complexOfCorner.get(c.name) ?? this.nearestComplex(c.name);
      if (g >= 0) deltas[g] += cmp[j].deltaMs;
    });
    return this.controls.complexes.map((cx, i) => {
      const last = corners.findIndex((c) => c.name === cx.corners[cx.corners.length - 1]);
      const startIdx = corners[last].timingStartIndex;
      const endIdx = corners[(last + 1) % corners.length].timingStartIndex;
      const revealAtMs = endIdx <= startIdx ? sim.rawLapTimeMs : sim.samples.elapsedMs[endIdx];
      return { name: cx.name, deltaMs: deltas[i], grade: gradeFor(deltas[i]), revealAtMs };
    });
  }

  /** End the session: results stay visible but no more laps. */
  lock() {
    this.locked = true;
    this.emit();
  }

  skip() {
    if ((this.phase === "race" || this.phase === "lights") && this.sim) this.demo ? this.finishDemo() : this.finishRace();
  }

  private challengeSim: SimulationResult | null = null;
  /** Your best lap as it stood before the lap just driven, for the duel map. */
  private prevBestSim: SimulationResult | null = null;
  private mapView: MapView = "corners";

  private mapViews(): MapView[] {
    const v: MapView[] = ["corners"];
    if (this.prevBestSim) v.push("best");
    if (this.challengeSim) v.push("challenge");
    return v;
  }

  setMapView(view: MapView) {
    if (!this.mapViews().includes(view)) return;
    this.mapView = view;
    this.dirty = true;
    this.emit();
  }

  private demo = false;
  /** The perfect line, resolved for drawing, once revealed. */
  private perfectXY: { x: Float64Array; y: Float64Array } | null = null;
  private ownXY: { x: Float64Array; y: Float64Array } | null = null;

  /**
   * Run the perfect lap as a demo, with full race presentation (every split
   * purple). Only once the session is over (the daily is locked), so it can
   * never spoil a lap still to be driven. Nothing it does is recorded.
   */
  watchPerfect() {
    if (!this.locked || (this.phase !== "setup" && this.phase !== "result")) return;
    const sim = this.reference;
    this.demo = true;
    this.sim = sim;
    this.result = null;
    this.grades = this.computeGrades(sim);
    this.sectorPlan = sim.sectors.map((sec, k) => ({
      ms: sec.timeMs,
      tone: "purple" as const,
      doneAtMs: k === sim.sectors.length - 1 || sec.endIndex <= sec.startIndex ? sim.rawLapTimeMs : sim.samples.elapsedMs[sec.endIndex],
      deltaMs: 0,
    }));
    this.pace = { label: "Perfect", medal: "perfect", scale: 1 };
    const line = resolveLine(this.pt, this.optimal, this.car);
    this.perfectXY = { x: line.x, y: line.y };
    this.ownXY ??= this.lineXY;
    this.lineXY = this.perfectXY;
    this.raceT = 0;
    this.phase = "lights";
    this.lightsT0 = performance.now();
    this.lightsLit = 0;
    this.lightsHold = 300;
    this.lightMs = LIGHT_MS_REPEAT;
    this.skids = [];
    this.spray = [];
    this.sprayFrom = null;
    this.prevWheels = null;
    this.sparks = [];
    this.prevSpeed = 0;
    this.camera.animateTo(sim.samples.x[0], sim.samples.y[0], RACE_TRACK_PX_SLOW / this.track.widthMeters, this.headingAt(0) - Math.PI / 2, 450);
    if (soundEnabled()) engine.resume();
    logEvent("perfect_watched", { track: this.track.id });
    this.emit();
  }

  /** After the demo: back to the circuit with the perfect line drawn under your own. */
  private finishDemo() {
    this.demo = false;
    this.lineXY = this.ownXY ?? this.lineXY;
    this.phase = "setup";
    this.sim = null;
    this.grades = null;
    engine.silence();
    this.showOverview();
    this.emit();
  }

  private finishRace() {
    const sim = this.sim!;
    const before = loadSectorBests(this.store, this.track.version);
    saveSectorBests(
      this.store,
      this.track.version,
      sim.sectors.map((sec, k) => Math.min(sec.timeMs, before?.[k] ?? Infinity)),
    );
    this.raceT = sim.rawLapTimeMs;
    const cmp = compareRuns(sim, this.reference);
    const pbBefore = this.pb?.lapTimeMs ?? null;
    const newPb = pbBefore === null || sim.lapTimeMs < pbBefore;
    if (newPb) {
      this.pb = { lapTimeMs: sim.lapTimeMs, knotOffsets: this.z.slice(), at: Date.now() };
      savePB(this.store, this.track.version, this.pb);
      this.pbSim = sim;
    }
    this.attempts++;
    this.lapsUsed++;
    const grades = this.grades ?? this.computeGrades(sim);
    const allPurple = grades.every((g) => g.grade === "purple");
    this.result = {
      lapTimeMs: sim.lapTimeMs,
      targetMs: this.reference.lapTimeMs,
      deltaTargetMs: sim.lapTimeMs - this.reference.lapTimeMs,
      pbBeforeMs: pbBefore,
      newPb,
      losses: cmp.corners
        .map((c) => ({ name: c.name, deltaMs: c.deltaMs, complex: this.complexOfCorner.get(c.name) ?? this.nearestComplex(c.name) }))
        .sort((a, b) => b.deltaMs - a.deltaMs),
      grades,
      allPurple,
    };
    this.phase = "result";
    if (this.opts.lapLimit !== null && this.lapsUsed >= this.opts.lapLimit) this.locked = true;
    engine.silence();
    this.frameResult();
    this.onLap?.({ lapTimeMs: sim.lapTimeMs, deltas: grades.map((g) => g.deltaMs), grades: grades.map((g) => g.grade), allPurple, knots: this.z.slice() });
    logEvent("run_completed", { track: this.track.id, lapTimeMs: sim.lapTimeMs, deltaMs: this.result.deltaTargetMs, newPb, attempt: this.attempts });
    trackEvent("Lap finished", { mode: this.opts.mode, circuit: this.track.id, attempt: this.attempts });
    this.emit();
  }

  /** Corner timing segments exist for flat-out corners too; map those to the nearest group. */
  private nearestComplex(cornerName: string): number {
    const c = this.track.corners.find((k) => k.name === cornerName);
    if (!c) return -1;
    const n = this.pt.n;
    let best = -1;
    let bd = Infinity;
    this.controls.complexes.forEach((cx, i) =>
      cx.gates.forEach((g) => {
        const d = Math.min((g.index - c.apexIndex + n) % n, (c.apexIndex - g.index + n) % n);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }),
    );
    return best;
  }

  /**
   * The corner coach for the last lap. `why` compares your speed with the
   * perfect lap's at the corner (entry, slowest point, exit) and names the
   * biggest loss. `hint` (opt-in) names the point in the corner's group that is
   * furthest from the perfect line and which way to move it.
   */
  coach(cornerName: string): { why: string; hint: string } | null {
    const sim = this.sim;
    const corners = this.track.corners;
    const j = corners.findIndex((c) => c.name === cornerName);
    if (!sim || j < 0) return null;
    const n = this.pt.n;
    const c = corners[j];
    const P = sim.samples.speed;
    const R = this.reference.samples.speed;
    const kmh = (v: number) => Math.round(v * 3.6);
    // The corner's timing segment (as the result's per-corner loss uses it),
    // split into the way in, the apex and the exit; the phase where the most
    // time is lost is the one the coach talks about.
    const a = c.timingStartIndex;
    const len = (corners[(j + 1) % corners.length].timingStartIndex - a + n) % n || n;
    const at = (o: number) => (((a + o) % n) + n) % n;
    const elapsed = (e: Float64Array, lap: number, o: number) => e[at(o)] + (a + o >= n ? lap : 0);
    const lost = (o: number) => elapsed(sim.samples.elapsedMs, sim.rawLapTimeMs, o) - elapsed(this.reference.samples.elapsedMs, this.reference.rawLapTimeMs, o);
    const near = Math.round(25 / this.pt.step);
    const oApex = Math.min(len - 1, (c.apexIndex - a + n) % n);
    const cuts = [0, Math.max(0, oApex - near), Math.min(len - 1, oApex + near), len - 1];
    const phaseLoss = [0, 1, 2].map((p) => lost(cuts[p + 1]) - lost(cuts[p]));
    const phase = phaseLoss.indexOf(Math.max(...phaseLoss));
    const range = (from: number, to: number) => Array.from({ length: Math.max(1, to - from + 1) }, (_, k) => from + k);
    // a real braking step loses about 2 m/s per sample; below this it's float noise or lift
    const BRAKE_STEP = 0.4;
    const minOf = (S: Float64Array, os: number[]) => Math.min(...os.map((o) => S[at(o)]));
    let why: string;
    if (Math.max(...phaseLoss) < 15) {
      why = "Small losses all the way through";
    } else if (phase === 0) {
      // brake point: walk back from the slowest point near the apex while the speed keeps rising
      const os = range(cuts[0], cuts[2]);
      const brakePoint = (S: Float64Array) => {
        let o = os.reduce((m, q) => (S[at(q)] < S[at(m)] ? q : m), os[0]);
        for (let k = 0; k < len && S[at(o - 1)] > S[at(o)] + BRAKE_STEP; k++) o--;
        return o;
      };
      const earlier = Math.round(((brakePoint(R) - brakePoint(P)) * this.pt.step) / 5) * 5;
      const dv = kmh(minOf(R, os)) - kmh(minOf(P, os));
      why = earlier >= 10 ? `Braking ${earlier} m earlier than the perfect lap` : dv >= 3 ? `${dv} km/h slower at the turn-in` : "Losing time on the way in";
    } else if (phase === 1) {
      const os = range(cuts[1], cuts[2]);
      const dv = kmh(minOf(R, os)) - kmh(minOf(P, os));
      why = dv >= 2 ? `${dv} km/h slower at the apex` : "Losing time through the apex";
    } else {
      // braking for the next corner inside this one's exit: you slow while the perfect lap still accelerates
      const slowing = (S: Float64Array, o: number) => [0, 1, 2].every((k) => S[at(o + k + 1)] < S[at(o + k)] - BRAKE_STEP);
      let mine = -1;
      // any braking after the apex is for the next corner
      for (let o = oApex; o < cuts[3] - 3; o++) if (slowing(P, o)) {
        mine = o;
        break;
      }
      let ref = -1;
      if (mine >= 0) for (let o = mine; o < mine + len; o++) if (slowing(R, o)) {
        ref = o;
        break;
      }
      const early = mine >= 0 ? Math.round((((ref < 0 ? len : ref) - mine) * this.pt.step) / 5) * 5 : 0;
      const os = range(cuts[2], cuts[3]);
      const dv = Math.round((os.reduce((sum, o) => sum + R[at(o)] - P[at(o)], 0) / os.length) * 3.6);
      const nextName = corners[(j + 1) % corners.length].name;
      why =
        early >= 10
          ? `Braking ${early} m early for ${nextName}`
          : dv >= 2
            ? `${dv} km/h slower on average out of the corner`
            : "Losing time on the exit";
    }

    const k = this.complexOfCorner.get(cornerName) ?? this.nearestComplex(cornerName);
    const opt = this.optimal.knotOffsets;
    let worst: { gate: Complex["gates"][number]; err: number } | null = null;
    for (const g of this.controls.complexes[k]?.gates ?? []) {
      const err = opt[g.knot] - this.z[g.knot];
      if (!worst || Math.abs(err) > Math.abs(worst.err)) worst = { gate: g, err };
    }
    let hint = "Every point here is within 15 cm of the perfect line.";
    if (worst && Math.abs(worst.err) >= 0.15) {
      const name = worst.gate.label === "Apex" && worst.gate.corner ? `Apex ${worst.gate.corner}` : worst.gate.label;
      hint = `${name}: move ${Math.abs(worst.err).toFixed(1)} m ${worst.err > 0 ? "left" : "right"}`;
    }
    return { why, hint };
  }

  /**
   * Speed against distance for the last lap and the perfect lap, downsampled
   * for a chart, with each corner group's position for labels.
   */
  speedTrace(points = 260): { lengthM: number; at: number[]; mine: number[]; perfect: number[]; groups: { name: string; at: number }[] } | null {
    const sim = this.sim;
    if (!sim) return null;
    const { n, s } = this.pt;
    const lengthM = s[n - 1] + this.pt.step;
    const at: number[] = [];
    const mine: number[] = [];
    const perfect: number[] = [];
    for (let k = 0; k < points; k++) {
      const i = Math.min(n - 1, Math.round((k / (points - 1)) * (n - 1)));
      at.push(s[i]);
      mine.push(sim.samples.speed[i] * 3.6);
      perfect.push(this.reference.samples.speed[i] * 3.6);
    }
    const groups = this.controls.complexes.map((cx) => {
      const apex = cx.gates.find((g) => g.label === "Apex") ?? cx.gates[0];
      return { name: cx.name, at: s[apex.index] };
    });
    return { lengthM, at, mine, perfect, groups };
  }

  /** The line as it stands (after a race: the line just raced), for "Beat my lap" links. */
  currentKnots(): number[] {
    return this.z.slice();
  }

  /** Back to setup, at the group containing `cornerName`, or the worst one from the last run. */
  adjust(cornerName?: string) {
    if (this.phase === "race" || this.phase === "lights" || this.locked) return;
    let target = this.sel.complex;
    if (cornerName) target = this.complexOfCorner.get(cornerName) ?? this.nearestComplex(cornerName);
    else if (this.result) {
      const worst = this.result.losses.find((l) => l.complex >= 0);
      if (worst) target = worst.complex;
    }
    this.phase = "setup";
    this.result = null;
    logEvent("retry_clicked", { track: this.track.id, corner: cornerName ?? null });
    this.selectGate(target, 0);
  }

  /** Sample index the car is at, at race time tMs. */
  private indexAt(sim: SimulationResult, tMs: number): number {
    const e = sim.samples.elapsedMs;
    let lo = 0;
    let hi = e.length - 1;
    const t = Math.max(0, Math.min(tMs, sim.rawLapTimeMs));
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (e[m] <= t) lo = m;
      else hi = m;
    }
    return lo;
  }

  /**
   * Per-sample motion for drawing, worked out once per lap: a heading smoothed
   * over neighbouring samples (so the car turns, rather than snapping from one
   * segment's angle to the next), front-wheel steer from path curvature,
   * braking effort and lateral load. Presentation only; lap times never read it.
   */
  private motion = new WeakMap<SimulationResult, { heading: Float32Array; steer: Float32Array; brake: Float32Array; load: Float32Array }>();

  private motionOf(sim: SimulationResult) {
    let m = this.motion.get(sim);
    if (m) return m;
    const { x, y, speed, elapsedMs } = sim.samples;
    const n = x.length;
    const at = (i: number) => (i + n) % n;
    const heading = new Float32Array(n);
    for (let i = 0; i < n; i++) heading[i] = Math.atan2(y[at(i + 2)] - y[at(i - 2)], x[at(i + 2)] - x[at(i - 2)]);
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    const steer = new Float32Array(n);
    const brake = new Float32Array(n);
    const load = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = at(i - 3);
      const b = at(i + 3);
      const ds = Math.hypot(x[b] - x[a], y[b] - y[a]) || 1;
      const curv = wrap(heading[b] - heading[a]) / ds;
      // wheel angle for a 3.6 m wheelbase, doubled so it reads from above
      steer[i] = Math.max(-0.42, Math.min(0.42, Math.atan(curv * 3.6) * 2));
      // lateral acceleration in g, signed (left positive), mapped to -1..1 at 5 g
      load[i] = Math.max(-1, Math.min(1, (speed[i] * speed[i] * curv) / 9.81 / 5));
      // time between the neighbours, across the line where the lap wraps
      let span = elapsedMs[at(i + 1)] - elapsedMs[at(i - 1)];
      if (span <= 0) span += sim.rawLapTimeMs;
      const decel = (speed[at(i - 1)] - speed[at(i + 1)]) / (span / 1000);
      brake[i] = Math.max(0, Math.min(1, (decel - 12) / 30));
    }
    // ease the braking signal in and out over a few samples, like a disc heating and cooling
    const soft = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = -3; k <= 3; k++) sum += brake[at(i + k)];
      soft[i] = sum / 7;
    }
    m = { heading, steer, brake: soft, load };
    this.motion.set(sim, m);
    return m;
  }

  private sampleAt(sim: SimulationResult, tMs: number) {
    const { elapsedMs, x, y, speed } = sim.samples;
    const n = elapsedMs.length;
    const t = Math.max(0, Math.min(tMs, sim.rawLapTimeMs));
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (elapsedMs[m] <= t) lo = m;
      else hi = m;
    }
    const j = (lo + 1) % n;
    const t1 = j === 0 ? sim.rawLapTimeMs : elapsedMs[j];
    const f = t1 > elapsedMs[lo] ? (t - elapsedMs[lo]) / (t1 - elapsedMs[lo]) : 0;
    const mo = this.motionOf(sim);
    const h0 = mo.heading[lo];
    const dh = Math.atan2(Math.sin(mo.heading[j] - h0), Math.cos(mo.heading[j] - h0));
    const mix = (a: Float32Array) => a[lo] + (a[j] - a[lo]) * f;
    return {
      x: x[lo] + (x[j] - x[lo]) * f,
      y: y[lo] + (y[j] - y[lo]) * f,
      heading: h0 + dh * f,
      speed: speed[lo] + (speed[j] - speed[lo]) * f,
      steer: mix(mo.steer),
      brake: mix(mo.brake),
      load: mix(mo.load),
    };
  }

  // ------------------------------------------------------------ input
  private local(e: PointerEvent | WheelEvent): [number, number] {
    const r = this.canvas!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private minimapRect(): [number, number, number, number] {
    const { w, h } = this.camera;
    const size = Math.min(120, Math.max(84, Math.min(w, h) * 0.24));
    const [x0, y0, x1, y1] = this.bbox;
    const aspect = (x1 - x0) / (y1 - y0);
    const mw = aspect >= 1 ? size : size * aspect;
    const mh = aspect >= 1 ? size / aspect : size;
    return [w - mw - 16 - this.insets.right, 16 + this.insets.top, mw, mh];
  }

  private showMinimap() {
    // the race HUD owns the top of the screen during lights and the lap
    return this.phase === "setup";
  }

  /** Gate puck position on screen. */
  private puckScreen(index: number): [number, number] {
    return this.camera.toScreen(this.lineXY.x[index], this.lineXY.y[index]);
  }

  private onDown(e: PointerEvent) {
    e.preventDefault();
    try {
      this.canvas!.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer */
    }
    const [sx, sy] = this.local(e);
    this.pointers.set(e.pointerId, { x: sx, y: sy, x0: sx, y0: sy });

    if (this.pointers.size === 2) {
      if (this.mode === "puck") this.endEdit();
      const [a, b] = [...this.pointers.values()];
      const mid: [number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      this.pinch0 = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: this.camera.scale, world: this.camera.toWorld(...mid) };
      this.mode = "pinch";
      return;
    }
    if (this.pointers.size > 2) return;

    if (this.phase === "setup") {
      const [mx, my, mw, mh] = this.minimapRect();
      if (sx >= mx - 8 && sx <= mx + mw + 8 && sy >= my - 8 && sy <= my + mh + 8) {
        const [x0, , x1, y1] = this.bbox;
        const scale = mw / (x1 - x0);
        this.jumpToNearest(x0 + (sx - mx) / scale, y1 - (sy - my) / scale);
        this.mode = "none";
        return;
      }
      // Grab a puck in the current group (coarse direct manipulation).
      let best = -1;
      let bd = PUCK_HIT_PX;
      this.complex().gates.forEach((g, j) => {
        const [px, py] = this.puckScreen(g.index);
        const d = Math.hypot(sx - px, sy - py);
        if (d < bd) {
          bd = d;
          best = j;
        }
      });
      if (best >= 0) {
        if (best !== this.sel.gate) {
          this.sel.gate = best;
          this.emit();
        }
        this.mode = "puck";
        this.beginEdit();
        return;
      }
      this.mode = "tap";
      return;
    }
    this.mode = this.phase === "result" ? "pan" : "none";
  }

  private onMove(e: PointerEvent) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const [sx, sy] = this.local(e);
    this.pointers.set(e.pointerId, { ...prev, x: sx, y: sy });

    if (this.mode === "tap" && Math.hypot(sx - prev.x0, sy - prev.y0) > 6) this.mode = "pan";

    if (this.mode === "pinch" && this.pinch0 && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const k = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, this.pinch0.dist);
      const cam = this.camera;
      cam.scale = Math.min(160 / this.track.widthMeters, Math.max(this.overviewScale() * 0.8, this.pinch0.scale * k));
      const mid: [number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const [wx, wy] = cam.toWorld(...mid);
      cam.x += this.pinch0.world[0] - wx;
      cam.y += this.pinch0.world[1] - wy;
      this.dirty = true;
    } else if (this.mode === "pan") {
      this.camera.panBy(sx - prev.x, sy - prev.y);
      this.dirty = true;
    } else if (this.mode === "puck") {
      const i = this.selectedGate().index;
      const [wx, wy] = this.camera.toWorld(sx, sy);
      this.setOffset((wx - this.pt.cx[i]) * this.pt.nx[i] + (wy - this.pt.cy[i]) * this.pt.ny[i]);
    }
  }

  private onUp(e: PointerEvent) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.mode === "puck") this.endEdit();
    if (this.mode === "tap" && this.phase === "setup") this.selectNearestGateOnScreen(p.x, p.y);
    if (this.pointers.size === 0) {
      this.mode = "none";
      this.pinch0 = null;
    } else if (this.mode === "pinch") this.mode = "pan";
  }

  /** Tap: select the nearest gate anywhere on screen (switches group if needed). */
  private selectNearestGateOnScreen(sx: number, sy: number) {
    let best: [number, number] | null = null;
    let bd = 48;
    this.controls.complexes.forEach((cx, ci) =>
      cx.gates.forEach((g, gi) => {
        const [px, py] = this.puckScreen(g.index);
        const d = Math.hypot(sx - px, sy - py);
        if (d < bd) {
          bd = d;
          best = [ci, gi];
        }
      }),
    );
    if (best) this.selectGate(best[0], best[1]);
  }

  private jumpToNearest(wx: number, wy: number) {
    let best = 0;
    let bd = Infinity;
    this.controls.complexes.forEach((cx, ci) =>
      cx.gates.forEach((g) => {
        const d = Math.hypot(this.pt.cx[g.index] - wx, this.pt.cy[g.index] - wy);
        if (d < bd) {
          bd = d;
          best = ci;
        }
      }),
    );
    this.selectGate(best, 0);
  }

  private overviewScale() {
    const [x0, y0, x1, y1] = this.bbox;
    return Math.min(this.camera.w / (x1 - x0), this.camera.h / (y1 - y0)) * 0.88;
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const [sx, sy] = this.local(e);
    this.camera.zoomAt(Math.exp(-e.deltaY * 0.0015), sx, sy, this.overviewScale() * 0.8, 160 / this.track.widthMeters);
    this.dirty = true;
  }

  zoom(k: number) {
    this.camera.zoomAt(k, this.camera.w / 2, this.camera.h / 2, this.overviewScale() * 0.8, 160 / this.track.widthMeters);
    this.dirty = true;
  }

  recenter() {
    if (this.phase === "setup") this.focusGate();
  }

  // ------------------------------------------------------------ frame
  private frame(now: number) {
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    let animating = this.camera.tick(now);

    if (this.phase === "lights") {
      // Five lamps light one by one, hold, then black out: lights out and away we go.
      const t = now - this.lightsT0;
      const lit = Math.min(5, Math.floor(t / this.lightMs));
      if (lit !== this.lightsLit) {
        this.lightsLit = lit;
        this.emit();
      }
      if (soundEnabled()) engine.update(9000 + lit * 600 + Math.random() * 300, 1, 0);
      if (t >= 5 * this.lightMs + this.lightsHold) {
        this.phase = "race";
        this.lastEmit = 0;
        this.emit();
      }
      animating = true;
    } else if (this.phase === "race" && this.sim) {
      this.raceT += dt * 1000 * PLAYBACK_SPEED;
      const p = this.sampleAt(this.sim, this.raceT);
      const kmh = p.speed * 3.6;
      const speed01 = Math.min(1, kmh / 340);
      if (!this.camera.animating) {
        // Heading-up chase cam: close and tight in slow corners, pulling back and
        // looking further ahead as speed builds, so the pace reads on screen.
        // exponential smoothing, so 60 Hz and 120 Hz screens follow the same way
        const ease = (rate: number) => 1 - Math.exp(-dt * rate);
        const k = ease(4);
        const look = 12 + p.speed * 0.55;
        this.camera.x += (p.x + Math.cos(p.heading) * look - this.camera.x) * k;
        this.camera.y += (p.y + Math.sin(p.heading) * look - this.camera.y) * k;
        let da = p.heading - Math.PI / 2 - this.camera.angle;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        this.camera.angle += da * ease(2.6);
        // tuned for a ~400 px wide phone; bigger screens get a proportionally closer camera
        const viewK = Math.min(2.2, Math.max(1, Math.min(this.camera.w, this.camera.h) / 420));
        const targetPx = (RACE_TRACK_PX_SLOW + (RACE_TRACK_PX_FAST - RACE_TRACK_PX_SLOW) * speed01) * viewK;
        const targetScale = targetPx / this.track.widthMeters;
        this.camera.scale += (targetScale - this.camera.scale) * ease(1.6);
      }
      // camera shake above ~260 km/h (kerbs, bumps), off for reduced motion
      const amp = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : Math.max(0, (kmh - 260) / 90) * 1.3;
      // a low rumble from layered sines, not a new random jolt every frame
      const ts = now / 1000;
      this.shake = [
        amp * 0.5 * (Math.sin(ts * 31) * 0.6 + Math.sin(ts * 53 + 1.3) * 0.4),
        amp * 0.5 * (Math.sin(ts * 37 + 0.7) * 0.6 + Math.sin(ts * 61 + 2.1) * 0.4),
      ];
      this.updateEffects(p, dt);
      this.raceKmh = kmh;
      this.updateStreaks(kmh, dt);
      if (soundEnabled()) {
        const d = driveState(kmh);
        engine.update(d.rpm, d.gear, speed01);
      }
      if (now - this.lastEmit > 50) {
        this.lastEmit = now;
        this.emit();
      }
      if (this.raceT >= this.sim.rawLapTimeMs || (this.window && this.raceT >= this.window.endMs + 700)) this.demo ? this.finishDemo() : this.finishRace();
      animating = true;
    } else this.shake = [0, 0];
    if (this.sparks.length || this.spray.length) animating = true;
    if (this.phase !== "race") this.streaks = [];
    if (this.condition === "wet" && this.phase === "race") this.updateRain(dt);
    else this.rain = [];
    if (!animating && !this.dirty) return;
    this.dirty = false;
    this.render();
  }

  private updateStreaks(kmh: number, dt: number) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.streaks = [];
      return;
    }
    const { w, h } = this.camera;
    const speedK = Math.max(0, (kmh - 200) / 140);
    // spawn in the outer 22% of the frame, never over the car in the middle
    if (Math.random() < speedK * dt * 40) {
      const edge = Math.random() < 0.5 ? Math.random() * w * 0.22 : w - Math.random() * w * 0.22;
      this.streaks.push({ x: edge, y: -40, len: 30 + 90 * speedK, v: 900 + 1600 * speedK });
    }
    for (const st of this.streaks) st.y += st.v * dt;
    this.streaks = this.streaks.filter((st) => st.y - st.len < h);
  }

  /** Tyre marks under heavy braking and floor sparks at top speed. */
  private updateEffects(p: { x: number; y: number; heading: number; speed: number }, dt: number) {
    const c = Math.cos(p.heading);
    const s = Math.sin(p.heading);
    const rear = (lat: number): [number, number] => [p.x - c * 1.6 - s * lat, p.y - s * 1.6 + c * lat];
    const [lx, ly] = rear(0.8);
    const [rx, ry] = rear(-0.8);
    const simDt = dt * PLAYBACK_SPEED;
    const decel = simDt > 0 ? (this.prevSpeed - p.speed) / simDt : 0;
    if (this.prevWheels && decel > 22 && this.skids.length < 12000) {
      const [plx, ply, prx, pry] = this.prevWheels;
      this.skids.push(plx, ply, lx, ly, prx, pry, rx, ry);
    }
    this.prevWheels = [lx, ly, rx, ry];
    this.prevSpeed = p.speed;
    // spray: in the wet, the rear tyres throw a plume of water behind the car.
    // Playback runs at 4x, so the car covers metres between frames: seed the
    // spray along the whole stretch it just drove, not only where it is now.
    if (this.condition === "wet" && p.speed > 15) {
      const [ax, ay] = this.sprayFrom ?? [p.x, p.y];
      const dist = Math.hypot(p.x - ax, p.y - ay);
      const n = Math.min(24, Math.ceil(dist / 0.7) + 1);
      for (let k = 0; k < n && this.spray.length < 420; k++) {
        const f = Math.random();
        const lat = (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.4);
        const bx = ax + (p.x - ax) * f - c * 1.8 - s * lat;
        const by = ay + (p.y - ay) * f - s * 1.8 + c * lat;
        const spread = (Math.random() - 0.5) * 7;
        const back = p.speed * (0.06 + Math.random() * 0.08);
        const life = 0.45 + Math.random() * 0.35;
        this.spray.push({ x: bx, y: by, vx: -c * back - s * spread, vy: -s * back + c * spread, life, max: life });
      }
    }
    this.sprayFrom = [p.x, p.y];
    for (const sp of this.spray) {
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vx *= 1 - dt * 2.5;
      sp.vy *= 1 - dt * 2.5;
      sp.life -= dt;
    }
    this.spray = this.spray.filter((sp) => sp.life > 0);
    // sparks: titanium skid blocks touching down at very high speed (not in the wet)
    if (this.condition !== "wet" && p.speed * 3.6 > 285 && Math.random() < dt * 18) {
      for (let k = 0; k < 6; k++) {
        const spread = (Math.random() - 0.5) * 10;
        this.sparks.push({
          x: p.x - c * 2.4,
          y: p.y - s * 2.4,
          vx: -c * (18 + Math.random() * 20) - s * spread,
          vy: -s * (18 + Math.random() * 20) + c * spread,
          life: 0.18 + Math.random() * 0.2,
        });
      }
    }
    for (const sp of this.sparks) {
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.life -= dt;
    }
    this.sparks = this.sparks.filter((sp) => sp.life > 0);
  }

  private vignetteCache: { w: number; h: number; c: HTMLCanvasElement } | null = null;

  /** A soft dark falloff toward the frame edges, rendered once per canvas size. */
  private vignette(): HTMLCanvasElement {
    const { w, h } = this.camera;
    if (this.vignetteCache?.w === w && this.vignetteCache.h === h) return this.vignetteCache.c;
    const c = document.createElement("canvas");
    // half resolution is plenty for a gradient this soft
    c.width = Math.max(1, Math.round(w / 2));
    c.height = Math.max(1, Math.round(h / 2));
    const g2 = c.getContext("2d")!;
    const r = Math.hypot(c.width, c.height) / 2;
    const g = g2.createRadialGradient(c.width / 2, c.height * 0.55, r * 0.45, c.width / 2, c.height * 0.55, r * 1.05);
    g.addColorStop(0, "rgba(6,7,9,0)");
    g.addColorStop(1, "rgba(6,7,9,0.42)");
    g2.fillStyle = g;
    g2.fillRect(0, 0, c.width, c.height);
    this.vignetteCache = { w, h, c };
    return c;
  }

  /** Rain across the lens: short slanted streaks falling fast, denser than the wind streaks. */
  private updateRain(dt: number) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.rain = [];
      return;
    }
    const { w, h } = this.camera;
    const want = Math.min(140, Math.round((w * h) / 9000));
    while (this.rain.length < want) this.rain.push({ x: Math.random() * (w + 120) - 60, y: Math.random() * h - h, len: 10 + Math.random() * 14, v: 900 + Math.random() * 500 });
    for (const r of this.rain) {
      r.y += r.v * dt;
      r.x -= r.v * dt * 0.18;
      if (r.y - r.len > h) {
        r.y = -r.len - Math.random() * 60;
        r.x = Math.random() * (w + 120) - 60;
      }
    }
  }

  private render() {
    const ctx = this.ctx;
    if (!ctx) return;
    const cam = this.camera;
    const px = 1 / cam.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.scenery.groundColor;
    ctx.fillRect(0, 0, this.canvas!.width, this.canvas!.height);

    cam.x += this.shake[0] / cam.scale;
    cam.y += this.shake[1] / cam.scale;
    cam.apply(ctx, this.dpr);
    cam.x -= this.shake[0] / cam.scale;
    cam.y -= this.shake[1] / cam.scale;
    this.scenery.draw(ctx, px);
    if (this.condition === "wet") {
      // a wet day: everything a shade darker and cooler, as under cloud on a damp track
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "rgba(16,26,42,0.14)";
      ctx.fillRect(0, 0, this.canvas!.width, this.canvas!.height);
      ctx.restore();
    }
    if (this.skids.length && this.phase !== "setup") {
      ctx.strokeStyle = "rgba(8,8,10,0.34)";
      ctx.lineWidth = 0.32;
      ctx.lineCap = "butt";
      ctx.beginPath();
      for (let i = 0; i < this.skids.length; i += 4) {
        ctx.moveTo(this.skids[i], this.skids[i + 1]);
        ctx.lineTo(this.skids[i + 2], this.skids[i + 3]);
      }
      ctx.stroke();
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (this.phase === "result" && this.sim) {
      const other = this.mapView === "best" ? this.prevBestSim : this.mapView === "challenge" ? this.challengeSim : null;
      if (other) this.drawDuel(ctx, px, other, this.mapView === "challenge" ? C.paint : C.steel);
      else this.drawHeatmap(ctx, px);
    }
    else {
      const { x, y } = this.lineXY;
      const path = new Path2D();
      for (let i = 0; i <= this.pt.n; i++) {
        const j = i % this.pt.n;
        if (i) path.lineTo(x[j], y[j]);
        else path.moveTo(x[j], y[j]);
      }
      if (this.perfectXY && this.phase === "setup") {
        // the revealed perfect line, in purple, under your own
        const p = new Path2D();
        for (let i = 0; i <= this.pt.n; i++) {
          const j = i % this.pt.n;
          if (i) p.lineTo(this.perfectXY.x[j], this.perfectXY.y[j]);
          else p.moveTo(this.perfectXY.x[j], this.perfectXY.y[j]);
        }
        ctx.strokeStyle = C.purple;
        ctx.lineWidth = 3 * px;
        ctx.stroke(p);
      }
      if (this.phase === "setup") {
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.lineWidth = 5.5 * px;
        ctx.stroke(path);
      }
      ctx.strokeStyle = this.demo ? C.purple : this.phase === "race" ? C.inkDim : C.ink;
      ctx.lineWidth = (this.phase === "race" ? 2 : 3) * px;
      ctx.stroke(path);
    }
    if (this.phase === "setup") this.drawGateLines(ctx, px);

    if (this.phase !== "setup" && this.sim) {
      if (this.pbSim && this.phase === "race") {
        const g = this.sampleAt(this.pbSim, this.raceT);
        this.cars.draw(ctx, g.x, g.y, g.heading, px, true, g);
      }
      if (this.phase === "race" && !this.demo) {
        // pace marker: a ring in the target medal's colour, riding your own line
        const m = this.pacePoint(this.sim);
        ctx.beginPath();
        ctx.arc(m.x, m.y, 7 * px, 0, Math.PI * 2);
        ctx.lineWidth = 2.5 * px;
        ctx.strokeStyle = this.pace.medal === "perfect" || this.pace.medal === "pole" ? C.purple : this.pace.medal === "challenge" ? C.paint : MEDAL_COLOR[this.pace.medal];
        ctx.fillStyle = "rgba(10,11,13,0.55)";
        ctx.fill();
        ctx.stroke();
      }
      const p = this.sampleAt(this.sim, this.raceT);
      if (this.spray.length) {
        // under the car: soft white puffs that grow and fade as they hang in the air
        for (const sp of this.spray) {
          const u = sp.life / sp.max;
          ctx.fillStyle = `rgba(214,220,228,${(0.09 * u).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 0.8 + (1 - u) * 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      this.cars.draw(ctx, p.x, p.y, p.heading, px, false, p);
      if (this.sparks.length) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        for (const sp of this.sparks) {
          const a = Math.max(0, Math.min(1, sp.life / 0.25));
          ctx.strokeStyle = `rgba(255,${170 + Math.round(60 * a)},90,${a})`;
          ctx.lineWidth = Math.max(0.12, 1.4 * px);
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y);
          ctx.lineTo(sp.x - sp.vx * 0.03, sp.y - sp.vy * 0.03);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    this.scenery.drawClouds(ctx, performance.now() / 1000, px);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // broadcast lens: the frame's corners fall off a little, drawing the eye to the car
    if (this.phase !== "setup") ctx.drawImage(this.vignette(), 0, 0, cam.w, cam.h);
    if (this.rain.length) {
      ctx.strokeStyle = "rgba(205,214,228,0.22)";
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const r of this.rain) {
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x + r.len * 0.18, r.y - r.len);
      }
      ctx.stroke();
    }
    if (this.phase === "race" && this.streaks.length) {
      ctx.strokeStyle = `rgba(238,237,230,${0.05 + 0.1 * Math.min(1, Math.max(0, (this.raceKmh - 200) / 140))})`;
      ctx.lineWidth = 1.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const st of this.streaks) {
        ctx.moveTo(st.x, st.y);
        ctx.lineTo(st.x, st.y - st.len);
      }
      ctx.stroke();
    }
    if (this.phase === "setup") {
      this.drawCornerLabels(ctx);
      this.drawPucks(ctx);
    }
    if (this.phase === "result") this.drawLossLabels(ctx);
    if (this.showMinimap()) this.drawMinimap(ctx);
  }

  /** Cross-track lines at the current group's gates; the selected one is bright. */
  private drawGateLines(ctx: CanvasRenderingContext2D, px: number) {
    const { cx, cy, nx, ny } = this.pt;
    const W = this.track.widthMeters / 2;
    this.complex().gates.forEach((g, j) => {
      const i = g.index;
      const sel = j === this.sel.gate;
      ctx.strokeStyle = sel ? "rgba(236,235,228,0.9)" : "rgba(236,235,228,0.3)";
      ctx.lineWidth = (sel ? 2 : 1.2) * px;
      ctx.setLineDash(sel ? [] : [4 * px, 4 * px]);
      ctx.beginPath();
      ctx.moveTo(cx[i] + nx[i] * W, cy[i] + ny[i] * W);
      ctx.lineTo(cx[i] - nx[i] * W, cy[i] - ny[i] * W);
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  private drawPucks(ctx: CanvasRenderingContext2D) {
    const { w, h } = this.camera;
    this.controls.complexes.forEach((cx, ci) => {
      if (ci === this.sel.complex) return;
      for (const g of cx.gates) {
        const [sx, sy] = this.puckScreen(g.index);
        if (sx < -10 || sy < -10 || sx > w + 10 || sy > h + 10) continue;
        ctx.fillStyle = "rgba(236,235,228,0.35)";
        ctx.beginPath();
        ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    this.complex().gates.forEach((g, j) => {
      const [sx, sy] = this.puckScreen(g.index);
      const sel = j === this.sel.gate;
      ctx.fillStyle = sel ? C.ink : C.paint;
      ctx.strokeStyle = sel ? C.paint : C.ink;
      ctx.lineWidth = sel ? 3 : 2;
      ctx.beginPath();
      ctx.arc(sx, sy, sel ? 11 : 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  /**
   * Mini-sector duel (the "track dominance" map): the lap split into 25
   * equal-length mini-sectors, each drawn in the colour of whichever lap was
   * quicker through it; orange is you.
   */
  private drawDuel(ctx: CanvasRenderingContext2D, px: number, other: SimulationResult, otherColour: string) {
    const sim = this.sim!;
    const { x, y } = this.lineXY;
    const n = this.pt.n;
    const segs = 25;
    const all = new Path2D();
    for (let i = 0; i <= n; i++) i ? all.lineTo(x[i % n], y[i % n]) : all.moveTo(x[0], y[0]);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 7.5 * px;
    ctx.stroke(all);
    ctx.lineWidth = 4.5 * px;
    const at = (s: SimulationResult, i: number) => (i >= n ? s.rawLapTimeMs : s.samples.elapsedMs[i]);
    for (let k = 0; k < segs; k++) {
      const a = Math.floor((k * n) / segs);
      const b = Math.floor(((k + 1) * n) / segs);
      const mine = at(sim, b) - at(sim, a);
      const theirs = at(other, b) - at(other, a);
      ctx.strokeStyle = Math.abs(mine - theirs) < 5 ? "#5c6168" : mine < theirs ? C.ink : otherColour;
      ctx.beginPath();
      for (let i = a; i <= Math.min(b, n); i++) {
        const j = i % n;
        if (i === a) ctx.moveTo(x[j], y[j]);
        else ctx.lineTo(x[j], y[j]);
      }
      ctx.stroke();
    }
  }

  private drawHeatmap(ctx: CanvasRenderingContext2D, px: number) {
    const { x, y } = this.lineXY;
    const corners = this.track.corners;
    const n = this.pt.n;
    const cmp = compareRuns(this.sim!, this.reference).corners;
    const all = new Path2D();
    for (let i = 0; i <= n; i++) i ? all.lineTo(x[i % n], y[i % n]) : all.moveTo(x[0], y[0]);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 7.5 * px;
    ctx.stroke(all);
    ctx.lineWidth = 4.5 * px;
    corners.forEach((c, j) => {
      const a = c.timingStartIndex;
      const b = corners[(j + 1) % corners.length].timingStartIndex;
      const len = (b - a + n) % n || n;
      ctx.strokeStyle = lossColor(cmp[j].deltaMs);
      ctx.beginPath();
      for (let o = 0; o <= len; o++) {
        const i = (a + o) % n;
        if (o) ctx.lineTo(x[i], y[i]);
        else ctx.moveTo(x[i], y[i]);
      }
      ctx.stroke();
    });
  }

  private labelPos(apexIndex: number, direction: "left" | "right", offsetPx: number): [number, number] {
    const i = apexIndex;
    const out = direction === "left" ? -1 : 1;
    const d = this.track.widthMeters / 2 + offsetPx / this.camera.scale;
    return this.camera.toScreen(this.pt.cx[i] + out * this.pt.nx[i] * d, this.pt.cy[i] + out * this.pt.ny[i] * d);
  }

  private drawCornerLabels(ctx: CanvasRenderingContext2D) {
    ctx.font = "700 11px 'Archivo Variable', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const c of this.track.corners) {
      if (!this.complexOfCorner.has(c.name)) continue;
      ctx.fillStyle = this.complex().corners.includes(c.name) ? C.paint : C.steel;
      const [sx, sy] = this.labelPos(c.apexIndex, c.direction, 18);
      ctx.fillText(c.name, sx, sy);
    }
  }

  private drawLossLabels(ctx: CanvasRenderingContext2D) {
    if (!this.result) return;
    const worst = this.result.losses.filter((l) => l.deltaMs > 50).slice(0, 3);
    ctx.font = "700 12px 'Archivo Variable', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const l of worst) {
      const c = this.track.corners.find((k) => k.name === l.name)!;
      const [sx, sy] = this.labelPos(c.apexIndex, c.direction, 22);
      const text = `${l.name} +${(l.deltaMs / 1000).toFixed(2)}`;
      const tw = ctx.measureText(text).width + 12;
      ctx.fillStyle = C.board;
      ctx.fillRect(sx - tw / 2, sy - 10, tw, 20);
      ctx.fillStyle = lossColor(l.deltaMs);
      ctx.fillText(text, sx, sy + 0.5);
    }
  }

  private drawMinimap(ctx: CanvasRenderingContext2D) {
    const [mx, my, mw, mh] = this.minimapRect();
    const [x0, , x1, y1] = this.bbox;
    const s = mw / (x1 - x0);
    const X = (wx: number) => mx + (wx - x0) * s;
    const Y = (wy: number) => my + (y1 - wy) * s;
    ctx.fillStyle = "rgba(12,13,15,0.82)";
    ctx.fillRect(mx - 8, my - 8, mw + 16, mh + 16);
    ctx.lineJoin = "round";
    ctx.strokeStyle = C.steel;
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.track.centerline.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.closePath();
    ctx.stroke();
    if (this.phase === "race" && this.sim) {
      const p = this.sampleAt(this.sim, this.raceT);
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 3.5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    this.controls.complexes.forEach((cx, ci) => {
      const g = cx.gates[Math.floor(cx.gates.length / 2)];
      const cur = ci === this.sel.complex;
      ctx.fillStyle = cur ? C.ink : "rgba(236,235,228,0.55)";
      ctx.beginPath();
      ctx.arc(X(this.pt.cx[g.index]), Y(this.pt.cy[g.index]), cur ? 4 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
