import { lapTime } from "./format";
import { MEDALS, MEDAL_COLOR, MEDAL_NAME, type Medal, medalTimes, nextMedal } from "../modes/medals";

/** A medal disc: a solid face with an inner ring; unearned discs are an empty ring. */
export function MedalDisc({ medal, earned = true, size = 16, className = "" }: { medal: Medal; earned?: boolean; size?: number; className?: string }) {
  const c = MEDAL_COLOR[medal];
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden="true">
      {earned ? (
        <>
          <circle cx={10} cy={10} r={9} fill={c} />
          <circle cx={10} cy={10} r={6} fill="none" stroke="#0a0b0d" strokeOpacity={0.28} strokeWidth={1.5} />
        </>
      ) : (
        <circle cx={10} cy={10} r={8.25} fill="none" stroke={c} strokeOpacity={0.45} strokeWidth={1.5} />
      )}
    </svg>
  );
}

/**
 * The medal ladder: the four targets for today's circuit, left to right, with
 * the ones already earned lit. It is the day's goal at a glance.
 */
export function MedalLadder({ trackId, best }: { trackId: string; best: Medal | null }) {
  const t = medalTimes(trackId);
  if (!t) return null;
  const reached = best ? MEDALS.indexOf(best) : -1;
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Medal targets">
      {MEDALS.map((m, i) => {
        const on = i <= reached;
        return (
          <li key={m} className={`flex flex-col gap-1.5 border-t-2 pt-2 ${on ? "" : "border-line"}`} style={on ? { borderColor: MEDAL_COLOR[m] } : undefined}>
            <span className="flex items-center gap-1.5">
              <MedalDisc medal={m} earned={on} size={14} />
              <span className={`text-[13px] font-semibold ${on ? "text-paint" : "text-steel"}`}>{MEDAL_NAME[m]}</span>
            </span>
            <span className={`num text-[13px] ${on ? "text-paint" : "text-steel"}`}>{m === "pole" ? "All purple" : lapTime(t[m])}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The result sheet's medal line: what this lap earned (stamped in when it is a
 * new personal best) and the next target with the time still to find.
 */
export function MedalRow({ trackId, medal, lapTimeMs, stamp }: { trackId: string; medal: Medal | null; lapTimeMs: number; stamp: boolean }) {
  const next = nextMedal(trackId, medal);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line py-2">
      <span className="flex items-center gap-2">
        {medal ? (
          <>
            <span className={stamp ? "medal-stamp" : ""}>
              <MedalDisc medal={medal} size={22} />
            </span>
            <span className="wide text-[15px] text-paint">{MEDAL_NAME[medal]}</span>
          </>
        ) : (
          <span className="caption">No medal yet</span>
        )}
      </span>
      {next && (
        <span className="caption num text-right">
          {next.ms === null ? (
            <>Pole needs every corner purple</>
          ) : (
            <>
              {MEDAL_NAME[next.medal]} at {lapTime(next.ms)}, <span className="text-paint">{((lapTimeMs - next.ms) / 1000).toFixed(3)}s</span> to find
            </>
          )}
        </span>
      )}
    </div>
  );
}
