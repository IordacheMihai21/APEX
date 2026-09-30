/** World (metres, y up) ↔ screen (CSS px, y down). The camera looks at (x, y). */
export class Camera {
  x = 0;
  y = 0;
  scale = 1; // CSS px per metre
  w = 1;
  h = 1;
  /** Screen-space point the camera centre maps to (lets overlays offset the view). */
  ox = 0.5;
  oy = 0.5;

  private anim: { from: [number, number, number]; to: [number, number, number]; t0: number; ms: number } | null = null;

  toScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.x) * this.scale + this.w * this.ox, this.h * this.oy - (wy - this.y) * this.scale];
  }

  toWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.w * this.ox) / this.scale + this.x, this.y - (sy - this.h * this.oy) / this.scale];
  }

  apply(ctx: CanvasRenderingContext2D, dpr: number) {
    const s = this.scale * dpr;
    ctx.setTransform(s, 0, 0, -s, dpr * (this.w * this.ox - this.x * this.scale), dpr * (this.h * this.oy + this.y * this.scale));
  }

  /** Zoom by factor k keeping screen point (sx, sy) fixed. */
  zoomAt(k: number, sx: number, sy: number, min: number, max: number) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.scale = Math.min(max, Math.max(min, this.scale * k));
    const [nx, ny] = this.toWorld(sx, sy);
    this.x += wx - nx;
    this.y += wy - ny;
    this.anim = null;
  }

  panBy(dxPx: number, dyPx: number) {
    this.x -= dxPx / this.scale;
    this.y += dyPx / this.scale;
    this.anim = null;
  }

  animateTo(x: number, y: number, scale: number, ms = 380) {
    if (ms <= 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.x = x;
      this.y = y;
      this.scale = scale;
      this.anim = null;
      return;
    }
    this.anim = { from: [this.x, this.y, this.scale], to: [x, y, scale], t0: performance.now(), ms };
  }

  /** Advance any running animation; returns true while animating. */
  tick(now: number): boolean {
    if (!this.anim) return false;
    const { from, to, t0, ms } = this.anim;
    const u = Math.min(1, (now - t0) / ms);
    const e = 1 - (1 - u) * (1 - u) * (1 - u); // ease-out cubic
    this.x = from[0] + (to[0] - from[0]) * e;
    this.y = from[1] + (to[1] - from[1]) * e;
    // interpolate zoom geometrically so it feels even
    this.scale = from[2] * Math.pow(to[2] / from[2], e);
    if (u >= 1) this.anim = null;
    return true;
  }

  get animating() {
    return this.anim !== null;
  }
}
