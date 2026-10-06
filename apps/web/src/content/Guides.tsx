import { GAMES, type GameDef, type GameId, game } from "../games/registry";

/**
 * The content pages: How to play (an index and one guide per game) and About.
 * Plain components with no browser state, so the build can render them to
 * static HTML for search engines (src/ssg) and the app renders the same
 * markup when the page is opened in the game. Internal links are ordinary
 * anchors; the app turns clicks on them into in-app navigation.
 */

export const link = "text-paint underline decoration-line underline-offset-4 hover:decoration-paint";

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto max-w-[68ch] space-y-8 px-4 pt-8 pb-16 md:px-8 lg:pt-12">{children}</article>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h2 className="wide text-[22px] leading-tight text-paint">{title}</h2>
      <div className="mt-3 space-y-3 text-[16px] leading-relaxed text-paint/85">{children}</div>
    </section>
  );
}

/** Where a game is played: its own page, or the hub for the Daily Quali. */
const playHref = (g: GameDef) => g.route ?? "/";

export function HowToPlayIndex() {
  return (
    <Page>
      <header>
        <p className="caption">Lapdle</p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">How to play</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-paint/85">
          Lapdle is a set of short racing games on real circuits, new every day. The Daily Quali is the main event; the others take a minute or two each. Pick a game for its rules, scoring and tips.
        </p>
      </header>
      <ul className="divide-y divide-line border-y border-line">
        {GAMES.map((g) => (
          <li key={g.id}>
            <a href={`/how-to-play/${g.id}`} className="group flex items-start gap-4 py-4">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="wide text-[20px] leading-tight text-paint">{g.name}</span>
                  {g.inDailySet && <span className="bg-ink px-1.5 py-px text-[11px] font-bold tracking-[0.04em] text-night uppercase">Daily</span>}
                </span>
                <span className="mt-1 block text-[15px] leading-snug text-steel">{g.guide.intro}</span>
              </span>
              <span className="mt-1 shrink-0 text-[14px] font-semibold text-ink transition-transform group-hover:translate-x-0.5">Guide ›</span>
            </a>
          </li>
        ))}
      </ul>
    </Page>
  );
}

export function HowToPlayGuide({ id }: { id: GameId }) {
  const g = game(id);
  const others = GAMES.filter((x) => x.id !== id);
  return (
    <Page>
      <header>
        <p className="caption">
          <a className={link} href="/how-to-play">
            How to play
          </a>
        </p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">{g.name}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-paint/90">{g.guide.intro}</p>
        <p className="mt-2 text-[15px] text-steel">{g.cadence === "daily" ? "A new round every day at midnight, the same for everyone." : "Play as often as you like."}</p>
      </header>

      {g.howTo && (
        <Section title="How it works">
          <ol className="space-y-4">
            {g.howTo.steps.map((step, i) => (
              <li key={i} className="grid grid-cols-[28px_1fr] items-start gap-3">
                <span className="wide num grid h-7 w-7 place-items-center bg-ink text-[14px] text-night">{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title="Scoring">
        <p>{g.guide.scoring}</p>
        {g.howTo && <p className="text-steel">{g.howTo.tip}</p>}
      </Section>

      <Section title="Tips">
        <ul className="list-disc space-y-2 pl-5 marker:text-ink">
          {g.guide.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Section>

      <div>
        <a href={playHref(g)} className="btn-go cut wide inline-flex items-center justify-center gap-2 bg-ink py-3 pr-10 pl-6 text-[15px] whitespace-nowrap text-night uppercase">
          Play {g.name}
        </a>
      </div>

      <Section title="More guides">
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {others.map((o) => (
            <li key={o.id}>
              <a className={link} href={`/how-to-play/${o.id}`}>
                {o.name}
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}

export function About() {
  return (
    <Page>
      <header>
        <p className="caption">About</p>
        <h1 className="wide mt-2 text-[clamp(32px,6vw,52px)] leading-none text-paint">Lapdle</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-paint/90">
          Lapdle is a daily racing line challenge: a set of short, free games on real circuits for anyone who enjoys a good racing line. It plays in the browser, with no account and no download.
        </p>
      </header>

      <Section title="The games">
        <p>Every day brings a new set, the same for everyone, and a few more to play whenever you like.</p>
        <ul className="divide-y divide-line border-y border-line">
          {GAMES.map((g) => (
            <li key={g.id} className="py-3">
              <a className={`${link} font-semibold`} href={`/how-to-play/${g.id}`}>
                {g.name}
              </a>
              <span className="text-steel">: {g.tagline}.</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="How the circuits are made">
        <p>
          Each circuit is traced from real map data and drawn from above with its kerbs, run-off and surroundings. The car follows your line under a physics model with limits on grip, braking, cornering and power,
          so a better line really is faster. The perfect lap you chase is the fastest line that model can find.
        </p>
        <p>
          Map data is © OpenStreetMap contributors, available under the Open Database License. Circuit names refer to the real venues only; Lapdle is an independent game, not affiliated with any racing series,
          governing body or team.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions, ideas or a bug to report? Write to{" "}
          <a className={link} href="mailto:contact@lapdle.com">
            contact@lapdle.com
          </a>
          . Read how your data is handled in the{" "}
          <a className={link} href="/privacy">
            privacy notice
          </a>
          .
        </p>
      </Section>
    </Page>
  );
}
