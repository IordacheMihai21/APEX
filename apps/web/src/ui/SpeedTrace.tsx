import { useMemo, useState } from "react";

export interface TraceData {
  lengthM: number;
  at: number[];
  mine: number[];
  perfect: number[];
  groups: { name: string; at: number }[];
}

const W = 340;
const H = 112;
const PAD = { top: 8, bottom: 18, left: 26, right: 4 };

/**
 * Speed against distance, the way telemetry tools draw it: the perfect lap as
 * a thin purple trace, yours in orange, the gap between them shaded where you
 * were slower. Corner groups are named along the bottom; touch or hover for a
 * readout at any point.
 */
export function SpeedTrace({ data }: { data: TraceData }) {
  const [hover, setHover] = useState<number | null>(null);
  const geo = useMemo(() => {
    const all = data.mine.concat(data.perfect);
    const lo = Math.floor(Math.min(...all) / 50) * 50;
    const hi = Math.ceil(Math.max(...all) / 50) * 50;
    const x = (m: number) => PAD.left + (m / data.lengthM) * (W - PAD.left - PAD.right);
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
    const line = (vs: number[]) => vs.map((v, k) => `${k ? "L" : "M"}${x(data.at[k]).toFixed(1)} ${y(v).toFixed(1)}`).join("");
    // the gap where you were slower: perfect trace forward, yours back
    const gap =
      data.perfect.map((v, k) => `${k ? "L" : "M"}${x(data.at[k]).toFixed(1)} ${y(Math.max(v, data.mine[k])).toFixed(1)}`).join("") +
      data.mine
        .map((v, k) => [k, v] as const)
        .reverse()
        .map(([k, v]) => `L${x(data.at[k]).toFixed(1)} ${y(v).toFixed(1)}`)
        .join("") +
      "Z";
    const ticks = [lo, (lo + hi) / 2, hi];
    return { x, y, mine: line(data.mine), perfect: line(data.perfect), gap, ticks };
  }, [data]);

  // corner numbers along the bottom; a label too close to the previous one is left as a tick
  const labels = useMemo(() => {
    let last = -Infinity;
    return data.groups.map((g) => {
      const px = geo.x(g.at);
      const width = g.name.replace(/T/g, "").length * 4.2;
      const show = px - last > width + 4;
      if (show) last = px + width / 2;
      return { ...g, show };
    });
  }, [data, geo]);

  const k = hover;
  const readout =
    k !== null
      ? (() => {
          const m = data.at[k];
          const near = data.groups.reduce((b, g) => (Math.abs(g.at - m) < Math.abs(b.at - m) ? g : b), data.groups[0]);
          return { m, mine: Math.round(data.mine[k]), perfect: Math.round(data.perfect[k]), near: Math.abs(near.at - m) < 150 ? near.name : null };
        })()
      : null;

  return (
    <figure className="mt-3 border-t border-line pt-2">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="caption">Speed against the perfect lap</span>
        <span className="caption num">
          {readout ? (
            <>
              {readout.near ? `${readout.near} ` : ""}
              <span className="text-ink">{readout.mine}</span> / <span className="text-purple">{readout.perfect}</span> km/h
            </>
          ) : (
            <>
              <span className="text-ink">You</span> / <span className="text-purple">perfect</span>
            </>
          )}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 w-full touch-none select-none"
        role="img"
        aria-label="Speed trace of your lap against the perfect lap"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const m = ((e.clientX - r.left) / r.width) * W;
          const t = Math.max(0, Math.min(1, (m - PAD.left) / (W - PAD.left - PAD.right)));
          setHover(Math.round(t * (data.at.length - 1)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {geo.ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={geo.y(v)} y2={geo.y(v)} stroke="#2b2f37" strokeWidth={0.6} />
            <text x={PAD.left - 4} y={geo.y(v)} textAnchor="end" dominantBaseline="central" fontSize={8} fill="#9aa1ab">
              {Math.round(v)}
            </text>
          </g>
        ))}
        <path d={geo.gap} fill="rgba(229,51,42,0.22)" />
        <path d={geo.perfect} fill="none" stroke="var(--color-purple)" strokeWidth={1.1} strokeLinejoin="round" />
        <path d={geo.mine} fill="none" stroke="#ff6a13" strokeWidth={1.4} strokeLinejoin="round" />
        {labels.map((g) => (
          <g key={g.name}>
            <line x1={geo.x(g.at)} x2={geo.x(g.at)} y1={H - PAD.bottom} y2={H - PAD.bottom + 3} stroke="#9aa1ab" strokeWidth={0.6} />
            {g.show && (
              <text x={geo.x(g.at)} y={H - 4} textAnchor="middle" fontSize={7.5} fill="#9aa1ab" style={{ fontStretch: "80%" }}>
                {g.name.replace(/T/g, "")}
              </text>
            )}
          </g>
        ))}
        {readout && <line x1={geo.x(readout.m)} x2={geo.x(readout.m)} y1={PAD.top} y2={H - PAD.bottom} stroke="#f2f2ee" strokeOpacity={0.5} strokeWidth={0.6} />}
      </svg>
    </figure>
  );
}
