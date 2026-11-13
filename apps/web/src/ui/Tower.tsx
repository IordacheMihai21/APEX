import { type ReactNode, useEffect, useRef, useState } from "react";
import { t } from "../i18n";

/** Podium colours for the position tabs: gold, silver, bronze. */
export const PODIUM = ["#f5c518", "#c0c7d1", "#cd8a4a"];

export interface TowerRowData {
  pos: number;
  /** null: a driver without a racing name */
  name: string | null;
  /** the number on the right: a lap time, "3 GP" */
  value: string;
  /** small text before the value: the gap to P1, "3 in a row" */
  note?: string;
  mine?: boolean;
  badge?: boolean;
}

/** Plays the tower's build-up once, when it first comes into view (rows stay put afterwards). */
function useLive<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || live) return;
    if (typeof IntersectionObserver === "undefined") return setLive(true);
    // already on screen: play now
    const box = el.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) return setLive(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLive(true);
          io.disconnect();
        }
      },
      { threshold: 0 },
    );
    io.observe(el);
    // never leave the rows hidden if the observer doesn't report (some in-app browsers)
    const safety = setTimeout(() => setLive(true), 4000);
    return () => {
      io.disconnect();
      clearTimeout(safety);
    };
  }, [live]);
  return [ref, live];
}

/**
 * A leaderboard drawn like a broadcast timing tower: each row a slanted position tab (gold, silver and bronze for the
 * top three), the driver, and the number on the right. Rows slide in one after another the first time the tower comes
 * into view; P1 catches the light once. `hot` colours P1's value (purple for the fastest lap, as on F1 timing).
 */
export function Tower({ rows, hot, label }: { rows: TowerRowData[]; hot?: string; label: string }) {
  const [ref, live] = useLive<HTMLOListElement>();
  return (
    <ol ref={ref} aria-label={label} className={`flex flex-col gap-1 ${live ? "tower-live" : ""}`}>
      {rows.map((r, i) => {
        const tab = PODIUM[r.pos - 1];
        return (
          <li
            key={`${r.pos}-${r.name ?? "x"}`}
            id={r.mine ? "tower-me" : undefined}
            style={{ ["--i" as string]: Math.min(i, 12) }}
            className={`tower-row group relative flex h-11 items-stretch overflow-hidden bg-board transition-transform duration-200 hover:translate-x-1 ${r.pos === 1 ? "tower-p1" : ""} ${r.mine ? "ring-1 ring-ink/70" : ""}`}
          >
            <span
              className="num flex w-12 shrink-0 items-center justify-center pr-1 text-[15px] font-bold [clip-path:polygon(0_0,100%_0,82%_100%,0_100%)]"
              style={{ background: tab ?? "var(--color-graphite)", color: tab ? "var(--color-night)" : "var(--color-paint)" }}
            >
              {r.pos}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2 pl-2">
              <span className={`truncate text-[15px] font-semibold ${r.name ? (r.mine ? "text-ink" : "text-paint") : "text-steel italic"}`}>{r.name ?? t("Unnamed driver")}</span>
              {r.badge && <span className="text-[#f5c518]" aria-label={t("Brought 10 friends to Lapdle")}>★</span>}
              {r.mine && <span className="shrink-0 bg-ink px-1.5 py-px text-[10px] font-bold tracking-[0.06em] text-night uppercase">{t("You")}</span>}
            </span>
            {r.note && <span className="num hidden shrink-0 items-center pr-3 text-[12px] text-steel sm:flex">{r.note}</span>}
            <span className="num flex w-[88px] shrink-0 items-center justify-end pr-3 text-[15px] font-bold" style={{ color: r.pos === 1 && hot ? hot : "var(--color-paint)" }}>
              {r.value}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** A tower with its heading strip and the states around it (loading, unreachable, empty). */
export function TowerPanel({
  title,
  subtitle,
  accent,
  rows,
  hot,
  empty,
  footer,
}: {
  title: ReactNode;
  subtitle: string;
  accent: string;
  rows: TowerRowData[] | null | undefined;
  hot?: string;
  empty: string;
  footer?: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-stretch gap-3">
        <span aria-hidden="true" className="w-1.5 shrink-0" style={{ background: accent }} />
        <div className="min-w-0">
          <h3 className="wide text-[22px] leading-none text-paint">{title}</h3>
          <p className="mt-1 text-[13px] text-steel">{subtitle}</p>
        </div>
      </div>
      {rows === undefined ? (
        <div className="flex flex-col gap-1" aria-label={t("Loading the standings…")}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton h-11" />
          ))}
        </div>
      ) : rows === null ? (
        <p className="bg-board px-4 py-4 text-[14px] text-steel">{t("The standings can't be reached right now.")}</p>
      ) : rows.length === 0 ? (
        <p className="bg-board px-4 py-4 text-[14px] text-steel">{empty}</p>
      ) : (
        <Tower rows={rows} hot={hot} label={typeof title === "string" ? title : subtitle} />
      )}
      {footer}
    </section>
  );
}
