import { DiscordLogo, EnvelopeSimple, type Icon, InstagramLogo, TiktokLogo, XLogo, YoutubeLogo } from "@phosphor-icons/react";
import { ADS_CONSENT, OPERATOR, SOCIAL, openConsent } from "../legal";
import { GAMES, type GamePage } from "../games/registry";
import { loadSeason, seasonDone } from "../modes/season";
import type { HubAction } from "./Hub";

const ICON: Record<(typeof SOCIAL)[number]["id"], Icon> = { x: XLogo, instagram: InstagramLogo, tiktok: TiktokLogo, youtube: YoutubeLogo, discord: DiscordLogo };

const link = "text-left text-[14px] text-paint/80 transition-colors hover:text-paint";
const heading = "caption text-steel";

/**
 * The site footer: what Lapdle is and who it isn't affiliated with, every game
 * and page in two short columns, then contact, social accounts and cookie
 * choices. Square, hairline-divided, like the rest of the grid.
 */
export function Footer({ onAction }: { onAction: (a: HubAction) => void }) {
  // carry on a season under way, otherwise start one
  const run = loadSeason().run;
  const underWay = !!run && !seasonDone(run);
  const play: [string, HubAction][] = [
    ["Daily Quali", { kind: "daily" }],
    ["Corner of the week", { kind: "corner" }],
    ["Perfect Season", { kind: "season", fresh: !underWay }],
    ["Free Practice", { kind: "practice" }],
    ["Past dailies", { kind: "mini", game: "archive" }],
  ];
  // every game with its own page, from the registry, then the record
  const minis: [string, HubAction][] = [
    ...GAMES.filter((g) => g.route).map((g): [string, HubAction] => [g.name, { kind: "mini", game: g.route!.slice(1) as GamePage }]),
    ["Your record", { kind: "stats" }],
  ];
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-night">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 pt-12 pb-10 md:px-8 lg:grid-cols-[5fr_7fr] lg:gap-16 lg:pt-14">
        <div className="max-w-[46ch]">
          <span className="wide text-[26px] leading-none tracking-[0.02em] text-paint">
            LAPDLE
          </span>
          <p className="mt-4 text-[15px] leading-relaxed text-paint/85">A daily racing-line puzzle on real circuits. Set your line through every corner, drive it, chase the perfect lap.</p>
          <p className="mt-3 text-[13px] leading-relaxed text-steel">
            An independent game, not affiliated with any racing series, governing body or team. Circuit names refer to the venues only. Map data © OpenStreetMap contributors.
          </p>
          {ADS_CONSENT && (
            <button onClick={openConsent} className="mt-5 border border-paint/20 px-3 py-2 text-[13px] font-semibold text-paint/90 transition-colors hover:border-paint/50">
              Cookie choices
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
          <nav aria-label="Play">
            <h2 className={heading}>Play</h2>
            <ul className="mt-3 space-y-2.5">
              {play.map(([name, a]) => (
                <li key={name}>
                  <button className={link} onClick={() => onAction(a)}>
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Minigames">
            <h2 className={heading}>Between laps</h2>
            <ul className="mt-3 space-y-2.5">
              {minis.map(([name, a]) => (
                <li key={name}>
                  <button className={link} onClick={() => onAction(a)}>
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="col-span-2 sm:col-span-1">
            <h2 className={heading}>Lapdle</h2>
            <ul className="mt-3 space-y-2.5">
              <li>
                <a className={link} href="/how-to-play">
                  How to play
                </a>
              </li>
              <li>
                <a className={link} href="/circuits">
                  Circuit guides
                </a>
              </li>
              <li>
                <a className={link} href="/records">
                  Lap records
                </a>
              </li>
              <li>
                <a className={link} href="/trivia">
                  Circuit trivia
                </a>
              </li>
              <li>
                <a className={link} href="/about">
                  About
                </a>
              </li>
              <li>
                <button className={link} onClick={() => onAction({ kind: "mini", game: "privacy" })}>
                  Privacy
                </button>
              </li>
              <li>
                <button className={link} onClick={() => onAction({ kind: "mini", game: "legal" })}>
                  Legal and terms
                </button>
              </li>
              {OPERATOR.email && (
                <li>
                  <a className={`${link} inline-flex items-center gap-2`} href={`mailto:${OPERATOR.email}`}>
                    <EnvelopeSimple weight="bold" className="h-4 w-4 text-steel" aria-hidden="true" />
                    {OPERATOR.email}
                  </a>
                </li>
              )}
            </ul>
            {SOCIAL.length > 0 && (
              <ul className="mt-5 flex gap-1" aria-label="Lapdle on social media">
                {SOCIAL.map((s) => {
                  const I = ICON[s.id];
                  return (
                    <li key={s.id}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer me"
                        aria-label={`Lapdle on ${s.name}`}
                        className="grid h-10 w-10 place-items-center border border-line text-paint/80 transition-colors hover:border-paint/40 hover:text-paint"
                      >
                        <I weight="bold" className="h-[18px] w-[18px]" aria-hidden="true" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-x-6 gap-y-1 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] text-[12px] text-steel md:px-8">
          <span>
            © {year} {OPERATOR.name || "Lapdle"}
          </span>
          <span>Times and lines are simulated. Facts checked against official race pages.</span>
        </p>
      </div>
    </footer>
  );
}
