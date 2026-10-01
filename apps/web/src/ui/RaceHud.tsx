import { useEffect, useRef, useState } from "react";
import { REV_LEDS } from "../game/drive";
import type { SectorTime, SectorTone, Snapshot } from "../game/game";
import type { Grade, GroupGrade } from "../modes/grading";
import { Gantry } from "./Gantry";
import { Segments } from "./Segments";
import { lapTime } from "./format";
import { secondaryBtn } from "./styles";

/** Rev lights: green build-up, blue for the last three and the shift flash; unlit LEDs stay drawn. */
function RevLights({ leds, shift }: { leds: number; shift: boolean }) {
  const colour = (i: number) => (i < 12 ? "#29cc6a" : "#3d7bff");
  return (
    <div className="flex gap-[3px]" aria-hidden="true">
      {Array.from({ length: REV_LEDS }, (_, i) => {
        const on = shift || i < leds;
        const c = shift ? "#3d7bff" : colour(i);
        return <span key={i} className="h-[7px] flex-1" style={{ background: on ? c : "#1c1f25", boxShadow: on ? `0 0 8px ${c}` : "none" }} />;
      })}
    </div>
  );
}

const SPLIT_TEXT: Record<Grade, string> = { purple: "text-purple", green: "text-green", yellow: "text-yellow", red: "text-kerb" };
const SPLIT_BAR: Record<Grade, string> = { purple: "bg-purple", green: "bg-green", yellow: "bg-yellow", red: "bg-kerb" };

/** A short haptic tick where the device supports it (phones); silent elsewhere. */
const buzz = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
};

/** Broadcast split: the group just cleared and its gap, in its sector colour, for a moment. */
function useSplit(s: Snapshot) {
  const [split, setSplit] = useState<GroupGrade | null>(null);
  const seen = useRef(0);
  useEffect(() => {
    if (s.phase !== "race") {
      seen.current = 0;
      return;
    }
    if (s.revealed > seen.current && s.grades) {
      const g = s.grades[s.revealed - 1];
      seen.current = s.revealed;
      setSplit(g);
      if (g.grade === "purple") buzz(35);
      const t = setTimeout(() => setSplit((cur) => (cur === g ? null : cur)), 1600);
      return () => clearTimeout(t);
    }
  }, [s.phase, s.revealed, s.grades]);
  return s.phase === "race" ? split : null;
}

const SECTOR_BG: Record<SectorTone, string> = { purple: "bg-purple", green: "bg-green", yellow: "bg-yellow" };
const SECTOR_TEXT: Record<SectorTone, string> = { purple: "text-purple", green: "text-green", yellow: "text-yellow" };

/**
 * S1 / S2 / S3 as the broadcast shows them: an empty cell until the car
 * crosses the sector line, then the sector time over a bar in its colour
 * (purple = the perfect lap's, green = personal best, yellow = slower).
 */
export function SectorCells({ sectors, large = false }: { sectors: SectorTime[]; large?: boolean }) {
  return (
    <div className={`grid grid-cols-3 ${large ? "gap-2" : "border-t border-line"}`}>
      {[0, 1, 2].map((k) => {
        const x = sectors[k];
        return (
          <div key={k} className={`${large ? "" : "border-r border-line last:border-r-0"} px-1.5 pt-1 pb-1.5`}>
            <span className={`block h-[3px] ${x ? `sector-in ${SECTOR_BG[x.tone]}` : "bg-graphite"}`} />
            <span className="mt-1 flex items-baseline justify-between gap-1">
              <span className="text-[11px] font-bold text-steel [font-stretch:80%]">S{k + 1}</span>
              <span className={`num font-bold ${large ? "text-[14px]" : "hidden text-[11px] min-[720px]:inline"} ${x ? SECTOR_TEXT[x.tone] : "text-steel/40"}`}>
                {x ? (x.ms / 1000).toFixed(large ? 3 : 2) : "-"}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function RaceHud({ s, onSkip }: { s: Snapshot; onSkip: () => void }) {
  const [lightsOut, setLightsOut] = useState(false);
  const split = useSplit(s);
  const prev = useRef(s.phase);
  useEffect(() => {
    if (prev.current === "lights" && s.phase === "race") {
      buzz(20);
      setLightsOut(true);
      const t = setTimeout(() => setLightsOut(false), 900);
      prev.current = s.phase;
      return () => clearTimeout(t);
    }
    prev.current = s.phase;
  }, [s.phase]);

  const racing = s.phase === "race";
  const d = s.liveDeltaMs;
  const speed = racing ? Math.round(s.raceSpeedKmh) : 0;

  return (
    <>
      {/* top right, stacked: the lap clock with its sector cells, then the split for the group just cleared */}
      <div className="pointer-events-none absolute top-2 right-2 flex w-[148px] flex-col gap-1.5 min-[720px]:w-[188px]">
        <div className="border border-line bg-night/88">
          <div className="label flex justify-between border-b border-line px-2 py-1.5">
            <span className="text-paint">
              Lap {s.lapsUsed + 1}
              {s.lapLimit !== null ? `/${s.lapLimit}` : ""}
            </span>
            <span>×4</span>
          </div>
          <div className="px-2 pt-1.5 pb-2">
            <div className="wide num text-[20px] leading-none text-paint min-[720px]:text-[26px]">{lapTime(s.raceTimeMs)}</div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="label">To {s.paceLabel}</span>
              <span className={`num text-[14px] font-bold ${d <= 0 ? "text-green" : "text-paint"}`}>
                {d >= 0 ? "+" : "−"}
                {(Math.abs(d) / 1000).toFixed(2)}
              </span>
            </div>
          </div>
          <SectorCells sectors={s.sectors} />
        </div>

        {split && (
          <div key={split.name} className="split-in flex items-stretch border border-line bg-night/90">
            <span className={`w-[4px] shrink-0 ${SPLIT_BAR[split.grade]}`} />
            <span className="flex flex-1 items-baseline justify-between gap-2 px-2 py-1.5">
              <span className="text-[13px] font-bold text-paint [font-stretch:85%]">{split.name}</span>
              <span className={`num text-[14px] font-bold ${SPLIT_TEXT[split.grade]}`}>
                {split.deltaMs >= 0 ? "+" : "−"}
                {(Math.abs(split.deltaMs) / 1000).toFixed(3)}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* start lights */}
      {(s.phase === "lights" || lightsOut) && (
        <div className="pointer-events-none absolute inset-x-0 top-[28%] flex flex-col items-center gap-4">
          <Gantry lit={s.phase === "lights" ? s.lights : 0} size="lg" />
          {lightsOut && <p className="slam wide text-[26px] uppercase tracking-[0.04em] text-paint [text-shadow:0_2px_14px_rgba(0,0,0,0.85)]">Lights out</p>}
        </div>
      )}

      {/* onboard cluster, bottom centre */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-[320px] border border-line bg-night/90 px-3 pt-2.5 pb-2">
          <RevLights leds={racing ? s.drive.leds : 0} shift={racing && s.drive.shift} />
          <div className="mt-2 flex items-end justify-between">
            <div className="flex items-end gap-2.5">
              <span className="wide num w-8 text-[44px] leading-[0.85] text-paint">{racing ? s.drive.gear : "N"}</span>
              <span className="label pb-0.5">Gear</span>
            </div>
            <div className="flex items-end gap-2">
              <Segments text={String(speed).padStart(3, " ")} className="h-8 text-paint" ghost={0.1} />
              <span className="label pb-0.5">km/h</span>
            </div>
          </div>
        </div>
      </div>
      <button className={`${secondaryBtn} absolute right-2 bg-night/85 bottom-[max(12px,env(safe-area-inset-bottom))] max-[520px]:bottom-[112px]`} onClick={onSkip}>
        Skip
      </button>
    </>
  );
}
