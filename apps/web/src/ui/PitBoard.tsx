import type { RunResult } from "../game/game";
import { delta, lapTime } from "./format";

/** One row of slotted characters, like the numbers on a real pit board. */
function Slots({ text, className }: { text: string; className: string }) {
  return (
    <span className="flex gap-[3px]" aria-hidden="true">
      {[...text].map((ch, i) => (
        <span
          key={i}
          className={`grid h-[1.18em] min-w-[0.62em] place-items-center rounded-[2px] bg-slot px-[0.04em] font-display font-black leading-none shadow-[inset_0_-2px_0_rgba(255,255,255,0.04),inset_0_2px_0_rgba(0,0,0,0.5)] ${className} ${ch === ":" || ch === "." ? "min-w-[0.3em] bg-transparent shadow-none" : ""}`}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

function Row({ label, value, tone, sr }: { label: string; value: string; tone: string; sr: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-9 font-mono text-[11px] font-medium tracking-[0.12em] text-steel">{label}</span>
      <Slots text={value} className={tone} />
      <span className="sr-only">{sr}</span>
    </div>
  );
}

export function PitBoard({ r, rivalMs }: { r: RunResult; rivalMs?: number | null }) {
  // Only the lap tiles speak purple/green/yellow/red; the board is paint unless the lap is perfect.
  const targetTone = r.allPurple ? "text-purple" : "text-paint";
  const vsRival = rivalMs != null ? r.lapTimeMs - rivalMs : null;
  const pbDelta = r.pbBeforeMs === null ? null : r.lapTimeMs - r.pbBeforeMs;
  return (
    <div className="board-in origin-bottom-right rounded-md border-2 border-[#3a3f46] bg-board p-2.5 text-[clamp(22px,6.6vw,42px)] shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
      <div className="flex flex-col gap-2">
        <Row label="LAP" value={lapTime(r.lapTimeMs)} tone="text-paint" sr={`Lap time ${lapTime(r.lapTimeMs)}`} />
        {vsRival !== null ? (
          <Row
            label="RIV"
            value={delta(vsRival)}
            tone={vsRival < 0 ? "text-ink" : "text-paint"}
            sr={`${delta(vsRival)} seconds against the rival's pole of ${lapTime(rivalMs!)}`}
          />
        ) : (
          <Row
            label="TGT"
            value={delta(r.deltaTargetMs)}
            tone={targetTone}
            sr={`${delta(r.deltaTargetMs)} seconds against the perfect lap of ${lapTime(r.targetMs)}`}
          />
        )}
        {pbDelta === null ? (
          <Row label="PB" value="FIRST" tone="text-ink" sr="First lap on this track: new personal best" />
        ) : (
          <Row
            label="PB"
            value={delta(pbDelta)}
            tone={r.newPb ? "text-ink" : "text-paint"}
            sr={r.newPb ? `New personal best by ${delta(pbDelta)}` : `${delta(pbDelta)} slower than your personal best`}
          />
        )}
      </div>
    </div>
  );
}
