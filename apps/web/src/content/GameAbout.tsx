import { type GameId, game } from "../games/registry";
import { LANG, t, withLang } from "../i18n";
import { article } from "./articles";
import { GAME_ABOUT } from "./gameText";
import { Section, link } from "./Guides";

/**
 * A page of text under each game, in the app and in its static page: what the game is about in the real sport, how
 * it works, how it's scored, tips, and where to read more. No browser state, so the build renders the same markup.
 */
export function GameAbout({ id, className = "mx-auto max-w-[68ch] space-y-8 px-4 pt-10 pb-12 md:px-8" }: { id: GameId; className?: string }) {
  const g = game(id);
  const more = GAME_ABOUT[id];
  return (
    <div className={className}>
      <Section title={t("About {game}", { game: g.name })}>
        <p>{g.guide.intro}</p>
        {more.about.map((p) => (
          <p key={p}>{t(p)}</p>
        ))}
      </Section>
      {g.howTo && (
        <Section title={t("How it works")}>
          <ol className="list-decimal space-y-2 pl-5 marker:text-ink">
            {g.howTo.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Section>
      )}
      <Section title={t("Scoring")}>
        <p>{g.guide.scoring}</p>
      </Section>
      <Section title={t("Tips")}>
        <ul className="list-disc space-y-2 pl-5 marker:text-ink">
          {g.guide.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </Section>
      <Section title={t("Read more")}>
        <ul className="space-y-2">
          <li>
            <a className={link} href={withLang(`/how-to-play/${id}`)}>
              {t("Rules, scoring and tips for {game}", { game: g.name })}
            </a>
          </li>
          {/* the Learn articles and circuit guides are in English only */}
          {more.learn.map((slug) => (
            <li key={slug}>
              <a className={link} href={`/learn/${slug}`} hrefLang={LANG === "es" ? "en" : undefined}>
                {article(slug)!.title}
              </a>
            </li>
          ))}
          <li>
            <a className={link} href="/circuits" hrefLang={LANG === "es" ? "en" : undefined}>
              {t("Circuit guides")}
            </a>
          </li>
        </ul>
      </Section>
    </div>
  );
}
