/**
 * Top-down formula car. The body is pre-rendered to offscreen sprites at a few
 * resolutions (a mip chain, so the car stays crisp at every zoom instead of
 * shimmering as one big bitmap is shrunk and rotated); the front wheels, the
 * shadows and the brake glow are drawn live, so the wheels steer into corners
 * and the discs glow under braking. Generic open-wheel silhouette, livery in
 * the game's own colours; no team or sponsor marks.
 *
 * Car frame: x forward, y to the side, metres. Length 5.6 m, width 2.0 m.
 */

export const CAR_LENGTH = 5.6;
export const CAR_WIDTH = 2.0;
const PAD = 0.5; // metres of padding around the car (wheel and shadow bleed)
/** Sprite resolutions, pixels per metre; the draw picks the first one that covers the screen. */
const MIPS = [20, 40, 80, 150];
/** Drawn a touch larger than life so the car reads at chase-cam distance. */
const PRESENCE = 1.2;
export const FRONT_AXLE = 1.75;
export const REAR_AXLE = -1.6;
export const TRACK_HALF = 0.8; // wheel centre from the car's centreline

interface Livery {
  body: string;
  bodyLight: string;
  bodyDark: string;
  accent: string;
  helmet: string;
}

const LIVERIES: Record<"player" | "ghost", Livery> = {
  player: { body: "#ff6a13", bodyLight: "#ff9a5c", bodyDark: "#a83c06", accent: "#f2f2ee", helmet: "#f5c518" },
  ghost: { body: "#cfd4da", bodyLight: "#eef1f4", bodyDark: "#7d838b", accent: "#2e3136", helmet: "#f2f2ee" },
};

const CARBON = "#141518";
const CARBON_HI = "#2a2c31";
const TYRE = "#0f1012";
/** Sidewall band: a medium slick in the dry, full wets (blue) on a wet day. */
const COMPOUND = { dry: "#f5c518", wet: "#2f7fd6" };
type Tyres = keyof typeof COMPOUND;

type Ctx = CanvasRenderingContext2D;

function canvas(ppm: number, len: number, wid: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = Math.ceil(len * ppm);
  c.height = Math.ceil(wid * ppm);
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.scale(ppm, ppm);
  return [c, ctx];
}

/** Mirror-symmetric outline from (x, halfWidth) pairs, nose to tail, smoothed with quadratic joins. */
function symmetric(ctx: Ctx, half: [number, number][]) {
  const side = (s: 1 | -1, pts: [number, number][]) => {
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, w0] = pts[i];
      const [x1, w1] = pts[i + 1];
      ctx.quadraticCurveTo(x0, s * w0, (x0 + x1) / 2, (s * (w0 + w1)) / 2);
    }
    const [xl, wl] = pts[pts.length - 1];
    ctx.lineTo(xl, s * wl);
  };
  ctx.beginPath();
  ctx.moveTo(half[0][0], -half[0][1]);
  side(-1, half);
  const back = [...half].reverse();
  ctx.lineTo(back[0][0], back[0][1]);
  side(1, back);
  ctx.closePath();
}

/** Cylindrical shading across the car: dark flanks, lit crown, like a body seen from above. */
function across(ctx: Ctx, half: number, dark: string, mid: string, light: string) {
  const g = ctx.createLinearGradient(0, -half, 0, half);
  g.addColorStop(0, dark);
  g.addColorStop(0.3, mid);
  g.addColorStop(0.5, light);
  g.addColorStop(0.7, mid);
  g.addColorStop(1, dark);
  return g;
}

let weave: HTMLCanvasElement | null = null;
/**
 * 2x2 twill carbon weave as a pattern, sized in metres (a 2 cm tow), so bare
 * carbon reads as woven fibre with a sheen, not flat black.
 */
function carbon(ctx: Ctx): CanvasPattern {
  if (!weave) {
    weave = document.createElement("canvas");
    weave.width = weave.height = 16;
    const w = weave.getContext("2d")!;
    w.fillStyle = CARBON;
    w.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        // alternate tows run across and along, offset each row: the twill diagonal
        const along = (i + j) % 4 < 2;
        const g = along ? w.createLinearGradient(i * 4, 0, i * 4 + 4, 0) : w.createLinearGradient(0, j * 4, 0, j * 4 + 4);
        g.addColorStop(0, "#101114");
        g.addColorStop(0.5, along ? "#2c2f35" : "#202227");
        g.addColorStop(1, "#101114");
        w.fillStyle = g;
        w.fillRect(i * 4 + 0.3, j * 4 + 0.3, 3.4, 3.4);
      }
  }
  const p = ctx.createPattern(weave, "repeat")!;
  p.setTransform(new DOMMatrix().scale(0.04 / 16));
  return p;
}

/**
 * A tyre seen from above: a rounded block, shaded as a cylinder rolling along
 * x, with a scrubbed tread crown, the rim's dark shoulder, and the compound
 * band on the outer sidewall. Wets carry their deep tread grooves.
 */
function tyre(ctx: Ctx, x: number, y: number, len: number, wid: number, outside: 1 | -1, kind: Tyres = "dry") {
  const x0 = x - len / 2;
  const y0 = y - wid / 2;
  ctx.fillStyle = TYRE;
  ctx.beginPath();
  ctx.roundRect(x0, y0, len, wid, Math.min(len, wid) * 0.3);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // rolling cylinder: dark where the tread turns away fore and aft
  const roll = ctx.createLinearGradient(x0, 0, x0 + len, 0);
  roll.addColorStop(0, "rgba(0,0,0,0.55)");
  roll.addColorStop(0.22, "rgba(255,255,255,0.03)");
  roll.addColorStop(0.5, "rgba(255,255,255,0.12)");
  roll.addColorStop(0.78, "rgba(255,255,255,0.03)");
  roll.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = roll;
  ctx.fillRect(x0, y0, len, wid);
  // shoulders: the tread rolls over to the sidewalls
  const sh = ctx.createLinearGradient(0, y0, 0, y0 + wid);
  sh.addColorStop(0, "rgba(0,0,0,0.5)");
  sh.addColorStop(0.16, "rgba(0,0,0,0)");
  sh.addColorStop(0.84, "rgba(0,0,0,0)");
  sh.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = sh;
  ctx.fillRect(x0, y0, len, wid);
  if (kind === "wet") {
    // directional grooves: a chevron that clears water to both shoulders
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 0.01;
    ctx.beginPath();
    for (let gx = x0 - 0.1; gx < x0 + len + 0.1; gx += 0.095) {
      ctx.moveTo(gx, y0 + wid * 0.12);
      ctx.lineTo(gx + 0.06, y);
      ctx.lineTo(gx, y0 + wid * 0.88);
    }
    ctx.moveTo(x0, y - wid * 0.2);
    ctx.lineTo(x0 + len, y - wid * 0.2);
    ctx.moveTo(x0, y + wid * 0.2);
    ctx.lineTo(x0 + len, y + wid * 0.2);
    ctx.stroke();
  } else {
    // scrubbed slick: rubber pick-up and graining as faint streaks along the crown
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 0.008;
    ctx.beginPath();
    for (let k = 1; k < 9; k++) {
      const yy = y0 + (wid * k) / 9;
      ctx.moveTo(x0, yy);
      ctx.lineTo(x0 + len, yy + ((k * 7) % 3) * 0.002);
    }
    ctx.stroke();
  }
  ctx.restore();
  // the outer sidewall shows a sliver of compound colour
  ctx.fillStyle = COMPOUND[kind];
  ctx.globalAlpha = 0.9;
  ctx.fillRect(x - len * 0.32, y + outside * (wid / 2 - 0.035) - 0.0125, len * 0.64, 0.025);
  ctx.globalAlpha = 1;
}

const BODY: [number, number][] = [
  [2.78, 0.05],
  [2.45, 0.1],
  [1.8, 0.17],
  [1.2, 0.26],
  [0.8, 0.33],
  [0.55, 0.42],
  [0.35, 0.62], // sidepod inlet
  [-0.2, 0.66],
  [-0.8, 0.56],
  [-1.3, 0.34],
  [-1.85, 0.2],
  [-2.25, 0.16],
];

const FLOOR: [number, number][] = [
  [1.15, 0.3],
  [0.7, 0.72],
  [-0.95, 0.76],
  [-1.45, 0.66],
  [-2.25, 0.52],
];

function drawBody(ctx: Ctx, l: Livery, wheels = true, kind: Tyres = "dry") {
  // floor and diffuser: carbon, with a lit leading edge and strakes behind the axle
  ctx.fillStyle = carbon(ctx);
  symmetric(ctx, FLOOR);
  ctx.fill();
  // floor edge wing: a lit lip all the way round
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  symmetric(ctx, FLOOR.map(([x, w]) => [x, w * 0.97] as [number, number]));
  ctx.fill();
  ctx.strokeStyle = CARBON_HI;
  ctx.lineWidth = 0.025;
  ctx.stroke();
  ctx.strokeStyle = "#202226";
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  for (const yy of [-0.36, -0.12, 0.12, 0.36]) {
    ctx.moveTo(-2.0, yy);
    ctx.lineTo(-2.3, yy * 1.1);
  }
  ctx.stroke();

  // wishbones: thin carbon arms out to each wheel
  ctx.strokeStyle = "#34373d";
  ctx.lineWidth = 0.05;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(2.0, s * 0.12);
    ctx.lineTo(FRONT_AXLE, s * (TRACK_HALF - 0.1));
    ctx.moveTo(1.45, s * 0.2);
    ctx.lineTo(FRONT_AXLE, s * (TRACK_HALF - 0.1));
    ctx.moveTo(-1.3, s * 0.3);
    ctx.lineTo(REAR_AXLE, s * (TRACK_HALF - 0.12));
    ctx.moveTo(-1.95, s * 0.18);
    ctx.lineTo(REAR_AXLE, s * (TRACK_HALF - 0.12));
  }
  ctx.stroke();

  // rear tyres live in the sprite (they don't steer)
  if (wheels) for (const s of [-1, 1] as const) tyre(ctx, REAR_AXLE, s * TRACK_HALF, 0.74, 0.42, s, kind);

  // body: cylindrical shading, then a dark undercut where the sidepods fall away
  ctx.fillStyle = across(ctx, 0.66, l.bodyDark, l.body, l.bodyLight);
  symmetric(ctx, BODY);
  ctx.fill();
  ctx.save();
  symmetric(ctx, BODY);
  ctx.clip();
  const ramp = ctx.createLinearGradient(0.2, 0, -1.2, 0);
  ramp.addColorStop(0, "rgba(0,0,0,0)");
  ramp.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = ramp;
  for (const s of [-1, 1]) ctx.fillRect(-1.3, s > 0 ? 0.3 : -0.7, 1.5, 0.4);
  ctx.restore();
  // clear coat: the sky mirrored along the crown of the nose and engine cover,
  // and a soft hot spot where the sun (high, north-west) catches the sidepod
  ctx.save();
  symmetric(ctx, BODY);
  ctx.clip();
  const sky = ctx.createLinearGradient(0, -0.3, 0, 0.3);
  sky.addColorStop(0, "rgba(255,255,255,0)");
  sky.addColorStop(0.38, "rgba(255,255,255,0.05)");
  sky.addColorStop(0.46, "rgba(255,255,255,0.32)");
  sky.addColorStop(0.52, "rgba(255,255,255,0.08)");
  sky.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sky;
  ctx.fillRect(-2.3, -0.3, 5.1, 0.6);
  const sun = ctx.createRadialGradient(0.0, -0.46, 0, 0.0, -0.46, 0.42);
  sun.addColorStop(0, "rgba(255,255,255,0.34)");
  sun.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(-0.5, -0.9, 1, 0.9);
  // panel lines: engine cover, sidepod and nose seams
  ctx.strokeStyle = "rgba(0,0,0,0.32)";
  ctx.lineWidth = 0.009;
  ctx.beginPath();
  for (const k of [-1, 1]) {
    ctx.moveTo(0.05, k * 0.3);
    ctx.bezierCurveTo(-0.5, k * 0.36, -1.2, k * 0.24, -1.95, k * 0.12);
    ctx.moveTo(0.3, k * 0.6);
    ctx.quadraticCurveTo(-0.3, k * 0.66, -0.75, k * 0.52);
  }
  ctx.moveTo(1.2, -0.2);
  ctx.lineTo(1.2, 0.2);
  ctx.stroke();
  // cooling louvres on top of each sidepod
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  for (const k of [-1, 1])
    for (let i = 0; i < 6; i++) {
      const lx = -0.82 - i * 0.07;
      ctx.moveTo(lx, k * 0.33);
      ctx.lineTo(lx - 0.02, k * 0.47);
    }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 0.018;
  symmetric(ctx, BODY);
  ctx.stroke();

  // sidepod inlets
  ctx.fillStyle = carbon(ctx);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0.42, s * 0.42);
    ctx.quadraticCurveTo(0.5, s * 0.56, 0.36, s * 0.62);
    ctx.lineTo(0.22, s * 0.6);
    ctx.lineTo(0.26, s * 0.44);
    ctx.closePath();
    ctx.fill();
  }

  // livery: a white chevron across the sidepods, a stripe down the nose
  ctx.fillStyle = l.accent;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-0.05, s * 0.3);
    ctx.lineTo(-0.55, s * 0.6);
    ctx.lineTo(-0.7, s * 0.56);
    ctx.lineTo(-0.2, s * 0.28);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(2.6, -0.02);
  ctx.lineTo(1.25, -0.045);
  ctx.lineTo(1.25, 0.045);
  ctx.lineTo(2.6, 0.02);
  ctx.closePath();
  ctx.fill();

  // engine cover spine and fin, lit along the crown
  ctx.fillStyle = carbon(ctx);
  ctx.fillRect(-2.1, -0.025, 1.75, 0.05);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(-2.1, -0.008, 1.75, 0.016);

  // cockpit, helmet, halo, mirrors
  ctx.fillStyle = CARBON;
  ctx.beginPath();
  ctx.ellipse(0.3, 0, 0.44, 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  const hg = ctx.createRadialGradient(0.17, -0.05, 0.01, 0.13, 0, 0.15);
  hg.addColorStop(0, "#fffbe6");
  hg.addColorStop(0.45, l.helmet);
  hg.addColorStop(1, "#7a6100");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(0.13, 0, 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = l.accent; // helmet stripe, front to back over the crown
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(0.25, 0);
  ctx.lineTo(0.0, 0);
  ctx.stroke();
  ctx.fillStyle = "#1d1f23"; // visor
  ctx.beginPath();
  ctx.ellipse(0.22, 0, 0.035, 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2b2e33";
  ctx.lineWidth = 0.075;
  ctx.beginPath();
  ctx.moveTo(0.8, 0);
  ctx.bezierCurveTo(0.62, -0.27, 0.05, -0.27, -0.1, -0.2);
  ctx.moveTo(0.8, 0);
  ctx.bezierCurveTo(0.62, 0.27, 0.05, 0.27, -0.1, 0.2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(0.74, -0.03);
  ctx.bezierCurveTo(0.58, -0.25, 0.08, -0.25, -0.06, -0.19);
  ctx.stroke();
  ctx.fillStyle = CARBON;
  for (const s of [-1, 1]) {
    ctx.fillRect(0.62, s * 0.44 - 0.05, 0.12, 0.1);
    ctx.fillStyle = "#3b3f46";
    ctx.fillRect(0.64, s * 0.44 - 0.03, 0.08, 0.06);
    ctx.fillStyle = CARBON;
  }

  // airbox
  ctx.fillStyle = CARBON;
  ctx.beginPath();
  ctx.ellipse(-0.32, 0, 0.13, 0.085, 0, 0, Math.PI * 2);
  ctx.fill();

  // front wing: three elements, livery endplates, nose pillars
  ctx.lineCap = "butt";
  ctx.strokeStyle = CARBON;
  for (const [x0, w] of [
    [2.92, 0.07],
    [2.78, 0.06],
    [2.66, 0.05],
  ] as const) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0 - 0.02, -0.98);
    ctx.quadraticCurveTo(x0 - 0.18, 0, x0 - 0.02, 0.98);
    ctx.stroke();
  }
  ctx.strokeStyle = CARBON_HI;
  ctx.lineWidth = 0.012;
  ctx.beginPath();
  ctx.moveTo(2.93, -0.96);
  ctx.quadraticCurveTo(2.75, 0, 2.93, 0.96);
  ctx.stroke();
  ctx.fillStyle = l.body;
  for (const s of [-1, 1]) ctx.fillRect(2.58, s * 0.99 - 0.035, 0.4, 0.07);

  // rear wing: mainplane, flap (lit leading edge), beam wing below, livery endplates
  ctx.fillStyle = carbon(ctx);
  ctx.fillRect(-2.78, -0.56, 0.4, 1.12);
  // DRS actuator pod in the middle of the flap
  ctx.fillStyle = "#3a3d43";
  ctx.fillRect(-2.62, -0.03, 0.16, 0.06);
  ctx.fillStyle = "#24262b";
  ctx.fillRect(-2.7, -0.54, 0.13, 1.08);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(-2.43, -0.54, 0.025, 1.08);
  ctx.fillStyle = l.body;
  for (const s of [-1, 1]) ctx.fillRect(-2.84, s * 0.58 - 0.035, 0.5, 0.07);
  ctx.fillStyle = l.accent;
  ctx.fillRect(-2.78, -0.2, 0.06, 0.4);
}

function drawFrontTyre(ctx: Ctx, kind: Tyres) {
  tyre(ctx, 0, 0, 0.66, 0.34, 1, kind);
}

/**
 * Soft shadow from a sprite's silhouette: filled black and blurred (canvas
 * filter where supported, otherwise a ring of low-alpha offset copies).
 */
function shadowFrom(src: HTMLCanvasElement, blurPx: number): HTMLCanvasElement {
  const sil = document.createElement("canvas");
  sil.width = src.width;
  sil.height = src.height;
  const sc = sil.getContext("2d")!;
  sc.drawImage(src, 0, 0);
  sc.globalCompositeOperation = "source-in";
  sc.fillStyle = "#000";
  sc.fillRect(0, 0, sil.width, sil.height);
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const oc = out.getContext("2d")!;
  oc.filter = "blur(1px)";
  const hasFilter = oc.filter === "blur(1px)";
  oc.filter = "none";
  if (hasFilter) {
    oc.filter = `blur(${blurPx}px)`;
    oc.drawImage(sil, 0, 0);
  } else {
    for (let r = 1; r <= 3; r++)
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        oc.globalAlpha = 0.07;
        oc.drawImage(sil, Math.cos(a) * r * blurPx * 0.4, Math.sin(a) * r * blurPx * 0.4);
      }
  }
  return out;
}

/**
 * The player's car without wheels, nose up, for scenes that animate the tyres
 * themselves (the pit stop). Returns the canvas and its size in metres.
 */
export function bareCar(ppm: number): { canvas: HTMLCanvasElement; widthM: number; lengthM: number } {
  const L = CAR_LENGTH + 2 * PAD;
  const W = CAR_WIDTH + 2 * PAD;
  const [flat, fc] = canvas(ppm, L, W);
  drawBody(fc, LIVERIES.player, false);
  const out = document.createElement("canvas");
  out.width = flat.height;
  out.height = flat.width;
  const oc = out.getContext("2d")!;
  oc.translate(out.width / 2, out.height / 2);
  oc.rotate(-Math.PI / 2);
  oc.drawImage(flat, -flat.width / 2, -flat.height / 2);
  return { canvas: out, widthM: W, lengthM: L };
}

interface Mip {
  ppm: number;
  player: HTMLCanvasElement;
  ghost: HTMLCanvasElement;
  tyre: HTMLCanvasElement;
  /** wide, soft: the car's shadow on the ground */
  shadow: HTMLCanvasElement;
  /** tight, dark: ambient occlusion right under the floor */
  contact: HTMLCanvasElement;
}

export interface CarPose {
  /** front-wheel angle, radians (positive steers left) */
  steer?: number;
  /** 0..1, braking effort: the front discs glow */
  brake?: number;
  /** -1..1, lateral load: the shadow slides to the outside of the corner */
  load?: number;
}

export class CarSprites {
  private readonly mips: Mip[];
  private readonly L = CAR_LENGTH + 2 * PAD;
  private readonly W = CAR_WIDTH + 2 * PAD;

  /** Wet days: full wets, and the rain light blinks. */
  readonly wet: boolean;

  constructor(wet = false) {
    this.wet = wet;
    const kind: Tyres = wet ? "wet" : "dry";
    this.mips = MIPS.map((ppm) => {
      const [p, pc] = canvas(ppm, this.L, this.W);
      drawBody(pc, LIVERIES.player, true, kind);
      const [g, gc] = canvas(ppm, this.L, this.W);
      drawBody(gc, LIVERIES.ghost, true, kind);
      const [t, tc] = canvas(ppm, 0.8, 0.5);
      drawFrontTyre(tc, kind);
      // the shadow silhouette includes the front wheels at rest
      const [full, fc] = canvas(ppm, this.L, this.W);
      fc.drawImage(p, -this.L / 2, -this.W / 2, this.L, this.W);
      for (const s of [-1, 1]) fc.drawImage(t, FRONT_AXLE - 0.4, s * TRACK_HALF - 0.25, 0.8, 0.5);
      return { ppm, player: p, ghost: g, tyre: t, shadow: shadowFrom(full, 0.16 * ppm), contact: shadowFrom(full, 0.05 * ppm) };
    });
  }

  /** The smallest sprite with at least as many pixels per metre as the screen needs. */
  private mip(devicePpm: number): Mip {
    return this.mips.find((m) => m.ppm >= devicePpm * 0.9) ?? this.mips[this.mips.length - 1];
  }

  /**
   * One motion-blur echo of the player's body: no shadows, wheels or glow,
   * only the sprite at low alpha. Several of these along the path the car
   * drove during the frame turn a car that jumps metres per frame into a
   * smear, the way a camera shutter would see it.
   */
  drawEcho(ctx: Ctx, x: number, y: number, heading: number, px: number, alpha: number) {
    const k = Math.max(PRESENCE, (44 * px) / CAR_LENGTH);
    const t = ctx.getTransform();
    const m = this.mip(Math.hypot(t.a, t.b) * k);
    const L = this.L * k;
    const W = this.W * k;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.drawImage(m.player, -L / 2, -W / 2, L, W);
    ctx.restore();
  }

  /**
   * Draw at a world position and heading. `px` is metres per CSS pixel; the
   * car never drops below ~44 CSS px long so the livery and wings read when
   * zoomed out (a map marker, not a speck).
   */
  draw(ctx: Ctx, x: number, y: number, heading: number, px: number, ghost: boolean, pose: CarPose = {}) {
    const k = Math.max(PRESENCE, (44 * px) / CAR_LENGTH);
    const t = ctx.getTransform();
    const m = this.mip(Math.hypot(t.a, t.b) * k);
    const L = this.L * k;
    const W = this.W * k;
    const smoothing = ctx.imageSmoothingQuality;
    ctx.imageSmoothingQuality = "high";
    ctx.save();
    ctx.translate(x, y);

    // shadows: offset in world space (the sun is fixed to the world), nudged
    // to the outside of the corner by lateral load so the car seems to lean
    const load = Math.max(-1, Math.min(1, pose.load ?? 0));
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    const lean = -load * 0.18 * k;
    if (!ghost) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.translate(0.34 * k - s * lean, -0.42 * k + c * lean);
      ctx.rotate(heading);
      ctx.drawImage(m.shadow, -L / 2, -W / 2, L, W);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.rotate(heading);
      ctx.drawImage(m.contact, -L / 2, -W / 2, L, W);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.translate(0.34 * k, -0.42 * k);
      ctx.rotate(heading);
      ctx.drawImage(m.shadow, -L / 2, -W / 2, L, W);
      ctx.restore();
    }

    ctx.rotate(heading);
    ctx.globalAlpha = ghost ? 0.55 : 1;

    // front wheels first, steered, so the body and wishbones sit over them
    const steer = Math.max(-0.5, Math.min(0.5, pose.steer ?? 0));
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(FRONT_AXLE * k, side * TRACK_HALF * k);
      ctx.rotate(steer);
      ctx.scale(1, side); // mirrored, so the compound band is on the outside of both
      ctx.drawImage(m.tyre, -0.4 * k, -0.25 * k, 0.8 * k, 0.5 * k);
      ctx.restore();
    }
    ctx.drawImage(ghost ? m.ghost : m.player, -L / 2, -W / 2, L, W);

    // brake glow: the front discs, inboard of each wheel, light up under heavy braking
    const brake = ghost ? 0 : Math.max(0, Math.min(1, pose.brake ?? 0));
    if (brake > 0.05) {
      ctx.globalCompositeOperation = "lighter";
      for (const side of [-1, 1]) {
        const gx = FRONT_AXLE * k;
        const gy = side * (TRACK_HALF - 0.22) * k;
        const r = 0.34 * k;
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
        g.addColorStop(0, `rgba(255,150,60,${0.75 * brake})`);
        g.addColorStop(0.45, `rgba(255,80,20,${0.35 * brake})`);
        g.addColorStop(1, "rgba(255,60,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
      }
      ctx.globalCompositeOperation = "source-over";
    }
    // rain light: the red LED under the rear wing, flashing, as the rules require in the wet
    if (this.wet && !ghost && Math.floor(performance.now() / 250) % 2 === 0) {
      ctx.globalCompositeOperation = "lighter";
      const gx = -2.62 * k;
      const r = 0.45 * k;
      const g = ctx.createRadialGradient(gx, 0, 0, gx, 0, r);
      g.addColorStop(0, "rgba(255,70,60,0.95)");
      g.addColorStop(0.25, "rgba(255,30,30,0.4)");
      g.addColorStop(1, "rgba(255,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(gx - r, -r, r * 2, r * 2);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.imageSmoothingQuality = smoothing;
  }
}
