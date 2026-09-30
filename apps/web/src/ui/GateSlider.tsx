import { useRef, useState } from "react";

/**
 * Precision control for one gate: a cross-section of the track as the driver
 * sees it (left edge = track left). Research-backed design:
 *  - Tap = jump there (coarse, absolute).
 *  - Drag = relative movement at reduced gain (half the bar ≈ quarter of the
 *    track), so finger size stops mattering.
 *  - Slide the finger away from the bar while dragging for finer control
 *    (variable-speed scrubbing, as in iOS media sliders).
 *  - Arrow keys nudge 5 cm (Shift: 50 cm); the ‹ › buttons nudge 5 cm.
 */
export function GateSlider({
  offset,
  limit,
  inside,
  onBegin,
  onChange,
  onEnd,
}: {
  offset: number;
  limit: number;
  inside: "left" | "right" | null;
  /** Called at drag start; returns the live value (props can lag within one tick). */
  onBegin: () => number;
  onChange: (v: number) => void;
  onEnd: () => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x0: number; y0: number; last: number; v: number; moved: boolean } | null>(null);
  const [fine, setFine] = useState(1);

  const clamp = (v: number) => Math.max(-limit, Math.min(limit, v));
  const frac = (limit - offset) / (2 * limit); // 0 = left edge, 1 = right edge

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already-released pointer */
    }
    const v = onBegin();
    drag.current = { x0: e.clientX, y0: e.clientY, last: e.clientX, v, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !bar.current) return;
    if (Math.abs(e.clientX - d.x0) > 4 || Math.abs(e.clientY - d.y0) > 4) d.moved = true;
    if (!d.moved) return;
    const width = bar.current.getBoundingClientRect().width;
    const away = Math.max(0, Math.abs(e.clientY - d.y0) - 28);
    const gain = Math.max(0.12, 1 / (1 + away / 50));
    setFine(gain);
    const metresPerPx = ((2 * limit) / width) * 0.5 * gain;
    d.v = clamp(d.v - (e.clientX - d.last) * metresPerPx);
    d.last = e.clientX;
    onChange(d.v);
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setFine(1);
    if (d && !d.moved && bar.current) {
      const r = bar.current.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      onChange(clamp(limit - f * 2 * limit));
    }
    onEnd();
  };

  const fromInside = inside === "left" ? limit - offset : inside === "right" ? limit + offset : null;
  const readout =
    fromInside === null
      ? Math.abs(offset) < 0.05
        ? "Centre of the track"
        : `${Math.abs(offset).toFixed(2)} m ${offset > 0 ? "left" : "right"} of centre`
      : fromInside < 0.05
        ? "Right on the inside kerb"
        : `${fromInside.toFixed(2)} m from the inside kerb`;

  const ticks = [];
  for (let m = Math.ceil(-limit); m <= Math.floor(limit); m++) ticks.push(m);

  return (
    <div>
      <div className="mb-1.5 text-center font-mono text-[12px] text-paint/85" aria-live="polite">
        {readout}
        {fine < 0.6 && <span className="ml-2 text-ink">FINE ×{Math.round(1 / fine)}</span>}
      </div>
      <div
        ref={bar}
        role="slider"
        tabIndex={0}
        aria-label="Car position across the track at this point"
        aria-valuemin={-limit}
        aria-valuemax={limit}
        aria-valuenow={offset}
        aria-valuetext={readout}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative h-14 cursor-ew-resize touch-none rounded-md bg-asphalt"
      >
        {/* painted edges */}
        <span className="absolute inset-y-0 left-0 w-[3px] rounded-l-md bg-paint" />
        <span className="absolute inset-y-0 right-0 w-[3px] rounded-r-md bg-paint" />
        {/* kerb on the inside edge */}
        {inside && (
          <span
            className={`absolute inset-y-0 w-2.5 ${inside === "left" ? "left-[3px]" : "right-[3px]"}`}
            style={{ background: "repeating-linear-gradient(180deg, var(--color-kerb) 0 7px, var(--color-paint) 7px 14px)" }}
          />
        )}
        {ticks.map((m) => (
          <span
            key={m}
            className={`absolute top-0 w-px ${m === 0 ? "h-full bg-paint/25" : "h-2 bg-paint/20"}`}
            style={{ left: `calc(${((limit - m) / (2 * limit)) * 100}% )` }}
          />
        ))}
        <span
          className="pointer-events-none absolute top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-paint bg-ink shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
          style={{ left: `${frac * 100}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] tracking-[0.12em] text-steel">
        <span className={inside === "left" ? "text-kerb" : ""}>{inside === "left" ? "INSIDE" : "LEFT"}</span>
        <span className={inside === "right" ? "text-kerb" : ""}>{inside === "right" ? "INSIDE" : "RIGHT"}</span>
      </div>
    </div>
  );
}
