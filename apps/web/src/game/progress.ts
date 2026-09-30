import type { PreparedTrack } from "@apex/engine";

/**
 * Tracks how much of the lap the player's strokes cover, by projecting each
 * drawn point onto the centerline with a local search (so hairpin legs and
 * Suzuka's crossover are never confused).
 */
export class LapProgress {
  private covered: Uint8Array;
  private count = 0;
  private cur = -1;
  private readonly win: number;

  constructor(private pt: PreparedTrack) {
    this.covered = new Uint8Array(pt.n);
    this.win = Math.ceil(40 / pt.step);
  }

  reset() {
    this.covered.fill(0);
    this.count = 0;
    this.cur = -1;
  }

  /** Index of the centerline point nearest the last added point (-1 before any). */
  get index() {
    return this.cur;
  }

  add(x: number, y: number) {
    const { n, cx, cy } = this.pt;
    const d2 = (i: number) => (x - cx[i]) * (x - cx[i]) + (y - cy[i]) * (y - cy[i]);
    let best = 0;
    if (this.cur < 0) {
      for (let i = 1; i < n; i++) if (d2(i) < d2(best)) best = i;
    } else {
      best = this.cur;
      for (let o = -this.win; o <= this.win; o++) {
        const i = (this.cur + o + n) % n;
        if (d2(i) < d2(best)) best = i;
      }
    }
    if (this.cur >= 0) {
      const fwd = (best - this.cur + n) % n;
      const back = (this.cur - best + n) % n;
      const [step, len] = fwd <= back ? [1, fwd] : [-1, back];
      for (let o = 0; o <= len; o++) this.mark((this.cur + step * o + n) % n);
    } else this.mark(best);
    this.cur = best;
  }

  private mark(i: number) {
    if (!this.covered[i]) {
      this.covered[i] = 1;
      this.count++;
    }
  }

  get fraction() {
    return this.count / this.pt.n;
  }

  /** Longest uncovered stretch of track, in metres. */
  largestGapM(): number {
    const { n, step } = this.pt;
    if (this.count === 0) return n * step;
    let start = 0;
    while (!this.covered[start]) start++;
    let run = 0;
    let best = 0;
    for (let o = 1; o <= n; o++) {
      if (!this.covered[(start + o) % n]) best = Math.max(best, ++run);
      else run = 0;
    }
    return best * step;
  }
}
