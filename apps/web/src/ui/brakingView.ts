import type { Zone } from "../modes/braking";

/**
 * Braking point's onboard view, drawn on a canvas each frame: the road ahead
 * in perspective (bent by the racing line's real curvature), kerbs where it
 * turns, the distance boards, a dusk sky, and the car from behind with its
 * rain light. Pure drawing: the run's physics lives in modes/braking.ts.
 */

/** Distance boards, metres before the corner. */
export const BOARDS = [300, 200, 100, 50];

const ROAD_HALF = 6.5; // m
const KERB_W = 1.1;
const CAM_BACK = 6.5; // camera this far behind the car
const CAM_H = 2.3;
const STEP = 2;
const AHEAD = 360;
const NEAR = 0.6;

const C = {
  skyTop: "#0b1220",
  skyLow: "#26303f",
  glow: "rgba(255,106,19,0.22)",
  hills: "#0f1a17",
  trees: "#0c1512",
  grassA: "#1b3121",
  grassB: "#182c1e",
  roadA: "#34383f",
  roadB: "#30343a",
  line: "#e9e9e4",
  kerbR: "#e5332a",
  kerbW: "#efefe9",
  boardFace: "#f4f4f0",
  boardInk: "#0a0b0d",
  post: "#8a9099",
};

/** Curvature (1/m) of the road at s (metres from the corner), from the zone's samples. */
function kappaAt(z: Zone, s: number): number {
  const f = (s - z.from) / z.kappaStep;
  if (f <= 0) return z.kappa[0] / 1e5;
  const i = Math.floor(f);
  if (i >= z.kappa.length - 1) return 0;
  return (z.kappa[i] + (z.kappa[i + 1] - z.kappa[i]) * (f - i)) / 1e5;
}

/** A tree line along the horizon, the same every frame (seeded from the circuit). */
const skylines = new Map<string, number[]>();
function skyline(seed: string): number[] {
  let line = skylines.get(seed);
  if (line) return line;
  let a = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 9) >>> 0;
  const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  line = [];
  let h = 0.5;
  for (let i = 0; i < 160; i++) {
    h = Math.max(0.15, Math.min(1, h + (rnd() - 0.5) * 0.35));
    line.push(h * (0.6 + rnd() * 0.4));
  }
  skylines.set(seed, line);
  return line;
}

export interface Frame {
  /** car position, metres from the corner */
  s: number;
  /** speed, m/s */
  v: number;
  braking: boolean;
  /** seconds since the run began, for the shake */
  t: number;
}

export function drawRun(ctx: CanvasRenderingContext2D, W: number, H: number, z: Zone, fr: Frame) {
  const f = Math.min(W * 0.95, H * 1.25);
  const cx = W / 2;
  // the nose dips under braking
  const hy = H * 0.4 + (fr.braking ? H * 0.012 : 0);
  const shake = Math.sin(fr.t * 61) * Math.min(1, fr.v / 90) * H * 0.0018;

  // sky and horizon glow
  const sky = ctx.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, C.skyTop);
  sky.addColorStop(1, C.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, hy + 1);
  const glow = ctx.createRadialGradient(cx, hy, 0, cx, hy, W * 0.7);
  glow.addColorStop(0, C.glow);
  glow.addColorStop(1, "rgba(255,106,19,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, hy + 1);

  // hills and trees on the horizon
  const line = skyline(z.track);
  ctx.fillStyle = C.hills;
  ctx.beginPath();
  ctx.moveTo(0, hy);
  for (let i = 0; i <= 40; i++) ctx.lineTo((i / 40) * W, hy - H * 0.05 * line[(i * 3) % line.length]);
  ctx.lineTo(W, hy);
  ctx.fill();
  ctx.fillStyle = C.trees;
  ctx.beginPath();
  ctx.moveTo(0, hy + 1);
  for (let i = 0; i < line.length; i++) ctx.lineTo((i / (line.length - 1)) * W, hy - H * 0.028 * line[i]);
  ctx.lineTo(W, hy + 1);
  ctx.fill();

  // the road from the camera forward, in camera space (X right, Z ahead)
  const s0 = fr.s - CAM_BACK;
  type P = { X: number; Z: number; th: number; s: number };
  const pts: P[] = [];
  let X = 0;
  let Zf = 0;
  let th = 0;
  for (let d = 0; d <= AHEAD; d += STEP) {
    const s = s0 + d;
    pts.push({ X, Z: Zf, th, s });
    const k = kappaAt(z, s);
    th += k * STEP; // + = turning left
    X -= Math.sin(th) * STEP;
    Zf += Math.cos(th) * STEP;
    if (Math.cos(th) < 0.12) break; // past a hairpin's turn: the rest is hidden behind it
  }
  const proj = (x: number, zz: number, y = 0): [number, number] => [cx + (f * x) / zz, hy + (f * (CAM_H - y)) / zz + shake];
  /** a point beside the road at lateral offset `off` (m, + right) */
  const side = (p: P, off: number): [number, number] => proj(p.X + Math.cos(p.th) * off, p.Z + Math.sin(p.th) * off);

  // grass, far to near, in bands
  ctx.fillStyle = C.grassA;
  ctx.fillRect(0, hy, W, H - hy);
  for (let i = pts.length - 1; i > 0; i--) {
    const a = pts[i - 1];
    const b = pts[i];
    if (b.Z < NEAR) continue;
    if (Math.floor(a.s / 14) % 2 === 0) continue;
    const [, ya] = proj(0, Math.max(NEAR, a.Z));
    const [, yb] = proj(0, b.Z);
    ctx.fillStyle = C.grassB;
    ctx.fillRect(0, yb, W, Math.max(1, ya - yb + 0.5));
  }

  const quad = (a: [number, number], b: [number, number], c: [number, number], d: [number, number], fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fill();
  };

  for (let i = pts.length - 1; i > 0; i--) {
    const a = pts[i - 1];
    const b = pts[i];
    if (b.Z < NEAR || a.Z < NEAR * 0.5) continue;
    const band = Math.floor(a.s / 8) % 2 === 0;
    const turning = Math.abs(kappaAt(z, a.s)) > 1 / 170; // corners, not flat-out kinks
    // kerbs on both edges where the road turns
    if (turning) {
      const kc = Math.floor(a.s / 3.5) % 2 === 0 ? C.kerbR : C.kerbW;
      quad(side(a, -ROAD_HALF - KERB_W), side(a, -ROAD_HALF), side(b, -ROAD_HALF), side(b, -ROAD_HALF - KERB_W), kc);
      quad(side(a, ROAD_HALF), side(a, ROAD_HALF + KERB_W), side(b, ROAD_HALF + KERB_W), side(b, ROAD_HALF), kc);
    }
    quad(side(a, -ROAD_HALF), side(a, ROAD_HALF), side(b, ROAD_HALF), side(b, -ROAD_HALF), band ? C.roadA : C.roadB);
    // white edge lines
    quad(side(a, -ROAD_HALF + 0.15), side(a, -ROAD_HALF + 0.45), side(b, -ROAD_HALF + 0.45), side(b, -ROAD_HALF + 0.15), C.line);
    quad(side(a, ROAD_HALF - 0.45), side(a, ROAD_HALF - 0.15), side(b, ROAD_HALF - 0.15), side(b, ROAD_HALF - 0.45), C.line);
  }

  // distance boards on the outside of the corner, far ones first
  const out = z.direction === "left" ? 1 : -1;
  for (const m of BOARDS) {
    const s = -m;
    if (s < z.from + 6) continue;
    const d = s - s0;
    if (d <= CAM_BACK * 0.3) continue;
    const idx = Math.floor(d / STEP);
    if (idx >= pts.length - 1) continue;
    const p = pts[idx];
    if (p.Z < 1.5) continue;
    const off = out * (ROAD_HALF + 4.2);
    const bx = p.X + Math.cos(p.th) * off;
    const bz = p.Z + Math.sin(p.th) * off;
    const [px, pyGround] = proj(bx, bz, 0);
    const [, pyTop] = proj(bx, bz, 2.5);
    const scale = f / bz;
    const bw = 1.9 * scale;
    const bh = 1.35 * scale;
    // post
    ctx.fillStyle = C.post;
    ctx.fillRect(px - 0.06 * scale, pyTop + bh * 0.5, 0.12 * scale, pyGround - pyTop - bh * 0.5);
    // face
    ctx.fillStyle = C.boardFace;
    ctx.fillRect(px - bw / 2, pyTop - bh / 2, bw, bh);
    ctx.strokeStyle = C.boardInk;
    ctx.lineWidth = Math.max(1, 0.07 * scale);
    ctx.strokeRect(px - bw / 2 + 0.12 * scale, pyTop - bh / 2 + 0.12 * scale, bw - 0.24 * scale, bh - 0.24 * scale);
    if (bh > 6) {
      ctx.fillStyle = C.boardInk;
      ctx.font = `800 ${Math.round(bh * 0.62)}px "Archivo Variable", Archivo, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(m), px, pyTop + bh * 0.03);
    }
  }

  drawCar(ctx, cx, hy + (f * CAM_H) / CAM_BACK + shake * 0.5, (f * 2.0) / CAM_BACK, fr.braking, fr.t);
}

/** The car from behind and a little above. `w` is its width in pixels; (x, y) the middle of its rear axle on the ground. */
function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, braking: boolean, t: number) {
  const u = w / 200; // design units: the car is 200 wide
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u, u);

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 4, 118, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  const rr = (x0: number, y0: number, w0: number, h0: number, r: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x0, y0, w0, h0, r);
    ctx.fill();
  };

  // front wheels, further up the screen and partly hidden
  rr(-92, -96, 28, 34, 5, "#0d0e10");
  rr(64, -96, 28, 34, 5, "#0d0e10");
  // floor and sidepods
  ctx.fillStyle = "#16181c";
  ctx.beginPath();
  ctx.moveTo(-70, -12);
  ctx.lineTo(70, -12);
  ctx.lineTo(56, -70);
  ctx.lineTo(-56, -70);
  ctx.closePath();
  ctx.fill();
  // engine cover, in the player's colour
  const body = ctx.createLinearGradient(-40, 0, 40, 0);
  body.addColorStop(0, "#b8470b");
  body.addColorStop(0.45, "#ff7a2a");
  body.addColorStop(1, "#c24d0d");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-34, -16);
  ctx.lineTo(34, -16);
  ctx.quadraticCurveTo(26, -70, 12, -104);
  ctx.lineTo(-12, -104);
  ctx.quadraticCurveTo(-26, -70, -34, -16);
  ctx.closePath();
  ctx.fill();
  // airbox and halo hint
  rr(-9, -122, 18, 22, 6, "#1a1c21");
  ctx.strokeStyle = "#2a2d33";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, -112, 26, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  // diffuser
  ctx.fillStyle = "#0e0f12";
  ctx.beginPath();
  ctx.moveTo(-62, -2);
  ctx.lineTo(62, -2);
  ctx.lineTo(54, -20);
  ctx.lineTo(-54, -20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#24272d";
  ctx.lineWidth = 2;
  for (const fx of [-36, -12, 12, 36]) {
    ctx.beginPath();
    ctx.moveTo(fx, -3);
    ctx.lineTo(fx * 0.9, -19);
    ctx.stroke();
  }

  // rear tyres, with a tread shimmer that moves with speed
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -104 : 66;
    rr(x0, -62, 38, 62, 7, "#0c0d0f");
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    const off = (t * 900) % 14;
    for (let yy = -58 + off; yy < -4; yy += 14) ctx.fillRect(x0 + 4, yy, 30, 3);
    rr(x0 + 6, -60, 5, 56, 2, "rgba(255,255,255,0.05)");
  }

  // rear wing: endplates, main plane with a stripe in the player's colour
  rr(-74, -142, 9, 58, 2, "#121418");
  rr(65, -142, 9, 58, 2, "#121418");
  rr(-72, -142, 144, 18, 3, "#1b1e23");
  rr(-72, -133, 144, 4, 1, "#ff6a13");
  rr(-66, -116, 132, 9, 2, "#16181c");
  // beam wing pillar
  rr(-4, -108, 8, 26, 2, "#121418");

  // rain light: the brake light everyone behind sees
  ctx.save();
  if (braking) {
    ctx.shadowColor = "#ff2b1a";
    ctx.shadowBlur = 38;
  }
  rr(-11, -62, 22, 12, 2, braking ? "#ff2b1a" : "#4a1410");
  ctx.restore();
  if (braking) {
    ctx.fillStyle = "rgba(255,43,26,0.16)";
    ctx.beginPath();
    ctx.ellipse(0, -56, 70, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
