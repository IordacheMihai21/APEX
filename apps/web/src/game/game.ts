import {
  APEX_FORMULA as car,
  type GameTrack,
  type LineIssue,
  type PreparedTrack,
  type RacingLine,
  type SimulationResult,
  type Vec2,
  compareRuns,
  enforceLimits,
  fitDrawing,
  prepareTrack,
  resolveLine,
  simulateLap,
  usableHalfWidth,
} from "@apex/engine";
import { Camera } from "./camera";
import { C, lossColor } from "./palette";
import { LapProgress } from "./progress";
import { type PersonalBest, loadPB, logEvent, savePB } from "./storage";

export type Phase = "draw" | "edit" | "race" | "result";

export interface CornerLoss {
  name: string;
  deltaMs: number;
}

export interface RunResult {
  lapTimeMs: number;
  targetMs: number;
  deltaTargetMs: number;
  pbBeforeMs: number | null;
  newPb: boolean;
  losses: CornerLoss[]; // worst first
}

export interface Snapshot {
  phase: Phase;
  progress: number;
  canUndo: boolean;
  hint: { tone: "info" | "error"; text: string } | null;
  /** When the drawn lap has a problem: label for the "redraw from" action. */
  rewindTo: string | null;
  raceTimeMs: number;
  raceSpeedKmh: number;
  result: RunResult | null;
  pbMs: number | null;
  attempts: number;
}

/** Race playback runs this many times faster than the simulated lap. */
export const PLAYBACK_SPEED = 5;
/** On-screen track width while drawing (CSS px). Phase 1 finding: ≥ 40–60 px. */
const DRAW_TRACK_PX = 40;
/** Longest straight the player may skip by tapping further ahead (metres). */
const MAX_BRIDGE_M = 700;
const RACE_TRACK_PX = 26;
const HEAD_HIT_PX = 34;
const HANDLE_HIT_PX = 24;

export class Game {
  readonly track: GameTrack;
  readonly pt: PreparedTrack;
  readonly camera = new Camera();
  private readonly reference: SimulationResult;
  private readonly bbox: [number, number, number, number];
  private readonly centerPath: Path2D;

  private phase: Phase = "draw";
  private strokes: Vec2[][] = [];
  /** Drawing direction along centerline indices (+1 / -1), set by the first stroke. */
  private dir: 1 | -1 = 1;
  private current: Vec2[] | null = null;
  private progress: LapProgress;
  private line: RacingLine | null = null;
  private lineXY: { x: Float64Array; y: Float64Array } | null = null;
  private issues: LineIssue[] = [];
  private hint: Snapshot["hint"] = null;
  /** First stroke that touches a validation problem, so the player can redraw from there. */
  private rewind: { stroke: number; corner: string } | null = null;

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

  // pointer state
  private pointers = new Map<number, { x: number; y: number }>();
  private mode: "none" | "draw" | "pan" | "pinch" | "handle" = "none";
  private activeHandle = -1;
  private pinch0: { dist: number; scale: number; world: Vec2 } | null = null;

  constructor(track: GameTrack) {
    this.track = track;
    this.pt = prepareTrack(track);
    this.reference = simulateLap({ track: this.pt, line: track.optimalLine!, car });
    this.progress = new LapProgress(this.pt);
    const xs = track.leftBoundary.concat(track.rightBoundary);
    this.bbox = [
      Math.min(...xs.map((p) => p[0])),
      Math.min(...xs.map((p) => p[1])),
      Math.max(...xs.map((p) => p[0])),
      Math.max(...xs.map((p) => p[1])),
    ];
    this.centerPath = new Path2D();
    track.centerline.forEach(([x, y], i) => (i ? this.centerPath.lineTo(x, y) : this.centerPath.moveTo(x, y)));
    this.centerPath.closePath();
    this.pb = loadPB(track.id, track.version);
    if (this.pb) this.pbSim = simulateLap({ track: this.pt, line: { knotOffsets: this.pb.knotOffsets }, car });
    this.hint = { tone: "info", text: "Drag from the orange dot to draw your racing line." };
    this.snap = this.buildSnapshot();
    logEvent("track_loaded", { track: track.id });
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
    if (this.sim && (this.phase === "race" || this.phase === "result")) speed = this.sampleAt(this.sim, this.raceT).speed * 3.6;
    return {
      phase: this.phase,
      progress: this.phase === "draw" ? this.progress.fraction : 1,
      canUndo: this.strokes.length > 0,
      hint: this.hint,
      rewindTo: this.phase === "draw" && this.rewind ? this.rewind.corner : null,
      raceTimeMs: this.raceT,
      raceSpeedKmh: speed,
      result: this.result,
      pbMs: this.pb?.lapTimeMs ?? null,
      attempts: this.attempts,
    };
  }

  // ------------------------------------------------------------ lifecycle
  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas);
    this.resize();
    this.focusStart(0);

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

  private resize() {
    const cv = this.canvas!;
    const r = cv.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(r.width * this.dpr);
    cv.height = Math.round(r.height * this.dpr);
    this.camera.w = r.width;
    this.camera.h = r.height;
    this.dirty = true;
  }

  private get drawScale() {
    return DRAW_TRACK_PX / this.track.widthMeters;
  }
  private get overviewScale() {
    const [x0, y0, x1, y1] = this.bbox;
    return Math.min(this.camera.w / (x1 - x0), this.camera.h / (y1 - y0)) * 0.88;
  }

  /** Camera on the head of the line, at drawing zoom. */
  private focusStart(ms = 380) {
    const [x, y] = this.head;
    this.camera.animateTo(x, y, this.drawScale, ms);
    this.dirty = true;
  }

  /**
   * Fit the whole track into a fraction of the canvas (leaves room for the
   * pit board): region = [x0, y0, x1, y1] as fractions of width/height.
   */
  private fitTrack(region: [number, number, number, number], ms = 500) {
    const [bx0, by0, bx1, by1] = this.bbox;
    const { w, h } = this.camera;
    const rw = (region[2] - region[0]) * w;
    const rh = (region[3] - region[1]) * h;
    const s = Math.min(rw / (bx1 - bx0), rh / (by1 - by0)) * 0.9;
    const px = ((region[0] + region[2]) / 2) * w;
    const py = ((region[1] + region[3]) / 2) * h;
    const cx = (bx0 + bx1) / 2 - (px - w / 2) / s;
    const cy = (by0 + by1) / 2 + (py - h / 2) / s;
    this.camera.animateTo(cx, cy, s, ms);
    this.dirty = true;
  }

  showOverview() {
    this.fitTrack([0, 0, 1, 1]);
  }

  // ------------------------------------------------------------ drawing
  private get head(): Vec2 {
    const last = this.strokes[this.strokes.length - 1];
    if (last) return last[last.length - 1];
    const [x, y] = this.track.centerline[0];
    return [x, y];
  }

  private endStroke() {
    const s = this.current;
    this.current = null;
    if (s && s.length >= 3) {
      this.strokes.push(s);
      if (this.strokes.length === 1) this.dir = this.inferDirection(s);
      logEvent(this.strokes.length === 1 ? "drawing_started" : "stroke_added", { track: this.track.id, progress: this.progress.fraction });
    }
    // Every lift (including a tap that skipped a straight) may finish the lap.
    if (this.strokes.length && this.progress.largestGapM() <= 20) {
      this.completeLine();
    } else if (this.strokes.length) {
      this.hint = {
        tone: "info",
        text: "Carry on from the dot. On a straight, tap further ahead to skip to it. Drag off the track to move the map.",
      };
      this.lookAhead();
    }
    this.dirty = true;
    this.emit();
  }

  /**
   * Centre the view up to 80 m ahead of the head so the next section is
   * visible, but never so far that the head (the orange dot) leaves the
   * central part of the screen (matters on narrow portrait phones).
   */
  private lookAhead() {
    const n = this.pt.n;
    const i = (this.progress.index + this.dir * Math.round(80 / this.pt.step) + n) % n;
    const [hx, hy] = this.head;
    const { w, h, scale } = this.camera;
    const dx = (this.pt.cx[i] - hx) * scale;
    const dy = (this.pt.cy[i] - hy) * scale;
    const f = Math.min(1, (0.3 * w) / Math.max(1e-6, Math.abs(dx)), (0.3 * h) / Math.max(1e-6, Math.abs(dy)));
    this.camera.animateTo(hx + (this.pt.cx[i] - hx) * f, hy + (this.pt.cy[i] - hy) * f, scale);
  }

  private inferDirection(stroke: Vec2[]): 1 | -1 {
    const n = this.pt.n;
    const tmp = new LapProgress(this.pt);
    tmp.add(...stroke[0]);
    const a = tmp.index;
    for (const [x, y] of stroke) tmp.add(x, y);
    const fwd = (tmp.index - a + n) % n;
    return fwd <= n / 2 ? 1 : -1;
  }

  /**
   * Skip a straight: if (wx, wy) is on track, ahead of the head within
   * MAX_BRIDGE_M, with no corner in between, fill the gap by blending the
   * lateral offset and return the new head. Corners must always be drawn.
   */
  private tryBridge(wx: number, wy: number): Vec2 | null {
    const { n, cx, cy, nx, ny, step } = this.pt;
    const h = this.progress.index;
    if (h < 0 || this.strokes.length === 0) return null;
    const maxK = Math.round(MAX_BRIDGE_M / step);
    let best = -1;
    let bd = Infinity;
    for (let k = 4; k <= maxK; k++) {
      const i = (h + this.dir * k + n) % n;
      const d = (wx - cx[i]) * (wx - cx[i]) + (wy - cy[i]) * (wy - cy[i]);
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    if (best < 0 || Math.sqrt(bd) > this.track.widthMeters / 2 + 1) return null;
    const lead = Math.round(10 / step);
    const inRange = (i: number) => {
      const o = ((i - h) * this.dir + n) % n;
      return o > 0 && o < best;
    };
    for (const c of this.track.corners) {
      const len = ((c.endIndex - c.startIndex + n) % n) + 2 * lead;
      for (let o = 0; o <= len; o++) if (inRange((c.startIndex - lead + o + n) % n)) return null;
    }
    const [hx, hy] = this.head;
    const off0 = (hx - cx[h]) * nx[h] + (hy - cy[h]) * ny[h];
    const t = (h + this.dir * best + n) % n;
    const off1 = (wx - cx[t]) * nx[t] + (wy - cy[t]) * ny[t];
    const bridge: Vec2[] = [this.head];
    for (let k = 1; k <= best; k++) {
      const i = (h + this.dir * k + n) % n;
      const o = off0 + ((off1 - off0) * k) / best;
      bridge.push([cx[i] + nx[i] * o, cy[i] + ny[i] * o]);
    }
    for (const [x, y] of bridge) this.progress.add(x, y);
    this.strokes.push(bridge);
    logEvent("straight_skipped", { track: this.track.id, metres: Math.round(best * step) });
    return bridge[bridge.length - 1];
  }

  private replayProgress() {
    this.progress.reset();
    for (const s of this.strokes) for (const [x, y] of s) this.progress.add(x, y);
  }

  private cornerNear(index: number): string {
    const n = this.pt.n;
    let best = this.track.corners[0];
    let bd = Infinity;
    for (const c of this.track.corners) {
      const d = Math.min((c.apexIndex - index + n) % n, (index - c.apexIndex + n) % n);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best?.name ?? "the start";
  }

  /** Index (in drawing order) of the first stroke with a point projecting into [from, to]. */
  private firstStrokeTouching(from: number, to: number): number {
    const n = this.pt.n;
    const len = (to - from + n) % n;
    const pad = Math.round(10 / this.pt.step);
    const inside = (i: number) => (i - from + pad + n) % n <= len + 2 * pad;
    const tmp = new LapProgress(this.pt);
    for (let k = 0; k < this.strokes.length; k++) {
      for (const [x, y] of this.strokes[k]) {
        tmp.add(x, y);
        if (inside(tmp.index)) return k;
      }
    }
    return Math.max(0, this.strokes.length - 1);
  }

  /** Drop every stroke from the first problem onwards and continue from there. */
  rewindToProblem() {
    if (!this.rewind) return;
    this.strokes = this.strokes.slice(0, Math.max(0, this.rewind.stroke));
    this.rewind = null;
    this.issues = [];
    this.replayProgress();
    this.hint = { tone: "info", text: "Carry on from the orange dot." };
    logEvent("rewind", { track: this.track.id, strokes: this.strokes.length });
    this.focusStart();
    this.emit();
  }

  private completeLine() {
    const pts = this.strokes.flat();
    pts.push(pts[0]);
    const fit = fitDrawing(this.pt, pts, car);
    if (!fit.valid) {
      const issue = fit.issues[0];
      const n = this.pt.n;
      const mid =
        issue.fromIndex !== undefined && issue.toIndex !== undefined
          ? (issue.fromIndex + Math.floor(((issue.toIndex - issue.fromIndex + n) % n) / 2)) % n
          : undefined;
      const where = mid !== undefined ? this.cornerNear(mid) : "";
      this.rewind = issue.fromIndex !== undefined ? { stroke: this.firstStrokeTouching(issue.fromIndex, issue.toIndex ?? issue.fromIndex), corner: where } : null;
      this.issues = fit.issues;
      this.hint = {
        tone: "error",
        text:
          issue.status === "OFF_TRACK"
            ? `Your line leaves the track at ${where}.`
            : issue.status === "CUT_CORNER"
              ? `Your line cuts across the infield at ${where}.`
              : "Part of the lap is missing. Carry on from the orange dot.",
      };
      logEvent("run_invalid", { track: this.track.id, status: issue.status });
      return;
    }
    this.setLine(fit.line);
    this.rewind = null;
    this.phase = "edit";
    this.hint = { tone: "info", text: "Lap complete. Drag the white markers to fine-tune, or race it." };
    logEvent("drawing_completed", { track: this.track.id, strokes: this.strokes.length });
  }

  private setLine(line: RacingLine) {
    this.line = line;
    const r = resolveLine(this.pt, line, car);
    this.lineXY = { x: r.x, y: r.y };
    this.issues = r.issues;
    this.dirty = true;
  }

  undo() {
    if (this.phase === "race") return;
    if (this.phase !== "draw") {
      this.phase = "draw";
      this.line = null;
      this.lineXY = null;
      this.result = null;
    }
    this.strokes.pop();
    this.issues = [];
    this.rewind = null;
    this.replayProgress();
    this.hint = this.strokes.length
      ? { tone: "info", text: "Carry on from the orange dot." }
      : { tone: "info", text: "Drag from the orange dot to draw your racing line." };
    this.focusStart();
    this.emit();
  }

  clear() {
    this.phase = "draw";
    this.strokes = [];
    this.current = null;
    this.line = null;
    this.lineXY = null;
    this.result = null;
    this.issues = [];
    this.progress.reset();
    this.rewind = null;
    this.hint = { tone: "info", text: "Drag from the orange dot to draw your racing line." };
    this.focusStart();
    this.emit();
  }

  /** Back to fine-tuning the same line after a result. */
  adjust() {
    if (!this.line) return;
    this.phase = "edit";
    this.result = null;
    this.hint = { tone: "info", text: "Drag the white markers to change your line, then race again." };
    const [x, y] = this.track.centerline[0];
    this.camera.animateTo(x, y, this.drawScale * 0.6);
    logEvent("retry_clicked", { track: this.track.id, mode: "adjust" });
    this.emit();
  }

  redraw() {
    logEvent("retry_clicked", { track: this.track.id, mode: "redraw" });
    this.clear();
  }

  // ------------------------------------------------------------ race
  race() {
    if (this.phase !== "edit" || !this.line) return;
    const sim = simulateLap({ track: this.pt, line: this.line, car });
    if (!sim.valid) {
      this.hint = { tone: "error", text: "This line leaves the track. Adjust it before racing." };
      this.emit();
      return;
    }
    this.sim = sim;
    this.raceT = 0;
    this.phase = "race";
    this.hint = null;
    this.camera.animateTo(sim.samples.x[0], sim.samples.y[0], RACE_TRACK_PX / this.track.widthMeters, 450);
    logEvent("run_started", { track: this.track.id });
    this.emit();
  }

  skip() {
    if (this.phase === "race" && this.sim) this.finishRace();
  }

  private finishRace() {
    const sim = this.sim!;
    this.raceT = sim.lapTimeMs;
    const cmp = compareRuns(sim, this.reference);
    const pbBefore = this.pb?.lapTimeMs ?? null;
    const newPb = pbBefore === null || sim.lapTimeMs < pbBefore;
    if (newPb) {
      this.pb = { lapTimeMs: sim.lapTimeMs, knotOffsets: this.line!.knotOffsets.slice(), at: Date.now() };
      savePB(this.track.id, this.track.version, this.pb);
      this.pbSim = sim;
    }
    this.attempts++;
    this.result = {
      lapTimeMs: sim.lapTimeMs,
      targetMs: this.reference.lapTimeMs,
      deltaTargetMs: sim.lapTimeMs - this.reference.lapTimeMs,
      pbBeforeMs: pbBefore,
      newPb,
      losses: cmp.corners.map((c) => ({ name: c.name, deltaMs: c.deltaMs })).sort((a, b) => b.deltaMs - a.deltaMs),
    };
    this.phase = "result";
    const narrow = this.camera.w < 720;
    this.fitTrack(narrow ? [0.04, 0.02, 0.96, 0.5] : [0.02, 0.04, 0.6, 0.96], 600);
    logEvent("run_completed", { track: this.track.id, lapTimeMs: sim.lapTimeMs, deltaMs: this.result.deltaTargetMs, newPb, attempt: this.attempts });
    this.emit();
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
    const size = Math.min(132, Math.max(92, Math.min(w, h) * 0.26));
    const [x0, y0, x1, y1] = this.bbox;
    const aspect = (x1 - x0) / (y1 - y0);
    const mw = aspect >= 1 ? size : size * aspect;
    const mh = aspect >= 1 ? size / aspect : size;
    return [w - mw - 16, 16, mw, mh];
  }

  private showMinimap() {
    return this.phase === "draw" || this.phase === "edit" || this.phase === "race";
  }

  private onDown(e: PointerEvent) {
    e.preventDefault();
    try {
      this.canvas!.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already-released pointer */
    }
    const [sx, sy] = this.local(e);
    this.pointers.set(e.pointerId, { x: sx, y: sy });

    if (this.pointers.size === 2) {
      if (this.mode === "draw") this.endStroke();
      const [a, b] = [...this.pointers.values()];
      const mid: [number, number] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      this.pinch0 = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: this.camera.scale, world: this.camera.toWorld(...mid) };
      this.mode = "pinch";
      return;
    }
    if (this.pointers.size > 2) return;

    if (this.showMinimap()) {
      const [mx, my, mw, mh] = this.minimapRect();
      if (sx >= mx && sx <= mx + mw && sy >= my && sy <= my + mh && this.phase !== "race") {
        const [x0, y0, x1, y1] = this.bbox;
        const wx = x0 + ((sx - mx) / mw) * (x1 - x0);
        const wy = y1 - ((sy - my) / mh) * (y1 - y0);
        this.camera.animateTo(wx, wy, Math.max(this.camera.scale, this.drawScale * 0.6));
        this.mode = "none";
        return;
      }
    }

    if (this.phase === "draw") {
      const [hx, hy] = this.camera.toScreen(...this.head);
      const nearHead = Math.hypot(sx - hx, sy - hy) <= HEAD_HIT_PX;
      const bridged = nearHead ? null : this.tryBridge(...this.camera.toWorld(sx, sy));
      if (nearHead || bridged) {
        this.mode = "draw";
        this.current = [this.head];
        if (this.strokes.length === 0) this.progress.add(...this.head);
        this.hint = null;
        this.dirty = true;
        this.emit();
        return;
      }
    }
    if (this.phase === "edit" && this.lineXY) {
      const j = this.handleAt(sx, sy);
      if (j >= 0) {
        this.mode = "handle";
        this.activeHandle = j;
        this.dirty = true;
        return;
      }
    }
    if (this.phase === "race") {
      this.mode = "none";
      return;
    }
    this.mode = "pan";
  }

  private onMove(e: PointerEvent) {
    const prev = this.pointers.get(e.pointerId);
    if (!prev) return;
    const [sx, sy] = this.local(e);
    this.pointers.set(e.pointerId, { x: sx, y: sy });

    if (this.mode === "pinch" && this.pinch0 && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const k = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, this.pinch0.dist);
      const cam = this.camera;
      cam.scale = Math.min(this.drawScale * 3, Math.max(this.overviewScale * 0.8, this.pinch0.scale * k));
      const mid = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      cam.x = this.pinch0.world[0] - (mid[0] - cam.w / 2) / cam.scale;
      cam.y = this.pinch0.world[1] + (mid[1] - cam.h / 2) / cam.scale;
      this.dirty = true;
    } else if (this.mode === "pan") {
      this.camera.panBy(sx - prev.x, sy - prev.y);
      this.dirty = true;
    } else if (this.mode === "draw" && this.current) {
      const events = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
      for (const ce of events.length ? events : [e]) {
        const [cx, cy] = this.local(ce);
        const last = this.current[this.current.length - 1];
        const [lx, ly] = this.camera.toScreen(...last);
        if (Math.hypot(cx - lx, cy - ly) < 2) continue;
        const w = this.camera.toWorld(cx, cy);
        this.current.push(w);
        this.progress.add(w[0], w[1]);
      }
      this.dirty = true;
      if (performance.now() - this.lastEmit > 120) {
        this.lastEmit = performance.now();
        this.emit();
      }
    } else if (this.mode === "handle" && this.line) {
      const [wx, wy] = this.camera.toWorld(sx, sy);
      const i = this.track.lineKnots[this.activeHandle];
      const lat = (wx - this.pt.cx[i]) * this.pt.nx[i] + (wy - this.pt.cy[i]) * this.pt.ny[i];
      const lim = usableHalfWidth(this.pt, car);
      const z = this.line.knotOffsets.slice();
      z[this.activeHandle] = Math.max(-lim, Math.min(lim, lat));
      this.setLine({ knotOffsets: enforceLimits(this.pt, z, lim) });
    }
  }

  private onUp(e: PointerEvent) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.mode === "draw") this.endStroke();
    if (this.mode === "handle") {
      logEvent("line_adjusted", { track: this.track.id, knot: this.activeHandle });
      this.activeHandle = -1;
      this.dirty = true;
    }
    if (this.pointers.size === 0) {
      this.mode = "none";
      this.pinch0 = null;
    } else if (this.mode === "pinch") {
      this.mode = "pan";
    }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const [sx, sy] = this.local(e);
    this.camera.zoomAt(Math.exp(-e.deltaY * 0.0015), sx, sy, this.overviewScale * 0.8, this.drawScale * 3);
    this.dirty = true;
  }

  zoom(k: number) {
    this.camera.zoomAt(k, this.camera.w / 2, this.camera.h / 2, this.overviewScale * 0.8, this.drawScale * 3);
    this.dirty = true;
  }

  private handlesVisible() {
    return this.phase === "edit" && this.camera.scale >= this.drawScale * 0.35;
  }

  private handleAt(sx: number, sy: number): number {
    if (!this.handlesVisible() || !this.lineXY) return -1;
    let best = -1;
    let bd = HANDLE_HIT_PX;
    this.track.lineKnots.forEach((i, j) => {
      const [hx, hy] = this.camera.toScreen(this.lineXY!.x[i], this.lineXY!.y[i]);
      const d = Math.hypot(sx - hx, sy - hy);
      if (d < bd) {
        bd = d;
        best = j;
      }
    });
    return best;
  }

  // ------------------------------------------------------------ frame
  private frame(now: number) {
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    let animating = this.camera.tick(now);

    if (this.phase === "race" && this.sim) {
      this.raceT += dt * 1000 * PLAYBACK_SPEED;
      const p = this.sampleAt(this.sim, this.raceT);
      const look = 30;
      const tx = p.x + Math.cos(p.heading) * look;
      const ty = p.y + Math.sin(p.heading) * look;
      if (!this.camera.animating) {
        const k = Math.min(1, dt * 5);
        this.camera.x += (tx - this.camera.x) * k;
        this.camera.y += (ty - this.camera.y) * k;
      }
      if (now - this.lastEmit > 66) {
        this.lastEmit = now;
        this.emit();
      }
      if (this.raceT >= this.sim.rawLapTimeMs) this.finishRace();
      animating = true;
    }
    if (this.phase === "draw") animating = true; // pulsing head dot
    if (!animating && !this.dirty) return;
    this.dirty = false;
    this.render(now);
  }

  private render(now: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const cam = this.camera;
    const px = 1 / cam.scale; // one CSS pixel in metres
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.tarmac;
    ctx.fillRect(0, 0, this.canvas!.width, this.canvas!.height);

    // ---- world layer
    cam.apply(ctx, this.dpr);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const W = this.track.widthMeters;
    ctx.strokeStyle = C.runoff;
    ctx.lineWidth = W + 18;
    ctx.stroke(this.centerPath);
    ctx.strokeStyle = C.paint;
    ctx.lineWidth = W + Math.max(0.9, 2.2 * px);
    ctx.stroke(this.centerPath);
    ctx.strokeStyle = C.asphalt;
    ctx.lineWidth = W - Math.max(0.1, 0.2 * px);
    ctx.stroke(this.centerPath);
    this.drawStartLine(ctx);
    if (this.phase === "draw" || this.phase === "edit") this.drawChevrons(ctx, px);

    if (this.phase === "draw") {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3.2 * px;
      for (const s of [...this.strokes, ...(this.current ? [this.current] : [])]) {
        ctx.beginPath();
        s.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      this.drawIssues(ctx, px);
    } else if (this.lineXY) {
      const { x, y } = this.lineXY;
      if (this.phase === "result" && this.sim && this.result) {
        this.drawHeatmap(ctx, px);
      } else {
        ctx.strokeStyle = this.phase === "race" ? C.inkDim : C.ink;
        ctx.lineWidth = (this.phase === "race" ? 2.4 : 3.2) * px;
        ctx.beginPath();
        for (let i = 0; i <= this.pt.n; i++) {
          const j = i % this.pt.n;
          if (i) ctx.lineTo(x[j], y[j]);
          else ctx.moveTo(x[j], y[j]);
        }
        ctx.stroke();
      }
    }

    if ((this.phase === "race" || this.phase === "result") && this.sim) {
      if (this.pbSim && this.phase === "race") {
        const g = this.sampleAt(this.pbSim, this.raceT);
        this.drawCar(ctx, g.x, g.y, g.heading, px, true);
      }
      const p = this.sampleAt(this.sim, this.raceT);
      this.drawCar(ctx, p.x, p.y, p.heading, px, false);
    }

    // ---- screen layer
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawCornerLabels(ctx);
    if (this.phase === "draw") this.drawHead(ctx, now);
    if (this.handlesVisible()) this.drawHandles(ctx);
    if (this.phase === "result") this.drawLossLabels(ctx);
    if (this.showMinimap()) this.drawMinimap(ctx);
  }

  private drawStartLine(ctx: CanvasRenderingContext2D) {
    const [x0, y0] = this.track.centerline[0];
    const [x1, y1] = this.track.centerline[1];
    const a = Math.atan2(y1 - y0, x1 - x0);
    const W = this.track.widthMeters;
    ctx.save();
    ctx.translate(x0, y0);
    ctx.rotate(a);
    const cell = W / 8;
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 ? C.paint : C.board;
        ctx.fillRect(r * cell - cell, -W / 2 + c * cell, cell, cell);
      }
    ctx.restore();
  }

  /** Race-direction chevrons painted on the track every ~180 m. */
  private drawChevrons(ctx: CanvasRenderingContext2D, px: number) {
    const { n, cx, cy, step } = this.pt;
    const every = Math.max(1, Math.round(180 / step));
    const size = Math.min(this.track.widthMeters * 0.28, 14 * px);
    ctx.strokeStyle = "rgba(236,235,228,0.16)";
    ctx.lineWidth = Math.max(0.5, 2.2 * px);
    for (let i = Math.round(40 / step); i < n; i += every) {
      const j = (i + 1) % n;
      const a = Math.atan2(cy[j] - cy[i], cx[j] - cx[i]);
      ctx.save();
      ctx.translate(cx[i], cy[i]);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-size * 0.5, size * 0.7);
      ctx.lineTo(size * 0.5, 0);
      ctx.lineTo(-size * 0.5, -size * 0.7);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, px: number, ghost: boolean) {
    // Generic open-wheel silhouette, ~5.6 m × 2 m, scaled up when zoomed out so it stays visible.
    const k = Math.max(1, (9 * px) / 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.scale(k, k);
    ctx.globalAlpha = ghost ? 0.4 : 1;
    ctx.fillStyle = C.board;
    for (const [wx, wy] of [[1.7, 0.8], [1.7, -0.8], [-1.6, 0.85], [-1.6, -0.85]]) ctx.fillRect(wx - 0.35, wy - 0.22, 0.7, 0.44);
    ctx.fillStyle = ghost ? C.paint : C.ink;
    ctx.beginPath();
    ctx.moveTo(2.9, 0);
    ctx.lineTo(1.2, 0.28);
    ctx.lineTo(-0.4, 0.55);
    ctx.lineTo(-2.3, 0.5);
    ctx.lineTo(-2.3, -0.5);
    ctx.lineTo(-0.4, -0.55);
    ctx.lineTo(1.2, -0.28);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(2.4, -0.95, 0.35, 1.9); // front wing
    ctx.fillRect(-2.7, -0.8, 0.4, 1.6); // rear wing
    if (!ghost) {
      ctx.fillStyle = C.paint;
      ctx.fillRect(-0.2, -0.18, 0.7, 0.36); // cockpit
    }
    ctx.restore();
  }

  private drawHead(ctx: CanvasRenderingContext2D, now: number) {
    const [x, y] = this.camera.toScreen(...this.head);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = reduce ? 0.5 : (Math.sin(now / 320) + 1) / 2;
    ctx.fillStyle = `rgba(255,106,19,${0.18 + 0.12 * t})`;
    ctx.beginPath();
    ctx.arc(x, y, 18 + 7 * t, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.strokeStyle = C.paint;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private drawHandles(ctx: CanvasRenderingContext2D) {
    const { x, y } = this.lineXY!;
    const { w, h } = this.camera;
    this.track.lineKnots.forEach((i, j) => {
      const [sx, sy] = this.camera.toScreen(x[i], y[i]);
      if (sx < -20 || sy < -20 || sx > w + 20 || sy > h + 20) return;
      const active = j === this.activeHandle;
      ctx.fillStyle = C.paint;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = active ? 3 : 2;
      ctx.beginPath();
      ctx.arc(sx, sy, active ? 9 : 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  private drawIssues(ctx: CanvasRenderingContext2D, px: number) {
    const n = this.pt.n;
    ctx.strokeStyle = C.kerb;
    ctx.lineWidth = Math.max(this.track.widthMeters + 4, 10 * px);
    ctx.globalAlpha = 0.45;
    for (const iss of this.issues) {
      if (iss.fromIndex === undefined || iss.toIndex === undefined) continue;
      const pad = Math.round(15 / this.pt.step);
      const a = (iss.fromIndex - pad + n) % n;
      const len = ((iss.toIndex - iss.fromIndex + n) % n) + 2 * pad;
      ctx.beginPath();
      for (let o = 0; o <= len; o++) {
        const i = (a + o) % n;
        if (o) ctx.lineTo(this.pt.cx[i], this.pt.cy[i]);
        else ctx.moveTo(this.pt.cx[i], this.pt.cy[i]);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawHeatmap(ctx: CanvasRenderingContext2D, px: number) {
    const { x, y } = this.lineXY!;
    const corners = this.track.corners;
    const n = this.pt.n;
    const cmp = compareRuns(this.sim!, this.reference).corners;
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
    const out = direction === "left" ? -1 : 1; // outside of the corner
    const d = this.track.widthMeters / 2 + offsetPx / this.camera.scale;
    return this.camera.toScreen(this.pt.cx[i] + out * this.pt.nx[i] * d, this.pt.cy[i] + out * this.pt.ny[i] * d);
  }

  private drawCornerLabels(ctx: CanvasRenderingContext2D) {
    if (this.phase === "result" || this.phase === "race") return;
    ctx.font = "500 11px 'IBM Plex Mono', monospace";
    ctx.fillStyle = C.steel;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const c of this.track.corners) {
      const [sx, sy] = this.labelPos(c.apexIndex, c.direction, 16);
      ctx.fillText(c.name, sx, sy);
    }
  }

  private drawLossLabels(ctx: CanvasRenderingContext2D) {
    if (!this.result) return;
    const worst = this.result.losses.filter((l) => l.deltaMs > 50).slice(0, 3);
    ctx.font = "600 12px 'IBM Plex Mono', monospace";
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
    const [x0, y0, x1, y1] = this.bbox;
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
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    if (this.phase === "draw") {
      for (const st of [...this.strokes, ...(this.current ? [this.current] : [])]) {
        ctx.beginPath();
        st.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
        ctx.stroke();
      }
    } else if (this.lineXY && this.phase === "edit") {
      ctx.beginPath();
      for (let i = 0; i < this.pt.n; i += 3) {
        if (i) ctx.lineTo(X(this.lineXY.x[i]), Y(this.lineXY.y[i]));
        else ctx.moveTo(X(this.lineXY.x[i]), Y(this.lineXY.y[i]));
      }
      ctx.closePath();
      ctx.stroke();
    }
    if (this.phase === "race" && this.sim) {
      const p = this.sampleAt(this.sim, this.raceT);
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // viewport
      const [vx0, vy0] = this.camera.toWorld(0, 0);
      const [vx1, vy1] = this.camera.toWorld(this.camera.w, this.camera.h);
      ctx.strokeStyle = C.paint;
      ctx.lineWidth = 1;
      const rx = Math.max(mx - 8, X(vx0));
      const ry = Math.max(my - 8, Y(vy0));
      ctx.strokeRect(rx, ry, Math.min(mx + mw + 8, X(vx1)) - rx, Math.min(my + mh + 8, Y(vy1)) - ry);
    }
    if (this.phase === "draw") {
      const [hx, hy] = this.head;
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(X(hx), Y(hy), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
