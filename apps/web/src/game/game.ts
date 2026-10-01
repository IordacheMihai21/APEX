import {
  APEX_FORMULA as car,
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
import { CATALOG } from "./catalog";
import { Scenery } from "./scenery";
import type { SceneryData } from "./surroundings";
import { C, lossColor } from "./palette";
import { type PersonalBest, loadPB, logEvent, savePB } from "./storage";
import { type Grade, type GroupGrade, gradeFor } from "../modes/grading";
import { type DriveState, driveState } from "./drive";
import { engine, soundEnabled } from "./audio";

export type Phase = "setup" | "lights" | "race" | "result";
export type Mode = "daily" | "season" | "practice";

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
}

export interface LapEvent {
  lapTimeMs: number;
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
const RACE_TRACK_PX_SLOW = 70;
const RACE_TRACK_PX_FAST = 44;
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
  private readonly cars = new CarSprites();
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
  private raceKmh = 0;

  constructor(track: GameTrack, opts: GameOptions = { mode: "practice", lapLimit: null }) {
    this.opts = opts;
    this.lapsUsed = opts.lapsUsed ?? 0;
    this.locked = !!opts.locked;
    this.track = track;
    this.pt = prepareTrack(track);
    this.controls = trackControls(this.pt);
    this.limit = usableHalfWidth(this.pt, car);
    this.reference = simulateLap({ track: this.pt, line: track.optimalLine!, car });
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

    this.pb = loadPB(track.id, track.version);
    // Continue from the session's last line, else (practice) your best line, else the centerline.
    const pbLine = opts.mode === "practice" && this.pb?.knotOffsets.length === this.pt.k ? this.pb.knotOffsets : null;
    const start = opts.startKnots?.length === this.pt.k ? opts.startKnots : (pbLine ?? new Array(this.pt.k).fill(0));
    this.z = expandGates(this.pt, this.controls, start, this.limit);
    this.lineXY = this.resolve();
    if (this.pb) this.pbSim = simulateLap({ track: this.pt, line: { knotOffsets: this.pb.knotOffsets }, car });
    if (opts.challengeKnots?.length === this.pt.k) {
      // re-simulated here, so the time on the link can't be anything but what that line drives
      const line = expandGates(this.pt, this.controls, opts.challengeKnots, this.limit);
      this.challengeMs = simulateLap({ track: this.pt, line: { knotOffsets: line }, car }).lapTimeMs;
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
    const r = resolveLine(this.pt, { knotOffsets: this.z }, car);
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
    const c = ((complex % nc) + nc) % nc;
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
    const sim = simulateLap({ track: this.pt, line: { knotOffsets: this.z }, car });
    if (!sim.valid) return; // expandGates keeps lines valid; defensive only
    if (this.locked || (this.opts.lapLimit !== null && this.lapsUsed >= this.opts.lapLimit)) return;
    this.sim = sim;
    this.grades = this.computeGrades(sim);
    this.pace = this.paceTarget();
    this.raceT = 0;
    this.phase = "lights";
    this.lightsT0 = performance.now();
    this.lightsLit = 0;
    // lights hold 0.2–1.0 s after the fifth, like the real start; shorter from the second lap on
    this.lightsHold = this.attempts === 0 ? 200 + Math.random() * 800 : 150 + Math.random() * 300;
    this.lightMs = this.attempts === 0 ? LIGHT_MS_FIRST : LIGHT_MS_REPEAT;
    this.skids = [];
    this.prevWheels = null;
    this.sparks = [];
    this.prevSpeed = 0;
    this.lastRaced = this.z.join(",");
    this.camera.animateTo(sim.samples.x[0], sim.samples.y[0], RACE_TRACK_PX_SLOW / this.track.widthMeters, this.headingAt(0) - Math.PI / 2, 450);
    if (soundEnabled()) engine.resume();
    logEvent("run_started", { track: this.track.id, mode: this.opts.mode });
    this.emit();
  }

  /** Pace for this lap: the next medal above your personal best (by time), or the perfect lap once Gold is yours. */
  private pace: { label: string; medal: Medal | "perfect" | "challenge"; scale: number } = { label: "Perfect", medal: "perfect", scale: 1 };

  /** The challenger's re-simulated lap time, when racing a link. */
  private challengeMs: number | null = null;

  private paceTarget(): { label: string; medal: Medal | "perfect" | "challenge"; scale: number } {
    if (this.challengeMs !== null) return { label: "Challenge", medal: "challenge", scale: this.challengeMs / this.reference.lapTimeMs };
    const pbMedal = this.pb ? medalFor(this.track.id, this.pb.lapTimeMs, []) : null;
    const next = nextMedal(this.track.id, pbMedal);
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
    if ((this.phase === "race" || this.phase === "lights") && this.sim) this.finishRace();
  }

  private finishRace() {
    const sim = this.sim!;
    this.raceT = sim.rawLapTimeMs;
    const cmp = compareRuns(sim, this.reference);
    const pbBefore = this.pb?.lapTimeMs ?? null;
    const newPb = pbBefore === null || sim.lapTimeMs < pbBefore;
    if (newPb) {
      this.pb = { lapTimeMs: sim.lapTimeMs, knotOffsets: this.z.slice(), at: Date.now() };
      savePB(this.track.id, this.track.version, this.pb);
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
    this.onLap?.({ lapTimeMs: sim.lapTimeMs, grades: grades.map((g) => g.grade), allPurple, knots: this.z.slice() });
    logEvent("run_completed", { track: this.track.id, lapTimeMs: sim.lapTimeMs, deltaMs: this.result.deltaTargetMs, newPb, attempt: this.attempts });
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
    const opt = this.track.optimalLine!.knotOffsets;
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
    return {
      x: x[lo] + (x[j] - x[lo]) * f,
      y: y[lo] + (y[j] - y[lo]) * f,
      heading: Math.atan2(y[j] - y[lo], x[j] - x[lo]),
      speed: speed[lo] + (speed[j] - speed[lo]) * f,
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
        const k = Math.min(1, dt * 4);
        const look = 12 + p.speed * 0.55;
        this.camera.x += (p.x + Math.cos(p.heading) * look - this.camera.x) * k;
        this.camera.y += (p.y + Math.sin(p.heading) * look - this.camera.y) * k;
        let da = p.heading - Math.PI / 2 - this.camera.angle;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        this.camera.angle += da * Math.min(1, dt * 2.6);
        // tuned for a ~400 px wide phone; bigger screens get a proportionally closer camera
        const viewK = Math.min(2.2, Math.max(1, Math.min(this.camera.w, this.camera.h) / 420));
        const targetPx = (RACE_TRACK_PX_SLOW + (RACE_TRACK_PX_FAST - RACE_TRACK_PX_SLOW) * speed01) * viewK;
        const targetScale = targetPx / this.track.widthMeters;
        this.camera.scale += (targetScale - this.camera.scale) * Math.min(1, dt * 1.6);
      }
      // camera shake above ~260 km/h (kerbs, bumps), off for reduced motion
      const amp = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : Math.max(0, (kmh - 260) / 90) * 1.3;
      this.shake = [(Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp];
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
      if (this.raceT >= this.sim.rawLapTimeMs) this.finishRace();
      animating = true;
    } else this.shake = [0, 0];
    if (this.sparks.length) animating = true;
    if (this.phase !== "race") this.streaks = [];
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
    // sparks: titanium skid blocks touching down at very high speed
    if (p.speed * 3.6 > 285 && Math.random() < dt * 18) {
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

    if (this.phase === "result" && this.sim) this.drawHeatmap(ctx, px);
    else {
      const { x, y } = this.lineXY;
      const path = new Path2D();
      for (let i = 0; i <= this.pt.n; i++) {
        const j = i % this.pt.n;
        if (i) path.lineTo(x[j], y[j]);
        else path.moveTo(x[j], y[j]);
      }
      if (this.phase === "setup") {
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.lineWidth = 5.5 * px;
        ctx.stroke(path);
      }
      ctx.strokeStyle = this.phase === "race" ? C.inkDim : C.ink;
      ctx.lineWidth = (this.phase === "race" ? 2 : 3) * px;
      ctx.stroke(path);
    }
    if (this.phase === "setup") this.drawGateLines(ctx, px);

    if (this.phase !== "setup" && this.sim) {
      if (this.pbSim && this.phase === "race") {
        const g = this.sampleAt(this.pbSim, this.raceT);
        this.cars.draw(ctx, g.x, g.y, g.heading, px, true);
      }
      if (this.phase === "race") {
        // pace marker: a ring in the target medal's colour, riding your own line
        const m = this.pacePoint(this.sim);
        ctx.beginPath();
        ctx.arc(m.x, m.y, 7 * px, 0, Math.PI * 2);
        ctx.lineWidth = 2.5 * px;
        ctx.strokeStyle = this.pace.medal === "perfect" ? MEDAL_COLOR.pole : this.pace.medal === "challenge" ? C.paint : MEDAL_COLOR[this.pace.medal];
        ctx.fillStyle = "rgba(10,11,13,0.55)";
        ctx.fill();
        ctx.stroke();
      }
      const p = this.sampleAt(this.sim, this.raceT);
      this.cars.draw(ctx, p.x, p.y, p.heading, px, false);
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

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
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
