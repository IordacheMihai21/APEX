import { useEffect, useState } from "react";
import { LANG, t } from "../i18n";
import { CATALOG } from "../game/catalog";
import { dailyCondition, dailyNumber, dailyTrack, dateKey } from "../modes/schedule";
import { type ChampionRow, type DayRow, ONLINE, fetchChampionship, fetchDayBoard, myNickname } from "../online";
import { lapTime } from "./format";
import { openPitlane } from "./Pitlane";
import { primaryBtn, secondaryBtn } from "./styles";
import { Tower } from "./Tower";

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
  // they rise P3, P2, then P1, and each name appears once its step is up
  const spots: [DayRow | undefined, number, string, string, number][] = [
    [rows[1], 2, SILVER, "h-[120px]", 250],
    [rows[0], 1, GOLD, "h-[170px]", 500],
    [rows[2], 3, BRONZE, "h-[90px]", 0],
  ];
  return (
    <div className="mt-6 grid grid-cols-3 items-end gap-2 sm:gap-4">
      {spots.map(([r, pos, color, h, delay]) => (
        <div key={pos} className="flex min-w-0 flex-col items-center text-center">
          {r ? (
            <div className="podium-name flex w-full flex-col items-center" style={{ animationDelay: `${delay + 550}ms` }}>
              <span className="w-full px-1 text-[14px] leading-tight sm:text-[16px]">
                <Name name={r.nickname} mine={!!mine && r.nickname === mine} />
              </span>
              <span className="num mt-1 text-[15px] font-semibold text-paint sm:text-[18px]">{lapTime(r.lapMs)}</span>
              <span className="num text-[12px] text-steel">{gap(r.lapMs, lead) || " "}</span>
            </div>
          ) : (
            <span className="text-[13px] text-steel">{t("Open")}</span>
          )}
          <div className={`podium-step mt-2 flex w-full items-start justify-center ${h}`} style={{ background: `linear-gradient(180deg, ${color} 0%, ${color}22 100%)`, animationDelay: `${delay}ms` }}>
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
  // opened from one board on the home page (/standings#championship): start at that board once the lists are in
  useEffect(() => {
    if (day === undefined || champ === undefined) return;
    let id = typeof location !== "undefined" ? location.hash.slice(1) : "";
    try {
      id ||= sessionStorage.getItem("lapdle.standings.at") ?? "";
      sessionStorage.removeItem("lapdle.standings.at");
    } catch {
      /* start at the top */
    }
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [day, champ]);
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
    <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-[880px] px-4 pt-8 pb-16 md:px-8">
      <p className="caption">Lapdle</p>
      <h1 className="wide mt-1 text-[clamp(34px,7vw,56px)] leading-none text-paint">{t("Standings")}</h1>

      <section id="today" aria-labelledby="today-h" className="mt-8 scroll-mt-4">
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
              <div className="mt-6">
                <Tower
                  label={t("Fastest today")}
                  hot="var(--color-purple)"
                  rows={day.slice(3).map((r) => ({ pos: r.pos, name: r.nickname, value: lapTime(r.lapMs), note: gap(r.lapMs, lead), mine: !!mine && r.nickname === mine, badge: r.badge }))}
                />
              </div>
            )}
          </>
        )}
      </section>

      <section id="championship" aria-labelledby="champ-full-h" className="mt-12 scroll-mt-4">
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
          <div className="mt-4">
            <Tower
              label={t("Championship")}
              rows={champ.map((r) => ({ pos: r.pos, name: r.nickname, value: `${r.gps} GP`, note: r.streak > 1 ? t("{n} in a row", { n: r.streak }) : undefined, mine: r.nickname === mine, badge: r.badge }))}
            />
          </div>
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
    </div>
  );
}
