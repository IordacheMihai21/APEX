import { useEffect, useState } from "react";
import { LANG, t } from "../i18n";
import { CATALOG } from "../game/catalog";
import { dailyCondition, dailyNumber, dailyTrack, dateKey } from "../modes/schedule";
import { type ChampionRow, type DayRow, ONLINE, fetchChampionship, fetchDayBoard, myNickname } from "../online";
import { playStreak, playedDays } from "../games/profile";
import { lapTime } from "./format";
import { openPitlane } from "./Pitlane";
import { TowerPanel } from "./Tower";
import { primaryBtn, secondaryBtn } from "./styles";

/** Under each board: the whole of that board on its own page. */
function FullLink({ href }: { href: string }) {
  return (
    <a href={href} className={`${primaryBtn} mt-3 w-full`}>
      {t("Full standings")}
    </a>
  );
}

const gap = (ms: number, lead: number) => (ms === lead ? "" : `+${((ms - lead) / 1000).toFixed(3)}`);

/**
 * The hub's standings band: this month's Championship (most Grands Prix, a Grand Prix being a day with a daily game
 * played) and today's fastest Daily Quali laps, side by side as timing towers; under both, the player's own line and
 * the way to the full standings page.
 */
export function Championship() {
  const today = dateKey();
  const trackId = dailyTrack(today);
  const cond = dailyCondition(today);
  const info = CATALOG.find((c) => c.id === trackId);
  const [rows, setRows] = useState<ChampionRow[] | null | undefined>(undefined);
  const [fast, setFast] = useState<DayRow[] | null | undefined>(undefined);
  const [mine, setMine] = useState(myNickname);
  useEffect(() => {
    void fetchChampionship(today, 8).then(setRows);
    void fetchDayBoard(today, trackId, cond, 8).then(setFast);
    const on = () => setMine(myNickname());
    window.addEventListener("apex:standing", on);
    return () => window.removeEventListener("apex:standing", on);
  }, [today, trackId, cond, mine]);
  if (!ONLINE) return null;

  const month = new Date(`${today}T12:00:00`).toLocaleDateString(LANG === "es" ? "es" : "en-GB", { month: "long" });
  const myGps = [...playedDays().keys()].filter((d) => d.slice(0, 7) === today.slice(0, 7)).length;
  const streak = playStreak().current;
  const lead = fast?.[0]?.lapMs ?? 0;
  const condName = cond === "wet" ? t("wet") : cond === "lowdf" ? t("low downforce") : t("dry");
  return (
    <section aria-labelledby="champ-h" className="border-t border-line">
      <div className="mx-auto max-w-[1240px] px-4 py-10 md:px-8">
        <h2 id="champ-h" className="wide text-[28px] leading-none text-paint">
          {t("Standings")}
        </h2>
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-2">
          <TowerPanel
            title={
              <>
                {t("Championship")} <span className="text-steel capitalize">{month}</span>
              </>
            }
            subtitle={t("A Grand Prix is a day you play a daily game. Resets on the 1st.")}
            accent="var(--color-ink)"
            rows={rows?.map((r) => ({ pos: r.pos, name: r.nickname, value: `${r.gps} GP`, note: r.streak > 1 ? t("{n} in a row", { n: r.streak }) : undefined, mine: r.nickname === mine, badge: r.badge }))}
            empty={t("No names in this month's standings yet. Be the first.")}
            footer={<FullLink href="/championship" />}
          />
          <TowerPanel
            title={t("Fastest today")}
            subtitle={`${t("Daily Quali #{n}", { n: dailyNumber(today) })} · ${info?.flag ?? ""} ${info?.name ?? ""}, ${condName}`}
            accent="var(--color-purple)"
            hot="var(--color-purple)"
            rows={fast?.map((r) => ({ pos: r.pos, name: r.nickname, value: lapTime(r.lapMs), note: gap(r.lapMs, lead) || undefined, mine: !!mine && r.nickname === mine, badge: r.badge }))}
            empty={t("No laps yet today. Be the first on the podium.")}
            footer={<FullLink href="/fastest" />}
          />
        </div>

        {/* under both boards: the player's own line, then the full standings */}
        <div className="mt-6 flex flex-col gap-4 border border-line bg-board/60 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-baseline gap-4">
            <span className="wide num text-[34px] leading-none text-paint">{myGps}</span>
            <span className="min-w-0 text-[14px] leading-snug text-steel">
              <span className="font-semibold text-paint">{mine ? t("Racing as {name}", { name: mine }) : t("Racing without a name")}</span>
              <br />
              {t("Grands Prix this month")}
              {streak > 1 ? ` · ${t("{n} days in a row", { n: streak })}` : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button className={secondaryBtn} onClick={() => openPitlane(true)}>
              {mine ? t("Change name") : t("Get on the standings")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
