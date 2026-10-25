import { useEffect } from "react";
import { t, tn } from "../i18n";
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

  const NOT_TRIED = t("Not tried yet");
  const s = dailyStats();
  const dist = medalDistribution();
  const most = Math.max(1, ...dist.map((d) => d.days));
  const reaction = loadReaction();
  const mystery = mysteryStats();
  const hl = loadHigherLower();
  const pit = loadPitStop();
  const corner = cornerMedals();
  const circuits = CATALOG.filter((c) => c.id !== "kestrel").map((c) => {
    const pb = loadPB(c.id, 1);
    return { ...c, pb: pb?.lapTimeMs ?? null, medal: pb ? medalFor(c.id, pb.lapTimeMs, []) : null };
  });

  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-night/75 p-4 pt-12" onClick={onClose}>
      <div role="dialog" aria-label={t("Your record")} className="wipe-in w-full max-w-md border border-line bg-board p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="wide text-[26px] leading-none text-paint">{t("Your record")}</h2>

        <dl className="mt-5 grid grid-cols-4 gap-2 text-center">
          {[
            [t("Played"), s.played],
            [t("Medals"), s.medalDays],
            [t("Streak"), s.streak],
            [t("Best streak"), s.bestStreak],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dd className="wide num text-[26px] leading-none text-paint">{v}</dd>
              <dt className="caption mt-1.5">{k}</dt>
            </div>
          ))}
        </dl>

        <h3 className="mt-7 text-[15px] font-semibold text-paint">{t("How your days ended")}</h3>
        <ul className="mt-3 space-y-1.5">
          {dist.map((d) => (
            <li key={d.medal ?? "none"} className="grid grid-cols-[84px_1fr] items-center gap-3">
              <span className="flex items-center gap-1.5 text-[13px] text-steel">
                {d.medal ? <MedalDisc medal={d.medal} size={12} /> : <span className="w-3" />}
                {d.medal ? t(MEDAL_NAME[d.medal]) : t("No medal")}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-4" style={{ width: `${(d.days / most) * 100}%`, minWidth: d.days ? 4 : 0, background: d.medal ? MEDAL_COLOR[d.medal] : "var(--color-line)" }} />
                <span className="num text-[13px] text-paint">{d.days}</span>
              </span>
            </li>
          ))}
        </ul>

        <h3 className="mt-7 text-[15px] font-semibold text-paint">{t("Best lap on each circuit")}</h3>
        <ul className="mt-2">
          {circuits.map((c) => (
            <li key={c.id} className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5 last:border-b-0">
              <span className="text-[14px] text-paint">{c.name}</span>
              <span className="flex items-center gap-2">
                {c.medal && <MedalDisc medal={c.medal} size={12} />}
                <span className={`num text-[14px] ${c.pb ? "text-paint" : "text-steel/60"}`}>{c.pb ? lapTime(c.pb) : t("No lap yet")}</span>
              </span>
            </li>
          ))}
        </ul>

        <h3 className="mt-7 text-[15px] font-semibold text-paint">{t("Minigames")}</h3>
        <dl className="mt-2">
          {[
            [t("Mystery circuit"), mystery.played ? t("{solved} of {played} solved, streak {streak}", { solved: mystery.solved, played: mystery.played, streak: mystery.streak }) : NOT_TRIED],
            [t("Higher or lower"), hl.runs ? t("Best streak {n}", { n: hl.best }) : NOT_TRIED],
            [t("Corner of the week"), corner.weeks ? t("{medals} of {weeks} weeks with a medal", { medals: corner.medals, weeks: corner.weeks }) + (corner.poles ? `, ${tn(corner.poles, "{n} pole", "{n} poles")}` : "") : NOT_TRIED],
            [t("Pit stop"), pit.best !== null ? t("Best {time} s", { time: (pit.best / 1000).toFixed(3) }) : NOT_TRIED],
            [t("Lights out"), reaction.best !== null ? t("Best {time} s", { time: (reaction.best / 1000).toFixed(3) }) : NOT_TRIED],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5 last:border-b-0">
              <dt className="text-[14px] text-paint">{k}</dt>
              <dd className={`num text-[14px] ${v === NOT_TRIED ? "text-steel/60" : "text-paint"}`}>{v}</dd>
            </div>
          ))}
        </dl>

        <button className={`${secondaryBtn} mt-6 w-full`} onClick={onClose}>
          {t("Close")}
        </button>
      </div>
    </div>
  );
}
