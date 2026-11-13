import { GAMES, type GameDef, type GameId, PAGES, type InfoPage, PUBLIC_ROUTES, game } from "../games/registry";
import { t, withLang } from "../i18n";
import { Page, Section, link } from "./Guides";
import { GameAbout } from "./GameAbout";
import { Privacy } from "../ui/Privacy";
import { Legal } from "../ui/Legal";

/**
 * What the game's own pages (the hub, each game, the archive and records)
 * carry in their static HTML: a title, a description and a short page of text
 * with links, so search engines and link previews see a real page with its
 * own address instead of an empty shell. The app replaces it as soon as it
 * starts (src/main.tsx renders into #root); it is never shown in the app.
 */

const playHref = (g: GameDef) => withLang(g.route ?? "/");

const INFO: Record<InfoPage, { h1: string; description: string; text: string }> = {
  archive: {
    h1: "Daily Quali archive",
    description: "Every past Daily Quali in Lapdle, circuit by circuit. Replay any day's circuit and conditions and chase that day's perfect lap. Free, no sign-up.",
    text: "Every past Daily Quali, kept by day. Open any of them to drive that day's circuit in that day's conditions and chase its perfect lap. Archive laps are played the same way and kept apart from the daily board.",
  },
  records: {
    h1: "Lap records",
    description: "The fastest Daily Quali laps on every circuit in Lapdle, each against the perfect lap, plus the boards of the last 30 days.",
    text: "The fastest Daily Quali lap ever set on each circuit and condition, measured against the perfect lap, and the boards of the last 30 days. Only laps from each day's real Daily Quali count.",
  },
  standings: {
    h1: "Standings",
    description: "Today's Daily Quali podium and full classification, and this month's Championship of the players who come back most.",
    text: "Today's Daily Quali as a podium, then every driver who set a lap, one place each, and this month's Championship: a Grand Prix for each day you play a daily game.",
  },
  privacy: {
    h1: "Privacy",
    description: "How Lapdle handles data: no account, game progress kept on your device, an anonymous daily leaderboard entry, cookieless analytics, and ads and consent.",
    text: "Lapdle has no accounts. Your progress is saved on your device; a finished Daily Quali sends your line with an anonymous device number for the leaderboard. Analytics are cookieless and aggregate.",
  },
  legal: {
    h1: "Legal notice and terms",
    description: "Who runs Lapdle, the terms of use, and the sources and licences behind the circuits and maps.",
    text: "Who runs Lapdle, the terms for playing it, and the sources and licences of the circuit data and maps. Lapdle is an independent game, not affiliated with any racing series, governing body or team.",
  },
};

function GameList({ except }: { except?: GameId }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {GAMES.filter((g) => g.id !== except).map((g) => (
        <li key={g.id} className="py-3">
          <a className={`${link} wide text-[18px]`} href={playHref(g)}>
            {g.name}
          </a>
          <span className="mt-1 block text-[15px] leading-snug text-steel">{g.tagline}</span>
        </li>
      ))}
    </ul>
  );
}

function MoreLinks() {
  return (
    <p className="flex flex-wrap gap-x-5 gap-y-2">
      <a className={link} href={withLang("/how-to-play")}>
        {t("How to play")}
      </a>
      <a className={link} href="/circuits">
        {t("Circuit guides")}
      </a>
      <a className={link} href="/trivia">
        {t("Circuit trivia")}
      </a>
      <a className={link} href="/corners">
        {t("Famous corners")}
      </a>
      <a className={link} href="/learn">
        {t("Learn the racing line")}
      </a>
      <a className={link} href="/about">
        {t("About Lapdle")}
      </a>
    </p>
  );
}

function Hub() {
  return (
    <Page>
      <header>
        <p className="caption">{t("Daily racing games")}</p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">{t("Lapdle: the daily racing line challenge")}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-paint/90">{game("quali").guide.intro}</p>
        <p className="mt-2 text-[15px] text-steel">{t("Free in the browser, no account, no download. A new set every day at midnight.")}</p>
      </header>
      <Section title={t("Today's games")}>
        <GameList />
      </Section>
      <GameAbout id="quali" className="space-y-8" />
      <MoreLinks />
    </Page>
  );
}

function GamePage({ id }: { id: GameId }) {
  const g = game(id);
  return (
    <Page>
      <header>
        <p className="caption">
          <a className={link} href={withLang("/")}>
            Lapdle
          </a>
        </p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">{g.name}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-paint/90">{g.blurb}</p>
        <p className="mt-2 text-[15px] text-steel">{g.cadence === "daily" ? t("A new round every day at midnight, the same for everyone.") : t("Play as often as you like.")}</p>
      </header>
      <GameAbout id={id} className="space-y-8" />
      <Section title={t("More to play")}>
        <GameList except={id} />
      </Section>
      <MoreLinks />
    </Page>
  );
}

function Corner() {
  return (
    <Page>
      <header>
        <p className="caption">
          <a className={link} href={withLang("/")}>
            Lapdle
          </a>
        </p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">{t("Corner of the week")}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-paint/90">
          {t("One famous corner a week. Set your line through it as often as you like and get as close as you can to the perfect time through that corner.")}
        </p>
      </header>
      <Section title={t("How it works")}>
        <p>{t("Each week, from Monday to Sunday, Lapdle picks one of the best-known corners in racing: La Source, Tarzan, the Parabolica, Sainte Dévote and others, traced from the real circuit. The rest of the lap runs on the perfect line, so everyone arrives at the corner at the same speed, and you only decide what happens inside it.")}</p>
        <p>{t("You set where the car brakes, how deep it turns in, where it touches the apex and how early it gets back on the power. The car then drives your line with the same physics as the Daily Quali, and the score is the time you lose to the perfect line through that corner alone.")}</p>
        <p>{t("You can try as often as you like. Your best run of the week is the one that counts, and it earns a medal the closer it gets to the perfect line. A new corner arrives every Monday.")}</p>
      </Section>
      <Section title={t("Famous corner guides")}>
        <p>{t("Every corner in the rotation has a guide: where it is and why it is famous, how to drive it, the mistakes to avoid, and the corner in numbers from Lapdle's own physics.")}</p>
        <p>
          <a className={link} href="/corners">
            {t("Famous corners")}
          </a>
        </p>
      </Section>
      <Section title={t("More to play")}>
        <GameList />
      </Section>
      <MoreLinks />
    </Page>
  );
}

function Info({ page }: { page: InfoPage }) {
  const p = INFO[page];
  return (
    <Page>
      <header>
        <p className="caption">
          <a className={link} href={withLang("/")}>
            Lapdle
          </a>
        </p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">{t(p.h1)}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-paint/90">{t(p.text)}</p>
      </header>
      <MoreLinks />
    </Page>
  );
}

/** The app's own addresses that get a static page (every public route). */
export const LANDING_ROUTES = PUBLIC_ROUTES;

/** A route's static page, title and description. */
export function landing(route: string): { node: React.ReactNode; title: string; description: string } {
  const quali = game("quali");
  if (route === "/") return { node: <Hub />, title: quali.title, description: quali.blurb };
  if (route === "/corner")
    return {
      node: <Corner />,
      title: t("Corner of the week: master one famous corner | Lapdle"),
      description: t("One famous corner a week from a real circuit. Set your line through it as often as you like and chase the perfect time. Free, no sign-up."),
    };
  const key = route.slice(1);
  if (key in PAGES) {
    const page = key as InfoPage;
    // the privacy page and the legal notice in full, as the app shows them, with the links home
    if (page === "privacy" || page === "legal")
      return {
        node: (
          <>
            {page === "privacy" ? <Privacy /> : <Legal />}
            <div className="mx-auto max-w-[68ch] px-4 pb-16 md:px-8">
              <MoreLinks />
            </div>
          </>
        ),
        title: t(PAGES[page]),
        description: t(INFO[page].description),
      };
    return { node: <Info page={page} />, title: t(PAGES[page]), description: t(INFO[page].description) };
  }
  const g = GAMES.find((x) => x.route === route);
  if (!g) throw new Error(`no static page for ${route}`);
  return { node: <GamePage id={g.id} />, title: g.title, description: `${g.blurb} ${t("Free, no sign-up.")}` };
}
