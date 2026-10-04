/**
 * Moored boats seen from straight above, pre-rendered once to sprites: a
 * motor yacht (white hull, teak aft deck, tiered superstructure with tinted
 * glass and a flybridge), a sailing yacht (narrow hull, teak deck, mast and
 * boom with its sail cover) and a larger yacht with a grey-blue house. Each
 * sprite is drawn bow to the right (+x) and is symmetric about its long axis,
 * so the world's flipped y doesn't matter. Shadows come from the silhouette.
 */

export type Boat = { img: HTMLCanvasElement; shadow: HTMLCanvasElement };

const PPM = 10; // sprite pixels per metre of a 30 m reference length
const REF = 30;

function hull(ctx: CanvasRenderingContext2D, L: number, B: number, fine: number) {
  // stern square, sides parallel to ~20% forward of midships, then a fine bow
  ctx.beginPath();
  ctx.moveTo(-L / 2, -B / 2);
  ctx.lineTo(L * fine, -B / 2);
  ctx.bezierCurveTo(L * 0.4, -B / 2, L * 0.5, -B * 0.12, L / 2, 0);
  ctx.bezierCurveTo(L * 0.5, B * 0.12, L * 0.4, B / 2, L * fine, B / 2);
  ctx.lineTo(-L / 2, B / 2);
  ctx.closePath();
}

/** Shading across the beam: the deck crowns in the middle and the sides fall away. */
function beam(ctx: CanvasRenderingContext2D, B: number, a: string, b: string) {
  const g = ctx.createLinearGradient(0, -B / 2, 0, B / 2);
  g.addColorStop(0, a);
  g.addColorStop(0.2, b);
  g.addColorStop(0.8, b);
  g.addColorStop(1, a);
  return g;
}

function planks(ctx: CanvasRenderingContext2D, x0: number, x1: number, B: number) {
  ctx.strokeStyle = "rgba(60,36,18,0.35)";
  ctx.lineWidth = 0.04;
  ctx.beginPath();
  for (let y = -B / 2; y <= B / 2; y += 0.14) {
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
  }
  ctx.stroke();
}

function sprite(draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = (REF + 2) * PPM;
  c.height = 10 * PPM;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.scale(PPM, PPM);
  draw(ctx);
  return c;
}

function motorYacht(ctx: CanvasRenderingContext2D) {
  const L = REF;
  const B = 6.6;
  hull(ctx, L, B, 0.18);
  ctx.fillStyle = beam(ctx, B, "#c9ccce", "#f4f3ef");
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 0.08;
  ctx.stroke();
  // toe rail just inside the sheer line
  ctx.save();
  ctx.scale(0.94, 0.86);
  hull(ctx, L, B, 0.18);
  ctx.restore();
  ctx.strokeStyle = "rgba(120,124,128,0.6)";
  ctx.lineWidth = 0.12;
  ctx.stroke();
  // swim platform and teak aft deck
  ctx.fillStyle = "#9a7048";
  ctx.fillRect(-L / 2, -B * 0.42, 1.2, B * 0.84);
  ctx.fillStyle = "#b08455";
  ctx.fillRect(-L / 2 + 1.2, -B * 0.4, 5, B * 0.8);
  planks(ctx, -L / 2, -L / 2 + 6.2, B * 0.8);
  // main deck house, its tinted glass band, then the upper deck and flybridge
  ctx.fillStyle = "#eceae4";
  ctx.beginPath();
  ctx.roundRect(-L / 2 + 6, -B * 0.36, 15, B * 0.72, 1.4);
  ctx.fill();
  ctx.strokeStyle = "#1c2a33";
  ctx.lineWidth = 0.35;
  ctx.stroke();
  ctx.fillStyle = beam(ctx, B * 0.6, "#d9d7d0", "#fbfaf6");
  ctx.beginPath();
  ctx.roundRect(-L / 2 + 8, -B * 0.3, 10.5, B * 0.6, 1.2);
  ctx.fill();
  // sun pads on the flybridge, radar arch across it
  ctx.fillStyle = "#e6dcc6";
  ctx.fillRect(-L / 2 + 9, -B * 0.22, 3.2, B * 0.44);
  ctx.strokeStyle = "#30353b";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(-L / 2 + 14.5, -B * 0.28);
  ctx.lineTo(-L / 2 + 14.5, B * 0.28);
  ctx.stroke();
  ctx.fillStyle = "#1c2a33"; // windscreen
  ctx.beginPath();
  ctx.moveTo(-L / 2 + 21, -B * 0.34);
  ctx.quadraticCurveTo(-L / 2 + 22.6, 0, -L / 2 + 21, B * 0.34);
  ctx.lineTo(-L / 2 + 20.2, B * 0.3);
  ctx.quadraticCurveTo(-L / 2 + 21.6, 0, -L / 2 + 20.2, -B * 0.3);
  ctx.closePath();
  ctx.fill();
  // foredeck: sun pad and anchor hatch
  ctx.fillStyle = "#e3dac4";
  ctx.beginPath();
  ctx.roundRect(L * 0.18, -B * 0.22, 3, B * 0.44, 0.5);
  ctx.fill();
  ctx.fillStyle = "#8b9095";
  ctx.fillRect(L * 0.4, -0.25, 0.8, 0.5);
}

function sailYacht(ctx: CanvasRenderingContext2D) {
  const L = REF;
  const B = 5.4;
  hull(ctx, L, B, 0.05);
  ctx.fillStyle = "#f1f0ec";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 0.08;
  ctx.stroke();
  // teak deck almost everywhere, inside a white cap rail
  ctx.save();
  ctx.scale(0.95, 0.84);
  hull(ctx, L, B, 0.05);
  ctx.restore();
  ctx.fillStyle = "#b5895a";
  ctx.fill();
  ctx.save();
  ctx.clip();
  planks(ctx, -L / 2, L / 2, B);
  ctx.restore();
  // coachroof, cockpit, mast, boom with its blue sail cover
  ctx.fillStyle = beam(ctx, B * 0.5, "#d5d4cf", "#f7f6f2");
  ctx.beginPath();
  ctx.roundRect(-3, -B * 0.25, 11, B * 0.5, 1);
  ctx.fill();
  ctx.fillStyle = "#1c2a33";
  for (const x of [-1.5, 1.5, 4.5]) ctx.fillRect(x, -B * 0.25, 1.3, 0.25);
  for (const x of [-1.5, 1.5, 4.5]) ctx.fillRect(x, B * 0.25 - 0.25, 1.3, 0.25);
  ctx.fillStyle = "#9a7048";
  ctx.fillRect(-9, -B * 0.22, 6, B * 0.44);
  ctx.fillStyle = "#2c4e74";
  ctx.beginPath();
  ctx.roundRect(-8.5, -0.32, 15.5, 0.64, 0.3);
  ctx.fill();
  ctx.fillStyle = "#d8dadc";
  ctx.beginPath();
  ctx.arc(7.6, 0, 0.42, 0, Math.PI * 2);
  ctx.fill();
}

function bigYacht(ctx: CanvasRenderingContext2D) {
  const L = REF;
  const B = 7;
  hull(ctx, L, B, 0.12);
  ctx.fillStyle = beam(ctx, B, "#bfc3c6", "#eeefec");
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 0.08;
  ctx.stroke();
  ctx.fillStyle = "#a77b4f";
  ctx.fillRect(-L / 2 + 0.6, -B * 0.4, 4.4, B * 0.8);
  planks(ctx, -L / 2 + 0.6, -L / 2 + 5, B * 0.8);
  ctx.fillStyle = "#7f8a94";
  ctx.beginPath();
  ctx.roundRect(-L / 2 + 5, -B * 0.38, 17.5, B * 0.76, 1.8);
  ctx.fill();
  ctx.fillStyle = beam(ctx, B * 0.6, "#8d98a2", "#a9b3bc");
  ctx.beginPath();
  ctx.roundRect(-L / 2 + 7, -B * 0.3, 12, B * 0.6, 1.5);
  ctx.fill();
  // hot tub on the sun deck, and a tender stowed on the foredeck
  ctx.fillStyle = "#4fa3c0";
  ctx.beginPath();
  ctx.arc(-L / 2 + 10, 0, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6f5f1";
  ctx.beginPath();
  ctx.ellipse(L * 0.25, 0, 2.6, 1.0, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a4046";
  ctx.beginPath();
  ctx.ellipse(L * 0.25, 0, 1.8, 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
}

function shadowOf(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext("2d")!;
  ctx.filter = "blur(5px)";
  ctx.drawImage(src, 0, 0);
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#04121a";
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

let cache: Boat[] | null = null;
export function boatSprites(): Boat[] {
  if (!cache) cache = [motorYacht, sailYacht, motorYacht, bigYacht].map((f) => {
    const img = sprite(f);
    return { img, shadow: shadowOf(img) };
  });
  return cache;
}

/** Sprite size in metres for a boat of length `len` (the sprite has a metre of margin each end). */
export function boatBox(len: number): [number, number] {
  const k = len / REF;
  return [(REF + 2) * k, 10 * k];
}
