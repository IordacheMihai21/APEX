import { useEffect, useState } from "react";
import { LANG, t } from "../i18n";
import { CATALOG } from "../game/catalog";
import { dailyCondition, dailyNumber, dailyTrack, dateKey } from "../modes/schedule";
import { type ChampionRow, type DayRow, ONLINE, fetchChampionship, fetchDayBoard, myNickname } from "../online";
import { lapTime } from "./format";
import { openPitlane } from "./Pitlane";
import { primaryBtn, secondaryBtn } from "./styles";

const GOLD = "#f5c518";
const SILVER = "#c0c7d1";
const BRONZE = "#cd8a4a";
const COND: Record<string, string> = { dry: "", wet: "wet", lowdf: "low downforce" };

/** "+0.007" behind the leader. */
const gap = (ms: number, lead: number) => (ms === lead ? "" : `+${((ms - lead) / 1000).toFixed(3)}`);

function Name({ name, mine }: { name: string | null; mine: boolean }) {
  return (
    <span className={`truncate font-semibold ${name ? (mine ? "text-ink" : "text-paint") : "text-steel italic"}`}>
      {name ?? t("Unnamed driver")}
      {mine && <span className="ml-1.5 text-[11px] font-bold tracking-[0.06em] text-ink uppercase not-italic">{t("You")}</span>}
    </span>
  );
}

/** The top three of the day, as on an F1 podium: P2 on the left, P1 in the middle and highest, P3 on the right. */
function Podium({ rows, mine }: { rows: DayRow[]; mine: string | null }) {
  const lead = rows[0]?.lapMs ?? 0;
  const spots: [DayRow | undefined, number, string, string][] = [
    [rows[1], 2, SILVER, "h-[120px]"],
    [rows[0], 1, GOLD, "h-[170px]"],
    [rows[2], 3, BRONZE, "h-[90px]"],
  ];
  return (
    <div className="mt-6 grid grid-cols-3 items-end gap-2 sm:gap-4">
      {spots.map(([r, pos, color, h]) => (
        <div key={pos} className="flex min-w-0 flex-col items-center text-center">
          {r ? (
            <>
              <span className="w-full px-1 text-[14px] leading-tight sm:text-[16px]">
                <Name name={r.nickname} mine={!!mine && r.nickname === mine} />
              </span>
              <span className="num mt-1 text-[15px] font-semibold text-paint sm:text-[18px]">{lapTime(r.lapMs)}</span>
              <span className="num text-[12px] text-steel">{gap(r.lapMs, lead) || " "}</span>
            </>
          ) : (
            <span className="text-[13px] text-steel">{t("Open")}</span>
          )}
          <div className={`mt-2 flex w-full items-start justify-center ${h}`} style={{ background: `linear-gradient(180deg, ${color} 0%, ${color}22 100%)` }}>
            <span className="wide mt-2 text-[44px] leading-none text-night sm:text-[56px]">{pos}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The standings page (/standings): today's Daily Quali as an F1 podium and the full classification under it, every
 * driver with their own place; then this month's Championship, every named driver, one place each (ties split by the
 * longer run, then more daily games finished this month, then whoever started first).
 */
export function Standings() {
  const today = dateKey();
  const trackId = dailyTrack(today);
  const cond = dailyCondition(today);
  const info = CATALOG.find((c) => c.id === trackId);
  const [day, setDay] = useState<DayRow[] | null | undefined>(undefined);
  const [champ, setChamp] = useState<ChampionRow[] | null | undefined>(undefined);
  const [mine, setMine] = useState(myNickname);
  useEffect(() => {
    void fetchDayBoard(today, trackId, cond).then(setDay);
    void fetchChampionship(today, 500).then(setChamp);
    const on = () => setMine(myNickname());
    window.addEventListener("apex:standing", on);
    return () => window.removeEventListener("apex:standing", on);
  }, [today, trackId, cond]);
  const month = new Date(`${today}T12:00:00`).toLocaleDateString(LANG === "es" ? "es" : "en-GB", { month: "long" });
  if (!ONLINE) return null;
  const lead = day?.[0]?.lapMs ?? 0;
  return (
    <div className="mx-auto max-w-[880px] px-4 pt-8 pb-16 md:px-8">
      <p className="caption">Lapdle</p>
      <h1 className="wide mt-1 text-[clamp(34px,7vw,56px)] leading-none text-paint">{t("Standings")}</h1>

      <section aria-labelledby="today-h" className="mt-8">
        <h2 id="today-h" className="wide text-[24px] leading-none text-paint">
          {t("Fastest today")}
        </h2>
        <p className="mt-1.5 text-[14px] text-steel">
          {t("Daily Quali #{n}", { n: dailyNumber(today) })} · {info?.flag} {info?.name}
          {COND[cond] ? ` · ${t(COND[cond])}` : ""}
          {day && day.length > 0 ? ` · ${t("{n} drivers", { n: day.length })}` : ""}
        </p>
        {day === undefined ? (
          <p className="mt-6 text-[14px] text-steel">{t("Loading the standings…")}</p>
        ) : day === null ? (
          <p className="mt-6 text-[14px] text-steel">{t("The standings can't be reached right now.")}</p>
        ) : day.length === 0 ? (
          <p className="mt-6 text-[14px] text-steel">{t("No laps yet today. Be the first on the podium.")}</p>
        ) : (
          <>
            <Podium rows={day} mine={mine} />
            {day.length > 3 && (
              <ol className="mt-6 divide-y divide-line border-y border-line">
                {day.slice(3).map((r) => (
                  <li key={r.pos} className="flex items-center gap-3 py-2 text-[15px]">
                    <span className="num w-10 shrink-0 text-right text-steel">P{r.pos}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <Name name={r.nickname} mine={!!mine && r.nickname === mine} />
                    </span>
                    <span className="num shrink-0 text-[13px] text-steel">{gap(r.lapMs, lead)}</span>
                    <span className="num w-20 shrink-0 text-right font-semibold text-paint">{lapTime(r.lapMs)}</span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="champ-full-h" className="mt-12">
        <h2 id="champ-full-h" className="wide text-[24px] leading-none text-paint">
          {t("Championship")} <span className="text-steel capitalize">{month}</span>
        </h2>
        <p className="mt-1.5 text-[14px] text-steel">{t("A Grand Prix is a day you play a daily game. Ties go to the longer run of days in a row, then to more daily games played this month.")}</p>
        {champ === undefined ? (
          <p className="mt-6 text-[14px] text-steel">{t("Loading the standings…")}</p>
        ) : champ === null ? (
          <p className="mt-6 text-[14px] text-steel">{t("The standings can't be reached right now.")}</p>
        ) : champ.length === 0 ? (
          <p className="mt-6 text-[14px] text-steel">{t("No names in this month's standings yet. Be the first.")}</p>
        ) : (
          <ol className="mt-4 divide-y divide-line border-y border-line">
            {champ.map((r) => (
              <li key={r.nickname} className="flex items-center gap-3 py-2 text-[15px]">
                <span className="num w-10 shrink-0 text-right" style={{ color: r.pos === 1 ? GOLD : r.pos === 2 ? SILVER : r.pos === 3 ? BRONZE : undefined }}>
                  P{r.pos}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <Name name={r.nickname} mine={r.nickname === mine} />
                  {r.badge && <span className="ml-1.5 text-[#f5c518]">★</span>}
                </span>
                {r.streak > 1 && <span className="shrink-0 text-[12px] text-steel">{t("{n} in a row", { n: r.streak })}</span>}
                <span className="num w-14 shrink-0 text-right font-semibold text-paint">{r.gps} GP</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-8 flex flex-wrap gap-2.5">
        {!mine && (
          <button className={`${primaryBtn} flex-1 basis-48`} onClick={() => openPitlane(true)}>
            {t("Get on the standings")}
          </button>
        )}
        <a className={`${secondaryBtn} flex-1 basis-40`} href="/">
          {t("Play today's games")}
        </a>
      </div>
    </div>
  );
}
