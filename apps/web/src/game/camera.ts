/**
 * World (metres, y up) ↔ screen (CSS px, y down), with rotation.
 * The camera looks at (x, y); `angle` rotates the world clockwise on screen,
 * so a heading of angle + π/2 points straight up.
 */
export class Camera {
  x = 0;
  y = 0;
  scale = 1; // CSS px per metre
  angle = 0;
  w = 1;
  h = 1;

  private anim: { from: number[]; to: number[]; t0: number; ms: number } | null = null;

  toScreen(wx: number, wy: number): [number, number] {
    const dx = wx - this.x;
    const dy = wy - this.y;
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    const rx = dx * c + dy * s;
    const ry = -dx * s + dy * c;
    return [this.w / 2 + rx * this.scale, this.h / 2 - ry * this.scale];
  }

  toWorld(sx: number, sy: number): [number, number] {
    const rx = (sx - this.w / 2) / this.scale;
    const ry = -(sy - this.h / 2) / this.scale;
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    return [this.x + rx * c - ry * s, this.y + rx * s + ry * c];
  }

  apply(ctx: CanvasRenderingContext2D, dpr: number) {
    const k = this.scale * dpr;
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    // Derivation: sx = w/2 + s·(c·dx + s·dy);  sy = h/2 + s·(s·dx − c·dy)
    ctx.setTransform(
      k * c,
      k * s,
      k * s,
      -k * c,
      dpr * (this.w / 2 - this.scale * (c * this.x + s * this.y)),
      dpr * (this.h / 2 - this.scale * (s * this.x - c * this.y)),
    );
  }

  zoomAt(k: number, sx: number, sy: number, min: number, max: number) {
    const [wx, wy] = this.toWorld(sx, sy);
    this.scale = Math.min(max, Math.max(min, this.scale * k));
    const [nx, ny] = this.toWorld(sx, sy);
    this.x += wx - nx;
    this.y += wy - ny;
    this.anim = null;
  }

  panBy(dxPx: number, dyPx: number) {
    const [ax, ay] = this.toWorld(0, 0);
    const [bx, by] = this.toWorld(dxPx, dyPx);
    this.x -= bx - ax;
    this.y -= by - ay;
    this.anim = null;
  }

  animateTo(x: number, y: number, scale: number, angle = this.angle, ms = 420) {
    // rotate the short way round
    let a = angle;
    while (a - this.angle > Math.PI) a -= 2 * Math.PI;
    while (a - this.angle < -Math.PI) a += 2 * Math.PI;
    if (ms <= 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      Object.assign(this, { x, y, scale, angle: a });
      this.anim = null;
      return;
    }
    this.anim = { from: [this.x, this.y, this.scale, this.angle], to: [x, y, scale, a], t0: performance.now(), ms };
  }

  tick(now: number): boolean {
    if (!this.anim) return false;
    const { from, to, t0, ms } = this.anim;
    const u = Math.min(1, (now - t0) / ms);
    const e = 1 - (1 - u) * (1 - u) * (1 - u);
    this.x = from[0] + (to[0] - from[0]) * e;
    this.y = from[1] + (to[1] - from[1]) * e;
    this.scale = from[2] * Math.pow(to[2] / from[2], e);
    this.angle = from[3] + (to[3] - from[3]) * e;
    if (u >= 1) this.anim = null;
    return true;
  }

  get animating() {
    return this.anim !== null;
  }
}
