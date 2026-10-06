import { useEffect, useState } from "react";
import { PHYSICS_VERSION } from "@apex/engine";
import { CATALOG } from "../game/catalog";
import { OUTLINES } from "../game/outlines";
import { CIRCUITS } from "../modes/circuits";
import { CONDITION_NAME, LAUNCH, dailyCondition, dailyNumber, dailyTrack } from "../modes/daily";
import { type BoardDay, type LapRecord, ONLINE, fetchRecentBoards, fetchRecords } from "../online";
import { AdBelow } from "./Ads";
import { delta, lapTime } from "./format";

const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateOf = (day: string) => fmt.format(new Date(`${day}T12:00:00`));
const nameOf = (id: string) => CATALOG.find((t) => t.id === id)?.name ?? id;
const CONDITIONS = ["dry", "wet", "lowdf"] as const;

/** The perfect lap for a circuit in a condition (ms), the yardstick for every record. */
function perfect(trackId: string, condition: (typeof CONDITIONS)[number]): number | null {
  const o = OUTLINES[trackId];
  if (!o) return null;
  return condition === "dry" ? o.lapMs : (o.conditions[condition]?.lapMs ?? null);
}

/** A lap from that day's real Daily Quali board (since launch): test laps and laps on other circuits don't count. */
const scheduled = (r: { day: string; trackId: string; condition: string }) => r.day >= LAUNCH && dailyTrack(r.day) === r.trackId && dailyCondition(r.day) === r.condition;

type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "error" };

/**
 * Lap records: the fastest Daily Quali lap ever timed on each circuit and
 * condition, set against the perfect lap, and the last 30 days of daily
 * boards. Live from the leaderboard (online.ts); totals only, never a player.
 */
export function Records() {
  const [records, setRecords] = useState<Load<LapRecord[]>>({ state: "loading" });
  const [boards, setBoards] = useState<Load<BoardDay[]>>({ state: "loading" });
  useEffect(() => {
    let live = true;
    fetchRecords(PHYSICS_VERSION).then((r) => live && setRecords(r ? { state: "ok", data: r.filter(scheduled) } : { state: "error" }));
    fetchRecentBoards().then((b) => live && setBoards(b ? { state: "ok", data: b.filter(scheduled) } : { state: "error" }));
    return () => {
      live = false;
    };
  }, []);

  const unreachable = (
    <p className="mt-4 border-t border-line pt-5 text-[15px] text-paint/85">
      {ONLINE ? "The records couldn't be loaded. Check your connection and open this page again." : "Records are kept by the leaderboard on the live site, lapdle.com."}
    </p>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-4 pt-8 pb-14 md:px-8 lg:pt-12">
        <h1 className="wide text-[clamp(32px,6vw,56px)] leading-none text-paint">Lap records</h1>
        <p className="mt-3 max-w-[60ch] text-[15px] text-steel">
          The fastest Daily Quali lap ever driven on each circuit, timed by the server, against the perfect lap the physics allows. A circuit gets a record the first day it comes up in those conditions.
        </p>

        <section aria-labelledby="records-h" className="mt-8">
          <h2 id="records-h" className="wide text-[24px] leading-none text-paint">
            All-time records
          </h2>
          {records.state === "loading" ? (
            <ul className="mt-4 divide-y divide-line border-y border-line" aria-busy="true">
              {CIRCUITS.slice(0, 6).map((c) => (
                <li key={c.id} className="h-[60px] animate-pulse bg-board/40" />
              ))}
            </ul>
          ) : records.state === "error" ? (
            unreachable
          ) : (
            <RecordTable records={records.data} />
          )}
        </section>

        <section aria-labelledby="boards-h" className="mt-12">
          <h2 id="boards-h" className="wide text-[24px] leading-none text-paint">
            The last 30 days
          </h2>
          <p className="mt-2 text-[14px] text-steel">Every daily board: how many played, the fastest lap and the median.</p>
          {boards.state === "loading" ? (
            <div className="mt-4 h-40 animate-pulse bg-board/40" aria-busy="true" />
          ) : boards.state === "error" ? (
            unreachable
          ) : boards.data.length === 0 ? (
            <p className="mt-4 border-t border-line pt-5 text-[15px] text-paint/85">No laps on the board yet. Drive today's Daily Quali to put the first one there.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="num w-full min-w-[520px] text-left text-[14px]">
                <thead className="text-[12px] tracking-[0.04em] text-steel uppercase">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3 font-semibold">Day</th>
                    <th className="py-2 pr-3 font-semibold">Circuit</th>
                    <th className="py-2 pr-3 text-right font-semibold">Players</th>
                    <th className="py-2 pr-3 text-right font-semibold">Fastest</th>
                    <th className="py-2 text-right font-semibold">Median</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {boards.data.map((b) => (
                    <tr key={`${b.day}-${b.trackId}-${b.condition}`}>
                      <td className="py-2.5 pr-3 text-steel">
                        No. {dailyNumber(b.day)} <span className="hidden sm:inline">· {dateOf(b.day)}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-paint">
                        {nameOf(b.trackId)}
                        {b.condition !== "dry" && <span className="text-steel">, {CONDITION_NAME[b.condition].toLowerCase()}</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-right">{b.players}</td>
                      <td className="py-2.5 pr-3 text-right text-paint">{lapTime(b.bestMs)}</td>
                      <td className="py-2.5 text-right">{lapTime(b.medianMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <AdBelow />
    </div>
  );
}

function RecordTable({ records }: { records: LapRecord[] }) {
  const of = (id: string, cond: string) => records.find((r) => r.trackId === id && r.condition === cond);
  return (
    <ul className="mt-4 divide-y divide-line border-y border-line">
      {CIRCUITS.map((c) => {
        const rows = CONDITIONS.map((cond) => ({ cond, rec: of(c.id, cond) })).filter((r) => r.cond === "dry" || r.rec);
        return (
          <li key={c.id} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-x-4 py-3.5 sm:grid-cols-[44px_200px_minmax(0,1fr)]">
            <svg viewBox="0 0 1000 1000" className="row-span-2 h-11 w-11 sm:row-span-1" aria-hidden="true">
              <path d={OUTLINES[c.id].outline} fill="none" stroke="#f2f2ee" strokeWidth={50} strokeLinejoin="round" />
            </svg>
            <p className="wide pt-1 text-[16px] leading-tight text-paint">
              <a href={`/?play=practice&track=${c.id}`} className="hover:underline">
                {c.name}
              </a>
            </p>
            <ul className="mt-1 space-y-1 sm:mt-0 sm:pt-1">
              {rows.map(({ cond, rec }) => {
                const p = perfect(c.id, cond);
                return (
                  <li key={cond} className="num flex flex-wrap items-baseline gap-x-3 text-[14px]">
                    <span className="w-[104px] shrink-0 text-steel">{CONDITION_NAME[cond]}</span>
                    {rec ? (
                      <>
                        <span className="wide text-[16px] text-paint">{lapTime(rec.lapMs)}</span>
                        {p !== null && <span className="text-steel">{delta(rec.lapMs - p)} to perfect</span>}
                        <span className="text-steel/80">
                          No. {dailyNumber(rec.day)}, {dateOf(rec.day)}
                        </span>
                      </>
                    ) : (
                      <span className="text-steel/70">No lap yet{p !== null ? `. Perfect ${lapTime(p)}` : ""}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
