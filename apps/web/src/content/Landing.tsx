import { GAMES, type GameDef, type GameId, PAGES, type InfoPage, PUBLIC_ROUTES, game } from "../games/registry";
import { Page, Section, link } from "./Guides";

/**
 * What the game's own pages (the hub, each game, the archive and records)
 * carry in their static HTML: a title, a description and a short page of text
 * with links, so search engines and link previews see a real page with its
 * own address instead of an empty shell. The app replaces it as soon as it
 * starts (src/main.tsx renders into #root); it is never shown in the app.
 */

const playHref = (g: GameDef) => g.route ?? "/";

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
      <a className={link} href="/how-to-play">
        How to play
      </a>
      <a className={link} href="/circuits">
        Circuit guides
      </a>
      <a className={link} href="/trivia">
        Circuit trivia
      </a>
      <a className={link} href="/about">
        About Lapdle
      </a>
    </p>
  );
}

function Hub() {
  return (
    <Page>
      <header>
        <p className="caption">Daily racing games</p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">Lapdle: the daily racing line challenge</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-paint/90">{game("quali").guide.intro}</p>
        <p className="mt-2 text-[15px] text-steel">Free in the browser, no account, no download. A new set every day at midnight.</p>
      </header>
      <Section title="Today's games">
        <GameList />
      </Section>
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
          <a className={link} href="/">
            Lapdle
          </a>
        </p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">{g.name}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-paint/90">{g.blurb}</p>
        <p className="mt-2 text-[15px] text-steel">{g.cadence === "daily" ? "A new round every day at midnight, the same for everyone." : "Play as often as you like."}</p>
      </header>
      {g.howTo && (
        <Section title="How it works">
          <ol className="list-decimal space-y-2 pl-5 marker:text-ink">
            {g.howTo.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p>
            <a className={link} href={`/how-to-play/${id}`}>
              Rules, scoring and tips for {g.name}
            </a>
          </p>
        </Section>
      )}
      <Section title="More to play">
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
          <a className={link} href="/">
            Lapdle
          </a>
        </p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">Corner of the week</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-paint/90">
          One famous corner a week. Set your line through it as often as you like and get as close as you can to the perfect time through that corner.
        </p>
      </header>
      <Section title="More to play">
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
          <a className={link} href="/">
            Lapdle
          </a>
        </p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">{p.h1}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-paint/90">{p.text}</p>
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
      title: "Corner of the week: master one famous corner | Lapdle",
      description: "One famous corner a week from a real circuit. Set your line through it as often as you like and chase the perfect time. Free, no sign-up.",
    };
  const key = route.slice(1);
  if (key in PAGES) {
    const page = key as InfoPage;
    return { node: <Info page={page} />, title: PAGES[page], description: INFO[page].description };
  }
  const g = GAMES.find((x) => x.route === route);
  if (!g) throw new Error(`no static page for ${route}`);
  return { node: <GamePage id={g.id} />, title: g.title, description: `${g.blurb} Free, no sign-up.` };
}
