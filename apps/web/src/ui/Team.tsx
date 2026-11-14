import { useEffect, useMemo, useState } from "react";
import { LANG, t } from "../i18n";
import { dateKey } from "../modes/schedule";
import { type GridCar, ONLINE, fetchTeamDays, fetchTeamGrid, myNickname } from "../online";
import { ROAD_GOAL, inviteParam } from "../community";
import { shareOrCopy } from "./ShareDay";
import { shared } from "../games/events";
import { openPitlane } from "./Pitlane";
import { primaryBtn, secondaryBtn } from "./styles";

/** Day 1 of the Road to 1,000 challenge (the first "Road to 1,000: Day 1" video). */
export const TEAM_START = "2026-11-13";

const dayNumber = (day: string) => Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${TEAM_START}T12:00:00Z`)) / 864e5) + 1;
const dayOf = (n: number) => new Date(Date.parse(`${TEAM_START}T12:00:00Z`) + (n - 1) * 864e5).toISOString().slice(0, 10);
const shortDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(LANG === "es" ? "es" : "en-GB", { day: "numeric", month: "short" });

/** One car in its grid slot: the two white lines of a starting box, the car from above, its number and its driver. */
function Slot({ car, mine, i }: { car: GridCar; mine: boolean; i: number }) {
  return (
    <li className="team-car relative flex flex-col items-center" style={{ ["--i" as string]: Math.min(i, 40) }}>
      <span aria-hidden="true" className="absolute top-0 left-[14%] h-[3px] w-[72%] bg-paint/35" />
      <span aria-hidden="true" className="absolute top-0 left-[14%] h-5 w-[3px] bg-paint/35" />
      <span className="num absolute top-1 left-[20%] text-[10px] text-steel">{car.pos}</span>
      <img
        src={`/cars/${car.colour}.webp`}
        alt=""
        width={42}
        height={100}
        loading={i > 60 ? "lazy" : "eager"}
        className={`mt-3 h-[100px] w-auto drop-shadow-[0_6px_6px_rgba(0,0,0,0.45)] ${mine ? "team-me" : ""}`}
      />
      <span className={`mt-1 w-full truncate px-0.5 text-center text-[12px] leading-tight font-semibold ${car.nickname ? (mine ? "text-ink" : "text-paint") : "text-steel/70"}`}>
        {car.nickname ?? " "}
        {car.badge && <span className="ml-0.5 text-[#f5c518]">★</span>}
      </span>
      {mine && <span className="mt-0.5 bg-ink px-1.5 py-px text-[10px] font-bold tracking-[0.06em] text-night uppercase">{t("You")}</span>}
    </li>
  );
}

/**
 * /team: the Road to 1,000 as a starting grid. Every driver who plays a daily game puts one car on that day's grid, in
 * the order they joined it: named drivers with their name, in their car colour (three friends who played unlock the
 * colours; everyone else races Papaya), drivers without a name in grey. One grid per day of the challenge, from Day 1
 * (13 November); today's fills up as people play.
 */
export function Team() {
  const today = dateKey();
  const todayN = Math.max(1, dayNumber(today));
  const [n, setN] = useState(() => {
    const q = Number(new URLSearchParams(typeof location !== "undefined" ? location.search : "").get("day"));
    return Number.isInteger(q) && q >= 1 && q <= todayN ? q : todayN;
  });
  const day = dayOf(n);
  const [cars, setCars] = useState<GridCar[] | null | undefined>(undefined);
  const [days, setDays] = useState<{ day: string; cars: number }[]>([]);
  const [copied, setCopied] = useState(false);
  const mine = myNickname();
  useEffect(() => {
    void fetchTeamDays(TEAM_START).then((d) => d && setDays(d.filter((x) => x.day <= today)));
  }, [today]);
  useEffect(() => {
    setCars(undefined);
    void fetchTeamGrid(day).then(setCars);
  }, [day]);
  const count = cars?.length ?? days.find((d) => d.day === day)?.cars ?? 0;
  const left = Math.max(0, ROAD_GOAL - count);
  const best = useMemo(() => days.reduce((m, d) => Math.max(m, d.cars), 0), [days]);
  if (!ONLINE) return null;

  const invite = async () => {
    shared("team");
    const link = `${location.origin}/team?ref=invite&${inviteParam()}`;
    if (await shareOrCopy(`${t("I'm on the Lapdle grid. Put your car next to mine:")}\n${link}`, "invite")) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-4 pt-8 pb-16 md:px-8">
        <p className="text-[14px] text-steel">{t("Road to 1,000")}</p>
        <h1 className="wide mt-1 text-[clamp(36px,7vw,60px)] leading-none text-paint">{t("The team")}</h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-snug text-steel">{t("Every driver who plays a daily game puts one car on that day's grid. Fill all 1,000 places in one day and a new circuit joins Lapdle for everyone.")}</p>

        {/* the days of the challenge */}
        <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label={t("Days of the challenge")}>
          {Array.from({ length: todayN }, (_, k) => todayN - k).map((d) => {
            const info = days.find((x) => x.day === dayOf(d));
            const on = d === n;
            return (
              <button
                key={d}
                role="tab"
                aria-selected={on}
                onClick={() => setN(d)}
                className={`flex shrink-0 flex-col items-start border px-3 py-2 text-left transition-colors ${on ? "border-ink bg-ink/10" : "border-line bg-board hover:border-paint/30"}`}
              >
                <span className={`text-[13px] font-semibold ${on ? "text-ink" : "text-paint"}`}>
                  {t("Day {n}", { n: d })}
                  {d === todayN && <span className="ml-1.5 text-[11px] text-green">{t("live")}</span>}
                </span>
                <span className="num text-[12px] text-steel">
                  {shortDate(dayOf(d))}
                  {info ? ` · ${info.cars}` : ""}
                </span>
              </button>
            );
          })}
        </div>

        {/* the count against the goal */}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <p className="flex items-baseline gap-2">
            <span className="wide num text-[56px] leading-none text-paint">{count}</span>
            <span className="text-[16px] text-steel">/ {ROAD_GOAL.toLocaleString()} {t("cars")}</span>
          </p>
          {best > 0 && <p className="text-[14px] text-steel">{t("Best day so far: {n}.", { n: best })}</p>}
        </div>
        <div className="mt-3 h-1.5 w-full bg-asphalt">
          <div className="h-full bg-ink transition-[width] duration-700" style={{ width: `${Math.min(100, (count / ROAD_GOAL) * 100)}%` }} />
        </div>

        {/* the grid */}
        {cars === undefined ? (
          <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(78px,1fr))] gap-x-2 gap-y-6">
            {Array.from({ length: 16 }, (_, i) => (
              <div key={i} className="skeleton h-[130px]" />
            ))}
          </div>
        ) : cars === null ? (
          <p className="mt-8 bg-board px-4 py-4 text-[14px] text-steel">{t("The grid can't be reached right now.")}</p>
        ) : cars.length === 0 ? (
          <p className="mt-8 bg-board px-4 py-4 text-[14px] text-steel">{n === todayN ? t("No cars on today's grid yet. Play a daily game and be the first.") : t("No cars on this day's grid.")}</p>
        ) : (
          <ol key={day} className="team-grid mt-8 grid grid-cols-[repeat(auto-fill,minmax(78px,1fr))] gap-x-2 gap-y-7">
            {cars.map((c, i) => (
              <Slot key={c.pos} car={c} i={i} mine={!!mine && c.nickname === mine} />
            ))}
          </ol>
        )}

        {/* the places still free, and how to fill them */}
        <div className="mt-10 border border-dashed border-paint/25 p-5">
          <p className="wide text-[22px] leading-tight text-paint">{t("{n} places left on the grid", { n: left.toLocaleString() })}</p>
          <p className="mt-2 max-w-[60ch] text-[14px] leading-snug text-steel">{t("Every friend who opens your link and plays is one more car. Bring three and you pick your car's colour; everyone else races Papaya.")}
            {dateKey() <= "2026-11-23" && ` ${t("This week only: the Neon car, pink to turquoise.")}`}</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button className={`${primaryBtn} flex-1 basis-44`} onClick={invite}>
              {copied ? t("Link copied") : t("Invite friends")}
            </button>
            {!mine && (
              <button className={`${secondaryBtn} flex-1 basis-44`} onClick={() => openPitlane(true)}>
                {t("Put your name on your car")}
              </button>
            )}
          </div>
        </div>
        <p className="mt-6 text-[12px] text-steel/80">{t("Car model: “My take on the 2026 f1 regulations” by MaG80, CC BY 4.0.")}</p>
      </div>
    </div>
  );
}
