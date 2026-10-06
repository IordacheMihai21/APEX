import { CATALOG } from "../game/catalog";
import { OUTLINES, loadOutlineDetail } from "../game/outlines";
import { CIRCUITS } from "../modes/circuits";
import { CONDITION_NAME, DAILY_LAPS, type DailyRecord, bestMedal, conditionOf, dailyNumber } from "../modes/daily";
import { type Grade, bestPerGroup } from "../modes/grading";
import { MEDAL_COLOR, MEDAL_NAME } from "../modes/medals";
import { lapTime } from "./format";

/**
 * The Daily Quali result as a picture for group chats: the circuit painted in
 * the day's sector colours (the hub map, frozen), the best lap, the medal and
 * the lap grid. 1080×1350 (4:5), so it sits well in a chat bubble and in a
 * story. Drawn from the live CSS tokens, so colour-blind mode carries over.
 */
const W = 1080;
const H = 1350;
const PAD = 72;

function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function resolve(colour: string): string {
  const m = colour.match(/^var\((--[\w-]+)\)$/);
  return m ? token(m[1], "#a259ff") : colour;
}

type Ctx = CanvasRenderingContext2D & { fontStretch?: string; letterSpacing?: string };

function font(ctx: Ctx, weight: number, size: number, wide: boolean) {
  const family = token("--font-display", "system-ui, sans-serif");
  ctx.font = `${weight} ${size}px ${family}`;
  // the wide cut of the display face, where the canvas supports it
  if ("fontStretch" in ctx) ctx.fontStretch = wide ? "expanded" : "normal";
}

export async function dailyCard(daily: DailyRecord): Promise<Blob> {
  await document.fonts?.ready;
  const info = CATALOG.find((t) => t.id === daily.trackId)!;
  const facts = CIRCUITS.find((c) => c.id === daily.trackId);
  const o = OUTLINES[daily.trackId];
  const detail = await loadOutlineDetail(daily.trackId);
  const C = {
    night: token("--color-night", "#0a0b0d"),
    board: token("--color-board", "#121418"),
    line: token("--color-line", "#2b2f37"),
    paint: token("--color-paint", "#f2f2ee"),
    steel: token("--color-steel", "#9aa1ab"),
    ink: token("--color-ink", "#ff6a13"),
  };
  const GRADE: Record<Grade, string> = {
    purple: token("--color-purple", "#a259ff"),
    green: token("--color-green", "#29cc6a"),
    yellow: token("--color-yellow", "#f5c518"),
    red: token("--color-kerb", "#e5332a"),
  };

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")! as Ctx;
  ctx.fillStyle = C.night;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // header: wordmark left, puzzle number right, a hairline under both
  font(ctx, 800, 40, true);
  ctx.fillStyle = C.paint;
  ctx.fillText("LAPDLE", PAD, PAD + 34);
  const mark = ctx.measureText("LAPDLE").width;
  ctx.fillStyle = C.steel;
  ctx.fillText("/", PAD + mark + 2, PAD + 34);
  font(ctx, 600, 30, false);
  ctx.textAlign = "right";
  ctx.fillText(`Daily Quali #${dailyNumber(daily.key)}`, W - PAD, PAD + 32);
  ctx.textAlign = "left";
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, PAD + 66, W - PAD * 2, 2);

  // venue
  font(ctx, 800, 104, true);
  ctx.fillStyle = C.paint;
  let size = 104;
  while (ctx.measureText(info.name).width > W - PAD * 2 && size > 56) font(ctx, 800, (size -= 4), true);
  ctx.fillText(info.name, PAD, 300);
  font(ctx, 500, 32, false);
  ctx.fillStyle = C.steel;
  const km = facts?.lengthKm ?? o.lengthM / 1000;
  const cond = conditionOf(daily);
  ctx.fillText(`${info.country}, ${km.toFixed(3)} km, ${facts?.turns ?? o.cornerCount} corners${cond === "dry" ? "" : `, ${CONDITION_NAME[cond].toLowerCase()}`}`, PAD, 352);

  // the map: asphalt ribbon, each corner group in its best colour of the day
  // fitted to the circuit's own bounds, not the 1000-unit drawing box, so a
  // long thin circuit fills the card as well as a compact one
  const box = { x: PAD, y: 400, w: W - PAD * 2, h: 540 };
  const nums = detail.ribbon.match(/-?\d+(\.\d+)?/g)!.map(Number);
  let [x0, y0b, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    x0 = Math.min(x0, nums[i]);
    x1 = Math.max(x1, nums[i]);
    y0b = Math.min(y0b, nums[i + 1]);
    y1 = Math.max(y1, nums[i + 1]);
  }
  const margin = o.width * 2.2;
  const k = Math.min(box.w / (x1 - x0 + margin * 2), box.h / (y1 - y0b + margin * 2));
  ctx.save();
  ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
  ctx.scale(k, k);
  ctx.translate(-(x0 + x1) / 2, -(y0b + y1) / 2);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // stroke widths stay what they'd be on a ~600 px map, however far it's zoomed
  const w = (Math.max(o.width * 2.2, 20) * 0.6) / k;
  ctx.strokeStyle = "#23262d";
  ctx.lineWidth = w;
  ctx.stroke(new Path2D(detail.ribbon));
  const grades = bestPerGroup(daily.laps.map((l) => l.grades));
  detail.groups.forEach((g, i) => {
    const grade = grades?.[i];
    if (!grade) return;
    ctx.strokeStyle = GRADE[grade];
    ctx.lineWidth = w * 0.42;
    ctx.stroke(new Path2D(g));
  });
  ctx.beginPath();
  ctx.arc(o.start[0], o.start[1], 14 / k, 0, Math.PI * 2);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.lineWidth = 6 / k;
  ctx.strokeStyle = C.night;
  ctx.stroke();
  ctx.restore();

  // result: medal and best lap on the left, the lap grid on the right
  const medal = bestMedal(daily);
  const best = daily.laps.length ? Math.min(...daily.laps.map((l) => l.lapTimeMs)) : null;
  const y0 = 1000;
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, y0 - 24, W - PAD * 2, 2);
  if (medal) {
    ctx.beginPath();
    ctx.arc(PAD + 18, y0 + 30, 18, 0, Math.PI * 2);
    ctx.fillStyle = resolve(MEDAL_COLOR[medal]);
    ctx.fill();
  }
  font(ctx, 700, 34, false);
  ctx.fillStyle = C.paint;
  const verdict = daily.status === "won" ? `Pole on lap ${daily.laps.length}` : medal ? MEDAL_NAME[medal] : "No medal";
  ctx.fillText(verdict, PAD + (medal ? 52 : 0), y0 + 42);
  font(ctx, 800, 120, true);
  ctx.fillStyle = C.paint;
  ctx.fillText(best !== null ? lapTime(best) : "-:--.---", PAD - 4, y0 + 176);
  font(ctx, 500, 28, false);
  ctx.fillStyle = C.steel;
  ctx.fillText(`${daily.laps.length} of ${DAILY_LAPS} laps`, PAD, y0 + 226);

  const cols = daily.laps[0]?.grades.length ?? 8;
  const cell = Math.min(30, Math.floor(360 / cols) - 4);
  const gx = W - PAD - cols * (cell + 4) + 4;
  for (let r = 0; r < DAILY_LAPS; r++) {
    for (let c = 0; c < cols; c++) {
      const g = daily.laps[r]?.grades[c];
      const x = gx + c * (cell + 4);
      const y = y0 + 8 + r * (cell / 1.6 + 6);
      if (g) {
        ctx.fillStyle = GRADE[g];
        ctx.fillRect(x, y, cell, cell / 1.6);
      } else {
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, cell - 2, cell / 1.6 - 2);
      }
    }
  }

  // footer: where to play, in the accent
  font(ctx, 600, 28, false);
  ctx.fillStyle = C.ink;
  ctx.textAlign = "right";
  ctx.fillText(`Find the perfect lap at ${location.host}`, W - PAD, H - PAD + 8);
  ctx.textAlign = "left";

  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/png"));
}
