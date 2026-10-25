import { useEffect, useState } from "react";
import { t } from "./i18n";
import { CATALOG } from "./game/catalog";
import { OUTLINES } from "./game/outlines";
import type { Condition } from "@apex/engine";
import { CONDITION_NAME, conditionOf, type DailyRecord, bestMedal, dailyNumber, loadDaily, msToNextDay, shareText } from "./modes/daily";
import { GRADE_EMOJI } from "./modes/grading";

import { MEDAL_NAME } from "./modes/medals";
import { challengeUrl } from "./modes/challenge";
import { Share } from "./ui/icons";
import { primaryBtn, secondaryBtn } from "./ui/styles";
import { shared } from "./games/events";
import { cachedStanding, refreshStanding, standingLine, useStanding } from "./online";
import { lapTime } from "./ui/format";

export function useCountdown() {
  const [left, setLeft] = useState(() => msToNextDay());
  useEffect(() => {
    const id = setInterval(() => setLeft(msToNextDay()), 1000);
    return () => clearInterval(id);
  }, []);
  const x = Math.floor(left / 1000);
  return `${String(Math.floor(x / 3600)).padStart(2, "0")}:${String(Math.floor((x % 3600) / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
}

export function ShareButton({
  text,
  image,
  label = t("Share result"),
  variant = "primary",
}: {
  text: string;
  /** a picture to send with the text, where the device can share files */
  image?: () => Promise<Blob>;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const [done, setDone] = useState(false);
  const share = async () => {
    shared(label === t("Challenge") ? "challenge" : "daily");
    try {
      if (image && navigator.canShare) {
        const file = new File([await image()], "apex-daily.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], text });
      }
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }
    } catch {
      /* share sheet dismissed */
    }
  };
  return (
    <button className={variant === "primary" ? `${primaryBtn} flex-1` : secondaryBtn} onClick={share}>
      <Share className="h-4 w-4" /> {done ? t("Copied") : label}
    </button>
  );
}

/** Today's share text and card, in one place for every share button. */
/** The day's leaderboard (today's live daily only; archive replays aren't ranked). */
export function boardOf(daily: DailyRecord) {
  return daily.archive ? null : { day: daily.key, trackId: daily.trackId, condition: conditionOf(daily) };
}

/** The standing line for a day, kept current, with a refresh when it first shows. */
export function StandingLine({ daily, className = "" }: { daily: DailyRecord; className?: string }) {
  const board = boardOf(daily);
  const standing = useStanding(board);
  useEffect(() => {
    if (board && standing) void refreshStanding(board, standing.yourBestMs);
    // once per board
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.day, board?.trackId]);
  if (!standing) return null;
  return (
    <p className={`text-[14px] text-paint ${className}`}>
      {standingLine(standing)} <span className="text-steel">{t("Median {time}.", { time: lapTime(standing.medianMs) })}</span>
    </p>
  );
}

export function dailyShare(daily: DailyRecord) {
  const info = CATALOG.find((c) => c.id === daily.trackId)!;
  const board = boardOf(daily);
  const standing = board ? cachedStanding(board) : null;
  const base = shareText(daily, info.name, info.flag, GRADE_EMOJI, daily.bestKnots && challengeUrl({ trackId: daily.trackId, knots: daily.bestKnots }));
  return {
    // the standing goes after the first line, before the grid
    text: standing && standing.players > 1 ? base.replace("\n", `\n${standingLine(standing)}\n`) : base,
    image: () => import("./ui/shareCard").then((m) => m.dailyCard(daily)),
  };
}

/** How a finished day reads: its best medal, or Pole and the lap it came on. */
export function dayHeadline(daily: DailyRecord): string {
  if (daily.status === "won") return t("Pole on lap {n}", { n: daily.laps.length });
  const m = bestMedal(daily);
  if (daily.archive) return m ? t(MEDAL_NAME[m]) : t("No medal");
  return m ? t("{medal} today", { medal: t(MEDAL_NAME[m]) }) : t("No medal today");
}

/** Hub overlay for a finished daily: the share card, share, countdown. */
export function DailySummary({ onClose, onWatch }: { onClose: () => void; onWatch: () => void }) {
  const daily = loadDaily();
  const info = CATALOG.find((c) => c.id === daily.trackId)!;
  const countdown = useCountdown();
  const share = dailyShare(daily);
  const [card, setCard] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let live = true;
    share.image().then((b) => {
      if (!live) return;
      url = URL.createObjectURL(b);
      setCard(url);
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
    // one card per open dialog
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-night/80 p-4 pt-10" onClick={onClose}>
      <div role="dialog" aria-label={t("Today's result")} className="wipe-in w-full max-w-sm border border-line bg-board p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="wide text-[20px] leading-none text-paint">{dayHeadline(daily)}</h2>
        <p className="mt-1.5 text-[14px] text-paint/75">
          {t("Daily Quali #{n}, {circuit}. Next circuit in", { n: dailyNumber(), circuit: info.name })} <span className="num">{countdown}</span>.
        </p>
        <StandingLine daily={daily} className="mt-2" />
        <div className="mt-4 aspect-[4/5] w-full border border-line bg-night">
          {card ? <img src={card} alt={t("Share card: {result} at {circuit}", { result: dayHeadline(daily), circuit: info.name })} className="card-in h-full w-full" /> : <div className="skeleton h-full w-full" aria-hidden="true" />}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <ShareButton text={share.text} image={share.image} />
          {card && (
            <a className={secondaryBtn} href={card} download={`apex-daily-${dailyNumber()}.png`}>
              {t("Save image")}
            </a>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={secondaryBtn} onClick={onWatch}>
            {t("Watch the perfect lap")}
          </button>
          <button className={secondaryBtn} onClick={onClose}>
            {t("Close")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TrackPicker({ onPick, onClose }: { onPick: (id: string, condition: Condition) => void; onClose: () => void }) {
  // practise in any conditions, e.g. ahead of a wet daily
  const [condition, setCondition] = useState<Condition>("dry");
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center bg-night/75 p-4 pt-16" onClick={onClose}>
      <div role="dialog" aria-label={t("Choose a circuit")} className="wipe-in w-full max-w-sm border border-line bg-board" onClick={(e) => e.stopPropagation()}>
        <div className="wide border-b border-line px-4 py-3 text-[15px] text-paint">{t("Choose a circuit")}</div>
        <div role="radiogroup" aria-label={t("Conditions")} className="grid grid-cols-3 border-b border-line">
          {(["dry", "wet", "lowdf"] as const).map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={condition === c}
              onClick={() => setCondition(c)}
              className={`border-r border-line py-2 text-[13px] font-semibold last:border-r-0 ${condition === c ? "bg-paint text-night" : "text-steel hover:text-paint"}`}
            >
              {t(CONDITION_NAME[c])}
            </button>
          ))}
        </div>
        <ul className="max-h-[70dvh] overflow-y-auto">
          {CATALOG.map((c, i) => (
            <li key={c.id} className="border-b border-line/70 last:border-b-0">
              <button onClick={() => onPick(c.id, condition)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-graphite">
                <span className="cut-l num grid h-6 w-7 shrink-0 place-items-center bg-graphite text-[11px] font-bold text-steel">{i + 1}</span>
                <span className="wide flex-1 truncate text-[15px] text-paint">{c.name}</span>
                <span className="caption">{t(c.country)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** While the circuit loads, its outline draws itself where the map will be. */
export function Loading({ trackId, error }: { trackId: string; error: string | null }) {
  const o = OUTLINES[trackId];
  return (
    <div className="grid h-full place-items-center content-center gap-4 px-6 text-center">
      {o && !error && (
        <svg viewBox="0 0 1000 1000" className="hero-map h-40 w-40" aria-hidden="true">
          <path className="draw draw-1 loading-loop" pathLength={1} d={o.outline} fill="none" stroke="#9aa1ab" strokeWidth={26} strokeLinejoin="round" />
        </svg>
      )}
      <p className={`text-[14px] ${error ? "text-paint" : "text-steel"}`} role="status">
        {error ? t("This circuit did not load: {error}. Go back to the grid and try again.", { error }) : t("Loading {circuit}", { circuit: CATALOG.find((c) => c.id === trackId)?.name ?? t("the circuit") })}
      </p>
    </div>
  );
}
