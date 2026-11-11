import { useEffect, useState } from "react";
import { LANG, t } from "../i18n";
import { dateKey } from "../modes/schedule";
import { type ChampionRow, ONLINE, fetchChampionship, myNickname } from "../online";
import { playStreak, playedDays } from "../games/profile";
import { openPitlane } from "./Pitlane";
import { secondaryBtn } from "./styles";

/**
 * The hub's Championship band: this month's named players with the most Grands Prix (a Grand Prix is a day with a
 * daily game finished), ties broken by days in a row. Resets on the 1st, so anyone can climb. The player's own count
 * comes from this device; a player with no name yet is offered one.
 */
export function Championship() {
  const [rows, setRows] = useState<ChampionRow[] | null | undefined>(undefined);
  const today = dateKey();
  const [mine, setMine] = useState(myNickname);
  useEffect(() => {
    void fetchChampionship(today).then(setRows);
    const on = () => setMine(myNickname());
    window.addEventListener("apex:standing", on);
    return () => window.removeEventListener("apex:standing", on);
  }, [today, mine]);
  if (!ONLINE) return null;

  const month = new Date(`${today}T12:00:00`).toLocaleDateString(LANG === "es" ? "es" : "en-GB", { month: "long" });
  const myGps = [...playedDays().keys()].filter((d) => d.slice(0, 7) === today.slice(0, 7)).length;
  const streak = playStreak().current;
  return (
    <section aria-labelledby="champ-h" className="border-t border-line">
      <div className="mx-auto max-w-[1240px] px-4 py-10 md:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="champ-h" className="wide text-[26px] leading-none text-paint">
            {t("Championship")} <span className="text-steel capitalize">{month}</span>
          </h2>
          <p className="text-[13px] text-steel">{t("A Grand Prix is a day you play a daily game. Resets on the 1st.")}</p>
        </div>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
          {rows && rows.length > 0 ? (
            <ol className="divide-y divide-line border-y border-line">
              {rows.map((r) => (
                <li key={r.nickname} className={`flex items-center gap-3 py-2 text-[15px] ${r.nickname === mine ? "text-ink" : "text-paint"}`}>
                  <span className="num w-8 shrink-0 text-right text-steel">P{r.pos}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {r.nickname}
                    {r.badge && <span className="ml-1.5 text-[#f5c518]" aria-label={t("Brought 10 friends to Lapdle")}>★</span>}
                  </span>
                  {r.streak > 1 && <span className="shrink-0 text-[12px] text-steel">{t("{n} in a row", { n: r.streak })}</span>}
                  <span className="num w-14 shrink-0 text-right font-semibold">{r.gps} GP</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="border-y border-line py-4 text-[14px] text-steel">{rows === undefined ? t("Loading the standings…") : rows === null ? t("The standings can't be reached right now.") : t("No names in this month's standings yet. Be the first.")}</p>
          )}
          <div className="border border-line bg-board/60 p-4">
            <p className="caption">{t("You")}</p>
            <p className="mt-1 text-[15px] text-paint">
              {mine ? t("Racing as {name}", { name: mine }) : t("Racing without a name")}
            </p>
            <p className="mt-2 flex items-baseline gap-3">
              <span className="wide num text-[34px] leading-none text-paint">{myGps}</span>
              <span className="text-[13px] text-steel">{t("Grands Prix this month")}</span>
            </p>
            {streak > 1 && <p className="mt-1 text-[13px] text-steel">{t("{n} days in a row", { n: streak })}</p>}
            <button className={`${secondaryBtn} mt-3`} onClick={() => openPitlane(true)}>
              {mine ? t("Change name") : t("Get on the standings")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
