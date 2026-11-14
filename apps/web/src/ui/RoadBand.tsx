import { dateKey } from "../modes/schedule";
import { useEffect, useState } from "react";
import { BADGE_FRIENDS, COLOURS, ROAD_GOAL, fetchRoad, myInviteCode, refreshInvites, useCommunity } from "../community";
import { shareOrCopy } from "./ShareDay";
import { shared } from "../games/events";
import { t } from "../i18n";
import { primaryBtn } from "./styles";

/**
 * The hub's "Road to 1,000" band: today's players against the goal (a new circuit joins the game when a day reaches
 * it), and the player's own invite link with the rewards it unlocks: friends who come in on it and play.
 */
export function RoadBand() {
  const [road, setRoad] = useState<{ today: number; best: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const c = useCommunity();
  useEffect(() => {
    void fetchRoad().then(setRoad);
    void refreshInvites();
  }, []);

  const invite = async () => {
    shared("invite");
    const link = `${location.origin}/?ref=invite&inv=${myInviteCode()}`;
    if (await shareOrCopy(`${t("Five daily F1 games, free, the same for everyone. Play today's with me:")}\n${link}`, "invite")) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const pct = road ? Math.min(100, (road.today / ROAD_GOAL) * 100) : 0;
  const rewards: [number, string][] = [
    [1, t("{colour} line colour", { colour: "Magenta" })],
    [3, dateKey() <= "2026-11-23" ? t("The Neon car on the team grid, this week only, or any colour") : t("Pick your car colour on the team grid")],
    [BADGE_FRIENDS, t("Gold star on the board")],
  ];
  return (
    <section aria-labelledby="road-h" className="border-t border-line">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 md:px-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <h2 id="road-h" className="wide text-[26px] leading-none text-paint">
            {t("Road to 1,000")}
          </h2>
          <p className="mt-2 max-w-[44ch] text-[15px] leading-snug text-steel">{t("The day 1,000 players play a daily game, a new circuit joins Lapdle for everyone.")}</p>
          <div className="mt-4" aria-hidden={!road}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="wide num text-[34px] leading-none text-paint">{road ? road.today.toLocaleString() : "…"}</span>
              <span className="text-[13px] text-steel">{t("players today, of {goal}", { goal: ROAD_GOAL.toLocaleString() })}</span>
            </div>
            <div className="mt-2 h-2 w-full bg-asphalt" role="progressbar" aria-valuemin={0} aria-valuemax={ROAD_GOAL} aria-valuenow={road?.today ?? 0} aria-label={t("Players today")}>
              <div className="h-full bg-ink transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
            {road && road.best > road.today && <p className="mt-1.5 text-[13px] text-steel">{t("Best day so far: {n}.", { n: road.best.toLocaleString() })}</p>}
            <a href="/team" className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink underline-offset-4 hover:underline">
              {t("See today's grid")} <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        <div>
          <h3 className="wide text-[20px] leading-none text-paint">{t("Bring a friend, unlock a colour")}</h3>
          <p className="mt-2 max-w-[44ch] text-[14px] leading-snug text-steel">{t("Every friend who opens your link and plays a daily game counts. They get the Magenta colour too.")}</p>
          <ul className="mt-3 space-y-1.5">
            {rewards.map(([need, label]) => {
              const done = c.friends >= need;
              return (
                <li key={need} className={`flex items-center gap-3 text-[14px] ${done ? "text-paint" : "text-steel"}`}>
                  <span className={`num grid h-6 w-6 shrink-0 place-items-center border text-[12px] ${done ? "border-ink bg-ink text-night" : "border-line"}`}>{done ? "✓" : need}</span>
                  {label}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[13px] text-steel">
            {c.friends === 1 ? t("1 friend has played from your link.") : t("{n} friends have played from your link.", { n: c.friends })}
            {c.gift && ` ${t("You came in on a friend's link: Magenta is yours.")}`}
          </p>
          <button className={`${primaryBtn} mt-4`} onClick={invite}>
            {copied ? t("Link copied") : t("Invite friends")}
          </button>
        </div>
      </div>
    </section>
  );
}

/** The menu's colour picker: Papaya for everyone, the rest once unlocked. */
export function ColourPicker({ headingClass }: { headingClass: string }) {
  const c = useCommunity();
  return (
    <>
      <p className={headingClass}>{t("Your colour")}</p>
      <div className="flex flex-wrap gap-2.5 px-5 py-3" role="radiogroup" aria-label={t("Your colour")}>
        {COLOURS.filter((x) => !x.until || dateKey() <= x.until || c.colour.id === x.id).map((x) => {
          const open = x.id === "papaya" || c.colours.includes(x.id);
          const on = c.colour.id === x.id;
          return (
            <button
              key={x.id}
              role="radio"
              aria-checked={on}
              disabled={!open}
              title={open ? x.name : (x.need === 1 ? t("{colour}: bring 1 friend", { colour: x.name }) : t("{colour}: bring {n} friends", { colour: x.name, n: x.need }))}
              aria-label={open ? x.name : (x.need === 1 ? t("{colour}: bring 1 friend", { colour: x.name }) : t("{colour}: bring {n} friends", { colour: x.name, n: x.need }))}
              onClick={() => void import("../community").then((m) => m.setPlayerColour(x.id))}
              className={`grid h-9 w-9 place-items-center rounded-full border-2 ${on ? "border-paint" : "border-transparent"} disabled:opacity-35`}
            >
              <span className="h-6 w-6 rounded-full" style={{ background: x.swatch ?? x.hex }} />
            </button>
          );
        })}
      </div>
    </>
  );
}
