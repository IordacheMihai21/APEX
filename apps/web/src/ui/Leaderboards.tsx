import { type ReactNode, useEffect, useMemo, useState } from "react";
import { LANG, t } from "../i18n";
import { CATALOG } from "../game/catalog";
import { OUTLINES } from "../game/outlines";
import { dailyCondition, dailyNumber, dailyTrack, dateKey } from "../modes/schedule";
import { type ChampionRow, type DayRow, ONLINE, fetchChampionship, fetchDayBoard, myNickname } from "../online";
import { lapTime } from "./format";
import { openPitlane } from "./Pitlane";
import { Podium, Stat } from "./Podium";
import { Tower, type TowerRowData } from "./Tower";
import { primaryBtn, secondaryBtn } from "./styles";

const gap = (ms: number, lead: number) => (ms === lead ? "" : `+${((ms - lead) / 1000).toFixed(3)}`);

/** The player's racing name, kept current when it changes in the pitlane dialog or the menu. */
function useMyName(): string | null {
  const [mine, setMine] = useState(myNickname);
  useEffect(() => {
    const on = () => setMine(myNickname());
    window.addEventListener("apex:standing", on);
    return () => window.removeEventListener("apex:standing", on);
  }, []);
  return mine;
}

/** A leaderboard page: its own scroll, the heading, then the content. */
function Page({ title, kicker, note, children }: { title: string; kicker: string; note?: string; children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[920px] px-4 pt-8 pb-16 md:px-8">
        <p className="text-[14px] text-steel">{kicker}</p>
        <h1 className="wide mt-1 text-[clamp(34px,7vw,58px)] leading-none text-paint">{title}</h1>
        {note && <p className="mt-3 max-w-[60ch] text-[14px] leading-snug text-steel">{note}</p>}
        {children}
      </div>
    </div>
  );
}

/**
 * The full classification under the podium: a search box that narrows it to matching names (places stay as they
 * are), a Find me button that jumps to the player's own row, then the timing tower.
 */
function Classification({ rows, hot, label, mine }: { rows: TowerRowData[]; hot?: string; label: string; mine: string | null }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => (r.name ?? t("Unnamed driver")).toLowerCase().includes(s)) : rows;
  }, [q, rows]);
  const meIn = !!mine && rows.some((r) => r.mine);
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end gap-2.5">
        <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1.5">
          <label htmlFor={`${id}-q`} className="text-[13px] text-steel">
            {t("Find a driver")}
          </label>
          <input
            id={`${id}-q`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Racing name")}
            autoComplete="off"
            className="h-[44px] border border-paint/20 bg-night px-3 text-[16px] text-paint placeholder:text-steel/70 focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>
        {meIn && (
          <button
            className={secondaryBtn}
            onClick={() => {
              setQ("");
              setTimeout(() => document.getElementById("tower-me")?.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
            }}
          >
            {t("Find me")}
          </button>
        )}
      </div>
      <div className="mt-4">{shown.length ? <Tower key={q ? "q" : "all"} rows={shown} hot={hot} label={label} /> : <p className="bg-board px-4 py-4 text-[14px] text-steel">{t("No driver by that name.")}</p>}</div>
    </section>
  );
}

/** Loading (podium-shaped placeholders), unreachable, or empty. */
function Status({ state, empty }: { state: null | undefined | "empty"; empty: string }) {
  return (
    <div className="mt-8">
      {state === undefined ? (
        <div className="grid grid-cols-3 items-end gap-2 sm:gap-4" aria-label={t("Loading the standings…")}>
          <div className="skeleton h-[130px]" />
          <div className="skeleton h-[180px]" />
          <div className="skeleton h-[95px]" />
        </div>
      ) : (
        <p className="bg-board px-4 py-4 text-[14px] text-steel">{state === null ? t("The standings can't be reached right now.") : empty}</p>
      )}
    </div>
  );
}

/** A row of figures above the podium. */
function Stats({ children }: { children: ReactNode }) {
  return <div className="mt-6 grid grid-cols-2 gap-1 sm:grid-cols-4">{children}</div>;
}

function Footer({ mine }: { mine: string | null }) {
  return (
    <div className="mt-10 flex flex-wrap gap-2.5">
      {!mine && (
        <button className={`${primaryBtn} flex-1 basis-48`} onClick={() => openPitlane(true)}>
          {t("Get on the standings")}
        </button>
      )}
      <a className={`${secondaryBtn} flex-1 basis-40`} href="/">
        {t("Play today's games")}
      </a>
    </div>
  );
}

/**
 * /fastest: today's Daily Quali as a podium and a full classification of every driver who set a lap, with the number
 * of drivers, the fastest lap against the perfect lap, and the player's own place.
 */
export function FastestPage() {
  const today = dateKey();
  const trackId = dailyTrack(today);
  const cond = dailyCondition(today);
  const info = CATALOG.find((c) => c.id === trackId);
  const o = OUTLINES[trackId];
  const perfect = cond === "dry" ? o?.lapMs : o?.conditions[cond]?.lapMs;
  const mine = useMyName();
  const [rows, setRows] = useState<DayRow[] | null | undefined>(undefined);
  useEffect(() => {
    void fetchDayBoard(today, trackId, cond, 500).then(setRows);
  }, [today, trackId, cond]);
  if (!ONLINE) return null;
  const condName = cond === "wet" ? t("wet") : cond === "lowdf" ? t("low downforce") : t("dry");
  const lead = rows?.[0]?.lapMs ?? 0;
  const me = mine ? rows?.find((r) => r.nickname === mine) : undefined;
  return (
    <Page title={t("Fastest today")} kicker={`${t("Daily Quali #{n}", { n: dailyNumber(today) })} · ${info?.flag ?? ""} ${info?.name ?? ""}, ${condName}`}>
      {rows && rows.length > 0 ? (
        <>
          <Stats>
            <Stat label={t("Drivers today")} value={String(rows.length)} />
            <Stat label={t("Fastest lap")} value={lapTime(lead)} tone="var(--color-purple)" />
            <Stat label={t("Perfect lap")} value={perfect ? lapTime(perfect) : "-"} />
            <Stat label={t("Your place")} value={me ? `P${me.pos}` : "-"} tone={me ? "var(--color-ink)" : undefined} />
          </Stats>
          <div className="mt-10">
            <Podium hot="var(--color-purple)" entries={rows.slice(0, 3).map((r) => ({ name: r.nickname, value: lapTime(r.lapMs), sub: gap(r.lapMs, lead), mine: !!mine && r.nickname === mine }))} />
          </div>
          <Classification
            rows={rows.map((r) => ({ pos: r.pos, name: r.nickname, value: lapTime(r.lapMs), note: gap(r.lapMs, lead) || undefined, mine: !!mine && r.nickname === mine, badge: r.badge }))}
            hot="var(--color-purple)"
            label={t("Fastest today")}
            mine={mine}
          />
        </>
      ) : (
        <Status state={rows === undefined ? undefined : rows === null ? null : "empty"} empty={t("No laps yet today. Be the first on the podium.")} />
      )}
      <Footer mine={mine} />
    </Page>
  );
}

/**
 * /championship: this month's Championship as a podium and a full classification of every named driver, one place
 * each, with the number of drivers, the leader's Grands Prix, the days left before it starts again, and the player's
 * own place.
 */
export function ChampionshipPage() {
  const today = dateKey();
  const mine = useMyName();
  const [rows, setRows] = useState<ChampionRow[] | null | undefined>(undefined);
  useEffect(() => {
    void fetchChampionship(today, 500).then(setRows);
  }, [today]);
  if (!ONLINE) return null;
  const d = new Date(`${today}T12:00:00`);
  const month = d.toLocaleDateString(LANG === "es" ? "es" : "en-GB", { month: "long" });
  const daysLeft = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1;
  const me = mine ? rows?.find((r) => r.nickname === mine) : undefined;
  const value = (r: ChampionRow) => `${r.gps} GP`;
  const note = (r: ChampionRow) => (r.streak > 1 ? t("{n} in a row", { n: r.streak }) : undefined);
  return (
    <Page title={`${t("Championship")} ${month.charAt(0).toUpperCase()}${month.slice(1)}`} kicker={t("Most Grands Prix this month")} note={t("A Grand Prix is a day you play a daily game. Ties go to the longer run of days in a row, then to more daily games played this month.")}>
      {rows && rows.length > 0 ? (
        <>
          <Stats>
            <Stat label={t("Drivers")} value={String(rows.length)} />
            <Stat label={t("Leader")} value={value(rows[0])} tone="var(--color-yellow)" />
            <Stat label={t("Days left")} value={String(daysLeft)} />
            <Stat label={t("Your place")} value={me ? `P${me.pos}` : "-"} tone={me ? "var(--color-ink)" : undefined} />
          </Stats>
          <div className="mt-10">
            <Podium entries={rows.slice(0, 3).map((r) => ({ name: r.nickname, value: value(r), sub: note(r), mine: r.nickname === mine }))} />
          </div>
          <Classification rows={rows.map((r) => ({ pos: r.pos, name: r.nickname, value: value(r), note: note(r), mine: r.nickname === mine, badge: r.badge }))} label={t("Championship")} mine={mine} />
        </>
      ) : (
        <Status state={rows === undefined ? undefined : rows === null ? null : "empty"} empty={t("No names in this month's standings yet. Be the first.")} />
      )}
      <Footer mine={mine} />
    </Page>
  );
}
