import { CATALOG } from "../game/catalog";
import { DAILY_LAPS, type DailyRecord, archiveDays, bestMedal } from "../modes/daily";
import { MEDAL_NAME } from "../modes/medals";
import { CircuitOutline } from "./Hub";
import { lapTime } from "./format";
import { MedalDisc } from "./Medals";

const fmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

function Result({ rec, label }: { rec: DailyRecord; label: string }) {
  const medal = bestMedal(rec);
  const best = Math.min(...rec.laps.map((l) => l.lapTimeMs));
  return (
    <span className="flex items-center gap-2 text-[13px]">
      {medal ? <MedalDisc medal={medal} size={12} /> : <span className="h-3 w-3 border border-line" />}
      <span className="text-steel">{label}</span>
      <span className="text-paint">{medal ? MEDAL_NAME[medal] : "No medal"}</span>
      <span className="num text-paint/80">{lapTime(best)}</span>
    </span>
  );
}

/**
 * Every past Daily Quali, newest first. Any day can be played (or replayed)
 * with the same six laps and medals; replays are kept apart and never count
 * for the streak or the record.
 */
export function Archive({ onPlay }: { onPlay: (day: string, trackId: string) => void }) {
  const days = archiveDays();
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-4 pt-8 pb-14 md:px-8 lg:pt-12">
        <h1 className="wide text-[clamp(32px,6vw,56px)] leading-none text-paint">Archive</h1>
        <p className="mt-3 max-w-[50ch] text-[15px] text-steel">Every past Daily Quali, same six laps and medals. Replays don't count for your streak.</p>

        {days.length === 0 ? (
          <p className="mt-10 max-w-[44ch] border-t border-line pt-6 text-[15px] text-paint/85">
            Nothing here yet. Today's circuit joins the archive at midnight, and every day after it.
          </p>
        ) : (
          <ul className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {days.map((d, i) => {
              const info = CATALOG.find((t) => t.id === d.trackId)!;
              const replaying = d.replay && d.replay.status === "playing" && d.replay.laps.length > 0;
              const cta = d.replay && d.replay.status !== "playing" ? "Replay again" : replaying ? `Continue, ${DAILY_LAPS - d.replay!.laps.length} laps left` : d.live ? "Replay" : "Play";
              return (
                <li key={d.key} className="in-view" style={{ "--d": `${Math.min(i, 8) * 35}ms` } as React.CSSProperties}>
                  <button onClick={() => onPlay(d.key, d.trackId)} className="track-tile flex h-full w-full items-stretch gap-4 border border-line bg-board/70 p-4 text-left">
                    <CircuitOutline track={d.trackId} className="h-20 w-20 shrink-0 text-steel" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="caption">
                        No. {d.number}, {fmt.format(new Date(`${d.key}T12:00:00`))}
                      </span>
                      <span className="wide mt-1 truncate text-[20px] leading-tight text-paint">{info.name}</span>
                      <span className="mt-2 flex flex-col gap-1">
                        {d.live && <Result rec={d.live} label="On the day" />}
                        {d.replay && d.replay.laps.length > 0 && <Result rec={d.replay} label="Replay" />}
                        {!d.live && !d.replay?.laps.length && <span className="text-[13px] text-steel">Not played</span>}
                      </span>
                      <span className="mt-auto pt-3 text-[14px] font-semibold text-ink">{cta}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
