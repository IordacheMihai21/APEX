import {
  APEX_FORMULA as car,
  type Complex,
  type GameTrack,
  type LineControls,
  type PreparedTrack,
  type SimulationResult,
  compareRuns,
  expandGates,
  prepareTrack,
  resolveLine,
  simulateLap,
  trackControls,
  usableHalfWidth,
} from "@apex/engine";
import { Camera } from "./camera";
import { C, lossColor } from "./palette";
import { type PersonalBest, loadPB, logEvent, savePB } from "./storage";

export type Phase = "setup" | "race" | "result";

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
}

export interface Snapshot {
  phase: Phase;
  complex: number;
  gate: number;
  /** Lateral offset of the selected gate (m, + = left of travel). */
  offset: number;
  /** Max |offset| with all four wheels on track. */
  limit: number;
  canUndo: boolean;
  raceTimeMs: number;
  raceSpeedKmh: number;
  result: RunResult | null;
  pbMs: number | null;
  attempts: number;
  /** True once the line differs from what was last raced. */
  edited: boolean;
}

/** Race playback runs this many times faster than the simulated lap. */
export const PLAYBACK_SPEED = 5;
const RACE_TRACK_PX = 26;
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
  private readonly centerPath: Path2D;
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

  constructor(track: GameTrack) {
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
    this.centerPath = new Path2D();
    track.centerline.forEach(([x, y], i) => (i ? this.centerPath.lineTo(x, y) : this.centerPath.moveTo(x, y)));
    this.centerPath.closePath();

    this.pb = loadPB(track.id, track.version);
    // Returning players continue from their best line; new players start on the centerline.
    const start = this.pb?.knotOffsets.length === this.pt.k ? this.pb.knotOffsets : new Array(this.pt.k).fill(0);
    this.z = expandGates(this.pt, this.controls, start, this.limit);
    this.lineXY = this.resolve();
    if (this.pb) this.pbSim = simulateLap({ track: this.pt, line: { knotOffsets: this.pb.knotOffsets }, car });
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
    if (this.sim && this.phase !== "setup") speed = this.sampleAt(this.sim, this.raceT).speed * 3.6;
    return {
      phase: this.phase,
      complex: this.sel.complex,
      gate: this.sel.gate,
      offset: this.z[this.selectedGate().knot],
      limit: this.limit,
      canUndo: this.history.length > 0,
      raceTimeMs: this.raceT,
      raceSpeedKmh: speed,
      result: this.result,
      pbMs: this.pb?.lapTimeMs ?? null,
      attempts: this.attempts,
      edited: this.lastRaced !== this.z.join(","),
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
    this.sim = sim;
    this.raceT = 0;
    this.phase = "race";
    this.lastRaced = this.z.join(",");
    this.camera.animateTo(sim.samples.x[0], sim.samples.y[0], RACE_TRACK_PX / this.track.widthMeters, this.headingAt(0) - Math.PI / 2, 450);
    logEvent("run_started", { track: this.track.id });
    this.emit();
  }

  skip() {
    if (this.phase === "race" && this.sim) this.finishRace();
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
    this.result = {
      lapTimeMs: sim.lapTimeMs,
      targetMs: this.reference.lapTimeMs,
      deltaTargetMs: sim.lapTimeMs - this.reference.lapTimeMs,
      pbBeforeMs: pbBefore,
      newPb,
      losses: cmp.corners
        .map((c) => ({ name: c.name, deltaMs: c.deltaMs, complex: this.complexOfCorner.get(c.name) ?? this.nearestComplex(c.name) }))
        .sort((a, b) => b.deltaMs - a.deltaMs),
    };
    this.phase = "result";
    this.frameResult();
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

  /** Back to setup, at the group containing `cornerName`, or the worst one from the last run. */
  adjust(cornerName?: string) {
    if (this.phase === "race") return;
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
    return this.phase !== "result";
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

    if (this.phase === "race" && this.sim) {
      this.raceT += dt * 1000 * PLAYBACK_SPEED;
      const p = this.sampleAt(this.sim, this.raceT);
      if (!this.camera.animating) {
        // Heading-up follow cam, smoothed so it reads like an onboard map.
        const k = Math.min(1, dt * 4);
        const look = 30;
        this.camera.x += (p.x + Math.cos(p.heading) * look - this.camera.x) * k;
        this.camera.y += (p.y + Math.sin(p.heading) * look - this.camera.y) * k;
        let da = p.heading - Math.PI / 2 - this.camera.angle;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        this.camera.angle += da * Math.min(1, dt * 2.2);
      }
      if (now - this.lastEmit > 66) {
        this.lastEmit = now;
        this.emit();
      }
      if (this.raceT >= this.sim.rawLapTimeMs) this.finishRace();
      animating = true;
    }
    if (!animating && !this.dirty) return;
    this.dirty = false;
    this.render();
  }

  private render() {
    const ctx = this.ctx;
    if (!ctx) return;
    const cam = this.camera;
    const px = 1 / cam.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.tarmac;
    ctx.fillRect(0, 0, this.canvas!.width, this.canvas!.height);

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
    if (cam.scale * W > 30) this.drawKerbs(ctx);
    this.drawStartLine(ctx);
    if (this.phase === "setup") this.drawChevrons(ctx, px);

    if (this.phase === "result" && this.sim) this.drawHeatmap(ctx, px);
    else {
      const { x, y } = this.lineXY;
      ctx.strokeStyle = this.phase === "race" ? C.inkDim : C.ink;
      ctx.lineWidth = (this.phase === "race" ? 2.4 : 3) * px;
      ctx.beginPath();
      for (let i = 0; i <= this.pt.n; i++) {
        const j = i % this.pt.n;
        if (i) ctx.lineTo(x[j], y[j]);
        else ctx.moveTo(x[j], y[j]);
      }
      ctx.stroke();
    }
    if (this.phase === "setup") this.drawGateLines(ctx, px);

    if (this.phase !== "setup" && this.sim) {
      if (this.pbSim && this.phase === "race") {
        const g = this.sampleAt(this.pbSim, this.raceT);
        this.drawCar(ctx, g.x, g.y, g.heading, px, true);
      }
      const p = this.sampleAt(this.sim, this.raceT);
      this.drawCar(ctx, p.x, p.y, p.heading, px, false);
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.phase === "setup") {
      this.drawCornerLabels(ctx);
      this.drawPucks(ctx);
    }
    if (this.phase === "result") this.drawLossLabels(ctx);
    if (this.showMinimap()) this.drawMinimap(ctx);
  }

  /** Red/white kerbs on the inside of each gated corner, so "inside" is obvious. */
  private drawKerbs(ctx: CanvasRenderingContext2D) {
    const { n, cx, cy, nx, ny, step } = this.pt;
    const W = this.track.widthMeters;
    const seg = Math.max(1, Math.round(3 / step));
    ctx.lineWidth = 1.2;
    ctx.lineCap = "butt";
    for (const c of this.track.corners) {
      if (!this.complexOfCorner.has(c.name)) continue;
      const side = c.direction === "left" ? 1 : -1;
      const len = (c.endIndex - c.startIndex + n) % n;
      for (let o = 0, k = 0; o < len; o += seg, k++) {
        const i = (c.startIndex + o) % n;
        const j = (c.startIndex + Math.min(len, o + seg)) % n;
        ctx.strokeStyle = k % 2 ? C.paint : C.kerb;
        ctx.beginPath();
        ctx.moveTo(cx[i] + side * nx[i] * (W / 2 - 0.4), cy[i] + side * ny[i] * (W / 2 - 0.4));
        ctx.lineTo(cx[j] + side * nx[j] * (W / 2 - 0.4), cy[j] + side * ny[j] * (W / 2 - 0.4));
        ctx.stroke();
      }
    }
    ctx.lineCap = "round";
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

  private drawChevrons(ctx: CanvasRenderingContext2D, px: number) {
    const { n, cx, cy, step } = this.pt;
    const every = Math.max(1, Math.round(120 / step));
    const size = Math.min(this.track.widthMeters * 0.25, 12 * px);
    ctx.strokeStyle = "rgba(236,235,228,0.14)";
    ctx.lineWidth = Math.max(0.5, 2 * px);
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

  private drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, px: number, ghost: boolean) {
    const k = Math.max(1, (10 * px) / 2);
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
    ctx.fillRect(2.4, -0.95, 0.35, 1.9);
    ctx.fillRect(-2.7, -0.8, 0.4, 1.6);
    if (!ghost) {
      ctx.fillStyle = C.paint;
      ctx.fillRect(-0.2, -0.18, 0.7, 0.36);
    }
    ctx.restore();
  }

  private drawHeatmap(ctx: CanvasRenderingContext2D, px: number) {
    const { x, y } = this.lineXY;
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
    const out = direction === "left" ? -1 : 1;
    const d = this.track.widthMeters / 2 + offsetPx / this.camera.scale;
    return this.camera.toScreen(this.pt.cx[i] + out * this.pt.nx[i] * d, this.pt.cy[i] + out * this.pt.ny[i] * d);
  }

  private drawCornerLabels(ctx: CanvasRenderingContext2D) {
    ctx.font = "500 11px 'IBM Plex Mono', monospace";
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
