import loopUrl from "./assets/v8-loop.wav?url";
import { soundMuted } from "./engineSound";

/**
 * The 3D lap's sound: the engine, the wind and the tyres, and the crowd.
 * - The engine: a 2026 power unit is a 1.6-litre V6 hybrid revving to about 12,500 rpm, deeper than the old V8s. The
 *   engine loop (game3d/assets/v8-loop.wav, our own) is played lower, through an eight-speed gearbox, with a cut on
 *   each upshift and a blip on each downshift under braking; on the throttle it's loud and bright, off it it drops
 *   back and goes duller.
 * - The wind and the tyres: filtered noise that rises with the speed.
 * - The crowd: a low roar of voices (filtered noise, swelling now and then), louder by the grandstands.
 * Heard from the camera: in the cockpit and on the T-cam the engine fills it, from the chase camera it's a little
 * behind, and from a trackside camera it comes from the car, quieter with the distance.
 * Web Audio only starts once the page has had a tap or a key (the race button), as browsers require.
 */

/** top speed in each gear (m/s): eight gears, 8th good for about 345 km/h */
const GEAR_TOP = [100, 135, 168, 200, 232, 265, 300, 345].map((k) => k / 3.6);
const RPM_MAX = 12500;
const UPSHIFT = 12100;
const DOWNSHIFT = 8800;
/** the loop's own pitch as an engine speed, for a V6 a touch deeper than the V8 it was cut from */
const LOOP_RPM = 15500;

export class LapSound {
  private ctx: BaseAudioContext | null = null;
  private master: GainNode | null = null;
  private engine: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private wind: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private crowd: { gain: GainNode } | null = null;
  private gear = 0;
  private muted = soundMuted();
  private ready: Promise<void> | null = null;

  /** Make the audio graph (the page has already had a tap: the race button). */
  start(into?: BaseAudioContext) {
    if (this.ready) return this.ready;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!into && !Ctx) return Promise.resolve();
    // a context of our own, or one given (an offline one, to render the sound of a recorded lap)
    const ctx = into ?? new Ctx();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.75;
    master.connect(ctx.destination);
    this.master = master;
    // noise for the wind and the crowd
    const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < data.length; i++) {
      // a little brown, so it isn't hiss
      b = (b + (Math.random() * 2 - 1) * 0.08) * 0.985;
      data[i] = b * 3 + (Math.random() * 2 - 1) * 0.15;
    }
    const loop = (buffer: AudioBuffer) => {
      const s = ctx.createBufferSource();
      s.buffer = buffer;
      s.loop = true;
      s.start();
      return s;
    };
    {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 700;
      filter.Q.value = 0.6;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      loop(noise).connect(filter).connect(gain).connect(master);
      this.wind = { gain, filter };
    }
    {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 420;
      filter.Q.value = 0.9;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const src = loop(noise);
      src.playbackRate.value = 0.83;
      src.connect(filter).connect(gain).connect(master);
      this.crowd = { gain };
    }
    if (ctx instanceof AudioContext && ctx.state === "suspended") void ctx.resume().catch(() => {});
    this.ready = fetch(loopUrl)
      .then((r) => r.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((buffer) => {
        if (this.ctx !== ctx) return;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 6000;
        filter.Q.value = 0.5;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        src.connect(filter).connect(gain).connect(master);
        src.start();
        this.engine = { src, gain, filter };
      })
      .catch(() => {});
    return this.ready;
  }

  /**
   * Follow the lap: the car's speed (m/s), its acceleration along the track (m/s², minus under braking), how far the
   * camera is from it (m) and whether it's on board, and how near the grandstands are (0 far, 1 beside them).
   */
  update(v: number, along: number, camera: { distance: number; onboard: boolean }, crowdNear: number, at?: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = at ?? ctx.currentTime;
    // the gearbox: up at the top of the revs, down as the car slows, one gear at a time
    const rpmIn = (g: number) => Math.max(5500, Math.min(RPM_MAX, (v / GEAR_TOP[g]) * RPM_MAX));
    let shifted = 0;
    if (rpmIn(this.gear) > UPSHIFT && this.gear < GEAR_TOP.length - 1) {
      this.gear++;
      shifted = 1;
    } else if (rpmIn(this.gear) < DOWNSHIFT && this.gear > 0) {
      this.gear--;
      shifted = -1;
    }
    const rpm = rpmIn(this.gear);
    const onPower = along > -3 && v > 2;
    // from far off the car is quieter, and duller (the air takes the highs)
    const far = camera.onboard ? 1 : Math.min(1, 14 / Math.max(14, camera.distance));
    const near = camera.onboard ? 1.15 : 0.85;
    if (this.engine) {
      const e = this.engine;
      e.src.playbackRate.setTargetAtTime(rpm / LOOP_RPM, t, 0.025);
      const level = (v < 1 ? 0.25 : onPower ? 0.85 : 0.42) * far * near;
      e.gain.gain.setTargetAtTime(level, t, onPower ? 0.04 : 0.1);
      e.filter.frequency.setTargetAtTime((onPower ? 7000 : 2200) * (0.35 + 0.65 * far), t, 0.06);
      if (shifted > 0) {
        // the upshift: a cut in the power for a few hundredths
        e.gain.gain.cancelScheduledValues(t);
        e.gain.gain.setValueAtTime(level * 0.35, t);
        e.gain.gain.setTargetAtTime(level, t + 0.04, 0.03);
      } else if (shifted < 0 && !onPower) {
        // the downshift under braking: a blip of the revs
        e.src.playbackRate.cancelScheduledValues(t);
        e.src.playbackRate.setValueAtTime((rpm * 1.12) / LOOP_RPM, t);
        e.src.playbackRate.setTargetAtTime(rpm / LOOP_RPM, t + 0.05, 0.04);
      }
    }
    if (this.wind) {
      const k = Math.min(1, v / 90);
      this.wind.gain.gain.setTargetAtTime((camera.onboard ? 0.32 : 0.14) * k * k * (camera.onboard ? 1 : far), t, 0.1);
      this.wind.filter.frequency.setTargetAtTime(400 + 900 * k, t, 0.1);
    }
    if (this.crowd) {
      // a crowd's roar, swelling now and then
      const swell = 0.75 + 0.25 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1);
      this.crowd.gain.gain.setTargetAtTime((0.025 + 0.12 * crowdNear) * swell, t, 0.4);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem("lapdle.sound", muted ? "off" : "on");
    } catch {
      /* not remembered */
    }
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.75, this.ctx.currentTime, 0.05);
  }

  get isMuted() {
    return this.muted;
  }

  /** A new lap: bring the sound back up after a fade. */
  resume() {
    if (!this.ctx || !this.master) return;
    if (this.ctx instanceof AudioContext && this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.75, this.ctx.currentTime, 0.1);
  }

  /** The lap is over: let it all die away. */
  fade() {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
  }

  dispose() {
    this.engine?.src.stop();
    if (this.ctx instanceof AudioContext) void this.ctx.close().catch(() => {});
    this.ctx = null;
  }
}
