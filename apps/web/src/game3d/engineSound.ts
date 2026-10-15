import loopUrl from "./assets/v8-loop.wav?url";

/**
 * The engine: a 2010s-style 2.4-litre V8 howl (a seamless 1.5 s loop cut from a Veo-generated onboard recording, our
 * own; picked from several takes for the closest match, by spectrum, to a TV onboard of that era),
 * pitched by a seven-speed gearbox model so it climbs through the gears, cracks on each upshift and blips on every
 * downshift under braking. Full throttle is loud and bright; off the throttle it drops back and goes duller.
 * Web Audio only starts after a tap or a key (the start press), as browsers require.
 */

/** Top speed in each gear (m/s): a 2010s-style ratio spread, 7th good for about 330 km/h. */
const GEAR_TOP = [110, 150, 185, 220, 255, 290, 330].map((k) => k / 3.6);
const RPM_MAX = 18000;
const UPSHIFT = 17500;
const DOWNSHIFT = 11500;
/** The loop's own pitch, as an engine speed: playing it at 1x sounds like this many rpm. */
const LOOP_RPM = 16500;
const MUTE_KEY = "lapdle.sound";

/** The gearbox: which gear the car is in at a speed, and the engine's rpm. Up at the top of the rev range, down as
 * the car slows (each downshift blips the revs up), never two at once. */
export class Gearbox {
  gear: number;
  constructor(v: number) {
    const g = GEAR_TOP.findIndex((top) => v <= top * 0.97);
    this.gear = g < 0 ? GEAR_TOP.length - 1 : g;
  }
  rpm(v: number) {
    return Math.max(4500, Math.min(RPM_MAX, (v / GEAR_TOP[this.gear]) * RPM_MAX));
  }
  /** Shift if the revs ask for it, then the rpm. */
  step(v: number) {
    const rpm = this.rpm(v);
    if (rpm > UPSHIFT && this.gear < GEAR_TOP.length - 1) this.gear++;
    else if (rpm < DOWNSHIFT && this.gear > 0) this.gear--;
    return this.rpm(v);
  }
}
/** How fast to play the loop for an rpm. */
export const loopRate = (rpm: number) => rpm / LOOP_RPM;

export type EnginePhase = "approach" | "braking" | "rolling" | "throttle" | "off" | "stopped";

export const soundMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === "off";
  } catch {
    return false;
  }
};

export class EngineSound {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private master: GainNode | null = null;
  private box = new Gearbox(0);
  private muted = soundMuted();
  private loading: Promise<void> | null = null;

  /** Make the audio graph; call from a tap or key handler (browsers only allow sound after one). */
  async unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this.loading = fetch(loopUrl)
        .then((r) => r.arrayBuffer())
        .then((b) => this.ctx!.decodeAudioData(b))
        .then((buf) => {
          this.buffer = buf;
        })
        .catch(() => {});
    }
    if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {});
    await this.loading;
  }

  /** Start the engine at a speed (m/s), in the gear that speed needs. */
  start(v: number) {
    const ctx = this.ctx;
    if (!ctx || !this.buffer || !this.master) return;
    this.stop();
    this.box = new Gearbox(v);
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 9000;
    filter.Q.value = 0.4;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master);
    src.playbackRate.value = loopRate(this.box.rpm(v));
    src.start();
    gain.gain.setTargetAtTime(0.9, ctx.currentTime, 0.08);
    this.src = src;
    this.gain = gain;
    this.filter = filter;
  }

  /** Follow the run: speed (m/s) and what the driver is doing. */
  update(v: number, phase: EnginePhase) {
    const ctx = this.ctx;
    if (!ctx || !this.src || !this.gain || !this.filter) return;
    const rpm = this.box.step(v);
    const t = ctx.currentTime;
    this.src.playbackRate.setTargetAtTime(loopRate(rpm), t, 0.03);
    const onPower = phase === "approach" || phase === "throttle";
    const level = phase === "stopped" || phase === "off" ? 0.25 : onPower ? 0.9 : phase === "rolling" ? 0.55 : 0.42;
    this.gain.gain.setTargetAtTime(level, t, onPower ? 0.05 : 0.12);
    this.filter.frequency.setTargetAtTime(onPower ? 9000 : phase === "rolling" ? 3200 : 1800, t, 0.08);
  }

  /** The run is over: let the engine die away. */
  fade() {
    if (!this.ctx || !this.gain) return;
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.35);
  }

  stop() {
    try {
      this.src?.stop();
    } catch {
      /* already stopped */
    }
    this.src?.disconnect();
    this.src = null;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "off" : "on");
    } catch {
      /* no storage: it just won't be remembered */
    }
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  dispose() {
    this.stop();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

}
