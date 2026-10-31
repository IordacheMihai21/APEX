import { forwardRef, useImperativeHandle, useRef } from "react";
import { REV_LEDS, driveState } from "../game/drive";

/** Rev lights as on a steering wheel: yellow, then red, then blue for the last five. */
const LED_COLOUR = (i: number) => (i < 5 ? "#ffcc1a" : i < 10 ? "#ff3b30" : "#3d7bff");
const OFF = "#23262d";

export interface ClusterApi {
  /** speed (km/h) and the pedals (0..1); called every frame, so it writes to the DOM directly */
  set(kmh: number, throttle: number, brake: number): void;
}

/**
 * Make the corner's dash, the way an onboard shows it: the rev lights across the top, throttle and brake as two
 * bars, the speed large and the gear beside it. Gear and revs are presentation only (game/drive.ts), from the speed.
 */
export const CornerCluster = forwardRef<ClusterApi, { kmh: number; className?: string }>(function CornerCluster({ kmh, className = "" }, ref) {
  const leds = useRef<(HTMLSpanElement | null)[]>([]);
  const speed = useRef<HTMLSpanElement>(null);
  const gear = useRef<HTMLSpanElement>(null);
  const thr = useRef<HTMLSpanElement>(null);
  const brk = useRef<HTMLSpanElement>(null);
  const last = useRef({ lit: -1, shift: false, kmh: -1, gear: -1, thr: -1, brk: -1 });

  useImperativeHandle(ref, () => ({
    set(v, throttle, brake) {
      const d = driveState(v);
      const l = last.current;
      // the lights flash together at the shift point
      const lit = v < 1 ? 0 : d.leds;
      const shift = d.shift && throttle > 0;
      if (lit !== l.lit || shift !== l.shift) {
        leds.current.forEach((el, i) => {
          if (!el) return;
          const on = shift || i < lit;
          const c = shift ? "#3d7bff" : LED_COLOUR(i);
          el.style.background = on ? c : OFF;
          el.style.boxShadow = on ? `0 0 7px ${c}` : "none";
        });
        l.lit = lit;
        l.shift = shift;
      }
      const k = Math.round(v);
      if (k !== l.kmh && speed.current) speed.current.textContent = String(k);
      l.kmh = k;
      const g = v < 1 ? 0 : d.gear;
      if (g !== l.gear && gear.current) gear.current.textContent = g ? String(g) : "N";
      l.gear = g;
      if (throttle !== l.thr && thr.current) thr.current.style.transform = `scaleY(${throttle})`;
      if (brake !== l.brk && brk.current) brk.current.style.transform = `scaleY(${brake})`;
      l.thr = throttle;
      l.brk = brake;
    },
  }));

  const d = driveState(kmh);
  return (
    <div className={`pointer-events-none rounded-xl border border-white/10 bg-night/80 px-2.5 pt-2 pb-2 backdrop-blur-[2px] ${className}`} aria-hidden="true">
      <div className="flex justify-between gap-[3px]">
        {Array.from({ length: REV_LEDS }, (_, i) => (
          <span
            key={i}
            ref={(el) => {
              leds.current[i] = el;
            }}
            className="h-[7px] w-[7px] rounded-full sm:h-[9px] sm:w-[9px]"
            style={{ background: i < d.leds ? LED_COLOUR(i) : OFF }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        {/* throttle and brake, filling from the bottom */}
        <span className="flex h-9 gap-[3px] sm:h-11">
          <span className="relative w-[5px] overflow-hidden rounded-sm bg-[#23262d]">
            <span ref={thr} className="absolute inset-0 origin-bottom bg-[#ffcc1a]" style={{ transform: "scaleY(1)" }} />
          </span>
          <span className="relative w-[5px] overflow-hidden rounded-sm bg-[#23262d]">
            <span ref={brk} className="absolute inset-0 origin-bottom bg-[#ff3b30]" style={{ transform: "scaleY(0)" }} />
          </span>
        </span>
        <span className="flex flex-1 flex-col items-center leading-none">
          <span ref={speed} className="wide num text-[clamp(26px,6.5vw,40px)] leading-none text-paint">
            {Math.round(kmh)}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold tracking-[0.08em] text-steel uppercase">km/h</span>
        </span>
        <span ref={gear} className="wide num grid h-9 w-8 place-items-center rounded-md border border-white/20 text-[22px] text-paint sm:h-11 sm:w-10 sm:text-[28px]">
          {d.gear}
        </span>
      </div>
    </div>
  );
});
