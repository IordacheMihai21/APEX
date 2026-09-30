/**
 * Opt-in engine note (Web Audio, no samples): a hybrid-V6-style howl built from
 * a sawtooth fundamental at the firing frequency, a detuned square an octave up,
 * a waveshaper for rasp and filtered noise for air. Pitch follows RPM; a gear
 * change dips it. Nothing plays until the player turns sound on.
 */
export class EngineSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private air: GainNode | null = null;
  private lastGear = 0;

  private init() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(2.2 * x);
    }
    shaper.curve = curve;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    filter.Q.value = 1.2;

    const osc1 = ctx.createOscillator();
    osc1.type = "sawtooth";
    const osc2 = ctx.createOscillator();
    osc2.type = "square";
    osc2.detune.value = 7;
    const g1 = ctx.createGain();
    g1.gain.value = 0.55;
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;
    osc1.connect(g1).connect(shaper);
    osc2.connect(g2).connect(shaper);
    shaper.connect(filter).connect(master);

    // air / tyre noise
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 900;
    band.Q.value = 0.6;
    const air = ctx.createGain();
    air.gain.value = 0;
    noise.connect(band).connect(air).connect(master);

    osc1.start();
    osc2.start();
    noise.start();
    Object.assign(this, { ctx, master, osc1, osc2, filter, air });
  }

  /** Call from a user gesture (browsers only start audio after one). */
  resume() {
    if (!this.ctx) this.init();
    void this.ctx!.resume();
  }

  /** Engine note for the current RPM/gear; `speed01` scales air noise. */
  update(rpm: number, gear: number, speed01: number) {
    if (!this.ctx || !this.osc1 || !this.osc2 || !this.master || !this.filter || !this.air) return;
    const t = this.ctx.currentTime;
    // V6 four-stroke: 3 firing pulses per revolution
    const f = (rpm / 60) * 3 * 0.5;
    this.osc1.frequency.setTargetAtTime(f, t, 0.02);
    this.osc2.frequency.setTargetAtTime(f * 2, t, 0.02);
    this.filter.frequency.setTargetAtTime(1200 + rpm * 0.18, t, 0.05);
    this.air.gain.setTargetAtTime(0.05 + speed01 * 0.12, t, 0.1);
    const shifted = gear !== this.lastGear && this.lastGear !== 0;
    this.lastGear = gear;
    // a gear change cuts the note for a moment, like an ignition cut on upshift
    this.master.gain.setTargetAtTime(shifted ? 0.08 : 0.22, t, shifted ? 0.01 : 0.04);
  }

  idle() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.osc1!.frequency.setTargetAtTime(260, t, 0.1);
    this.osc2!.frequency.setTargetAtTime(520, t, 0.1);
    this.air!.gain.setTargetAtTime(0.0, t, 0.2);
    this.master.gain.setTargetAtTime(0.08, t, 0.2);
    this.lastGear = 0;
  }

  silence() {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    this.lastGear = 0;
  }
}

/** Shared, lazily created engine; preference persists per device. */
export const engine = new EngineSound();
const PREF = "apex.sound";
export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(PREF) === "on";
  } catch {
    return false;
  }
}
export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(PREF, on ? "on" : "off");
  } catch {
    /* ignore */
  }
  if (on) engine.resume();
  else engine.silence();
}
