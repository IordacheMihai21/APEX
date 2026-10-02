import { useMemo, useState } from "react";
import type { Game, RunResult, SpeedTrace as Trace } from "../game/game";
import { type Grade, gradeFor } from "../modes/grading";
import { delta } from "./format";

const W = 1000; // viewBox units across; the SVG stretches, strokes don't
const H = 100;
const GRADE_TEXT: Record<Grade, string> = { purple: "text-purple", green: "text-green", yellow: "text-yellow", red: "text-kerb" };

function path(at: Float32Array, v: Float32Array, lo: number, hi: number): string {
  let d = "";
  for (let b = 0; b < at.length; b++) d += `${b ? "L" : "M"}${(at[b] * W).toFixed(1)} ${(H - ((v[b] - lo) / (hi - lo)) * H).toFixed(1)}`;
  return d;
}

/** Index of the bucket nearest to `x` (0..1 of the lap). */
function bucketAt(t: Trace, x: number): number {
  let lo = 0;
  let hi = t.at.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (t.at[m] <= x) lo = m;
    else hi = m;
  }
  return x - t.at[lo] < t.at[hi] - x ? lo : hi;
}

/** The corner whose timing segment (braking zone, corner, following straight) holds `x`. */
function cornerAt(t: Trace, x: number): string {
  let name = t.segments[t.segments.length - 1]?.name ?? "";
  for (const s of t.segments) if (s.from <= x) name = s.name;
  return name;
}

/**
 * Telemetry after the lap: your speed (orange) over the perfect lap's (purple)
 * against distance, the way replay tools draw it. Braking points show as the
 * drops, corner numbers sit under their apexes, sector lines are dashed. Drag
 * along it to read both speeds and the running gap; the car on the map parks
 * at that point.
 */
export function SpeedTrace({ game, result, worst }: { game: Game; result: RunResult; worst: string[] }) {
  const t = useMemo(() => game.speedTrace(), [game, result]);
  const [probe, setProbe] = useState<number | null>(null);
  if (!t) return null;

  let lo = Infinity;
  let hi = 0;
  for (let b = 0; b < t.at.length; b++) {
    lo = Math.min(lo, t.you[b], t.perfect[b]);
    hi = Math.max(hi, t.you[b], t.perfect[b]);
  }
  lo = Math.max(0, Math.floor(lo / 50) * 50);
  hi = Math.ceil(hi / 50) * 50;
  const grid: number[] = [];
  for (let v = Math.ceil(lo / 100) * 100; v < hi; v += 100) grid.push(v);
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;

  const point = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const b = bucketAt(t, x);
    setProbe(b);
    game.setProbe(t.at[b]);
  };
  const clear = () => {
    setProbe(null);
    game.setProbe(null);
  };

  // corner numbers: drop one that would crowd the last shown (under 4% of the lap), unless it cost the most
  const labels: Trace["corners"] = [];
  for (const c of t.corners) {
    const prev = labels[labels.length - 1];
    if (prev && c.at - prev.at < 0.04) {
      // keep whichever cost more when both are among the worst
      const rank = (x: { name: string; deltaMs: number }) => (worst.includes(x.name) ? x.deltaMs : -Infinity);
      if (rank(c) <= rank(prev)) continue;
      labels.pop();
    }
    labels.push(c);
  }

  const b = probe;
  const gap = b === null ? 0 : t.gapMs[b];
  const topYou = Math.max(...t.you);
  const topRef = Math.max(...t.perfect);

  return (
    <section className="mt-3 border-t border-line pt-2.5 [ul+&]:mt-0 [ul+&]:border-t-0" aria-label="Speed trace">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="label text-paint">Speed</h3>
        <span className="caption flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-[2px] w-3 bg-ink" />
            You
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[2px] w-3 bg-purple" />
            Perfect lap
          </span>
        </span>
      </div>

      {/* readout: what the finger is on, else the top speeds */}
      <p className="num mt-1 min-h-[18px] text-[13px] text-steel">
        {b === null ? (
          <>
            Top speed <span className="font-bold text-paint">{Math.round(topYou)}</span> km/h, perfect lap {Math.round(topRef)}. Drag along the trace.
          </>
        ) : (
          <>
            <span className="font-bold text-paint [font-stretch:85%]">{cornerAt(t, t.at[b])}</span>
            {"  "}
            <span className="font-bold text-ink">{Math.round(t.you[b])}</span>
            {" / "}
            <span className="font-bold text-purple">{Math.round(t.perfect[b])}</span> km/h
            {"  "}
            <span className="font-bold text-paint">{delta(Math.round(gap))}</span> so far
          </>
        )}
      </p>

      <div
        className="relative mt-1.5 h-[112px] cursor-crosshair touch-none select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          point(e);
        }}
        onPointerMove={(e) => (e.pointerType === "mouse" || e.buttons ? point(e) : undefined)}
        onPointerLeave={(e) => (e.pointerType === "mouse" ? clear() : undefined)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {grid.map((v) => (
            <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {t.sectorLines.map((x) => (
            <line key={x} x1={x * W} x2={x * W} y1={0} y2={H} stroke="var(--color-steel)" strokeOpacity={0.45} strokeDasharray="3 3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={path(t.at, t.perfect, lo, hi)} fill="none" stroke="var(--color-purple)" strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <path d={path(t.at, t.you, lo, hi)} fill="none" stroke="var(--color-ink)" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {b !== null && <line x1={t.at[b] * W} x2={t.at[b] * W} y1={0} y2={H} stroke="var(--color-paint)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        </svg>
        {/* speed scale, right edge */}
        {grid.map((v) => (
          <span key={v} className="num pointer-events-none absolute right-0 -translate-y-1/2 bg-night/85 px-0.5 text-[10px] leading-none text-steel/80" style={{ top: `${y(v)}%` }}>
            {v}
          </span>
        ))}
        {b !== null && (
          <>
            <span className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple" style={{ left: `${t.at[b] * 100}%`, top: `${y(t.perfect[b])}%` }} />
            <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-night bg-ink" style={{ left: `${t.at[b] * 100}%`, top: `${y(t.you[b])}%` }} />
          </>
        )}
      </div>

      {/* corner numbers under their apexes; the corners that cost the most in their grade colour */}
      <div className="relative mt-1 h-4" aria-hidden>
        {labels.map((c) => (
          <span
            key={c.name}
            className={`absolute -translate-x-1/2 text-[10px] font-bold [font-stretch:80%] ${worst.includes(c.name) ? GRADE_TEXT[gradeFor(c.deltaMs)] : "text-steel/70"}`}
            style={{ left: `${c.at * 100}%` }}
          >
            {c.name}
          </span>
        ))}
      </div>
    </section>
  );
}
