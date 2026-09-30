import { useEffect, useRef, useState } from "react";
import { REV_LEDS } from "../game/drive";
import type { Snapshot } from "../game/game";
import { Gantry } from "./Gantry";
import { LapGrid } from "./LapGrid";
import { Segments } from "./Segments";
import { lapTime } from "./format";

/** Rev lights: green → red → blue, unlit LEDs drawn as dark glass. Flash on the shift point. */
function RevLights({ leds, shift }: { leds: number; shift: boolean }) {
  // green build-up, blue for the last three; red stays reserved for "far off" in the tiles
  const colour = (i: number) => (i < 12 ? "#29cc6a" : "#3d7bff");
  return (
    <div className="flex gap-[3px]" aria-hidden="true">
      {Array.from({ length: REV_LEDS }, (_, i) => {
        const on = shift || i < leds;
        return (
          <span
            key={i}
            className="h-2.5 flex-1 rounded-full"
            style={{
              background: on ? (shift ? "#3d7bff" : colour(i)) : "#141517",
              boxShadow: on ? `0 0 8px ${shift ? "#3d7bff" : colour(i)}` : "inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          />
        );
      })}
    </div>
  );
}

export function RaceHud({ s, onSkip, groupNames }: { s: Snapshot; onSkip: () => void; groupNames: string[] }) {
  const [lightsOut, setLightsOut] = useState(false);
  const prev = useRef(s.phase);
  useEffect(() => {
    if (prev.current === "lights" && s.phase === "race") {
      setLightsOut(true);
      const t = setTimeout(() => setLightsOut(false), 900);
      return () => clearTimeout(t);
    }
    prev.current = s.phase;
  }, [s.phase]);

  const d = s.liveDeltaMs;
  const deltaColour = d <= 50 ? "#a259ff" : "#eeede6";
  const deltaText = `${d >= 0 ? " " : "-"}${(Math.abs(d) / 1000).toFixed(2)}`;
  const speed = Math.round(s.drive.gear === 0 ? 0 : s.raceSpeedKmh);

  return (
    <>
      {/* steering-wheel display */}
      <div className="pointer-events-none absolute inset-x-3 top-3 mx-auto flex max-w-[560px] flex-col gap-2">
        <div className="rounded-lg border border-white/10 bg-board/88 p-2.5 backdrop-blur-sm">
          <RevLights leds={s.phase === "race" ? s.drive.leds : 0} shift={s.phase === "race" && s.drive.shift} />
          <div className="mt-2.5 flex items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <div className="grid h-14 w-11 place-items-center rounded-md border border-white/10 bg-black font-display text-[44px] font-black leading-none text-paint">
                {s.phase === "race" ? s.drive.gear : "N"}
              </div>
              <div className="leading-none">
                <Segments text={String(speed).padStart(3, " ")} className="h-9 text-paint" ghost={0.08} />
                <div className="mt-1 font-mono text-[10px] tracking-[0.14em] text-steel">KM/H</div>
              </div>
            </div>
            <div className="text-right leading-none">
              <Segments text={deltaText} className="ml-auto h-7" color={deltaColour} ghost={0.08} />
              <div className="mt-1 font-mono text-[10px] tracking-[0.14em] text-steel">
                VS PERFECT · {lapTime(s.raceTimeMs)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* start lights */}
      {(s.phase === "lights" || lightsOut) && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 flex flex-col items-center gap-4">
          <Gantry lit={s.phase === "lights" ? s.lights : 0} size="lg" />
          {lightsOut && <p className="font-display text-[34px] font-black uppercase tracking-[0.1em] text-paint [text-shadow:0_2px_12px_rgba(0,0,0,0.8)]">Lights out</p>}
        </div>
      )}

      {/* live lap tiles + controls */}
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[584px] flex-col gap-2 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {s.grades && (
          <div className="pointer-events-none rounded-lg border border-white/10 bg-board/88 p-2.5 backdrop-blur-sm">
            <div className="mb-1.5 flex justify-between font-mono text-[10px] tracking-[0.14em] text-steel">
              <span>
                LAP {s.lapsUsed + 1}
                {s.lapLimit !== null ? ` / ${s.lapLimit}` : ""}
              </span>
              <span>
                {s.revealed} / {s.grades.length} CORNERS
              </span>
            </div>
            <LapGrid
              rows={[]}
              total={1}
              cols={s.grades.length}
              live={{ grades: s.grades.map((g) => g.grade), revealed: s.revealed }}
              labels={groupNames}
            />
          </div>
        )}
        <div className="flex justify-end">
          <button
            className="rounded-md border border-white/12 bg-board/80 px-3.5 py-2.5 text-[15px] font-medium text-paint backdrop-blur-sm hover:border-white/30"
            onClick={onSkip}
          >
            Skip to result
          </button>
        </div>
      </div>
    </>
  );
}
