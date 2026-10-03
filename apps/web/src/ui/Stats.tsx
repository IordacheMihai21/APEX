import { useEffect } from "react";
import { CATALOG } from "../game/catalog";
import { loadPB } from "../game/storage";
import { dailyStats, medalDistribution } from "../modes/daily";
import { MEDAL_COLOR, MEDAL_NAME, medalFor } from "../modes/medals";
import { loadHigherLower } from "../modes/higherLower";
import { mysteryStats } from "../modes/mystery";
import { loadPitStop } from "../modes/pitstop";
import { cornerMedals } from "../modes/corner";
import { loadReaction } from "../modes/reaction";
import { lapTime } from "./format";
import { MedalDisc } from "./Medals";
import { secondaryBtn } from "./styles";

/**
 * Your record, Wordle-style: the headline numbers, how your days have ended
 * (best medal per day as plain bars, no tracks behind them), your best lap on
 * every circuit with its medal, and your best start.
 */
export function Stats({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const s = dailyStats();
  const dist = medalDistribution();
  const most = Math.max(1, ...dist.map((d) => d.days));
  const reaction = loadReaction();
  const mystery = mysteryStats();
  const hl = loadHigherLower();
  const pit = loadPitStop();
  const corner = cornerMedals();
  const circuits = CATALOG.filter((t) => t.id !== "kestrel").map((t) => {
    const pb = loadPB(t.id, 1);
    return { ...t, pb: pb?.lapTimeMs ?? null, medal: pb ? medalFor(t.id, pb.lapTimeMs, []) : null };
  });

  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-night/75 p-4 pt-12" onClick={onClose}>
      <div role="dialog" aria-label="Your record" className="wipe-in w-full max-w-md border border-line bg-board p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="wide text-[26px] leading-none text-paint">Your record</h2>

        <dl className="mt-5 grid grid-cols-4 gap-2 text-center">
          {[
            ["Played", s.played],
            ["Medals", s.medalDays],
            ["Streak", s.streak],
            ["Best streak", s.bestStreak],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dd className="wide num text-[26px] leading-none text-paint">{v}</dd>
              <dt className="caption mt-1.5">{k}</dt>
            </div>
          ))}
        </dl>

        <h3 className="mt-7 text-[15px] font-semibold text-paint">How your days ended</h3>
        <ul className="mt-3 space-y-1.5">
          {dist.map((d) => (
            <li key={d.medal ?? "none"} className="grid grid-cols-[84px_1fr] items-center gap-3">
              <span className="flex items-center gap-1.5 text-[13px] text-steel">
                {d.medal ? <MedalDisc medal={d.medal} size={12} /> : <span className="w-3" />}
                {d.medal ? MEDAL_NAME[d.medal] : "No medal"}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-4" style={{ width: `${(d.days / most) * 100}%`, minWidth: d.days ? 4 : 0, background: d.medal ? MEDAL_COLOR[d.medal] : "var(--color-line)" }} />
                <span className="num text-[13px] text-paint">{d.days}</span>
              </span>
            </li>
          ))}
        </ul>

        <h3 className="mt-7 text-[15px] font-semibold text-paint">Best lap on each circuit</h3>
        <ul className="mt-2">
          {circuits.map((c) => (
            <li key={c.id} className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5 last:border-b-0">
              <span className="text-[14px] text-paint">{c.name}</span>
              <span className="flex items-center gap-2">
                {c.medal && <MedalDisc medal={c.medal} size={12} />}
                <span className={`num text-[14px] ${c.pb ? "text-paint" : "text-steel/60"}`}>{c.pb ? lapTime(c.pb) : "No lap yet"}</span>
              </span>
            </li>
          ))}
        </ul>

        <h3 className="mt-7 text-[15px] font-semibold text-paint">Minigames</h3>
        <dl className="mt-2">
          {[
            ["Mystery circuit", mystery.played ? `${mystery.solved} of ${mystery.played} solved, streak ${mystery.streak}` : "Not tried yet"],
            ["Higher or lower", hl.runs ? `Best streak ${hl.best}` : "Not tried yet"],
            ["Corner of the week", corner.weeks ? `${corner.medals} of ${corner.weeks} weeks with a medal${corner.poles ? `, ${corner.poles} pole${corner.poles === 1 ? "" : "s"}` : ""}` : "Not tried yet"],
            ["Pit stop", pit.best !== null ? `Best ${(pit.best / 1000).toFixed(3)} s` : "Not tried yet"],
            ["Lights out", reaction.best !== null ? `Best ${(reaction.best / 1000).toFixed(3)} s` : "Not tried yet"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5 last:border-b-0">
              <dt className="text-[14px] text-paint">{k}</dt>
              <dd className={`num text-[14px] ${v === "Not tried yet" ? "text-steel/60" : "text-paint"}`}>{v}</dd>
            </div>
          ))}
        </dl>

        <button className={`${secondaryBtn} mt-6 w-full`} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
