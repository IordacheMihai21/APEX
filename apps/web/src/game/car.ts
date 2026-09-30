/**
 * Top-down formula car, pre-rendered once to an offscreen sprite (and a
 * soft shadow sprite), then drawn each frame with drawImage in world units.
 * Generic open-wheel silhouette; livery in the game's own colours.
 *
 * Car frame: x forward, y left, metres. Length 5.6 m, width 2.0 m.
 */

export const CAR_LENGTH = 5.6;
export const CAR_WIDTH = 2.0;
const PPM = 60; // sprite resolution, pixels per metre
const PAD = 0.5; // metres of padding around the car (shadow bleed)

interface Livery {
  body: string;
  bodyDark: string;
  accent: string;
  helmet: string;
}

const LIVERIES: Record<"player" | "ghost", Livery> = {
  player: { body: "#ff6a13", bodyDark: "#b8430a", accent: "#eeede6", helmet: "#f5c518" },
  ghost: { body: "#d9dde2", bodyDark: "#8e949b", accent: "#2e3136", helmet: "#eeede6" },
};

const CARBON = "#16171a";
const CARBON_EDGE = "#2c2e33";
const TYRE = "#101113";

function sprite(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = Math.round((CAR_LENGTH + 2 * PAD) * PPM);
  c.height = Math.round((CAR_WIDTH + 2 * PAD) * PPM);
  const ctx = c.getContext("2d")!;
  // metres, origin at car centre, x right = forward, y down = right side (mirror-symmetric car)
  ctx.translate(c.width / 2, c.height / 2);
  ctx.scale(PPM, PPM);
  return [c, ctx];
}

/** Mirror-symmetric outline from the half-profile (x, halfWidth) pairs, nose → tail. */
function symmetric(ctx: CanvasRenderingContext2D, half: [number, number][]) {
  ctx.beginPath();
  half.forEach(([x, w], i) => (i ? ctx.lineTo(x, -w) : ctx.moveTo(x, -w)));
  for (let i = half.length - 1; i >= 0; i--) ctx.lineTo(half[i][0], half[i][1]);
  ctx.closePath();
}

const BODY: [number, number][] = [
  [2.72, 0.06],
  [2.4, 0.12],
  [1.7, 0.2],
  [1.15, 0.3],
  [0.75, 0.36],
  [0.45, 0.62], // sidepod inlet
  [-0.35, 0.66],
  [-0.9, 0.52],
  [-1.45, 0.3],
  [-1.95, 0.22],
  [-2.2, 0.18],
];

const FLOOR: [number, number][] = [
  [1.0, 0.36],
  [0.55, 0.72],
  [-0.9, 0.74],
  [-1.6, 0.56],
  [-2.1, 0.4],
];

function tyre(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, wid: number) {
  ctx.fillStyle = TYRE;
  ctx.beginPath();
  ctx.roundRect(x - len / 2, y - wid / 2, len, wid, 0.08);
  ctx.fill();
  // tread sheen and sidewall lettering hint
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fillRect(x - len / 2 + 0.05, y - wid / 2 + 0.04, len - 0.1, wid * 0.22);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(x - len * 0.18, y - wid / 2, len * 0.36, 0.025);
  ctx.fillRect(x - len * 0.18, y + wid / 2 - 0.025, len * 0.36, 0.025);
}

function drawCar(ctx: CanvasRenderingContext2D, l: Livery) {
  // suspension arms (under the body)
  ctx.strokeStyle = "#3a3d43";
  ctx.lineWidth = 0.045;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(1.9, s * 0.16);
    ctx.lineTo(1.75, s * 0.72);
    ctx.moveTo(1.45, s * 0.22);
    ctx.lineTo(1.75, s * 0.72);
    ctx.moveTo(-1.35, s * 0.3);
    ctx.lineTo(-1.6, s * 0.72);
    ctx.moveTo(-1.85, s * 0.2);
    ctx.lineTo(-1.6, s * 0.72);
  }
  ctx.stroke();

  // tyres: fronts narrower than rears
  for (const s of [-1, 1]) {
    tyre(ctx, 1.75, s * 0.8, 0.66, 0.34);
    tyre(ctx, -1.6, s * 0.8, 0.72, 0.42);
  }

  // floor / plank
  ctx.fillStyle = CARBON;
  symmetric(ctx, FLOOR);
  ctx.fill();

  // body with lateral shading (sun from the upper left of the world)
  const g = ctx.createLinearGradient(0, -0.7, 0, 0.7);
  g.addColorStop(0, l.body);
  g.addColorStop(0.55, l.body);
  g.addColorStop(1, l.bodyDark);
  ctx.fillStyle = g;
  symmetric(ctx, BODY);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 0.02;
  ctx.stroke();

  // sidepod inlets
  ctx.fillStyle = CARBON;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0.46, s * 0.4);
    ctx.lineTo(0.46, s * 0.6);
    ctx.lineTo(0.3, s * 0.6);
    ctx.lineTo(0.3, s * 0.42);
    ctx.closePath();
    ctx.fill();
  }

  // livery: accent stripe along the spine + engine cover fin
  ctx.fillStyle = l.accent;
  ctx.beginPath();
  ctx.moveTo(2.55, -0.025);
  ctx.lineTo(1.2, -0.05);
  ctx.lineTo(1.2, 0.05);
  ctx.lineTo(2.55, 0.025);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-2.0, -0.03, 1.3, 0.06);

  // cockpit opening, driver helmet, halo
  ctx.fillStyle = CARBON;
  ctx.beginPath();
  ctx.ellipse(0.28, 0, 0.42, 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  const hg = ctx.createRadialGradient(0.14, -0.05, 0.02, 0.12, 0, 0.16);
  hg.addColorStop(0, "#fff7cf");
  hg.addColorStop(0.4, l.helmet);
  hg.addColorStop(1, "#8a6d00");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0.12, 0, 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#26282c";
  ctx.lineWidth = 0.07;
  ctx.beginPath();
  ctx.moveTo(0.78, 0);
  ctx.bezierCurveTo(0.6, -0.26, 0.05, -0.26, -0.08, -0.2);
  ctx.moveTo(0.78, 0);
  ctx.bezierCurveTo(0.6, 0.26, 0.05, 0.26, -0.08, 0.2);
  ctx.stroke();

  // airbox behind the driver
  ctx.fillStyle = CARBON;
  ctx.beginPath();
  ctx.ellipse(-0.3, 0, 0.12, 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // front wing: two elements + endplates
  ctx.fillStyle = CARBON;
  ctx.beginPath();
  ctx.moveTo(2.9, -0.98);
  ctx.quadraticCurveTo(2.62, 0, 2.9, 0.98);
  ctx.lineTo(2.64, 0.98);
  ctx.quadraticCurveTo(2.4, 0, 2.64, -0.98);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = CARBON_EDGE;
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(2.8, -0.95);
  ctx.quadraticCurveTo(2.54, 0, 2.8, 0.95);
  ctx.stroke();
  ctx.fillStyle = l.body;
  ctx.fillRect(2.6, -1.0, 0.34, 0.06);
  ctx.fillRect(2.6, 0.94, 0.34, 0.06);

  // rear wing: mainplane + flap, endplates in livery
  ctx.fillStyle = CARBON;
  ctx.fillRect(-2.72, -0.56, 0.36, 1.12);
  ctx.fillStyle = "#23252a";
  ctx.fillRect(-2.66, -0.54, 0.1, 1.08);
  ctx.fillStyle = l.body;
  ctx.fillRect(-2.78, -0.6, 0.46, 0.07);
  ctx.fillRect(-2.78, 0.53, 0.46, 0.07);

  // specular highlight along the upper body edge
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  ctx.moveTo(2.3, -0.1);
  ctx.lineTo(1.15, -0.26);
  ctx.lineTo(0.5, -0.56);
  ctx.lineTo(-0.3, -0.6);
  ctx.stroke();
}

function drawShadow(ctx: CanvasRenderingContext2D) {
  // stacked, offset silhouettes = cheap soft shadow without canvas filters
  ctx.fillStyle = "rgba(0,0,0,0.09)";
  for (let k = 0; k < 7; k++) {
    const g = 0.03 * k;
    ctx.beginPath();
    ctx.roundRect(-2.8 - g, -0.95 - g, 5.7 + 2 * g, 1.9 + 2 * g, 0.4 + g);
    ctx.fill();
  }
}

export class CarSprites {
  readonly player: HTMLCanvasElement;
  readonly ghost: HTMLCanvasElement;
  readonly shadow: HTMLCanvasElement;
  readonly spriteLength = CAR_LENGTH + 2 * PAD;
  readonly spriteWidth = CAR_WIDTH + 2 * PAD;

  constructor() {
    const [p, pc] = sprite();
    drawCar(pc, LIVERIES.player);
    const [g, gc] = sprite();
    drawCar(gc, LIVERIES.ghost);
    const [s, sc] = sprite();
    drawShadow(sc);
    this.player = p;
    this.ghost = g;
    this.shadow = s;
  }

  /**
   * Draw at world position/heading. `minPx` keeps the car legible when zoomed
   * out by scaling it up (a map marker, not a 20-pixel-long speck).
   */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, px: number, ghost: boolean) {
    const k = Math.max(1, (26 * px) / CAR_LENGTH);
    const L = this.spriteLength * k;
    const Wd = this.spriteWidth * k;
    ctx.save();
    ctx.translate(x, y);
    // shadow: offset in world space (sun fixed to the world), drawn before rotating
    ctx.globalAlpha = ghost ? 0.25 : 0.7;
    ctx.save();
    ctx.translate(0.35 * k, -0.45 * k);
    ctx.rotate(heading);
    ctx.drawImage(this.shadow, -L / 2, -Wd / 2, L, Wd);
    ctx.restore();
    ctx.rotate(heading);
    ctx.globalAlpha = ghost ? 0.55 : 1;
    ctx.drawImage(ghost ? this.ghost : this.player, -L / 2, -Wd / 2, L, Wd);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
