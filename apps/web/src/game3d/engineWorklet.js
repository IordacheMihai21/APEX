/* global sampleRate, registerProcessor, AudioWorkletProcessor */
/**
 * A 2026-style 1.6-litre V6 hybrid, made sample by sample (our own synthesis, nothing recorded). Its spectrum follows a
 * reference onboard we measured: the crank turns at rpm/60 Hz and the sound sits on its half orders, strongest at
 * order 3 (three firings a turn), then 1.5, 9, 4.5, 1 and 4; each firing is a little louder or softer than the last, as
 * in a real engine, and carries a puff of exhaust noise; the turbo whistles high above, rising with the boost.
 * Inputs (k-rate): rpm, throttle (0 off to 1 flat out).
 */
const ORDERS = [
  [1, 0.14],
  [1.5, 0.28],
  [2, 0.1],
  [3, 1],
  [3.5, 0.12],
  [4, 0.16],
  [4.5, 0.22],
  [6, 0.09],
  [7.5, 0.12],
  [9, 0.25],
  [10.5, 0.11],
  [12, 0.06],
  [13.5, 0.05],
  [15, 0.05],
  [16.5, 0.035],
  [18, 0.03],
];

class Engine extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "rpm", defaultValue: 4000, minValue: 0, maxValue: 16000, automationRate: "k-rate" },
      { name: "throttle", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" },
    ];
  }

  constructor() {
    super();
    this.phase = 0; // crank turns
    this.rpm = 4000;
    this.thr = 0;
    this.fire = 0; // firings so far
    this.amp = 1; // this firing's strength
    this.ampTo = 1;
    this.puff = 0; // exhaust noise envelope
    this.lp = 0;
    this.hp = 0;
    this.boost = 0;
    this.turboPhase = 0;
    this.offsets = ORDERS.map((_, i) => (i * 2.399) % (2 * Math.PI));
  }

  process(_in, outputs, params) {
    const out = outputs[0][0];
    if (!out) return true;
    const rpmTo = params.rpm[0];
    const thrTo = params.throttle[0];
    const n = out.length;
    for (let i = 0; i < n; i++) {
      // glide to the asked revs and throttle, so a block's step is never heard
      this.rpm += (rpmTo - this.rpm) * 0.002;
      this.thr += (thrTo - this.thr) * 0.0004;
      const turnsPerSample = this.rpm / 60 / sampleRate;
      this.phase += turnsPerSample;
      if (this.phase > 1e6) this.phase -= 1e6;
      // a firing every third of a turn: a new strength, and a puff of exhaust
      const fire = Math.floor(this.phase * 3);
      if (fire !== this.fire) {
        this.fire = fire;
        this.ampTo = 0.82 + Math.random() * 0.36;
        this.puff = 1;
      }
      this.amp += (this.ampTo - this.amp) * 0.02;
      this.puff *= 1 - 0.0009 * (this.rpm / 1000);

      let s = 0;
      const tau = 2 * Math.PI * this.phase;
      for (let k = 0; k < ORDERS.length; k++) {
        const [order, g] = ORDERS[k];
        // the firing order and its multiples swell and fade with each firing's strength; the half orders less so
        const pulse = order % 1.5 === 0 ? this.amp : 0.5 + 0.5 * this.amp;
        s += g * pulse * Math.sin(order * tau + this.offsets[k]);
      }
      // off the throttle the high orders die back and the sound goes hollow
      const bright = 0.45 + 0.55 * this.thr;
      s *= 0.32 * bright;

      // exhaust noise in each firing, band-limited (a one-pole low- and high-pass)
      const white = Math.random() * 2 - 1;
      this.lp += (white - this.lp) * 0.35;
      const band = this.lp - this.hp;
      this.hp += (this.lp - this.hp) * 0.04;
      s += band * (0.012 + this.puff * (0.02 + 0.03 * this.thr));

      // the turbo: a whistle that climbs with boost (built on the throttle, lost on a lift)
      this.boost += ((this.thr > 0.5 ? this.rpm / 12500 : 0) - this.boost) * (this.thr > 0.5 ? 0.000012 : 0.00006);
      const turboHz = 2400 + 2000 * this.boost;
      this.turboPhase += turboHz / sampleRate;
      if (this.turboPhase > 1) this.turboPhase -= 1;
      s += Math.sin(2 * Math.PI * this.turboPhase) * 0.035 * this.boost;

      out[i] = s;
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    return true;
  }
}

registerProcessor("lapdle-engine", Engine);
