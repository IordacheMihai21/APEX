import { t } from "../i18n";
import { PODIUM } from "./Tower";

export interface PodiumEntry {
  name: string | null;
  /** the big number under the name: a lap time, "4 GP" */
  value: string;
  /** small line under it: the gap to P1, "4 in a row" */
  sub?: string;
  mine?: boolean;
}

/**
 * The top three as on an F1 podium: P2 on the left, P1 in the middle and highest, P3 on the right. The steps rise
 * P3, P2, then P1, and each name lands once its step is up (index.css: podium-step, podium-name); P1's step catches the
 * light. `hot` colours P1's value (purple for the fastest lap).
 */
export function Podium({ entries, hot }: { entries: (PodiumEntry | undefined)[]; hot?: string }) {
  const spots: [PodiumEntry | undefined, number, string, number][] = [
    [entries[1], 2, "h-[130px] sm:h-[150px]", 250],
    [entries[0], 1, "h-[180px] sm:h-[210px]", 500],
    [entries[2], 3, "h-[95px] sm:h-[110px]", 0],
  ];
  return (
    <div className="grid grid-cols-3 items-end gap-2 sm:gap-4">
      {spots.map(([e, pos, h, delay]) => {
        const color = PODIUM[pos - 1];
        return (
          <div key={pos} className="flex min-w-0 flex-col items-center text-center">
            {e ? (
              <div className="podium-name flex w-full flex-col items-center px-1" style={{ animationDelay: `${delay + 550}ms` }}>
                <span className={`w-full truncate text-[14px] leading-tight font-semibold sm:text-[17px] ${e.name ? (e.mine ? "text-ink" : "text-paint") : "text-steel italic"}`}>{e.name ?? t("Unnamed driver")}</span>
                <span className="num mt-1 text-[16px] font-bold sm:text-[22px]" style={{ color: pos === 1 && hot ? hot : "var(--color-paint)" }}>
                  {e.value}
                </span>
                <span className="num text-[12px] text-steel">{e.sub || " "}</span>
              </div>
            ) : (
              <span className="text-[13px] text-steel">{t("Open")}</span>
            )}
            <div
              className={`podium-step relative mt-2 flex w-full items-start justify-center overflow-hidden ${h} ${pos === 1 ? "tower-live tower-p1" : ""}`}
              style={{ background: `linear-gradient(180deg, ${color} 0%, ${color}26 100%)`, animationDelay: `${delay}ms` }}
            >
              <span className="wide mt-3 text-[48px] leading-none text-night sm:text-[64px]">{pos}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A small figure for the stats strip: a label over a number. */
export function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 bg-board px-4 py-3">
      <p className="truncate text-[12px] text-steel">{label}</p>
      <p className="num mt-1 truncate text-[22px] leading-none font-bold" style={{ color: tone ?? "var(--color-paint)" }}>
        {value}
      </p>
    </div>
  );
}
